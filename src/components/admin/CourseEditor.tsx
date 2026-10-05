import { useMemo, useState, type FormEvent } from 'react';
import type { Category, CertificateType, Course, CourseStatus, Currency, Institution, Level, Modality, ProgramType, SyllabusModule, Teacher } from '../../types';
import { completeness, missingFields } from '../../utils/completeness';
import { CERTIFICATE_LABELS, LEVEL_LABELS, MODALITY_LABELS, PROGRAM_TYPE_LABELS } from '../../utils/labels';
import { slugify } from '../../utils/text';
import { Icon } from '../ui/Icon';
import { Fieldset, LinesInput, NullableText, NumberInput, Select, TextArea, TextInput, TriState } from './fields';

const opts = <T extends string>(labels: Record<T, string>) => (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));

export const STATUS_LABELS: Record<CourseStatus, string> = { publicado: 'Publicado', borrador: 'Borrador', oculto: 'Oculto' };

export function emptyCourse(institutionId: string, category: string, existingIds: Set<string>): Course {
  let n = 1;
  while (existingIds.has(`crs-n${String(n).padStart(3, '0')}`)) n++;
  return {
    id: `crs-n${String(n).padStart(3, '0')}`, slug: '', name: '', institution_id: institutionId, category, subcategory: null,
    program_type: 'curso', published_type: null, description: '', short_description: '', objectives: [], target_audience: null,
    price: null, currency: 'PEN', discount_price: null, duration_hours: null, duration_weeks: null, duration_text: null,
    modality: null, schedule: null, level: null, start_date: null, start_text: null, certificate: null, teachers: [], tools: [],
    skills: [], syllabus: [], requirements: [], platform: null, language: 'Español', country: 'Perú', image: null, url: '',
    featured: false, rating: null, reviews_count: null, keywords: [], status: 'borrador', completeness: 0,
    updated_at: new Date().toISOString().slice(0, 10), is_demo: false,
    financing: { installments: null, installment_amount: null, methods: [], notes: '' },
    features: { live_classes: null, recorded_classes: null, final_project: null, mentoring: null, lifetime_access: null, job_board: null, community: null, enrollment_open: null }
  };
}

