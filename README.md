# Abessis — Gestión de Obra

Aplicación web progresiva (PWA) para el control integral de obras de construcción y reformas. Diseñada para arquitectos, jefes de obra y project managers que necesitan una herramienta completa y offline-first desde cualquier dispositivo.

## Características

### Mesa de Trabajo (Canvas)
- Pizarra digital con Fabric.js: post-its, texto, flechas, dibujo libre y tablas editables.
- Adjuntar archivos e imágenes directamente al canvas (renombrar, descargar, eliminar).
- Multi-hoja: crear, renombrar y eliminar hojas de trabajo.
- Zoom (rueda de ratón / pinch), pan (Alt+arrastrar / dos dedos), exportar a imagen.
- Soporte táctil completo: long-press para menú contextual, pinch-to-zoom, tablas en touch.

### Proveedores y Presupuestos
- Alta de proveedores/subcontratas con gremio, datos de contacto y valoración.
- Partidas presupuestarias vinculadas a proveedores.
- Comparador visual de ofertas.

### Cronograma de Obra
- Vista Gantt interactiva con fases, hitos y dependencias.
- Vista lista alternativa con filtros por estado y categoría.
- Arrastre para modificar fechas.

### Diario de Incidencias
- Registro de incidencias con estado (pendiente / en proceso / resuelta).
- Adjuntar fotos desde cámara o galería.
- Filtrado por estado y búsqueda.

### Documentos de Obra
- Subida y almacenamiento de archivos en IndexedDB (hasta 50 MB por archivo).
- Previsualización de imágenes, descarga directa.

### Participantes
- Gestión de contactos internos y externos de la obra.
- 19 roles de construcción predefinidos.
- Acciones directas: llamar, enviar email.

### Informes PDF
- Generación de informe completo con portada, KPIs, fases, tareas, presupuesto, incidencias, proveedores y participantes.
- Powered by jsPDF + AutoTable.

### Otras funcionalidades
- **Multi-proyecto**: gestionar varias obras de forma independiente.
- **Exportar / Importar**: copia de seguridad completa por obra en formato JSON.
- **Modo claro / oscuro**: con persistencia en localStorage.
- **Offline-first**: Service Worker con estrategia network-first y fallback a cache.
- **Responsive**: diseñado para escritorio, tablet y móvil.
- **Menú contextual**: clic derecho para acciones rápidas por sección.

## Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, JavaScript vanilla (ES6+) |
| Canvas | [Fabric.js 5.3.1](http://fabricjs.com/) |
| Iconos | [Lucide Icons](https://lucide.dev/) |
| PDF | [jsPDF 2.5.1](https://github.com/parallax/jsPDF) + [AutoTable 3.8.4](https://github.com/simonbengtsson/jsPDF-AutoTable) |
| Base de datos | IndexedDB (8 stores, esquema v4) |
| Offline | Service Worker (cache v3, network-first) |

Sin frameworks, sin bundlers, sin dependencias locales. Todo corre directamente en el navegador.

## Estructura del proyecto

```
Gestion Obra/
├── index.html              # App shell (587 líneas)
├── css/
│   └── styles.css          # Estilos + tema claro/oscuro (3325 líneas)
├── js/
│   ├── db.js               # Capa IndexedDB (CRUD, canvas, sheets)
│   ├── app.js              # Navegación, modal, toast, tema, export/import
│   └── modules/
│       ├── canvas.js        # Mesa de trabajo (Fabric.js, tablas, archivos)
│       ├── dashboard.js     # Proveedores y presupuestos
│       ├── timeline.js      # Cronograma Gantt
│       ├── diary.js         # Diario de incidencias
│       ├── overview.js      # Vista general / KPIs
│       ├── files.js         # Gestión de documentos
│       ├── participants.js  # Participantes de la obra
│       └── report.js        # Generación de PDF
├── img/                    # Logos
├── manifest.json           # Web App Manifest (PWA)
└── sw.js                   # Service Worker
```

## Instalación

No requiere instalación. Sirve los archivos con cualquier servidor HTTP estático:

```bash
# Python
python3 -m http.server 8080

# Node.js (si tienes http-server)
npx http-server -p 8080
```

Abre `http://localhost:8080` en el navegador.

### Instalar como PWA

En Chrome/Edge/Safari, abre la app y busca la opción **"Instalar"** o **"Añadir a pantalla de inicio"** en el menú del navegador.

## Base de datos

IndexedDB local con las siguientes stores:

| Store | Clave | Índices |
|---|---|---|
| `projects` | `id` (auto) | `status` |
| `suppliers` | `id` (auto) | `trade`, `status`, `projectId` |
| `budgets` | `id` (auto) | `category`, `supplierId`, `projectId` |
| `tasks` | `id` (auto) | `category`, `projectId` |
| `incidents` | `id` (auto) | `status`, `date`, `projectId` |
| `files` | `id` (auto) | `projectId` |
| `canvas` | `id` (string) | — |
| `participants` | `id` (auto) | `projectId`, `type` |

## Licencia

Proyecto privado — Abessis.
