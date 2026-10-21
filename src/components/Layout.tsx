import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, navigate } from '../router';
import type { PageName } from '../router';
import { useApp } from '../store-context';
import { pendingRelationshipInvitations } from '../core/consent';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { ThemeMark } from './ThemeMark';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Avatar, Badge, Button, Modal } from './ui';

interface NavItem {
  page: PageName;
  label: string;
  icon: IconName;
  hint: string;
}

const primaryNav: NavItem[] = [
  { page: 'home', label: 'Home', icon: 'home', hint: 'Your week and your node' },
  { page: 'network', label: 'Network', icon: 'network', hint: 'Connections and consent' },
  { page: 'communities', label: 'Communities', icon: 'community', hint: 'Shared places and agreements' },
  { page: 'gatherings', label: 'Gatherings', icon: 'gathering', hint: 'Meetings and work parties' },
  { page: 'projects', label: 'Projects', icon: 'project', hint: 'Shared practical work' },
  { page: 'knowledge', label: 'Knowledge', icon: 'knowledge', hint: 'Notes, guides and research' },
  { page: 'places', label: 'Places', icon: 'place', hint: 'Observations and stewardship' },
  { page: 'nodal-locations', label: 'Nodal locations', icon: 'pin', hint: 'Gathering places and commons' },
  { page: 'settings', label: 'Node settings', icon: 'settings', hint: 'Identity, storage, networking, AI' },
  { page: 'appearance', label: 'Appearance', icon: 'palette', hint: 'Web, tree or mycelium' },
];

const secondaryNav: NavItem[] = [
  { page: 'places', label: 'Places', icon: 'place', hint: 'Observations and stewardship' },
  { page: 'nodal-locations', label: 'Nodal locations', icon: 'pin', hint: 'Gathering places and commons' },
  { page: 'projects', label: 'Projects', icon: 'project', hint: 'Shared practical work' },
  { page: 'gatherings', label: 'Gatherings', icon: 'gathering', hint: 'Meetings and work parties' },
  { page: 'settings', label: 'Node settings', icon: 'settings', hint: 'Identity, storage, networking, AI' },
  { page: 'appearance', label: 'Appearance', icon: 'palette', hint: 'Web, tree or mycelium' },
  { page: 'about', label: 'About & limits', icon: 'info', hint: 'What is real, what is simulated' },
];

export const pageTitles: Record<PageName, string> = {
  home: 'Home',
  network: 'Network',
  communities: 'Communities',
  gatherings: 'Gatherings',
  projects: 'Projects',
  knowledge: 'Knowledge',
  places: 'Places',
  'nodal-locations': 'Nodal locations',
  settings: 'Node settings',
  appearance: 'Appearance',
  about: 'About & limits',
};

export function usePendingCount() {
  const { snapshot } = useApp();
  return useMemo(
    () => pendingRelationshipInvitations(snapshot.data, snapshot.settings.actorId).length,
    [snapshot.data, snapshot.settings.actorId],
  );
}

