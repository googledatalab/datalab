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

"""ContentsManager Implementations."""

import datetime as _dt
import io as _io
import json as _json
import os
from os import path
from tornado import web

import gcp as _gcp
import gcp.storage as _storage
from IPython import nbformat
from IPython.html.services.contents.checkpoints import Checkpoints as _Checkpoints
from IPython.html.services.contents.manager import ContentsManager as _ContentsManager
from IPython.nbformat import current as _NotebookFormat
from IPython.utils import tz

def log(msg):
  with open('/tmp/ebug.log', 'a') as f:
    f.write('%s\n' % msg)

class Notebook(object):
  """Information about a notebook."""

  def __init__(self, name, timestamp, data):
    self.name = name
    self.timestamp = timestamp
    self.data = data


class NotebookList(object):
  """Represents a flat collection of notebooks."""

  def __init__(self):
    pass

  def list_files(self):
    raise NotImplementedError('Must be implemented in a derived class.')

  def file_exists(self, name):
    raise NotImplementedError('Must be implemented in a derived class.')

  def read_file(self, name, read_content):
    raise NotImplementedError('Must be implemented in a derived class.')

  def write_file(self, notebook):
    raise NotImplementedError('Must be implemented in a derived class.')

  def rename_file(self, name, new_name):
    raise NotImplementedError('Must be implemented in a derived class.')

  def delete_file(self, name):
    raise NotImplementedError('Must be implemented in a derived class.')


class MemoryNotebookList(NotebookList):
  """Implements a simple in-memory notebook list."""

  def __init__(self):
    """Initializes an instance of a MemoryNotebookList.
    """
    super(MemoryNotebookList, self).__init__()
    self._notebooks = {}

  def list_files(self):
    log("list files returns %s" % str(self._notebooks.keys()))
    return self._notebooks.keys()

  def file_exists(self, name):
    log("file_exists(%s) => %s" % (name, str(name in self._notebooks)))
    return name in self._notebooks

  def read_file(self, name, read_content):
    return self._notebooks.get(name, None)

  def write_file(self, notebook):
    self._notebooks[notebook.name] = notebook
    notebook.data =  nbformat.reads(notebook.data, as_version=4)
    log("saving %s in list" % notebook.name)

  def rename_file(self, name, new_name):
    notebook = self._notebooks.get(name, None)
    if notebook is None:
      return None

    if new_name in self._notebooks:
      return None

    notebook.name = new_name
    self._notebooks[new_name] = notebook
    del self._notebooks[name]

    return notebook

  def delete_file(self, name):
    if name in self._notebooks:
      del self._notebooks[name]
      return True
    return False


class LocalNotebookList(NotebookList):
  """Implements a local file system baked notebook list.
  """

  def __init__(self, directory):
    """Initializes an instance of a LocalNotebookList.
    """
    super(LocalNotebookList, self).__init__()
    self._directory = directory

  def _get_path(self, name):
    if name.find(self._directory[1:] + '/') == 0:
      return '/' + name
    return path.join(self._directory, name)

  def list_files(self):
    entries = os.listdir(self._directory)
    return filter(lambda e: path.splitext(e)[1] == '.ipynb' and
                    path.isfile(path.join(self._directory, e)), entries)

  def file_exists(self, name):
    return path.exists(self._get_path(name))

  def read_file(self, name, read_content):
    abs_name = self._get_path(name)
    if path.exists(abs_name) and path.isfile(abs_name):
      try:
        data = None
        if read_content:
          with open(abs_name, 'r') as f:
            data = nbformat.reads(f.read(), as_version=4)

        timestamp = _dt.datetime.utcfromtimestamp(os.stat(abs_name).st_mtime)
        return Notebook(name, timestamp, data)
      except Exception:
        return None
    else:
      return None

  def write_file(self, notebook):
    abs_name = self._get_path(notebook.name)
    try:
      with open(abs_name, 'w') as f:
        f.write(notebook.data)
        f.close()
      return True
    except:
      return False

  def rename_file(self, name, new_name):
    abs_name = self._get_path(name)
    abs_new_name = self._get_path(new_name)
    log("Rename(%s => %s) => %s => %s" % (name, new_name, abs_name, abs_new_name))
    if path.exists(abs_name) and path.isfile(abs_name):
      os.rename(abs_name, abs_new_name)

      timestamp = _dt.datetime.utcfromtimestamp(os.stat(abs_new_name).st_mtime)
      return Notebook(new_name, timestamp, '')
    return None

  def delete_file(self, name):
    abs_name = self._get_path(name)
    if path.exists(abs_name) and path.isfile(abs_name):
      os.remove(abs_name)
      return True
    return False


