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

"""Utility functions."""

try:
  import IPython
  import IPython.core.display
except ImportError:
  raise Exception('This module can only be loaded in ipython.')

import json
import pandas
try:
  # Pandas profiling is not needed for build/test but will be in the container.
  import pandas_profiling
except ImportError:
  pass
import sys
import types
import yaml

import datalab.data
import datalab.bigquery
import datalab.storage
import datalab.utils

import _html


def notebook_environment():
  """ Get the IPython user namespace. """
  ipy = IPython.get_ipython()
  return ipy.user_ns


def get_notebook_item(name):
  """ Get an item from the IPython environment. """
  env = notebook_environment()
  return datalab.utils.get_item(env, name)


def render_list(data):
  return IPython.core.display.HTML(_html.HtmlBuilder.render_list(data))


def render_dictionary(data, headers=None):
  """ Return a dictionary list formatted as a HTML table.

  Args:
    data: the dictionary list
    headers: the keys in the dictionary to use as table columns, in order.
  """
  return IPython.core.display.HTML(_html.HtmlBuilder.render_table(data, headers))


def render_text(text, preformatted=False):
  """ Return text formatted as a HTML

  Args:
    text: the text to render
    preformatted: whether the text should be rendered as preformatted
  """
  return IPython.core.display.HTML(_html.HtmlBuilder.render_text(text, preformatted))


def get_field_list(fields, schema):
  """ Convert a field list spec into a real list of field names.

      For tables, we return only the top-level non-RECORD fields as Google charts
      can't handle nested data.
  """
  # If the fields weren't supplied get them from the schema.
  if isinstance(fields, list):
    return fields
  if isinstance(fields, basestring) and fields != '*':
    return fields.split(',')
  if not schema:
    return []
  return [f['name'] for f in schema._bq_schema if f['type'] != 'RECORD']


def _get_cols(fields, schema):
  """ Get column metadata for Google Charts based on field list and schema. """
  typemap = {
    'STRING': 'string',
    'INTEGER': 'number',
    'FLOAT': 'number',
    'BOOLEAN': 'boolean',
    'TIMESTAMP': 'datetime'
  }
  cols = []
  for col in fields:
    if schema:
      f = schema[col]
      cols.append({'id': f.name, 'label': f.name, 'type': typemap[f.data_type]})
    else:
      # This will only happen if we had no rows to infer a schema from, so the type
      # is not really important, except that GCharts will choke if we pass such a schema
      # to a chart if it is string x string so we default to number.
      cols.append({'id': col, 'label': col, 'type': 'number'})
  return cols


def _get_data_from_empty_list(source, fields='*', first_row=0, count=-1, schema=None):
  """ Helper function for _get_data that handles empty lists. """
  fields = get_field_list(fields, schema)
  return {'cols': _get_cols(fields, schema), 'rows': []}, 0


def _get_data_from_list_of_dicts(source, fields='*', first_row=0, count=-1, schema=None):
  """ Helper function for _get_data that handles lists of dicts. """
  if schema is None:
    schema = datalab.bigquery.Schema.from_data(source)
  fields = get_field_list(fields, schema)
  gen = source[first_row:first_row + count] if count >= 0 else source
  rows = [{'c': [{'v': row[c]} if c in row else {} for c in fields]} for row in gen]
  return {'cols': _get_cols(fields, schema), 'rows': rows}, len(source)


def _get_data_from_list_of_lists(source, fields='*', first_row=0, count=-1, schema=None):
  """ Helper function for _get_data that handles lists of lists. """
  if schema is None:
    schema = datalab.bigquery.Schema.from_data(source)
  fields = get_field_list(fields, schema)
  gen = source[first_row:first_row + count] if count >= 0 else source
  cols = [schema.find(name) for name in fields]
  rows = [{'c': [{'v': row[i]} for i in cols]} for row in gen]
  return {'cols': _get_cols(fields, schema), 'rows': rows}, len(source)


