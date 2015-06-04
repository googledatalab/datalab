#!/bin/bash
set -o errexit; # Fail build on first error, instead of carrying on by default

if [ -z "$REPO_DIR" ]; then
  echo "REPO_DIR is not set. Please run source tools/initenv.sh first";
  exit 1;
fi

if [ -z "$1" ]; then
  echo "Please specify the notebook directory path.";
  exit 1;
fi

# Load the common build config
source $REPO_DIR/sources/server/config.sh;

# Add GCP libraries to the python path.
LIBS=$REPO_DIR/sources/sdk/pygcp:$REPO_DIR/sources/ipython
export PYTHONPATH=$PYTHONPATH:$LIBS
echo 'Python path: ' $PYTHONPATH

# Install NodeJS server dependencies
npm install --prefix "$build_path";

storage_root="$1";
profile_path="$build_path/profile/kernel_config.py"

# Start the DataLab NodeJS server.
node "$build_path/server.js" \
    -n "$PWD/$storage_root" \
    --ipy-config $profile_path \
    --log-level=debug \
    --log-dirpath=$build_path  &
# Capture the server process id so that we can kill it later.
server_pid=$!;

# Wait a moment for server to start before opening a connection.
sleep 1;
export SERVER_HTTP_PORT=9000;
notebook_url="http://localhost:$SERVER_HTTP_PORT";

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
