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
const toast = document.querySelector('#datalabNotification') as any;
const queryParams = new URLSearchParams(window.location.search);

// tslint:disable-next-line:variable-name
const CommandId = {
  ERROR: 'error',
  LOAD_NOTEBOOK: 'load-notebook',
  PICK_PROJECT: 'pick-project',
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

  switch (message.command) {
    case CommandId.UPLOAD_USER_CREDS:
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
      break;

    case CommandId.LOAD_NOTEBOOK:
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
      break;

    case CommandId.PICK_PROJECT:
      const options: BaseDialogOptions = {
        big: true,
        okLabel: 'Select',
        title: 'Select Project',
      };
      const result = await Utils.showDialog(ProjectPickerDialogElement, options) as
          ProjectPickerDialogCloseResult;

      const projectName = result.confirmed ? result.projectName : null;

      // Attach the same guid in case this message was sent in an async context
      const projectMessage: IframeMessage = {
        arguments: projectName,
        guid: message.guid,
      };
      sendMessageToNotebookEditor(projectMessage);
      break;

    default:
      Utils.log.error('Received unknown message command: ', message.command);
      return;
  }
}

function sendMessageToNotebookEditor(message: IframeMessage) {
  if (iframe) {
    iframe.contentWindow.postMessage(message, location.href);
  }
}

async function createNew(parentPath: string) {
  toast.open();

  try {
    await GapiManager.loadGapi();

    const parentId = DatalabFileId.fromString(parentPath);
    const fileName = queryParams.get('fileName') as string;
    const fileManager = FileManagerFactory.getInstanceForType(
      FileManagerFactory.fileManagerNameToType(parentId.source));
    const newFile = await fileManager.create(DatalabFileType.NOTEBOOK, parentId, fileName);

    // If this is a template, populate it
    if (queryParams.has('templateName')) {
      const templateName = queryParams.get('templateName') as string;
      const params = JSON.parse(decodeURIComponent(queryParams.get('params') || '{}'));
      const template = await TemplateManager.newNotebookFromTemplate(templateName, params);
      await fileManager.saveText(newFile, JSON.stringify(template));
    }
    location.href = fileManager.getNotebookUrl(newFile.id);
  } catch (e) {
    // TODO: Add some error message here.
    Utils.log.error('Failed to create notebook:', e.message);
  }
  toast.close();
}

if (location.pathname.startsWith(Utils.constants.notebookUrlComponent) && iframe) {
  window.top.addEventListener('message', processMessageEvent);

  if (location.pathname.startsWith(Utils.constants.newNotebookUrlComponent) &&
      queryParams.has('fileName')) {
    // If this is a new notebook being created, make sure it's created and populated
    // first (if it's a template), then redirect this window to that new file.
    const parentPath = location.pathname.substr(Utils.constants.newNotebookUrlComponent.length);
    createNew(parentPath);
  } else {
    // Set the iframe source to load the notebook editor resources.
    // TODO: Currently this is one-directional, iframe wrapper url -> iframe
    // hash param. We will need to change this if the editor is allowed to
    // change the id of the open file, for example in the case of the editor
    // renaming the file.

    // Adding the 'inIframe' query parameter signals to the server that we want
    // to load the notebook editor resources as opposed to the notebook shell
    // (this file). Both resources are loaded at /notebook in order to make any
    // links in the editor relative to /notebook as well.
    const path = location.pathname.substr(Utils.constants.notebookUrlComponent.length);
    iframe.src = Utils.constants.notebookUrlComponent + path +
        '?inIframe#fileId=' + path;
  }
}
