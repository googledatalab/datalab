package com.google.cloud.ijava.compiler;

import com.google.cloud.ijava.compiler.InMemoryCompiler.CompilationResult;

import com.sun.source.tree.CompilationUnitTree;

import junit.framework.TestCase;

import static org.junit.Assert.*;
import static org.hamcrest.Matchers.*;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Tests for {@link ASTHelper} class.
 */
@RunWith(JUnit4.class)
public class ASTHelperTest extends TestCase {

  private InMemoryCompiler compiler;

  @Override
  @Before
  public void setUp() {
    compiler = new InMemoryCompiler();
  }

  @Test
  public void testNoTypeDecl() throws IOException {
    CompilationResult result = compiler.parse("A.java", "int a = 10;");
    assertFalse(ASTHelper.hasTypeDecls(ASTHelper.firstOf(result.compilationUnits), result.context));
  }

  @Test
  public void testMethodDecl() throws IOException {
    CompilationResult result = compiler.parse("A.java", "public String toString() {}");
    assertFalse(ASTHelper.hasTypeDecls(ASTHelper.firstOf(result.compilationUnits), result.context));
  }

  @Test
  public void testHasClassDecl() throws IOException {
    CompilationResult result = compiler.parse("Test.java", "class Test {}");
    assertTrue(ASTHelper.hasTypeDecls(ASTHelper.firstOf(result.compilationUnits), result.context));
  }

  @Test
  public void testHasEnumDecl() throws IOException {
    CompilationResult result = compiler.parse("Test.java", "class Test {}");
    assertTrue(ASTHelper.hasTypeDecls(ASTHelper.firstOf(result.compilationUnits), result.context));
  }

  @Test
  public void testHasInterfaceDecl() throws IOException {
    CompilationResult result = compiler.parse("Test.java", "class Test {}");
    assertTrue(ASTHelper.hasTypeDecls(ASTHelper.firstOf(result.compilationUnits), result.context));
  }

  @Test
  public void testHasAnnotationDecl() throws IOException {
    CompilationResult result = compiler.parse("Test.java", "public @interface Test {}");
    assertTrue(ASTHelper.hasTypeDecls(ASTHelper.firstOf(result.compilationUnits), result.context));
  }

  @Test
  public void testImportsToString() throws IOException {
    CompilationResult result =
        compiler.parse("Test.java", "import java.util.*; import java.io.IOException; class Test{}");
    String importString = ASTHelper.importsToString(ASTHelper.firstOf(result.compilationUnits));
    assertThat(importString, containsString("import java.util.*;"));
    assertThat(importString, containsString("import java.io.IOException;"));
  }

  @Test(expected = IllegalArgumentException.class)
  public void testAddImportsInvalidInput() throws IOException {
    CompilationResult result = compiler.parse("Test.java", "class Test{}");
    List<Import> imports = new ArrayList<>();
    imports.add(new Import(false, "  "));
    ASTHelper.addImports(ASTHelper.firstOf(result.compilationUnits), imports, result.context);
  }

  @Test
  public void testAddImports() throws IOException {
    CompilationResult result = compiler.parse("Test.java", "class Test{}");
    List<Import> imports = new ArrayList<>();
    imports.add(new Import(false, "java.util.List"));
    imports.add(new Import(true, "java.util.Arrays"));
    CompilationUnitTree withImports =
        ASTHelper.addImports(ASTHelper.firstOf(result.compilationUnits), imports, result.context);
    String importString = ASTHelper.importsToString(withImports);
    assertThat(importString, containsString("import java.util.List;"));
    assertThat(importString, containsString("import static java.util.Arrays;"));
  }

  @Test
  public void testPublicOrPackageTypeName1() throws IOException {
    CompilationResult result = compiler.parse("Test.java", "class Test{}");
    assertEquals("Test", ASTHelper.publicOrPackageTypeName(
        ASTHelper.firstOf(result.compilationUnits), result.context));
    result = compiler.parse("Test.java", "public class Test{}");
    assertEquals("Test", ASTHelper.publicOrPackageTypeName(
        ASTHelper.firstOf(result.compilationUnits), result.context));
    result = compiler.parse("Test.java", "int a =10;");
    assertNull(ASTHelper.publicOrPackageTypeName(ASTHelper.firstOf(result.compilationUnits),
        result.context));
  }
}
