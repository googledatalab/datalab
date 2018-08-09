#!/usr/bin/env python
#
# Copyright 2018 Google Inc. All rights reserved.
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

# This file defines an end-to-end test that validates core functionality
# of the bundled CLI tool. This requires a GCP project in which the
# test will create, connect to, and delete Datalab instances.

import argparse
import random
import socket
import subprocess
import sys
import tempfile
import time
import unittest

try:
    from urllib.request import urlopen
except ImportError:
    from urllib2 import urlopen

import uuid


retry_count = 3
python_executable = sys.executable
connection_msg = (
    'The connection to Datalab is now open and will '
    'remain until this command is killed.')
readme_url_template = (
    'http://localhost:{}/api/contents/datalab/docs/Readme.ipynb')
readme_header = 'Guide to Google Cloud Datalab'


def generate_unique_id():
    return uuid.uuid4().hex[0:12]


def call_gcloud(args):
    return subprocess.check_output(['gcloud'] + args).decode('utf-8')


def free_port():
    auto_socket = socket.socket()
    auto_socket.bind(('localhost', 0))
    port_number = auto_socket.getsockname()[1]
    auto_socket.close()
    return port_number


def random_zone():
    zones_list = subprocess.check_output([
        'gcloud', 'compute', 'zones', 'list',
        '--filter=region~us-west', '--format=value(name)']).decode(
            'utf-8')
    zones = zones_list.split()
    return random.choice(zones)


class DatalabInstance(object):
    def __init__(self, test_run_id, project, zone):
        self.project = project
        self.zone = zone
        name_suffix = generate_unique_id()
        self.network = "test-network-{0}-{1}".format(
            test_run_id, name_suffix)
        self.name = "test-instance-{0}-{1}".format(
            test_run_id, name_suffix)

    def __enter__(self):
        cmd = [python_executable, '-u', './tools/cli/datalab.py', '--quiet',
               '--project', self.project,
               '--zone', self.zone,
               '--verbosity', 'debug',
               'create', '--no-connect',
               '--network-name', self.network,
               self.name]
        print('Creating the instance "{}" with the command "{}"'.format(
            self.name, ' '.join(cmd)))
        subprocess.check_output(cmd)
        print('Status of the instance: "{}"'.format(self.status()))
        return self

    def __exit__(self, *unused_args, **unused_kwargs):
        cmd = [python_executable, '-u', './tools/cli/datalab.py', '--quiet',
               '--project', self.project,
               '--zone', self.zone,
               'delete', '--delete-disk', self.name]
        print('Deleting the instance "{}" with the command "{}"'.format(
            self.name, ' '.join(cmd)))
        subprocess.check_output(cmd)
        firewalls = call_gcloud([
            'compute', 'firewall-rules', 'list',
            '--filter=network='+self.network,
            '--format=value(name)']).strip().split()
        for firewall in firewalls:
            delete_firewall_cmd = ['compute', 'firewall-rules', 'delete',
                                   '--project', self.project,
                                   '--quiet', firewall]
            print('Deleting the firewall "{}" with the command "{}"'.format(
                firewall, ' '.join(delete_firewall_cmd)))
            call_gcloud(delete_firewall_cmd)
        delete_network_cmd = ['compute', 'networks', 'delete',
                              '--project', self.project,
                              '--quiet', self.network]
        print('Deleting the network "{}" with the command "{}"'.format(
            self.network, ' '.join(delete_network_cmd)))
        call_gcloud(delete_network_cmd)

    def status(self):
        cmd = [python_executable, '-u', './tools/cli/datalab.py', '--quiet',
               '--project', self.project,
               '--zone', self.zone,
               'list', '--filter',  "(name={})".format(self.name)]
        return subprocess.check_output(cmd).decode('utf-8')


class DatalabConnection(object):
    def __init__(self, project, zone, instance, stdout):
        self.project = project
        self.zone = zone
        self.instance = instance
        self.stdout = stdout

    def __enter__(self):
        self.port = free_port()
        # Give a moment for the temporarily-acquired port to
        # free up before trying to reuse it.
        time.sleep(10)
        cmd = [python_executable, '-u', './tools/cli/datalab.py', '--quiet',
               '--project', self.project, '--zone', self.zone,
               'connect', '--no-launch-browser',
               '--port={}'.format(self.port),
               self.instance]
        self.process = subprocess.Popen(cmd, stdout=self.stdout)
        attempts = 0
        while attempts < 10:
            attempts += 1
            with open(self.stdout.name, "r") as written_stdout:
                if connection_msg in written_stdout.read():
                    self.readme_url = readme_url_template.format(self.port)
                    return self
            time.sleep(60)
        return self

    def __exit__(self, *unused_args, **unused_kwargs):
        self.process.terminate()
        self.process.communicate()


class TestEndToEnd(unittest.TestCase):
    def setUp(self):
        self.test_run_name = generate_unique_id()
        self.project = call_gcloud(
            ['config', 'get-value', 'core/project']).strip()
        self._zone = call_gcloud(
            ['config', 'get-value', 'compute/zone']).strip()
        print('Testing with in the zone "{}" under the project {}'.format(
            self._zone, self.project))

    def get_zone(self):
        if self._zone == '':
            return random_zone()
        return self._zone

    def call_datalab(self, subcommand, args):
        cmd = [python_executable, '-u', './tools/cli/datalab.py', '--quiet',
               '--project', self.project, subcommand] + args
        print('Running datalab command "{}"'.format(' '.join(cmd)))
        return subprocess.check_output(cmd).decode('utf-8')

    def retry_test(self, test_method):
        last_error = None
        for _ in range(retry_count):
            try:
                test_method()
                return
            except Exception as ex:
                last_error = ex
        raise last_error

    def test_create_delete(self):
        self.retry_test(self.run_create_delete_test)

    def run_create_delete_test(self):
        instance_name = ""
        instance_zone = self.get_zone()
        with DatalabInstance(self.test_run_name,
                             self.project,
                             instance_zone) as instance:
            instance_name = instance.name
            self.assertIn('RUNNING', instance.status())
        instances = self.call_datalab('list', [])
        self.assertNotIn(instance_name, instances)

    def test_connect(self):
        self.retry_test(self.run_connection_test)

    def run_connection_test(self):
        instance_name = ""
        instance_zone = self.get_zone()
        with DatalabInstance(self.test_run_name,
                             self.project,
                             instance_zone) as instance:
            instance_name = instance.name
            self.assertIn('RUNNING', instance.status())
            self.call_datalab('stop', ['--zone', instance_zone, instance.name])
            self.assertIn('TERMINATED', instance.status())
            with tempfile.NamedTemporaryFile() as tmp:
                with DatalabConnection(self.project, instance_zone,
                                       instance.name, tmp) as conn:
                    readme = urlopen(conn.readme_url)
                    readme_contents = readme.read().decode('utf-8')
                    print('README contents returned: "{}"'.format(
                        readme_contents))
                    self.assertIn(readme_header, readme_contents)

        instances = self.call_datalab('list', [])
        self.assertNotIn(instance_name, instances)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--runs', type=int, default=1, choices=range(1, 100),
                        metavar='COUNT', dest='runs',
                        help='Number of times to run the test suite')
    args = parser.parse_args()

    failed_count, run_count = 0, 0
    for _ in range(0, args.runs):
        suite = unittest.TestLoader().loadTestsFromTestCase(TestEndToEnd)
        result = unittest.TextTestRunner(buffer=True).run(suite)
        run_count += 1
        if not result.wasSuccessful():
            failed_count += 1

    print('Ran {} test runs with {} failing'.format(run_count, failed_count))
