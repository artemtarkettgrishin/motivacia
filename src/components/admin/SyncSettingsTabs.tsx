import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CloudUpload, Download, Link2, Loader2, RotateCcw, Send, Upload, X, FileCode2, Table2, Plug, Mail } from 'lucide-react';
import type { AppData } from '@/lib/types';
import { REQUIRED_GAS_VERSION, appConfig, getConfig, hasGas, readOverride, writeOverride } from '@/lib/appConfig';
import { buildBackendScript, buildTsv, SHEET_DESCRIPTIONS, SHEET_HEADERS, SHEET_NAMES, type SheetName } from '@/lib/backendScript';
import { gasVersion } from '@/lib/gsheet';
import { normalizeData } from '@/lib/pricing';
import { readSyncLog } from '@/lib/storage';
import { checkConnection, syncTarget, type ConnectionCheck } from '@/lib/sync';
import { cn } from '@/utils/cn';
import { CopyBtn, Notice, fmtTime } from '../ui';

import { InstallButton, sellerLink } from '../InstallHelp';

function Block({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('card p-4 space-y-3', className)}>
      <h3 className="font-extrabold">{title}</h3>
      {children}
    </section>
  );
}

/* ====================================================================== */
/*  СИНХРОНИЗАЦИЯ                                                         */
/* ====================================================================== */

