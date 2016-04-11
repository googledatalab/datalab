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

"""Metric Descriptors for the Google Monitoring API."""

# Features intentionally omitted from this first version of the client library:
#   - Creating and deleting metric descriptors.

import collections

from .api import Api
from .label import LabelDescriptor


class MetricDescriptor(
    collections.namedtuple('MetricDescriptor',
                           ('name type labels metric_kind value_type unit'
                            ' description display_name'))):
  """Defines a metric type and its schema.

  MetricDescriptor instances are immutable.

  Attributes:
    name: The "resource name" of the metric descriptor. For example:
        "projects/<project_id>/metricDescriptors/<type>"
    type: The metric type including a DNS name prefix. For example:
        "compute.googleapis.com/instance/cpu/utilization"
    labels: A sequence of label descriptors specifying the labels used to
        identify a specific instance of this metric.
    metric_kind: The kind of measurement. It must be one of:
        ['GAUGE', 'DELTA', 'CUMULATIVE'].
    value_type: The value type of the metric. It must be one of:
        ['BOOL', 'INT64', 'DOUBLE', 'STRING', 'DISTRIBUTION', 'MONEY'].
    unit: A string specifying the unit in which the metric value is reported.
    description: A detailed description of the metric.
    display_name: A concise name for the metric.
  """
  __slots__ = ()

  @classmethod
  def fetch(cls, client, metric_type):
    """Looks up a metric descriptor by type.

    Args:
      client: The Client to use.
      metric_type: The metric type.

    Returns:
      A MetricDescriptor instance.

    Raises:
      RequestException with status == 404 if the metric descriptor
      is not found.
    """
    api = Api(client.credentials)
    info = api.metric_descriptors_get(metric_type, client.project)
    return cls._from_dict(info)

  @classmethod
  def list(cls, client, filter=None):
    """Lists all metric descriptors.

    Args:
      client: The Client to use.
      filter: An optional filter string describing the metric descriptors to
          be returned.

    Returns:
      A list of MetricDescriptor instances.
    """
    # Allow "filter" as a parameter name: pylint: disable=redefined-builtin

    api = Api(client.credentials)
    project_id = client.project

    def descriptors():
      page_token = None
      while True:
        list_info = api.metric_descriptors_list(project_id, filter=filter,
                                                page_token=page_token)
        for info in list_info.get('metricDescriptors', []):
          yield cls._from_dict(info)

        page_token = list_info.get('nextPageToken')
        if not page_token:
          break

    return list(descriptors())

  @classmethod
  def _from_dict(cls, info):
    """Constructs a MetricDescriptor from the parsed JSON representation.

    Args:
      info: A dict parsed from the JSON wire-format representation.

    Returns:
      A MetricDescriptor instance.
    """
    return cls(
        type=info.get('type', ''),
        name=info.get('name', ''),
        description=info.get('description', ''),
        display_name=info.get('displayName', ''),
        labels=tuple(LabelDescriptor._from_dict(label)
                     for label in info.get('labels', [])),
        metric_kind=info['metricKind'],
        value_type=info['valueType'],
        unit=info.get('unit', ''),
    )


class Metric(collections.namedtuple('Metric', 'type labels')):
  """A specific metric identified by specifying values for all labels.

  Attributes:
    type: The metric type.
    labels: A dictionary of label values for all labels enumerated in the
        associated metric descriptor.
  """
  __slots__ = ()

  @classmethod
  def _from_dict(cls, info):
    """Constructs a Metric from the parsed JSON representation.

    Args:
      info: A dict parsed from the JSON wire-format representation.

    Returns:
      A Metric instance.
    """
    return cls(
        type=info.get('type', ''),
        labels=info.get('labels', {}),
    )
