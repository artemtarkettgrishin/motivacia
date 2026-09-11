import type { GradRow, PriceBlock, Promo } from './types';
import { norm, prettyPrice, promoGrades } from './pricing';

/** Высота строки — неизменная. */
export const ROW_H_PT = 14.4;
/** Доступная ширина содержимого A4 portrait (210 − 2×10) в мм. */
export const CONTENT_W_MM = 190;
/** Ширина одной половины таблицы (6 колонок = 2 половины по 3). */
export const HALF_MM = CONTENT_W_MM / 2;

/* ---------- ширина текста в мм (Calibri 10pt, полужирный) ---------- */

const NARROW = "ilI,.;:!|[]'()/ ";
const WIDE = 'МЮШщФДЖЯЬфшщюдя%№';

function textMm(s: string, unit: number): number {
  let w = 0;
  for (const ch of String(s ?? '')) {
    if (NARROW.includes(ch)) w += 0.55;
    else if (WIDE.includes(ch)) w += 1.15;
    else if (/[ЁА-ЯA-Z]/.test(ch)) w += 0.82;
    else if (/[0-9]/.test(ch)) w += 0.64;
    else if (/[а-яёa-z]/.test(ch)) w += 0.62;
    else w += 0.72;
  }
  return w * unit;
}

const NAME_U = 2.55; // мм на единицу ширины при 10pt (имя, полужирный)
const NUM_U = 2.35;  // мм на единицу при 10pt (цифры)

export function nameMm(s: string): number { return textMm(s, NAME_U); }
export function numMm(s: string): number { return textMm(s, NUM_U); }

/* ---------- единая геометрия документа ---------- */

export interface DocGeometry {
  /** подобранный шрифт (pt): всё в одну строку, ничего не обрезано */
  font: number;
  w: { name: number; price: number; bonus: number };
}

const PAD = 2.4; // суммарный внутренний горизонтальный отступ ячейки, мм
const PRICE_MIN = 10, PRICE_MAX = 38, BONUS_MIN = 8, BONUS_MAX = 26;
const FONT_MIN = 5.4;

/**
 * Подбирает ЕДИНЫЙ для всего документа шрифт и ширины колонок так, чтобы:
 *  — «цена» и «бонус» были по ширине максимального своего текста (nowrap, по центру);
 *  — «наименование» занимало оставшуюся ширину половины;
 *  — каждая строка помещается в одну строку (ничего не переносится и не обрезается);
 *  — таблица занимает всю ширину листа (2 половины по HALF_MM).
 */
export function fitDocument(rows: { name: string; price: string; bonus: string }[], half = HALF_MM): DocGeometry {
  let maxName = 1, maxPrice = 1, maxBonus = 1;
  for (const r of rows) {
    maxName = Math.max(maxName, nameMm(r.name));
    maxPrice = Math.max(maxPrice, numMm(r.price));
    maxBonus = Math.max(maxBonus, numMm(r.bonus));
  }
  for (let f = 10; f >= FONT_MIN; f -= 0.1) {
    const k = f / 10;
    const priceW = Math.min(Math.max(PRICE_MIN, maxPrice * k + PAD), PRICE_MAX);
    const bonusW = Math.min(Math.max(BONUS_MIN, maxBonus * k + PAD), BONUS_MAX);
    const nameNeed = maxName * k + PAD;
    if (priceW + bonusW + nameNeed <= half || f <= FONT_MIN + 0.05) {
      return { font: Math.round(f * 10) / 10, w: { name: half - priceW - bonusW, price: priceW, bonus: bonusW } };
    }
  }
  return { font: FONT_MIN, w: { name: half - PRICE_MAX - BONUS_MAX, price: PRICE_MAX, bonus: BONUS_MAX } };
}

/* ---------- разбиение секции на две половины ---------- */

export interface SectorRow {
  b: PriceBlock;
  row: GradRow;
}

