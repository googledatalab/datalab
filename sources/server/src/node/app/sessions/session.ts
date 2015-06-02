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

/// <reference path="../common/interfaces.d.ts" />
/// <reference path="../../../../../../externs/ts/node/node-uuid.d.ts" />
/// <reference path="../../../../../../externs/ts/node/async.d.ts" />
import actions = require('../shared/actions');
import async = require('async');
import cells = require('../shared/cells');
import logging = require('../common/logging');
import updates = require('../shared/updates');
import util = require('../common/util');
import uuid = require('node-uuid');


var logger = logging.getLogger();

/**
 * Binds a user connection to a kernel and routes communication between them.
 *
 * A session also provides hooks for routing messages through the message pipeline/middleware
 * before sending the messages to their final destination (either kernel or user).
 */
export class Session implements app.ISession {

  createdAt: Date;
  path: string;

  _connections: app.IClientConnection[];
  _executionQueue: app.ExecuteRequest[];
  _isKernelExecutionPending: boolean;
  _isNotebookSaveRequested: boolean;
  _isNotebookSavePending: boolean;
  _kernel: app.IKernel;
  _kernelManager: app.IKernelManager;
  _notebook: app.INotebookSession;
  _notebookStorage: app.INotebookStorage;

  /**
   * All messages flowing in either direction between user<->kernel will pass through this handler.
   */
  _messageHandler: app.MessageHandler;

  constructor(
      path: string,
      kernelManager: app.IKernelManager,
      messageHandler: app.MessageHandler,
      notebookStorage: app.INotebookStorage) {

    this.createdAt = new Date(); // Record current time.
    this.path = path;

    this._connections = [];
    this._isNotebookSaveRequested = false;
    this._isNotebookSavePending = false;
    this._kernelManager = kernelManager;
    this._messageHandler = messageHandler;
    this._notebookStorage = notebookStorage;
  }

  /**
   * Associates the user connection with this session.
   *
   * A user connection update might occur when a user refreshes their browser, resulting in
   * destruction of previously establishd user<->server connection.
   *
   * This method allows a user to reestablish connection with an existing/running kernel, because
   * the kernel is associated with the session, rather than the user connection.
   */
  addClientConnection(connection: app.IClientConnection) {
    // Add the connection to the "connected" set
    this._connections.push(connection);

    // Send the initial notebook state at the time of connection, if it is available.
    this._broadcastNotebookSnapshot([connection]);
  }

  /**
   * Gets the id of the kernel currently associated with this session.
   *
   * @return The ID of the associated kernel instance, or null if none exists.
   */
  getKernelId(): string {
    return (this._kernel && this._kernel.id) || null;
  }

  /**
   * Gets the set of user connections currently associated with this session.
   *
   * @return Array of connection IDs for currently connected clients.
   */
  getClientConnectionIds(): string[] {
    return this._connections.map((connection) => {
      return connection.id;
    });
  }

  /**
   * Delegates an incoming action request (from client) to the middleware stack.
   */
  processAction(connection: app.IClientConnection, action: app.notebooks.actions.Action) {
    var nextAction = this._handleAction.bind(this, connection);
    this._messageHandler(action, this, nextAction);
  }

  /**
   * Delegates an incoming execute reply (from kernel) to the middleware stack.
   */
  processExecuteReply(reply: app.ExecuteReply) {
    var nextAction = this._handleExecuteReply.bind(this);
    this._messageHandler(reply, this, nextAction);
  }

  /**
   * Receives and processes kernel health check events.
   *
   * @param kernelIsHealthy Is the kernel currently healthy?
   */
  processKernelHealthCheck(kernelIsHealthy: boolean) {
    if (kernelIsHealthy) {
      // Nothing to do if the kernel is still healthy.
      return;
    }

    // Kernel is not healthy, so spawn a new kernel.

    // Notify the user that the kernel is restarting.
    this.processKernelStatus({
      status: 'restarting',
      requestId: uuid.v4()
    });

    // Respawn kernel.
    this.reset((error) => {
      if (error) {
        // If restarting the kernel fails, log it.
        logger.error('Error when attempting to restart kernel: ', error);
        // TODO(bryantd): decide how to attempt recovery if restart fails.
        // Could destroy the session, or just retry with backoff for a fixed number of times.
      }

      // Nothing to do in the success case. The kernel will send status update messages as it
      // comes online and these will be forwarded to connected clients.
    });
  }

