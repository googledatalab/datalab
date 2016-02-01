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

"""Implements DataSet, and related DataSet BigQuery APIs."""

import gcp
import gcp._util
import _api
import _table
import _utils
import _view


class DataSet(object):
  """Represents a list of BigQuery tables in a dataset."""

  def __init__(self, name, context=None):
    """Initializes an instance of a DataSet.

    Args:
      name: the name of the dataset, as a string or (project_id, dataset_id) tuple.
      context: an optional Context object providing project_id and credentials. If a specific
          project id or credentials are unspecified, the default ones configured at the global
          level are used.
    Raises:
      Exception if the name is invalid.
      """
    if context is None:
      context = gcp.Context.default()
    self._context = context
    self._api = _api.Api(context)
    self._name_parts = _utils.parse_dataset_name(name, self._api.project_id)
    self._full_name = '%s:%s' % self._name_parts
    self._info = None
    try:
      self._info = self._get_info()
    except gcp._util.RequestException:
      pass

  @property
  def name(self):
    """The DataSetName named tuple (project_id, dataset_id) for the dataset."""
    return self._name_parts

  @property
  def description(self):
    """The description of the dataset, if any.

    Raises:
      Exception if the dataset exists but the metadata for the dataset could not be retrieved.
    """
    self._get_info()
    return self._info['description'] if self._info else None

  @property
  def friendly_name(self):
    """The friendly name of the dataset, if any.

    Raises:
      Exception if the dataset exists but the metadata for the dataset could not be retrieved.
    """
    self._get_info()
    return self._info['friendlyName'] if self._info else None

  def _get_info(self):
    try:
      if self._info is None:
        self._info = self._api.datasets_get(self._name_parts)
      return self._info
    except gcp._util.RequestException as e:
      if e.status == 404:
        return None
      raise e
    except Exception as e:
      raise e

  def exists(self):
    """ Checks if the dataset exists.

    Returns:
      True if the dataset exists; False otherwise.
    Raises:
      Exception if the dataset exists but the metadata for the dataset could not be retrieved.
    """
    self._get_info()
    return self._info is not None

  def delete(self, delete_contents=False):
    """Issues a request to delete the dataset.

    Args:
      delete_contents: if True, any tables and views in the dataset will be deleted. If False
          and the dataset is non-empty an exception will be raised.
    Returns:
      None on success.
    Raises:
      Exception if the delete fails (including if table was nonexistent).
    """
    if not self.exists():
      raise Exception('Cannot delete non-existent dataset %s' % self._full_name)
    try:
      self._api.datasets_delete(self._name_parts, delete_contents=delete_contents)
    except Exception as e:
      raise e
    self._info = None
    return None

  def create(self, friendly_name=None, description=None):
    """Creates the Dataset with the specified friendly name and description.

    Args:
      friendly_name: (optional) the friendly name for the dataset if it is being created.
      description: (optional) a description for the dataset if it is being created.
    Returns:
      The DataSet.
    Raises:
      Exception if the DataSet could not be created.
    """
    if not self.exists():
      try:
        response = self._api.datasets_insert(self._name_parts,
                                             friendly_name=friendly_name,
                                             description=description)
      except Exception as e:
        raise e
      if 'selfLink' not in response:
        raise Exception("Could not create dataset %s" % self._full_name)
    return self

  def update(self, friendly_name=None, description=None):
    """ Selectively updates DataSet information.

    Args:
      friendly_name: if not None, the new friendly name.
      description: if not None, the new description.

    Returns:
    """
    self._get_info()

    if self._info:
      if friendly_name:
        self._info['friendlyName'] = friendly_name
      if description:
        self._info['description'] = description
      try:
        self._api.datasets_update(self._name_parts, self._info)
      except Exception as e:
        raise e
      finally:
        self._info = None  # need a refresh

  def _retrieve_items(self, page_token, item_type):
    try:
      list_info = self._api.tables_list(self._name_parts, page_token=page_token)
    except Exception as e:
      raise e

    tables = list_info.get('tables', [])
    contents = []
    if len(tables):
      try:
        for info in tables:
          if info['type'] != item_type:
            continue
          if info['type'] == 'TABLE':
            item = _table.Table((info['tableReference']['projectId'],
                                 info['tableReference']['datasetId'],
                                 info['tableReference']['tableId']), self._context)
          else:
            item = _view.View((info['tableReference']['projectId'],
                               info['tableReference']['datasetId'],
                               info['tableReference']['tableId']), self._context)
          contents.append(item)
      except KeyError:
        raise Exception('Unexpected item list response')

    page_token = list_info.get('nextPageToken', None)
    return contents, page_token

  def _retrieve_tables(self, page_token, _):
    return self._retrieve_items(page_token=page_token, item_type='TABLE')

  def _retrieve_views(self, page_token, _):
    return self._retrieve_items(page_token=page_token, item_type='VIEW')

  def tables(self):
    """ Returns an iterator for iterating through the Tables in the dataset. """
    return iter(gcp._util.Iterator(self._retrieve_tables))

  def views(self):
    """ Returns an iterator for iterating through the Views in the dataset. """
    return iter(gcp._util.Iterator(self._retrieve_views))

  def __iter__(self):
    """ Returns an iterator for iterating through the Tables in the dataset. """
    return self.tables()

  def __str__(self):
    """Returns a string representation of the dataset using its specified name.

    Returns:
      The string representation of this object.
    """
    return self._full_name

  def __repr__(self):
    """Returns a representation for the dataset for showing in the notebook.
    """
    return 'DataSet %s' % self._full_name


class DataSets(object):
  """ Iterator class for enumerating the datasets in a project. """

  def __init__(self, project_id=None, context=None):
    """ Initialize the DataSetLister.

    Args:
      project_id: the ID of the project whose datasets you want to list. If None defaults
          to the project in the context.
      context: an optional Context object providing project_id and credentials. If a specific
          project id or credentials are unspecified, the default ones configured at the global
          level are used.
    """
    if context is None:
      context = gcp.Context.default()
    self._context = context
    self._api = _api.Api(context)
    self._project_id = project_id if project_id else self._api.project_id

  def _retrieve_datasets(self, page_token, count):
    try:
      list_info = self._api.datasets_list(self._project_id, page_token=page_token)
    except Exception as e:
      raise e

    datasets = list_info.get('datasets', [])
    if len(datasets):
      try:
        datasets = [DataSet((info['datasetReference']['projectId'],
                             info['datasetReference']['datasetId']), self._context)
                    for info in datasets]
      except KeyError:
        raise Exception('Unexpected response from server.')

    page_token = list_info.get('nextPageToken', None)
    return datasets, page_token

  def __iter__(self):
    """ Returns an iterator for iterating through the DataSets in the project.
    """
    return iter(gcp._util.Iterator(self._retrieve_datasets))
