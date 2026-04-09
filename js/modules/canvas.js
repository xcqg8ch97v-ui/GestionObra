/* ========================================
   Canvas Module - Mesa de Trabajo
   Fabric.js Whiteboard con redlines, flechas y post-its
   ======================================== */

const CanvasModule = (() => {
  let canvas = null;
  let currentTool = 'select';
  let isDrawingArrow = false;
  let arrowStart = null;
  let projectId = null;

  // Undo history
  const history = [];
  const MAX_HISTORY = 50;
  let historyLocked = false;

  function saveHistory() {
    if (historyLocked) return;
    history.push(JSON.stringify(canvas.toJSON(['_isAttachedFile','_attachedFileId','_attachedFileName'])));
    if (history.length > MAX_HISTORY) history.shift();
  }

  function undo() {
    if (history.length === 0) return;
    historyLocked = true;
    const prev = history.pop();
    canvas.loadFromJSON(prev, () => {
      reattachFileHandlers();
      canvas.requestRenderAll();
      historyLocked = false;
    });
  }

  function init(pid) {
    projectId = pid;
    // Clean up previous tables
    tables = [];
    clearTableDOM();
    selectedTableId = null;
    setupCanvas();
    setupToolbar();
    setupTextToolbar();
    setupTableToolbar();
    setupFileUpload();
    setupFileAttach();
    loadSavedState();
  }

  function setupCanvas() {
    const container = document.querySelector('.canvas-container');
    const rect = container.getBoundingClientRect();

    canvas = new fabric.Canvas('fabric-canvas', {
      width: rect.width,
      height: rect.height,
      backgroundColor: '#1a1a2e',
      selection: true,
      preserveObjectStacking: true
    });

    // Grid pattern
    drawGrid();

    // Mouse wheel zoom
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.min(Math.max(zoom, 0.1), 5);
      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      updateZoomDisplay();
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Pan with middle mouse or alt+drag
    let isPanning = false;
    let lastPosX, lastPosY;

    canvas.on('mouse:down', (opt) => {
      if (opt.e.altKey || opt.e.button === 1 || currentTool === 'hand') {
        isPanning = true;
        lastPosX = opt.e.clientX;
        lastPosY = opt.e.clientY;
        canvas.selection = false;
        return;
      }

      if (currentTool === 'arrow' && !isDrawingArrow) {
        isDrawingArrow = true;
        const pointer = canvas.getPointer(opt.e);
        arrowStart = { x: pointer.x, y: pointer.y };
      }

      if (currentTool === 'postit') {
        const pointer = canvas.getPointer(opt.e);
        addPostIt(pointer.x, pointer.y);
        setTool('select');
      }

      if (currentTool === 'text') {
        const pointer = canvas.getPointer(opt.e);
        addText(pointer.x, pointer.y);
        setTool('select');
      }

      if (currentTool === 'table') {
        addTable(opt.e.clientX, opt.e.clientY);
        setTool('select');
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (isPanning) {
        const vpt = canvas.viewportTransform;
        vpt[4] += opt.e.clientX - lastPosX;
        vpt[5] += opt.e.clientY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = opt.e.clientX;
        lastPosY = opt.e.clientY;
      }
    });

    canvas.on('mouse:up', (opt) => {
      if (isPanning) {
        isPanning = false;
        canvas.selection = currentTool === 'select';
        canvas.setViewportTransform(canvas.viewportTransform);
        if (currentTool === 'hand') {
          canvas.defaultCursor = 'grab';
        }
        return;
      }

      if (currentTool === 'arrow' && isDrawingArrow) {
        const pointer = canvas.getPointer(opt.e);
        addArrow(arrowStart.x, arrowStart.y, pointer.x, pointer.y);
        isDrawingArrow = false;
        arrowStart = null;
      }
    });

    // Delete key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement.tagName === 'INPUT' || 
            document.activeElement.tagName === 'TEXTAREA' ||
            document.activeElement.tagName === 'SELECT') return;
        
        const active = canvas.getActiveObjects();
        if (active.length) {
          active.forEach(obj => canvas.remove(obj));
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }
    });

    // Track history for undo
    canvas.on('object:added', () => saveHistory());
    canvas.on('object:modified', () => saveHistory());
    canvas.on('object:removed', () => saveHistory());

    // Ctrl+Z undo
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA') return;
        e.preventDefault();
        undo();
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
  }

  function drawGrid() {
    // Lightweight grid via pattern — doesn't add objects
    const gridSize = 30;
    const gridColor = 'rgba(255,255,255,0.03)';
    
    for (let i = 0; i < 3000; i += gridSize) {
      canvas.add(new fabric.Line([i, 0, i, 3000], {
        stroke: gridColor, selectable: false, evented: false, excludeFromExport: true
      }));
      canvas.add(new fabric.Line([0, i, 3000, i], {
        stroke: gridColor, selectable: false, evented: false, excludeFromExport: true
      }));
    }
  }

  function setupToolbar() {
    // Tool buttons
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => setTool(btn.dataset.tool));
    });

    // Canvas actions
    document.getElementById('btn-clear-canvas').addEventListener('click', () => {
      if (confirm('¿Limpiar toda la mesa de trabajo?')) {
        canvas.clear();
        canvas.backgroundColor = '#1a1a2e';
        drawGrid();
        canvas.requestRenderAll();
        // Clear HTML tables too
        tables = [];
        clearTableDOM();
        deselectTable();
        App.toast('Mesa de trabajo limpiada', 'info');
      }
    });

    document.getElementById('btn-save-canvas').addEventListener('click', saveState);
    document.getElementById('btn-export-canvas').addEventListener('click', exportCanvas);

    // Zoom
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      const zoom = Math.min(canvas.getZoom() * 1.2, 5);
      canvas.setZoom(zoom);
      updateZoomDisplay();
    });

    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      const zoom = Math.max(canvas.getZoom() / 1.2, 0.1);
      canvas.setZoom(zoom);
      updateZoomDisplay();
    });

    document.getElementById('btn-zoom-fit').addEventListener('click', () => {
      canvas.setZoom(1);
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      updateZoomDisplay();
    });

    // Undo button
    document.getElementById('btn-undo').addEventListener('click', () => undo());

    // Draw color / width — also apply to selected objects
    document.getElementById('draw-color').addEventListener('change', (e) => {
      const color = e.target.value;
      if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush.color = color;
      }
      // Apply color to selected objects
      const active = canvas.getActiveObjects();
      if (active.length) {
        active.forEach(obj => {
          if (obj.type === 'i-text' || obj.type === 'text') {
            obj.set('fill', color);
          } else if (obj.type === 'path') {
            obj.set('stroke', color);
          } else if (obj.type === 'line') {
            obj.set('stroke', color);
          } else if (obj.type === 'group') {
            obj.getObjects().forEach(child => {
              if (child.type === 'line') child.set('stroke', color);
              else if (child.type === 'triangle') child.set('fill', color);
              else if (child.type === 'rect') child.set('fill', color);
            });
          } else {
            if (obj.fill && obj.fill !== 'transparent') obj.set('fill', color);
            if (obj.stroke) obj.set('stroke', color);
          }
        });
        canvas.requestRenderAll();
      }
    });

    document.getElementById('draw-width').addEventListener('change', (e) => {
      if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush.width = parseInt(e.target.value);
      }
    });
  }

  function setTool(tool) {
    currentTool = tool;

    // Update active button
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-tool="${tool}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Configure canvas mode
    canvas.isDrawingMode = tool === 'draw';
    canvas.selection = tool === 'select';

    // In hand mode, make all objects non-selectable
    if (tool === 'hand') {
      canvas.forEachObject(o => { o.selectable = false; o.evented = false; });
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    } else {
      canvas.forEachObject(o => { o.selectable = true; o.evented = true; });
    }

    if (tool === 'draw') {
      const color = document.getElementById('draw-color').value;
      const width = parseInt(document.getElementById('draw-width').value);
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = width;
      canvas.freeDrawingBrush.decimate = 5;
    }

    // Change cursor
    if (tool === 'hand') {
      canvas.defaultCursor = 'grab';
      canvas.hoverCursor = 'grab';
    } else if (tool === 'postit' || tool === 'text' || tool === 'table') {
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'move';
    } else if (tool === 'arrow') {
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'move';
    } else {
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
    }
  }

  function addArrow(x1, y1, x2, y2) {
    const color = document.getElementById('draw-color').value;
    const width = parseInt(document.getElementById('draw-width').value);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const headLen = 15;

    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: color,
      strokeWidth: width,
      selectable: true,
      evented: true
    });

    const head = new fabric.Triangle({
      left: x2,
      top: y2,
      angle: (angle * 180 / Math.PI) + 90,
      width: headLen,
      height: headLen,
      fill: color,
      selectable: false,
      evented: false,
      originX: 'center',
      originY: 'center'
    });

    const group = new fabric.Group([line, head], {
      selectable: true,
      evented: true
    });

    canvas.add(group);
    canvas.requestRenderAll();
  }

  function addPostIt(x, y) {
    const colors = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FED7AA'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const rect = new fabric.Rect({
      width: 160,
      height: 120,
      fill: color,
      rx: 4,
      ry: 4,
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.3)', blur: 8, offsetX: 2, offsetY: 2 })
    });

    const text = new fabric.IText('Nota...', {
      fontSize: 13,
      fontFamily: 'Inter, sans-serif',
      fill: '#1E293B',
      left: 10,
      top: 10,
      width: 140,
      editable: true
    });

    const group = new fabric.Group([rect, text], {
      left: x - 80,
      top: y - 60,
      selectable: true,
      subTargetCheck: true
    });

    // Allow editing text on double click
    group.on('mousedblclick', () => {
      group.toActiveSelection();
      canvas.setActiveObject(text);
      text.enterEditing();
      canvas.requestRenderAll();
    });

    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
  }

  function addText(x, y) {
    const color = document.getElementById('draw-color').value;
    const text = new fabric.IText('Texto', {
      left: x,
      top: y,
      fontSize: 16,
      fontFamily: 'Inter, sans-serif',
      fill: color,
      editable: true
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    canvas.requestRenderAll();
  }

  // ========================================
  // TABLE SYSTEM (HTML Overlay)
  // ========================================

  let tables = [];
  let selectedTableId = null;

  function addTable(clientX, clientY) {
    const container = document.querySelector('.canvas-container');
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const id = 'tbl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const data = [
      ['Col 1', 'Col 2', 'Col 3'],
      ['', '', ''],
      ['', '', ''],
      ['', '', '']
    ];
    const table = { id, x, y, data };
    tables.push(table);
    renderHTMLTable(table);
    selectTable(id);
  }

  function renderHTMLTable(table) {
    const existing = document.getElementById(table.id);
    if (existing) existing.remove();

    const container = document.querySelector('.canvas-container');
    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-table-wrapper';
    wrapper.id = table.id;
    wrapper.style.left = table.x + 'px';
    wrapper.style.top = table.y + 'px';

    const cols = table.data[0].length;
    let html = '<div class="canvas-table-handle" title="Arrastrar">⠿</div>';
    html += '<table class="canvas-table"><thead><tr>';
    table.data[0].forEach((cell, ci) => {
      html += `<th contenteditable="true" data-row="0" data-col="${ci}">${escHTMLTbl(cell)}</th>`;
    });
    html += '</tr></thead><tbody>';
    for (let ri = 1; ri < table.data.length; ri++) {
      html += '<tr>';
      table.data[ri].forEach((cell, ci) => {
        html += `<td contenteditable="true" data-row="${ri}" data-col="${ci}">${escHTMLTbl(cell)}</td>`;
      });
      html += '</tr>';
    }
    html += '</tbody></table>';
    wrapper.innerHTML = html;
    container.appendChild(wrapper);

    // Click to select (don't propagate to canvas)
    wrapper.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      selectTable(table.id);
    });

    // Tab navigation between cells
    wrapper.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const cell = e.target.closest('th, td');
        if (!cell) return;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const numCols = table.data[0].length;
        const numRows = table.data.length;
        let nr, nc;
        if (e.shiftKey) {
          nc = col - 1; nr = row;
          if (nc < 0) { nc = numCols - 1; nr--; }
          if (nr < 0) nr = numRows - 1;
        } else {
          nc = col + 1; nr = row;
          if (nc >= numCols) { nc = 0; nr++; }
          if (nr >= numRows) nr = 0;
        }
        const next = wrapper.querySelector(`[data-row="${nr}"][data-col="${nc}"]`);
        if (next) { next.focus(); selectCellContent(next); }
      }
      // Enter moves to cell below
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const cell = e.target.closest('th, td');
        if (!cell) return;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const nr = (row + 1) % table.data.length;
        const next = wrapper.querySelector(`[data-row="${nr}"][data-col="${col}"]`);
        if (next) { next.focus(); selectCellContent(next); }
      }
    });

    // Sync edits to data model
    wrapper.querySelectorAll('th, td').forEach(cell => {
      cell.addEventListener('input', () => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        if (table.data[r]) table.data[r][c] = cell.textContent;
      });
    });

    setupTableDrag(wrapper, table);
  }

  function escHTMLTbl(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function selectCellContent(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function setupTableDrag(wrapper, table) {
    const handle = wrapper.querySelector('.canvas-table-handle');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(wrapper.style.left) || 0;
      startTop = parseInt(wrapper.style.top) || 0;
      e.preventDefault();
      e.stopPropagation();
    });

    const onMove = (e) => {
      if (!isDragging) return;
      wrapper.style.left = (startLeft + e.clientX - startX) + 'px';
      wrapper.style.top = (startTop + e.clientY - startY) + 'px';
      table.x = startLeft + e.clientX - startX;
      table.y = startTop + e.clientY - startY;
      positionTableToolbar();
    };

    const onUp = () => { isDragging = false; };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function selectTable(id) {
    document.querySelectorAll('.canvas-table-wrapper.selected').forEach(w => w.classList.remove('selected'));
    selectedTableId = id;
    const wrapper = document.getElementById(id);
    if (wrapper) {
      wrapper.classList.add('selected');
      showTableToolbar();
    }
  }

  function deselectTable() {
    document.querySelectorAll('.canvas-table-wrapper.selected').forEach(w => w.classList.remove('selected'));
    selectedTableId = null;
    hideTableToolbar();
  }

  function getSelectedTableData() {
    return tables.find(t => t.id === selectedTableId) || null;
  }

  function tableAddRow() {
    const table = getSelectedTableData(); if (!table) return;
    table.data.push(Array(table.data[0].length).fill(''));
    renderHTMLTable(table); selectTable(table.id);
  }

  function tableAddCol() {
    const table = getSelectedTableData(); if (!table) return;
    table.data.forEach((row, i) => row.push(i === 0 ? `Col ${row.length + 1}` : ''));
    renderHTMLTable(table); selectTable(table.id);
  }

  function tableRemoveRow() {
    const table = getSelectedTableData(); if (!table) return;
    if (table.data.length <= 2) { App.toast('Mínimo 2 filas', 'warning'); return; }
    table.data.pop();
    renderHTMLTable(table); selectTable(table.id);
  }

  function tableRemoveCol() {
    const table = getSelectedTableData(); if (!table) return;
    if (table.data[0].length <= 1) { App.toast('Mínimo 1 columna', 'warning'); return; }
    table.data.forEach(row => row.pop());
    renderHTMLTable(table); selectTable(table.id);
  }

  function tableDeleteSelected() {
    const table = getSelectedTableData(); if (!table) return;
    if (!confirm('¿Eliminar esta tabla?')) return;
    const el = document.getElementById(table.id);
    if (el) el.remove();
    tables = tables.filter(t => t.id !== table.id);
    deselectTable();
  }

  // --- Table Toolbar ---
  function setupTableToolbar() {
    const toolbar = document.getElementById('table-edit-toolbar');
    if (!toolbar) return;

    document.getElementById('tbl-add-row').addEventListener('click', tableAddRow);
    document.getElementById('tbl-add-col').addEventListener('click', tableAddCol);
    document.getElementById('tbl-del-row').addEventListener('click', tableRemoveRow);
    document.getElementById('tbl-del-col').addEventListener('click', tableRemoveCol);
    document.getElementById('tbl-delete').addEventListener('click', tableDeleteSelected);

    // Deselect when clicking on canvas area (not on a table or toolbar)
    document.querySelector('.canvas-container').addEventListener('mousedown', (e) => {
      if (!e.target.closest('.canvas-table-wrapper') && !e.target.closest('#table-edit-toolbar')) {
        deselectTable();
      }
    });
  }

  function showTableToolbar() {
    const toolbar = document.getElementById('table-edit-toolbar');
    const table = getSelectedTableData();
    if (!toolbar || !table) return;
    toolbar.classList.add('visible');
    const info = toolbar.querySelector('.tbl-info');
    if (info) info.textContent = `${table.data.length}×${table.data[0].length}`;
    positionTableToolbar();
  }

  function hideTableToolbar() {
    const toolbar = document.getElementById('table-edit-toolbar');
    if (toolbar) toolbar.classList.remove('visible');
  }

  function positionTableToolbar() {
    const toolbar = document.getElementById('table-edit-toolbar');
    const table = getSelectedTableData();
    if (!toolbar || !table) return;
    const wrapper = document.getElementById(table.id);
    if (!wrapper) return;
    const wRect = wrapper.getBoundingClientRect();
    const cRect = document.querySelector('.canvas-container').getBoundingClientRect();
    toolbar.style.left = (wRect.left - cRect.left + wRect.width / 2) + 'px';
    toolbar.style.top = (wRect.top - cRect.top + wRect.height + 8) + 'px';
  }

  // Sync all table DOM content to data model
  function syncAllTableData() {
    tables.forEach(table => {
      const wrapper = document.getElementById(table.id);
      if (!wrapper) return;
      wrapper.querySelectorAll('th, td').forEach(cell => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        if (table.data[r]) table.data[r][c] = cell.textContent;
      });
    });
  }

  // Remove all table DOM elements
  function clearTableDOM() {
    document.querySelectorAll('.canvas-table-wrapper').forEach(el => el.remove());
  }

  // Render all tables from data
  function renderAllTables() {
    clearTableDOM();
    tables.forEach(t => renderHTMLTable(t));
  }

  // ========================================
  // TEXT FORMATTING TOOLBAR
  // ========================================

  function setupTextToolbar() {
    const toolbar = document.getElementById('text-format-toolbar');
    if (!toolbar) return;

    // Show/hide toolbar on text selection
    canvas.on('selection:created', (e) => showTextToolbar(e.selected));
    canvas.on('selection:updated', (e) => showTextToolbar(e.selected));
    canvas.on('selection:cleared', () => hideTextToolbar());

    // Update toolbar position when object moves
    canvas.on('object:moving', () => {
      const active = canvas.getActiveObject();
      if (active && (active.type === 'i-text' || active.type === 'textbox')) {
        positionTextToolbar(active);
      }
    });

    // Bold
    document.getElementById('txt-bold').addEventListener('click', () => {
      toggleSelectionStyle('fontWeight', 'bold', 'normal');
    });

    // Italic
    document.getElementById('txt-italic').addEventListener('click', () => {
      toggleSelectionStyle('fontStyle', 'italic', 'normal');
    });

    // Underline
    document.getElementById('txt-underline').addEventListener('click', () => {
      toggleSelectionStyle('underline', true, false);
    });

    // Strikethrough
    document.getElementById('txt-strike').addEventListener('click', () => {
      toggleSelectionStyle('linethrough', true, false);
    });

    // Font size
    document.getElementById('txt-font-size').addEventListener('change', (e) => {
      const size = parseInt(e.target.value);
      const obj = canvas.getActiveObject();
      if (!obj || (obj.type !== 'i-text' && obj.type !== 'textbox')) return;

      if (obj.selectionStart !== obj.selectionEnd) {
        obj.setSelectionStyles({ fontSize: size });
      } else {
        obj.set('fontSize', size);
      }
      canvas.requestRenderAll();
    });

    // Bullet toggle
    document.getElementById('txt-bullet').addEventListener('click', () => {
      const obj = canvas.getActiveObject();
      if (!obj || (obj.type !== 'i-text' && obj.type !== 'textbox')) return;

      const lines = obj.text.split('\n');
      const cursorLine = obj.text.substring(0, obj.selectionStart).split('\n').length - 1;

      if (lines[cursorLine].startsWith('• ')) {
        lines[cursorLine] = lines[cursorLine].substring(2);
      } else {
        lines[cursorLine] = '• ' + lines[cursorLine];
      }

      const newText = lines.join('\n');
      obj.set('text', newText);
      canvas.requestRenderAll();
    });

    // Numbered list toggle
    document.getElementById('txt-numbered').addEventListener('click', () => {
      const obj = canvas.getActiveObject();
      if (!obj || (obj.type !== 'i-text' && obj.type !== 'textbox')) return;

      const lines = obj.text.split('\n');
      const cursorLine = obj.text.substring(0, obj.selectionStart).split('\n').length - 1;

      const numMatch = lines[cursorLine].match(/^\d+\.\s/);
      if (numMatch) {
        lines[cursorLine] = lines[cursorLine].substring(numMatch[0].length);
      } else {
        // Find the next number based on previous lines
        let num = 1;
        for (let i = cursorLine - 1; i >= 0; i--) {
          const m = lines[i].match(/^(\d+)\.\s/);
          if (m) { num = parseInt(m[1]) + 1; break; }
        }
        lines[cursorLine] = num + '. ' + lines[cursorLine];
      }

      obj.set('text', lines.join('\n'));
      canvas.requestRenderAll();
    });
  }

  function toggleSelectionStyle(prop, activeVal, defaultVal) {
    const obj = canvas.getActiveObject();
    if (!obj || (obj.type !== 'i-text' && obj.type !== 'textbox')) return;

    if (obj.selectionStart !== obj.selectionEnd) {
      // Apply to selection
      const styles = obj.getSelectionStyles(obj.selectionStart, obj.selectionEnd);
      const allActive = styles.every(s => s[prop] === activeVal);
      const val = allActive ? defaultVal : activeVal;
      obj.setSelectionStyles({ [prop]: val });
    } else {
      // Apply to whole object
      const current = obj.get(prop);
      obj.set(prop, current === activeVal ? defaultVal : activeVal);
    }
    canvas.requestRenderAll();
    updateTextToolbarState(obj);
  }

  function showTextToolbar(selected) {
    const toolbar = document.getElementById('text-format-toolbar');
    if (!selected || selected.length !== 1) { hideTextToolbar(); return; }

    const obj = selected[0];
    if (obj.type !== 'i-text' && obj.type !== 'textbox') { hideTextToolbar(); return; }

    toolbar.classList.add('visible');
    positionTextToolbar(obj);
    updateTextToolbarState(obj);
  }

  function hideTextToolbar() {
    const toolbar = document.getElementById('text-format-toolbar');
    if (toolbar) toolbar.classList.remove('visible');
  }

  function positionTextToolbar(obj) {
    const toolbar = document.getElementById('text-format-toolbar');
    if (!toolbar) return;

    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform;
    const bound = obj.getBoundingRect();

    const left = bound.left + bound.width / 2;
    const top = bound.top - 10;

    toolbar.style.left = left + 'px';
    toolbar.style.top = top + 'px';
  }

  function updateTextToolbarState(obj) {
    if (!obj) return;
    const bold = obj.fontWeight === 'bold';
    const italic = obj.fontStyle === 'italic';
    const underline = obj.underline;
    const strike = obj.linethrough;

    document.getElementById('txt-bold').classList.toggle('active', bold);
    document.getElementById('txt-italic').classList.toggle('active', italic);
    document.getElementById('txt-underline').classList.toggle('active', underline);
    document.getElementById('txt-strike').classList.toggle('active', strike);
    document.getElementById('txt-font-size').value = obj.fontSize || 16;
  }

  function setupFileUpload() {
    const uploadBtn = document.getElementById('btn-upload-plan');
    const fileInput = document.getElementById('plan-upload');

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        fabric.Image.fromURL(event.target.result, (img) => {
          // Scale image to fit canvas
          const maxW = canvas.width * 0.8;
          const maxH = canvas.height * 0.8;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);

          img.set({
            scaleX: scale,
            scaleY: scale,
            left: (canvas.width - img.width * scale) / 2,
            top: (canvas.height - img.height * scale) / 2
          });

          canvas.add(img);
          canvas.sendToBack(img);
          canvas.requestRenderAll();
          App.toast('Plano cargado correctamente', 'success');
        });
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });
  }

  // ========================================
  // FILE ATTACHMENT ON CANVAS
  // ========================================

  function setupFileAttach() {
    const btn = document.getElementById('btn-attach-file');
    const input = document.getElementById('canvas-file-attach');
    if (!btn || !input) return;

    btn.addEventListener('click', () => input.click());

    input.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 50 * 1024 * 1024) {
          App.toast(`${file.name} excede 50MB`, 'warning');
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        const record = {
          projectId,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data: arrayBuffer,
          uploadedAt: new Date().toISOString()
        };
        const fileId = await DB.add('files', record);

        addFileIcon(fileId, file.name, file.type, centerX + i * 30, centerY + i * 30);
      }

      App.toast(`${files.length} archivo(s) adjuntado(s)`, 'success');
      input.value = '';
    });
  }

  // Map file MIME type to an emoji icon
  function getFileEmoji(mime) {
    if (!mime) return '📄';
    if (mime === 'application/pdf') return '📕';
    if (mime.startsWith('image/')) return '🖼️';
    if (mime.includes('word')) return '📝';
    if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊';
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('compress')) return '📦';
    if (mime.includes('text')) return '📃';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return '📐';
    return '📄';
  }

  function addFileIcon(fileId, fileName, mimeType, x, y) {
    const emoji = getFileEmoji(mimeType);

    const icon = new fabric.Text(emoji, {
      fontSize: 36,
      originX: 'center',
      originY: 'bottom',
      selectable: false,
      evented: false
    });

    // Truncate long filenames
    const displayName = fileName.length > 22 ? fileName.substring(0, 19) + '...' : fileName;

    const label = new fabric.Text(displayName, {
      fontSize: 11,
      fontFamily: 'Inter, sans-serif',
      fill: '#CBD5E1',
      textAlign: 'center',
      originX: 'center',
      originY: 'top',
      selectable: false,
      evented: false
    });

    const bg = new fabric.Rect({
      width: 110,
      height: 72,
      fill: 'rgba(30,41,59,0.85)',
      rx: 8,
      ry: 8,
      stroke: '#334155',
      strokeWidth: 1,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    });

    const group = new fabric.Group([bg, icon, label], {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      selectable: true,
      hasControls: false,
      hasBorders: true,
      lockScalingX: true,
      lockScalingY: true,
      _isAttachedFile: true,
      _attachedFileId: fileId,
      _attachedFileName: fileName
    });

    // Position icon and label within group
    icon.set({ left: 0, top: -8 });
    label.set({ left: 0, top: 10 });

    // Double-click to download
    group.on('mousedblclick', () => downloadAttachedFile(fileId, fileName));

    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
  }

  async function downloadAttachedFile(fileId, fallbackName) {
    const file = await DB.getById('files', fileId);
    if (!file) {
      App.toast('Archivo no encontrado', 'error');
      return;
    }
    const blob = new Blob([file.data], { type: file.type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name || fallbackName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function reattachFileHandlers() {
    canvas.getObjects().forEach(obj => {
      if (obj._isAttachedFile && obj._attachedFileId) {
        obj.set({ hasControls: false, lockScalingX: true, lockScalingY: true });
        obj.on('mousedblclick', () => downloadAttachedFile(obj._attachedFileId, obj._attachedFileName));
      }
    });
  }

  async function saveState() {
    const json = canvas.toJSON(['_isAttachedFile','_attachedFileId','_attachedFileName']);
    syncAllTableData();
    const payload = {
      canvas: json,
      tables: tables.map(t => ({ id: t.id, x: t.x, y: t.y, data: t.data }))
    };
    await DB.saveCanvasState(projectId, payload);
    App.toast('Mesa de trabajo guardada', 'success');
  }

  async function loadSavedState() {
    const state = await DB.getCanvasState(projectId);
    if (state && state.data) {
      // Support both old format (plain canvas JSON) and new format ({ canvas, tables })
      if (state.data.canvas) {
        canvas.loadFromJSON(state.data.canvas, () => {
          reattachFileHandlers();
          canvas.requestRenderAll();
        });
        tables = (state.data.tables || []).map(t => ({ ...t }));
        renderAllTables();
      } else {
        canvas.loadFromJSON(state.data, () => {
          reattachFileHandlers();
          canvas.requestRenderAll();
        });
      }
    }
  }

  function exportCanvas() {
    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2
    });
    const link = document.createElement('a');
    link.download = `mesa-trabajo-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataURL;
    link.click();
    App.toast('Imagen exportada', 'success');
  }

  function updateZoomDisplay() {
    document.getElementById('zoom-level').textContent = Math.round(canvas.getZoom() * 100) + '%';
  }

  function resize() {
    const container = document.querySelector('.canvas-container');
    if (!container || !canvas) return;
    const rect = container.getBoundingClientRect();
    canvas.setWidth(rect.width);
    canvas.setHeight(rect.height);
    canvas.requestRenderAll();
  }

  return { init, resize };
})();
