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
      { path: '/foo/bar', isDirectory: true },
      { path: '/foo', isDirectory: true },

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

  it('strips a trailing slash when one exists', () => {
    expect(content.stripTrailingSlash('/dir/')).toEqual('/dir');
    expect(content.stripTrailingSlash('/foo/bar/dir/')).toEqual('/foo/bar/dir');
    expect(content.stripTrailingSlash('/')).toEqual('');
  });

  it('strips a trailing slash when one exists', () => {
    expect(content.stripTrailingSlash('/dir/')).toEqual('/dir');
    expect(content.stripTrailingSlash('/foo/bar/dir/')).toEqual('/foo/bar/dir');
    expect(content.stripTrailingSlash('/')).toEqual('');
  });

  it('does nothing when a trailing slash does not exist', () => {
    expect(content.stripTrailingSlash('/dir')).toEqual('/dir');
    expect(content.stripTrailingSlash('/foo/bar/dir')).toEqual('/foo/bar/dir');
    expect(content.stripTrailingSlash('')).toEqual('');
  });

});
