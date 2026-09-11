import type { AppData, GradRow, Grades, PriceBlock, PriceGroup, Product, Promo, ResolveResult, Shop, TopBonus } from './types';
import { parseGroup } from './appConfig';
import { ensureCategories } from './categories';
import { parseExtras } from './extras';

export const GROUPS: PriceGroup[] = ['base', 'standard', 'high'];

export const norm = (s: string | undefined | null) => String(s ?? '').trim().toLowerCase();

export const emptyGrades = (): Grades => ({ base: '', standard: '', high: '' });

/** `869|27,5;782-868|22,5` → [{price:'869',bonus:'27,5'}, …] */
export function parseGradations(raw: string | undefined | null): GradRow[] {
  return String(raw ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const [p, b] = part.split('|');
      return { price: (p ?? '').trim(), bonus: (b ?? '').trim() };
    })
    .filter((r) => r.price || r.bonus);
}

export function serializeGradations(rows: GradRow[]): string {
  return rows
    .map((r) => ({ price: r.price.trim(), bonus: r.bonus.trim() }))
    .filter((r) => r.price || r.bonus)
    .map((r) => `${r.price}|${r.bonus}`)
    .join(';');
}

/* ---------- цена «от – до» ---------- */

export interface PriceRange {
  from: string;
  to: string;
}

/** `782-868` → {from:'782', to:'868'}; `869` → {from:'869'}; `до 868` → {to:'868'}; `от 869` → {from:'869'}. */
export function parsePriceRange(price: string | undefined | null): PriceRange {
  const s = String(price ?? '').trim();
  if (!s) return { from: '', to: '' };
  let m = s.match(/^(?:от\s*)?([\d][\d\s.,]*?)\s*(?:[-–—]|\s+до\s+)\s*(?:до\s*)?([\d][\d\s.,]*)$/i);
  if (m) return { from: m[1].trim(), to: m[2].trim() };
  m = s.match(/^до\s+(.+)$/i);
  if (m) return { from: '', to: m[1].trim() };
  m = s.match(/^от\s+(.+)$/i);
  if (m) return { from: m[1].trim(), to: '' };
  return { from: s, to: '' };
}

/** Обратно в строку хранения: `782-868` / `869` / `до 868`. */
export function formatPriceRange(from: string, to: string): string {
  const f = from.trim();
  const t = to.trim();
  if (f && t) return `${f}-${t}`;
  if (f) return f;
  if (t) return `до ${t}`;
  return '';
}

/** Для экрана: `782 – 868`, `869`, `до 868`. */
export function prettyPrice(price: string): string {
  const { from, to } = parsePriceRange(price);
  if (from && to) return `${from} – ${to}`;
  if (from) return from;
  if (to) return `до ${to}`;
  return price.trim();
}

