import type { AppData, Session, SyncLogEntry } from './types';
import { configFingerprint } from './appConfig';
import { normalizeData } from './pricing';

export const KEYS = {
  data: 'mv:local-data:v2',
  meta: 'mv:local-meta:v2',
  snapshot: 'mv:snapshot:v1',
  session: 'mv:session:v1',
  pending: 'mv:pending:v1',
  synclog: 'mv:synclog:v1',
} as const;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {
    console.error('localStorage write failed', key, e);
  }
}
function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ---- локальные данные (правки админа) ---- */
export function saveLocal(d: AppData) {
  write(KEYS.data, d);
}
export function loadLocal(): AppData | null {
  const d = read<unknown>(KEYS.data);
  return d ? normalizeData(d) : null;
}
export function clearLocal() {
  remove(KEYS.data);
}

/* ---- dirty ---- */
interface Meta {
  dirty: boolean;
  at: string;
}
export function markDirty() {
  write(KEYS.meta, { dirty: true, at: new Date().toISOString() } satisfies Meta);
}
export function clearDirty() {
  write(KEYS.meta, { dirty: false, at: new Date().toISOString() } satisfies Meta);
}
export function isDirty(): boolean {
  return !!read<Meta>(KEYS.meta)?.dirty;
}
export function dirtyAt(): string | null {
  const m = read<Meta>(KEYS.meta);
  return m?.dirty ? m.at : null;
}

/* ---- снапшот сети (привязан к конфигу) ---- */
interface Snap {
  fp: string;
  at: string;
  data: AppData;
}
export function saveSnapshot(d: AppData) {
  write(KEYS.snapshot, { fp: configFingerprint(), at: new Date().toISOString(), data: d } satisfies Snap);
}
export function loadSnapshot(): AppData | null {
  const s = read<Snap>(KEYS.snapshot);
  if (!s || s.fp !== configFingerprint()) return null;
  return normalizeData(s.data);
}
export function clearSnapshot() {
  remove(KEYS.snapshot);
}

/* ---- сессия ---- */
export function saveSession(s: Session) {
  write(KEYS.session, s);
}
export function loadSession(): Session | null {
  return read<Session>(KEYS.session);
}
export function clearSession() {
  remove(KEYS.session);
}

/* ---- очередь неотправленного ---- */
interface Pending {
  at: string;
  data: AppData;
}
export function savePending(d: AppData) {
  write(KEYS.pending, { at: new Date().toISOString(), data: d } satisfies Pending);
}
export function loadPending(): AppData | null {
  const p = read<Pending>(KEYS.pending);
  return p?.data ? normalizeData(p.data) : null;
}
export function pendingAt(): string | null {
  return read<Pending>(KEYS.pending)?.at ?? null;
}
export function clearPending() {
  remove(KEYS.pending);
}

/* ---- журнал синхронизаций (20) ---- */
export function writeSyncLog(e: Omit<SyncLogEntry, 'at'>) {
  const list = read<SyncLogEntry[]>(KEYS.synclog) ?? [];
  list.unshift({ ...e, at: new Date().toISOString() });
  write(KEYS.synclog, list.slice(0, 20));
}
export function readSyncLog(): SyncLogEntry[] {
  return read<SyncLogEntry[]>(KEYS.synclog) ?? [];
}

/* ---- полный сброс локального состояния ---- */
export function resetAllLocal() {
  clearLocal();
  clearSnapshot();
  clearPending();
  clearDirty();
  remove(KEYS.synclog);
}
