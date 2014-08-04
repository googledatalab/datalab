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

import json
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Sample modules need to be loaded after the path has been modified to
# include the gcloud package sources on the python path.
# pylint: disable=g-import-not-at-top
import gcp.bigquery as bq


def main():
  name1 = 'githubarchive:github.timeline'
  table1 = bq.table(name1)
  print name1
  print json.dumps(table1.schema(), sort_keys=True, indent=2)

  # pylint: disable=protected-access
  print 'sql representation: ' + table1._repr_sql_()

  print ''

  name2 = 'requestlogs.logs20140615'
  table2 = bq.table(name2)
  table2_md = table2.metadata()
  print name2
  print 'full name: ' + table2_md.full_name
  print 'friendly name: ' + table2_md.friendly_name
  print 'description: ' + table2_md.description
  print 'rows: ' + str(table2_md.rows)
  print 'size: ' + str(table2_md.size)
  print 'created: ' + str(table2_md.created_on)
  print 'modified: ' + str(table2_md.modified_on)
  print json.dumps(table2.schema(), sort_keys=True, indent=2)

  print table2.sample().to_dataframe()

if __name__ == '__main__':
  main()
