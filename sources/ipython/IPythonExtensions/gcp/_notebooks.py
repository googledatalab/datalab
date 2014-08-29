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
import json as _json
import gcp as _gcp
import gcp.storage as _storage
from IPython.html.services.notebooks.nbmanager import NotebookManager as _NotebookManager
from IPython.nbformat import current as _NotebookFormat


class Notebook(object):
  """Information about a notebook."""

  def __init__(self, name, timestamp, data):
    self.name = name
    self.timestamp = timestamp
    self.data = data


class SimpleNotebookManager(_NotebookManager):
  """Base class for simple notebook managers that support a flat list of notebooks."""

  def __init__(self, name, **kwargs):
    """Initializes an instance of a TransientNotebookManager.
    """
    super(SimpleNotebookManager, self).__init__(**kwargs)
    self._name = name

  @property
  def notebook_dir(value):
    pass

  def info_string(self):
    return 'Serving notebooks via the %s notebook manager.' % self._name

  def path_exists(self, path):
    """Checks if the specified path exists.
    """
    # Return true for the top-level path only, since this notebook manager doesn't support
    # nested paths.
    return path == ''

  def is_hidden(self, path):
    """Checks if the path corresponds to a hidden directory.
    """
    # No hidden directories semantics.
    return False

  def notebook_exists(self, name, path=''):
    """Checks if the specified notebook exists.
    """
    if path != '':
      return False
    return self._file_exists(name)

  def list_dirs(self, path):
    """Retrieves the list of sub-directories.
    """
    # Return an empty list, since this notebook manager doesn't support nested paths.
    return []

  def get_dir_model(self, path=''):
    """Retrieves information about the specified directory path.
    """
    if path != '':
      return None

    return {'type': 'directory', 'name': '', 'path': ''}

  def list_notebooks(self, path=''):
    """Retrieves the list of notebooks contained in the specified path.
    """
    if path != '':
      return []

    names = sorted(self._list_files())
    return map(lambda name: self.get_notebook(name, path, content=False), names)

  def get_notebook(self, name, path='', content=True):
    """Retrieves information about the specified notebook.
    """
    if path != '':
      return None

    notebook = self._read_file(name, content)
    if notebook is None:
      raise Exception('The notebook could not be read. It may no longer exist.')

    data_content = None
    if content:
      with _io.StringIO(notebook.data) as stream:
        data_content = _NotebookFormat.read(stream, u'json')
        self.mark_trusted_cells(data_content, path, name)

    return self._create_notebook_model(name, notebook.timestamp, data_content)

  def save_notebook(self, model, name, path=''):
    """Saves the notebook represented by the specified model object.
    """
    if path != '':
      return None

    new_name = model.get('name', name)
    if new_name != name:
      # Name has changed, so delete the old entry. The new entry will be created as part of
      # updating the map with the new notebook.
      del self._notebooks[name]

    data = ''
    with _io.StringIO() as stream:
      content = _NotebookFormat.to_notebook_json(model['content'])
      self.check_and_sign(content, new_name, path)
      _NotebookFormat.write(content, stream, u'json')

      data = stream.getvalue()

    timestamp = model.get('last_modified', _dt.datetime.utcnow())
    notebook = Notebook(new_name, timestamp, data)

    saved = self._write_file(notebook)
    if not saved:
      raise Exception('There was an error saving the notebook.')

    return self._create_notebook_model(new_name, timestamp, data)

  def update_notebook(self, model, name, path=''):
    """Updates the notebook represented by the specified model object.
    """
    if path != '':
      return None

    new_name = model['name']
    notebook = self._rename_file(name, new_name)

    if notebook is None:
      raise Exception('The notebook could not be renamed. The name might already be in use.')
    else:
      return self._create_notebook_model(new_name, notebook.timestamp)

  def delete_notebook(self, name, path=''):
    """Deletes the specified notebook.
    """
    if path != '':
      return
    deleted = self._delete_file(name)
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

  def _create_notebook_model(self, name, timestamp, content=None):
    model = {'type': 'notebook',
             'path': '',
             'name': name,
             'created': timestamp,
             'last_modified': timestamp
            }
    if content is not None:
      model['content'] = content
    return model

  def _list_files(self):
    raise NotImplementedError('Must be implemented in a derived class.')

  def _file_exists(self, name):
    raise NotImplementedError('Must be implemented in a derived class.')

  def _read_file(self, name, read_content):
    raise NotImplementedError('Must be implemented in a derived class.')

  def _write_file(self, notebook):
    raise NotImplementedError('Must be implemented in a derived class.')

  def _rename_file(self, name, new_name):
    raise NotImplementedError('Must be implemented in a derived class.')

  def _delete_file(self, name):
    raise NotImplementedError('Must be implemented in a derived class.')


