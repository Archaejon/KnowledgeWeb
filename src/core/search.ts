import { visibleKnowledge } from './access';
import type { KnowledgeKind, KnowledgeRecord, NodeData, Scope } from './types';

export interface KnowledgeFilters {
  scope?: Scope | 'all';
  communityId?: string | 'all';
  kind?: KnowledgeKind | 'all';
  authorId?: string | 'all';
  tag?: string | null;
}

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

/** File names and transcripts are readable text on the record, so they search too. */
function attachmentText(record: KnowledgeRecord): string {
  return (record.attachments ?? [])
    .map((attachment) => `${attachment.name} ${attachment.transcript?.text ?? ''}`)
    .join(' ')
    .toLowerCase();
}

function scoreRecord(record: KnowledgeRecord, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const title = record.title.toLowerCase();
  const tags = record.tags.join(' ').toLowerCase();
  const body = record.body.toLowerCase();
  const sources = record.sources.join(' ').toLowerCase();
  const attachments = attachmentText(record);
  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 6;
    if (tags.includes(token)) score += 4;
    if (sources.includes(token)) score += 2;
    if (attachments.includes(token)) score += 2;
    if (body.includes(token)) score += 1;
  }
  return score;
}

/**
 * Search is applied only after the access engine has filtered the corpus.
 * There is no path from search to an unauthorised record.
 */
export function searchKnowledge(
  db: NodeData,
  viewerId: string,
  query: string,
  filters: KnowledgeFilters = {},
  records?: KnowledgeRecord[],
): KnowledgeRecord[] {
  const visible = records ?? visibleKnowledge(db, viewerId);
  const tokens = tokenize(query);
  const filtered = visible.filter((record) => {
    if (filters.scope && filters.scope !== 'all' && record.scope !== filters.scope) return false;
    if (
      filters.communityId &&
      filters.communityId !== 'all' &&
      record.communityId !== filters.communityId
    ) {
      return false;
    }
    if (filters.kind && filters.kind !== 'all' && record.kind !== filters.kind) return false;
    if (filters.authorId && filters.authorId !== 'all' && record.authorId !== filters.authorId) {
      return false;
    }
    if (filters.tag && !record.tags.includes(filters.tag)) return false;
    if (tokens.length > 0) {
      const haystack = `${record.title} ${record.tags.join(' ')} ${record.body} ${record.sources.join(' ')} ${attachmentText(record)}`.toLowerCase();
      if (!tokens.every((token) => haystack.includes(token))) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (tokens.length > 0) {
      const difference = scoreRecord(b, tokens) - scoreRecord(a, tokens);
      if (difference !== 0) return difference;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function knowledgeTags(db: NodeData, viewerId: string): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const record of visibleKnowledge(db, viewerId)) {
    for (const tag of record.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
