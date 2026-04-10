/* ========================================
   Report Module - Generación de Informes PDF
   Utiliza jsPDF + AutoTable
   ======================================== */

const ReportModule = (() => {
// Actualizado: 2026-04-10
  const PHASES = [
    'Demolición', 'Estructura', 'Albañilería', 'Fontanería',
    'Electricidad', 'Carpintería', 'Pintura', 'Acabados',
    'Limpieza', 'General'
  ];

  let projectId = null;

  function init(pid) {
    projectId = pid;
    const btn = document.getElementById('btn-generate-report');
    if (btn) btn.onclick = () => generateReport();
  }

  async function generateReport() {
    if (!projectId) return;
    App.toast('Generando informe PDF...', 'info');

    try {
      const [project, tasks, budgets, incidents, suppliers, participants] = await Promise.all([
        DB.getById('projects', projectId),
        DB.getAllForProject('tasks', projectId),
        DB.getAllForProject('budgets', projectId),
        DB.getAllForProject('incidents', projectId),
        DB.getAllForProject('suppliers', projectId),
        DB.getAllForProject('participants', projectId)
      ]);

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;

      // --- Colors ---
      const brandYellow = [255, 213, 0];
      const darkBg = [20, 20, 20];
      const headerBg = [30, 30, 30];
      const textMain = [240, 240, 240];
      const textSec = [160, 160, 160];

      // --- Helper functions ---
      function checkPage(needed) {
        if (y + needed > pageH - 20) {
          doc.addPage();
          y = margin;
          return true;
        }
        return false;
      }

      function sectionTitle(text) {
        checkPage(16);
        doc.setFillColor(...brandYellow);
        doc.rect(margin, y, 4, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(50, 50, 50);
        doc.text(text, margin + 8, y + 6);
        y += 14;
      }

      function addFooter(pageNum) {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Abessis · ${project.name} · Generado el ${new Date().toLocaleDateString('es-ES')}`,
          margin, pageH - 8
        );
        doc.text(`Página ${pageNum}`, pageW - margin, pageH - 8, { align: 'right' });
      }

      // =============================================
      // COVER PAGE
      // =============================================
      doc.setFillColor(...darkBg);
      doc.rect(0, 0, pageW, pageH, 'F');

      // Client photo (circular, top of cover)
      if (project.clientPhoto) {
        try {
          const photoSize = 30;
          doc.addImage(project.clientPhoto, 'JPEG', pageW / 2 - photoSize / 2, 16, photoSize, photoSize);
          // Circular mask overlay: draw dark rectangles around to simulate circle
          doc.setFillColor(...darkBg);
          // top-left corner
          doc.setDrawColor(...darkBg);
        } catch(e) { /* ignore if image fails */ }
      }

      // Brand bar
      doc.setFillColor(...brandYellow);
      doc.rect(0, 55, pageW, 3, 'F');

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(...textMain);
      doc.text('INFORME DE AVANCE', pageW / 2, 80, { align: 'center' });

      // Project name
      doc.setFontSize(18);
      doc.setTextColor(...brandYellow);
      doc.text(project.name || 'Sin nombre', pageW / 2, 95, { align: 'center' });

      // Client name under project
      if (project.client) {
        doc.setFontSize(12);
        doc.setTextColor(...textSec);
        doc.text(project.client, pageW / 2, 103, { align: 'center' });
      }

      // Date
      doc.setFontSize(12);
      doc.setTextColor(...textSec);
      doc.text(new Date().toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }), pageW / 2, project.client ? 115 : 110, { align: 'center' });

      // Summary box
      const summaryY = 135;
      doc.setFillColor(25, 25, 25);
      doc.roundedRect(margin + 20, summaryY, contentW - 40, 50, 3, 3, 'F');
      doc.setDrawColor(50, 50, 50);
      doc.roundedRect(margin + 20, summaryY, contentW - 40, 50, 3, 3, 'S');

      const completedTasks = tasks.filter(t => (t.progress || 0) >= 100).length;
      const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
      const totalEstimated = budgets.reduce((s, b) => s + (b.estimatedCost || 0), 0);
      const totalReal = budgets.reduce((s, b) => s + (b.realCost || 0), 0);
      const pendingIncidents = incidents.filter(i => i.status === 'pending').length;

      doc.setFontSize(10);
      doc.setTextColor(...textSec);
      const cols = [
        { label: 'Progreso', value: taskProgress + '%' },
        { label: 'Tareas', value: `${completedTasks}/${tasks.length}` },
        { label: 'Presupuesto', value: fmtCurrency(totalReal) + ' / ' + fmtCurrency(totalEstimated) },
        { label: 'Incidencias', value: `${pendingIncidents} pendientes` }
      ];
      const colW = (contentW - 40) / cols.length;
      cols.forEach((col, i) => {
        const cx = margin + 20 + colW * i + colW / 2;
        doc.setTextColor(...textSec);
        doc.setFontSize(9);
        doc.text(col.label, cx, summaryY + 18, { align: 'center' });
        doc.setTextColor(...brandYellow);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(col.value, cx, summaryY + 32, { align: 'center' });
        doc.setFont('helvetica', 'normal');
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Generado por Abessis · Gestión de Obra', pageW / 2, pageH - 15, { align: 'center' });

      // =============================================
      // PAGE 2+: PROGRESS BY PHASE
      // =============================================
      doc.addPage();
      y = margin;

      sectionTitle('Progreso por Fase');

      const phaseRows = [];
      for (const phase of PHASES) {
        const phaseTasks = tasks.filter(t => (t.category || 'General') === phase);
        if (phaseTasks.length === 0) continue;
        const done = phaseTasks.filter(t => (t.progress || 0) >= 100).length;
        const avg = Math.round(phaseTasks.reduce((s, t) => s + (t.progress || 0), 0) / phaseTasks.length);
        phaseRows.push([phase, phaseTasks.length.toString(), done.toString(), avg + '%']);
      }

      if (phaseRows.length > 0) {
        doc.autoTable({
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Fase', 'Tareas', 'Completadas', 'Progreso']],
          body: phaseRows,
          styles: { fontSize: 10, cellPadding: 4, textColor: [50, 50, 50] },
          headStyles: { fillColor: brandYellow, textColor: [20, 20, 20], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            0: { cellWidth: 50 },
            3: { halign: 'center', fontStyle: 'bold' }
          }
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // =============================================
      // TASKS TABLE
      // =============================================
      sectionTitle('Detalle de Tareas');

      const sortedTasks = [...tasks].sort((a, b) => {
        const pi = PHASES.indexOf(a.category || 'General');
        const pj = PHASES.indexOf(b.category || 'General');
        return pi - pj || (a.name || '').localeCompare(b.name || '');
      });

      const taskRows = sortedTasks.map(t => {
        const overdue = new Date(t.endDate) < new Date() && (t.progress || 0) < 100;
        return [
          t.name || '',
          t.category || 'General',
          fmtDate(t.startDate),
          fmtDate(t.endDate),
          (t.progress || 0) + '%',
          overdue ? 'Retrasada' : (t.progress || 0) >= 100 ? 'Completada' : 'En curso'
        ];
      });

      if (taskRows.length > 0) {
        doc.autoTable({
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Tarea', 'Fase', 'Inicio', 'Fin', 'Progreso', 'Estado']],
          body: taskRows,
          styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
          headStyles: { fillColor: brandYellow, textColor: [20, 20, 20], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            0: { cellWidth: 45 },
            4: { halign: 'center' },
            5: { halign: 'center' }
          },
          didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 5) {
              if (data.cell.raw === 'Retrasada') data.cell.styles.textColor = [239, 68, 68];
              else if (data.cell.raw === 'Completada') data.cell.styles.textColor = [34, 197, 94];
            }
          }
        });
        y = doc.lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(10);
        doc.setTextColor(130, 130, 130);
        doc.text('No hay tareas registradas.', margin, y);
        y += 10;
      }

      // =============================================
      // BUDGET
      // =============================================
      checkPage(30);
      sectionTitle('Presupuesto');

      const budgetRows = budgets.map(b => {
        const deviation = (b.estimatedCost || 0) > 0
          ? Math.round(((b.realCost || 0) - (b.estimatedCost || 0)) / (b.estimatedCost || 1) * 100)
          : 0;
        return [
          b.name || b.category || '',
          fmtCurrency(b.estimatedCost || 0),
          fmtCurrency(b.realCost || 0),
          fmtCurrency((b.realCost || 0) - (b.estimatedCost || 0)),
          deviation + '%'
        ];
      });

      if (budgetRows.length > 0) {
        // Total row
        const devTotal = totalEstimated > 0 ? Math.round(((totalReal - totalEstimated) / totalEstimated) * 100) : 0;
        budgetRows.push([
          'TOTAL', fmtCurrency(totalEstimated), fmtCurrency(totalReal),
          fmtCurrency(totalReal - totalEstimated), devTotal + '%'
        ]);

        doc.autoTable({
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Partida', 'Previsto', 'Real', 'Diferencia', 'Desviación']],
          body: budgetRows,
          styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
          headStyles: { fillColor: brandYellow, textColor: [20, 20, 20], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'center' }
          },
          didParseCell: function (data) {
            if (data.section === 'body') {
              // Last row (TOTAL) bold
              if (data.row.index === budgetRows.length - 1) {
                data.cell.styles.fontStyle = 'bold';
              }
              // Deviation color
              if (data.column.index === 4) {
                const val = parseInt(data.cell.raw);
                if (val > 0) data.cell.styles.textColor = [239, 68, 68];
                else if (val < 0) data.cell.styles.textColor = [34, 197, 94];
              }
            }
          }
        });
        y = doc.lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(10);
        doc.setTextColor(130, 130, 130);
        doc.text('No hay partidas presupuestarias.', margin, y);
        y += 10;
      }

      // =============================================
      // INCIDENTS
      // =============================================
      checkPage(30);
      sectionTitle('Incidencias');

      const statusLabels = { pending: 'Pendiente', 'in-progress': 'En proceso', resolved: 'Resuelto' };

      const incidentsSorted = [...incidents].sort((a, b) => new Date(b.date) - new Date(a.date));
      const incidentRows = incidentsSorted.map(i => [
        fmtDate(i.date),
        i.category || '',
        (i.description || '').substring(0, 80) + ((i.description || '').length > 80 ? '...' : ''),
        i.responsiblePerson || '',
        statusLabels[i.status] || i.status || ''
      ]);

      if (incidentRows.length > 0) {
        doc.autoTable({
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Fecha', 'Categoría', 'Descripción', 'Responsable', 'Estado']],
          body: incidentRows,
          styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
          headStyles: { fillColor: brandYellow, textColor: [20, 20, 20], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: { 2: { cellWidth: 55 } },
          didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 4) {
              if (data.cell.raw === 'Pendiente') data.cell.styles.textColor = [217, 119, 6];
              else if (data.cell.raw === 'En proceso') data.cell.styles.textColor = [59, 130, 246];
              else if (data.cell.raw === 'Resuelto') data.cell.styles.textColor = [34, 197, 94];
            }
          }
        });
        y = doc.lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(10);
        doc.setTextColor(130, 130, 130);
        doc.text('No hay incidencias registradas.', margin, y);
        y += 10;
      }

      // =============================================
      // SUPPLIERS
      // =============================================
      checkPage(30);
      sectionTitle('Proveedores');

      const supplierRows = suppliers.map(s => [
        s.name || '',
        s.trade || '',
        s.contact || '',
        s.phone || '',
        s.status === 'active' ? 'Activo' : s.status === 'pending' ? 'Pendiente' : s.status || ''
      ]);

      if (supplierRows.length > 0) {
        doc.autoTable({
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Empresa', 'Gremio', 'Contacto', 'Teléfono', 'Estado']],
          body: supplierRows,
          styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
          headStyles: { fillColor: brandYellow, textColor: [20, 20, 20], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 245] }
        });
        y = doc.lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(10);
        doc.setTextColor(130, 130, 130);
        doc.text('No hay proveedores registrados.', margin, y);
        y += 10;
      }

      // =============================================
      // PARTICIPANTS
      // =============================================
      if (participants.length > 0) {
        checkPage(30);
        sectionTitle('Participantes');

        const partRows = participants.map(p => [
          p.name || '',
          p.role || '',
          p.company || '',
          p.phone || '',
          p.email || '',
          p.type === 'internal' ? 'Interno' : 'Externo'
        ]);

        doc.autoTable({
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Nombre', 'Rol', 'Empresa', 'Teléfono', 'Email', 'Tipo']],
          body: partRows,
          styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
          headStyles: { fillColor: brandYellow, textColor: [20, 20, 20], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 245] }
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // =============================================
      // ADD FOOTERS TO ALL PAGES
      // =============================================
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i === 1) continue; // Skip cover page
        addFooter(i - 1);
      }

      // =============================================
      // SAVE
      // =============================================
      const safeName = (project.name || 'obra').replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '-');
      doc.save(`informe-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);

      App.toast('Informe PDF generado correctamente', 'success');
    } catch (err) {
      console.error('Error generando PDF:', err);
      App.toast('Error al generar el informe PDF', 'error');
    }
  }

  // --- Formatters (plain text, no Intl for PDF) ---
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
