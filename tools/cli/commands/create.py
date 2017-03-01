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

"""Methods for implementing the `datalab create` command."""

import os
import subprocess
import tempfile

import connect
import utils


description = ("""`{0} {1}` creates a new Datalab instances running in a Google
Compute Engine VM.

This command also creates the 'datalab-network' network if necessary.

By default, the command creates a persistent connection to the newly
created instance. You can disable that behavior by passing in the
'--no-connect' flag.""")


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
  mkdir -p ${{MOUNT_DIR}}/datalab
  echo "Cloning the repo {0}"
  docker run --rm -v "${{MOUNT_DIR}}:/content" \
    --entrypoint "/bin/bash" {0} \
    gcloud source repos clone {1} /content/datalab/notebooks
}}

format_disk() {{
  echo "Formatting the persistent disk"
  mkfs.ext4 -F \
    -E lazy_itable_init=0,lazy_journal_init=0,discard \
    ${{PERSISTENT_DISK_DEV}}
  ${{MOUNT_CMD}}
  clone_repo
}}

mount_disk() {{
  echo "Trying to mount the persistent disk"
  mkdir -p "${{MOUNT_DIR}}"
  ${{MOUNT_CMD}} || format_disk
  chmod a+w "${{MOUNT_DIR}}"
  mkdir -p ${{MOUNT_DIR}}/datalab
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
  rm -rf "${{tmpdir}}"
  mkdir -p "${{tmpdir}}"
}}

mount_disk
configure_swap
cleanup_tmp

journalctl -u google-startup-scripts --no-pager > /var/log/startupscript.log
"""

_DATALAB_CONTAINER_MANIFEST_URL = (
    'http://metadata.google.internal/' +
    'computeMetadata/v1/instance/attributes/google-container-manifest')

_DATALAB_CLOUD_CONFIG = """
#cloud-config

runcmd:
- ['curl', '-X', 'GET', '-H', 'Metadata-Flavor: Google','{0}',
   '-o', '/tmp/podspec.yaml']
- ['kubelet', '--pod-manifest-path', '/tmp/podspec.yaml']
""".format(_DATALAB_CONTAINER_MANIFEST_URL)

_DATALAB_CONTAINER_SPEC = """
apiVersion: v1
kind: Pod
metadata:
  name: 'datalab-server'
spec:
  containers:
    - name: datalab
      image: {0}
      command: ['/datalab/run.sh']
      imagePullPolicy: IfNotPresent
      ports:
        - containerPort: 8080
          hostPort: 8080
          hostIP: 127.0.0.1
      env:
        - name: DATALAB_ENV
          value: GCE
        - name: DATALAB_DEBUG
          value: 'true'
        - name: DATALAB_SETTINGS_OVERRIDES
          value: '{{"enableAutoGCSBackups": {1}, "consoleLogLevel": "{2}" }}'
        - name: DATALAB_GIT_AUTHOR
          value: '{3}'
      volumeMounts:
        - name: datalab
          mountPath: /content/datalab
        - name: tmp
          mountPath: /tmp
    - name: logger
      image: gcr.io/google_containers/fluentd-gcp:1.18
      env:
        - name: FLUENTD_ARGS
          value: -q
      volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
  volumes:
    - name: datalab
      hostPath:
        path: /mnt/disks/datalab-pd/datalab
    - name: tmp
      hostPath:
        path: /mnt/disks/datalab-pd/tmp
    - name: varlog
      hostPath:
        path: /var/log
    - name: varlibdockercontainers
      hostPath:
        path: /var/lib/docker/containers
