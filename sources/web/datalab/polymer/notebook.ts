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
 * This file contains communication logic between the notebook editor and the
 * rest of the UI components. The notebook editor app will send messages across
 * the iframe boundary using postMessage. Messages have a defined structure,
 * and will trigger this code to call methods in the rest of the UI components
 * to act according to the requested action.
 */
enum IframeMessageCommand {
  UPLOAD_USER_CREDS,
}

interface IframeMessage {
  command: IframeMessageCommand;
  arguments: any;
}

function processMessageEvent(e: MessageEvent) {
  if (!e.data || !e.data.hasOwnProperty('command')) {
    Utils.log.error('Received unknown message: ', e.data);
    return;
  }

  const message = e.data as IframeMessage;

  if (message.command === IframeMessageCommand.UPLOAD_USER_CREDS) {
    ApiManagerFactory.getInstance().uploadOauthAccessToken();
  } else {
    Utils.log.error('Received unknown message command: ', message.command);
    return;
  }
}

const params = new URLSearchParams(window.location.search);
if (params.has('file')) {
  const iframe = document.querySelector('#editor') as HTMLIFrameElement;
  // Currently this is one-directional, iframe wrapper querystring -> iframe hash param.
  // We will need to change this if the editor is allowed to change the id of the
  // open file, for example in the case of Jupyter files where the id is the file path.
  if (iframe) {
    window.top.addEventListener('message', processMessageEvent);
    iframe.src = '/notebookeditor#fileId=' + params.get('file');
  }
}
