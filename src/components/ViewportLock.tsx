import { useEffect } from 'react';

const META = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content';

function isField(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Принудительный meta viewport, блок жестов зума, --vvh и body.kb-open при клавиатуре. */
export default function ViewportLock() {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.content = META;

    const prevent = (e: Event) => e.preventDefault();
    const touchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    document.addEventListener('gesturestart', prevent, { passive: false });
    document.addEventListener('gesturechange', prevent, { passive: false });
    document.addEventListener('gestureend', prevent, { passive: false });
    document.addEventListener('dblclick', prevent, { passive: false });
    document.addEventListener('touchmove', touchMove, { passive: false });
    document.addEventListener('wheel', wheel, { passive: false });

    const root = document.documentElement;
    const vv = window.visualViewport;
    const baseH = () => window.innerHeight;
    const applyVV = () => {
      if (!vv) return;
      root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
      const kb = vv.height < baseH() * 0.78;
      document.body.classList.toggle('kb-open', kb);
    };
    let focusTimer: number | null = null;
    const onFocusIn = (e: FocusEvent) => {
      if (!isField(e.target)) return;
      const el = e.target;
      if (!vv) document.body.classList.add('kb-open');
      if (focusTimer) window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        try {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch {
          /* ignore */
        }
      }, 320);
    };
    const onFocusOut = () => {
      if (!vv) document.body.classList.remove('kb-open');
      else window.setTimeout(applyVV, 120);
    };
    vv?.addEventListener('resize', applyVV);
    vv?.addEventListener('scroll', applyVV);
    window.addEventListener('resize', applyVV);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    applyVV();

    return () => {
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('gesturechange', prevent);
      document.removeEventListener('gestureend', prevent);
      document.removeEventListener('dblclick', prevent);
      document.removeEventListener('touchmove', touchMove);
      document.removeEventListener('wheel', wheel);
      vv?.removeEventListener('resize', applyVV);
      vv?.removeEventListener('scroll', applyVV);
      window.removeEventListener('resize', applyVV);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      if (focusTimer) window.clearTimeout(focusTimer);
    };
  }, []);
  return null;
}
