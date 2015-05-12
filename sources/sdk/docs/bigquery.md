Module gcp.bigquery
-------------------

Google Cloud Platform library - BigQuery Functionality.

Functions
---------
- **dataset** (name, context=None)

    Returns the Dataset with the specified dataset_id.
  
    Args:  

    * name: the name of the dataset, as a string or (project_id, dataset_id) tuple.

    * context: an optional Context object providing project_id and credentials.  
Returns:    
A DataSet object.

- **datasetname** (project_id, dataset_id)

    Construct a DataSetName named tuple.
  
    Args:  

    * project_id: the project ID.

    * dataset_id: the dataset ID.  
Returns:    
A DataSetName named-tuple.

- **datasets** (project_id=None, context=None)

- **job** (job_id, context=None)

    Create a job reference for a specific job ID.
  
    Args:  

    * job_id: the job ID.  
Returns:    
A Job object.

- **query** (sql_statement, context=None)

    Creates a BigQuery query object.
  
    If a specific project id or credentials are unspecified, the default ones
configured at the global level are used.
  
    Args:  

    * sql_statement: the SQL query to execute.

    * context: an optional Context object providing project_id and credentials.  
Returns:    
A query object that can be executed to retrieve data from BigQuery.

- **query_job** (job_id, table, context=None)

    Create a job reference for a specific query job ID.
  
    Args:  

    * job_id: the job ID.

    * table: the Table that will be used for the query results.  
Returns:    
A QueryJob object.

- **schema** (data=None, definition=None)

    Creates a table/view schema from its JSON representation, a list of data, or a Pandas
dataframe.
  
    Args:  

    * data: the Pandas Dataframe or list of data from which to infer the schema.

    * definition: a definition of the schema as a list of dictionaries with 'name' and 'type' entries
and possibly 'mode' and 'description' entries. Only used if no data argument was provided.
'mode' can be 'NULLABLE', 'REQUIRED' or 'REPEATED'. For the allowed types, see:  

    * https://cloud.google.com/bigquery/preparing-data-for-bigquery#datatypes  
Returns:    
A Schema object.

- **sql** (sql_template, **kwargs)

    Formats SQL templates by replacing placeholders with actual values.
  
    Placeholders in SQL are represented as $<name>. If '$' must appear within the  
SQL statement literally, then it can be escaped as '$$'.
  
    Args:  

    * sql_template: the template of the SQL statement with named placeholders.

    * **kwargs: the dictionary of name/value pairs to use for placeholder values.  
Returns:    
The formatted SQL statement with placeholders replaced with their values.  
Raises:    
Exception if a placeholder was found in the SQL statement, but did not have
a corresponding argument value.

- **table** (name, context=None)

    Creates a BigQuery table object.
  
    If a specific project id or credentials are unspecified, the default ones
configured at the global level are used.
  
    The name must be a valid BigQuery table name, which is either

    * <project>:<dataset>.<table> or <dataset>.<table>.
  
    Args:  

    * name: the name of the table, as a string or (project_id, dataset_id, table_id) tuple.

    * context: an optional Context object providing project_id and credentials.  
Returns:    
A Table object that can be used to retrieve table metadata from BigQuery.  
Raises:    
Exception if the name is invalid.

- **tablename** (project_id, dataset_id, table_id, decorator='')

    Construct a TableName named tuple.
  
    Args:  

    * project_id: the project ID.

    * dataset_id: the dataset ID.

    * table_id: tha Table ID.

    * decorator: the decorator part.  
Returns:    
A TableName named-tuple.

- **udf** (inputs, outputs, implementation, context=None)

    Creates a BigQuery SQL UDF query object.
  
    The implementation is a javascript function of the form:  
function(row, emitFn) { ... }
where the row matches a structure represented by inputs, and the emitFn
is a function that accepts a structure represented by outputs.
  
    Args:  

    * inputs: a list of (name, type) tuples representing the schema of input.

    * outputs: a list of (name, type) tuples representing the schema of the output.

    * implementation: a javascript function defining the UDF logic.

    * context: an optional Context object providing project_id and credentials.

- **view** (name, context=None)

    Creates a BigQuery View object.
  
    If a specific project id or credentials are unspecified, the default ones
configured at the global level are used.
  
    The name must be a valid BigQuery view name, which is either

    * <project>:<dataset>.<view> or <dataset>.<view>.
  
    Args:  

    * name: the name of the view, as a string or (project_id, dataset_id, view_id) tuple.

    * context: an optional Context object providing project_id and credentials.  
Returns:    
A View object that can be used to retrieve table metadata from BigQuery.  
Raises:    
Exception if the name is invalid.

Sub-modules
-----------
- [gcp.bigquery._api](_api.md)

- [gcp.bigquery._dataset](_dataset.md)

- [gcp.bigquery._job](_job.md)

- [gcp.bigquery._parser](_parser.md)

- [gcp.bigquery._query](_query.md)

- [gcp.bigquery._query_job](_query_job.md)

- [gcp.bigquery._query_results_table](_query_results_table.md)

- [gcp.bigquery._sampling](_sampling.md)

- [gcp.bigquery._table](_table.md)

- [gcp.bigquery._udf](_udf.md)

- [gcp.bigquery._utils](_utils.md)

- [gcp.bigquery._view](_view.md)
Module gcp.bigquery._api
------------------------

Implements BigQuery HTTP API wrapper.

Classes
-------
#### Api 
A helper class to issue BigQuery HTTP requests.

##### Ancestors (in MRO)
- gcp.bigquery._api.Api

- __builtin__.object

##### Instance variables
- **project_id**

    The project_id associated with this API client.

##### Methods
- **__init__** (self, credentials, project_id)

    Initializes the BigQuery helper with context information.
  
    Args:  

    * credentials: the credentials to use to authorize requests.

    * project_id: the project id to associate with requests.

- **datasets_delete** (self, dataset_name, delete_contents=False)

    Issues a request to delete a dataset.
  
    Args:  

    * dataset_name: the name of the dataset to delete.

    * delete_contents: if True, any tables in the dataset will be deleted. If False and the
