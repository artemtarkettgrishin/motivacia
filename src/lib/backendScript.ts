import type { AppData } from './types';
import { priceLabel } from './appConfig';
import { encodeExtras } from './extras';
import { GAS_TEMPLATE } from './gasTemplate';

export const SHEET_NAMES = ['Товары', 'Магазины', 'Акции', 'Категории', 'Настройки'] as const;

export type SheetName = (typeof SHEET_NAMES)[number];

export const SHEET_HEADERS: Record<SheetName, string[]> = {
  'Товары': ['Категория', 'Подкатегория', 'Название', 'Магазины', 'Базовый', 'Стандартный', 'Высокий', 'Красный', 'Статус'],
  'Магазины': ['Название', 'Пароль', 'Прайс-группа', 'Доп.условия'],
  'Акции': ['Начало', 'Конец', 'Категория', 'Товар', 'Цена', 'Бонус', 'Комментарий', 'Градации'],
  'Категории': ['Название', 'Иконка', 'Порядок'],
  'Настройки': ['Параметр', 'Значение'],
};

export const SHEET_DESCRIPTIONS: Record<SheetName, string> = {
  'Товары': 'Одна строка = товар. Магазины через запятую (пусто = все). Базовый/Стандартный/Высокий — градации «цена|бонус;цена|бонус» (пусто = товара нет в этом прайсе). Красный «да». Статус активен/выключен',
  'Магазины': 'Название, пароль продавца, прайс-группа (какую колонку цен видит), Доп.условия — до 10 плашек «Название|Значение|иконка|цвет» через «;»',
  'Акции': 'Даты ДД.ММ.ГГГГ, категория, товар, цена и бонус (первая градация), комментарий, Градации «цена|бонус;цена|бонус» (все ступени акции)',
  'Категории': 'Название, иконка (laminate/linoleum/parquet/spc/related/star/box), порядок',
  'Настройки': 'Параметр → Значение (Email для отчётов)',
};

/** AppData → строки по листам (без шапок). */
export function dataToSheets(d: AppData): Record<SheetName, string[][]> {
  return {
    'Товары': d.products.map((p) => [
      p.category, p.subcategory, p.name, p.shops.join(', '), p.grades.base, p.grades.standard, p.grades.high, p.isRed ? 'да' : '', p.active ? 'активен' : 'выключен',
    ]),
    'Магазины': d.shops.map((s) => [s.name, s.password, priceLabel(s.group), encodeExtras(s.extras)]),
    'Акции': d.promos.map((p) => [p.start, p.end, p.category, p.product, p.price, p.bonus, p.comment, p.grades]),
    'Категории': d.categories.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((c, i) => [c.name, c.icon, String(i + 1)]),
    'Настройки': [['Email для отчётов', d.settings.reportEmail]],
  };
}

export function buildTsv(d: AppData, sheet: SheetName): string {
  const clean = (v: string) => String(v ?? '').replace(/[\t\r\n]+/g, ' ');
  const rows = [SHEET_HEADERS[sheet], ...dataToSheets(d)[sheet]];
  return rows.map((r) => r.map(clean).join('\t')).join('\n');
}

/** Полный текст Apps Script с текущими данными в DATA (для setupMotivaciya). */
export function buildBackendScript(d: AppData): string {
  const json = JSON.stringify(dataToSheets(d), null, 1).replace(/<\/script/gi, '<\\/script');
  return GAS_TEMPLATE.replace('__DATA__', json);
}
