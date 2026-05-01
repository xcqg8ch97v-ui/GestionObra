/* ========================================
   Files Module - Documentos de Obra
   Gestión de archivos (PDF, imágenes, docs, etc.)
   ======================================== */

const FilesModule = (() => {
// Actualizado: 2026-04-10
  let projectId = null;
  let pdfViewerState = null;


  function getFileTypes() {
    return {
      'application/pdf': { icon: 'file-text', class: 'pdf', label: App.t('file_type_pdf') },
      'image/jpeg': { icon: 'image', class: 'image', label: App.t('file_type_image') },
      'image/png': { icon: 'image', class: 'image', label: App.t('file_type_image') },
      'image/webp': { icon: 'image', class: 'image', label: App.t('file_type_image') },
      'image/gif': { icon: 'image', class: 'image', label: App.t('file_type_image') },
      'application/msword': { icon: 'file-text', class: 'doc', label: App.t('file_type_doc') },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'file-text', class: 'doc', label: App.t('file_type_doc') },
      'application/vnd.ms-excel': { icon: 'table', class: 'spreadsheet', label: App.t('file_type_spreadsheet') },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: 'table', class: 'spreadsheet', label: App.t('file_type_spreadsheet') },
      'text/plain': { icon: 'file-text', class: 'doc', label: App.t('file_type_text') },
      'application/zip': { icon: 'archive', class: 'other', label: App.t('file_type_zip') }
    };
  }

  async function highlightPdfMatches(page, viewport, ctx) {
    if (!pdfViewerState) return;
    const query = (pdfViewerState.searchTerm || '').trim().toLowerCase();
    if (!query) return;

    try {
      const content = await page.getTextContent();
      const highlightColor = 'rgba(255, 215, 0, 0.35)';
      const padY = 1.5;

      ctx.save();
      ctx.fillStyle = highlightColor;

      content.items.forEach(item => {
        const raw = (item.str || '');
        if (!raw) return;
        if (!raw.toLowerCase().includes(query)) return;

        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const x = tx[4];
        const y = tx[5];
        const h = Math.max(8, Math.hypot(tx[2], tx[3]));
        const w = Math.max(8, (item.width || 0) * viewport.scale);

        ctx.fillRect(x, y - h - padY, w, h + padY * 2);
      });

      ctx.restore();
    } catch (err) {
      console.warn('[Files] PDF highlight error:', err);
    }
  }

  function getCategories() {
    return {
      pdf:         { label: App.t('files_category_pdf'),              icon: 'file-text',  match: f => f.type === 'application/pdf' && f.category !== 'participantes' },
      image:       { label: App.t('files_category_image'),            icon: 'image',      match: f => f.type.startsWith('image/') },
      doc:         { label: App.t('files_category_doc'),              icon: 'file-text',  match: f => f.type.includes('word') || f.type === 'text/plain' },
      spreadsheet: { label: App.t('files_category_spreadsheet'),      icon: 'table',      match: f => f.type.includes('excel') || f.type.includes('spreadsheet') },
      participantes: { label: App.t('files_category_participants'),    icon: 'users',      match: f => f.category === 'participantes' },
      other:       { label: App.t('files_category_other'),            icon: 'file',       match: () => true }
    };
  }

  function getCategory(f) {
    const CATEGORIES = getCategories();
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      if (key !== 'other' && cat.match(f)) return key;
    }
    return 'other';
  }

  function getFileInfo(mimeType) {
    const FILE_TYPES = getFileTypes();
    return FILE_TYPES[mimeType] || { icon: 'file', class: 'other', label: 'Archivo' };
  }

  function init(pid) {
    projectId = pid;
    setupButtons();
    loadFiles();
  }

  function setupButtons() {
    const uploadBtn = document.getElementById('btn-upload-file');
    const fileInput = document.getElementById('file-upload-input');
    const filterSel = document.getElementById('files-filter-type');
    const sortSel = document.getElementById('files-sort');
    const groupChk = document.getElementById('files-group-by-type');

    // Clone file input first so button handlers reference the new element
    const newInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newInput, fileInput);
    newInput.addEventListener('change', handleFileUpload);

    // Clone to remove old listeners
    const newUpload = uploadBtn.cloneNode(true);
    uploadBtn.parentNode.replaceChild(newUpload, uploadBtn);
    newUpload.addEventListener('click', () => newInput.click());

    const emptyBtn = document.getElementById('btn-upload-file-empty');
    if (emptyBtn) {
      const newEmpty = emptyBtn.cloneNode(true);
      emptyBtn.parentNode.replaceChild(newEmpty, emptyBtn);
      newEmpty.addEventListener('click', () => newInput.click());
    }

    // Filter
    const newFilter = filterSel.cloneNode(true);
    filterSel.parentNode.replaceChild(newFilter, filterSel);
    newFilter.addEventListener('change', loadFiles);

    // Sort
    const newSort = sortSel.cloneNode(true);
    sortSel.parentNode.replaceChild(newSort, sortSel);
    newSort.addEventListener('change', loadFiles);

    // Group toggle
    const newGroup = groupChk.cloneNode(true);
    groupChk.parentNode.replaceChild(newGroup, groupChk);
    newGroup.addEventListener('change', loadFiles);

    // Drag & drop
    const dropZone = document.getElementById('section-files');
    if (dropZone) {
      let dragCounter = 0;
      dropZone.addEventListener('dragenter', e => { e.preventDefault(); dragCounter++; dropZone.classList.add('drag-active'); });
      dropZone.addEventListener('dragleave', () => { dragCounter--; if (dragCounter <= 0) { dragCounter = 0; dropZone.classList.remove('drag-active'); } });
      dropZone.addEventListener('dragover', e => e.preventDefault());
      dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dragCounter = 0;
        dropZone.classList.remove('drag-active');
        const files = Array.from(e.dataTransfer.files);
        if (files.length) handleFileDrop(files);
      });
    }
  }

  async function handleFileDrop(files) {
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        App.toast(App.t('file_exceeds_size_limit', { name: file.name, size: '50MB' }), 'warning');
        continue;
      }
      const buffer = await file.arrayBuffer();
      await DB.add('files', { projectId, name: file.name, type: file.type, size: file.size, data: buffer, createdAt: new Date().toISOString() });
    }
    App.toast(files.length === 1 ? App.t('file_uploaded') : `${files.length} archivos subidos`, 'success');
    loadFiles();
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
      // Max 50 MB per file
      if (file.size > 50 * 1024 * 1024) {
        App.toast(App.t('file_exceeds_size_limit', { name: file.name, size: '50MB' }), 'warning');
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
      // Auto-upload to Cloudinary if logged in
      if (typeof CloudinarySync !== 'undefined' && typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
        CloudinarySync.uploadFile({ ...record, id: fileId }).then(async meta => {
          const updated = { ...record, id: fileId, ...meta };
          window._fbSyncSuppressed = true;
          await DB.put('files', updated);
          window._fbSyncSuppressed = false;
          if (FirebaseSync.isEnabled()) {
            const { data, blob: b, ...cleanMeta } = updated;
            FirebaseSync.fsSet('files', cleanMeta);
          }
        }).catch(e => console.warn('[Cloudinary] Auto-upload failed:', e));
      }
    }

    App.toast(App.t('files_uploaded_count', { count: files.length }), 'success');
    e.target.value = '';
    loadFiles();
  }

  async function loadFiles() {
    const filter = document.getElementById('files-filter-type').value;
    const sort = document.getElementById('files-sort').value;
    const grouped = document.getElementById('files-group-by-type').checked;
    let files = await DB.getAllForProject('files', projectId);

    // Filter
    if (filter === 'pdf') {
      files = files.filter(f => f.type === 'application/pdf');
    } else if (filter === 'image') {
      files = files.filter(f => f.type.startsWith('image/'));
    } else if (filter === 'doc') {
      files = files.filter(f => f.type.includes('word') || f.type === 'text/plain');
    } else if (filter === 'spreadsheet') {
      files = files.filter(f => f.type.includes('excel') || f.type.includes('spreadsheet'));
    } else if (filter === 'other') {
      files = files.filter(f => getCategory(f) === 'other');
    }

    // Sort
    switch (sort) {
      case 'date-desc': files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)); break;
      case 'date-asc':  files.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt)); break;
      case 'name-asc':  files.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': files.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'size-desc': files.sort((a, b) => b.size - a.size); break;
      case 'size-asc':  files.sort((a, b) => a.size - b.size); break;
    }

    renderFileList(files, grouped);
  }

  function renderFileList(files, grouped) {
    const list = document.getElementById('files-list');
    const empty = document.getElementById('files-empty');

    if (files.length === 0) {
      list.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }

    list.style.display = 'flex';
    empty.style.display = 'none';

    if (grouped) {
      // Group files by category, maintaining order of CATEGORIES
      const groups = {};
      for (const f of files) {
        const cat = getCategory(f);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(f);
      }

      let html = '';
      for (const [key, cat] of Object.entries(getCategories())) {
        const items = groups[key];
        if (!items || items.length === 0) continue;
        html += `
          <div class="files-category">
            <div class="files-category-header">
              <i data-lucide="${cat.icon}"></i>
              <span>${cat.label}</span>
              <span class="files-category-count">${items.length}</span>
            </div>
            <div class="files-category-items">
              ${items.map(f => renderFileItem(f)).join('')}
            </div>
          </div>
        `;
      }
      list.innerHTML = html;
    } else {
      list.innerHTML = files.map(f => renderFileItem(f)).join('');
    }

    lucide.createIcons();
  }

  function renderFileItem(f) {
    const info = getFileInfo(f.type);
    const sizeStr = formatFileSize(f.size);
    return `
      <div class="file-item">
        <div class="file-icon ${info.class}">
          <i data-lucide="${info.icon}"></i>
        </div>
        <div class="file-info">
          <div class="file-name">${App.escapeHTML(f.name)}</div>
          <div class="file-meta">${info.label} · ${sizeStr} · ${App.formatDate(f.uploadedAt)}${f.cloudinaryUrl ? ' · <span style="color:var(--cyan);font-size:11px">☁ nube</span>' : ''}</div>
        </div>
        <div class="file-actions">
          <button class="action-btn" onclick="FilesModule.previewFile(${f.id})" title="${App.t('preview')}">
            <i data-lucide="eye"></i>
          </button>
          <button class="action-btn" onclick="FilesModule.showDownloadMenu(${f.id}, '${App.escapeHTML(f.name)}', event)" title="${App.t('download')}">
            <i data-lucide="download"></i>
          </button>
          <button class="action-btn delete" onclick="FilesModule.deleteFile(${f.id})" title="${App.t('delete')}">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }

  async function downloadFile(id) {
    const file = await DB.getById('files', id);
    if (!file) {
      App.toast(App.t('file_not_found'), 'error');
      return;
    }

    const binaryData = file.data || (file.blob instanceof Blob ? await file.blob.arrayBuffer() : null);

    if (!binaryData) {
      // Fallback: use Cloudinary URL if available
      if (file.cloudinaryUrl) {
        const link = document.createElement('a');
        link.href = file.cloudinaryUrl;
        link.download = file.name;
        link.target = '_blank';
        link.click();
        return;
      }
      App.toast(App.t('file_content_unavailable'), 'error');
      return;
    }

    const blob = new Blob([binaryData], { type: file.type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function previewFile(id) {
    const file = await DB.getById('files', id);
    if (!file) {
      App.toast(App.t('file_not_found'), 'error');
      return;
    }

    const binaryData = file.data || (file.blob instanceof Blob ? await file.blob.arrayBuffer() : null);

    if (!binaryData) {
      // Fallback: use Cloudinary URL if available
      if (file.cloudinaryUrl) {
        window.open(file.cloudinaryUrl, '_blank');
        return;
      }
      App.toast(App.t('file_content_unavailable'), 'error');
      return;
    }

    const blob = new Blob([binaryData], { type: file.type });
    const url = URL.createObjectURL(blob);

    if (file.type === 'application/pdf') {
      URL.revokeObjectURL(url);
      await openPdfViewer(file, binaryData, id);
    } else if (file.type.startsWith('image/')) {
      // Mostrar imagen en modal
      const body = `
        <div style="text-align:center">
          <img src="${url}" alt="${App.escapeHTML(file.name)}" style="max-width:100%;max-height:70vh;object-fit:contain" />
        </div>
      `;
      App.openModal(App.escapeHTML(file.name), body, `
        <button class="btn btn-outline" onclick="App.closeModal()">${App.t('close')}</button>
        <button class="btn btn-primary" onclick="FilesModule.downloadFile(${id})">${App.t('download')}</button>
      `);
    } else {
      // Para otros tipos, abrir en nueva pestaña
      window.open(url, '_blank');
      URL.revokeObjectURL(url);
    }
  }

  async function openPdfViewer(file, binaryData, fileId) {
    if (typeof pdfjsLib === 'undefined') {
      const url = URL.createObjectURL(new Blob([binaryData], { type: 'application/pdf' }));
      window.open(url, '_blank');
      URL.revokeObjectURL(url);
      return;
    }

    const body = `
      <div class="pdf-viewer-shell" id="pdf-viewer-shell">
        <div class="pdf-viewer-toolbar">
          <button class="btn btn-outline" id="pdf-prev" title="${App.t('plan_viewer_prev')}">
            <i data-lucide="chevron-left"></i>
          </button>
          <span class="pdf-viewer-page" id="pdf-page-label">1 / 1</span>
          <button class="btn btn-outline" id="pdf-next" title="${App.t('plan_viewer_next')}">
            <i data-lucide="chevron-right"></i>
          </button>

          <div class="pdf-viewer-divider"></div>

          <button class="btn btn-outline" id="pdf-zoom-out" title="${App.t('plan_viewer_zoom_out')}">
            <i data-lucide="zoom-out"></i>
          </button>
          <span class="pdf-viewer-zoom" id="pdf-zoom-label">100%</span>
          <button class="btn btn-outline" id="pdf-zoom-in" title="${App.t('plan_viewer_zoom_in')}">
            <i data-lucide="zoom-in"></i>
          </button>
          <button class="btn btn-outline" id="pdf-fit" title="${App.t('plan_viewer_fit')}">
            ${App.t('plan_viewer_fit')}
          </button>

          <div class="pdf-viewer-divider"></div>

          <div class="pdf-viewer-search-wrap">
            <input id="pdf-search-input" type="text" placeholder="${App.t('search_placeholder')}" class="pdf-viewer-search-input" />
            <button class="btn btn-outline" id="pdf-search-next" title="${App.t('search_placeholder')}">
              <i data-lucide="search"></i>
            </button>
          </div>
        </div>

        <div class="pdf-viewer-canvas-wrap" id="pdf-canvas-wrap">
          <canvas id="pdf-canvas"></canvas>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" id="pdf-viewer-close">${App.t('close')}</button>
      <button class="btn btn-primary" id="pdf-viewer-download">${App.t('download')}</button>
    `;

    App.openModal(App.escapeHTML(file.name), body, footer, { width: '1200px' });

    const pdfDoc = await pdfjsLib.getDocument({ data: binaryData }).promise;
    pdfViewerState = {
      fileId,
      pdfDoc,
      page: 1,
      totalPages: pdfDoc.numPages,
      zoom: 1,
      fitMode: true,
      rendering: false,
      pendingPage: null,
      searchTerm: '',
      lastSearchPage: 1,
      textCache: new Map(),
      observer: null
    };

    bindPdfViewerEvents();
    setupPdfViewerCleanup();
    await renderPdfPage(1, { forceFit: true });
    lucide.createIcons();
  }

  function bindPdfViewerEvents() {
    const prevBtn = document.getElementById('pdf-prev');
    const nextBtn = document.getElementById('pdf-next');
    const zoomInBtn = document.getElementById('pdf-zoom-in');
    const zoomOutBtn = document.getElementById('pdf-zoom-out');
    const fitBtn = document.getElementById('pdf-fit');
    const searchInput = document.getElementById('pdf-search-input');
    const searchNextBtn = document.getElementById('pdf-search-next');
    const closeBtn = document.getElementById('pdf-viewer-close');
    const downloadBtn = document.getElementById('pdf-viewer-download');
    const wrap = document.getElementById('pdf-canvas-wrap');

    if (prevBtn) prevBtn.addEventListener('click', () => changePdfPage(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => changePdfPage(1));
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => changePdfZoom(0.1));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => changePdfZoom(-0.1));
    if (fitBtn) fitBtn.addEventListener('click', () => {
      if (!pdfViewerState) return;
      pdfViewerState.fitMode = true;
      renderPdfPage(pdfViewerState.page, { forceFit: true });
    });
    if (closeBtn) closeBtn.addEventListener('click', () => App.closeModal());
    if (downloadBtn) downloadBtn.addEventListener('click', () => {
      if (pdfViewerState?.fileId) downloadFile(pdfViewerState.fileId);
    });

    if (searchInput) {
      searchInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          await findNextInPdf(searchInput.value);
        }
      });
    }

    if (searchNextBtn) {
      searchNextBtn.addEventListener('click', async () => {
        const term = searchInput?.value || '';
        await findNextInPdf(term);
      });
    }

    if (wrap) {
      wrap.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        changePdfZoom(e.deltaY < 0 ? 0.05 : -0.05);
      }, { passive: false });
    }
  }

  function setupPdfViewerCleanup() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay || !pdfViewerState) return;

    const observer = new MutationObserver(() => {
      if (!overlay.classList.contains('active')) {
        cleanupPdfViewer();
      }
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    pdfViewerState.observer = observer;
  }

  function cleanupPdfViewer() {
    if (!pdfViewerState) return;
    if (pdfViewerState.observer) {
      pdfViewerState.observer.disconnect();
    }
    pdfViewerState = null;
  }

  async function changePdfPage(delta) {
    if (!pdfViewerState) return;
    const target = Math.min(Math.max(1, pdfViewerState.page + delta), pdfViewerState.totalPages);
    if (target === pdfViewerState.page) return;
    await renderPdfPage(target);
  }

  function changePdfZoom(delta) {
    if (!pdfViewerState) return;
    const next = Math.min(3, Math.max(0.3, pdfViewerState.zoom + delta));
    if (next === pdfViewerState.zoom) return;
    pdfViewerState.zoom = next;
    pdfViewerState.fitMode = false;
    renderPdfPage(pdfViewerState.page);
  }

  async function renderPdfPage(pageNumber, { forceFit = false } = {}) {
    if (!pdfViewerState || !pdfViewerState.pdfDoc) return;

    if (pdfViewerState.rendering) {
      pdfViewerState.pendingPage = { pageNumber, forceFit };
      return;
    }

    pdfViewerState.rendering = true;
    pdfViewerState.page = pageNumber;

    try {
      const page = await pdfViewerState.pdfDoc.getPage(pageNumber);
      const canvas = document.getElementById('pdf-canvas');
      const wrap = document.getElementById('pdf-canvas-wrap');
      if (!canvas || !wrap) return;

      if (forceFit || pdfViewerState.fitMode) {
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(320, wrap.clientWidth - 24);
        pdfViewerState.zoom = Math.min(2.5, Math.max(0.3, availableWidth / baseViewport.width));
      }

      const viewport = page.getViewport({ scale: pdfViewerState.zoom });
      const ctx = canvas.getContext('2d');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      await page.render({ canvasContext: ctx, viewport }).promise;
      await highlightPdfMatches(page, viewport, ctx);
      updatePdfToolbar();
    } catch (err) {
      console.error('[Files] PDF render error:', err);
      App.toast(App.t('preview_not_available'), 'error');
    } finally {
      pdfViewerState.rendering = false;
      const pending = pdfViewerState?.pendingPage;
      if (pending) {
        pdfViewerState.pendingPage = null;
        renderPdfPage(pending.pageNumber, { forceFit: pending.forceFit });
      }
    }
  }

  function updatePdfToolbar() {
    if (!pdfViewerState) return;
    const label = document.getElementById('pdf-page-label');
    const zoom = document.getElementById('pdf-zoom-label');
    const prevBtn = document.getElementById('pdf-prev');
    const nextBtn = document.getElementById('pdf-next');

    if (label) label.textContent = `${pdfViewerState.page} / ${pdfViewerState.totalPages}`;
    if (zoom) zoom.textContent = `${Math.round(pdfViewerState.zoom * 100)}%`;
    if (prevBtn) prevBtn.disabled = pdfViewerState.page <= 1;
    if (nextBtn) nextBtn.disabled = pdfViewerState.page >= pdfViewerState.totalPages;
  }

  async function getPdfPageText(pageNumber) {
    if (!pdfViewerState) return '';
    if (pdfViewerState.textCache.has(pageNumber)) {
      return pdfViewerState.textCache.get(pageNumber);
    }

    const page = await pdfViewerState.pdfDoc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map(i => i.str).join(' ').toLowerCase();
    pdfViewerState.textCache.set(pageNumber, text);
    return text;
  }

  async function findNextInPdf(term) {
    if (!pdfViewerState) return;
    const query = (term || '').trim().toLowerCase();
    if (!query) {
      App.toast(App.t('search_placeholder'), 'info');
      return;
    }

    const total = pdfViewerState.totalPages;
    const start = pdfViewerState.searchTerm === query
      ? Math.min(total, pdfViewerState.lastSearchPage + 1)
      : pdfViewerState.page;
    pdfViewerState.searchTerm = query;

    for (let offset = 0; offset < total; offset++) {
      const pageNum = ((start - 1 + offset) % total) + 1;
      const text = await getPdfPageText(pageNum);
      if (text.includes(query)) {
        pdfViewerState.lastSearchPage = pageNum;
        await renderPdfPage(pageNum);
        App.toast(`"${query}" · página ${pageNum}`, 'success');
        return;
      }
    }

    App.toast(App.t('search_no_results'), 'warning');
  }

  async function deleteFile(id) {
    if (!await App.confirm(App.t('confirm_delete_file'))) return;
    await DB.remove('files', id);
    App.toast(App.t('file_deleted'), 'info');
    loadFiles();
  }

  function showDownloadMenu(id, fileName, event) {
    if (event) event.stopPropagation();
    
    // Verificar si el archivo está adjunto al canvas
    const isAttached = CanvasModule ? CanvasModule.isFileAttachedToCanvas(id) : false;
    
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';

    // Calcular posición para que no se salga de la pantalla
    const menuWidth = 200;
    const menuHeight = 100;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight);

    menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:999;display:block;`;
    
    let menuHTML = `<div class="ctx-header">${App.escapeHTML(fileName)}</div>`;
    menuHTML += `<button class="ctx-item" data-action="download-original"><i data-lucide="file" style="width:14px;height:14px"></i> ${App.t('download_original')}</button>`;
    
    if (isAttached) {
      menuHTML += `<button class="ctx-item" data-action="download-annotated"><i data-lucide="image" style="width:14px;height:14px"></i> ${App.t('download_annotated')}</button>`;
    }
    
    menu.innerHTML = menuHTML;
    document.body.appendChild(menu);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('touchstart', closeMenu);
    };
    
    setTimeout(() => {
      document.addEventListener('mousedown', closeMenu);
      document.addEventListener('touchstart', closeMenu);
    }, 10);
    
    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('[data-action]');
      if (!item) return;
      const action = item.dataset.action;
      
      if (action === 'download-original') {
        await downloadFile(id);
      } else if (action === 'download-annotated') {
        if (CanvasModule) {
          CanvasModule.exportCanvasAsImage(fileName);
        }
      }
      
      closeMenu();
    });
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return { init, downloadFile, previewFile, deleteFile, showDownloadMenu };
})();
