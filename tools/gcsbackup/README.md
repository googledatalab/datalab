# GCSbackup
Please note: GCSbackup should only run inside a GCloud VM instance.

GCSbackup is a tool to create a tagged .tar backup for a given local path and copy it to a GCS bucket. It can be configured to maintain a maximum of n backups for the specified tag. It automatically deletes older backups.

On GCS, the .tar is copied to a qualified path that is unique to the VM where this script is running, the username, backup path, tag, and timestamp.

## Usage
./GCSbackup.sh [OPTION]...

  -n, --num-backups   Number of backups to keep. Default is 10
  -b, --bucket        Name of GCS bucket to store the backups in. Default is "{project-id}_datalab-backups
                      Follow the bucket naming guidelines here: https://cloud.google.com/storage/docs/naming
  -p, --path          Path to backup. Default is current directory
  -t, --tag           Tag to mak grouping similar backups easy. Default is "backup"

If no PATH is specified, the current working directory is backed up.

## Example
./GCSbackup.sh -n 5 -p /home/mypath -t daily
  Creates a tar archive of /home/mypath, with a "daily" tag on it, uploads it to GCS with the name: GCSBUCKET/home/myscripts/12345678901234567890-username-h-timestamp. A maximum of 5 backups with the tag "daily" will be kept, older ones are deleted.
