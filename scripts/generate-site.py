#!/usr/bin/env python3
import argparse
import csv
import dataclasses
import html
import json
import os
import re
import sys
import jinja2

SITE_NAME = "Invention & Discovery Cards"
SITE_DESCRIPTION = """A Civilization-inspired tech tree but for the real life history of science and discovery. Inventions and discoveries presented in illustrated Magic-style cards."""
SITE_ROOT = 'https://invention.cards'
# Sitemap <lastmod>. Bump this (YYYY-MM-DD) whenever card/story page content
# materially changes — it's the signal that tells Google to re-crawl pages it
# last fetched months ago. Keep it a hand-set constant rather than today's date
# so every rebuild doesn't falsely claim every page just changed (which Google
# learns to ignore).
CONTENT_LASTMOD = '2026-06-13'


@dataclasses.dataclass(frozen=True)
class Invention:
  id: str
  year: int
  title: str
  summary: str
  inventor: str = ""
  location: str = ""
  field: str = ""
  # The TSV's "URL" column is misnamed: it actually holds a fuller, prose
  # paragraph (verbatim/near-verbatim source text), not a link. Rendered as
  # the card page's SEO body beneath the card when present.
  detail: str = ""
  dependencies: tuple = ()


def _parse_year(raw):
  s = raw.strip().replace(",", "")
  m = re.match(r"^(-?\d+)\s*(BCE|CE)?$", s, flags=re.IGNORECASE)
  if not m:
    raise ValueError(f"unparseable year: {raw!r}")
  n = int(m.group(1))
  return -n if (m.group(2) or "").upper() == "BCE" else n


def format_year(year):
  # Mirror formatYear() in static/utils.js: BCE years get comma grouping and a
  # "BCE" suffix; CE years are shown as the bare number, matching the on-canvas
  # card labels so the server-rendered text reads the same as the live app.
  if year < 0:
    return f"{-year:,} BCE"
  return str(year)


# Card geometry mirrors cardGeom in static/card.js (the single source of truth);
# keep these in sync if the card layout there changes. The SVG below is a Python
# port of the static renderCardSVG() in preview.html, so the no-JS page shows the
# same Magic-the-Gathering card the canvas draws (styled by static/card.css).
_CARD_W = 240
_CARD_MARGIN = 18
_CARD_MARGIN_IN = 16
_CARD_TITLE_BAR_H = 20
_CARD_IMG_W = 208
_CARD_IMG_H = _CARD_IMG_W * 2 / 3                            # 138.667 (locks 3:2)
_CARD_IMG_BOTTOM_Y = _CARD_TITLE_BAR_H + _CARD_IMG_H         # 158.667
_CARD_FULL_H = (_CARD_IMG_H + _CARD_TITLE_BAR_H * 2) + _CARD_IMG_H  # 317.333
_CARD_INVENTOR_Y = _CARD_IMG_BOTTOM_Y + 11                   # 169.667
_CARD_BODY_Y = _CARD_IMG_BOTTOM_Y + 16                       # 174.667
_CARD_FOOTER_H = 20
_CARD_FIELD_ICON_CX = _CARD_W - _CARD_MARGIN - 12 + 6        # 216


def _num(v):
  # Compact SVG coordinate (drop trailing zeros so 138.667 not 138.66666...).
  return f"{v:.3f}".rstrip("0").rstrip(".")


def _field_key(field):
  # Mirrors formatField() in static/utils.js (text before ':', lowercased) with
  # an 'unknown' fallback so the field-<key> class is never empty.
  return (field.split(":")[0] or "unknown").lower()