  /**
   * Delegates in incoming kernel status (from kernel) to the middleware stack.
   */
  processKernelStatus(status: app.KernelStatus) {
    var nextAction = this._handleKernelStatus.bind(this);
    this._messageHandler(status, this, nextAction);
  }

  /**
   * Delegates incoming kernel output data message to the middleware stack.
   */
  processOutputData(outputData: app.OutputData) {
    var nextAction = this._handleOutputData.bind(this);
    this._messageHandler(outputData, this, nextAction);
  }

  /**
   * Deassociates the user connection with this session.
   *
   * Typically called when the connection has been closed.
   */
  removeClientConnection(connection: app.IClientConnection) {
    // Find the index of the connection and remove it.
    for (var i = 0; i < this._connections.length; ++i) {
      if (this._connections[i].id == connection.id) {
        // Found the connection. Remove it.
        this._connections.splice(i, 1);
        return;
      }
    }

    // Unexpectedly, the specified connection was not participating in the session.
    throw util.createError(
        'Connection id "%s" was not found in session id "%s"', connection.id, this.path);
  }

  /**
   * Asynchronously resets the session state.
   *
   * Shuts down any existing kernel and spawns a new kernel.
   *
   * @param callback Completion callback to invoke after the reset has finished.
   */
  reset(callback: app.Callback<void>) {
    this._spawnKernel(callback);
  }

  /**
   * Shuts down the kernel associated with the session.
   *
   * @param callback Completion callback to invoke after shutdown has finished.
   */
  shutdown(callback: app.Callback<void>) {
    // Shutdown is triggered immediately and no waiting for completion/failure is done currently.
    this._shutdownKernel();

    // Notify all connected clients that the session is shutting down.
    this._broadcastSessionShutdown();

    // Provide the expected async semantics by deferring callback invocation until next tick.
    process.nextTick(callback);
  }

  /**
   * Asynchronously starts the session running.
   *
   * @param callback Completion callback to invoke upon the startup process concluding.
   */
  start(callback: app.Callback<void>) {
    // Initialize the kernel and notebook session asynchronously and wait for both to complete
    // or one of them to error before moving on.
    async.parallel({

        // Spawn an appropriate kernel for the given notebook asynchronously.
        kernel: this._spawnKernel.bind(this),

        // Initialize the notebook session asynchronously.
        notebook: this._initNotebook.bind(this)
      },

      // Callback executed upon completion of both kernel and notebook init (or in the case where
      // either of operation errors out).
      (error) => {
        // Regardless of success, inform caller that the start operation is finished processing.
        callback(error);
      }
    );
  }

  /**
   * Broadcast a notification to connected clients that the session is going into shutdown.
   */
  _broadcastSessionShutdown() {
    this._broadcastUpdate({
      name: updates.notebook.sessionStatus,
      shutdown: true
    });
  }

  /**
   * Broadcast a notification to connected clients that notebook loading has failed.
   */
  _broadcastNotebookLoadFailed() {
    this._broadcastUpdate({
      name: updates.notebook.sessionStatus,
      notebookLoadFailed: true
    });
  }

  /**
   * Sends a snapshot of the current notebook state to all connected clients.
   *
   * @param connections The set of connection IDs to broadcast to.
   */
  _broadcastNotebookSnapshot(connections: app.IClientConnection[]) {
    // No-op if there is not an existing notebook to broadcast.
    //
    // This will be the case if the async loading of the notebook has not completed before a client
    // connects to the session.
    if (this._notebook) {

      // Get a data-only snapshot of the notebook.
      var snapshot = {
        name: updates.notebook.snapshot,
        notebook: this._notebook.getNotebookData()
      };

      // Send the snapshot to each connected client.
      connections.forEach((connection) => {
        connection.sendUpdate(snapshot);
      });
    }
  }

