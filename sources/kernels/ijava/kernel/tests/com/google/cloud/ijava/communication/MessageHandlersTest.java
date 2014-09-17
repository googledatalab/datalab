package com.google.cloud.ijava.communication;

import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.instanceOf;
import static org.hamcrest.Matchers.is;
import static org.junit.Assert.assertThat;

import com.google.cloud.ijava.communication.Message.ConnectReply;
import com.google.cloud.ijava.communication.Message.Content;
import com.google.cloud.ijava.communication.Message.ExecuteReply;
import com.google.cloud.ijava.communication.Message.ExecutionStatus;
import com.google.cloud.ijava.communication.Message.KernelInfoReply;
import com.google.cloud.ijava.communication.Message.ShutdownReply;
import com.google.cloud.ijava.communication.Message.Status;
import com.google.cloud.ijava.communication.Message.Stream;
import com.google.cloud.ijava.runner.JavaExecutionEngine;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.UUID;

/**
 * Tests for {@link MessageHandlers} and {@link ShellRequestHandler}.
 */
@RunWith(JUnit4.class)
public class MessageHandlersTest extends MessageHandlersTestBase {

  private FakeCommunicationChannel publishChannel, shellChannel;
  private JavaKernelContext context;

  @Before
  public void setUp() throws InvalidKeyException, NoSuchAlgorithmException {
    shellChannel = new FakeCommunicationChannel(true);
    publishChannel = new FakeCommunicationChannel(true);
    ConnectionProfile connectionProfile = new ConnectionProfile("", "", 1, 2, 3, 4, 5, "", null);
    context = new JavaKernelContext(new KernelCommunicationHandler(publishChannel, shellChannel,
        connectionProfile, "testuser"), connectionProfile, new NoopJavaExecutionEngine());
  }

  @Test
  public void testKernelInfoRequest() throws CommunicationException {
    MessageHandlers.KernelInfoHandler handler = new MessageHandlers.KernelInfoHandler();
    Message.Header header = new Message.Header(UUID.randomUUID(), "testuser", UUID.randomUUID(),
        Message.MessageType.kernel_info_request);
    handler.handle(new Message<Message.KernelInfoRequest>(Arrays.asList("id1"), header,
        new Message.Header(), Message.emptyMetadata(), new Message.KernelInfoRequest()),
        shellChannel, context);
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
        context);
    Message<? extends Content.Reply> reply = receiveReply(shellChannel);
    assertThat(reply.content, instanceOf(ConnectReply.class));
    ConnectReply connectReply = (ConnectReply) reply.content;
    assertThat(connectReply.hb_port, is(context.connectionProfile.getHb_port()));
    assertThat(connectReply.iopub_port, is(context.connectionProfile.getIopub_port()));
    assertThat(connectReply.shell_port, is(context.connectionProfile.getShell_port()));
    assertThat(connectReply.stdin_port, is(context.connectionProfile.getStdin_port()));
  }

  @Test
  public void testShutdownRequest() throws CommunicationException {
    MessageHandlers.ShutdownHandler handler = new MessageHandlers.ShutdownHandler(false);
    Message.Header header = new Message.Header(UUID.randomUUID(), "testuser", UUID.randomUUID(),
        Message.MessageType.shutdown_request);
    handler.handle(new Message<Message.ShutdownRequest>(Arrays.asList("id1"), header,
        new Message.Header(), Message.emptyMetadata(), new Message.ShutdownRequest()), shellChannel,
        context);
    Message<? extends Content.Reply> reply = receiveReply(shellChannel);
    assertThat(reply.content, instanceOf(ShutdownReply.class));
  }

  @Test
  public void testExecuteEmptyInput() throws CommunicationException {
    JavaExecutionEngine executionEngine = new CountingJavaExecutionEngine();
    int currentCounter = executionEngine.getExecutionCounter();
    JavaKernelContext context = new JavaKernelContext(this.context.kernelCommunicationHandler,
        this.context.connectionProfile, executionEngine);

    new MessageHandlers.ExecuteHandler().handle(createExecuteRequestMessage("    "), shellChannel,
        context);

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
    JavaKernelContext context = new JavaKernelContext(this.context.kernelCommunicationHandler,
        this.context.connectionProfile, executionEngine);

    new MessageHandlers.ExecuteHandler().handle(createExecuteRequestMessage("int a = 0;"),
        shellChannel, context);

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
    JavaKernelContext context = new JavaKernelContext(this.context.kernelCommunicationHandler,
        this.context.connectionProfile, executionEngine);

    new MessageHandlers.ExecuteHandler().handle(createExecuteRequestMessage("int a = 0;"),
        shellChannel, context);

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
    JavaKernelContext context = new JavaKernelContext(this.context.kernelCommunicationHandler,
        this.context.connectionProfile, executionEngine);

    new MessageHandlers.ExecuteHandler().handle(createExecuteRequestMessage("int a = 0;"),
        shellChannel, context);

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
    JavaKernelContext context = new JavaKernelContext(this.context.kernelCommunicationHandler,
        this.context.connectionProfile, executionEngine);

    new MessageHandlers.ExecuteHandler().handle(createExecuteRequestMessage("err!"), shellChannel,
        context);

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
}
