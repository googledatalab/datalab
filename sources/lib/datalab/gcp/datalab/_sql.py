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

"""Google Cloud Platform library - %%arguments IPython Cell Magic Functionality."""

import argparse
import datetime
import imp
import re
import sys
import time
import IPython
import IPython.core.magic
import gcp.bigquery
import gcp.data
import _commands
import _utils


def _create_sql_parser():
  sql_parser = _commands.CommandParser(prog="%%sql",
                                       formatter_class=argparse.RawDescriptionHelpFormatter,
                                       description="""
Create a named SQL module with one or more queries.

The cell body should contain an optional initial part defining the default
values for the variables, if any, using Python code, followed by one or more
queries.

Queries should start with 'DEFINE QUERY <name>' in order to bind them to
<module name>.<query name> in the notebook (as gcp.data.SqlStatement instances).
The final query can optionally omit 'DEFINE QUERY <name>', as using the module
name in places where a SqlStatement is expected will resolve to the final query
in the module.

Queries can refer to variables with '$<name>', as well as refer to other queries
within the same module, making it easy to compose nested queries and test their
parts.

The Python code defining the variable default values can assign scalar or list/tuple values to
variables, or one of the special functions 'datestring' and 'source'.

When a variable with a 'datestring' default is expanded it will expand to a formatted
string based on the current date, while a 'source' default will expand to a table whose
name is based on the current date.

datestring() takes two named arguments, 'format' and 'offset'. The former is a
format string that is the same as for Python's time.strftime function. The latter
is a string containing a comma-separated list of expressions such as -1y, +2m,
etc; these are offsets from the time of expansion that are applied in order. The
suffix (y, m, d, h, M) correspond to units of years, months, days, hours and
minutes, while the +n or -n prefix is the number of units to add or subtract from
the time of expansion. Three special values 'now', 'today' and 'yesterday' are
also supported; 'today' and 'yesterday' will be midnight UTC on the current date
or previous days date.

source() can take a 'name' argument for a fixed table name, or 'format' and 'offset'
arguments similar to datestring(), but unlike datestring() will resolve to a Table
with the specified name.
""")
  sql_parser.add_argument('-m', '--module', help='The name for this SQL module')
  sql_parser.set_defaults(func=lambda args, cell: sql_cell(args, cell))
  return sql_parser


_sql_parser = _create_sql_parser()


