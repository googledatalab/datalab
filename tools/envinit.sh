#!/bin/sh

# This script initializes an dev prompt with the required environment variables
# and any other environment customizations.

# Export a variable corresponding to the root of the repository
export REPO_DIR=$(cd "$(dirname "$0")/.."; pwd)

# These control where the local emulation of the GCE metadata service exists.
export METADATA_HOST=localhost
export METADATA_PORT=8089

# Turn off python's default behavior of generating .pyc files, so that we don't
# end up picking up stale code when running samples or tests during development.
export PYTHONDONTWRITEBYTECODE=1

