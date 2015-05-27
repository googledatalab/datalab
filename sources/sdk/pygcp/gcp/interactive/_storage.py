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
import gcp.storage as _storage
from ._html import HtmlBuilder as _HtmlBuilder
from ._utils import _extract_storage_api_response_error

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
  parsers = []
  parser = argparse.ArgumentParser(prog='storage')
  parsers.append(parser)
  subparsers = parser.add_subparsers(help='sub-commands')

  # TODO(gram): consider adding a move command too. I did try this already using the
  # objects.patch API to change the object name but that fails with an error:
  #
  # Value 'newname' in content does not agree with value 'oldname'. This can happen when a value
  # set through a parameter is inconsistent with a value set in the request.
  #
  # This is despite 'name' being identified as writable in the storage API docs.
  # The alternative would be to use a copy/delete.
  copy_parser = subparsers.add_parser('copy', help='copy a storage object')
  parsers.append(copy_parser)
  copy_parser.add_argument('source', help='the name of the object(s) to copy', nargs='+')
  copy_parser.add_argument('destination', help='the copy destination')
  copy_parser.set_defaults(func=_storage_copy)

  create_parser = subparsers.add_parser('create', help='make one or more buckets')
  parsers.append(create_parser)
  create_parser.add_argument('bucket', help='the name of the bucket(s) to create', nargs='+')
  create_parser.set_defaults(func=_storage_create)

  delete_parser = subparsers.add_parser('delete', help='remove one or more buckets or objects')
  parsers.append(delete_parser)
  delete_parser.add_argument('item', nargs='+',
                             help='the name of the bucket(s) or object(s) to remove')
  delete_parser.set_defaults(func=_storage_delete)

  list_parser = subparsers.add_parser('list', help='list buckets or contents of a bucket')
  parsers.append(list_parser)
  list_parser.add_argument('path', help='the name of the objects(s) to list', nargs='?')
  list_parser.set_defaults(func=_storage_list)

  read_parser = subparsers.add_parser('read',
                                      help='read contents of storage object into Python variable')
  parsers.append(read_parser)
  read_parser.add_argument('item', help='the name of the object to read')
  read_parser.add_argument('variable', help='the name of variable to set')
  read_parser.set_defaults(func=_storage_read)

  view_parser = subparsers.add_parser('view', help='view contents of storage object')
  parsers.append(view_parser)
  view_parser.add_argument('-n', '--head', type=int, default=20,
                           help='the number of lines from start to view')
  view_parser.add_argument('-t', '--tail', type=int, default=20,
                           help='the number of lines from end to view')
  view_parser.add_argument('source', help='the name of the object to view')
  view_parser.set_defaults(func=_storage_view)

  write_parser = subparsers.add_parser('write',
                                       help='write value of Python variable to storage object')
  parsers.append(write_parser)
  write_parser.add_argument('variable', help='the name of the variable')
  write_parser.add_argument('item', help='the name of the object to write')
  write_parser.set_defaults(func=_storage_write)

  for p in parsers:
    p.exit = _parser_exit  # raise exception, don't call sys.exit.
    p.format_usage = p.format_help  # Show full help always.

  args = filter(None, line.split())
  try:
    parsed_args = parser.parse_args(args)
    return parsed_args.func(vars(parsed_args))
  except Exception as e:
    if e.message:
      print e.message


def _parser_exit(status=0, message=None):
  """ Replacement exit method for argument parser. We want to stop processing args but not
      call sys.exit(), so we raise an exception here and catch it in the call to parse_args.
  """
  raise Exception()


def _expand_list(names):
  """ Do a wildchar name expansion of object names in a list and return expanded list.

    The items are expected to exist as this is used for copy sources or delete targets.
    Currently we support wildchars in the bucket name or the key name but not both.
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
        if bucket not in items:
          items[bucket] = [item.metadata().name for item in _storage.bucket(bucket).items()]
        for item in items[bucket]:
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
      raise Exception('Invalid target object %s' % target_name)

  for source in sources:
    source_bucket, source_key = _storage._bucket.parse_name(source)
    if source_bucket is None or source_key is None:
      raise Exception('Invalid source object %s' % source)
    destination_bucket = target_bucket if target_bucket else source_bucket
    destination_key = target_key if target_key else source_key
    try:
      _storage.item(source_bucket, source_key).copy_to(destination_key, bucket=destination_bucket)
    except Exception as e:
      print 'Couldn\'t copy %s to %s: %s' % (source, target, _extract_storage_api_response_error(e.message))


def _storage_create(args):
  """ Create one or more buckets. """
  for name in args['bucket']:
    try:
      bucket, key = _storage._bucket.parse_name(name)
      if bucket and not key:
        _storage.bucket(bucket).create()
      else:
        raise Exception("Invalid name %s" % name)
    except Exception as e:
      print 'Couldn\'t create %s: %s' % (bucket, _extract_storage_api_response_error(e.message))


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
      print 'Couldn\'t delete %s: %s' % (item, _extract_storage_api_response_error(e.message))


def _render_dictionary(data, headers):
  """ Return a dictionary list formatted as a HTML table.

  Args:
    data: the dictionary list
    headers: the keys in the dictionary to use as table columns, in order.
  """
  builder = _HtmlBuilder()
  builder.render_objects(data, headers, dictionary=True)
  html = builder.to_html()
  return _ipython.core.display.HTML(html)


def _storage_list_buckets(pattern):
  """ List all storage buckets that match a pattern. """
  data = [{'name': 'gs://' + bucket.name, 'created': bucket.metadata().created_on}
          for bucket in _storage.buckets() if fnmatch.fnmatch(bucket.name, pattern)]
  return _render_dictionary(data, ['name', 'created'])


def _storage_list_keys(bucket, pattern):
  """ List all storage keys in a specified bucket that match a pattern. """
  data = [{'name': item.metadata().name,
           'type': item.metadata().content_type,
           'size': item.metadata().size,
           'updated': item.metadata().updated_on} for item in bucket.items()
          if fnmatch.fnmatch(item.metadata().name, pattern)]
  return _render_dictionary(data, ['name', 'type', 'size', 'updated'])


def _storage_list(args):
  """ List the buckets or the contents of a bucket.

  This command is a bit different in that we allow wildchars in the bucket name and will list
  the buckets that match.
  """
  target = args['path']
  if target is None:
    return _storage_list_buckets('*')  # List all buckets.

  # List the contents of the bucket
  bucket_name, key = _storage._bucket.parse_name(target)
  if bucket_name is None:
    raise Exception('Invalid name: %s' % target)

  bucket = _storage.bucket(bucket_name)
  if bucket.exists():
    return _storage_list_keys(bucket, key if key else '*')

  # Bucket doesn't exist.
  if key:
    raise Exception('%s doesn\'t exist' % target)

  # Treat the bucket name as a pattern and show matches. We don't use bucket_name as that
  # can strip off wildchars and so we need to strip off gs:// here.
  return _storage_list_buckets(target[5:])


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

