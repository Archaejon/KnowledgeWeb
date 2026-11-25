/**
 * Understory data model — versioned, storage-agnostic.
 *
 * Everything here is plain JSON so a node's database can be exported,
 * inspected, signed, or moved onto another transport without touching UI code.
 * See docs/architecture.md#data-model.
 */

export const SCHEMA_VERSION = 1;

export type ThemeId = 'web' | 'tree' | 'mycelium';
export type ActorId = string;

/**
 * Sharing scope of a record. A record has exactly one scope.
 * - private: author only.
 * - relationship: author and every active bilateral partner (all-or-nothing).
 * - community: author and participants of an ACTIVE group agreement for that
 *   community. Membership alone is never enough.
 * - public: everyone on this node.
 */
export type Scope = 'private' | 'relationship' | 'community' | 'public';

export type RelationshipStatus = 'pending' | 'active' | 'declined' | 'revoked';
export type ConsentResponse = 'accepted' | 'declined' | 'pending';
export type MembershipStatus = 'active' | 'pending' | 'left';

export interface Person {
  id: string;
  name: string;
  handle: string;
  /** Human readable node address. Not a network identifier. */
  nodeLabel: string;
  pronouns?: string;
  locality: string;
  bio: string;
  skills: string[];
  /** Simulated key fingerprint for the prototype. Not cryptography. */
  keyFingerprint: string;
  joinedAt: string;
  /** Whether this person appears in member directories. Defaults to false. */
  directoryOptIn: boolean;
  isSample?: boolean;
  /**
   * Real Ed25519 public key (base64url, raw 32 bytes) for a node owner created
   * with "Create your node", or for a remote peer. Absent on simulated people.
   */
  publicKey?: string;
  /** True for a person who lives on another node and reached this one over a live connection. */
  remote?: boolean;
}

/**
 * Live peer link carried by a relationship made through an invite link. The
 * room secret is shared only between the two nodes; it names the WebRTC
 * meeting room and encrypts its signalling.
 */
export interface PeerLink {
  room: string;
  /** The partner's public key; every connection must prove possession of it. */
  partnerKey: string;
  lastSyncAt?: string;
  /** Set after a local revocation until the partner has been told. */
  revokeNoticePending?: boolean;
}

/** An invite link this node has created. */
export interface PeerInvite {
  id: string;
  room: string;
  createdAt: string;
  message?: string;
  status: 'open' | 'used' | 'cancelled';
  usedBy?: string;
}

export interface Membership {
  personId: string;
  role: 'steward' | 'member';
  status: MembershipStatus;
  joinedAt: string;
  note?: string;
}

export type CommunityPurpose =
  | 'locality'
  | 'practical-work'
  | 'study'
  | 'regeneration'
  | 'research'
  | 'culture'
  | 'mutual-aid'
  | 'other';

export interface Community {
  id: string;
  name: string;
  description: string;
  purpose: CommunityPurpose;
  principles: string[];
  locality: string;
  geographicArea: string;
  createdAt: string;
  createdBy: string;
  members: Membership[];
  /** Open to join requests vs. steward invitation only. */
  joinPolicy: 'open' | 'request';
  /** Whether a public membership directory is advertised (members still opt in individually). */
  advertiseDirectory: boolean;
  isSample?: boolean;
}

export interface PersonRelationship {
  id: string;
  aId: string;
  bId: string;
  initiatedBy: string;
  status: RelationshipStatus;
  proposedAt: string;
  respondedAt?: string;
  message?: string;
  revokedAt?: string;
  revokedBy?: string;
  /**
   * Local-only record of whether this node holds cached copies from this
   * relationship. True while records received over a live peer link are held.
   */
  cachedCopiesHeld: boolean;
  /** Present when the relationship was made over a live peer connection. */
  peer?: PeerLink;
}

export interface GroupAgreementResponse {
  personId: string;
  state: ConsentResponse;
  at?: string;
  note?: string;
}

/**
 * A group-wide knowledge-sharing agreement. It activates only when every
 * required participant has explicitly accepted. One decline keeps it inactive.
 */
export interface GroupAgreement {
  id: string;
  communityId: string;
  title: string;
  description: string;
  proposedBy: string;
  createdAt: string;
  responses: GroupAgreementResponse[];
  withdrawnAt?: string;
  withdrawnBy?: string;
}

