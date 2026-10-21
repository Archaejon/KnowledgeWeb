import { useEffect, useRef, useState } from 'react';
import {
  accessFor,
  canRead,
  canViewCommunity,
  canViewGathering,
  canViewPlace,
  canViewProject,
  personName,
  scopeDescription,
  scopeLabel,
} from '../core/access';
import { OllamaAdapter } from '../core/ai/ollama';
import type { AiAnswer } from '../core/ai/adapter';
import { createTranscriber, transcriptionStatus } from '../core/ai/transcribe';
import {
  ATTACHMENT_LIMITS,
  attachmentBytes,
  attachmentLimitError,
  attachmentTypeLabel,
  attachmentsOf,
  fileToAttachment,
  formatBytes,
  formatDuration,
} from '../core/attachments';
import { groupAgreementStatus } from '../core/consent';
import { formatDate, formatDateTime, relativeTime } from '../core/dates';
import { KNOWLEDGE_KIND_LABELS, SCOPE_OPTIONS } from '../core/labels';
import { knowledgeTags, searchKnowledge } from '../core/search';
import type {
  KnowledgeAttachment,
  KnowledgeKind,
  KnowledgeLink,
  KnowledgeRecord,
  NodeData,
  Scope,
} from '../core/types';
import { myCommunities, myGatherings, myProjects } from '../core/selectors';
import { isSafeHttpUrl } from '../core/validation';
import { Link, navigate, useRoute } from '../router';
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
  Modal,
  Notice,
  PageHeader,
  ScopeBadge,
} from '../components/ui';
import { AccessExplanation } from '../components/ConsentDialog';
import { VoiceRecorder } from '../components/VoiceRecorder';

export function KnowledgePage({ knowledgeId }: { knowledgeId?: string }) {
  if (knowledgeId) return <KnowledgeDetail knowledgeId={knowledgeId} />;
  return <KnowledgeIndex />;
}