  /**
   * Broadcast the latest persistence status to clients.
   *
   * @param lastSaveSucceeded Did the latest persistence operation succeed?
   */
  _broadcastPersistenceStatus(lastSaveSucceeded: boolean) {
    var sessionStatus: app.notebooks.updates.SessionStatus = {
      name: updates.notebook.sessionStatus,
      saveState: lastSaveSucceeded ? 'succeeded' : 'failed'
    };

    if (lastSaveSucceeded) {
      // If the most recent save succeeded, also include the current timestamp.
      sessionStatus.lastSaved = Date.now().toString();
    }
    this._broadcastUpdate(sessionStatus);
  }

  /**
   * Sends the given update message to all user connections associated with this session.
   */
  _broadcastUpdate(update: app.notebooks.updates.Update) {
    this._connections.forEach((connection) => {
      connection.sendUpdate(update);
    });
  }

  /**
   * Clears the kernel execution queue.
   */
  _clearExecutionQueue() {
    this._executionQueue = [];
  }

  /**
   * Queues a given execute request for kernel execution (FIFO ordering).
   *
   * @param request The execution request to queue.
   */
  _execute(request: app.ExecuteRequest) {
    // Queue the request for execution.
    this._executionQueue.push(request);

    // Update the cell's state to denote it is waiting to be executed.
    if (request.requestContext.cellId) {
      this._handleActionNotebookData({
        name: actions.cell.update,
        worksheetId: request.requestContext.worksheetId,
        cellId: request.requestContext.cellId,
        state: cells.states.pending
      });
    }

    // Attempt to execute the request immediately if possible.
    this._executeNextQueued();
  }

  /**
   * Sends the execute request at the front of the (FIFO) queue to the kernel.
   */
  _executeNextQueued() {
    if (this._executionQueue.length == 0 || this._isKernelExecutionPending) {
      // Kernel is busy or there is nothing to execute. Nothing to do for now.
      return;
    }

    // Get the next request at the front of the queue.
    var request = this._executionQueue.shift();

    // Update the state of the cell being executed, if the request corresponds to a cell.
    if (request.requestContext.cellId) {
      this._handleActionNotebookData({
        name: actions.cell.update,
        worksheetId: request.requestContext.worksheetId,
        cellId: request.requestContext.cellId,
        state: cells.states.executing
      });
    }

    // Send the execution request to the kernel.
    this._isKernelExecutionPending = true;
    this._kernel.execute(request);
  }

  /**
   * Gets a connection by ID.
   *
   * Throws an exception if no connection with the given ID exists.
   *
   * @param connectionId The ID of the connection to get.
   * @return The requested connection.
   */
  _getConnectionOrThrow(connectionId: string) {
    for (var i = 0; i < this._connections.length; ++i) {
      if (connectionId == this._connections[i].id) {
        return this._connections[i];
      }
    }
    throw util.createError('No connection with ID "%s" exists.', connectionId);
  }

  _handleExecuteReply(message: any) {
    // Determine if the execute reply corresponds to a cell or kernel execute request.
    var metadata = message.requestContext;
    if (metadata.connectionId) {
      this._handleKernelExecuteReply(<app.ExecuteReply>message);
    } else if (metadata.cellId && metadata.worksheetId) {
      this._handleCellExecuteReply(<app.ExecuteReply>message);
    } else {
      // Missing request routing metadata. Nothing can be done with the message.
      logger.error('Received execute reply message with no recipient: ', message);
    }

    // Kernel is now available if a reply has been received.
    this._isKernelExecutionPending = false;
    // Attempt to execute the next queued request, if there is one.
    this._executeNextQueued();
  }

  /**
   * Send the execute reply message back to the single client that requested it.
   *
   * @param reply The execute reply message received.
   */
  _handleKernelExecuteReply(reply: app.ExecuteReply) {
    // The execute reply contains any errors if the request failed, but not the actual execution
    // result (which arrives separately as output data of type="result").
    //
    // So, only send the client a message if there was an error here.
    if (reply.success) {
      // Nothing available to return to the client from a successful reply message.
      return;
    }

    // An error occurred; respond with the details.
    try {
      var connection = this._getConnectionOrThrow(reply.requestContext.connectionId);
      connection.sendUpdate({
        name: updates.kernel.executeResult,
        // Respond with the request ID provided by the client in the original execute request.
        requestId: reply.requestId,
        // Return an output/result with type=error and error details.
        result: util.createErrorOutput(reply.errorName, reply.errorMessage, reply.traceback)
      });
    } catch(error) {
      // Nothing can be done if the given connection does not exist.
      logger.debug('Kernel execute reply arrived but, receiving client is unavailable: %s', error);
    }

    // Cancel any waiting executions since an error occurred.
    this._clearExecutionQueue();
  }

