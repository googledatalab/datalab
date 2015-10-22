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

"""Implemenents External Table functionality."""

import gcp
import _api
import _csv_options
import _job


class FederatedTable(object):

  @staticmethod
  def from_storage(source, source_format='csv', csv_options=None, ignore_unknown_values=False,
                   max_bad_records=0, compressed=False, schema=None):

    """ Create an external table for a GCS object.

    Args:
      source: the URL of the source objects(s). Can include a wildcard '*' at the end of the item
         name. Can be a single source or a list.
      source_format: the format of the data, 'csv' or 'json'; default 'csv'.
      csv_options: For CSV files, the options such as quote character and delimiter.
      ignore_unknown_values: If True, accept rows that contain values that do not match the schema;
          the unknown values are ignored (default False).
      max_bad_records The maximum number of bad records that are allowed (and ignored) before
          returning an 'invalid' error in the Job result (default 0).
      compressed: whether the data is GZ compressed or not (default False). Note that compressed
          data can be used as a federated table but cannot be loaded into a BQ Table.
      schema: the schema of the data. This is required for this table to be used as a federated
          table or to be loaded using a Table object that itself has no schema (default None).

  """
    result = FederatedTable()
    # Do some sanity checking and concert some params from friendly form to form used by BQ.
    if source_format == 'csv':
      result._bq_source_format = 'CSV'
      if csv_options is None:
        csv_options = _csv_options.CSVOptions()  # use defaults
    elif source_format == 'json':
      if csv_options:
        raise Exception('CSV options are not support for JSON tables')
      result._bq_source_format = 'NEWLINE_DELIMITED_JSON'
    else:
      raise Exception("Invalid source format %s" % source_format)

    result._source = source if isinstance(source, list) else [source]
    result._source_format = source_format
    result._csv_options = csv_options
    result._ignore_unknown_values = ignore_unknown_values
    result._max_bad_records = max_bad_records
    result._compressed = compressed
    result._schema = schema
    return result

  def __init__(self):

    """ Create an external table reference. Do not call this directly; use factory method(s). """
    # Do some sanity checking and concert some params from friendly form to form used by BQ.
    self._bq_source_format = None
    self._source = None
    self._source_format = None
    self._csv_options = None
    self._ignore_unknown_values = None
    self._max_bad_records = None
    self._compressed = None
    self._schema = None

  @property
  def schema(self):
    return self._schema

  def _to_query_json(self):
    """ Return the table as a dictionary to be used as JSON in a query job. """
    json = {
      'compression': 'GZIP' if self._compressed else 'NONE',
      'ignoreUnknownValues': self._ignore_unknown_values,
      'maxBadRecords': self._max_bad_records,
      'sourceFormat': self._bq_source_format,
      'sourceUris': self._source,
    }
    if self._source_format == 'csv' and self._csv_options:
      json['csvOptions'] = {}
      json['csvOptions'].update(self._csv_options._to_query_json())
    if self._schema:
      json['schema'] = {'fields': self._schema._bq_schema}
    return json

