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

"""Cloud Storage bucket API sample."""

import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
import gcp.storage as storage


def main():
  print 'Bucket List:'
  for bucket in storage.buckets():
    print bucket.name

  print ''

  print 'Information about datastudio-test bucket:'
  bucket = storage.bucket('datastudio-test')
  bucket_md = bucket.metadata()
  print 'Name   : ' + bucket_md.name
  print 'ETag   : ' + bucket_md.etag
  print 'Created: ' + str(bucket_md.created_on)

  print ''

  print 'datastudio-not-existing exists?'
  print storage.buckets().contains('datastudio-non-existing-bucket')

  print ''

  print 'Item List:'
  for item in bucket.items():
    print item.key + ':' + item.metadata().content_type

  print ''

  print 'Filtered Item List:'
  for item in bucket.items(prefix='folder1/', delimiter='/'):
    print item.key + ':' + item.metadata().content_type

if __name__ == '__main__':
  main()
