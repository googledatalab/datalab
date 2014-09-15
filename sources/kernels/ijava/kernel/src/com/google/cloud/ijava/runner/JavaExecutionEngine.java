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

public interface JavaExecutionEngine {

  /**
   * Execution counter refers to the Nth input that is executed by IPython Java kernel. This method
   * will be called by the kernel after an input is executed.
   */
  public void incExecutionCounter();

  /**
   * @return the current execution counter
   */
  public int getExecutionCounter();

  /**
   * Execute the input code.
   *
   * @return true on a successful compile and run. Otherwise returns false when there is compilation
   *         errors or a runtime exception happened during the run of the code.
   */
  public boolean execute(String code, InputStream in, PrintStream out, PrintStream err);
}
