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
 * This file contains functionality for the entry point of the Datalab editor. It
 * wraps the <datalab-editor> element, and takes a "file" querystring parameter to
 * load it in the editor.
 */
const editorElement = <DatalabEditorElement>document.querySelector('datalab-editor');

document.addEventListener('ThemeChanged', (e: CustomEvent) => {
  // Change the style element's href to trigger the browser to reload it.
  const cssElement = <HTMLLinkElement | null>document.querySelector('#themeStylesheet');
  if (cssElement) {
    const sheetAddress = cssElement.href + "?v=" + Date.now()
    cssElement.setAttribute('href', sheetAddress);
  }

  // Change the editor's theme.
  if (editorElement && e && e.detail) {
    editorElement.setEditorTheme(e.detail);
  }
});

// Pass the file's path if it's specified in the location.
if (editorElement) {
  const params = new URLSearchParams(window.location.search);
  if (params.has('file')) {
    editorElement.filePath = <string>params.get('file');
  }
}
