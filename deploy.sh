#!/usr/bin/env sh
set -e
DEPLOY_DIR=~/Projects/invention.cards/
# The repo's static/asimov.tsv and static/stories.json are the source of truth; the Google
# Sheet is retired and no longer fetched (see README: Editing the data).
uv run scripts/generate-site.py -o $DEPLOY_DIR
cd $DEPLOY_DIR
git add -A
git commit . -m 'deploying to gh-pages via script'
git push
