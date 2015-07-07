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

import IPython.core.magic as _magic
import gcp.bigquery as _bq
from ._commands import CommandParser as _CommandParser
from ._environments import _get_pipeline_resolution_environment, _resolve, _pipeline_sql
from ._environments import _pipeline_environment
from ._utils import _handle_magic_line


def _create_sql_parser():
  sql_parser = _CommandParser('create a named SQL')
  sql_parser.add_argument('-n', '--name', help='the name for this SQL', required=True)
  sql_parser.set_defaults(func=lambda args, cell: sql_cell(args, cell))
  return sql_parser


_sql_parser = _create_sql_parser()


@_magic.register_cell_magic
def sql(line, cell):
  return _handle_magic_line(line, cell, _sql_parser)


def sql_cell(args, sql):
  """Implements the SQL bigquery cell magic for ipython notebooks.

  The supported syntax is:
  %%sql [--name <var>]
  <sql>

  Args:
    args: the optional arguments following '%%sql'.
    sql: the contents of the cell interpreted as the SQL.
  Returns:
    The results of executing the query if no variable was specified. None otherwise.
  """
  try:
    complete, partial = _get_pipeline_resolution_environment()
    # Test for hermeticity...
    _resolve(sql, complete, partial)
    # ... but record the unexpanded query
    query = _bq.query(sql)
  except Exception as e:
    return e

  variable_name = args['name']
  if variable_name:
    _pipeline_environment()[_pipeline_sql][variable_name] = query
  else:
    # TODO(gram): need expansion first??
    return query.results()
