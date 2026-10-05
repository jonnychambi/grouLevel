import { useCallback, useEffect, useState } from 'react';
import { loadCatalog, type Catalog } from '../services/catalogService';

let cached: Catalog | null = null;

/** Carga (una sola vez) el catálogo completo. Expone estados de loading y error con reintento. */
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(cached);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    loadCatalog()
      .then((c) => {
        cached = c;
        if (alive) setCatalog(c);
      })
      .catch((e: Error) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { catalog, loading: !catalog && !error, error, retry };
}
