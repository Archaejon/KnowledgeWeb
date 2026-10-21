# Understory

A local-first, consent-based knowledge exchange node for real-world communities.
Understory holds knowledge, gatherings, practical work and place observations for
communities that meet in person. It is not a feed, a social graph or an
engagement product.

This repository is a **working local prototype**: every screen is connected to
the same data model and access engine, but identities, transport and keys are
simulated. Read [Prototype boundaries](#prototype-boundaries) before relying on
it for anything sensitive.

## What works

- Local node identity and an acting-identity switcher for demonstrating the
  consent model from different points of view.
- Knowledge records with scopes, tags, provenance, version history, links to
  communities/projects/gatherings/places, search, Markdown export and full
  JSON backup/restore.
- **Files and voice notes** on any knowledge record: attach files of any format,
  or record a voice note in the browser for a text record. Both are stored inside
  the record, inherit its sharing scope, and travel with it in backups and
  Markdown exports. Recordings can be transcribed by an optional local
  Whisper-compatible service; transcripts are searched, exported and available to
  the AI assistant. See [docs/knowledge-attachments.md](docs/knowledge-attachments.md).
- Binary bilateral relationships with explicit invitations, review, acceptance,
  decline and revocation. Pending invitations grant no access.
- Community-wide group agreements that activate only when every named
  participant accepts, plus an explicit declined example in the sample data.
- Community spaces, gatherings (RSVP, agenda, outcomes, `.ics` export) and
  projects with tasks, participants, resources, notes and progress.
- **Nodal locations**: a directory of the physical places where exchange happens
  — gathering spots, community centres, communes, workshops and learning
  spaces. Each has access notes, capacity, themes, a contact and a visibility
  setting, and links to its community, knowledge, gatherings and observations.
  Gatherings can use a nodal location as their venue.
- Place-based observations with privacy-aware locations, comparison, charts and
  a descriptive research summary.
- An interactive network map built from live data. Pan the ground, scroll or use
  the controls to zoom, drag nodes to rearrange the map, and use **Reset layout**
  to return to the automatic arrangement. Node positions are stored per acting
  identity in this browser only; they never affect consent or membership.
- Three complete visual themes (Web, Tree, Mycelium) with their own backgrounds
  (orb web over graph paper, growth rings and bark grain, branching hyphae and
  spores), typefaces, ink, card edges and graph treatment. Theme changes
  crossfade smoothly, and type metrics stay constant so content does not jump.
  Theme choice persists with the node settings.
- Optional AI adapter that is off by default and never receives records the
  acting identity cannot read. Local search works without a model.

The sample data is fictional and labelled as such. Use **Node settings → Reset
sample data** to restore it.

## Files, voice and transcription

Attachments are base64 inside the record, which keeps a local backup to a single
file and means a file can never outlive or leak past its record. Browser storage
is finite, so the limits are enforced before writing: 1.5 MB per file, 2.5 MB and
six items per record, 3 MB of attachments for the whole node. Voice notes are
captured with `MediaRecorder` (webm/opus, or mp4 where that is what the browser
supports) and never leave the browser during recording.

Transcription is opt-in and off by default. Point **Node settings → Optional AI**
at a local OpenAI-compatible speech endpoint (whisper.cpp's server,
faster-whisper, LocalAI) and name its model; without that, the Transcribe button
is disabled and explains why. Nobody but the author can add a transcript, and
transcripts are only produced when the author presses Transcribe. The full
boundary, failure modes and gaps are in
[docs/knowledge-attachments.md](docs/knowledge-attachments.md).

## Accessibility

Every route is audited against WCAG 2.2 AA in all three themes. The current
state, the fixes that were needed and the remaining limits are recorded in
[docs/accessibility-audit.md](docs/accessibility-audit.md).

In short: skip link, per-route document titles, focus moved to the main region on
navigation, labelled landmarks, roving radiogroups for the theme pickers, 24 px
minimum targets, reduced-motion support, dialogs portalled out of the app with
the background `inert` while they are open, and text/background pairs that clear
4.5:1 after the per-theme grain and texture layers. The audit is repeatable with
the scripts in `.tooling/` while the dev server and a Chromium CDP endpoint are
running.

## Quick start

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5178>. The app uses hash routing, so it also works when
served from a subdirectory or opened from a static file server.

```bash
npm test        # unit tests for consent, access, network and store rules
npm run build   # typecheck + production build into dist/
npm run preview # serve the production build at http://127.0.0.1:4178
npm run typecheck
```

## Continuous integration

[`.forgejo/workflows/ci.yml`](.forgejo/workflows/ci.yml) runs on every push and
pull request through Forgejo Actions. It installs from the lockfile, then runs
`npm run typecheck`, `npm test` and `npm run build` on Node 22, using Codeberg's
`codeberg-small` hosted runner (2 CPU, 4 GB, five minutes). A clean install of the
same four commands passes locally, so a green run should reflect the repository
rather than the machine.

Two repository settings are needed before checks appear:

- **Settings → Units → Overview → Enable Actions.** Actions are disabled by
default.
- Codeberg's hosted runners are limited to public, free-licensed projects, so the
repository must be public and carry its AGPL-3.0 license file.

The browser audit harness under `.tooling/` is deliberately not part of CI: it
needs a running dev server and a Chromium debugging endpoint, which the hosted
runner's sandbox and five-minute budget do not provide.

## Project layout

```
src/
  App.tsx, router.tsx, store-context.tsx   shell, routing, store binding
  core/
    types.ts        versioned data model (schemaVersion = 1)
    sample.ts       clearly fictional demonstration data
    store.ts        local node service: validation, writes, audit log
    access.ts       the single access engine used by every read path
    consent.ts      relationship and group-agreement rules
    network.ts      graph projection from permitted data
    search.ts       lexical search over already-authorised records
    selectors.ts    view helpers
    storage.ts      replaceable StorageAdapter (localStorage / memory)
    validation.ts   runtime validation for imports and persisted state
    ai/             optional adapter boundary and Ollama implementation
  components/       UI primitives, layout, network map, consent dialogs
  pages/            Home, Network, Communities, Nodal locations, Gatherings,
                    Projects, Knowledge, Places, Settings, Appearance, About
  styles/app.css    tokens, layout, themes and the interactive map
.forgejo/workflows/ci.yml  typecheck, tests and build on every push
tests/              Vitest unit tests
docs/               architecture, threat model and attachment notes
```

## Data, privacy and backup

All data lives under the browser localStorage key `understory.node.v1` on this
device. The prototype has no server, account, telemetry or remote database.
Local storage is plaintext and typically limited to about 5 MB, so treat the
browser profile as sensitive.

- **Node settings → Export and backup** writes a complete JSON backup. It
  includes private knowledge; store it accordingly.
- **Restore backup** validates the file (schema version, closed object shapes,
  referential integrity, safe URLs) before replacing the node.
- **Knowledge export** writes only records the acting identity can read.
- Resetting or clearing site data deletes the node. Export first.

## Configuration

Only optional local AI needs configuration, in **Node settings → AI**:

- Provider: Ollama (the adapter is intentionally replaceable).
- Endpoint: default `http://127.0.0.1:11434`.
- Model: default `llama3.2:3b`, entered explicitly by the user.

No model is downloaded automatically, and the app never waits on AI for core
features. If the endpoint is unavailable or times out, the assistant reports it
and local search remains available. Browser CORS settings on the Ollama server
must allow this origin; see `docs/architecture.md`.

## Deployment

The build output is a static SPA. Any static host can serve `dist/`:

```bash
npm run build
# copy dist/ to a static host, or run: npx serve dist
```

Because routing is hash-based, no server rewrite rules are required. There is no
backend to deploy. `docs/architecture.md` describes what a real node service
would need to add.

## Prototype boundaries

These are deliberate, documented limits, not hidden mock behaviour:

- Identities are local records. The acting-identity switcher is a demonstration
  tool, **not authentication**. There is no signature verification or key
  exchange. The key fingerprints shown in the UI are simulated labels.
- Access checks are enforced by the local service and access engine on every
  read path in this app (lists, detail views, search, exports, charts, AI
  context). A multi-user deployment must run the same checks server-side on
  authenticated sessions.
- There is no peer-to-peer transport, relay, federation, offline queue or
  encryption yet. The UI and docs say so. `core/network.ts` is a projection of
  local data, not a live network.
- Revocation blocks future access here and removes cached content from active
  views. It cannot recall independently exported, copied or memorised material,
  and the app never claims otherwise.
- Local storage is not encrypted at rest and backups are manual.
- The three themes change presentation only. They never change data, consent,
  access or navigation.

For a fuller account, see [docs/architecture.md](docs/architecture.md) and
[docs/threat-model.md](docs/threat-model.md).

## Licence

AGPL-3.0-or-later. The prototype is intended to be inspectable, forkable and
self-hostable.
