/*
 * Copyright 2014 Google Inc. All rights reserved.
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


declare module app {

  interface Map<T> {
    [index: string]: T;
  }

  /**
   * Typedefs for the in-memory notebook model are enumerated here.
   */
  module notebooks {

    interface Notebook {
      id: string; // Notebook id
      worksheets: Worksheet[];
      metadata: app.Map<any>;
    }

    interface Worksheet {
      id: string; // Worksheet id
      name: string; // Worksheet display name
      metadata: app.Map<any>;
      cells: Cell[];
    }

    interface Cell {
      id: string; // Cell id
      type: string; // 'code' | 'markdown' | 'heading' | 'etc'

      /**
       * Some metadata fields reserved for internal usage:
       * {
       *   // if cell type is code
       *   language: 'python' | 'java' | 'html' | 'javascript' | etc.
       *   // if cell type is heading
       *   level: 1 | 2 | 3 | 4 | 5 | 6
       *   // if the output of the cell should be shown as collapsed/exanded
       *   collapsed: <boolean>
       *   // other metadata needed for new/plugin-defined cell types go here
       * }
      */
      metadata: app.Map<any>;

      source: string; // Source content (e.g., code, markdown text, etc.)
      outputs?: CellOutput[];

      prompt?: string; // Prompt to display (e.g., execution counter value, busy symbol, etc.)
    }


    interface CellOutput {
      type: string; // 'result' | 'error' | 'stdout' | 'stderr'

      /**
       * Each output has a mimetype bundle ({<mimetype string>: <content string>}):
       * {
       *   'text/html':  <content for mimetype text/html>,
       *   'text/plain':  <content for mimetype text/plain>,
       *   // any other mimetypes here for the output go here too
       * }
       */
      mimetypeBundle: Map<string>;
      metadata?: app.Map<any>;
    }

  }
}
