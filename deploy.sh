#!/usr/bin/env sh
DEPLOY_DIR=~/Projects/invention.cards/
python3 scripts/generate-site.py -o $DEPLOY_DIR -n
cd $DEPLOY_DIR
git commit . -m 'deploying to gh-pages via script'
git push
