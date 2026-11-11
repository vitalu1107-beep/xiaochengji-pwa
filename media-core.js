/* Shared data helpers for the offline Small Wins client. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SmallWinsMedia = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MAX_IMAGES_PER_RECORD = 3;
  const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
  const ACCEPTED_IMAGE = /^image\/(jpeg|png|webp)$/i;

  function extractTags(text) {
    const result = [];
    const seen = new Set();
    const matches = String(text || '').matchAll(/#([^\s#]+)/g);
    for (const match of matches) {
      const tag = match[1].replace(/[，。！？,.!?;；:：]+$/g, '');
      if (tag && !seen.has(tag)) { seen.add(tag); result.push(tag); }
    }
    return result;
  }

  function normalizeRecord(record) {
    const value = record && typeof record === 'object' ? record : {};
    const text = typeof value.text === 'string' ? value.text : '';
    return {
      ...value,
      tags: Array.isArray(value.tags) ? [...new Set(value.tags.filter(Boolean).map(String))] : extractTags(text),
      mediaIds: Array.isArray(value.mediaIds) ? value.mediaIds.filter(Boolean).map(String) : [],
    };
  }

  function validateImageMeta(file) {
    return Boolean(file && ACCEPTED_IMAGE.test(file.type || '') && Number.isFinite(file.size) && file.size <= MAX_SOURCE_BYTES);
  }

  function shuffle(source, random = Math.random) {
    const values = [...source];
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }

  function createReviewDeck(ids, random = Math.random) {
    const source = [...ids];
    let order = shuffle(source, random);
    let index = -1;
    let previousLast = null;
    function reshuffle() {
      order = shuffle(source, random);
      if (order.length > 1 && previousLast != null && order[0] === previousLast) {
        [order[0], order[1]] = [order[1], order[0]];
      }
      index = -1;
    }
    return {
      next() {
        if (!order.length) return null;
        if (index + 1 >= order.length) {
          previousLast = order[index] ?? previousLast;
          reshuffle();
        }
        index += 1;
        return order[index];
      },
      previous() {
        if (index > 0) index -= 1;
        return order[index] ?? null;
      },
      current() { return order[index] ?? null; },
      position() { return index < 0 ? 0 : index + 1; },
      size() { return order.length; },
      reset() { previousLast = null; reshuffle(); },
    };
  }

  function idForMedia() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function createMemoryMediaStore() {
    const values = new Map();
    return {
      async put(blob, metadata = {}) {
        const id = idForMedia();
        values.set(id, {blob, metadata});
        return id;
      },
      async get(id) { return values.get(id)?.blob || null; },
      async getMeta(id) { return values.get(id)?.metadata || null; },
      async deleteMany(ids) { for (const id of ids || []) values.delete(id); },
      async clear() { values.clear(); },
      async estimate() { let bytes = 0; for (const {blob} of values.values()) bytes += blob?.size || 0; return {usage: bytes, quota: 0}; },
    };
  }

  function createIndexedDbMediaStore(indexedDbRef) {
    if (!indexedDbRef) return createMemoryMediaStore();
    let databasePromise;
    const open = () => {
      if (!databasePromise) {
        databasePromise = new Promise((resolve, reject) => {
          const request = indexedDbRef.open('smallwins_media_v1', 1);
          request.onerror = () => reject(request.error || new Error('IndexedDB unavailable'));
          request.onupgradeneeded = () => request.result.createObjectStore('blobs');
          request.onsuccess = () => resolve(request.result);
        });
      }
      return databasePromise;
    };
    const transaction = async (mode, action) => {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('blobs', mode);
        const store = tx.objectStore('blobs');
        let request;
        try { request = action(store); } catch (error) { reject(error); return; }
        if (request) {
          request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
          request.onsuccess = () => resolve(request.result);
        }
        tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
        tx.oncomplete = () => resolve(request?.result);
      });
    };
    return {
      async put(blob, metadata = {}) {
        const id = idForMedia();
        await transaction('readwrite', store => store.put({blob, metadata}, id));
        return id;
      },
      async get(id) { return (await transaction('readonly', store => store.get(id)))?.blob || null; },
      async getMeta(id) { return (await transaction('readonly', store => store.get(id)))?.metadata || null; },
      async deleteMany(ids) { await transaction('readwrite', store => { for (const id of ids || []) store.delete(id); return null; }); },
      async clear() { await transaction('readwrite', store => store.clear()); },
      async estimate() {
        const items = await transaction('readonly', store => store.getAll());
        const usage = (items || []).reduce((total, item) => total + Number(item?.metadata?.size || item?.blob?.size || 0), 0);
        return {usage, quota: 0};
      },
    };
  }

  return {MAX_IMAGES_PER_RECORD, MAX_SOURCE_BYTES, extractTags, normalizeRecord, validateImageMeta, shuffle, createReviewDeck, createMemoryMediaStore, createIndexedDbMediaStore};
});
