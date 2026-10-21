import { useState } from 'react';
import { canManageCommunity, canRead, canViewGathering, personName } from '../core/access';
import { formatDate, formatDateTime, fromLocalInput, toLocalInput } from '../core/dates';
import { gatheringIcs } from '../core/ics';
import { GATHERING_KIND_LABELS } from '../core/labels';
import {
  attendanceFor,
  attendanceCounts,
  gatheringKnowledge,
  myCommunities,
  upcomingGatherings,
  visibleNodalLocations,
} from '../core/selectors';
import type { Gathering, GatheringKind, GatheringStatus } from '../core/types';
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
  DownloadButton,
  EmptyState,
  Field,
  FormError,
  InlineMeta,
  Modal,
  Notice,
  PageHeader,
  Tabs,
} from '../components/ui';

export function GatheringsPage({ gatheringId }: { gatheringId?: string }) {
  if (gatheringId) return <GatheringDetail gatheringId={gatheringId} />;
  return <GatheringIndex />;
}

function statusTone(status: GatheringStatus) {
  return status === 'cancelled'
    ? 'danger'
    : status === 'completed'
      ? 'neutral'
      : status === 'confirmed'
        ? 'success'
        : 'accent';
}

function GatheringIndex() {
  const { snapshot } = useApp();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const [tab, setTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [createOpen, setCreateOpen] = useState(
    Boolean(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('compose')),
  );
  const composeCommunity =
    new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('compose') ?? '';

  const mine = data.gatherings.filter((g) => canViewGathering(data, actorId, g));
  const upcoming = upcomingGatherings(data, actorId);
  const past = mine
    .filter(
      (g) =>
        !upcoming.some((u) => u.id === g.id) &&
        (g.status === 'completed' ||
          g.status === 'cancelled' ||
          new Date(g.startsAt).getTime() < Date.now()),
    )
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const all = [...mine].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const list = tab === 'upcoming' ? upcoming : tab === 'past' ? past : all;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="In person"
        title="Gatherings"
        lede="Meetings, work parties, study circles and shared meals. The point of planning here is to get people into the same place, not to maximise attendance."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
            Plan a gathering
          </Button>
        }
      />

      <div className="filter-bar">
        <Tabs
          label="Gathering period"
          value={tab}
          onChange={(value) => setTab(value as 'upcoming' | 'past' | 'all')}
          options={[
            { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { value: 'past', label: 'Past & cancelled', count: past.length },
            { value: 'all', label: 'All', count: all.length },
          ]}
        />
        <span className="muted small">
          {mine.length} gatherings across {myCommunities(data, actorId).length} communities
        </span>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon="gathering"
          title={tab === 'upcoming' ? 'Nothing coming up' : 'No gatherings here yet'}
          action={
            <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
              Plan a gathering
            </Button>
          }
        >
          <p>
            A gathering can be a meeting, a work party, a study circle, a meal or a local field
            visit. Add an agenda and the practical things people need to bring.
          </p>
        </EmptyState>
      ) : (
        <div className="gathering-cards">
          {list.map((gathering) => {
            const community = data.communities.find((c) => c.id === gathering.communityId);
            const counts = attendanceCounts(gathering);
            const response = attendanceFor(gathering, actorId);
            const pastGathering =
              gathering.status === 'completed' || gathering.status === 'cancelled';
            return (
              <Card key={gathering.id} className={`gathering-card status-${gathering.status}`}>
                <div className="gathering-date">
                  <span className="gathering-day">{new Date(gathering.startsAt).getDate()}</span>
                  <span className="gathering-month">
                    {new Date(gathering.startsAt).toLocaleDateString('en-GB', { month: 'short' })}
                  </span>
                  <span className="gathering-year">{new Date(gathering.startsAt).getFullYear()}</span>
                </div>
                <div className="gathering-main">
                  <div className="list-title-row">
                    <Link to={`gatherings/${gathering.id}`} className="gathering-title">
                      {gathering.title}
                    </Link>
                    <Badge tone={statusTone(gathering.status)} dot>
                      {gathering.status}
                    </Badge>
                  </div>
                  <div className="muted small">
                    {GATHERING_KIND_LABELS[gathering.kind]} · {formatDateTime(gathering.startsAt)} ·{' '}
                    {gathering.venueName}
                  </div>
                  <InlineMeta
                    items={[
                      <Link key="c" to={`communities/${gathering.communityId}`}>
                        {community?.name}
                      </Link>,
                      gathering.locality,
                      `Organised by ${personName(data, gathering.organiserId)}`,
                      gathering.capacity ? `${counts.going}/${gathering.capacity} places` : `${counts.going} going`,
                      counts.maybe ? `${counts.maybe} maybe` : null,
                    ]}
                  />
                  {gathering.outcomes ? (
                    <p className="gathering-outcome-snippet">
                      <Icon name="check" size={14} /> {gathering.outcomes.decisions[0] ?? gathering.outcomes.notes.slice(0, 120)}
                    </p>
                  ) : null}
                </div>
                <div className="gathering-side">
                  {!pastGathering ? (
                    response === 'going' ? (
                      <Badge tone="success" dot>
                        You are going
                      </Badge>
                    ) : response === 'maybe' ? (
                      <Badge tone="warning" dot>
                        You said maybe
                      </Badge>
                    ) : response === 'declined' ? (
                      <Badge tone="neutral">You declined</Badge>
                    ) : (
                      <Badge tone="neutral">No response</Badge>
                    )
                  ) : null}
                  <Button size="sm" onClick={() => navigate(`gatherings/${gathering.id}`)}>
                    Open
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader icon="leaf" title="Why gather in person?" />
        <p>
          This module exists to support meetings, shared work and study that happen in a room, a
          field or a shed. There is no follower count, public event discovery or viral sharing here.
          Attendance is a practical commitment between people who already share a community.
        </p>
      </Card>

      <GatheringFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        initialCommunityId={composeCommunity}
      />
    </div>
  );
}

function GatheringDetail({ gatheringId }: { gatheringId: string }) {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const gathering = data.gatherings.find((g) => g.id === gatheringId);
  const [editOpen, setEditOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  if (!gathering) {
    return (
      <EmptyState
        icon="gathering"
        title="Gathering not found"
        action={
          <Link className="btn btn-primary btn-md" to="gatherings">
            Back to gatherings
          </Link>
        }
      >
        <p>This record may have been removed, or you may not have access to it.</p>
      </EmptyState>
    );
  }

  const allowed = canViewGathering(data, actorId, gathering);
  if (!allowed) {
    return (
      <EmptyState icon="lock" title="This gathering is not shared with you">
        <p>Only members of the community and the organiser can see its practical details.</p>
        <Link className="btn btn-primary btn-md" to="gatherings">
          Back to gatherings
        </Link>
      </EmptyState>
    );
  }

  const community = data.communities.find((c) => c.id === gathering.communityId);
  const isOrganiser = gathering.organiserId === actorId;
  const canManage = isOrganiser || canManageCommunity(data, actorId, gathering.communityId);
  const counts = attendanceCounts(gathering);
  const response = attendanceFor(gathering, actorId);
  const knowledge = gatheringKnowledge(data, actorId, gathering);
  const going = gathering.responses.filter(
    (r) => r.state === 'going' || r.state === 'maybe',
  );

  const setAttendance = (state: 'going' | 'maybe' | 'declined') => {
    try {
      store.setAttendance(gathering.id, state);
      toast(
        state === 'going'
          ? 'You are marked as going. It will show in your calendar export.'
          : state === 'maybe'
            ? 'Marked as maybe. The organiser can see this.'
            : 'Marked as not attending.',
        'info',
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update attendance.', 'error');
    }
  };

  const toggleStatus = (status: GatheringStatus) => {
    try {
      store.setGatheringStatus(gathering.id, status);
      toast(`Gathering marked as ${status}.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not change status.', 'error');
    }
  };

  return (
    <div className="stack">
      <div className="breadcrumb">
        <Link to="gatherings">Gatherings</Link>
        <Icon name="chevronRight" size={13} />
        <span>{gathering.title}</span>
      </div>

      <PageHeader
        eyebrow={`${GATHERING_KIND_LABELS[gathering.kind]} · ${community?.name}`}
        title={gathering.title}
        lede={gathering.description}
        actions={
          <div className="header-actions">
            <DownloadButton
              filename={`${gathering.title.replace(/[^\w]+/g, '-').toLowerCase()}.ics`}
              content={gatheringIcs(gathering, community?.name ?? 'Community')}
              mime="text/calendar"
              icon="calendar"
            >
              Add to calendar
            </DownloadButton>
            {canManage ? (
              <>
                <Button icon="edit" onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
                {gathering.status === 'planned' ? (
                  <Button variant="primary" icon="check" onClick={() => toggleStatus('confirmed')}>
                    Confirm
                  </Button>
                ) : null}
                {canManage && gathering.status !== 'completed' && gathering.status !== 'cancelled' ? (
                  <Button icon="knowledge" onClick={() => setOutcomeOpen(true)}>
                    Record outcomes
                  </Button>
                ) : null}
              </>
            ) : null}
            {canManage && gathering.status !== 'completed' && gathering.status !== 'cancelled' ? (
              <Button variant="ghost" icon="cancel" onClick={() => setCancelOpen(true)}>
                Cancel event
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="header-meta-row">
          <Badge tone={statusTone(gathering.status)} dot>
            {gathering.status}
          </Badge>
          <span>
            <Icon name="calendar" size={14} /> {formatDateTime(gathering.startsAt)}
            {gathering.endsAt ? ` – ${new Date(gathering.endsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
          <span>
            <Icon name="mapPin" size={14} /> {gathering.venueName}, {gathering.locality}
          </span>
          <span>
            <Icon name="users" size={14} /> {counts.going} going
            {gathering.capacity ? ` / ${gathering.capacity} places` : ''}
          </span>
        </div>
      </PageHeader>

      {gathering.status === 'cancelled' ? (
        <Notice tone="danger" icon="cancel" title="This gathering was cancelled">
          The record is kept for the community’s memory. No attendance action is available.
        </Notice>
      ) : null}

      <div className="two-col gathering-layout">
        <div className="stack">
          <Card>
            <CardHeader icon="knowledge" title="About this gathering" />
            <p className="prose">{gathering.description}</p>
            <dl className="detail-list">
              <div>
                <dt>Community</dt>
                <dd>
                  <Link to={`communities/${gathering.communityId}`}>{community?.name}</Link>
                </dd>
              </div>
              <div>
                <dt>Organiser</dt>
                <dd>{personName(data, gathering.organiserId)}</dd>
              </div>
              <div>
                <dt>Venue</dt>
                <dd>
                  {gathering.venueName}
                  {gathering.nodalLocationId ? (
                    <>
                      {' · '}
                      <Link to={`nodal-locations/${gathering.nodalLocationId}`}>Nodal location</Link>
                    </>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Locality</dt>
                <dd>{gathering.locality || '—'}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader icon="gathering" title="Agenda" subtitle="Times are indicative; the conversation does not need to obey them." />
            {gathering.agenda.length === 0 ? (
              <p className="muted small">No agenda recorded. Add one when you edit the gathering.</p>
            ) : (
              <ol className="agenda-list">
                {gathering.agenda.map((item) => (
                  <li key={item.id}>
                    <span>{item.title}</span>
                    {item.minutes ? <span className="muted tiny">{item.minutes} min</span> : null}
                  </li>
                ))}
              </ol>
            )}
            {gathering.requirements.length > 0 ? (
              <div className="requirements">
                <div className="field-inline-label">What to bring / know</div>
                <ul className="tag-list">
                  {gathering.requirements.map((requirement) => (
                    <li key={requirement} className="chip">
                      {requirement}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          {gathering.status !== 'cancelled' ? (
            <Card className="rsvp-card">
              <CardHeader icon="check" title="Your response" subtitle="Attendance helps the organiser prepare food, tools and space." />
              <div className="rsvp-actions">
                {(
                  [
                    ['going', 'I am going', 'check'],
                    ['maybe', 'Maybe', 'clock'],
                    ['declined', 'Cannot make it', 'x'],
                  ] as const
                ).map(([value, label, icon]) => (
                  <Button
                    key={value}
                    variant={response === value ? 'primary' : 'quiet'}
                    icon={icon}
                    onClick={() => setAttendance(value)}
                    aria-pressed={response === value}
                    disabled={gathering.status === 'completed'}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {gathering.responses.some((r) => r.personId === actorId && r.note) ? (
                <p className="muted small">
                  Your note: {gathering.responses.find((r) => r.personId === actorId)?.note}
                </p>
              ) : null}
              {gathering.status === 'confirmed' ? (
                <p className="muted tiny">
                  This gathering is confirmed. If plans change, the organiser can cancel it and
                  everyone sees the record.
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader
              icon="knowledge"
              title="Outcomes, decisions and lessons"
              subtitle="Record what happened so the community’s memory is not only in someone’s head."
              action={
                canManage && gathering.status !== 'cancelled' ? (
                  <Button size="sm" icon="edit" onClick={() => setOutcomeOpen(true)}>
                    {gathering.outcomes ? 'Update' : 'Record'}
                  </Button>
                ) : null
              }
            />
            {gathering.outcomes ? (
              <div className="outcome-block">
                <p className="prose">{gathering.outcomes.notes}</p>
                <div className="outcome-columns">
                  {gathering.outcomes.decisions.length > 0 ? (
                    <div>
                      <div className="field-inline-label">Decisions</div>
                      <ul className="outcome-list">
                        {gathering.outcomes.decisions.map((decision) => (
                          <li key={decision}>{decision}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {gathering.outcomes.lessons.length > 0 ? (
                    <div>
                      <div className="field-inline-label">Lessons</div>
                      <ul className="outcome-list">
                        {gathering.outcomes.lessons.map((lesson) => (
                          <li key={lesson}>{lesson}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {gathering.outcomes.followUps.length > 0 ? (
                    <div>
                      <div className="field-inline-label">Follow-ups</div>
                      <ul className="outcome-list">
                        {gathering.outcomes.followUps.map((followUp) => (
                          <li key={followUp}>{followUp}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <p className="muted tiny">
                  Recorded by {personName(data, gathering.outcomes.recordedBy)} on{' '}
                  {formatDate(gathering.outcomes.recordedAt)}.
                </p>
              </div>
            ) : (
              <EmptyState icon="book" title="No outcomes recorded">
                <p>
                  After the gathering, the organiser can note what was decided, what was learned and
                  what happens next. This keeps meetings connected to work.
                </p>
              </EmptyState>
            )}
          </Card>

          <Card>
            <CardHeader
              icon="knowledge"
              title="Connected knowledge"
              subtitle="Only records you are authorised to read are listed."
              action={
                canManage ? (
                  <Button size="sm" icon="plus" onClick={() => setLinkOpen(true)}>
                    Link record
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(
                        `knowledge?compose=${gathering.communityId}&scope=community&gathering=${gathering.id}`,
                      )
                    }
                  >
                    Add record
                  </Button>
                )
              }
            />
            {knowledge.length === 0 ? (
              <p className="muted small">Nothing linked yet.</p>
            ) : (
              <ul className="list">
                {knowledge.map((record) => (
                  <li key={record.id}>
                    <Link to={`knowledge/${record.id}`} className="list-row row-link">
                      <Icon name="file" size={16} />
                      <span className="list-main">
                        <strong>{record.title}</strong>
                        <span className="list-sub">
                          {record.kind.replace('-', ' ')} · {personName(data, record.authorId)}
                        </span>
                      </span>
                      <Icon name="chevronRight" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted tiny">
              Linking a record does not change who can read it. Scope controls access.
            </p>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHeader icon="users" title="Who is coming" />
            <div className="attendance-summary">
              <div>
                <strong>{counts.going}</strong>
                <span>going</span>
              </div>
              <div>
                <strong>{counts.maybe}</strong>
                <span>maybe</span>
              </div>
              <div>
                <strong>{gathering.capacity ? gathering.capacity - counts.going : '—'}</strong>
                <span>{gathering.capacity ? 'places left' : 'no cap'}</span>
              </div>
            </div>
            {going.length === 0 ? (
              <p className="muted small">No responses yet.</p>
            ) : (
              <ul className="attendee-list">
                {going.map((entry) => {
                  const person = data.people.find((p) => p.id === entry.personId);
                  if (!person) return null;
                  return (
                    <li key={entry.personId}>
                      <Avatar name={person.name} size="sm" />
                      <span>
                        {person.name}
                        {entry.personId === actorId ? ' (you)' : ''}
                      </span>
                      <Badge tone={entry.state === 'going' ? 'success' : 'warning'}>
                        {entry.state}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="muted tiny">
              Responses are visible to community members and the organiser. There is no public
              attendance feed.
            </p>
          </Card>

          <Card>
            <CardHeader icon="calendar" title="Practical details" />
            <dl className="detail-list tight">
              <div>
                <dt>Starts</dt>
                <dd>{formatDateTime(gathering.startsAt)}</dd>
              </div>
              <div>
                <dt>Ends</dt>
                <dd>{gathering.endsAt ? formatDateTime(gathering.endsAt) : 'Not specified'}</dd>
              </div>
              <div>
                <dt>Venue</dt>
                <dd>
                  {gathering.venueName}
                  {gathering.nodalLocationId ? (
                    <>
                      {' · '}
                      <Link to={`nodal-locations/${gathering.nodalLocationId}`}>Nodal location</Link>
                    </>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Capacity</dt>
                <dd>{gathering.capacity ?? 'No limit set'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{gathering.status}</dd>
              </div>
            </dl>
            <DownloadButton
              filename={`${gathering.title.replace(/[^\w]+/g, '-').toLowerCase()}.ics`}
              content={gatheringIcs(gathering, community?.name ?? 'Community')}
              mime="text/calendar"
              icon="calendar"
            >
              Download .ics
            </DownloadButton>
          </Card>

          {gathering.status === 'completed' && gathering.outcomes ? (
            <Notice tone="success" icon="check" title="Completed and recorded">
              {gathering.outcomes.followUps.length} follow-up
              {gathering.outcomes.followUps.length === 1 ? '' : 's'} captured. Connected records
              remain under their own sharing scopes.
            </Notice>
          ) : null}

          <Card>
            <CardHeader icon="shield" title="In-person by design" />
            <p className="muted small">
              This page supports preparation and memory for a real gathering. It is not a live
              stream, an event marketplace or a way to collect a public audience.
            </p>
          </Card>
        </div>
      </div>

      <GatheringFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        gathering={gathering}
      />
      <OutcomeModal
        key={gathering.outcomes?.recordedAt ?? 'new-outcome'}
        open={outcomeOpen}
        onClose={() => setOutcomeOpen(false)}
        gathering={gathering}
      />
      <LinkKnowledgeModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        gathering={gathering}
      />
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => toggleStatus('cancelled')}
        title={`Cancel “${gathering.title}”?`}
        confirmLabel="Cancel gathering"
        tone="danger"
      >
        <p>
          The gathering will remain in community records as cancelled. This does not delete linked
          knowledge, attendance history or outcomes.
        </p>
        <p className="muted small">
          {counts.going} people marked as going will see the cancelled status when they next open
          the record. No notification is sent in this prototype.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function GatheringFormModal({
  open,
  onClose,
  mode,
  gathering,
  initialCommunityId,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  gathering?: Gathering;
  initialCommunityId?: string;
}) {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const communities = myCommunities(data, settings.actorId);
  const nodalOptions = visibleNodalLocations(data, settings.actorId);
  const defaultCommunity =
    gathering?.communityId ||
    initialCommunityId ||
    communities[0]?.id ||
    '';
  const [form, setForm] = useState({
    communityId: defaultCommunity,
    title: gathering?.title ?? '',
    kind: gathering?.kind ?? ('meeting' as GatheringKind),
    description: gathering?.description ?? '',
    startsAt: gathering ? toLocalInput(gathering.startsAt) : '',
    endsAt: gathering ? toLocalInput(gathering.endsAt) : '',
    venueName: gathering?.venueName ?? '',
    locality: gathering?.locality ?? '',
    nodalLocationId: gathering?.nodalLocationId ?? '',
    capacity: gathering?.capacity?.toString() ?? '',
    agenda: gathering?.agenda.map((a) => a.title).join('\n') ?? '',
    requirements: gathering?.requirements.join('\n') ?? '',
  });
  const [error, setError] = useState('');
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    setError('');
    try {
      if (mode === 'create') {
        const id = store.createGathering({
          communityId: form.communityId,
          title: form.title,
          kind: form.kind,
          description: form.description,
          startsAt: fromLocalInput(form.startsAt),
          endsAt: form.endsAt ? fromLocalInput(form.endsAt) : undefined,
          venueName: form.venueName,
          locality: form.locality,
          nodalLocationId: form.nodalLocationId || undefined,
          capacity: form.capacity ? Number(form.capacity) : undefined,
          agenda: form.agenda.split('\n').map((a) => a.trim()).filter(Boolean),
          requirements: form.requirements.split('\n').map((r) => r.trim()).filter(Boolean),
        });
        toast('Gathering created. You are marked as going.');
        onClose();
        navigate(`gatherings/${id}`);
      } else if (gathering) {
        store.updateGathering(gathering.id, {
          title: form.title,
          description: form.description,
          venueName: form.venueName,
          locality: form.locality,
          nodalLocationId: form.nodalLocationId,
          startsAt: fromLocalInput(form.startsAt),
          endsAt: form.endsAt ? fromLocalInput(form.endsAt) : '',
          capacity: form.capacity ? Number(form.capacity) : undefined,
          agenda: form.agenda
            .split('\n')
            .map((title) => title.trim())
            .filter(Boolean)
            .map((title, index) => ({
              id: `ag-edit-${index}`,
              title,
            })),
          requirements: form.requirements.split('\n').map((r) => r.trim()).filter(Boolean),
        });
        toast('Gathering updated.');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the gathering.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Plan a gathering' : 'Edit gathering'}
      description="Practical details help people turn up. Keep the plan honest and specific."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={submit}>
            {mode === 'create' ? 'Create gathering' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {error ? <FormError>{error}</FormError> : null}
        {mode === 'create' ? (
          <Field label="Community" htmlFor="g-community" required>
            <select
              id="g-community"
              className="select"
              value={form.communityId}
              onChange={(event) => set('communityId', event.target.value)}
            >
              <option value="">Choose a community…</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <div className="form-row">
          <Field label="Title" htmlFor="g-title" required>
            <input
              id="g-title"
              className="input"
              value={form.title}
              maxLength={140}
              onChange={(event) => set('title', event.target.value)}
              placeholder="e.g. Autumn work party"
            />
          </Field>
          <Field label="Type" htmlFor="g-kind">
            <select
              id="g-kind"
              className="select"
              value={form.kind}
              onChange={(event) => set('kind', event.target.value as GatheringKind)}
            >
              {Object.entries(GATHERING_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description" htmlFor="g-description" required>
          <textarea
            id="g-description"
            className="textarea"
            rows={3}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </Field>
        <div className="form-row">
          <Field label="Starts" htmlFor="g-start" required>
            <input
              id="g-start"
              type="datetime-local"
              className="input"
              value={form.startsAt}
              onChange={(event) => set('startsAt', event.target.value)}
            />
          </Field>
          <Field label="Ends" htmlFor="g-end">
            <input
              id="g-end"
              type="datetime-local"
              className="input"
              value={form.endsAt}
              onChange={(event) => set('endsAt', event.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Nodal location"
          htmlFor="g-nodal"
          hint="Optional. Links this gathering to a physical place in the directory."
        >
          <select
            id="g-nodal"
            className="select"
            value={form.nodalLocationId}
            onChange={(event) => {
              const id = event.target.value;
              const place = nodalOptions.find((item) => item.id === id);
              setForm((previous) => ({
                ...previous,
                nodalLocationId: id,
                venueName: place ? place.name : previous.venueName,
                locality: place && !previous.locality ? place.locality : previous.locality,
              }));
            }}
          >
            <option value="">Not linked to a nodal location</option>
            {nodalOptions.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name} — {place.locality || 'no locality'}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Venue" htmlFor="g-venue" required>
            <input
              id="g-venue"
              className="input"
              value={form.venueName}
              onChange={(event) => set('venueName', event.target.value)}
              placeholder="Shed, hall, field, address"
            />
          </Field>
          <Field label="Locality" htmlFor="g-locality">
            <input
              id="g-locality"
              className="input"
              value={form.locality}
              onChange={(event) => set('locality', event.target.value)}
            />
          </Field>
        </div>
        <Field label="Capacity" htmlFor="g-capacity" hint="Leave blank for no limit.">
          <input
            id="g-capacity"
            type="number"
            min={1}
            max={500}
            className="input"
            value={form.capacity}
            onChange={(event) => set('capacity', event.target.value)}
          />
        </Field>
        <Field label="Agenda" htmlFor="g-agenda" hint="One item per line. Timings optional.">
          <textarea
            id="g-agenda"
            className="textarea"
            rows={4}
            value={form.agenda}
            onChange={(event) => set('agenda', event.target.value)}
            placeholder={'Welcome and check-in\nReview the water readings\nAgree winter work'}
          />
        </Field>
        <Field label="What to bring / practical requirements" htmlFor="g-requirements" hint="One per line.">
          <textarea
            id="g-requirements"
            className="textarea"
            rows={3}
            value={form.requirements}
            onChange={(event) => set('requirements', event.target.value)}
            placeholder={'Stout boots\nGloves\nA chair'}
          />
        </Field>
        <Notice tone="quiet" icon="info">
          Creating a gathering does not expose it beyond the community. There is no public event
          discovery in this prototype.
        </Notice>
      </div>
    </Modal>
  );
}

function OutcomeModal({
  open,
  onClose,
  gathering,
}: {
  open: boolean;
  onClose: () => void;
  gathering: Gathering;
}) {
  const { store } = useApp();
  const toast = useToast();
  const [notes, setNotes] = useState(gathering.outcomes?.notes ?? '');
  const [decisions, setDecisions] = useState(gathering.outcomes?.decisions.join('\n') ?? '');
  const [lessons, setLessons] = useState(gathering.outcomes?.lessons.join('\n') ?? '');
  const [followUps, setFollowUps] = useState(gathering.outcomes?.followUps.join('\n') ?? '');
  const [error, setError] = useState('');

  const submit = () => {
    setError('');
    try {
      store.recordGatheringOutcome(gathering.id, {
        notes,
        decisions: decisions.split('\n').map((d) => d.trim()).filter(Boolean),
        lessons: lessons.split('\n').map((d) => d.trim()).filter(Boolean),
        followUps: followUps.split('\n').map((d) => d.trim()).filter(Boolean),
      });
      toast('Outcomes recorded. The gathering is marked completed.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record outcomes.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record gathering outcomes"
      description="Write down enough that someone who was not there can understand what was decided."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={submit}>
            Save outcomes
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {error ? <FormError>{error}</FormError> : null}
        <Field label="What happened" htmlFor="outcome-notes" required>
          <textarea
            id="outcome-notes"
            className="textarea"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Who came, what was discussed, how the work went."
          />
        </Field>
        <Field label="Decisions" htmlFor="outcome-decisions" hint="One per line.">
          <textarea
            id="outcome-decisions"
            className="textarea"
            rows={3}
            value={decisions}
            onChange={(event) => setDecisions(event.target.value)}
          />
        </Field>
        <Field label="Lessons learned" htmlFor="outcome-lessons" hint="One per line.">
          <textarea
            id="outcome-lessons"
            className="textarea"
            rows={3}
            value={lessons}
            onChange={(event) => setLessons(event.target.value)}
          />
        </Field>
        <Field label="Follow-up actions" htmlFor="outcome-followups" hint="One per line.">
          <textarea
            id="outcome-followups"
            className="textarea"
            rows={3}
            value={followUps}
            onChange={(event) => setFollowUps(event.target.value)}
          />
        </Field>
        <Notice tone="quiet" icon="lock">
          These notes are visible to community members. Personal reflections or private matters
          belong in a private knowledge record, not here.
        </Notice>
      </div>
    </Modal>
  );
}

function LinkKnowledgeModal({
  open,
  onClose,
  gathering,
}: {
  open: boolean;
  onClose: () => void;
  gathering: Gathering;
}) {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const readable = snapshot.data.knowledge
    .filter((k) => canRead(snapshot.data, snapshot.settings.actorId, k))
    .filter((k) => !gathering.knowledgeIds.includes(k.id))
    .sort((a, b) => a.title.localeCompare(b.title));
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');

  const link = () => {
    setError('');
    try {
      if (!selected) throw new Error('Choose a record to link.');
      store.linkKnowledgeToGathering(gathering.id, selected);
      toast('Knowledge linked. Sharing scope is unchanged.');
      setSelected('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link the record.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Link an existing knowledge record"
      description="Only records you can read are listed. Linking does not change who else can read them."
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={link} icon="link">
            Link record
          </Button>
        </>
      }
    >
      <div className="stack-tight">
        {error ? <FormError>{error}</FormError> : null}
        <Field label="Knowledge record" htmlFor="link-record" required>
          <select
            id="link-record"
            className="select"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Choose a record…</option>
            {readable.map((record) => (
              <option key={record.id} value={record.id}>
                {record.title} ({record.scope})
              </option>
            ))}
          </select>
        </Field>
        {readable.length === 0 ? (
          <p className="muted small">
            No unlinked records are readable by you. Create a meeting note or link an existing
            record with a compatible scope.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
