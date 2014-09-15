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

import com.google.cloud.ijava.compiler.ASTHelper;
import com.google.cloud.ijava.compiler.InMemoryCompiler;
import com.google.cloud.ijava.compiler.InMemoryCompiler.CompilationResult;
import com.google.common.annotations.VisibleForTesting;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Iterables;
import com.google.common.collect.Maps;

import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.tools.javac.tree.JCTree;
import com.sun.tools.javac.tree.JCTree.JCClassDecl;
import com.sun.tools.javac.tree.Pretty;

import org.apache.velocity.Template;
import org.apache.velocity.VelocityContext;
import org.apache.velocity.app.VelocityEngine;
import org.apache.velocity.runtime.RuntimeConstants;
import org.apache.velocity.runtime.resource.loader.ClasspathResourceLoader;

import java.io.IOException;
import java.io.InputStream;
import java.io.PrintStream;
import java.io.StringWriter;
import java.lang.reflect.InvocationTargetException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Logger;

import javax.tools.Diagnostic;
import javax.tools.JavaFileObject;
import javax.tools.Diagnostic.Kind;

/**
 * This class is responsible for compiling any input string into a compilable Java class in the
 * context of the current execution.
 */
public class FragmentCodeRunner implements JavaExecutionEngine {
  private static Logger LOGGER = Logger.getLogger(FragmentCodeRunner.class.getName());

  public static final String JAVA_FILE_EXTENSION = ".java";
  private static final String DELTA_CODE_TEMPLATE = "com/google/cloud/ijava/runner/delta_code.vm";
  private static final String FINAL_CODE_TEMPLATE = "com/google/cloud/ijava/runner/final_code.vm";

  private VelocityEngine velocity;
  @VisibleForTesting
  InMemoryCompiler compiler;
  @VisibleForTesting
  ExecutionState executionState;

  @VisibleForTesting
  static class FragmentCodeCompilationResult {
    /**
     * The compilation result coming from {@link InMemoryCompiler}.
     */
    CompilationResult compilationResult;

    /**
     * Determines whether or not the fragment code is runnable or not. For example if the fragment
     * code is a type declaration, it is not runnable.
     */
    boolean isTypeDefinition;

    /**
     * The compiled class resulting from the fragment code. This can be null if the compilation
     * failed due to errors or if the input was a type declaration.
     */
    Class<?> compiledClass;

    /**
     * Text representing all of imports.
     */
    String imports;

    /**
     * Text representing all of defined fields and methods.
     */
    String codes;

    FragmentCodeCompilationResult(CompilationResult compilationResult, Boolean isTypeDefinition,
        Class<?> compiledClass) {
      this.compilationResult = compilationResult;
      this.isTypeDefinition = isTypeDefinition;
      this.compiledClass = compiledClass;
    }
  }

  /**
   * This class contains the data which represent the current state of execution.
   */
  static class ExecutionState {
    Integer executionCounter;

    /**
     * Text representing all of imports.
     */
    String imports;

    /**
     * Text representing all of defined fields and methods.
     */
    String codes;
    Map<String, Object> fieldValues;

    ExecutionState(Integer executionCounter, String codeBuffer, Map<String, Object> fieldValues,
        String imports) {
      this.executionCounter = executionCounter;
      this.codes = codeBuffer;
      this.fieldValues = fieldValues;
      this.imports = imports;
    }
  }

  public FragmentCodeRunner() {
    velocity = new VelocityEngine();
    velocity.setProperty(RuntimeConstants.RESOURCE_LOADER, "classpath");
    velocity.setProperty("classpath.resource.loader.class",
        ClasspathResourceLoader.class.getName());
    velocity.init();
    compiler = new InMemoryCompiler();
    executionState = new ExecutionState(1, "", Maps.<String, Object>newHashMap(), "");
  }

  /**
   * @param prefix must be a valid Java identifier
   * @return a Java identifier by concatenating the prefix and the current execution number.
   */
  private String javaIdentifier(String prefix) {
    return prefix + executionState.executionCounter;
  }

  /**
   * Compile a velocity template given a velocity template path and a map of names to objects.
   *
   * @param templatePath relative to classpath root
   * @param data map of names (string) to objects for filling out the template
   * @return the compiled template
   */
  private String compileTemplate(String templatePath, Map<String, Object> data) {
    VelocityContext context = new VelocityContext();
    for (Map.Entry<String, Object> property : data.entrySet()) {
      context.put(property.getKey(), property.getValue());
    }
    Template template = velocity.getTemplate(templatePath, "UTF-8");
    StringWriter writer = new StringWriter();
    template.merge(context, writer);
    writer.flush();
    return writer.toString();
  }

