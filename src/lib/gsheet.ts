import type { AppData, PushResult } from './types';
import { REQUIRED_GAS_VERSION } from './appConfig';
import { ensureCategories } from './categories';
import { normalizeData, norm } from './pricing';

const bust = (url: string) => `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`;

/* ------------------------------------------------------------------ */
/*  Apps Script Web App                                               */
/* ------------------------------------------------------------------ */

export const BUSY_TEXT = 'Таблица занята другой записью (кто-то сохраняет одновременно). Правки в очереди — повторим автоматически через несколько секунд.';

export async function loadFromGas(gasUrl: string, timeoutMs = 45000): Promise<AppData> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(bust(gasUrl), { cache: 'no-store', signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`Скрипт ответил ${res.status}`);
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Скрипт вернул не JSON. Проверьте, что развёрнуто веб-приложение (…/exec) с доступом «Все».');
    }
    const obj = json as { status?: string; code?: string; error?: string };
    if (obj.status === 'error') {
      if (obj.code === 'busy' || /блокировк|lock|busy/i.test(String(obj.error ?? ''))) {
        throw new Error('Таблица сейчас занята записью — показана офлайн-копия. Повторите через минуту.');
      }
      throw new Error(`Ошибка скрипта: ${obj.error || 'без описания'}`);
    }
    const data = normalizeData(json);
    data.updatedAt = new Date().toISOString();
    return ensureCategories(data);
  } finally {
    clearTimeout(t);
  }
}

/** Версия скрипта: число; 0 = старый скрипт без версии; -1 = не отвечает. */
export async function gasVersion(gasUrl: string, timeoutMs = 20000): Promise<number> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(bust(`${gasUrl}?action=ping`), { cache: 'no-store', signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) return -1;
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { gasVersion?: unknown };
      const v = Number(j.gasVersion);
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  } catch {
    return -1;
  } finally {
    clearTimeout(t);
  }
}

export async function pushToGasDetailed(gasUrl: string, data: AppData, timeoutMs = 90000): Promise<PushResult> {
  const saveId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveData', saveId, data }),
      signal: ctrl.signal,
      redirect: 'follow',
    });
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 429 || res.status >= 500) {
        return { ok: false, reason: 'busy', detail: `Google временно не принимает запросы (HTTP ${res.status}). Правки в очереди — повторим автоматически.` };
      }
      return {
        ok: false,
        reason: 'http',
        detail: `Сервер ответил ${res.status}. Проверьте URL (…/exec) и что веб-приложение развёрнуто с доступом «Все». Правки сохранены в очереди.`,
      };
    }
    let json: { status?: string; code?: string; saveId?: string; counts?: PushResult['counts']; written?: unknown; ms?: number; gasVersion?: number; error?: string } | null = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      if (json.status === 'ok') {
        if (json.saveId && json.saveId !== saveId) {
          return { ok: false, reason: 'server', detail: 'Ответ скрипта относится к другому запросу — повторим автоматически.' };
        }
        const v = Number(json.gasVersion) || 0;
        if (v < REQUIRED_GAS_VERSION) {
          return {
            ok: false,
            reason: 'outdated',
            detail: `Скрипт в таблице устарел (v${v}, нужна v${REQUIRED_GAS_VERSION}). Вставьте новый код из «Синхронизации» и опубликуйте НОВУЮ ВЕРСИЮ развёртывания — правки в очереди и уйдут после этого.`,
          };
        }
        const c = json.counts;
        const written = Array.isArray(json.written) ? (json.written as unknown[]).map(String) : undefined;
        const ms = Number(json.ms) || 0;
        const detail = written
          ? written.length
            ? `Записано: ${written.join(', ')}${ms ? ` за ${(ms / 1000).toFixed(1)} с` : ''} · товаров ${c?.products ?? '?'}, магазинов ${c?.shops ?? '?'}`
            : 'Таблица уже актуальна — изменений не было'
          : c
            ? `Записано в таблицу: товаров ${c.products}, магазинов ${c.shops}, строк прайса ${c.priceRows}`
            : 'Записано в таблицу';
        return { ok: true, reason: 'ok', detail, counts: c, gasVersion: v, written };
      }
      if (json.status === 'error') {
        const msg = String(json.error ?? '');
        if (json.code === 'busy' || /блокировк|lock|busy/i.test(msg)) return { ok: false, reason: 'busy', detail: BUSY_TEXT };
        if (json.code === 'unknown' || /unknown action/i.test(msg)) {
          return {
            ok: false,
            reason: 'outdated',
            detail: 'В таблице развёрнут устаревший скрипт — он не умеет сохранять. Вставьте новый код из вкладки «Синхронизация» и опубликуйте НОВУЮ ВЕРСИЮ развёртывания.',
          };
        }
        return {
          ok: false,
          reason: 'server',
          detail: `Скрипт вернул ошибку: ${msg || 'без описания'}. Правки в очереди. Если повторяется — Apps Script → «Выполнения».`,
        };
      }
      // JSON без status — это ответ doGet: запрос не был обработан как сохранение (сбой на стороне Google)
      return {
        ok: false,
        reason: 'busy',
        detail: 'Google вернул данные вместо подтверждения записи — запрос не дошёл до сохранения. Правки в очереди, повторим автоматически.',
      };
    }
    const low = text.trim().toLowerCase();
    if (low.startsWith('ok')) {
      return { ok: true, reason: 'ok', detail: 'Записано (старый формат ответа — обновите код скрипта и опубликуйте новую версию)', gasVersion: 0 };
    }
    if (low.includes('unknown action')) {
      return {
        ok: false,
        reason: 'outdated',
        detail: 'В таблице развёрнут устаревший скрипт — он не умеет сохранять. Вставьте новый код из вкладки «Синхронизация» и опубликуйте НОВУЮ ВЕРСИЮ развёртывания.',
      };
    }
    if (/<html|<!doctype/i.test(text)) {
      return { ok: false, reason: 'busy', detail: 'Google вернул страницу ошибки вместо ответа скрипта (перегрузка или лимит). Правки в очереди — повторим автоматически.' };
    }
    return { ok: false, reason: 'server', detail: `Непонятный ответ скрипта: «${text.slice(0, 120)}». Проверьте развёртывание.` };
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      return { ok: false, reason: 'timeout', detail: 'Скрипт не ответил за 90 секунд. Правки сохранены в очереди — отправим повторно автоматически.' };
    }
    console.error('pushToGas failed', e);
    return { ok: false, reason: 'network', detail: 'Нет соединения с Google. Правки сохранены в очереди и уйдут сами при появлении сети.' };
  } finally {
    clearTimeout(t);
  }
}

