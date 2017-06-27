# ~/.bashrc: executed by bash(1) for non-login shells.

cd /content
STARTCOLOR='\[\e[1;32m\]'
ENDCOLOR='\[\e[0m\]'
export PS1="$STARTCOLOR\w> $ENDCOLOR"
echo 'Welcome to Google Cloud Datalab.
Please note that only changes inside /content will be preserved if
the Datalab VM is shutdown or restarted. Package installations
(pip, apt-get... etc) and other system changes will not be saved.'
