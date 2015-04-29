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
 * Type definitions for HTTP API requests and responses.
 */

declare module app {
  module requests {

    /**
     * Request body specification for content creation requests.
     */
    interface CreateContentRequestBody {
      /**
       * The content for the file to be created.
       */
      content: string;
    }

    /**
     * Request body specification for content move requests.
     */
    interface MoveContentRequestBody {
      /**
       * The storage path to which the specified content should be moved/renamed.
       */
      path: string;
    }

    /**
     * Response object for the resources list operation.
     */
    interface ListContentResponse {
      /**
       * The path prefix specified in listing request.
       */
      prefix: string;

      /**
       * The list of resources that exist for the specified path prefix.
       */
      resources: Resource[];
    }

    /**
     * Response body for the sessions list operation.
     */
    interface ListSessionsResponse {

      /**
       * The list of active sessions.
       */
      sessions: SessionMetadata[]
    }
  }

  /**
   * Data-only object for capturing session metadata needed for Sessions API support.
   */
  interface SessionMetadata {
    /**
     * Time at which the session was created.
     *
     * Represented as ISO-8601 extended format string.
     */
    createdAt: string;

    /**
     * Number of active client connections to the session.
     */
    numClients: number;

    /**
     * The resource path for the session.
     */
    path: string;
  }

  /**
   * A single resource (e.g., file/directory).
   */
  interface Resource {
    /**
     * The absolute path to the resource.
     */
    path: string;

    /**
     * Does this resource path represent a directory?
     *
     * true => path represents a "directory" (true directory or path prefix).
     * false => path represents terminal (file or object).
     */
    isDirectory: boolean;

    // The following fields are only provided for files.

    /**
     * Textual description of the resource for display within the UI (e.g., "IPython Notebook").
     */
    description: string;

    /**
     * Last modification timestamp for the file, if one can be determined.
     *
     * Timestamp is in ISO-8601 extended format.
     *
     * If not last modification time is available for the file, then this property is left
     * undefined.
     */
    lastModified?: string;
  }
}
