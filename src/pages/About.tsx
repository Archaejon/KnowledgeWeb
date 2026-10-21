import { Link } from '../router';
import { useApp } from '../store-context';
import { Icon } from '../components/Icon';
import { Badge, Card, CardHeader, Notice, PageHeader } from '../components/ui';

const implemented = [
  'Local node identity and browser-local persistence behind a replaceable storage adapter.',
  'Knowledge records with author, timestamps, tags, provenance, version history, references and explicit sharing scope.',
  'Any-format file attachments and microphone voice notes on knowledge records, stored inside the record and inheriting its scope.',
  'Optional transcription of voice notes by a local Whisper-compatible service, stored on the recording and included in Markdown export and search.',
  'Binary bilateral relationships: pending, active, declined, revoked, with explicit consent dialogs and an audit log without private content.',
  'Group agreements that activate only when every named participant explicitly accepts; any decline keeps them inactive.',
  'One community declined-agreement scenario, one active agreement, one revoked relationship and a pending invitation in the sample data.',
  'Communities with purposes, principles, opt-in directories, membership requests and steward roles.',
  'Gatherings with RSVP, agendas, capacity, outcomes, decisions, follow-ups, cancellation and .ics export.',
  'Projects with tasks, assignees, deadlines, resources, lessons and linked knowledge.',
  'Place-based observations with methods, units, scopes, coordinate privacy and descriptive summaries.',
  'An interactive consent-aware network graph and a structural density view.',
  'Three complete themes persisted across sessions.',
  'JSON backup/restore with schema validation; Markdown knowledge export; sample reset.',
  'An optional local Ollama adapter with timeouts, cancellation, citations and a keyword-search fallback.',
];

const limitations = [
  ['Identity', 'Identities are simulated by a "view as" switch. There is no login, password, key pair or remote authentication. Anyone with access to the browser profile can read the local node.'],
  ['Security boundary', 'Access control is enforced in the local node service (code and tests), not by a hardened remote backend. It is not a production security boundary against someone who controls the browser or storage.'],
  ['Transport', 'There is no peer-to-peer transport, relay, local discovery, encryption in transit, federation API or remote synchronisation. Inter-community agreements are local records, not live connections.'],
  ['Storage', 'Browser local storage is plaintext and quota-limited, typically around 5 MB. There is no encryption at rest, multi-device sync or automatic backup.'],
  ['Attachments', 'File and voice bytes are stored as base64 inside the record in browser storage, not on a server. That keeps backups self-contained but caps a file at 1.5 MB and the whole node at 3 MB of attachments, with no encryption at rest, no virus scanning, no previews for arbitrary formats and no per-file permissions: an attachment is exactly as readable as its record.'],
  ['AI', 'Only Ollama is implemented for questions. There is no embedding index or semantic retrieval, no conversation history, no multi-node synthesis and no prompt-injection-proof handling of untrusted documents. The adapter sends a keyword-ranked excerpt of authorised records. Transcription needs a separate OpenAI-compatible speech service that you run; no speech model is bundled, nothing is transcribed automatically, and long recordings are not chunked.'],
  ['Group lifecycle', 'A participant can withdraw consent and deactivate a group agreement. There is no steward transfer or full group-agreement version negotiation.'],
  ['Retroactive deletion', 'Revocation blocks future access on this node and removes it from active views. Independently exported, memorised or redistributed copies elsewhere cannot be recalled, and the app never claims otherwise.'],
  ['Backups', 'Backups are manual. There is no scheduled backup, remote replication or verified recovery drill.'],
  ['Compliance', 'No security standard (e.g. SOC 2, ISO 27001) or environmental/research standard has been assessed. Sample data is fictional.'],
];

