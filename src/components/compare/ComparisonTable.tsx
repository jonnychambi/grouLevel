import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CourseWithInstitution } from '../../types';
import { differs, priceHighlights, ratingHighlights, startHighlights, type Highlight } from '../../utils/compare';
import { convert, effectivePrice, formatDate, formatMoney, formatWeeks } from '../../utils/format';
import { CERTIFICATE_LABELS, LEVEL_LABELS, MODALITY_LABELS, PROGRAM_TYPE_LABELS } from '../../utils/labels';
import { useLeadModal } from '../../context/LeadModalContext';
import { InstitutionLogo } from '../institution/InstitutionLogo';
import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { PriceDisplay } from '../ui/PriceDisplay';
import { Rating } from '../ui/Rating';

export const LETTERS = ['A', 'B', 'C'];

interface Row {
  key: string;
  label: string;
  render: (c: CourseWithInstitution) => ReactNode;
  value: (c: CourseWithInstitution) => unknown;
  highlights?: (cs: CourseWithInstitution[]) => Highlight[];
  bestLabel?: string;
}

const ROWS: Row[] = [
  { key: 'institution', label: 'Institución', value: (c) => c.institution_id, render: (c) => <span className="text-white">{c.institution.name}<span className="block text-xs text-muted">{c.institution.type} · {c.institution.city}</span></span> },
  { key: 'type', label: 'Tipo de programa', value: (c) => c.program_type, render: (c) => <Badge tone="type" mono>{PROGRAM_TYPE_LABELS[c.program_type]}</Badge> },
  {
    key: 'price', label: 'Precio', value: (c) => effectivePrice(c), highlights: priceHighlights, bestLabel: 'Más económico',
    render: (c) => (
      <div>
        <PriceDisplay course={c} size="sm" showFrom={false} />
        {c.currency === 'USD' && effectivePrice(c) > 0 && <p className="tnum text-xs text-muted">≈ {formatMoney(convert(effectivePrice(c), 'USD', 'PEN'), 'PEN')}</p>}
        {effectivePrice(c) > 0 && <p className="tnum text-xs text-muted">≈ {formatMoney(convert(effectivePrice(c), c.currency, 'PEN') / c.duration_hours, 'PEN')} por hora</p>}
      </div>
    )
  },
  {
    key: 'duration', label: 'Duración', value: (c) => c.duration_hours,
    render: (c) => <span><span className="tnum text-lg font-semibold text-white">{c.duration_hours} h</span><span className="block text-xs text-muted">{formatWeeks(c.duration_weeks)}</span></span>
  },
  { key: 'modality', label: 'Modalidad', value: (c) => c.modality, render: (c) => <span className="text-white">{MODALITY_LABELS[c.modality]}<span className="block text-xs text-muted">{c.schedule}</span></span> },
  { key: 'level', label: 'Nivel', value: (c) => c.level, render: (c) => <span className="text-white">{LEVEL_LABELS[c.level]}</span> },
  {
    key: 'certificate', label: 'Certificación', value: (c) => c.certificate.type,
    render: (c) => <span><span className={c.certificate.type === 'internacional' ? 'text-cyan' : 'text-white'}>{CERTIFICATE_LABELS[c.certificate.type]}</span><span className="block text-xs text-muted">{c.certificate.description}</span></span>
  },
  { key: 'start', label: 'Fecha de inicio', value: (c) => c.start_date, highlights: startHighlights, bestLabel: 'Empieza antes', render: (c) => <span className="text-white">{formatDate(c.start_date, { day: 'numeric', month: 'long', year: 'numeric' })}</span> },
  {
    key: 'teacher', label: 'Docente', value: (c) => c.teachers.map((t) => t.name),
    render: (c) => <ul className="space-y-1.5">{c.teachers.map((t) => <li key={t.name}><span className="text-white">{t.name}</span><span className="block text-xs text-muted">{t.role} · {t.company}</span></li>)}</ul>
  },
  {
    key: 'content', label: 'Contenido', value: (c) => c.syllabus.length,
    render: (c) => (
      <div>
        <p className="text-sm text-white">{c.syllabus.length} módulos</p>
        <ul className="mt-1 space-y-0.5 text-xs text-gray">{c.syllabus.map((m) => <li key={m.title} className="flex gap-1.5"><span className="text-dim">·</span>{m.title}</li>)}</ul>
      </div>
    )
  },
  { key: 'tools', label: 'Herramientas', value: (c) => c.tools, render: (c) => <div className="flex flex-wrap gap-1">{c.tools.map((t) => <span key={t} className="rounded-md border border-line px-1.5 py-0.5 text-xs text-gray">{t}</span>)}</div> },
  { key: 'requirements', label: 'Requisitos', value: (c) => c.requirements, render: (c) => <ul className="space-y-0.5 text-sm text-gray">{c.requirements.map((r) => <li key={r}>{r}</li>)}</ul> },
  {
    key: 'financing', label: 'Financiamiento', value: (c) => c.financing.installments,
    render: (c) => (
      <span className="text-sm">
        {c.financing.installments ? <span className="text-white">{c.financing.installments} cuotas de {formatMoney(c.financing.installment_amount ?? 0, c.currency)}</span> : <span className="text-gray">{effectivePrice(c) === 0 ? 'No aplica' : 'Pago único'}</span>}
        <span className="block text-xs text-muted">{c.financing.notes}</span>
      </span>
    )
  },
  { key: 'rating', label: 'Valoración', value: (c) => c.rating, highlights: ratingHighlights, bestLabel: 'Mejor valorado', render: (c) => <Rating value={c.rating} count={c.reviews_count} /> }
];

