#!/bin/sh
# The content of a jar file will be appended at the end of this shell file and
# it will be executed like a normal file without having to call java on it.
MYSELF=`which "$0" 2>/dev/null`
[ $? -gt 0 -a -f "$0" ] && MYSELF="./$0"
java=java
if test -n "$JAVA_HOME"; then
    java="$JAVA_HOME/bin/java"
fi
 exec "$java" $java_args -jar $MYSELF "$@"
exit 1
