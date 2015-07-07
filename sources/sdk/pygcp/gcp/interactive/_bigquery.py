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
import IPython as _ipython
import IPython.core.magic as _magic
import gcp.bigquery as _bq
import gcp._util as _util
from ._commands import CommandParser as _CommandParser
from ._environments import _get_query, _get_table, _notebook_environment, _pipeline_environment
from ._environments import _get_schema, _get_pipeline_args
from ._environments import _get_notebook_resolution_environment, _get_pipeline_resolution_environment
from ._environments import _get_notebook_item, _resolve
from ._html import HtmlBuilder as _HtmlBuilder
from ._utils import _get_data, _get_field_list, _handle_magic_line


def _create_sample_subparser(parser):
  sample_parser = parser.subcommand('sample',
      'execute a BigQuery SQL statement and display results or create a named query object')
  sample_parser.add_argument('-q', '--sql', help='the name for this query object')
  sample_parser.add_argument('-c', '--count', type=int, default=10,
                             help='number of rows to limit to if sampling')
  sample_parser.add_argument('-m', '--method', help='the type of sampling to use',
                             choices=['limit', 'random', 'hashed', 'sorted'], default='limit')
  sample_parser.add_argument('-p', '--percent', type=int, default=1,
                             help='For random or hashed sampling, what percentage to sample from')
  sample_parser.add_argument('-f', '--field',
                             help='field to use for sorted or hashed sampling')
  sample_parser.add_argument('-o', '--order', choices=['ascending', 'descending'],
                             default='ascending', help='sort order to use for sorted sampling')
  return sample_parser


def _create_udf_subparser(parser):
  udf_parser = parser.subcommand('udf', 'create a named Javascript UDF')
  udf_parser.add_argument('-n', '--name', help='the name for this UDF', required=True)
  return udf_parser


# TODO(gram): make help a parameter too
def _create_execute_subparser(parser, command):
  execute_parser = parser.subcommand(command,
      'execute a BigQuery SQL statement sending results to a named table')
  execute_parser.add_argument('-b', '--batch', help='run as lower-priority batch job',
                              action='store_true')
  execute_parser.add_argument('-nc', '--nocache', help='don\'t used previously cached results',
                              action='store_true')
  execute_parser.add_argument('-a', '--append', help='append results to table',
                              action='store_true')
  execute_parser.add_argument('-o', '--overwrite', help='overwrite existing content in table',
                              action='store_true')
  execute_parser.add_argument('-l', '--large', help='allow large results',
                              action='store_true')
  execute_parser.add_argument('-q', '--sql', help='name of query to run, if not in cell body',
                              nargs='?')
  execute_parser.add_argument('-d', '--destination', help='target table name',
                              nargs='?')
  return execute_parser


def _create_table_subparser(parser):
  table_parser = parser.subcommand('table', 'view a BigQuery table')
  table_parser.add_argument('-r', '--rows', type=int, default=25,
                            help='rows to display per page')
  table_parser.add_argument('-c', '--cols',
                            help='comma-separated list of column names to restrict to')
  return table_parser


def _create_schema_subparser(parser):
  schema_parser = parser.subcommand('schema', 'view a BigQuery table or view schema')
  schema_parser.add_argument('item', help='the name of, or a reference to, the table or view')
  return schema_parser


def _create_datasets_subparser(parser):
  datasets_parser = parser.subcommand('datasets', 'list the datasets in a BigQuery project')
  datasets_parser.add_argument('-p', '--project',
                               help='the project whose datasets should be listed')
  return datasets_parser


def _create_tables_subparser(parser):
  tables_parser = parser.subcommand('tables', 'list the tables in a BigQuery project or dataset')
  tables_parser.add_argument('-p', '--project',
                             help='the project whose tables should be listed')
  tables_parser.add_argument('-d', '--dataset',
                             help='the dataset to restrict to')
  return tables_parser


