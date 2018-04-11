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

import json
import subprocess
import sys
import tempfile


try:
    # If we are running in Python 2, builtins is available in 'future'.
    from builtins import input as read_input
except Exception:
    # We don't want to require the installation of future, so fallback
    # to using raw_input from Py2.
    read_input = raw_input  # noqa: F821


def prompt_for_confirmation(
        args,
        message,
        question='Do you want to continue',
        accept_by_default=False):
    """Prompt the user for confirmation.

    Args:
      args: The Namespace returned by argparse
      message: A preliminary message explaining the question to the user.
      question: The prompt for the user to either accept or decline.
      accept_by_default: If True, then an empty response is treated as
          acceptance. Otherwise, an empty response is treated as declining.
    Returns:
      True iff the user accepted.
    """

    print(message)
    if args.quiet:
        return accept_by_default

    question_suffix = ' (Y/n)?: ' if accept_by_default else ' (y/N)?: '
    full_question = question + question_suffix
    resp = read_input(full_question)

    while resp and resp[0] not in ['y', 'Y', 'n', 'N']:
        print('Unexpected response {}, please enter "y" or "n"'.format(resp))
        resp = read_input(full_question)

    if len(resp) < 1:
        return accept_by_default

    return len(resp) < 1 or resp[0] in ['y', 'Y']


class InvalidInstanceException(Exception):

    _MESSAGE = (
        'The specified instance, {}, does not appear '
        'to have been created by the `datalab` tool, and '
        'so cannot be managed by it.')

    def __init__(self, instance_name):
        super(InvalidInstanceException, self).__init__(
            InvalidInstanceException._MESSAGE.format(instance_name))


class NoSuchInstanceException(Exception):

    _MESSAGE = (
        'The specified instance, {}, does not exist in any zone.')

    def __init__(self, instance_name):
        super(NoSuchInstanceException, self).__init__(
            NoSuchInstanceException._MESSAGE.format(instance_name))


class MissingZoneFlagException(Exception):

    _DEFAULT_MESSAGE = (
        'You must specify a zone using the --zone flag.')
    _INSTANCE_MESSAGE = (
        'You must specify a zone for the instance {} using the --zone flag.')

    def get_message(instance_name=None):
        if not instance_name:
            return MissingZoneFlagException._DEFAULT_MESSAGE
        else:
            return MissingZoneFlagException._INSTANCE_MESSAGE.format(
                instance_name)

    def __init__(self, instance_name=None):
        super(MissingZoneFlagException, self).__init__(
            MissingZoneFlagException.get_message(instance_name))


def call_gcloud_quietly(args, gcloud_surface, cmd, report_errors=True):
    """Call `gcloud` and silence any output unless it fails.

    Normally, the `gcloud` command line tool can output a lot of
    messages that are relevant to users in general, but may not
    be relevant to the way a Datalab instance is created.

    For example, creating a persistent disk will result in a
    message that the disk needs to be formatted before it can
    be used. However, the instance we create formats the disk
    if necessary, so that message is erroneous in our case.

    These messages are output regardless of the `--quiet` flag.

    This method allows us to avoid any confusion from those
    messages by redirecting them to a temporary file.

    In the case of an error in the `gcloud` invocation, we
    still print the messages by reading from the temporary
    file and printing its contents.

    Args:
      args: The Namespace returned by argparse
      gcloud_surface: Function that can be used for invoking `gcloud <surface>`
      cmd: The subcommand to run
      report_errors: Whether or not to report errors to the user
    Raises:
      subprocess.CalledProcessError: If the `gcloud` command fails
    """
    with tempfile.TemporaryFile() as stdout, \
            tempfile.TemporaryFile() as stderr:
        try:
            cmd = ['--quiet'] + cmd
            gcloud_surface(args, cmd, stdout=stdout, stderr=stderr)
        except subprocess.CalledProcessError:
            if report_errors:
                stdout.seek(0)
                stderr.seek(0)
                print(stdout.read().decode('utf-8'))
                sys.stderr.write(stderr.read())
            raise
        stderr.seek(0)
        gcloud_stderr = stderr.read().decode('utf-8')
        if 'WARNING' in gcloud_stderr:
            sys.stderr.write(gcloud_stderr)
    return