def render_card_svg(inv):
  W = _CARD_W
  H = _CARD_FULL_H
  body_h = H - _CARD_BODY_Y - _CARD_FOOTER_H
  f = _field_key(inv.field)

  def e(s):
    return html.escape(s or "", quote=True)

  image_href = f"/static/images/entries-v2/{inv.id}.jpg"
  field_icon_href = f"/static/images/fields/{f}.png"
  # One card per page, so a fixed clipPath id can't collide.
  clip_id = "card-fold-clip"
  return f'''<svg class="card field-{e(f)}" viewBox="0 0 {_num(W)} {_num(H)}" width="{_num(W)}" height="{_num(H)}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="{clip_id}" clipPathUnits="userSpaceOnUse">
      <rect x="0" y="{_num(_CARD_IMG_BOTTOM_Y)}" width="{_num(W)}" height="{_num(H - _CARD_IMG_BOTTOM_Y)}"/>
    </clipPath>
  </defs>
  <rect class="container" x="1" y="1" width="{_num(W - 2)}" height="{_num(H - 2)}" fill="white" stroke="black" stroke-width="2" rx="4"/>
  <g class="fold-clip" clip-path="url(#{clip_id})">
    <g class="fold-panel">
      <rect class="body-rect" x="{_num(_CARD_MARGIN_IN)}" y="{_num(_CARD_BODY_Y)}" width="{_num(_CARD_IMG_W)}" height="{_num(body_h)}" fill="transparent" stroke="black"/>
      <foreignObject class="body-text" x="{_num(_CARD_MARGIN_IN + 2)}" y="{_num(_CARD_BODY_Y + 2)}" width="{_num(_CARD_IMG_W - 4)}" height="{_num(body_h - 4)}" font-size="9">
        <div xmlns="http://www.w3.org/1999/xhtml" style="padding:1px;height:100%;font-family:Lora,serif;font-size:9px;line-height:1.35;color:#1a1a1a;hyphens:auto">{e(inv.summary)}</div>
      </foreignObject>
      <text class="middle-text" x="{_num(_CARD_MARGIN_IN)}" y="{_num(_CARD_INVENTOR_Y)}" font-size="10" fill="#111" font-family="Lora, serif">{e(inv.inventor)}</text>
      <text class="bottom-left" x="{_num(_CARD_MARGIN_IN)}" y="{_num(H - _CARD_FOOTER_H + 14)}" font-size="12" fill="#111" font-family="Lora, serif">{e(inv.location)}</text>
      <text class="bottom-right" x="{_num(W - _CARD_MARGIN_IN)}" y="{_num(H - _CARD_FOOTER_H + 14)}" font-size="12" text-anchor="end" fill="#111" font-family="Lora, serif">{e(format_year(inv.year))}</text>
    </g>
  </g>
  <g class="image-layer">
    <rect class="image-rect" x="{_num(_CARD_MARGIN_IN)}" y="{_num(_CARD_TITLE_BAR_H)}" width="{_num(_CARD_IMG_W)}" height="{_num(_CARD_IMG_H)}" fill="transparent" stroke="black"/>
    <image x="{_num(_CARD_MARGIN_IN)}" y="{_num(_CARD_TITLE_BAR_H)}" width="{_num(_CARD_IMG_W)}" height="{_num(_CARD_IMG_H)}" preserveAspectRatio="xMidYMid slice" href="{e(image_href)}"/>
    <text class="title" x="{_num(_CARD_MARGIN_IN)}" y="13" font-size="13" fill="#111" font-family="DM Serif Display, serif">{e(inv.title or inv.id)}</text>
    <circle class="field-icon-bg" cx="{_num(_CARD_FIELD_ICON_CX)}" cy="10" r="6" fill="white" stroke="black"/>
    <image class="field-icon" x="{_num(_CARD_FIELD_ICON_CX - 5)}" y="5" width="10" height="10" href="{e(field_icon_href)}"/>
  </g>
</svg>'''


def load_stories(json_path):
  with open(json_path, encoding="utf-8") as f:
    return json.load(f)


