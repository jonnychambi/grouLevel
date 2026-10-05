import { createContext, lazy, Suspense, useCallback, useContext, useState, type ReactNode } from 'react';
import type { CourseWithInstitution, LeadSource } from '../types';
import { courseContext, track } from '../services/analytics';

/** El modal de leads se carga bajo demanda (solo cuando hay intención comercial). */
const LeadModal = lazy(() => import('../components/lead/LeadModal'));

interface LeadModalState { course: CourseWithInstitution; source: LeadSource }
type OpenLead = (course: CourseWithInstitution, source: LeadSource) => void;

const LeadModalContext = createContext<OpenLead>(() => {});

export function LeadModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LeadModalState | null>(null);

  const open = useCallback<OpenLead>((course, source) => {
    track('lead_form_opened', { ...courseContext(course), source });
    setState({ course, source });
  }, []);

  return (
    <LeadModalContext.Provider value={open}>
      {children}
      {state && (
        <Suspense fallback={null}>
          <LeadModal course={state.course} source={state.source} onClose={() => setState(null)} />
        </Suspense>
      )}
    </LeadModalContext.Provider>
  );
}

export const useLeadModal = () => useContext(LeadModalContext);