function HighlightTag({ h, label }: { h: Highlight; label?: string }) {
  if (h !== 'best' || !label) return null;
  return <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-pos/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-pos"><Icon name="check" size={11} strokeWidth={3} />{label}</span>;
}

interface Props { courses: CourseWithInstitution[]; onRemove: (id: string) => void }

/** Comparador: tabla en desktop y bloques por atributo en mobile (sin scroll horizontal). */
export function ComparisonTable({ courses, onRemove }: Props) {
  const openLead = useLeadModal();
  const [onlyDiff, setOnlyDiff] = useState(false);
  const rows = ROWS.filter((r) => !onlyDiff || differs(courses, r.value));
  const cols = courses.length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-gray">
          <input type="checkbox" className="peer sr-only" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
          <span aria-hidden="true" className={`relative h-6 w-11 rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-cyan ${onlyDiff ? 'border-cyan bg-cyan/20' : 'border-line-strong bg-navy'}`}>
            <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all ${onlyDiff ? 'left-[22px] bg-cyan' : 'left-0.5 bg-gray'}`} />
          </span>
          Mostrar solo diferencias
        </label>
        <p className="hidden items-center gap-1.5 text-xs text-muted sm:flex"><span className="h-2 w-2 rounded-full bg-violet" /> Fila con diferencias</p>
      </div>

      {/* Desktop / tablet ancha */}
      <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-line md:block">
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">Comparación de {cols} programas</caption>
          <colgroup>
            <col className="w-44 lg:w-52" />
            {courses.map((c) => <col key={c.id} />)}
          </colgroup>
          <thead>
            <tr className="bg-midnight align-top">
              <th scope="col" className="p-4"><span className="label-mono">Programa</span></th>
              {courses.map((c, i) => (
                <th key={c.id} scope="col" className="border-l border-line p-4 font-normal">
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full border border-line-strong font-mono text-xs text-cyan">{LETTERS[i]}</span>
                    <button onClick={() => onRemove(c.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-raise hover:text-white" aria-label={`Quitar ${c.name} de la comparación`}>
                      <Icon name="x" size={15} />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2.5">
                    <InstitutionLogo institution={c.institution} size={36} />
                    <Link to={`/programa/${c.slug}`} className="text-base font-semibold leading-snug tracking-tight text-white hover:text-cyan">{c.name}</Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hl = row.highlights?.(courses) ?? courses.map(() => null);
              const isDiff = differs(courses, row.value);
              return (
                <tr key={row.key} className="border-t border-line align-top">
                  <th scope="row" className="bg-midnight/60 p-4 text-sm font-medium text-gray">
                    <span className="flex items-center gap-2">{isDiff && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet" aria-label="Difiere" />}{row.label}</span>
                  </th>
                  {courses.map((c, i) => (
                    <td key={c.id} className={`border-l border-line p-4 text-sm ${hl[i] === 'best' ? 'bg-pos/[0.04]' : ''}`}>
                      <HighlightTag h={hl[i]} label={row.bestLabel} />
                      {row.render(c)}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="border-t border-line align-top">
              <th scope="row" className="bg-midnight/60 p-4 text-sm font-medium text-gray">¿Te interesa?</th>
              {courses.map((c) => (
                <td key={c.id} className="border-l border-line p-4">
                  <button onClick={() => openLead(c, 'comparador')} className="btn btn-accent btn-sm w-full whitespace-normal py-2 leading-tight">Quiero información de este programa</button>
                  <Link to={`/programa/${c.slug}`} className="mt-2 block text-center text-sm text-blue-soft hover:text-white">Ver detalle</Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile: comparación por bloques */}
      <div className="md:hidden">
        <div className="sticky top-16 z-20 -mx-4 mb-4 border-b border-line bg-navy/95 px-4 py-3 backdrop-blur">
          <ul className={`grid gap-2 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {courses.map((c, i) => (
              <li key={c.id} className="relative min-w-0 rounded-xl border border-line bg-midnight p-2">
                <span className="font-mono text-xs text-cyan">{LETTERS[i]}</span>
                <p className="line-clamp-2 text-xs font-medium leading-tight text-white">{c.name}</p>
                <button onClick={() => onRemove(c.id)} className="absolute right-0.5 top-0.5 grid h-7 w-7 place-items-center text-muted" aria-label={`Quitar ${c.name}`}><Icon name="x" size={12} /></button>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          {rows.map((row) => {
            const hl = row.highlights?.(courses) ?? courses.map(() => null);
            return (
              <section key={row.key} className="card p-4" aria-label={row.label}>
                <h3 className="label-mono mb-3 flex items-center gap-2">{differs(courses, row.value) && <span className="h-1.5 w-1.5 rounded-full bg-violet" />}{row.label}</h3>
                <ul className="divide-y divide-line">
                  {courses.map((c, i) => (
                    <li key={c.id} className={`flex gap-3 py-2.5 first:pt-0 last:pb-0 ${hl[i] === 'best' ? '' : ''}`}>
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line-strong font-mono text-[11px] text-cyan">{LETTERS[i]}</span>
                      <div className="min-w-0 flex-1 text-sm">
                        <HighlightTag h={hl[i]} label={row.bestLabel} />
                        {row.render(c)}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <section className="card p-4">
            <h3 className="label-mono mb-3">Solicitar información</h3>
            <div className="space-y-2">
              {courses.map((c, i) => (
                <button key={c.id} onClick={() => openLead(c, 'comparador')} className="btn btn-accent w-full justify-start whitespace-normal py-2.5 text-left leading-tight">
                  <span className="font-mono text-xs opacity-80">{LETTERS[i]}</span> Quiero información de {c.name}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
