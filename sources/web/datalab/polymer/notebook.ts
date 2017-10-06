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

const iframe = document.querySelector('#editor') as HTMLIFrameElement;

// tslint:disable-next-line:variable-name
const CommandId = {
  ERROR: 'error',
  LOAD_NOTEBOOK: 'load-notebook',
  UPLOAD_USER_CREDS: 'upload-user-creds',
};

interface IframeMessage {
  command?: string;
  arguments?: any;
  guid?: string;
}

async function processMessageEvent(e: MessageEvent) {
  if (!e.data || !e.data.hasOwnProperty('command')) {
    // Ignore silently. The notebook editor sends other types of messages.
    return;
  }

  const message = e.data as IframeMessage;

  if (message.command === CommandId.UPLOAD_USER_CREDS) {
    const ackMessage: IframeMessage = {
      guid: message.guid,
    };
    try {
      await ApiManager.uploadOauthAccessToken();
    } catch (e) {
      ackMessage.arguments = e.toString();
      ackMessage.command = CommandId.ERROR;
    }
    sendMessageToNotebookEditor(ackMessage);
  } else if (message.command === CommandId.LOAD_NOTEBOOK) {
    let outgoingMessage: IframeMessage;
    try {
      const id = DatalabFileId.fromString(message.arguments);
      const fileManager = FileManagerFactory.getInstanceForType(id.source);
      const [file, doc] = await Promise.all([
        fileManager.get(id),
        fileManager.getStringContent(id),
      ]);
      outgoingMessage = {
        arguments: [file, doc],
      };
    } catch (e) {
      outgoingMessage = {
        arguments: e.toString(),
        command: CommandId.ERROR,
      };
    }
    // Attach the same guid in case this message was sent in an async context
    outgoingMessage.guid = message.guid;
    sendMessageToNotebookEditor(outgoingMessage);
  } else {
    Utils.log.error('Received unknown message command: ', message.command);
    return;
  }
}

function sendMessageToNotebookEditor(message: IframeMessage) {
  if (iframe) {
    iframe.contentWindow.postMessage(message, location.href);
  }
}

if (location.pathname.startsWith('/notebook/')) {
  const path = location.pathname.substr('/notebook/'.length);
  // Currently this is one-directional, iframe wrapper querystring -> iframe hash param.
  // We will need to change this if the editor is allowed to change the id of the
  // open file, for example in the case of Jupyter files where the id is the file path.
  if (iframe) {
    window.top.addEventListener('message', processMessageEvent);
    iframe.src = 'notebookeditor#fileId=' + path;
  }
}
