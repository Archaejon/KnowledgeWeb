import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store-context';
import { usePeers } from '../peer-context';
import { navigate } from '../router';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
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
  Notice,
  PageHeader,
} from '../components/ui';
import { decodeInvite } from '../core/peer/invite';
import type { InvitePayload } from '../core/peer/invite';
import { fingerprintOf, personIdFor } from '../core/peer/crypto';
import { formatDateTime } from '../core/dates';
import type { PersonRelationship } from '../core/types';

function appUrl(): string {
  return window.location.href.split('#')[0];
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function ConnectPage({ token }: { token?: string }) {
  const { snapshot } = useApp();
  const { state } = usePeers();
  const invite = useMemo((): { payload?: InvitePayload; error?: string } => {
    if (!token) return {};
    try {
      return { payload: decodeInvite(token) };
    } catch (error) {
      return { error: errorText(error, 'This invite link could not be read.') };
    }
  }, [token]);
  const status = state.status.kind;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Live connections"
        title="Connect"
        lede="Send a friend an invite link. When you are both online, your browsers connect directly and share the knowledge you have marked for your relationships, nothing else."
      />

      {invite.error ? (
        <Notice tone="danger" title="This invite link does not work">
          {invite.error}
        </Notice>
      ) : null}

      {status === 'starting' ? <p className="muted small" role="status">Starting…</p> : null}
      {status === 'error' && state.status.kind === 'error' ? (
        <Notice tone="danger" title="Connections are not working">
          {state.status.message}
        </Notice>
      ) : null}

      {invite.payload && status !== 'starting' ? <InviteCard invite={invite.payload} /> : null}

      {status === 'no-identity' || status === 'missing-key' ? (
        <CreateNodeCard
          missingKey={status === 'missing-key'}
          hasDemoData={snapshot.data.people.some((p) => p.isSample)}
          forInvite={Boolean(invite.payload)}
        />
      ) : null}

      {status === 'ready' ? (
        <div className="two-col">
          <div className="stack">
            <RequestsCard />
            <ConnectionsCard />
            <InviteFriendCard />
          </div>
          <div className="stack">
            <IdentityCard />
            <ActivityCard />
            <HowItWorks />
          </div>
        </div>
      ) : (
        <HowItWorks />
      )}
    </div>
  );
}

// ------------------------------------------------------------ first run

function CreateNodeCard({ missingKey, hasDemoData, forInvite }: { missingKey: boolean; hasDemoData: boolean; forInvite: boolean }) {
  const { manager } = usePeers();
  const toast = useToast();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await manager.createIdentity(name, handle);
      toast('Your node is ready. It holds a new key that never leaves this browser.', 'success');
    } catch (err) {
      setError(errorText(err, 'Could not create your node.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        icon="key"
        title={forInvite ? 'First, create your own node' : 'Create your own node'}
        subtitle={
          missingKey
            ? 'This node was restored from a backup or made in another browser, so its private key is not here. A new node with a new key is needed to connect.'
            : 'To connect with anyone you need a node of your own, with a real key that proves it is you.'
        }
      />
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          if (hasDemoData || missingKey) setConfirming(true);
          else void create();
        }}
      >
        {error ? <FormError>{error}</FormError> : null}
        <div className="form-row">
          <Field label="Your name" htmlFor="own-name" required hint="Shown to the people you connect with.">
            <input
              id="own-name"
              className="input"
              value={name}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Handle" htmlFor="own-handle" hint="Optional, for example @alex.">
            <input id="own-handle" className="input" value={handle} onChange={(event) => setHandle(event.target.value)} />
          </Field>
        </div>
        {hasDemoData ? (
          <Notice tone="quiet" icon="info">
            This replaces the fictional demo data in this browser with an empty node that belongs to you. You can bring
            the demo back later from Node settings, which would replace your node, so export a backup first.
          </Notice>
        ) : null}
        <div className="row-actions">
          <Button type="submit" variant="primary" icon="key" disabled={busy || name.trim().length < 1}>
            {busy ? 'Creating…' : 'Create my node'}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => void create()}
        title="Replace the data in this browser?"
        confirmLabel="Create my node"
      >
        Everything currently on this node in this browser is replaced by your new, empty node. Export a backup from Node
        settings first if you want to keep it.
      </ConfirmDialog>
    </Card>
  );
}

