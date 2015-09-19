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

import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
import gcp.bigquery as bq


def main():
  name1 = 'githubarchive:github.timeline'
  table1 = bq.table(name1)
  print name1
  for field in table1.schema:
    print field.name + ' [' + field.data_type + ']'

  # pylint: disable=protected-access
  print 'sql representation: ' + table1._repr_sql_()

  print ''

  name2 = 'requestlogs.logs20140615'
  table2 = bq.table(name2)
  table2_md = table2.metadata
  print name2
  print 'full name: ' + str(table2_md)
  print 'friendly name: ' + table2_md.friendly_name
  print 'description: ' + table2_md.description
  print 'rows: ' + str(table2_md.rows)
  print 'size: ' + str(table2_md.size)
  print 'created: ' + str(table2_md.created_on)
  print 'modified: ' + str(table2_md.modified_on)
  for field in table2.schema:
    print field.name + ' [' + field.data_type + ']'

  print table2.sample().to_dataframe()
  print table2.sample(sampling=bq.Sampling.default(count=10)).to_dataframe()

  print ''

  table_list = bq.tables('requestlogs')
  print 'Tables:'
  for t in table_list:
    print t.name


if __name__ == '__main__':
  main()
