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

"""Time series in the Google Monitoring API."""

# Features intentionally omitted from this first version of the client library:
#   - Creating time series.
#   - Natural representation for distribution values.

import collections
import copy
import datetime
import itertools

from .api import Api
from .metric import Metric
from .resource import Resource

TOP_RESOURCE_LABELS = [
    'project_id',
    'aws_account',
    'location',
    'region',
    'zone',
]


class Query(object):
  """Query object for listing time series.

  Attributes:
    metric_type: The metric type name.
    filter: The filter string as constructed from the metric type, resource
        type, and selectors for the group ID, monitored projects, resource
        labels, and metric labels.
  """

  DEFAULT_METRIC_TYPE = 'compute.googleapis.com/instance/cpu/utilization'

  def __init__(self, client,
               metric_type=DEFAULT_METRIC_TYPE,
               end_time=None, start_time=None,
               days=0, hours=0, minutes=0):
    """Initializes the core query parameters.

    Args:
      client: The Client to use.
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
    """
    if end_time is None:
      end_time = datetime.datetime.utcnow().replace(second=0, microsecond=0)

    if days or hours or minutes:
      if start_time is not None:
        raise ValueError('Duration and start time both specified.')
      start_time = end_time - datetime.timedelta(days=days,
                                                 hours=hours,
                                                 minutes=minutes)

    self._client = client
    self._end_time = end_time
    self._start_time = start_time
    self._filter = _Filter(metric_type)

    self._per_series_aligner = None
    self._alignment_period_seconds = None
    self._cross_series_reducer = None
    self._group_by_fields = ()

  def __iter__(self):
    return self.iter()

  @property
  def metric_type(self):
    return self._filter.metric_type

  @property
  def filter(self):
    return str(self._filter)

  def select_group(self, group_id=None, display_name=None):
    """Copies the query and adds filtering by group.

    Exactly one of group_id and display_name must be specified.

    Args:
      group_id: The ID of a group to filter by.
      display_name: The display name of a group to filter by. If this is
          specified, information about the available groups is retrieved
          from the service to allow the group ID to be determined.

    Returns:
      The new Query object.

    Raises:
      ValueError: The given display name did not match exactly one group.
    """
    if not ((group_id is None) ^ (display_name is None)):
      raise ValueError(
          'Exactly one of "group_id" and "display_name" must be specified.')

    if display_name is not None:
      matching_groups = [g for g in self._client.list_groups()
                         if g.display_name == display_name]
      if len(matching_groups) != 1:
        raise ValueError('%d groups have the display_name %r.' % (
            len(matching_groups), display_name))
      group_id = matching_groups[0].id

    new_query = self.copy()
    new_query._filter.group_id = group_id
    return new_query

  def select_projects(self, *args):
    """Copies the query and adds filtering by monitored projects.

    Examples:

      query = query.select_projects('project-1')
      query = query.select_projects('project-a', 'project-b', 'project-c')

    Args:
      *args: Project IDs limiting the resources to be included in the query.

    Returns:
      The new Query object.
    """
    new_query = self.copy()
    new_query._filter.projects = args
    return new_query

  def select_resources(self, *args, **kwargs):
    """Copies the query and adds filtering by resource labels.

    Examples:

      query = query.select_resources(zone='us-central1-a')
      query = query.select_resources(zone_prefix='europe-')
      query = query.select_resources(resource_type='gce_instance')

    A keyword argument <label>=<value> ordinarily generates a filter expression
    of the form

      resource.label.<label> = "<value>"

    However, by adding '_prefix' or '_suffix' to the keyword, you can specify a
    partial match.

    <label>_prefix=<value> generates:
       resource.label.<label> = starts_with("<value>")

    <label>_suffix=<value> generates:
      resource.label.<label> = ends_with("<value>")

    As a special case, "resource_type" is treated as a special pseudo-label
    corresponding to the filter object resource.type. For example,

    resource_type=<value> generates:
      resource.type = "<value>"

    Warning: The label "instance_name" is a metric label, not a resource label.
    Use select_metrics(instance_name=...), not this method.

    Args:
      *args: Raw filter expression strings to include in the conjunction. If
          just one is provided and no keyword arguments are provided, it can
          be a disjunction.
      **kwargs: Label filters to include in the conjunction as described above.

    Returns:
      The new Query object.
    """
    new_query = self.copy()
    new_query._filter.select_resources(*args, **kwargs)
    return new_query

  def select_metrics(self, *args, **kwargs):
    """Copies the query and adds filtering by metric labels.

    Examples:

      query = query.select_metrics(instance_name='myinstance')
      query = query.select_metrics(instance_name_prefix='mycluster-')

    A keyword argument <label>=<value> ordinarily generates a filter expression
    of the form

      metric.label.<label> = "<value>"

    However, by adding '_prefix' or '_suffix' to the keyword, you can specify a
    partial match.

    <label>_prefix=<value> generates:
       metric.label.<label> = starts_with("<value>")

    <label>_suffix=<value> generates:
      metric.label.<label> = ends_with("<value>")

    Args:
      *args: Raw filter expression strings to include in the conjunction. If
          just one is provided and no keyword arguments are provided, it can
          be a disjunction.
      **kwargs: Label filters to include in the conjunction as described above.

    Returns:
      The new Query object.
    """
    new_query = self.copy()
    new_query._filter.select_metrics(*args, **kwargs)
    return new_query

  def align(self, per_series_aligner, seconds=0, minutes=0, hours=0):
    """Copies the query and adds temporal alignment.

    After alignment, if per_series_aligner is not "ALIGN_NONE", each time
    series will contain data points only on the period boundaries.

    Args:
      per_series_aligner: The approach to be used to align individual time
          series. E.g., "ALIGN_MEAN".
      seconds: The number of seconds in the alignment period.
      minutes: The number of minutes in the alignment period.
      hours: The number of hours in the alignment period.

    Returns:
      The new Query object.
    """
    new_query = self.copy()
    new_query._per_series_aligner = per_series_aligner
    new_query._alignment_period_seconds = seconds + 60 * (minutes + 60 * hours)
    return new_query

  def reduce(self, cross_series_reducer, *group_by_fields):
    """Copies the query and adds cross-series reduction.

    After reduction, if cross_series_reducer is not "REDUCE_NONE", the time
    series will be aggregated to only preserve the fields specified by
    *group_by_fields.

    Examples:
    The following results in one time series per zone:
      query = query.reduce("REDUCE_MEAN", "resource.zone")

    The following results in one time series per project_id and resource type
    combination:
      query = query.reduce("REDUCE_MEAN", "resource.project_id", "resource.type")


    Args:
      cross_series_reducer: The approach to be used to combine time series.
          E.g., "REDUCE_MEAN".
      *group_by_fields: The fields to be preserved by the reduction. The default
          is to aggregate all of the time series into just one.

    Returns:
      The new Query object.
    """
    new_query = self.copy()
    new_query._cross_series_reducer = cross_series_reducer
    new_query._group_by_fields = group_by_fields
    return new_query

  def iter(self, headers_only=False, _page_size=None):
    """Constructs an iterator over time series objects selected by the query.

    Note that the Query object itself is an iterable, such that the following
    are equivalent:

      for timeseries in query: ...
      for timeseries in query.iter(): ...

    Args:
      headers_only: Whether to omit the point data from the TimeSeries objects.
      _page_size: An optional positive number specifying the maximum number of
          points to return per page. This can be used to control how far the
          iterator reads ahead.

    Yields:
      TimeSeries objects, containing points ordered from oldest to newest.
    """
    api = Api(self._client.credentials)
    kwargs = {
        'project_id': self._client.project,
        'filter': self.filter,
        'end_time': self._end_time,
        'start_time': self._start_time,
        'per_series_aligner': self._per_series_aligner,
        'alignment_period_seconds': self._alignment_period_seconds,
        'cross_series_reducer': self._cross_series_reducer,
        'group_by_fields': self._group_by_fields,
        'view': 'HEADERS' if headers_only else 'FULL',
        'page_size': _page_size,
    }

    def fragments():
      page_token = None
      while True:
        list_info = api.time_series_list(page_token=page_token, **kwargs)
        for info in list_info.get('timeSeries', []):
          yield TimeSeries._from_dict(info)

        page_token = list_info.get('nextPageToken')
        if not page_token:
          break

    for timeseries, fragments in itertools.groupby(
        fragments(), lambda fragment: fragment._replace(points=None)):
      points = list(itertools.chain.from_iterable(
          fragment.points for fragment in fragments))
      points.reverse()  # Order from oldest to newest.
      yield timeseries._replace(points=points)

  def as_dataframe(self, label=None, labels=None):
    """Returns all the time series in the Query as a pandas dataframe.

    Examples:

      # Generate a dataframe with a multi-level column header including the
      # resource type and all available resource and metric labels. This can be
      # useful for seeing what labels are available.
      dataframe = query.as_dataframe()

      # Generate a dataframe using a particular label for the column names.
      dataframe = query.as_dataframe(label='instance_name')

      # Generate a dataframe with a multi-level column header.
      dataframe = query.as_dataframe(labels=['zone', 'instance_name'])

      # Generate a dataframe with a multi-level column header, for a metric
      # issued by more than one type of resource.
      dataframe = query.as_dataframe(labels=['resource_type', 'instance_id'])

    Args:
      label: The label name to use for the dataframe header. This can be the
          name of a resource label or a metric label (e.g., "instance_name"),
          or the string "resource_type".
      labels: A list or tuple of label names to use for the dataframe header.
          If more than one label name is provided, the resulting dataframe will
          have a multi-level column header. Providing vaues for both "label"
          and "labels" is an error.

    Returns:
      A pandas DataFrame object where each column represents one time series.
    """
    import pandas

    if label is not None and labels is not None:
      raise ValueError('Cannot specify both "label" and "labels".')
    elif not (labels or labels is None):
      raise ValueError('"labels" must be non-empty or None.')

    columns = []
    headers = []
    for time_series in self:
      pandas_series = pandas.Series(
          data=[p.value for p in time_series.points],
          index=[p.end_time for p in time_series.points],
      )
      columns.append(pandas_series)
      headers.append(time_series._replace(points=None))

    # Implement a smart default of using all available labels.
    if label is None and labels is None:
      resource_labels = set(itertools.chain.from_iterable(
          header.resource.labels.iterkeys() for header in headers))
      metric_labels = set(itertools.chain.from_iterable(
          header.metric.labels.iterkeys() for header in headers))
      labels = (['resource_type'] +
                sorted_resource_labels(resource_labels) +
                sorted(metric_labels))

    # Assemble the columns into a DataFrame.
    dataframe = pandas.DataFrame(columns).T

    # Convert the timestamp strings into a DatetimeIndex.
    dataframe.index = pandas.to_datetime(dataframe.index)

    # Build a column Index or MultiIndex from the label values. Do not
    # include level names in the column header if the user requested a
    # single-level header by specifying "label".
    level_names = labels or None
    label_keys = labels or [label]
    dataframe.columns = pandas.MultiIndex.from_arrays(
        [[header.labels.get(key, '') for header in headers]
         for key in label_keys],
        names=level_names)

    # Sort the rows just in case (since the API doesn't guarantee the
    # ordering), and sort the columns lexicographically.
    return dataframe.sort_index(axis=0).sort_index(axis=1)

  def copy(self):
    """Copies the Query object.

    Returns:
      The new Query object.
    """
    new_query = copy.copy(self)
    new_query._filter = copy.copy(self._filter)
    return new_query


