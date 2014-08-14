package com.google.cloud.ijava.compiler;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.Assert.assertThat;

import junit.framework.TestCase;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.HashSet;
import java.util.Set;

import javax.tools.JavaFileObject;
import javax.tools.JavaFileObject.Kind;
import javax.tools.StandardLocation;
import javax.tools.ToolProvider;

/**
 * Tests for {@link InMemoryClassFileManager}.
 */
@RunWith(JUnit4.class)
public class InMemoryClassFileManagerTest extends TestCase {

  private static final String CLASS_BYTECODE = "class bytecode";
  private InMemoryClassFileManager fileManager;

  @Override
  @Before
  public void setUp() {
    fileManager = new InMemoryClassFileManager(
        ToolProvider.getSystemJavaCompiler().getStandardFileManager(null, null, null));
  }

  @Test
  public void testGetJavaFileForOutput() throws IOException {
    JavaFileObject javaFileObject =
        fileManager.getJavaFileForOutput(StandardLocation.CLASS_OUTPUT, "pkg.A", Kind.CLASS, null);
    javaFileObject.openOutputStream().write(CLASS_BYTECODE.getBytes());
    JavaFileObject retreivedFile =
        fileManager.getJavaFileForInput(StandardLocation.CLASS_OUTPUT, "pkg.A", Kind.CLASS);
    assertEquals(retreivedFile, javaFileObject);
    assertEquals(CLASS_BYTECODE, getStringFromInputStream(retreivedFile.openInputStream()));
  }

  @Test
  public void testList() throws IOException {
    JavaFileObject javaFileObjectA =
        fileManager.getJavaFileForOutput(StandardLocation.CLASS_OUTPUT, "pkg.A", Kind.CLASS, null);
    JavaFileObject javaFileObjectB =
        fileManager.getJavaFileForOutput(StandardLocation.CLASS_OUTPUT, "B", Kind.CLASS, null);
    Set<Kind> kinds = new HashSet<>();
    Iterable<JavaFileObject> files =
        fileManager.list(StandardLocation.CLASS_OUTPUT, "pkg", kinds, true);
    assertThat(files, hasItem(javaFileObjectA));
    assertThat(files, not(hasItem(javaFileObjectB)));

    files = fileManager.list(StandardLocation.CLASS_OUTPUT, "", kinds, true);
    assertThat(files, hasItem(javaFileObjectB));
    assertThat(files, not(hasItem(javaFileObjectA)));
  }

  @Test
  public void testInferBinaryName() throws IOException {
    JavaFileObject javaFileObjectA = fileManager.getJavaFileForOutput(StandardLocation.CLASS_OUTPUT,
        "com.pkg.A", Kind.CLASS, null);
    fileManager.inferBinaryName(StandardLocation.CLASS_OUTPUT, javaFileObjectA);
    JavaFileObject javaFileObjectB =
        fileManager.getJavaFileForOutput(StandardLocation.CLASS_PATH, "B", Kind.CLASS, null);
    fileManager.inferBinaryName(StandardLocation.CLASS_PATH, javaFileObjectB);
  }

  @Override
  @After
  public void tearDown() throws IOException {
    fileManager.close();
  }

  private static String getStringFromInputStream(InputStream is) {

    BufferedReader br = null;
    StringBuilder sb = new StringBuilder();

    String line;
    try {

      br = new BufferedReader(new InputStreamReader(is));
      while ((line = br.readLine()) != null) {
        sb.append(line);
      }

    } catch (IOException e) {
      e.printStackTrace();
    } finally {
      if (br != null) {
        try {
          br.close();
        } catch (IOException e) {
          e.printStackTrace();
        }
      }
    }

    return sb.toString();

  }
}
