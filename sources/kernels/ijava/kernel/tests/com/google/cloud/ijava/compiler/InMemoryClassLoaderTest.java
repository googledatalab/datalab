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

import junit.framework.TestCase;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Tests for {@link InMemoryClassLoader}.
 */
@RunWith(JUnit4.class)
public class InMemoryClassLoaderTest extends TestCase {

  private InMemoryClassLoader inMemoryClassLoader;

  @Override
  @Before
  public void setUp() throws IOException {
    Map<String, byte[]> classBytes = new HashMap<String, byte[]>();

    classBytes.put("pkg.A",
        getBytesFromInputStream(getClass().getResourceAsStream("/pkg/A.class")));
    inMemoryClassLoader =
        new InMemoryClassLoader(classBytes, InMemoryClassLoaderTest.class.getClassLoader());
  }

  @Test
  public void testLoadClass() throws ClassNotFoundException {
    assertNotNull(inMemoryClassLoader.loadClass("pkg.A"));
  }

  @Test
  public void testLoadClassNotInMap() throws ClassNotFoundException {
    assertNotNull(inMemoryClassLoader.loadClass("java.util.Map"));
  }

  // Make sure if the same class is passed to a chained class loader is present in its parent, then
  // we always load the class from parent.
  @Test
  public void testLoadSameClassFromParent() throws ClassNotFoundException, IOException {
    Map<String, byte[]> classBytes = new HashMap<String, byte[]>();

    classBytes.put("pkg.A",
        getBytesFromInputStream(getClass().getResourceAsStream("/pkg/A.class")));
    classBytes.put("pkg.B",
        getBytesFromInputStream(getClass().getResourceAsStream("/pkg/B.class")));
    InMemoryClassLoader inMemoryClassLoader2 =
        new InMemoryClassLoader(classBytes, inMemoryClassLoader);

    Class<?> klass1 = inMemoryClassLoader.loadClass("pkg.A");
    Class<?> klass2 = inMemoryClassLoader2.loadClass("pkg.A");
    assertSame(klass1.getClassLoader(), klass2.getClassLoader());

    // Make sure the classloader for 'pkg.B' is different from the one for 'pkg.A'
    Class<?> klassB = inMemoryClassLoader2.loadClass("pkg.B");
    assertNotSame(klass2.getClassLoader(), klassB.getClassLoader());
  }

  @Test(expected = ClassNotFoundException.class)
  public void testLoadClassNotFound() throws ClassNotFoundException {
    inMemoryClassLoader.loadClass("A");
  }

  private static byte[] getBytesFromInputStream(InputStream is) throws IOException {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    int nRead;
    byte[] data = new byte[128];

    while ((nRead = is.read(data, 0, data.length)) != -1) {
      buffer.write(data, 0, nRead);
    }

    buffer.flush();
    return buffer.toByteArray();
  }
}
