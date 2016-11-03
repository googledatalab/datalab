# Datalab (Semi-)Automated Release Process

This directory contains the scripts used to build and publish new datalab releases.

These fall into two categories:

1. `build.sh`, which performs a fully automated build.
2. `publish.sh`, which tests a previously-built image and publishes it.

Both of these scripts are meant to be run against the `master` branch.

## Automatic Builds

The `build.sh` script performs a clean build of the Datalab Docker images
from scratch (without using any cached image layers), tags the newly built
images with today's date (in `YYYYMMDD` format), and then pushes those
images to the Google Container Registry.

This step is meant to be performed automatically, on a daily basis, in a
reproducible environment. For example, this can be run as a cron job on
a single build machine.

## Publishing Images

The `publish.sh` script takes one set of the previously built images (by
default, the automatic build from today), runs automated tests, and then
publishes those images as the new default ones.

The automatic testing involves running the current sample notebooks in the new
image, and verifying that none of them produce any errors.

That is not a sufficient amount of testing to validate that the new build is
good enough to publish, so we also have to perform some manual validation of
the new image as described below:

### Manual Release Process

Prior to running the `publish.sh` script, we have to download the main image
that will be released:

    docker run -it -p "127.0.0.1:8081:8080" -v "${HOME}:/content" \
      -e "PROJECT_ID=<PROJECT_ID>" \
      "gcr.io/cloud-datalab/datalab:local-$(date +%Y%m%d)"

... and then run the following notebooks to make sure all of the graphs and
charts are displayed properly: 

    samples/Conversion Analysis with Google AnalyticsData.ipynb 
    tutorials/Data/Interactive Charts with Google Charting APIs.ipynb 

Additionally, we need to verify the graphs in the following notebook are
displayed properly. There is no need to run this one, just verify that the
parcoords graph looks right.

    tutorials/Machine Learning/Iris/7. HyperParameter Tuning.ipynb

Next, go to [the wiki](https://github.com/googledatalab/datalab/wiki/Release-Info)
and add a new entry for this release.

The new entry should follow the pattern of the previous ones, and include
separate sections for new features and for bug fixes. Include links to GitHub
issues and pull requests where applicable.

Finally, run the `publish.sh` script to validate and publish the release.