def _create_extract_subparser(parser):
  extract_parser = parser.subcommand('extract', 'Extract BigQuery query results or table to GCS')
  extract_parser.add_argument('source', help='the query or table to extract')
  extract_parser.add_argument('-f', '--format', choices=['csv', 'json'], default='csv',
                              help='format to use for the export')
  extract_parser.add_argument('-c', '--compress', action='store_true', help='compress the data')
  extract_parser.add_argument('-H', '--header', action='store_true', help='include a header line')
  extract_parser.add_argument('-d', '--delimiter', default=',', help='field delimiter')
  extract_parser.add_argument('destination', help='the URL of the destination')
  return extract_parser


def _create_load_subparser(parser):
  load_parser = parser.subcommand('load', 'load data into a BigQuery table')
  load_parser.add_argument('-a', '--append', help='append to existing file',
                           action='store_true')
  load_parser.add_argument('-o', '--overwrite', help='overwrite existing file',
                           action='store_true')
  load_parser.add_argument('-f', '--format', help='source format', choices=['json', 'csv'],
                           default='csv')
  load_parser.add_argument('-n', '--skip', help='number of initial lines to skip',
                           type=int, default=0)
  load_parser.add_argument('-s', '--strict', help='reject bad values and jagged lines',
                           action='store_true')
  load_parser.add_argument('-d', '--delimiter', default=',',
                           help='the inter-field delimiter (default ,)')
  load_parser.add_argument('-q', '--quote', default='"',
                           help='the quoted field delimiter (default ")')
  load_parser.add_argument('-i', '--infer', help='attempt to infer schema from source',
                           action='store_true')
  load_parser.add_argument('source', help='URL of the GCS source(s)')
  load_parser.add_argument('table', help='the destination table')
  return load_parser


def _create_run_subparser(parser):
  run_parser = parser.subcommand('run', 'Execute a pipeline query in the notebook')
  run_parser.add_argument('-d', '--dry', help='just show the query, don\'t run it',
                          action='store_true')
  run_parser.add_argument('query', help='the query to run')
  return run_parser


def _create_bigquery_parser():
  """ Create the parser for the %bigquery magics.

  Note that because we use the func default handler dispatch mechanism of argparse,
  our handlers can take only one argument which is the parsed args. So we must create closures
  for the handlers that bind the cell contents and thus must recreate this parser for each
  cell upon execution.
  """
  parser = _CommandParser.create('bigquery')

  # This is a bit kludgy because we want to handle some line magics and some cell magics
  # with the bigquery command.

  # %%bigquery sample
  sample_parser = _create_sample_subparser(parser)
  sample_parser.set_defaults(
      func=lambda args, cell: _dispatch_handler('sample', args, cell, sample_parser, _sample_cell))

  # %%bigquery udf
  udf_parser = _create_udf_subparser(parser)
  udf_parser.set_defaults(
      func=lambda args, cell: _dispatch_handler('udf', args, cell, udf_parser,
                                                _udf_cell, cell_required=True))

  # %%bigquery execute
  execute_parser = _create_execute_subparser(parser, 'execute')
  execute_parser.set_defaults(
      func=lambda args, cell: _dispatch_handler('execute', args, cell,
                                                execute_parser, _execute_cell))

  # %%bigquery pipeline
  pipeline_parser = _create_execute_subparser(parser, 'pipeline')
  pipeline_parser.set_defaults(
    func=lambda args, cell: _dispatch_handler('pipeline', args, cell,
                                              pipeline_parser, _pipeline_line,
                                              cell_prohibited=True))

  # %bigquery table
  table_parser = _create_table_subparser(parser)
  table_parser.set_defaults(
      func=lambda args, cell: _dispatch_handler('table', args, cell, table_parser,
                                                _table_line, cell_prohibited=True))

  # %bigquery schema
  schema_parser = _create_schema_subparser(parser)
  schema_parser.set_defaults(
      func=lambda args, cell: _dispatch_handler('schema', args, cell,
                                                schema_parser, _schema_line, cell_prohibited=True))

  # %bigquery datasets
  datasets_parser = _create_datasets_subparser(parser)
  datasets_parser.set_defaults(
      func=lambda args, cell: _dispatch_handler('datasets', args, cell, datasets_parser,
                                                _datasets_line, cell_prohibited=True))

  # %bigquery tables
  tables_parser = _create_tables_subparser(parser)
  tables_parser.set_defaults(
      func=lambda args, cell: _dispatch_handler('tables', args, cell, tables_parser,
                                                _tables_line, cell_prohibited=True))

  # % bigquery extract
  extract_parser = _create_extract_subparser(parser)
  extract_parser.set_defaults(
      func=lambda args, cell: _dispatch_handler('extract', args, cell, extract_parser,
                                                _extract_line, cell_prohibited=True))

  # %bigquery load
  # TODO(gram): need some additional help, esp. around the option of specifying schema in
  # cell body and how schema infer may fail.
  load_parser = _create_load_subparser(parser)
  load_parser.set_defaults(
      func=lambda args, cell: _dispatch_handler('load', args, cell, load_parser, _load_cell))

  # %bigquery run
  run_parser = _create_run_subparser(parser)
  run_parser.set_defaults(
    func=lambda args, cell: _dispatch_handler('run', args, cell, run_parser, _run_cell))
  return parser


