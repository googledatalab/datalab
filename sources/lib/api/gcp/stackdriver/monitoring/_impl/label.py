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

"""LabelDescriptor and related classes."""

import collections


class LabelDescriptor(collections.namedtuple('LabelDescriptor',
                                             'key value_type description')):
  """Schema specification and documentation for a single label.

  Attributes:
    key: The name of the label.
    value_type: The type of the label. It must be one of:
        ['STRING', 'BOOL', 'INT64'].
    description: A human-readable description for the label.
  """
  __slots__ = ()

  @classmethod
  def _from_dict(cls, info):
    """Constructs a LabelDescriptor from the parsed JSON representation.

    Args:
      info: A dict parsed from the JSON wire-format representation.

    Returns:
      A LabelDescriptor instance.
    """
    return cls(
        info.get('key', ''),
        info.get('valueType', 'STRING'),
        info.get('description', ''),
    )
