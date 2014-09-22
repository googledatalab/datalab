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

import os

c = get_config()

# Static files.
c.NotebookApp.extra_static_paths = [
  os.path.join(os.path.dirname(__file__), 'static')
]

repo_dir = os.environ.get('REPO_DIR')
ijava_run = os.path.join(repo_dir, 'build', 'kernel', 'ijava.run')

c.KernelManager.kernel_cmd = [ijava_run, '{connection_file}']
c.Session.key = b''
c.Session.keyfile = b''
