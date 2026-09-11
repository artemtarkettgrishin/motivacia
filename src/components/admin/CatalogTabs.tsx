import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Crown, Layers, LayoutGrid, Pencil, Plus, Search, Sprout, Store, Trash2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppData, CatIcon, Category, PriceGroup, Product } from '@/lib/types';
import { PRICE_GROUPS, priceLabel } from '@/lib/appConfig';
import { CAT_ICON_LIST, CAT_ICONS, catIcon } from '@/lib/categories';
import { GROUPS, emptyGrades, formatPriceRange, isPercent, nextId, norm, parseGradations, parsePriceRange, prettyPrice, productForShop, productInGroup, serializeGradations } from '@/lib/pricing';
import { cn } from '@/utils/cn';
import { BonusChip, Overlay, Toggle } from '../ui';

interface Props {
  draft: AppData;
  update: (fn: (d: AppData) => AppData) => void;
}

const GROUP_ICON: Record<PriceGroup, LucideIcon> = { base: Sprout, standard: Layers, high: Crown };
type GroupSel = 'all' | PriceGroup;

/* ====================================================================== */
/*  ПРАЙС = ТОВАРЫ (категория + магазины + 3 колонки цен в одной форме)    */
/* ====================================================================== */

const emptyProduct = (category: string): Product => ({ id: 0, category, subcategory: '', name: '', shops: [], grades: emptyGrades(), isRed: false, active: true });

function shopsLabel(p: Product, total: number): string {
  if (!p.shops.length) return 'все магазины';
  if (p.shops.length <= 2) return p.shops.join(', ');
  return `${p.shops.length} из ${total}: ${p.shops.slice(0, 2).join(', ')}…`;
}

