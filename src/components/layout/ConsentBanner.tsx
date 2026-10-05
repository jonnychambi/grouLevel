import { useEffect, useState } from 'react';
import { consentStore, gaEnabled, setConsent } from '../../services/ga';

export const OPEN_CONSENT_EVENT = 'groulevel:open-consent';

/** Aviso de cookies analíticas (solo si Google Analytics está configurado). No bloquea la navegación. */
export function ConsentBanner() {
  const choice = consentStore.use();
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, []);

  if (!gaEnabled || (choice !== null && !reopened)) return null;

  const decide = (c: 'granted' | 'denied') => {
    setConsent(c);
    setReopened(false);
  };

  return (
    <div role="region" aria-label="Preferencias de cookies" className="fixed inset-x-0 bottom-0 z-[65] p-3 sm:p-5">
      <div className="mx-auto flex max-w-3xl animate-slide-up flex-col gap-3 rounded-2xl border border-line-strong bg-raise/95 p-4 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-gray">
          Usamos cookies analíticas (Google Analytics) para entender cómo se usa Groulevel y mejorarlo. No usamos cookies publicitarias ni compartimos tus datos de contacto con Google.
        </p>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => decide('denied')}>Rechazar</button>
          <button className="btn btn-primary btn-sm" onClick={() => decide('granted')}>Aceptar</button>
        </div>
      </div>
    </div>
  );
}
