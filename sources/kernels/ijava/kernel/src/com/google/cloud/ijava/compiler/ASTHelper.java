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

import com.sun.source.tree.BlockTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ImportTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.Tree.Kind;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.tree.JCTree;
import com.sun.tools.javac.tree.JCTree.JCClassDecl;
import com.sun.tools.javac.tree.JCTree.JCCompilationUnit;
import com.sun.tools.javac.tree.JCTree.JCExpression;
import com.sun.tools.javac.tree.JCTree.JCMethodDecl;
import com.sun.tools.javac.tree.Pretty;
import com.sun.tools.javac.tree.TreeMaker;
import com.sun.tools.javac.util.Context;
import com.sun.tools.javac.util.Names;

import java.io.StringWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import javax.lang.model.element.Modifier;

/**
 * A helper class to get information out of Java ASTs or manipulate them.
 */
public class ASTHelper {

  /**
   * Looks inside the input compilation unit and returns true if there is a correct type
   * declaration. A class, interface, enum or annotation type with a name which is not "<error>"
   * will satisfy the condition for a type declaration.
   *
   * @param cunit input unit
   * @param context the compiler context
   * @return true when there is at least one type declared in the unit. Returns false otherwise.
   */
  public static boolean hasTypeDecls(CompilationUnitTree cunit, Context context) {
    Names names = Names.instance(context);
    if (cunit.getTypeDecls().size() > 0) {
      for (Tree t : cunit.getTypeDecls()) {
        Kind kind = t.getKind();
        if ((kind == Kind.CLASS || kind == Kind.INTERFACE || kind == Kind.ENUM
            || kind == Kind.ANNOTATION_TYPE)
        // Sometimes due to parse errors the name is "<error>" which means it is not really a
        // type declaration.
            && !((JCClassDecl) t).name.toString().equals(names.error.toString())) {
          return true;
        }
      }
    }
    // There were no types declared
    return false;
  }

  /**
   * Converts the import statements in the compilation unit into a string.
   *
   * @param cunit input unit
   * @return the string representation of the import statements
   */
  public static String importsToString(CompilationUnitTree cunit) {
    StringWriter sw = new StringWriter();
    Pretty pretty = new Pretty(sw, true);
    for (ImportTree t : cunit.getImports()) {
      JCTree jt = (JCTree) t;
      jt.accept(pretty);
    }
    return sw.toString();
  }

  /**
   * Converts a javac tree into a string using the javac {@link Pretty} class.
   *
   * @param tree input
   * @return the string representation of the tree
   */
  public static String treeToString(JCTree tree) {
    StringWriter sw = new StringWriter();
    tree.accept(new Pretty(sw, true));
    return sw.toString();
  }

  /**
   * Adds a list of import statements to the input compilation unit.
   *
   * @param cunit input unit
   * @param imports list of import statements
   * @param context compiler context needed to make compilationUnits
   * @return the modified version of the input compilation unit. It is the same instance with added
   *         imports.
   */
  public static CompilationUnitTree addImports(CompilationUnitTree cunit, List<Import> imports,
      Context context) {
    JCCompilationUnit jcUnit = (JCCompilationUnit) cunit;
    TreeMaker treeMaker = TreeMaker.instance(context);
    Names names = Names.instance(context);
    for (Import i : imports) {
      jcUnit.defs = jcUnit.defs.prepend(treeMaker.Import(
          createImportExpression(i.qualifiedImportName, treeMaker, names), i.isStatic));
    }
    return jcUnit;
  }

  /**
   * @param qualifiedImportName a qualified name. For example 'x' or 'x. y.z'
   * @param treeMaker
   * @param names
   * @return a javac expression representing the input qualified id which is either an identifier or
   *         a field access. Will return null if the input qualifiedImportName is empty or
   *         white-space.
   */
  private static JCExpression createImportExpression(String qualifiedImportName,
      TreeMaker treeMaker, Names names) {
    qualifiedImportName = qualifiedImportName.trim();
    if (qualifiedImportName.isEmpty()) {
      throw new IllegalArgumentException("Qualified ID for import statement cannot be empty.");
    }
    int dotIndex = qualifiedImportName.lastIndexOf(".");
    if (dotIndex > -1) {
      return treeMaker.Select(
          createImportExpression(qualifiedImportName.substring(0, dotIndex), treeMaker, names),
          names.fromString(qualifiedImportName.substring(dotIndex + 1)));
    } else {
      return treeMaker.Ident(names.fromString(qualifiedImportName));
    }
  }

