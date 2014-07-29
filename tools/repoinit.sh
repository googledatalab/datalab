#!/bin/sh

# Setup a commit hook to auto-add a Change-Id to commit messages (required for
# reviewing) ... based on:
# curl -Lo .git/hooks/commit-msg \
#     https://datastudio-review.git.corp.google.com/tools/hooks/commit-msg

cp commit-msg ../.git/hooks/commit-msg
chmod +x ../.git/hooks/commit-msg

# Sets up a simple 'git review' command to push changes for review
git config alias.review 'push origin HEAD:refs/for/master%r=datastudio+cl@google.com'