class StorageNotebookList(NotebookList):
  """Implements a cloud storage backed notebook list.

  This works against a specific item prefix path within a single bucket.

  This class manages the list of notebook as a cached set of items. The cache is updated
  each time notebooks are listed (which happens each time the list page becomes active).

  Operations such as checking for existence work against this cache (which is used
  as part of finding an unused number when creating a new notebook for example). The
  cache helps avoid creating a barrage of API calls to GCS.

  Operations such as save, rename, delete directly operate against GCS APIs, but update
  this cache as well. This is because the local list will only be updated when the list
  page is re-activated by the user. In the interim the list would be out-of-date.
  """

  def __init__(self, bucket, prefix=''):
    """Initializes an instance of a StorageNotebookList.
    """
    super(StorageNotebookList, self).__init__()
    self._bucket = bucket
    self._prefix = prefix
    self._items = None

  def _ensure_items(self, update=False):
    if (self._items is None) or update:
      self._items = {}

      items = self._bucket.items(delimiter='/', prefix=self._prefix)
      for item in items:
        if item.key.endswith('.ipynb'):
          key = item.key[len(self._prefix):]
          self._items[key] = item

  def _find_item(self, name):
    self._ensure_items()
    return self._items.get(name, None)

  def list_files(self):
    self._ensure_items(update=True)
    return self._items.keys()

  def file_exists(self, name):
    return self._find_item(name) is not None

  def read_file(self, name, read_content):
    item = self._find_item(name)
    if item is not None:
      try:
        metadata = item.metadata()
        data = None
        if read_content:
          data = nbformat.reads(item.read_from(), as_version=4)

        return Notebook(name, metadata.updated_on, data)
      except Exception:
        return None
    else:
      # Its possible that the item has been added to the bucket behind the scenes.
      # Avoid checking GCS, as it defeats the purpose of a cache. A new notebook
      # operation attempts to read every file in sequence. Looking up GCS here would
      # significantly slow down the process.
      # Instead, the list will be updated when the list page loses and regains focus.
      return None

  def write_file(self, notebook):
    creating_new_item = False

    item = self._find_item(notebook.name)
    if item is None:
      creating_new_item = True
      item = self._bucket.item(self._prefix + notebook.name)

    try:
      item.write_to(notebook.data, 'application/json')
    except Exception:
      return False

    if creating_new_item:
      # Update the local cache, as the item must exist in the cache for it to be successfully
      # retrieved in the subsequent read. This is because the list itself will be updated only
      # when the user returns to the list page, and the list is refreshed.
      self._items[notebook.name] = item
    else:
      item.timestamp = _dt.datetime.utcnow()
    return True

  def rename_file(self, name, new_name):
    item = self._find_item(name)
    if item is None:
      return None

    new_key = self._prefix + new_name
    if self._bucket.items().contains(new_key):
      return None

    try:
      new_item = item.copy_to(new_key)
    except Exception:
      return None

    try:
      item.delete()
    except Exception:
      # Swallow failures to delete, since the new notebook with the new name was
      # successfully created.
      pass

    # Update the local cache, so it is in-sync.
    del self._items[name]
    self._items[new_name] = new_item

    return Notebook(new_name, new_item.metadata().updated_on, '')

  def delete_file(self, name):
    item = self._find_item(name)
    if item is not None:
      try:
        item.delete()
      except Exception:
        return False

      del self._items[name]
      return True
    return False


class SimpleContentsCheckpoints(_Checkpoints):
  """Simple implementation of checkpoints. Essentially no-ops/exceptions for DataLab. """

  def create_checkpoint(self, contents_mgr, path):
    """Creates a save checkpoint."""
    # This is really meant to be a no-op implementation, but returning a valid checkpoint
    # avoids the seemingly benign error that shows up in verbose debug logs if one isn't
    # created/returned. The returned checkpoint is ID'd with an arbitrary but fixed name,
    # so it can also be returned when listing checkpoints.
    return dict(id = u'checkpoint', last_modified=_dt.datetime.utcnow())

  def restore_checkpoint(self, contents_mgr, checkpoint_id, path):
    """Restore a checkpoint."""
    raise NotImplementedError("DataLab beta does not yet support checkpoints")

  def rename_checkpoint(self, checkpoint_id, old_path, new_path):
    """Rename a single checkpoint from old_path to new_path."""
    raise NotImplementedError("DataLab beta does not yet support checkpoints")

  def delete_checkpoint(self, checkpoint_id, path):
    """delete a checkpoint for a file"""
    raise NotImplementedError("DataLab beta does not yet support checkpoints")

  def list_checkpoints(self, path):
    """Return a list of checkpoints for a given file"""
    return []


