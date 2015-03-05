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

"""Google Cloud Platform library - BigQuery IPython Functionality."""

import argparse
from datetime import datetime
import json as _json
import re as _re
import time as _time
import gcp.bigquery as _bq
import gcp._util as _util
from ._html import HtmlBuilder as _HtmlBuilder

try:
  import IPython as _ipython
  import IPython.core.magic as _magic
except ImportError:
  raise Exception('This module can only be loaded in ipython.')

@_magic.register_cell_magic
def bigquery(line, cell):
  """Implements the bigquery cell magic for ipython notebooks.

  The supported syntax is:
  %%bigquery [<line>]
  <cell>

  Args:
    line: the contents of the %%bigquery line.
    cell: the contents of the cell.
  Returns:
    The results of executing the cell.
  """
  parser = argparse.ArgumentParser(prog='%%bigquery')
  subparsers = parser.add_subparsers(help='sub-commands')

  sql_parser = subparsers.add_parser('sql', help=
      'execute a BigQuery SQL statement or create a named query object')
  sql_parser.add_argument('-n', '--name', nargs=1, help='the name for this query object')
  sql_parser.set_defaults(func=lambda x: _sql_cell(vars(x), cell))

  udf_parser = subparsers.add_parser('udf', help='create a named Javascript UDF')
  udf_parser.add_argument('-n', '--name', nargs=1, help='the name for this UDF',
                          required=True)
  udf_parser.set_defaults(func=lambda x: _udf_cell(vars(x), cell))

  for p in [parser, sql_parser, udf_parser]:
    p.exit = _parser_exit  # raise exception, don't call sys.exit
    p.format_usage = p.format_help  # Show full help always

  args = filter(None, line.split())
  try:
    parser.parse_args(args)
  except Exception as e:
    pass


def _parser_exit(status=0, message=None):
  """ Replacement exit method for argument parser. We want to stop processing args but not
      call sys.exit(), so we raise an exception here and catch it in the call to parse_args.
  """
  raise Exception()


def _sql_cell(args, sql):
  """Implements the SQL bigquery cell magic for ipython notebooks.

  The supported syntax is:
  %%bigquery sql [--name <var>]
  <sql>

  Args:
    args: the optional arguments following '%%bigquery sql'.
    sql: the contents of the cell interpreted as the SQL.
  Returns:
    The results of executing the query converted to a dataframe if no variable
    was specified. None otherwise.
  """
  ipy = _ipython.get_ipython()

  # Use the user_ns dictionary, which contains all current declarations in
  # the kernel as the dictionary to use to retrieve values for placeholders
  # within the specified sql statement.
  sql = _bq.sql(sql, **ipy.user_ns)
  query = _bq.query(sql)

  variable_name = args['name']
  if len(variable_name):
    # Update the global namespace with the new variable, or update the value of
    # the existing variable if it already exists.
    ipy.push({variable_name: query})
    return None
  else:
    # If a variable was not specified, then simply return the results, so they
    # get rendered as the output of the cell.
    return query.results()


def _udf_cell(args, js):
  """Implements the bigquery_udf cell magic for ipython notebooks.

  The supported syntax is:
  %%bigquery udf --name <var>
  <js function>

  Args:
    args: the optional arguments following '%%bigquery udf'.
    declaration: the variable to initialize with the resulting UDF object.
    js: the UDF declaration (inputs and outputs) and implementation in javascript.
  Returns:
    The results of executing the UDF converted to a dataframe if no variable
    was specified. None otherwise.
  """
  ipy = _ipython.get_ipython()

  variable_name = args['name']
  if len(variable_name) == 0:
    raise Exception("Declaration must be of the form %%bigquery udf <variable name>")

  # Parse out the input and output specification
  spec_pattern = r'\{\{([^}]+)\}\}'
  spec_part_pattern = r'[a-z_][a-z0-9_]*'

  specs = _re.findall(spec_pattern, js)
  if len(specs) < 2:
    raise Exception('The JavaScript must declare the input row and output emitter parameters '
                    'using valid jsdoc format comments.\n'
                    'The input row param declaration must be typed as {{field:type, field2:type}} '
                    'and the output emitter param declaration must be typed as '
                    'function({{field:type, field2:type}}.')

  inputs = []
  input_spec_parts = _re.findall(spec_part_pattern, specs[0], flags=_re.IGNORECASE)
  if len(input_spec_parts) % 2 != 0:
    raise Exception('Invalid input row param declaration. The jsdoc type expression must '
                    'define an object with field and type pairs.')
  for n, t in zip(input_spec_parts[0::2], input_spec_parts[1::2]):
    inputs.append((n, t))

  outputs = []
  output_spec_parts = _re.findall(spec_part_pattern, specs[1], flags=_re.IGNORECASE)
  if len(output_spec_parts) % 2 != 0:
    raise Exception('Invalid output emitter param declaration. The jsdoc type expression must '
                    'define a function accepting an an object with field and type pairs.')
  for n, t in zip(output_spec_parts[0::2], output_spec_parts[1::2]):
    outputs.append((n, t))

  # Finally build the UDF object
  udf = _bq.udf(inputs, outputs, js)
  ipy.push({variable_name: udf})

  return None

