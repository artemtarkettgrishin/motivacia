import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, ChevronDown, Download, FileSpreadsheet, LogOut, Mail, Printer, RefreshCw, Search, Send, Sparkles, X, Tag, ShieldAlert, Smartphone,
} from 'lucide-react';
import type { AppData, PriceBlock, Shop } from '@/lib/types';
import { getConfig, hasGas, priceLabel } from '@/lib/appConfig';
import { blockMatches, fmtRuDate, isPromoActive, norm, prettyPrice, promoGrades, promoStatus, resolvePrice, summaryOf } from '@/lib/pricing';
import { extraPlateStyle, resolveExtra, MAX_EXTRAS } from '@/lib/extras';
import { isStandalone } from '@/lib/install';
import { catIcon, ICON_ALL, ICON_PROMO } from '@/lib/categories';
import { buildMailto, buildReportHtml, buildReportText, downloadExcel, type ReportArgs } from '@/lib/excel';
import { sendReportViaGas } from '@/lib/gsheet';
import { cn } from '@/utils/cn';
import { BonusChip, Overlay, useMediaQuery } from './ui';
import PrintDoc from './PrintDoc';
import Dock, { type DockItem } from './Dock';
import { InstallButton } from './InstallHelp';

interface Props {
  data: AppData;
  shop: Shop;
  offline: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  preview?: boolean;
  onBackToAdmin?: () => void;
}

type Tab = 'all' | 'promo' | string;

