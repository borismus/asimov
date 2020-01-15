#!/usr/bin/env python3
import csv
from dataclasses import dataclass, field
import os
import random
import re
from string import Template

TEXT_ROOT = 'text-final'

@dataclass
class AsimovEstimate:
  location_estimates: list = field(default_factory=list)
  inventor_estimates: list = field(default_factory=list)
  dependencies_estimates: list = field(default_factory=list)


@dataclass
class AsimovItem:
  title: str
  description: str
  year: int
  estimate: AsimovEstimate



def cleanup(root, page_range):
  all_lines = []
  # Load all lines from all OCR'ed page files.
  for page_number in range(page_range[0], page_range[1] + 1):
    out_path = '%s/page%04d' % (TEXT_ROOT, page_number)
    with open('%s.txt' % out_path) as f:
      lines = f.readlines()
      text = ''.join(lines).strip()
      if not text:
        print('Warning: file %s is empty.' % out_path)
      all_lines += lines

  print('Loaded %d lines.' % len(all_lines))

  paragraphs = paragraphize(all_lines)

  year = None
  title = None
  description = ''
  items = []
  for p in paragraphs:
    new_year = parse_year(p)
    new_title = parse_title(p)
    if new_year:
      print('parse_year', new_year)
      year = new_year
    elif new_title:
      print('parse_title', new_title)
      # Save the description and data we have so far.
      if title and description and year:
        estimate = AsimovEstimate()
        item = AsimovItem(title, description, year, estimate)
        items.append(item)
      else:
        print('Missing field. year=%d, title=%s, description=%s' \
            % (year, title, description))
      description = ''
      title = new_title
    else:
      description += p + '\n\n'

  return items


def paragraphize(lines):
  '''Convert lines into paragraphs.'''
  paragraphs = []
  p = ''
  for line in lines:
    stripped = line.strip()
    # If there is just a single line-break between two lines, contract it into a
    # single line.
    if line is '\n' and p.strip():
      #print('New ¶: %s' % p)
      paragraphs.append(p.strip())
      p = ''

    if p.endswith('-'):
      # If a line ends with a hyphen, remove it.
      p = p[:-1]
      p += stripped
    else:
      # Otherwise, it's just a regular new line.
      p += ' ' + stripped

  return paragraphs


def parse_year(year_string):
  # A valid year might be 4,000,000 B.C., or it might be 305.
  m = re.match('^([0-9,]+)([BC. ]+)?$', year_string)
  if m:
    year = int(m.group(1).replace(',', ''))
    if m.group(2):
      year = -year
    return year
  return None


def parse_title(title_string):
  ignore_words = ['and', 'of', 'in', 'the']
  # A valid title has few words and most words are capitalized.
  words = title_string.split(' ')
  for ignore in ignore_words:
    if ignore in words:
      words.remove(ignore)
  capitalized_words = re.findall('([A-Z][a-z]+)', title_string)
  word_count = len(words)
  cap_count = len(capitalized_words)
  if word_count <= 4 and cap_count is word_count:
    return title_string


def infer_location(description):
  return get_continuous_chunks(description, 'GPE')

def infer_inventor(description):
  return get_continuous_chunks(description, 'PERSON')


from nltk import word_tokenize, pos_tag, ne_chunk
from nltk import Tree
def get_continuous_chunks(text, label):
  chunked = ne_chunk(pos_tag(word_tokenize(text)))
  prev = None
  continuous_chunk = []
  current_chunk = []

  for subtree in chunked:
    if type(subtree) == Tree and subtree.label() == label:
      current_chunk.append(" ".join([token for token, pos in subtree.leaves()]))
    elif current_chunk:
      named_entity = " ".join(current_chunk)
      if named_entity not in continuous_chunk:
        continuous_chunk.append(named_entity)
        current_chunk = []
    else:
      continue

  return continuous_chunk

def print_item(item):
  location_estimates = infer_location(item.description)
  inventor_estimates = infer_inventor(item.description)
  print('---')
  print('%s (%d)' %(item.title, item.year))
  print('---')
  print(item.description)
  print('Location', location_estimates)
  print('Inventor', inventor_estimates)


def estimate(item):
  item.estimate.location_estimates = infer_location(item.description)
  item.estimate.inventor_estimates = infer_inventor(item.description)

item_template = Template('''
---
title: "$title"
year: $year
location_estimates: $location_estimates
inventor_estimates: $inventor_estimates
---

$description
''')
def create_static_website(items, site_root):
  if os.path.exists(site_root):
    # Remove all markdown files from this directory.
    filelist = [f for f in os.listdir(site_root) if f.endswith('.md')]
    print('Removing %d markdown files from %s.' % (len(filelist), site_root))
    for f in filelist:
      os.remove(os.path.join(site_root, f))
  else:
    print('Creating %s' % site_root)
    os.makedirs(site_root)

  for item in items:
    markdown_path = os.path.join(site_root, '%s.md' % item.title)
    print('Writing %s.' % markdown_path)
    with open(markdown_path, 'w') as f:
      body = item_template.substitute(title=item.title, description=item.description,
          year=item.year, location_estimates=item.estimate.location_estimates,
          inventor_estimates=item.estimate.inventor_estimates)
      f.write(body)


def create_csv(items, output_path):
  with open(output_path, 'w', newline='') as csvfile:
    fieldnames = ['year', 'title', 'inventor_estimates', 'location_estimates', 'description']
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()

    for item in items:
      row = {
          'year': item.year,
          'title': item.title,
          'description': item.description,
          'inventor_estimates': item.estimate.inventor_estimates,
          'location_estimates': item.estimate.location_estimates,
      }
      print('Adding row for %s.' % item.title)
      writer.writerow(row)

def create_index(items, output_path):
  titles = map(lambda item: '%d, %s' % (item.year, item.title), items)
  with open(output_path, 'w') as f:
    f.write('\n'.join(titles))

if __name__ == '__main__':
  items = cleanup(TEXT_ROOT, [2, 755])
  print('Found %d AsimovItems.' % len(items))
  titles = map(lambda item: item.title, items)
  #print('All inventions', ', '.join(titles))
  #print_item(random.choice(items))
  # Estimate inventor and location for each item.
  #for item in items:
  #  print('Estimating %s.' % item.title)
  #  estimate(item)
  #create_static_website(items, 'lettersmith/asimov')
  #create_csv(items, 'all_descriptions.csv')
  create_index(items, 'all_index.txt')
