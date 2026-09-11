import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/motivaciya/', pretendToBeVisual: true });
const w = dom.window as unknown as Record<string, unknown>;
for (const k of ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'HTMLInputElement', 'Node', 'Event', 'KeyboardEvent', 'FocusEvent', 'TouchEvent', 'MouseEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  (globalThis as Record<string, unknown>)[k] = w[k];
}
(globalThis as Record<string, unknown>).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
(w as Record<string, unknown>).matchMedia = (globalThis as Record<string, unknown>).matchMedia;
(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
(w as Record<string, unknown>).ResizeObserver = (globalThis as Record<string, unknown>).ResizeObserver;
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as Record<string, unknown>).fetch = async () => { throw new Error('offline-test'); };

const { default: React, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { default: App } = await import('../src/App');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function mount() {
  const el = document.getElementById('root')!;
  el.innerHTML = '';
  const root = createRoot(el);
  await act(async () => { root.render(React.createElement(App)); });
  await act(async () => { await sleep(50); });
  return { root, html: () => el.innerHTML };
}
const has = (h: string, s: string) => { if (!h.includes(s)) throw new Error(`MISSING: ${s}`); console.log('  ✓', s); };

console.log('1) login');
let m = await mount();
let h = m.html();
has(h, 'Продавец'); has(h, 'Выберите магазин'); has(h, 'Центральный · Стандартный'); has(h, 'Как установить приложение?');
// открыть инструкцию
{
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Как установить приложение?'));
  if (!btn) throw new Error('no install button');
  await act(async () => { btn.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true })); });
  let body = document.body.innerHTML;
  for (const s of ['Выберите устройство', 'Samsung', 'Android', 'Компьютер', 'Ссылка приложения', 'App Store', 'значок «Установить»']) has(body, s);
  const iph = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith('iPhone'));
  if (!iph) throw new Error('no iPhone chip');
  await act(async () => { iph.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true })); });
  body = document.body.innerHTML;
  for (const s of ['iPhone / iPad', 'Поделиться', 'На экран “Домой”']) has(body, s);
  const close = document.querySelector('button[aria-label="Закрыть"]') as HTMLButtonElement;
  await act(async () => { close.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true })); });
}
await act(async () => m.root.unmount());

console.log('2) seller');
localStorage.setItem('mv:session:v1', JSON.stringify({ role: 'seller', shop: 'Заречный' }));
m = await mount(); h = m.html();
has(h, 'Заречный'); has(h, 'Высокий'); has(h, 'Pronto'); has(h, 'Herringbone'); has(h, 'Сопутствующие товары'); has(h, 'Акции'); has(h, 'топ-бонус');
has(h, 'dock-fab'); has(h, 'dock-btn on'); has(h, '750 – 798'); has(h, 'до 749'); has(h, '3 град.'); has(h, 'бесплатно от 30 м²'); has(h, 'Доставка'); has(h, '4590 – 4989'); has(h, 'Добавьте «Мотивацию» на рабочий стол');
has(document.body.innerHTML, 'print-root');
await act(async () => m.root.unmount());

console.log('3) seller base (fallback from products)');
localStorage.setItem('mv:session:v1', JSON.stringify({ role: 'seller', shop: 'Дисконт' }));
m = await mount(); h = m.html();
has(h, 'Floorpan Red'); has(h, '849'); has(h, 'Уценка');
if (h.includes('Ясень Рустик')) throw new Error('Дисконт must not see parquet'); console.log('  ✓ parquet hidden for Дисконт');
has(h, 'Выйти');
await act(async () => m.root.unmount());

console.log('4) admin');
localStorage.setItem('mv:session:v1', JSON.stringify({ role: 'admin' }));
m = await mount(); h = m.html();
has(h, 'Панель · СтройМаркет'); has(h, 'Таблица не подключена'); has(h, 'Все прайсы'); has(h, 'Добавить товар'); has(h, 'все магазины'); has(h, 'Выйти');
// переключаем вкладки кликами
const clickTab = async (label: string) => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(label));
  if (!btn) throw new Error('no tab ' + label);
  await act(async () => { btn.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true })); });
};
for (const t of ['Категории', 'Магазины', 'Акции', 'Синхронизация', 'Настройки']) {
  await clickTab(t);
  console.log('  tab', t, 'ok', document.getElementById('root')!.innerHTML.length);
}
has(m.html(), 'Проверить подключение'); has(m.html(), 'appConfig');
await clickTab('Синхронизация');
has(m.html(), 'http://localhost/motivaciya/'); has(m.html(), 'Копировать скрипт'); has(m.html(), '5 листов');
await clickTab('Магазины'); has(m.html(), 'товаров: ');
await act(async () => m.root.unmount());
console.log('ALL OK');

// 5) мобильная навигация: у продавца внизу 5 кнопок, у админа — «Ещё» открывает шторку
console.log('5) bottom nav');
localStorage.setItem('mv:session:v1', JSON.stringify({ role: 'seller', shop: 'Центральный' }));
m = await mount(); h = m.html();
for (const s of ['>Прайс<', '>Акции<', '>Отправить<', '>Обновить<', '>Выйти<']) has(h, s);
has(h, 'Лучший продавец'); has(h, 'Премия 10 000 ₽');
await act(async () => m.root.unmount());
localStorage.setItem('mv:session:v1', JSON.stringify({ role: 'admin' }));
m = await mount();
const moreBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Ещё');
if (!moreBtn) throw new Error('no Ещё');
await act(async () => { moreBtn.dispatchEvent(new (window as any).MouseEvent('click', { bubbles: true })); });
has(document.body.innerHTML, 'Обновить из таблицы'); has(document.body.innerHTML, 'Выйти из панели'); has(document.body.innerHTML, 'Настройки'); has(document.body.innerHTML, 'Как установить на телефон');
await act(async () => m.root.unmount());
console.log('NAV OK');
