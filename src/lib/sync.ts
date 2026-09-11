import type { AppData, PushResult } from './types';
import { REQUIRED_GAS_VERSION, getConfig, hasGas, type AppConfig } from './appConfig';
import { gasVersion, loadFromGas, loadFromGoogle, pushToGasDetailed } from './gsheet';
import {
  clearDirty, clearPending, isDirty, loadLocal, loadPending, markDirty, saveLocal, savePending, saveSnapshot, writeSyncLog,
} from './storage';

export type SyncTarget = 'gas' | 'localonly';

/* ---------------- единая очередь отправки ----------------
 * Все обращения к скрипту на запись идут строго по одному: автосохранение, повтор очереди
 * и «Обновить» никогда не накладываются друг на друга (иначе — «тайм-аут блокировки» в таблице). */
let chain: Promise<unknown> = Promise.resolve();
let inFlight = 0;

export function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(
    async () => {
      inFlight++;
      try {
        return await fn();
      } finally {
        inFlight--;
      }
    },
  );
  chain = run.catch(() => undefined);
  return run;
}

export function isSyncBusy(): boolean {
  return inFlight > 0;
}

/** Пауза перед повтором в зависимости от причины: занято → быстро, сеть → дольше. */
export function retryDelayFor(reason: PushResult['reason'], attempt: number): number {
  const base = reason === 'busy' ? 6000 : reason === 'timeout' ? 20000 : 30000;
  return Math.min(base * Math.pow(2, Math.max(0, attempt - 1)), 5 * 60 * 1000);
}

/** gasUrl задан → 'gas' ВСЕГДА (в любом режиме). Иначе — только это устройство. */
export function syncTarget(cfg: AppConfig = getConfig()): SyncTarget {
  return hasGas(cfg) ? 'gas' : 'localonly';
}

export interface SyncOutcome extends PushResult {
  target: SyncTarget;
}

export function syncNow(draft: AppData): Promise<SyncOutcome> {
  saveLocal(draft);
  markDirty();
  return exclusive(async () => {
    const cfg = getConfig();
    const target = syncTarget(cfg);
    if (target === 'gas') {
      const r = await pushToGasDetailed(cfg.gasUrl, draft);
      if (r.ok) {
        clearDirty();
        clearPending();
        saveSnapshot(draft);
        writeSyncLog({ ok: true, where: 'gas', detail: r.detail });
      } else {
        markDirty();
        savePending(draft);
        writeSyncLog({ ok: false, where: 'gas', detail: r.detail });
      }
      return { ...r, target };
    }
    markDirty();
    writeSyncLog({ ok: true, where: 'local', detail: 'Сохранено только на этом устройстве — таблица не подключена (gasUrl пуст)' });
    return { ok: true, reason: 'ok', detail: 'Сохранено только на этом устройстве. Чтобы правки видели все, задайте gasUrl.', target };
  });
}

/** Повтор очереди неотправленного. null = очередь пуста. */
export function flushPending(): Promise<PushResult | null> {
  return exclusive(async () => {
    const cfg = getConfig();
    if (!hasGas(cfg)) return null;
    // всегда берём самое свежее локальное состояние — оно включает всё, что лежало в очереди
    const pending = (isDirty() ? loadLocal() : null) ?? loadPending();
    if (!pending) return null;
    const r = await pushToGasDetailed(cfg.gasUrl, pending);
    if (r.ok) {
      clearDirty();
      clearPending();
      saveSnapshot(pending);
      writeSyncLog({ ok: true, where: 'gas', detail: `Очередь отправлена. ${r.detail}` });
    } else {
      markDirty();
      savePending(pending);
      writeSyncLog({ ok: false, where: 'gas', detail: r.detail });
    }
    return r;
  });
}

export interface FlushBeforePull {
  blocked: boolean;
  local: AppData | null;
  result: PushResult | null;
}

/**
 * Перед ЛЮБОЙ загрузкой свежего: если есть неотправленные правки и задан gasUrl —
 * сначала push. Неудача → blocked=true, показываем локальные правки, НЕ затираем.
 */
export function flushBeforePull(): Promise<FlushBeforePull> {
  return exclusive(async () => {
    const cfg = getConfig();
    const pending = (isDirty() ? loadLocal() : null) ?? loadPending();
    if (!pending) return { blocked: false, local: null, result: null };
    if (!hasGas(cfg)) return { blocked: true, local: pending, result: null };
    const r = await pushToGasDetailed(cfg.gasUrl, pending);
    if (r.ok) {
      clearDirty();
      clearPending();
      writeSyncLog({ ok: true, where: 'gas', detail: `Очередь отправлена перед обновлением. ${r.detail}` });
      return { blocked: false, local: pending, result: r };
    }
    markDirty();
    savePending(pending);
    writeSyncLog({ ok: false, where: 'gas', detail: r.detail });
    return { blocked: true, local: pending, result: r };
  });
}

/** Тянет свежие данные из сети по конфигу. Бросает Error с русским текстом. */
export async function pullFresh(cfg: AppConfig = getConfig()): Promise<AppData | null> {
  if (hasGas(cfg)) return loadFromGas(cfg.gasUrl);
  if (cfg.dataSource === 'google' && cfg.sheetId.trim()) return loadFromGoogle(cfg.sheetId.trim());
  return null;
}

export interface ConnectionCheck {
  ok: boolean;
  text: string;
  version?: number;
}

export async function checkConnection(cfg: AppConfig = getConfig()): Promise<ConnectionCheck> {
  if (hasGas(cfg)) {
    const v = await gasVersion(cfg.gasUrl);
    if (v === -1) return { ok: false, version: v, text: 'Скрипт не отвечает. Проверьте URL (должен заканчиваться на /exec) и что доступ — «Все».' };
    if (v < REQUIRED_GAS_VERSION) {
      return {
        ok: false, version: v,
        text: `Скрипт устарел (версия ${v}, нужна ${REQUIRED_GAS_VERSION}). Вставьте новый код из «Синхронизации» и опубликуйте НОВУЮ ВЕРСИЮ развёртывания.`,
      };
    }
    return { ok: true, version: v, text: `Скрипт v${v} отвечает. Чтение и запись в таблицу работают.` };
  }
  if (cfg.dataSource === 'google' && cfg.sheetId.trim()) {
    try {
      const d = await loadFromGoogle(cfg.sheetId.trim());
      return { ok: true, text: `Таблица читается: товаров ${d.products.length}, магазинов ${d.shops.length}. Запись выключена — задайте gasUrl.` };
    } catch (e) {
      return { ok: false, text: (e as Error).message };
    }
  }
  if (cfg.dataSource === 'gas') return { ok: false, text: 'Режим gas выбран, но gasUrl пуст — укажите URL веб-приложения (…/exec).' };
  return { ok: true, text: 'Локальный режим: данные хранятся только на этом устройстве (сид + правки).' };
}
