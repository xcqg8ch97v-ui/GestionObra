/* ========================================
   Files Module - Documentos de Obra
   Gestión de archivos (PDF, imágenes, docs, etc.)
   ======================================== */

const FilesModule = (() => {
// Actualizado: 2026-04-10
  let projectId = null;


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

  function getCategories() {
    return {
      pdf:         { label: App.t('files_category_pdf'),              icon: 'file-text',  match: f => f.type === 'application/pdf' },
      image:       { label: App.t('files_category_image'),            icon: 'image',      match: f => f.type.startsWith('image/') },
      doc:         { label: App.t('files_category_doc'),              icon: 'file-text',  match: f => f.type.includes('word') || f.type === 'text/plain' },
      spreadsheet: { label: App.t('files_category_spreadsheet'),      icon: 'table',      match: f => f.type.includes('excel') || f.type.includes('spreadsheet') },
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
    const dropZone = document.getElementById('files-drop-zone');
    const dropOverlay = document.getElementById('files-drop-overlay');
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

      await DB.add('files', record);
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
          <div class="file-meta">${info.label} · ${sizeStr} · ${App.formatDate(f.uploadedAt)}</div>
        </div>
        <div class="file-actions">
          <button class="action-btn" onclick="FilesModule.downloadFile(${f.id})" title="${App.t('download')}">
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

  async function deleteFile(id) {
    if (!await App.confirm(App.t('confirm_delete_file'))) return;
    await DB.remove('files', id);
    App.toast(App.t('file_deleted'), 'info');
    loadFiles();
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return { init, downloadFile, deleteFile };
})();
