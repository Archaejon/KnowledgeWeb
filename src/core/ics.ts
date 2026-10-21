import type { Gathering } from './types';

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function stamp(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Minimal RFC 5545 export for a single gathering. Contains only details the
 * viewer can already see. Calendar apps import this as a normal event; nothing
 * is published to a calendar service by this app.
 */
export function gatheringIcs(gathering: Gathering, communityName: string): string {
  const end =
    gathering.endsAt ??
    new Date(new Date(gathering.startsAt).getTime() + 2 * 60 * 60 * 1000).toISOString();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Understory//Consent-based community node//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(gathering.id)}@understory.local`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(gathering.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeIcs(gathering.title)}`,
    `DESCRIPTION:${escapeIcs(
      `${gathering.description}\n\n${communityName} · ${gathering.kind.replace('-', ' ')}\nOrganised by a community member. Exported from a local Understory node.`,
    )}`,
    `LOCATION:${escapeIcs(`${gathering.venueName}, ${gathering.locality}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}
