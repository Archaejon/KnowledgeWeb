/**
 * Local node service.
 *
 * All writes go through this class. It validates inputs, checks the acting
 * identity, records consent changes, and persists the whole node through a
 * replaceable StorageAdapter. UI components never mutate node data directly.
 *
 * Prototype boundary: identities are simulated and there is no transport or
 * remote authentication yet. Access decisions are enforced here and in
 * core/access.ts, but a production node would run these checks server-side on
 * authenticated, encrypted connections.
 */
import {
  canManageCommunity,
  canRead,
  canViewGathering,
  canViewNodalLocation,
  canViewProject,
} from './access';
import {
  attachmentBytes,
  attachmentLimitError,
  attachmentsOf,
  formatBytes,
  nodeAttachmentBytes,
  normaliseAttachments,
  ATTACHMENT_LIMITS,
} from './attachments';
import { groupAgreementStatus, isActiveMember, relationshipFor } from './consent';
import { isoNow } from './dates';
import { createDefaultSettings, createNewNode, createSampleData } from './sample';
import type { StorageAdapter } from './storage';
import { MemoryStorageAdapter } from './storage';
import { SCHEMA_VERSION } from './types';
import type {
  ActorId,
  AiSettings,
  AttendanceState,
  Community,
  CommunityPurpose,
  ConsentEvent,
  ConsentEventKind,
  Gathering,
  GatheringKind,
  GatheringOutcome,
  GatheringStatus,
  GroupAgreement,
  InterCommunityAgreement,
  KnowledgeAttachment,
  KnowledgeKind,
  KnowledgeLink,
  KnowledgeRecord,
  NodalDetails,
  NodeData,
  NodeSettings,
  Observation,
  ObservationKind,
  Person,
  PersonRelationship,
  Place,
  Project,
  Scope,
  Task,
  TaskStatus,
  ThemeId,
} from './types';
import { optionalText, requireText, validatePersistedState } from './validation';

export interface StoreSnapshot {
  data: NodeData;
  settings: NodeSettings;
  lastSavedAt?: string;
  storageError?: string;
  loadNotice?: string;
}

export interface KnowledgeInput {
  title: string;
  body: string;
  kind: KnowledgeKind;
  tags: string[];
  scope: Scope;
  communityId?: string;
  projectId?: string;
  gatheringId?: string;
  placeId?: string;
  links: KnowledgeLink[];
  sources: string[];
  /** Files and voice notes. Omitted means "leave unchanged". */
  attachments?: KnowledgeAttachment[];
}

export interface GatheringInput {
  communityId: string;
  title: string;
  kind: GatheringKind;
  description: string;
  startsAt: string;
  endsAt?: string;
  venueName: string;
  locality: string;
  nodalLocationId?: string;
  capacity?: number;
  agenda: string[];
  requirements: string[];
}

export interface ProjectInput {
  communityId: string;
  title: string;
  summary: string;
  objective: string;
  targetDate?: string;
  participantIds: string[];
}

export interface PlaceInput {
  name: string;
  locality: string;
  lat?: number;
  lng?: number;
  coordinatePolicy: Place['coordinatePolicy'];
  communityId?: string;
  note?: string;
  nodal?: NodalDetails;
}

export interface ObservationInput {
  title: string;
  kind: ObservationKind;
  value: number | null;
  unit: string;
  observedAt: string;
  placeId: string;
  method: string;
  notes: string;
  scope: Scope;
  communityId?: string;
  projectId?: string;
}

export interface CommunityInput {
  name: string;
  description: string;
  purpose: CommunityPurpose;
  principles: string[];
  locality: string;
  geographicArea: string;
  joinPolicy: 'open' | 'request';
  advertiseDirectory: boolean;
}

function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

export class NodeStore {
  private snapshot: StoreSnapshot;
  private listeners = new Set<() => void>();
  readonly storageKind: string;

  constructor(private readonly storage: StorageAdapter = new MemoryStorageAdapter()) {
    this.storageKind = storage.kind;
    let loaded: StoreSnapshot | null = null;
    let notice: string | undefined;
    try {
      const raw = storage.load();
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        const result = validatePersistedState(parsed);
        if (result.ok) {
          loaded = parsed as StoreSnapshot;
        } else {
          notice = `Saved node data could not be loaded (${result.errors[0]}). Sample data was restored instead.`;
        }
      }
    } catch {
      notice = 'Saved node data was unreadable. Sample data was restored instead.';
    }

