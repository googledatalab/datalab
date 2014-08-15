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

import gcp as _gcp
import gcp._util as _util
from ._api import Api as _Api
from ._query import Query as _Query
from ._sampling import Sampling
from ._table import Table as _Table
from ._table import TableList as _TableList
from ._udf import Function as _Function


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


def udf(inputs, outputs, implementation, context=None):
  """Creates a BigQuery SQL UDF query object.

  The implementation is a javascript function of the form:
    function(row, emitFn) { ... }
  where the row matches a structure represented by inputs, and the emitFn
  is a function that accepts a structure represented by outputs.

  Args:
    inputs: a list of (name, type) tuples representing the schema of input.
    outputs: a list of (name, type) tuples representing the schema of the output.
    implementation: a javascript function defining the UDF logic.
    context: an optional Context object providing project_id and credentials.
  """
  api = _create_api(context)
  return _Function(api, inputs, outputs, implementation)


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
    A Table object that can be used to retrieve table metadata from BigQuery.
  Raises:
    Exception if the name is invalid.
  """
  api = _create_api(context)
  return _Table(api, name)


def tables(dataset_id, count=0, context=None):
  """Retrieves a list of tables with the specified dataset.

  Args:
    dataset_id: the name of the dataset.
    count: optional maximum number of tables to retrieve.
    context: an optional Context object providing project_id and credentials.
  Returns:
    A TableList object that can be used to iterate over the tables.
  Raises:
    Exception if the table list could not be retrieved or the table list response was malformed.
  """
  api = _create_api(context)
  table_list_result = api.tables_list(dataset_id, max_results=count)

  table_objects = []
  try:
    for table_info in table_list_result['tables']:
      table_ref = table_info['tableReference']
      name = (table_ref['projectId'], dataset_id, table_ref['tableId'])
      table_objects.append(_Table(api, name))
  except KeyError:
    raise Exception('Unexpected table list response.')

  return _TableList(table_objects)
