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
from oauth2client.client import AccessTokenCredentials
import unittest

# import Python so we can mock the parts we need to here.
import IPython
import IPython.core.magic


def noop_decorator(func):
  return func

IPython.core.magic.register_line_cell_magic = noop_decorator
IPython.core.magic.register_line_magic = noop_decorator
IPython.core.magic.register_cell_magic = noop_decorator
IPython.get_ipython = mock.Mock()

import datalab.bigquery
import datalab.bigquery.commands
import datalab.context
import datalab.utils.commands


class TestCases(unittest.TestCase):

  @mock.patch('datalab.utils.commands.notebook_environment')
  @mock.patch('datalab.context._context.Context.default')
  def test_udf_cell(self, mock_default_context, mock_notebook_environment):
    env = {}
    cell_body = \
"""
/**
 * @param {{word: string, corpus: string, word_count: integer}} r
 * @param function({{word: string, corpus: string, count: integer}}) emitFn
 */
function(r, emitFn) {
  if (r.word.match(/[shakespeare]/) !== null) {
    var result = { word: r.word, corpus: r.corpus, count: r.word_count };
    emitFn(result);
  }
}
"""
    mock_default_context.return_value = TestCases._create_context()
    mock_notebook_environment.return_value = env
    datalab.bigquery.commands._bigquery._udf_cell({'module': 'word_filter'}, cell_body)
    udf = env['word_filter']
    self.assertIsNotNone(udf)
    self.assertEquals('word_filter', udf._name)
    self.assertEquals([('word', 'string'), ('corpus', 'string'), ('count', 'integer')],
                      udf._outputs)
    self.assertEquals(cell_body, udf._implementation)

  @staticmethod
  def _create_context():
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return datalab.context.Context(project_id, creds)

  def test_sample_cell(self):
    # TODO(gram): complete this test
    pass

  def test_get_schema(self):
    # TODO(gram): complete this test
    pass

  def test_get_table(self):
    # TODO(gram): complete this test
    pass

  def test_table_viewer(self):
    # TODO(gram): complete this test
    pass