    this.snapshot = loaded
      ? { ...loaded, loadNotice: notice }
      : {
          data: createSampleData(),
          settings: createDefaultSettings(),
          loadNotice: notice,
        };
    this.persist();
  }

  getSnapshot = (): StoreSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private persist() {
    try {
      this.storage.save(
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          data: this.snapshot.data,
          settings: this.snapshot.settings,
        }),
      );
      this.snapshot = { ...this.snapshot, storageError: undefined, lastSavedAt: isoNow() };
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        storageError:
          error instanceof Error
            ? `Changes are held in memory but could not be saved: ${error.message}`
            : 'Changes could not be saved to this browser’s storage.',
      };
    }
  }

  private commit(data: NodeData, settings = this.snapshot.settings) {
    this.snapshot = { data, settings, lastSavedAt: this.snapshot.lastSavedAt };
    this.persist();
    this.emit();
  }

  private mutate(fn: (data: NodeData, actorId: ActorId) => void) {
    const data = structuredClone(this.snapshot.data);
    fn(data, this.snapshot.settings.actorId);
    this.commit(data);
  }

  private actor(): string {
    return this.snapshot.settings.actorId;
  }

  private log(
    data: NodeData,
    kind: ConsentEventKind,
    actorId: ActorId,
    detail: string,
    extra: Partial<ConsentEvent> = {},
  ) {
    data.consentLog.push({
      id: newId('ce'),
      at: isoNow(),
      kind,
      actorId,
      detail,
      ...extra,
    });
  }

  private requirePerson(data: NodeData, id: string): Person {
    const person = data.people.find((p) => p.id === id);
    if (!person) throw new Error('That participant does not exist on this node.');
    return person;
  }

  // ---------------------------------------------------------------- settings

  setTheme(theme: ThemeId) {
    if (!['web', 'tree', 'mycelium'].includes(theme)) return;
    this.commit(this.snapshot.data, { ...this.snapshot.settings, theme });
  }

  setActor(actorId: ActorId) {
    if (!this.snapshot.data.people.some((p) => p.id === actorId)) {
      throw new Error('That identity is not part of this node.');
    }
    this.commit(this.snapshot.data, { ...this.snapshot.settings, actorId });
  }

  updateAi(patch: Partial<AiSettings>) {
    this.commit(this.snapshot.data, {
      ...this.snapshot.settings,
      ai: { ...this.snapshot.settings.ai, ...patch },
    });
  }

  setSampleBanner(show: boolean) {
    this.commit(this.snapshot.data, { ...this.snapshot.settings, showSampleBanner: show });
  }

  updateNodeIdentity(name: string) {
    const data = structuredClone(this.snapshot.data);
    data.node.name = requireText(name, 'Node name', 2, 120);
    this.commit(data);
  }

  updateProfile(patch: Partial<Pick<Person, 'name' | 'handle' | 'locality' | 'bio' | 'skills' | 'directoryOptIn' | 'pronouns'>>) {
    const data = structuredClone(this.snapshot.data);
    const person = this.requirePerson(data, this.actor());
    if (patch.name !== undefined) person.name = requireText(patch.name, 'Name', 2, 80);
    if (patch.handle !== undefined) {
      const handle = requireText(patch.handle, 'Handle', 2, 40);
      person.handle = handle.startsWith('@') ? handle : `@${handle}`;
    }
    if (patch.locality !== undefined) person.locality = optionalText(patch.locality, 120);
    if (patch.bio !== undefined) person.bio = optionalText(patch.bio, 800);
    if (patch.pronouns !== undefined) person.pronouns = optionalText(patch.pronouns, 40);
    if (patch.skills !== undefined) person.skills = patch.skills.slice(0, 12);
    if (patch.directoryOptIn !== undefined) person.directoryOptIn = patch.directoryOptIn;
    this.commit(data);
  }

  // ------------------------------------------------------------------ import

  exportBackup(): string {
    return JSON.stringify(
      {
        format: 'understory-node-backup',
        exportedAt: isoNow(),
        schemaVersion: SCHEMA_VERSION,
        settings: this.snapshot.settings,
        data: this.snapshot.data,
      },
      null,
      2,
    );
  }

  importBackup(raw: string): { people: number; communities: number; knowledge: number } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('That file is not valid JSON.');
    }
    const result = validatePersistedState(parsed);
    if (!result.ok) {
      throw new Error(`Backup rejected: ${result.errors.join(' ')}`);
    }
    const next = parsed as { data: NodeData; settings: NodeSettings };
    this.snapshot = {
      data: next.data,
      settings: next.settings,
      loadNotice: undefined,
      storageError: undefined,
    };
    this.persist();
    this.emit();
    return {
      people: next.data.people.length,
      communities: next.data.communities.length,
      knowledge: next.data.knowledge.length,
    };
  }

  resetSampleData() {
    const previous = this.snapshot.settings;
    this.snapshot = {
      data: createSampleData(),
      settings: {
        ...createDefaultSettings(),
        theme: previous.theme,
        ai: previous.ai,
        showSampleBanner: true,
      },
    };
    this.persist();
    this.emit();
  }

  resetToEmptyNode(name = 'A new Understory node') {
    const previous = this.snapshot.settings;
    this.snapshot = {
      data: createNewNode(name),
      settings: {
        ...createDefaultSettings(),
        theme: previous.theme,
        ai: previous.ai,
        actorId: 'p-you',
      },
    };
    this.persist();
    this.emit();
  }

  // ----------------------------------------------------------- relationships

  inviteToConnect(targetId: string, message: string) {
    this.mutate((data, actorId) => {
      if (targetId === actorId) throw new Error('You cannot invite yourself.');
      const target = this.requirePerson(data, targetId);
      const current = relationshipFor(data, actorId, targetId);
      if (current?.status === 'active') throw new Error('You are already connected.');
      if (current?.status === 'pending') {
        throw new Error(
          current.initiatedBy === actorId
            ? 'An invitation is already waiting for a response.'
            : `${target.name} has already invited you. Respond to that invitation instead.`,
        );
      }
      const relationship: PersonRelationship = {
        id: newId('rel'),
        aId: actorId,
        bId: targetId,
        initiatedBy: actorId,
        status: 'pending',
        proposedAt: isoNow(),
        message: optionalText(message, 500),
        cachedCopiesHeld: false,
      };
      data.relationships.push(relationship);
      this.log(
        data,
        'invitation-sent',
        actorId,
        `Bilateral invitation sent to ${target.name}. No access granted until they accept.`,
        { relationshipId: relationship.id, subjectIds: [targetId] },
      );
    });
  }

  respondToInvitation(relationshipId: string, accept: boolean, note = '') {
    this.mutate((data, actorId) => {
      const rel = data.relationships.find((r) => r.id === relationshipId);
      if (!rel) throw new Error('Invitation not found.');
      if (rel.status !== 'pending') throw new Error('This invitation is no longer pending.');
      if (actorId !== rel.aId && actorId !== rel.bId) throw new Error('This invitation is not yours.');
      if (actorId === rel.initiatedBy) throw new Error('You cannot answer your own invitation.');
      const actor = this.requirePerson(data, actorId);
      const otherId = rel.aId === actorId ? rel.bId : rel.aId;
      const other = this.requirePerson(data, otherId);
      rel.status = accept ? 'active' : 'declined';
      rel.respondedAt = isoNow();
      if (note.trim()) rel.message = optionalText(note, 500);
      this.log(
        data,
        accept ? 'invitation-accepted' : 'invitation-declined',
        actorId,
        accept
          ? `${actor.name} activated a bilateral relationship with ${other.name}. Relationship-scoped knowledge is now mutually accessible.`
          : `${actor.name} declined the invitation from ${other.name}. No knowledge access was granted.`,
        { relationshipId: rel.id, subjectIds: [otherId] },
      );
    });
  }

  revokeRelationship(relationshipId: string) {
    this.mutate((data, actorId) => {
      const rel = data.relationships.find((r) => r.id === relationshipId);
      if (!rel) throw new Error('Relationship not found.');
      if (actorId !== rel.aId && actorId !== rel.bId) throw new Error('This relationship is not yours.');
      if (rel.status !== 'active' && rel.status !== 'pending') {
        throw new Error('Only an active relationship or a sent invitation can be revoked.');
      }
      const otherId = rel.aId === actorId ? rel.bId : rel.aId;
      const wasPending = rel.status === 'pending';
      rel.status = 'revoked';
      rel.revokedAt = isoNow();
      rel.revokedBy = actorId;
      rel.cachedCopiesHeld = false;
      this.log(
        data,
        'relationship-revoked',
        actorId,
        wasPending
          ? `Pending invitation withdrawn. No access was ever granted.`
          : `Bilateral relationship revoked. Future access is blocked. This node holds no cached copies from this relationship; independently kept copies elsewhere cannot be recalled.`,
        { relationshipId: rel.id, subjectIds: [otherId] },
      );
    });
  }

  // -------------------------------------------------------------- communities

  createCommunity(input: CommunityInput): string {
    let createdId = '';
    this.mutate((data, actorId) => {
      const name = requireText(input.name, 'Community name', 3, 120);
      const description = requireText(input.description, 'Description', 10, 3000);
      if (data.communities.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('A community with that name already exists on this node.');
      }
      const community: Community = {
        id: newId('c'),
        name,
        description,
        purpose: input.purpose,
        principles: input.principles.map((p) => p.trim()).filter(Boolean).slice(0, 12),
        locality: optionalText(input.locality, 120),
        geographicArea: optionalText(input.geographicArea, 200),
        createdAt: isoNow(),
        createdBy: actorId,
        members: [{ personId: actorId, role: 'steward', status: 'active', joinedAt: isoNow() }],
        joinPolicy: input.joinPolicy,
        advertiseDirectory: input.advertiseDirectory,
      };
      data.communities.push(community);
      createdId = community.id;
      this.log(data, 'community-created', actorId, `Created community “${name}”.`, {
        communityId: community.id,
      });
      this.log(data, 'membership-joined', actorId, `Joined “${name}” as a steward.`, {
        communityId: community.id,
      });
    });
    return createdId;
  }

  updateCommunity(communityId: string, patch: Partial<CommunityInput>) {
    this.mutate((data, actorId) => {
      const community = data.communities.find((c) => c.id === communityId);
      if (!community) throw new Error('Community not found.');
      if (!canManageCommunity(data, actorId, communityId)) {
        throw new Error('Only an active steward can change community governance.');
      }
      if (patch.name !== undefined) community.name = requireText(patch.name, 'Community name', 3, 120);
      if (patch.description !== undefined) {
        community.description = requireText(patch.description, 'Description', 10, 3000);
      }
      if (patch.principles !== undefined) {
        community.principles = patch.principles.map((p) => p.trim()).filter(Boolean).slice(0, 12);
      }
      if (patch.locality !== undefined) community.locality = optionalText(patch.locality, 120);
      if (patch.geographicArea !== undefined) {
        community.geographicArea = optionalText(patch.geographicArea, 200);
      }
      if (patch.joinPolicy !== undefined) community.joinPolicy = patch.joinPolicy;
      if (patch.advertiseDirectory !== undefined) {
        community.advertiseDirectory = patch.advertiseDirectory;
      }
    });
  }

  joinCommunity(communityId: string, note = '') {
    this.mutate((data, actorId) => {
      const community = data.communities.find((c) => c.id === communityId);
      if (!community) throw new Error('Community not found.');
      const existing = community.members.find((m) => m.personId === actorId);
      if (existing?.status === 'active') throw new Error('You are already a member.');
      if (existing?.status === 'pending') throw new Error('Your request is already waiting for a steward.');
      const active = community.joinPolicy === 'open';
      if (existing) {
        existing.status = active ? 'active' : 'pending';
        existing.joinedAt = isoNow();
        existing.note = optionalText(note, 300);
      } else {
        community.members.push({
          personId: actorId,
          role: 'member',
          status: active ? 'active' : 'pending',
          joinedAt: isoNow(),
          note: optionalText(note, 300),
        });
      }
      this.log(
        data,
        'membership-joined',
        actorId,
        active
          ? `Joined “${community.name}”. Membership does not by itself grant access to group-shared knowledge.`
          : `Requested membership of “${community.name}”. A steward must approve it.`,
        { communityId },
      );
    });
  }

  approveMembership(communityId: string, personId: string) {
    this.mutate((data, actorId) => {
      const community = data.communities.find((c) => c.id === communityId);
      if (!community) throw new Error('Community not found.');
      if (!canManageCommunity(data, actorId, communityId)) {
        throw new Error('Only an active steward can approve members.');
      }
      const membership = community.members.find((m) => m.personId === personId);
      if (!membership || membership.status !== 'pending') {
        throw new Error('No pending membership request for that person.');
      }
      membership.status = 'active';
      membership.joinedAt = isoNow();
      const person = this.requirePerson(data, personId);
      this.log(data, 'membership-joined', actorId, `Approved membership for ${person.name}.`, {
        communityId,
        subjectIds: [personId],
      });
    });
  }

  declineMembership(communityId: string, personId: string) {
    this.mutate((data, actorId) => {
      const community = data.communities.find((c) => c.id === communityId);
      if (!community) throw new Error('Community not found.');
      if (!canManageCommunity(data, actorId, communityId)) {
        throw new Error('Only an active steward can decline membership requests.');
      }
      const membership = community.members.find((m) => m.personId === personId);
      if (!membership || membership.status !== 'pending') {
        throw new Error('No pending membership request for that person.');
      }
      membership.status = 'left';
      const person = this.requirePerson(data, personId);
      this.log(
        data,
        'membership-left',
        actorId,
        `Declined the membership request from ${person.name}. No access granted.`,
        { communityId, subjectIds: [personId] },
      );
    });
  }

  leaveCommunity(communityId: string) {
    this.mutate((data, actorId) => {
      const community = data.communities.find((c) => c.id === communityId);
      if (!community) throw new Error('Community not found.');
      const membership = community.members.find((m) => m.personId === actorId);
      if (!membership || membership.status === 'left') throw new Error('You are not a member.');
      membership.status = 'left';
      this.log(
        data,
        'membership-left',
        actorId,
        `Left “${community.name}”. Group-shared access through this community ends immediately.`,
        { communityId },
      );
    });
  }

  proposeGroupAgreement(communityId: string, title: string, description: string) {
    this.mutate((data, actorId) => {
      const community = data.communities.find((c) => c.id === communityId);
      if (!community) throw new Error('Community not found.');
      if (!canManageCommunity(data, actorId, communityId)) {
        throw new Error('Only an active steward can propose a group agreement.');
      }
      const existingOpen = data.groupAgreements.find(
        (g) => g.communityId === communityId && groupAgreementStatus(g) === 'proposed',
      );
      if (existingOpen) throw new Error('There is already a group agreement awaiting responses.');
      const active = community.members.filter((m) => m.status === 'active');
      if (active.length === 0) throw new Error('A group agreement needs at least one member.');
      const agreement: GroupAgreement = {
        id: newId('ga'),
        communityId,
        title: requireText(title, 'Agreement title', 4, 140),
        description: requireText(description, 'Description', 10, 3000),
        proposedBy: actorId,
        createdAt: isoNow(),
        // Creating a proposal is not the same as consenting to it: even the
        // proposer must respond explicitly before the agreement can activate.
        responses: active.map((m) => ({
          personId: m.personId,
          state: 'pending',
        })),
      };
      data.groupAgreements.push(agreement);
      this.log(
        data,
        'group-proposed',
        actorId,
        `Proposed group agreement “${agreement.title}” for ${community.name}. Every participant, including the proposer, must explicitly accept before it activates.`,
        { agreementId: agreement.id, communityId },
      );
    });
  }

  respondToGroupAgreement(agreementId: string, accept: boolean, note = '') {
    this.mutate((data, actorId) => {
      const agreement = data.groupAgreements.find((g) => g.id === agreementId);
      if (!agreement) throw new Error('Agreement not found.');
      if (groupAgreementStatus(agreement) === 'withdrawn') throw new Error('This proposal was withdrawn.');
      const response = agreement.responses.find((r) => r.personId === actorId);
      if (!response) throw new Error('You were not named in this agreement.');
      if (response.state !== 'pending') throw new Error('You have already responded to this agreement.');
      response.state = accept ? 'accepted' : 'declined';
      response.at = isoNow();
      response.note = optionalText(note, 300);
      const community = data.communities.find((c) => c.id === agreement.communityId);
      const status = groupAgreementStatus(agreement);
      this.log(
        data,
        accept ? 'group-accepted' : 'group-declined',
        actorId,
        accept
          ? status === 'active'
            ? `Accepted “${agreement.title}”. All participants accepted: group sharing is now active.`
            : `Accepted “${agreement.title}”. Still waiting for other participants; no group access yet.`
          : `Declined “${agreement.title}”. The proposed group relationship is inactive; no group access is granted.`,
        { agreementId, communityId: community?.id },
      );
    });
  }

  revokeGroupConsent(agreementId: string) {
    this.mutate((data, actorId) => {
      const agreement = data.groupAgreements.find((g) => g.id === agreementId);
      if (!agreement) throw new Error('Agreement not found.');
      if (groupAgreementStatus(agreement) !== 'active') {
        throw new Error('Only an active agreement can have consent withdrawn.');
      }
      const response = agreement.responses.find((r) => r.personId === actorId);
      if (!response || response.state !== 'accepted') {
        throw new Error('You are not a consenting participant in this agreement.');
      }
      response.state = 'declined';
      response.at = isoNow();
      response.note = optionalText('Consent withdrawn', 300);
      const community = data.communities.find((c) => c.id === agreement.communityId);
      this.log(
        data,
        'group-declined',
        actorId,
        `Withdrew consent from group agreement “${agreement.title}”. The agreement is now inactive; group-shared access ends for all participants.`,
        { agreementId, communityId: community?.id },
      );
    });
  }

  withdrawGroupAgreement(agreementId: string) {
    this.mutate((data, actorId) => {
      const agreement = data.groupAgreements.find((g) => g.id === agreementId);
      if (!agreement) throw new Error('Agreement not found.');
      if (agreement.proposedBy !== actorId) throw new Error('Only the proposer can withdraw this.');
      if (groupAgreementStatus(agreement) !== 'proposed') {
        throw new Error('Only a proposed agreement can be withdrawn.');
      }
      agreement.withdrawnAt = isoNow();
      agreement.withdrawnBy = actorId;
      this.log(data, 'group-withdrawn', actorId, `Withdrew group agreement “${agreement.title}”.`, {
        agreementId,
        communityId: agreement.communityId,
      });
    });
  }

  proposeInterAgreement(
    communityId: string,
    otherCommunityId: string,
    title: string,
    terms: string,
  ) {
    this.mutate((data, actorId) => {
      if (communityId === otherCommunityId) throw new Error('Choose two different communities.');
      const mine = data.communities.find((c) => c.id === communityId);
      const other = data.communities.find((c) => c.id === otherCommunityId);
      if (!mine || !other) throw new Error('Community not found.');
      if (!canManageCommunity(data, actorId, communityId)) {
        throw new Error('Only a steward of the proposing community can do this.');
      }
      const agreement: InterCommunityAgreement = {
        id: newId('ia'),
        title: requireText(title, 'Agreement title', 4, 140),
        terms: requireText(terms, 'Terms', 10, 3000),
        proposedBy: actorId,
        createdAt: isoNow(),
        parties: [
          { communityId, state: 'accepted', decidedBy: actorId, decidedAt: isoNow() },
          { communityId: otherCommunityId, state: 'pending' },
        ],
      };
      data.interCommunityAgreements.push(agreement);
      this.log(
        data,
        'agreement-proposed',
        actorId,
        `Proposed an inter-community agreement between ${mine.name} and ${other.name}.`,
        { agreementId: agreement.id, communityId },
      );
    });
  }

  respondToInterAgreement(agreementId: string, communityId: string, accept: boolean) {
    this.mutate((data, actorId) => {
      const agreement = data.interCommunityAgreements.find((a) => a.id === agreementId);
      if (!agreement) throw new Error('Agreement not found.');
      if (agreement.withdrawnAt) throw new Error('This agreement was withdrawn.');
      const party = agreement.parties.find((p) => p.communityId === communityId);
      if (!party) throw new Error('That community is not part of this agreement.');
      if (party.state !== 'pending') throw new Error('That community has already responded.');
      if (!canManageCommunity(data, actorId, communityId)) {
        throw new Error('Only an active steward can answer for a community.');
      }
      party.state = accept ? 'accepted' : 'declined';
      party.decidedBy = actorId;
      party.decidedAt = isoNow();
      const community = data.communities.find((c) => c.id === communityId);
      this.log(
        data,
        accept ? 'agreement-accepted' : 'agreement-declined',
        actorId,
        `${community?.name ?? 'Community'} ${accept ? 'accepted' : 'declined'} “${agreement.title}”.`,
        { agreementId, communityId },
      );
    });
  }

  // ---------------------------------------------------------------- knowledge

  createKnowledge(input: KnowledgeInput): string {
    let createdId = '';
    this.mutate((data, actorId) => {
      const record = this.buildKnowledge(data, actorId, input);
      data.knowledge.push(record);
      if (record.projectId) {
        const project = data.projects.find((p) => p.id === record.projectId);
        if (project && !project.knowledgeIds.includes(record.id)) {
          project.knowledgeIds.push(record.id);
        }
      }
      if (record.gatheringId) {
        const gathering = data.gatherings.find((g) => g.id === record.gatheringId);
        if (gathering && !gathering.knowledgeIds.includes(record.id)) {
          gathering.knowledgeIds.push(record.id);
        }
      }
      createdId = record.id;
    });
    return createdId;
  }

  private buildKnowledge(data: NodeData, actorId: string, input: KnowledgeInput): KnowledgeRecord {
    const now = isoNow();
    this.validateKnowledgeScope(data, actorId, input.scope, input.communityId);
    const attachments = normaliseAttachments(input.attachments ?? []);
    this.validateAttachmentBudget(data, attachments);
    return {
      id: newId('k'),
      title: requireText(input.title, 'Title', 3, 160),
      body: requireText(input.body, 'Content', 10, 40000),
      authorId: actorId,
      kind: input.kind,
      tags: input.tags.slice(0, 12),
      scope: input.scope,
      communityId: input.communityId || undefined,
      projectId: input.projectId || undefined,
      gatheringId: input.gatheringId || undefined,
      placeId: input.placeId || undefined,
      createdAt: now,
      updatedAt: now,
      versions: [],
      links: input.links
        .filter((link) => link.label.trim())
        .map((link) => ({ ...link, label: link.label.trim().slice(0, 120) }))
        .slice(0, 10),
      sources: input.sources.map((s) => s.trim()).filter(Boolean).slice(0, 10),
      attachments,
    };
  }

  private validateKnowledgeScope(
    data: NodeData,
    actorId: string,
    scope: Scope,
    communityId?: string,
  ) {
    if (scope === 'community') {
      if (!communityId) throw new Error('Choose the community this is shared with.');
      if (!data.communities.some((c) => c.id === communityId)) {
        throw new Error('That community does not exist.');
      }
      if (!isActiveMember(data, communityId, actorId)) {
        throw new Error('You must be an active member to share into a community.');
      }
    }
  }

  updateKnowledge(id: string, patch: Partial<KnowledgeInput>, versionNote: string) {
    this.mutate((data, actorId) => {
      const record = data.knowledge.find((k) => k.id === id);
      if (!record) throw new Error('Knowledge record not found.');
      if (record.authorId !== actorId) throw new Error('Only the author can edit this record.');
      const nextScope = patch.scope ?? record.scope;
      const nextCommunity = patch.communityId ?? record.communityId;
      this.validateKnowledgeScope(data, actorId, nextScope, nextCommunity);
      record.versions.push({
        at: record.updatedAt,
        byId: actorId,
        note: optionalText(versionNote, 160) || 'Edited',
        title: record.title,
        body: record.body,
        scope: record.scope,
      });
      if (record.versions.length > 20) record.versions.shift();
      if (patch.title !== undefined) record.title = requireText(patch.title, 'Title', 3, 160);
      if (patch.body !== undefined) record.body = requireText(patch.body, 'Content', 10, 40000);
      if (patch.kind !== undefined) record.kind = patch.kind;
      if (patch.tags !== undefined) record.tags = patch.tags.slice(0, 12);
      if (patch.scope !== undefined) record.scope = patch.scope;
      if (patch.communityId !== undefined) record.communityId = patch.communityId || undefined;
      if (patch.projectId !== undefined) {
        const previousProject = record.projectId;
        record.projectId = patch.projectId || undefined;
        if (previousProject && previousProject !== record.projectId) {
          const previous = data.projects.find((p) => p.id === previousProject);
          if (previous) previous.knowledgeIds = previous.knowledgeIds.filter((kid) => kid !== id);
        }
        if (record.projectId) {
          const next = data.projects.find((p) => p.id === record.projectId);
          if (next && !next.knowledgeIds.includes(id)) next.knowledgeIds.push(id);
        }
      }
      if (patch.gatheringId !== undefined) {
        const previousGathering = record.gatheringId;
        record.gatheringId = patch.gatheringId || undefined;
        if (previousGathering && previousGathering !== record.gatheringId) {
          const previous = data.gatherings.find((g) => g.id === previousGathering);
          if (previous) previous.knowledgeIds = previous.knowledgeIds.filter((kid) => kid !== id);
        }
        if (record.gatheringId) {
          const next = data.gatherings.find((g) => g.id === record.gatheringId);
          if (next && !next.knowledgeIds.includes(id)) next.knowledgeIds.push(id);
        }
      }
      if (patch.placeId !== undefined) record.placeId = patch.placeId || undefined;
      if (patch.links !== undefined) record.links = patch.links.slice(0, 10);
      if (patch.sources !== undefined) record.sources = patch.sources.slice(0, 10);
      if (patch.attachments !== undefined) {
        const attachments = normaliseAttachments(patch.attachments);
        this.validateAttachmentBudget(data, attachments, id);
        record.attachments = attachments;
      }
      record.updatedAt = isoNow();
    });
  }

  private validateAttachmentBudget(
    data: NodeData,
    attachments: KnowledgeAttachment[],
    editingId?: string,
  ) {
    const recordError = attachmentLimitError(attachments);
    if (recordError) throw new Error(recordError);
    const otherRecords = data.knowledge.filter((record) => record.id !== editingId);
    const total = nodeAttachmentBytes(otherRecords) + attachmentBytes(attachments);
    if (total > ATTACHMENT_LIMITS.maxNodeBytes) {
      throw new Error(
        `This node keeps about ${formatBytes(ATTACHMENT_LIMITS.maxNodeBytes)} of attachments in browser storage and is already full. Export a backup, then remove a file from another record before adding this one.`,
      );
    }
  }

  /**
   * Store a transcript produced by a local speech-to-text service. Audio and
   * transcript stay inside the record and follow its sharing scope. Only the
   * author may add one, since it becomes part of the record's readable text.
   */
  setAttachmentTranscript(
    recordId: string,
    attachmentId: string,
    transcript: { text: string; provider: string; model: string },
  ) {
    this.mutate((data, actorId) => {
      const record = data.knowledge.find((k) => k.id === recordId);
      if (!record) throw new Error('Knowledge record not found.');
      if (record.authorId !== actorId) throw new Error('Only the author can transcribe this recording.');
      const attachment = attachmentsOf(record).find((entry) => entry.id === attachmentId);
      if (!attachment || attachment.kind !== 'recording') {
        throw new Error('That recording is no longer on this record.');
      }
      attachment.transcript = {
        text: requireText(transcript.text, 'Transcript', 2, ATTACHMENT_LIMITS.maxTranscriptChars),
        provider: transcript.provider.slice(0, 80),
        model: transcript.model.slice(0, 80),
        at: isoNow(),
      };
      record.updatedAt = isoNow();
    });
  }

  deleteKnowledge(id: string) {
    this.mutate((data, actorId) => {
      const record = data.knowledge.find((k) => k.id === id);
      if (!record) throw new Error('Knowledge record not found.');
      if (record.authorId !== actorId) throw new Error('Only the author can delete this record.');
      data.knowledge = data.knowledge.filter((k) => k.id !== id);
      for (const project of data.projects) {
        project.knowledgeIds = project.knowledgeIds.filter((kid) => kid !== id);
      }
      for (const gathering of data.gatherings) {
        gathering.knowledgeIds = gathering.knowledgeIds.filter((kid) => kid !== id);
      }
      this.log(data, 'record-deleted', actorId, 'Deleted a knowledge record.', {
        subjectIds: [record.id],
      });
    });
  }

  restoreKnowledgeVersion(id: string, versionIndex: number) {
    this.mutate((data, actorId) => {
      const record = data.knowledge.find((k) => k.id === id);
      if (!record) throw new Error('Knowledge record not found.');
      if (record.authorId !== actorId) throw new Error('Only the author can restore a version.');
      const version = record.versions[versionIndex];
      if (!version) throw new Error('That version no longer exists.');
      record.versions.push({
        at: record.updatedAt,
        byId: actorId,
        note: 'Replaced by an earlier version',
        title: record.title,
        body: record.body,
        scope: record.scope,
      });
      record.title = version.title;
      record.body = version.body;
      record.scope = version.scope;
      record.updatedAt = isoNow();
    });
  }

  // ---------------------------------------------------------------- gathering

  createGathering(input: GatheringInput): string {
    let createdId = '';
    this.mutate((data, actorId) => {
      if (!isActiveMember(data, input.communityId, actorId)) {
        throw new Error('Join the community before organising a gathering.');
      }
      const start = new Date(input.startsAt);
      if (Number.isNaN(start.getTime())) throw new Error('Choose a valid start date and time.');
      if (input.endsAt && new Date(input.endsAt) < start) {
        throw new Error('The end time must be after the start time.');
      }
      const capacity = input.capacity && input.capacity > 0 ? Math.min(input.capacity, 500) : undefined;
      if (input.nodalLocationId) {
        const venue = data.places.find((place) => place.id === input.nodalLocationId);
        if (!venue?.nodal || !canViewNodalLocation(data, actorId, venue)) {
          throw new Error('Choose a nodal location you can see.');
        }
      }
      const gathering: Gathering = {
        id: newId('g'),
        communityId: input.communityId,
        title: requireText(input.title, 'Title', 3, 140),
        kind: input.kind,
        description: requireText(input.description, 'Description', 5, 3000),
        startsAt: start.toISOString(),
        endsAt: input.endsAt ? new Date(input.endsAt).toISOString() : undefined,
        venueName: requireText(input.venueName, 'Venue', 2, 160),
        locality: optionalText(input.locality, 120),
        nodalLocationId: input.nodalLocationId || undefined,
        organiserId: actorId,
        capacity,
        agenda: input.agenda
          .filter((title) => title.trim())
          .map((title, index) => ({ id: `ag-${index}-${Date.now()}`, title: title.trim().slice(0, 160) })),
        requirements: input.requirements.map((r) => r.trim()).filter(Boolean).slice(0, 12),
        responses: [{ personId: actorId, state: 'going', at: isoNow() }],
        status: 'planned',
        knowledgeIds: [],
        createdAt: isoNow(),
      };
      data.gatherings.push(gathering);
      createdId = gathering.id;
    });
    return createdId;
  }

  updateGathering(id: string, patch: Partial<Pick<Gathering, 'title' | 'description' | 'venueName' | 'locality' | 'nodalLocationId' | 'startsAt' | 'endsAt' | 'capacity' | 'agenda' | 'requirements' | 'status'>>) {
    this.mutate((data, actorId) => {
      const gathering = data.gatherings.find((g) => g.id === id);
      if (!gathering) throw new Error('Gathering not found.');
      if (gathering.organiserId !== actorId && !canManageCommunity(data, actorId, gathering.communityId)) {
        throw new Error('Only the organiser or a steward can edit this gathering.');
      }
      if (patch.title !== undefined) gathering.title = requireText(patch.title, 'Title', 3, 140);
      if (patch.description !== undefined) {
        gathering.description = requireText(patch.description, 'Description', 5, 3000);
      }
      if (patch.venueName !== undefined) gathering.venueName = requireText(patch.venueName, 'Venue', 2, 160);
      if (patch.locality !== undefined) gathering.locality = optionalText(patch.locality, 120);
      if (patch.nodalLocationId !== undefined) {
        if (patch.nodalLocationId) {
          const venue = data.places.find((place) => place.id === patch.nodalLocationId);
          if (!venue?.nodal || !canViewNodalLocation(data, actorId, venue)) {
            throw new Error('Choose a nodal location you can see.');
          }
        }
        gathering.nodalLocationId = patch.nodalLocationId || undefined;
      }
      if (patch.startsAt !== undefined) {
        if (Number.isNaN(new Date(patch.startsAt).getTime())) throw new Error('Invalid start date.');
        gathering.startsAt = patch.startsAt;
      }
      if (patch.endsAt !== undefined) gathering.endsAt = patch.endsAt || undefined;
      if (patch.capacity !== undefined) gathering.capacity = patch.capacity || undefined;
      if (patch.agenda !== undefined) gathering.agenda = patch.agenda;
      if (patch.requirements !== undefined) gathering.requirements = patch.requirements;
      if (patch.status !== undefined) gathering.status = patch.status;
    });
  }

  setGatheringStatus(id: string, status: GatheringStatus) {
    this.updateGathering(id, { status });
  }

  setAttendance(gatheringId: string, state: AttendanceState, note = '') {
    this.mutate((data, actorId) => {
      const gathering = data.gatherings.find((g) => g.id === gatheringId);
      if (!gathering) throw new Error('Gathering not found.');
      if (!canViewGathering(data, actorId, gathering)) {
        throw new Error('You are not part of this community.');
      }
      if (gathering.capacity && state === 'going') {
        const going = gathering.responses.filter(
          (r) => r.state === 'going' && r.personId !== actorId,
        ).length;
        if (going >= gathering.capacity) throw new Error('This gathering is at capacity.');
      }
      const existing = gathering.responses.find((r) => r.personId === actorId);
      if (existing) {
        existing.state = state;
        existing.note = optionalText(note, 300);
        existing.at = isoNow();
      } else {
        gathering.responses.push({
          personId: actorId,
          state,
          note: optionalText(note, 300),
          at: isoNow(),
        });
      }
    });
  }

  recordGatheringOutcome(id: string, outcome: Omit<GatheringOutcome, 'recordedBy' | 'recordedAt'>) {
    this.mutate((data, actorId) => {
      const gathering = data.gatherings.find((g) => g.id === id);
      if (!gathering) throw new Error('Gathering not found.');
      if (gathering.organiserId !== actorId && !canManageCommunity(data, actorId, gathering.communityId)) {
        throw new Error('Only the organiser or a steward can record outcomes.');
      }
      gathering.outcomes = {
        recordedBy: actorId,
        recordedAt: isoNow(),
        notes: requireText(outcome.notes, 'Outcome notes', 3, 5000),
        decisions: outcome.decisions.map((d) => d.trim()).filter(Boolean).slice(0, 20),
        lessons: outcome.lessons.map((d) => d.trim()).filter(Boolean).slice(0, 20),
        followUps: outcome.followUps.map((d) => d.trim()).filter(Boolean).slice(0, 20),
      };
      gathering.status = 'completed';
    });
  }

  linkKnowledgeToGathering(gatheringId: string, knowledgeId: string) {
    this.mutate((data, actorId) => {
      const gathering = data.gatherings.find((g) => g.id === gatheringId);
      const record = data.knowledge.find((k) => k.id === knowledgeId);
      if (!gathering || !record) throw new Error('Gathering or record not found.');
      if (gathering.organiserId !== actorId && !canManageCommunity(data, actorId, gathering.communityId)) {
        throw new Error('Only the organiser or a steward can link knowledge.');
      }
      if (!canRead(data, actorId, record)) {
        throw new Error('You cannot link a record you cannot read.');
      }
      if (!gathering.knowledgeIds.includes(knowledgeId)) gathering.knowledgeIds.push(knowledgeId);
      if (!record.gatheringId) record.gatheringId = gatheringId;
    });
  }

  // ------------------------------------------------------------------ project

  createProject(input: ProjectInput): string {
    let createdId = '';
    this.mutate((data, actorId) => {
      if (!isActiveMember(data, input.communityId, actorId)) {
        throw new Error('Join the community before starting a project.');
      }
      const project: Project = {
        id: newId('pr'),
        communityId: input.communityId,
        title: requireText(input.title, 'Project title', 3, 160),
        summary: requireText(input.summary, 'Summary', 10, 2000),
        objective: requireText(input.objective, 'Objective', 10, 3000),
        outcomes: '',
        status: 'active',
        leadId: actorId,
        participants: Array.from(new Set([actorId, ...input.participantIds])).filter((pid) =>
          data.people.some((p) => p.id === pid),
        ),
        startDate: isoNow(),
        targetDate: input.targetDate ? new Date(input.targetDate).toISOString() : undefined,
        tasks: [],
        resources: [],
        knowledgeIds: [],
        lessons: [],
        createdAt: isoNow(),
      };
      data.projects.push(project);
      createdId = project.id;
    });
    return createdId;
  }

  updateProject(
    id: string,
    patch: Partial<Pick<Project, 'title' | 'summary' | 'objective' | 'outcomes' | 'status' | 'targetDate' | 'lessons'>>,
  ) {
    this.mutate((data, actorId) => {
      const project = data.projects.find((p) => p.id === id);
      if (!project) throw new Error('Project not found.');
      if (project.leadId !== actorId && !canManageCommunity(data, actorId, project.communityId)) {
        throw new Error('Only the lead or a steward can edit this project.');
      }
      if (patch.title !== undefined) project.title = requireText(patch.title, 'Project title', 3, 160);
      if (patch.summary !== undefined) project.summary = requireText(patch.summary, 'Summary', 10, 2000);
      if (patch.objective !== undefined) {
        project.objective = requireText(patch.objective, 'Objective', 10, 3000);
      }
      if (patch.outcomes !== undefined) project.outcomes = optionalText(patch.outcomes, 3000);
      if (patch.status !== undefined) project.status = patch.status;
      if (patch.targetDate !== undefined) {
        project.targetDate = patch.targetDate ? new Date(patch.targetDate).toISOString() : undefined;
      }
      if (patch.lessons !== undefined) {
        project.lessons = patch.lessons.map((l) => l.trim()).filter(Boolean).slice(0, 20);
      }
    });
  }

  addTask(projectId: string, input: { title: string; detail?: string; assigneeId?: string; dueDate?: string }) {
    this.mutate((data, actorId) => {
      const project = data.projects.find((p) => p.id === projectId);
      if (!project) throw new Error('Project not found.');
      if (!canViewProject(data, actorId, project)) throw new Error('You are not part of this project.');
      const task: Task = {
        id: newId('t'),
        title: requireText(input.title, 'Task', 3, 200),
        detail: optionalText(input.detail, 1000),
        assigneeId: input.assigneeId || undefined,
        dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : undefined,
        status: 'todo',
        createdBy: actorId,
        createdAt: isoNow(),
      };
      project.tasks.push(task);
    });
  }

  updateTask(projectId: string, taskId: string, patch: Partial<Pick<Task, 'title' | 'detail' | 'assigneeId' | 'dueDate' | 'status'>>) {
    this.mutate((data, actorId) => {
      const project = data.projects.find((p) => p.id === projectId);
      if (!project) throw new Error('Project not found.');
      if (!canViewProject(data, actorId, project)) throw new Error('You are not part of this project.');
      const task = project.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error('Task not found.');
      if (patch.title !== undefined) task.title = requireText(patch.title, 'Task', 3, 200);
      if (patch.detail !== undefined) task.detail = optionalText(patch.detail, 1000);
      if (patch.assigneeId !== undefined) task.assigneeId = patch.assigneeId || undefined;
      if (patch.dueDate !== undefined) {
        task.dueDate = patch.dueDate ? new Date(patch.dueDate).toISOString() : undefined;
      }
      if (patch.status !== undefined) {
        const statuses: TaskStatus[] = ['todo', 'doing', 'done', 'blocked'];
        if (!statuses.includes(patch.status)) throw new Error('Invalid task status.');
        task.status = patch.status;
      }
    });
  }

  deleteTask(projectId: string, taskId: string) {
    this.mutate((data, actorId) => {
      const project = data.projects.find((p) => p.id === projectId);
      if (!project) throw new Error('Project not found.');
      if (!canViewProject(data, actorId, project)) throw new Error('You are not part of this project.');
      project.tasks = project.tasks.filter((t) => t.id !== taskId);
    });
  }

  updateParticipants(projectId: string, participantIds: string[]) {
    this.mutate((data, actorId) => {
      const project = data.projects.find((p) => p.id === projectId);
      if (!project) throw new Error('Project not found.');
      if (project.leadId !== actorId && !canManageCommunity(data, actorId, project.communityId)) {
        throw new Error('Only the lead or a steward can change participants.');
      }
      const community = data.communities.find((c) => c.id === project.communityId);
      const valid = new Set(
        (community?.members ?? [])
          .filter((m) => m.status === 'active')
          .map((m) => m.personId),
      );
      project.participants = Array.from(new Set([project.leadId, ...participantIds])).filter(
        (pid) => valid.has(pid) && data.people.some((p) => p.id === pid),
      );
    });
  }

  addProjectResource(projectId: string, name: string, note: string, secured: boolean) {
    this.mutate((data, actorId) => {
      const project = data.projects.find((p) => p.id === projectId);
      if (!project) throw new Error('Project not found.');
      if (!canViewProject(data, actorId, project)) throw new Error('You are not part of this project.');
      project.resources.push({
        id: newId('r'),
        name: requireText(name, 'Resource', 2, 160),
        note: optionalText(note, 500),
        status: secured ? 'secured' : 'needed',
      });
    });
  }

  linkKnowledgeToProject(projectId: string, knowledgeId: string) {
    this.mutate((data, actorId) => {
      const project = data.projects.find((p) => p.id === projectId);
      const record = data.knowledge.find((k) => k.id === knowledgeId);
      if (!project || !record) throw new Error('Project or record not found.');
      if (!canViewProject(data, actorId, project)) throw new Error('You are not part of this project.');
      if (!canRead(data, actorId, record)) throw new Error('You cannot link a record you cannot read.');
      if (!project.knowledgeIds.includes(knowledgeId)) project.knowledgeIds.push(knowledgeId);
      if (!record.projectId) record.projectId = projectId;
    });
  }

  // -------------------------------------------------------------- observation

  private normaliseNodal(
    data: NodeData,
    communityId: string | undefined,
    nodal: NodalDetails,
  ): NodalDetails {
    const kinds: NodalDetails['kind'][] = [
      'gathering-spot',
      'community-centre',
      'commune',
      'workshop',
      'learning-space',
      'other',
    ];
    const visibilities: NodalDetails['visibility'][] = ['public', 'community', 'private'];
    if (!kinds.includes(nodal.kind)) throw new Error('Choose a valid nodal location kind.');
    if (!visibilities.includes(nodal.visibility)) throw new Error('Choose a valid visibility.');
    if (nodal.visibility === 'community' && !communityId) {
      throw new Error('Community visibility needs a linked community.');
    }
    if (nodal.contactId) this.requirePerson(data, nodal.contactId);
    const capacity =
      nodal.capacity === undefined || Number.isNaN(nodal.capacity)
        ? undefined
        : Math.round(nodal.capacity);
    if (capacity !== undefined && (capacity < 1 || capacity > 10000)) {
      throw new Error('Capacity must be between 1 and 10,000 people.');
    }
    const themes = Array.from(
      new Set(
        (Array.isArray(nodal.themes) ? nodal.themes : [])
          .map((theme) => theme.trim().toLowerCase())
          .filter((theme) => theme.length > 0 && theme.length <= 40),
      ),
    ).slice(0, 8);
    return {
      kind: nodal.kind,
      description: requireText(nodal.description, 'Description', 10, 2000),
      accessNotes: optionalText(nodal.accessNotes, 800),
      visibility: nodal.visibility,
      themes,
      capacity,
      contactId: nodal.contactId || undefined,
    };
  }

  createPlace(input: PlaceInput): string {
    let createdId = '';
    this.mutate((data, actorId) => {
      if (input.communityId && !isActiveMember(data, input.communityId, actorId)) {
        throw new Error('You must be an active member to add a place for that community.');
      }
      if (input.lat !== undefined && (input.lat < -90 || input.lat > 90)) throw new Error('Latitude must be between -90 and 90.');
      if (input.lng !== undefined && (input.lng < -180 || input.lng > 180)) throw new Error('Longitude must be between -180 and 180.');
      const communityId = input.communityId || undefined;
      const place: Place = {
        id: newId('pl'),
        ownerId: actorId,
        name: requireText(input.name, 'Place name', 2, 160),
        locality: optionalText(input.locality, 120),
        lat: input.lat,
        lng: input.lng,
        coordinatePolicy: input.coordinatePolicy,
        communityId,
        note: optionalText(input.note, 500),
        nodal: input.nodal ? this.normaliseNodal(data, communityId, input.nodal) : undefined,
      };
      data.places.push(place);
      createdId = place.id;
    });
    return createdId;
  }

  updateNodalLocation(id: string, patch: Omit<Partial<PlaceInput>, 'nodal'> & { nodal?: NodalDetails }) {
    this.mutate((data, actorId) => {
      const place = data.places.find((p) => p.id === id);
      if (!place) throw new Error('Place not found.');
      if (!place.nodal) throw new Error('That place is not a nodal location.');
      if (place.ownerId !== actorId) throw new Error('Only the owner can edit this nodal location.');
      const previousCommunity = place.communityId;
      const nextCommunity =
        patch.communityId !== undefined ? patch.communityId || undefined : place.communityId;
      if (nextCommunity && !isActiveMember(data, nextCommunity, actorId)) {
        throw new Error('You must be an active member to link that community.');
      }
      if (patch.lat !== undefined && (patch.lat < -90 || patch.lat > 90)) {
        throw new Error('Latitude must be between -90 and 90.');
      }
      if (patch.lng !== undefined && (patch.lng < -180 || patch.lng > 180)) {
        throw new Error('Longitude must be between -180 and 180.');
      }
      if (patch.name !== undefined) place.name = requireText(patch.name, 'Place name', 2, 160);
      if (patch.locality !== undefined) place.locality = optionalText(patch.locality, 120);
      if (patch.coordinatePolicy !== undefined) place.coordinatePolicy = patch.coordinatePolicy;
      if (patch.note !== undefined) place.note = optionalText(patch.note, 500);
      place.communityId = nextCommunity;
      if (patch.lat !== undefined) place.lat = patch.lat;
      if (patch.lng !== undefined) place.lng = patch.lng;
      if (patch.nodal !== undefined) {
        place.nodal = this.normaliseNodal(data, nextCommunity, patch.nodal);
      } else if (nextCommunity !== previousCommunity && place.nodal) {
        place.nodal = this.normaliseNodal(data, nextCommunity, place.nodal);
      }
    });
  }

  createObservation(input: ObservationInput): string {
    let createdId = '';
    this.mutate((data, actorId) => {
      this.validateKnowledgeScope(data, actorId, input.scope, input.communityId);
      if (!data.places.some((p) => p.id === input.placeId)) throw new Error('Choose a place.');
      if (input.value !== null && !Number.isFinite(input.value)) throw new Error('Enter a numeric value or leave it blank.');
      if (Number.isNaN(new Date(input.observedAt).getTime())) throw new Error('Choose a valid observation date.');
      const observation: Observation = {
        id: newId('o'),
        title: requireText(input.title, 'Observation title', 3, 160),
        kind: input.kind,
        value: input.value,
        unit: optionalText(input.unit, 30),
        observedAt: new Date(input.observedAt).toISOString(),
        placeId: input.placeId,
        method: requireText(input.method, 'Method', 3, 500),
        observerId: actorId,
        notes: optionalText(input.notes, 2000),
        scope: input.scope,
        communityId: input.communityId || undefined,
        projectId: input.projectId || undefined,
      };
      data.observations.push(observation);
      createdId = observation.id;
    });
    return createdId;
  }

  updateObservation(id: string, patch: Partial<ObservationInput>) {
    this.mutate((data, actorId) => {
      const observation = data.observations.find((o) => o.id === id);
      if (!observation) throw new Error('Observation not found.');
      if (observation.observerId !== actorId) throw new Error('Only the observer can edit this observation.');
      if (patch.scope !== undefined) {
        this.validateKnowledgeScope(data, actorId, patch.scope, patch.communityId ?? observation.communityId);
        observation.scope = patch.scope;
      }
      if (patch.title !== undefined) observation.title = requireText(patch.title, 'Title', 3, 160);
      if (patch.value !== undefined) observation.value = patch.value;
      if (patch.unit !== undefined) observation.unit = optionalText(patch.unit, 30);
      if (patch.observedAt !== undefined) observation.observedAt = new Date(patch.observedAt).toISOString();
      if (patch.placeId !== undefined) observation.placeId = patch.placeId;
      if (patch.method !== undefined) observation.method = requireText(patch.method, 'Method', 3, 500);
      if (patch.notes !== undefined) observation.notes = optionalText(patch.notes, 2000);
      if (patch.communityId !== undefined) observation.communityId = patch.communityId || undefined;
      if (patch.projectId !== undefined) observation.projectId = patch.projectId || undefined;
    });
  }

  deleteObservation(id: string) {
    this.mutate((data, actorId) => {
      const observation = data.observations.find((o) => o.id === id);
      if (!observation) throw new Error('Observation not found.');
      if (observation.observerId !== actorId) throw new Error('Only the observer can delete this observation.');
      data.observations = data.observations.filter((o) => o.id !== id);
    });
  }
}

