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
import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Preconditions;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
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
        JavaKernelContext context) throws CommunicationException {
      Preconditions.checkArgument(message.header.msg_type == MessageType.kernel_info_request);
      String[] javaVersion = System.getProperty("java.version").split("\\.");
      context.kernelCommunicationHandler.send(socket, message.reply(
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
        JavaKernelContext context) throws CommunicationException {
      Preconditions.checkArgument(message.header.msg_type == MessageType.connect_request);
      context.kernelCommunicationHandler.send(socket, message.reply(
          MessageType.connect_reply, new ConnectReply(context.connectionProfile.getShell_port(),
              context.connectionProfile.getIopub_port(), context.connectionProfile.getStdin_port(),
              context.connectionProfile.getHb_port()), Message.emptyMetadata()));
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
        JavaKernelContext context) throws CommunicationException {
      Preconditions.checkArgument(message.header.msg_type == MessageType.shutdown_request);
      context.kernelCommunicationHandler.send(socket, message.reply(MessageType.shutdown_reply,
          new ShutdownReply(message.content.restart), Message.emptyMetadata()));
      LOGGER.fine("Shutting down.");
      // The shutdown hook that we setup when we run the kernel will do the required things before
      // shutdown.
      if (doShutdown) {
        System.exit(0);
      }
    }
  }

  /**
   * This class handles the {@link Message.ExecuteRequest} message. See <a
   * href="http://ipython.org/ipython-doc/2/development/messaging.html#execute">Execute in
   * IPython</a> for more information.
   */
  static class ExecuteHandler extends MessageHandler<Message<ExecuteRequest>> {

    private static final int EXECUTION_THREAD_COUNT = 4;

    @Override
    public void handle(final Message<ExecuteRequest> message, CommunicationChannel socket,
        final JavaKernelContext context) throws CommunicationException {
      Preconditions.checkArgument(message.header.msg_type == MessageType.execute_request);

      LOGGER.fine("executionCounter: " + context.javaExecutionEngine.getExecutionCounter());
      final String code = message.content.code.trim();

      // On an empty input just send an OK message to the client and do not increment the execution
      // counter:
      if (code.isEmpty()) {
        context.kernelCommunicationHandler.sendOk(message,
            context.javaExecutionEngine.getExecutionCounter());
        return;
      }

      context.kernelCommunicationHandler.sendStatus(ExecutionState.busy);
      try {
        // Setting up the streams for error and output:
        // A pipe stream is setup for each of these streams so that we can read what is written
        // into them.

        // Output stream:
        final PipedOutputStream outPipedOutputStream = new PipedOutputStream();
        final InputStream outPipedInputStream = new PipedInputStream(outPipedOutputStream);
        final PrintStream outPrintStream = new PrintStream(outPipedOutputStream);

        // Error stream:
        final PipedOutputStream errPipedOutputStream = new PipedOutputStream();
        final InputStream errPipedInputStream = new PipedInputStream(errPipedOutputStream);
        final PrintStream errPrintStream = new PrintStream(errPipedOutputStream);

        ExecutorService executorService = Executors.newFixedThreadPool(EXECUTION_THREAD_COUNT);
        CompletionService<Boolean> ecs = new ExecutorCompletionService<Boolean>(executorService);

        // Submitting two stream publishers for error and output streams:
        executorService.submit(new InputStreamPublisher(Message.Stream.StreamName.stdout,
            outPipedInputStream, message, context));
        executorService.submit(new InputStreamPublisher(Message.Stream.StreamName.stderr,
            errPipedInputStream, message, context));

        // Submitting a task for running the input code.
        ecs.submit(new Callable<Boolean>() {
          @Override
          public Boolean call() throws Exception {
            // TODO(amshali): Figure out what needs to be used instead of System.in for reading from
            // input:
            Boolean returnValue = context.javaExecutionEngine.execute(code, System.in,
                outPrintStream, errPrintStream);
            outPrintStream.close();
            errPrintStream.close();
            return returnValue;
          }
        });

        // There is only one task submitted to completion service which is the code to run. Take the
        // result of that task. This will be a blocking call and we have set a 20 minute timeout on
        // it. TODO(amshali): consider reading the timeout values from run settings.
        Boolean exeStatus = ecs.take().get();
        executorService.shutdown();
        // Waiting for at most 60 seconds for streams to be published.
        executorService.awaitTermination(1, TimeUnit.MINUTES);

        outPipedInputStream.close();
        errPipedInputStream.close();

        if (exeStatus) {
          context.kernelCommunicationHandler.sendOk(message,
              context.javaExecutionEngine.getExecutionCounter());
        } else {
          // TODO(amshali): consider a better error message for this communication:
          context.kernelCommunicationHandler.sendError(message,
              context.javaExecutionEngine.getExecutionCounter(), "");
        }
      } catch (Exception e) {
        // Get the stack trace for logging purposes:
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        PrintStream eps = new PrintStream(bos);
        e.printStackTrace(eps);
        eps.close();
        LOGGER.fine(bos.toString());
      } finally {
        context.kernelCommunicationHandler.sendStatus(ExecutionState.idle);
        context.javaExecutionEngine.incExecutionCounter();
      }
    }
  }

  /**
   * This class is responsible for reading from an input stream and publishes the read data as
   * stream messages. See <a
   * href="http://ipython.org/ipython-doc/2/development/messaging.html#streams-stdout-stderr-etc">Streams
   * in IPython</a> for more information.
   */
  static class InputStreamPublisher implements Runnable {

    static final int READ_INTERVALS_MILLIS = 10;

    Message.Stream.StreamName streamName;
    InputStream inputStream;
    Message<?> message;
    JavaKernelContext context;

    public InputStreamPublisher(StreamName streamName, InputStream inputStream, Message<?> message,
        JavaKernelContext context) {
      this.streamName = streamName;
      this.inputStream = inputStream;
      this.message = message;
      this.context = context;
    }

    @Override
    public void run() {
      int s = 0;
      byte[] bs = new byte[4096];
      while (true) {
        try {
          // Wait for some time before next read. This is designed to reduce the number of message
          // that is sent to the client. Note that we have avoided sending data based on the number
          // of read characters, because we never know how much more data we have in the input.
          Thread.sleep(READ_INTERVALS_MILLIS);
        } catch (InterruptedException e) {
          LOGGER.fine(e.getMessage());
        }
        try {
          s = inputStream.read(bs);
          // When the input stream closes it will have a -1 value read from it which marks the end
          // of stream.
          if (s == -1) {
            break;
          }
          // Publish the data in response to the input message:
          context.kernelCommunicationHandler.publish(message.publish(MessageType.stream,
              new Message.Stream(streamName, new String(bs, 0, s, StandardCharsets.UTF_8)),
              Message.emptyMetadata()));
        } catch (IOException | CommunicationException e) {
          LOGGER.fine(e.getMessage());
        }
      }
    }
  }
}
