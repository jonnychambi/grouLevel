import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout, PageFallback } from './components/layout/Layout';
import HomePage from './pages/HomePage';

// Rutas por tipo de programa (mismas que TYPE_PATHS en src/content/seoModel.mjs; aquí literales para no cargar el contenido en el bundle inicial).
const TYPE_ROUTES = [['diplomado', 'diplomados'], ['bootcamp', 'bootcamps'], ['maestria', 'maestrias'], ['especializacion', 'especializaciones']] as const;

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
const OpinarPage = lazy(() => import('./pages/OpinarPage'));
const MisCreditosPage = lazy(() => import('./pages/MisCreditosPage'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));
const CareersPage = lazy(() => import('./pages/CareersPage'));
const SkillsPage = lazy(() => import('./pages/SkillsPage'));
const GuidesPage = lazy(() => import('./pages/GuidesPage'));
const CatalogLandingPage = lazy(() => import('./pages/CatalogLandingPage'));
const AnalyzerLandingPage = lazy(() => import('./pages/AnalyzerLandingPage'));
const RewardsPage = lazy(() => import('./pages/RewardsPage'));

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
        <Route path="programa/:slug/opiniones" element={<ReviewsPage scope="programa" />} />
        <Route path="comparar" element={<ComparePage />} />
        <Route path="comparar/:slug" element={<GuidesPage comparison />} />
        <Route path="carreras" element={<CareersPage />} />
        <Route path="carreras/:slug" element={<CareersPage />} />
        <Route path="habilidades" element={<SkillsPage />} />
        <Route path="habilidades/:slug" element={<SkillsPage />} />
        <Route path="guias" element={<GuidesPage />} />
        <Route path="guias/:slug" element={<GuidesPage />} />
        <Route path="cursos" element={<CatalogLandingPage />} />
        <Route path="cursos/:slug" element={<CatalogLandingPage />} />
        {TYPE_ROUTES.map(([t, seg]) => [
          <Route key={t} path={seg} element={<CatalogLandingPage key={t} type={t} />} />,
          <Route key={`${t}-area`} path={`${seg}/:slug`} element={<CatalogLandingPage key={`${t}-area`} type={t} />} />
        ])}
        <Route path="analizar-perfil" element={<AnalyzerLandingPage />} />
        <Route path="instituciones" element={<InstitutionsPage />} />
        <Route path="instituciones/partners" element={<PartnersPage />} />
        <Route path="institucion/:slug" element={<InstitutionDetailPage />} />
        <Route path="institucion/:slug/opiniones" element={<ReviewsPage scope="institucion" />} />
        <Route path="opinar" element={<OpinarPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="mis-creditos" element={<MisCreditosPage />} />
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
