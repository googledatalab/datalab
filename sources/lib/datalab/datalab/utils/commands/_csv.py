# Copyright 2016 Google Inc. All rights reserved.
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

"""Implements CSV file exploration"""


try:
  import IPython
  import IPython.core.magic
  import IPython.core.display
except ImportError:
  raise Exception('This module can only be loaded in ipython.')

import pandas as pd

import datalab.data

import _commands
import _utils


@IPython.core.magic.register_line_cell_magic
def csv(line, cell=None):
  parser = _commands.CommandParser.create('csv')

  view_parser = parser.subcommand('view',
                                  'Browse CSV files without providing a schema. ' +
                                  'Each value is considered string type.')
  view_parser.add_argument('-i', '--input',
                           help='Path of the input CSV data', required=True)
  view_parser.add_argument('-n', '--count',
                           help='The number of lines to browse from head, default to 5.')
  view_parser.add_argument('-P', '--profile', action='store_true',
                           default=False, help='Generate an interactive profile of the data')
  view_parser.set_defaults(func=_view)

  return _utils.handle_magic_line(line, cell, parser)


def _view(args, cell):
  csv = datalab.data.Csv(args['input'])
  num_lines = int(args['count'] or 5)
  headers = None
  if cell:
    ipy = IPython.get_ipython()
    config = _utils.parse_config(cell, ipy.user_ns)
    if 'columns' in config:
      headers = [e.strip() for e in config['columns'].split(',')]
  df = pd.DataFrame(csv.browse(num_lines, headers))
  if args['profile']:
    # TODO(gram): We need to generate a schema and type-convert the columns before this
    # will be useful for CSV
    return _utils.profile_df(df)
  else:
    return IPython.core.display.HTML(df.to_html(index=False))
