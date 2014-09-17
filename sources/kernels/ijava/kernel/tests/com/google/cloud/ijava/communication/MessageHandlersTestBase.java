package com.google.cloud.ijava.communication;

import com.google.cloud.ijava.communication.Message.ConnectReply;
import com.google.cloud.ijava.communication.Message.Content;
import com.google.cloud.ijava.communication.Message.ExecuteReply;
import com.google.cloud.ijava.communication.Message.Header;
import com.google.cloud.ijava.communication.Message.KernelInfoReply;
import com.google.cloud.ijava.communication.Message.ShutdownReply;
import com.google.cloud.ijava.communication.Message.Status;
import com.google.cloud.ijava.communication.Message.Stream;
import com.google.cloud.ijava.runner.JavaExecutionEngine;

import java.io.InputStream;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A base test class containing common codes related to message handling tests.
 */
public class MessageHandlersTestBase {

  protected Message<Message.ExecuteRequest> createExecuteRequestMessage(String code) {
    Message.Header header = new Message.Header(UUID.randomUUID(), "testuser", UUID.randomUUID(),
        Message.MessageType.execute_request);
    return new Message<Message.ExecuteRequest>(Arrays.asList("id1"), header, new Message.Header(),
        Message.emptyMetadata(), new Message.ExecuteRequest(false,
            code,
            false,
            false,
            new HashMap<String, String>(),
            new ArrayList<String>()));
  }

  /**
   * Helper method to convert a sent reply into a message that is sent on a channel. This is similar
   * to {@link KernelCommunicationHandler#receive(CommunicationChannel)} implementation except that
   * this is for receiving replies.
   */
  protected Message<? extends Content.Reply> receiveReply(CommunicationChannel channel)
      throws CommunicationException {
    List<String> identities = new ArrayList<>();
    @SuppressWarnings("unused")
    String signatureJSON;
    String headerJSON;
    String parentHeaderJSON;
    String metadataJSON;
    String contentJSON;
    synchronized (channel) {
      for (String data = channel.recvStr(); !data.equals(KernelCommunicationHandler.DELIMITER);
          data = channel.recvStr()) {
        identities.add(data);
      }
      signatureJSON = channel.recvStr();
      headerJSON = channel.recvStr();
      parentHeaderJSON = channel.recvStr();
      metadataJSON = channel.recvStr();
      contentJSON = channel.recvStr();
    }
    Header header = KernelJsonConverter.GSON.fromJson(headerJSON, Header.class);
    Header parentHeader = KernelJsonConverter.GSON.fromJson(parentHeaderJSON, Header.class);
    Map<String, String> metadata =
        KernelJsonConverter.GSON.fromJson(metadataJSON, KernelJsonConverter.METADATA_TYPE);
    Content.Reply content = null;
    switch (header.msg_type) {
      case execute_reply:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, ExecuteReply.class);
        break;
      case kernel_info_reply:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, KernelInfoReply.class);
        break;
      case connect_reply:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, ConnectReply.class);
        break;
      case shutdown_reply:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, ShutdownReply.class);
        break;
      case status:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, Status.class);
        break;
      case stream:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, Stream.class);
        break;
      default:
        content = null;
        break;
    }
    Message<Content.Reply> message =
        new Message<Message.Content.Reply>(identities, header, parentHeader, metadata, content);
    return message;
  }

  protected static class NoopJavaExecutionEngine implements JavaExecutionEngine {
    @Override
    public void incExecutionCounter() {}

    @Override
    public int getExecutionCounter() {
      return 0;
    }

    @Override
    public boolean execute(String code, InputStream in, PrintStream out, PrintStream err) {
      return false;
    }
  }

  protected static class CountingJavaExecutionEngine implements JavaExecutionEngine {
    int counter;

    @Override
    public void incExecutionCounter() {
      counter++;
    }

    @Override
    public int getExecutionCounter() {
      return counter;
    }

    @Override
    public boolean execute(String code, InputStream in, PrintStream out, PrintStream err) {
      return false;
    }
  }

  protected final static class AlwaysGoodExecuteJavaExecutionEngine extends
      CountingJavaExecutionEngine {
    @Override
    public boolean execute(String code, InputStream in, PrintStream out, PrintStream err) {
      return true;
    }
  }

  protected final static class OutPublisherJavaExecutionEngine extends CountingJavaExecutionEngine {
    @Override
    public boolean execute(String code, InputStream in, PrintStream out, PrintStream err) {
      out.append("hello world!");
      return true;
    }
  }

  protected final static class ErrPublisherJavaExecutionEngine extends CountingJavaExecutionEngine {
    @Override
    public boolean execute(String code, InputStream in, PrintStream out, PrintStream err) {
      err.append("error!");
      return false;
    }
  }
}
