import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CourseWithInstitution } from '../../types';
import { differs, durationHighlights, priceHighlights, ratingHighlights, startHighlights, type Highlight } from '../../utils/compare';
import { convert, effectivePrice, formatDate, formatMoney, formatWeeks } from '../../utils/format';
import { CERTIFICATE_LABELS, LEVEL_LABELS, MODALITY_LABELS, PROGRAM_TYPE_LABELS } from '../../utils/labels';
import { useLeadModal } from '../../context/LeadModalContext';
import { InstitutionLogo } from '../institution/InstitutionLogo';
import { Icon } from '../ui/Icon';
import { PriceDisplay } from '../ui/PriceDisplay';
import { Rating } from '../ui/Rating';
import { TypeBadge } from '../course/TypeBadge';

export const LETTERS = ['A', 'B', 'C', 'D'];

interface Row {
  key: string;
  label: string;
  render: (c: CourseWithInstitution) => ReactNode;
  value: (c: CourseWithInstitution) => unknown;
  highlights?: (cs: CourseWithInstitution[]) => Highlight[];
  bestLabel?: string;
}

const NA = <span className="text-sm text-dim">No publicado</span>;
const yes = (v: boolean | null, label: string) => (v ? label : null);

const ROWS: Row[] = [
  { key: 'institution', label: 'Institución', value: (c) => c.institution_id, render: (c) => <span className="text-white">{c.institution.name}<span className="block text-xs text-muted">{c.institution.type} · {c.institution.country}</span></span> },
  {
    key: 'type', label: 'Tipo de programa', value: (c) => c.program_type,
    render: (c) => <span><TypeBadge type={c.program_type} />{c.published_type && c.published_type.toLowerCase() !== PROGRAM_TYPE_LABELS[c.program_type].toLowerCase() && <span className="mt-1 block text-xs text-muted">La institución lo llama “{c.published_type}”</span>}</span>
  },
  {
    key: 'price', label: 'Precio', value: (c) => effectivePrice(c), highlights: priceHighlights, bestLabel: 'Más económico',
    render: (c) => {
      const p = effectivePrice(c);
      return (
        <div>
          <PriceDisplay course={c} size="sm" showFrom={false} />
          {p != null && c.currency === 'USD' && p > 0 && <p className="tnum text-xs text-muted">≈ {formatMoney(convert(p, 'USD', 'PEN'), 'PEN')}</p>}
          {p != null && p > 0 && c.duration_hours ? <p className="tnum text-xs text-muted">≈ {formatMoney(convert(p, c.currency, 'PEN') / c.duration_hours, 'PEN')} por hora</p> : null}
        </div>
      );
    }
  },
  {
    key: 'duration', label: 'Duración', value: (c) => c.duration_hours ?? c.duration_text, highlights: durationHighlights, bestLabel: 'Más horas',
    render: (c) =>
      c.duration_hours != null ? (
        <span><span className="tnum text-lg font-semibold text-white">{c.duration_hours} h</span><span className="block text-xs text-muted">{c.duration_weeks ? formatWeeks(c.duration_weeks) : c.duration_text && !/^\+?\s*\d+([.,]\d+)?\s*(h|hrs?|horas?)\.?$/i.test(c.duration_text.trim()) ? c.duration_text : ''}</span></span>
      ) : c.duration_text ? <span className="text-white">{c.duration_text}</span> : NA
  },
  { key: 'modality', label: 'Modalidad', value: (c) => c.modality, render: (c) => (c.modality ? <span className="text-white">{MODALITY_LABELS[c.modality]}{c.schedule && <span className="block text-xs text-muted">{c.schedule}</span>}</span> : NA) },
  { key: 'level', label: 'Nivel', value: (c) => c.level, render: (c) => (c.level ? <span className="text-white">{LEVEL_LABELS[c.level]}</span> : NA) },
  {
    key: 'certificate', label: 'Certificación', value: (c) => c.certificate?.type ?? null,
    render: (c) => (c.certificate ? <span><span className={c.certificate.type === 'internacional' ? 'text-cyan' : 'text-white'}>{CERTIFICATE_LABELS[c.certificate.type]}</span><span className="block text-xs text-muted">{c.certificate.description}</span></span> : NA)
  },
  { key: 'start', label: 'Fecha de inicio', value: (c) => c.start_date ?? c.start_text, highlights: startHighlights, bestLabel: 'Empieza antes', render: (c) => (c.start_date ? <span className="text-white">{formatDate(c.start_date, { day: 'numeric', month: 'long', year: 'numeric' })}</span> : <span className="text-gray">{c.start_text ?? (c.modality === 'grabado' ? 'A tu ritmo' : 'Por confirmar')}</span>) },
  {
    key: 'teacher', label: 'Docente', value: (c) => c.teachers.map((t) => t.name),
    render: (c) => (c.teachers.length ? <ul className="space-y-1.5">{c.teachers.slice(0, 3).map((t) => <li key={t.name}><span className="text-white">{t.name}</span>{t.profile && <span className="block line-clamp-2 text-xs text-muted">{t.profile}</span>}</li>)}{c.teachers.length > 3 && <li className="text-xs text-muted">+{c.teachers.length - 3} docentes más</li>}</ul> : NA)
  },
  {
    key: 'content', label: 'Contenido', value: (c) => c.syllabus.length,
    render: (c) =>
      c.syllabus.length ? (
        <div>
          <p className="text-sm text-white">{c.syllabus.length} {c.syllabus.length === 1 ? 'módulo' : 'módulos'}</p>
          <ul className="mt-1 space-y-0.5 text-xs text-gray">{c.syllabus.slice(0, 8).map((m, i) => <li key={i} className="flex gap-1.5"><span className="text-dim">·</span>{m.title}</li>)}</ul>
          {c.syllabus.length > 8 && <p className="mt-1 text-xs text-muted">+{c.syllabus.length - 8} más</p>}
        </div>
      ) : NA
  },
  { key: 'tools', label: 'Herramientas', value: (c) => c.tools, render: (c) => (c.tools.length ? <div className="flex flex-wrap gap-1">{c.tools.map((t) => <span key={t} className="rounded-md border border-line px-1.5 py-0.5 text-xs text-gray">{t}</span>)}</div> : NA) },
  {
    key: 'includes', label: 'Incluye', value: (c) => c.features,
    render: (c) => {
      const f = c.features;
      const items = [yes(f.live_classes, 'Clases en vivo'), yes(f.recorded_classes, 'Clases grabadas'), yes(f.final_project, 'Proyecto final'), yes(f.mentoring, 'Mentoría'), yes(f.lifetime_access, 'Acceso de por vida'), yes(f.job_board, 'Bolsa de trabajo'), yes(f.community, 'Comunidad')].filter(Boolean);
      return items.length ? <ul className="space-y-0.5 text-sm text-gray">{items.map((i) => <li key={i} className="flex items-center gap-1.5"><Icon name="check" size={13} className="text-pos" />{i}</li>)}</ul> : NA;
    }
  },
  { key: 'requirements', label: 'Requisitos', value: (c) => c.requirements, render: (c) => (c.requirements.length ? <ul className="space-y-0.5 text-sm text-gray">{c.requirements.slice(0, 5).map((r) => <li key={r}>{r}</li>)}</ul> : NA) },
  {
    key: 'financing', label: 'Financiamiento', value: (c) => c.financing.installments,
    render: (c) => (
      <span className="text-sm">
        {c.financing.installments ? (
          <span className="text-white">{c.financing.installments} cuotas{c.financing.installment_amount ? ` de ${formatMoney(c.financing.installment_amount, c.currency)}` : ''}</span>
        ) : (
          <span className="text-gray">{effectivePrice(c) === 0 ? 'No aplica' : 'No publicado'}</span>
        )}
        {c.financing.notes && <span className="block text-xs text-muted">{c.financing.notes}</span>}
      </span>
    )
  },
  { key: 'rating', label: 'Valoración', value: (c) => c.rating, highlights: ratingHighlights, bestLabel: 'Mejor valorado', render: (c) => (c.rating != null ? <Rating value={c.rating} count={c.reviews_count ?? undefined} /> : NA) }
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
  const rows = ROWS.filter((r) => courses.some((c) => r.value(c) != null && !(Array.isArray(r.value(c)) && (r.value(c) as unknown[]).length === 0))).filter((r) => !onlyDiff || differs(courses, r.value));
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
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line md:block">
        <table className={`w-full table-fixed border-collapse text-left ${cols === 4 ? 'min-w-[920px]' : ''}`}>
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
          <ul className={`grid gap-2 ${cols === 4 ? 'grid-cols-4' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
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
