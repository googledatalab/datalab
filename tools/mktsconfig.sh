#!/bin/bash

# Helper to make tsconfig.json files and shared symlinks to use typescript IDEs
# for server development.

set -o errexit; # Fail build on first error, instead of carrying on by default

if [ -z "$REPO_DIR" ]; then
  echo "REPO_DIR is not set. Please run source tools/initenv.sh first";
  exit 1;
fi

if [ ! -e "$REPO_DIR/sources/server/src/ui/scripts/app/shared" ]
then
  echo "Making ui shared link"
  (cd "$REPO_DIR/sources/server/src/ui/scripts/app"; ln -s ../../../shared shared)
else
  echo "ui shared link exists"
fi

if [ ! -e "$REPO_DIR/sources/server/src/node/app/shared" ]
then
  echo "Making node shared link"
  (cd "$REPO_DIR/sources/server/src/node/app"; ln -s ../../shared shared)
else
  echo "node shared link exists"
fi

pushd "$REPO_DIR/sources/server/src/ui" > /dev/null

cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "module": "amd",
    "noImplicitAny": true,
    "removeComments": true,
    "preserveConstEnums": true,
    "outDir": "../../../../build/server/_/static/",
    "sourceMap": true
  },
  "files": [
EOF

find -H . -name "*.ts" | grep -v "./scripts/main.ts" | sed -e 's/^/    \"/' | sed -e 's/$/\",/' >> tsconfig.json

# Deal with last file separately so we have no comma to violate JSON standard.
cat >> tsconfig.json << EOF
    "./scripts/main.ts"
  ]
}
EOF

popd > /dev/null

pushd "$REPO_DIR/sources/server/src/node" > /dev/null

cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitAny": true,
    "removeComments": true,
    "preserveConstEnums": true,
    "outDir": "../../../../build/server/_/",
    "sourceMap": true
  },
  "files": [
EOF

find -H . -name "*.ts" | grep -v "./server.ts" | sed -e 's/^/    \"/' | sed -e 's/$/\",/' >> tsconfig.json

# Deal with last file separately so we have no comma to violate JSON standard.
cat >> tsconfig.json << EOF
    "./server.ts"
  ]
}
EOF

popd > /dev/null

