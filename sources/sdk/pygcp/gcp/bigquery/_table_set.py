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

"""Implements TableSet which represents table wildcards in BigQuery."""

import datetime
import json

class TableSet(object):

  _MAGIC = 0xdeadbeef

  @staticmethod
  def table_range_cell(prefix, cell, strict=False):
    """ Factory constructor used for range-style TableSets specified via a cell magic.

      While Python code allows us to specify start and end as separate parameters that is more
      difficult with a cell magic. We allow the user to specify these as comma-separated
      expressions but  don't try to parse them; they are simply substituted in to a TABLE_DATE_RANGE
      call and we leave the parsing to BigQuery.

    Args:
      prefix: a table name prefix that tables must match.
      cell: the contents of the cell magic containing the start and end expressions.
      strict: whether to expand with TABLE_DATE_RANGE or TABLE_DATE_RANGE_STRICT.
    Returns:
      A TableSet for the table range.
    """
    return TableSet(TableSet._MAGIC, prefix=prefix, range=cell, strict=strict)

  @staticmethod
  def table_range(prefix, start, end=None, strict=False):
    """ Factory constructor used for range-style TableSets allocated from Python code.

    Args:
      prefix: a table name prefix that tables must match.
      start: a SQL expression as a string, or a Python DateTime, for the start of the range.
      end: a SQL expression as a string, or a Python DateTime, for the end of the range.
      strict: whether to expand with TABLE_DATE_RANGE or TABLE_DATE_RANGE_STRICT.
    Returns:
      A TableSet for the table range.
    """

    if end is None:
      end = start
    if isinstance(start, datetime.date):
      start = 'TIMESTAMP(\'%s\')' % start.isoformat()
    if isinstance(end, datetime.date):
      end = 'TIMESTAMP(\'%s\')' % end.isoformat()
    return TableSet(TableSet._MAGIC, prefix=prefix, start=start, end=end, strict=strict)

  @staticmethod
  def table_query(dataset, expr):
    """ Factory constructor used for query-style TableSets.

    Args:
      dataset: a dataset name from which tables are selected.
      expr: a SQL expression evaluated for each table to see if it is in the set.
    Returns:
      A TableSet for the table query.
    """
    return TableSet(TableSet._MAGIC, dataset=dataset, expr=expr)

  def __init__(self, id, prefix=None, start=None, end=None, strict=False, dataset=None, expr=None,
               range=None):
    """ Private constructor for TableSets.

    As we can't have private methods in Python we just use a 'magic' parameter to catch
    inadvertent use of this constructor.

    Args:
      id: 'magic' ID used to prevent accidental calls.
      prefix: a table name prefix that tables must match.
      start: a SQL expression as a string for the start of the range.
      end: a SQL expression as a string for the end of the range.
      strict: whether to expand ranges with TABLE_DATE_RANGE or TABLE_DATE_RANGE_STRICT.
      dataset: a dataset name from which tables are selected.
      expr: a SQL expression evaluated for each table to see if it is in the set.
      range: the contents of the cell magic containing the start and end expressions.
    """
    if id != TableSet._MAGIC:
      raise "Only allocate TableSets through factory methods"

    if prefix:
      if strict:
        if end:
          self._repr = '(TABLE_DATE_RANGE_STRICT(%s,%s,%s))' % (prefix, start, end)
        else:
          self._repr = '(TABLE_DATE_RANGE_STRICT(%s,%s))' % (prefix, range)
      else:
        if end:
          self._repr = '(TABLE_DATE_RANGE(%s,%s,%s))' % (prefix, start, end)
        else:
          self._repr = '(TABLE_DATE_RANGE(%s,%s))' % (prefix, range)
    else:
      expr = ' '.join(expr.split('\n'))
      self._repr = '(TABLE_QUERY(%s, %s))' % (dataset, json.dumps(expr))

  def __repr__(self):
    return self._repr

  def _repr_sql_(self):
    """Returns a representation of the table set for embedding into a SQL statement.

    Returns:
      A formatted table set expression for use within FROM clauses of SQL statements.
    """
    return self._repr
