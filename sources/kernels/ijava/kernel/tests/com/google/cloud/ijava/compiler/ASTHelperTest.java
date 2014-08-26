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

import com.google.cloud.ijava.compiler.InMemoryCompiler.CompilationResult;
import com.google.common.collect.Iterables;

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
    CompilationResult result = compiler.parse("int a = 10;");
    assertFalse(ASTHelper.hasNonStaticTypeDecls(Iterables.getFirst(result.compilationUnits, null),
        result.context));
  }

  @Test
  public void testMethodDecl() throws IOException {
    CompilationResult result = compiler.parse("public String toString() {}");
    assertFalse(ASTHelper.hasNonStaticTypeDecls(Iterables.getFirst(result.compilationUnits, null),
        result.context));
  }

  @Test
  public void testStaticTypeDecl() throws IOException {
    CompilationResult result = compiler.parse("static class StaticClass {}");
    assertFalse(ASTHelper.hasNonStaticTypeDecls(Iterables.getFirst(result.compilationUnits, null),
        result.context));
  }

  @Test
  public void testHasClassDecl() throws IOException {
    CompilationResult result = compiler.parse("class Test {}");
    assertTrue(ASTHelper.hasNonStaticTypeDecls(Iterables.getFirst(result.compilationUnits, null),
        result.context));
  }

  @Test
  public void testHasEnumDecl() throws IOException {
    CompilationResult result = compiler.parse("class Test {}");
    assertTrue(ASTHelper.hasNonStaticTypeDecls(Iterables.getFirst(result.compilationUnits, null),
        result.context));
  }

  @Test
  public void testHasInterfaceDecl() throws IOException {
    CompilationResult result = compiler.parse("class Test {}");
    assertTrue(ASTHelper.hasNonStaticTypeDecls(Iterables.getFirst(result.compilationUnits, null),
        result.context));
  }

  @Test
  public void testHasAnnotationDecl() throws IOException {
    CompilationResult result = compiler.parse("public @interface Test {}");
    assertTrue(ASTHelper.hasNonStaticTypeDecls(Iterables.getFirst(result.compilationUnits, null),
        result.context));
  }

  @Test
  public void testImportsToString() throws IOException {
    CompilationResult result =
        compiler.parse("import java.util.*; import java.io.IOException; class Test{}");
    String importString =
        ASTHelper.importsToString(Iterables.getFirst(result.compilationUnits, null));
    assertThat(importString, containsString("import java.util.*;"));
    assertThat(importString, containsString("import java.io.IOException;"));
  }

  @Test(expected = IllegalArgumentException.class)
  public void testAddImportsInvalidInput() throws IOException {
    CompilationResult result = compiler.parse("class Test{}");
    List<Import> imports = new ArrayList<>();
    imports.add(new Import(false, "  "));
    ASTHelper.addImports(Iterables.getFirst(result.compilationUnits, null), imports,
        result.context);
  }

  @Test
  public void testAddImports() throws IOException {
    CompilationResult result = compiler.parse("class Test{}");
    List<Import> imports = new ArrayList<>();
    imports.add(new Import(false, "java.util.List"));
    imports.add(new Import(true, "java.util.Arrays"));
    CompilationUnitTree withImports = ASTHelper.addImports(
        Iterables.getFirst(result.compilationUnits, null), imports, result.context);
    String importString = ASTHelper.importsToString(withImports);
    assertThat(importString, containsString("import java.util.List;"));
    assertThat(importString, containsString("import static java.util.Arrays;"));
  }

  @Test
  public void testPublicOrPackageTypeName1() throws IOException {
    CompilationResult result = compiler.parse("class Test{}");
    assertEquals("Test", ASTHelper.publicOrPackageTypeName(
        Iterables.getFirst(result.compilationUnits, null), result.context));
    result = compiler.parse("public class Test{}");
    assertEquals("Test", ASTHelper.publicOrPackageTypeName(
        Iterables.getFirst(result.compilationUnits, null), result.context));
    result = compiler.parse("int a =10;");
    assertNull(ASTHelper.publicOrPackageTypeName(Iterables.getFirst(result.compilationUnits, null),
        result.context));
  }
}
