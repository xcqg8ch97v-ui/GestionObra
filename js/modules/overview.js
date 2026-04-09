/* ========================================
   Overview Module - Vista General del Proyecto
   Resumen con estadísticas y actividad reciente
   ======================================== */

const OverviewModule = (() => {
  let projectId = null;

  function init(pid) {
    projectId = pid;
    refresh();
  }

  async function refresh() {
    if (!projectId) return;

    const [tasks, budgets, incidents, suppliers] = await Promise.all([
      DB.getAllForProject('tasks', projectId),
      DB.getAllForProject('budgets', projectId),
      DB.getAllForProject('incidents', projectId),
      DB.getAllForProject('suppliers', projectId)
    ]);

    renderCards(tasks, budgets, incidents, suppliers);
  }

  function renderCards(tasks, budgets, incidents, suppliers) {
    const grid = document.getElementById('overview-grid');
    if (!grid) return;

    // --- Task stats ---
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.progress === 100).length;
    const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const overdueTasks = tasks.filter(t => {
      const end = new Date(t.endDate);
      return end < new Date() && t.progress < 100;
    }).length;

    // --- Budget stats ---
    const totalEstimated = budgets.reduce((s, b) => s + (b.estimatedCost || 0), 0);
    const totalReal = budgets.reduce((s, b) => s + (b.realCost || 0), 0);
    const budgetDeviation = totalEstimated > 0 ? Math.round(((totalReal - totalEstimated) / totalEstimated) * 100) : 0;

    // --- Incident stats ---
    const pendingIncidents = incidents.filter(i => i.status === 'pending').length;
    const inProgressIncidents = incidents.filter(i => i.status === 'in-progress').length;
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved').length;

    // --- Upcoming tasks (next 7 days) ---
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcoming = tasks
      .filter(t => {
        const end = new Date(t.endDate);
        return end >= now && end <= nextWeek && t.progress < 100;
      })
      .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
      .slice(0, 5);

    // --- Recent incidents ---
    const recentIncidents = [...incidents]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    grid.innerHTML = `
      <!-- Progreso General -->
      <div class="overview-card">
        <div class="overview-card-header">
          <i data-lucide="check-circle-2"></i>
          <span>Progreso de Obra</span>
        </div>
        <div class="overview-card-value">${taskProgress}%</div>
        <div class="overview-progress-bar">
          <div class="overview-progress-fill" style="width:${taskProgress}%"></div>
        </div>
        <div class="overview-card-detail">
          ${completedTasks} de ${totalTasks} tareas completadas
          ${overdueTasks > 0 ? `<br><span style="color:var(--red)">${overdueTasks} con retraso</span>` : ''}
        </div>
      </div>

      <!-- Presupuesto -->
      <div class="overview-card">
        <div class="overview-card-header">
          <i data-lucide="wallet"></i>
          <span>Presupuesto</span>
        </div>
        <div class="overview-card-value">${App.formatCurrency(totalReal)} <span style="font-size:0.5em;color:var(--text-secondary)">/ ${App.formatCurrency(totalEstimated)}</span></div>
        <div class="overview-card-detail">
          Desviación: <span style="color:${budgetDeviation > 0 ? 'var(--red)' : budgetDeviation < 0 ? 'var(--green)' : 'var(--text-secondary)'}">${budgetDeviation > 0 ? '+' : ''}${budgetDeviation}%</span>
          <br>${budgets.length} partidas · ${suppliers.length} proveedores
        </div>
      </div>

      <!-- Incidencias -->
      <div class="overview-card">
        <div class="overview-card-header">
          <i data-lucide="alert-triangle"></i>
          <span>Incidencias</span>
        </div>
        <div class="overview-card-value">${incidents.length}</div>
        <div class="overview-card-detail">
          <span style="color:var(--amber)">${pendingIncidents} pendientes</span> ·
          <span style="color:var(--cyan)">${inProgressIncidents} en proceso</span> ·
          <span style="color:var(--green)">${resolvedIncidents} resueltas</span>
        </div>
      </div>

      <!-- Próximas entregas -->
      <div class="overview-card overview-card-wide">
        <div class="overview-card-header">
          <i data-lucide="calendar-clock"></i>
          <span>Próximas Entregas</span>
        </div>
        ${upcoming.length > 0 ? upcoming.map(t => `
          <div class="overview-list-item">
            <span>${App.escapeHTML(t.name)}</span>
            <span class="overview-list-date">${App.formatDate(t.endDate)} · ${t.progress}%</span>
          </div>
        `).join('') : '<div class="overview-card-detail">No hay entregas próximas</div>'}
      </div>

      <!-- Actividad reciente -->
      <div class="overview-card overview-card-wide">
        <div class="overview-card-header">
          <i data-lucide="activity"></i>
          <span>Últimas Incidencias</span>
        </div>
        ${recentIncidents.length > 0 ? recentIncidents.map(i => {
          const statusColors = { pending: 'var(--amber)', 'in-progress': 'var(--cyan)', resolved: 'var(--green)' };
          return `
            <div class="overview-list-item">
              <span><span style="color:${statusColors[i.status]};margin-right:6px;">●</span>${App.escapeHTML(i.description.substring(0, 60))}${i.description.length > 60 ? '...' : ''}</span>
              <span class="overview-list-date">${App.formatDate(i.date)}</span>
            </div>
          `;
        }).join('') : '<div class="overview-card-detail">No hay incidencias registradas</div>'}
      </div>
    `;

    lucide.createIcons();
  }

  return { init, refresh };
})();
