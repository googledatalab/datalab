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

"""Implements BigQuery Views."""

import gcp
import _query
import _table

# Query import is at end to avoid issues with circular dependencies.


class View(object):
  """ An implementation of a BigQuery View. """

  # Views in BigQuery are virtual tables, but it is useful to have a mixture of both Table and
  # Query semantics; our version thus internally has a BaseTable and a Query (for materialization;
  # not the same as the view query), and exposes a number of the same APIs as Table and Query
  # through wrapper functions around these.

  def __init__(self, name, context=None):
    """Initializes an instance of a View object.

    Args:
      name: the name of the view either as a string or a 3-part tuple
          (projectid, datasetid, name). If a string, it must have the form
          '<project>:<dataset>.<view>' or '<dataset>.<view>'.
      context: an optional Context object providing project_id and credentials. If a specific
          project id or credentials are unspecified, the default ones configured at the global
          level are used.
    Raises:
      Exception if the name is invalid.
      """
    if context is None:
      context = gcp.Context.default()
    self._context = context
    self._table = _table.Table(name, context=context)
    self._materialization = _query.Query('SELECT * FROM %s' % self._repr_sql_(), context=context)

  def __str__(self):
    """The full name for the view as a string."""
    return str(self._table)

  @property
  def name(self):
    """The name for the view as a named tuple."""
    return self._table._name_parts

  @property
  def description(self):
    """The description of the view if it exists."""
    return self._table.metadata.description

  @property
  def friendly_name(self):
    """The friendly name of the view if it exists."""
    return self._table.metadata.friendly_name

  @property
  def query(self):
    """The Query that defines the view."""
    if not self.exists():
      return None
    self._table._load_info()
    if 'view' in self._table._info and 'query' in self._table._info['view']:
      return _query.Query(self._table._info['view']['query'], context=self._context)
    return None

  def exists(self):
    """Whether the view's Query has been executed and the view is available or not."""
    return self._table.exists()

  def delete(self):
    """Removes the view if it exists."""
    self._table.delete()

  def create(self, query):
    """ Creates the view with the specified query.

    Args:
      query: the query to use to for the View; either a string containing a SQL query or
          a Query object.
    Returns:
      The View instance.
    Raises:
      Exception if the view couldn't be created or already exists and overwrite was False.
    """
    if isinstance(query, _query.Query):
      query = query.sql
    try:
      response = self._table._api.tables_insert(self._table._name_parts, query=query)
    except Exception as e:
      raise e
    if 'selfLink' in response:
      return self
    raise Exception("View %s could not be created as it already exists" % str(self))

  def sample(self, fields=None, count=5, sampling=None, use_cache=True):
    """Retrieves a sampling of data from the view.

    Args:
      fields: an optional list of field names to retrieve.
      count: an optional count of rows to retrieve which is used if a specific
          sampling is not specified.
      sampling: an optional sampling strategy to apply to the view.
      use_cache: whether to use cached results or not.
    Returns:
      A QueryResultsTable object containing the resulting data.
    Raises:
      Exception if the sample query could not be executed or the query response was malformed.
    """
    return self._table.sample(fields=fields, count=count, sampling=sampling, use_cache=use_cache)

  @property
  def schema(self):
    """Retrieves the schema of the table.

    Returns:
      A Schema object containing a list of schema fields and associated metadata.
    Raises
      Exception if the request could not be executed or the response was malformed.
    """
    return self._table.schema

  def update(self, friendly_name=None, description=None, query=None):
    """ Selectively updates View information.

    Any parameters that are None (the default) are not applied in the update.

    Args:
      friendly_name: if not None, the new friendly name.
      description: if not None, the new description.
      expiry: if not None, the new expiry time, either as a DateTime or milliseconds since epoch.
      query: if not None, a new query string for the View.
    """
    self._table._load_info()
    if query is not None:
      if isinstance(query, _query.Query):
        query = query.sql
      self._table._info['view'] = {'query': query}
    self._table.update(friendly_name=friendly_name, description=description)

  def results(self, use_cache=True):
    """Materialize the view synchronously.

    If you require more control over the execution, use execute() or execute_async().

    Args:
      use_cache: whether to use cached results or not.
    Returns:
      A QueryResultsTable containing the result set.
    Raises:
      Exception if the query could not be executed or query response was malformed.
    """
    return self._materialization.results(use_cache=use_cache)

  def execute_async(self, table_name=None, table_mode='create', use_cache=True, priority='high',
                    allow_large_results=False):
    """Materialize the View asynchronously.

    Args:
      dataset_id: the datasetId for the result table.
      table_name: the result table name; if None, then a temporary table will be used.
      table_mode: one of 'create', 'overwrite' or 'append'. If 'create' (the default), the request
          will fail if the table exists.
      use_cache: whether to use past query results or ignore cache. Has no effect if destination is
          specified (default True).
      priority:one of 'low' or 'high' (default). Note that 'high' is more expensive, but is
          better suited to exploratory analysis.
      allow_large_results: whether to allow large results; i.e. compressed data over 100MB. This is
          slower and requires a table_name to be specified) (default False).
    Returns:
      A QueryJob for the materialization
    Raises:
      Exception (KeyError) if View could not be materialized.
    """
    return self._materialization.execute_async(table_name=table_name, table_mode=table_mode,
                                               use_cache=use_cache, priority=priority,
                                               allow_large_results=allow_large_results)

  def execute(self, table_name=None, table_mode='create', use_cache=True, priority='high',
              allow_large_results=False):
    """Materialize the View synchronously.

    Args:
      dataset_id: the datasetId for the result table.
      table_name: the result table name; if None, then a temporary table will be used.
      table_mode: one of 'create', 'overwrite' or 'append'. If 'create' (the default), the request
          will fail if the table exists.
      use_cache: whether to use past query results or ignore cache. Has no effect if destination is
          specified (default True).
      priority:one of 'low' or 'high' (default). Note that 'high' is more expensive, but is
          better suited to exploratory analysis.
      allow_large_results: whether to allow large results; i.e. compressed data over 100MB. This is
          slower and requires a table_name to be specified) (default False).
    Returns:
      A QueryJob for the materialization
    Raises:
      Exception (KeyError) if View could not be materialized.
    """
    return self._materialization.execute(table_name=table_name, table_mode=table_mode,
                                         use_cache=use_cache, priority=priority,
                                         allow_large_results=allow_large_results)

  def _repr_sql_(self):
    """Returns a representation of the view for embedding into a SQL statement.

    Returns:
      A formatted table name for use within SQL statements.
    """
    return '[' + str(self) + ']'

  def __repr__(self):
    """Returns a representation for the view for showing in the notebook.
    """
    return 'View %s\n%s' % (self._table, self.query)
