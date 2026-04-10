
/* ========================================
   App.js - Navegación y Utilidades
   Gestión de Obra PWA
   ======================================== */

const App = (() => {
// Actualizado: 2026-04-10
  const sectionTitles = {
    overview: 'section_overview',
    canvas: 'section_canvas',
    dashboard: 'section_dashboard',
    timeline: 'section_timeline',
    diary: 'section_diary',
    plans: 'section_plans',
    files: 'section_files',
    participants: 'section_participants'
  };

  let currentSection = 'overview';
  let currentProjectId = null;
  let currentProjectName = '';
  let currentLanguage = 'es';
  let contextMenuTarget = null;
  let contextMenuTargetId = null;
  let contextMenuTargetType = null;

  const SUPPORTED_LANGUAGES = ['es', 'en'];
  const LANGUAGE_LABELS = { es: 'Español', en: 'English' };

  const TRANSLATIONS = {
    es: {
      section_overview: 'Vista General',
      section_canvas: 'Mesa de Trabajo',
      section_dashboard: 'Proveedores y Presupuestos',
      section_timeline: 'Cronograma de Obra',
      section_diary: 'Diario de Obra',
      section_plans: 'Planos',
      section_files: 'Documentos',
      section_participants: 'Participantes',
      project_selector_subtitle: 'Selecciona una obra o crea una nueva',
      new_project: 'Nueva Obra',
      import_project: 'Importar Obra',
      create_first_project: 'Crear primera obra',
      no_projects: 'No hay obras creadas',
      collapse_menu: 'Colapsar menú',
      view_projects: 'Ver obras',
      options: 'Opciones',
      theme_label_light: 'Modo Claro',
      theme_label_dark: 'Modo Oscuro',
      theme_toggle: 'Cambiar tema',
      offline_ready: 'Offline Ready',
      language_label: 'Idioma',
      save_changes: 'Guardar cambios',
      close: 'Cerrar',
      project_options: 'Opciones del proyecto',
      download_attachments: 'Descargar ZIP de adjuntos',
      download_attachments_help: 'Descarga todos los documentos adjuntos del proyecto actual en un ZIP.',
      suppliers_types: 'Tipos de proveedores',
      plans_types: 'Tipos de planos',
      incidents_types: 'Tipos de incidencias',
      branding: 'Branding',
      company_logo: 'Logo de la empresa',
      remove_logo: 'Quitar logo',
      color_primary: 'Color principal',
      mode: 'Modo',
      project: 'Proyecto',
      project_name: 'Nombre de la Obra *',
      client: 'Cliente',
      client_logo: 'Foto / Logo del cliente',
      upload_photo: 'Subir foto',
      address: 'Dirección',
      target_end_date: 'Fecha objetivo original',
      status: 'Estado',
      status_active: 'Activa',
      status_pending: 'Pendiente',
      status_inactive: 'Inactiva',
      status_paused: 'En pausa',
      status_finished: 'Finalizada',
      notes: 'Notas',
      cancel: 'Cancelar',
      create: 'Crear',
      save: 'Guardar',
      project_name_placeholder: 'Ej: Reforma Piso Calle Mayor 12',
      client_placeholder: 'Nombre del cliente',
      address_placeholder: 'Dirección de la obra',
      confirm_delete_project: '¿Eliminar esta obra y todos sus datos?',
      no_client: 'Sin cliente',
      deadline_due: 'Entrega objetivo:',
      deadline_none: 'sin definir',
      file_type_pdf: 'PDF',
      file_type_image: 'Imagen',
      file_type_doc: 'Doc',
      file_type_spreadsheet: 'Excel',
      file_type_text: 'Texto',
      file_type_zip: 'ZIP',
      files_category_pdf: 'PDF',
      files_category_image: 'Imágenes',
      files_category_doc: 'Documentos',
      files_category_spreadsheet: 'Hojas de cálculo',
      files_category_other: 'Otros',
      download: 'Descargar',
      delete: 'Eliminar',
      file_exceeds_size_limit: '{{name}} excede {{size}}',
      files_uploaded_count: '{{count}} archivo(s) subido(s)',
      file_not_found: 'Archivo no encontrado',
      file_content_unavailable: 'No se pudo recuperar el contenido del archivo',
      confirm_delete_file: '¿Eliminar este archivo?',
      file_deleted: 'Archivo eliminado',
      project_name_required: 'El nombre es obligatorio',
      participant_type_internal: 'Interno',
      participant_type_external: 'Externo',
      no_name: 'Sin nombre',
      edit_participant: 'Editar Participante',
      new_participant: 'Nuevo Participante',
      full_name: 'Nombre completo',
      type: 'Tipo',
      role: 'Rol / Cargo',
      select: 'Seleccionar...',
      company: 'Empresa',
      phone: 'Teléfono',
      email: 'Email',
      participant_name_required: 'El nombre es obligatorio',
      participant_updated: 'Participante actualizado',
      participant_added: 'Participante añadido',
      confirm_delete_participant: '¿Eliminar este participante?',
      participant_deleted: 'Participante eliminado',
      edit_supplier: 'Editar Proveedor',
      new_supplier: 'Nuevo Proveedor',
      company: 'Empresa',
      trade: 'Gremio',
      add_trade: 'Añadir gremio',
      contact_person: 'Persona de Contacto',
      supplier_updated: 'Proveedor actualizado',
      supplier_created: 'Proveedor creado',
      confirm_delete_supplier: '¿Eliminar este proveedor?',
      supplier_deleted: 'Proveedor eliminado',
      new_trade_name_prompt: 'Nombre del nuevo gremio:',
      trade_already_exists: 'Ese gremio ya existe',
      new_category_name_prompt: 'Nombre de la nueva categoría:',
      category_already_exists: 'Esa categoría ya existe',
      estimated_cost_required: 'El coste previsto es obligatorio',
      edit_budget: 'Editar Partida',
      new_budget: 'Nueva Partida',
      budget_category: 'Partida / Categoría',
      add_category: 'Añadir categoría',
      description: 'Descripción',
      budget_description_placeholder: 'Ej: Instalación completa de fontanería',
      supplier: 'Proveedor',
      unassigned: '— Sin asignar —',
      estimated_cost: 'Coste Previsto',
      actual_cost: 'Coste Real',
      target_profit: 'Beneficio objetivo',
      percentage_example: 'Ej: 15',
      budget_updated: 'Partida actualizada',
      budget_created: 'Partida creada',
      confirm_delete_budget: '¿Eliminar esta partida?',
      budget_deleted: 'Partida eliminada',
      upload: 'Subir',
      upload_plan_title: 'Subir Plano',
      plan_upload_category_label_multiple: 'Categoría para los {{count}} planos',
      plan_upload_category_label_single: 'Categoría para {{name}}',
      plan_upload_same_category_note: 'Se aplicará la misma categoría a todos los planos. Puedes cambiarla luego individualmente.',
      plan_upload_change_category_note: 'Puedes cambiar la categoría más tarde desde el botón editar.',
      new_budget: 'Nueva Partida',
      budget_category: 'Partida / Categoría',
      add_category: 'Añadir categoría',
      description: 'Descripción',
      budget_description_placeholder: 'Ej: Instalación completa de fontanería',
      supplier: 'Proveedor',
      unassigned: '— Sin asignar —',
      estimated_cost: 'Coste Previsto',
      actual_cost: 'Coste Real',
      target_profit: 'Beneficio objetivo',
      percentage_example: 'Ej: 15',
      budget_updated: 'Partida actualizada',
      budget_created: 'Partida creada',
      confirm_delete_budget: '¿Eliminar esta partida?',
      budget_deleted: 'Partida eliminada',
      select_destination_element_for_connector: 'Selecciona el elemento de destino para crear el conector',
      select_other_destination_element: 'Selecciona otro elemento como destino',
      confirm_clear_canvas: '¿Limpiar toda la mesa de trabajo?',
      canvas_cleared: 'Mesa de trabajo limpiada',
      shape_text_prompt: 'Texto de la forma:',
      minimum_two_rows: 'Mínimo 2 filas',
      minimum_one_column: 'Mínimo 1 columna',
      confirm_delete_table: '¿Eliminar esta tabla?',
      select_image_files: 'Selecciona archivos de imagen (PNG, JPG, etc.)',
      importing_images: 'Importando {{count}} imagen(es)...',
      images_imported_to_canvas: '{{count}} imagen(es) importada(s) al canvas',
      rename: 'Renombrar',
      file_name_prompt: 'Nombre del archivo:',
      canvas_saved: 'Mesa de trabajo guardada',
      options_saved: 'Opciones guardadas',
      jszip_unavailable: 'JSZip no está disponible',
      no_attachments: 'No hay archivos adjuntos en este proyecto',
      attachments_zip_generated: 'ZIP de adjuntos generado',
      image_too_large: 'La imagen no puede superar 2 MB',
      project_updated: 'Obra actualizada',
      project_created: 'Obra creada',
      project_deleted: 'Obra eliminada',
      project_not_found: 'Obra no encontrada',
      exporting_project: 'Exportando obra...',
      project_exported: 'Obra exportada correctamente',
      invalid_project_export_file: 'Archivo no válido: no es una exportación de obra',
      importing_project: 'Importando obra...',
      project_imported: 'Obra importada correctamente',
      import_error_invalid_file: 'Error al importar: archivo corrupto o no válido',
      no_project_open: 'No hay proyecto abierto',
      edit_project: 'Editar Obra',
      file_upload: 'Elegir imagen',
      active: 'Activa',
      paused: 'En pausa',
      finished: 'Finalizada',
      sidebar_export: 'Exportar obra',
      sidebar_edit: 'Editar obra',
      sidebar_delete: 'Eliminar obra',
      plans_upload: 'Subir nuevo plano',
      add_entry: 'Nueva entrada',
      edit_entry: 'Editar entrada',
      delete_entry: 'Eliminar entrada',
      journal_entry: 'Entrada del diario',
      work_documents: 'Documentos',
      schedule: 'Cronograma',
      project_documents: 'Documentos de Obra',
      project_participants: 'Participantes',
      project_not_found: 'Obra no encontrada',
      import_project_action: 'Importar proyecto',
      hide: 'Ocultar',
      show: 'Mostrar',
      delete: 'Eliminar',
      add: 'Agregar',
      no_categories_visible: 'No hay categorías visibles.',
      no_categories_hidden: 'No hay categorías ocultas.',
      navigate_to: 'Navegar a',
      refresh_overview: 'Actualizar datos',
      add_task: 'Nueva tarea',
      add_incident: 'Nueva incidencia',
      add_supplier: 'Nuevo proveedor',
      canvas_add_note: 'Añadir nota',
      canvas_add_text: 'Añadir texto',
      canvas_add_table: 'Añadir tabla',
      canvas_draw_arrow: 'Dibujar flecha',
      canvas_draw_free: 'Dibujo libre',
      canvas_upload_plan: 'Subir plano',
      canvas_attach_file: 'Adjuntar archivo',
      canvas_export_image: 'Exportar imagen',
      canvas_zoom_fit: 'Ajustar zoom',
      canvas_clear_all: 'Limpiar todo',
      add_budget: 'Nueva partida',
      view_suppliers: 'Ver proveedores',
      view_budgets: 'Ver presupuestos',
      view_comparator: 'Ver comparador',
      view_gantt: 'Vista Gantt',
      view_list: 'Vista lista',
      go_today: 'Ir a hoy',
      view_all_plans: 'Ver todos los planos',
      filter_all: 'Mostrar todas',
      filter_pending: 'Solo pendientes',
      filter_progress: 'Solo en proceso',
      filter_resolved: 'Solo resueltas',
      upload_file: 'Subir archivo',
      sort_recent: 'Ordenar: Recientes',
      sort_name_asc: 'Ordenar: A-Z',
      sort_size_desc: 'Ordenar: Mayor tamaño',
      data_refreshed: 'Datos actualizados',
      canvas_click_to_place_note: 'Haz clic en el canvas para colocar la nota',
      canvas_click_to_add_text: 'Haz clic en el canvas para añadir texto',
      canvas_click_to_place_table: 'Haz clic en el canvas para colocar la tabla',
      canvas_drag_to_draw_arrow: 'Arrastra en el canvas para dibujar la flecha',
      select_language: 'Seleccionar idioma',
      app_title: 'Abessis · Gestión de Obra',
      open_menu: 'Abrir menú',
      overview_title: 'Resumen del Proyecto',
      overview_report_button: 'Generar Informe PDF',
      canvas_tool_select: 'Seleccionar',
      canvas_tool_hand: 'Mano (Desplazar)',
      canvas_tool_draw: 'Redline (Dibujo libre)',
      canvas_tool_arrow: 'Flecha',
      canvas_tool_connector: 'Conector entre elementos',
      canvas_tool_postit: 'Post-it',
      canvas_tool_text: 'Texto',
      canvas_tool_shape_rect: 'Rectángulo con texto',
      canvas_tool_shape_circle: 'Círculo con texto',
      canvas_tool_shape_diamond: 'Rombo con texto',
      canvas_tool_shape_triangle: 'Triángulo con texto',
      canvas_tool_table: 'Tabla',
      canvas_color_border: 'Color de contorno',
      canvas_color_fill: 'Color de relleno',
      canvas_color_text_border: 'Color del marco del texto',
      canvas_color_bg: 'Color de fondo del canvas',
      connector_option_end: 'Punta destino',
      connector_option_start: 'Punta origen',
      connector_option_both: 'Puntas en ambos',
      draw_width_title: 'Grosor',
      tool_undo: 'Deshacer (Ctrl+Z)',
      tool_upload_plan: 'Importar imágenes al canvas',
      tool_attach_file: 'Adjuntar archivo',
      tool_clear_canvas: 'Limpiar canvas',
      tool_save_canvas: 'Guardar estado',
      tool_export_image: 'Exportar imagen',
      tool_zoom_out: 'Alejar',
      tool_zoom_in: 'Acercar',
      tool_zoom_fit: 'Ajustar',
      sheet_add: 'Añadir hoja',
      dashboard_suppliers: 'Proveedores',
      dashboard_budgets: 'Presupuestos',
      dashboard_comparator: 'Comparador',
      dashboard_suppliers_title: 'Subcontratas y Proveedores',
      dashboard_budgets_title: 'Partidas Presupuestarias',
      compare_back_to_trades: 'Volver a gremios',
      comparative_summary: 'Comparación de {{count}} presupuesto(s) de {{suppliers}} proveedores',
      dashboard_import_pdf: 'Importar PDF',
      dashboard_import_bc3: 'Importar BC3',
      all_trades: 'Todos los gremios',
      search_supplier: 'Buscar proveedor...',
      supplier_table_company: 'Empresa',
      supplier_table_trade: 'Gremio',
      supplier_table_contact: 'Contacto',
      supplier_table_phone: 'Teléfono',
      supplier_table_status: 'Estado',
      supplier_table_actions: 'Acciones',
      suppliers_empty: 'No hay proveedores registrados',
      timeline_title: 'Cronograma de Obra',
      timeline_hide_completed_label: 'Ocultar tareas completadas',
      timeline_hide_completed: 'Ocultar completadas',
      timeline_show_weekends_label: 'Mostrar u ocultar sábados y domingos',
      timeline_show_weekends: 'Fines de semana',
      timeline_view_gantt: 'Vista Gantt',
      timeline_view_list: 'Vista Lista',
      timeline_apply_template: 'Cargar plantilla base',
      timeline_template: 'Plantilla',
      timeline_save_baseline: 'Guardar plan inicial',
      timeline_clear_all: 'Borrar todo',
      timeline_go_today: 'Hoy',
      timeline_help_note: 'El plan inicial es la fecha original prevista de cada tarea. Sirve para comparar lo planificado con lo que realmente va ocurriendo. La ruta crítica es el conjunto de tareas que no tienen margen: si una de ellas se retrasa, también se retrasa la fecha final de la obra. Las dependencias indican qué tarea depende de otra: hasta que la anterior no termina, la siguiente no debería arrancar.',
      timeline_legend_normal: 'Normal',
      timeline_legend_active: 'En ejecución',
      timeline_legend_critical: 'Ruta Crítica',
      timeline_legend_critical_label: 'La ruta crítica reúne las tareas sin margen. Si una de ellas se retrasa, se mueve la fecha final de la obra.',
      timeline_legend_delayed: 'Retrasada',
      timeline_legend_completed: 'Completada',
      timeline_legend_baseline: 'Plan inicial',
      timeline_table_task: 'Tarea',
      timeline_table_category: 'Categoría',
      timeline_table_responsible: 'Responsable',
      timeline_table_start: 'Inicio',
      timeline_table_end: 'Fin',
      timeline_table_duration: 'Duración',
      timeline_table_progress: 'Progreso',
      timeline_table_dependencies: 'Dependencias',
      timeline_table_status: 'Estado',
      timeline_empty: 'No hay tareas en el cronograma',
      timeline_create_first_task: 'Crear primera tarea',
      timeline_use_template: 'Usar plantilla base',
      diary_title: 'Diario de Obra',
      diary_incident_button: 'Incidencia',
      diary_comment_button: 'Comentario',
      diary_evolution_button: 'Evolución',
      diary_type_all: 'Todos los tipos',
      diary_type_incidents: 'Incidencias',
      diary_type_comments: 'Comentarios',
      diary_type_evolution: 'Evolución',
      diary_filter_all: 'Todos los estados',
      diary_filter_pending: 'Pendientes',
      diary_filter_in_progress: 'En proceso',
      diary_filter_resolved: 'Resueltas',
      diary_no_entries: 'No hay entradas registradas',
      diary_create_incident: 'Crear incidencia',
      diary_create_comment: 'Crear comentario',
      diary_create_evolution: 'Crear evolución',
      plans_title: 'Planos',
      plans_upload: 'Subir Plano',
      plans_empty_no_plans: 'No hay planos subidos',
      plans_empty_hint: 'Sube imágenes o PDFs de planos: arquitectura, estructura, instalaciones…',
      plans_upload_first_plan: 'Subir primer plano',
      plan_viewer_annotate: 'Anotar plano',
      plan_viewer_download: 'Descargar plano',
      plan_viewer_zoom_in: 'Ampliar',
      plan_viewer_zoom_out: 'Reducir',
      plan_viewer_fit: 'Ajustar',
      plan_viewer_prev: 'Anterior',
      plan_viewer_next: 'Siguiente',
      plan_viewer_close: 'Cerrar',
      plan_anno_draw: 'Dibujo libre',
      plan_anno_arrow: 'Flecha',
      plan_anno_text: 'Texto',
      plan_anno_rect: 'Rectángulo',
      plan_anno_circle: 'Círculo',
      plan_anno_color: 'Color',
      plan_anno_width_title: 'Grosor',
      plan_anno_thin: 'Fino',
      plan_anno_normal: 'Normal',
      plan_anno_thick: 'Grueso',
      plan_anno_undo: 'Deshacer',
      plan_anno_clear: 'Borrar todo',
      plan_anno_save: 'Guardar anotaciones',
      plan_anno_exit: 'Salir del editor',
      files_title: 'Documentos',
      files_filter_all_types: 'Todos los tipos',
      files_filter_pdf: 'PDF',
      files_filter_images: 'Imágenes',
      files_filter_docs: 'Documentos',
      files_filter_spreadsheets: 'Hojas de cálculo',
      files_filter_other: 'Otros',
      files_sort_recent: 'Más recientes',
      files_sort_oldest: 'Más antiguos',
      files_sort_name_az: 'Nombre A-Z',
      files_sort_name_za: 'Nombre Z-A',
      files_sort_size_desc: 'Mayor tamaño',
      files_sort_size_asc: 'Menor tamaño',
      files_group_by_type: 'Agrupar por tipo',
      files_empty: 'No hay documentos subidos',
      files_upload_first_document: 'Subir primer documento',
      participants_title: 'Participantes',
        overview_hero_panel: 'Panel de resumen',
        overview_global_progress: 'Avance global',
        overview_current_cost: 'Coste actual',
        overview_diary_entries: 'Entradas de diario',
        overview_suppliers: 'Proveedores',
        overview_quick_actions: 'Acciones rápidas',
        add_comment: 'Añadir comentario',
        add_participant: 'Añadir participante',
        overview_alerts: 'Alertas',
        overview_alert_delayed_tasks: 'Tareas retrasadas',
        overview_alert_delayed_count: '{{count}} tarea(s) retrasada(s)',
        overview_alert_active_tasks: 'Tareas en curso',
        overview_alert_active_count: '{{count}} tarea(s) en curso',
        overview_alert_pending_incident: 'Incidencia pendiente',
        overview_open_incident: 'Abrir incidencia',
        overview_alert_budget_deviation: 'Desviación de presupuesto',
        overview_alert_budget_deviation_detail: 'Desviación de {{percent}}%',
        overview_alert_pending_suppliers: 'Proveedores pendientes',
        overview_alert_pending_suppliers_detail: '{{count}} proveedor(es) pendientes',
        overview_no_alerts: 'Sin alertas',
        overview_no_date: 'Sin fecha objetivo',
        overview_set_target_date: 'Define una fecha objetivo para la obra',
        overview_delivery_target: 'Entrega {{relative}}',
        today: 'Hoy',
        tomorrow: 'Mañana',
        in_days: 'En {{count}} días',
        days_ago: 'Hace {{count}} días',
      participants_search_placeholder: 'Buscar participante...',
      participants_filter_all: 'Todos',
      participants_filter_internal: 'Internos',
      participants_filter_external: 'Externos',
      participants_no_participants: 'No hay participantes registrados',
      participants_add_first: 'Añadir primer participante',
      exit: 'Salir'
    },
    en: {
      section_overview: 'Overview',
      section_canvas: 'Workspace',
      section_dashboard: 'Suppliers and Budgets',
      section_timeline: 'Schedule',
      section_diary: 'Work Diary',
      section_plans: 'Blueprints',
      section_files: 'Project Documents',
      section_participants: 'Project Participants',
      project_selector_subtitle: 'Select a project or create a new one',
      new_project: 'New Project',
      import_project: 'Import Project',
      create_first_project: 'Create first project',
      no_projects: 'No projects created',
      collapse_menu: 'Collapse menu',
      view_projects: 'View projects',
      options: 'Settings',
      theme_label_light: 'Light Mode',
      theme_label_dark: 'Dark Mode',
      theme_toggle: 'Change theme',
      offline_ready: 'Offline Ready',
      language_label: 'Language',
      save_changes: 'Save changes',
      close: 'Close',
      project_options: 'Project Settings',
      download_attachments: 'Download attachments ZIP',
      download_attachments_help: 'Download all attached documents from the current project in a ZIP.',
      suppliers_types: 'Supplier types',
      plans_types: 'Plan categories',
      incidents_types: 'Incident types',
      branding: 'Branding',
      company_logo: 'Company logo',
      remove_logo: 'Remove logo',
      color_primary: 'Primary color',
      mode: 'Mode',
      project: 'Project',
      project_name: 'Project name *',
      client: 'Client',
      client_logo: 'Client photo / logo',
      upload_photo: 'Upload photo',
      address: 'Address',
      target_end_date: 'Target end date',
      status: 'Status',
      status_active: 'Active',
      status_pending: 'Pending',
      status_inactive: 'Inactive',
      status_paused: 'Paused',
      status_finished: 'Finished',
      notes: 'Notes',
      cancel: 'Cancel',
      create: 'Create',
      save: 'Save',
      project_name_placeholder: 'Ex: Flat Renovation Main Street 12',
      client_placeholder: 'Client name',
      address_placeholder: 'Project address',
      confirm_delete_project: 'Delete this project and all its data?',
      no_client: 'No client',
      deadline_due: 'Target delivery:',
      deadline_none: 'not defined',
      project_name_required: 'Name is required',
      options_saved: 'Options saved',
      jszip_unavailable: 'JSZip is not available',
      no_attachments: 'No attachments in this project',
      attachments_zip_generated: 'Attachments ZIP generated',
      image_too_large: 'Image must be smaller than 2 MB',
      project_updated: 'Project updated',
      project_created: 'Project created',
      project_deleted: 'Project deleted',
      project_not_found: 'Project not found',
      file_type_pdf: 'PDF',
      file_type_image: 'Image',
      file_type_doc: 'Doc',
      file_type_spreadsheet: 'Spreadsheet',
      file_type_text: 'Text',
      file_type_zip: 'ZIP',
      files_category_pdf: 'PDF',
      files_category_image: 'Images',
      files_category_doc: 'Documents',
      files_category_spreadsheet: 'Spreadsheets',
      files_category_other: 'Other',
      download: 'Download',
      delete: 'Delete',
      file_exceeds_size_limit: '{{name}} exceeds {{size}}',
      files_uploaded_count: '{{count}} file(s) uploaded',
      file_not_found: 'File not found',
      file_content_unavailable: 'Unable to retrieve file content',
      confirm_delete_file: 'Delete this file?',
      file_deleted: 'File deleted',
      participant_type_internal: 'Internal',
      participant_type_external: 'External',
      no_name: 'No name',
      edit_participant: 'Edit participant',
      new_participant: 'New participant',
      full_name: 'Full name',
      type: 'Type',
      role: 'Role / Position',
      select: 'Select...',
      company: 'Company',
      phone: 'Phone',
      email: 'Email',
      participant_name_required: 'Name is required',
      participant_updated: 'Participant updated',
      participant_added: 'Participant added',
      confirm_delete_participant: 'Delete this participant?',
      participant_deleted: 'Participant deleted',
      edit_supplier: 'Edit supplier',
      new_supplier: 'New supplier',
      company: 'Company',
      trade: 'Trade',
      add_trade: 'Add trade',
      contact_person: 'Contact person',
      supplier_updated: 'Supplier updated',
      supplier_created: 'Supplier created',
      confirm_delete_supplier: 'Delete this supplier?',
      supplier_deleted: 'Supplier deleted',
      new_trade_name_prompt: 'New trade name:',
      trade_already_exists: 'That trade already exists',
      new_category_name_prompt: 'New category name:',
      category_already_exists: 'That category already exists',
      estimated_cost_required: 'Estimated cost is required',
      edit_budget: 'Edit budget item',
      new_budget: 'New budget item',
      budget_category: 'Budget / Category',
      add_category: 'Add category',
      description: 'Description',
      budget_description_placeholder: 'Ex: Complete plumbing installation',
      supplier: 'Supplier',
      unassigned: '— Unassigned —',
      estimated_cost: 'Estimated cost',
      actual_cost: 'Actual cost',
      target_profit: 'Target profit',
      percentage_example: 'Ex: 15',
      budget_updated: 'Budget item updated',
      budget_created: 'Budget item created',
      confirm_delete_budget: 'Delete this budget item?',
      budget_deleted: 'Budget item deleted',
      select_destination_element_for_connector: 'Select the destination element to create the connector',
      select_other_destination_element: 'Select another element as destination',
      confirm_clear_canvas: 'Clear the entire workspace?',
      canvas_cleared: 'Workspace cleared',
      shape_text_prompt: 'Shape text:',
      minimum_two_rows: 'Minimum 2 rows',
      minimum_one_column: 'Minimum 1 column',
      confirm_delete_table: 'Delete this table?',
      select_image_files: 'Select image files (PNG, JPG, etc.)',
      importing_images: 'Importing {{count}} image(s)...',
      images_imported_to_canvas: '{{count}} image(s) imported to canvas',
      rename: 'Rename',
      file_name_prompt: 'File name:',
      canvas_saved: 'Workspace saved',
      exporting_project: 'Exporting project...',
      project_exported: 'Project exported successfully',
      invalid_project_export_file: 'Invalid file: not a project export',
      importing_project: 'Importing project...',
      project_imported: 'Project imported successfully',
      import_error_invalid_file: 'Import failed: file is corrupt or invalid',
      no_project_open: 'No project open',
      edit_project: 'Edit project',
      file_upload: 'Choose image',
      active: 'Active',
      paused: 'Paused',
      finished: 'Finished',
      sidebar_export: 'Export project',
      sidebar_edit: 'Edit project',
      sidebar_delete: 'Delete project',
      plans_upload: 'Upload new plan',
      add_entry: 'New entry',
      edit_entry: 'Edit entry',
      delete_entry: 'Delete entry',
      journal_entry: 'Diary entry',
      work_documents: 'Documents',
      schedule: 'Schedule',
      project_documents: 'Project Documents',
      project_participants: 'Participants',
      project_not_found: 'Project not found',
      import_project_action: 'Import project',
      hide: 'Hide',
      show: 'Show',
      delete: 'Delete',
      add: 'Add',
      no_categories_visible: 'No visible categories.',
      no_categories_hidden: 'No hidden categories.',
      navigate_to: 'Navigate to',
      refresh_overview: 'Refresh data',
      add_task: 'New task',
      add_incident: 'New incident',
      add_supplier: 'New supplier',
      canvas_add_note: 'Add note',
      canvas_add_text: 'Add text',
      canvas_add_table: 'Add table',
      canvas_draw_arrow: 'Draw arrow',
      canvas_draw_free: 'Free draw',
      canvas_upload_plan: 'Upload plan',
      canvas_attach_file: 'Attach file',
      canvas_export_image: 'Export image',
      canvas_zoom_fit: 'Fit zoom',
      canvas_clear_all: 'Clear all',
      add_budget: 'New budget',
      view_suppliers: 'View suppliers',
      view_budgets: 'View budgets',
      view_comparator: 'View comparator',
      view_gantt: 'Gantt view',
      view_list: 'List view',
      go_today: 'Go to today',
      view_all_plans: 'View all plans',
      filter_all: 'Show all',
      filter_pending: 'Only pending',
      filter_progress: 'Only in progress',
      filter_resolved: 'Only resolved',
      upload_file: 'Upload file',
      sort_recent: 'Sort: Recent',
      sort_name_asc: 'Sort: A-Z',
      sort_size_desc: 'Sort: Largest first',
      data_refreshed: 'Data refreshed',
      canvas_click_to_place_note: 'Click the canvas to place the note',
      canvas_click_to_add_text: 'Click the canvas to add text',
      canvas_click_to_place_table: 'Click the canvas to place the table',
      canvas_drag_to_draw_arrow: 'Drag on the canvas to draw the arrow',
      select_language: 'Select language',
      app_title: 'Abessis · Construction Management',
      open_menu: 'Open menu',
      overview_title: 'Project Summary',
      overview_report_button: 'Generate PDF report',
      canvas_tool_select: 'Select',
      canvas_tool_hand: 'Hand (Pan)',
      canvas_tool_draw: 'Free draw',
      canvas_tool_arrow: 'Arrow',
      canvas_tool_connector: 'Connector',
      canvas_tool_postit: 'Post-it',
      canvas_tool_text: 'Text',
      canvas_tool_shape_rect: 'Rectangle with text',
      canvas_tool_shape_circle: 'Circle with text',
      canvas_tool_shape_diamond: 'Diamond with text',
      canvas_tool_shape_triangle: 'Triangle with text',
      canvas_tool_table: 'Table',
      canvas_color_border: 'Border color',
      canvas_color_fill: 'Fill color',
      canvas_color_text_border: 'Text border color',
      canvas_color_bg: 'Canvas background color',
      connector_option_end: 'End point',
      connector_option_start: 'Start point',
      connector_option_both: 'Both ends',
      draw_width_title: 'Thickness',
      tool_undo: 'Undo (Ctrl+Z)',
      tool_upload_plan: 'Import images to canvas',
      tool_attach_file: 'Attach file',
      tool_clear_canvas: 'Clear canvas',
      tool_save_canvas: 'Save state',
      tool_export_image: 'Export image',
      tool_zoom_out: 'Zoom out',
      tool_zoom_in: 'Zoom in',
      tool_zoom_fit: 'Fit zoom',
      sheet_add: 'Add sheet',
      dashboard_suppliers: 'Suppliers',
      dashboard_budgets: 'Budgets',
      dashboard_comparator: 'Comparator',
      dashboard_suppliers_title: 'Subcontractors and Suppliers',
      dashboard_budgets_title: 'Budget Items',
      compare_back_to_trades: 'Back to trades',
      comparative_summary: '{{count}} budget(s) from {{suppliers}} suppliers',
      dashboard_import_pdf: 'Import PDF',
      dashboard_import_bc3: 'Import BC3',
      all_trades: 'All trades',
      search_supplier: 'Search supplier...',
      supplier_table_company: 'Company',
      supplier_table_trade: 'Trade',
      supplier_table_contact: 'Contact',
      supplier_table_phone: 'Phone',
      supplier_table_status: 'Status',
      supplier_table_actions: 'Actions',
      suppliers_empty: 'No suppliers registered',
      timeline_title: 'Schedule',
      timeline_hide_completed_label: 'Hide completed tasks',
      timeline_hide_completed: 'Hide completed',
      timeline_show_weekends_label: 'Show or hide weekends',
      timeline_show_weekends: 'Weekends',
      timeline_view_gantt: 'Gantt view',
      timeline_view_list: 'List view',
      timeline_apply_template: 'Load template',
      timeline_template: 'Template',
      timeline_save_baseline: 'Save baseline',
      timeline_clear_all: 'Clear all',
      timeline_go_today: 'Today',
      timeline_help_note: 'The baseline is the original planned date for each task. It helps compare planned versus actual progress. The critical path groups tasks without slack; if one of them slips, the project end date is delayed. Dependencies show which task depends on another: the next should not start until the previous one is finished.',
      timeline_legend_normal: 'Normal',
      timeline_legend_active: 'In progress',
      timeline_legend_critical: 'Critical Path',
      timeline_legend_critical_label: 'The critical path groups tasks without slack. If one slips, the project end date moves.',
      timeline_legend_delayed: 'Delayed',
      timeline_legend_completed: 'Completed',
      timeline_legend_baseline: 'Baseline',
      timeline_table_task: 'Task',
      timeline_table_category: 'Category',
      timeline_table_responsible: 'Responsible',
      timeline_table_start: 'Start',
      timeline_table_end: 'End',
      timeline_table_duration: 'Duration',
      timeline_table_progress: 'Progress',
      timeline_table_dependencies: 'Dependencies',
      timeline_table_status: 'Status',
      timeline_empty: 'No tasks in the schedule',
      timeline_create_first_task: 'Create first task',
      timeline_use_template: 'Use base template',
      diary_title: 'Work Diary',
      diary_incident_button: 'Incident',
      diary_comment_button: 'Comment',
      diary_evolution_button: 'Evolution',
      diary_type_all: 'All types',
      diary_type_incidents: 'Incidents',
      diary_type_comments: 'Comments',
      diary_type_evolution: 'Evolution',
      diary_filter_all: 'All statuses',
      diary_filter_pending: 'Pending',
      diary_filter_in_progress: 'In progress',
      diary_filter_resolved: 'Resolved',
      diary_no_entries: 'No entries recorded',
      diary_create_incident: 'Create incident',
      diary_create_comment: 'Create comment',
      diary_create_evolution: 'Create evolution',
      plans_title: 'Blueprints',
      plans_upload: 'Upload Plan',
      plans_empty_no_plans: 'No plans uploaded',
      plans_empty_hint: 'Upload images or PDFs of plans: architecture, structure, installations…',
      plans_upload_first_plan: 'Upload first plan',
      plan_viewer_annotate: 'Annotate plan',
      plan_viewer_download: 'Download plan',
      plan_viewer_zoom_in: 'Zoom in',
      plan_viewer_zoom_out: 'Zoom out',
      plan_viewer_fit: 'Fit',
      plan_viewer_prev: 'Previous',
      plan_viewer_next: 'Next',
      plan_viewer_close: 'Close',
      plan_anno_draw: 'Free draw',
      plan_anno_arrow: 'Arrow',
      plan_anno_text: 'Text',
      plan_anno_rect: 'Rectangle',
      plan_anno_circle: 'Circle',
      plan_anno_color: 'Color',
      plan_anno_width_title: 'Thickness',
      plan_anno_thin: 'Thin',
      plan_anno_normal: 'Normal',
      plan_anno_thick: 'Thick',
      plan_anno_undo: 'Undo',
      plan_anno_clear: 'Clear all',
      plan_anno_save: 'Save annotations',
      plan_anno_exit: 'Exit editor',
      files_title: 'Project Documents',
      files_filter_all_types: 'All types',
      files_filter_pdf: 'PDF',
      files_filter_images: 'Images',
      files_filter_docs: 'Documents',
      files_filter_spreadsheets: 'Spreadsheets',
      files_filter_other: 'Other',
      files_sort_recent: 'Most recent',
      files_sort_oldest: 'Oldest',
      files_sort_name_az: 'Name A-Z',
      files_sort_name_za: 'Name Z-A',
      files_sort_size_desc: 'Largest first',
      files_sort_size_asc: 'Smallest first',
      files_group_by_type: 'Group by type',
      files_empty: 'No documents uploaded',
      files_upload_first_document: 'Upload first document',
      participants_title: 'Project Participants',
      participants_search_placeholder: 'Search participant...',
      participants_filter_all: 'All',
      participants_filter_internal: 'Internal',
      participants_filter_external: 'External',
      participants_no_participants: 'No participants registered',
      participants_add_first: 'Add first participant',
      exit: 'Exit'
    }
  };

  function t(key, vars = {}) {
    const text = (TRANSLATIONS[currentLanguage] && TRANSLATIONS[currentLanguage][key]) || TRANSLATIONS.es[key] || key;
    return text.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] || '');
  }

  function detectBrowserLanguage() {
    const language = (navigator.languages && navigator.languages[0]) || navigator.language || 'es';
    const normalized = language.toLowerCase();
    return SUPPORTED_LANGUAGES.find(lang => normalized.startsWith(lang)) || 'es';
  }

  function loadLanguage() {
    const saved = localStorage.getItem('abessis-lang');
    currentLanguage = saved && SUPPORTED_LANGUAGES.includes(saved) ? saved : detectBrowserLanguage();
    document.documentElement.lang = currentLanguage;
  }

  function setLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return;
    currentLanguage = lang;
    localStorage.setItem('abessis-lang', lang);
    document.documentElement.lang = lang;
    translatePage();
  }

  function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const attr = el.dataset.i18nAttr;
      const value = t(key);
      if (attr) {
        el.setAttribute(attr, value);
      } else {
        // Si el elemento tiene hijos (por ejemplo, un <span> con <i>), solo reemplaza el texto
        if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
          el.textContent = value;
        } else {
          // Busca el primer nodo de texto y reemplázalo
          for (let node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              node.textContent = value;
              break;
            }
          }
        }
      }
    });
    const sectionTitleEl = document.getElementById('section-title');
    if (sectionTitleEl) {
      sectionTitleEl.textContent = t(sectionTitles[currentSection]);
    }
    updateThemeLabels(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  }

  const DEFAULT_TRADE_CATEGORIES = [
    'Albañilería', 'Fontanería', 'Electricidad', 'Carpintería',
    'Pintura', 'Cristalería', 'Climatización', 'Impermeabilización',
    'Estructura', 'Cimentación', 'Paisajismo', 'Seguridad', 'Otros'
  ];

  const DEFAULT_PLAN_CATEGORY_OPTIONS = [
    { key: 'situacion', label: 'Situación / Emplazamiento' },
    { key: 'plantas', label: 'Plantas' },
    { key: 'alzados', label: 'Alzados' },
    { key: 'secciones', label: 'Secciones' },
    { key: 'cotas', label: 'Cotas y Replanteo' },
    { key: 'estructura', label: 'Estructura' },
    { key: 'cimentacion', label: 'Cimentación' },
    { key: 'cubiertas', label: 'Cubiertas' },
    { key: 'electricidad', label: 'Electricidad' },
    { key: 'fontaneria', label: 'Fontanería y Saneamiento' },
    { key: 'climatizacion', label: 'Climatización y Ventilación' },
    { key: 'telecom', label: 'Telecomunicaciones' },
    { key: 'incendios', label: 'Protección contra Incendios' },
    { key: 'urbanizacion', label: 'Urbanización' },
    { key: 'detalle', label: 'Detalles Constructivos' },
    { key: 'seguridad', label: 'Seguridad y Salud' },
    { key: 'otros', label: 'Otros' }
  ];

  const DEFAULT_INCIDENT_CATEGORIES = [
    'Estructural', 'Fontanería', 'Electricidad', 'Acabados',
    'Seguridad', 'Material', 'Comunicación', 'Plazo', 'Otros'
  ];

  function safeIcons() {
    try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) { console.warn('Lucide icons error:', e); }
  }

  async function init() {
    try {
      await DB.open();
      loadLanguage();
      loadTheme();
      setupModal();
      setupProjectSelector();
      setupThemeToggle();
      registerSW();
      safeIcons();
      showProjectSelector();
      translatePage();
    } catch(e) {
      console.error('App init error:', e);
      document.getElementById('project-selector').style.display = 'flex';
    }
  }

  // ========================================
  // THEME
  // ========================================

  function loadTheme() {
    const saved = localStorage.getItem('abessis-theme') || 'dark';
    applyTheme(saved);
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    updateThemeLabels(theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('abessis-theme', next);
    applyTheme(next);
    lucide.createIcons();
  }

  function applyProjectTheme(project) {
    if (!project || !project.theme || !project.theme.primaryColor) {
      document.documentElement.style.removeProperty('--cyan');
      document.documentElement.style.removeProperty('--cyan-hover');
      document.documentElement.style.removeProperty('--cyan-light');
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--primary-contrast');
      return;
    }

    const primary = project.theme.primaryColor;
    const contrast = project.theme.primaryContrast || getContrastColor(primary);
    const hover = adjustColor(primary, -16);
    const light = hexToRgba(primary, 0.14);

    document.documentElement.style.setProperty('--cyan', primary);
    document.documentElement.style.setProperty('--cyan-hover', hover);
    document.documentElement.style.setProperty('--cyan-light', light);
    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--primary-contrast', contrast);
  }

  function applyProjectBranding(project) {
    const logo = project?.companyLogo || project?.clientPhoto || 'img/logo-abessis-white.png';
    const sidebarLogo = document.querySelector('.sidebar-header .logo-img');
    if (sidebarLogo) {
      sidebarLogo.src = logo;
      sidebarLogo.alt = project && (project.companyLogo || project.clientPhoto) ? 'Logo de la compañía' : 'Abessis';
    }
  }

  function hexToRgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    if (!rgb) return `rgba(255, 213, 0, ${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  function hexToRgb(hex) {
    const sanitized = hex.replace('#', '').trim();
    if (sanitized.length === 3) {
      return {
        r: parseInt(sanitized[0] + sanitized[0], 16),
        g: parseInt(sanitized[1] + sanitized[1], 16),
        b: parseInt(sanitized[2] + sanitized[2], 16)
      };
    }
    if (sanitized.length === 6) {
      return {
        r: parseInt(sanitized.slice(0, 2), 16),
        g: parseInt(sanitized.slice(2, 4), 16),
        b: parseInt(sanitized.slice(4, 6), 16)
      };
    }
    return null;
  }

  function adjustColor(hex, amount) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const clamp = (value) => Math.max(0, Math.min(255, value));
    return `#${[clamp(rgb.r + amount), clamp(rgb.g + amount), clamp(rgb.b + amount)]
      .map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }

  function getContrastColor(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return '#000';
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 160 ? '#000' : '#FFF';
  }

  function updateThemeLabels(theme) {
    const labels = document.querySelectorAll('.theme-label');
    labels.forEach(l => { l.textContent = theme === 'dark' ? t('theme_label_light') : t('theme_label_dark'); });
  }

  function setupThemeToggle() {
    const btn1 = document.getElementById('btn-theme-toggle');
    const btn2 = document.getElementById('btn-theme-selector');
    if (btn1) btn1.addEventListener('click', toggleTheme);
    if (btn2) btn2.addEventListener('click', toggleTheme);
  }

  // ========================================
  // PROJECT SELECTOR
  // ========================================

  function setupProjectSelector() {
    document.getElementById('btn-new-project')?.addEventListener('click', openProjectForm);
    document.getElementById('btn-new-project-empty')?.addEventListener('click', openProjectForm);
    document.getElementById('btn-import-project')?.addEventListener('click', importProject);
    document.getElementById('btn-back-projects')?.addEventListener('click', showProjectSelector);
    document.getElementById('btn-topbar-projects')?.addEventListener('click', showProjectSelector);
    document.getElementById('btn-options')?.addEventListener('click', openOptionsPanel);
  }

  async function openOptionsPanel() {
    const project = currentProjectId ? await DB.getById('projects', currentProjectId) : null;
    const projects = await DB.getAll('projects');
    const customTrades = currentProjectId ? await DB.getCustomCategories(currentProjectId, 'trade', 'add') : [];
    const hiddenTradeEntries = currentProjectId ? await DB.getCustomCategories(currentProjectId, 'trade', 'hide') : [];
    const hiddenTrades = hiddenTradeEntries.map(c => c.name);
    const customPlans = currentProjectId ? await DB.getCustomCategories(currentProjectId, 'plan', 'add') : [];
    const hiddenPlanEntries = currentProjectId ? await DB.getCustomCategories(currentProjectId, 'plan', 'hide') : [];
    const hiddenPlans = hiddenPlanEntries.map(c => c.name);
    const customIncidents = currentProjectId ? await DB.getCustomCategories(currentProjectId, 'incidentCategory', 'add') : [];
    const hiddenIncidentEntries = currentProjectId ? await DB.getCustomCategories(currentProjectId, 'incidentCategory', 'hide') : [];
    const hiddenIncidents = hiddenIncidentEntries.map(c => c.name);

    const projectRows = projects.map(p => `
      <div class="options-project-row">
        <div>
          <strong>${App.escapeHTML(p.name)}</strong><br>
          <small>${App.escapeHTML(p.client || 'Sin cliente')}</small>
        </div>
        <div class="options-row-actions">
          <button class="btn btn-outline btn-sm" onclick="App.exportProject(${p.id})">Exportar</button>
        </div>
      </div>
    `).join('');

    const body = `
      <div class="options-panel">
        <div class="options-section">
          <h3>${t('project')}</h3>
          <p>${t('project_selector_subtitle') || 'Descarga proyectos existentes o importa uno nuevo.'}</p>
          <div class="options-panel-list">${projectRows}</div>
          <button class="btn btn-outline" id="btn-options-import-project">${t('import_project_action')}</button>
        </div>

        <div class="options-section">
          <h3>${t('download_attachments')}</h3>
          <p>${t('download_attachments_help')}</p>
          <button class="btn btn-outline" id="btn-options-download-attachments">${t('download_attachments')}</button>
        </div>

        <div class="options-section">
          <h3>${t('suppliers_types')}</h3>
          <div class="options-subtitle">${t('hide')} los gremios que no apliquen al proyecto.</div>
          <div id="options-trades-visible" class="options-type-list"></div>
          <div id="options-trades-hidden" class="options-type-list options-hidden-list"></div>
          <div class="options-add-row">
            <input type="text" id="options-new-trade" class="form-control" placeholder="${t('add')} ${t('suppliers_types').toLowerCase()}" />
            <button class="btn btn-primary btn-sm" id="btn-options-add-trade">${t('add')}</button>
          </div>
        </div>

        <div class="options-section">
          <h3>${t('plans_types')}</h3>
          <div class="options-subtitle">${t('hide')} categorías de planos por defecto en este proyecto.</div>
          <div id="options-plans-visible" class="options-type-list"></div>
          <div id="options-plans-hidden" class="options-type-list options-hidden-list"></div>
          <div class="options-add-row">
            <input type="text" id="options-new-plan" class="form-control" placeholder="${t('add')} ${t('plans_types').toLowerCase()}" />
            <button class="btn btn-primary btn-sm" id="btn-options-add-plan">${t('add')}</button>
          </div>
        </div>

        <div class="options-section">
          <h3>${t('incidents_types')}</h3>
          <div class="options-subtitle">${t('hide')} categorías de incidencias que no utilices.</div>
          <div id="options-incidents-visible" class="options-type-list"></div>
          <div id="options-incidents-hidden" class="options-type-list options-hidden-list"></div>
          <div class="options-add-row">
            <input type="text" id="options-new-incident" class="form-control" placeholder="${t('add')} ${t('incidents_types').toLowerCase()}" />
            <button class="btn btn-primary btn-sm" id="btn-options-add-incident">${t('add')}</button>
          </div>
        </div>

        <div class="options-section">
          <h3>${t('language_label')}</h3>
          <div class="form-group">
            <label>${t('select_language')}</label>
            <select id="options-language" class="form-control">
              ${SUPPORTED_LANGUAGES.map(lang => `<option value="${lang}" ${lang === currentLanguage ? 'selected' : ''}>${LANGUAGE_LABELS[lang]}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="options-section">
          <h3>${t('branding')}</h3>
          <div class="form-group">
            <label>${t('company_logo')}</label>
            <div class="company-logo-preview" id="options-logo-preview" style="background-image:url(${project?.companyLogo || project?.clientPhoto || 'img/logo-abessis-white.png'})"></div>
            <input type="file" id="options-logo-input" accept="image/*" style="display:none">
            <div class="options-add-row">
              <button class="btn btn-outline btn-sm" id="btn-options-logo-upload">Elegir logo</button>
              <button class="btn btn-outline btn-sm" id="btn-options-logo-remove">Quitar logo</button>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Color principal</label>
              <input type="color" id="options-theme-color" value="${project?.theme?.primaryColor || '#ffd500'}">
            </div>
            <div class="form-group">
              <label>Modo</label>
              <select id="options-theme-mode" class="form-control">
                <option value="dark" ${!(project?.theme?.mode === 'light') ? 'selected' : ''}>Oscuro</option>
                <option value="light" ${project?.theme?.mode === 'light' ? 'selected' : ''}>Claro</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">${t('close')}</button>
      <button class="btn btn-primary" id="btn-options-save">${t('save_changes')}</button>
    `;

    App.openModal(t('project_options'), body, footer);

    function renderTypeList(visibleItems, hiddenItems, visibleContainerId, hiddenContainerId, type) {
      const visibleContainer = document.getElementById(visibleContainerId);
      const hiddenContainer = document.getElementById(hiddenContainerId);
      if (!visibleContainer || !hiddenContainer) return;

      visibleContainer.innerHTML = visibleItems.length ? visibleItems.map(item => `
        <div class="options-type-row">
          <span>${App.escapeHTML(item.label)}</span>
          <div class="options-row-actions">
            ${item.source === 'default' ? `<button class="btn btn-outline btn-sm" data-action="hide" data-type="${type}" data-name="${App.escapeHTML(item.name)}">${t('hide')}</button>` : `<button class="btn btn-outline btn-sm btn-danger" data-action="remove" data-type="${type}" data-id="${item.id}">${t('delete')}</button>`}
          </div>
        </div>
      `).join('') : `<div class="options-type-row"><em>${t('no_categories_visible')}</em></div>`;

      hiddenContainer.innerHTML = hiddenItems.length ? hiddenItems.map(item => `
        <div class="options-type-row">
          <span>${App.escapeHTML(item.label)}</span>
          <button class="btn btn-primary btn-sm" data-action="show" data-type="${type}" data-name="${App.escapeHTML(item.name)}">${t('show')}</button>
        </div>
      `).join('') : `<div class="options-type-row"><em>${t('no_categories_hidden')}</em></div>`;

      visibleContainer.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.dataset.action;
          const type = btn.dataset.type;
          const name = btn.dataset.name;
          const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;

          if (action === 'hide') {
            await DB.addCustomCategory(currentProjectId, type, name, 'hide');
          }
          if (action === 'show') {
            const existing = hiddenItems.find(item => item.name === name);
            if (existing && existing.id) {
              await DB.removeCustomCategory(existing.id);
            }
          }
          if (action === 'remove' && id) {
            await DB.removeCustomCategory(id);
          }
          openOptionsPanel();
        });
      });

      hiddenContainer.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const name = btn.dataset.name;
          const existing = hiddenItems.find(item => item.name === name);
          if (existing && existing.id) {
            await DB.removeCustomCategory(existing.id);
          }
          openOptionsPanel();
        });
      });
    }

    const tradeVisible = DEFAULT_TRADE_CATEGORIES.filter(t => !hiddenTrades.includes(t)).map(name => ({ name, label: name, source: 'default' }))
      .concat(customTrades.filter(item => !hiddenTrades.includes(item.name)).map(item => ({ id: item.id, name: item.name, label: item.name, source: 'custom' })));
    const tradeHidden = hiddenTradeEntries.map(entry => ({
      id: entry.id,
      name: entry.name,
      label: DEFAULT_TRADE_CATEGORIES.includes(entry.name) ? entry.name : entry.name,
      source: DEFAULT_TRADE_CATEGORIES.includes(entry.name) ? 'default' : 'custom'
    }));

    const planVisible = DEFAULT_PLAN_CATEGORY_OPTIONS.filter(cat => !hiddenPlans.includes(cat.key)).map(cat => ({ name: cat.key, label: cat.label, source: 'default' }))
      .concat(customPlans.filter(item => !hiddenPlans.includes(item.name)).map(item => ({ id: item.id, name: item.name, label: item.name, source: 'custom' })));
    const planHidden = hiddenPlanEntries.map(entry => ({
      id: entry.id,
      name: entry.name,
      label: DEFAULT_PLAN_CATEGORY_OPTIONS.find(cat => cat.key === entry.name)?.label || entry.name,
      source: DEFAULT_PLAN_CATEGORY_OPTIONS.some(cat => cat.key === entry.name) ? 'default' : 'custom'
    }));

    const incidentVisible = DEFAULT_INCIDENT_CATEGORIES.filter(name => !hiddenIncidents.includes(name)).map(name => ({ name, label: name, source: 'default' }))
      .concat(customIncidents.filter(item => !hiddenIncidents.includes(item.name)).map(item => ({ id: item.id, name: item.name, label: item.name, source: 'custom' })));
    const incidentHidden = hiddenIncidentEntries.map(entry => ({
      id: entry.id,
      name: entry.name,
      label: DEFAULT_INCIDENT_CATEGORIES.includes(entry.name) ? entry.name : entry.name,
      source: DEFAULT_INCIDENT_CATEGORIES.includes(entry.name) ? 'default' : 'custom'
    }));

    renderTypeList(tradeVisible, tradeHidden, 'options-trades-visible', 'options-trades-hidden', 'trade');
    renderTypeList(planVisible, planHidden, 'options-plans-visible', 'options-plans-hidden', 'plan');
    renderTypeList(incidentVisible, incidentHidden, 'options-incidents-visible', 'options-incidents-hidden', 'incidentCategory');

    document.getElementById('btn-options-import-project').addEventListener('click', importProject);
    document.getElementById('btn-options-download-attachments').addEventListener('click', downloadAttachmentsZip);

    document.getElementById('btn-options-add-trade').addEventListener('click', async () => {
      const name = document.getElementById('options-new-trade').value.trim();
      if (!name) return;
      await DB.addCustomCategory(currentProjectId, 'trade', name);
      document.getElementById('options-new-trade').value = '';
      openOptionsPanel();
    });

    document.getElementById('btn-options-add-plan').addEventListener('click', async () => {
      const name = document.getElementById('options-new-plan').value.trim();
      if (!name) return;
      await DB.addCustomCategory(currentProjectId, 'plan', name);
      document.getElementById('options-new-plan').value = '';
      openOptionsPanel();
    });

    document.getElementById('btn-options-add-incident').addEventListener('click', async () => {
      const name = document.getElementById('options-new-incident').value.trim();
      if (!name) return;
      await DB.addCustomCategory(currentProjectId, 'incidentCategory', name);
      document.getElementById('options-new-incident').value = '';
      openOptionsPanel();
    });

    const logoInput = document.getElementById('options-logo-input');
    const logoPreview = document.getElementById('options-logo-preview');
    let logoData = project?.companyLogo || project?.clientPhoto || null;

    document.getElementById('btn-options-logo-upload').addEventListener('click', () => logoInput.click());
    document.getElementById('btn-options-logo-remove').addEventListener('click', () => {
      logoData = null;
      logoPreview.style.backgroundImage = '';
    });

    logoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        logoData = ev.target.result;
        logoPreview.style.backgroundImage = `url(${logoData})`;
      };
      reader.readAsDataURL(file);
      logoInput.value = '';
    });

    document.getElementById('options-language').addEventListener('change', async (e) => {
      setLanguage(e.target.value);
      await openOptionsPanel();
    });

    document.getElementById('btn-options-save').addEventListener('click', async () => {
      if (!currentProjectId) {
        App.toast(t('no_project_open'), 'warning');
        return;
      }
      const color = document.getElementById('options-theme-color').value;
      const mode = document.getElementById('options-theme-mode').value;
      const proj = await DB.getById('projects', currentProjectId);
      if (!proj) return;
      proj.companyLogo = logoData;
      proj.theme = proj.theme || {};
      proj.theme.primaryColor = color;
      proj.theme.mode = mode;
      await DB.put('projects', proj);
      if (mode === 'light') {
        localStorage.setItem('abessis-theme', 'light');
      } else {
        localStorage.setItem('abessis-theme', 'dark');
      }
      applyTheme(mode);
      applyProjectTheme(proj);
      applyProjectBranding(proj);
      App.toast(t('options_saved'), 'success');
      openOptionsPanel();
    });

    async function downloadAttachmentsZip() {
      if (typeof JSZip === 'undefined') {
        App.toast(t('jszip_unavailable'), 'error');
        return;
      }
      const files = await DB.getAllForProject('files', currentProjectId);
      if (!files.length) {
        App.toast(t('no_attachments'), 'warning');
        return;
      }
      const zip = new JSZip();
      for (const file of files) {
        let content = null;
        if (file.data instanceof ArrayBuffer) {
          content = file.data;
        } else if (file.blob instanceof Blob) {
          content = await file.blob.arrayBuffer();
        } else if (file.data) {
          content = file.data;
        }
        if (!content) continue;
        zip.file(file.name, content);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name || t('project')}-attachments.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      App.toast(t('attachments_zip_generated'), 'success');
    }
  }

  async function showProjectSelector() {
    currentProjectId = null;
    document.getElementById('project-selector').style.display = 'flex';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('main-content').style.display = 'none';
    await loadProjectCards();
    lucide.createIcons();
  }

  async function loadProjectCards() {
    const projects = await DB.getAll('projects');
    const grid = document.getElementById('project-grid');
    const empty = document.getElementById('projects-empty');

    if (projects.length === 0) {
      grid.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }

    grid.style.display = 'grid';
    empty.style.display = 'none';

    grid.innerHTML = projects.map(p => {
      const statusClass = p.status === 'active' ? 'badge-active' : p.status === 'finished' ? 'badge-positive' : 'badge-pending';
      const statusLabel = p.status === 'active' ? t('active') : p.status === 'finished' ? t('finished') : t('paused');
      const photoHTML = p.clientPhoto
        ? `<img class="project-card-photo" src="${p.clientPhoto}" alt="">`
        : '';
      const deadlineHTML = p.targetEndDate
        ? `<div class="project-card-deadline">${t('deadline_due')} ${formatDate(p.targetEndDate)}</div>`
        : `<div class="project-card-deadline">${t('deadline_due')} ${t('deadline_none')}</div>`;
      return `
        <div class="project-card" onclick="App.enterProject(${p.id})">
          <div class="project-card-header">
            ${photoHTML}
            <div>
              <div class="project-card-name">${escapeHTML(p.name)}</div>
              <div class="project-card-client">${escapeHTML(p.client || t('no_client'))}</div>
              ${deadlineHTML}
            </div>
          </div>
          <div class="project-card-meta">
            <span class="badge ${statusClass}">${statusLabel}</span>
            <span class="project-card-date">${formatDate(p.createdAt)}</span>
          </div>
          <div class="project-card-actions" onclick="event.stopPropagation();">
            <button class="action-btn" onclick="App.exportProject(${p.id})" title="${t('sidebar_export')}">
              <i data-lucide="download"></i>
            </button>
            <button class="action-btn" onclick="App.editProject(${p.id})" title="${t('sidebar_edit')}">
              <i data-lucide="pencil"></i>
            </button>
            <button class="action-btn delete" onclick="App.deleteProject(${p.id})" title="${t('sidebar_delete')}">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  }

  function openProjectForm(project = null) {
    const isEdit = project && project.id;
    const title = isEdit ? t('edit_project') : t('new_project');

    const hasPhoto = isEdit && project.clientPhoto;
    const body = `
      <div class="form-group">
        <label>${t('project_name')}</label>
        <input type="text" id="proj-name" value="${isEdit ? escapeHTML(project.name) : ''}" placeholder="${t('project_name_placeholder')}">
      </div>
      <div class="form-group">
        <label>${t('client')}</label>
        <input type="text" id="proj-client" value="${isEdit ? escapeHTML(project.client || '') : ''}" placeholder="${t('client_placeholder')}">
      </div>
      <div class="form-group">
        <label>${t('client_logo')}</label>
        <div class="client-photo-upload">
          <div class="client-photo-preview" id="proj-photo-preview" ${hasPhoto ? 'style="background-image:url(' + project.clientPhoto + ')"' : ''}>
            ${hasPhoto ? '' : '<i data-lucide="camera"></i><span>' + t('upload_photo') + '</span>'}
          </div>
          <input type="file" id="proj-photo-input" accept="image/*" style="display:none">
          <div class="client-photo-actions">
            <button type="button" class="btn btn-outline btn-sm" id="btn-proj-photo">${t('file_upload')}</button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-proj-photo-remove" style="display:${hasPhoto ? 'inline-flex' : 'none'}">${t('remove_logo')}</button>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>${t('address')}</label>
        <input type="text" id="proj-address" value="${isEdit ? escapeHTML(project.address || '') : ''}" placeholder="${t('address_placeholder')}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>${t('target_end_date')}</label>
          <input type="date" id="proj-target-end" value="${isEdit ? escapeHTML(project.targetEndDate || '') : ''}">
        </div>
        <div class="form-group">
          <label>${t('status')}</label>
          <select id="proj-status">
            <option value="active" ${isEdit && project.status === 'active' ? 'selected' : ''}>${t('status_active')}</option>
            <option value="paused" ${isEdit && project.status === 'paused' ? 'selected' : ''}>${t('status_paused')}</option>
            <option value="finished" ${isEdit && project.status === 'finished' ? 'selected' : ''}>${t('status_finished')}</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>${t('notes')}</label>
        <textarea id="proj-notes">${isEdit ? escapeHTML(project.notes || '') : ''}</textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="App.closeModal()">${t('cancel')}</button>
      <button class="btn btn-primary" id="btn-save-project">
        <i data-lucide="save"></i> ${isEdit ? t('save') : t('create')}
      </button>
    `;

    openModal(title, body, footer);

    // Client photo upload logic
    let clientPhotoData = isEdit ? (project.clientPhoto || null) : null;
    const photoPreview = document.getElementById('proj-photo-preview');
    const photoInput = document.getElementById('proj-photo-input');
    const btnPhoto = document.getElementById('btn-proj-photo');
    const btnPhotoRemove = document.getElementById('btn-proj-photo-remove');

    btnPhoto.addEventListener('click', () => photoInput.click());
    photoPreview.addEventListener('click', () => photoInput.click());

    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        toast(t('image_too_large'), 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        clientPhotoData = ev.target.result;
        photoPreview.style.backgroundImage = `url(${clientPhotoData})`;
        photoPreview.innerHTML = '';
        btnPhotoRemove.style.display = 'inline-flex';
      };
      reader.readAsDataURL(file);
      photoInput.value = '';
    });

    btnPhotoRemove.addEventListener('click', () => {
      clientPhotoData = null;
      photoPreview.style.backgroundImage = '';
      photoPreview.innerHTML = '<i data-lucide="camera"></i><span>Subir foto</span>';
      btnPhotoRemove.style.display = 'none';
      safeIcons();
    });

    document.getElementById('btn-save-project').addEventListener('click', async () => {
      const name = document.getElementById('proj-name').value.trim();
      if (!name) { toast(t('project_name_required'), 'warning'); return; }
      const targetEndDate = document.getElementById('proj-target-end').value;

      const data = {
        name,
        client: document.getElementById('proj-client').value.trim(),
        clientPhoto: clientPhotoData || null,
        address: document.getElementById('proj-address').value.trim(),
        targetEndDate: targetEndDate || '',
        status: document.getElementById('proj-status').value,
        notes: document.getElementById('proj-notes').value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (isEdit) {
        data.id = project.id;
        data.createdAt = project.createdAt;
        await DB.put('projects', data);
        await syncProjectDeadlineMilestone(data);
        toast(t('project_updated'), 'success');
      } else {
        data.createdAt = new Date().toISOString();
        const newId = await DB.add('projects', data);
        data.id = newId;
        await syncProjectDeadlineMilestone(data);
        toast(t('project_created'), 'success');
      }

      closeModal();
      loadProjectCards();
    });
  }

  async function editProject(id) {
    const project = await DB.getById('projects', id);
    if (project) openProjectForm(project);
  }

  async function deleteProject(id) {
    if (!confirm(t('confirm_delete_project'))) return;
    await DB.remove('projects', id);
    toast(t('project_deleted'), 'info');
    loadProjectCards();
  }

  // ========================================
  // EXPORT / IMPORT
  // ========================================

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const CHUNK = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
      binary += String.fromCharCode.apply(null, slice);
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async function encodeFileRecordForExport(fileRecord) {
    let binaryData = fileRecord.data || null;
    if (!binaryData && fileRecord.blob) {
      binaryData = await fileRecord.blob.arrayBuffer();
    }

    return {
      ...fileRecord,
      data: binaryData ? arrayBufferToBase64(binaryData) : null,
      blob: undefined,
      _encoded: true
    };
  }

  async function collectProjectFilesForExport(projectId, incidents = []) {
    const projectFiles = await DB.getAllForProject('files', projectId);
    const exportedFiles = [...projectFiles];
    const seenIds = new Set(projectFiles.map(file => file.id));

    const referencedIds = new Set();
    incidents.forEach(incident => {
      (incident.photoIds || []).forEach(photoId => {
        if (photoId !== null && photoId !== undefined) referencedIds.add(photoId);
      });
    });

    for (const fileId of referencedIds) {
      if (seenIds.has(fileId)) continue;
      const fileRecord = await DB.getById('files', fileId);
      if (fileRecord) {
        exportedFiles.push(fileRecord);
        seenIds.add(fileId);
      }
    }

    return exportedFiles;
  }

  function remapCanvasFileReferences(node, fileIdMap) {
    if (!node || typeof node !== 'object') return;

    if (node._attachedFileId && fileIdMap[node._attachedFileId]) {
      node._attachedFileId = fileIdMap[node._attachedFileId];
    }

    if (Array.isArray(node.objects)) {
      node.objects.forEach(child => remapCanvasFileReferences(child, fileIdMap));
    }
  }

  async function exportProject(id) {
    const project = await DB.getById('projects', id);
    if (!project) { toast(t('project_not_found'), 'error'); return; }

    toast(t('exporting_project'), 'info');

    const STORES = ['suppliers', 'budgets', 'tasks', 'incidents', 'participants', 'plans'];
    const data = { project, _exportVersion: 1, _exportDate: new Date().toISOString() };
    let incidents = [];

    for (const store of STORES) {
      const records = await DB.getAllForProject(store, id);
      data[store] = records;
      if (store === 'incidents') incidents = records;
    }

    const files = await collectProjectFilesForExport(id, incidents);
    data.files = await Promise.all(files.map(encodeFileRecordForExport));

    // Canvas state (multi-sheet)
    const sheetIndex = await DB.getSheetIndex(id);
    if (sheetIndex && sheetIndex.sheets) {
      data.canvasSheets = {};
      data.canvasSheetIndex = sheetIndex.sheets;
      for (const sheet of sheetIndex.sheets) {
        const st = await DB.getCanvasState(id, sheet.id);
        data.canvasSheets[sheet.id] = st ? st.data : null;
      }
    } else {
      // Legacy fallback
      const canvasState = await DB.getCanvasState(id);
      data.canvas = canvasState || null;
    }

    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = project.name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '-');
    link.download = `obra-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast(t('project_exported'), 'success');
  }

  async function importProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.project || !data._exportVersion) {
          toast(t('invalid_project_export_file'), 'error');
          return;
        }

        toast(t('importing_project'), 'info');

        // Create project with new ID
        const { id: oldId, ...projData } = data.project;
        projData.name = projData.name + ' (importada)';
        projData.importedAt = new Date().toISOString();
        const newProjectId = await DB.add('projects', projData);

        // Import each store with updated projectId
        const STORES = ['suppliers', 'budgets', 'tasks', 'incidents', 'files', 'participants', 'plans'];
        const idMap = {}; // old ID -> new ID mapping for references

        for (const store of STORES) {
          const records = data[store] || [];
          idMap[store] = {};
          for (const record of records) {
            try {
              const oldRecId = record.id;
              const { id, ...recData } = record;
              recData.projectId = newProjectId;

              // Restore file binary data from base64
              if (store === 'files') {
                if (recData._encoded && recData.data) {
                  recData.data = base64ToArrayBuffer(recData.data);
                }
                delete recData.blob;
                delete recData._encoded;
              }

              const newId = await DB.add(store, recData);
              idMap[store][oldRecId] = newId;
            } catch (recErr) {
              console.warn(`Import: error en registro de ${store}:`, recErr);
            }
          }
        }

        // Fix task dependencies (old IDs -> new IDs)
        if (data.tasks) {
          for (const oldTask of data.tasks) {
            if (oldTask.dependencies && oldTask.dependencies.length > 0) {
              const newTaskId = idMap.tasks[oldTask.id];
              const task = await DB.getById('tasks', newTaskId);
              if (task) {
                task.dependencies = oldTask.dependencies.map(depId => idMap.tasks[depId]).filter(Boolean);
                await DB.put('tasks', task);
              }
            }
          }
        }

        // Fix budget supplierId references
        if (data.budgets) {
          for (const oldBudget of data.budgets) {
            if (oldBudget.supplierId) {
              const newBudgetId = idMap.budgets[oldBudget.id];
              const budget = await DB.getById('budgets', newBudgetId);
              if (budget) {
                budget.supplierId = idMap.suppliers[oldBudget.supplierId] || budget.supplierId;
                await DB.put('budgets', budget);
              }
            }
          }
        }

        if (data.incidents) {
          for (const oldIncident of data.incidents) {
            if (oldIncident.photoIds && oldIncident.photoIds.length > 0) {
              const newIncidentId = idMap.incidents[oldIncident.id];
              const incident = await DB.getById('incidents', newIncidentId);
              if (incident) {
                incident.photoIds = oldIncident.photoIds.map(fileId => idMap.files[fileId]).filter(Boolean);
                await DB.put('incidents', incident);
              }
            }
          }
        }

        // Fix plan fileId references
        if (data.plans) {
          for (const oldPlan of data.plans) {
            if (oldPlan.fileId) {
              const newPlanId = idMap.plans[oldPlan.id];
              const plan = await DB.getById('plans', newPlanId);
              if (plan) {
                plan.fileId = idMap.files[oldPlan.fileId] || plan.fileId;
                await DB.put('plans', plan);
              }
            }
          }
        }

        // Import canvas state (multi-sheet or legacy)
        if (data.canvasSheetIndex && data.canvasSheets) {
          const newSheets = data.canvasSheetIndex.map(s => ({ ...s }));
          await DB.saveSheetIndex(newProjectId, newSheets);
          for (const sheet of newSheets) {
            const sheetData = data.canvasSheets[sheet.id];
            if (sheetData) {
              remapCanvasFileReferences(sheetData.canvas, idMap.files || {});
              remapCanvasFileReferences(sheetData, idMap.files || {});
              await DB.saveCanvasState(newProjectId, sheetData, sheet.id);
            }
          }
        } else if (data.canvas && data.canvas.data) {
          // Legacy single-sheet import
          const sheetId = 'sheet_' + Date.now();
          const newSheets = [{ id: sheetId, name: 'Hoja 1' }];
          await DB.saveSheetIndex(newProjectId, newSheets);
          remapCanvasFileReferences(data.canvas.data, idMap.files || {});
          await DB.saveCanvasState(newProjectId, data.canvas.data, sheetId);
        }

        toast(t('project_imported'), 'success');
        loadProjectCards();
      } catch (err) {
        console.error('Import error:', err);
        toast(t('import_error_invalid_file'), 'error');
      }
    });
    input.click();
  }

  async function enterProject(id) {
    const project = await DB.getById('projects', id);
    if (!project) return;

    await syncProjectDeadlineMilestone(project);

    currentProjectId = id;
    currentProjectName = project.name;

    applyProjectBranding(project);
    applyProjectTheme(project);

    // Hide selector, show app
    document.getElementById('project-selector').style.display = 'none';
    document.getElementById('sidebar').style.display = 'flex';
    document.getElementById('main-content').style.display = 'flex';

    // Update project name display
    document.getElementById('topbar-project-name').textContent = project.name;

    // Setup navigation and init modules
    setupNavigation();
    setupSidebar();
    setupMobile();

    // Init all modules with project context
    const modules = [
      ['CanvasModule', CanvasModule],
      ['DashboardModule', DashboardModule],
      ['TimelineModule', TimelineModule],
      ['DiaryModule', DiaryModule],
      ['OverviewModule', OverviewModule],
      ['PlansModule', typeof PlansModule !== 'undefined' ? PlansModule : null],
      ['FilesModule', FilesModule],
      ['ParticipantsModule', typeof ParticipantsModule !== 'undefined' ? ParticipantsModule : null],
      ['ReportModule', typeof ReportModule !== 'undefined' ? ReportModule : null]
    ];
    for (const [name, mod] of modules) {
      try { if (mod) mod.init(currentProjectId); }
      catch(e) { console.warn(`Error init ${name}:`, e); }
    }

    setupContextMenu();

    safeIcons();

    navigateTo('overview');
  }

  async function syncProjectDeadlineMilestone(project) {
    if (!project || !project.id) return;

    const projectTasks = await DB.getAllForProject('tasks', project.id);
    const milestone = projectTasks.find(task => task.systemTag === 'project-deadline-milestone');

    if (!project.targetEndDate) {
      if (milestone) await DB.remove('tasks', milestone.id);
      return;
    }

    const now = new Date().toISOString();
    const milestoneData = {
      name: 'Hito · Fin objetivo de obra',
      category: 'General',
      responsible: '',
      startDate: project.targetEndDate,
      endDate: project.targetEndDate,
      progress: project.status === 'finished' ? 100 : 0,
      dependencies: milestone?.dependencies || [],
      projectId: project.id,
      updatedAt: now,
      createdAt: milestone?.createdAt || now,
      baselineStartDate: milestone?.baselineStartDate || milestone?.startDate || project.targetEndDate,
      baselineEndDate: milestone?.baselineEndDate || milestone?.endDate || project.targetEndDate,
      systemTag: 'project-deadline-milestone',
      isMilestone: true,
      lockedBySystem: true
    };

    if (milestone) {
      milestoneData.id = milestone.id;
      await DB.put('tasks', milestoneData);
      return;
    }

    await DB.add('tasks', milestoneData);
  }

  function openIncident(id) {
    navigateTo('diary');
    setTimeout(() => {
      if (typeof DiaryModule !== 'undefined' && DiaryModule.focusIncident) {
        DiaryModule.focusIncident(id);
      }
    }, 80);
  }

  // ========================================
  // NAVIGATION
  // ========================================

  function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      // Remove old listeners by cloning
      const newLink = link.cloneNode(true);
      link.parentNode.replaceChild(newLink, link);

      newLink.addEventListener('click', (e) => {
        e.preventDefault();
        const section = newLink.dataset.section;
        navigateTo(section);
        closeMobileSidebar();
      });
    });
  }

  function navigateTo(section) {
    if (!sectionTitles[section]) return;

    currentSection = section;

    // Update nav
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-section="${section}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Update section
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const activeSection = document.getElementById(`section-${section}`);
    if (activeSection) activeSection.classList.add('active');

    // Update title
    document.getElementById('section-title').textContent = t(sectionTitles[section]);

    if (section === 'canvas') {
      setTimeout(() => CanvasModule.resize(), 100);
    }
    if (section === 'timeline') {
      setTimeout(() => TimelineModule.refresh(), 100);
    }
    if (section === 'overview') {
      OverviewModule.refresh();
    }
  }

  function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebar-toggle');

    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);

    newToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      setTimeout(() => {
        lucide.createIcons();
        if (currentSection === 'canvas') CanvasModule.resize();
      }, 350);
    });
  }

  function setupMobile() {
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');

    let overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      overlay.id = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }

    const newToggle = mobileToggle.cloneNode(true);
    mobileToggle.parentNode.replaceChild(newToggle, mobileToggle);

    newToggle.addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.add('active');
    });

    overlay.onclick = closeMobileSidebar;
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }

  // --- Modal System ---
  function setupModal() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  function openModal(title, bodyHTML, footerHTML) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML || '';
    overlay.classList.add('active');
    lucide.createIcons();

    // Focus first input
    const firstInput = document.querySelector('#modal-body input, #modal-body select, #modal-body textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
  }

  // --- Toast Notifications ---
  function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = {
      success: 'check-circle',
      error: 'alert-circle',
      warning: 'alert-triangle',
      info: 'info'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type]}" class="toast-icon"></i>
      <span>${escapeHTML(message)}</span>
    `;
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 300ms ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- Lightbox ---
  function openLightbox(src) {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `<img src="${src}" alt="Foto ampliada">`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  }

  // --- Utilities ---
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // ========================================
  // CONTEXT MENU SYSTEM
  // ========================================

  let ctxMenuReady = false;
  let touchContextTimer = null;
  let touchContextPointerId = null;
  let touchContextStart = { x: 0, y: 0 };

  function setupContextMenu() {
    if (ctxMenuReady) return;
    ctxMenuReady = true;

    const menu = document.getElementById('ctx-menu');
    const mainContent = document.getElementById('main-content');

    function resetTouchContext() {
      if (touchContextTimer) {
        clearTimeout(touchContextTimer);
        touchContextTimer = null;
      }
      touchContextPointerId = null;
      contextMenuTarget = null;
    }

    function startTouchContext(e) {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

      contextMenuTarget = e.target;
      contextMenuTargetType = null;
      contextMenuTargetId = null;
      touchContextPointerId = e.pointerId;
      touchContextStart = { x: e.clientX, y: e.clientY };

      touchContextTimer = setTimeout(() => {
        if (!contextMenuTarget) return;

        if (currentSection === 'timeline' && typeof TimelineModule !== 'undefined' && TimelineModule.captureContextMenuTarget) {
          TimelineModule.captureContextMenuTarget(contextMenuTarget, touchContextStart.x);
        }

        showContextMenu(touchContextStart.x, touchContextStart.y);
        touchContextTimer = null;
      }, 550);
    }

    function moveTouchContext(e) {
      if (touchContextPointerId !== e.pointerId) return;
      const distance = Math.hypot(e.clientX - touchContextStart.x, e.clientY - touchContextStart.y);
      if (distance > 10) resetTouchContext();
    }

    function endTouchContext(e) {
      if (touchContextPointerId !== e.pointerId) return;
      resetTouchContext();
    }

    // Close on click elsewhere or Escape
    document.addEventListener('click', () => hideContextMenu());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideContextMenu(); });
    window.addEventListener('blur', () => hideContextMenu());

    if (mainContent) {
      mainContent.addEventListener('pointerdown', startTouchContext);
      mainContent.addEventListener('pointermove', moveTouchContext);
      mainContent.addEventListener('pointerup', endTouchContext);
      mainContent.addEventListener('pointercancel', endTouchContext);
    }

    // Right click handler on main content
    if (mainContent) {
      mainContent.addEventListener('contextmenu', (e) => {
        // Don't override context menu on inputs/textareas/contenteditable
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

        contextMenuTarget = e.target;
        contextMenuTargetType = null;
        contextMenuTargetId = null;

        if (currentSection === 'timeline' && typeof TimelineModule !== 'undefined' && TimelineModule.captureContextMenuTarget) {
          TimelineModule.captureContextMenuTarget(e.target, e.clientX);
        }

        e.preventDefault();
        showContextMenu(e.clientX, e.clientY);
      });
    }
  }

  function showContextMenu(x, y) {
    const menu = document.getElementById('ctx-menu');
    const items = getContextMenuItems();
    if (!items.length) return;

    // Build HTML
    menu.innerHTML = items.map(item => {
      if (item.type === 'sep') return '<div class="ctx-sep"></div>';
      if (item.type === 'header') return `<div class="ctx-header">${escapeHTML(item.label)}</div>`;
      const cls = ['ctx-item'];
      if (item.danger) cls.push('ctx-danger');
      const shortcut = item.shortcut ? `<span class="ctx-shortcut">${item.shortcut}</span>` : '';
      return `<button class="${cls.join(' ')}" data-action="${item.action}">
        <i data-lucide="${item.icon}"></i>
        <span>${escapeHTML(item.label)}</span>
        ${shortcut}
      </button>`;
    }).join('');

    lucide.createIcons({ attrs: { class: '' } });

    // Bind actions
    menu.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideContextMenu();
        const action = btn.dataset.action;
        executeContextAction(action);
      });
    });

    // Position ensuring viewport bounds
    menu.classList.add('visible');
    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    menu.style.left = Math.min(x, maxX) + 'px';
    menu.style.top = Math.min(y, maxY) + 'px';
  }

  function hideContextMenu() {
    const menu = document.getElementById('ctx-menu');
    menu.classList.remove('visible');
    contextMenuTarget = null;
    contextMenuTargetId = null;
    contextMenuTargetType = null;
  }

  function getContextMenuItems() {
    const section = currentSection;
    const target = contextMenuTarget;
    const incidentCard = target?.closest('.incident-card');
    const planCard = target?.closest('.plan-card');

    if (section === 'diary' && incidentCard) {
      contextMenuTargetType = 'incident';
      contextMenuTargetId = incidentCard.dataset.id;
      return [
        { type: 'header', label: t('journal_entry') },
        { action: 'edit-incident', icon: 'pencil', label: t('edit_entry') },
        { action: 'delete-incident', icon: 'trash-2', label: t('delete_entry'), danger: true },
        { type: 'sep' },
        { action: 'add-incident', icon: 'plus-circle', label: t('add_entry') },
        { type: 'sep' },
      ];
    }

    if (section === 'plans' && planCard) {
      contextMenuTargetType = 'plan';
      contextMenuTargetId = planCard.dataset.planId || planCard.dataset.planIdx;
      return [
        { type: 'header', label: t('section_plans') },
        { action: 'edit-plan', icon: 'pencil', label: t('edit_plan') },
        { action: 'delete-plan', icon: 'trash-2', label: t('delete_plan'), danger: true },
        { type: 'sep' },
        { action: 'plans-upload', icon: 'upload', label: t('plans_upload') },
        { type: 'sep' },
      ];
    }

    const navItems = [
      { type: 'sep' },
      { type: 'header', label: t('navigate_to') },
      { action: 'nav-overview',  icon: 'layout-dashboard', label: t('section_overview') },
      { action: 'nav-canvas',    icon: 'pen-tool',         label: t('section_canvas') },
      { action: 'nav-dashboard', icon: 'bar-chart-3',      label: t('section_dashboard') },
      { action: 'nav-timeline',  icon: 'gantt-chart',      label: t('section_timeline') },
      { action: 'nav-diary',     icon: 'clipboard-list',   label: t('section_diary') },
      { action: 'nav-files',     icon: 'folder-open',      label: t('section_files') },
    ].filter(i => i.type || i.action !== `nav-${section}`);

    switch (section) {
      case 'overview':
        return [
          { type: 'header', label: t('section_overview') },
          { action: 'refresh-overview', icon: 'refresh-cw',  label: t('refresh_overview') },
          { action: 'add-task',         icon: 'plus-circle', label: t('add_task') },
          { action: 'add-incident',     icon: 'alert-triangle', label: t('add_incident') },
          { action: 'add-supplier',     icon: 'users',       label: t('add_supplier') },
          ...navItems
        ];

      case 'canvas':
        return [
          { type: 'header', label: t('section_canvas') },
          { action: 'canvas-postit',  icon: 'sticky-note',    label: t('canvas_add_note') },
          { action: 'canvas-text',    icon: 'type',           label: t('canvas_add_text') },
          { action: 'canvas-table',   icon: 'table',          label: t('canvas_add_table') },
          { action: 'canvas-arrow',   icon: 'move-right',     label: t('canvas_draw_arrow') },
          { action: 'canvas-draw',    icon: 'pencil',         label: t('canvas_draw_free') },
          { type: 'sep' },
          { action: 'canvas-upload',  icon: 'image-plus',     label: t('canvas_upload_plan') },
          { action: 'canvas-attach',  icon: 'paperclip',      label: t('canvas_attach_file') },
          { type: 'sep' },
          { action: 'canvas-undo',    icon: 'undo-2',         label: t('undo'),        shortcut: '⌘Z' },
          { action: 'canvas-save',    icon: 'save',           label: t('save'),          shortcut: '' },
          { action: 'canvas-export',  icon: 'download',       label: t('canvas_export_image') },
          { type: 'sep' },
          { action: 'canvas-zoomfit', icon: 'maximize-2',     label: t('canvas_zoom_fit') },
          { action: 'canvas-clear',   icon: 'trash-2',        label: t('canvas_clear_all'), danger: true },
          ...navItems
        ];

      case 'dashboard':
        return [
          { type: 'header', label: t('section_dashboard') },
          { action: 'add-supplier',   icon: 'user-plus',    label: t('add_supplier') },
          { action: 'add-budget',     icon: 'plus-circle',  label: t('add_budget') },
          { type: 'sep' },
          { action: 'tab-suppliers',  icon: 'users',        label: t('view_suppliers') },
          { action: 'tab-budgets',    icon: 'calculator',   label: t('view_budgets') },
          { action: 'tab-comparator', icon: 'bar-chart-horizontal', label: t('view_comparator') },
          ...navItems
        ];

      case 'timeline':
        return [
          { type: 'header', label: t('section_timeline') },
          { action: 'add-task',        icon: 'plus-circle',  label: t('add_task') },
          { type: 'sep' },
          { action: 'view-gantt',      icon: 'gantt-chart',  label: t('view_gantt') },
          { action: 'view-list',       icon: 'list',         label: t('view_list') },
          { action: 'zoom-today',      icon: 'calendar',     label: t('go_today') },
          ...navItems
        ];

      case 'plans':
        return [
          { type: 'header', label: t('section_plans') },
          { action: 'plans-upload', icon: 'upload', label: t('plans_upload') },
          { type: 'sep' },
          { action: 'view-all-plans', icon: 'layers', label: t('view_all_plans') },
          ...navItems
        ];

      case 'diary':
        return [
          { type: 'header', label: t('section_diary') },
          { action: 'add-incident',    icon: 'plus-circle',  label: t('add_entry') },
          { type: 'sep' },
          { action: 'filter-all',      icon: 'list',          label: t('filter_all') },
          { action: 'filter-pending',  icon: 'clock',         label: t('filter_pending') },
          { action: 'filter-progress', icon: 'loader',        label: t('filter_progress') },
          { action: 'filter-resolved', icon: 'check-circle',  label: t('filter_resolved') },
          ...navItems
        ];

      case 'files':
        return [
          { type: 'header', label: t('section_files') },
          { action: 'upload-file',     icon: 'upload',       label: t('upload_file') },
          { type: 'sep' },
          { action: 'sort-date-desc',  icon: 'arrow-down-wide-narrow', label: t('sort_recent') },
          { action: 'sort-name-asc',   icon: 'arrow-up-a-z',           label: t('sort_name_asc') },
          { action: 'sort-size-desc',  icon: 'arrow-down-wide-narrow', label: t('sort_size_desc') },
          ...navItems
        ];

      default:
        return navItems;
    }
  }

  function executeContextAction(action) {
    // Navigation
    if (action.startsWith('nav-')) {
      return navigateTo(action.replace('nav-', ''));
    }

    switch (action) {
      // Overview
      case 'refresh-overview':
        OverviewModule.refresh();
        toast(t('data_refreshed'), 'success');
        break;

      // Canvas tool activations
      case 'canvas-postit':
        document.querySelector('[data-tool="postit"]').click();
        toast(t('canvas_click_to_place_note'), 'info');
        break;
      case 'canvas-text':
        document.querySelector('[data-tool="text"]').click();
        toast(t('canvas_click_to_add_text'), 'info');
        break;
      case 'canvas-table':
        document.querySelector('[data-tool="table"]').click();
        toast(t('canvas_click_to_place_table'), 'info');
        break;
      case 'canvas-arrow':
        document.querySelector('[data-tool="arrow"]').click();
        toast(t('canvas_drag_to_draw_arrow'), 'info');
        break;
      case 'canvas-draw':
        document.querySelector('[data-tool="draw"]').click();
        toast(t('canvas_draw_free'), 'info');
        break;
      case 'canvas-upload':
        document.getElementById('btn-upload-plan').click();
        break;
      case 'canvas-attach':
        document.getElementById('btn-attach-file').click();
        break;
      case 'canvas-undo':
        document.getElementById('btn-undo').click();
        break;
      case 'canvas-save':
        document.getElementById('btn-save-canvas').click();
        break;
      case 'canvas-export':
        document.getElementById('btn-export-canvas').click();
        break;
      case 'canvas-zoomfit':
        document.getElementById('btn-zoom-fit').click();
        break;
      case 'canvas-clear':
        document.getElementById('btn-clear-canvas').click();
        break;

      // Dashboard
      case 'add-supplier':
        if (currentSection !== 'dashboard') navigateTo('dashboard');
        document.getElementById('btn-add-supplier').click();
        break;
      case 'add-budget':
        if (currentSection !== 'dashboard') navigateTo('dashboard');
        setTimeout(() => document.getElementById('btn-add-budget').click(), 50);
        break;
      case 'tab-suppliers':
        document.querySelector('.sub-tab[data-subtab="suppliers"]').click();
        break;
      case 'tab-budgets':
        document.querySelector('.sub-tab[data-subtab="budgets"]').click();
        break;
      case 'tab-comparator':
        document.querySelector('.sub-tab[data-subtab="comparator"]').click();
        break;

      // Timeline
      case 'add-task':
        if (currentSection !== 'timeline') {
          navigateTo('timeline');
          setTimeout(() => document.getElementById('btn-add-task').click(), 50);
          break;
        }
        if (typeof TimelineModule !== 'undefined' && TimelineModule.openTaskFromContext) {
          TimelineModule.openTaskFromContext();
        } else {
          document.getElementById('btn-add-task').click();
        }
        break;
      case 'view-gantt':
        document.getElementById('btn-view-gantt').click();
        break;
      case 'view-list':
        document.getElementById('btn-view-list').click();
        break;
      case 'zoom-today':
        document.getElementById('btn-zoom-timeline').click();
        break;

      // Diary
      case 'add-incident':
        if (currentSection !== 'diary') navigateTo('diary');
        setTimeout(() => document.getElementById('btn-add-incident').click(), 50);
        break;
      case 'filter-all':
        document.getElementById('diary-filter').value = 'all';
        document.getElementById('diary-filter').dispatchEvent(new Event('change'));
        break;
      case 'filter-pending':
        document.getElementById('diary-filter').value = 'pending';
        document.getElementById('diary-filter').dispatchEvent(new Event('change'));
        break;
      case 'filter-progress':
        document.getElementById('diary-filter').value = 'in-progress';
        document.getElementById('diary-filter').dispatchEvent(new Event('change'));
        break;
      case 'filter-resolved':
        document.getElementById('diary-filter').value = 'resolved';
        document.getElementById('diary-filter').dispatchEvent(new Event('change'));
        break;
      case 'edit-incident':
        if (contextMenuTargetId && typeof DiaryModule !== 'undefined') {
          DiaryModule.editIncident(parseInt(contextMenuTargetId));
        }
        break;
      case 'delete-incident':
        if (contextMenuTargetId && typeof DiaryModule !== 'undefined') {
          DiaryModule.deleteIncident(parseInt(contextMenuTargetId));
        }
        break;

      // Plans
      case 'plans-upload':
        document.getElementById('btn-upload-plan-section').click();
        break;
      case 'edit-plan':
        if (contextMenuTargetId && typeof PlansModule !== 'undefined') {
          PlansModule.editPlan(parseInt(contextMenuTargetId));
        }
        break;
      case 'delete-plan':
        if (contextMenuTargetId && typeof PlansModule !== 'undefined') {
          PlansModule.deletePlan(parseInt(contextMenuTargetId));
        }
        break;
      case 'view-all-plans':
        navigateTo('plans');
        break;

      // Files
      case 'upload-file':
        document.getElementById('btn-upload-file').click();
        break;
      case 'sort-date-desc':
        document.getElementById('files-sort').value = 'date-desc';
        document.getElementById('files-sort').dispatchEvent(new Event('change'));
        break;
      case 'sort-name-asc':
        document.getElementById('files-sort').value = 'name-asc';
        document.getElementById('files-sort').dispatchEvent(new Event('change'));
        break;
      case 'sort-size-desc':
        document.getElementById('files-sort').value = 'size-desc';
        document.getElementById('files-sort').dispatchEvent(new Event('change'));
        break;
    }
  }

  // --- Service Worker ---
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js?v=15')
        .then(reg => { reg.update(); console.log('Service Worker registrado'); })
        .catch(err => console.warn('SW registro fallido:', err));
    }
  }

  return {
    init,
    navigateTo,
    openModal,
    closeModal,
    toast,
    openLightbox,
    escapeHTML,
    formatCurrency,
    formatDate,
    formatDateTime,
    daysBetween,
    generateId,
    enterProject,
    editProject,
    deleteProject,
    exportProject,
    importProject,
    syncProjectDeadlineMilestone,
    openIncident,
    t,
    setLanguage,
    translatePage,
    get currentSection() { return currentSection; },
    get projectId() { return currentProjectId; },
    get currentLanguage() { return currentLanguage; }
  };
})();
