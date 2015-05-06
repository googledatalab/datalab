#!/bin/bash
set -o errexit; # Fail build on first error, instead of carrying on by default

# Load the common build config
source config.sh;

mkdir -p "$ui_staging_path" "$node_staging_path" "$build_path" "$build_path/static/profile/custom";

### BUILD
# NodeJS backend compilation in staging
echo 'Building DataLab server backend...';
# Copy node .ts files to the backend staging area.
rsync -avp "$server_root/src/node/" "$node_staging_path";
# Copy shared .ts files to the backend staging area.
rsync -avp "$server_root/src/shared" "$node_staging_path/app";
# Compile the typescript code in staging.
node_tsc_files=`find $node_staging_path -name '*.ts' | tr '\n' ' '`;
tsc $common_tsc_args --module commonjs $node_tsc_files;

# UI compilation in staging
echo 'Building DataLab server frontend...';
# Copy UI .ts files to the frontend staging area.
rsync -avp "$server_root/src/ui/" "$ui_staging_path";
# Copy shared .ts files to the frontend staging area.
rsync -avp "$server_root/src/shared" "$ui_staging_path/scripts/app";
# Compile the typescript code in staging.
ui_tsc_files=`find $ui_staging_path -name '*.ts' | tr '\n' ' '`;
tsc $common_tsc_args --module amd $ui_tsc_files;

# Merge the compiled backend and frontend components into a single build where NodeJS is serving
# the static UI content directly.
#
# Copy the compiled backend .js from staging to the server build.
rsync -avp "$node_staging_path/" "$build_path";
# Copy the built UI with static assets to the /static content path of the server build.
rsync -avp "$ui_staging_path/" "$build_path/static";
# Remove the unneeded .ts files from the build path (both ui and node).
find "$build_path" -name '*.ts' | xargs rm;

# Copy over the extensions.
rsync -avp "$profile_root/static/extensions/" "$build_path/static/profile/extensions";
# Copy over the RequireJS plugins.
rsync -avp "$profile_root/static/require/" "$build_path/static/profile/require";
# Copy over profile custom CSS that is not IPython-specific.
rsync -avp "$profile_root/static/custom/gchart-table.css" "$build_path/static/profile/custom";
# Copy the kernel profile configuration.
rsync -avp "$server_root/profile" "$build_path";


echo 'Build complete!'
