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
 * Represents a file object as returned from the FileManager calls.
 */
interface DatalabFile {
  content: DatalabFile[] | Notebook | string;
  created?: string;
  format: string;
  last_modified?: string;
  mimetype?: string;
  name: string;
  path: string;
  status: DatalabFileStatus;
  type: DatalabFileType;
  writable?: boolean;
}

interface FileManager {
  /**
   * Returns a DatalabFile object representing the file or directory requested
   * @param path string path to requested file
   * @param asText whether the file should be downloaded as plain text. This is
   *               useful for downloading notebooks, which are by default read
   *               as JSON, which doesn't preserve formatting.
   */
  get(path: string, asText?: boolean): Promise<DatalabFile>;

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
   * @param path current path to list files under
   */
  list(path: string): Promise<DatalabFile[]>;

  /**
   * Creates a new Datalab item
   * @param itemType type of the created item
   */
  create(itemType: DatalabFileType, path?: string): Promise<DatalabFile>;

  /**
   * Renames an item
   * @param oldPath source path of the existing item
   * @param newPath destination path of the renamed item
   */
  rename(oldPath: string, newPath: string): Promise<DatalabFile>;

  /**
   * Deletes an item
   * @param path item path to delete
   */
  delete(path: string): Promise<boolean>;

  /*
   * Copies an item from source to destination. Item name collisions at the
   * destination are handled by backend.
   * @param path path to item to copy
   * @param destinationDirectory directory to copy the item into
   */
  copy(path: string, destinationDirectory: string): Promise<DatalabFile>;
}
