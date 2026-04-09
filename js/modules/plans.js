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
    { key: 'arquitectura', label: 'Arquitectura', icon: 'home', keywords: ['arquitect', 'planta', 'alzado', 'seccion', 'sección', 'fachada', 'distribuc'] },
    { key: 'estructura', label: 'Estructura', icon: 'box', keywords: ['estructur', 'forjado', 'ciment', 'pilar', 'viga', 'zapata', 'muro'] },
    { key: 'electricidad', label: 'Electricidad', icon: 'zap', keywords: ['electr', 'iluminac', 'alumbrado', 'baja tensión', 'cuadro'] },
    { key: 'fontaneria', label: 'Fontanería', icon: 'droplets', keywords: ['fontan', 'saneamiento', 'agua', 'desagüe'] },
    { key: 'climatizacion', label: 'Climatización', icon: 'thermometer', keywords: ['climatiz', 'calefacc', 'ventilac', 'aire acondicionado'] },
    { key: 'detalle', label: 'Detalles', icon: 'scan', keywords: ['detalle', 'detail', 'constructiv'] },
    { key: 'situacion', label: 'Situación', icon: 'map-pin', keywords: ['situac', 'emplazamiento', 'ubicac', 'topogr'] },
    { key: 'otros', label: 'Otros', icon: 'file', keywords: [] },
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
    const fileInput = document.getElementById('plan-file-input');
    const newInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newInput, fileInput);
    newInput.addEventListener('change', handleUpload);

    const bindClick = (id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const nb = btn.cloneNode(true);
      btn.parentNode.replaceChild(nb, btn);
      nb.addEventListener('click', () => document.getElementById('plan-file-input').click());
    };
    bindClick('btn-upload-plan');
    bindClick('btn-upload-plan-empty');

    setupViewer();
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    e.target.value = '';

    let count = 0;
    for (const file of files) {
      const category = guessCategory(file.name);
      const arrayBuffer = await file.arrayBuffer();
      await DB.saveFile(new Blob([arrayBuffer]), file.name, file.type, projectId);

      // Store plan metadata linking to the file
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
        gallery.style.display = 'flex';
        gallery.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>No hay planos en esta categoría</p></div>';
      }
      return;
    }

    gallery.style.display = 'grid';
    empty.style.display = 'none';

    const cards = await Promise.all(filtered.map(async (plan, idx) => {
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
    }));

    gallery.innerHTML = cards.join('');

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

  function setupViewer() {
    const overlay = document.getElementById('plan-viewer-overlay');
    document.getElementById('plan-viewer-close').addEventListener('click', closeViewer);
    document.getElementById('plan-viewer-zoom-in').addEventListener('click', () => setZoom(viewerZoom * 1.3));
    document.getElementById('plan-viewer-zoom-out').addEventListener('click', () => setZoom(viewerZoom / 1.3));
    document.getElementById('plan-viewer-fit').addEventListener('click', () => setZoom(1));
    document.getElementById('plan-viewer-prev').addEventListener('click', () => viewerNav(-1));
    document.getElementById('plan-viewer-next').addEventListener('click', () => viewerNav(1));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('plan-viewer-body')) closeViewer();
    });

    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('active')) return;
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowLeft') viewerNav(-1);
      if (e.key === 'ArrowRight') viewerNav(1);
      if (e.key === '+' || e.key === '=') setZoom(viewerZoom * 1.3);
      if (e.key === '-') setZoom(viewerZoom / 1.3);
    });

    // Mouse wheel zoom
    const body = document.getElementById('plan-viewer-body');
    body.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(viewerZoom * delta);
    }, { passive: false });

    // Touch pinch zoom
    let lastDist = 0;
    body.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    });
    body.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (lastDist > 0) setZoom(viewerZoom * (dist / lastDist));
        lastDist = dist;
      }
    });
  }

  let viewerPlans = [];

  async function openViewer(plans, idx) {
    viewerPlans = plans;
    viewerIndex = idx;
    viewerZoom = 1;
    const overlay = document.getElementById('plan-viewer-overlay');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    await renderViewerContent();
  }

  function closeViewer() {
    document.getElementById('plan-viewer-overlay').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('plan-viewer-body').innerHTML = '';
  }

  async function viewerNav(dir) {
    if (viewerPlans.length === 0) return;
    viewerIndex = (viewerIndex + dir + viewerPlans.length) % viewerPlans.length;
    viewerZoom = 1;
    await renderViewerContent();
  }

  function setZoom(z) {
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

  return {
    init,
    refresh: loadPlans
  };
})();
