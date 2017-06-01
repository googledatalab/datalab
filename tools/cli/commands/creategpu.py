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

"""Methods for implementing the `datalab beta creategpu` command."""

import os
from builtins import input
import subprocess
import tempfile

import create
import connect
import utils


description = ("""`{0} {1}` creates a new Datalab instance running in a Google
Compute Engine VM with a GPU.

This command also creates the 'datalab-network' network if necessary.

By default, the command creates a persistent connection to the newly
created instance. You can disable that behavior by passing in the
'--no-connect' flag.""")

_NVIDIA_PACKAGE = 'cuda-repo-ubuntu1604_8.0.61-1_amd64.deb'
_DATALAB_NETWORK = 'datalab-network'
_DATALAB_NETWORK_DESCRIPTION = 'Network for Google Cloud Datalab instances'

_DATALAB_FIREWALL_RULE = 'datalab-network-allow-ssh'
_DATALAB_FIREWALL_RULE_DESCRIPTION = 'Allow SSH access to Datalab instances'

_DATALAB_DEFAULT_DISK_SIZE_GB = 200
_DATALAB_DISK_DESCRIPTION = (
    'Persistent disk for a Google Cloud Datalab instance')

_DATALAB_NOTEBOOKS_REPOSITORY = 'datalab-notebooks'

