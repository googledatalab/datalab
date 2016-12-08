#!/usr/bin/env python

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

"""Command line tool for administering instances of Datalab

This tool is specific to the use case of running in the Google Cloud Platform.
"""

from commands import create, connect, list, stop, delete

import argparse
import subprocess
import sys


_SUBCOMMANDS = {
    'create': {
        'help': 'Create and connect to a new Datalab instance',
        'description': create.description,
        'flags': create.flags,
        'run': create.run,
        'require-zone': True,
    },
    'connect': {
        'help': 'Connect to an existing Datalab instance',
        'description': connect.description,
        'flags': connect.flags,
        'run': connect.run,
        'require-zone': True,
    },
    'list': {
        'help': 'List the existing Datalab instances in a project',
        'description': list.description,
        'examples': list.examples,
        'flags': list.flags,
        'run': list.run,
        'require-zone': False,
    },
    'stop': {
        'help': 'Stop an existing Datalab instance',
        'description': stop.description,
        'flags': stop.flags,
        'run': stop.run,
        'require-zone': True,
    },
    'delete': {
        'help': 'Delete an existing Datalab instance',
        'description': delete.description,
        'flags': delete.flags,
        'run': delete.run,
        'require-zone': True,
    },
}


_PROJECT_HELP = (
"""The Google Cloud Platform project name to use
for this invocation.

If omitted then the current project is assumed.""")


_ZONE_HELP = (
"""The zone containing the instance. If not specified,
you may be prompted to select a zone.

To avoid prompting when this flag is omitted, you can
set the compute/zone property:

    $ gcloud config set compute/zone ZONE

A list of zones can be fetched by running:

    $ gcloud compute zones list

To unset the property, run:

    $ gcloud config unset compute/zone

Alternatively, the zone can be stored in the
environment variable CLOUDSDK_COMPUTE_ZONE.
""")


def gcloud_compute(args, cmd, api='', stdin=None, stdout=None, stderr=None):
    """Run the given subcommand of `gcloud compute`

    Args:
      args: The Namespace instance returned by argparse
      cmd: The subcommand of `gcloud compute` to run
      api: The optional API version to use (e.g. 'alpha', 'beta', etc)
      stdin: The 'stdin' argument for the subprocess call
      stdout: The 'stdout' argument for the subprocess call
      stderr: The 'stderr' argument for the subprocess call
    Raises:
      KeyboardInterrupt: If the user kills the command
      subprocess.CalledProcessError: If the command dies on its own
    """
    base_cmd = ['gcloud']
    if api:
        base_cmd.append(api)
    base_cmd.append('compute')
    if args.project:
        base_cmd.extend(['--project', args.project])
    cmd = base_cmd + cmd
    return subprocess.check_call(cmd, stdin=stdin, stdout=stdout, stderr=stderr)


def run():
    """Run the command line tool."""
    parser = argparse.ArgumentParser(
        formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument(
        '--project',
        dest='project',
        default=None,
        help=_PROJECT_HELP)
    parser.add_argument(
        '--zone',
        dest='zone',
        default=None,
        help=_ZONE_HELP)

    subparsers = parser.add_subparsers(dest='subcommand')
    for subcommand in _SUBCOMMANDS:
        command_config = _SUBCOMMANDS[subcommand]
        description_template = command_config.get('description')
        prog = sys.argv[0]
        command_description = (
            description_template.format(prog, subcommand))
        examples = command_config.get('examples', '').format(prog, subcommand)
        epilog = 'examples:{0}'.format(examples) if examples else ''
        subcommand_parser = subparsers.add_parser(
            subcommand,
            formatter_class=argparse.RawTextHelpFormatter,
            description=command_description,
            epilog=epilog,
            help=command_config['help'])
        command_config['flags'](subcommand_parser)
        subcommand_parser.add_argument(
            '--project',
            dest='project',
            default=None,
            help=_PROJECT_HELP)
        if command_config['require-zone']:
            subcommand_parser.add_argument(
                '--zone',
                dest='zone',
                default=None,
                help=_ZONE_HELP)

    args = parser.parse_args()
    try:
        _SUBCOMMANDS[args.subcommand]['run'](args, gcloud_compute)
    except subprocess.CalledProcessError:
        print('A nested call to gcloud failed.')


if __name__ == '__main__':
    run()
