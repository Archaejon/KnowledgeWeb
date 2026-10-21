import { useState } from 'react';
import {
  canManageCommunity,
  canRead,
  personName,
  visibleDirectory,
} from '../core/access';
import {
  groupAgreementCounts,
  groupAgreementStatus,
  interAgreementStatus,
  isActiveMember,
  membershipFor,
} from '../core/consent';
import { formatDate, formatDateTime, relativeTime } from '../core/dates';
import { GATHERING_KIND_LABELS, PURPOSE_LABELS } from '../core/labels';
import { myCommunities, projectProgress, upcomingGatherings } from '../core/selectors';
import type {
  Community,
  CommunityPurpose,
  GroupAgreement,
  InterCommunityAgreement,
} from '../core/types';
import { Link, navigate } from '../router';
import { useApp } from '../store-context';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  FormError,
  Modal,
  Notice,
  PageHeader,
  Progress,
  ScopeBadge,
  Tabs,
} from '../components/ui';

type Intent = 'create' | 'edit' | 'join' | 'propose-group' | 'propose-inter' | 'group-response' | 'leave' | null;

const EMPTY_FORM = {
  name: '',
  description: '',
  purpose: 'practical-work' as CommunityPurpose,
  principles: '',
  locality: '',
  geographicArea: '',
  joinPolicy: 'request' as 'open' | 'request',
  advertiseDirectory: false,
};

export function CommunitiesPage({ communityId }: { communityId?: string }) {
  if (communityId) return <CommunityDetail communityId={communityId} />;
  return <CommunityIndex />;
}

