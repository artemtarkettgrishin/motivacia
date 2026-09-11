import { Layers, Scroll, TreePine, LayoutGrid, Wrench, Star, Boxes, Sparkles, type LucideIcon } from 'lucide-react';
import type { AppData, CatIcon, Category } from './types';

export const CAT_ICONS: Record<CatIcon, LucideIcon> = {
  laminate: Layers,
  linoleum: Scroll,
  parquet: TreePine,
  spc: LayoutGrid,
  related: Wrench,
  star: Star,
  box: Boxes,
};

export const ICON_ALL: LucideIcon = LayoutGrid;
export const ICON_PROMO: LucideIcon = Sparkles;

export const CAT_ICON_LIST: { id: CatIcon; label: string }[] = [
  { id: 'laminate', label: 'Ламинат' },
  { id: 'linoleum', label: 'Линолеум' },
  { id: 'parquet', label: 'Паркет' },
  { id: 'spc', label: 'SPC' },
  { id: 'related', label: 'Сопутствующие' },
  { id: 'star', label: 'Звезда' },
  { id: 'box', label: 'Коробка' },
];

export function isCatIcon(v: unknown): v is CatIcon {
  return typeof v === 'string' && v in CAT_ICONS;
}

export function catIcon(icon: string | undefined): LucideIcon {
  return isCatIcon(icon) ? CAT_ICONS[icon] : Boxes;
}

export function iconForCategory(data: AppData, name: string): LucideIcon {
  const c = data.categories.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
  return catIcon(c?.icon);
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Ламинат', icon: 'laminate', sortOrder: 1 },
  { id: 2, name: 'Линолеум', icon: 'linoleum', sortOrder: 2 },
  { id: 3, name: 'Паркет', icon: 'parquet', sortOrder: 3 },
  { id: 4, name: 'SPC', icon: 'spc', sortOrder: 4 },
  { id: 5, name: 'Сопутствующие товары', icon: 'related', sortOrder: 5 },
];

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Гарантирует справочник категорий: дефолтные 5 + категории из товаров (иконка box),
 * отсортировано по sortOrder. Вызывается ВЕЗДЕ, где данные попадают в приложение.
 */
export function ensureCategories<T extends AppData>(d: T): T {
  const list: Category[] = Array.isArray(d.categories) ? d.categories.map((c) => ({ ...c })) : [];
  let nextId = list.reduce((m, c) => Math.max(m, Number(c.id) || 0), 0) + 1;
  const has = (name: string) => list.some((c) => norm(c.name) === norm(name));

  // Дефолтные 5 — только если справочника ещё нет (иначе удалённая админом категория воскресала бы).
  if (list.length === 0) {
    for (const def of DEFAULT_CATEGORIES) {
      if (!has(def.name)) list.push({ ...def, id: nextId++ });
    }
  }
  for (const p of d.products || []) {
    const name = (p.category || '').trim();
    if (name && !has(name)) {
      list.push({ id: nextId++, name, icon: 'box', sortOrder: list.length + 1 });
    }
  }
  list.forEach((c, i) => {
    if (!isCatIcon(c.icon)) c.icon = 'box';
    if (!Number.isFinite(Number(c.sortOrder))) c.sortOrder = i + 1;
    c.sortOrder = Number(c.sortOrder);
  });
  list.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  return { ...d, categories: list };
}