  @VisibleForTesting
  FragmentCodeCompilationResult tryCompile(String code) throws IOException, ClassNotFoundException {
    // Try to compile the input code and see if it is a type declaration.
    {
      CompilationResult compilationResult = compiler.parse(code);
      CompilationUnitTree cunit = Iterables.getFirst(compilationResult.compilationUnits, null);
      if (ASTHelper.hasNonStaticTypeDecls(cunit, compilationResult.context)) {
        if (compilationResult.hasAnyDiagnosticError()) {
          return new FragmentCodeCompilationResult(compilationResult, true, null);
        }
        String typeName = ASTHelper.publicOrPackageTypeName(cunit, compilationResult.context);
        compiler.compile(typeName + JAVA_FILE_EXTENSION, ASTHelper.treeToString((JCTree) cunit))
            .getDiagnostics();
        compiler.pushClassLoader();
        return new FragmentCodeCompilationResult(compilationResult, true, null);
      }
    }

    // Case when we are not dealing with type declarations:
    final String codeClassName = javaIdentifier("___Code___");
    code = code.trim();

    boolean isImportStatement = false;
    if (code.startsWith("import ")) {
      isImportStatement = true;
    }

    String deltaClassName = javaIdentifier("___Delta___");
    String deltaCode = compileTemplate(DELTA_CODE_TEMPLATE, new ImmutableMap.Builder<String,
        Object>()
        .put("imports", isImportStatement ? executionState.imports + "\n" + code
            : executionState.imports.toString())
        .put("codeClassName", codeClassName)
        .put("codes", executionState.codes)
        .put("inputCode", isImportStatement ? "" : code)
        .put("deltaClassName", deltaClassName)
        .build());

    LOGGER.fine("Analyzing: " + deltaCode);

    CompilationResult compilationResult = compiler.parse(deltaCode);
    if (compilationResult.hasAnyDiagnosticError()) {
      return new FragmentCodeCompilationResult(compilationResult, false, null);
    }

    CompilationUnitTree parsedCompilationUnit =
        Iterables.getFirst(compilationResult.compilationUnits, null);
    JCClassDecl topClass = (JCClassDecl) parsedCompilationUnit.getTypeDecls().get(0);
    // Original member definitions
    List<Tree> defs = new ArrayList<>();
    // New member definitions
    List<Tree> deltaDefs = new ArrayList<>();
    for (JCTree d : topClass.defs) {
      if (d.getKind() == Tree.Kind.CLASS) {
        JCClassDecl c = (JCClassDecl) d;
        // Gather the members of the delta class.
        if (c.name.toString().equals(deltaClassName)) {
          deltaDefs.addAll(c.defs);
        } else {
          defs.add(c);
        }
      } else {
        defs.add(d);
      }
    }

    // Merge the definitions with delta definitions. If two definitions have the same signature then
    // choose from delta definition.
    List<? extends Tree> merged = ASTHelper.merge(
        ASTHelper.removeCompilerGenerated(defs, compilationResult.context),
        ASTHelper.removeCompilerGenerated(deltaDefs, compilationResult.context));
    // Use Pretty code printer to convert the AST into text.
    StringWriter declarationsWriter = new StringWriter();
    StringWriter codeToRunWriter = new StringWriter();
    Pretty pretty = new Pretty(declarationsWriter, true);
    Pretty prettyCodeToRun = new Pretty(codeToRunWriter, true);
    for (Tree t : merged) {
      JCTree jt = (JCTree) t;
      if (jt.getKind() == Tree.Kind.BLOCK) {
        jt.accept(prettyCodeToRun);
      } else {
        jt.accept(pretty);
        if (jt.getKind() == Tree.Kind.VARIABLE) {
          declarationsWriter.write(";");
        }
        declarationsWriter.write("\n");
      }
    }

    List<Tree> fields = new ArrayList<>();
    for (Tree t : merged) {
      if (t.getKind() == Tree.Kind.VARIABLE) {
        fields.add(t);
      }
    }

    // Removing the fields from fieldValues which appeared in delta code, because user is redefining
    // them.
    for (Tree t : deltaDefs) {
      if (t.getKind() == Tree.Kind.VARIABLE) {
        executionState.fieldValues.remove(((VariableTree) t).getName().toString());
      }
    }

    String finalCode = compileTemplate(FINAL_CODE_TEMPLATE, new ImmutableMap.Builder<String,
        Object>()
        .put("codeClassName", codeClassName)
        .put("imports", executionState.imports + ASTHelper.importsToString(parsedCompilationUnit))
        .put("declarations", declarationsWriter.toString())
        .put("codeToRun", codeToRunWriter.toString())
        .put("fields", fields)
        .build());

    LOGGER.fine("Compiling: " + finalCode);
    CompilationResult finalCompilationResult =
        compiler.analyze(codeClassName + JAVA_FILE_EXTENSION, finalCode);
    if (finalCompilationResult.hasAnyDiagnosticError()) {
      return new FragmentCodeCompilationResult(finalCompilationResult, false, null);
    }
    compiler.compile(codeClassName + JAVA_FILE_EXTENSION, finalCode).getDiagnostics();
    Class<?> runnableClass = compiler.pushClassLoader().loadClass(codeClassName);

    StringWriter newCodesWriter = new StringWriter();
    Pretty newCodesPrettifier = new Pretty(newCodesWriter, true);
    for (Tree t : merged) {
      JCTree jt = (JCTree) t;
      if (jt.getKind() != Tree.Kind.BLOCK) {
        jt.accept(newCodesPrettifier);
      }
      if (jt.getKind() == Tree.Kind.VARIABLE) {
        newCodesWriter.write(";");
      }
      newCodesWriter.write("\n");
    }

    FragmentCodeCompilationResult fragmentCodeCompilationResult =
        new FragmentCodeCompilationResult(compilationResult, false, runnableClass);
    fragmentCodeCompilationResult.codes = newCodesWriter.toString();
    fragmentCodeCompilationResult.imports = ASTHelper.importsToString(
        Iterables.getFirst(finalCompilationResult.compilationUnits, null));
    return fragmentCodeCompilationResult;
  }

