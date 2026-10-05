import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '../../hooks/useCatalog';
import { useDebounce } from '../../hooks/useDebounce';
import { getSuggestions } from '../../services/catalogService';
import type { Suggestion } from '../../utils/search';
import { Icon, type IconName } from '../ui/Icon';

export const POPULAR_SEARCHES = ['Data Analytics', 'Inteligencia Artificial', 'Power BI', 'Python', 'Data Science'];

const KIND_ICON: Record<Suggestion['kind'], IconName> = {
  categoria: 'layers',
  programa: 'book',
  institucion: 'building',
  herramienta: 'tool',
  busqueda: 'search'
};

interface Props {
  size?: 'hero' | 'compact';
  initialValue?: string;
  source: 'home' | 'header' | 'listado';
  autoFocus?: boolean;
  onNavigate?: () => void;
  className?: string;
}

/** Buscador con autocompletado accesible (patrón combobox ARIA 1.2). */
export function SearchBar({ size = 'compact', initialValue = '', source, autoFocus, onNavigate, className = '' }: Props) {
  const navigate = useNavigate();
  const { catalog } = useCatalog();
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounced = useDebounce(value, 90);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLFormElement>(null);

  useEffect(() => setValue(initialValue), [initialValue]);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!catalog) return [];
    if (debounced.trim().length < 2) {
      return POPULAR_SEARCHES.map((s) => ({ kind: 'busqueda' as const, label: s, value: s, hint: 'Popular' }));
    }
    const list = getSuggestions(catalog, debounced);
    return [{ kind: 'busqueda' as const, label: `Buscar “${debounced.trim()}”`, value: debounced.trim() }, ...list];
  }, [catalog, debounced]);

  useEffect(() => setActive(-1), [debounced]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const goSearch = (q: string) => {
    const query = q.trim();
    setOpen(false);
    inputRef.current?.blur();
    onNavigate?.();
    navigate(query ? `/programas?q=${encodeURIComponent(query)}` : '/programas', { state: { searchSource: source } });
  };

  const choose = (s: Suggestion) => {
    setOpen(false);
    onNavigate?.();
    switch (s.kind) {
      case 'categoria': navigate(`/programas/${s.value}`, { state: { searchSource: source } }); break;
      case 'programa': navigate(`/programa/${s.value}`); break;
      case 'institucion': navigate(`/institucion/${s.value}`); break;
      default: setValue(s.value); goSearch(s.value);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (open && active >= 0 && suggestions[active]) choose(suggestions[active]);
    else goSearch(value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  };

  const hero = size === 'hero';
  const showList = open && suggestions.length > 0;

  return (
    <form ref={rootRef} role="search" onSubmit={onSubmit} className={`relative ${className}`}>
      <div
        className={`flex items-center gap-2 border bg-midnight transition-colors focus-within:border-blue ${
          hero ? 'rounded-[20px] border-line-strong p-2 pl-5 shadow-[0_30px_80px_-30px_rgba(36,107,254,.55)]' : 'rounded-full border-line-strong py-1 pl-4 pr-1'
        }`}
      >
        <Icon name="search" size={hero ? 22 : 18} className="shrink-0 text-gray" />
        <label htmlFor={`${listId}-input`} className="sr-only">¿Qué quieres aprender?</label>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          enterKeyHint="search"
          placeholder="¿Qué quieres aprender?"
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={`min-w-0 flex-1 bg-transparent text-white placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden ${hero ? 'h-12 text-base sm:text-lg' : 'h-9 text-[15px]'}`}
        />
        {value && (
          <button type="button" onClick={() => { setValue(''); inputRef.current?.focus(); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:text-white" aria-label="Borrar búsqueda">
            <Icon name="x" size={16} />
          </button>
        )}
        <button type="submit" className={`btn btn-accent shrink-0 ${hero ? 'btn-lg rounded-[14px] px-4 sm:px-6' : 'btn-sm'}`}>
          {hero ? <><span className="hidden sm:inline">Buscar programas</span><span className="sm:hidden">Buscar</span></> : <span className="sr-only sm:not-sr-only">Buscar</span>}
          {!hero && <Icon name="arrow-right" size={16} className="sm:hidden" />}
        </button>
      </div>

      {showList && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          aria-label="Sugerencias"
          className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-[60vh] animate-fade-in overflow-y-auto rounded-2xl border border-line-strong bg-midnight p-2 text-left shadow-2xl"
        >
          {debounced.trim().length < 2 && <li className="label-mono px-3 pb-1 pt-2" role="presentation">Búsquedas populares</li>}
          {suggestions.map((s, i) => (
            <li
              key={`${s.kind}-${s.value}-${i}`}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${i === active ? 'bg-raise text-white' : 'text-gray'}`}
            >
              <Icon name={KIND_ICON[s.kind]} size={16} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              {s.hint && <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim">{s.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
