import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { LeadModalProvider } from './context/LeadModalContext';
import { ToastProvider } from './context/ToastContext';
import { captureAttribution } from './services/attribution';
import { loadCatalog } from './services/catalogService';
import './index.css';

captureAttribution();
// Precarga del catálogo en paralelo al render inicial.
void loadCatalog().catch(() => undefined);

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <ToastProvider>
        <LeadModalProvider>
          <App />
        </LeadModalProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
