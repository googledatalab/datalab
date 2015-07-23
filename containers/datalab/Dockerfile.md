# DataLab Docker Container

This briefly describes the important aspects of the Dockerfile definition
(separately, so changes to comments don't change the layering, and trigger
rebuilding - uggh!)

## Ordering
The ordering is important. The content changing most often is at the end, so
we can benefit from docker's layered file system, and cache of previous builds.

## Node.js
Node.js isn't installed using `apt-get` because that results in an older
build of node.js.

## Python packages
The `numpy` library and various other libraries depending on it (such as pandas)
are installed separately rather than in one call to `pip install` as pip seems
to want to build `numpy` for every dependency. The install one-package-at-a-time
seems to be better, though not completely solved. It appears some packages are
built multiple times.

So there is still room for improvement here.

Additionally test code from all installed python packages is removed to reduce
the container size (by about ~50MB last I checked).

## Node.js module dependencies
The node.js modules we depend on are pre-installed explicitly so they can be
in a cached layer. This avoids rebuilding some native node modules (like ws)
each time we build the layer containing our build outputs.
