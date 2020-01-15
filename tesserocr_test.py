from PIL import Image
from tesserocr import PyTessBaseAPI, RIL

images = ['images-final/page0004.jpg']

with PyTessBaseAPI() as api:
  for img in images:
    api.SetImageFile(img)
    print(api.GetUTF8Text())
    print(api.AllWordConfidences())
    boxes = api.GetComponentImages(RIL.TEXTLINE, True)
    print('Found {} textline image components.'.format(len(boxes)))

    buf = ''
    for i, (im, box, _, _) in enumerate(boxes):
      # im is a PIL image object
      # box is a dict with x, y, w and h keys
      api.SetRectangle(box['x'], box['y'], box['w'], box['h'])
      ocrResult = api.GetUTF8Text()
      conf = api.MeanTextConf()
      if box['h'] > 32:
        print('Height: ', box['h'])
        print(ocrResult, conf)
      else:
        buf += ocrResult
# api is automatically finalized when used in a with-statement (context manager).
# otherwise api.End() should be explicitly called when it's no longer needed.

