# Testing Google Cloud DataLab

This directory contains tests Datalab. Tests are all written in Javascript, and they use a browser
to run UI automation tests and notebook tests.

It uses a [standalone Chrome browser](https://github.com/SeleniumHQ/docker-selenium/tree/master/StandaloneChrome) in a docker container provided by selenium, and nodejs bindings for selenium to
write tests that launch a browser instance, take screenshots, and execute notebooks. Using the
docker container reduces cross platform dependencies, provides a stable platform for tests, 
and reduces the overall test time, since no image needs to be built on every change to Datalab.

For UI tests, the [resemblejs package](https://github.com/Huddle/Resemble.js/) is used to compare
screenshots against saved (golden) images, which is able to tolerate small anti-aliasing
differences that are sometimes caused by selenium webdrivers.

For notebook tests, a list of notebooks to be tested is included in a spec file, and optionally
a list of cells to ignore for each notebook, which is useful when specific cells are flaky or
intentionally erroneous. Each notebook is then loaded in a browser page, and all its cells are
executed, and tests pass if no errors are produced.

## Running Tests

### TL;DR

Make sure you can install cairo on your system. Check the `.travis.yml` file for more info
`cd test`
`npm install-test`
Or
`npm test` if you have already installed the dependencies once

### More on running tests:

Tests were written as a nodejs package, so in order to run them locally, you first do `npm install`
in order to download all the node dependencies. You only have to do this once to prepare for tests.
You can then do `npm test` to start the tests. The one dependency is you have to be able to install
Cairo, which is a resemblejs dependency, on your system. Take a look at the Travis config to see
what is required on a vanilla VM to build resemblejs.

[Mocha JS](https://github.com/mochajs/mocha) is the test runner. UI and notebook tests require the
Datalab and Selenium docker containers to be running (check `test/run.sh`). If you want to iterate
on tests, you can manually start these containers as in the run script, then start a test suite
by calling the `mocha` command directly. For example: `mocha notebook/test.js`.

Note that any changes made to source files will not appear automatically for the test runner,
since it does not use the live reload functionality. You will have to rebuild the image manually
for tests to pick up such changes.
