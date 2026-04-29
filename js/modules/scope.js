/* ========================================
   Scope Module - Project Scope Management
   Pre/During/Post phase items with priorities
   ======================================== */

const ScopeModule = (() => {
  let projectId = null;
  let scopeItems = [];

  const PHASES = ['Pre', 'During', 'Post'];
  const PRIORITIES = ['Must Have', 'Nice to Have'];
  const STATUSES = ['not-started', 'in-progress', 'completed', 'deferred'];

  const STATUS_LABELS = {
    'not-started': 'Not Started',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'deferred': 'Deferred'
  };

  const STATUS_CLASSES = {
    'not-started': 'badge-pending',
    'in-progress': 'badge-active',
    'completed': 'badge-positive',
    'deferred': 'badge-neutral'
  };

  function init(pid) {
    projectId = pid;
    if (!projectId) {
      console.warn('ScopeModule: No projectId provided');
      return;
    }
    setupButtons();
    setupFilters();
    loadScopeItems();
  }

  function setupButtons() {
    document.getElementById('btn-add-scope-item')?.addEventListener('click', () => openScopeForm());
    document.getElementById('btn-add-scope-empty')?.addEventListener('click', () => openScopeForm());
    document.getElementById('btn-export-scope')?.addEventListener('click', exportScope);
  }

  function setupFilters() {
    document.getElementById('scope-phase-filter')?.addEventListener('change', renderTable);
    document.getElementById('scope-status-filter')?.addEventListener('change', renderTable);
  }

  async function loadScopeItems() {
    scopeItems = await DB.getAllForProject('scope_items', projectId);
    scopeItems.sort((a, b) => (a.order || 0) - (b.order || 0));
    renderTable();
  }

  function renderTable() {
    const tbody = document.getElementById('scope-tbody');
    const table = document.getElementById('scope-table');
    const empty = document.getElementById('scope-empty');

    if (!tbody) return;

    const phaseFilter = document.getElementById('scope-phase-filter')?.value || 'all';
    const statusFilter = document.getElementById('scope-status-filter')?.value || 'all';

    let filtered = scopeItems;
    if (phaseFilter !== 'all') {
      filtered = filtered.filter(item => item.phase === phaseFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    if (filtered.length === 0) {
      table.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }

    table.style.display = 'table';
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(item => `
      <tr data-id="${item.id}">
        <td>${App.escapeHTML(item.description)}</td>
        <td><span class="badge badge-phase-${item.phase.toLowerCase()}">${item.phase}</span></td>
        <td>
          <span class="badge ${item.priority === 'Must Have' ? 'badge-priority-must' : 'badge-priority-nice'}">
            ${item.priority}
          </span>
        </td>
        <td>
          <span class="badge ${STATUS_CLASSES[item.status]} scope-status" 
                onclick="ScopeModule.cycleStatus(${item.id})" 
                title="Click to change status">
            ${STATUS_LABELS[item.status]}
          </span>
        </td>
        <td>${App.escapeHTML(item.comments || '')}</td>
        <td>
          <button class="action-btn" onclick="ScopeModule.editItem(${item.id})" title="Edit">
            <i data-lucide="pencil"></i>
          </button>
          <button class="action-btn delete" onclick="ScopeModule.deleteItem(${item.id})" title="Delete">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      </tr>
    `).join('');

    lucide.createIcons();
  }

  async function cycleStatus(id) {
    const item = scopeItems.find(i => i.id === id);
    if (!item) return;

    const currentIndex = STATUSES.indexOf(item.status);
    const nextStatus = STATUSES[(currentIndex + 1) % STATUSES.length];
    
    item.status = nextStatus;
    item.updatedAt = new Date().toISOString();
    
    await DB.put('scope_items', item);
    loadScopeItems();
  }

  function openScopeForm(item = null) {
    const isEdit = item && item.id;
    const title = isEdit ? 'Edit Scope Item' : 'Add Scope Item';

    const body = `
      <div class="form-group">
        <label>Description *</label>
        <textarea id="scope-description" class="form-control" rows="2" placeholder="Enter scope item description...">${isEdit ? App.escapeHTML(item.description) : ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Phase</label>
          <select id="scope-phase" class="form-control">
            ${PHASES.map(p => `<option value="${p}" ${isEdit && item.phase === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select id="scope-priority" class="form-control">
            ${PRIORITIES.map(p => `<option value="${p}" ${isEdit && item.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="scope-status" class="form-control">
          ${STATUSES.map(s => `<option value="${s}" ${isEdit && item.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Comments</label>
        <textarea id="scope-comments" class="form-control" rows="2" placeholder="Additional comments...">${isEdit ? App.escapeHTML(item.comments || '') : ''}</textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-scope">${isEdit ? 'Update' : 'Add'}</button>
    `;

    App.openModal(title, body, footer);

    document.getElementById('btn-save-scope').addEventListener('click', async () => {
      const description = document.getElementById('scope-description').value.trim();
      if (!description) {
        App.toast('Description is required', 'warning');
        return;
      }

      const data = {
        projectId,
        description,
        phase: document.getElementById('scope-phase').value,
        priority: document.getElementById('scope-priority').value,
        status: document.getElementById('scope-status').value,
        comments: document.getElementById('scope-comments').value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = item.id;
        data.order = item.order;
        data.createdAt = item.createdAt;
        await DB.put('scope_items', data);
        App.toast('Scope item updated', 'success');
      } else {
        data.order = scopeItems.length;
        data.createdAt = new Date().toISOString();
        await DB.add('scope_items', data);
        App.toast('Scope item added', 'success');
      }

      App.closeModal();
      loadScopeItems();
    });
  }

  function editItem(id) {
    const item = scopeItems.find(i => i.id === id);
    if (item) openScopeForm(item);
  }

  async function deleteItem(id) {
    if (!confirm('Delete this scope item?')) return;
    await DB.remove('scope_items', id);
    App.toast('Scope item deleted', 'info');
    loadScopeItems();
  }

  function exportScope() {
    const csv = [
      ['Description', 'Phase', 'Priority', 'Status', 'Comments'],
      ...scopeItems.map(item => [
        item.description,
        item.phase,
        item.priority,
        STATUS_LABELS[item.status],
        item.comments || ''
      ])
    ].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scope-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    init,
    loadScopeItems,
    renderTable,
    cycleStatus,
    editItem,
    deleteItem,
    exportScope
  };
})();
