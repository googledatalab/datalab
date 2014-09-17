// Type definitions for node-http-proxy node module v1.4.3
//

/// <reference path="../node/node.d.ts" />

declare module 'http-proxy' {
  import events = require('events');
  import http = require('http');
  import net = require('net');

  export interface ProxyServerOptions {
    target: string;
  }

  export interface ProxyServer extends events.EventEmitter {
    web(request: http.ServerRequest, response: http.ServerResponse): void;
    ws(request: http.ServerRequest, socket: net.Socket, head: Buffer): void;
    listen(options: any): void;
    close(): void;
  }

  export function createProxyServer(options: ProxyServerOptions): ProxyServer;
}