_bigquery_parser = _create_bigquery_parser()


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
  complete, partial = _get_notebook_resolution_environment()
  # TODO(gram): Fix this hack!
  if line.split(' ')[1] == 'pipeline':
    complete, partial = _get_notebook_resolution_environment()

  return _handle_magic_line(line, cell, _bigquery_parser, namespace=complete)


def _dispatch_handler(command, args, cell, parser, handler,
                      cell_required=False, cell_prohibited=False):
  """ Makes sure cell magics include cell and line magics don't, before dispatching to handler.

  Args:
    command: the name of the command.
    args: the parsed arguments from the magic line.
    cell: the contents of the cell, if any.
    parser: the argument parser for <cmd>; used for error message.
    handler: the handler to call if the cell present/absent check passes.
    cell_required: True for cell magics, False for line magics that can't be cell magics.
    cell_prohibited: True for line magics, False for cell magics that can't be line magics.
  Returns:
    The result of calling the handler.
  Raises:
    Exception if the invocation is not valid.
  """
  if cell_prohibited:
    if cell and len(cell.strip()):
      parser.print_help()
      raise Exception('Additional data is not supported with the %s command.' % command)
    return handler(args)

  if cell_required and not cell:
    parser.print_help()
    raise Exception('The %s command requires additional data' % command)

  return handler(args, cell)


def _sample_cell(args, sql):
  """Implements the bigquery sample cell magic for ipython notebooks.

  Args:
    args: the optional arguments following '%%bigquery sample'.
    sql: optional contents of the cell interpreted as SQL.
  Returns:
    The results of executing the query converted to a dataframe if no variable
    was specified. None otherwise.
  """

  if args['sql']:
    sql = _get_query(args['sql']).sql

  count = args['count']
  method = args['method']
  if method == 'random':
    sampling = _bq.Sampling.random(percent=args['percent'], count=count)
  elif method == 'hashed':
    sampling = _bq.Sampling.hashed(field_name=args['field'], percent=args['percent'],
                                   count=count)
  elif method == 'sorted':
    ascending = args['order'] == 'ascending'
    sampling = _bq.Sampling.sorted(args['field'], ascending=ascending, count=count)
  elif method == 'limit':
    sampling = _bq.Sampling.default(count=count)

  # TODO(gram): how do we handle this in Python code? Ideally Query objects
  # would resolve themselves....
  try:
    complete, partial = _get_notebook_resolution_environment()
    query = _resolve(sql, complete, partial)
  except Exception as e:
    return e

  return query.sample(sampling=sampling)


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
  _pipeline_environment()[variable_name] = udf
  _notebook_environment()[variable_name] = udf

  return None


def _execute_cell(args, sql):
  if sql:
    if args['sql']:
      return "Cannot have a sql parameter and a sql cell body"
  else:
    if not args['sql']:
      return "Need a sql parameter or a sql cell body"
    query = _get_query(args['sql'])
    if not isinstance(query, _bq._Query):
      return "%s does not refer to a sql" % args['sql']
    sql = query.sql

  # TODO(gram): how do we handle this in Python code? Ideally Query objects
  # would resolve themselves....
  try:
    complete, partial = _get_notebook_resolution_environment()
    query = _resolve(sql, complete, partial)
  except Exception as e:
    return e

  return query.execute(args['destination'], args['append'], args['overwrite'], not args['nocache'],
                       args['batch'], args['large']).results


