#!/bin/sh

# Synchronize content from the repository content directory to the
# cloud within gs://cloud-datalab/content
# Add -n to dry-run to validate when making any change to this.
gsutil -m rsync -r -d -x publish.sh $REPO_DIR/content gs://cloud-datalab/content

# Update the permissions to enable all users to read content from the bucket.
gsutil acl ch -g all:R gs://cloud-datalab
gsutil defacl ch -u all:R gs://cloud-datalab

