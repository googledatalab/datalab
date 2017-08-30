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
 * This file contains a collection of functions that call the FileManager APIs, and are
 * wrapped in the ApiManager class. It also defines a set of interfaces to interact with
 * these APIs to help with type checking.
 */

/// <reference path="../../../common.d.ts" />

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

/**
 * Unique identifier for a file object.
 */
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
    if (tokens.length !== 2) {
      throw new Error('Invalid format for file id: ' + querystring);
    }
    return new DatalabFileId(tokens[1], FileManagerFactory.fileManagerNameToType(tokens[0]));
  }

  public toQueryString() {
    return FileManagerFactory.fileManagerTypetoString(this.source) + DatalabFileId._delim +
        this.path;
  }

}

class NotebookContent {
  public static EMPTY_NOTEBOOK_CONTENT = '{"cells": []}';

  public cells: NotebookCell[];
  metadata?: object;
  nbformat?: number;
  // tslint:disable-next-line:variable-name
  nbformat_minor?: number;

  constructor(cells: NotebookCell[], metadata?: object, nbformat?: number, nbformatMinor?: number) {
    this.cells = cells;
    this.metadata = metadata;
    this.nbformat = nbformat;
    this.nbformat_minor = nbformatMinor;
  }

  public static fromString(content: string) {
    const json = JSON.parse(content);
    return new NotebookContent(json.cells, json.metadata, json.nbformat, json.nbformatMinor);
  }
}

/**
 * Represents a file object that can be displayed in the file browser.
 */
abstract class DatalabFile {
  icon: string;
  id: DatalabFileId;
  name: string;
  status?: DatalabFileStatus;
  type: DatalabFileType;

  constructor(obj?: DatalabFile) {
    if (obj) {
      this.icon = obj.icon;
      this.name = obj.name;
      this.id = obj.id;
      this.status = obj.status;
      this.type = obj.type;
    }
  }

  public getPreviewName(): string {
    if (this.type === DatalabFileType.NOTEBOOK) {
      return 'notebook';
    }
    return '';
  }
}

interface FileManager {
  // TODO: Consider supporting getting both the file and content objects with
  // one call.

  /**
   * Returns a DatalabFile object representing the file or directory requested
   * @param fileId id of the requested file.
   */
  get(fileId: DatalabFileId): Promise<DatalabFile>;

  /**
   * Returns the string content of the file with the specified id.
   * @param fileId id of the requested file.
   * @param asText whether the file should be downloaded as plain text. This is
   *               useful for downloading notebooks, which are by default read
   *               as JSON, which doesn't preserve formatting.
   */
  getStringContent(fileId: DatalabFileId, asText?: boolean): Promise<string>;

  /**
   * Returns a DatalabFile object for the root directory.
   */
  getRootFile(): Promise<DatalabFile>;

  /**
   * Saves the given string as a file's content.
   * @param file object containing information about the destination file to
   *             save to.
   * @param content string to be saved in the file
   */
  saveText(file: DatalabFile, content: string): Promise<DatalabFile>;

  /**
   * Returns a list of file objects that are children of the given container file id.
   * @param containerId file id whose children to list.
   */
  list(containerId: DatalabFileId): Promise<DatalabFile[]>;

  /**
   * Creates a new Datalab item
   * @param fileType type of the created item
   * @param containerId id for the container
   * @param name name for the created item. Default is 'New item'.
   */
  create(fileType: DatalabFileType, containerId?: DatalabFileId, name?: string): Promise<DatalabFile>;

  /**
   * Renames an item
   * @param oldFileId source path of the existing item
   * @param newName new name for the item.
   * @param newContainerId id of the destination path of the renamed item
   */
  rename(oldFileId: DatalabFileId, newName: string, newContainerId?: DatalabFileId): Promise<DatalabFile>;

  /**
   * Deletes an item
   * @param fileId id for the item to delete
   */
  delete(fileId: DatalabFileId): Promise<boolean>;

  /*
   * Copies an item from source to destination. If an item with the same name
   * exists in the destination, a unique suffix is added.
   * @param fileId item to copy
   * @param destinationDirectoryId id of the directory to copy the item into
   */
  copy(file: DatalabFileId, destinationDirectoryId: DatalabFileId): Promise<DatalabFile>;

  /**
   * Returns the url to open the given file in the notebook editor.
   * @param fileId id for the file to open in the notebook editor.
   */
  getNotebookUrl(file: DatalabFileId): Promise<string>;

  /**
   * Returns the url to open the given file in the text editor.
   * @param fileId id for the file to open in the text editor.
   */
  getEditorUrl(file: DatalabFileId): Promise<string>;
}
