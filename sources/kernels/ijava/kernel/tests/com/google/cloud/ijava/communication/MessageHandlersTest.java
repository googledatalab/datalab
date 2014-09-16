package com.google.cloud.ijava.communication;

import static org.hamcrest.Matchers.instanceOf;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.greaterThan;
import static org.junit.Assert.assertThat;

import com.google.cloud.ijava.communication.Message.ExecuteReply;
import com.google.cloud.ijava.communication.Message.Stream;
import com.google.cloud.ijava.communication.Message.*;
import com.google.cloud.ijava.runner.JavaExecutionEngine;

import junit.framework.TestCase;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.io.InputStream;
import java.io.PrintStream;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
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
    javaExecutionEngine = new NoopJavaExecutionEngine();
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

  @Test
  public void testExecuteEmptyInput() throws CommunicationException {
    JavaExecutionEngine executionEngine = new CountingJavaExecutionEngine();
    int currentCounter = executionEngine.getExecutionCounter();

    new MessageHandlers.ExecuteHandler().handle(createExecuteRequestMessage("    "), shellChannel,
        kernelCommunicationHandler, profile, executionEngine);

    Message<? extends Content.Reply> reply = receiveReply(shellChannel);
    assertThat(reply.content, instanceOf(ExecuteReply.class));
    ExecuteReply executeReply = (ExecuteReply) reply.content;
    // Make sure the counter has not changed.
    assertThat(executeReply.execution_count, is(currentCounter));
  }

  @Test
  public void testGoodExecution() throws CommunicationException {
    JavaExecutionEngine executionEngine = new AlwaysGoodExecuteJavaExecutionEngine();
    int currentCounter = executionEngine.getExecutionCounter();

    new MessageHandlers.ExecuteHandler().handle(createExecuteRequestMessage("int a = 0;"),
        shellChannel, kernelCommunicationHandler, profile, executionEngine);

    Message<? extends Content.Reply> reply = receiveReply(shellChannel);
    assertThat(reply.content, instanceOf(ExecuteReply.class));
    ExecuteReply executeReply = (ExecuteReply) reply.content;
    assertThat(executeReply.status, is(ExecutionStatus.ok));
    // Make sure the counter has changed:
    assertThat(executionEngine.getExecutionCounter(), greaterThan(currentCounter));
  }

  @Test
  public void testBadExecution() throws CommunicationException {
    JavaExecutionEngine executionEngine = new CountingJavaExecutionEngine();
    int currentCounter = executionEngine.getExecutionCounter();

    new MessageHandlers.ExecuteHandler().handle(createExecuteRequestMessage("int a = 0;"),
        shellChannel, kernelCommunicationHandler, profile, executionEngine);

    Message<? extends Content.Reply> reply = receiveReply(shellChannel);
    assertThat(reply.content, instanceOf(ExecuteReply.class));
    ExecuteReply executeReply = (ExecuteReply) reply.content;
    assertThat(executeReply.status, is(ExecutionStatus.error));
    // Make sure the counter has changed:
    assertThat(executionEngine.getExecutionCounter(), greaterThan(currentCounter));
  }

  @Test
  public void testPublishedOutputExecution() throws CommunicationException {
    JavaExecutionEngine executionEngine = new OutPublisherJavaExecutionEngine();
    int currentCounter = executionEngine.getExecutionCounter();

    new MessageHandlers.ExecuteHandler().handle(createExecuteRequestMessage("int a = 0;"),
        shellChannel, kernelCommunicationHandler, profile, executionEngine);

    Message<? extends Content.Reply> reply = receiveReply(shellChannel);
    assertThat(reply.content, instanceOf(ExecuteReply.class));
    ExecuteReply executeReply = (ExecuteReply) reply.content;
    assertThat(executeReply.status, is(ExecutionStatus.ok));
    // Make sure the counter has changed:
    assertThat(executionEngine.getExecutionCounter(), greaterThan(currentCounter));

    Message<? extends Content.Reply> publishedReply = receiveReply(publishChannel);
    assertThat(publishedReply.content, instanceOf(Status.class));

    publishedReply = receiveReply(publishChannel);
    assertThat(publishedReply.content, instanceOf(Stream.class));
    Stream stream = (Stream) publishedReply.content;
    assertThat(stream.data, is("hello world!"));
  }

  @Test
  public void testPublishedErrorExecution() throws CommunicationException {
    JavaExecutionEngine executionEngine = new ErrPublisherJavaExecutionEngine();
    int currentCounter = executionEngine.getExecutionCounter();

    new MessageHandlers.ExecuteHandler().handle(createExecuteRequestMessage("err!"),
        shellChannel, kernelCommunicationHandler, profile, executionEngine);

    Message<? extends Content.Reply> reply = receiveReply(shellChannel);
    assertThat(reply.content, instanceOf(ExecuteReply.class));
    ExecuteReply executeReply = (ExecuteReply) reply.content;
    assertThat(executeReply.status, is(ExecutionStatus.error));
    // Make sure the counter has changed:
    assertThat(executionEngine.getExecutionCounter(), greaterThan(currentCounter));

    Message<? extends Content.Reply> publishedReply = receiveReply(publishChannel);
    assertThat(publishedReply.content, instanceOf(Status.class));

    publishedReply = receiveReply(publishChannel);
    assertThat(publishedReply.content, instanceOf(Stream.class));
    Stream stream = (Stream) publishedReply.content;
    assertThat(stream.data, is("error!"));
  }

  private Message<Message.ExecuteRequest> createExecuteRequestMessage(String code) {
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

  private static class NoopJavaExecutionEngine implements JavaExecutionEngine {
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

  private static class CountingJavaExecutionEngine implements JavaExecutionEngine {
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

  private final static class AlwaysGoodExecuteJavaExecutionEngine extends
      CountingJavaExecutionEngine {
    @Override
    public boolean execute(String code, InputStream in, PrintStream out, PrintStream err) {
      return true;
    }
  }

  private final static class OutPublisherJavaExecutionEngine extends
      CountingJavaExecutionEngine {
    @Override
    public boolean execute(String code, InputStream in, PrintStream out, PrintStream err) {
      out.append("hello world!");
      return true;
    }
  }

  private final static class ErrPublisherJavaExecutionEngine extends
      CountingJavaExecutionEngine {
    @Override
    public boolean execute(String code, InputStream in, PrintStream out, PrintStream err) {
      err.append("error!");
      return false;
    }
  }
}
