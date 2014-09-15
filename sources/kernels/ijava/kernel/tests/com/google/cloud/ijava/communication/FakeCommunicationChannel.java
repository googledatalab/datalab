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

package com.google.cloud.ijava.communication;

import java.util.ArrayDeque;
import java.util.Queue;

class FakeCommunicationChannel implements CommunicationChannel {

  Queue<String> toReceive;
  Queue<String> sent;

  /**
   * @param isPipe when true this channel will send the data from sent queue to the receive queue.
   */
  FakeCommunicationChannel(boolean isPipe) {
    sent = new ArrayDeque<>();
    if (isPipe) {
      toReceive = sent;
    }
  }

  FakeCommunicationChannel() {
    this(false);
  }

  @Override
  public String recvStr() throws CommunicationException {
    return toReceive.poll();
  }

  @Override
  public boolean send(String data) throws CommunicationException {
    return sent.offer(data);
  }

  @Override
  public boolean sendMore(String data) throws CommunicationException {
    return sent.offer(data);
  }

  @Override
  public void close() throws CommunicationException {}
}