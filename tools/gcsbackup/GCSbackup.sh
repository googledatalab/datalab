#!/bin/bash -e
# Copyright 2016 Google Inc. All rights reserved.
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
#
#
# Please note: GCSbackup should only run inside a Google Compute Engine VM instance.
#
# GCSbackup is a tool to create and maintain a tagged .tar backup archive
# for a given local path and copy it to a GCS bucket. It can be configured to
# maintain a maximum of n backups for specified tag. It automatically
# deletes older backups with the same tag.
#
# On GCS, the .tar is copied to a qualified path that is unique to the VM
# where this script is running, the username, path, tag, and timestamp.

USAGE='USAGE:

  ./GCSbackup.sh [OPTION]...

OPTIONS:

  -n, --num-backups   Number of backups to keep. Default is 10
  -b, --bucket        Name of GCS bucket to store backups in. Default is "{project-id}_datalab-backups"
                      Follow the bucket naming guidelines here: https://cloud.google.com/storage/docs/naming
  -p, --path          Path to backup. Default is current directory
  -t, --tag           Tag to make grouping similar backups easy. Default is "backup"
'

while [[ $# -gt 1 ]]; do
  key="$1"
  case $key in
      -n|--num-backups)
        num_backups="$2"
        shift
        ;;
      -b|--bucket)
        gcs_bucket="$2"
        shift
        ;;
      -p|--path)
        backup_path="$2"
        shift
        ;;
      -t|--tag)
        tag="$2"
        shift
        ;;
      --default)
        DEFAULT=YES
        shift
        ;;
      *)
        echo "Bad arguments found: ${key}"
        echo "${USAGE}"
        exit 1
      ;;
  esac
  shift   # skip option value
done

timestamp=$(date "+%Y%m%d%H%M%S")
machine_id=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/id" -H "Metadata-Flavor: Google" || echo "")
project_id=$(gcloud info |tr -d '[]' | awk '/project:/ {print $2}')
default_bucket="${project_id}.appspot.com"
tag="${tag:-backup}"
num_backups=${num_backups:-10}
gcs_bucket=${gcs_bucket:-$default_bucket}
backup_path=`readlink -f "${backup_path:-.}"`

echo "tag: ${tag}"
echo "backups to keep: ${num_backups}"
echo "backup path: ${backup_path}"
echo "gcs bucket:  ${gcs_bucket}"
echo

if [[ -z $machine_id ]]; then
  echo "GCSbackup can only run on a Google Compute Engine VM instance"
  exit 1
fi

# test and create bucket if necessary
gsutil ls gs://${gcs_bucket} &>/dev/null || {
  echo "Bucket '${gcs_bucket}' was not found. Creating it.."
  gsutil mb gs://"${gcs_bucket}"
}

# create an archive of the backup path
archive_name=$(mktemp -d)"/archive.tar"
echo "Creating archive: $archive_name"
tar -cf ${archive_name} "${backup_path}" || {
  echo "Failed creating the backup archive"
  exit 1
}

# backup_path is an absolute path that starts with '/'
backup_id="${gcs_bucket}/datalab-backups${backup_path}/${machine_id}-${USER}-${tag}-${timestamp}"

echo "Creating a new backup point with id: ${backup_id}"
gsutil cp ${archive_name} "gs://${backup_id}"

# remove excessive backups
all_backups=($(gsutil ls "gs://${gcs_bucket}/datalab-backups${backup_path}/${machine_id}-${USER}-${tag}-*"))

echo "Found ${#all_backups[@]} backups with the tag ${tag}:"
printf '%s\n' "${all_backups[@]}"

let num_extra="${#all_backups[@]}-${num_backups}"

if [[ $num_extra -gt 0 ]]; then
  echo "Removing: ${num_extra} old backups"
  for i in "${all_backups[@]:0:$num_extra}"; do
    gsutil rm ${i}
  done
fi
