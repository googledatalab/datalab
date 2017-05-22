define(() => {
  // constants for minitoolbar operations
  const CELL_METADATA_COLLAPSED = 'hiddenCell';
  const COLLAPSE_BUTTON_CLASS = 'vertical_align_top';
  const UNCOLLAPSE_BUTTON_CLASS = 'vertical_align_bottom';
  const CELL_METADATA_CODE_COLLAPSED = 'codeCollapsed';
  const COLLAPSE_CODE_BUTTON_CLASS = 'code';
  const RUN_CELL_BUTTON_CLASS = 'play_arrow';
  const CLEAR_CELL_BUTTON_CLASS = 'check_box_outline_blank';

  function toggleCollapseCell(cell) {
    isCollapsed = cell.metadata[CELL_METADATA_COLLAPSED] || false;
    if (isCollapsed) {
      uncollapseCell(cell);
    } else {
      collapseCell(cell);
    }
  }

  /**
   * Collapse entire cell
   */
  function collapseCell(cell) {
    if (cell.cell_type !== 'code') {
      // can't collapse markdown cells
      return;
    }

    function getCollapsedCellHeader(cell) {
      dots = '';
      // add dots if the cell has more than one code line
      if (cell.element.find('pre.CodeMirror-line').length > 1)
        dots = '. . .';
      return '<div class="rendered_html">' + cell.element.find('pre.CodeMirror-line')[0].outerHTML + dots + '</div>';
    }

    cell.element.addClass('cellhidden');

    cell.element.find('div.widget-area').hide();
    cell.element.find('div.cellPlaceholder')[0].innerHTML = getCollapsedCellHeader(cell);
    collapseSpan = cell.element.find('.glyph-collapse-cell')[0].innerText = UNCOLLAPSE_BUTTON_CLASS;
    collapseSpan = cell.element.find('.title-collapse-cell')[0].innerText = 'Expand';

    cell.metadata[CELL_METADATA_COLLAPSED] = true;
  }

  /**
   * Uncollapse entire cell
   */
  function uncollapseCell(cell) {
    cell.element.removeClass('cellhidden');

    widgetSubarea = cell.element.find('div.widget-subarea')[0];
    // show the widgets area only if there are widgets in it (has children nodes)
    if (widgetSubarea.children.length > 0)
      cell.element.find('div.widget-area').show();
    cell.element.find('div.cellPlaceholder')[0].innerHTML = '';
    collapseSpan = cell.element.find('.glyph-collapse-cell')[0].innerText = COLLAPSE_BUTTON_CLASS;
    collapseSpan = cell.element.find('.title-collapse-cell')[0].innerText = 'Collapse';

    cell.metadata[CELL_METADATA_COLLAPSED] = false;

    // uncollapse code section as well
    uncollapseCode(cell);
  }

  /**
   * Toggle collapsing the code part of the cell
   */
  function toggleCollapseCode(cell) {
    isCollapsed = cell.metadata[CELL_METADATA_CODE_COLLAPSED] || false;
    if (isCollapsed) {
      uncollapseCode(cell);
    } else {
      collapseCode(cell);
    }
  }

  /**
   * Collapse the code part of the cell
   */
  function collapseCode(cell) {
    if (cell.cell_type !== 'code') {
      // can't collapse code in non-code cells
      return;
    }

    cell.element.addClass('codehidden');
    cell.element.find('span.title-collapse-code')[0].innerText = 'Show Code';
    cell.metadata[CELL_METADATA_CODE_COLLAPSED] = true;
  }

  /**
   * Uncollapse the code part of the cell
   */
  function uncollapseCode(cell) {
    cell.element.removeClass('codehidden');
    cell.element.find('span.title-collapse-code')[0].innerText = 'Hide Code';
    cell.metadata[CELL_METADATA_CODE_COLLAPSED] = false;
  }

  /**
   * Create an HTML button for the cell minitoolbar and return it
   */
  function createCellMiniToolbarButton(description) {
    let buttonLi = document.createElement('li');

    let anchor = document.createElement('a');
    anchor.href = "#";

    // span for button icon
    let glyphElement = document.createElement('i');
    glyphElement.className = 'material-icons' + ' glyph-' + description.id;
    glyphElement.innerText = description.className;
    glyphElement.style.paddingRight = '10px';
    anchor.appendChild(glyphElement);

    // span for button title
    let titleSpan = document.createElement('span');
    titleSpan.innerText = description.title;
    titleSpan.className = 'title-' + description.id;

    anchor.appendChild(titleSpan);
    buttonLi.appendChild(anchor);
    buttonLi.addEventListener('click', description.clickHandler);
    return buttonLi;
  }

  /**
   * Patch the cell's element to add custom UI buttons
   */
  function addCellMiniToolbar(cell) {

    let toolbarDiv = document.createElement('div');
    toolbarDiv.className = 'dropdown minitoolbar';

    let toolbarToggle = document.createElement('button');
    toolbarToggle.className = 'btn btn-default dropdown-toggle minitoolbar-toggle';
    toolbarToggle.setAttribute('data-toggle', 'dropdown');
    toolbarToggle.innerHTML = '<i class="material-icons">menu</i>';
    toolbarDiv.appendChild(toolbarToggle);

    let toolbarButtonList = document.createElement('ul');
    toolbarButtonList.className = 'dropdown-menu';
    toolbarToggle.addEventListener('click', function(e) {
      var parentElement = $(this.parentElement);
      if (parentElement.hasClass('open')) {
        parentElement.removeClass('open');
        e.stopPropagation();
      } else {
        parentElement.addClass('open');
        var offset = parentElement.offset().top;
        var btn = parentElement.find('button')[0];
        var dropDown = parentElement.find('ul')[0];
        var minHeight = offset + btn.clientHeight + dropDown.clientHeight;
        parentElement.removeClass('open');

        // Drop the menu down if the window is tall enough for the offset of the menu
        // + height of menu + 10 pixel buffer space. Otherwise drop up
        if ($(window).height() > minHeight + 10) {
          parentElement.addClass('dropdown');
          parentElement.removeClass('dropup');
        } else {
          parentElement.addClass('dropup');
          parentElement.removeClass('dropdown');
        }
      }
    });
    toolbarDiv.appendChild(toolbarButtonList);


    minitoolbarButtons = [
      // run cell
      {
        id: 'run-cell',
        title: 'Run',
        className: RUN_CELL_BUTTON_CLASS,
        clickHandler: function() {
          cell.execute();
        }
      },
      // clear cell
      {
        id: 'clear-cell',
        title: 'Clear',
        className: CLEAR_CELL_BUTTON_CLASS,
        clickHandler: function() {
          cell.clear_output();
        }
      },
      // collapse cell
      {
        id: 'collapse-cell',
        title: 'Collapse',
        className: COLLAPSE_BUTTON_CLASS,
        clickHandler: function() {
          toggleCollapseCell(cell);
        }
      },
      // collapse code
      {
        id: 'collapse-code',
        title: 'Hide Code',
        className: COLLAPSE_CODE_BUTTON_CLASS,
        clickHandler: function() {
          toggleCollapseCode(cell);
        }
      }
    ];

    // cell collapse placeholder
    let placeholderDiv = document.createElement('div');
    placeholderDiv.className = 'cellPlaceholder btn btn-default';
    placeholderDiv.title = 'Uncollapse cell';
    placeholderDiv.addEventListener('click', function() {
      uncollapseCell(cell);
    });
    cell.element.append(placeholderDiv);

    minitoolbarButtons.forEach(button => {
      buttonHtml = createCellMiniToolbarButton(button);
      toolbarButtonList.appendChild(buttonHtml);
    });

    // add the minitoolbar to the cell
    cell.element.prepend(toolbarDiv);

    // collapse cells according to their saved metadata if any
    if (CELL_METADATA_COLLAPSED in cell.metadata && cell.metadata[CELL_METADATA_COLLAPSED] === true) {
      collapseCell(cell);
    }

    // collapse cell code according to their saved metadata if any
    if (CELL_METADATA_CODE_COLLAPSED in cell.metadata && cell.metadata[CELL_METADATA_CODE_COLLAPSED] === true) {
      collapseCode(cell);
    }
  }

  return {
    addCellMiniToolbar: addCellMiniToolbar
  };
});
