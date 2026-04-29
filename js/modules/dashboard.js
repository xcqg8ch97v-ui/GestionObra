/* ========================================
   Dashboard Module - Proveedores y Presupuestos
   CRUD + Comparador Visual
   ======================================== */

const DashboardModule = (() => {
// Actualizado: 2026-04-10
  const DEFAULT_TRADES = [
    'Albañilería', 'Fontanería', 'Electricidad', 'Carpintería',
    'Pintura', 'Cristalería', 'Climatización', 'Impermeabilización',
    'Estructura', 'Cimentación', 'Paisajismo', 'Seguridad', 'Otros'
  ];
  let customTrades = [];

  const SUPPLIER_STATUSES = ['Activo', 'Pendiente', 'Inactivo'];
  let projectId = null;

  async function init(pid) {
    projectId = pid;
    customTrades = await DB.getCustomCategories(projectId, 'trade');
    setupSubTabs();
    setupButtons();
    setupBC3Import();
    setupPdfImport();
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
    document.getElementById('btn-view-bc3')?.addEventListener('click', () => showBC3Tree());
    document.getElementById('btn-reset-bc3')?.addEventListener('click', () => resetBC3Import());
    checkBC3Button();
  }

  async function checkBC3Button() {
    const items = await DB.getByIndex('bc3items', 'projectId', projectId);
    const hasItems = items.length > 0;
    const btnView = document.getElementById('btn-view-bc3');
    const btnReset = document.getElementById('btn-reset-bc3');
    if (btnView) btnView.style.display = hasItems ? '' : 'none';
    if (btnReset) btnReset.style.display = hasItems ? '' : 'none';
  }

  // =============================
  // RESTABLECER IMPORTACIÓN BC3
  // =============================
  async function resetBC3Import() {
    // Primera confirmación
    const firstConfirm = confirm('⚠️ ATENCIÓN\n\n¿Estás seguro de que deseas restablecer las partidas importadas desde BC3?\n\nEsta acción eliminará:' +
      '\n- Todos los elementos BC3 importados' +
      '\n- Todas las partidas presupuestarias vinculadas a BC3' +
      '\n\nLas partidas manuales que hayas creado no se verán afectadas.');
    
    if (!firstConfirm) return;

    // Segunda confirmación - mostrar estadísticas
    const items = await DB.getByIndex('bc3items', 'projectId', projectId);
    const budgets = await DB.getAllForProject('budgets', projectId);
    const bc3Budgets = budgets.filter(b => b.bc3Code);
    
    const secondConfirm = confirm(`🗑️ CONFIRMACIÓN FINAL\n\nSe eliminarán permanentemente:\n` +
      `- ${items.length} elementos BC3\n` +
      `- ${bc3Budgets.length} partidas presupuestarias vinculadas a BC3\n\n` +
      `¿Estás completamente seguro? Esta acción NO se puede deshacer.`);
    
    if (!secondConfirm) return;

    // Proceder con la eliminación
    try {
      App.toast('Eliminando datos BC3...', 'info');
      
      // Eliminar budgets con bc3Code
      for (const budget of bc3Budgets) {
        await DB.remove('budgets', budget.id);
      }
      
      // Eliminar items BC3
      await DB.clearStore('bc3items');
      
      checkBC3Button();
      loadBudgets();
      
      App.toast(`Restablecimiento completado: ${bc3Budgets.length} partidas y ${items.length} elementos BC3 eliminados`, 'success');
    } catch (err) {
      console.error('Error al restablecer BC3:', err);
      App.toast('Error al restablecer las partidas BC3', 'error');
    }
  }

  // =============================
  // VISUALIZACIÓN JERÁRQUICA BC3
  // =============================
  async function showBC3Tree() {
    const items = await DB.getByIndex('bc3items', 'projectId', projectId);
    const byParent = {};
    items.forEach(item => {
      const key = item.parentId ?? null;
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(item);
    });
    function renderTree(parentId, nivel = 0) {
      const nodes = byParent[parentId] || [];
      if (!nodes.length) return '';
      return '<ul style="margin-left:' + (nivel * 18) + 'px;list-style:none;padding:0">' +
        nodes.map(n => `
          <li style="padding:3px 0">
            <span style="font-weight:${n.type === 'chapter' ? '700' : '400'};color:${n.type === 'chapter' ? 'var(--text-primary)' : 'var(--text-secondary)'}">
              ${App.escapeHTML(n.name || n.code)}
            </span>
            ${n.unit ? `<span style="color:var(--text-muted);font-size:12px"> · ${n.quantity} ${App.escapeHTML(n.unit)} × ${(n.unitPrice||0).toFixed(2)}€ = <b>${App.formatCurrency(n.totalCost)}</b></span>` : (n.totalCost ? `<span style="color:var(--text-muted);font-size:12px"> · <b>${App.formatCurrency(n.totalCost)}</b></span>` : '')}
            ${renderTree(n.id, nivel + 1)}
          </li>`).join('') + '</ul>';
    }
    if (!items.length) { App.toast('No hay datos BC3 importados', 'warning'); return; }
    const html = `<div style="max-height:65vh;overflow:auto;padding:4px 0">${renderTree(null)}</div>`;
    App.openModal('Estructura Presupuesto BC3', html, `<button class="btn btn-outline" onclick="App.closeModal()">Cerrar</button>`);
  }

  // ========================================
  // SUPPLIERS
  // ========================================

  let allSuppliers = [];
  let supplierFilterTrade = '__all__';
  let supplierSearchQuery = '';

  async function setupSupplierFilters() {
    const searchInput = document.getElementById('supplier-search');
    const tradeSelect = document.getElementById('supplier-trade-filter');
    if (!searchInput || !tradeSelect) return;

    // Recargar customTrades por si se añadió alguno nuevo
    customTrades = await DB.getCustomCategories(projectId, 'trade');
    const allTrades = DEFAULT_TRADES.concat(customTrades.map(c => c.name));

    // Populate trade filter options
    tradeSelect.innerHTML = '<option value="__all__">Todos los gremios</option>' +
      allTrades.map(t => `<option value="${t}">${t}</option>`).join('');

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
      const statusLabel = s.status === 'Activo' ? App.t('status_active') :
                          s.status === 'Pendiente' ? App.t('status_pending') : App.t('status_inactive');
      return `
        <tr>
          <td><strong>${App.escapeHTML(s.name)}</strong></td>
          <td>${App.escapeHTML(s.trade)}</td>
          <td>${App.escapeHTML(s.contact || '-')}</td>
          <td>${App.escapeHTML(s.phone || '-')}</td>
          <td><span class="badge ${statusClass}">${statusLabel}</span></td>
          <td>
            <div class="action-btns">
              <button class="action-btn" onclick="DashboardModule.editSupplier(${s.id})" title="${App.t('edit')}">
                <i data-lucide="pencil"></i>
              </button>
              <button class="action-btn delete" onclick="DashboardModule.deleteSupplier(${s.id})" title="${App.t('delete')}">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  }

  async function openSupplierForm(supplier = null) {
    const isEdit = !!supplier;
    const title = isEdit ? App.t('edit_supplier') : App.t('new_supplier');

    // Recargar customTrades por si se añadió alguno nuevo
    customTrades = await DB.getCustomCategories(projectId, 'trade');
    const allTrades = DEFAULT_TRADES.concat(customTrades.map(c => c.name));

    const body = `
      <div class="form-group">
        <label>${App.t('company')} *</label>
        <input type="text" id="sup-name" value="${isEdit ? App.escapeHTML(supplier.name) : ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>${App.t('trade')} *</label>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="sup-trade">
              ${allTrades.map(t => `<option value="${t}" ${isEdit && supplier.trade === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-xs btn-outline" id="btn-add-custom-trade" title="${App.t('add_trade')}"><i data-lucide="plus"></i></button>
          </div>
        </div>
        <div class="form-group">
          <label>${App.t('status')}</label>
          <select id="sup-status">
            ${SUPPLIER_STATUSES.map(s => `<option value="${s}" ${isEdit && supplier.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>${App.t('contact_person')}</label>
        <input type="text" id="sup-contact" value="${isEdit ? App.escapeHTML(supplier.contact || '') : ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>${App.t('phone')}</label>
          <input type="tel" id="sup-phone" value="${isEdit ? App.escapeHTML(supplier.phone || '') : ''}">
        </div>
        <div class="form-group">
          <label>${App.t('email')}</label>
          <input type="email" id="sup-email" value="${isEdit ? App.escapeHTML(supplier.email || '') : ''}">
        </div>
      </div>
      <div class="form-group">
        <label>${App.t('notes')}</label>
        <textarea id="sup-notes">${isEdit ? App.escapeHTML(supplier.notes || '') : ''}</textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">${App.t('cancel')}</button>
      <button class="btn btn-primary" id="btn-save-supplier">
        <i data-lucide="save"></i> ${isEdit ? App.t('save') : App.t('create')}
      </button>
    `;

    App.openModal(title, body, footer);

    // Botón para añadir gremio personalizado
    document.getElementById('btn-add-custom-trade').addEventListener('click', async () => {
      const name = await App.prompt(App.t('new_trade_name_prompt'), '', { title: App.t('add_trade') });
      if (!name) return;
      const exists = allTrades.some(t => t.toLowerCase() === name.trim().toLowerCase());
      if (exists) { App.toast(App.t('trade_already_exists'), 'warning'); return; }
      await DB.addCustomCategory(projectId, 'trade', name.trim());
      customTrades = await DB.getCustomCategories(projectId, 'trade');
      const newAllTrades = DEFAULT_TRADES.concat(customTrades.map(c => c.name));
      const select = document.getElementById('sup-trade');
      select.innerHTML = newAllTrades.map(t => `<option value="${t}">${t}</option>`).join('');
      select.value = name.trim();
      App.toast(App.t('trade_added'), 'success');
    });

    document.getElementById('btn-save-supplier').addEventListener('click', async () => {
      const data = {
        name: document.getElementById('sup-name').value.trim(),
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
        App.toast(App.t('supplier_updated'), 'success');
      } else {
        data.createdAt = new Date().toISOString();
        data.projectId = projectId;
        await DB.add('suppliers', data);
        App.toast(App.t('supplier_created'), 'success');
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
    if (!await App.confirm(App.t('confirm_delete_supplier'))) return;
    await DB.remove('suppliers', id);
    App.toast(App.t('supplier_deleted'), 'info');
    loadSuppliers();
  }

  // ========================================
  // BUDGETS
  // ========================================

  let _allBudgets = [];

  async function loadBudgets() {
    _allBudgets = await DB.getAllForProject('budgets', projectId);
    populateBudgetCategoryFilter(_allBudgets);
    applyBudgetFilter();
  }

  function populateBudgetCategoryFilter(budgets) {
    const sel = document.getElementById('budget-filter-category');
    if (!sel) return;
    const cats = ['__all__', ...new Set(budgets.map(b => b.category).filter(Boolean).sort())];
    const current = sel.value;
    sel.innerHTML = cats.map(c =>
      `<option value="${App.escapeHTML(c)}">${c === '__all__' ? 'Todos los gremios' : App.escapeHTML(c)}</option>`
    ).join('');
    if (cats.includes(current)) sel.value = current;
    // Conectar evento si aún no está conectado
    if (!sel.dataset.bound) {
      sel.addEventListener('change', () => applyBudgetFilter());
      sel.dataset.bound = 'true';
    }
  }

  function applyBudgetFilter() {
    const sel = document.getElementById('budget-filter-category');
    const viewSel = document.getElementById('budget-view-mode');
    const cat = sel ? sel.value : '__all__';
    const viewMode = viewSel ? viewSel.value : 'list';
    const filtered = cat === '__all__' ? _allBudgets : _allBudgets.filter(b => b.category === cat);
    renderBudgets(filtered, cat === '__all__' ? null : cat, viewMode);

    if (viewSel && !viewSel.dataset.bound) {
      viewSel.addEventListener('change', () => applyBudgetFilter());
      viewSel.dataset.bound = 'true';
    }
  }

  async function renderBudgets(budgets, filterLabel = null, viewMode = 'list') {
    const tbody = document.getElementById('budgets-tbody');
    const emptyState = document.getElementById('budgets-empty');
    const table = document.getElementById('budgets-table');
    const categoryCards = document.getElementById('budget-category-cards');

    if (budgets.length === 0) {
      table.style.display = 'none';
      categoryCards.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    table.style.display = 'table';
    categoryCards.style.display = 'flex';
    emptyState.style.display = 'none';

    // Calcular resúmenes por categoría
    const categorySummary = {};
    budgets.forEach(b => {
      const cat = b.category || App.t('overview_no_category');
      if (!categorySummary[cat]) {
        categorySummary[cat] = {
          count: 0,
          estimated: 0,
          real: 0
        };
      }
      categorySummary[cat].count++;
      categorySummary[cat].estimated += b.estimatedCost || 0;
      categorySummary[cat].real += b.realCost || 0;
    });

    // Renderizar tarjetas de categoría
    categoryCards.innerHTML = Object.entries(categorySummary)
      .sort((a, b) => b[1].estimated - a[1].estimated)
      .map(([cat, data]) => {
        const saving = data.estimated - data.real;
        const devClass = saving > 0 ? 'badge-positive' : saving < 0 ? 'badge-negative' : 'badge-neutral';
        const devSign = saving > 0 ? '+' : '';
        return `
          <div class="budget-cat-card">
            <div class="budget-cat-title">${App.escapeHTML(cat)}</div>
            <div class="budget-cat-stats">
              <div class="budget-cat-stat">
                <span class="budget-cat-label">Partidas</span>
                <span class="budget-cat-value">${data.count}</span>
              </div>
              <div class="budget-cat-stat">
                <span class="budget-cat-label">Previsto</span>
                <span class="budget-cat-value">${App.formatCurrency(data.estimated)}</span>
              </div>
              <div class="budget-cat-stat">
                <span class="budget-cat-label">Real</span>
                <span class="budget-cat-value">${App.formatCurrency(data.real)}</span>
              </div>
              <div class="budget-cat-stat">
                <span class="budget-cat-label">Desviación</span>
                <span class="badge ${devClass}">${devSign}${App.formatCurrency(saving)}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

    const suppliers = await DB.getAllForProject('suppliers', projectId);
    const supplierMap = {};
    suppliers.forEach(s => supplierMap[s.id] = s.name);

    const totalEstimated = budgets.reduce((s, b) => s + (b.estimatedCost || 0), 0);
    const totalReal      = budgets.reduce((s, b) => s + (b.realCost      || 0), 0);
    // Ahorro = previsto - real (positivo = gastamos menos de lo previsto)
    const totalSaving    = totalEstimated - totalReal;
    const totalSavPct    = totalEstimated > 0 ? Math.abs((totalSaving / totalEstimated) * 100).toFixed(1) : 0;
    const devClass       = totalSaving > 0 ? 'badge-positive' : totalSaving < 0 ? 'badge-negative' : 'badge-neutral';
    const devSign        = totalSaving > 0 ? '+' : '';

    const tfoot = document.getElementById('budgets-tfoot');
    if (tfoot) {
      const label = filterLabel ? `TOTAL — ${filterLabel}` : 'TOTAL';
      tfoot.innerHTML = `
        <tr style="font-weight:700;background:var(--bg-secondary);border-top:2px solid var(--border)">
          <td colspan="2" style="padding:10px 12px">${label} (${budgets.length} partida${budgets.length !== 1 ? 's' : ''})</td>`;
      tfoot.innerHTML += `
          <td style="padding:10px 12px">${App.formatCurrency(totalEstimated)}</td>
          <td style="padding:10px 12px">${App.formatCurrency(totalReal)}</td>
          <td></td>
          <td style="padding:10px 12px"><span class="badge ${devClass}">${devSign}${App.formatCurrency(totalSaving)}</span></td>
          <td></td>
        </tr>`;
    }

    function summarizeBudgetDescription(text) {
      const raw = (text || '').replace(/\s+/g, ' ').trim();
      if (!raw) return '';
      const parts = raw.split(/[.;]\s+/).filter(Boolean);
      const first = parts[0] || raw;
      return first.length > 180 ? `${first.slice(0, 177)}...` : first;
    }

    function renderBudgetRow(b) {
      // Ahorro = previsto - real (positivo = gastamos menos de lo previsto)
      const saving = (b.estimatedCost || 0) - (b.realCost || 0);
      const savingPct = b.estimatedCost > 0 ? Math.abs((saving / b.estimatedCost) * 100).toFixed(1) : 0;
      const devClass = saving > 0 ? 'badge-positive' : saving < 0 ? 'badge-negative' : 'badge-neutral';
      const devSign = saving > 0 ? '+' : '';
      const margin = b.profitMargin || 0;
      const profitAmount = b.estimatedCost > 0 ? (b.estimatedCost * margin / 100) : 0;
      const supplierNames = (b.supplierIds && b.supplierIds.length > 0)
        ? b.supplierIds.map(id => supplierMap[id] || '').filter(Boolean).join(', ')
        : (supplierMap[b.supplierId] || '—');
      const summaryDescription = summarizeBudgetDescription(b.description || '');

      const fullDescription = (b.description || '').replace(/\s+/g, ' ').trim();
      const isLong = fullDescription.length > 180;
      return `
        <tr data-budget-id="${b.id}">
          <td>
            <strong>${App.escapeHTML(b.category || App.t('overview_no_category'))}</strong>
            ${summaryDescription
              ? `
                <div class="budget-desc">
                  <span class="budget-desc-text" data-full="${App.escapeHTML(fullDescription)}">${App.escapeHTML(summaryDescription)}</span>
                  ${isLong
                    ? `<button class="budget-desc-toggle" onclick="DashboardModule.toggleBudgetDesc(${b.id}, event)" title="Ver descripción completa">
                        <i data-lucide="chevron-down"></i>
                      </button>`
                    : ''}
                </div>`
              : ''}
          </td>
          <td>${App.escapeHTML(supplierNames)}</td>
          <td>${App.formatCurrency(b.estimatedCost)}</td>
          <td>${App.formatCurrency(b.realCost)}</td>
          <td><span class="badge badge-positive">${margin}%</span></td>
          <td><span class="badge ${devClass}">${devSign}${App.formatCurrency(saving)}</span></td>
          <td>
            <div class="action-btns">
              <button class="action-btn" onclick="DashboardModule.editBudget(${b.id})" title="${App.t('edit')}">
                <i data-lucide="pencil"></i>
              </button>
              <button class="action-btn delete" onclick="DashboardModule.deleteBudget(${b.id})" title="${App.t('delete')}">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }

    let rowsHtml = '';
    if (viewMode === 'grouped') {
      const groups = new Map();
      for (const b of budgets) {
        const key = b.category || App.t('overview_no_category');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(b);
      }

      const sortedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
      rowsHtml = sortedGroups.map(([category, items]) => {
        const catEstimated = items.reduce((s, it) => s + (it.estimatedCost || 0), 0);
        const catReal = items.reduce((s, it) => s + (it.realCost || 0), 0);
        const catSaving = catEstimated - catReal;
        const catDevClass = catSaving > 0 ? 'badge-positive' : catSaving < 0 ? 'badge-negative' : 'badge-neutral';
        const catSign = catSaving > 0 ? '+' : '';
        return `
          <tr class="budget-group-row">
            <td colspan="7">
              <div class="budget-group-head">
                <span>${App.escapeHTML(category)}</span>
                <span>${items.length} partida${items.length !== 1 ? 's' : ''} · ${App.formatCurrency(catEstimated)} · <span class="badge ${catDevClass}">${catSign}${App.formatCurrency(catSaving)}</span></span>
              </div>
            </td>
          </tr>
          ${items.map(renderBudgetRow).join('')}
        `;
      }).join('');
    } else {
      rowsHtml = budgets.map(renderBudgetRow).join('');
    }

    tbody.innerHTML = rowsHtml;

    lucide.createIcons();
  }

  async function openBudgetForm(budget = null) {
    const isEdit = !!budget;
    const title = isEdit ? App.t('edit_budget') : App.t('new_budget');

    // Recargar customTrades por si se añadió alguno nuevo
    customTrades = await DB.getCustomCategories(projectId, 'trade');
    const allTrades = DEFAULT_TRADES.concat(customTrades.map(c => c.name));

    const suppliers = await DB.getAllForProject('suppliers', projectId);
    const selectedSupplierIds = isEdit
      ? (budget.supplierIds || (budget.supplierId ? [budget.supplierId] : []))
      : [];

    const body = `
      <div class="form-group">
        <label>${App.t('budget_category')} *</label>
        <div style="display:flex;gap:8px;align-items:center">
          <select id="bud-category">
            ${allTrades.map(t => `<option value="${t}" ${isEdit && budget.category === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-xs btn-outline" id="btn-add-custom-budget-cat" title="${App.t('add_category')}"><i data-lucide="plus"></i></button>
        </div>
      </div>
      <div class="form-group">
        <label>${App.t('description')}</label>
        <input type="text" id="bud-description" value="${isEdit ? App.escapeHTML(budget.description || '') : ''}" placeholder="${App.t('budget_description_placeholder')}">
      </div>
      <div class="form-group">
        <label>Proveedores</label>
        ${suppliers.length === 0
          ? `<p style="color:var(--text-muted);font-size:13px">No hay proveedores. <a href="#" onclick="App.navigateTo('dashboard');App.closeModal()">Añadir proveedor</a></p>`
          : `<div style="display:flex;flex-direction:column;gap:4px;max-height:150px;overflow-y:auto;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary)">
              ${suppliers.map(s => `
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;padding:4px 2px;border-radius:4px" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                  <input type="checkbox" class="bud-supplier-check" value="${s.id}" ${selectedSupplierIds.includes(s.id) ? 'checked' : ''} style="width:15px;height:15px;flex-shrink:0;cursor:pointer">
                  <span style="flex:1"><strong>${App.escapeHTML(s.name)}</strong> <span style="color:var(--text-muted);font-size:11px">${App.escapeHTML(s.trade)}</span></span>
                </label>`).join('')}
            </div>`}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>${App.t('estimated_cost')} (€) *</label>
          <input type="number" id="bud-estimated" min="0" step="0.01" value="${isEdit ? budget.estimatedCost : ''}">
        </div>
        <div class="form-group">
          <label>${App.t('actual_cost')} (€)</label>
          <input type="number" id="bud-real" min="0" step="0.01" value="${isEdit ? (budget.realCost ?? 0) : '0'}">
        </div>
      </div>
      <div class="form-group">
        <label>${App.t('target_profit')} (%)</label>
        <input type="number" id="bud-profit-margin" min="0" max="100" step="0.1" value="${isEdit ? (budget.profitMargin || 0) : '0'}" placeholder="${App.t('percentage_example')}">
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">${App.t('cancel')}</button>
      <button class="btn btn-primary" id="btn-save-budget">
        <i data-lucide="save"></i> ${isEdit ? App.t('save') : App.t('create')}
      </button>
    `;

    App.openModal(title, body, footer);

    // Botón para añadir categoría personalizada
    document.getElementById('btn-add-custom-budget-cat').addEventListener('click', async () => {
      const name = await App.prompt(App.t('new_category_name_prompt'), '', { title: App.t('add_category') });
      if (!name) return;
      const exists = allTrades.some(t => t.toLowerCase() === name.trim().toLowerCase());
      if (exists) { App.toast(App.t('category_already_exists'), 'warning'); return; }
      await DB.addCustomCategory(projectId, 'trade', name.trim());
      customTrades = await DB.getCustomCategories(projectId, 'trade');
      const newAllTrades = DEFAULT_TRADES.concat(customTrades.map(c => c.name));
      const select = document.getElementById('bud-category');
      select.innerHTML = newAllTrades.map(t => `<option value="${t}">${t}</option>`).join('');
      select.value = name.trim();
      App.toast('Categoría añadida', 'success');
    });

    document.getElementById('btn-save-budget').addEventListener('click', async () => {
      const estimated = parseFloat(document.getElementById('bud-estimated').value);
      if (isNaN(estimated)) {
        App.toast(App.t('estimated_cost_required'), 'warning');
        return;
      }

      const checkedSuppliers = [...document.querySelectorAll('.bud-supplier-check:checked')].map(cb => parseInt(cb.value));
      const data = {
        category: document.getElementById('bud-category').value,
        description: document.getElementById('bud-description').value.trim(),
        supplierId: checkedSuppliers[0] || null,
        supplierIds: checkedSuppliers,
        estimatedCost: estimated,
        realCost: parseFloat(document.getElementById('bud-real').value.replace(',', '.')) || 0,
        profitMargin: parseFloat(document.getElementById('bud-profit-margin').value) || 0,
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = budget.id;
        data.projectId = budget.projectId;
        data.createdAt = budget.createdAt;
        await DB.put('budgets', data);
        App.toast(App.t('budget_updated'), 'success');
      } else {
        data.createdAt = new Date().toISOString();
        data.projectId = projectId;
        await DB.add('budgets', data);
        App.toast(App.t('budget_created'), 'success');
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
    if (!await App.confirm(App.t('confirm_delete_budget'))) return;
    await DB.remove('budgets', id);
    App.toast(App.t('budget_deleted'), 'info');
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
          <p>${App.t('dashboard_add_budgets_hint')}</p>
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
            <span>${count} partida${count !== 1 ? 's' : ''}</span>
            <span>${supplierCount} proveedor${supplierCount !== 1 ? 'es' : ''}</span>
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
    const supplierCount = new Set(sorted.flatMap(b => b.supplierIds && b.supplierIds.length ? b.supplierIds : (b.supplierId ? [b.supplierId] : []))).size;
    headerEl.innerHTML = `
      <button class="comp-back-btn" id="comp-back-btn">
        <i data-lucide="arrow-left" style="width:16px;height:16px"></i>
        Volver a gremios
      </button>
      <h3>${App.escapeHTML(comparatorTrade)}</h3>
      <span class="comp-detail-count">${sorted.length} partida${sorted.length !== 1 ? 's' : ''} · ${supplierCount} proveedor${supplierCount !== 1 ? 'es' : ''}</span>
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
  // PDF IMPORT (Presupuestos, Facturas, Albaranes)
  // ========================================

  function setupPdfImport() {
    const btn = document.getElementById('btn-import-pdf');
    const input = document.getElementById('pdf-import-input');
    if (!btn || !input) return;

    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      input.value = '';

      App.toast('Analizando PDF…', 'info');
      try {
        const arrayBuffer = await file.arrayBuffer();
        const parsed = await PdfParserModule.parse(arrayBuffer);
        showPdfResultsModal(parsed, file.name);
      } catch (err) {
        console.error('Error parsing PDF:', err);
        App.toast('No se pudo analizar el PDF', 'error');
      }
    });
  }

  async function showPdfResultsModal(parsed, fileName) {
    const typeLabels = { presupuesto: 'Presupuesto / Oferta', factura: 'Factura', albaran: 'Albarán' };
    const typeLabel = typeLabels[parsed.type] || parsed.type;

    const existingSuppliers = await DB.getAllForProject('suppliers', projectId);

    // Build items table
    let itemsHTML = '';
    if (parsed.items && parsed.items.length > 0) {
      const rows = parsed.items.map((it, i) => {
        const amt = it.amount != null ? App.formatCurrency(it.amount) : (it.quantity != null ? `${it.quantity} ${it.unit || ''}` : '-');
        return `<tr>
          <td><input type="checkbox" class="pdf-item-check" data-idx="${i}" checked></td>
          <td>${App.escapeHTML(it.description)}</td>
          <td style="text-align:right">${amt}</td>
        </tr>`;
      }).join('');
      itemsHTML = `
        <div class="pdf-results-section">
          <h4><i data-lucide="list"></i> Líneas detectadas (${parsed.items.length})</h4>
          <div class="pdf-items-table-wrap">
            <table class="data-table pdf-items-table">
              <thead><tr><th style="width:30px"><input type="checkbox" id="pdf-check-all" checked></th><th>Descripción</th><th style="text-align:right">Importe</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }

    // Totals section
    let totalsHTML = '';
    if (parsed.type === 'factura') {
      totalsHTML = `<div class="pdf-results-row">
        ${parsed.baseImponible ? `<div class="pdf-kv"><span class="pdf-label">Base Imponible</span><span>${App.formatCurrency(parsed.baseImponible)}</span></div>` : ''}
        ${parsed.iva ? `<div class="pdf-kv"><span class="pdf-label">IVA ${parsed.ivaPercent || ''}%</span><span>${App.formatCurrency(parsed.iva)}</span></div>` : ''}
        ${parsed.total ? `<div class="pdf-kv"><span class="pdf-label">Total</span><span class="pdf-total">${App.formatCurrency(parsed.total)}</span></div>` : ''}
      </div>`;
    } else if (parsed.total) {
      totalsHTML = `<div class="pdf-results-row">
        <div class="pdf-kv"><span class="pdf-label">Total</span><span class="pdf-total">${App.formatCurrency(parsed.total)}</span></div>
      </div>`;
    }

    // Reference line
    const ref = parsed.reference || parsed.invoiceNumber || parsed.deliveryNumber || '';

    // Supplier match dropdown
    const supplierOptions = existingSuppliers.map(s =>
      `<option value="${s.id}">${App.escapeHTML(s.name)} (${App.escapeHTML(s.trade)})</option>`
    ).join('');

    const body = `
      <div class="pdf-results">
        <div class="pdf-results-badge">${App.escapeHTML(typeLabel)}</div>
        <div class="pdf-results-file"><i data-lucide="file"></i> ${App.escapeHTML(fileName)}</div>

        <div class="pdf-results-section">
          <h4><i data-lucide="building-2"></i> Datos del proveedor</h4>
          <div class="form-row">
            <div class="form-group">
              <label>Empresa</label>
              <input type="text" id="pdf-sup-name" value="${App.escapeHTML(parsed.supplierName)}">
            </div>
            <div class="form-group">
              <label>NIF/CIF</label>
              <input type="text" id="pdf-sup-nif" value="${App.escapeHTML(parsed.nif)}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Teléfono</label>
              <input type="tel" id="pdf-sup-phone" value="${App.escapeHTML(parsed.phone)}">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="pdf-sup-email" value="${App.escapeHTML(parsed.email)}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Fecha</label>
              <input type="text" id="pdf-date" value="${App.escapeHTML(parsed.date)}">
            </div>
            <div class="form-group">
              <label>Referencia</label>
              <input type="text" id="pdf-ref" value="${App.escapeHTML(ref)}">
            </div>
          </div>
        </div>

        ${totalsHTML}
        ${itemsHTML}

        <div class="pdf-results-section">
          <h4><i data-lucide="settings"></i> Acciones</h4>
          <div class="pdf-actions-checks">
            <label class="pdf-action-label">
              <input type="checkbox" id="pdf-act-create-supplier" checked>
              Crear nuevo proveedor
            </label>
            <label class="pdf-action-label">
              <input type="checkbox" id="pdf-act-create-budgets" ${parsed.items.length ? 'checked' : ''}>
              Crear partidas presupuestarias con las líneas
            </label>
            <label class="pdf-action-label">
              <input type="checkbox" id="pdf-act-associate">
              Asociar a proveedor existente
            </label>
            <select id="pdf-existing-supplier" class="filter-select" style="margin-left:24px;display:none">
              <option value="">— Seleccionar proveedor —</option>
              ${supplierOptions}
            </select>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-pdf-apply">
        <i data-lucide="check"></i> Aplicar
      </button>
    `;

    App.openModal('Importar PDF — ' + typeLabel, body, footer);

    // Toggle supplier creation vs association
    const createCheck = document.getElementById('pdf-act-create-supplier');
    const assocCheck = document.getElementById('pdf-act-associate');
    const existingSelect = document.getElementById('pdf-existing-supplier');

    createCheck.addEventListener('change', () => {
      if (createCheck.checked) { assocCheck.checked = false; existingSelect.style.display = 'none'; }
    });
    assocCheck.addEventListener('change', () => {
      if (assocCheck.checked) { createCheck.checked = false; existingSelect.style.display = 'block'; }
      else { existingSelect.style.display = 'none'; }
    });

    // Check-all toggle
    const checkAll = document.getElementById('pdf-check-all');
    if (checkAll) {
      checkAll.addEventListener('change', () => {
        document.querySelectorAll('.pdf-item-check').forEach(cb => cb.checked = checkAll.checked);
      });
    }

    // Apply button
    document.getElementById('btn-pdf-apply').addEventListener('click', async () => {
      await applyPdfImport(parsed);
    });
  }

  async function applyPdfImport(parsed) {
    const createSupplier = document.getElementById('pdf-act-create-supplier').checked;
    const createBudgets = document.getElementById('pdf-act-create-budgets').checked;
    const associate = document.getElementById('pdf-act-associate').checked;
    const existingSupplierId = parseInt(document.getElementById('pdf-existing-supplier').value) || null;

    let supplierId = null;

    // Create or find supplier
    if (createSupplier) {
      const name = document.getElementById('pdf-sup-name').value.trim();
      if (!name) { App.toast('El nombre del proveedor es obligatorio', 'warning'); return; }

      // Auto-detect trade from items
      const allText = (parsed.items || []).map(it => it.description).join(' ');
      const trade = matchTrade(allText);

      const supplierData = {
        name,
        trade,
        status: 'Activo',
        contact: '',
        phone: document.getElementById('pdf-sup-phone').value.trim(),
        email: document.getElementById('pdf-sup-email').value.trim(),
        notes: `NIF: ${document.getElementById('pdf-sup-nif').value.trim()}\nRef: ${document.getElementById('pdf-ref').value.trim()}\nFecha: ${document.getElementById('pdf-date').value.trim()}`,
        projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      supplierId = await DB.add('suppliers', supplierData);
      App.toast('Proveedor creado: ' + name, 'success');
    } else if (associate && existingSupplierId) {
      supplierId = existingSupplierId;
    }

    // Create budget items
    if (createBudgets && parsed.items && parsed.items.length > 0) {
      const checkedIdxs = new Set();
      document.querySelectorAll('.pdf-item-check:checked').forEach(cb => {
        checkedIdxs.add(parseInt(cb.dataset.idx));
      });

      let count = 0;
      for (const [i, item] of parsed.items.entries()) {
        if (!checkedIdxs.has(i)) continue;
        const amount = item.amount || 0;
        const trade = matchTrade(item.description);

        await DB.add('budgets', {
          category: trade,
          description: item.description,
          supplierId: supplierId,
          estimatedCost: amount,
          realCost: 0,
          profitMargin: 0,
          projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        count++;
      }
      if (count) App.toast(`${count} partida(s) creada(s)`, 'success');
    }

    App.closeModal();
    loadSuppliers();
    loadBudgets();
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

  function findDecomposition(decompositions, code) {
    const base = normCode(code || '');
    return decompositions[code]
      || decompositions[base]
      || decompositions[base + '#']
      || decompositions[base + '##']
      || null;
  }

  function parseBC3(text) {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Split into records: each starts with ~LETTER|
    // PERO los registros ~T pueden ser multilinea - terminan con |\n o |\r\n
    const concepts = {};
    const decompositions = {};
    const texts = {};

    // Parse record by record, handling multiline ~T records
    const recordRegex = /~[A-Za-z]\|[^~]*/g;
    let match;
    while ((match = recordRegex.exec(normalized)) !== null) {
      let raw = match[0];
      // Remove trailing newline but preserve internal ones for ~T
      raw = raw.replace(/\n+$/, '');
      if (raw.length < 3) continue;
      const typeChar = raw.charAt(1).toUpperCase();
      // Find content after ~X|
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
          // BC3 estándar: precio en fields[3]; Presto pone fecha en fields[3] y precio en fields[4]
          const f3 = (fields[3] || '').trim();
          const f4 = (fields[4] || '').trim();
          const f5 = (fields[5] || '').trim(); // Campo adicional (tipo/porcentaje)
          const price3 = parseFloat(f3.split('\\')[0]) || 0;
          const price4 = parseFloat(f4.split('\\')[0]) || 0;
          // Detectar formato Presto: si f3 es fecha (DDMMYY) o está vacío, usar f4
          const isDate = /^\d{6}$/.test(f3.replace(/\//g, ''));
          const priceField = (isDate || f3 === '' || (price3 === 0 && price4 > 0)) ? f4 : f3;
          const prices = priceField ? priceField.split('\\').map(p => parseFloat(p) || 0) : [0];
          concepts[code] = { 
            code, 
            unit, 
            summary, 
            price: prices[0] || 0,
            priceDate: isDate ? f3 : null,
            auxField: f5,
            isRoot, 
            isChapter 
          };
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
          // For ~T, join remaining fields as the text may contain | characters
          // Actually in BC3, the text is in field[1] but can have newlines
          let longText = (fields[1] || '').trim();
          // Also append any additional fields that might be part of the text
          if (fields.length > 2) {
            longText += '|' + fields.slice(2).join('|');
          }
          if (code && longText) texts[code] = longText.replace(/\n/g, ' '); // normalize newlines to spaces
          break;
        }
      }
    }
    return { concepts, decompositions, texts };
  }


  // Nueva función: construir árbol completo de capítulos/partidas/subpartidas
  function buildBC3FullTree(parsed) {
    const { concepts, decompositions, texts } = parsed;
    // Buscar raíz
    let rootCode = null;
    for (const [code, c] of Object.entries(concepts)) {
      if (c.isRoot) { rootCode = code; break; }
    }
    if (!rootCode) {
      const allChildren = new Set();
      for (const children of Object.values(decompositions)) {
        children.forEach(c => allChildren.add(c.code));
      }
      for (const code of Object.keys(decompositions)) {
        if (!allChildren.has(code)) { rootCode = code; break; }
      }
    }

    // Helper para obtener texto largo si existe
    function getLongText(code) {
      return texts[code] || texts[code + '#'] || texts[code + '##'] || null;
    }

    // Recursivo: construye árbol
    function buildNode(code, parentQty = 1, parentChapter = null) {
      const concept = findConcept(concepts, code);
      if (!concept) return null;
      const children = findDecomposition(decompositions, code);
      // Usar texto largo (~T) si existe, sino summary (~C)
      const longText = getLongText(code);
      const displayName = longText || concept.summary || code;
      const node = {
        code,
        name: displayName,
        summary: concept.summary || code,
        shortName: concept.summary || code,
        unit: concept.unit || '',
        unitPrice: concept.price,
        priceDate: concept.priceDate,
        auxField: concept.auxField,
        quantity: parentQty,
        totalCost: Math.round((concept.price * parentQty) * 100) / 100,
        type: concept.isChapter ? 'chapter' : 'partida',
        isRoot: concept.isRoot,
        isChapter: concept.isChapter,
        chapter: parentChapter,
        children: []
      };
      if (children && children.length) {
        node.children = children
          .map(child => {
            const childQty = (parentQty || 1) * (child.factor || 1) * (child.yield || 1);
            return buildNode(child.code, childQty, parentChapter || node);
          })
          .filter(Boolean);
        // Si tiene hijos, recalcula el coste total sumando hijos
        node.totalCost = node.children.reduce((s, c) => s + c.totalCost, 0);
        // Si es capítulo, fuerza type
        if (concept.isChapter) node.type = 'chapter';
        else node.type = 'partida';
      }
      return node;
    }

    // Raíz puede tener varios capítulos
    const rootChildren = findDecomposition(decompositions, rootCode) || [];
    const chapters = rootChildren.map(rc => buildNode(rc.code, rc.yield || 1)).filter(Boolean);
    const rootLongText = getLongText(rootCode || '');
    const rootName = rootLongText || findConcept(concepts, rootCode || '')?.summary || '';
    return { rootCode, rootName, chapters };
  }

  // Extrae solo las partidas hoja (productos individuales) de todos los capítulos
  function collectLeafPartidas(chapters) {
    const partidas = [];
    function collectFromNode(node) {
      const isLeaf = !node.children || node.children.length === 0;
      if (isLeaf && node.type === 'partida') {
        partidas.push({
          code: node.code,
          name: node.name,
          summary: node.summary,
          shortName: node.shortName,
          unit: node.unit,
          unitPrice: node.unitPrice,
          priceDate: node.priceDate,
          auxField: node.auxField,
          quantity: node.quantity,
          totalCost: node.totalCost,
          chapter: node.chapter
        });
      }
      if (node.children) {
        for (const child of node.children) {
          collectFromNode(child);
        }
      }
    }
    for (const ch of chapters) {
      collectFromNode(ch);
    }
    return partidas;
  }

  // Reemplaza el buildBC3Tree por el nuevo árbol completo
  const buildBC3Tree = buildBC3FullTree;

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

  // Cuenta hojas (nodos sin hijos) recursivamente
  function countLeaves(node) {
    if (!node.children || node.children.length === 0) return 1;
    return node.children.reduce((s, c) => s + countLeaves(c), 0);
  }

  // Devuelve array plano de nodos hoja recursivamente
  function collectLeaves(node) {
    if (!node.children || node.children.length === 0) return [node];
    return node.children.flatMap(c => collectLeaves(c));
  }

  function showBC3Preview(tree) {
    const totalPartidas = tree.chapters.reduce((s, ch) => s + countLeaves(ch), 0);
    const totalCost = tree.chapters.reduce((s, ch) => s + ch.totalCost, 0);

    let body = `
      <div style="margin-bottom:12px;padding:10px;background:var(--bg-secondary);border-radius:8px">
        <strong>${App.escapeHTML(tree.rootName || 'Presupuesto BC3')}</strong><br>
        <small>${tree.chapters.length} capítulos &middot; ${totalPartidas} partidas &middot; ${App.formatCurrency(totalCost)}</small>
      </div>
      <div style="max-height:400px;overflow-y:auto">`;

    for (const ch of tree.chapters) {
      const leaves = collectLeaves(ch);
      body += `
        <div style="margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border)">
            <input type="checkbox" class="bc3-ch-check" data-chapter="${App.escapeHTML(ch.code)}" checked>
            <strong>${App.escapeHTML(ch.name)}</strong>
            <small style="margin-left:auto">${leaves.length} partidas &middot; ${App.formatCurrency(ch.totalCost)}</small>
          </div>
          <div style="padding-left:24px;font-size:0.85em">
            ${leaves.slice(0, 8).map(p => `
              <div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--text-muted)">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px">${App.escapeHTML(p.summary || p.name)}</span>
                <span style="white-space:nowrap">${p.quantity} ${App.escapeHTML(p.unit)} &times; ${(p.unitPrice||0).toFixed(2)}\u20AC = <strong>${App.formatCurrency(p.totalCost)}</strong></span>
              </div>`).join('')}
            ${leaves.length > 8 ? `<div style="color:var(--text-muted);font-style:italic">...y ${leaves.length - 8} más</div>` : ''}
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
    await DB.clearStore('bc3items');

    // Recursivo: guarda el nodo y todos sus hijos con el tipo correcto
    async function saveNode(node, parentId) {
      const isLeaf = !node.children || node.children.length === 0;
      const type = node.type || (isLeaf ? 'partida' : 'chapter');
      const id = await DB.add('bc3items', {
        projectId,
        parentId,
        code: node.code,
        name: node.name || node.summary || '',
        summary: node.summary || node.name || '',
        unit: node.unit || '',
        unitPrice: node.unitPrice || 0,
        quantity: node.quantity || 1,
        totalCost: node.totalCost || 0,
        type,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      count++;
      if (node.children && node.children.length) {
        for (const child of node.children) {
          await saveNode(child, id);
        }
      }
    }

    for (const ch of chapters) {
      await saveNode(ch, null);
    }

    // Crear/actualizar entradas en budgets por cada PARTIDA INDIVIDUAL (no capítulos)
    const existingBudgets = await DB.getAllForProject('budgets', projectId);
    let budgetsCreated = 0;
    
    // Obtener todas las partidas individuales (hojas) de los capítulos seleccionados
    const allPartidas = collectLeafPartidas(chapters);
    
    // Detectar gremio por palabras clave
    const tradeKeywords = {
      'Albañilería':       ['albañil','mamposter','tabiq','solado','paviment','revoc','enfoscado','enlucid'],
      'Fontanería':        ['fontaner','saneamiento','agua','tubería','sanitario','inodoro','grifo','plomer'],
      'Electricidad':      ['electric','iluminac','instalac eléc','cuadro','cable','enchufe','luz'],
      'Carpintería':       ['carpinter','puerta','ventana','madera','armario','tarima','parquet'],
      'Pintura':           ['pintura','barniz','lacado','revestimiento'],
      'Cristalería':       ['cristal','vidrio','mampara','espejo'],
      'Climatización':     ['climati','ventilac','calefacc','aire acondicion','hvac','aerotermia'],
      'Impermeabilización':['impermeab','cubierta','tejado','azotea'],
      'Estructura':        ['estructura','hormigón','forjado','pilar','viga','cimentación','acero'],
      'Cimentación':       ['cimentac','zapata','pilote','excavac'],
      'Paisajismo':        ['jardín','paisaj','riego','césped','árbol'],
      'Seguridad':         ['seguridad','alarma','cámara','videovigilancia']
    };
    
    for (const partida of allPartidas) {
      // Detectar gremio por palabras clave del nombre del capítulo padre
      const chName = partida.chapter?.name || '';
      const chShortName = partida.chapter?.shortName || '';
      const nameLower = (chName + ' ' + chShortName).toLowerCase();
      let trade = 'Otros';
      outer: for (const [t, kws] of Object.entries(tradeKeywords)) {
        for (const kw of kws) {
          if (nameLower.includes(kw)) { trade = t; break outer; }
        }
      }
      
      // Construir descripción detallada
      let description = `${chShortName || chName} — ${partida.name}`;
      if (partida.unit) {
        description += ` (${partida.quantity} ${partida.unit})`;
      }
      // Añadir fecha de precio si existe (formato Presto: DDMMYY)
      if (partida.priceDate) {
        const d = partida.priceDate;
        if (d.length === 6) {
          description += ` [Precio ${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4,6)}]`;
        } else if (d.includes('/')) {
          description += ` [Precio ${d}]`;
        }
      }
      
      // Si ya existe una partida con el mismo código BC3, actualizar
      const existing = existingBudgets.find(b => b.bc3Code === partida.code);
      if (existing) {
        await DB.put('budgets', { 
          ...existing, 
          name: partida.shortName || partida.name,
          description: description,
          category: trade,
          estimatedCost: partida.totalCost,
          bc3PriceDate: partida.priceDate,
          bc3AuxField: partida.auxField,
          updatedAt: new Date().toISOString() 
        });
      } else {
        await DB.add('budgets', {
          projectId,
          category: trade,
          name: partida.shortName || partida.name,
          description: description,
          bc3Code: partida.code,
          bc3PriceDate: partida.priceDate,
          bc3AuxField: partida.auxField,
          estimatedCost: Math.round(partida.totalCost * 100) / 100,
          realCost: 0,
          profitMargin: 0,
          supplierId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        budgetsCreated++;
      }
    }

    App.closeModal();
    App.toast(`BC3 importado: ${count} elementos · ${budgetsCreated} partidas individuales creadas`, 'success');
    checkBC3Button();
    loadBudgets();
  }

  function toggleBudgetDesc(id, event) {
    event.stopPropagation();
    const row = document.querySelector(`tr[data-budget-id="${id}"]`);
    if (!row) return;
    const textSpan = row.querySelector('.budget-desc-text');
    const btn = row.querySelector('.budget-desc-toggle');
    const icon = btn?.querySelector('i');
    if (!textSpan || !btn || !icon) return;
    const isExpanded = textSpan.classList.contains('expanded');
    if (isExpanded) {
      textSpan.textContent = textSpan.dataset.full?.slice(0, 177) + '...' || textSpan.textContent;
      textSpan.classList.remove('expanded');
      icon.setAttribute('data-lucide', 'chevron-down');
      btn.title = 'Ver descripción completa';
    } else {
      textSpan.textContent = textSpan.dataset.full || textSpan.textContent;
      textSpan.classList.add('expanded');
      icon.setAttribute('data-lucide', 'chevron-up');
      btn.title = 'Contraer descripción';
    }
    lucide.createIcons();
  }

  let currentSortField = null;
  let currentSortAsc = true;

  async function sortBudgets(field) {
    if (currentSortField === field) {
      currentSortAsc = !currentSortAsc;
    } else {
      currentSortField = field;
      currentSortAsc = true;
    }
    const budgets = await DB.getAllForProject('budgets', projectId);
    budgets.sort((a, b) => {
      let valA, valB;
      if (field === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
      } else if (field === 'estimated') {
        valA = a.estimatedCost || 0;
        valB = b.estimatedCost || 0;
      } else if (field === 'deviation') {
        valA = (a.estimatedCost || 0) - (a.realCost || 0);
        valB = (b.estimatedCost || 0) - (b.realCost || 0);
      } else {
        return 0;
      }
      if (valA < valB) return currentSortAsc ? -1 : 1;
      if (valA > valB) return currentSortAsc ? 1 : -1;
      return 0;
    });
    applyBudgetFilter(budgets);
  }

  return {
    init,
    editSupplier,
    deleteSupplier,
    editBudget,
    deleteBudget,
    showBC3Tree,
    toggleBudgetDesc,
    sortBudgets,
    refresh: () => { loadSuppliers(); loadBudgets(); }
  };
})();
