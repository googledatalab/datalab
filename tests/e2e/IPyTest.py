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

from ipython import IPythonTestRunner
from ipython.IPythonTestCase import IPythonTestCase
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

IPythonTestRunner.add_argument('--notebook-server',
                               dest='notebook_server',
                               type=str,
                               help='Python notebook server to test against',
                               default='http://localhost:9000')

class IPyTest(IPythonTestCase):
  def testBasicTest(self):
    driver = self.driver
    # Loads the main page of the notebook server.
    driver.get(self.args.notebook_server)

    # Tests that the title of the main page is as expected.
    self.assertEqual(u'Home', driver.title)

    # Find an element in the notebook and click it.
    button = driver.find_element_by_partial_link_text('BigQuery - Basics')
    button.click()

    # The link above opens a new window, so wait until open before proceeding.
    WebDriverWait(driver, 10).until(
        lambda driver: len(driver.window_handles) > 1)
    # Switch to the window that just opened.
    driver.switch_to_window(driver.window_handles[1])

    # Wait until an expected element is visible before proceeding.
    element = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, 'bigquery-basics')))
    # Now that it's there, check that it's text is as expected.
    self.assertEqual(u'BigQuery - Basics', element.text)

    # Test that text is not present. Only possible with a try, except right now.
    try:
      not_there = "This line isn't present"
      # Uncomment to test not-there failure.
      # not_there = 'Pandas'
      element = driver.find_element_by_partial_link_text(not_there)
      self.fail('Found extraneous text (e.g., "{}")'.format(not_there))
    except EC.NoSuchElementException:
      pass

if __name__ == '__main__':
  IPythonTestRunner.run(IPyTest)
