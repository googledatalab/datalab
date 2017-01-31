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

"""Utility methods common to multiple commands."""

import tempfile


def prompt_for_zone(args, gcloud_compute, instance=None):
    """Prompt the user to select a zone.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
    Raises:
      subprocess.CalledProcessError: If a nested `gcloud` calls fails
    """
    if instance:
        # First, list the matching instances to see if there is exactly one.
        filtered_list_cmd = [
            'instances', 'list', '--quiet', '--filter',
            'name={}'.format(instance), '--format', 'value(zone)']
        matching_zones = []
        try:
            with tempfile.TemporaryFile() as tf:
                gcloud_compute(args, filtered_list_cmd, stdout=tf, stderr=tf)
                tf.seek(0)
                matching_zones = tf.read().strip().splitlines()
        except:
            # Just ignore this error and prompt the user
            pass
        if len(matching_zones) == 1:
            return matching_zones[0]

    list_args = ['zones', '--quiet', 'list', '--format=value(name)']
    print('Please specify a zone from one of:')
    gcloud_compute(args, list_args)
    return raw_input('Your selected zone: ')


def get_instance_status(args, gcloud_compute, instance):
    """Get the status of the given Google Compute Engine VM.

    This will prompt the user to select a zone if necessary.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
      instance: The name of the instance to check
    Returns:
      A string describing the status of the instance
      (e.g. 'RUNNING' or 'TERMINATED')
    Raises:
      subprocess.CalledProcessError: If the `gcloud` call fails
    """
    get_cmd = ['instances', 'describe', '--quiet']
    if args.zone:
        get_cmd.extend(['--zone', args.zone])
    get_cmd.extend(['--format', 'value(status)', instance])
    try:
        with tempfile.TemporaryFile() as tf:
            gcloud_compute(args, get_cmd, stdout=tf, stderr=tf)
            tf.seek(0)
            return tf.read().strip()
    except:
        if args.zone:
            raise
        else:
            args.zone = prompt_for_zone(
                args, gcloud_compute, instance=instance)
            return get_instance_status(args, gcloud_compute, instance)
    return 'UNKNOWN'


def maybe_prompt_for_zone(args, gcloud_compute, instance):
    """Prompt for the zone of the given VM if it is ambiguous.

    This will update the args.zone flag to point to the selected zone.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
      instance: The name of the instance to check
    Raises:
      subprocess.CalledProcessError: If the `gcloud` call fails
    """
    if not args.quiet:
        get_instance_status(args, gcloud_compute, instance)
