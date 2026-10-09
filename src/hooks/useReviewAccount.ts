import { useEffect, useState } from 'react';
import { ACCOUNT_EVENT, fetchMyReviews, getReviewSession, type MyReview, type ReviewSession, type Wallet } from '../services/reviewsService';

export interface ReviewAccount { session: ReviewSession | null; wallet: Wallet | null; reviews: MyReview[]; loading: boolean }

// Una sola consulta compartida (cabecera y páginas); se renueva al minuto o cuando cambia la sesión o el saldo.
let cache: { token: string; at: number; data: Promise<{ reviews: MyReview[]; wallet: Wallet | null } | null> } | null = null;
const TTL = 60_000;

function load(force = false) {
  const session = getReviewSession();
  if (!session) {
    cache = null;
    return Promise.resolve(null);
  }
  // Varios componentes avisan a la vez: "force" reutiliza una consulta de hace menos de 1 s.
  if (!cache || cache.token !== session.access_token || Date.now() - cache.at > (force ? 1000 : TTL)) {
    cache = { token: session.access_token, at: Date.now(), data: fetchMyReviews() };
  }
  return cache.data;
}

/** Sesión, reseñas y créditos de la persona que opina (si validó su correo en este navegador). */
export function useReviewAccount(): ReviewAccount {
  const [state, setState] = useState<ReviewAccount>(() => ({ session: getReviewSession(), wallet: null, reviews: [], loading: !!getReviewSession() }));
  useEffect(() => {
    let alive = true;
    const run = (force: boolean) => {
      const session = getReviewSession();
      if (!session) { setState({ session: null, wallet: null, reviews: [], loading: false }); return; }
      setState((s) => ({ ...s, session, loading: true }));
      void load(force).then((r) => {
        if (!alive) return;
        setState({ session: getReviewSession(), wallet: r?.wallet ?? null, reviews: r?.reviews ?? [], loading: false });
      });
    };
    run(false);
    const onChange = () => run(true);
    window.addEventListener(ACCOUNT_EVENT, onChange);
    return () => { alive = false; window.removeEventListener(ACCOUNT_EVENT, onChange); };
  }, []);
  return state;
}
