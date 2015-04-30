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
import local = require('../app/storage/local');

/**
 * Define augmented interface with additional internal methods for testing.
 */
interface LocalStorage extends app.IStorage {
  _toFileSystemPath(storagePath: string): string;
  _toResource(
      directoryStoragePath: string,
      resourceFileSystemPath: string,
      isDirectory: boolean
      ): app.Resource;
  _toStoragePath(fsPath: string, isDirectory: boolean): string;
}

describe('Local filesystem storage', () => {
  var storage: LocalStorage;
  var resources: app.Resource[];

  beforeEach(() => {
    storage = new local.LocalFileSystemStorage('fs/root');
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

  it('converts a filesystem path to a storage path', () => {
    expect(storage._toStoragePath('fs/root/foo.txt', false)).toBe('/foo.txt');
    expect(storage._toStoragePath('fs/root/foo/bar.txt', false)).toBe('/foo/bar.txt');

    expect(storage._toStoragePath('fs/root/foo', true)).toBe('/foo/');
    expect(storage._toStoragePath('fs/root/foo/bar', true)).toBe('/foo/bar/');
  });

  it('converts a storage path to a file system path', () => {
    expect(storage._toFileSystemPath('/foo.txt')).toBe('fs/root/foo.txt');
    expect(storage._toFileSystemPath('/foo/bar.txt')).toBe('fs/root/foo/bar.txt');

    expect(storage._toFileSystemPath('/foo/')).toBe('fs/root/foo');
    expect(storage._toFileSystemPath('/foo/bar/')).toBe('fs/root/foo/bar');
  });

  it('creates a file resource in the root storage directory', () => {
    expect(storage._toResource('/', 'fs/root/foo.txt', false)).toEqual({
      path: '/foo.txt',
      relativePath: 'foo.txt',
      isDirectory: false,
      description: 'File'
    });
  });

  it('creates a directory resource in the root storage directory', () => {
    expect(storage._toResource('/', 'fs/root/foo/', true)).toEqual({
      path: '/foo/',
      relativePath: 'foo/',
      isDirectory: true,
      description: 'Folder'
    });
  });

  it('creates a notebook resource in the root storage directory', () => {
    expect(storage._toResource('/', 'fs/root/foo.ipynb', false)).toEqual({
      path: '/foo.ipynb',
      relativePath: 'foo.ipynb',
      isDirectory: false,
      description: 'IPython Notebook'
    });
  });

  it('creates a file resource in a storage sub-directory', () => {
    expect(storage._toResource('/sub/', 'fs/root/sub/foo.txt', false)).toEqual({
      path: '/sub/foo.txt',
      relativePath: 'foo.txt',
      isDirectory: false,
      description: 'File'
    });
  });

  it('creates a directory resource in a storage sub-directory', () => {
    expect(storage._toResource('/sub/', 'fs/root/sub/foo/', true)).toEqual({
      path: '/sub/foo/',
      relativePath: 'foo/',
      isDirectory: true,
      description: 'Folder'
    });
  });

  it('creates a notebook resource in a storage sub-directory', () => {
    expect(storage._toResource('/sub/', 'fs/root/sub/foo.ipynb', false)).toEqual({
      path: '/sub/foo.ipynb',
      relativePath: 'foo.ipynb',
      isDirectory: false,
      description: 'IPython Notebook'
    });
  });

});