// ------------------------------------------------------------ invitee

function InviteCard({ invite }: { invite: InvitePayload }) {
  const { snapshot } = useApp();
  const { manager, state } = usePeers();
  const toast = useToast();
  const [fingerprint, setFingerprint] = useState<string>();
  const [inviterId, setInviterId] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void fingerprintOf(invite.key).then((value) => live && setFingerprint(value));
    void personIdFor(invite.key).then((value) => live && setInviterId(value));
    return () => {
      live = false;
    };
  }, [invite.key]);

  const data = snapshot.data;
  const owner = data.people.find((p) => p.id === data.node.ownerId);
  const ownInvite = owner?.publicKey === invite.key;
  const relationship = data.relationships
    .filter((r) => r.peer?.room === invite.room || (inviterId && (r.aId === inviterId || r.bId === inviterId) && r.peer))
    .sort((a, b) => b.proposedAt.localeCompare(a.proposedAt))[0];
  const ready = state.status.kind === 'ready';

  let body;
  if (ownInvite) {
    body = <p className="muted">This is your own invite link. Send it to the friend you want to connect with.</p>;
  } else if (relationship?.status === 'active') {
    body = (
      <Notice tone="success" title={`You are connected to ${invite.name}`}>
        Their shared knowledge appears under Knowledge whenever you are both online.
      </Notice>
    );
  } else if (relationship?.status === 'pending') {
    body = (
      <Notice tone="info" icon="clock" title={`Waiting for ${invite.name} to confirm`}>
        {state.online[relationship.peer!.room]
          ? `${invite.name} is online and has been asked to confirm it is you.`
          : `Keep this page open. As soon as ${invite.name} opens Understory, they will be asked to confirm it is you.`}
      </Notice>
    );
  } else {
    body = (
      <>
        {invite.message ? <blockquote className="muted">“{invite.message}”</blockquote> : null}
        <p className="small">
          Accepting shares the knowledge you mark as <strong>relationship</strong> or <strong>public</strong> with{' '}
          {invite.name}, and lets you read theirs. Nothing is shared until {invite.name} also confirms it is you. Either of
          you can end the connection at any time.
        </p>
        {relationship?.status === 'declined' || relationship?.status === 'revoked' ? (
          <p className="muted small">A previous connection with {invite.name} ended. Ask them for a new link to reconnect.</p>
        ) : null}
        <div className="row-actions">
          <Button
            variant="primary"
            icon="check"
            disabled={!ready || busy || relationship?.status === 'declined' || relationship?.status === 'revoked'}
            onClick={async () => {
              setBusy(true);
              try {
                await manager.acceptInvite(invite);
                toast(`Accepted. Waiting for ${invite.name} to confirm.`, 'info');
              } catch (error) {
                toast(errorText(error, 'Could not accept the invite.'), 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Accept invite
          </Button>
          <Button onClick={() => navigate('connect')}>Not now</Button>
        </div>
        {!ready ? <p className="muted small">Create your own node below first.</p> : null}
      </>
    );
  }

  return (
    <Card>
      <CardHeader icon="link" title={`${invite.name} invites you to connect`} subtitle={invite.handle || undefined} />
      <div className="stack-tight">
        <div className="identity-strip">
          <Avatar name={invite.name} />
          <div>
            <strong>{invite.name}</strong>
            <div className="muted tiny">
              <Icon name="key" size={12} /> Key fingerprint <code>{fingerprint ?? '…'}</code>
            </div>
          </div>
        </div>
        {body}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------ inviter

function RequestsCard() {
  const { manager, state } = usePeers();
  const toast = useToast();
  if (state.requests.length === 0) return null;
  return (
    <Card>
      <CardHeader
        icon="shield"
        title="Confirm who accepted your invite"
        subtitle="Check with your friend, by voice or in person, that the fingerprint below matches the one on their Connect page. Anyone who saw the link could have opened it."
      />
      <ul className="list">
        {state.requests.map((request) => (
          <li key={request.id}>
            <div className="list-row">
              <Avatar name={request.profile.name} />
              <div className="list-main">
                <div className="list-title-row">
                  <strong>{request.profile.name}</strong>
                  {request.profile.handle ? <span className="muted tiny">{request.profile.handle}</span> : null}
                </div>
                <div className="list-sub">
                  <Icon name="key" size={12} /> <code>{request.fingerprint}</code>
                </div>
              </div>
              <div className="row-actions">
                <Button
                  size="sm"
                  variant="primary"
                  icon="check"
                  onClick={async () => {
                    try {
                      await manager.confirmRequest(request.id);
                      toast(`Connected with ${request.profile.name}.`, 'success');
                    } catch (error) {
                      toast(errorText(error, 'Could not confirm.'), 'error');
                    }
                  }}
                >
                  It’s them
                </Button>
                <Button size="sm" onClick={() => void manager.declineRequest(request.id)}>
                  Decline
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function InviteFriendCard() {
  const { snapshot, store } = useApp();
  const { manager } = usePeers();
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [lastLink, setLastLink] = useState<string>();
  const openInvites = (snapshot.data.invites ?? []).filter((i) => i.status === 'open');

  const share = async (link: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Connect with me on Understory', url: link });
        return;
      } catch {
        // Cancelled or unavailable: fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      toast('Invite link copied. Send it to your friend however you like.', 'success');
    } catch {
      toast('Copy the link from the box by hand.', 'info');
    }
  };

  return (
    <Card>
      <CardHeader
        icon="send"
        title="Invite a friend"
        subtitle="Each link works for one person. Send it privately; anyone holding it can ask to connect, and you confirm who it is."
      />
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const link = manager.createInvite(appUrl(), message);
            setLastLink(link);
            setMessage('');
            void share(link);
          } catch (error) {
            toast(errorText(error, 'Could not create an invite.'), 'error');
          }
        }}
      >
        <Field label="Message (optional)" htmlFor="invite-message" hint="Travels inside the link and is shown to your friend.">
          <input
            id="invite-message"
            className="input"
            maxLength={500}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </Field>
        <div className="row-actions">
          <Button type="submit" variant="primary" icon="link">
            Create invite link
          </Button>
        </div>
      </form>
      {lastLink ? (
        <Field label="Your new invite link" htmlFor="invite-link">
          <input id="invite-link" className="input mono" readOnly value={lastLink} onFocus={(event) => event.target.select()} />
        </Field>
      ) : null}
      {openInvites.length > 0 ? (
        <>
          <h3 className="small">Open invites</h3>
          <ul className="list compact">
            {openInvites.map((invite) => (
              <li key={invite.id}>
                <div className="list-row">
                  <div className="list-main">
                    <span className="list-sub">
                      Created {formatDateTime(invite.createdAt)}
                      {invite.message ? ` · “${invite.message}”` : ''}
                    </span>
                  </div>
                  <div className="row-actions">
                    <Button size="sm" icon="link" onClick={() => void share(manager.linkFor(appUrl(), invite.id)!)}>
                      Copy link
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        store.cancelPeerInvite(invite.id);
                        toast('Invite cancelled.', 'info');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="muted tiny">Keep Understory open in a tab so a friend who accepts can reach you.</p>
        </>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------ both

function ConnectionsCard() {
  const { snapshot, store } = useApp();
  const { state } = usePeers();
  const toast = useToast();
  const [revoking, setRevoking] = useState<PersonRelationship>();
  const data = snapshot.data;
  const ownerId = data.node.ownerId;
  const peers = data.relationships
    .filter((r) => r.peer && r.status !== 'declined')
    .sort((a, b) => b.proposedAt.localeCompare(a.proposedAt));

  const describe = (rel: PersonRelationship, name: string) => {
    const online = Boolean(state.online[rel.peer!.room]);
    if (rel.status === 'active') {
      return online
        ? { badge: <Badge tone="success" dot>Online</Badge>, sub: 'Connected now. Changes are shared as you make them.' }
        : {
            badge: <Badge tone="neutral">Offline</Badge>,
            sub: rel.peer!.lastSyncAt
              ? `Last shared ${formatDateTime(rel.peer!.lastSyncAt)}. Catches up when you are both online.`
              : 'Catches up when you are both online.',
          };
    }
    if (rel.status === 'pending') {
      return { badge: <Badge tone="warning">Waiting</Badge>, sub: `Waiting for ${name} to confirm it is you.` };
    }
    return {
      badge: <Badge tone="danger">Ended</Badge>,
      sub: rel.peer!.revokeNoticePending
        ? `Ended. ${name} will be told the next time you are both online.`
        : `Ended ${rel.revokedAt ? formatDateTime(rel.revokedAt) : ''}.`,
    };
  };

  return (
    <Card>
      <CardHeader icon="network" title="Your connections" subtitle="People connected to this node over live links." />
      {peers.length === 0 ? (
        <EmptyState icon="link" title="No connections yet">
          Create an invite link below and send it to a friend.
        </EmptyState>
      ) : (
        <ul className="list">
          {peers.map((rel) => {
            const partnerId = rel.aId === ownerId ? rel.bId : rel.aId;
            const partner = data.people.find((p) => p.id === partnerId);
            const name = partner?.name ?? 'Your friend';
            const { badge, sub } = describe(rel, name);
            const held = data.knowledge.filter((k) => k.authorId === partnerId).length;
            return (
              <li key={rel.id}>
                <div className="list-row">
                  <Avatar name={name} />
                  <div className="list-main">
                    <div className="list-title-row">
                      <strong>{name}</strong>
                      {badge}
                    </div>
                    <div className="list-sub">{sub}</div>
                    {rel.status === 'active' ? (
                      <div className="list-sub">
                        {held} record{held === 1 ? '' : 's'} from {name} held here · key <code>{partner?.keyFingerprint}</code>
                      </div>
                    ) : null}
                  </div>
                  {rel.status === 'active' || rel.status === 'pending' ? (
                    <Button size="sm" variant="danger" onClick={() => setRevoking(rel)}>
                      {rel.status === 'active' ? 'End' : 'Withdraw'}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(undefined)}
        tone="danger"
        confirmLabel="End connection"
        title="End this connection?"
        onConfirm={() => {
          if (!revoking) return;
          try {
            store.revokeRelationship(revoking.id);
            toast('Connection ended. Their records were removed from this node.', 'info');
          } catch (error) {
            toast(errorText(error, 'Could not end the connection.'), 'error');
          }
        }}
      >
        Nothing more is shared either way, the records you received from them are removed here, and their node is asked to
        remove yours. Copies they already exported or remember cannot be recalled.
      </ConfirmDialog>
    </Card>
  );
}

function IdentityCard() {
  const { snapshot } = useApp();
  const owner = snapshot.data.people.find((p) => p.id === snapshot.data.node.ownerId);
  if (!owner) return null;
  return (
    <Card>
      <CardHeader icon="key" title="You" subtitle="Your friend sees this fingerprint when you connect. Read it out to each other to be sure." />
      <div className="identity-strip">
        <Avatar name={owner.name} />
        <div>
          <strong>{owner.name}</strong> <span className="muted tiny">{owner.handle}</span>
          <div className="muted tiny">
            <Icon name="key" size={12} /> <code>{owner.keyFingerprint}</code>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ActivityCard() {
  const { state } = usePeers();
  if (state.activity.length === 0) return null;
  return (
    <Card>
      <CardHeader icon="clock" title="Recent activity" subtitle="This session only." />
      <ul className="list compact" aria-live="polite">
        {state.activity.slice(0, 8).map((entry, index) => (
          <li key={`${entry.at}-${index}`}>
            <div className="list-row">
              <span className="list-sub">
                {formatDateTime(entry.at)} · {entry.text}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function HowItWorks() {
  return (
    <Notice tone="quiet" icon="shield" title="How live connections work">
      <ul className="small">
        <li>Your node has a real Ed25519 key, made in this browser and never exported. Every connection proves both keys.</li>
        <li>
          Browsers find each other through public Nostr relays. The relays carry only encrypted connection set-up, never
          your records, but they can see that two browsers met and when.
        </li>
        <li>Records travel directly between the two browsers over an encrypted WebRTC channel. There is no server.</li>
        <li>
          Only knowledge marked <em>relationship</em> or <em>public</em> is sent. Private and community records stay here.
        </li>
        <li>You both need Understory open at the same time to exchange changes. Some strict networks block direct connections.</li>
      </ul>
    </Notice>
  );
}
