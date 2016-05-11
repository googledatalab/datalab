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

"""Implements representation of BigQuery query job dry run results."""


class QueryStats:
  """A wrapper for statistics returned by a dry run query. Useful so we can get an HTML
  representation in a notebook.
  """

  def __init__(self, total_bytes, is_cached):
    self.total_bytes = float(total_bytes)
    self.is_cached = is_cached

  def _repr_html_(self):
    self.total_bytes = QueryStats._size_formatter(self.total_bytes)
    return """
    <p>Dry run information: %s to process, results %s</p>
    """ % (self.total_bytes, "cached" if self.is_cached else "not cached")

  @staticmethod
  def _size_formatter(byte_num, suf='B'):
    for mag in ['', 'K', 'M', 'G', 'T']:
      if byte_num < 1000.0:
        if suf == 'B':  # Don't do fractional bytes
          return "%5d%s%s" % (int(byte_num), mag, suf)
        return "%3.1f%s%s" % (byte_num, mag, suf)
      byte_num /= 1000.0
    return "%.1f%s%s".format(byte_num, 'P', suf)
