/*
 * Copyright 2016 Google Inc. All rights reserved.
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

 /// <reference path="../../../externs/ts/node/node-ws.d.ts" />
 /// <reference path="../../../externs/ts/node/node.d.ts" />

import * as WebSocket from 'ws';
import * as http from 'http';
import * as logging from './logging';

/**
 * Proxies HTTP requests over websockets.
 *
 * This is used to allow connections to the local server from whitelisted https: origins since
 * ws: connections can be established when the browser would otherwise block http: connections
 * because of mixed content restrictions.
 *
 * Basic protocol is a JSON message with the following fields:
 *
 * - method: HTTP method (such as GET or POST)
 * - path: Path on this server which is being requested.
 * - message_id: Unique ID specified by client which is included in the response for pairing
 *     request/response pairs.
 * - data: Optional data to be included in POST requests.
 */
export class WsHttpProxy {
  constructor(server: http.Server, path: string, allowedOrigins: Array<string>) {
    this.run(server, path, allowedOrigins);
  }

  private run(server: http.Server, path: string, allowedOrigins: Array<string>): void {
    const wss = new WebSocket.Server({
      server,
      path,
    });
    wss.on('connection', (client: WebSocket) => {
      // Since web sockets are allowed cross-origin and cross protocol (http/https), need to be
      // strict about only allowing whitelisted origins.
      const origin = client.upgradeReq.headers.origin;
      if (allowedOrigins.indexOf(origin) == -1) {
        logging.getLogger().error('WebSocket origin not in allowedOrigins "%s"', origin);
        client.close();
      }

      client.on('message', (data: string) => {
        try {
          const request: any = JSON.parse(data);

          const options: any = {
            method: request.method,
            // Only support connections to this server.
            hostname: 'localhost',
            port: server.address().port,
            path: request.path,
          };
          // Requests have a unique message ID which is used by the client to differentiate
          // responses.
          const wsResponse: any = {
            message_id: request.message_id,
          };

          const httpRequest = http.request(options, (httpResponse: http.ClientResponse) => {
            wsResponse.status = httpResponse.statusCode;
            // Accumulate the full response and send as a single message over the websocket.
            wsResponse.data = '';
            httpResponse.on('data', (chunk: string) => {
              wsResponse.data += chunk;
            });
            httpResponse.on('end', () => {
              // Ensure that the socket hasn't been closed while the request was being processed.
              if (client.readyState === client.OPEN) {
                client.send(JSON.stringify(wsResponse));
              }
            });
          });
          // Optional POST data.
          if (request.body) {
            httpRequest.write(request.body);
          }
          httpRequest.end();
        } catch(error) {
          logging.getLogger().error('Uncaught error processing http over websocket "%s": %s',
              data, error);
        }
      });
    });
  }
}
