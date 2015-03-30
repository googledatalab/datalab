#!/bin/bash
set -o errexit; # Fail build on first error, instead of carrying on by default

# Load the common build config
source config.sh;

mkdir -p "$test_path";

### TEST
# TODO(bryantd): Find a way to avoid needing to rebuild the src/* .ts files when compiling tests
# Best solution likely involves generating the *.d.ts typedefs when building /src/* and correctly
# symlinking these built files to the test directory, before building the tests.
echo 'Testing DataLab server backend...';

# Copy node .ts files to test.
cp -r "$server_root/src/node" "$test_path";
# Copy shared .ts files to the test area.
cp -r "$server_root/src/shared" "$test_path/node/app";
# Copy the test .ts files to the test area.
cp -r "$server_root/tests/node/" "$test_path/node";

# Compile the typescript code in test area (src and tests).
tsc_files=`find $test_path/node -name '*.ts' | tr '\n' ' '`;
tsc $common_tsc_args --module commonjs $tsc_files;

# Install the npm dependencies
echo 'Installing NPM dependencies for running the unit tests'
# Install the source code dependencies
npm install --prefix "$test_path/node";
# Now run the tests via the jasmine-node runner
jasmine-node "$test_path/node";

echo 'Testing complete!';