export function AboutPage() {
  const { snapshot } = useApp();
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Prototype boundaries"
        title="About & limits"
        lede="An honest account of what works here, what is simulated, and what a real independently operated node would still need."
      />

      <Notice tone="warn" icon="alert" title="This is a local-first prototype, not a hardened peer-to-peer network">
        All people, communities, measurements and events are fictional sample data. Consent checks are
        real code with automated tests, but they run in the browser. There is no production security,
        encryption or remote transport yet.
      </Notice>

      <div className="two-col">
        <Card>
          <CardHeader icon="check" title="What is actually implemented" />
          <ul className="check-list">
            {implemented.map((item) => (
              <li key={item}>
                <Icon name="check" size={15} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader icon="alert" title="What is simulated or missing" />
          <dl className="limitation-list">
            {limitations.map(([title, body]) => (
              <div key={title}>
                <dt>
                  <Badge tone="warning">prototype limit</Badge> {title}
                </dt>
                <dd>{body}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader icon="network" title="How the demonstration scenario works" />
        <ol className="demo-scenario">
          <li>
            <strong>Two individuals establish a relationship.</strong> In the sample, Mara and Idris
            have an active bilateral relationship. Open <Link to="network">Network</Link> and inspect
            it.
          </li>
          <li>
            <strong>Their relationship-shared knowledge becomes accessible.</strong> Idris’s grafting
            guide and swale design notes become readable by Mara; Nia’s seed protocol too. Private
            records of each author stay private.
          </li>
          <li>
            <strong>A group-wide arrangement is proposed.</strong> Bramble Creek’s “field data pool”
            proposed sharing group-scoped knowledge across all four members.
          </li>
          <li>
            <strong>One participant declines.</strong> Ilse declined. The agreement is recorded as
            declined, not quietly activated for the others.
          </li>
          <li>
            <strong>The group relationship remains inactive.</strong> Community-scoped records such as
            Ilse’s creek erosion notes are not readable by Mara through that agreement, despite both
            being active members.
          </li>
          <li>
            <strong>Separate bilateral relationships remain possible.</strong> Nia and Owen have their
            own active relationship, independent of any proposed group agreement. Nobody else gains
            access to Ilse’s private or group-scoped knowledge through it.
          </li>
          <li>
            <strong>Revocation blocks subsequent access.</strong> Ilse revoked her earlier
            relationship with Mara. The relationship is retained as a closed audit record, no longer
            active, and the access path is gone. Copies that were independently exported elsewhere
            cannot be recalled.
          </li>
        </ol>
        <p className="muted small">
          Switch acting identity in <Link to="settings">Node settings</Link> to inspect the same rules
          from another participant’s perspective. The <Link to="network">Network walkthrough</Link>{' '}
          reads your current node state and reports which parts of the scenario are active.
        </p>
      </Card>

      <div className="two-col">
        <Card>
          <CardHeader icon="shield" title="Security and integrity posture" />
          <p className="muted small">
            Measures actually present in the prototype:
          </p>
          <ul className="principle-list">
            <li>Access checks in one engine used by lists, detail views, search, exports, charts and AI retrieval.</li>
            <li>All mutations go through the node service with author/role/consent checks.</li>
            <li>Runtime validation of imported backups; unsafe URLs rejected; React escapes rendered text.</li>
            <li>No credentials, API keys or session tokens are stored. No third-party auth or database is required.</li>
            <li>Consent audit records contain no knowledge content or location details.</li>
            <li>Automated unit tests cover binary access, pending/deferred access, group unanimity, revocation and search filtering.</li>
          </ul>
          <p className="muted tiny">
            These are not equivalent to a threat model, penetration test or security certification.
            Treat this as inspectable community software in development.
          </p>
        </Card>
        <Card>
          <CardHeader icon="book" title="Modularity and future deployment" />
          <p>
            Presentation, domain logic, access control, persistence and AI adapters are separate
            modules. The storage adapter can be replaced with a local file or daemon store. The AI
            adapter is optional and provider-neutral. Transport is deliberately absent rather than
            faked, with documented interfaces for sync, relays and federation.
          </p>
          <ul className="principle-list">
            <li>Storage: <code>src/core/storage.ts</code>, <code>NodeStore</code>.</li>
            <li>Access and consent: <code>src/core/access.ts</code>, <code>consent.ts</code>.</li>
            <li>AI boundary: <code>src/core/ai/</code>.</li>
            <li>Data model: <code>src/core/types.ts</code>, <code>docs/data-model.md</code>.</li>
            <li>Architecture and threat notes: <code>docs/architecture.md</code>, <code>docs/threat-model.md</code>.</li>
          </ul>
          <p className="muted small">
            Read <code>README.md</code> for setup, testing, backup and deployment guidance. License:
            AGPL-3.0-or-later.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader icon="sparkles" title="Optional AI, kept in its place" />
        <p>
          The assistant is disabled by default. When enabled, it receives only records selected after
          the same access check as every other view, and answers are expected to cite records. It has
          no write access, cannot call back into the node, and runs asynchronously with cancellation
          and timeouts. If the local model is unavailable, the interface falls back to ordinary local
          search rather than pretending to be intelligent.
        </p>
        <p className="muted small">
          There is no central AI provider, no API key and no model download. This prototype does not
          claim distributed AI or semantic retrieval.
        </p>
      </Card>

      <Card>
        <CardHeader icon="leaf" title="Why this exists" />
        <p>
          Understory is infrastructure for communities that exist in the physical world: people who
          meet, work, study and care for a place together. It prioritises useful knowledge, explicit
          consent and practical coordination over engagement. It is not intended to become a social
          feed or a substitute for showing up.
        </p>
        <p className="muted small">
          Node: {snapshot.data.node.name} · schema v{snapshot.data.schemaVersion} · v
          {snapshot.data.node.softwareVersion} · AGPL-3.0-or-later.
        </p>
      </Card>
    </div>
  );
}
