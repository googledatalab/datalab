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

import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * An implementation for Hash-based Message Authentication Code. See this <a
 * href="http://en.wikipedia.org/wiki/Hash-based_message_authentication_code">link</a> for more
 * information. Using this class one can create a hash representation of some data based on the
 * provided algorithm. The hash can then be used to verify that the messages are coming from the
 * right source.
 */
public abstract class HMAC {

  private static final String HMACSHA256 = "hmacsha256";

  private HMAC() {}

  /**
   * @return a hex representation of hash of args
   */
  public abstract String hash(String... args);

  /**
   * Creates and returns an HMAC given the input key and algorithm. If no key is specified this
   * function will return and HMAC which always return an empty string for any input. If no
   * algorithm is specified, this function will use {@code hmacsha256} algorithm as default.
   * Algorithms are specified by {@link javax.crypto.Mac}.
   *
   * @return an HMAC encoder given the input key and algorithm
   */
  public static HMAC create(String key, String algorithm) throws NoSuchAlgorithmException,
      InvalidKeyException {
    if (key.isEmpty()) {
      return new EmptyHMAC();
    } else {
      return new JavaCryptoMAC(key, algorithm);
    }
  }

  /**
   * This extension of HMAC will create a hash string from input string arguments using the
   * specified algorithm or "HMACSHA-256" if no algorithm is specified. This extension will ignore
   * any input null arguments and do not account them in the final hash.
   */
  private static final class JavaCryptoMAC extends HMAC {
    protected Mac mac;

    private JavaCryptoMAC(String key, String algorithm) throws NoSuchAlgorithmException,
        InvalidKeyException {
      super();
      if (algorithm != null && !algorithm.isEmpty()) {
        algorithm = algorithm.replace("-", "");
      } else {
        algorithm = HMACSHA256;
      }
      mac = Mac.getInstance(algorithm);
      mac.init(new SecretKeySpec(key.getBytes(), algorithm));
    }

    @Override
    public String hash(String... args) {
      // Guarding against concurrent calls to this method because Mac is stateful.
      synchronized (mac) {
        for (String s : args) {
          if (s != null) {
            mac.update(s.getBytes());
          }
        }
        StringBuilder sb = new StringBuilder();
        // Create a hex representation of the hash
        for (byte b : mac.doFinal()) {
          sb.append(String.format("%02X", b));
        }
        return sb.toString();
      }
    }
  }

  private static final class EmptyHMAC extends HMAC {
    @Override
    public String hash(String... args) {
      return "";
    }
  }

}
