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


@_magic.register_line_cell_magic
def bigquery(line, cell=None):
  """Implements the bigquery cell magic for ipython notebooks.

  The supported syntax is:

    %%bigquery <line>
    <cell>

  or:

    %bigquery <line>

  Args:
    line: the contents of the bigquery line.
    cell: the contents of the cell.
  Returns:
    The results of executing the cell.
  """
  parser = argparse.ArgumentParser(prog='bigquery')
  subparsers = parser.add_subparsers(help='sub-commands')

  # This is a bit kludgy because we want to handle some line magics and some cell magics
  # with the bigquery command.

  # %%bigquery sql
  sql_parser = subparsers.add_parser('sql', help=
      'execute a BigQuery SQL statement or create a named query object')
  sql_parser.add_argument('-n', '--name', help='the name for this query object')
  sql_parser.set_defaults(func=lambda x: _dispatch_handler('sql', x, cell, sql_parser, _sql_cell,
                                                           cell_required=True))

  # %%bigquery udf
  udf_parser = subparsers.add_parser('udf', help='create a named Javascript UDF')
  udf_parser.add_argument('-n', '--name', help='the name for this UDF', required=True)
  udf_parser.set_defaults(func=lambda x: _dispatch_handler('udf', x, cell, udf_parser, _udf_cell,
                                                           cell_required=True))

  # %bigquery table
  table_parser = subparsers.add_parser('table', help='view a BigQuery table')
  table_parser.add_argument('-r', '--rows', type=int, default=25,
                            help='rows to display per page')
  table_parser.add_argument('-c', '--cols',
                            help='comma-separated list of column names to restrict to')
  table_parser.add_argument('table', help='the name of the table')
  table_parser.set_defaults(func=lambda x: _dispatch_handler('table', x, cell, table_parser,
                                                             _table_line, cell_prohibited=True))

  for p in [parser, sql_parser, udf_parser, table_parser]:
    p.format_usage = p.format_help  # Show full help always

  args = filter(None, line.split())
  try:
    parsed_args = parser.parse_args(args)
    return parsed_args.func(vars(parsed_args))
  except Exception as e:
    if e.message:
      print e.message


def _dispatch_handler(command, args, cell, parser, handler,
                      cell_required=False, cell_prohibited=False):
  """ Makes sure cell magics include cell and line magics don't, before dispatching to handler.

  Args:
    command: the name of the command.
    args: the optional arguments following 'bigquery <cmd>'.
    cell: the contents of the cell, if any.
    parser: the argument parser for <cmd>; used for error message.
    handler: the handler to call if the cell present/absent check passes.
    cell_required: True for cell magics, False for line magics that can't be cell magics.
    cell_prohibited: True for line magics, False for cell magics that can't be line magics.
  Returns:
    The result of calling the handler.
  Raises:
    SystemExit if the invocation is not valid.
  """
  if cell_prohibited:
    if cell and len(cell.strip()):
      parser.print_help()
      raise SystemExit('Additional data is not supported with the %s command.' % command)
    return handler(args)

  if cell_required and not cell:
    parser.print_help()
    raise SystemExit('The %s command requires additional data' % command)

  return handler(args, cell)


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
  if variable_name:
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
  if not variable_name:
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


def _table_line(args):
  fields = args['cols'].split(',') if args['cols'] else None
  return _ipython.core.display.HTML(
      _table_viewer(_get_table(args['table']), rows_per_page=args['rows'], fields=fields))


# An LRU cache for Tables. This is mostly useful so that when we cross page boundaries
# when paging through a table we don't have to re-fetch the schema.
_table_cache = _util.LRUCache(10)


def _get_table(name):
  try:
    table = _table_cache[name]
  except KeyError:
    _table_cache[name] = table = _bq.table(name)
  return table


@_magic.register_line_magic
def _get_table_rows(line):
  try:
    args = line.strip().split()
    table = _get_table(args[0])
    data = [row for row in table.range(start_row=int(args[1]), max_rows=int(args[2]))]
  except Exception, e:
    print str(e)
    data = {}

  model = {
    'data': data
  }
  return _ipython.core.display.JSON(_json.dumps(model))


def _table_viewer(table, rows_per_page=25, job_id='', fields=None):
  """  Return a table viewer.

  Args:
    table: the table to view.
    rows_per_page: how many rows to display at one time.
    job_id: the ID of the job that created this table, if known.
    fields: an array of field names to display; default is None which uses the full schema.
  Returns:
    A string containing the HTML for the table viewer.
  """
  if not table.exists():
    return "<div>%s does not exist</div>" % table.full_name

  _HTML_TEMPLATE = """
    <div class="bqtv" id="bqtv_%s">
    </div>
    <script>
      require(['extensions/tableviewer', 'element!bqtv_%s'],
          function(tv, dom) {
              tv.makeTableViewer('%s', dom, %s, [], %d, %d, '%s');
          }
      );
    </script>
  """

  fields = fields if fields else [field.name for field in table.schema()]
  labels = _json.dumps(fields)
  div_id = str(int(round(_time.time())))
  return _HTML_TEMPLATE %\
      (div_id, div_id, table.full_name, labels, table.length, rows_per_page, job_id)


def _repr_html_query(query):
  # TODO(nikhilko): Pretty print the SQL
  builder = _HtmlBuilder()
  builder.render_text(query.sql, preformatted=True)
  return builder.to_html()


def _repr_html_query_results_table(results):
  return _table_viewer(results, job_id=results.job_id)


def _repr_html_table(results):
  return _table_viewer(results)


def _repr_html_table_list(table_list):
  builder = _HtmlBuilder()
  builder.render_objects(table_list, ['name'])
  return builder.to_html()


def _repr_html_table_schema(schema):
  # TODO(gram): Replace at some point with schema and/or metadata.
  builder = _HtmlBuilder()
  builder.render_objects(schema, ['name', 'data_type', 'mode', 'description'])
  return builder.to_html()


def _repr_html_function_evaluation(evaluation):
  _HTML_TEMPLATE = """
    <div class="bqtv" id="%s"></div>
    <script>
      require(['extensions/function_evaluator', 'element!%s'],
          function(fe, dom) {
              fe.evaluate_function(dom, %s, %s);
          }
      );
    </script>
    """
  id = 'udf%d' % int(round(_time.time()))
  return _HTML_TEMPLATE % (id, id, evaluation.implementation, _json.dumps(evaluation.data))


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
