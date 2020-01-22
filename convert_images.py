#!/usr/bin/env python3
import os
from PIL import Image

in_dir = os.path.expanduser('~/Dropbox/Asimov Illustrations')
out_dir = 'web/images'
width = 240
height = 135

def convert_images():
  images = os.listdir(in_dir)
  images.sort()

  for image in images:
    if image.startswith('.'):
      continue
    index, name_ext = image.split(' ')
    name, ext = os.path.splitext(name_ext)
    source = os.path.join(in_dir, image)
    target = os.path.join(out_dir, '%s.jpg' % name)

    os.system(f'convert \"{source}\" -resize "{width}x{height}^" -gravity center -crop {width}x{height}+0+0 +repage "{target}"')

if __name__ == '__main__':
  convert_images()
