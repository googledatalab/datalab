package com.google.cloud.ijava.communication;

import com.google.cloud.ijava.communication.Message.MessageType;

import java.util.HashMap;
import java.util.Map;

/**
 * A class for displaying rich data such as HTML and images.
 */
public interface IDisplayDataPublisher {

  public void publish(String mimetype, Object rawData) throws CommunicationException;

  static class DisplayDataPublisherImpl implements IDisplayDataPublisher {
    private Message<?> message;
    private KernelCommunicationHandler communicationHandler;

    DisplayDataPublisherImpl(Message<?> message, KernelCommunicationHandler communicationHandler) {
      this.message = message;
      this.communicationHandler = communicationHandler;
    }

    @Override
    public void publish(String mimetype, Object rawData) throws CommunicationException {
      Map<String, Object> data = new HashMap<>();
      data.put(mimetype, rawData);
      communicationHandler.publish(message.publish(MessageType.display_data,
          new Message.DisplayData("", data, Message.emptyMetadata()), Message.emptyMetadata()));
    }
  }
}
