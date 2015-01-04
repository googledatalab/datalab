// Dataflow.java
//

package com.google.cloud.dataflow.sdk;

import com.google.cloud.dataflow.sdk.options.*;
import com.google.cloud.dataflow.sdk.transforms.PTransform;
import com.google.cloud.dataflow.sdk.values.PCollection;
import com.google.cloud.dataflow.sdk.values.PInput;
import com.google.cloud.dataflow.sdk.values.POutput;

/**
 * Implemented by developers to define a dataflow to execute.
 */
public abstract class Dataflow {

  private String[] _args;
  private DataRegistry _dataRegistry;

  /**
   * Gets the list of arguments specified when the dataflow is run.
   * @return the list of arguments passed into the dataflow.
   */
  protected final String[] getArguments() {
    if (_args == null) {
      return new String[0];
    }
    return _args;
  }

  /**
   * Creates and initializes the pipeline associated with the dataflow.
   * @param options the PipelineOptions to use to create the pipeline.
   * @return the pipeline, initialized with its transform graph.
   */
  public final Pipeline createPipeline(PipelineOptions options) {
    Pipeline pipeline = Pipeline.create(options);
    initializePipeline(pipeline);

    return pipeline;
  }

  /**
   * Initializes the dataflow.
   * @param dataRegistry the registry of named collections that can be referenced.
   * @param args the list of arguments passed into the dataflow.
   */
  public void initialize(DataRegistry dataRegistry, String[] args) {
    _dataRegistry = dataRegistry;
    _args = args;
  }

  /**
   * Initializes the pipeline by building the transform graph to execute.
   * @param pipeline the pipeline instance to initialize.
   */
  protected abstract void initializePipeline(Pipeline pipeline);

  /**
   * Creates a new DataSet that is initialized to resolve a read
   * transform of the specified name from a registry.
   * @param name the name to lookup during transform resolution.
   * @return a new instance of a PCollectionSource.
   */
  public <T> DataSet<T> readFrom(String name) {
    return readFrom(name, /* transform */ null);
  }

  /**
   * Creates a new DataSet that is initialized to resolve a read
   * transform of the specified name from a registry.
   * @param name the name to lookup during transform resolution.
   * @return a new instance of a PCollectionSource.
   */
  public <T> DataSet<T> readFrom(String name, PTransform<PInput, PCollection<T>> transform) {
    if ((name == null) || name.isEmpty()) {
      throw new IllegalArgumentException("A valid name must be specified.");
    }

    return new DataSet<T>(DataSet.Mode.Reader, this, name, transform, /* writeTransform */ null);
  }

  /**
   * Creates a new DataSet that is initialized to resolve a write
   * transform of the specified name from a registry.
   * @param name the name to lookup during transform resolution.
   * @return a new instance of a PCollectionSink.
   */
  public <T> DataSet<T> writeTo(String name) {
    return writeTo(name, /* transform */ null);
  }

  /**
   * Creates a new DataSet that is initialized to resolve a write
   * transform of the specified name from a registry.
   * @param name the name to lookup during transform resolution.
   * @param transform the transform to use if the specified name cannot be resolved.
   * @return a new instance of a PCollectionSink.
   */
  public <T> DataSet<T> writeTo(String name, PTransform<PCollection<T>, POutput> transform) {
    if ((name == null) || name.isEmpty()) {
      throw new IllegalArgumentException("A valid name must be specified.");
    }

    return new DataSet<T>(DataSet.Mode.Writer, this, name, /* readTransform */ null, transform);
  }

  <T> PTransform<PInput, PCollection<T>> resolveReader(String name) {
    if (_dataRegistry != null) {
      return _dataRegistry.resolveReader(name);
    }

    return null;
  }

  <T> PTransform<PCollection<T>, POutput> resolveWriter(String name) {
    if (_dataRegistry != null) {
      return _dataRegistry.resolveWriter(name);
    }

    return null;
  }
}
