import { loadCollection, normalizeCollection, saveCollection } from "./collection-store.js";

const DATABASE_NAME = "casecraft-local";
const DATABASE_VERSION = 1;
const STORE_NAME = "projects";
const ACTIVE_KEY = "active-collection";
const PERSISTENCE_SETTING_KEY = "casecraft.permanentStorage.enabled";

function localStorageAvailable() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function permanentStorageEnabled() {
  try {
    return localStorageAvailable()?.getItem(PERSISTENCE_SETTING_KEY) === "true";
  } catch {
    return false;
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB tidak tersedia."));
      return;
    }
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB tidak dapat dibuka."));
  });
}

async function withStore(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Operasi IndexedDB gagal."));
      transaction.onerror = () => reject(transaction.error || new Error("Transaksi IndexedDB gagal."));
    });
  } finally {
    database.close();
  }
}

export async function loadPermanentCollection() {
  if (!permanentStorageEnabled()) return null;
  try {
    const stored = await withStore("readonly", (store) => store.get(ACTIVE_KEY));
    return normalizeCollection(stored);
  } catch {
    return null;
  }
}

export async function savePermanentCollection(collection) {
  if (!permanentStorageEnabled()) return true;
  const normalized = normalizeCollection(collection);
  if (!normalized) return false;
  try {
    await withStore("readwrite", (store) => store.put(normalized, ACTIVE_KEY));
    return true;
  } catch {
    return false;
  }
}

export async function clearPermanentCollection() {
  try {
    await withStore("readwrite", (store) => store.delete(ACTIVE_KEY));
    return true;
  } catch {
    return false;
  }
}

export async function setPermanentStorage(enabled, collection) {
  const storage = localStorageAvailable();
  if (!storage) return false;
  try {
    if (enabled) {
      storage.setItem(PERSISTENCE_SETTING_KEY, "true");
      const saved = await savePermanentCollection(collection);
      if (!saved) storage.setItem(PERSISTENCE_SETTING_KEY, "false");
      return saved;
    }
    const cleared = await clearPermanentCollection();
    if (cleared) storage.setItem(PERSISTENCE_SETTING_KEY, "false");
    return cleared;
  } catch {
    return false;
  }
}

export async function loadBestCollection() {
  const sessionCollection = loadCollection();
  if (sessionCollection) return sessionCollection;
  const permanentCollection = await loadPermanentCollection();
  if (permanentCollection) saveCollection(permanentCollection);
  return permanentCollection;
}

export function saveActiveCollection(collection) {
  const sessionSaved = saveCollection(collection);
  const permanentSave = permanentStorageEnabled() ? savePermanentCollection(collection) : Promise.resolve(true);
  return { sessionSaved, permanentSave };
}
