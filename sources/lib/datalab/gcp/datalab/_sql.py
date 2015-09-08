# Copyright 2015 Google Inc. All rights reserved.
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

"""Google Cloud Platform library - %%arguments IPython Cell Magic Functionality."""

import datetime
import imp
import sys
import time
import IPython
import IPython.core.magic
import gcp.bigquery
import gcp.sql
import _commands
import _utils


def _create_sql_parser():
  sql_parser = _commands.CommandParser('create a named SQL')
  sql_parser.add_argument('-n', '--name', help='the name for this SQL')
  sql_parser.set_defaults(func=lambda args, cell: sql_cell(args, cell))
  return sql_parser


_sql_parser = _create_sql_parser()


@IPython.core.magic.register_cell_magic
def sql(line, cell):
  return _utils.handle_magic_line(line, cell, _sql_parser)

# TODO(gram): Perhaps this should go in SqlModule?


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
      elif unit == 'm':
        when += datetime.timedelta(minutes=quantity)

  return when


def _resolve_table(v, format, delta):
  try:
    when = _date(v, delta)
    v = time.strftime(format, when.timetuple())
  except Exception:
    pass
  return gcp.bigquery.table(v)


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
  return gcp.bigquery.table(v)


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
    # Define our special argument 'types'.
    env = {'table': _table, 'datestring': _datestring}

    # Execute the cell which should be one or more calls to arg().
    exec code in env

    # Iterate through the module dictionary and for any newly defined objects
    # add args to the parser.
    for key in env:

      # Skip internal stuff.
      if key == 'datestring' or key == 'table' or key[0] == '_':
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
  """ Split a hybrid cell into the Python code and the queries.

  Args:
    cell: the contents of the %%sql cell.
    module: the module that the contents will populate.

  Returns:
    The default (last) query for the module.

  """
  code = gcp.sql.SqlModule.split_cell(cell, module)
  gcp.sql.SqlModule.set_arg_parser(module, _arguments(code, module))
  return gcp.sql.SqlModule.get_query_from_module(module)


def sql_cell(args, cell):
  """Implements the SQL cell magic for ipython notebooks.

  The supported syntax is:

      %%sql [--name <modulename>]
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
  name = args['name'] if args['name'] else '_sql_cell'
  module = imp.new_module(name)
  query = _split_cell(cell, module)
  ipy = IPython.get_ipython()
  if not args['name']:
      # Execute now
      if query:
        return gcp.bigquery.query(query, ipy.user_ns).execute().results
  else:
    # Add it as a module
    sys.modules[name] = module
    exec 'import %s' % name in ipy.user_ns