def _pipeline_line(args):
  if not args['sql']:
    return "Need a sql parameter"
  query = _get_query(args['sql'])
  if not isinstance(query, _bq._Query):
    return "%s does not refer to a sql" % args['sql']
  sql = query.sql

  # TODO(gram): how do we handle this in Python code? Ideally Query objects
  # would resolve themselves....
  try:
    complete, partial = _get_pipeline_resolution_environment()
    query = _resolve(sql, complete, partial)
  except Exception as e:
    return e

  return query.execute(args['destination'], args['append'], args['overwrite'], not args['nocache'],
                       args['batch'], args['large']).results


def _table_line(args):
  name = args['table']
  table = _get_table(name)
  if table and table.exists():
    fields = args['cols'].split(',') if args['cols'] else None
    html = _table_viewer(table, rows_per_page=args['rows'], fields=fields)
    return _ipython.core.display.HTML(html)
  else:
    print "%s does not exist" % name


def _schema_line(args):
  name = args['item']
  schema = _get_schema(name)
  if schema:
    html = _repr_html_table_schema(schema)
    return _ipython.core.display.HTML(html)
  else:
    print "%s does not exist" % name


def _render_table(data, fields=None):
  """ Helper to render a list of dictionaries as an HTML display object. """
  builder = _HtmlBuilder()
  builder.render_objects(data, fields, dictionary=True)
  html = builder.to_html()
  return _ipython.core.display.HTML(html)


def _datasets_line(args):
  return _render_table([{'Name': dataset.full_name} for dataset in _bq.datasets(args['project'])])


def _tables_line(args):
  if args['dataset']:
    datasets = [_bq.dataset((args['project'], args['dataset']))]
  else:
    datasets = _bq.datasets(args['project'])

  tables = []
  for dataset in datasets:
    tables.extend([{'Name': table.full_name} for table in dataset])

  return _render_table(tables)


def _extract_line(args):
  name = args['source']
  source = _get_notebook_item(name)
  if not source:
    source = _get_table(name)

  if not source:
    print 'No such source: %s' % name
  elif isinstance(source, _bq._Table) and not source.exists():
    print 'Source %s does not exist' % name
  else:

    job = source.extract(args['destination'],
                         format='CSV' if args['format'] == 'csv' else 'NEWLINE_DELIMITED_JSON',
                         compress=args['compress'],
                         field_delimiter=args['delimiter'],
                         print_header=args['header'])
    if job.failed:
      print 'Extract failed: %s' % str(job.fatal_error)
    elif job.errors:
      print 'Extract completed with errors: %s' % str(job.errors)


def _load_cell(args, schema):
  name = args['table']
  table = _get_table(name)
  if not table:
    table = _bq.table(name)

  if table.exists():
    if not (args['append'] or args['overwrite']):
      print "%s already exists; use --append or --overwrite" % name
  elif schema:
    table.create(_json.loads(schema))
  elif not args['infer']:
    print 'Table does not exist, no schema specified in cell and no --infer flag; cannot load'
    return

  # TODO(gram): we should probably try do the schema infer ourselves as BQ doesn't really seem
  # to be able to do it. Alternatively we can drop the --infer argument and force the user
  # to use a pre-existing table or supply a JSON schema.
  job = table.load(args['source'],
                   append=args['append'],
                   overwrite=args['overwrite'],
                   create=not table.exists(),
                   source_format=('CSV' if args['format'] == 'csv' else 'NEWLINE_DELIMITED_JSON'),
                   skip_leading_rows=args['skip'],
                   allow_jagged_rows=not args['strict'],
                   ignore_unknown_values=not args['strict'],
                   field_delimiter=args['delimiter'],
                   quote=args['quote'])
  if job.failed:
    print 'Load failed: %s' % str(job.fatal_error)
  elif job.errors:
    print 'Load completed with errors: %s' % str(job.errors)


