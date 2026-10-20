import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmailGate } from '../components/reviews/ReviewAccount';
import { InstitutionLogo } from '../components/institution/InstitutionLogo';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Icon, type IconName } from '../components/ui/Icon';
import { useCatalog } from '../hooks/useCatalog';
import { useReviewAccount } from '../hooks/useReviewAccount';
import { useSeo } from '../hooks/useSeo';
import { track } from '../services/analytics';
import { referralLink, rememberReferral } from '../services/reviewsService';
import { REWARDS, REWARDS_FAQ, REWARDS_HERO, REWARDS_META, REWARDS_RULES, REWARDS_STEPS, simulateRewards } from '../content/rewards.mjs';
import { breadcrumbSchema } from '../utils/schema';
import type { Institution } from '../types';

const soles = (n: number) => `S/ ${n.toLocaleString('en-US')}`;
type Channel = 'whatsapp' | 'linkedin' | 'email' | 'copiar' | 'nativo';

/**
 * Groulevel Rewards: landing de la campaña de reseñas. Explica los créditos (reseña aprobada y referido con
 * reseña aprobada), permite simularlos, elegir la institución para opinar y obtener el enlace personal de referido.
 * Los referidos llegan aquí (/rewards?ref=CODIGO): el código se guarda hasta que la persona envíe su reseña.
 */
