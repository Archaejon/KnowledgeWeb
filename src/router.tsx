import { useEffect, useState } from 'react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

export const PAGES = [
  'home',
  'network',
  'connect',
  'communities',
  'gatherings',
  'projects',
  'knowledge',
  'places',
  'nodal-locations',
  'settings',
  'appearance',
  'about',
] as const;

export type PageName = (typeof PAGES)[number];

export interface Route {
  page: PageName;
  id?: string;
  tab?: string;
  query: Record<string, string>;
}

function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '');
  const [path, queryString = ''] = clean.split('?');
  const segments = path.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryString).entries());
  if (segments.length === 0) return { page: 'home', query };
  const page = PAGES.includes(segments[0] as PageName) ? (segments[0] as PageName) : 'home';
  return { page, id: segments[1], tab: segments[2], query };
}

export function navigate(path: string) {
  const target = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
  if (window.location.hash === target) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = target;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) window.location.replace('#/home');
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
}

export function Link({ to, children, ...rest }: LinkProps) {
  return (
    <a href={to.startsWith('#') ? to : `#/${to.replace(/^\//, '')}`} {...rest}>
      {children}
    </a>
  );
}
