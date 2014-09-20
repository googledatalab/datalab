$(function() {
  console.log("IJava profile loaded")

  // load CodeMirror mode for Java
  $.getScript('/static/components/codemirror/mode/clike/clike.js');

  IPython.CodeCell.options_default["cm_config"]["mode"] = "text/x-java";
  IPython.CodeCell.options_default["cm_config"]["lineNumbers"] = true;
  IPython.CodeCell.options_default["cm_config"]["indentUnit"] = 2;
  IPython.CodeCell.options_default["cm_config"]["smartIndent"] = true;
  IPython.CodeCell.options_default["cm_config"]["autoClearEmptyLines"] = true;
});
