package com.google.cloud.ijava.communication;

import com.google.cloud.ijava.communication.Message.Content;
import com.google.cloud.ijava.communication.Message.ShutdownRequest;

import java.util.logging.Logger;

/**
 * This class is responsible for handling requests coming on the control channel.
 */
class ControlRequestHandler implements Runnable {
  private static Logger LOGGER = Logger.getLogger(ControlRequestHandler.class.getName());

  private CommunicationChannel controlChannel;
  private JavaKernelContext context;

  ControlRequestHandler(CommunicationChannel controlChannel, JavaKernelContext context) {
    this.controlChannel = controlChannel;
    this.context = context;
  }

  @Override
  public void run() {
    while (true) {
      Message<? extends Content.Request> message = null;
      try {
        message = context.kernelCommunicationHandler.receive(controlChannel);
      } catch (Exception e) {
        LOGGER.severe(e.getMessage());
      }
      if (message == null) {
        continue;
      }
      try {
        LOGGER.fine("Received " + KernelJsonConverter.PRETTY_GSON.toJson(message));
        switch (message.header.msg_type) {
          case shutdown_request:
        @SuppressWarnings("unchecked")
            Message<ShutdownRequest> shutdownMessage = (Message<ShutdownRequest>) message;
            new MessageHandlers.ShutdownHandler().handle(shutdownMessage, controlChannel, context);
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
