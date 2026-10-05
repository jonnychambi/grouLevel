import { Link } from 'react-router-dom';
import { CourseGrid } from '../components/course/CourseGrid';
import { RecentlyViewed } from '../components/course/RecentlyViewed';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { EmptyState } from '../components/ui/EmptyState';
import { useCatalog } from '../hooks/useCatalog';
import { useCompare } from '../hooks/useCompare';
import { useFavorites } from '../hooks/useFavorites';
import { useSeo } from '../hooks/useSeo';

export default function FavoritesPage() {
  const { catalog, loading } = useCatalog();
  const { ids } = useFavorites();
  const { replace } = useCompare();
  useSeo({ title: 'Mis favoritos', path: '/favoritos', noindex: true });
  const courses = catalog ? ids.map((id) => catalog.byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c) : [];

  return (
    <div className="container-page pt-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Favoritos' }]} />
      <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl text-white sm:text-4xl">Mis favoritos</h1>
          <p className="mt-2 text-gray">Se guardan en este dispositivo. No necesitas cuenta.</p>
        </div>
        {courses.length >= 2 && (
          <Link to="/comparar" onClick={() => replace(courses.slice(0, 3).map((c) => c.id))} className="btn btn-accent btn-sm self-start">
            Comparar {Math.min(3, courses.length)} favoritos
          </Link>
        )}
      </header>
      <div className="mt-8">
        {loading ? (
          <CourseGrid courses={[]} loading skeletons={3} />
        ) : courses.length === 0 ? (
          <EmptyState icon="heart" title="Aún no tienes favoritos" description="Toca el corazón en cualquier programa para guardarlo y revisarlo después." action={<Link to="/programas" className="btn btn-primary">Explorar programas</Link>} />
        ) : (
          <CourseGrid courses={courses} source="favoritos" />
        )}
      </div>
      <RecentlyViewed className="mt-16" />
    </div>
  );
}
