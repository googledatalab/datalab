package com.google.cloud.ijava.runner;

import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.containsString;
import static org.junit.Assert.assertThat;

import com.google.cloud.ijava.runner.FragmentCodeRunner.FragmentCodeCompilationResult;
import com.google.common.collect.Iterables;

import junit.framework.TestCase;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.io.IOException;

/**
 * Tests for {@link FragmentCodeRunner} class.
 */
@RunWith(JUnit4.class)
public class FragmentCodeRunnerTest extends TestCase {
  private FragmentCodeRunner fragmentCodeRunner;

  @Override
  @Before
  public void setUp() {
    fragmentCodeRunner = new FragmentCodeRunner();
  }

  private void verifyGoodNonTypeDefCode(FragmentCodeCompilationResult result) {
    assertFalse(result.compilationResult.hasAnyDiagnosticError());
    assertNotNull(result.compiledClass);
    assertFalse(result.isTypeDefinition);
    assertNotNull(result.compilationResult.compilationUnits);
    assertThat(Iterables.size(result.compilationResult.compilationUnits), equalTo(1));
  }

  @Test
  public void testTryCompileEmptyInput() throws ClassNotFoundException, IOException {
    FragmentCodeCompilationResult result = fragmentCodeRunner.tryCompile("  ");
    verifyGoodNonTypeDefCode(result);
  }

  @Test
  public void testTryCompileBadTypeDecl() throws ClassNotFoundException, IOException {
    FragmentCodeCompilationResult result = fragmentCodeRunner.tryCompile("class Test { err! }");
    assertTrue(result.compilationResult.hasAnyDiagnosticError());
    assertNull(result.compiledClass);
    assertTrue(result.isTypeDefinition);
    assertNotNull(result.compilationResult.compilationUnits);
    assertThat(Iterables.size(result.compilationResult.compilationUnits), equalTo(1));
  }

  @Test
  public void testTryCompileGoodTypeDecl() throws ClassNotFoundException, IOException {
    FragmentCodeCompilationResult result =
        fragmentCodeRunner.tryCompile("package pkg; class Test { int a = 10; }");
    assertFalse(result.compilationResult.hasAnyDiagnosticError());
    assertNull(result.compiledClass);
    assertTrue(result.isTypeDefinition);
    assertNotNull(result.compilationResult.compilationUnits);
    assertThat(Iterables.size(result.compilationResult.compilationUnits), equalTo(1));
    // Make sure we can load the defined class
    assertNotNull(fragmentCodeRunner.compiler.getClassLoader().loadClass("pkg.Test"));
  }

  @Test
  public void testTryCompileImports() throws ClassNotFoundException, IOException {
    FragmentCodeCompilationResult result = fragmentCodeRunner.tryCompile(" import java.util.*; ");
    verifyGoodNonTypeDefCode(result);
    assertThat(result.imports, containsString("import java.util.*"));
  }

  @Test
  public void testTryCompileCodeWithError() throws ClassNotFoundException, IOException {
    FragmentCodeCompilationResult result = fragmentCodeRunner.tryCompile(" err ");
    assertTrue(result.compilationResult.hasAnyDiagnosticError());
    assertNull(result.compiledClass);
    assertFalse(result.isTypeDefinition);
    assertNull(result.codes);
    assertNull(result.imports);
  }

  @Test
  public void testTryCompileWithPredefinedState() throws ClassNotFoundException, IOException {
    fragmentCodeRunner.executionState.codes = "int y = 10;";
    FragmentCodeCompilationResult result = fragmentCodeRunner.tryCompile(" int x = y + 1; ");
    verifyGoodNonTypeDefCode(result);
    fragmentCodeRunner.executionState.imports = "import java.util.List; ";
    result = fragmentCodeRunner.tryCompile(" List<String> list;");
    verifyGoodNonTypeDefCode(result);
  }

  @Test
  public void testTryCompileRunBlock() throws ClassNotFoundException, IOException {
    fragmentCodeRunner.executionState.codes = "int x = 10;";
    fragmentCodeRunner.executionState.imports = "import java.util.List; ";
    FragmentCodeCompilationResult result =
        fragmentCodeRunner.tryCompile("{ List<String> l = null; System.out.println(x); }");
    verifyGoodNonTypeDefCode(result);
  }

  @Test
  public void testTryCompileVarDecl() throws ClassNotFoundException, IOException {
    FragmentCodeCompilationResult result = fragmentCodeRunner.tryCompile(" int x = 10; ");
    verifyGoodNonTypeDefCode(result);
    assertThat(result.codes, containsString("int x = 10;"));
  }

  @Test
  public void testTryCompileMethodDecl() throws ClassNotFoundException, IOException {
    FragmentCodeCompilationResult result = fragmentCodeRunner.tryCompile(" void test () { } ");
    verifyGoodNonTypeDefCode(result);
    assertThat(result.codes, containsString("void test() {"));
  }

  @Test
  public void testTryClassCastError() throws ClassNotFoundException, IOException {
    FragmentCodeCompilationResult result = fragmentCodeRunner.tryCompile(
        " { Long z; System.out.println(((String)z));} ");
    assertTrue(result.compilationResult.hasAnyDiagnosticError());
    assertNull(result.compiledClass);
    assertFalse(result.isTypeDefinition);
    assertNull(result.codes);
    assertNull(result.imports);
  }
}
