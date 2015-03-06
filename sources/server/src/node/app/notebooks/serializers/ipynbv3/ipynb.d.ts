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


/**
 * Type definitions for the IPython notebook v3 format
 *
 * The JSON schema that defines the v3 format is here:
 * https://github.com/ipython/ipython/blob/master/IPython/nbformat/v3/nbformat.v3.schema.json
 */
declare module app {
  module ipy {
    /* A minimal ipynb v3 format notebook

    {
      "metadata": {
      "name": "",
      "signature": "sha256:hash-value-goes-here"
     },
     "nbformat": 3,
     "nbformat_minor": 0,
     "worksheets": [
      {
       "cells": [
        {
         "cell_type": "code",
         "collapsed": false,
         "input": [
          "1 + 3"
         ],
         "language": "python",
         "metadata": {},
         "outputs": [
          {
           "metadata": {},
           "output_type": "pyout",
           "prompt_number": 1,
           "text": [
            "4"
           ]
          }
         ],
         "prompt_number": 1
        }
       ],
       "metadata": {}
      }
     ]
    };

    */

    interface Notebook {

      // Notebook format (major number). Incremented between backwards incompatible changes to the notebook format
      nbformat: number; // === 3 for ipynb v3
      // Notebook format (minor number). Incremented for backward compatible changes to the notebook format
      nbformat_minor: number; // >= 0

      // Original notebook format (major number) before converting the notebook between versions
      orig_nbformat?: number; // >= 1
      // Original notebook format (minor number) before converting the notebook between versions
      orig_nbformat_minor?: number; // >= 0

      // Notebook-level metadata
      //
      // Properties used by IPython currently include:
      //
      // signature: string; // sha256 hash of the notebook content
      //
      // kernel_info: {
      //   name: string; // name/label for the kernel spec
      //   language: string; // e.g. 'python'
      //   codemirror_mode?: string; // which CodeMirror mode to load for the notebook
      // }
      metadata?: any;

      worksheets: Worksheet[];
    }

    interface Worksheet {
      metadata?: any;
      cells: Cell[];
    }

    interface Cell {
      cell_type: string;
      metadata?: any;
    }

    interface CodeCell extends Cell {
      input: string[];
      prompt_number?: number
      collapsed?: boolean;
      language: string;
      outputs: any[];
    }

    interface MarkdownCell extends Cell {
      source: string[];
    }

    interface HeadingCell extends MarkdownCell {
      level: number;
    }

    interface CellOutput {
      output_type: string;
      metadata?: any;
    }

    interface ErrorOutput extends CellOutput {
      ename: string;
      evalue: string;
      traceback: string[];
    }

    interface StreamOutput extends CellOutput {
      stream: string;
      text: string[];
    }

    interface DisplayDataOutput extends CellOutput {
      // One field per supported mime-type
      text?: string[]; // text/plain
      latex?: string[];
      png?: string; // image/png
      jpeg?: string; // image/jpeg
      svg?: string[];
      html?: string[]; // text/html
      javascript?: string[];
      // json?: string[];
      // pdf?: string[];
    }

    interface ExecuteOutput extends DisplayDataOutput {
      prompt_number: number;
    }
  }
}
