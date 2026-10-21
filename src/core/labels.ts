import type {
  CommunityPurpose,
  GatheringKind,
  KnowledgeKind,
  NodalLocationKind,
  NodalVisibility,
  ObservationKind,
  ProjectStatus,
  TaskStatus,
} from './types';

export const PURPOSE_LABELS: Record<CommunityPurpose, string> = {
  locality: 'Geographic locality',
  'practical-work': 'Shared practical work',
  study: 'Study & learning',
  regeneration: 'Ecological regeneration',
  research: 'Research & knowledge exchange',
  culture: 'Cultural activities',
  'mutual-aid': 'Mutual aid',
  other: 'Community-defined',
};

export const NODAL_KIND_LABELS: Record<NodalLocationKind, string> = {
  'gathering-spot': 'Gathering spot',
  'community-centre': 'Community centre',
  commune: 'Commune / co-living',
  workshop: 'Workshop / makerspace',
  'learning-space': 'Study & learning space',
  other: 'Other nodal place',
};

export const NODAL_KIND_HINTS: Record<NodalLocationKind, string> = {
  'gathering-spot': 'A regular meeting point: a bench, shelter, fire circle or field edge.',
  'community-centre': 'A hall, room or shared building that hosts community activity.',
  commune: 'A shared household or co-living project that welcomes exchange.',
  workshop: 'A tool shed, makerspace, repair bench or practical working place.',
  'learning-space': 'A study room, library corner or place used for reading groups.',
  other: 'A place that does not fit the other categories.',
};

export const NODAL_VISIBILITY_LABELS: Record<NodalVisibility, string> = {
  public: 'Public to this node',
  community: 'Active community members',
  private: 'Only me',
};

export const GATHERING_KIND_LABELS: Record<GatheringKind, string> = {
  meeting: 'Meeting',
  'study-circle': 'Study circle',
  workshop: 'Workshop',
  'shared-meal': 'Shared meal',
  'working-party': 'Working party',
  fieldwork: 'Local fieldwork',
  event: 'Community event',
};

export const KNOWLEDGE_KIND_LABELS: Record<KnowledgeKind, string> = {
  note: 'Note',
  observation: 'Observation',
  research: 'Research',
  'meeting-note': 'Meeting note',
  guide: 'Guide',
  'oral-history': 'Oral history',
  dataset: 'Dataset',
  lesson: 'Lessons learned',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  proposed: 'Proposed',
  active: 'Active',
  paused: 'Paused',
  complete: 'Complete',
};

export interface ObservationMetric {
  label: string;
  unit: string;
  description: string;
  valueRequired: boolean;
}

export const OBSERVATION_METRICS: Record<ObservationKind, ObservationMetric> = {
  temperature: {
    label: 'Temperature',
    unit: '°C',
    description: 'Air, water or soil temperature with the medium noted in the method.',
    valueRequired: true,
  },
  'soil-moisture': {
    label: 'Soil moisture',
    unit: '%',
    description: 'Volumetric or gravimetric moisture, noting the probe or method.',
    valueRequired: true,
  },
  'water-table': {
    label: 'Water level / table',
    unit: 'cm',
    description: 'Depth to water, river stage or water level. State the datum in the method.',
    valueRequired: true,
  },
  rainfall: {
    label: 'Rainfall',
    unit: 'mm',
    description: 'Accumulated rainfall since the previous reading.',
    valueRequired: true,
  },
  'soil-ph': {
    label: 'Soil pH',
    unit: 'pH',
    description: 'Measured pH with the sampling depth and method.',
    valueRequired: true,
  },
  'biodiversity-count': {
    label: 'Biodiversity count',
    unit: 'count',
    description: 'A count of taxa, individuals or flowering spikes. Be explicit in the method.',
    valueRequired: true,
  },
  'regeneration-note': {
    label: 'Regeneration note',
    unit: '',
    description: 'A qualitative observation of change, condition or recovery.',
    valueRequired: false,
  },
};

export const SCOPE_OPTIONS = [
  {
    value: 'private' as const,
    label: 'Private — only me',
    hint: 'Never shared through relationships or communities. Exports and AI retrieval also exclude it from others.',
  },
  {
    value: 'relationship' as const,
    label: 'Relationship-shared — active bilateral partners',
    hint: 'Every active relationship gains all of these records. Pending and declined relationships gain nothing.',
  },
  {
    value: 'community' as const,
    label: 'Group-shared — an active unanimous agreement',
    hint: 'Community membership alone is not enough. A group agreement must be active and include you.',
  },
  {
    value: 'public' as const,
    label: 'Public — anyone on this node',
    hint: 'Visible without a relationship. Do not include sensitive locations or personal details.',
  },
];
