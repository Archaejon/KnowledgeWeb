# Threat model

Scope: the local browser prototype in this repository. It is not a security
certification, and it does not describe a deployed multi-user service.

## Assets

- Private knowledge records and private observations.
- Relationship-shared records and their authors' identities.
- Group agreement membership, responses and the fact of a decline.
- Precise locations and any coordinates marked sensitive.
- The local node identity, backups and the browser profile that stores them.
- Consent history: who asked, accepted, declined or revoked, and when.
- Future credentials and transport keys (not implemented).

## Actors and trust boundaries

| Actor | Trust |
| --- | --- |
| The person using this browser profile | Trusted for this local node |
| Other participants in the sample data | Simulated; no real authentication |
| Imported backup file | Untrusted input; validated before use |
| Knowledge text and URLs received from others | Untrusted content; rendered as text, URLs checked |
| Local AI endpoint | Optional, user-configured; receives only authorised context |
| Future remote node or relay | Untrusted; would need signatures and access checks |

The critical boundary today is **UI ↔ local node service**. A second boundary is
**imported data ↔ store**. Neither is a substitute for a server-side boundary in
a multi-user deployment.

## Threats and current mitigations

### Unauthorised read through the UI

Access is computed by `core/access.ts`, not by the screens. Search, detail
views, exports, observation summaries, network projection and AI context call
the same engine. Tests assert that pending, declined and revoked relationships
do not grant access, and that private records remain author-only.

Residual risk: this is client-side code. Anyone who controls the browser can
read the underlying localStorage directly. The prototype does not defend
against a compromised device or a malicious browser extension.

### Partial access or silent relationship activation

Relationships change state only through explicit accept/decline commands. A
pending invitation never grants access. Group agreements require every named
participant to accept. The store rejects an initiator answering their own
invitation and records decisions in the consent log without copying private
content.

Residual risk: an attacker with local write access could edit localStorage
(including relationship status). There is no signature or server check yet.
Runtime validation catches malformed shapes, not a well-formed forged state.

### Group agreement coercion

A group agreement cannot silently enrol a person, cannot inherit a member's
other relationships, and a decline keeps it inactive. The UI names the required
participants and the current response count. Social pressure is outside the
software's control; the model makes refusal visible and effective.

### Revocation and copies

Revocation blocks future access on this node, removes the relationship from
active views, and clears cached relationship content from the active projection.
It cannot recall independently exported, copied or memorised information.
Exports and the UI state this explicitly.

### Imported malicious data

`validation.ts` checks schema version, nested object shapes, enums, required
strings, array limits, dates and referential integrity before a restore.
External links are restricted to safe HTTP(S) URLs and rendered as text, not
injected HTML. React escapes record content.

Residual risk: there is no malware scanning for attachments (attachments are not
implemented), and no sandbox for imported HTML (HTML is never rendered raw).

### Script injection and unsafe content

The app does not use `dangerouslySetInnerHTML`, `eval` or remote scripts. Content
from records, people and imports is treated as data. The only dynamically
constructed markup is React/SVG generated from typed values.

### Credential exposure

No credentials, tokens or API keys are stored or required for core features. The
optional AI endpoint is a URL and model name, not a secret. A future deployment
must keep keys server-side and out of exports, logs and backups.

### Logs and diagnostics

The consent log holds event kind, actor ID, timestamp, a short human-readable
detail and subject IDs. It deliberately avoids record bodies, precise private
locations and free-text private content. It is included in backups because it is
part of the node's accountability record.

### Denial of service and storage exhaustion

Local storage is quota-limited. Import is capped at 8 MB and the app reports a
storage failure rather than silently dropping writes. AI calls have a timeout
and cancellation. A future server needs request limits, upload limits and
backpressure.

### Precise-location disclosure

Places have explicit sensitivity and coordinate handling. Observation records
carry their own scope; a community-shared observation is not public simply
because it has coordinates. The UI shows privacy labels beside the data and does
not surface restricted records in charts or summaries.

Nodal locations add a directory layer on top of the same place record. Their
`visibility` field governs who may see the venue at all (`public`, active
`community` members only, or owner-only), independently of the place's
coordinate policy. Access notes and contact details are inside that same gate,
so a private venue cannot leak its address or host through a public listing.
Gathering venue links are validated against the planner's current visibility, so
a planner cannot use a gathering to name a venue they cannot see.

Residual risk: the prototype stores coordinates in plaintext in localStorage and
backups. A real deployment needs encryption at rest and per-field access rules.
Because directory visibility is a prototype rule enforced client-side, a
modified client can read the underlying plaintext record.

## Out of scope / known gaps

- No real authentication, signatures, key exchange or encryption in transit.
- No server, so no defence against a modified client or direct storage access.
- No peer-to-peer transport, relay, offline sync or conflict resolution.
- No encryption at rest, no secure enclave, no automatic backup or recovery
  drill.
- No rate limiting, audit export, intrusion detection or incident response.
- No independent security assessment. Do not claim compliance with any standard.

## Production hardening checklist

Before handling real community data on a network:

1. Move identity and session handling to an authenticated server or daemon.
2. Enforce every access check server-side on authenticated requests; keep the
   client checks as a usability layer.
3. Encrypt storage and backups; define and test key rotation and recovery.
4. Use TLS, secure headers, CSRF protection and strict origin checks.
5. Sign and verify transport envelopes; add replay protection and per-node keys.
6. Add rate limits, upload limits, structured audit logs and retention rules.
7. Test revocation, export and deletion behaviour end to end with two accounts.
8. Have the design reviewed by someone independent of the implementation.
