// ChartCommand.java
//

package com.google.cloud.datalab.charting;

import java.util.*;
import ijava.data.*;
import ijava.extensibility.*;

/**
 * Handles the %%chart command.
 */
public final class ChartCommand implements Command {

  private static final Set<String> ChartTypes;

  private Shell _shell;

  static {
    ChartTypes = new HashSet<String>();
    ChartCommand.ChartTypes.add("area");
    ChartCommand.ChartTypes.add("bars");
    ChartCommand.ChartTypes.add("columns");
    ChartCommand.ChartTypes.add("histogram");
    ChartCommand.ChartTypes.add("line");
    ChartCommand.ChartTypes.add("pie");
    ChartCommand.ChartTypes.add("scatter");
    ChartCommand.ChartTypes.add("table");
  }

  public ChartCommand(Shell shell) {
    _shell = shell;
  }

  @Override
  public Object evaluate(String arguments, String data, long evaluationID,
                         Map<String, Object> metadata) throws Exception {
    String[] args = arguments.split(" ");
    if (args.length != 2) {
      throw new EvaluationError("Invalid chart command. " +
          "The chart type and the variable containing the data to be charted must be specified.");
    }

    String chartType = args[0];
    if (!ChartCommand.ChartTypes.contains(chartType)) {
      throw new EvaluationError("The chart type '" + chartType + "' is not a supported.");
    }

    String dataVariable = args[1];
    if (!_shell.getVariableNames().contains(dataVariable) ||
        !List.class.isAssignableFrom(_shell.getVariable(dataVariable).getClass())) {
      throw new EvaluationError("The name '" + dataVariable +
          "' does not correspond to a known list variable.");
    }

    if ((data == null) || data.isEmpty()) {
      data = "{}";
    }

    String script = "charts.render(dom, '" + chartType + "', '" + dataVariable + "', " + data +");";

    return new HTML("").addScript(script)
        .addScriptDependency("extensions/charting", "charts");
  }
}
