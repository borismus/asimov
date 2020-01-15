#!/usr/bin/env python3
import os

IN_ROOT = 'images manual'
OUT_ROOT = 'images manual cropped'

if not os.path.exists(OUT_ROOT):
  os.makedirs(OUT_ROOT)

def crop(page_number):
  # Try to get the .png, otherwise fallback to .jpg.
  in_path = '%s/thumb%04d.png' % (IN_ROOT, page_number)
  if not os.path.exists(in_path):
    in_path = '%s/thumb%04d.jpg' % (IN_ROOT, page_number)
  if not os.path.exists(in_path):
    raise Exception('No png or jpg found near path %s.' % in_path)

  out_path = '%s/page%04d.jpg' % (OUT_ROOT, page_number)
  os.system('convert "%s" -gravity North -chop 0x140 "%s"' % (in_path, out_path))

if __name__ == '__main__':
  for page_number in range(755):
    crop(page_number + 1)
