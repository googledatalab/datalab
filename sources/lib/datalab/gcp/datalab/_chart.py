# Copyright 2015 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
# in compliance with the License. You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the License
# is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
# or implied. See the License for the specific language governing permissions and limitations under
# the License.

"""Google Cloud Platform library - Chart cell magic."""

try:
  import IPython
  import IPython.core.display
  import IPython.core.magic
except ImportError:
  raise Exception('This module can only be loaded in ipython.')

import _commands
import _utils


@IPython.core.magic.register_line_cell_magic
def chart(line, cell=None):
  """ Generate charts with Google Charts. Use %chart --help for more details. """
  parser = _commands.CommandParser(prog='%%chart', description="""
Generate an inline chart using Google Charts using the data in a Table, Query, dataframe, or list.
Numerous types of charts are supported. Options for the charts can be specified in the cell body
using YAML or JSON.
""")
  for chart_type in ['annotation', 'area', 'bars', 'bubbles', 'calendar', 'candlestick', 'columns',
                     'combo', 'gauge', 'geo', 'heatmap', 'histogram', 'line', 'map', 'org',
                     'paged_table', 'pie', 'sankey', 'scatter', 'stepped_area', 'table',
                     'timeline', 'treemap']:
    subparser = parser.subcommand(chart_type,
        'Generate a %s chart.' % chart_type)
    subparser.add_argument('-f', '--fields',
                           help='The field(s) to include in the chart')
    subparser.add_argument('-d', '--data',
                           help='The name of the variable referencing the Table or Query to chart',
                           required=True)
    subparser.set_defaults(chart=chart_type)

  parser.set_defaults(func=_chart_cell)
  return _utils.handle_magic_line(line, cell, parser)


def _chart_cell(args, cell):
  source = args['data']
  ipy = IPython.get_ipython()
  chart_options = _utils.parse_config(cell, ipy.user_ns)
  if chart_options is None:
    chart_options = {}
  elif not isinstance(chart_options, dict):
    raise Exception("Could not parse chart options")
  chart_type = args['chart']
  fields = args['fields'] if args['fields'] else '*'
  return IPython.core.display.HTML(_utils.chart_html('gcharts', chart_type, source=source,
                                                     chart_options=chart_options, fields=fields))
