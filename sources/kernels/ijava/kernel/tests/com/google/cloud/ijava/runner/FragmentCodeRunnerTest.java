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

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.Assert.assertThat;

import com.google.cloud.ijava.runner.FragmentCodeRunner.FragmentCodeCompilationResult;
import com.google.common.collect.Iterables;

import junit.framework.TestCase;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintStream;

/**
 * Tests for {@link FragmentCodeRunner} class.
 */
@RunWith(JUnit4.class)
public class FragmentCodeRunnerTest extends TestCase {
  private FragmentCodeRunner fragmentCodeRunner;
  private PrintStream out;
  private ByteArrayOutputStream outputByteArray;
  private PrintStream err;
  private ByteArrayOutputStream errorByteArray;
  private InputStream in;

  @Override
  @Before
  public void setUp() {
    setUpStreams();
    fragmentCodeRunner = new FragmentCodeRunner();
  }

  private void setUpStreams() {
    outputByteArray = new ByteArrayOutputStream();
    out = new PrintStream(outputByteArray);
    errorByteArray = new ByteArrayOutputStream();
    err = new PrintStream(errorByteArray);
    in = new ByteArrayInputStream(new byte[] {});
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
  public void testTryCompileTypeDeclSemanticError() throws ClassNotFoundException, IOException {
    FragmentCodeCompilationResult result =
        fragmentCodeRunner.tryCompile("class Test { UndefinedType t; }");
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
    FragmentCodeCompilationResult result =
        fragmentCodeRunner.tryCompile(" { Long z; System.out.println(((String)z));} ");
    assertTrue(result.compilationResult.hasAnyDiagnosticError());
    assertNull(result.compiledClass);
    assertFalse(result.isTypeDefinition);
    assertNull(result.codes);
    assertNull(result.imports);
  }

  @Test
  public void testRunNothing() {
    assertTrue(fragmentCodeRunner.run("   ", in, out, err));
    assertThat(outputByteArray.toString(), equalTo(""));
    assertThat(errorByteArray.toString(), equalTo(""));
  }

  @Test
  public void testRunFieldCreation() {
    assertTrue(fragmentCodeRunner.run(" int a = 10; ", in, out, err));
    assertThat(outputByteArray.toString(), equalTo(""));
    assertThat(errorByteArray.toString(), equalTo(""));
  }

  @Test
  public void testRunMethodDef() {
    assertTrue(fragmentCodeRunner.run(" void test() {} ", in, out, err));
    assertThat(outputByteArray.toString(), equalTo(""));
    assertThat(errorByteArray.toString(), equalTo(""));
  }

  @Test
  public void testRunSystemOut() {
    assertTrue(fragmentCodeRunner.run(" { int x = 10; System.out.println(x); } ", in, out, err));
    assertThat(outputByteArray.toString(), equalTo("10\n"));
    assertThat(errorByteArray.toString(), equalTo(""));
  }

  @Test
  public void testRunSystemErr() {
    assertTrue(fragmentCodeRunner.run(" { int x = 10; System.err.println(x); } ", in, out, err));
    assertThat(outputByteArray.toString(), equalTo(""));
    assertThat(errorByteArray.toString(), equalTo("10\n"));
  }

  @Test
  public void testReportErrorsCaretPosition() {
    assertFalse(fragmentCodeRunner.run("void test() {\nerr\n}", in, out, err));
    assertThat(outputByteArray.toString(), equalTo(""));
    String errString = errorByteArray.toString();
    // Make sure caret is displayed at the right position
    assertThat(errString, containsString("err\n^\n"));
    setUpStreams();
    assertFalse(fragmentCodeRunner.run("void test() {\n    err\n}", in, out, err));
    assertThat(outputByteArray.toString(), equalTo(""));
    errString = errorByteArray.toString();
    // Make sure caret is displayed at the right position
    assertThat(errString, containsString("    err\n    ^\n"));
  }

  @Test
  public void testRunExecustionStateUpdateFieldDefinition() {
    assertTrue(fragmentCodeRunner.run(" int a = 10; ", in, out, err));
    assertThat(fragmentCodeRunner.executionState.codes, containsString("int a = 10"));
  }

  @Test
  public void testRunExecustionStateUpdateImports() {
    assertTrue(fragmentCodeRunner.run(" import java.util.*; ", in, out, err));
    assertThat(fragmentCodeRunner.executionState.imports, containsString("import java.util.*;"));
  }

  @Test
  public void testRunExecustionStateUpdateTwoSeprateImports() {
    assertTrue(fragmentCodeRunner.run(" import java.util.*; ", in, out, err));
    assertThat(fragmentCodeRunner.executionState.imports, containsString("import java.util.*;"));
    assertTrue(fragmentCodeRunner.run(" import java.io.*; ", in, out, err));
    assertThat(fragmentCodeRunner.executionState.imports, containsString("import java.util.*;"));
    assertThat(fragmentCodeRunner.executionState.imports, containsString("import java.io.*;"));
  }

  @Test
  public void testRunExecustionStateUpdateSeprateDefinitions() {
    assertTrue(fragmentCodeRunner.run(" int a = 10; ", in, out, err));
    assertThat(fragmentCodeRunner.executionState.codes, containsString("int a = 10;"));
    assertTrue(fragmentCodeRunner.run(" int b = a * 2; ", in, out, err));
    assertThat(fragmentCodeRunner.executionState.codes, containsString("int a = 10;"));
    assertThat(fragmentCodeRunner.executionState.codes, containsString("int b = a * 2;"));
    assertTrue(fragmentCodeRunner.run(" void test() { System.out.println(b); } ", in, out, err));
    assertThat(fragmentCodeRunner.executionState.codes, containsString("System.out.println(b)"));
  }

  @Test
  public void testRunExecustionStateUpdateFieldValues() {
    assertTrue(fragmentCodeRunner.run(" int a = 10; ", in, out, err));
    assertThat((Integer) fragmentCodeRunner.executionState.fieldValues.get("a"),
        equalTo(new Integer(10)));
    assertTrue(fragmentCodeRunner.run(" { a = 20; } ", in, out, err));
    assertThat((Integer) fragmentCodeRunner.executionState.fieldValues.get("a"),
        equalTo(new Integer(20)));
  }

  @Test
  public void testRunInvalidCodeToRun() {
    assertFalse(fragmentCodeRunner.run(" a = 10; ", in, out, err));
    assertThat(outputByteArray.toString(), equalTo(""));
    String errString = errorByteArray.toString();
    assertThat(errString, containsString("For a code to run, wrap it in a block"));
  }

  @Test
  public void testGoodTypeDefinition() {
    assertTrue(fragmentCodeRunner.run(" class Test {int a = 10;} ", in, out, err));
    assertThat(outputByteArray.toString(), equalTo(""));
    assertThat(errorByteArray.toString(), equalTo(""));
  }

  @Test
  public void testStaticInnerTypeDef() {
    assertTrue(fragmentCodeRunner.run("static class Inner1 {} { Inner1 i; }", in, out, err));
    assertThat(outputByteArray.toString(), equalTo(""));
    assertThat(errorByteArray.toString(), equalTo(""));
    setUpStreams();
    assertTrue(fragmentCodeRunner.run("static class Inner2 {} { Inner2 i; }", in, out, err));
    assertThat(errorByteArray.toString(), equalTo(""));
  }

  @Test
  public void testIllegalAccessToClassConstructor() {
    assertTrue(fragmentCodeRunner.run("class Test {int a = 10; private Test() {} }", in, out, err));
    setUpStreams();
    assertFalse(fragmentCodeRunner.run(" { Test t = new Test(); } ", in, out, err));
    assertThat(outputByteArray.toString(), equalTo(""));
    assertThat(errorByteArray.toString(), containsString("has private access"));
  }

  @Test
  public void testIllegalAccessToField() {
    assertTrue(fragmentCodeRunner.run("public class X {int i;}", in, out, err));
    setUpStreams();
    assertTrue(
        fragmentCodeRunner.run(" { X x = new X(); System.out.println(x.i); } ", in, out, err));
    assertThat(outputByteArray.toString(), equalTo(""));
    assertThat(errorByteArray.toString(), containsString("tried to access field"));
  }

  @Test
  public void testClassCastException() {
    assertTrue(fragmentCodeRunner.run("public class X{}", in, out, err));
    assertTrue(fragmentCodeRunner.run(" X x = new X(); ", in, out, err));
    assertTrue(fragmentCodeRunner.run("public class X{public int i = 10;}", in, out, err));
    setUpStreams();
    assertTrue(fragmentCodeRunner.run("{System.out.println(x);}", in, out, err));
    assertThat(errorByteArray.toString(), containsString("cannot be cast to"));
  }

  @Override
  @After
  public void tearDown() throws IOException {
    out.close();
    err.close();
    in.close();
  }
}
