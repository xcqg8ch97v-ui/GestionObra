/* ========================================
   IndexedDB - Capa de Datos
   Gestión de Obra PWA
   ======================================== */

const DB = (() => {
  const DB_NAME = 'GestionObraDB';
  const DB_VERSION = 3;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const database = e.target.result;

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
      };

      request.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };

      request.onerror = (e) => {
        reject(new Error('Error abriendo IndexedDB: ' + e.target.error));
      };
    });
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
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function put(storeName, data) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function remove(storeName, id) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
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

  async function saveFile(blob, name, type) {
    return add('files', {
      blob,
      name,
      type,
      createdAt: new Date().toISOString()
    });
  }

  async function getFile(id) {
    return getById('files', id);
  }

  // --- Canvas state (per project) ---

  async function saveCanvasState(projectId, jsonData) {
    const key = projectId ? 'project_' + projectId : 'current';
    return put('canvas', { id: key, data: jsonData, savedAt: new Date().toISOString() });
  }

  async function getCanvasState(projectId) {
    const key = projectId ? 'project_' + projectId : 'current';
    return getById('canvas', key);
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
    getCanvasState
  };
})();
