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
staging_path="$build_root/staging";
ui_staging_path="$staging_path/ui";
node_staging_path="$staging_path/node";
test_path="$build_root/tests";
build_path="$build_root/build";

# Define the source path
server_root="$REPO_DIR/sources/server";

# TypeScript compiler args for both backend and frontend code
common_tsc_args="--removeComments --noImplicitAny";