def _get_data_from_dataframe(source, fields='*', first_row=0, count=-1, schema=None):
  """ Helper function for _get_data that handles Pandas DataFrames. """
  if schema is None:
    schema = datalab.bigquery.Schema.from_data(source)
  fields = get_field_list(fields, schema)
  rows = []
  if count < 0:
    count = len(source.index)
  df_slice = source.reset_index(drop=True)[first_row:first_row + count]
  for index, data_frame_row in df_slice.iterrows():
    row = data_frame_row.to_dict()
    for key in row.keys():
      val = row[key]
      if isinstance(val, pandas.Timestamp):
        row[key] = val.to_pydatetime()

    rows.append({'c': [{'v': row[c]} if c in row else {} for c in fields]})
  cols = _get_cols(fields, schema)
  return {'cols': cols, 'rows': rows}, len(source)


def _get_data_from_table(source, fields='*', first_row=0, count=-1, schema=None):
  """ Helper function for _get_data that handles BQ Tables. """
  if not source.exists():
    return _get_data_from_empty_list(source, fields, first_row, count)
  if schema is None:
    schema = source.schema
  fields = get_field_list(fields, schema)
  gen = source.range(first_row, count) if count >= 0 else source
  rows = [{'c': [{'v': row[c]} if c in row else {} for c in fields]} for row in gen]
  return {'cols': _get_cols(fields, schema), 'rows': rows}, source.length


def get_data(source, fields='*', env=None, first_row=0, count=-1, schema=None):
  """ A utility function to get a subset of data from a Table, Query, Pandas dataframe or List.

  Args:
    source: the source of the data. Can be a Table, Pandas DataFrame, List of dictionaries or
        lists, or a string, in which case it is expected to be the name of a table in BQ.
    fields: a list of fields that we want to return as a list of strings, comma-separated string,
        or '*' for all.
    env: if the data source is a Query module, this is the set of variable overrides for
        parameterizing the Query.
    first_row: the index of the first row to return; default 0. Onl;y used if count is non-negative.
    count: the number or rows to return. If negative (the default), return all rows.
    schema: the schema of the data. Optional; if supplied this can be used to help do type-coercion.

  Returns:
    A tuple consisting of a dictionary and a count; the dictionary has two entries: 'cols'
    which is a list of column metadata entries for Google Charts, and 'rows' which is a list of
    lists of values. The count is the total number of rows in the source (independent of the
    first_row/count parameters).

  Raises:
    Exception if the request could not be fulfilled.
  """

  if env is None:
    env = {}
  if isinstance(source, basestring):
    ipy = IPython.get_ipython()
    source = datalab.utils.get_item(ipy.user_ns, source, source)
    if isinstance(source, basestring):
      source = datalab.bigquery.Table(source)

  if isinstance(source, types.ModuleType) or isinstance(source, datalab.data.SqlStatement):
    source = datalab.bigquery.Query(source, values=env)

  if isinstance(source, list):
    if len(source) == 0:
      return _get_data_from_empty_list(source, fields, first_row, count, schema)
    elif isinstance(source[0], dict):
      return _get_data_from_list_of_dicts(source, fields, first_row, count, schema)
    elif isinstance(source[0], list):
      return _get_data_from_list_of_lists(source, fields, first_row, count, schema)
    else:
      raise Exception("To get tabular data from a list it must contain dictionaries or lists.")
  elif isinstance(source, pandas.DataFrame):
    return _get_data_from_dataframe(source, fields, first_row, count, schema)
  elif isinstance(source, datalab.bigquery.Query):
    return _get_data_from_table(source.results(), fields, first_row, count, schema)
  elif isinstance(source, datalab.bigquery.Table):
    return _get_data_from_table(source, fields, first_row, count, schema)
  else:
    raise Exception("Cannot chart %s; unsupported object type" % source)


def handle_magic_line(line, cell, parser, namespace=None):
  """ Helper function for handling magic command lines given a parser with handlers set. """
  args = parser.parse(line, namespace)
  if args:
    try:
      return args.func(vars(args), cell)
    except Exception as e:
      sys.stderr.write(str(e))
      sys.stderr.write('\n')
      sys.stderr.flush()
  return None


