/* ========================================
   Plans Module - Planos de Obra
   Visor de planos con zoom, categorías y lightbox
   ======================================== */

const PlansModule = (() => {
  let projectId = null;
  let allPlans = [];
  let activeCategory = '__all__';
  let viewerIndex = -1;
  let viewerZoom = 1;

  const PLAN_CATEGORIES = [
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

  function guessCategory(name) {
    const lower = (name || '').toLowerCase();
    for (const cat of PLAN_CATEGORIES) {
      if (cat.key === 'otros') continue;
      for (const kw of cat.keywords) {
        if (lower.includes(kw)) return cat.key;
      }
    }
    return 'otros';
  }

  function init(pid) {
    projectId = pid;
    setupButtons();
    loadPlans();
  }

  function setupButtons() {
    document.getElementById('plan-file-input').onchange = handleUpload;

    const triggerUpload = () => document.getElementById('plan-file-input').click();
    const btnUpload = document.getElementById('btn-upload-plan-section');
    if (btnUpload) btnUpload.onclick = triggerUpload;
    const btnEmpty = document.getElementById('btn-upload-plan-empty');
    if (btnEmpty) btnEmpty.onclick = triggerUpload;

    setupViewer();
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    e.target.value = '';

    // Build category selector modal
    const guessed = files.length === 1 ? guessCategory(files[0].name) : (activeCategory !== '__all__' ? activeCategory : 'otros');
    const body = `
      <div class="form-group">
        <label>Categoría para ${files.length > 1 ? 'los ' + files.length + ' planos' : '<b>' + App.escapeHTML(files[0].name) + '</b>'}</label>
        <select id="plan-upload-category" class="form-control">
          ${PLAN_CATEGORIES.map(c => `<option value="${c.key}" ${c.key === guessed ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
      </div>
      <div style="margin-top:.5rem;color:var(--text-muted);font-size:.85rem">
        ${files.length > 1 ? 'Se aplicará la misma categoría a todos los planos. Puedes cambiarla luego individualmente.' : 'Puedes cambiar la categoría más tarde desde el botón editar.'}
      </div>`;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-confirm-upload"><i data-lucide="upload"></i> Subir</button>`;

    App.openModal('Subir Plano', body, footer);

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
            projectId,
            createdAt: new Date().toISOString()
          });
          count++;
        }
      }
      App.toast(`${count} plano${count > 1 ? 's' : ''} subido${count > 1 ? 's' : ''}`, 'success');
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

    for (const cat of PLAN_CATEGORIES) {
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
      } else if (file.type === 'application/pdf') {
        thumbHTML = `<div class="plan-thumb-pdf"><i data-lucide="file-text"></i><span>PDF</span></div>`;
      }
    }
    if (!thumbHTML) {
      thumbHTML = `<div class="plan-thumb-pdf"><i data-lucide="image"></i></div>`;
    }

    const catObj = PLAN_CATEGORIES.find(c => c.key === plan.category) || PLAN_CATEGORIES[PLAN_CATEGORIES.length - 1];

    return `
      <div class="plan-card" data-plan-idx="${idx}">
        <div class="plan-card-thumb" data-plan-id="${plan.id}">${thumbHTML}</div>
        <div class="plan-card-info">
          <strong class="plan-card-name">${App.escapeHTML(plan.name)}</strong>
          <span class="badge badge-neutral plan-card-cat">${catObj.label}</span>
        </div>
        <div class="plan-card-actions">
          <button class="action-btn plan-edit-btn" data-id="${plan.id}" title="Editar nombre/categoría"><i data-lucide="pencil"></i></button>
          <button class="action-btn delete plan-delete-btn" data-id="${plan.id}" title="Eliminar"><i data-lucide="trash-2"></i></button>
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
        gallery.innerHTML = '<div class="empty-state"><p>No hay planos en esta categoría</p></div>';
      }
      return;
    }

    empty.style.display = 'none';

    // Grouped view when showing all categories
    if (activeCategory === '__all__') {
      gallery.style.display = 'block';
      let html = '';
      let globalIdx = 0;

      for (const cat of PLAN_CATEGORIES) {
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
    gallery.querySelectorAll('.plan-card-thumb').forEach((thumb, i) => {
      thumb.addEventListener('click', () => openViewer(filtered, i));
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
          ${PLAN_CATEGORIES.map(c => `<option value="${c.key}" ${plan.category === c.key ? 'selected' : ''}>${c.label}</option>`).join('')}
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
      App.toast('Plano actualizado', 'success');
      loadPlans();
    });
  }

  async function deletePlan(id) {
    if (!confirm('¿Eliminar este plano?')) return;
    const plan = await DB.getById('plans', id);
    if (plan) {
      await DB.remove('files', plan.fileId);
    }
    await DB.remove('plans', id);
    App.toast('Plano eliminado', 'info');
    loadPlans();
  }

  // ======== VIEWER / LIGHTBOX ========

  let annoCanvas = null;
  let annoMode = false;
  let annoTool = 'draw';
  let annoHistory = [];

  function setupViewer() {
    const overlay = document.getElementById('plan-viewer-overlay');
    document.getElementById('plan-viewer-close').addEventListener('click', closeViewer);
    document.getElementById('plan-viewer-zoom-in').addEventListener('click', () => setZoom(viewerZoom * 1.3));
    document.getElementById('plan-viewer-zoom-out').addEventListener('click', () => setZoom(viewerZoom / 1.3));
    document.getElementById('plan-viewer-fit').addEventListener('click', () => setZoom(1));
    document.getElementById('plan-viewer-prev').addEventListener('click', () => viewerNav(-1));
    document.getElementById('plan-viewer-next').addEventListener('click', () => viewerNav(1));
    document.getElementById('plan-viewer-annotate').addEventListener('click', enterAnnotateMode);

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

    overlay.addEventListener('click', (e) => {
      if (!annoMode && (e.target === overlay || e.target.classList.contains('plan-viewer-body'))) closeViewer();
    });

    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('active')) return;
      if (annoMode) {
        if (e.key === 'Escape') exitAnnotateMode();
        if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); annoUndo(); }
        return;
      }
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowLeft') viewerNav(-1);
      if (e.key === 'ArrowRight') viewerNav(1);
      if (e.key === '+' || e.key === '=') setZoom(viewerZoom * 1.3);
      if (e.key === '-') setZoom(viewerZoom / 1.3);
    });

    // Mouse wheel zoom (only when not annotating)
    const body = document.getElementById('plan-viewer-body');
    body.addEventListener('wheel', (e) => {
      if (annoMode) return;
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
    if (annoMode) exitAnnotateMode();
    document.getElementById('plan-viewer-overlay').classList.remove('active');
    document.body.style.overflow = '';
    destroyAnnoCanvas();
    document.getElementById('plan-viewer-body').innerHTML = '';
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
    const img = document.querySelector('#plan-viewer-body img');
    if (img) img.style.transform = `scale(${viewerZoom})`;
  }

  async function renderViewerContent() {
    const plan = viewerPlans[viewerIndex];
    if (!plan) return;
    const file = await DB.getFile(plan.fileId);
    const body = document.getElementById('plan-viewer-body');
    document.getElementById('plan-viewer-title').textContent = `${plan.name} (${viewerIndex + 1}/${viewerPlans.length})`;

    if (!file) {
      body.innerHTML = '<p style="color:#fff;text-align:center">Archivo no encontrado</p>';
      return;
    }

    const blob = file.blob || (file.data ? new Blob([file.data], { type: file.type || 'image/*' }) : null);
    if (!blob) {
      body.innerHTML = '<p style="color:#fff;text-align:center">Datos del archivo no disponibles</p>';
      return;
    }

    // Show annotate button only for images
    const annoBtn = document.getElementById('plan-viewer-annotate');
    annoBtn.style.display = (file.type && file.type.startsWith('image/')) ? '' : 'none';

    if (file.type && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(blob);
      body.innerHTML = `<img src="${url}" alt="${App.escapeHTML(plan.name)}" style="transform:scale(${viewerZoom})" draggable="false">`;
    } else if (file.type === 'application/pdf') {
      const url = URL.createObjectURL(blob);
      body.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:none;border-radius:8px"></iframe>`;
    } else {
      body.innerHTML = '<p style="color:#fff;text-align:center">Vista previa no disponible para este tipo de archivo</p>';
    }
    try { lucide.createIcons(); } catch(e) {}
  }

  // ======== ANNOTATION MODE ========

  async function enterAnnotateMode() {
    const plan = viewerPlans[viewerIndex];
    if (!plan) return;
    const file = await DB.getFile(plan.fileId);
    if (!file || !file.type || !file.type.startsWith('image/')) return;

    annoMode = true;
    annoHistory = [];
    document.getElementById('plan-anno-toolbar').style.display = 'flex';
    document.getElementById('plan-viewer-annotate').style.display = 'none';

    // Hide zoom/nav buttons during annotation
    ['plan-viewer-zoom-in', 'plan-viewer-zoom-out', 'plan-viewer-fit', 'plan-viewer-prev', 'plan-viewer-next'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });

    const body = document.getElementById('plan-viewer-body');
    const blob = file.blob || (file.data ? new Blob([file.data], { type: file.type }) : null);
    const url = URL.createObjectURL(blob);

    // Load image to get dimensions
    const img = new Image();
    img.src = url;
    await new Promise(r => { img.onload = r; });

    // Fit canvas to available space
    const rect = body.getBoundingClientRect();
    const scale = Math.min(rect.width / img.width, rect.height / img.height, 1);
    const cw = Math.round(img.width * scale);
    const ch = Math.round(img.height * scale);

    body.innerHTML = `<canvas id="plan-anno-canvas" width="${cw}" height="${ch}"></canvas>`;

    annoCanvas = new fabric.Canvas('plan-anno-canvas', {
      width: cw,
      height: ch,
      selection: false
    });

    // Set plan as background
    annoCanvas.setBackgroundImage(url, annoCanvas.renderAll.bind(annoCanvas), {
      scaleX: cw / img.width,
      scaleY: ch / img.height
    });

    // Load existing annotations
    if (plan.annotations) {
      try {
        const parsed = typeof plan.annotations === 'string' ? JSON.parse(plan.annotations) : plan.annotations;
        if (parsed.objects && parsed.objects.length > 0) {
          await new Promise(resolve => {
            annoCanvas.loadFromJSON(parsed, () => {
              // Re-set background (loadFromJSON clears it)
              annoCanvas.setBackgroundImage(url, () => {
                annoCanvas.renderAll();
                resolve();
              }, { scaleX: cw / img.width, scaleY: ch / img.height });
            });
          });
        }
      } catch(e) { console.warn('Error loading annotations:', e); }
    }

    applyAnnoTool();
    try { lucide.createIcons(); } catch(e) {}
  }

  function exitAnnotateMode() {
    annoMode = false;
    destroyAnnoCanvas();
    document.getElementById('plan-anno-toolbar').style.display = 'none';

    // Restore viewer buttons
    document.getElementById('plan-viewer-annotate').style.display = '';
    ['plan-viewer-zoom-in', 'plan-viewer-zoom-out', 'plan-viewer-fit', 'plan-viewer-prev', 'plan-viewer-next'].forEach(id => {
      document.getElementById(id).style.display = '';
    });

    renderViewerContent();
  }

  function destroyAnnoCanvas() {
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
    annoCanvas.selection = false;
    annoCanvas.defaultCursor = 'crosshair';

    // Remove temp event listeners
    annoCanvas.off('mouse:down');
    annoCanvas.off('mouse:move');
    annoCanvas.off('mouse:up');

    if (annoTool === 'draw') {
      annoCanvas.isDrawingMode = true;
      annoCanvas.freeDrawingBrush.color = color;
      annoCanvas.freeDrawingBrush.width = width;
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
    annoHistory.push(annoCanvas.toJSON());
  }

  function annoUndo() {
    if (!annoCanvas) return;
    if (annoHistory.length > 0) {
      const prev = annoHistory.pop();
      // Save current bg before restore
      const bgUrl = annoCanvas.backgroundImage?._element?.src;
      const bgSx = annoCanvas.backgroundImage?.scaleX || 1;
      const bgSy = annoCanvas.backgroundImage?.scaleY || 1;
      annoCanvas.loadFromJSON(prev, () => {
        if (bgUrl) {
          annoCanvas.setBackgroundImage(bgUrl, annoCanvas.renderAll.bind(annoCanvas), { scaleX: bgSx, scaleY: bgSy });
        } else {
          annoCanvas.renderAll();
        }
      });
    } else {
      // Last undo = clear all
      const objs = annoCanvas.getObjects().slice();
      objs.forEach(o => annoCanvas.remove(o));
      annoCanvas.renderAll();
    }
  }

  function annoClear() {
    if (!annoCanvas) return;
    if (!confirm('¿Borrar todas las anotaciones?')) return;
    pushHistory();
    const objs = annoCanvas.getObjects().slice();
    objs.forEach(o => annoCanvas.remove(o));
    annoCanvas.renderAll();
  }

  async function annoSave() {
    if (!annoCanvas) return;
    const plan = viewerPlans[viewerIndex];
    if (!plan) return;

    // Save only the annotation objects (no background)
    const json = annoCanvas.toJSON();
    // Remove background to save only annotations
    delete json.backgroundImage;
    delete json.background;

    plan.annotations = JSON.stringify(json);
    await DB.put('plans', plan);
    App.toast('Anotaciones guardadas', 'success');
  }

  return {
    init,
    refresh: loadPlans
  };
})();
