import { describe, expect, it } from 'vitest';
import { createSampleData } from '../src/core/sample';
import { knowledgeTags, searchKnowledge } from '../src/core/search';

describe('authorised knowledge search', () => {
  it('never returns records outside the viewer’s access, even with a broad query', () => {
    const data = createSampleData();
    const results = searchKnowledge(data, 'p-mara', 'water');
    const ids = results.map((r) => r.id);
    expect(ids).toContain('k-waterlog');
    expect(ids).not.toContain('k-erosion'); // community agreement declined
    expect(ids).not.toContain('k-archive-guide'); // community agreement declined
    expect(ids).not.toContain('k-boundary'); // Mara's private record does not contain 'water'
  });

  it('includes a viewer’s own private records', () => {
    const data = createSampleData();
    const results = searchKnowledge(data, 'p-mara', 'solicitor');
    expect(results.map((r) => r.id)).toContain('k-boundary');
    const others = searchKnowledge(data, 'p-idris', 'solicitor');
    expect(others).toHaveLength(0);
  });

  it('applies scope, kind, community and tag filters after access', () => {
    const data = createSampleData();
    const publicOnly = searchKnowledge(data, 'p-mara', '', { scope: 'public' });
    expect(publicOnly.every((r) => r.scope === 'public')).toBe(true);
    const guides = searchKnowledge(data, 'p-mara', '', { kind: 'guide' });
    expect(guides.every((r) => r.kind === 'guide')).toBe(true);
    const willowbank = searchKnowledge(data, 'p-mara', '', { communityId: 'c-willowbank' });
    expect(willowbank.every((r) => r.communityId === 'c-willowbank')).toBe(true);
    const tagged = searchKnowledge(data, 'p-mara', '', { tag: 'tools' });
    expect(tagged.map((r) => r.id)).toContain('k-tools');
    expect(tagged.every((r) => r.tags.includes('tools'))).toBe(true);
  });

  it('returns only tags from authorised records', () => {
    const tags = knowledgeTags(createSampleData(), 'p-sam');
    expect(tags.some((t) => t.tag === 'hydrology')).toBe(false); // Bramble community hidden
    expect(tags.some((t) => t.tag === 'pond')).toBe(true);
  });

  it('scores title and tag matches above body matches deterministically', () => {
    const data = createSampleData();
    const results = searchKnowledge(data, 'p-mara', 'scything');
    expect(results[0]?.id).toBe('k-scythe');
  });
});