def _run_cell(args, cell):

  if args['deployable']:
    complete, partial = _get_pipeline_resolution_environment()
    complete.update(_get_pipeline_args(cell))
  else:
    # IPython environment takes precedence even over cell args, as cell args
    # could resolve to default values.
    # TODO(gram): fix this by creating a copy of the arg parser with all defaults set to None
    complete, partial = _get_notebook_resolution_environment()

    # Update the environment with the args explicitly set in the cell.
    cell_args = _get_pipeline_args(cell, explicit_only=True)
    complete.update({key: value for key, value in cell_args.iteritems()})

    # Update the environment with any default arg values if they are not yet defined.
    default_args = _get_pipeline_args()
    complete.update({key: value for key, value in default_args.iteritems()
                     if key not in complete and key not in partial})

  # Perform expansion of the query to a new query
  try:
    query = complete.get(args['query'], None)
    if not query:
      query = partial.get(args['query'], None)
      if not query:
        return "%s does not refer to a query" % args['query']

      query = _resolve(query.sql, complete, partial)
    if args['dry']:
      return query.sql
    else:
      # Run it and show results
      return query.execute().results
  except Exception as e:
    print str(e)


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
    print "%s does not exist" % table.full_name
    return

  _HTML_TEMPLATE = """
    <div class="bqtv" id="bqtv_%s"></div>
    <div><br />%s<br />%s</div>
    <script>
      require(['extensions/charting', 'element!bqtv_%s'],
        function(charts, dom) {
          charts.render(dom,
            {
              chartStyle:"%s",
              dataName:"%s",
              fields:"%s",
              totalRows:%d,
              rowsPerPage:%d,
            }, {}, %s);
        }
      );
    </script>
  """

  if fields is None:
    fields = _get_field_list(fields, table.schema)
  div_id = str(int(round(_time.time())))
  meta_count = "rows: %d" % table.length if table.length >= 0 else ''
  meta_name = job_id if job_id else table.full_name
  data, total_count = _get_data(table, fields, 0, rows_per_page)

  if total_count < 0:
    # The table doesn't have a length metadata property but may still be small if we fetched less
    # rows than we asked for.
    fetched_count = len(data['rows'])
    if fetched_count < rows_per_page:
      total_count = fetched_count

  chart = 'table' if 0 <= total_count <= rows_per_page else 'paged_table'

  return _HTML_TEMPLATE %\
      (div_id, meta_name, meta_count, div_id, chart, table.full_name, ','.join(fields),
       total_count, rows_per_page, _json.dumps(data, cls=_util.JSONEncoder))


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
  return _render_table(table_list, ['name'])


def _repr_html_table_schema(schema):
  _HTML_TEMPLATE = """
    <div class="bqsv" id="%s"></div>
    <script>
      require(['style!/static/extensions/bigquery.css', 'extensions/bigquery', 'element!%s'],
          function(_, bq, dom) {
              bq.renderSchema(dom, %s);
          }
      );
    </script>
    """
  id = 'bqsv%d' % int(round(_time.time() * 100))
  return _HTML_TEMPLATE % (id, id, _json.dumps(schema._bq_schema))


def _repr_html_function_evaluation(evaluation):
  _HTML_TEMPLATE = """
    <div class="bqtv" id="%s"></div>
    <script>
      require(['extensions/bigquery', 'element!%s'],
          function(bq, dom) {
              bq.evaluateUDF(dom, %s, %s);
          }
      );
    </script>
    """
  id = 'udf%d' % int(round(_time.time() * 100))
  return _HTML_TEMPLATE % (id, id, evaluation.implementation, _json.dumps(evaluation.data))


def _register_html_formatters():
  ipy = _ipython.get_ipython()
  html_formatter = ipy.display_formatter.formatters['text/html']

  html_formatter.for_type_by_name('gcp.bigquery._query', 'Query', _repr_html_query)
  html_formatter.for_type_by_name('gcp.bigquery._query_results_table', 'QueryResultsTable',
                                  _repr_html_query_results_table)
  html_formatter.for_type_by_name('gcp.bigquery._table', 'Table', _repr_html_table)
  html_formatter.for_type_by_name('gcp.bigquery._table', 'TableList', _repr_html_table_list)
  html_formatter.for_type_by_name('gcp.bigquery._table', 'Schema', _repr_html_table_schema)
  html_formatter.for_type_by_name('gcp.bigquery._udf', 'FunctionEvaluation',
                                  _repr_html_function_evaluation)


_register_html_formatters()
