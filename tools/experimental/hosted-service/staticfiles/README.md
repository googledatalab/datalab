# Read-Only Datalab Static Files Server

This directory contains the definition of an App Engine Flex app that can
be used to serve the static files for a managed Datalab service.

This app allows requests for static files to be served without going through
the inverting proxy, which makes the Datalab UI much more responsive.