"""


class RepositoryException(Exception):

    _MESSAGE = (
        'Failed to find or create the repository {}.'
        '\n\n'
        'Ask a project owner to create it for you.')

    def __init__(self, repo_name):
        super(RepositoryException, self).__init__(
            RepositoryException._MESSAGE.format(repo_name))


def flags(parser):
    """Add command line flags for the `create` subcommand.

    Args:
      parser: The argparse parser to which to add the flags.
    """
    parser.add_argument(
        'instance',
        metavar='NAME',
        help='a name for the newly created instance')
    parser.add_argument(
        '--image-name',
        dest='image_name',
        default='gcr.io/cloud-datalab/datalab:latest',
        help=(
            'name of the Datalab image to run.'
            '\n\n'
            'If not specified, this defaults to the most recently\n'
            'published image.'))
    parser.add_argument(
        '--disk-name',
        dest='disk_name',
        default=None,
        help=(
            'name of the persistent disk used to store notebooks.'
            '\n\n'
            'If not specified, this defaults to having a name based\n'
            'on the instance name.'))
    parser.add_argument(
        '--disk-size-gb',
        type=int,
        dest='disk_size_gb',
        default=_DATALAB_DEFAULT_DISK_SIZE_GB,
        help='size of the persistent disk in GB.')
    parser.add_argument(
        '--machine-type',
        dest='machine_type',
        default='n1-standard-1',
        help=(
            'the machine type of the instance.'
            '\n\n'
            'To get a list of available machine types, run '
            '\'gcloud compute machine-types list\'.'
            '\n\n'
            'If not specified, the default type is n1-standard-1.'))

    parser.add_argument(
        '--no-connect',
        dest='no_connect',
        action='store_true',
        default=False,
        help='do not connect to the newly created instance')

    parser.add_argument(
        '--no-backups',
        dest='no_backups',
        action='store_true',
        default=False,
        help='do not automatically backup the disk contents to GCS')

    parser.add_argument(
        '--no-create-repository',
        dest='no_create_repository',
        action='store_true',
        default=False,
        help='do not create the datalab-notebooks repository if it is missing')

    parser.add_argument(
        '--log-level',
        dest='log_level',
        choices=['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
        default='warn',
        help=(
            'the log level for Datalab instance.'
            '\n\n'
            'This is the threshold under which log entries from the '
            'Datalab instance will not be written to StackDriver logging.'
            '\n\n'
            'The default log level is "warn".'))

    parser.add_argument(
        '--for-user',
        dest='for_user',
        help='create the datalab instance on behalf of the specified user')

    parser.add_argument(
        '--service-account',
        dest='service_account',
        help=('A service account is an identity attached to the instance. '
              'Its access tokens can be accessed through the instance '
              'metadata server and are used to authenticate API calls made '
              'from Datalab. The account can be either an email address or '
              'an alias corresponding to a service account. You can '
              'explicitly specify the Compute Engine default service account '
              'using the \'default\' alias.'
              '\n\n'
              'If not provided, the instance will get project\'s default '
              'service account.'))

    connect.connection_flags(parser)
    return


def create_network(args, gcloud_compute):
    """Create the `datalab-network` network.

    Args:
      args: The Namespace returned by argparse
      gcloud_compute: Function that can be used for invoking `gcloud compute`
    Raises:
      subprocess.CalledProcessError: If the `gcloud` command fails
    """
    if utils.print_info_messages(args):
        print('Creating the network {0}'.format(_DATALAB_NETWORK))
    create_cmd = [
        'networks', 'create', _DATALAB_NETWORK,
        '--description', _DATALAB_NETWORK_DESCRIPTION]
    utils.call_gcloud_quietly(args, gcloud_compute, create_cmd)
    return


def ensure_network_exists(args, gcloud_compute):
    """Create the `datalab-network` network if it does not already exist.

    Args:
      args: The Namespace returned by argparse
      gcloud_compute: Function that can be used for invoking `gcloud compute`
    Raises:
      subprocess.CalledProcessError: If the `gcloud` command fails
    """
    get_cmd = ['networks', 'describe', '--format', 'value(name)',
               _DATALAB_NETWORK]
    try:
        utils.call_gcloud_quietly(
            args, gcloud_compute, get_cmd, report_errors=False)
    except subprocess.CalledProcessError:
        create_network(args, gcloud_compute)
    return


def create_firewall_rule(args, gcloud_compute):
    """Create the `datalab-network-allow-ssh` firewall rule.

    Args:
      args: The Namespace returned by argparse
      gcloud_compute: Function that can be used for invoking `gcloud compute`
    Raises:
      subprocess.CalledProcessError: If the `gcloud` command fails
    """
    if utils.print_info_messages(args):
        print('Creating the firewall rule {0}'.format(_DATALAB_FIREWALL_RULE))
    create_cmd = [
        'firewall-rules', 'create', _DATALAB_FIREWALL_RULE,
        '--allow', 'tcp:22',
        '--network', _DATALAB_NETWORK,
        '--description', _DATALAB_FIREWALL_RULE_DESCRIPTION]
    utils.call_gcloud_quietly(args, gcloud_compute, create_cmd)
    return


def ensure_firewall_rule_exists(args, gcloud_compute):
    """Create the `datalab-network-allow-ssh` firewall rule if it necessary.

    Args:
      args: The Namespace returned by argparse
      gcloud_compute: Function that can be used for invoking `gcloud compute`
    Raises:
      subprocess.CalledProcessError: If the `gcloud` command fails
    """
    get_cmd = [
        'firewall-rules', 'describe', _DATALAB_FIREWALL_RULE,
        '--format', 'value(name)']
    try:
        utils.call_gcloud_quietly(
            args, gcloud_compute, get_cmd, report_errors=False)
    except subprocess.CalledProcessError:
        create_firewall_rule(args, gcloud_compute)
    return


def create_disk(args, gcloud_compute, disk_name, report_errors):
    """Create the user's persistent disk.

    Args:
      args: The Namespace returned by argparse
      gcloud_compute: Function that can be used for invoking `gcloud compute`
      disk_name: The name of the persistent disk to create
      report_errors: Whether or not to report errors to the end user
    Raises:
      subprocess.CalledProcessError: If the `gcloud` command fails
    """
    if utils.print_info_messages(args):
        print('Creating the disk {0}'.format(disk_name))
    create_cmd = ['disks', 'create']
    if args.zone:
        create_cmd.extend(['--zone', args.zone])
    create_cmd.extend([
        '--size', str(args.disk_size_gb) + 'GB',
        '--description', _DATALAB_DISK_DESCRIPTION,
        disk_name])
    utils.call_gcloud_quietly(args, gcloud_compute, create_cmd, report_errors)
    return


def ensure_disk_exists(args, gcloud_compute, disk_name, report_errors=False):
    """Create the given persistent disk if it does not already exist.

    Args:
      args: The Namespace returned by argparse
      gcloud_compute: Function that can be used for invoking `gcloud compute`
      disk_name: The name of the persistent disk
    Raises:
      subprocess.CalledProcessError: If the `gcloud` command fails
    """
    get_cmd = [
        'disks', 'describe', disk_name, '--format', 'value(name)']
    if args.zone:
        get_cmd.extend(['--zone', args.zone])
    try:
        utils.call_gcloud_quietly(
            args, gcloud_compute, get_cmd, report_errors=False)
    except subprocess.CalledProcessError:
        try:
            create_disk(args, gcloud_compute, disk_name, report_errors)
        except:
            if (not args.zone) and (not args.quiet):
                # We take this failure as a sign that gcloud might need
                # to prompt for a zone. As such, we do that prompting
                # for it, and then try again.
                args.zone = utils.prompt_for_zone(args, gcloud_compute)
                ensure_disk_exists(args, gcloud_compute, disk_name,
                                   report_errors=True)
            elif not report_errors:
                # We know the command failed (and will almost certainly
                # fail again), but we did not forward the errors that
                # it reported to the user. To work around this, we
                # re-run the command with 'report_errors' set to True
                create_disk(args, gcloud_compute, disk_name, True)
            else:
                raise
    return


def create_repo(args, gcloud_repos, repo_name):
    """Create the given repository.

    Args:
      args: The Namespace returned by argparse
      gcloud_repos: Function that can be used for invoking
        `gcloud alpha source repos`
      repo_name: The name of the repository to create
    Raises:
      subprocess.CalledProcessError: If the `gcloud` command fails
    """
    create_cmd = ['create', repo_name]
    utils.call_gcloud_quietly(args, gcloud_repos, create_cmd)


def ensure_repo_exists(args, gcloud_repos, repo_name):
    """Create the given repository if it does not already exist.

    Args:
      args: The Namespace returned by argparse
      gcloud_repos: Function that can be used for invoking
        `gcloud alpha source repos`
      repo_name: The name of the repository to check
    Raises:
      subprocess.CalledProcessError: If the `gcloud` command fails
    """
    list_cmd = ['list', '--quiet',
                '--filter', 'name:{}'.format(repo_name),
                '--format', 'value(name)']
    with tempfile.TemporaryFile() as tf:
        gcloud_repos(args, list_cmd, stdout=tf)
        tf.seek(0)
        matching_repos = tf.read().strip()
        if not matching_repos:
            try:
                create_repo(args, gcloud_repos, repo_name)
            except:
                raise RepositoryException(repo_name)


def run(args, gcloud_compute, gcloud_repos,
        email='', in_cloud_shell=False, **kwargs):
    """Implementation of the `datalab create` subcommand.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
      gcloud_repos: Function that can be used to invoke
        `gcloud alpha source repos`
      email: The user's email address
      in_cloud_shell: Whether or not the command is being run in the
        Google Cloud Shell
    Raises:
      subprocess.CalledProcessError: If a nested `gcloud` calls fails
    """
    ensure_network_exists(args, gcloud_compute)
    ensure_firewall_rule_exists(args, gcloud_compute)

    instance = args.instance
    disk_name = args.disk_name or '{0}-pd'.format(instance)
    ensure_disk_exists(args, gcloud_compute, disk_name)

    if not args.no_create_repository:
        ensure_repo_exists(args, gcloud_repos, _DATALAB_NOTEBOOKS_REPOSITORY)

    print('Creating the instance {0}'.format(instance))
    cmd = ['instances', 'create']
    if args.zone:
        cmd.extend(['--zone', args.zone])
    disk_cfg = (
        'auto-delete=no,boot=no,device-name=datalab-pd,mode=rw,name=' +
        disk_name)
    enable_backups = "false" if args.no_backups else "true"
    console_log_level = args.log_level or "warn"
    user_email = args.for_user or email
    service_account = args.service_account or "default"
    # We have to escape the user's email before using it in the YAML template.
    escaped_email = user_email.replace("'", "''")
    with tempfile.NamedTemporaryFile(delete=False) as startup_script_file, \
            tempfile.NamedTemporaryFile(delete=False) as user_data_file, \
            tempfile.NamedTemporaryFile(delete=False) as manifest_file, \
            tempfile.NamedTemporaryFile(delete=False) as for_user_file:
        try:
            startup_script_file.write(_DATALAB_STARTUP_SCRIPT.format(
                args.image_name, _DATALAB_NOTEBOOKS_REPOSITORY))
            startup_script_file.close()
            user_data_file.write(_DATALAB_CLOUD_CONFIG)
            user_data_file.close()
            manifest_file.write(
                _DATALAB_CONTAINER_SPEC.format(
                    args.image_name, enable_backups,
                    console_log_level, escaped_email))
            manifest_file.close()
            for_user_file.write(user_email)
            for_user_file.close()
            metadata_template = (
                'startup-script={0},' +
                'user-data={1},' +
                'google-container-manifest={2},' +
                'for-user={3}')
            metadata_from_file = (
                metadata_template.format(
                    startup_script_file.name,
                    user_data_file.name,
                    manifest_file.name,
                    for_user_file.name))
            cmd.extend([
                '--format=none',
                '--boot-disk-size=20GB',
                '--network', _DATALAB_NETWORK,
                '--image-family', 'cos-stable',
                '--image-project', 'cos-cloud',
                '--machine-type', args.machine_type,
                '--metadata-from-file', metadata_from_file,
                '--tags', 'datalab',
                '--disk', disk_cfg,
                '--service-account', service_account,
                '--scopes', 'cloud-platform',
                instance])
            gcloud_compute(args, cmd)
        finally:
            os.remove(startup_script_file.name)
            os.remove(user_data_file.name)
            os.remove(manifest_file.name)
            os.remove(for_user_file.name)

    if (not args.no_connect) and (not args.for_user):
        connect.connect(args, gcloud_compute, email, in_cloud_shell)
    return
