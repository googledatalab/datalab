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

import re
import gcp as _gcp
import gcp._util as _util
from _api import Api as _Api
from _query import Query as _Query
from _table import Table as _Table


def _create_api(project_id, credentials):
  """Helper method to create an initialized Api object.

  Args:
    project_id: the project id to be associated with API requests.
    credentials: the credentials associated with API requests.
  Returns:
    An Api object to make BigQuery HTTP API requests.
  """

  if project_id is None:
    project_id = _gcp.context.project_id
  if credentials is None:
    credentials = _gcp.context.credentials

  return _Api(credentials, project_id)


def query(sql_statement, project_id=None, credentials=None):
  """Creates a BigQuery query object.

  If a specific project id or credentials are unspecified, the default ones
  configured at the global level are used.

  Args:
    sql_statement: the SQL query to execute.
    project_id: the optional project id to use to execute the query.
    credentials: the optional credentials to authorize API calls.
  Returns:
    A query object that can be executed to retrieve data from BigQuery.
  """

  api = _create_api(project_id, credentials)
  return _Query(api, sql_statement)


def sql(sql_statement, **kwargs):
  """Formats SQL statements by replacing named tokens with actual values.

  Placeholders in SQL are represented as $<name>. If '$' must appear within the
  SQL statement literally, then it can be escaped as '$$'.

  Args:
    sql_statement: the raw SQL statement with named placeholders.
    **kwargs: the dictionary of name/value pairs to use for placeholder values.
  Returns:
    The formatted SQL statement with placeholders replaced with their values.
  Raises:
    Exception if a placeholder was found in the SQL statement, but did not have
    a corresponding argument value.
  """

  return _util.Sql.format(sql_statement, kwargs)


def table(name, project_id=None, credentials=None):
  """Creates a BigQuery table object.

  If a specific project id or credentials are unspecified, the default ones
  configured at the global level are used.

  The name must be a valid BigQuery table name, which is either
  <project]:<dataset>.<table> or <dataset>.<table>.

  Args:
    name: the name of the table.
    project_id: the optional project id to use to execute the query.
    credentials: the optional credentials to authorize API calls.
  Returns:
    A table object that can be used to retrieve table metadata from BigQuery.
  Raises:
    Exception if the name is invalid.
  """

  api = _create_api(project_id, credentials)
  return _Table(api, name)
