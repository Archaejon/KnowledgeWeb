import { useState } from 'react';
import { accessFor, personName, visibleKnowledge } from '../core/access';
import { pendingRelationshipInvitations } from '../core/consent';
import { formatDateTime, relativeTime } from '../core/dates';
import {
  attendanceFor,
  myProjects,
  projectProgress,
  readableKnowledge,
  upcomingGatherings,
} from '../core/selectors';
import { Link } from '../router';
import { useApp } from '../store-context';
import { ConsentDialog } from '../components/ConsentDialog';
import { Icon } from '../components/Icon';
import { ThemeMark } from '../components/ThemeMark';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  InlineMeta,
  Notice,
  Progress,
  ScopeBadge,
} from '../components/ui';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function HomePage() {
  const { snapshot, store } = useApp();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const actor = data.people.find((p) => p.id === actorId);
  const [consentId, setConsentId] = useState<string | null>(null);

  const pending = pendingRelationshipInvitations(data, actorId);
  const incoming = pending.filter((r) => r.initiatedBy !== actorId);
  const accessSummary = readableKnowledge(data, actorId);
  const shared = accessSummary.filter((k) => k.authorId !== actorId).slice(0, 4);
  const projects = myProjects(data, actorId).filter((p) => p.status === 'active');
  const gatherings = upcomingGatherings(data, actorId, 3);
  const selectedRelationship = data.relationships.find((r) => r.id === consentId);

  const stats = [
    {
      label: 'Upcoming gatherings',
      value: gatherings.length,
      icon: 'gathering' as const,
      href: 'gatherings',
      hint: gatherings[0] ? relativeTime(gatherings[0].startsAt) : 'Nothing scheduled',
    },
    {
      label: 'Active projects',
      value: projects.length,
      icon: 'project' as const,
      href: 'projects',
      hint: `${projects.reduce((sum, p) => sum + p.tasks.filter((t) => t.status !== 'done').length, 0)} open tasks`,
    },
    {
      label: 'Connection requests',
      value: incoming.length,
      icon: 'network' as const,
      href: 'network',
      hint: incoming.length ? 'Waiting for your answer' : 'No requests waiting',
    },
    {
      label: 'Knowledge you can read',
      value: accessSummary.length,
      icon: 'knowledge' as const,
      href: 'knowledge',
      hint: `Including ${visibleKnowledge(data, actorId).filter((k) => k.scope === 'private').length} private`,
    },
  ];

  return (
    <div className="stack home-page">
      {settings.showSampleBanner ? (
        <Notice tone="warn" title="Fictional demonstration node">
          <p>
            Every person, community and measurement here is invented sample data. Identities and
            connections are simulated. Nothing in this prototype is a real community record.
          </p>
          <div className="notice-actions">
            <Link to="network" className="text-link">
              See how consent is enforced <Icon name="arrowRight" size={14} />
            </Link>
            <button
              type="button"
              className="text-button"
              onClick={() => store.setSampleBanner(false)}
            >
              Hide notice
            </button>
          </div>
        </Notice>
      ) : null}

      <section className="hero">
        <div className="hero-mark" aria-hidden="true">
          <ThemeMark theme={settings.theme} size={180} />
        </div>
        <div className="hero-content">
          <div className="eyebrow">
            {greeting()} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1>
            {actor?.name.split(' ')[0]}, here is what your communities are tending.
          </h1>
          <p className="hero-lede">
            Understory holds the knowledge, practical work and agreements of communities that meet
            in person. Access is by explicit mutual consent, not by default.
          </p>
          <div className="hero-actions">
            <Button variant="primary" icon="network" onClick={() => (window.location.hash = '#/network')}>
              Open the network
            </Button>
            <Link className="btn btn-quiet btn-md" to="knowledge">
              <Icon name="plus" size={16} /> Add knowledge
            </Link>
            <Link className="btn btn-ghost btn-md" to="places">
              <Icon name="leaf" size={16} /> Record an observation
            </Link>
          </div>
        </div>
        <div className="hero-principles">
          <div>
            <Icon name="shield" size={16} />
            <span>Consent is binary and revocable</span>
          </div>
          <div>
            <Icon name="users" size={16} />
            <span>Built for meeting, not scrolling</span>
          </div>
          <div>
            <Icon name="database" size={16} />
            <span>Your node, your local data</span>
          </div>
        </div>
      </section>

      <div className="stat-grid">
        {stats.map((stat) => (
          <Link to={stat.href} className="stat" key={stat.label}>
            <span className="stat-icon">
              <Icon name={stat.icon} size={19} />
            </span>
            <span className="stat-value">{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
            <span className="stat-hint">{stat.hint}</span>
          </Link>
        ))}
      </div>

      <div className="home-grid">
        <div className="stack">
          <Card>
            <CardHeader
              icon="key"
              title="Consent inbox"
              subtitle="Pending invitations are records only. They grant nothing until explicitly accepted."
              action={
                <Link className="text-link" to="network">
                  All connections
                </Link>
              }
            />
            {pending.length === 0 ? (
              <EmptyState
                icon="shield"
                title="No pending requests"
                action={
                  <Link className="btn btn-quiet btn-sm" to="network">
                    Invite someone
                  </Link>
                }
              >
                <p>New invitations will appear here. Declining is always a clear, recorded choice.</p>
              </EmptyState>
            ) : (
              <ul className="list consent-inbox">
                {pending.map((relationship) => {
                  const otherId =
                    relationship.aId === actorId ? relationship.bId : relationship.aId;
                  const other = data.people.find((p) => p.id === otherId);
                  const isIncoming = relationship.initiatedBy !== actorId;
                  return (
                    <li className="list-row" key={relationship.id}>
                      <Avatar name={other?.name ?? 'Unknown'} />
                      <div className="list-main">
                        <div className="list-title-row">
                          <strong>{other?.name ?? 'Unknown participant'}</strong>
                          <Badge tone={isIncoming ? 'warning' : 'neutral'} dot>
                            {isIncoming ? 'Wants to connect' : 'Waiting for reply'}
                          </Badge>
                        </div>
                        <p className="list-sub">
                          {relationship.message || 'No message attached.'}
                        </p>
                        <InlineMeta
                          items={[
                            other?.locality,
                            `${otherId === actorId ? 0 : 1} bilateral`,
                            `sent ${relativeTime(relationship.proposedAt)}`,
                          ]}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant={isIncoming ? 'primary' : 'quiet'}
                        onClick={() => setConsentId(relationship.id)}
                      >
                        {isIncoming ? 'Review request' : 'View'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              icon="gathering"
              title="Next in person"
              subtitle="Plans are only useful if they get people into the same room, shed or field."
              action={
                <Link className="text-link" to="gatherings">
                  All gatherings
                </Link>
              }
            />
            {gatherings.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="Nothing coming up"
                action={
                  <Link className="btn btn-quiet btn-sm" to="gatherings">
                    Plan a gathering
                  </Link>
                }
              >
                <p>Schedule a meeting, work party or study circle for one of your communities.</p>
              </EmptyState>
            ) : (
              <ul className="list gathering-list compact">
                {gatherings.map((gathering) => {
                  const attendance = attendanceFor(gathering, actorId);
                  return (
                    <li key={gathering.id}>
                      <Link to={`gatherings/${gathering.id}`} className="list-row row-link">
                        <span className="date-block">
                          <span className="date-day">
                            {new Date(gathering.startsAt).getDate()}
                          </span>
                          <span className="date-month">
                            {new Date(gathering.startsAt).toLocaleDateString('en-GB', {
                              month: 'short',
                            })}
                          </span>
                        </span>
                        <span className="list-main">
                          <span className="list-title-row">
                            <strong>{gathering.title}</strong>
                            <Badge tone={gathering.status === 'confirmed' ? 'success' : 'neutral'}>
                              {gathering.status}
                            </Badge>
                          </span>
                          <span className="list-sub">
                            {formatDateTime(gathering.startsAt)} · {gathering.venueName}
                          </span>
                          <InlineMeta
                            items={[
                              gathering.locality,
                              attendance === 'going'
                                ? 'You are going'
                                : attendance === 'maybe'
                                  ? 'You said maybe'
                                  : 'No response yet',
                            ]}
                          />
                        </span>
                        <Icon name="chevronRight" size={17} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHeader
              icon="project"
              title="Shared work"
              subtitle="Active projects in your communities."
              action={
                <Link className="text-link" to="projects">
                  All projects
                </Link>
              }
            />
            {projects.length === 0 ? (
              <EmptyState icon="project" title="No active projects">
                <p>Start something practical with one of your communities.</p>
              </EmptyState>
            ) : (
              <ul className="list project-mini-list">
                {projects.slice(0, 3).map((project) => (
                  <li key={project.id}>
                    <Link to={`projects/${project.id}`} className="project-mini">
                      <span className="project-mini-title">
                        <strong>{project.title}</strong>
                        <Badge tone="neutral">{project.status}</Badge>
                      </span>
                      <span className="muted small">
                        {data.communities.find((c) => c.id === project.communityId)?.name}
                      </span>
                      <Progress value={projectProgress(project)} label={`${project.title} progress`} />
                      <span className="muted tiny">
                        Lead {personName(data, project.leadId)} · {project.tasks.filter((t) => t.status !== 'done').length}{' '}
                        open tasks
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              icon="knowledge"
              title="Recently shared with you"
              subtitle="Only records your current relationships and agreements permit."
              action={
                <Link className="text-link" to="knowledge">
                  Library
                </Link>
              }
            />
            {shared.length === 0 ? (
              <EmptyState icon="knowledge" title="Nothing shared yet">
                <p>
                  When someone marks knowledge relationship-shared, or a group agreement becomes
                  active, it appears here.
                </p>
              </EmptyState>
            ) : (
              <ul className="list knowledge-mini-list">
                {shared.map((record) => {
                  const decision = accessFor(data, actorId, record);
                  return (
                    <li key={record.id}>
                      <Link to={`knowledge/${record.id}`} className="knowledge-mini">
                        <span className="knowledge-mini-top">
                          <ScopeBadge scope={record.scope} short />
                          <span className="muted tiny">{relativeTime(record.updatedAt)}</span>
                        </span>
                        <strong>{record.title}</strong>
                        <span className="muted small">
                          {personName(data, record.authorId)} · {decision.channel === 'relationship' ? 'via your relationship' : decision.channel === 'community-agreement' ? 'via group agreement' : 'public'}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="node-summary">
            <CardHeader icon="database" title="This node" />
            <dl className="detail-list tight">
              <div>
                <dt>Name</dt>
                <dd>{data.node.name}</dd>
              </div>
              <div>
                <dt>Acting identity</dt>
                <dd>
                  {actor?.name} <Badge tone="sample">demo switch</Badge>
                </dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>{snapshot.storageError ? 'Memory only — save failed' : 'Browser local storage'}</dd>
              </div>
              <div>
                <dt>Transport</dt>
                <dd>
                  <Badge tone="warning">local only</Badge>
                </dd>
              </div>
            </dl>
            <p className="muted tiny">
              No network transport is active in this prototype. Access checks run in the local node
              service. <Link to="about">Read the boundaries</Link>.
            </p>
          </Card>
        </div>
      </div>

      <ConsentDialog
        relationship={selectedRelationship}
        open={Boolean(selectedRelationship)}
        onClose={() => setConsentId(null)}
      />
    </div>
  );
}
