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

"""Implements Bucket-related Cloud Storage APIs."""

import dateutil.parser
import re

import gcp
import gcp._util
import _api
import _item


# REs to match bucket names and optionally object names
_BUCKET_NAME = '[a-z\d][a-z\d_\.\-]+[a-z\d]'
_OBJECT_NAME = '[^\n\r]+'
_STORAGE_NAME = 'gs://(' + _BUCKET_NAME + ')(/' + _OBJECT_NAME + ')?'


def parse_name(name):
  """ Parse a gs:// URL into the bucket and item names.

  Args:
    name: a GCS URL of the form gs://bucket or gs://bucket/item
  Returns:
    The bucket name (with no gs:// prefix), and the item name if present. If the name
    could not be parsed returns None for both.
  """
  bucket = None
  item = None
  m = re.match(_STORAGE_NAME, name)
  if m:
    # We want to return the last two groups as first group is the optional 'gs://'
    bucket = m.group(1)
    item = m.group(2)
    if item is not None:
      item = item[1:]  # Strip '/'
  else:
    m = re.match('(' + _OBJECT_NAME + ')', name)
    if m:
      item = m.group(1)
  return bucket, item


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
    """The created timestamp of the bucket as a datetime.datetime."""
    s = self._info.get('timeCreated', None)
    return dateutil.parser.parse(s) if s else None

  @property
  def etag(self):
    """The ETag of the bucket, if any."""
    return self._info.get('etag', None)

  @property
  def name(self):
    """The name of the bucket."""
    return self._info['name']


class Bucket(object):
  """Represents a Cloud Storage bucket."""

  def __init__(self, name, info=None, context=None):
    """Initializes an instance of a Bucket object.

    Args:
      name: the name of the bucket.
      info: the information about the bucket if available.
      context: an optional Context object providing project_id and credentials. If a specific
          project id or credentials are unspecified, the default ones configured at the global
          level are used.
    """
    if context is None:
      context = gcp.Context.default()
    self._context = context
    self._api = _api.Api(context)
    self._name = name
    self._info = info

  @property
  def name(self):
    """The name of the bucket."""
    return self._name

  def __repr__(self):
    """Returns a representation for the table for showing in the notebook.
    """
    return 'Bucket gs://%s' % self._name

  def metadata(self):
    """Retrieves metadata about the bucket.

    Returns:
      A BucketMetadata instance with information about this bucket.
    Raises:
      Exception if there was an error requesting the bucket's metadata.
    """
    if self._info is None:
      try:
        self._info = self._api.buckets_get(self._name)
      except Exception as e:
        raise e

    return BucketMetadata(self._info) if self._info else None

  def item(self, key):
    """Retrieves an Item object for the specified key in this bucket.

    The item need not exist.

    Args:
      key: the key of the item within the bucket.
    Returns:
      An Item instance representing the specified key.
    """
    return _item.Item(self._name, key, context=self._context)

  def items(self, prefix=None, delimiter=None):
    """Get an iterator for the items within this bucket.

    Args:
      prefix: an optional prefix to match items.
      delimiter: an optional string to simulate directory-like semantics. The returned items
           will be those whose names do not contain the delimiter after the prefix. For
           the remaining items, the names will be returned truncated after the delimiter
           with duplicates removed (i.e. as pseudo-directories).
    Returns:
      An iterable list of items within this bucket.
    """
    return _item.Items(self._name, prefix, delimiter, context=self._context)

  def exists(self):
    """ Checks if the bucket exists. """
    try:
      return self.metadata() is not None
    except Exception:
      return False

  def create(self, project_id=None):
    """Creates the bucket.

    Args:
      The project in which to create the bucket.
    Returns:
      The bucket.
    Raises:
      Exception if there was an error creating the bucket.
    """
    if not self.exists():
      if project_id is None:
        project_id = self._api.project_id
      try:
        self._info = self._api.buckets_insert(self._name, project_id=project_id)
      except Exception as e:
        raise e
    return self

  def delete(self):
    """Deletes the bucket.

    Raises:
      Exception if there was an error deleting the bucket.
    """
    if self.exists():
      try:
        self._api.buckets_delete(self._name)
      except Exception as e:
        raise e


class Buckets(object):
  """Represents a list of Cloud Storage buckets for a project."""

  def __init__(self, project_id=None, context=None):
    """Initializes an instance of a BucketList.

    Args:
      project_id: an optional project whose buckets we want to manipulate. If None this
          is obtained from the api object.
      context: an optional Context object providing project_id and credentials. If a specific
          project id or credentials are unspecified, the default ones configured at the global
          level are used.
    """
    if context is None:
      context = gcp.Context.default()
    self._context = context
    self._api = _api.Api(context)
    self._project_id = project_id if project_id else self._api.project_id

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
    except gcp._util.RequestException as e:
      if e.status == 404:
        return False
      raise e
    except Exception as e:
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
    return Bucket(name, context=self._context).create(self._project_id)

  def _retrieve_buckets(self, page_token, _):
    try:
      list_info = self._api.buckets_list(page_token=page_token, project_id=self._project_id)
    except Exception as e:
      raise e

    buckets = list_info.get('items', [])
    if len(buckets):
      try:
        buckets = [Bucket(info['name'], info, context=self._context) for info in buckets]
      except KeyError:
        raise Exception('Unexpected response from server')

    page_token = list_info.get('nextPageToken', None)
    return buckets, page_token

  def __iter__(self):
    return iter(gcp._util.Iterator(self._retrieve_buckets))
