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

"""Implements BigQuery related data sampling strategies."""


class Sampling(object):
  """Provides common sampling strategies.

  Sampling strategies can be used for sampling tables or queries.
  """

  def __init__(self):
    pass

  @staticmethod
  def default():
    """Provides the default sampling strategy."""
    return Sampling.random()

  @staticmethod
  def hashed(field_name, percent, count=0):
    """Provides a sampling strategy based on hashing and selecting a percentage of data.

    Args:
      field_name: the name of the field to hash.
      percent: the percentage of the resulting hashes to select.
      count: optional maximum count of rows to pick.
    Returns:
      A sampling function that can be applied to get a hash-based sampling.
    """
    def hashed_sampling(api, sql):
      sql = 'SELECT * FROM (%s) WHERE ABS(HASH(%s)) < %d' % (sql, field_name, percent)
      if count != 0:
        sql = sql + (' LIMIT %d' % count)
      return sql
    return hashed_sampling

  @staticmethod
  def random(count=5):
    """Provides a random sampling strategy limited by count.

    Args:
      count: optional number of rows to limit the sampled results to.
    Returns:
      A sampling function that can be applied to get a random sampling.
    """
    return lambda api, sql: 'SELECT * FROM (%s) LIMIT %d' % (sql, count)

  @staticmethod
  def sorted(field_name, ascending=True, count=5):
    """Provides a sampling strategy that picks from an ordered set of rows.

    Args:
      field_name: the name of the field to sort the rows by.
      ascending: whether to sort in ascending direction or not.
      count: optional number of rows to limit the sampled results to.
    Returns:
      A sampling function that can be applied to get the initial few rows.
    """
    direction = '' if ascending else ' DESC'
    return lambda api, sql: 'SELECT * FROM (%s) ORDER BY %s%s LIMIT %d' % (sql, field_name,
                                                                            direction, count)
