import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface DockItem {
  key: string;
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  /** Главное действие — золотая кнопка по центру. */
  primary?: boolean;
  badge?: number;
  dot?: boolean;
  spin?: boolean;
}

/** Нижний док для телефона: стеклянная капсула, активный раздел подсвечен, главное действие — золотая кнопка. */
export default function Dock({ items, label = 'Навигация' }: { items: DockItem[]; label?: string }) {
  return (
    <nav className="dock-wrap kb-hide" aria-label={label}>
      <div className="dock">
        {items.map((it) =>
          it.primary ? (
            <button key={it.key} type="button" className="dock-fab-wrap" onClick={it.onClick} aria-label={it.label}>
              <span className="dock-fab">
                <it.Icon size={24} strokeWidth={2.4} className={cn(it.spin && 'animate-spin')} />
              </span>
              <span className="dock-label">{it.label}</span>
            </button>
          ) : (
            <button key={it.key} type="button" className={cn('dock-btn', it.active && 'on')} onClick={it.onClick} aria-label={it.label} aria-current={it.active ? 'page' : undefined}>
              <span className="dock-ic">
                <it.Icon size={21} strokeWidth={it.active ? 2.4 : 2} className={cn(it.spin && 'animate-spin text-gold2')} />
              </span>
              <span className="dock-label">{it.label}</span>
              {it.badge ? <span className="dock-badge">{it.badge}</span> : it.dot ? <span className="dock-dot" /> : null}
            </button>
          ),
        )}
      </div>
    </nav>
  );
}
