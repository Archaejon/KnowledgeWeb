import { useEffect, useMemo, useState } from 'react';
import {
  canViewCoordinates,
  coordsLabel,
  knownPeople,
  personName,
  visibleObservations,
} from '../core/access';
import { formatDate, formatDateTime } from '../core/dates';
import {
  NODAL_KIND_HINTS,
  NODAL_KIND_LABELS,
  NODAL_VISIBILITY_LABELS,
} from '../core/labels';
import {
  knowledgeAtPlace,
  myCommunities,
  myGatherings,
  visibleNodalLocations,
} from '../core/selectors';
import type {
  NodalDetails,
  NodalLocationKind,
  NodalVisibility,
  NodeData,
  Place,
} from '../core/types';
import { parseTags } from '../core/validation';
import { Link, navigate } from '../router';
import { useApp } from '../store-context';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import {
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
} from '../components/ui';

const KIND_ICONS: Record<NodalLocationKind, IconName> = {
  'gathering-spot': 'pin',
  'community-centre': 'community',
  commune: 'home',
  workshop: 'project',
  'learning-space': 'book',
  other: 'place',
};

const KINDS: NodalLocationKind[] = [
  'gathering-spot',
  'community-centre',
  'commune',
  'workshop',
  'learning-space',
  'other',
];

type KindFilter = NodalLocationKind | 'all';

function visibilityTone(visibility: NodalVisibility) {
  return visibility === 'public' ? 'success' : visibility === 'community' ? 'accent' : 'neutral';
}

