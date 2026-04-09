/* ========================================
   Timeline Module - Cronograma de Obra
   Gantt chart con ruta crítica y detección de retrasos
   ======================================== */

const TimelineModule = (() => {
  const DAY_WIDTH = 40;
  let tasks = [];
  let viewStart = null;
  let viewDays = 60;
  let projectId = null;
  let currentView = 'gantt'; // 'gantt' | 'list'
  let hideCompleted = false;

  // Construction phases in natural execution order
  const PHASES = [
    { key: 'Demolición',    icon: 'hammer',       color: '#EF4444' },
    { key: 'Estructura',    icon: 'building-2',   color: '#8B5CF6' },
    { key: 'Albañilería',   icon: 'brick-wall',   color: '#F97316' },
    { key: 'Fontanería',    icon: 'droplets',     color: '#3B82F6' },
    { key: 'Electricidad',  icon: 'zap',          color: '#EAB308' },
    { key: 'Carpintería',   icon: 'axe',          color: '#A16207' },
    { key: 'Pintura',       icon: 'paintbrush',   color: '#EC4899' },
    { key: 'Acabados',      icon: 'sparkles',     color: '#14B8A6' },
    { key: 'Limpieza',      icon: 'spray-can',    color: '#06B6D4' },
    { key: 'General',       icon: 'layers',       color: '#64748B' }
  ];

  function getPhase(category) {
    return PHASES.find(p => p.key === category) || PHASES[PHASES.length - 1];
  }

  function groupTasksByPhase(taskList) {
    const groups = [];
    for (const phase of PHASES) {
      const phaseTasks = taskList.filter(t => (t.category || 'General') === phase.key);
      if (phaseTasks.length > 0) {
        const completed = phaseTasks.filter(t => (t.progress || 0) >= 100).length;
        const avgProgress = Math.round(phaseTasks.reduce((s, t) => s + (t.progress || 0), 0) / phaseTasks.length);
        groups.push({ ...phase, tasks: phaseTasks, completed, total: phaseTasks.length, avgProgress });
      }
    }
    return groups;
  }

  function init(pid) {
    projectId = pid;
    setupButtons();
    loadTasks();
  }

  function setupButtons() {
    document.getElementById('btn-add-task').addEventListener('click', () => openTaskForm());
    document.getElementById('btn-add-task-empty').addEventListener('click', () => openTaskForm());
    document.getElementById('btn-zoom-timeline').addEventListener('click', scrollToToday);

    // View toggle
    document.getElementById('btn-view-gantt').addEventListener('click', () => switchView('gantt'));
    document.getElementById('btn-view-list').addEventListener('click', () => switchView('list'));

    // Hide completed toggle
    const hideDoneCheck = document.getElementById('tl-hide-done');
    if (hideDoneCheck) {
      hideDoneCheck.addEventListener('change', (e) => {
        hideCompleted = e.target.checked;
        render();
      });
    }

    // Table header sorting
    document.querySelectorAll('#timeline-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => sortListBy(th.dataset.sort));
    });
  }

  let listSortKey = 'startDate';
  let listSortAsc = true;

  function switchView(view) {
    currentView = view;
    document.getElementById('btn-view-gantt').classList.toggle('active', view === 'gantt');
    document.getElementById('btn-view-list').classList.toggle('active', view === 'list');
    render();
  }

  function sortListBy(key) {
    if (listSortKey === key) {
      listSortAsc = !listSortAsc;
    } else {
      listSortKey = key;
      listSortAsc = true;
    }
    render();
  }

  async function loadTasks() {
    tasks = await DB.getAllForProject('tasks', projectId);
    render();
  }

  function render() {
    const ganttContainer = document.getElementById('timeline-container');
    const listContainer = document.getElementById('timeline-list-container');
    const emptyState = document.getElementById('timeline-empty');
    const zoomBtn = document.getElementById('btn-zoom-timeline');

    // Filter completed if toggle is on
    const visibleTasks = hideCompleted ? tasks.filter(t => (t.progress || 0) < 100) : tasks;

    if (visibleTasks.length === 0) {
      ganttContainer.classList.remove('visible');
      listContainer.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';

    if (currentView === 'gantt') {
      ganttContainer.classList.add('visible');
      listContainer.style.display = 'none';
      zoomBtn.style.display = '';

      // Calculate date range
      const allDates = visibleTasks.flatMap(t => [new Date(t.startDate), new Date(t.endDate)]);
      const minDate = new Date(Math.min(...allDates));
      const maxDate = new Date(Math.max(...allDates));

      viewStart = new Date(minDate);
      viewStart.setDate(viewStart.getDate() - 3);
      const viewEnd = new Date(maxDate);
      viewEnd.setDate(viewEnd.getDate() + 10);
      viewDays = App.daysBetween(viewStart, viewEnd);

      renderHeader();
      renderBody();
    } else {
      ganttContainer.classList.remove('visible');
      listContainer.style.display = 'block';
      zoomBtn.style.display = 'none';
      renderListView(visibleTasks);
    }
  }

  function renderHeader() {
    const header = document.getElementById('timeline-header');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Task label column
    let html = `<div class="timeline-row-label" style="min-height:40px;font-weight:600;font-size:12px;color:var(--text-muted);">Tarea</div>`;

    for (let i = 0; i < viewDays; i++) {
      const date = new Date(viewStart);
      date.setDate(date.getDate() + i);
      const isToday = date.toDateString() === today.toDateString();
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      const dayLabel = date.getDate();
      const monthLabel = date.getDate() === 1 || i === 0
        ? date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()
        : '';

      html += `
        <div class="timeline-header-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}">
          ${monthLabel ? `<div style="font-size:9px;color:var(--cyan)">${monthLabel}</div>` : ''}
          <div>${dayLabel}</div>
        </div>
      `;
    }

    header.innerHTML = html;
  }

  function renderBody() {
    const body = document.getElementById('timeline-body');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate critical path
    const criticalTasks = calculateCriticalPath();

    // Group tasks by phase
    const groups = groupTasksByPhase(visibleTasks);

    let html = '';

    groups.forEach(group => {
      // Phase header row
      html += `
        <div class="phase-header-row" style="--phase-color:${group.color}">
          <div class="phase-header-label">
            <i data-lucide="${group.icon}"></i>
            <span>${group.key}</span>
            <span class="phase-count">${group.completed}/${group.total}</span>
          </div>
          <div class="phase-header-bar">
            <div class="phase-progress-track">
              <div class="phase-progress-fill" style="width:${group.avgProgress}%;background:${group.color}"></div>
            </div>
            <span class="phase-progress-label">${group.avgProgress}%</span>
          </div>
        </div>
      `;

      // Sort phase tasks by start date
      const sorted = [...group.tasks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

      sorted.forEach(task => {
        const taskStart = new Date(task.startDate);
        const taskEnd = new Date(task.endDate);
        const startOffset = App.daysBetween(viewStart, taskStart);
        const duration = App.daysBetween(taskStart, taskEnd) + 1;

        // Determine bar type
        const isCompleted = task.progress >= 100;
        const isDelayed = !isCompleted && taskEnd < today;
        const isCritical = criticalTasks.has(task.id);

        let barClass = 'normal';
        if (isCompleted) barClass = 'completed';
        else if (isDelayed) barClass = 'delayed';
        else if (isCritical) barClass = 'critical';

        // Cells
        let cells = '';
        for (let i = 0; i < viewDays; i++) {
          const date = new Date(viewStart);
          date.setDate(date.getDate() + i);
          const isToday = date.toDateString() === today.toDateString();
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          cells += `<div class="timeline-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}"></div>`;
        }

        // Delay indicator
        let delayInfo = '';
        if (isDelayed) {
          const delayDays = App.daysBetween(taskEnd, today);
          delayInfo = ` (${delayDays}d retraso)`;
        }

        html += `
          <div class="timeline-row" ondblclick="TimelineModule.editTask(${task.id})">
            <div class="timeline-row-label">
              <span class="phase-color-dot" style="background:${group.color}"></span>
              <span class="task-name" title="${App.escapeHTML(task.name)}">${App.escapeHTML(task.name)}</span>
              <div class="task-actions">
                <button class="action-btn" onclick="TimelineModule.editTask(${task.id})" title="Editar">
                  <i data-lucide="pencil" style="width:14px;height:14px"></i>
                </button>
                <button class="action-btn delete" onclick="TimelineModule.deleteTask(${task.id})" title="Eliminar">
                  <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                </button>
              </div>
            </div>
            <div class="timeline-row-cells">
              ${cells}
              <div class="task-bar ${barClass}" 
                   style="left:${startOffset * DAY_WIDTH}px; width:${duration * DAY_WIDTH - 4}px;"
                   title="${App.escapeHTML(task.name)}: ${App.formatDate(task.startDate)} → ${App.formatDate(task.endDate)} (${task.progress || 0}%)${delayInfo}"
                   onclick="TimelineModule.editTask(${task.id})">
                ${task.progress > 0 ? `<div class="task-progress" style="width:${task.progress}%"></div>` : ''}
                <span style="position:relative;z-index:1">${task.progress || 0}%</span>
              </div>
            </div>
          </div>
        `;
      });
    });

    // Today line
    const todayOffset = App.daysBetween(viewStart, today);
    if (todayOffset >= 0 && todayOffset < viewDays) {
      html += `<div class="today-line" style="left:${200 + todayOffset * DAY_WIDTH + DAY_WIDTH / 2}px;"></div>`;
    }

    body.innerHTML = html;
    lucide.createIcons();
  }

  // ========================================
  // LIST VIEW
  // ========================================

  function renderListView(visibleTasks) {
    const tbody = document.getElementById('timeline-table-body');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const criticalTasks = calculateCriticalPath();

    // Sort helper
    function sortTasks(list) {
      return [...list].sort((a, b) => {
        let va, vb;
        switch (listSortKey) {
          case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
          case 'category': va = (a.category || '').toLowerCase(); vb = (b.category || '').toLowerCase(); break;
          case 'responsible': va = (a.responsible || '').toLowerCase(); vb = (b.responsible || '').toLowerCase(); break;
          case 'startDate': va = a.startDate; vb = b.startDate; break;
          case 'endDate': va = a.endDate; vb = b.endDate; break;
          case 'duration':
            va = App.daysBetween(new Date(a.startDate), new Date(a.endDate));
            vb = App.daysBetween(new Date(b.startDate), new Date(b.endDate));
            break;
          case 'progress': va = a.progress || 0; vb = b.progress || 0; break;
          default: va = a.startDate; vb = b.startDate;
        }
        if (va < vb) return listSortAsc ? -1 : 1;
        if (va > vb) return listSortAsc ? 1 : -1;
        return 0;
      });
    }

    // Update header arrows
    document.querySelectorAll('#timeline-table th[data-sort]').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === listSortKey) {
        th.classList.add(listSortAsc ? 'sort-asc' : 'sort-desc');
      }
    });

    const groups = groupTasksByPhase(visibleTasks);

    const CATEGORIES = ['General','Demolición','Estructura','Albañilería','Fontanería','Electricidad','Carpintería','Pintura','Acabados','Limpieza'];

    let rows = '';
    groups.forEach(group => {
      // Phase header row
      rows += `
        <tr class="phase-group-header" style="--phase-color:${group.color}">
          <td colspan="10">
            <div class="phase-group-label">
              <i data-lucide="${group.icon}"></i>
              <span>${group.key}</span>
              <span class="phase-count">${group.completed}/${group.total}</span>
              <div class="phase-progress-track phase-progress-sm">
                <div class="phase-progress-fill" style="width:${group.avgProgress}%;background:${group.color}"></div>
              </div>
              <span class="phase-progress-label">${group.avgProgress}%</span>
            </div>
          </td>
        </tr>
      `;

      const sorted = sortTasks(group.tasks);

      sorted.forEach(task => {
        const taskEnd = new Date(task.endDate);
        const taskStart = new Date(task.startDate);
        const duration = App.daysBetween(taskStart, taskEnd) + 1;
        const isCompleted = (task.progress || 0) >= 100;
        const isDelayed = !isCompleted && taskEnd < today;
        const isCritical = criticalTasks.has(task.id);

        let statusClass = 'normal';
        let statusLabel = 'En curso';
        if (isCompleted) { statusClass = 'completed'; statusLabel = 'Completada'; }
        else if (isDelayed) {
          statusClass = 'delayed';
          const delayDays = App.daysBetween(taskEnd, today);
          statusLabel = `${delayDays}d retraso`;
        }
        else if (isCritical) { statusClass = 'critical'; statusLabel = 'Ruta crítica'; }

        // Dependencies
        const deps = (task.dependencies || []).map(depId => {
          const dep = tasks.find(t => t.id === depId);
          if (!dep) return '';
          const depPhase = getPhase(dep.category);
          const depDone = (dep.progress || 0) >= 100;
          const depDelayed = !depDone && new Date(dep.endDate) < today;
          const tagClass = depDone ? 'dep-tag-done' : depDelayed ? 'dep-tag-pending' : '';
          const icon = depDone
            ? '<svg class="dep-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : depDelayed
              ? '<svg class="dep-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
              : '';
          return `<span class="dep-tag ${tagClass}"><span class="dep-dot" style="background:${depPhase.color}"></span>${icon}${App.escapeHTML(dep.name)}</span>`;
        }).filter(Boolean);
        const depsHtml = deps.length > 0
          ? deps.join('')
          : '<span style="color:var(--text-muted)">—</span>';

        const catOptions = CATEGORIES.map(c =>
          `<option value="${c}" ${(task.category || 'General') === c ? 'selected' : ''}>${c}</option>`
        ).join('');

        rows += `
          <tr class="tl-row-${statusClass}" ondblclick="if(!event.target.closest('input,select,button'))TimelineModule.editTask(${task.id})">
            <td class="tl-cell-name">
              <input class="tl-inline" type="text" value="${App.escapeHTML(task.name)}"
                onchange="TimelineModule.inlineUpdate(${task.id},'name',this.value)">
            </td>
            <td>
              <select class="tl-inline tl-inline-select" onchange="TimelineModule.inlineUpdate(${task.id},'category',this.value)">
                ${catOptions}
              </select>
            </td>
            <td>
              <input class="tl-inline" type="text" value="${App.escapeHTML(task.responsible || '')}" placeholder="—"
                onchange="TimelineModule.inlineUpdate(${task.id},'responsible',this.value)">
            </td>
            <td class="tl-cell-date">
              <input class="tl-inline tl-inline-date" type="date" value="${task.startDate}"
                onchange="TimelineModule.inlineUpdate(${task.id},'startDate',this.value)">
            </td>
            <td class="tl-cell-date">
              <input class="tl-inline tl-inline-date" type="date" value="${task.endDate}"
                onchange="TimelineModule.inlineUpdate(${task.id},'endDate',this.value)">
            </td>
            <td class="tl-cell-num">${duration}d</td>
            <td>
              <div class="tl-progress-wrap">
                <input type="range" class="tl-inline-range" min="0" max="100" step="5" value="${task.progress || 0}"
                  onchange="TimelineModule.inlineUpdate(${task.id},'progress',parseInt(this.value))"
                  oninput="this.nextElementSibling.textContent=this.value+'%'"
                  title="${task.progress || 0}%">
                <span class="tl-progress-label">${task.progress || 0}%</span>
              </div>
            </td>
            <td class="tl-cell-deps">${depsHtml}</td>
            <td><span class="tl-status-badge tl-badge-${statusClass}">${statusLabel}</span></td>
            <td class="tl-cell-actions">
              <button class="action-btn" onclick="TimelineModule.editTask(${task.id})" title="Editar">
                <i data-lucide="pencil" style="width:14px;height:14px"></i>
              </button>
              <button class="action-btn delete" onclick="TimelineModule.deleteTask(${task.id})" title="Eliminar">
                <i data-lucide="trash-2" style="width:14px;height:14px"></i>
              </button>
            </td>
          </tr>
        `;
      });
    });

    tbody.innerHTML = rows;
    lucide.createIcons();
  }

  function calculateCriticalPath() {
    // Simple critical path: tasks with no slack
    // A task is critical if delaying it delays the project end date
    const criticalIds = new Set();

    if (tasks.length === 0) return criticalIds;

    // Find project end date
    const projectEnd = new Date(Math.max(...tasks.map(t => new Date(t.endDate))));

    // Tasks that end at project end or have dependents that are critical
    tasks.forEach(task => {
      const taskEnd = new Date(task.endDate);
      if (taskEnd.toDateString() === projectEnd.toDateString()) {
        criticalIds.add(task.id);
        // Trace back dependencies
        traceCriticalPath(task, criticalIds);
      }
    });

    return criticalIds;
  }

  function traceCriticalPath(task, criticalIds) {
    if (!task.dependencies || task.dependencies.length === 0) return;

    task.dependencies.forEach(depId => {
      const dep = tasks.find(t => t.id === depId);
      if (dep) {
        criticalIds.add(dep.id);
        traceCriticalPath(dep, criticalIds);
      }
    });
  }

  function scrollToToday() {
    const container = document.getElementById('timeline-container');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!viewStart) return;

    const todayOffset = App.daysBetween(viewStart, today);
    const scrollX = Math.max(0, todayOffset * DAY_WIDTH - container.clientWidth / 2 + 200);
    container.scrollLeft = scrollX;
  }

  // --- Task Form ---
  async function openTaskForm(task = null) {
    const isEdit = !!task;
    const title = isEdit ? 'Editar Tarea' : 'Nueva Tarea';
    const allTasks = await DB.getAllForProject('tasks', projectId);

    const today = new Date().toISOString().slice(0, 10);

    const body = `
      <div class="form-group">
        <label>Nombre de la Tarea *</label>
        <input type="text" id="task-name" value="${isEdit ? App.escapeHTML(task.name) : ''}" placeholder="Ej: Instalación de fontanería">
      </div>
      <div class="form-group">
        <label>Fase de Obra *</label>
        <select id="task-category">
          ${PHASES.map(p => `<option value="${p.key}" ${isEdit && (task.category || 'General') === p.key ? 'selected' : ''}>${p.key}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Responsable</label>
        <input type="text" id="task-responsible" value="${isEdit ? App.escapeHTML(task.responsible || '') : ''}" placeholder="Ej: Juan García / Electricista SL">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Fecha Inicio *</label>
          <input type="date" id="task-start" value="${isEdit ? task.startDate : today}">
        </div>
        <div class="form-group">
          <label>Fecha Fin *</label>
          <input type="date" id="task-end" value="${isEdit ? task.endDate : ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Progreso (%) — ${isEdit ? task.progress || 0 : 0}%</label>
        <input type="range" id="task-progress" min="0" max="100" step="5" value="${isEdit ? task.progress || 0 : 0}" 
               oninput="this.previousElementSibling.textContent='Progreso (%) — '+this.value+'%'" 
               style="width:100%;accent-color:var(--cyan)">
      </div>
      <div class="form-group">
        <label>Dependencias (tareas que deben completarse antes)</label>
        <div style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);padding:var(--sp-sm);">
          ${allTasks.filter(t => !isEdit || t.id !== task.id).length > 0
            ? allTasks.filter(t => !isEdit || t.id !== task.id).map(t => {
                const phase = getPhase(t.category);
                const isChecked = isEdit && task.dependencies && task.dependencies.includes(t.id);
                return `
                  <label style="display:flex;align-items:center;gap:var(--sp-sm);padding:6px 4px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border);">
                    <input type="checkbox" class="dep-check" value="${t.id}" ${isChecked ? 'checked' : ''}
                      style="width:18px;height:18px;accent-color:var(--cyan);flex-shrink:0;">
                    <span style="width:8px;height:8px;border-radius:50%;background:${phase.color};flex-shrink:0;"></span>
                    <span style="flex:1;">${App.escapeHTML(t.name)}</span>
                    <span style="font-size:11px;color:var(--text-muted);">${t.progress || 0}%</span>
                  </label>`;
              }).join('')
            : '<span style="color:var(--text-muted);font-size:13px;padding:var(--sp-sm);">Crea más tareas para poder definir dependencias entre ellas</span>'
          }
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-task">
        <i data-lucide="save"></i> ${isEdit ? 'Guardar' : 'Crear'}
      </button>
    `;

    App.openModal(title, body, footer);

    document.getElementById('btn-save-task').addEventListener('click', async () => {
      const name = document.getElementById('task-name').value.trim();
      const startDate = document.getElementById('task-start').value;
      const endDate = document.getElementById('task-end').value;

      if (!name || !startDate || !endDate) {
        App.toast('Nombre y fechas son obligatorios', 'warning');
        return;
      }

      if (new Date(endDate) < new Date(startDate)) {
        App.toast('La fecha fin debe ser posterior al inicio', 'warning');
        return;
      }

      const dependencies = Array.from(document.querySelectorAll('.dep-check:checked')).map(c => parseInt(c.value));

      const data = {
        name,
        category: document.getElementById('task-category').value,
        responsible: document.getElementById('task-responsible').value.trim(),
        startDate,
        endDate,
        progress: parseInt(document.getElementById('task-progress').value),
        dependencies,
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = task.id;
        data.projectId = task.projectId;
        data.createdAt = task.createdAt;
        await DB.put('tasks', data);
        App.toast('Tarea actualizada', 'success');

        // Check if delay propagates
        checkDelayPropagation(data);
      } else {
        data.createdAt = new Date().toISOString();
        data.projectId = projectId;
        await DB.add('tasks', data);
        App.toast('Tarea creada', 'success');
      }

      App.closeModal();
      loadTasks();
    });
  }

  function checkDelayPropagation(modifiedTask) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskEnd = new Date(modifiedTask.endDate);

    if (modifiedTask.progress >= 100 || taskEnd >= today) return;

    // Find tasks that depend on this one
    const delayDays = App.daysBetween(taskEnd, today);
    const dependents = tasks.filter(t => t.dependencies && t.dependencies.includes(modifiedTask.id));

    if (dependents.length > 0) {
      const names = dependents.map(t => t.name).join(', ');
      App.toast(`⚠️ Retraso de ${delayDays} días afecta a: ${names}`, 'warning');
    }
  }

  async function editTask(id) {
    const task = await DB.getById('tasks', id);
    if (task) openTaskForm(task);
  }

  async function inlineUpdate(id, field, value) {
    const task = await DB.getById('tasks', id);
    if (!task) return;

    // Validate dates
    if (field === 'startDate' && task.endDate && new Date(value) > new Date(task.endDate)) {
      App.toast('Inicio no puede ser posterior al fin', 'warning');
      loadTasks();
      return;
    }
    if (field === 'endDate' && task.startDate && new Date(value) < new Date(task.startDate)) {
      App.toast('Fin no puede ser anterior al inicio', 'warning');
      loadTasks();
      return;
    }
    if (field === 'name' && !value.trim()) {
      App.toast('El nombre es obligatorio', 'warning');
      loadTasks();
      return;
    }

    task[field] = value;
    task.updatedAt = new Date().toISOString();
    await DB.put('tasks', task);
    
    // Update local cache and re-render
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) tasks[idx] = task;
    render();
  }

  async function deleteTask(id) {
    if (!confirm('¿Eliminar esta tarea?')) return;
    await DB.remove('tasks', id);
    App.toast('Tarea eliminada', 'info');
    loadTasks();
  }

  function refresh() {
    loadTasks();
  }

  return { init, editTask, deleteTask, inlineUpdate, refresh };
})();
