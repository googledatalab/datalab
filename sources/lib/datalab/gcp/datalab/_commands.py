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

"""Implementation of command parsing and handling within magics."""

import argparse
import shlex
import IPython


class CommandParser(argparse.ArgumentParser):
  """An argument parser to parse commands in line/cell magic declarations. """

  def __init__(self, *args, **kwargs):
    """Initializes an instance of a CommandParser. """
    super(CommandParser, self).__init__(*args, **kwargs)
    self._subcommands = None

  @staticmethod
  def create(name):
    """Creates a CommandParser for a specific magic.

    Args:
      name: the magic command name.
    """
    return CommandParser(prog=name)

  def exit(self, status=0, message=None):
    """Overridden exit method to stop parsing without calling sys.exit().

    Args:
      status: the exit status.
      message: the exit reason.
    """
    raise Exception(message)

  def format_usage(self):
    """Overridden usage generator to use the full help message. """
    return self.format_help()

  @staticmethod
  def create_args(line, namespace):
    """ Tokenize a magic command line, expanding any meta-variable references.

    Args:
       line: the magic command line as a string.
       namespace: a dictionary to use for meta-variable replacement.

    Returns:
      The line as an expanded list of arguments.
    """
    args = []
    # Using shlex.split handles quotes args and escape characters.
    for arg in shlex.split(line):
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

  def parse(self, line, namespace=None):
    """Parses a line into a dictionary of arguments, expanding meta-variables from a namespace.

    Args:
       line: the magic command line as a string.
       namespace: a dictionary to use for meta-variable replacement.

    Returns:
      The parsed line as a dictionary of argument names and values.
    """
    try:
      if namespace is None:
        ipy = IPython.get_ipython()
        namespace = ipy.user_ns
      args = CommandParser.create_args(line, namespace)
      return self.parse_args(args)
    except Exception as e:
      if e.message:
        print e.message
      return None

  def subcommand(self, name, help):
    """ Creates a parser for a sub-command.

    Args:
      name: the name of the sub-command.
      help: the help string for the sub-command.

    Returns:
      An argument parser for the sub-command.
    """
    if self._subcommands is None:
      self._subcommands = self.add_subparsers(help='commands')
    return self._subcommands.add_parser(name, help=help)
