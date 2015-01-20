// DataflowExtension.java
//

package com.google.cloud.datalab.dataflow;

import ijava.extensibility.*;

/**
 * Provides the interactive shell and REPL functionality for dataflow development.
 */
public final class DataflowExtension implements ShellExtension {

  private InteractivePipelineResult _currentPipelineResult;

  public InteractivePipelineResult getPipelineResult() {
    return _currentPipelineResult;
  }

  public void setPipelineResult(InteractivePipelineResult result) {
    _currentPipelineResult = result;
  }

  @Override
  public Object initialize(Shell shell) {
    // Add a dependency to the dataflow sdk imports
    shell.addImport("com.google.cloud.dataflow.sdk.*", /* staticImport */ false);
    shell.addImport("com.google.cloud.dataflow.sdk.io.*", /* staticImport */ false);
    shell.addImport("com.google.cloud.dataflow.sdk.transforms.*", /* staticImport */ false);
    shell.addImport("com.google.cloud.dataflow.sdk.values.*", /* staticImport */ false);

    // Register the command for handling the %dataflow command
    shell.registerCommand("dataflow", new DataflowCommand(shell, this));
    shell.registerCommand("_dataflowData", new DataflowDataCommand(shell, this));

    return null;
  }
}
