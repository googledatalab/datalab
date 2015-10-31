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

"""Google Cloud Platform library - Generic SQL Helpers."""

import gcp._util as _util
from _sql_module import SqlModule
from _sql_statement import SqlStatement


def sql(sql_template, **kwargs):
  """Formats SQL templates by replacing placeholders with actual values.

  Placeholders in SQL are represented as $<name>. If '$' must appear within the
  SQL statement literally, then it can be escaped as '$$'.

  Args:
    sql_template: the template of the SQL statement with named placeholders.
    **kwargs: the dictionary of name/value pairs to use for placeholder values.
  Returns:
    The formatted SQL statement with placeholders replaced with their values, and
    an array of Javascript UDFs referenced by the code.
  Raises:
    Exception if a placeholder was found in the SQL statement, but did not have
    a corresponding argument value.
  """
  return SqlStatement.format(sql_template, kwargs)
