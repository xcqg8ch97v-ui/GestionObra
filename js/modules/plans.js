/* ========================================
   Plans Module - Planos de Obra
   Visor de planos con zoom, categorías y lightbox
   ======================================== */

const PlansModule = (() => {
// Actualizado: 2026-04-10
  let projectId = null;
  let allPlans = [];
  let activeCategory = '__all__';
  let viewerIndex = -1;
  let viewerZoom = 1;

  const DEFAULT_PLAN_CATEGORIES = [
    { key: 'situacion',      label: 'Situación / Emplazamiento', icon: 'map-pin',      keywords: ['situac', 'emplazamiento', 'ubicac', 'topogr', 'catastro'] },
    { key: 'plantas',        label: 'Plantas',                   icon: 'layers',       keywords: ['planta', 'distribuc', 'layout'] },
    { key: 'alzados',        label: 'Alzados',                   icon: 'rectangle-vertical', keywords: ['alzado', 'fachada', 'elevaci'] },
    { key: 'secciones',      label: 'Secciones',                 icon: 'split',        keywords: ['seccion', 'sección', 'corte'] },
    { key: 'cotas',          label: 'Cotas y Replanteo',         icon: 'ruler',        keywords: ['cota', 'acotado', 'replante', 'dimen'] },
    { key: 'estructura',     label: 'Estructura',                icon: 'box',          keywords: ['estructur', 'forjado', 'pilar', 'viga', 'pórtico', 'portico'] },
    { key: 'cimentacion',    label: 'Cimentación',               icon: 'hard-hat',     keywords: ['ciment', 'zapata', 'losa', 'pilote'] },
    { key: 'cubiertas',      label: 'Cubiertas',                 icon: 'home',         keywords: ['cubiert', 'tejado', 'azotea', 'impermeab'] },
    { key: 'electricidad',   label: 'Electricidad',              icon: 'zap',          keywords: ['electr', 'iluminac', 'alumbrado', 'baja tensión', 'cuadro'] },
    { key: 'fontaneria',     label: 'Fontanería y Saneamiento',  icon: 'droplets',     keywords: ['fontan', 'saneamiento', 'agua', 'desagüe', 'afs', 'acs'] },
    { key: 'climatizacion',  label: 'Climatización y Ventilación', icon: 'thermometer', keywords: ['climatiz', 'calefacc', 'ventilac', 'aire acondicionado', 'hvac'] },
    { key: 'telecom',        label: 'Telecomunicaciones',        icon: 'wifi',         keywords: ['telecom', 'ict', 'antena', 'datos', 'telefon'] },
    { key: 'incendios',      label: 'Protección contra Incendios', icon: 'flame',      keywords: ['incendio', 'extintor', 'bie', 'evacuac', 'pci'] },
    { key: 'urbanizacion',   label: 'Urbanización',              icon: 'trees',        keywords: ['urbaniz', 'jardiner', 'paisaj', 'exterior', 'acera', 'vial'] },
    { key: 'detalle',        label: 'Detalles Constructivos',    icon: 'scan',         keywords: ['detalle', 'detail', 'constructiv', 'nudo', 'encuentro'] },
    { key: 'seguridad',      label: 'Seguridad y Salud',         icon: 'shield',       keywords: ['seguridad', 'salud', 'ess', 'proteccio', 'prevenc'] },
    { key: 'otros',          label: 'Otros',                     icon: 'file',         keywords: [] },
  ];

  let customPlanCategories = [];
  let hiddenPlanCategories = [];
  let plansUiBound = false;

  async function refreshPlanCategories() {
    hiddenPlanCategories = (await DB.getCustomCategories(projectId, 'plan', 'hide')).map(c => c.name);
    customPlanCategories = (await DB.getCustomCategories(projectId, 'plan', 'add'))
      .filter(c => !hiddenPlanCategories.includes(c.name))
      .map(c => ({
        key: 'custom_' + c.id,
        label: c.name,
        icon: 'tag',
        keywords: []
      }));
  }

  function getAllPlanCategories() {
    return DEFAULT_PLAN_CATEGORIES.filter(cat => !hiddenPlanCategories.includes(cat.key)).concat(customPlanCategories);
  }

  function guessCategory(name) {
    const lower = (name || '').toLowerCase();
    for (const cat of getAllPlanCategories()) {
      if (cat.key === 'otros') continue;
      for (const kw of cat.keywords || []) {
        if (lower.includes(kw)) return cat.key;
      }
    }
    return 'otros';
  }

  async function init(pid) {
    projectId = pid;
    await refreshPlanCategories();
    setupButtons();
    loadPlans();
  }

  function setupButtons() {
    if (plansUiBound) return;

    document.getElementById('plan-file-input').onchange = handleUpload;

    const triggerUpload = () => document.getElementById('plan-file-input').click();
    const btnUpload = document.getElementById('btn-upload-plan-section');
    if (btnUpload) btnUpload.onclick = triggerUpload;
    const btnEmpty = document.getElementById('btn-upload-plan-empty');
    if (btnEmpty) btnEmpty.onclick = triggerUpload;

    setupViewer();

    // Drag & drop
    const dropZone = document.getElementById('section-plans');
    if (dropZone) {
      let dragCounter = 0;
      dropZone.addEventListener('dragenter', e => { e.preventDefault(); dragCounter++; dropZone.classList.add('drag-active'); });
      dropZone.addEventListener('dragleave', () => { dragCounter--; if (dragCounter <= 0) { dragCounter = 0; dropZone.classList.remove('drag-active'); } });
      dropZone.addEventListener('dragover', e => e.preventDefault());
      dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dragCounter = 0;
        dropZone.classList.remove('drag-active');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
        if (files.length) {
          const fakeEvent = { target: { files, value: '' } };
          handleUpload(fakeEvent);
        } else {
          App.toast('Solo se permiten imágenes y PDFs', 'warning');
        }
      });
    }

    plansUiBound = true;
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (e.target.value !== undefined) e.target.value = '';

    // Recargar categorías personalizadas
    await refreshPlanCategories();
    const allCategories = getAllPlanCategories();

    // Build category selector modal
    const guessed = files.length === 1 ? guessCategory(files[0].name) : (activeCategory !== '__all__' ? activeCategory : 'otros');
    const body = `
      <div class="form-group">
        <label>${files.length > 1 ? App.t('plan_upload_category_label_multiple', { count: files.length }) : App.t('plan_upload_category_label_single', { name: '<b>' + App.escapeHTML(files[0].name) + '</b>' })}</label>
        <div style="display:flex;gap:8px;align-items:center">
          <select id="plan-upload-category" class="form-control">
            ${allCategories.map(c => `<option value="${c.key}" ${c.key === guessed ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-xs btn-outline" id="btn-add-custom-plan-cat" title="${App.t('add_category')}"><i data-lucide="plus"></i></button>
        </div>
      </div>
      <div style="margin-top:.5rem;color:var(--text-muted);font-size:.85rem">
        ${files.length > 1 ? App.t('plan_upload_same_category_note', { count: files.length }) : App.t('plan_upload_change_category_note')}
      </div>`;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">${App.t('cancel')}</button>
      <button class="btn btn-primary" id="btn-confirm-upload"><i data-lucide="upload"></i> ${App.t('upload')}</button>`;

    App.openModal(App.t('upload_plan_title'), body, footer);

    // Botón para añadir categoría personalizada
    document.getElementById('btn-add-custom-plan-cat').addEventListener('click', async () => {
      const name = await App.prompt(App.t('new_category_name_prompt'), '', { title: App.t('add_category') });
      if (!name) return;
      const exists = allCategories.some(c => c.label.toLowerCase() === name.trim().toLowerCase());
      if (exists) { App.toast(App.t('category_already_exists'), 'warning'); return; }
      await DB.addCustomCategory(projectId, 'plan', name.trim());
      await refreshPlanCategories();
      const newAllCategories = getAllPlanCategories();
      const select = document.getElementById('plan-upload-category');
      select.innerHTML = newAllCategories.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
      select.value = 'custom_' + customPlanCategories[customPlanCategories.length - 1].id;
      App.toast(App.t('category_added'), 'success');
    });

    document.getElementById('btn-confirm-upload').addEventListener('click', async () => {
      const category = document.getElementById('plan-upload-category').value;
      App.closeModal();

      let count = 0;
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        await DB.saveFile(new Blob([arrayBuffer]), file.name, file.type, projectId);

        const fileRecords = await DB.getAllForProject('files', projectId);
        const saved = fileRecords.sort((a, b) => (b.id || 0) - (a.id || 0))[0];
        if (saved) {
          await DB.add('plans', {
            fileId: saved.id,
            name: file.name.replace(/\.[^.]+$/, ''),
            category,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            projectId
          });
          count++;
        }
      }
      App.toast(`${count} plano(s) subido(s)`, 'success');
      loadPlans();
    });
  }

  async function loadPlans() {
    allPlans = await DB.getAllForProject('plans', projectId);
    renderCategories();
    renderGallery();
  }

  function renderCategories() {
    const container = document.getElementById('plans-categories');
    if (allPlans.length === 0) {
      container.innerHTML = '';
      return;
    }

    const counts = { '__all__': allPlans.length };
    allPlans.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });

    let html = `<button class="plans-cat-btn ${activeCategory === '__all__' ? 'active' : ''}" data-cat="__all__">
      <i data-lucide="layers"></i> Todos <span class="plans-cat-count">${counts['__all__']}</span>
    </button>`;

    for (const cat of getAllPlanCategories()) {
      if (!counts[cat.key]) continue;
      html += `<button class="plans-cat-btn ${activeCategory === cat.key ? 'active' : ''}" data-cat="${cat.key}">
        <i data-lucide="${cat.icon}"></i> ${cat.label} <span class="plans-cat-count">${counts[cat.key]}</span>
      </button>`;
    }

    container.innerHTML = html;
    container.querySelectorAll('.plans-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        renderCategories();
        renderGallery();
      });
    });
    try { lucide.createIcons(); } catch(e) {}
  }

  async function buildCardHTML(plan, idx) {
    const file = await DB.getFile(plan.fileId);
    let thumbHTML = '';
    if (file) {
      const blob = file.blob || (file.data ? new Blob([file.data], { type: file.type || 'image/*' }) : null);
      if (blob && file.type && file.type.startsWith('image/')) {
        const url = URL.createObjectURL(blob);
        thumbHTML = `<img src="${url}" alt="${App.escapeHTML(plan.name)}" class="plan-thumb" loading="lazy">`;
      } else if (blob && file.type === 'application/pdf' && typeof pdfjsLib !== 'undefined') {
        // Render first page of PDF as thumbnail
        try {
          const arrayBuf = await blob.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
          const page = await pdf.getPage(1);
          const vp = page.getViewport({ scale: 1 });
          const scale = Math.min(400 / vp.width, 300 / vp.height);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/png');
          thumbHTML = `<img src="${dataUrl}" alt="${App.escapeHTML(plan.name)}" class="plan-thumb" loading="lazy">`;
        } catch(e) {
          console.warn('PDF thumb error:', e);
          thumbHTML = `<div class="plan-thumb-pdf"><i data-lucide="file-text"></i><span>PDF</span></div>`;
        }
      } else if (file.type === 'application/pdf') {
        thumbHTML = `<div class="plan-thumb-pdf"><i data-lucide="file-text"></i><span>PDF</span></div>`;
      }
    }
    if (!thumbHTML) {
      thumbHTML = `<div class="plan-thumb-pdf"><i data-lucide="image"></i></div>`;
    }

    const catObj = getAllPlanCategories().find(c => c.key === plan.category) || DEFAULT_PLAN_CATEGORIES[DEFAULT_PLAN_CATEGORIES.length - 1];

    return `
      <div class="plan-card" data-plan-idx="${idx}">
        <div class="plan-card-thumb" data-plan-id="${plan.id}">${thumbHTML}</div>
        <div class="plan-card-info">
          <strong class="plan-card-name">${App.escapeHTML(plan.name)}</strong>
          <span class="badge badge-neutral plan-card-cat">${catObj.label}</span>
        </div>
        <div class="plan-card-actions">
          <button class="action-btn plan-edit-btn" data-id="${plan.id}" title="${App.t('edit_plan_title')}" ><i data-lucide="pencil"></i></button>
          <button class="action-btn delete plan-delete-btn" data-id="${plan.id}" title="${App.t('delete')}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>`;
  }

  async function renderGallery() {
    const gallery = document.getElementById('plans-gallery');
    const empty = document.getElementById('plans-empty');

    const filtered = activeCategory === '__all__'
      ? allPlans
      : allPlans.filter(p => p.category === activeCategory);

    if (filtered.length === 0) {
      gallery.innerHTML = '';
      gallery.style.display = 'none';
      empty.style.display = allPlans.length === 0 ? 'flex' : 'none';
      if (allPlans.length > 0 && filtered.length === 0) {
        gallery.style.display = 'block';
        gallery.innerHTML = `<div class="empty-state"><p>${App.t('no_plans_in_category')}</p></div>`;
      }
      return;
    }

    empty.style.display = 'none';

    // Grouped view when showing all categories
    if (activeCategory === '__all__') {
      gallery.style.display = 'block';
      let html = '';
      let globalIdx = 0;

      for (const cat of getAllPlanCategories()) {
        const catPlans = filtered.filter(p => p.category === cat.key);
        if (catPlans.length === 0) continue;

        const cards = await Promise.all(catPlans.map((plan) => buildCardHTML(plan, globalIdx++)));

        html += `
          <div class="plans-group">
            <div class="plans-group-header">
              <i data-lucide="${cat.icon}"></i>
              <h3>${cat.label}</h3>
              <span class="plans-group-count">${catPlans.length}</span>
            </div>
            <div class="plans-group-grid">${cards.join('')}</div>
          </div>`;
      }

      gallery.innerHTML = html;
    } else {
      // Single category — flat grid
      gallery.style.display = 'grid';
      const cards = await Promise.all(filtered.map((plan, idx) => buildCardHTML(plan, idx)));
      gallery.innerHTML = cards.join('');
    }

    // Bind thumbnail click → viewer
    gallery.querySelectorAll('.plan-card-thumb').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const planId = parseInt(thumb.dataset.planId);
        const idx = filtered.findIndex(p => p.id === planId);
        openViewer(filtered, idx >= 0 ? idx : 0);
      });
    });

    // Bind edit
    gallery.querySelectorAll('.plan-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        editPlan(parseInt(btn.dataset.id));
      });
    });

    // Bind delete
    gallery.querySelectorAll('.plan-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePlan(parseInt(btn.dataset.id));
      });
    });

    try { lucide.createIcons(); } catch(e) {}
  }

  async function editPlan(id) {
    const plan = await DB.getById('plans', id);
    if (!plan) return;

    const body = `
      <div class="form-group">
        <label>Nombre del plano</label>
        <input type="text" id="plan-edit-name" value="${App.escapeHTML(plan.name)}">
      </div>
      <div class="form-group">
        <label>Categoría</label>
        <select id="plan-edit-category">
          ${getAllPlanCategories().map(c => `<option value="${c.key}" ${plan.category === c.key ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
      </div>`;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-plan-edit"><i data-lucide="save"></i> Guardar</button>`;

    App.openModal('Editar Plano', body, footer);

    document.getElementById('btn-save-plan-edit').addEventListener('click', async () => {
      plan.name = document.getElementById('plan-edit-name').value.trim() || plan.name;
      plan.category = document.getElementById('plan-edit-category').value;
      await DB.put('plans', plan);
      App.closeModal();
      App.toast(App.t('plan_updated'), 'success');
      loadPlans();
    });
  }

  async function deletePlan(id) {
    if (!await App.confirm(App.t('confirm_delete_plan'))) return;
    const plan = await DB.getById('plans', id);
    if (plan) {
      await DB.remove('files', plan.fileId);
    }
    await DB.remove('plans', id);
    App.toast(App.t('plan_deleted'), 'info');
    loadPlans();
  }

  // ======== VIEWER / LIGHTBOX ========

  let annoCanvas = null;
  let annoMode = false;
  let annoTool = 'draw';
  let annoHistory = [];
  let annoZoom = 1;
  let annoBaseZoom = 1;
  let annoBgObjectUrl = null;
  let isClosingViewer = false;

  let showAnnotations = true;

  function normalizeAnnoPayload(payload) {
    if (!payload || typeof payload !== 'object') return { objects: [] };
    const normalized = JSON.parse(JSON.stringify(payload));
    delete normalized.backgroundImage;
    delete normalized.background;
    return normalized;
  }

  function snapshotAnnoState() {
    if (!annoCanvas) return null;
    return normalizeAnnoPayload(annoCanvas.toJSON());
  }

  function setupViewer() {
    const overlay = document.getElementById('plan-viewer-overlay');
    document.getElementById('plan-viewer-close').addEventListener('click', closeViewer);
    document.getElementById('plan-viewer-download').addEventListener('click', showDownloadMenu);
    document.getElementById('plan-viewer-zoom-in').addEventListener('click', () => setZoom(viewerZoom * 1.3));
    document.getElementById('plan-viewer-zoom-out').addEventListener('click', () => setZoom(viewerZoom / 1.3));
    document.getElementById('plan-viewer-fit').addEventListener('click', () => setZoom(1));
    document.getElementById('plan-viewer-prev').addEventListener('click', () => viewerNav(-1));
    document.getElementById('plan-viewer-next').addEventListener('click', () => viewerNav(1));
    document.getElementById('plan-viewer-annotate').addEventListener('click', enterAnnotateMode);
    document.getElementById('plan-viewer-toggle-annotations').addEventListener('click', toggleAnnotations);

    // Annotation toolbar
    document.querySelectorAll('.plan-anno-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.plan-anno-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        annoTool = btn.dataset.tool;
        applyAnnoTool();
      });
    });
    document.getElementById('plan-anno-undo').addEventListener('click', annoUndo);
    document.getElementById('plan-anno-clear').addEventListener('click', annoClear);
    document.getElementById('plan-anno-save').addEventListener('click', annoSave);
    document.getElementById('plan-anno-exit').addEventListener('click', exitAnnotateMode);
    document.getElementById('plan-anno-color').addEventListener('input', applyAnnoTool);
    document.getElementById('plan-anno-width').addEventListener('change', applyAnnoTool);
    document.getElementById('plan-anno-zoom-in').addEventListener('click', () => setAnnoZoom(annoZoom * 1.2));
    document.getElementById('plan-anno-zoom-out').addEventListener('click', () => setAnnoZoom(annoZoom / 1.2));
    document.getElementById('plan-anno-fit').addEventListener('click', fitAnnoCanvas);
    document.getElementById('plan-anno-duplicate').addEventListener('click', annoDuplicateSelection);

    overlay.addEventListener('click', (e) => {
      if (!annoMode && (e.target === overlay || e.target.classList.contains('plan-viewer-body'))) closeViewer();
    });

    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('active')) return;
      if (annoMode) {
        if (e.key === 'Escape') exitAnnotateMode();
        if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); annoUndo(); }
        if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); annoDuplicateSelection(); }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); annoDeleteSelection(); }
        if (e.key === '+' || e.key === '=') { e.preventDefault(); setAnnoZoom(annoZoom * 1.2); }
        if (e.key === '-') { e.preventDefault(); setAnnoZoom(annoZoom / 1.2); }
        return;
      }
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowLeft') viewerNav(-1);
      if (e.key === 'ArrowRight') viewerNav(1);
      if (e.key === '+' || e.key === '=') setZoom(viewerZoom * 1.3);
      if (e.key === '-') setZoom(viewerZoom / 1.3);
    });

    // Mouse wheel: zoom (Ctrl) or pan (no Ctrl) in annotation mode
    const body = document.getElementById('plan-viewer-body');
    body.addEventListener('wheel', (e) => {
      if (annoMode) {
        e.preventDefault();
        if (e.ctrlKey) {
          // Ctrl+wheel = zoom
          setAnnoZoom(annoZoom * (e.deltaY > 0 ? 0.9 : 1.1));
        } else {
          // Wheel = pan
          const vpt = annoCanvas.viewportTransform.slice();
          vpt[4] -= e.deltaX || 0;
          vpt[5] -= e.deltaY || 0;
          annoCanvas.setViewportTransform(vpt);
        }
        return;
      }
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(viewerZoom * delta);
    }, { passive: false });
  }

  let viewerPlans = [];

  async function openViewer(plans, idx) {
    viewerPlans = plans;
    viewerIndex = idx;
    viewerZoom = 1;
    annoMode = false;
    document.getElementById('plan-anno-toolbar').style.display = 'none';
    const overlay = document.getElementById('plan-viewer-overlay');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    await renderViewerContent();
  }

  function closeViewer() {
    isClosingViewer = true;
    if (annoMode) exitAnnotateMode({ suppressRender: true });
    document.getElementById('plan-viewer-overlay').classList.remove('active');
    document.body.style.overflow = '';
    destroyAnnoCanvas();
    clearViewerObjectUrl();
    document.getElementById('plan-viewer-body').innerHTML = '';
    isClosingViewer = false;
  }

  function clearViewerObjectUrl() {
    const body = document.getElementById('plan-viewer-body');
    const currentUrl = body?.dataset?.objectUrl;
    if (currentUrl) {
      try { URL.revokeObjectURL(currentUrl); } catch (e) {}
      delete body.dataset.objectUrl;
    }
  }

  async function viewerNav(dir) {
    if (annoMode) return;
    if (viewerPlans.length === 0) return;
    viewerIndex = (viewerIndex + dir + viewerPlans.length) % viewerPlans.length;
    viewerZoom = 1;
    await renderViewerContent();
  }

  function setZoom(z) {
    if (annoMode) return;
    viewerZoom = Math.max(0.1, Math.min(z, 10));
    const imgs = document.querySelectorAll('#plan-viewer-body img');
    imgs.forEach(img => img.style.transform = `scale(${viewerZoom})`);
  }

  async function downloadCurrentPlan() {
    const plan = viewerPlans[viewerIndex];
    if (!plan) return;
    const file = await DB.getFile(plan.fileId);
    if (!file) { App.toast(App.t('file_not_found'), 'error'); return; }
    const blob = file.blob || (file.data ? new Blob([file.data], { type: file.type }) : null);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || plan.name + (file.type === 'application/pdf' ? '.pdf' : '.png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  async function downloadAnnotatedPlan() {
    const plan = viewerPlans[viewerIndex];
    if (!plan) return;

    if (!plan.annotations) {
      App.toast(App.t('plan_no_annotations') || 'Este plano no tiene anotaciones', 'warning');
      return;
    }

    const file = await DB.getFile(plan.fileId);
    if (!file) { App.toast(App.t('file_not_found'), 'error'); return; }

    const sourceBlob = file.blob || (file.data ? new Blob([file.data], { type: file.type }) : null);
    if (!sourceBlob) return;

    let parsed = null;
    try {
      const parsedRaw = typeof plan.annotations === 'string' ? JSON.parse(plan.annotations) : plan.annotations;
      parsed = normalizeAnnoPayload(parsedRaw);
    } catch(e) {
      console.warn('Error parsing annotations:', e);
      App.toast(App.t('file_content_unavailable'), 'error');
      return;
    }

    // Annotation canvas dimensions (may be display-size, not full-res)
    const annoW = Number(parsed?.__canvasWidth || parsed?.canvasWidth || 0);
    const annoH = Number(parsed?.__canvasHeight || parsed?.canvasHeight || 0);

    // Render background at HIGH resolution (300 DPI equivalent)
    const HIGH_RES_SCALE = 3; // 3x PDF default 72dpi = ~216 DPI; for 300 DPI use ~4.17
    let bgImg = null;
    let outW = 0, outH = 0;
    let pdfPageW_mm = 210, pdfPageH_mm = 297; // default A4

    if (file.type && file.type.startsWith('image/')) {
      const srcUrl = URL.createObjectURL(sourceBlob);
      try {
        bgImg = new Image();
        bgImg.src = srcUrl;
        await new Promise((resolve, reject) => { bgImg.onload = resolve; bgImg.onerror = reject; });
        outW = bgImg.width;
        outH = bgImg.height;
        // Estimate page size: assume 96 DPI for image
        pdfPageW_mm = outW * 25.4 / 96;
        pdfPageH_mm = outH * 25.4 / 96;
      } finally {
        URL.revokeObjectURL(srcUrl);
      }
    } else if (file.type === 'application/pdf' && typeof pdfjsLib !== 'undefined') {
      const arrayBuf = await sourceBlob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
      const page = await pdf.getPage(1);
      const baseVp = page.getViewport({ scale: 1 });

      // High-res render
      const renderScale = HIGH_RES_SCALE;
      const viewport = page.getViewport({ scale: renderScale });
      outW = Math.round(viewport.width);
      outH = Math.round(viewport.height);

      const pdfCanvas = document.createElement('canvas');
      pdfCanvas.width = outW;
      pdfCanvas.height = outH;
      const pdfCtx = pdfCanvas.getContext('2d');
      pdfCtx.fillStyle = '#ffffff';
      pdfCtx.fillRect(0, 0, outW, outH);
      await page.render({ canvasContext: pdfCtx, viewport }).promise;

      bgImg = new Image();
      bgImg.src = pdfCanvas.toDataURL('image/png');
      await new Promise((resolve, reject) => { bgImg.onload = resolve; bgImg.onerror = reject; });

      // Get original PDF page size in mm
      const pdfPage = page.getViewport({ scale: 1 });
      // PDF units: 1 point = 1/72 inch
      pdfPageW_mm = pdfPage.width * 25.4 / 72;
      pdfPageH_mm = pdfPage.height * 25.4 / 72;
    }

    if (!bgImg || !outW || !outH) {
      App.toast(App.t('preview_not_available'), 'error');
      return;
    }

    // Scale annotations from annotation-canvas coords to high-res output coords
    if (annoW > 0 && annoH > 0) {
      const sx = outW / annoW;
      const sy = outH / annoH;
      if (Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01) {
        parsed.objects.forEach(obj => scaleAnnoObject(obj, sx, sy));
      }
    }

    // Create export canvas at high resolution
    const exportCanvas = new fabric.StaticCanvas(null, {
      width: outW,
      height: outH,
      enableRetinaScaling: false,
      backgroundColor: '#ffffff'
    });

    // Set background using pre-loaded Image element
    const bgFabricImg = new fabric.Image(bgImg);
    exportCanvas.setBackgroundImage(bgFabricImg, exportCanvas.renderAll.bind(exportCanvas), {
      scaleX: outW / bgImg.width,
      scaleY: outH / bgImg.height
    });

    // Load annotations on top
    await new Promise(resolve => {
      exportCanvas.loadFromJSON(parsed, () => {
        const bgFabricImg2 = new fabric.Image(bgImg);
        exportCanvas.backgroundColor = '#ffffff';
        exportCanvas.setBackgroundImage(bgFabricImg2, () => {
          exportCanvas.renderAll();
          resolve();
        }, { scaleX: outW / bgImg.width, scaleY: outH / bgImg.height });
      });
    });

    // Export as high-quality image
    const imgDataUrl = exportCanvas.toDataURL({ format: 'jpeg', quality: 0.95, multiplier: 1 });
    exportCanvas.dispose();

    // Create PDF at original page dimensions
    const { jsPDF } = window.jspdf;
    const orientation = pdfPageW_mm > pdfPageH_mm ? 'l' : 'p';
    const pdfDoc = new jsPDF({ orientation, unit: 'mm', format: [pdfPageW_mm, pdfPageH_mm] });
    pdfDoc.addImage(imgDataUrl, 'JPEG', 0, 0, pdfPageW_mm, pdfPageH_mm, undefined, 'FAST');
    pdfDoc.save(plan.name + '_anotado.pdf');
  }

  async function showDownloadMenu() {
    const plan = viewerPlans[viewerIndex];
    if (!plan) return;

    const hasAnnotations = plan.annotations && plan.annotations !== '{}';
    const menu = document.createElement('div');
    menu.style.cssText = 'position:absolute;z-index:10000;background:#1e293b;border:1px solid #475569;border-radius:8px;padding:4px;min-width:200px;box-shadow:0 8px 24px rgba(0,0,0,0.5);font-family:inherit;';

    let menuHTML = `<button data-action="download-original" style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;border:none;background:transparent;color:#e2e8f0;font-size:0.875rem;cursor:pointer;border-radius:6px;text-align:left;font-family:inherit;">
      <i data-lucide="download" style="width:16px;height:16px;"></i> ${App.t('download_original') || 'Descargar original'}
    </button>`;

    if (hasAnnotations) {
      menuHTML += `<button data-action="download-annotated" style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;border:none;background:transparent;color:#e2e8f0;font-size:0.875rem;cursor:pointer;border-radius:6px;text-align:left;font-family:inherit;">
        <i data-lucide="edit-3" style="width:16px;height:16px;"></i> ${App.t('download_annotated') || 'Descargar con anotaciones (PDF)'}
      </button>`;
    }

    menu.innerHTML = menuHTML;

    const btn = document.getElementById('plan-viewer-download');
    const rect = btn.getBoundingClientRect();
    menu.style.top = (rect.bottom + 5) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';

    document.body.appendChild(menu);
    lucide.createIcons();

    // Hover effect
    menu.querySelectorAll('button').forEach(b => {
      b.addEventListener('mouseenter', () => b.style.background = '#334155');
      b.addEventListener('mouseleave', () => b.style.background = 'transparent');
    });

    menu.querySelectorAll('button[data-action]').forEach(item => {
      item.addEventListener('click', async () => {
        const action = item.dataset.action;
        if (action === 'download-original') {
          await downloadCurrentPlan();
        } else if (action === 'download-annotated') {
          await downloadAnnotatedPlan();
        }
        if (menu.parentNode) document.body.removeChild(menu);
      });
    });

    const closeMenu = (e) => {
      if (!menu.contains(e.target) && e.target !== btn) {
        if (menu.parentNode) document.body.removeChild(menu);
        document.removeEventListener('click', closeMenu);
      }
    };

    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  async function renderViewerContent() {
    const plan = viewerPlans[viewerIndex];
    if (!plan) return;
    const file = await DB.getFile(plan.fileId);
    const body = document.getElementById('plan-viewer-body');
    clearViewerObjectUrl();
    body.scrollTop = 0;
    body.scrollLeft = 0;
    document.getElementById('plan-viewer-title').textContent = `${plan.name} (${viewerIndex + 1}/${viewerPlans.length})`;

    if (!file) {
      body.innerHTML = `<p style="color:#fff;text-align:center">${App.t('file_not_found')}</p>`;
      return;
    }

    const blob = file.blob || (file.data ? new Blob([file.data], { type: file.type || 'image/*' }) : null);
    if (!blob) {
      body.innerHTML = `<p style="color:#fff;text-align:center">${App.t('file_content_unavailable')}</p>`;
      return;
    }

    // Show annotate button for images and PDFs (rendered as image)
    const annoBtn = document.getElementById('plan-viewer-annotate');
    const isImage = file.type && file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    const hasAnnotations = plan.annotations && plan.annotations !== '{}';
    annoBtn.style.display = (isImage || isPDF) ? '' : 'none';

    if (isImage) {
      const url = URL.createObjectURL(blob);
      body.dataset.objectUrl = url;
      body.innerHTML = `<img src="${url}" alt="${App.escapeHTML(plan.name)}" style="transform:scale(${viewerZoom})" draggable="false">`;
    } else if (isPDF && typeof pdfjsLib !== 'undefined') {
      // Render PDF pages as images for viewing and annotation support
      try {
        const arrayBuf = await blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
        const numPages = pdf.numPages;
        let pagesHTML = '';
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          const scale = Math.min(1200 / vp.width, 2);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/png');
          pagesHTML += `<img src="${dataUrl}" alt="Página ${i}" class="plan-viewer-page" style="transform:scale(${viewerZoom})" draggable="false">`;
        }
        body.innerHTML = pagesHTML;
        // Store rendered data URL for annotation use
        body.dataset.pdfRendered = 'true';
      } catch(e) {
        console.warn('PDF render error:', e);
        const url = URL.createObjectURL(blob);
        body.dataset.objectUrl = url;
        body.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:none;border-radius:8px"></iframe>`;
        annoBtn.style.display = 'none';
      }
    } else if (isPDF) {
      const url = URL.createObjectURL(blob);
      body.dataset.objectUrl = url;
      body.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:none;border-radius:8px"></iframe>`;
      annoBtn.style.display = 'none';
    } else {
      body.innerHTML = `<p style="color:#fff;text-align:center">${App.t('preview_not_available')}</p>`;
    }

    // Auto-enter annotate mode if plan has annotations and showAnnotations is true
    if (hasAnnotations && !annoMode && showAnnotations && !isClosingViewer) {
      await enterAnnotateMode();
    }

    try { lucide.createIcons(); } catch(e) {}
  }

  function toggleAnnotations() {
    showAnnotations = !showAnnotations;
    if (!isClosingViewer) {
      renderViewerContent();
    }
  }

  // ======== ANNOTATION MODE ========

  async function enterAnnotateMode() {
    const plan = viewerPlans[viewerIndex];
    if (!plan) return;
    const file = await DB.getFile(plan.fileId);
    if (!file) return;

    const isImage = file.type && file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    if (!isImage && !isPDF) return;

    try {
      annoMode = true;
      annoZoom = 1;
      annoBaseZoom = 1;
      annoHistory = [];
      annoTool = 'draw';
      document.getElementById('plan-anno-toolbar').style.display = 'flex';
      document.getElementById('plan-viewer-annotate').style.display = 'none';
      const defaultBtn = document.querySelector('.plan-anno-btn[data-tool="draw"]');
      document.querySelectorAll('.plan-anno-btn[data-tool]').forEach(b => b.classList.remove('active'));
      if (defaultBtn) defaultBtn.classList.add('active');

      // Hide zoom/nav buttons during annotation
      ['plan-viewer-zoom-in', 'plan-viewer-zoom-out', 'plan-viewer-fit', 'plan-viewer-prev', 'plan-viewer-next'].forEach(id => {
        document.getElementById(id).style.display = 'none';
      });

      const body = document.getElementById('plan-viewer-body');
      body.scrollTop = 0;
      body.scrollLeft = 0;
      let bgUrl;

      if (isImage) {
        const blob = file.blob || (file.data ? new Blob([file.data], { type: file.type }) : null);
        bgUrl = URL.createObjectURL(blob);
        annoBgObjectUrl = bgUrl;
      } else if (isPDF) {
        const blob = file.blob || (file.data ? new Blob([file.data], { type: file.type }) : null);
        const arrayBuf = await blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        const scale = Math.min(2400 / vp.width, 3);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        bgUrl = canvas.toDataURL('image/png');
      }

      // Load image to get dimensions
      const img = new Image();
      img.src = bgUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Pre-scale image to a reasonable max resolution for annotation quality
      const maxAnnoSide = 2400;
      const imgScale = Math.min(1, maxAnnoSide / img.width, maxAnnoSide / img.height);
      const nativeW = Math.max(1, Math.round(img.width * imgScale));
      const nativeH = Math.max(1, Math.round(img.height * imgScale));

      // Draw image at native annotation resolution onto temp canvas
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = nativeW;
      tmpCanvas.height = nativeH;
      const tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.fillStyle = '#ffffff';
      tmpCtx.fillRect(0, 0, nativeW, nativeH);
      tmpCtx.drawImage(img, 0, 0, nativeW, nativeH);
      const nativeDataUrl = tmpCanvas.toDataURL('image/png');

      // Load pre-scaled image
      const scaledImg = new Image();
      scaledImg.src = nativeDataUrl;
      await new Promise((resolve, reject) => {
        scaledImg.onload = resolve;
        scaledImg.onerror = reject;
      });

      // Calculate canvas display size to fit in viewport
      const rect = body.getBoundingClientRect();
      const padX = 32, padY = 32;
      const availW = Math.max(200, rect.width - padX);
      const availH = Math.max(200, rect.height - padY);
      const imgAspect = nativeW / nativeH;
      const viewAspect = availW / availH;

      let canvasW, canvasH;
      if (imgAspect > viewAspect) {
        canvasW = Math.min(availW, nativeW);
        canvasH = Math.round(canvasW / imgAspect);
      } else {
        canvasH = Math.min(availH, nativeH);
        canvasW = Math.round(canvasH * imgAspect);
      }
      canvasW = Math.max(1, Math.round(canvasW));
      canvasH = Math.max(1, Math.round(canvasH));

      const bgScaleX = canvasW / nativeW;
      const bgScaleY = canvasH / nativeH;

      body.innerHTML = `<div class="plan-anno-stage"><canvas id="plan-anno-canvas" width="${canvasW}" height="${canvasH}"></canvas></div>`;

      annoCanvas = new fabric.Canvas('plan-anno-canvas', {
        width: canvasW,
        height: canvasH,
        selection: false,
        preserveObjectStacking: true,
        backgroundColor: '#ffffff'
      });

      // Create fabric.Image from the pre-scaled HTML Image element (synchronous)
      const bgFabricImg = new fabric.Image(scaledImg);

      // Set plan as background — fills canvas exactly
      annoCanvas.setBackgroundImage(bgFabricImg, annoCanvas.renderAll.bind(annoCanvas), {
        scaleX: bgScaleX,
        scaleY: bgScaleY
      });
      annoCanvas.renderAll();

      // Load existing annotations
      if (plan.annotations) {
        try {
          const parsedRaw = typeof plan.annotations === 'string' ? JSON.parse(plan.annotations) : plan.annotations;
          const parsed = normalizeAnnoPayload(parsedRaw);
          if (parsed.objects && parsed.objects.length > 0) {
            const savedWidth = Number(parsed.__canvasWidth || parsed.canvasWidth || canvasW);
            const savedHeight = Number(parsed.__canvasHeight || parsed.canvasHeight || canvasH);
            if (savedWidth > 0 && savedHeight > 0 && (Math.abs(savedWidth - canvasW) > 1 || Math.abs(savedHeight - canvasH) > 1)) {
              const sx = canvasW / savedWidth;
              const sy = canvasH / savedHeight;
              parsed.objects.forEach(obj => scaleAnnoObject(obj, sx, sy));
            }

            await new Promise(resolve => {
              annoCanvas.loadFromJSON(parsed, () => {
                annoCanvas.backgroundColor = '#ffffff';
                annoCanvas.setBackgroundImage(bgFabricImg, () => {
                  annoCanvas.renderAll();
                  resolve();
                }, { scaleX: bgScaleX, scaleY: bgScaleY });
              });
            });
          }
        } catch(e) { console.warn('Error loading annotations:', e); }
      }

      annoCanvas.on('object:modified', pushHistory);
      annoCanvas.on('path:created', pushHistory);

      applyAnnoTool();
      annoHistory = [snapshotAnnoState()];
      annoBaseZoom = 1;
      setAnnoZoom(1);
      try { lucide.createIcons(); } catch(e) {}
    } catch (e) {
      console.error('Error entering annotate mode:', e);
      App.toast(App.t('file_content_unavailable') || 'No se pudo abrir la edición del plano', 'error');
      exitAnnotateMode({ suppressRender: false });
    }
  }

  function exitAnnotateMode({ suppressRender = false } = {}) {
    annoMode = false;
    annoBaseZoom = 1;
    destroyAnnoCanvas();
    document.getElementById('plan-anno-toolbar').style.display = 'none';

    // Restore viewer buttons
    document.getElementById('plan-viewer-annotate').style.display = '';
    ['plan-viewer-zoom-in', 'plan-viewer-zoom-out', 'plan-viewer-fit', 'plan-viewer-prev', 'plan-viewer-next'].forEach(id => {
      document.getElementById(id).style.display = '';
    });

    if (!suppressRender && !isClosingViewer) {
      renderViewerContent();
    }
  }

  function destroyAnnoCanvas() {
    if (annoBgObjectUrl) {
      URL.revokeObjectURL(annoBgObjectUrl);
      annoBgObjectUrl = null;
    }
    if (annoCanvas) {
      annoCanvas.dispose();
      annoCanvas = null;
    }
  }

  function applyAnnoTool() {
    if (!annoCanvas) return;
    const color = document.getElementById('plan-anno-color').value;
    const width = parseInt(document.getElementById('plan-anno-width').value) || 4;

    annoCanvas.isDrawingMode = false;
    annoCanvas.selection = annoTool === 'select';
    annoCanvas.defaultCursor = 'crosshair';

    // Remove temp event listeners
    annoCanvas.off('mouse:down');
    annoCanvas.off('mouse:move');
    annoCanvas.off('mouse:up');

    const interactive = annoTool === 'select';
    annoCanvas.forEachObject(obj => {
      obj.selectable = interactive;
      obj.evented = interactive;
    });
    if (interactive) {
      annoCanvas.defaultCursor = 'default';
      annoCanvas.hoverCursor = 'move';
      annoCanvas.requestRenderAll();
      return;
    }

    if (annoTool === 'hand') {
      // Pan mode: drag to move viewport
      annoCanvas.defaultCursor = 'grab';
      let panning = false;
      let lastX, lastY;
      annoCanvas.on('mouse:down', (e) => {
        panning = true;
        lastX = e.e.clientX;
        lastY = e.e.clientY;
        annoCanvas.defaultCursor = 'grabbing';
      });
      annoCanvas.on('mouse:move', (e) => {
        if (!panning) return;
        const dx = e.e.clientX - lastX;
        const dy = e.e.clientY - lastY;
        lastX = e.e.clientX;
        lastY = e.e.clientY;
        const vpt = annoCanvas.viewportTransform.slice();
        vpt[4] += dx;
        vpt[5] += dy;
        annoCanvas.setViewportTransform(vpt);
      });
      annoCanvas.on('mouse:up', () => {
        panning = false;
        annoCanvas.defaultCursor = 'grab';
      });
    } else if (annoTool === 'draw') {
      annoCanvas.isDrawingMode = true;
      annoCanvas.freeDrawingBrush.color = color;
      annoCanvas.freeDrawingBrush.width = width;
    } else if (annoTool === 'erase') {
      annoCanvas.defaultCursor = 'crosshair';
      let erasing = false;
      let didErase = false;
      const hitRadius = Math.max(6, width * 2);

      const eraseAtPointer = (pointer) => {
        const objs = annoCanvas.getObjects();
        if (!objs.length) return;
        const victims = [];
        for (let i = objs.length - 1; i >= 0; i--) {
          const obj = objs[i];
          const bounds = obj.getBoundingRect(true, true);
          if (
            pointer.x >= (bounds.left - hitRadius) &&
            pointer.x <= (bounds.left + bounds.width + hitRadius) &&
            pointer.y >= (bounds.top - hitRadius) &&
            pointer.y <= (bounds.top + bounds.height + hitRadius)
          ) {
            victims.push(obj);
          }
        }
        if (!victims.length) return;
        if (!didErase) {
          pushHistory();
          didErase = true;
        }
        victims.forEach(obj => annoCanvas.remove(obj));
        annoCanvas.requestRenderAll();
      };

      annoCanvas.on('mouse:down', (e) => {
        erasing = true;
        didErase = false;
        const p = annoCanvas.getPointer(e.e);
        eraseAtPointer(p);
      });
      annoCanvas.on('mouse:move', (e) => {
        if (!erasing) return;
        const p = annoCanvas.getPointer(e.e);
        eraseAtPointer(p);
      });
      annoCanvas.on('mouse:up', () => {
        erasing = false;
      });
    } else if (annoTool === 'text') {
      annoCanvas.defaultCursor = 'text';
      annoCanvas.on('mouse:down', (e) => {
        if (e.target) return; // clicked existing object
        const pointer = annoCanvas.getPointer(e.e);
        const text = new fabric.IText('Nota', {
          left: pointer.x,
          top: pointer.y,
          fontSize: Math.max(16, width * 5),
          fill: color,
          fontFamily: 'Inter, sans-serif',
          fontWeight: '600',
          shadow: '1px 1px 2px rgba(0,0,0,0.5)'
        });
        annoCanvas.add(text);
        annoCanvas.setActiveObject(text);
        text.enterEditing();
        pushHistory();
      });
    } else if (annoTool === 'arrow' || annoTool === 'rect' || annoTool === 'circle') {
      let startX, startY, tempObj = null;

      annoCanvas.on('mouse:down', (e) => {
        if (e.target) return;
        const p = annoCanvas.getPointer(e.e);
        startX = p.x; startY = p.y;

        if (annoTool === 'rect') {
          tempObj = new fabric.Rect({
            left: startX, top: startY, width: 0, height: 0,
            fill: 'transparent', stroke: color, strokeWidth: width,
            selectable: true
          });
        } else if (annoTool === 'circle') {
          tempObj = new fabric.Ellipse({
            left: startX, top: startY, rx: 0, ry: 0,
            fill: 'transparent', stroke: color, strokeWidth: width,
            selectable: true
          });
        } else if (annoTool === 'arrow') {
          tempObj = new fabric.Line([startX, startY, startX, startY], {
            stroke: color, strokeWidth: width,
            selectable: true
          });
        }
        if (tempObj) annoCanvas.add(tempObj);
      });

      annoCanvas.on('mouse:move', (e) => {
        if (!tempObj) return;
        const p = annoCanvas.getPointer(e.e);
        if (annoTool === 'rect') {
          tempObj.set({
            width: Math.abs(p.x - startX),
            height: Math.abs(p.y - startY),
            left: Math.min(startX, p.x),
            top: Math.min(startY, p.y)
          });
        } else if (annoTool === 'circle') {
          tempObj.set({
            rx: Math.abs(p.x - startX) / 2,
            ry: Math.abs(p.y - startY) / 2,
            left: Math.min(startX, p.x),
            top: Math.min(startY, p.y)
          });
        } else if (annoTool === 'arrow') {
          tempObj.set({ x2: p.x, y2: p.y });
        }
        annoCanvas.renderAll();
      });

      annoCanvas.on('mouse:up', () => {
        if (tempObj) {
          // Add arrowhead for lines
          if (annoTool === 'arrow' && tempObj.type === 'line') {
            const x1 = tempObj.x1, y1 = tempObj.y1, x2 = tempObj.x2, y2 = tempObj.y2;
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const headLen = width * 4;
            const head = new fabric.Polygon([
              { x: x2, y: y2 },
              { x: x2 - headLen * Math.cos(angle - Math.PI / 6), y: y2 - headLen * Math.sin(angle - Math.PI / 6) },
              { x: x2 - headLen * Math.cos(angle + Math.PI / 6), y: y2 - headLen * Math.sin(angle + Math.PI / 6) }
            ], { fill: color, selectable: true });
            const group = new fabric.Group([tempObj, head], { selectable: true });
            annoCanvas.remove(tempObj);
            annoCanvas.add(group);
          }
          pushHistory();
          tempObj = null;
        }
      });
    }
  }

  function pushHistory() {
    if (!annoCanvas) return;
    const snap = snapshotAnnoState();
    if (snap) annoHistory.push(snap);
  }

  function annoUndo() {
    if (!annoCanvas) return;
    if (annoHistory.length > 1) {
      annoHistory.pop();
      const prev = normalizeAnnoPayload(annoHistory[annoHistory.length - 1]);
      // Save current bg fabric.Image before restore
      const bgImg = annoCanvas.backgroundImage;
      const bgSx = bgImg?.scaleX || 1;
      const bgSy = bgImg?.scaleY || 1;
      annoCanvas.loadFromJSON(prev, () => {
        annoCanvas.backgroundColor = '#ffffff';
        if (bgImg) {
          annoCanvas.setBackgroundImage(bgImg, () => {
            annoCanvas.renderAll();
          }, { scaleX: bgSx, scaleY: bgSy });
        } else {
          annoCanvas.renderAll();
        }
      });
    } else {
      App.toast(App.t('search_no_results') || 'Sin resultados', 'info');
    }
  }

  async function annoClear() {
    if (!annoCanvas) return;
    if (!await App.confirm(App.t('plan_anno_clear_confirm') || '¿Borrar todas las anotaciones?')) return;
    pushHistory();
    const objs = annoCanvas.getObjects().slice();
    objs.forEach(o => annoCanvas.remove(o));
    annoCanvas.renderAll();
  }

  function fitAnnoCanvas() {
    if (!annoCanvas) return;
    annoCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setAnnoZoom(annoBaseZoom || 1);
    const body = document.getElementById('plan-viewer-body');
    if (body) {
      body.scrollTop = 0;
      body.scrollLeft = 0;
    }
  }

  function setAnnoZoom(nextZoom) {
    if (!annoCanvas) return;
    const clamped = Math.max(0.1, Math.min(nextZoom, 8));
    const w = annoCanvas.getWidth();
    const h = annoCanvas.getHeight();
    // Zoom from center: keep center point fixed
    const panX = (w / 2) * (1 - clamped);
    const panY = (h / 2) * (1 - clamped);
    annoCanvas.setViewportTransform([clamped, 0, 0, clamped, panX, panY]);
    annoZoom = clamped;
    updateAnnoZoomLabel();
    annoCanvas.requestRenderAll();
  }

  function updateAnnoZoomLabel() {
    const label = document.getElementById('plan-anno-zoom-label');
    if (label) {
      label.textContent = `${Math.round(annoZoom * 100)}%`;
    }
  }

  function scaleAnnoObject(obj, sx, sy) {
    if (!obj || typeof obj !== 'object') return;
    if (typeof obj.left === 'number') obj.left *= sx;
    if (typeof obj.top === 'number') obj.top *= sy;
    if (typeof obj.scaleX === 'number') obj.scaleX *= sx;
    if (typeof obj.scaleY === 'number') obj.scaleY *= sy;
    if (typeof obj.strokeWidth === 'number') obj.strokeWidth *= Math.max(sx, sy);
    if (Array.isArray(obj.points)) {
      obj.points = obj.points.map(p => ({ ...p, x: (p.x || 0) * sx, y: (p.y || 0) * sy }));
    }
    if (Array.isArray(obj.objects)) {
      obj.objects.forEach(child => scaleAnnoObject(child, sx, sy));
    }
  }

  function annoDeleteSelection() {
    if (!annoCanvas) return;
    const selected = annoCanvas.getActiveObjects();
    if (!selected.length) return;
    pushHistory();
    selected.forEach(obj => annoCanvas.remove(obj));
    annoCanvas.discardActiveObject();
    annoCanvas.requestRenderAll();
  }

  function annoDuplicateSelection() {
    if (!annoCanvas) return;
    const active = annoCanvas.getActiveObject();
    if (!active) return;
    pushHistory();
    active.clone((clone) => {
      clone.set({
        left: (clone.left || 0) + 24,
        top: (clone.top || 0) + 24
      });
      annoCanvas.add(clone);
      annoCanvas.setActiveObject(clone);
      annoCanvas.requestRenderAll();
    });
  }

  async function annoSave() {
    if (!annoCanvas) return;
    const plan = viewerPlans[viewerIndex];
    if (!plan) return;

    // Save annotation JSON for future editing (don't modify original file)
    const json = snapshotAnnoState();
    if (!json) return;
    json.__canvasWidth = annoCanvas.getWidth();
    json.__canvasHeight = annoCanvas.getHeight();
    plan.annotations = JSON.stringify(json);

    await DB.put('plans', plan);
    App.toast(App.t('annotations_saved_on_plan'), 'success');
  }

  return {
    init,
    refresh: loadPlans,
    toggleAnnotations
  };
})();
