package com.google.cloud.ijava.communication;

import static org.hamcrest.Matchers.instanceOf;
import static org.hamcrest.Matchers.is;
import static org.junit.Assert.assertThat;

import com.google.cloud.ijava.communication.Message.*;
import com.google.cloud.ijava.runner.FragmentCodeRunner;
import com.google.cloud.ijava.runner.JavaExecutionEngine;

import junit.framework.TestCase;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tests for {@link MessageHandlers}.
 */
@RunWith(JUnit4.class)
public class MessageHandlersTest extends TestCase {

  private FakeCommunicationChannel publishChannel, shellChannel;
  private KernelCommunicationHandler kernelCommunicationHandler;
  private ConnectionProfile profile;
  private JavaExecutionEngine javaExecutionEngine;

  @Override
  @Before
  public void setUp() throws InvalidKeyException, NoSuchAlgorithmException {
    shellChannel = new FakeCommunicationChannel(true);
    publishChannel = new FakeCommunicationChannel(true);
    profile = new ConnectionProfile("", "", 1, 2, 3, 4, 5, "", null);
    kernelCommunicationHandler =
        new KernelCommunicationHandler(publishChannel, shellChannel, profile, "testuser");
    javaExecutionEngine = new FragmentCodeRunner();
  }

  @Test
  public void testKernelInfoRequest() throws CommunicationException {
    MessageHandlers.KernelInfoHandler handler = new MessageHandlers.KernelInfoHandler();
    Message.Header header = new Message.Header(UUID.randomUUID(), "testuser", UUID.randomUUID(),
        Message.MessageType.kernel_info_request);
    handler.handle(new Message<Message.KernelInfoRequest>(Arrays.asList("id1"), header,
        new Message.Header(), Message.emptyMetadata(), new Message.KernelInfoRequest()),
        shellChannel, kernelCommunicationHandler, profile, javaExecutionEngine);
    Message<? extends Content.Reply> reply = receiveReply(shellChannel);
    assertThat(reply.content, instanceOf(KernelInfoReply.class));
    KernelInfoReply kernelInfo = (KernelInfoReply) reply.content;
    assertThat(kernelInfo.language, is("Java"));
    String[] javaVersion = System.getProperty("java.version").split("\\.");
    assertThat(kernelInfo.language_version, is(javaVersion));
  }

  @Test
  public void testConnectRequest() throws CommunicationException {
    MessageHandlers.ConnectHandler handler = new MessageHandlers.ConnectHandler();
    Message.Header header = new Message.Header(UUID.randomUUID(), "testuser", UUID.randomUUID(),
        Message.MessageType.connect_request);
    handler.handle(new Message<Message.ConnectRequest>(Arrays.asList("id1"), header,
        new Message.Header(), Message.emptyMetadata(), new Message.ConnectRequest()), shellChannel,
        kernelCommunicationHandler, profile, javaExecutionEngine);
    Message<? extends Content.Reply> reply = receiveReply(shellChannel);
    assertThat(reply.content, instanceOf(ConnectReply.class));
    ConnectReply connectReply = (ConnectReply) reply.content;
    assertThat(connectReply.hb_port, is(profile.getHb_port()));
    assertThat(connectReply.iopub_port, is(profile.getIopub_port()));
    assertThat(connectReply.shell_port, is(profile.getShell_port()));
    assertThat(connectReply.stdin_port, is(profile.getStdin_port()));
  }

  @Test
  public void testShutdownRequest() throws CommunicationException {
    MessageHandlers.ShutdownHandler handler = new MessageHandlers.ShutdownHandler(false);
    Message.Header header = new Message.Header(UUID.randomUUID(), "testuser", UUID.randomUUID(),
        Message.MessageType.shutdown_request);
    handler.handle(new Message<Message.ShutdownRequest>(Arrays.asList("id1"), header,
        new Message.Header(), Message.emptyMetadata(), new Message.ShutdownRequest()), shellChannel,
        kernelCommunicationHandler, profile, javaExecutionEngine);
    Message<? extends Content.Reply> reply = receiveReply(shellChannel);
    assertThat(reply.content, instanceOf(ShutdownReply.class));
  }

  /**
   * Helper method to convert a sent reply into a message that is sent on a channel. This is similar
   * to {@link KernelCommunicationHandler#receive(CommunicationChannel)} implementation except that
   * this is for receiving replies.
   */
  private Message<? extends Content.Reply> receiveReply(CommunicationChannel channel)
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
      default:
        content = null;
        break;
    }
    Message<Content.Reply> message =
        new Message<Message.Content.Reply>(identities, header, parentHeader, metadata, content);
    return message;
  }
}
