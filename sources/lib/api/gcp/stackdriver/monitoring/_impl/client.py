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

"""Client for interacting with the Google Monitoring API."""

from oauth2client.client import GoogleCredentials

from gcp._util import RequestException

from .group import Group
from .metric import MetricDescriptor
from .resource import ResourceDescriptor
from .timeseries import Query

SCOPES = ['https://www.googleapis.com/auth/cloud-platform']


# TODO(rimey): Add docstrings.
class Client(object):

  def __init__(self, project, credentials=None):
    if credentials is None:
      credentials = GoogleCredentials.get_application_default()
      if credentials.create_scoped_required():
        credentials = credentials.create_scoped(SCOPES)

    self.project = project
    self.credentials = credentials

  def query(self,
            metric_type=Query.DEFAULT_METRIC_TYPE,
            resource_type=None,
            **kwargs):
    return Query(self, metric_type, resource_type, **kwargs)

  def fetch_metric_descriptor(self, metric_type):
    return MetricDescriptor.fetch(self, metric_type)

  def lookup_metric_descriptor(self, metric_type):
    try:
      return MetricDescriptor.fetch(self, metric_type)
    except RequestException as e:
      if e.status == 404:
        return None
      raise

  def list_metric_descriptors(self, filter=None):
    # Allow "filter" as a parameter name: pylint: disable=redefined-builtin
    return MetricDescriptor.list(self, filter)

  def fetch_resource_descriptor(self, resource_type):
    return ResourceDescriptor.fetch(self, resource_type)

  def list_resource_descriptors(self, filter=None):
    # Allow "filter" as a parameter name: pylint: disable=redefined-builtin
    return ResourceDescriptor.list(self, filter)

  def group(self, group_id):
    return Group(self, group_id)

  def fetch_group(self, group_id):
    return Group.fetch(self, group_id)

  def list_groups(self):
    return Group.list(self)
