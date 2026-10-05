import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useCompare } from '../../hooks/useCompare';
import { CompareTray } from '../compare/CompareTray';
import { ConsentBanner } from './ConsentBanner';
import { Footer } from './Footer';
import { Header } from './Header';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export function PageFallback() {
  return (
    <div className="container-page py-24" role="status" aria-live="polite">
      <div className="mx-auto h-1 w-40 overflow-hidden rounded-full bg-raise">
        <div className="h-full w-1/3 animate-[shimmer_1s_infinite] rounded-full bg-gradient-to-r from-violet via-blue to-cyan" />
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

export function Layout() {
  const { count } = useCompare();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenido" className="sr-only z-[100] rounded-full bg-white px-4 py-2 text-navy focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Saltar al contenido
      </a>
      <ScrollToTop />
      <Header />
      <main id="contenido" tabIndex={-1} className={`flex-1 focus:outline-none ${count > 0 ? 'pb-24' : ''}`}>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <CompareTray />
      <ConsentBanner />
    </div>
  );
}
