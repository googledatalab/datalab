#!/bin/bash
set -o errexit; # Fail build on first error, instead of carrying on by default

# Load the common build config
source config.sh;

ui_test_path="$test_path/ui";
mkdir -p $ui_test_path;

### TEST
# TODO(bryantd): Find a way to avoid needing to rebuild the src/* .ts files when compiling tests
# Best solution likely involves generating the *.d.ts typedefs when building /src/* and correctly
# symlinking these built files to the test directory, before building the tests.
echo 'Testing DataLab server backend...';

# Copy source .ts files to test.
rsync -avp "$server_root/src/ui" "$test_path";
rsync -avp "$server_root/src/node" "$test_path";

# Copy shared .ts files to the test area.
rsync -avp "$server_root/src/shared" "$ui_test_path/scripts/app";
rsync -avp "$server_root/src/shared" "$test_path/node/app";

# Copy the test .ts files to the test area.
rsync -avp "$server_root/tests/ui/" "$ui_test_path/scripts";
rsync -avp "$server_root/tests/node/" "$test_path/node";

# Compile the UI typescript code in test area (src and tests).
tsc_files=`find $ui_test_path -name '*.ts' | tr '\n' ' '`;
tsc $common_tsc_args --module amd $tsc_files;

# Compile the Node typescript code in test area (src and tests).
tsc_files=`find $test_path/node -name '*.ts' | tr '\n' ' '`;
tsc $common_tsc_args --module commonjs $tsc_files;

# Install the npm dependencies
echo 'Installing NPM dependencies for running the unit tests'
# Install the source code dependencies
npm install --prefix "$test_path/node";
# Now run the server-side (NodeJS) tests via the jasmine-node runner.
jasmine-node "$test_path/node";

# Execute the UI tests via the Karma runner.
karma start "$ui_test_path/scripts/karma-config.js"
