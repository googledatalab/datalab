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

package com.google.cloud.ijava.runner;

import java.io.InputStream;
import java.io.PrintStream;

/**
 * A thread which is responsible for running a {@link RunnableCode}. This class is instantiated with
 * three streams for input, output and error and a code to run. Upon running this thread the default
 * system's input, output and error streams will be changed to the provided ones.
 */
public class CodeRunner extends Thread {
  private RunnableCode code;
  private InputStream in;
  private PrintStream out;
  private PrintStream err;

  public CodeRunner(InputStream in, PrintStream out, PrintStream err, RunnableCode code) {
    this.in = in;
    this.out = out;
    this.err = err;
    this.code = code;
  }

  @Override
  public final void run() {
    InputStream currentIn = System.in;
    PrintStream currentOut = System.out;
    PrintStream currentErr = System.err;

    System.setIn(in);
    System.setOut(out);
    System.setErr(err);
    try {
      try {
        code.___init___();
      } catch (ClassCastException e) {
        err.println(e.getMessage());
        err.println();
        err.println("If this exception is unexpected, it is likely that you have altered a "
            + "previously defined class and have references to the old one.");
        return;
      }

      try {
        code.___run___();
      } catch (IllegalAccessError e) {
        err.println(e.getMessage());
        err.println();
        err.println("It is likely that you are trying to access a non-public element.");
        return;
      } catch (Throwable e) {
        e.printStackTrace(err);
        return;
      }

      try {
        code.___done___();
      } catch (ClassCastException e) {
        err.println(e.getMessage());
        err.println();
        err.println("If this exception is unexpected, it is likely that you have altered a "
            + "previously defined class and have references to the old one.");
        return;
      }
    } finally {
      System.setIn(currentIn);
      System.setOut(currentOut);
      System.setErr(currentErr);
    }
  }
}
