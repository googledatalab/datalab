#!/bin/bash -e

# Copyright 2017 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# This script generates the `config_local.js` file for a specific build
#
# Example usage:
#   old_config=/tmp/config_local.js
#   new_config=/tmp/config_local_`git log --pretty=format:'%H' -n 1`
#   gsutil cp gs://${PROJECT_ID}/deploy/config_local.js ${old_config}
#   ./tools/release/generate_config_local.sh ${old_config} ${new_config}

OLD_CONFIG=${1}
NEW_CONFIG=${2}
export REVISION_ID=${3:-$(git log --pretty=format:'%H' -n 1)}

# Get the latest and previous versions from the config_local. Note that older
# config files don't have the full semantic version specified, so cannot extract using
# the "LATEST_SEMVER = " pattern, and instead use "latest: "
if [[ $(cat ${OLD_CONFIG} | grep "LATEST_SEMVER = ") ]]; then
  CURRENT_VERSION=`cat ${OLD_CONFIG} | grep "LATEST_SEMVER = " | cut -d '=' -f 2 | tr -d '" ;'`
  GTM_ACCOUNT=`cat ${OLD_CONFIG} | grep "GTM_ACCOUNT = " | cut -d '=' -f 2 | tr -d '"; '`
else
  CURRENT_VERSION=`cat ${OLD_CONFIG} | grep "latest: " | cut -d ':' -f 2 | tr -d ', '`
  GTM_ACCOUNT=`cat ${OLD_CONFIG} | grep "gtmAccount = " | cut -d '=' -f 2 | tr -d "'; "`
fi

CURRENT_DIR=$(dirname "${BASH_SOURCE[0]}")
source "${CURRENT_DIR}"/version.sh
CONFIG_TEMPLATE="${CURRENT_DIR}"/config_local_template.js

# Only if the current version will be updated, do we need a new config_local.js file.
# This affects cases where the previous release was published on the same day. Since our
# release granularity is at the single-day level, such an update would be meaningless.
#
# Moreover, this would cause an issue because the new PREVIOUS_SEMVER would point to the
# older release with the same date, and result in a loop for the rollback process.
if [ "$CURRENT_VERSION" == "$DATALAB_VERSION" ]; then
  echo "Simply reusing the existing config"
  cp ${OLD_CONFIG} ${NEW_CONFIG}
  exit 0
fi

cp ${CONFIG_TEMPLATE} ${NEW_CONFIG}
echo "Filling latest=${DATALAB_VERSION}"
sed -i -e s/{{DATALAB_VERSION_PLACEHOLDER}}/\"${DATALAB_VERSION}\"/ ${NEW_CONFIG}
echo "Filling latest patch=${DATALAB_VERSION_PATCH}"
sed -i -e s/{{DATALAB_VERSION_PATCH_PLACEHOLDER}}/\"${DATALAB_VERSION_PATCH}\"/ ${NEW_CONFIG}
echo "Filling previous=${CURRENT_VERSION}"
sed -i -e s/{{PREV_SEMVER_PLACEHOLDER}}/\"${CURRENT_VERSION}\"/ ${NEW_CONFIG}
echo "Filling gtm account=${GTM_ACCOUNT}"
sed -i -e s/{{GTM_ACCOUNT_PLACEHOLDER}}/\"${GTM_ACCOUNT}\"/ ${NEW_CONFIG}
