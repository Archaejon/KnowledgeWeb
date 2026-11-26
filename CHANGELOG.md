# Changelog

All notable changes to Understory are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html) with the caveat in
[docs/releases.md](docs/releases.md): the major version stays at 0 until real
identities, transport and encryption exist.

## [Unreleased]

### Added

- Live connections between two nodes. **Connect → Create my node** makes a
  real Ed25519 identity (private key non-extractable, kept in IndexedDB and out
  of backups). An invite link carries the inviter's key and a room secret in
  the URL fragment; the friend accepts, the inviter confirms the friend's key
  fingerprint, and the two browsers then exchange relationship- and
  public-scoped knowledge over a direct WebRTC channel (trystero, signalling
  over public Nostr relays). Every connection proves both keys; incoming
  records are re-validated; ending a connection removes held copies on both
  sides. See [docs/live-connections.md](docs/live-connections.md).
- **Connect** in the navigation, including the mobile bar (Communities moves
  under **More** on phones).
- The Connect page shows how many signalling relays are reachable, warns when
  none are, says whether a waiting partner is online, and offers a short
  "Not connecting?" checklist.

<!-- The two storage entries below describe work built in October whose source
     is being recovered; it is not yet in this branch. -->
- Optional passphrase encryption at rest. Turning it on in **Node settings →
  Storage & backup** rewrites the node as an AES-GCM-256 envelope under a key
  derived from the passphrase with PBKDF2-SHA-256 (310,000 iterations, random
  salt, a fresh IV on every write). Start-up then asks for the passphrase before
  anything loads. The passphrase is not stored anywhere, so a forgotten one
  cannot be recovered, and **Remove encryption** writes the plain node back.
- Encrypted backups: **Encrypted backup (.json)** asks for a passphrase at
  export time, which may differ from the node passphrase, and restoring one asks
  for it before the file is validated.

### Changed

- The project moved from Codeberg to GitHub: CI runs on GitHub Actions, and
  every green push to `main` is published to GitHub Pages at
  <https://archaejon.github.io/KnowledgeWeb/>.
- Node data now lives in IndexedDB instead of localStorage. Attachments grow
  from 3 MB to 40 MB for the whole node, 8 MB per file and 12 MB per record.
  A node saved under the old localStorage key is moved across on first start,
  and the old copy is only removed once the new one has committed. localStorage
  (3 MB budget) and memory remain fallbacks when IndexedDB cannot be opened.
- Backups of a node full of attachments can be restored: the import limit rises
  from 8 MB to 96 MB.

### Fixed

- Connections now use a pinned list of working Nostr relays. Trystero's default
  pick for this app included two relays that no longer respond.
- The sidebar says "Your node" when acting as your own node, and "Acting as ·
  demo" only for fictional demo people.
- The dev server no longer reloads when audit browsers write to `.tooling/`.
- A storage write that fails asynchronously is reported in the storage banner
  instead of being lost, and the saved time only advances once the write has
  committed.

## [0.1.0] — 2026-10-21

The first public release: a working local prototype of a consent-based knowledge
node. Identities, transport and keys are still simulated; see
[Prototype boundaries](README.md#prototype-boundaries).

### Added

- Knowledge records with author, provenance, tags, version history, links,
  scopes, lexical search, Markdown export and JSON backup/restore.
- File attachments of any format and browser voice notes on knowledge records,
  stored inside the record, inheriting its scope. Limits are enforced before
  writing (1.5 MB per file, 2.5 MB and six items per record, 3 MB per node).
- Optional transcription of voice notes through a local OpenAI-compatible speech
  service; disabled until an endpoint and model are configured.
- Binary bilateral relationships with explicit invitations, acceptance, decline
  and revocation, plus group agreements that activate only when every named
  participant accepts. A consent audit log records changes without content.
- Communities, gatherings (RSVP, agenda, outcomes, `.ics` export), projects with
  tasks and resources, nodal locations, and place-based observations with
  privacy-aware coordinates, charts and a research summary.
- An interactive, permission-aware network map with drag, pan, zoom and a stored
  per-identity layout.
- Three complete themes (Web, Tree, Mycelium) with their own textures and type,
  applied without shifting layout and persisted with the node.
- An optional, off-by-default Ollama adapter for questions over authorised
  records, with timeouts, cancellation, citations and a search fallback.
- A WCAG 2.2 AA audit in three themes, with the repeatable harness in
  [`.tooling/`](.tooling/README.md), and the results in
  [docs/accessibility-audit.md](docs/accessibility-audit.md).
- Continuous integration on Codeberg: typecheck, 67 unit tests and a production
  build on every push and pull request.

### Changed

- Every route except Home is loaded as its own chunk. The entry bundle drops
  from 556 kB to 287 kB (158 kB to 88 kB gzipped), and the build no longer
  reports an oversized chunk.
- The build uses relative asset URLs, so one artifact runs from a domain root or
  from a project subpath such as `/KnowledgeWeb/` with no rebuild.
- The version shown in the interface is read from `package.json` at build time
  instead of being typed into the layout.
- Metadata for release: favicon, web app manifest, `engines`, repository and
  issue links.

### Fixed

- Saved node data that fails to parse or validate is no longer overwritten by
  sample data on start-up. A copy is kept under
  `understory.node.v1.unreadable` and the interface says so; if no copy can be
  kept, the original is left untouched.
- The About page linked to a data-model document that does not exist.

[Unreleased]: https://github.com/Archaejon/KnowledgeWeb/compare/v0.1.0...main
[0.1.0]: https://github.com/Archaejon/KnowledgeWeb/releases/tag/v0.1.0
