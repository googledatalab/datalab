// BigQueryExtension.java
//

package com.google.cloud.datalab.bigquery;

import ijava.extensibility.*;

public final class BigQueryExtension implements ShellExtension {

  @Override
  public Object initialize(Shell shell) {
    shell.registerCommand("bq", new BigQueryCommand(shell));
    return null;
  }
}
