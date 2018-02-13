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

"""Methods for implementing the `datalab connect` command."""

import os
import subprocess
import threading
import urllib2
import webbrowser

import utils


description = """`{0} {1}` creates a persistent connection to a
Datalab instance running in a Google Compute Engine VM.

This is a thin wrapper around the *ssh(1)* command that takes care
of authentication and the translation of the instance name into an
IP address.

This command ensures that the user's public SSH key is present
in the project's metadata. If the user does not have a public
SSH key, one is generated using *ssh-keygen(1)* (if the --quiet
flag is given, the generated key will have an empty passphrase).

Once the connection is established, this command opens a browser
window pointing at Datalab. To disable the browser opening, add
the --no-launch-browser flag.

This command will attempt to re-establish the connection if it
gets dropped. However, that connection will only exist while
this command is running.
"""


examples = """
To connect to 'example-instance' in zone 'us-central1-a', run:

    $ {0} {1} example-instance --zone us-central1-a"""


wrong_user_message_template = (
    'The specified Datalab instance was created for {0}, but you '
    'are attempting to connect to it as {1}.'
    '\n\n'
    'Datalab instances are single-user environments, and trying '
    'to share one is not supported.'
    '\n\n'
    'To override this behavior, re-run the command with the '
    '--no-user-checking flag.')


web_preview_message_template = (
    'Click on the *Web Preview* (square button at top-right), '
    'select *Change port > Port {}*, and start using Datalab.')


connection_closed_message_template = """
Connection closed.

To re-connect to your datalab instance, run the following command:

    datalab connect{1}{0}
"""


# The list of web browsers that we don't want to automatically open.
#
# This is a subset of the canonical list of python browser types
# defined here: https://docs.python.org/2/library/webbrowser.html
unsupported_browsers = [
    'BackgroundBrowser', 'Elinks', 'GenericBrowser', 'Grail'
]


# Status values from describe_instance that we care about.
_STATUS_RUNNING = 'RUNNING'


def flags(parser):
    """Add command line flags for the `connect` subcommand.

    Args:
      parser: The argparse parser to which to add the flags.
    """
    parser.add_argument(
        'instance',
        metavar='NAME',
        help='name of the instance to which to connect')
    parser.add_argument(
        '--no-user-checking',
        dest='no_user_checking',
        action='store_true',
        default=False,
        help='do not check if the current user matches the Datalab instance')

    connection_flags(parser)
    return


def connection_flags(parser):
    """Add flags common to every connection-establishing subcommand.

    Args:
      parser: The argparse parser to which to add the flags.
    """
    parser.add_argument(
        '--port',
        dest='port',
        type=int,
        default=8081,
        help='local port on which Datalab is accessible')
    parser.add_argument(
        '--max-reconnects',
        dest='max_reconnects',
        type=int,
        default=-1,
        help=(
            'maximum number of times to reconnect.'
            '\n\n'
            'A negative value means no limit.'))
    parser.add_argument(
        '--ssh-log-level',
        dest='ssh_log_level',
        choices=['quiet', 'fatal', 'error', 'info', 'verbose',
                 'debug', 'debug1', 'debug2', 'debug3'],
        default='error',
        help=(
            'the log level for the SSH command.'
            '\n\n'
            'This may be useful for debugging issues with an SSH connection.'
            '\n\n'
            'The default log level is "error".'
            '\n\n'
            'This has no effect when run on Windows.'))
    parser.add_argument(
        '--no-launch-browser',
        dest='no_launch_browser',
        action='store_true',
        default=False,
        help='do not open a browser connected to Datalab')

    return


