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

import datetime as _datetime
import time as _time
import IPython as _ipython
import IPython.core.magic as _magic
import gcp.bigquery as _bq
from ._commands import CommandParser as _CommandParser
from ._environments import _pipeline_environment, _exec_in_pipeline_module, _pipeline_arg_parser
from ._environments import _get_pipeline_item


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


def _table(val):
  """ A pseudo-type for bqmodule arguments allowing us to specify table names.

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


def _arg(name, default=None, offset=None, type=None, format=None, help=None):
  """ Add an argument to the pipeline arg parser.

  Args:
    name: the argument name; this will add a --name option to the arg parser.
    default: default value for the argument. For dates this can be 'now', 'today',
        'yesterday' or a string that should be suitable for passing to datetime.__init__.
    offset: for date arguments a string containing a comma-separated list of
      relative offsets to apply of the form <n><u> where <n> is an integer and
      <u> is a single character unit (d=day, m=month, y=year, h=hour, m=minute).
    type: the argument type. Can be a standard Python scalar or date or table.
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
      if type is None:
        arg_parser.add_argument('--%s' % name, default=default, help=help)
      else:
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


@_magic.register_cell_magic
def arguments(_, cell):
  """Implements the %%arguments cell magic for ipython notebooks.

  Args:
    cell: the contents of the cell interpreted as Python code. This should be calls to arg()
        only; anything else will not have any effect in a deployed pipeline.

  """
  try:
    # Define our special argument 'types'.
    _pipeline_environment()['date'] = _date
    _pipeline_environment()['table'] = _table

    # Define the arg helper function.
    _pipeline_environment()['arg'] = _arg

    # Reset the argument parser.
    _pipeline_environment()[_pipeline_arg_parser] = _CommandParser.create('')

    # Execute the cell which should be one or more calls to arg().
    _exec_in_pipeline_module(cell)
  except Exception as e:
    print str(e)

