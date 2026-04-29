/* ========================================
   UAT Module - User Acceptance Test Tracker
   Test cases, steps, dependencies, status
   ======================================== */

const UatModule = (() => {
  let projectId = null;
  let testCases = [];

  const STATUSES = ['not-started', 'in-progress', 'passed', 'failed', 'blocked'];
  const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

  const STATUS_LABELS = {
    'not-started': 'Not Started',
    'in-progress': 'In Progress',
    'passed': 'Passed',
    'failed': 'Failed',
    'blocked': 'Blocked'
  };

  const STATUS_CLASSES = {
    'not-started': 'badge-pending',
    'in-progress': 'badge-active',
    'passed': 'badge-positive',
    'failed': 'badge-danger',
    'blocked': 'badge-warning'
  };

  function init(pid) {
    projectId = pid;
    if (!projectId) {
      console.warn('UatModule: No projectId provided');
      return;
    }
    setupButtons();
    setupFilters();
    loadTests();
  }

  function setupButtons() {
    document.getElementById('btn-add-uat-test')?.addEventListener('click', () => openTestForm());
    document.getElementById('btn-add-uat-empty')?.addEventListener('click', () => openTestForm());
    document.getElementById('btn-export-uat')?.addEventListener('click', exportTests);
  }

  function setupFilters() {
    document.getElementById('uat-status-filter')?.addEventListener('change', renderTable);
    document.getElementById('uat-priority-filter')?.addEventListener('change', renderTable);
  }

  async function loadTests() {
    testCases = await DB.getAllForProject('uat_tests', projectId);
    testCases.sort((a, b) => {
      const numA = parseInt(a.testNumber?.replace(/\D/g, '') || 0);
      const numB = parseInt(b.testNumber?.replace(/\D/g, '') || 0);
      return numA - numB;
    });
    renderTable();
  }

  function renderTable() {
    const tbody = document.getElementById('uat-tbody');
    const table = document.getElementById('uat-table');
    const empty = document.getElementById('uat-empty');
    const summary = document.getElementById('uat-summary');

    if (!tbody) return;

    const statusFilter = document.getElementById('uat-status-filter')?.value || 'all';
    const priorityFilter = document.getElementById('uat-priority-filter')?.value || 'all';

    let filtered = testCases;
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }

    // Update summary
    if (summary) {
      const total = testCases.length;
      const passed = testCases.filter(t => t.status === 'passed').length;
      const failed = testCases.filter(t => t.status === 'failed').length;
      const blocked = testCases.filter(t => t.status === 'blocked').length;
      const notStarted = testCases.filter(t => t.status === 'not-started').length;
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

      summary.innerHTML = `
        <div class="uat-summary-grid">
          <div class="uat-summary-item">
            <span class="uat-summary-value">${total}</span>
            <span class="uat-summary-label">Total</span>
          </div>
          <div class="uat-summary-item success">
            <span class="uat-summary-value">${passed}</span>
            <span class="uat-summary-label">Passed</span>
          </div>
          <div class="uat-summary-item danger">
            <span class="uat-summary-value">${failed}</span>
            <span class="uat-summary-label">Failed</span>
          </div>
          <div class="uat-summary-item warning">
            <span class="uat-summary-value">${blocked}</span>
            <span class="uat-summary-label">Blocked</span>
          </div>
          <div class="uat-summary-item">
            <span class="uat-summary-value">${passRate}%</span>
            <span class="uat-summary-label">Pass Rate</span>
          </div>
        </div>
      `;
    }

    if (filtered.length === 0) {
      table.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }

    table.style.display = 'table';
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(test => `
      <tr data-id="${test.id}">
        <td><strong>${App.escapeHTML(test.testNumber)}</strong></td>
        <td>
          <div class="uat-description">${App.escapeHTML(test.description)}</div>
          ${test.dependencies ? `<div class="uat-dependencies">Deps: ${App.escapeHTML(test.dependencies)}</div>` : ''}
        </td>
        <td><span class="badge ${test.priority === 'Critical' ? 'badge-priority-critical' : test.priority === 'High' ? 'badge-priority-high' : 'badge-priority-medium'}">${test.priority}</span></td>
        <td>
          <span class="badge ${STATUS_CLASSES[test.status]} uat-status" 
                onclick="UatModule.cycleStatus(${test.id})" 
                title="Click to change status">
            ${STATUS_LABELS[test.status]}
          </span>
        </td>
        <td>
          ${test.tester ? `<div class="uat-tester">${App.escapeHTML(test.tester)}</div>` : '-'}
          ${test.testDate ? `<div class="uat-date">${App.formatDate(test.testDate)}</div>` : ''}
        </td>
        <td>${App.escapeHTML(test.comments || '')}</td>
        <td>
          <button class="action-btn" onclick="UatModule.editTest(${test.id})" title="Edit">
            <i data-lucide="pencil"></i>
          </button>
          <button class="action-btn delete" onclick="UatModule.deleteTest(${test.id})" title="Delete">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      </tr>
    `).join('');

    lucide.createIcons();
  }

  async function cycleStatus(id) {
    const test = testCases.find(t => t.id === id);
    if (!test) return;

    const currentIndex = STATUSES.indexOf(test.status);
    const nextStatus = STATUSES[(currentIndex + 1) % STATUSES.length];
    
    test.status = nextStatus;
    if (nextStatus === 'passed' || nextStatus === 'failed') {
      test.testDate = new Date().toISOString().slice(0, 10);
    }
    test.updatedAt = new Date().toISOString();
    
    await DB.put('uat_tests', test);
    loadTests();
  }

  function openTestForm(test = null) {
    const isEdit = test && test.id;
    const title = isEdit ? 'Edit Test Case' : 'Add Test Case';

    // Generate next test number
    let nextNumber = 'UAT-001';
    if (!isEdit && testCases.length > 0) {
      const numbers = testCases.map(t => parseInt(t.testNumber?.replace(/\D/g, '') || 0));
      const maxNum = Math.max(...numbers);
      nextNumber = `UAT-${String(maxNum + 1).padStart(3, '0')}`;
    }

    const body = `
      <div class="form-row">
        <div class="form-group">
          <label>Test Number</label>
          <input type="text" id="uat-test-number" class="form-control" value="${isEdit ? App.escapeHTML(test.testNumber) : nextNumber}" ${isEdit ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select id="uat-priority" class="form-control">
            ${PRIORITIES.map(p => `<option value="${p}" ${(isEdit && test.priority === p) || (!isEdit && p === 'Medium') ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Description *</label>
        <textarea id="uat-description" class="form-control" rows="2" placeholder="What is being tested?">${isEdit ? App.escapeHTML(test.description) : ''}</textarea>
      </div>
      <div class="form-group">
        <label>Test Steps</label>
        <textarea id="uat-steps" class="form-control" rows="4" placeholder="1. Step one...\n2. Step two...\n3. Expected result...">${isEdit ? App.escapeHTML(test.steps || '') : ''}</textarea>
      </div>
      <div class="form-group">
        <label>Dependencies</label>
        <input type="text" id="uat-dependencies" class="form-control" placeholder="e.g., API integration complete, test data available" 
               value="${isEdit ? App.escapeHTML(test.dependencies || '') : ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <select id="uat-status" class="form-control">
            ${STATUSES.map(s => `<option value="${s}" ${(isEdit && test.status === s) || (!isEdit && s === 'not-started') ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Tester</label>
          <input type="text" id="uat-tester" class="form-control" placeholder="Who will test?" 
                 value="${isEdit ? App.escapeHTML(test.tester || '') : ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Test Date</label>
        <input type="date" id="uat-test-date" class="form-control" value="${isEdit ? test.testDate || '' : ''}">
      </div>
      <div class="form-group">
        <label>Comments / Results</label>
        <textarea id="uat-comments" class="form-control" rows="2" placeholder="Test results, issues found, etc.">${isEdit ? App.escapeHTML(test.comments || '') : ''}</textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-uat">${isEdit ? 'Update' : 'Add'}</button>
    `;

    App.openModal(title, body, footer);

    document.getElementById('btn-save-uat').addEventListener('click', async () => {
      const description = document.getElementById('uat-description').value.trim();
      if (!description) {
        App.toast('Description is required', 'warning');
        return;
      }

      const data = {
        projectId,
        testNumber: document.getElementById('uat-test-number').value.trim(),
        description,
        steps: document.getElementById('uat-steps').value.trim(),
        dependencies: document.getElementById('uat-dependencies').value.trim(),
        priority: document.getElementById('uat-priority').value,
        status: document.getElementById('uat-status').value,
        tester: document.getElementById('uat-tester').value.trim(),
        testDate: document.getElementById('uat-test-date').value || null,
        comments: document.getElementById('uat-comments').value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = test.id;
        data.createdAt = test.createdAt;
        await DB.put('uat_tests', data);
        App.toast('Test case updated', 'success');
      } else {
        data.createdAt = new Date().toISOString();
        await DB.add('uat_tests', data);
        App.toast('Test case added', 'success');
      }

      App.closeModal();
      loadTests();
    });
  }

  function editTest(id) {
    const test = testCases.find(t => t.id === id);
    if (test) openTestForm(test);
  }

  async function deleteTest(id) {
    if (!confirm('Delete this test case?')) return;
    await DB.remove('uat_tests', id);
    App.toast('Test case deleted', 'info');
    loadTests();
  }

  function exportTests() {
    const csv = [
      ['Test Number', 'Description', 'Steps', 'Dependencies', 'Priority', 'Status', 'Tester', 'Test Date', 'Comments'],
      ...testCases.map(t => [
        t.testNumber,
        t.description,
        t.steps || '',
        t.dependencies || '',
        t.priority,
        STATUS_LABELS[t.status],
        t.tester || '',
        t.testDate || '',
        t.comments || ''
      ])
    ].map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UAT-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    init,
    loadTests,
    renderTable,
    cycleStatus,
    editTest,
    deleteTest,
    exportTests
  };
})();