def load_inventions(tsv_path):
  out = []
  with open(tsv_path, newline="", encoding="utf-8") as f:
    for row in csv.DictReader(
        f,
        delimiter="\t",
        quoting=csv.QUOTE_NONE,
        escapechar="\\",
    ):
      iid = (row.get("ID") or "").strip()
      if not iid:
        continue
      try:
        year = _parse_year((row.get("Year") or "").strip())
      except ValueError as e:
        print(f"  skipping {iid}: {e}", file=sys.stderr)
        continue
      deps = tuple(
        d.strip()
        for d in (row.get("Dependencies") or "").split(",")
        if d.strip()
      )
      out.append(Invention(
        id=iid,
        year=year,
        title=(row.get("Title") or "").strip(),
        summary=(row.get("Description") or "").strip(),
        inventor=(row.get("Inventor") or "").strip(),
        location=(row.get("Location") or "").strip(),
        field=(row.get("Field") or "").strip(),
        detail=(row.get("URL") or "").strip(),
        dependencies=deps,
      ))
  return out


def copy_static(out_dir):
  # Mirror static/ into out_dir/static/. rsync with --exclude=originals/ keeps
  # the multi-GB image-gen originals (static/images/entries-v2/originals/) out
  # of the deploy artifact — the site only serves the 720x480 JPGs alongside.
  os.makedirs(os.path.join(out_dir, "static"), exist_ok=True)
  os.system(f"rsync -a --delete --exclude='originals/' ./static/ {out_dir}/static/")


def load_template(template_path):
  templateLoader = jinja2.FileSystemLoader(searchpath="./")
  # autoescape so card titles/descriptions with &, <, or quotes are safe in
  # both attributes (e.g. <meta content="...">) and the body content block.
  # The JSON-LD block opts out via the `| safe` filter.
  templateEnv = jinja2.Environment(loader=templateLoader, autoescape=True)
  template = templateEnv.get_template(template_path)
  return template

def generate_sitemap(inventions, stories):
  # Trailing slash on each <loc> matches the canonical_url emitted in the
  # template (and the URL GitHub Pages actually serves) so search engines
  # see one URL, not two.
  out = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>{root}/</loc>
    <lastmod>{lastmod}</lastmod>
  </url>
  <url>
    <loc>{root}/browse/</loc>
    <lastmod>{lastmod}</lastmod>
  </url>
'''.format(root=SITE_ROOT, lastmod=CONTENT_LASTMOD)
  for story in stories:
    slug = (story.get("slug") or "").strip()
    if not slug:
      continue
    out += f'''  <url>
    <loc>{SITE_ROOT}/story/{slug}/</loc>
    <lastmod>{CONTENT_LASTMOD}</lastmod>
  </url>
'''
  for invention in inventions:
    out += f'''  <url>
    <loc>{SITE_ROOT}/{invention.id}/</loc>
    <lastmod>{CONTENT_LASTMOD}</lastmod>
    <image:image>
      <image:loc>{SITE_ROOT}/static/images/entries-v2/{invention.id}.jpg</image:loc>
    </image:image>
  </url>
