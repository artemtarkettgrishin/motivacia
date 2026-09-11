import { useEffect, useState } from 'react';
import { Check, Download, Menu, MonitorDown, MoreVertical, Share, Smartphone, Link2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { canPromptInstall, detectPlatform, isStandalone, onInstallChange, promptInstall, type Platform } from '@/lib/install';
import { cn } from '@/utils/cn';
import { CopyBtn, Notice, Overlay } from './ui';

interface Guide {
  id: Platform;
  tab: string;
  title: string;
  browser: string;
  Icon: LucideIcon;
  steps: string[];
  note?: string;
}

const GUIDES: Guide[] = [
  {
    id: 'iphone', tab: 'iPhone', title: 'iPhone / iPad', browser: 'Safari', Icon: Share,
    steps: [
      'Откройте эту ссылку в Safari (не из Telegram/WhatsApp — там нажмите «Открыть в Safari»).',
      'Нажмите кнопку «Поделиться» — квадрат со стрелкой вверх внизу экрана (на iPad — вверху).',
      'Прокрутите список вниз и выберите «На экран “Домой”».',
      'Нажмите «Добавить» в правом верхнем углу.',
    ],
    note: 'Значок «Мотивация» появится на рабочем столе и будет открываться на весь экран, без адресной строки.',
  },
  {
    id: 'samsung', tab: 'Samsung', title: 'Samsung Galaxy', browser: 'Samsung Internet или Chrome', Icon: Menu,
    steps: [
      'Откройте ссылку в браузере Samsung Internet.',
      'Нажмите кнопку меню «≡» в правом нижнем углу.',
      'Выберите «Добавить страницу на» → «Главный экран» (или нажмите значок загрузки «Установить» в адресной строке).',
      'Подтвердите «Добавить».',
    ],
    note: 'В Chrome на Samsung: меню «⋮» → «Добавить на главный экран» / «Установить приложение».',
  },
  {
    id: 'android', tab: 'Android', title: 'Android (Xiaomi, Realme, Pixel и др.)', browser: 'Chrome', Icon: MoreVertical,
    steps: [
      'Откройте ссылку в Chrome.',
      'Нажмите меню «⋮» в правом верхнем углу.',
      'Выберите «Добавить на главный экран» или «Установить приложение».',
      'Нажмите «Установить» / «Добавить».',
    ],
    note: 'На Xiaomi может потребоваться разрешить браузеру «Создание ярлыков» в настройках приложения.',
  },
  {
    id: 'huawei', tab: 'Huawei', title: 'Huawei / Honor', browser: 'Huawei Browser', Icon: Menu,
    steps: [
      'Откройте ссылку в браузере Huawei.',
      'Нажмите меню «≡» внизу.',
      'Выберите «Добавить на рабочий стол» (или «Добавить в…» → «Рабочий стол»).',
      'Подтвердите добавление.',
    ],
  },
  {
    id: 'desktop', tab: 'Компьютер', title: 'Компьютер', browser: 'Chrome, Edge или Яндекс Браузер', Icon: MonitorDown,
    steps: [
      'Откройте ссылку в Chrome, Edge или Яндекс Браузере.',
      'В правой части адресной строки нажмите значок «Установить» (монитор со стрелкой).',
      'Подтвердите «Установить» — приложение откроется в отдельном окне и появится в меню «Пуск» / Dock.',
    ],
    note: 'Если значка нет: меню браузера «⋮» → «Сохранить и поделиться» → «Установить приложение».',
  },
];

export function sellerLink(): string {
  return `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '/')}`;
}

export function InstallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Platform>(() => detectPlatform());
  const [can, setCan] = useState(() => canPromptInstall());
  const [done, setDone] = useState<boolean | null>(null);
  const standalone = isStandalone();

  useEffect(() => onInstallChange(() => setCan(canPromptInstall())), []);
  useEffect(() => {
    if (open) {
      setTab(detectPlatform());
      setDone(null);
    }
  }, [open]);

  const g = GUIDES.find((x) => x.id === tab) ?? GUIDES[0];

  return (
    <Overlay open={open} onClose={onClose} size="md" title="Как установить приложение?">
      <div className="space-y-4">
        {standalone ? (
          <Notice tone="ok">
            <span className="inline-flex items-center gap-2"><Check size={16} /> Приложение уже установлено — вы открыли его с рабочего стола.</span>
          </Notice>
        ) : (
          <div className="rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm text-ink space-y-1.5">
            <div className="font-extrabold text-gold2">Это занимает 30 секунд и не требует App Store / Google Play</div>
            <ul className="space-y-1 text-ink2">
              <li className="flex gap-2"><Check size={16} className="text-mint flex-none mt-0.5" /> Значок «Мотивация» появится на рабочем столе, как у обычного приложения</li>
              <li className="flex gap-2"><Check size={16} className="text-mint flex-none mt-0.5" /> Открывается на весь экран, без адресной строки браузера</li>
              <li className="flex gap-2"><Check size={16} className="text-mint flex-none mt-0.5" /> Прайс доступен даже без интернета (офлайн-копия)</li>
              <li className="flex gap-2"><Check size={16} className="text-mint flex-none mt-0.5" /> Вход запоминается — не нужно каждый раз вводить пароль</li>
            </ul>
          </div>
        )}

        {can && !standalone && (
          <button
            type="button"
            className="btn-accent w-full min-h-14 text-base"
            onClick={async () => {
              const ok = await promptInstall();
              setDone(ok);
              setCan(canPromptInstall());
            }}
          >
            <Download size={20} /> Установить сейчас
          </button>
        )}
        {done === true && <Notice tone="ok">Готово! Значок «Мотивация» на рабочем столе.</Notice>}
        {done === false && <Notice tone="warn">Установка отменена. Можно добавить вручную по шагам ниже.</Notice>}

        <div>
          <div className="lbl">Выберите устройство</div>
          <div className="chip-scroll">
            {GUIDES.map((x) => (
              <button key={x.id} type="button" className={cn('chip min-h-10', tab === x.id && 'on')} onClick={() => setTab(x.id)}>
                <x.Icon size={14} /> {x.tab}
                {x.id === detectPlatform() && <span className="text-[10px] opacity-70">· ваше</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-card2 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="ic w-11 h-11 rounded-xl bg-gradient-to-br from-gold2 to-gold text-goldink"><g.Icon size={22} /></span>
            <div className="min-w-0">
              <div className="font-extrabold">{g.title}</div>
              <div className="text-xs text-ink3">Браузер: {g.browser}</div>
            </div>
          </div>
          <ol className="space-y-2">
            {g.steps.map((st, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-ink">
                <span className="ic w-7 h-7 rounded-full bg-gold/15 text-gold2 font-mono font-bold text-xs flex-none">{i + 1}</span>
                <span className="pt-1">{st}</span>
              </li>
            ))}
          </ol>
          {g.note && <p className="text-xs text-ink3 border-t border-line pt-2">{g.note}</p>}
        </div>

        <div>
          <div className="lbl">Ссылка приложения</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="field flex items-center gap-2 font-mono text-sm min-w-0"><Link2 size={16} className="flex-none text-ink3" /><span className="truncate">{sellerLink()}</span></div>
            <CopyBtn text={sellerLink} label="Копировать" className="min-h-14 flex-none" />
          </div>
          <p className="text-xs text-ink3 mt-1">Отправьте ссылку продавцу — он откроет её на телефоне и добавит на рабочий стол по шагам выше.</p>
        </div>
      </div>
    </Overlay>
  );
}

export function InstallButton({ className, variant = 'primary', label = 'Как установить на телефон' }: { className?: string; variant?: 'primary' | 'accent' | 'link'; label?: string }) {
  const [open, setOpen] = useState(false);
  if (isStandalone()) return null;
  return (
    <>
      {variant === 'link' ? (
        <button type="button" className={cn('inline-flex items-center gap-1.5 text-sm text-gold2 underline underline-offset-2', className)} onClick={() => setOpen(true)}>
          <Smartphone size={16} /> {label}
        </button>
      ) : (
        <button type="button" className={cn(variant === 'accent' ? 'btn-accent' : 'btn-primary', className)} onClick={() => setOpen(true)}>
          <Smartphone size={18} /> {label}
        </button>
      )}
      <InstallModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
