# Copyright 2014 Google Inc. All rights reserved.
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

"""Implements Bucket-related Cloud Storage APIs."""

import dateutil.parser as _dateparser
from gcp._util import Iterator as _Iterator
from ._item import Item as _Item
from ._item import ItemList as _ItemList


class BucketMetadata(object):
  """Represents metadata about a Cloud Storage bucket."""

  def __init__(self, info):
    """Initializes an instance of a BucketMetadata object.

    Args:
      info: a dictionary containing information about an Item.
    """
    self._info = info

  @property
  def created_on(self):
    """Gets the created timestamp of the bucket."""
    s = self._info['timeCreated']
    return _dateparser.parse(s)

  @property
  def etag(self):
    """Gets the ETag of the bucket."""
    return self._info.get('etag', None)

  @property
  def name(self):
    """Gets the name of the bucket."""
    return self._info['name']


class Bucket(object):
  """Represents a Cloud Storage bucket."""

  def __init__(self, api, name, info=None):
    """Initializes an instance of a Bucket object.

    Args:
      api: the Storage API object to use to issue requests.
      name: the name of the bucket.
      info: the information about the bucket if available.
    """
    self._api = api
    self._name = name
    self._info = info

  @property
  def name(self):
    """Returns the name of the bucket."""
    return self._name

  def metadata(self):
    """Retrieves metadata about the bucket.

    Returns:
      A BucketMetadata instance with information about this bucket.
    Raises:
      Exception if there was an error requesting the bucket's metadata.
    """
    if self._info is None:
      self._info = self._api.buckets_get(self._name)
    return BucketMetadata(self._info)

  def item(self, key):
    """Retrieves an object within this bucket.

    Args:
      key: the key of the item within the bucket.
    Returns:
      An Item instance representing the specified key.
    """
    return _Item(self._api, self._name, key)

  def items(self, prefix=None, delimiter=None):
    """Retrieve the list of items within this bucket.

    Args:
      prefix: an optional prefix to match items.
      delimiter: an optional string to simulate directory-like semantics.
    Returns:
      An iterable list of items within this bucket.
    """
    return _ItemList(self._api, self._name, prefix, delimiter)


class BucketList(object):
  """Represents a list of Cloud Storage buckets."""

  def __init__(self, api):
    """Initializes an instance of a BucketList.

    Args:
      api: the Storage API object to use to issue requests.
    """
    self._api = api

  def contains(self, name):
    """Checks if the specified bucket exists.

    Args:
      name: the name of the bucket to lookup.
    Returns:
      True if the bucket exists; False otherwise.
    Raises:
      Exception if there was an error requesting information about the bucket.
    """
    try:
      _ = self._api.buckets_get(name)
    except Exception as e:
      if (len(e.args[0]) > 1) and (e.args[0][1] == 404):
        return False
      raise e
    return True

  def create(self, name):
    """Creates a new bucket.

    Args:
      name: a unique name for the new bucket.
    Returns:
      The newly created bucket.
    Raises:
      Exception if there was an error creating the bucket.
    """
    bucket_info = self._api.buckets_insert(name)
    return Bucket(self._api, name, bucket_info)

  def _retrieve_buckets(self, page_token):
    list_info = self._api.buckets_list(page_token=page_token)

    buckets = list_info.get('items', [])
    if len(buckets):
      try:
        buckets = map(lambda info: Bucket(self._api, info['name'], info), buckets)
      except KeyError:
        raise Exception('Unexpected item list response.')

    page_token = list_info.get('nextPageToken', None)
    return (buckets, page_token)

  def __iter__(self):
    return iter(_Iterator(self._retrieve_buckets))
