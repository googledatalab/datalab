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

import com.google.cloud.ijava.communication.Message.ConnectRequest;
import com.google.cloud.ijava.communication.Message.Content;
import com.google.cloud.ijava.communication.Message.ExecuteRequest;
import com.google.cloud.ijava.communication.Message.KernelInfoRequest;

import java.util.logging.Logger;

/**
 * This class is responsible for handling requests coming on the shell channel.
 */
class ShellRequestHandler implements Runnable {
  private static Logger LOGGER = Logger.getLogger(ShellRequestHandler.class.getName());

  private CommunicationChannel shellChannel;
  private JavaKernelContext context;

  ShellRequestHandler(CommunicationChannel shellChannel, JavaKernelContext context) {
    this.shellChannel = shellChannel;
    this.context = context;
  }

  @Override
  public void run() {
    while (true) {
      Message<? extends Content.Request> message = null;
      try {
        message = context.kernelCommunicationHandler.receive(shellChannel);
      } catch (Exception e) {
        LOGGER.severe(e.getMessage());
      }
      if (message == null) {
        continue;
      }
      try {
        LOGGER.fine("Received " + KernelJsonConverter.PRETTY_GSON.toJson(message));

        // Setting the display data publisher for the current message:
        _.setDisplayDataPublisher(new IDisplayDataPublisher.DisplayDataPublisherImpl(message,
            context.kernelCommunicationHandler));

        switch (message.header.msg_type) {
          case connect_request:
        @SuppressWarnings("unchecked")
            Message<ConnectRequest> connectMessage = (Message<ConnectRequest>) message;
            new MessageHandlers.ConnectHandler().handle(connectMessage, shellChannel, context);
            break;
          case execute_request:
        @SuppressWarnings("unchecked")
            Message<ExecuteRequest> executeMessage = (Message<ExecuteRequest>) message;
            new MessageHandlers.ExecuteHandler().handle(executeMessage, shellChannel, context);
            break;
          case kernel_info_request:
        @SuppressWarnings("unchecked")
            Message<KernelInfoRequest> kernelInfoMessage = (Message<KernelInfoRequest>) message;
            new MessageHandlers.KernelInfoHandler().handle(kernelInfoMessage, shellChannel,
                context);
            break;
          default:
            LOGGER.warning(String.format("Ignoring %s message.", message.header.msg_type));
            break;
        }
      } catch (Exception e) {
        LOGGER.severe(e.getMessage());
      }
    }
  }
}
