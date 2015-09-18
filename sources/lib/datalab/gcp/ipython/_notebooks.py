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

"""NotebookManager Implementations."""

import datetime as _dt
import io as _io
import gcp as _gcp
import gcp.storage as _storage
from IPython.html.services.notebooks.nbmanager import NotebookManager as _NotebookManager
from IPython.nbformat import current as _NotebookFormat
import os
from os import path


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
    return self._notebooks.keys()

  def file_exists(self, name):
    return name in self._notebooks

  def read_file(self, name, read_content):
    return self._notebooks.get(name, None)

  def write_file(self, notebook):
    self._notebooks[notebook.name] = notebook
    return True

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
            data = unicode(f.read())

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
          data = unicode(item.read_from())

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


class CompositeNotebookManager(_NotebookManager):
  """Base class for notebook managers."""

  def __init__(self, name, **kwargs):
    """Initializes an instance of a CompositeNotebookManager.
    """
    super(CompositeNotebookManager, self).__init__(**kwargs)
    self._name = name
    self._notebook_lists = {}
    self._dirs = []

  def add_notebook_list(self, notebook_list, name=''):
    self._notebook_lists[name] = notebook_list
    if len(name) != 0:
      self._dirs.append(name)

  @property
  def notebook_dir(self):
    return None

  def info_string(self):
    return 'Serving notebooks via the %s notebook manager.' % self._name

  def path_exists(self, path):
    """Checks if the specified path exists.
    """
    notebook_list = self._get_notebook_list(path)
    return notebook_list is not None

  def is_hidden(self, path):
    """Checks if the path corresponds to a hidden directory.
    """
    # No hidden directories semantics.
    return False

  def notebook_exists(self, name, path=''):
    """Checks if the specified notebook exists.
    """
    notebook_list = self._get_notebook_list(path)
    if notebook_list is None:
      return False
    return notebook_list.file_exists(name)

  def list_dirs(self, path=''):
    """Retrieves the list of sub-directories.
    """
    # No nested sub-directories
    if path != '':
      return []

    return map(lambda dir: self.get_dir_model(dir), sorted(self._dirs))

  def get_dir_model(self, name, path=''):
    """Retrieves information about the specified directory path.
    """
    notebook_list = self._get_notebook_list(path)
    if notebook_list is None:
      return None

    return {'type': 'directory', 'name': name, 'path': path}

  def list_notebooks(self, path=''):
    """Retrieves the list of notebooks contained in the specified path.
    """
    notebook_list = self._get_notebook_list(path)
    if notebook_list is None:
      return []

    names = sorted(notebook_list.list_files())
    return map(lambda name: self.get_notebook(name, path, content=False), names)

  def get_notebook(self, name, path='', content=True):
    """Retrieves information about the specified notebook.
    """
    notebook_list = self._get_notebook_list(path)
    if notebook_list is None:
      return None

    notebook = notebook_list.read_file(name, content)
    if notebook is None:
      raise Exception('The notebook could not be read. It may no longer exist.')

    data_content = None
    if content:
      with _io.StringIO(notebook.data) as stream:
        data_content = _NotebookFormat.read(stream, u'json')
        self.mark_trusted_cells(data_content, path, name)

    return self._create_notebook_model(name, path, notebook.timestamp, data_content)

  def save_notebook(self, model, name, path=''):
    """Saves the notebook represented by the specified model object.
    """
    notebook_list = self._get_notebook_list(path)
    if notebook_list is None:
      return None

    new_name = model.get('name', name)
    if new_name != name:
      # Name has changed, so delete the old entry. The new entry will be created as part of
      # updating the map with the new notebook.
      del self._notebook_lists[name]

    with _io.StringIO() as stream:
      content = _NotebookFormat.to_notebook_json(model['content'])
      self.check_and_sign(content, new_name, path)
      _NotebookFormat.write(content, stream, u'json')

      data = stream.getvalue()

    timestamp = model.get('last_modified', _dt.datetime.utcnow())
    notebook = Notebook(new_name, timestamp, data)

    saved = notebook_list.write_file(notebook)
    if not saved:
      raise Exception('There was an error saving the notebook.')

    return self._create_notebook_model(new_name, path, timestamp, data)

  def update_notebook(self, model, name, path=''):
    """Updates the notebook represented by the specified model object.
    """
    notebook_list = self._get_notebook_list(path)
    if notebook_list is None:
      return None

    new_name = model['name']
    notebook = notebook_list.rename_file(name, new_name)

    if notebook is None:
      raise Exception('The notebook could not be renamed. The name might already be in use.')
    else:
      return self._create_notebook_model(new_name, path, notebook.timestamp)

  def delete_notebook(self, name, path=''):
    """Deletes the specified notebook.
    """
    notebook_list = self._get_notebook_list(path)
    if notebook_list is None:
      return

    deleted = notebook_list.delete_file(name)
    if not deleted:
      raise Exception('The specified notebook could not be deleted. It may no longer exist.')

  def create_checkpoint(self, name, path=''):
    """Creates a save checkpoint."""
    # This is really meant to be a no-op implementation, but returning a valid checkpoint
    # avoids the seemingly benign error that shows up in verbose debug logs if one isn't
    # created/returned. The returned checkpoint is ID'd with an arbitrary but fixed name,
    # so it can also be returned when listing checkpoints.
    return {'id': 'current'}

  def list_checkpoints(self, name, path=''):
    """Retrieves the list of previously saved checkpoints."""
    # This is really meant to be be a no-op implementation, but returns the
    # checkpoint that create_checkpoint pretended to have created.
    return [{'id': 'current'}]

  def restore_checkpoint(self, checkpoint_id, name, path=''):
    """Restores a previously saved checkpoint."""
    # No-op as this implementation does not support checkpoints.
    pass

  def delete_checkpoint(self, checkpoint_id, name, path=''):
    """Deletes a previously saved checkpoint."""
    # No-op as this implementation does not support checkpoints.
    pass

  def _create_notebook_model(self, name, path, timestamp, content=None):
    model = {'type': 'notebook',
             'path': path,
             'name': name,
             'created': timestamp,
             'last_modified': timestamp
    }
    if content is not None:
      model['content'] = content
    return model

  def _get_notebook_list(self, path):
    # Strip out the leading / that IPython adds
    if (len(path) != 0) and (path[0] == '/'):
      path = path[1:]

    return self._notebook_lists.get(path, None)