def prompt_for_zone(args, gcloud_compute, instance=None):
    """Prompt the user to select a zone.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
    Raises:
      subprocess.CalledProcessError: If a nested `gcloud` calls fails
      NoSuchInstanceException: If the user specified an instance that
          does not exist in any zone.
    """
    matching_zones = []
    list_cmd = ['zones', '--quiet', 'list', '--format=value(name)']
    if instance:
        # list the zones for matching instances instea of all zones.
        list_cmd = [
            'instances', 'list', '--quiet', '--filter',
            'name={}'.format(instance), '--format', 'value(zone)']
    with tempfile.TemporaryFile() as stdout, \
            tempfile.TemporaryFile() as stderr:
        try:
            gcloud_compute(args, list_cmd,
                           stdout=stdout, stderr=stderr)
            stdout.seek(0)
            matching_zones = stdout.read().decode('utf-8').strip().splitlines()
        except subprocess.CalledProcessError:
            stderr.seek(0)
            sys.stderr.write(stderr.read())
            raise

    if len(matching_zones) == 1:
        # There is only one possible zone, so just return it.
        return matching_zones[0]
    elif (instance and len(matching_zones) == 0):
        raise NoSuchInstanceException(instance)
    if args.quiet:
        raise MissingZoneFlagException(instance)

    zone_number = 1
    zone_map = {}
    print('Please specify a zone from one of:')
    for zone in matching_zones:
        zone_map[zone_number] = zone
        print(' [{}] {}'.format(zone_number, zone))
        zone_number += 1
    selected = read_input('Your selected zone: ')
    try:
        zone_number = int(selected)
        return zone_map[zone_number]
    except Exception:
        if selected not in matching_zones:
            print('Zone {} not recognized'.format(selected))
            return prompt_for_zone(args, gcloud_compute, instance=instance)
        return selected


def flatten_metadata(metadata):
    """Flatten the given API-style dictionary into a Python dictionary.

    This takes a mapping of key-value pairs as returned by the Google
    Compute Engine API, and converts it to a Python dictionary.

    The `metadata` argument is an object that has an `items` field
    containing a list of key->value mappings. Each key->value mapping
    is an object with a `key` field and a `value` field.

    Example:
       Given the following input:
          { "items": [
              { "key": "a",
                "value": 1
              },
              { "key": "b",
                "value": 2
              },
            ],
            "fingerprint": "<something>"
          }
       ... this will return {"a": 1, "b": 2}
    """
    items = metadata.get('items', [])
    result = {}
    for mapping in items:
        result[mapping.get('key', '')] = mapping.get('value', '')
    return result


def _check_datalab_tag(instance, tags):
    """Check that the given "tags" object contains `datalab`.

    This is used to verify that a VM was created by the `datalab create`
    command.

    Args:
      instance: The name of the instance to check
      tags: An object with an 'items' field that is a list of tags.
    Raises:
      InvalidInstanceException: If the check fails.
    """
    items = tags.get('items', [])
    if 'datalab' not in items:
        raise InvalidInstanceException(instance)
    return


