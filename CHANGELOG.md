# Changelog

All notable changes to Understory are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html) with the caveat in
[docs/releases.md](docs/releases.md): the major version stays at 0 until real
identities, transport and encryption exist.

## [Unreleased]

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

[Unreleased]: https://codeberg.org/Archaejon/KnowledgeWeb/compare/v0.1.0...main
[0.1.0]: https://codeberg.org/Archaejon/KnowledgeWeb/releases/tag/v0.1.0