class TimeSeries(collections.namedtuple(
    'TimeSeries', 'metric resource metric_kind value_type points')):
  """A single time series of metric values.

  Attributes:
    metric: A Metric object.
    resource: A Resource object.
    metric_kind: The kind of measurement. It must be one of:
        ['GAUGE', 'DELTA', 'CUMULATIVE'].
    value_type: The value type of the metric. It must be one of:
        ['BOOL', 'INT64', 'DOUBLE', 'STRING', 'DISTRIBUTION', 'MONEY'].
    points: A sequence of Point objects.
  """

  @classmethod
  def _from_dict(cls, info):
    """Constructs a TimeSeries from the parsed JSON representation.

    Args:
      info: A dict parsed from the JSON wire-format representation.

    Returns:
      A TimeSeries instance.
    """
    metric = Metric._from_dict(info['metric'])
    resource = Resource._from_dict(info['resource'])
    metric_kind = info['metricKind']
    value_type = info['valueType']
    points = [Point._from_dict(p) for p in info.get('points', [])]
    return cls(metric, resource, metric_kind, value_type, points)

  @property
  def labels(self):
    """A single dictionary with values for all the labels.

    This combines resource.labels and metric.labels and also
    adds "resource_type".
    """
    try:
      return self._labels
    except AttributeError:
      labels = {'resource_type': self.resource.type}
      labels.update(self.resource.labels)
      labels.update(self.metric.labels)
      self._labels = labels
      return self._labels

  def __repr__(self):
    """Returns a representation string with the points elided."""
    return '\n'.join([
        'TimeSeries(',
        '    {},'.format(self.metric),
        '    {},'.format(self.resource),
        '    {}, {}, Number of points={})'.format(
            self.metric_kind, self.value_type, len(self.points)),
    ])


