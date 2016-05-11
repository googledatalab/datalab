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

# To install and use this:
#
#   pip install datalab
#   jupyter nbextension install --py datalab.notebook --sys-prefix
#
# The --sys-prefix should be omitted if not in a virtualenv.
#
# Then in a notebook, use %load_ext datalab.kernel
#
# Or add this to your ipython_config.py file in your profile:
#
#  c.InteractiveShellApp.extensions = [
#    'datalab.kernel'
#  ]

# TODO(nikhilko):
# Fill in various other bits that can/should be specified once we have them.
# These include url, license, long_description (readme), author & author_email.

minor = datetime.datetime.now().strftime("%y%m%d%H%M")

setup(
  name='datalab',
  version='0.1.' + minor,
  namespace_packages=['datalab'],
  packages=[
    'datalab.bigquery',
    'datalab.bigquery.commands',
    'datalab.context',
    'datalab.context.commands',
    'datalab.data',
    'datalab.data.commands',
    'datalab.kernel',
    'datalab.notebook',
    'datalab.storage',
    'datalab.storage.commands',
    'datalab.utils',
    'datalab.utils.commands'
  ],
  description='Google Cloud Datalab',
  install_requires=[
    'futures==3.0.5',
    'httplib2==0.9.2',
    'oauth2client==2.0.2',
    'pandas>=0.17.1',
    'pandas-profiling>=1.0.0a2',
    'python-dateutil==2.5.0',
    'pytz>=2015.4',
    'pyyaml==3.11',
    'scikit-learn==0.17.1', 'sklearn',
  ],
  package_data={
    'datalab.notebook': [
        'static/bigquery.css',
        'static/bigquery.js',
        'static/charting.css',
        'static/charting.js',
        'static/job.css',
        'static/job.js',
        'static/element.js',
        'static/style.js',
        'static/visualization.js',
        'static/codemirror/mode/sql.js',
      ]
  }
)
