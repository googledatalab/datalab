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

"""Google Cloud Platform library - BigQuery Functionality."""

from _csv_options import CSVOptions
from _dataset import DataSet, DataSets
from _federated_table import FederatedTable
from _job import Job
from _query import Query
from _query_job import QueryJob
from _query_results_table import QueryResultsTable
from _query_stats import QueryStats
from _sampling import Sampling
from _schema import Schema
from _table import Table, TableMetadata
from _udf import UDF
from _utils import TableName, DataSetName
from _view import View


def wait_any(jobs, timeout=None):
  """ Return when at least one of the specified jobs has completed or timeout expires.

  Args:
    jobs: a list of Jobs to wait on.
    timeout: a timeout in seconds to wait for. None (the default) means no timeout.
  Returns:
    Once at least one job completes, a list of all completed jobs.
    If the call times out then an empty list will be returned.

  """
  return Job.wait_any(jobs, timeout)


def wait_all(jobs, timeout=None):
  """ Return when at all of the specified jobs have completed or timeout expires.

  Args:
    jobs: a single Job or list of Jobs to wait on.
    timeout: a timeout in seconds to wait for. None (the default) means no timeout.
  Returns:
    A list of completed Jobs. If the call timed out this will be shorter than the
    list of jobs supplied as a parameter.
  """
  return Job.wait_all(jobs, timeout)