/** Делит блоки между половинами по числу строк; блок не разрезается по горизонтали. */
export function splitSector(blocks: PriceBlock[]): { left: SectorRow[]; right: SectorRow[] } {
  const units = blocks.map((b) => b.rows.length);
  const total = units.reduce((a, b) => a + b, 0);
  const half = total / 2;
  let acc = 0, cut = 1;
  for (let i = 0; i < blocks.length; i++) {
    const next = acc + units[i];
    if (next >= half) {
      cut = Math.abs(acc - half) <= Math.abs(next - half) ? i : i + 1;
      break;
    }
    acc = next;
    if (i + 1 >= blocks.length) cut = blocks.length;
  }
  cut = Math.max(1, Math.min(blocks.length, cut));
  return {
    left: blocks.slice(0, cut).flatMap((b) => b.rows.map((r) => ({ b, row: r }))),
    right: blocks.slice(cut).flatMap((b) => b.rows.map((r) => ({ b, row: r }))),
  };
}

/* ---------- модель документа ---------- */

export type SectionIcon = 'box' | 'tag' | 'none';

export interface PrintSection {
  kind: 'main' | 'related' | 'promos';
  title: string;
  icon: SectionIcon;
  bannerBg: string;
  bannerInk: string;
  /** Одна и та же геометрия у всех секций. */
  left: SectorRow[];
  right: SectorRow[];
  w: DocGeometry['w'];
  font: number;
}

export interface PrintModel {
  sections: PrintSection[];
  w: DocGeometry['w'];
  font: number;
}

export function isRelatedCategory(name: string): boolean {
  return norm(name).startsWith('сопутств');
}

function promoBlock(p: Promo, i: number): PriceBlock {
  const g = promoGrades(p);
  return {
    key: `promo-${i}`,
    name: `${p.product || p.category || 'Акция'}${p.category && p.product ? ` (${p.category})` : ''}`,
    category: p.category,
    subcategory: '',
    isRed: false,
    rows: g.length ? g : [{ price: p.price, bonus: p.bonus }],
    topBonus: null,
  };
}

export function buildPrintModel(a: { blocks: PriceBlock[]; promos: Promo[] }): PrintModel {
  const main = a.blocks.filter((b) => !isRelatedCategory(b.category));
  const related = a.blocks.filter((b) => isRelatedCategory(b.category));
  const promosB = a.promos.map(promoBlock);

  // единый шрифт/ширины по ВСЕМ строкам всех секций
  const allRows: { name: string; price: string; bonus: string }[] = [];
  for (const b of [...main, ...related, ...promosB]) {
    for (const r of b.rows) allRows.push({ name: b.name, price: prettyPrice(r.price), bonus: r.bonus });
  }
  const g = fitDocument(allRows);

  const sections: PrintSection[] = [];
  if (main.length) {
    const s = splitSector(main);
    sections.push({ kind: 'main', title: '', icon: 'none', bannerBg: '', bannerInk: '', left: s.left, right: s.right, w: g.w, font: g.font });
  }
  if (related.length) {
    const s = splitSector(related);
    sections.push({ kind: 'related', title: 'Сопутствующие товары', icon: 'box', bannerBg: '#f6d04f', bannerInk: '#231a05', left: s.left, right: s.right, w: g.w, font: g.font });
  }
  if (promosB.length) {
    const s = splitSector(promosB);
    sections.push({ kind: 'promos', title: 'Акции и условия', icon: 'tag', bannerBg: '#e3f3ec', bannerInk: '#0a7a54', left: s.left, right: s.right, w: g.w, font: g.font });
  }
  return { sections, w: g.w, font: g.font };
}

/* ---------- строки и Excel helpers ---------- */

export function printShopLine(_shop: string, date: string): string {
  return `прайс от ${date}`;
}

/** Комментарии к акциям — отдельными строками-примечаниями под таблицей. */
export function buildPromoNotes(promos: Promo[]): string[] {
  const out: string[] = [];
  for (const p of promos) {
    if (!p.comment.trim()) continue;
    out.push(`▸ ${p.product || p.category || 'Акция'} (${p.start}–${p.end}): ${p.comment.trim()}`);
  }
  return out;
}

/** мм → приблизительная ширина колонки Excel (Calibri 10–11), с небольшим запасом. */
export function mmToWch(mm: number): number {
  return Math.ceil(mm * 0.546 + 1.9);
}
