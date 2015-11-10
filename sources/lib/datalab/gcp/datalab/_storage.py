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

"""Google Cloud Platform library - BigQuery IPython Functionality."""

import fnmatch
import re

import gcp.storage
import _commands
import _html
import _utils

try:
  import IPython
  import IPython.core.display
  import IPython.core.magic
except ImportError:
  raise Exception('This module can only be loaded in ipython.')


@IPython.core.magic.register_line_magic
def storage(line):
  """Implements the storage line magic for ipython notebooks.

  Args:
    line: the contents of the storage line.
  Returns:
    The results of executing the cell.
  """
  parser = _commands.CommandParser(prog='storage', description="""
Execute various storage-related operations. Use "%storage <command> -h"
for help on a specific command.
""")

  # TODO(gram): consider adding a move command too. I did try this already using the
  # objects.patch API to change the object name but that fails with an error:
  #
  # Value 'newname' in content does not agree with value 'oldname'. This can happen when a value
  # set through a parameter is inconsistent with a value set in the request.
  #
  # This is despite 'name' being identified as writable in the storage API docs.
  # The alternative would be to use a copy/delete.
  copy_parser = parser.subcommand('copy',
                                  'Copy one or more GCS objects to a different location.')
  copy_parser.add_argument('-s', '--source', help='The name of the object(s) to copy', nargs='+')
  copy_parser.add_argument('-d', '--destination', required=True,
      help='The copy destination. For multiple source items this must be a bucket.')
  copy_parser.set_defaults(func=_storage_copy)

  create_parser = parser.subcommand('create', 'Create one or more GCS buckets.')
  create_parser.add_argument('-p', '--project', help='The project associated with the objects')
  create_parser.add_argument('-b', '--bucket', help='The name of the bucket(s) to create',
                             nargs='+')
  create_parser.set_defaults(func=_storage_create)

  delete_parser = parser.subcommand('delete', 'Delete one or more GCS buckets or objects.')
  delete_parser.add_argument('-b', '--bucket', nargs='*',
                             help='The name of the bucket(s) to remove')
  delete_parser.add_argument('-o', '--object', nargs='*',
                             help='The name of the object(s) to remove')
  delete_parser.set_defaults(func=_storage_delete)

  list_parser = parser.subcommand('list', 'List buckets in a project, or contents of a bucket.')
  list_parser.add_argument('-p', '--project', help='The project associated with the objects')
  group = list_parser.add_mutually_exclusive_group()
  group.add_argument('-o', '--object',
                     help='The name of the objects(s) to list; can include wildchars',
                     nargs='?')
  group.add_argument('-b', '--bucket',
                     help='The name of the buckets(s) to list; can include wildchars',
                     nargs='?')
  list_parser.set_defaults(func=_storage_list)

  read_parser = parser.subcommand('read',
                                  'Read the contents of a storage object into a Python variable.')
  read_parser.add_argument('-o', '--object', help='The name of the object to read',
                           required=True)
  read_parser.add_argument('-v', '--variable', required=True,
                           help='The name of the Python variable to set')
  read_parser.set_defaults(func=_storage_read)

  view_parser = parser.subcommand('view', 'View the contents of a storage object.')
  view_parser.add_argument('-n', '--head', type=int, default=20,
                           help='The number of initial lines to view')
  view_parser.add_argument('-t', '--tail', type=int, default=20,
                           help='The number of lines from end to view')
  view_parser.add_argument('-o', '--object', help='The name of the object to view',
                           required=True)
  view_parser.set_defaults(func=_storage_view)

  write_parser = parser.subcommand('write',
                                   'Write the value of a Python variable to a storage object.')
  write_parser.add_argument('-v', '--variable', help='The name of the source Python variable',
                            required=True)
  write_parser.add_argument('-o', '--object', required=True,
                            help='The name of the destination GCS object to write')
  write_parser.set_defaults(func=_storage_write)

  return _utils.handle_magic_line(line, None, parser)


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

  if names is None:
    names = []
  elif isinstance(names, basestring):
    names = [names]

  results = []  # The expanded list.
  items = {}  # Cached contents of buckets; used for matching.
  for name in names:
    bucket, key = gcp.storage._bucket.parse_name(name)
    results_len = len(results)  # If we fail to add any we add name and let caller deal with it.
    if bucket:
      if not key:
        # Just a bucket; add it.
        results.append('gs://%s' % bucket)
      elif gcp.storage.Item(bucket, key).exists():
        results.append('gs://%s/%s' % (bucket, key))
      else:
        # Expand possible key values.
        if bucket not in items and key[:1] == '*':
          # We need the full list; cache a copy for efficiency.
          items[bucket] = [item.metadata().name for item in gcp.storage.Bucket(bucket).items()]
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
                        for item in gcp.storage.Bucket(bucket).items(prefix=prefix)]

        for item in candidates:
          if fnmatch.fnmatch(item, key):
            results.append('gs://%s/%s' % (bucket, item))

    # If we added no matches, add the original name and let caller deal with it.
    if len(results) == results_len:
      results.append(name)

  return results


