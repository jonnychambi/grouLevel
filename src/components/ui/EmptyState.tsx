import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface Props {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'error' | 'success';
  className?: string;
}

/** Estados de interfaz: vacío, sin resultados, error y éxito comparten esta pieza. */
export function EmptyState({ icon = 'search', title, description, action, tone = 'neutral', className = '' }: Props) {
  const ring = { neutral: 'border-line-strong text-cyan', error: 'border-neg/40 text-neg', success: 'border-pos/40 text-pos' }[tone];
  return (
    <div className={`card flex flex-col items-center px-6 py-14 text-center ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className={`mb-5 grid h-14 w-14 place-items-center rounded-full border bg-navy ${ring}`}>
        <Icon name={icon} size={24} />
      </span>
      <h2 className="text-xl text-white sm:text-2xl">{title}</h2>
      {description && <p className="mt-2 max-w-md text-gray">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
