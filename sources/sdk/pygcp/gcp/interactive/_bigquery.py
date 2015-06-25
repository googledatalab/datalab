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

import datetime as _datetime
import json as _json
import re as _re
import shlex as _shlex
import sys as _sys
import time as _time
import types as _types
import IPython as _ipython
import IPython.core.magic as _magic
import gcp.bigquery as _bq
import gcp._util as _util
from ._commands import CommandParser as _CommandParser
from ._html import HtmlBuilder as _HtmlBuilder
from ._utils import _get_data, _get_field_list, _handle_magic_line


# Some string literals used for binding names in the environment.
_pipeline_module = '_bqmodule'
_pipeline_sources = '_sources'
_pipeline_arg_parser = '_arg_parser'


def _create_sql_subparser(parser, allow_sampling=True):
  sql_parser = parser.subcommand('sql',
      'execute a BigQuery SQL statement and display results or create a named query object')
  sql_parser.add_argument('-n', '--name', help='the name for this query object')
  if allow_sampling:
    sql_parser.add_argument('-s', '--sample', action='store_true',
                            help='execute the query and get a sample of results')
    sql_parser.add_argument('-sc', '--samplecount', type=int, default=10,
                            help='number of rows to limit to if sampling')
    sql_parser.add_argument('-sm', '--samplemethod', help='the type of sampling to use',
                            choices=['limit', 'random', 'hashed', 'sorted'], default='limit')
    sql_parser.add_argument('-sp', '--samplepercent', type=int, default=1,
                            help='For random or hashed sampling, what percentage to sample from')
    sql_parser.add_argument('-sf', '--samplefield',
                            help='field to use for sorted or hashed sampling')
    sql_parser.add_argument('-so', '--sampleorder', choices=['ascending', 'descending'],
                            default='ascending', help='sort order to use for sorted sampling')
  return sql_parser


def _create_udf_subparser(parser):
  udf_parser = parser.subcommand('udf', 'create a named Javascript UDF')
  udf_parser.add_argument('-n', '--name', help='the name for this UDF', required=True)
  return udf_parser