export function Layout({ children, page }: { children: ReactNode; page: PageName }) {
  const { snapshot } = useApp();
  const { data, settings } = snapshot;
  const actor = data.people.find((p) => p.id === settings.actorId);
  const pendingCount = usePendingCount();
  const [moreOpen, setMoreOpen] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const theme = settings.theme;

  const navLink = (item: NavItem, onClick?: () => void) => (
    <Link
      key={item.page}
      to={item.page}
      className={`nav-link${page === item.page ? ' is-active' : ''}`}
      aria-current={page === item.page ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="nav-icon">
        <Icon name={item.icon} size={19} />
      </span>
      <span className="nav-text">
        <span className="nav-label">{item.label}</span>
        <span className="nav-hint">{item.hint}</span>
      </span>
      {item.page === 'network' && pendingCount > 0 ? (
        <span className="nav-count">
          <span className="sr-only">{pendingCount} pending invitations</span>
          <span aria-hidden="true">{pendingCount}</span>
        </span>
      ) : null}
    </Link>
  );

  return (
    <div className="app-shell">
      {/* The skip link must not rewrite the hash: the hash is the router. */}
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Node sidebar">
        <Link to="home" className="brand">
          <span className="brand-mark">
            <ThemeMark theme={theme} size={34} />
          </span>
          <span className="brand-text">
            <span className="brand-name">Understory</span>
            <span className="brand-sub">consent-based knowledge exchange</span>
          </span>
        </Link>

        <div className="node-chip" title={data.node.name}>
          <span className="node-chip-kicker">Local node</span>
          <span className="node-chip-name">{data.node.name}</span>
          <span className="node-chip-meta">
            <span className="status-dot" aria-hidden="true" /> {snapshot.lastSavedAt ? 'Saved locally' : 'Local only'}
          </span>
        </div>

        <nav className="nav" aria-label="Primary">
          {primaryNav.map((item) => navLink(item))}
        </nav>

        <div className="sidebar-footer">
          <ThemeSwitcher />
          <Link to="settings" className="acting-as">
            <Avatar name={actor?.name ?? 'You'} size="sm" />
            <span className="acting-as-text">
              <span className="acting-as-label">Acting as · demo</span>
              <span className="acting-as-name">{actor?.name ?? 'Unknown'}</span>
            </span>
            <Icon name="settings" size={15} />
          </Link>
          <Link to="about" className="footer-link">
            <Icon name="info" size={14} /> About this prototype
          </Link>
          <p className="sidebar-version">
            v{__APP_VERSION__} · local-first prototype · AGPL-3.0
          </p>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <Link to="home" className="mobile-brand" aria-label="Understory home">
              <ThemeMark theme={theme} size={26} />
              <span>Understory</span>
            </Link>
            <span className="topbar-title">{pageTitles[page]}</span>
          </div>
          <div className="topbar-right">
            {data.node.prototype ? (
              <Badge tone="sample" title="Fictional demonstration data and simulated identities">
                Prototype
              </Badge>
            ) : null}
            <ThemeSwitcher compact />
            <Link to="settings" className="topbar-identity" aria-label="Node identity settings">
              <Avatar name={actor?.name ?? 'You'} size="sm" />
              <span className="topbar-identity-name">{actor?.name}</span>
            </Link>
          </div>
        </header>

        <div className="content-wrap">
          {snapshot.storageError ? (
            <div className="alert-bar alert-danger" role="alert">
              <Icon name="database" size={17} />
              <span>{snapshot.storageError}</span>
              <Link to="settings" className="alert-link">
                Export a backup
              </Link>
            </div>
          ) : null}
          {snapshot.loadNotice && !noticeDismissed ? (
            <div className="alert-bar alert-warn" role="status">
              <Icon name="alert" size={17} />
              <span>{snapshot.loadNotice}</span>
              <button type="button" className="alert-dismiss" onClick={() => setNoticeDismissed(true)}>
                Dismiss
              </button>
            </div>
          ) : null}
          <main id="main" className="page" tabIndex={-1}>
            {children}
          </main>
          <footer className="page-footer">
            <span>Understory · a prototype node for real-world communities</span>
            <span className="footer-links">
              <Link to="about">Limitations</Link>
              <Link to="settings">Backups</Link>
              <Link to="appearance">Appearance</Link>
            </span>
          </footer>
        </div>
      </div>

      <nav className="mobile-nav" aria-label="Primary mobile">
        {[
          { page: 'home' as PageName, label: 'Home', icon: 'home' as IconName },
          { page: 'network' as PageName, label: 'Network', icon: 'network' as IconName },
          { page: 'communities' as PageName, label: 'Communities', icon: 'community' as IconName },
          { page: 'knowledge' as PageName, label: 'Knowledge', icon: 'knowledge' as IconName },
        ].map((item) => (
          <Link
            key={item.page}
            to={item.page}
            className={`mobile-nav-link${page === item.page ? ' is-active' : ''}`}
            aria-current={page === item.page ? 'page' : undefined}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`mobile-nav-link${['projects', 'gatherings', 'places', 'nodal-locations', 'settings', 'appearance', 'about'].includes(page) ? ' is-active' : ''}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
        >
          <Icon name="dots" size={20} />
          <span>More</span>
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More" size="sm">
        <div className="more-nav">
          {secondaryNav.map((item) => (
            <button
              key={item.page}
              type="button"
              className="more-nav-link"
              onClick={() => {
                setMoreOpen(false);
                navigate(item.page);
              }}
            >
              <Icon name={item.icon} size={19} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
              <Icon name="chevronRight" size={16} />
            </button>
          ))}
        </div>
        <div className="more-theme">
          <span className="field-inline-label">Theme</span>
          <ThemeSwitcher />
        </div>
        <Button block variant="quiet" onClick={() => setMoreOpen(false)}>
          Close
        </Button>
      </Modal>
    </div>
  );
}
