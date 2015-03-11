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
$(function() {
    IPython.Kernel.prototype.get_data = function(code, callback) {
        function shellHandler(reply) {
            if (!callback) {
                return;
            }

            var content = reply.content;
            if (!content || (content.status != 'ok')) {
                callback(null, new Error('Unable to retrieve values.'));
                callback = null;
            }
        }

        function iopubHandler(output) {
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
            catch(e) {
                error = e;
            }

            if (values) {
                callback(values);
            }
            else {
                callback(null, error || new Error('Unexpected value data retrieved.'));
            }
            callback = null;
        }

        try {
            var callbacks = {
                shell: { reply: shellHandler },
                iopub: { output: iopubHandler }
            };
            this.execute(code, callbacks, { silent: false, store_history: false });
        }
        catch (e) {
            callback(null, e);
        }
    };
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
    // TODO(gram): change these to minified versions once we are stable.
    'crossfilter': '//cdnjs.cloudflare.com/ajax/libs/crossfilter/1.3.11/crossfilter',
    'dc': '//cdnjs.cloudflare.com/ajax/libs/dc/1.7.3/dc',
    'd3': '//cdnjs.cloudflare.com/ajax/libs/d3/3.4.13/d3'
  },
  shim: {
    'crossfilter': {
      deps: [],
      exports: 'crossfilter'
    }
  }
});

// WebSocket shim to send socket messages over vanilla HTTP requests.
// This is only used when websocket support is not available. Specifically, it is not
// used when accessing IPython over http://localhost or http://127.0.0.1.

function overrideWebSocket() {
  // This replaces the native WebSocket functionality with one that is
  // similar in API surface area, but uses XMLHttpRequest and long-polling
  // instead... to account for server scenario that aren't WebSocket friendly.

  var READYSTATE_OPENING = 0;
  var READYSTATE_OPENED = 1;
  var READYSTATE_CLOSING = 2;
  var READYSTATE_CLOSED = 3;

  var XHR_LOADED = 4;

  function placeHolder() {
  }

  function xhr(action, data, callback) {
    callback = callback || placeHolder;

    var request = new XMLHttpRequest();
    request.open('POST', '/socket/' + action, true);
    request.onload = function() {
      if (request.readyState == XHR_LOADED) {
        request.onload = placeHolder;

        if (request.status == 200) {
          callback(null, JSON.parse(request.responseText));
        }
        else {
          callback(new Error(request.status));
        }
      }
    }

    if (data) {
      request.setRequestHeader('Content-Type', 'application/json');
      data = JSON.stringify(data);
    }
    request.send(data);
  }

  function createXHRTransport(socket) {
    var id = null;
    var polling = false;

    function send(msg) {
      xhr('send?id=' + id, { msg: msg });
    }

    function close() {
      polling = false;
      xhr('close', { socket: id });

      socket.readyState = READYSTATE_CLOSED;
      try {
        socket.onclose({ target: socket });
      }
      catch(e) {
      }
    }

    function pollTick() {
      // Issue a poll request to the server to fetch any pending events.
      // This request will not complete until either there is data, or a
      // timeout occurs.
      xhr('poll?id=' + id, null, function(e, data) {
        if (socket.readyState >= READYSTATE_CLOSING) {
          return;
        }

        if (!e) {
          var events = data.events || [];
          events.forEach(function(event) {
            switch (event.type) {
              case 'close':
                close({ target: socket });
                break;
              case 'message':
                try {
                  socket.onmessage({ target: socket, data: event.msg });
                }
                catch (e) {
                }
                break;
            }
          });
        }
        else {
          socket.onerror(new Error('Error listening to socket.'));
        }

        // Immediately queue another poll request. The net result is there
        // is always one out-going poll request per socket to the server,
        // which is completed as soon as there are events pending on the server,
        // or some timeout.
        poll();
      });
    }

    function poll() {
      if (polling) {
        // Complete current event processing and queue next poll.
        setTimeout(pollTick, 0)
      }
    }

    xhr('open?url=' + encodeURIComponent(socket._url), null, function(e, data) {
      if (!e && data.id) {
        id = data.id;
        polling = true;

        socket.readyState = READYSTATE_OPENED;
        try {
          socket.onopen({ target: socket });
        }
        catch(e) {
        }

        poll();
      }
      else {
        socket.onerror(new Error('Unable to open socket.'));
      }
    });

    return {
      send: send,
      close: close
    }
  }

  function Socket(url) {
    this._url = url;

    this.readyState = READYSTATE_OPENING;
    this._transport = createXHRTransport(this);
  }
  Socket.prototype = {
    onopen: placeHolder,
    onclose: placeHolder,
    onmessage: placeHolder,
    onerror: placeHolder,

    send: function(msg) {
      if (this.readyState != READYSTATE_OPENED) {
        throw new Error('Socket is not in opened state.');
      }

      this._transport.send(msg);
    },

    close: function() {
      if (this.readyState >= READYSTATE_CLOSING) {
        return;
      }

      this.readyState = READYSTATE_CLOSING;
      this._transport.close();
      this._transport = null;
    }
  }

  window.WebSocket = Socket;
}

// This is not needed while running on GCE, where websockets work fine.
// if ((document.domain != 'localhost') && (document.domain != '127.0.0.1')) {
//   overrideWebSocket();
// }


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