# For our table viewer, we want a cache of table instances keyed on the ID used for the
# DOM elements. We key on the DOM element id rather than the table name so we can have
# multiple instances of the same table with different internal page caches.
# TODO(gram): consider moving page caching out of Table, in which case we can key this cache
# on the table name instead.

_table_cache = _util.LRUCache(10)


def _get_rows(table, start_row, count):
  """ Method to get some rows of the table as a tuple: list of column names and list of row data.

  Args:
    start_row: the first row to fetch.
    count: the (maximum) number of rows to fetch.

  Returns:
    A tuple containing a list of column names and a list of rows of data, where each row is
    itself a list.
  """
  max_rows = len(table)
  if start_row + count > max_rows:
    count = max_rows - start_row
  rows = [table[start_row + i] for i in range(0, count)]
  labels = []
  data = []
  if len(rows):
    labels = [key for key in rows[0].keys()]
    for row in rows:
      record = [row[key] for key in labels]
      data.append(record)
  return labels, data


@_magic.register_line_magic
def _get_table_page(line):
  args = line.split()
  key = args[0]
  name = args[1]
  page = int(args[2])
  rows_per_page = int(args[3])

  try:
    table = _table_cache[key]
  except KeyError:
    _table_cache[key] = table = _bq.table(name)
  labels, data = _get_rows(table, (page - 1) * rows_per_page, rows_per_page)
  model = {
    'page': page,
    'rows_per_page': rows_per_page,
    'total_rows': len(table),
    'labels': labels,
    'data': data
  }
  return _ipython.core.display.JSON(_json.dumps(model))


def _repr_html_query(query):
  # TODO(nikhilko): Pretty print the SQL
  builder = _HtmlBuilder()
  builder.render_text(query.sql, preformatted=True)
  return builder.to_html()


def _repr_html_query_results_table(results):
  # TODO(gram): Add a dependency on domready to make sure we don't try to access the
  # table div before it is ready.
  # TODO(gram): Look into supplying the column headers at this point so we don't need to fetch them
  # when doing page updates.
  _HTML_TEMPLATE = """
    <div id="table_%s">
    </div>
    <script>
      require(['extensions/tableviewer'], function(tv) {
        tv.make_table_viewer("%s", "%s", "%s");
      });
    </script>
  """
  div_id = str(int(round(_time.time())))
  return _HTML_TEMPLATE % (div_id, results.full_name, div_id, results.job_id)


def _repr_html_table(results):
  _HTML_TEMPLATE = """
    <div id="table_%s">
    </div>
    <script>
      require(['extensions/tableviewer'], function(tv) {
        tv.make_table_viewer("%s", "%s");
      });
    </script>
  """
  div_id = str(int(round(_time.time())))
  return _HTML_TEMPLATE % (div_id, results.full_name, div_id)


def _repr_html_table_list(table_list):
  builder = _HtmlBuilder()
  builder.render_objects(table_list, ['name'])
  return builder.to_html()


def _repr_html_table_schema(schema):
  # TODO(nikhilko): Temporary static HTML representation. Replace with more interactive
  #                 schema viewer that allows for expand/collapse.
  builder = _HtmlBuilder()
  builder.render_objects(schema, ['name', 'data_type', 'mode', 'description'])
  return builder.to_html()


def _repr_html_function_evaluation(evaluation):
  # TODO(nikhilko): Most of the javascript logic here should go into an external javascript
  #                 file, once we setup ipython with our own static files.
  _HTML_TEMPLATE = """
    <div id="%s"></div>
    <script>
    (function() {
      var html = [];
      var names = [];
      var first = true;

      function emitter(result) {
        if (first) {
          first = false;
          html.push('<tr>')
          for (var n in result) {
            names.push(n);
            html.push('<th>' + n + '</th>')
          }
          html.push('</tr>');
        }

        html.push('<tr>');
        for (var i = 0; i < names.length; i++) {
          var name = names[i];
          var value = result[name] || '';
          value = value.toString().replace(/&/g,'&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          html.push('<td>' + value + '</td>')
        }
        html.push('</tr>');
      }

      udf = %s;

      setTimeout(function() {
        html.push('<table>');

        var data = %s;
        data.forEach(function(row) { udf(row, emitter); });

        html.push('</table>')

        resultsElement = document.getElementById('%s');
        resultsElement.innerHTML = html.join('');
      }, 0);
    })();
    </script>
    """

  id = 'udf%d' % int(round(_time.time()))
  return _HTML_TEMPLATE % (id, evaluation.implementation, _json.dumps(evaluation.data), id)


def _register_html_formatters():
  ipy = _ipython.get_ipython()
  html_formatter = ipy.display_formatter.formatters['text/html']

  html_formatter.for_type_by_name('gcp.bigquery._query', 'Query', _repr_html_query)
  html_formatter.for_type_by_name('gcp.bigquery._query_results_table', 'QueryResultsTable',
                                  _repr_html_query_results_table)
  html_formatter.for_type_by_name('gcp.bigquery._table', 'Table', _repr_html_table)
  html_formatter.for_type_by_name('gcp.bigquery._table', 'TableList', _repr_html_table_list)
  html_formatter.for_type_by_name('gcp.bigquery._table', 'TableSchema', _repr_html_table_schema)
  html_formatter.for_type_by_name('gcp.bigquery._udf', 'FunctionEvaluation',
                                  _repr_html_function_evaluation)


_register_html_formatters()
