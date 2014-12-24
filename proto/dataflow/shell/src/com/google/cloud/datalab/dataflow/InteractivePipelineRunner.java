// InteractivePipelineRunner.java
//

package com.google.cloud.datalab.dataflow;

import java.util.*;
import com.google.cloud.dataflow.sdk.*;
import com.google.cloud.dataflow.sdk.options.*;
import com.google.cloud.dataflow.sdk.runners.*;

public final class InteractivePipelineRunner extends PipelineRunner<InteractivePipelineResult> {

  private final ShellDataRegistry _dataRegistry;

  private final DirectPipelineRunner _runner;

  public InteractivePipelineRunner(ShellDataRegistry dataRegistry) {
    _dataRegistry = dataRegistry;

    PipelineOptions options = PipelineOptionsFactory.create();
    _runner = DirectPipelineRunner.fromOptions(options)
        .withSerializabilityTesting(false)
        .withEncodabilityTesting(false)
        .withUnorderednessTesting(false);
  }

  public PipelineOptions getPipelineOptions() {
    return _runner.getPipelineOptions();
  }

  @Override
  public InteractivePipelineResult run(Pipeline pipeline) {
    DirectPipelineRunner.EvaluationResults results = _runner.run(pipeline);
    Set<String> outputs = _dataRegistry.captureCollections();

    return new InteractivePipelineResult(pipeline, results, outputs);
  }
}
