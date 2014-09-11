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

/**
 * This class represent a kernel connection profile which is initially created by the ipython and
 * passed to kernel in JSON format. Kernel uses this profile to start up the required sockets on the
 * specified ports.
 */
public class ConnectionProfile {
  public static final Integer DEFAULT_PORT = 33033;
  public static final ConnectionProfile DEFAULT_PROFILE = new ConnectionProfile("127.0.0.1",
      "tcp",
      DEFAULT_PORT,
      DEFAULT_PORT + 1,
      DEFAULT_PORT + 2,
      DEFAULT_PORT + 3,
      DEFAULT_PORT + 4,
      java.util.UUID.randomUUID().toString(),
      null);

  private String ip, transport;
  private Integer stdin_port, control_port, hb_port, shell_port, iopub_port;
  private String key;
  private String signature_scheme;

  public ConnectionProfile(String ip,
      String transport,
      Integer stdinPort,
      Integer controlPort,
      Integer heartbeatPort,
      Integer shellPort,
      Integer iopubPort,
      String key,
      String signatureScheme) {
    this.ip = ip;
    this.transport = transport;
    this.stdin_port = stdinPort;
    this.control_port = controlPort;
    this.hb_port = heartbeatPort;
    this.shell_port = shellPort;
    this.iopub_port = iopubPort;
    this.key = key;
    this.signature_scheme = signatureScheme;
  }

  /**
   * @return the ip
   */
  public String getIp() {
    return ip;
  }

  /**
   * @return the transport
   */
  public String getTransport() {
    return transport;
  }

  /**
   * @return the stdin_port
   */
  public Integer getStdin_port() {
    return stdin_port;
  }

  /**
   * @return the control_port
   */
  public Integer getControl_port() {
    return control_port;
  }

  /**
   * @return the hb_port
   */
  public Integer getHb_port() {
    return hb_port;
  }

  /**
   * @return the shell_port
   */
  public Integer getShell_port() {
    return shell_port;
  }

  /**
   * @return the iopub_port
   */
  public Integer getIopub_port() {
    return iopub_port;
  }

  /**
   * @return the key
   */
  public String getKey() {
    return key;
  }

  /**
   * @return the signature_scheme
   */
  public String getSignature_scheme() {
    return signature_scheme;
  }
}
