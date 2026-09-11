import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, WifiOff, X } from 'lucide-react';
import type { AppData, PushReason, Session } from '@/lib/types';
import { getConfig, hasGas } from '@/lib/appConfig';
import { ensureCategories } from '@/lib/categories';
import { cloneSeed } from '@/lib/seed';
import {
  clearDirty, clearSession, dirtyAt, isDirty, loadLocal, loadSession, loadSnapshot, pendingAt, resetAllLocal, saveLocal, saveSession, saveSnapshot, markDirty,
} from '@/lib/storage';
import { flushBeforePull, flushPending, pullFresh, retryDelayFor, syncNow, syncTarget } from '@/lib/sync';
import ViewportLock from '@/components/ViewportLock';
import Login from '@/components/Login';
import Seller from '@/components/Seller';
import AdminShell, { type SyncState } from '@/components/admin/AdminShell';

function pendingMarker(): string | null {
  if (!hasGas()) return null;
  return pendingAt() ?? (isDirty() ? dirtyAt() : null);
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [previewShop, setPreviewShop] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ phase: 'idle', text: '' });
  const [pending, setPending] = useState<string | null>(() => pendingMarker());
  const [flushing, setFlushing] = useState(false);
  const [logTick, setLogTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const latest = useRef<AppData | null>(null);
  const timer = useRef<number | null>(null);
  const busy = useRef(false);
  const again = useRef(false);
  const retryTimer = useRef<number | null>(null);
  const attempt = useRef(0);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const refreshMeta = useCallback(() => {
    setPending(pendingMarker());
    setLogTick((t) => t + 1);
  }, []);

  /* ---------------- повтор очереди: пауза растёт, при успехе сбрасывается ---------------- */
  const cancelRetry = useCallback(() => {
    if (retryTimer.current) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const scheduleRetry = useCallback((reason: PushReason) => {
    cancelRetry();
    if (!pendingMarker()) return;
    attempt.current += 1;
    const delay = retryDelayFor(reason, attempt.current);
    setSyncState({
      phase: 'retry',
      text: reason === 'busy'
        ? `Таблица занята — повторим через ${Math.round(delay / 1000)} с`
        : `Не отправлено — повторим через ${delay >= 60000 ? `${Math.round(delay / 60000)} мин` : `${Math.round(delay / 1000)} с`}`,
    });
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      void flushRef.current();
    }, delay);
  }, [cancelRetry]);

  /* ---------------- загрузка: очередь → снапшот → сеть ---------------- */
  const boot = useCallback(async (manual: boolean) => {
    const cfg = getConfig();
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const f = await flushBeforePull();
      if (f.blocked && f.local) {
        setData(f.local);
        latest.current = f.local;
        if (hasGas(cfg)) {
          setOffline(true);
          setError(`${f.result?.detail ?? 'Не удалось отправить правки.'} Показаны ваши локальные правки — они не потеряны и уйдут при появлении сети.`);
        } else {
          setOffline(false);
        }
        return;
      }
      const net = hasGas(cfg) || (cfg.dataSource === 'google' && cfg.sheetId.trim().length > 0);
      if (!net) {
        const local = loadLocal() ?? cloneSeed();
        setData(local);
        latest.current = local;
        saveLocal(local);
        setOffline(false);
        return;
      }
      if (!manual) {
        const snap = loadSnapshot();
        if (snap) {
          setData(snap);
          latest.current = snap;
          setLoading(false);
        }
      }
      try {
        const fresh = await pullFresh(cfg);
        const prev = loadSnapshot();
        if (fresh && !fresh.products.length && !fresh.shops.length && prev && (prev.products.length || prev.shops.length)) {
          throw new Error('Таблица вернула пустые данные (возможно, в этот момент шла запись). Показана последняя копия.');
        }
        if (fresh) {
          setData(fresh);
          latest.current = fresh;
          saveSnapshot(fresh);
          saveLocal(fresh);
          clearDirty();
          setOffline(false);
          setToast(null);
        }
      } catch (e) {
        const msg = (e as Error)?.message || 'Не удалось загрузить данные.';
        const fallback = loadSnapshot() ?? loadLocal();
        if (fallback) {
          setData(fallback);
          latest.current = fallback;
          setOffline(true);
          setToast(`Нет соединения: ${msg} Показана офлайн-копия.`);
        } else {
          setError(`${msg} Проверьте интернет и нажмите «Повторить».`);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      refreshMeta();
    }
  }, [refreshMeta]);

  useEffect(() => {
    void boot(false);
  }, [boot]);

  /* ---------------- автосохранение с дебаунсом ---------------- */
  const runSync = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        again.current = false;
        const draft = latest.current;
        if (!draft) break;
        setSyncState({ phase: syncTarget() === 'gas' ? 'pushing' : 'saving', text: '' });
        const r = await syncNow(draft);
        if (r.ok) {
          attempt.current = 0;
          cancelRetry();
          setSyncState({ phase: 'done', text: r.detail });
        } else {
          setSyncState({ phase: 'fail', text: r.detail });
        }
        if (r.target === 'gas') setOffline(!r.ok);
        if (!r.ok && !again.current) scheduleRetry(r.reason);
      } while (again.current);
    } finally {
      busy.current = false;
      refreshMeta();
    }
  }, [refreshMeta, cancelRetry, scheduleRetry]);

  const commit = useCallback(
    (next: AppData) => {
      const d = ensureCategories({ ...next, updatedAt: new Date().toISOString() });
      latest.current = d;
      setData(d);
      saveLocal(d);
      markDirty();
      setSyncState({ phase: 'saving', text: '' });
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void runSync(), 1800);
    },
    [runSync],
  );

  /* ---------------- очередь: кнопка + online + 30 сек ---------------- */
  const flush = useCallback(async () => {
    cancelRetry();
    setFlushing(true);
    try {
      setSyncState({ phase: 'pushing', text: '' });
      const r = await flushPending();
      if (r) {
        if (r.ok) {
          attempt.current = 0;
          setSyncState({ phase: 'done', text: r.detail });
          setOffline(false);
          setError(null);
          setToast(null);
        } else {
          setSyncState({ phase: 'fail', text: r.detail });
          scheduleRetry(r.reason);
        }
      } else {
        setSyncState({ phase: 'idle', text: '' });
      }
    } finally {
      setFlushing(false);
      refreshMeta();
    }
  }, [refreshMeta, cancelRetry, scheduleRetry]);
  flushRef.current = flush;

  useEffect(() => {
    // сеть вернулась / приложение снова открыто → сразу отправляем очередь
    const kick = () => {
      if (pendingMarker() && navigator.onLine !== false) {
        attempt.current = 0;
        void flushRef.current();
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') kick();
    };
    window.addEventListener('online', kick);
    document.addEventListener('visibilitychange', onVisible);
    // при старте с непустой очередью — первая попытка через 5 с (после загрузки)
    const first = window.setTimeout(kick, 5000);
    // страховка: раз в 2 минуты, если очередь есть, а таймер повтора почему-то не стоит
    const iv = window.setInterval(() => {
      if (pendingMarker() && !retryTimer.current && navigator.onLine !== false) void flushRef.current();
    }, 120000);
    return () => {
      window.removeEventListener('online', kick);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearTimeout(first);
      window.clearInterval(iv);
      cancelRetry();
    };
  }, [cancelRetry]);

  /* ---------------- сессия ---------------- */
  const login = (s: Session) => {
    saveSession(s);
    setSession(s);
  };
  const logout = () => {
    clearSession();
    setSession(null);
    setPreviewShop(null);
  };

  const resetSeed = () => {
    resetAllLocal();
    commit(cloneSeed());
  };

  /* ---------------- рендер ---------------- */
  let screen: React.ReactNode;
  if (session?.role === 'admin' && data) {
    const shop = previewShop ? data.shops.find((s) => s.name === previewShop) : undefined;
    screen = shop ? (
      <Seller data={data} shop={shop} offline={offline} refreshing={refreshing} onRefresh={() => void boot(true)} onLogout={logout} preview onBackToAdmin={() => setPreviewShop(null)} />
    ) : (
      <AdminShell
        data={data}
        commit={commit}
        syncState={syncState}
        pendingAt={pending}
        flushing={flushing}
        onFlush={() => void flush()}
        onRefresh={() => void boot(true)}
        refreshing={refreshing}
        onLogout={logout}
        onPreview={setPreviewShop}
        onResetSeed={resetSeed}
        onImport={commit}
        logTick={logTick}
      />
    );
  } else if (session?.role === 'seller' && data) {
    const shop = data.shops.find((s) => s.name === session.shop);
    if (shop) {
      screen = <Seller data={data} shop={shop} offline={offline} refreshing={refreshing} onRefresh={() => void boot(true)} onLogout={logout} />;
    } else {
      screen = (
        <Login data={data} loading={false} error={`Магазин «${session.shop}» больше не найден — войдите заново.`} offline={offline} onRetry={() => void boot(true)} onLogin={login} />
      );
    }
  } else {
    screen = <Login data={data} loading={loading} error={error} offline={offline} onRetry={() => void boot(true)} onLogin={login} />;
  }

  return (
    <>
      <ViewportLock />
      {screen}
      {(toast || (error && data)) && (
        <div className="fixed left-3 right-3 md:left-auto md:right-6 md:w-[420px] bottom-[calc(100px+var(--sab))] md:bottom-6 z-[90] animate-rise">
          <div className="rounded-2xl border border-red/50 bg-card shadow-pop p-3 flex items-start gap-3">
            <span className="ic w-9 h-9 rounded-xl bg-red/15 text-red2 flex-none"><WifiOff size={18} /></span>
            <div className="min-w-0 flex-1 text-sm text-ink2">{toast ?? error}</div>
            <div className="flex flex-col gap-1">
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => void boot(true)} aria-label="Повторить"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => { setToast(null); setError(null); }} aria-label="Закрыть"><X size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