_DATALAB_STARTUP_SCRIPT = """#!/bin/bash

PERSISTENT_DISK_DEV="/dev/disk/by-id/google-datalab-pd"
MOUNT_DIR="/mnt/disks/datalab-pd"
MOUNT_CMD="mount -o discard,defaults ${{PERSISTENT_DISK_DEV}} ${{MOUNT_DIR}}"

clone_repo() {{
  echo "Creating the datalab directory"
  mkdir -p ${{MOUNT_DIR}}/content/datalab
  echo "Cloning the repo {0}"
  docker run --rm -v "${{MOUNT_DIR}}/content:/content" \
    --entrypoint "/bin/bash" {0} \
    gcloud source repos clone {1} /content/datalab/notebooks
}}

repo_is_populated() {{
  cd ${{MOUNT_DIR}}/content/datalab/notebooks
  git show-ref --quiet
}}

populate_repo() {{
  echo "Populating datalab-notebooks repo"
  docker run --rm -v "${{MOUNT_DIR}}/content:/content" \
    --workdir=/content/datalab/notebooks \
    --entrypoint "/bin/bash" {0} -c "\
        echo '.ipynb_checkpoints' >> .gitignore; \
        echo '*.pyc' >> .gitignore; \
        echo '# Project Notebooks' >> README.md; \
        git add .gitignore README.md; \
        git -c user.email=nobody -c user.name=Datalab \
          commit --message='Set up initial notebook repo.'; \
        git push origin master; \
    "
}}

format_disk() {{
  echo "Formatting the persistent disk"
  mkfs.ext4 -F \
    -E lazy_itable_init=0,lazy_journal_init=0,discard \
    ${{PERSISTENT_DISK_DEV}}
  ${{MOUNT_CMD}}
  clone_repo
  if ! repo_is_populated; then
    populate_repo
  fi
}}

mount_and_prepare_disk() {{
  echo "Trying to mount the persistent disk"
  mkdir -p "${{MOUNT_DIR}}"
  ${{MOUNT_CMD}} || format_disk
  chmod a+w "${{MOUNT_DIR}}"
  mkdir -p "${{MOUNT_DIR}}/content"

  old_dir="${{MOUNT_DIR}}/datalab"
  new_dir="${{MOUNT_DIR}}/content/datalab"
  if [ -d "${{old_dir}}" ] && [ ! -d "${{new_dir}}" ]; then
    echo "Moving ${{old_dir}} to ${{new_dir}}"
    mv "${{old_dir}}" "${{new_dir}}"
  else
    echo "Creating ${{new_dir}}"
    mkdir -p "${{new_dir}}"
  fi
}}

configure_swap() {{
  mem_total_line=`cat /proc/meminfo | grep MemTotal`
  mem_total_value=`echo "${{mem_total_line}}" | cut -d ':' -f 2`
  memory_kb=`echo "${{mem_total_value}}" | cut -d 'k' -f 1 | tr -d '[:space:]'`
  swapfile="${{MOUNT_DIR}}/swapfile"

  # Create the swapfile if it is either missing or not big enough
  current_size="0"
  if [ -e "${{swapfile}}" ]; then
    current_size=`ls -s ${{swapfile}} | cut -d ' ' -f 1`
  fi
  if [ "${{memory_kb}}" -gt "${{current_size}}" ]; then
    echo "Creating a ${{memory_kb}} kilobyte swapfile at ${{swapfile}}"
    dd if=/dev/zero of="${{swapfile}}" bs=1024 count="${{memory_kb}}"
  fi
  chmod 0600 "${{swapfile}}"
  mkswap "${{swapfile}}"

  # Enable swap
  sysctl vm.disk_based_swap=1
  swapon "${{swapfile}}"
}}

cleanup_tmp() {{
  tmpdir="${{MOUNT_DIR}}/tmp"

  # First, make sure the temporary directory exists.
  mkdir -p "${{tmpdir}}"

  # Remove all files from it.
  #
  # We do not remove the directory itself, as that could lead to a broken
  # volume mount if the Docker container has already started).
  #
  # We also do not just use `rm -rf ${{tmpdir}}/*`, as that would leave
  # behind any hidden files.
  find "${{tmpdir}}/" -mindepth 1 -delete
}}

install_cuda() {{
  # Check for CUDA and try to install.
  if ! dpkg-query -W cuda; then
    curl -O http://developer.download.nvidia.com/compute/cuda/repos/ubuntu1604/x86_64/{5}
    dpkg -i ./{5}
    apt-get update
    apt-get install cuda -y
  fi
}}

install_nvidia_docker() {{
  # Install normal docker then install nvidia-docker
  if ! dpkg-query -W docker; then
    curl -sSL https://get.docker.com/ | sh
    curl -L -O https://github.com/NVIDIA/nvidia-docker/releases/download/v1.0.1/nvidia-docker_1.0.1-1_amd64.deb
    dpkg -i ./nvidia-docker_1.0.1-1_amd64.deb
    apt-get update
    apt-get install nvidia-docker -y
  fi
}}

pull_datalab_image() {{
  if [[ "$(docker images -q {0})" == "" ]]; then
    gcloud docker -- pull {0} ;
  fi
}}

start_datalab_docker() {{
  nvidia-docker run --restart always -p '127.0.0.1:8080:8080' \
    -e DATALAB_ENV='GCE' -e DATALAB_DEBUG='true' \
    -e DATALAB_SETTINGS_OVERRIDES='{{"enableAutoGCSBackups": {2}, "consoleLogLevel": "{3}" }}' \
    -e DATALAB_GIT_AUTHOR='{4}' \
    -v "${{MOUNT_DIR}}/content:/content" \
    -v "${{MOUNT_DIR}}/tmp:/tmp" \
    {0} -c /datalab/run.sh
}}

start_fluentd_docker() {{
  docker run --restart always \
    -e FLUENTD_ARGS='-q' \
    -v /var/log:/var/log \
    -v /var/lib/docker/containers:/var/lib/docker/containers:ro \
    gcr.io/google_containers/fluentd-gcp:1.18
}}

install_cuda
install_nvidia_docker
pull_datalab_image
mount_and_prepare_disk
configure_swap
cleanup_tmp
start_datalab_docker
start_fluentd_docker

journalctl -u google-startup-scripts --no-pager > /var/log/startupscript.log
"""