function CommunityIndex() {
  const { snapshot } = useApp();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [intent, setIntent] = useState<Intent>(null);
  const [activeCommunity, setActiveCommunity] = useState<Community | null>(null);

  const mine = myCommunities(data, actorId);
  const others = data.communities.filter((c) => !isActiveMember(data, c.id, actorId));

  const renderCard = (community: Community, joined: boolean) => {
    const knowledge = data.knowledge.filter(
      (k) => k.communityId === community.id && canRead(data, actorId, k),
    ).length;
    const activeAgreement = data.groupAgreements.some(
      (g) => g.communityId === community.id && groupAgreementStatus(g) === 'active',
    );
    const membership = membershipFor(data, community.id, actorId);
    const upcoming = upcomingGatherings(data, actorId).filter((g) => g.communityId === community.id);
    return (
      <Card className="community-card" key={community.id}>
        <div className="community-card-top">
          <span className="community-mark">
            <Icon name="community" size={22} />
          </span>
          <div>
            <h2>
              {joined ? <Link to={`communities/${community.id}`}>{community.name}</Link> : community.name}
            </h2>
            <div className="inline-meta">
              <span className="inline-meta-item">{PURPOSE_LABELS[community.purpose]}</span>
              <span className="inline-meta-item">
                <span className="meta-sep" aria-hidden="true">·</span> {community.locality}
              </span>
            </div>
          </div>
          <Badge tone={activeAgreement ? 'success' : 'neutral'} dot={activeAgreement}>
            {activeAgreement ? 'Group agreement active' : 'No group sharing'}
          </Badge>
        </div>
        <p className="community-desc">{community.description}</p>
        {community.principles.length > 0 ? (
          <ul className="principle-list compact">
            {community.principles.slice(0, 2).map((principle) => (
              <li key={principle}>{principle}</li>
            ))}
          </ul>
        ) : null}
        <div className="community-card-foot">
          <div className="community-stats">
            {joined ? (
              <>
                <span>
                  <strong>{knowledge}</strong> records readable
                </span>
                <span>
                  <strong>{upcoming.length}</strong> upcoming
                </span>
                <span>
                  <strong>{visibleDirectory(data, actorId, community).length}</strong> in directory
                </span>
              </>
            ) : (
              <>
                <span>
                  <strong>{community.members.filter((m) => m.status === 'active').length}</strong>{' '}
                  active members
                </span>
                <span>{community.joinPolicy === 'open' ? 'Open to join' : 'Join by request'}</span>
                <span>{community.advertiseDirectory ? 'Directory advertised' : 'Directory private'}</span>
              </>
            )}
          </div>
          {joined ? (
            <Button size="sm" onClick={() => navigate(`communities/${community.id}`)}>
              Open space
            </Button>
          ) : (
            <Button
              size="sm"
              variant={membership?.status === 'pending' ? 'quiet' : 'primary'}
              disabled={membership?.status === 'pending'}
              onClick={() => {
                setActiveCommunity(community);
                setIntent('join');
              }}
            >
              {membership?.status === 'pending'
                ? 'Request pending'
                : community.joinPolicy === 'open'
                  ? 'Join community'
                  : 'Request to join'}
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Shared spaces"
        title="Communities"
        lede="Communities are self-governed groups with a purpose and a place. Membership is a commitment to a shared space; group-shared knowledge still needs an explicit, unanimous agreement."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setIntent('create')}>
            Create community
          </Button>
        }
      />

      <Tabs
        label="Communities"
        value={tab}
        onChange={(value) => setTab(value as 'mine' | 'discover')}
        options={[
          { value: 'mine', label: 'My communities', count: mine.length },
          { value: 'discover', label: 'Others on this node', count: others.length },
        ]}
      />

      {tab === 'mine' ? (
        mine.length === 0 ? (
          <EmptyState
            icon="community"
            title="You are not in a community yet"
            action={
              <Button variant="primary" icon="plus" onClick={() => setIntent('create')}>
                Create the first one
              </Button>
            }
          >
            <p>
              A community can be a street, an allotment site, a study circle or a working group.
              Join one below or start with the people you already meet.
            </p>
          </EmptyState>
        ) : (
          <div className="community-grid">{mine.map((c) => renderCard(c, true))}</div>
        )
      ) : others.length === 0 ? (
        <EmptyState icon="community" title="No other communities on this node">
          <p>Independent nodes can establish agreements later; this prototype has no federation.</p>
        </EmptyState>
      ) : (
        <div className="community-grid">{others.map((c) => renderCard(c, false))}</div>
      )}

      <div className="two-col reference-grid">
        <Card>
          <CardHeader icon="shield" title="What membership does and does not do" />
          <ul className="principle-list">
            <li>Membership gives you a shared space for gatherings, projects and public or bilateral knowledge.</li>
            <li>It does not give you access to other members’ group-shared records.</li>
            <li>Group-shared access requires an active agreement accepted by every participant.</li>
            <li>Appearing in a member directory is opt-in per person. No public roster is mandatory.</li>
            <li>Leaving ends group access immediately; records you authored keep their chosen scope.</li>
          </ul>
        </Card>
        <Card>
          <CardHeader icon="info" title="Governance stays local" />
          <p>
            Each community writes its own purpose and principles. Nothing here imposes one
            governance model on another community. Inter-community agreements are explicit,
            limited and can cover equipment or exchange without merging knowledge collections.
          </p>
          <p className="muted small">
            Software governance (this open-source project) is separate from community governance.
          </p>
        </Card>
      </div>

      <CommunityFormModal
        open={intent === 'create'}
        onClose={() => setIntent(null)}
        mode="create"
      />
      <JoinCommunityModal
        community={activeCommunity}
        open={intent === 'join'}
        onClose={() => {
          setIntent(null);
          setActiveCommunity(null);
        }}
      />
    </div>
  );
}

function CommunityFormModal({
  open,
  onClose,
  mode,
  community,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  community?: Community;
}) {
  const { store } = useApp();
  const toast = useToast();
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(community
      ? {
          name: community.name,
          description: community.description,
          purpose: community.purpose,
          principles: community.principles.join('\n'),
          locality: community.locality,
          geographicArea: community.geographicArea,
          joinPolicy: community.joinPolicy,
          advertiseDirectory: community.advertiseDirectory,
        }
      : {}),
  });
  const [error, setError] = useState('');
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    setError('');
    try {
      const input = {
        name: form.name,
        description: form.description,
        purpose: form.purpose,
        principles: form.principles.split('\n').map((p) => p.trim()).filter(Boolean),
        locality: form.locality,
        geographicArea: form.geographicArea,
        joinPolicy: form.joinPolicy,
        advertiseDirectory: form.advertiseDirectory,
      };
      if (mode === 'create') {
        const id = store.createCommunity(input);
        toast('Community created. You are its first steward.');
        onClose();
        setForm(EMPTY_FORM);
        navigate(`communities/${id}`);
      } else if (community) {
        store.updateCommunity(community.id, input);
        toast('Community details updated.');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the community.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Create a community' : 'Edit community details'}
      description="Communities exist to support real gatherings, practical work and shared knowledge. Keep the purpose concrete."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={submit}>
            {mode === 'create' ? 'Create community' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {error ? <FormError>{error}</FormError> : null}
        <Field label="Name" htmlFor="community-name" required>
          <input
            id="community-name"
            className="input"
            value={form.name}
            maxLength={120}
            onChange={(event) => set('name', event.target.value)}
            placeholder="e.g. Lower Meadow Stewards"
          />
        </Field>
        <Field label="Purpose" htmlFor="community-purpose">
          <select
            id="community-purpose"
            className="select"
            value={form.purpose}
            onChange={(event) => set('purpose', event.target.value as CommunityPurpose)}
          >
            {Object.entries(PURPOSE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Description"
          htmlFor="community-description"
          required
          hint="What does this group actually do together?"
        >
          <textarea
            id="community-description"
            className="textarea"
            rows={4}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder="Who is involved, what you care for, and how you work together."
          />
        </Field>
        <Field
          label="Shared principles"
          htmlFor="community-principles"
          hint="One per line. These are commitments, not marketing copy."
        >
          <textarea
            id="community-principles"
            className="textarea"
            rows={4}
            value={form.principles}
            onChange={(event) => set('principles', event.target.value)}
            placeholder={'Work days end with a shared meal.\nNo one is named publicly without asking.'}
          />
        </Field>
        <div className="form-row">
          <Field label="Locality" htmlFor="community-locality">
            <input
              id="community-locality"
              className="input"
              value={form.locality}
              onChange={(event) => set('locality', event.target.value)}
              placeholder="Village, town or neighbourhood"
            />
          </Field>
          <Field label="Geographic area" htmlFor="community-area">
            <input
              id="community-area"
              className="input"
              value={form.geographicArea}
              onChange={(event) => set('geographicArea', event.target.value)}
              placeholder="The ground you actually tend"
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Joining" htmlFor="community-join">
            <select
              id="community-join"
              className="select"
              value={form.joinPolicy}
              onChange={(event) => set('joinPolicy', event.target.value as 'open' | 'request')}
            >
              <option value="request">Ask a steward</option>
              <option value="open">Anyone on this node may join</option>
            </select>
          </Field>
          <Field label="Directory" htmlFor="community-directory">
            <label className="check inline-check">
              <input
                id="community-directory"
                type="checkbox"
                checked={form.advertiseDirectory}
                onChange={(event) => set('advertiseDirectory', event.target.checked)}
              />
              <span>Say that a member directory exists (names still opt-in)</span>
            </label>
          </Field>
        </div>
        <Notice tone="quiet" icon="shield">
          Creating a community makes you a steward, not an owner of anyone’s knowledge. Group-wide
          sharing requires a separate proposal and every participant’s explicit acceptance.
        </Notice>
      </div>
    </Modal>
  );
}

function JoinCommunityModal({
  community,
  open,
  onClose,
}: {
  community: Community | null;
  open: boolean;
  onClose: () => void;
}) {
  const { store, snapshot } = useApp();
  const toast = useToast();
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  if (!community) return null;
  const isRequest = community.joinPolicy === 'request';
  const memberCount = community.members.filter((m) => m.status === 'active').length;

  const join = () => {
    try {
      store.joinCommunity(community.id, note);
      toast(
        isRequest
          ? 'Request sent. A steward will decide; no access is granted yet.'
          : 'You joined the community. Group-shared knowledge is still governed separately.',
        'info',
      );
      setNote('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isRequest ? `Request to join ${community.name}` : `Join ${community.name}`}
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={join}>
            {isRequest ? 'Send request' : 'Join community'}
          </Button>
        </>
      }
    >
      <div className="stack-tight">
        {error ? <FormError>{error}</FormError> : null}
        <p>{community.description}</p>
        <dl className="detail-list">
          <div>
            <dt>Purpose</dt>
            <dd>{PURPOSE_LABELS[community.purpose]}</dd>
          </div>
          <div>
            <dt>Locality</dt>
            <dd>{community.geographicArea || community.locality}</dd>
          </div>
          <div>
            <dt>Members</dt>
            <dd>{memberCount} active</dd>
          </div>
          <div>
            <dt>Agreement</dt>
            <dd>No group knowledge access by default</dd>
          </div>
        </dl>
        <Notice tone="quiet" icon="key" title="Membership is not a knowledge-sharing agreement">
          Joining lets you take part in the shared space. Access to other members’ group-shared
          records requires an active group agreement that every participant has explicitly
          accepted. Your directory listing remains your own opt-in choice.
        </Notice>
        {community.principles.length > 0 ? (
          <div>
            <div className="field-inline-label">Shared principles</div>
            <ul className="principle-list">
              {community.principles.map((principle) => (
                <li key={principle}>{principle}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <Field
          label={isRequest ? 'Note to the stewards (optional)' : 'Note (optional)'}
          htmlFor="join-note"
        >
          <textarea
            id="join-note"
            className="textarea"
            rows={3}
            value={note}
            maxLength={300}
            onChange={(event) => setNote(event.target.value)}
            placeholder="How you know the community, or what you would like to help with."
          />
        </Field>
        <p className="muted tiny">
          You are acting as {snapshot.data.people.find((p) => p.id === snapshot.settings.actorId)?.name} on
          this demonstration node.
        </p>
      </div>
    </Modal>
  );
}

function CommunityDetail({ communityId }: { communityId: string }) {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const community = data.communities.find((c) => c.id === communityId);
  const [intent, setIntent] = useState<Intent>(null);
  const [agreementToAnswer, setAgreementToAnswer] = useState<GroupAgreement | null>(null);
  const [revokeGroupId, setRevokeGroupId] = useState<string | null>(null);
  const [interTarget, setInterTarget] = useState<InterCommunityAgreement | null>(null);
  const [showAllAgreements, setShowAllAgreements] = useState(false);

  if (!community) {
    return (
      <EmptyState
        icon="community"
        title="Community not found"
        action={
          <Link className="btn btn-primary btn-md" to="communities">
            Back to communities
          </Link>
        }
      >
        <p>It may have been removed from this node.</p>
      </EmptyState>
    );
  }

  const membership = membershipFor(data, community.id, actorId);
  const isMember = membership?.status === 'active';
  const isSteward = canManageCommunity(data, actorId, community.id);
  const directory = visibleDirectory(data, actorId, community);
  const activeMembers = community.members.filter((m) => m.status === 'active');
  const pendingApplicants = community.members.filter((m) => m.status === 'pending');
  const knowledge = data.knowledge
    .filter((k) => k.communityId === community.id && canRead(data, actorId, k))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const projects = data.projects.filter((p) => p.communityId === community.id);
  const gatherings = data.gatherings
    .filter((g) => g.communityId === community.id)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const upcoming = upcomingGatherings(data, actorId).filter((g) => g.communityId === community.id);
  const agreements = data.groupAgreements
    .filter((g) => g.communityId === community.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeAgreement = agreements.find((g) => groupAgreementStatus(g) === 'active');
  const openAgreement = agreements.find((g) => groupAgreementStatus(g) === 'proposed');
  const interAgreements = data.interCommunityAgreements.filter((agreement) =>
    agreement.parties.some((p) => p.communityId === community.id),
  );
  const groupSharedCount = knowledge.filter((k) => k.scope === 'community').length;
  const otherCommunities = data.communities.filter((c) => c.id !== community.id);

  const leave = () => {
    try {
      store.leaveCommunity(community.id);
      toast('You left the community. Group-shared access through it has ended.', 'info');
      navigate('communities');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not leave.', 'error');
    }
  };

  return (
    <div className="stack">
      <div className="breadcrumb">
        <Link to="communities">Communities</Link>
        <Icon name="chevronRight" size={13} />
        <span>{community.name}</span>
      </div>

      <PageHeader
        eyebrow={PURPOSE_LABELS[community.purpose]}
        title={community.name}
        lede={community.description}
        actions={
          isMember ? (
            <div className="header-actions">
              <Button
                icon="plus"
                onClick={() => navigate(`knowledge?compose=${community.id}&scope=community`)}
              >
                Add knowledge
              </Button>
              {isSteward ? (
                <Button icon="settings" onClick={() => setIntent('edit')}>
                  Edit details
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setIntent('leave')}>
                Leave
              </Button>
            </div>
          ) : (
            <Button variant="primary" onClick={() => setIntent('join')}>
              {membership?.status === 'pending'
                ? 'Request pending'
                : community.joinPolicy === 'open'
                  ? 'Join community'
                  : 'Request to join'}
            </Button>
          )
        }
      >
        <div className="header-meta-row">
          <Badge tone={isMember ? 'success' : 'neutral'} dot>
            {isMember ? `${membership?.role} · active member` : membership?.status === 'pending' ? 'Membership requested' : 'Not a member'}
          </Badge>
          <span className="muted small">
            <Icon name="mapPin" size={13} /> {community.geographicArea || community.locality}
          </span>
          <span className="muted small">
            <Icon name="users" size={13} /> {activeMembers.length} active members
          </span>
          <Badge tone={activeAgreement ? 'success' : 'warning'}>
            {activeAgreement ? 'Group sharing active' : 'Group sharing inactive'}
          </Badge>
        </div>
      </PageHeader>

      {!isMember ? (
        <div className="stack">
          <Notice tone="quiet" icon="lock" title="Members-only space">
            The member directory, projects, gatherings and knowledge are visible to active members.
            {membership?.status === 'pending'
              ? ' Your request is waiting for a steward.'
              : ' Joining does not automatically grant access to group-shared knowledge.'}
          </Notice>
          <div className="two-col">
            <Card>
              <CardHeader icon="leaf" title="Purpose and principles" />
              <p>{community.description}</p>
              <ul className="principle-list">
                {community.principles.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader icon="community" title="Membership" />
              <dl className="detail-list">
                <div>
                  <dt>Joining</dt>
                  <dd>{community.joinPolicy === 'open' ? 'Open on this node' : 'By steward approval'}</dd>
                </div>
                <div>
                  <dt>Active members</dt>
                  <dd>{activeMembers.length}</dd>
                </div>
                <div>
                  <dt>Directory</dt>
                  <dd>{community.advertiseDirectory ? 'Exists · names opt-in' : 'Not advertised'}</dd>
                </div>
                <div>
                  <dt>Group agreement</dt>
                  <dd>{activeAgreement ? 'Active' : 'None active'}</dd>
                </div>
              </dl>
              <Button
                variant="primary"
                block
                disabled={membership?.status === 'pending'}
                onClick={() => setIntent('join')}
              >
                {membership?.status === 'pending'
                  ? 'Request pending'
                  : community.joinPolicy === 'open'
                    ? 'Join community'
                    : 'Request to join'}
              </Button>
            </Card>
          </div>
        </div>
      ) : (
        <>
          <div className="stat-grid compact-stats">
            <div className="stat static">
              <span className="stat-icon"><Icon name="users" size={18} /></span>
              <span className="stat-value">{activeMembers.length}</span>
              <span className="stat-label">members</span>
              <span className="stat-hint">{directory.length} listed by choice</span>
            </div>
            <div className="stat static">
              <span className="stat-icon"><Icon name="knowledge" size={18} /></span>
              <span className="stat-value">{knowledge.length}</span>
              <span className="stat-label">records readable</span>
              <span className="stat-hint">{groupSharedCount} group-shared</span>
            </div>
            <div className="stat static">
              <span className="stat-icon"><Icon name="project" size={18} /></span>
              <span className="stat-value">{projects.filter((p) => p.status === 'active').length}</span>
              <span className="stat-label">active projects</span>
              <span className="stat-hint">{projects.length} total</span>
            </div>
            <div className="stat static">
              <span className="stat-icon"><Icon name="gathering" size={18} /></span>
              <span className="stat-value">{upcoming.length}</span>
              <span className="stat-label">upcoming gatherings</span>
              <span className="stat-hint">In person, not in-feed</span>
            </div>
          </div>

          <div className="two-col community-layout">
            <div className="stack">
              <Card>
                <CardHeader
                  icon="shield"
                  title="Group knowledge agreement"
                  subtitle="One proposal, every participant, explicit consent. Membership alone is never enough."
                  action={
                    isSteward && !openAgreement ? (
                      <Button size="sm" icon="plus" onClick={() => setIntent('propose-group')}>
                        Propose agreement
                      </Button>
                    ) : null
                  }
                />
                {agreements.length === 0 ? (
                  <EmptyState icon="shield" title="No group agreement proposed">
                    <p>
                      Group-shared records linked to this community stay readable only by their
                      authors until an agreement is proposed and unanimously accepted.
                    </p>
                  </EmptyState>
                ) : (
                  <div className="stack-tight">
                    {(showAllAgreements ? agreements : agreements.slice(0, 1)).map((agreement) => {
                      const status = groupAgreementStatus(agreement);
                      const counts = groupAgreementCounts(agreement);
                      const ownResponse = agreement.responses.find((r) => r.personId === actorId);
                      return (
                        <div className={`agreement-card status-${status}`} key={agreement.id}>
                          <div className="agreement-head">
                            <div>
                              <div className="agreement-title-row">
                                <h3>{agreement.title}</h3>
                                <Badge
                                  tone={
                                    status === 'active'
                                      ? 'success'
                                      : status === 'declined'
                                        ? 'danger'
                                        : status === 'withdrawn'
                                          ? 'neutral'
                                          : 'warning'
                                  }
                                  dot
                                >
                                  {status === 'proposed' ? 'Awaiting responses' : status}
                                </Badge>
                              </div>
                              <p className="muted small">
                                Proposed by {personName(data, agreement.proposedBy)} ·{' '}
                                {formatDate(agreement.createdAt)}
                              </p>
                            </div>
                            <div className="agreement-progress">
                              <strong>
                                {counts.accepted}/{counts.required}
                              </strong>
                              <span>accepted</span>
                            </div>
                          </div>
                          <p>{agreement.description}</p>
                          {status === 'declined' ? (
                            <Notice tone="danger" icon="lock" title="This group relationship did not activate">
                              {counts.declined} participant{counts.declined === 1 ? '' : 's'} declined.
                              No group knowledge is shared through this proposal. Nobody is enrolled
                              in it, and a dissent cannot be overridden by majority.
                            </Notice>
                          ) : null}
                          {status === 'active' ? (
                            <Notice tone="success" icon="check" title="Active by unanimous consent">
                              Every named participant accepted. Records marked group-shared in this
                              community are now readable by those participants. A decline or
                              withdrawal by anyone ends the agreement; it does not quietly continue
                              among the rest.
                            </Notice>
                          ) : null}
                          <div className="response-list">
                            {agreement.responses.map((response) => (
                              <div className="response-row" key={response.personId}>
                                <Avatar
                                  name={personName(data, response.personId)}
                                  size="sm"
                                />
                                <span className="response-name">
                                  {personName(data, response.personId)}
                                  {response.personId === actorId ? ' (you)' : ''}
                                </span>
                                <span className="response-note">{response.note || ''}</span>
                                <Badge
                                  tone={
                                    response.state === 'accepted'
                                      ? 'success'
                                      : response.state === 'declined'
                                        ? 'danger'
                                        : 'neutral'
                                  }
                                >
                                  {response.state}
                                </Badge>
                              </div>
                            ))}
                          </div>
                          {(status === 'proposed' || status === 'active') &&
                          ownResponse?.state === 'pending' ? (
                            <div className="row-actions">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setAgreementToAnswer(agreement);
                                  setIntent('group-response');
                                }}
                              >
                                Respond to this agreement
                              </Button>
                            </div>
                          ) : null}
                          {status === 'proposed' && agreement.proposedBy === actorId ? (
                            <div className="row-actions">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  try {
                                    store.withdrawGroupAgreement(agreement.id);
                                    toast('Proposal withdrawn. Nothing was activated.', 'info');
                                  } catch (err) {
                                    toast(err instanceof Error ? err.message : 'Could not withdraw.', 'error');
                                  }
                                }}
                              >
                                Withdraw proposal
                              </Button>
                            </div>
                          ) : null}
                          {status === 'active' &&
                          ownResponse?.state === 'accepted' ? (
                            <div className="row-actions">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setRevokeGroupId(agreement.id)}
                              >
                                Withdraw my consent
                              </Button>
                              <span className="muted tiny">
                                Ends group sharing for everyone; the agreement becomes inactive.
                              </span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {agreements.length > 1 ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setShowAllAgreements((v) => !v)}
                      >
                        {showAllAgreements ? 'Show current agreement only' : `Show all ${agreements.length} agreements`}
                      </button>
                    ) : null}
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader
                  icon="knowledge"
                  title="Community knowledge"
                  subtitle="Group-shared, relationship-shared and public records linked to this community that you may read."
                  action={
                    <Button
                      size="sm"
                      onClick={() => navigate(`knowledge?compose=${community.id}&scope=community`)}
                    >
                      New record
                    </Button>
                  }
                />
                {knowledge.length === 0 ? (
                  <EmptyState icon="knowledge" title="No readable records linked here yet">
                    <p>
                      Link a knowledge record to this community when you create or edit it. Scope
                      decides who can read it.
                    </p>
                  </EmptyState>
                ) : (
                  <ul className="list">
                    {knowledge.slice(0, 6).map((record) => (
                      <li key={record.id}>
                        <Link to={`knowledge/${record.id}`} className="list-row row-link">
                          <ScopeBadge scope={record.scope} short />
                          <span className="list-main">
                            <span className="list-title-row">
                              <strong>{record.title}</strong>
                            </span>
                            <span className="list-sub">
                              {personName(data, record.authorId)} · updated{' '}
                              {relativeTime(record.updatedAt)} · {record.kind.replace('-', ' ')}
                            </span>
                          </span>
                          <Icon name="chevronRight" size={16} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {knowledge.length > 6 ? (
                  <Link className="text-link" to="knowledge">
                    All readable knowledge
                  </Link>
                ) : null}
                {!activeAgreement ? (
                  <p className="muted tiny">
                    Some community-scoped records may exist that you cannot read because no group
                    agreement including you is active. Their existence and authorship are not shown.
                  </p>
                ) : null}
              </Card>

              <div className="two-col tight-cols">
                <Card>
                  <CardHeader
                    icon="project"
                    title="Projects"
                    action={
                      <Button size="sm" onClick={() => navigate(`projects?compose=${community.id}`)}>
                        Start
                      </Button>
                    }
                  />
                  {projects.length === 0 ? (
                    <p className="muted small">No projects yet.</p>
                  ) : (
                    <ul className="list compact">
                      {projects.map((project) => (
                        <li key={project.id}>
                          <Link to={`projects/${project.id}`} className="project-mini">
                            <span className="project-mini-title">
                              <strong>{project.title}</strong>
                              <Badge tone={project.status === 'complete' ? 'success' : 'neutral'}>
                                {project.status}
                              </Badge>
                            </span>
                            <Progress value={projectProgress(project)} label={`${project.title} progress`} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card>
                  <CardHeader
                    icon="gathering"
                    title="Gatherings"
                    action={
                      <Button
                        size="sm"
                        onClick={() => navigate(`gatherings?compose=${community.id}`)}
                      >
                        Plan
                      </Button>
                    }
                  />
                  {gatherings.length === 0 ? (
                    <p className="muted small">No gatherings yet.</p>
                  ) : (
                    <ul className="list compact">
                      {gatherings.slice(0, 4).map((gathering) => (
                        <li key={gathering.id}>
                          <Link to={`gatherings/${gathering.id}`} className="mini-row">
                            <span>
                              <strong>{gathering.title}</strong>
                              <small>
                                {formatDateTime(gathering.startsAt)} ·{' '}
                                {GATHERING_KIND_LABELS[gathering.kind]}
                              </small>
                            </span>
                            <Badge
                              tone={
                                gathering.status === 'cancelled'
                                  ? 'danger'
                                  : gathering.status === 'completed'
                                    ? 'neutral'
                                    : 'success'
                              }
                            >
                              {gathering.status}
                            </Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <Card>
                <CardHeader
                  icon="network"
                  title="Inter-community agreements"
                  subtitle="Explicit, limited arrangements between independent communities. Never automatic federation."
                  action={
                    isSteward ? (
                      <Button size="sm" icon="plus" onClick={() => setIntent('propose-inter')}>
                        Propose
                      </Button>
                    ) : null
                  }
                />
                {interAgreements.length === 0 ? (
                  <EmptyState icon="network" title="No inter-community agreements">
                    <p>
                      Two communities can agree to share tools, a venue or a public reading list
                      without merging knowledge collections.
                    </p>
                  </EmptyState>
                ) : (
                  <div className="stack-tight">
                    {interAgreements.map((agreement) => {
                      const status = interAgreementStatus(agreement);
                      const ownParty = agreement.parties.find((p) => p.communityId === community.id);
                      const canAnswer = isSteward && ownParty?.state === 'pending';
                      return (
                        <div className="inter-card" key={agreement.id}>
                          <div className="agreement-title-row">
                            <h3>{agreement.title}</h3>
                            <Badge
                              tone={
                                status === 'active'
                                  ? 'success'
                                  : status === 'declined'
                                    ? 'danger'
                                    : 'warning'
                              }
                              dot
                            >
                              {status}
                            </Badge>
                          </div>
                          <p>{agreement.terms}</p>
                          <div className="party-row">
                            {agreement.parties.map((party) => {
                              const partyCommunity = data.communities.find(
                                (c) => c.id === party.communityId,
                              );
                              return (
                                <span className="party" key={party.communityId}>
                                  <Icon name="community" size={14} />
                                  {partyCommunity?.name ?? 'Unknown community'}
                                  <Badge
                                    tone={
                                      party.state === 'accepted'
                                        ? 'success'
                                        : party.state === 'declined'
                                          ? 'danger'
                                          : 'neutral'
                                    }
                                  >
                                    {party.state}
                                  </Badge>
                                </span>
                              );
                            })}
                          </div>
                          <p className="muted tiny">
                            Proposed by {personName(data, agreement.proposedBy)} ·{' '}
                            {formatDate(agreement.createdAt)}. No knowledge or membership access is
                            created by this record; the terms describe the arrangement.
                          </p>
                          {canAnswer ? (
                            <div className="row-actions">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                  try {
                                    store.respondToInterAgreement(agreement.id, community.id, true);
                                    toast('Your community accepted the agreement.');
                                  } catch (err) {
                                    toast(err instanceof Error ? err.message : 'Could not respond.', 'error');
                                  }
                                }}
                              >
                                Accept for {community.name}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  try {
                                    store.respondToInterAgreement(agreement.id, community.id, false);
                                    toast('Agreement declined for your community.', 'info');
                                  } catch (err) {
                                    toast(err instanceof Error ? err.message : 'Could not respond.', 'error');
                                  }
                                }}
                              >
                                Decline
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setInterTarget(agreement);
                                  setIntent('propose-inter');
                                }}
                              >
                                Review
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            <div className="stack">
              <Card>
                <CardHeader icon="users" title="Membership" subtitle="Names are listed only with each person’s consent." />
                <div className="membership-summary">
                  <span>
                    <strong>{activeMembers.length}</strong> active members
                  </span>
                  <span>
                    <strong>{directory.length}</strong> listed in directory
                  </span>
                  <span>
                    <strong>{pendingApplicants.length}</strong> pending
                  </span>
                </div>
                {isSteward && pendingApplicants.length > 0 ? (
                  <div className="pending-members">
                    <div className="field-inline-label">Requests for a steward</div>
                    {pendingApplicants.map((applicant) => (
                      <div className="pending-member-row" key={applicant.personId}>
                        <Avatar name={personName(data, applicant.personId)} size="sm" />
                        <div>
                          <strong>{personName(data, applicant.personId)}</strong>
                          <div className="muted tiny">{applicant.note || 'No note'}</div>
                        </div>
                        <div className="row-actions">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              try {
                                store.approveMembership(community.id, applicant.personId);
                                toast('Membership approved.');
                              } catch (err) {
                                toast(err instanceof Error ? err.message : 'Could not approve.', 'error');
                              }
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              try {
                                store.declineMembership(community.id, applicant.personId);
                                toast('Request declined.', 'info');
                              } catch (err) {
                                toast(err instanceof Error ? err.message : 'Could not decline.', 'error');
                              }
                            }}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="member-directory">
                  {directory.length === 0 ? (
                    <p className="muted small">
                      No members have opted into the directory. You can still work together; the
                      directory is optional.
                    </p>
                  ) : (
                    directory.map(({ membership: entry, person }) =>
                      person ? (
                        <div className="member-row" key={entry.personId}>
                          <Avatar name={person.name} size="sm" />
                          <div className="member-text">
                            <strong>
                              {person.name}
                              {person.id === actorId ? ' (you)' : ''}
                            </strong>
                            <span className="muted tiny">
                              {person.locality} · {person.skills.slice(0, 2).join(', ')}
                            </span>
                          </div>
                          <Badge tone={entry.role === 'steward' ? 'accent' : 'neutral'}>
                            {entry.role}
                          </Badge>
                        </div>
                      ) : null,
                    )
                  )}
                </div>
                <p className="muted tiny">
                  Some active members are not shown. Absence from the directory is not absence from
                  the community, and cannot be used to infer anything about their participation.
                </p>
              </Card>

              <Card>
                <CardHeader icon="leaf" title="Purpose & principles" />
                <p>{community.description}</p>
                <ul className="principle-list">
                  {community.principles.map((principle) => (
                    <li key={principle}>{principle}</li>
                  ))}
                </ul>
                <dl className="detail-list tight">
                  <div>
                    <dt>Locality</dt>
                    <dd>{community.locality || '—'}</dd>
                  </div>
                  <div>
                    <dt>Area</dt>
                    <dd>{community.geographicArea || '—'}</dd>
                  </div>
                  <div>
                    <dt>Joining</dt>
                    <dd>{community.joinPolicy === 'open' ? 'Open on this node' : 'Steward approval'}</dd>
                  </div>
                  <div>
                    <dt>Your role</dt>
                    <dd>{membership?.role ?? 'member'}</dd>
                  </div>
                </dl>
                {isSteward ? (
                  <Button size="sm" icon="edit" onClick={() => setIntent('edit')}>
                    Edit details
                  </Button>
                ) : null}
              </Card>

              <Card>
                <CardHeader icon="key" title="Sharing in this community" />
                <ul className="scope-legend">
                  <li>
                    <ScopeBadge scope="private" /> only the author
                  </li>
                  <li>
                    <ScopeBadge scope="relationship" /> active bilateral partners only
                  </li>
                  <li>
                    <ScopeBadge scope="community" /> active unanimous group agreement
                  </li>
                  <li>
                    <ScopeBadge scope="public" /> anyone on this node
                  </li>
                </ul>
                <p className="muted tiny">
                  Access is checked for lists, search, exports, charts and AI retrieval. It is not
                  only a matter of hidden buttons.
                </p>
              </Card>
            </div>
          </div>
        </>
      )}

      <CommunityFormModal
        open={intent === 'edit'}
        onClose={() => setIntent(null)}
        mode="edit"
        community={community}
      />
      <JoinCommunityModal
        community={community}
        open={intent === 'join'}
        onClose={() => setIntent(null)}
      />
      <GroupAgreementModal
        open={intent === 'propose-group'}
        onClose={() => setIntent(null)}
        community={community}
      />
      <GroupResponseModal
        agreement={agreementToAnswer}
        open={intent === 'group-response'}
        onClose={() => {
          setIntent(null);
          setAgreementToAnswer(null);
        }}
        community={community}
      />
      <InterAgreementModal
        open={intent === 'propose-inter'}
        onClose={() => {
          setIntent(null);
          setInterTarget(null);
        }}
        community={community}
        otherCommunities={otherCommunities}
        initial={interTarget}
      />
      <ConfirmDialog
        open={Boolean(revokeGroupId)}
        onClose={() => setRevokeGroupId(null)}
        onConfirm={() => {
          if (!revokeGroupId) return;
          try {
            store.revokeGroupConsent(revokeGroupId);
            toast('Consent withdrawn. The group agreement is inactive for everyone.', 'info');
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Could not withdraw consent.', 'error');
          }
        }}
        title="Withdraw consent from this group agreement?"
        confirmLabel="Withdraw consent"
        tone="danger"
      >
        <p>
          This changes the agreement from active to inactive. Group-shared knowledge in{' '}
          {community.name} stops being accessible through this agreement for every participant,
          including you.
        </p>
        <ul className="confirm-list">
          <li>Your response is recorded as declined, with the time and your optional note.</li>
          <li>The agreement does not continue among the remaining participants.</li>
          <li>Your separate bilateral relationships and other communities are unaffected.</li>
          <li>Copies people have already exported or memorised cannot be guaranteed to disappear.</li>
        </ul>
      </ConfirmDialog>
      <ConfirmDialog
        open={intent === 'leave'}
        onClose={() => setIntent(null)}
        onConfirm={leave}
        title={`Leave ${community.name}?`}
        confirmLabel="Leave community"
        tone="danger"
      >
        <p>Leaving ends your membership and any group-shared access through this community.</p>
        <ul className="confirm-list">
          <li>You will no longer see the member directory, projects or members-only gatherings.</li>
          <li>Group-shared knowledge in this community becomes inaccessible to you.</li>
          <li>Records you authored keep their chosen scope; group members may still read group-shared ones.</li>
          <li>A membership event is recorded. Your relationships elsewhere are unaffected.</li>
        </ul>
        {membership?.role === 'steward' && activeMembers.filter((m) => m.role === 'steward').length === 1 ? (
          <p className="muted small">
            You are the only steward. The community would be left without one; another member would
            need node-level help to take on that role in this prototype.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function GroupAgreementModal({
  open,
  onClose,
  community,
}: {
  open: boolean;
  onClose: () => void;
  community: Community;
}) {
  const { store, snapshot } = useApp();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const activeMembers = community.members.filter((m) => m.status === 'active');

  const submit = () => {
    setError('');
    try {
      store.proposeGroupAgreement(community.id, title, description);
      toast(
        'Proposal recorded. Every participant — including you — must accept before anything activates.',
        'info',
      );
      setTitle('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not propose the agreement.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Propose a group knowledge agreement"
      description={`${activeMembers.length} active members would need to accept individually. Nothing activates until all have.`}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="send" onClick={submit}>
            Record proposal
          </Button>
        </>
      }
    >
      <div className="stack-tight">
        {error ? <FormError>{error}</FormError> : null}
        <Field label="Agreement title" htmlFor="ga-title" required>
          <input
            id="ga-title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Shared water and soil observations"
            maxLength={140}
          />
        </Field>
        <Field
          label="What would this agreement cover?"
          htmlFor="ga-description"
          required
          hint="Be explicit about the purpose. It governs group-scoped records in this community only."
        >
          <textarea
            id="ga-description"
            className="textarea"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Why this group needs shared working knowledge, what it includes, and any limits participants should know."
          />
        </Field>
        <div>
          <div className="field-inline-label">Participants who must accept</div>
          <div className="participant-chips">
            {activeMembers.map((m) => (
              <span className="person-chip" key={m.personId}>
                <Avatar name={personName(snapshot.data, m.personId)} size="sm" />
                {personName(snapshot.data, m.personId)}
                {m.personId === snapshot.settings.actorId ? ' (you)' : ''}
              </span>
            ))}
          </div>
        </div>
        <Notice tone="warn" icon="shield" title="Consent is not implied">
          Proposing is not accepting. The proposal starts with every response pending, and one
          decline closes it without activation. A majority cannot override a refusal. No member’s
          other relationships or communities are inherited by this agreement.
        </Notice>
      </div>
    </Modal>
  );
}

function GroupResponseModal({
  agreement,
  open,
  onClose,
  community,
}: {
  agreement: GroupAgreement | null;
  open: boolean;
  onClose: () => void;
  community: Community;
}) {
  const { store, snapshot } = useApp();
  const toast = useToast();
  const [acknowledged, setAcknowledged] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  if (!agreement) return null;
  const sharedCount = snapshot.data.knowledge.filter(
    (k) => k.communityId === community.id && k.scope === 'community',
  ).length;
  const counts = groupAgreementCounts(agreement);

  const respond = (accept: boolean) => {
    setError('');
    try {
      store.respondToGroupAgreement(agreement.id, accept, note);
      toast(
        accept
          ? groupAgreementStatus({ ...agreement, responses: agreement.responses.map((r) => (r.personId === snapshot.settings.actorId ? { ...r, state: 'accepted' } : r)) }) === 'active'
            ? 'You accepted. Every participant has now accepted, so group sharing is active.'
            : 'You accepted. The agreement remains inactive until every other participant accepts.'
          : 'You declined. The proposed group agreement is inactive and grants no access.',
        accept ? 'success' : 'info',
      );
      setAcknowledged(false);
      setNote('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record your response.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Respond to group agreement"
      description={agreement.title}
      size="lg"
      footer={
        <>
          <Button
            onClick={() => respond(false)}
          >
            Decline
          </Button>
          <Button variant="primary" disabled={!acknowledged} onClick={() => respond(true)}>
            Accept group sharing
          </Button>
        </>
      }
    >
      <div className="stack-tight">
        {error ? <FormError>{error}</FormError> : null}
        <p>{agreement.description}</p>
        <div className="agreement-summary-row">
          <Badge tone={counts.declined ? 'danger' : 'warning'} dot>
            {counts.accepted}/{counts.required} accepted
          </Badge>
          <span className="muted small">
            {counts.declined
              ? `${counts.declined} decline already closes this proposal.`
              : 'Every participant must accept. One refusal is enough to keep it inactive.'}
          </span>
        </div>
        <div>
          <div className="field-inline-label">What accepting changes</div>
          <ul className="consent-list">
            <li>
              All records marked group-shared in {community.name} become readable by the
              participants who accepted — currently {sharedCount} record
              {sharedCount === 1 ? '' : 's'} across all authors.
            </li>
            <li>
              Your own records marked group-shared become readable by every participant of this
              agreement.
            </li>
            <li>
              Nothing else is shared: not private records, not relationship-shared records, not your
              other communities or relationships.
            </li>
            <li>
              Declining leaves you in the community, but the group relationship stays inactive for
              everyone. Others may make separate bilateral agreements with you.
            </li>
          </ul>
        </div>
        <Field label="Note for the record (optional)" htmlFor="group-note">
          <textarea
            id="group-note"
            className="textarea"
            rows={2}
            maxLength={300}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anything participants should know about your decision."
          />
        </Field>
        <label className="consent-ack">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>
            I have read what becomes accessible and I explicitly accept this group-wide agreement.
            I understand one decline keeps it inactive.
          </span>
        </label>
      </div>
    </Modal>
  );
}

function InterAgreementModal({
  open,
  onClose,
  community,
  otherCommunities,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  community: Community;
  otherCommunities: Community[];
  initial: InterCommunityAgreement | null;
}) {
  const { store } = useApp();
  const toast = useToast();
  const [otherId, setOtherId] = useState(initial ? '' : otherCommunities[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [terms, setTerms] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    setError('');
    try {
      store.proposeInterAgreement(community.id, otherId, title, terms);
      toast('Proposal recorded for both communities. The other party must accept.', 'info');
      setTitle('');
      setTerms('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not propose the agreement.');
    }
  };

  if (initial) {
    const status = interAgreementStatus(initial);
    return (
      <Modal open={open} onClose={onClose} title={initial.title} size="md" footer={<Button onClick={onClose}>Close</Button>}>
        <div className="stack-tight">
          <div className="agreement-title-row">
            <Badge tone={status === 'active' ? 'success' : status === 'declined' ? 'danger' : 'warning'} dot>
              {status}
            </Badge>
            <span className="muted small">Proposed {formatDate(initial.createdAt)}</span>
          </div>
          <p>{initial.terms}</p>
          <div className="party-row">
            {initial.parties.map((party) => (
              <span className="party" key={party.communityId}>
                <Icon name="community" size={14} />
                {[community, ...otherCommunities].find((c) => c.id === party.communityId)?.name ??
                  'Community'}
                <Badge tone={party.state === 'accepted' ? 'success' : party.state === 'declined' ? 'danger' : 'neutral'}>
                  {party.state}
                </Badge>
              </span>
            ))}
          </div>
          <Notice tone="quiet" icon="info">
            This prototype records inter-community agreements as governance documents. It does not
            automatically exchange knowledge, memberships or field data under them.
          </Notice>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Propose an inter-community agreement"
      description="Explicit and limited. Each community’s steward must accept separately."
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="send" onClick={submit}>
            Propose to both communities
          </Button>
        </>
      }
    >
      <div className="stack-tight">
        {error ? <FormError>{error}</FormError> : null}
        <Field label="Other community" htmlFor="inter-community">
          <select
            id="inter-community"
            className="select"
            value={otherId}
            onChange={(event) => setOtherId(event.target.value)}
          >
            {otherCommunities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Agreement title" htmlFor="inter-title" required>
          <input
            id="inter-title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Shared tool library"
            maxLength={140}
          />
        </Field>
        <Field
          label="Terms"
          htmlFor="inter-terms"
          required
          hint="What is shared, for how long, and what is explicitly excluded. Write it as an agreement, not an aspiration."
        >
          <textarea
            id="inter-terms"
            className="textarea"
            rows={5}
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            placeholder="Both communities may borrow tools for up to 28 days. No member lists, field data or knowledge records are exchanged under this agreement."
          />
        </Field>
        <Notice tone="warn" icon="info">
          This does not merge communities, share knowledge automatically or imply trust. The record
          is visible to both communities’ members and can be declined by either party.
        </Notice>
      </div>
    </Modal>
  );
}
