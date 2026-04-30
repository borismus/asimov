#!/usr/bin/env python3
import argparse
import csv
import dataclasses
import json
import os
import re
import sys
import jinja2

SITE_NAME = "Invention & Discovery Cards"
SITE_DESCRIPTION = """A Civilization-inspired tech tree but for the real life history of science and discovery. Inventions and discoveries presented in illustrated Magic-style cards."""
SITE_ROOT = 'https://invention.cards'


@dataclasses.dataclass(frozen=True)
class Invention:
  id: str
  year: int
  title: str
  summary: str


def _parse_year(raw):
  s = raw.strip().replace(",", "")
  m = re.match(r"^(-?\d+)\s*(BCE|CE)?$", s, flags=re.IGNORECASE)
  if not m:
    raise ValueError(f"unparseable year: {raw!r}")
  n = int(m.group(1))
  return -n if (m.group(2) or "").upper() == "BCE" else n


def load_inventions(tsv_path):
  out = []
  with open(tsv_path, newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f, delimiter="\t"):
      iid = (row.get("ID") or "").strip()
      if not iid:
        continue
      try:
        year = _parse_year((row.get("Year") or "").strip())
      except ValueError as e:
        print(f"  skipping {iid}: {e}", file=sys.stderr)
        continue
      out.append(Invention(
        id=iid,
        year=year,
        title=(row.get("Title") or "").strip(),
        summary=(row.get("Description") or "").strip(),
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
  templateEnv = jinja2.Environment(loader=templateLoader)
  template = templateEnv.get_template(template_path)
  return template

def generate_sitemap(inventions):
  # Trailing slash on each <loc> matches the canonical_url emitted in the
  # template (and the URL GitHub Pages actually serves) so search engines
  # see one URL, not two.
  out = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>{root}/</loc>
  </url>
'''.format(root=SITE_ROOT)
  for invention in inventions:
    out += f'''  <url>
    <loc>{SITE_ROOT}/{invention.id}/</loc>
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

  # Load inventions
  inventions = load_inventions("static/asimov.tsv")
  # inventions = [invention for invention in inventions if invention.id == "fire"]
  # print(inventions)

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
    }
    html = template.render(data)

    with open(f"{invention_dir}/index.html", "w") as f:
      f.write(html)

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
    "title": SITE_NAME,
    "heading": SITE_NAME,
    "site_name": SITE_NAME,
    "description": SITE_DESCRIPTION,
    "canonical_url": root_canonical,
    "card_image_url": root_image,
    "og_type": "website",
    "jsonld": json.dumps(root_jsonld, ensure_ascii=False),
  }
  html = template.render(data)

  # Create the index.html file.
  with open(f"{args.out_dir}/index.html", "w") as f:
    f.write(html)

  # Create a sitemap.
  with open(f"{args.out_dir}/sitemap.xml", "w") as f:
    f.write(generate_sitemap(inventions))

  # Create a robots.txt
  with open(f"{args.out_dir}/robots.txt", "w") as f:
    f.write(f"Sitemap: {SITE_ROOT}/sitemap.xml\n")
