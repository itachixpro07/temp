import { AlertTriangle, Loader2 } from 'lucide-react';
import { tier } from '../lib/format';

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted">
      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function TierChip({ level, children }) {
  const t = tier(level);
  return (
    <span className={`chip ${t.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" />
      {children || t.label}
    </span>
  );
}

export function Notice({ children, tone = 'info' }) {
  const tones = {
    info: 'border-line bg-sage/50 text-ink',
    error: 'border-tier-high/30 bg-tier-high/5 text-tier-high',
  };
  return (
    <div className={`flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${tones[tone]}`}>
      {tone === 'error' && (
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      )}
      <div>{children}</div>
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="panel px-6 py-12 text-center">
      <h2 className="text-lg text-ink">{title}</h2>
      {children && <p className="mx-auto mt-2 max-w-reading text-sm text-muted">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHead({ title, children }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl text-ink sm:text-3xl">{title}</h1>
      {children && <p className="mt-2 max-w-reading text-[15px] text-muted">{children}</p>}
    </header>
  );
}
