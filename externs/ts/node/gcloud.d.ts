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
 * Type definitions for the gcloud-node module.
 */

declare module GCloud {

  interface Module {
    storage(credentials?: any): Storage.Client;
  }

  module Storage {
    interface Client {
      bucket(name: string): Bucket;
    }

    interface Bucket {
      file(path: string): File;
      getFiles(query: Query, callback: GetFilesCallback): void;
    }

    interface File {
      name: string; // Full path within GCS bucket to the file.

      metadata: {
        kind: string;
        id: string;
        selfLink: string;
        name: string;
        bucket: string;
        generation: string;
        metageneration: string;
        contentType: string;
        updated: string;
        storageClass: string;
        size: string;
        md5Hash: string;
        mediaLink: string;
        owner: {
          entity: string;
          entityId: string;
        };
        crc32c: string;
        etag: string;
      };

      copy(destinationPath: string, callback: Callback<Error, void>): void;
      createWriteStream(): NodeJS.WritableStream;
      delete(callback: Callback<Error, void>): void;
      download(callback: Callback<ReadErrorSet, Buffer>): void;
    }

    interface Query {
      /**
       * Results will contain only objects whose names, aside from the prefix, do not contain
       * delimiter. Objects whose names, aside from the prefix, contain delimiter will have
       * their name truncated after the delimiter, returned in prefixes. Duplicate prefixes
       * are omitted.
       */
      delimiter?: string;

      /**
       * Filter results to objects whose names begin with this prefix.
       */
      prefix?: string;

      /**
       * Maximum number of items plus prefixes to return.
       */
      maxResults?: number;

      /**
       * A previously-returned page token representing part of the larger set of results to view.
       */
      pageToken?: string;
    }

    interface ReadErrorSet {
      errors: ReadError[];
    }

    interface ReadError extends Error {
      reason: string;
    }

    interface Callback<E,D> {
      (error: E, data: D): void;
    }

    interface GetFilesCallback {
      (error: Error, files: File[], nextPageToken: string): void;
    }
  }
}

declare var gcloud: GCloud.Module;
declare module "gcloud" {
    export = gcloud;
}
