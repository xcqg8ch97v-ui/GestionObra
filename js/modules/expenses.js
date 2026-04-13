/* ========================================
   Expenses Module - Gastos Propios de Obra
   ======================================== */

const ExpensesModule = (() => {

  const EXPENSE_CATEGORIES = [
    'Alojamiento', 'Manutención', 'Transporte', 'Combustible',
    'Herramientas', 'Equipos de protección', 'Alquiler maquinaria',
    'Material fungible', 'Gestión y tramitación', 'Seguros',
    'Comunicaciones', 'Otros'
  ];

  let projectId = null;
  let _allExpenses = [];
  let _filterCategory = '__all__';
  let _filterMonth = '__all__';

  function init(pid) {
    projectId = pid;
    setupButtons();
    loadExpenses();
  }

  function setupButtons() {
    function cloneAndBind(id, event, handler) {
      const el = document.getElementById(id);
      if (!el) return;
      const fresh = el.cloneNode(true);
      el.parentNode.replaceChild(fresh, el);
      fresh.addEventListener(event, handler);
    }

    cloneAndBind('btn-add-expense', 'click', () => openExpenseForm());
    cloneAndBind('btn-add-expense-empty', 'click', () => openExpenseForm());
    cloneAndBind('expense-filter-category', 'change', e => {
      _filterCategory = e.target.value;
      applyFilter();
    });
    cloneAndBind('expense-filter-month', 'change', e => {
      _filterMonth = e.target.value;
      applyFilter();
    });
  }

  async function loadExpenses() {
    _allExpenses = await DB.getAllForProject('expenses', projectId);
    _allExpenses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    populateFilters();
    applyFilter();
  }

  function populateFilters() {
    const catSel = document.getElementById('expense-filter-category');
    const monSel = document.getElementById('expense-filter-month');
    if (!catSel || !monSel) return;

    const cats = ['__all__', ...new Set(_allExpenses.map(e => e.category).filter(Boolean).sort())];
    catSel.innerHTML = cats.map(c =>
      `<option value="${App.escapeHTML(c)}">${c === '__all__' ? 'Todas las categorías' : App.escapeHTML(c)}</option>`
    ).join('');
    catSel.value = cats.includes(_filterCategory) ? _filterCategory : '__all__';

    const months = ['__all__', ...new Set(_allExpenses.map(e => (e.date || '').slice(0, 7)).filter(Boolean).sort().reverse())];
    monSel.innerHTML = months.map(m =>
      `<option value="${m}">${m === '__all__' ? 'Todos los meses' : formatMonth(m)}</option>`
    ).join('');
    monSel.value = months.includes(_filterMonth) ? _filterMonth : '__all__';
  }

  function formatMonth(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${names[parseInt(m, 10) - 1]} ${y}`;
  }

  function applyFilter() {
    let filtered = _allExpenses;
    if (_filterCategory !== '__all__') filtered = filtered.filter(e => e.category === _filterCategory);
    if (_filterMonth !== '__all__') filtered = filtered.filter(e => (e.date || '').startsWith(_filterMonth));
    renderExpenses(filtered);
  }

  function renderExpenses(expenses) {
    const tbody = document.getElementById('expenses-tbody');
    const table = document.getElementById('expenses-table');
    const empty = document.getElementById('expenses-empty');
    const tfoot = document.getElementById('expenses-tfoot');
    if (!tbody) return;

    if (expenses.length === 0) {
      table.style.display = 'none';
      empty.style.display = '';
      if (tfoot) tfoot.innerHTML = '';
      return;
    }

    table.style.display = 'table';
    empty.style.display = 'none';

    const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    tbody.innerHTML = expenses.map(e => {
      const catColor = getCategoryColor(e.category);
      const assignees = [e.person, e.team].filter(Boolean).join(' · ') || '—';
      return `
        <tr>
          <td>${App.escapeHTML(App.formatDate ? App.formatDate(e.date) : e.date || '—')}</td>
          <td><span class="exp-badge" style="background:${catColor}20;color:${catColor};border:1px solid ${catColor}40">${App.escapeHTML(e.category || '—')}</span></td>
          <td><strong>${App.escapeHTML(e.description || '—')}</strong></td>
          <td style="color:var(--text-muted);font-size:12px">${App.escapeHTML(assignees)}</td>
          <td style="text-align:right;font-weight:600">${App.formatCurrency(e.amount || 0)}</td>
          <td style="text-align:right;font-size:12px;color:var(--text-muted)">${App.escapeHTML(e.receipt || '—')}</td>
          <td>
            <div class="action-btns">
              <button class="action-btn" onclick="ExpensesModule.editExpense(${e.id})" title="Editar"><i data-lucide="pencil"></i></button>
              <button class="action-btn delete" onclick="ExpensesModule.deleteExpense(${e.id})" title="Eliminar"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>`;
    }).join('');

    if (tfoot) {
      const label = (_filterCategory !== '__all__' || _filterMonth !== '__all__')
        ? `TOTAL filtrado (${expenses.length} gasto${expenses.length !== 1 ? 's' : ''})`
        : `TOTAL (${expenses.length} gasto${expenses.length !== 1 ? 's' : ''})`;
      tfoot.innerHTML = `
        <tr style="font-weight:700;background:var(--bg-secondary);border-top:2px solid var(--border)">
          <td colspan="4" style="padding:10px 12px">${label}</td>
          <td style="padding:10px 12px;text-align:right">${App.formatCurrency(total)}</td>
          <td colspan="2"></td>
        </tr>`;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Resumen por categoría
    renderSummary(expenses);
  }

  function renderSummary(expenses) {
    const container = document.getElementById('expenses-summary');
    if (!container) return;

    const byCategory = {};
    expenses.forEach(e => {
      if (!byCategory[e.category]) byCategory[e.category] = 0;
      byCategory[e.category] += (e.amount || 0);
    });

    const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

    container.innerHTML = sorted.map(([cat, amt]) => {
      const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : 0;
      const color = getCategoryColor(cat);
      return `
        <div class="exp-summary-item">
          <div class="exp-summary-header">
            <span class="exp-badge" style="background:${color}20;color:${color};border:1px solid ${color}40">${App.escapeHTML(cat)}</span>
            <span style="font-weight:600">${App.formatCurrency(amt)}</span>
          </div>
          <div class="exp-summary-bar-track">
            <div class="exp-summary-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);text-align:right">${pct}%</div>
        </div>`;
    }).join('');

    if (sorted.length === 0) container.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Sin datos</p>';
  }

  function getCategoryColor(cat) {
    const palette = {
      'Alojamiento': '#3B82F6',
      'Manutención': '#F97316',
      'Transporte': '#8B5CF6',
      'Combustible': '#EF4444',
      'Herramientas': '#EAB308',
      'Equipos de protección': '#14B8A6',
      'Alquiler maquinaria': '#EC4899',
      'Material fungible': '#06B6D4',
      'Gestión y tramitación': '#64748B',
      'Seguros': '#84CC16',
      'Comunicaciones': '#A855F7',
      'Otros': '#94A3B8',
    };
    return palette[cat] || '#94A3B8';
  }

  async function getActiveCategories() {
    if (!projectId) return EXPENSE_CATEGORIES;
    const hidden = (await DB.getCustomCategories(projectId, 'expenseCategory', 'hide')).map(c => c.name);
    const custom = await DB.getCustomCategories(projectId, 'expenseCategory', 'add');
    const base = EXPENSE_CATEGORIES.filter(c => !hidden.includes(c));
    const customVisible = custom.filter(c => !hidden.includes(c.name)).map(c => c.name);
    return [...base, ...customVisible];
  }

  async function openExpenseForm(expense = null) {
    const isEdit = !!expense;
    const title = isEdit ? 'Editar Gasto' : 'Nuevo Gasto';
    const today = new Date().toISOString().slice(0, 10);
    const activeCategories = await getActiveCategories();

    const body = `
      <div class="form-row">
        <div class="form-group">
          <label>Fecha *</label>
          <input type="date" id="exp-date" value="${isEdit ? (expense.date || today) : today}" required>
        </div>
        <div class="form-group">
          <label>Categoría *</label>
          <select id="exp-category">
            ${activeCategories.map(c => `<option value="${c}" ${isEdit && expense.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Descripción *</label>
        <input type="text" id="exp-description" value="${isEdit ? App.escapeHTML(expense.description || '') : ''}" placeholder="Ej: Hotel 3 noches en Madrid">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Importe (€) *</label>
          <input type="number" id="exp-amount" min="0" step="0.01" value="${isEdit ? (expense.amount || '') : ''}">
        </div>
        <div class="form-group">
          <label>Nº Factura / Justificante</label>
          <input type="text" id="exp-receipt" value="${isEdit ? App.escapeHTML(expense.receipt || '') : ''}" placeholder="Ej: FAC-2024-001">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Persona(s)</label>
          <input type="text" id="exp-person" value="${isEdit ? App.escapeHTML(expense.person || '') : ''}" placeholder="Ej: Juan García, Ana López">
        </div>
        <div class="form-group">
          <label>Equipo / Máquina</label>
          <input type="text" id="exp-team" value="${isEdit ? App.escapeHTML(expense.team || '') : ''}" placeholder="Ej: Grúa tower, Equipo eléctrico A">
        </div>
      </div>
      <div class="form-group">
        <label>Notas</label>
        <textarea id="exp-notes" rows="2">${isEdit ? App.escapeHTML(expense.notes || '') : ''}</textarea>
      </div>`;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-expense">
        <i data-lucide="save"></i> ${isEdit ? 'Guardar' : 'Crear'}
      </button>`;

    App.openModal(title, body, footer);

    document.getElementById('btn-save-expense').addEventListener('click', async () => {
      const date = document.getElementById('exp-date').value;
      const description = document.getElementById('exp-description').value.trim();
      const amount = parseFloat(document.getElementById('exp-amount').value.replace(',', '.'));

      if (!date || !description || isNaN(amount) || amount < 0) {
        App.toast('Fecha, descripción e importe son obligatorios', 'warning');
        return;
      }

      const data = {
        date,
        category: document.getElementById('exp-category').value,
        description,
        amount,
        receipt: document.getElementById('exp-receipt').value.trim(),
        person: document.getElementById('exp-person').value.trim(),
        team: document.getElementById('exp-team').value.trim(),
        notes: document.getElementById('exp-notes').value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = expense.id;
        data.projectId = expense.projectId;
        data.createdAt = expense.createdAt;
        await DB.put('expenses', data);
        App.toast('Gasto actualizado', 'success');
      } else {
        data.projectId = projectId;
        data.createdAt = new Date().toISOString();
        await DB.add('expenses', data);
        App.toast('Gasto registrado', 'success');
      }

      App.closeModal();
      loadExpenses();
    });
  }

  async function editExpense(id) {
    const expense = await DB.getById('expenses', id);
    if (expense) openExpenseForm(expense);
  }

  async function deleteExpense(id) {
    if (!await App.confirm('¿Eliminar este gasto?')) return;
    await DB.remove('expenses', id);
    App.toast('Gasto eliminado', 'info');
    loadExpenses();
  }

  async function getTotalForProject(pid) {
    const all = await DB.getAllForProject('expenses', pid);
    return all.reduce((s, e) => s + (e.amount || 0), 0);
  }

  async function getAllForProject(pid) {
    return DB.getAllForProject('expenses', pid);
  }

  function getDefaultCategories() {
    return EXPENSE_CATEGORIES;
  }

  return { init, editExpense, deleteExpense, getTotalForProject, getAllForProject, getDefaultCategories };
})();
