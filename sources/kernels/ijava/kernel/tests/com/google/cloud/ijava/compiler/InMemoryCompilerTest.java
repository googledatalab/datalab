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
