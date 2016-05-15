# Copyright 2016 Google Inc. All rights reserved.
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

""" Support for getting gcloud credentials. """

import oauth2client.client
import json
import os


def _in_datalab_docker():
  return os.path.exists('/datalab') and os.getenv('DATALAB_ENV')


def get_config_dir():
  config_dir = os.getenv('CLOUDSDK_CONFIG')
  if config_dir is None:
    if os.name == 'nt':
      try:
        config_dir = os.path.join(os.environ['APPDATA'], 'gcloud')
      except KeyError:
        # This should never happen unless someone is really messing with things.
        drive = os.environ.get('SystemDrive', 'C:')
        config_dir = os.path.join(drive, '\\gcloud')
    else:
      config_dir = os.path.join(os.path.expanduser('~'), '.config/gcloud')
  return config_dir


def get_credentials():
  """ Get the credentials to use. We try application credentials first, followed by
      user credentials. The path to the application credentials can be overridden
      by pointing the GOOGLE_APPLICATION_CREDENTIALS environment variable to some file;
      the path to the user credentials can be overridden by pointing the CLOUDSDK_CONFIG
      environment variable to some directory (after which we will look for the file
      $CLOUDSDK_CONFIG/gcloud/credentials). Unless you have specific reasons for
      overriding these the defaults should suffice.
  """
  try:
    return oauth2client.client.GoogleCredentials.get_application_default()
  except Exception as e:

    # Try load user creds from file
    cred_file = get_config_dir() + '/credentials'
    if os.path.exists(cred_file):
      with open(cred_file) as f:
        creds= json.loads(f.read())
      # Use the first gcloud one we find
      for entry in creds['data']:
        if entry['key']['type'] == 'google-cloud-sdk':
          return oauth2client.client.OAuth2Credentials.from_json(json.dumps(entry['credential']))

    if type(e) == oauth2client.client.ApplicationDefaultCredentialsError:
      # If we are in Datalab container, change the message to be about signing in.
      if _in_datalab_docker():
        raise Exception('No application credentials found. Perhaps you should sign in.')

    raise e
