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

"""Resource Descriptors for the Google Monitoring API."""

import collections

from .api import Api
from .label import LabelDescriptor


class ResourceDescriptor(
    collections.namedtuple('ResourceDescriptor',
                           'name type display_name description labels')):
  """Defines a monitored resource type and its schema.

  ResourceDescriptor instances are immutable.

  Attributes:
    name: The "resource name" of the monitored resource descriptor:
        "projects/<project_id>/monitoredResourceDescriptors/<type>"
    type: The monitored resource type.
    display_name: A concise name that might be displayed in user interfaces.
    description: A detailed description that might be used in documentation.
    labels: A sequence of label descriptors specifying the labels used to
        identify a specific instance of this monitored resource.
  """
  __slots__ = ()

  @classmethod
  def fetch(cls, client, resource_type):
    """Looks up a resource descriptor by type.

    Args:
      client: The Client to use.
      resource_type: The resource type.

    Returns:
      A ResourceDescriptor instance.

    Raises:
      RequestException with status == 404 if the resource descriptor
      is not found.
    """
    api = Api(client.credentials)
    info = api.monitored_resource_descriptors_get(resource_type,
                                                  client.project)
    return cls._from_dict(info)

  @classmethod
  def list(cls, client, filter=None):
    """Lists all resource descriptors.

    Args:
      client: The Client to use.
      filter: An optional filter string describing the resource descriptors to
          be returned.

    Returns:
      A list of ResourceDescriptor instances.
    """
    # Allow "filter" as a parameter name: pylint: disable=redefined-builtin

    api = Api(client.credentials)
    project_id = client.project

    def descriptors():
      page_token = None
      while True:
        list_info = api.monitored_resource_descriptors_list(
            project_id, filter=filter, page_token=page_token)
        for info in list_info.get('resourceDescriptors', []):
          yield cls._from_dict(info)

        page_token = list_info.get('nextPageToken')
        if not page_token:
          break

    return list(descriptors())

  @classmethod
  def _from_dict(cls, info):
    """Constructs a ResourceDescriptor from the parsed JSON representation.

    Args:
      info: A dict parsed from the JSON wire-format representation.

    Returns:
      A ResourceDescriptor instance.
    """
    return cls(
        name=info.get('name', ''),
        type=info.get('type', ''),
        display_name=info.get('displayName', ''),
        description=info.get('description', ''),
        labels=tuple(LabelDescriptor._from_dict(label)
                     for label in info.get('labels', [])),
    )


class Resource(collections.namedtuple('Resource', 'type labels')):
  """A monitored resource identified by specifying values for all labels.

  Attributes:
    type: The resource type.
    labels: A dictionary of label values for all labels enumerated in the
        associated resource descriptor.
  """
  __slots__ = ()

  @classmethod
  def _from_dict(cls, info):
    """Constructs a Resource from the parsed JSON representation.

    Args:
      info: A dict parsed from the JSON wire-format representation.

    Returns:
      A Resource instance.
    """
    return cls(
        type=info.get('type', ''),
        labels=info.get('labels', {}),
    )