interface Props {
  course: Course;
  isNew: boolean;
  institutions: Institution[];
  categories: Category[];
  takenSlugs: Set<string>;
  saving: boolean;
  onSave: (course: Course) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

/** Limpia la entrada antes de guardar: recorta textos, quita líneas vacías, recalcula completitud. */
function normalize(c: Course): Course {
  const lines = (a: string[]) => a.map((x) => x.trim()).filter(Boolean);
  const out: Course = {
    ...c,
    name: c.name.trim(),
    slug: c.slug.trim(),
    short_description: c.short_description.trim(),
    description: c.description.trim() || c.short_description.trim(),
    objectives: lines(c.objectives),
    requirements: lines(c.requirements),
    keywords: lines(c.keywords),
    tools: lines(c.tools),
    syllabus: c.syllabus.filter((m) => m.title.trim()).map((m) => ({ ...m, title: m.title.trim(), description: m.description.trim() })),
    teachers: c.teachers.filter((t) => t.name.trim()).map((t) => ({ ...t, name: t.name.trim(), profile: t.profile.trim(), linkedin: t.linkedin?.trim() || null })),
    financing: { ...c.financing, methods: lines(c.financing.methods), notes: c.financing.notes.trim() },
    discount_price: c.price == null ? null : c.discount_price,
    updated_at: new Date().toISOString().slice(0, 10)
  };
  return { ...out, completeness: completeness(out) };
}

export function CourseEditor({ course, isNew, institutions, categories, takenSlugs, saving, onSave, onCancel, onDelete }: Props) {
  const [c, setC] = useState<Course>(course);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const set = <K extends keyof Course>(k: K, v: Course[K]) => setC((prev) => ({ ...prev, [k]: v }));

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!c.name.trim()) e.push('El nombre es obligatorio.');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.slug)) e.push('El slug solo puede tener minúsculas, números y guiones.');
    else if (takenSlugs.has(c.slug)) e.push('Ya existe otro programa con ese slug.');
    if (!c.short_description.trim()) e.push('La descripción corta es obligatoria.');
    if (c.url && !/^https?:\/\//.test(c.url)) e.push('La URL oficial debe empezar con http:// o https://');
    if (c.price != null && c.discount_price != null && c.discount_price > c.price) e.push('El precio promocional no puede ser mayor al regular.');
    return e;
  }, [c, takenSlugs]);

  const missing = missingFields(c);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (errors.length) return;
    onSave(normalize(c));
  };

  const setModule = (i: number, patch: Partial<SyllabusModule>) => set('syllabus', c.syllabus.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const moveModule = (i: number, dir: -1 | 1) => {
    const arr = [...c.syllabus];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set('syllabus', arr);
  };
  const setTeacher = (i: number, patch: Partial<Teacher>) => set('teachers', c.teachers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const setFeature = (k: keyof Course['features'], v: boolean | null) => set('features', { ...c.features, [k]: v });

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-midnight p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{isNew ? 'Nuevo programa' : `Editando · ${c.id}`}</p>
          <h2 className="truncate text-xl text-white">{c.name || 'Sin nombre'}</h2>
        </div>
        <span className="tnum rounded-full border border-line-strong px-3 py-1 text-xs text-gray" title={missing.length ? `Falta: ${missing.join(', ')}` : 'Todos los campos clave completos'}>
          Completitud {Math.round(completeness(c) * 100)}%
        </span>
        <Select<CourseStatus> title="Estado" value={c.status} options={opts(STATUS_LABELS)} onChange={(v) => v && set('status', v)} className="w-36 [&>label]:sr-only" />
      </div>
      {missing.length > 0 && <p className="text-xs text-muted">Campos clave sin información: {missing.join(' · ')}. Se mostrarán como “No publicado”.</p>}

      <Fieldset title="Datos principales">
        <TextInput title="Nombre del programa" required value={c.name} onChange={(v) => setC((p) => ({ ...p, name: v, slug: slugTouched ? p.slug : slugify(v) }))} className="sm:col-span-2" />
        <TextInput title="Slug (URL)" required value={c.slug} hint={`/programa/${c.slug || '…'}`} onChange={(v) => { setSlugTouched(true); set('slug', slugify(v) || v.toLowerCase()); }} />
        <TextInput title="URL oficial del programa" value={c.url} placeholder="https://…" onChange={(v) => set('url', v.trim())} />
        <Select title="Institución" value={c.institution_id} options={institutions.map((i) => ({ value: i.id, label: i.name }))} onChange={(v) => v && set('institution_id', v)} />
        <Select title="Categoría" value={c.category} options={categories.map((x) => ({ value: x.id, label: x.name }))} onChange={(v) => v && set('category', v)} />
        <Select<ProgramType> title="Tipo de programa" value={c.program_type} options={opts(PROGRAM_TYPE_LABELS)} onChange={(v) => v && set('program_type', v)} />
        <NullableText title="Denominación de la institución" value={c.published_type} hint="Ej. Carrera, Taller, Ruta" onChange={(v) => set('published_type', v)} />
        <NullableText title="Subárea" value={c.subcategory} onChange={(v) => set('subcategory', v)} />
        <label className="flex items-center gap-2 self-end text-sm text-gray">
          <input type="checkbox" checked={c.featured} onChange={(e) => set('featured', e.target.checked)} className="h-4 w-4 accent-[#7657FF]" />
          Destacado (listing patrocinado)
        </label>
      </Fieldset>

      <Fieldset title="Descripción">
        <TextArea title="Descripción corta *" rows={2} value={c.short_description} onChange={(v) => set('short_description', v)} hint={`${c.short_description.length}/200 caracteres recomendados`} className="sm:col-span-2" />
        <TextArea title="Descripción completa" rows={4} value={c.description} onChange={(v) => set('description', v)} hint="Si se deja vacía se usa la descripción corta." className="sm:col-span-2" />
        <LinesInput title="Lo que aprenderás" value={c.objectives} onChange={(v) => set('objectives', v)} />
        <TextArea title="¿Para quién es?" rows={4} value={c.target_audience ?? ''} onChange={(v) => set('target_audience', v.trim() ? v : null)} />
        <LinesInput title="Requisitos" value={c.requirements} onChange={(v) => set('requirements', v)} />
        <LinesInput title="Palabras clave de búsqueda" value={c.keywords} onChange={(v) => set('keywords', v)} hint="Un término por línea (ayudan al buscador)." />
      </Fieldset>

      <Fieldset title="Precio y financiamiento" description="Deja vacío lo que la institución no publique: el sitio mostrará “Precio a consultar”.">
        <NumberInput title="Precio regular" value={c.price} onChange={(v) => set('price', v)} hint="0 = gratis" />
        <NumberInput title="Precio promocional" value={c.discount_price} onChange={(v) => set('discount_price', v)} />
        <Select<Currency> title="Moneda" value={c.currency} options={[{ value: 'PEN', label: 'Soles (PEN)' }, { value: 'USD', label: 'Dólares (USD)' }]} onChange={(v) => v && set('currency', v)} />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput title="N.º de cuotas" step="1" value={c.financing.installments} onChange={(v) => set('financing', { ...c.financing, installments: v })} />
          <NumberInput title="Monto por cuota" value={c.financing.installment_amount} onChange={(v) => set('financing', { ...c.financing, installment_amount: v })} />
        </div>
        <TextInput title="Notas de financiamiento" value={c.financing.notes} onChange={(v) => set('financing', { ...c.financing, notes: v })} />
        <LinesInput title="Medios de pago" rows={2} value={c.financing.methods} onChange={(v) => set('financing', { ...c.financing, methods: v })} />
      </Fieldset>

      <Fieldset title="Duración, modalidad e inicio">
        <div className="grid grid-cols-2 gap-3">
          <NumberInput title="Horas totales" value={c.duration_hours} onChange={(v) => set('duration_hours', v)} />
          <NumberInput title="Semanas" step="1" value={c.duration_weeks} onChange={(v) => set('duration_weeks', v)} />
        </div>
        <NullableText title="Duración (texto publicado)" value={c.duration_text} placeholder="Ej. 4 meses" onChange={(v) => set('duration_text', v)} />
        <Select<Modality> title="Modalidad" value={c.modality} allowEmpty options={opts(MODALITY_LABELS)} onChange={(v) => set('modality', v)} />
        <Select<Level> title="Nivel" value={c.level} allowEmpty emptyLabel="No indicado" options={opts(LEVEL_LABELS)} onChange={(v) => set('level', v)} />
        <TextInput title="Fecha de inicio" type="date" value={c.start_date} onChange={(v) => set('start_date', v || null)} />
        <NullableText title="Inicio (texto publicado)" value={c.start_text} placeholder="Ej. Inicios mensuales" onChange={(v) => set('start_text', v)} />
        <NullableText title="Horario y frecuencia" value={c.schedule} placeholder="Lunes y miércoles · 7:00–10:00 p. m." onChange={(v) => set('schedule', v)} className="sm:col-span-2" />
        <TextInput title="Idioma" value={c.language} onChange={(v) => set('language', v)} />
        <NullableText title="Plataforma" value={c.platform} onChange={(v) => set('platform', v)} />
      </Fieldset>

      <Fieldset title="Certificación">
        <Select<CertificateType>
          title="Tipo"
          value={c.certificate?.type ?? null}
          allowEmpty
          options={opts(CERTIFICATE_LABELS)}
          onChange={(v) => set('certificate', v ? { type: v, description: c.certificate?.description ?? '' } : null)}
        />
        <TextInput title="Descripción del certificado" value={c.certificate?.description ?? ''} onChange={(v) => c.certificate && set('certificate', { ...c.certificate, description: v })} />
      </Fieldset>

      <Fieldset title="Incluye" description="Sí / No / — (no especificado por la institución).">
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <TriState title="Clases en vivo" value={c.features.live_classes} onChange={(v) => setFeature('live_classes', v)} />
          <TriState title="Clases grabadas" value={c.features.recorded_classes} onChange={(v) => setFeature('recorded_classes', v)} />
          <TriState title="Proyecto final" value={c.features.final_project} onChange={(v) => setFeature('final_project', v)} />
          <TriState title="Mentoría" value={c.features.mentoring} onChange={(v) => setFeature('mentoring', v)} />
          <TriState title="Acceso de por vida" value={c.features.lifetime_access} onChange={(v) => setFeature('lifetime_access', v)} />
          <TriState title="Bolsa de trabajo" value={c.features.job_board} onChange={(v) => setFeature('job_board', v)} />
          <TriState title="Comunidad" value={c.features.community} onChange={(v) => setFeature('community', v)} />
          <TriState title="Inscripciones abiertas" value={c.features.enrollment_open} onChange={(v) => setFeature('enrollment_open', v)} />
        </div>
      </Fieldset>

      <Fieldset title="Herramientas">
        <TextInput
          title="Herramientas y tecnologías"
          className="sm:col-span-2"
          hint="Separadas por coma. Ej. Python, SQL, Power BI"
          value={c.tools.join(', ')}
          onChange={(v) => set('tools', v.split(',').map((x) => x.trimStart()))}
        />
      </Fieldset>

      <fieldset className="rounded-2xl border border-line bg-navy/40 p-4 sm:p-5">
        <legend className="px-1 text-sm font-semibold text-white">Contenido ({c.syllabus.length} módulos)</legend>
        <ol className="space-y-2">
          {c.syllabus.map((m, i) => (
            <li key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[2rem_1fr_6rem_auto] sm:items-start">
              <span className="pt-2 font-mono text-xs text-cyan">{i + 1}</span>
              <div className="space-y-2">
                <input aria-label={`Título del módulo ${i + 1}`} className="input min-h-9 py-1.5 text-sm" placeholder="Título del módulo" value={m.title} onChange={(e) => setModule(i, { title: e.target.value })} />
                <input aria-label={`Descripción del módulo ${i + 1}`} className="input min-h-9 py-1.5 text-sm" placeholder="Descripción (opcional)" value={m.description} onChange={(e) => setModule(i, { description: e.target.value })} />
              </div>
              <input aria-label={`Horas del módulo ${i + 1}`} type="number" min={0} className="input min-h-9 py-1.5 text-sm" placeholder="Horas" value={m.hours ?? ''} onChange={(e) => setModule(i, { hours: e.target.value === '' ? null : Number(e.target.value) })} />
              <div className="flex gap-1">
                <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-gray hover:bg-raise disabled:opacity-30" onClick={() => moveModule(i, -1)} disabled={i === 0} aria-label="Subir módulo"><Icon name="chevron-up" size={16} /></button>
                <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-gray hover:bg-raise disabled:opacity-30" onClick={() => moveModule(i, 1)} disabled={i === c.syllabus.length - 1} aria-label="Bajar módulo"><Icon name="chevron-down" size={16} /></button>
                <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-neg hover:bg-raise" onClick={() => set('syllabus', c.syllabus.filter((_, j) => j !== i))} aria-label="Eliminar módulo"><Icon name="trash" size={16} /></button>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => set('syllabus', [...c.syllabus, { title: '', description: '', hours: null, topics: [] }])}>
          <Icon name="plus" size={15} /> Agregar módulo
        </button>
      </fieldset>

      <fieldset className="rounded-2xl border border-line bg-navy/40 p-4 sm:p-5">
        <legend className="px-1 text-sm font-semibold text-white">Docentes ({c.teachers.length})</legend>
        <ul className="space-y-2">
          {c.teachers.map((t, i) => (
            <li key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_2fr_auto]">
              <input aria-label="Nombre del docente" className="input min-h-9 py-1.5 text-sm" placeholder="Nombre" value={t.name} onChange={(e) => setTeacher(i, { name: e.target.value })} />
              <div className="space-y-2">
                <input aria-label="Perfil del docente" className="input min-h-9 py-1.5 text-sm" placeholder="Cargo, empresa, experiencia" value={t.profile} onChange={(e) => setTeacher(i, { profile: e.target.value })} />
                <input aria-label="LinkedIn del docente" className="input min-h-9 py-1.5 text-sm" placeholder="https://linkedin.com/in/… (opcional)" value={t.linkedin ?? ''} onChange={(e) => setTeacher(i, { linkedin: e.target.value || null })} />
              </div>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-neg hover:bg-raise" onClick={() => set('teachers', c.teachers.filter((_, j) => j !== i))} aria-label="Eliminar docente"><Icon name="trash" size={16} /></button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => set('teachers', [...c.teachers, { name: '', profile: '', linkedin: null }])}>
          <Icon name="plus" size={15} /> Agregar docente
        </button>
      </fieldset>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl border border-neg/40 bg-neg/10 p-3 text-sm text-white">
          {errors.map((e) => <li key={e} className="flex gap-2"><Icon name="alert" size={15} className="mt-0.5 text-neg" />{e}</li>)}
        </ul>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-navy/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <button type="submit" className="btn btn-accent" disabled={saving || errors.length > 0}>{saving ? 'Guardando…' : isNew ? 'Crear programa' : 'Guardar cambios'}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancelar</button>
        {onDelete && <button type="button" className="btn btn-quiet ml-auto text-neg" onClick={onDelete} disabled={saving}><Icon name="trash" size={15} /> Eliminar</button>}
      </div>
    </form>
  );
}
