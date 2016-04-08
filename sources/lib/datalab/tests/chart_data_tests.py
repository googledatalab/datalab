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

import json
import mock
import unittest

# import Python so we can mock the parts we need to here.
import IPython
import IPython.core


def noop_decorator(func):
  return func

IPython.core.magic.register_line_cell_magic = noop_decorator
IPython.core.magic.register_line_magic = noop_decorator
IPython.core.magic.register_cell_magic = noop_decorator
IPython.core.display.HTML = lambda x: x
IPython.core.display.JSON = lambda x: x

import gcp.datalab
import gcp.ml


class TestCases(unittest.TestCase):

  @mock.patch('gcp._util.get_item')
  def test_get_chart_data(self, mock_get_item):
    t = [
        {'country': 'US', 'quantity': 100},
        {'country': 'ZA', 'quantity': 50},
        {'country': 'UK', 'quantity': 75},
        {'country': 'AU', 'quantity': 25}
    ]
    mock_get_item.return_value = t
    ds = gcp.datalab._utils.get_data_source_index('t')
    data = gcp.datalab._chart_data._get_chart_data('', json.dumps({
      'source_index': ds,
      'fields': 'country',
      'first': 1,
      'count': 1
    }))
    self.assertEquals({"data": {"rows": [{"c": [{"v": "ZA"}]}],
                      "cols": [{"type": "string", "id": "country", "label": "country"}]},
                      "refresh_interval": 0, "options": {}}, data)

    data = gcp.datalab._chart_data._get_chart_data('', json.dumps({
      'source_index': ds,
      'fields': 'country',
      'first': 6,
      'count': 1
    }))
    self.assertEquals({"data": {"rows": [],
                      "cols": [{"type": "string", "id": "country", "label": "country"}]},
                      "refresh_interval": 0, "options": {}}, data)

    data = gcp.datalab._chart_data._get_chart_data('', json.dumps({
      'source_index': ds,
      'fields': 'country',
      'first': 2,
      'count': 0
    }))
    self.assertEquals({"data": {"rows": [],
                      "cols": [{"type": "string", "id": "country", "label": "country"}]},
                      "refresh_interval": 0, "options": {}}, data)

  @mock.patch('gcp.datalab._ml._get_ml_data')
  def test_get_chart_data_ml(self, mock_get_ml_data):
    gcp.ml.LocalModel.set_base_path('/tmp')
    try:
      model = gcp.ml.LocalModel('foo.v1')
      model.create_folders()

      mock_get_ml_data.return_value = ([], '*', 0, {}, {})

      gcp.datalab._chart_data._get_chart_data('', json.dumps({
        'metric': 'losses_and_errors',
        'width': 400,
        'models': [{'name': 'foo.v1', 'where': 'local', 'path': '/tmp'}],
        'controls': {'x': 'Steps'}
      }))
      mock_get_ml_data.assert_called_with(models=[model], x_axis='Steps',
                                          data_type='losses_and_errors', width=400)

      gcp.datalab._chart_data._get_chart_data('', json.dumps({
        'metric': 'loss',
        'width': 400,
        'models': [{'name': 'foo.v1', 'where': 'local', 'path': '/tmp'}],
        'controls': {'x': 'Time'}
      }))
      mock_get_ml_data.assert_called_with(models=[model], x_axis='Time',
                                          data_type='loss', width=400)
    finally:
      model.delete()

