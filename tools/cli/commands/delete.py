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

"""Methods for implementing the `datalab delete` command."""

from __future__ import absolute_import

from . import utils


description = ("""`{0} {1}` deletes the given Datalab instance's
Google Compute Engine VM.

By default, the persistent disk's auto-delete configuration determines
whether or not that disk is also deleted.

If you wish to override that setting, you can pass in one of either the
`--delete-disk` flag or the `--keep-disk` flag.

For more information on disk auto-deletion, see
https://cloud.google.com/compute/docs/disks/persistent-disks#updateautodelete
""")


_DELETE_DISK_HELP = ("""Whether or not to delete the instance's persistent disk
regardless of the disks' auto-delete configuration.""")


_KEEP_DISK_HELP = ("""Whether or not to keep the instance's persistent disk
regardless of the disks' auto-delete configuration.""")


_DELETE_BASE_PROMPT = ("""The following instance will be deleted:
 - [{}] in [{}]

The corresponding notebooks disk {}.
""")


def flags(parser):
    """Add command line flags for the `delete` subcommand.

    Args:
      parser: The argparse parser to which to add the flags.
    """
    parser.add_argument(
        'instance',
        metavar='NAME',
        help='name of the instance to delete')

    auto_delete_override = parser.add_mutually_exclusive_group()
    auto_delete_override.add_argument(
        '--delete-disk',
        dest='delete_disk',
        action='store_true',
        help=_DELETE_DISK_HELP)
    auto_delete_override.add_argument(
        '--keep-disk',
        dest='keep_disk',
        action='store_true',
        help=_KEEP_DISK_HELP)
    return


def run(args, gcloud_compute, gcloud_zone=None, **unused_kwargs):
    """Implementation of the `datalab delete` subcommand.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
      gcloud_zone: The zone that gcloud is configured to use
    Raises:
      subprocess.CalledProcessError: If a nested `gcloud` calls fails
    """
    instance = args.instance
    utils.maybe_prompt_for_zone(args, gcloud_compute, instance)

    base_cmd = ['instances', 'delete', '--quiet']
    if args.zone:
        base_cmd.extend(['--zone', args.zone])
        instance_zone = args.zone
    else:
        instance_zone = gcloud_zone

    if args.delete_disk:
        base_cmd.extend(['--delete-disks', 'data'])
        notebooks_disk_message_part = 'will be deleted'
    elif args.keep_disk:
        base_cmd.extend(['--keep-disks', 'data'])
        notebooks_disk_message_part = 'will not be deleted'
    else:
        disk_cfg = utils.instance_notebook_disk(args, gcloud_compute, instance)
        if not disk_cfg:
            notebooks_disk_message_part = 'is not attached'
        elif disk_cfg['autoDelete']:
            notebooks_disk_message_part = 'will be deleted'
        else:
            notebooks_disk_message_part = 'will not be deleted'

    message = _DELETE_BASE_PROMPT.format(
        instance, instance_zone, notebooks_disk_message_part)
    if not utils.prompt_for_confirmation(
            args=args,
            message=message,
            accept_by_default=True):
        print('Deletion aborted by user; Exiting.')
        return

    print('Deleting {0}'.format(instance))
    gcloud_compute(args, base_cmd + [instance])
    return
