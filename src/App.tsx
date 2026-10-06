import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout, PageFallback } from './components/layout/Layout';
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
const RoutePage = lazy(() => import('./pages/RoutePage'));
const RouteResultPage = lazy(() => import('./pages/RouteResultPage'));
const MetricsPage = lazy(() => import('./pages/MetricsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

export default function App() {
  return (
    <Routes>
      {/* Administración: fuera del layout público, cargada solo bajo demanda. */}
      <Route path="admin/*" element={<Suspense fallback={<PageFallback />}><AdminPage /></Suspense>} />
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
        <Route path="mi-ruta" element={<RoutePage />} />
        <Route path="mi-ruta/:id" element={<RouteResultPage />} />
        <Route path="interno/metricas" element={<MetricsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
