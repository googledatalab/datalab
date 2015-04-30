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
    if (resource.isDirectory) {
      // All directories are retained.
      selected.push(resource);
    } else if (isNotebook(resource.path)) {
      // All notebooks are retained.
      selected.push(resource);
    }

    // All other resources types are not selected.
  });

  return selected;
}

/**
 * Selects resources that are directly contained within the specified directory path.
 *
 * @param directoryStoragePath The storage directory path to use for selection.
 * @param resources The array of resources to select from.
 * @param recursive Select all files/dirs recursively contained within the specified directory.
 * @return A new array containing only resources directly within the specified directory.
 */
export function selectWithinDirectory(
    directoryStoragePath: string,
    resources: app.Resource[],
    recursive: boolean
    ): app.Resource[] {

  var selected: app.Resource[] = [];

  resources.forEach(resource => {
    var pathPrefix = resource.path.slice(0, directoryStoragePath.length);

    // Check if the current resource path is contained (directly or indirectly) by the specified
    // directory path.
    if (directoryStoragePath != pathPrefix) {
      // This resource path is not contained within the specified directory path, so skip it.
      return;
    }

    // Don't add the directory itself.
    if (directoryStoragePath == resource.path) {
      return;
    }

    if (recursive) {
      selected.push(resource);
    } else {
      // Don't select paths that are contained within subdirectories.
      //
      // Check if the suffix indicates that the resource path is directly contained (vs indirectly
      // via sub directory).
      //
      // The following strips a trailing slash (e.g., from directories) and then looks for a
      // remaining slash within the path to identify the presence of a subdirectory.
      if (!containsSlash(stripTrailingSlash(resource.relativePath))) {
        selected.push(resource);
      }
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

export function containsSlash(path: string): boolean {
  return path.indexOf('/') >= 0;
}

export function hasTrailingSlash(directoryPath: string): boolean {
  return endsWith(directoryPath, '/');
}

export function ensureTrailingSlash(directoryPath: string): string {
  // Append a slash if needed.
  if (!hasTrailingSlash(directoryPath)) {
    directoryPath = directoryPath + '/';
  }
  return directoryPath;
}

export function ensureLeadingSlash(directoryPath: string): string {
  // Prepend a slash if needed.
  if (!startsWith(directoryPath, '/')) {
    directoryPath = '/' + directoryPath;
  }
  return directoryPath;
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
export function normalizeDirectoryPath(directoryPath: string): string {
  // If a path wasn't specified, then take the path to be the storage root.
  if (directoryPath === undefined) {
    directoryPath = ''
  }

  // Ensure that the directory path has a leading and a trailing slash.
  return ensureTrailingSlash(ensureLeadingSlash(directoryPath));
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
