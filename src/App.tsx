import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import HomePage from './pages/HomePage';

// Code-splitting por ruta: el home carga primero; el resto bajo demanda.
const ProgramsPage = lazy(() => import('./pages/ProgramsPage'));
const ProgramDetailPage = lazy(() => import('./pages/ProgramDetailPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const InstitutionsPage = lazy(() => import('./pages/InstitutionsPage'));
const InstitutionDetailPage = lazy(() => import('./pages/InstitutionDetailPage'));
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const MetricsPage = lazy(() => import('./pages/MetricsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="programas" element={<ProgramsPage />} />
        <Route path="programas/:categoria" element={<ProgramsPage />} />
        <Route path="programa/:slug" element={<ProgramDetailPage />} />
        <Route path="comparar" element={<ComparePage />} />
        <Route path="instituciones" element={<InstitutionsPage />} />
        <Route path="instituciones/partners" element={<PartnersPage />} />
        <Route path="institucion/:slug" element={<InstitutionDetailPage />} />
        <Route path="nosotros" element={<AboutPage />} />
        <Route path="favoritos" element={<FavoritesPage />} />
        <Route path="interno/metricas" element={<MetricsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
