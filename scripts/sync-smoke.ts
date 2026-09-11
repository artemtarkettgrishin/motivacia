import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).localStorage = dom.window.localStorage;
(globalThis as any).window = dom.window;
const { writeOverride } = await import('../src/lib/appConfig');
const { syncNow, flushBeforePull, flushPending, checkConnection, retryDelayFor, isSyncBusy } = await import('../src/lib/sync');
const { loadPending, isDirty, readSyncLog } = await import('../src/lib/storage');
const { cloneSeed } = await import('../src/lib/seed');

writeOverride({ gasUrl: 'https://script.google.com/macros/s/TEST/exec' });
type Mode = 'ok' | 'legacy' | 'down' | 'old' | 'busy' | 'getlike' | 'wrongid' | 'html';
let mode: Mode = 'ok';
let concurrent = 0, maxConcurrent = 0, posts = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
(globalThis as any).fetch = async (url: string, init?: RequestInit) => {
  if (mode === 'down') throw new TypeError('Failed to fetch');
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  const text = (t: string, ok = true, status = 200) => ({ ok, status, text: async () => t });
  if (body) {
    posts++;
    concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
    await sleep(30);
    concurrent--;
  }
  if (mode === 'legacy') return text(body ? 'unknown action' : JSON.stringify({ products: [], shops: [] }));
  if (mode === 'old') return text(JSON.stringify({ products: [], shops: [] }));
  if (mode === 'busy') return text(JSON.stringify(body ? { status: 'error', code: 'busy', error: 'busy: таблица занята', saveId: body.saveId } : { status: 'error', code: 'busy', error: 'busy' }));
  if (mode === 'getlike') return text(JSON.stringify({ products: [], shops: [], gasVersion: 7 }));
  if (mode === 'wrongid') return text(JSON.stringify({ status: 'ok', gasVersion: 7, saveId: 'nope', counts: { products: 1, shops: 1, priceRows: 1 } }));
  if (mode === 'html') return text('<!doctype html><html><body>Error</body></html>');
  if (String(url).includes('action=ping')) return text(JSON.stringify({ status: 'ok', gasVersion: 7 }));
  if (body?.action === 'saveData') {
    return text(JSON.stringify({ status: 'ok', gasVersion: 7, saveId: body.saveId, written: ['Товары'], ms: 1200, counts: { products: body.data.products.length, shops: body.data.shops.length, priceRows: body.data.products.length * 2 } }));
  }
  return text(JSON.stringify({ status: 'ok' }));
};
const d = cloneSeed();
d.shops = d.shops.filter((s) => s.name !== 'Дисконт');
const step = (n: string) => console.log(n);
const expect = (cond: boolean, msg: string) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('   ✓', msg); };

step('A) push ok (v7, saveId echo, written)');
let r = await syncNow(d);
expect(r.ok && r.reason === 'ok' && !!r.written, r.detail);
expect(!loadPending() && !isDirty(), 'очередь пуста');

step('B) три отправки одновременно → идут строго по одной');
posts = 0; maxConcurrent = 0;
await Promise.all([syncNow(d), flushPending(), flushBeforePull(), syncNow(d)]);
expect(maxConcurrent === 1, `maxConcurrent=${maxConcurrent}, posts=${posts}`);
expect(!isSyncBusy(), 'мьютекс свободен после завершения');

step('C) таблица занята (busy) → мягкая ошибка, очередь, быстрый повтор');
mode = 'busy';
r = await syncNow(d);
expect(!r.ok && r.reason === 'busy', r.detail.slice(0, 60));
expect(!!loadPending() && isDirty(), 'правки в очереди');
expect(retryDelayFor('busy', 1) === 6000 && retryDelayFor('busy', 2) === 12000 && retryDelayFor('network', 1) === 30000 && retryDelayFor('network', 10) === 300000, 'backoff: 6с → 12с …; сеть 30с … максимум 5 мин');

step('D) ответ без status (данные doGet вместо подтверждения) → повтор, не «неизвестно»');
mode = 'getlike';
r = await syncNow(d);
expect(!r.ok && r.reason === 'busy' && !/неизвестно/.test(r.detail), r.detail.slice(0, 70));

step('E) чужой saveId → не считаем записанным');
mode = 'wrongid';
r = await syncNow(d);
expect(!r.ok && r.reason === 'server', r.detail);

step('F) HTML-страница ошибки Google → повтор');
mode = 'html';
r = await syncNow(d);
expect(!r.ok && r.reason === 'busy', r.detail.slice(0, 60));

step('G) сеть упала → очередь; вернулась → flushBeforePull отправляет');
mode = 'down';
const f1 = await flushBeforePull();
expect(f1.blocked && f1.local?.shops.length === 7, 'blocked, локальные правки не затёрты');
mode = 'ok';
const f2 = await flushBeforePull();
expect(!f2.blocked && !loadPending() && !isDirty(), 'очередь ушла, dirty снят');

step('H) устаревший скрипт');
mode = 'legacy';
r = await syncNow(d);
expect(!r.ok && r.reason === 'outdated', r.detail.slice(0, 60));
mode = 'old';
const c1 = await checkConnection();
expect(!c1.ok && c1.version === 0, c1.text.slice(0, 60));
mode = 'ok';
const c2 = await checkConnection();
expect(c2.ok && c2.version === 7, c2.text);
await flushPending();
console.log('log entries:', readSyncLog().length, readSyncLog().slice(0, 2).map((e) => `${e.ok ? '✓' : '✗'} ${e.detail.slice(0, 50)}`));
console.log('SYNC OK');
