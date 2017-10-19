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
 * A cache for documents downloaded using the github API.
 * This helps us use that rate-limited connection more effectively.
 */

interface GithubCacheEntry {
  data?: object;   // The payload
  etag?: string;   // The value of the etag header in the github response
  promise?: Promise<object>;  // The fetch promise if we don't yet have the data
}

/**
 * A cache that holds github responses.
 */
class GithubCache {

  cache: {[key: string]: GithubCacheEntry} = {};

  // TODO(jimmc) - allow specifying some limits for the cache,
  // such as time limit, count limit, or entry size limit

  // Returns the entry for the given path, or null if not in the cache.
  public get(path: string): GithubCacheEntry | null {
    const entry = this.cache[path];
    return entry;
  }

  // Puts the given data into the cache. If there is an existing entry
  // at that path, updates that entry.
  public put(path: string, entry: GithubCacheEntry) {
    this.cache[path] = entry;
  }
}
