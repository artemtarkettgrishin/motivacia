import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { SEED } from '../src/lib/seed';
import { resolvePrice, prettyPrice } from '../src/lib/pricing';
import { buildPrintModel, fitDocument, nameMm, numMm, ROW_H_PT, mmToWch } from '../src/lib/printLayout';
import { downloadExcel } from '../src/lib/excel';

const { createRequire } = await import('node:module');
const require2 = createRequire(import.meta.url);
(globalThis as Record<string, unknown>).XLSXCJS = require2('xlsx-js-style');
const d = SEED;
const shop = d.shops[0];
const r = resolvePrice(d, shop);
const promos = d.promos;
const model = buildPrintModel({ blocks: r.blocks, promos });

console.log('sections:', model.sections.map((s) => s.kind).join(','), '| font', model.font, '| ROW_H', ROW_H_PT);

// 1) геометрия едина и ровно на всю ширину листа
const totalW = 2 * (model.w.name + model.w.price + model.w.bonus);
console.log('total width', totalW.toFixed(1), 'mm');
if (Math.abs(totalW - 190) > 0.6) throw new Error('таблица не занимает ровно 190мм');
for (const s of model.sections) {
  if (s.w !== model.w || s.font !== model.font) throw new Error(`секция ${s.kind} отличается геометрией`);
  const ln = s.left.length, rn = s.right.length;
  if (rn && Math.abs(ln - rn) > 3) throw new Error(`несбаланс ${s.kind}: ${ln}/${rn}`);
  console.log(`${s.kind.padEnd(8)} L${ln}/R${rn}`);
}

// 2) всё в одну строку: максимальный текст ≤ колонка (с учётом шрифта)
let maxN = 0, maxP = 0, maxB = 0;
for (const b of r.blocks) {
  maxN = Math.max(maxN, nameMm(b.name));
  for (const x of b.rows) { maxP = Math.max(maxP, numMm(prettyPrice(x.price))); maxB = Math.max(maxB, numMm(x.bonus)); }
}
const k = model.font / 10;
console.log(`fits: name ${(maxN * k).toFixed(1)} ≤ ${model.w.name.toFixed(1)} | price ${(maxP * k).toFixed(1)} ≤ ${model.w.price.toFixed(1)} | bonus ${(maxB * k).toFixed(1)} ≤ ${model.w.bonus.toFixed(1)}`);
if (maxN * k > model.w.name - 0.2 || maxP * k > model.w.price - 0.2 || maxB * k > model.w.bonus - 0.2) throw new Error('текст вылезает за колонку');

// 3) длинные имена → меньший шрифт, всё равно одна строка
const long = fitDocument([{ name: 'ОченьДлинноеНазваниеКоллекцииКотороеНуОченьДлинноеДажеБольшеОбычного', price: '99999-88888', bonus: '123,5' }]);
const need = nameMm('ОченьДлинноеНазваниеКоллекцииКотороеНуОченьДлинноеДажеБольшеОбычного') * (long.font / 10) + 2.4;
console.log('long-name font', long.font, 'need', need.toFixed(1), 'nameW', long.w.name.toFixed(1));
if (long.font >= 8 || need > long.w.name + 0.1) throw new Error('длинное имя не поместилось');

// 4) Excel: 6 колонок, ширины авто, высота 14.4
rmSync('tmp-excel', { recursive: true, force: true });
mkdirSync('tmp-excel');
process.chdir('tmp-excel');
downloadExcel({ blocks: r.blocks, promos, shop: shop.name, price: 'Стандартный', company: 'СтройМаркет', date: '11.09.2025', extras: d.shops[0].extras });
process.chdir('..');
import { readdirSync } from 'node:fs';
const file = `tmp-excel/${readdirSync('tmp-excel')[0]}`;
const XLSX = (globalThis as Record<string, unknown>).XLSXCJS as typeof import('xlsx-js-style');
const wb = XLSX.readFile ? XLSX.readFile(file, { cellStyles: true } as never) : null;
if (!wb) throw new Error('read api');
const ws = wb.Sheets['Прайс'];
const range = XLSX.utils.decode_range(ws['!ref']!);
console.log('excel cols:', range.e.c + 1, 'rows:', range.e.r + 1, '!cols:', JSON.stringify(ws['!cols']?.map((c) => c.wch)));
if (range.e.c + 1 !== 6) throw new Error('лист не из 6 колонок');
const h = ws['!rows']?.[0]?.hpt;
if (h !== 14.4) throw new Error('высота строки не 14.4: ' + h);
const heads = ['Наименование', 'цена', 'бонус', 'Наименование', 'цена', 'бонус'];
for (let c = 0; c < 6; c++) {
  const cell = ws[XLSX.utils.encode_cell({ r: 1, c })];
  if (cell?.v !== heads[c]) throw new Error(`шапка[${c}]: ${cell?.v}`);
}
const banner = Object.entries(ws).filter(([k, v]) => (v as { v?: unknown }).v === 'Сопутствующие товары');
if (!banner.length) throw new Error('нет баннера Сопутствующие');
const promoBanner = Object.entries(ws).filter(([k, v]) => (v as { v?: unknown }).v === 'Акции и условия');
if (!promoBanner.length) throw new Error('нет баннера Акции');
rmSync('tmp-excel', { recursive: true, force: true });
const allWch = (ws['!cols'] ?? []).reduce((s0: number, c: { wch?: number }) => s0 + (c.wch ?? 0), 0);
console.log('total wch', allWch.toFixed(1), '(бюджет ≈103)');
if (allWch > 108) throw new Error('колонки шире листа');
console.log('mmToWch check 20mm →', mmToWch(20));
console.log('PRINT+EXCEL OK');
