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
import tempfile

import create
import connect

try:
    # If we are running in Python 2, builtins is available in 'future'.
    from builtins import input as read_input
except:
    # We don't want to require the installation of future, so fallback
    # to using raw_input from Py2.
    read_input = raw_input


description = ("""`{0} {1}` creates a new Datalab instance running in a Google
Compute Engine VM with a GPU.

This command also creates the 'datalab-network' network if necessary.

By default, the command creates a persistent connection to the newly
created instance. You can disable that behavior by passing in the
'--no-connect' flag.""")

_NVIDIA_PACKAGE = 'cuda-repo-ubuntu1604_8.0.61-1_amd64.deb'

_DATALAB_STARTUP_SCRIPT = create._DATALAB_BASE_STARTUP_SCRIPT + """
install_cuda() {{
  # Check for CUDA and try to install.
  if ! dpkg-query -W cuda; then
    curl -O http://developer.download.nvidia.com/\
compute/cuda/repos/ubuntu1604/x86_64/{5}
    dpkg -i ./{5}
    apt-get update -y
    apt-get install cuda -y
  fi
}}

install_nvidia_docker() {{
  # Install normal docker then install nvidia-docker
  if ! dpkg-query -W docker; then
    curl -sSL https://get.docker.com/ | sh
    curl -L -O https://github.com/NVIDIA/nvidia-docker/releases/\
download/v1.0.1/nvidia-docker_1.0.1-1_amd64.deb
    dpkg -i ./nvidia-docker_1.0.1-1_amd64.deb
    apt-get update -y
    apt-get install nvidia-docker -y
  fi
}}

cleanup_packages() {{
  apt-get update -y
  apt-get remove -y dnsmasq-base || true
}}

pull_datalab_image() {{
  if [[ "$(docker images -q {0})" == "" ]]; then
    gcloud docker -- pull {0} ;
  fi
}}

start_datalab_docker() {{
  nvidia-docker run --restart always -p '127.0.0.1:8080:8080' \
    -e DATALAB_ENV='GCE' -e DATALAB_DEBUG='true' \
    -e DATALAB_SETTINGS_OVERRIDES=\
'{{"enableAutoGCSBackups": {2}, "consoleLogLevel": "{3}" }}' \
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

cleanup_packages
install_cuda
install_nvidia_docker
cleanup_packages
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
    resp = read_input('Do you accept? (y/[n]): ')
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
                args.image_name, create._DATALAB_NOTEBOOKS_REPOSITORY,
                enable_backups, console_log_level, escaped_email,
                _NVIDIA_PACKAGE))
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
                '--network', args.network_name,
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