export type AgreementPartyState = 'pending' | 'accepted' | 'declined';

export interface InterCommunityAgreement {
  id: string;
  title: string;
  terms: string;
  proposedBy: string;
  createdAt: string;
  parties: {
    communityId: string;
    state: AgreementPartyState;
    decidedBy?: string;
    decidedAt?: string;
  }[];
  withdrawnAt?: string;
}

export type KnowledgeKind =
  | 'note'
  | 'observation'
  | 'research'
  | 'meeting-note'
  | 'guide'
  | 'oral-history'
  | 'dataset'
  | 'lesson';

export type LinkKind = 'website' | 'document' | 'person' | 'dataset' | 'other';

export interface KnowledgeLink {
  label: string;
  url?: string;
  note?: string;
  kind: LinkKind;
}

export interface KnowledgeVersion {
  at: string;
  byId: string;
  note: string;
  title: string;
  body: string;
  scope: Scope;
}

export type AttachmentKind = 'file' | 'recording';

export interface AttachmentTranscript {
  text: string;
  provider: string;
  model: string;
  at: string;
}

/**
 * A file or voice note that belongs to one knowledge record. Bytes live in the
 * record as a data URL so local backups and exports stay self-contained. The
 * attachment inherits the record's sharing scope; it never has its own.
 */
export interface KnowledgeAttachment {
  id: string;
  name: string;
  mime: string;
  /** Stored byte size, decoded. */
  size: number;
  kind: AttachmentKind;
  addedAt: string;
  dataUrl: string;
  /** Present for recordings. */
  durationSeconds?: number;
  /** Set when a local speech-to-text service has transcribed a recording. */
  transcript?: AttachmentTranscript;
}

export interface KnowledgeRecord {
  id: string;
  title: string;
  body: string;
  authorId: string;
  kind: KnowledgeKind;
  tags: string[];
  scope: Scope;
  communityId?: string;
  projectId?: string;
  gatheringId?: string;
  placeId?: string;
  createdAt: string;
  updatedAt: string;
  versions: KnowledgeVersion[];
  links: KnowledgeLink[];
  sources: string[];
  /** Optional so records created before attachments existed still load. */
  attachments?: KnowledgeAttachment[];
  /** Sample/demo records are labelled in the UI. */
  isSample?: boolean;
}

export type ObservationKind =
  | 'temperature'
  | 'soil-moisture'
  | 'water-table'
  | 'rainfall'
  | 'soil-ph'
  | 'biodiversity-count'
  | 'regeneration-note';

export type NodalLocationKind =
  | 'gathering-spot'
  | 'community-centre'
  | 'commune'
  | 'workshop'
  | 'learning-space'
  | 'other';

/**
 * Directory visibility of a nodal location. This controls who can see the
 * venue record itself, not the precision of its coordinates. Precise
 * coordinates remain governed by the place's coordinatePolicy.
 */
export type NodalVisibility = 'public' | 'community' | 'private';

export interface NodalDetails {
  kind: NodalLocationKind;
  description: string;
  accessNotes: string;
  visibility: NodalVisibility;
  themes: string[];
  capacity?: number;
  contactId?: string;
}

export interface Place {
  id: string;
  ownerId: string;
  name: string;
  locality: string;
  /** Coordinates are displayed only to viewers allowed by coordinatePolicy. */
  lat?: number;
  lng?: number;
  coordinatePolicy: 'open' | 'community' | 'owner-only';
  communityId?: string;
  note?: string;
  /** Present when this place is also a nodal location for in-person exchange. */
  nodal?: NodalDetails;
  isSample?: boolean;
}

export interface Observation {
  id: string;
  title: string;
  kind: ObservationKind;
  value: number | null;
  unit: string;
  observedAt: string;
  placeId: string;
  method: string;
  observerId: string;
  notes: string;
  scope: Scope;
  communityId?: string;
  projectId?: string;
  isSample?: boolean;
}

export type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked';

export interface Task {
  id: string;
  title: string;
  detail?: string;
  assigneeId?: string;
  dueDate?: string;
  status: TaskStatus;
  createdBy: string;
  createdAt: string;
}

export type ProjectStatus = 'proposed' | 'active' | 'paused' | 'complete';