dataset is non-empty an exception will be raised.  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **datasets_get** (self, dataset_name)

    Issues a request to retrieve information about a dataset.
  
    Args:  

    * dataset_name: the name of the dataset  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **datasets_insert** (self, dataset_name, friendly_name=None, description=None)

    Issues a request to create a dataset.
  
    Args:  

    * dataset_name: the name of the dataset to create.

    * friendly_name: (optional) the friendly name for the dataset

    * description: (optional) a description for the dataset  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **datasets_list** (self, project_id=None, max_results=0, page_token=None)

    Issues a request to list the datasets in the project.
  
    Args:  

    * project_id: the project id to use to fetch the results; use None for the default project.

    * max_results: an optional maximum number of tables to retrieve.

    * page_token: an optional token to continue the retrieval.  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **jobs_get** (self, job_id, project_id=None)

    Issues a request to retrieve information about a job.
  
    Args:  

    * job_id: the id of the job

    * project_id: the project id to use to fetch the results; use None for the default project.  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **jobs_insert_load** (self, source, table_name, append=False, overwrite=False, source_format='CSV', field_delimiter=',', allow_jagged_rows=False, allow_quoted_newlines=False, encoding='UTF-8', ignore_unknown_values=False, max_bad_records=0, quote='"', skip_leading_rows=0)

    Issues a request to load data from GCS to a BQ table
  
    Args:  

    * source: the URL of the source bucket(s). Can include wildcards, and can be a single
string argument or a list.

    * table_name: a tuple representing the full name of the destination table.

    * append: if True append onto existing table contents.

    * overwrite: if True overwrite existing table contents.

    * source_format: the format of the data; default 'CSV'. Other options are DATASTORE_BACKUP
or NEWLINE_DELIMITED_JSON.

    * field_delimiter: The separator for fields in a CSV file. BigQuery converts the string to  
ISO-8859-1 encoding, and then uses the first byte of the encoded string to split the data
as raw binary (default ',').

    * allow_jagged_rows: If True, accept rows in CSV files that are missing trailing optional
columns; the missing values are treated as nulls (default False).

    * allow_quoted_newlines: If True, allow quoted data sections in CSV files that contain newline
characters (default False).

    * encoding: The character encoding of the data, either 'UTF-8' (the default) or 'ISO-8859-1'.

    * ignore_unknown_values: If True, accept rows that contain values that do not match the schema;
the unknown values are ignored (default False).
max_bad_records The maximum number of bad records that are allowed (and ignored) before
returning an 'invalid' error in the Job result (default 0).

    * quote: The value used to quote data sections in a CSV file; default '"'. If your data does
not contain quoted sections, set the property value to an empty string. If your data
contains quoted newline characters, you must also enable allow_quoted_newlines.

    * skip_leading_rows: A number of rows at the top of a CSV file to skip (default 0).  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **jobs_insert_query** (self, sql, table_name=None, append=False, overwrite=False, dry_run=False, use_cache=True, batch=True, allow_large_results=False)

    Issues a request to insert a query job.
  
    Args:  

    * sql: the SQL string representing the query to execute.

    * table_name: None for an anonymous table, or a name parts tuple for a long-lived table.

    * append: if True, append to the table if it is non-empty; else the request will fail if table
is non-empty unless overwrite is True.

    * overwrite: if the table already exists, truncate it instead of appending or raising an  
Exception.

    * dry_run: whether to actually execute the query or just dry run it.

    * use_cache: whether to use past query results or ignore cache. Has no effect if destination is
specified.

    * batch: whether to run this as a batch job (lower priority) or as an interactive job (high
priority, more expensive).

    * allow_large_results: whether to allow large results (slower with some restrictions but
can handle big jobs).  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **jobs_query_results** (self, job_id, project_id, page_size, timeout, start_index=0)

    Issues a request to the jobs/getQueryResults method.
  
    Args:  

    * job_id: the id of job from a previously executed query.

    * project_id: the project id to use to fetch the results; use None for the default project.

    * page_size: limit to the number of rows to fetch.

    * timeout: duration (in milliseconds) to wait for the query to complete.

    * start_index: the index of the row (0-based) at which to start retrieving the page of result
rows.  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **table_delete** (self, table_name)

    Issues a request to delete a table.
  
    Args:  

    * table_name: the name of the table as a tuple of components.  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **table_extract** (self, table_name, destination, format='CSV', compressed=True, field_delimiter=',', print_header=True)

    Exports the table to GCS.
  
    Args:  

    * table_name: the name of the table as a tuple of components.

    * destination: the destination URI(s). Can be a single URI or a list.

    * format: the format to use for the exported data; one of CSV, NEWLINE_DELIMITED_JSON or AVRO.  
Defaults to CSV.
compress whether to compress the data on export. Compression is not supported for  
AVRO format. Defaults to False.

    * field_delimiter: for CSV exports, the field delimiter to use. Defaults to ','

    * print_header: for CSV exports, whether to include an initial header line. Default true.  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **table_update** (self, table_name, table_info)

    Updates the Table info.
  
    Args:  

    * table_name: the name of the table to update as a tuple of components.

    * table_info: the Table resource with updated fields.

- **tabledata_insertAll** (self, table_name, rows)

    Issues a request to insert data into a table.
  
    Args:  

    * table_name: the name of the table as a tuple of components.

    * rows: the data to populate the table, as a list of dictionaries.  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **tabledata_list** (self, table_name, start_index=None, max_results=None, page_token=None)

    Retrieves the contents of a table.
  
    Args:  

    * table_name: the name of the table as a tuple of components.

    * start_index: the index of the row at which to start retrieval.

    * max_results: an optional maximum number of rows to retrieve.

    * page_token: an optional token to continue the retrieval.  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **tables_get** (self, table_name)

    Issues a request to retrieve information about a table.
  
    Args:  

    * table_name: a tuple representing the full name of the table.  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **tables_insert** (self, table_name, schema=None, query=None, friendly_name=None, description=None)

    Issues a request to create a table or view in the specified dataset with the specified id.  
A schema must be provided to create a Table, or a query must be provided to create a View.
  
    Args:  

    * table_name: the name of the table as a tuple of components.

    * schema: the schema, if this is a Table creation.

    * query: the query, if this is a View creation.

    * friendly_name: an optional friendly name.

    * description: an optional description.  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.

- **tables_list** (self, dataset_name, max_results=0, page_token=None)

    Issues a request to retrieve a list of tables.
  
    Args:  

    * dataset_name: the name of the dataset to enumerate.

    * max_results: an optional maximum number of tables to retrieve.

    * page_token: an optional token to continue the retrieval.  
Returns:    
A parsed result object.  
Raises:    
Exception if there is an error performing the operation.
Module gcp.bigquery._dataset
----------------------------

Implements DataSet, and related DataSet BigQuery APIs.

Classes
-------
#### DataSet 
Represents a list of BigQuery tables in a dataset.

##### Ancestors (in MRO)
- gcp.bigquery._dataset.DataSet

- __builtin__.object

##### Instance variables
- **full_name**

    The full name for the dataset.

- **name**

    The DataSetName for the dataset.

##### Methods
- **__init__** (self, api, name)

    Initializes an instance of a DataSet.
  
    Args:  

    * api: the BigQuery API object to use to issue requests. The project ID will be inferred from
this.

    * name: the name of the dataset, as a string or (project_id, dataset_id) tuple.

