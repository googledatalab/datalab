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

"""Implements DataSet, and related DataSet BigQuery APIs."""

import collections
import re
from gcp._util import Iterator as _Iterator
from ._table import Table as _Table

DataSetName = collections.namedtuple('DataSetName', ['project_id', 'dataset_id'])


class DataSet(object):
  """Represents a list of BigQuery tables in a dataset."""

  # Absolute project-qualified name pattern: <project>:<dataset>
  _ABS_NAME_PATTERN = r'^([a-z0-9\-_\.:]+)\:([a-zA-Z0-9_]+)$'

  # Relative name pattern: <dataset>
  _REL_NAME_PATTERN = r'^([a-zA-Z0-9_]+)$'

  @staticmethod
  def _parse_name(name, project_id=None):
    """Parses a dataset name into its individual parts.

    Args:
      name: the name to parse, or a tuple, dictionary or array containing the parts.
      project_id: the expected project ID. If the name does not contain a project ID,
          this will be used; if the name does contain a project ID and it does not match
          this, an exception will be thrown.
    Returns:
      The DataSetName for the dataset.
    Raises:
      Exception: raised if the name doesn't match the expected formats.
    """
    _project_id = _dataset_id = None
    if isinstance(name, basestring):
      # Try to parse as absolute name first.
      m = re.match(DataSet._ABS_NAME_PATTERN, name, re.IGNORECASE)
      if m is not None:
        _project_id, _dataset_id = m.groups()
      else:
        # Next try to match as a relative name implicitly scoped within current project.
        m = re.match(DataSet._REL_NAME_PATTERN, name)
        if m is not None:
          groups = m.groups()
          _dataset_id = groups[0]
    else:
      # Try treat as a dictionary or named tuple
      try:
        _dataset_id = name.dataset_id
        _project_id = name.project_id
      except AttributeError:
        if len(name) == 2:
          # Treat as a tuple or array.
          _project_id, _dataset_id = name
    if not _dataset_id:
      raise Exception('Invalid dataset name: ' + str(name))
    if not _project_id:
      _project_id = project_id

    return DataSetName(_project_id, _dataset_id)

  def __init__(self, api, name):
    """Initializes an instance of a DataSet.

    Args:
      api: the BigQuery API object to use to issue requests. The project ID will be inferred from
          this.
      name: the name of the dataset, as a string or (project_id, dataset_id) tuple.
    """
    self._api = api
    self._name_parts = DataSet._parse_name(name, api.project_id)
    self._full_name = '%s:%s' % self._name_parts

  @property
  def full_name(self):
    """The full name for the dataset."""
    return self._full_name

  @property
  def name(self):
    """The DataSetName for the dataset."""
    return self._name_parts

  def exists(self):
    """ Checks if the dataset exists.

    Args:
      None
    Returns:
      True if the dataset exists; False otherwise.
    """
    try:
      _ = self._api.datasets_get(self._name_parts)
    except Exception as e:
      if (len(e.args[0]) > 1) and (e.args[0][1] == 404):
        return False
      raise e
    return True

  def delete(self, delete_contents=False):
    """Issues a request to delete the dataset.

    Args:
      delete_contents: if True, any tables in the dataset will be deleted. If False and the
          dataset is non-empty an exception will be raised.
    Returns:
      None on success.
    Raises:
      Exception if the delete fails (including if table was nonexistent).
    """
    if not self.exists():
      raise Exception('Cannot delete non-existent table %s' % self._full_name)
    self._api.datasets_delete(self._name_parts, delete_contents=delete_contents)
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
      response = self._api.datasets_insert(self._name_parts,
                                           friendly_name=friendly_name,
                                           description=description)
      if 'selfLink' not in response:
        raise Exception("Could not create dataset %s.%s" % self.full_name)
    return self

  def _retrieve_tables(self, page_token, count):
    list_info = self._api.tables_list(self._name_parts, page_token=page_token)

    tables = list_info.get('tables', [])
    if len(tables):
      try:
        tables = [_Table(self._api, (self._name_parts.project_id, self._name_parts.dataset_id,
                                    info['tableReference']['tableId'])) for info in tables]
      except KeyError:
        raise Exception('Unexpected item list response.')

    page_token = list_info.get('nextPageToken', None)
    return tables, page_token

  def __iter__(self):
    """ Supports iterating through the Tables in the dataset.
    """
    return iter(_Iterator(self._retrieve_tables))

  def __repr__(self):
    """Returns an empty representation for the dataset for showing in the notebook.
    """
    return ''


class DataSetLister(object):
  """ Helper class for enumerating the datasets in a project.
  """

  def __init__(self, api, project_id=None):
    self._api = api
    self._project_id = project_id if project_id else api.project_id

  def _retrieve_datasets(self, page_token, count):
    list_info = self._api.datasets_list(self._project_id, page_token=page_token)

    datasets = list_info.get('datasets', [])
    if len(datasets):
      try:
        datasets = [DataSet(self._api,
                            (self._project_id, info['datasetReference']['datasetId']))
                    for info in datasets]
      except KeyError:
        raise Exception('Unexpected item list response.')

    page_token = list_info.get('nextPageToken', None)
    return datasets, page_token

  def __iter__(self):
    """ Supports iterating through the DataSets in the project.
    """
    return iter(_Iterator(self._retrieve_datasets))

