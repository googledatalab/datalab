#!/bin/bash
#
# template generated by genshtest

declare -a selenium_cleanup

if [ $# -lt 1 ]; then
  echo "Usage:"
  echo " runtest.sh python_script.py"
  exit 1;
fi

function cleanup() {
  if [ -n "$selenium_cleanup" ]; then
    curl --silent -o /dev/null http://localhost:4444/selenium-server/driver/?cmd=shutDownSeleniumServer
  fi
  dep_jobs=$(jobs -p)
  if [ -n "$dep_jobs" ]; then
    echo "Cleaning up the jobs I started: $dep_jobs"
    echo "$(ps)"
    kill -9 $dep_jobs
  fi
}
trap cleanup EXIT

function test_up() {
  curl --silent --fail -o /dev/null $1
}

if [ -z "$DISPLAY" ]; then
  export DISPLAY=":0.0"
fi

function fail() {
  echo "FAILED"
  exit 1
}

function pass() {
  if [ $# -eq 0 ]; then
    echo "PASS"
  else
    echo "$1 : PASS"
  fi
}

function wait_for_selenium() {
  until $(test_up http://localhost:4444/wd/hub); do
    printf '.'
    sleep 1
  done
}

function start_notebook_server() {
  echo "Starting ipython notebook server on :9000."
  $REPO_DIR/tools/ipy.sh $REPO_DIR/content/ipython/notebooks/ &> /dev/null &
}

function start_selenium_server() {
  echo "Launching local selenium server."
  selenium_cleanup=true
  $webdriver start &> /dev/null &
}

if [ -z "$REPO_DIR" ]; then
  echo "REPO_DIR is not set. Please run source tools/initenv.sh first.";
  fail
fi

webdriver=$(which webdriver-manager)

if [ -z "$webdriver" ]; then
  echo "No webdriver installation found."
  echo "Try:"
  echo "  pip install -U selenium"
  echo "  npm install -g protractor"
  echo "  webdriver-manager update --standalone"
  fail
fi

test_up http://localhost:9000/tree || start_notebook_server
test_up http://localhost:4444/wd/hub || start_selenium_server

wait_for_selenium && python $1

pass $1
