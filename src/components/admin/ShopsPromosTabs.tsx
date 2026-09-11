import { useState } from 'react';
import { Eye, KeyRound, Pencil, Plus, Trash2, Calendar, ArrowUp, ArrowDown, ChevronDown, Check, Sparkles } from 'lucide-react';
import type { AppData, Promo, Shop, ShopExtra } from '@/lib/types';
import { PRICE_GROUPS, priceLabel } from '@/lib/appConfig';
import { formatPriceRange, nextId, norm, parsePriceRange, parseRuDate, prettyPrice, productsForShop, promoGrades, promoStatus, withPromoGrades } from '@/lib/pricing';
import { EXTRA_COLORS, EXTRA_ICONS, EXTRA_PRESETS, MAX_EXTRAS, extraPlateStyle, normalizeExtra, resolveExtra } from '@/lib/extras';
import { cn } from '@/utils/cn';
import { BonusChip, Overlay } from '../ui';

interface Props {
  draft: AppData;
  update: (fn: (d: AppData) => AppData) => void;
}

/* ====================================================================== */
/*  МАГАЗИНЫ                                                              */
/* ====================================================================== */

const emptyShop = (): Shop => ({ id: 0, name: '', password: '', group: 'standard', extras: [] });

export function ShopsTab({ draft, update, onPreview }: Props & { onPreview: (name: string) => void }) {
  const [edit, setEdit] = useState<Shop | null>(null);

  const save = (s: Shop) => {
    if (!s.name.trim()) return;
    const clean: Shop = { ...s, name: s.name.trim(), extras: s.extras.map(normalizeExtra).filter((e) => e.label || e.value).slice(0, MAX_EXTRAS) };
    update((d) => {
      const old = d.shops.find((x) => x.id === clean.id);
      // переименование → обновить списки магазинов у товаров
      const products = old && norm(old.name) !== norm(clean.name)
        ? d.products.map((p) => ({ ...p, shops: p.shops.map((n) => (norm(n) === norm(old.name) ? clean.name : n)) }))
        : d.products;
      return clean.id
        ? { ...d, products, shops: d.shops.map((x) => (x.id === clean.id ? clean : x)) }
        : { ...d, shops: [...d.shops, { ...clean, id: nextId(d.shops) }] };
    });
    setEdit(null);
  };
  const remove = (s: Shop) => {
    const only = draft.products.filter((p) => p.shops.length && p.shops.every((n) => norm(n) === norm(s.name))).length;
    const msg = `Удалить магазин «${s.name}»? Он исчезнет из таблицы.` + (only ? ` Товары, назначенные только ему (${only}), будут выключены.` : '');
    if (!confirm(msg)) return;
    update((d) => ({
      ...d,
      shops: d.shops.filter((x) => x.id !== s.id),
      products: d.products.map((p) => {
        if (!p.shops.some((n) => norm(n) === norm(s.name))) return p;
        const rest = p.shops.filter((n) => norm(n) !== norm(s.name));
        return rest.length ? { ...p, shops: rest } : { ...p, shops: [], active: false };
      }),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold">Магазины <span className="font-mono text-ink3">{draft.shops.length}</span></h3>
          <p className="text-xs text-ink3">Пароль вводит продавец при входе. Прайс-группа = какую колонку цен видит магазин.</p>
        </div>
        <button type="button" className="btn-accent min-h-12 px-5" onClick={() => setEdit(emptyShop())}><Plus size={18} /> Магазин</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {draft.shops.map((s) => {
          const count = productsForShop(draft, s).length;
          return (
            <article key={s.id} className="card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-lg leading-tight truncate">{s.name}</h4>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="pill pill-dark font-mono"><KeyRound size={12} /> {s.password || '—'}</span>
                    <span className={cn('pill', s.group === 'high' ? 'pill-gold' : s.group === 'base' ? 'pill-dark' : 'pill-gold-line')}>{priceLabel(s.group)}</span>
                    <span className={cn('pill', count ? 'pill-mint' : 'pill-red')}>{count ? `товаров: ${count}` : 'нет товаров'}</span>
                  </div>
                </div>
              </div>
              {s.extras.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {s.extras.map((e, i) => {
                    const st = resolveExtra(e);
                    const css = extraPlateStyle(st.hex);
                    return (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-full border pl-1 pr-2.5 min-h-8 text-xs max-w-full" style={css.plate}>
                        <span className="ic w-6 h-6 rounded-full" style={css.icon}><st.Icon size={12} strokeWidth={2.5} /></span>
                        <span className="text-ink2 truncate">{e.label}:</span> <span className="font-mono font-bold truncate" style={css.text}>{e.value}</span>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" className="btn-primary flex-1 min-h-11" onClick={() => onPreview(s.name)}><Eye size={16} /> Предпросмотр</button>
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEdit(s)} aria-label="Изменить"><Pencil size={18} /></button>
                <button type="button" className="icon-btn icon-btn-sm text-red2" onClick={() => remove(s)} aria-label="Удалить"><Trash2 size={18} /></button>
              </div>
            </article>
          );
        })}
        {!draft.shops.length && <div className="card p-6 text-center text-ink2 md:col-span-3">Магазинов пока нет</div>}
      </div>

      {edit && <ShopModal s={edit} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

function ShopModal({ s, onClose, onSave }: { s: Shop; onClose: () => void; onSave: (s: Shop) => void }) {
  const [f, setF] = useState<Shop>({ ...s, extras: s.extras.map((e) => ({ ...e })) });
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const setExtras = (list: ShopExtra[]) => setF((x) => ({ ...x, extras: list }));
  const patch = (i: number, p: Partial<ShopExtra>) => setExtras(f.extras.map((e, j) => (j === i ? { ...e, ...p } : e)));
  const add = () => {
    if (f.extras.length >= MAX_EXTRAS) return;
    setExtras([...f.extras, { label: '', value: '', icon: '', color: '' }]);
    setOpenIdx(f.extras.length);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= f.extras.length) return;
    const next = f.extras.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setExtras(next);
    setOpenIdx(j);
  };
  const remove = (i: number) => {
    setExtras(f.extras.filter((_, j) => j !== i));
    setOpenIdx(null);
  };

  return (
    <Overlay
      open
      onClose={onClose}
      size="md"
      title={s.id ? 'Магазин' : 'Новый магазин'}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-primary" onClick={onClose}>Отмена</button>
          <button type="button" className="btn-accent" onClick={() => onSave(f)} disabled={!f.name.trim()}>Сохранить</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="lbl">Название</label>
            <input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Центральный" />
          </div>
          <div>
            <label className="lbl">Пароль</label>
            <input className="field font-mono" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="1234" />
          </div>
        </div>
        <div>
          <div className="lbl">Прайс-группа</div>
          <div className="grid grid-cols-3 gap-2">
            {PRICE_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setF({ ...f, group: g.id })}
                className={cn('rounded-xl border font-bold transition-colors', f.group === g.id ? 'bg-gradient-to-br from-gold2 to-gold text-goldink border-gold' : 'bg-card2 text-ink2 border-line')}
                style={{ minHeight: 54 }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="sec-head mb-2">
            <div>
              <div className="lbl mb-0">Плашки магазина</div>
              <div className="text-xs text-ink3">{f.extras.length} из {MAX_EXTRAS} · продавец видит их под поиском</div>
            </div>
            <button type="button" className="btn-accent min-h-10 px-3" onClick={add} disabled={f.extras.length >= MAX_EXTRAS}>
              <Plus size={16} /> Плашка
            </button>
          </div>
          {f.extras.length === 0 && (
            <div className="rounded-xl border border-dashed border-line2 p-4 text-center text-sm text-ink2">
              Плашек нет. Например: «План месяца — Цель 1 200 000 ₽», «Бонус за план — +5%», «Штраф — −1 000 ₽».
            </div>
          )}
          <div className="space-y-2">
            {f.extras.map((e, i) => (
              <ExtraEditor
                key={i}
                e={e}
                index={i}
                total={f.extras.length}
                open={openIdx === i}
                onToggle={() => setOpenIdx(openIdx === i ? null : i)}
                onPatch={(p) => patch(i, p)}
                onMove={(d) => move(i, d)}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function ExtraEditor({
  e, index, total, open, onToggle, onPatch, onMove, onRemove,
}: {
  e: ShopExtra; index: number; total: number; open: boolean;
  onToggle: () => void; onPatch: (p: Partial<ShopExtra>) => void; onMove: (d: -1 | 1) => void; onRemove: () => void;
}) {
  const st = resolveExtra(e);
  const css = extraPlateStyle(st.hex);
  const isAuto = !e.icon && !e.color;
  return (
    <div className={cn('rounded-2xl border bg-card2 overflow-hidden', open ? 'border-gold/60' : 'border-line')}>
      {/* превью-строка */}
      <div className="flex items-center gap-2 p-2">
        <button type="button" className="relative flex-1 min-w-0 flex items-center gap-3 rounded-xl border pl-3 pr-3 py-2 text-left overflow-hidden" style={css.plate} onClick={onToggle}>
          <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: st.hex }} />
          <span className="ic w-9 h-9 rounded-lg border flex-none" style={css.icon}><st.Icon size={17} strokeWidth={2.4} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] uppercase tracking-wider text-ink2 truncate">{e.label || `Плашка ${index + 1}`}</span>
            <span className="block font-mono font-bold truncate" style={css.text}>{e.value || 'значение…'}</span>
          </span>
          <ChevronDown size={18} className={cn('flex-none text-ink3 transition-transform', open && 'rotate-180')} />
        </button>
        <div className="flex flex-col gap-1">
          <button type="button" className="icon-btn" style={{ width: 36, height: 26 }} onClick={() => onMove(-1)} disabled={index === 0} aria-label="Выше"><ArrowUp size={14} /></button>
          <button type="button" className="icon-btn" style={{ width: 36, height: 26 }} onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Ниже"><ArrowDown size={14} /></button>
        </div>
        <button type="button" className="icon-btn text-red2" style={{ width: 40, height: 56 }} onClick={onRemove} aria-label="Удалить плашку"><Trash2 size={17} /></button>
      </div>

      {open && (
        <div className="border-t border-line p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input className="field" style={{ minHeight: 48 }} placeholder="Название (План месяца)" value={e.label} onChange={(ev) => onPatch({ label: ev.target.value })} />
            <input className="field font-mono" style={{ minHeight: 48 }} placeholder="Значение (+5% / −3% / Цель 1 000 000 ₽)" value={e.value} onChange={(ev) => onPatch({ value: ev.target.value })} />
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink3 font-bold mb-1.5">Тон (иконка + цвет одним нажатием)</div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={cn('chip min-h-9', isAuto && 'on')} onClick={() => onPatch({ icon: '', color: '' })}>Авто</button>
              {EXTRA_PRESETS.map((p) => {
                const on = e.icon === p.icon && e.color === p.color;
                const hex = EXTRA_COLORS.find((c) => c.id === p.color)!.hex;
                const PIcon = EXTRA_ICONS.find((i) => i.id === p.icon)!.Icon;
                return (
                  <button key={p.id} type="button" className={cn('chip min-h-9', on && 'on')} style={on ? {} : { borderColor: `${hex}66` }} onClick={() => onPatch({ icon: p.icon, color: p.color })}>
                    <span className="ic w-5 h-5 rounded-full" style={{ background: `${hex}33`, color: hex }}><PIcon size={12} strokeWidth={2.6} /></span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink3 font-bold mb-1.5">Цвет плашки</div>
            <div className="flex flex-wrap gap-2">
              {EXTRA_COLORS.map((c) => {
                const on = st.color === c.id && !!e.color;
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    onClick={() => onPatch({ color: c.id })}
                    className={cn('ic rounded-full transition-transform', on ? 'scale-110' : 'hh:hover:scale-105')}
                    style={{ width: 34, height: 34, background: c.hex, boxShadow: on ? `0 0 0 2px #101614, 0 0 0 4px ${c.hex}` : '0 0 0 1px rgba(0,0,0,0.5)', color: c.id === 'white' || c.id === 'gold' || c.id === 'mint' || c.id === 'cyan' ? '#231a05' : '#fff' }}
                  >
                    {on && <Check size={16} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink3 font-bold mb-1.5">Иконка</div>
            <div className="grid grid-cols-8 sm:grid-cols-11 gap-1.5">
              {EXTRA_ICONS.map((ic) => {
                const on = st.icon === ic.id && !!e.icon;
                return (
                  <button
                    key={ic.id}
                    type="button"
                    title={ic.label}
                    aria-label={ic.label}
                    onClick={() => onPatch({ icon: ic.id })}
                    className={cn('ic h-10 rounded-lg border transition-colors', on ? 'border-transparent' : 'bg-card border-line text-ink2')}
                    style={on ? { background: `${st.hex}33`, color: st.hex, boxShadow: `inset 0 0 0 1.5px ${st.hex}` } : undefined}
                  >
                    <ic.Icon size={18} strokeWidth={2.3} />
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-ink3">«Авто»: значение с «−» — красная, с «+» — мятная, остальное — золотая цель.</p>
        </div>
      )}
    </div>
  );
}

/* ====================================================================== */
/*  АКЦИИ                                                                 */
/* ====================================================================== */

const emptyPromo = (): Promo => ({ id: 0, start: '', end: '', category: '', product: '', price: '', bonus: '', grades: '', comment: '' });

export function PromosTab({ draft, update }: Props) {
  const [edit, setEdit] = useState<Promo | null>(null);
  const save = (p: Promo) => {
    update((d) => (p.id ? { ...d, promos: d.promos.map((x) => (x.id === p.id ? p : x)) } : { ...d, promos: [...d.promos, { ...p, id: nextId(d.promos) }] }));
    setEdit(null);
  };
  const remove = (p: Promo) => {
    if (!confirm(`Удалить акцию «${p.product || p.category}»?`)) return;
    update((d) => ({ ...d, promos: d.promos.filter((x) => x.id !== p.id) }));
  };
  const sorted = draft.promos.slice().sort((a, b) => {
    const o = { active: 0, future: 1, done: 2 };
    return o[promoStatus(a)] - o[promoStatus(b)] || (parseRuDate(b.start)?.getTime() ?? 0) - (parseRuDate(a.start)?.getTime() ?? 0);
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold">Акции <span className="font-mono text-ink3">{draft.promos.length}</span></h3>
          <p className="text-xs text-ink3">Даты в формате ДД.ММ.ГГГГ, статус считается по дням</p>
        </div>
        <button type="button" className="btn-accent min-h-12 px-5" onClick={() => setEdit(emptyPromo())}><Plus size={18} /> Акция</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {sorted.map((p) => {
          const st = promoStatus(p);
          return (
            <article key={p.id} className={cn('card p-4 space-y-2', st === 'done' && 'opacity-70')}>
              <div className="flex items-center gap-2">
                <span className={cn('pill', st === 'active' ? 'pill-red' : st === 'future' ? 'pill-gold-line' : 'pill-dark')}>{st === 'active' ? 'активна' : st === 'future' ? 'скоро' : 'завершена'}</span>
                <span className="font-mono text-xs text-ink3 flex items-center gap-1"><Calendar size={12} /> {p.start || '…'} – {p.end || '…'}</span>
              </div>
              <h4 className="font-extrabold leading-snug">{p.product || '—'}</h4>
              <div className="text-xs text-ink3">{p.category || 'без категории'}</div>
              <ul className="rounded-xl border border-line overflow-hidden">
                {promoGrades(p).map((r, i) => (
                  <li key={i} className="flex items-center gap-3 min-h-[38px] px-3 border-b border-line/60 last:border-0 bg-card2">
                    <span className={cn('w-1 h-5 rounded-full flex-none', i === 0 ? 'bg-red' : 'bg-red/40')} />
                    <span className="font-mono font-semibold truncate flex-1">{prettyPrice(r.price) || '—'}</span>
                    <BonusChip bonus={r.bonus} size="sm" />
                  </li>
                ))}
                {!promoGrades(p).length && <li className="px-3 py-2 text-xs text-ink3">Без цены и бонуса</li>}
              </ul>
              {p.comment && <div className="text-sm text-ink2">{p.comment}</div>}
              <div className="flex gap-2 pt-1">
                <button type="button" className="btn-primary flex-1 min-h-11" onClick={() => setEdit(p)}><Pencil size={16} /> Изменить</button>
                <button type="button" className="icon-btn icon-btn-sm text-red2" onClick={() => remove(p)} aria-label="Удалить"><Trash2 size={18} /></button>
              </div>
            </article>
          );
        })}
        {!draft.promos.length && <div className="card p-6 text-center text-ink2 md:col-span-3">Акций пока нет</div>}
      </div>

      {edit && <PromoModal p={edit} draft={draft} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

interface PromoRow {
  from: string;
  to: string;
  bonus: string;
}

function PromoModal({ p, draft, onClose, onSave }: { p: Promo; draft: AppData; onClose: () => void; onSave: (p: Promo) => void }) {
  const [f, setF] = useState<Promo>(p);
  const [rows, setRows] = useState<PromoRow[]>(() => {
    const list = promoGrades(p).map((r) => ({ ...parsePriceRange(r.price), bonus: r.bonus }));
    return list.length ? list : [{ from: '', to: '', bonus: '' }];
  });
  const set = (k: keyof Promo, v: string) => setF((x) => ({ ...x, [k]: v }));
  const setRow = (i: number, patch: Partial<PromoRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const dateOk = (s: string) => !s || !!parseRuDate(s);
  const valid = dateOk(f.start) && dateOk(f.end) && (f.product.trim() || f.category.trim());
  const inDir = draft.categories.some((c) => c.name.trim().toLowerCase() === f.category.trim().toLowerCase());
  const gradRows = rows.map((r) => ({ price: formatPriceRange(r.from, r.to), bonus: r.bonus.trim() })).filter((r) => r.price || r.bonus);

  const submit = () => onSave(withPromoGrades({ ...f, product: f.product.trim(), category: f.category.trim(), comment: f.comment.trim() }, gradRows));

  return (
    <Overlay
      open
      onClose={onClose}
      size="md"
      title={p.id ? 'Акция' : 'Новая акция'}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-primary" onClick={onClose}>Отмена</button>
          <button type="button" className="btn-accent" onClick={submit} disabled={!valid}>Сохранить</button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="lbl">Начало</label>
            <input className={cn('field font-mono', !dateOk(f.start) && 'border-red')} inputMode="numeric" placeholder="01.09.2026" value={f.start} onChange={(e) => set('start', e.target.value)} />
          </div>
          <div>
            <label className="lbl">Конец</label>
            <input className={cn('field font-mono', !dateOk(f.end) && 'border-red')} inputMode="numeric" placeholder="31.10.2026" value={f.end} onChange={(e) => set('end', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="lbl">Категория</label>
            <select className="field appearance-none" value={f.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">— без категории —</option>
              {!inDir && f.category && <option value={f.category}>{f.category} (нет в списке)</option>}
              {draft.categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Товар</label>
            <input className="field" list="mv-products" value={f.product} onChange={(e) => set('product', e.target.value)} placeholder="Floorpan Red" />
            <datalist id="mv-products">
              {draft.products.map((x) => (
                <option key={x.id} value={x.name} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Градации акции — как у товаров */}
        <div className="rounded-xl border border-line overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-card2">
            <span className="ic w-8 h-8 rounded-lg bg-red/15 text-red2"><Sparkles size={15} /></span>
            <span className="font-bold flex-1">Градации акции</span>
            <span className="text-xs text-ink3">{gradRows.length ? `${gradRows.length} стр.` : 'нет цен'}</span>
            <button type="button" className="chip on min-h-8 text-xs" onClick={() => setRows((r) => [...r, { from: '', to: '', bonus: '' }])}><Plus size={12} /> строка</button>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-1.5 px-3 pt-2 text-[10px] uppercase tracking-wider text-ink3">
            <span>Цена от</span><span>до <span className="normal-case">(необяз.)</span></span><span>Бонус</span><span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_40px] gap-1.5 px-3 py-1.5 items-center">
              <input className="field field-sm font-mono px-2" inputMode="decimal" placeholder="799" value={r.from} onChange={(e) => setRow(i, { from: e.target.value })} />
              <input className="field field-sm font-mono px-2" inputMode="decimal" placeholder="850" value={r.to} onChange={(e) => setRow(i, { to: e.target.value })} />
              <input className="field field-sm font-mono px-2" inputMode="decimal" placeholder="40" value={r.bonus} onChange={(e) => setRow(i, { bonus: e.target.value })} />
              <button type="button" className="icon-btn icon-btn-sm text-red2" style={{ width: 40, height: 42 }} onClick={() => setRows((rr) => (rr.length > 1 ? rr.filter((_, j) => j !== i) : [{ from: '', to: '', bonus: '' }]))} aria-label="Удалить строку"><Trash2 size={16} /></button>
            </div>
          ))}
          <div className="px-3 pb-2 text-[11px] text-ink3">
            {gradRows.length
              ? `Продавец увидит: ${gradRows.map((r) => `${prettyPrice(r.price) || '—'} → ${r.bonus || '—'}`).join(' · ')}`
              : 'Можно оставить пустым — тогда акция только с комментарием.'}
          </div>
        </div>

        <div>
          <label className="lbl">Комментарий</label>
          <textarea className="field py-3 min-h-24" value={f.comment} onChange={(e) => set('comment', e.target.value)} placeholder="Условия акции" />
        </div>
      </div>
    </Overlay>
  );
}