function excerpt(body: string, length = 170): string {
  const clean = body.replace(/\s+/g, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
}

export function linkedContext(data: NodeData, actorId: string, record: KnowledgeRecord) {
  const items: { label: string; to: string; icon: 'community' | 'project' | 'gathering' | 'place' }[] = [];
  const community = data.communities.find((c) => c.id === record.communityId);
  if (community && canViewCommunity(data, actorId, community)) {
    items.push({ label: community.name, to: `communities/${community.id}`, icon: 'community' });
  }
  const project = data.projects.find((p) => p.id === record.projectId);
  if (project && canViewProject(data, actorId, project)) {
    items.push({ label: project.title, to: `projects/${project.id}`, icon: 'project' });
  }
  const gathering = data.gatherings.find((g) => g.id === record.gatheringId);
  if (gathering && canViewGathering(data, actorId, gathering)) {
    items.push({ label: gathering.title, to: `gatherings/${gathering.id}`, icon: 'gathering' });
  }
  const place = data.places.find((p) => p.id === record.placeId);
  if (place && canViewPlace(data, actorId, place)) {
    items.push({ label: place.name, to: 'places', icon: 'place' });
  }
  return items;
}

function KnowledgeIndex() {
  const { snapshot } = useApp();
  const toast = useToast();
  const route = useRoute();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope | 'all'>('all');
  const [communityId, setCommunityId] = useState('all');
  const [kind, setKind] = useState<KnowledgeKind | 'all'>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(Boolean(route.query.compose || route.query.project || route.query.gathering));
  const [aiOpen, setAiOpen] = useState(false);
  const aiRef = useRef<AbortController | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiAnswer, setAiAnswer] = useState<AiAnswer | null>(null);

  const composeCommunity = route.query.compose ?? '';
  const composeScope = (route.query.scope as Scope | undefined) ?? 'private';
  const communities = myCommunities(data, actorId);
  const tags = knowledgeTags(data, actorId);
  const results = searchKnowledge(data, actorId, query, { scope, communityId, kind, tag });
  const ai = settings.ai;
  const hasFilters = Boolean(query || tag) || scope !== 'all' || communityId !== 'all' || kind !== 'all';

  useEffect(() => {
    return () => aiRef.current?.abort();
  }, []);

  const newRecord = () => {
    if (hasFilters) navigate('knowledge');
    setEditorOpen(true);
  };

  const runAi = async () => {
    if (!aiPrompt.trim()) return;
    setAiError('');
    setAiAnswer(null);
    setAiRunning(true);
    const controller = new AbortController();
    aiRef.current = controller;
    try {
      const adapter = new OllamaAdapter(ai.endpoint, ai.model);
      // Authorised corpus only. This is the enforcement point for AI retrieval.
      const corpus = searchKnowledge(data, actorId, '');
      const answer = await adapter.ask(aiPrompt.trim(), corpus, {
        signal: controller.signal,
        timeoutMs: ai.timeoutMs,
        authorName: (id) => personName(data, id),
      });
      setAiAnswer(answer);
      setAiRunning(false);
    } catch (error) {
      setAiRunning(false);
      const message = error instanceof Error ? error.message : 'The local model could not answer.';
      setAiError(message);
      toast(message, 'error');
    } finally {
      aiRef.current = null;
    }
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Knowledge commons"
        title="Knowledge"
        lede="Notes, guides, observations and records of what happened. Search only ever covers records your relationships and agreements allow you to read."
        actions={
          <Button variant="primary" icon="plus" onClick={newRecord}>
            New record
          </Button>
        }
      />

      <Card className="search-panel">
        <div className="search-row">
          <span className="search-icon">
            <Icon name="search" size={18} />
          </span>
          <input
            className="search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles, content, tags, sources and file names…"
            aria-label="Search authorised knowledge"
          />
          {query ? (
            <button type="button" className="icon-btn" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="x" size={16} />
            </button>
          ) : null}
        </div>
        <div className="search-filters">
          <label className="inline-field">
            <span>Scope</span>
            <select
              className="select select-sm"
              value={scope}
              onChange={(event) => setScope(event.target.value as Scope | 'all')}
            >
              <option value="all">Any scope</option>
              {SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {scopeLabel(option.value)}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>Community</span>
            <select
              className="select select-sm"
              value={communityId}
              onChange={(event) => setCommunityId(event.target.value)}
            >
              <option value="all">Any community</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>Type</span>
            <select
              className="select select-sm"
              value={kind}
              onChange={(event) => setKind(event.target.value as KnowledgeKind | 'all')}
            >
              <option value="all">Any type</option>
              {Object.entries(KNOWLEDGE_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {hasFilters ? (
            <Button
              size="sm"
              variant="ghost"
              icon="refresh"
              onClick={() => {
                setQuery('');
                setScope('all');
                setCommunityId('all');
                setKind('all');
                setTag(null);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        {tags.length > 0 ? (
          <div className="tag-filter-row" role="group" aria-label="Filter by tag">
            {tags.slice(0, 12).map((entry) => (
              <button
                type="button"
                key={entry.tag}
                className={`chip chip-button${tag === entry.tag ? ' is-active' : ''}`}
                onClick={() => setTag(tag === entry.tag ? null : entry.tag)}
              >
                {entry.tag}
                <span className="chip-count">{entry.count}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="search-result-meta">
          <span>
            <strong>{results.length}</strong> record{results.length === 1 ? '' : 's'} you may read
            {query ? ` matching “${query}”` : ''}
            {tag ? ` tagged ${tag}` : ''}
          </span>
          <span className="muted tiny">
            Private records of others are never included in search, counts or AI context.
          </span>
        </div>
      </Card>

      <Card className="ai-panel">
        <CardHeader
          icon="sparkles"
          title={
            <span>
              Optional local AI{' '}
              <Badge tone={ai.enabled ? 'accent' : 'neutral'}>
                {ai.enabled ? 'configured' : 'off'}
              </Badge>
            </span>
          }
          subtitle="A separate assistant that can read only the records you can read. Core knowledge and community features work without it."
          action={
            <Button size="sm" onClick={() => setAiOpen((v) => !v)} aria-expanded={aiOpen}>
              {aiOpen ? 'Hide assistant' : 'Open assistant'}
            </Button>
          }
        />
        {aiOpen ? (
          ai.enabled && ai.provider === 'ollama' ? (
            <div className="stack-tight">
              <p className="muted small">
                Uses <strong>{ai.model}</strong> at <code>{ai.endpoint}</code>. No model is loaded or
                downloaded automatically. The selected local model receives only the records you are
                authorised to read.
              </p>
              <div className="ai-input-row">
                <textarea
                  className="textarea"
                  rows={2}
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  placeholder="e.g. What do the water readings suggest about the swale, and what is still uncertain?"
                  aria-label="Question for the local model"
                />
                <div className="ai-input-actions">
                  <Button
                    variant="primary"
                    icon="sparkles"
                    onClick={runAi}
                    disabled={aiRunning || !aiPrompt.trim()}
                  >
                    {aiRunning ? 'Asking local model…' : 'Ask'}
                  </Button>
                  {aiRunning ? (
                    <Button
                      variant="ghost"
                      icon="x"
                      onClick={() => {
                        aiRef.current?.abort();
                        setAiRunning(false);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
              {aiRunning ? (
                <div className="ai-loading" role="status">
                  <span className="spinner" aria-hidden="true" />
                  Waiting for the local model. You can keep using the rest of the app and cancel at
                  any time.
                </div>
              ) : null}
              {aiError ? (
                <div className="stack-tight">
                  <FormError>{aiError}</FormError>
                  <div className="row-actions">
                    <Button
                      size="sm"
                      icon="search"
                      onClick={() => {
                        setQuery(aiPrompt);
                        setAiOpen(false);
                        toast('Fell back to local keyword search. No AI was used.', 'info');
                      }}
                    >
                      Use local keyword search instead
                    </Button>
                    <Link className="text-link" to="settings">
                      Check AI settings <Icon name="arrowRight" size={14} />
                    </Link>
                  </div>
                </div>
              ) : null}
              {aiAnswer ? (
                <div className="ai-answer">
                  <div className="ai-answer-head">
                    <Badge tone="accent" dot>
                      {aiAnswer.provider} · {aiAnswer.model}
                    </Badge>
                    <span className="muted tiny">
                      {aiAnswer.elapsedMs} ms · {aiAnswer.citations.length} citation
                      {aiAnswer.citations.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <AiAnswerText text={aiAnswer.text} citations={aiAnswer.citations} />
                  {aiAnswer.citations.length === 0 ? (
                    <Notice tone="warn" icon="alert">
                      The model returned no record citations. Treat this answer as unverified and
                      check the source records yourself.
                    </Notice>
                  ) : null}
                  <div className="ai-citations">
                    {aiAnswer.citations.map((citation) => (
                      <Link
                        key={citation.id}
                        className="citation-link"
                        to={`knowledge/${citation.id}`}
                      >
                        <Icon name="file" size={13} /> {citation.title}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="ai-off">
              <Icon name="sparkles" size={22} />
              <div>
                <p>
                  Optional AI is disabled. Knowledge search, communities, projects and consent all
                  work without it.
                </p>
                <p className="muted small">
                  You can enable a local Ollama endpoint in Node settings. Nothing is sent to a
                  cloud AI provider, and no model is downloaded automatically.
                </p>
                <Link className="btn btn-quiet btn-sm" to="settings">
                  Configure optional AI
                </Link>
              </div>
            </div>
          )
        ) : (
          <p className="muted small">
            {ai.enabled
              ? 'Ask a local model about your authorised records. Answers must cite records; access checks run before retrieval.'
              : 'AI is optional and currently off. Local search above is fully functional without any model.'}
          </p>
        )}
      </Card>

      {results.length === 0 ? (
        <EmptyState
          icon="knowledge"
          title={hasFilters ? 'No records match those filters' : 'No knowledge here yet'}
          action={
            <Button variant="primary" icon="plus" onClick={newRecord}>
              Create a record
            </Button>
          }
        >
          <p>
            {hasFilters
              ? 'Try clearing a filter. Some records may exist that you are not authorised to read.'
              : 'Start with something concrete: a guide, a meeting note, a field observation or a lesson learned.'}
          </p>
        </EmptyState>
      ) : (
        <div className="knowledge-grid">
          {results.map((record) => {
            const contextLinks = linkedContext(data, actorId, record);
            return (
              <Card key={record.id} className="knowledge-card">
                <div className="knowledge-card-top">
                  <ScopeBadge scope={record.scope} />
                  <span className="muted tiny">{KNOWLEDGE_KIND_LABELS[record.kind]}</span>
                  {record.isSample ? <Badge tone="sample">Sample</Badge> : null}
                </div>
                <h3>
                  <Link to={`knowledge/${record.id}`}>{record.title}</Link>
                </h3>
                <p className="knowledge-excerpt">{excerpt(record.body)}</p>
                <div className="knowledge-card-tags">
                  {record.tags.slice(0, 4).map((tagName) => (
                    <span className="chip chip-xs" key={tagName}>
                      {tagName}
                    </span>
                  ))}
                </div>
                {contextLinks.length > 0 ? (
                  <div className="context-chips">
                    {contextLinks.map((item) => (
                      <Link to={item.to} className="context-chip" key={item.label}>
                        <Icon name={item.icon} size={12} /> {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
                <div className="knowledge-card-foot">
                  <span className="author-line">
                    <Avatar name={personName(data, record.authorId)} size="sm" />
                    <span>
                      {personName(data, record.authorId)}
                      <span className="muted tiny"> · {relativeTime(record.updatedAt)}</span>
                    </span>
                  </span>
                  <Link className="text-link" to={`knowledge/${record.id}`}>
                    Read <Icon name="arrowRight" size={13} />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Notice tone="quiet" icon="lock" title="Search and counts follow access control">
        Results, filters, the AI corpus, charts and exports all pass through the same permission
        check. If you cannot see a record, it is not silently included in an aggregate.
      </Notice>

      <KnowledgeEditor
        key={`new-${composeCommunity}-${composeScope}-${route.query.project ?? ''}-${route.query.gathering ?? ''}`}
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          if (route.query.compose || route.query.project || route.query.gathering) navigate('knowledge');
        }}
        mode="create"
        initial={{
          communityId: composeCommunity,
          projectId: route.query.project ?? '',
          gatheringId: route.query.gathering ?? '',
          placeId: route.query.place ?? '',
          scope: composeScope,
        }}
      />
    </div>
  );
}

function AiAnswerText({ text, citations }: { text: string; citations: AiAnswer['citations'] }) {
  const parts = text.split(/(\[record:[a-zA-Z0-9-]+\])/g);
  return (
    <p className="ai-answer-text">
      {parts.map((part, index) => {
        const match = /^\[record:([a-zA-Z0-9-]+)\]$/.exec(part);
        if (!match) return <span key={index}>{part}</span>;
        const citation = citations.find((item) => item.id === match[1]);
        if (!citation) return <span key={index}>{part}</span>;
        return (
          <Link
            key={index}
            className="inline-citation"
            to={`knowledge/${citation.id}`}
            title={citation.title}
          >
            {citation.title}
          </Link>
        );
      })}
    </p>
  );
}

function KnowledgeDetail({ knowledgeId }: { knowledgeId: string }) {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const record = data.knowledge.find((k) => k.id === knowledgeId);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreIndex, setRestoreIndex] = useState<number | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState('');
  const transcriber = createTranscriber(settings.ai);
  const transcriptStatus = transcriptionStatus(settings.ai);

  // Moving between records must not carry a stale transcription error over.
  useEffect(() => {
    setTranscribeError('');
    setTranscribingId(null);
  }, [knowledgeId]);

  if (!record) {
    return (
      <EmptyState
        icon="knowledge"
        title="Record not found"
        action={
          <Link className="btn btn-primary btn-md" to="knowledge">
            Back to knowledge
          </Link>
        }
      >
        <p>It may have been deleted from this node.</p>
      </EmptyState>
    );
  }

  if (!canRead(data, actorId, record)) {
    return (
      <EmptyState icon="lock" title="This record is not shared with you">
        <p>
          Access is checked before the record is loaded into this view. A pending relationship or
          community membership alone does not grant access.
        </p>
        <Link className="btn btn-primary btn-md" to="knowledge">
          Back to your knowledge
        </Link>
      </EmptyState>
    );
  }

  const decision = accessFor(data, actorId, record);
  const isAuthor = record.authorId === actorId;
  const attachments = attachmentsOf(record);
  const recordings = attachments.filter((attachment) => attachment.kind === 'recording');
  const contextLinks = linkedContext(data, actorId, record);
  const community = data.communities.find((c) => c.id === record.communityId);
  const project = data.projects.find((p) => p.id === record.projectId);
  const gathering = data.gatherings.find((g) => g.id === record.gatheringId);
  const place = data.places.find((p) => p.id === record.placeId);
  const relationshipCount = data.relationships.filter(
    (r) =>
      r.status === 'active' &&
      (r.aId === record.authorId || r.bId === record.authorId),
  ).length;
  const activeAgreement = community
    ? data.groupAgreements.find(
        (g) => g.communityId === community.id && groupAgreementStatus(g) === 'active',
      )
    : undefined;

  const markdown = () => {
    const lines = [
      `# ${record.title}`,
      '',
      `- Author: ${personName(data, record.authorId)}`,
      `- Scope: ${scopeLabel(record.scope)}`,
      `- Type: ${KNOWLEDGE_KIND_LABELS[record.kind]}`,
      `- Created: ${formatDate(record.createdAt)}`,
      `- Updated: ${formatDate(record.updatedAt)}`,
      record.tags.length ? `- Tags: ${record.tags.join(', ')}` : '',
      community ? `- Community: ${community.name}` : '',
      project ? `- Project: ${project.title}` : '',
      gathering ? `- Gathering: ${gathering.title}` : '',
      place ? `- Place: ${place.name}` : '',
      '',
      record.body,
      '',
      record.sources.length ? `## Sources\n${record.sources.map((s) => `- ${s}`).join('\n')}` : '',
      record.links.length
        ? `## References\n${record.links
            .map((link) => `- ${link.label}${link.url ? ` — ${link.url}` : link.note ? ` — ${link.note}` : ''}`)
            .join('\n')}`
        : '',
      attachments.length
        ? `## Files and recordings\n${attachments
            .map(
              (attachment) =>
                `- ${attachment.name} (${attachmentTypeLabel(attachment)}, ${formatBytes(attachment.size)}${attachment.durationSeconds ? `, ${formatDuration(attachment.durationSeconds)}` : ''})`,
            )
            .join('\n')}`
        : '',
      ...attachments
        .filter((attachment) => attachment.transcript?.text)
        .map((attachment) => `### Transcript — ${attachment.name}\n${attachment.transcript!.text}`),
      '',
      `_Exported from a local Understory node by ${personName(data, actorId)}. Sharing scope at export: ${scopeLabel(record.scope)}. Exported copies cannot be recalled or controlled by the node._`,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const transcribe = async (attachment: KnowledgeAttachment) => {
    if (!transcriber) return;
    setTranscribingId(attachment.id);
    setTranscribeError('');
    try {
      const result = await transcriber.transcribe({
        dataUrl: attachment.dataUrl,
        mime: attachment.mime,
        name: attachment.name,
        timeoutMs: Math.max(settings.ai.timeoutMs, 60_000),
      });
      store.setAttachmentTranscript(record.id, attachment.id, result);
      toast('Transcript added to the recording.');
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Transcription failed.');
    } finally {
      setTranscribingId(null);
    }
  };

  const whoCanRead = () => {
    switch (record.scope) {
      case 'private':
        return 'Only you. No relationship, community agreement or AI adapter can retrieve it for someone else.';
      case 'relationship':
        return `${relationshipCount} active bilateral relationship${relationshipCount === 1 ? '' : 's'} involving the author can read this. Pending or revoked relationships cannot.`;
      case 'community':
        return activeAgreement
          ? `Every participant of the active group agreement “${activeAgreement.title}” in ${community?.name}. Membership alone is not enough.`
          : `No active unanimous agreement currently exists in ${community?.name}, so only the author can read this.`;
      case 'public':
        return 'Anyone using this node. Do not treat this as anonymous: public records still carry attribution.';
    }
  };

  return (
    <div className="stack">
      <div className="breadcrumb">
        <Link to="knowledge">Knowledge</Link>
        <Icon name="chevronRight" size={13} />
        <span>{record.title}</span>
      </div>

      <PageHeader
        eyebrow={`${KNOWLEDGE_KIND_LABELS[record.kind]} · ${scopeLabel(record.scope)}`}
        title={record.title}
        actions={
          <div className="header-actions">
            <DownloadButton
              filename={`${record.title.replace(/[^\w]+/g, '-').toLowerCase()}.md`}
              content={markdown()}
              mime="text/markdown"
              icon="download"
            >
              Export .md
            </DownloadButton>
            {isAuthor ? (
              <>
                <Button icon="edit" onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
                <Button variant="ghost" icon="trash" onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
              </>
            ) : null}
          </div>
        }
      >
        <div className="header-meta-row">
          <ScopeBadge scope={record.scope} />
          <span className="author-line">
            <Avatar name={personName(data, record.authorId)} size="sm" />
            {personName(data, record.authorId)}
            {isAuthor ? ' (you)' : ''}
          </span>
          <span className="muted small">Updated {formatDateTime(record.updatedAt)}</span>
          {record.isSample ? <Badge tone="sample">Fictional sample</Badge> : null}
        </div>
      </PageHeader>

      <AccessExplanation ownerId={record.authorId} scope={record.scope} communityId={record.communityId} />

      <div className="two-col knowledge-detail-layout">
        <div className="stack">
          <Card>
            <article className="prose knowledge-body">{record.body}</article>
            {record.tags.length > 0 ? (
              <div className="tag-list">
                {record.tags.map((tagName) => (
                  <span className="chip" key={tagName}>
                    {tagName}
                  </span>
                ))}
              </div>
            ) : null}
          </Card>

          {attachments.length > 0 ? (
            <Card>
              <CardHeader
                icon="file"
                title={`Files and voice notes (${attachments.length})`}
                subtitle="Stored inside this record. Anyone who can read the record can read these too."
              />
              <ul className="attachment-list">
                {attachments.map((attachment) => (
                  <li className="attachment-row" key={attachment.id}>
                    <span
                      className={`attachment-icon attachment-icon-${attachment.kind}`}
                      aria-hidden="true"
                    >
                      <Icon name={attachment.kind === 'recording' ? 'mic' : 'file'} size={18} />
                    </span>
                    <div className="attachment-main">
                      <div className="attachment-name">{attachment.name}</div>
                      <div className="attachment-meta">
                        {attachmentTypeLabel(attachment)}
                        {attachment.durationSeconds ? ` · ${formatDuration(attachment.durationSeconds)}` : ''}
                        {' · '}
                        {formatBytes(attachment.size)} · added {formatDate(attachment.addedAt)}
                      </div>
                      {attachment.kind === 'recording' ? (
                        <audio
                          className="attachment-audio"
                          controls
                          preload="metadata"
                          src={attachment.dataUrl}
                          aria-label={`Voice note ${attachment.name}`}
                        >
                          Your browser cannot play this recording. Download it instead.
                        </audio>
                      ) : null}
                      {attachment.transcript ? (
                        <details className="attachment-transcript">
                          <summary>Transcript</summary>
                          <p>{attachment.transcript.text}</p>
                          <p className="muted tiny">
                            Transcribed by {attachment.transcript.provider} (
                            {attachment.transcript.model}) on{' '}
                            {formatDateTime(attachment.transcript.at)}. Stored locally with the
                            recording.
                          </p>
                        </details>
                      ) : attachment.kind === 'recording' && isAuthor ? (
                        <div className="attachment-transcribe">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="sparkles"
                            onClick={() => void transcribe(attachment)}
                            disabled={!transcriptStatus.available || transcribingId !== null}
                          >
                            {transcribingId === attachment.id ? 'Transcribing…' : 'Transcribe'}
                          </Button>
                          {!transcriptStatus.available ? (
                            <span className="muted tiny">
                              {transcriptStatus.reason}{' '}
                              <Link to="settings">Node settings</Link>
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <a
                      className="btn btn-quiet btn-sm attachment-download"
                      href={attachment.dataUrl}
                      download={attachment.name}
                    >
                      <Icon name="download" size={15} />
                      <span>Download</span>
                    </a>
                  </li>
                ))}
              </ul>
              {transcribeError ? <FormError>{transcribeError}</FormError> : null}
              <p className="muted tiny">
                Files live in this node only and inherit the record’s sharing scope. Downloading
                makes a copy this node cannot recall or control.
                {recordings.length > 0
                  ? ' A recording is personal data: make sure everyone who can be heard agreed to it, and check the scope before sharing this record.'
                  : ''}
              </p>
            </Card>
          ) : null}

          {record.sources.length > 0 || record.links.length > 0 ? (
            <Card>
              <CardHeader icon="link" title="Sources and references" />
              {record.sources.length > 0 ? (
                <div className="reference-block">
                  <div className="field-inline-label">Provenance</div>
                  <ul className="source-list">
                    {record.sources.map((source) => (
                      <li key={source}>
                        <Icon name="book" size={14} /> {source}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {record.links.length > 0 ? (
                <div className="reference-block">
                  <div className="field-inline-label">References</div>
                  <ul className="link-list">
                    {record.links.map((link) => (
                      <li key={link.label}>
                        <Icon name={link.url ? 'external' : 'file'} size={14} />
                        {link.url ? (
                          <a href={link.url} target="_blank" rel="noreferrer noopener">
                            {link.label}
                          </a>
                        ) : (
                          <span>{link.label}</span>
                        )}
                        {link.note ? <span className="muted small"> — {link.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                  <p className="muted tiny">
                    References are notes or links. Files and recordings attached to this record are
                    listed above.
                  </p>
                </div>
              ) : null}
            </Card>
          ) : null}

          {record.versions.length > 0 ? (
            <Card>
              <CardHeader
                icon="clock"
                title={`Version history (${record.versions.length})`}
                subtitle="Previous states are retained locally so changes to a shared record are visible."
              />
              <ol className="version-list">
                {[...record.versions].reverse().map((version, reverseIndex) => {
                  const index = record.versions.length - 1 - reverseIndex;
                  return (
                    <li key={`${version.at}-${index}`}>
                      <span className="version-dot" aria-hidden="true" />
                      <div>
                        <strong>{version.note}</strong>
                        <div className="muted tiny">
                          {formatDateTime(version.at)} · {personName(data, version.byId)} · scope{' '}
                          {scopeLabel(version.scope)}
                        </div>
                        <div className="version-title">“{version.title}”</div>
                      </div>
                      {isAuthor ? (
                        <Button size="sm" variant="ghost" onClick={() => setRestoreIndex(index)}>
                          Restore
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </Card>
          ) : null}
        </div>

        <div className="stack">
          <Card>
            <CardHeader icon="shield" title="Who can read this" />
            <p>{whoCanRead()}</p>
            {decision.allowed ? (
              <p className="muted small">{decision.explanation}</p>
            ) : null}
            <ul className="principle-list compact">
              <li>Relationship access is all-or-nothing for this scope.</li>
              <li>Community membership alone never unlocks group-shared records.</li>
              <li>Changing scope takes effect immediately for every view, search and export.</li>
            </ul>
          </Card>

          <Card>
            <CardHeader icon="link" title="Connections" />
            <dl className="detail-list tight">
              <div>
                <dt>Community</dt>
                <dd>{community ? contextLinks.find((l) => l.icon === 'community') ? <Link to={contextLinks.find((l) => l.icon === 'community')!.to}>{community.name}</Link> : community.name : '—'}</dd>
              </div>
              <div>
                <dt>Project</dt>
                <dd>
                  {project
                    ? canViewProject(data, actorId, project)
                      ? <Link to={`projects/${project.id}`}>{project.title}</Link>
                      : 'Linked to a project you cannot see'
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Gathering</dt>
                <dd>
                  {gathering
                    ? canViewGathering(data, actorId, gathering)
                      ? <Link to={`gatherings/${gathering.id}`}>{gathering.title}</Link>
                      : 'Linked to a gathering you cannot see'
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Place</dt>
                <dd>
                  {place
                    ? canViewPlace(data, actorId, place)
                      ? place.name
                      : 'Linked to a place you cannot see'
                    : '—'}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader icon="info" title="Provenance" />
            <dl className="detail-list tight">
              <div>
                <dt>Author</dt>
                <dd>{personName(data, record.authorId)}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDateTime(record.createdAt)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatDateTime(record.updatedAt)}</dd>
              </div>
              <div>
                <dt>Revisions</dt>
                <dd>{record.versions.length}</dd>
              </div>
            </dl>
            <p className="muted tiny">
              Attribution stays with the author. Public scope does not mean anonymous or free of
              context.
            </p>
          </Card>
        </div>
      </div>

      <KnowledgeEditor
        key={`edit-${record.id}-${record.updatedAt}`}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        record={record}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          try {
            store.deleteKnowledge(record.id);
            toast('Record deleted from this node.', 'info');
            navigate('knowledge');
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Could not delete.', 'error');
          }
        }}
        title="Delete this knowledge record?"
        confirmLabel="Delete record"
        tone="danger"
      >
        <p>
          The record will be removed from this node, along with links from projects and gatherings.
          A consent event records the deletion without retaining the content.
        </p>
        <p className="muted small">
          Copies someone exported, memorised or shared elsewhere cannot be recalled. This action
          cannot be undone here.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={restoreIndex !== null}
        onClose={() => setRestoreIndex(null)}
        onConfirm={() => {
          if (restoreIndex === null) return;
          try {
            store.restoreKnowledgeVersion(record.id, restoreIndex);
            toast('Earlier version restored. The replaced state remains in history.');
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Could not restore version.', 'error');
          }
        }}
        title="Restore this earlier version?"
        confirmLabel="Restore version"
      >
        <p>
          The current title, content and scope will be kept in version history, then replaced by the
          selected version. Sharing scope may change as a result.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function KnowledgeEditor({
  open,
  onClose,
  mode,
  record,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  record?: KnowledgeRecord;
  initial?: {
    communityId?: string;
    projectId?: string;
    gatheringId?: string;
    placeId?: string;
    scope?: Scope;
  };
}) {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const communities = myCommunities(data, settings.actorId);
  const projects = myProjects(data, settings.actorId);
  const gatherings = myGatherings(data, settings.actorId);
  const places = data.places.filter((place) => canViewPlace(data, settings.actorId, place));
  const [form, setForm] = useState({
    title: record?.title ?? '',
    body: record?.body ?? '',
    kind: (record?.kind ?? 'note') as KnowledgeKind,
    scope: (record?.scope ?? initial?.scope ?? 'private') as Scope,
    communityId: record?.communityId ?? initial?.communityId ?? '',
    projectId: record?.projectId ?? initial?.projectId ?? '',
    gatheringId: record?.gatheringId ?? initial?.gatheringId ?? '',
    placeId: record?.placeId ?? initial?.placeId ?? '',
    tags: record?.tags.join(', ') ?? '',
    sources: record?.sources.join('\n') ?? '',
    attachments: attachmentsOf(record ?? {}),
    references: record
      ? record.links
          .map((link) => `${link.label}${link.url ? ` | ${link.url}` : link.note ? ` | ${link.note}` : ''}`)
          .join('\n')
      : '',
    versionNote: '',
  });
  const [error, setError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [readingFiles, setReadingFiles] = useState(false);
  const selectedCommunity = data.communities.find((c) => c.id === form.communityId);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const removeAttachment = (id: string) => {
    setAttachmentError('');
    set('attachments', form.attachments.filter((attachment) => attachment.id !== id));
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachmentError('');
    setReadingFiles(true);
    const next = [...form.attachments];
    try {
      for (const file of Array.from(files)) {
        if (next.length >= ATTACHMENT_LIMITS.maxPerRecord) {
          setAttachmentError(
            `A record can hold ${ATTACHMENT_LIMITS.maxPerRecord} files and recordings.`,
          );
          break;
        }
        if (file.size > ATTACHMENT_LIMITS.maxFileBytes) {
          setAttachmentError(
            `“${file.name}” is ${formatBytes(file.size)}. The limit for one file is ${formatBytes(ATTACHMENT_LIMITS.maxFileBytes)}.`,
          );
          continue;
        }
        const attachment = await fileToAttachment(file);
        const limitError = attachmentLimitError([...next, attachment]);
        if (limitError) {
          setAttachmentError(limitError);
          break;
        }
        next.push(attachment);
      }
      set('attachments', next);
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : 'That file could not be read.');
    } finally {
      setReadingFiles(false);
    }
  };

  const addRecording = async (attachment: KnowledgeAttachment) => {
    const limitError = attachmentLimitError([...form.attachments, attachment]);
    if (limitError) {
      setAttachmentError(limitError);
      return;
    }
    setAttachmentError('');
    set('attachments', [...form.attachments, attachment]);
  };

  const parseLinks = (): KnowledgeLink[] => {
    return form.references
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [labelPart, ...rest] = line.split('|');
        const label = labelPart.trim();
        const target = rest.join('|').trim();
        if (!label) throw new Error('Every reference needs a label.');
        if (target.startsWith('http')) {
          if (!isSafeHttpUrl(target)) throw new Error(`Reference “${label}” has an unsafe or invalid URL.`);
          return { label, url: target, kind: 'website' as const };
        }
        return { label, note: target || undefined, kind: 'other' as const };
      });
  };

  const submit = () => {
    setError('');
    try {
      const input = {
        title: form.title,
        body: form.body,
        kind: form.kind,
        scope: form.scope,
        communityId: form.communityId || undefined,
        projectId: form.projectId || undefined,
        gatheringId: form.gatheringId || undefined,
        placeId: form.placeId || undefined,
        tags: form.tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        sources: form.sources.split('\n').map((s) => s.trim()).filter(Boolean),
        links: parseLinks(),
        attachments: form.attachments,
      };
      if (mode === 'create') {
        const id = store.createKnowledge(input);
        toast('Knowledge record created.');
        onClose();
        navigate(`knowledge/${id}`);
      } else if (record) {
        store.updateKnowledge(record.id, input, form.versionNote || 'Edited');
        toast('Record updated. The previous version is kept in history.');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the record.');
    }
  };

  const relevantProjects = projects.filter(
    (p) => !form.communityId || p.communityId === form.communityId,
  );
  const relevantGatherings = gatherings.filter(
    (g) => !form.communityId || g.communityId === form.communityId,
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'New knowledge record' : 'Edit knowledge record'}
      description="Choose a sharing scope deliberately. It is the only thing that decides who can read this."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={submit}>
            {mode === 'create' ? 'Create record' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {error ? <FormError>{error}</FormError> : null}
        <div className="form-row">
          <Field label="Title" htmlFor="k-title" required>
            <input
              id="k-title"
              className="input"
              value={form.title}
              maxLength={160}
              onChange={(event) => set('title', event.target.value)}
              placeholder="A specific, findable title"
            />
          </Field>
          <Field label="Type" htmlFor="k-kind">
            <select
              id="k-kind"
              className="select"
              value={form.kind}
              onChange={(event) => set('kind', event.target.value as KnowledgeKind)}
            >
              {Object.entries(KNOWLEDGE_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className="scope-fieldset">
          <legend>Sharing scope</legend>
          {SCOPE_OPTIONS.map((option) => (
            <label
              className={`scope-option${form.scope === option.value ? ' is-selected' : ''}`}
              key={option.value}
            >
              <input
                type="radio"
                name="scope"
                value={option.value}
                checked={form.scope === option.value}
                onChange={() => set('scope', option.value)}
              />
              <span className={`scope-marker scope-${option.value}`} aria-hidden="true">
                <Icon
                  name={
                    option.value === 'private'
                      ? 'lock'
                      : option.value === 'relationship'
                        ? 'key'
                        : option.value === 'community'
                          ? 'community'
                          : 'eye'
                  }
                  size={16}
                />
              </span>
              <span>
                <strong>{option.label}</strong>
                <small>
                  {option.value === 'community' && selectedCommunity
                    ? scopeDescription('community', selectedCommunity.name)
                    : option.hint}
                </small>
              </span>
            </label>
          ))}
        </fieldset>

        {form.scope === 'community' ? (
          <Field
            label="Community"
            htmlFor="k-community"
            required
            hint="The record becomes readable by others only if a unanimous group agreement is active and includes them."
          >
            <select
              id="k-community"
              className="select"
              value={form.communityId}
              onChange={(event) => set('communityId', event.target.value)}
            >
              <option value="">Choose a community…</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Content" htmlFor="k-body" required>
          <textarea
            id="k-body"
            className="textarea textarea-lg"
            rows={12}
            value={form.body}
            onChange={(event) => set('body', event.target.value)}
            placeholder="Write what is useful to someone else: context, method, observations, what you are uncertain about."
          />
        </Field>

        <fieldset className="attachment-fieldset">
          <legend>Files and voice notes</legend>
          <p className="field-hint" id="k-files-hint">
            Any file type. Up to {formatBytes(ATTACHMENT_LIMITS.maxFileBytes)} per file and{' '}
            {formatBytes(ATTACHMENT_LIMITS.maxRecordBytes)} per record, {' '}
            {ATTACHMENT_LIMITS.maxPerRecord} items in total. Attachments inherit this record’s
            sharing scope; they are never shared separately.
          </p>
          <div className="attachment-add">
            <label className="btn btn-quiet btn-sm file-button">
              <Icon name="upload" size={15} />
              <span>{readingFiles ? 'Reading files…' : 'Add files'}</span>
              <input
                className="file-input"
                type="file"
                multiple
                aria-describedby="k-files-hint"
                disabled={readingFiles}
                onChange={(event) => {
                  const files = event.currentTarget.files;
                  void addFiles(files);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <span className="muted tiny">
              {form.attachments.length} of {ATTACHMENT_LIMITS.maxPerRecord} ·{' '}
              {formatBytes(attachmentBytes(form.attachments))} of{' '}
              {formatBytes(ATTACHMENT_LIMITS.maxRecordBytes)}
            </span>
          </div>

          {form.attachments.length > 0 ? (
            <ul className="attachment-list attachment-list-compact">
              {form.attachments.map((attachment) => (
                <li className="attachment-row" key={attachment.id}>
                  <span
                    className={`attachment-icon attachment-icon-${attachment.kind}`}
                    aria-hidden="true"
                  >
                    <Icon name={attachment.kind === 'recording' ? 'mic' : 'file'} size={17} />
                  </span>
                  <div className="attachment-main">
                    <div className="attachment-name">{attachment.name}</div>
                    <div className="attachment-meta">
                      {attachmentTypeLabel(attachment)}
                      {attachment.durationSeconds ? ` · ${formatDuration(attachment.durationSeconds)}` : ''}
                      {' · '}
                      {formatBytes(attachment.size)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="trash"
                    onClick={() => removeAttachment(attachment.id)}
                  >
                    Remove<span className="sr-only"> {attachment.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {attachmentError ? (
            <p className="field-error" role="alert">
              <Icon name="alert" size={14} /> {attachmentError}
            </p>
          ) : null}

          <div className="voice-note-block">
            <div className="field-inline-label">Voice note</div>
            <p className="field-hint">
              Record a spoken version of this text. The recording is held with the record when you
              save, and can be transcribed later by a local speech service.
            </p>
            <VoiceRecorder
              onRecorded={addRecording}
              disabled={readingFiles || form.attachments.length >= ATTACHMENT_LIMITS.maxPerRecord}
            />
          </div>
        </fieldset>

        <div className="form-row">
          {form.scope !== 'community' ? (
            <Field label="Community link" htmlFor="k-community-link" hint="Optional. Does not change scope.">
              <select
                id="k-community-link"
                className="select"
                value={form.communityId}
                onChange={(event) => {
                  set('communityId', event.target.value);
                  set('projectId', '');
                  set('gatheringId', '');
                }}
              >
                <option value="">No community</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Project" htmlFor="k-project">
            <select
              id="k-project"
              className="select"
              value={form.projectId}
              onChange={(event) => set('projectId', event.target.value)}
            >
              <option value="">No project</option>
              {relevantProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Gathering" htmlFor="k-gathering">
            <select
              id="k-gathering"
              className="select"
              value={form.gatheringId}
              onChange={(event) => set('gatheringId', event.target.value)}
            >
              <option value="">No gathering</option>
              {relevantGatherings.map((gathering) => (
                <option key={gathering.id} value={gathering.id}>
                  {gathering.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Place" htmlFor="k-place">
            <select
              id="k-place"
              className="select"
              value={form.placeId}
              onChange={(event) => set('placeId', event.target.value)}
            >
              <option value="">No place</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Tags" htmlFor="k-tags" hint="Comma separated. Lowercase, specific.">
          <input
            id="k-tags"
            className="input"
            value={form.tags}
            onChange={(event) => set('tags', event.target.value)}
            placeholder="water, swale, monitoring"
          />
        </Field>
        <Field label="Sources and provenance" htmlFor="k-sources" hint="One per line. Who gathered or said this, when, and how?">
          <textarea
            id="k-sources"
            className="textarea"
            rows={2}
            value={form.sources}
            onChange={(event) => set('sources', event.target.value)}
            placeholder="Field measurements by Idris Vale, April 2026"
          />
        </Field>
        <Field
          label="Links and references"
          htmlFor="k-references"
          hint="One per line: “Label | https://…” or “Label | note”. Use files above for documents, images, audio or data."
        >
          <textarea
            id="k-references"
            className="textarea"
            rows={2}
            value={form.references}
            onChange={(event) => set('references', event.target.value)}
            placeholder="Dip well method notes | paper copy in the plot 3 shed"
          />
        </Field>
        {mode === 'edit' ? (
          <Field
            label="Change note"
            htmlFor="k-version-note"
            hint="Stored with the previous version so the history is intelligible."
          >
            <input
              id="k-version-note"
              className="input"
              value={form.versionNote}
              maxLength={160}
              onChange={(event) => set('versionNote', event.target.value)}
              placeholder="e.g. Added the August reading"
            />
          </Field>
        ) : null}

        <Notice tone="quiet" icon="shield">
          Changing scope can make this record visible to more people immediately, or withdraw it
          from those who could previously read it. Existing copies elsewhere are outside this node’s
          control.
        </Notice>
        {form.scope === 'public' ? (
          <Notice tone="warn" icon="eye" title="Public means readable by anyone on this node">
            Check for personal details, precise locations of sensitive species, or anything shared
            with you in confidence before publishing.
          </Notice>
        ) : null}
      </div>
    </Modal>
  );
}
