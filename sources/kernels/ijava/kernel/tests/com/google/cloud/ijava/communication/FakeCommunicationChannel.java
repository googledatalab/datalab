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

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

class FakeCommunicationChannel implements CommunicationChannel {

  protected BlockingQueue<String> toReceive;
  protected BlockingQueue<String> sent;

  /**
   * @param isPipe when true this channel will send the data from sent queue to the receive queue.
   */
  FakeCommunicationChannel(boolean isPipe) {
    sent = new LinkedBlockingQueue<>();
    if (isPipe) {
      toReceive = sent;
    } else {
      toReceive = new LinkedBlockingQueue<>();
    }
  }

  FakeCommunicationChannel() {
    this(false);
  }

  @Override
  public String recvStr() throws CommunicationException {
    try {
      return toReceive.take();
    } catch (InterruptedException e) {
      throw new CommunicationException(e);
    }
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