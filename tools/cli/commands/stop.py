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

"""Methods for implementing the `datalab stop` command."""

import utils


description = ("""`{0} {1}` stops the given Datalab instance's
Google Compute Engine VM.""")


def flags(parser):
    """Add command line flags for the `stop` subcommand.

    Args:
      parser: The argparse parser to which to add the flags.
    """
    parser.add_argument(
        'instance',
        metavar='NAME',
        help='name of the instance to stop')
    return


def run(args, gcloud_compute, **unused_kwargs):
    """Implementation of the `datalab stop` subcommand.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
    Raises:
      subprocess.CalledProcessError: If a nested `gcloud` calls fails
    """
    instance = args.instance
    utils.maybe_prompt_for_zone(args, gcloud_compute, instance)

    print('Stopping {0}'.format(instance))
    base_cmd = ['instances', 'stop']
    if args.zone:
        base_cmd.extend(['--zone', args.zone])
    gcloud_compute(args, base_cmd + [instance])
    return
