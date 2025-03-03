#!/usr/bin/env python3
import os
import argparse
import sys
import jinja2

sys.path.append("..")
from asimov_gpt.src.utils import load_inventions

SITE_NAME = "Invention & Discovery Cards"
SITE_DESCRIPTION = """A Civilization-inspired tech tree but for the real life history of science and discovery. Inventions and discoveries presented in illustrated Magic-style cards."""
SITE_ROOT = 'https://invention.cards'


def copy_static(out_dir):
  # Copy the static directory to the output directory.
  os.system(f"cp -r ./static {out_dir}")


def load_template(template_path):
  templateLoader = jinja2.FileSystemLoader(searchpath="./")
  templateEnv = jinja2.Environment(loader=templateLoader)
  template = templateEnv.get_template(template_path)
  return template

def generate_sitemap(inventions):
  header = '''<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
      xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  '''
  out = header
  for invention in inventions:
    invention_xml = f'''
    <url>
      <loc>{SITE_ROOT}/{invention.id}</loc>
      <image:image>
        <image:loc>{SITE_ROOT}/{invention.id}/card.jpg</image:loc>
      </image:image>
    </url>
    '''
    out += invention_xml
  footer = '</urlset>'
  out += footer
  return out



if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument(
    "--out_dir", "-o", help="The path to the output directory.", default="/tmp/asimov"
  )
  parser.add_argument(
    "--force_screenshots",
    "-f",
    help="Force the generation of screenshots.",
    action="store_true",
  )
  parser.add_argument(
    "--no-screenshots",
    "-n",
    help="Skip generating screenshots.",
    action="store_true",
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
  for invention in inventions:
    print(f"Processing {invention.id} ({invention.year})...")
    invention_dir = os.path.join(args.out_dir, invention.id)
    os.makedirs(invention_dir, exist_ok=True)
    card_image_path = f"{invention_dir}/card.jpg"

    # Generate an image for the invention using the screenshot command line tool.
    if (not os.path.exists(card_image_path) or args.force_screenshots) and not args.no_screenshots:
      print("Generating card screenshot...")
      os.system(f"screenshot/card-screenshot.mjs {invention.id} {card_image_path}")

    # Generate the index.html file from the index.jinja template, using the invention data.
    data = {
      "title": f"{invention.title} | {SITE_NAME}",
      "site_name": SITE_NAME,
      "description": invention.summary,
      "canonical_url": f"{SITE_ROOT}/{invention.id}",
      "card_image": "card.jpg",
      "initial_javascript": f"""changeFocusId("{invention.id}")""",
    }
    html = template.render(data)

    # Create the index.html file.
    with open(f"{invention_dir}/index.html", "w") as f:
      f.write(html)

  # Create the index for the overall site too, which will load a random invention.
  print("Creating root index.html...")
  data = {
    "title": SITE_NAME,
    "site_name": SITE_NAME,
    "description": SITE_DESCRIPTION,
    "canonical_url": SITE_ROOT,
    "initial_javascript": "changeFocusId(randomCardWithDeps().id);",
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
    f.write('Sitemap: http://invention.cards/sitemap.xml')