def flags(parser):
    """Add command line flags for the `create` subcommand.

    Args:
      parser: The argparse parser to which to add the flags.
    """
    create.flags(parser)
    parser.set_defaults(image_name='gcr.io/cloud-datalab/datalab-gpu:latest')
    
    parser.add_argument(
        '--accelerator-type',
        dest='accelerator_type',
        default='nvidia-tesla-k80',
        help=(
            'the accelerator type of the instance.'
            '\n\n'
            'Datalab currently only supports nvidia-tesla-k80.'
            '\n\n'
            'If not specified, the default type is none.'))

    parser.add_argument(
        '--accelerator-count',
        dest='accelerator_count',
        type=int,
        default=1,
        help=(
            'the accelerator count of the instance, used if '
            'accelerator-type is specified.'
            '\n\n'
            'If not specified, the default type is 1.'))
    return



def run(args, gcloud_beta_compute, gcloud_repos,
        email='', in_cloud_shell=False, **kwargs):
    """Implementation of the `datalab create` subcommand.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_beta_compute: Function that can be used to invoke `gcloud compute`
      gcloud_repos: Function that can be used to invoke
        `gcloud source repos`
      email: The user's email address
      in_cloud_shell: Whether or not the command is being run in the
        Google Cloud Shell
    Raises:
      subprocess.CalledProcessError: If a nested `gcloud` calls fails
    """
    print('By accepting below, you will download and install the '
          'following third-party software onto your managed GCE instances: '
          'NVidia GPU CUDA Toolkit Drivers: ' + _NVIDIA_PACKAGE)
    resp = input('Do you accept? (y/[n]): ')
    if len(resp) < 1 or (resp[0] != 'y' and resp[0] != 'Y'):
      print('Installation not accepted; Exiting.')
      return

    disk_cfg = create.prepare(args, gcloud_beta_compute, gcloud_repos)
    print('Creating the instance {0}'.format(args.instance))
    print('\n\nDue to GPU Driver installation, please note that '
          'Datalab GPU instances take significantly longer to '
          'startup compared to non-GPU instances.')
    cmd = ['instances', 'create']
    if args.zone:
        cmd.extend(['--zone', args.zone])
    enable_backups = "false" if args.no_backups else "true"
    console_log_level = args.log_level or "warn"
    user_email = args.for_user or email
    service_account = args.service_account or "default"
    # We have to escape the user's email before using it in the YAML template.
    escaped_email = user_email.replace("'", "''")
    with tempfile.NamedTemporaryFile(delete=False) as startup_script_file, \
            tempfile.NamedTemporaryFile(delete=False) as for_user_file:
        try:
            startup_script_file.write(_DATALAB_STARTUP_SCRIPT.format(
                args.image_name, _DATALAB_NOTEBOOKS_REPOSITORY, enable_backups,
                console_log_level, escaped_email, _NVIDIA_PACKAGE))
            startup_script_file.close()
            for_user_file.write(user_email)
            for_user_file.close()
            metadata_template = (
                'startup-script={0},' +
                'for-user={1}')
            metadata_from_file = (
                metadata_template.format(
                    startup_script_file.name,
                    for_user_file.name))
            cmd.extend([
                '--format=none',
                '--boot-disk-size=20GB',
                '--network', _DATALAB_NETWORK,
                '--image-family', 'ubuntu-1604-lts',
                '--image-project', 'ubuntu-os-cloud',
                '--machine-type', args.machine_type,
                '--accelerator',
                'type=' + args.accelerator_type + ',count=' 
                  + str(args.accelerator_count),
                '--maintenance-policy', 'TERMINATE', '--restart-on-failure',
                '--metadata-from-file', metadata_from_file,
                '--tags', 'datalab',
                '--disk', disk_cfg,
                '--service-account', service_account,
                '--scopes', 'cloud-platform',
                args.instance])
            gcloud_beta_compute(args, cmd)
        finally:
            os.remove(startup_script_file.name)
            os.remove(for_user_file.name)

    if (not args.no_connect) and (not args.for_user):
        connect.connect(args, gcloud_beta_compute, email, in_cloud_shell)
    return
