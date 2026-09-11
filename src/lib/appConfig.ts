import type { PriceGroup } from './types';

/**
 * ЕДИНСТВЕННЫЙ конфиг приложения — один для всех устройств.
 * Правится в репозитории → push → GitHub Pages пересобирает сайт.
 *
 * dataSource:
 *   'local'  — данные из сида/этого устройства (демо, без таблицы)
 *   'google' — чтение Google Таблицы через gviz (только чтение, нужен sheetId)
 *   'gas'    — чтение и ЗАПИСЬ через Apps Script Web App (нужен gasUrl)
 * gasUrl — если задан (…/exec), ЗАПИСЬ включается в ЛЮБОМ режиме.
 */
export interface AppConfig {
  dataSource: 'local' | 'google' | 'gas';
  sheetId: string;
  gasUrl: string;
  reportEmail: string;
  adminPassword: string;
  companyName: string;
}

export const appConfig: AppConfig = {
  dataSource: 'gas',
  sheetId: '',
  gasUrl: 'https://script.google.com/macros/s/AKfycbwx9ikEQmMHrVf4C5St3EBwQJGdEXkoTYJK8xFHIO-wdnWO8LOt1S4m3RRhLpoxcMs/exec',
  reportEmail: 'stroy52com@mail.ru',
  adminPassword: 'artem123456',
  companyName: 'Мотивация',
};

/** Минимальная версия Apps Script, с которой работает запись. */
export const REQUIRED_GAS_VERSION = 7;

export const PRICE_GROUPS: { id: PriceGroup; label: string; sheet: string }[] = [
  { id: 'base', label: 'Базовый', sheet: 'Прайс_Базовый' },
  { id: 'standard', label: 'Стандартный', sheet: 'Прайс_Стандартный' },
  { id: 'high', label: 'Высокий', sheet: 'Прайс_Высокий' },
];

export function priceLabel(id: PriceGroup): string {
  return PRICE_GROUPS.find((g) => g.id === id)?.label ?? 'Стандартный';
}

export function parseGroup(v: string | undefined | null): PriceGroup {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'базовый' || s === 'base' || s === 'базовая') return 'base';
  if (s === 'высокий' || s === 'high' || s === 'высокая') return 'high';
  return 'standard';
}

const OVERRIDE_KEY = 'mv:config-override:v1';

/** Переопределение на этом устройстве (для проверки без пересборки). */
export function readOverride(): Partial<Pick<AppConfig, 'gasUrl' | 'sheetId' | 'dataSource'>> {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    return raw ? (JSON.parse(raw) as Partial<AppConfig>) : {};
  } catch {
    return {};
  }
}

export function writeOverride(o: Partial<Pick<AppConfig, 'gasUrl' | 'sheetId' | 'dataSource'>> | null) {
  try {
    if (!o || Object.keys(o).length === 0) localStorage.removeItem(OVERRIDE_KEY);
    else localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

export function getConfig(): AppConfig {
  const o = readOverride();
  return {
    ...appConfig,
    ...(o.gasUrl ? { gasUrl: o.gasUrl } : {}),
    ...(o.sheetId ? { sheetId: o.sheetId } : {}),
    ...(o.dataSource ? { dataSource: o.dataSource } : {}),
  };
}

export function hasGas(cfg: AppConfig = getConfig()): boolean {
  return /^https?:\/\//i.test(cfg.gasUrl.trim());
}

export function isConfigReady(cfg: AppConfig = getConfig()): boolean {
  if (cfg.dataSource === 'local') return true;
  if (cfg.dataSource === 'google') return cfg.sheetId.trim().length > 10;
  return hasGas(cfg);
}

export function configFingerprint(cfg: AppConfig = getConfig()): string {
  return `${cfg.dataSource}|${cfg.sheetId.trim()}|${cfg.gasUrl.trim()}`;
}
