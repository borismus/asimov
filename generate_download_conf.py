#!/usr/bin/env python3

'''Generates a googleimagesdownload conf file based on an input .csv file.'''

import json
import csv
import sys

def generate_conf(csv_path):
  ids = []
  with open(csv_path, newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
      ids.append(row['ID'])

  return {
    'Records': list(map(id_to_record, ids))
  }

def id_to_record(id):
  return {
    'keywords': ' '.join(id.split('-')),
    'limit': 5,
    'print_urls': True,
    'size': 'large',
    'usage_rights': 'labeled-for-reuse',
    'aspect_ratio': 'wide',
  }

if __name__ == '__main__':
  if len(sys.argv) != 2:
    print(f'usage: {sys.argv[0]} /path/to.csv')
    sys.exit(1)
  conf = generate_conf(sys.argv[1])
  print(json.dumps(conf, indent=2))
