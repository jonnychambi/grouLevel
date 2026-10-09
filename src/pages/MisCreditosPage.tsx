import { Link } from 'react-router-dom';
import { CreditsPanel, CreditsSummary, EmailGate, MyReviews } from '../components/reviews/ReviewAccount';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { useCatalog } from '../hooks/useCatalog';
import { useReviewAccount } from '../hooks/useReviewAccount';
import { useSeo } from '../hooks/useSeo';
import { clearReviewSession } from '../services/reviewsService';

/** Mis créditos: soles acumulados por reseñas y referidos, movimientos, enlace de referido y canje. */
export default function MisCreditosPage() {
  useSeo({ title: 'Mis créditos', description: 'Tus soles acumulados en Groulevel por reseñas y referidos, para usar como descuento adicional en tu programa.', path: '/mis-creditos', noindex: true });
  const { catalog } = useCatalog();
  const { session, wallet, reviews, loading } = useReviewAccount();

  return (
    <div className="container-page max-w-5xl pt-8 pb-16">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Mis créditos' }]} />
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-3xl text-white sm:text-4xl">Mis créditos</h1>
          <p className="mt-2 text-gray">Ganas S/ 100 por cada reseña y S/ 100 por cada persona que invites y opine. Úsalos como descuento adicional en el programa que elijas.</p>
        </div>
        {session && (
          <p className="text-sm text-gray">{session.email} · <button className="text-blue-soft hover:text-white" onClick={() => clearReviewSession()}>Salir</button></p>
        )}
      </header>

      <div className="mt-8">
        {!session ? (
          <div className="max-w-xl"><EmailGate onSession={() => undefined} /></div>
        ) : loading && !wallet ? (
          <div className="skeleton h-64" />
        ) : !wallet ? (
          <p className="card p-5 text-sm text-gray">No pudimos cargar tus créditos. Vuelve a intentarlo en unos minutos.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              <CreditsSummary wallet={wallet} />
              <MyReviews list={reviews} />
              <Link to="/opinar" className="btn btn-accent">Escribir otra reseña</Link>
            </div>
            <aside><CreditsPanel wallet={wallet} catalog={catalog} onChange={() => undefined} showBalance={false} /></aside>
          </div>
        )}
      </div>
    </div>
  );
}
