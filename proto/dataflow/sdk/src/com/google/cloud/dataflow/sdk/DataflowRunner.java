// DataflowRunner.java
//

package com.google.cloud.dataflow.sdk;

import java.util.*;
import java.util.logging.*;
import com.google.cloud.dataflow.sdk.options.*;
import com.google.cloud.dataflow.sdk.runners.*;
import com.google.cloud.dataflow.sdk.transforms.*;
import com.google.cloud.dataflow.sdk.values.*;

/**
 * Provides functionality to run data processing functionality within pipelines, PTransforms
 * and DoFns to facilitate independent testing.
 * @param <I> the type of the input items.
 * @param <O> the type of the output items.
 */
public final class DataflowRunner<I, O> {

  private final DoFn<I, O> _doFn;
  private final PTransform<PCollection<I>, PCollection<O>> _transform;

  /**
   * Initializes a DataflowRunner for a DoFn instance.
   * @param doFn the DoFn to run.
   */
  private DataflowRunner(DoFn<I, O> doFn) {
    _doFn = doFn;
    _transform = null;
  }

  /**
   * Initializes a DataflowRunner for a PTransform instance.
   * @param transform the PTransform to run.
   */
  private DataflowRunner(PTransform<PCollection<I>, PCollection<O>> transform) {
    _transform = transform;
    _doFn = null;
  }

  /**
   * Creates a DataflowRunner associated with a DoFn instance.
   * @param doFn the DoFn to run.
   */
  public static <I, O> DataflowRunner<I, O> of(DoFn<I, O> doFn) {
    return new DataflowRunner<I, O>(doFn);
  }

  /**
   * Creates a DataflowRunner associated with a PTransform instance.
   * @param transform the PTransform to run.
   */
  public static <I, O> DataflowRunner<I, O> of(PTransform<PCollection<I>, PCollection<O>> transform) {
    return new DataflowRunner<I, O>(transform);
  }

  /**
   * Runs the dataflow logic for the specified input item.
   * @param inputItem the input item to run through the dataflow logic.
   * @return the resulting list of output items.
   */
  public List<O> process(I inputItem) {
    List<I> inputList = new ArrayList<I>();
    inputList.add(inputItem);

    return process(inputList);
  }

  /**
   * Runs the dataflow logic for the specified input items.
   * @param inputList the list of input items to run through the dataflow logic.
   * @return the resulting list of output items.
   */
  public List<O> process(List<I> inputList) {
    Logger rootLogger = LogManager.getLogManager().getLogger("");
    Level loggingLevel = rootLogger.getLevel();

    try {
      // Turn off the spew from the dataflow sdk
      rootLogger.setLevel(Level.OFF);

      return processInternal(inputList);
    }
    finally {
      rootLogger.setLevel(loggingLevel);
    }
  }

  private List<O> processInternal(List<I> inputList) {
    PipelineOptions options = PipelineOptionsFactory.create();
    DirectPipelineRunner runner = DirectPipelineRunner.fromOptions(options)
        .withSerializabilityTesting(false)
        .withEncodabilityTesting(false)
        .withUnorderednessTesting(false);

    Pipeline pipeline = Pipeline.create(options);
    PCollection<I> input = pipeline.apply(Create.of(inputList));
    PCollection<O> output;

    if (_doFn != null) {
      output = input.apply(ParDo.of(_doFn));
    }
    else {
      output = input.apply(_transform);
    }

    DirectPipelineRunner.EvaluationResults results = runner.run(pipeline);
    return results.getPCollection(output);
  }
}
