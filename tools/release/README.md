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

1. If needed, bump up the hard-coded Datalab version to the next semantic version in the
[tools/release/version.sh](https://github.com/googledatalab/datalab/blob/master/tools/release/version.sh)
file, send a PR with the changes and merge.

2. Try the new image before releasing it. You can create a new GCE VM with the image by doing:
```
datalab create test-vm-name --image-name gcr.io/cloud-datalab/datalab:local-$(date +%Y%m%d)
```
Make sure that this image has the most recent changes, most importantly the version bump if any.

3. Run the following notebooks to make sure all of the graphs and charts are
displayed properly:
- [samples/Conversion Analysis with Google Analytics Data.ipynb](http://localhost:8081/notebooks/datalab/docs/samples/Conversion%20Analysis%20with%20Google%20Analytics%20Data.ipynb)
- [tutorials/Data/Interactive Charts with Google Charting APIs.ipynb](http://localhost:8081/notebooks/datalab/docs/tutorials/Data/Interactive%20Charts%20with%20Google%20Charting%20APIs.ipynb)

Additionally, we need to verify the graphs in the following notebook are
displayed properly. There is no need to run them, just verify that the
graphs look right:
- [samples/ML Toolbox/Image Classification/Flower/Local End to end.ipynb](http://localhost:8081/notebooks/datalab/docs/samples/ML%20Toolbox/Image%20Classification/Flower/Local%20End%20to%20End.ipynb)
- [samples/ML Toolbox/Regression/Census/1 Local End to End.ipynb](http://localhost:8081/notebooks/datalab/docs/samples/ML%20Toolbox/Regression/Census/1%20Local%20End%20to%20End.ipynb)

(*You can click these links directly if you're connected to Datalab at localhost://8081*)

4. If everything looks fine, go to the releases page and add a new release entry for this release:
https://github.com/googledatalab/datalab/releases with a tag that looks like `vX.X.<DATE>`
(change the version major and minor to match the hard-coded Datalab version). The new release
entry should follow the pattern of the previous ones, and include separate sections for new
features and for bug fixes. Include links to GitHub issues and pull requests where applicable.

5. Next, go to [the wiki](https://github.com/googledatalab/datalab/wiki/Release-Info)
and add a new entry for this release that links to its releases page.

6. You can now run the
[publish.sh](https://github.com/googledatalab/datalab/blob/master/tools/release/publish.sh)
script to validate and release the new image.

