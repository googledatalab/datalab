# Google Cloud DataLab Repository

This is a quick description of the repository structure to help understand and
discover the relevant pieces.

## Source Code

All source code corresponding to product functionality that is built exists
within `/sources`. The following is a list of the individual components:

* `/sources/sdk` - set of libraries that are referenced by developers by code
  they write.
  - pygcp: python library for accessing various cloud APIs (such as BigQuery), as well
    as functionality enabling interactive experience in IPython notebooks.

* `/sources/ipython` - custom IPython profile containing code that replaces existing
  functionality (eg. custom NotebookManager), or customizations via client-side scripts.
  This also includes a reverse proxy web server written in node.js that is used to
  handle the HTTP traffic and route it to IPython internally.

* `/sources/docker` - packaging into docker containers. We have the following containers:
  - ipython: packaging of ipython to run on GCP
  - ipythonlocal: a derived container that can be run locally using a simulated
  metadata service

* `/sources/tools` - miscellaneous other supporting tools.

Source code builds into the /build directory, and the generated build outputs are
consumed when building the DataLab docker container.

## Docker Containers

All functionality is packaged into a docker container. In addition to the build outputs,
the docker container contains, python, various python libraries, and the Google Cloud
SDK.

This docker container can be run locally, as well as in the cloud, as an AppEngine
module.

The docker file definition is in `/containers/datalab`.

## Documentation and Sample Notebooks

Notebooks are used for the purposes of documentation. These are located in the `/content`
directory, and are copied into the docker container when the container is built.