- **create** (self, friendly_name=None, description=None)

    Creates the Dataset with the specified friendly name and description.
  
    Args:  

    * friendly_name: (optional) the friendly name for the dataset if it is being created.

    * description: (optional) a description for the dataset if it is being created.  
Returns:    
The DataSet.  
Raises:    
Exception if the DataSet could not be created.

- **delete** (self, delete_contents=False)

    Issues a request to delete the dataset.
  
    Args:  

    * delete_contents: if True, any tables in the dataset will be deleted. If False and the
dataset is non-empty an exception will be raised.  
Returns:    
None on success.  
Raises:    
Exception if the delete fails (including if table was nonexistent).

- **exists** (self)

    Checks if the dataset exists.
  
    Args:    
None  
Returns:    
True if the dataset exists; False otherwise.

#### DataSetLister 
Helper class for enumerating the datasets in a project.

##### Ancestors (in MRO)
- gcp.bigquery._dataset.DataSetLister

- __builtin__.object

##### Methods
- **__init__** (self, api, project_id=None)
Module gcp.bigquery._job
------------------------

Implements BigQuery Job functionality.

Classes
-------
#### Job 
Represents a BigQuery Job.

##### Ancestors (in MRO)
- gcp.bigquery._job.Job

- __builtin__.object

##### Descendents
- gcp.bigquery._query_job.QueryJob

##### Instance variables
- **errors**

    Get the errors in the job.
  
    Returns:    
None if the job is still running, else the list of errors that occurred.

- **failed**

    Get the success state of the job.
  
    Returns:    
True if the job failed; False if it is still running or succeeded (possibly with partial
failure).

- **fatal_error**

    Get the job error.
  
    Returns:    
None if the job succeeded or is still running, else the error tuple for the failure.

- **id**

    Get the Job ID.
  
    Returns:    
The ID of the job.

- **is_complete**

    Get the completion state of the job.
  
    Returns:    
True if the job is complete; False if it is still running.

##### Methods
- **__init__** (self, api, job_id)

    Initializes an instance of a Job.
  
    Args:  

    * api: the BigQuery API object to use to issue requests. The project ID will be inferred from
this.

    * job_id: the BigQuery job ID corresponding to this job.

- **wait** (self, timeout=None)

    Wait for the job to complete, or a timeout to happen.
  
    This polls the job status every 5 seconds.
  
    Args:  

    * timeout: how long to poll before giving up (in seconds); default None which means no timeout.
  
    Returns:    
The Job

#### JobError 
JobError(location, message, reason)

##### Ancestors (in MRO)
- gcp.bigquery._job.JobError

- __builtin__.tuple

- __builtin__.object

##### Instance variables
- **location**

    Alias for field number 0

- **message**

    Alias for field number 1

- **reason**

    Alias for field number 2
Module gcp.bigquery._parser
---------------------------

Implements BigQuery related data parsing helpers.

Classes
-------
#### Parser 
A set of helper functions to parse data in BigQuery responses.

##### Ancestors (in MRO)
- gcp.bigquery._parser.Parser

- __builtin__.object

##### Static methods
- **parse_row** (schema, data)

    Parses a row from query results into an equivalent object.
  
    Args:  

    * schema: the array of fields defining the schema of the data.

    * data: the JSON row from a query result.  
Returns:    
The parsed row object.

- **parse_timestamp** (value)

    Parses a timestamp.
  
    Args:  

    * value: the number of milliseconds since epoch.

##### Methods
- **__init__** (self)
Module gcp.bigquery._query
--------------------------

Implements Query BigQuery API.

Classes
-------
#### Query 
Represents a Query object that encapsulates a BigQuery SQL query.
  
This object can be used to execute SQL queries and retrieve results.

##### Ancestors (in MRO)
- gcp.bigquery._query.Query

- __builtin__.object

##### Static methods
- **sampling_query** (api, sql, fields=None, count=5, sampling=None)

    Returns a sampling Query for the SQL object.
  
    Args:  

    * api: the BigQuery API object to use to issue requests.

    * sql: the SQL object to sample

    * fields: an optional list of field names to retrieve.

    * count: an optional count of rows to retrieve which is used if a specific
sampling is not specified.

    * sampling: an optional sampling strategy to apply to the table.  
Returns:    
A Query object for sampling the table.

##### Instance variables
- **sql**

##### Methods
- **__init__** (self, api, sql)

    Initializes an instance of a Query object.
  
    Args:  

    * api: the BigQuery API object to use to issue requests.

    * sql: the BigQuery SQL string to execute.

- **execute** (self, table_name=None, append=False, overwrite=False, use_cache=True, batch=True, allow_large_results=False)

    Initiate the query and block waiting for completion.
  
    Args:  

    * dataset_id: the datasetId for the result table.

    * table_name: the result table name as a string or TableName; if None (the default), then a
temporary table will be used.

    * append: if True, append to the table if it is non-empty; else the request will fail if table
is non-empty unless overwrite is True (default False).

    * overwrite: if the table already exists, truncate it instead of appending or raising an  
Exception (default False).

    * use_cache: whether to use past query results or ignore cache. Has no effect if destination is
specified (default True).

    * batch: whether to run this as a batch job (lower priority) or as an interactive job (high
priority, more expensive) (default True).

    * allowLargeResults: whether to allow large results; i.e. compressed data over 100MB. This is
slower and requires a table_name to be specified) (default False).  
Returns:    
A Job for the query  
Raises:    
Exception if query could not be executed.

- **execute_async** (self, table_name=None, append=False, overwrite=False, use_cache=True, batch=True, allow_large_results=False)

    Initiate the query and return immediately.
  
    Args:  

    * dataset_id: the datasetId for the result table.

    * table_name: the result table name as a string or TableName; if None (the default), then a
temporary table will be used.

    * append: if True, append to the table if it is non-empty; else the request will fail if table
is non-empty unless overwrite is True (default False).

    * overwrite: if the table already exists, truncate it instead of appending or raising an  
Exception (default False).

    * use_cache: whether to use past query results or ignore cache. Has no effect if destination is
specified (default True).

    * batch: whether to run this as a batch job (lower priority) or as an interactive job (high
priority, more expensive) (default True).

    * allow_large_results: whether to allow large results; i.e. compressed data over 100MB. This is
slower and requires a table_name to be specified) (default False).  
Returns:    
A Job for the query  
Raises:    
Exception if query could not be executed.

- **extract** (self, destination, format='CSV', compress=False, field_delimiter=',', print_header=True, use_cache=True)

    Exports the query results to GCS.
  
    Args:  

    * destination: the destination URI(s). Can be a single URI or a list.

    * format: the format to use for the exported data; one of CSV, NEWLINE_DELIMITED_JSON or AVRO
