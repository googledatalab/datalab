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

import json as _json
import re as _re
import time as _time
import gcp.bigquery as _bq
from ._html import HtmlBuilder as _HtmlBuilder

try:
  import IPython as _ipython
  import IPython.core.magic as _magic
except ImportError:
  raise Exception('This module can only be loaded in ipython.')


@_magic.register_cell_magic
def bq_sql(declaration, sql):
  """Implements the bigquery cell magic for ipython notebooks.

  The supported syntax is:
  %%bq_sql [<var>]
  <sql>

  Args:
    declaration: the optional variable to be initialized with the resulting query.
    sql: the contents of the cell interpreted as the SQL.
  Returns:
    The results of executing the query converted to a dataframe if no variable
    was specified. None otherwise.
  """
  ipy = _ipython.get_ipython()

  # Use the user_ns dictionary, which contains all current declarations in
  # in the kernel as the dictionary to use to retrieve values for placeholders
  # within the specified sql statement.
  sql = _bq.sql(sql, **ipy.user_ns)
  query = _bq.query(sql)

  variable_name = declaration.strip()
  if len(variable_name):
    # Update the global namespace with the new variable, or update the value of
    # the existing variable if it already exists.
    ipy.push({variable_name: query})
    return None
  else:
    # If a variable was not specified, then simply return the results, so they
    # get rendered as the output of the cell.
    return query.results()


@_magic.register_cell_magic
def bq_udf(declaration, js):
  """Implements the bigquery_udf cell magic for ipython notebooks.

  The supported syntax is:
  %%bq_udf <var>
  <js function>

  Args:
    declaration: the variable to initialize with the resulting UDF object.
    js: the UDF declaration (inputs and outputs) and implementation in javascript.
  Returns:
    The results of executing the UDF converted to a dataframe if no variable
    was specified. None otherwise.
  """
  ipy = _ipython.get_ipython()

  variable_name = declaration.strip()
  if len(variable_name) == 0:
    raise Exception("Declaration must be of the form %%bq_udf -> <variable name>.")

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


def _repr_html_query(query):
  # TODO(nikhilko): Pretty print the SQL
  builder = _HtmlBuilder()
  builder.render_text(query.sql, preformatted=True)
  return builder.to_html()

def _repr_html_query_results(query_results):
  # TODO(nikhilko): Add other pieces of metadata such as time-taken.
  # TODO(nikhilko): Some way of limiting the number of rows, or showing first-few and last-few
  #                 or even better-yet, an interactive display of results.
  builder = _HtmlBuilder()
  builder.render_text('Number of rows: %d' % len(query_results))
  builder.render_text('Query job ID  : %s' % query_results.job_id)
  builder.render_objects(query_results, dictionary=True)
  return builder.to_html()

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
  html_formatter.for_type_by_name('gcp.bigquery._query', 'QueryResults', _repr_html_query_results)
  html_formatter.for_type_by_name('gcp.bigquery._table', 'TableList', _repr_html_table_list)
  html_formatter.for_type_by_name('gcp.bigquery._table', 'TableSchema', _repr_html_table_schema)
  html_formatter.for_type_by_name('gcp.bigquery._udf', 'FunctionEvaluation',
                                  _repr_html_function_evaluation)


_register_html_formatters()
