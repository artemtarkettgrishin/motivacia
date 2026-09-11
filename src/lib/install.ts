/** Установка PWA: ловим beforeinstallprompt как можно раньше (импортируется из main.tsx). */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((fn) => fn());
  });
}

export function canPromptInstall(): boolean {
  return !!deferred;
}

export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Показать системный диалог установки (Android Chrome / Samsung / ПК). true = установлено. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const ev = deferred;
  deferred = null;
  try {
    await ev.prompt();
    const r = await ev.userChoice;
    return r.outcome === 'accepted';
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

export type Platform = 'iphone' | 'samsung' | 'android' | 'huawei' | 'desktop';

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return 'iphone';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/HuaweiBrowser|HONOR|HUAWEI/i.test(ua)) return 'huawei';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}
