import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'network'
  | 'community'
  | 'gathering'
  | 'project'
  | 'knowledge'
  | 'place'
  | 'settings'
  | 'palette'
  | 'plus'
  | 'search'
  | 'check'
  | 'x'
  | 'edit'
  | 'trash'
  | 'lock'
  | 'key'
  | 'link'
  | 'clock'
  | 'mapPin'
  | 'alert'
  | 'download'
  | 'upload'
  | 'refresh'
  | 'arrowRight'
  | 'shield'
  | 'sparkles'
  | 'filter'
  | 'leaf'
  | 'calendar'
  | 'dots'
  | 'menu'
  | 'external'
  | 'info'
  | 'chevronRight'
  | 'chevronDown'
  | 'send'
  | 'eye'
  | 'eyeOff'
  | 'ruler'
  | 'database'
  | 'wifiOff'
  | 'file'
  | 'mic'
  | 'users'
  | 'book'
  | 'heart'
  | 'pin'
  | 'cancel';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const paths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10.5V20h13v-9.5" />
      <path d="M9.5 20v-5h5v5" />
    </>
  ),
  network: (
    <>
      <circle cx="6" cy="17" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2" />
      <path d="M8.4 15.5 15.7 7.8M8.5 17.1l7 .3M16.2 8.3l1 7.2" />
    </>
  ),
  community: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 20c0-2.5-1.6-4.7-4-5.5" />
    </>
  ),
  gathering: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <circle cx="12" cy="15" r="1.4" />
    </>
  ),
  project: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h5" />
      <path d="m7.5 17 1.5 1.5L12.5 15" />
    </>
  ),
  knowledge: (
    <>
      <path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5Z" />
      <path d="M12 6v13.5" />
    </>
  ),
  place: (
    <>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.6 0 2.2-1 1.6-2.2-.6-1.4.4-2.8 1.9-2.8H18a3 3 0 0 0 3-3c0-5-4-10-9-10Z" />
      <circle cx="8" cy="9" r="1.2" />
      <circle cx="12" cy="7" r="1.2" />
      <circle cx="16" cy="10" r="1.2" />
      <circle cx="8" cy="14" r="1.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  edit: (
    <>
      <path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15" r="1.3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 9 9M16 16l2-2M19 19l2-2" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 7" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  mapPin: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 10v4M12 17.2v.3" />
    </>
  ),
  download: <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />,
  upload: <path d="M12 21V9M7 14l5-5 5 5M4 4h16" />,
  refresh: (
    <>
      <path d="M4 11a8 8 0 0 1 13.8-5L21 9" />
      <path d="M21 4v5h-5" />
      <path d="M20 13a8 8 0 0 1-13.8 5L3 15" />
      <path d="M3 20v-5h5" />
    </>
  ),
  arrowRight: <path d="M4 12h16M14 6l6 6-6 6" />,
  shield: (
    <>
      <path d="M12 3 4 6v6c0 5 3.4 8.2 8 9.5 4.6-1.3 8-4.5 8-9.5V6l-8-3Z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9 12 3.5Z" />
      <path d="M19 16.5v3M17.5 18h3M5 3.5v3M3.5 5h3" />
    </>
  ),
  filter: <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />,
  leaf: (
    <>
      <path d="M20 4C10 4 4 9 4 16c0 2 1 4 2 4 0-7 5-11 12-12" />
      <path d="M6 20c1-5 4-8 9-9" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  external: <path d="M14 4h6v6M20 4l-9 9M19 14v6H4V5h6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.7v.4" />
    </>
  ),
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronDown: <path d="m5 9 7 7 7-7" />,
  send: <path d="m4 12 16-8-6 16-2.5-6L4 12Z" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.5 6c.5-.1 1-.2 1.5-.2 6 0 9.5 6.2 9.5 6.2a17 17 0 0 1-2.8 3.6M6.4 7.5A17 17 0 0 0 2.5 12S6 18.4 12 18.4c1.6 0 3-.5 4.2-1.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  ruler: (
    <>
      <path d="m3 15 12-12 6 6L9 21l-6-6Z" />
      <path d="m8 10 2 2M11 7l2 2M14 4l2 2" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.8" />
      <path d="M5 5.5v13c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-13" />
      <path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" />
    </>
  ),
  wifiOff: (
    <>
      <path d="M3 3l18 18M8.5 15.5a5 5 0 0 1 6.5-.3M5 12.2a10 10 0 0 1 3.5-2M19 12.2a10 10 0 0 0-3-1.7M2 8.5a15 15 0 0 1 4.5-2.7M22 8.5a15 15 0 0 0-9.8-3.4" />
      <path d="M12 19h.01" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 14.4c2.1.7 3.5 2.9 3.5 5.6" />
    </>
  ),
  book: (
    <>
      <path d="M4 5h7a2 2 0 0 1 2 2v13a2.5 2.5 0 0 0-2.5-2.5H4V5Z" />
      <path d="M20 5h-7v13h6.5A2.5 2.5 0 0 1 20 20V5Z" />
    </>
  ),
  heart: <path d="M12 20s-8-4.6-8-10a4.4 4.4 0 0 1 8-2.7A4.4 4.4 0 0 1 20 10c0 5.4-8 10-8 10Z" />,
  pin: (
    <>
      <path d="M9 4h6l-1 5 3 3H7l3-3-1-5Z" />
      <path d="M12 12v8" />
    </>
  ),
  cancel: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.5 6.5l11 11" />
    </>
  ),
};

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
