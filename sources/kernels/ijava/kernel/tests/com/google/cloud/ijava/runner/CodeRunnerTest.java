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

import junit.framework.TestCase;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import static org.junit.Assert.assertThat;
import static org.hamcrest.Matchers.containsString;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.util.HashMap;

/**
 * Tests for {@link CodeRunner}.
 */
@RunWith(JUnit4.class)
public class CodeRunnerTest extends TestCase {

  @Test
  public void testRun() throws InterruptedException {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    PrintStream ps = new PrintStream(baos);
    CodeRunner codeRunner =
        new CodeRunner(System.in, ps, System.err, new RunnableCode(new HashMap<String, Object>()) {

          @Override
          public void ___run___() throws Throwable {
            System.out.print("run");
          }

          @Override
          protected void ___init___() {
            System.out.print("init ");
          }

          @Override
          protected void ___done___() {
            System.out.print(" done");
          }
        });
    codeRunner.start();
    codeRunner.join();
    assertEquals("init run done", baos.toString());
  }

  @Test
  public void testRunWithException() throws InterruptedException {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    PrintStream ps = new PrintStream(baos);
    CodeRunner codeRunner =
        new CodeRunner(System.in, ps, ps, new RunnableCode(new HashMap<String, Object>()) {

          @Override
          public void ___run___() throws Throwable {
            throw new Exception("ERROR!");
          }

          @Override
          protected void ___init___() {}

          @Override
          protected void ___done___() {}
        });
    codeRunner.start();
    codeRunner.join();
    assertThat(baos.toString(), containsString("ERROR!"));
  }
}
