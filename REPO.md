# Google DataLab Repository

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

* `/sources/kernels` - new kernels that we've authored to plug into IPython and into
  DataLab.
  - ijava: Java kernel

* `/sources/docker` - packaging into docker containers. We have the following containers:
  - ipython: packaging of ipython to run on GCP
  - ipythonlocal: a derived container that can be run locally using a simulated
  metadata service

* `/sources/tools` - miscellaneous other supporting tools.

Sources build into `/build` which are consumed when building the docker images.


## External Dependencies

This consists of libraries (jars) and sources (typescript declaration files) that are
a snapshot of external code, and referenced by the above sources. These exist in
`/externs'.


## Deployment

Once the docker containers have been built and images have been published to the docker
register, the deployment scripts allow deploying to the cloud. Specifically:

* `app.sh`: deploys to managed VMs.
* `vm.sh`: deploys to GCE VMs. This is what is currently in active use.

These exist in `/deploy`.


## Development Environment

Various scripts and related files used to setup the development environment in `/tools`.
