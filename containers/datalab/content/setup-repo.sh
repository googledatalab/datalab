#!/bin/sh
# Copyright 2015 Google Inc. All rights reserved.
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

# Sets up the git repository and workspace used within the container. This
# also creates the branches (master, datalab, and datalab_instance) as needed.

git config --global user.email $DATALAB_USER
git config --global credential.helper gcloud.sh
git config --global push.default matching

create_branch ( ) {
  REPOURL="https://source.developers.google.com/p/$DATALAB_PROJECT_ID/"
  git ls-remote --heads $REPOURL 2>&1 | grep "refs/heads/$1" > /dev/null
  if [ $? != "0" ]; then
    BRANCHDIR="$1_branch"
    echo "creating $1 branch"
    if [ -d $BRANCHDIR ]; then
      rm -r -f $BRANCHDIR
    fi
    git init $BRANCHDIR
    cd $BRANCHDIR
    if [ $1 = "datalab" ]; then
      gsutil -m cp -r gs://cloud-datalab/content/* .
      echo '*.ipynb_checkpoints' > .gitignore
      git add .
      git commit -m "Initial Cloud Datalab content including samples and docs."
      git push $REPOURL master:$1
    elif [ $1 = "master" ]; then
      git commit  --allow-empty -m "$1 creation"
      git push $REPOURL master:$1
    else
      case $1 in
        datalab_*)
          git fetch $REPOURL datalab:$1
          git push $REPOURL $1:$1
          ;;
      esac
    fi
    cd ..
    rm -r -f $BRANCHDIR
    git ls-remote --heads $REPOURL 2>&1 | grep "refs/heads/$1" > /dev/null
    if [ $? != "0" ]; then
      echo "failed creating $1 branch"
      exit 1
    fi
  fi
}

create_branch "master"
create_branch "datalab"
create_branch "datalab_$DATALAB_INSTANCE_NAME"