(default 'CSV').
compress whether to compress the data on export. Compression is not supported for  
AVRO format (default False).

    * field_delimiter: for CSV exports, the field delimiter to use (default ',').

    * print_header: for CSV exports, whether to include an initial header line (default True).

    * use_cache: whether to use cached results or not (default True).  
Returns:    
A Job object for the export Job if it was started successfully; else None.  
Raises:    
An Exception if the query timed out or failed.

- **results** (self, use_cache=True)

    Retrieves results for the query.
  
    Args:  

    * use_cache: whether to use cached results or not. Ignored if append is specified.  
Returns:    
A QueryResultsTable containing the result set.  
Raises:    
Exception if the query could not be executed or query response was
malformed.

- **sample** (self, count=5, fields=None, sampling=None, use_cache=True)

    Retrieves a sampling of rows for the query.
  
    Args:  

    * count: an optional count of rows to retrieve which is used if a specific
sampling is not specified (default 5).

    * fields: the list of fields to sample (default None implies all).

    * sampling: an optional sampling strategy to apply to the table.

    * use_cache: whether to use cached results or not (default True).  
Returns:    
A QueryResultsTable containing a sampling of the result set.  
Raises:    
Exception if the query could not be executed or query response was malformed.

- **save_as_view** (self, view_name)

    Create a View from this Query.
  
    Args:  

    * view_name: the name of the View either as a string or a 3-part tuple
(projectid, datasetid, name).
  
    Returns:    
A View for the Query.

- **to_dataframe** (self, start_row=0, max_rows=None, use_cache=True)

    Exports the query results to a Pandas dataframe.
  
    Args:  

    * start_row: the row of the table at which to start the export (default 0).

    * max_rows: an upper limit on the number of rows to export (default None).

    * use_cache: whether to use cached results or not (default True).  
Returns:    
A dataframe containing the table data.

- **to_file** (self, path, start_row=0, max_rows=None, use_cache=True, write_header=True)

    Save the results to a local file in Excel CSV format.
  
    Args:  

    * path: path on the local filesystem for the saved results.

    * start_row: the row of the table at which to start the export (default 0).

    * max_rows: an upper limit on the number of rows to export (default None).

    * use_cache: whether to use cached results or not.

    * write_header: if true (the default), write column name header row at start of file.  
Returns:    
The path to the local file.  
Raises:    
An Exception if the operation failed.
Module gcp.bigquery._query_job
------------------------------

Implements BigQuery query job functionality.

Classes
-------
#### QueryJob 
Represents a BigQuery Query Job.

##### Ancestors (in MRO)
- gcp.bigquery._query_job.QueryJob

- gcp.bigquery._job.Job

- __builtin__.object

##### Instance variables
- **errors**

    Get the errors in the job.
  
    Returns:    
None if the job is still running, else the list of errors that occurred.

- **failed**

    Get the success state of the job.
  
    Returns:    
True if the job failed; False if it is still running or succeeded (possibly with partial
failure).

- **fatal_error**

    Get the job error.
  
    Returns:    
None if the job succeeded or is still running, else the error tuple for the failure.

- **id**

    Get the Job ID.
  
    Returns:    
The ID of the job.

- **is_complete**

    Get the completion state of the job.
  
    Returns:    
True if the job is complete; False if it is still running.

- **results**

    Get the table used for the results of the query. If the query is incomplete, this blocks.
  
    Raises:    
Exception if we timed out waiting for results or the query failed.

- **sql**

##### Methods
- **__init__** (self, api, job_id, table_name, sql)

- **wait** (self, timeout=None)

    Wait for the job to complete, or a timeout to happen.
  
    This is more efficient than the version in the base Job class, in that we can
use a call that blocks for the poll duration rather than a sleep. That means we
shouldn't block unnecessarily long and can also poll less.
  
    Args:  

    * timeout: how long to wait (in seconds) before giving up; default None which means no timeout.
  
    Returns:    
The Job
Module gcp.bigquery._query_results_table
----------------------------------------

Implements BigQuery query job results table functionality.

Classes
-------
#### QueryResultsTable 
##### Ancestors (in MRO)
- gcp.bigquery._query_results_table.QueryResultsTable

- gcp.bigquery._table.Table

- __builtin__.object

##### Instance variables
- **full_name**

    The full name for the table.

- **is_temporary**

    Whether this is a short-lived table or not.

- **job_id**

- **length**

    Get the length of the table (number of rows). We don't use __len__ as this may
return -1 for 'unknown'.

- **metadata**

    Retrieves metadata about the table.
  
    Returns:    
A TableMetadata object.  
Raises  
Exception if the request could not be executed or the response was malformed.

- **name**

    The TableName for the table.

- **schema**

    Retrieves the schema of the table.
  
    Returns:    
A Schema object containing a list of schema fields and associated metadata.  
Raises  
Exception if the request could not be executed or the response was malformed.

- **sql**

##### Methods
- **__init__** (self, api, name, job, is_temporary=False)

    Initializes an instance of a Table object.
  
    Args:  

    * api: the BigQuery API object to use to issue requests.

    * name: the name of the table either as a string or a 3-part tuple (projectid, datasetid, name).

    * is_temporary: if True, this is a short-lived table for intermediate results (default False).

- **create** (self, schema, overwrite=False)

    Create the table with the specified schema.
  
    Args:  

    * schema: the schema to use to create the table. Should be a list of dictionaries, each
containing at least a pair of entries, 'name' and 'type'.  

    * See https://cloud.google.com/bigquery/docs/reference/v2/tables#resource

    * overwrite: if True, delete the object first if it exists. If False and the object exists,
creation will fail and raise an Exception.  
Returns:    
The Table instance.  
Raises:    
Exception if the table couldn't be created or already exists and truncate was False.

- **delete** (self)

    Delete the table.
  
    Returns:    
Nothing

- **exists** (self)

    Checks if the table exists.
  
    Returns:    
True if the table exists; False otherwise.  
Raises:    
Exception if there was an error requesting information about the table.

- **extract** (self, destination, format='CSV', compress=False, field_delimiter=',', print_header=True)

    Exports the table to GCS; blocks until complete.
  
    Args:  

    * destination: the destination URI(s). Can be a single URI or a list.

    * format: the format to use for the exported data; one of CSV, NEWLINE_DELIMITED_JSON or AVRO.  
Defaults to CSV.
compress whether to compress the data on export. Compression is not supported for  
AVRO format. Defaults to False.

    * field_delimiter: for CSV exports, the field delimiter to use. Defaults to ','

    * print_header: for CSV exports, whether to include an initial header line. Default true.  
Returns:    
A Job object for the export Job if it was started successfully; else None.

