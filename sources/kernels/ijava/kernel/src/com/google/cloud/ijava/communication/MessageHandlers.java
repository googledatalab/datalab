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

import com.google.cloud.ijava.communication.Message.ConnectReply;
import com.google.cloud.ijava.communication.Message.ConnectRequest;
import com.google.cloud.ijava.communication.Message.ExecuteRequest;
import com.google.cloud.ijava.communication.Message.ExecutionState;
import com.google.cloud.ijava.communication.Message.KernelInfoRequest;
import com.google.cloud.ijava.communication.Message.MessageType;
import com.google.cloud.ijava.communication.Message.ShutdownReply;
import com.google.cloud.ijava.communication.Message.ShutdownRequest;
import com.google.cloud.ijava.communication.Message.Stream.StreamName;
import com.google.cloud.ijava.runner.JavaExecutionEngine;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Preconditions;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletionService;
import java.util.concurrent.ExecutorCompletionService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;

/**
 * This class contains implementation of different types message handlers.
 */
class MessageHandlers {
  private static Logger LOGGER = Logger.getLogger(MessageHandlers.class.getName());

  /**
   * This class handles the {@code kernel_info_request} message. <blockquote
   * cite="http://ipython.org/ipython-doc/2/development/messaging.html#kernel-info"> If a client
   * needs to know information about the kernel, it can make a request of the kernel's information.
   * This message can be used to fetch core information of the kernel, including language (e.g.,
   * Java), language version number and protocol version. </blockquote>
   */
  static class KernelInfoHandler extends MessageHandler<Message<Message.KernelInfoRequest>> {

    @Override
    public void handle(Message<KernelInfoRequest> message, CommunicationChannel socket,
        KernelCommunicationHandler communicationHandler, ConnectionProfile connectionProfile,
        JavaExecutionEngine javaExecutionEngine) throws CommunicationException {
      Preconditions.checkArgument(message.header.msg_type == MessageType.kernel_info_request);
      String[] javaVersion = System.getProperty("java.version").split("\\.");
      communicationHandler.send(socket, message.reply(
          MessageType.kernel_info_reply, new Message.KernelInfoReply(new String[] {"1", "0"},
              new String[] {}, javaVersion, "Java"), Message.emptyMetadata()));
    }
  }

  /**
   * This class handles the {@code connect_request}. <blockquote
   * cite="http://ipython.org/ipython-doc/2/development/messaging.html#connect"> When a client
   * connects to the request/reply socket of the kernel, it can issue a connect request to get basic
   * information about the kernel, such as the ports the other ZeroMQ sockets are listening on. This
   * allows clients to only have to know about a single port (the shell channel) to connect to a
   * kernel. </blockquote>
   */
  static class ConnectHandler extends MessageHandler<Message<Message.ConnectRequest>> {

    @Override
    public void handle(Message<ConnectRequest> message, CommunicationChannel socket,
        KernelCommunicationHandler communicationHandler, ConnectionProfile connectionProfile,
        JavaExecutionEngine javaExecutionEngine) throws CommunicationException {
      Preconditions.checkArgument(message.header.msg_type == MessageType.connect_request);
      communicationHandler.send(socket, message.reply(MessageType.connect_reply, new ConnectReply(
          connectionProfile.getShell_port(), connectionProfile.getIopub_port(),
          connectionProfile.getStdin_port(), connectionProfile.getHb_port()),
          Message.emptyMetadata()));
    }
  }

  /**
   * This class handles the shutdown request. See <a
   * href="http://ipython.org/ipython-doc/2/development/messaging.html#kernel-shutdown">Kernel
   * Shutdown</a> for more information.
   */
  static class ShutdownHandler extends MessageHandler<Message<ShutdownRequest>> {

    /**
     * This field exists for testing purposes. We do not want to shutdown the JVM during test!
     */
    private boolean doShutdown = true;

    ShutdownHandler() {
      this(true);
    }

    @VisibleForTesting
    ShutdownHandler(boolean doShutdown) {
      this.doShutdown = doShutdown;
    }

    @Override
    public void handle(Message<ShutdownRequest> message, CommunicationChannel socket,
        KernelCommunicationHandler communicationHandler, ConnectionProfile connectionProfile,
        JavaExecutionEngine javaExecutionEngine) throws CommunicationException {
      Preconditions.checkArgument(message.header.msg_type == MessageType.shutdown_request);
      communicationHandler.send(socket, message.reply(MessageType.shutdown_reply,
          new ShutdownReply(message.content.restart), Message.emptyMetadata()));
      LOGGER.fine("Shutting down.");
      // The shutdown hook that we setup when we run the kernel will do the required things before
      // shutdown.
      if (doShutdown) {
        System.exit(0);
      }
    }
  }
}
