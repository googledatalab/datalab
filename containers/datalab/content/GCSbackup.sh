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

# Please note: GCSbackup should only run inside an instance of Google Cloud Datalab
#
# GCSbackup is a tool to create and maintain a tagged .zip backup archive
# for a given local path and copy it to a GCS bucket. It can be configured to
# maintain a maximum of n backups for specified tag. It automatically
# deletes older backups with the same tag.
#
# On GCS, the .zip is copied to a qualified path that is unique to the VM
# where this script is running, path, tag, and timestamp.

USAGE='USAGE:

  ./GCSbackup.sh [OPTION]...

OPTIONS:

  -n, --num-backups   Number of backups to keep. Default is 10
  -b, --bucket        Name of GCS bucket to store backups in. Default is "{project-id}_datalab-backups"
                      Follow the bucket naming guidelines here: https://cloud.google.com/storage/docs/naming
  -p, --path          Path to backup. Default is current directory
  -t, --tag           Tag to make grouping similar backups easy. Default is "backup"
  -l, --log-file      Name of log file to use. If none is specified, no output is logged
  -h, --help          Display this message
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
      -l|--log)
        log_file="$2"
        shift
        ;;
      --project)  # for testing on non-GCE machines, will be detected automatically on GCE VMs
        project_id="$2"
        shift
        ;;
      --zone)     # for testing on non-GCE machines, will be detected automatically on GCE VMs
        zone="$2"
        shift
        ;;
      --machine)  # for testing on non-GCE machines, will be detected automatically on GCE VMs
        machine_name="$2"
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

if [[ $1 == "-h" || $1 == "--help" ]]; then
  echo "${USAGE}"
  exit 0
fi

timestamp=$(date "+%Y%m%d%H%M%S")
project_id=${project_id:-$VM_PROJECT}
zone=${zone:-${VM_ZONE}}
machine_name=${machine_name:-$VM_NAME}
tag="${tag:-backup}"
num_backups=${num_backups:-10}

if [[ -z $machine_name || -z $project_id || -z $zone ]]; then
  echo "GCSbackup should only run inside an instance of Datalab" | tee -a ${log_file}
  exit 1
fi

# If no bucket is provided, try $project_id.appspot.com, then try $project_id
if [ -z "${gcs_bucket}" ]; then
  default_bucket="${project_id}.appspot.com"
  echo "Will use ${default_bucket} for bucket name"
  gsutil ls "gs://${default_bucket}" &>/dev/null && gcs_bucket="${default_bucket}" || {
    # We cannot create the $project_id.appspot.com bucket, so don't try that
    gcs_bucket=${project_id}
    echo "Could not list bucket ${default_bucket}. Next will use ${gcs_bucket} for bucket name"
    gsutil ls "gs://${gcs_bucket}" &>/dev/null || {
      gsutil mb gs://"${gcs_bucket}"
    }
  }
else
  gsutil ls gs://"${gcs_bucket}" &>/dev/null || {
    echo "Could not list bucket '${gcs_bucket}'. Will try to create it.."
    gsutil mb gs://"${gcs_bucket}"
  }
fi

backup_path=`readlink -f "${backup_path:-.}"`

echo "tag: ${tag}"
echo "backups to keep: ${num_backups}"
echo "backup path: ${backup_path}"
echo "project id: ${project_id}"
echo "zone: ${zone}"
echo "machine name: ${machine_name}"
echo "timestamp: ${timestamp}"
echo "gcs bucket: ${gcs_bucket}"
echo "log file: ${log_file}"
echo

echo "${timestamp}: Running GCS backup tool.." | tee -a ${log_file}

# create an archive of the backup path
archive_name=$(mktemp -d)"/archive.zip"
echo "Creating archive: $archive_name"
zip -rq ${archive_name} "${backup_path}" || {
  echo "Failed creating the backup archive" | tee -a ${log_file}
  exit 1
}

# backup_path is an absolute path that starts with '/'
backup_id="${gcs_bucket}/datalab-backups/${zone}/${machine_name}${backup_path}/${tag}-${timestamp}"

echo "Creating a new backup point with id: ${backup_id}"

# get new archive md5 hash
hash_regex="Hash \(md5\):\s+(.*)"
hash_output=$(gsutil hash -m "${archive_name}")
[[ "${hash_output}" =~ $hash_regex ]] && new_backup_hash="${BASH_REMATCH[1]}"

# get last backup md5 hash
{
  last_backup_id=$(
    gsutil ls "gs://${gcs_bucket}/datalab-backups/${zone}/${machine_name}${backup_path}/${tag}-*" \
    | tail -1
  )
  last_backup_metadata=$(gsutil ls -L "${last_backup_id}" | grep "Hash (md5)")
  [[ "${last_backup_metadata}" =~ $hash_regex ]] && last_backup_hash="${BASH_REMATCH[1]}"
} || echo "No previous backup hash found. First backup?"

# skip backup if nothing changed since last backup
echo "New archive md5 hash: ${new_backup_hash}"
echo "Last backup md5 hash: ${last_backup_hash}"
if [[ $new_backup_hash == $last_backup_hash ]]; then
  echo "Hash not different from last backup. Skipping this backup round." | tee -a $log_file
  rm -f "${archive_name}"
  exit 0
fi

# copying backup to GCS
gsutil cp ${archive_name} "gs://${backup_id}"
rm -f "${archive_name}"

# remove excessive backups
all_backups=($(gsutil ls "gs://${gcs_bucket}/datalab-backups/${zone}/${machine_name}${backup_path}/${tag}-*"))

echo "Found ${#all_backups[@]} backups with the tag ${tag}:"
printf '%s\n' "${all_backups[@]}"

let num_extra="${#all_backups[@]}-${num_backups}"

if [[ $num_extra -gt 0 ]]; then
  echo "Removing: ${num_extra} old backups"
  for i in "${all_backups[@]:0:$num_extra}"; do
    gsutil rm ${i}
  done
fi

if [[ $log_file ]]; then
  echo "GCS Backup point created successfully: ${backup_id}" >> "${log_file}"
fi
