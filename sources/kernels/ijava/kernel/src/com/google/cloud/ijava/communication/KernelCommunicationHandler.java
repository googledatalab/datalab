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

import com.google.cloud.ijava.communication.Message.CompleteRequest;
import com.google.cloud.ijava.communication.Message.ConnectRequest;
import com.google.cloud.ijava.communication.Message.Content;
import com.google.cloud.ijava.communication.Message.ExecuteErrorReply;
import com.google.cloud.ijava.communication.Message.ExecuteRequest;
import com.google.cloud.ijava.communication.Message.ExecutionState;
import com.google.cloud.ijava.communication.Message.Header;
import com.google.cloud.ijava.communication.Message.InputReply;
import com.google.cloud.ijava.communication.Message.KernelInfoRequest;
import com.google.cloud.ijava.communication.Message.MessageType;
import com.google.cloud.ijava.communication.Message.ObjectInfoRequest;
import com.google.cloud.ijava.communication.Message.ShutdownRequest;
import com.google.cloud.ijava.communication.Message.Status;
import com.google.common.annotations.VisibleForTesting;

import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Logger;

/**
 * A class for handling kernel communications such as sending and receiving messages via different
 * {@link CommunicationChannel}s. The implementation is based on the protocol specified by IPython
 * <a href="http://ipython.org/ipython-doc/2/development/messaging.html">messaging</a> document.
 */
public class KernelCommunicationHandler {
  private static final String DEFAULT_USER = "java_kernel";
  private static Logger LOGGER = Logger.getLogger(KernelCommunicationHandler.class.getName());
  @VisibleForTesting
  final static String DELIMITER = "<IDS|MSG>";

  private HMAC hmac;

  private CommunicationChannel publishChannel;
  private CommunicationChannel shellChannel;

  /**
   * The current user who has launched the kernel.
   */
  private String username;

  /**
   *
   * @param username the current user who has launched the kernel. If none is specified
   *        {@value #DEFAULT_USER} will be used.
   */
  public KernelCommunicationHandler(CommunicationChannel publishChannel,
      CommunicationChannel shellChannel, ConnectionProfile profile, String username)
      throws InvalidKeyException, NoSuchAlgorithmException {
    this.publishChannel = publishChannel;
    this.shellChannel = shellChannel;
    if (username == null || username.isEmpty()) {
      this.username = DEFAULT_USER;
    } else {
      this.username = username;
    }
    this.hmac = HMAC.create(profile.getKey(), profile.getSignature_scheme());
  }

  /**
   * Sends a message over the specified channel.
   */
  public <T extends Message.Content> void send(CommunicationChannel channel, Message<T> message)
      throws CommunicationException {
    LOGGER.fine("Sending: " + KernelJsonConverter.PRETTY_GSON.toJson(message));
    String headerJSON = KernelJsonConverter.GSON.toJson(message.header);
    String parentHeaderJSON = KernelJsonConverter.GSON.toJson(message.parent_header);
    String metadataJSON = KernelJsonConverter.GSON.toJson(message.metadata);
    String contentJSON = KernelJsonConverter.GSON.toJson(message.content);
    synchronized (channel) {
      for (String id : message.identities) {
        channel.sendMore(id);
      }
      channel.sendMore(DELIMITER);
      channel.sendMore(
          hmac.hash(headerJSON, parentHeaderJSON, metadataJSON, contentJSON).toLowerCase());
      channel.sendMore(headerJSON);
      channel.sendMore(parentHeaderJSON);
      channel.sendMore(metadataJSON);
      channel.send(contentJSON);
    }
  }

  /**
   * Publishes the specified state on the publish channel.
   */
  public void sendStatus(ExecutionState state) throws CommunicationException {
    send(publishChannel, new Message<Message.Content>(Arrays.asList("Status"),
        new Header(UUID.randomUUID(), username, UUID.randomUUID(), MessageType.status),
        new Header(), Message.emptyMetadata(), new Status(state)));
  }

  /**
   * Receives a message from the specified channel and returns it. Returns null when the hash
   * signatures do not match.
   */
  public Message<? extends Content.Request> receive(CommunicationChannel channel)
      throws CommunicationException {
    List<String> identities = new ArrayList<>();
    String signatureJSON;
    String headerJSON;
    String parentHeaderJSON;
    String metadataJSON;
    String contentJSON;
    synchronized (channel) {
      for (String data = channel.recvStr(); !data.equals(DELIMITER); data = channel.recvStr()) {
        identities.add(data);
      }
      signatureJSON = channel.recvStr();
      headerJSON = channel.recvStr();
      parentHeaderJSON = channel.recvStr();
      metadataJSON = channel.recvStr();
      contentJSON = channel.recvStr();
    }
    if (!signatureJSON.toLowerCase().equals(
        hmac.hash(headerJSON, parentHeaderJSON, metadataJSON, contentJSON).toLowerCase())) {
      LOGGER.severe("Invalid HMAC signature");
      return null;
    }
    Header header = KernelJsonConverter.GSON.fromJson(headerJSON, Header.class);
    Header parentHeader = KernelJsonConverter.GSON.fromJson(parentHeaderJSON, Header.class);
    Map<String, String> metadata =
        KernelJsonConverter.GSON.fromJson(metadataJSON, KernelJsonConverter.METADATA_TYPE);
    Content.Request content = null;
    switch (header.msg_type) {
      case execute_request:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, ExecuteRequest.class);
        break;
      case complete_request:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, CompleteRequest.class);
        break;
      case kernel_info_request:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, KernelInfoRequest.class);
        break;
      case object_info_request:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, ObjectInfoRequest.class);
        break;
      case connect_request:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, ConnectRequest.class);
        break;
      case shutdown_request:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, ShutdownRequest.class);
        break;
      case input_reply:
        content = KernelJsonConverter.GSON.fromJson(contentJSON, InputReply.class);
        break;
      default:
        content = null;
        break;
    }
    Message<Content.Request> message =
        new Message<Message.Content.Request>(identities, header, parentHeader, metadata, content);
    return message;
  }

  /**
   * Sends {@link Message.ExecuteOkReply} to the shell channel.
   */
  public void sendOk(Message<? extends Content> message, Integer executionCount)
      throws CommunicationException {
    List<String> userVariables = new ArrayList<>();
    Map<String, String> userExpressions = new HashMap<>();
    send(shellChannel, message.reply(MessageType.execute_reply, new Message.ExecuteOkReply(
        executionCount, new ArrayList<Map<String, String>>(), userVariables, userExpressions),
        new HashMap<String, String>()));
  }

  /**
   * Sends an error message in response to a received message to shell and publish channels.
   */
  public void sendError(Message<? extends Content> message, int executionCount, String error)
      throws CommunicationException {
    sendError(message, new Message.Error(executionCount, "", "", error.split("\n")));
  }

  private void sendError(Message<? extends Content> message, Message.Error err)
      throws CommunicationException {
    publish(message.publish(MessageType.error, err, Message.emptyMetadata()));
    send(shellChannel, message.reply(MessageType.execute_reply,
        new ExecuteErrorReply(err.execution_count, err.ename, err.evalue, err.traceback),
        Message.emptyMetadata()));
  }

  /**
   * Sends a message to the publish channel.
   */
  public <T extends Message.Content.Reply> void publish(Message<T> message)
      throws CommunicationException {
    send(publishChannel, message);
  }
}
