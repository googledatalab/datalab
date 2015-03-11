#!/bin/bash
set -o errexit; # Fail build on first error, instead of carrying on by default

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run source tools/initenv.sh first";
  exit 1;
fi

### CONFIG
# Create all of the output paths
build_root="$REPO_DIR/build/server";
# TODO(bryantd): using an additonal directory '_' to offset the build path such that
# the hard-coded dependency paths (dictated by TypeScript module system currently) will
# line up with the source directory layout. Current issue is that the source code needs
# to be compiled in multiple locations, each of which must have the correct number of parent
# directories to the externs/ts typedefs. One workaround would be to symlink externs/ts
# to each build location and then change all import references to account for this.
#
# All of this trickery would be unnecessary if TypeScript supported a requirejs-style path config
# specification, but it does not at the moment.
#
# This module path config feature is being actively discussed within the TypeScript community, so
# opting to see how it plays out before implementing more complex work-arounds. For discussion,
# see: https://github.com/Microsoft/TypeScript/issues/293
staging_path="$build_root/staging/_";
test_path="$build_root/tests";
build_path="$build_root/build";

# Define the source path
server_root="$REPO_DIR/sources/server";

# TypeScript compiler args for both backend and frontend code
common_tsc_args="--removeComments --noImplicitAny";

mkdir -p "$staging_path" "$build_path" "$test_path";


### BUILD
echo 'Building DataLab server backend...';
# Copy node .ts files to staging.
cp -r "$server_root/src/node/" "$staging_path";
# Copy shared .ts files to the backend staging area.
cp -r "$server_root/src/shared" "$staging_path/app";
# Compile the typescript code in staging.
tsc_files=`find $staging_path -name '*.ts' | tr '\n' ' '`;
tsc $common_tsc_args --module commonjs $tsc_files;
# Copy everything from staging to build.
cp -r $staging_path/* $build_path;
# Remove the unneeded .ts files.
find "$build_path" -name '*.ts' | xargs rm;


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
pushd "$test_path/node";
# Install the source code dependencies
npm install .;
# Now run the tests via the jasmine-node runner
jasmine-node .;
popd;

echo 'Done!'
