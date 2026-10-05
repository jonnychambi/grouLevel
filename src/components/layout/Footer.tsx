import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';

const EXPLORE = [
  { slug: 'data-analytics', name: 'Data Analytics' },
  { slug: 'inteligencia-artificial', name: 'Inteligencia Artificial' },
  { slug: 'data-science', name: 'Data Science' },
  { slug: 'desarrollo-de-software', name: 'Desarrollo de Software' },
  { slug: 'ciberseguridad', name: 'Ciberseguridad' },
  { slug: 'cloud-computing', name: 'Cloud Computing' }
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-navy">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo size={22} />
          <p className="mt-4 max-w-xs text-gray">El lugar donde comparas tu próxima formación tecnológica.</p>
          <p className="label-mono mt-6 normal-case tracking-normal text-muted">Hecho en Perú · para Latinoamérica</p>
        </div>
        <nav aria-label="Explorar categorías">
          <h2 className="label-mono mb-4">Explorar</h2>
          <ul className="space-y-2.5 text-sm">
            {EXPLORE.map((c) => <li key={c.slug}><Link className="text-gray hover:text-white" to={`/programas/${c.slug}`}>{c.name}</Link></li>)}
          </ul>
        </nav>
        <nav aria-label="Groulevel">
          <h2 className="label-mono mb-4">Groulevel</h2>
          <ul className="space-y-2.5 text-sm">
            <li><Link className="text-gray hover:text-white" to="/programas">Todos los programas</Link></li>
            <li><Link className="text-gray hover:text-white" to="/comparar">Comparador</Link></li>
            <li><Link className="text-gray hover:text-white" to="/instituciones">Instituciones</Link></li>
            <li><Link className="text-gray hover:text-white" to="/favoritos">Favoritos</Link></li>
            <li><Link className="text-gray hover:text-white" to="/nosotros">Nosotros</Link></li>
          </ul>
        </nav>
        <nav aria-label="Instituciones">
          <h2 className="label-mono mb-4">Instituciones</h2>
          <ul className="space-y-2.5 text-sm">
            <li><Link className="text-gray hover:text-white" to="/instituciones/partners">Publicar mis programas</Link></li>
            <li><Link className="text-gray hover:text-white" to="/instituciones/partners#contacto">Hablar con Groulevel</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <p>
            <strong className="font-medium text-gray">Versión de demostración.</strong> Las instituciones, programas, precios, docentes y valoraciones mostrados son ficticios y se usan solo para probar la plataforma.
          </p>
          <p className="shrink-0">© {new Date().getFullYear()} Groulevel</p>
        </div>
      </div>
    </footer>
  );
}
