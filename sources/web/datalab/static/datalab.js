/*
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var debug = {
  enabled: true,
  log: function() { console.log.apply(console, arguments); }
};

// Install Google Analytics - this is the standard tracking code, reformatted.
(function(i, s, o, g, r, a, m) {
  i['GoogleAnalyticsObject'] = r;
  i[r] = i[r] || function() {
    (i[r].q = i[r].q || []).push(arguments)
  };
  i[r].l = 1 * new Date();
  a = s.createElement(o);
  m = s.getElementsByTagName(o)[0];
  a.async = 1;
  a.src = g;
  m.parentNode.insertBefore(a, m)
})(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');


(function() {
  var cookieString = document.cookie;
  var cookies = cookieString.split('; ');
  var gcpCookie = '';

  cookies.forEach(function(cookie) {
    if (cookie.indexOf('gcp=') == 0) {
      gcpCookie = cookie.substr(4);
    }
  });

  if (gcpCookie) {
    var cookieData = gcpCookie.split(':');
    if (cookieData.length == 5) {
      var analyticsId = cookieData[0];
      var dimensions = {
        // project
        'dimension1': cookieData[1],

        // version
        'dimension2': cookieData[2],

        // instance
        'dimension3': cookieData[3]
      };

      ga('create', analyticsId, 'auto');
      ga('send', 'pageview', dimensions);
    }
  }
})();


// Add TOC functionality
function setupOutline() {
  if (!IPython.toolbar || !IPython.notebook) {
    return;
  }

  var markup = '<select id="tocDropDown" style="float: right"><option>Outline</option></select>';
  IPython.toolbar.element.append(markup);

  var tocDropDown = $('#tocDropDown');
  tocDropDown.change(function(e) {
    var index = tocDropDown.val();
    if (index.length === '') {
      return;
    }

    var scrollTop = IPython.notebook.get_cell(0).element.position().top -
                    IPython.notebook.get_cell(parseInt(index)).element.position().top;
    IPython.notebook.element.animate({ scrollTop: -scrollTop }, 250, 'easeInOutCubic');

    tocDropDown.blur();
    tocDropDown.find('option').get(0).selected = true;

    return false;
  });

  function createOption(title, value, level) {
    var prefix = level > 1 ? new Array(level + 1).join('&nbsp;&nbsp;') : '';
    var text = prefix + IPython.utils.escape_html(title);

    return '<option value="' + value + '">' + text + '</option>';
  }

  function updateOutline() {
    var content = [];
    content.push(createOption('Table of Contents', '', 0));

    var cells = IPython.notebook.get_cells();
    cells.forEach(function(c, i) {
      if ((c.cell_type == 'heading') && (c.level <= 3)) {
        var cell = $(c.element);
        var header = cell.find('h' + c.level);

        // Retrieve the title and strip off the trailing paragraph marker
        var title = header.text();
        title = title.substring(-1, title.length - 1);

        if (title == 'Type Heading Here') {
          // New cells have this placeholder text in them
          return;
        }

        content.push(createOption(title, i, c.level));
      }
    });

    var markup = content.join('');
    tocDropDown.html(markup);
  }

  updateOutline();
  $([IPython.events]).on('set_dirty.Notebook', function(event, data) {
    updateOutline();
  });
  $([IPython.events]).on('command_mode.Cell', function(event, data) {
    updateOutline();
  });
}
setTimeout(setupOutline, 1000);

// Kernel related functionality
$(function () {
  IPython.Kernel.prototype.get_data = function (code, callback) {
    function shellHandler(reply) {
      if (!callback) {
        return;
      }

      var content = reply.content;
      if (!content || (content.status != 'ok')) {
        callback(new Error('Unable to retrieve values.'), null);
        callback = null;
      }
    }

    function iopubHandler(output) {

      if (output.msg_type == 'stream') {
        // This is to allow the embedding of print statements for diagnostics.
        debug.log(output.content.data.toString());
        return;
      }

      if (!callback) {
        return;
      }
      var values = null;
      var error = null;
      try {
        if (output.msg_type == 'display_data' || output.msg_type == 'pyout') {
          var data = output.content.data;
          if (data) {
            values = JSON.parse(data['application/json']);
          }
        }
      }
      catch (e) {
        error = e;
      }

      if (values) {
        callback(null, values);
      }
      else {
        callback(error || new Error('Unexpected value data retrieved.'), null);
      }
      callback = null;
    }

    try {
      var callbacks = {
        shell: {reply: shellHandler},
        iopub: {output: iopubHandler}
      };
      this.execute(code, callbacks, {silent: false, store_history: false});
    }
    catch (e) {
      callback(e, null);
    }
  };

  // Create a shim object to emulate the datalab global's interface.
  window.datalab = {
    kernel: {
      // Provide a shimmed getData() method that delegates to the IPython global.
      getData: function(code, callback) {
        IPython.notebook.kernel.get_data(code, callback);
      }
    }
  }
});

// Configure code mirror
// - Add %%bigquery udf to the list of javascript cells to the existing configuration.
// - Load sql mode and associate %%bigquery sql cells with SQL.
IPython.config.cell_magic_highlight.magic_javascript.reg = [ /^%%javascript/, /^%%bigquery udf/ ];

require(['/static/components/codemirror/mode/sql/sql.js'], function() {
  IPython.config.cell_magic_highlight['magic_text/x-sql'] = {
    reg: [
      /^%%bigquery sql/
    ]
  };
});


// Configure RequireJS
// - Enable loading static content easily from static directory
//   (static/foo -> /static/foo.js)
// - D3
require.config({
  paths: {
    'static': '/static',
    'extensions': '/static/extensions',
    'd3': '//cdnjs.cloudflare.com/ajax/libs/d3/3.4.13/d3',
    'element': '/static/require/element',
    'style': '/static/require/style',
    'visualization': '/static/require/visualization',
    'sockets': '/static/require/sockets'
  }
});

require(['sockets!session'], function(socket) {
  // Shim layer that overrides WebSocket functionality in the browser and
  // replaces it with a custom implementation that uses socketio.sockets
  // (forced into fallback mode).
  // This is because managed VMs do not support WebSockets.
  // Instead what we use is a socket.io session on the server that behaves
  // like the client, i.e. opens WebSocket connections to IPython from within
  // server code.

  // The socket dependency represents a connected socket.io socket to the
  // 'session' socket namespace.

  var webSockets = {};
  var kernel = '';

  function startSession() {
    socket.emit('start', { kernel: kernel });
  }

  function stopSession() {
    socket.emit('stop', { kernel: kernel });
  }

  socket.on('kernel', function(msg) {
    // Message sent from the server to indicate WebSockets to the kernel
    // have been opened on the server. Use this to mark the shim WebSocket
    // instances as ready.

    for (var channel in webSockets) {
      var ws = webSockets[channel];
      if ((kernel == msg.kernel) && (ws.readyState == 0)) {
        ws.readyState = 1;
        if (ws.onopen) {
          ws.onopen({ target: ws });
        }
      }
    }
  });
  socket.on('data', function(msg) {
    // Message sent from the server for messages recieved on one of the
    // IPython WebSocket connections. Raise the message event on the appropriate
    // WebSocket shim.

    var ws = webSockets[msg.channel];
    if (ws && ws.onmessage) {
      ws.onmessage({ target: ws, data: msg.data });
    }
  });
  socket.on('connect', function() {
    // This handles reconnection scenarios.
    startSession();
  });
  socket.on('disconnect', function() {
    for (var channel in webSockets) {
      var ws = webSockets[channel];
      if (ws.readyState == 1) {
        ws.readyState = 0;
        if (ws.onclose) {
          ws.onclose({ target: ws });
        }
      }
    }
  });

  function WebSocketShim(url) {
    this.readyState = 0;

    // The socket URL is of the form ws://domain/api/kernels/kernelid/channel.
    var urlParts = url.split('/');
    kernel = urlParts[urlParts.length - 2];

    this._channel = urlParts[urlParts.length - 1];
    webSockets[this._channel] = this;

    startSession();
  }
  WebSocketShim.prototype = {
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,

    send: function(data) {
      // Data sent to the WebSocket is converted into a message sent to
      // the session socket for propagation to the corresponding WebSocket
      // connection on the server.
      if (this.readyState != 1) {
        throw new Error('WebSocket is not yet opened');
      }
      socket.emit('senddata', { channel: this._channel, data: data });
    },

    close: function() {
      // Explicitly closed WebSockets generate messages sent to the session
      // socket for closing its WebSocket connections on the server.
      stopSession();

      delete webSockets[this._channel];
      this.readyState = 0;

      var self = this;
      setTimeout(function() {
        if (self.onclose) {
          self.onclose({ target: self });
        }
      }, 0);
    }
  }

  window.WebSocket = WebSocketShim;
});


// Notebook List page specific functionality
if (IPython.NotebookList) {
  // IPython seems to assume local persistence of notebooks - it issues an HTTP
  // request to create a notebook, and on completion opens a window.
  // This is fine and dandy when the round-trip time is small, but sometimes long
  // enough when notebooks are remote (as they are with GCS) to trigger the popup
  // blocker in browsers.
  // Patch the new_notebook method to first open the window, and then navigate it
  // rather than open upon completion of the operation.

  IPython.NotebookList.prototype.new_notebook = function() {
    var path = this.notebook_path;
    var base_url = this.base_url;
    var notebook_window = window.open('', '_blank');

    var settings = {
      processData : false,
      cache : false,
      type : 'POST',
      dataType : 'json',
      async : false,
      success : function(data, status, xhr) {
        var notebook_name = data.name;
        url = IPython.utils.url_join_encode(base_url, 'notebooks', path, notebook_name);
        notebook_window.location.href = url;
      },
      error : $.proxy(this.new_notebook_failed, this),
    };
    var url = IPython.utils.url_join_encode(base_url, 'api/notebooks', path);
    $.ajax(url, settings);
  }
}
