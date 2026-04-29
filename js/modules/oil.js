/* ========================================
   OIL Module - Open Item List
   Tracking issues, blockers, and action items
   ======================================== */

const OilModule = (() => {
  let projectId = null;
  let openItems = [];

  const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
  const STATUSES = ['open', 'in-progress', 'resolved', 'closed', 'escalated'];
  const CATEGORIES = ['Risk', 'Dependency', 'Blocker', 'Change', 'Communication', 'Resource', 'Technical', 'Other'];

  const PRIORITY_CLASSES = {
    'Critical': 'badge-priority-critical',
    'High': 'badge-priority-high',
    'Medium': 'badge-priority-medium',
    'Low': 'badge-priority-low'
  };

  const STATUS_LABELS = {
    'open': 'Open',
    'in-progress': 'In Progress',
    'resolved': 'Resolved',
    'closed': 'Closed',
    'escalated': 'Escalated'
  };

  const STATUS_CLASSES = {
    'open': 'badge-pending',
    'in-progress': 'badge-active',
    'resolved': 'badge-positive',
    'closed': 'badge-neutral',
    'escalated': 'badge-danger'
  };

  function init(pid) {
    projectId = pid;
    if (!projectId) {
      console.warn('OilModule: No projectId provided');
      return;
    }
    setupButtons();
    setupFilters();
    loadItems();
  }

  function setupButtons() {
    document.getElementById('btn-add-oil-item')?.addEventListener('click', () => openItemForm());
    document.getElementById('btn-add-oil-empty')?.addEventListener('click', () => openItemForm());
    document.getElementById('btn-export-oil')?.addEventListener('click', exportItems);
  }

  function setupFilters() {
    document.getElementById('oil-status-filter')?.addEventListener('change', renderTable);
    document.getElementById('oil-priority-filter')?.addEventListener('change', renderTable);
    document.getElementById('oil-assigned-filter')?.addEventListener('change', renderTable);
  }

  async function loadItems() {
    openItems = await DB.getAllForProject('open_items', projectId);
    openItems.sort((a, b) => {
      // Sort by status (open first), then priority, then date
      const statusOrder = { 'open': 0, 'in-progress': 1, 'escalated': 2, 'resolved': 3, 'closed': 4 };
      const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(b.dateOpened) - new Date(a.dateOpened);
    });

    updateAssignedFilter();
    renderTable();
  }

  function updateAssignedFilter() {
    const filter = document.getElementById('oil-assigned-filter');
    if (!filter) return;

    const assignees = [...new Set(openItems.map(i => i.assignedTo).filter(Boolean))];
    const currentValue = filter.value;
    
    filter.innerHTML = '<option value="all">All Assigned</option>' +
      assignees.map(a => `<option value="${App.escapeHTML(a)}">${App.escapeHTML(a)}</option>`).join('');
    
    if (currentValue && assignees.includes(currentValue)) {
      filter.value = currentValue;
    }
  }

  function renderTable() {
    const tbody = document.getElementById('oil-tbody');
    const table = document.getElementById('oil-table');
    const empty = document.getElementById('oil-empty');

    if (!tbody) return;

    const statusFilter = document.getElementById('oil-status-filter')?.value || 'all';
    const priorityFilter = document.getElementById('oil-priority-filter')?.value || 'all';
    const assignedFilter = document.getElementById('oil-assigned-filter')?.value || 'all';

    let filtered = openItems;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(item => item.priority === priorityFilter);
    }
    if (assignedFilter !== 'all') {
      filtered = filtered.filter(item => item.assignedTo === assignedFilter);
    }

    if (filtered.length === 0) {
      table.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }

    table.style.display = 'table';
    empty.style.display = 'none';

    const today = new Date();

    tbody.innerHTML = filtered.map(item => {
      const deadline = item.targetDeadline ? new Date(item.targetDeadline) : null;
      const isOverdue = deadline && deadline < today && item.status !== 'closed' && item.status !== 'resolved';
      const daysToDeadline = deadline ? Math.ceil((deadline - today) / (1000 * 60 * 60 * 24)) : null;
      
      return `
        <tr data-id="${item.id}" class="${isOverdue ? 'overdue' : ''}">
          <td>
            <div class="oil-description">${App.escapeHTML(item.description)}</div>
            ${item.psrReference ? `<div class="oil-psr-ref">${item.psrReference}</div>` : ''}
          </td>
          <td><span class="badge ${PRIORITY_CLASSES[item.priority]}">${item.priority}</span></td>
          <td>
            <div class="oil-assigned">
              <strong>${App.escapeHTML(item.assignedTo || 'Unassigned')}</strong>
              ${item.raisedBy ? `<small>Raised by: ${App.escapeHTML(item.raisedBy)}</small>` : ''}
            </div>
          </td>
          <td>
            <span class="badge ${STATUS_CLASSES[item.status]} oil-status" 
                  onclick="OilModule.cycleStatus(${item.id})" 
                  title="Click to change status">
              ${STATUS_LABELS[item.status]}
            </span>
          </td>
          <td>
            ${deadline ? `
              <div class="oil-deadline ${isOverdue ? 'overdue' : daysToDeadline <= 3 ? 'soon' : ''}">
                ${App.formatDate(item.targetDeadline)}
                ${isOverdue ? `<span class="deadline-badge">${Math.abs(daysToDeadline)}d overdue</span>` : 
                  daysToDeadline <= 3 ? `<span class="deadline-badge">${daysToDeadline}d left</span>` : ''}
              </div>
            ` : '<span class="text-muted">No deadline</span>'}
          </td>
          <td>
            <button class="action-btn" onclick="OilModule.viewComments(${item.id})" title="View/Add Comments">
              <i data-lucide="message-square"></i>
            </button>
            <button class="action-btn" onclick="OilModule.editItem(${item.id})" title="Edit">
              <i data-lucide="pencil"></i>
            </button>
            <button class="action-btn delete" onclick="OilModule.deleteItem(${item.id})" title="Delete">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  }

  async function cycleStatus(id) {
    const item = openItems.find(i => i.id === id);
    if (!item) return;

    const currentIndex = STATUSES.indexOf(item.status);
    const nextStatus = STATUSES[(currentIndex + 1) % STATUSES.length];
    
    item.status = nextStatus;
    if (nextStatus === 'resolved' || nextStatus === 'closed') {
      item.dateClosed = new Date().toISOString();
    }
    item.updatedAt = new Date().toISOString();
    
    await DB.put('open_items', item);
    loadItems();
  }

  function openItemForm(item = null) {
    const isEdit = item && item.id;
    const title = isEdit ? 'Edit Open Item' : 'Add Open Item';

    const body = `
      <div class="form-group">
        <label>Description *</label>
        <textarea id="oil-description" class="form-control" rows="3" placeholder="Describe the open item, issue, or action required...">${isEdit ? App.escapeHTML(item.description) : ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Raised By</label>
          <input type="text" id="oil-raised-by" class="form-control" placeholder="Who raised this item?" 
                 value="${isEdit ? App.escapeHTML(item.raisedBy || '') : ''}">
        </div>
        <div class="form-group">
          <label>Assigned To *</label>
          <input type="text" id="oil-assigned-to" class="form-control" placeholder="Who is responsible?" 
                 value="${isEdit ? App.escapeHTML(item.assignedTo || '') : ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Priority</label>
          <select id="oil-priority" class="form-control">
            ${PRIORITIES.map(p => `<option value="${p}" ${isEdit && item.priority === p ? 'selected' : p === 'Medium' ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="oil-status" class="form-control">
            ${STATUSES.map(s => `<option value="${s}" ${isEdit && item.status === s ? 'selected' : s === 'open' ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Category</label>
          <select id="oil-category" class="form-control">
            ${CATEGORIES.map(c => `<option value="${c}" ${isEdit && item.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Target Deadline</label>
          <input type="date" id="oil-deadline" class="form-control" 
                 value="${isEdit ? item.targetDeadline || '' : ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Comments / Action Items</label>
        <textarea id="oil-comments" class="form-control" rows="3" placeholder="Additional details, action steps, or resolution notes...">${isEdit ? App.escapeHTML(item.comments || '') : ''}</textarea>
      </div>
      ${isEdit ? `
        <div class="form-group">
          <label>PSR Reference (optional)</label>
          <input type="text" id="oil-psr-ref" class="form-control" placeholder="e.g., W11-001" 
                 value="${isEdit ? App.escapeHTML(item.psrReference || '') : ''}">
        </div>
      ` : ''}
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-oil">${isEdit ? 'Update' : 'Add'}</button>
    `;

    App.openModal(title, body, footer);

    document.getElementById('btn-save-oil').addEventListener('click', async () => {
      const description = document.getElementById('oil-description').value.trim();
      const assignedTo = document.getElementById('oil-assigned-to').value.trim();
      
      if (!description || !assignedTo) {
        App.toast('Description and Assigned To are required', 'warning');
        return;
      }

      const data = {
        projectId,
        description,
        raisedBy: document.getElementById('oil-raised-by').value.trim(),
        assignedTo,
        priority: document.getElementById('oil-priority').value,
        status: document.getElementById('oil-status').value,
        category: document.getElementById('oil-category').value,
        targetDeadline: document.getElementById('oil-deadline').value || null,
        comments: document.getElementById('oil-comments').value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = item.id;
        data.dateOpened = item.dateOpened;
        data.dateClosed = item.dateClosed;
        data.psrReference = document.getElementById('oil-psr-ref')?.value.trim() || item.psrReference;
        await DB.put('open_items', data);
        App.toast('Open item updated', 'success');
      } else {
        data.dateOpened = new Date().toISOString();
        data.dateClosed = null;
        data.psrReference = '';
        await DB.add('open_items', data);
        App.toast('Open item added', 'success');
      }

      App.closeModal();
      loadItems();
    });
  }

  function editItem(id) {
    const item = openItems.find(i => i.id === id);
    if (item) openItemForm(item);
  }

  async function deleteItem(id) {
    if (!confirm('Delete this open item?')) return;
    await DB.remove('open_items', id);
    App.toast('Open item deleted', 'info');
    loadItems();
  }

  function exportItems() {
    const csv = [
      ['Description', 'Raised By', 'Assigned To', 'Priority', 'Status', 'Category', 'Deadline', 'Comments', 'Date Opened', 'Date Closed'],
      ...openItems.map(item => [
        item.description,
        item.raisedBy || '',
        item.assignedTo,
        item.priority,
        STATUS_LABELS[item.status],
        item.category,
        item.targetDeadline || '',
        item.comments || '',
        item.dateOpened,
        item.dateClosed || ''
      ])
    ].map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OIL-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function viewComments(itemId) {
    const item = openItems.find(i => i.id === itemId);
    if (!item) return;

    const comments = await DB.getOilComments(itemId);

    const commentsHtml = comments.length > 0
      ? comments.map(c => `
          <div class="oil-comment">
            <div class="oil-comment-header">
              <span class="oil-comment-author">${App.escapeHTML(c.author || 'Unknown')}</span>
              <span class="oil-comment-date">${App.formatDateTime(c.createdAt)}</span>
            </div>
            <div class="oil-comment-text">${App.escapeHTML(c.text)}</div>
          </div>
        `).join('')
      : '<div class="oil-no-comments">No comments yet. Add the first one below.</div>';

    const body = `
      <div class="oil-detail-header">
        <div class="oil-detail-description">${App.escapeHTML(item.description)}</div>
        <div class="oil-detail-meta">
          <span class="badge ${PRIORITY_CLASSES[item.priority]}">${item.priority}</span>
          <span class="badge ${STATUS_CLASSES[item.status]}">${STATUS_LABELS[item.status]}</span>
          <span>Assigned: ${App.escapeHTML(item.assignedTo || 'Unassigned')}</span>
          ${item.targetDeadline ? `<span>Deadline: ${App.formatDate(item.targetDeadline)}</span>` : ''}
        </div>
      </div>
      <div class="oil-comments-section">
        <h4>Comment History (${comments.length})</h4>
        <div class="oil-comments-list">
          ${commentsHtml}
        </div>
      </div>
      <div class="oil-add-comment">
        <h4>Add New Comment</h4>
        <textarea id="oil-new-comment" class="form-control" rows="3" placeholder="Enter your comment, update, or action taken..."></textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Close</button>
      <button class="btn btn-primary" id="btn-save-comment">Add Comment</button>
    `;

    App.openModal('Open Item Details', body, footer);

    document.getElementById('btn-save-comment').addEventListener('click', async () => {
      const text = document.getElementById('oil-new-comment').value.trim();
      if (!text) {
        App.toast('Please enter a comment', 'warning');
        return;
      }

      await DB.addOilComment(itemId, projectId, text, 'User');
      App.toast('Comment added', 'success');
      viewComments(itemId); // Reload modal
    });
  }

  return {
    init,
    loadItems,
    renderTable,
    cycleStatus,
    editItem,
    deleteItem,
    exportItems,
    viewComments
  };
})();
