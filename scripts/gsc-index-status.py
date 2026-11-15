#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "google-api-python-client>=2.0",
#   "google-auth>=2.0",
#   "google-auth-oauthlib>=1.0",
# ]
# ///
"""Pull Google Search Console index status for every URL in the sitemap, and
optionally resubmit the sitemap.

There is no API that force-indexes arbitrary pages (the Indexing API is limited
to JobPosting/BroadcastEvent). What this *can* do, through sanctioned APIs:

  1. Resubmit the sitemap (Sitemaps API) — the legitimate bulk-recrawl nudge.
  2. Inspect every sitemap URL (URL Inspection API, read-only) — so you get the
     whole site's indexed / crawled-not-indexed breakdown in one CSV and can
     re-run weekly to watch the trend, instead of clicking URLs by hand.

Quotas (per property): URL Inspection 2000/day & 600/min; we throttle under that.

Auth is OAuth as yourself (you already own the property — no "add user" step):
  - Google Cloud → APIs & Services → Credentials → Create Credentials →
    OAuth client ID → **Desktop app** → download as client_secret.json.
  - If asked, configure the consent screen as **External** and add your own
    Google account as a **Test user** (no verification/publishing needed).
  - First run opens a browser for a one-time "Allow"; the token is then cached
    in token.json and every later run is non-interactive.
  - Also enable the "Google Search Console API" in the same project.

Usage:
  uv run scripts/gsc-index-status.py \
    --site "sc-domain:invention.cards" \
    --submit-sitemap

  # Domain property  -> --site "sc-domain:invention.cards"
  # URL-prefix prop  -> --site "https://invention.cards/"
"""
import argparse
import csv
import os
import re
import sys
import time
import urllib.request

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# webmasters scope covers both Sitemaps (write) and URL Inspection (read).
SCOPES = ["https://www.googleapis.com/auth/webmasters"]

CSV_FIELDS = [
    "url",
    "verdict",
    "coverageState",
    "indexingState",
    "robotsTxtState",
    "pageFetchState",
    "googleCanonical",
    "userCanonical",
    "lastCrawlTime",
    "error",
]


def get_credentials(client_secret_path, token_path):
    """OAuth installed-app flow: reuse the cached token, refresh it when stale,
    or run a one-time browser consent and cache the result."""
    creds = None
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(client_secret_path):
                sys.exit(f"OAuth client secret not found: {client_secret_path}\n"
                         "Create one in Google Cloud → Credentials → OAuth client ID → Desktop app.")
            flow = InstalledAppFlow.from_client_secrets_file(client_secret_path, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, "w", encoding="utf-8") as f:
            f.write(creds.to_json())
    return creds


def fetch_sitemap_urls(sitemap_url):
    """Return every <loc> in the sitemap, following a <sitemapindex> one level."""
    def _get(url):
        req = urllib.request.Request(url, headers={"User-Agent": "gsc-index-status"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode("utf-8", "replace")

    text = _get(sitemap_url)
    locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", text)
    if "<sitemapindex" in text:
        urls = []
        for child in locs:
            try:
                child_text = _get(child)
            except Exception as e:
                print(f"  ! could not fetch child sitemap {child}: {e}", file=sys.stderr)
                continue
            urls += re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", child_text)
        return urls
    return locs


def inspect(service, site_url, url, max_retries=5):
    """Call urlInspection.index.inspect with backoff on 429/5xx."""
    body = {"inspectionUrl": url, "siteUrl": site_url}
    delay = 2.0
    for attempt in range(max_retries):
        try:
            resp = service.urlInspection().index().inspect(body=body).execute()
            return resp.get("inspectionResult", {}).get("indexStatusResult", {}), None
        except HttpError as e:
            status = getattr(e.resp, "status", None)
            if status in (429, 500, 503) and attempt < max_retries - 1:
                time.sleep(delay)
                delay *= 2
                continue
            return {}, f"HTTP {status}: {e}"
        except Exception as e:  # noqa: BLE001 - record and move on
            return {}, str(e)
    return {}, "exhausted retries"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--client-secret", default="client_secret.json",
                    help="OAuth Desktop-app client secret JSON from Google Cloud.")
    ap.add_argument("--token", default="token.json",
                    help="Where to cache the OAuth token after the first consent.")
    ap.add_argument("--site", required=True,
                    help='Property: "sc-domain:invention.cards" or "https://invention.cards/".')
    ap.add_argument("--sitemap", default="https://invention.cards/sitemap.xml",
                    help="Sitemap URL to read URLs from (and optionally resubmit).")
    ap.add_argument("--out", default="gsc-status.csv", help="Output CSV path.")
    ap.add_argument("--submit-sitemap", action="store_true",
                    help="Resubmit the sitemap before inspecting.")
    ap.add_argument("--limit", type=int, default=0, help="Inspect only the first N URLs (0 = all).")
    ap.add_argument("--delay", type=float, default=0.2,
                    help="Seconds between inspect calls (0.2 -> ~300/min, under the 600/min cap).")
    ap.add_argument("--skip-inspect", action="store_true",
                    help="Only (re)submit the sitemap; don't inspect URLs.")
    args = ap.parse_args()

    creds = get_credentials(args.client_secret, args.token)
    service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)

    if args.submit_sitemap:
        print(f"Resubmitting sitemap {args.sitemap} for {args.site} ...")
        try:
            service.sitemaps().submit(siteUrl=args.site, feedpath=args.sitemap).execute()
            print("  ✓ sitemap submitted")
        except HttpError as e:
            print(f"  ! sitemap submit failed: {e}", file=sys.stderr)

    if args.skip_inspect:
        return

    print(f"Reading URLs from {args.sitemap} ...")
    urls = fetch_sitemap_urls(args.sitemap)
    if args.limit:
        urls = urls[: args.limit]
    print(f"  {len(urls)} URLs to inspect (delay {args.delay}s ~ {int(60 / max(args.delay, 0.001))}/min)\n")

    counts = {}
    errors = 0
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        for i, url in enumerate(urls, 1):
            r, err = inspect(service, args.site, url)
            state = r.get("coverageState", "") or ("ERROR" if err else "")
            counts[state] = counts.get(state, 0) + 1
            if err:
                errors += 1
            w.writerow({
                "url": url,
                "verdict": r.get("verdict", ""),
                "coverageState": r.get("coverageState", ""),
                "indexingState": r.get("indexingState", ""),
                "robotsTxtState": r.get("robotsTxtState", ""),
                "pageFetchState": r.get("pageFetchState", ""),
                "googleCanonical": r.get("googleCanonical", ""),
                "userCanonical": r.get("userCanonical", ""),
                "lastCrawlTime": r.get("lastCrawlTime", ""),
                "error": err or "",
            })
            if i % 25 == 0 or i == len(urls):
                f.flush()
                print(f"  [{i}/{len(urls)}] last: {state or '—'}")
            time.sleep(args.delay)

    print(f"\nWrote {args.out}. Coverage breakdown:")
    for state, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {n:5d}  {state or '(empty)'}")
    if errors:
        print(f"  ({errors} URLs errored — see the 'error' column)")


if __name__ == "__main__":
    main()
