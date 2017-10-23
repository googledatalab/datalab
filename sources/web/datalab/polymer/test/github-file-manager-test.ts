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

describe('GithubCache', () => {

  it('should return undefined for path not in the cache', () => {
    const cache = new GithubCache();
    assert(cache.get('/no/such/path') === undefined,
        'unexpected entry for unknown path');
  });

  it('should return the entry for a stored values', () => {
    const cache = new GithubCache();
    const path = '/path/to/our/data';
    const entry = {
      data: { foo: 'bar' },
      etag: '1234',
    } as any as GithubCacheEntry;

    cache.put(path, entry);

    assert(cache.get(path) === entry,
        'unexpected entry for known path');
    assert(cache.get('/no/such/path') === undefined,
        'unexpected entry for unknown path');
  });

});
