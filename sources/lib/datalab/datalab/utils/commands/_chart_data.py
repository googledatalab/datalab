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

"""Google Cloud Platform library - chart_data cell magic."""

try:
  import IPython
  import IPython.core.display
  import IPython.core.magic
except ImportError:
  raise Exception('This module can only be loaded in ipython.')

import json

import datalab.data
import datalab.utils

import _utils


@IPython.core.magic.register_cell_magic
def _get_chart_data(line, cell_body=''):

  refresh = 0
  options = {}
  try:
    metadata = json.loads(cell_body) if cell_body else {}
    source_index = metadata.get('source_index', None)
    fields = metadata.get('fields', '*')
    first_row = int(metadata.get('first', 0))
    count = int(metadata.get('count', -1))

    source_index = int(source_index)
    if source_index >= len(_utils._data_sources):  # Can happen after e.g. kernel restart
      # TODO(gram): get kernel restart events in charting.js and disable any refresh timers.
      print 'No source %d' % source_index
      return IPython.core.display.JSON({'data': {}})
    source = _utils._data_sources[source_index]
    schema = None

    controls = metadata['controls'] if 'controls' in metadata else {}
    data, _ = _utils.get_data(source, fields, controls, first_row, count, schema)
  except Exception, e:
    datalab.utils.print_exception_with_last_stack(e)
    print 'Failed with exception %s' % e
    data = {}

  # TODO(gram): The old way - commented out below - has the advantage that it worked
  # for datetimes, but it is strictly wrong. The correct way below may have issues if the
  # chart has datetimes though so test this.
  return IPython.core.display.JSON({'data': data, 'refresh_interval': refresh, 'options': options})
  # return IPython.core.display.JSON(json.dumps({'data': data}, cls=datalab.utils.JSONEncoder))
