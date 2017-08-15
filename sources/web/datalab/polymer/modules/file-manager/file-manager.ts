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

/**
 * Represents a notebook model.
 */
interface Notebook {
  cells: NotebookCell[];
  metadata: object;
  nbformat: number;
  nbformat_minor: number;
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
 * Represents a file object that can be displayed in the file browser.
 */
class DatalabFile {
  name: string;
  // type: DatalabFileType;
  icon: string;
}

interface FileManager {
  /**
   * Returns a DatalabFile object representing the file or directory requested
   * @param file object containing information of the request file.
   * @param asText whether the file should be downloaded as plain text. This is
   *               useful for downloading notebooks, which are by default read
   *               as JSON, which doesn't preserve formatting.
   */
  get(file: DatalabFile, asText?: boolean): Promise<DatalabFile>;

  /**
   * Uploads the given file object to the backend. The file's name, path, format,
   * and content are required fields.
   * @param file object containing file information to send to backend
   */
  save(file: DatalabFile): Promise<DatalabFile>;

  /**
   * Returns a list of files at the target path, each implementing the
   * DatalabFile interface. Two requests are made to /api/contents and
   * /api/sessions to get this data.
   * @param container file whose children to list.
   */
  list(container: DatalabFile): Promise<DatalabFile[]>;

  /**
   * Creates a new Datalab item
   * @param fileType type of the created item
   */
  create(fileType: DatalabFileType, container: DatalabFile, name: string): Promise<DatalabFile>;

  /**
   * Renames an item
   * @param oldFile source path of the existing item
   * @param name new name for the item.
   * @param newContainer destination path of the renamed item
   */
  rename(oldFile: DatalabFile, name: string, newContainer?: DatalabFile): Promise<DatalabFile>;

  /**
   * Deletes an item
   * @param file item path to delete
   */
  delete(file: DatalabFile): Promise<boolean>;

  /*
   * Copies an item from source to destination. If an item with the same name
   * exists in the destination, a unique suffix is added.
   * @param file item to copy
   * @param destinationDirectory directory to copy the item into
   */
  copy(file: DatalabFile, destinationDirectory: DatalabFile): Promise<DatalabFile>;
}
