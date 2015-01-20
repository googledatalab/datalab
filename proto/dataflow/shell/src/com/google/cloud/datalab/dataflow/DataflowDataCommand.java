// DataflowDataCommand.java
//

package com.google.cloud.datalab.dataflow;

import java.util.*;
import com.beust.jcommander.*;
import com.google.cloud.datalab.charting.data.*;
import ijava.data.*;
import ijava.extensibility.*;

public final class DataflowDataCommand extends Command<DataflowDataCommand.Options> {

  private final DataflowExtension _extension;

  public DataflowDataCommand(Shell shell, DataflowExtension extension) {
    super(shell, Options.class);
    _extension = extension;
  }

  @Override
  public Object evaluate(Options options, long evaluationID,
                         Map<String, Object> metadata) throws Exception {
    List<?> list = null;
    String transform = options.transforms.get(0);

    InteractivePipelineResult pipelineResult = _extension.getPipelineResult();
    if (pipelineResult != null) {
      list = pipelineResult.getCollection(transform);
    }

    if (list != null) {
      Map<String, Object> dataTable = ChartData.createDataTable(list, null);
      return new Data(dataTable);
    }

    return new Data(null);
  }


  public static final class Options extends CommandOptions {

    @Parameter(description  = "The name of the transform to whose data should be retrieved")
    public List<String> transforms = new ArrayList();
  }
}