class Point(collections.namedtuple(
    'Point', 'end_time start_time value')):
  """A single point in a time series.

  Attributes:
    end_time: The end time in RFC3339 UTC "Zulu" format.
    start_time: An optional start time in RFC3339 UTC "Zulu" format.
    value: The metric value. This can be a scalar or a distribution.
  """
  __slots__ = ()

  @classmethod
  def _from_dict(cls, info):
    """Constructs a Point from the parsed JSON representation.

    Args:
      info: A dict parsed from the JSON wire-format representation.

    Returns:
      A Point instance.
    """
    end_time = info['interval']['endTime']
    start_time = info['interval'].get('startTime')
    value_type, value = info['value'].iteritems().next()
    if value_type == 'int64Value':
      value = int(value)  # Convert from string.

    return cls(end_time, start_time, value)


class _Filter(object):

  def __init__(self, metric_type):
    self.metric_type = metric_type
    self.group_id = None
    self.projects = None
    self.resource_label_filter = None
    self.metric_label_filter = None

  def select_resources(self, *args, **kwargs):
    self.resource_label_filter = _build_label_filter('resource',
                                                     *args, **kwargs)

  def select_metrics(self, *args, **kwargs):
    self.metric_label_filter = _build_label_filter('metric',
                                                   *args, **kwargs)

  def __str__(self):
    filters = ['metric.type = "{}"'.format(self.metric_type)]
    if self.group_id is not None:
      filters.append('group.id = "{}"'.format(self.group_id))
    if self.projects:
      filters.append(' OR '.join('project = "{}"'.format(project)
                                 for project in self.projects))
    if self.resource_label_filter:
      filters.append(self.resource_label_filter)
    if self.metric_label_filter:
      filters.append(self.metric_label_filter)

    # Parentheses are never actually required, because OR binds more tightly
    # than AND in the Monitoring API's filter syntax.
    return ' AND '.join(filters)


def _build_label_filter(category, *args, **kwargs):
  """Construct a filter string to filter on metric or resource labels."""
  terms = list(args)
  for key, value in kwargs.iteritems():
    if value is None:
      continue

    suffix = None
    if key.endswith('_prefix') or key.endswith('_suffix'):
      key, suffix = key.rsplit('_', 1)

    if category == 'resource' and key == 'resource_type':
      key = 'resource.type'
    else:
      key = '.'.join((category, 'label', key))

    if suffix == 'prefix':
      term = '{} = starts_with("{}")'
    elif suffix == 'suffix':
      term = '{} = ends_with("{}")'
    else:
      term = '{} = "{}"'

    terms.append(term.format(key, value))

  return ' AND '.join(sorted(terms))


def sorted_resource_labels(labels):
  """Sorts label names such that that well-known resource labels come first."""
  head = [label for label in TOP_RESOURCE_LABELS if label in labels]
  tail = sorted(label for label in labels if label not in TOP_RESOURCE_LABELS)
  return head + tail
