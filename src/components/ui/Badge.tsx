import type { ReactNode } from 'react';

type Tone = 'neutral' | 'type' | 'featured' | 'live' | 'success' | 'warning' | 'violet';

const TONES: Record<Tone, string> = {
  neutral: 'border-line-strong text-gray bg-raise/50',
  type: 'border-blue/50 text-blue-soft bg-blue/10',
  featured: 'border-violet/50 text-violet-soft bg-violet/10',
  live: 'border-cyan/40 text-cyan bg-cyan/5',
  success: 'border-pos/40 text-pos bg-pos/10',
  warning: 'border-warn/40 text-warn bg-warn/10',
  violet: 'border-violet/40 text-violet-soft bg-violet/10'
};

export function Badge({ children, tone = 'neutral', mono = false, className = '' }: { children: ReactNode; tone?: Tone; mono?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        mono ? 'font-mono text-[10.5px] uppercase tracking-[0.12em]' : ''
      } ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
