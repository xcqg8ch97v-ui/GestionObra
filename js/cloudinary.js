/* ========================================
   Cloudinary — Upload / Download de archivos
   Gestión de Obra PWA
   Solo usa cloud name + upload preset (sin API Secret en frontend)
   ======================================== */

const CloudinarySync = (() => {

  const CLOUD_NAME   = 'dfnrs9jtd';
  const UPLOAD_PRESET = 'gestion-obra';
  const UPLOAD_URL   = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

  // ── Upload file (Blob o ArrayBuffer) ────
  async function uploadFile(fileRecord) {
    const { data, blob, type, name, id, projectId } = fileRecord;

    const binary = blob instanceof Blob ? blob
      : data ? new Blob([data], { type: type || 'application/octet-stream' })
      : null;
    if (!binary) throw new Error('No hay datos binarios para subir');

    const uid = (typeof FirebaseSync !== 'undefined' && FirebaseSync.getUser())
      ? FirebaseSync.getUser().uid
      : 'anon';

    const formData = new FormData();
    formData.append('file', binary, name || `file_${id}`);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', `gestion-obra/${uid}/${projectId || 'general'}`);
    formData.append('context', `localId=${id}|projectId=${projectId}|name=${name}`);

    const resp = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${resp.status}`);
    }
    const result = await resp.json();
    return {
      cloudinaryPublicId: result.public_id,
      cloudinaryUrl:      result.secure_url,
      cloudinaryFormat:   result.format,
      cloudinaryBytes:    result.bytes
    };
  }

  // ── Delete file ─────────────────────────
  // Nota: borrado requiere firma (API Secret) — omitido en plan gratuito frontend
  // Los archivos se borran manualmente desde Cloudinary Console si es necesario

  // ── Push all local files to Cloudinary ──
  async function pushAllFiles() {
    const files = await DB.getAll('files');
    console.log(`[Cloudinary] ${files.length} archivos locales`);
    let ok = 0, fail = 0;

    for (const file of files) {
      if (file.cloudinaryUrl) { ok++; continue; } // ya subido
      try {
        const meta = await uploadFile(file);
        // Guardar URL en IndexedDB y Firestore
        const updated = { ...file, ...meta };
        window._fbSyncSuppressed = true;
        await DB.put('files', updated);
        window._fbSyncSuppressed = false;
        if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
          const { data, blob, ...cleanMeta } = updated;
          await FirebaseSync.fsSet('files', cleanMeta);
        }
        ok++;
        console.log(`[Cloudinary] ✅ ${file.name} → ${meta.cloudinaryUrl}`);
      } catch(e) {
        fail++;
        console.error(`[Cloudinary] ❌ ${file.name}:`, e.message);
      }
    }
    return { ok, fail };
  }

  // ── Pull: restaurar URL de Cloudinary desde Firestore ──
  // Los binarios se descargan bajo demanda al visualizar, no en bulk
  async function getDownloadUrl(fileRecord) {
    return fileRecord.cloudinaryUrl || null;
  }

  return {
    uploadFile,
    pushAllFiles,
    getDownloadUrl,
    CLOUD_NAME,
    UPLOAD_PRESET
  };
})();
