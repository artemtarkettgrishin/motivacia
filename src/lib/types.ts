export type PriceGroup = 'base' | 'standard' | 'high';

/** Градации по группам прайса: 'цена|бонус;цена|бонус'. Пусто = товара нет в этом прайсе. */
export type Grades = Record<PriceGroup, string>;

export type CatIcon = 'laminate' | 'linoleum' | 'parquet' | 'spc' | 'related' | 'star' | 'box';

export interface Product {
  id: number;
  category: string;
  subcategory: string;
  name: string;
  /** Магазины, которым выдан товар. Пусто = все магазины. */
  shops: string[];
  grades: Grades;
  /** Выделять красным в прайсе и печати. */
  isRed: boolean;
  active: boolean;
}

export type ExtraIcon =
  | 'up' | 'down' | 'plus' | 'minus' | 'target' | 'alert' | 'info' | 'star' | 'trophy' | 'gift'
  | 'clock' | 'percent' | 'wallet' | 'coins' | 'flame' | 'check' | 'x' | 'calendar' | 'truck' | 'heart' | 'zap' | 'bell';

export type ExtraColor = 'gold' | 'mint' | 'red' | 'blue' | 'purple' | 'orange' | 'pink' | 'cyan' | 'gray' | 'white';

/** Плашка доп.условия магазина. icon/color пустые = подобрать автоматически по значению. */
export interface ShopExtra {
  label: string;
  value: string;
  icon: ExtraIcon | '';
  color: ExtraColor | '';
}

export interface Shop {
  id: number;
  name: string;
  password: string;
  group: PriceGroup;
  extras: ShopExtra[];
}

export interface Promo {
  id: number;
  start: string;
  end: string;
  category: string;
  product: string;
  /** Первая градация (для совместимости и печати): цена / бонус. */
  price: string;
  bonus: string;
  /** Все градации акции: 'цена|бонус;цена|бонус' (первая = price/bonus). */
  grades: string;
  comment: string;
}

export interface Category {
  id: number;
  name: string;
  icon: CatIcon;
  sortOrder: number;
}

export interface Settings {
  reportEmail: string;
}

export interface AppData {
  products: Product[];
  shops: Shop[];
  promos: Promo[];
  categories: Category[];
  settings: Settings;
  updatedAt: string;
  gasVersion?: number;
}

export interface GradRow {
  price: string;
  bonus: string;
}

export interface TopBonus {
  value: number;
  text: string;
  percent: boolean;
}

export interface PriceBlock {
  key: string;
  name: string;
  category: string;
  subcategory: string;
  isRed: boolean;
  rows: GradRow[];
  topBonus: TopBonus | null;
}

export type ResolveStatus = 'ok' | 'empty';

export interface ResolveResult {
  status: ResolveStatus;
  blocks: PriceBlock[];
}

export type Session = { role: 'seller'; shop: string } | { role: 'admin' };

export interface SyncLogEntry {
  ok: boolean;
  where: 'gas' | 'local' | 'google';
  detail: string;
  at: string;
}

export type PushReason = 'ok' | 'network' | 'timeout' | 'outdated' | 'server' | 'http' | 'busy';

export interface PushResult {
  ok: boolean;
  reason: PushReason;
  detail: string;
  counts?: { products: number; shops: number; priceRows: number };
  gasVersion?: number;
  /** Какие листы реально переписаны (v7+). */
  written?: string[];
}