export async function sendReportViaGas(gasUrl: string, to: string, subject: string, htmlBody: string): Promise<PushResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'sendReport', to, subject, htmlBody }),
      signal: ctrl.signal,
      redirect: 'follow',
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, reason: 'http', detail: `Сервер ответил ${res.status}` };
    try {
      const j = JSON.parse(text) as { status?: string; error?: string };
      if (j.status === 'ok') return { ok: true, reason: 'ok', detail: 'Письмо отправлено через Google' };
      return { ok: false, reason: 'server', detail: `Ошибка отправки: ${j.error ?? 'неизвестно'}` };
    } catch {
      if (text.trim().toLowerCase().startsWith('ok')) return { ok: true, reason: 'ok', detail: 'Письмо отправлено' };
      return { ok: false, reason: 'outdated', detail: 'Скрипт устарел и не умеет отправлять письма — обновите код и опубликуйте новую версию.' };
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return { ok: false, reason: 'timeout', detail: 'Скрипт не ответил за 45 секунд' };
    return { ok: false, reason: 'network', detail: 'Нет соединения с Google' };
  } finally {
    clearTimeout(t);
  }
}

/* ------------------------------------------------------------------ */
/*  Google Sheets gviz (только чтение)                                */
/* ------------------------------------------------------------------ */

type GvizCell = { v: unknown; f?: string } | null;
interface GvizTable { header: string[]; rows: string[][] }

