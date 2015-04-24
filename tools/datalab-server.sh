#!/bin/bash
set -o errexit; # Fail build on first error, instead of carrying on by default

if [ -z "$REPO_DIR" ]; then
  echo "REPO_DIR is not set. Please run source tools/initenv.sh first";
  exit 1;
fi

if [ -z "$1" ]; then
  echo "Please specify the path to a notebook (.ipynb).";
  exit 1;
fi

# Load the common build config
source $REPO_DIR/sources/server/config.sh;

# Install NodeJS server dependencies
npm install --prefix "$build_path";

storage_root=`dirname "$1"`;
notebook_relative_path=`basename $1`;

# Start the DataLab NodeJS server.
node "$build_path/server.js" -n "$PWD/$storage_root" &
# Capture the server process id so that we can kill it later.
server_pid=$!;

# Wait a moment for server to start before opening a connection.
sleep 1;
echo "Opening notebook $notebook_relative_path";

notebook_url="http://localhost:9000/#/notebooks/$notebook_relative_path";

# Open the default browser to the specified notebook path
echo "Opening your browser to notebook: $notebook_url"
os=`uname`;
if [ "$os" == "Darwin" ]; then
  open "$notebook_url"
else # Assume Linux
  xdg-open "$notebook_url"
fi

# When the user presses Ctrl-C, kill the node server process before exitting.
trap handle_interrupt INT
function handle_interrupt() {
  kill $server_pid;
  echo "Thanks for trying DataLab!";
}

# Don't exit script unless the node server process dies.
wait $server_pid;
