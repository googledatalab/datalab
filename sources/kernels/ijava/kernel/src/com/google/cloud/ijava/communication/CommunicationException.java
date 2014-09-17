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
 * This class represents any exception that might happen during communication.
 */
public class CommunicationException extends Exception {

  public CommunicationException() {
    super();
  }

  public CommunicationException(String message, Throwable cause, boolean enableSuppression,
      boolean writableStackTrace) {
    super(message, cause, enableSuppression, writableStackTrace);
  }

  public CommunicationException(String message, Throwable cause) {
    super(message, cause);
  }

  public CommunicationException(String message) {
    super(message);
  }

  public CommunicationException(Throwable cause) {
    super(cause);
  }
}
