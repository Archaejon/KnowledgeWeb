const DAY = 24 * 60 * 60 * 1000;

export function isoNow(): string {
  return new Date().toISOString();
}

export function daysFromNow(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function daysAgo(days: number, hour = 10): string {
  return daysFromNow(-days, hour);
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(iso));
}

export function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const days = Math.round(diff / DAY);
  if (abs < 60 * 60 * 1000) {
    const mins = Math.round(diff / 60000);
    return mins === 0 ? 'now' : mins > 0 ? `in ${mins} min` : `${-mins} min ago`;
  }
  if (abs < DAY) {
    const hours = Math.round(diff / (60 * 60 * 1000));
    return hours > 0 ? `in ${hours} h` : `${-hours} h ago`;
  }
  if (days === 0) return 'today';
  if (days > 0) return days === 1 ? 'tomorrow' : `in ${days} days`;
  return days === -1 ? 'yesterday' : `${-days} days ago`;
}

export function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string {
  return value ? new Date(value).toISOString() : '';
}
