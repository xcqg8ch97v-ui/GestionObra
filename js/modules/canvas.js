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

  // Multi-sheet support
  let sheets = []; // [{ id, name }]
  let currentSheetId = null;

  // Undo history
  const history = [];
  const MAX_HISTORY = 50;
  let historyLocked = false;
  let initialized = false;

  // Store references for cleanup
  let keydownHandler = null;
  let undoHandler = null;
  let resizeObserver = null;

  function saveHistory() {
    if (historyLocked) return;
    history.push(JSON.stringify(canvas.toJSON(['_isAttachedFile','_attachedFileId','_attachedFileName','_isImagePreview'])));
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

  async function init(pid) {
    projectId = pid;
    // Clean up previous canvas instance
    if (canvas) {
      canvas.dispose();
      canvas = null;
    }
    // Remove old global event listeners
    if (keydownHandler) document.removeEventListener('keydown', keydownHandler);
    if (undoHandler) document.removeEventListener('keydown', undoHandler);
    if (resizeObserver) resizeObserver.disconnect();

    // Clean up previous tables
    tables = [];
    clearTableDOM();
    selectedTableId = null;
    history.length = 0;
    historyLocked = false;

    setupCanvas();
    if (!initialized) {
      setupToolbar();
      setupTextToolbar();
      setupTableToolbar();
      setupFileUpload();
      setupFileAttach();
      setupSheetTabs();
      initialized = true;
    }

    // Load sheet index (or migrate from legacy single-sheet)
    const idx = await DB.getSheetIndex(projectId);
    if (idx && idx.sheets && idx.sheets.length > 0) {
      sheets = idx.sheets;
    } else {
      // First time or legacy: create default sheet
      const defaultId = 'sheet_' + Date.now();
      sheets = [{ id: defaultId, name: 'Hoja 1' }];
      // Migrate legacy data if exists
      const legacy = await DB.getCanvasState(projectId);
      if (legacy && legacy.data) {
        await DB.saveCanvasState(projectId, legacy.data, defaultId);
      }
      await DB.saveSheetIndex(projectId, sheets);
    }

    currentSheetId = sheets[0].id;
    renderSheetTabs();
    await loadSavedState();
  }

  function setupCanvas() {
    const container = document.querySelector('.canvas-container');
    const rect = container.getBoundingClientRect();

    // Ensure clean canvas element exists (Fabric.js dispose removes it)
    let canvasEl = document.getElementById('fabric-canvas');
    if (!canvasEl) {
      canvasEl = document.createElement('canvas');
      canvasEl.id = 'fabric-canvas';
      container.insertBefore(canvasEl, container.firstChild);
    }

    canvas = new fabric.Canvas('fabric-canvas', {
      width: rect.width,
      height: rect.height,
      backgroundColor: '#1a1a2e',
      selection: true,
      preserveObjectStacking: true,
      allowTouchScrolling: false
    });

    // Grid pattern
    drawGrid();

    // --- Pinch-to-zoom & two-finger pan (touch) ---
    let touchState = { active: false, dist: 0, midX: 0, midY: 0, zoom: 1, vpX: 0, vpY: 0 };

    const upperCanvas = container.querySelector('.upper-canvas') || canvas.upperCanvasEl;
    if (upperCanvas) {
      upperCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const t = e.touches;
          touchState.active = true;
          touchState.dist = Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
          const cRect = container.getBoundingClientRect();
          touchState.midX = (t[0].clientX + t[1].clientX) / 2 - cRect.left;
          touchState.midY = (t[0].clientY + t[1].clientY) / 2 - cRect.top;
          touchState.zoom = canvas.getZoom();
          touchState.vpX = canvas.viewportTransform[4];
          touchState.vpY = canvas.viewportTransform[5];
          canvas.selection = false;
        }
      }, { passive: false });

      upperCanvas.addEventListener('touchmove', (e) => {
        if (touchState.active && e.touches.length === 2) {
          e.preventDefault();
          const t = e.touches;
          const newDist = Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
          const scale = newDist / touchState.dist;
          let newZoom = Math.min(Math.max(touchState.zoom * scale, 0.1), 5);
          canvas.zoomToPoint({ x: touchState.midX, y: touchState.midY }, newZoom);

          // Pan offset
          const cRect = container.getBoundingClientRect();
          const curMidX = (t[0].clientX + t[1].clientX) / 2 - cRect.left;
          const curMidY = (t[0].clientY + t[1].clientY) / 2 - cRect.top;
          const vpt = canvas.viewportTransform;
          vpt[4] += curMidX - touchState.midX;
          vpt[5] += curMidY - touchState.midY;
          touchState.midX = curMidX;
          touchState.midY = curMidY;

          canvas.requestRenderAll();
          updateZoomDisplay();
        }
      }, { passive: false });

      upperCanvas.addEventListener('touchend', (e) => {
        if (touchState.active && e.touches.length < 2) {
          touchState.active = false;
          canvas.selection = currentTool === 'select';
          canvas.setViewportTransform(canvas.viewportTransform);
        }
      });
    }

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

    // Pan with middle mouse or alt+drag or single-finger on hand tool
    let isPanning = false;
    let lastPosX, lastPosY;

    canvas.on('mouse:down', (opt) => {
      const e = opt.e;
      const isTouchPan = e.type === 'touchstart' && currentTool === 'hand';
      if (e.altKey || e.button === 1 || currentTool === 'hand' || isTouchPan) {
        isPanning = true;
        const p = e.touches ? e.touches[0] : e;
        lastPosX = p.clientX;
        lastPosY = p.clientY;
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
        const p = opt.e.touches ? opt.e.touches[0] || opt.e.changedTouches[0] : opt.e;
        addTable(p.clientX, p.clientY);
        setTool('select');
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (isPanning) {
        const e = opt.e;
        const p = e.touches ? e.touches[0] : e;
        const vpt = canvas.viewportTransform;
        vpt[4] += p.clientX - lastPosX;
        vpt[5] += p.clientY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = p.clientX;
        lastPosY = p.clientY;
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
    keydownHandler = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement.tagName === 'INPUT' || 
            document.activeElement.tagName === 'TEXTAREA' ||
            document.activeElement.tagName === 'SELECT' ||
            document.activeElement.isContentEditable) return;
        
        const active = canvas.getActiveObjects();
        if (active.length) {
          active.forEach(obj => canvas.remove(obj));
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }
    };
    document.addEventListener('keydown', keydownHandler);

    // Track history for undo
    canvas.on('object:added', () => saveHistory());
    canvas.on('object:modified', () => saveHistory());
    canvas.on('object:removed', () => saveHistory());

    // Ctrl+Z undo
    undoHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA') return;
        e.preventDefault();
        undo();
      }
    };
    document.addEventListener('keydown', undoHandler);

    // Resize observer
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);

    // Right-click on canvas objects (attached files)
    canvas.on('mouse:down', (opt) => {
      if (opt.e.button === 2) {
        const target = canvas.findTarget(opt.e, false);
        if (target && target._isAttachedFile) {
          opt.e.preventDefault();
          opt.e.stopPropagation();
          canvas.setActiveObject(target);
          canvas.requestRenderAll();
          showCanvasFileMenu(opt.e.clientX, opt.e.clientY, target);
        }
      }
    });

    // Long-press on touch to open file context menu
    let fileLongPressTimer = null;
    let fileLongPressTarget = null;
    canvas.on('mouse:down', (opt) => {
      if (!opt.e.touches || opt.e.touches.length !== 1) return;
      const target = canvas.findTarget(opt.e, false);
      if (target && target._isAttachedFile) {
        fileLongPressTarget = target;
        fileLongPressTimer = setTimeout(() => {
          const touch = opt.e.touches ? opt.e.touches[0] || opt.e.changedTouches[0] : opt.e;
          canvas.setActiveObject(fileLongPressTarget);
          canvas.requestRenderAll();
          showCanvasFileMenu(touch.clientX, touch.clientY, fileLongPressTarget);
          fileLongPressTarget = null;
        }, 600);
      }
    });
    canvas.on('mouse:move', () => {
      if (fileLongPressTimer) { clearTimeout(fileLongPressTimer); fileLongPressTimer = null; }
    });
    canvas.on('mouse:up', () => {
      if (fileLongPressTimer) { clearTimeout(fileLongPressTimer); fileLongPressTimer = null; }
    });

    // Prevent default context menu on the upper canvas
    const upperCanvasEl = container.querySelector('.upper-canvas');
    if (upperCanvasEl) {
      upperCanvasEl.addEventListener('contextmenu', (e) => {
        const target = canvas.findTarget(e, false);
        if (target && target._isAttachedFile) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }
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
    const colWidths = [100, 100, 100];
    const rowHeights = [30, 28, 28, 28];
    const table = { id, x, y, data, colWidths, rowHeights };
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

    // Ensure colWidths/rowHeights exist (migration from old data)
    if (!table.colWidths) table.colWidths = table.data[0].map(() => 100);
    if (!table.rowHeights) table.rowHeights = table.data.map((_, i) => i === 0 ? 30 : 28);
    // Sync lengths if rows/cols were added
    while (table.colWidths.length < table.data[0].length) table.colWidths.push(100);
    while (table.rowHeights.length < table.data.length) table.rowHeights.push(28);

    const cols = table.data[0].length;
    let html = '<div class="canvas-table-handle" title="Arrastrar">⠿</div>';
    html += '<table class="canvas-table"><colgroup>';
    table.colWidths.forEach(w => { html += `<col style="width:${w}px">`; });
    html += '</colgroup><thead><tr style="height:' + table.rowHeights[0] + 'px">';
    table.data[0].forEach((cell, ci) => {
      html += `<th contenteditable="true" data-row="0" data-col="${ci}">${escHTMLTbl(cell)}</th>`;
    });
    html += '</tr></thead><tbody>';
    for (let ri = 1; ri < table.data.length; ri++) {
      html += `<tr style="height:${table.rowHeights[ri]}px">`;
      table.data[ri].forEach((cell, ci) => {
        html += `<td contenteditable="true" data-row="${ri}" data-col="${ci}">${escHTMLTbl(cell)}</td>`;
      });
      html += '</tr>';
    }
    html += '</tbody></table>';
    html += '<div class="canvas-table-resize" title="Redimensionar">⟻</div>';
    html += '<div class="tbl-add-row-edge" title="Añadir fila">+</div>';
    html += '<div class="tbl-add-col-edge" title="Añadir columna">+</div>';
    wrapper.innerHTML = html;
    if (table.w) wrapper.style.width = table.w + 'px';
    if (table.h) wrapper.style.height = table.h + 'px';
    container.appendChild(wrapper);

    // Edge buttons: add row / add col
    wrapper.querySelector('.tbl-add-row-edge').addEventListener('click', (e) => {
      e.stopPropagation();
      table.data.push(Array(table.data[0].length).fill(''));
      table.rowHeights.push(28);
      renderHTMLTable(table); selectTable(table.id);
    });
    wrapper.querySelector('.tbl-add-col-edge').addEventListener('click', (e) => {
      e.stopPropagation();
      table.data.forEach((row, i) => row.push(i === 0 ? `Col ${row.length + 1}` : ''));
      table.colWidths.push(100);
      renderHTMLTable(table); selectTable(table.id);
    });

    // Click to select (don't propagate to canvas)
    wrapper.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      selectTable(table.id);
    });

    // Right-click context menu on table cells
    wrapper.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectTable(table.id);
      const cell = e.target.closest('th, td');
      const row = cell ? parseInt(cell.dataset.row) : -1;
      const col = cell ? parseInt(cell.dataset.col) : -1;
      showTableContextMenu(e.clientX, e.clientY, table, row, col);
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
    setupTableResize(wrapper, table);
    setupCellResize(wrapper, table);
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

  function showTableContextMenu(x, y, table, row, col) {
    // Remove existing menu
    const existing = document.getElementById('table-ctx-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'table-ctx-menu';
    menu.className = 'ctx-menu';
    menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:999;display:block;`;

    const items = [];
    if (row >= 0) {
      items.push({ action: 'insert-row-above', label: 'Insertar fila arriba', icon: 'arrow-up' });
      items.push({ action: 'insert-row-below', label: 'Insertar fila abajo', icon: 'arrow-down' });
    } else {
      items.push({ action: 'insert-row-below', label: 'Añadir fila', icon: 'plus' });
    }
    if (col >= 0) {
      items.push({ action: 'insert-col-left', label: 'Insertar columna a la izquierda', icon: 'arrow-left' });
      items.push({ action: 'insert-col-right', label: 'Insertar columna a la derecha', icon: 'arrow-right' });
    } else {
      items.push({ action: 'insert-col-right', label: 'Añadir columna', icon: 'plus' });
    }

    // Delete options (only if enough rows/cols)
    if (row >= 0 && table.data.length > 2) {
      items.push({ action: 'delete-row', label: 'Eliminar fila', icon: 'minus', danger: true });
    }
    if (col >= 0 && table.data[0].length > 1) {
      items.push({ action: 'delete-col', label: 'Eliminar columna', icon: 'minus', danger: true });
    }

    menu.innerHTML = items.map(it =>
      `<button class="ctx-item${it.danger ? ' ctx-danger' : ''}" data-action="${it.action}"><i data-lucide="${it.icon}" style="width:14px;height:14px"></i> ${it.label}</button>`
    ).join('');

    document.body.appendChild(menu);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Keep within viewport
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const numCols = table.data[0].length;

      if (action === 'insert-row-above') {
        const r = row < 1 ? 1 : row; // can't insert above header
        table.data.splice(r, 0, Array(numCols).fill(''));
        table.rowHeights.splice(r, 0, 28);
      } else if (action === 'insert-row-below') {
        const r = row < 0 ? table.data.length : row + 1;
        table.data.splice(r, 0, Array(numCols).fill(''));
        table.rowHeights.splice(r, 0, 28);
      } else if (action === 'insert-col-left') {
        table.data.forEach((rw, i) => rw.splice(col, 0, i === 0 ? `Col ${numCols + 1}` : ''));
        table.colWidths.splice(col, 0, 100);
      } else if (action === 'insert-col-right') {
        const c = col < 0 ? numCols : col + 1;
        table.data.forEach((rw, i) => rw.splice(c, 0, i === 0 ? `Col ${numCols + 1}` : ''));
        table.colWidths.splice(c, 0, 100);
      } else if (action === 'delete-row') {
        if (row >= 1) { // can't delete header
          table.data.splice(row, 1);
          table.rowHeights.splice(row, 1);
        }
      } else if (action === 'delete-col') {
        table.data.forEach(rw => rw.splice(col, 1));
        table.colWidths.splice(col, 1);
      }

      renderHTMLTable(table);
      selectTable(table.id);
      menu.remove();
    });

    // Close on click outside
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('mousedown', closeMenu);
        document.removeEventListener('touchstart', closeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', closeMenu);
      document.addEventListener('touchstart', closeMenu);
    }, 10);
  }

  function setupTableDrag(wrapper, table) {
    const handle = wrapper.querySelector('.canvas-table-handle');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    function onStart(e) {
      isDragging = true;
      const p = e.touches ? e.touches[0] : e;
      startX = p.clientX;
      startY = p.clientY;
      startLeft = parseInt(wrapper.style.left) || 0;
      startTop = parseInt(wrapper.style.top) || 0;
      e.preventDefault();
      e.stopPropagation();
    }

    const onMove = (e) => {
      if (!isDragging) return;
      const p = e.touches ? e.touches[0] : e;
      wrapper.style.left = (startLeft + p.clientX - startX) + 'px';
      wrapper.style.top = (startTop + p.clientY - startY) + 'px';
      table.x = startLeft + p.clientX - startX;
      table.y = startTop + p.clientY - startY;
      positionTableToolbar();
    };

    const onUp = () => { isDragging = false; };

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
  }

  function setupTableResize(wrapper, table) {
    const handle = wrapper.querySelector('.canvas-table-resize');
    let isResizing = false;
    let startX, startY, startW, startH;

    function onStart(e) {
      isResizing = true;
      const p = e.touches ? e.touches[0] : e;
      startX = p.clientX;
      startY = p.clientY;
      startW = wrapper.offsetWidth;
      startH = wrapper.offsetHeight;
      e.preventDefault();
      e.stopPropagation();
    }

    const onMove = (e) => {
      if (!isResizing) return;
      const p = e.touches ? e.touches[0] : e;
      const newW = Math.max(100, startW + p.clientX - startX);
      const newH = Math.max(60, startH + p.clientY - startY);
      wrapper.style.width = newW + 'px';
      wrapper.style.height = newH + 'px';
      table.w = newW;
      table.h = newH;
      positionTableToolbar();
    };

    const onUp = () => { isResizing = false; };

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
  }

  function setupCellResize(wrapper, table) {
    const tbl = wrapper.querySelector('.canvas-table');
    const colEls = tbl.querySelectorAll('col');
    const rows = tbl.querySelectorAll('tr');

    // Column resize handles (inside each header cell)
    const headerCells = rows[0].querySelectorAll('th');
    headerCells.forEach((th, ci) => {
      const handle = document.createElement('div');
      handle.className = 'cell-col-resize';
      th.appendChild(handle);

      let startX, startW;
      function onStart(e) {
        const p = e.touches ? e.touches[0] : e;
        startX = p.clientX;
        startW = table.colWidths[ci];
        e.preventDefault();
        e.stopPropagation();
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
      }
      function onMove(ev) {
        const p = ev.touches ? ev.touches[0] : ev;
        const nw = Math.max(40, startW + p.clientX - startX);
        table.colWidths[ci] = nw;
        colEls[ci].style.width = nw + 'px';
      }
      function onUp() {
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchend', onUp);
      }
      handle.addEventListener('mousedown', onStart);
      handle.addEventListener('touchstart', onStart, { passive: false });
    });

    // Row resize handles (inside first cell of each row)
    rows.forEach((tr, ri) => {
      const firstCell = tr.querySelector('th, td');
      if (!firstCell) return;
      const handle = document.createElement('div');
      handle.className = 'cell-row-resize';
      firstCell.appendChild(handle);

      let startY, startH;
      function onStart(e) {
        const p = e.touches ? e.touches[0] : e;
        startY = p.clientY;
        startH = table.rowHeights[ri];
        e.preventDefault();
        e.stopPropagation();
        document.body.style.cursor = 'row-resize';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
      }
      function onMove(ev) {
        const p = ev.touches ? ev.touches[0] : ev;
        const nh = Math.max(20, startH + p.clientY - startY);
        table.rowHeights[ri] = nh;
        tr.style.height = nh + 'px';
      }
      function onUp() {
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchend', onUp);
      }
      handle.addEventListener('mousedown', onStart);
      handle.addEventListener('touchstart', onStart, { passive: false });
    });
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
    table.rowHeights.push(28);
    renderHTMLTable(table); selectTable(table.id);
  }

  function tableAddCol() {
    const table = getSelectedTableData(); if (!table) return;
    table.data.forEach((row, i) => row.push(i === 0 ? `Col ${row.length + 1}` : ''));
    table.colWidths.push(100);
    renderHTMLTable(table); selectTable(table.id);
  }

  function tableRemoveRow() {
    const table = getSelectedTableData(); if (!table) return;
    if (table.data.length <= 2) { App.toast('Mínimo 2 filas', 'warning'); return; }
    table.data.pop();
    table.rowHeights.pop();
    renderHTMLTable(table); selectTable(table.id);
  }

  function tableRemoveCol() {
    const table = getSelectedTableData(); if (!table) return;
    if (table.data[0].length <= 1) { App.toast('Mínimo 1 columna', 'warning'); return; }
    table.data.forEach(row => row.pop());
    table.colWidths.pop();
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

        // For images, generate a preview; for others, show icon
        if (file.type && file.type.startsWith('image/')) {
          const blob = new Blob([arrayBuffer], { type: file.type });
          const dataUrl = URL.createObjectURL(blob);
          addFilePreview(fileId, file.name, file.type, dataUrl, centerX + i * 160, centerY + i * 30);
        } else {
          addFileIcon(fileId, file.name, file.type, centerX + i * 30, centerY + i * 30);
        }
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

  function addFilePreview(fileId, fileName, mimeType, dataUrl, x, y) {
    const PREVIEW_MAX_W = 200;
    const PREVIEW_MAX_H = 160;
    const LABEL_H = 28;

    fabric.Image.fromURL(dataUrl, (img) => {
      // Revoke object URL if used
      if (dataUrl.startsWith('blob:')) URL.revokeObjectURL(dataUrl);

      if (!img || !img.width) {
        // Fallback to icon if image fails to load
        addFileIcon(fileId, fileName, mimeType, x, y);
        return;
      }

      // Scale to fit preview bounds
      const scale = Math.min(PREVIEW_MAX_W / img.width, PREVIEW_MAX_H / img.height, 1);
      const imgW = img.width * scale;
      const imgH = img.height * scale;
      const totalH = imgH + LABEL_H;
      const totalW = Math.max(imgW, 100);

      // Background
      const bg = new fabric.Rect({
        width: totalW + 12,
        height: totalH + 12,
        fill: 'rgba(30,41,59,0.9)',
        rx: 8,
        ry: 8,
        stroke: '#334155',
        strokeWidth: 1,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
      });

      // Scale image
      img.set({
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: -(LABEL_H / 2),
        selectable: false,
        evented: false
      });

      // Filename label
      const displayName = fileName.length > 28 ? fileName.substring(0, 25) + '...' : fileName;
      const label = new fabric.Text(displayName, {
        fontSize: 10,
        fontFamily: 'Inter, sans-serif',
        fill: '#94A3B8',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: imgH / 2 + 6,
        selectable: false,
        evented: false
      });

      const group = new fabric.Group([bg, img, label], {
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
        selectable: true,
        hasControls: true,
        hasBorders: true,
        _isAttachedFile: true,
        _attachedFileId: fileId,
        _attachedFileName: fileName,
        _isImagePreview: true
      });

      group.on('mousedblclick', () => downloadAttachedFile(fileId, fileName));

      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
    }, { crossOrigin: 'anonymous' });
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

  function showCanvasFileMenu(x, y, target) {
    // Remove existing menu if any
    const existing = document.getElementById('canvas-file-ctx');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'canvas-file-ctx';
    menu.className = 'ctx-menu';
    menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:999;display:block;`;

    const fileName = target._attachedFileName || 'Archivo';
    menu.innerHTML = `
      <div class="ctx-header">${fileName}</div>
      <button class="ctx-item" data-action="download"><i data-lucide="download" style="width:14px;height:14px"></i> Descargar</button>
      <button class="ctx-item" data-action="rename"><i data-lucide="pencil" style="width:14px;height:14px"></i> Renombrar</button>
      <div class="ctx-sep"></div>
      <button class="ctx-item ctx-danger" data-action="delete"><i data-lucide="trash-2" style="width:14px;height:14px"></i> Eliminar</button>
    `;

    document.body.appendChild(menu);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Keep menu within viewport
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';

    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('[data-action]');
      if (!item) return;
      const action = item.dataset.action;

      if (action === 'download') {
        await downloadAttachedFile(target._attachedFileId, target._attachedFileName);
      } else if (action === 'rename') {
        const newName = prompt('Nombre del archivo:', target._attachedFileName || '');
        if (newName && newName.trim()) {
          const trimmed = newName.trim();
          target._attachedFileName = trimmed;
          // Update label in group — find the smallest-font text (the label, not the emoji)
          if (target.type === 'group') {
            const objs = target.getObjects();
            const textObjs = objs.filter(o => o.type === 'text' && o.fontFamily);
            const label = textObjs.length > 0 ? textObjs[textObjs.length - 1] : null;
            if (label) {
              const maxLen = target._isImagePreview ? 28 : 22;
              const display = trimmed.length > maxLen ? trimmed.substring(0, maxLen - 3) + '...' : trimmed;
              label.set('text', display);
              canvas.requestRenderAll();
            }
          }
          // Also update the file record name in DB
          try {
            const fileRec = await DB.getById('files', target._attachedFileId);
            if (fileRec) {
              fileRec.name = trimmed;
              await DB.put('files', fileRec);
            }
          } catch(e) { /* ignore if file not found */ }
          saveHistory();
        }
      } else if (action === 'delete') {
        canvas.remove(target);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }

      menu.remove();
    });

    // Close on click outside
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('mousedown', closeMenu);
        document.removeEventListener('touchstart', closeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', closeMenu);
      document.addEventListener('touchstart', closeMenu);
    }, 10);
  }

  function reattachFileHandlers() {
    canvas.getObjects().forEach(obj => {
      if (obj._isAttachedFile && obj._attachedFileId) {
        if (!obj._isImagePreview) {
          obj.set({ hasControls: false, lockScalingX: true, lockScalingY: true });
        }
        obj.on('mousedblclick', () => downloadAttachedFile(obj._attachedFileId, obj._attachedFileName));
      }
    });
  }

  async function saveState() {
    const json = canvas.toJSON(['_isAttachedFile','_attachedFileId','_attachedFileName','_isImagePreview']);
    syncAllTableData();
    const payload = {
      canvas: json,
      tables: tables.map(t => ({ id: t.id, x: t.x, y: t.y, w: t.w || null, h: t.h || null, data: t.data, colWidths: t.colWidths || null, rowHeights: t.rowHeights || null }))
    };
    await DB.saveCanvasState(projectId, payload, currentSheetId);
    await DB.saveSheetIndex(projectId, sheets);
    App.toast('Mesa de trabajo guardada', 'success');
  }

  async function saveCurrentSheetSilent() {
    if (!canvas || !currentSheetId) return;
    const json = canvas.toJSON(['_isAttachedFile','_attachedFileId','_attachedFileName','_isImagePreview']);
    syncAllTableData();
    const payload = {
      canvas: json,
      tables: tables.map(t => ({ id: t.id, x: t.x, y: t.y, w: t.w || null, h: t.h || null, data: t.data, colWidths: t.colWidths || null, rowHeights: t.rowHeights || null }))
    };
    await DB.saveCanvasState(projectId, payload, currentSheetId);
  }

  async function loadSavedState() {
    const state = await DB.getCanvasState(projectId, currentSheetId);
    if (state && state.data) {
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
    } else {
      // Empty sheet — just clear
      canvas.clear();
      canvas.backgroundColor = '#1a1a2e';
      drawGrid();
      tables = [];
      clearTableDOM();
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

  // ========================================
  // MULTI-SHEET TABS
  // ========================================

  function setupSheetTabs() {
    document.getElementById('sheet-tab-add').addEventListener('click', addSheet);
  }

  function renderSheetTabs() {
    const list = document.getElementById('sheet-tabs-list');
    if (!list) return;
    list.innerHTML = '';
    sheets.forEach(sheet => {
      const tab = document.createElement('div');
      tab.className = 'sheet-tab' + (sheet.id === currentSheetId ? ' active' : '');
      tab.dataset.sheetId = sheet.id;

      const name = document.createElement('span');
      name.className = 'sheet-tab-name';
      name.textContent = sheet.name;
      tab.appendChild(name);

      const close = document.createElement('button');
      close.className = 'sheet-tab-close';
      close.innerHTML = '×';
      close.title = 'Eliminar hoja';
      tab.appendChild(close);

      // Click to switch
      tab.addEventListener('click', (e) => {
        if (e.target === close) return;
        if (sheet.id !== currentSheetId) switchSheet(sheet.id);
      });

      // Double-click to rename
      tab.addEventListener('dblclick', (e) => {
        if (e.target === close) return;
        startRenameSheet(name, sheet);
      });

      // Long-press for rename on touch
      let longPressTimer = null;
      tab.addEventListener('touchstart', () => {
        longPressTimer = setTimeout(() => startRenameSheet(name, sheet), 600);
      }, { passive: true });
      tab.addEventListener('touchend', () => clearTimeout(longPressTimer));
      tab.addEventListener('touchmove', () => clearTimeout(longPressTimer));

      // Close button
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSheet(sheet.id);
      });

      list.appendChild(tab);
    });

    // Re-render Lucide icons if needed
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function startRenameSheet(nameEl, sheet) {
    nameEl.contentEditable = 'true';
    nameEl.focus();
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(nameEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finish = () => {
      nameEl.contentEditable = 'false';
      const newName = nameEl.textContent.trim();
      if (newName && newName !== sheet.name) {
        sheet.name = newName;
        DB.saveSheetIndex(projectId, sheets);
      } else {
        nameEl.textContent = sheet.name;
      }
      nameEl.removeEventListener('blur', finish);
      nameEl.removeEventListener('keydown', onKey);
    };

    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
      if (e.key === 'Escape') { nameEl.textContent = sheet.name; nameEl.blur(); }
    };

    nameEl.addEventListener('blur', finish);
    nameEl.addEventListener('keydown', onKey);
  }

  async function switchSheet(sheetId) {
    if (sheetId === currentSheetId) return;
    // Save current sheet silently
    await saveCurrentSheetSilent();
    // Clear canvas state
    history.length = 0;
    historyLocked = false;
    tables = [];
    clearTableDOM();
    selectedTableId = null;
    deselectTable();
    // Switch
    currentSheetId = sheetId;
    renderSheetTabs();
    await loadSavedState();
  }

  async function addSheet() {
    // Save current sheet before adding
    await saveCurrentSheetSilent();
    const id = 'sheet_' + Date.now();
    const name = 'Hoja ' + (sheets.length + 1);
    sheets.push({ id, name });
    await DB.saveSheetIndex(projectId, sheets);
    // Switch to the new sheet
    history.length = 0;
    tables = [];
    clearTableDOM();
    selectedTableId = null;
    currentSheetId = id;
    // Clear canvas for new sheet
    canvas.clear();
    canvas.backgroundColor = '#1a1a2e';
    drawGrid();
    canvas.requestRenderAll();
    renderSheetTabs();
    App.toast('Nueva hoja creada', 'success');
  }

  async function deleteSheet(sheetId) {
    if (sheets.length <= 1) {
      App.toast('Debe haber al menos una hoja', 'warning');
      return;
    }
    if (!confirm('¿Eliminar esta hoja? Se perderá todo su contenido.')) return;
    // Remove from index
    const idx = sheets.findIndex(s => s.id === sheetId);
    sheets.splice(idx, 1);
    await DB.deleteCanvasSheet(projectId, sheetId);
    await DB.saveSheetIndex(projectId, sheets);
    // If we deleted the current sheet, switch to another
    if (sheetId === currentSheetId) {
      currentSheetId = sheets[Math.min(idx, sheets.length - 1)].id;
      history.length = 0;
      tables = [];
      clearTableDOM();
      selectedTableId = null;
      await loadSavedState();
    }
    renderSheetTabs();
    App.toast('Hoja eliminada', 'info');
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
