import {
  Bell, Calendar, Check, Clock, Coins, CircleAlert, Flame, Gift, Heart, Info, Minus, Percent, Plus, Star, Target, TrendingDown, TrendingUp, Trophy, Truck, Wallet, X, Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ExtraColor, ExtraIcon, ShopExtra } from './types';

export const MAX_EXTRAS = 10;

export const EXTRA_ICONS: { id: ExtraIcon; Icon: LucideIcon; label: string }[] = [
  { id: 'up', Icon: TrendingUp, label: 'Рост' },
  { id: 'down', Icon: TrendingDown, label: 'Падение' },
  { id: 'plus', Icon: Plus, label: 'Плюс' },
  { id: 'minus', Icon: Minus, label: 'Минус' },
  { id: 'target', Icon: Target, label: 'Цель' },
  { id: 'alert', Icon: CircleAlert, label: 'Внимание' },
  { id: 'info', Icon: Info, label: 'Инфо' },
  { id: 'star', Icon: Star, label: 'Звезда' },
  { id: 'trophy', Icon: Trophy, label: 'Награда' },
  { id: 'gift', Icon: Gift, label: 'Подарок' },
  { id: 'clock', Icon: Clock, label: 'Срок' },
  { id: 'percent', Icon: Percent, label: 'Процент' },
  { id: 'wallet', Icon: Wallet, label: 'Кошелёк' },
  { id: 'coins', Icon: Coins, label: 'Монеты' },
  { id: 'flame', Icon: Flame, label: 'Огонь' },
  { id: 'check', Icon: Check, label: 'Готово' },
  { id: 'x', Icon: X, label: 'Нет' },
  { id: 'calendar', Icon: Calendar, label: 'Календарь' },
  { id: 'truck', Icon: Truck, label: 'Доставка' },
  { id: 'heart', Icon: Heart, label: 'Сердце' },
  { id: 'zap', Icon: Zap, label: 'Молния' },
  { id: 'bell', Icon: Bell, label: 'Колокол' },
];

export const EXTRA_COLORS: { id: ExtraColor; hex: string; label: string }[] = [
  { id: 'gold', hex: '#f0c94a', label: 'Золото' },
  { id: 'mint', hex: '#3ddc97', label: 'Мята' },
  { id: 'red', hex: '#ff6b62', label: 'Красный' },
  { id: 'orange', hex: '#ff9f43', label: 'Оранжевый' },
  { id: 'blue', hex: '#5aa9ff', label: 'Синий' },
  { id: 'cyan', hex: '#4fd8e8', label: 'Бирюза' },
  { id: 'purple', hex: '#b388ff', label: 'Фиолетовый' },
  { id: 'pink', hex: '#ff7ab6', label: 'Розовый' },
  { id: 'gray', hex: '#a9b3ac', label: 'Серый' },
  { id: 'white', hex: '#f6f1e2', label: 'Белый' },
];

/** Быстрые «тона»: иконка + цвет одним нажатием. */
export const EXTRA_PRESETS: { id: string; label: string; icon: ExtraIcon; color: ExtraColor }[] = [
  { id: 'pos', label: 'Позитив', icon: 'up', color: 'mint' },
  { id: 'neg', label: 'Негатив', icon: 'down', color: 'red' },
  { id: 'neutral', label: 'Нейтрально', icon: 'info', color: 'gray' },
  { id: 'warn', label: 'Внимание', icon: 'alert', color: 'orange' },
  { id: 'goal', label: 'Цель', icon: 'target', color: 'gold' },
  { id: 'award', label: 'Награда', icon: 'trophy', color: 'purple' },
];

const ICON_IDS = new Set<string>(EXTRA_ICONS.map((i) => i.id));
const COLOR_IDS = new Set<string>(EXTRA_COLORS.map((c) => c.id));

export const isExtraIcon = (v: unknown): v is ExtraIcon => typeof v === 'string' && ICON_IDS.has(v);
export const isExtraColor = (v: unknown): v is ExtraColor => typeof v === 'string' && COLOR_IDS.has(v);

/** Авто-тон по значению: «−» → негатив, «+» → позитив, иначе цель. */
export function autoTone(value: string): { icon: ExtraIcon; color: ExtraColor } {
  const v = value.toLowerCase();
  if (/^\s*[-−–]/.test(value) || v.includes('штраф') || v.includes('просроч')) return { icon: 'minus', color: 'red' };
  if (/^\s*\+/.test(value) || v.includes('бонус') || v.includes('преми')) return { icon: 'plus', color: 'mint' };
  return { icon: 'target', color: 'gold' };
}

export interface ExtraStyle {
  Icon: LucideIcon;
  hex: string;
  color: ExtraColor;
  icon: ExtraIcon;
}

export function resolveExtra(e: ShopExtra): ExtraStyle {
  const auto = autoTone(e.value);
  const icon = isExtraIcon(e.icon) ? e.icon : auto.icon;
  const color = isExtraColor(e.color) ? e.color : auto.color;
  return {
    icon,
    color,
    Icon: EXTRA_ICONS.find((i) => i.id === icon)?.Icon ?? Target,
    hex: EXTRA_COLORS.find((c) => c.id === color)?.hex ?? '#f0c94a',
  };
}

/** Инлайн-стили плашки: фон/рамка/акцент в выбранном цвете (для тёмной темы). */
export function extraPlateStyle(hex: string): { plate: React.CSSProperties; icon: React.CSSProperties; text: React.CSSProperties } {
  return {
    plate: { background: `linear-gradient(135deg, ${hex}2e, ${hex}12)`, borderColor: `${hex}73` },
    icon: { background: `${hex}33`, color: hex, borderColor: `${hex}66` },
    text: { color: hex },
  };
}

const clean = (s: string) => String(s ?? '').replace(/[|;]/g, '/').replace(/\s+/g, ' ').trim();

export function normalizeExtra(e: Partial<ShopExtra> | null | undefined): ShopExtra {
  return {
    label: clean(e?.label ?? ''),
    value: clean(e?.value ?? ''),
    icon: isExtraIcon(e?.icon) ? e.icon : '',
    color: isExtraColor(e?.color) ? e.color : '',
  };
}

/** Кодирование для ячейки таблицы: `Название|Значение|иконка|цвет;…` (иконка/цвет могут быть пустыми). */
export function encodeExtras(list: ShopExtra[]): string {
  return list
    .map(normalizeExtra)
    .filter((e) => e.label || e.value)
    .slice(0, MAX_EXTRAS)
    .map((e) => {
      const parts = [e.label, e.value];
      if (e.icon || e.color) parts.push(e.icon, e.color);
      return parts.join('|');
    })
    .join(';');
}

export function decodeExtras(raw: string): ShopExtra[] {
  return String(raw ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const [label = '', value = '', icon = '', color = ''] = part.split('|').map((x) => x.trim());
      return normalizeExtra({ label, value, icon: icon as ExtraIcon, color: color as ExtraColor });
    })
    .filter((e) => e.label || e.value)
    .slice(0, MAX_EXTRAS);
}

/** Из JSON-массива, строки-кода или пар «название/значение» старого формата. */
export function parseExtras(v: unknown): ShopExtra[] {
  if (Array.isArray(v)) {
    return v.map((x) => normalizeExtra(x as Partial<ShopExtra>)).filter((e) => e.label || e.value).slice(0, MAX_EXTRAS);
  }
  if (typeof v === 'string') return decodeExtras(v);
  return [];
}