def expand_var(v, env):
  """ If v is a variable reference (for example: '$myvar'), replace it using the supplied
      env dictionary.

  Args:
    v: the variable to replace if needed.
    env: user supplied dictionary.

  Raises:
    Exception if v is a variable reference but it is not found in env.
  """
  if len(v) == 0:
    return v
  # Using len() and v[0] instead of startswith makes this Unicode-safe.
  if v[0] == '$':
    v = v[1:]
    if len(v) and v[0] != '$':
      if v in env:
        v = env[v]
      else:
        raise Exception('Cannot expand variable $%s' % v)
  return v


def replace_vars(config, env):
  """ Replace variable references in config using the supplied env dictionary.

  Args:
    config: the config to parse. Can be a tuple, list or dict.
    env: user supplied dictionary.

  Raises:
    Exception if any variable references are not found in env.
  """
  if isinstance(config, dict):
    for k, v in config.items():
      if isinstance(v, dict) or isinstance(v, list) or isinstance(v, tuple):
        replace_vars(v, env)
      elif isinstance(v, basestring):
        config[k] = expand_var(v, env)
  elif isinstance(config, list):
    for i, v in enumerate(config):
      if isinstance(v, dict) or isinstance(v, list) or isinstance(v, tuple):
        replace_vars(v, env)
      elif isinstance(v, basestring):
        config[i] = expand_var(v, env)
  elif isinstance(config, tuple):
    # TODO(gram): figure out how to handle these if the tuple elements are scalar
    for v in config:
      if isinstance(v, dict) or isinstance(v, list) or isinstance(v, tuple):
        replace_vars(v, env)


def parse_config(config, env, as_dict=True):
  """ Parse a config from a magic cell body. This could be JSON or YAML. We turn it into
      a Python dictionary then recursively replace any variable references using the supplied
      env dictionary.
  """

  if config is None:
    return None
  stripped = config.strip()
  if len(stripped) == 0:
    config = {}
  elif stripped[0] == '{':
    config = json.loads(config)
  else:
    config = yaml.load(config)
  if as_dict:
    config = dict(config)

  # Now we need to walk the config dictionary recursively replacing any '$name' vars.
  replace_vars(config, env)
  return config


def validate_config(config, required_keys, optional_keys=None):
  """ Validate a config dictionary to make sure it includes all required keys
      and does not include any unexpected keys.

  Args:
    config: the config to validate.
    required_keys: the names of the keys that the config must have.
    optional_keys: the names of the keys that the config can have.

  Raises:
    Exception if the config is not a dict or invalid.
  """
  if optional_keys is None:
    optional_keys = []
  if not isinstance(config, dict):
    raise Exception('config is not dict type')
  invalid_keys = set(config) - set(required_keys + optional_keys)
  if len(invalid_keys) > 0:
    raise Exception('Invalid config with unexpected keys "%s"'
        % ', '.join(e for e in invalid_keys))
  missing_keys = set(required_keys) - set(config)
  if len(missing_keys) > 0:
    raise Exception('Invalid config with missing keys "%s"' % ', '.join(missing_keys))


def validate_config_must_have(config, required_keys):
  """ Validate a config dictionary to make sure it has all of the specified keys

  Args:
    config: the config to validate.
    required_keys: the list of possible keys that config must include.

  Raises:
    Exception if the config does not have any of them.
  """
  missing_keys = set(required_keys) - set(config)
  if len(missing_keys) > 0:
    raise Exception('Invalid config with missing keys "%s"' % ', '.join(missing_keys))


def validate_config_has_one_of(config, one_of_keys):
  """ Validate a config dictionary to make sure it has one and only one
      key in one_of_keys.

  Args:
    config: the config to validate.
    one_of_keys: the list of possible keys that config can have one and only one.

  Raises:
    Exception if the config does not have any of them, or multiple of them.
  """
  intersection = set(config).intersection(one_of_keys)
  if len(intersection) > 1:
    raise Exception('Only one of the values in "%s" is needed' % ', '.join(intersection))
  if len(intersection) == 0:
    raise Exception('One of the values in "%s" is needed' % ', '.join(one_of_keys))


