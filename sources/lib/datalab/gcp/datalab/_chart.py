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

import json
import IPython
import IPython.core.display
import IPython.core.magic
import gcp._util
import gcp.data
import _commands
import _html
import _utils


@IPython.core.magic.register_line_cell_magic
def chart(line, cell=None):
  """ Generate charts with Google Charts. Use %chart --help for more details.

  Args:
    line: the %chart magic line.
    cell: the contents of the cell. Can contain YAML chart options.
  """
  parser = _commands.CommandParser(prog='%%chart', description="""
Generate an inline chart using Google Charts using the data in a Table, Query, dataframe, or list.
Numerous types of charts are supported. Options for the charts can be specified in the cell body
using YAML or JSON.
""")
  for chart_type in ['annotation', 'area', 'bars', 'bubbles', 'calendar', 'candlestick', 'columns',
                     'combo', 'gauge', 'geo', 'histogram', 'line', 'map', 'org', 'paged_table',
                     'pie', 'sankey', 'scatter', 'stepped_area', 'table', 'timeline', 'treemap']:
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
  fields = args['fields'] if args['fields'] else '*'
  div_id = _html.Html.next_id()
  env = {}
  controls_html = ''
  controls_ids = []
  if 'variables' in chart_options:
    variables = chart_options['variables']
    del chart_options['variables']  # Just to make sure GCharts doesn't see them.
    try:
      item = _utils.get_notebook_item(source)
      _, defaults = gcp.data.SqlModule.get_sql_statement_with_environment(item, '')
    except Exception:
      defaults = {}
    for varname, control in variables.items():
      label = control.get('label', varname)
      control_id = div_id + '__' + varname
      controls_ids.append(control_id)
      value = control.get('value', defaults.get(varname, None))
      # The user should usually specify the type but we will default to 'textbox' for strings
      # and 'set' for lists.
      if isinstance(value, basestring):
        type = 'textbox'
      elif isinstance(value, list):
        type = 'set'
      else:
        type = None
      type = control.get('type', type)

      if type == 'picker':
        choices = control.get('choices', value)
        if not isinstance(choices, list) or len(choices) == 0:
          raise Exception('picker control must specify a nonempty set of choices')
        if value is None:
          value = choices[0]
        choices_html = ''
        for i, choice in enumerate(choices):
          choices_html += "<option value=\"%s\" %s>%s</option>" % \
              (choice, ("selected=\"selected\"" if choice == value else ''), choice)
        control_html = "{label}<select disabled id=\"{id}\">{choices}</select>"\
            .format(label=label, id=control_id, choices=choices_html)
      elif type == 'set':  # Multi-picker; implemented as checkboxes.
        # TODO(gram): consider using "name" property of the control to group checkboxes. That
        # way we can save the code of constructing and parsing control Ids with sequential
        #  numbers in it. Multiple checkboxes can share the same name.
        choices = control.get('choices', value)
        if not isinstance(choices, list) or len(choices) == 0:
          raise Exception('set control must specify a nonempty set of choices')
        if value is None:
          value = choices
        choices_html = ''
        controls_ids[-1] = '%s:%d' % (control_id, len(choices))  # replace ID to include count.
        for i, choice in enumerate(choices):
          checked = choice in value
          choice_id = '%s:%d' % (control_id, i)
          # TODO(gram): we may want a 'Submit/Refresh button as we may not want to rerun
          # query on each checkbox change.
          choices_html += """
            <div>
              <label>
                <input type="checkbox" id="{id}" value="{choice}" {checked} disabled>
                {choice}
              </label>
            </div>
          """.format(id=choice_id, choice=choice, checked="checked" if checked else '')
        control_html = "{label}<div>{choices}</div>".format(label=label, choices=choices_html)
      elif type == 'checkbox':
        control_html = """
              <label>
                <input type="checkbox" id="{id}" {checked} disabled>
                {label}
              </label>
          """.format(label=label, id=control_id, checked="checked" if value else '')
      elif type == 'slider':
        min = control.get('min', None)
        max = control.get('max', None)
        if min is None or max is None:
          raise Exception('slider control must specify a min and max value')
        if max <= min:
          raise Exception('slider control must specify a min value less than max value')
        step = control.get('step', 1 if isinstance(min, int) and isinstance(max, int)
            else (max - min) / 10.0)
        if value is None:
          value = min
        control_html = """
          {label}
          <input type="text" class="gchart-slider_value" id="{id}_value" value="{value}" disabled/>
          <input type="range" class="gchart-slider" id="{id}" min="{min}" max="{max}" step="{step}"
              value="{value}" disabled/>
        """.format(label=label, id=control_id, value=value, min=min, max=max, step=step)
      elif type == 'textbox':
        if value is None:
          value = ''
        control_html = "{label}<input type=\"text\" value=\"{value}\" id=\"{id}\" disabled/>"\
            .format(label=label, value=value, id=control_id)
      else:
        raise Exception(
            'Unknown control type %s (expected picker, slider, checkbox, textbox or set)' % type)

      env[varname] = value
      controls_html += "<div class=\"gchart-control\">{control}</div>\n"\
          .format(control=control_html)

    controls_html = "<div class=\"gchart-controls\">{controls}</div>".format(controls=controls_html)

  _HTML_TEMPLATE = """
    <div class="bqgc-container">
      {controls}
      <div class="bqgc{extra_class}" id="{id}">
      </div>
    </div>
    <script>
      require(['extensions/charting', 'element!{id}', 'style!/static/extensions/charting.css'],
        function(charts, dom) {{
          charts.render(dom, {{chartStyle:'{chart_type}', dataName:'{source}', fields:'{fields}'}},
            {options}, {data}, {control_ids});
        }}
      );
    </script>
  """

  chart_type = args['chart']
  count = 25 if chart_type == 'paged_table' else -1
  data, _ = _utils.get_data(source, fields, env, 0, count)

  # TODO(gram): check if we need to augment env with user_ns
  return IPython.core.display.HTML(
    _HTML_TEMPLATE.format(controls=controls_html,
                      id=div_id,
                      chart_type=chart_type,
                      extra_class=" bqgc-controlled" if len(controls_html) else '',
                      source=_utils.get_data_source_index(source),
                      fields=fields,
                      options=json.dumps(chart_options, cls=gcp._util.JSONEncoder),
                      data=json.dumps(data, cls=gcp._util.JSONEncoder),
                      control_ids=str(controls_ids)))


@IPython.core.magic.register_cell_magic
def _get_chart_data(line, cell_body=''):
  try:
    args = line.strip().split()
    source = _utils._data_sources[int(args[0])]
    fields = args[1]
    first_row = int(args[2]) if len(args) > 2 else 0
    count = int(args[3]) if len(args) > 3 else -1
    env = _utils.parse_config(cell_body, IPython.get_ipython().user_ns)
    data, _ = _utils.get_data(source, fields, env, first_row, count)
  except Exception, e:
    gcp._util.print_exception_with_last_stack(e)
    data = {}

  # TODO(gram): The old way - commented out below - has the advantage that it worked
  # for datetimes, but it is strictly wrong. The correct way below may have issues if the
  # chart has datetimes though so test this.
  return IPython.core.display.JSON({'data': data})
  #return IPython.core.display.JSON(json.dumps({'data': data}, cls=gcp._util.JSONEncoder))
