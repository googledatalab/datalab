import argparse
import unittest

FLAGS = argparse.ArgumentParser(description='Selenium E2E tests for ipython notebooks.')
FLAGS.add_argument('--remote-webdriver',
                   dest='remote_webdriver',
                   type=str,
                   help='Use a standalone remote webdriver '
                        '(e.g., http://127.0.0.1:4444/wd/hub)')
FLAGS.add_argument('--chrome-webdriver',
                   dest='chrome_webdriver',
                   type=str,
                   default='/usr/local/lib/node_modules'
                           '/protractor/selenium/chromedriver',
                   help='Location of selenium''s chromedriver.')
FLAGS.add_argument('--verbosity',
                   type=int,
                   default=1)

def help_driver():
  print 'Selenium doesn''t seem to be installed, try:'
  print '  pip install -U selenium'
  print '  npm install -g protractor'
  print '  webdriver-manager update --chrome'

def run(test):
  args = FLAGS.parse_args()
  test.REMOTE_WEBDRIVER = args.remote_webdriver
  test.CHROME_WEBDRIVER = args.chrome_webdriver
  test.args = args
  suite = unittest.TestLoader().loadTestsFromTestCase(test)
  unittest.TextTestRunner(verbosity=args.verbosity).run(suite)