export function bonusNumber(bonus: string): number | null {
  const s = String(bonus ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function isPercent(bonus: string): boolean {
  return String(bonus ?? '').includes('%');
}

export function topBonusOf(rows: GradRow[]): TopBonus | null {
  let best: TopBonus | null = null;
  for (const r of rows) {
    const n = bonusNumber(r.bonus);
    if (n === null) continue;
    if (!best || n > best.value) best = { value: n, text: r.bonus.trim(), percent: isPercent(r.bonus) };
  }
  return best;
}

/* ---------- кто что видит ---------- */

export function productForShop(p: Product, shop: Shop): boolean {
  if (!p.shops.length) return true;
  return p.shops.some((n) => norm(n) === norm(shop.name));
}

export function productInGroup(p: Product, g: PriceGroup): boolean {
  return parseGradations(p.grades[g]).length > 0;
}

export function productsForShop(data: AppData, shop: Shop): Product[] {
  return data.products.filter((p) => p.active && productForShop(p, shop) && productInGroup(p, shop.group));
}

export function resolvePrice(data: AppData, shop: Shop): ResolveResult {
  const order = new Map<string, number>();
  data.categories.forEach((c, i) => order.set(norm(c.name), i));
  const blocks: PriceBlock[] = productsForShop(data, shop).map((p) => {
    const rows = parseGradations(p.grades[shop.group]);
    return { key: `p${p.id}`, name: p.name, category: p.category, subcategory: p.subcategory, isRed: p.isRed, rows, topBonus: topBonusOf(rows) };
  });
  // порядок: категории по справочнику, внутри — как в списке товаров (стабильная сортировка)
  blocks.sort((a, b) => (order.get(norm(a.category)) ?? 9999) - (order.get(norm(b.category)) ?? 9999));
  return { status: blocks.length ? 'ok' : 'empty', blocks };
}

export interface Summary {
  collections: number;
  gradations: number;
  top: TopBonus | null;
}

export function summaryOf(blocks: PriceBlock[]): Summary {
  let gradations = 0;
  let top: TopBonus | null = null;
  for (const b of blocks) {
    gradations += b.rows.length;
    if (b.topBonus && (!top || b.topBonus.value > top.value)) top = b.topBonus;
  }
  return { collections: blocks.length, gradations, top };
}

export function blockMatches(b: PriceBlock, query: string): boolean {
  const q = norm(query).replace(/,/g, '.');
  if (!q) return true;
  const hay = [b.name, b.category, b.subcategory, ...b.rows.map((r) => r.price), ...b.rows.map((r) => r.bonus)]
    .join(' ')
    .toLowerCase()
    .replace(/,/g, '.');
  return hay.includes(q);
}

/* ---------- акции ---------- */

export function parseRuDate(s: string | undefined | null): Date | null {
  const m = String(s ?? '').trim().match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtRuDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Градации акции: из поля grades, иначе из price/bonus. */
export function promoGrades(p: Pick<Promo, 'price' | 'bonus' | 'grades'>): GradRow[] {
  const g = parseGradations(p.grades);
  if (g.length) return g;
  return p.price.trim() || p.bonus.trim() ? [{ price: p.price.trim(), bonus: p.bonus.trim() }] : [];
}

/** Нормализует акцию: grades ← строки, price/bonus ← первая градация. */
export function withPromoGrades<T extends Pick<Promo, 'price' | 'bonus' | 'grades'>>(p: T, rows?: GradRow[]): T {
  const list = rows ?? promoGrades(p);
  const first = list[0] ?? { price: '', bonus: '' };
  return { ...p, grades: serializeGradations(list), price: first.price, bonus: first.bonus };
}

export type PromoStatus = 'active' | 'done' | 'future';

export function promoStatus(p: Promo, now = new Date()): PromoStatus {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const s = parseRuDate(p.start);
  const e = parseRuDate(p.end);
  if (s && today < s.getTime()) return 'future';
  if (e && today > e.getTime()) return 'done';
  return 'active';
}

export function isPromoActive(p: Promo, now = new Date()): boolean {
  return promoStatus(p, now) === 'active';
}

/* ---------- печать: разрез между коллекциями ---------- */

export interface FlatRow {
  name: string;
  price: string;
  bonus: string;
  isRed: boolean;
  first: boolean;
}

export function flatten(blocks: PriceBlock[]): FlatRow[] {
  const out: FlatRow[] = [];
  for (const b of blocks) {
    b.rows.forEach((r, i) => out.push({ name: b.name, price: r.price, bonus: r.bonus, isRed: b.isRed, first: i === 0 }));
  }
  return out;
}

export function splitBlocks(blocks: PriceBlock[]): [PriceBlock[], PriceBlock[]] {
  const total = blocks.reduce((s, b) => s + b.rows.length, 0);
  const half = total / 2;
  let acc = 0;
  let cut = blocks.length;
  for (let i = 0; i < blocks.length; i++) {
    const next = acc + blocks[i].rows.length;
    if (next >= half) {
      cut = Math.abs(acc - half) < Math.abs(next - half) ? i : i + 1;
      break;
    }
    acc = next;
  }
  cut = Math.max(0, Math.min(blocks.length, cut));
  return [blocks.slice(0, cut), blocks.slice(cut)];
}

/* ---------- нормализация входящих данных (GAS / JSON / бэкап / старый формат) ---------- */

type Raw = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const yes = (v: unknown) => ['да', 'yes', 'true', '1'].includes(norm(str(v)));
const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const list = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(str).map((x) => x.trim()).filter(Boolean) : splitList(str(v)));
const activeOf = (v: unknown) => {
  if (typeof v === 'boolean') return v;
  const st = norm(str(v));
  return !(st.startsWith('не') || st === '0' || st === 'выключен' || st === 'off' || st === 'false');
};
const cleanGrades = (s: unknown) => serializeGradations(parseGradations(str(s)));

function withIds<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  for (const x of items) {
    if (!Number.isFinite(x.id) || x.id <= 0 || seen.has(x.id)) return items.map((y, i) => ({ ...y, id: i + 1 }));
    seen.add(x.id);
  }
  return items;
}

function parseProduct(p: Raw, i: number): Product {
  const g = (p.grades && typeof p.grades === 'object' ? p.grades : {}) as Raw;
  return {
    id: Number(p.id) || i + 1,
    category: str(p.category).trim(),
    subcategory: str(p.subcategory).trim(),
    name: str(p.name).trim(),
    shops: list(p.shops),
    grades: { base: cleanGrades(g.base ?? p.base), standard: cleanGrades(g.standard ?? p.standard), high: cleanGrades(g.high ?? p.high) },
    isRed: typeof p.isRed === 'boolean' ? p.isRed : yes(p.isRed),
    active: activeOf(p.active),
  };
}

function matchCollectionLegacy(p: Product, collections: string[]): boolean {
  const l = collections.map(norm).filter(Boolean);
  if (!l.length) return true;
  const name = norm(p.name);
  return l.some((c) => name === c || norm(p.category) === c || norm(p.subcategory) === c || name.includes(c));
}

/**
 * Перенос старого формата (Товары с «Градации» + листы Прайс_* + Привязка_прайсов + Цены_по_группам)
 * в новый: у товара три колонки цен и список магазинов.
 */
function migrateLegacy(rawProducts: Raw[], d: Raw, shops: Shop[]): Product[] {
  const arr = (k: string) => (Array.isArray(d[k]) ? (d[k] as Raw[]) : []);
  const out: Product[] = [];
  const own = new Map<number, GradRow[]>();
  rawProducts.forEach((p, i) => {
    const prod: Product = {
      id: i + 1, category: str(p.category).trim(), subcategory: str(p.subcategory).trim(), name: str(p.name).trim(),
      shops: [], grades: emptyGrades(), isRed: false, active: activeOf(p.active),
    };
    let g = parseGradations(str(p.gradations));
    if (!g.length && (str(p.price).trim() || str(p.bonus).trim())) g = [{ price: str(p.price).trim(), bonus: str(p.bonus).trim() }];
    own.set(prod.id, g);
    out.push(prod);
  });
  const rows = arr('priceRows')
    .map((r, i) => ({
      group: parseGroup(str(r.group)), name: str(r.name).trim(), price: str(r.price).trim(), bonus: str(r.bonus).trim(),
      isRed: typeof r.isRed === 'boolean' ? r.isRed : yes(r.isRed), sortOrder: Number(r.sortOrder) || i + 1,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const bindings = arr('bindings').map((b) => ({
    group: parseGroup(str(b.group)), enabled: typeof b.enabled === 'boolean' ? b.enabled : yes(b.enabled), shops: list(b.shops), collections: list(b.collections),
  }));
  const groupPrices = arr('groupPrices').map((g) => ({ group: parseGroup(str(g.group)), collection: str(g.collection).trim(), price: str(g.price).trim() }));
  const excluded = new Map<number, Set<string>>();
  const findExact = (name: string) => out.find((x) => norm(x.name) === norm(name));

  for (const g of GROUPS) {
    const b = bindings.find((x) => x.group === g) ?? { group: g, enabled: bindings.length === 0, shops: [], collections: [] };
    if (!b.enabled) continue;
    const gRows = rows.filter((r) => r.group === g);
    if (gRows.length) {
      for (const r of gRows) {
        if (!r.name) continue;
        let prod = findExact(r.name);
        if (!prod) {
          prod = { id: out.length + 1, category: '', subcategory: '', name: r.name, shops: [], grades: emptyGrades(), isRed: false, active: true };
          out.push(prod);
          own.set(prod.id, []);
        }
        prod.grades[g] = prod.grades[g] ? `${prod.grades[g]};${r.price}|${r.bonus}` : `${r.price}|${r.bonus}`;
        if (r.isRed) prod.isRed = true;
      }
    } else {
      for (const prod of out) {
        const g0 = own.get(prod.id) ?? [];
        if (!g0.length || !matchCollectionLegacy(prod, b.collections)) continue;
        const copy = g0.map((x) => ({ ...x }));
        const ov = groupPrices.find((o) => o.group === g && norm(o.collection) === norm(prod.name));
        if (ov && ov.price) copy[0] = { ...copy[0], price: ov.price };
        prod.grades[g] = serializeGradations(copy);
      }
    }
    if (bindings.length) {
      const ex = shops.filter((s) => s.group === g && !b.shops.some((n) => norm(n) === norm(s.name))).map((s) => s.name);
      if (ex.length) {
        for (const prod of out) {
          if (!prod.grades[g]) continue;
          const set = excluded.get(prod.id) ?? new Set<string>();
          ex.forEach((n) => set.add(n));
          excluded.set(prod.id, set);
        }
      }
    }
  }
  for (const prod of out) {
    const ex = excluded.get(prod.id);
    if (ex && ex.size) prod.shops = shops.map((s) => s.name).filter((n) => !ex.has(n));
  }
  return out;
}

export function normalizeData(raw: unknown): AppData {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Raw;
  const arr = (k: string) => (Array.isArray(d[k]) ? (d[k] as Raw[]) : []);

  const shops: Shop[] = withIds(
    arr('shops').map((s, i) => ({
      id: Number(s.id) || i + 1,
      name: str(s.name).trim(), password: str(s.password), group: parseGroup(str(s.group)),
      extras: parseExtras(s.extras),
    })).filter((s) => s.name),
  );

  const rawProducts = arr('products');
  const legacy = Array.isArray(d.priceRows) || Array.isArray(d.bindings) || rawProducts.some((p) => 'gradations' in p && !('grades' in p));
  const products: Product[] = withIds((legacy ? migrateLegacy(rawProducts, d, shops) : rawProducts.map(parseProduct)).filter((p) => p.name));

  const promos = withIds(
    arr('promos').map((p, i) =>
      withPromoGrades({
        id: Number(p.id) || i + 1,
        start: str(p.start).trim(), end: str(p.end).trim(), category: str(p.category).trim(), product: str(p.product).trim(),
        price: str(p.price).trim(), bonus: str(p.bonus).trim(), grades: str(p.grades).trim(), comment: str(p.comment).trim(),
      }),
    ).filter((p) => p.product || p.category),
  );
  const categories = withIds(
    arr('categories').map((c, i) => ({
      id: Number(c.id) || i + 1, name: str(c.name).trim(), icon: str(c.icon) as AppData['categories'][number]['icon'],
      sortOrder: Number.isFinite(parseInt(str(c.sortOrder), 10)) ? parseInt(str(c.sortOrder), 10) : i + 1,
    })).filter((c) => c.name),
  );
  const settingsIn = (d.settings && typeof d.settings === 'object' ? d.settings : {}) as Raw;

  return ensureCategories({
    products, shops, promos, categories,
    settings: { reportEmail: str(settingsIn.reportEmail).trim() },
    updatedAt: str(d.updatedAt) || new Date().toISOString(),
    gasVersion: Number.isFinite(Number(d.gasVersion)) ? Number(d.gasVersion) : undefined,
  });
}

export function nextId(items: { id: number }[]): number {
  return items.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}