export interface Project {
  id: string;
  communityId: string;
  title: string;
  summary: string;
  objective: string;
  outcomes: string;
  status: ProjectStatus;
  leadId: string;
  participants: string[];
  startDate?: string;
  targetDate?: string;
  tasks: Task[];
  resources: { id: string; name: string; note: string; status: 'needed' | 'secured' }[];
  knowledgeIds: string[];
  lessons: string[];
  createdAt: string;
  isSample?: boolean;
}

export type GatheringKind =
  | 'meeting'
  | 'study-circle'
  | 'workshop'
  | 'shared-meal'
  | 'working-party'
  | 'fieldwork'
  | 'event';

export type GatheringStatus = 'planned' | 'confirmed' | 'completed' | 'cancelled';
export type AttendanceState = 'going' | 'maybe' | 'declined' | 'no-response';

export interface AttendeeResponse {
  personId: string;
  state: AttendanceState;
  note?: string;
  at?: string;
}

export interface GatheringOutcome {
  recordedBy: string;
  recordedAt: string;
  notes: string;
  decisions: string[];
  lessons: string[];
  followUps: string[];
}

export interface Gathering {
  id: string;
  communityId: string;
  title: string;
  kind: GatheringKind;
  description: string;
  startsAt: string;
  endsAt?: string;
  venueName: string;
  locality: string;
  /** Optional link to a nodal location used as the venue. */
  nodalLocationId?: string;
  organiserId: string;
  capacity?: number;
  agenda: { id: string; title: string; minutes?: number }[];
  requirements: string[];
  responses: AttendeeResponse[];
  status: GatheringStatus;
  outcomes?: GatheringOutcome;
  knowledgeIds: string[];
  createdAt: string;
  isSample?: boolean;
}

export type ConsentEventKind =
  | 'invitation-sent'
  | 'invitation-accepted'
  | 'invitation-declined'
  | 'relationship-revoked'
  | 'group-proposed'
  | 'group-accepted'
  | 'group-declined'
  | 'group-withdrawn'
  | 'membership-joined'
  | 'membership-left'
  | 'community-created'
  | 'agreement-proposed'
  | 'agreement-accepted'
  | 'agreement-declined'
  | 'record-deleted'
  | 'peer-invite-created'
  | 'peer-invite-cancelled';

/**
 * Audit trail of consent changes. Deliberately contains no private content —
 * only who, when and which agreement or relationship changed.
 */
export interface ConsentEvent {
  id: string;
  at: string;
  kind: ConsentEventKind;
  actorId: ActorId;
  detail: string;
  relationshipId?: string;
  agreementId?: string;
  communityId?: string;
  subjectIds?: string[];
}

export interface AiSettings {
  enabled: boolean;
  provider: 'none' | 'ollama';
  endpoint: string;
  model: string;
  timeoutMs: number;
  /**
   * Optional OpenAI-compatible speech-to-text endpoint (for example a local
   * whisper.cpp or faster-whisper server). Transcription stays unavailable
   * until both this and the model are set.
   */
  transcriptionEndpoint?: string;
  transcriptionModel?: string;
}

export interface NodeSettings {
  theme: ThemeId;
  /** Demo-only acting identity selector. */
  actorId: ActorId;
  ai: AiSettings;
  showSampleBanner: boolean;
}

export interface NodeIdentity {
  id: string;
  name: string;
  createdAt: string;
  softwareVersion: string;
  /** True when the node is a local browser prototype rather than a server node. */
  prototype: boolean;
  /** Person ID of the node owner when the node has a real key pair. */
  ownerId?: string;
}

export interface NodeData {
  schemaVersion: number;
  node: NodeIdentity;
  people: Person[];
  communities: Community[];
  relationships: PersonRelationship[];
  groupAgreements: GroupAgreement[];
  interCommunityAgreements: InterCommunityAgreement[];
  knowledge: KnowledgeRecord[];
  observations: Observation[];
  places: Place[];
  projects: Project[];
  gatherings: Gathering[];
  consentLog: ConsentEvent[];
  /** Invite links created on this node. Optional so older nodes still load. */
  invites?: PeerInvite[];
}

export interface PersistedState {
  schemaVersion: number;
  data: NodeData;
  settings: NodeSettings;
}

/** Shape used by any record that participates in the sharing model. */
export interface Shareable {
  id: string;
  scope: Scope;
  authorId: string;
  communityId?: string;
}
