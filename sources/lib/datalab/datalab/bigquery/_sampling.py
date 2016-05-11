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

"""Sampling for BigQuery."""


class Sampling(object):
  """Provides common sampling strategies.

  Sampling strategies can be used for sampling tables or queries.

  They are implemented as functions that take in a SQL statement representing the table or query
  that should be sampled, and return a new SQL statement that limits the result set in some manner.
  """

  def __init__(self):
    pass

  @staticmethod
  def _create_projection(fields):
    """Creates a projection for use in a SELECT statement.

    Args:
      fields: the list of fields to be specified.
    """
    if (fields is None) or (len(fields) == 0):
      return '*'
    return ','.join(fields)

  @staticmethod
  def default(fields=None, count=5):
    """Provides a simple default sampling strategy which limits the result set by a count.

    Args:
      fields: an optional list of field names to retrieve.
      count: optional number of rows to limit the sampled results to.
    Returns:
      A sampling function that can be applied to get a random sampling.
    """
    projection = Sampling._create_projection(fields)
    return lambda sql: 'SELECT %s FROM (%s) LIMIT %d' % (projection, sql, count)

  @staticmethod
  def sorted(field_name, ascending=True, fields=None, count=5):
    """Provides a sampling strategy that picks from an ordered set of rows.

    Args:
      field_name: the name of the field to sort the rows by.
      ascending: whether to sort in ascending direction or not.
      fields: an optional list of field names to retrieve.
      count: optional number of rows to limit the sampled results to.
    Returns:
      A sampling function that can be applied to get the initial few rows.
    """
    direction = '' if ascending else ' DESC'
    projection = Sampling._create_projection(fields)
    return lambda sql: 'SELECT %s FROM (%s) ORDER BY %s%s LIMIT %d' % (projection, sql, field_name,
                                                                       direction, count)

  @staticmethod
  def sampling_query(sql, fields=None, count=5, sampling=None):
    """Returns a sampling query for the SQL object.

    Args:
      sql: the SQL object to sample
      fields: an optional list of field names to retrieve.
      count: an optional count of rows to retrieve which is used if a specific
          sampling is not specified.
      sampling: an optional sampling strategy to apply to the table.
    Returns:
      A SQL query string for sampling the input sql.
    """
    if sampling is None:
      sampling = Sampling.default(count=count, fields=fields)
    return sampling(sql)

  @staticmethod
  def hashed(field_name, percent, fields=None, count=0):
    """Provides a sampling strategy based on hashing and selecting a percentage of data.

    Args:
      field_name: the name of the field to hash.
      percent: the percentage of the resulting hashes to select.
      fields: an optional list of field names to retrieve.
      count: optional maximum count of rows to pick.
    Returns:
      A sampling function that can be applied to get a hash-based sampling.
    """
    def _hashed_sampling(sql):
      projection = Sampling._create_projection(fields)
      sql = 'SELECT %s FROM (%s) WHERE ABS(HASH(%s)) %% 100 < %d' % \
            (projection, sql, field_name, percent)
      if count != 0:
        sql = '%s LIMIT %d' % (sql, count)
      return sql
    return _hashed_sampling

  @staticmethod
  def random(percent, fields=None, count=0):
    """Provides a sampling strategy that picks a semi-random set of rows.

    Args:
      percent: the percentage of the resulting hashes to select.
      fields: an optional list of field names to retrieve.
      count: maximum number of rows to limit the sampled results to (default 5).
    Returns:
      A sampling function that can be applied to get some random rows. In order for this to
      provide a good random sample percent should be chosen to be ~count/#rows where #rows
      is the number of rows in the object (query, view or table) being sampled.
      The rows will be returned in order; i.e. the order itself is not randomized.
    """
    def _random_sampling(sql):
      projection = Sampling._create_projection(fields)
      sql = 'SELECT %s FROM (%s) WHERE rand() < %f' % (projection, sql, percent / 100.0)
      if count != 0:
        sql = '%s LIMIT %d' % (sql, count)
      return sql
    return _random_sampling
