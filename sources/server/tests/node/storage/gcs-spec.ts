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
import gcs = require('../app/storage/gcs');

/**
 * Define augmented interface with additional internal methods for testing.
 */
interface GcsStorage extends app.IStorage {
  _selectNotebooks(resources: app.Resource[]): app.Resource[];
  _selectWithinDirectory(
      directoryStoragePath: string,
      resources: app.Resource[],
      recursive: boolean
      ): app.Resource[];
  _toStoragePath(gcsPath: string): string;
  _toGcsPath(storagePath: string): string;
  _toResource(gcsPath: string): app.Resource;
  _stripTrailingSlash(s: string): string;
}


describe('GCS storage', () => {
  var storage: GcsStorage;
  var resources: app.Resource[];

  beforeEach(() => {
    storage = new gcs.GoogleCloudStorage(null);
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
    storage = undefined;
    resources = undefined;
  });

  // Resource filters and selection.

  it('selects all files/directories recursively within the root directory', () => {
    var root = storage._selectWithinDirectory('/', resources, true);
    expect(root).toEqual(resources);
  });

  it('selects only files/directories within the root directory', () => {
    var root = storage._selectWithinDirectory('/', resources, false);
    expect(root.length).toBe(3);
    expect(root[0]).toEqual(resources[1]);
    expect(root[1]).toEqual(resources[4]);
    expect(root[2]).toEqual(resources[7]);
  });

  it('selects only files/directories within a sub directory', () => {
    var foo = storage._selectWithinDirectory('/foo', resources, false);
    expect(foo.length).toBe(3);
    expect(foo[0]).toEqual(resources[0]);
    expect(foo[1]).toEqual(resources[3]);
    expect(foo[2]).toEqual(resources[6]);
  });

  it('selects files/directories recursively within a sub directory', () => {
    var foo = storage._selectWithinDirectory('/foo', resources, true);
    expect(foo.length).toBe(5);
    expect(foo[0]).toEqual(resources[0]);
    expect(foo[1]).toEqual(resources[2]);
    expect(foo[2]).toEqual(resources[3]);
    expect(foo[3]).toEqual(resources[5]);
    expect(foo[4]).toEqual(resources[6]);
  });

  it('selects only files/directories within a sub-sub directory', () => {
    var foobar = storage._selectWithinDirectory('/foo/bar', resources, false);
    expect(foobar.length).toBe(2);
    expect(foobar[0]).toEqual(resources[2]);
    expect(foobar[1]).toEqual(resources[5]);
  });

  it('selects files/directories recursively within a sub-sub directory', () => {
    var foobar = storage._selectWithinDirectory('/foo/bar', resources, false);
    expect(foobar.length).toBe(2);
    expect(foobar[0]).toEqual(resources[2]);
    expect(foobar[1]).toEqual(resources[5]);
  });

  it('selects only notebook files from the input resources', () => {
    var filtered = storage._selectNotebooks(resources);

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
    expect(storage._stripTrailingSlash('/dir/')).toEqual('/dir');
    expect(storage._stripTrailingSlash('/foo/bar/dir/')).toEqual('/foo/bar/dir');
    expect(storage._stripTrailingSlash('/')).toEqual('');
  });

  it('strips a trailing slash when one exists', () => {
    expect(storage._stripTrailingSlash('/dir/')).toEqual('/dir');
    expect(storage._stripTrailingSlash('/foo/bar/dir/')).toEqual('/foo/bar/dir');
    expect(storage._stripTrailingSlash('/')).toEqual('');
  });

  it('does nothing when a trailing slash does not exist', () => {
    expect(storage._stripTrailingSlash('/dir')).toEqual('/dir');
    expect(storage._stripTrailingSlash('/foo/bar/dir')).toEqual('/foo/bar/dir');
    expect(storage._stripTrailingSlash('')).toEqual('');
  });

  // GCS path => Resource

  it('convert bucket root GCS directory path to a Resource', () => {
    expect(storage._toResource('dir/')).toEqual({
      path: '/dir',
      isDirectory: true
    });
  });

  it('convert nested GCS directory path to a Resource', () => {
    expect(storage._toResource('foo/bar/dir/')).toEqual({
      path: '/foo/bar/dir',
      isDirectory: true
    });
  });

  it('convert bucket root GCS object path to a Resource', () => {
    expect(storage._toResource('object')).toEqual({
      path: '/object',
      isDirectory: false
    });
  });

  it('convert nested GCS object path to a Resource', () => {
    expect(storage._toResource('foo/bar/object')).toEqual({
      path: '/foo/bar/object',
      isDirectory: false
    });
  });

  // GCS path => storage path

  it('convert bucket root GCS directory path to storage path', () => {
    var gcsPath = 'dir/';
    var storagePath = storage._toStoragePath(gcsPath);
    expect(storagePath).toBe('/dir');
  });

  it('convert nested GCS directory path to storage path', () => {
    var gcsPath = 'foo/bar/dir/';
    var storagePath = storage._toStoragePath(gcsPath);
    expect(storagePath).toBe('/foo/bar/dir');
  });

  it('convert bucket root GCS object path to storage path', () => {
    var gcsPath = 'object';
    var storagePath = storage._toStoragePath(gcsPath);
    expect(storagePath).toBe('/object');
  });

  it('convert nested GCS object path to storage path', () => {
    var gcsPath = 'foo/bar/object';
    var storagePath = storage._toStoragePath(gcsPath);
    expect(storagePath).toBe('/foo/bar/object');
  });


  // Storage path => GCS path

  it('convert storage root directory path to GCS path', () => {
    var storagePath = '/dir';
    var gcsPath = storage._toGcsPath(storagePath);
    expect(gcsPath).toBe('dir');
  });

  it('convert nested storage directory path to GCS path', () => {
    var storagePath = '/foo/bar/dir';
    var gcsPath = storage._toGcsPath(storagePath);
    expect(gcsPath).toBe('foo/bar/dir');
  });

  it('convert storage root object path to GCS path', () => {
    var storagePath = '/object';
    var gcsPath = storage._toGcsPath(storagePath);
    expect(gcsPath).toBe('object');
  });

  it('convert nested storage object path to GCS path', () => {
    var storagePath = '/foo/bar/object';
    var gcsPath = storage._toGcsPath(storagePath);
    expect(gcsPath).toBe('foo/bar/object');
  });

});
