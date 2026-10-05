import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';

interface Toast { id: number; message: string; tone: 'info' | 'success' | 'warning'; action?: { label: string; to: string } }
type Notify = (message: string, opts?: { tone?: Toast['tone']; action?: Toast['action'] }) => void;

const ToastContext = createContext<Notify>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const notify = useCallback<Notify>((message, opts) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone: opts?.tone ?? 'info', action: opts?.action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const icon = { info: 'info', success: 'check', warning: 'alert' } as const;
  const color = { info: 'text-cyan', success: 'text-pos', warning: 'text-warn' };

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 top-20 z-[80] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-md animate-slide-up items-center gap-3 rounded-2xl border border-line-strong bg-raise/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur">
            <Icon name={icon[t.tone]} className={`shrink-0 ${color[t.tone]}`} />
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <Link to={t.action.to} className="shrink-0 font-medium text-cyan hover:underline">
                {t.action.label}
              </Link>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
