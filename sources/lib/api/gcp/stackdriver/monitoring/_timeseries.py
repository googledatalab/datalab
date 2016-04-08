# Copyright 2016 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Provides access to metric data as pandas dataframes."""

import pandas

import gcp
from . import _impl
from . import _utils


class Query(_impl.Query):
  """Query object for retrieving metric data."""

  def __init__(self,
               metric_type=_impl.Query.DEFAULT_METRIC_TYPE,
               end_time=None, start_time=None,
               days=0, hours=0, minutes=0,
               project_id=None, context=None):
    """Initializes the core query parameters.

    Args:
      metric_type: The metric type name. The default value is
          "compute.googleapis.com/instance/cpu/utilization", but
          please note that this default value is provided only for
          demonstration purposes and is subject to change.
      end_time: The end time (inclusive) of the time interval for which results
          should be returned, as a Python datetime object. The default is the
          start of the current minute. If the days/hours/minutes parameters are
          not used, the end time can alternatively be provided as a timestamp
          string in RFC3339 UTC "Zulu" format.
      start_time: An optional start time (exclusive) of the time interval for
          which results should be returned, as either a datetime object or a
          timestamp string. If omitted and no non-zero duration is specified,
          the interval is a point in time. If any of days, hours, or minutes
          is non-zero, these are combined and subtracted from the end time to
          determine the start time.
      days: The number of days in the time interval.
      hours: The number of hours in the time interval.
      minutes: The number of minutes in the time interval.
      project_id: An optional project ID or number to override the one provided
          by the context.
      context: An optional Context object to use instead of the global default.
    """
    client = _utils.make_client(project_id, context)
    super(Query, self).__init__(client, metric_type,
                                end_time, start_time, days, hours, minutes)

  def labels_as_dataframe(self):
    """Returns the resource and metric metadata as a dataframe.

    Returns:
      A pandas dataframe containing the resource type and resource and metric
      labels. Each row in this dataframe corresponds to the metadata from one
      time series.
    """
    headers = [{'resource': ts.resource.__dict__, 'metric': ts.metric.__dict__}
               for ts in self.iter(headers_only=True)]
    if not headers:
      return pandas.DataFrame()
    df = pandas.io.json.json_normalize(headers)

    # Add a 2 level column header.
    df.columns = pandas.MultiIndex.from_tuples(
        [col.rsplit('.', 1) for col in df.columns])

    # Re-order the columns.
    resource_keys = _impl.timeseries.sorted_resource_labels(
        df['resource.labels'].columns)
    sorted_columns = [('resource', 'type')]
    sorted_columns += [('resource.labels', key) for key in resource_keys]
    sorted_columns += sorted(col for col in df.columns
                             if col[0] == 'metric.labels')
    df = df[sorted_columns]

    # Sort the data, and clean up index values, and NaNs.
    df = df.sort_values(sorted_columns).reset_index(drop=True)
    df = df.fillna('')
    return df
