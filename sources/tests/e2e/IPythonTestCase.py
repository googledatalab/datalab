from selenium import webdriver
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
from selenium.common.exceptions import RemoteDriverServerException
import unittest
import optparse

class IPythonTestCase(unittest.TestCase):
  args = optparse.Values()
  REMOTE_WEBDRIVER = None
  CHROME_WEBDRIVER = ('/usr/local/lib/node_modules/protractor'
                      '/selenium/chromedriver')
  def setUp(self):
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
    if self.driver is not None:
      self.driver.quit()
