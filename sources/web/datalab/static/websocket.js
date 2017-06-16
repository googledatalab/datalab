define(['util'], (util) => {

  function shouldShimWebsockets() {
    if (document.body.getAttribute('data-proxy-web-sockets') == 'true') {
      return true;
    }
    return location.host.toLowerCase().substr(-12) === '.appspot.com';
  }

  // Override WebSocket
  (function() {
    if (!window.io) {
      // If socket.io was not loaded into the page, then do not override the existing
      // WebSocket functionality.
      return;
    }

    function WebSocketShim(url) {
      var self = this;
      this._url = url;
      this.readyState = WebSocketShim.CLOSED;

      var socketUri = location.protocol + '//' + location.host + '/session';
      var basePath = document.body.getAttribute('data-base-url');
      var socketOptions = {
        path: basePath + 'socket.io',
        upgrade: false,
        multiplex: false
      };

      function errorHandler() {
        if (self.onerror) {
          self.onerror({ target: self });
        }
      }
      var socket = io.connect(socketUri, socketOptions);
      socket.on('connect', function() {
        socket.emit('start', { url: url });
      });
      socket.on('disconnect', function() {
        self._socket = null;
        self.readyState = WebSocketShim.CLOSED;
        if (self.onclose) {
          self.onclose({ target: self });
        }
      });
      socket.on('open', function(msg) {
        self._socket = socket;
        self.readyState = WebSocketShim.OPEN;
        if (self.onopen) {
          self.onopen({ target: self });
        }
      });
      socket.on('close', function(msg) {
        self._socket = null;
        self.readyState = WebSocketShim.CLOSED;
        if (self.onclose) {
          self.onclose({ target: self });
        }
      });
      socket.on('data', function(msg) {
        if (self.onmessage) {
          self.onmessage({ target: self, data: msg.data });
        }
      });
      socket.on('error', errorHandler);
      socket.on('connect_error', errorHandler);
      socket.on('reconnect_error', errorHandler);
    }
    WebSocketShim.prototype = {
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,

      send: function(data) {
        if (this.readyState != WebSocketShim.OPEN) {
          throw new Error('WebSocket is not yet opened');
        }
        this._socket.emit('data', { data: data });
      },

      close: function() {
        if (this.readyState == WebSocketShim.OPEN) {
          this.readyState = WebSocketShim.CLOSED;

          this._socket.emit('stop', { url: this._url });
          this._socket.close();
        }
      }
    };
    WebSocketShim.CLOSED = 0;
    WebSocketShim.OPEN = 1;

    if (shouldShimWebsockets()) {
      util.debug.log('Replacing native websockets with socket.io');
      window.nativeWebSocket = window.WebSocket;
      window.WebSocket = WebSocketShim;
    }
  })();
});
