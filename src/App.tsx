import { Suspense, lazy, useEffect, useLayoutEffect, useRef } from 'react';
import { useRoute } from './router';
import { useApp } from './store-context';
import { Layout, pageTitles } from './components/Layout';
import { HomePage } from './pages/Home';

// Home stays in the entry chunk so the landing route paints with the shell.
// Every other route is a separate chunk: first load does not download the
// network map, the knowledge editor or the project/gathering views.
const NetworkPage = lazy(() => import('./pages/Network').then((m) => ({ default: m.NetworkPage })));
const ConnectPage = lazy(() => import('./pages/Connect').then((m) => ({ default: m.ConnectPage })));
const CommunitiesPage = lazy(() =>
  import('./pages/Communities').then((m) => ({ default: m.CommunitiesPage })),
);
const GatheringsPage = lazy(() =>
  import('./pages/Gatherings').then((m) => ({ default: m.GatheringsPage })),
);
const ProjectsPage = lazy(() =>
  import('./pages/Projects').then((m) => ({ default: m.ProjectsPage })),
);
const KnowledgePage = lazy(() =>
  import('./pages/Knowledge').then((m) => ({ default: m.KnowledgePage })),
);
const PlacesPage = lazy(() => import('./pages/Places').then((m) => ({ default: m.PlacesPage })));
const NodalLocationsPage = lazy(() =>
  import('./pages/NodalLocations').then((m) => ({ default: m.NodalLocationsPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/Settings').then((m) => ({ default: m.SettingsPage })),
);
const AppearancePage = lazy(() =>
  import('./pages/Appearance').then((m) => ({ default: m.AppearancePage })),
);
const AboutPage = lazy(() => import('./pages/About').then((m) => ({ default: m.AboutPage })));

function PageLoading() {
  return (
    <p className="page-loading muted small" role="status">
      Loading this view…
    </p>
  );
}

export function App() {
  const route = useRoute();
  const { snapshot } = useApp();
  const firstRoute = useRef(true);

  // 2.4.2 Page Titled: the document title follows the route.
  useEffect(() => {
    document.title =
      route.page === 'home'
        ? 'Understory · consent-based knowledge exchange'
        : `${pageTitles[route.page]} · Understory`;
  }, [route.page]);

  // 2.4.3 Focus Order: an in-page route change moves focus to the new main
  // region so the next Tab starts at the new content, not the old nav link.
  useEffect(() => {
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [route.page, route.id]);

  // Layout effect: the theme attribute must be in the DOM before the browser
  // captures the new frame, including inside a View Transition callback.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = snapshot.settings.theme;
    document.documentElement.style.colorScheme = 'light';
    const colour = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', colour);
  }, [snapshot.settings.theme]);

  return (
    <Layout page={route.page}>
      <Suspense fallback={<PageLoading />}>
        {route.page === 'home' ? <HomePage /> : null}
        {route.page === 'network' ? <NetworkPage /> : null}
        {route.page === 'connect' ? <ConnectPage token={route.id} /> : null}
        {route.page === 'communities' ? <CommunitiesPage communityId={route.id} /> : null}
        {route.page === 'gatherings' ? <GatheringsPage gatheringId={route.id} /> : null}
        {route.page === 'projects' ? <ProjectsPage projectId={route.id} /> : null}
        {route.page === 'knowledge' ? <KnowledgePage knowledgeId={route.id} /> : null}
        {route.page === 'places' ? <PlacesPage /> : null}
        {route.page === 'nodal-locations' ? <NodalLocationsPage locationId={route.id} /> : null}
        {route.page === 'settings' ? <SettingsPage /> : null}
        {route.page === 'appearance' ? <AppearancePage /> : null}
        {route.page === 'about' ? <AboutPage /> : null}
      </Suspense>
    </Layout>
  );
}
