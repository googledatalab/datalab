// ChartDataCommand.java
//

package com.google.cloud.datalab.charting;

import java.util.*;
import com.google.cloud.datalab.charting.data.*;
import ijava.data.*;
import ijava.extensibility.*;

/**
 * Handles the %_chartData command used to retrieve chart data in a format usable with the
 * Google Charting API.
 */
public final class ChartDataCommand implements Command {

  private final Shell _shell;

  public ChartDataCommand(Shell shell) {
    _shell = shell;
  }

  @Override
  public Object evaluate(String arguments, String data, long evaluationID,
                         Map<String, Object> metadata) throws Exception {
    String name = arguments;

    Object value = _shell.getVariable(name);
    if (value == null) {
      throw new EvaluationError("The name '" + name + "' doesn't exist or is null.");
    }

    if (!List.class.isAssignableFrom(value.getClass())) {
      throw new EvaluationError("The name '" + name + "' refers to non-list data.");
    }

    Map<String, Object> dataTable = ChartData.createDataTable((List<?>)value, null);
    return new Data(dataTable);
  }
}
