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

/**
 * Gets the path of the specified resource relative to the given directory.
 *
 * Note: this function assumes that the resource is contained within the directory, either
 * directly or indirectly (i.e., directory path is a prefix of resource path).
 *
 * Note: this function assumes that the directory path contains a trailing slash.
 *
 * @param directoryPath The directory path.
 * @param resourcePath The resource path.
 * @return The path of the resource relative to the directory.
 */
export function getRelativePath(directoryPath: string, resourcePath: string): string {
  // Strip the directory path prefix from the resource path.
  return resourcePath.slice(directoryPath.length);
}

/**
 * Checks if the specified path represents a directory by checking for a trailing slash.
 * @param path The path to check.
 * @return Boolean to indicate if the path represents a directory.
 */
export function isDirectory(path: string): boolean {
  return endsWith(path, '/');
}

/**
 * Checks if the specified path represents a notebook by examining the file extension.
 *
 * @param path The path to check.
 * @return Boolean to indicate if the path represents a notebook.
 */
export function isNotebook(path: string): boolean {
  return endsWith(path, '.ipynb');
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

/**
 * Strips a trailing slash character from the string if one exists.
 *
 * @param s The input string.
 * @return String with a single trailing slash stripped, if one existed.
 */
export function stripTrailingSlash(s: string) {
  if (endsWith(s, '/')) {
    // Then strip a trailing slash.
    return s.slice(0, s.length -1);
  } else {
    // No trailing slash to strip.
    return s;
  }
}

/**
 * Normalizes the specified path to the expected storage directory path format.
 *
 * Transformations done:
 * - Adds a trailing slash if there is not one.
 * - Prepends a slash if there is not one.
 * - Replaces empty string/undefined paths with root path.
 *
 * @param directoryPath The directory path to normalize.
 * @return The normalized storage directory path.
 */
export function normalizeDirectoryPath(directoryPath: string) {
  // If a path wasn't specified, then take the path to be the storage root.
  if (directoryPath === undefined) {
    directoryPath = ''
  }

  // Prepend a slash if needed.
  if (!startsWith(directoryPath, '/')) {
    directoryPath = '/' + directoryPath;
  }

  // Append a slash if needed.
  if (!endsWith(directoryPath, '/')) {
    directoryPath = directoryPath + '/';
  }

  return directoryPath;
}

/**
 * Checks if the string ends with the specified suffix.
 *
 * @param s The string to check.
 * @param suffix The suffix to check for.
 * @return Boolean to indicate if the specified suffix is a suffix of s.
 */
export function endsWith(s: string, suffix: string): boolean {
  if (suffix === '') {
    // All strings end with the empty string.
    //
    // s.slice(0) has different semantics than s.slice(-x) in that s.slice(0) returns the entire
    // string, which doesn't work here.
    return true;
  }
  return suffix == s.slice(-suffix.length);
}

/**
 * Checks if the string starts with the specified prefix.
 *
 * @param s The string to check.
 * @param prefix The prefix to check for.
 * @return Boolean to indicate if the specified prefix is a prefix of s.
 */
export function startsWith(s: string, prefix: string): boolean {
  return prefix == s.slice(0, prefix.length);
}
