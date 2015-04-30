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
  _toStoragePath(gcsPath: string): string;
  _toGcsPath(storagePath: string): string;
  _toResource(
      storageDirectoryPath: string,
      gcsResourcePath: string,
      lastModified: string
      ): app.Resource;
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

  // GCS path => Resource

  it('convert bucket root GCS directory path to a Resource', () => {
    var lastModified = (new Date()).toISOString();
    expect(storage._toResource('/', 'dir/', lastModified)).toEqual({
      path: '/dir/',
      isDirectory: true,
      relativePath: 'dir/',
      description: 'Folder',
      lastModified: lastModified
    });
  });

  it('convert nested GCS directory path to a Resource', () => {
    var lastModified = (new Date()).toISOString();
    expect(storage._toResource('/', 'foo/bar/dir/', lastModified)).toEqual({
      path: '/foo/bar/dir/',
      isDirectory: true,
      relativePath: 'foo/bar/dir/',
      description: 'Folder',
      lastModified: lastModified
    });
  });

  it('convert bucket root GCS object path to a Resource', () => {
    var lastModified = (new Date()).toISOString();
    expect(storage._toResource('/', 'object', lastModified)).toEqual({
      path: '/object',
      isDirectory: false,
      relativePath: 'object',
      description: 'File',
      lastModified: lastModified
    });
  });

  it('convert nested GCS object path to a Resource', () => {
    var lastModified = (new Date()).toISOString();
    expect(storage._toResource('/', 'foo/bar/object', lastModified)).toEqual({
      path: '/foo/bar/object',
      isDirectory: false,
      relativePath: 'foo/bar/object',
      description: 'File',
      lastModified: lastModified
    });
  });

  it('convert nested GCS notebook path to a Resource', () => {
    var lastModified = (new Date()).toISOString();
    expect(storage._toResource('/', 'foo/bar/object.ipynb', lastModified)).toEqual({
      path: '/foo/bar/object.ipynb',
      isDirectory: false,
      relativePath: 'foo/bar/object.ipynb',
      description: 'IPython Notebook',
      lastModified: lastModified
    });
  });

  // GCS path => storage path

  it('convert bucket root GCS directory path to storage path', () => {
    var gcsPath = 'dir/';
    var storagePath = storage._toStoragePath(gcsPath);
    expect(storagePath).toBe('/dir/');
  });

  it('convert nested GCS directory path to storage path', () => {
    var gcsPath = 'foo/bar/dir/';
    var storagePath = storage._toStoragePath(gcsPath);
    expect(storagePath).toBe('/foo/bar/dir/');
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

  it('convert storage root directory path to GCS path', () => {
    var storagePath = '/dir/';
    var gcsPath = storage._toGcsPath(storagePath);
    expect(gcsPath).toBe('dir');
  });

  it('convert nested storage directory path to GCS path', () => {
    var storagePath = '/foo/bar/dir';
    var gcsPath = storage._toGcsPath(storagePath);
    expect(gcsPath).toBe('foo/bar/dir');
  });

  it('convert nested storage directory path to GCS path', () => {
    var storagePath = '/foo/bar/dir/';
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
