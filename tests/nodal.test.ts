import { describe, expect, it } from 'vitest';
import { canViewNodalLocation } from '../src/core/access';
import { createSampleData } from '../src/core/sample';
import { visibleNodalLocations } from '../src/core/selectors';
import { MemoryStorageAdapter } from '../src/core/storage';
import { NodeStore } from '../src/core/store';
import type { NodalDetails } from '../src/core/types';

function newStore() {
  return new NodeStore(new MemoryStorageAdapter());
}

function nodal(overrides: Partial<NodalDetails> = {}): NodalDetails {
  return {
    kind: 'gathering-spot',
    description: 'A dry meeting place under the old oak, used for reading groups.',
    accessNotes: '',
    visibility: 'private',
    themes: ['reading'],
    ...overrides,
  };
}

describe('nodal locations', () => {
  it('shows public and member-community locations to the acting identity', () => {
    const data = createSampleData();
    const mara = visibleNodalLocations(data, 'p-mara').map((place) => place.id);
    expect(mara).toContain('pl-village-hall');
    expect(mara).toContain('pl-field-shelter');
    expect(mara).toContain('pl-tool-barn');
    expect(mara).toContain('pl-common-house');

    const outsider = visibleNodalLocations(data, 'p-tomas').map((place) => place.id);
    expect(outsider).toEqual(['pl-village-hall']);
  });

  it('hides a private nodal location from everyone except its owner', () => {
    const store = newStore();
    const id = store.createPlace({
      name: 'Quiet reading room',
      locality: 'Hollowcombe',
      coordinatePolicy: 'owner-only',
      nodal: nodal(),
    });
    const data = () => store.getSnapshot().data;
    const place = () => data().places.find((p) => p.id === id)!;

    expect(canViewNodalLocation(data(), 'p-mara', place())).toBe(true);
    store.setActor('p-tomas');
    expect(canViewNodalLocation(data(), 'p-tomas', place())).toBe(false);
    expect(visibleNodalLocations(data(), 'p-tomas').some((p) => p.id === id)).toBe(false);
  });

  it('requires a linked community for community visibility', () => {
    const store = newStore();
    expect(() =>
      store.createPlace({
        name: 'Common room',
        locality: 'Hollowcombe',
        coordinatePolicy: 'community',
        nodal: nodal({ visibility: 'community' }),
      }),
    ).toThrow(/linked community/i);

    const id = store.createPlace({
      name: 'Willowbank classroom',
      locality: 'Hollowcombe',
      coordinatePolicy: 'community',
      communityId: 'c-willowbank',
      nodal: nodal({ visibility: 'community', kind: 'learning-space' }),
    });
    const place = store.getSnapshot().data.places.find((p) => p.id === id)!;
    expect(place.nodal?.visibility).toBe('community');
    expect(canViewNodalLocation(store.getSnapshot().data, 'p-idris', place)).toBe(true);
    expect(canViewNodalLocation(store.getSnapshot().data, 'p-tomas', place)).toBe(false);
  });

  it('normalises themes and validates capacity and kind', () => {
    const store = newStore();
    const id = store.createPlace({
      name: 'Seed library',
      locality: 'Hollowcombe',
      coordinatePolicy: 'open',
      nodal: nodal({
        visibility: 'public',
        kind: 'workshop',
        capacity: 12.6,
        themes: ['  Seed Saving ', 'seed saving', 'Repair', '   ', ''],
      }),
    });
    const place = store.getSnapshot().data.places.find((p) => p.id === id)!;
    expect(place.nodal?.capacity).toBe(13);
    expect(place.nodal?.themes).toEqual(['seed saving', 'repair']);

    expect(() =>
      store.createPlace({
        name: 'Too many people',
        locality: 'Hollowcombe',
        coordinatePolicy: 'open',
        nodal: nodal({ visibility: 'public', capacity: 20000 }),
      }),
    ).toThrow(/Capacity/i);
    expect(() =>
      store.createPlace({
        name: 'Bad kind',
        locality: 'Hollowcombe',
        coordinatePolicy: 'open',
        nodal: nodal({ visibility: 'public', kind: 'nightclub' as NodalDetails['kind'] }),
      }),
    ).toThrow(/valid nodal location kind/i);
  });

  it('lets only the owner edit the nodal details', () => {
    const store = newStore();
    const id = store.createPlace({
      name: 'Bramble classroom',
      locality: 'Bramble Creek',
      coordinatePolicy: 'open',
      nodal: nodal({ visibility: 'public' }),
    });
    store.setActor('p-tomas');
    expect(() => store.updateNodalLocation(id, { name: 'Renamed by a stranger' })).toThrow(
      /owner/i,
    );
    store.setActor('p-mara');
    expect(() => store.updateNodalLocation(id, { name: 'Bramble study room' })).not.toThrow();
    expect(store.getSnapshot().data.places.find((p) => p.id === id)!.name).toBe(
      'Bramble study room',
    );
  });

  it('refuses a gathering venue the planner cannot see', () => {
    const store = newStore();
    store.setActor('p-tomas');
    const hiddenId = store.createPlace({
      name: "Tomas's private hut",
      locality: 'Hollowcombe',
      coordinatePolicy: 'owner-only',
      nodal: nodal({ visibility: 'private' }),
    });

    store.setActor('p-mara');
    expect(() =>
      store.createGathering({
        communityId: 'c-willowbank',
        title: 'Field reading',
        kind: 'meeting',
        description: 'Reading group at a venue I cannot see.',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        venueName: "Tomas's private hut",
        locality: 'Hollowcombe',
        nodalLocationId: hiddenId,
        agenda: [],
        requirements: [],
      }),
    ).toThrow(/venue|nodal/i);
  });
});