class CompositeContentsManager(_ContentsManager):
  """Base class for notebook managers."""

  def __init__(self, name, **kwargs):
    """Initializes an instance of a CompositeContentsManager.
    """
    super(CompositeContentsManager, self).__init__(**kwargs)
    self._name = name
    log("create empty list")
    self._notebook_lists = {}
    self._dirs = []
    self._dir_timestamp = _dt.datetime.utcnow()

  def _checkpoints_class_default(self):
    return SimpleContentsCheckpoints

  def add_notebook_list(self, notebook_list, name=''):
    log("Add notebook list %s => %s" % (name, notebook_list))
    self._notebook_lists[name] = notebook_list
    if len(name):
      self._dirs.append(name)

  def _get_notebook_list(self, path):
    return self._notebook_lists.get(path.strip('/'), None)

  def _get_notebook_list_and_file_name(self, name):
    log("_get_notebook_list_and_file_name(%s)" % name)
    i = name.rfind('/')
    if i == -1:
      path = ''
    else:
      path = name[:i]
      name = name[i+1:]
    notebook_list = self._get_notebook_list(path)
    log ("Notebook lists are %s" % str(self._notebook_lists))
    log("Returns %s,%s for '%s',%s" % (notebook_list, name, path, name))
    return notebook_list, name

  def info_string(self):
    return 'Serving notebooks via the %s notebook manager.' % self._name

  def dir_exists(self, path):
    """Checks if the specified path exists.
    """
    log('dir_exists(%s) returns %s' % (path, str(len(path) == 0 or self._get_notebook_list(path) is not None)))
    return len(path) == 0 or self._get_notebook_list(path) is not None

  def is_hidden(self, path):
    """Checks if the path corresponds to a hidden directory.
    """
    # No hidden directories semantics.
    return False

  def file_exists(self, name):
    """Checks if the specified notebook exists.
    """
    notebook_list, notebook_name = self._get_notebook_list_and_file_name(name)
    log('file_exists(%s) returns %s' % (name, str(False if notebook_list is None else notebook_list.file_exists(notebook_name))))
    return False if notebook_list is None else notebook_list.file_exists(notebook_name)

  def _base_model(self, path, type):
    """Build the common base of a contents model"""
    model = {}
    model['name'] = path.rsplit('/', 1)[-1]
    model['path'] = path
    model['content'] = None
    model['format'] = None
    model['mimetype'] = None
    model['writable'] = True
    model['type'] = type
    return model

  def _subdirs(self, path):
    """Return subdirs for this path.

    This is just a kludge for DataLab, where subdirectories are virtual.
    """
    return [] if len(path) else self._dirs

  def _dir_model(self, path, content=True):
    """Build a model for a directory

    if content is requested, will include a listing of the directory
    """
    notebook_list = self._get_notebook_list(path)
    model = self._base_model(path, 'directory')
    model['last_modified'] = self._dir_timestamp
    model['created'] = self._dir_timestamp
    if content:
      model['content'] = contents = []
      if notebook_list:
        for file in notebook_list.list_files():
          contents.append(self.get(path='%s/%s' % (path, file), content=False))
      for file in self._subdirs(path):
        contents.append(self.get(path='%s/%s' % (path, file), content=False))
      model['format'] = 'json'
    return model

  def _notebook_model(self, path, content=True):
    """Build a notebook model

    if content is requested, the notebook content will be populated
    as a JSON structure (not double-serialized)
    """
    notebook_list, name = self._get_notebook_list_and_file_name(path)
    if notebook_list is None:
      raise web.HTTPError(404, u'notebook does not exist: %r' % path)
    nb = notebook_list.read_file(name, read_content=content)
    model = self._base_model(path, 'notebook')
    model['last_modified'] = nb.timestamp
    model['created'] = nb.timestamp
    if content:
      self.mark_trusted_cells(nb.data, path)
      model['content'] = nb.data
      model['format'] = 'json'
      self.validate_notebook_model(model)
    return model

  def get(self, path, content=True, type=None, format=None):
    """ Takes a path for an entity and returns its model

    Args:
      path: the API path that describes the relative path for the target
      content: Whether to include the contents in the reply
      type: The requested type - 'file', 'notebook', or 'directory'.
            Will raise HTTPError 400 if the content doesn't match.
      format: The requested format for file contents. 'text' or 'base64'.
            Ignored if this returns a notebook or directory model.

    Returns
      The contents model. If content=True, returns the contents
      of the file or directory as well.
    """
    if self.dir_exists(path):
      self.log.info('dir_exists %s' % path)
      if type is not None and type != 'directory':
        raise web.HTTPError(400, u'%s is a directory, not a %s' % (path, type), reason='bad type')
      model = self._dir_model(path, content=content)

    elif self.file_exists(path):
      # Note: we only support notebooks so can ignore the possibility of this being some
      # other type of file
      if type is not None and type != 'notebook':
        raise web.HTTPError(400, u'%s is a notebook, not a %s' % (path, type), reason='bad type')
      model = self._notebook_model(path, content=content)

    else:
      raise web.HTTPError(404, u'No such file or directory: %s' % path)

    log("get(%s) returns %s" % (path, str(model)))
    return model

  def save(self, model, path):
    """Save the file or directory and return the model with no content.

    Save implementations should call self.run_pre_save_hook(model=model, path=path)
    prior to writing any data.
    """

    if 'type' not in model:
      raise web.HTTPError(400, u'No file type provided')
    if 'content' not in model and model['type'] != 'directory':
      raise web.HTTPError(400, u'No file content provided')

    self.run_pre_save_hook(model=model, path=path)

    notebook_list, name = self._get_notebook_list_and_file_name(path)
    if notebook_list is None:
      raise web.HTTPError(400, u'Parent container does not exist: %s' % path)

    validation_message = None
    try:
      if model['type'] == 'notebook':
        nb = nbformat.from_dict(model['content'])
        self.check_and_sign(nb, path)
        s = nbformat.writes(nb)
        if isinstance(s, bytes):
          s = s.decode('utf8')
        notebook_list.write_file(Notebook(name, _dt.datetime.utcnow(), s))
        self.validate_notebook_model(model)
        validation_message = model.get('message', None)
      elif model['type'] == 'directory':
        if self.file_exists(path):
          raise web.HTTPError(400, u'Not a directory: %s' % (path))
        elif self.dir_exists(path):
          self.log.debug("Directory %r already exists", path)
        else:
          # In DataLab we are not supporting creating new 'directories'
          raise web.HTTPError(400, u'Directory creation is not supported: %s' % (path))
      else:
        raise web.HTTPError(400, "Unhandled contents type: %s" % model['type'])
    except web.HTTPError:
      raise
    except Exception as e:
      raise web.HTTPError(500, u'Unexpected error while saving file: %s %s' % (path, e))

    model = self.get(path, content=False)
    if validation_message:
      model['message'] = validation_message

    return model

  def delete_file(self, path):
    """Delete file or directory by path."""
    notebook_list, name = self._get_notebook_list_and_file_name(path)
    if notebook_list is not None:
      notebook_list.delete_file(name)

  def rename_file(self, old_path, new_name):
    """Rename a file."""
    notebook_list, name = self._get_notebook_list_and_file_name(old_path)
    if notebook_list is not None:
      notebook_list.rename_file(name, new_name)


