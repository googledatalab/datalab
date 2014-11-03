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

package org.gradle

import groovy.io.FileType
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.tasks.TaskAction

/**
 * TypeScript compilation task that invokes tsc.
 */
class TypeScriptCompileTask extends DefaultTask {

    String relativePath = ''
    String outputRelativePath = ''
    String srcDir = ''
    String outDir = project.buildDir.path
    String moduleType = 'commonjs'
    String compilerArgs = '--removeComments --noImplicitAny'

    @TaskAction
    def compile() {
        // Enumerate the typescript files recursively within the given source path
        def tsFiles = []
        new File("${ srcDir }${ relativePath }").eachFileRecurse(FileType.FILES) {
            if (it.name.endsWith('.ts')) {
                tsFiles << it;
            }
        }

        // If an output relative path was not defined, use the input relative path
        if (outputRelativePath.isEmpty()) {
            outputRelativePath = relativePath
        }

        // Call out to the TypeScript compiler (tsc) to compile and emit to the build dir
        def proc = """tsc $compilerArgs --module $moduleType \
           --outDir $outDir${ outputRelativePath } ${ tsFiles.join(' ') }""".execute()
        if (proc.in.text?.trim()) {
            println "tsc stdout:\n${ proc.in.text }"
        }

        // Fail the task if the TypeScript compiler returned non-zero exit value
        if (proc.exitValue() != 0) {
            println "tsc stderr: \n${ proc.err.text }"
            throw new GradleException("TypeScript Compilation failed.")
        }
    }
}