export default function RewardsPage() {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const { session, wallet } = useReviewAccount();
  const { catalog } = useCatalog();

  useSeo({
    ...REWARDS_META, path: '/rewards',
    jsonLd: [
      breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Groulevel Rewards', path: '/rewards' }]),
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: REWARDS_FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }
    ]
  });
  useEffect(() => { rememberReferral(ref); }, [ref]);
  useEffect(() => { track('rewards_viewed', { referred: !!ref, signed_in: !!session }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const opinar = (extra = '') => `/opinar${extra ? `?${extra}` : ''}`;

  return (
    <div className="pb-16">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_85%_10%,#1a1450_0%,#050816_70%)]" aria-hidden="true" />
        <div className="container-page relative pb-14 pt-8 sm:pb-20">
          <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Groulevel Rewards' }]} />
          {ref && (
            <p className="mt-6 inline-flex max-w-full items-center gap-2 rounded-full border border-pos/40 bg-pos/10 px-4 py-2 text-sm text-white" role="status">
              <Icon name="sparkle" size={15} className="shrink-0 text-pos" />Te invitaron a Groulevel Rewards: escribe tu primera reseña y gana S/ {REWARDS.review}.
            </p>
          )}
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:items-center">
            <div>
              <span className="eyebrow">{REWARDS_HERO.eyebrow}</span>
              <h1 className="mt-5 text-[42px] leading-[1.02] text-white sm:text-6xl lg:text-7xl">
                Tu experiencia vale <span className="grad-text">S/ {REWARDS.review}.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-gray sm:text-xl">{REWARDS_HERO.subtitle}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={opinar()} className="btn btn-accent btn-lg" onClick={() => track('rewards_cta_clicked', { cta: 'resena' })}><Icon name="star" size={18} />Escribir mi reseña</Link>
                <a href="#invitar" className="btn btn-ghost btn-lg" onClick={() => track('rewards_cta_clicked', { cta: 'invitar' })}><Icon name="share" size={18} />Invitar y ganar S/ {REWARDS.referral}</a>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray">
                {['Sin costo', 'Opiniones positivas o críticas', `Hasta S/ ${REWARDS.maxPerProgram} por programa`].map((t) => (
                  <li key={t} className="flex items-center gap-1.5"><Icon name="check" size={15} className="text-pos" />{t}</li>
                ))}
              </ul>
            </div>
            <RewardCards />
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="container-page py-16" aria-labelledby="how">
        <span className="label-mono">Cómo funciona</span>
        <h2 id="how" className="mt-2 text-3xl text-white sm:text-4xl">De tu reseña a tu descuento, en 4 pasos</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {REWARDS_STEPS.map((s, i) => (
            <li key={s.title} className="card p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full border border-cyan/50 font-mono text-sm text-cyan">{i + 1}</span>
              <h3 className="mt-4 text-lg text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm text-gray">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* SIMULADOR + DÓNDE ESTUDIASTE */}
      <section className="container-page grid gap-6 lg:grid-cols-2" aria-label="Calcula y empieza">
        <Simulator />
        <InstitutionPicker institutions={catalog?.institutions ?? []} />
      </section>

      {/* INVITAR / MI SALDO */}
      <section id="invitar" className="container-page scroll-mt-24 py-16" aria-labelledby="inv">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <span className="label-mono">Referidos</span>
            <h2 id="inv" className="mt-2 text-3xl text-white sm:text-4xl">Invita y gana S/ {REWARDS.referral} por cada reseña aprobada</h2>
            <p className="mt-3 max-w-xl text-gray">Comparte tu enlace con compañeros y egresados. Cuando alguien publica su primera reseña con tu enlace y se aprueba, sumas S/ {REWARDS.referral}. Tu referido también gana sus propios S/ {REWARDS.review}. No hay límite de referidos.</p>
          </div>
          {session && wallet ? <MyRewards code={wallet.ref_code} earned={wallet.earned} pending={wallet.pending} available={wallet.available} referrals={wallet.referrals.length} activeReferrals={wallet.referrals.filter((r) => r.status === 'aprobado').length} />
            : session ? <div className="skeleton h-56" />
            : <div><EmailGate onSession={() => undefined} /><p className="mt-3 text-xs text-muted">Al validar tu correo verás tu enlace personal para invitar y tu saldo.</p></div>}
        </div>
      </section>

      {/* BASES */}
      <section className="container-page" aria-labelledby="bases">
        <div className="card p-6 sm:p-8">
          <h2 id="bases" className="text-2xl text-white">Bases de la campaña</h2>
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {REWARDS_RULES.map((r) => <li key={r} className="flex gap-2.5 text-sm text-gray"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-cyan" />{r}</li>)}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-page pt-16" aria-labelledby="faq">
        <h2 id="faq" className="text-3xl text-white">Preguntas frecuentes</h2>
        <dl className="mt-6 divide-y divide-line border-y border-line">
          {REWARDS_FAQ.map((f) => (
            <div key={f.q} className="grid gap-1 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-8">
              <dt className="font-medium text-white">{f.q}</dt>
              <dd className="text-gray">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* CTA FINAL */}
      <section className="container-page pt-16">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-violet/30 bg-[linear-gradient(135deg,rgba(118,87,255,.18),rgba(36,107,254,.08)_55%,rgba(0,231,255,.06))] p-8 sm:p-12">
          <h2 className="max-w-2xl text-3xl text-white sm:text-4xl">Ayuda a otros a elegir mejor. Gana S/ {REWARDS.review} por hacerlo.</h2>
          <p className="mt-3 max-w-xl text-gray">Toma pocos minutos. Tu opinión ayuda a otros profesionales a comparar instituciones con información real.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={opinar()} className="btn btn-primary" onClick={() => track('rewards_cta_clicked', { cta: 'resena' })}>Escribir mi reseña</Link>
            <Link to="/mis-creditos" className="btn btn-ghost" onClick={() => track('rewards_cta_clicked', { cta: 'mis-creditos' })}>Ver mis créditos</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function RewardCards() {
  const cards: { icon: IconName; amount: number; title: string; text: string }[] = [
    { icon: 'star', amount: REWARDS.review, title: 'Por tu reseña aprobada', text: 'Publicada por moderación y con tu constancia de estudios verificada.' },
    { icon: 'user', amount: REWARDS.referral, title: 'Por cada referido con reseña aprobada', text: 'Cuando alguien publica su primera reseña con tu enlace y se aprueba.' }
  ];
  return (
    <div className="grid gap-3">
      {cards.map((c) => (
        <div key={c.title} className="card flex items-center gap-5 p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet to-blue text-white"><Icon name={c.icon} size={22} /></span>
          <div className="min-w-0">
            <p className="tnum text-3xl font-semibold tracking-tight text-white">+ S/ {c.amount}</p>
            <p className="font-medium text-white">{c.title}</p>
            <p className="text-sm text-muted">{c.text}</p>
          </div>
        </div>
      ))}
      <p className="px-1 text-xs text-muted">Se acumulan como descuento adicional para el programa que elijas: hasta S/ {REWARDS.maxPerProgram} por programa.</p>
    </div>
  );
}

function Stepper({ id, label, value, onChange, max }: { id: string; label: string; value: number; onChange: (n: number) => void; max: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <label htmlFor={id} className="text-gray">{label}</label>
      <div className="flex items-center gap-2">
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-line-strong text-white hover:bg-raise disabled:opacity-40" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label={`Menos ${label.toLowerCase()}`}><Icon name="minus" size={15} /></button>
        <input id={id} type="number" min={0} max={max} inputMode="numeric" className="input tnum min-h-9 w-14 px-1 py-1 text-center" value={value} onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value) || 0)))} />
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-line-strong text-white hover:bg-raise disabled:opacity-40" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Más ${label.toLowerCase()}`}><Icon name="plus" size={15} /></button>
      </div>
    </div>
  );
}

function Simulator() {
  const [reviews, setReviews] = useState(1);
  const [referrals, setReferrals] = useState(2);
  const sim = simulateRewards(reviews, referrals);
  return (
    <div className="card min-w-0 p-6">
      <h2 className="text-2xl text-white">Calcula tus créditos</h2>
      <div className="mt-6 space-y-4">
        <Stepper id="sim-reviews" label="Mis reseñas aprobadas" value={reviews} onChange={setReviews} max={10} />
        <Stepper id="sim-referrals" label="Referidos con reseña aprobada" value={referrals} onChange={setReferrals} max={50} />
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-navy/50 p-5" aria-live="polite">
        <p className="label-mono">Acumularías</p>
        <p className="tnum mt-1 text-4xl font-semibold tracking-tight text-white">{soles(sim.total)}</p>
        {sim.programs.length > 0 ? (
          <>
            <p className="mt-3 text-sm text-gray">{sim.programs.length === 1 ? 'Descuento adicional en 1 programa:' : `Puedes repartirlo en ${sim.programs.length} programas:`}</p>
            <ul className="mt-2 flex flex-wrap gap-2">{sim.programs.map((p, i) => <li key={i} className="chip tnum">Programa {i + 1}: {soles(p)}</li>)}</ul>
          </>
        ) : <p className="mt-3 text-sm text-gray">Suma una reseña o un referido para empezar.</p>}
      </div>
      <p className="mt-3 text-xs text-muted">Simulación. Los créditos se activan solo con reseñas publicadas y constancias verificadas.</p>
    </div>
  );
}

function InstitutionPicker({ institutions }: { institutions: Institution[] }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const term = n(q.trim());
    return [...institutions].sort((a, b) => a.name.localeCompare(b.name, 'es')).filter((i) => !term || n(`${i.name} ${i.short_name}`).includes(term));
  }, [institutions, q]);
  return (
    <div className="card flex min-w-0 flex-col p-6">
      <h2 className="text-2xl text-white">¿Dónde estudiaste?</h2>
      <p className="mt-1 text-sm text-gray">Elige la institución y empieza tu reseña.</p>
      <label htmlFor="rw-inst" className="sr-only">Buscar institución</label>
      <div className="relative mt-4">
        <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input id="rw-inst" className="input min-h-11 w-full pl-9" placeholder="Buscar universidad o instituto" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="mt-4 max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {list.map((i) => (
          <li key={i.id}>
            <Link to={`/opinar?institucion=${encodeURIComponent(i.slug)}`} onClick={() => track('rewards_cta_clicked', { cta: 'institucion' })} className="group flex items-center gap-3 rounded-xl border border-line px-3 py-2 hover:border-cyan/40">
              <InstitutionLogo institution={i} size={30} />
              <span className="min-w-0 flex-1 truncate text-white group-hover:text-cyan">{i.name}</span>
              <span className="shrink-0 text-xs text-muted">Opinar</span>
            </Link>
          </li>
        ))}
        {!list.length && <li className="text-sm text-muted">No encontramos esa institución. <Link to="/opinar" className="text-blue-soft hover:text-white">Ir al formulario</Link></li>}
      </ul>
    </div>
  );
}

