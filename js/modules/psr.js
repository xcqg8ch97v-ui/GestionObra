/* ========================================
   PSR Module - Project Status Report
   RAG Status Dashboard and weekly reporting
   ======================================== */

const PsrModule = (() => {
  let projectId = null;
  let currentPsr = null;

  const RAG_LABELS = {
    schedule: 'Schedule',
    budget: 'Budget',
    resources: 'Resources',
    scope: 'Scope',
    risks: 'Risks'
  };

  const STATUS_CLASSES = {
    Green: 'rag-green',
    Amber: 'rag-amber',
    Red: 'rag-red'
  };

  function init(pid) {
    projectId = pid;
    if (!projectId) {
      console.warn('PsrModule: No projectId provided');
      return;
    }
    setupButtons();
    loadPsr();
  }

  function setupButtons() {
    document.getElementById('btn-new-psr')?.addEventListener('click', openPsrForm);
    document.getElementById('btn-export-psr')?.addEventListener('click', exportPsr);
  }

  async function loadPsr() {
    const project = await DB.getById('projects', projectId);
    const psrHistory = await DB.getAllForProject('psr_history', projectId);
    const openItems = await DB.getAllForProject('open_items', projectId);
    
    // Sort by date descending
    psrHistory.sort((a, b) => new Date(b.reportingDate) - new Date(a.reportingDate));
    
    currentPsr = project?.currentPsr || generateDefaultPsr();
    
    renderPsrDashboard(currentPsr, psrHistory, openItems);
  }

  function generateDefaultPsr() {
    return {
      reportingDate: new Date().toISOString().slice(0, 10),
      overallStatus: 'Green',
      ragStatus: {
        schedule: 'Green',
        budget: 'Green',
        resources: 'Green',
        scope: 'Green',
        risks: 'Green'
      },
      progress: 0,
      executiveSummary: '',
      accomplishments: [],
      upcoming: [],
      milestones: [],
      keyRisks: []
    };
  }

  function renderPsrDashboard(psr, history, openItems) {
    const container = document.getElementById('psr-dashboard');
    if (!container) return;

    const openItemsCount = openItems.filter(i => i.status === 'open' || i.status === 'in-progress').length;
    const criticalItems = openItems.filter(i => i.priority === 'Critical' && (i.status === 'open' || i.status === 'in-progress'));

    container.innerHTML = `
      <div class="psr-header">
        <div class="psr-date">
          <label>Reporting Date</label>
          <input type="date" id="psr-date-input" value="${psr.reportingDate}" class="form-control">
        </div>
        <div class="psr-overall">
          <label>Overall Status</label>
          <div class="rag-selector" data-rag="overall">
            <button class="rag-btn ${psr.overallStatus === 'Green' ? 'active' : ''}" data-value="Green">Green</button>
            <button class="rag-btn ${psr.overallStatus === 'Amber' ? 'active' : ''}" data-value="Amber">Amber</button>
            <button class="rag-btn ${psr.overallStatus === 'Red' ? 'active' : ''}" data-value="Red">Red</button>
          </div>
        </div>
      </div>

      <div class="psr-rag-grid">
        ${Object.entries(RAG_LABELS).map(([key, label]) => `
          <div class="rag-card">
            <div class="rag-label">${label}</div>
            <div class="rag-selector" data-rag="${key}">
              <button class="rag-btn ${psr.ragStatus[key] === 'Green' ? 'active' : ''}" data-value="Green">G</button>
              <button class="rag-btn ${psr.ragStatus[key] === 'Amber' ? 'active' : ''}" data-value="Amber">A</button>
              <button class="rag-btn ${psr.ragStatus[key] === 'Red' ? 'active' : ''}" data-value="Red">R</button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="psr-metrics">
        <div class="metric-card">
          <div class="metric-value">${psr.progress}%</div>
          <div class="metric-label">Overall Progress</div>
          <input type="range" id="psr-progress" min="0" max="100" value="${psr.progress}" class="progress-slider">
        </div>
        <div class="metric-card ${openItemsCount > 5 ? 'warning' : ''}">
          <div class="metric-value">${openItemsCount}</div>
          <div class="metric-label">Open Items</div>
          ${criticalItems.length > 0 ? `<div class="metric-badge critical">${criticalItems.length} Critical</div>` : ''}
        </div>
      </div>

      <div class="psr-sections">
        <div class="psr-section">
          <h4>Executive Summary</h4>
          <textarea id="psr-summary" class="form-control" rows="3" placeholder="Brief status summary for executives...">${psr.executiveSummary || ''}</textarea>
        </div>

        <div class="psr-section">
          <h4>Key Accomplishments This Period</h4>
          <div class="psr-list" id="psr-accomplishments">
            ${(psr.accomplishments || []).map((item, i) => `
              <div class="psr-list-item">
                <input type="text" value="${App.escapeHTML(item)}" class="form-control" data-index="${i}">
                <button class="btn btn-sm btn-outline" onclick="PsrModule.removeListItem('accomplishments', ${i})">×</button>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-outline btn-sm" onclick="PsrModule.addListItem('accomplishments')">
            <i data-lucide="plus"></i> Add
          </button>
        </div>

        <div class="psr-section">
          <h4>Upcoming Activities / Next Steps</h4>
          <div class="psr-list" id="psr-upcoming">
            ${(psr.upcoming || []).map((item, i) => `
              <div class="psr-list-item">
                <input type="text" value="${App.escapeHTML(item)}" class="form-control" data-index="${i}">
                <button class="btn btn-sm btn-outline" onclick="PsrModule.removeListItem('upcoming', ${i})">×</button>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-outline btn-sm" onclick="PsrModule.addListItem('upcoming')">
            <i data-lucide="plus"></i> Add
          </button>
        </div>

        <div class="psr-section">
          <h4>Key Milestones</h4>
          <div class="milestones-list" id="psr-milestones">
            ${(psr.milestones || []).map((m, i) => `
              <div class="milestone-item">
                <input type="text" value="${App.escapeHTML(m.name)}" class="form-control" placeholder="Milestone name">
                <input type="date" value="${m.date || ''}" class="form-control">
                <select class="form-control">
                  <option value="planned" ${m.status === 'planned' ? 'selected' : ''}>Planned</option>
                  <option value="in-progress" ${m.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                  <option value="completed" ${m.status === 'completed' ? 'selected' : ''}>Completed</option>
                  <option value="at-risk" ${m.status === 'at-risk' ? 'selected' : ''}>At Risk</option>
                </select>
                <button class="btn btn-sm btn-outline" onclick="PsrModule.removeMilestone(${i})">×</button>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-outline btn-sm" onclick="PsrModule.addMilestone()">
            <i data-lucide="plus"></i> Add Milestone
          </button>
        </div>
      </div>

      <div class="psr-actions">
        <button class="btn btn-primary" id="btn-save-psr">
          <i data-lucide="save"></i> Save PSR
        </button>
        <button class="btn btn-outline" id="btn-view-psr-history">
          <i data-lucide="history"></i> View History
        </button>
      </div>
    `;

    bindRagSelectors();
    bindSaveButton();
    lucide.createIcons();
  }

  function bindRagSelectors() {
    document.querySelectorAll('.rag-selector').forEach(selector => {
      selector.querySelectorAll('.rag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selector.querySelectorAll('.rag-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    });
  }

  function bindSaveButton() {
    document.getElementById('btn-save-psr')?.addEventListener('click', saveCurrentPsr);
  }

  async function saveCurrentPsr() {
    const project = await DB.getById('projects', projectId);
    if (!project) return;

    const ragStatus = {};
    document.querySelectorAll('.rag-selector[data-rag]').forEach(selector => {
      const key = selector.dataset.rag;
      const activeBtn = selector.querySelector('.rag-btn.active');
      if (key !== 'overall') {
        ragStatus[key] = activeBtn ? activeBtn.dataset.value : 'Green';
      }
    });

    const overallSelector = document.querySelector('.rag-selector[data-rag="overall"]');
    const overallStatus = overallSelector?.querySelector('.rag-btn.active')?.dataset.value || 'Green';

    const newPsr = {
      reportingDate: document.getElementById('psr-date-input')?.value || new Date().toISOString().slice(0, 10),
      overallStatus,
      ragStatus,
      progress: parseInt(document.getElementById('psr-progress')?.value || 0),
      executiveSummary: document.getElementById('psr-summary')?.value || '',
      accomplishments: Array.from(document.querySelectorAll('#psr-accomplishments input')).map(i => i.value).filter(v => v),
      upcoming: Array.from(document.querySelectorAll('#psr-upcoming input')).map(i => i.value).filter(v => v),
      milestones: Array.from(document.querySelectorAll('#psr-milestones .milestone-item')).map(item => ({
        name: item.querySelector('input[type="text"]')?.value || '',
        date: item.querySelector('input[type="date"]')?.value || '',
        status: item.querySelector('select')?.value || 'planned'
      })).filter(m => m.name)
    };

    // Save to project
    project.currentPsr = newPsr;
    project.updatedAt = new Date().toISOString();
    await DB.put('projects', project);

    // Add to history
    const weekNumber = getWeekNumber(new Date(newPsr.reportingDate));
    await DB.add('psr_history', {
      projectId,
      reportingDate: newPsr.reportingDate,
      weekNumber,
      ragStatus: newPsr.ragStatus,
      overallStatus: newPsr.overallStatus,
      executiveSummary: newPsr.executiveSummary,
      openItemsCount: (await DB.getAllForProject('open_items', projectId)).filter(i => i.status === 'open').length,
      createdAt: new Date().toISOString()
    });

    App.toast('PSR saved successfully', 'success');
    loadPsr();
  }

  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function addListItem(type) {
    const container = document.getElementById(`psr-${type}`);
    const index = container.querySelectorAll('.psr-list-item').length;
    const div = document.createElement('div');
    div.className = 'psr-list-item';
    div.innerHTML = `
      <input type="text" class="form-control" placeholder="Enter item..." data-index="${index}">
      <button class="btn btn-sm btn-outline" onclick="PsrModule.removeListItem('${type}', ${index})">×</button>
    `;
    container.appendChild(div);
  }

  function removeListItem(type, index) {
    const container = document.getElementById(`psr-${type}`);
    const items = container.querySelectorAll('.psr-list-item');
    if (items[index]) {
      items[index].remove();
    }
    // Re-index remaining items
    container.querySelectorAll('.psr-list-item').forEach((item, i) => {
      item.querySelector('input').dataset.index = i;
      item.querySelector('button').setAttribute('onclick', `PsrModule.removeListItem('${type}', ${i})`);
    });
  }

  function addMilestone() {
    const container = document.getElementById('psr-milestones');
    const index = container.querySelectorAll('.milestone-item').length;
    const div = document.createElement('div');
    div.className = 'milestone-item';
    div.innerHTML = `
      <input type="text" class="form-control" placeholder="Milestone name">
      <input type="date" class="form-control">
      <select class="form-control">
        <option value="planned">Planned</option>
        <option value="in-progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="at-risk">At Risk</option>
      </select>
      <button class="btn btn-sm btn-outline" onclick="PsrModule.removeMilestone(${index})">×</button>
    `;
    container.appendChild(div);
  }

  function removeMilestone(index) {
    const container = document.getElementById('psr-milestones');
    const items = container.querySelectorAll('.milestone-item');
    if (items[index]) {
      items[index].remove();
    }
    container.querySelectorAll('.milestone-item').forEach((item, i) => {
      item.querySelector('button').setAttribute('onclick', `PsrModule.removeMilestone(${i})`);
    });
  }

  function openPsrForm() {
    saveCurrentPsr();
  }

  function exportPsr() {
    const data = {
      projectId,
      currentPsr,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PSR-${projectId}-${currentPsr?.reportingDate || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    init,
    loadPsr,
    saveCurrentPsr,
    addListItem,
    removeListItem,
    addMilestone,
    removeMilestone,
    exportPsr
  };
})();
