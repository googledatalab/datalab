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

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.instanceOf;
import static org.hamcrest.Matchers.is;
import static org.junit.Assert.assertThat;

import com.google.cloud.ijava.communication.Message.Content.Request;
import com.google.cloud.ijava.communication.Message.ExecuteReply;
import com.google.cloud.ijava.communication.Message.ExecutionStatus;

import junit.framework.TestCase;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Queue;
import java.util.UUID;

/**
 * Tests for {@link KernelCommunicationHandler}.
 */
@RunWith(JUnit4.class)
public class KernelCommunicationHandlerTest extends TestCase {

  private FakeCommunicationChannel publishChannel, shellChannel;
  private KernelCommunicationHandler kernelCommunicationHandler;

  @Override
  @Before
  public void setUp() throws InvalidKeyException, NoSuchAlgorithmException {
    shellChannel = new FakeCommunicationChannel();
    publishChannel = new FakeCommunicationChannel();
    kernelCommunicationHandler = new KernelCommunicationHandler(publishChannel, shellChannel,
        new ConnectionProfile("", "", 1, 2, 3, 4, 5, "", null), "testuser");
  }

  @Test
  public void testReceive() throws CommunicationException {
    shellChannel.toReceive = new ArrayDeque<>();
    shellChannel.toReceive.offer("id1");
    shellChannel.toReceive.offer(KernelCommunicationHandler.DELIMITER);
    // signature
    shellChannel.toReceive.offer("");
    shellChannel.toReceive.offer(KernelJsonConverter.GSON.toJson(new Message.Header(
        UUID.randomUUID(), "testuser", UUID.randomUUID(), Message.MessageType.execute_request)));
    shellChannel.toReceive.offer(KernelJsonConverter.GSON.toJson(new Message.Header()));
    shellChannel.toReceive.offer(KernelJsonConverter.GSON.toJson(new HashMap<>()));
    shellChannel.toReceive.offer(KernelJsonConverter.GSON.toJson(new Message.ExecuteRequest(false,
        "a = 10;",
        true,
        false,
        new HashMap<String, String>(),
        new ArrayList<String>())));
    Message<? extends Request> m = kernelCommunicationHandler.receive(shellChannel);
    assertThat(m.identities, hasItem("id1"));
    assertThat(m.content, instanceOf(Message.ExecuteRequest.class));
    assertThat(((Message.ExecuteRequest) m.content).code, is("a = 10;"));
  }

  @Test
  public void testSend() throws CommunicationException {
    Message.Header header = new Message.Header(UUID.randomUUID(), "testuser", UUID.randomUUID(),
        Message.MessageType.execute_reply);
    Message.ExecuteReply content = new Message.ExecuteReply(ExecutionStatus.ok, 1);
    kernelCommunicationHandler.send(publishChannel, new Message<ExecuteReply>(Arrays.asList("id1"),
        header, new Message.Header(), Message.emptyMetadata(), content));
    assertThat(publishChannel.sent, hasItem("id1"));
    assertThat(publishChannel.sent, hasItem(KernelJsonConverter.GSON.toJson(header)));
    assertThat(publishChannel.sent, hasItem(KernelJsonConverter.GSON.toJson(content)));
  }

  static class FakeCommunicationChannel implements CommunicationChannel {

    Queue<String> toReceive;
    List<String> sent;

    FakeCommunicationChannel() {
      sent = new ArrayList<>();
    }

    @Override
    public String recvStr() throws CommunicationException {
      return toReceive.poll();
    }

    @Override
    public boolean send(String data) throws CommunicationException {
      return sent.add(data);
    }

    @Override
    public boolean sendMore(String data) throws CommunicationException {
      return sent.add(data);
    }

    @Override
    public void close() throws CommunicationException {}
  }
}
