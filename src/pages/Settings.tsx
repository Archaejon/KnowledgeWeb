import { useRef, useState } from 'react';
import {
  personName,
  scopeDescription,
  visibleConsentEvents,
  visibleKnowledge,
} from '../core/access';
import { OllamaAdapter } from '../core/ai/ollama';
import { groupAgreementStatus, relationshipFor } from '../core/consent';
import { formatDate, formatDateTime, relativeTime } from '../core/dates';
import { myCommunities } from '../core/selectors';
import { isSafeHttpUrl, validatePersistedState } from '../core/validation';
import type { Scope } from '../core/types';
import { Link } from '../router';
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
  Field,
  FormError,
  Notice,
  PageHeader,
  ScopeBadge,
  Tabs,
} from '../components/ui';

type SettingsTab = 'identity' | 'consent' | 'storage' | 'network' | 'ai';

export function SettingsPage() {
  const { store, snapshot } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const actor = data.people.find((p) => p.id === settings.actorId);
  const [tab, setTab] = useState<SettingsTab>('identity');
  const [resetSampleOpen, setResetSampleOpen] = useState(false);
  const [resetEmptyOpen, setResetEmptyOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    raw: string;
    people: number;
    communities: number;
    knowledge: number;
    actorName: string;
  } | null>(null);
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [showAllLog, setShowAllLog] = useState(false);

  const communities = myCommunities(data, settings.actorId);
  const actorRelationships = data.relationships.filter(
    (r) => r.aId === settings.actorId || r.bId === settings.actorId,
  );
  const currentRelationships = actorRelationships.filter((relationship) => {
    const otherId =
      relationship.aId === settings.actorId ? relationship.bId : relationship.aId;
    return relationshipFor(data, settings.actorId, otherId)?.id === relationship.id;
  });
  const activeCount = currentRelationships.filter((r) => r.status === 'active').length;
  const pendingCount = currentRelationships.filter((r) => r.status === 'pending').length;
  const consentEvents = visibleConsentEvents(data, settings.actorId);
  const groupAgreements = data.groupAgreements.filter((g) =>
    communities.some((c) => c.id === g.communityId),
  );
  const readable = visibleKnowledge(data, settings.actorId).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  const readableKnowledgeMarkdown = () =>
    [
      `# Readable knowledge export — ${actor?.name ?? 'Unknown'}`,
      '',
      `Exported ${formatDateTime(new Date().toISOString())} from a local Understory node.`,
      `${readable.length} records the acting identity is authorised to read. Includes private records owned by the acting identity. Handle this file accordingly.`,
      '',
      ...readable.flatMap((record) => [
        `## ${record.title}`,
        '',
        `- Type: ${record.kind}`,
        `- Author: ${personName(data, record.authorId)}`,
        `- Scope: ${record.scope}`,
        `- Created: ${formatDate(record.createdAt)}`,
        `- Updated: ${formatDate(record.updatedAt)}`,
        record.tags.length ? `- Tags: ${record.tags.join(', ')}` : '',
        '',
        record.body,
        '',
        record.sources.length ? `Sources: ${record.sources.join('; ')}` : '',
        '',
      ]),
    ]
      .filter(Boolean)
      .join('\n');

  const handleImportFile = async (file: File | undefined) => {
    setImportError('');
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setImportError('Backup is larger than 8 MB. This prototype stores data in browser storage and cannot reliably import it.');
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const validation = validatePersistedState(parsed);
      if (!validation.ok) {
        setImportError(`Backup rejected: ${validation.errors.join(' ')}`);
        return;
      }
      const state = parsed as {
        settings: { actorId: string };
        data: { people: { id: string; name: string }[]; communities: unknown[]; knowledge: unknown[] };
      };
      const importActor = state.data.people.find((p) => p.id === state.settings.actorId);
      setPendingImport({
        raw: text,
        people: state.data.people.length,
        communities: state.data.communities.length,
        knowledge: state.data.knowledge.length,
        actorName: importActor?.name ?? 'Unknown',
      });
    } catch {
      setImportError('That file could not be read as JSON.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Local node"
        title="Node settings"
        lede="This browser holds the whole node: identity, relationships, communities and knowledge. Nothing is sent to a hosted service."
        actions={
          <DownloadButton filename={`understory-backup-${new Date().toISOString().slice(0, 10)}.json`} content={store.exportBackup()} mime="application/json">
            Export backup
          </DownloadButton>
        }
      />

      <Tabs
        label="Settings sections"
        value={tab}
        onChange={(value) => setTab(value as SettingsTab)}
        options={[
          { value: 'identity', label: 'Identity' },
          { value: 'consent', label: 'Consent' },
          { value: 'storage', label: 'Storage & backup' },
          { value: 'network', label: 'Networking' },
          { value: 'ai', label: 'Optional AI' },
        ]}
      />

      {importError ? <FormError>{importError}</FormError> : null}

      {tab === 'identity' ? (
        <div className="two-col settings-layout">
          <div className="stack">
            <Card>
              <CardHeader
                icon="key"
                title="Demo identity switch"
                subtitle="Prototype only: choose which participant is acting. This is not authentication and does not protect against someone using the same browser."
              />
              <Field
                label="Acting as"
                htmlFor="acting-identity"
                hint="Switch to see exactly what another participant can read and do. Access checks are re-evaluated with this identity."
              >
                <select
                  id="acting-identity"
                  className="select"
                  value={settings.actorId}
                  onChange={(event) => {
                    try {
                      store.setActor(event.target.value);
                      toast(
                        `Now acting as ${data.people.find((p) => p.id === event.target.value)?.name ?? 'participant'}.`,
                        'info',
                      );
                    } catch (err) {
                      toast(err instanceof Error ? err.message : 'Could not switch identity.', 'error');
                    }
                  }}
                >
                  {data.people.filter((person) => !person.remote).map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} {person.directoryOptIn ? '' : '· directory opt-out'}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="identity-strip">
                <Avatar name={actor?.name ?? 'You'} />
                <div>
                  <strong>{actor?.name}</strong>
                  <div className="muted tiny">
                    {actor?.handle} · node {actor?.nodeLabel}
                  </div>
                  <div className="muted tiny">
                    <Icon name="key" size={12} /> {actor?.keyFingerprint}
                  </div>
                </div>
              </div>
              <Notice tone="warn" icon="shield" title="Simulated identity, not a security boundary">
                There is no login, password, cryptographic key or remote authentication here. Anyone
                with access to this browser profile can read this local node’s storage. Real peer
                authentication is listed under Networking as unimplemented.
              </Notice>
            </Card>

            {actor ? <ProfileForm key={actor.id} /> : null}
            <NodeNameForm />
          </div>

          <div className="stack">
            <Card>
              <CardHeader icon="info" title="What this node is" />
              <dl className="detail-list">
                <div>
                  <dt>Node name</dt>
                  <dd>{data.node.name}</dd>
                </div>
                <div>
                  <dt>Node id</dt>
                  <dd className="mono tiny">{data.node.id}</dd>
                </div>
                <div>
                  <dt>Software</dt>
                  <dd>v{data.node.softwareVersion} · schema {data.schemaVersion}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(data.node.createdAt)}</dd>
                </div>
                <div>
                  <dt>Prototype</dt>
                  <dd>{data.node.prototype ? 'Yes · not production security' : 'No'}</dd>
                </div>
              </dl>
              <p className="muted small">
                Node ownership, community membership, bilateral relationships, group agreements,
                inter-community agreements and software governance are separate things. None silently
                overrides an individual’s refusal to share.
              </p>
            </Card>

            <Card>
              <CardHeader icon="community" title="Governance boundaries" />
              <ul className="principle-list">
                <li>
                  <strong>Node ownership</strong> — this local store and its backups belong to the
                  person operating the node.
                </li>
                <li>
                  <strong>Community membership</strong> — belonging to a shared space, never a
                  blanket grant of access to others’ knowledge.
                </li>
                <li>
                  <strong>Bilateral relationship</strong> — explicit, reciprocal, revocable access to
                  relationship-shared knowledge.
                </li>
                <li>
                  <strong>Group agreement</strong> — unanimous consent; one refusal keeps it inactive.
                </li>
                <li>
                  <strong>Inter-community agreement</strong> — an explicit, limited arrangement between
                  independent communities; not federation.
                </li>
                <li>
                  <strong>Software governance</strong> — separate from community governance. This
                  prototype is open source and inspectable.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'consent' ? (
        <div className="two-col settings-layout">
          <div className="stack">
            <Card>
              <CardHeader icon="shield" title="Consent state" subtitle="What is active for the acting identity right now." />
              <div className="metrics-grid">
                <div className="metric">
                  <span className="metric-value">{activeCount}</span>
                  <span className="metric-label">active relationships</span>
                </div>
                <div className="metric">
                  <span className="metric-value">{pendingCount}</span>
                  <span className="metric-label">pending invitations</span>
                </div>
                <div className="metric">
                  <span className="metric-value">
                    {groupAgreements.filter((g) => groupAgreementStatus(g) === 'active').length}
                  </span>
                  <span className="metric-label">active group agreements</span>
                </div>
                <div className="metric">
                  <span className="metric-value">{data.people.filter((p) => p.directoryOptIn).length}</span>
                  <span className="metric-label">directory opt-ins</span>
                </div>
              </div>
              <p className="muted small">
                Pending invitations grant nothing. Declining is recorded and leaves no access.
                Revoking an active relationship blocks future reads immediately.
              </p>
              <div className="row-actions">
                <Link className="btn btn-quiet btn-sm" to="network">
                  Manage connections
                </Link>
                <Link className="btn btn-quiet btn-sm" to="communities">
                  Group agreements
                </Link>
              </div>
            </Card>

            <Card>
              <CardHeader
                icon="clock"
                title="Consent audit"
                subtitle="Identity, time and decision only. Private content is deliberately absent."
              />
              {consentEvents.length === 0 ? (
                <p className="muted small">No consent events visible to you yet.</p>
              ) : (
                <ol className="audit-list">
                  {(showAllLog ? consentEvents : consentEvents.slice(0, 8)).map((event) => (
                    <li key={event.id}>
                      <span className={`audit-dot kind-${event.kind}`} aria-hidden="true" />
                      <div>
                        <div className="audit-head">
                          <strong>{event.kind.replaceAll('-', ' ')}</strong>
                          <span className="muted tiny">{formatDateTime(event.at)}</span>
                        </div>
                        <p>{event.detail}</p>
                        <span className="muted tiny">
                          Actor: {personName(data, event.actorId)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {consentEvents.length > 8 ? (
                <button type="button" className="text-button" onClick={() => setShowAllLog((v) => !v)}>
                  {showAllLog ? 'Show fewer' : `Show all ${consentEvents.length} events`}
                </button>
              ) : null}
              <p className="muted tiny">
                Events are filtered to your actor, subjects and active communities. The log stores no
                titles, bodies, locations or free-text notes.
              </p>
            </Card>
          </div>

          <div className="stack">
            <Card>
              <CardHeader icon="key" title="Sharing scopes" />
              <ul className="scope-explainer">
                {(
                  [
                    ['private', 'Private'],
                    ['relationship', 'Relationship-shared'],
                    ['community', 'Group-shared'],
                    ['public', 'Public'],
                  ] as [Scope, string][]
                ).map(([value, label]) => (
                  <li key={value}>
                    <ScopeBadge scope={value} />
                    <div>
                      <strong>{label}</strong>
                      <p>{scopeDescription(value, communities[0]?.name)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="muted small">
                Scope is decided by the record’s owner. There are no per-person permission levels
                inside a relationship or group agreement.
              </p>
            </Card>

            <Card>
              <CardHeader icon="community" title="Group agreement statuses" />
              {groupAgreements.length === 0 ? (
                <p className="muted small">No group agreements in your communities.</p>
              ) : (
                <ul className="agreement-status-list">
                  {groupAgreements.map((agreement) => {
                    const status = groupAgreementStatus(agreement);
                    return (
                      <li key={agreement.id}>
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
                          {status}
                        </Badge>
                        <span>
                          <strong>{agreement.title}</strong>
                          <small>
                            {communities.find((c) => c.id === agreement.communityId)?.name} ·{' '}
                            {agreement.responses.filter((r) => r.state === 'accepted').length}/
                            {agreement.responses.length} accepted
                          </small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader icon="info" title="Directory consent" />
              <p>
                Being a member never requires appearing in a directory. Each person opts in
                individually from their profile. A community may advertise that a directory exists,
                but names appear only by that person’s choice.
              </p>
              <p className="muted small">
                A community’s public description can be visible without a member list. This
                prototype never exposes an opt-out member’s name through the directory.
              </p>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'storage' ? (
        <div className="two-col settings-layout">
          <div className="stack">
            <Card>
              <CardHeader icon="database" title="Where the data lives" />
              <dl className="detail-list">
                <div>
                  <dt>Adapter</dt>
                  <dd>{snapshot.storageError ? 'Memory (persist failed)' : store.storageKind}</dd>
                </div>
                <div>
                  <dt>Key</dt>
                  <dd className="mono tiny">understory.node.v1</dd>
                </div>
                <div>
                  <dt>Last saved</dt>
                  <dd>{snapshot.lastSavedAt ? relativeTime(snapshot.lastSavedAt) : 'Not yet saved'}</dd>
                </div>
                <div>
                  <dt>Schema</dt>
                  <dd>v{data.schemaVersion}</dd>
                </div>
              </dl>
              <Notice tone="warn" icon="alert" title="Not encrypted at rest">
                Browser storage is readable by anyone with access to this browser profile and by
                extensions or scripts you allow. Do not use this prototype for high-risk personal
                data. Encryption at rest and authenticated multi-device sync are not implemented.
              </Notice>
              {snapshot.storageError ? (
                <Notice tone="danger" icon="alert" title="Saving failed">
                  {snapshot.storageError} Export a backup now; changes are only in memory.
                </Notice>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                icon="download"
                title="Export and backup"
                subtitle="A full backup contains every record, including private knowledge. Treat the file as sensitive."
              />
              <div className="backup-actions">
                <DownloadButton
                  filename={`understory-backup-${new Date().toISOString().slice(0, 10)}.json`}
                  content={store.exportBackup()}
                  mime="application/json"
                  variant="primary"
                >
                  Full node backup (.json)
                </DownloadButton>
                <DownloadButton
                  filename={`understory-readable-knowledge-${new Date().toISOString().slice(0, 10)}.md`}
                  content={readableKnowledgeMarkdown()}
                  mime="text/markdown"
                >
                  Readable knowledge (.md)
                </DownloadButton>
              </div>
              <p className="muted small">
                Backups are versioned plain JSON. The knowledge export includes only records the
                acting identity can read, and may include private records you own.
              </p>
            </Card>

            <Card>
              <CardHeader icon="upload" title="Restore from a backup" />
              <p className="muted small">
                Importing replaces this node’s current data and settings. The file is validated
                before anything is replaced; malformed files are rejected.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="file-input"
                onChange={(event) => handleImportFile(event.target.files?.[0])}
                aria-label="Choose a node backup file"
              />
              <Button icon="upload" onClick={() => fileRef.current?.click()}>
                Choose backup file
              </Button>
              {pendingImport ? (
                <Notice tone="warn" icon="alert" title="Ready to replace this node">
                  Valid backup: {pendingImport.people} people, {pendingImport.communities}{' '}
                  communities, {pendingImport.knowledge} knowledge records. Acting identity becomes{' '}
                  {pendingImport.actorName}. This cannot be undone except by restoring another
                  backup.
                </Notice>
              ) : null}
            </Card>
          </div>

          <div className="stack">
            <Card>
              <CardHeader icon="refresh" title="Reset" />
              <p className="muted small">
                Start over with the fictional demonstration scenario, or a clean node with one local
                identity. Both actions replace current data; export a backup first if it matters.
              </p>
              <div className="row-actions">
                <Button icon="refresh" onClick={() => setResetSampleOpen(true)}>
                  Reset sample data
                </Button>
                <Button variant="ghost" icon="trash" onClick={() => setResetEmptyOpen(true)}>
                  Start an empty node
                </Button>
              </div>
            </Card>
            <Card>
              <CardHeader icon="book" title="Recovery notes" />
              <ul className="principle-list">
                <li>Full backups are self-contained: data, settings and schema version.</li>
                <li>Backups restore identity, memberships, consent state and audit events.</li>
                <li>No automatic cloud backup exists. Copy backups to media you control.</li>
                <li>
                  If browser storage is cleared, the node is gone unless a backup exists. That is a
                  real limitation of this local-first prototype.
                </li>
              </ul>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'network' ? (
        <div className="stack">
          <Notice tone="warn" icon="wifiOff" title="No transport is active">
            This node is a local browser application. It does not connect to other nodes, exchange
            consent requests automatically, or synchronise data. Simulated participants all live in
            the same local store. Nothing on this page is a live peer connection.
          </Notice>

          <Card>
            <CardHeader icon="network" title="Implementation status" subtitle="Honest labels: implemented, prototype, or not implemented." />
            <div className="table-wrap">
              <table className="table capability-table">
                <thead>
                  <tr>
                    <th scope="col">Capability</th>
                    <th scope="col">Status</th>
                    <th scope="col">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Local persistence', 'Implemented', 'Browser localStorage behind a replaceable adapter.'],
                    ['Versioned backup / restore', 'Implemented', 'Plain JSON validated before import.'],
                    ['Access enforcement', 'Implemented locally', 'Single access engine used by lists, search, charts, exports and AI retrieval. Tested.'],
                    ['Consent audit', 'Implemented locally', 'Events without private content. No cryptographic signatures.'],
                    ['Authenticated remote peers', 'Not implemented', 'No login or peer identity verification.'],
                    ['Encrypted transport', 'Not implemented', 'No TLS or Noise session between nodes; there are no nodes.'],
                    ['Encrypted local storage', 'Not implemented', 'Browser storage is plaintext.'],
                    ['Peer-to-peer sync', 'Not implemented', 'No transport adapter or sync protocol is wired in.'],
                    ['Offline queue / store-and-forward', 'Not implemented', 'Design boundary documented; no relay exists.'],
                    ['Federation / API', 'Not implemented', 'Inter-community agreements are local governance records only.'],
                    ['Local network discovery', 'Not implemented', 'No mDNS, radio or alternative transport.'],
                  ].map(([capability, status, notes]) => (
                    <tr key={capability}>
                      <td>
                        <strong>{capability}</strong>
                      </td>
                      <td>
                        <Badge tone={status === 'Implemented' || status === 'Implemented locally' ? 'success' : 'warning'}>
                          {status}
                        </Badge>
                      </td>
                      <td className="muted small">{notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="two-col">
            <Card>
              <CardHeader icon="database" title="Architecture boundary" />
              <p>
                Storage sits behind <code>StorageAdapter</code>. Consent and access sit in
                <code> core/access.ts</code> and <code>core/consent.ts</code>, independent of React.
                Node mutations go through <code>NodeStore</code>. A future transport or daemon can
                reuse those modules without changing the interface.
              </p>
              <p className="muted small">
                Known gaps for a real node: authenticated peer identity, end-to-end encryption,
                replay protection, signed consent records, transport adapters, conflict resolution,
                a server-side access-check boundary, and key rotation/recovery.
              </p>
            </Card>
            <Card>
              <CardHeader icon="info" title="What a future node would add" />
              <ul className="principle-list">
                <li>A local daemon or server that owns the data and enforces access remotely.</li>
                <li>Authenticated peer channels with signed consent events.</li>
                <li>Queued updates and sync after reconnection, with explicit conflict policy.</li>
                <li>Store-and-forward relays and optional local network discovery.</li>
                <li>Versioned API/schema contracts for independently built nodes.</li>
              </ul>
              <Link className="text-link" to="about">
                Read full limitations <Icon name="arrowRight" size={14} />
              </Link>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'ai' ? <AiSettingsPanel /> : null}

      <ConfirmDialog
        open={resetSampleOpen}
        onClose={() => setResetSampleOpen(false)}
        onConfirm={() => {
          try {
            store.resetSampleData();
            setTab('identity');
            toast('Sample node restored. All local changes were replaced.', 'info');
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Could not reset sample data.', 'error');
          }
        }}
        title="Reset to fictional sample data?"
        confirmLabel="Reset sample data"
        tone="danger"
      >
        <p>
          This replaces every person, community, relationship, knowledge record, observation, project
          and gathering on this node with the demonstration scenario.
        </p>
        <p className="muted small">
          The selected theme and AI settings are kept. Local changes are lost. Export a backup first
          if you need them.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={resetEmptyOpen}
        onClose={() => setResetEmptyOpen(false)}
        onConfirm={() => {
          try {
            store.resetToEmptyNode();
            setTab('identity');
            toast('Empty node created. You are the only identity.', 'info');
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Could not create a new node.', 'error');
          }
        }}
        title="Start an empty node?"
        confirmLabel="Start empty node"
        tone="danger"
      >
        <p>
          This removes all current sample and local data. The new node has one local identity
          (“You”), no communities and no relationships.
        </p>
        <p className="muted small">Theme and AI configuration are kept. Export a backup first.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(pendingImport)}
        onClose={() => setPendingImport(null)}
        onConfirm={() => {
          if (!pendingImport) return;
          try {
            const counts = store.importBackup(pendingImport.raw);
            toast(
              `Backup restored: ${counts.people} people, ${counts.communities} communities, ${counts.knowledge} records.`,
            );
            setPendingImport(null);
          } catch (err) {
            setImportError(err instanceof Error ? err.message : 'Could not import the backup.');
            setPendingImport(null);
          }
        }}
        title="Replace this node with the backup?"
        confirmLabel="Replace node"
        tone="danger"
      >
        <p>
          The backup will replace all current data and settings, including consent state and audit
          events. This cannot be undone from inside the app.
        </p>
        <p className="muted small">A backup of the backup is your responsibility. Export the current node first if both matter.</p>
      </ConfirmDialog>
    </div>
  );
}

function ProfileForm() {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const actor = snapshot.data.people.find((p) => p.id === snapshot.settings.actorId);
  const [form, setForm] = useState({
    name: actor?.name ?? '',
    handle: actor?.handle ?? '',
    pronouns: actor?.pronouns ?? '',
    locality: actor?.locality ?? '',
    bio: actor?.bio ?? '',
    skills: actor?.skills.join(', ') ?? '',
    directoryOptIn: actor?.directoryOptIn ?? false,
  });
  const [error, setError] = useState('');
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    setError('');
    try {
      store.updateProfile({
        name: form.name,
        handle: form.handle,
        pronouns: form.pronouns,
        locality: form.locality,
        bio: form.bio,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        directoryOptIn: form.directoryOptIn,
      });
      toast('Profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the profile.');
    }
  };

  return (
    <Card>
      <CardHeader
        icon="edit"
        title="Your profile on this node"
        subtitle="This is information other participants may see through shared communities, subject to directory consent."
      />
      <div className="form-grid">
        {error ? <FormError>{error}</FormError> : null}
        <div className="form-row">
          <Field label="Name" htmlFor="profile-name" required>
            <input
              id="profile-name"
              className="input"
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
            />
          </Field>
          <Field label="Handle" htmlFor="profile-handle">
            <input
              id="profile-handle"
              className="input"
              value={form.handle}
              onChange={(event) => set('handle', event.target.value)}
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Pronouns" htmlFor="profile-pronouns">
            <input
              id="profile-pronouns"
              className="input"
              value={form.pronouns}
              onChange={(event) => set('pronouns', event.target.value)}
            />
          </Field>
          <Field label="Locality" htmlFor="profile-locality">
            <input
              id="profile-locality"
              className="input"
              value={form.locality}
              onChange={(event) => set('locality', event.target.value)}
            />
          </Field>
        </div>
        <Field label="About" htmlFor="profile-bio">
          <textarea
            id="profile-bio"
            className="textarea"
            rows={3}
            value={form.bio}
            onChange={(event) => set('bio', event.target.value)}
          />
        </Field>
        <Field label="Skills / practical knowledge" htmlFor="profile-skills" hint="Comma separated.">
          <input
            id="profile-skills"
            className="input"
            value={form.skills}
            onChange={(event) => set('skills', event.target.value)}
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={form.directoryOptIn}
            onChange={(event) => set('directoryOptIn', event.target.checked)}
          />
          <span>
            Show my name in member directories of my communities. You can change this at any time;
            opting out hides you from directory views.
          </span>
        </label>
        <Button variant="primary" icon="check" onClick={save}>
          Save profile
        </Button>
      </div>
    </Card>
  );
}

function NodeNameForm() {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const [name, setName] = useState(snapshot.data.node.name);

  return (
    <Card>
      <CardHeader icon="database" title="Node name" subtitle="A human label for this local node. It is not a network address." />
      <div className="inline-form">
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Node name"
        />
        <Button
          variant="primary"
          onClick={() => {
            try {
              store.updateNodeIdentity(name);
              toast('Node name updated.');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Could not rename the node.', 'error');
            }
          }}
        >
          Save
        </Button>
      </div>
    </Card>
  );
}

function AiSettingsPanel() {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const ai = snapshot.settings.ai;
  const [form, setForm] = useState({
    enabled: ai.enabled,
    endpoint: ai.endpoint,
    model: ai.model,
    timeoutMs: String(ai.timeoutMs),
    transcriptionEndpoint: ai.transcriptionEndpoint ?? '',
    transcriptionModel: ai.transcriptionModel ?? '',
  });
  const [error, setError] = useState('');
  const [probeState, setProbeState] = useState<'idle' | 'running' | 'ok' | 'error'>('idle');
  const [probeDetail, setProbeDetail] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const probeController = useRef<AbortController | null>(null);

  const save = () => {
    setError('');
    try {
      if (!form.endpoint.trim()) throw new Error('Enter an Ollama endpoint.');
      if (!isSafeHttpUrl(form.endpoint)) throw new Error('The endpoint must be a valid http or https URL.');
      if (!form.model.trim()) throw new Error('Enter a model name.');
      const timeout = Number(form.timeoutMs);
      if (!Number.isFinite(timeout) || timeout < 3000 || timeout > 120000) {
        throw new Error('Timeout must be between 3 and 120 seconds.');
      }
      const transcriptionEndpoint = form.transcriptionEndpoint.trim();
      const transcriptionModel = form.transcriptionModel.trim();
      if (transcriptionEndpoint && !isSafeHttpUrl(transcriptionEndpoint)) {
        throw new Error('The speech-to-text endpoint must be a valid http or https URL.');
      }
      if (transcriptionEndpoint && !transcriptionModel) {
        throw new Error('Enter the model name your speech service expects.');
      }
      if (!transcriptionEndpoint && transcriptionModel) {
        throw new Error('Enter the speech-to-text endpoint that serves that model.');
      }
      store.updateAi({
        enabled: form.enabled,
        provider: form.enabled ? 'ollama' : 'none',
        endpoint: form.endpoint.trim(),
        model: form.model.trim(),
        timeoutMs: timeout,
        transcriptionEndpoint,
        transcriptionModel,
      });
      toast('AI settings saved locally.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save AI settings.');
    }
  };

  const probe = async () => {
    setProbeState('running');
    setProbeDetail('');
    setModels([]);
    const controller = new AbortController();
    probeController.current = controller;
    try {
      const adapter = new OllamaAdapter(form.endpoint, form.model);
      const result = await adapter.probe({
        signal: controller.signal,
        timeoutMs: Number(form.timeoutMs) || 8000,
      });
      setProbeState(result.ok ? 'ok' : 'error');
      setProbeDetail(result.detail);
      setModels(result.models);
    } finally {
      probeController.current = null;
    }
  };

  return (
    <div className="two-col settings-layout">
      <div className="stack">
        <Card>
          <CardHeader
            icon="sparkles"
            title="Optional local AI"
            subtitle="Off by default. Community and knowledge tools work fully without it."
          />
          <div className="form-grid">
            {error ? <FormError>{error}</FormError> : null}
            <label className="check">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, enabled: event.target.checked }))
                }
              />
              <span>Enable the optional AI assistant</span>
            </label>
            <div className="form-row">
              <Field label="Provider" htmlFor="ai-provider">
                <select id="ai-provider" className="select" value="ollama" disabled>
                  <option value="ollama">Ollama (local HTTP API)</option>
                </select>
              </Field>
              <Field label="Timeout (ms)" htmlFor="ai-timeout">
                <input
                  id="ai-timeout"
                  className="input"
                  type="number"
                  min={3000}
                  max={120000}
                  step={1000}
                  value={form.timeoutMs}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, timeoutMs: event.target.value }))
                  }
                />
              </Field>
            </div>
            <Field
              label="Endpoint"
              htmlFor="ai-endpoint"
              hint="Default Ollama location. The browser talks to it directly; no API key is stored."
            >
              <input
                id="ai-endpoint"
                className="input"
                value={form.endpoint}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, endpoint: event.target.value }))
                }
                placeholder="http://127.0.0.1:11434"
              />
            </Field>
            <Field
              label="Model"
              htmlFor="ai-model"
              hint="A model you have already installed. This app never downloads models."
            >
              <input
                id="ai-model"
                className="input"
                value={form.model}
                onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                placeholder="llama3.2:3b"
              />
            </Field>
            <div className="form-subsection">
              <div className="field-inline-label">Speech-to-text (optional)</div>
              <p className="field-hint">
                Voice notes on knowledge records can be transcribed by a local, Whisper-compatible
                service. Leave these fields empty to keep transcription unavailable. Audio is sent
                only to the endpoint you enter, and only when the author presses Transcribe.
              </p>
            </div>
            <div className="form-row">
              <Field
                label="Transcription endpoint"
                htmlFor="ai-transcription-endpoint"
                hint="Full URL of the OpenAI-compatible audio route, for example http://127.0.0.1:8080/v1/audio/transcriptions."
              >
                <input
                  id="ai-transcription-endpoint"
                  className="input"
                  value={form.transcriptionEndpoint}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, transcriptionEndpoint: event.target.value }))
                  }
                  placeholder="http://127.0.0.1:8080/v1/audio/transcriptions"
                />
              </Field>
              <Field
                label="Transcription model"
                htmlFor="ai-transcription-model"
                hint="The model id the service expects, e.g. whisper-1 or ggml-small."
              >
                <input
                  id="ai-transcription-model"
                  className="input"
                  value={form.transcriptionModel}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, transcriptionModel: event.target.value }))
                  }
                  placeholder="whisper-1"
                />
              </Field>
            </div>
            <Notice tone="quiet" icon="mic">
              Recordings stay inside their knowledge record until an author explicitly transcribes
              one. A self-hosted service keeps the audio on your machine; a remote endpoint would
              not, so treat any non-local URL as sharing the recording with that provider.
            </Notice>
            <div className="row-actions">
              <Button variant="primary" icon="check" onClick={save}>
                Save AI settings
              </Button>
              <Button icon="network" onClick={probe} disabled={probeState === 'running'}>
                {probeState === 'running' ? 'Checking…' : 'Test endpoint'}
              </Button>
              {probeState === 'running' ? (
                <Button
                  variant="ghost"
                  icon="x"
                  onClick={() => {
                    probeController.current?.abort();
                    setProbeState('idle');
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
            {probeState === 'ok' ? (
              <Notice tone="success" icon="check" title="Endpoint reachable">
                {probeDetail}
                {models.length > 0 ? (
                  <div className="model-list">
                    {models.map((model) => (
                      <button
                        type="button"
                        key={model}
                        className="chip chip-button"
                        onClick={() => setForm((prev) => ({ ...prev, model }))}
                      >
                        Use {model}
                      </button>
                    ))}
                  </div>
                ) : null}
              </Notice>
            ) : null}
            {probeState === 'error' ? (
              <Notice tone="danger" icon="alert" title="Endpoint unavailable">
                {probeDetail} If Ollama is running, check that its OLLAMA_ORIGINS setting allows this
                browser origin. This app does not bypass browser security.
              </Notice>
            ) : null}
            <Notice tone="quiet" icon="shield" title="What the model receives">
              When you ask a question, only records you are authorised to read are selected into the
              prompt. Access is checked before retrieval and citations link back to records. The model
              cannot request other records or write to the node. No conversation is stored by this
              app.
            </Notice>
          </div>
        </Card>
      </div>

      <div className="stack">
        <Card>
          <CardHeader icon="info" title="Why AI is separate" />
          <ul className="principle-list">
            <li>Basic community and knowledge functions never depend on a model.</li>
            <li>The adapter interface is provider-neutral; Ollama is one local runtime.</li>
            <li>Calls are asynchronous with cancellation, timeouts and a graceful fallback.</li>
            <li>No automatic model download; no paid API is required.</li>
            <li>AI answers are advisory. Provenance lives in the cited records.</li>
          </ul>
        </Card>
        <Card>
          <CardHeader icon="alert" title="Current limits" />
          <p className="muted small">
            Only Ollama is implemented. There is no local embedding index, conversation history,
            multi-node synthesis or semantic retrieval yet; the adapter sends a keyword-ranked excerpt
            of authorised records. A production system would need stronger prompt-injection and data
            exfiltration controls, especially for untrusted document content.
          </p>
        </Card>
      </div>
    </div>
  );
}

