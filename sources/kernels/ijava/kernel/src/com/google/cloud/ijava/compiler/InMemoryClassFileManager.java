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

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.logging.Logger;

import javax.tools.FileObject;
import javax.tools.ForwardingJavaFileManager;
import javax.tools.JavaFileManager;
import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import javax.tools.JavaFileObject.Kind;

/**
 * Simple class file manager that keeps all class bytecode known to it in memory.
 */
class InMemoryClassFileManager extends ForwardingJavaFileManager<JavaFileManager> {
  private static Logger LOGGER = Logger.getLogger(InMemoryClassFileManager.class.getName());

  /**
   * Instance of JavaClassObject that will store the compiled bytecode of our class
   */
  private final Map<String, InMemoryJavaClassFile> classNameToClassFile;

  /**
   * Map from package name to a list of class names in that package.
   */
  private final Map<String, List<String>> packageDir = new HashMap<>();

  /**
   * Will initialize the manager with the specified standard java file manager
   */
  public InMemoryClassFileManager(JavaFileManager standardManager) {
    super(standardManager);
    classNameToClassFile = new HashMap<String, InMemoryJavaClassFile>();
  }

  /**
   * Returns a class loader from the current map of in-memory class files.
   *
   * @param parentClassLoader the parent class loader
   */
  public ClassLoader createClassLoader(ClassLoader parentClassLoader) {
    Map<String, byte[]> classBytes = new HashMap<>();

    for (String s : classNameToClassFile.keySet()) {
      classBytes.put(s, classNameToClassFile.get(s).getBytes());
    }
    return new InMemoryClassLoader(classBytes, parentClassLoader);
  }

  @Override
  public Iterable<JavaFileObject> list(Location location, String packageName, Set<Kind> kinds,
      boolean recurse) throws IOException {
    List<JavaFileObject> l = new ArrayList<>();
    List<String> packageClasses = packageDir.get(packageName);
    if (packageClasses != null) {
      for (String s : packageClasses) {
        l.add(classNameToClassFile.get(s));
      }
    }
    List<JavaFileObject> matchedFiles = new ArrayList<>();
    matchedFiles.addAll(l);
    // Ask underlying file manager for its knowledge of files, e.g.
    // in case of JRE we use the files locally known to the compiler.
    for (JavaFileObject jfo : super.list(location, packageName, kinds, recurse)) {
      matchedFiles.add(jfo);
    }
    return matchedFiles;
  }

  @Override
  public JavaFileObject getJavaFileForInput(Location location, String className, Kind kind)
      throws IOException {
    if (kind == Kind.CLASS && classNameToClassFile.containsKey(className)) {
      return classNameToClassFile.get(className);
    }
    return super.getJavaFileForInput(location, className, kind);
  }

  @Override
  public String inferBinaryName(Location location, JavaFileObject file) {
    if (file instanceof InMemoryJavaClassFile) {
      return ((InMemoryJavaClassFile) file).getClassName();
    }
    return super.inferBinaryName(location, file);
  }

  /**
   * Gives the compiler an instance of the JavaClassObject so that the compiler can write the byte
   * code into it.
   */
  @Override
  public JavaFileObject getJavaFileForOutput(JavaFileManager.Location location, String className,
      JavaFileObject.Kind kind, FileObject sibling) throws IOException {

    /*
     * Create a new byte code container object that will be populated by the compiler (i.e., it does
     * not contain any byte code at this point)
     */
    final InMemoryJavaClassFile javaClassFile = new InMemoryJavaClassFile(className, kind);

    /*
     * Save a reference to the object that will eventually contain byte code so that it can be
     * retrieved during class loading later
     */
    classNameToClassFile.put(className, javaClassFile);
    String packageName = packageOf(className);
    if (!packageDir.containsKey(packageName)) {
      packageDir.put(packageName, new ArrayList<String>());
    }
    packageDir.get(packageName).add(className);
    LOGGER.finer(String.format("Creating java classfile '%s'", className));
    return javaClassFile;
  }

  private static String packageOf(String className) {
    int dotIndex = className.lastIndexOf('.');
    return dotIndex > -1 ? className.substring(0, dotIndex) : "";
  }

  /**
   * An in-memory .class file representation. The javac compiler outputs the bytes for the class
   * file into the given byte array output stream defined below.
   */
  static class InMemoryJavaClassFile extends SimpleJavaFileObject {
    private String fullyQualifiedClassName;

    /**
     * When the compiler generats bytecode for this class, it will be stored into this output
     * stream.
     */
    private final ByteArrayOutputStream bos = new ByteArrayOutputStream();

    /**
     * Registers the compiled class object under URI containing the class full name
     *
     * @param name Full name of the compiled class
     * @param kind Kind of the data. It will be CLASS in our case.
     *        <p>
     *        NOTE: needs to accept the Kind as a param so it can be instantiated by the compiler
     *        properly (but this should only be called with Kind.CLASS as far as I can tell)
     */
    public InMemoryJavaClassFile(String name, JavaFileObject.Kind kind) {
      super(URI.create("string:///" + name.replace('.', '/') + kind.extension), kind);
      fullyQualifiedClassName = name;
    }

    /**
     * Will be used by our file manager to get the byte code that can be put into memory to
     * instantiate our class
     *
     * @return compiled byte code
     */
    public byte[] getBytes() {
      return bos.toByteArray();
    }

    /**
     * Will provide the compiler with an output stream that leads to our byte array. This way the
     * compiler will write everything into the byte array that we will instantiate later
     */
    @Override
    public OutputStream openOutputStream() throws IOException {
      return bos;
    }

    @Override
    public InputStream openInputStream() throws IOException {
      return new ByteArrayInputStream(getBytes());
    }

    public String getClassName() {
      return fullyQualifiedClassName;
    }
  }
}
