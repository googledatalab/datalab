// ChartDataCommand.java
//

package com.google.cloud.datalab.charting;

import java.util.*;
import com.beust.jcommander.*;
import com.google.cloud.datalab.charting.data.*;
import ijava.data.*;
import ijava.extensibility.*;

/**
 * Handles the %_chartData command used to retrieve chart data in a format usable with the
 * Google Charting API.
 */
public final class ChartDataCommand extends Command<ChartDataCommand.Options> {

  public ChartDataCommand(Shell shell) {
    super(shell, Options.class);
  }

  @Override
  public Object evaluate(Options options, long evaluationID,
                         Map<String, Object> metadata) throws Exception {
    String name = options.names.get(0);

    Object value = getShell().getVariable(name);
    if (value == null) {
      throw new EvaluationError("The name '" + name + "' doesn't exist or is null.");
    }

    if (!List.class.isAssignableFrom(value.getClass())) {
      throw new EvaluationError("The name '" + name + "' refers to non-list data.");
    }

    Map<String, Object> dataTable = ChartData.createDataTable((List<?>)value, null);
    return new Data(dataTable);
  }


  public static final class Options extends CommandOptions {

    @Parameter(description  = "The name of the variable to retrieve as chart data")
    public List<String> names = new ArrayList<String>();
  }
}