function ColCard({ b }: { b: PriceBlock }) {
  return (
    <article className={cn('card card-lift relative overflow-hidden', b.isRed && 'border-red/40')}>
      <span className={cn('absolute left-0 top-0 bottom-0 w-1.5', b.isRed ? 'bg-red' : 'bg-gradient-to-b from-gold2 to-gold')} />
      <header className="flex items-start gap-3 pl-4 pr-3 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <h4 className={cn('font-extrabold leading-snug line-clamp-2 min-h-[2.6em]', b.isRed ? 'text-red2' : 'text-ink')}>{b.name}</h4>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className="pill pill-dark">{b.rows.length} град.</span>
            {b.subcategory && <span className="pill pill-dark truncate max-w-[160px]">{b.subcategory}</span>}
          </div>
        </div>
        {b.topBonus && (
          <div className="text-right flex-none">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink3">топ-бонус</div>
            <div className={cn('font-mono font-bold text-lg leading-tight', b.isRed ? 'text-red2' : 'text-gold2')}>
              {b.topBonus.text}
              {b.topBonus.percent ? '' : ' ₽'}
            </div>
          </div>
        )}
      </header>
      <ul className="border-t border-line">
        {b.rows.map((r, i) => (
          <li key={i} className="flex items-center gap-3 min-h-[44px] pl-4 pr-3 border-b border-line/60 last:border-0">
            <span className={cn('w-1 h-6 rounded-full flex-none', b.isRed ? 'bg-red/70' : i === 0 ? 'bg-gold' : 'bg-gold/40')} />
            <span className="font-mono font-semibold truncate flex-1 text-ink">{prettyPrice(r.price) || '—'}</span>
            <BonusChip bonus={r.bonus} red={b.isRed} />
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function Seller({ data, shop, offline, refreshing, onRefresh, onLogout, preview, onBackToAdmin }: Props) {
  const cfg = getConfig();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const accKey = `mv:acc:${shop.name}`;
  const [acc, setAcc] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(accKey) ?? '{}') as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const toggleAcc = (k: string) => {
    setAcc((prev) => {
      const next = { ...prev, [k]: !(prev[k] ?? true) };
      try {
        localStorage.setItem(accKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const resolved = useMemo(() => resolvePrice(data, shop), [data, shop]);
  const blocks = resolved.blocks;
  const summary = useMemo(() => summaryOf(blocks), [blocks]);
  const activePromos = useMemo(() => data.promos.filter((p) => isPromoActive(p)), [data.promos]);
  const otherPromos = useMemo(() => data.promos.filter((p) => !isPromoActive(p)), [data.promos]);
  const categories = data.categories;

  const countByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of blocks) m.set(norm(b.category), (m.get(norm(b.category)) ?? 0) + 1);
    return m;
  }, [blocks]);

  const filtered = useMemo(
    () => blocks.filter((b) => (tab === 'all' || tab === 'promo' ? true : norm(b.category) === norm(tab))).filter((b) => blockMatches(b, query)),
    [blocks, tab, query],
  );

  const groups = useMemo(() => {
    const out: { key: string; title: string; sub: string; items: PriceBlock[] }[] = [];
    for (const b of filtered) {
      const title = b.subcategory.trim() || 'Без подкатегории';
      const key = `${norm(b.category)}::${norm(title)}`;
      let g = out.find((x) => x.key === key);
      if (!g) {
        g = { key, title, sub: b.category.trim() || 'Прочее', items: [] };
        out.push(g);
      }
      g.items.push(b);
    }
    return out;
  }, [filtered]);

  // высота липкой шапки → CSS var для липкого поиска
  useEffect(() => {
    const el = headRef.current;
    const root = rootRef.current;
    if (!el || !root) return;
    const apply = () => root.style.setProperty('--hh', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // хоткей "/" на ПК
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const today = fmtRuDate(new Date());
  const reportArgs: ReportArgs = useMemo(
    () => ({ blocks, promos: activePromos, shop: shop.name, price: priceLabel(shop.group), company: cfg.companyName, date: today, extras: shop.extras }),
    [blocks, activePromos, shop, cfg.companyName, today],
  );

  const goPrice = () => {
    setTab('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goPromo = () => {
    setTab('promo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const resetAll = () => {
    setQuery('');
    setTab('all');
  };

  const priceChip =
    shop.group === 'high' ? 'pill-gold' : shop.group === 'base' ? 'pill-dark' : 'pill-gold-line';

  const printPortal = createPortal(
    <div id="print-root">
      <PrintDoc {...reportArgs} />
    </div>,
    document.body,
  );

  return (
    <div ref={rootRef} className="min-h-app pb-[calc(112px+var(--sab))] md:pb-10">
      {/* ---------- ШАПКА ---------- */}
      <div ref={headRef} className="sticky top-0 z-40 safe-top bg-[#15130a]">
        {preview && (
          <div className="bg-[#ffec32] text-black text-sm font-bold px-4 py-2 flex items-center gap-3">
            <span className="ic w-6 h-6"><ShieldAlert size={18} /></span>
            <span className="flex-1 min-w-0 truncate">Предпросмотр админа: так видит продавец «{shop.name}»</span>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-black text-[#ffec32] px-3 min-h-9 font-bold" onClick={onBackToAdmin}>
              <ArrowLeft size={16} /> Назад в панель
            </button>
          </div>
        )}
        <header className="border-b border-gold/25 bg-gradient-to-r from-[#1a1508] via-[#0f1411] to-[#0c110e] backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <div className="ic w-11 h-11 rounded-2xl bg-gradient-to-br from-gold2 to-gold text-goldink shadow-lime font-extrabold text-lg">М</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-base md:text-lg font-extrabold truncate min-w-0">{shop.name}</h1>
                <span className={cn('pill', priceChip)}>{priceLabel(shop.group)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink3 min-w-0">
                <span className={cn('live-dot', offline ? 'off' : 'on')} />
                <span className="truncate">{offline ? 'офлайн-копия' : 'онлайн'} · {cfg.companyName}</span>
              </div>
            </div>
            {/* Действия — только на ПК. На телефоне все кнопки внизу (удобно большим пальцем). */}
            <div className="hidden md:flex items-center gap-2">
              <button type="button" className="icon-btn" onClick={onRefresh} aria-label="Обновить" title="Обновить">
                <RefreshCw size={20} className={cn(refreshing && 'animate-spin')} />
              </button>
              <button type="button" className="icon-btn" onClick={() => setPrintOpen(true)} aria-label="Печать" title="Печать">
                <Printer size={20} />
              </button>
              <button type="button" className="btn-accent min-h-12 px-4" onClick={() => setSendOpen(true)}>
                <Send size={18} /> Отправить
              </button>
              <button type="button" className="icon-btn" onClick={onLogout} aria-label="Выйти" title="Выйти">
                <LogOut size={20} />
              </button>
            </div>
            {refreshing && <RefreshCw size={18} className="md:hidden text-gold2 animate-spin flex-none" />}
          </div>
        </header>
      </div>

      {/* статистика */}
      <div className="bg-gradient-to-b from-[#0c110e] to-bg border-b border-line">
        <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-3 gap-2">
          {[
            { l: 'коллекций', v: String(summary.collections) },
            { l: 'градаций', v: String(summary.gradations) },
            { l: 'топ-бонус', v: summary.top ? `${summary.top.text}${summary.top.percent ? '' : ' ₽'}` : '—', gold: true },
          ].map((s) => (
            <div key={s.l} className="glass-card px-3 py-2">
              <div className={cn('font-mono font-bold text-lg leading-tight truncate', s.gold ? 'text-gold2' : 'text-ink')}>{s.v}</div>
              <div className="text-[11px] uppercase tracking-wider text-ink3 truncate">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- ПОИСК (sticky) ---------- */}
      <div className="sticky z-30 bg-bg/90 backdrop-blur-xl border-b border-line" style={{ top: 'var(--hh, 60px)' }}>
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="relative">
            <span className="ic absolute left-1.5 top-1/2 -translate-y-1/2 w-10 h-10 text-ink3 pointer-events-none">
              <Search size={20} />
            </span>
            <input
              ref={searchRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              className="field pl-[52px] pr-[52px]"
              style={{ minHeight: 52 }}
              placeholder="Поиск: коллекция, бренд, цена, бонус…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query ? (
                <button type="button" className="ic w-10 h-10 rounded-lg text-ink3 hover:text-ink" onClick={() => setQuery('')} aria-label="Очистить">
                  <X size={20} />
                </button>
              ) : (
                <span className="hidden md:inline-flex items-center gap-1.5 pr-2 text-xs text-ink3 whitespace-nowrap">
                  {blocks.length} колл. <kbd className="kbd">/</kbd>
                </span>
              )}
            </span>
          </div>
          {query && (
            <div className="flex items-center gap-3 mt-1.5 text-sm text-ink2">
              <span>Найдено: <b className="font-mono text-ink">{filtered.length}</b></span>
              <button type="button" className="text-gold2 underline underline-offset-2" onClick={() => setQuery('')}>Сбросить</button>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 pt-4 space-y-5">
        {/* ---------- ДОП.УСЛОВИЯ ---------- */}
        {shop.extras.length > 0 && (
          <section>
            <div className="chip-scroll md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:mx-0 md:px-0 md:overflow-visible">
              {shop.extras.slice(0, MAX_EXTRAS).map((e, i) => {
                const st = resolveExtra(e);
                const css = extraPlateStyle(st.hex);
                return (
                  <div
                    key={i}
                    className="relative overflow-hidden rounded-2xl border flex items-center gap-3 pl-3 pr-3 py-2.5 min-w-[232px] max-w-[280px] md:min-w-0 md:max-w-none backdrop-blur-md"
                    style={{ ...css.plate, scrollSnapAlign: 'start' }}
                  >
                    <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: st.hex }} />
                    <span className="ic w-10 h-10 rounded-xl border flex-none" style={css.icon}>
                      <st.Icon size={19} strokeWidth={2.4} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wider text-ink2 truncate">{e.label || '\u00a0'}</div>
                      <div className="font-mono font-bold truncate" style={css.text}>{e.value || '—'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ---------- МЕНЮ КАТЕГОРИЙ ---------- */}
        <nav className="chip-scroll" aria-label="Категории">
          <button type="button" className={cn('nav-pill', tab === 'all' && 'active')} onClick={() => setTab('all')}>
            <span className="np-ic"><ICON_ALL size={16} /></span>
            Все
            <span className="np-n">{blocks.length}</span>
          </button>
          {categories.map((c) => {
            const Icon = catIcon(c.icon);
            return (
              <button key={c.id} type="button" className={cn('nav-pill', tab === c.name && 'active')} onClick={() => setTab(c.name)}>
                <span className="np-ic"><Icon size={16} /></span>
                {c.name}
                <span className="np-n">{countByCat.get(norm(c.name)) ?? 0}</span>
              </button>
            );
          })}
          <button type="button" className={cn('nav-pill promo', tab === 'promo' && 'active')} onClick={() => setTab('promo')}>
            <span className="np-ic"><ICON_PROMO size={16} /></span>
            Акции
            <span className="np-n">{activePromos.length}</span>
          </button>
        </nav>

        {/* ---------- КОНТЕНТ ---------- */}
        {tab === 'promo' ? (
          <PromoList active={activePromos} other={otherPromos} />
        ) : resolved.status === 'empty' ? (
          <div className="card p-6 text-center space-y-3 max-w-lg mx-auto animate-rise">
            <div className="ic w-14 h-14 mx-auto rounded-full bg-gold/15 text-gold2"><Tag size={26} /></div>
            <h3 className="text-lg font-extrabold">Прайс пуст</h3>
            <p className="text-sm text-ink2">
              Для магазина «{shop.name}» (прайс «{priceLabel(shop.group)}») пока нет товаров с ценами. Администратор назначает товары магазинам и заполняет колонку «{priceLabel(shop.group)}» во вкладке «Прайс».
            </p>
            <button type="button" className="btn-primary" onClick={onRefresh}>
              <RefreshCw size={18} /> Проверить снова
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-6 text-center space-y-3 max-w-lg mx-auto animate-rise">
            <div className="ic w-14 h-14 mx-auto rounded-full bg-card2 text-ink3"><Search size={26} /></div>
            <h3 className="text-lg font-extrabold">{query ? 'Ничего не найдено' : tab !== 'all' ? 'В категории пусто' : 'Прайс пуст'}</h3>
            <p className="text-sm text-ink2">
              {query
                ? `По запросу «${query.trim()}»${tab !== 'all' ? ` в категории «${tab}»` : ''} ничего нет. Попробуйте другое слово или цену.`
                : tab !== 'all'
                  ? `В категории «${tab}» пока нет коллекций для вашего прайса.`
                  : 'В прайсе пока нет ни одной коллекции.'}
            </p>
            <button type="button" className="btn-primary" onClick={resetAll}>Показать всё</button>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => {
              const open = query ? true : (acc[g.key] ?? true);
              return (
                <section key={g.key} className="animate-rise">
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 text-left py-1"
                    onClick={() => toggleAcc(g.key)}
                    aria-expanded={open}
                  >
                    <span className="ic w-9 h-9 rounded-full border border-line bg-card2 text-ink2">
                      <ChevronDown size={18} className={cn('transition-transform', !open && '-rotate-90')} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold truncate">{g.title}</span>
                      <span className="block text-xs text-ink3 truncate">{g.sub} · {g.items.length} колл.</span>
                    </span>
                  </button>
                  {open && (
                    <div className="acc-body grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {g.items.map((b) => (
                        <ColCard key={b.key} b={b} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {tab === 'all' && !query && activePromos.length > 0 && resolved.status === 'ok' && (
          <section>
            <div className="sec-head">
              <h3 className="sec-title flex items-center gap-2"><Sparkles size={14} className="text-red2" /> Активные акции</h3>
              <button type="button" className="text-sm text-gold2 underline underline-offset-2" onClick={goPromo}>Все акции</button>
            </div>
            <PromoList active={activePromos.slice(0, isDesktop ? 3 : 2)} other={[]} />
          </section>
        )}

        {!isStandalone() && !preview && (
          <section className="glass-card flex flex-col sm:flex-row sm:items-center gap-3 p-4">
            <span className="ic w-11 h-11 rounded-xl bg-gold/15 text-gold2 flex-none"><Smartphone size={22} /></span>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold">Добавьте «Мотивацию» на рабочий стол</div>
              <div className="text-sm text-ink2">Откроется как приложение — на весь экран, с офлайн-копией прайса.</div>
            </div>
            <InstallButton className="min-h-12 sm:flex-none" label="Как установить" />
          </section>
        )}
      </main>

      {/* ---------- МОБИЛЬНЫЙ ДОК ---------- */}
      <Dock
        items={
          [
            { key: 'price', label: 'Прайс', Icon: FileSpreadsheet, active: tab !== 'promo', onClick: goPrice },
            { key: 'promo', label: 'Акции', Icon: Sparkles, active: tab === 'promo', onClick: goPromo, badge: activePromos.length },
            { key: 'send', label: 'Отправить', Icon: Send, primary: true, onClick: () => setSendOpen(true) },
            { key: 'refresh', label: 'Обновить', Icon: RefreshCw, onClick: onRefresh, spin: refreshing },
            preview
              ? { key: 'back', label: 'Назад', Icon: ArrowLeft, onClick: () => onBackToAdmin?.() }
              : { key: 'logout', label: 'Выйти', Icon: LogOut, onClick: onLogout },
          ] satisfies DockItem[]
        }
      />

      <SendModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        onPrint={() => {
          setSendOpen(false);
          setPrintOpen(true);
        }}
        args={reportArgs}
        defaultEmail={data.settings.reportEmail || cfg.reportEmail}
      />

      <Overlay open={printOpen} onClose={() => setPrintOpen(false)} wide title={
        <div className="grid grid-cols-2 md:flex md:items-center gap-2 pr-2">
          <button type="button" className="btn-primary min-h-11" onClick={() => setPrintOpen(false)}>Закрыть</button>
          <button type="button" className="btn-accent min-h-11" onClick={() => window.print()}><Printer size={18} /> Печатать</button>
          <span className="hidden md:inline text-sm text-ink3 ml-2">A4 · альбомная · все коллекции</span>
        </div>
      }>
        <div className="rounded-xl bg-white p-3 overflow-auto">
          <div className="min-w-[860px]">
            <PrintDoc {...reportArgs} />
          </div>
        </div>
      </Overlay>

      {printPortal}
    </div>
  );
}

/* ---------------- Акции ---------------- */

function PromoList({ active, other }: { active: AppData['promos']; other: AppData['promos'] }) {
  const [showOther, setShowOther] = useState(false);
  if (!active.length && !other.length) {
    return (
      <div className="card p-6 text-center space-y-2 max-w-lg mx-auto">
        <div className="ic w-14 h-14 mx-auto rounded-full bg-red/10 text-red2"><Sparkles size={26} /></div>
        <h3 className="text-lg font-extrabold">Акций пока нет</h3>
        <p className="text-sm text-ink2">Как только администратор добавит акцию — она появится здесь.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {active.map((p) => (
            <article key={p.id} className="card overflow-hidden animate-rise">
              <div className="bg-gradient-to-r from-red to-[#a11f24] text-white px-4 py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-white/70">Акция</div>
                  <div className="font-extrabold leading-snug line-clamp-2">{p.product || p.category || 'Акция'}</div>
                </div>
                <span className="pill bg-white/15 text-white border border-white/20 font-mono flex-none">{p.start} – {p.end}</span>
              </div>
              <div className="bg-card px-4 py-2 flex items-center gap-2 text-xs border-b border-line">
                <span className="uppercase tracking-wider text-ink3">Категория</span>
                <span className="font-semibold truncate">{p.category || '—'}</span>
                <span className="ml-auto pill pill-dark">{promoGrades(p).length} град.</span>
              </div>
              <ul className="bg-card">
                {promoGrades(p).map((r, i) => (
                  <li key={i} className="flex items-center gap-3 min-h-[42px] pl-4 pr-3 border-b border-line/60 last:border-0">
                    <span className={cn('w-1 h-6 rounded-full flex-none', i === 0 ? 'bg-red' : 'bg-red/40')} />
                    <span className="font-mono font-semibold truncate flex-1 text-ink">{prettyPrice(r.price) || '—'}</span>
                    <BonusChip bonus={r.bonus} />
                  </li>
                ))}
                {!promoGrades(p).length && <li className="px-4 py-2.5 text-sm text-ink3">Условия — в комментарии</li>}
              </ul>
              {p.comment && <div className="bg-gradient-to-r from-gold2 to-gold text-goldink text-sm font-semibold px-4 py-2.5">{p.comment}</div>}
            </article>
          ))}
        </div>
      )}
      {other.length > 0 && (
        <div>
          <button type="button" className="flex items-center gap-2 text-sm text-ink3 font-semibold py-2" onClick={() => setShowOther((v) => !v)}>
            <ChevronDown size={16} className={cn('transition-transform', !showOther && '-rotate-90')} />
            Завершённые и будущие ({other.length})
          </button>
          {showOther && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 opacity-60">
              {other.map((p) => (
                <article key={p.id} className="card p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('pill', promoStatus(p) === 'done' ? 'pill-dark' : 'pill-gold-line')}>{promoStatus(p) === 'done' ? 'завершена' : 'скоро'}</span>
                    <span className="font-mono text-xs text-ink3">{p.start} – {p.end}</span>
                  </div>
                  <div className="font-bold">{p.product || p.category}</div>
                  <div className="text-sm text-ink2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {promoGrades(p).map((r, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5"><span className="font-mono">{prettyPrice(r.price)}</span> <BonusChip bonus={r.bonus} size="sm" /></span>
                    ))}
                  </div>
                  {p.comment && <div className="text-xs text-ink3">{p.comment}</div>}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Отправка ---------------- */

function SendModal({ open, onClose, onPrint, args, defaultEmail }: { open: boolean; onClose: () => void; onPrint: () => void; args: ReportArgs; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; text: string }>({ kind: 'idle', text: '' });
  useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      setStatus({ kind: 'idle', text: '' });
    }
  }, [open, defaultEmail]);

  const subject = `Мотивация · ${args.shop} · ${args.price} · ${args.date}`;

  const doExcel = useCallback(() => {
    try {
      downloadExcel(args);
      setStatus({ kind: 'done', text: 'Файл Excel скачан в загрузки.' });
    } catch (e) {
      console.error(e);
      setStatus({ kind: 'error', text: 'Не удалось создать Excel. Попробуйте ещё раз.' });
    }
  }, [args]);

  const doSend = useCallback(async () => {
    if (!email.trim() || !/.+@.+\..+/.test(email)) {
      setStatus({ kind: 'error', text: 'Введите корректный email.' });
      return;
    }
    setStatus({ kind: 'busy', text: 'Готовим Excel и письмо…' });
    try {
      downloadExcel(args);
    } catch (e) {
      console.error(e);
    }
    const cfg = getConfig();
    if (hasGas(cfg)) {
      const r = await sendReportViaGas(cfg.gasUrl, email.trim(), subject, buildReportHtml(args));
      if (r.ok) {
        setStatus({ kind: 'done', text: `Письмо отправлено на ${email.trim()} через Google. Excel скачан — приложите его при необходимости.` });
        return;
      }
      setStatus({ kind: 'error', text: `${r.detail} Открываем почтовый клиент как запасной вариант.` });
    } else {
      setStatus({ kind: 'done', text: 'Excel скачан. Открыт почтовый клиент — приложите файл к письму.' });
    }
    window.location.href = buildMailto(email.trim(), subject, buildReportText(args));
  }, [email, args, subject]);

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title="Отчёт: Excel · письмо · печать"
      footer={
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-primary" onClick={doExcel} disabled={status.kind === 'busy'}>
              <Download size={18} /> Excel
            </button>
            <button type="button" className="btn-accent" onClick={doSend} disabled={status.kind === 'busy'}>
              <Mail size={18} /> Отправить
            </button>
          </div>
          <button type="button" className="btn-primary w-full" onClick={onPrint}>
            <Printer size={18} /> Печать / предпросмотр
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="lbl" htmlFor="rep-email">Email получателя</label>
          <div className="relative">
            <span className="ic absolute left-0 top-0 h-full w-[52px] text-ink3 pointer-events-none"><Mail size={20} /></span>
            <input id="rep-email" type="email" inputMode="email" autoComplete="email" className="field pl-[52px]" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['коллекций', args.blocks.length],
            ['градаций', args.blocks.reduce((s, b) => s + b.rows.length, 0)],
            ['акций', args.promos.length],
          ].map(([l, v]) => (
            <div key={String(l)} className="glass-card px-3 py-2">
              <div className="font-mono font-bold text-lg">{v}</div>
              <div className="text-[11px] uppercase tracking-wider text-ink3">{l}</div>
            </div>
          ))}
        </div>
        <p className="text-sm text-ink2">
          «Excel» — скачать файл. «Отправить» — скачать Excel и {hasGas(getConfig()) ? 'отправить письмо через Google Таблицу (плюс откроется почтовый клиент)' : 'открыть почтовый клиент с готовым текстом'}.
        </p>
        {status.kind !== 'idle' && (
          <div
            className={cn(
              'rounded-xl border px-3 py-2.5 text-sm',
              status.kind === 'busy' && 'border-gold/50 bg-gold/10 text-gold2',
              status.kind === 'done' && 'border-mint/40 bg-mint/10 text-mint',
              status.kind === 'error' && 'border-red/50 bg-red/10 text-red2',
            )}
          >
            {status.text}
          </div>
        )}
      </div>
    </Overlay>
  );
}
