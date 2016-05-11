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

"""Decorators for async methods and functions to dispatch on threads and support chained calls."""

import abc
import concurrent.futures
import functools

import _job


class async(object):
  """ Base class for async_function/async_method. Creates a wrapped function/method that will
      run the original function/method on a thread pool worker thread and return a Job instance
      for monitoring the status of the thread.
  """

  __metaclass__ = abc.ABCMeta
  executor = concurrent.futures.ThreadPoolExecutor(max_workers=50)  # Pool for doing the work.

  def __init__(self, function):
    self._function = function
    # Make the wrapper get attributes like docstring from wrapped method.
    functools.update_wrapper(self, function)

  @staticmethod
  def _preprocess_args(*args):
    # Pre-process arguments - if any are themselves Futures block until they can be resolved.
    return [arg.result() if isinstance(arg, concurrent.futures.Future) else arg for arg in args]

  @staticmethod
  def _preprocess_kwargs(**kwargs):
    # Pre-process keyword arguments - if any are Futures block until they can be resolved.
    return {kw: (arg.result() if isinstance(arg, concurrent.futures.Future) else arg)
            for kw, arg in kwargs.items()}

  @abc.abstractmethod
  def _call(self, *args, **kwargs):
    return

  def __call__(self, *args, **kwargs):
    # Queue the call up in the thread pool.
    return _job.Job(future=self.executor.submit(self._call, *args, **kwargs))


class async_function(async):
  """ This decorator can be applied to any static function that makes blocking calls to create
      a modified version that creates a Job and returns immediately; the original
      method will be called on a thread pool worker thread.
  """

  def _call(self, *args, **kwargs):
    # Call the wrapped method.
    return self._function(*async._preprocess_args(*args), **async._preprocess_kwargs(**kwargs))


class async_method(async):
  """ This decorator can be applied to any class instance method that makes blocking calls to create
      a modified version that creates a Job and returns immediately; the original method will be
      called on a thread pool worker thread.
  """

  def _call(self, *args, **kwargs):
    # Call the wrapped method.
    return self._function(self.obj, *async._preprocess_args(*args),
                          **async._preprocess_kwargs(**kwargs))

  def __get__(self, instance, owner):
    # This is important for attribute inheritance and setting self.obj so it can be
    # passed as first argument to wrapped method.
    self.cls = owner
    self.obj = instance
    return self
