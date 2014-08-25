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

"""Implements Object-related Cloud Storage APIs."""

import dateutil.parser as _dateparser
from gcp._util import Iterator as _Iterator

# TODO(nikhilko): Read/write operations don't account for larger files, or non-texual content.
#                 Use streaming reads into a buffer or StringIO or into a file handle.


class ItemMetadata(object):
  """Represents metadata about a Cloud Storage object."""

  def __init__(self, info):
    """Initializes an instance of a ItemMetadata object.

    Args:
      info: a dictionary containing information about an Item.
    """
    self._info = info

  @property
  def content_type(self):
    """Gets the Content-Type associated with the item."""
    return self._info.get('contentType', None)

  @property
  def etag(self):
    """Gets the ETag of the item."""
    return self._info.get('etag', None)

  @property
  def name(self):
    """Gets the name of the item."""
    return self._info['name']

  @property
  def size(self):
    """Gets the size (in bytes) of the item."""
    return int(self._info.get('size', 0))

  @property
  def updated_on(self):
    """Gets the updated timestamp of the item."""
    s = self._info['updated']
    return _dateparser.parse(s)


class Item(object):
  """Represents a Cloud Storage object within a bucket."""

  def __init__(self, api, bucket, key, info=None):
    """Initializes an instance of an Item.

    Args:
      api: the Storage API object to use to issue requests.
      bucket: the name of the bucket containing the item.
      key: the key of the item.
      info: the information about the item if available.
    """
    self._api = api
    self._bucket = bucket
    self._key = key
    self._info = info

  @property
  def key(self):
    """Returns the key of the item."""
    return self._key

  def copy_to(self, new_key):
    """Copies this item to the specified new key.

    Args:
      new_key: the new key to copy this item to.
    Returns:
      An Item corresponding to new key.
    Raises:
      Exception if there was an error copying the item.
    """
    new_info = self._api.objects_copy(self._bucket, self._key, self._bucket, new_key)
    return Item(self._api, self._bucket, new_key, new_info)

  def delete(self):
    """Deletes this item from its bucket.

    Returns
      True if the deletion succeeded; False otherwise.
    Raises:
      Exception if there was an error deleting the item.
    """
    try:
      self._api.objects_delete(self._bucket, self._key)
    except Exception as e:
      if (len(e.args[0]) > 1) and (e.args[0][1] == 204):
        return True
      raise e
    return False

  def metadata(self):
    """Retrieves metadata about the bucket.

    Returns:
      A BucketMetadata instance with information about this bucket.
    Raises:
      Exception if there was an error requesting the bucket's metadata.
    """
    if self._info is None:
     self._info = self._api.objects_get(self._bucket, self._key)
    return ItemMetadata(self._info)

  def read_from(self):
    """Reads the content of this item as text.

    Returns:
      The text content within the item.
    Raises:
      Exception if there was an error requesting the item's content.
    """
    return self._api.object_download(self._bucket, self._key)

  def write_to(self, content, content_type):
    """Writes text content to this item.

    Args:
      content: the text content to be writtent.
      content_type: the type of text content.
    Raises:
      Exception if there was an error requesting the item's content.
    """
    self._api.object_upload(self._bucket, self._key, content, content_type)


class ItemList(object):
  """Represents a list of Cloud Storage objects within a bucket."""

  def __init__(self, api, bucket, prefix, delimiter):
    """Initializes an instance of an ItemList.

    Args:
      api: the Storage API object to use to issue requests.
      bucket: the name of the bucket containing the items.
      prefix: an optional prefix to match items.
      delimiter: an optional string to simulate directory-like semantics.
    """
    self._api = api
    self._bucket = bucket
    self._prefix = prefix
    self._delimiter = delimiter

  def contains(self, key):
    """Checks if the specified item exists.

    Args:
      key: the key of the item to lookup.
    Returns:
      True if the item exists; False otherwise.
    Raises:
      Exception if there was an error requesting information about the item.
    """
    try:
      _ = self._api.objects_get(self._bucket, key)
    except Exception as e:
      if (len(e.args[0]) > 1) and (e.args[0][1] == 404):
        return False
      raise e
    return True

  def _retrieve_items(self, page_token):
    list_info = self._api.objects_list(self._bucket,
                                       prefix=self._prefix, delimiter=self._delimiter,
                                       page_token=page_token)

    items = list_info.get('items', [])
    if len(items):
      try:
        items = map(lambda info: Item(self._api, self._bucket, info['name'], info), items)
      except KeyError:
        raise Exception('Unexpected item list response.')

    page_token = list_info.get('nextPageToken', None)
    return (items, page_token)

  def __iter__(self):
    return iter(_Iterator(self._retrieve_items))
