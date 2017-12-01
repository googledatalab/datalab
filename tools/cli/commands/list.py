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

"""Methods for implementing the `datalab list` command."""


_FILTER_HELP = ("""Apply a Boolean filter EXPRESSION to each resource item
to be listed.

If the expression evaluates True then that item is listed.
For more details run `gcloud topic filters`.""")


_ZONES_HELP = """List of zones to which to limit the resulting list."""


description = ("""`{0} {1}` displays the Datalab instances running in Google
Compute Engine VM's in a project.

By default, instances from all zones are listed. The results
can be narrowed down by providing the --zones flag.""")


examples = ("""
To list all of the available Datalab instances in a project:

    $ {0} {1}

To only list the Datalab instances in the zones
'us-central1-a' and  'us-central1-b':

    $ {0} {1} --zones us-central1-a,us-central1-b

To only list the Datalab instances that are currently running:

    $ {0} {1} --filter 'status=RUNNING'
""")


def flags(parser):
    """Add command line flags for the `list` subcommand.

    Args:
      parser: The argparse parser to which to add the flags.
    """
    parser.add_argument(
        '--filter',
        dest='filter',
        default=None,
        help=_FILTER_HELP)
    parser.add_argument(
        '--zones',
        dest='zones',
        nargs='*',
        default=[],
        help=_ZONES_HELP)
    return


def _filter(args):
    """Construct the value for the '--filter' flag to gcloud.

    Args:
      args: The Namespace instance returned by argparse
    Returns:
      A string suitable for passing to the `gcloud` command
    """
    filter_expr = 'tags.items=\'{0}\''.format('datalab')
    zones = args.zones or []
    if args.zone:
        zones.append(args.zone)
    if zones:
        zones_filter = "zone:({0})".format(" ".join(zones))
        filter_expr = '({0}) ({1})'.format(filter_expr, zones_filter)
    if args.filter:
        filter_expr = '({0}) ({1})'.format(filter_expr, args.filter)
    return filter_expr


def run(args, gcloud_compute, **unused_kwargs):
    """Implementation of the `datalab list` subcommand.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
    Raises:
      subprocess.CalledProcessError: If a nested `gcloud` calls fails
    """
    filter_expr = _filter(args)
    base_cmd = ['instances', 'list']
    gcloud_compute(args, base_cmd + ['--filter', filter_expr])
