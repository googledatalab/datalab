# IPython Configuration

import os

c = get_config()

# Kernel setup
kernel_path = os.path.join(os.path.dirname(__file__), '..',
                           'build', 'ijava')
c.KernelManager.kernel_cmd = [
  kernel_path,
  '--dep:dataflow-sdk.jar',
  '--dep:dataflow-sdk-plus.jar',
  '--shellDep:ijavaext-cloud.jar',
  '--ext:com.google.cloud.datalab.charting.ChartingExtension',
  '--ext:com.google.cloud.datalab.bigquery.BigQueryExtension',
  '--ext:com.google.cloud.datalab.dataflow.DataflowExtension',
  '{connection_file}'
]

# Protocol signing settings
c.Session.key = b''
c.Session.keyfile = b''

# Static files
c.NotebookApp.extra_static_paths = [
  os.path.join(os.path.dirname(__file__))
]
