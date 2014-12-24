// InteractivePipelineResult.java
//

package com.google.cloud.datalab.dataflow;

import java.util.*;
import com.google.cloud.dataflow.sdk.*;
import com.google.cloud.dataflow.sdk.runners.*;
import com.google.cloud.dataflow.sdk.transforms.*;
import com.google.cloud.dataflow.sdk.values.*;

public final class InteractivePipelineResult implements PipelineResult {

  private final Pipeline _pipeline;
  private final DirectPipelineRunner.EvaluationResults _results;
  private final Set<String> _outputs;

  public InteractivePipelineResult(Pipeline pipeline, DirectPipelineRunner.EvaluationResults results,
                                   Set<String> outputs) {
    _pipeline = pipeline;
    _results = results;
    _outputs = outputs;
  }

  public PipelineGraph createGraph() {
    return new PipelineGraph(_pipeline);
  }

  @SuppressWarnings({ "rawtypes", "unchecked" })
  public List getCollection(String name) {
    TransformFinder finder = new TransformFinder(name);
    _pipeline.traverseTopologically(finder);

    PTransform transform = finder.getTransform();
    if (transform != null) {
      return _results.getPCollection((PCollection)_pipeline.getOutput(transform));
    }

    return null;
  }

  public Set<String> getOutputs() {
    return _outputs;
  }


  @SuppressWarnings("rawtypes")
  private static final class TransformFinder implements Pipeline.PipelineVisitor {

    private final String _name;
    private PTransform _transform;

    public TransformFinder(String name) {
      _name = name;
    }

    public PTransform getTransform() {
      return _transform;
    }

    @Override
    public void enterCompositeTransform(TransformTreeNode node) {
    }

    @Override
    public void leaveCompositeTransform(TransformTreeNode node) {
    }

    @Override
    public void visitTransform(TransformTreeNode node) {
      if (node.getFullName().equals(_name)) {
        _transform = node.getTransform();
      }
    }

    @Override
    public void visitValue(PValue value, TransformTreeNode node) {
    }
  }
}
