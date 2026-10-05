import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** "dialog" centrado en desktop (bottom-sheet en mobile) o "drawer" lateral. */
  variant?: 'dialog' | 'drawer';
  size?: 'md' | 'lg';
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal accesible: focus trap, Escape, bloqueo de scroll y retorno de foco. */
export function Modal({ open, onClose, title, description, children, variant = 'dialog', size = 'md' }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && panel.current) {
        const nodes = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!nodes.length) return;
        const firstEl = nodes[0];
        const lastEl = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const isDrawer = variant === 'drawer';
  const wrap = isDrawer ? 'justify-end' : 'items-end sm:items-center justify-center sm:p-6';
  const box = isDrawer
    ? 'h-full w-full max-w-md animate-slide-in-right rounded-l-[var(--radius-card)]'
    : `w-full ${size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[92dvh] animate-slide-up rounded-t-[var(--radius-card)] sm:rounded-[var(--radius-card)]`;

  return createPortal(
    <div className={`fixed inset-0 z-[70] flex ${wrap}`}>
      <div className="absolute inset-0 animate-fade-in bg-navy/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative flex flex-col overflow-hidden border border-line-strong bg-midnight shadow-2xl ${box}`}
      >
        <div className="flex items-start gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="text-lg text-white sm:text-xl">{title}</h2>
            {description && <div className="mt-1 text-sm text-gray">{description}</div>}
          </div>
          <button onClick={onClose} className="-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-gray hover:bg-raise hover:text-white" aria-label="Cerrar">
            <Icon name="x" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body
  );
}
