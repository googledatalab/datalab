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

"""A simple LRU cache."""

import datetime


class LRUCache(object):
  """A simple LRU cache."""

  def __init__(self, cache_size):
    """ Initialize the cache with the given size.

    Args:
      cache_size: the maximum number of items the cache can hold. Attempts to add more
          items than this will result in the least recently used items being displaced to
          make room.
    """
    self._cache = {}
    self._cache_size = cache_size

  def __getitem__(self, key):
    """ Get an item from the cache.

    Args:
      key: a string used as the lookup key.
    Returns:
      The cached item, if any.
    Raises:
      Exception if the key is not a string.
      KeyError if the key is not found.
    """
    if not isinstance(key, basestring):
      raise Exception("LRU cache can only be indexed by strings")

    if key in self._cache:
      entry = self._cache[key]
      entry['last_used'] = datetime.datetime.now()
      return entry['value']
    else:
      raise KeyError(key)

  def __setitem__(self, key, value):
    """ Put an item in the cache.

    Args:
      key: a string key for retrieving the item.
      value: the item to cache.
    Raises:
      Exception if the key is not a string.
    """
    if not isinstance(key, basestring):
      raise Exception("LRU cache can only be indexed by strings")

    if key in self._cache:
      entry = self._cache[key]
    elif len(self._cache) < self._cache_size:
      # Cache is not full; append an new entry
      self._cache[key] = entry = {}
    else:
      # Cache is full; displace an entry
      entry = min(self._cache.values(), key=lambda x: x['last_used'])
      self._cache.pop(entry['key'])
      self._cache[key] = entry

    entry['value'] = value
    entry['key'] = key
    entry['last_used'] = datetime.datetime.now()
