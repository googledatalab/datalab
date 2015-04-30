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

/// <reference path="../../../../../externs/ts/jasmine.d.ts"/>
import content = require('../app/storage/content');


describe('Content path/resource utilities', () => {
  var resources: app.Resource[];

  beforeEach(() => {
    resources = [
      { path: '/foo/bar/', isDirectory: true },
      { path: '/foo/', isDirectory: true },

      { path: '/foo/bar/a.ipynb', isDirectory: false },
      { path: '/foo/b.ipynb', isDirectory: false },
      { path: '/c.ipynb', isDirectory: false },

      { path: '/foo/bar/a.txt', isDirectory: false },
      { path: '/foo/b.txt', isDirectory: false },
      { path: '/c.txt', isDirectory: false }
    ];
  });

  afterEach(() => {
    resources = undefined;
  });

  // Get relative path

  it('gets the relative path of a file directly contained by directory', () => {
    expect(content.getRelativePath('/', '/foo.txt')).toEqual('foo.txt');
    expect(content.getRelativePath('/quux/', '/quux/foo.txt')).toEqual('foo.txt');
  });

  it('gets the relative path of a file in a subdirectory', () => {
    expect(content.getRelativePath('/', '/bar/foo.txt')).toEqual('bar/foo.txt');
    expect(content.getRelativePath('/quux/', '/quux/bar/foo.txt')).toEqual('bar/foo.txt');
  });

  it('gets the relative path of a directory directly contained by the base directory', () => {
    expect(content.getRelativePath('/', '/foo/')).toEqual('foo/');
    expect(content.getRelativePath('/quux/', '/quux/foo/')).toEqual('foo/');
  });

  it('gets the relative path of a directory in a subdirectory', () => {
    expect(content.getRelativePath('/', '/bar/foo/')).toEqual('bar/foo/');
    expect(content.getRelativePath('/quux/', '/quux/bar/foo/')).toEqual('bar/foo/');
  });

  // Select notebooks

  it('selects only notebook files from the input resources', () => {
    var filtered = content.selectNotebooks(resources);

    expect(filtered.length).toBe(5);

    // Directories should be retained.
    expect(filtered[0]).toEqual(resources[0]);
    expect(filtered[1]).toEqual(resources[1]);

    // .ipynb files should be retained
    expect(filtered[2]).toEqual(resources[2]);
    expect(filtered[3]).toEqual(resources[3]);
    expect(filtered[4]).toEqual(resources[4]);
  });


  // Select based upon containing directory

  it('selects all files/directories recursively within the root directory', () => {
    var root = content.selectWithinDirectory('/', resources, true);
    expect(root).toEqual(resources);
  });

  it('selects only files/directories within the root directory', () => {
    // Populate a relative path for each resource.
    resources.forEach(r => r.relativePath = r.path.slice('/'.length));

    var root = content.selectWithinDirectory('/', resources, false);
    expect(root.length).toBe(3);
    expect(root[0]).toEqual(resources[1]);
    expect(root[1]).toEqual(resources[4]);
    expect(root[2]).toEqual(resources[7]);
  });

  it('selects only files/directories within a sub directory', () => {
    // Only resources within /foo/
    resources = [
      { path: '/foo/bar/', isDirectory: true},
      { path: '/foo/', isDirectory: true },
      { path: '/foo/bar/a.ipynb', isDirectory: false },
      { path: '/foo/b.ipynb', isDirectory: false },
      { path: '/foo/bar/a.txt', isDirectory: false },
      { path: '/foo/b.txt', isDirectory: false },
    ];
    // Populate a relative path for each resource.
    resources.forEach(r => r.relativePath = r.path.slice('/foo/'.length));

    var foo = content.selectWithinDirectory('/foo/', resources, false);
    expect(foo.length).toBe(3);
    expect(foo[0]).toEqual(resources[0]);
    expect(foo[1]).toEqual(resources[3]);
    expect(foo[2]).toEqual(resources[5]);
  });

  it('selects files/directories recursively within a sub directory', () => {
    // Only resources within /foo/
    resources = [
      { path: '/foo/bar/', isDirectory: true},
      { path: '/foo/', isDirectory: true },
      { path: '/foo/bar/a.ipynb', isDirectory: false },
      { path: '/foo/b.ipynb', isDirectory: false },
      { path: '/foo/bar/a.txt', isDirectory: false },
      { path: '/foo/b.txt', isDirectory: false },
    ];
    // Populate a relative path for each resource.
    resources.forEach(r => r.relativePath = r.path.slice('/foo/'.length));

    var foo = content.selectWithinDirectory('/foo/', resources, true);
    expect(foo.length).toBe(5);
    expect(foo[0]).toEqual(resources[0]);
    // The directory itself should not appear in the selected resources.
    expect(foo[1]).toEqual(resources[2]);
    expect(foo[2]).toEqual(resources[3]);
    expect(foo[3]).toEqual(resources[4]);
    expect(foo[4]).toEqual(resources[5]);
  });

  it('selects only files/directories within a sub-sub directory', () => {
    // Only resources within /foo/bar/
    resources = [
      { path: '/foo/bar/', isDirectory: true},
      { path: '/foo/bar/a.ipynb', isDirectory: false },
      { path: '/foo/bar/a.txt', isDirectory: false },
    ];
    // Populate a relative path for each resource.
    resources.forEach(r => r.relativePath = r.path.slice('/foo/bar/'.length));

    var foobar = content.selectWithinDirectory('/foo/bar/', resources, false);
    expect(foobar.length).toBe(2);
    expect(foobar[0]).toEqual(resources[1]);
    expect(foobar[1]).toEqual(resources[2]);
  });

  it('selects files/directories recursively within a sub-sub directory', () => {
    // Only resources within /foo/bar/
    resources = [
      { path: '/foo/bar/', isDirectory: true},
      { path: '/foo/bar/a.ipynb', isDirectory: false },
      { path: '/foo/bar/a.txt', isDirectory: false },
    ];
    // Populate a relative path for each resource.
    resources.forEach(r => r.relativePath = r.path.slice('/foo/bar/'.length));

    var foobar = content.selectWithinDirectory('/foo/bar/', resources, false);
    expect(foobar.length).toBe(2);
    // The directory itself should not appear in the selected resources.
    expect(foobar[0]).toEqual(resources[1]);
    expect(foobar[1]).toEqual(resources[2]);
  });

  it('selects directories within a sub directory', () => {
    var resources = [{
        "path": "/sub1/",
        "relativePath": "sub1/",
        "isDirectory": true,
        "description": "Folder"
    },
    {
        "path": "/sub2/",
        "relativePath": "sub2/",
        "isDirectory": true,
        "description": "Folder"
    },
    {
        "path": "/sub3/",
        "relativePath": "sub3/",
        "isDirectory": true,
        "description": "Folder"
    },
    {
        "path": "/sub1/subsub/",
        "relativePath": "sub1/subsub/",
        "isDirectory": true,
        "description": "Folder"
    }]
    var selected = content.selectWithinDirectory('/', resources, false);
    expect(selected.length).toBe(3);
    expect(selected).toEqual(resources.slice(0, 3));
  })

  // Ensure a leading slash
  it('ensures the path has a leading slash', () => {
    expect(content.ensureLeadingSlash('')).toEqual('/');
    expect(content.ensureLeadingSlash('/')).toEqual('/');
    expect(content.ensureLeadingSlash('foo')).toEqual('/foo');
    expect(content.ensureLeadingSlash('/foo')).toEqual('/foo');
  });

  // Ensure a trailing slash
  it('ensures the path has a trailing slash', () => {
    expect(content.ensureTrailingSlash('')).toEqual('/');
    expect(content.ensureTrailingSlash('/')).toEqual('/');
    expect(content.ensureTrailingSlash('foo')).toEqual('foo/');
    expect(content.ensureTrailingSlash('foo/')).toEqual('foo/');
  });

  // Checks for slash within string
  it('checks for a slash within the string', () => {
    expect(content.containsSlash('')).toBe(false);
    expect(content.containsSlash('/')).toBe(true);
    expect(content.containsSlash('foo/bar')).toBe(true);
    expect(content.containsSlash('foo/')).toBe(true);
    expect(content.containsSlash('/foo')).toBe(true);
  });

  // Strip trailing slash

  it('strips a trailing slash when one exists', () => {
    expect(content.stripTrailingSlash('/dir/')).toEqual('/dir');
    expect(content.stripTrailingSlash('/foo/bar/dir/')).toEqual('/foo/bar/dir');
    expect(content.stripTrailingSlash('/')).toEqual('');
  });

  it('returns empty string when stripping slash from empty string', () => {
    expect(content.stripTrailingSlash('')).toEqual('');
  });

  it('does nothing when a trailing slash does not exist', () => {
    expect(content.stripTrailingSlash('/dir')).toEqual('/dir');
    expect(content.stripTrailingSlash('/foo/bar/dir')).toEqual('/foo/bar/dir');
    expect(content.stripTrailingSlash('')).toEqual('');
  });

  // Ends with

  it('checks if an empty string ends with an empty suffix', () => {
    expect(content.endsWith('', '')).toBe(true);
  });

  it('checks if an empty string ends with a longer suffix', () => {
    expect(content.endsWith('', 'foo')).toBe(false);
  });

  it('checks if a non-empty string ends with an empty suffix', () => {
    expect(content.endsWith('foo', '')).toBe(true);
  });

  it('checks if a non-empty string ends with an shorter suffix', () => {
    expect(content.endsWith('foo', 'o')).toBe(true);
    expect(content.endsWith('foo', 'x')).toBe(false);
  });

  it('checks if a non-empty string ends with itself', () => {
    expect(content.endsWith('foo', 'foo')).toBe(true);
  });

  it('checks if a non-empty string ends with a longer suffix', () => {
    expect(content.endsWith('foo', 'foobar')).toBe(false);
  });

  // Starts with

  it('checks if an empty string starts with an empty prefix', () => {
    expect(content.startsWith('', '')).toBe(true);
  });

  it('checks if an empty string starts with a longer prefix', () => {
    expect(content.startsWith('', 'foo')).toBe(false);
  });

  it('checks if a non-empty string starts with an empty prefix', () => {
    expect(content.startsWith('foo', '')).toBe(true);
  });

  it('checks if a non-empty string starts with a shorter prefix', () => {
    expect(content.startsWith('foo', 'f')).toBe(true);
    expect(content.startsWith('foo', 'x')).toBe(false);
  });

  it('checks if a non-empty string starts with itself', () => {
    expect(content.startsWith('foo', 'foo')).toBe(true);
  });

  it('checks if a non-empty string starts with a longer prefix', () => {
    expect(content.startsWith('foo', 'foobar')).toBe(false);
  });

  // Normalize path

  it('normalizes an undefined path to the storage root', () => {
    expect(content.normalizeDirectoryPath(undefined)).toBe('/');
  });

  it('normalizes an empty path to the storage root', () => {
    expect(content.normalizeDirectoryPath('')).toBe('/');
  });

  it('normalizes a directory path to have a trailing slash', () => {
    expect(content.normalizeDirectoryPath('/')).toBe('/');
    expect(content.normalizeDirectoryPath('/foo')).toBe('/foo/');
    expect(content.normalizeDirectoryPath('/foo/bar')).toBe('/foo/bar/');
    expect(content.normalizeDirectoryPath('/foo/bar/')).toBe('/foo/bar/');
  });

  it('normalizes a directory path to have a leading slash', () => {
    expect(content.normalizeDirectoryPath('/')).toBe('/');
    expect(content.normalizeDirectoryPath('/foo/')).toBe('/foo/');
    expect(content.normalizeDirectoryPath('foo/')).toBe('/foo/');
    expect(content.normalizeDirectoryPath('foo/bar/')).toBe('/foo/bar/');
  });
});