  // Handlers for messages flowing in either direction between user<->kernel.
  //
  // Each of the following methods delegates an incoming message to the middleware stack and
  // sets up a (post-delegation) callback to forward the message to the appropriate entity
  // (where "entity" is either a kernel or a user connection).

  /**
   * Applies execute reply data to the notebook model and broadcasts an update message.
   */
  _handleCellExecuteReply(message: any) {
    // Capture the cell modifications as an update action.
    var action: app.notebooks.actions.UpdateCell = {
      name: actions.cell.update,
      worksheetId: message.requestContext.worksheetId,
      cellId: message.requestContext.cellId,
      prompt: message.executionCounter
    };

    if (message.success) {
      // Mark the cell as having executed successfully.
      action.state = cells.states.success;
    } else {
      // Also add the error messaging as a cell output if an error has occurred.
      action.outputs = [
        util.createErrorOutput(message.errorName, message.errorMessage, message.traceback)
      ];

      action.state = cells.states.error;

      // Cancel any waiting executions since an error occurred.
      this._clearExecutionQueue();
    }

    // Apply the upate to the notebook.
    this._handleActionNotebookData(action);
  }

  /**
   * Handles the action request by updating the notebook model, issuing kernel requests, etc.
   */
  _handleAction(connection: app.IClientConnection, action: any) {
    switch (action.name) {
      case actions.composite:
        this._handleActionComposite(connection, action);
        break;

      case actions.cell.execute:
        this._handleActionExecuteCell(action);
        break;

      case actions.notebook.executeCells:
        this._handleActionExecuteCells(action);
        break;

      case actions.kernel.execute:
        this._handleActionExecute(connection, action);
        break;

      case actions.cell.clearOutput:
      case actions.cell.update:
      case actions.worksheet.addCell:
      case actions.worksheet.deleteCell:
      case actions.worksheet.moveCell:
      case actions.notebook.clearOutputs:
        this._handleActionNotebookData(action);
        break;

      default:
        throw util.createError('No handler found for action message type "%s"', action.name);
    }
  }

  /**
   * Handles a composite action by sequentially applying each contained sub-action.
   */
  _handleActionComposite(connection: app.IClientConnection, action: app.notebooks.actions.Composite) {
    action.subActions.forEach(this._handleAction.bind(this, connection));
  }

  /**
   * Handles multiple notebook action types by applying them to the notebook session.
   */
  _handleActionNotebookData(action: app.notebooks.actions.UpdateCell) {
    try {
      var update = this._notebook.apply(action);
      // Persist the notebook state to storage
      this._save();
      // Update all clients about the notebook data change.
      this._broadcastUpdate(update);
    } catch (error) {
      // It is possible that the notebook state changed such that it is no longer possible to
      // apply a given action.
      //
      // TODO(bryantd): surface action application errors back to the client.
      logger.error('Could not apply requested notebook action %s due to %s',
          JSON.stringify(action), error);
    }
  }

  _handleActionExecute(connection: app.IClientConnection, action: app.notebooks.actions.Execute) {
    // Request will have a declared request ID that should be used for tracking.
    this._execute({
      requestId: action.requestId,
      requestContext: {
        connectionId: connection.id
      },
      code: action.source
    });
  }