  /**
   * Runs the input {@code code}. Replaces the standard input, output and error streams with
   * {@code in}, {@code out} and {@code err} before running the code.
   *
   * @return true for a successful run and false if any error or exception happened during the
   *         execution.
   */
  boolean run(String code, InputStream in, PrintStream out, PrintStream err) {
    try {
      FragmentCodeCompilationResult fragmentCodeCompilationResult = null;
      try {
        fragmentCodeCompilationResult = tryCompile(code);
        if (fragmentCodeCompilationResult.compilationResult.hasAnyDiagnosticError()) {
          reportErrors(Iterables
              .getFirst(fragmentCodeCompilationResult.compilationResult.compilationUnits, null)
              .getSourceFile().getCharContent(true).toString(),
              fragmentCodeCompilationResult.compilationResult.diagnostics, err);
          return false;
        }
        // If the input was a type definition, then return here because we do not need to execute
        // any code
        if (fragmentCodeCompilationResult.isTypeDefinition) {
          return true;
        }
      } catch (ClassNotFoundException | IOException e) {
        e.printStackTrace(err);
        return false;
      }

      try {
        // Running the code
        runCore(fragmentCodeCompilationResult, in, out, err);
      } catch (InstantiationException | IllegalAccessException | IllegalArgumentException
          | InvocationTargetException | NoSuchMethodException | SecurityException
          | InterruptedException e) {
        e.printStackTrace(err);
        return false;
      }

      // After a successful run update the execution state with new codes and imports.
      updateState(fragmentCodeCompilationResult);
      LOGGER.fine("RunnableCode buffer is:\n" + executionState.codes + "\n===============");
      return true;
    } finally {
      err.flush();
      out.flush();
      LOGGER.fine("Finished running code: " + code);
    }
  }

  private void updateState(FragmentCodeCompilationResult fragmentCodeCompilationResult) {
    executionState.codes = fragmentCodeCompilationResult.codes;
    executionState.imports = fragmentCodeCompilationResult.imports;
  }

  private void runCore(FragmentCodeCompilationResult fragmentCodeCompilationResult, InputStream in,
      PrintStream out, PrintStream err)
      throws InstantiationException,
      IllegalAccessException,
      IllegalArgumentException,
      InvocationTargetException,
      NoSuchMethodException,
      SecurityException,
      InterruptedException {
    Class<?> codeClass = fragmentCodeCompilationResult.compiledClass;
    RunnableCode runCode = codeClass.asSubclass(RunnableCode.class)
        .getDeclaredConstructor(Map.class).newInstance(executionState.fieldValues);
    CodeRunner codeRunner = new CodeRunner(in, out, err, runCode);
    codeRunner.start();
    codeRunner.join();
  }

  /**
   * Reports diagnostic errors from Java compiler into the error stream. This method alters the
   * diagnostic error message to match the correct line and column number that we get after
   * manipulating the user's input code.
   *
   * @throws IOException when it cannot read the content of the source
   */
  private static void reportErrors(String code,
      List<Diagnostic<? extends JavaFileObject>> diagnostics, PrintStream err) throws IOException {
    LOGGER.fine("Reporting errors on: \n" + code);
    String[] lines = code.split("\n");
    for (Diagnostic<? extends JavaFileObject> diagnostic : diagnostics) {
      if (diagnostic.getKind() == Kind.ERROR) {
        String diagMessage = diagnostic.getMessage(Locale.US);

        // Adding a caret right below where error is happening:
        StringBuilder errorMessage = new StringBuilder();
        errorMessage.append(lines[(int) (diagnostic.getLineNumber() - 1)]).append("\n");
        for (int i = 1; i < diagnostic.getColumnNumber(); i++) {
          errorMessage.append(" ");
        }
        errorMessage.append("^\n").append(diagMessage);

        // The following case is most likely to happen when user is trying to type in a code to run
        // but does not have braces around the code.
        if (diagMessage.contains("<identifier> expected")
            || diagMessage.contains("return type required")) {
          errorMessage.append("\nFor a code to run, wrap it in a block: { ... }");
        }
        err.println(errorMessage.toString());
      }
    }
  }

  @Override
  public void incExecutionCounter() {
    executionState.executionCounter++;
  }

  @Override
  public int getExecutionCounter() {
    return executionState.executionCounter;
  }

  @Override
  public boolean execute(String code, InputStream in, PrintStream out, PrintStream err) {
    return run(code, in, out, err);
  }
}
