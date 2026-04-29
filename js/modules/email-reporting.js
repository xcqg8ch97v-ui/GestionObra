/* ========================================
   Email Reporting Module
   Generate copy-paste ready status updates
   ======================================== */

const EmailReportingModule = (() => {
  let projectId = null;

  function init(pid) {
    projectId = pid;
    if (!projectId) {
      console.warn('EmailReportingModule: No projectId provided');
      return;
    }
    loadReport();
  }

  async function loadReport() {
    const project = await DB.getById('projects', projectId);
    const psr = project?.currentPsr;
    const openItems = await DB.getAllForProject('open_items', projectId);
    const scopeItems = await DB.getAllForProject('scope_items', projectId);
    const tasks = await DB.getAllForProject('tasks', projectId);

    const activeItems = openItems.filter(i => i.status === 'open' || i.status === 'in-progress');
    const criticalItems = activeItems.filter(i => i.priority === 'Critical');
    const highItems = activeItems.filter(i => i.priority === 'High');
    
    const completedScope = scopeItems.filter(i => i.status === 'completed').length;
    const totalScope = scopeItems.length;
    const scopeProgress = totalScope > 0 ? Math.round((completedScope / totalScope) * 100) : 0;

    const completedTasks = tasks.filter(t => t.status === 'completed' || t.progress === 100).length;
    const totalTasks = tasks.length;
    const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const reportDate = psr?.reportingDate || new Date().toISOString().slice(0, 10);
    const weekNumber = getWeekNumber(new Date(reportDate));

    // Generate HTML Report
    const htmlReport = generateHtmlReport({
      project, psr, activeItems, criticalItems, highItems, 
      scopeProgress, taskProgress, weekNumber, reportDate
    });

    // Generate Plain Text Report
    const textReport = generateTextReport({
      project, psr, activeItems, criticalItems, highItems,
      scopeProgress, taskProgress, weekNumber, reportDate
    });

    renderReport(htmlReport, textReport);
  }

  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function getRagEmoji(status) {
    return status === 'Green' ? '🟢' : status === 'Amber' ? '🟡' : status === 'Red' ? '🔴' : '⚪';
  }

  function generateHtmlReport(data) {
    const { project, psr, criticalItems, highItems, scopeProgress, taskProgress, weekNumber, reportDate } = data;
    
    const rag = psr?.ragStatus || {};
    
    return `
<h2>📊 ${project?.name || 'Project'} - Week ${weekNumber} Status Report</h2>
<p><strong>Report Date:</strong> ${reportDate}</p>

<h3>🚦 Overall Status: ${getRagEmoji(psr?.overallStatus)} ${psr?.overallStatus || 'Green'}</h3>

<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
  <tr style="background:#f0f0f0;">
    <th>Area</th>
    <th>Status</th>
  </tr>
  <tr>
    <td>Schedule</td>
    <td>${getRagEmoji(rag.schedule)} ${rag.schedule || 'Green'}</td>
  </tr>
  <tr>
    <td>Budget</td>
    <td>${getRagEmoji(rag.budget)} ${rag.budget || 'Green'}</td>
  </tr>
  <tr>
    <td>Resources</td>
    <td>${getRagEmoji(rag.resources)} ${rag.resources || 'Green'}</td>
  </tr>
  <tr>
    <td>Scope</td>
    <td>${getRagEmoji(rag.scope)} ${rag.scope || 'Green'}</td>
  </tr>
  <tr>
    <td>Risks</td>
    <td>${getRagEmoji(rag.risks)} ${rag.risks || 'Green'}</td>
  </tr>
</table>

<h3>📈 Progress</h3>
<ul>
  <li>Overall Progress: ${psr?.progress || 0}%</li>
  <li>Scope Completion: ${scopeProgress}%</li>
  <li>Tasks Completion: ${taskProgress}%</li>
</ul>

${psr?.executiveSummary ? `
<h3>📝 Executive Summary</h3>
<p>${psr.executiveSummary}</p>
` : ''}

${psr?.accomplishments?.length ? `
<h3>✅ Key Accomplishments</h3>
<ul>
  ${psr.accomplishments.map(a => `<li>${a}</li>`).join('')}
</ul>
` : ''}

${psr?.upcoming?.length ? `
<h3>📅 Upcoming Activities</h3>
<ul>
  ${psr.upcoming.map(u => `<li>${u}</li>`).join('')}
</ul>
` : ''}

${psr?.milestones?.length ? `
<h3>🎯 Key Milestones</h3>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
  <tr style="background:#f0f0f0;">
    <th>Milestone</th>
    <th>Date</th>
    <th>Status</th>
  </tr>
  ${psr.milestones.map(m => `
    <tr>
      <td>${m.name}</td>
      <td>${m.date}</td>
      <td>${m.status}</td>
    </tr>
  `).join('')}
</table>
` : ''}

${criticalItems.length || highItems.length ? `
<h3>⚠️ Open Items Requiring Attention</h3>
${criticalItems.length ? `
<p><strong>Critical (${criticalItems.length}):</strong></p>
<ul>
  ${criticalItems.map(i => `<li><strong>${i.assignedTo}</strong>: ${i.description} (Due: ${i.targetDeadline || 'TBD'})</li>`).join('')}
</ul>
` : ''}
${highItems.length ? `
<p><strong>High Priority (${highItems.length}):</strong></p>
<ul>
  ${highItems.map(i => `<li><strong>${i.assignedTo}</strong>: ${i.description} (Due: ${i.targetDeadline || 'TBD'})</li>`).join('')}
</ul>
` : ''}
` : ''}

<hr>
<p><em>Generated by PSA Project Tracker</em></p>
    `.trim();
  }

  function generateTextReport(data) {
    const { project, psr, criticalItems, highItems, scopeProgress, taskProgress, weekNumber, reportDate } = data;
    
    const rag = psr?.ragStatus || {};
    
    return `
${project?.name || 'Project'} - Week ${weekNumber} Status Report
Report Date: ${reportDate}

OVERALL STATUS: ${psr?.overallStatus || 'Green'}

RAG STATUS:
- Schedule: ${rag.schedule || 'Green'}
- Budget: ${rag.budget || 'Green'}
- Resources: ${rag.resources || 'Green'}
- Scope: ${rag.scope || 'Green'}
- Risks: ${rag.risks || 'Green'}

PROGRESS:
- Overall: ${psr?.progress || 0}%
- Scope: ${scopeProgress}%
- Tasks: ${taskProgress}%

${psr?.executiveSummary ? `EXECUTIVE SUMMARY:\n${psr.executiveSummary}\n` : ''}

${psr?.accomplishments?.length ? `ACCOMPLISHMENTS:\n${psr.accomplishments.map(a => `- ${a}`).join('\n')}\n` : ''}

${psr?.upcoming?.length ? `UPCOMING:\n${psr.upcoming.map(u => `- ${u}`).join('\n')}\n` : ''}

${criticalItems.length ? `CRITICAL ITEMS (${criticalItems.length}):\n${criticalItems.map(i => `- [${i.assignedTo}] ${i.description} (Due: ${i.targetDeadline || 'TBD'})`).join('\n')}\n` : ''}

${highItems.length ? `HIGH PRIORITY ITEMS (${highItems.length}):\n${highItems.map(i => `- [${i.assignedTo}] ${i.description} (Due: ${i.targetDeadline || 'TBD'})`).join('\n')}` : ''}

---
Generated by PSA Project Tracker
    `.trim();
  }

  function renderReport(htmlReport, textReport) {
    const container = document.getElementById('email-report-container');
    if (!container) return;

    container.innerHTML = `
      <div class="email-report-tabs">
        <button class="tab-btn active" data-tab="html">HTML (for Outlook/Teams)</button>
        <button class="tab-btn" data-tab="text">Plain Text</button>
      </div>
      
      <div class="email-report-content">
        <div class="tab-panel active" id="panel-html">
          <div class="report-actions">
            <button class="btn btn-primary" onclick="EmailReportingModule.copyHtml()">
              <i data-lucide="copy"></i> Copy HTML
            </button>
          </div>
          <textarea id="report-html" class="report-textarea" readonly>${App.escapeHTML(htmlReport)}</textarea>
          <div class="report-preview">
            <h4>Preview:</h4>
            <div class="preview-content">${htmlReport}</div>
          </div>
        </div>
        
        <div class="tab-panel" id="panel-text">
          <div class="report-actions">
            <button class="btn btn-primary" onclick="EmailReportingModule.copyText()">
              <i data-lucide="copy"></i> Copy Text
            </button>
          </div>
          <textarea id="report-text" class="report-textarea" readonly>${App.escapeHTML(textReport)}</textarea>
        </div>
      </div>
    `;

    // Tab switching
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
      });
    });

    lucide.createIcons();
  }

  function copyHtml() {
    const textarea = document.getElementById('report-html');
    textarea.select();
    document.execCommand('copy');
    App.toast('HTML copied to clipboard', 'success');
  }

  function copyText() {
    const textarea = document.getElementById('report-text');
    textarea.select();
    document.execCommand('copy');
    App.toast('Text copied to clipboard', 'success');
  }

  return {
    init,
    loadReport,
    copyHtml,
    copyText
  };
})();
