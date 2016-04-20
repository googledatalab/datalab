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

"""Iterator class for iterable cloud lists."""


class Iterator(object):
  """An iterator implementation that handles paging over a cloud list."""

  def __init__(self, retriever):
    """Initializes an instance of an Iterator.

    Args:
      retriever: a function that can retrieve the next page of items.
    """
    self._page_token = None
    self._first_page = True
    self._retriever = retriever
    self._count = 0

  def __iter__(self):
    """Provides iterator functionality."""
    while self._first_page or (self._page_token is not None):
      items, next_page_token = self._retriever(self._page_token, self._count)

      self._page_token = next_page_token
      self._first_page = False
      self._count += len(items)

      for item in items:
        yield item

  def reset(self):
    """Resets the current iteration."""
    self._page_token = None
    self._first_page = True
    self._count = 0