'''
  out += '</urlset>\n'
  return out



if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument(
    "--out_dir", "-o", help="The path to the output directory.", default="/tmp/asimov"
  )
  args = parser.parse_args()

  # Load inventions and stories
  inventions = load_inventions("static/asimov.tsv")
  stories = load_stories("static/stories.json")
  # inventions = [invention for invention in inventions if invention.id == "fire"]
  # print(inventions)

  # Lookups for the crawlable internal link graph: by_id resolves a dependency
  # id to its Invention (for the link text); reverse_deps maps an id to every
  # invention that lists it as a dependency ("what this led to").
  by_id = {inv.id: inv for inv in inventions}
  reverse_deps = {}
  for inv in inventions:
    for dep in inv.dependencies:
      reverse_deps.setdefault(dep, []).append(inv.id)

  def link_list(ids):
    # Resolve ids to {id, title} dicts, dropping any that aren't in the data so
    # the template only ever emits links to pages that actually exist.
    return [{"id": i, "title": by_id[i].title} for i in ids if i in by_id]

  # story_membership maps a card id to the stories that include it as a step,
  # so each card page can link to the stories it's "Part of".
  story_membership = {}
  for story in stories:
    slug = (story.get("slug") or "").strip()
    title = (story.get("title") or slug).strip()
    if not slug:
      continue
    seen = set()
    for step in story.get("steps", []):
      sid = (step.get("id") or "").strip()
      if sid in seen:
        continue
      seen.add(sid)
      story_membership.setdefault(sid, []).append({"slug": slug, "title": title})

  print(f"Deploying to {args.out_dir}...")

  os.makedirs(args.out_dir, exist_ok=True)

  # Copy static assets.
  print("Copying static assets...")
  copy_static(args.out_dir)

  template = load_template("index.jinja")

  # For each invention, create a directory for it in the output dir.
  # The og:image is the AI-generated card artwork (one shared file under
  # /static/images/entries-v2/<id>.jpg) — no per-invention card.jpg
  # screenshot is generated.
  for invention in inventions:
    print(f"Processing {invention.id} ({invention.year})...")
    invention_dir = os.path.join(args.out_dir, invention.id)
    os.makedirs(invention_dir, exist_ok=True)

    page_title = f"{invention.title} | {SITE_NAME}"
    canonical = f"{SITE_ROOT}/{invention.id}/"
    image_url = f"{SITE_ROOT}/static/images/entries-v2/{invention.id}.jpg"
    jsonld = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": invention.title,
      "description": invention.summary,
      "image": image_url,
      "url": canonical,
      "author": {"@type": "Person", "name": "Boris Smus"},
      "publisher": {"@type": "Organization", "name": SITE_NAME},
    }
    data = {
      "content_kind": "card",
      "title": page_title,
      "heading": invention.title,
      "site_name": SITE_NAME,
      "description": invention.summary,
      # Trailing slash matches the URL GitHub Pages actually serves
      # (/<id>/index.html → /<id>/), avoiding a canonical/sitemap mismatch.
      "canonical_url": canonical,
      "card_image_url": image_url,
      "og_type": "article",
      "jsonld": json.dumps(jsonld, ensure_ascii=False),
      # Server-rendered crawlable content (hidden once JS boots).
      "year_display": format_year(invention.year),
      "field": invention.field,
      "inventor": invention.inventor,
      "location": invention.location,
      # Fuller prose paragraph (from the misnamed TSV "URL" column), shown as
      # the page body beneath the card when present — see Invention.detail.
      "detail": invention.detail,
      "built_on": link_list(invention.dependencies),
      "led_to": link_list(reverse_deps.get(invention.id, [])),
      "part_of": story_membership.get(invention.id, []),
      "card_svg": render_card_svg(invention),
    }
    html_out = template.render(data)

    with open(f"{invention_dir}/index.html", "w") as f:
      f.write(html_out)

  # Root index. Use a curated invention's artwork as the social-card hero
  # so the og:image isn't broken when the site itself is shared.
  print("Creating root index.html...")
  root_canonical = f"{SITE_ROOT}/"
  root_image = f"{SITE_ROOT}/static/images/entries-v2/fire.jpg"
  root_jsonld = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE_NAME,
    "description": SITE_DESCRIPTION,
    "url": root_canonical,
  }
  data = {
    "content_kind": "root",
    "title": SITE_NAME,
    "heading": SITE_NAME,
    "site_name": SITE_NAME,
    "description": SITE_DESCRIPTION,
    "canonical_url": root_canonical,
    "card_image_url": root_image,
    "og_type": "website",
    "jsonld": json.dumps(root_jsonld, ensure_ascii=False),
    "stories": [
      {
        "slug": (s.get("slug") or "").strip(),
        "title": (s.get("title") or "").strip(),
        "blurb": (s.get("blurb") or "").strip(),
      }
      for s in stories
      if (s.get("slug") or "").strip()
    ],
  }
  html_out = template.render(data)

  # Create the index.html file.
  with open(f"{args.out_dir}/index.html", "w") as f:
    f.write(html_out)

  # GitHub Pages serves 404.html for unknown paths; reuse the app shell so
  # cold loads on /story/<slug>/ (and any future client-routed path) still boot.
  with open(os.path.join(args.out_dir, "404.html"), "w") as f:
    f.write(html_out)

  # Story deep links — GitHub Pages needs a physical index.html per path;
  # universe.js reads /story/<slug>/ from pathname on cold load.
  for story in stories:
    slug = (story.get("slug") or "").strip()
    if not slug:
      continue
    title = (story.get("title") or slug).strip()
    blurb = (story.get("blurb") or SITE_DESCRIPTION).strip()
    print(f"Processing story {slug}...")
    story_dir = os.path.join(args.out_dir, "story", slug)
    os.makedirs(story_dir, exist_ok=True)
    canonical = f"{SITE_ROOT}/story/{slug}/"
    # Resolve each step to its invention so the narrative (title + edge note +
    # crawlable link) is server-rendered into the HTML.
    steps = []
    for step in story.get("steps", []):
      sid = (step.get("id") or "").strip()
      if sid not in by_id:
        continue
      steps.append({
        "id": sid,
        "title": by_id[sid].title,
        "edge_note": (step.get("edge_note") or "").strip(),
      })
    # og:image: the first resolvable step's artwork, not the shared fire.jpg.
    story_image = (
      f"{SITE_ROOT}/static/images/entries-v2/{steps[0]['id']}.jpg"
      if steps else root_image
    )
    story_jsonld = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": title,
      "description": blurb,
      "url": canonical,
      "isPartOf": {"@type": "WebSite", "name": SITE_NAME, "url": f"{SITE_ROOT}/"},
    }
    story_data = {
      "content_kind": "story",
      "title": f"{title} | {SITE_NAME}",
      "heading": title,
      "site_name": SITE_NAME,
      "description": blurb,
      "canonical_url": canonical,
      "card_image_url": story_image,
      "og_type": "website",
      "jsonld": json.dumps(story_jsonld, ensure_ascii=False),
      "steps": steps,
    }
    with open(os.path.join(story_dir, "index.html"), "w") as f:
      f.write(template.render(story_data))

  # Crawlable browse index: every card as an <a href>, grouped by top-level
  # field and ordered chronologically. Guarantees that orphan cards (no
  # dependencies and nothing depending on them) are still reachable by crawl.
  print("Creating /browse/index.html...")
  groups = {}
  for inv in inventions:
    top_field = (inv.field.split(":", 1)[0].strip() or "Other")
    groups.setdefault(top_field, []).append(inv)
  browse_groups = [
    {
      "field": field,
      "cards": [
        {"id": inv.id, "title": inv.title, "year_display": format_year(inv.year)}
        for inv in sorted(items, key=lambda i: i.year)
      ],
    }
    for field, items in sorted(groups.items())
  ]
  browse_canonical = f"{SITE_ROOT}/browse/"
  browse_jsonld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": f"Browse all cards | {SITE_NAME}",
    "description": SITE_DESCRIPTION,
    "url": browse_canonical,
    "isPartOf": {"@type": "WebSite", "name": SITE_NAME, "url": f"{SITE_ROOT}/"},
  }
  browse_data = {
    "content_kind": "browse",
    "title": f"Browse all cards | {SITE_NAME}",
    "heading": "Browse all cards",
    "site_name": SITE_NAME,
    "description": SITE_DESCRIPTION,
    "canonical_url": browse_canonical,
    "card_image_url": root_image,
    "og_type": "website",
    "jsonld": json.dumps(browse_jsonld, ensure_ascii=False),
    "browse_groups": browse_groups,
  }
  browse_dir = os.path.join(args.out_dir, "browse")
  os.makedirs(browse_dir, exist_ok=True)
  with open(os.path.join(browse_dir, "index.html"), "w") as f:
    f.write(template.render(browse_data))

  # Create a sitemap.
  with open(f"{args.out_dir}/sitemap.xml", "w") as f:
    f.write(generate_sitemap(inventions, stories))

  # Create a robots.txt
  with open(f"{args.out_dir}/robots.txt", "w") as f:
    f.write(f"Sitemap: {SITE_ROOT}/sitemap.xml\n")