def validate_config_value(value, possible_values):
  """ Validate a config value to make sure it is one of the possible values.

  Args:
    value: the config value to validate.
    possible_values: the possible values the value can be

  Raises:
    Exception if the value is not one of possible values.
  """
  if value not in possible_values:
    raise Exception('Invalid config value "%s". Possible values are %s'
        % (value, ', '.join(e for e in possible_values)))


# For chart and table HTML viewers, we use a list of table names and reference
# instead the indices in the HTML, so as not to include things like projectID, etc,
# in the HTML.

_data_sources = []


def get_data_source_index(name):
  if name not in _data_sources:
    _data_sources.append(name)
  return _data_sources.index(name)


def validate_gcs_path(path, require_object):
  """ Check whether a given path is a valid GCS path.

  Args:
    path: the config to check.
    require_object: if True, the path has to be an object path but not bucket path.

  Raises:
    Exception if the path is invalid
  """
  bucket, key = datalab.storage._bucket.parse_name(path)
  if bucket is None:
    raise Exception('Invalid GCS path "%s"' % path)
  if require_object and key is None:
    raise Exception('It appears the GCS path "%s" is a bucket path but not an object path' % path)


def parse_control_options(controls, variable_defaults=None):
  """ Parse a set of control options.

  Args:
    controls: The dictionary of control options.
    variable_defaults: If the controls are for a Query with variables, then this is the
        default variable values defined in the Query module. The options in the controls
        parameter can override these but if a variable has no 'value' property then we
        fall back to these.

  Returns:
    - the HTML for the controls.
    - the default values for the controls as a dict.
    - the list of DIV IDs of the controls.

  """
  controls_html = ''
  control_defaults = {}
  control_ids = []
  div_id = _html.Html.next_id()
  if variable_defaults is None:
    variable_defaults = {}
  for varname, control in controls.items():
    label = control.get('label', varname)
    control_id = div_id + '__' + varname
    control_ids.append(control_id)
    value = control.get('value', variable_defaults.get(varname, None))
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
      control_html = "{label}<select disabled id=\"{id}\">{choices}</select>" \
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
      control_ids[-1] = '%s:%d' % (control_id, len(choices))  # replace ID to include count.
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
      min_ = control.get('min', None)
      max_ = control.get('max', None)
      if min_ is None or max_ is None:
        raise Exception('slider control must specify a min and max value')
      if max_ <= min_:
        raise Exception('slider control must specify a min value less than max value')
      step = control.get('step', 1 if isinstance(min_, int) and isinstance(max_, int)
                         else (max_ - min_) / 10.0)
      if value is None:
        value = min_
      control_html = """
        {label}
        <input type="text" class="gchart-slider_value" id="{id}_value" value="{value}" disabled/>
        <input type="range" class="gchart-slider" id="{id}" min="{min}" max="{max}" step="{step}"
            value="{value}" disabled/>
      """.format(label=label, id=control_id, value=value, min=min_, max=max_, step=step)
    elif type == 'textbox':
      if value is None:
        value = ''
      control_html = "{label}<input type=\"text\" value=\"{value}\" id=\"{id}\" disabled/>" \
          .format(label=label, value=value, id=control_id)
    else:
      raise Exception(
          'Unknown control type %s (expected picker, slider, checkbox, textbox or set)' % type)

    control_defaults[varname] = value
    controls_html += "<div class=\"gchart-control\">{control}</div>\n" \
        .format(control=control_html)

  controls_html = "<div class=\"gchart-controls\">{controls}</div>".format(controls=controls_html)
  return controls_html, control_defaults, control_ids


