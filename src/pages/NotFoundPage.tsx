import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { SearchBar } from '../components/search/SearchBar';
import { useSeo } from '../hooks/useSeo';

export default function NotFoundPage() {
  useSeo({ title: 'Página no encontrada', noindex: true });
  return (
    <div className="container-page py-16">
      <EmptyState
        icon="search"
        title="No encontramos esta página"
        description="Puede que el enlace haya cambiado. Busca un programa o vuelve al inicio."
        action={<Link to="/" className="btn btn-primary">Ir al inicio</Link>}
      />
      <SearchBar source="header" className="mx-auto mt-8 max-w-xl" />
    </div>
  );
}
