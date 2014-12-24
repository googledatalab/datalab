define([ 'd3', 'dagred3' ], function(d3, dagre) {

  function extendOutgoingEdges(nodes) {
    // This copies the edge between a parent node and the node that consumes
    // its output to create a new edge starting from the last child in the parent
    // node.
    // This is needed, as in the scenario when the parent node is expanded, and its
    // incoming and outgoing edges are not rendered, the equivalent edges will exist
    // from the children, so as to preserve connectedness of the graph, and
    // subsequently the desired layout.

    nodes.forEach(function(node) {
      // No edges, or no children implies nothing to extend
      if (!node.edges || !node.edges.length ||
          !node.nodes || !node.nodes.length) {
        return;
      }

      node.nodes.forEach(function(childNode) {
        if (!childNode.edges || !childNode.edges.length) {
          childNode.edges = node.edges;
        }
      });

      extendOutgoingEdges(node.nodes);
    });
    return nodes;
  }

  function Pipeline(data) {
    this._data = extendOutgoingEdges(data);
  }
  Pipeline.prototype.visitNodes = function(visitor, context) {
    var nodeStack = [];

    function pushNodes(nodes) {
      nodes.forEach(function(node) {
        nodeStack.push(node);
      });
    }

    pushNodes(this._data);
    while (nodeStack.length) {
      var node = nodeStack.pop();
      var visitChildren = visitor(node, context);

      if (visitChildren && node.nodes) {
        pushNodes(node.nodes);
      }
    }
  }
  Pipeline.prototype.createGraphModel = function() {
    var graphModel = new dagre.graphlib.Graph({ compound: true, directed: true });
    graphModel.setGraph({
      nodesep: 70,
      ranksep: 50,
      rankdir: 'LR',
      marginx: 20,
      marginy: 20
    });
    graphModel.setDefaultNodeLabel(function() { return {}; });
    graphModel.setDefaultEdgeLabel(function() { return {}; });

    this.visitNodes(Pipeline.visitors.populateNodes, graphModel);
    this.visitNodes(Pipeline.visitors.populateEdges, graphModel);
    this.visitNodes(Pipeline.visitors.populateClusters, graphModel);

    return graphModel;
  }
  Pipeline.prototype.toggleNode = function(id) {
    var query = { id: id };
    this.visitNodes(Pipeline.visitors.findNode, query);

    var node = query.node;
    if (node && node.nodes && node.nodes.length) {
      node.expanded = !node.expanded;
      return true;
    }

    return false;
  }
  Pipeline.visitors = {
    findNode: function(node, query) {
      if (query.node) {
        // Already successfully found the node, so don't bother going
        // deeper into any children
        return false;
      }

      if (node.id == query.id) {
        // Record the matching node in the query - this is the result
        // of the visiting the pipeline. And since the node has been found, don't
        // go any deeper.
        query.node = node;
        return false;
      }

      // Look at child nodes if they exist.
      return true;
    },

    populateNodes: function(node, graphModel) {
      // Only create nodes for leaf-level nodes, or parent nodes that
      // haven't been expanded
      if (!node.expanded) {
        // The label is padded at the end to create some whitespace for
        // nodes that can expand to fit an expander widget.
        var suffix = node.nodes && node.nodes.length ? '      ' : '';
        graphModel.setNode(node.id,
                           { label: node.name + suffix, node: node, shape: 'node' });
      }

      // Visit children if this node is expanded
      return node.expanded;
    },

    populateEdges: function(node1, graphModel) {
      // Only create edges from leaf-level nodes, or parent ndoes that
      // haven't been expanded
      if (!node1.expanded && node1.edges) {
        node1.edges.forEach(function(node2id) {
          // Only represent edges to nodes that have been added to the
          // graph. This filters out edges to children of non-expanded
          // nodes, as well as parent nodes that have been expanded.
          var graphNode = graphModel.node(node2id);
          if (graphNode && !graphNode.node.expanded) {
              graphModel.setEdge(node1.id, node2id, {
                lineInterpolate: 'monotone',
                arrowhead: 'none'
              });
          }
        });
      }

      // Visit children if this node is expanded
      return node1.expanded;
    },

    populateClusters: function(parentNode, graphModel) {
      // Create a cluster for each parent node that has been expanded.
      if (parentNode.expanded) {
        parentNode.nodes.forEach(function(childNode) {
          graphModel.setParent(childNode.id, parentNode.id);
        });

        // Visit children for nested clusters
        return true;
      }

      // Since this node is not expanded, no need to visit any children.
      return false;
    }
  };

  function PipelineGraph(svg, pipeline) {
    svg.append('defs')
       .append('marker').attr('id', 'circle-marker')
                        .attr('viewbox', '0 0 8 8')
                        .attr('markerWidth', 8)
                        .attr('markerHeight', 8)
                        .attr('refX', 4)
                        .attr('refY', 4)
                        .attr('orient', 'auto')
       .append('circle').attr('r', 4)
                        .attr('cx', 4)
                        .attr('cy', 4);

    this._renderer = dagre.render();
    this._renderer.shapes().node = PipelineGraph.elements.node;
    this._renderer.arrows().none = PipelineGraph.elements.noArrow;

    this._svg = svg;
    this._g = svg.select('g');
    this._zoom = d3.behavior.zoom()
                            .scaleExtent([.25,3])
                            .on('zoom', this._onZoom.bind(this));
    svg.call(this._zoom);

    this._pipeline = pipeline;
    this._graphModel = pipeline.createGraphModel();
  }
  PipelineGraph.prototype.render = function() {
    this._renderer(this._g, this._graphModel);

    this._svg.selectAll('g.edgePath path').attr('marker-start', 'url(#circle-marker)');
    this._svg.selectAll('g.cluster').each(PipelineGraph.elements.cluster);
    this._svg.selectAll('text').attr('pointer-events', 'none');
    this._svg.selectAll('rect.expander').on('click', this._onClick.bind(this));
    this._svg.selectAll('rect.collapser').on('click', this._onClick.bind(this));

    this._svg.attr('height', this._graphModel.graph().height * this._zoom.scale() + 40);
  }
  PipelineGraph.prototype._onZoom = function() {
    this._g.attr('transform', 'translate(' + d3.event.translate[0] + ', 0)' +
                              'scale(' + d3.event.scale + ')');
    this._svg.attr('height', this._graphModel.graph().height * d3.event.scale);
  }
  PipelineGraph.prototype._onClick = function(id) {
    if (this._pipeline.toggleNode(id)) {
      this._graphModel = this._pipeline.createGraphModel();
      this.render();
    }
  }
  PipelineGraph.elements = {
    node: function(parent, bbox, node) {
      node.intersect = function(point) {
        return dagre.intersect.rect(node, point);
      };

      var x = -bbox.width / 2;
      var y = -bbox.height / 2;
      var radius = 2;

      var g = parent.insert('g', ':first-child');
      g.append('rect')
       .attr('rx', radius)
       .attr('ry', radius)
       .attr('x', x)
       .attr('y', y)
       .attr('width', bbox.width)
       .attr('height', bbox.height)
       .classed('node', true);

      var statusPath = 'M' + (x+2) + ',' + y +
                       'h' + (bbox.width - 2 * radius) +
                       'a' + radius + ',' + radius + ' 0 0 1 ' + radius + ',' + radius +
                       'v' + radius +
                       'h' + (-bbox.width) +
                       'v' + (-radius) +
                       'a' + radius + ',' + radius + ' 0 0 1 ' + radius + ',' + (-radius) +
                       'z';
      g.append('path')
       .attr('d', statusPath)
       .classed('node-status', true);

      var modelNode = node.node;
      if (modelNode.nodes && modelNode.nodes.length) {
        var expanderLeft = x + bbox.width - 5 - 12;
        var expanderTop = y + bbox.height / 2 - 12 / 2;

        var expanderPath = 'M' + expanderLeft + ',' + expanderTop + ' ' +
                           'm0,4 l4,-4 l4,4 ' +
                           'm0,3 l-4,4 l-4,-4';
        g.append('rect')
         .attr('x', expanderLeft - 2)
         .attr('y', expanderTop - 2)
         .attr('width', 14)
         .attr('height', 14)
         .classed('expander', true);
        g.append('path')
         .attr('d', expanderPath)
         .attr('pointer-events', 'none')
         .classed('expander', true);
      }

      return g;
    },
    noArrow: function(parent, id, edge, type) {
      // Do nothing - we don't want an arrow on the end-point of the
      // edge, as we'll have a circle at the start-point instead.
    },
    cluster: function(cluster) {
      var g = d3.select(this);

      var rect = g.select('rect');
      var x = parseFloat(rect.attr('x'));
      var y = parseFloat(rect.attr('y'));
      var w = parseFloat(rect.attr('width'));

      var collapserLeft = x + w - 5 - 12;
      var collapserTop = y + 7;

      var collapserPath = 'M' + collapserLeft + ',' + collapserTop + ' ' +
                          'l4,4 l4,-4 ' +
                          'm0,11' +
                          'l-4,-4 l-4,4';

      var collapser = g.select('path.collapser');
      var collapserRect = g.select('rect.collapser');
      if (collapser.empty()) {
        collapserRect = g.insert('rect')
                         .attr('x', collapserLeft - 2)
                         .attr('y', collapserTop - 2)
                         .attr('width', 14)
                         .attr('height', 14)
                         .classed('collapser', true);
        collapser = g.insert('path')
                     .attr('pointer-events', 'none')
                     .classed('collapser', true);
      }

      collapser.attr('d', collapserPath);
      collapserRect.attr('x', collapserLeft - 2)
                   .attr('y', collapserTop - 2)
                   .attr('width', 14)
                   .attr('height', 14);

      var label = g.select('text');
      if (label.empty()) {
        var text = cluster;
        var slashIndex = text.lastIndexOf('/');
        if (slashIndex > 0) {
          text = text.substr(slashIndex + 1);
        }

        label = g.insert('text')
                 .attr('x', collapserLeft - 5)
                 .attr('y', collapserTop + 10)
                 .attr('text-anchor', 'end')
                 .text(text);
      }

      label.attr('x', collapserLeft - 5);
    }
  };

  function renderPipeline(dom, data) {
    var svg = d3.select(dom.getElementsByTagName('svg')[0]);
    var pipeline = new Pipeline(data);

    var pipelineGraph = new PipelineGraph(svg, pipeline);
    pipelineGraph.render();
  }

  return {
    renderPipeline: renderPipeline
  };
});
