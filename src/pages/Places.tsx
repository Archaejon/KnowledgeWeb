import { useEffect, useMemo, useState } from 'react';
import {
  canViewCoordinates,
  coordsLabel,
  personName,
} from '../core/access';
import { daysAgo, formatDate, fromLocalInput, toLocalInput } from '../core/dates';
import { OBSERVATION_METRICS } from '../core/labels';
import {
  myCommunities,
  myProjects,
  observationSeries,
  placesWithVisibleData,
  summarizeObservations,
} from '../core/selectors';
import type { Observation, ObservationKind, Place, Scope } from '../core/types';
import { useApp } from '../store-context';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { TrendChart } from '../components/TrendChart';
import {
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

type Period = '90' | '365' | 'all';

export function PlacesPage() {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const { observations, places } = placesWithVisibleData(data, actorId);
  const numericKinds = Array.from(
    new Set(observations.filter((o) => o.value !== null).map((o) => o.kind)),
  );
  const [metric, setMetric] = useState<ObservationKind>(
    numericKinds[0] ?? (observations[0]?.kind ?? 'water-table'),
  );
  const [placeId, setPlaceId] = useState('all');
  const [period, setPeriod] = useState<Period>('all');
  const [recordOpen, setRecordOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [editing, setEditing] = useState<Observation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const from = period === 'all' ? undefined : daysAgo(Number(period), 0);
  const filtered = observations
    .filter((o) => (placeId === 'all' ? true : o.placeId === placeId))
    .filter((o) => (from ? new Date(o.observedAt) >= new Date(from) : true))
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt));

  const metricObservations = filtered.filter((o) => o.kind === metric);
  const tableObservations = metricObservations;
  const units = Array.from(
    new Set(metricObservations.filter((o) => o.value !== null).map((o) => o.unit)),
  );
  const chartUnit = units[0] ?? OBSERVATION_METRICS[metric].unit;
  const chartObservations = metricObservations.filter(
    (o) => o.value !== null && o.unit === chartUnit,
  );
  const series = observationSeries(chartObservations, placeById);
  const summary = summarizeObservations(
    metricObservations.filter((o) => o.unit === chartUnit || chartUnit === ''),
  );
  const sensitivePlaces = places.filter(
    (place) => place.coordinatePolicy !== 'open' && canViewCoordinates(data, actorId, place),
  ).length;
  const spanLabel =
    observations.length > 0
      ? `${formatDate(
          [...observations].sort((a, b) => a.observedAt.localeCompare(b.observedAt))[0].observedAt,
        )} – ${formatDate(
          [...observations].sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0].observedAt,
        )}`
      : 'No readings';

  const observationsMarkdown = () => {
    const lines = [
      `# Community observation summary — ${OBSERVATION_METRICS[metric].label}`,
      '',
      `Generated locally from authorised records on this node, ${formatDate(new Date().toISOString())}.`,
      `Period: ${period === 'all' ? 'all visible readings' : `last ${period} days`}. Place: ${
        placeId === 'all' ? 'all visible places' : placeById.get(placeId)?.name ?? 'unknown'
      }.`,
      '',
      'This is a descriptive summary of a small, non-random sample. It is not a monitoring programme or statistical evidence.',
      '',
      ...(summary.numericCount > 0
        ? [
            `- Readings: ${summary.numericCount}`,
            `- Range: ${summary.min} – ${summary.max} ${chartUnit}`,
            `- Mean: ${summary.mean?.toFixed(2)} ${chartUnit}`,
            `- First / latest: ${summary.first} → ${summary.last} ${chartUnit} (change ${(summary.change ?? 0) > 0 ? '+' : ''}${summary.change})`,
            '',
          ]
        : ['No numeric readings in this selection.', '']),
      '## Observations',
      '',
      '| Date | Place | Value | Observer | Method |',
      '| --- | --- | --- | --- | --- |',
      ...filtered
        .filter((o) => o.kind === metric)
        .map((o) => {
          const place = placeById.get(o.placeId);
          return `| ${formatDate(o.observedAt)} | ${place?.name ?? 'Unknown'} | ${
            o.value === null ? '—' : `${o.value} ${o.unit}`
          } | ${personName(data, o.observerId)} | ${o.method.replace(/\|/g, '\\|')} |`;
        }),
      '',
      '## Places',
      '',
      ...places
        .filter((place) => filtered.some((o) => o.placeId === place.id))
        .map((place) => {
          const coords = canViewCoordinates(data, actorId, place)
            ? coordsLabel(data, actorId, place)
            : 'location withheld';
          return `- ${place.name} (${place.locality}) — ${coords}; coordinate policy: ${place.coordinatePolicy}.`;
        }),
      '',
      '_Only records you are authorised to read were included. Sharing scope is not changed by export._',
    ];
    return lines.join('\n');
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Place-based knowledge"
        title="Places"
        lede="Field observations with dates, methods and locations. Location sensitivity is explicit: precise coordinates are not assumed to be public."
        actions={
          <div className="header-actions">
            <Button variant="primary" icon="plus" onClick={() => setRecordOpen(true)}>
              Record observation
            </Button>
            <Button icon="place" onClick={() => setPlaceOpen(true)}>
              Add place
            </Button>
          </div>
        }
      />

      <div className="stat-grid compact-stats">
        <div className="stat static">
          <span className="stat-icon"><Icon name="ruler" size={18} /></span>
          <span className="stat-value">{observations.length}</span>
          <span className="stat-label">readings you can see</span>
          <span className="stat-hint">{spanLabel}</span>
        </div>
        <div className="stat static">
          <span className="stat-icon"><Icon name="place" size={18} /></span>
          <span className="stat-value">{places.length}</span>
          <span className="stat-label">places</span>
          <span className="stat-hint">{sensitivePlaces} with sensitive coordinates</span>
        </div>
        <div className="stat static">
          <span className="stat-icon"><Icon name="database" size={18} /></span>
          <span className="stat-value">{new Set(observations.map((o) => o.kind)).size}</span>
          <span className="stat-label">measurement types</span>
          <span className="stat-hint">Qualitative notes count too</span>
        </div>
        <div className="stat static">
          <span className="stat-icon"><Icon name="shield" size={18} /></span>
          <span className="stat-value">{observations.filter((o) => o.scope === 'private').length}</span>
          <span className="stat-label">private readings</span>
          <span className="stat-hint">Never shown to others</span>
        </div>
      </div>

      <Card>
        <CardHeader
          icon="ruler"
          title="Compare observations"
          subtitle="Choose a measurement, place and period. All values are filtered to what you can read before aggregation."
          action={<DownloadButton filename="community-observation-summary.md" content={observationsMarkdown()} mime="text/markdown">Export summary</DownloadButton>}
        />
        <div className="chart-controls">
          <label className="inline-field">
            <span>Measurement</span>
            <select
              className="select select-sm"
              value={metric}
              onChange={(event) => setMetric(event.target.value as ObservationKind)}
            >
              {Object.entries(OBSERVATION_METRICS).map(([kind, config]) => (
                <option key={kind} value={kind}>
                  {config.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>Place</span>
            <select
              className="select select-sm"
              value={placeId}
              onChange={(event) => setPlaceId(event.target.value)}
            >
              <option value="all">All visible places</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>Period</span>
            <select
              className="select select-sm"
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
            >
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
              <option value="all">All time</option>
            </select>
          </label>
          <span className="muted tiny">
            {filtered.filter((o) => o.kind === metric).length} readings of this type in selection
          </span>
        </div>

        {series.length === 0 || chartObservations.length === 0 ? (
          <EmptyState icon="ruler" title="No numeric readings for this selection">
            <p>
              Choose another measurement or period, or record a reading. Qualitative observations
              are listed below without a chart.
            </p>
          </EmptyState>
        ) : (
          <>
            {units.length > 1 ? (
              <Notice tone="warn" icon="alert">
                This measurement has readings in different units ({units.join(', ')}). The chart
                shows only “{chartUnit}”; the table below includes every unit. Units are not
                converted automatically.
              </Notice>
            ) : null}
            <TrendChart series={series} unit={chartUnit} />
            <div className="chart-legend">
              {series.map((s, index) => (
                <span className="chart-legend-item" key={s.id}>
                  <span
                    className="chart-swatch"
                    style={{ background: `var(--chart-${(index % 4) + 1})` }}
                    aria-hidden="true"
                  />
                  {s.label} <span className="muted tiny">({s.points.length})</span>
                </span>
              ))}
            </div>
            <div className="summary-panel">
              <h3>Descriptive summary</h3>
              <p>
                {summary.numericCount
                  ? `${summary.numericCount} readings, ${summary.min}–${summary.max} ${chartUnit}, mean ${summary.mean?.toFixed(
                      1,
                    )} ${chartUnit}. Earliest to latest changed by ${summary.change! > 0 ? '+' : ''}${summary.change} ${chartUnit}.`
                  : 'No numeric readings in this selection.'}
              </p>
              <p className="muted small">
                This is a description of a small, non-random sample, not a trend estimate or a
                substitute for a monitoring protocol. Methods and units matter; check them before
                drawing conclusions.
              </p>
            </div>
          </>
        )}
      </Card>

      <Card>
        <CardHeader
          icon="knowledge"
          title="Observation records"
          subtitle={`${OBSERVATION_METRICS[metric].label} readings behind the chart, including method, coordinates and access scope.`}
        />
        {tableObservations.length === 0 ? (
          <EmptyState
            icon="leaf"
            title="No observations match"
            action={<Button onClick={() => setRecordOpen(true)}>Record an observation</Button>}
          >
            <p>Adjust the filters or add a reading with a method and place.</p>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Observation</th>
                  <th scope="col">Place</th>
                  <th scope="col">Value</th>
                  <th scope="col">Observer</th>
                  <th scope="col">Scope</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableObservations.map((observation) => {
                  const place = placeById.get(observation.placeId);
                  const canEdit = observation.observerId === actorId;
                  return (
                    <tr key={observation.id}>
                      <td className="nowrap">{formatDate(observation.observedAt)}</td>
                      <td>
                        <strong>{observation.title}</strong>
                        <div className="muted tiny">
                          {OBSERVATION_METRICS[observation.kind].label}
                        </div>
                        <div className="muted tiny method-text">{observation.method}</div>
                        {observation.notes ? (
                          <div className="observation-note">{observation.notes}</div>
                        ) : null}
                      </td>
                      <td>
                        {place?.name ?? 'Unknown place'}
                        <div className="muted tiny">
                          {place ? coordsLabel(data, actorId, place) : ''}
                        </div>
                      </td>
                      <td className="nowrap">
                        {observation.value === null ? (
                          <span className="muted">—</span>
                        ) : (
                          <>
                            <strong>{observation.value}</strong>{' '}
                            <span className="muted tiny">{observation.unit}</span>
                          </>
                        )}
                      </td>
                      <td className="nowrap">{personName(data, observation.observerId)}</td>
                      <td>
                        <ScopeBadge scope={observation.scope} />
                      </td>
                      <td>
                        {canEdit ? (
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-btn subtle"
                              aria-label={`Edit ${observation.title}`}
                              onClick={() => {
                                setEditing(observation);
                                setRecordOpen(true);
                              }}
                            >
                              <Icon name="edit" size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn subtle"
                              aria-label={`Delete ${observation.title}`}
                              onClick={() => setDeleteId(observation.id)}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          icon="place"
          title="Places"
          subtitle="Coordinates have their own privacy policy, separate from an observation’s sharing scope."
          action={<Button size="sm" icon="plus" onClick={() => setPlaceOpen(true)}>Add place</Button>}
        />
        <div className="place-grid">
          {places.map((place) => {
            const count = observations.filter((o) => o.placeId === place.id).length;
            const community = data.communities.find((c) => c.id === place.communityId);
            return (
              <div className="place-card" key={place.id}>
                <div className="place-card-head">
                  <span className="place-pin">
                    <Icon name="mapPin" size={18} />
                  </span>
                  <div>
                    <h2>{place.name}</h2>
                    <div className="muted tiny">{place.locality}</div>
                  </div>
                  {place.coordinatePolicy !== 'open' ? (
                    <Badge tone="warning" title="Precise coordinates are restricted">
                      <Icon name="lock" size={11} /> {place.coordinatePolicy}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">open location</Badge>
                  )}
                </div>
                <p className="muted small">{place.note || 'No place note.'}</p>
                <dl className="place-meta">
                  <div>
                    <dt>Coordinates</dt>
                    <dd>{coordsLabel(data, actorId, place)}</dd>
                  </div>
                  <div>
                    <dt>Community</dt>
                    <dd>{community?.name ?? 'Not linked'}</dd>
                  </div>
                  <div>
                    <dt>Readings</dt>
                    <dd>{count} visible</dd>
                  </div>
                </dl>
                <div className="row-actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPlaceId(place.id);
                      setPeriod('all');
                      document.querySelector('.chart-controls')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Filter readings
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setPlaceId(place.id);
                      setPeriod('all');
                      setRecordOpen(true);
                    }}
                  >
                    Record here
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="muted tiny">
          Precise locations may be sensitive. A location withheld from you is not an error; it is a
          deliberate privacy choice by the observer or landowner.
        </p>
      </Card>

      <Notice tone="quiet" icon="info" title="Not a substitute for a monitoring protocol">
        These tools help communities compare what they observe and record methods. They do not
        establish scientific validity, and this prototype does not claim environmental compliance or
        research standards. Sample data is fictional.
      </Notice>

      <RecordObservationModal
        open={recordOpen}
        onClose={() => {
          setRecordOpen(false);
          setEditing(null);
        }}
        observation={editing}
        places={places}
        presetPlaceId={placeId !== 'all' ? placeId : ''}
        onAddPlace={() => setPlaceOpen(true)}
      />
      <PlaceModal
        open={placeOpen}
        onClose={() => setPlaceOpen(false)}
        onCreated={(id) => {
          setPlaceId(id);
          setPeriod('all');
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          try {
            store.deleteObservation(deleteId);
            toast('Observation deleted.', 'info');
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Could not delete observation.', 'error');
          }
        }}
        title="Delete this observation?"
        confirmLabel="Delete observation"
        tone="danger"
      >
        <p>The reading will be removed from this node and from charts and summaries.</p>
        <p className="muted small">
          Exports or notes already shared elsewhere cannot be recalled. This is a local deletion,
          not a claim of erasure across other people’s copies.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function RecordObservationModal({
  open,
  onClose,
  observation,
  places,
  presetPlaceId,
  onAddPlace,
}: {
  open: boolean;
  onClose: () => void;
  observation: Observation | null;
  places: Place[];
  presetPlaceId: string;
  onAddPlace: () => void;
}) {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const communities = myCommunities(data, settings.actorId);
  const projects = myProjects(data, settings.actorId);
  const [form, setForm] = useState({
    title: '',
    kind: 'water-table' as ObservationKind,
    value: '',
    unit: 'cm',
    observedAt: toLocalInput(new Date().toISOString()),
    placeId: presetPlaceId || places[0]?.id || '',
    method: '',
    notes: '',
    scope: 'private' as Scope,
    communityId: '',
    projectId: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (observation) {
      setForm({
        title: observation.title,
        kind: observation.kind,
        value: observation.value === null ? '' : String(observation.value),
        unit: observation.unit,
        observedAt: toLocalInput(observation.observedAt),
        placeId: observation.placeId,
        method: observation.method,
        notes: observation.notes,
        scope: observation.scope,
        communityId: observation.communityId ?? '',
        projectId: observation.projectId ?? '',
      });
    } else {
      setForm({
        title: '',
        kind: 'water-table',
        value: '',
        unit: 'cm',
        observedAt: toLocalInput(new Date().toISOString()),
        placeId: presetPlaceId || places[0]?.id || '',
        method: '',
        notes: '',
        scope: 'private',
        communityId: '',
        projectId: '',
      });
    }
    setError('');
  }, [open, observation, presetPlaceId]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    setError('');
    try {
      const numeric = form.value.trim() === '' ? null : Number(form.value);
      if (numeric !== null && Number.isNaN(numeric)) throw new Error('Value must be a number.');
      if (form.scope === 'community' && !form.communityId) {
        throw new Error('Choose the community this observation is group-shared with.');
      }
      const payload = {
        title: form.title,
        kind: form.kind,
        value: numeric,
        unit: form.unit,
        observedAt: fromLocalInput(form.observedAt),
        placeId: form.placeId,
        method: form.method,
        notes: form.notes,
        scope: form.scope,
        communityId: form.communityId || undefined,
        projectId: form.projectId || undefined,
      };
      if (observation) {
        store.updateObservation(observation.id, payload);
        toast('Observation updated.');
      } else {
        store.createObservation(payload);
        toast('Observation recorded.');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the observation.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={observation ? 'Edit observation' : 'Record an observation'}
      description="A reading without a method is hard to trust later. Note how it was measured and where."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" onClick={submit}>
            {observation ? 'Save observation' : 'Record observation'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {error ? <FormError>{error}</FormError> : null}
        {places.length === 0 ? (
          <Notice tone="warn" icon="place" title="Add a place first">
            Observations need a place, even if the location is shared only with you.{' '}
            <button type="button" className="text-button" onClick={onAddPlace}>
              Add a place
            </button>
          </Notice>
        ) : null}
        <div className="form-row">
          <Field label="Observation title" htmlFor="o-title" required>
            <input
              id="o-title"
              className="input"
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
              placeholder="e.g. Dip well reading — plot 14"
            />
          </Field>
          <Field label="Measurement type" htmlFor="o-kind">
            <select
              id="o-kind"
              className="select"
              value={form.kind}
              onChange={(event) => {
                const kind = event.target.value as ObservationKind;
                set('kind', kind);
                set('unit', OBSERVATION_METRICS[kind].unit);
              }}
            >
              {Object.entries(OBSERVATION_METRICS).map(([value, config]) => (
                <option key={value} value={value}>
                  {config.label}
                </option>
              ))}
            </select>
            <span className="field-hint">{OBSERVATION_METRICS[form.kind].description}</span>
          </Field>
        </div>
        <div className="form-row">
          <Field
            label="Value"
            htmlFor="o-value"
            hint={
              OBSERVATION_METRICS[form.kind].valueRequired
                ? 'A number. Units matter; do not convert silently.'
                : 'Optional for qualitative notes.'
            }
          >
            <input
              id="o-value"
              className="input"
              type="number"
              step="any"
              value={form.value}
              onChange={(event) => set('value', event.target.value)}
            />
          </Field>
          <Field label="Unit" htmlFor="o-unit">
            <input
              id="o-unit"
              className="input"
              value={form.unit}
              onChange={(event) => set('unit', event.target.value)}
              maxLength={30}
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Observed at" htmlFor="o-date" required>
            <input
              id="o-date"
              type="datetime-local"
              className="input"
              value={form.observedAt}
              onChange={(event) => set('observedAt', event.target.value)}
            />
          </Field>
          <Field label="Place" htmlFor="o-place" required>
            <select
              id="o-place"
              className="select"
              value={form.placeId}
              onChange={(event) => set('placeId', event.target.value)}
            >
              <option value="">Choose a place…</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="Collection method"
          htmlFor="o-method"
          required
          hint="Instrument, sampling point, repeats, datum. Be reproducible."
        >
          <textarea
            id="o-method"
            className="textarea"
            rows={2}
            value={form.method}
            onChange={(event) => set('method', event.target.value)}
            placeholder="Dip meter from top of casing, three readings averaged."
          />
        </Field>
        <Field label="Notes" htmlFor="o-notes">
          <textarea
            id="o-notes"
            className="textarea"
            rows={2}
            value={form.notes}
            onChange={(event) => set('notes', event.target.value)}
            placeholder="Anything that helps interpret the reading."
          />
        </Field>
        <div className="form-row">
          <Field label="Sharing scope" htmlFor="o-scope">
            <select
              id="o-scope"
              className="select"
              value={form.scope}
              onChange={(event) => set('scope', event.target.value as Scope)}
            >
              <option value="private">Private — only me</option>
              <option value="relationship">Relationship-shared</option>
              <option value="community">Group-shared (active agreement)</option>
              <option value="public">Public</option>
            </select>
          </Field>
          <Field
            label="Community"
            htmlFor="o-community"
            hint={
              form.scope === 'community'
                ? 'Required for group sharing.'
                : 'Optional link; does not change scope.'
            }
          >
            <select
              id="o-community"
              className="select"
              value={form.communityId}
              onChange={(event) => set('communityId', event.target.value)}
            >
              <option value="">No community</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Project" htmlFor="o-project" hint="Optional. Connects this reading to practical work.">
          <select
            id="o-project"
            className="select"
            value={form.projectId}
            onChange={(event) => set('projectId', event.target.value)}
          >
            <option value="">No project</option>
            {projects
              .filter((p) => !form.communityId || p.communityId === form.communityId)
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
          </select>
        </Field>
        <Notice tone="quiet" icon="lock">
          Location privacy is configured on the place, not here. A public observation at a
          restricted place still hides exact coordinates from people who are not authorised.
        </Notice>
      </div>
    </Modal>
  );
}

function PlaceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const communities = myCommunities(data, settings.actorId);
  const [form, setForm] = useState({
    name: '',
    locality: '',
    lat: '',
    lng: '',
    coordinatePolicy: 'community' as Place['coordinatePolicy'],
    communityId: '',
    note: '',
  });
  const [error, setError] = useState('');
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    setError('');
    try {
      const id = store.createPlace({
        name: form.name,
        locality: form.locality,
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined,
        coordinatePolicy: form.coordinatePolicy,
        communityId: form.communityId || undefined,
        note: form.note,
      });
      toast('Place added.');
      onCreated(id);
      setForm({
        name: '',
        locality: '',
        lat: '',
        lng: '',
        coordinatePolicy: 'community',
        communityId: '',
        note: '',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the place.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a place"
      description="Coordinates are optional. If they are sensitive, restrict them deliberately."
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="plus" onClick={submit}>
            Add place
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {error ? <FormError>{error}</FormError> : null}
        <Field label="Place name" htmlFor="pl-name" required>
          <input
            id="pl-name"
            className="input"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="e.g. Lower meadow pond"
          />
        </Field>
        <div className="form-row">
          <Field label="Locality" htmlFor="pl-locality">
            <input
              id="pl-locality"
              className="input"
              value={form.locality}
              onChange={(event) => set('locality', event.target.value)}
            />
          </Field>
          <Field label="Community" htmlFor="pl-community">
            <select
              id="pl-community"
              className="select"
              value={form.communityId}
              onChange={(event) => set('communityId', event.target.value)}
            >
              <option value="">No community</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Latitude" htmlFor="pl-lat" hint="Decimal degrees. Optional.">
            <input
              id="pl-lat"
              type="number"
              step="any"
              className="input"
              value={form.lat}
              onChange={(event) => set('lat', event.target.value)}
              placeholder="51.0912"
            />
          </Field>
          <Field label="Longitude" htmlFor="pl-lng" hint="Decimal degrees. Optional.">
            <input
              id="pl-lng"
              type="number"
              step="any"
              className="input"
              value={form.lng}
              onChange={(event) => set('lng', event.target.value)}
              placeholder="-3.4421"
            />
          </Field>
        </div>
        <Field
          label="Coordinate privacy"
          htmlFor="pl-policy"
          hint="This applies to every observation recorded here, regardless of that record’s sharing scope."
        >
          <select
            id="pl-policy"
            className="select"
            value={form.coordinatePolicy}
            onChange={(event) =>
              set('coordinatePolicy', event.target.value as Place['coordinatePolicy'])
            }
          >
            <option value="open">Open — visible to everyone</option>
            <option value="community">Community — active community members only</option>
            <option value="owner-only">Owner only — only observers see coordinates</option>
          </select>
        </Field>
        <Field label="Place note" htmlFor="pl-note">
          <textarea
            id="pl-note"
            className="textarea"
            rows={2}
            value={form.note}
            onChange={(event) => set('note', event.target.value)}
            placeholder="Access notes, marker description, sensitivity."
          />
        </Field>
        <Notice tone="warn" icon="shield" title="Sensitive locations remain sensitive">
          Coordinates entered here stay on this local node and are shown only to viewers allowed by
          the policy above. Public scope on an observation does not override this.
        </Notice>
      </div>
    </Modal>
  );
}
