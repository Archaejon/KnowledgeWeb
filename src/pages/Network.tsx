import { useMemo, useState } from 'react';
import {
  canRead,
  knownPeople,
  knowledgeSharedBy,
  personName,
  relationshipScopeTitles,
  visibleDirectory,
} from '../core/access';
import { groupAgreementCounts, groupAgreementStatus, relationshipFor } from '../core/consent';
import { formatDate, relativeTime } from '../core/dates';
import {
  buildNetworkGraph,
  defaultFilters,
  edgeExplanation,
  edgeLabel,
} from '../core/network';
import type { GraphNode, NetworkFilters } from '../core/network';
import { myCommunities } from '../core/selectors';
import type { PersonRelationship } from '../core/types';
import { Link, navigate } from '../router';
import { useApp } from '../store-context';
import { ConsentDialog, RevokeRelationshipDialog } from '../components/ConsentDialog';
import { Icon } from '../components/Icon';
import { NetworkGraphView, NetworkLegend } from '../components/NetworkGraph';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  FormError,
  Modal,
  Notice,
  PageHeader,
  Tabs,
} from '../components/ui';
import { useToast } from '../components/Toast';

type NodeTab = 'overview' | 'text' | 'walkthrough';

export function NetworkPage() {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const [filters, setFilters] = useState<NetworkFilters>({ ...defaultFilters });
  const [consentId, setConsentId] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [panelTab, setPanelTab] = useState<NodeTab>('overview');
  const [showAllHistory, setShowAllHistory] = useState(false);

  const graph = useMemo(() => buildNetworkGraph(data, actorId, filters), [data, actorId, filters]);
  const communities = myCommunities(data, actorId);
  const projects = data.projects.filter((p) =>
    communities.some((c) => c.id === p.communityId),
  );
  const localities = Array.from(
    new Set([
      ...communities.map((c) => c.locality).filter(Boolean),
      ...knownPeople(data, actorId).map((p) => p.locality).filter(Boolean),
    ]),
  ).sort();

  const myRelationships = data.relationships.filter(
    (r) => (r.aId === actorId || r.bId === actorId) && relationshipFor(data, actorId, r.aId === actorId ? r.bId : r.aId)?.id === r.id,
  );
  const pending = myRelationships.filter((r) => r.status === 'pending');
  const active = myRelationships.filter((r) => r.status === 'active');
  const closed = myRelationships.filter((r) => r.status === 'declined' || r.status === 'revoked');

  const inviteCandidates = data.people
    .filter((p) => p.id !== actorId && p.id !== 'p-you')
    .filter((person) => {
      const current = relationshipFor(data, actorId, person.id);
      if (current?.status === 'active' || current?.status === 'pending') return false;
      const direct = Boolean(current);
      const sharesCommunity = communities.some((c) =>
        c.members.some((m) => m.personId === person.id && m.status === 'active'),
      );
      return person.directoryOptIn || direct || sharesCommunity;
    });

  const selectedRelationship = data.relationships.find((r) => r.id === consentId);
  const revokeRelationship = data.relationships.find((r) => r.id === revokeId);

  const updateFilter = <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const openInvite = (target = '') => {
    setInviteTarget(target);
    setInviteMessage('');
    setInviteError('');
    setInviteOpen(true);
  };

  const submitInvite = () => {
    setInviteError('');
    if (!inviteTarget) {
      setInviteError('Choose a participant to invite.');
      return;
    }
    try {
      store.inviteToConnect(inviteTarget, inviteMessage);
      setInviteOpen(false);
      toast('Invitation recorded. It grants no access until the other person accepts.', 'info');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not send invitation.');
    }
  };

  const inspectedPerson = selectedNode?.type === 'person' || selectedNode?.type === 'self'
    ? data.people.find((p) => p.id === selectedNode.id)
    : undefined;
  const inspectedRelationship = inspectedPerson ? relationshipFor(data, actorId, inspectedPerson.id) : undefined;
  const inspectedCommunity = selectedNode?.type === 'community'
    ? data.communities.find((c) => c.id === selectedNode.id)
    : undefined;
  const inspectedProject = selectedNode?.type === 'project'
    ? data.projects.find((p) => p.id === selectedNode.id)
    : undefined;

  const relationshipForPair = (relationship: PersonRelationship) => {
    const otherId = relationship.aId === actorId ? relationship.bId : relationship.aId;
    return data.people.find((p) => p.id === otherId);
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Consent network"
        title="Network"
        lede="Bilateral relationships, invitations and community agreements — shown only as they concern you. A line on this graph is a claim about structure, not trust."
        actions={
          <Button variant="primary" icon="plus" onClick={() => openInvite()}>
            Invite someone
          </Button>
        }
      />

      <Card className="network-map-card">
        <CardHeader
          icon="network"
          title="The map"
          subtitle="Your visible network, drawn from live consent records. Drag the ground to move around, scroll to zoom, and drag a node to put it where it belongs."
          action={
            <div className="map-counts">
              <span>
                <strong>{graph.nodes.length}</strong> nodes
              </span>
              <span>
                <strong>{graph.edges.length}</strong> edges
              </span>
              <span>
                <strong>{graph.metrics.activeRelationships}</strong> active
              </span>
            </div>
          }
        />

        <div className="map-toolbar">
          <div className="map-toolbar-row">
            <span className="map-toolbar-label">Edges</span>
            <label className="check chip-check">
              <input
                type="checkbox"
                checked={filters.active}
                onChange={(event) => updateFilter('active', event.target.checked)}
              />
              <span>Active</span>
            </label>
            <label className="check chip-check">
              <input
                type="checkbox"
                checked={filters.pending}
                onChange={(event) => updateFilter('pending', event.target.checked)}
              />
              <span>Pending</span>
            </label>
            <label className="check chip-check">
              <input
                type="checkbox"
                checked={filters.declined}
                onChange={(event) => updateFilter('declined', event.target.checked)}
              />
              <span>Declined</span>
            </label>
            <span className="map-toolbar-divider" aria-hidden="true" />
            <label className="check chip-check">
              <input
                type="checkbox"
                checked={filters.showMemberships}
                onChange={(event) => updateFilter('showMemberships', event.target.checked)}
              />
              <span>Memberships</span>
            </label>
            <label className="check chip-check">
              <input
                type="checkbox"
                checked={filters.showProjects}
                onChange={(event) => updateFilter('showProjects', event.target.checked)}
              />
              <span>Projects</span>
            </label>
            <label className="check chip-check">
              <input
                type="checkbox"
                checked={filters.showAgreements}
                onChange={(event) => updateFilter('showAgreements', event.target.checked)}
              />
              <span>Agreements</span>
            </label>
            <label className="check chip-check">
              <input
                type="checkbox"
                checked={filters.showDensity}
                onChange={(event) => updateFilter('showDensity', event.target.checked)}
              />
              <span>Density</span>
            </label>
          </div>
          <div className="map-toolbar-row map-toolbar-selects">
            <label className="map-select">
              <span>Community</span>
              <select
                className="select select-sm"
                value={filters.communityId}
                onChange={(event) => updateFilter('communityId', event.target.value)}
              >
                <option value="all">All my communities</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="map-select">
              <span>Location</span>
              <select
                className="select select-sm"
                value={filters.locality}
                onChange={(event) => updateFilter('locality', event.target.value)}
              >
                <option value="all">All locations</option>
                {localities.map((locality) => (
                  <option key={locality} value={locality}>
                    {locality}
                  </option>
                ))}
              </select>
            </label>
            <label className="map-select">
              <span>Project</span>
              <select
                className="select select-sm"
                value={filters.projectId}
                onChange={(event) => updateFilter('projectId', event.target.value)}
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
            <Button size="sm" variant="ghost" onClick={() => setFilters({ ...defaultFilters })}>
              Reset filters
            </Button>
          </div>
        </div>

        <div className="graph-wrap">
          <NetworkGraphView
            graph={graph}
            theme={settings.theme}
            actorId={actorId}
            onSelect={(node) => setSelectedNode(node)}
            showDensity={filters.showDensity}
          />
          <NetworkLegend graph={graph} />
        </div>
        <p className="map-note">
          Density is visible edges ÷ possible pairs. It describes the shape of what you can see,
          never the strength of a relationship or the quality of knowledge. The optional halos are
          sized by visible members, not importance.
        </p>
      </Card>

      <div className="two-col network-layout">
        <div className="stack">
          <Card>
            <div className="panel-tabs-bar">
              <Tabs
                label="Network panels"
                value={panelTab}
                onChange={(value) => setPanelTab(value as NodeTab)}
                options={[
                  { value: 'overview', label: 'Consent', count: pending.length },
                  { value: 'text', label: 'Text view' },
                  { value: 'walkthrough', label: 'Walkthrough' },
                ]}
              />
            </div>

            {panelTab === 'overview' ? (
              <div className="stack-tight">
                <div className="section-heading">
                  <div>
                    <h3>Pending invitations</h3>
                    <p className="muted small">
                      An invitation is an administrative record. It provides no access to any
                      knowledge in either direction.
                    </p>
                  </div>
                  <Badge tone={pending.length ? 'warning' : 'neutral'} dot>
                    {pending.length} pending
                  </Badge>
                </div>
                {pending.length === 0 ? (
                  <EmptyState icon="clock" title="No pending invitations">
                    <p>Invite someone you already know through a community or relationship.</p>
                  </EmptyState>
                ) : (
                  <ul className="list pending-list">
                    {pending.map((relationship) => {
                      const other = relationshipForPair(relationship);
                      const incoming = relationship.initiatedBy !== actorId;
                      return (
                        <li className="list-row" key={relationship.id}>
                          <Avatar name={other?.name ?? '?'} />
                          <div className="list-main">
                            <div className="list-title-row">
                              <strong>{other?.name}</strong>
                              <Badge tone={incoming ? 'warning' : 'neutral'}>
                                {incoming ? 'Incoming' : 'Sent'}
                              </Badge>
                            </div>
                            <p className="list-sub">
                              {relationship.message || 'No message attached.'}
                            </p>
                            <span className="muted tiny">
                              {incoming
                                ? `They asked ${relativeTime(relationship.proposedAt)}. No knowledge is shared while pending.`
                                : `Waiting since ${relativeTime(relationship.proposedAt)}. No knowledge is shared while pending.`}
                            </span>
                          </div>
                          <div className="row-actions">
                            <Button
                              size="sm"
                              variant={incoming ? 'primary' : 'quiet'}
                              onClick={() => setConsentId(relationship.id)}
                            >
                              {incoming ? 'Review' : 'View'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setRevokeId(relationship.id)}
                            >
                              Withdraw
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="section-heading with-rule">
                  <div>
                    <h3>Active relationships</h3>
                    <p className="muted small">
                      Full mutual access to relationship-shared knowledge. No partial levels.
                    </p>
                  </div>
                  <Badge tone="success" dot>
                    {active.length} active
                  </Badge>
                </div>
                {active.length === 0 ? (
                  <EmptyState icon="network" title="No active relationships">
                    <p>
                      Accept a pending invitation, or invite someone you know in person. Community
                      membership alone does not create a relationship.
                    </p>
                  </EmptyState>
                ) : (
                  <div className="connection-grid">
                    {active.map((relationship) => {
                      const other = relationshipForPair(relationship);
                      if (!other) return null;
                      const theyShare = knowledgeSharedBy(data, actorId, other.id).length;
                      const youShare = relationshipScopeTitles(data, actorId).length;
                      return (
                        <div className="connection-card" key={relationship.id}>
                          <div className="connection-head">
                            <Avatar name={other.name} />
                            <div>
                              <strong>{other.name}</strong>
                              <div className="muted tiny">
                                {other.handle} · {other.locality}
                              </div>
                            </div>
                            <Badge tone="success" dot>
                              Active
                            </Badge>
                          </div>
                          <dl className="connection-counts">
                            <div>
                              <dt>They share</dt>
                              <dd>{theyShare} record{theyShare === 1 ? '' : 's'}</dd>
                            </div>
                            <div>
                              <dt>You share</dt>
                              <dd>{youShare} record{youShare === 1 ? '' : 's'}</dd>
                            </div>
                          </dl>
                          <p className="muted tiny">
                            Since {formatDate(relationship.respondedAt ?? relationship.proposedAt)}.
                            All of their relationship-shared knowledge is available; nothing more.
                          </p>
                          <div className="row-actions">
                            <Button size="sm" onClick={() => setSelectedNode({ id: other.id, type: 'person', label: other.name })}>
                              Inspect
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setRevokeId(relationship.id)}>
                              Revoke
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {closed.length > 0 ? (
                  <div className="history-block">
                    <button
                      type="button"
                      className="disclosure"
                      onClick={() => setShowAllHistory((v) => !v)}
                      aria-expanded={showAllHistory}
                    >
                      <Icon name={showAllHistory ? 'chevronDown' : 'chevronRight'} size={15} />
                      Closed relationship history ({closed.length})
                    </button>
                    {showAllHistory ? (
                      <ul className="list history-list">
                        {closed.map((relationship) => {
                          const other = relationshipForPair(relationship);
                          const type = relationship.status === 'revoked'
                            ? 'Revoked'
                            : 'Declined';
                          return (
                            <li className="list-row" key={relationship.id}>
                              <span className="history-dot" aria-hidden="true" />
                              <div className="list-main">
                                <div className="list-title-row">
                                  <strong>{other?.name}</strong>
                                  <Badge tone={relationship.status === 'revoked' ? 'danger' : 'neutral'}>{type}</Badge>
                                </div>
                                <p className="list-sub">
                                  {relationship.status === 'revoked'
                                    ? `Access ended ${formatDate(relationship.revokedAt ?? '')}. Future access blocked; no cached copies held here.`
                                    : `Declined ${formatDate(relationship.respondedAt ?? '')}. No access was granted.`}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {panelTab === 'text' ? (
              <div className="stack-tight">
                <p className="muted small">
                  A text view of the same visible structure. Select an item to inspect what the
                  connection means.
                </p>
                <div className="text-graph-grid">
                  <div>
                    <h4 className="mini-heading">Nodes ({graph.nodes.length})</h4>
                    <ul className="plain-list">
                      {graph.nodes.map((node) => (
                        <li key={node.id}>
                          <button
                            type="button"
                            className="text-node"
                            onClick={() => setSelectedNode(node)}
                          >
                            <Icon
                              name={
                                node.type === 'community'
                                  ? 'community'
                                  : node.type === 'project'
                                    ? 'project'
                                    : 'users'
                              }
                              size={15}
                            />
                            <span>
                              {node.label}
                              <small>{node.type}</small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="mini-heading">Edges ({graph.edges.length})</h4>
                    <ul className="plain-list">
                      {graph.edges.map((edge) => (
                        <li key={edge.id} className="text-edge">
                          <Badge tone={edge.type === 'relationship-pending' ? 'warning' : 'neutral'}>
                            {edgeLabel(edge.type)}
                          </Badge>
                          <span>{edge.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

            {panelTab === 'walkthrough' ? (
              <Walkthrough
                onReview={(id) => setConsentId(id)}
                onInspect={(id) => {
                  const person = data.people.find((p) => p.id === id);
                  if (person) setSelectedNode({ id, type: 'person', label: person.name });
                }}
              />
            ) : null}
          </Card>
        </div>

        <div className="stack network-side">
          <Card>
            <CardHeader
              icon="network"
              title="Network overview"
              subtitle="Visible structure only. No ranking, scores or inferred trust."
            />
            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-value">{graph.metrics.activeRelationships}</span>
                <span className="metric-label">active relationships</span>
              </div>
              <div className="metric">
                <span className="metric-value">{graph.metrics.pendingInvitations}</span>
                <span className="metric-label">pending invitations</span>
              </div>
              <div className="metric">
                <span className="metric-value">{graph.metrics.isolated}</span>
                <span className="metric-label">unlinked nodes</span>
              </div>
              <div className="metric">
                <span className="metric-value">{graph.metrics.communitiesWithBridges}</span>
                <span className="metric-label">agreement bridges</span>
              </div>
            </div>
            <div className="density-bar">
              <div className="density-bar-head">
                <span>Visible edge density</span>
                <strong>{graph.metrics.density}%</strong>
              </div>
              <div className="density-track">
                <span style={{ width: `${Math.min(100, graph.metrics.density)}%` }} />
              </div>
              <p className="muted tiny">
                {graph.metrics.edges} edges between {graph.metrics.nodes} visible nodes. This metric
                is structural, not social. It does not imply consent outside the labelled edges.
              </p>
            </div>
            {graph.metrics.components > 1 ? (
              <p className="muted small">
                The visible graph has {graph.metrics.components} separate components. Different
                communities can share infrastructure without sharing knowledge; agreements are
                explicit and limited.
              </p>
            ) : null}
          </Card>

          <Card>
            <CardHeader icon="shield" title="What this graph will not do" />
            <ul className="principle-list">
              <li>It never draws another person’s bilateral relationships.</li>
              <li>It does not infer trust, authority, expertise or knowledge quality.</li>
              <li>It does not rank people by connections or activity.</li>
              <li>Pending or declined edges visibly grant no access.</li>
              <li>Community proximity is not a sharing agreement.</li>
            </ul>
          </Card>
        </div>
      </div>

      <ConsentDialog
        relationship={selectedRelationship}
        open={Boolean(selectedRelationship)}
        onClose={() => setConsentId(null)}
      />
      <RevokeRelationshipDialog
        relationship={revokeRelationship}
        open={Boolean(revokeRelationship)}
        onClose={() => setRevokeId(null)}
      />

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite someone to connect"
        description="You can only invite people you already know through a community or an existing connection. There is no public people search."
        footer={
          <>
            <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button variant="primary" icon="send" onClick={submitInvite}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="stack-tight">
          {inviteError ? <FormError>{inviteError}</FormError> : null}
          <Field label="Participant" htmlFor="invite-target" required>
            <select
              id="invite-target"
              className="select"
              value={inviteTarget}
              onChange={(event) => setInviteTarget(event.target.value)}
            >
              <option value="">Choose a participant…</option>
              {inviteCandidates.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} ({person.handle})
                </option>
              ))}
            </select>
          </Field>
          {inviteTarget ? (
            <InvitePreview personId={inviteTarget} />
          ) : (
            <p className="muted small">
              People who opted out of directories do not appear unless you already have a
              relationship with them.
            </p>
          )}
          <Field
            label="Message (optional)"
            htmlFor="invite-message"
            hint="Say why you want to exchange knowledge. The other person sees this before deciding."
          >
            <textarea
              id="invite-message"
              className="textarea"
              rows={3}
              maxLength={500}
              value={inviteMessage}
              onChange={(event) => setInviteMessage(event.target.value)}
              placeholder="We have been comparing water readings. Shall we exchange notes directly?"
            />
          </Field>
          <Notice tone="quiet" icon="lock">
            Sending an invitation does not share anything. Access begins only when the other person
            accepts, and it is reciprocal.
          </Notice>
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedNode)}
        onClose={() => setSelectedNode(null)}
        title={inspectedPerson?.name ?? inspectedCommunity?.name ?? inspectedProject?.title ?? 'Node'}
        description={
          selectedNode
            ? selectedNode.type === 'self'
              ? 'Your local identity.'
              : selectedNode.type === 'person'
                ? 'A participant in your visible network.'
                : selectedNode.type === 'community'
                  ? 'A community space.'
                  : 'A practical project.'
            : undefined
        }
        size="md"
        footer={<Button onClick={() => setSelectedNode(null)}>Close</Button>}
      >
        {inspectedPerson ? (
          <div className="stack-tight">
            <div className="consent-identity compact">
              <Avatar name={inspectedPerson.name} size="lg" />
              <div>
                <h3>
                  {inspectedPerson.handle} · <span className="muted small">node {inspectedPerson.nodeLabel}</span>
                </h3>
                <p>{inspectedPerson.bio}</p>
                <p className="muted small">
                  <Icon name="mapPin" size={13} /> {inspectedPerson.locality}
                  {inspectedPerson.skills.length ? ` · ${inspectedPerson.skills.join(', ')}` : ''}
                </p>
              </div>
            </div>
            {inspectedPerson.id === actorId ? (
              <p className="muted small">This is you. Switch acting identity in Node settings to view another participant’s authorised view.</p>
            ) : inspectedRelationship ? (
              <div className={`relationship-state state-${inspectedRelationship.status}`}>
                <div className="relationship-state-head">
                  <Badge
                    tone={
                      inspectedRelationship.status === 'active'
                        ? 'success'
                        : inspectedRelationship.status === 'pending'
                          ? 'warning'
                          : 'danger'
                    }
                    dot
                  >
                    {inspectedRelationship.status}
                  </Badge>
                  <span className="muted small">
                    {inspectedRelationship.status === 'active'
                      ? 'Bilateral and mutual'
                      : inspectedRelationship.status === 'pending'
                        ? 'No access in either direction'
                        : 'No access'}
                  </span>
                </div>
                <p>
                  {edgeExplanation(
                    inspectedRelationship.status === 'active'
                      ? 'relationship-active'
                      : inspectedRelationship.status === 'pending'
                        ? 'relationship-pending'
                        : 'relationship-declined',
                  )}
                </p>
                {inspectedRelationship.status === 'active' ? (
                  <>
                    <p className="muted small">
                      You can read {knowledgeSharedBy(data, actorId, inspectedPerson.id).length} of
                      their relationship-shared records. They can read{' '}
                      {relationshipScopeTitles(data, actorId).length} of yours. No private or
                      group-shared records are included.
                    </p>
                    <Button size="sm" variant="danger" onClick={() => setRevokeId(inspectedRelationship.id)}>
                      Revoke relationship
                    </Button>
                  </>
                ) : inspectedRelationship.status === 'pending' && inspectedRelationship.initiatedBy !== actorId ? (
                  <Button size="sm" variant="primary" onClick={() => setConsentId(inspectedRelationship.id)}>
                    Review invitation
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="stack-tight">
                <Notice tone="quiet" icon="lock">
                  No current relationship. You may know each other through a community, but that
                  grants no bilateral knowledge access.
                </Notice>
                <Button size="sm" icon="plus" onClick={() => openInvite(inspectedPerson.id)}>
                  Invite to connect
                </Button>
              </div>
            )}
            <div>
              <h4 className="mini-heading">Shared communities</h4>
              <p className="muted small">
                {communities
                  .filter((c) =>
                    c.members.some((m) => m.personId === inspectedPerson.id && m.status === 'active'),
                  )
                  .map((c) => c.name)
                  .join(', ') || 'None visible.'}
              </p>
            </div>
          </div>
        ) : null}

        {inspectedCommunity ? (
          <div className="stack-tight">
            <p>{inspectedCommunity.description}</p>
            <dl className="detail-list">
              <div>
                <dt>Purpose</dt>
                <dd>{inspectedCommunity.purpose.replace('-', ' ')}</dd>
              </div>
              <div>
                <dt>Locality</dt>
                <dd>{inspectedCommunity.locality}</dd>
              </div>
              <div>
                <dt>Your role</dt>
                <dd>
                  {inspectedCommunity.members.find((m) => m.personId === actorId)?.role ?? 'Not a member'}
                </dd>
              </div>
              <div>
                <dt>Directory</dt>
                <dd>
                  {visibleDirectory(data, actorId, inspectedCommunity).length} members listed ·
                  opt-in only
                </dd>
              </div>
            </dl>
            {data.groupAgreements
              .filter((g) => g.communityId === inspectedCommunity.id)
              .map((agreement) => {
                const status = groupAgreementStatus(agreement);
                const counts = groupAgreementCounts(agreement);
                return (
                  <div className="agreement-mini" key={agreement.id}>
                    <Badge
                      tone={
                        status === 'active' ? 'success' : status === 'declined' ? 'danger' : 'warning'
                      }
                    >
                      {status}
                    </Badge>
                    <span>{agreement.title}</span>
                    <span className="muted tiny">
                      {counts.accepted}/{counts.required} accepted
                    </span>
                  </div>
                );
              })}
            <Link className="btn btn-primary btn-md" to={`communities/${inspectedCommunity.id}`}>
              Open community <Icon name="arrowRight" size={16} />
            </Link>
          </div>
        ) : null}

        {inspectedProject ? (
          <div className="stack-tight">
            <p>{inspectedProject.summary}</p>
            <dl className="detail-list">
              <div>
                <dt>Community</dt>
                <dd>{personName(data, inspectedProject.leadId)} leads · {inspectedProject.status}</dd>
              </div>
              <div>
                <dt>Tasks</dt>
                <dd>
                  {inspectedProject.tasks.filter((t) => t.status === 'done').length}/
                  {inspectedProject.tasks.length} done
                </dd>
              </div>
            </dl>
            <Button onClick={() => navigate(`projects/${inspectedProject.id}`)}>Open project</Button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function InvitePreview({ personId }: { personId: string }) {
  const { snapshot } = useApp();
  const person = snapshot.data.people.find((p) => p.id === personId);
  if (!person) return null;
  return (
    <div className="invite-preview">
      <Avatar name={person.name} />
      <div>
        <strong>
          {person.name} <span className="muted small">{person.handle}</span>
        </strong>
        <p className="muted small">{person.bio}</p>
        <p className="muted tiny">
          {person.locality} · key fingerprint {person.keyFingerprint}
        </p>
      </div>
    </div>
  );
}

function Walkthrough({
  onReview,
  onInspect,
}: {
  onReview: (id: string) => void;
  onInspect: (id: string) => void;
}) {
  const { snapshot } = useApp();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const active = data.relationships.filter(
    (r) => r.status === 'active' && (r.aId === actorId || r.bId === actorId),
  );
  const pending = data.relationships.filter(
    (r) => r.status === 'pending' && (r.aId === actorId || r.bId === actorId),
  );
  const revoked = data.relationships.filter(
    (r) => r.status === 'revoked' && (r.aId === actorId || r.bId === actorId),
  );
  const communities = myCommunities(data, actorId);
  const agreements = data.groupAgreements.filter((g) =>
    communities.some((c) => c.id === g.communityId),
  );
  const declinedGroup = agreements.find((g) => groupAgreementStatus(g) === 'declined');
  const activeGroup = agreements.find((g) => groupAgreementStatus(g) === 'active');
  const firstActive = active[0];
  const firstActiveOther = firstActive
    ? data.people.find((p) => p.id === (firstActive.aId === actorId ? firstActive.bId : firstActive.aId))
    : undefined;
  const sharedCount = firstActiveOther ? knowledgeSharedBy(data, actorId, firstActiveOther.id).length : 0;
  const privateCount = data.knowledge.filter(
    (k) => k.authorId === actorId && k.scope === 'private',
  ).length;
  const groupKnowledge = declinedGroup
    ? data.knowledge.filter(
        (k) => k.communityId === declinedGroup.communityId && k.scope === 'community',
      )
    : [];
  const blockedGroup = groupKnowledge.filter((k) => k.authorId !== actorId && !canRead(data, actorId, k));

  const steps = [
    {
      done: active.length > 0,
      title: 'A bilateral relationship is active',
      body: firstActiveOther
        ? `${firstActiveOther.name} and you explicitly accepted. ${sharedCount} of their relationship-shared records are readable now.`
        : 'Accept a pending invitation to create an active relationship.',
      action:
        firstActiveOther && firstActive
          ? { label: 'Inspect connection', run: () => onInspect(firstActiveOther.id) }
          : pending[0]
            ? { label: 'Review invitation', run: () => onReview(pending[0].id) }
            : undefined,
    },
    {
      done: sharedCount > 0,
      title: 'Shared knowledge crosses the relationship',
      body: firstActiveOther
        ? sharedCount > 0
          ? `Everything ${firstActiveOther.name} marked relationship-shared is available, and vice versa. Nothing partial, nothing extra.`
          : `${firstActiveOther.name} has not marked any records relationship-shared yet. Try another connection.`
        : 'An active relationship is needed first.',
      action: firstActiveOther
        ? { label: 'Open shared knowledge', run: () => navigate('knowledge') }
        : undefined,
    },
    {
      done: privateCount > 0,
      title: 'Private knowledge stays private',
      body: `You have ${privateCount} private record${privateCount === 1 ? '' : 's'}. Relationship access never includes them, no matter how many connections are active.`,
    },
    {
      done: Boolean(activeGroup),
      title: 'Group sharing needs unanimity',
      body: activeGroup
        ? `“${activeGroup.title}” is active because every named participant accepted. Community membership alone would not have been enough.`
        : 'No active group agreement in your communities yet. A single decline keeps a proposal inactive.',
      action: communities[0]
        ? {
            label: 'Open group agreements',
            run: () => navigate(`communities/${activeGroup?.communityId ?? communities[0].id}`),
          }
        : undefined,
    },
    {
      done: Boolean(declinedGroup),
      title: 'One decline keeps the group relationship inactive',
      body: declinedGroup
        ? `“${declinedGroup.title}” was declined by ${
            personName(data, declinedGroup.responses.find((r) => r.state === 'declined')?.personId)
          }. ${blockedGroup.length} group-shared record${blockedGroup.length === 1 ? '' : 's'} in that community remain unreadable through this path.`
        : pending.length > 0
          ? 'A pending invitation grants no access; try declining it to see the state recorded.'
          : 'No declined group agreement in your current communities.',
    },
    {
      done: revoked.length > 0,
      title: 'Revocation blocks future access',
      body: revoked.length > 0
        ? `You have ${revoked.length} revoked relationship${revoked.length === 1 ? '' : 's'}. Knowledge shared through it is no longer readable here. Copies kept elsewhere cannot be recalled.`
        : 'Revoke an active relationship to test this. Access ends immediately; the audit event holds no private content.',
    },
  ];

  return (
    <div className="stack-tight">
      <Notice tone="quiet" icon="sparkles" title="The consent model, demonstrated with live data">
        This walkthrough reads your own node state. Switch acting identity in Node settings to see
        the same rules from another participant’s view.
      </Notice>
      <ol className="walkthrough">
        {steps.map((step, index) => (
          <li key={step.title} className={step.done ? 'is-done' : ''}>
            <span className="walkthrough-marker">
              {step.done ? <Icon name="check" size={16} /> : <span>{index + 1}</span>}
            </span>
            <div>
              <h4>{step.title}</h4>
              <p>{step.body}</p>
              {step.action ? (
                <button type="button" className="text-button" onClick={step.action.run}>
                  {step.action.label} <Icon name="arrowRight" size={14} />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <Notice tone="warn" title="Prototype boundary">
        These are simulated identities on a local browser node. Consent state is enforced in the
        local service layer and covered by tests, but there is no authenticated remote peer,
        transport encryption or secure key exchange yet.
      </Notice>
    </div>
  );
}
