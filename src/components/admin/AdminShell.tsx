import { useState } from 'react';
import { CloudUpload, FileSpreadsheet, Layers, LogOut, RefreshCw, Settings, Sparkles, Store, AlertTriangle, Send, Check, Loader2, LayoutGrid, ChevronRight, Smartphone, Clock } from 'lucide-react';
import type { AppData } from '@/lib/types';
import { getConfig, hasGas } from '@/lib/appConfig';
import { cn } from '@/utils/cn';
import { fmtTime, Overlay } from '../ui';
import Dock, { type DockItem } from '../Dock';
import { InstallModal } from '../InstallHelp';
import { PriceTab, CategoriesTab } from './CatalogTabs';
import { ShopsTab, PromosTab } from './ShopsPromosTabs';
import { SyncTab, SettingsTab } from './SyncSettingsTabs';

export type SyncPhase = 'idle' | 'saving' | 'pushing' | 'done' | 'fail' | 'retry';
export interface SyncState {
  phase: SyncPhase;
  text: string;
}

export interface AdminProps {
  data: AppData;
  commit: (next: AppData) => void;
  syncState: SyncState;
  pendingAt: string | null;
  flushing: boolean;
  onFlush: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  onLogout: () => void;
  onPreview: (shopName: string) => void;
  onResetSeed: () => void;
  onImport: (d: AppData) => void;
  logTick: number;
}

export type TabId = 'prices' | 'categories' | 'shops' | 'promos' | 'sync' | 'settings';

const TABS: { id: TabId; label: string; Icon: typeof Store }[] = [
  { id: 'prices', label: 'Прайс', Icon: FileSpreadsheet },
  { id: 'categories', label: 'Категории', Icon: Layers },
  { id: 'shops', label: 'Магазины', Icon: Store },
  { id: 'promos', label: 'Акции', Icon: Sparkles },
  { id: 'sync', label: 'Синхронизация', Icon: CloudUpload },
  { id: 'settings', label: 'Настройки', Icon: Settings },
];

function SyncLine({ s }: { s: SyncState }) {
  const map: Record<SyncPhase, { cls: string; text: string; Icon: typeof Check | null; spin?: boolean }> = {
    idle: { cls: 'text-ink3', text: 'автосохранение', Icon: null },
    saving: { cls: 'text-ink2', text: 'Сохранение…', Icon: Loader2, spin: true },
    pushing: { cls: 'text-gold2', text: 'Записываем в таблицу…', Icon: Loader2, spin: true },
    done: { cls: 'text-mint', text: s.text || 'Сохранено', Icon: Check },
    fail: { cls: 'text-red2', text: s.text || 'Ошибка', Icon: AlertTriangle },
    retry: { cls: 'text-gold2', text: s.text || 'Повторим автоматически', Icon: Clock },
  };
  const m = map[s.phase];
  return (
    <div className={cn('flex items-center gap-1.5 text-xs min-w-0', m.cls)} title={s.text}>
      {m.Icon && <m.Icon size={14} className={cn('flex-none', m.spin && 'animate-spin')} />}
      <span className="truncate">{m.text}</span>
    </div>
  );
}

