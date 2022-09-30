# Copyright 2015 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this, file except in compliance with the License.
# You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""IPython configuration for Google Cloud DataLab."""

c = get_config()

# Implicitly imported packages.
c.InteractiveShellApp.extensions = [
  'google.datalab.kernel',
  'datalab.kernel',
  'matplotlib',
  'seaborn',
]

# Startup code.

c.InteractiveShellApp.exec_lines = []
#read command is the shell's internal tool for taking input from the user i.e. it makes the scripts interactive.

# Enable matplotlib renderings to show up inline in the notebook.
c.InteractiveShellApp.matplotlib = 'inline'



