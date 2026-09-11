import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Copy } from 'lucide-react';
import { cn } from '@/utils/cn';
import { isPercent } from '@/lib/pricing';

/* ---------------- Overlay / модалка ---------------- */

let lockCount = 0;
function lockBody() {
  if (lockCount++ === 0) {
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (sw > 0) document.body.style.paddingRight = `${sw}px`;
  }
}
function unlockBody() {
  if (--lockCount <= 0) {
    lockCount = 0;
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }
}

export function Overlay({
  open, onClose, title, children, wide, size = 'sm', footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  size?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    lockBody();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unlockBody();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center modal-dock no-print" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative w-full bg-card border border-line shadow-pop rounded-t-3xl md:rounded-3xl animate-sheet md:animate-rise flex flex-col max-h-[92dvh] overscroll-contain',
          wide || size === 'lg' ? 'md:max-w-4xl' : size === 'md' ? 'md:max-w-2xl' : 'md:max-w-lg',
        )}
      >
        <div className="relative px-4 pt-3 md:pt-4 pb-2 border-b border-line flex items-center gap-3 flex-none">
          <div className="grabber absolute left-1/2 -translate-x-1/2 top-2" />
          <div className="min-w-0 flex-1 pt-2 md:pt-0">
            {typeof title === 'string' ? <h2 className="text-lg font-extrabold truncate">{title}</h2> : title}
          </div>
          <button type="button" className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>
        <div className="px-4 py-4 overflow-y-auto overscroll-contain flex-1 min-h-0">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-line flex-none pb-[calc(12px+var(--sab))] md:pb-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Бонус-чип ---------------- */

export function BonusChip({ bonus, red, size = 'md' }: { bonus: string; red?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const pct = isPercent(bonus);
  const txt = bonus.trim();
  const cls = red ? 'bg-red/15 text-red2 border-red/40' : pct ? 'bg-gold/15 text-gold2 border-gold/50' : 'bg-mint/12 text-mint border-mint/30';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg border font-mono font-bold whitespace-nowrap',
        size === 'sm' ? 'text-xs px-1.5 py-0.5' : size === 'lg' ? 'text-base px-2.5 py-1' : 'text-sm px-2 py-0.5',
        cls,
      )}
    >
      {txt || '—'}
      {txt && !pct ? <span className="ml-0.5 opacity-80">₽</span> : null}
    </span>
  );
}

/* ---------------- Toggle ---------------- */

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={cn('toggle', on ? 'on' : 'off')} onClick={() => onChange(!on)}>
      <span className="knob" />
    </button>
  );
}

/* ---------------- Кнопка копирования ---------------- */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyBtn({ text, label = 'Копировать', className, accent }: { text: string | (() => string); label?: string; className?: string; accent?: boolean }) {
  const [done, setDone] = useState(false);
  const t = useRef<number | null>(null);
  useEffect(() => () => { if (t.current) window.clearTimeout(t.current); }, []);
  return (
    <button
      type="button"
      className={cn(accent ? 'btn-accent' : 'btn-primary', className)}
      onClick={async () => {
        const ok = await copyText(typeof text === 'function' ? text() : text);
        setDone(ok);
        if (t.current) window.clearTimeout(t.current);
        t.current = window.setTimeout(() => setDone(false), 1800);
      }}
    >
      <span className="ic w-5 h-5">{done ? <Check size={18} /> : <Copy size={18} />}</span>
      {done ? 'Скопировано' : label}
    </button>
  );
}

/* ---------------- Скелетоны ---------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

/* ---------------- Хук: медиазапрос ---------------- */

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const fn = () => setM(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [q]);
  return m;
}

/* ---------------- Статус-строка ---------------- */

export function Notice({ tone = 'info', children, action }: { tone?: 'info' | 'ok' | 'warn' | 'err'; children: ReactNode; action?: ReactNode }) {
  const cls = {
    info: 'border-line bg-card2 text-ink2',
    ok: 'border-mint/40 bg-mint/10 text-mint',
    warn: 'border-gold/50 bg-gold/10 text-gold2',
    err: 'border-red/50 bg-red/10 text-red2',
  }[tone];
  return (
    <div className={cn('rounded-xl border px-3 py-2.5 text-sm flex items-center gap-3', cls)}>
      <div className="flex-1 min-w-0 break-words">{children}</div>
      {action}
    </div>
  );
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
