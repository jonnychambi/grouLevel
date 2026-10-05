import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CourseWithInstitution, LeadFormInput, LeadSource } from '../../types';
import { getLeadService } from '../../services/leadService';
import { courseContext, track } from '../../services/analytics';
import { compareStore } from '../../hooks/useCompare';
import { recentStore } from '../../hooks/useRecentlyViewed';
import { formatDate } from '../../utils/format';
import { MODALITY_LABELS, PROGRAM_TYPE_LABELS } from '../../utils/labels';
import { InstitutionLogo } from '../institution/InstitutionLogo';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { PriceDisplay } from '../ui/PriceDisplay';
import { LeadForm } from './LeadForm';

type Status = { kind: 'form' } | { kind: 'submitting' } | { kind: 'success'; firstName: string } | { kind: 'error'; message: string };

/** Captura de leads: solo aparece cuando hay intención comercial explícita. */
export default function LeadModal({ course, source, onClose }: { course: CourseWithInstitution; source: LeadSource; onClose: () => void }) {
  const [status, setStatus] = useState<Status>({ kind: 'form' });
  const [lastInput, setLastInput] = useState<LeadFormInput | null>(null);

  const submit = async (input: LeadFormInput) => {
    setLastInput(input);
    setStatus({ kind: 'submitting' });
    try {
      const compared = compareStore.get();
      const lead = await getLeadService().submit({
        input,
        course,
        signals: { compared_programs: compared.includes(course.id) ? compared.length : 0, viewed_programs: recentStore.get().length, source }
      });
      track('lead_submitted', { ...courseContext(course), source, lead_id: lead.id, lead_score: lead.lead_score, lead_tier: lead.lead_tier, lead_segment: lead.lead_segment });
      setStatus({ kind: 'success', firstName: input.first_name.trim() });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Ocurrió un error inesperado.' });
    }
  };

  const summary = (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-navy/60 p-3">
      <InstitutionLogo institution={course.institution} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{course.name}</p>
        <p className="truncate text-xs text-muted">{course.institution.name} · {PROGRAM_TYPE_LABELS[course.program_type]} · {MODALITY_LABELS[course.modality]}</p>
      </div>
      <PriceDisplay course={course} size="sm" showFrom={false} className="hidden text-right sm:block" />
    </div>
  );

  return (
    <Modal open onClose={onClose} title={status.kind === 'success' ? 'Solicitud enviada' : 'Solicitar información'} description={status.kind === 'success' ? undefined : 'Recibe el brochure, fechas y opciones de pago directamente de la institución.'} size="lg">
      {status.kind === 'success' ? (
        <div className="px-6 py-10 text-center" role="status">
          <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full border border-pos/40 bg-pos/10 text-pos">
            <Icon name="check" size={30} />
          </span>
          <h3 className="text-2xl text-white">¡Listo! Enviaremos tu solicitud a la institución.</h3>
          <p className="mx-auto mt-3 max-w-md text-gray">
            Gracias, {status.firstName}. {course.institution.name} recibirá tus datos y te contactará por email o WhatsApp
            {course.start_date ? ` antes del inicio del ${formatDate(course.start_date, { day: 'numeric', month: 'long' })}` : ''}.
          </p>
          <div className="mx-auto mt-6 max-w-md text-left">{summary}</div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button className="btn btn-primary" onClick={onClose}>Seguir explorando</button>
            <Link to="/comparar" className="btn btn-ghost" onClick={onClose}>Ir al comparador</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="px-5 pt-5 sm:px-6">{summary}</div>
          {status.kind === 'error' && (
            <div role="alert" className="mx-5 mt-4 flex items-start gap-3 rounded-xl border border-neg/40 bg-neg/10 p-3 text-sm text-white sm:mx-6">
              <Icon name="alert" className="mt-0.5 shrink-0 text-neg" />
              <div className="flex-1">
                <p>{status.message}</p>
                {lastInput && <button className="mt-1 font-medium text-cyan hover:underline" onClick={() => submit(lastInput)}>Reintentar</button>}
              </div>
            </div>
          )}
          <LeadForm institutionName={course.institution.name} submitting={status.kind === 'submitting'} onSubmit={submit} />
        </>
      )}
    </Modal>
  );
}
