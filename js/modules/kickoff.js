/* ========================================
   Kickoff Module - Project Kick-off Checklist
   Governance, Scope, Team, Technical readiness
   ======================================== */

const KickoffModule = (() => {
  let projectId = null;
  let checklistItems = [];

  const DEFAULT_ITEMS = [
    { category: 'Governance', item: 'Project Charter signed by Sponsor', order: 0 },
    { category: 'Governance', item: 'PM assigned and authority defined', order: 1 },
    { category: 'Governance', item: 'Steering Committee established', order: 2 },
    { category: 'Governance', item: 'Communication plan agreed', order: 3 },
    { category: 'Scope', item: 'Business case approved', order: 0 },
    { category: 'Scope', item: 'Scope statement defined and approved', order: 1 },
    { category: 'Scope', item: 'Must-have vs Nice-to-have documented', order: 2 },
    { category: 'Scope', item: 'Success criteria defined', order: 3 },
    { category: 'Team', item: 'Core team identified and assigned', order: 0 },
    { category: 'Team', item: 'Roles and responsibilities defined', order: 1 },
    { category: 'Team', item: 'Key stakeholders mapped', order: 2 },
    { category: 'Team', item: 'Escalation paths defined', order: 3 },
    { category: 'Technical', item: 'Technical approach approved', order: 0 },
    { category: 'Technical', item: 'Key dependencies identified', order: 1 },
    { category: 'Technical', item: 'Risk assessment completed', order: 2 },
    { category: 'Technical', item: 'Development environment ready', order: 3 }
  ];

  const STATUS_CLASSES = {
    'pending': 'check-pending',
    'in-progress': 'check-in-progress',
    'completed': 'check-completed',
    'n/a': 'check-na'
  };

  function init(pid) {
    projectId = pid;
    if (!projectId) {
      console.warn('KickoffModule: No projectId provided');
      return;
    }
    loadChecklist();
  }

  async function loadChecklist() {
    checklistItems = await DB.getAllForProject('kickoff_checklist', projectId);
    
    // Initialize default items if none exist
    if (checklistItems.length === 0) {
      for (const defaultItem of DEFAULT_ITEMS) {
        const item = {
          projectId,
          category: defaultItem.category,
          item: defaultItem.item,
          status: 'pending',
          owner: '',
          targetDate: '',
          completedDate: '',
          notes: '',
          order: defaultItem.order,
          createdAt: new Date().toISOString()
        };
        const id = await DB.add('kickoff_checklist', item);
        item.id = id;
        checklistItems.push(item);
      }
    }

    renderChecklist();
  }

  function renderChecklist() {
    const progressEl = document.getElementById('kickoff-progress');
    const categories = ['Governance', 'Scope', 'Team', 'Technical'];
    
    // Calculate progress
    const total = checklistItems.length;
    const completed = checklistItems.filter(i => i.status === 'completed').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    if (progressEl) {
      progressEl.innerHTML = `
        <div class="kickoff-progress-bar">
          <div class="progress-fill" style="width: ${percentage}%"></div>
        </div>
        <span class="progress-text">${completed}/${total} items completed (${percentage}%)</span>
      `;
    }

    // Render each category
    categories.forEach(category => {
      const container = document.getElementById(`kickoff-${category.toLowerCase()}`);
      if (!container) return;

      const items = checklistItems.filter(i => i.category === category).sort((a, b) => a.order - b.order);
      
      container.innerHTML = items.map(item => `
        <div class="checklist-item ${STATUS_CLASSES[item.status]}" data-id="${item.id}">
          <div class="checklist-checkbox" onclick="KickoffModule.toggleStatus(${item.id})">
            ${item.status === 'completed' ? '<i data-lucide="check"></i>' : ''}
          </div>
          <div class="checklist-content">
            <div class="checklist-text">${App.escapeHTML(item.item)}</div>
            ${item.owner ? `<div class="checklist-meta">Owner: ${App.escapeHTML(item.owner)}</div>` : ''}
            ${item.targetDate ? `<div class="checklist-meta">Target: ${App.formatDate(item.targetDate)}</div>` : ''}
            ${item.notes ? `<div class="checklist-notes">${App.escapeHTML(item.notes)}</div>` : ''}
          </div>
          <div class="checklist-actions">
            <button class="action-btn" onclick="KickoffModule.editItem(${item.id})" title="Edit">
              <i data-lucide="pencil"></i>
            </button>
          </div>
        </div>
      `).join('');
    });

    lucide.createIcons();
  }

  async function toggleStatus(id) {
    const item = checklistItems.find(i => i.id === id);
    if (!item) return;

    const statuses = ['pending', 'in-progress', 'completed', 'n/a'];
    const currentIndex = statuses.indexOf(item.status);
    item.status = statuses[(currentIndex + 1) % statuses.length];
    
    if (item.status === 'completed') {
      item.completedDate = new Date().toISOString().slice(0, 10);
    } else {
      item.completedDate = '';
    }
    
    item.updatedAt = new Date().toISOString();
    await DB.put('kickoff_checklist', item);
    renderChecklist();
  }

  function editItem(id) {
    const item = checklistItems.find(i => i.id === id);
    if (!item) return;

    const body = `
      <div class="form-group">
        <label>Item</label>
        <input type="text" id="kickoff-item-text" class="form-control" value="${App.escapeHTML(item.item)}" disabled>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <select id="kickoff-status" class="form-control">
            <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="in-progress" ${item.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
            <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="n/a" ${item.status === 'n/a' ? 'selected' : ''}>N/A</option>
          </select>
        </div>
        <div class="form-group">
          <label>Owner</label>
          <input type="text" id="kickoff-owner" class="form-control" value="${App.escapeHTML(item.owner || '')}" placeholder="Who is responsible?">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Target Date</label>
          <input type="date" id="kickoff-target" class="form-control" value="${item.targetDate || ''}">
        </div>
        <div class="form-group">
          <label>Completed Date</label>
          <input type="date" id="kickoff-completed" class="form-control" value="${item.completedDate || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="kickoff-notes" class="form-control" rows="3" placeholder="Additional notes...">${App.escapeHTML(item.notes || '')}</textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-kickoff">Save</button>
    `;

    App.openModal('Edit Checklist Item', body, footer);

    document.getElementById('btn-save-kickoff').addEventListener('click', async () => {
      item.status = document.getElementById('kickoff-status').value;
      item.owner = document.getElementById('kickoff-owner').value.trim();
      item.targetDate = document.getElementById('kickoff-target').value;
      item.completedDate = document.getElementById('kickoff-completed').value;
      item.notes = document.getElementById('kickoff-notes').value.trim();
      item.updatedAt = new Date().toISOString();

      await DB.put('kickoff_checklist', item);
      App.closeModal();
      renderChecklist();
      App.toast('Item updated', 'success');
    });
  }

  return {
    init,
    loadChecklist,
    renderChecklist,
    toggleStatus,
    editItem
  };
})();
