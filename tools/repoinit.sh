#!/bin/sh

# Setup a commit hook to auto-add a Change-Id to commit messages (required for
# reviewing) ... based on:
# curl -Lo .git/hooks/commit-msg \
#     https://datastudio-review.git.corp.google.com/tools/hooks/commit-msg

cp commit-msg ../.git/hooks/commit-msg
chmod +x ../.git/hooks/commit-msg

# Set up some simple git commands (aliases as well as some new ones)
git config alias.diffui !'meld $REPO_DIR'
git config alias.amend 'git commit --amend'
git config alias.review 'push origin HEAD:refs/for/master'

