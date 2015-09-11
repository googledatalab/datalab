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
import gcp.sql as _sql

import _api
import _bqjob
import _dataset
import _query
import _query_job
import _query_stats
import _sampling
import _schema
import _table
import _udf
import _utils
import _view


def _create_api(context):
  """Helper method to create an initialized Api object.

  Args:
    context: a Context object providing project_id and credentials.
  Returns:
    An Api object to make BigQuery HTTP API requests.
  """
  if context is None:
    context = _gcp.Context.default()
  return _api.Api(context.credentials, context.project_id)


def query(sql_statement, args=None, context=None):
  """Creates a BigQuery query object.

  If a specific project id or credentials are unspecified, the default ones
  configured at the global level are used.

  Args:
    sql_statement: the SQL query or %%sql SqlStatement to execute.
    args: an optional dictionary to use when expanding the variables if passed a SqlStatement.
    context: an optional Context object providing project_id and credentials.
  Returns:
    A query object that can be executed to retrieve data from BigQuery.
  """
  api = _create_api(context)
  code = None
  if args or not isinstance(sql_statement, basestring):
    sql_statement, code = _sql.SqlModule.expand(sql_statement, args)
  return _query.Query(api, sql_statement, code)


def udf(inputs, outputs, name, implementation, context=None):
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
  return _udf.Function(api, inputs, outputs, name, implementation)


def table(name, context=None):
  """Creates a BigQuery table object.

  If a specific project id or credentials are unspecified, the default ones
  configured at the global level are used.

  The name must be a valid BigQuery table name, which is either
  <project>:<dataset>.<table> or <dataset>.<table>.

  Args:
    name: the name of the table, as a string or (project_id, dataset_id, table_id) tuple.
    context: an optional Context object providing project_id and credentials.
  Returns:
    A Table object that can be used to retrieve table metadata from BigQuery.
  Raises:
    Exception if the name is invalid.
  """
  api = _create_api(context)
  return _table.Table(api, name)


def view(name, context=None):
  """Creates a BigQuery View object.

  If a specific project id or credentials are unspecified, the default ones
  configured at the global level are used.

  The name must be a valid BigQuery view name, which is either
  <project>:<dataset>.<view> or <dataset>.<view>.

  Args:
    name: the name of the view, as a string or (project_id, dataset_id, view_id) tuple.
    context: an optional Context object providing project_id and credentials.
  Returns:
    A View object that can be used to retrieve table metadata from BigQuery.
  Raises:
    Exception if the name is invalid.
  """
  api = _create_api(context)
  return _view.View(api, name)


def datasets(project_id=None, context=None):
  """ Returns an object that can be used to iterate through the datasets in a project.

  Args:
    project_id: the ID of the project whose datasets should be enumerated.
    context: an optional Context object providing project_id and credentials.
  Returns:
    An iterable for enumerating the datasets.
  """
  api = _create_api(context)
  if not project_id:
    project_id = api.project_id
  return _dataset.DataSetLister(api, project_id)


def dataset(name, context=None):
  """Returns the Dataset with the specified dataset_id.

  Args:
    name: the name of the dataset, as a string or (project_id, dataset_id) tuple.
    context: an optional Context object providing project_id and credentials.
  Returns:
    A DataSet object.
  """
  api = _create_api(context)
  return _dataset.DataSet(api, name)


def schema(source):
  """Creates a table/view schema from its JSON representation, a list of data, or a Pandas
     dataframe.

  Args:
    source: the Pandas Dataframe or list of data from which to infer the schema, or
        a definition of the schema as a list of dictionaries with 'name' and 'type' entries
        and possibly 'mode' and 'description' entries. Only used if no data argument was provided.
        'mode' can be 'NULLABLE', 'REQUIRED' or 'REPEATED'. For the allowed types, see:
        https://cloud.google.com/bigquery/preparing-data-for-bigquery#datatypes
  Returns:
    A Schema object.
  """
  return _schema.Schema.from_data(source)


def wait_any(jobs, timeout=None):
  """ Return when at least one of the specified jobs has completed or timeout expires.

  Args:
    jobs: a list of Jobs to wait on.
    timeout: a timeout in seconds to wait for. None (the default) means no timeout.
  Returns:
    Once at least one job completes, a list of all completed jobs.
    If the call times out then an empty list will be returned.

  """
  return _util.Job.wait_any(jobs, timeout)


def wait_all(jobs, timeout=None):
  """ Return when at all of the specified jobs have completed or timeout expires.

  Args:
    jobs: a single Job or list of Jobs to wait on.
    timeout: a timeout in seconds to wait for. None (the default) means no timeout.
  Returns:
    A list of completed Jobs. If the call timed out this will be shorter than the
    list of jobs supplied as a parameter.
  """
  return _util.Job.wait_all(jobs, timeout)
