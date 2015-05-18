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

/// <reference path="../common/interfaces.d.ts" />
/// <reference path="../../../../../../externs/ts/node/node.d.ts" />
/**
 * Helpers for translating to/from IPython protocol messages
 */


/**
 * Delimits a list of message identities from the message in the multipart IPython message format.
 */
var IPY_MSG_IDS_DELIMITER = '<IDS|MSG>';

/**
 * Creates an IPython multipart kernel message (protocol version 4.1).
 */
export function createIPyMessage(
    sessionId: string,
    messageId: string,
    messageType: string,
    content: any,
    requestContext: any
    ): string[] {

  var header = {
    msg_id: messageId,
    session: sessionId,
    msg_type: messageType,
    msg_context: requestContext
  };

  var parentHeader = {};
  var metadata = {};

  // A multipart message is simply an array of messages.
  return [IPY_MSG_IDS_DELIMITER,
      '', // HMAC digest
      JSON.stringify(header),
      JSON.stringify(parentHeader),
      JSON.stringify(metadata),
      JSON.stringify(content)];
}

/**
 * Deserializes a multi-part ZeroMQ message.
 *
 * @param args The set of arguments supplied by ZeroMQ in a message handling callback.
 * @return The message parts (array of strings).
 */
export function deserializeZeroMQMessage(args: IArguments): string[] {
  // An IPython message arrives as an array of "buffers" that need to be decoded to strings
  var buffers = <Buffer[]>Array.apply(null, args);
  var messageParts = buffers.map((buffer: Buffer) => {
    return buffer.toString('utf-8');
  });

  return messageParts;
}

/**
 * Parses an arguments object containing an IPython multipart kernel message.
 *
 * Note: IPython protocol version 4.1
 */
export function parseIPyMessage(args: IArguments): app.ipy.Message {
  // Convert the multi-part message buffers to utf-8 strings.
  var messageParts = deserializeZeroMQMessage(args);

  // Read identities until reaching the message delimiter token.
  var identities: string[] = [];
  var offset = 0;
  for (offset = 0; offset < messageParts.length; ++offset) {
    if (messageParts[offset] == IPY_MSG_IDS_DELIMITER) {
      ++offset; // skip the delimiter token
      break;
    }
    identities.push(messageParts[offset]);
  }

  ++offset; // Skip the HMAC digest

  // The offset index now points to header dict index.
  return {
    identities: identities,
    header: JSON.parse(messageParts[offset]),
    parentHeader: JSON.parse(messageParts[offset + 1]),
    metadata: JSON.parse(messageParts[offset + 2]),
    content: JSON.parse(messageParts[offset + 3])
  };
}
