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
 * This file manager connects to api.github.com and uses the github REST API
 * as documented at developer.github.com/v3.
 */

// TODO(jimmc): Need to deal with the following
// paged results (default page size is 30, can request up to 100)
// error conditions
// rate limiting (default is 60 per hour)
// size and dates for display in file browser (once it can do that)

class GithubFile extends DatalabFile {}

interface GhRepoResponse {
  id: string;
  name: string;   // just the repo name
  full_name: string;  // user/repo
  description: string;
  // There are a ton of other fields, including a bunch of URLs,
  // creation time, forks, watchers, etc.
}

interface GhDirEntryResponse {
  name: string; // filename only
  path: string; // relative to the repo base
  sha: string;
  size: number; // size of file in bytes
  type: string; // 'file' or 'dir'
  url: string;  // the url to access this file via the api
  // There are a bunch of other fields, mostly URLs
}

interface GhFileResponse {
  type: string;
  size: number;
  name: string;
  path: string;
  encoding: string;
  content: string;
  url: string;  // the url to access this file via the api
}

interface GithubCacheEntry {
  data?: object;   // The payload
  etag?: string;   // The value of the etag header in the github response
  promise?: Promise<object>;  // The fetch promise if we don't yet have the data
}

/**
 * A cache that holds github responses.
 */
class GithubCache {

  cache_: {[key: string]: GithubCacheEntry} = {};

  // TODO(jimmc) - allow specifying some limits for the cache,
  // such as time limit, count limit, or entry size limit

  // Returns the entry for the given path, or null if not in the cache.
  public get(path: string): GithubCacheEntry | null {
    const entry = this.cache_[path];
    return entry;
  }

  // Puts the given data into the cache. If there is an existing entry
  // at that path, updates that entry.
  public put(path: string, entry: GithubCacheEntry) {
    this.cache_[path] = entry;
  }
}

/**
 * A file manager that wraps the Github API so that we can browse github
 * repositories.
 */
class GithubFileManager extends BaseFileManager {

  private static cache_ = new GithubCache();

  public get(fileId: DatalabFileId): Promise<DatalabFile> {
    if (fileId.path === '' || fileId.path === '/') {
      return Promise.resolve(this._ghRootDatalabFile());
    }
    const githubPath = this._githubPathForFileId(fileId, 'get');
    return this._githubApiPathRequest(githubPath)
        .then((response: GhFileResponse) => {
          return this._ghFileToDatalabFile(response);
        });
  }

  public getStringContent(fileId: DatalabFileId, _asText?: boolean):
      Promise<string> {
    const githubPath = this._githubPathForFileId(fileId, 'getStringContent');
    return this._githubApiPathRequest(githubPath)
        .then((response: GhFileResponse) => {
          return this._ghFileToContentString(response);
        });
  }

  public async getRootFile() {
    return this.get(new DatalabFileId('/', FileManagerType.GITHUB));
  }

  public saveText(_file: DatalabFile, _content: string): Promise<DatalabFile> {
    throw new UnsupportedMethod('saveText', this);
  }

  public list(fileId: DatalabFileId): Promise<DatalabFile[]> {
    const pathParts = fileId.path.split('/').filter((part) => !!part);
    if (pathParts.length === 0) {
      // No org/user specified. This would mean we should list all of them,
      // but we know that's too many, so we return an empty list.
      // TODO(jimmc): After fixing file-browser to handle throwing an error
      // here, do that instead.
      return Promise.resolve([]);
    } else if (pathParts.length === 1) {
      // Only the username or org was specified, list their repos
      const githubPath = '/users/' + pathParts[0] + '/repos';
      return this._githubApiPathRequest(githubPath)
          .then((response: GhRepoResponse[]) => {
            return this._ghReposResponseToDatalabFiles(response);
          });
    } else {
      // If at least two path components were specified, then we have
      // a username and a project. Everything after that, if specified,
      // are folders or files under that.
      const githubPath = '/repos/' + pathParts.slice(0, 2).join('/') +
        '/contents/' + pathParts.slice(2).join('/');
      return this._githubApiPathRequest(githubPath)
          .then((response: GhDirEntryResponse[]) => {
            return this._ghDirEntriesResponseToDatalabFiles(response);
          });
    }
  }

  public create(_fileType: DatalabFileType, _containerId: DatalabFileId, _name: string):
      Promise<DatalabFile> {
    throw new UnsupportedMethod('create', this);
  }

  public rename(_oldFileId: DatalabFileId, _name: string, _newContainerId?: DatalabFileId):
      Promise<DatalabFile> {
    throw new UnsupportedMethod('rename', this);
  }

  public delete(_fileId: DatalabFileId): Promise<boolean> {
    throw new UnsupportedMethod('delete', this);
  }

  public copy(_fileId: DatalabFileId, _destinationDirectoryId: DatalabFileId): Promise<DatalabFile> {
    throw new UnsupportedMethod('copy', this);
  }

  public pathToPathHistory(path: string): DatalabFile[] {
    const pathParts = path.split('/').filter((part) => !!part);
    const files: DatalabFile[] = [];
    for (let p = 0; p < pathParts.length; p++) {
      files[p] = this._ghPathPartsToDatalabFile(pathParts.slice(0, p + 1));
    }
    return files;
  }

