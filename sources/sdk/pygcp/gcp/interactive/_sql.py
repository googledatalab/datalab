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

import collections
import datetime as _datetime
import re as _re
import time as _time
import IPython.core.magic as _magic
import gcp.bigquery as _bq
import gcp._util as _util
from ._commands import CommandParser as _CommandParser
from ._utils import _handle_magic_line
from ._environments import _get_resolution_environment
from ._environments import _notebook_environment
from ._environments import _pipeline_arg_parser


class SqlUnit(object):

  def __init__(self, python_code, definitions):
    self.arg_parser = SqlUnit.arguments(python_code if python_code else '')
    self.definitions = {}
    if not definitions:
      definitions = []
    for query_definition in definitions:
      name = query_definition.name
      sql = _util.SqlStatement(query_definition.sql)
      self.last_name = name
      self.last_sql = self.__dict__[name] = self.definitions[name] = sql

  @staticmethod
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

  @staticmethod
  def _resolve_table(v, format, delta):
    try:
      when = SqlUnit._date(v, delta)
      v = _time.strftime(format, when.timetuple())
    except Exception:
      pass
    return _bq.table(v)

  @staticmethod
  def _make_string_formatter(f, offset=None):
    """ A closure-izer for string arguments that include a format and possibly an offset. """
    format = f
    delta = offset
    return lambda v: _time.strftime(format, (SqlUnit._date(v, delta)).timetuple())

  @staticmethod
  def _make_table_formatter(f, offset=None):
    """ A closure-izer for table arguments that include a format and possibly an offset. """
    format = f
    delta = offset
    return lambda v: SqlUnit._resolve_table(v, format, delta)

  @staticmethod
  def _make_table(v):
    return _bq.table(v)

  @staticmethod
  def _datestring(format, offset=''):
    return {'type': 'datestring', 'format': format, 'offset': offset}

  @staticmethod
  def _table(name=None, format=None, offset=''):
    return {'type': 'table', 'name': name, 'format': format, 'offset': offset}

  @staticmethod
  def arguments(code):
    """Define pipeline arguments.

    Args:
      code: the Python code to execute that defines the arguments.

    """
    arg_parser = _CommandParser.create('')
    try:
      # Define our special argument 'types'.
      env = {}
      env['table'] = SqlUnit._table
      env['datestring'] = SqlUnit._datestring

      # Execute the cell which should be one or more calls to arg().
      exec code in env

      # Iterate through the module dictionary and for any newly defined objects
      # add args to the parser.
      for key in env:

        # Skip internal stuff.
        if key == 'datestring' or key == 'table' or key == _pipeline_arg_parser or key[0] == '_':
          continue

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
                                    type=SqlUnit._make_string_formatter(val['format'],
                                                                        offset=val['offset']))
          elif val['type'] == 'table':
            if val['format'] is not None:
              arg_parser.add_argument(key, default='',
                                      type=SqlUnit._make_table_formatter(val['format'],
                                                                         offset=val['offset']))
            else:
              arg_parser.add_argument(key, default=val['name'], type=SqlUnit._make_table)
          else:
            raise Exception('Cannot generate argument for %s of type %s' % (key, type(val)))
        else:
          raise Exception('Cannot generate argument for %s of type %s' % (key, type(val)))

    except Exception as e:
      print "%%sql arguments: %s from code '%s'" % (str(e), str(code))
    return arg_parser


def _create_sql_parser():
  sql_parser = _CommandParser('create a named SQL')
  sql_parser.add_argument('-n', '--name', help='the name for this SQL')
  sql_parser.set_defaults(func=lambda args, cell: sql_cell(args, cell))
  return sql_parser


_sql_parser = _create_sql_parser()


@_magic.register_cell_magic
def sql(line, cell):
  return _handle_magic_line(line, cell, _sql_parser)


QueryDefinition = collections.namedtuple('QueryDefinition', ['name', 'sql'])


def _split_cell(cell):
  """ Split a hybrid cell into the Python code and the queries. """
  lines = cell.split('\n')
  code = None
  definitions = []
  last_def = -1
  name = None
  define_re =\
      _re.compile('^[Dd][Ee][Ff][Ii][Nn][Ee]\s+[Qq][Uu][Ee][Rr][Yy]\s+([A-Za-z]\w*)\s*?(.*)$')
  select_re = _re.compile('^[Ss][Ee][Ll][Ee][Cc][Tt]\s*[^=]*$')
  for i, line in enumerate(lines):
    # Strip comment lines; doing this here means we can allow comments in SQL QUERY sections too.
    if len(line) and line[0] == '#':
      continue
    define_match = define_re.match(line)
    select_match = select_re.match(line)
    if define_match or select_match:
      # If this is the first query, get the preceding Python code.
      if code is None:
        code = ('\n'.join(lines[:i])).strip()
        if len(code):
          code += '\n'
      elif last_def >= 0:

        # This is not the first query, so gather the previous query text.
        query = '\n'.join(lines[last_def:i]).strip()
        if select_match and name != '_' and len(query) == 0:
          # Avoid DEFINE query name\nSELECT ... being seen as an empty DEFINE followed by SELECT
          continue

        # Save the query
        definitions.append(QueryDefinition(name, query))

      # Get the query name and strip off our syntactic sugar if appropriate.
      if define_match:
        name = define_match.group(1)
        lines[i] = define_match.group(2)
      else:
        name = '_'

      # Save the starting line index of the new query
      last_def = i

  if last_def >= 0:
    # We were in a query so save this tail query.
    query = '\n'.join(lines[last_def:]).strip()
    definitions.append(QueryDefinition(name, query))

  if code is None:
    code = ''

  return code, definitions


def sql_cell(args, cell):
  """Implements the SQL cell magic for ipython notebooks.

  The supported syntax is:
  %%sql
  <cell>

  Args:
    args: the optional arguments following '%%sql'.
    cell: the contents of the cell interpreted as Python arguments followed by SQL queries.
  """

  python, definitions = _split_cell(cell)

  unit = SqlUnit(python_code=python, definitions=definitions)

  # For backwards compat, if we have a single query with no defines and no
  # code, we expand that in the notebook environment.
  # TODO(gram): it's good to support the easy exploratory analysis we had before, but
  # the semantics here are not intuitive to users. We need to come up with a better way
  # to distinguish between %%sqls that are meant for deployment and use params and ones
  # that are meant for exploration and use notebook environment.
  if len(python) == 0 and len(unit.definitions) == 1 and unit.last_name == '_':
    expanded =_util.SqlStatement.format(unit.definitions['_'].sql, _notebook_environment())
    query = _bq.query(expanded)
    if args['name']:
      _notebook_environment()[args['name']] = query
    return query.execute().results

  if args['name']:
    _notebook_environment()[args['name']] = unit

  if unit.last_name == '_':
    query = _bq.query(unit.last_sql)
    args = _get_resolution_environment(unit)
    return query.execute(args=args).results

