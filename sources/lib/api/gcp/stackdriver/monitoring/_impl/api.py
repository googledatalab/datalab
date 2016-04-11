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

"""HTTP API wrapper for the Google Monitoring API."""

from gcp._util import Http


class Api(object):
  """A helper class to issue Monitoring API HTTP requests."""

  _ENDPOINT = 'https://monitoring.googleapis.com/v3/'
  _GROUPS_PATH = 'projects/%s/groups/%s'
  _GROUP_MEMBERS_PATH = '{}/members'.format(_GROUPS_PATH)
  _METRIC_PATH = 'projects/%s/metricDescriptors/%s'
  _RESOURCE_PATH = 'projects/%s/monitoredResourceDescriptors/%s'
  _TIMESERIES_PATH = 'projects/%s/timeSeries'

  def __init__(self, credentials):
    """Initializes the Monitoring helper with credentials.

    Args:
      credentials: The credentials to use to authorize requests.
    """
    self._credentials = credentials

  def groups_get(self, group_id, project_id):
    """Issues a request to retrieve information about a group.

    Args:
      group_id: The ID of the group.
      project_id: The project ID to use to fetch the results.

    Returns:
      A parsed result object.
    """
    url = self._ENDPOINT + self._GROUPS_PATH % (project_id, group_id)
    return Http.request(url, credentials=self._credentials)

  def groups_list(self, project_id, children_of_group=None,
                  ancestors_of_group=None, descendants_of_group=None,
                  page_size=None, page_token=None):
    """Issues a request to list the groups in the project.

    At most one of the parameters children_of_group, ancestors_of_group, and
    descendants_of_group may be specified to narrow the query.

    Args:
      project_id: The project ID to use to fetch the results.
      children_of_group: The ID of the group whose children are to be listed.
      ancestors_of_group: The ID of the group whose ancestors are to be listed.
      descendants_of_group: The ID of the group whose descendants are to be
          listed.
      page_size: The maximum number of results to return per page.
      page_token: An optional token to continue the retrieval.

    Returns:
      A parsed result object.
    """
    url = self._ENDPOINT + self._GROUPS_PATH % (project_id, '')
    args = {}

    if children_of_group is not None:
      args['childrenOfGroup'] = self._GROUPS_PATH % (project_id,
                                                     children_of_group)
    if ancestors_of_group is not None:
      args['ancestorsOfGroup'] = self._GROUPS_PATH % (project_id,
                                                      ancestors_of_group)
    if descendants_of_group is not None:
      args['descendantsOfGroup'] = self._GROUPS_PATH % (project_id,
                                                        descendants_of_group)
    if page_size is not None:
      args['pageSize'] = page_size
    if page_token is not None:
      args['pageToken'] = page_token

    return Http.request(url, args=args, credentials=self._credentials)

  def groups_members_list(
      self, group_id, project_id, end_time=None, start_time=None, filter=None,
      page_size=None, page_token=None):
    """Issues a request to retrieve the members of a group.

    Args:
      group_id: The ID of the group.
      project_id: The project ID to use to fetch the results.
      end_time: The end time (inclusive) of the group membership.
      start_time: The start time (exclusive) of the group membership.
      filter: A filter to restrict the resources returned. E.g.:
          'resource.type = "gce_instance"'
      page_size: The maximum number of results to return per page.
      page_token: An optional token to continue the retrieval.

    Returns:
      A parsed result object.
    """
    # Allow "filter" as a parameter name: pylint: disable=redefined-builtin
    url = self._ENDPOINT + self._GROUP_MEMBERS_PATH % (project_id, group_id)
    args = {}
    if end_time is not None:
      args['interval.endTime'] = _format_timestamp_as_string(end_time)
    if start_time is not None:
      args['interval.startTime'] = _format_timestamp_as_string(start_time)
    if filter is not None:
      args['filter'] = filter
    if page_size is not None:
      args['pageSize'] = page_size
    if page_token is not None:
      args['pageToken'] = page_token
    return Http.request(url, args=args, credentials=self._credentials)

  def metric_descriptors_get(self, metric_id, project_id):
    """Issues a request to retrieve information about a metric.

    Args:
      metric_id: The ID of the metric.
      project_id: The project ID to use to fetch the results.

    Returns:
      A parsed result object.
    """
    url = self._ENDPOINT + self._METRIC_PATH % (project_id, metric_id)
    return Http.request(url, credentials=self._credentials)

  def metric_descriptors_list(
      self, project_id, filter=None, page_size=None, page_token=None):
    """Issues a request to list the descriptors of all metrics in the project.

    Args:
      project_id: The project ID to use to fetch the results.
      filter: A filter to restrict the metrics returned. E.g.:
          'metric.type = starts_with("compute")'
      page_size: The maximum number of results to return per page.
      page_token: An optional token to continue the retrieval.

    Returns:
      A parsed result object.
    """
    # Allow "filter" as a parameter name: pylint: disable=redefined-builtin
    url = self._ENDPOINT + self._METRIC_PATH % (project_id, '')
    args = {}
    if filter is not None:
      args['filter'] = filter
    if page_size is not None:
      args['pageSize'] = page_size
    if page_token is not None:
      args['pageToken'] = page_token
    return Http.request(url, args=args, credentials=self._credentials)

  def monitored_resource_descriptors_get(self, resource_type, project_id):
    """Issues a request to retrieve information about a resource type.

    Args:
      resource_type: The type of resource to get the descriptor for.
      project_id: The project ID to use to fetch the results.

    Returns:
      A parsed result object.
    """
    url = self._ENDPOINT + self._RESOURCE_PATH % (project_id, resource_type)
    return Http.request(url, credentials=self._credentials)

  def monitored_resource_descriptors_list(
      self, project_id, filter=None, page_size=None, page_token=None):
    """Issues a request to list the descriptors of available resource types.

    Args:
      project_id: The project ID to use to fetch the results.
      filter: A filter for the resource descriptors. E.g.:
          'resource.type = starts_with("gce_")'
      page_size: The maximum number of results to return per page.
      page_token: An optional token to continue the retrieval.

    Returns:
      A parsed result object.
    """
    # Allow "filter" as a parameter name: pylint: disable=redefined-builtin
    url = self._ENDPOINT + self._RESOURCE_PATH % (project_id, '')
    args = {}
    if filter is not None:
      args['filter'] = filter
    if page_size is not None:
      args['pageSize'] = page_size
    if page_token is not None:
      args['pageToken'] = page_token
    return Http.request(url, args=args, credentials=self._credentials)

  def time_series_list(
      self, project_id, filter, end_time, start_time=None,
      per_series_aligner=None, alignment_period_seconds=None,
      cross_series_reducer=None, group_by_fields=(),
      view=None,
      page_size=None,
      page_token=None):
    """Issues a request to retrieve metric data.

    Args:
      project_id: The project ID to use to fetch the results.
      filter: The filter for the resource and metrics to fetch.
      end_time: The end time (inclusive) of the timeseries data.
      start_time: The start time (exclusive) of the timeseries data.
      per_series_aligner: An alignment period for the timeseries data.
      alignment_period_seconds: An int specifying the alignment period.
      cross_series_reducer: The reduce method for aggregating multiple
          timeseries.
      group_by_fields: An iterable of fields to preserve when
        cross_series_reducer is specified. E.g.: ["resource.zone"]
      view: Specifies which information is returned about the time series.
          Must be one of "FULL" or "HEADERS".
      page_size: The maximum number of results to return per page.
      page_token: An optional token to continue the retrieval.

    Returns:
      A parsed result object.
    """
    # Allow "filter" as a parameter name: pylint: disable=redefined-builtin

    url = self._ENDPOINT + self._TIMESERIES_PATH % project_id

    # Assemble the arguments for the RPC.
    args = {
        'filter': filter,
        'interval.endTime': _format_timestamp_as_string(end_time),
    }
    if start_time is not None:
      args['interval.startTime'] = _format_timestamp_as_string(start_time)
    if per_series_aligner is not None:
      args['aggregation.perSeriesAligner'] = per_series_aligner
    if alignment_period_seconds is not None:
      args['aggregation.alignmentPeriod'] = '{:d}s'.format(
          alignment_period_seconds)
    if cross_series_reducer is not None:
      args['aggregation.crossSeriesReducer'] = cross_series_reducer
    if view is not None:
      args['view'] = view
    if page_size is not None:
      args['pageSize'] = page_size
    if page_token is not None:
      args['pageToken'] = page_token

    # Convert to a list before adding repeated fields.
    args = args.items()

    args.extend(('aggregation.groupByFields', field)
                for field in group_by_fields)

    return Http.request(url, args=args, credentials=self._credentials)


def _format_timestamp_as_string(timestamp):
  """Converts a datetime object to a string as required by the API.

  Args:
    timestamp: A Python datetime object or a timestamp string in RFC3339
        UTC "Zulu" format.

  Returns:
    The string version of the timestamp. For example:
        "2016-02-17T19:18:01.763000Z".
  """
  if isinstance(timestamp, basestring):
    return timestamp

  if timestamp.tzinfo is not None:
    # Convert to UTC and remove the time zone info.
    timestamp = timestamp.replace(tzinfo=None) - timestamp.utcoffset()

  return timestamp.isoformat() + 'Z'
