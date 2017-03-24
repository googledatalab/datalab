# Copyright 2015 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Tests notebooks listed in test.yaml in the same directory by starting
# a Firefox instance for each notebook and running it.
# A test.js script is injected into each notebook, which runs all cells
# and checks for errors, then adds an HTML element with the test result

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities

import argparse
import os
import re
import sys
import time
import yaml

RED='\033[91m'
GREEN='\033[92m'
YELLOW='\033[93m'
BLUE='\033[94m'
END='\033[0m'


def run_notebook_test(test, notebook, url_base, results, testscript):
  print 'Running notebook ' + notebook
  # load the notebook
  br = webdriver.Firefox()
  retries = 30
  while retries:
    uri = url_base + '/notebooks/%s' % (notebook.replace(' ', '%20'))
    try:
      br.get(uri)
      break
    except:
      time.sleep(1)
      retries -= 1
      if not retries:
        print 'Timed out waiting on notebook: ' + notebook
        sys.exit(1)

  # make sure notebook is ready
  br.find_element_by_id('notebook_panel')

  retries = 5
  while retries:
    try:
      kernel_busy = br.execute_script('return Jupyter.notebook.kernel_busy')
      if not kernel_busy:
        break
    except:
      print('Waiting on kernel..')
      time.sleep(1)
      retries -= 1
      if not retries:
        print 'Notebook not connected to a kernel, or kernel busy for too long. Aborting'
        sys.exit(1)

  if testscript:
    br.execute_script(testscript)
  result = []
  failed = False
  try:
    element = WebDriverWait(br, 240).until(
        EC.presence_of_element_located((By.ID, "test_status"))
    )
    parts = []
    ignore = test['ignore'] if 'ignore' in test else []
    for part in element.text.split('#'):
      if part == 'FAIL' or part == 'PASS':
        continue
      if len(ignore):
        m = re.match(r'^([0-9]+)[/:].*', part)
        if m and int(m.group(1)) in ignore:
          continue
        m = re.match(r'^Cell ([0-9]+) .*', part)
        if m and int(m.group(1)) in ignore:
          continue
      parts.append(part)

    errors = '#'.join(sorted(parts))

    if not errors:
      result.append('%s%s: pass%s' % (GREEN, notebook, END))
      br.quit()
    else:
      result.append('%s%s: fail%s' % (RED, notebook, END))
      result.append('%s  Errors: %s%s' % (YELLOW,  errors, END))
      failed = True
  except Exception as e:
    result.append(e.message)
    result.append('%s: timed out' % notebook)
    failed = True
    br.quit()
  results[notebook] = (result, failed)


def run_tests(url_base, tests=[], testscript=None):
  results = {}
  failed = False

  print 'Tests started..'

  # Create each browser sequentially as doing it in parallel can cause the 
  # tests to be flaky
  for test in tests:
    if 'disabled' in test and test['disabled']:
      continue

    notebook = test['notebook']
    run_notebook_test(test, notebook, url_base, results, testscript)

  for result in results.values():
    print '\n'.join(result[0])
    failed = failed or result[1]

  if failed:
    sys.exit(1)

if __name__ == '__main__':
  parser = argparse.ArgumentParser('tests')
  parser.add_argument('--base', default='http://localhost:8080', help='Base URL for Datalab instance')
  parser.add_argument('--tests', default='test.yaml', help='YAML file containing test specifications')

  args = parser.parse_args()
  with open(args.tests) as f:
    tests = yaml.load(f)
    with open('test.js') as tf:
      testscript = '{' + tf.read() + '}'

      run_tests(args.base, tests, testscript)

