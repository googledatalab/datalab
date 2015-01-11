// DataflowDataCommand.java
//

package com.google.cloud.datalab.dataflow;

import java.util.*;
import com.google.cloud.datalab.charting.data.*;
import ijava.data.*;
import ijava.extensibility.*;

public final class DataflowDataCommand implements Command {

  private final DataflowExtension _extension;

  public DataflowDataCommand(DataflowExtension extension) {
    _extension = extension;
  }

  @Override
  public Object evaluate(String arguments, String data, long evaluationID,
                         Map<String, Object> metadata) throws Exception {
    List<?> list = null;

    InteractivePipelineResult pipelineResult = _extension.getPipelineResult();
    if (pipelineResult != null) {
      list = pipelineResult.getCollection(arguments);
    }

    if (list != null) {
      Map<String, Object> dataTable = ChartData.createDataTable(list, null);
      return new Data(dataTable);
    }

    return new Data(null);
  }
}
