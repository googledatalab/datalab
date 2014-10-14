/*
 * Copyright 2014 Google Inc. All rights reserved.
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
 * Binds a user connection to a kernel and routes communication between them
 *
 * A session also provides hooks for routing messages through the message pipeline/middleware
 * before sending the messages to their final destination (either kernel or user).
 */
export class Session implements app.ISession {

  id: string;

  _kernel: app.IKernel;
  _userconn: app.IUserConnection;
  /**
   * All messages flowing in either direction between user<->kernel will pass through this handler
   */
  _messageHandler: app.MessageHandler;

  constructor (
      id: string,
      userconn: app.IUserConnection,
      kernel: app.IKernel,
      messageHandler: app.MessageHandler) {
    this.id = id;
    this._kernel = kernel;
    this._registerKernelEventHandlers();
    this.updateUserConnection(userconn);
    this._messageHandler = messageHandler;
  }

  getKernelId (): string {
    return this._kernel.id;
  }

  getUserConnectionId (): string {
    return this._userconn.id;
  }

  /**
   * Updates the user connection associated with this session.
   *
   * A user connection update might occur when a user refreshes their browser, resulting in
   * destruction of previously establishd user<->server connection.
   *
   * This method allows a user to reestablish connection with an existing/running kernel.
   */
  updateUserConnection (userconn: app.IUserConnection) {
    this._userconn = userconn;
    this._registerUserEventHandlers();
  }

  // Handlers for messages flowing in either direction between user<->kernel
  //
  // Each of the following methods delegates an incoming message to the middleware stack and
  // sets up a (post-delegation) callback to forward the message to the appropriate entity
  // (where "entity" is either a kernel or a user connection).

  /**
   * Delegates an incoming execute reply (from kernel) to the middleware stack
   */
  _handleExecuteReplyPreDelegate (reply: app.ExecuteReply) {
    var nextAction = this._handleExecuteReplyPostDelegate.bind(this);
    this._messageHandler(reply, this, nextAction);
  }
  /**
   * Forwards the execute reply to the user, post-middleware stack processing
   */
  _handleExecuteReplyPostDelegate (message: any) {
    this._userconn.sendExecuteReply(message);
  }

  /**
   * Delegates an incoming execute result (from kernel) to the middleware stack
   */
  _handleExecuteResultPreDelegate (result: app.ExecuteResult) {
    var nextAction = this._handleExecuteResultPostDelegate.bind(this);
    this._messageHandler(result, this, nextAction);
  }
  /**
   * Forwards the execute result to the user, post-middleware stack processing
   */
  _handleExecuteResultPostDelegate (message: any) {
    this._userconn.sendExecuteResult(message);
  }

  /**
   * Delegates in incoming kernel status (from kernel) to the middleware stack
   */
  _handleKernelStatusPreDelegate (status: app.KernelStatus) {
    var nextAction = this._handleKernelStatusPostDelegate.bind(this);
    this._messageHandler(status, this, nextAction);
  }
  /**
   * Forwards the kernel status to the user, post-middleware stack processing
   */
  _handleKernelStatusPostDelegate (message: any) {
    this._userconn.sendKernelStatus(message);
  }

  /**
   * Delegates an incoming execute request (from user) to the middleware stack
   */
  _handleExecuteRequestPreDelegate (request: app.ExecuteRequest) {
    var nextAction = this._handleExecuteRequestPostDelegate.bind(this);
    this._messageHandler(request, this, nextAction);
  }
  /**
   * Forwards execute request to the kernel, post-middleware stack processing
   */
  _handleExecuteRequestPostDelegate (message: any) {
    this._kernel.execute(message);
  }

  _registerUserEventHandlers () {
    this._userconn.onExecuteRequest(this._handleExecuteRequestPreDelegate.bind(this));
  }

  _registerKernelEventHandlers () {
    this._kernel.onExecuteReply(this._handleExecuteReplyPreDelegate.bind(this));
    this._kernel.onExecuteResult(this._handleExecuteResultPreDelegate.bind(this));
    this._kernel.onKernelStatus(this._handleKernelStatusPreDelegate.bind(this));
  }
}
