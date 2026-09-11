import type { AppData, ExtraColor, ExtraIcon, Grades, PriceGroup, Product, Shop } from './types';
import { DEFAULT_CATEGORIES, ensureCategories } from './categories';

/** Одинаковые градации для трёх прайсов + точечные отличия. */
const G = (own: string, over: Partial<Grades> = {}): Grades => ({ base: own, standard: own, high: own, ...over });

const PREMIUM_SHOPS = ['Центральный', 'Северный', 'Заречный', 'Премиум'];

let pid = 0;
const P = (category: string, subcategory: string, name: string, grades: Grades, o: { shops?: string[]; isRed?: boolean; active?: boolean } = {}): Product => ({
  id: ++pid, category, subcategory, name, shops: o.shops ?? [], grades, isRed: !!o.isRed, active: o.active ?? true,
});

const products: Product[] = [
  // Ламинат (15)
  P('Ламинат', 'Alpine Floor', 'Intensity', G('2190|60;1990-2189|45', { high: '2190|75;1990-2189|55' })),
  P('Ламинат', 'Alpine Floor', 'Legno Extra', G('1290|35;1190-1289|25')),
  P('Ламинат', 'Alpine Floor', 'Premium', G('1690|45;1490-1689|32', { high: '1690|55;1490-1689|40' })),
  P('Ламинат', 'Alpine Floor', 'Milango', G('1490|40;1350-1489|28', { high: '1490|50;1350-1489|35' })),
  P('Ламинат', 'Woodstyle', 'Avangard', G('1390|40;1290-1389|30')),
  P('Ламинат', 'Woodstyle', 'Viva', G('890|25;790-889|18')),
  P('Ламинат', 'Woodstyle', 'BlackWood', G('1590|45;1450-1589|33')),
  P('Ламинат', 'Kastamonu', 'Floorpan Red', G('869|27,5;782-868|22,5', { base: '849|27,5;782-868|22,5' })),
  P('Ламинат', 'Kastamonu', 'Floorpan Black', G('1190|35;1090-1189|27')),
  P('Ламинат', 'Kastamonu', 'Floorpan Blue', G('990|30;890-989|22', { high: '990|36;890-989|27' })),
  P('Ламинат', 'Caspian', 'Craft', G('990|30;890-989|22', { base: '949|30;890-989|22' })),
  P('Ламинат', 'Caspian', 'Elite', G('1490|40;1390-1489|30', { high: '1490|48;1390-1489|36' })),
  P('Ламинат', 'Royce', 'Enjoy', G('790|22;690-789|15')),
  P('Ламинат', 'Royce', 'Grace', G('1090|32;990-1089|24')),
  P('Ламинат', 'Royce', 'Violet', G('1290|3%;1190-1289|2%')),
  // SPC (10)
  P('SPC', 'Alpine Floor', 'Grand Sequoia', G('2390|70;2190-2389|55')),
  P('SPC', 'Alpine Floor', 'Solo', G('1990|55;1790-1989|40')),
  P('SPC', 'Alpine Floor', 'Real Wood', G('2790|80;2590-2789|60', { high: '2790|95;2590-2789|72' })),
  P('SPC', 'Alpine Floor', 'Pronto', G('1590|50;1490-1589|40', { high: '1590|65;1490-1589|50' }), { isRed: true }),
  P('SPC', 'Aquafloor', 'Quartz', G('2290|65;2090-2289|50')),
  P('SPC', 'Aquafloor', 'Nano', G('2090|60;1890-2089|45', { high: '2090|72;1890-2089|54' })),
  P('SPC', 'Stone Floor', 'Дуб Натуральный', G('2490|70;2290-2489|55', { high: '2490|85;2290-2489|65' })),
  P('SPC', 'Stone Floor', 'Ясень Светлый', G('2390|65;2190-2389|50')),
  P('SPC', 'FloorFactor', 'Classic', G('1890|50;1690-1889|38')),
  P('SPC', 'FloorFactor', 'Herringbone', G('3190|90;2990-3189|70', { high: '3190|110;2990-3189|85' })),
  // Линолеум (6)
  P('Линолеум', 'Tarkett', 'Идиллия Нова', G('690|15;590-689|10')),
  P('Линолеум', 'Tarkett', 'Force', G('890|20;790-889|14')),
  P('Линолеум', 'Juteks', 'Strong Plus', G('590|12;490-589|8')),
  P('Линолеум', 'Juteks', 'Optimal', G('520|10;450-519|7')),
  P('Линолеум', 'Beauflor', 'Pietro', G('750|18;650-749|12')),
  P('Линолеум', 'Beauflor', 'Xtreme', G('990|25;890-989|18')),
  // Паркет (4) — только для магазинов из списка
  P('Паркет', 'Hajnowka', 'Дуб Натур', G('4990|150;4590-4989|110', { high: '4990|180;4590-4989|130' }), { shops: PREMIUM_SHOPS }),
  P('Паркет', 'Global Parquet', 'Дуб Селект', G('4290|120;3990-4289|90', { high: '4290|145;3990-4289|108' }), { shops: PREMIUM_SHOPS }),
  P('Паркет', 'Roman Ash', 'Ясень Рустик', G('3890|100;3590-3889|75'), { shops: PREMIUM_SHOPS }),
  P('Паркет', 'Roman Ash', 'Дуб Кантри', G('3590|90;3290-3589|65'), { shops: PREMIUM_SHOPS, active: false }),
  // Сопутствующие товары (4)
  P('Сопутствующие товары', 'Подложка', 'Подложка пробковая 2мм', G('190|5')),
  P('Сопутствующие товары', 'Плинтус', 'Плинтус Ideal Комфорт 55мм', G('149|4')),
  P('Сопутствующие товары', 'Клей', 'Клей Homakoll 208 14кг', G('1890|40;1790-1889|30')),
  P('Сопутствующие товары', 'Пороги', 'Порог Русский профиль 40мм', G('390|10')),
];

