import { useState } from 'react';
import {
  canManageCommunity,
  canRead,
  canViewProject,
  personName,
  visibleDirectory,
} from '../core/access';
import { formatDate, toLocalInput, fromLocalInput, relativeTime } from '../core/dates';
import { PROJECT_STATUS_LABELS, TASK_STATUS_LABELS } from '../core/labels';
import { myCommunities, projectKnowledge, projectProgress } from '../core/selectors';
import type { Project, ProjectStatus, TaskStatus } from '../core/types';
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

export function ProjectsPage({ projectId }: { projectId?: string }) {
  if (projectId) return <ProjectDetail projectId={projectId} />;
  return <ProjectIndex />;
}

function statusTone(status: ProjectStatus) {
  return status === 'complete'
    ? 'success'
    : status === 'paused'
      ? 'warning'
      : status === 'proposed'
        ? 'neutral'
        : 'accent';
}

function ProjectIndex() {
  const { snapshot } = useApp();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const [tab, setTab] = useState<'active' | 'all' | 'complete'>('active');
  const [createOpen, setCreateOpen] = useState(
    Boolean(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('compose')),
  );
  const composeCommunity =
    new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('compose') ?? '';

  const projects = data.projects.filter((p) => canViewProject(data, actorId, p));
  const filtered = projects
    .filter((p) =>
      tab === 'active'
        ? p.status === 'active'
        : tab === 'complete'
          ? p.status === 'complete'
          : true,
    )
    .sort((a, b) => {
      const order: Record<ProjectStatus, number> = { active: 0, paused: 1, proposed: 2, complete: 3 };
      return order[a.status] - order[b.status] || a.title.localeCompare(b.title);
    });

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Practical work"
        title="Projects"
        lede="Shared work with an objective, tasks, materials and people who have agreed to carry them. Progress is a planning aid, not a performance score."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
            Start a project
          </Button>
        }
      />

      <div className="filter-bar">
        <Tabs
          label="Project status"
          value={tab}
          onChange={(value) => setTab(value as 'active' | 'all' | 'complete')}
          options={[
            { value: 'active', label: 'Active', count: projects.filter((p) => p.status === 'active').length },
            { value: 'all', label: 'All', count: projects.length },
            { value: 'complete', label: 'Complete', count: projects.filter((p) => p.status === 'complete').length },
          ]}
        />
        <span className="muted small">
          {myCommunities(data, actorId).length} communities · {projects.length} projects visible
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="project"
          title="No projects here"
          action={
            <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
              Start a project
            </Button>
          }
        >
          <p>
            A project could restore a habitat, document a skill, maintain shared infrastructure or
            run a learning programme. Give it a clear objective and a handful of real tasks.
          </p>
        </EmptyState>
      ) : (
        <div className="project-grid">
          {filtered.map((project) => {
            const community = data.communities.find((c) => c.id === project.communityId);
            const progress = projectProgress(project);
            const openTasks = project.tasks.filter((t) => t.status !== 'done');
            const knowledge = projectKnowledge(data, actorId, project);
            return (
              <Card key={project.id} className="project-card">
                <div className="project-card-head">
                  <div className="project-card-community">
                    <Icon name="community" size={14} />
                    {community?.name}
                  </div>
                  <Badge tone={statusTone(project.status)} dot>
                    {PROJECT_STATUS_LABELS[project.status]}
                  </Badge>
                </div>
                <h2>
                  <Link to={`projects/${project.id}`}>{project.title}</Link>
                </h2>
                <p className="project-summary">{project.summary}</p>
                <Progress value={progress} label={`${project.title} progress`} />
                <div className="project-meta-grid">
                  <span>
                    <strong>{openTasks.length}</strong> open task{openTasks.length === 1 ? '' : 's'}
                  </span>
                  <span>
                    <strong>{project.participants.length}</strong> participants
                  </span>
                  <span>
                    <strong>{knowledge.length}</strong> linked record{knowledge.length === 1 ? '' : 's'}
                  </span>
                  <span>
                    <strong>{project.targetDate ? formatDate(project.targetDate) : 'No target'}</strong>{' '}
                    target
                  </span>
                </div>
                <div className="project-card-foot">
                  <span className="muted tiny">
                    Led by {personName(data, project.leadId)}
                    {(() => {
                      const blocked = project.tasks.filter((t) => t.status === 'blocked').length;
                      return blocked > 0 ? ` · ${blocked} blocked ${blocked === 1 ? 'task' : 'tasks'}` : '';
                    })()}
                  </span>
                  <Button size="sm" onClick={() => navigate(`projects/${project.id}`)}>
                    Open
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader icon="info" title="What a project is here" />
        <p>
          Projects connect practical intentions to tasks, materials, knowledge and in-person
          meetings. There are no likes, points or leaderboards. A task can be blocked, a project can
          pause, and a plan can be wrong; recording that is part of the work.
        </p>
      </Card>

      <ProjectFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        initialCommunityId={composeCommunity}
      />
    </div>
  );
}

function ProjectDetail({ projectId }: { projectId: string }) {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const project = data.projects.find((p) => p.id === projectId);
  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  if (!project) {
    return (
      <EmptyState
        icon="project"
        title="Project not found"
        action={
          <Link className="btn btn-primary btn-md" to="projects">
            Back to projects
          </Link>
        }
      >
        <p>It may have been removed from this node.</p>
      </EmptyState>
    );
  }

  if (!canViewProject(data, actorId, project)) {
    return (
      <EmptyState icon="lock" title="This project is not shared with you">
        <p>Projects belong to a community. Join it before taking part.</p>
        <Link className="btn btn-primary btn-md" to="projects">
          Back to projects
        </Link>
      </EmptyState>
    );
  }

  const community = data.communities.find((c) => c.id === project.communityId);
  const canManage = project.leadId === actorId || canManageCommunity(data, actorId, project.communityId);
  const progress = projectProgress(project);
  const knowledge = projectKnowledge(data, actorId, project);
  const uniqueParticipants = Array.from(
    new Set([project.leadId, ...project.participants]),
  ).filter((id) => data.people.some((p) => p.id === id));
  const openTasks = project.tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  const doneTasks = project.tasks.filter((t) => t.status === 'done');
  const overdue = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date());

  const updateStatus = (status: TaskStatus, taskId: string) => {
    try {
      store.updateTask(project.id, taskId, { status });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update task.', 'error');
    }
  };

  const updateAssignee = (taskId: string, assigneeId: string) => {
    try {
      store.updateTask(project.id, taskId, { assigneeId: assigneeId || undefined });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update task.', 'error');
    }
  };

  return (
    <div className="stack">
      <div className="breadcrumb">
        <Link to="projects">Projects</Link>
        <Icon name="chevronRight" size={13} />
        <Link to={`communities/${project.communityId}`}>{community?.name}</Link>
        <Icon name="chevronRight" size={13} />
        <span>{project.title}</span>
      </div>

      <PageHeader
        eyebrow={community?.name}
        title={project.title}
        lede={project.summary}
        actions={
          <div className="header-actions">
            <Button icon="plus" onClick={() => setTaskOpen(true)}>
              Add task
            </Button>
            <Button icon="link" onClick={() => setLinkOpen(true)}>
              Link knowledge
            </Button>
            {canManage ? (
              <Button icon="edit" onClick={() => setEditOpen(true)}>
                Edit project
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="header-meta-row">
          <Badge tone={statusTone(project.status)} dot>
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
          <span>
            <Icon name="users" size={14} /> Led by {personName(data, project.leadId)}
          </span>
          <span>
            <Icon name="calendar" size={14} /> Target{' '}
            {project.targetDate ? formatDate(project.targetDate) : 'not set'}
          </span>
          {overdue.length > 0 ? (
            <Badge tone="danger">{overdue.length} overdue task{overdue.length === 1 ? '' : 's'}</Badge>
          ) : null}
        </div>
      </PageHeader>

      <div className="stat-grid compact-stats">
        <div className="stat static">
          <span className="stat-value">{progress}%</span>
          <span className="stat-label">tasks complete</span>
          <span className="stat-hint">
            {doneTasks.length}/{project.tasks.length} tasks
          </span>
        </div>
        <div className="stat static">
          <span className="stat-value">{openTasks.length}</span>
          <span className="stat-label">open tasks</span>
          <span className="stat-hint">{project.tasks.filter((t) => t.status === 'blocked').length} blocked</span>
        </div>
        <div className="stat static">
          <span className="stat-value">{uniqueParticipants.length}</span>
          <span className="stat-label">participants</span>
          <span className="stat-hint">Named collaborators</span>
        </div>
        <div className="stat static">
          <span className="stat-value">{knowledge.length}</span>
          <span className="stat-label">linked records</span>
          <span className="stat-hint">Only those you can read</span>
        </div>
      </div>

      <div className="two-col project-layout">
        <div className="stack">
          <Card>
            <CardHeader icon="leaf" title="Objective and intended outcome" />
            <p className="prose">{project.objective}</p>
            {project.outcomes ? (
              <>
                <div className="field-inline-label">Outcomes so far</div>
                <p className="prose">{project.outcomes}</p>
              </>
            ) : (
              <p className="muted small">No outcome recorded yet.</p>
            )}
            <div className="progress-block">
              <Progress value={progress} label="Task completion" />
              <span className="muted tiny">
                {project.tasks.length === 0
                  ? 'No tasks yet.'
                  : `${doneTasks.length} done · ${openTasks.length} open · ${project.tasks.filter((t) => t.status === 'blocked').length} blocked`}
              </span>
            </div>
          </Card>

          <Card>
            <CardHeader
              icon="project"
              title="Tasks"
              subtitle="Small enough to do, specific enough to check. No scores."
              action={
                <Button size="sm" icon="plus" onClick={() => setTaskOpen(true)}>
                  Add task
                </Button>
              }
            />
            {project.tasks.length === 0 ? (
              <EmptyState icon="project" title="No tasks yet">
                <p>Break the objective into the next few practical steps.</p>
              </EmptyState>
            ) : (
              <div className="task-list">
                {[...openTasks, ...doneTasks].map((task) => {
                  const isOverdue =
                    task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date();
                  return (
                    <div
                      key={task.id}
                      className={`task-row status-${task.status}${isOverdue ? ' is-overdue' : ''}`}
                    >
                      <span className={`task-status-dot status-${task.status}`} aria-hidden="true" />
                      <div className="task-main">
                        <div className="task-title-row">
                          <strong>{task.title}</strong>
                          {task.status === 'blocked' ? <Badge tone="danger">blocked</Badge> : null}
                          {isOverdue ? <Badge tone="warning">overdue</Badge> : null}
                        </div>
                        {task.detail ? <p className="task-detail">{task.detail}</p> : null}
                        <div className="task-meta">
                          <label className="inline-control">
                            <span className="sr-only">Status for {task.title}</span>
                            <select
                              className="select select-xs"
                              value={task.status}
                              onChange={(event) =>
                                updateStatus(event.target.value as TaskStatus, task.id)
                              }
                            >
                              {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="inline-control">
                            <span className="sr-only">Assignee for {task.title}</span>
                            <select
                              className="select select-xs"
                              value={task.assigneeId ?? ''}
                              onChange={(event) =>
                                updateAssignee(task.id, event.target.value)
                              }
                            >
                              <option value="">Unassigned</option>
                              {uniqueParticipants.map((id) => (
                                <option key={id} value={id}>
                                  {personName(data, id)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <span className={`task-due${isOverdue ? ' overdue' : ''}`}>
                            <Icon name="calendar" size={13} />{' '}
                            {task.dueDate ? formatDate(task.dueDate) : 'No date'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="icon-btn subtle"
                        aria-label={`Delete task ${task.title}`}
                        onClick={() => setDeleteTaskId(task.id)}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              icon="database"
              title="Materials and resources"
              subtitle="What is needed, what is secured, and who is looking after it."
              action={
                <Button size="sm" icon="plus" onClick={() => setResourceOpen(true)}>
                  Add resource
                </Button>
              }
            />
            {project.resources.length === 0 ? (
              <p className="muted small">No resources listed.</p>
            ) : (
              <ul className="resource-list">
                {project.resources.map((resource) => (
                  <li key={resource.id}>
                    <span className={`resource-icon ${resource.status}`}>
                      <Icon name={resource.status === 'secured' ? 'check' : 'alert'} size={15} />
                    </span>
                    <span>
                      <strong>{resource.name}</strong>
                      {resource.note ? <small>{resource.note}</small> : null}
                    </span>
                    <Badge tone={resource.status === 'secured' ? 'success' : 'warning'}>
                      {resource.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader icon="book" title="Lessons learned" />
            {project.lessons.length === 0 ? (
              <p className="muted small">No lessons recorded yet.</p>
            ) : (
              <ul className="outcome-list">
                {project.lessons.map((lesson) => (
                  <li key={lesson}>{lesson}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              icon="knowledge"
              title="Supporting knowledge"
              subtitle="Records linked to this project, filtered to your access."
              action={
                <Button
                  size="sm"
                  onClick={() =>
                    navigate(`knowledge?compose=${project.communityId}&scope=community&project=${project.id}`)
                  }
                >
                  New record
                </Button>
              }
            />
            {knowledge.length === 0 ? (
              <p className="muted small">
                No linked records you can read. Links never grant access on their own.
              </p>
            ) : (
              <ul className="list">
                {knowledge.map((record) => (
                  <li key={record.id}>
                    <Link to={`knowledge/${record.id}`} className="list-row row-link">
                      <ScopeBadge scope={record.scope} short />
                      <span className="list-main">
                        <strong>{record.title}</strong>
                        <span className="list-sub">
                          {personName(data, record.authorId)} · updated {relativeTime(record.updatedAt)}
                        </span>
                      </span>
                      <Icon name="chevronRight" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="stack project-side">
          <Card>
            <CardHeader icon="users" title="Participants" subtitle="People who have taken on part of the work." />
            <ul className="participant-list">
              {uniqueParticipants.map((id) => (
                <li key={id}>
                  <Avatar name={personName(data, id)} size="sm" />
                  <span>
                    {personName(data, id)}
                    {id === actorId ? ' (you)' : ''}
                  </span>
                  {id === project.leadId ? <Badge tone="accent">lead</Badge> : null}
                </li>
              ))}
            </ul>
            <p className="muted tiny">
              Participation is not a permission level. Project access follows community membership.
            </p>
          </Card>

          <Card>
            <CardHeader icon="calendar" title="Project details" />
            <dl className="detail-list tight">
              <div>
                <dt>Community</dt>
                <dd>
                  <Link to={`communities/${project.communityId}`}>{community?.name}</Link>
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{PROJECT_STATUS_LABELS[project.status]}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{project.startDate ? formatDate(project.startDate) : '—'}</dd>
              </div>
              <div>
                <dt>Target</dt>
                <dd>{project.targetDate ? formatDate(project.targetDate) : 'Not set'}</dd>
              </div>
            </dl>
            {canManage ? (
              <Button size="sm" icon="edit" onClick={() => setEditOpen(true)}>
                Update status & details
              </Button>
            ) : null}
          </Card>

          <Card>
            <CardHeader icon="shield" title="Access in this project" />
            <p className="muted small">
              Any active community member can see the project and contribute tasks. Knowledge linked
              here remains governed by its own scope; linking does nothing to consent.
            </p>
            <Link className="text-link" to="knowledge">
              Understanding scopes <Icon name="arrowRight" size={14} />
            </Link>
          </Card>
        </div>
      </div>

      <ProjectFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        project={project}
      />
      <TaskModal
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        project={project}
        participants={uniqueParticipants}
      />
      <LinkKnowledgeModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        project={project}
      />
      <ResourceModal open={resourceOpen} onClose={() => setResourceOpen(false)} project={project} />
      <ConfirmDialog
        open={Boolean(deleteTaskId)}
        onClose={() => setDeleteTaskId(null)}
        onConfirm={() => {
          if (!deleteTaskId) return;
          try {
            store.deleteTask(project.id, deleteTaskId);
            toast('Task deleted.', 'info');
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Could not delete task.', 'error');
          }
        }}
        title="Delete this task?"
        confirmLabel="Delete task"
        tone="danger"
      >
        <p>Deleting a task removes it from the project. It is not a consent event and is not recorded in the audit log.</p>
      </ConfirmDialog>
    </div>
  );
}

function ProjectFormModal({
  open,
  onClose,
  mode,
  project,
  initialCommunityId,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  project?: Project;
  initialCommunityId?: string;
}) {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const communities = myCommunities(data, settings.actorId);
  const defaultCommunity = project?.communityId || initialCommunityId || communities[0]?.id || '';
  const [form, setForm] = useState({
    communityId: defaultCommunity,
    title: project?.title ?? '',
    summary: project?.summary ?? '',
    objective: project?.objective ?? '',
    status: (project?.status ?? 'active') as ProjectStatus,
    targetDate: project ? toLocalInput(project.targetDate) : '',
    outcomes: project?.outcomes ?? '',
    lessons: project?.lessons.join('\n') ?? '',
    participants: project?.participants ?? [],
  });
  const [error, setError] = useState('');
  const selectedCommunity = data.communities.find((c) => c.id === form.communityId);
  const directory = selectedCommunity
    ? visibleDirectory(data, settings.actorId, selectedCommunity)
    : [];
  const participantOptions = directory.filter((entry) => entry.membership.personId !== settings.actorId);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    setError('');
    try {
      if (mode === 'create') {
        const id = store.createProject({
          communityId: form.communityId,
          title: form.title,
          summary: form.summary,
          objective: form.objective,
          targetDate: form.targetDate ? fromLocalInput(form.targetDate) : undefined,
          participantIds: form.participants,
        });
        toast('Project created. The first task is up to you.');
        onClose();
        navigate(`projects/${id}`);
      } else if (project) {
        store.updateProject(project.id, {
          title: form.title,
          summary: form.summary,
          objective: form.objective,
          status: form.status,
          targetDate: form.targetDate ? fromLocalInput(form.targetDate) : '',
          outcomes: form.outcomes,
          lessons: form.lessons.split('\n').map((l) => l.trim()).filter(Boolean),
        });
        store.updateParticipants(project.id, form.participants);
        toast('Project updated.');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the project.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Start a project' : 'Edit project'}
      description="An objective and a few concrete tasks beat an ambitious mission statement."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={submit}>
            {mode === 'create' ? 'Create project' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {error ? <FormError>{error}</FormError> : null}
        {mode === 'create' ? (
          <Field label="Community" htmlFor="p-community" required>
            <select
              id="p-community"
              className="select"
              value={form.communityId}
              onChange={(event) => {
                set('communityId', event.target.value);
                set('participants', []);
              }}
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
        <Field label="Title" htmlFor="p-title" required>
          <input
            id="p-title"
            className="input"
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            maxLength={160}
            placeholder="e.g. Restore the lower hedge"
          />
        </Field>
        <Field label="Summary" htmlFor="p-summary" required>
          <textarea
            id="p-summary"
            className="textarea"
            rows={2}
            value={form.summary}
            onChange={(event) => set('summary', event.target.value)}
            placeholder="One or two sentences a neighbour could understand."
          />
        </Field>
        <Field label="Objective" htmlFor="p-objective" required hint="What would count as done?">
          <textarea
            id="p-objective"
            className="textarea"
            rows={3}
            value={form.objective}
            onChange={(event) => set('objective', event.target.value)}
          />
        </Field>
        {mode === 'edit' ? (
          <>
            <div className="form-row">
              <Field label="Status" htmlFor="p-status">
                <select
                  id="p-status"
                  className="select"
                  value={form.status}
                  onChange={(event) => set('status', event.target.value as ProjectStatus)}
                >
                  {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Target date" htmlFor="p-target">
                <input
                  id="p-target"
                  type="date"
                  className="input"
                  value={form.targetDate}
                  onChange={(event) => set('targetDate', event.target.value)}
                />
              </Field>
            </div>
            <Field label="Outcomes" htmlFor="p-outcomes">
              <textarea
                id="p-outcomes"
                className="textarea"
                rows={2}
                value={form.outcomes}
                onChange={(event) => set('outcomes', event.target.value)}
              />
            </Field>
            <Field label="Lessons learned" htmlFor="p-lessons" hint="One per line.">
              <textarea
                id="p-lessons"
                className="textarea"
                rows={2}
                value={form.lessons}
                onChange={(event) => set('lessons', event.target.value)}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Target date" htmlFor="p-target-create">
              <input
                id="p-target-create"
                type="date"
                className="input"
                value={form.targetDate}
                onChange={(event) => set('targetDate', event.target.value)}
              />
            </Field>
            <div className="field">
              <span className="field-label">Participants</span>
              {participantOptions.length === 0 ? (
                <p className="muted small">
                  No other members are listed in the directory. You can add participants later.
                </p>
              ) : (
                <div className="check-grid">
                  {participantOptions.map(({ membership: entry, person }) =>
                    person ? (
                      <label className="check" key={entry.personId}>
                        <input
                          type="checkbox"
                          checked={form.participants.includes(entry.personId)}
                          onChange={(event) =>
                            set(
                              'participants',
                              event.target.checked
                                ? [...form.participants, entry.personId]
                                : form.participants.filter((id) => id !== entry.personId),
                            )
                          }
                        />
                        <span>{person.name}</span>
                      </label>
                    ) : null,
                  )}
                </div>
              )}
              <div className="field-hint">
                Only members who opted into the directory are listed. Adding someone does not grant
                them knowledge access; community membership does that.
              </div>
            </div>
          </>
        )}
        {mode === 'edit' ? (
          <div className="field">
            <span className="field-label">Participants</span>
            <p className="muted small">
              {project
                ? `${project.participants.length} participants. Participant management is kept simple in this prototype.`
                : ''}
            </p>
          </div>
        ) : null}
        <Notice tone="quiet" icon="project">
          A project is a coordination tool. It does not create a new sharing scope; linked knowledge
          keeps its own scope.
        </Notice>
      </div>
    </Modal>
  );
}

function TaskModal({
  open,
  onClose,
  project,
  participants,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  participants: string[];
}) {
  const { store, snapshot } = useApp();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    setError('');
    try {
      store.addTask(project.id, {
        title,
        detail,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      toast('Task added.');
      setTitle('');
      setDetail('');
      setAssigneeId('');
      setDueDate('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the task.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a task"
      description={`For ${project.title}. Keep it small enough to finish and clear enough to check.`}
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="plus" onClick={submit}>
            Add task
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {error ? <FormError>{error}</FormError> : null}
        <Field label="Task" htmlFor="task-title" required>
          <input
            id="task-title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder="e.g. Measure the overflow after rain"
          />
        </Field>
        <Field label="Detail" htmlFor="task-detail">
          <textarea
            id="task-detail"
            className="textarea"
            rows={3}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
          />
        </Field>
        <div className="form-row">
          <Field label="Assignee" htmlFor="task-assignee">
            <select
              id="task-assignee"
              className="select"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">Unassigned</option>
              {participants.map((id) => (
                <option key={id} value={id}>
                  {personName(snapshot.data, id)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date" htmlFor="task-due">
            <input
              id="task-due"
              type="date"
              className="input"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function LinkKnowledgeModal({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
}) {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const readable = snapshot.data.knowledge
    .filter((k) => canRead(snapshot.data, snapshot.settings.actorId, k))
    .filter((k) => !project.knowledgeIds.includes(k.id))
    .sort((a, b) => a.title.localeCompare(b.title));
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');

  const link = () => {
    setError('');
    try {
      if (!selected) throw new Error('Choose a record to link.');
      store.linkKnowledgeToProject(project.id, selected);
      toast('Knowledge linked. Its sharing scope is unchanged.');
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
      title="Link a knowledge record"
      description="Only records you can already read are listed. Linking does not change who can read them."
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="link" onClick={link}>
            Link record
          </Button>
        </>
      }
    >
      <div className="stack-tight">
        {error ? <FormError>{error}</FormError> : null}
        <Field label="Knowledge record" htmlFor="project-link-record" required>
          <select
            id="project-link-record"
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
            There are no unlinked records you can read. Create a project note or ask a member to
            share a record with a compatible scope.
          </p>
        ) : null}
        <Notice tone="quiet" icon="link">
          A project link is not a permission grant, and it is not a relation of trust. Access is
          still decided by the record’s scope.
        </Notice>
      </div>
    </Modal>
  );
}

function ResourceModal({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
}) {
  const { store } = useApp();
  const toast = useToast();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [secured, setSecured] = useState(false);
  const [error, setError] = useState('');

  const submit = () => {
    setError('');
    try {
      store.addProjectResource(project.id, name, note, secured);
      toast('Resource added.');
      setName('');
      setNote('');
      setSecured(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the resource.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a material or resource"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="plus" onClick={submit}>
            Add resource
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {error ? <FormError>{error}</FormError> : null}
        <Field label="Resource" htmlFor="resource-name" required>
          <input
            id="resource-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Hazel stakes"
          />
        </Field>
        <Field label="Note" htmlFor="resource-note">
          <textarea
            id="resource-note"
            className="textarea"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={secured}
            onChange={(event) => setSecured(event.target.checked)}
          />
          <span>Already secured</span>
        </label>
      </div>
    </Modal>
  );
}