function MyRewards({ code, earned, pending, available, referrals, activeReferrals }: { code: string; earned: number; pending: number; available: number; referrals: number; activeReferrals: number }) {
  const [copied, setCopied] = useState(false);
  const link = referralLink(code);
  const message = `Estoy usando Groulevel para comparar programas. Si estudiaste en alguna universidad o instituto, opina sobre tu experiencia y gana S/ ${REWARDS.review} de descuento para tu próximo programa:`;
  const share = (channel: Channel) => track('referral_shared', { channel });
  const copy = async () => {
    share('copiar');
    try {
      await navigator.clipboard.writeText(referralLink(code, 'copiar'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      document.getElementById('rw-link')?.focus();
    }
  };
  const native = async () => {
    try {
      await navigator.share({ title: 'Groulevel Rewards', text: message, url: referralLink(code, 'nativo') });
      share('nativo');
    } catch { /* cancelado */ }
  };
  const stats: [string, number, string][] = [['Acumulado', earned + pending, `${soles(pending)} por activar`], ['Disponible', available, 'Para usar como descuento'], ['Referidos', referrals, `${activeReferrals} con reseña aprobada`]];
  return (
    <div className="card min-w-0 p-6">
      <dl className="grid grid-cols-3 gap-3">
        {stats.map(([k, v, sub], i) => (
          <div key={k}>
            <dt className="label-mono text-[10px]">{k}</dt>
            <dd className="tnum mt-1 text-2xl font-semibold text-white">{i === 2 ? v : soles(v)}</dd>
            <dd className="text-xs text-muted">{sub}</dd>
          </div>
        ))}
      </dl>
      <label htmlFor="rw-link" className="mt-6 block text-sm text-white">Tu enlace para invitar</label>
      <div className="mt-2 flex gap-2">
        <input id="rw-link" readOnly className="input min-h-10 min-w-0 flex-1 py-1.5 font-mono text-xs" value={link} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn btn-accent btn-sm shrink-0" onClick={() => void copy()}>{copied ? 'Copiado' : 'Copiar'}</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${message} ${referralLink(code, 'whatsapp')}`)}`} onClick={() => share('whatsapp')}>WhatsApp</a>
        <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink(code, 'linkedin'))}`} onClick={() => share('linkedin')}><Icon name="linkedin" size={14} />LinkedIn</a>
        <a className="btn btn-ghost btn-sm" href={`mailto:?subject=${encodeURIComponent('Gana S/ 100 por tu reseña en Groulevel')}&body=${encodeURIComponent(`${message}\n\n${referralLink(code, 'email')}`)}`} onClick={() => share('email')}>Correo</a>
        {typeof navigator !== 'undefined' && 'share' in navigator && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void native()}><Icon name="share" size={14} />Más</button>}
      </div>
      <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4 text-sm">
        <Link to="/opinar" className="text-blue-soft hover:text-white" onClick={() => track('rewards_cta_clicked', { cta: 'resena' })}>Escribir una reseña</Link>
        <Link to="/mis-creditos" className="text-blue-soft hover:text-white" onClick={() => track('rewards_cta_clicked', { cta: 'mis-creditos' })}>Ver movimientos y usar mi saldo</Link>
      </div>
    </div>
  );
}
