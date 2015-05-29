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

"""Google Cloud Platform library - BigQuery IPython Functionality."""

import argparse
import fnmatch
import re

import gcp.storage as _storage
from ._commands import CommandParser as _CommandParser
from ._html import HtmlBuilder as _HtmlBuilder
from ._utils import _extract_storage_api_response_error, _handle_magic_line

try:
  import IPython as _ipython
  import IPython.core.magic as _magic
except ImportError:
  raise Exception('This module can only be loaded in ipython.')


@_magic.register_line_magic
def storage(line, cell=None):
  """Implements the storage line magic for ipython notebooks.

  Args:
    line: the contents of the storage line.
  Returns:
    The results of executing the cell.
  """
  parser = _CommandParser.create('storage')

  # TODO(gram): consider adding a move command too. I did try this already using the
  # objects.patch API to change the object name but that fails with an error:
  #
  # Value 'newname' in content does not agree with value 'oldname'. This can happen when a value
  # set through a parameter is inconsistent with a value set in the request.
  #
  # This is despite 'name' being identified as writable in the storage API docs.
  # The alternative would be to use a copy/delete.
  copy_parser = parser.subcommand('copy', 'copy a storage object')
  copy_parser.add_argument('source', help='the name of the object(s) to copy', nargs='+')
  copy_parser.add_argument('destination', help='the copy destination')
  copy_parser.set_defaults(func=_storage_copy)

  create_parser = parser.subcommand('create', 'make one or more buckets')
  create_parser.add_argument('-p', '--project', help='the project associated with the objects')
  create_parser.add_argument('bucket', help='the name of the bucket(s) to create', nargs='+')
  create_parser.set_defaults(func=_storage_create)

  delete_parser = parser.subcommand('delete', 'remove one or more buckets or objects')
  delete_parser.add_argument('item', nargs='+',
                             help='the name of the bucket(s) or object(s) to remove')
  delete_parser.set_defaults(func=_storage_delete)

  list_parser = parser.subcommand('list', 'list buckets or contents of a bucket')
  list_parser.add_argument('-p', '--project', help='the project associated with the objects')
  list_parser.add_argument('path', help='the name of the objects(s) to list', nargs='?')
  list_parser.set_defaults(func=_storage_list)

  read_parser = parser.subcommand('read', 'read contents of storage object into Python variable')
  read_parser.add_argument('item', help='the name of the object to read')
  read_parser.add_argument('variable', help='the name of variable to set')
  read_parser.set_defaults(func=_storage_read)

  view_parser = parser.subcommand('view', 'view contents of storage object')
  view_parser.add_argument('-n', '--head', type=int, default=20,
                           help='the number of lines from start to view')
  view_parser.add_argument('-t', '--tail', type=int, default=20,
                           help='the number of lines from end to view')
  view_parser.add_argument('source', help='the name of the object to view')
  view_parser.set_defaults(func=_storage_view)

  write_parser = parser.subcommand('write', 'write value of Python variable to storage object')
  write_parser.add_argument('variable', help='the name of the variable')
  write_parser.add_argument('item', help='the name of the object to write')
  write_parser.set_defaults(func=_storage_write)

  return _handle_magic_line(line, parser)


def _parser_exit(status=0, message=None):
  """ Replacement exit method for argument parser. We want to stop processing args but not
      call sys.exit(), so we raise an exception here and catch it in the call to parse_args.
  """
  raise Exception()


def _expand_list(names):
  """ Do a wildchar name expansion of object names in a list and return expanded list.

    The items are expected to exist as this is used for copy sources or delete targets.
    Currently we support wildchars in the key name only.
  """

  results = []  # The expanded list.
  items = {}  # Cached contents of buckets; used for matching.
  for name in names:
    bucket, key = _storage._bucket.parse_name(name)
    results_len = len(results)  # If we fail to add any we add name and let caller deal with it.
    if bucket:
      if not key:
        # Just a bucket; add it.
        results.append('gs://%s' % bucket)
      elif _storage.item(bucket, key).exists():
        results.append('gs://%s/%s', bucket, key)
      else:
        # Expand possible key values.
        if bucket not in items and key[:1] == '*':
          # We need the full list; cache a copy for efficiency.
          items[bucket] = [item.metadata().name for item in _storage.bucket(bucket).items()]
        # If we have a cached copy use it
        if bucket in items:
          candidates = items[bucket]
        # else we have no cached copy but can use prefix matching which is more efficient than
        # getting the full contents.
        else:
          # Get the non-wildchar prefix.
          match = re.search('\?|\*|\[', key)
          prefix = key
          if match:
            prefix = key[0:match.start()]

          candidates = [item.metadata().name
                        for item in _storage.bucket(bucket).items(prefix=prefix)]

        for item in candidates:
          if fnmatch.fnmatch(item, key):
            results.append('gs://%s/%s' % (bucket, item))

    # If we added no matches, add the original name and let caller deal with it.
    if len(results) == results_len:
      results.append(name)

  return results


def _storage_copy(args):
  target = args['destination']
  target_bucket, target_key = _storage._bucket.parse_name(target)
  if target_bucket is None and target_key is None:
    raise Exception('Invalid target object %s' % target)

  sources = _expand_list(args['source'])

  if len(sources) > 1:
    # Multiple sources; target must be a bucket
    if target_bucket is None or target_key is not None:
      raise Exception('Invalid target object %s' % target)

  for source in sources:
    source_bucket, source_key = _storage._bucket.parse_name(source)
    if source_bucket is None or source_key is None:
      raise Exception('Invalid source object %s' % source)
    destination_bucket = target_bucket if target_bucket else source_bucket
    destination_key = target_key if target_key else source_key
    try:
      _storage.item(source_bucket, source_key).copy_to(destination_key, bucket=destination_bucket)
    except Exception as e:
      print "Couldn't copy %s to %s: %s" %\
            (source, target, _extract_storage_api_response_error(e.message))


