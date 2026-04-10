/* ========================================
   Timeline Module - Cronograma de Obra
   Gantt chart con ruta crítica, línea base y dependencias visuales
   ======================================== */

const TimelineModule = (() => {
// Actualizado: 2026-04-10
  const DAY_WIDTH = 40;
  const LABEL_MIN_WIDTH = 140;
  const LABEL_MAX_WIDTH = 420;
  const LABEL_DEFAULT_WIDTH = 200;
  const DAY_MS = 1000 * 60 * 60 * 24;

  let tasks = [];
  let viewStart = null;
  let viewDays = 60;
  let projectId = null;
  let currentView = 'gantt';
  let hideCompleted = false;
  let showWeekends = true;
  let labelWidth = LABEL_DEFAULT_WIDTH;
  let listSortKey = 'startDate';
  let listSortAsc = true;
  let timelineDates = [];
  let timelineDateIndex = new Map();
  let contextTaskPreset = null;

  const TEMPLATE_TASKS = [
    { name: 'Fase de Estudios y Contratación · Revisión del Proyecto Ejecutivo', category: 'General', weight: 4 },
    { name: 'Fase de Estudios y Contratación · Licitación de Gremios', category: 'General', weight: 4 },
    { name: 'Fase de Estudios y Contratación · Planificación de Seguridad y Salud', category: 'General', weight: 3 },
    { name: 'Fase de Estudios y Contratación · Implantación de Obra', category: 'General', weight: 4 },
    { name: 'Movimiento de Tierras y Cimentación · Desbroce y Excavación', category: 'Demolición', weight: 6 },
    { name: 'Movimiento de Tierras y Cimentación · Cimentación', category: 'Estructura', weight: 8 },
    { name: 'Movimiento de Tierras y Cimentación · Saneamiento Enterrado', category: 'Fontanería', weight: 4 },
    { name: 'Estructura y Envolvente · Estructura', category: 'Estructura', weight: 10 },
    { name: 'Estructura y Envolvente · Cubierta', category: 'Acabados', weight: 5 },
    { name: 'Estructura y Envolvente · Fachadas', category: 'Albañilería', weight: 7 },
    { name: 'Instalaciones y Particiones · Tabiquería', category: 'Albañilería', weight: 6 },
    { name: 'Instalaciones y Particiones · Rozas y Cableado', category: 'Electricidad', weight: 8 },
    { name: 'Instalaciones y Particiones · Aislamientos', category: 'Acabados', weight: 4 },
    { name: 'Acabados y Revestimientos · Pavimentos y Alicatados', category: 'Acabados', weight: 7 },
    { name: 'Acabados y Revestimientos · Carpintería', category: 'Carpintería', weight: 5 },
    { name: 'Acabados y Revestimientos · Pintura y Repasos', category: 'Pintura', weight: 5 },
    { name: 'Acabados y Revestimientos · Mecanismos', category: 'Electricidad', weight: 4 },
    { name: 'Cierre, Certificación y Entrega · Punch List', category: 'Acabados', weight: 3 },
    { name: 'Cierre, Certificación y Entrega · Limpieza de Obra', category: 'Limpieza', weight: 2 },
    { name: 'Cierre, Certificación y Entrega · Final de Obra (LFO)', category: 'General', weight: 3 }
  ];

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

  function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function toISODate(value) {
    return startOfDay(value).toISOString().slice(0, 10);
  }

  function addDays(value, days) {
    const date = startOfDay(value);
    date.setDate(date.getDate() + days);
    return toISODate(date);
  }

  function diffDays(from, to) {
    const start = startOfDay(from);
    const end = startOfDay(to);
    return Math.round((end - start) / DAY_MS);
  }

  function inclusiveDuration(startDate, endDate) {
    return diffDays(startDate, endDate) + 1;
  }

  function getPhase(category) {
    return PHASES.find(phase => phase.key === category) || PHASES[PHASES.length - 1];
  }

  function getVisibleTasks() {
    return hideCompleted ? tasks.filter(task => (task.progress || 0) < 100) : tasks;
  }

  function isWeekend(dateValue) {
    const day = startOfDay(dateValue).getDay();
    return day === 0 || day === 6;
  }

  function buildTimelineDates(startDate, endDate) {
    const dates = [];
    const cursor = startOfDay(startDate);
    const end = startOfDay(endDate);

    while (cursor <= end) {
      if (showWeekends || !isWeekend(cursor)) {
        dates.push(toISODate(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    timelineDates = dates;
    timelineDateIndex = new Map(dates.map((date, index) => [date, index]));
    viewDays = dates.length;
  }

  function getVisibleDayCount(startDate, endDate) {
    let count = 0;
    const cursor = startOfDay(startDate);
    const end = startOfDay(endDate);

    while (cursor <= end) {
      if (showWeekends || !isWeekend(cursor)) count += 1;
      cursor.setDate(cursor.getDate() + 1);
    }

    return Math.max(1, count);
  }

  function getDateOffset(dateValue) {
    const date = startOfDay(dateValue);
    const iso = toISODate(date);
    if (timelineDateIndex.has(iso)) return timelineDateIndex.get(iso);

    const direction = timelineDates.length > 0 && date < startOfDay(timelineDates[0]) ? -1 : 1;
    const probe = startOfDay(date);

    for (let attempts = 0; attempts < 14; attempts++) {
      probe.setDate(probe.getDate() + direction);
      const probeIso = toISODate(probe);
      if (timelineDateIndex.has(probeIso)) return timelineDateIndex.get(probeIso);
    }

    return direction < 0 ? 0 : Math.max(0, timelineDates.length - 1);
  }

  function moveDateByColumns(dateValue, columnDelta) {
    if (showWeekends) return addDays(dateValue, columnDelta);

    const date = startOfDay(dateValue);
    const direction = columnDelta >= 0 ? 1 : -1;
    let remaining = Math.abs(columnDelta);

    while (remaining > 0) {
      date.setDate(date.getDate() + direction);
      if (!isWeekend(date)) remaining -= 1;
    }

    return toISODate(date);
  }

  function getWeekdayLabel(dateValue) {
    return ['D', 'L', 'M', 'M', 'J', 'V', 'S'][startOfDay(dateValue).getDay()];
  }

  function groupTasksByPhase(taskList) {
    const groups = [];
    for (const phase of PHASES) {
      const phaseTasks = taskList.filter(task => (task.category || 'General') === phase.key);
      if (phaseTasks.length > 0) {
        const completed = phaseTasks.filter(task => (task.progress || 0) >= 100).length;
        const avgProgress = Math.round(phaseTasks.reduce((sum, task) => sum + (task.progress || 0), 0) / phaseTasks.length);
        groups.push({ ...phase, tasks: phaseTasks, completed, total: phaseTasks.length, avgProgress });
      }
    }
    return groups;
  }

  function buildSuccessors(taskList) {
    const successors = new Map();
    taskList.forEach(task => successors.set(task.id, []));
    taskList.forEach(task => {
      (task.dependencies || []).forEach(depId => {
        if (successors.has(depId)) successors.get(depId).push(task.id);
      });
    });
    return successors;
  }

  function topologicalSort(taskList) {
    const ids = new Set(taskList.map(task => task.id));
    const indegree = new Map();
    const adjacency = new Map();

    taskList.forEach(task => {
      indegree.set(task.id, 0);
      adjacency.set(task.id, []);
    });

    taskList.forEach(task => {
      (task.dependencies || []).forEach(depId => {
        if (!ids.has(depId)) return;
        adjacency.get(depId).push(task.id);
        indegree.set(task.id, indegree.get(task.id) + 1);
      });
    });

    const queue = [];
    indegree.forEach((value, id) => {
      if (value === 0) queue.push(id);
    });

    const order = [];
    while (queue.length) {
      const id = queue.shift();
      order.push(id);
      adjacency.get(id).forEach(nextId => {
        indegree.set(nextId, indegree.get(nextId) - 1);
        if (indegree.get(nextId) === 0) queue.push(nextId);
      });
    }

    if (order.length !== taskList.length) {
      taskList.forEach(task => {
        if (!order.includes(task.id)) order.push(task.id);
      });
    }

    return order;
  }

  function calculateCriticalPath(taskList = tasks) {
    const criticalIds = new Set();
    if (taskList.length === 0) return criticalIds;

    const taskMap = new Map(taskList.map(task => [task.id, task]));
    const successors = buildSuccessors(taskList);
    const order = topologicalSort(taskList);
    const es = new Map();
    const ef = new Map();

    order.forEach(id => {
      const task = taskMap.get(id);
      const duration = Math.max(1, inclusiveDuration(task.startDate, task.endDate));
      let earliestStart = 0;
      (task.dependencies || []).forEach(depId => {
        if (ef.has(depId)) earliestStart = Math.max(earliestStart, ef.get(depId));
      });
      es.set(id, earliestStart);
      ef.set(id, earliestStart + duration);
    });

    const projectDuration = Math.max(...Array.from(ef.values()));
    const ls = new Map();
    const lf = new Map();

    [...order].reverse().forEach(id => {
      const task = taskMap.get(id);
      const duration = Math.max(1, inclusiveDuration(task.startDate, task.endDate));
      const next = successors.get(id) || [];
      const latestFinish = next.length > 0
        ? Math.min(...next.map(nextId => ls.get(nextId)))
        : projectDuration;
      lf.set(id, latestFinish);
      ls.set(id, latestFinish - duration);
    });

    order.forEach(id => {
      const slack = (ls.get(id) || 0) - (es.get(id) || 0);
      if (Math.abs(slack) <= 0.0001) criticalIds.add(id);
    });

    return criticalIds;
  }

  function getResponsibleInitials(responsible) {
    if (!responsible) return '';

    const cleaned = responsible.trim().replace(/\s+/g, ' ');
    if (!cleaned) return '';

    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
  }

  function getTaskState(task, today, criticalIds) {
    const startDate = startOfDay(task.startDate);
    const endDate = startOfDay(task.endDate);
    const progress = task.progress || 0;
    const isCompleted = progress >= 100;
    const isDelayed = !isCompleted && (endDate < today || (startDate < today && progress === 0));
    const isActiveToday = !isCompleted && !isDelayed && startDate <= today && endDate >= today;
    const isCritical = criticalIds.has(task.id);

    if (isCompleted) {
      return { key: 'completed', barClass: 'completed', badgeClass: 'completed', label: 'Completada' };
    }
    if (isDelayed) {
      const delayDays = Math.max(1, diffDays(endDate, today));
      return { key: 'delayed', barClass: 'delayed', badgeClass: 'delayed', label: `${delayDays}d retraso` };
    }
    if (isActiveToday) {
      return { key: 'active', barClass: 'active', badgeClass: 'active', label: 'En ejecución' };
    }
    if (isCritical) {
      return { key: 'critical', barClass: 'critical', badgeClass: 'critical', label: 'Ruta crítica' };
    }
    return { key: 'normal', barClass: 'normal', badgeClass: 'normal', label: 'Planificada' };
  }

  function getBaselineVariance(task) {
    if (!task.baselineStartDate || !task.baselineEndDate) return null;
    const startVariance = diffDays(task.baselineStartDate, task.startDate);
    const endVariance = diffDays(task.baselineEndDate, task.endDate);
    return {
      startVariance,
      endVariance,
      label: `${endVariance > 0 ? '+' : ''}${endVariance}d vs base`
    };
  }

  function init(pid) {
    projectId = pid;
    loadLabelWidth();
    applyLabelWidth();
    setupButtons();
    loadTasks();
  }

  function loadLabelWidth() {
    const saved = parseInt(localStorage.getItem('gestion-obra-timeline-label-width') || '', 10);
    if (Number.isFinite(saved)) {
      labelWidth = Math.min(LABEL_MAX_WIDTH, Math.max(LABEL_MIN_WIDTH, saved));
    }
  }

  function applyLabelWidth() {
    const section = document.getElementById('section-timeline');
    if (!section) return;
    section.style.setProperty('--timeline-label-width', `${labelWidth}px`);
  }

  function setLabelWidth(nextWidth) {
    labelWidth = Math.min(LABEL_MAX_WIDTH, Math.max(LABEL_MIN_WIDTH, Math.round(nextWidth)));
    localStorage.setItem('gestion-obra-timeline-label-width', String(labelWidth));
    applyLabelWidth();
  }

  function setupButtons() {
    document.getElementById('btn-add-task').onclick = () => openTaskFromContext();
    document.getElementById('btn-add-task-empty').onclick = () => openTaskFromContext();
    document.getElementById('btn-apply-template').onclick = applySuggestedTemplate;
    document.getElementById('btn-apply-template-empty').onclick = applySuggestedTemplate;
    document.getElementById('btn-zoom-timeline').onclick = scrollToToday;
    document.getElementById('btn-set-baseline').onclick = saveBaseline;
    document.getElementById('btn-clear-all-tasks').onclick = clearAllTasks;

    document.getElementById('btn-view-gantt').onclick = () => switchView('gantt');
    document.getElementById('btn-view-list').onclick = () => switchView('list');

    const hideDoneCheck = document.getElementById('tl-hide-done');
    if (hideDoneCheck) {
      hideDoneCheck.onchange = (e) => {
        hideCompleted = e.target.checked;
        render();
      };
    }

    const showWeekendsCheck = document.getElementById('tl-show-weekends');
    if (showWeekendsCheck) {
      showWeekendsCheck.checked = showWeekends;
      showWeekendsCheck.onchange = (e) => {
        showWeekends = e.target.checked;
        render();
      };
    }

    document.querySelectorAll('#timeline-table th[data-sort]').forEach(th => {
      th.onclick = () => sortListBy(th.dataset.sort);
    });
  }

  function switchView(view) {
    currentView = view;
    document.getElementById('btn-view-gantt').classList.toggle('active', view === 'gantt');
    document.getElementById('btn-view-list').classList.toggle('active', view === 'list');
    render();
  }

  function sortListBy(key) {
    if (listSortKey === key) listSortAsc = !listSortAsc;
    else {
      listSortKey = key;
      listSortAsc = true;
    }
    render();
  }

  async function loadTasks() {
    tasks = await DB.getAllForProject('tasks', projectId);
    render();
  }

  function renderSummary(taskList) {
    const summary = document.getElementById('timeline-summary');
    if (!summary) return;

    const today = startOfDay(new Date());
    const criticalIds = calculateCriticalPath(tasks);
    const states = taskList.map(task => getTaskState(task, today, criticalIds));

    const activeCount = states.filter(state => state.key === 'active').length;
    const delayedCount = states.filter(state => state.key === 'delayed').length;
    const criticalCount = states.filter(state => state.key === 'critical').length;
    const baselineCount = taskList.filter(task => task.baselineStartDate && task.baselineEndDate).length;

    summary.innerHTML = `
      <div class="timeline-summary-card active">
        <span class="timeline-summary-label">En ejecución hoy</span>
        <strong class="timeline-summary-value">${activeCount}</strong>
      </div>
      <div class="timeline-summary-card delayed">
        <span class="timeline-summary-label">Retrasadas</span>
        <strong class="timeline-summary-value">${delayedCount}</strong>
      </div>
      <div class="timeline-summary-card critical">
        <span class="timeline-summary-label timeline-summary-label-help">
          Ruta crítica
          <span class="timeline-help-icon" title="Tareas sin margen. Si una se retrasa, se retrasa también la fecha final de la obra.">
            <i data-lucide="circle-help"></i>
          </span>
        </span>
        <strong class="timeline-summary-value">${criticalCount}</strong>
      </div>
      <div class="timeline-summary-card baseline">
        <span class="timeline-summary-label">Con plan inicial</span>
        <strong class="timeline-summary-value">${baselineCount}</strong>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function render() {
    const ganttContainer = document.getElementById('timeline-container');
    const listContainer = document.getElementById('timeline-list-container');
    const emptyState = document.getElementById('timeline-empty');
    const zoomBtn = document.getElementById('btn-zoom-timeline');
    const visibleTasks = getVisibleTasks();

    renderSummary(visibleTasks);

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

      const allDates = visibleTasks.flatMap(task => [startOfDay(task.startDate), startOfDay(task.endDate)]);
      const baselineDates = visibleTasks.flatMap(task => task.baselineStartDate && task.baselineEndDate
        ? [startOfDay(task.baselineStartDate), startOfDay(task.baselineEndDate)]
        : []);
      const datePool = allDates.concat(baselineDates);
      const minDate = new Date(Math.min(...datePool));
      const maxDate = new Date(Math.max(...datePool));

      viewStart = startOfDay(minDate);
      viewStart.setDate(viewStart.getDate() - 3);
      const viewEnd = startOfDay(maxDate);
      viewEnd.setDate(viewEnd.getDate() + 10);
      buildTimelineDates(viewStart, viewEnd);

      renderHeader();
      renderBody(visibleTasks);
    } else {
      ganttContainer.classList.remove('visible');
      listContainer.style.display = 'block';
      zoomBtn.style.display = 'none';
      renderListView(visibleTasks);
    }
  }

  function renderHeader() {
    const header = document.getElementById('timeline-header');
    const today = startOfDay(new Date());

    let html = `
      <div class="timeline-row-label timeline-header-label-cell" style="min-height:40px;font-weight:600;font-size:12px;color:var(--text-muted);">
        <span>Tarea</span>
        <button class="timeline-label-resizer" id="timeline-label-resizer" type="button" title="Arrastrar para cambiar el ancho de la columna de tareas" aria-label="Redimensionar columna de tareas"></button>
      </div>`;

    timelineDates.forEach((dateValue, index) => {
      const date = startOfDay(dateValue);
      const isToday = date.toDateString() === today.toDateString();
      const weekendDay = isWeekend(date);
      const monthLabel = date.getDate() === 1 || index === 0
        ? date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()
        : '';

      html += `
        <div class="timeline-header-cell ${isToday ? 'today' : ''} ${weekendDay ? 'weekend' : ''}" data-date="${dateValue}">
          ${monthLabel ? `<div style="font-size:9px;color:var(--cyan)">${monthLabel}</div>` : ''}
          <div class="timeline-weekday">${getWeekdayLabel(date)}</div>
          <div>${date.getDate()}</div>
        </div>
      `;
    });

    header.innerHTML = html;
    bindLabelResizeHandle();
  }

  function bindLabelResizeHandle() {
    const handle = document.getElementById('timeline-label-resizer');
    if (!handle) return;

    handle.onpointerdown = (event) => startLabelResize(event);
  }

  function startLabelResize(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = labelWidth;
    document.body.classList.add('is-resizing-timeline-label');

    const onMove = (moveEvent) => {
      setLabelWidth(startWidth + (moveEvent.clientX - startX));
      render();
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.classList.remove('is-resizing-timeline-label');
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function renderBody(visibleTasks) {
    const body = document.getElementById('timeline-body');
    const today = startOfDay(new Date());
    const criticalTasks = calculateCriticalPath(tasks);
    const groups = groupTasksByPhase(visibleTasks);

    let html = '<svg class="timeline-deps" id="timeline-deps"></svg>';

    groups.forEach(group => {
      html += `
        <div class="phase-header-row" data-category="${App.escapeHTML(group.key)}" style="--phase-color:${group.color}">
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

      const sorted = [...group.tasks].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

      sorted.forEach(task => {
        const startOffset = getDateOffset(task.startDate);
        const duration = getVisibleDayCount(task.startDate, task.endDate);
        const state = getTaskState(task, today, criticalTasks);
        const variance = getBaselineVariance(task);
        const responsibleInitials = getResponsibleInitials(task.responsible || '');

        let cells = '';
        timelineDates.forEach(dateValue => {
          const date = startOfDay(dateValue);
          const isToday = date.toDateString() === today.toDateString();
          const weekendDay = isWeekend(date);
          cells += `<div class="timeline-cell ${isToday ? 'today' : ''} ${weekendDay ? 'weekend' : ''}" data-date="${dateValue}"></div>`;
        });

        let baselineHtml = '';
        if (task.baselineStartDate && task.baselineEndDate) {
          const baselineStartOffset = getDateOffset(task.baselineStartDate);
          const baselineDuration = getVisibleDayCount(task.baselineStartDate, task.baselineEndDate);
          baselineHtml = `
            <div class="task-baseline"
                 style="left:${baselineStartOffset * DAY_WIDTH}px; width:${baselineDuration * DAY_WIDTH - 4}px;"
                title="Plan inicial: ${App.formatDate(task.baselineStartDate)} → ${App.formatDate(task.baselineEndDate)}"></div>
          `;
        }

        const titleParts = [
          `${App.escapeHTML(task.name)}: ${App.formatDate(task.startDate)} → ${App.formatDate(task.endDate)}`,
          `(${task.progress || 0}%)`,
          variance ? `· ${variance.label}` : ''
        ];

        html += `
          <div class="timeline-row" data-category="${App.escapeHTML(task.category || 'General')}" ondblclick="TimelineModule.editTask(${task.id})">
            <div class="timeline-row-label">
              <span class="phase-color-dot" style="background:${group.color}"></span>
              <span class="task-name" title="${App.escapeHTML(task.name)}">${App.escapeHTML(task.name)}</span>
              <div class="task-actions">
                <button class="action-btn" onclick="TimelineModule.editTask(${task.id})" title="${App.t('edit')}">
                  <i data-lucide="pencil" style="width:14px;height:14px"></i>
                </button>
                <button class="action-btn delete" onclick="TimelineModule.deleteTask(${task.id})" title="${App.t('delete')}">
                  <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                </button>
              </div>
            </div>
            <div class="timeline-row-cells">
              ${cells}
              ${baselineHtml}
              <div class="task-bar ${state.barClass}"
                   data-task-id="${task.id}"
                   style="left:${startOffset * DAY_WIDTH}px; width:${duration * DAY_WIDTH - 4}px;"
                   title="${titleParts.join(' ')}">
                ${task.progress > 0 ? `<div class="task-progress" style="width:${task.progress}%"></div>` : ''}
                ${responsibleInitials ? `<span class="task-bar-responsible" title="${App.t('responsible')}: ${App.escapeHTML(task.responsible || '')}">${App.escapeHTML(responsibleInitials)}</span>` : ''}
                <span class="task-bar-label">${task.progress || 0}%</span>
              </div>
            </div>
          </div>
        `;
      });
    });

    const todayOffset = timelineDateIndex.get(toISODate(today));
    if (todayOffset !== undefined) {
      html += `<div class="today-line" style="left:${labelWidth + todayOffset * DAY_WIDTH + DAY_WIDTH / 2}px;"></div>`;
    }

    body.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    bindGanttInteractions();
    requestAnimationFrame(() => renderDependencyLines(visibleTasks));
  }

  function renderDependencyLines(visibleTasks) {
    const body = document.getElementById('timeline-body');
    const svg = document.getElementById('timeline-deps');
    if (!body || !svg) return;

    const bodyRect = body.getBoundingClientRect();
    svg.setAttribute('width', body.scrollWidth);
    svg.setAttribute('height', body.scrollHeight);

    const taskMap = new Map(visibleTasks.map(task => [task.id, task]));
    const paths = [];

    visibleTasks.forEach(task => {
      const targetBar = body.querySelector(`.task-bar[data-task-id="${task.id}"]`);
      if (!targetBar) return;
      const targetRect = targetBar.getBoundingClientRect();
      const endX = targetRect.left - bodyRect.left;
      const endY = targetRect.top - bodyRect.top + targetRect.height / 2;

      (task.dependencies || []).forEach(depId => {
        if (!taskMap.has(depId)) return;
        const sourceBar = body.querySelector(`.task-bar[data-task-id="${depId}"]`);
        if (!sourceBar) return;
        const sourceRect = sourceBar.getBoundingClientRect();
        const startX = sourceRect.right - bodyRect.left;
        const startY = sourceRect.top - bodyRect.top + sourceRect.height / 2;
        const midX = startX + Math.max(24, (endX - startX) / 2);
        paths.push(`<path d="M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}" class="timeline-dep-line"></path>`);
        paths.push(`<circle cx="${endX}" cy="${endY}" r="2.5" class="timeline-dep-dot"></circle>`);
      });
    });

    svg.innerHTML = paths.join('');
  }

  function bindGanttInteractions() {
    const bars = document.querySelectorAll('.task-bar[data-task-id]');
    bars.forEach(bar => {
      bar.onpointerdown = (event) => startBarDrag(event, bar);
    });
  }

  function startBarDrag(event, bar) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const taskId = parseInt(bar.dataset.taskId, 10);
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;

    const startX = event.clientX;
    let deltaX = 0;
    bar.classList.add('dragging');

    const onMove = (moveEvent) => {
      deltaX = moveEvent.clientX - startX;
      bar.style.transform = `translateX(${deltaX}px)`;
    };

    const onUp = async () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      bar.classList.remove('dragging');
      bar.style.transform = '';

      const movedDays = Math.round(deltaX / DAY_WIDTH);
      if (Math.abs(deltaX) < 4) {
        editTask(taskId);
        return;
      }
      if (movedDays === 0) return;

      const updatedTask = {
        ...task,
        startDate: moveDateByColumns(task.startDate, movedDays),
        endDate: moveDateByColumns(task.endDate, movedDays),
        updatedAt: new Date().toISOString()
      };

      await DB.put('tasks', updatedTask);
      const index = tasks.findIndex(item => item.id === taskId);
      if (index !== -1) tasks[index] = updatedTask;
      App.toast(`Tarea movida ${movedDays > 0 ? '+' : ''}${movedDays}d`, 'success');
      render();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function renderListView(visibleTasks) {
    const tbody = document.getElementById('timeline-table-body');
    const today = startOfDay(new Date());
    const criticalTasks = calculateCriticalPath(tasks);

    function sortTasks(list) {
      return [...list].sort((a, b) => {
        let valueA;
        let valueB;
        switch (listSortKey) {
          case 'name': valueA = (a.name || '').toLowerCase(); valueB = (b.name || '').toLowerCase(); break;
          case 'category': valueA = (a.category || '').toLowerCase(); valueB = (b.category || '').toLowerCase(); break;
          case 'responsible': valueA = (a.responsible || '').toLowerCase(); valueB = (b.responsible || '').toLowerCase(); break;
          case 'startDate': valueA = a.startDate; valueB = b.startDate; break;
          case 'endDate': valueA = a.endDate; valueB = b.endDate; break;
          case 'duration': valueA = inclusiveDuration(a.startDate, a.endDate); valueB = inclusiveDuration(b.startDate, b.endDate); break;
          case 'progress': valueA = a.progress || 0; valueB = b.progress || 0; break;
          default: valueA = a.startDate; valueB = b.startDate;
        }
        if (valueA < valueB) return listSortAsc ? -1 : 1;
        if (valueA > valueB) return listSortAsc ? 1 : -1;
        return 0;
      });
    }

    document.querySelectorAll('#timeline-table th[data-sort]').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === listSortKey) th.classList.add(listSortAsc ? 'sort-asc' : 'sort-desc');
    });

    const groups = groupTasksByPhase(visibleTasks);
    const categories = ['General','Demolición','Estructura','Albañilería','Fontanería','Electricidad','Carpintería','Pintura','Acabados','Limpieza'];

    let rows = '';
    groups.forEach(group => {
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

      sortTasks(group.tasks).forEach(task => {
        const state = getTaskState(task, today, criticalTasks);
        const variance = getBaselineVariance(task);

        const depsHtml = (task.dependencies || []).map(depId => {
          const dep = tasks.find(item => item.id === depId);
          if (!dep) return '';
          const depPhase = getPhase(dep.category);
          const depState = getTaskState(dep, today, criticalTasks);
          const tagClass = depState.key === 'completed' ? 'dep-tag-done' : depState.key === 'delayed' ? 'dep-tag-pending' : '';
          return `<span class="dep-tag ${tagClass}"><span class="dep-dot" style="background:${depPhase.color}"></span>${App.escapeHTML(dep.name)}</span>`;
        }).filter(Boolean).join('') || '<span style="color:var(--text-muted)">—</span>';

        const catOptions = categories.map(category => `
          <option value="${category}" ${(task.category || 'General') === category ? 'selected' : ''}>${category}</option>
        `).join('');

        rows += `
          <tr class="tl-row-${state.key}" ondblclick="if(!event.target.closest('input,select,button'))TimelineModule.editTask(${task.id})">
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
              <input class="tl-inline" type="text" value="${App.escapeHTML(task.responsible || '')}" placeholder="${App.t('responsible_placeholder')}"
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
            <td class="tl-cell-num">${inclusiveDuration(task.startDate, task.endDate)}d</td>
            <td>
              <div class="tl-progress-wrap">
                <input type="range" class="tl-inline-range" min="0" max="100" step="5" value="${task.progress || 0}"
                  onchange="TimelineModule.inlineUpdate(${task.id},'progress',parseInt(this.value, 10))"
                  oninput="this.nextElementSibling.textContent=this.value+'%'"
                  title="${task.progress || 0}%">
                <span class="tl-progress-label">${task.progress || 0}%</span>
              </div>
            </td>
            <td class="tl-cell-deps">${depsHtml}</td>
            <td>
              <span class="tl-status-badge tl-badge-${state.badgeClass}">${state.label}</span>
              ${variance ? `<div class="tl-variance">${variance.label}</div>` : ''}
            </td>
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
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function scrollToToday() {
    const container = document.getElementById('timeline-container');
    const today = startOfDay(new Date());
    if (!viewStart || timelineDates.length === 0) return;

    const todayOffset = timelineDateIndex.get(toISODate(today)) ?? 0;
    const scrollX = Math.max(0, todayOffset * DAY_WIDTH - container.clientWidth / 2 + labelWidth);
    container.scrollLeft = scrollX;
  }

  async function applySuggestedTemplate() {
    const project = await DB.getById('projects', projectId);
    if (!project) return;

    const existingTasks = tasks.filter(task => task.systemTag !== 'project-deadline-milestone');
    if (existingTasks.length > 0 && !confirm('Ya hay tareas en el cronograma. ¿Quieres añadir igualmente la plantilla base?')) return;

    const startDate = toISODate(project.createdAt || new Date());
    const endDate = project.targetEndDate || addDays(startDate, 180);
    const totalDays = Math.max(TEMPLATE_TASKS.length, inclusiveDuration(startDate, endDate));
    const totalWeight = TEMPLATE_TASKS.reduce((sum, item) => sum + item.weight, 0);
    const now = new Date().toISOString();

    let remainingDays = totalDays;
    let currentStart = startDate;
    let previousTaskId = null;

    for (let index = 0; index < TEMPLATE_TASKS.length; index++) {
      const item = TEMPLATE_TASKS[index];
      const isLast = index === TEMPLATE_TASKS.length - 1;
      const duration = isLast
        ? remainingDays
        : Math.max(1, Math.round((totalDays * item.weight) / totalWeight));
      const safeDuration = Math.max(1, Math.min(remainingDays, duration));
      const endTaskDate = addDays(currentStart, safeDuration - 1);

      const taskData = {
        name: item.name,
        category: item.category,
        responsible: '',
        startDate: currentStart,
        endDate: endTaskDate,
        progress: 0,
        dependencies: previousTaskId ? [previousTaskId] : [],
        projectId,
        createdAt: now,
        updatedAt: now,
        baselineStartDate: currentStart,
        baselineEndDate: endTaskDate,
        templateId: 'base-obra-v1'
      };

      previousTaskId = await DB.add('tasks', taskData);
      remainingDays = Math.max(1, remainingDays - safeDuration);
      currentStart = addDays(endTaskDate, 1);
    }

    await App.syncProjectDeadlineMilestone(project);
    App.toast('Plantilla base aplicada al cronograma', 'success');
    loadTasks();
  }

  async function saveBaseline() {
    if (tasks.length === 0) {
      App.toast('No hay tareas para guardar un plan inicial', 'warning');
      return;
    }
    if (!confirm('¿Guardar la planificación actual como plan inicial de referencia? Luego podrás comparar retrasos o cambios contra este plan.')) return;

    for (const task of tasks) {
      const updatedTask = {
        ...task,
        baselineStartDate: task.startDate,
        baselineEndDate: task.endDate,
        updatedAt: new Date().toISOString()
      };
      await DB.put('tasks', updatedTask);
    }
    App.toast('Plan inicial guardado', 'success');
    loadTasks();
  }

  async function clearAllTasks() {
    if (tasks.length === 0) {
      App.toast('No hay tareas que borrar en el cronograma', 'warning');
      return;
    }

    const taskCount = tasks.length;
    if (!confirm(`Vas a borrar ${taskCount} tarea(s) del cronograma. ¿Quieres continuar?`)) return;
    if (!confirm('Esta acción eliminará todas las tareas y no se puede deshacer. ¿Confirmas el borrado total?')) return;

    for (const task of tasks) {
      await DB.remove('tasks', task.id);
    }

    contextTaskPreset = null;
    App.toast('Cronograma vaciado por completo', 'success');
    loadTasks();
  }

  function captureContextMenuTarget(target, clientX) {
    if (currentView !== 'gantt') {
      contextTaskPreset = null;
      return;
    }

    const row = target.closest('.timeline-row, .phase-header-row');
    const rowCells = target.closest('.timeline-row-cells');
    const headerCell = target.closest('.timeline-header-cell[data-date]');
    const rowCategory = row?.dataset.category || null;

    let startDate = headerCell?.dataset.date || null;

    if (!startDate && rowCells && timelineDates.length > 0) {
      const rect = rowCells.getBoundingClientRect();
      const offsetX = Math.max(0, clientX - rect.left);
      const columnIndex = Math.max(0, Math.min(timelineDates.length - 1, Math.floor(offsetX / DAY_WIDTH)));
      startDate = timelineDates[columnIndex] || null;
    }

    contextTaskPreset = startDate || rowCategory
      ? { startDate: startDate || null, category: rowCategory || null }
      : null;
  }

  function consumeContextTaskPreset() {
    const preset = contextTaskPreset;
    contextTaskPreset = null;
    return preset;
  }

  function openTaskFromContext() {
    const preset = consumeContextTaskPreset();
    openTaskForm(null, preset || null);
  }

  async function openTaskForm(task = null, preset = null) {
    const isEdit = !!task;
    const title = isEdit ? 'Editar Tarea' : 'Nueva Tarea';
    const allTasks = await DB.getAllForProject('tasks', projectId);
    const today = new Date().toISOString().slice(0, 10);
    const presetStartDate = !isEdit && preset?.startDate ? preset.startDate : today;
    const presetCategory = !isEdit && preset?.category ? preset.category : 'General';
    const baselineInfo = isEdit && task.baselineStartDate && task.baselineEndDate
      ? `<div class="tl-baseline-note"><strong>Plan inicial:</strong> ${App.formatDate(task.baselineStartDate)} → ${App.formatDate(task.baselineEndDate)}. Esta es la previsión original para comparar cambios posteriores.</div>`
      : '';

    const body = `
      <div class="form-group">
        <label>Nombre de la Tarea *</label>
        <input type="text" id="task-name" value="${isEdit ? App.escapeHTML(task.name) : ''}" placeholder="Ej: Instalación de fontanería">
      </div>
      <div class="form-group">
        <label>Fase de Obra *</label>
        <select id="task-category">
          ${PHASES.map(phase => `<option value="${phase.key}" ${(isEdit ? (task.category || 'General') : presetCategory) === phase.key ? 'selected' : ''}>${phase.key}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Responsable</label>
        <input type="text" id="task-responsible" value="${isEdit ? App.escapeHTML(task.responsible || '') : ''}" placeholder="Ej: Juan García / Electricista SL">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Fecha Inicio *</label>
          <input type="date" id="task-start" value="${isEdit ? task.startDate : presetStartDate}">
        </div>
        <div class="form-group">
          <label>Fecha Fin *</label>
          <input type="date" id="task-end" value="${isEdit ? task.endDate : ''}">
        </div>
      </div>
      ${baselineInfo}
      <div class="form-group">
        <label>Progreso (%) — ${isEdit ? task.progress || 0 : 0}%</label>
        <input type="range" id="task-progress" min="0" max="100" step="5" value="${isEdit ? task.progress || 0 : 0}"
               oninput="this.previousElementSibling.textContent='Progreso (%) — '+this.value+'%'"
               style="width:100%;accent-color:var(--cyan)">
      </div>
      <div class="form-group">
        <label>Dependencias (tareas que deben completarse antes)</label>
        <div style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);padding:var(--sp-sm);">
          ${allTasks.filter(item => !isEdit || item.id !== task.id).length > 0
            ? allTasks.filter(item => !isEdit || item.id !== task.id).map(item => {
                const phase = getPhase(item.category);
                const checked = isEdit && task.dependencies && task.dependencies.includes(item.id);
                return `
                  <label style="display:flex;align-items:center;gap:var(--sp-sm);padding:6px 4px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border);">
                    <input type="checkbox" class="dep-check" value="${item.id}" ${checked ? 'checked' : ''}
                      style="width:18px;height:18px;accent-color:var(--cyan);flex-shrink:0;">
                    <span style="width:8px;height:8px;border-radius:50%;background:${phase.color};flex-shrink:0;"></span>
                    <span style="flex:1;">${App.escapeHTML(item.name)}</span>
                    <span style="font-size:11px;color:var(--text-muted);">${item.progress || 0}%</span>
                  </label>`;
              }).join('')
            : '<span style="color:var(--text-muted);font-size:13px;padding:var(--sp-sm);">Crea más tareas para poder definir dependencias entre ellas</span>'}
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

      const dependencies = Array.from(document.querySelectorAll('.dep-check:checked')).map(checkbox => parseInt(checkbox.value, 10));

      const data = {
        name,
        category: document.getElementById('task-category').value,
        responsible: document.getElementById('task-responsible').value.trim(),
        startDate,
        endDate,
        progress: parseInt(document.getElementById('task-progress').value, 10),
        dependencies,
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = task.id;
        data.projectId = task.projectId;
        data.createdAt = task.createdAt;
        data.baselineStartDate = task.baselineStartDate || task.startDate;
        data.baselineEndDate = task.baselineEndDate || task.endDate;
        await DB.put('tasks', data);
        App.toast('Tarea actualizada', 'success');
        checkDelayPropagation(data);
      } else {
        data.createdAt = new Date().toISOString();
        data.projectId = projectId;
        data.baselineStartDate = startDate;
        data.baselineEndDate = endDate;
        await DB.add('tasks', data);
        App.toast('Tarea creada', 'success');
      }

      App.closeModal();
      loadTasks();
    });
  }

  function checkDelayPropagation(modifiedTask) {
    const today = startOfDay(new Date());
    const taskEnd = startOfDay(modifiedTask.endDate);
    if ((modifiedTask.progress || 0) >= 100 || taskEnd >= today) return;

    const delayDays = Math.max(1, diffDays(taskEnd, today));
    const dependents = tasks.filter(task => (task.dependencies || []).includes(modifiedTask.id));
    if (dependents.length > 0) {
      App.toast(`Retraso de ${delayDays} días afecta a: ${dependents.map(task => task.name).join(', ')}`, 'warning');
    }
  }

  async function editTask(id) {
    const task = await DB.getById('tasks', id);
    if (task) openTaskForm(task);
  }

  async function inlineUpdate(id, field, value) {
    const task = await DB.getById('tasks', id);
    if (!task) return;

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
    if (!task.baselineStartDate) task.baselineStartDate = task.startDate;
    if (!task.baselineEndDate) task.baselineEndDate = task.endDate;
    await DB.put('tasks', task);

    const index = tasks.findIndex(item => item.id === id);
    if (index !== -1) tasks[index] = task;
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

  return { init, editTask, deleteTask, inlineUpdate, refresh, applySuggestedTemplate, captureContextMenuTarget, openTaskFromContext };
})();
