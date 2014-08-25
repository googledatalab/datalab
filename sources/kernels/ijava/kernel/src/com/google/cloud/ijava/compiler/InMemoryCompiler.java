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

import com.sun.source.tree.CompilationUnitTree;
import com.sun.tools.javac.api.JavacTaskImpl;
import com.sun.tools.javac.util.Context;

import java.io.IOException;
import java.net.URI;
import java.util.Collections;
import java.util.List;

import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import javax.tools.ToolProvider;
import javax.tools.Diagnostic.Kind;

/**
 * A Java compiler class which can compile, parse and analyze an input code and returns the compiler
 * context, diagnostics and the resulting compilation units. This class creates a virtual stack of
 * class loaders. A new class loader will be pushed (chained) onto the stack every time the user of
 * this class calls {@link #pushClassLoader()} method. The class loader at the top of the stack is
 * returned by {@link #getClassLoader()}.
 */
public class InMemoryCompiler {
  private InMemoryClassFileManager javaFileManager;
  private ClassLoader currentClassLoader;

  public InMemoryCompiler() {
    javaFileManager = new InMemoryClassFileManager(
        ToolProvider.getSystemJavaCompiler().getStandardFileManager(null, null, null));
    currentClassLoader = InMemoryCompiler.class.getClassLoader();
  }

  /**
   * Compiles an input code and generates bytecode if possible (when there is no error).
   *
   * @return the diagnostic information of the compile
   */
  public DiagnosticCollector<JavaFileObject> compile(String sourcePath, String classSourceCode) {
    DiagnosticCollector<JavaFileObject> diagnosticCollector = new DiagnosticCollector<>();
    InMemoryJavaSourceFile sourceFile = new InMemoryJavaSourceFile(sourcePath, classSourceCode);
    JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
    compiler.getTask(null,
        javaFileManager,
        diagnosticCollector,
        null,
        null,
        Collections.singletonList(sourceFile)).call();
    return diagnosticCollector;
  }

  /**
   * Parses and analyzes the input code and returns a result.
   *
   * @see CompilationResult
   */
  public CompilationResult analyze(String sourcePath, String classSourceCode) throws IOException {
    DiagnosticCollector<JavaFileObject> diagnosticCollector = new DiagnosticCollector<>();
    JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
    InMemoryJavaSourceFile sourceFile = new InMemoryJavaSourceFile(sourcePath, classSourceCode);
    JavacTaskImpl javacTask = (JavacTaskImpl) compiler.getTask(null,
        javaFileManager,
        diagnosticCollector,
        null,
        null,
        Collections.singletonList(sourceFile));
    Iterable<? extends CompilationUnitTree> compilationUnits = javacTask.parse();
    javacTask.analyze();
    return new CompilationResult(javacTask.getContext(), diagnosticCollector.getDiagnostics(),
        compilationUnits);
  }

  /**
   * Parses the input code and returns a result. This does not attribute the compilation unit tree
   * and is useful when you don't want to resolve symbols.
   *
   * @see CompilationResult
   */
  public CompilationResult parse(String classSourceCode) throws IOException {
    DiagnosticCollector<JavaFileObject> diagnosticCollector = new DiagnosticCollector<>();
    JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
    InMemoryJavaSourceFile sourceFile = new InMemoryJavaSourceFile("", classSourceCode);
    JavacTaskImpl javacTask = (JavacTaskImpl) compiler.getTask(null,
        javaFileManager,
        diagnosticCollector,
        null,
        null,
        Collections.singletonList(sourceFile));
    Iterable<? extends CompilationUnitTree> compilationUnits = javacTask.parse();
    return new CompilationResult(javacTask.getContext(), diagnosticCollector.getDiagnostics(),
        compilationUnits);
  }

  public ClassLoader pushClassLoader() {
    currentClassLoader = javaFileManager.createClassLoader(currentClassLoader);
    return currentClassLoader;
  }

  public ClassLoader getClassLoader() {
    return currentClassLoader;
  }

  public static class CompilationResult {
    public Context context;
    public List<Diagnostic<? extends JavaFileObject>> diagnostics;
    public Iterable<? extends CompilationUnitTree> compilationUnits;

    public CompilationResult(Context context,
        List<Diagnostic<? extends JavaFileObject>> diagnostics,
        Iterable<? extends CompilationUnitTree> trees) {
      this.context = context;
      this.diagnostics = diagnostics;
      this.compilationUnits = trees;
    }


    public boolean hasAnyDiagnosticError() {
      for (Diagnostic<? extends JavaFileObject> d : diagnostics) {
        if (d.getKind() == Kind.ERROR) {
          return true;
        }
      }
      return false;
    }
  }

  /**
   * An in-memory Java source code container
   */
  static class InMemoryJavaSourceFile extends SimpleJavaFileObject {

    /**
     * The raw source code as a string/char sequence.
     */
    private final CharSequence sourceCode;

    /**
     * Generates a URI for the given source code for reference during compilation
     *
     * @param sourceCode source code to compile
     */
    public InMemoryJavaSourceFile(String path, CharSequence sourceCode) {
      super(URI.create("string:///" + path), JavaFileObject.Kind.SOURCE);
      this.sourceCode = sourceCode;
    }

    @Override
    public CharSequence getCharContent(boolean ignoreEncodingErrors) {
      return sourceCode;
    }
  }
}
