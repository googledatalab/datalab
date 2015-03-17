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
 * Interfaces definitions
 */
declare module app {

  interface Settings {
    httpPort: number;
  }

  /**
   * A composite cell identifier that bundles cell and worksheet ids.
   *
   * Used for maintaining a mapping between kernel request ids and the corresponding cells
   * for those kernel requests.
   */
  interface CellRef {
    cellId: string;
    worksheetId: string;
  }

  interface EventHandler<T> {
    (event: T): void;
  }

  interface KernelConfig {
    iopubPort: number;
    shellPort: number;
  }

  /**
   * Manages the persistence of notebook data to/from a given storage path.
   */
  interface INotebookStorage {
    /**
     * Reads a notebook session from storage if it exists, or creates a new notebook if needed.
     */
    readOrCreate (path: string): app.INotebookSession;

    /**
     * Writes the given notebook session to storage.
     */
    write (path: string, notebook: app.INotebookSession): void;
  }

  /**
   * Manages a single notebook's data and provides an API for applying changes captured by Actions.
   */
  interface INotebookSession {
    /**
     * Applies the Action to the notebook model and returns a corresponding Update message.
     *
     * The Update captures the delta necessary for any other copies of the notebook model (e.g.,
     * that exist on clients) to be synchronized with the notebook model held by this instance
     * (assuming that they were synchronized before the update arrived).
     */
    apply (action: notebooks.actions.Action): notebooks.updates.Update;

    /**
     * Gets a reference to the notebook data held within the instance.
     *
     * Callers should consider the returned reference to be read-only.
     */
    getNotebookData (): notebooks.Notebook;

    /**
     * Gets a reference to the specified cell within the notebook.
     *
     * Throws an error if the cell does not exist within the specified worksheet.
     */
    getCell (cellId: string, worksheetId: string): notebooks.Cell;
  }

  interface IKernel {
    id: string;
    config: KernelConfig;
    execute (request: ExecuteRequest): void;
    onExecuteReply (callback: EventHandler<ExecuteReply>): void;
    onKernelStatus (callback: EventHandler<KernelStatus>): void;
    onOutputData (callback: EventHandler<OutputData>): void;
    shutdown (): void;
    start (): void;
  }

  interface IKernelManager {
    create (config: KernelConfig): IKernel;
    get (id: string): IKernel;
    list (): IKernel[];
    shutdown (id: string): void;
    shutdownAll (): void;
  }

  /**
   * Synchronous serialization of notebooks to/from data strings.
   *
   * These methods throw exceptions for ill-formed inputs or unsupported notebook formats,
   * which is consistent with the behavior of JSON.parse/stringify, which this interface mirrors
   * (also see https://www.joyent.com/developers/node/design/errors).
   *
   * Because notebooks can grow to be quite large, especially when data and media have been
   * embedded, it may be worthwhile to move to an async approach eventually. Some relevant
   * discussion around async JSON serialization in NodeJS here:
   * https://github.com/joyent/node/issues/7543
   */
  interface INotebookSerializer {
    /**
     * Deserializes the notebook from a string.
     *
     * Throws an exception if the given notebook data string violates the expected format.
     * specification.
     */
    parse (data: string): notebooks.Notebook;

    /**
     * Serializes the notebook to the specified format.
     *
     * Throws an exception if unsupported cell or media types are included in the notebook.
     */
    stringify (notebook: notebooks.Notebook): string;
  }

  /**
   * A session binds together a notebook with connected users and a kernel.
   */
  interface ISession {
    id: string;

    /**
     * Associates a user connection with the session.
     */
    addUserConnection (connection: IUserConnection): void;

    /**
     * Gets the id of the kernel currently assocated with the session.
     */
    getKernelId (): string;

    /**
     * Gets the set of user connection ids currently associated with the session.
     */
    getUserConnectionIds (): string[];

    /**
     * Disassociates a user connection from the session.
     */
    removeUserConnection (connection: IUserConnection): void;
  }

  /**
   * Manages the lifecycle of session instances.
   *
   * Routes incoming user connections to existing sessions when possible; creates new
   * sessions when needed.
   *
   * User connections specify a session identifier that dictates the specific session that the
   * incoming connection should be routed to.
   */
  interface ISessionManager {
    /**
     * Updates the session identifier to the new value.
     *
     * Existing connections to this session remain connected when renaming.
     *
     * After the rename has been completed, a new connection that specifies the *new* session
     * id will join the existing session; after the rename, a new connection that specifies the
     * *old* session id will create a new session with the old identifier.
     */
    renameSession (oldId: string, newId: string): void;
  }

  interface IStorage {
    read (path: string): string;
    write (path: string, data: string): void;
    delete (path: string): boolean;
    // move (sourcePath: string, destinationPath: string);
    // copy (sourcePath: string, destinationPath: string);
  }

  interface IUserConnection {
    id: string;
    getHandshakeNotebookPath (): string;
    onDisconnect (callback: EventHandler<IUserConnection>): void;
    onAction (callback: EventHandler<notebooks.actions.Action>): void;
    sendUpdate (update: notebooks.updates.Update): void;
  }

  interface IUserConnectionManager {
    onConnect (callback: EventHandler<IUserConnection>): void;
    onDisconnect (callback: EventHandler<IUserConnection>): void;
  }

}

