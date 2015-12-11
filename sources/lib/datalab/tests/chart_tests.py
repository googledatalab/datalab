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


class TestCases(unittest.TestCase):

  def test_chart_cell(self):
    t = [{'country': 'US', 'quantity': 100}, {'country': 'ZA', 'quantity': 50}]
    chart = gcp.datalab._chart._chart_cell({'chart': 'geo', 'data': t, 'fields': None}, '')
    self.assertTrue(chart.find('charts.render(dom, {chartStyle:\'geo\'') > 0)
    self.assertTrue(chart.find('fields:\'*\'') > 0)
    self.assertTrue(chart.find('{"c": [{"v": "US"}, {"v": 100}]}') > 0)
    self.assertTrue(chart.find('{"c": [{"v": "ZA"}, {"v": 50}]}') > 0)
    self.assertTrue(chart.find('"cols": [{"type": "string", "id": "country", "label": "country"},' +
                               ' {"type": "number", "id": "quantity", "label": "quantity"}]}') > 0)

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
    data = gcp.datalab._chart._get_chart_data('%d country 1 1' % ds)
    self.assertEquals({"data": {"rows": [{"c": [{"v": "ZA"}]}],
                      "cols": [{"type": "string", "id": "country", "label": "country"}]}}, data)

    data = gcp.datalab._chart._get_chart_data('%d country 6 1' % ds)
    self.assertEquals({"data": {"rows": [],
                      "cols": [{"type": "string", "id": "country", "label": "country"}]}}, data)

    data = gcp.datalab._chart._get_chart_data('%d country 2 0' % ds)
    self.assertEquals({"data": {"rows": [],
                      "cols": [{"type": "string", "id": "country", "label": "country"}]}}, data)

  def test_chart_magic(self):
    # TODO(gram): complete this test
    pass