- **extract_async** (self, destination, format='CSV', compress=False, field_delimiter=',', print_header=True)

    Start a job to export the table to GCS and return immediately.
  
    Args:  

    * destination: the destination URI(s). Can be a single URI or a list.

    * format: the format to use for the exported data; one of CSV, NEWLINE_DELIMITED_JSON or AVRO.  
Defaults to CSV.
compress whether to compress the data on export. Compression is not supported for  
AVRO format. Defaults to False.

    * field_delimiter: for CSV exports, the field delimiter to use. Defaults to ','

    * print_header: for CSV exports, whether to include an initial header line. Default true.  
Returns:    
A Job object for the export Job if it was started successfully; else None.

- **insertAll** (self, data, include_index=False, index_name=None)

    Insert the contents of a Pandas DataFrame or a list of dictionaries into the table.
  
    Args:  

    * data: the DataFrame or list to insert.

    * include_index: whether to include the DataFrame or list index as a column in the BQ table.

    * index_name: for a list, if include_index is True, this should be the name for the index.  
If not specified, 'Index' will be used.  
Returns:    
The table.  
Raises:    
Exception if the table doesn't exist, the schema differs from the data's schema, or the insert
failed.

- **load** (self, source, append=False, overwrite=False, source_format='CSV', field_delimiter=',', allow_jagged_rows=False, allow_quoted_newlines=False, encoding='UTF-8', ignore_unknown_values=False, max_bad_records=0, quote='"', skip_leading_rows=0)

    Load the table from GCS.
  
    Args:  

    * source: the URL of the source bucket(s). Can include wildcards.

    * append: if True append onto existing table contents.

    * overwrite: if True overwrite existing table contents.

    * source_format: the format of the data; default 'CSV'. Other options are DATASTORE_BACKUP
or NEWLINE_DELIMITED_JSON.

    * field_delimiter: The separator for fields in a CSV file. BigQuery converts the string to  
ISO-8859-1 encoding, and then uses the first byte of the encoded string to split the data
as raw binary (default ',').

    * allow_jagged_rows: If True, accept rows in CSV files that are missing trailing optional
columns; the missing values are treated as nulls (default False).

    * allow_quoted_newlines: If True, allow quoted data sections in CSV files that contain newline
characters (default False).

    * encoding: The character encoding of the data, either 'UTF-8' (the default) or 'ISO-8859-1'.

    * ignore_unknown_values: If True, accept rows that contain values that do not match the schema;
the unknown values are ignored (default False).
max_bad_records The maximum number of bad records that are allowed (and ignored) before
returning an 'invalid' error in the Job result (default 0).

    * quote: The value used to quote data sections in a CSV file; default '"'. If your data does
not contain quoted sections, set the property value to an empty string. If your data
contains quoted newline characters, you must also enable allow_quoted_newlines.

    * skip_leading_rows: A number of rows at the top of a CSV file to skip (default 0).
  
    Returns:    
A Job object for the load Job if it was started successfully; else None.

- **load_async** (self, source, append=False, overwrite=False, source_format='CSV', field_delimiter=',', allow_jagged_rows=False, allow_quoted_newlines=False, encoding='UTF-8', ignore_unknown_values=False, max_bad_records=0, quote='"', skip_leading_rows=0)

    Load the table from GCS.
  
    Args:  

    * source: the URL of the source bucket(s). Can include wildcards.

    * append: if True append onto existing table contents.

    * overwrite: if True overwrite existing table contents.

    * source_format: the format of the data; default 'CSV'. Other options are DATASTORE_BACKUP
or NEWLINE_DELIMITED_JSON.

    * field_delimiter: The separator for fields in a CSV file. BigQuery converts the string to  
ISO-8859-1 encoding, and then uses the first byte of the encoded string to split the data
as raw binary (default ',').

    * allow_jagged_rows: If True, accept rows in CSV files that are missing trailing optional
columns; the missing values are treated as nulls (default False).

    * allow_quoted_newlines: If True, allow quoted data sections in CSV files that contain newline
characters (default False).

    * encoding: The character encoding of the data, either 'UTF-8' (the default) or 'ISO-8859-1'.

    * ignore_unknown_values: If True, accept rows that contain values that do not match the schema;
the unknown values are ignored (default False).
max_bad_records The maximum number of bad records that are allowed (and ignored) before
returning an 'invalid' error in the Job result (default 0).

    * quote: The value used to quote data sections in a CSV file; default '"'. If your data does
not contain quoted sections, set the property value to an empty string. If your data
contains quoted newline characters, you must also enable allow_quoted_newlines.

    * skip_leading_rows: A number of rows at the top of a CSV file to skip (default 0).
  
    Returns:    
A Job object for the load Job if it was started successfully; else None.

- **range** (self, start_row=0, max_rows=None)

    Get an iterator to iterate through a set of table rows.
  
    Args:  

    * start_row: the row of the table at which to start the iteration (default 0)

    * max_rows: an upper limit on the number of rows to iterate through (default None)
  
    Returns:    
A row iterator.

- **sample** (self, fields=None, count=5, sampling=None, use_cache=True)

    Retrieves a sampling of data from the table.
  
    Args:  

    * fields: an optional list of field names to retrieve.

    * count: an optional count of rows to retrieve which is used if a specific
sampling is not specified.

    * sampling: an optional sampling strategy to apply to the table.

    * use_cache: whether to use cached results or not.  
Returns:    
A QueryResults object containing the resulting data.  
Raises:    
Exception if the sample query could not be executed or query response was malformed.

- **to_dataframe** (self, start_row=0, max_rows=None)

    Exports the table to a Pandas dataframe.
  
    Args:  

    * start_row: the row of the table at which to start the export (default 0)

    * max_rows: an upper limit on the number of rows to export (default None)  
Returns:    
A dataframe containing the table data.

- **to_file** (self, path, start_row=0, max_rows=None, write_header=True, dialect=<class csv.excel at 0x105061600>)

    Save the results to a local file in CSV format.
  
    Args:  

    * path: path on the local filesystem for the saved results.

    * start_row: the row of the table at which to start the export (default 0)

    * max_rows: an upper limit on the number of rows to export (default None)

    * write_header: if true (the default), write column name header row at start of file

    * dialect: the format to use for the output. By default, csv.excel. See

    * https://docs.python.org/2/library/csv.html#csv-fmt-params for how to customize this.  
Raises:    
An Exception if the operation failed.

- **update** (self, friendly_name=None, description=None, expiry=None, schema=None)

    Selectively updates Table information.
  
    Args:  

    * friendly_name: if not None, the new friendly name.

    * description: if not None, the new description.

    * expiry: if not None, the new expiry time, either as a DateTime or milliseconds since epoch.

    * schema: if not None, the new schema: either a list of dictionaries or a Schema.
  
    Returns:
Module gcp.bigquery._sampling
-----------------------------

