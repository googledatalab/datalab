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

"""Cloud Storage object API sample."""

import datetime as dt
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
import gcp.storage as storage


def main():
  bucket = storage.bucket('datastudio-test')
  item = bucket.item('test.txt')

  print '/datastudio-test/test.txt exists? ' + str(item.exists())

  item_md = item.metadata()
  print 'Name   : ' + item_md.name
  print 'ETag   : ' + item_md.etag
  print 'Updated: ' + str(item_md.updated_on)
  print 'Content: ' + item_md.content_type
  print 'Size   : ' + str(item_md.size)
  print item._info

  print 'Read Item content:'
  text = item.read_from()
  print text

  print ''

  print 'Write Item content:'
  text = text + '\n' + str(dt.datetime.utcnow())
  item.write_to(text, 'text/plain')

  print ''

  item2 = bucket.item('non-existing-file')
  print '/datastudio-test/non-existing-file exists? ' + str(item2.exists())

  print 'Moving folder1/test3.txt to foo.txt'
  item3 = bucket.item('folder1/test3.txt')
  print 'folder1/test3.txt exists? ' + str(item3.exists())

  item4 = item3.copy_to('foo.txt')
  print 'foo.txt exists? ' + str(item4.exists())

  item3.delete()
  print 'folder1/test3.txt exists? ' + str(item3.exists())

  item4.copy_to('folder1/test3.txt')
  print 'folder1/test3.txt exists? ' + str(item3.exists())

if __name__ == '__main__':
  main()
