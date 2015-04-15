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
import actions = require('../shared/actions');
import cells = require('../shared/cells');
import updates = require('../shared/updates');
import util = require('../common/util');
import uuid = require('node-uuid');


/**
 * Binds a user connection to a kernel and routes communication between them.
 *
 * A session also provides hooks for routing messages through the message pipeline/middleware
 * before sending the messages to their final destination (either kernel or user).
 */
export class Session implements app.ISession {

  path: string;

  _isNotebookSaveRequested: boolean;
  _isNotebookSavePending: boolean;
  _kernel: app.IKernel;
  _kernelManager: app.IKernelManager;
  _notebook: app.INotebookSession;
  _notebookStorage: app.INotebookStorage;
  _requestIdToCellRef: app.Map<app.CellRef>;
  _connections: app.IClientConnection[];

  /**
   * All messages flowing in either direction between user<->kernel will pass through this handler.
   */
  _messageHandler: app.MessageHandler;

  constructor (
      path: string,
      kernelManager: app.IKernelManager,
      messageHandler: app.MessageHandler,
      notebookPath: string,
      notebookStorage: app.INotebookStorage) {

    this.path = path;
    this._isNotebookSaveRequested = false;
    this._isNotebookSavePending = false;
    this._kernelManager = kernelManager;
    this._messageHandler = messageHandler;
    this._requestIdToCellRef = {};
    this._connections = [];
    this._notebookPath = notebookPath;
    this._notebookStorage = notebookStorage;

    // Initialize the notebook session asynchronously.
    this._initNotebook();

    // Spawn an appropriate kernel for the given notebook.
    this._spawnKernel();
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
  addClientConnection (connection: app.IClientConnection) {
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
  processAction (action: app.notebooks.actions.Action) {
    var nextAction = this._handleAction.bind(this);
    this._messageHandler(action, this, nextAction);
  }

  /**
   * Delegates an incoming execute reply (from kernel) to the middleware stack.
   */
  processExecuteReply (reply: app.ExecuteReply) {
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
    this._spawnKernel();
  }

  /**
   * Delegates in incoming kernel status (from kernel) to the middleware stack.
   */
  processKernelStatus (status: app.KernelStatus) {
    var nextAction = this._handleKernelStatus.bind(this);
    this._messageHandler(status, this, nextAction);
  }

  /**
   * Delegates incoming kernel output data message to the middleware stack.
   */
  processOutputData (outputData: app.OutputData) {
    var nextAction = this._handleOutputData.bind(this);
    this._messageHandler(outputData, this, nextAction);
  }

  /**
   * Deassociates the user connection with this session.
   *
   * Typically called when the connection has been closed.
   */
  removeClientConnection (connection: app.IClientConnection) {
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
   * Broadcast a notification to connected clients that notebook loading has failed.
   */
  _broadcastNotebookLoadFailed() {
    this._broadcastUpdate({
      name: updates.notebook.sessionStatus,
      notebookLoadFailed: true
    });
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
  _broadcastUpdate (update: app.notebooks.updates.Update) {
    this._connections.forEach((connection) => {
      connection.sendUpdate(update);
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

  // Handlers for messages flowing in either direction between user<->kernel.
  //
  // Each of the following methods delegates an incoming message to the middleware stack and
  // sets up a (post-delegation) callback to forward the message to the appropriate entity
  // (where "entity" is either a kernel or a user connection).

  /**
   * Applies execute reply data to the notebook model and broadcasts an update message.
   */
  _handleExecuteReply (message: any) {
    // Lookup the notebook cell to which this message corresponds.
    var cellRef = this._getCellRefForRequestId(message.requestId);
    if (!cellRef) {
      // Nothing to update.
      return;
    }

    // Capture the cell modifications as an update action.
    var action: app.notebooks.actions.UpdateCell = {
      name: actions.cell.update,
      worksheetId: cellRef.worksheetId,
      cellId: cellRef.cellId,
      prompt: message.executionCounter
    };
    // Also add the error messaging as a cell output if an error has occurred.
    if (message.errorName) {
      action.outputs = [
        util.createErrorOutput(message.errorName, message.errorMessage, message.traceback)
      ];
    }

    // Request that the notebook apply the cell update
    var update = this._notebook.apply(action);
    // Persist the notebook state to storage
    this._save();
    // Update connected clients that a change has occured.
    this._broadcastUpdate(update);
  }

  /**
   * Handles the action request by updating the notebook model, issuing kernel requests, etc.
   */
  _handleAction (action: any) {
    switch (action.name) {
      case actions.composite:
        this._handleActionComposite(action);
        break;

      case actions.cell.execute:
        this._handleActionExecuteCell(action);
        break;

      case actions.notebook.executeCells:
        this._handleActionExecuteCells(action);
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
  _handleActionComposite (action: app.notebooks.actions.Composite) {
    action.subActions.forEach(this._handleAction.bind(this));
  }

  /**
   * Handles multiple notebook action types by applying them to the notebook session.
   */
  _handleActionNotebookData (action: app.notebooks.actions.UpdateCell) {
    var update = this._notebook.apply(action);
    // Persist the notebook state to storage
    this._save();
    // Update all clients about the notebook data change.
    this._broadcastUpdate(update);
  }

  /**
   * Handles an execute cell action by generating a kernel execute request.
   */
  _handleActionExecuteCell (action: app.notebooks.actions.ExecuteCell) {
    // Generate a kernel request ID (kernels are not aware of cells, just "requests").
    var requestId = uuid.v4();

    // Store the mapping of request ID -> cellref for joining kernel response messages later.
    this._setCellRefForRequestId(requestId, {
      cellId: action.cellId,
      worksheetId: action.worksheetId
    });

    // Retrieve the current state of the cell that should be executed.
    var cell = this._notebook.getCellOrThrow(action.cellId, action.worksheetId);

    // Request that the kernel execute the code snippet.
    this._kernel.execute({
      requestId: requestId,
      code: cell.source
    });
  }

  /**
   * Handles an execute (all) cells action by executing each code cell within the notebook.
   */
  _handleActionExecuteCells (action: app.notebooks.actions.ExecuteCells) {
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
  _handleKernelStatus (message: any) {
    this._broadcastUpdate({
      name: updates.notebook.sessionStatus,
      // TODO(bryantd): add other session metdata here such as connected users, etc. eventually.
      kernelState: message.status
    });
  }

  /**
   * Handles a kernel output data message by attaching the output data to the appropriate cell.
   */
  _handleOutputData (message: any) {
    // Lookup the notebook cell to which this kernel message corresponds.
    var cellRef = this._getCellRefForRequestId(message.requestId);
    if (!cellRef) {
      // Nothing to update.
      return;
    }

    // Apply the output data update to the notebook model.
    var update = this._notebook.apply({
      name: actions.cell.update,
      worksheetId: cellRef.worksheetId,
      cellId: cellRef.cellId,
      outputs: [{
        type: message.type,
        mimetypeBundle: message.mimetypeBundle
      }]
    });

    // Persist the notebook state to storage
    this._save();
    // Broadcast the update to connectec clients.
    this._broadcastUpdate(update);
  }

  /**
   * Asynchronously initializes the notebook state and sends a snapshot to connected clients.
   */
  _initNotebook() {
    this._notebookStorage.read(
      this._notebookPath,
      /* create if needed */ true,
      (error: any, notebook: app.INotebookSession) => {
        if (error) {
          // TODO(bryantd): add retry with backoff logic here.

          // Notify clients that notebook loading has failed.
          this._broadcastNotebookLoadFailed();
          return;
        }

        // Store the notebook.
        this._notebook = notebook;

        // Send a snapshot of the notebook to any/all connected clients.
        this._broadcastNotebookSnapshot(this._connections);
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
  _save () {
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
    this._notebookStorage.write(this._notebookPath, this._notebook, (error) => {

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
   * Resets the session state.
   *
   * Shuts down any existing kernel and spawns a new kernel.
   *
   * TODO(bryantd): Need to make this entire call path async.
   * For the moment, the respawn is fire-and-forget, in the sense that a kill
   * signal is sent to the kernel to shutdown (async) and no verification is done.
   * The spawn is also async/fire-and-forget, but less fragile because should the kernel
   * process fail to setup properly, the heartbeat health checking will detect and signal
   * to the system async via the 'dead' kernel state notification.
   */
  reset() {
    this._spawnKernel();
  }

  /**
   * Spawns an appropriate kernel for the current notebook.
   *
   * TODO(bryantd): eventually it will become necessary to read kernel config metadata from
   * the persisted notebook file (e.g., kernel language + version). For now, all kernels are
   * simply Python 2.7+ kernels.
   */
  _spawnKernel () {
    // If a previous kernel existed, clean up before respawning.
    if (this._kernel) {
      // Cleanup any connections and resources for the existing kernel.
      this._kernelManager.shutdown(this._kernel.id);
    }

    // Spawn a new kernel for the session.
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
  }

  // Methods for managing request <-> cell reference mappings

  /**
   * Gets the cell id that corresponds to the given request id.
   *
   * Returns null if the given request id has no corresponding cell id recorded.
   */
  _getCellRefForRequestId (requestId: string) {
    var cellRef = this._requestIdToCellRef[requestId];
    if (cellRef) {
      return cellRef;
    } else {
      // If a message referencing an unknown request id were to arrive, it likely indicates
      // that the message is sufficiently old enough to be ignored, because the
      // cellRef => request Id mapping has been deleted.
      //
      // Log these instances if they ever occur and return null to inform the caller that the
      // specified request id is not currently mapped to a cell.
      console.log(util.createError(
        'Request for unknown cell ref arrived: request id="%s", cell ref="%s"; ignoring message.',
        requestId, JSON.stringify(cellRef)));
      return null;
    }
  }

  /**
   * Stores the mapping of request id to cellref.
   *
   * The kernel doesn't know anything about cells or notebooks, just requests, so this mapping
   * allows response/reply messages from the kernel to be mapped to the corresponding cell
   * that should be updated.
   */
  _setCellRefForRequestId (requestId: string, cellRef: app.CellRef) {
    // TODO(bryantd): need to implement some policy for removing request->cell mappings
    // when they are no longer needed. Ideally there'd be a way to guarantee
    // that a request will have no further messages.
    //
    // Best case would be to somehow store the cell reference within the kernel request message
    // and have the cell reference returned in all replies to that message, which would remove the
    // need to store the requestId => cellRef mapping in the first place. This would rely upon
    // adding an extra field to the ipython message header, which is then returned as the
    // "parent header" in all reply messages. If all kernels simply copy the header data to parent
    // header in responses, this will work, but needs verification. Since a generic header metadata
    // dict isn't part of the current message spec, there are likely no guarantees w.r.t.
    // additional/non-standard header fields.
    //
    // Worst case evict request IDs based upon a TTL value or implement something like a
    // fixed-size LRU cache, to avoid growing without bound.
    //
    // Another option would be to serialize the cell reference to string and use that for the
    // request id. All responses would include the parent request id, which could then be
    // deserialized back into a cell reference.
    this._requestIdToCellRef[requestId] = cellRef;
  }
}
