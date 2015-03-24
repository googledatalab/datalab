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
import util = require('../common/util');


/**
 * Gets the ordered list of message processors.
 */
export function getMessageProcessors (): app.MessageProcessor[] {
  return [
    logMessage
  ];
}

/**
 * Logs all messages to the console.
 */
function logMessage (message: app.Map<any>, session: app.ISession): app.Map<any> {
  console.log('Message: ', JSON.stringify(message));
  return message;
}
