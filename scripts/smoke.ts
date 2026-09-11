import { SEED } from '../src/lib/seed';
import { resolvePrice, summaryOf, splitBlocks, flatten, promoStatus, blockMatches, parseGradations, normalizeData } from '../src/lib/pricing';
import { ensureCategories } from '../src/lib/categories';
import { buildTsv } from '../src/lib/backendScript';
import { encodeExtras, decodeExtras } from '../src/lib/extras';

const d = ensureCategories(SEED);
console.log('products', d.products.length, 'shops', d.shops.length, 'cats', d.categories.map((c) => c.name).join('/'));
for (const s of d.shops) {
  const r = resolvePrice(d, s);
  const sm = summaryOf(r.blocks);
  console.log(s.name.padEnd(12), s.group.padEnd(8), r.status, 'coll', sm.collections, 'grad', sm.gradations, 'top', sm.top?.text, 'red', r.blocks.filter((b) => b.isRed).map((b) => b.name).join(','), 'parquet', r.blocks.filter((b) => b.category === 'Паркет').length);
}
const high = resolvePrice(d, d.shops[6]);
const [l, r] = splitBlocks(high.blocks);
console.log('split', flatten(l).length, flatten(r).length, 'firstL', l[0]?.name, 'firstR', r[0]?.name, 'order', high.blocks.slice(0, 3).map((b) => b.category).join('>'));
console.log('promos', d.promos.map((p) => `${p.product}:${promoStatus(p)}`).join(' '));
console.log('search 27.5 →', high.blocks.filter((b) => blockMatches(b, '27,5')).map((b) => b.name), 'grad', parseGradations('869|27,5;782-868|22,5'));
console.log(buildTsv(d, 'Товары').split('\n').slice(0, 2).join('\n'));

// --- миграция старого формата (Товары+Градации, Прайс_*, Привязка, Цены_по_группам) ---
const legacy = normalizeData({
  shops: [{ name: 'Южный', group: 'Базовый', password: '1' }, { name: 'Восточный', group: 'Базовый', password: '1' }, { name: 'Центральный', group: 'Стандартный', password: '1' }],
  products: [
    { category: 'Ламинат', subcategory: 'X', name: 'A', price: '100', bonus: '5', gradations: '100|5;90-99|4', active: 'активен' },
    { category: 'Ламинат', subcategory: 'X', name: 'B', price: '200', bonus: '9', gradations: '', active: 'выключен' },
  ],
  priceRows: [
    { group: 'standard', name: 'A', price: '100', bonus: '7', sortOrder: 1 },
    { group: 'standard', name: 'C', price: '50', bonus: '2', isRed: 'да', sortOrder: 2 },
  ],
  bindings: [
    { group: 'Базовый', enabled: 'да', shops: 'Южный', collections: '' },
    { group: 'Стандартный', enabled: 'да', shops: 'Центральный', collections: '' },
    { group: 'Высокий', enabled: 'нет', shops: '', collections: '' },
  ],
  groupPrices: [{ group: 'Базовый', collection: 'A', price: '95' }],
  promos: [], categories: [], settings: { reportEmail: 'x@y.z' },
});
console.log('legacy →', JSON.stringify(legacy.products.map((p) => ({ n: p.name, g: p.grades, shops: p.shops, red: p.isRed, act: p.active }))));
const exp = legacy.products;
const ok =
  exp[0].grades.base === '95|5;90-99|4' && exp[0].grades.standard === '100|7' && exp[0].grades.high === '' &&
  exp[0].shops.join(',') === 'Южный,Центральный' &&
  exp[1].grades.base === '200|9' && exp[1].active === false &&
  exp[2].name === 'C' && exp[2].grades.standard === '50|2' && exp[2].isRed === true;
if (!ok) throw new Error('LEGACY MIGRATION MISMATCH');
console.log('legacy migration OK');

// --- плашки: кодирование в ячейку и обратно, legacy-пары, до 10 ---
const ex = d.shops[0].extras;
const enc = encodeExtras(ex);
const dec = decodeExtras(enc);
if (JSON.stringify(dec) !== JSON.stringify(ex)) throw new Error('EXTRAS ROUNDTRIP MISMATCH ' + enc);
console.log('extras roundtrip OK:', enc.slice(0, 80) + '…');
const legacyShops = normalizeData({ shops: [{ name: 'X', password: '1', group: 'Базовый', extras: [{ label: 'A', value: '+1' }, { label: 'B', value: '−2' }] }], products: [], promos: [], categories: [] });
if (legacyShops.shops[0].extras.length !== 2 || legacyShops.shops[0].extras[0].icon !== '') throw new Error('LEGACY EXTRAS');
const many = normalizeData({ shops: [{ name: 'Y', password: '1', group: 'Базовый', extras: Array.from({ length: 14 }, (_, i) => ({ label: 'L' + i, value: String(i) })) }], products: [], promos: [], categories: [] });
if (many.shops[0].extras.length !== 10) throw new Error('MAX_EXTRAS');
console.log('extras legacy + cap OK');
// --- «от – до» в TSV: формат хранения не меняется ---
console.log(buildTsv(d, 'Магазины').split('\n').slice(0, 2).join('\n'));

// --- градации акций: старый формат (только цена/бонус) и новый (grades) ---
const pr = normalizeData({ shops: [], products: [], categories: [], promos: [
  { start: '01.01.2026', end: '31.12.2026', product: 'A', price: '799', bonus: '40' },
  { start: '01.01.2026', end: '31.12.2026', product: 'B', grades: '799|40;750-798|32;до 749|25' },
  { start: '01.01.2026', end: '31.12.2026', product: 'C', price: '1', bonus: '2', grades: '10|20;5-9|15' },
] });
const [pa, pb, pc] = pr.promos;
if (pa.grades !== '799|40' || pb.price !== '799' || pb.bonus !== '40' || pc.price !== '10' || pc.grades !== '10|20;5-9|15') throw new Error('PROMO GRADES ' + JSON.stringify(pr.promos));
console.log('promo grades OK:', pb.grades, '| TSV:', buildTsv(pr, 'Акции').split('\n')[2]);
