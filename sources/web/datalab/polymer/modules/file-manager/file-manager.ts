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

/**
 * Unique identifier for a file object.
 */
class DatalabFileId {
  private static _delim = '/';

  path: string;
  source: FileManagerType;

  constructor(path: string, source: FileManagerType) {
    this.path = path;
    this.source = source;
  }

  public static fromString(path: string) {
    const tokens = path.split(this._delim);
    // Allow an empty path token
    if (tokens.length === 1) {
      tokens.push('');
    }
    const source = tokens.shift() as string;
    return new DatalabFileId(tokens.join(this._delim),
        FileManagerFactory.fileManagerNameToType(source));
  }

  public toString() {
    return FileManagerFactory.fileManagerTypetoString(this.source) +
        DatalabFileId._delim + this.path;
  }
}

class NotebookContent {
  public static EMPTY_NOTEBOOK_CONTENT = `{
    "cells": [
    ],
    "metadata": {},
    "nbformat": 4,
    "nbformat_minor": 0
  }
  `;

  public cells: NotebookCell[];
  metadata?: object;
  nbformat?: number;
  // tslint:disable-next-line:variable-name
  nbformat_minor?: number;

  constructor(cells: NotebookCell[], metadata?: object, nbformat?: number, nbformatMinor?: number) {
    this.cells = cells;
    this.metadata = metadata;
    this.nbformat = nbformat;
    this.nbformat_minor = nbformatMinor || 0;
  }

  public static fromString(content: string, kernel?: string) {
    const json = JSON.parse(content);
    if (kernel !== undefined) {
      json.metadata.kernelspec = KernelManager.getKernelSpec(kernel);
    }
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
  type: DatalabFileType;

  constructor(id: DatalabFileId, name: string, type: DatalabFileType, icon?: string) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.icon = icon || '';
  }

  public getColumnValues(): ColumnType[] {
    return [this.name];
  }

  public getPreviewName(): string {
    if (this.type === DatalabFileType.NOTEBOOK) {
      return 'notebook';
    }
    return '';
  }

  public getInlineDetailsName(): string {
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
   * Checks whether the given non-notebook filename is valid for this file manager.
   * Return an error message if the file would not be returned from list().
   * Returns null if the name is valid.
   */
  newFileNameError(filename: string): string | null;

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
   * Returns a list of columns. A file id for the current file can be passed to
   * optionally customize the columns based on the current view.
   */
  getColumns(currentFileId?: DatalabFileId): Column[];

  /**
   * Creates a new Datalab item
   * @param fileType type of the created item
   * @param containerId id for the container
   * @param name name for the created item. Default is 'New item'.
   */
  create(fileType: DatalabFileType, containerId?: DatalabFileId, name?: string):
      Promise<DatalabFile>;

  /**
   * Renames an item
   * @param oldFileId source path of the existing item
   * @param newName new name for the item.
   * @param newContainerId id of the destination path of the renamed item
   */
  rename(oldFileId: DatalabFileId, newName: string, newContainerId?: DatalabFileId):
      Promise<DatalabFile>;

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
  getNotebookUrl(fileId: DatalabFileId): Promise<string>;

  /**
   * Returns the url to open the given file in the text editor.
   * @param fileId id for the file to open in the text editor.
   */
  getEditorUrl(fileId: DatalabFileId): string;

  /**
   * Creates a path history from a path string.
   */
  pathToFileHierarchy(path: string): Promise<DatalabFile[]>;
}

/**
 * Base implementation of the FileManager interface that contains common
 * functionality for the different FileManager classes.
 */
class BaseFileManager implements FileManager {
  get(_fileId: DatalabFileId): Promise<DatalabFile> {
    throw new UnsupportedMethod('get', this);
  }

  getStringContent(_fileId: DatalabFileId, _asText?: boolean): Promise<string> {
    throw new UnsupportedMethod('getStringContent', this);
  }

  getRootFile(): Promise<DatalabFile> {
    throw new UnsupportedMethod('getRootFile', this);
  }

  newFileNameError(_filename: string): string | null {
    return null;
  }

  saveText(_file: DatalabFile, _content: string): Promise<DatalabFile> {
    throw new UnsupportedMethod('saveText', this);
  }

  list(_containerId: DatalabFileId): Promise<DatalabFile[]> {
    throw new UnsupportedMethod('list', this);
  }

  getColumns(_currentFileId?: DatalabFileId): Column[] {
    return [{
      name: Utils.constants.columns.name,
      type: ColumnTypeName.STRING,
    }];
  }

  create(_fileType: DatalabFileType, _containerId?: DatalabFileId, _name?: string):
      Promise<DatalabFile> {
    throw new UnsupportedMethod('create', this);
  }

  rename(_oldFileId: DatalabFileId, _newName: string, _newContainerId?: DatalabFileId):
      Promise<DatalabFile> {
    throw new UnsupportedMethod('rename', this);
  }

  delete(_fileId: DatalabFileId): Promise<boolean> {
    throw new UnsupportedMethod('delete', this);
  }

  copy(_file: DatalabFileId, _destinationDirectoryId: DatalabFileId): Promise<DatalabFile> {
    throw new UnsupportedMethod('copy', this);
  }

  async getNotebookUrl(fileId: DatalabFileId): Promise<string> {
    return Utils.getHostRoot() + Utils.constants.notebookUrlComponent + fileId.toString();
  }

  getEditorUrl(fileId: DatalabFileId): string {
    return Utils.getHostRoot() + Utils.constants.editorUrlComponent + fileId.toString();
  }

  async pathToFileHierarchy(_path: string): Promise<DatalabFile[]> {
    throw new UnsupportedMethod('pathToFileHierarchy', this);
  }
}
