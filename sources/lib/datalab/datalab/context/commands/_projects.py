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

"""Implements listing projects and setting default project."""

try:
  import IPython
  import IPython.core.magic
  import IPython.core.display
except ImportError:
  raise Exception('This module can only be loaded in ipython.')

import fnmatch

import datalab.utils.commands
import datalab.context


@IPython.core.magic.register_line_cell_magic
def projects(line, cell=None):
  parser = datalab.utils.commands.CommandParser.create('projects')

  list_parser = parser.subcommand('list', 'List available projects.')
  list_parser.add_argument('-f', '--filter',
                           help='Optional wildcard id filter string used to limit the results')
  list_parser.set_defaults(func=_list_line, cell_prohibited=True)

  set_parser = parser.subcommand('set', 'Set the default project.')
  set_parser.add_argument('id', help='The ID of the project to use')
  set_parser.set_defaults(func=_set_line, cell_prohibited=True)

  return datalab.utils.commands.handle_magic_line(line, cell, parser)


def _list_line(args, _):
  # TODO(gram): should we use a paginated table?
  filter_ = args['filter'] if args['filter'] else '*'
  data = [{'id': project.id, 'name': project.name} for project in datalab.context.Projects()
                       if fnmatch.fnmatch(project.id, filter_)]
  return IPython.core.display.HTML(datalab.utils.commands.HtmlBuilder.render_table(data, ['id', 'name']))


def _set_line(args, _):
  context = datalab.context.Context.default()
  context.set_project_id(['id'])
