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

from commands import create, creategpu, connect, list, stop, delete, utils

import argparse
import os
import subprocess
import traceback


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

_BETA_SUBCOMMANDS = {
    'create-gpu': {
        'help': 'Create and connect to a new Datalab GPU instance',
        'description': creategpu.description,
        'flags': creategpu.flags,
        'run': creategpu.run,
        'require-zone': True,
    }
}


_PROJECT_HELP = ("""The Google Cloud Platform project name to use
for this invocation.

If omitted then the current project is assumed.""")


_ZONE_HELP = ("""The zone containing the instance. If not specified,
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


try:
    with open(os.devnull, 'w') as dn:
        subprocess.call(['gcloud', '--version'], stderr=dn, stdout=dn)
    gcloud_cmd = 'gcloud'
except:
    gcloud_cmd = 'gcloud.cmd'


def gcloud_compute(
        args, compute_cmd, stdin=None, stdout=None, stderr=None):
    """Run the given subcommand of `gcloud compute`

    Args:
      args: The Namespace instance returned by argparse
      compute_cmd: The subcommand of `gcloud compute` to run
      stdin: The 'stdin' argument for the subprocess call
      stdout: The 'stdout' argument for the subprocess call
      stderr: The 'stderr' argument for the subprocess call
    Raises:
      KeyboardInterrupt: If the user kills the command
      subprocess.CalledProcessError: If the command dies on its own
    """
    base_cmd = [gcloud_cmd]
    base_cmd.append('compute')
    if args.project:
        base_cmd.extend(['--project', args.project])
    if args.quiet:
        base_cmd.append('--quiet')
    base_cmd.append('--verbosity={}'.format(args.verbosity))
    cmd = base_cmd + compute_cmd
    return subprocess.check_call(
        cmd, stdin=stdin, stdout=stdout, stderr=stderr)


def gcloud_beta_compute(
        args, compute_cmd, stdin=None, stdout=None, stderr=None):
    """Run the given subcommand of `gcloud beta compute`

    Args:
      args: The Namespace instance returned by argparse
      compute_cmd: The subcommand of `gcloud compute` to run
      stdin: The 'stdin' argument for the subprocess call
      stdout: The 'stdout' argument for the subprocess call
      stderr: The 'stderr' argument for the subprocess call
    Raises:
      KeyboardInterrupt: If the user kills the command
      subprocess.CalledProcessError: If the command dies on its own
    """
    base_cmd = [gcloud_cmd, 'beta', 'compute']
    if args.project:
        base_cmd.extend(['--project', args.project])
    if args.quiet:
        base_cmd.append('--quiet')
    base_cmd.append('--verbosity={}'.format(args.verbosity))
    cmd = base_cmd + compute_cmd
    return subprocess.check_call(
        cmd, stdin=stdin, stdout=stdout, stderr=stderr)


def gcloud_repos(
        args, repos_cmd, stdin=None, stdout=None, stderr=None):
    """Run the given subcommand of `gcloud source repos`

    Args:
      args: The Namespace instance returned by argparse
      repos_cmd: The subcommand of `gcloud source repos` to run
      stdin: The 'stdin' argument for the subprocess call
      stdout: The 'stdout' argument for the subprocess call
      stderr: The 'stderr' argument for the subprocess call
    Raises:
      KeyboardInterrupt: If the user kills the command
      subprocess.CalledProcessError: If the command dies on its own
    """
    base_cmd = [gcloud_cmd, 'source', 'repos']
    if args.project:
        base_cmd.extend(['--project', args.project])
    base_cmd.append('--verbosity={}'.format(args.verbosity))
    cmd = base_cmd + repos_cmd
    return subprocess.check_call(
        cmd, stdin=stdin, stdout=stdout, stderr=stderr)


def get_email_address():
    """Get the email address of the user's active gcloud account.

    Returns:
      The email address of the "active" gcloud authenticated account.

    Raises:
      subprocess.CalledProcessError: If the gcloud command fails
    """
    return subprocess.check_output([
        gcloud_cmd, 'auth', 'list', '--quiet', '--format',
        'value(account)', '--filter', 'status:ACTIVE']).strip()


def add_sub_parser(subcommand, command_config, subparsers, prog):
    """Adds a subparser.

    Args:
      subcommand: The subcommand to add.
      command_config: The subcommand's config.
      subparsers: The list of subparsers to add to.
      prog: The program name.
    """
    description_template = command_config.get('description')
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
    subcommand_parser.add_argument(
        '--quiet',
        dest='quiet',
        action='store_true',
        help='do not issue any interactive prompts')
    subcommand_parser.add_argument(
        '--verbosity',
        dest='verbosity',
        choices=['debug', 'info', 'warning', 'error', 'critical', 'none'],
        default='error',
        help='Override the default output verbosity for this command.')
    if command_config['require-zone']:
        subcommand_parser.add_argument(
            '--zone',
            dest='zone',
            default=None,
            help=_ZONE_HELP)


def run():
    """Run the command line tool."""
    prog = 'datalab'
    parser = argparse.ArgumentParser(
        prog=prog, formatter_class=argparse.RawTextHelpFormatter)
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
    parser.add_argument(
        '--quiet',
        dest='quiet',
        action='store_true',
        help='do not issue any interactive prompts')
    parser.add_argument(
        '--verbosity',
        dest='verbosity',
        choices=['debug', 'info', 'warning', 'error', 'critical', 'none'],
        default='error',
        help='Override the default output verbosity for this command.')

    subparsers = parser.add_subparsers(dest='subcommand')
    for subcommand in _SUBCOMMANDS:
        add_sub_parser(subcommand, _SUBCOMMANDS[subcommand], subparsers, prog)

    beta_parser = subparsers.add_parser(
        'beta',
        formatter_class=argparse.RawTextHelpFormatter,
        description='Beta commands for datalab.')
    beta_subparsers = beta_parser.add_subparsers(dest='beta_subcommand')
    for subcommand in _BETA_SUBCOMMANDS:
        add_sub_parser(subcommand, _BETA_SUBCOMMANDS[subcommand],
                       beta_subparsers, prog)

    args = parser.parse_args()
    try:
        if args.subcommand == 'beta':
            _BETA_SUBCOMMANDS[args.beta_subcommand]['run'](
                args, gcloud_beta_compute,
                gcloud_repos=gcloud_repos,
                email=get_email_address(),
                in_cloud_shell=('DEVSHELL_CLIENT_PORT' in os.environ))
        else:
            _SUBCOMMANDS[args.subcommand]['run'](
                args, gcloud_compute,
                gcloud_repos=gcloud_repos,
                email=get_email_address(),
                in_cloud_shell=('DEVSHELL_CLIENT_PORT' in os.environ))
    except subprocess.CalledProcessError:
        print('A nested call to gcloud failed.')
    except Exception as e:
        if utils.print_info_messages(args):
            traceback.print_exc(e)
        print(e)


if __name__ == '__main__':
    run()
