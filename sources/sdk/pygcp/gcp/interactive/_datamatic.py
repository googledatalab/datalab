# Copyright 2015 Google Inc. All rights reserved.
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

"""Google Cloud Platform library - %%datamatic IPython Cell Magic Functionality."""

import IPython.core.magic as _magic
from ._commands import CommandParser as _CommandParser
from ._utils import _handle_magic_line


def _create_datamatic_parser():
  datamatic_parser = _CommandParser('datamatic commands')
  deploy_parser = datamatic_parser.subcommand('deploy', 'deploy a pipeline')
  deploy_parser.add_argument('-p', '--pipeline', help='the name of the pipeline to deploy')
  deploy_parser.set_defaults(func=lambda args, cell: _deploy_cell(args, cell))
  return datamatic_parser


_datamatic_parser = _create_datamatic_parser()


def _deploy_cell(args, cell):
  pass


@_magic.register_line_cell_magic
def datamatic(line, cell):
  return _handle_magic_line(line, cell, _datamatic_parser)
