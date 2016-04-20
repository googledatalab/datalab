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

import datetime
from setuptools import setup

# TODO(nikhilko):
# Fill in various other bits that can/should be specified once we have them.
# These include url, license, long_description (readme), author & author_email.

minor = datetime.datetime.now().strftime("%y%m%d%H%M")

setup(
  name='gcpdatalab',
  version='0.1.' + minor,
  namespace_packages=['gcp'],
  packages=['gcp.datalab'],
  description='Google Cloud Datalab',
  install_requires=[
    'httplib2==0.9.2',
    'ipython>=4.0,<4.2',
    'pandas>=0.17.1',
    'pandas-profiling>=1.0.0a2',
    'gcpdata>=0.1'
  ]
)
