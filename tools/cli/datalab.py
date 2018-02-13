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
import json
import os
import subprocess
import traceback
import urllib2


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


# Name of the core Cloud SDK component as reported by gcloud
sdk_core_component = 'Google Cloud SDK'


# Name of the datalab Cloud SDK component as reported by gcloud
datalab_component = 'datalab'


# Public file reporting all known version issues.
version_issues_url = (
    'https://storage.googleapis.com/cloud-datalab/version-issues.js')


try:
    with open(os.devnull, 'w') as dn:
        subprocess.call(['gcloud', '--version'], stderr=dn, stdout=dn)
    gcloud_cmd = 'gcloud'
except Exception:
    gcloud_cmd = 'gcloud.cmd'


def report_known_issues(sdk_version, datalab_version):
    try:
        version_issues_resp = urllib2.urlopen(version_issues_url)
        version_issues = json.loads(version_issues_resp.read())
    except urllib2.HTTPError as e:
        print('Error downloading the version information: {}'.format(e))
        return

    sdk_issues = version_issues.get(sdk_core_component, {})
    known_sdk_issues = sdk_issues.get(sdk_version, [])
    if known_sdk_issues:
        print('You are using Cloud SDK version "{}", '
              'which has the following known issues:\n\t{}'.format(
                  sdk_version,
                  '\n\t'.join(known_sdk_issues)))
    datalab_issues = version_issues.get(datalab_component, {})
    known_datalab_issues = datalab_issues.get(datalab_version, [])
    if known_datalab_issues:
        print('You are using the Datalab CLI version "{}", '
              'which has the following known issues:\n\t{}'.format(
                  datalab_version,
                  '\n\t'.join(known_datalab_issues)))
    return


def add_gcloud_verbosity_flag(args, gcloud_cmd):
    """Add the appropriate '---verbosity' flag to the given gcloud command.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_cmd: The `gcloud ...` command to run
    """
    gcloud_verbosity = (
        'error' if args.verbosity == 'default' else args.verbosity)
    gcloud_cmd.append('--verbosity={}'.format(gcloud_verbosity))
    return


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
    add_gcloud_verbosity_flag(args, base_cmd)
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
    add_gcloud_verbosity_flag(args, base_cmd)
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
    add_gcloud_verbosity_flag(args, base_cmd)
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


def get_gcloud_zone():
    """Get the zone (if any) that gcloud is configured to use.

    Returns:
      The name of the zone gcloud is configured to use.
    """
    return subprocess.check_output([
        gcloud_cmd, 'config', 'config-helper', '--format',
        'value(configuration.properties.compute.zone)']).strip()


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
        default=None,
        action='store_true',
        help='do not issue any interactive prompts')
    subcommand_parser.add_argument(
        '--verbosity',
        dest='verbosity',
        choices=['debug', 'info', 'default',
                 'warning', 'error', 'critical', 'none'],
        default=None,
        help='Override the default output verbosity for this command.')
    subcommand_parser.add_argument(
        '--zone',
        dest='zone',
        default=None,
        help=_ZONE_HELP)
    subcommand_parser.add_argument(
        '--diagnose-me',
        dest='diagnose_me',
        default=None,
        action='store_true',
        help='Print additional information for diagnosing issues.')


def run():
    """Run the command line tool."""
    prog = 'datalab'
    parser = argparse.ArgumentParser(
        prog=prog, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument(
        '--project',
        dest='top_level_project',
        metavar='project',
        default=None,
        help=_PROJECT_HELP)
    parser.add_argument(
        '--zone',
        dest='top_level_zone',
        metavar='zone',
        default=None,
        help=_ZONE_HELP)
    parser.add_argument(
        '--quiet',
        dest='top_level_quiet',
        action='store_true',
        help='do not issue any interactive prompts')
    parser.add_argument(
        '--verbosity',
        dest='top_level_verbosity',
        choices=['debug', 'info', 'default',
                 'warning', 'error', 'critical', 'none'],
        default='default',
        help='Override the default output verbosity for this command.')
    parser.add_argument(
        '--diagnose-me',
        dest='top_level_diagnose_me',
        action='store_true',
        help='Print additional information for diagnosing issues.')

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
    compute = gcloud_compute
    if args.project is None:
        args.project = args.top_level_project
    if args.quiet is None:
        args.quiet = args.top_level_quiet
    if args.verbosity is None:
        args.verbosity = args.top_level_verbosity
    if args.zone is None:
        args.zone = args.top_level_zone
    if args.diagnose_me is None:
        args.diagnose_me = args.top_level_diagnose_me

    gcloud_version_json = subprocess.check_output([
        gcloud_cmd, 'version', '--format=json']).strip()
    component_versions = json.loads(gcloud_version_json)
    sdk_version = component_versions.get(sdk_core_component, 'UNKNOWN')
    datalab_version = component_versions.get(datalab_component, 'UNKNOWN')

    if args.diagnose_me:
        if args.verbosity is 'default':
            args.verbosity = 'debug'
        print('Running with diagnostic messages enabled')
        print('Using the command "{}" to invoke gcloud'.format(gcloud_cmd))
        print('The installed gcloud version is:'
              '\n\tCloud SDK: {}\n\tDatalab: {}'.format(
                  sdk_version, datalab_version))

    if utils.print_warning_messages(args):
        report_known_issues(sdk_version, datalab_version)

    gcloud_zone = ""
    if args.subcommand == 'beta':
        subcommand = _BETA_SUBCOMMANDS[args.beta_subcommand]
        compute = gcloud_beta_compute
    else:
        subcommand = _SUBCOMMANDS[args.subcommand]
    try:
        if subcommand['require-zone']:
            gcloud_zone = get_gcloud_zone()
        subcommand['run'](
            args, compute, gcloud_repos=gcloud_repos,
            email=get_email_address(),
            in_cloud_shell=('DEVSHELL_CLIENT_PORT' in os.environ),
            gcloud_zone=gcloud_zone,
            sdk_version=sdk_version, datalab_version=datalab_version)
    except subprocess.CalledProcessError as e:
        if utils.print_debug_messages(args):
            print('A nested call to gcloud failed.')
            print('Command: ["' + '","'.join(e.cmd) + '"]')
            print('Return code: ' + str(e.returncode))
            if e.output:
                print('Output: ' + str(e.output))
        else:
            print('A nested call to gcloud failed, '
                  'use --verbosity=debug for more info.')
    except Exception as e:
        if utils.print_debug_messages(args):
            traceback.print_exc(e)
        print(e)


if __name__ == '__main__':
    run()
