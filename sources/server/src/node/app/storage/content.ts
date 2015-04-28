/*
 * Copyright 2015 Google Inc. All rights reserved.
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
 * Common helpers for manipulating storage content.
 */


var descriptions = {
  directory: 'Folder',
  ipynb: 'IPython Notebook',
  file: 'File'
};

/**
 * Gets a description string for the given resource path.
 *
 * @param path The full path or filename for the given resource.
 * @return A textual description for the resource path.
 */
export function getDescription(path: string): string {
  if (isDirectory(path)) {
    return descriptions.directory;
  }

  if (isNotebook(path)) {
    return descriptions.ipynb;
  }

  // Otherwise, describe the path as a generic file.
  return descriptions.file;
}

export function isNotebook(path: string): boolean {
  var notebookExtension = 'ipynb';
  return notebookExtension == path.slice(-notebookExtension.length);
}

export function isDirectory(path: string): boolean {
  // GCS denotes "directories" as object paths with a trailing slash.
  return path[path.length - 1] == '/';
}


/**
 * Strips a trailing slash character from the string if one exists.
 *
 * @param s The input string.
 * @return String with a single trailing slash stripped, if one existed.
 */
export function stripTrailingSlash(s: string) {
  if (s[s.length - 1] == '/') {
    // Then strip a trailing slash.
    return s.slice(0, s.length -1);
  } else {
    // No trailing slash to strip.
    return s;
  }
}

/**
 * Selects directories and notebook files from the specified list of resources.
 *
 * Currently, notebooks are limited to files with the .ipynb extension.
 *
 * @param resources The array of resources to select from.
 * @return A new array containing only directory and notebook resources.
 */
export function selectNotebooks(resources: app.Resource[]): app.Resource[] {
  var selected: app.Resource[] = [];

  resources.forEach(resource => {
    // All directories are retained.
    if (resource.isDirectory) {
      selected.push(resource);
      return;
    }

    if (isNotebook(resource.path)) {
      selected.push(resource);
    }
  });

  return selected;
}
