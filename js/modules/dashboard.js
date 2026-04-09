/* ========================================
   Dashboard Module - Proveedores y Presupuestos
   CRUD + Comparador Visual
   ======================================== */

const DashboardModule = (() => {
  const TRADES = [
    'Albañilería', 'Fontanería', 'Electricidad', 'Carpintería',
    'Pintura', 'Cristalería', 'Climatización', 'Impermeabilización',
    'Estructura', 'Cimentación', 'Paisajismo', 'Seguridad', 'Otros'
  ];

  const SUPPLIER_STATUSES = ['Activo', 'Pendiente', 'Inactivo'];
  let projectId = null;

  function init(pid) {
    projectId = pid;
    setupSubTabs();
    setupButtons();
    loadSuppliers();
    loadBudgets();
  }

  // --- Sub-tabs ---
  function setupSubTabs() {
    document.querySelectorAll('.sub-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.getElementById(`panel-${tab.dataset.subtab}`);
        if (panel) panel.classList.add('active');

        if (tab.dataset.subtab === 'comparator') {
          renderComparator();
        }
      });
    });
  }

  function setupButtons() {
    document.getElementById('btn-add-supplier').addEventListener('click', () => openSupplierForm());
    document.getElementById('btn-add-supplier-empty').addEventListener('click', () => openSupplierForm());
    document.getElementById('btn-add-budget').addEventListener('click', () => openBudgetForm());
    document.getElementById('btn-add-budget-empty').addEventListener('click', () => openBudgetForm());
  }

  // ========================================
  // SUPPLIERS
  // ========================================

  async function loadSuppliers() {
    const suppliers = await DB.getAllForProject('suppliers', projectId);
    renderSuppliers(suppliers);
  }

  function renderSuppliers(suppliers) {
    const tbody = document.getElementById('suppliers-tbody');
    const emptyState = document.getElementById('suppliers-empty');
    const table = document.getElementById('suppliers-table');

    if (suppliers.length === 0) {
      table.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    tbody.innerHTML = suppliers.map(s => {
      const statusClass = s.status === 'Activo' ? 'badge-active' :
                           s.status === 'Pendiente' ? 'badge-pending' : 'badge-inactive';
      return `
        <tr>
          <td><strong>${App.escapeHTML(s.name)}</strong></td>
          <td>${App.escapeHTML(s.trade)}</td>
          <td>${App.escapeHTML(s.contact || '-')}</td>
          <td>${App.escapeHTML(s.phone || '-')}</td>
          <td><span class="badge ${statusClass}">${App.escapeHTML(s.status)}</span></td>
          <td>
            <div class="action-btns">
              <button class="action-btn" onclick="DashboardModule.editSupplier(${s.id})" title="Editar">
                <i data-lucide="pencil"></i>
              </button>
              <button class="action-btn delete" onclick="DashboardModule.deleteSupplier(${s.id})" title="Eliminar">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  }

  function openSupplierForm(supplier = null) {
    const isEdit = !!supplier;
    const title = isEdit ? 'Editar Proveedor' : 'Nuevo Proveedor';

    const body = `
      <div class="form-group">
        <label>Empresa *</label>
        <input type="text" id="sup-name" value="${isEdit ? App.escapeHTML(supplier.name) : ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Gremio *</label>
          <select id="sup-trade">
            ${TRADES.map(t => `<option value="${t}" ${isEdit && supplier.trade === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Estado</label>
          <select id="sup-status">
            ${SUPPLIER_STATUSES.map(s => `<option value="${s}" ${isEdit && supplier.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Persona de Contacto</label>
        <input type="text" id="sup-contact" value="${isEdit ? App.escapeHTML(supplier.contact || '') : ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Teléfono</label>
          <input type="tel" id="sup-phone" value="${isEdit ? App.escapeHTML(supplier.phone || '') : ''}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="sup-email" value="${isEdit ? App.escapeHTML(supplier.email || '') : ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Notas</label>
        <textarea id="sup-notes">${isEdit ? App.escapeHTML(supplier.notes || '') : ''}</textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-supplier">
        <i data-lucide="save"></i> ${isEdit ? 'Guardar' : 'Crear'}
      </button>
    `;

    App.openModal(title, body, footer);

    document.getElementById('btn-save-supplier').addEventListener('click', async () => {
      const name = document.getElementById('sup-name').value.trim();
      if (!name) {
        App.toast('El nombre es obligatorio', 'warning');
        return;
      }

      const data = {
        name,
        trade: document.getElementById('sup-trade').value,
        status: document.getElementById('sup-status').value,
        contact: document.getElementById('sup-contact').value.trim(),
        phone: document.getElementById('sup-phone').value.trim(),
        email: document.getElementById('sup-email').value.trim(),
        notes: document.getElementById('sup-notes').value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = supplier.id;
        data.projectId = supplier.projectId;
        data.createdAt = supplier.createdAt;
        await DB.put('suppliers', data);
        App.toast('Proveedor actualizado', 'success');
      } else {
        data.createdAt = new Date().toISOString();
        data.projectId = projectId;
        await DB.add('suppliers', data);
        App.toast('Proveedor creado', 'success');
      }

      App.closeModal();
      loadSuppliers();
    });
  }

  async function editSupplier(id) {
    const supplier = await DB.getById('suppliers', id);
    if (supplier) openSupplierForm(supplier);
  }

  async function deleteSupplier(id) {
    if (!confirm('¿Eliminar este proveedor?')) return;
    await DB.remove('suppliers', id);
    App.toast('Proveedor eliminado', 'info');
    loadSuppliers();
  }

  // ========================================
  // BUDGETS
  // ========================================

  async function loadBudgets() {
    const budgets = await DB.getAllForProject('budgets', projectId);
    renderBudgets(budgets);
  }

  async function renderBudgets(budgets) {
    const tbody = document.getElementById('budgets-tbody');
    const emptyState = document.getElementById('budgets-empty');
    const table = document.getElementById('budgets-table');

    if (budgets.length === 0) {
      table.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    const suppliers = await DB.getAllForProject('suppliers', projectId);
    const supplierMap = {};
    suppliers.forEach(s => supplierMap[s.id] = s.name);

    tbody.innerHTML = budgets.map(b => {
      const deviation = b.realCost - b.estimatedCost;
      const deviationPct = b.estimatedCost > 0 ? ((deviation / b.estimatedCost) * 100).toFixed(1) : 0;
      const devClass = deviation > 0 ? 'badge-negative' : deviation < 0 ? 'badge-positive' : 'badge-neutral';
      const devSign = deviation > 0 ? '+' : '';
      const margin = b.profitMargin || 0;
      const profitAmount = b.estimatedCost > 0 ? (b.estimatedCost * margin / 100) : 0;

      return `
        <tr>
          <td><strong>${App.escapeHTML(b.category)}</strong><br><small style="color:var(--text-muted)">${App.escapeHTML(b.description || '')}</small></td>
          <td>${App.escapeHTML(supplierMap[b.supplierId] || '-')}</td>
          <td>${App.formatCurrency(b.estimatedCost)}</td>
          <td>${App.formatCurrency(b.realCost)}</td>
          <td><span class="badge badge-positive">${margin}% <small>(${App.formatCurrency(profitAmount)})</small></span></td>
          <td><span class="badge ${devClass}">${devSign}${App.formatCurrency(deviation)} (${devSign}${deviationPct}%)</span></td>
          <td>
            <div class="action-btns">
              <button class="action-btn" onclick="DashboardModule.editBudget(${b.id})" title="Editar">
                <i data-lucide="pencil"></i>
              </button>
              <button class="action-btn delete" onclick="DashboardModule.deleteBudget(${b.id})" title="Eliminar">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  }

  async function openBudgetForm(budget = null) {
    const isEdit = !!budget;
    const title = isEdit ? 'Editar Partida' : 'Nueva Partida';

    const suppliers = await DB.getAllForProject('suppliers', projectId);

    const body = `
      <div class="form-group">
        <label>Partida / Categoría *</label>
        <select id="bud-category">
          ${TRADES.map(t => `<option value="${t}" ${isEdit && budget.category === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Descripción</label>
        <input type="text" id="bud-description" value="${isEdit ? App.escapeHTML(budget.description || '') : ''}" placeholder="Ej: Instalación completa de fontanería">
      </div>
      <div class="form-group">
        <label>Proveedor</label>
        <select id="bud-supplier">
          <option value="">— Sin asignar —</option>
          ${suppliers.map(s => `<option value="${s.id}" ${isEdit && budget.supplierId === s.id ? 'selected' : ''}>${App.escapeHTML(s.name)} (${App.escapeHTML(s.trade)})</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Coste Previsto (€) *</label>
          <input type="number" id="bud-estimated" min="0" step="0.01" value="${isEdit ? budget.estimatedCost : ''}">
        </div>
        <div class="form-group">
          <label>Coste Real (€)</label>
          <input type="number" id="bud-real" min="0" step="0.01" value="${isEdit ? budget.realCost : '0'}">
        </div>
      </div>
      <div class="form-group">
        <label>Beneficio objetivo (%)</label>
        <input type="number" id="bud-profit-margin" min="0" max="100" step="0.1" value="${isEdit ? (budget.profitMargin || 0) : '0'}" placeholder="Ej: 15">
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-budget">
        <i data-lucide="save"></i> ${isEdit ? 'Guardar' : 'Crear'}
      </button>
    `;

    App.openModal(title, body, footer);

    document.getElementById('btn-save-budget').addEventListener('click', async () => {
      const estimated = parseFloat(document.getElementById('bud-estimated').value);
      if (isNaN(estimated)) {
        App.toast('El coste previsto es obligatorio', 'warning');
        return;
      }

      const data = {
        category: document.getElementById('bud-category').value,
        description: document.getElementById('bud-description').value.trim(),
        supplierId: parseInt(document.getElementById('bud-supplier').value) || null,
        estimatedCost: estimated,
        realCost: parseFloat(document.getElementById('bud-real').value) || 0,
        profitMargin: parseFloat(document.getElementById('bud-profit-margin').value) || 0,
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = budget.id;
        data.projectId = budget.projectId;
        data.createdAt = budget.createdAt;
        await DB.put('budgets', data);
        App.toast('Partida actualizada', 'success');
      } else {
        data.createdAt = new Date().toISOString();
        data.projectId = projectId;
        await DB.add('budgets', data);
        App.toast('Partida creada', 'success');
      }

      App.closeModal();
      loadBudgets();
    });
  }

  async function editBudget(id) {
    const budget = await DB.getById('budgets', id);
    if (budget) openBudgetForm(budget);
  }

  async function deleteBudget(id) {
    if (!confirm('¿Eliminar esta partida?')) return;
    await DB.remove('budgets', id);
    App.toast('Partida eliminada', 'info');
    loadBudgets();
  }

  // ========================================
  // COMPARATOR
  // ========================================

  async function renderComparator() {
    const budgets = await DB.getAllForProject('budgets', projectId);
    const container = document.getElementById('budget-chart');

    if (budgets.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="bar-chart-horizontal"></i>
          <p>Añade partidas presupuestarias para ver el comparador</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    // Aggregate by category
    const categories = {};
    let totalEstimated = 0;
    let totalReal = 0;

    budgets.forEach(b => {
      if (!categories[b.category]) {
        categories[b.category] = { estimated: 0, real: 0 };
      }
      categories[b.category].estimated += b.estimatedCost;
      categories[b.category].real += b.realCost;
      totalEstimated += b.estimatedCost;
      totalReal += b.realCost;
    });

    const totalDeviation = totalReal - totalEstimated;

    // Update summary
    document.getElementById('total-estimated').textContent = App.formatCurrency(totalEstimated);
    document.getElementById('total-real').textContent = App.formatCurrency(totalReal);

    const devEl = document.getElementById('total-deviation');
    devEl.textContent = (totalDeviation >= 0 ? '+' : '') + App.formatCurrency(totalDeviation);
    devEl.style.color = totalDeviation > 0 ? 'var(--red)' : totalDeviation < 0 ? 'var(--green)' : 'var(--text-primary)';

    // Find max for scale
    const maxValue = Math.max(...Object.values(categories).flatMap(c => [c.estimated, c.real]));

    // Render bars
    container.innerHTML = Object.entries(categories).map(([cat, data]) => {
      const deviation = data.real - data.estimated;
      const devPct = data.estimated > 0 ? ((deviation / data.estimated) * 100).toFixed(1) : 0;
      const estWidth = maxValue > 0 ? (data.estimated / maxValue * 100) : 0;
      const realWidth = maxValue > 0 ? (data.real / maxValue * 100) : 0;
      const realClass = data.real > data.estimated ? 'over' : data.real < data.estimated ? 'under' : 'estimated';

      return `
        <div class="budget-bar-group">
          <div class="budget-bar-label">
            <span>${App.escapeHTML(cat)}</span>
            <span>Desviación: ${deviation >= 0 ? '+' : ''}${App.formatCurrency(deviation)} (${deviation >= 0 ? '+' : ''}${devPct}%)</span>
          </div>
          <div class="budget-bars">
            <div class="bar-track">
              <div class="bar-fill estimated" style="width:${estWidth}%">
                Previsto: ${App.formatCurrency(data.estimated)}
              </div>
            </div>
            <div class="bar-track">
              <div class="bar-fill ${realClass}" style="width:${realWidth}%">
                Real: ${App.formatCurrency(data.real)}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  }

  return {
    init,
    editSupplier,
    deleteSupplier,
    editBudget,
    deleteBudget,
    refresh: () => { loadSuppliers(); loadBudgets(); }
  };
})();
