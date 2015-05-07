
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
from selenium.common.exceptions import RemoteDriverServerException
import unittest


class IpyTest(unittest.TestCase):

  def setUp(self):
    self.driver = None
    wait_count = 10;
    while(self.driver is None):
      try:
        self.driver = webdriver.Remote(
            command_executor='http://127.0.0.1:4444/wd/hub',
            desired_capabilities=DesiredCapabilities.CHROME)
      except RemoteDriverServerException as e:
        wait_count-=1
        if(wait_count>0):
          pass
  def tearDown(self):
    if self.driver:
      self.driver.quit()
  def testBasicTest(self):
    driver = self.driver
    driver.get('localhost:9000');
    self.assertEqual(u'Home', driver.title)
    button = driver.find_element_by_partial_link_text('BigQuery - Basics')
    button.click();
    WebDriverWait(driver, 10).until(
        lambda driver: len(driver.window_handles) > 1)
    driver.switch_to_window(driver.window_handles[1])
    element = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, 'bigquery-basics')))
    self.assertEqual(u'BigQuery - Basics', element.text)
    try:
      not_there = "This line isn't present"
      # Uncomment to test not-there failure.
      # not_there = 'Pandas'
      element = driver.find_element_by_partial_link_text(not_there)
      self.fail('Found extraneous text (e.g., "{}")'.format(not_there))
    except EC.NoSuchElementException as e:
      pass


if __name__ == '__main__':
  unittest.main()
