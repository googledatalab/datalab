# Copyright 2015 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Implements BigQuery Views."""

from _table import Table as _Table


class View(_Table):
  def __init__(self, api, name, query):
    """ Construct a View virtual table.

    Args:
      api: the BigQuery API object to use to issue requests.
      name: the name of the view either as a string or a 3-part tuple (projectid, datasetid, name).
      query: the query for the view, either a string or a Query object.
    """
    _Table.__init__(self, api, name)
    self._query = query if isinstance(query, basestring) else query.sql

  @property
  def query(self):
    return self._query

  def create(self, friendly_name=None, description=None):
    """ Create the view.

    Args:
      friendly_name: an optional friendly name.
      description: an optional description.
    Returns:
      The View instance.
    Raises:
      Exception if the view couldn't be created.
    """
    response = self._api.tables_insert(self._name_parts, view=self._query,
                                       friendly_name=friendly_name, description=description)
    if 'selfLink' in response:
      return self
    raise Exception("View %s could not be created")