  /**
   * @return the name of the public or package level class declared in the input compilation unit or
   *         null if no type declaration is present.
   */
  public static String publicOrPackageTypeName(CompilationUnitTree cunit, Context context) {
    String typeName = null;
    Names names = Names.instance(context);
    if (cunit.getTypeDecls().size() > 0) {
      for (Tree t : cunit.getTypeDecls()) {
        Kind kind = t.getKind();
        if ((kind == Kind.CLASS || kind == Kind.INTERFACE || kind == Kind.ENUM
            || kind == Kind.ANNOTATION_TYPE)
            && !((JCClassDecl) t).name.toString().equals(names.error.toString())) {
          JCClassDecl classDecl = (JCClassDecl) t;
          if (classDecl.getModifiers().getFlags().contains(Modifier.PUBLIC)) {
            return classDecl.getSimpleName().toString();
          } else {
            typeName = classDecl.getSimpleName().toString();
          }
        }
      }
    }
    return typeName;
  }

  /**
   * Merges delta into the defs. The merge is done based on a unique name which is generated for
   * input trees using the {@link NameGenerator} class. This method does not modify the input lists.
   */
  public static List<? extends Tree> merge(List<? extends Tree> defs, List<? extends Tree> delta) {
    NameGenerator defsNames = new NameGenerator();
    for (Tree t : defs) {
      t.accept(defsNames, null);
    }
    NameGenerator deltaNames = new NameGenerator();
    for (Tree t : delta) {
      t.accept(deltaNames, null);
    }
    List<Tree> merged = new ArrayList<>();
    for (Tree t : defs) {
      if (t.getKind() == Tree.Kind.BLOCK) {
        merged.add(t);
      }
      String name = defsNames.treeNames.get(t);
      if (deltaNames.nameTrees.containsKey(name)) {
        Tree dTree = deltaNames.nameTrees.get(name);
        merged.add(dTree);
        delta.remove(dTree);
      } else {
        merged.add(t);
      }
    }
    for (Tree t : delta) {
      merged.add(t);
    }
    return merged;
  }

  /**
   * @return true when the input tree is compiler generated; e.g. default constructor. Returns false
   *         otherwise.
   */
  public static boolean isCompilerGenerated(Tree tree, Context context) {
    Names names = Names.instance(context);
    boolean compilerGenerated = false;
    if (tree.getKind() == Tree.Kind.METHOD) {
      JCMethodDecl methodDecl = (JCMethodDecl) tree;
      if (methodDecl.getName().toString().equals(names.init.toString())) {
        compilerGenerated = true;
      }
    }
    return compilerGenerated;
  }

  /**
   * Returns a new list of trees which contains no compiler generated tree. This method does not
   * change the input list.
   */
  public static List<Tree> removeCompilerGenerated(List<Tree> l, Context context) {
    List<Tree> nl = new ArrayList<>();
    for (Tree t : l) {
      if (!ASTHelper.isCompilerGenerated(t, context)) {
        nl.add(t);
      }
    }
    return nl;
  }

  /**
   * @return the class which name is specified by input fullyQualifiedName. Returns null if no such
   *         class is found.
   */
  public static ClassTree findClass(final String fullyQualifiedName, CompilationUnitTree cut) {
    return cut.accept(new TreeScanner<ClassTree, Void>() {

      @Override
      public ClassTree visitClass(ClassTree tree, Void v) {
        JCClassDecl classDecl = (JCClassDecl) tree;
        if (classDecl.sym.getQualifiedName().equals(fullyQualifiedName)) {
          return tree;
        }
        return super.visitClass(tree, v);
      }
    }, null);
  }

  private static class NameGenerator extends TreeScanner<Void, Void> {
    int blockNumber = 0;
    Map<Tree, String> treeNames = new HashMap<>();
    Map<String, Tree> nameTrees = new HashMap<>();

    @Override
    public Void visitClass(ClassTree node, Void p) {
      treeNames.put(node, node.getSimpleName().toString());
      nameTrees.put(node.getSimpleName().toString(), node);
      return null;
    }

    @Override
    public Void visitMethod(MethodTree node, Void p) {
      StringBuilder sb = new StringBuilder();
      sb.append(node.getName()).append("(");
      boolean first = true;
      for (VariableTree v : node.getParameters()) {
        if (!first) {
          sb.append(",");
        } else {
          first = false;
        }
        sb.append(v.getType().toString());
      }
      sb.append(")");
      treeNames.put(node, sb.toString());
      nameTrees.put(sb.toString(), node);
      return null;
    }

    @Override
    public Void visitVariable(VariableTree node, Void p) {
      treeNames.put(node, node.getName().toString());
      nameTrees.put(node.getName().toString(), node);
      return null;
    }

    @Override
    public Void visitBlock(BlockTree node, Void p) {
      treeNames.put(node, "{}" + blockNumber);
      blockNumber++;
      return null;
    }
  }

  /**
   * @return the first compilation unit from the input units
   */
  public static CompilationUnitTree firstOf(Iterable<? extends CompilationUnitTree> cunits) {
    Iterator<? extends CompilationUnitTree> iterator = cunits.iterator();
    if (iterator.hasNext()) {
      return iterator.next();
    }
    return null;
  }
}
