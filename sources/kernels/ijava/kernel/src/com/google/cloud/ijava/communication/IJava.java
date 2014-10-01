package com.google.cloud.ijava.communication;

import com.google.cloud.ijava.communication.Message.ExecutionState;
import com.google.cloud.ijava.communication.zmq.ZMQCommunicationChannel;
import com.google.cloud.ijava.runner.FragmentCodeRunner;

import org.zeromq.ZMQ;
import org.zeromq.ZMQ.Socket;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.logging.Logger;

/**
 * A Java Kernel backend for IPython based on ZMQ library for messaging.
 */
public class IJava implements Runnable {
  private static Logger LOGGER = Logger.getLogger(IJava.class.getName());

  private JavaKernelContext kernelContext;
  private ZMQ.Context zmqContext;

  private CommunicationChannel publish, shell, control, heartbeat;

  public IJava(String[] args) throws InvalidKeyException, NoSuchAlgorithmException, IOException {
    if (args.length != 1) {
      System.err.println("Please provide the connection profile file path.");
      System.exit(-1);
    }
    File connectionprofileFile = new File(args[0]);
    if (!connectionprofileFile.exists()) {
      System.err.println("Connection profile file does not exist.");
      System.exit(-1);
    }
    LOGGER.fine("Running IJava with profile: " + args[0]);
    ConnectionProfile connectionProfile = KernelJsonConverter.GSON.fromJson(
        new String(Files.readAllBytes(connectionprofileFile.toPath())), ConnectionProfile.class);
    LOGGER.fine("Connection Profile: " + connectionProfile);

    initZMQChannels(connectionProfile);

    kernelContext = new JavaKernelContext(new KernelCommunicationHandler(publish, shell,
        connectionProfile, System.getProperty("user.name")), connectionProfile,
        new FragmentCodeRunner());
  }

  /**
   * Starts ZMQ channels and will spawn a thread for heartbeat channel.
   */
  private void initZMQChannels(ConnectionProfile connectionProfile) {
    zmqContext = ZMQ.context(1);
    Socket publishSocket = zmqContext.socket(ZMQ.PUB);
    publishSocket.bind(toURI(connectionProfile.getTransport(), connectionProfile.getIp(),
        connectionProfile.getIopub_port()));
    publish = new ZMQCommunicationChannel(publishSocket);

    Socket shellSocket = zmqContext.socket(ZMQ.ROUTER);
    shellSocket.bind(toURI(connectionProfile.getTransport(), connectionProfile.getIp(),
        connectionProfile.getShell_port()));
    shell = new ZMQCommunicationChannel(shellSocket);

    Socket controlSocket = zmqContext.socket(ZMQ.ROUTER);
    controlSocket.bind(toURI(connectionProfile.getTransport(), connectionProfile.getIp(),
        connectionProfile.getControl_port()));
    control = new ZMQCommunicationChannel(controlSocket);

    final Socket heartbeatSocket = zmqContext.socket(ZMQ.REP);
    heartbeatSocket.bind(toURI(connectionProfile.getTransport(), connectionProfile.getIp(),
        connectionProfile.getHb_port()));
    heartbeat = new ZMQCommunicationChannel(heartbeatSocket);
    Thread heartBeatThread = new Thread() {
      @Override
      public void run() {
        ZMQ.proxy(heartbeatSocket, heartbeatSocket, null);
      }
    };
    heartBeatThread.setName("HeartBeat");
    heartBeatThread.start();
  }

  @Override
  public void run() {
    try {
      LOGGER.fine("Starting kernel...");
      kernelContext.kernelCommunicationHandler.sendStatus(ExecutionState.starting);
      new Thread(new ControlRequestHandler(control, kernelContext), "Control").start();
      new Thread(new ShellRequestHandler(shell, kernelContext), "Shell").start();
      LOGGER.fine("Java Kernel Started!");
    } catch (CommunicationException e) {
      LOGGER.severe(e.getMessage());
    }
  }

  private static String toURI(String transport, String ip, Integer port) {
    return String.format("%s://%s:%d", transport, ip, port);
  }

  private void terminate() throws CommunicationException {
    publish.close();
    shell.close();
    control.close();
    heartbeat.close();
    zmqContext.close();
    zmqContext.term();
  }

  public static void main(final String[] args) {
    try {
      final IJava ijava = new IJava(args);
      Runtime.getRuntime().addShutdownHook(new Thread() {
        @Override
        public void run() {
          LOGGER.fine("Terminating IJava...");
          try {
            ijava.terminate();
          } catch (Throwable e) {
            LOGGER.severe(e.getMessage());
          }
        }
      });
      Thread ijavaThread = new Thread(ijava, "IJava");
      ijavaThread.start();
      ijavaThread.join();
    } catch (InvalidKeyException | InterruptedException | NoSuchAlgorithmException
        | IOException e) {
      LOGGER.severe(e.getMessage());
    }
  }
}
