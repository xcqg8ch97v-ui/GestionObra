/* ========================================
   Wizard Module - Project Creation Wizard
   Genera el proyecto correctamente definido desde cero
   ========================================

const ProjectWizardModule = (() => {
  let projectId = null;
  let currentStep = 1;
  const steps = [
    'Project basics',
    'Scope & Milestones',
    'Governance & Risks',
    'Review & Create'
  ];

  function init(pid) {
    projectId = pid;
    bindWelcome();
  }

  function bindWelcome() {
    const btn = document.getElementById('btn-open-wizard');
    if (btn) {
      btn.onclick = () => openWizard();
    }
  }

  function openWizard() {
    currentStep = 1;
    renderWizard();
    bindNavigation();
  }

  function renderWizard() {
    const body = `
      <div class="wizard-shell">
        <div class="wizard-header">
          <h3>Project Creation Wizard</h3>
          <p>Guía paso a paso para definir un proyecto antes de crearlo.</p>
          <div class="wizard-progress">Paso ${currentStep} de ${steps.length}: ${steps[currentStep - 1]}</div>
        </div>

        <div class="wizard-step" id="wizard-step-1">
          <div class="form-group">
            <label>Nombre del proyecto</label>
            <input type="text" id="wizard-project-name" class="form-control" placeholder="Ej: Transformación digital CRM">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Tipo de proyecto</label>
              <select id="wizard-project-type" class="form-control">
                <option value="IT">IT</option>
                <option value="Commercial">Commercial</option>
                <option value="Data">Data</option>
                <option value="Vendor">Vendor</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Región</label>
              <input type="text" id="wizard-project-region" class="form-control" placeholder="Ej: EMEA">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Stakeholders clave</label>
              <input type="text" id="wizard-project-stakeholders" class="form-control" placeholder="Ej: PM, CIO, Legal">
            </div>
            <div class="form-group">
              <label>Complejidad</label>
              <select id="wizard-project-complexity" class="form-control">
                <option value="Low">Low</option>
                <option value="Medium" selected>Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Fecha inicio objetivo</label>
              <input type="date" id="wizard-project-start" class="form-control">
            </div>
            <div class="form-group">
              <label>Fecha fin objetivo</label>
              <input type="date" id="wizard-project-end" class="form-control">
            </div>
          </div>
          <div class="form-group">
            <label>Dependencias clave</label>
            <textarea id="wizard-project-dependencies" class="form-control" placeholder="Ej: Aprobación legal, licitación, integración API"></textarea>
          </div>
          <div class="form-group">
            <label>Nivel de incertidumbre</label>
            <select id="wizard-project-uncertainty" class="form-control">
              <option value="Low">Low</option>
              <option value="Medium" selected>Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <div class="wizard-step" id="wizard-step-2" style="display:none">
          <div class="form-group">
            <label>Scope Must Have</label>
            <textarea id="wizard-scope-must" class="form-control" placeholder="Definir alcance mínimo requerido"></textarea>
          </div>
          <div class="form-group">
            <label>Scope Nice to Have</label>
            <textarea id="wizard-scope-nice" class="form-control" placeholder="Definir mejoras deseables"></textarea>
          </div>
          <div class="form-group">
            <label>Fases estándar sugeridas</label>
            <textarea id="wizard-scope-phases" class="form-control" readonly>Initiation
Definition
Execution
Closure</textarea>
          </div>
        </div>

        <div class="wizard-step" id="wizard-step-3" style="display:none">
          <div class="form-group">
            <label>Gobernanza inicial</label>
            <textarea id="wizard-governance" class="form-control" placeholder="Ej: PMO, Sponsor, Comité de dirección"></textarea>
          </div>
          <div class="form-group">
            <label>Riesgos iniciales detectados</label>
            <textarea id="wizard-risks" class="form-control" placeholder="Ej: Alcance, dependencias, recursos"></textarea>
          </div>
          <div class="form-group">
            <label>Skeleton PSR</label>
            <textarea id="wizard-psr-skeleton" class="form-control" readonly>Resumen Ejecutivo
Estado general
Riesgos clave
Próximos hitos</textarea>
          </div>
        </div>

        <div class="wizard-step" id="wizard-step-4" style="display:none">
          <div class="form-group">
            <label>Revisión final</label>
            <div class="wizard-summary" id="wizard-summary"></div>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" id="wizard-back">Atrás</button>
      <button class="btn btn-primary" id="wizard-next">Siguiente</button>
    `;

    App.openModal('Project Creation Wizard', body, footer);
    updateWizardSummary();
  }

  function bindNavigation() {
    const btnNext = document.getElementById('wizard-next');
    const btnBack = document.getElementById('wizard-back');

    if (btnNext) {
      btnNext.onclick = () => {
        if (currentStep < steps.length) {
          currentStep += 1;
          showStep(currentStep);
+          if (currentStep === steps.length) updateWizardSummary();
        } else {
          createProjectFromWizard();
        }
      };
    }

    if (btnBack) {
      btnBack.onclick = () => {
        if (currentStep > 1) {
          currentStep -= 1;
          showStep(currentStep);
        }
      };
    }
  }

  function showStep(step) {
    steps.forEach((_, index) => {
      const stepElement = document.getElementById(`wizard-step-${index + 1}`);
      if (stepElement) {
        stepElement.style.display = (index + 1 === step) ? 'block' : 'none';
      }
    });
    const progress = document.querySelector('.wizard-progress');
    if (progress) {
      progress.textContent = `Paso ${step} de ${steps.length}: ${steps[step - 1]}`;
    }
    const btnNext = document.getElementById('wizard-next');
    if (btnNext) {
      btnNext.textContent = step === steps.length ? 'Crear proyecto' : 'Siguiente';
    }
  }

  function updateWizardSummary() {
    const summary = [];
    const name = document.getElementById('wizard-project-name')?.value || '[Sin nombre]';
    const type = document.getElementById('wizard-project-type')?.value || 'IT';
    const region = document.getElementById('wizard-project-region')?.value || '[Sin región]';
    const complexity = document.getElementById('wizard-project-complexity')?.value || 'Medium';
    const stakeholders = document.getElementById('wizard-project-stakeholders')?.value || '[No definidos]';
    const start = document.getElementById('wizard-project-start')?.value || '[No definida]';
    const end = document.getElementById('wizard-project-end')?.value || '[No definida]';
    const dependencies = document.getElementById('wizard-project-dependencies')?.value || '[No definidas]';
    const uncertainty = document.getElementById('wizard-project-uncertainty')?.value || 'Medium';

    summary.push(`<strong>Nombre</strong>: ${App.escapeHTML(name)}`);
    summary.push(`<strong>Tipo</strong>: ${App.escapeHTML(type)}`);
    summary.push(`<strong>Región</strong>: ${App.escapeHTML(region)}`);
    summary.push(`<strong>Stakeholders</strong>: ${App.escapeHTML(stakeholders)}`);
    summary.push(`<strong>Fechas</strong>: ${App.escapeHTML(start)} → ${App.escapeHTML(end)}`);
    summary.push(`<strong>Dependencias</strong>: ${App.escapeHTML(dependencies)}`);
    summary.push(`<strong>Incertidumbre</strong>: ${App.escapeHTML(uncertainty)}`);

    const summaryElement = document.getElementById('wizard-summary');
    if (summaryElement) {
      summaryElement.innerHTML = `<div class="wizard-summary-list"><p>${summary.join('</p><p>')}</p></div>`;
    }
  }

  async function createProjectFromWizard() {
    const project = {
      name: document.getElementById('wizard-project-name')?.value.trim() || 'Proyecto sin nombre',
      type: document.getElementById('wizard-project-type')?.value,
      region: document.getElementById('wizard-project-region')?.value.trim(),
      stakeholders: (document.getElementById('wizard-project-stakeholders')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
      complexity: document.getElementById('wizard-project-complexity')?.value,
      targetStartDate: document.getElementById('wizard-project-start')?.value,
      targetEndDate: document.getElementById('wizard-project-end')?.value,
      dependencies: (document.getElementById('wizard-project-dependencies')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
      uncertaintyLevel: document.getElementById('wizard-project-uncertainty')?.value,
      maturityLevel: 'Draft',
      definitionPercent: 20,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scope: {
        mustHave: (document.getElementById('wizard-scope-must')?.value || '').split('\n').map(s => s.trim()).filter(Boolean),
        niceToHave: (document.getElementById('wizard-scope-nice')?.value || '').split('\n').map(s => s.trim()).filter(Boolean),
        gaps: [],
        isGeneric: false
      },
      risks: (document.getElementById('wizard-risks')?.value || '').split('\n').map(s => s.trim()).filter(Boolean).map((desc, idx) => ({ id: idx + 1, description: desc, impact: 'Medium', owner: '', status: 'Open' })),
      psr: {
        rag: 'Amber',
        trend: 'Stable',
        comments: ''
      }
    };

    const newId = await DB.add('projects', project);
    App.closeModal();
    App.toast('Proyecto creado con Wizard', 'success');
    App.enterProject(newId);
  }

  return {
    init,
    openWizard,
    createProjectFromWizard
  };
})();
