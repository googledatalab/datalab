#!/bin/sh

gsutil -m cp ipython/notebooks/* gs://cloud-datalab/ipython/intro
gsutil -m acl ch -R -u AllUsers:R gs://cloud-datalab/ipython/intro

