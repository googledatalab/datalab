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

from setuptools import setup

# TODO(nikhilko):
# Fill in various other bits that can/should be specified once we have them.
# These include url, license, long_description (readme), author & author_email.

# TODO(nikhilko):
# Also, figure out publishing, so this works with pip install, and specifying
# dependencies, so they can be accounted for during installation.
# Known depdenencies:
# - futures
# - httplib2
# - oauth2client
# - pandas
# - py-dateutil

setup(
    name='GCPData',
    version='0.1.0',
    namespace_packages=['gcp'],
    packages=['gcp._util',
              'gcp.bigquery',
              'gcp.storage',
             ],
    description='Google Cloud APIs for data analysis scenarios.',
    install_requires=['futures==3.0.3',
                      'httplib2==0.9.1',
                      'oauth2client==1.4.12',
                      'pandas==0.16.2',
                      'py-dateutil==2.2']
)