export function PriceTab({ draft, update }: Props) {
  const [sel, setSel] = useState<GroupSel>('all');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [edit, setEdit] = useState<Product | null>(null);

  const list = useMemo(() => {
    const qq = norm(q).replace(/,/g, '.');
    return draft.products.filter((p) => {
      if (cat !== 'all' && norm(p.category) !== norm(cat)) return false;
      if (!qq) return true;
      return [p.name, p.category, p.subcategory, p.shops.join(' '), p.grades.base, p.grades.standard, p.grades.high].join(' ').toLowerCase().replace(/,/g, '.').includes(qq);
    });
  }, [draft.products, q, cat]);

  const stats = useMemo(
    () =>
      GROUPS.map((g) => ({
        g,
        products: draft.products.filter((p) => p.active && productInGroup(p, g)).length,
        shops: draft.shops.filter((s) => s.group === g).length,
      })),
    [draft.products, draft.shops],
  );

  const save = (p: Product) => {
    update((d) => (p.id ? { ...d, products: d.products.map((x) => (x.id === p.id ? p : x)) } : { ...d, products: [...d.products, { ...p, id: nextId(d.products) }] }));
    setEdit(null);
  };
  const remove = (p: Product) => {
    if (!confirm(`Удалить товар «${p.name}» из всех прайсов?`)) return;
    update((d) => ({ ...d, products: d.products.filter((x) => x.id !== p.id) }));
  };
  const toggle = (p: Product, v: boolean) => update((d) => ({ ...d, products: d.products.map((x) => (x.id === p.id ? { ...x, active: v } : x)) }));

  return (
    <div className="space-y-4">
      {/* Плитки прайсов */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button type="button" onClick={() => setSel('all')} className={cn('card text-left p-3 flex items-center gap-3 transition-colors', sel === 'all' && 'border-gold shadow-lime')}>
          <span className={cn('ic w-10 h-10 rounded-xl', sel === 'all' ? 'bg-gradient-to-br from-gold2 to-gold text-goldink' : 'bg-card2 text-ink2 border border-line')}><LayoutGrid size={18} /></span>
          <span className="min-w-0">
            <span className="block font-extrabold truncate">Все прайсы</span>
            <span className="block text-xs text-ink3 font-mono">{draft.products.length} товаров</span>
          </span>
        </button>
        {stats.map(({ g, products, shops }) => {
          const Icon = GROUP_ICON[g];
          const on = sel === g;
          return (
            <button key={g} type="button" onClick={() => setSel(g)} className={cn('card text-left p-3 flex items-center gap-3 transition-colors', on && 'border-gold shadow-lime')}>
              <span className={cn('ic w-10 h-10 rounded-xl', on ? 'bg-gradient-to-br from-gold2 to-gold text-goldink' : 'bg-card2 text-ink2 border border-line')}><Icon size={18} /></span>
              <span className="min-w-0">
                <span className="block font-extrabold truncate">{priceLabel(g)}</span>
                <span className="block text-xs text-ink3 font-mono truncate">{products} тов. · {shops} маг.</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ink3">
        Магазин видит колонку своего прайса ({PRICE_GROUPS.map((g) => g.label).join(' / ')} — задаётся в карточке магазина). Товар без цен в колонке в этом прайсе не показывается.
      </p>

      {/* Поиск + добавить */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <span className="ic absolute left-1.5 top-1/2 -translate-y-1/2 w-10 h-10 text-ink3 pointer-events-none"><Search size={20} /></span>
          <input type="search" className="field pl-[52px] pr-[52px]" style={{ minHeight: 52 }} placeholder="Поиск: название, бренд, цена, магазин…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button type="button" className="ic absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 text-ink3" onClick={() => setQ('')} aria-label="Очистить"><X size={20} /></button>
          )}
        </div>
        <button type="button" className="btn-accent min-h-[52px] px-5" onClick={() => setEdit(emptyProduct(cat !== 'all' ? cat : draft.categories[0]?.name ?? ''))}>
          <Plus size={18} /> Добавить товар
        </button>
      </div>

      {/* Категории */}
      <div className="chip-scroll">
        <button type="button" className={cn('chip', cat === 'all' && 'on')} onClick={() => setCat('all')}>Все <span className="font-mono text-xs">{draft.products.length}</span></button>
        {draft.categories.map((c) => (
          <button key={c.id} type="button" className={cn('chip', cat === c.name && 'on')} onClick={() => setCat(c.name)}>
            {c.name} <span className="font-mono text-xs">{draft.products.filter((p) => norm(p.category) === norm(c.name)).length}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card p-6 text-center space-y-2">
          <div className="font-bold">{draft.products.length ? 'Ничего не найдено' : 'Товаров пока нет'}</div>
          <p className="text-sm text-ink2">Нажмите «Добавить товар»: категория, магазины и цены для трёх прайсов заполняются в одной форме.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((p) => {
            const inDir = draft.categories.some((c) => norm(c.name) === norm(p.category));
            return (
              <article key={p.id} className={cn('card p-4 space-y-3', !p.active && 'opacity-70')}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={cn('pill', p.active ? 'pill-mint' : 'pill-red')}>{p.active ? 'активен' : 'выключен'}</span>
                      {p.isRed && <span className="pill pill-red">красным</span>}
                      {!inDir && p.category && <span className="pill pill-gold-line">категория не в списке</span>}
                    </div>
                    <h4 className={cn('font-extrabold leading-snug', p.isRed && 'text-red2')}>{p.name}</h4>
                    <div className="text-xs text-ink3 truncate">{p.category || 'без категории'} · {p.subcategory || '—'}</div>
                    <div className="text-xs text-ink2 flex items-center gap-1 mt-0.5 truncate"><Store size={12} className="flex-none" /> <span className="truncate">{shopsLabel(p, draft.shops.length)}</span></div>
                  </div>
                  <Toggle on={p.active} onChange={(v) => toggle(p, v)} label="Активен" />
                </div>

                {sel === 'all' ? (
                  <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border border-line bg-line">
                    {GROUPS.map((g) => {
                      const rows = parseGradations(p.grades[g]);
                      return (
                        <div key={g} className="bg-card2 px-2 py-1.5 min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-ink3 truncate">{priceLabel(g)}</div>
                          {rows.length ? (
                            rows.map((r, i) => (
                              <div key={i} className="font-mono text-[11px] whitespace-nowrap overflow-hidden text-ellipsis">
                                <span className="text-ink">{prettyPrice(r.price)}</span> <span className="text-ink3">→</span>{' '}
                                <span className={p.isRed ? 'text-red2' : isPercent(r.bonus) ? 'text-gold2' : 'text-mint'}>{r.bonus}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-[11px] text-ink3">— нет</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <GroupRows p={p} g={sel} />
                )}

                <div className="flex gap-2">
                  <button type="button" className="btn-primary flex-1 min-h-11" onClick={() => setEdit(p)}><Pencil size={16} /> Изменить</button>
                  <button type="button" className="icon-btn icon-btn-sm text-red2" onClick={() => remove(p)} aria-label="Удалить"><Trash2 size={18} /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {edit && <ProductModal p={edit} draft={draft} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

function GroupRows({ p, g }: { p: Product; g: PriceGroup }) {
  const rows = parseGradations(p.grades[g]);
  if (!rows.length) {
    return <div className="rounded-xl border border-dashed border-red/40 bg-red/5 px-3 py-2 text-xs text-red2">Нет цен для прайса «{priceLabel(g)}» — товар в нём не показывается</div>;
  }
  return (
    <ul className="rounded-xl border border-line overflow-hidden">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center gap-3 min-h-[40px] px-3 border-b border-line/60 last:border-0 bg-card2">
          <span className={cn('w-1 h-5 rounded-full flex-none', p.isRed ? 'bg-red/70' : i === 0 ? 'bg-gold' : 'bg-gold/40')} />
          <span className="font-mono font-semibold truncate flex-1">{prettyPrice(r.price) || '—'}</span>
          <BonusChip bonus={r.bonus} red={p.isRed} size="sm" />
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Форма товара ---------------- */

const NEW_CAT = '__new__';

/** Строка градации в форме: «от», «до» (необязательно), бонус. */
interface FormRow {
  from: string;
  to: string;
  bonus: string;
}
const toFormRows = (grades: string): FormRow[] => parseGradations(grades).map((r) => ({ ...parsePriceRange(r.price), bonus: r.bonus }));
const fromFormRows = (rows: FormRow[]): string => serializeGradations(rows.map((r) => ({ price: formatPriceRange(r.from, r.to), bonus: r.bonus })));

function ProductModal({ p, draft, onClose, onSave }: { p: Product; draft: AppData; onClose: () => void; onSave: (p: Product) => void }) {
  const [f, setF] = useState<Product>(p);
  const [rows, setRows] = useState<Record<PriceGroup, FormRow[]>>(() => ({
    base: toFormRows(p.grades.base), standard: toFormRows(p.grades.standard), high: toFormRows(p.grades.high),
  }));
  const [allShops, setAllShops] = useState(p.shops.length === 0);
  const [newCat, setNewCat] = useState(false);
  const [err, setErr] = useState('');
  const categories = draft.categories;
  const inDir = categories.some((c) => norm(c.name) === norm(f.category));

  const setRow = (g: PriceGroup, i: number, patch: Partial<FormRow>) => setRows((r) => ({ ...r, [g]: r[g].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const addRow = (g: PriceGroup) => setRows((r) => ({ ...r, [g]: [...r[g], { from: '', to: '', bonus: '' }] }));
  const delRow = (g: PriceGroup, i: number) => setRows((r) => ({ ...r, [g]: r[g].filter((_, j) => j !== i) }));
  const copyStd = (g: PriceGroup) => setRows((r) => ({ ...r, [g]: r.standard.map((x) => ({ ...x })) }));
  const toggleShop = (name: string) =>
    setF((x) => ({ ...x, shops: x.shops.some((n) => norm(n) === norm(name)) ? x.shops.filter((n) => norm(n) !== norm(name)) : [...x.shops, name] }));

  const submit = () => {
    if (!f.name.trim()) return setErr('Введите название товара');
    if (!allShops && !f.shops.length) return setErr('Выберите хотя бы один магазин или включите «Все магазины»');
    const grades = { base: fromFormRows(rows.base), standard: fromFormRows(rows.standard), high: fromFormRows(rows.high) };
    if (!grades.base && !grades.standard && !grades.high) return setErr('Добавьте хотя бы одну строку «цена → бонус» в любом прайсе');
    onSave({ ...f, name: f.name.trim(), category: f.category.trim(), subcategory: f.subcategory.trim(), shops: allShops ? [] : f.shops, grades });
  };

  return (
    <Overlay
      open
      onClose={onClose}
      size="md"
      title={p.id ? 'Товар' : 'Новый товар'}
      footer={
        <div className="space-y-2">
          {err && <div className="text-sm font-semibold text-red2">{err}</div>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-primary" onClick={onClose}>Отмена</button>
            <button type="button" className="btn-accent" onClick={submit}>Сохранить</button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Категория + бренд + название */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="lbl">Категория</label>
            {newCat ? (
              <div className="flex gap-2">
                <input className="field flex-1" autoFocus placeholder="Новая категория" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
                <button type="button" className="icon-btn" style={{ height: 56 }} onClick={() => { setNewCat(false); setF({ ...f, category: categories[0]?.name ?? '' }); }} aria-label="К списку"><X size={18} /></button>
              </div>
            ) : (
              <select
                className="field appearance-none"
                value={f.category}
                onChange={(e) => {
                  if (e.target.value === NEW_CAT) {
                    setNewCat(true);
                    setF({ ...f, category: '' });
                  } else setF({ ...f, category: e.target.value });
                }}
              >
                {!f.category && <option value="">— выберите —</option>}
                {!inDir && f.category && <option value={f.category}>{f.category} (нет в списке)</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                <option value={NEW_CAT}>＋ Новая категория…</option>
              </select>
            )}
          </div>
          <div>
            <label className="lbl">Бренд / подкатегория</label>
            <input className="field" value={f.subcategory} onChange={(e) => setF({ ...f, subcategory: e.target.value })} placeholder="Kastamonu" />
          </div>
        </div>
        <div>
          <label className="lbl">Название</label>
          <input className="field" value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setErr(''); }} placeholder="Floorpan Red" />
        </div>

        {/* Магазины */}
        <div className="rounded-xl border border-line bg-card2 p-3 space-y-2">
          <div className="flex items-center gap-3">
            <span className="ic w-9 h-9 rounded-lg bg-gold/15 text-gold2"><Store size={18} /></span>
            <div className="min-w-0 flex-1">
              <div className="font-bold">Магазины</div>
              <div className="text-xs text-ink3">{allShops ? 'Товар видят все магазины (и новые тоже)' : `Выбрано: ${f.shops.length} из ${draft.shops.length}`}</div>
            </div>
            <span className="text-xs text-ink2">Все</span>
            <Toggle on={allShops} onChange={(v) => { setAllShops(v); setErr(''); }} label="Все магазины" />
          </div>
          {!allShops && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {draft.shops.map((s) => {
                const on = f.shops.some((n) => norm(n) === norm(s.name));
                return (
                  <button key={s.id} type="button" className={cn('chip', on && 'on')} onClick={() => { toggleShop(s.name); setErr(''); }}>
                    {s.name} <span className="text-[10px] opacity-70">{priceLabel(s.group).slice(0, 4)}</span>
                  </button>
                );
              })}
              {!draft.shops.length && <span className="text-sm text-ink3">Сначала добавьте магазины</span>}
            </div>
          )}
        </div>

        {/* Цены по прайсам */}
        <div className="space-y-2">
          <div className="lbl mb-0">Цены и бонусы по прайсам</div>
          {GROUPS.map((g) => {
            const Icon = GROUP_ICON[g];
            const list = rows[g];
            return (
              <div key={g} className="rounded-xl border border-line overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-card2">
                  <span className="ic w-8 h-8 rounded-lg bg-gold/15 text-gold2"><Icon size={15} /></span>
                  <span className="font-bold flex-1">{priceLabel(g)}</span>
                  <span className="text-xs text-ink3">{list.length ? `${list.length} стр.` : 'нет цен'}</span>
                  {g !== 'standard' && rows.standard.length > 0 && (
                    <button type="button" className="chip min-h-8 text-xs" onClick={() => copyStd(g)}><Copy size={12} /> как в Стандартном</button>
                  )}
                  <button type="button" className="chip on min-h-8 text-xs" onClick={() => addRow(g)}><Plus size={12} /> строка</button>
                </div>
                {list.length > 0 && (
                  <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-1.5 px-3 pt-2 text-[10px] uppercase tracking-wider text-ink3">
                    <span>Цена от</span><span>до <span className="normal-case">(необяз.)</span></span><span>Бонус</span><span />
                  </div>
                )}
                {list.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_40px] gap-1.5 px-3 py-1.5 items-center">
                    <input className="field field-sm font-mono px-2" inputMode="decimal" placeholder="782" value={r.from} onChange={(e) => { setRow(g, i, { from: e.target.value }); setErr(''); }} />
                    <input className="field field-sm font-mono px-2" inputMode="decimal" placeholder="868" value={r.to} onChange={(e) => { setRow(g, i, { to: e.target.value }); setErr(''); }} />
                    <input className="field field-sm font-mono px-2" inputMode="decimal" placeholder="27,5" value={r.bonus} onChange={(e) => { setRow(g, i, { bonus: e.target.value }); setErr(''); }} />
                    <button type="button" className="icon-btn icon-btn-sm text-red2" style={{ width: 40, height: 42 }} onClick={() => delRow(g, i)} aria-label="Удалить строку"><Trash2 size={16} /></button>
                  </div>
                ))}
                {list.length > 0 && (
                  <div className="px-3 pb-1 text-[11px] text-ink3">
                    Продавец увидит: {list.map((r) => `${prettyPrice(formatPriceRange(r.from, r.to)) || '—'} → ${r.bonus || '—'}`).join(' · ')}
                  </div>
                )}
                {!list.length && <div className="px-3 py-2 text-xs text-ink3 border-t border-line">Нет строк — товар не попадёт в прайс «{priceLabel(g)}».</div>}
                {list.length > 0 && <div className="h-1.5" />}
              </div>
            );
          })}
        </div>

        {/* Флаги */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center justify-between rounded-xl border border-line bg-card2 px-4 min-h-14">
            <div>
              <div className="font-bold">{f.active ? 'Активен' : 'Выключен'}</div>
              <div className="text-xs text-ink3">Выключенный не виден продавцам</div>
            </div>
            <Toggle on={f.active} onChange={(v) => setF({ ...f, active: v })} label="Статус" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line bg-card2 px-4 min-h-14">
            <div>
              <div className={cn('font-bold', f.isRed && 'text-red2')}>Красным в прайсе</div>
              <div className="text-xs text-ink3">Выделить строку (и в печати)</div>
            </div>
            <Toggle on={f.isRed} onChange={(v) => setF({ ...f, isRed: v })} label="Красным" />
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/* ====================================================================== */
/*  КАТЕГОРИИ                                                             */
/* ====================================================================== */

function IconPicker({ value, onChange }: { value: CatIcon; onChange: (v: CatIcon) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {CAT_ICON_LIST.map((it) => {
        const Icon = CAT_ICONS[it.id];
        const on = value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            title={it.label}
            onClick={() => onChange(it.id)}
            className={cn('ic h-12 rounded-xl border transition-colors', on ? 'bg-gradient-to-br from-gold2 to-gold text-goldink border-gold' : 'bg-card2 text-ink2 border-line')}
          >
            <Icon size={20} />
          </button>
        );
      })}
    </div>
  );
}

export function CategoriesTab({ draft, update }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<CatIcon>('box');
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState<Category | null>(null);
  const cats = draft.categories;
  const countOf = (c: string) => draft.products.filter((p) => norm(p.category) === norm(c)).length;

  const renumber = (list: Category[]) => list.map((c, i) => ({ ...c, sortOrder: i + 1 }));

  const add = () => {
    const n = name.trim();
    if (!n) return setErr('Введите название');
    if (cats.some((c) => norm(c.name) === norm(n))) return setErr('Такая категория уже есть');
    update((d) => ({ ...d, categories: renumber([...d.categories, { id: nextId(d.categories), name: n, icon, sortOrder: d.categories.length + 1 }]) }));
    setName('');
    setIcon('box');
    setErr('');
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cats.length) return;
    const next = cats.slice();
    [next[i], next[j]] = [next[j], next[i]];
    update((d) => ({ ...d, categories: renumber(next) }));
  };
  const remove = (c: Category) => {
    const n = countOf(c.name);
    const msg = n
      ? `Удалить категорию «${c.name}»? Товаров в ней: ${n}. Они останутся, но без категории (попадут в «Прочее»).`
      : `Удалить категорию «${c.name}»? Товаров в ней нет.`;
    if (!confirm(msg)) return;
    update((d) => ({
      ...d,
      categories: renumber(d.categories.filter((x) => x.id !== c.id)),
      products: d.products.map((p) => (norm(p.category) === norm(c.name) ? { ...p, category: '' } : p)),
    }));
  };
  const saveEdit = (c: Category) => {
    const n = c.name.trim();
    if (!n) return;
    if (cats.some((x) => x.id !== c.id && norm(x.name) === norm(n))) {
      alert('Категория с таким названием уже есть');
      return;
    }
    const old = cats.find((x) => x.id === c.id);
    update((d) => ({
      ...d,
      categories: d.categories.map((x) => (x.id === c.id ? { ...c, name: n } : x)),
      products: old && norm(old.name) !== norm(n) ? d.products.map((p) => (norm(p.category) === norm(old.name) ? { ...p, category: n } : p)) : d.products,
      promos: old && norm(old.name) !== norm(n) ? d.promos.map((p) => (norm(p.category) === norm(old.name) ? { ...p, category: n } : p)) : d.promos,
    }));
    setEdit(null);
  };

  return (
    <div className="space-y-4">
      <section className="card p-4 space-y-3">
        <h3 className="font-extrabold">Новая категория</h3>
        <div className="flex flex-col md:flex-row gap-2">
          <input className="field flex-1" placeholder="Название (напр. Керамогранит)" value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button type="button" className="btn-accent min-h-14 px-5" onClick={add}><Plus size={18} /> Добавить</button>
        </div>
        <div>
          <div className="lbl">Иконка</div>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        {err && <div className="text-sm font-semibold text-red2">{err}</div>}
        <p className="text-xs text-ink3">Категорию также можно создать прямо в форме товара («＋ Новая категория…»).</p>
      </section>

      <section className="card divide-y divide-line">
        {cats.map((c, i) => {
          const Icon = catIcon(c.icon);
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="ic w-11 h-11 rounded-xl bg-gradient-to-br from-gold2 to-gold text-goldink"><Icon size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold truncate">{c.name}</div>
                <div className="text-xs text-ink3 font-mono">{c.icon} · товаров: {countOf(c.name)} · порядок {c.sortOrder}</div>
              </div>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Выше"><ArrowUp size={18} /></button>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => move(i, 1)} disabled={i === cats.length - 1} aria-label="Ниже"><ArrowDown size={18} /></button>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEdit(c)} aria-label="Переименовать"><Pencil size={18} /></button>
              <button type="button" className="icon-btn icon-btn-sm text-red2" onClick={() => remove(c)} aria-label="Удалить"><Trash2 size={18} /></button>
            </div>
          );
        })}
        {!cats.length && <div className="p-6 text-center text-ink2">Справочник пуст</div>}
      </section>

      {edit && (
        <Overlay
          open
          onClose={() => setEdit(null)}
          title="Категория"
          footer={
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-primary" onClick={() => setEdit(null)}>Отмена</button>
              <button type="button" className="btn-accent" onClick={() => saveEdit(edit)}>Сохранить</button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="lbl">Название</label>
              <input className="field" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <p className="text-xs text-ink3 mt-1">При переименовании товары и акции этой категории обновятся автоматически.</p>
            </div>
            <div>
              <div className="lbl">Иконка</div>
              <IconPicker value={edit.icon} onChange={(v) => setEdit({ ...edit, icon: v })} />
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

// productForShop используется в подсчётах магазинов (см. ShopsTab), реэкспорт для удобства
export { productForShop };
