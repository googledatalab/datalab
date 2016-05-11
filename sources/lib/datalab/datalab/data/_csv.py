# Copyright 2016 Google Inc. All rights reserved.
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

"""Implements usefule CSV utilities."""


import csv
import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer
import yaml

import datalab.storage


_MAX_CSV_BYTES = 10000000


class Csv(object):
  """Represents a CSV file in GCS or locally with same schema.
  """

  def __init__(self, path):
    """Initializes an instance of a Csv instance.

    Args:
      path: path of the Csv file.
    """
    self._path = path

  @property
  def path(self):
    return self._path

  @staticmethod
  def _read_gcs_lines(path, max_lines=None):
    return datalab.storage.Item.from_url(path).read_lines(max_lines)

  @staticmethod
  def _read_local_lines(path, max_lines=None):
    lines = []
    for line in open(path).xreadlines():
      if max_lines is not None and len(lines) >= max_lines:
        break
      lines.append(line)
    return lines

  @staticmethod
  def _isfloat(value):
    try:
      float(value)
      return True
    except ValueError:
      return False

  @staticmethod
  def _infertype(values, max_labels):
    if all(Csv._isfloat(e) for e in values):
      return 'numeric', None
    _, labels = pd.factorize(values)
    if len(labels) == len(values) and all(len(e) < 30 for e in values):
      return 'id', None
    if any(len(e) > 50 for e in values) or len(labels) > max_labels:
      vectorizer = CountVectorizer(min_df=1, token_pattern='\\b\\w+\\b')
      vectorizer.fit(values)
      return 'text', {'vocabulary': len(vectorizer.vocabulary_)}
    return 'categorical', {'labels': labels.tolist()}

  def browse(self, max_lines, headers):
    """Try reading specified number of lines from the CSV object.

    Args:
      max_lines: max number of lines to read
      headers: a list of strings as column names. If None, it will use "col0, col1..."
    Returns:
      A 2-D array which is the content of the CSV but all values are string type.
    Raises:
      Exception if the csv object cannot be read or not enough lines to read, or the
      headers size does not match columns size.
    """
    if self.path.startswith('gs://'):
      lines = Csv._read_gcs_lines(self.path, max_lines)
    else:
      lines = Csv._read_local_lines(self.path, max_lines)

    if len(lines) == 0:
      return []
    columns_size = len(csv.reader([lines[0]]).next())
    if headers is None:
      headers = ['col' + str(e) for e in range(columns_size)]
    if len(headers) != columns_size:
      raise Exception('Number of columns in CSV do not match number of headers')

    content = []
    reader = csv.DictReader(lines, fieldnames=headers)
    for row in reader:
      content.append(row)
    return content

  def infer_schema(self, num_lines, max_categorical_labels, headers):
    """Infer schema from the CSV object.

    Args:
      num_lines: number of lines to read to infer schema from.
      max_categorical_labels: if a certain string column includes more unique labels than it, then
          consider it a text column. Otherwise, consider it a categorical column.
      headers: a list of strings as column names. If None, it will use "col0, col1..."
    Returns:
      A list of inferred types and their details for each column
    Raises:
      Exception if the csv object cannot be read or not enough lines to read, or the
      headers size does not match columns size.
    """
    columns = []
    df = pd.DataFrame(self.browse(num_lines, headers))
    for col in df:
      column = df[col]
      dtype, description = self._infertype(column.values, max_categorical_labels)
      entry = {
          'name': column.name,
          'type': dtype
      }
      if description is not None:
        entry.update(description)
      columns.append(entry)
    return columns