def chart_html(driver_name, chart_type, source, chart_options=None, fields='*', refresh_interval=0,
               refresh_data=None, control_defaults=None, control_ids=None, schema=None):
  """ Return HTML for a chart.

  Args:
    driver_name: the name of the chart driver. Currently we support 'plotly' or 'gcharts'.
    chart_type: string specifying type of chart.
    source: the data source for the chart. Can be actual data (e.g. list) or the name of
        a data source (e.g. the name of a query module).
    chart_options: a dictionary of options for the chart. Can contain a 'controls' entry
        specifying controls. Other entries are passed as JSON to Google Charts.
    fields: the fields to chart. Can be '*' for all fields (only sensible if the columns are
        ordered; e.g. a Query or list of lists, but not a list of dictionaries); otherwise a
        string containing a comma-separated list of field names.
    refresh_interval: a time in seconds after which the chart data will be refreshed. 0 if the
        chart should not be refreshed (i.e. the data is static).
    refresh_data: if the source is a list or other raw data, this is a YAML string containing
        metadata needed to support calls to refresh (get_chart_data).
    control_defaults: the default variable values for controls that are shared across charts
        including this one.
    control_ids: the DIV IDs for controls that are shared across charts including this one.
    schema: an optional schema for the data; if not supplied one will be inferred.

  Returns:
    A string containing the HTML for the chart.

  """
  div_id = _html.Html.next_id()
  controls_html = ''
  if control_defaults is None:
    control_defaults = {}
  if control_ids is None:
    control_ids = []
  if chart_options is not None and 'variables' in chart_options:
    controls = chart_options['variables']
    del chart_options['variables']  # Just to make sure GCharts doesn't see them.
    try:
      item = get_notebook_item(source)
      _, variable_defaults = datalab.data.SqlModule.get_sql_statement_with_environment(item, '')
    except Exception:
      variable_defaults = {}
    controls_html, defaults, ids = parse_control_options(controls, variable_defaults)
    # We augment what we are passed so that in principle we can have controls that are
    # shared by charts as well as controls that are specific to a chart.
    control_defaults.update(defaults)
    control_ids.extend(ids),

  _HTML_TEMPLATE = """
    <div class="bqgc-container">
      {controls}
      <div class="bqgc {extra_class}" id="{id}">
      </div>
    </div>
    <script>

      require.config({{
        paths: {{
          d3: '//cdnjs.cloudflare.com/ajax/libs/d3/3.4.13/d3',
          plotly: 'https://cdn.plot.ly/plotly-1.5.1.min.js?noext',
          jquery: '//ajax.googleapis.com/ajax/libs/jquery/2.0.0/jquery.min'
        }},
        map: {{
          '*': {{
            datalab: 'nbextensions/gcpdatalab'
          }}
        }},
        shim: {{
          plotly: {{
            deps: ['d3', 'jquery'],
            exports: 'plotly'
          }}
        }}
      }});

      require(['datalab/charting',
               'datalab/element!{id}',
               'base/js/events',
               'datalab/style!/nbextensions/gcpdatalab/charting.css'
              ],
        function(charts, dom, events) {{
          charts.render(
              '{driver}',
              dom,
              events,
              '{chart_type}',
              {control_ids},
              {data},
              {options},
              {refresh_data},
              {refresh_interval},
              {total_rows});
          }}
        );
    </script>
  """
  count = 25 if chart_type == 'paged_table' else -1
  data, total_count = get_data(source, fields, control_defaults, 0, count, schema)
  if refresh_data is None:
    if isinstance(source, basestring):
      source_index = get_data_source_index(source)
      refresh_data = {'source_index': source_index, 'name': source_index}
    else:
      refresh_data = {'name': 'raw data'}
  refresh_data['fields'] = fields

  # TODO(gram): check if we need to augment env with user_ns
  return _HTML_TEMPLATE \
      .format(driver=driver_name,
              controls=controls_html,
              id=div_id,
              chart_type=chart_type,
              extra_class=" bqgc-controlled" if len(controls_html) else '',
              data=json.dumps(data, cls=datalab.utils.JSONEncoder),
              options=json.dumps(chart_options, cls=datalab.utils.JSONEncoder),
              refresh_data=json.dumps(refresh_data, cls=datalab.utils.JSONEncoder),
              refresh_interval=refresh_interval,
              control_ids=str(control_ids),
              total_rows=total_count)


def profile_df(df):
  """ Generate a profile of data in a dataframe.

  Args:
    df: the Pandas dataframe.
  """
  # The bootstrap CSS messes up the Datalab display so we tweak it to not have an effect.
  # TODO(gram): strip it out rather than this kludge.
  return IPython.core.display.HTML(
      pandas_profiling.ProfileReport(df).html.replace('bootstrap', 'nonexistent'))