def _storage_copy(args, _):
  target = args['destination']
  target_bucket, target_key = gcp.storage._bucket.parse_name(target)
  if target_bucket is None and target_key is None:
    raise Exception('Invalid copy target name %s' % target)

  sources = _expand_list(args['source'])

  if len(sources) > 1:
    # Multiple sources; target must be a bucket
    if target_bucket is None or target_key is not None:
      raise Exception('More than one source but target %s is not a bucket' % target)

  errs = []
  for source in sources:
    source_bucket, source_key = gcp.storage._bucket.parse_name(source)
    if source_bucket is None or source_key is None:
      raise Exception('Invalid source object name %s' % source)
    destination_bucket = target_bucket if target_bucket else source_bucket
    destination_key = target_key if target_key else source_key
    try:
      gcp.storage.Item(source_bucket, source_key).copy_to(destination_key,
                                                          bucket=destination_bucket)
    except Exception as e:
      errs.append("Couldn't copy %s to %s: %s" %
                  (source, target, _utils.extract_storage_api_response_error(e.message)))
  if errs:
    raise Exception('\n'.join(errs))


def _storage_create(args, _):
  """ Create one or more buckets. """
  buckets = gcp.storage.Buckets(project_id=args['project'])
  errs = []
  for name in args['bucket']:
    try:
      bucket, key = gcp.storage._bucket.parse_name(name)
      if bucket and not key:
        buckets.create(bucket)
      else:
        raise Exception("Invalid bucket name %s" % name)
    except Exception as e:
      errs.append("Couldn't create %s: %s" %
                  (name, _utils.extract_storage_api_response_error(e.message)))
  if errs:
    raise Exception('\n'.join(errs))


def _storage_delete(args, _):
  """ Delete one or more buckets or objects. """
  items = _expand_list(args['bucket'])
  items.extend(_expand_list(args['object']))
  errs = []
  for item in items:
    try:
      bucket, key = gcp.storage._bucket.parse_name(item)
      if bucket and key:
        gcs_item = gcp.storage.Item(bucket, key)
        if gcs_item.exists():
          gcp.storage.Item(bucket, key).delete()
        else:
          errs.append("%s does not exist" % item)
      elif bucket:
        gcs_bucket = gcp.storage.Bucket(bucket)
        if gcs_bucket.exists():
          gcs_bucket.delete()
        else:
          errs.append("%s does not exist" % item)
      else:
        raise Exception("Can't delete item with invalid name %s" % item)
    except Exception as e:
      errs.append("Couldn't delete %s: %s" %
                  (item, _utils.extract_storage_api_response_error(e.message)))
  if errs:
    raise Exception('\n'.join(errs))


def _render_dictionary(data, headers=None):
  """ Return a dictionary list formatted as a HTML table.

  Args:
    data: the dictionary list
    headers: the keys in the dictionary to use as table columns, in order.
  """
  return IPython.core.display.HTML(_html.HtmlBuilder.render_table(data, headers))


def _storage_list_buckets(project, pattern):
  """ List all storage buckets that match a pattern. """
  data = [{'Bucket': 'gs://' + bucket.name, 'Created': bucket.metadata().created_on}
          for bucket in gcp.storage.Buckets(project_id=project)
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


def _storage_list(args, _):
  """ List the buckets or the contents of a bucket.

  This command is a bit different in that we allow wildchars in the bucket name and will list
  the buckets that match.
  """
  target = args['object'] if args['object'] else args['bucket']
  project = args['project']
  if target is None:
    return _storage_list_buckets(project, '*')  # List all buckets.

  bucket_name, key = gcp.storage._bucket.parse_name(target)
  if bucket_name is None:
    raise Exception('Cannot list %s; not a valid bucket name' % target)

  if key or not re.search('\?|\*|\[', target):
    # List the contents of the bucket
    if not key:
      key = '*'
    if project:
      # Only list if the bucket is in the project
      for bucket in gcp.storage.Buckets(project_id=project):
        if bucket.name == bucket_name:
          break
      else:
        raise Exception('%s does not exist in project %s' % (target, project))
    else:
      bucket = gcp.storage.Bucket(bucket_name)

    if bucket.exists():
      return _storage_list_keys(bucket, key)
    else:
      raise Exception('Bucket %s does not exist' % target)

  else:
    # Treat the bucket name as a pattern and show matches. We don't use bucket_name as that
    # can strip off wildchars and so we need to strip off gs:// here.
    return _storage_list_buckets(project, target[5:])


def _get_item_contents(source_name):
  source_bucket, source_key = gcp.storage._bucket.parse_name(source_name)
  if source_bucket is None:
    raise Exception('Invalid source object name %s; no bucket specified.' % source_name)
  if source_key is None:
    raise Exception('Invalid source object name %si; source cannot be a bucket.' % source_name)
  source = gcp.storage.Item(source_bucket, source_key)
  if not source.exists():
    raise Exception('Source object %s does not exist' % source_name)
  return source.read_from()


def _storage_read(args, _):
  contents = _get_item_contents(args['object'])
  ipy = IPython.get_ipython()
  ipy.push({args['variable']: contents})


def _storage_view(args, _):
  contents = _get_item_contents(args['object'])
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


def _storage_write(args, _):
  target_name = args['object']
  target_bucket, target_key = gcp.storage._bucket.parse_name(target_name)
  if target_bucket is None or target_key is None:
    raise Exception('Invalid target object name %s' % target_name)
  target = gcp.storage.Item(target_bucket, target_key)
  ipy = IPython.get_ipython()
  contents = ipy.user_ns[args['variable']]
  # TODO(gram): would we want to to do any special handling here; e.g. for DataFrames?
  target.write_to(str(contents), 'text/plain')
