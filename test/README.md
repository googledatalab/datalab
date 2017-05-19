# Testing Google Cloud DataLab

This directory contains tests for Datalab. Tests are all written in Javascript, and use a browser
to run UI automation tests and notebook tests.

A [standalone Chrome browser](https://github.com/SeleniumHQ/docker-selenium/tree/master/StandaloneChrome)
is started inside a docker container provided by selenium, and tests use nodejs bindings for
selenium to drive a browser session, take screenshots, and execute notebooks. Using the docker
container reduces cross platform dependencies, provides a stable platform for tests, and reduces
the overall test time, since no image needs to be built on every change to Datalab.

For UI tests, the [resemblejs package](https://github.com/Huddle/Resemble.js/) is used to compare
screenshots against saved (golden) images, which is able to tolerate small anti-aliasing
differences that are sometimes caused by selenium webdrivers.

For notebook tests, a list of notebooks to be tested is included in a spec file, and optionally
a list of cells to ignore for each notebook, which is useful when specific cells are flaky or
intentionally erroneous. Each notebook is then loaded in a browser page, and all its cells are
executed, and tests pass if no errors are produced.

## Running Tests

### TL;DR

Make sure you can install cairo on your system. Check the `.travis.yml` file for more info.

From the root of your datalab repo, navigate to the `test` directory, then run: `npm install-test`

### Test Setup

Tests were written as a nodejs package, so in order to run them locally, you first do `npm install`
in order to download all the node dependencies. You only have to do this once to prepare for tests.
Note that this will try to install `cairo`, which is a dependency of `resemblejs`. If you see
errors during the installation, this is likely what you want to debug. Make sure your system has
the required packages for cairo installed. For example, for an Ubuntu machine, you can see the
dependencies in the `.travis.yml` file.

### Running Tests

Run `npm test` to start the tests, which use [Mocha JS](https://github.com/mochajs/mocha) as a
test runner. UI and notebook tests require the Datalab and Selenium docker containers to be
running (check `test/run.sh`). If you want to iterate on tests, you can manually start these
containers as in the run script, then start a test suite by calling the `mocha` command directly,
for example: `mocha notebook/test.js`.

UI tests compare screenshots they take at various points against golden screenshots that are
saved under `test/ui/golden`. If a UI test fails, it will put a screenshot of the bad view under
`test/ui/broken`, so you can compare it against its golden counterpart with the same name.

Note that any changes made to source files will not appear automatically for the test runner,
since it does not use the live reload functionality. You will have to rebuild the image manually
for tests to pick up such changes.
