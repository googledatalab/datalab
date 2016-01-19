# Copyright 2015 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
# in compliance with the License. You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the License
# is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
# or implied. See the License for the specific language governing permissions and limitations under
# the License.

"""Implements BigQuery HTTP API wrapper."""

import gcp
import gcp._util


class Api(object):
  """A helper class to issue BigQuery HTTP requests."""

  # TODO(nikhilko): Use named placeholders in these string templates.
  # TODO(gram): Remove default params from this class's methods.
  _ENDPOINT = 'https://www.googleapis.com/bigquery/v2'
  _JOBS_PATH = '/projects/%s/jobs/%s'
  _QUERIES_PATH = '/projects/%s/queries/%s'
  _DATASETS_PATH = '/projects/%s/datasets/%s'
  _TABLES_PATH = '/projects/%s/datasets/%s/tables/%s%s'
  _TABLEDATA_PATH = '/projects/%s/datasets/%s/tables/%s%s/data'

  _DEFAULT_PAGE_SIZE = 1024
  _DEFAULT_TIMEOUT = 60000

  def __init__(self, context):
    """Initializes the BigQuery helper with context information.

    Args:
      context: a Context object providing project_id and credentials.
    """
    self._credentials = context.credentials
    self._project_id = context.project_id

  @property
  def project_id(self):
    """The project_id associated with this API client."""
    return self._project_id

  def jobs_insert_load(self, source, table_name, append=False, overwrite=False, create=False,
                       source_format='CSV', field_delimiter=',', allow_jagged_rows=False,
                       allow_quoted_newlines=False, encoding='UTF-8', ignore_unknown_values=False,
                       max_bad_records=0, quote='"', skip_leading_rows=0):
    """ Issues a request to load data from GCS to a BQ table

    Args:
      source: the URL of the source bucket(s). Can include wildcards, and can be a single
          string argument or a list.
      table_name: a tuple representing the full name of the destination table.
      append: if True append onto existing table contents.
      overwrite: if True overwrite existing table contents.
      create: if True, create the table if it doesn't exist
      source_format: the format of the data; default 'CSV'. Other options are DATASTORE_BACKUP
          or NEWLINE_DELIMITED_JSON.
      field_delimiter: The separator for fields in a CSV file. BigQuery converts the string to
          ISO-8859-1 encoding, and then uses the first byte of the encoded string to split the data
          as raw binary (default ',').
      allow_jagged_rows: If True, accept rows in CSV files that are missing trailing optional
          columns; the missing values are treated as nulls (default False).
      allow_quoted_newlines: If True, allow quoted data sections in CSV files that contain newline
          characters (default False).
      encoding: The character encoding of the data, either 'UTF-8' (the default) or 'ISO-8859-1'.
      ignore_unknown_values: If True, accept rows that contain values that do not match the schema;
          the unknown values are ignored (default False).
      max_bad_records The maximum number of bad records that are allowed (and ignored) before
          returning an 'invalid' error in the Job result (default 0).
      quote: The value used to quote data sections in a CSV file; default '"'. If your data does
          not contain quoted sections, set the property value to an empty string. If your data
          contains quoted newline characters, you must also enable allow_quoted_newlines.
      skip_leading_rows: A number of rows at the top of a CSV file to skip (default 0).
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + (Api._JOBS_PATH % (table_name.project_id, ''))
    if isinstance(source, basestring):
      source = [source]
    write_disposition = 'WRITE_EMPTY'
    if overwrite:
      write_disposition = 'WRITE_TRUNCATE'
    if append:
      write_disposition = 'WRITE_APPEND'
    data = {
      'kind': 'bigquery#job',
      'configuration': {
        'load': {
          'sourceUris': source,
          'destinationTable': {
            'projectId': table_name.project_id,
            'datasetId': table_name.dataset_id,
            'tableId': table_name.table_id
          },
          'createDisposition': 'CREATE_IF_NEEDED' if create else 'CREATE_NEVER',
          'writeDisposition': write_disposition,
          'sourceFormat': source_format,
          'ignoreUnknownValues': ignore_unknown_values,
          'maxBadRecords': max_bad_records,
        }
      }
    }
    if source_format == 'CSV':
      load_config = data['configuration']['load']
      load_config.update({
        'fieldDelimiter': field_delimiter,
        'allowJaggedRows': allow_jagged_rows,
        'allowQuotedNewlines': allow_quoted_newlines,
        'quote': quote,
        'encoding': encoding,
        'skipLeadingRows': skip_leading_rows
      })

    return gcp._util.Http.request(url, data=data, credentials=self._credentials)

  def jobs_insert_query(self, sql, code=None, imports=None, table_name=None, append=False,
                        overwrite=False, dry_run=False, use_cache=True, batch=True,
                        allow_large_results=False, table_definitions=None):
    """Issues a request to insert a query job.

    Args:
      sql: the SQL string representing the query to execute.
      code: code for Javascript UDFs, if any.
      imports: a list of GCS URLs containing additional Javascript UDF support code, if any.
      table_name: None for an anonymous table, or a name parts tuple for a long-lived table.
      append: if True, append to the table if it is non-empty; else the request will fail if table
          is non-empty unless overwrite is True.
      overwrite: if the table already exists, truncate it instead of appending or raising an
          Exception.
      dry_run: whether to actually execute the query or just dry run it.
      use_cache: whether to use past query results or ignore cache. Has no effect if destination is
          specified.
      batch: whether to run this as a batch job (lower priority) or as an interactive job (high
          priority, more expensive).
      allow_large_results: whether to allow large results (slower with some restrictions but
          can handle big jobs).
      table_definitions: a list of JSON external table definitions for any external tables
          referenced in the query.
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + (Api._JOBS_PATH % (self._project_id, ''))
    data = {
      'kind': 'bigquery#job',
      'configuration': {
        'query': {
          'query': sql,
          'useQueryCache': use_cache,
          'allowLargeResults': allow_large_results
        },
        'dryRun': dry_run,
        'priority': 'BATCH' if batch else 'INTERACTIVE',
      },
    }

    query_config = data['configuration']['query']

    resources = []
    if code:
      resources.extend([{'inlineCode': fragment} for fragment in code])

    if imports:
      resources.extend([{'resourceUri': uri} for uri in imports])

    query_config['userDefinedFunctionResources'] = resources

    if table_definitions:
      query_config['tableDefinitions'] = table_definitions

    if table_name:
      query_config['destinationTable'] = {
        'projectId': table_name.project_id,
        'datasetId': table_name.dataset_id,
        'tableId': table_name.table_id
      }
      if append:
        query_config['writeDisposition'] = "WRITE_APPEND"
      elif overwrite:
        query_config['writeDisposition'] = "WRITE_TRUNCATE"

    return gcp._util.Http.request(url, data=data, credentials=self._credentials)

  def jobs_query_results(self, job_id, project_id, page_size, timeout, start_index=0):
    """Issues a request to the jobs/getQueryResults method.

    Args:
      job_id: the id of job from a previously executed query.
      project_id: the project id to use to fetch the results; use None for the default project.
      page_size: limit to the number of rows to fetch.
      timeout: duration (in milliseconds) to wait for the query to complete.
      start_index: the index of the row (0-based) at which to start retrieving the page of result
          rows.
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    if timeout is None:
      timeout = Api._DEFAULT_TIMEOUT
    if project_id is None:
      project_id = self._project_id

    args = {
        'maxResults': page_size,
        'timeoutMs': timeout,
        'startIndex': start_index
      }
    url = Api._ENDPOINT + (Api._QUERIES_PATH % (project_id, job_id))
    return gcp._util.Http.request(url, args=args, credentials=self._credentials)

  def jobs_get(self, job_id, project_id=None):
    """Issues a request to retrieve information about a job.

    Args:
      job_id: the id of the job
      project_id: the project id to use to fetch the results; use None for the default project.
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    if project_id is None:
      project_id = self._project_id
    url = Api._ENDPOINT + (Api._JOBS_PATH % (project_id, job_id))
    return gcp._util.Http.request(url, credentials=self._credentials)

  def datasets_insert(self, dataset_name, friendly_name=None, description=None):
    """Issues a request to create a dataset.

    Args:
      dataset_name: the name of the dataset to create.
      friendly_name: (optional) the friendly name for the dataset
      description: (optional) a description for the dataset
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + (Api._DATASETS_PATH % (dataset_name.project_id, ''))
    data = {
      'kind': 'bigquery#dataset',
      'datasetReference': {
        'projectId': dataset_name.project_id,
        'datasetId': dataset_name.dataset_id,
      },
    }
    if friendly_name:
      data['friendlyName'] = friendly_name
    if description:
      data['description'] = description
    return gcp._util.Http.request(url, data=data, credentials=self._credentials)

  def datasets_delete(self, dataset_name, delete_contents):
    """Issues a request to delete a dataset.

    Args:
      dataset_name: the name of the dataset to delete.
      delete_contents: if True, any tables in the dataset will be deleted. If False and the
          dataset is non-empty an exception will be raised.
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + (Api._DATASETS_PATH % dataset_name)
    args = {}
    if delete_contents:
      args['deleteContents'] = True
    return gcp._util.Http.request(url, method='DELETE', args=args, credentials=self._credentials,
                                  raw_response=True)

  def datasets_update(self, dataset_name, dataset_info):
    """Updates the DataSet info.

    Args:
      dataset_name: the name of the dataset to update as a tuple of components.
      dataset_info: the DataSet resource with updated fields.
    """
    url = Api._ENDPOINT + (Api._DATASETS_PATH % dataset_name)
    return gcp._util.Http.request(url, method='PUT', data=dataset_info,
                                  credentials=self._credentials)

  def datasets_get(self, dataset_name):
    """Issues a request to retrieve information about a dataset.

    Args:
      dataset_name: the name of the dataset
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + (Api._DATASETS_PATH % dataset_name)
    return gcp._util.Http.request(url, credentials=self._credentials)

  def datasets_list(self, project_id=None, max_results=0, page_token=None):
    """Issues a request to list the datasets in the project.

    Args:
      project_id: the project id to use to fetch the results; use None for the default project.
      max_results: an optional maximum number of tables to retrieve.
      page_token: an optional token to continue the retrieval.
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    if project_id is None:
      project_id = self._project_id
    url = Api._ENDPOINT + (Api._DATASETS_PATH % (project_id, ''))

    args = {}
    if max_results != 0:
      args['maxResults'] = max_results
    if page_token is not None:
      args['pageToken'] = page_token

    return gcp._util.Http.request(url, args=args, credentials=self._credentials)

  def tables_get(self, table_name):
    """Issues a request to retrieve information about a table.

    Args:
      table_name: a tuple representing the full name of the table.
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + (Api._TABLES_PATH % table_name)
    return gcp._util.Http.request(url, credentials=self._credentials)

  def tables_list(self, dataset_name, max_results=0, page_token=None):
    """Issues a request to retrieve a list of tables.

    Args:
      dataset_name: the name of the dataset to enumerate.
      max_results: an optional maximum number of tables to retrieve.
      page_token: an optional token to continue the retrieval.
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT +\
        (Api._TABLES_PATH % (dataset_name.project_id, dataset_name.dataset_id, '', ''))

    args = {}
    if max_results != 0:
      args['maxResults'] = max_results
    if page_token is not None:
      args['pageToken'] = page_token

    return gcp._util.Http.request(url, args=args, credentials=self._credentials)

  def tables_insert(self, table_name, schema=None, query=None, friendly_name=None,
                    description=None):
    """Issues a request to create a table or view in the specified dataset with the specified id.
       A schema must be provided to create a Table, or a query must be provided to create a View.

    Args:
      table_name: the name of the table as a tuple of components.
      schema: the schema, if this is a Table creation.
      query: the query, if this is a View creation.
      friendly_name: an optional friendly name.
      description: an optional description.
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + \
        (Api._TABLES_PATH % (table_name.project_id, table_name.dataset_id, '', ''))

    data = {
      'kind': 'bigquery#table',
      'tableReference': {
        'projectId': table_name.project_id,
        'datasetId': table_name.dataset_id,
        'tableId': table_name.table_id
      }
    }
    if schema:
      data['schema'] = {'fields': schema}
    if query:
      data['view'] = {'query': query}
    if friendly_name:
      data['friendlyName'] = friendly_name
    if description:
      data['description'] = description

    return gcp._util.Http.request(url, data=data, credentials=self._credentials)

  def tabledata_insertAll(self, table_name, rows):
    """Issues a request to insert data into a table.

    Args:
      table_name: the name of the table as a tuple of components.
      rows: the data to populate the table, as a list of dictionaries.
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + (Api._TABLES_PATH % table_name) + "/insertAll"

    data = {
      'kind': 'bigquery#tableDataInsertAllRequest',
      'rows': rows
    }

    return gcp._util.Http.request(url, data=data, credentials=self._credentials)

  def tabledata_list(self, table_name, start_index=None, max_results=None, page_token=None):
    """ Retrieves the contents of a table.

    Args:
      table_name: the name of the table as a tuple of components.
      start_index: the index of the row at which to start retrieval.
      max_results: an optional maximum number of rows to retrieve.
      page_token: an optional token to continue the retrieval.
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + (Api._TABLEDATA_PATH % table_name)
    args = {}
    if start_index:
      args['startIndex'] = start_index
    if max_results:
      args['maxResults'] = max_results
    if page_token is not None:
      args['pageToken'] = page_token
    return gcp._util.Http.request(url, args=args, credentials=self._credentials)

  def table_delete(self, table_name):
    """Issues a request to delete a table.

    Args:
      table_name: the name of the table as a tuple of components.
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + (Api._TABLES_PATH % table_name)
    return gcp._util.Http.request(url, method='DELETE', credentials=self._credentials,
                                  raw_response=True)

  def table_extract(self, table_name, destination, format='CSV', compressed=True,
                    field_delimiter=',', print_header=True):
    """Exports the table to GCS.

    Args:
      table_name: the name of the table as a tuple of components.
      destination: the destination URI(s). Can be a single URI or a list.
      format: the format to use for the exported data; one of CSV, NEWLINE_DELIMITED_JSON or AVRO.
          Defaults to CSV.
      compress whether to compress the data on export. Compression is not supported for
          AVRO format. Defaults to False.
      field_delimiter: for CSV exports, the field delimiter to use. Defaults to ','
      print_header: for CSV exports, whether to include an initial header line. Default true.
    Returns:
      A parsed result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + (Api._JOBS_PATH % (table_name.project_id, ''))
    if isinstance(destination, basestring):
      destination = [destination]
    data = {
      # 'projectId': table_name.project_id, # Code sample shows this but it is not in job
      # reference spec. Filed as b/19235843
      'kind': 'bigquery#job',
      'configuration': {
        'extract': {
          'sourceTable': {
            'projectId': table_name.project_id,
            'datasetId': table_name.dataset_id,
            'tableId': table_name.table_id,
          },
          'compression': 'GZIP' if compressed else 'NONE',
          'fieldDelimiter': field_delimiter,
          'printHeader': print_header,
          'destinationUris': destination,
          'destinationFormat': format,
        }
      }
    }
    return gcp._util.Http.request(url, data=data, credentials=self._credentials)

  def table_update(self, table_name, table_info):
    """Updates the Table info.

    Args:
      table_name: the name of the table to update as a tuple of components.
      table_info: the Table resource with updated fields.
    """
    url = Api._ENDPOINT + (Api._TABLES_PATH % table_name)
    return gcp._util.Http.request(url, method='PUT', data=table_info, credentials=self._credentials)
