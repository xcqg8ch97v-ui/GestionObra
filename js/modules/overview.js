/* ========================================
   Overview Module - Vista General del Proyecto
   Alertas, hitos, actividad reciente y acciones rápidas
   ======================================== */

const OverviewModule = (() => {
// Actualizado: 2026-04-10
  let projectId = null;

  function init(pid) {
    projectId = pid;
    bindActions();
    refresh();
  }

  function bindActions() {
    const grid = document.getElementById('overview-grid');
    if (!grid || grid.dataset.bound === 'true') return;

    grid.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-overview-action]');
      if (!trigger) return;

      const action = trigger.dataset.overviewAction;
      if (action === 'new-task') {
        App.navigateTo('timeline');
        setTimeout(() => document.getElementById('btn-add-task')?.click(), 60);
      }
      if (action === 'new-incident') {
        App.navigateTo('diary');
        setTimeout(() => document.getElementById('btn-add-incident')?.click(), 60);
      }
      if (action === 'new-comment') {
        App.navigateTo('diary');
        setTimeout(() => document.getElementById('btn-add-comment')?.click(), 60);
      }
      if (action === 'upload-file') {
        App.navigateTo('files');
        setTimeout(() => document.getElementById('btn-upload-file')?.click(), 60);
      }
      if (action === 'new-participant') {
        App.navigateTo('participants');
        setTimeout(() => document.getElementById('btn-add-participant')?.click(), 60);
      }
      if (action === 'open-incident') {
        const incidentId = parseInt(trigger.dataset.incidentId, 10);
        if (incidentId) App.openIncident(incidentId);
      }
    });

    grid.dataset.bound = 'true';
  }

  async function refresh() {
    if (!projectId) return;

    const grid = document.getElementById('overview-grid');
    if (grid && !grid.querySelector('.overview-card')) {
      grid.innerHTML = Array(4).fill(0).map(() => `
        <div class="overview-card overview-skeleton">
          <div class="skeleton-line skeleton-title"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line skeleton-short"></div>
        </div>`).join('') +
        `<div class="overview-card overview-card-wide overview-skeleton">
          <div class="skeleton-line skeleton-title"></div>
          <div class="skeleton-grid">
            ${Array(4).fill('<div class="skeleton-block"></div>').join('')}
          </div>
        </div>`;
    }

    const [project, tasks, budgets, incidents, suppliers, files, expenses] = await Promise.all([
      DB.getById('projects', projectId),
      DB.getAllForProject('tasks', projectId),
      DB.getAllForProject('budgets', projectId),
      DB.getAllForProject('incidents', projectId),
      DB.getAllForProject('suppliers', projectId),
      DB.getAllForProject('files', projectId),
      DB.getAllForProject('expenses', projectId)
    ]);

    renderCards(project, tasks, budgets, incidents, suppliers, files, expenses);
  }

  function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function daysDiff(from, to) {
    return Math.round((startOfDay(to) - startOfDay(from)) / (1000 * 60 * 60 * 24));
  }

  function formatRelativeDay(targetDate) {
    const days = daysDiff(new Date(), targetDate);
    if (days === 0) return App.t('today');
    if (days === 1) return App.t('tomorrow');
    if (days > 1) return App.t('in_days', { count: days });
    return App.t('days_ago', { count: Math.abs(days) });
  }

  function buildDeliverySummary(project) {
    if (!project?.targetEndDate) {
      return {
        value: App.t('overview_no_date'),
        detail: App.t('overview_set_target_date')
      };
    }

    const relative = formatRelativeDay(project.targetEndDate);
    return {
      value: App.formatDate(project.targetEndDate),
      detail: App.t('overview_delivery_target', { relative: relative.toLowerCase() })
    };
  }

  function addDays(value, days) {
    const date = startOfDay(value);
    date.setDate(date.getDate() + days);
    return date;
  }

  function buildScheduleRiskAlert(project, tasks) {
    if (!project?.targetEndDate) return null;

    const today = startOfDay(new Date());
    const targetEnd = startOfDay(project.targetEndDate);
    const relevantTasks = tasks.filter(task => task.systemTag !== 'project-deadline-milestone');
    const progress = relevantTasks.length > 0
      ? Math.round(relevantTasks.reduce((sum, task) => sum + (task.progress || 0), 0) / relevantTasks.length)
      : 0;

    const startPool = [project.createdAt, ...relevantTasks.map(task => task.startDate)].filter(Boolean);
    const projectStart = startOfDay(new Date(Math.min(...startPool.map(item => startOfDay(item).getTime()))));
    const totalDays = Math.max(1, daysDiff(projectStart, targetEnd));
    const elapsedDays = Math.max(0, daysDiff(projectStart, today));
    const remainingDays = Math.max(0, daysDiff(today, targetEnd));
    const expectedProgress = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

    let projectedEnd = null;
    if (elapsedDays > 0 && progress > 0 && progress < 100) {
      const projectedTotalDays = Math.round(elapsedDays / (progress / 100));
      projectedEnd = addDays(projectStart, projectedTotalDays);
    }

    const behindSchedule = progress + 10 < expectedProgress;
    const projectedDelayDays = projectedEnd ? Math.max(0, daysDiff(targetEnd, projectedEnd)) : 0;
    const closeToDeadline = remainingDays <= 21;

    if (!closeToDeadline && !behindSchedule && projectedDelayDays === 0) return null;
    if (progress >= 100) return null;

    return {
      level: projectedDelayDays > 7 || remainingDays <= 7 ? 'danger' : 'warning',
      icon: 'siren',
      title: 'Riesgo de no llegar a plazo',
      detail: projectedDelayDays > 0
        ? `Al ritmo actual, acabaríamos con ${projectedDelayDays} día(s) de retraso`
        : `Quedan ${remainingDays} día(s) y el avance real va por detrás del esperado`,
      meta: `Objetivo ${App.formatDate(project.targetEndDate)} · Avance ${progress}% · Esperado ${expectedProgress}%`
    };
  }

  function buildAlerts(project, tasks, budgets, incidents, suppliers) {
    const today = startOfDay(new Date());
    const totalEstimated = budgets.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);
    const totalReal = budgets.reduce((sum, item) => sum + (item.realCost || 0), 0);
    const budgetDeviation = totalEstimated > 0 ? ((totalReal - totalEstimated) / totalEstimated) * 100 : 0;

    const delayedTasks = tasks.filter(task => {
      const end = startOfDay(task.endDate);
      const start = startOfDay(task.startDate);
      const progress = task.progress || 0;
      return progress < 100 && (end < today || (start < today && progress === 0));
    });

    const activeTasks = tasks.filter(task => {
      const start = startOfDay(task.startDate);
      const end = startOfDay(task.endDate);
      const progress = task.progress || 0;
      return progress > 0 && progress < 100 && start <= today && end >= today;
    });

    const pendingIncidents = incidents.filter(item => item.entryType === 'incident' && item.status === 'pending');
    const pendingSuppliers = suppliers.filter(item => (item.status || '').toLowerCase() === 'pendiente');

    const alerts = [];
    const scheduleRiskAlert = buildScheduleRiskAlert(project, tasks);
    if (scheduleRiskAlert) alerts.push(scheduleRiskAlert);

    if (delayedTasks.length > 0) {
      alerts.push({
        level: 'danger',
        icon: 'triangle-alert',
        title: App.t('overview_alert_delayed_tasks'),
        detail: App.t('overview_alert_delayed_count', { count: delayedTasks.length }),
        meta: delayedTasks.slice(0, 2).map(task => task.name).join(' · ')
      });
    }
    if (activeTasks.length > 0) {
      alerts.push({
        level: 'success',
        icon: 'play-circle',
        title: App.t('overview_alert_active_tasks'),
        detail: App.t('overview_alert_active_count', { count: activeTasks.length }),
        meta: activeTasks.slice(0, 2).map(task => task.name).join(' · ')
      });
    }
    pendingIncidents.slice(0, 3).forEach(item => {
      alerts.push({
        level: 'warning',
        icon: 'shield-alert',
        title: App.t('overview_alert_pending_incident'),
        detail: item.description,
        meta: `${App.formatDateTime(item.date)} · ${item.category || App.t('overview_no_category')}`,
        action: 'open-incident',
        incidentId: item.id,
        actionLabel: App.t('overview_open_incident')
      });
    });
    if (budgetDeviation > 5) {
      alerts.push({
        level: 'danger',
        icon: 'wallet-cards',
        title: App.t('overview_alert_budget_deviation'),
        detail: App.t('overview_alert_budget_deviation_detail', { percent: Math.round(budgetDeviation) }),
        meta: `${App.formatCurrency(totalReal)} vs ${App.formatCurrency(totalEstimated)}`
      });
    }
    if (pendingSuppliers.length > 0) {
      alerts.push({
        level: 'info',
        icon: 'users-round',
        title: App.t('overview_alert_pending_suppliers'),
        detail: App.t('overview_alert_pending_suppliers_detail', { count: pendingSuppliers.length }),
        meta: pendingSuppliers.slice(0, 2).map(item => item.name).join(' · ')
      });
    }

    return alerts.slice(0, 6);
  }

  function buildMilestones(tasks) {
    const today = startOfDay(new Date());
    const limit = startOfDay(new Date());
    limit.setDate(limit.getDate() + 14);

    return tasks
      .filter(task => {
        const end = startOfDay(task.endDate);
        return (task.progress || 0) < 100 && end >= today && end <= limit;
      })
      .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
      .slice(0, 6)
      .map(task => ({
        id: task.id,
        title: task.name,
        date: task.endDate,
        relative: formatRelativeDay(task.endDate),
        progress: task.progress || 0,
        phase: task.category || 'General'
      }));
  }

  function buildRecentActivity(tasks, incidents, files) {
    const items = [];

    tasks.forEach(task => {
      items.push({
        type: 'task',
        icon: 'gantt-chart',
        title: task.name,
        subtitle: `${task.category || 'General'} · ${task.progress || 0}%`,
        date: task.updatedAt || task.createdAt || task.endDate
      });
    });

    incidents.forEach(entry => {
      const entryType = entry.entryType || 'incident';
      const labels = {
        incident: 'Incidencia',
        comment: 'Comentario',
        evolution: 'Evolución'
      };
      const icons = {
        incident: 'triangle-alert',
        comment: 'message-square',
        evolution: 'book-open'
      };
      items.push({
        type: 'diary',
        icon: icons[entryType],
        title: entry.description,
        subtitle: labels[entryType],
        date: entry.updatedAt || entry.createdAt || entry.date
      });
    });

    files.forEach(file => {
      items.push({
        type: 'file',
        icon: 'paperclip',
        title: file.name || 'Documento',
        subtitle: 'Documento subido',
        date: file.uploadedAt || file.createdAt
      });
    });

    return items
      .filter(item => item.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
  }

  function renderCards(project, tasks, budgets, incidents, suppliers, files, expenses = []) {
    const grid = document.getElementById('overview-grid');
    if (!grid) return;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => (task.progress || 0) >= 100).length;
    const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const totalEstimated = budgets.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);
    const totalReal = budgets.reduce((sum, item) => sum + (item.realCost || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalCostWithExpenses = totalReal + totalExpenses;
    // Positivo = ahorramos (previsto > real+gastos), negativo = nos pasamos
    const budgetDeviation = totalEstimated > 0 ? Math.round(((totalEstimated - totalCostWithExpenses) / totalEstimated) * 100) : 0;
    const diaryEntries = incidents.length;
    const deliverySummary = buildDeliverySummary(project);

    const alerts = buildAlerts(project, tasks, budgets, incidents, suppliers);
    const milestones = buildMilestones(tasks);
    const activity = buildRecentActivity(tasks, incidents, files);

    grid.innerHTML = `
      <div class="overview-card overview-card-wide overview-hero-card">
        <div class="overview-card-header">
          <i data-lucide="sparkles"></i>
          <span>${App.t('overview_hero_panel')}</span>
        </div>
        <div class="overview-hero-stats">
          <div class="overview-hero-stat">
            <strong>${taskProgress}%</strong>
            <span>${App.t('overview_global_progress')}</span>
          </div>
          <div class="overview-hero-stat">
            <strong>${App.formatCurrency(totalReal)}</strong>
            <span>${App.t('overview_current_cost')}</span>
          </div>
          <div class="overview-hero-stat">
            <strong>${diaryEntries}</strong>
            <span>${App.t('overview_diary_entries')}</span>
          </div>
          <div class="overview-hero-stat">
            <strong>${suppliers.length}</strong>
            <span>${App.t('overview_suppliers')}</span>
          </div>
        </div>
      </div>

      <div class="overview-card overview-card-wide">
        <div class="overview-card-header">
          <i data-lucide="zap"></i>
          <span>${App.t('overview_quick_actions')}</span>
        </div>
        <div class="overview-quick-actions">
          <button class="overview-quick-btn" data-overview-action="new-task"><i data-lucide="plus"></i><span>${App.t('add_task')}</span></button>
          <button class="overview-quick-btn" data-overview-action="new-incident"><i data-lucide="triangle-alert"></i><span>${App.t('add_incident')}</span></button>
          <button class="overview-quick-btn" data-overview-action="new-comment"><i data-lucide="message-square"></i><span>${App.t('add_comment')}</span></button>
          <button class="overview-quick-btn" data-overview-action="upload-file"><i data-lucide="upload"></i><span>${App.t('upload_file')}</span></button>
          <button class="overview-quick-btn" data-overview-action="new-participant"><i data-lucide="user-plus"></i><span>${App.t('add_participant')}</span></button>
        </div>
      </div>

      <div class="overview-card overview-card-wide">
        <div class="overview-card-header">
          <i data-lucide="siren"></i>
          <span>${App.t('overview_alerts')}</span>
        </div>
        ${alerts.length > 0 ? `
          <div class="overview-alert-list">
            ${alerts.map(alert => `
              <div class="overview-alert overview-alert-${alert.level} ${alert.action ? 'is-clickable' : ''}">
                <div class="overview-alert-icon"><i data-lucide="${alert.icon}"></i></div>
                <div class="overview-alert-content">
                  <div class="overview-alert-title">${App.escapeHTML(alert.title)}</div>
                  <div class="overview-alert-detail">${App.escapeHTML(alert.detail)}</div>
                  ${alert.meta ? `<div class="overview-alert-meta">${App.escapeHTML(alert.meta)}</div>` : ''}
                  ${alert.action ? `<button class="overview-alert-link" data-overview-action="${alert.action}" data-incident-id="${alert.incidentId || ''}">${App.escapeHTML(alert.actionLabel || App.t('open'))}</button>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        ` : `<div class="overview-card-detail">${App.t('overview_no_alerts')}</div>`}
      </div>

      <div class="overview-card">
        <div class="overview-card-header">
          <i data-lucide="flag"></i>
          <span>Entrega objetivo</span>
        </div>
        <div class="overview-card-value">${deliverySummary.value}</div>
        <div class="overview-card-detail">${deliverySummary.detail}</div>
      </div>

      <div class="overview-card">
        <div class="overview-card-header">
          <i data-lucide="check-circle-2"></i>
          <span>Progreso de Obra</span>
        </div>
        <div class="overview-card-value">${taskProgress}%</div>
        <div class="overview-progress-bar">
          <div class="overview-progress-fill" style="width:${taskProgress}%"></div>
        </div>
        <div class="overview-card-detail">${completedTasks} de ${totalTasks} tareas completadas</div>
      </div>

      <div class="overview-card" style="cursor:pointer" onclick="App.navigateTo('dashboard')" title="Ir a partidas presupuestarias">
        <div class="overview-card-header">
          <i data-lucide="wallet"></i>
          <span>Presupuesto</span>
        </div>
        <div class="overview-card-value">${App.formatCurrency(totalEstimated)}</div>
        <div class="overview-card-detail">
          Previsto &middot; ${budgets.length} partida${budgets.length !== 1 ? 's' : ''}<br>
          Coste obra: ${App.formatCurrency(totalReal)}<br>
          Gastos propios: <span style="color:var(--amber)">${App.formatCurrency(totalExpenses)}</span><br>
          Desviación neta: <span style="color:${budgetDeviation > 0 ? 'var(--green)' : budgetDeviation < 0 ? 'var(--red)' : 'var(--text-secondary)'}">${budgetDeviation > 0 ? '+' : ''}${budgetDeviation}%</span>
        </div>
      </div>

      <div class="overview-card" style="cursor:pointer" onclick="App.navigateTo('expenses')" title="Ir a gastos de obra">
        <div class="overview-card-header">
          <i data-lucide="receipt"></i>
          <span>Gastos Propios</span>
        </div>
        <div class="overview-card-value" style="color:var(--amber)">${App.formatCurrency(totalExpenses)}</div>
        <div class="overview-card-detail">
          ${expenses.length} gasto${expenses.length !== 1 ? 's' : ''} registrado${expenses.length !== 1 ? 's' : ''}<br>
          Coste total con gastos: <strong>${App.formatCurrency(totalCostWithExpenses)}</strong>
        </div>
      </div>

      <div class="overview-card">
        <div class="overview-card-header">
          <i data-lucide="clipboard-list"></i>
          <span>Diario</span>
        </div>
        <div class="overview-card-value">${diaryEntries}</div>
        <div class="overview-card-detail">
          ${incidents.filter(item => (item.entryType || 'incident') === 'incident').length} incidencias · 
          ${incidents.filter(item => (item.entryType || 'incident') === 'comment').length} comentarios · 
          ${incidents.filter(item => (item.entryType || 'incident') === 'evolution').length} evoluciones · 
          ${incidents.filter(item => (item.entryType || 'incident') === 'logbook').length} bitácoras
        </div>
      </div>

      <div class="overview-card overview-card-wide">
        <div class="overview-card-header">
          <i data-lucide="calendar-range"></i>
          <span>Próximos hitos</span>
        </div>
        ${milestones.length > 0 ? milestones.map(item => `
          <div class="overview-list-item overview-list-item-rich">
            <div>
              <div class="overview-list-title">${App.escapeHTML(item.title)}</div>
              <div class="overview-list-subtitle">${App.escapeHTML(item.phase)} · ${item.progress}%</div>
            </div>
            <div class="overview-list-side">
              <span class="overview-list-date">${App.formatDate(item.date)}</span>
              <span class="overview-list-pill">${item.relative}</span>
            </div>
          </div>
        `).join('') : '<div class="overview-card-detail">No hay hitos previstos en los próximos 14 días</div>'}
      </div>

      <div class="overview-card overview-card-wide">
        <div class="overview-card-header">
          <i data-lucide="activity"></i>
          <span>Actividad reciente</span>
        </div>
        ${activity.length > 0 ? activity.map(item => `
          <div class="overview-list-item overview-list-item-rich">
            <div class="overview-activity-main">
              <span class="overview-activity-icon"><i data-lucide="${item.icon}"></i></span>
              <div>
                <div class="overview-list-title">${App.escapeHTML((item.title || '').substring(0, 72))}${(item.title || '').length > 72 ? '...' : ''}</div>
                <div class="overview-list-subtitle">${App.escapeHTML(item.subtitle || '')}</div>
              </div>
            </div>
            <span class="overview-list-date">${App.formatDateTime(item.date)}</span>
          </div>
        `).join('') : '<div class="overview-card-detail">Sin actividad reciente</div>'}
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  return { init, refresh };
})();
