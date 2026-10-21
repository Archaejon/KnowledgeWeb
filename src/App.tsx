import { useEffect, useLayoutEffect, useRef } from 'react';
import { useRoute } from './router';
import { useApp } from './store-context';
import { Layout, pageTitles } from './components/Layout';
import { HomePage } from './pages/Home';
import { NetworkPage } from './pages/Network';
import { CommunitiesPage } from './pages/Communities';
import { GatheringsPage } from './pages/Gatherings';
import { ProjectsPage } from './pages/Projects';
import { KnowledgePage } from './pages/Knowledge';
import { PlacesPage } from './pages/Places';
import { NodalLocationsPage } from './pages/NodalLocations';
import { SettingsPage } from './pages/Settings';
import { AppearancePage } from './pages/Appearance';
import { AboutPage } from './pages/About';

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
      {route.page === 'home' ? <HomePage /> : null}
      {route.page === 'network' ? <NetworkPage /> : null}
      {route.page === 'communities' ? <CommunitiesPage communityId={route.id} /> : null}
      {route.page === 'gatherings' ? <GatheringsPage gatheringId={route.id} /> : null}
      {route.page === 'projects' ? <ProjectsPage projectId={route.id} /> : null}
      {route.page === 'knowledge' ? <KnowledgePage knowledgeId={route.id} /> : null}
      {route.page === 'places' ? <PlacesPage /> : null}
      {route.page === 'nodal-locations' ? <NodalLocationsPage locationId={route.id} /> : null}
      {route.page === 'settings' ? <SettingsPage /> : null}
      {route.page === 'appearance' ? <AppearancePage /> : null}
      {route.page === 'about' ? <AboutPage /> : null}
    </Layout>
  );
}
