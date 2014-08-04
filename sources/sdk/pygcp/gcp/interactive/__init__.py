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

"""Google Cloud Platform library - IPython Functionality."""

import gcp.bigquery as _bq

try:
  import IPython as _ipy
  import IPython.core.magic as _magic
except ImportError:
  raise Exception('This module can only be loaded in ipython.')


@_magic.register_cell_magic
def bigquery(var, sql):
  """Implements the bigquery cell magic for ipython notebooks.

  The supported syntax is:
  %%bigquery [var]
  <sql>

  Args:
    var: the optional variable name to be initialized with the resulting query.
    sql: the contents of the cell interpreted as the SQL.
  Returns:
    The results of executing the query converted to a dataframe if no variable
    was specified. None otherwise.
  """

  ipy = _ipy.get_ipython()

  # Use the user_ns dictionary, which contains all current declarations in
  # in the kernel as the dictionary to use to retrieve values for placeholders
  # within the specified sql statement.
  sql = _bq.sql(sql, **ipy.user_ns)
  query = _bq.query(sql)

  if len(var) != 0:
    # Update the global namespace with the new variable, or update the value of
    # the existing variable if it already exists.
    ipy.push({var: query})
    return None
  else:
    # If a variable was not specified, then simply return the results, so they
    # get rendered as the output of the cell.

    # TODO(nikhilko): Right now this is accomplished by using the rendering
    #                 produced via a pandas dataframe. Eventually we'll likely
    #                 have better, more interactive ways to show tabular data.
    return query.results().to_dataframe()
