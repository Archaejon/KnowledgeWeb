import type { ThemeId } from '../core/types';

export function ThemeMark({ theme, size = 32 }: { theme: ThemeId; size?: number }) {
  if (theme === 'tree') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M20 36V18M20 26c-5-1-8-4-9-9M20 22c5-1 8-4 9-10M20 18c0-4 2-7 6-9M20 20c-3-2-4-5-4-9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="11" cy="15" r="2.4" fill="currentColor" opacity=".65" />
        <circle cx="29" cy="10" r="2.8" fill="currentColor" opacity=".8" />
        <circle cx="16" cy="9" r="2" fill="currentColor" opacity=".5" />
        <path d="M13 33c2-1.5 4-2.2 7-2.2s5 .7 7 2.2" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (theme === 'mycelium') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M20 37c0-8-2-12-6-16M20 30c-6 1-9-1-12-5M20 27c6 1 9-2 12-6M20 34c4-2 7-2 10-1M20 20c-2-5-1-9 2-13M18 23c-5 0-8-2-10-6"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="22" cy="8" r="4" fill="currentColor" opacity=".22" />
        <circle cx="22" cy="8" r="1.6" fill="currentColor" opacity=".7" />
        <circle cx="8" cy="18" r="1.2" fill="currentColor" />
        <circle cx="31" cy="22" r="1.4" fill="currentColor" />
        <circle cx="10" cy="27" r="1" fill="currentColor" />
        <circle cx="30" cy="33" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="3.2" fill="currentColor" opacity=".8" />
      <circle cx="20" cy="20" r="11" stroke="currentColor" strokeWidth="1.1" opacity=".55" />
      <circle cx="20" cy="20" r="17.5" stroke="currentColor" strokeWidth=".9" opacity=".32" />
      <path
        d="M20 3v34M3 20h34M8 8l24 24M32 8 8 32M13 5.5 20 20l7-14.5M13 34.5 20 20l7 14.5M4.5 14 20 20l-15.5 6M35.5 14 20 20l15.5 6"
        stroke="currentColor"
        strokeWidth=".8"
        opacity=".55"
      />
      <circle cx="20" cy="9" r="1.5" fill="currentColor" />
      <circle cx="31" cy="20" r="1.5" fill="currentColor" opacity=".8" />
      <circle cx="14.5" cy="30" r="1.3" fill="currentColor" opacity=".6" />
    </svg>
  );
}
