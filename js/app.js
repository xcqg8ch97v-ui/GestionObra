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
    diary: 'Diario de Incidencias',
    files: 'Documentos de Obra'
  };

  let currentSection = 'overview';
  let currentProjectId = null;
  let currentProjectName = '';

  async function init() {
    await DB.open();
    setupModal();
    setupProjectSelector();
    registerSW();
    lucide.createIcons();
    showProjectSelector();
  }

  // ========================================
  // PROJECT SELECTOR
  // ========================================

  function setupProjectSelector() {
    document.getElementById('btn-new-project').addEventListener('click', openProjectForm);
    document.getElementById('btn-new-project-empty').addEventListener('click', openProjectForm);
    document.getElementById('btn-back-projects').addEventListener('click', showProjectSelector);
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
      return `
        <div class="project-card" onclick="App.enterProject(${p.id})">
          <div class="project-card-name">${escapeHTML(p.name)}</div>
          <div class="project-card-client">${escapeHTML(p.client || 'Sin cliente')}</div>
          <div class="project-card-meta">
            <span class="badge ${statusClass}">${statusLabel}</span>
            <span class="project-card-date">${formatDate(p.createdAt)}</span>
          </div>
          <div class="project-card-actions" onclick="event.stopPropagation();">
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
        <label>Dirección</label>
        <input type="text" id="proj-address" value="${isEdit ? escapeHTML(project.address || '') : ''}" placeholder="Dirección de la obra">
      </div>
      <div class="form-group">
        <label>Estado</label>
        <select id="proj-status">
          <option value="active" ${isEdit && project.status === 'active' ? 'selected' : ''}>Activa</option>
          <option value="paused" ${isEdit && project.status === 'paused' ? 'selected' : ''}>En pausa</option>
          <option value="finished" ${isEdit && project.status === 'finished' ? 'selected' : ''}>Finalizada</option>
        </select>
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

    document.getElementById('btn-save-project').addEventListener('click', async () => {
      const name = document.getElementById('proj-name').value.trim();
      if (!name) { toast('El nombre es obligatorio', 'warning'); return; }

      const data = {
        name,
        client: document.getElementById('proj-client').value.trim(),
        address: document.getElementById('proj-address').value.trim(),
        status: document.getElementById('proj-status').value,
        notes: document.getElementById('proj-notes').value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = project.id;
        data.createdAt = project.createdAt;
        await DB.put('projects', data);
        toast('Obra actualizada', 'success');
      } else {
        data.createdAt = new Date().toISOString();
        await DB.add('projects', data);
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

  async function enterProject(id) {
    const project = await DB.getById('projects', id);
    if (!project) return;

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
    CanvasModule.init(currentProjectId);
    DashboardModule.init(currentProjectId);
    TimelineModule.init(currentProjectId);
    DiaryModule.init(currentProjectId);
    OverviewModule.init(currentProjectId);
    FilesModule.init(currentProjectId);

    lucide.createIcons();

    navigateTo('overview');
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

  // --- Service Worker ---
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(() => console.log('Service Worker registrado'))
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
    get currentSection() { return currentSection; },
    get projectId() { return currentProjectId; }
  };
})();