def _create_execute_subparser(parser):
  execute_parser = parser.subcommand('execute',
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
  execute_parser.add_argument('-q', '--query', help='name of query to run, if not in cell body',
                              nargs='?')
  execute_parser.add_argument('table', help='target table name')
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


def _create_source_subparser(parser):
  source_parser = parser.subcommand('source', 'Specify a query source in SQL')
  source_parser.add_argument('name', help='the name of the source')
  return source_parser


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

  # %%bigquery sql
  sql_parser = _create_sql_subparser(parser)
  sql_parser.set_defaults(
      func=lambda args, cell: _dispatch_handler('sql', args, cell, sql_parser,
                                                _sql_cell, cell_required=True))

  # %%bigquery udf
  udf_parser = _create_udf_subparser(parser)
  udf_parser.set_defaults(
      func=lambda args, cell: _dispatch_handler('udf', args, cell, udf_parser,
                                                _udf_cell, cell_required=True))

  # %%bigquery execute
  execute_parser = _create_execute_subparser(parser)
  execute_parser.set_defaults(
      func=lambda args, cell: _dispatch_handler('execute', args, cell,
                                                execute_parser, _execute_cell))

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


def _create_bqmodule_parser():
  """ Create the parser for the %bqmodule magics. """
  parser = _CommandParser.create('bqmodule')
  # %%bqmodule arguments
  args_parser = parser.subcommand('arguments', 'specify the deployment argumemts for a BQ pipeline')
  args_parser.set_defaults(
    func=lambda args, cell: _dispatch_handler('arguments', args, cell, args_parser,
                                              _args_cell, cell_required=True,
                                              deployable=True))

  # %%bqmodule source
  source_parser = _create_source_subparser(parser)
  source_parser.set_defaults(
    func=lambda args, cell: _dispatch_handler('source', args, cell, source_parser,
                                              _source_cell, cell_required=True,
                                              deployable=True))

  # %%bqmodule sql
  sql_parser = _create_sql_subparser(parser, allow_sampling=False)
  sql_parser.set_defaults(
    func=lambda args, cell: _dispatch_handler('sql', args, cell, sql_parser,
                                              _sql_cell, cell_required=True,
                                              deployable=True))

  # %%bqmodule udf
  udf_parser = _create_udf_subparser(parser)
  udf_parser.set_defaults(
    func=lambda args, cell: _dispatch_handler('udf', args, cell, udf_parser,
                                              _udf_cell, cell_required=True,
                                              deployable=True))

  # %bqmodule run
  run_parser = _create_run_subparser(parser)
  run_parser.set_defaults(
    func=lambda args, cell: _dispatch_handler('run', args, cell, run_parser, _run_cell,
                                              deployable=True))
  return parser


_bigquery_parser = _create_bigquery_parser()
_bqmodule_parser = _create_bqmodule_parser()


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
  return _handle_magic_line(line, cell, _bigquery_parser)


@_magic.register_line_cell_magic
def bqmodule(line, cell=None):
  """Implements the bqmodule cell magic for ipython notebooks.

  The supported syntax is:

    %%bqmodule <line>
    <cell>

  or:

    %bqmodule <line>

  Args:
    line: the contents of the bqmodule line.
    cell: the contents of the cell.
  Returns:
    The results of executing the cell.
  """
  return _handle_magic_line(line, cell, _bqmodule_parser)


def _dispatch_handler(command, args, cell, parser, handler,
                      cell_required=False, cell_prohibited=False, deployable=False):
  """ Makes sure cell magics include cell and line magics don't, before dispatching to handler.

  Args:
    command: the name of the command.
    args: the parsed arguments from the magic line.
    cell: the contents of the cell, if any.
    parser: the argument parser for <cmd>; used for error message.
    handler: the handler to call if the cell present/absent check passes.
    cell_required: True for cell magics, False for line magics that can't be cell magics.
    cell_prohibited: True for line magics, False for cell magics that can't be line magics.
    deployable: if True, this is a bqmodule command.
  Returns:
    The result of calling the handler.
  Raises:
    Exception if the invocation is not valid.
  """
  args['deployable'] = deployable
  if cell_prohibited:
    if cell and len(cell.strip()):
      parser.print_help()
      raise Exception('Additional data is not supported with the %s command.' % command)
    return handler(args)

  if cell_required and not cell:
    parser.print_help()
    raise Exception('The %s command requires additional data' % command)

  return handler(args, cell)


def _pipeline_environment():
  """ Get the environment dictionary for bqmodule magics, creating it if needed. """
  if _pipeline_module not in _sys.modules:
    # Create the pipeline module.
    module = _types.ModuleType(_pipeline_module)
    module.__file__ = _pipeline_module
    module.__name__ = _pipeline_module
    _sys.modules[_pipeline_module] = module
    # Automatically import the newly created module by assigning it to a variable
    # named the same name as the module name.
    _bind_name_in_notebook_environment(_pipeline_module, module)
    # Initialize the bqmodule arg parser and sources
    _bind_name_in_pipeline_environment(_pipeline_arg_parser, _CommandParser.create('bqmodule run'))
    _bind_name_in_pipeline_environment(_pipeline_sources, {})
  else:
    module = _sys.modules[_pipeline_module]
  return module.__dict__


def _exec_in_pipeline_module(code):
  """ Execute code contained in a string within the pipeline module. """
  exec code in _pipeline_environment()


def _bind_name_in_pipeline_environment(name, value):
  """ Bind a name to a value in the pipeline module. """
  _pipeline_environment()[name] = value


def _bind_name_in_notebook_environment(name, value):
  """ Bind a name to a value in the IPython notebook environment. """
  ipy = _ipython.get_ipython()
  ipy.push({name: value})


def _get_pipeline_item(name):
  """ Get an item from the pipeline environment. """
  return _pipeline_environment().get(name, None)


def _get_notebook_item(name):
  """ Get an item from the IPython environment. """
  ipy = _ipython.get_ipython()
  user_val = ipy.user_ns.get(name, None)
  return user_val


def _get_query(name):
  """ Get a query bound to variable name.

  This will look in IPython environment first. If name is not defined there it will
  look in pipeline environment and return a resolved query if possible.
  """
  q = _get_notebook_item(name)
  if q is None:
    q = _get_pipeline_item(name)
    if isinstance(q, _bq._Query):
      env = _get_notebook_resolution_environment()
      sql = _bq.sql(q.sql, **env)
      q = _bq.query(sql)
  return q


def _get_pipeline_args(cell=None):
  """ Parse a set of pipeline arguments or get the default value of the arguments.

  Args:
    cell: the cell containing the argument flags. If omitted the empty string is used so
        we can get the default values for the arguments.
  """
  if cell is None:
    cell = ''
  parser = _get_pipeline_item(_pipeline_arg_parser)
  command_line = ' '.join(cell.split('\n'))
  args = vars(parser.parse_args(_shlex.split(command_line)))
  # Don't return any args that are None as we don't want to expand to 'None'
  return {arg: value for arg, value in args.iteritems() if value is not None}


def _date(val, offset=None):
  """ A special pseudo-type for pipeline arguments.

  This allows us to parse dates as Python datetimes, including special values like 'now'
  and 'today', as well as apply offsets to the datetime.

  Args:
    val: a string containing the value for the datetime. This can be 'now', 'today' (midnight at
        start of day), 'yesterday' (midnight at start of yesterday), or a formatted date that
        will be passed to the datetime constructor. Note that 'now' etc are assumed to
        be in UTC.
    offset: for date arguments a string containing a comma-separated list of
      relative offsets to apply of the form <n><u> where <n> is an integer and
      <u> is a single character unit (d=day, m=month, y=year, h=hour, m=minute).

  Returns:
    A Python datetime resulting from starting at <val> and applying the sequence of deltas
    specified in <offset>.
  """
  if val is None:
    return val
  if val == '' or val == 'now':
    when = _datetime.datetime.utcnow()
  elif val == 'today':
    dt = _datetime.datetime.utcnow()
    when = _datetime.datetime(dt.year, dt.month, dt.day)
  elif val == 'yesterday':
    dt = _datetime.datetime.utcnow() - _datetime.timedelta(1)
    when = _datetime.datetime(dt.year, dt.month, dt.day)
  else:
    when = _datetime.datetime(val)
  if offset is not None:
    for part in offset.split(','):
      unit = part[-1]
      quant = int(part[:-1])
      # We can use timedelta for days and under, but not for years and months
      if unit == 'y':
        when = _datetime.datetime(year=when.year + quant, month=when.month, day=when.day,
                                  hour=when.hour, minute=when.minute)
      elif unit == 'm':
        newyear = when.year
        newmonth = when.month + quant
        if newmonth < 1:
          newmonth = -newmonth
          newyear += 1 + (newmonth // 12)
          newmonth = 12 - newmonth % 12
        elif newmonth > 12:
          newyear += (newmonth - 1) // 12
          newmonth = 1 + (newmonth - 1) % 12
        when = _datetime.datetime(year=newyear, month=newmonth, day=when.day,
                                  hour=when.hour, minute=when.minute)
      elif unit == 'd':
        when += _datetime.timedelta(days=quant)
      elif unit == 'h':
        when += _datetime.timedelta(hours=quant)
      elif unit == 'm':
        when += _datetime.timedelta(minutes=quant)

  return when


def _string(val):
  """ A simple pseudo-type for string arguments.

   It is more intuitive to say type=string than type=basestring, so we define this allowing
   us to support both.
  """
  return val


def _table(val):
  """ A speduo-type for bqmodule arguments allowing us to specify table names.

   Needed as we need a special form of expansion in queries for table names.
  """
  return _bq.table(val)


def _make_formatter(f, type, offset=None):
  """ A closure-izer for arguments that include a format and possibly an offset. """
  format = f
  delta = offset
  if type == _table:
    return lambda v: _bq.table(_time.strftime(format, (_date(v, delta)).timetuple()))
  else:
    return lambda v: _time.strftime(format, (_date(v, delta)).timetuple())


def _make_date(offset):
  """ A closure-izer for date arguments that include an offset. """
  delta = offset
  return lambda v: _date(v, delta)


def _arg(name, default=None, offset=None, type=_string, format=None, help=None):
  """ Add an argument to the pipeline arg parser.

  Args:
    name: the argument name; this will add a --name option to the arg parser.
    default: default value for the argument. For dates this can be 'now', 'today',
        'yesterday' or a string that should be suitable for passing to datetime.__init__.
    offset: for date arguments a string containing a comma-separated list of
      relative offsets to apply of the form <n><u> where <n> is an integer and
      <u> is a single character unit (d=day, m=month, y=year, h=hour, m=minute).
    type: the argument type. Can be a standard Python scalar or string, date or table.
        Not needed if either format or offset is specified (in this case the final argument
        will be a string (if format is specified) or datetime (if offset is specified but format
        is not) produced from processing the raw argument appropriately).
    format: for date arguments, a format string to convert this to a string using time.strftime.
      If format is supplied the type argument is not needed.
    help: optional help string for this argument.
  """
  arg_parser = _get_pipeline_item(_pipeline_arg_parser)
  if format is None:
    if offset is None:
      arg_parser.add_argument('--%s' % name, default=default, type=type, help=help)
    else:
      arg_parser.add_argument('--%s' % name, default=default, type=_make_date(offset), help=help)
  else:
    if offset is None:
      arg_parser.add_argument('--%s' % name, default=default, type=_make_formatter(format, type),
                              help=help)
    else:
      arg_parser.add_argument('--%s' % name, default=default,
                              type=_make_formatter(format, type, offset), help=help)


def _args_cell(_, cell):
  """Implements the bqmodule arguments cell magic for ipython notebooks.

  Args:
    cell: the contents of the cell interpreted as Python code. This should be calls to arg()
        only; anything else will not have any effect in a deployed pipeline.

  """
  try:
    # Define our special argument 'types'.
    _bind_name_in_pipeline_environment('date', _date)
    _bind_name_in_pipeline_environment('table', _table)

    # Define the arg helper function.
    _bind_name_in_pipeline_environment('arg', _arg)

    # Reset the argument parser.
    _bind_name_in_pipeline_environment(_pipeline_arg_parser, _CommandParser.create('bqmodule run'))

    # Execute the cell which should be one or more calls to arg().
    _exec_in_pipeline_module(cell)
  except Exception as e:
    print str(e)


def _source_cell(args, sql):
  """ Define a BQ pipeline source.

  This is just a convenience for defining a fragment of SQL that can be referenced in
  other queries.

  Args:
    args: the magic command arguments (just <name>).
    sql: the magic cell body containing the SQL fragment.

  """
  _pipeline_environment()[_pipeline_sources][args['name']] = _bq.query(sql)


def _get_pipeline_resolution_environment(env=None):
  """ Get the key/val dictionary for resolving metavars in the pipeline environment.

  An initial dictionary can be supplied in which case it will be augmented with new
  names but existing names will not be replaced.
  """
  if env is None:
    env = {}

  # Add the default arguments from the pipeline environment if they aren't defined
  env.update({key: value for key, value in _get_pipeline_args().iteritems()
              if key not in env and value is not None})

  # Add any sources from the pipeline environment, expanded with what we have so far
  env.update({key: _bq.query(_bq.sql(str(value), **env))
              for key, value in _pipeline_environment()[_pipeline_sources].iteritems()
              if key not in env and isinstance(value, _bq._Query)})

  # Add any queries from the pipeline environment, expanded with what we have so far
  env.update({key: _bq.query(_bq.sql(str(value), **env))
              for key, value in _pipeline_environment().iteritems()
              if key not in env and isinstance(value, _bq._Query)})
  return env


def _get_notebook_resolution_environment():
  """ Get the key/val dictionary For resolving metavars in the pipeline environment.

  This is the IPython user environment augmented with the pipeline environment.
  """
  ipy = _ipython.get_ipython()
  # Start with a copy of IPython environment
  env = {}
  env.update(ipy.user_ns)
  return _get_pipeline_resolution_environment(env)


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
  deployable = args['deployable']

  try:
    if deployable:
      # Test for hermeticity
      _bq.sql(sql, **_get_pipeline_resolution_environment())
    else:
      # Non-pipeline; must go through immediate variable expansion.
      sql = _bq.sql(sql, **_get_notebook_resolution_environment())
  except Exception as e:
    return e

  query = _bq.query(sql)
  variable_name = args['name']
  if variable_name:
    # Update the global namespace with the new variable, or update the value of
    # the existing variable if it already exists.
    if deployable:
      _bind_name_in_pipeline_environment(variable_name, query)
    else:
      _bind_name_in_notebook_environment(variable_name, query)
    if 'sample' not in args or not args['sample']:
      return None
  elif deployable:
    raise Exception('--name argument is required')

  if args['samplemethod'] is None:
    return query.results()

  count = args['samplecount']
  method = args['samplemethod']
  if method == 'random':
    sampling = _bq.Sampling.random(percent=args['samplepercent'], count=count)
  elif method == 'hashed':
    sampling = _bq.Sampling.hashed(field_name=args['samplefield'], percent=args['samplepercent'],
                                   count=count)
  elif method == 'sorted':
    ascending = args['sampleorder'] == 'ascending'
    sampling = _bq.Sampling.sorted(args['samplefield'], ascending=ascending, count=count)
  elif method == 'limit':
    sampling = _bq.Sampling.default(count=count)
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
  deployable = args['deployable']

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
  if deployable:
    _bind_name_in_pipeline_environment(variable_name, udf)
  else:
    _bind_name_in_notebook_environment(variable_name, udf)

  return None


def _execute_cell(args, sql):
  if sql:
    if args['query']:
      return "Cannot have a query parameter and a query cell body"
    try:
      sql = _bq.sql(sql, **_get_notebook_resolution_environment())
      query = _bq.query(sql)
    except Exception as e:
      return e
  else:
    if not args['query']:
      return "Need a query parameter or a query cell body"
    query = _get_query(args['query'])
    if not isinstance(query, _bq._Query):
      return "%s does not refer to a query" % args['query']

  return query.execute(args['table'], args['append'], args['overwrite'], not args['nocache'],
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
  orig_query = _get_pipeline_item(args['query'])
  if not orig_query:
    return "%s does not refer to a query" % args['query']

  if args['deployable']:
    env = _get_pipeline_resolution_environment()
    env.update(_get_pipeline_args(cell))
  else:
    # IPython environment takes precedence even over cell args, as cell args
    # could resolve to default values.
    # TODO(gram): fix this by creating a copy of the arg parser with all defaults set to None
    env = _get_notebook_resolution_environment()
    env.update({key: value for key, value in _get_pipeline_args(cell).iteritems()
                if value is not None and key not in env})

  # Perform expansion of the query to a new query
  try:
    sql = _bq.sql(orig_query.sql, **env)
    if args['dry']:
      return sql
    else:
      query = _bq.query(sql)
      # Run it and show results
      return query.execute().results
  except Exception as e:
    print str(e)


# An LRU cache for Tables. This is mostly useful so that when we cross page boundaries
# when paging through a table we don't have to re-fetch the schema.
_table_cache = _util.LRUCache(10)


def _get_table(name):
  """ Given a variable or table name, get a Table if it exists.

  Args:
    name: the name of the Table or a variable referencing the Table.
    deployable: True if this should be in the pipeline namespace only.
  Returns:
    The Table, if found.
  """
  # If name is a variable referencing a table, use that.
  item = _get_notebook_item(name)
  if item is None:
    item = _get_pipeline_item(name)

  if isinstance(item, _bq._Table):
    return item
  # Else treat this as a BQ table name and return the (cached) table if it exists.
  try:
    return _table_cache[name]
  except KeyError:
    table = _bq.table(name)
    if table.exists():
      _table_cache[name] = table
      return table
  return None


def _get_schema(name):
  """ Given a variable or table name, get the Schema if it exists. """
  item = _get_notebook_item(name)
  if not item:
    item = _get_table(name)

  if isinstance(item, _bq._Schema):
    return item
  try:
    if isinstance(item.schema, _bq._Schema):
      return item.schema
  except AttributeError:
    return None


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
