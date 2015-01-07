// PipelineGraph.java
//

package com.google.cloud.datalab.dataflow;

import java.io.*;
import java.util.*;
import com.fasterxml.jackson.jr.ob.*;
import com.google.cloud.dataflow.sdk.*;
import com.google.cloud.dataflow.sdk.runners.*;
import com.google.cloud.dataflow.sdk.values.*;
import ijava.data.*;

public final class PipelineGraph {

  private final Pipeline _pipeline;
  private final List<GraphNode> _nodes;

  public PipelineGraph(Pipeline pipeline) {
    _pipeline = pipeline;

    GraphBuilder graphBuilder = new GraphBuilder();
    _nodes = graphBuilder.buildGraph();
  }

  public HTML render() {
    try {
      StringBuilder sb = new StringBuilder();
      sb.append("dataflow.renderPipeline(dom, ");
      sb.append(JSON.std.asString(_nodes));
      sb.append(");");

      String script = sb.toString();

      HTML html = new HTML("<svg class=\"df-pipeline\" width=\"100%\" height=600><g /></svg>");
      return html.addScript(script).addScriptDependency("extensions/dataflow", "dataflow");
    }
    catch (IOException e) {
      return null;
    }
  }


  private final class GraphBuilder implements Pipeline.PipelineVisitor {

    private final List<GraphNode> _nodes;
    private final Stack<GraphNode> _nodeStack;
    private final Map<String, GraphNode> _nodeMap;

    public GraphBuilder() {
      _nodes = new ArrayList<GraphNode>();
      _nodeStack = new Stack<GraphNode>();
      _nodeMap = new HashMap<String, GraphNode>();
    }

    public List<GraphNode> buildGraph() {
      _pipeline.traverseTopologically(this);
      return _nodes;
    }

    private GraphNode addGraphNode(TransformTreeNode node) {
      String id = node.getFullName();
      String name = id;

      int slashIndex = name.lastIndexOf("/");
      if (slashIndex > 0) {
        name = name.substring(slashIndex + 1);
      }

      GraphNode graphNode = new GraphNode(id, name);
      _nodeMap.put(id, graphNode);

      for (Map.Entry<PValue, TransformTreeNode> inputEntry: node.getInputs().entrySet()) {
        GraphNode inputGraphNode = _nodeMap.get(inputEntry.getValue().getFullName());
        inputGraphNode.edges.add(id);
      }

      if (_nodeStack.size() != 0) {
        _nodeStack.peek().nodes.add(graphNode);
      }
      else {
        _nodes.add(graphNode);
      }

      return graphNode;
    }

    @Override
    public void enterCompositeTransform(TransformTreeNode node) {
      String fullName = node.getFullName();
      if (fullName.isEmpty()) {
        // Top-level composite transform node representing the pipeline itself
        return;
      }

      GraphNode graphNode = addGraphNode(node);
      _nodeStack.push(graphNode);
    }

    @Override
    public void leaveCompositeTransform(TransformTreeNode node) {
      String fullName = node.getFullName();
      if (fullName.isEmpty()) {
        // Top-level composite transform node representing the pipeline itself
        return;
      }

      _nodeStack.pop();
    }

    @Override
    public void visitTransform(TransformTreeNode node) {
      addGraphNode(node);
    }

    @Override
    public void visitValue(PValue value, TransformTreeNode node) {
      // TODO: Handle values
    }
  }


  @SuppressWarnings("serial")
  private final class GraphNode extends HashMap<String, Object> {

    public final List<GraphNode> nodes;
    public final List<String> edges;

    public GraphNode(String id, String name) {
      nodes = new ArrayList<GraphNode>();
      edges = new ArrayList<String>();

      put("id", id);
      put("name", name);
      put("nodes", nodes);
      put("edges", edges);
    }
  }
}