# Register the line magic as well as the cell magic so we can at least give people help
# without requiring them to enter cell content first.
@IPython.core.magic.register_line_cell_magic
def sql(line, cell):
  """ Create a SQL module with one or more queries. Use %sql --help for more details.

    The supported syntax is:

    %%sql [--module <modulename>]
    [<optional Python code for default argument values>]
    [<optional named queries>]
    [<optional unnamed query>]

    At least one query should be present. Named queries should start with:

      DEFINE QUERY <name>

    on a line by itself.

  Args:
    line: the optional arguments following '%%sql'.
    cell: the contents of the cell; Python code for arguments followed by SQL queries.
   """
  if cell is None:
    _sql_parser.print_help()
  else:
    return _utils.handle_magic_line(line, cell, _sql_parser)


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
    when = datetime.datetime.utcnow()
  elif val == 'today':
    dt = datetime.datetime.utcnow()
    when = datetime.datetime(dt.year, dt.month, dt.day)
  elif val == 'yesterday':
    dt = datetime.datetime.utcnow() - datetime.timedelta(1)
    when = datetime.datetime(dt.year, dt.month, dt.day)
  else:
    when = datetime.datetime.strptime(val, "%Y%m%d")
  if offset is not None:
    for part in offset.split(','):
      unit = part[-1]
      quantity = int(part[:-1])
      # We can use timedelta for days and under, but not for years and months
      if unit == 'y':
        when = datetime.datetime(year=when.year + quantity, month=when.month, day=when.day,
                                 hour=when.hour, minute=when.minute)
      elif unit == 'm':
        new_year = when.year
        new_month = when.month + quantity
        if new_month < 1:
          new_month = -new_month
          new_year += 1 + (new_month // 12)
          new_month = 12 - new_month % 12
        elif new_month > 12:
          new_year += (new_month - 1) // 12
          new_month = 1 + (new_month - 1) % 12
        when = datetime.datetime(year=new_year, month=new_month, day=when.day,
                                 hour=when.hour, minute=when.minute)
      elif unit == 'd':
        when += datetime.timedelta(days=quantity)
      elif unit == 'h':
        when += datetime.timedelta(hours=quantity)
      elif unit == 'M':
        when += datetime.timedelta(minutes=quantity)

  return when


def _resolve_table(v, format, delta):
  try:
    when = _date(v, delta)
    v = time.strftime(format, when.timetuple())
  except Exception:
    pass
  return gcp.bigquery.Table(v)


def _make_string_formatter(f, offset=None):
  """ A closure-izer for string arguments that include a format and possibly an offset. """
  format = f
  delta = offset
  return lambda v: time.strftime(format, (_date(v, delta)).timetuple())


def _make_table_formatter(f, offset=None):
  """ A closure-izer for table arguments that include a format and possibly an offset. """
  format = f
  delta = offset
  return lambda v: _resolve_table(v, format, delta)


def _make_table(v):
  return gcp.bigquery.Table(v)


def _datestring(format, offset=''):
  return {'type': 'datestring', 'format': format, 'offset': offset}


def _table(name=None, format=None, offset=''):
  return {'type': 'table', 'name': name, 'format': format, 'offset': offset}


def _arguments(code, module):
  """Define pipeline arguments.

  Args:
    code: the Python code to execute that defines the arguments.

  """
  arg_parser = _commands.CommandParser.create('')
  try:
    # Define our special argument 'types' and add them to the environment.
    builtins = {'source': _table, 'datestring': _datestring}
    env = {}
    env.update(builtins)

    # Execute the cell which should be one or more calls to arg().
    exec code in env

    # Iterate through the module dictionary. For any newly defined objects,
    # add args to the parser.
    for key in env:

      # Skip internal/private stuff.
      if key in builtins or key[0] == '_':
        continue
      # If we want to support importing query modules into other query modules, uncomment next 4
      # Skip imports but add them to the module
      # if isinstance(env[key], types.ModuleType):
      #   module.__dict__[key] = env[key]
      #   continue

      val = env[key]
      key = '--%s' % key

      if isinstance(val, bool):
        if val:
          arg_parser.add_argument(key, default=val, action='store_true')
        else:
          arg_parser.add_argument(key, default=val, action='store_false')
      elif isinstance(val, basestring) or isinstance(val, int) or isinstance(val, float) \
          or isinstance(val, long):
        arg_parser.add_argument(key, default=val)
      elif isinstance(val, list):
        arg_parser.add_argument(key, default=val, nargs='+')
      elif isinstance(val, tuple):
        arg_parser.add_argument(key, default=list(val), nargs='+')

      # Is this one of our pseudo-types for dates/tables?
      elif isinstance(val, dict) and 'type' in val:
        if val['type'] == 'datestring':
          arg_parser.add_argument(key, default='',
                                  type=_make_string_formatter(val['format'],
                                                              offset=val['offset']))
        elif val['type'] == 'table':
          if val['format'] is not None:
            arg_parser.add_argument(key, default='',
                                    type=_make_table_formatter(val['format'],
                                                               offset=val['offset']))
          else:
            arg_parser.add_argument(key, default=val['name'], type=_make_table)
        else:
          raise Exception('Cannot generate argument for %s of type %s' % (key, type(val)))
      else:
        raise Exception('Cannot generate argument for %s of type %s' % (key, type(val)))

  except Exception as e:
    print "%%sql arguments: %s from code '%s'" % (str(e), str(code))
  return arg_parser


def _split_cell(cell, module):
  """ Split a hybrid %%sql cell into the Python code and the queries.

    Populates a module with the queries.

  Args:
    cell: the contents of the %%sql cell.
    module: the module that the contents will populate.

  Returns:
    The default (last) query for the module.

  """
  lines = cell.split('\n')
  code = None
  last_def = -1
  name = None
  define_wild_re = re.compile('^DEFINE\s+.*$', re.IGNORECASE)
  define_re = re.compile('^DEFINE\s+QUERY\s+([A-Z]\w*)\s*?(.*)$', re.IGNORECASE)
  select_re = re.compile('^SELECT\s*.*$', re.IGNORECASE)
  # TODO(gram): a potential issue with this code is if we have leading Python code followed
  # by a SQL-style comment before we see SELECT/DEFINE. When switching to the tokenizer see
  # if we can address this.
  for i, line in enumerate(lines):
    define_match = define_re.match(line)
    select_match = select_re.match(line)
    if select_match and i:
      # Avoid matching if previous token was '('
      # TODO: handle the possibility of comments immediately preceding SELECT
      prior_content = ''.join(lines[:i]).strip()
      select_match = len(prior_content) == 0 or prior_content[-1] != '('

    if define_match or select_match:
      # If this is the first query, get the preceding Python code.
      if code is None:
        code = ('\n'.join(lines[:i])).strip()
        if len(code):
          code += '\n'
      elif last_def >= 0:

        # This is not the first query, so gather the previous query text.
        query = '\n'.join([line for line in lines[last_def:i] if len(line)]).strip()
        if select_match and name != gcp.data.SqlModule._SQL_MODULE_MAIN and len(query) == 0:
          # Avoid DEFINE query name\nSELECT ... being seen as an empty DEFINE followed by SELECT
          continue

        # Save the query
        statement = gcp.data.SqlStatement(query, module)
        module.__dict__[name] = statement
        # And set the 'last' query to be this too
        module.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST] = statement

      # Get the query name and strip off our syntactic sugar if appropriate.
      if define_match:
        name = define_match.group(1)
        lines[i] = define_match.group(2)
      else:
        name = gcp.data.SqlModule._SQL_MODULE_MAIN

      # Save the starting line index of the new query
      last_def = i
    else:
      define_wild_match = define_wild_re.match(line)
      if define_wild_match:
        raise Exception('Expected "DEFINE QUERY <name>"')

  if last_def >= 0:
    # We were in a query so save this tail query.
    query = '\n'.join([line for line in lines[last_def:] if len(line)]).strip()
    statement = gcp.data.SqlStatement(query, module)
    module.__dict__[name] = statement
    module.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST] = statement

  if code is None:
    code = ''
  module.__dict__[gcp.data.SqlModule._SQL_MODULE_ARGPARSE] = _arguments(code, module)
  return module.__dict__.get(gcp.data.SqlModule._SQL_MODULE_LAST, None)


def sql_cell(args, cell):
  """Implements the SQL cell magic for ipython notebooks.

  The supported syntax is:

      %%sql [--module <modulename>]
      [<optional Python code for default argument values>]
      [<optional named queries>]
      [<optional unnamed query>]

  At least one query should be present. Named queries should start with:

      DEFINE QUERY <name>

  on a line by itself.

  Args:
    args: the optional arguments following '%%sql'.
    cell: the contents of the cell; Python code for arguments followed by SQL queries.
  """
  name = args['module'] if args['module'] else '_sql_cell'
  module = imp.new_module(name)
  query = _split_cell(cell, module)
  ipy = IPython.get_ipython()
  if not args['module']:
      # Execute now
      if query:
        return gcp.bigquery.Query(query, values=ipy.user_ns).execute().results
  else:
    # Add it as a module
    sys.modules[name] = module
    exec 'import %s' % name in ipy.user_ns