Implements BigQuery related data sampling strategies.

Classes
-------
#### Sampling 
Provides common sampling strategies.
  
Sampling strategies can be used for sampling tables or queries.
  
They are implemented as functions that take in a SQL statement representing the table or query
that should be sampled, and return a new SQL statement that limits the result set in some manner.

##### Ancestors (in MRO)
- gcp.bigquery._sampling.Sampling

- __builtin__.object

##### Static methods
- **default** (fields=None, count=5)

    Provides a simple default sampling strategy which limits the result set by a count.
  
    Args:  

    * fields: an optional list of field names to retrieve.

    * count: optional number of rows to limit the sampled results to.  
Returns:    
A sampling function that can be applied to get a random sampling.

- **hashed** (field_name, percent, fields=None, count=0)

    Provides a sampling strategy based on hashing and selecting a percentage of data.
  
    Args:  

    * field_name: the name of the field to hash.

    * percent: the percentage of the resulting hashes to select.

    * fields: an optional list of field names to retrieve.

    * count: optional maximum count of rows to pick.  
Returns:    
A sampling function that can be applied to get a hash-based sampling.

- **sorted** (field_name, ascending=True, fields=None, count=5)

    Provides a sampling strategy that picks from an ordered set of rows.
  
    Args:  

    * field_name: the name of the field to sort the rows by.

    * ascending: whether to sort in ascending direction or not.

    * fields: an optional list of field names to retrieve.

    * count: optional number of rows to limit the sampled results to.  
Returns:    
A sampling function that can be applied to get the initial few rows.

##### Methods
- **__init__** (self)
Module gcp.bigquery._table
--------------------------

Implements Table, and related Table BigQuery APIs.

Classes
-------
#### Schema 
Represents the schema of a BigQuery table.

##### Ancestors (in MRO)
- gcp.bigquery._table.Schema

- __builtin__.list

- __builtin__.object

##### Methods
- **__init__** (self, data=None, definition=None)

    Initializes a Schema from its raw JSON representation, a Pandas Dataframe, or a list.
  
    Args:  

    * data: A Pandas DataFrame or a list of dictionaries or lists from which to infer a schema.

    * definition: a definition of the schema as a list of dictionaries with 'name' and 'type'
entries and possibly 'mode' and 'description' entries. Only used if no data argument was
provided. 'mode' can be 'NULLABLE', 'REQUIRED' or 'REPEATED'. For the allowed types, see:  

    * https://cloud.google.com/bigquery/preparing-data-for-bigquery#datatypes

#### Table 
Represents a Table object referencing a BigQuery table. 

##### Ancestors (in MRO)
- gcp.bigquery._table.Table

- __builtin__.object

##### Descendents
- gcp.bigquery._query_results_table.QueryResultsTable

##### Instance variables
- **full_name**

    The full name for the table.

- **is_temporary**

    Whether this is a short-lived table or not.

- **length**

    Get the length of the table (number of rows). We don't use __len__ as this may
return -1 for 'unknown'.

- **metadata**

    Retrieves metadata about the table.
  
    Returns:    
A TableMetadata object.  
Raises  
Exception if the request could not be executed or the response was malformed.

- **name**

    The TableName for the table.

- **schema**

    Retrieves the schema of the table.
  
    Returns:    
A Schema object containing a list of schema fields and associated metadata.  
Raises  
Exception if the request could not be executed or the response was malformed.

##### Methods
- **__init__** (self, api, name)

    Initializes an instance of a Table object.
  
    Args:  

    * api: the BigQuery API object to use to issue requests.

    * name: the name of the table either as a string or a 3-part tuple (projectid, datasetid, name).

- **create** (self, schema, overwrite=False)

    Create the table with the specified schema.
  
    Args:  

    * schema: the schema to use to create the table. Should be a list of dictionaries, each
containing at least a pair of entries, 'name' and 'type'.  

    * See https://cloud.google.com/bigquery/docs/reference/v2/tables#resource

    * overwrite: if True, delete the object first if it exists. If False and the object exists,
creation will fail and raise an Exception.  
Returns:    
The Table instance.  
Raises:    
Exception if the table couldn't be created or already exists and truncate was False.

- **delete** (self)

    Delete the table.
  
    Returns:    
Nothing

- **exists** (self)

    Checks if the table exists.
  
    Returns:    
True if the table exists; False otherwise.  
Raises:    
Exception if there was an error requesting information about the table.

- **extract** (self, destination, format='CSV', compress=False, field_delimiter=',', print_header=True)

    Exports the table to GCS; blocks until complete.
  
    Args:  

    * destination: the destination URI(s). Can be a single URI or a list.

    * format: the format to use for the exported data; one of CSV, NEWLINE_DELIMITED_JSON or AVRO.  
Defaults to CSV.
compress whether to compress the data on export. Compression is not supported for  
AVRO format. Defaults to False.

    * field_delimiter: for CSV exports, the field delimiter to use. Defaults to ','

    * print_header: for CSV exports, whether to include an initial header line. Default true.  
Returns:    
A Job object for the export Job if it was started successfully; else None.

- **extract_async** (self, destination, format='CSV', compress=False, field_delimiter=',', print_header=True)

    Start a job to export the table to GCS and return immediately.
  
    Args:  

    * destination: the destination URI(s). Can be a single URI or a list.

    * format: the format to use for the exported data; one of CSV, NEWLINE_DELIMITED_JSON or AVRO.  
Defaults to CSV.
compress whether to compress the data on export. Compression is not supported for  
AVRO format. Defaults to False.

    * field_delimiter: for CSV exports, the field delimiter to use. Defaults to ','

    * print_header: for CSV exports, whether to include an initial header line. Default true.  
Returns:    
A Job object for the export Job if it was started successfully; else None.

- **insertAll** (self, data, include_index=False, index_name=None)

    Insert the contents of a Pandas DataFrame or a list of dictionaries into the table.
  
    Args:  

    * data: the DataFrame or list to insert.

    * include_index: whether to include the DataFrame or list index as a column in the BQ table.

    * index_name: for a list, if include_index is True, this should be the name for the index.  
If not specified, 'Index' will be used.  
Returns:    
The table.  
Raises:    
Exception if the table doesn't exist, the schema differs from the data's schema, or the insert
failed.

- **load** (self, source, append=False, overwrite=False, source_format='CSV', field_delimiter=',', allow_jagged_rows=False, allow_quoted_newlines=False, encoding='UTF-8', ignore_unknown_values=False, max_bad_records=0, quote='"', skip_leading_rows=0)

    Load the table from GCS.
  
    Args:  

    * source: the URL of the source bucket(s). Can include wildcards.

    * append: if True append onto existing table contents.

    * overwrite: if True overwrite existing table contents.

    * source_format: the format of the data; default 'CSV'. Other options are DATASTORE_BACKUP
