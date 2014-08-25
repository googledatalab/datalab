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

"""Google Cloud Platform library - Cloud Storage Functionality."""

import gcp as _gcp
import gcp._util as _util
from ._api import Api as _Api
from ._bucket import Bucket as _Bucket
from ._bucket import BucketList as _BucketList


def _create_api(context):
  """Helper method to create an initialized Api object.

  Args:
    context: a Context object providing project_id and credentials.
  Returns:
    An Api object to make Storage HTTP API requests.
  """
  if context is None:
    context = _gcp.Context.default()
  return _Api(context.credentials, context.project_id)


def bucket(name, context=None):
  """Creates a Storage bucket object.

  Args:
    name: the name of the bucket.
    context: an optional Context object providing project_id and credentials.
  Returns:
    A bucket object that can be used to work with the associated Storage bucket.
  """
  api = _create_api(context)
  return _Bucket(api, name)


def buckets(context=None):
  """Retrieves a list of Storage buckets.

  Args:
    context: an optional Context object providing project_id and credentials.
  Returns:
    An iteratable list of buckets.
  """
  api = _create_api(context)
  return _BucketList(api)
