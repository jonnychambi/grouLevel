import { useState, type FormEvent } from 'react';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Icon, type IconName } from '../components/ui/Icon';
import { useSeo } from '../hooks/useSeo';
import { submitPartnerRequest, type PartnerRequest } from '../services/partnerService';

const BENEFITS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'target', title: 'Generar leads', text: 'Recibe solicitudes de profesionales que ya compararon y eligieron tu programa.' },
  { icon: 'chart', title: 'Incrementar visibilidad', text: 'Aparece en búsquedas por tema, herramienta, modalidad y precio.' },
  { icon: 'star', title: 'Destacar programas', text: 'Posiciones destacadas identificadas con transparencia para el usuario.' },
  { icon: 'user', title: 'Captar estudiantes', text: 'Llega a profesionales que buscan especializarse, cambiar de carrera o actualizarse.' },
  { icon: 'sparkle', title: 'Medir interés', text: 'Vistas, comparaciones y solicitudes por programa, categoría y campaña.' },
  { icon: 'card', title: 'Generar ventas', text: 'Modelo preparado para comisión por venta cuando habilitemos el checkout.' }
];

const TIERS = [
  { label: 'HIGH INTENT', range: '80–100', color: 'text-cyan border-cyan/40', text: 'Quiere empezar ya y compara activamente. Contactar en minutos.' },
  { label: 'WARM', range: '60–79', color: 'text-blue-soft border-blue/40', text: 'Inicio en 30–90 días con objetivo claro.' },
  { label: 'NURTURE', range: '40–59', color: 'text-violet-soft border-violet/40', text: 'Interés real, decisión aún abierta. Nutrir con contenido.' },
  { label: 'LOW', range: '0–39', color: 'text-gray border-line-strong', text: 'Explorando opciones. Seguimiento de baja prioridad.' }
];

const EMPTY: PartnerRequest = { institution: '', contact_name: '', email: '', phone: '', institution_type: 'Universidad', programs_count: '1–5', intent: 'publicar', message: '' };