or NEWLINE_DELIMITED_JSON.

    * field_delimiter: The separator for fields in a CSV file. BigQuery converts the string to  
ISO-8859-1 encoding, and then uses the first byte of the encoded string to split the data
as raw binary (default ',').

    * allow_jagged_rows: If True, accept rows in CSV files that are missing trailing optional
columns; the missing values are treated as nulls (default False).

    * allow_quoted_newlines: If True, allow quoted data sections in CSV files that contain newline
characters (default False).

    * encoding: The character encoding of the data, either 'UTF-8' (the default) or 'ISO-8859-1'.

    * ignore_unknown_values: If True, accept rows that contain values that do not match the schema;
the unknown values are ignored (default False).
max_bad_records The maximum number of bad records that are allowed (and ignored) before
returning an 'invalid' error in the Job result (default 0).

    * quote: The value used to quote data sections in a CSV file; default '"'. If your data does
not contain quoted sections, set the property value to an empty string. If your data
contains quoted newline characters, you must also enable allow_quoted_newlines.

    * skip_leading_rows: A number of rows at the top of a CSV file to skip (default 0).
  
    Returns:    
A Job object for the load Job if it was started successfully; else None.

- **load_async** (self, source, append=False, overwrite=False, source_format='CSV', field_delimiter=',', allow_jagged_rows=False, allow_quoted_newlines=False, encoding='UTF-8', ignore_unknown_values=False, max_bad_records=0, quote='"', skip_leading_rows=0)

    Load the table from GCS.
  
    Args:  

    * source: the URL of the source bucket(s). Can include wildcards.

    * append: if True append onto existing table contents.

    * overwrite: if True overwrite existing table contents.

    * source_format: the format of the data; default 'CSV'. Other options are DATASTORE_BACKUP
or NEWLINE_DELIMITED_JSON.

    * field_delimiter: The separator for fields in a CSV file. BigQuery converts the string to  
ISO-8859-1 encoding, and then uses the first byte of the encoded string to split the data
as raw binary (default ',').

    * allow_jagged_rows: If True, accept rows in CSV files that are missing trailing optional
columns; the missing values are treated as nulls (default False).

    * allow_quoted_newlines: If True, allow quoted data sections in CSV files that contain newline
characters (default False).

    * encoding: The character encoding of the data, either 'UTF-8' (the default) or 'ISO-8859-1'.

    * ignore_unknown_values: If True, accept rows that contain values that do not match the schema;
the unknown values are ignored (default False).
max_bad_records The maximum number of bad records that are allowed (and ignored) before
returning an 'invalid' error in the Job result (default 0).

    * quote: The value used to quote data sections in a CSV file; default '"'. If your data does
not contain quoted sections, set the property value to an empty string. If your data
contains quoted newline characters, you must also enable allow_quoted_newlines.

    * skip_leading_rows: A number of rows at the top of a CSV file to skip (default 0).
  
    Returns:    
A Job object for the load Job if it was started successfully; else None.

- **range** (self, start_row=0, max_rows=None)

    Get an iterator to iterate through a set of table rows.
  
    Args:  

    * start_row: the row of the table at which to start the iteration (default 0)

    * max_rows: an upper limit on the number of rows to iterate through (default None)
  
    Returns:    
A row iterator.

- **sample** (self, fields=None, count=5, sampling=None, use_cache=True)

    Retrieves a sampling of data from the table.
  
    Args:  

    * fields: an optional list of field names to retrieve.

    * count: an optional count of rows to retrieve which is used if a specific
sampling is not specified.

    * sampling: an optional sampling strategy to apply to the table.

    * use_cache: whether to use cached results or not.  
Returns:    
A QueryResults object containing the resulting data.  
Raises:    
Exception if the sample query could not be executed or query response was malformed.

- **to_dataframe** (self, start_row=0, max_rows=None)

    Exports the table to a Pandas dataframe.
  
    Args:  

    * start_row: the row of the table at which to start the export (default 0)

    * max_rows: an upper limit on the number of rows to export (default None)  
Returns:    
A dataframe containing the table data.

- **to_file** (self, path, start_row=0, max_rows=None, write_header=True, dialect=<class csv.excel at 0x105061600>)

    Save the results to a local file in CSV format.
  
    Args:  

    * path: path on the local filesystem for the saved results.

    * start_row: the row of the table at which to start the export (default 0)

    * max_rows: an upper limit on the number of rows to export (default None)

    * write_header: if true (the default), write column name header row at start of file

    * dialect: the format to use for the output. By default, csv.excel. See

    * https://docs.python.org/2/library/csv.html#csv-fmt-params for how to customize this.  
Raises:    
An Exception if the operation failed.

- **update** (self, friendly_name=None, description=None, expiry=None, schema=None)

    Selectively updates Table information.
  
    Args:  

    * friendly_name: if not None, the new friendly name.

    * description: if not None, the new description.

    * expiry: if not None, the new expiry time, either as a DateTime or milliseconds since epoch.

    * schema: if not None, the new schema: either a list of dictionaries or a Schema.
  
    Returns:

#### TableMetadata 
Represents metadata about a BigQuery table.

##### Ancestors (in MRO)
- gcp.bigquery._table.TableMetadata

- __builtin__.object

##### Instance variables
- **created_on**

    The creation timestamp.

- **description**

    The description of the table if it exists.

- **expires_on**

    The timestamp for when the table will expire.

- **friendly_name**

    The friendly name of the table if it exists.

- **full_name**

    The full name of the table.

- **modified_on**

    The timestamp for when the table was last modified.

- **rows**

    The number of rows within the table.

- **size**

    The size of the table in bytes.

##### Methods
- **__init__** (self, table, info)

    Initializes an instance of a TableMetadata.
  
    Args:  

    * table: the table this belongs to.

    * info: The BigQuery information about this table.
Module gcp.bigquery._udf
------------------------

Google Cloud Platform library - BigQuery UDF Functionality.

Classes
-------
#### Function 
Represents a BigQuery UDF declaration.

##### Ancestors (in MRO)
- gcp.bigquery._udf.Function

- __builtin__.object

##### Methods
- **__init__** (self, api, inputs, outputs, implementation)

    Initializes a Function object from its pieces.
  
    Args:  

    * api: the BigQuery API object to use to issue requests.

    * inputs: a list of string field names representing the schema of input.

    * outputs: a list of name/type tuples representing the schema of the output.

    * implementation: a javascript function implementing the logic.

#### FunctionCall 
Represents a BigQuery UDF invocation.

##### Ancestors (in MRO)
- gcp.bigquery._udf.FunctionCall

- __builtin__.object

##### Instance variables
- **sql**

    Gets the underlying SQL representation of this UDF object.

