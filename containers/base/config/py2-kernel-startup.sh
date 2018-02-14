#!/bin/bash

# Ensure that we're in the correct Python environment before starting the
# kernel.
source activate py2env

# Start the Python2 ipykernel
exec python -m ipykernel $@

