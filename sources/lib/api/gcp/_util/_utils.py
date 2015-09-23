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

"""Miscellaneous simple utility functions."""

import traceback
import types


def print_exception_with_last_stack(e):
  """ If called after an exception, this will print the call stack and exception. """
  traceback.print_exc()
  print str(e)


def get_item(env, name, default=None):
  """ Get an item from a dictionary, handling nested lookups with dotted notation. """
  # TODO: handle attributes
  for key in name.split('.'):
    if isinstance(env, dict) and key in env:
      env = env[key]
    elif isinstance(env, types.ModuleType) and key in env.__dict__:
      env = env.__dict__[key]
    else:
      return default
  return env
