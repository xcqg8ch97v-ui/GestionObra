/* ========================================
   Firebase — Auth + Firestore + Storage Sync
   Gestión de Obra PWA
   ======================================== */

const FirebaseSync = (() => {

  // ── Config ──────────────────────────────
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDtpHfLPLh3FW9tQ6ZF7LvrP2xFnWgfZM8",
    authDomain: "gestionobraweb.firebaseapp.com",
    projectId: "gestionobraweb",
    storageBucket: "gestionobraweb.firebasestorage.app",
    messagingSenderId: "834830006871",
    appId: "1:834830006871:web:9e65c0dc3b3f9e27da8112"
  };

  // Stores que van a Firestore (sin archivos binarios)
  const FIRESTORE_STORES = [
    'projects', 'tasks', 'incidents', 'suppliers',
    'budgets', 'participants', 'plans', 'canvas',
    'custom_categories'
  ];

  // Stores que van a Firebase Storage (binarios)
  const STORAGE_STORES = ['files'];

  let app = null;
  let auth = null;
  let db = null;
  let storage = null;
  let currentUser = null;
  let _onAuthChange = null;
  let _initialized = false;

  // ── Init ────────────────────────────────
  function init() {
    if (_initialized) return;
    _initialized = true;

    app      = firebase.initializeApp(FIREBASE_CONFIG);
    auth     = firebase.auth();
    db       = firebase.firestore();
    storage  = firebase.storage();

    // Enable offline persistence for Firestore
    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firebase] Persistence failed (multiple tabs)');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firebase] Persistence not supported in this browser');
      }
    });

    auth.onAuthStateChanged(user => {
      currentUser = user;
      if (_onAuthChange) _onAuthChange(user);
    });

    // Capturar resultado de signInWithRedirect al volver
    auth.getRedirectResult().then(result => {
      if (result && result.user) {
        console.log('[Firebase] Redirect login ok:', result.user.displayName);
      }
    }).catch(err => {
      if (err.code && err.code !== 'auth/no-current-user') {
        console.error('[Firebase] Redirect result error:', err);
      }
    });
  }

  // ── Auth ────────────────────────────────
  async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    // signInWithRedirect funciona en todos los entornos (https, Safari, iPad)
    // signInWithPopup falla en file:// y algunos contextos Safari
    try {
      // Intentar popup primero (más rápido en desktop Chrome/Firefox)
      await auth.signInWithPopup(provider);
    } catch(e) {
      if (e.code === 'auth/operation-not-supported-in-this-environment' ||
          e.code === 'auth/popup-blocked' ||
          e.code === 'auth/popup-closed-by-user') {
        // Fallback a redirect (funciona en Safari, iPad, file://)
        await auth.signInWithRedirect(provider);
      } else {
        throw e;
      }
    }
  }

  function logout() {
    return auth.signOut();
  }

  function onAuthChange(callback) {
    _onAuthChange = callback;
    if (currentUser !== null) callback(currentUser);
  }

  function getUser() { return currentUser; }

  // ── Firestore path helpers ───────────────
  function userPath(uid) {
    return `users/${uid}`;
  }

  function colPath(uid, store) {
    return `users/${uid}/${store}`;
  }

  // Convert IndexedDB numeric id to string for Firestore
  function toFsId(id) { return String(id); }

  // ── Firestore CRUD ───────────────────────
  async function fsSet(store, record) {
    if (!currentUser) return;
    if (!FIRESTORE_STORES.includes(store)) return;
    const { id, ...data } = record;
    if (id === undefined || id === null) return;
    const stripped = stripBinary(data);
    await db.collection(colPath(currentUser.uid, store))
            .doc(toFsId(id))
            .set({ ...stripped, _localId: id, _syncedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }

  async function fsDelete(store, id) {
    if (!currentUser) return;
    if (!FIRESTORE_STORES.includes(store)) return;
    await db.collection(colPath(currentUser.uid, store))
            .doc(toFsId(id))
            .delete();
  }

  async function fsPullAll(store) {
    if (!currentUser) return [];
    if (!FIRESTORE_STORES.includes(store)) return [];
    const snap = await db.collection(colPath(currentUser.uid, store)).get();
    return snap.docs.map(d => ({ ...d.data(), id: d.data()._localId ?? d.id }));
  }

  // ── Storage (binary files) ───────────────
  async function storageSave(record) {
    if (!currentUser) return null;
    const { id, data, blob, type, name, projectId } = record;
    if (!id) return null;

    const binary = blob instanceof Blob ? blob
      : data ? new Blob([data], { type: type || 'application/octet-stream' })
      : null;
    if (!binary) return null;

    const path = `users/${currentUser.uid}/files/${id}_${name || id}`;
    const ref = storage.ref(path);
    await ref.put(binary, { contentType: type });
    const url = await ref.getDownloadURL();

    // Save metadata to Firestore
    await db.collection(colPath(currentUser.uid, 'files'))
            .doc(toFsId(id))
            .set({
              _localId: id, id, name, type, size: binary.size,
              projectId, storagePath: path, downloadUrl: url,
              _syncedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
    return url;
  }

  async function storageDelete(id, storagePath) {
    if (!currentUser) return;
    try {
      if (storagePath) await storage.ref(storagePath).delete();
    } catch(e) { console.warn('[Firebase] Storage delete error:', e); }
    await db.collection(colPath(currentUser.uid, 'files'))
            .doc(toFsId(id)).delete();
  }

  async function storagePullAll() {
    if (!currentUser) return [];
    const snap = await db.collection(colPath(currentUser.uid, 'files')).get();
    return snap.docs.map(d => d.data());
  }

  // ── Full project pull (first load / device sync) ──
  async function pullAllToLocal() {
    if (!currentUser) return;
    console.log('[Firebase] Pulling all data from Firestore…');

    for (const store of FIRESTORE_STORES) {
      try {
        const records = await fsPullAll(store);
        for (const record of records) {
          const existing = await window.DB.getById(store, record._localId ?? record.id);
          if (!existing) {
            await window.DB.put(store, record);
          } else {
            // Merge: remote wins if more recent
            const remoteTs = record.updatedAt || record.createdAt || '';
            const localTs  = existing.updatedAt || existing.createdAt || '';
            if (remoteTs > localTs) await window.DB.put(store, record);
          }
        }
        console.log(`[Firebase] Pulled ${records.length} records from ${store}`);
      } catch(e) {
        console.warn(`[Firebase] Error pulling ${store}:`, e);
      }
    }
    console.log('[Firebase] Pull complete.');
  }

  // ── Push all local data to Firebase (first sync) ──
  async function pushAllToFirebase() {
    if (!currentUser) return;
    console.log('[Firebase] Pushing all local data to Firestore…');

    for (const store of FIRESTORE_STORES) {
      try {
        const records = await window.DB.getAll(store);
        for (const record of records) {
          await fsSet(store, record);
        }
        console.log(`[Firebase] Pushed ${records.length} records from ${store}`);
      } catch(e) {
        console.warn(`[Firebase] Error pushing ${store}:`, e);
      }
    }

    // Push binary files to Storage
    try {
      const files = await window.DB.getAll('files');
      for (const file of files) {
        await storageSave(file);
      }
      console.log(`[Firebase] Pushed ${files.length} files to Storage`);
    } catch(e) {
      console.warn('[Firebase] Error pushing files:', e);
    }

    console.log('[Firebase] Push complete.');
  }

  // ── Helpers ─────────────────────────────
  function stripBinary(obj) {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v instanceof ArrayBuffer || v instanceof Blob ||
          (typeof v === 'object' && v !== null && v.buffer instanceof ArrayBuffer)) {
        continue; // skip binary
      }
      clean[k] = v;
    }
    return clean;
  }

  function isEnabled() { return !!currentUser; }

  return {
    init,
    loginWithGoogle,
    logout,
    onAuthChange,
    getUser,
    isEnabled,
    fsSet,
    fsDelete,
    fsPullAll,
    storageSave,
    storageDelete,
    storagePullAll,
    pullAllToLocal,
    pushAllToFirebase
  };
})();
