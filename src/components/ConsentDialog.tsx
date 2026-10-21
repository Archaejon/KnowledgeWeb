import { useState } from 'react';
import { accessFor, relationshipScopeTitles } from '../core/access';
import { formatDate } from '../core/dates';
import type { NodeData, Person, PersonRelationship } from '../core/types';
import { useApp } from '../store-context';
import { useToast } from './Toast';
import { Avatar, Badge, Button, ConfirmDialog, Modal, Notice } from './ui';
import { Icon } from './Icon';

function SharedTitles({ title, names, empty }: { title: string; names: string[]; empty: string }) {
  return (
    <div className="consent-shared-block">
      <div className="field-inline-label">{title}</div>
      {names.length === 0 ? (
        <p className="muted small">{empty}</p>
      ) : (
        <ul className="consent-list">
          {names.map((name) => (
            <li key={name}>
              <Icon name="file" size={14} />
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ConsentDialog({
  relationship,
  open,
  onClose,
}: {
  relationship?: PersonRelationship;
  open: boolean;
  onClose: () => void;
}) {
  const { store, snapshot } = useApp();
  const toast = useToast();
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState('');

  if (!relationship) return null;
  const data: NodeData = snapshot.data;
  const actorId = snapshot.settings.actorId;
  const incoming = relationship.initiatedBy !== actorId;
  const otherId = relationship.aId === actorId ? relationship.bId : relationship.aId;
  const other = data.people.find((p) => p.id === otherId);
  const incomingTitles = relationshipScopeTitles(data, otherId);
  const ownTitles = relationshipScopeTitles(data, actorId);

  const respond = (accept: boolean) => {
    try {
      store.respondToInvitation(relationship.id, accept);
      toast(
        accept
          ? `Relationship with ${other?.name ?? 'participant'} is now active. Relationship-shared knowledge is mutually visible.`
          : 'Invitation declined. No access was granted.',
        accept ? 'success' : 'info',
      );
      setAcknowledged(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not respond.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setAcknowledged(false);
        setError('');
        onClose();
      }}
      title={incoming ? 'Connection request' : 'Invitation sent'}
      description={
        incoming
          ? 'This is a bilateral knowledge relationship. Read what it does and does not share before answering.'
          : 'This invitation records a request. It grants no access until the other person explicitly accepts.'
      }
      size="lg"
      footer={
        incoming ? (
          <>
            <Button
              onClick={() => {
                setAcknowledged(false);
                setError('');
                respond(false);
              }}
            >
              Decline
            </Button>
            <Button
              variant="primary"
              icon="check"
              disabled={!acknowledged}
              onClick={() => respond(true)}
            >
              Accept relationship
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {other ? (
        <div className="consent-identity">
          <Avatar name={other.name} size="lg" />
          <div className="consent-identity-text">
            <h3>
              {other.name} <span className="muted small">{other.handle}</span>
            </h3>
            <p>{other.bio}</p>
            <div className="consent-identity-meta">
              <span>
                <Icon name="network" size={13} /> Node {other.nodeLabel}
              </span>
              <span>
                <Icon name="mapPin" size={13} /> {other.locality || 'No locality given'}
              </span>
              <span title="Prototype only: this is not a cryptographic verification.">
                <Icon name="key" size={13} /> {other.keyFingerprint}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="consent-kind">
        <Badge tone="accent" dot>
          Bilateral relationship
        </Badge>
        <span className="muted small">
          Not part of a group agreement. No community sharing is included.
        </span>
      </div>

      <Notice tone="quiet" icon="shield" title="What “full access” means here">
        It applies only to knowledge each person has marked <strong>relationship-shared</strong>.
        Private records stay private, and community-shared records still require an active group
        agreement. There are no partial permission levels inside a relationship.
      </Notice>

      <div className="consent-shared-grid">
        <SharedTitles
          title={`${other?.name ?? 'They'} marked relationship-shared (${incomingTitles.length})`}
          names={incomingTitles}
          empty="They have not marked any knowledge as relationship-shared yet."
        />
        <SharedTitles
          title={`You marked relationship-shared (${ownTitles.length})`}
          names={ownTitles}
          empty="You have not marked any knowledge as relationship-shared yet."
        />
      </div>
      <p className="consent-footnote">
        Both directions are full and symmetric. If either person adds or reclassifies a record as
        relationship-shared later, it becomes accessible through this active relationship without a
        further prompt. You can revoke the whole relationship at any time.
      </p>

      {incoming ? (
        <>
          <div className="consent-implications">
            <h4>If you accept</h4>
            <ul>
              <li>
                You and {other?.name ?? 'the other participant'} gain full read access to each
                other’s relationship-shared knowledge, including future records in that scope.
              </li>
              <li>
                Your private knowledge remains private. Group-shared knowledge still requires a
                separate active agreement.
              </li>
              <li>
                This relationship does not connect you to their other relationships, communities or
                node administration.
              </li>
            </ul>
            <h4>If you decline</h4>
            <ul>
              <li>No access is granted in either direction. The invitation is recorded as declined.</li>
              <li>You can discuss it in person and invite them again later if you choose.</li>
            </ul>
            <h4>Revocation later</h4>
            <ul>
              <li>
                Either person can end the relationship from Network. Future access is blocked
                immediately and the relationship disappears from active views.
              </li>
              <li>
                Copies that someone independently exported, memorised or shared elsewhere cannot be
                guaranteed to disappear.
              </li>
            </ul>
          </div>

          <label className="consent-ack">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>
              I have read what becomes accessible. I accept a full reciprocal relationship, and I
              understand I can revoke it later.
            </span>
          </label>
          {error ? <p className="field-error">{error}</p> : null}
        </>
      ) : (
        <div className="consent-pending">
          <Icon name="clock" size={18} />
          <div>
            <strong>Waiting for a response</strong>
            <p className="muted small">
              Sent {formatDate(relationship.proposedAt)}. No knowledge is accessible through this
              invitation while it is pending. You can withdraw it from the Network page.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function RevokeRelationshipDialog({
  relationship,
  open,
  onClose,
}: {
  relationship?: PersonRelationship;
  open: boolean;
  onClose: () => void;
}) {
  const { store, snapshot } = useApp();
  const toast = useToast();
  if (!relationship) return null;
  const otherId =
    relationship.aId === snapshot.settings.actorId ? relationship.bId : relationship.aId;
  const other = snapshot.data.people.find((p) => p.id === otherId);
  const isPending = relationship.status === 'pending';

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={isPending ? 'Withdraw invitation?' : `Revoke relationship with ${other?.name ?? 'this person'}?`}
      confirmLabel={isPending ? 'Withdraw invitation' : 'Revoke relationship'}
      tone="danger"
      onConfirm={() => {
        try {
          store.revokeRelationship(relationship.id);
          toast(
            isPending
              ? 'Invitation withdrawn. No access was ever granted.'
              : 'Relationship revoked. Future access is blocked.',
            'info',
          );
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Could not revoke.', 'error');
        }
      }}
    >
      <p>
        {isPending
          ? 'The pending invitation will be closed. It never granted access, so nothing else changes.'
          : 'This ends the bilateral relationship immediately. Both of you lose access to each other’s relationship-shared knowledge.'}
      </p>
      <ul className="confirm-list">
        <li>New reads and future synchronisation through this relationship are blocked.</li>
        <li>The relationship is removed from active network views and consent prompts.</li>
        <li>
          This node holds no cached copies from the relationship. If cached copies existed, they
          would be cleared here.
        </li>
        <li>
          A consent event is recorded without private content. Independently exported, memorised or
          redistributed copies elsewhere cannot be guaranteed to disappear.
        </li>
      </ul>
      <p className="muted small">This is not retroactive deletion on anyone else’s machine.</p>
    </ConfirmDialog>
  );
}

export function AccessExplanation({
  ownerId,
  scope,
  communityId,
}: {
  ownerId: string;
  scope: 'private' | 'relationship' | 'community' | 'public';
  communityId?: string;
}) {
  const { snapshot } = useApp();
  const actorId = snapshot.settings.actorId;
  const person: Person | undefined = snapshot.data.people.find((p) => p.id === ownerId);
  const decision = accessFor(snapshot.data, actorId, {
    id: 'inline',
    authorId: ownerId,
    scope,
    communityId,
  });
  if (!person) return null;
  return (
    <div className={`access-explanation channel-${decision.channel}`}>
      <Icon name={decision.allowed ? 'eye' : 'lock'} size={16} />
      <div>
        <strong>{decision.allowed ? 'Visible to you' : 'Not visible to you'}</strong>
        <span>{decision.explanation}</span>
      </div>
    </div>
  );
}