function cellText(c: GvizCell): string {
  if (!c || c.v === null || c.v === undefined) return '';
  if (typeof c.v === 'number') return c.f ? c.f.replace(/\u00a0/g, ' ').trim() : String(c.v).replace('.', ',');
  if (typeof c.v === 'string' && /^Date\(/.test(c.v) && c.f) return c.f;
  if (c.f && typeof c.v !== 'string') return c.f;
  return String(c.v);
}

async function gvizSheet(sheetId: string, sheet: string, optional: boolean): Promise<GvizTable> {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`;
  const empty: GvizTable = { header: [], rows: [] };
  let text: string;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (e) {
    if (optional) return empty;
    throw new Error(`Не удалось прочитать лист «${sheet}»: ${(e as Error).message}. Проверьте sheetId и доступ «Все, у кого есть ссылка».`);
  }
  const start = text.indexOf('(');
  const end = text.lastIndexOf(')');
  if (start < 0 || end < 0) {
    if (optional) return empty;
    throw new Error(`Лист «${sheet}»: неожиданный ответ Google`);
  }
  let json: { status?: string; errors?: { message?: string }[]; table?: { cols?: { label?: string }[]; rows?: { c: GvizCell[] }[] } };
  try {
    json = JSON.parse(text.slice(start + 1, end));
  } catch {
    if (optional) return empty;
    throw new Error(`Лист «${sheet}»: не удалось разобрать ответ`);
  }
  if (json.status === 'error') {
    if (optional) return empty;
    throw new Error(`Лист «${sheet}»: ${json.errors?.[0]?.message ?? 'ошибка'} (лист существует? имя точь-в-точь?)`);
  }
  const rows = (json.table?.rows ?? []).map((r) => (r.c ?? []).map(cellText)).filter((r) => r.some((v) => v.trim() !== ''));
  return { header: (json.table?.cols ?? []).map((c) => String(c.label ?? '').trim()), rows };
}

const yes = (v: string) => ['да', 'yes', 'true', '1'].includes(norm(v));

export async function loadFromGoogle(sheetId: string): Promise<AppData> {
  const [tov, mag, akc, kat, nast] = await Promise.all([
    gvizSheet(sheetId, 'Товары', false),
    gvizSheet(sheetId, 'Магазины', false),
    gvizSheet(sheetId, 'Акции', true),
    gvizSheet(sheetId, 'Категории', true),
    gvizSheet(sheetId, 'Настройки', true),
  ]);
  const g = (r: string[], i: number) => (r[i] ?? '').trim();

  const legacyPairs = norm(mag.header[3]).startsWith('доп.1');
  const shops = mag.rows.filter((r) => g(r, 0)).map((r, i) => ({
    id: i + 1, name: g(r, 0), password: g(r, 1), group: g(r, 2),
    extras: legacyPairs
      ? [[3, 4], [5, 6], [7, 8]].map(([a, b]) => ({ label: g(r, a), value: g(r, b), icon: '', color: '' })).filter((e) => e.label || e.value)
      : g(r, 3),
  }));
  const promos = akc.rows.filter((r) => g(r, 3) || g(r, 0)).map((r, i) => ({
    id: i + 1, start: g(r, 0), end: g(r, 1), category: g(r, 2), product: g(r, 3), price: g(r, 4), bonus: g(r, 5), comment: g(r, 6), grades: g(r, 7),
  }));
  const categories = kat.rows.filter((r) => g(r, 0)).map((r, i) => ({ id: i + 1, name: g(r, 0), icon: g(r, 1), sortOrder: g(r, 2) }));
  const emailRow = nast.rows.find((r) => norm(g(r, 0)).startsWith('email'));
  const settings = { reportEmail: emailRow ? g(emailRow, 1) : '' };

  // Старая раскладка: в «Товары» колонка F = «Градации» → читаем старые листы, normalizeData перенесёт в новый формат
  const legacy = norm(tov.header[5]) === 'градации';
  if (legacy) {
    const [pb, ps, ph, bind, gp] = await Promise.all([
      gvizSheet(sheetId, 'Прайс_Базовый', true), gvizSheet(sheetId, 'Прайс_Стандартный', true), gvizSheet(sheetId, 'Прайс_Высокий', true),
      gvizSheet(sheetId, 'Привязка_прайсов', true), gvizSheet(sheetId, 'Цены_по_группам', true),
    ]);
    const products = tov.rows.filter((r) => g(r, 2)).map((r) => ({
      category: g(r, 0), subcategory: g(r, 1), name: g(r, 2), price: g(r, 3), bonus: g(r, 4), gradations: g(r, 5), active: g(r, 6),
    }));
    const priceRows = ([['base', pb], ['standard', ps], ['high', ph]] as const).flatMap(([grp, t]) =>
      t.rows.filter((r) => g(r, 0)).map((r, i) => ({ group: grp, name: g(r, 0), price: g(r, 1), bonus: g(r, 2), isRed: yes(g(r, 3)), sortOrder: i + 1 })),
    );
    const bindings = bind.rows.filter((r) => g(r, 0)).map((r) => ({ group: g(r, 0), enabled: yes(g(r, 1)), shops: g(r, 2), collections: g(r, 3) }));
    const groupPrices = gp.rows.filter((r) => g(r, 1)).map((r) => ({ group: g(r, 0), collection: g(r, 1), price: g(r, 2) }));
    return ensureCategories(normalizeData({ products, shops, priceRows, bindings, groupPrices, promos, categories, settings, updatedAt: new Date().toISOString() }));
  }

  const products = tov.rows.filter((r) => g(r, 2)).map((r, i) => ({
    id: i + 1, category: g(r, 0), subcategory: g(r, 1), name: g(r, 2), shops: g(r, 3),
    grades: { base: g(r, 4), standard: g(r, 5), high: g(r, 6) }, isRed: yes(g(r, 7)), active: g(r, 8) || 'активен',
  }));
  return ensureCategories(normalizeData({ products, shops, promos, categories, settings, updatedAt: new Date().toISOString() }));
}