  /**
   * Handles an execute cell action by generating a kernel execute request.
   */
  _handleActionExecuteCell(action: app.notebooks.actions.ExecuteCell) {
    try {
      // Retrieve the current state of the cell that should be executed.
      var cell = this._notebook.getCellOrThrow(action.cellId, action.worksheetId);

      // Request that the kernel execute the code snippet.
      this._execute({
        // Generate a kernel request ID (kernels are not aware of cells, just "requests").
        requestId: uuid.v4(),
        // Messages generated in response to this request will have the following metadata.
        requestContext: {
          cellId: action.cellId,
          worksheetId: action.worksheetId
        },
        code: cell.source
      });
    } catch (error) {
      // Cell was not found within the expected worksheet.
      //
      // It is possible that the notebook state changed between when the user issued the execute
      // request and when the request reached the server for processing, thereby invalidating the
      // execute request.
      //
      // TODO(bryantd): surface execute request failure back to the client.
      logger.error('Could not execute specified cell %s due to %s', action.cellId, error);
    }
  }

  /**
   * Handles an execute (all) cells action by executing each code cell within the notebook.
   */
  _handleActionExecuteCells(action: app.notebooks.actions.ExecuteCells) {
    var notebookData = this._notebook.getNotebookData();
    // Execute all cells in each worksheet
    notebookData.worksheets.forEach((worksheet) => {
      worksheet.cells.forEach((cell) => {
        if (cell.type == cells.code) {
          this._handleActionExecuteCell({
            name: actions.cell.execute,
            worksheetId: worksheet.id,
            cellId: cell.id
          });
        }
      });
    });
  }

  /**
   * Forwards the kernel status to the user, post-middleware stack processing.
   */
  _handleKernelStatus(message: any) {
    this._broadcastUpdate({
      name: updates.notebook.sessionStatus,
      // TODO(bryantd): add other session metdata here such as connected users, etc. eventually.
      kernelState: message.status
    });
  }

  _handleOutputData(message: any) {
    // Determine if the output data corresponds to a cell or kernel execute request.
    var metadata = message.requestContext;
    if (metadata.connectionId) {
      this._handleKernelOutputData(<app.OutputData>message);
    } else if (metadata.cellId && metadata.worksheetId) {
      this._handleCellOutputData(<app.OutputData>message);
    } else {
      // Missing request routing metadata. Nothing can be done with the message.
      logger.error('Received output data message with no recipient: %s', message);
    }
  }

  _handleKernelOutputData(output: app.OutputData) {
    try {
      // Send the execution output the requesting client.
      var connection = this._getConnectionOrThrow(output.requestContext.connectionId);
      connection.sendUpdate({
        name: updates.kernel.executeResult,
        // Respond with the request ID provided by the client in the original execute request.
        requestId: output.requestId,
        result: output
      });
    } catch(error) {
      // Nothing can be done if the connection does not exist.
      logger.debug('Received output data, but receiving client no longer available: %s', output);
    }
  }

  /**
   * Handles a kernel output data message by attaching the output data to the appropriate cell.
   */
  _handleCellOutputData(output: app.OutputData) {
    // Construct an update to append the specified output data.
    var action: app.notebooks.actions.UpdateCell = {
      name: actions.cell.update,
      worksheetId: output.requestContext.worksheetId,
      cellId: output.requestContext.cellId,
      outputs: [{
        type: output.type,
        mimetypeBundle: output.mimetypeBundle
      }]
    };

    // Apply the output data update to the notebook model.
    this._handleActionNotebookData(action);
  }

  /**
   * Asynchronously initializes the notebook state and sends a snapshot to connected clients.
   *
   * @param callback Completion callback to invoke once initialization is complete.
   */
  _initNotebook(callback: app.Callback<void>) {
    this._notebookStorage.read(
      this.path,
      (error: any, notebook: app.INotebookSession) => {
        if (error) {
          // TODO(bryantd): add retry with backoff logic here.

          // Notify any connected clients that notebook loading has failed.
          this._broadcastNotebookLoadFailed();

          callback(error);
          return;
        }

        // Store the notebook.
        this._notebook = notebook;
        // Broadcast the notebook to any connected clients.
        this._broadcastNotebookSnapshot(this._connections);
        // Initialized successfully. Invoke the completion callback.
        callback(null);
    });
  }

