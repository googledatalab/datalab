/*
 * Copyright 2015 Google Inc. All rights reserved.
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


/**
 * Common utility functions for HTTP APIs.
 */
/// <reference path="../../../../../../externs/ts/express/express.d.ts" />
import express = require('express');


// TODO(bryantd): use a real logging system for emitting request errors in some consistent
// format so that logging output can be easily digested/summarized; e.g., statistics on
// 500 Server Error rate for flagging issues).
//
// Also need to log additional request details for failures to aid in diagnosing issues.

export function sendBadRequest(response: express.Response, message: string) {
  console.log('ERROR HTTP 400: ' + message);
  response.status(400);
  response.send(message);
}

export function sendInternalError(response: express.Response, message: string, error: Error) {
  console.log('ERROR HTTP 500: ' + message);
  response.status(500);
  response.send(message);
}

export function sendNotFound(response: express.Response, message: string) {
  console.log('ERROR HTTP 404: ' + message);
  response.status(404);
  response.send(message);
}

export function sendSuccessWithoutResponseContent(response: express.Response) {
  // Notify caller of operation success via 204 to denote no content returned in response body.
  response.sendStatus(204);
}
