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

import pytz
import traceback
import types


def print_exception_with_last_stack(e):
  """ Print the call stack of the last exception plu sprint the passed exception.

  Args:
    e: the exception to print.
  """
  traceback.print_exc()
  print str(e)


def get_item(env, name, default=None):
  """ Get an item from a dictionary, handling nested lookups with dotted notation.

  Args:
    env: the environment (dictionary) to use to look up the name.
    name: the name to look up, in dotted notation.
    default: the value to return if the name if not found.

  Returns:
    The result of looking up the name, if found; else the default.
  """
  # TODO: handle attributes
  for key in name.split('.'):
    if isinstance(env, dict) and key in env:
      env = env[key]
    elif isinstance(env, types.ModuleType) and key in env.__dict__:
      env = env.__dict__[key]
    else:
      return default
  return env


def compare_datetimes(d1, d2):
  """ Compares two datetimes safely, whether they are timezone-naive or timezone-aware.

  If either datetime is naive it is converted to an aware datetime assuming UTC.

  Args:
    d1: first datetime.
    d2: second datetime.

  Returns:
    -1 if d1 < d2, 0 if they are the same, or +1 is d1 > d2.
  """
  if d1.tzinfo is None or d1.tzinfo.utcoffset(d1) is None:
    d1 = d1.replace(tzinfo=pytz.UTC)
  if d2.tzinfo is None or d2.tzinfo.utcoffset(d2) is None:
    d2 = d2.replace(tzinfo=pytz.UTC)
  if d1 < d2:
    return -1
  elif d1 > d2:
    return 1
  return 0