def describe_instance(args, gcloud_compute, instance):
    """Get the status and metadata of the given Google Compute Engine VM.

    This will prompt the user to select a zone if necessary.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
      instance: The name of the instance to check
    Returns:
      A tuple of the string describing the status of the instance
      (e.g. 'RUNNING' or 'TERMINATED'), and the list of metadata items.
    Raises:
      subprocess.CalledProcessError: If the `gcloud` call fails
      ValueError: If the result returned by gcloud is not valid JSON
      InvalidInstanceException: If the instance was not created by
          running `datalab create`.
      NoSuchInstanceException: If the user specified an instance that
          does not exist in any zone.
    """
    get_cmd = ['instances', 'describe', '--quiet']
    if args.zone:
        get_cmd.extend(['--zone', args.zone])
    get_cmd.extend(
        ['--format', 'json(status,tags.items,metadata.items)', instance])
    with tempfile.TemporaryFile() as stdout, \
            tempfile.TemporaryFile() as stderr:
        try:
            gcloud_compute(args, get_cmd, stdout=stdout, stderr=stderr)
            stdout.seek(0)
            json_result = stdout.read().decode('utf-8').strip()
            status_tags_and_metadata = json.loads(json_result)
            tags = status_tags_and_metadata.get('tags', {})
            _check_datalab_tag(instance, tags)

            status = status_tags_and_metadata.get('status', 'UNKNOWN')
            metadata = status_tags_and_metadata.get('metadata', {})
            return (status, flatten_metadata(metadata))
        except subprocess.CalledProcessError:
            if args.zone:
                stderr.seek(0)
                sys.stderr.write(stderr.read())
                raise
            else:
                args.zone = prompt_for_zone(
                    args, gcloud_compute, instance=instance)
                return describe_instance(
                    args, gcloud_compute, instance)
    return ('UNKNOWN', [])


def instance_notebook_disk(args, gcloud_compute, instance):
    """Get the config for the notebooks disk attached to the instance.

    This returns None if there is no notebooks disk attached.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
      instance: The name of the instance to check
    Returns:
      An object containing the configuration for attaching the disk to
      the instance.
    Raises:
      subprocess.CalledProcessError: If the `gcloud` call fails
    """
    get_cmd = ['instances', 'describe', '--quiet']
    if args.zone:
        get_cmd.extend(['--zone', args.zone])
    get_cmd.extend(['--format', 'json', instance])
    with tempfile.TemporaryFile() as stdout, \
            tempfile.TemporaryFile() as stderr:
        try:
            gcloud_compute(args, get_cmd, stdout=stdout, stderr=stderr)
            stdout.seek(0)
            instance_json = json.loads(stdout.read().decode('utf-8').strip())
            disk_configs = instance_json.get('disks', [])
            for cfg in disk_configs:
                if cfg['deviceName'] == 'datalab-pd':
                    return cfg

            # There is no notebooks disk attached. This can happen
            # if the user manually detached it.
            return None
        except subprocess.CalledProcessError:
            stderr.seek(0)
            sys.stderr.write(stderr.read())
            raise


def maybe_prompt_for_zone(args, gcloud_compute, instance):
    """Prompt for the zone of the given VM if it is ambiguous.

    This will update the args.zone flag to point to the selected zone.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
      instance: The name of the instance to check
    Raises:
      subprocess.CalledProcessError: If the `gcloud` call fails
      InvalidInstanceException: If the instance was not created by
          running `datalab create`.
      NoSuchInstanceException: If the user specified an instance that
          does not exist in any zone.
    """
    describe_instance(args, gcloud_compute, instance)
    return


def print_warning_messages(args):
    """Return whether or not warning messages should be printed.

    Args:
      args: The Namespace instance returned by argparse
    Returns:
      True iff the verbosity has been set to a level that includes
          warning messages.
    """
    return args.verbosity in ['debug', 'info', 'default', 'warning']


def print_info_messages(args):
    """Return whether or not info messages should be printed.

    Args:
      args: The Namespace instance returned by argparse
    Returns:
      True iff the verbosity has been set to a level that includes
          info messages.
    """
    return args.verbosity in ['debug', 'info', 'default']


def print_debug_messages(args):
    """Return whether or not debug messages should be printed.

    Args:
      args: The Namespace instance returned by argparse
    Returns:
      True iff the verbosity has been set to a level that includes
          debug messages.
    """
    return args.verbosity == 'debug'