  private _githubPathForFileId(fileId: DatalabFileId, op: string): string {
    const pathParts = fileId.path.split('/').filter((part) => !!part);
    if (pathParts.length === 0) {
      throw new Error(op + ' on github root is not allowed');
    } else if (pathParts.length === 1) {
      throw new Error(op + ' on a github user is not allowed');
    }
    const githubPath = '/repos/' + pathParts.slice(0, 2).join('/') +
        '/contents/' + pathParts.slice(2).join('/');
    return githubPath;
  }

  // We don't know if the type of the item is actually a directory without
  // querying the github API, so we assume every component is a dir.
  // TODO(jimmc): update pathToPathHistory to query github for the last
  // component on the list to see whether it is a file or directory.
  private _ghPathPartsToDatalabFile(parts: string[]): DatalabFile {
    const path = parts.join('/');
    return new GithubFile({
      icon: '',
      id: new DatalabFileId(path, FileManagerType.GITHUB),
      name: parts[parts.length - 1],
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile);
  }

  // Gets the requested data, from our cache if we have it and it is
  // up to date, else from the github API.
  private _githubApiPathRequest(githubPath: string): Promise<object> {
    const entry = GithubFileManager.cache_.get(githubPath) || {} as GithubCacheEntry;
    if (entry.promise) {
      // There is already a fetch in progress for this data
      return entry.promise;
    }
    const fetchPromise = this._sendApiPathRequest(githubPath, entry.etag)
      .then((request) => {
        entry.promise = undefined;
        if (request.status === 304) {
          // Item has not changed since our last request.
          // This request did not count against the rate limit.
          return entry.data;
        }
        const newEtag = request.getResponseHeader('etag');
        const newData = JSON.parse(request.responseText || 'null');
        if (newEtag) {
          entry.etag = newEtag;
        }
        entry.data = newData;
        return newData;
      });
    entry.promise = fetchPromise;
    GithubFileManager.cache_.put(githubPath, entry);
    return fetchPromise;
  }

  private _sendApiPathRequest(githubPath: string, etag?: string): Promise<any> {
    const githubBaseUrl = 'https://api.github.com';
    const restUrl = githubBaseUrl + githubPath;
    const options: XhrOptions = {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        // The github docs request that we set User-Agent so they can tell
        // what code is sending the API request, but Chrome doesn't let us
        // do that, and the list of Access-Control-Allow-Headers from
        // the preflight to api.github.com pretty much means the only
        // header we can use for this is X-Requested-With.
        'X-Requested-With': 'XMLHttpRequest; googledatalab-datalab-app',
      },
    };
    if (etag) {
      // This item is in our cache, don't retrieve it if it hasn't changed.
      // Hack: TS compiler thinks options.header 'is possibly undefined';
      // we know it is defined, this shuts up the compiler.
      if (options.headers) {
        options.headers['If-None-Match'] = etag;
        options.successCodes = [200, 304];
      }
    }
    return ApiManager.sendRawRequestAsync(restUrl, options, false);
  }

  private _ghRootDatalabFile(): DatalabFile {
    const path = '/';
    return new GithubFile({
      icon: '',
      id: new DatalabFileId(path, FileManagerType.GITHUB),
      name: '/',
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile);
  }

  private _ghReposResponseToDatalabFiles(response: GhRepoResponse[]):
      DatalabFile[] {
    return response.map((repo) => this._ghRepoToDatalabFile(repo));
  }

  private _ghDirEntriesResponseToDatalabFiles(response: GhDirEntryResponse[]):
      DatalabFile[] {
    return response.filter((file) =>
      file.name.endsWith('.ipynb') ||
      file.name.endsWith('.txt') ||
      file.type === 'dir'
    )
    .map((file) => this._ghDirEntryToDatalabFile(file));
  }

  private _ghRepoToDatalabFile(repo: GhRepoResponse): DatalabFile {
    const type = DatalabFileType.DIRECTORY;
    const icon = Utils.getItemIconString(type);
    return new GithubFile({
      icon,
      id: new DatalabFileId(repo.full_name, FileManagerType.GITHUB),
      name: repo.name,
      type,
    } as DatalabFile);
  }

  private _ghDirEntryToDatalabFile(file: GhDirEntryResponse): DatalabFile {
    const type =
        file.name.endsWith('.ipynb') ? DatalabFileType.NOTEBOOK :
        file.type === 'dir' ? DatalabFileType.DIRECTORY :
        DatalabFileType.FILE;
    const icon = Utils.getItemIconString(type);
    const pathParts = file.url.split('/');
    const prefix = pathParts.slice(4, 6).join('/'); // user and project
    const path = prefix + '/' + file.path;
    return new GithubFile({
      icon,
      id: new DatalabFileId(path, FileManagerType.GITHUB),
      name: file.name,
      type,
    } as DatalabFile);
  }

  private _ghFileToDatalabFile(file: GhFileResponse): DatalabFile {
    const type = file.type === 'dir' ?
        DatalabFileType.DIRECTORY : DatalabFileType.FILE;
    const icon = Utils.getItemIconString(type);
    const pathParts = file.url.split('/');
    const prefix = pathParts.slice(4, 6).join('/'); // user and project
    const path = prefix + '/' + file.path;
    return new GithubFile({
      icon,
      id: new DatalabFileId(path, FileManagerType.GITHUB),
      name: file.name,
      type,
    } as DatalabFile);
  }

  private _ghFileToContentString(file: GhFileResponse): string {
    if (file.encoding !== 'base64') {
      throw new Error('github file encoding "' + file.encoding +
        '" is not supported');
    }
    return atob(file.content);
  }
}