export default function PartnersPage() {
  useSeo({ title: 'Para instituciones', description: 'Publica tus programas de tecnología en Groulevel y recibe leads calificados con Signal Score™, visibilidad destacada y métricas de interés.', path: '/instituciones/partners' });
  const [form, setForm] = useState<PartnerRequest>(EMPTY);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const goContact = (intent: PartnerRequest['intent']) => {
    setForm((f) => ({ ...f, intent }));
    document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('p-institution')?.focus({ preventScroll: true }), 400);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.institution.trim()) errs.institution = 'Ingresa el nombre de la institución.';
    if (!form.contact_name.trim()) errs.contact_name = 'Ingresa tu nombre.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errs.email = 'Ingresa un email válido.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStatus('sending');
    try {
      await submitPartnerRequest(form);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  const field = (key: keyof PartnerRequest, label: string, type = 'text', autoComplete?: string) => (
    <div>
      <label htmlFor={`p-${key}`} className="mb-1.5 block text-sm font-medium text-white">{label}</label>
      <input id={`p-${key}`} type={type} autoComplete={autoComplete} className="input" value={form[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `p-${key}-e` : undefined} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      {errors[key] && <p id={`p-${key}-e`} className="mt-1 text-xs text-neg">{errors[key]}</p>}
    </div>
  );

  return (
    <>
      <section className="border-b border-line bg-[radial-gradient(70%_80%_at_80%_0%,#120f3a_0%,#050816_70%)]">
        <div className="container-page pb-16 pt-8 sm:pb-24">
          <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Instituciones', to: '/instituciones' }, { label: 'Para instituciones' }]} />
          <span className="eyebrow mt-10">Groulevel para instituciones</span>
          <h1 className="mt-5 max-w-4xl text-4xl leading-[1.04] text-white sm:text-6xl">Conecta tus programas con profesionales que están buscando dónde estudiar.</h1>
          <p className="mt-5 max-w-2xl text-lg text-gray">Cada búsqueda, comparación y solicitud es una señal de intención. Groulevel la convierte en leads calificados para universidades, escuelas de negocio, academias y bootcamps.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button className="btn btn-primary btn-lg" onClick={() => goContact('publicar')}>Publicar mis programas</button>
            <button className="btn btn-ghost btn-lg" onClick={() => goContact('reunion')}>Hablar con Groulevel</button>
          </div>
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="ben">
        <h2 id="ben" className="max-w-2xl text-3xl text-white sm:text-4xl">Lo que Groulevel hace por tu institución</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <li key={b.title} className="card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong text-cyan"><Icon name={b.icon} size={20} /></span>
              <h3 className="mt-5 text-lg text-white">{b.title}</h3>
              <p className="mt-2 text-gray">{b.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page py-8" aria-labelledby="score">
        <div className="card grid gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <span className="label-mono text-violet-soft">Signal Score™</span>
            <h2 id="score" className="mt-3 text-3xl text-white">No todos los leads valen lo mismo.</h2>
            <p className="mt-4 text-gray">Cada solicitud llega con un puntaje de 0 a 100 basado en urgencia de inicio, objetivo profesional, comportamiento en la plataforma (comparaciones, programas vistos) y calidad del contacto. Tu equipo comercial sabe a quién llamar primero.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TIERS.map((t) => (
              <li key={t.label} className="rounded-2xl border border-line bg-navy/60 p-4">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-[0.14em] ${t.color}`}>{t.label}</span>
                  <span className="tnum font-mono text-sm text-gray">{t.range}</span>
                </div>
                <p className="mt-3 text-sm text-gray">{t.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="models">
        <h2 id="models" className="text-3xl text-white sm:text-4xl">Modelos de colaboración</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { k: 'CPL', t: 'Costo por lead', d: 'Pagas solo por solicitudes recibidas. Tarifa ajustable por calidad (Signal Score).' },
            { k: 'FEATURED', t: 'Programas destacados', d: 'Posiciones preferenciales en búsquedas y categorías, siempre etiquetadas como “Destacado”.' },
            { k: 'REV SHARE', t: 'Comisión por venta', d: 'Porcentaje sobre matrículas concretadas. Disponible al habilitar el checkout.' }
          ].map((m) => (
            <div key={m.k} className="card p-6">
              <span className="font-mono text-xs tracking-[0.16em] text-cyan">{m.k}</span>
              <h3 className="mt-3 text-xl text-white">{m.t}</h3>
              <p className="mt-2 text-gray">{m.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="contacto" className="container-page scroll-mt-24 py-8" aria-labelledby="contact-title">
        <div className="card mx-auto max-w-3xl p-6 sm:p-10">
          {status === 'sent' ? (
            <div className="py-8 text-center" role="status">
              <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full border border-pos/40 bg-pos/10 text-pos"><Icon name="check" size={30} /></span>
              <h2 className="text-2xl text-white">¡Gracias! Te contactaremos en menos de 24 horas hábiles.</h2>
              <p className="mt-3 text-gray">Mientras tanto, prepara la información de tus programas: precio, duración, modalidad, temario y docentes.</p>
              <button className="btn btn-ghost mt-6" onClick={() => { setForm(EMPTY); setStatus('idle'); }}>Enviar otra solicitud</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h2 id="contact-title" className="text-2xl text-white">{form.intent === 'publicar' ? 'Publicar mis programas' : 'Hablar con Groulevel'}</h2>
              <p className="mt-2 text-gray">Cuéntanos sobre tu institución y te mostraremos cómo funciona.</p>
              <div className="mt-6 inline-flex rounded-full border border-line-strong p-1" role="radiogroup" aria-label="Motivo">
                {(['publicar', 'reunion'] as const).map((i) => (
                  <button key={i} type="button" role="radio" aria-checked={form.intent === i} onClick={() => setForm({ ...form, intent: i })} className={`rounded-full px-4 py-1.5 text-sm ${form.intent === i ? 'bg-white text-navy' : 'text-gray hover:text-white'}`}>
                    {i === 'publicar' ? 'Publicar programas' : 'Agendar reunión'}
                  </button>
                ))}
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {field('institution', 'Institución', 'text', 'organization')}
                {field('contact_name', 'Tu nombre', 'text', 'name')}
                {field('email', 'Email corporativo', 'email', 'email')}
                {field('phone', 'Teléfono (opcional)', 'tel', 'tel')}
                <div>
                  <label htmlFor="p-type" className="mb-1.5 block text-sm font-medium text-white">Tipo de institución</label>
                  <select id="p-type" className="input" value={form.institution_type} onChange={(e) => setForm({ ...form, institution_type: e.target.value })}>
                    {['Universidad', 'Escuela de negocios', 'Instituto', 'Academia especializada', 'Bootcamp', 'Plataforma online'].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="p-count" className="mb-1.5 block text-sm font-medium text-white">Programas de tecnología</label>
                  <select id="p-count" className="input" value={form.programs_count} onChange={(e) => setForm({ ...form, programs_count: e.target.value })}>
                    {['1–5', '6–20', '21–50', 'Más de 50'].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="p-msg" className="mb-1.5 block text-sm font-medium text-white">Mensaje (opcional)</label>
                  <textarea id="p-msg" rows={3} className="input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                </div>
              </div>
              {status === 'error' && <p role="alert" className="mt-4 text-sm text-neg">No pudimos enviar tu solicitud. Inténtalo nuevamente.</p>}
              <button type="submit" className="btn btn-accent btn-lg mt-6 w-full sm:w-auto" disabled={status === 'sending'}>
                {status === 'sending' ? 'Enviando…' : form.intent === 'publicar' ? 'Publicar mis programas' : 'Solicitar reunión'}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
