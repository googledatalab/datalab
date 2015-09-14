# Copyright 2014 Google Inc. All rights reserved.
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

"""Google Cloud Platform library - Chart cell magic."""

import json
import IPython
import IPython.core.display
import IPython.core.magic
import gcp._util
import _commands
import _html
import _utils


@IPython.core.magic.register_line_cell_magic
def chart(line, cell=None):
  """ Generate charts with Google Charts. Use %chart --help for more details. """
  parser = _commands.CommandParser.create('chart')
  for chart_type in ['annotation', 'area', 'bars', 'bubbles', 'calendar', 'candlestick', 'columns',
                     'combo', 'gauge', 'geo', 'histogram', 'line', 'map', 'org', 'paged_table',
                     'pie', 'sankey', 'scatter', 'stepped_area', 'table', 'timeline', 'treemap']:
    subparser = parser.subcommand(chart_type, 'generate a %s chart' % chart_type)
    subparser.add_argument('-f', '--field',
                           help='the field(s) to include in the chart')
    subparser.add_argument('data',
                           help='the name of the variable referencing the Table or Query to chart')
    subparser.set_defaults(chart=chart_type)

  parser.set_defaults(func=_chart_cell)
  return _utils.handle_magic_line(line, cell, parser)


def _chart_cell(args, cell):
  chart_options = cell if cell and len(cell.strip()) else '{}'
  fields = args['field'] if args['field'] else '*'

  _HTML_TEMPLATE = """
    <div class="bqgc" id="%s">
    </div>
    <script>
          require(['extensions/charting', 'element!%s'%s],
              function(charts, dom) {
                  charts.render(dom, {chartStyle:'%s', dataName:'%s', fields:'%s'}, %s, %s);
              }
          );
    </script>
  """
  div_id = _html.Html.next_id()
  source = args['data']
  chart_type = args['chart']
  count = 25 if chart_type == 'paged_table' else -1
  data, _ = _utils.get_data(source, fields, 0, count)
  return IPython.core.display.HTML(
    _HTML_TEMPLATE % (div_id, div_id, _html.Html.get_style_arg('charting.css'), chart_type, source,
                      fields, chart_options, json.dumps(data, cls=gcp._util.JSONEncoder)))


@IPython.core.magic.register_line_magic
def _get_chart_data(line):
  try:
    args = line.strip().split()
    source = args[0]
    fields = args[1]
    first_row = int(args[2]) if len(args) > 2 else 0
    count = int(args[3]) if len(args) > 3 else -1
    data, _ = _utils.get_data(source, fields, first_row, count)
  except Exception, e:
    gcp._util.print_exception_with_last_stack(e)
    data = {}

  return IPython.core.display.JSON(json.dumps({'data': data}, cls=gcp._util.JSONEncoder))
