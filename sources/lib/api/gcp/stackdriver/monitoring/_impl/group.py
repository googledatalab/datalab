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

"""Groups for the Google Monitoring API."""

# Features intentionally omitted from this first version of the client library:
#   - Creating, updating, and deleting groups.
#   - Listing the groups for a resource.

from .api import Api
from .resource import Resource


class Group(object):
  """Groups define dynamic collections of monitored resources.

  Attributes:
    id: The ID of the group. When creating a group, this field is ignored
        and a new ID is created.
    project_id: The project ID or number where the group is defined.
    name: The fully qualified name of the group in the format
        "projects/<project_id>/groups/<id>". This is a read-only property.
        If the group ID is not defined, the value is an empty string.
    display_name: A user-assigned name for this group.
    parent_name: The name (not ID) of the group's parent, if it has one.
    filter: The filter string used to determine which monitored resources
        belong to this group.
    is_cluster: Whether the service should consider this group a cluster and
        perform additional analysis on it.
  """

  def __init__(self, client, group_id=None):
    """Initializes a Group instance.

    Args:
      client: The Client to use.
      group_id: An optional ID for the group. This is ignored when creating a
          new group (not yet implemented).
    """
    self._client = client
    self.id = group_id

    self.display_name = ''
    self.parent_name = ''
    self.filter = ''
    self.is_cluster = False

  def __repr__(self):
    return '<Group: {}>'.format(self.display_name)

  @property
  def name(self):
    if not self.id:
      return ''
    return 'projects/{}/groups/{}'.format(self.project_id, self.id)

  @property
  def project_id(self):
    return self._client.project

  @property
  def _api(self):
    return Api(self._client.credentials)

  @classmethod
  def fetch(cls, client, group_id):
    """Looks up a group by ID.

    Args:
      client: The Client to use.
      group_id: The ID of the group.

    Returns:
      A Group instance with all attributes populated.

    Raises:
      RequestException with status == 404 if the group does not exist.
    """
    group = cls(client, group_id)
    group.reload()
    return group

  @classmethod
  def list(cls, client):
    """Lists all groups defined on the project ID.

    Args:
      client: The Client to use.

    Returns:
      A list of Group instances.
    """
    return cls._list(client)

  @classmethod
  def _list(cls, client, children_of_group=None, ancestors_of_group=None,
            descendants_of_group=None):
    """Lists all groups defined on the project ID.

    Args:
      client: The Client to use.
      children_of_group: The ID of the group whose children are to be listed.
      ancestors_of_group: The ID of the group whose ancestors are to be listed.
      descendants_of_group: The ID of the group whose descendants are to be
          listed.

    Returns:
      A list of Group instances.
    """
    api = Api(client.credentials)
    project_id = client.project

    def groups():
      page_token = None
      while True:
        list_info = api.groups_list(project_id, children_of_group,
                                    ancestors_of_group, descendants_of_group,
                                    page_token=page_token)
        for info in list_info.get('group', []):
          yield cls._from_dict(client, info)

        page_token = list_info.get('nextPageToken')
        if not page_token:
          break

    return list(groups())

  @classmethod
  def _from_dict(cls, client, info):
    """Constructs a Group instance from the parsed JSON representation.

    The project IDs specified in client and info must match.

    Args:
      client: The Client to use.
      info: A dict parsed from the JSON wire-format representation.

    Returns:
      A Group instance with all attributes populated.
    """
    group = cls(client)
    group._init_from_dict(info)
    return group

  def reload(self):
    """Fetches all the other attributes based on the project and group ID.

    Raises:
      RequestException with status == 404 if the group does not exist.
    """
    if not self.id:
      raise ValueError('Group ID not specified.')
    info = self._api.groups_get(self.id, self.project_id)
    self._init_from_dict(info)

  def _init_from_dict(self, info):
    """Initializes all attributes from the parsed JSON representation.

    Args:
      info: A dict parsed from the JSON wire-format representation.
    """
    _, project_id, _, self.id = info['name'].split('/')
    assert self.project_id == project_id
    self.display_name = info.get('displayName', '')
    self.parent_name = info.get('parentName', '')
    self.filter = info.get('filter', '')
    self.is_cluster = info.get('isCluster', False)

  def children(self):
    """Lists all children of this group.

    Returns:
      A list of Group instances.
    """
    if not self.id:
      raise ValueError('Group ID not specified.')
    return self._list(self._client, children_of_group=self.id)

  def ancestors(self):
    """Lists all ancestors of this group.

    Returns:
      A list of Group instances.
    """
    if not self.id:
      raise ValueError('Group ID not specified.')
    return self._list(self._client, ancestors_of_group=self.id)

  def descendants(self):
    """Lists all descendants of this group.

    Returns:
      A list of Group instances.
    """
    if not self.id:
      raise ValueError('Group ID not specified.')
    return self._list(self._client, descendants_of_group=self.id)

  def members(self, filter=None, end_time=None, start_time=None):
    """Lists all resources matching this group.

    Args:
      filter: An optional filter string describing the members to be returned.
      end_time: The end time (inclusive) of the time interval for which results
          should be returned, as either a Python datetime object or a timestamp
          string in RFC3339 UTC "Zulu" format. Only members that were part of
          the group during the specified interval are included in the response.
      start_time: The start time (exclusive) of the time interval for which
          results should be returned, as either a datetime object or a
          timestamp string.

    Returns:
      A list of Resource instances.
    """
    # Allow "filter" as a parameter name: pylint: disable=redefined-builtin

    if not self.id:
      raise ValueError('Group ID not specified.')

    def resources():
      page_token = None
      while True:
        list_info = self._api.groups_members_list(
            self.id, project_id=self.project_id, filter=filter,
            end_time=end_time, start_time=start_time, page_token=page_token)
        for info in list_info.get('members', []):
          yield Resource._from_dict(info)

        page_token = list_info.get('nextPageToken')
        if not page_token:
          break

    return list(resources())
