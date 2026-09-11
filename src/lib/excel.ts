import * as XLSXNS from 'xlsx-js-style';

// Универсальный импорт: в браузере (Vite) — namespace, в Node ESM — default (CommonJS).
type XlsModule = typeof XLSXNS;
const XLSX = ((XLSXNS as unknown as { utils?: unknown }).utils
  ? XLSXNS
  : (XLSXNS as unknown as { default?: XlsModule }).default ?? XLSXNS) as XlsModule;
import type { PriceBlock, Promo, ShopExtra } from './types';
import { isPercent, prettyPrice, promoGrades } from './pricing';
import { buildPrintModel, buildPromoNotes, isRelatedCategory, mmToWch, nameMm, numMm } from './printLayout';
import { prettyPrice as pp } from './pricing';

export interface ReportArgs {
  blocks: PriceBlock[];
  promos: Promo[];
  shop: string;
  price: string;
  company: string;
  date: string;
  extras: ShopExtra[];
}

/* ---------- стили (та же палитра, что и приложение) ---------- */

const BORDER = {
  top: { style: 'thin', color: { rgb: '2B2B2B' } },
  bottom: { style: 'thin', color: { rgb: '2B2B2B' } },
  left: { style: 'thin', color: { rgb: '2B2B2B' } },
  right: { style: 'thin', color: { rgb: '2B2B2B' } },
};
const CENTER = { vertical: 'center', horizontal: 'center', wrapText: false };
const TITLE = { font: { bold: true, sz: 12, color: { rgb: '000000' } }, alignment: { vertical: 'center', horizontal: 'left' } };
const HEAD = { font: { bold: true, color: { rgb: '000000' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FFEC32' } }, border: BORDER, alignment: CENTER };
const NAME_C = { font: { bold: true, color: { rgb: '000000' } }, border: BORDER, alignment: CENTER };
const NAME_RED_BG = { font: { bold: true, color: { rgb: 'C4281B' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FDEAED' } }, border: BORDER, alignment: CENTER };
const PRICE_C = { font: { bold: true, color: { rgb: '000000' } }, border: BORDER, alignment: CENTER };
const PRICE_RED_BG = { font: { bold: true, color: { rgb: 'C4281B' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FDEAED' } }, border: BORDER, alignment: CENTER };
const BONUS_MINT = { font: { bold: true, color: { rgb: '0A7A54' } }, fill: { patternType: 'solid', fgColor: { rgb: 'E9F6EF' } }, border: BORDER, alignment: CENTER };
const BONUS_GOLD = { font: { bold: true, color: { rgb: '7A5B12' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FDF5D7' } }, border: BORDER, alignment: CENTER };
const BONUS_RED = { font: { bold: true, color: { rgb: 'C4281B' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FDEAED' } }, border: BORDER, alignment: CENTER };
const BANNER_REL = { font: { bold: true, color: { rgb: '231A05' } }, fill: { patternType: 'solid', fgColor: { rgb: 'F6D04F' } }, border: BORDER, alignment: { vertical: 'center', horizontal: 'left' } };
const BANNER_PROMO = { font: { bold: true, color: { rgb: '0A7A54' } }, fill: { patternType: 'solid', fgColor: { rgb: 'E3F3EC' } }, border: BORDER, alignment: { vertical: 'center', horizontal: 'left' } };
const NOTE = { font: { italic: true, sz: 9, color: { rgb: '5A5F5B' } }, alignment: { vertical: 'center', horizontal: 'left' } };

const ROW_H = 14.4;

function safeName(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_');
}

export function fileDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/* ---- лист «Прайс»: одна колонка-блок 3-х колонок, баннеры секций, высота 14.4pt ---- */

type RowKind =
  | { t: 'title'; text: string }
  | { t: 'head' }
  | { t: 'banner'; text: string; kind: 'related' | 'promos' }
  | { t: 'row'; name: string; price: string; bonus: string; red: boolean }
  | { t: 'note'; text: string };

function priceSheetRows(a: ReportArgs): RowKind[] {
  const main = a.blocks.filter((b) => !isRelatedCategory(b.category));
  const related = a.blocks.filter((b) => isRelatedCategory(b.category));
  const rows: RowKind[] = [{ t: 'title', text: `${a.shop} · прайс от ${a.date}` }, { t: 'head' }];
  for (const b of main) for (const r of b.rows) rows.push({ t: 'row', name: b.name, price: prettyPrice(r.price), bonus: r.bonus, red: b.isRed });
  if (related.length) {
    rows.push({ t: 'banner', text: 'Сопутствующие товары', kind: 'related' });
    rows.push({ t: 'head' });
    for (const b of related) for (const r of b.rows) rows.push({ t: 'row', name: b.name, price: prettyPrice(r.price), bonus: r.bonus, red: b.isRed });
  }
  if (a.promos.length) {
    rows.push({ t: 'banner', text: 'Акции и условия', kind: 'promos' });
    for (const p of a.promos) {
      const g = promoGrades(p);
      const list = g.length ? g : [{ price: p.price, bonus: p.bonus }];
      for (const r of list) rows.push({ t: 'row', name: p.product || p.category || 'Акция', price: prettyPrice(r.price), bonus: r.bonus, red: false });
    }
  }
  const note = a.extras.filter((e) => e.label || e.value).map((e) => `${e.label}: ${e.value}`).join(' · ');
  if (note) rows.push({ t: 'note', text: note });
  return rows;
}

export function downloadExcel(a: ReportArgs) {
  const wb = XLSX.utils.book_new();
  const model = buildPrintModel({ blocks: a.blocks, promos: a.promos });

  type XR = { cells: string[]; style: 'title' | 'head' | 'banner' | 'data' | 'note'; redL?: boolean; redR?: boolean; bannerKind?: 'related' | 'promos' };
  const rows: XR[] = [{ cells: [`${a.shop} · прайс от ${a.date}`, '', '', '', '', ''], style: 'title' }];
  const head = (): XR => ({ cells: ['Наименование', 'цена', 'бонус', 'Наименование', 'цена', 'бонус'], style: 'head' });
  rows.push(head());

  for (const sec of model.sections) {
    if (sec.title) {
      rows.push({ cells: [sec.title, '', '', '', '', ''], style: 'banner', bannerKind: sec.kind === 'related' ? 'related' : 'promos' });
      rows.push(head());
    }
    const n = Math.max(sec.left.length, sec.right.length);
    for (let i = 0; i < n; i++) {
      const L = sec.left[i];
      const R = sec.right[i];
      rows.push({
        cells: [
          L?.b.name ?? '', L ? pp(L.row.price) : '', L?.row.bonus ?? '',
          R?.b.name ?? '', R ? pp(R.row.price) : '', R?.row.bonus ?? '',
        ],
        style: 'data',
        redL: !!L?.b.isRed,
        redR: !!R?.b.isRed,
      });
    }
  }
  for (const t of buildPromoNotes(a.promos)) rows.push({ cells: [t, '', '', '', '', ''], style: 'note' });
  const note = a.extras.filter((e) => e.label || e.value).map((e) => `${e.label}: ${e.value}`).join(' · ');
  if (note) rows.push({ cells: [note, '', '', '', '', ''], style: 'note' });

  // ширины колонок от максимального текста (цифровые пары фиксируем, имена делят остаток)
  let maxName = 8, maxPrice = 4, maxBonus = 3;
  for (const sec of model.sections) {
    for (const x of [...sec.left, ...sec.right]) {
      maxName = Math.max(maxName, nameMm(x.b.name));
      maxPrice = Math.max(maxPrice, numMm(pp(x.row.price)));
      maxBonus = Math.max(maxBonus, numMm(x.row.bonus));
    }
  }
  const EXTRA_P = mmToWch(maxPrice + 2.4) + 1;
  const EXTRA_B = mmToWch(maxBonus + 2.4) + 1;
  const BUDGET_WCH = 103; // ~190мм в символах при Calibri 10–11
  const NAME_WCH = Math.max(16, Math.min(46, Math.floor((BUDGET_WCH - 2 * (EXTRA_P + EXTRA_B)) / 2)));

  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.cells));
  ws['!cols'] = [
    { wch: NAME_WCH }, { wch: Math.min(EXTRA_P, 24) }, { wch: Math.min(EXTRA_B, 18) },
    { wch: NAME_WCH }, { wch: Math.min(EXTRA_P, 24) }, { wch: Math.min(EXTRA_B, 18) },
  ];
  ws['!rows'] = rows.map(() => ({ hpt: ROW_H }));
  ws['!merges'] = [];

  const NAME_ST = (red: boolean) => (red ? NAME_RED_BG : NAME_C);
  const PRICE_ST = (red: boolean) => (red ? PRICE_RED_BG : PRICE_C);
  const BONUS_ST = (bonus: string, red: boolean) => (red ? BONUS_RED : isPercent(bonus) ? BONUS_GOLD : BONUS_MINT);

  rows.forEach((r, i) => {
    const ref = (c: number) => XLSX.utils.encode_cell({ r: i, c });
    if (r.style === 'title') {
      ws['!merges']!.push({ s: { r: i, c: 0 }, e: { r: i, c: 5 } });
      ws[ref(0)] = { t: 's', v: r.cells[0], s: TITLE };
      for (let c = 1; c < 6; c++) ws[ref(c)] = { t: 's', v: '', s: {} };
    } else if (r.style === 'head') {
      for (let c = 0; c < 6; c++) ws[ref(c)] = { t: 's', v: r.cells[c], s: HEAD };
    } else if (r.style === 'banner') {
      ws['!merges']!.push({ s: { r: i, c: 0 }, e: { r: i, c: 5 } });
      const st = r.bannerKind === 'related' ? BANNER_REL : BANNER_PROMO;
      for (let c = 0; c < 6; c++) ws[ref(c)] = { t: 's', v: c === 0 ? r.cells[0] : '', s: st };
    } else if (r.style === 'note') {
      ws['!merges']!.push({ s: { r: i, c: 0 }, e: { r: i, c: 5 } });
      ws[ref(0)] = { t: 's', v: r.cells[0], s: NOTE };
      for (let c = 1; c < 6; c++) ws[ref(c)] = { t: 's', v: '', s: {} };
    } else {
      ws[ref(0)] = { t: 's', v: r.cells[0], s: NAME_ST(!!r.redL) };
      ws[ref(1)] = { t: 's', v: r.cells[1], s: PRICE_ST(!!r.redL) };
      ws[ref(2)] = { t: 's', v: r.cells[2], s: BONUS_ST(r.cells[2], !!r.redL) };
      ws[ref(3)] = { t: 's', v: r.cells[3], s: NAME_ST(!!r.redR) };
      ws[ref(4)] = { t: 's', v: r.cells[4], s: PRICE_ST(!!r.redR) };
      ws[ref(5)] = { t: 's', v: r.cells[5], s: BONUS_ST(r.cells[5], !!r.redR) };
    }
  });

  ws['!margins'] = { left: 0.39, right: 0.39, top: 0.39, bottom: 0.39, header: 0.2, footer: 0.2 };
  ws['!printHeader'] = [1, 1];
  (ws as Record<string, unknown>)['!pageSetup'] = { orientation: 'portrait', fitToWidth: 1, fitToHeight: 0, paperSize: '9' };
  XLSX.utils.book_append_sheet(wb, ws, 'Прайс');

  // лист «Акции» — справочник с периодом
  const paoa: string[][] = [['Начало', 'Конец', 'Категория', 'Товар', 'Цена', 'Бонус', 'Комментарий']];
  for (const p of a.promos) {
    const g = promoGrades(p);
    const list = g.length ? g : [{ price: '', bonus: '' }];
    for (const r of list) paoa.push([p.start, p.end, p.category, p.product, pp(r.price), r.bonus, p.comment]);
  }
  const pws = XLSX.utils.aoa_to_sheet(paoa);
  pws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 40 }];
  pws['!rows'] = paoa.map(() => ({ hpt: ROW_H }));
  (pws as Record<string, unknown>)['!pageSetup'] = { orientation: 'portrait', fitToWidth: 1, fitToHeight: 0, paperSize: '9' };
  paoa.forEach((_, i) => {
    for (let c = 0; c < 7; c++) {
      const ref = XLSX.utils.encode_cell({ r: i, c });
      if (!pws[ref]) pws[ref] = { t: 's', v: '' };
      pws[ref].s = i === 0 ? HEAD : { border: BORDER, alignment: CENTER, font: { color: { rgb: '000000' } } };
    }
  });
  XLSX.utils.book_append_sheet(wb, pws, 'Акции');

  XLSX.writeFile(wb, `motivaciya-${safeName(a.shop)}-${fileDate()}.xlsx`);
}

/* ---------- mailto / html отчёт ---------- */

export function buildMailto(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildReportText(a: ReportArgs): string {
  const lines = [
    `${a.company} · Мотивация`,
    `Магазин: ${a.shop}`,
    `Прайс: ${a.price}`,
    `Дата: ${a.date}`,
    ...a.extras.map((e) => `${e.label}: ${e.value}`),
    '',
    `Коллекций: ${a.blocks.length}, градаций: ${a.blocks.reduce((s, b) => s + b.rows.length, 0)}`,
    'Файл Excel приложите к письму (он скачан в загрузки).',
    '',
  ];
  for (const b of a.blocks) {
    lines.push(`${b.isRed ? '! ' : ''}${b.name}: ${b.rows.map((r) => `${prettyPrice(r.price)} → ${r.bonus}`).join('; ')}`);
  }
  if (a.promos.length) {
    lines.push('', 'Акции:');
    for (const p of a.promos) lines.push(`${p.start}–${p.end} · ${p.product}: ${promoGrades(p).map((r) => `${prettyPrice(r.price)} → ${r.bonus}`).join('; ') || '—'}. ${p.comment}`);
  }
  return lines.join('\n');
}

function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildReportHtml(a: ReportArgs): string {
  const th = 'style="background:#ffec32;border:1px solid #2b2b2b;padding:2px 6px;text-align:center;font-weight:700;border-collapse:collapse"';
  const td = 'style="border:1px solid #2b2b2b;padding:1px 6px;border-collapse:collapse"';
  const rows = priceSheetRows(a)
    .map((r) => {
      if (r.t === 'title') return `<tr><td ${td} colspan="3" style="border:none;font-weight:800;font-size:15px;padding:2px 0">${esc(r.text)}</td></tr>`;
      if (r.t === 'head') return `<tr><th ${th} style="background:#ffec32;text-align:left">Наименование</th><th ${th} style="background:#ffec32">цена</th><th ${th} style="background:#ffec32">бонус</th></tr>`;
      if (r.t === 'banner') return `<tr><th colspan="3" style="background:${r.kind === 'related' ? '#f6d04f' : '#e3f3ec'};border:1px solid #2b2b2b;padding:2px 6px;text-align:left;font-weight:700;border-collapse:collapse">${esc(r.text)}</th></tr>`;
      if (r.t === 'note') return `<tr><td ${td} colspan="3" style="border:none;font-style:italic;color:#5a5f5b">${esc(r.text)}</td></tr>`;
      const bonusBg = r.red ? '#fdeaed' : isPercent(r.bonus) ? '#fdf5d7' : '#e9f6ef';
      const bonusInk = r.red ? '#c4281b' : isPercent(r.bonus) ? '#7a5b12' : '#0a7a54';
      return `<tr>
        <td ${td} style="font-weight:700;text-align:left;${r.red ? 'color:#c4281b;background:#fdeaed' : ''}">${esc(r.name)}</td>
        <td ${td} style="text-align:center;font-weight:600;${r.red ? 'color:#c4281b;background:#fdeaed' : ''}">${esc(r.price)}</td>
        <td style="border:1px solid #2b2b2b;padding:1px 6px;text-align:center;font-weight:700;background:${bonusBg};color:${bonusInk};border-collapse:collapse">${esc(r.bonus)}</td>
      </tr>`;
    })
    .join('');
  return `<div style="font-family:Calibri,Arial,sans-serif;color:#000;font-size:13px">
<table style="border-collapse:collapse">${rows}</table>
</div>`;
}
