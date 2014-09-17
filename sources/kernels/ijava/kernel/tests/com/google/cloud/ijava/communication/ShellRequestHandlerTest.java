package com.google.cloud.ijava.communication;

import static org.hamcrest.Matchers.instanceOf;
import static org.hamcrest.Matchers.is;
import static org.junit.Assert.assertThat;

import com.google.cloud.ijava.communication.Message.ConnectReply;
import com.google.cloud.ijava.communication.Message.Content;
import com.google.cloud.ijava.communication.Message.ExecuteReply;
import com.google.cloud.ijava.communication.Message.KernelInfoReply;
import com.google.cloud.ijava.runner.JavaExecutionEngine;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.UUID;

/**
 * Tests for {@link ShellRequestHandler} class.
 */
@RunWith(JUnit4.class)
public class ShellRequestHandlerTest extends MessageHandlersTestBase {

  private TwoHeadedChannel shellChannel;
  private FakeCommunicationChannel publishChannel;
  private JavaKernelContext context;
  private Thread requestHandler;

  @Before
  public void setUp() throws InvalidKeyException, NoSuchAlgorithmException {
    shellChannel = new TwoHeadedChannel();
    publishChannel = new FakeCommunicationChannel(true);
    ConnectionProfile connectionProfile = new ConnectionProfile("", "", 1, 2, 3, 4, 5, "", null);
    context = new JavaKernelContext(new KernelCommunicationHandler(publishChannel,
        shellChannel.channel1, connectionProfile, "testuser"), connectionProfile,
        new NoopJavaExecutionEngine());
    requestHandler = new Thread(new ShellRequestHandler(shellChannel.channel1, context));
    requestHandler.start();
  }

  @After
  public void tearDown() {
    requestHandler.interrupt();
    requestHandler = null;
  }

  @Test
  public void testKernelInfoRequest() throws CommunicationException {
    Message.Header header = new Message.Header(UUID.randomUUID(), "testuser", UUID.randomUUID(),
        Message.MessageType.kernel_info_request);

    context.kernelCommunicationHandler.send(shellChannel.channel2, new Message<
        Message.KernelInfoRequest>(Arrays.asList("id1"), header, new Message.Header(),
        Message.emptyMetadata(), new Message.KernelInfoRequest()));

    Message<? extends Content.Reply> reply = receiveReply(shellChannel.channel2);
    assertThat(reply.content, instanceOf(KernelInfoReply.class));
    KernelInfoReply kernelInfo = (KernelInfoReply) reply.content;
    assertThat(kernelInfo.language, is("Java"));
    String[] javaVersion = System.getProperty("java.version").split("\\.");
    assertThat(kernelInfo.language_version, is(javaVersion));
  }

  @Test
  public void testConnectRequest() throws CommunicationException {
    Message.Header header = new Message.Header(UUID.randomUUID(), "testuser", UUID.randomUUID(),
        Message.MessageType.connect_request);
    context.kernelCommunicationHandler.send(shellChannel.channel2, new Message<
        Message.ConnectRequest>(Arrays.asList("id1"), header, new Message.Header(),
        Message.emptyMetadata(), new Message.ConnectRequest()));

    Message<? extends Content.Reply> reply = receiveReply(shellChannel.channel2);
    assertThat(reply.content, instanceOf(ConnectReply.class));
    ConnectReply connectReply = (ConnectReply) reply.content;
    assertThat(connectReply.hb_port, is(context.connectionProfile.getHb_port()));
    assertThat(connectReply.iopub_port, is(context.connectionProfile.getIopub_port()));
    assertThat(connectReply.shell_port, is(context.connectionProfile.getShell_port()));
    assertThat(connectReply.stdin_port, is(context.connectionProfile.getStdin_port()));
  }

  @Test
  public void testExecuteRequest() throws CommunicationException {
    JavaExecutionEngine executionEngine = new CountingJavaExecutionEngine();
    int currentCounter = executionEngine.getExecutionCounter();
    JavaKernelContext context = new JavaKernelContext(this.context.kernelCommunicationHandler,
        this.context.connectionProfile, executionEngine);

    context.kernelCommunicationHandler.send(shellChannel.channel2,
        createExecuteRequestMessage(" a = 10; "));

    Message<? extends Content.Reply> reply = receiveReply(shellChannel.channel2);
    assertThat(reply.content, instanceOf(ExecuteReply.class));
    ExecuteReply executeReply = (ExecuteReply) reply.content;
    // Make sure the counter has not changed.
    assertThat(executeReply.execution_count, is(currentCounter));
  }

  static class TwoHeadedChannel {

    FakeCommunicationChannel channel1;
    FakeCommunicationChannel channel2;

    public TwoHeadedChannel() {
      channel1 = new FakeCommunicationChannel();
      channel2 = new FakeCommunicationChannel();
      channel1.toReceive = channel2.sent;
      channel2.toReceive = channel1.sent;
    }
  }
}
