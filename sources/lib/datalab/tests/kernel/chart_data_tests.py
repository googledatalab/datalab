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
import IPython.core.display
import IPython.core.magic


def noop_decorator(func):
  return func

IPython.core.magic.register_line_cell_magic = noop_decorator
IPython.core.magic.register_line_magic = noop_decorator
IPython.core.magic.register_cell_magic = noop_decorator
IPython.core.display.HTML = lambda x: x
IPython.core.display.JSON = lambda x: x

import datalab.utils.commands


class TestCases(unittest.TestCase):

  @mock.patch('datalab.utils.get_item')
  def test_get_chart_data(self, mock_get_item):
    t = [
        {'country': 'US', 'quantity': 100},
        {'country': 'ZA', 'quantity': 50},
        {'country': 'UK', 'quantity': 75},
        {'country': 'AU', 'quantity': 25}
    ]
    mock_get_item.return_value = t
    ds = datalab.utils.commands.get_data_source_index('t')
    data = datalab.utils.commands._chart_data._get_chart_data('', json.dumps({
      'source_index': ds,
      'fields': 'country',
      'first': 1,
      'count': 1
    }))
    self.assertEquals({"data": {"rows": [{"c": [{"v": "ZA"}]}],
                      "cols": [{"type": "string", "id": "country", "label": "country"}]},
                      "refresh_interval": 0, "options": {}}, data)

    data = datalab.utils.commands._chart_data._get_chart_data('', json.dumps({
      'source_index': ds,
      'fields': 'country',
      'first': 6,
      'count': 1
    }))
    self.assertEquals({"data": {"rows": [],
                      "cols": [{"type": "string", "id": "country", "label": "country"}]},
                      "refresh_interval": 0, "options": {}}, data)

    data = datalab.utils.commands._chart_data._get_chart_data('', json.dumps({
      'source_index': ds,
      'fields': 'country',
      'first': 2,
      'count': 0
    }))
    self.assertEquals({"data": {"rows": [],
                      "cols": [{"type": "string", "id": "country", "label": "country"}]},
                      "refresh_interval": 0, "options": {}}, data)


