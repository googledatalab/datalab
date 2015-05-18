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

"""Defines base class, utilities and import checking for selenium tests."""

import optparse
import sys
import unittest

def help_driver():
  """Install instructions for test case for import errors."""
  print 'Selenium doesn''t seem to be installed, try:'
  print '  pip install -U selenium'
  print '  npm install -g protractor'
  print '  webdriver-manager update --chrome'

try:
  from selenium import webdriver
  from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
  from selenium.common.exceptions import RemoteDriverServerException
except ImportError:
  help_driver()
  sys.exit(0)

class IPythonTestCase(unittest.TestCase):
  """Base class for running Selenium tests on ipython notebook instances.
  """

  args = optparse.Values()
  REMOTE_WEBDRIVER = None
  CHROME_WEBDRIVER = ('/usr/local/lib/node_modules/protractor'
                      '/selenium/chromedriver')
  NOTEBOOK_SERVER = 'http://localhost:9000'

  def setUp(self):
    """Common setup for all ipython tests, initializes webdriver."""
    self.driver = None
    wait_count = 10
    if self.REMOTE_WEBDRIVER is not None:
      while self.driver is None:
        try:
          self.driver = webdriver.Remote(
              command_executor=self.REMOTE_WEBDRIVER,
              desired_capabilities=DesiredCapabilities.CHROME)
        except RemoteDriverServerException:
          wait_count -= 1
          if wait_count > 0:
            pass
    else:
      self.driver = webdriver.Chrome(self.CHROME_WEBDRIVER)

    if self.driver is None:
      raise ValueError('Bad webdriver installation')

  def tearDown(self):
    """Quits webdriver."""
    if self.driver is not None:
      self.driver.quit()
