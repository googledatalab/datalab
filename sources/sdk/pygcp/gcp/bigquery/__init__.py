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
from ._dataset import DataSet as _DataSet
from ._dataset import DataSetLister as _DataSetLister
from ._dataset import DataSetName as _DataSetName
from ._job import Job as _Job
from ._query_job import QueryJob as _QueryJob
from ._query import Query as _Query
from ._sampling import Sampling
from ._table import Table as _Table
from ._table import TableName as _TableName
from ._table import TableSchema as _TableSchema
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


def datasetname(project_id, dataset_id):
  """ Construct a DataSetName named tuple.

  Args:
    project_id: the project ID
    dataset_id: the dataset ID
  Returns:
    A DataSetName named-tuple.
  """
  return _DataSetName(project_id, dataset_id)


def tablename(project_id, dataset_id, table_id):
  """ Construct a TableName named tuple.

  Args:
    project_id: the project ID
    dataset_id: the dataset ID
    table_id: tha Table ID
  Returns:
    A TableName named-tuple.
  """
  return _TableName(project_id, dataset_id, table_id)


def table(name, context=None):
  """Creates a BigQuery table object or returns the Table class for static calls.

  If a specific project id or credentials are unspecified, the default ones
  configured at the global level are used.

  The name must be a valid BigQuery table name, which is either
  <project]:<dataset>.<table> or <dataset>.<table>.

  Args:
    name: the name of the table, as a string or (project_id, dataset_id, table_id) tuple.
    context: an optional Context object providing project_id and credentials.
  Returns:
    A Table object that can be used to retrieve table metadata from BigQuery.
  Raises:
    Exception if the name is invalid.
  """
  api = _create_api(context)
  return _Table(api, name)


def datasets(project_id=None, context=None):
  api = _create_api(context)
  if not project_id:
    project_id = api.project_id
  return _DataSetLister(api, project_id)


def dataset(name, context=None):
  """Returns the Dataset with the specified dataset_id.

  Args:
    name: the name of the dataset, as a string or (project_id, dataset_id) tuple.
    context: an optional Context object providing project_id and credentials.
  Returns:
    A DataSet object.
  """
  api = _create_api(context)
  return _DataSet(api, name)


def schema(data=None, definition=None):
  """Creates a table schema from its JSON representation, a list of data, or a Pandas dataframe.

  Args:
    data: the Pandas Dataframe or list of data from which to infer the schema.
    definition: a definition of the schema as a list of dictionaries with 'name' and 'type' entries
        and possibly 'mode' and 'description' entries. Only used if no data argument was provided.
        'mode' can be 'NULLABLE', 'REQUIRED' or 'REPEATED'. For the allowed types, see:
        https://cloud.google.com/bigquery/preparing-data-for-bigquery#datatypes
  Returns:
    A TableSchema object.
  """
  return _TableSchema(data=data, definition=definition)


def job(job_id, context=None):
  """ Create a job reference for a specific job ID.

  Args:
    job_id: the job ID.
  Returns:
    A Job object.
  """
  api = _create_api(context)
  return _Job(api, job_id)


def query_job(job_id, table, context=None):
  """ Create a job reference for a specific query job ID.

  Args:
    job_id: the job ID.
    table: the Table that will be used for the query results.
  Returns:
    A QueryJob object.
  """
  api = _create_api(context)
  return _QueryJob(api, job_id, table)