class DataLabContentsManager(CompositeContentsManager):
  """Implements the contents manager used in DataLab.

  This works against three notebook locations.
  - A GCS location of the form gs://project_id-datalab/notebooks
  - A container /docs directory
  - A mounted /nb directory when the running the container locally
  """

  def __init__(self, **kwargs):
    """Initializes an instance of a DataLabContentsManager.
    """
    super(DataLabContentsManager, self).__init__('DataLab', **kwargs)
    log('Creating DataLab contents manager')

    try:
      # In-memory notebooks; useful for testing
      #self.add_notebook_list(MemoryNotebookList())
      #self._dir_timestamp = _dt.datetime().utcnow()

      self.add_notebook_list(LocalNotebookList('/docs'), 'docs')
      if os.environ.get('DATALAB_ENV', '') == 'local':
        self.add_notebook_list(LocalNotebookList('/nb'), 'local')
      bucket = DataLabContentsManager._create_bucket()
      self._dir_timestamp = bucket.metadata().created_on
      self.add_notebook_list(StorageNotebookList(bucket, prefix='notebooks/'), '')
    except Exception as e:
      log(str(e))

  @staticmethod
  def _create_bucket():
    # Use the project id to construct a valid bucket name (as predictably unique
    # as we can make it). Some caveats:
    # - The name cannot contain 'google'
    # - Project ids maybe domain-qualified, eg. foo.com:bar
    project_id = _gcp.Context.default().project_id
    project_id = project_id.replace('google.com', 'gcom').replace(':', '-').replace('.', '-')
    bucket_name = project_id + '-datalab'

    buckets = _storage.buckets()
    if not buckets.contains(bucket_name):
      return buckets.create(bucket_name)
    else:
      return _storage.bucket(bucket_name)

