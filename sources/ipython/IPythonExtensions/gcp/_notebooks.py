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
from IPython.html.services.notebooks.nbmanager import NotebookManager as _NotebookManager
from IPython.nbformat import current as _NotebookFormat


class Notebook(object):
  """Information about a notebook."""

  def __init__(self, name, created_at, modified_at, data):
    self.name = name
    self.created_at = created_at
    self.modified_at = modified_at
    self.data = data


class SimpleNotebookManager(_NotebookManager):
  """Base class for simple notebook managers that support a flat list of notebooks."""

  def __init__(self, name, **kwargs):
    """Initializes an instance of a TransientNotebookManager.
    """
    super(SimpleNotebookManager, self).__init__(**kwargs)
    self._name = name
    self._created_at = _dt.datetime.utcnow()
    self._modified_at = self._created_at

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
    return self._check_file(name)

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

    return {'type': 'directory',
            'name': '',
            'path': '',
            'created': self._created_at,
            'last_modified': self._modified_at
           }

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

    notebook = self._read_file(name)
    if notebook is None:
      return None

    data_content = None
    if content:
      with _io.StringIO(notebook.data) as stream:
        data_content = _NotebookFormat.read(stream, u'json')
        self.mark_trusted_cells(data_content, path, name)

    return self._create_notebook_model(name, notebook.created_at, notebook.modified_at,
                                       data_content)

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

    created = model.get('created', _dt.datetime.utcnow())
    last_modified = model.get('last_modified', _dt.datetime.utcnow())
    notebook = Notebook(new_name, created, last_modified, data)

    self._write_file(notebook)
    self._modified_at = notebook.modified_at

    return self._create_notebook_model(new_name, created, last_modified)

  def update_notebook(self, model, name, path=''):
    """Updates the notebook represented by the specified model object.
    """
    if path != '':
      return None

    new_name = model['name']
    notebook = self._rename_file(name, new_name)

    if notebook is not None:
      self._modified_at = _dt.datetime.utcnow()
      return self._create_notebook_model(new_name, notebook.created_at, notebook.modified_at)
    else:
      return None

  def delete_notebook(self, name, path=''):
    """Deletes the specified notebook.
    """
    if path != '':
      return
    self._delete_file(name)

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

  def _create_notebook_model(self, name, created, last_modified, content=None):
    model = {'type': 'notebook',
             'path': '',
             'name': name,
             'created': created,
             'last_modified': last_modified
            }
    if content is not None:
      model['content'] = content
    return model

  def _list_files(self):
    raise NotImplementedError('Must be implemented in a derived class.')

  def _check_file(self, name):
    raise NotImplementedError('Must be implemented in a derived class.')

  def _read_file(self, name):
    raise NotImplementedError('Must be implemented in a derived class.')

  def _write_file(self, notebook):
    raise NotImplementedError('Must be implemented in a derived class.')

  def _rename_file(self, name, new_name):
    raise NotImplementedError('Must be implemented in a derived class.')

  def _delete_file(self, name):
    raise NotImplementedError('Must be implemented in a derived class.')


class TransientNotebookManager(SimpleNotebookManager):
  """Implements a simple in-memory notebook manager."""

  def __init__(self, **kwargs):
    """Initializes an instance of a TransientNotebookManager.
    """
    super(TransientNotebookManager, self).__init__('in-memory', **kwargs)
    self._notebooks = {}

  def _list_files(self):
    return self._notebooks.keys()

  def _check_file(self, name):
    return self._notebooks.has_key(name)

  def _read_file(self, name):
    return self._notebooks.get(name, None)

  def _write_file(self, notebook):
    self._notebooks[notebook.name] = notebook

  def _rename_file(self, name, new_name):
    notebook = self._notebooks.get(name, None)
    if notebook is None:
      return None

    notebook.name = new_name
    self._notebooks[new_name] = notebook
    del self._notebooks[name]

    return notebook

  def _delete_file(self, name):
    if name in self._notebooks:
      del self._notebooks[name]
