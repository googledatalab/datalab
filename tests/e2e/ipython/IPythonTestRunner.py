# Copyright 2014 Google Inc. All rights reserved.
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

"""Configurable runner for ipython unit tests."""

import argparse
import unittest

# Global argparse based flags.
FLAGS = argparse.ArgumentParser(
    description='Selenium E2E tests for ipython notebooks.')
FLAGS.add_argument('--remote-webdriver',
                   dest='remote_webdriver',
                   type=str,
                   help='Use a standalone remote webdriver '
                        '(e.g., http://127.0.0.1:4444/wd/hub)')
FLAGS.add_argument(
    '--chrome-webdriver',
    dest='chrome_webdriver',
    type=str,
    default='/usr/local/lib/node_modules/protractor/selenium/chromedriver',
    help='Location of selenium''s chromedriver.')
FLAGS.add_argument('--verbosity',
                   type=int,
                   default=1)

# Forwards global FLAGS add_argument.
# pylint: disable=invalid-name
add_argument = FLAGS.add_argument

def run(test):
  """Main run method, call instead of unittest.main().

    Args:
      test: Test derived from IPythonTestCase.
  """
  args = FLAGS.parse_args()
  test.REMOTE_WEBDRIVER = args.remote_webdriver
  test.CHROME_WEBDRIVER = args.chrome_webdriver
  test.args = args
  suite = unittest.TestLoader().loadTestsFromTestCase(test)
  unittest.TextTestRunner(verbosity=args.verbosity).run(suite)
