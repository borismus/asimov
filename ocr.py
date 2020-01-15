#!/usr/bin/env python3
import os

IMAGE_ROOT = 'images-final'
TEXT_ROOT = 'text-final'

if not os.path.exists(TEXT_ROOT):
  os.makedirs(TEXT_ROOT)

# Run tesseract on each page.
def ocr(page_number):
  # Try to get the .png, otherwise fallback to .jpg.
  image_path = '%s/page%04d.png' % (IMAGE_ROOT, page_number)
  if not os.path.exists(image_path):
    image_path = '%s/page%04d.jpg' % (IMAGE_ROOT, page_number)
  if not os.path.exists(image_path):
    raise Exception('No png or jpg found near path %s.' % image_path)

  out_path = '%s/page%04d' % (TEXT_ROOT, page_number)
  # This will write output into out.txt.
  os.system('tesseract "%s" "%s" &> /dev/null' % (image_path, out_path))
  print('Wrote %s' % out_path)

if __name__ == '__main__':
  for page_number in range(755):
    ocr(page_number + 1)
