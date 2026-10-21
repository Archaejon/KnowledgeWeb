# Architecture

Understory is a single-page, local-first node. The UI never owns data or access
decisions: it reads a store snapshot and calls store methods. This document
describes the boundaries a second implementation (or a future network node)
should preserve.

## Layers

```
pages / components        presentation only
        │  snapshot + commands
store-context / store.ts  local node service: validation, writes, audit
        │
access.ts / consent.ts    the access engine (single source of truth)
        │
types.ts / storage.ts     versioned data + replaceable persistence
        │
ai/adapter.ts             optional model boundary
network.ts                graph projection (no transport)
```

### Presentation

React components render whatever the access engine allows. They do not filter
records privately and must not be trusted to enforce anything. Hiding a button is
a usability choice, never a security measure.

### Local node service

`NodeStore` is the only writer. Every command:

1. clones the current data,
2. checks the acting identity and validates input,
3. applies the change,
4. appends a consent event where relevant,
5. persists through the `StorageAdapter`,
6. publishes a new immutable snapshot.

Invalid input throws a user-facing error and leaves state unchanged. The store
also records diagnostic events without copying private content into them.

### Access engine

`core/access.ts` decides what a viewer may read:

- **private**: author only.
- **relationship**: author plus every active bilateral partner. Access is
  all-or-nothing; there is no per-record or per-person partial level.
- **community**: only when an **active** group agreement exists for that
  community and the viewer is a named participant who accepted it. Membership
  alone is never enough.
- **public**: any participant on this node.

The same functions are called by knowledge lists, detail views, search, exports,
observation charts, project/gathering knowledge panels and AI context assembly.
`tests/access.test.ts` covers the important allow/deny paths.

### Consent state

`core/consent.ts` derives relationship state:

- A relationship is `active` only when both sides accepted the same record.
- A pending invitation is an administrative record. It grants no read access in
  either direction.
- Declining or revoking ends access immediately. A later proposal creates a new
  record rather than silently reactivating the old one, so history remains
  legible.
- A group agreement stores the exact required participants and their responses.
  It is active only when every required response is `accepted`. One decline
  keeps it inactive. A community does not inherit access to members' other
  relationships or communities.

### Data model

`core/types.ts` defines the schema (`SCHEMA_VERSION = 1`). Every shareable
record carries `authorId`, `scope` and an optional `communityId`. References are
by stable string IDs. `core/validation.ts` checks the full persisted shape,
schema version, required fields, rank enums and referential integrity before a
backup is restored.

New fields should be additive where possible and accompanied by a schema bump
and migration when the shape changes.

### Nodal locations

A nodal location is a `Place` with an optional `nodal` block rather than a
separate top-level collection. This keeps one venue record usable by
observations, knowledge and gatherings while adding directory fields:

```ts
interface NodalDetails {
  kind: 'gathering-spot' | 'community-centre' | 'commune'
      | 'workshop' | 'learning-space' | 'other';
  description: string;
  accessNotes: string;
  visibility: 'public' | 'community' | 'private';
  themes: string[];
  capacity?: number;
  contactId?: ActorId;
}
```

Two independent rules apply, which is easy to conflate:

- **Directory visibility** (`canViewNodalLocation`) decides whether the venue
  record exists for a viewer. `public` is open, `community` requires active
  membership, and `private` is owner-only.
- **Coordinate policy** (`canViewCoordinates`) decides whether the map position
  and exact coordinates are shown. It is unchanged and still applies to the
  same place record.

A gathering may reference `nodalLocationId`, but only if the planner can
currently see that venue. `updateNodalLocation` is owner-only, and community
visibility cannot be saved without a linked community. Themes are normalised to
lowercase, de-duplicated and capped at eight, and capacity is rounded and range
checked in the store.

### Persistence

`StorageAdapter` is the only storage dependency:

```ts
interface StorageAdapter {
  readonly kind: string;
  load(): string | null;
  save(value: string): void;
  clear(): void;
}
```

`LocalStorageAdapter` is used when available; `MemoryStorageAdapter` keeps the
app working when storage is blocked. A desktop node, SQLite daemon or encrypted
file store can implement the same interface without changing the store or UI.

## The network map

`core/network.ts` builds a permission-aware projection of the local data. It
includes the acting identity, people they already know, shared communities,
visible projects, active/pending/declined relationship edges, community
membership edges and inter-community agreement edges. It never draws another
person's bilateral relationships.

Rendering and interaction live in `components/NetworkGraph.tsx`:

- Force-directed layout runs once per graph change and produces a stable base
  position for every node.
- The user can drag a node. The offset from its base position is stored in
  `localStorage` under `understory:graph-layout:<actorId>` (UI preference only,
  never in the node data or consent record).
- Dragging the ground pans a camera; the wheel zooms around the pointer; the
  controls zoom, fit, recentre and reset the layout.
- Positions are presentation. Distance, clustering and edge lines never imply
  trust, authority or knowledge quality. The caption says so.

Keyboard: tab to a node, `Enter` inspects it, `Alt` + arrows nudges it.

## Optional AI

`core/ai/adapter.ts` is deliberately small:

```ts
probe(options): Promise<AiProbeResult>
ask(question, records, options): Promise<AiAnswer>
```

Callers assemble `records` from `visibleKnowledge` (or a narrower authorised
set) **before** calling the adapter. The adapter cannot fetch more data. Answers
carry citations to record IDs. `ask` accepts an `AbortSignal` and timeout, and
the UI keeps a cancellation path and a non-AI fallback.

`core/ai/ollama.ts` posts to a local Ollama instance. No model is bundled or
downloaded. CORS must be enabled for the app origin if the browser talks to
Ollama directly (for example `OLLAMA_ORIGINS=http://127.0.0.1:5178`). A hosted
deployment would normally put this behind a server-side proxy.

## Future transport boundary

There is **no** peer-to-peer networking yet. The intended seam is:

1. A transport adapter that carries signed, versioned envelopes between nodes.
2. A sync engine that exchanges only records covered by an active relationship
   or group agreement.
3. A local outbox for offline changes, with retry and conflict metadata.
4. Optional store-and-forward relays that cannot read payloads.

Those pieces do not exist. Until they do, the app must not claim decentralised
synchronisation, encryption or authentication. A real implementation also needs
authenticated remote identities, key rotation, replay protection and a
server-side enforcement point.

## Deployment shape

`npm run build` emits static assets. Any static host can serve them because the
router uses the URL hash. A production node would add:

- a small server or daemon that owns the database and enforces access checks on
  authenticated sessions,
- TLS and secure headers,
- encrypted backups with tested recovery,
- structured logs that exclude private content,
- a documented API for inter-node agreements.

The current UI labels prototype-only features (simulated identities, no remote
transport, no encryption) rather than presenting them as complete.
