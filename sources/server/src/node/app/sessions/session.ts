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

  id: string;

  _kernel: app.IKernel;
  _kernelManager: app.IKernelManager;
  _notebook: app.INotebookSession;
  _notebookPath: string;
  _notebookStorage: app.INotebookStorage;
  _requestIdToCellRef: app.Map<app.CellRef>;
  _connections: app.IClientConnection[];

  /**
   * All messages flowing in either direction between user<->kernel will pass through this handler.
   */
  _messageHandler: app.MessageHandler;

  constructor (
      id: string,
      kernelManager: app.IKernelManager,
      messageHandler: app.MessageHandler,
      notebookPath: string,
      notebookStorage: app.INotebookStorage) {

    this.id = id;
    this._kernelManager = kernelManager;
    this._messageHandler = messageHandler;
    this._requestIdToCellRef = {};
    this._connections = [];
    this._notebookPath = notebookPath;

    // Read the notebook if it exists.
    this._notebook = this._notebookStorage.read(notebookPath, /* create if needed */ true);
    // Spawn an appropriate kernel for the given notebook.
    this._spawnKernel();
  }

  /**
   * Gets the id of the kernel currently associated with this session.
   */
  getKernelId (): string {
    return (this._kernel && this._kernel.id) || undefined;
  }

  /**
   * Gets the set of user connections currently associated with this session.
   */
  getClientConnectionIds (): string[] {
    return this._connections.map((connection) => {
      return connection.id;
    });
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
    // Send the initial notebook state at the time of connection.
    connection.sendUpdate({
      name: updates.notebook.snapshot,
      notebook: this._notebook.getNotebookData()
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
      'Connection id "%s" was not found in session id "%s"', connection.id, this.id);
  }


  /**
   * Sends the given update message to all user connections associated with this session.
   */
  _broadcastUpdate (update: app.notebooks.updates.Update) {
    this._connections.forEach((connection) => {
      connection.sendUpdate(update);
    });
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
   * Persists the current notebook state to the notebook storage.
   */
  _save () {
    this._notebookStorage.write(this._notebookPath, this._notebook);
  }

  /**
   * Spawns an appropriate kernel for the current notebook.
   *
   * TODO(bryantd): eventually it will become necessary to read kernel config metadata from
   * the persisted notebook file (e.g., kernel language + version). For now, all kernels are
   * simply Python 2.7+ kernels.
   */
  _spawnKernel () {
    // Eventually, the logic here will be replaced and the ability to respawn kernels will be
    // available. For now, it is unexpected for a respawn to occur, so throw an error.
    if (this._kernel) {
      throw util.createError(
        'Attempted to (re)spawn kernel for session "%s". Kernel respawn not supported currently.',
        this.id);
    }

    // Associate a kernel with the session.
    this._kernel = this._kernelManager.create(
        uuid.v4(),
        {
          iopubPort: util.getAvailablePort(),
          shellPort: util.getAvailablePort()
        },
        this.processExecuteReply.bind(this),
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
