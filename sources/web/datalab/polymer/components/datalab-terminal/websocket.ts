/*
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */

/// <reference path="../../node_modules/@types/socket.io-client/index.d.ts" />

enum WebSocketState {
  CLOSED = 0,
  OPEN = 1,
}

/**
 * Wrapper for socket.io to expose the same interface as native WebSocket
 * object in a Datalab-compatible way. It communicates with a special endpoint
 * on the Datalab server that expects socket.io traffic and converts it back to
 * WebSocket.
 */
class DatalabWebSocketShim {
  public readyState: WebSocketState;
  public onerror: ((_: any) => void)|null = null;
  public onopen: ((_: any) => void)|null = null;
  public onclose: ((_: any) => void)|null = null;
  public onmessage: ((_: any) => void)|null = null;

  private _socket: SocketIOClient.Socket|null;
  private _url: string;

  constructor(url: string) {
    this._url = url;
    this.readyState = WebSocketState.CLOSED;

    ApiManager.getBasePath()
      .then((basepath: string) => {
        const socketUri = location.protocol + '//' + location.host + '/session';
        const socketOptions: SocketIOClient.ConnectOpts = {
          multiplex: false,
          path: basepath + '/socket.io',
          upgrade: false,
        };

        const errorHandler = () => {
          if (this.onerror) {
            this.onerror({ target: self });
          }
        };

        this._socket = io.connect(socketUri, socketOptions);
        this._socket.on('connect', () => {
          if (this._socket) {
            this._socket.emit('start', { url });
          }
        });
        this._socket.on('disconnect', () => {
          this._socket = null;
          this.readyState = WebSocketState.CLOSED;
          if (this.onclose) {
            this.onclose({ target: self });
          }
        });
        this._socket.on('open', () => {
          this.readyState = WebSocketState.OPEN;
          if (this.onopen) {
            this.onopen({ target: self });
          }
        });
        this._socket.on('close', () => {
          this._socket = null;
          this.readyState = WebSocketState.CLOSED;
          if (this.onclose) {
            this.onclose({ target: self });
          }
        });
        this._socket.on('data', (msg: any) => {
          if (this.onmessage) {
            this.onmessage({ target: self, data: msg.data });
          }
        });

        this._socket.on('error', errorHandler);
        this._socket.on('connect_error', errorHandler);
        this._socket.on('reconnect_error', errorHandler);
      });
  }

  send(data: any) {
    if (this.readyState !== WebSocketState.OPEN) {
      throw new Error('WebSocket is not yet opened.');
    }
    if (this._socket) {
      this._socket.emit('data', {data});
    }
  }

  close() {
    if (this.readyState === WebSocketState.OPEN) {
      this.readyState = WebSocketState.CLOSED;
      if (this._socket) {
        this._socket.emit('stop', {url: this._url});
        this._socket.close();
      }
    }
  }
}
