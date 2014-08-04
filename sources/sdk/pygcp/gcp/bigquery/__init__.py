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

"""Google Cloud Platform library - BigQuery Functionality."""

import re
import gcp as _gcp
import gcp._util as _util
from ._api import Api as _Api
from ._query import Query as _Query
from ._table import Table as _Table


def _create_api(context):
  """Helper method to create an initialized Api object.

  Args:
    context: a Context object providing project_id and credentials.
  Returns:
    An Api object to make BigQuery HTTP API requests.
  """

  if context is None:
    context = _gcp.Context.default()
  return _Api(context.credentials, context.project_id)


def query(sql_statement, context=None):
  """Creates a BigQuery query object.

  If a specific project id or credentials are unspecified, the default ones
  configured at the global level are used.

  Args:
    sql_statement: the SQL query to execute.
    context: an optional Context object providing project_id and credentials.
  Returns:
    A query object that can be executed to retrieve data from BigQuery.
  """

  api = _create_api(context)
  return _Query(api, sql_statement)


def sql(sql_template, **kwargs):
  """Formats SQL templates by replacing placeholders with actual values.

  Placeholders in SQL are represented as $<name>. If '$' must appear within the
  SQL statement literally, then it can be escaped as '$$'.

  Args:
    sql_template: the template of the SQL statement with named placeholders.
    **kwargs: the dictionary of name/value pairs to use for placeholder values.
  Returns:
    The formatted SQL statement with placeholders replaced with their values.
  Raises:
    Exception if a placeholder was found in the SQL statement, but did not have
    a corresponding argument value.
  """

  return _util.Sql.format(sql_template, kwargs)


def table(name, context=None):
  """Creates a BigQuery table object.

  If a specific project id or credentials are unspecified, the default ones
  configured at the global level are used.

  The name must be a valid BigQuery table name, which is either
  <project]:<dataset>.<table> or <dataset>.<table>.

  Args:
    name: the name of the table.
    context: an optional Context object providing project_id and credentials.
  Returns:
    A table object that can be used to retrieve table metadata from BigQuery.
  Raises:
    Exception if the name is invalid.
  """

  api = _create_api(context)
  return _Table(api, name)
