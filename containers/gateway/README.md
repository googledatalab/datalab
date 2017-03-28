# DataLab Kernel Gateway Image

This directory defines a Docker image for running a
[Jupyter Kernel Gateway](https://github.com/jupyter/kernel_gateway)
with the Datalab python libraries (and their dependencies) installed.

This image allows you to turn a Datalab notebook into a web server
by adding HTTP handler comments to the cells in your notebook and
then running

    docker run -it -v "${HOME}:/content" -p 8081:8080 \
	    -e "DATALAB_NOTEBOOK=/content/<PATH-TO-NOTEBOOK>.ipynb" \
		datalab-gateway

For details on what HTTP handler comments look like, see the
[notebook-http mode docs here](https://jupyter-kernel-gateway.readthedocs.io/en/latest/http-mode.html)
