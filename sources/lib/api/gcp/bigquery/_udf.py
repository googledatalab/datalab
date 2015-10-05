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

"""Google Cloud Platform library - BigQuery UDF Functionality."""

import json
import gcp.storage


class UDF(object):
  """Represents a BigQuery UDF declaration.
  """

  @property
  def name(self):
    return self._name

  @property
  def imports(self):
    return self._imports

  @property
  def code(self):
    return self._code

  def __init__(self, inputs, outputs, name, implementation, support_code=None, imports=None):
    """Initializes a Function object from its pieces.

    Args:
      inputs: a list of string field names representing the schema of input.
      outputs: a list of name/type tuples representing the schema of the output.
      name: the name of the javascript function
      implementation: a javascript function implementing the logic.
      support_code: additional javascript code that the function can use.
      imports: a list of GCS URLs or files containing further support code.
    Raises:
      Exception if the name is invalid.
      """
    self._outputs = outputs
    self._name = name
    self._implementation = implementation
    self._support_code = support_code
    self._imports = imports
    self._code = UDF._build_js(inputs, outputs, name, implementation, support_code)

  @staticmethod
  def _build_js(inputs, outputs, name, implementation, support_code):
    """Creates a BigQuery SQL UDF javascript object.

    Args:
      inputs: a list of (name, type) tuples representing the schema of input.
      outputs: a list of (name, type) tuples representing the schema of the output.
      name: the name of the function
      implementation: a javascript function defining the UDF logic.
      support_code: additional javascript code that the function can use.
    """
    # Construct a comma-separated list of input field names
    # For example, field1,field2,...
    input_fields = json.dumps([f[0] for f in inputs])

    # Construct a json representation of the output schema
    # For example, [{'name':'field1','type':'string'},...]
    output_fields = [{'name': f[0], 'type': f[1]} for f in outputs]
    output_fields = json.dumps(output_fields, sort_keys=True)

    # Build the JS from the individual bits with proper escaping of the implementation
    if support_code is None:
      support_code = ''
    return ('{code}\n{name}={implementation};\n' + \
            'bigquery.defineFunction(\'{name}\', {inputs}, {outputs}, {name});')\
                .format(code=support_code,
                        name=name,
                        implementation=implementation,
                        inputs=str(input_fields),
                        outputs=str(output_fields))

