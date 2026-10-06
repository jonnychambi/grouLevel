import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useCompare } from '../../hooks/useCompare';
import { useFavorites } from '../../hooks/useFavorites';
import { SearchBar } from '../search/SearchBar';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';

const NAV = [
  { to: '/programas', label: 'Explorar programas' },
  { to: '/comparar', label: 'Comparar' },
  { to: '/mi-ruta', label: 'Mi ruta' },
  { to: '/instituciones', label: 'Instituciones', end: true },
  { to: '/nosotros', label: 'Nosotros' }
];

export function Header() {
  const { count } = useCompare();
  const favorites = useFavorites();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isHome = location.pathname === '/';

  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `relative rounded-full px-3 py-2 text-[14.5px] transition-colors ${isActive ? 'text-white' : 'text-gray hover:text-white'}`;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-navy/85 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center gap-4">
        <Link to="/" aria-label="Groulevel, ir al inicio" className="shrink-0 rounded-md">
          <Logo size={21} />
        </Link>

        <nav aria-label="Principal" className="ml-4 hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}>
              {n.label}
              {n.to === '/comparar' && count > 0 && (
                <span className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-cyan px-1 font-mono text-[11px] font-semibold text-navy" aria-label={`${count} seleccionados`}>
                  {count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {!isHome && (
            <button onClick={() => setSearchOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-full text-gray hover:bg-raise hover:text-white" aria-label="Buscar programas" aria-expanded={searchOpen}>
              <Icon name={searchOpen ? 'x' : 'search'} size={19} />
            </button>
          )}
          <Link to="/favoritos" className="relative grid h-10 w-10 place-items-center rounded-full text-gray hover:bg-raise hover:text-white" aria-label={`Favoritos (${favorites.count})`}>
            <Icon name="heart" size={19} />
            {favorites.count > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-neg" aria-hidden="true" />}
          </Link>
          <Link to="/instituciones/partners" className="btn btn-ghost btn-sm ml-2 hidden sm:inline-flex">Para instituciones</Link>
          <button onClick={() => setMenuOpen(true)} className="grid h-10 w-10 place-items-center rounded-full text-gray hover:bg-raise hover:text-white lg:hidden" aria-label="Abrir menú" aria-expanded={menuOpen} aria-controls="mobile-menu">
            <Icon name="menu" size={20} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-line bg-navy/95 py-3 animate-fade-in">
          <div className="container-page">
            <SearchBar source="header" autoFocus onNavigate={() => setSearchOpen(false)} />
          </div>
        </div>
      )}

      {menuOpen && (
        <div id="mobile-menu" className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-navy/80 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm animate-slide-in-right flex-col border-l border-line bg-midnight">
            <div className="flex h-16 items-center justify-between px-4">
              <Logo size={20} />
              <button onClick={() => setMenuOpen(false)} className="grid h-10 w-10 place-items-center rounded-full text-gray hover:bg-raise" aria-label="Cerrar menú" autoFocus>
                <Icon name="x" />
              </button>
            </div>
            <nav aria-label="Principal móvil" className="flex flex-col gap-1 p-4">
              {[...NAV, { to: '/favoritos', label: 'Favoritos' }].map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => `flex items-center justify-between rounded-xl px-4 py-3.5 text-lg ${isActive ? 'bg-raise text-white' : 'text-gray'}`}>
                  {n.label}
                  {n.to === '/comparar' && count > 0 && <span className="font-mono text-sm text-cyan">{count}/3</span>}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto border-t border-line p-4">
              <Link to="/instituciones/partners" className="btn btn-primary w-full">Para instituciones</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