def connect(args, gcloud_compute, email, in_cloud_shell):
    """Create a persistent connection to a Datalab instance.

    Args:
      args: The Namespace object constructed by argparse
      gcloud_compute: A function that can be called to invoke `gcloud compute`
      email: The user's email address
      in_cloud_shell: Whether or not the command is being run in the
        Google Cloud Shell
    """
    instance = args.instance
    connect_msg = ('Connecting to {0}.\n'
                   'This will create an SSH tunnel '
                   'and may prompt you to create an rsa key pair. '
                   'To manage these keys, see https://cloud.google.com/'
                   'compute/docs/instances/adding-removing-ssh-keys')
    print(connect_msg.format(instance))

    datalab_port = args.port
    datalab_address = 'http://localhost:{0}/'.format(str(datalab_port))

    def create_tunnel():
        """Create an SSH tunnel to the Datalab instance.

        This method blocks for as long as the connection is open.

        Raises:
          KeyboardInterrupt: When the end user kills the connection
          subprocess.CalledProcessError: If the connection dies on its own
        """
        if utils.print_debug_messages(args):
            print('Connecting to {0} via SSH').format(instance)

        cmd = ['ssh']
        if args.zone:
            cmd.extend(['--zone', args.zone])
        port_mapping = 'localhost:' + str(args.port) + ':localhost:8080'
        if os.name == 'posix':
            # The '-o' flag is not supported by all SSH clients (notably,
            # PuTTY does not support it). To avoid any potential issues
            # with it, we only add that flag when we believe it will
            # be supported. In particular, checking for an os name of
            # 'posix' works for both Linux and Mac OSX, which do support
            # that flag.
            cmd.extend([
                '--ssh-flag=-o',
                '--ssh-flag=LogLevel=' + args.ssh_log_level])
        cmd.extend([
            '--ssh-flag=-4',
            '--ssh-flag=-N',
            '--ssh-flag=-L',
            '--ssh-flag=' + port_mapping])
        cmd.append('datalab@{0}'.format(instance))
        gcloud_compute(args, cmd)
        return

    def maybe_open_browser(address):
        """Try to open a browser if we reasonably can."""
        try:
            browser_context = webbrowser.get()
            browser_name = type(browser_context).__name__
            if browser_name in unsupported_browsers:
                return
            webbrowser.open(datalab_address)
        except webbrowser.Error as e:
            print('Unable to open the webbrowser: ' + str(e))

    def on_ready():
        """Callback that handles a successful connection."""
        print('\nThe connection to Datalab is now open and will '
              'remain until this command is killed.')
        if in_cloud_shell:
            print(web_preview_message_template.format(datalab_port))
        else:
            print('You can connect to Datalab at ' + datalab_address)
            if not args.no_launch_browser:
                maybe_open_browser(datalab_address)
        return

    def health_check(cancelled_event, healthy_event):
        """Check if the Datalab instance is reachable via the connection.

        After the instance is reachable, the `on_ready` method is called.

        This method is meant to be suitable for running in a separate thread,
        and takes an event argument to indicate when that thread should exit.

        Args:
          cancelled_event: A threading.Event instance that indicates we should
            give up on the instance becoming reachable.
          healthy_event: A threading.Event instance that can be used to
            indicate that the instance became reachable.
        """
        health_url = '{0}_info/'.format(datalab_address)
        healthy = False
        print('Waiting for Datalab to be reachable at ' + datalab_address)
        while not cancelled_event.is_set():
            try:
                health_resp = urllib2.urlopen(health_url)
                if health_resp.getcode() == 200:
                    healthy = True
                    break
            except Exception:
                continue

        if healthy:
            healthy_event.set()
            on_ready()
        return

    def connect_and_check(healthy_event):
        """Create a connection to Datalab and notify the user when ready.

        This method blocks for as long as the connection is open.

        Args:
          healthy_event: A threading.Event instance that can be used to
            indicate that the instance became reachable.
        Returns:
          True iff the Datalab instance became reachable.
        Raises:
          KeyboardInterrupt: If the user kills the connection.
        """
        cancelled_event = threading.Event()
        health_check_thread = threading.Thread(
            target=health_check,
            args=[cancelled_event, healthy_event])
        health_check_thread.start()
        try:
            create_tunnel()
        except subprocess.CalledProcessError:
            print('Connection broken')
        finally:
            cancelled_event.set()
            health_check_thread.join()
        return healthy_event.is_set()

    remaining_reconnects = args.max_reconnects
    while True:
        healthy_event = threading.Event()
        try:
            connect_and_check(healthy_event)
        except KeyboardInterrupt:
            if healthy_event.is_set():
                cli_flags = ' '
                if args.project:
                    cli_flags += '--project {} '.format(args.project)
                if args.zone:
                    cli_flags += '--zone {} '.format(args.zone)
                cli_flags += '--port {} '.format(args.port)
                print(connection_closed_message_template.format(
                    instance, cli_flags))
            return
        if remaining_reconnects == 0:
            return
        # Before we try to reconnect, check to see if the VM is still running.
        status, unused_metadata_items = utils.describe_instance(
            args, gcloud_compute, instance)
        if status != _STATUS_RUNNING:
            print('Instance {0} is no longer running ({1})'.format(
                instance, status))
            return
        print('Attempting to reconnect...')
        remaining_reconnects -= 1
        # Don't launch the browser on reconnect...
        args.no_launch_browser = True
    return


def maybe_start(args, gcloud_compute, instance, status):
    """Start the given Google Compute Engine VM if it is not running.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
      instance: The name of the instance to check and (possibly) start
      status: The string describing the status of the instance
    Raises:
      subprocess.CalledProcessError: If one of the `gcloud` calls fail
    """
    if status != _STATUS_RUNNING:
        if utils.print_debug_messages(args):
            print('Restarting the instance {0} with status {1}'.format(
                instance, status))
        start_cmd = ['instances', 'start']
        if args.zone:
            start_cmd.extend(['--zone', args.zone])
        start_cmd.extend([instance])
        gcloud_compute(args, start_cmd)
    return


def run(args, gcloud_compute, email='', in_cloud_shell=False, **unused_kwargs):
    """Implementation of the `datalab connect` subcommand.

    Args:
      args: The Namespace instance returned by argparse
      gcloud_compute: Function that can be used to invoke `gcloud compute`
      email: The user's email address
      in_cloud_shell: Whether or not the command is being run in the
        Google Cloud Shell
    Raises:
      subprocess.CalledProcessError: If a nested `gcloud` calls fails
    """
    instance = args.instance
    status, metadata_items = utils.describe_instance(
        args, gcloud_compute, instance)
    for_user = metadata_items.get('for-user', '')
    sdk_version = metadata_items.get('created-with-sdk-version', 'UNKNOWN')
    datalab_version = metadata_items.get(
        'created-with-datalab-version', 'UNKNOWN')
    if (not args.no_user_checking) and for_user and (for_user != email):
        print(wrong_user_message_template.format(for_user, email))
        return

    if args.diagnose_me:
        print('Instance {} was created with the following '
              'Cloud SDK component versions:'
              '\n\tCloud SDK: {}'
              '\n\tDatalab: {}'.format(
                  instance, sdk_version, datalab_version))

    maybe_start(args, gcloud_compute, instance, status)
    connect(args, gcloud_compute, email, in_cloud_shell)
    return
