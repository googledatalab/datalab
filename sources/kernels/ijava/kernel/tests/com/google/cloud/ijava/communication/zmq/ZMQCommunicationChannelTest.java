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

package com.google.cloud.ijava.communication.zmq;

import com.google.cloud.ijava.communication.CommunicationException;

import static org.hamcrest.Matchers.is;
import static org.junit.Assert.assertThat;

import junit.framework.TestCase;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import org.zeromq.ZMQ;
import org.zeromq.ZMQ.Context;
import org.zeromq.ZMQ.Socket;

/**
 * Tests for {@link ZMQCommunicationChannel}.
 */
@RunWith(JUnit4.class)
public class ZMQCommunicationChannelTest extends TestCase {
  private ZMQCommunicationChannel dealerChannel;
  private ZMQCommunicationChannel routerChannel;
  private Socket dealerSocket;
  private Socket routerSocket;
  private Context context;

  @Override
  @Before
  public void setUp() {
    context = ZMQ.context(1);
    routerSocket = context.socket(ZMQ.ROUTER);
    routerSocket.bind("tcp://*:32323");
    dealerSocket = context.socket(ZMQ.DEALER);
    dealerSocket.connect("tcp://localhost:32323");
    dealerChannel = new ZMQCommunicationChannel(dealerSocket);
    routerChannel = new ZMQCommunicationChannel(routerSocket);
  }

  @Test
  public void testSendAndReceive() throws CommunicationException {
    assertTrue(dealerChannel.sendMore("test1"));
    assertTrue(dealerChannel.send("test2"));
    routerChannel.recvStr();
    assertThat(routerChannel.recvStr(), is("test1"));
    assertThat(routerChannel.recvStr(), is("test2"));
  }

  @Override
  @After
  public void tearDown() throws Exception {
    routerSocket.unbind("tcp://localhost:32323");
    dealerChannel.close();
    routerChannel.close();
    context.term();
  }
}