function nextGathering(data: NodeData, actorId: string, place: Place) {
  return myGatherings(data, actorId)
    .filter(
      (gathering) =>
        (gathering.nodalLocationId === place.id ||
          (!gathering.nodalLocationId && gathering.venueName === place.name)) &&
        gathering.status !== 'cancelled' &&
        new Date(gathering.startsAt).getTime() >= Date.now(),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
}

export function NodalLocationsPage({ locationId }: { locationId?: string }) {
  const { snapshot } = useApp();
  const toast = useToast();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [communityId, setCommunityId] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(locationId ?? null);

  // The hash router can change the location id without remounting this page.
  useEffect(() => {
    setDetailId(locationId ?? null);
  }, [locationId]);

  const locations = useMemo(() => visibleNodalLocations(data, actorId), [data, actorId]);
  const communities = myCommunities(data, actorId);
  const upcoming = myGatherings(data, actorId)
    .filter((gathering) => gathering.status !== 'cancelled' && new Date(gathering.startsAt) >= new Date())
    .filter((gathering) =>
      locations.some(
        (place) =>
          gathering.nodalLocationId === place.id ||
          (!gathering.nodalLocationId && gathering.venueName === place.name),
      ),
    );

  const filtered = locations.filter((place) => {
    const nodal = place.nodal!;
    if (kind !== 'all' && nodal.kind !== kind) return false;
    if (communityId !== 'all' && place.communityId !== communityId) return false;
    const haystack = [
      place.name,
      place.locality,
      nodal.description,
      nodal.accessNotes,
      ...nodal.themes,
      communities.find((c) => c.id === place.communityId)?.name ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const editing = editingId ? data.places.find((p) => p.id === editingId) : undefined;
  // Resolve the open record through the visibility filter so a stale or
  // hand-edited hash cannot reveal a place the acting identity may not see.
  const detail = detailId ? locations.find((p) => p.id === detailId) : undefined;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Physical places"
        title="Nodal locations"
        lede="Gathering spots, community centres, communes, workshops and study rooms where people meet in person and exchange ideas. A directory of places, not a feed of events."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
            Add nodal location
          </Button>
        }
      />

      <Notice tone="quiet" icon="pin" title="A place on this list is an invitation to meet, not an access claim">
        Nodal locations are physical venues. Sharing a place card does not share anyone’s knowledge,
        private coordinates or relationship access. Coordinate precision and directory visibility
        are chosen separately.
      </Notice>

      <div className="stat-grid compact-stats">
        <div className="stat static">
          <span className="stat-icon"><Icon name="pin" size={18} /></span>
          <span className="stat-value">{locations.length}</span>
          <span className="stat-label">places you can see</span>
          <span className="stat-hint">Filtered by visibility and community</span>
        </div>
        <div className="stat static">
          <span className="stat-icon"><Icon name="community" size={18} /></span>
          <span className="stat-value">
            {new Set(locations.map((place) => place.communityId).filter(Boolean)).size}
          </span>
          <span className="stat-label">communities represented</span>
          <span className="stat-hint">A venue can serve more than one purpose</span>
        </div>
        <div className="stat static">
          <span className="stat-icon"><Icon name="calendar" size={18} /></span>
          <span className="stat-value">{upcoming.length}</span>
          <span className="stat-label">gatherings coming up</span>
          <span className="stat-hint">At a nodal location you can see</span>
        </div>
        <div className="stat static">
          <span className="stat-icon"><Icon name="key" size={18} /></span>
          <span className="stat-value">
            {locations.filter((place) => place.ownerId === actorId).length}
          </span>
          <span className="stat-label">places you host</span>
          <span className="stat-hint">You can edit these listings</span>
        </div>
      </div>

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
            placeholder="Search places, themes, access notes or localities…"
            aria-label="Search nodal locations"
          />
          {query ? (
            <button type="button" className="icon-btn" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="x" size={16} />
            </button>
          ) : null}
        </div>
        <div className="search-filters">
          <label className="inline-field">
            <span>Kind</span>
            <select
              className="select select-sm"
              value={kind}
              onChange={(event) => setKind(event.target.value as KindFilter)}
            >
              <option value="all">All kinds of place</option>
              {KINDS.map((item) => (
                <option key={item} value={item}>
                  {NODAL_KIND_LABELS[item]}
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
              <option value="all">All communities</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </label>
          <span className="muted tiny">
            {filtered.length} of {locations.length} visible place{locations.length === 1 ? '' : 's'}
          </span>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon="pin" title="No nodal locations match">
            <p>
              {locations.length === 0
                ? 'No one has shared a gathering place with you yet. You can add a place you host.'
                : 'Try another kind, community or search term.'}
            </p>
          </EmptyState>
        </Card>
      ) : (
        <div className="nodal-grid">
          {filtered.map((place) => {
            const nodal = place.nodal!;
            const community = communities.find((c) => c.id === place.communityId);
            const contact = nodal.contactId ? personName(data, nodal.contactId) : '';
            const next = nextGathering(data, actorId, place);
            return (
              <Card as="article" className="nodal-card" key={place.id}>
                <div className="nodal-card-top">
                  <span className="nodal-kind">
                    <Icon name={KIND_ICONS[nodal.kind]} size={15} />
                    {NODAL_KIND_LABELS[nodal.kind]}
                  </span>
                  <Badge tone={visibilityTone(nodal.visibility)}>
                    {NODAL_VISIBILITY_LABELS[nodal.visibility]}
                  </Badge>
                </div>
                <h2>{place.name}</h2>
                <p className="nodal-place-line">
                  <Icon name="mapPin" size={13} />
                  {place.locality || 'Locality not set'}
                  {community ? ` · ${community.name}` : ''}
                </p>
                <p className="nodal-desc">{nodal.description}</p>
                {nodal.themes.length ? (
                  <div className="tag-list">
                    {nodal.themes.map((theme) => (
                      <span className="chip chip-xs" key={theme}>
                        {theme}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="nodal-facts">
                  {nodal.capacity ? (
                    <span>
                      <strong>{nodal.capacity}</strong> people
                    </span>
                  ) : null}
                  {contact ? (
                    <span>
                      Contact <strong>{contact}</strong>
                    </span>
                  ) : null}
                  <span>
                    {next ? (
                      <>
                        Next <strong>{formatDateTime(next.startsAt)}</strong>
                      </>
                    ) : (
                      'No gathering scheduled'
                    )}
                  </span>
                </div>
                <div className="row-actions nodal-card-actions">
                  <Button size="sm" onClick={() => setDetailId(place.id)}>
                    Open place
                  </Button>
                  {place.ownerId === actorId ? (
                    <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditingId(place.id)}>
                      Edit
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader
          icon="info"
          title="What makes a place nodal?"
          subtitle="A nodal location is somewhere people actually go to think together. The listing is intentionally practical, not promotional."
        />
        <div className="two-col tight-cols">
          <div>
            <h3 className="mini-heading">What belongs here</h3>
            <ul className="principle-list">
              <li>Gathering spots: a shelter, fire circle, bench, field edge or regular meeting point.</li>
              <li>Community centres, halls and shared rooms with a real booking or access route.</li>
              <li>Communes and co-living projects that explicitly welcome exchange.</li>
              <li>Workshops, repair benches, tool barns and makerspaces.</li>
              <li>Study rooms, libraries and learning spaces used by reading groups.</li>
            </ul>
          </div>
          <div>
            <h3 className="mini-heading">What this feature will not do</h3>
            <ul className="principle-list">
              <li>It does not publish precise coordinates unless the place owner chose an open policy.</li>
              <li>It does not grant access to a community’s knowledge or agreements.</li>
              <li>It does not expose a private venue to the node or rank places by popularity.</li>
              <li>It does not turn a venue into a profile for its host.</li>
            </ul>
          </div>
        </div>
      </Card>

      {addOpen || editing ? (
        <NodalFormModal
          key={editing?.id ?? 'new'}
          place={editing}
          onClose={() => {
            setAddOpen(false);
            setEditingId(null);
          }}
          onSaved={(id) => {
            setAddOpen(false);
            setEditingId(null);
            setDetailId(id);
            toast(editing ? 'Nodal location updated.' : 'Nodal location added.');
          }}
        />
      ) : null}

      <NodalDetailModal
        place={detail}
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          if (!detail) return;
          setDetailId(null);
          setEditingId(detail.id);
        }}
      />
    </div>
  );
}

function NodalDetailModal({
  place,
  open,
  onClose,
  onEdit,
}: {
  place?: Place;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { snapshot } = useApp();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  if (!open || !place?.nodal) return null;
  const nodal = place.nodal;
  const community = data.communities.find((c) => c.id === place.communityId);
  const knowledge = knowledgeAtPlace(data, actorId, place.id);
  const observations = visibleObservations(data, actorId)
    .filter((observation) => observation.placeId === place.id)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const gatherings = myGatherings(data, actorId)
    .filter(
      (gathering) =>
        gathering.nodalLocationId === place.id ||
        (!gathering.nodalLocationId && gathering.venueName === place.name),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = gatherings.filter(
    (gathering) =>
      gathering.status !== 'cancelled' && new Date(gathering.startsAt).getTime() >= Date.now(),
  );
  const past = gatherings
    .filter((gathering) => !upcoming.includes(gathering))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const isOwner = place.ownerId === actorId;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={place.name}
      description={`${NODAL_KIND_LABELS[nodal.kind]} · ${NODAL_VISIBILITY_LABELS[nodal.visibility]}`}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          {isOwner ? (
            <Button variant="primary" icon="edit" onClick={onEdit}>
              Edit place
            </Button>
          ) : null}
        </>
      }
    >
      <div className="nodal-detail">
        <div className="stack-tight">
          <p>{nodal.description}</p>
          {nodal.themes.length ? (
            <div className="tag-list">
              {nodal.themes.map((theme) => (
                <span className="chip" key={theme}>
                  {theme}
                </span>
              ))}
            </div>
          ) : null}
          <dl className="detail-list">
            <div>
              <dt>Locality</dt>
              <dd>{place.locality || 'Not set'}</dd>
            </div>
            <div>
              <dt>Community</dt>
              <dd>
                {community ? (
                  <Link to={`communities/${community.id}`}>{community.name}</Link>
                ) : (
                  'No community linked'
                )}
              </dd>
            </div>
            <div>
              <dt>Host</dt>
              <dd>{personName(data, place.ownerId)}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{nodal.contactId ? personName(data, nodal.contactId) : 'Not listed'}</dd>
            </div>
            <div>
              <dt>Capacity</dt>
              <dd>{nodal.capacity ? `${nodal.capacity} people` : 'Not stated'}</dd>
            </div>
            <div>
              <dt>Coordinates</dt>
              <dd>
                {canViewCoordinates(data, actorId, place)
                  ? coordsLabel(data, actorId, place)
                  : 'Precise location withheld'}
              </dd>
            </div>
            <div>
              <dt>Coordinate policy</dt>
              <dd>{place.coordinatePolicy.replace('-', ' ')}</dd>
            </div>
            <div>
              <dt>Directory visibility</dt>
              <dd>{NODAL_VISIBILITY_LABELS[nodal.visibility]}</dd>
            </div>
          </dl>
          <div>
            <h3 className="mini-heading">Access notes</h3>
            <p className="muted small">{nodal.accessNotes || 'No access notes have been added.'}</p>
          </div>
          {place.note ? (
            <Notice tone="quiet" icon="info" title="Location note">
              {place.note}
            </Notice>
          ) : null}
          <Notice tone="quiet" icon="shield">
            A place listing is a directory entry, not a consent record. Any knowledge shown below is
            filtered by the same access rules as the rest of the node.
          </Notice>
        </div>

        <aside className="nodal-detail-side" aria-label="Schedule and access notes">
          <div>
            <h3 className="mini-heading">Next in person ({upcoming.length})</h3>
            {upcoming.length === 0 ? (
              <p className="muted small">No upcoming gathering is linked to this place.</p>
            ) : (
              <ul className="plain-list nodal-mini-list">
                {upcoming.slice(0, 4).map((gathering) => (
                  <li key={gathering.id}>
                    <Link to={`gatherings/${gathering.id}`}>{gathering.title}</Link>
                    <span className="muted tiny">
                      {formatDateTime(gathering.startsAt)} · {gathering.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {past.length ? (
              <p className="muted tiny">Last gathering: {formatDate(past[0].startsAt)}</p>
            ) : null}
          </div>

          <div>
            <h3 className="mini-heading">Knowledge linked here ({knowledge.length})</h3>
            {knowledge.length === 0 ? (
              <p className="muted small">No readable records are linked to this place yet.</p>
            ) : (
              <ul className="plain-list nodal-mini-list">
                {knowledge.slice(0, 5).map((record) => (
                  <li key={record.id}>
                    <Link to={`knowledge/${record.id}`}>{record.title}</Link>
                    <span className="muted tiny">
                      {record.kind.replace('-', ' ')} · {personName(data, record.authorId)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mini-heading">Observations here ({observations.length})</h3>
            {observations.length === 0 ? (
              <p className="muted small">No field observations at this place.</p>
            ) : (
              <ul className="plain-list nodal-mini-list">
                {observations.slice(0, 3).map((observation) => (
                  <li key={observation.id}>
                    <span>{observation.title}</span>
                    <span className="muted tiny">
                      {formatDate(observation.observedAt)} ·{' '}
                      {observation.value === null ? observation.unit || 'note' : `${observation.value} ${observation.unit}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button size="sm" variant="ghost" onClick={() => navigate('places')}>
              Open observations
            </Button>
          </div>

          {community ? (
            <Button size="sm" variant="ghost" onClick={() => navigate(`communities/${community.id}`)}>
              Open community
            </Button>
          ) : null}
          {place.isSample ? (
            <p className="muted tiny">
              Sample data is fictional. This place does not exist. Verify any real venue before visiting.
            </p>
          ) : null}
        </aside>
      </div>
    </Modal>
  );
}

function NodalFormModal({
  place,
  onClose,
  onSaved,
}: {
  place?: Place;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { snapshot, store } = useApp();
  const { data, settings } = snapshot;
  const actorId = settings.actorId;
  const communities = data.communities.filter((community) =>
    community.members.some((member) => member.personId === actorId && member.status === 'active'),
  );
  const contacts = knownPeople(data, actorId);
  const initial = place?.nodal;
  const [form, setForm] = useState({
    name: place?.name ?? '',
    kind: (initial?.kind ?? 'gathering-spot') as NodalLocationKind,
    locality: place?.locality ?? '',
    communityId: place?.communityId ?? '',
    description: initial?.description ?? '',
    themes: initial?.themes.join(', ') ?? '',
    accessNotes: initial?.accessNotes ?? '',
    capacity: initial?.capacity ? String(initial.capacity) : '',
    contactId: initial?.contactId ?? '',
    visibility: (initial?.visibility ?? 'private') as NodalVisibility,
    lat: place?.lat !== undefined ? String(place.lat) : '',
    lng: place?.lng !== undefined ? String(place.lng) : '',
    coordinatePolicy: (place?.coordinatePolicy ?? 'community') as Place['coordinatePolicy'],
    note: place?.note ?? '',
  });
  const [error, setError] = useState('');
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const submit = () => {
    setError('');
    try {
      const nodal: NodalDetails = {
        kind: form.kind,
        description: form.description,
        accessNotes: form.accessNotes,
        visibility: form.visibility,
        themes: parseTags(form.themes),
        capacity: form.capacity ? Number(form.capacity) : undefined,
        contactId: form.contactId || undefined,
      };
      const payload = {
        name: form.name,
        locality: form.locality,
        communityId: form.communityId || undefined,
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined,
        coordinatePolicy: form.coordinatePolicy,
        note: form.note,
        nodal,
      };
      if (place) {
        store.updateNodalLocation(place.id, payload);
        onSaved(place.id);
      } else {
        const id = store.createPlace(payload);
        onSaved(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this nodal location.');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={place ? 'Edit nodal location' : 'Add a nodal location'}
      description="Describe a real place where people meet. Be specific about access and honest about what the listing does not promise."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={place ? 'check' : 'plus'} onClick={submit}>
            {place ? 'Save changes' : 'Add nodal location'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {error ? <FormError>{error}</FormError> : null}
        <div className="form-row">
          <Field label="Place name" htmlFor="nl-name" required>
            <input
              id="nl-name"
              className="input"
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="e.g. Hollowcombe village hall"
              maxLength={160}
            />
          </Field>
          <Field label="Kind of nodal place" htmlFor="nl-kind" required hint={NODAL_KIND_HINTS[form.kind]}>
            <select
              id="nl-kind"
              className="select"
              value={form.kind}
              onChange={(event) => set('kind', event.target.value as NodalLocationKind)}
            >
              {KINDS.map((item) => (
                <option key={item} value={item}>
                  {NODAL_KIND_LABELS[item]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Locality" htmlFor="nl-locality">
            <input
              id="nl-locality"
              className="input"
              value={form.locality}
              onChange={(event) => set('locality', event.target.value)}
              placeholder="Village, neighbourhood or area"
              maxLength={120}
            />
          </Field>
          <Field label="Community" htmlFor="nl-community" hint="Optional. Needed for community visibility.">
            <select
              id="nl-community"
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
        <Field
          label="What happens here?"
          htmlFor="nl-description"
          required
          hint="Describe the place and the kind of exchange it supports. Avoid marketing language."
        >
          <textarea
            id="nl-description"
            className="textarea"
            rows={3}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder="A field shelter above the ford. Used after fieldwork for laying out notes, comparing finds and deciding what to record."
            maxLength={2000}
          />
        </Field>
        <Field label="Themes" htmlFor="nl-themes" hint="Comma-separated. What ideas or work bring people here?">
          <input
            id="nl-themes"
            className="input"
            value={form.themes}
            onChange={(event) => set('themes', event.target.value)}
            placeholder="field notes, fungi, oral history"
          />
        </Field>
        <Field label="Access notes" htmlFor="nl-access" hint="Step-free access, booking, season, parking, quiet hours, who to ask.">
          <textarea
            id="nl-access"
            className="textarea"
            rows={3}
            value={form.accessNotes}
            onChange={(event) => set('accessNotes', event.target.value)}
            placeholder="Book through June. Step-free side entrance, hearing loop, kitchen. No fixed fee."
            maxLength={800}
          />
        </Field>
        <div className="form-row">
          <Field label="Capacity" htmlFor="nl-capacity" hint="Approximate number of people the place can hold.">
            <input
              id="nl-capacity"
              className="input"
              type="number"
              min={1}
              max={10000}
              value={form.capacity}
              onChange={(event) => set('capacity', event.target.value)}
            />
          </Field>
          <Field label="Contact person" htmlFor="nl-contact" hint="Someone who can answer practical questions.">
            <select
              id="nl-contact"
              className="select"
              value={form.contactId}
              onChange={(event) => set('contactId', event.target.value)}
            >
              <option value="">No contact listed</option>
              {contacts.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} ({person.handle})
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="Who can see this place card?"
          htmlFor="nl-visibility"
          required
          hint={
            form.visibility === 'community' && !form.communityId
              ? 'Choose a community first, or switch to private/public.'
              : 'This controls the directory listing, not knowledge access or exact coordinates.'
          }
        >
          <select
            id="nl-visibility"
            className="select"
            value={form.visibility}
            onChange={(event) => set('visibility', event.target.value as NodalVisibility)}
          >
            <option value="private">Only me — I am still checking this place</option>
            <option value="community">Active members of the linked community</option>
            <option value="public">Everyone using this node</option>
          </select>
        </Field>
        <div className="form-row">
          <Field label="Latitude" htmlFor="nl-lat" hint="Decimal degrees. Optional.">
            <input
              id="nl-lat"
              className="input"
              type="number"
              step="any"
              value={form.lat}
              onChange={(event) => set('lat', event.target.value)}
              placeholder="51.0874"
            />
          </Field>
          <Field label="Longitude" htmlFor="nl-lng" hint="Decimal degrees. Optional.">
            <input
              id="nl-lng"
              className="input"
              type="number"
              step="any"
              value={form.lng}
              onChange={(event) => set('lng', event.target.value)}
              placeholder="-3.4451"
            />
          </Field>
        </div>
        <Field label="Coordinate privacy" htmlFor="nl-policy">
          <select
            id="nl-policy"
            className="select"
            value={form.coordinatePolicy}
            onChange={(event) =>
              set('coordinatePolicy', event.target.value as Place['coordinatePolicy'])
            }
          >
            <option value="open">Open — exact coordinates visible to everyone</option>
            <option value="community">Community — active members only</option>
            <option value="owner-only">Owner only — no one else sees exact coordinates</option>
          </select>
        </Field>
        <Field label="Location note" htmlFor="nl-note">
          <textarea
            id="nl-note"
            className="textarea"
            rows={2}
            value={form.note}
            onChange={(event) => set('note', event.target.value)}
            placeholder="Which entrance, what to avoid, how to find the place."
            maxLength={500}
          />
        </Field>
        <Notice tone="warn" icon="shield" title="Consent still applies">
          The place card is not a shortcut to community knowledge or a bilateral relationship. If a
          gathering is held here, its knowledge links are still filtered by normal access rules.
        </Notice>
      </div>
    </Modal>
  );
}
