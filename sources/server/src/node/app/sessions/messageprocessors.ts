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


/**
 * Functions for processing messages flowing through sessions.
 */
import actions = require('../shared/actions');


/**
 * Gets the ordered list of message processors.
 */
export function getMessageProcessors (): app.MessageProcessor[] {
  return [
    logMessage,
    processSessionRename
  ];
}

/**
 * Logs all messages to the console.
 */
function logMessage (message: any, session: app.ISession): any {
  console.log('Message: ', JSON.stringify(message));
  return message;
}

/**
 * Renames session ids to whenever a notebook path rename occurs.
 */
function processSessionRename (
    message: any,
    session: app.ISession,
    sessionManager: app.ISessionManager): any {
  // For any notebook rename messages, also update the session id to match
  if (message.action == actions.notebook.rename) {
    if (!message.path) {
      throw new Error('Invalid session id for renaming "'+message.path+'"');
    }
    sessionManager.renameSession(session.id, message.path);
  }
  return message;
}
