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

package com.google.cloud.ijava.compiler;

/**
 * This class is a simple representation of an import statement in Java. It consists of a qualified
 * name (which could finish with '.*') and a flag which determines if the import is static or not.
 */
public class Import {
  public boolean isStatic = false;

  /**
   * A qualified name for the import statement such as 'java.util.List' or 'java.util.*'.
   */
  public String qualifiedImportName = "";

  public Import(boolean isStatic, String qualid) {
    this.isStatic = isStatic;
    this.qualifiedImportName = qualid;
  }
}
