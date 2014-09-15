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

/**
 * An interface between IJava kernel and underlying transport layer for sending and receiving data.
 */
public interface CommunicationChannel {

  /**
   * @return the message received, as a String object; null on no message.
   */
  public String recvStr() throws CommunicationException;

  /**
   * Sends the data over socket.
   *
   * @return true if the send was successful, false otherwise.
   */
  public boolean send(String data) throws CommunicationException;


  /**
   * Sends the data over socket and indicates that more message parts are coming.
   *
   * @return true if the send was successful, false otherwise.
   */
  public boolean sendMore(String data) throws CommunicationException;

  /**
   * Closes the communication channel.
   */
  public void close() throws CommunicationException;
}
