/* ========================================
   Report Module - Generación de Informes PDF
   Utiliza jsPDF + AutoTable
   ======================================== */

const ReportModule = (() => {
// Actualizado: 2026-04-13
  const PHASES = [
    'Demolición', 'Estructura', 'Albañilería', 'Fontanería',
    'Electricidad', 'Carpintería', 'Pintura', 'Acabados',
    'Limpieza', 'General'
  ];

  const SECTIONS = [
    { id: 'resumen',       label: 'Resumen ejecutivo',    icon: '📊', default: true  },
    { id: 'tareas',        label: 'Cronograma y tareas',  icon: '📅', default: true  },
    { id: 'presupuesto',   label: 'Presupuesto',          icon: '💰', default: true  },
    { id: 'gastos',        label: 'Gastos propios',       icon: '🧾', default: true  },
    { id: 'incidencias',   label: 'Incidencias y diario', icon: '⚠️', default: true  },
    { id: 'proveedores',   label: 'Proveedores',          icon: '🏗️', default: true  },
    { id: 'participantes', label: 'Participantes',        icon: '👥', default: false },
  ];

  let projectId = null;

  function init(pid) {
    projectId = pid;
    const btn = document.getElementById('btn-generate-report');
    if (btn) btn.onclick = () => openReportOptions();
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  function lighten(rgb, amount = 180) {
    return rgb.map(c => Math.min(255, c + amount));
  }

  function openReportOptions() {
    const sectionsHTML = SECTIONS.map(s => `
      <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;cursor:pointer;border:1px solid var(--border);background:var(--bg-card)">
        <input type="checkbox" class="report-section-check" value="${s.id}" ${s.default ? 'checked' : ''} style="width:16px;height:16px;flex-shrink:0;cursor:pointer">
        <span style="font-size:15px">${s.icon}</span>
        <span style="font-size:13px;font-weight:500">${s.label}</span>
      </label>`).join('');

    const body = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--text-secondary)">SECCIONES A INCLUIR</div>
          <div style="display:flex;flex-direction:column;gap:6px">${sectionsHTML}</div>
        </div>
        <div>
          <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--text-secondary)">COLOR PREDOMINANTE</div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            ${['#FFD500','#3B82F6','#10B981','#EF4444','#8B5CF6','#F97316','#06B6D4','#EC4899','#64748B'].map(c => `
              <button class="report-color-btn" data-color="${c}" style="width:30px;height:30px;border-radius:50%;background:${c};border:3px solid transparent;cursor:pointer;transition:transform .15s" title="${c}"></button>
            `).join('')}
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)">
              <input type="color" id="report-color-custom" value="#FFD500" style="width:30px;height:30px;border:none;cursor:pointer;border-radius:50%;padding:0">
              Personalizado
            </label>
          </div>
          <div style="margin-top:8px;padding:8px 12px;border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted)">
            <span id="report-color-preview" style="display:inline-block;width:16px;height:16px;border-radius:4px;background:#FFD500;flex-shrink:0"></span>
            Color seleccionado: <strong id="report-color-label">#FFD500</strong>
          </div>
        </div>
      </div>`;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-confirm-report">
        <i data-lucide="file-down"></i> Generar PDF
      </button>`;

    App.openModal('Exportar Informe PDF', body, footer, 'sm');

    let selectedColor = '#FFD500';

    function setColor(hex) {
      selectedColor = hex;
      document.getElementById('report-color-preview').style.background = hex;
      document.getElementById('report-color-label').textContent = hex;
      document.querySelectorAll('.report-color-btn').forEach(b => {
        b.style.border = b.dataset.color === hex ? '3px solid var(--text-primary)' : '3px solid transparent';
        b.style.transform = b.dataset.color === hex ? 'scale(1.2)' : 'scale(1)';
      });
    }

    setColor('#FFD500');

    document.querySelectorAll('.report-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setColor(btn.dataset.color);
        document.getElementById('report-color-custom').value = btn.dataset.color;
      });
    });

    document.getElementById('report-color-custom').addEventListener('input', e => {
      setColor(e.target.value);
      document.querySelectorAll('.report-color-btn').forEach(b => {
        b.style.border = '3px solid transparent';
        b.style.transform = 'scale(1)';
      });
    });

    document.getElementById('btn-confirm-report').addEventListener('click', () => {
      const selected = [...document.querySelectorAll('.report-section-check:checked')].map(c => c.value);
      if (selected.length === 0) { App.toast('Selecciona al menos una sección', 'warning'); return; }
      App.closeModal();
      generateReport(selected, selectedColor);
    });
  }

  async function generateReport(selectedSections, accentHex) {
    if (!projectId) return;
    App.toast('Generando informe PDF...', 'info');

    try {
      const [project, tasks, budgets, incidents, suppliers, participants, expenses] = await Promise.all([
        DB.getById('projects', projectId),
        DB.getAllForProject('tasks', projectId),
        DB.getAllForProject('budgets', projectId),
        DB.getAllForProject('incidents', projectId),
        DB.getAllForProject('suppliers', projectId),
        DB.getAllForProject('participants', projectId),
        DB.getAllForProject('expenses', projectId)
      ]);

      const has = (id) => selectedSections.includes(id);

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentW = pageW - margin * 2;
      let y = margin;

      // ── Colors ──────────────────────────────────
      const accent   = hexToRgb(accentHex);
      const accentLt = lighten(accent, 210);
      const dark     = [18, 18, 24];
      const darkMid  = [30, 30, 38];
      const gray1    = [240, 241, 245];
      const gray2    = [200, 202, 210];
      const gray3    = [100, 104, 115];
      const white    = [255, 255, 255];

      // ── Helpers ─────────────────────────────────
      function checkPage(needed = 20) {
        if (y + needed > pageH - 18) { doc.addPage(); y = margin; addPageHeader(); }
      }

      function addPageHeader() {
        doc.setFillColor(...accent);
        doc.rect(0, 0, pageW, 1.5, 'F');
        doc.setFillColor(...gray1);
        doc.rect(0, 1.5, pageW, 8, 'F');
        doc.setFontSize(7.5);
        doc.setTextColor(...gray3);
        doc.setFont('helvetica', 'normal');
        doc.text((project.name || '').toUpperCase(), margin, 7);
        doc.text(`Informe generado · ${new Date().toLocaleDateString('es-ES')}`, pageW - margin, 7, { align: 'right' });
        y = 16;
      }

      function addFooter() {
        const n = doc.internal.getNumberOfPages();
        for (let i = 2; i <= n; i++) {
          doc.setPage(i);
          doc.setFillColor(...gray1);
          doc.rect(0, pageH - 10, pageW, 10, 'F');
          doc.setFontSize(7.5);
          doc.setTextColor(...gray3);
          doc.text('Abessis · Gestión de Obra', margin, pageH - 4);
          doc.text(`${i - 1} / ${n - 1}`, pageW - margin, pageH - 4, { align: 'right' });
        }
      }

      function sectionHeader(text, subtitle = '') {
        checkPage(22);
        doc.setFillColor(...accent);
        doc.rect(margin, y, 3, subtitle ? 12 : 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...dark);
        doc.text(text, margin + 7, y + (subtitle ? 5.5 : 5.5));
        if (subtitle) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(...gray3);
          doc.text(subtitle, margin + 7, y + 10);
        }
        y += subtitle ? 18 : 13;
        doc.setDrawColor(...gray2);
        doc.setLineWidth(0.3);
        doc.line(margin, y - 3, pageW - margin, y - 3);
        y += 2;
      }

      function kpiRow(items) {
        checkPage(22);
        const w = contentW / items.length;
        items.forEach((item, i) => {
          const x = margin + w * i;
          doc.setFillColor(...gray1);
          doc.roundedRect(x + 1, y, w - 3, 18, 2, 2, 'F');
          doc.setFontSize(7.5);
          doc.setTextColor(...gray3);
          doc.setFont('helvetica', 'normal');
          doc.text(item.label.toUpperCase(), x + w / 2, y + 5.5, { align: 'center' });
          doc.setFontSize(13);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...(item.color || dark));
          doc.text(String(item.value), x + w / 2, y + 14, { align: 'center' });
        });
        y += 24;
      }

      function progressBar(label, pct, color = accent) {
        checkPage(12);
        doc.setFontSize(9);
        doc.setTextColor(...dark);
        doc.setFont('helvetica', 'normal');
        doc.text(label, margin, y + 3.5);
        doc.setFontSize(8.5);
        doc.setTextColor(...gray3);
        doc.text(`${pct}%`, pageW - margin, y + 3.5, { align: 'right' });
        const barX = margin;
        const barY = y + 5.5;
        const barW = contentW;
        const barH = 4;
        doc.setFillColor(...gray2);
        doc.roundedRect(barX, barY, barW, barH, 1.5, 1.5, 'F');
        if (pct > 0) {
          doc.setFillColor(...color);
          doc.roundedRect(barX, barY, Math.max(3, barW * pct / 100), barH, 1.5, 1.5, 'F');
        }
        y += 13;
      }

      function emptyNote(text) {
        doc.setFontSize(9);
        doc.setTextColor(...gray3);
        doc.setFont('helvetica', 'italic');
        doc.text(text, margin, y);
        y += 8;
      }

      function autoTableStyled(opts) {
        doc.autoTable({
          ...opts,
          styles: { fontSize: 9, cellPadding: 3.5, textColor: dark, ...opts.styles },
          headStyles: { fillColor: accent, textColor: dark, fontStyle: 'bold', fontSize: 9, ...opts.headStyles },
          alternateRowStyles: { fillColor: gray1 },
          margin: { left: margin, right: margin },
          ...opts.extra
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ─────────────────────────────────────────────
      // COVER PAGE
      // ─────────────────────────────────────────────
      doc.setFillColor(...dark);
      doc.rect(0, 0, pageW, pageH, 'F');

      // Accent top stripe
      doc.setFillColor(...accent);
      doc.rect(0, 0, pageW, 4, 'F');

      // Decorative side bar
      doc.setFillColor(...accent);
      doc.rect(0, 0, 6, pageH, 'F');

      // Logo / photo
      const photoY = 24;
      if (project.clientPhoto || project.companyLogo) {
        try {
          doc.addImage(project.clientPhoto || project.companyLogo, 'JPEG', pageW / 2 - 18, photoY, 36, 36);
        } catch(e) {}
      }

      const titleY = project.clientPhoto || project.companyLogo ? photoY + 46 : 55;

      // INFORME label
      doc.setFontSize(10);
      doc.setTextColor(...gray2);
      doc.setFont('helvetica', 'normal');
      doc.text('INFORME DE AVANCE DE OBRA', pageW / 2, titleY, { align: 'center' });

      // Project name
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...white);
      const projectNameLines = doc.splitTextToSize(project.name || 'Sin nombre', contentW - 20);
      doc.text(projectNameLines, pageW / 2, titleY + 10, { align: 'center' });

      const afterTitle = titleY + 10 + projectNameLines.length * 9;

      // Client
      if (project.client) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray2);
        doc.text(project.client, pageW / 2, afterTitle + 4, { align: 'center' });
      }

      // Date
      doc.setFontSize(9.5);
      doc.setTextColor(...gray3);
      doc.text(new Date().toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }), pageW / 2, afterTitle + (project.client ? 14 : 8), { align: 'center' });

      // Cover KPI cards
      const completedTasks   = tasks.filter(t => (t.progress || 0) >= 100).length;
      const taskProgress     = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
      const totalEstimated   = budgets.reduce((s, b) => s + (b.estimatedCost || 0), 0);
      const totalReal        = budgets.reduce((s, b) => s + (b.realCost || 0), 0);
      const totalExpenses    = expenses.reduce((s, e) => s + (e.amount || 0), 0);
      const pendingIncidents = incidents.filter(i => i.status === 'pending').length;

      const cvKpiY = 175;
      const kpis   = [
        { label: 'PROGRESO',     value: taskProgress + '%' },
        { label: 'TAREAS',       value: `${completedTasks}/${tasks.length}` },
        { label: 'PRESUPUESTO',  value: fmtCurrency(totalEstimated) },
        { label: 'COSTE REAL',   value: fmtCurrency(totalReal + totalExpenses) },
        { label: 'INCIDENCIAS',  value: String(pendingIncidents) + ' pend.' },
        { label: 'PROVEEDORES',  value: String(suppliers.length) },
      ];
      const kW = contentW / 3;
      kpis.forEach((k, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const kx = margin + kW * col;
        const ky = cvKpiY + row * 26;
        doc.setFillColor(28, 28, 36);
        doc.roundedRect(kx + 1, ky, kW - 3, 22, 2, 2, 'F');
        doc.setFillColor(...accent);
        doc.roundedRect(kx + 1, ky, 3, 22, 1, 1, 'F');
        doc.setFontSize(7);
        doc.setTextColor(...gray3);
        doc.setFont('helvetica', 'normal');
        doc.text(k.label, kx + 7, ky + 7);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...accent);
        doc.text(k.value, kx + 7, ky + 16);
      });

      // Branding footer cover
      doc.setFontSize(8);
      doc.setTextColor(...gray3);
      doc.text('Generado por Abessis · Gestión de Obra', pageW / 2, pageH - 8, { align: 'center' });

      // ─────────────────────────────────────────────
      // SECTION: RESUMEN EJECUTIVO
      // ─────────────────────────────────────────────
      if (has('resumen')) {
        doc.addPage(); addPageHeader();
        const budgetDev = totalEstimated > 0
          ? Math.round(((totalEstimated - (totalReal + totalExpenses)) / totalEstimated) * 100) : 0;
        const overdueTasks = tasks.filter(t => t.endDate && new Date(t.endDate) < new Date() && (t.progress || 0) < 100).length;

        sectionHeader('Resumen Ejecutivo', `Estado general del proyecto a ${new Date().toLocaleDateString('es-ES')}`);

        kpiRow([
          { label: 'Progreso global', value: taskProgress + '%', color: taskProgress >= 75 ? [34,197,94] : taskProgress >= 40 ? [...accent] : [239,68,68] },
          { label: 'Coste previsto',  value: fmtCurrency(totalEstimated) },
          { label: 'Coste real',      value: fmtCurrency(totalReal + totalExpenses), color: (totalReal + totalExpenses) > totalEstimated ? [239,68,68] : [34,197,94] },
          { label: 'Desviación',      value: (budgetDev >= 0 ? '+' : '') + budgetDev + '%', color: budgetDev >= 0 ? [34,197,94] : [239,68,68] },
        ]);

        kpiRow([
          { label: 'Tareas completadas',  value: `${completedTasks} / ${tasks.length}` },
          { label: 'Tareas retrasadas',   value: String(overdueTasks), color: overdueTasks > 0 ? [239,68,68] : [34,197,94] },
          { label: 'Incidencias pend.',   value: String(pendingIncidents), color: pendingIncidents > 0 ? [217,119,6] : [34,197,94] },
          { label: 'Proveedores',         value: String(suppliers.length) },
        ]);

        // Progress bar global
        checkPage(20);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...dark);
        doc.text('Progreso global de obra', margin, y);
        y += 5;
        progressBar('Completado', taskProgress, accent);

        // Phase bars
        const phases = [...new Set(tasks.map(t => t.category || 'General'))];
        if (phases.length > 0) {
          checkPage(10 + phases.length * 13);
          doc.setFontSize(9.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...dark);
          doc.text('Progreso por fase', margin, y);
          y += 5;
          phases.forEach(ph => {
            const pts = tasks.filter(t => (t.category || 'General') === ph);
            const avg = Math.round(pts.reduce((s, t) => s + (t.progress || 0), 0) / pts.length);
            progressBar(`${ph} (${pts.length} tar.)`, avg, accent);
          });
        }

        // Description / notes
        if (project.description) {
          checkPage(20);
          doc.setFontSize(9.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...dark);
          doc.text('Descripción del proyecto', margin, y);
          y += 5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...gray3);
          const lines = doc.splitTextToSize(project.description, contentW);
          doc.text(lines, margin, y);
          y += lines.length * 4.5 + 6;
        }
      }

      // ─────────────────────────────────────────────
      // SECTION: TAREAS
      // ─────────────────────────────────────────────
      if (has('tareas') && tasks.length > 0) {
        doc.addPage(); addPageHeader();
        const overdue   = tasks.filter(t => t.endDate && new Date(t.endDate) < new Date() && (t.progress || 0) < 100).length;
        const completed = tasks.filter(t => (t.progress || 0) >= 100).length;
        const inprog    = tasks.length - completed - overdue;
        sectionHeader('Cronograma y Tareas', `${tasks.length} tareas · ${completed} completadas · ${overdue} retrasadas`);

        kpiRow([
          { label: 'Total tareas',   value: String(tasks.length) },
          { label: 'Completadas',    value: String(completed), color: [34,197,94] },
          { label: 'En curso',       value: String(inprog) },
          { label: 'Retrasadas',     value: String(overdue), color: overdue > 0 ? [239,68,68] : dark },
        ]);

        const sortedTasks = [...tasks].sort((a, b) => {
          const pi = PHASES.indexOf(a.category || 'General');
          const pj = PHASES.indexOf(b.category || 'General');
          return pi - pj || (a.startDate || '').localeCompare(b.startDate || '');
        });

        autoTableStyled({
          startY: y,
          head: [['Tarea', 'Fase', 'Inicio', 'Fin', '%', 'Estado']],
          body: sortedTasks.map(t => {
            const isOverdue = t.endDate && new Date(t.endDate) < new Date() && (t.progress || 0) < 100;
            return [
              t.name || '',
              t.category || 'General',
              fmtDate(t.startDate),
              fmtDate(t.endDate),
              (t.progress || 0) + '%',
              isOverdue ? 'Retrasada' : (t.progress || 0) >= 100 ? 'Completada' : 'En curso'
            ];
          }),
          columnStyles: { 0: { cellWidth: 48 }, 4: { halign: 'center' }, 5: { halign: 'center' } },
          extra: {
            didParseCell(data) {
              if (data.section === 'body' && data.column.index === 5) {
                if (data.cell.raw === 'Retrasada')  data.cell.styles.textColor = [239,68,68];
                if (data.cell.raw === 'Completada') data.cell.styles.textColor = [34,197,94];
              }
            }
          }
        });
      }

      // ─────────────────────────────────────────────
      // SECTION: PRESUPUESTO
      // ─────────────────────────────────────────────
      if (has('presupuesto')) {
        doc.addPage(); addPageHeader();
        const budgetDev = totalEstimated > 0 ? Math.round(((totalEstimated - totalReal) / totalEstimated) * 100) : 0;
        sectionHeader('Presupuesto', `${budgets.length} partidas · Desviación obra: ${budgetDev >= 0 ? '+' : ''}${budgetDev}%`);

        kpiRow([
          { label: 'Presupuesto previsto', value: fmtCurrency(totalEstimated) },
          { label: 'Coste partidas',       value: fmtCurrency(totalReal) },
          { label: 'Gastos propios',       value: fmtCurrency(totalExpenses), color: [217,119,6] },
          { label: 'Coste total',          value: fmtCurrency(totalReal + totalExpenses), color: (totalReal + totalExpenses) > totalEstimated ? [239,68,68] : [34,197,94] },
        ]);

        // Progress bar cost vs estimated
        if (totalEstimated > 0) {
          const pctUsed = Math.min(100, Math.round((totalReal + totalExpenses) / totalEstimated * 100));
          checkPage(18);
          doc.setFontSize(9.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...dark);
          doc.text('Ejecución presupuestaria', margin, y);
          y += 5;
          progressBar(`${fmtCurrency(totalReal + totalExpenses)} de ${fmtCurrency(totalEstimated)}`, pctUsed,
            pctUsed > 100 ? [239,68,68] : pctUsed > 80 ? [217,119,6] : [34,197,94]);
        }

        if (budgets.length > 0) {
          const devTotal = totalEstimated > 0 ? Math.round(((totalReal - totalEstimated) / totalEstimated) * 100) : 0;
          const rows = budgets.map(b => {
            const dev = (b.estimatedCost || 0) > 0
              ? Math.round(((b.realCost || 0) - (b.estimatedCost || 0)) / (b.estimatedCost || 1) * 100) : 0;
            // Usar name si existe (importado de BC3), sino description, sino category
            const displayName = b.name || b.description || b.category || '';
            return [displayName, b.category || '', fmtCurrency(b.estimatedCost || 0), fmtCurrency(b.realCost || 0), (dev >= 0 ? '+' : '') + dev + '%'];
          });
          rows.push(['TOTAL', '', fmtCurrency(totalEstimated), fmtCurrency(totalReal), (devTotal >= 0 ? '+' : '') + devTotal + '%']);

          autoTableStyled({
            startY: y,
            head: [['Partida', 'Categoría', 'Previsto', 'Real', 'Desviación']],
            body: rows,
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'center' } },
            extra: {
              didParseCell(data) {
                if (data.section === 'body') {
                  if (data.row.index === rows.length - 1) data.cell.styles.fontStyle = 'bold';
                  if (data.column.index === 4) {
                    const v = parseInt(data.cell.raw);
                    if (v > 0) data.cell.styles.textColor = [239,68,68];
                    else if (v < 0) data.cell.styles.textColor = [34,197,94];
                  }
                }
              }
            }
          });
        } else {
          emptyNote('No hay partidas presupuestarias registradas.');
        }
      }

      // ─────────────────────────────────────────────
      // SECTION: GASTOS PROPIOS
      // ─────────────────────────────────────────────
      if (has('gastos') && expenses.length > 0) {
        doc.addPage(); addPageHeader();
        const byCategory = {};
        expenses.forEach(e => { byCategory[e.category || 'Otros'] = (byCategory[e.category || 'Otros'] || 0) + (e.amount || 0); });
        const topCat = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

        sectionHeader('Gastos Propios de Obra', `${expenses.length} gastos · Total: ${fmtCurrency(totalExpenses)}`);

        kpiRow([
          { label: 'Total gastos',     value: fmtCurrency(totalExpenses), color: [217,119,6] },
          { label: 'Nº registros',     value: String(expenses.length) },
          { label: 'Categorías',       value: String(topCat.length) },
          { label: 'Mayor categoría',  value: topCat[0] ? topCat[0][0].substring(0,12) : '—' },
        ]);

        // Category bars
        checkPage(10 + topCat.length * 13);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...dark);
        doc.text('Distribución por categoría', margin, y);
        y += 5;
        topCat.forEach(([cat, amt]) => {
          const pct = totalExpenses > 0 ? Math.round(amt / totalExpenses * 100) : 0;
          checkPage(13);
          doc.setFontSize(9);
          doc.setTextColor(...dark);
          doc.setFont('helvetica', 'normal');
          doc.text(cat, margin, y + 3.5);
          doc.setTextColor(...gray3);
          doc.text(`${fmtCurrency(amt)} · ${pct}%`, pageW - margin, y + 3.5, { align: 'right' });
          const bY = y + 5.5;
          doc.setFillColor(...gray2);
          doc.roundedRect(margin, bY, contentW, 4, 1.5, 1.5, 'F');
          if (pct > 0) {
            doc.setFillColor(...accent);
            doc.roundedRect(margin, bY, Math.max(3, contentW * pct / 100), 4, 1.5, 1.5, 'F');
          }
          y += 13;
        });

        y += 4;
        const expRows = [...expenses].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(e => [
          fmtDate(e.date), e.category || '', (e.description || '').substring(0, 50), e.person || e.team || '', fmtCurrency(e.amount || 0)
        ]);
        expRows.push(['TOTAL', '', '', '', fmtCurrency(totalExpenses)]);

        autoTableStyled({
          startY: y,
          head: [['Fecha', 'Categoría', 'Descripción', 'Persona/Equipo', 'Importe']],
          body: expRows,
          columnStyles: { 4: { halign: 'right' } },
          extra: {
            didParseCell(data) {
              if (data.section === 'body' && data.row.index === expRows.length - 1) {
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        });
      }

      // ─────────────────────────────────────────────
      // SECTION: INCIDENCIAS
      // ─────────────────────────────────────────────
      if (has('incidencias')) {
        doc.addPage(); addPageHeader();
        const resolved  = incidents.filter(i => i.status === 'resolved').length;
        const inprog    = incidents.filter(i => i.status === 'in-progress').length;
        const pending   = incidents.filter(i => i.status === 'pending').length;
        sectionHeader('Incidencias y Diario', `${incidents.length} entradas · ${pending} pendientes`);

        kpiRow([
          { label: 'Total',       value: String(incidents.length) },
          { label: 'Pendientes',  value: String(pending),  color: pending > 0 ? [217,119,6] : dark },
          { label: 'En proceso',  value: String(inprog),   color: inprog > 0 ? [59,130,246] : dark },
          { label: 'Resueltas',   value: String(resolved), color: [34,197,94] },
        ]);

        const statusMap = { pending: 'Pendiente', 'in-progress': 'En proceso', resolved: 'Resuelto' };
        const sortedInc = [...incidents].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        if (sortedInc.length > 0) {
          autoTableStyled({
            startY: y,
            head: [['Fecha', 'Tipo', 'Descripción', 'Responsable', 'Estado']],
            body: sortedInc.map(i => [
              fmtDate(i.date),
              i.category || '',
              (i.description || '').substring(0, 70) + ((i.description || '').length > 70 ? '…' : ''),
              i.responsiblePerson || '',
              statusMap[i.status] || i.status || ''
            ]),
            columnStyles: { 2: { cellWidth: 55 } },
            extra: {
              didParseCell(data) {
                if (data.section === 'body' && data.column.index === 4) {
                  if (data.cell.raw === 'Pendiente')  data.cell.styles.textColor = [217,119,6];
                  if (data.cell.raw === 'En proceso') data.cell.styles.textColor = [59,130,246];
                  if (data.cell.raw === 'Resuelto')   data.cell.styles.textColor = [34,197,94];
                }
              }
            }
          });
        } else {
          emptyNote('No hay incidencias registradas.');
        }
      }

      // ─────────────────────────────────────────────
      // SECTION: PROVEEDORES
      // ─────────────────────────────────────────────
      if (has('proveedores') && suppliers.length > 0) {
        doc.addPage(); addPageHeader();
        const active  = suppliers.filter(s => s.status === 'active').length;
        const pending = suppliers.filter(s => s.status === 'pending').length;
        sectionHeader('Proveedores', `${suppliers.length} proveedores · ${active} activos`);

        kpiRow([
          { label: 'Total',      value: String(suppliers.length) },
          { label: 'Activos',    value: String(active),  color: [34,197,94] },
          { label: 'Pendientes', value: String(pending), color: pending > 0 ? [217,119,6] : dark },
          { label: 'Gremios',    value: String(new Set(suppliers.map(s => s.trade).filter(Boolean)).size) },
        ]);

        autoTableStyled({
          startY: y,
          head: [['Empresa', 'Gremio', 'Contacto', 'Teléfono', 'Estado']],
          body: suppliers.map(s => [
            s.name || '', s.trade || '', s.contact || '', s.phone || '',
            s.status === 'active' ? 'Activo' : s.status === 'pending' ? 'Pendiente' : s.status || ''
          ]),
          extra: {
            didParseCell(data) {
              if (data.section === 'body' && data.column.index === 4) {
                if (data.cell.raw === 'Activo')    data.cell.styles.textColor = [34,197,94];
                if (data.cell.raw === 'Pendiente') data.cell.styles.textColor = [217,119,6];
              }
            }
          }
        });
      }

      // ─────────────────────────────────────────────
      // SECTION: PARTICIPANTES
      // ─────────────────────────────────────────────
      if (has('participantes') && participants.length > 0) {
        doc.addPage(); addPageHeader();
        sectionHeader('Participantes', `${participants.length} personas registradas`);

        kpiRow([
          { label: 'Total',    value: String(participants.length) },
          { label: 'Internos', value: String(participants.filter(p => p.type === 'internal').length) },
          { label: 'Externos', value: String(participants.filter(p => p.type !== 'internal').length) },
          { label: 'Roles',    value: String(new Set(participants.map(p => p.role).filter(Boolean)).size) },
        ]);

        autoTableStyled({
          startY: y,
          head: [['Nombre', 'Rol', 'Empresa', 'Teléfono', 'Email', 'Tipo']],
          body: participants.map(p => [
            p.name || '', p.role || '', p.company || '', p.phone || '', p.email || '',
            p.type === 'internal' ? 'Interno' : 'Externo'
          ])
        });
      }

      // ─────────────────────────────────────────────
      // FOOTERS & SAVE
      // ─────────────────────────────────────────────
      addFooter();

      const safeName = (project.name || 'obra').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '-');
      doc.save(`informe-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
      App.toast('Informe PDF generado correctamente', 'success');

    } catch (err) {
      console.error('Error generando PDF:', err);
      App.toast('Error al generar el informe PDF', 'error');
    }
  }

  function fmtCurrency(amount) {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency', currency: 'EUR',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(amount);
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  return { init, generateReport };
})();
