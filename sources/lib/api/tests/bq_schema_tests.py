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

import collections
import unittest
import gcp
import gcp.bigquery
import gcp._util
import mock
import pandas


class TestCases(unittest.TestCase):

  def test_schema_from_dataframe(self):
    df = self._create_data_frame()
    result = gcp.bigquery.Schema.from_data(df)
    self.assertEqual(gcp.bigquery.Schema.from_data(self._create_inferred_schema()), result)

  def test_schema_from_data(self):
    variant1 = [
      3,
      2.0,
      True,
      ['cow', 'horse', [0, []]]
    ]
    variant2 = collections.OrderedDict()
    variant2['Column1'] = 3
    variant2['Column2'] = 2.0
    variant2['Column3'] = True
    variant2['Column4'] = collections.OrderedDict()
    variant2['Column4']['Column1'] = 'cow'
    variant2['Column4']['Column2'] = 'horse'
    variant2['Column4']['Column3'] = collections.OrderedDict()
    variant2['Column4']['Column3']['Column1'] = 0
    variant2['Column4']['Column3']['Column2'] = collections.OrderedDict()

    master = [
      {'name': 'Column1', 'type': 'INTEGER'},
      {'name': 'Column2', 'type': 'FLOAT'},
      {'name': 'Column3', 'type': 'BOOLEAN'},
      {'name': 'Column4', 'type': 'RECORD', 'fields': [
          {'name': 'Column1', 'type': 'STRING'},
          {'name': 'Column2', 'type': 'STRING'},
          {'name': 'Column3', 'type': 'RECORD', 'fields': [
              {'name': 'Column1', 'type': 'INTEGER'},
              {'name': 'Column2', 'type': 'RECORD', 'fields': []}
          ]}
      ]}
    ]

    schema_master = gcp.bigquery.Schema(master)

    with self.assertRaises(Exception) as error1:
      _ = gcp.bigquery.Schema.from_data(variant1)
    self.assertEquals('Cannot create a schema from heterogeneous list [3, 2.0, True, ' +
                      '[\'cow\', \'horse\', [0, []]]]; perhaps you meant to use ' +
                      'Schema.from_record?', error1.exception[0])
    with self.assertRaises(Exception) as error2:
      _ = gcp.bigquery.Schema.from_data(variant2)
    self.assertEquals('Cannot create a schema from dict OrderedDict([(\'Column1\', 3), ' +
                      '(\'Column2\', 2.0), (\'Column3\', True), (\'Column4\', ' +
                      'OrderedDict([(\'Column1\', \'cow\'), (\'Column2\', \'horse\'), ' +
                      '(\'Column3\', OrderedDict([(\'Column1\', 0), (\'Column2\', ' +
                      'OrderedDict())]))]))]); perhaps you meant to use Schema.from_record?',
                      error2.exception[0])
    schema3 = gcp.bigquery.Schema.from_data([variant1])
    schema4 = gcp.bigquery.Schema.from_data([variant2])
    schema5 = gcp.bigquery.Schema.from_data(master)
    schema6 = gcp.bigquery.Schema.from_record(variant1)
    schema7 = gcp.bigquery.Schema.from_record(variant2)

    self.assertEquals(schema_master, schema3, 'schema inferred from list of lists with from_data')
    self.assertEquals(schema_master, schema4, 'schema inferred from list of dicts with from_data')
    self.assertEquals(schema_master, schema5, 'schema inferred from BQ schema list with from_data')
    self.assertEquals(schema_master, schema6, 'schema inferred from list with from_record')
    self.assertEquals(schema_master, schema7, 'schema inferred from dict with from_record')

  def _create_data_frame(self):
    data = {
      'some': [
        0, 1, 2, 3
      ],
      'column': [
        'r0', 'r1', 'r2', 'r3'
      ],
      'headers': [
        10.0, 10.0, 10.0, 10.0
      ]
    }
    return pandas.DataFrame(data)

  def _create_inferred_schema(self, extra_field=None):
    schema = [
      {'name': 'some', 'type': 'INTEGER'},
      {'name': 'column', 'type': 'STRING'},
      {'name': 'headers', 'type': 'FLOAT'},
    ]
    if extra_field:
      schema.append({'name': extra_field, 'type': 'INTEGER'})
    return schema