let sid = 0;
type ExtraTuple = [string, string] | [string, string, ExtraIcon, ExtraColor];
const S = (name: string, password: string, group: PriceGroup, extras: ExtraTuple[]): Shop => ({
  id: ++sid, name, password, group,
  extras: extras.map(([label, value, icon, color]) => ({ label, value, icon: icon ?? '', color: color ?? '' })),
});

const shops: Shop[] = [
  S('Центральный', '1234', 'standard', [
    ['План месяца', 'Цель 1 200 000 ₽', 'target', 'gold'],
    ['Бонус за план', '+5%', 'up', 'mint'],
    ['Скидка при самовывозе', '−3%', 'down', 'red'],
    ['Акция недели', 'SPC ×1,5 бонус', 'flame', 'orange'],
    ['Лучший продавец', 'Премия 10 000 ₽', 'trophy', 'purple'],
    ['Отчёт', 'до 25 числа', 'calendar', 'blue'],
  ]),
  S('Северный', '1234', 'standard', [['План месяца', 'Цель 900 000 ₽', 'target', 'gold'], ['Бонус за план', '+4%', 'up', 'mint'], ['Инвентаризация', '15 октября', 'info', 'gray']]),
  S('Западный', '1234', 'standard', [['Уценка', '−10% к бонусу', 'down', 'red'], ['План месяца', 'Цель 800 000 ₽', 'target', 'gold'], ['Внимание', 'Новый прайс с 1 числа', 'alert', 'orange']]),
  S('Южный', '1234', 'base', [['План месяца', 'Цель 600 000 ₽'], ['Бонус за план', '+3%']]),
  S('Восточный', '1234', 'base', [['План месяца', 'Цель 550 000 ₽']]),
  S('Дисконт', '1234', 'base', [['Уценка', '−15% к бонусу'], ['Бонус за объём', '+2%']]),
  S('Заречный', '5678', 'high', [['План месяца', 'Цель 1 500 000 ₽', 'target', 'gold'], ['Бонус за план', '+6%', 'up', 'mint'], ['Просрочка отчёта', '−1 000 ₽', 'alert', 'red'], ['Доставка', 'бесплатно от 30 м²', 'truck', 'cyan']]),
  S('Премиум', '5678', 'high', [['План месяца', 'Цель 2 000 000 ₽', 'target', 'gold'], ['Бонус за план', '+7%', 'up', 'mint'], ['VIP-клиенты', 'бонус ×2', 'star', 'pink']]),
];

export const SEED: AppData = ensureCategories({
  products,
  shops,
  promos: [
    { id: 1, start: '01.09.2026', end: '31.10.2026', category: 'Ламинат', product: 'Floorpan Red', price: '799', bonus: '40', grades: '799|40;750-798|32;до 749|25', comment: 'Осенняя распродажа: бонус выше базового на 12,5 ₽' },
    { id: 2, start: '01.01.2026', end: '31.12.2026', category: 'SPC', product: 'Grand Sequoia', price: '2290', bonus: '100', grades: '2290|100;2090-2289|80', comment: 'Двойной бонус на SPC при продаже от 30 м²' },
    { id: 3, start: '01.03.2026', end: '30.11.2026', category: 'Сопутствующие товары', product: 'Клей Homakoll 208 14кг', price: '1790', bonus: '60', grades: '1790|60', comment: 'Комплект: клей + паркет = бонус ×1,5' },
    { id: 4, start: '01.06.2025', end: '31.08.2025', category: 'Линолеум', product: 'Force', price: '790', bonus: '30', grades: '790|30', comment: 'Летняя акция (завершена)' },
  ],
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  settings: { reportEmail: 'otchet@stroimag.ru' },
  updatedAt: new Date(0).toISOString(),
});

export function cloneSeed(): AppData {
  return ensureCategories(JSON.parse(JSON.stringify(SEED)) as AppData);
}

export const EMPTY_DATA: AppData = ensureCategories({
  products: [], shops: [], promos: [], categories: [],
  settings: { reportEmail: '' },
  updatedAt: new Date(0).toISOString(),
});
