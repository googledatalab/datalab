// ChartCommand.java
//

package com.google.cloud.datalab.charting;

import java.util.*;
import com.beust.jcommander.*;
import ijava.data.*;
import ijava.extensibility.*;

/**
 * Handles the %%chart command.
 */
public final class ChartCommand extends Command<ChartCommand.Options> {

  private static final Set<String> ChartTypes;

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
    super(shell, Options.class, /* singleLine */ false);
  }

  @Override
  public Object evaluate(Options options, long evaluationID,
                         Map<String, Object> metadata) throws Exception {
    if (!ChartCommand.ChartTypes.contains(options.type)) {
      throw new EvaluationError("The chart type '" + options.type + "' is not a supported.");
    }

    if (!getShell().getVariableNames().contains(options.data) ||
        !List.class.isAssignableFrom(getShell().getVariable(options.data).getClass())) {
      throw new EvaluationError("The name '" + options.data +
          "' does not correspond to a known list variable.");
    }

    String chartOptions = options.getContent();
    if ((chartOptions == null) || chartOptions.isEmpty()) {
      chartOptions = "{}";
    }

    String script = "charts.render(dom, '" + options.type + "', '" +
        options.data + "', " + chartOptions +");";

    return new HTML("").addScript(script)
        .addScriptDependency("extensions/charting", "charts");
  }


  public static final class Options extends CommandOptions {

    @Parameter(names = "--type", description = "The type of chart to render", required = true)
    public String type;

    @Parameter(names = "--data", description = "The name of the variable containing chart data",
        required = true)
    public String data;
  }
}
