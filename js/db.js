/* ========================================
   IndexedDB - Capa de Datos
   Gestión de Obra PWA
   ======================================== */

const DB = (() => {
// Actualizado: 2026-04-10
  const DB_NAME = 'GestionObraDB';
  const DB_VERSION = 6; // bump para custom_categories
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) { console.log('[DB] Ya abierta'); resolve(db); return; }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        console.log('[DB] onupgradeneeded');
        // ...existing code...
        // Categorías personalizadas por proyecto
        if (!database.objectStoreNames.contains('custom_categories')) {
          const store = database.createObjectStore('custom_categories', { keyPath: 'id', autoIncrement: true });
          store.createIndex('projectId', 'projectId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
        // Proyectos / Obras
        if (!database.objectStoreNames.contains('projects')) {
          const store = database.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
          store.createIndex('status', 'status', { unique: false });
        }
        // Proveedores / Subcontratas
        if (!database.objectStoreNames.contains('suppliers')) {
          const store = database.createObjectStore('suppliers', { keyPath: 'id', autoIncrement: true });
          store.createIndex('trade', 'trade', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('projectId', 'projectId', { unique: false });
        } else {
          const tx = e.target.transaction;
          const store = tx.objectStore('suppliers');
          if (!store.indexNames.contains('projectId')) {
            store.createIndex('projectId', 'projectId', { unique: false });
          }
        }
        // Partidas presupuestarias
        if (!database.objectStoreNames.contains('budgets')) {
          const store = database.createObjectStore('budgets', { keyPath: 'id', autoIncrement: true });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('supplierId', 'supplierId', { unique: false });
          store.createIndex('projectId', 'projectId', { unique: false });
        } else {
          const tx = e.target.transaction;
          const store = tx.objectStore('budgets');
          if (!store.indexNames.contains('projectId')) {
            store.createIndex('projectId', 'projectId', { unique: false });
          }
        }
        // Tareas del cronograma
        if (!database.objectStoreNames.contains('tasks')) {
          const store = database.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('projectId', 'projectId', { unique: false });
        } else {
          const tx = e.target.transaction;
          const store = tx.objectStore('tasks');
          if (!store.indexNames.contains('projectId')) {
            store.createIndex('projectId', 'projectId', { unique: false });
          }
        }
        // Incidencias del diario
        if (!database.objectStoreNames.contains('incidents')) {
          const store = database.createObjectStore('incidents', { keyPath: 'id', autoIncrement: true });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('projectId', 'projectId', { unique: false });
        } else {
          const tx = e.target.transaction;
          const store = tx.objectStore('incidents');
          if (!store.indexNames.contains('projectId')) {
            store.createIndex('projectId', 'projectId', { unique: false });
          }
        }
        // Archivos y fotos (blobs)
        if (!database.objectStoreNames.contains('files')) {
          const filesStore = database.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
          filesStore.createIndex('projectId', 'projectId', { unique: false });
        } else {
          const filesTx = e.target.transaction;
          const filesStore = filesTx.objectStore('files');
          if (!filesStore.indexNames.contains('projectId')) {
            filesStore.createIndex('projectId', 'projectId', { unique: false });
          }
        }
        // Estado del canvas (por proyecto)
        if (!database.objectStoreNames.contains('canvas')) {
          database.createObjectStore('canvas', { keyPath: 'id' });
        }
        // Participantes / Contactos
        if (!database.objectStoreNames.contains('participants')) {
          const store = database.createObjectStore('participants', { keyPath: 'id', autoIncrement: true });
          store.createIndex('projectId', 'projectId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
        // Planos de obra
        if (!database.objectStoreNames.contains('plans')) {
          const store = database.createObjectStore('plans', { keyPath: 'id', autoIncrement: true });
          store.createIndex('projectId', 'projectId', { unique: false });
          store.createIndex('category', 'category', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        db = e.target.result;
        console.log('[DB] abierta correctamente');
        resolve(db);
      };

      request.onerror = (e) => {
        console.error('[DB] Error abriendo IndexedDB:', e.target.error);
        // Forzar limpieza automática si hay error de versión o corrupción
        if (e.target.error && (e.target.error.name === 'VersionError' || e.target.error.name === 'InvalidStateError' || e.target.error.name === 'UnknownError')) {
          console.warn('[DB] Intentando borrar base de datos corrupta...');
          const deleteReq = indexedDB.deleteDatabase(DB_NAME);
          deleteReq.onsuccess = () => {
            console.warn('[DB] Base de datos borrada. Recargando página...');
            location.reload();
          };
          deleteReq.onerror = () => {
            alert('No se pudo reparar la base de datos. Prueba a limpiar el almacenamiento del navegador manualmente.');
            reject(new Error('No se pudo borrar la base de datos.'));
          };
        } else {
          alert('Error abriendo la base de datos. Prueba a limpiar el almacenamiento del navegador.');
          reject(new Error('Error abriendo IndexedDB: ' + e.target.error));
        }
      };
    });
  }

  // --- Custom categories helpers ---
  async function addCustomCategory(projectId, type, name, action = 'add') {
    return add('custom_categories', { projectId, type, name, action });
  }

  async function getCustomCategories(projectId, type, action = 'add') {
    const all = await getByIndex('custom_categories', 'projectId', projectId);
    return all.filter(c => c.type === type && c.action === action);
  }

  async function removeCustomCategory(id) {
    return remove('custom_categories', id);
  }

  // --- CRUD Genérico ---

  async function getAll(storeName) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getById(storeName, id) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function add(storeName, data) {
    const database = await open();
    const id = await new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    // Firebase sync
    if (!window._fbSyncSuppressed && typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
      const record = { ...data, id };
      if (storeName === 'files') {
        FirebaseSync.storageSave(record).catch(e => console.warn('[FB] storageSave error:', e));
      } else {
        FirebaseSync.fsSet(storeName, record).catch(e => console.warn('[FB] fsSet error:', e));
      }
    }
    return id;
  }

  async function put(storeName, data) {
    const database = await open();
    const result = await new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    // Firebase sync
    if (!window._fbSyncSuppressed && typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
      if (storeName === 'files') {
        FirebaseSync.storageSave(data).catch(e => console.warn('[FB] storageSave error:', e));
      } else {
        FirebaseSync.fsSet(storeName, data).catch(e => console.warn('[FB] fsSet error:', e));
      }
    }
    return result;
  }

  async function remove(storeName, id) {
    const database = await open();
    // Get storage path before deleting locally (for files)
    let storagePath = null;
    if (storeName === 'files' && typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
      const record = await getById('files', id);
      storagePath = record?.storagePath || null;
    }
    await new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    // Firebase sync
    if (!window._fbSyncSuppressed && typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
      if (storeName === 'files') {
        FirebaseSync.storageDelete(id, storagePath).catch(e => console.warn('[FB] storageDelete error:', e));
      } else {
        FirebaseSync.fsDelete(storeName, id).catch(e => console.warn('[FB] fsDelete error:', e));
      }
    }
  }

  async function clearStore(storeName) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function getByIndex(storeName, indexName, value) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // --- File helpers ---

  async function saveFile(blob, name, type, projectId = null) {
    const data = await blob.arrayBuffer();
    return add('files', {
      projectId,
      name,
      type,
      size: blob.size,
      data,
      createdAt: new Date().toISOString(),
      uploadedAt: new Date().toISOString()
    });
  }

  async function getFile(id) {
    return getById('files', id);
  }

  // --- Canvas state (per project, multi-sheet) ---

  async function saveCanvasState(projectId, jsonData, sheetId) {
    // New multi-sheet format: key = project_{id}_sheet_{sheetId}
    if (sheetId) {
      const key = `project_${projectId}_sheet_${sheetId}`;
      return put('canvas', { id: key, data: jsonData, savedAt: new Date().toISOString() });
    }
    // Legacy single-sheet fallback
    const key = projectId ? 'project_' + projectId : 'current';
    return put('canvas', { id: key, data: jsonData, savedAt: new Date().toISOString() });
  }

  async function getCanvasState(projectId, sheetId) {
    if (sheetId) {
      const key = `project_${projectId}_sheet_${sheetId}`;
      return getById('canvas', key);
    }
    const key = projectId ? 'project_' + projectId : 'current';
    return getById('canvas', key);
  }

  async function saveSheetIndex(projectId, sheets) {
    const key = `project_${projectId}_sheets`;
    return put('canvas', { id: key, sheets, savedAt: new Date().toISOString() });
  }

  async function getSheetIndex(projectId) {
    const key = `project_${projectId}_sheets`;
    return getById('canvas', key);
  }

  async function deleteCanvasSheet(projectId, sheetId) {
    const key = `project_${projectId}_sheet_${sheetId}`;
    return remove('canvas', key);
  }

  // --- Project-scoped helpers ---

  async function getAllForProject(storeName, projectId) {
    if (!projectId) return getAll(storeName);
    return getByIndex(storeName, 'projectId', projectId);
  }

  return {
    open,
    getAll,
    getById,
    add,
    put,
    remove,
    clearStore,
    getByIndex,
    getAllForProject,
    saveFile,
    getFile,
    saveCanvasState,
    getCanvasState,
    saveSheetIndex,
    getSheetIndex,
    deleteCanvasSheet,
    addCustomCategory,
    getCustomCategories,
    removeCustomCategory
  };
})();