class MemoryNotebookManager(SimpleNotebookManager):
  """Implements a simple in-memory notebook manager."""

  def __init__(self, **kwargs):
    """Initializes an instance of a TransientNotebookManager.
    """
    super(MemoryNotebookManager, self).__init__('in-memory', **kwargs)
    self._notebooks = {}

  def _list_files(self):
    return self._notebooks.keys()

  def _file_exists(self, name):
    return name in self._notebooks

  def _read_file(self, name, read_content):
    return self._notebooks.get(name, None)

  def _write_file(self, notebook):
    self._notebooks[notebook.name] = notebook
    return True

  def _rename_file(self, name, new_name):
    notebook = self._notebooks.get(name, None)
    if notebook is None:
      return None

    if new_name in self._notebooks:
      return None

    notebook.name = new_name
    self._notebooks[new_name] = notebook
    del self._notebooks[name]

    return notebook

  def _delete_file(self, name):
    if name in self._notebooks:
      del self._notebooks[name]
      return True
    return False


class StorageNotebookManager(SimpleNotebookManager):
  """Implements a simple cloud storage backed notebook manager.

  This works against a fixed bucket named <project_id>-notebooks, since we don't really
  have the opportunity to ask the user for a specific bucket. This pattern of using
  project id-based names seems like an established pattern. Given the bucket names need
  to be globally unique this builds on assumption that one cloud project is unlikely to
  to have names such as <some other project id>-notebooks. Ideally buckets would have
  been project scoped.

  This class manages the list of notebook as a cached set of items. The cache is updated
  each time notebooks are listed (which happens each time the list page becomes active).

  Operations such as checking for existence work against this cache (which is used
  as part of finding an unused number when creating a new notebook for example). The
  cache helps avoid creating a barrage of API calls to GCS.

  Operations such as save, rename, delete directly operate against GCS APIs, but update
  this cache as well. This is because the local list will only be updated when the list
  page is re-activated by the user. In the interim the list would be out-of-date.
  """

  def __init__(self, **kwargs):
    """Initializes an instance of a TransientNotebookManager.
    """
    super(StorageNotebookManager, self).__init__('cloud storage', **kwargs)
    self._bucket = None
    self._items = None

  def _ensure_bucket(self):
    if self._bucket is None:
      project_id = _gcp.Context.default().project_id
      bucket_name = project_id + '-notebooks'

      buckets = _storage.buckets()
      if not buckets.contains(bucket_name):
        self._bucket = buckets.create(bucket_name)
      else:
        self._bucket = _storage.bucket(bucket_name)

  def _ensure_items(self, update=False):
    self._ensure_bucket()
    if (self._items is None) or update:
      self._items = {}

      items = self._bucket.items(delimiter='/')
      for item in items:
        if item.key.endswith(self.filename_ext):
          self._items[item.key] = item

  def _find_item(self, name):
    self._ensure_items()
    return self._items.get(name, None)

  def _list_files(self):
    self._ensure_items(update=True)
    return map(lambda item: item.key, self._items.values())

  def _file_exists(self, name):
    return self._find_item(name) is not None

  def _read_file(self, name, read_content):
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

  def _write_file(self, notebook):
    creating_new_item = False

    item = self._find_item(notebook.name)
    if item is None:
      creating_new_item = True
      item = self._bucket.item(notebook.name)

    try:
      item.write_to(notebook.data, 'application/json')
    except Exception:
      return False

    if creating_new_item:
      # Update the local cache, as the item must exist in the cache for it to be successfully
      # retrieved in the subsequent read. This is because the list itself will be updated only
      # when the user returns to the list page, and the list is refreshed.
      self._items[item.key] = item
    else:
      item.timestamp = _dt.datetime.utcnow()
    return True

  def _rename_file(self, name, new_name):
    item = self._find_item(name)
    if item is None:
      return None

    if self._bucket.items().contains(new_name):
      return None

    try:
      new_item = item.copy_to(new_name)
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

  def _delete_file(self, name):
    item = self._find_item(name)
    if item is not None:
      try:
        item.delete()
      except Exception:
        return False

      del self._items[name]
      return True
    return False
