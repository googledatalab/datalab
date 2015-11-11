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

"""Implements BigQuery query job results table functionality."""

import _table


class QueryResultsTable(_table.Table):
  """ A subclass of Table specifically for Query results.

  The primary differences are the additional properties job_id and sql.
  """

  def __init__(self, name, context, job, is_temporary=False):
    """Initializes an instance of a Table object.

    Args:
      name: the name of the table either as a string or a 3-part tuple (projectid, datasetid, name).
      context: an optional Context object providing project_id and credentials. If a specific
        project id or credentials are unspecified, the default ones configured at the global
        level are used.
      job: the QueryJob associated with these results.
      is_temporary: if True, this is a short-lived table for intermediate results (default False).
    """
    super(QueryResultsTable, self).__init__(name, context)
    self._job = job
    self._is_temporary = is_temporary

  def __repr__(self):
    """Returns a representation for the dataset for showing in the notebook.
    """
    if self._is_temporary:
      return 'QueryResultsTable %s' % self.job_id
    else:
      return super(QueryResultsTable, self).__repr__()

  @property
  def job(self):
    """ The QueryJob object that caused the table to be populated. """
    return self._job

  @property
  def job_id(self):
    """ The ID of the query job that caused the table to be populated. """
    return self._job.id

  @property
  def sql(self):
    """ The SQL statement for the query that populated the table. """
    return self._job.sql

  @property
  def is_temporary(self):
    """ Whether this is a short-lived table or not. """
    return self._is_temporary
