#!/bin/sh
# Copyright 2015 Google Inc. All rights reserved.
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

# Publishes content files to Google Cloud Storage as publicly accessible content.
# Synchronize content from the repository content directory to the
# cloud within gs://cloud-datalab/content

# First delete all content because rsync may not always override destination objects.
gsutil -m rm -r -f gs://cloud-datalab/content

# Now copy all contents over.
# Add -n to dry-run to validate when making any change to this.
gsutil -m rsync -r -d -x publish.sh $REPO_DIR/content gs://cloud-datalab/content

# Update the permissions to enable all users to read content from the bucket.
gsutil acl ch -g all:R gs://cloud-datalab
gsutil defacl ch -u all:R gs://cloud-datalab

