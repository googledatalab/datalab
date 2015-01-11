// ChartingExtension.java
//

package com.google.cloud.datalab.charting;

import ijava.extensibility.*;

public final class ChartingExtension implements ShellExtension {

  /**
   * {@link ShellExtension}
   */
  @Override
  public Object initialize(Shell shell) {
    shell.registerCommand("chart", new ChartCommand(shell));
    shell.registerCommand("_chartData", new ChartDataCommand(shell));
    return null;
  }
}
