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
    setupBC3Import();
    setupComparatorFilter();
    setupSupplierFilters();
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

  let allSuppliers = [];
  let supplierFilterTrade = '__all__';
  let supplierSearchQuery = '';

  function setupSupplierFilters() {
    const searchInput = document.getElementById('supplier-search');
    const tradeSelect = document.getElementById('supplier-trade-filter');
    if (!searchInput || !tradeSelect) return;

    // Populate trade filter options
    tradeSelect.innerHTML = '<option value="__all__">Todos los gremios</option>' +
      TRADES.map(t => `<option value="${t}">${t}</option>`).join('');

    searchInput.addEventListener('input', (e) => {
      supplierSearchQuery = e.target.value.trim().toLowerCase();
      applySupplierFilters();
    });

    tradeSelect.addEventListener('change', (e) => {
      supplierFilterTrade = e.target.value;
      applySupplierFilters();
    });
  }

  function applySupplierFilters() {
    let filtered = allSuppliers;
    if (supplierFilterTrade !== '__all__') {
      filtered = filtered.filter(s => s.trade === supplierFilterTrade);
    }
    if (supplierSearchQuery) {
      filtered = filtered.filter(s =>
        (s.name || '').toLowerCase().includes(supplierSearchQuery) ||
        (s.contact || '').toLowerCase().includes(supplierSearchQuery) ||
        (s.phone || '').toLowerCase().includes(supplierSearchQuery) ||
        (s.trade || '').toLowerCase().includes(supplierSearchQuery)
      );
    }
    renderSuppliers(filtered);
  }

  async function loadSuppliers() {
    allSuppliers = await DB.getAllForProject('suppliers', projectId);
    applySupplierFilters();
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

  let comparatorTrade = null;

  function setupComparatorFilter() {
    // No longer needs a <select>, we use trade cards now
  }

  async function renderComparator() {
    const [budgets, suppliers] = await Promise.all([
      DB.getAllForProject('budgets', projectId),
      DB.getAllForProject('suppliers', projectId)
    ]);

    const supplierMap = {};
    suppliers.forEach(s => { supplierMap[s.id] = s; });

    // Group budgets by category
    const byCategory = {};
    budgets.forEach(b => {
      if (!byCategory[b.category]) byCategory[b.category] = [];
      byCategory[b.category].push(b);
    });

    const grid = document.getElementById('comp-trade-grid');
    const detail = document.getElementById('comp-detail');

    if (budgets.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <i data-lucide="scale"></i>
          <p>Añade partidas presupuestarias para comparar proveedores</p>
        </div>`;
      detail.style.display = 'none';
      lucide.createIcons();
      return;
    }

    // Render trade category cards
    grid.innerHTML = Object.entries(byCategory).map(([cat, entries]) => {
      const count = entries.length;
      const supplierCount = new Set(entries.map(b => b.supplierId).filter(Boolean)).size;
      const totalEst = entries.reduce((s, b) => s + (b.estimatedCost || 0), 0);
      const minEst = Math.min(...entries.map(b => b.estimatedCost || Infinity));
      const maxEst = Math.max(...entries.map(b => b.estimatedCost || 0));
      const isActive = comparatorTrade === cat;
      const spread = count > 1 ? maxEst - minEst : 0;

      return `
        <button class="comp-trade-card ${isActive ? 'active' : ''}" data-trade="${App.escapeHTML(cat)}">
          <div class="comp-trade-card-title">${App.escapeHTML(cat)}</div>
          <div class="comp-trade-card-stats">
            <span>${count} ${count === 1 ? 'partida' : 'partidas'}</span>
            <span>${supplierCount} ${supplierCount === 1 ? 'proveedor' : 'proveedores'}</span>
          </div>
          <div class="comp-trade-card-range">
            ${count > 1 
              ? `<span class="comp-range-label">Rango:</span> ${App.formatCurrency(minEst)} — ${App.formatCurrency(maxEst)}`
              : App.formatCurrency(totalEst)}
          </div>
          ${spread > 0 ? `<div class="comp-trade-card-spread">Ahorro potencial: <strong>${App.formatCurrency(spread)}</strong></div>` : ''}
        </button>`;
    }).join('');

    // Bind trade card clicks
    grid.querySelectorAll('.comp-trade-card').forEach(card => {
      card.addEventListener('click', () => {
        const trade = card.dataset.trade;
        comparatorTrade = comparatorTrade === trade ? null : trade;
        renderComparator();
      });
    });

    // Show detail if trade selected
    if (comparatorTrade && byCategory[comparatorTrade]) {
      detail.style.display = 'block';
      renderComparatorDetail(byCategory[comparatorTrade], supplierMap);
    } else {
      detail.style.display = 'none';
    }

    lucide.createIcons();
  }

  function renderComparatorDetail(entries, supplierMap) {
    const headerEl = document.getElementById('comp-detail-header');
    const summaryEl = document.getElementById('comp-detail-summary');
    const bodyEl = document.getElementById('comp-detail-body');

    // Sort by estimated cost ascending
    const sorted = [...entries].sort((a, b) => (a.estimatedCost || 0) - (b.estimatedCost || 0));
    const cheapest = sorted[0];
    const mostExpensive = sorted[sorted.length - 1];
    const avgEstimated = sorted.reduce((s, b) => s + (b.estimatedCost || 0), 0) / sorted.length;
    const maxCost = Math.max(...sorted.map(b => Math.max(b.estimatedCost || 0, b.realCost || 0)), 1);

    // Header with back button
    headerEl.innerHTML = `
      <button class="comp-back-btn" id="comp-back-btn">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i>
        Volver a gremios
      </button>
      <h3>${App.escapeHTML(comparatorTrade)}</h3>
      <span class="comp-detail-count">${sorted.length} ${sorted.length === 1 ? 'presupuesto' : 'presupuestos'} de ${new Set(sorted.map(b => b.supplierId).filter(Boolean)).size} proveedores</span>
    `;

    document.getElementById('comp-back-btn').addEventListener('click', () => {
      comparatorTrade = null;
      renderComparator();
    });

    // Summary cards
    const savings = (mostExpensive.estimatedCost || 0) - (cheapest.estimatedCost || 0);
    const savingsPct = mostExpensive.estimatedCost > 0 ? ((savings / mostExpensive.estimatedCost) * 100).toFixed(1) : 0;

    summaryEl.innerHTML = `
      <div class="comp-sum-card">
        <div class="comp-sum-label">Más económico</div>
        <div class="comp-sum-value comp-sum-green">${App.formatCurrency(cheapest.estimatedCost || 0)}</div>
        <div class="comp-sum-sub">${App.escapeHTML((supplierMap[cheapest.supplierId] || {}).name || 'Sin proveedor')}</div>
      </div>
      <div class="comp-sum-card">
        <div class="comp-sum-label">Más caro</div>
        <div class="comp-sum-value comp-sum-red">${App.formatCurrency(mostExpensive.estimatedCost || 0)}</div>
        <div class="comp-sum-sub">${App.escapeHTML((supplierMap[mostExpensive.supplierId] || {}).name || 'Sin proveedor')}</div>
      </div>
      <div class="comp-sum-card">
        <div class="comp-sum-label">Media</div>
        <div class="comp-sum-value">${App.formatCurrency(avgEstimated)}</div>
        <div class="comp-sum-sub">${sorted.length} presupuestos</div>
      </div>
      <div class="comp-sum-card comp-sum-highlight">
        <div class="comp-sum-label">Ahorro potencial</div>
        <div class="comp-sum-value comp-sum-green">${App.formatCurrency(savings)}</div>
        <div class="comp-sum-sub">${savingsPct}% del más caro</div>
      </div>
    `;

    // Comparison table
    let tableHTML = `
      <div class="comp-table-wrap">
      <table class="comp-table">
        <thead>
          <tr>
            <th class="comp-th-rank">#</th>
            <th>Proveedor</th>
            <th class="comp-th-cost">Previsto</th>
            <th class="comp-th-cost">Real</th>
            <th class="comp-th-cost">Desviación</th>
            <th class="comp-th-bar">Visual</th>
            <th>Contacto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>`;

    sorted.forEach((b, idx) => {
      const sup = supplierMap[b.supplierId] || {};
      const supplierName = sup.name || 'Sin proveedor';
      const deviation = (b.realCost || 0) - (b.estimatedCost || 0);
      const devPct = b.estimatedCost > 0 ? ((deviation / b.estimatedCost)* 100).toFixed(1) : '0';
      const diffFromCheapest = (b.estimatedCost || 0) - (cheapest.estimatedCost || 0);
      const estW = maxCost > 0 ? ((b.estimatedCost || 0) / maxCost * 100) : 0;
      const realW = maxCost > 0 ? ((b.realCost || 0) / maxCost * 100) : 0;
      const isBest = idx === 0 && sorted.length > 1;
      const margin = b.profitMargin || 0;

      const devClass = deviation > 0 ? 'comp-val-red' : deviation < 0 ? 'comp-val-green' : '';
      const realBarClass = deviation > 0 ? 'over' : deviation < 0 ? 'under' : 'estimated';

      const statusBadge = sup.status
        ? `<span class="badge ${sup.status === 'Activo' ? 'badge-active' : sup.status === 'Pendiente' ? 'badge-pending' : 'badge-inactive'}">${App.escapeHTML(sup.status)}</span>`
        : '<span style="color:var(--text-muted)">—</span>';

      const contactInfo = sup.phone || sup.email
        ? `<div class="comp-contact-info">
            ${sup.phone ? `<a href="tel:${App.escapeHTML(sup.phone)}" class="comp-contact-link"><i data-lucide="phone" style="width:12px;height:12px"></i> ${App.escapeHTML(sup.phone)}</a>` : ''}
            ${sup.email ? `<a href="mailto:${App.escapeHTML(sup.email)}" class="comp-contact-link"><i data-lucide="mail" style="width:12px;height:12px"></i> ${App.escapeHTML(sup.email)}</a>` : ''}
           </div>`
        : '<span style="color:var(--text-muted)">—</span>';

      tableHTML += `
        <tr class="${isBest ? 'comp-row-best' : ''}">
          <td class="comp-cell-rank">
            ${isBest ? '<span class="comp-rank-badge">✦</span>' : (idx + 1)}
          </td>
          <td>
            <div class="comp-cell-supplier">
              <strong>${App.escapeHTML(supplierName)}</strong>
              ${isBest ? '<span class="comp-best-tag">Mejor precio</span>' : ''}
              ${diffFromCheapest > 0 ? `<span class="comp-diff-tag">+${App.formatCurrency(diffFromCheapest)}</span>` : ''}
              ${b.description ? `<span class="comp-cell-desc">${App.escapeHTML(b.description)}</span>` : ''}
            </div>
          </td>
          <td class="comp-cell-cost"><strong>${App.formatCurrency(b.estimatedCost || 0)}</strong></td>
          <td class="comp-cell-cost">${App.formatCurrency(b.realCost || 0)}</td>
          <td class="comp-cell-cost">
            <span class="${devClass}">
              ${deviation >= 0 ? '+' : ''}${App.formatCurrency(deviation)}
              <small>(${deviation >= 0 ? '+' : ''}${devPct}%)</small>
            </span>
          </td>
          <td class="comp-cell-bars">
            <div class="comp-mini-bar">
              <div class="comp-mini-fill estimated" style="width:${estW}%" title="Previsto: ${App.formatCurrency(b.estimatedCost || 0)}"></div>
            </div>
            <div class="comp-mini-bar">
              <div class="comp-mini-fill ${realBarClass}" style="width:${realW}%" title="Real: ${App.formatCurrency(b.realCost || 0)}"></div>
            </div>
          </td>
          <td class="comp-cell-contact">${contactInfo}</td>
          <td>${statusBadge}</td>
        </tr>`;
    });

    tableHTML += '</tbody></table></div>';

    // Notes section if any supplier has notes
    const notesEntries = sorted
      .filter(b => supplierMap[b.supplierId]?.notes)
      .map(b => {
        const sup = supplierMap[b.supplierId];
        return `<div class="comp-note-item">
          <strong>${App.escapeHTML(sup.name)}:</strong> ${App.escapeHTML(sup.notes)}
        </div>`;
      });

    if (notesEntries.length) {
      tableHTML += `
        <div class="comp-notes-section">
          <div class="comp-notes-title"><i data-lucide="message-square" style="width:14px;height:14px"></i> Notas de proveedores</div>
          ${notesEntries.join('')}
        </div>`;
    }

    bodyEl.innerHTML = tableHTML;
    lucide.createIcons();
  }

  // ========================================
  // BC3 / FIEBDC IMPORT (Presto standard)
  // ========================================

  const TRADE_KEYWORDS = {
    'Albañilería': ['albañil', 'cerramient', 'tabique', 'fachada', 'revestimiento', 'fábrica', 'ladrillo', 'enfoscado', 'enlucido', 'solado', 'alicatado', 'pavimento', 'yeso'],
    'Fontanería': ['fontaner', 'saneamiento', 'agua', 'desagüe', 'tubería', 'sanitario', 'aparatos sanitarios', 'acs'],
    'Electricidad': ['eléctric', 'electric', 'iluminación', 'alumbrado', 'baja tensión', 'alta tensión', 'cableado'],
    'Carpintería': ['carpinter', 'madera', 'puerta', 'ventana', 'persiana', 'cerrajería'],
    'Pintura': ['pintura', 'pintor', 'acabado'],
    'Cristalería': ['cristal', 'vidrio', 'acristalamiento', 'luna'],
    'Climatización': ['climatiz', 'calefacc', 'aire acondicionado', 'ventilación', 'refrigeración', 'aerotermia'],
    'Impermeabilización': ['impermeabiliz', 'aislamiento', 'cubierta', 'tejado', 'barrera de vapor'],
    'Estructura': ['estructura', 'hormigón', 'acero', 'forjado', 'pilar', 'viga', 'losa', 'encofrado', 'ferralla'],
    'Cimentación': ['cimentación', 'cimiento', 'excavación', 'movimiento de tierra', 'zanja', 'zapata', 'pilote', 'demolición', 'derrib'],
    'Paisajismo': ['paisaj', 'jardiner', 'urbanización', 'acera', 'bordillo'],
    'Seguridad': ['seguridad', 'protección', 'salud', 'andamio', 'señalización'],
  };

  function matchTrade(text) {
    const lower = text.toLowerCase();
    let best = 'Otros';
    let bestLen = 0;
    for (const [trade, keywords] of Object.entries(TRADE_KEYWORDS)) {
      for (const kw of keywords) {
        if (lower.includes(kw) && kw.length > bestLen) {
          bestLen = kw.length;
          best = trade;
        }
      }
    }
    return best;
  }

  // Normalize BC3 codes: strip trailing # / ## suffixes
  function normCode(code) { return code.replace(/#+$/, ''); }

  // Lookup concept by code, trying with and without # suffix
  function findConcept(concepts, code) {
    return concepts[code] || concepts[code + '#'] || concepts[code + '##'];
  }

  function parseBC3(text) {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Split into records: each starts with ~LETTER|
    const rawRecords = normalized.split(/(?=~[A-Za-z]\|)/).filter(r => r.trim());

    const concepts = {};
    const decompositions = {};
    const texts = {};

    for (let raw of rawRecords) {
      raw = raw.replace(/\n/g, ''); // join multi-line records
      if (raw.length < 3) continue;
      const typeChar = raw.charAt(1).toUpperCase();
      const content = raw.substring(3);
      const fields = content.split('|');

      switch (typeChar) {
        case 'C': {
          const codes = (fields[0] || '').split('\\');
          const rawCode = codes[0].trim();
          if (!rawCode) break;
          const isRoot = rawCode.endsWith('##');
          const isChapter = !isRoot && rawCode.endsWith('#');
          const code = rawCode;
          const unit = (fields[1] || '').trim();
          const summary = (fields[2] || '').trim();
          const priceField = (fields[3] || '').trim();
          const prices = priceField ? priceField.split('\\').map(p => parseFloat(p) || 0) : [0];
          concepts[code] = { code, unit, summary, price: prices[0] || 0, isRoot, isChapter };
          break;
        }
        case 'D': {
          const parentCode = (fields[0] || '').trim();
          if (!parentCode) break;
          const childrenStr = (fields[1] || '').trim();
          if (!childrenStr) break;
          const parts = childrenStr.split('\\');
          const children = [];
          for (let i = 0; i < parts.length; i += 3) {
            const childCode = (parts[i] || '').trim();
            if (!childCode) continue;
            const factor = parseFloat(parts[i + 1]) || 1;
            const yield_ = parseFloat(parts[i + 2]) || 0;
            children.push({ code: childCode, factor, yield: yield_ });
          }
          if (children.length) decompositions[parentCode] = children;
          break;
        }
        case 'T': {
          const code = (fields[0] || '').trim();
          const longText = (fields[1] || '').trim();
          if (code) texts[code] = longText;
          break;
        }
      }
    }
    return { concepts, decompositions, texts };
  }

  function collectLeafPartidas(code, decompositions, concepts) {
    const normKey = normCode(code);
    const children = decompositions[normKey] || decompositions[code];
    if (!children || children.length === 0) return [];
    const result = [];
    for (const child of children) {
      const concept = findConcept(concepts, child.code);
      if (!concept) continue;
      const childDecomp = decompositions[normCode(child.code)] || decompositions[child.code];
      // If child decomposes into 1 auxiliary (A_), treat the child itself as the leaf
      const isSingleAux = childDecomp && childDecomp.length === 1 && childDecomp[0].code.startsWith('A_');
      if (childDecomp && !isSingleAux) {
        // Sub-chapter: recurse
        result.push(...collectLeafPartidas(child.code, decompositions, concepts));
      } else {
        // Leaf partida (or product wrapping a single auxiliary)
        const qty = child.yield || 1;
        const total = Math.round(concept.price * qty * 100) / 100;
        result.push({
          code: child.code,
          summary: concept.summary || child.code,
          unit: concept.unit || '',
          unitPrice: concept.price,
          quantity: qty,
          totalCost: total
        });
      }
    }
    return result;
  }

  function buildBC3Tree(parsed) {
    const { concepts, decompositions, texts } = parsed;
    // Find root: concept marked with ## suffix
    let rootCode = null;
    for (const [code, c] of Object.entries(concepts)) {
      if (c.isRoot) { rootCode = code; break; }
    }
    // Fallback: parent that is not a child of anything
    if (!rootCode) {
      const allChildren = new Set();
      for (const children of Object.values(decompositions)) {
        children.forEach(c => allChildren.add(c.code));
      }
      for (const code of Object.keys(decompositions)) {
        if (!allChildren.has(code)) { rootCode = code; break; }
      }
    }
    // Decomposition keys don't have # suffix — normalize
    const rootDecompKey = normCode(rootCode || '');
    const rootChildren = decompositions[rootDecompKey] || decompositions[rootCode] || [];
    const chapters = [];
    for (const rc of rootChildren) {
      const ch = findConcept(concepts, rc.code);
      if (!ch) continue;
      const partidas = collectLeafPartidas(rc.code, decompositions, concepts);
      const trade = matchTrade(ch.summary || '');
      chapters.push({
        code: rc.code,
        name: ch.summary || rc.code,
        trade,
        partidas,
        totalCost: partidas.reduce((s, p) => s + p.totalCost, 0)
      });
    }
    return { rootCode, rootName: findConcept(concepts, rootCode || '')?.summary || '', chapters };
  }

  function setupBC3Import() {
    const fileInput = document.getElementById('bc3-file-input');
    if (!fileInput) return;
    document.getElementById('btn-import-bc3').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';
      try {
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsText(file, 'windows-1252');
        });
        const parsed = parseBC3(text);
        const tree = buildBC3Tree(parsed);
        if (tree.chapters.length === 0) {
          App.toast('No se encontraron capítulos ni partidas en el archivo BC3', 'warning');
          return;
        }
        showBC3Preview(tree);
      } catch (err) {
        console.error('Error parsing BC3:', err);
        App.toast('Error al leer el archivo BC3', 'error');
      }
    });
  }

  function showBC3Preview(tree) {
    const totalPartidas = tree.chapters.reduce((s, ch) => s + ch.partidas.length, 0);
    const totalCost = tree.chapters.reduce((s, ch) => s + ch.totalCost, 0);

    let body = `
      <div style="margin-bottom:12px;padding:10px;background:var(--bg-secondary);border-radius:8px">
        <strong>${App.escapeHTML(tree.rootName || 'Presupuesto BC3')}</strong><br>
        <small>${tree.chapters.length} capítulos &middot; ${totalPartidas} partidas &middot; ${App.formatCurrency(totalCost)}</small>
      </div>
      <div style="max-height:400px;overflow-y:auto">`;

    for (const ch of tree.chapters) {
      body += `
        <div style="margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border)">
            <input type="checkbox" class="bc3-ch-check" data-chapter="${App.escapeHTML(ch.code)}" checked>
            <strong>${App.escapeHTML(ch.name)}</strong>
            <span class="badge badge-neutral" style="margin-left:auto">${App.escapeHTML(ch.trade)}</span>
            <small>${ch.partidas.length} uds &middot; ${App.formatCurrency(ch.totalCost)}</small>
          </div>
          <div style="padding-left:24px;font-size:0.85em">
            ${ch.partidas.slice(0, 8).map(p => `
              <div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--text-muted)">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px">${App.escapeHTML(p.summary)}</span>
                <span style="white-space:nowrap">${p.quantity} ${App.escapeHTML(p.unit)} &times; ${p.unitPrice.toFixed(2)}\u20AC = <strong>${App.formatCurrency(p.totalCost)}</strong></span>
              </div>`).join('')}
            ${ch.partidas.length > 8 ? `<div style="color:var(--text-muted);font-style:italic">...y ${ch.partidas.length - 8} más</div>` : ''}
          </div>
        </div>`;
    }
    body += '</div>';

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-exec-bc3-import">
        <i data-lucide="download"></i> Importar seleccionados
      </button>`;

    App.openModal('Importar Presupuesto BC3 (Presto)', body, footer);

    document.getElementById('btn-exec-bc3-import').addEventListener('click', () => {
      const selected = new Set();
      document.querySelectorAll('.bc3-ch-check').forEach(cb => {
        if (cb.checked) selected.add(cb.dataset.chapter);
      });
      executeBC3Import(tree.chapters.filter(ch => selected.has(ch.code)));
    });
  }

  async function executeBC3Import(chapters) {
    let count = 0;
    for (const ch of chapters) {
      for (const p of ch.partidas) {
        await DB.add('budgets', {
          category: ch.trade,
          description: `${ch.name} \u2014 ${p.summary}${p.unit ? ' (' + p.quantity + ' ' + p.unit + ')' : ''}`,
          supplierId: null,
          estimatedCost: p.totalCost,
          realCost: 0,
          profitMargin: 0,
          projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        count++;
      }
    }
    App.closeModal();
    App.toast(`Importadas ${count} partidas de ${chapters.length} capítulos`, 'success');
    loadBudgets();
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
