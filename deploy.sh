#!/usr/bin/env sh
set -e
DEPLOY_DIR=~/Projects/invention.cards/
uv run scripts/fetch-tsv.py
uv run scripts/generate-site.py -o $DEPLOY_DIR
cd $DEPLOY_DIR
git add -A
git commit . -m 'deploying to gh-pages via script'
git push
