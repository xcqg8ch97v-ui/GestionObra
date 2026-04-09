/* ========================================
   App.js - Navegación y Utilidades
   Gestión de Obra PWA
   ======================================== */

const App = (() => {
  const sectionTitles = {
    overview: 'Vista General',
    canvas: 'Mesa de Trabajo',
    dashboard: 'Proveedores y Presupuestos',
    timeline: 'Cronograma de Obra',
    diary: 'Diario de Obra',
    plans: 'Planos de Obra',
    files: 'Documentos de Obra',
    participants: 'Participantes de la Obra'
  };

  let currentSection = 'overview';
  let currentProjectId = null;
  let currentProjectName = '';

  function safeIcons() {
    try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) { console.warn('Lucide icons error:', e); }
  }

  async function init() {
    try {
      await DB.open();
      loadTheme();
      setupModal();
      setupProjectSelector();
      setupThemeToggle();
      registerSW();
      safeIcons();
      showProjectSelector();
    } catch(e) {
      console.error('App init error:', e);
      document.getElementById('project-selector').style.display = 'flex';
    }
  }

  // ========================================
  // THEME
  // ========================================

  function loadTheme() {
    const saved = localStorage.getItem('abessis-theme') || 'dark';
    applyTheme(saved);
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    updateThemeLabels(theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('abessis-theme', next);
    applyTheme(next);
    lucide.createIcons();
  }

  function updateThemeLabels(theme) {
    const labels = document.querySelectorAll('.theme-label');
    labels.forEach(l => { l.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'; });
  }

  function setupThemeToggle() {
    const btn1 = document.getElementById('btn-theme-toggle');
    const btn2 = document.getElementById('btn-theme-selector');
    if (btn1) btn1.addEventListener('click', toggleTheme);
    if (btn2) btn2.addEventListener('click', toggleTheme);
  }

  // ========================================
  // PROJECT SELECTOR
  // ========================================

  function setupProjectSelector() {
    document.getElementById('btn-new-project')?.addEventListener('click', openProjectForm);
    document.getElementById('btn-new-project-empty')?.addEventListener('click', openProjectForm);
    document.getElementById('btn-import-project')?.addEventListener('click', importProject);
    document.getElementById('btn-back-projects')?.addEventListener('click', showProjectSelector);
    document.getElementById('btn-topbar-projects')?.addEventListener('click', showProjectSelector);
  }

  async function showProjectSelector() {
    currentProjectId = null;
    document.getElementById('project-selector').style.display = 'flex';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('main-content').style.display = 'none';
    await loadProjectCards();
    lucide.createIcons();
  }

  async function loadProjectCards() {
    const projects = await DB.getAll('projects');
    const grid = document.getElementById('project-grid');
    const empty = document.getElementById('projects-empty');

    if (projects.length === 0) {
      grid.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }

    grid.style.display = 'grid';
    empty.style.display = 'none';

    grid.innerHTML = projects.map(p => {
      const statusClass = p.status === 'active' ? 'badge-active' : p.status === 'finished' ? 'badge-positive' : 'badge-pending';
      const statusLabel = p.status === 'active' ? 'Activa' : p.status === 'finished' ? 'Finalizada' : 'En pausa';
      const photoHTML = p.clientPhoto
        ? `<img class="project-card-photo" src="${p.clientPhoto}" alt="">`
        : '';
      const deadlineHTML = p.targetEndDate
        ? `<div class="project-card-deadline">Entrega objetivo: ${formatDate(p.targetEndDate)}</div>`
        : '<div class="project-card-deadline">Entrega objetivo: sin definir</div>';
      return `
        <div class="project-card" onclick="App.enterProject(${p.id})">
          <div class="project-card-header">
            ${photoHTML}
            <div>
              <div class="project-card-name">${escapeHTML(p.name)}</div>
              <div class="project-card-client">${escapeHTML(p.client || 'Sin cliente')}</div>
              ${deadlineHTML}
            </div>
          </div>
          <div class="project-card-meta">
            <span class="badge ${statusClass}">${statusLabel}</span>
            <span class="project-card-date">${formatDate(p.createdAt)}</span>
          </div>
          <div class="project-card-actions" onclick="event.stopPropagation();">
            <button class="action-btn" onclick="App.exportProject(${p.id})" title="Exportar obra">
              <i data-lucide="download"></i>
            </button>
            <button class="action-btn" onclick="App.editProject(${p.id})" title="Editar obra">
              <i data-lucide="pencil"></i>
            </button>
            <button class="action-btn delete" onclick="App.deleteProject(${p.id})" title="Eliminar obra">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  }

  function openProjectForm(project = null) {
    const isEdit = project && project.id;
    const title = isEdit ? 'Editar Obra' : 'Nueva Obra';

    const hasPhoto = isEdit && project.clientPhoto;
    const body = `
      <div class="form-group">
        <label>Nombre de la Obra *</label>
        <input type="text" id="proj-name" value="${isEdit ? escapeHTML(project.name) : ''}" placeholder="Ej: Reforma Piso Calle Mayor 12">
      </div>
      <div class="form-group">
        <label>Cliente</label>
        <input type="text" id="proj-client" value="${isEdit ? escapeHTML(project.client || '') : ''}" placeholder="Nombre del cliente">
      </div>
      <div class="form-group">
        <label>Foto / Logo del cliente</label>
        <div class="client-photo-upload">
          <div class="client-photo-preview" id="proj-photo-preview" ${hasPhoto ? 'style="background-image:url(' + project.clientPhoto + ')"' : ''}>
            ${hasPhoto ? '' : '<i data-lucide="camera"></i><span>Subir foto</span>'}
          </div>
          <input type="file" id="proj-photo-input" accept="image/*" style="display:none">
          <div class="client-photo-actions">
            <button type="button" class="btn btn-outline btn-sm" id="btn-proj-photo">Elegir imagen</button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-proj-photo-remove" style="display:${hasPhoto ? 'inline-flex' : 'none'}">Quitar</button>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>Dirección</label>
        <input type="text" id="proj-address" value="${isEdit ? escapeHTML(project.address || '') : ''}" placeholder="Dirección de la obra">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Fecha objetivo original</label>
          <input type="date" id="proj-target-end" value="${isEdit ? escapeHTML(project.targetEndDate || '') : ''}">
        </div>
        <div class="form-group">
          <label>Estado</label>
          <select id="proj-status">
            <option value="active" ${isEdit && project.status === 'active' ? 'selected' : ''}>Activa</option>
            <option value="paused" ${isEdit && project.status === 'paused' ? 'selected' : ''}>En pausa</option>
            <option value="finished" ${isEdit && project.status === 'finished' ? 'selected' : ''}>Finalizada</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notas</label>
        <textarea id="proj-notes">${isEdit ? escapeHTML(project.notes || '') : ''}</textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-project">
        <i data-lucide="save"></i> ${isEdit ? 'Guardar' : 'Crear'}
      </button>
    `;

    openModal(title, body, footer);

    // Client photo upload logic
    let clientPhotoData = isEdit ? (project.clientPhoto || null) : null;
    const photoPreview = document.getElementById('proj-photo-preview');
    const photoInput = document.getElementById('proj-photo-input');
    const btnPhoto = document.getElementById('btn-proj-photo');
    const btnPhotoRemove = document.getElementById('btn-proj-photo-remove');

    btnPhoto.addEventListener('click', () => photoInput.click());
    photoPreview.addEventListener('click', () => photoInput.click());

    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        toast('La imagen no puede superar 2 MB', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        clientPhotoData = ev.target.result;
        photoPreview.style.backgroundImage = `url(${clientPhotoData})`;
        photoPreview.innerHTML = '';
        btnPhotoRemove.style.display = 'inline-flex';
      };
      reader.readAsDataURL(file);
      photoInput.value = '';
    });

    btnPhotoRemove.addEventListener('click', () => {
      clientPhotoData = null;
      photoPreview.style.backgroundImage = '';
      photoPreview.innerHTML = '<i data-lucide="camera"></i><span>Subir foto</span>';
      btnPhotoRemove.style.display = 'none';
      safeIcons();
    });

    document.getElementById('btn-save-project').addEventListener('click', async () => {
      const name = document.getElementById('proj-name').value.trim();
      if (!name) { toast('El nombre es obligatorio', 'warning'); return; }
      const targetEndDate = document.getElementById('proj-target-end').value;

      const data = {
        name,
        client: document.getElementById('proj-client').value.trim(),
        clientPhoto: clientPhotoData || null,
        address: document.getElementById('proj-address').value.trim(),
        targetEndDate: targetEndDate || '',
        status: document.getElementById('proj-status').value,
        notes: document.getElementById('proj-notes').value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = project.id;
        data.createdAt = project.createdAt;
        await DB.put('projects', data);
        await syncProjectDeadlineMilestone(data);
        toast('Obra actualizada', 'success');
      } else {
        data.createdAt = new Date().toISOString();
        const newId = await DB.add('projects', data);
        data.id = newId;
        await syncProjectDeadlineMilestone(data);
        toast('Obra creada', 'success');
      }

      closeModal();
      loadProjectCards();
    });
  }

  async function editProject(id) {
    const project = await DB.getById('projects', id);
    if (project) openProjectForm(project);
  }

  async function deleteProject(id) {
    if (!confirm('¿Eliminar esta obra y todos sus datos?')) return;
    await DB.remove('projects', id);
    toast('Obra eliminada', 'info');
    loadProjectCards();
  }

  // ========================================
  // EXPORT / IMPORT
  // ========================================

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const CHUNK = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      binary += String.fromCharCode.apply(null, slice);
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async function encodeFileRecordForExport(fileRecord) {
    let binaryData = fileRecord.data || null;
    if (!binaryData && fileRecord.blob) {
      binaryData = await fileRecord.blob.arrayBuffer();
    }

    return {
      ...fileRecord,
      data: binaryData ? arrayBufferToBase64(binaryData) : null,
      blob: undefined,
      _encoded: true
    };
  }

  async function collectProjectFilesForExport(projectId, incidents = []) {
    const projectFiles = await DB.getAllForProject('files', projectId);
    const exportedFiles = [...projectFiles];
    const seenIds = new Set(projectFiles.map(file => file.id));

    const referencedIds = new Set();
    incidents.forEach(incident => {
      (incident.photoIds || []).forEach(photoId => {
        if (photoId !== null && photoId !== undefined) referencedIds.add(photoId);
      });
    });

    for (const fileId of referencedIds) {
      if (seenIds.has(fileId)) continue;
      const fileRecord = await DB.getById('files', fileId);
      if (fileRecord) {
        exportedFiles.push(fileRecord);
        seenIds.add(fileId);
      }
    }

    return exportedFiles;
  }

  function remapCanvasFileReferences(node, fileIdMap) {
    if (!node || typeof node !== 'object') return;

    if (node._attachedFileId && fileIdMap[node._attachedFileId]) {
      node._attachedFileId = fileIdMap[node._attachedFileId];
    }

    if (Array.isArray(node.objects)) {
      node.objects.forEach(child => remapCanvasFileReferences(child, fileIdMap));
    }
  }

  async function exportProject(id) {
    const project = await DB.getById('projects', id);
    if (!project) { toast('Obra no encontrada', 'error'); return; }

    toast('Exportando obra...', 'info');

    const STORES = ['suppliers', 'budgets', 'tasks', 'incidents', 'participants', 'plans'];
    const data = { project, _exportVersion: 1, _exportDate: new Date().toISOString() };
    let incidents = [];

    for (const store of STORES) {
      const records = await DB.getAllForProject(store, id);
      data[store] = records;
      if (store === 'incidents') incidents = records;
    }

    const files = await collectProjectFilesForExport(id, incidents);
    data.files = await Promise.all(files.map(encodeFileRecordForExport));

    // Canvas state (multi-sheet)
    const sheetIndex = await DB.getSheetIndex(id);
    if (sheetIndex && sheetIndex.sheets) {
      data.canvasSheets = {};
      data.canvasSheetIndex = sheetIndex.sheets;
      for (const sheet of sheetIndex.sheets) {
        const st = await DB.getCanvasState(id, sheet.id);
        data.canvasSheets[sheet.id] = st ? st.data : null;
      }
    } else {
      // Legacy fallback
      const canvasState = await DB.getCanvasState(id);
      data.canvas = canvasState || null;
    }

    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = project.name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '-');
    link.download = `obra-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast('Obra exportada correctamente', 'success');
  }

  async function importProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.project || !data._exportVersion) {
          toast('Archivo no válido: no es una exportación de obra', 'error');
          return;
        }

        toast('Importando obra...', 'info');

        // Create project with new ID
        const { id: oldId, ...projData } = data.project;
        projData.name = projData.name + ' (importada)';
        projData.importedAt = new Date().toISOString();
        const newProjectId = await DB.add('projects', projData);

        // Import each store with updated projectId
        const STORES = ['suppliers', 'budgets', 'tasks', 'incidents', 'files', 'participants', 'plans'];
        const idMap = {}; // old ID -> new ID mapping for references

        for (const store of STORES) {
          const records = data[store] || [];
          idMap[store] = {};
          for (const record of records) {
            try {
              const oldRecId = record.id;
              const { id, ...recData } = record;
              recData.projectId = newProjectId;

              // Restore file binary data from base64
              if (store === 'files') {
                if (recData._encoded && recData.data) {
                  recData.data = base64ToArrayBuffer(recData.data);
                }
                delete recData.blob;
                delete recData._encoded;
              }

              const newId = await DB.add(store, recData);
              idMap[store][oldRecId] = newId;
            } catch (recErr) {
              console.warn(`Import: error en registro de ${store}:`, recErr);
            }
          }
        }

        // Fix task dependencies (old IDs -> new IDs)
        if (data.tasks) {
          for (const oldTask of data.tasks) {
            if (oldTask.dependencies && oldTask.dependencies.length > 0) {
              const newTaskId = idMap.tasks[oldTask.id];
              const task = await DB.getById('tasks', newTaskId);
              if (task) {
                task.dependencies = oldTask.dependencies.map(depId => idMap.tasks[depId]).filter(Boolean);
                await DB.put('tasks', task);
              }
            }
          }
        }

        // Fix budget supplierId references
        if (data.budgets) {
          for (const oldBudget of data.budgets) {
            if (oldBudget.supplierId) {
              const newBudgetId = idMap.budgets[oldBudget.id];
              const budget = await DB.getById('budgets', newBudgetId);
              if (budget) {
                budget.supplierId = idMap.suppliers[oldBudget.supplierId] || budget.supplierId;
                await DB.put('budgets', budget);
              }
            }
          }
        }

        if (data.incidents) {
          for (const oldIncident of data.incidents) {
            if (oldIncident.photoIds && oldIncident.photoIds.length > 0) {
              const newIncidentId = idMap.incidents[oldIncident.id];
              const incident = await DB.getById('incidents', newIncidentId);
              if (incident) {
                incident.photoIds = oldIncident.photoIds.map(fileId => idMap.files[fileId]).filter(Boolean);
                await DB.put('incidents', incident);
              }
            }
          }
        }

        // Fix plan fileId references
        if (data.plans) {
          for (const oldPlan of data.plans) {
            if (oldPlan.fileId) {
              const newPlanId = idMap.plans[oldPlan.id];
              const plan = await DB.getById('plans', newPlanId);
              if (plan) {
                plan.fileId = idMap.files[oldPlan.fileId] || plan.fileId;
                await DB.put('plans', plan);
              }
            }
          }
        }

        // Import canvas state (multi-sheet or legacy)
        if (data.canvasSheetIndex && data.canvasSheets) {
          const newSheets = data.canvasSheetIndex.map(s => ({ ...s }));
          await DB.saveSheetIndex(newProjectId, newSheets);
          for (const sheet of newSheets) {
            const sheetData = data.canvasSheets[sheet.id];
            if (sheetData) {
              remapCanvasFileReferences(sheetData.canvas, idMap.files || {});
              remapCanvasFileReferences(sheetData, idMap.files || {});
              await DB.saveCanvasState(newProjectId, sheetData, sheet.id);
            }
          }
        } else if (data.canvas && data.canvas.data) {
          // Legacy single-sheet import
          const sheetId = 'sheet_' + Date.now();
          const newSheets = [{ id: sheetId, name: 'Hoja 1' }];
          await DB.saveSheetIndex(newProjectId, newSheets);
          remapCanvasFileReferences(data.canvas.data, idMap.files || {});
          await DB.saveCanvasState(newProjectId, data.canvas.data, sheetId);
        }

        toast('Obra importada correctamente', 'success');
        loadProjectCards();
      } catch (err) {
        console.error('Import error:', err);
        toast('Error al importar: archivo corrupto o no válido', 'error');
      }
    });
    input.click();
  }

  async function enterProject(id) {
    const project = await DB.getById('projects', id);
    if (!project) return;

    await syncProjectDeadlineMilestone(project);

    currentProjectId = id;
    currentProjectName = project.name;

    // Hide selector, show app
    document.getElementById('project-selector').style.display = 'none';
    document.getElementById('sidebar').style.display = 'flex';
    document.getElementById('main-content').style.display = 'flex';

    // Update project name display
    document.getElementById('topbar-project-name').textContent = project.name;

    // Setup navigation and init modules
    setupNavigation();
    setupSidebar();
    setupMobile();

    // Init all modules with project context
    const modules = [
      ['CanvasModule', CanvasModule],
      ['DashboardModule', DashboardModule],
      ['TimelineModule', TimelineModule],
      ['DiaryModule', DiaryModule],
      ['OverviewModule', OverviewModule],
      ['PlansModule', typeof PlansModule !== 'undefined' ? PlansModule : null],
      ['FilesModule', FilesModule],
      ['ParticipantsModule', typeof ParticipantsModule !== 'undefined' ? ParticipantsModule : null],
      ['ReportModule', typeof ReportModule !== 'undefined' ? ReportModule : null]
    ];
    for (const [name, mod] of modules) {
      try { if (mod) mod.init(currentProjectId); }
      catch(e) { console.warn(`Error init ${name}:`, e); }
    }

    setupContextMenu();

    safeIcons();

    navigateTo('overview');
  }

  async function syncProjectDeadlineMilestone(project) {
    if (!project || !project.id) return;

    const projectTasks = await DB.getAllForProject('tasks', project.id);
    const milestone = projectTasks.find(task => task.systemTag === 'project-deadline-milestone');

    if (!project.targetEndDate) {
      if (milestone) await DB.remove('tasks', milestone.id);
      return;
    }

    const now = new Date().toISOString();
    const milestoneData = {
      name: 'Hito · Fin objetivo de obra',
      category: 'General',
      responsible: '',
      startDate: project.targetEndDate,
      endDate: project.targetEndDate,
      progress: project.status === 'finished' ? 100 : 0,
      dependencies: milestone?.dependencies || [],
      projectId: project.id,
      updatedAt: now,
      createdAt: milestone?.createdAt || now,
      baselineStartDate: milestone?.baselineStartDate || milestone?.startDate || project.targetEndDate,
      baselineEndDate: milestone?.baselineEndDate || milestone?.endDate || project.targetEndDate,
      systemTag: 'project-deadline-milestone',
      isMilestone: true,
      lockedBySystem: true
    };

    if (milestone) {
      milestoneData.id = milestone.id;
      await DB.put('tasks', milestoneData);
      return;
    }

    await DB.add('tasks', milestoneData);
  }

  function openIncident(id) {
    navigateTo('diary');
    setTimeout(() => {
      if (typeof DiaryModule !== 'undefined' && DiaryModule.focusIncident) {
        DiaryModule.focusIncident(id);
      }
    }, 80);
  }

  // ========================================
  // NAVIGATION
  // ========================================

  function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      // Remove old listeners by cloning
      const newLink = link.cloneNode(true);
      link.parentNode.replaceChild(newLink, link);

      newLink.addEventListener('click', (e) => {
        e.preventDefault();
        const section = newLink.dataset.section;
        navigateTo(section);
        closeMobileSidebar();
      });
    });
  }

  function navigateTo(section) {
    if (!sectionTitles[section]) return;

    currentSection = section;

    // Update nav
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-section="${section}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Update section
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const activeSection = document.getElementById(`section-${section}`);
    if (activeSection) activeSection.classList.add('active');

    // Update title
    document.getElementById('section-title').textContent = sectionTitles[section];

    if (section === 'canvas') {
      setTimeout(() => CanvasModule.resize(), 100);
    }
    if (section === 'timeline') {
      setTimeout(() => TimelineModule.refresh(), 100);
    }
    if (section === 'overview') {
      OverviewModule.refresh();
    }
  }

  function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');

    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);

    newToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      setTimeout(() => {
        lucide.createIcons();
        if (currentSection === 'canvas') CanvasModule.resize();
      }, 350);
    });
  }

  function setupMobile() {
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');

    let overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      overlay.id = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }

    const newToggle = mobileToggle.cloneNode(true);
    mobileToggle.parentNode.replaceChild(newToggle, mobileToggle);

    newToggle.addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.add('active');
    });

    overlay.onclick = closeMobileSidebar;
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }

  // --- Modal System ---
  function setupModal() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  function openModal(title, bodyHTML, footerHTML) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML || '';
    overlay.classList.add('active');
    lucide.createIcons();

    // Focus first input
    const firstInput = document.querySelector('#modal-body input, #modal-body select, #modal-body textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
  }

  // --- Toast Notifications ---
  function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = {
      success: 'check-circle',
      error: 'alert-circle',
      warning: 'alert-triangle',
      info: 'info'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type]}" class="toast-icon"></i>
      <span>${escapeHTML(message)}</span>
    `;
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 300ms ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- Lightbox ---
  function openLightbox(src) {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `<img src="${src}" alt="Foto ampliada">`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  }

  // --- Utilities ---
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // ========================================
  // CONTEXT MENU SYSTEM
  // ========================================

  let ctxMenuReady = false;

  function setupContextMenu() {
    if (ctxMenuReady) return;
    ctxMenuReady = true;

    const menu = document.getElementById('ctx-menu');

    // Close on click elsewhere or Escape
    document.addEventListener('click', () => hideContextMenu());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideContextMenu(); });
    window.addEventListener('blur', () => hideContextMenu());

    // Right click handler on main content
    document.getElementById('main-content').addEventListener('contextmenu', (e) => {
      // Don't override context menu on inputs/textareas/contenteditable
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

      if (currentSection === 'timeline' && typeof TimelineModule !== 'undefined' && TimelineModule.captureContextMenuTarget) {
        TimelineModule.captureContextMenuTarget(e.target, e.clientX);
      }

      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    });
  }

  function showContextMenu(x, y) {
    const menu = document.getElementById('ctx-menu');
    const items = getContextMenuItems();
    if (!items.length) return;

    // Build HTML
    menu.innerHTML = items.map(item => {
      if (item.type === 'sep') return '<div class="ctx-sep"></div>';
      if (item.type === 'header') return `<div class="ctx-header">${escapeHTML(item.label)}</div>`;
      const cls = ['ctx-item'];
      if (item.danger) cls.push('ctx-danger');
      const shortcut = item.shortcut ? `<span class="ctx-shortcut">${item.shortcut}</span>` : '';
      return `<button class="${cls.join(' ')}" data-action="${item.action}">
        <i data-lucide="${item.icon}"></i>
        <span>${escapeHTML(item.label)}</span>
        ${shortcut}
      </button>`;
    }).join('');

    lucide.createIcons({ attrs: { class: '' } });

    // Bind actions
    menu.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideContextMenu();
        const action = btn.dataset.action;
        executeContextAction(action);
      });
    });

    // Position ensuring viewport bounds
    menu.classList.add('visible');
    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    menu.style.left = Math.min(x, maxX) + 'px';
    menu.style.top = Math.min(y, maxY) + 'px';
  }

  function hideContextMenu() {
    const menu = document.getElementById('ctx-menu');
    menu.classList.remove('visible');
  }

  function getContextMenuItems() {
    const section = currentSection;

    const navItems = [
      { type: 'sep' },
      { type: 'header', label: 'Navegar a' },
      { action: 'nav-overview',  icon: 'layout-dashboard', label: 'Vista General' },
      { action: 'nav-canvas',    icon: 'pen-tool',         label: 'Mesa de Trabajo' },
      { action: 'nav-dashboard', icon: 'bar-chart-3',      label: 'Proveedores' },
      { action: 'nav-timeline',  icon: 'gantt-chart',      label: 'Cronograma' },
      { action: 'nav-diary',     icon: 'clipboard-list',   label: 'Diario' },
      { action: 'nav-files',     icon: 'folder-open',      label: 'Documentos' },
    ].filter(i => i.type || i.action !== `nav-${section}`);

    switch (section) {
      case 'overview':
        return [
          { type: 'header', label: 'Vista General' },
          { action: 'refresh-overview', icon: 'refresh-cw',  label: 'Actualizar datos' },
          { action: 'add-task',         icon: 'plus-circle', label: 'Nueva tarea' },
          { action: 'add-incident',     icon: 'alert-triangle', label: 'Nueva incidencia' },
          { action: 'add-supplier',     icon: 'users',       label: 'Nuevo proveedor' },
          ...navItems
        ];

      case 'canvas':
        return [
          { type: 'header', label: 'Mesa de Trabajo' },
          { action: 'canvas-postit',  icon: 'sticky-note',    label: 'Añadir nota' },
          { action: 'canvas-text',    icon: 'type',           label: 'Añadir texto' },
          { action: 'canvas-table',   icon: 'table',          label: 'Añadir tabla' },
          { action: 'canvas-arrow',   icon: 'move-right',     label: 'Dibujar flecha' },
          { action: 'canvas-draw',    icon: 'pencil',         label: 'Dibujo libre' },
          { type: 'sep' },
          { action: 'canvas-upload',  icon: 'image-plus',     label: 'Subir plano' },
          { action: 'canvas-attach',  icon: 'paperclip',      label: 'Adjuntar archivo' },
          { type: 'sep' },
          { action: 'canvas-undo',    icon: 'undo-2',         label: 'Deshacer',        shortcut: '⌘Z' },
          { action: 'canvas-save',    icon: 'save',           label: 'Guardar',          shortcut: '' },
          { action: 'canvas-export',  icon: 'download',       label: 'Exportar imagen' },
          { type: 'sep' },
          { action: 'canvas-zoomfit', icon: 'maximize-2',     label: 'Ajustar zoom' },
          { action: 'canvas-clear',   icon: 'trash-2',        label: 'Limpiar todo', danger: true },
          ...navItems
        ];

      case 'dashboard':
        return [
          { type: 'header', label: 'Proveedores y Presupuestos' },
          { action: 'add-supplier',   icon: 'user-plus',    label: 'Nuevo proveedor' },
          { action: 'add-budget',     icon: 'plus-circle',  label: 'Nueva partida' },
          { type: 'sep' },
          { action: 'tab-suppliers',  icon: 'users',        label: 'Ver proveedores' },
          { action: 'tab-budgets',    icon: 'calculator',   label: 'Ver presupuestos' },
          { action: 'tab-comparator', icon: 'bar-chart-horizontal', label: 'Ver comparador' },
          ...navItems
        ];

      case 'timeline':
        return [
          { type: 'header', label: 'Cronograma' },
          { action: 'add-task',        icon: 'plus-circle',  label: 'Nueva tarea' },
          { type: 'sep' },
          { action: 'view-gantt',      icon: 'gantt-chart',  label: 'Vista Gantt' },
          { action: 'view-list',       icon: 'list',         label: 'Vista lista' },
          { action: 'zoom-today',      icon: 'calendar',     label: 'Ir a hoy' },
          ...navItems
        ];

      case 'diary':
        return [
          { type: 'header', label: 'Diario de Obra' },
          { action: 'add-incident',    icon: 'plus-circle',  label: 'Nueva entrada' },
          { type: 'sep' },
          { action: 'filter-all',      icon: 'list',          label: 'Mostrar todas' },
          { action: 'filter-pending',  icon: 'clock',         label: 'Solo pendientes' },
          { action: 'filter-progress', icon: 'loader',        label: 'Solo en proceso' },
          { action: 'filter-resolved', icon: 'check-circle',  label: 'Solo resueltas' },
          ...navItems
        ];

      case 'files':
        return [
          { type: 'header', label: 'Documentos' },
          { action: 'upload-file',     icon: 'upload',       label: 'Subir archivo' },
          { type: 'sep' },
          { action: 'sort-date-desc',  icon: 'arrow-down-wide-narrow', label: 'Ordenar: Recientes' },
          { action: 'sort-name-asc',   icon: 'arrow-up-a-z',           label: 'Ordenar: A-Z' },
          { action: 'sort-size-desc',  icon: 'arrow-down-wide-narrow', label: 'Ordenar: Mayor tamaño' },
          ...navItems
        ];

      default:
        return navItems;
    }
  }

  function executeContextAction(action) {
    // Navigation
    if (action.startsWith('nav-')) {
      return navigateTo(action.replace('nav-', ''));
    }

    switch (action) {
      // Overview
      case 'refresh-overview':
        OverviewModule.refresh();
        toast('Datos actualizados', 'success');
        break;

      // Canvas tool activations
      case 'canvas-postit':
        document.querySelector('[data-tool="postit"]').click();
        toast('Haz clic en el canvas para colocar la nota', 'info');
        break;
      case 'canvas-text':
        document.querySelector('[data-tool="text"]').click();
        toast('Haz clic en el canvas para añadir texto', 'info');
        break;
      case 'canvas-table':
        document.querySelector('[data-tool="table"]').click();
        toast('Haz clic en el canvas para colocar la tabla', 'info');
        break;
      case 'canvas-arrow':
        document.querySelector('[data-tool="arrow"]').click();
        toast('Arrastra en el canvas para dibujar la flecha', 'info');
        break;
      case 'canvas-draw':
        document.querySelector('[data-tool="draw"]').click();
        toast('Dibuja libremente sobre el canvas', 'info');
        break;
      case 'canvas-upload':
        document.getElementById('btn-upload-plan').click();
        break;
      case 'canvas-attach':
        document.getElementById('btn-attach-file').click();
        break;
      case 'canvas-undo':
        document.getElementById('btn-undo').click();
        break;
      case 'canvas-save':
        document.getElementById('btn-save-canvas').click();
        break;
      case 'canvas-export':
        document.getElementById('btn-export-canvas').click();
        break;
      case 'canvas-zoomfit':
        document.getElementById('btn-zoom-fit').click();
        break;
      case 'canvas-clear':
        document.getElementById('btn-clear-canvas').click();
        break;

      // Dashboard
      case 'add-supplier':
        if (currentSection !== 'dashboard') navigateTo('dashboard');
        document.getElementById('btn-add-supplier').click();
        break;
      case 'add-budget':
        if (currentSection !== 'dashboard') navigateTo('dashboard');
        setTimeout(() => document.getElementById('btn-add-budget').click(), 50);
        break;
      case 'tab-suppliers':
        document.querySelector('.sub-tab[data-subtab="suppliers"]').click();
        break;
      case 'tab-budgets':
        document.querySelector('.sub-tab[data-subtab="budgets"]').click();
        break;
      case 'tab-comparator':
        document.querySelector('.sub-tab[data-subtab="comparator"]').click();
        break;

      // Timeline
      case 'add-task':
        if (currentSection !== 'timeline') {
          navigateTo('timeline');
          setTimeout(() => document.getElementById('btn-add-task').click(), 50);
          break;
        }
        if (typeof TimelineModule !== 'undefined' && TimelineModule.openTaskFromContext) {
          TimelineModule.openTaskFromContext();
        } else {
          document.getElementById('btn-add-task').click();
        }
        break;
      case 'view-gantt':
        document.getElementById('btn-view-gantt').click();
        break;
      case 'view-list':
        document.getElementById('btn-view-list').click();
        break;
      case 'zoom-today':
        document.getElementById('btn-zoom-timeline').click();
        break;

      // Diary
      case 'add-incident':
        if (currentSection !== 'diary') navigateTo('diary');
        setTimeout(() => document.getElementById('btn-add-incident').click(), 50);
        break;
      case 'filter-all':
        document.getElementById('diary-filter').value = 'all';
        document.getElementById('diary-filter').dispatchEvent(new Event('change'));
        break;
      case 'filter-pending':
        document.getElementById('diary-filter').value = 'pending';
        document.getElementById('diary-filter').dispatchEvent(new Event('change'));
        break;
      case 'filter-progress':
        document.getElementById('diary-filter').value = 'in-progress';
        document.getElementById('diary-filter').dispatchEvent(new Event('change'));
        break;
      case 'filter-resolved':
        document.getElementById('diary-filter').value = 'resolved';
        document.getElementById('diary-filter').dispatchEvent(new Event('change'));
        break;

      // Files
      case 'upload-file':
        document.getElementById('btn-upload-file').click();
        break;
      case 'sort-date-desc':
        document.getElementById('files-sort').value = 'date-desc';
        document.getElementById('files-sort').dispatchEvent(new Event('change'));
        break;
      case 'sort-name-asc':
        document.getElementById('files-sort').value = 'name-asc';
        document.getElementById('files-sort').dispatchEvent(new Event('change'));
        break;
      case 'sort-size-desc':
        document.getElementById('files-sort').value = 'size-desc';
        document.getElementById('files-sort').dispatchEvent(new Event('change'));
        break;
    }
  }

  // --- Service Worker ---
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js?v=9')
        .then(reg => { reg.update(); console.log('Service Worker registrado'); })
        .catch(err => console.warn('SW registro fallido:', err));
    }
  }

  return {
    init,
    navigateTo,
    openModal,
    closeModal,
    toast,
    openLightbox,
    escapeHTML,
    formatCurrency,
    formatDate,
    formatDateTime,
    daysBetween,
    generateId,
    enterProject,
    editProject,
    deleteProject,
    exportProject,
    importProject,
    syncProjectDeadlineMilestone,
    openIncident,
    get currentSection() { return currentSection; },
    get projectId() { return currentProjectId; }
  };
})();
