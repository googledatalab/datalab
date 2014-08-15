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

"""Google Cloud Platform library - BigQuery UDF Functionality."""

import json as _json
from ._query import Query as _Query


class FunctionCall(object):
  """Represents a BigQuery UDF invocation.
  """

  def __init__(self, api, data, inputs, outputs, implementation):
    """Initializes a UDF object from its pieces.

    Args:
      api: the BigQuery API object to use to issue requests.
      data: the query or table over which the UDF operates.
      inputs: a list of string field names representing the schema of input.
      outputs: a list of name/type tuples representing the schema of the output.
      implementation: a javascript function implementing the logic.
    """
    self._api = api
    self._sql = FunctionCall._build_sql(data, inputs, outputs, implementation)

  @property
  def sql(self):
    """Gets the underlying SQL representation of this UDF object."""
    return self._sql

  def results(self, page_size=0, timeout=0, use_cache=True):
    """Retrieves results from executing the UDF.

    Args:
      page_size: limit to the number of rows to fetch per page.
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not.
    Returns:
      A QueryResults objects representing the result set.
    Raises:
      Exception if the query could not be executed or query response was malformed.
    """
    query_sql = 'SELECT * FROM %s' % self._sql
    q = _Query(self._api, query_sql)

    return q.results(page_size=page_size, timeout=timeout, use_cache=use_cache)

  def _repr_sql_(self):
    """Returns a SQL representation of the UDF object.

    Returns:
      A SQL string that can be embedded in another SQL statement.
    """
    return self._sql

  @staticmethod
  def _build_sql(data, inputs, outputs, implementation):
    """Creates a BigQuery SQL UDF query object.

    Args:
      data: the query or table over which the UDF operates.
      inputs: a list of (name, type) tuples representing the schema of input.
      outputs: a list of (name, type) tuples representing the schema of the output.
      implementation: a javascript function defining the UDF logic.
    """
    # Construct a comma-separated list of input field names
    # For example, field1,field2,...
    input_fields = map(lambda f: f[0], inputs)
    input_fields = ','.join(input_fields)

    # Construct a json representation of the output schema
    # For example, [{'name':'field1','type':'string'},...]
    output_fields = map(lambda f: {'name': f[0], 'type': f[1]}, outputs)
    output_fields = _json.dumps(output_fields, sort_keys=True)

    # Build the SQL from the individual bits with proper escaping of the implementation
    return 'js(%s,\n%s,\n\'%s\',\n"%s")' % (data._repr_sql_(),
                                            input_fields, output_fields,
                                            implementation.replace('"', '\\"'))


class FunctionEvaluation(object):

  def __init__(self, implementation, data):
    self._implementation = implementation
    self._data = data

  @property
  def data(self):
    return self._data

  @property
  def implementation(self):
    return self._implementation


class Function(object):
  """Represents a BigQuery UDF declaration.
  """

  def __init__(self, api, inputs, outputs, implementation):
    """Initializes a Function object from its pieces.

    Args:
      api: the BigQuery API object to use to issue requests.
      inputs: a list of string field names representing the schema of input.
      outputs: a list of name/type tuples representing the schema of the output.
      implementation: a javascript function implementing the logic.
    """
    self._api = api
    self._inputs = inputs
    self._outputs = outputs
    self._implementation = implementation

  def __call__(self, data):
    if issubclass(type(data), list):
      return FunctionEvaluation(self._implementation, data)
    else:
      return FunctionCall(self._api, data, self._inputs, self._outputs, self._implementation)
