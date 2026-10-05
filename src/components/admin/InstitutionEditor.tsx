import { useState, type FormEvent } from 'react';
import type { Institution } from '../../types';
import { slugify } from '../../utils/text';
import { InstitutionLogo } from '../institution/InstitutionLogo';
import { Icon } from '../ui/Icon';
import { Fieldset, NumberInput, TextArea, TextInput } from './fields';

export function emptyInstitution(): Institution {
  return { id: '', slug: '', name: '', short_name: '', type: 'Academia especializada', country: 'Perú', city: 'Perú', founded: null, brand_color: '#246BFE', description: '', website: '', accreditations: [], logo: null, is_demo: false };
}

interface Props {
  institution: Institution;
  isNew: boolean;
  takenSlugs: Set<string>;
  programs: number;
  saving: boolean;
  onSave: (i: Institution) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function InstitutionEditor({ institution, isNew, takenSlugs, programs, saving, onSave, onCancel, onDelete }: Props) {
  const [i, setI] = useState(institution);
  const set = <K extends keyof Institution>(k: K, v: Institution[K]) => setI((p) => ({ ...p, [k]: v }));
  const errors: string[] = [];
  if (!i.name.trim()) errors.push('El nombre es obligatorio.');
  if (!i.short_name.trim()) errors.push('El nombre corto es obligatorio (se usa en el monograma).');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(i.slug)) errors.push('Slug inválido.');
  else if (takenSlugs.has(i.slug)) errors.push('Ya existe otra institución con ese slug.');
  if (i.website && !/^https?:\/\//.test(i.website)) errors.push('La web debe empezar con http:// o https://');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (errors.length) return;
    onSave({ ...i, id: i.id || `inst-${i.slug}`, name: i.name.trim(), short_name: i.short_name.trim(), description: i.description.trim() });
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-midnight p-4">
        <InstitutionLogo institution={{ ...i, short_name: i.short_name || '?' }} size={48} />
        <div>
          <p className="text-xs text-muted">{isNew ? 'Nueva institución' : `${programs} programas`}</p>
          <h2 className="text-xl text-white">{i.name || 'Sin nombre'}</h2>
        </div>
      </div>
      <Fieldset title="Datos de la institución">
        <TextInput title="Nombre" required value={i.name} onChange={(v) => setI((p) => ({ ...p, name: v, slug: isNew ? slugify(v) : p.slug }))} className="sm:col-span-2" />
        <TextInput title="Nombre corto" required value={i.short_name} hint="Máx. 3 letras se muestran completas en el monograma" onChange={(v) => set('short_name', v)} />
        <TextInput title="Slug (URL)" required value={i.slug} hint={`/institucion/${i.slug || '…'}`} onChange={(v) => set('slug', slugify(v))} />
        <TextInput title="Tipo" value={i.type} hint="Universidad, Instituto, Bootcamp…" onChange={(v) => set('type', v)} />
        <TextInput title="Sitio web" value={i.website} placeholder="https://…" onChange={(v) => set('website', v.trim())} />
        <TextInput title="País" value={i.country} onChange={(v) => set('country', v)} />
        <TextInput title="Ciudad / sede" value={i.city} onChange={(v) => set('city', v)} />
        <NumberInput title="Año de fundación" step="1" value={i.founded} onChange={(v) => set('founded', v)} />
        <TextInput title="Color de marca" type="color" value={i.brand_color} onChange={(v) => set('brand_color', v)} />
        <TextInput title="Logo (URL de imagen, opcional)" value={i.logo ?? ''} onChange={(v) => set('logo', v.trim() || null)} className="sm:col-span-2" />
        <TextArea title="Descripción" rows={4} value={i.description} onChange={(v) => set('description', v)} className="sm:col-span-2" />
      </Fieldset>
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl border border-neg/40 bg-neg/10 p-3 text-sm text-white">
          {errors.map((e) => <li key={e} className="flex gap-2"><Icon name="alert" size={15} className="mt-0.5 text-neg" />{e}</li>)}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-accent" disabled={saving || errors.length > 0}>{saving ? 'Guardando…' : isNew ? 'Crear institución' : 'Guardar cambios'}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancelar</button>
        {onDelete && (
          <button type="button" className="btn btn-quiet ml-auto text-neg disabled:opacity-40" onClick={onDelete} disabled={saving || programs > 0} title={programs > 0 ? 'Mueve o elimina sus programas antes de borrarla' : undefined}>
            <Icon name="trash" size={15} /> Eliminar
          </button>
        )}
      </div>
    </form>
  );
}
