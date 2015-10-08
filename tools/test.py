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

# PhantomJS won't install with brew on El Capitan yet.
# Make sure vcrpy package is installed to use mocked HTTP request/responses,
# and invoke with a 'vcr' argument. If .ipynb.yaml files exist they will be
# used; if not they will be created.

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.webdriver import FirefoxProfile

import argparse
import re
import sys
from threading import Thread
import time
import yaml

RED='\033[91m'
GREEN='\033[92m'
YELLOW='\033[93m'
BLUE='\033[94m'
END='\033[0m'


def run_notebook_test(test, notebook, br, results):
  br.execute_script("""
var s=window.document.createElement('script');
s.src='/static/extensions/test.js';
window.document.head.appendChild(s);
""");
  result = []
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

    actuals = '#'.join(sorted(parts))
    expect = []
    if 'expect' in test and len(test['expect']):
      expect.extend(test['expect'])
    expectations = '#'.join(sorted(expect))

    if actuals == expectations:
      result.append('%s%s: pass%s' % (GREEN, notebook, END))
      br.quit()
    else:
      result.append('%s%s: fail%s' % (RED, notebook, END))
      result.append('%sExpected: %s%s' % (BLUE, expectations, END))
      result.append('%s  Actual: %s%s' % (YELLOW,  actuals, END))
      # We leave this one open
  except Exception as e:
    result.append(e.message)
    result.append('%s: timed out' % notebook)
    br.quit()
  results[notebook] = result


def run_tests(url_base='http://localhost:8081', tests=[], vcr=False, profile=None):
  threads = []
  results = {}

  for test in tests:
    if 'disabled' in test and test['disabled']:
      continue

    # We create each browser sequentially as doing it in parallel can cause the 
    # tests to be flaky
    notebook = test['notebook']

    # Load the notebook
    ffprofile = None
    if profile:
      ffprofile = FirefoxProfile(profile)
    br = webdriver.Firefox(ffprofile)
    uri = url_base + '/notebooks/%s' % (notebook.replace(' ', '%20'))
    if vcr:
      uri += '?vcr=1'
    br.get(uri)

    # Kludge; we need a better way to know notebook is ready
    br.find_element_by_tag_name('html')

    t = Thread(target=run_notebook_test, args=[test, notebook, br, results])
    threads.append(t)
    t.start()

  for t in threads:
    t.join()

  for result in results.values():
    print '\n'.join(result)

if __name__ == '__main__':
  parser = argparse.ArgumentParser('tests')
  parser.add_argument('--base', default='http://localhost:8081', help='Base URL for Datalab instance')
  parser.add_argument('--tests', default='test.yaml', help='YAML file containing test specifications')

  # If testing a deployment we need an authorized account so don't want to use an anonymous profile.
  # The profile must be specified here. On a Mac if you have a single profile, this should work:
  #
  #     --profile="`echo ~/Library/Application\ Support/Firefox/Profiles/*`"
  #
  parser.add_argument('--profile', help='profile to use; needed for non-local testing for authentication')

  parser.add_argument('--vcr', action='store_true',
      help='If set, record/replay network requests/responses. Requires a test container.')

  args = parser.parse_args()
  with open(args.tests) as f:
    tests = yaml.load(f)
    run_tests(args.base, tests, args.vcr, args.profile)

