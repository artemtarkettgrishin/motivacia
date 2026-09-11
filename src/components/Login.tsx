import { useEffect, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Lock, RefreshCw, ShieldCheck, Store, WifiOff, CloudOff, Smartphone, Check } from 'lucide-react';
import type { AppData, Session } from '@/lib/types';
import { getConfig, priceLabel } from '@/lib/appConfig';
import { cn } from '@/utils/cn';
import { Skeleton } from './ui';
import { InstallModal } from './InstallHelp';
import { isStandalone } from '@/lib/install';

export default function Login({
  data, loading, error, offline, onRetry, onLogin,
}: {
  data: AppData | null;
  loading: boolean;
  error: string | null;
  offline: boolean;
  onRetry: () => void;
  onLogin: (s: Session) => void;
}) {
  const cfg = getConfig();
  const [role, setRole] = useState<'seller' | 'admin'>('seller');
  const [shop, setShop] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const standalone = isStandalone();

  useEffect(() => {
    setErr(null);
  }, [role, shop, pass]);

  const submit = () => {
    if (role === 'admin') {
      if (!pass) return setErr('Введите пароль');
      if (pass !== cfg.adminPassword) return setErr('Неверный пароль');
      onLogin({ role: 'admin' });
      return;
    }
    if (!shop) return setErr('Выберите магазин');
    if (!pass) return setErr('Введите пароль');
    const s = data?.shops.find((x) => x.name === shop);
    if (!s) return setErr('Магазин не найден');
    if (s.password !== pass) return setErr('Неверный пароль');
    onLogin({ role: 'seller', shop: s.name });
  };

  return (
    <div className="min-h-app flex items-center justify-center px-4 py-8 relative overflow-hidden" style={{ paddingTop: 'calc(var(--sat) + 2rem)' }}>
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-gold/10 blur-3xl" />
      <div className="w-full max-w-md relative animate-rise">
        <div className="flex items-center gap-3 mb-6">
          <div className="ic w-12 h-12 rounded-2xl bg-gradient-to-br from-gold2 to-gold text-goldink shadow-lime font-extrabold text-xl">М</div>
          <div className="min-w-0">
            <div className="text-xl font-extrabold leading-tight">Мотивация</div>
            <div className="text-sm text-ink3 truncate">{cfg.companyName} · прайс, бонусы, акции</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {offline && (
              <span className="pill pill-red">
                <CloudOff size={12} /> офлайн-копия
              </span>
            )}
          </div>
        </div>

        <div className="card p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'seller', label: 'Продавец', sub: 'магазин + пароль', Icon: Store },
                { id: 'admin', label: 'Админ', sub: 'панель управления', Icon: ShieldCheck },
              ] as const
            ).map(({ id, label, sub, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setRole(id)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-3 text-left transition-colors',
                  role === id ? 'border-gold bg-gradient-to-br from-gold2 to-gold text-goldink shadow-lime' : 'border-line bg-card2 text-ink2',
                )}
                style={{ minHeight: 60 }}
              >
                <span className={cn('ic w-10 h-10 rounded-xl', role === id ? 'bg-goldink/15' : 'bg-card border border-line')}>
                  <Icon size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block font-extrabold leading-tight">{label}</span>
                  <span className={cn('block text-xs truncate', role === id ? 'text-goldink/80' : 'text-ink3')}>{sub}</span>
                </span>
              </button>
            ))}
          </div>

          {error && !data ? (
            <div className="rounded-xl border border-red/50 bg-red/10 p-4 text-center space-y-3">
              <div className="ic w-12 h-12 mx-auto rounded-full bg-red/15 text-red2">
                <WifiOff size={22} />
              </div>
              <div className="font-bold text-red2">Нет соединения</div>
              <div className="text-sm text-ink2 break-words">{error}</div>
              <button type="button" className="btn-primary w-full" onClick={onRetry}>
                <RefreshCw size={18} /> Повторить
              </button>
            </div>
          ) : loading && !data ? (
            <div className="space-y-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-12" />
            </div>
          ) : (
            <>
              {role === 'seller' && (
                <div>
                  <label className="lbl" htmlFor="shop">Магазин</label>
                  <div className="relative">
                    <span className="ic absolute left-0 top-0 h-full w-[52px] text-ink3 pointer-events-none">
                      <Store size={20} />
                    </span>
                    <select
                      id="shop"
                      className="field appearance-none pl-[52px] pr-[52px]"
                      value={shop}
                      onChange={(e) => setShop(e.target.value)}
                    >
                      <option value="">Выберите магазин…</option>
                      {(data?.shops ?? []).map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} · {priceLabel(s.group)}
                        </option>
                      ))}
                    </select>
                    <span className="ic absolute right-0 top-0 h-full w-[52px] text-ink3 pointer-events-none">
                      <ChevronDown size={20} />
                    </span>
                  </div>
                </div>
              )}
              <div>
                <label className="lbl" htmlFor="pass">Пароль</label>
                <div className="relative">
                  <span className="ic absolute left-0 top-0 h-full w-[52px] text-ink3 pointer-events-none">
                    <Lock size={20} />
                  </span>
                  <input
                    id="pass"
                    type={show ? 'text' : 'password'}
                    className="field pl-[52px] pr-[52px]"
                    placeholder={role === 'admin' ? 'Пароль администратора' : 'Пароль магазина'}
                    value={pass}
                    autoComplete="current-password"
                    onChange={(e) => setPass(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submit();
                    }}
                  />
                  <button
                    type="button"
                    className="ic absolute right-0 top-0 h-full w-[52px] text-ink3 hover:text-ink"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {show ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              {err && <div className="text-sm font-semibold text-red2">{err}</div>}
              <button type="button" className="btn-accent w-full min-h-14 text-base" onClick={submit}>
                Войти
              </button>
              {error && data && (
                <div className="text-xs text-ink3 text-center">
                  Показана офлайн-копия · <button type="button" className="underline text-gold2" onClick={onRetry}>Повторить загрузку</button>
                </div>
              )}

              {/* ---- Как установить приложение (кнопка под формой) ---- */}
              {standalone ? (
                <div className="flex items-center justify-center gap-2 text-xs text-mint pt-1">
                  <Check size={14} /> Приложение установлено на этом устройстве
                </div>
              ) : (
                <button type="button" className="btn-primary w-full min-h-14 text-base" onClick={() => setInstallOpen(true)}>
                  <span className="ic w-6 h-6"><Smartphone size={20} /></span>
                  Как установить приложение?
                </button>
              )}
            </>
          )}
        </div>
        <InstallModal open={installOpen} onClose={() => setInstallOpen(false)} />
        <div className="mt-3 text-center text-xs text-ink3">
          Одна ссылка для телефона и ПК · данные в Google Таблице
        </div>
      </div>
    </div>
  );
}