##### Methods
- **__init__** (self, api, data, inputs, outputs, implementation)

    Initializes a UDF object from its pieces.
  
    Args:  

    * api: the BigQuery API object to use to issue requests.

    * data: the query or table over which the UDF operates.

    * inputs: a list of string field names representing the schema of input.

    * outputs: a list of name/type tuples representing the schema of the output.

    * implementation: a javascript function implementing the logic.

- **results** (self, use_cache=True)

    Retrieves results from executing the UDF.
  
    Args:  

    * use_cache: whether to use cached results or not.  
Returns:    
A QueryResults objects representing the result set.  
Raises:    
Exception if the query could not be executed or query response was malformed.

#### FunctionEvaluation 
##### Ancestors (in MRO)
- gcp.bigquery._udf.FunctionEvaluation

- __builtin__.object

##### Instance variables
- **data**

- **implementation**

##### Methods
- **__init__** (self, implementation, data)
Module gcp.bigquery._utils
--------------------------

Useful common utility functions.

Functions
---------
- **parse_dataset_name** (name, project_id=None)

    Parses a dataset name into its individual parts.
  
    Args:  

    * name: the name to parse, or a tuple, dictionary or array containing the parts.

    * project_id: the expected project ID. If the name does not contain a project ID,
this will be used; if the name does contain a project ID and it does not match
this, an exception will be thrown.  
Returns:    
The DataSetName for the dataset.  
Raises:    

    * Exception: raised if the name doesn't match the expected formats.

- **parse_table_name** (name, project_id=None, dataset_id=None)

    Parses a table name into its individual parts.
  
    Args:  

    * name: the name to parse, or a tuple, dictionary or array containing the parts.

    * project_id: the expected project ID. If the name does not contain a project ID,
this will be used; if the name does contain a project ID and it does not match
this, an exception will be thrown.

    * dataset_id: the expected dataset ID. If the name does not contain a dataset ID,
this will be used; if the name does contain a dataset ID and it does not match
this, an exception will be thrown.  
Returns:    
A tuple consisting of the full name and individual name parts.  
Raises:    

    * Exception: raised if the name doesn't match the expected formats.

Classes
-------
#### DataSetName 
DataSetName(project_id, dataset_id)

##### Ancestors (in MRO)
- gcp.bigquery._utils.DataSetName

- __builtin__.tuple

- __builtin__.object

##### Instance variables
- **dataset_id**

    Alias for field number 1

- **project_id**

    Alias for field number 0

#### TableName 
TableName(project_id, dataset_id, table_id, decorator)

##### Ancestors (in MRO)
- gcp.bigquery._utils.TableName

- __builtin__.tuple

- __builtin__.object

##### Instance variables
- **dataset_id**

    Alias for field number 1

- **decorator**

    Alias for field number 3

- **project_id**

    Alias for field number 0

- **table_id**

    Alias for field number 2
Module gcp.bigquery._view
-------------------------

Implements BigQuery Views.

Classes
-------
#### View 
An implementation of a BigQuery View. 

##### Ancestors (in MRO)
- gcp.bigquery._view.View

- __builtin__.object

##### Instance variables
- **description**

    The description of the view if it exists.

- **friendly_name**

    The friendly name of the view if it exists.

- **full_name**

    The full name of the table.

- **name**

    The name for the view as a named tuple.

- **query**

    The View Query.

- **schema**

    Retrieves the schema of the table.
  
    Returns:    
A Schema object containing a list of schema fields and associated metadata.  
Raises  
Exception if the request could not be executed or the response was malformed.

##### Methods
- **__init__** (self, api, name)

    Initializes an instance of a View object.
  
    Args:  

    * api: the BigQuery API object to use to issue requests.

    * name: the name of the view either as a string or a 3-part tuple (projectid, datasetid, name).

- **create** (self, query)

    Create the view with the specified query.
  
    Args:  

    * query: the query to use to for the View; either a string or a Query.  
Returns:    
The View instance.  
Raises:    
Exception if the view couldn't be created or already exists and overwrite was False.

- **delete** (self)

    Remove the View if it exists.

- **execute** (self, table_name=None, append=False, overwrite=False, use_cache=True, batch=True)

    Materialize the View synchronously.
  
    Args:  

    * dataset_id: the datasetId for the result table.

    * table: the result table name; if None, then a temporary table will be used.

    * append: if True, append to the table if it is non-empty; else the request will fail if table
is non-empty unless overwrite is True.

    * overwrite: if the table already exists, truncate it instead of appending or raising an  
Exception.

    * use_cache: whether to use past results or ignore cache. Has no effect if destination is
specified.

    * batch: whether to run this as a batch job (lower priority) or as an interactive job (high
priority, more expensive).  
Returns:    
A Job for the materialization  
Raises:    
Exception (KeyError) if View could not be materialized.

- **execute_async** (self, table_name=None, append=False, overwrite=False, use_cache=True, batch=True)

    Materialize the View asynchronously.
  
    Args:  

    * dataset_id: the datasetId for the result table.

    * table: the result table name; if None, then a temporary table will be used.

    * append: if True, append to the table if it is non-empty; else the request will fail if table
is non-empty unless overwrite is True.

    * overwrite: if the table already exists, truncate it instead of appending or raising an  
Exception.

    * use_cache: whether to use past results or ignore cache. Has no effect if destination is
specified.

    * batch: whether to run this as a batch job (lower priority) or as an interactive job (high
priority, more expensive).  
Returns:    
A Job for the materialization  
Raises:    
Exception (KeyError) if View could not be materialized.

- **exists** (self)

    Whether the view has been created.

- **results** (self, use_cache=True)

    Materialize the view synchronously.
  
    Args:  

    * use_cache: whether to use cached results or not. Ignored if append is specified.  
Returns:    
A QueryResultsTable containing the result set.  
Raises:    
Exception if the query could not be executed or query response was
malformed.

- **sample** (self, fields=None, count=5, sampling=None, use_cache=True)

    Retrieves a sampling of data from the view.
  
    Args:  

    * fields: an optional list of field names to retrieve.

    * count: an optional count of rows to retrieve which is used if a specific
sampling is not specified.

    * sampling: an optional sampling strategy to apply to the view.

    * use_cache: whether to use cached results or not.  
Returns:    
A QueryResults object containing the resulting data.  
Raises:    
Exception if the sample query could not be executed or query response was malformed.

- **update** (self, friendly_name=None, description=None, query=None)

    Selectively updates View information.
  
    Args:  

    * friendly_name: if not None, the new friendly name.

    * description: if not None, the new description.

    * expiry: if not None, the new expiry time, either as a DateTime or milliseconds since epoch.

    * query: if not None, a new query string for the View.
  
    Returns:
