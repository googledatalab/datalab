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
  _notebook: app.INotebookSession;
  _notebookPath: string;
  _notebookStorage: app.INotebookStorage;
  _requestIdToCellRef: app.Map<app.CellRef>;
  _userconns: app.IUserConnection[];

  /**
   * All messages flowing in either direction between user<->kernel will pass through this handler.
   */
  _messageHandler: app.MessageHandler;

  constructor (
      id: string,
      kernel: app.IKernel,
      messageHandler: app.MessageHandler,
      notebookPath: string,
      notebookStorage: app.INotebookStorage,
      userconn: app.IUserConnection) {

    this.id = id;
    this._kernel = kernel;
    this._messageHandler = messageHandler;
    this._requestIdToCellRef = {};
    this._userconns = [];
    this._notebookPath = notebookPath;
    this._notebook = this._notebookStorage.readOrCreate(notebookPath);

    this._registerKernelEventHandlers();
    this.addUserConnection(userconn);
  }

  /**
   * Gets the id of the kernel currently associated with this session.
   */
  getKernelId (): string {
    return this._kernel.id;
  }

  /**
   * Gets the set of user connections currently associated with this session.
   */
  getUserConnectionIds (): string[] {
    return this._userconns.map((userconn) => {
      return userconn.id;
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
  addUserConnection (userconn: app.IUserConnection) {
    // Add the connection to the "connected" set
    this._userconns.push(userconn);
    // Register event handlers for processing messages arriving from the connection.
    this._registerUserEventHandlers(userconn);
    // Send the initial notebook state at the time of connection.
    userconn.sendUpdate({
      name: updates.notebook.snapshot,
      notebook: this._notebook.getNotebookData()
    });
  }

  /**
   * Deassociates the user connection with this session.
   *
   * Typically called when the connection has been closed.
   */
  removeUserConnection (userconn: app.IUserConnection) {
    // Find the index of the connection and remove it.
    for (var i = 0; i < this._userconns.length; ++i) {
      if (this._userconns[i].id == userconn.id) {
        // Found the connection. Remove it.
        this._userconns.splice(i, 1);
        return;
      }
    }

    // Unexpectedly, the specified connection was not participating in the session.
    throw util.createError(
      'Connection id "%s" was not found in session id "%s"', userconn.id, this.id);
  }

  // Handlers for messages flowing in either direction between user<->kernel.
  //
  // Each of the following methods delegates an incoming message to the middleware stack and
  // sets up a (post-delegation) callback to forward the message to the appropriate entity
  // (where "entity" is either a kernel or a user connection).

  /**
   * Delegates an incoming execute reply (from kernel) to the middleware stack.
   */
  _handleExecuteReplyPreDelegate (reply: app.ExecuteReply) {
    var nextAction = this._handleExecuteReplyPostDelegate.bind(this);
    this._messageHandler(reply, this, nextAction);
  }
  /**
   * Applies execute reply data to the notebook model and broadcasts an update message.
   */
  _handleExecuteReplyPostDelegate (message: any) {
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
    // Update connected clients that a change has occured.
    this._broadcastUpdate(update);
  }

  /**
   * Sends the given update message to all user connections associated with this session.
   */
  _broadcastUpdate (update: app.notebooks.updates.Update) {
    this._userconns.forEach((userconn) => {
      userconn.sendUpdate(update);
    });
  }

  /**
   * Delegates an incoming action request (from user) to the middleware stack.
   */
  _handleActionPreDelegate (request: app.ExecuteRequest) {
    var nextAction = this._handleActionPostDelegate.bind(this);
    this._messageHandler(request, this, nextAction);
  }
  /**
   * Handles the action request by updating the notebook model, issuing kernel requests, etc.
   */
  _handleActionPostDelegate (action: any) {
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

      case actions.notebook.rename:
        this._handleActionRenameNotebook(action);
        break;

      default:
        throw util.createError('No handler found for action message type "%s"', action.name);
    }
  }

  /**
   * Handles a composite action by sequentially applying each contained sub-action.
   */
  _handleActionComposite (action: app.notebooks.actions.Composite) {
    action.subActions.forEach(this._handleActionPostDelegate.bind(this));
  }

  /**
   * Handles multiple notebook action types by applying them to the notebook session.
   */
  _handleActionNotebookData (action: app.notebooks.actions.UpdateCell) {
    var update = this._notebook.apply(action);
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
    var cell = this._notebook.getCell(action.cellId, action.worksheetId);
    if (!cell) {
      throw ('Attempted to execute non-existent cell with id "%s"', action.cellId);
    }

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
   * Handles a notebook rename by updating local metadata.
   *
   * See also the message middleware stack for further handling of the notebook rename event at the
   * session manager level.
   */
  _handleActionRenameNotebook (action: app.notebooks.actions.Rename) {
    this._notebookPath = action.path;
    this._broadcastUpdate({
      name: updates.notebook.metadata,
      path: action.path
    })
  }

  /**
   * Delegates in incoming kernel status (from kernel) to the middleware stack.
   */
  _handleKernelStatusPreDelegate (status: app.KernelStatus) {
    var nextAction = this._handleKernelStatusPostDelegate.bind(this);
    this._messageHandler(status, this, nextAction);
  }
  /**
   * Forwards the kernel status to the user, post-middleware stack processing.
   */
  _handleKernelStatusPostDelegate (message: any) {
    this._broadcastUpdate({
      name: updates.notebook.sessionStatus,
      // TODO(bryantd): add other session metdata here such as connected users, etc. eventually.
      kernelState: message.status
    });
  }

  /**
   * Delegates incoming kernel output data message to the middleware stack.
   */
  _handleOutputDataPreDelegate (outputData: app.OutputData) {
    var nextAction = this._handleOutputDataPostDelegate.bind(this);
    this._messageHandler(outputData, this, nextAction);
  }
  /**
   * Handles a kernel output data message by attaching the output data to the appropriate cell.
   */
  _handleOutputDataPostDelegate (message: any) {
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

    // Broadcast the update to connectec clients.
    this._broadcastUpdate(update);
  }

  /**
   * Registers event handlers for messages arriving from the given user connection.
   */
  _registerUserEventHandlers (userconn: app.IUserConnection) {
    userconn.onAction(this._handleActionPreDelegate.bind(this));
  }

  /**
   * Registers event handlers for messages arriving from the kernel associated with the session.
   */
  _registerKernelEventHandlers () {
    this._kernel.onExecuteReply(this._handleExecuteReplyPreDelegate.bind(this));
    this._kernel.onKernelStatus(this._handleKernelStatusPreDelegate.bind(this));
    this._kernel.onOutputData(this._handleOutputDataPreDelegate.bind(this));
  }

  /* Methods for managing request <-> cell reference mappings */

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