export function SyncTab({ draft, pendingAt, flushing, onFlush, logTick }: { draft: AppData; pendingAt: string | null; flushing: boolean; onFlush: () => void; logTick: number }) {
  const cfg = getConfig();
  const gas = hasGas(cfg);
  const [ver, setVer] = useState<{ busy: boolean; v: number | null }>({ busy: false, v: null });
  const [sheet, setSheet] = useState<SheetName>('Товары');
  const log = useMemo(() => readSyncLog().slice(0, 3), [logTick, pendingAt, flushing]); // eslint-disable-line react-hooks/exhaustive-deps
  const tsv = useMemo(() => buildTsv(draft, sheet), [draft, sheet]);

  const check = async () => {
    setVer({ busy: true, v: null });
    const v = await gasVersion(cfg.gasUrl);
    setVer({ busy: false, v });
  };
  const verText = (v: number) =>
    v === -1 ? 'Скрипт не отвечает: проверьте URL (…/exec) и доступ «Все».'
      : v < REQUIRED_GAS_VERSION ? `Скрипт устарел (v${v}, нужна v${REQUIRED_GAS_VERSION}): вставьте новый код и опубликуйте НОВУЮ ВЕРСИЮ развёртывания.`
        : `Скрипт v${v} актуален — запись работает.`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-4 space-y-1">
          <div className="text-xs uppercase tracking-wider text-ink3 font-bold">Скрипт (gasUrl)</div>
          <div className="flex items-center gap-2">
            <span className={cn('live-dot', gas ? 'on' : 'off')} />
            <span className="font-bold">{gas ? 'задан — запись включена' : 'не задан — только это устройство'}</span>
          </div>
          {gas && <div className="font-mono text-[11px] text-ink3 break-all">{cfg.gasUrl}</div>}
        </div>
        <div className="card p-4 space-y-2">
          <div className="text-xs uppercase tracking-wider text-ink3 font-bold">Версия скрипта</div>
          {ver.v !== null && (
            <div className={cn('text-sm font-semibold', ver.v >= REQUIRED_GAS_VERSION ? 'text-mint' : 'text-red2')}>{verText(ver.v)}</div>
          )}
          <button type="button" className="btn-primary min-h-10 w-full" onClick={check} disabled={!gas || ver.busy}>
            {ver.busy ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />} Проверить скрипт
          </button>
        </div>
        <div className="card p-4 space-y-2">
          <div className="text-xs uppercase tracking-wider text-ink3 font-bold">Очередь</div>
          <div className="flex items-center gap-2">
            <span className={cn('live-dot', pendingAt ? 'off' : 'on')} />
            <span className="font-bold">{pendingAt ? `есть правки с ${fmtTime(pendingAt)}` : 'пусто'}</span>
          </div>
          <button type="button" className="btn-primary min-h-10 w-full" onClick={onFlush} disabled={!pendingAt || !gas || flushing}>
            {flushing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Отправить
          </button>
        </div>
      </div>

      <Block title="Журнал синхронизаций">
        {log.length === 0 ? (
          <p className="text-sm text-ink3">Пока пусто — появится после первого сохранения.</p>
        ) : (
          <ul className="space-y-2">
            {log.map((e, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className={cn('ic w-6 h-6 rounded-full flex-none', e.ok ? 'bg-mint/15 text-mint' : 'bg-red/15 text-red2')}>{e.ok ? <Check size={14} /> : <X size={14} />}</span>
                <div className="min-w-0">
                  <div className="text-xs text-ink3 font-mono">{fmtTime(e.at)} · {e.where}</div>
                  <div className="text-ink2 break-words">{e.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Ссылка для продавцов">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="field flex items-center gap-2 font-mono text-sm min-w-0"><Link2 size={16} className="flex-none text-ink3" /><span className="truncate">{sellerLink()}</span></div>
          <CopyBtn text={sellerLink} label="Копировать" className="min-h-14 flex-none" />
        </div>
        <p className="text-xs text-ink3">Одна ссылка для телефона и ПК. Учитывает подпапку GitHub Pages.</p>
        <InstallButton className="min-h-11" label="Как установить на телефон (iPhone, Samsung, Android)" />
      </Block>

      <Block title="Онлайн за 4 шага (Google Таблица + Apps Script)">
        <ol className="space-y-2 text-sm text-ink2 list-decimal pl-5">
          <li>Создайте пустую Google Таблицу → <b>Расширения → Apps Script</b>. Удалите содержимое редактора.</li>
          <li>Нажмите «Копировать скрипт» ниже, вставьте, сохраните. Выберите функцию <code className="font-mono">setupMotivaciya</code> → ▶ Выполнить (разрешите доступ). Появятся 5 листов с текущими данными.</li>
          <li><b>Развернуть → Новое развёртывание → Веб-приложение</b>: выполнять как «Я», доступ «Все». Скопируйте URL вида …/exec.</li>
          <li>Вставьте URL в <code className="font-mono">gasUrl</code> файла <code className="font-mono">src/lib/appConfig.ts</code>, сделайте push — GitHub Pages пересоберётся. Для проверки на этом устройстве можно вставить URL во вкладке «Настройки».</li>
        </ol>
        <div className="flex flex-col sm:flex-row gap-2">
          <CopyBtn accent text={() => buildBackendScript(draft)} label="Копировать скрипт (с данными)" className="min-h-12" />
          <button
            type="button"
            className="btn-primary min-h-12"
            onClick={() => {
              const blob = new Blob([buildBackendScript(draft)], { type: 'text/plain;charset=utf-8' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'MotivaciyaBackend.gs';
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            <FileCode2 size={18} /> Скачать .gs
          </button>
        </div>
        <Notice tone="warn">
          <b>Важно:</b> в скрипт зашиты текущие данные панели (для первичного заполнения). После любой правки кода в Apps Script — <b>Управление развёртываниями → Новая версия</b>, иначе по старому URL продолжит работать старый код.
        </Notice>
      </Block>

      <Block title="TSV по листам (вставить в таблицу вручную)">
        <div className="chip-scroll">
          {SHEET_NAMES.map((n) => (
            <button key={n} type="button" className={cn('chip', sheet === n && 'on')} onClick={() => setSheet(n)}>{n}</button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink3 font-mono">{tsv.split('\n').length - 1} строк · {SHEET_HEADERS[sheet].length} колонок</span>
          <CopyBtn text={tsv} label="Копировать TSV" className="min-h-10" />
        </div>
        <pre className="tsv-grid">{tsv}</pre>
        <p className="text-xs text-ink3">Вставьте в ячейку A1 листа с таким же именем — колонки разойдутся по табуляции.</p>
      </Block>

      <Block title="Структура таблицы (5 листов)">
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="ytable min-w-[640px]">
            <thead><tr><th>Лист</th><th>Колонки</th><th>Назначение</th></tr></thead>
            <tbody>
              {SHEET_NAMES.map((n) => (
                <tr key={n}>
                  <td className="font-mono font-bold whitespace-nowrap">{n}</td>
                  <td className="text-xs text-ink2">{SHEET_HEADERS[n].join(' | ')}</td>
                  <td className="text-xs text-ink3">{SHEET_DESCRIPTIONS[n]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Notice tone="info">
        Таблица старого формата (10 листов с «Привязкой прайсов») читается автоматически: скрипт v{REQUIRED_GAS_VERSION} и приложение переносят её в новый формат при первом сохранении. Листы Прайс_*, Привязка_прайсов и Цены_по_группам после этого можно удалить.
      </Notice>
      <Notice tone="warn">
        <b>«Тайм-аут блокировки» / «таблица занята»</b> — два сохранения пришли одновременно (например, панель открыта на телефоне и на ПК). Это не ошибка данных: правки лежат в очереди и уходят сами через несколько секунд. Скрипт v{REQUIRED_GAS_VERSION} пишет только изменённые листы и держит таблицу занятой ~1–3 с вместо 10–20 — если ошибка повторяется, обновите код скрипта и опубликуйте новую версию.
      </Notice>
      <Notice tone="err">
        <span className="inline-flex items-center gap-2"><AlertTriangle size={16} /> <b>Симптом «удалил — появилось»</b>: значит запись не доходит до таблицы. Проверьте версию скрипта кнопкой выше и опубликуйте новую версию развёртывания.</span>
      </Notice>
    </div>
  );
}

/* ====================================================================== */
/*  НАСТРОЙКИ                                                             */
/* ====================================================================== */

export function SettingsTab({ draft, update, onResetSeed, onImport }: { draft: AppData; update: (fn: (d: AppData) => AppData) => void; onResetSeed: () => void; onImport: (d: AppData) => void }) {
  const cfg = getConfig();
  const target = syncTarget(cfg);
  const [chk, setChk] = useState<{ busy: boolean; r: ConnectionCheck | null }>({ busy: false, r: null });
  const [ovUrl, setOvUrl] = useState(readOverride().gasUrl ?? '');
  const [ovSheet, setOvSheet] = useState(readOverride().sheetId ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const doCheck = async () => {
    setChk({ busy: true, r: null });
    const r = await checkConnection(cfg);
    setChk({ busy: false, r });
  };

  const configSnippet = `export const appConfig: AppConfig = {
  dataSource: '${cfg.gasUrl ? 'gas' : cfg.dataSource}',
  sheetId: '${cfg.sheetId}',
  gasUrl: '${cfg.gasUrl || 'https://script.google.com/macros/s/…/exec'}',
  reportEmail: '${draft.settings.reportEmail || cfg.reportEmail}',
  adminPassword: '${cfg.adminPassword}',
  companyName: '${cfg.companyName}',
};`;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `motivaciya-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const d = normalizeData(raw);
        if (!d.products.length && !d.shops.length) throw new Error('empty');
        if (!confirm(`Импортировать бэкап? Товаров: ${d.products.length}, магазинов: ${d.shops.length}. Текущие данные будут заменены.`)) return;
        onImport(d);
      } catch (e) {
        console.error(e);
        alert('Файл повреждён или это не бэкап «Мотивации».');
      }
    };
    reader.readAsText(file);
  };

  const saveOverride = () => {
    const o: Record<string, string> = {};
    if (ovUrl.trim()) o.gasUrl = ovUrl.trim();
    if (ovSheet.trim()) o.sheetId = ovSheet.trim();
    writeOverride(Object.keys(o).length ? (o as { gasUrl?: string; sheetId?: string }) : null);
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-ink3 font-bold">Источник</div>
          <div className="font-mono font-bold text-lg">{cfg.dataSource}</div>
          <div className="text-xs text-ink3">{cfg.dataSource === 'local' ? 'сид + это устройство' : cfg.dataSource === 'google' ? 'gviz, только чтение' : 'Apps Script'}</div>
        </div>
        <div className="card p-4 min-w-0">
          <div className="text-xs uppercase tracking-wider text-ink3 font-bold">Значение</div>
          <div className="font-mono text-sm break-all">{cfg.gasUrl || cfg.sheetId || '—'}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-ink3 font-bold">Синхронизация</div>
          <div className="flex items-center gap-2"><span className={cn('live-dot', target === 'gas' ? 'on' : 'off')} /><span className="font-bold">{target === 'gas' ? 'запись в таблицу' : 'только это устройство'}</span></div>
          <div className="text-xs text-ink3">{readOverride().gasUrl ? 'переопределено на этом устройстве' : 'из appConfig.ts'}</div>
        </div>
      </div>

      <Block title="Проверка подключения">
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" className="btn-accent min-h-12" onClick={doCheck} disabled={chk.busy}>
            {chk.busy ? <Loader2 size={18} className="animate-spin" /> : <Plug size={18} />} Проверить подключение
          </button>
        </div>
        {chk.r && <Notice tone={chk.r.ok ? 'ok' : 'err'}>{chk.r.text}</Notice>}
      </Block>

      <Block title="Конфиг для всех устройств (src/lib/appConfig.ts)">
        <ol className="text-sm text-ink2 list-decimal pl-5 space-y-1">
          <li>Откройте в репозитории файл <code className="font-mono">src/lib/appConfig.ts</code>.</li>
          <li>Замените блок <code className="font-mono">appConfig</code> на текст ниже (gasUrl — из «Синхронизации»).</li>
          <li>Сделайте push в <code className="font-mono">main</code> — GitHub Pages пересоберёт сайт за 1–2 минуты.</li>
        </ol>
        <pre className="tsv-grid">{configSnippet}</pre>
        <CopyBtn text={configSnippet} label="Копировать конфиг" className="min-h-11" />
      </Block>

      <Block title="Подключение на этом устройстве (для проверки без пересборки)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="lbl">gasUrl (…/exec)</label>
            <input className="field font-mono text-sm" value={ovUrl} onChange={(e) => setOvUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
          </div>
          <div>
            <label className="lbl">sheetId (только чтение, без скрипта)</label>
            <input className="field font-mono text-sm" value={ovSheet} onChange={(e) => setOvSheet(e.target.value)} placeholder="между /d/ и /edit" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" className="btn-primary min-h-11" onClick={saveOverride}><Check size={16} /> Применить и перезагрузить</button>
          {(readOverride().gasUrl || readOverride().sheetId) && (
            <button type="button" className="btn-danger min-h-11" onClick={() => { writeOverride(null); window.location.reload(); }}><X size={16} /> Сбросить к appConfig.ts</button>
          )}
        </div>
        <p className="text-xs text-ink3">Действует только в этом браузере. Для всех устройств — правьте appConfig.ts (блок выше). Значение по умолчанию в файле: gasUrl = «{appConfig.gasUrl || 'пусто'}».</p>
      </Block>

      <Block title="Системные">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="md:col-span-1">
            <label className="lbl">Email для отчётов</label>
            <div className="relative">
              <span className="ic absolute left-0 top-0 h-full w-[52px] text-ink3 pointer-events-none"><Mail size={18} /></span>
              <input className="field pl-[52px]" type="email" value={draft.settings.reportEmail} onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, reportEmail: e.target.value } }))} placeholder={cfg.reportEmail} />
            </div>
          </div>
          <div>
            <div className="lbl">Компания</div>
            <div className="field flex items-center text-ink2">{cfg.companyName}</div>
          </div>
          <div>
            <div className="lbl">Пароль админа</div>
            <div className="field flex items-center font-mono text-ink2">{cfg.adminPassword}</div>
          </div>
        </div>
        <p className="text-xs text-ink3">Email пишется в лист «Настройки». Компания и пароль — в appConfig.ts.</p>
      </Block>

      <Block title="Резервная копия">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button type="button" className="btn-primary min-h-12" onClick={exportJson}><Download size={18} /> Экспорт JSON</button>
          <button type="button" className="btn-primary min-h-12" onClick={() => fileRef.current?.click()}><Upload size={18} /> Импорт JSON</button>
          <button
            type="button"
            className="btn-danger min-h-12"
            onClick={() => {
              if (confirm('Сбросить все данные к стартовому набору? Локальные правки и очередь будут удалены.')) onResetSeed();
            }}
          >
            <RotateCcw size={18} /> Сброс к сиду
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-ink3"><CloudUpload size={14} /> После импорта/сброса данные автоматически уйдут в таблицу (если задан gasUrl).</div>
        <div className="flex items-center gap-2 text-xs text-ink3"><Table2 size={14} /> Обновлено: {fmtTime(draft.updatedAt) || '—'}</div>
      </Block>
    </div>
  );
}
