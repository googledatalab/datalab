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

import java.util.Map;

/**
 * An abstraction over a code that must be run.
 */
public abstract class RunnableCode {

  /**
   * Map from field names to their values that must be used to initialize the fields which are
   * present in the code.
   */
  public Map<String, Object> ___values___;

  public RunnableCode(Map<String, Object> ___values___) {
    this.___values___ = ___values___;
  }

  /**
   * This method will contain the code that should be run.
   */
  protected abstract void ___run___() throws Throwable;

  /**
   * The initialization code that must be run before {@link #___run___()}.
   */
  protected abstract void ___init___();

  /**
   * The finalization code that must be run after {@link #___run___()}.
   */
  protected abstract void ___done___();
}
