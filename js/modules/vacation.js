/* ========================================
   Vacation Module - Vacation Coverage Matrix
   Team absences and backup assignments
   ======================================== */

const VacationModule = (() => {
  let projectId = null;
  let coverageEntries = [];

  function init(pid) {
    projectId = pid;
    if (!projectId) {
      console.warn('VacationModule: No projectId provided');
      return;
    }
    setupButtons();
    loadCoverage();
  }

  function setupButtons() {
    document.getElementById('btn-add-vacation')?.addEventListener('click', () => openVacationForm());
    document.getElementById('btn-add-vacation-empty')?.addEventListener('click', () => openVacationForm());
    document.getElementById('btn-export-vacation')?.addEventListener('click', exportCoverage);
  }

  async function loadCoverage() {
    coverageEntries = await DB.getAllForProject('vacation_coverage', projectId);
    coverageEntries.sort((a, b) => new Date(a.vacationStart || a.vacationDates?.[0] || 0) - new Date(b.vacationStart || b.vacationDates?.[0] || 0));
    renderTable();
  }

  function renderTable() {
    const tbody = document.getElementById('vacation-tbody');
    const table = document.getElementById('vacation-table');
    const empty = document.getElementById('vacation-empty');

    if (!tbody) return;

    if (coverageEntries.length === 0) {
      table.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }

    table.style.display = 'table';
    empty.style.display = 'none';

    const today = new Date();

    tbody.innerHTML = coverageEntries.map(entry => {
      const start = entry.vacationStart || (entry.vacationDates?.[0]);
      const end = entry.vacationEnd || (entry.vacationDates?.[entry.vacationDates.length - 1]);
      const startDate = start ? new Date(start) : null;
      const endDate = end ? new Date(end) : null;
      
      let status = 'upcoming';
      if (startDate && endDate) {
        if (today > endDate) status = 'past';
        else if (today >= startDate && today <= endDate) status = 'active';
      }

      return `
        <tr data-id="${entry.id}" class="vacation-${status}">
          <td>
            <div class="vacation-person">${App.escapeHTML(entry.person)}</div>
            <div class="vacation-role">${App.escapeHTML(entry.role)}</div>
          </td>
          <td>
            ${status === 'active' ? '<span class="badge badge-active">Current</span>' : ''}
            ${startDate ? App.formatDate(start) : 'N/A'}
            ${endDate && endDate.getTime() !== startDate?.getTime() ? ` - ${App.formatDate(end)}` : ''}
          </td>
          <td>${entry.vacationDates?.length || entry.days || '-'}</td>
          <td>
            <div class="vacation-backup">
              <strong>${App.escapeHTML(entry.backup)}</strong>
            </div>
          </td>
          <td>${App.escapeHTML(entry.notes || '')}</td>
          <td>
            ${entry.isCriticalPeriod ? '<span class="badge badge-priority-critical">Critical Period</span>' : '-'}
          </td>
          <td>
            <button class="action-btn" onclick="VacationModule.editEntry(${entry.id})" title="Edit">
              <i data-lucide="pencil"></i>
            </button>
            <button class="action-btn delete" onclick="VacationModule.deleteEntry(${entry.id})" title="Delete">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  }

  function openVacationForm(entry = null) {
    const isEdit = entry && entry.id;
    const title = isEdit ? 'Edit Vacation Entry' : 'Add Vacation Entry';

    const body = `
      <div class="form-row">
        <div class="form-group">
          <label>Person *</label>
          <input type="text" id="vacation-person" class="form-control" placeholder="Team member name" 
                 value="${isEdit ? App.escapeHTML(entry.person) : ''}">
        </div>
        <div class="form-group">
          <label>Role</label>
          <input type="text" id="vacation-role" class="form-control" placeholder="e.g., Project Manager" 
                 value="${isEdit ? App.escapeHTML(entry.role || '') : ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Start Date *</label>
          <input type="date" id="vacation-start" class="form-control" 
                 value="${isEdit ? entry.vacationStart || entry.vacationDates?.[0] || '' : ''}">
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input type="date" id="vacation-end" class="form-control" 
                 value="${isEdit ? entry.vacationEnd || entry.vacationDates?.[entry.vacationDates.length - 1] || '' : ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Backup / Coverage *</label>
          <input type="text" id="vacation-backup" class="form-control" placeholder="Who covers during absence?" 
                 value="${isEdit ? App.escapeHTML(entry.backup) : ''}">
        </div>
        <div class="form-group">
          <label>Days</label>
          <input type="number" id="vacation-days" class="form-control" placeholder="Number of days" 
                 value="${isEdit ? entry.days || '' : ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="vacation-critical" ${isEdit && entry.isCriticalPeriod ? 'checked' : ''}>
          Critical Period (during go-live or major milestone)
        </label>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="vacation-notes" class="form-control" rows="2" placeholder="e.g., Available for escalation only, Handover complete...">${isEdit ? App.escapeHTML(entry.notes || '') : ''}</textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-vacation">${isEdit ? 'Update' : 'Add'}</button>
    `;

    App.openModal(title, body, footer);

    document.getElementById('btn-save-vacation').addEventListener('click', async () => {
      const person = document.getElementById('vacation-person').value.trim();
      const start = document.getElementById('vacation-start').value;
      const backup = document.getElementById('vacation-backup').value.trim();
      
      if (!person || !start || !backup) {
        App.toast('Person, Start Date, and Backup are required', 'warning');
        return;
      }

      const end = document.getElementById('vacation-end').value;
      const startDate = new Date(start);
      const endDate = end ? new Date(end) : startDate;
      
      // Generate array of dates
      const dates = [];
      const current = new Date(startDate);
      while (current <= endDate) {
        dates.push(current.toISOString().slice(0, 10));
        current.setDate(current.getDate() + 1);
      }

      const data = {
        projectId,
        person,
        role: document.getElementById('vacation-role').value.trim(),
        vacationStart: start,
        vacationEnd: end || start,
        vacationDates: dates,
        days: parseInt(document.getElementById('vacation-days').value) || dates.length,
        backup,
        isCriticalPeriod: document.getElementById('vacation-critical').checked,
        notes: document.getElementById('vacation-notes').value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = entry.id;
        data.createdAt = entry.createdAt;
        await DB.put('vacation_coverage', data);
        App.toast('Vacation entry updated', 'success');
      } else {
        data.createdAt = new Date().toISOString();
        await DB.add('vacation_coverage', data);
        App.toast('Vacation entry added', 'success');
      }

      App.closeModal();
      loadCoverage();
    });
  }

  function editEntry(id) {
    const entry = coverageEntries.find(e => e.id === id);
    if (entry) openVacationForm(entry);
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this vacation entry?')) return;
    await DB.remove('vacation_coverage', id);
    App.toast('Vacation entry deleted', 'info');
    loadCoverage();
  }

  function exportCoverage() {
    const csv = [
      ['Person', 'Role', 'Start Date', 'End Date', 'Days', 'Backup', 'Critical Period', 'Notes'],
      ...coverageEntries.map(e => [
        e.person,
        e.role || '',
        e.vacationStart || e.vacationDates?.[0] || '',
        e.vacationEnd || e.vacationDates?.[e.vacationDates.length - 1] || '',
        e.days || e.vacationDates?.length || '',
        e.backup,
        e.isCriticalPeriod ? 'Yes' : 'No',
        e.notes || ''
      ])
    ].map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vacation-Coverage-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    init,
    loadCoverage,
    renderTable,
    editEntry,
    deleteEntry,
    exportCoverage
  };
})();