def _storage_create(args):
  """ Create one or more buckets. """
  buckets = _storage.buckets(project_id=args['project'])
  for name in args['bucket']:
    try:
      bucket, key = _storage._bucket.parse_name(name)
      if bucket and not key:
        buckets.create(bucket)
      else:
        raise Exception("Invalid name %s" % name)
    except Exception as e:
      print "Couldn't create %s: %s" % (bucket, _extract_storage_api_response_error(e.message))


def _storage_delete(args):
  """ Delete one or more buckets or objects. """
  items = _expand_list(args['item'])
  for item in items:
    try:
      bucket, key = _storage._bucket.parse_name(item)
      if bucket and key:
        _storage.item(bucket, key).delete()
      elif bucket:
        _storage.bucket(bucket).delete()
      else:
        raise Exception('Invalid name %s' % item)
    except Exception as e:
      print "Couldn't delete %s: %s" % (item, _extract_storage_api_response_error(e.message))


def _render_dictionary(data, headers=None):
  """ Return a dictionary list formatted as a HTML table.

  Args:
    data: the dictionary list
    headers: the keys in the dictionary to use as table columns, in order.
  """
  builder = _HtmlBuilder()
  builder.render_objects(data, headers, dictionary=True)
  html = builder.to_html()
  return _ipython.core.display.HTML(html)


def _storage_list_buckets(project, pattern):
  """ List all storage buckets that match a pattern. """
  data = [{'Bucket': 'gs://' + bucket.name, 'Created': bucket.metadata().created_on}
          for bucket in _storage.buckets(project_id=project)
          if fnmatch.fnmatch(bucket.name, pattern)]
  return _render_dictionary(data, ['Bucket', 'Created'])


def _storage_get_keys(bucket, pattern):
  """ Get names of all storage keys in a specified bucket that match a pattern. """
  return [item for item in bucket.items() if fnmatch.fnmatch(item.metadata().name, pattern)]


def _storage_get_key_names(bucket, pattern):
  """ Get names of all storage keys in a specified bucket that match a pattern. """
  return [item.metadata().name for item in _storage_get_keys(bucket, pattern)]


def _storage_list_keys(bucket, pattern):
  """ List all storage keys in a specified bucket that match a pattern. """
  data = [{'Name': item.metadata().name,
           'Type': item.metadata().content_type,
           'Size': item.metadata().size,
           'Updated': item.metadata().updated_on}
          for item in _storage_get_keys(bucket, pattern)]
  return _render_dictionary(data, ['Name', 'Type', 'Size', 'Updated'])


def _storage_list(args):
  """ List the buckets or the contents of a bucket.

  This command is a bit different in that we allow wildchars in the bucket name and will list
  the buckets that match.
  """
  target = args['path']
  project = args['project']
  if target is None:
    return _storage_list_buckets(project, '*')  # List all buckets.

  bucket_name, key = _storage._bucket.parse_name(target)
  if bucket_name is None:
    raise Exception('Invalid name: %s' % target)

  if key or not re.search('\?|\*|\[', target):
    # List the contents of the bucket
    if not key:
      key = '*'
    if project:
      # Only list if the bucket is in the project
      for bucket in _storage.buckets(project_id=project):
        if bucket.name == bucket_name:
          break
      else:
        raise Exception('%s does not exist in project %s' % (target, project))
    else:
      bucket = _storage.bucket(bucket_name)

    if bucket.exists():
      return _storage_list_keys(bucket, key)
    else:
      raise Exception('%s does not exist' % target)

  else:
    # Treat the bucket name as a pattern and show matches. We don't use bucket_name as that
    # can strip off wildchars and so we need to strip off gs:// here.
    return _storage_list_buckets(project, target[5:])


def _get_item_contents(source_name):
  source_bucket, source_key = _storage._bucket.parse_name(source_name)
  if source_bucket is None or source_key is None:
    raise Exception('Invalid source object %s' % source_name)
  source = _storage.item(source_bucket, source_key)
  if not source.exists():
    raise Exception('Source %s does not exist' % source_name)
  return source.read_from()


def _storage_read(args):
  contents = _get_item_contents(args['item'])
  ipy = _ipython.get_ipython()
  ipy.push({args['variable']: contents})


def _storage_view(args):
  contents = _get_item_contents(args['source'])
  if not isinstance(contents, basestring):
    contents = str(contents)
  lines = contents.split('\n')
  head_count = args['head']
  tail_count = args['tail']
  if len(lines) > head_count + tail_count:
    head = '\n'.join(lines[:head_count])
    tail = '\n'.join(lines[-tail_count:])
    return head + '\n...\n' + tail
  else:
    return contents


def _storage_write(args):
  target_name = args['item']
  target_bucket, target_key = _storage._bucket.parse_name(target_name)
  if target_bucket is None or target_key is None:
    raise Exception('Invalid target object %s' % target_name)
  target = _storage.item(target_bucket, target_key)
  ipy = _ipython.get_ipython()
  contents = ipy.user_ns[args['variable']]
  # TODO(gram): would we want to to do any special handling here; e.g. for DataFrames?
  target.write_to(str(contents), 'text/plain')

