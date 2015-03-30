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
    _Table.__init__(self, api, name)
    self._query = query

  @property
  def query(self):
    return self._query

  def create(self):
    """ Create the view.

    Returns:
      The View instance.
    Raises:
      Exception if the view couldn't be created.
    """
    response = self._api.tables_insert(self._name_parts, view=self._query)
    if 'selfLink' in response:
      return self
    raise Exception("View %s could not be created")
