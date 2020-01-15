Goal: convert Asimov's Chronology into an interconnected wiki or spreadsheet
about technology.

Each technology should have the following fields automatically captured:

- Date
- Name of tech
- Excerpt from book

The infer the following:

- Country of origin (guesses)
- Name of inventor (guesses)

Then manually provide the following for each invention.

- Dependencies
- Category (Invention|Geography|Space)
- Icon


# Strategy

## Automatic extraction (mostly)

- Download PDF version from archive.org
- View in a protected reader
- Scan everything via ScreenFlick 
- Convert into unique frames via ffmpeg.

    ffmpeg -i ../Asimov\ Complete.mp4  -vf mpdecimate,setpts=N/FRAME_RATE/TB thumb%04d.jpg

- (Check: page number should correspond to file name.)
- Remove "In Addition" sections and image captions manually (with Preview)
- Run tesseract to extract text.

    tesseract image.jpg out.txt
    (see ocr.py)

- Concatenate all resulting text together
- Split text into sections
- Clean up each section so that the text is easily readable.
- Get relevant metadata for each section: Year, Title, Description
- Use basic NLP to extract "Location Candidates" and "Inventor Candidates" lists.
- Output everything as a nicely cleaned up CSV.

## Manual cleanup

- Load CSV into a spreadsheet
- Manually set Country and Inventor fields based on the Candidate lists.
- Manually set more subjective fields like Category and Dependencies.



# Annoying things I ran into

- Initially I held down the Right Arrow key and captured a video, but this ended
  up skipping some pages. As a workaround, I had to manually flip through and
  ensure that no pages were missing. It's easy to verify though -- visual page
  number matches the number in the file name.

- I did a wholesale run, clipping irrelevant pieces (eg. figures, "In Addition"
  sections) using Preview. It appeared to fail to save most of my changes, but
  actually worked out. Finder is behaving weirdly.

- Turns out Tesseract chokes on images that have a big transparent gap in them.
  I had to go through the problematic images and eliminate the big gaps.

- Page numbers and dates are pretty hard to disambiguate. A solution was to crop
  all of the headers from all of the pages.

- A lot of the time, Tesseract has this failure mode which is tragic:
  multicolumn text that gets rows and column order mixed up is a major failure
  mode. For example:

      C1 C2 C3
      C4 C5 C6

  is often confused for:

      C1 C3 C5
      C2 C4 C6

