// Type definitions for fuzzy
// Project: https://github.com/mattyork/fuzzy
//
// This is not a proper definition; just enough for Datalab to compile.

declare module "fuzzy" {
  interface options {
    pre: string;
    post: string;
    extract: Function
  }
  interface result {
    string: string;
    score: number;
    index: number;
    original: string
  }
	function filter(pattern: string, file_list: string[], options?: options): result[];
}

