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

import javax.tools.DiagnosticCollector;
import javax.tools.JavaFileObject;

/**
 * Tests for {@link InMemoryCompiler}.
 */
@RunWith(JUnit4.class)
public class InMemoryCompilerTest extends TestCase {
  private InMemoryCompiler compiler;

  @Override
  @Before
  public void setUp() {
    compiler = new InMemoryCompiler();
  }

  @Test
  public void testCompileNoDiag() {
    DiagnosticCollector<JavaFileObject> diagnosticCollector =
        compiler.compile("A.java", "public class A {}");
    assertEquals(0, diagnosticCollector.getDiagnostics().size());
  }

  @Test
  public void testPushClassLoader() throws ClassNotFoundException {
    compiler.compile("A.java", "public class A {}");
    assertNotNull(compiler.pushClassLoader().loadClass("A"));
  }

  @Test
  public void testTwoPushClassLoader() throws ClassNotFoundException {
    compiler.compile("A.java", "public class A {}");
    assertNotNull(compiler.pushClassLoader().loadClass("A"));
    compiler.compile("B.java", "public class B {}");
    assertNotNull(compiler.pushClassLoader().loadClass("B"));
  }

  @Test
  public void testClassLoaderSameClass() throws ClassNotFoundException {
    compiler.compile("A.java", "public class A {}");
    Class<?> a1 = compiler.pushClassLoader().loadClass("A");
    compiler.compile("A.java", "public class A { }");
    Class<?> a2 = compiler.pushClassLoader().loadClass("A");
    assertSame(a1, a2);
  }

  @Test
  public void testClassLoaderChangeClass() throws ClassNotFoundException {
    compiler.compile("A.java", "public class A {}");
    Class<?> a1 = compiler.pushClassLoader().loadClass("A");
    compiler.compile("A.java", "public class A { int x = 10; }");
    Class<?> a2 = compiler.pushClassLoader().loadClass("A");
    assertNotSame(a1, a2);
  }
}