class DataLabNotebookManager(CompositeNotebookManager):
  """Implements the notebook manager used in DataLab.

  This works against three notebook locations.
  - A GCS location of the form gs://project_id-datalab/notebooks
  - A container /docs directory
  - A mounted /nb directory when the running the container locally
  """

  def __init__(self, **kwargs):
    """Initializes an instance of a DataLabNotebookManager.
    """
    super(DataLabNotebookManager, self).__init__('DataLab', **kwargs)

    bucket = DataLabNotebookManager._create_bucket()
    self.add_notebook_list(StorageNotebookList(bucket, prefix='notebooks/'), '')
    self.add_notebook_list(LocalNotebookList('/datalab/docs'), 'docs')
    if os.environ.get('DATALAB_ENV', '') == 'local':
      self.add_notebook_list(LocalNotebookList('/nb'), 'local')

  @staticmethod
  def _create_bucket():
    # Use the project id to construct a valid bucket name (as predictably unique
    # as we can make it). Some caveats:
    # - The name cannot contain 'google'
    # - Project ids maybe domain-qualified, eg. foo.com:bar
    project_id = _gcp.Context.default().project_id
    project_id = project_id.replace('google.com', 'gcom').replace(':', '-').replace('.', '-')
    bucket_name = project_id + '-datalab'

    buckets = _storage.Buckets()
    if not buckets.contains(bucket_name):
      return buckets.create(bucket_name)
    else:
      return _storage.Bucket(bucket_name)
