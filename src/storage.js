import { LIMITS, validateSession, migrateV1 } from './core.js';
// Never write v2 data under the old key: an already-open v1 tab deletes data it
// cannot validate. Keys are shared across paths on the same origin.
export const STORAGE_KEY = 'answer-lens.session.v2';
export const LEGACY_KEY = 'answer-lens.session.v1';
export const LOCK_NAME = 'answer-lens-device-v2';
const conflict = () => ({ ok: false, conflict: true, message: 'Another tab changed saved data. Your work is still in this tab; saving is paused.' });
const unavailable = () => ({ ok: false, message: 'Not saved. Device saving is unavailable or full. This tab still works; copy or export before leaving.' });
function decode(raw) {
  if (raw.length > LIMITS.json) throw new Error('Oversized saved data.');
  const session = validateSession(JSON.parse(raw));
  if (!session.remember) throw new Error('Saved data has no persistence consent.');
  return session;
}
export function loadLocal(getStorage = () => localStorage) {
  let raw;
  try {
    raw = getStorage().getItem(STORAGE_KEY);
    if (raw === null) return { session: null, raw, ok: true };
    return { session: decode(raw), raw, ok: true };
  } catch {
    // Unknown, malformed and future records remain untouched. Reading is never deletion.
    if (typeof raw === 'string') return { session: null, raw, ok: false, protected: true,
      message: 'A newer or unreadable saved comparison was left untouched. Work in this tab and copy or export; this version will not replace it.' };
    return { session: null, raw: null, ok: false, message: 'Device storage is unavailable. Work stays in this tab; copy or export before leaving.' };
  }
}
// The UI executes these operations under a Web Lock and always supplies the
// observed raw snapshot. Direct Node tests inject storage; no browser is needed.
export function saveLocal(session, getStorage = () => localStorage, expectedRaw = undefined) {
  if (!session.remember) return clearLocal(getStorage, expectedRaw);
  try {
    const valid = validateSession(session);
    const storage = getStorage(); const before = storage.getItem(STORAGE_KEY);
    if (expectedRaw !== undefined && before !== expectedRaw) return conflict();
    if (before !== null) {
      try { decode(before); } catch { return { ...loadLocal(getStorage), ok: false }; }
    }
    const raw = JSON.stringify(valid);
    storage.setItem(STORAGE_KEY, raw);
    if (storage.getItem(STORAGE_KEY) !== raw) return conflict();
    return { ok: true, raw };
  } catch { return unavailable(); }
}
export function clearLocal(getStorage = () => localStorage, expectedRaw = undefined) {
  try {
    const storage = getStorage(); const before = storage.getItem(STORAGE_KEY);
    if (expectedRaw !== undefined && before !== expectedRaw) return conflict();
    if (before !== null) {
      try { decode(before); } catch { return { ...loadLocal(getStorage), ok: false }; }
    }
    storage.removeItem(STORAGE_KEY);
    return { ok: true, raw: null };
  } catch { return { ok: false, message: 'The browser blocked deleting saved data. The saved copy may remain. Clear it in browser settings when safe; this tab still works.' }; }
}
export function loadLegacy(getStorage = () => localStorage) {
  try {
    const raw = getStorage().getItem(LEGACY_KEY);
    if (raw === null) return { session: null, ok: true };
    if (raw.length > LIMITS.json) throw new Error('Oversized v1 record.');
    const parsed = JSON.parse(raw);
    if (parsed.remember !== true) throw new Error('No v1 consent.');
    return { session: migrateV1(parsed), ok: true };
  } catch { return { session: null, ok: false, message: 'An older saved comparison could not be opened; it was not changed.' }; }
}
