import IPyTestRunner
import sys
try:
  from IPythonTestCase import IPythonTestCase
  from selenium.webdriver.common.by import By
  from selenium.webdriver.support import expected_conditions as EC
  from selenium.webdriver.support.ui import WebDriverWait
except ImportError:
  IPyTestRunner.help_driver()
  sys.exit(0)

IPyTestRunner.FLAGS.add_argument('--notebook-server',
                                 dest='notebook_server',
                                 type=str,
                                 help='Python notebook server to test against',
                                 default='http://localhost:9000')

class IPyTest(IPythonTestCase):
  def testBasicTest(self):
    driver = self.driver
    driver.get(self.args.notebook_server)
    self.assertEqual(u'Home', driver.title)
    button = driver.find_element_by_partial_link_text('BigQuery - Basics')
    button.click()
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
    except EC.NoSuchElementException:
      pass

if __name__ == '__main__':
  IPyTestRunner.run(IPyTest)