  /**
   * Asynchronously persists the current notebook state to the notebook storage.
   *
   * Because concurrent asynchronous writes to the same notebook path may conflict,
   * this method serializes writes to the notebook storage backend, such that later
   * saves are always persisted after an earlier save.
   *
   * Furthermore, since the entire notebook snapshot is being written to storage on
   * each save, intermediate snapshots are not needed for maintaining the notebook
   * state in the storage backend (i.e., each save is not an incremental changes, but rather
   * the entire notebook state).
   *
   * This means that for a sequence of N snapshots, only the latest (most recent) snapshot is
   * needed, since it would overwrite all of the intervening snapshots when it is ultimately
   * applied.
   *
   * Given this, save has the followings semantics:
   * 1) If there is no in-flight/pending save operation, then save the current snapshot immediately
   * 2) If there is a pending save operation, wait until the operation completes and then save
   *    the latest snapshot, regardless of the number of save() calls that happened in the interim.
   *
   * This strategy ensures that conflicting writes aren't issued concurrently and that the latest
   * notebook state is updated as soon as possible upon completion of pending writes.
   */
  _save() {
    // If there is already a pending save operation, we must wait until it completes to save.
    if (this._isNotebookSavePending) {
      // Note the requested save operation.
      this._isNotebookSaveRequested = true;
      // Nothing else can be done at the moment.
      return;
    }

    // No pending save operation, so issue the save operation immediately.

    // A new save operation is now pending.
    this._isNotebookSavePending = true;

    // Write the notebook state to storage asynchronously.
    this._notebookStorage.write(this.path, this._notebook, (error) => {

      // Send a persistence state update to clients.
      //
      // If the save operattion failed, the UI will surface this to the user and allow the client
      // to proceed as they wish (IPython behavior). e.g., "Save failed" should be displayed
      // where the auto-save ("last saved at <time>") info is shown.
      //
      // TODO(bryantd): Add retry with backoff logic here for failed save operations.
      this._broadcastPersistenceStatus(!!error); // Note: !!value converts the object to a boolean.

      // If a notebook save has been requested since the last save was issued, then we can now save
      // the current state of the notebook.
      if (this._isNotebookSaveRequested) {
        // Clear the save request flag since we are saving the current/latest notebook state.
        this._isNotebookSaveRequested = false;
        // Save the notebook on next tick.
        this._save();
      }

      // Current save operation completed. Clear pending flag.
      this._isNotebookSavePending = false;
    });
  }

  /**
   * Synchronously shutdown the kernel associated with the session, if one exists.
   *
   * @param callback Completion callback to invoke upon the kernel shutdown operation completing.
   */
  _shutdownKernel() {
    if (this._kernel) {
      this._kernelManager.shutdown(this._kernel.id);
    }
  }

  /**
   * Spawns an appropriate kernel for the current notebook.
   *
   * Note: at the moment, kernel (re)spawning does two things:
   *
   * 1) shut down any existing kernel process
   * 2) create and start a new kernel process
   *
   * Both of these operations are called in a synchronous fashion currently, but this method
   * provides an async interface, taking a completion callback to facilitate integration into
   * async flows.
   *
   * TODO(bryantd): eventually it will become necessary to read kernel config metadata from
   * the persisted notebook file (e.g., kernel language + version). For now, all kernels are
   * simply Python 2.7+ kernels.
   *
   * @param callback Completion callback
   */
  _spawnKernel(callback: app.Callback<void>) {
    // Kill the existing kernel.
    this._shutdownKernel();

    // Initialize the execution queue for the kernel.
    this._executionQueue = [];
    this._isKernelExecutionPending = false;

    // Spawn a new kernel for the session.
    //
    // Kernel creation is asynchronous and should it fail, the kernel health checking will detect
    // the setup failure and trigger a kernel respawn and inform connected clients.
    this._kernel = this._kernelManager.create(
        uuid.v4(),
        {
          heartbeatPort: util.getAvailablePort(),
          iopubPort: util.getAvailablePort(),
          shellPort: util.getAvailablePort()
        },
        this.processExecuteReply.bind(this),
        this.processKernelHealthCheck.bind(this),
        this.processKernelStatus.bind(this),
        this.processOutputData.bind(this));

    // Defer callback invocation until the next tick to provide expected async behavior.
    process.nextTick(callback);
  }
}
