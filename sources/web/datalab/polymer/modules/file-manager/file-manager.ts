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

/**
 * This file contains a collection of functions that call the Jupyter server APIs, and are
 * wrapped in the ApiManager class. It also defines a set of interfaces to interact with
 * these APIs to help with type checking.
 */

/// <reference path="../../../common.d.ts" />

// TODO: Go over docstrings

/**
 * Represents a cell in a notebook.
 */
interface NotebookCell {
  cell_type: string;
  execution_count: number;
  metadata: object;
  outputs: string[];
  source: string;
}

enum DatalabFileType {
  DIRECTORY,
  FILE,
  NOTEBOOK,
}

enum DatalabFileStatus {
  IDLE,
  RUNNING,
}

class DatalabFileId {
  private static _delim = ':';

  path: string;
  source: FileManagerType;

  constructor(path: string, source: FileManagerType) {
    this.path = path;
    this.source = source;
  }

  public static fromQueryString(querystring: string) {
    const tokens = querystring.split(DatalabFileId._delim);
    return new DatalabFileId(tokens[1], FileManagerFactory.fileManagerNameToType(tokens[0]));
  }

  public toQueryString() {
    return FileManagerFactory.fileManagerTypetoString(this.source) + DatalabFileId._delim +
        this.path;
  }

}

abstract class DatalabFileContent {
  public abstract getEditorText(): string;
}

class NotebookContent extends DatalabFileContent {
  public cells: NotebookCell[];
  metadata: object;
  nbformat: number;
  // tslint:disable-next-line:variable-name
  nbformat_minor: number;

  constructor(cells: NotebookCell[], metadata: object, nbformat: number, nbformatMinor: number) {
    super();
    this.cells = cells;
    this.metadata = metadata;
    this.nbformat = nbformat;
    this.nbformat_minor = nbformatMinor;
  }

  public getEditorText() {
    return JSON.stringify(this);
  }
}

class DirectoryContent extends DatalabFileContent {
  files: DatalabFile[];

  constructor(files: DatalabFile[]) {
    super();
    this.files = files;
  }

  public getEditorText() {
    return JSON.stringify(this.files);
  }
}

class TextContent extends DatalabFileContent {
  text: string;

  constructor(text: string) {
    super();
    this.text = text;
  }

  public getEditorText() {
    return this.text;
  }
}

/**
 * Represents a file object that can be displayed in the file browser.
 */
abstract class DatalabFile {
  name: string;
  type: DatalabFileType;
  icon: string;
  status?: DatalabFileStatus;
  id: DatalabFileId;
}

interface FileManager {
  // TODO: Consider supporting getting both the file and content objects with
  // one call.

  /**
   * Returns a DatalabFile object representing the file or directory requested
   * @param file object containing information of the request file.
   * @param asText whether the file should be downloaded as plain text. This is
   *               useful for downloading notebooks, which are by default read
   *               as JSON, which doesn't preserve formatting.
   */
  get(fileId: DatalabFileId): Promise<DatalabFile>;

  /**
   * Returns a DatalabFile object representing the file or directory requested
   * @param file object containing information of the request file.
   * @param asText whether the file should be downloaded as plain text. This is
   *               useful for downloading notebooks, which are by default read
   *               as JSON, which doesn't preserve formatting.
   */
  getContent(fileId: DatalabFileId, asText?: boolean): Promise<DatalabFileContent>;

  /**
   * Returns a DatalabFile object for the root directory.
   */
  getRootFile(): Promise<DatalabFile>;

  /**
   * Uploads the given file object to the backend. The file's name, path, format,
   * and content are required fields.
   * @param file object containing file information to send to backend
   */
  saveText(file: DatalabFile, content: string): Promise<DatalabFile>;

  /**
   * Returns a list of files at the target path, each implementing the
   * DatalabFile interface. Two requests are made to /api/contents and
   * /api/sessions to get this data.
   * @param container file id whose children to list.
   */
  list(containerId: DatalabFileId): Promise<DatalabFile[]>;

  /**
   * Creates a new Datalab item
   * @param fileType type of the created item
   * @param container id for the container
   * @param name name for the created item
   */
  create(fileType: DatalabFileType, container?: DatalabFileId, name?: string): Promise<DatalabFile>;

  /**
   * Renames an item
   * @param oldFile source path of the existing item
   * @param name new name for the item.
   * @param newContainer destination path of the renamed item
   */
  rename(oldFile: DatalabFileId, name: string, newContainer?: DatalabFileId): Promise<DatalabFile>;

  /**
   * Deletes an item
   * @param file item path to delete
   */
  delete(file: DatalabFileId): Promise<boolean>;

  /*
   * Copies an item from source to destination. If an item with the same name
   * exists in the destination, a unique suffix is added.
   * @param file item to copy
   * @param destinationDirectory directory to copy the item into
   */
  copy(file: DatalabFileId, destinationDirectory: DatalabFileId): Promise<DatalabFile>;

  /**
   * Returns the url to open the given file in the notebook editor.
   * @param file file object to open in the notebook editor.
   */
  getNotebookUrl(file: DatalabFileId): Promise<string>;

  /**
   * Returns the url to open the given file in the text editor.
   * @param file file object to open in the text editor.
   */
  getEditorUrl(file: DatalabFileId): Promise<string>;
}
