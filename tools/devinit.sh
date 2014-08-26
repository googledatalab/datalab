#!/bin/sh

# Script to initialize a dev workstation. Installs required packages/tools.

# Python Linter (http://www.pylint.org)
pip install pylint

os=`uname`
if [ "$os" == "Linux" ]; then
  # Goobuntu package versions are all older than we need
  # TODO(bryantd): See if possible to point aptitude at a fresher (trusted) pkg repo
else
  echo "Please install the following tools for your OS:"
  echo "NodeJS 0.10.x: http://nodejs.org/download"
  echo "Gradle 2.0: http://www.gradle.org/downloads"
fi
# TODO(bryantd): automate a cross-platform way to install NodeJS, Gradle

if [ `which npm` != "" ]; then
  npm install -g typescript
else
  echo "Please install NodeJS and then re-run this script to install the TypeScript compiler."
fi
