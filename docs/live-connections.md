# Live connections

Two people, each with their own Understory node in their own browser, can
connect over a direct WebRTC link and exchange the knowledge they share with
each other. There is no Understory server.

## Using it

1. Each person opens **Connect** and chooses **Create my node**. This replaces
   the fictional demo data in that browser with an empty node and makes a new
   Ed25519 key pair. The private key is created non-extractable and stored in
   IndexedDB (`understory.keys`); it is never written into node data, backups or
   exports.
2. The inviter chooses **Create invite link** and sends the link privately
   (WhatsApp, Signal, email). Everything in the link sits after `#`, so the web
   host never receives it.
3. The friend opens the link, creates their node and chooses **Accept invite**.
4. While both are online, the inviter sees **Confirm who accepted your invite**
   with the friend's key fingerprint. They compare it by voice or in person and
   choose **It's them**. Only then does anything get shared.
5. From then on, whenever both have Understory open, each node sends the other
   its owner's knowledge records scoped *relationship* or *public*. Edits, scope
   changes and deletions are reflected on the other side.
6. Either person can **End** the connection. Their copies of each other's
   records are removed; if the other node is offline it is told next time both
   are online.

## Protocol

| Step | What happens |
| --- | --- |
| Meeting | Both nodes join a trystero room named `SHA-256("understory/room/v1|" + secret)`. Public Nostr relays carry the WebRTC offers and answers, encrypted by trystero with the room secret. |
| Handshake | Before a peer counts as joined, each side sends `hello {key, nonce}` and then a signature over `understory/v1|roomId|theirNonce|theirKey|myKey`. A failed signature, an unknown key, or (after confirmation) any key other than the partner's drops the peer. |
| Request | The invitee sends `request {profile}`. The inviter's UI shows it with the verified fingerprint. |
| Confirm | `confirm` or `decline`. The invite becomes `used`; the same room carries the relationship from then on. A stranger who later opens the link fails the key check. |
| Sync | `sync {profile, records}`: the full set the partner may read. The receiver validates every field (`core/peer/sync.ts`), refuses records not authored by the partner or not relationship/public scoped, strips local links, and replaces what it held from that partner. |
| Revoke | `revoke`; the receiver ends the relationship and removes the partner's records. |

Code: `src/core/peer/` (`crypto`, `keystore`, `invite`, `sync`, `manager`,
`transport`), store commands under "live peers" in `src/core/store.ts`, the UI
in `src/pages/Connect.tsx`, tests in `tests/peer.test.ts` (an in-memory
transport runs the real handshake between two nodes).

## Limits

- Both people must have Understory open at the same time. There is no outbox or
  relay that holds changes for an offline partner.
- No TURN server: some strict corporate or mobile networks block direct
  connections, and the link will stay offline.
- Public Nostr relays see that two browsers met in a room and when, though not
  the content. Some public relays are flaky; trystero uses several at once.
- Only knowledge records travel. Communities, gatherings, projects, places and
  observations stay local. Attachments travel but are dropped if they would
  exceed this node's browser-storage budget.
- Records are stored in plaintext in browser storage on both sides, like the
  rest of the node.
- A backup restored in another browser keeps the public identity but not the
  private key, so it cannot connect; create a new node there instead.
- One person per invite. Key rotation and multi-device identities do not exist.
- This has not had an independent security review.
