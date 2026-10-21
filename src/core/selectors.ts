import {
  canRead,
  canViewCommunity,
  canViewGathering,
  canViewNodalLocation,
  canViewPlace,
  canViewProject,
  visibleKnowledge,
  visibleObservations,
} from './access';
import type {
  AttendanceState,
  Community,
  Gathering,
  KnowledgeRecord,
  NodeData,
  Observation,
  ObservationKind,
  Place,
  Project,
} from './types';
import type { ChartSeries } from '../components/TrendChart';

export function myCommunities(db: NodeData, actorId: string): Community[] {
  return db.communities.filter((c) => canViewCommunity(db, actorId, c));
}

export function myProjects(db: NodeData, actorId: string): Project[] {
  return db.projects.filter((p) => canViewProject(db, actorId, p));
}

export function myGatherings(db: NodeData, actorId: string): Gathering[] {
  return db.gatherings.filter((g) => canViewGathering(db, actorId, g));
}

export function communityName(db: NodeData, id: string | undefined): string {
  if (!id) return 'No community';
  return db.communities.find((c) => c.id === id)?.name ?? 'Unknown community';
}

export function projectProgress(project: Project): number {
  if (project.tasks.length === 0) return project.status === 'complete' ? 100 : 0;
  const done = project.tasks.filter((t) => t.status === 'done').length;
  return Math.round((done / project.tasks.length) * 100);
}

export function attendanceFor(gathering: Gathering, personId: string): AttendanceState {
  return gathering.responses.find((r) => r.personId === personId)?.state ?? 'no-response';
}

export function attendanceCounts(gathering: Gathering) {
  return {
    going: gathering.responses.filter((r) => r.state === 'going').length,
    maybe: gathering.responses.filter((r) => r.state === 'maybe').length,
    declined: gathering.responses.filter((r) => r.state === 'declined').length,
  };
}

export function upcomingGatherings(db: NodeData, actorId: string, limit?: number): Gathering[] {
  const now = Date.now() - 2 * 60 * 60 * 1000;
  const list = myGatherings(db, actorId)
    .filter(
      (g) =>
        (g.status === 'planned' || g.status === 'confirmed') &&
        new Date(g.startsAt).getTime() > now,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return limit ? list.slice(0, limit) : list;
}

export function pastGatherings(db: NodeData, actorId: string): Gathering[] {
  return myGatherings(db, actorId)
    .filter(
      (g) =>
        g.status === 'completed' ||
        g.status === 'cancelled' ||
        new Date(g.startsAt).getTime() < Date.now(),
    )
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

/** Knowledge linked to a gathering, filtered to what the viewer may read. */
export function gatheringKnowledge(
  db: NodeData,
  actorId: string,
  gathering: Gathering,
): KnowledgeRecord[] {
  return db.knowledge.filter(
    (k) =>
      (gathering.knowledgeIds.includes(k.id) || k.gatheringId === gathering.id) &&
      canRead(db, actorId, k),
  );
}

export function projectKnowledge(
  db: NodeData,
  actorId: string,
  project: Project,
): KnowledgeRecord[] {
  return db.knowledge.filter(
    (k) =>
      (project.knowledgeIds.includes(k.id) || k.projectId === project.id) &&
      canRead(db, actorId, k),
  );
}

/** All knowledge the viewer may read, newest changes first. */
export function readableKnowledge(db: NodeData, actorId: string): KnowledgeRecord[] {
  return visibleKnowledge(db, actorId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function sharedWithViewer(db: NodeData, actorId: string): KnowledgeRecord[] {
  return readableKnowledge(db, actorId).filter((k) => k.authorId !== actorId);
}

export function placesWithVisibleData(db: NodeData, actorId: string) {
  const observations = visibleObservations(db, actorId);
  const placeIds = new Set(observations.map((o) => o.placeId));
  const places = db.places.filter((p) => canViewPlace(db, actorId, p) || placeIds.has(p.id));
  return { observations, places };
}

/** Nodal locations the viewer may see in the directory. */
export function visibleNodalLocations(db: NodeData, actorId: string): Place[] {
  return db.places
    .filter((place) => canViewNodalLocation(db, actorId, place))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Knowledge explicitly linked to a place and readable by the viewer. */
export function knowledgeAtPlace(
  db: NodeData,
  actorId: string,
  placeId: string,
): KnowledgeRecord[] {
  return visibleKnowledge(db, actorId)
    .filter((record) => record.placeId === placeId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function visibleObservationList(
  db: NodeData,
  actorId: string,
  filters: { kind?: ObservationKind | 'all'; placeId?: string; from?: string } = {},
): Observation[] {
  return visibleObservations(db, actorId)
    .filter((o) => (filters.kind && filters.kind !== 'all' ? o.kind === filters.kind : true))
    .filter((o) => (filters.placeId && filters.placeId !== 'all' ? o.placeId === filters.placeId : true))
    .filter((o) => (filters.from ? new Date(o.observedAt) >= new Date(filters.from) : true))
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

export function observationSeries(
  observations: Observation[],
  placeById: Map<string, Place>,
): ChartSeries[] {
  const byPlace = new Map<string, ChartSeries>();
  for (const observation of observations) {
    if (observation.value === null) continue;
    const place = placeById.get(observation.placeId);
    if (!place) continue;
    const series = byPlace.get(place.id) ?? { id: place.id, label: place.name, points: [] };
    series.points.push({
      id: observation.id,
      at: observation.observedAt,
      value: observation.value,
      label: observation.title,
    });
    byPlace.set(place.id, series);
  }
  return Array.from(byPlace.values());
}

export interface ObservationSummary {
  count: number;
  numericCount: number;
  min?: number;
  max?: number;
  mean?: number;
  first?: number;
  last?: number;
  change?: number;
  firstAt?: string;
  lastAt?: string;
}

export function summarizeObservations(observations: Observation[]): ObservationSummary {
  const numeric = observations.filter((o) => o.value !== null) as (Observation & { value: number })[];
  if (numeric.length === 0) {
    return { count: observations.length, numericCount: 0 };
  }
  const values = numeric.map((o) => o.value);
  const sorted = [...numeric].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const first = sorted[0].value;
  const last = sorted[sorted.length - 1].value;
  return {
    count: observations.length,
    numericCount: numeric.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    first,
    last,
    change: last - first,
    firstAt: sorted[0].observedAt,
    lastAt: sorted[sorted.length - 1].observedAt,
  };
}

export function knownCommunity(db: NodeData, id: string | undefined): Community | undefined {
  return id ? db.communities.find((c) => c.id === id) : undefined;
}
