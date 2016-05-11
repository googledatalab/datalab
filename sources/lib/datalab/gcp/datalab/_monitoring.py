# Copyright 2015 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License. You may obtain a copy of
# the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations under
# the License.

"""IPython Functionality for the Google Monitoring API."""

import collections
import fnmatch

import gcp.stackdriver.monitoring as gcm
import _commands
import _html
import _utils

try:
  import IPython
  import IPython.core.display
  import IPython.core.magic
except ImportError:
  raise Exception('This module can only be loaded in ipython.')


@IPython.core.magic.register_line_magic
def monitoring(line):
  """Implements the monitoring line magic for ipython notebooks.

  Args:
    line: the contents of the storage line.
  Returns:
    The results of executing the cell.
  """
  parser = _commands.CommandParser(prog='monitoring', description=(
      'Execute various Monitoring-related operations. Use "%monitoring '
      '<command> -h" for help on a specific command.'))

  list_parser = parser.subcommand(
      'list', 'List the metrics or resource types in a monitored project.')

  list_metric_parser = list_parser.subcommand(
      'metrics',
      'List the metrics that are available through the Monitoring API.')
  list_metric_parser.add_argument(
      '-t', '--type',
      help='The type of metric(s) to list; can include wildchars.')
  list_metric_parser.add_argument(
      '-p', '--project', help='The project on which to execute the request.')
  list_metric_parser.set_defaults(func=_list_metric_descriptors)

  list_resource_parser = list_parser.subcommand(
      'resource_types',
      ('List the monitored resource types that are available through the '
       'Monitoring API.'))
  list_resource_parser.add_argument(
      '-p', '--project', help='The project on which to execute the request.')
  list_resource_parser.add_argument(
      '-t', '--type',
      help='The resource type(s) to list; can include wildchars.')
  list_resource_parser.set_defaults(func=_list_resource_descriptors)

  return _utils.handle_magic_line(line, None, parser)


def _list_resource_descriptors(args, _):
  """Lists the resource descriptors in the project."""
  project_id = args['project']
  pattern = args['type'] or '*'
  data = [
      collections.OrderedDict([
          ('Resource type', resource.type),
          ('Labels', ', '. join([l.key for l in resource.labels])),
      ])
      for resource in gcm._utils.list_resource_descriptors(project_id)
      if fnmatch.fnmatch(resource.type, pattern)
  ]
  return IPython.core.display.HTML(_html.HtmlBuilder.render_table(data))


def _list_metric_descriptors(args, _):
  """Lists the metric descriptors in the project."""
  project_id = args['project']
  pattern = args['type'] or '*'
  data = [
      collections.OrderedDict([
          ('Metric type', metric.type),
          ('Kind', metric.metric_kind),
          ('Value', metric.value_type),
          ('Labels', ', '. join([l.key for l in metric.labels])),
      ])
      for metric in gcm._utils.list_metric_descriptors(project_id)
      if fnmatch.fnmatch(metric.type, pattern)
  ]
  return IPython.core.display.HTML(_html.HtmlBuilder.render_table(data))
