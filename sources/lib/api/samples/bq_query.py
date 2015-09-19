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
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

import gcp.bigquery as bq


def main():
  # Simple Query and QueryResult usage
  sql = ('SELECT * '
         'FROM [githubarchive:github.timeline] '
         'LIMIT 1')

  query = bq.query(sql)
  print query

  results = query.results()

  print 'Rows: ' + str(len(results))
  for row in results:
    print json.dumps(row, sort_keys=True, indent=2)

  print 'DataFrame:'
  print results.to_dataframe()

  # SQL arguments
  sql_template = ('SELECT created_at '
                  'FROM [githubarchive:github.timeline] '
                  'WHERE repository_name = $name '
                  'LIMIT 1')
  repo = 'demo-logs-analysis'

  sql = bq.sql(sql_template, name=repo)
  print 'SQL (arg substitution):'
  print sql

  # SQL table arg substitution
  table = bq.table('githubarchive:github.timeline')
  sql = bq.sql('SELECT * FROM $table', table=table)
  print 'SQL (table substitution):'
  print sql

  # SQL nested queries
  query = bq.query('SELECT * FROM [githubarchive:github.timeline]')
  sql = bq.sql('SELECT repository_name, created_at FROM $q LIMIT 1', q=query)
  print 'SQL (nested queries):'
  print sql

  # SQL query sampling
  sql = 'SELECT repository_name FROM [githubarchive:github.timeline]'
  query = bq.query(sql)
  print query.sample().to_dataframe()

if __name__ == '__main__':
  main()
