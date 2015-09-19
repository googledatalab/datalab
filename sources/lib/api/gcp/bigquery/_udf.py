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

import json


class FunctionCall(object):
  """Represents a BigQuery UDF invocation.
  """

  def __init__(self, data, inputs, outputs, name, implementation):
    """Initializes a UDF object from its pieces.

    Args:
      data: the query or table over which the UDF operates.
      inputs: a list of string field names representing the schema of input.
      outputs: a list of name/type tuples representing the schema of the output.
      name: the name of the UDF function
      implementation: a javascript function implementing the logic.
    """
    self._sql = FunctionCall._build_sql(name, inputs, data)
    self._code = FunctionCall._build_js(inputs, outputs, name, implementation)

  @property
  def sql(self):
    """Gets the underlying SQL representation of this UDF object."""
    return self._sql

  @property
  def js(self):
    """Gets the underlying JS representation of this UDF object."""
    return self._code

  def _repr_sql_(self):
    """Returns a SQL representation of the UDF object.

    Returns:
      A SQL string that can be embedded in another SQL statement.
    """
    return self._sql

  def _repr_code_(self):
    """Returns a JS representation of the UDF object.

    Returns:
      A JS string that can be submitted with a BQ Query.
    """
    return self._code

  @staticmethod
  def _build_sql(name, inputs, data):
    """Creates a BigQuery SQL UDF query invocation object.

    Args:
      name: the name of the UDF function
      inputs: a list of (name, type) tuples representing the schema of input.
      data: the query or table over which the UDF operates.
    """
    return '(SELECT %s FROM %s(%s))' % (', '.join([f[0] for f in inputs]), name, data._repr_sql_())

  @staticmethod
  def _build_js(inputs, outputs, name, implementation):
    """Creates a BigQuery SQL UDF javascript object.

    Args:
      inputs: a list of (name, type) tuples representing the schema of input.
      outputs: a list of (name, type) tuples representing the schema of the output.
      name: the name of the function
      implementation: a javascript function defining the UDF logic.
    """
    # Construct a comma-separated list of input field names
    # For example, field1,field2,...
    input_fields = json.dumps([f[0] for f in inputs])

    # Construct a json representation of the output schema
    # For example, [{'name':'field1','type':'string'},...]
    output_fields = [{'name': f[0], 'type': f[1]} for f in outputs]
    output_fields = json.dumps(output_fields, sort_keys=True)

    # Build the JS from the individual bits with proper escaping of the implementation
    return '%s=%s;\nbigquery.defineFunction(\'%s\', %s, %s, %s);' %\
           (name, implementation.replace('"', '\\"'), name, input_fields, output_fields, name)


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


class UDF(object):
  """Represents a BigQuery UDF declaration.
  """

  def __init__(self, inputs, outputs, name, implementation):
    """Initializes a Function object from its pieces.

    Args:
      inputs: a list of string field names representing the schema of input.
      outputs: a list of name/type tuples representing the schema of the output.
      name: the name of the javascript function
      implementation: a javascript function implementing the logic.
    Raises:
      Exception if the name is invalid.
      """
    self._inputs = inputs
    self._outputs = outputs
    self._name = name
    self._implementation = implementation

  def __call__(self, data):
    if issubclass(type(data), list):
      return FunctionEvaluation(self._implementation, data)
    else:
      return FunctionCall(data, self._inputs, self._outputs, self._name, self._implementation)

  def __repr_js__(self):
    return self._implementation