export default function AdminShell(p: AdminProps) {
  const [tab, setTab] = useState<TabId>('prices');
  const [more, setMore] = useState(false);
  const [install, setInstall] = useState(false);
  const cfg = getConfig();
  const gas = hasGas(cfg);
  const update = (fn: (d: AppData) => AppData) => p.commit(fn(p.data));

  // Телефон: 3 прямых раздела внизу + «Ещё» (остальные разделы и «Обновить») + «Выйти». Сверху кнопок нет.
  const mobileTabs: TabId[] = ['prices', 'shops', 'promos'];
  const moreTabs: TabId[] = ['categories', 'sync', 'settings'];
  const current = TABS.find((t) => t.id === tab)!;
  const goTab = (id: TabId) => {
    setTab(id);
    setMore(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-app pb-[calc(112px+var(--sab))] md:pb-10">
      <div className="sticky top-0 z-40">
        <header className="glass safe-top border-b border-gold/25 bg-gradient-to-r from-[#1a1508] via-[#0f1411] to-[#0c110e]">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <div className="ic w-11 h-11 rounded-2xl bg-gradient-to-br from-gold2 to-gold text-goldink shadow-lime font-extrabold text-lg">М</div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base md:text-lg font-extrabold truncate">
                <span className="md:hidden">{current.label}</span>
                <span className="hidden md:inline">Панель · {cfg.companyName}</span>
              </h1>
              <SyncLine s={p.syncState} />
            </div>
            {p.refreshing && <RefreshCw size={18} className="md:hidden text-gold2 animate-spin flex-none" />}
            {/* Действия — только на ПК; на телефоне они внизу */}
            <button type="button" className="icon-btn hidden md:inline-flex" onClick={p.onRefresh} aria-label="Обновить" title="Обновить из таблицы">
              <RefreshCw size={20} className={cn(p.refreshing && 'animate-spin')} />
            </button>
            <button type="button" className="icon-btn hidden md:inline-flex" onClick={p.onLogout} aria-label="Выйти" title="Выйти">
              <LogOut size={20} />
            </button>
          </div>
          <div className="hidden md:block max-w-7xl mx-auto px-4 pb-2">
            <nav className="chip-scroll" aria-label="Разделы">
              {TABS.map((t) => (
                <button key={t.id} type="button" className={cn('nav-pill', tab === t.id && 'active')} style={{ minHeight: 48 }} onClick={() => setTab(t.id)}>
                  <span className="np-ic"><t.Icon size={18} /></span>
                  {t.label}
                  {t.id === 'sync' && p.pendingAt && <span className="w-2 h-2 rounded-full bg-red2" />}
                </button>
              ))}
            </nav>
          </div>
        </header>
      </div>

      <main className="max-w-7xl mx-auto px-4 pt-4 space-y-4">
        {!gas && (
          <div className="rounded-xl border border-gold/50 bg-gold/10 px-3 py-2.5 text-sm text-gold2 flex items-start gap-3">
            <span className="ic w-6 h-6 flex-none"><AlertTriangle size={18} /></span>
            <div className="min-w-0">
              <b>Таблица не подключена — правки сохраняются только на этом устройстве.</b>{' '}
              Чтобы все видели изменения, укажите <code className="font-mono">gasUrl</code> в <code className="font-mono">src/lib/appConfig.ts</code> (вкладка «Синхронизация» → 4 шага).
            </div>
          </div>
        )}
        {gas && p.pendingAt && (
          <div className="rounded-xl border border-red/50 bg-red/10 px-3 py-2.5 text-sm text-red2 flex items-center gap-3">
            <span className="ic w-6 h-6 flex-none"><CloudUpload size={18} /></span>
            <div className="min-w-0 flex-1">
              <b>Есть неотправленные правки</b> (с {fmtTime(p.pendingAt)}). Они не потеряны и уйдут сами при появлении сети.
            </div>
            <button type="button" className="btn-primary min-h-10 px-3" onClick={p.onFlush} disabled={p.flushing}>
              {p.flushing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Отправить
            </button>
          </div>
        )}

        {tab === 'prices' && <PriceTab draft={p.data} update={update} />}
        {tab === 'categories' && <CategoriesTab draft={p.data} update={update} />}
        {tab === 'shops' && <ShopsTab draft={p.data} update={update} onPreview={p.onPreview} />}
        {tab === 'promos' && <PromosTab draft={p.data} update={update} />}
        {tab === 'sync' && <SyncTab draft={p.data} pendingAt={p.pendingAt} flushing={p.flushing} onFlush={p.onFlush} logTick={p.logTick} />}
        {tab === 'settings' && <SettingsTab draft={p.data} update={update} onResetSeed={p.onResetSeed} onImport={p.onImport} />}
      </main>

      <Dock
        label="Разделы"
        items={
          [
            ...mobileTabs.map((id): DockItem => {
              const t = TABS.find((x) => x.id === id)!;
              return { key: id, label: t.label, Icon: t.Icon, active: tab === id, onClick: () => goTab(id) };
            }),
            { key: 'more', label: 'Ещё', Icon: LayoutGrid, active: moreTabs.includes(tab), onClick: () => setMore(true), dot: !!p.pendingAt },
            { key: 'logout', label: 'Выйти', Icon: LogOut, onClick: p.onLogout },
          ] satisfies DockItem[]
        }
      />

      {/* Шторка «Ещё» (телефон): остальные разделы + обновление */}
      <Overlay open={more} onClose={() => setMore(false)} title="Ещё">
        <div className="space-y-2">
          {moreTabs.map((id) => {
            const t = TABS.find((x) => x.id === id)!;
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => goTab(id)}
                className={cn('w-full flex items-center gap-3 rounded-xl border px-4 text-left transition-colors', on ? 'border-gold bg-gold/10' : 'border-line bg-card2')}
                style={{ minHeight: 60 }}
              >
                <span className={cn('ic w-10 h-10 rounded-xl', on ? 'bg-gradient-to-br from-gold2 to-gold text-goldink' : 'bg-card text-ink2 border border-line')}><t.Icon size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold">{t.label}</span>
                  {id === 'sync' && (
                    <span className={cn('block text-xs', p.pendingAt ? 'text-red2' : 'text-ink3')}>{p.pendingAt ? `неотправленные правки с ${fmtTime(p.pendingAt)}` : gas ? 'таблица подключена' : 'только это устройство'}</span>
                  )}
                </span>
                <ChevronRight size={18} className="text-ink3 flex-none" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setMore(false);
              p.onRefresh();
            }}
            className="w-full flex items-center gap-3 rounded-xl border border-line bg-card2 px-4 text-left"
            style={{ minHeight: 60 }}
          >
            <span className="ic w-10 h-10 rounded-xl bg-card text-ink2 border border-line"><RefreshCw size={20} className={cn(p.refreshing && 'animate-spin')} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">Обновить из таблицы</span>
              <span className="block text-xs text-ink3">Сначала отправит вашу очередь, потом подтянет свежее</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMore(false);
              setInstall(true);
            }}
            className="w-full flex items-center gap-3 rounded-xl border border-line bg-card2 px-4 text-left"
            style={{ minHeight: 60 }}
          >
            <span className="ic w-10 h-10 rounded-xl bg-gold/15 text-gold2 border border-gold/30"><Smartphone size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">Как установить на телефон</span>
              <span className="block text-xs text-ink3">Инструкции для iPhone, Samsung, Android, ПК</span>
            </span>
            <ChevronRight size={18} className="text-ink3 flex-none" />
          </button>
          <button type="button" onClick={p.onLogout} className="w-full flex items-center gap-3 rounded-xl border border-red/40 bg-red/10 px-4 text-left text-red2" style={{ minHeight: 60 }}>
            <span className="ic w-10 h-10 rounded-xl bg-red/15 border border-red/30"><LogOut size={20} /></span>
            <span className="block font-extrabold">Выйти из панели</span>
          </button>
        </div>
      </Overlay>
      <InstallModal open={install} onClose={() => setInstall(false)} />
    </div>
  );
}
