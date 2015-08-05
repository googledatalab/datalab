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

"""Implementation of command parsing and handling within magics."""

import argparse as _argparse
import shlex as _shlex


class CommandParser(_argparse.ArgumentParser):
  """An argument parser to parse commands in line/cell magic declarations.
  """

  def __init__(self, *args, **kwargs):
    """Initializes an instance of a CommandParser.
    """
    super(CommandParser, self).__init__(*args, **kwargs)
    self._subcommands = None

  @staticmethod
  def create(name):
    """Creates a CommandParser for a specific magic.
    """
    return CommandParser(prog=name)

  def exit(self, status=0, message=None):
    """Overriden exit method to stop parsing without calling sys.exit().
    """
    raise Exception()

  def format_usage(self):
    """Overriden usage generator to use the full help message.
    """
    return self.format_help()

  @staticmethod
  def create_args(line, namespace):
    """ Expand any metavariable references in the argument list. """
    args = []
    # Using shlex.split handles quotes args and escape characters.
    for arg in _shlex.split(line):
      if not arg:
         continue
      if arg[0] == '$':
        var_name = arg[1:]
        if var_name in namespace:
          args.append((namespace[var_name]))
        else:
          raise Exception('Undefined variable referenced in command line: %s' % arg)
      else:
        args.append(arg)
    return args

  def parse(self, line, namespace={}):
    """Parses a line into a dictionary of arguments, expanding metavariables from a namespace. """
    try:
      args = CommandParser.create_args(line, namespace)
      return self.parse_args(args)
    except Exception as e:
      if e.message:
        print e.message
      return None

  def subcommand(self, name, help):
    """Creates a parser for a sub-command.
    """
    if self._subcommands is None:
      self._subcommands = self.add_subparsers(help='commands')
    return self._subcommands.add_parser(name, help=help)

