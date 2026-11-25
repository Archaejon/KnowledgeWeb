import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { PeerManager, PeerState } from './core/peer/manager';

const PeerContext = createContext<PeerManager | null>(null);

export function PeerProvider({ manager, children }: { manager: PeerManager; children: ReactNode }) {
  return <PeerContext.Provider value={manager}>{children}</PeerContext.Provider>;
}

export function usePeers(): { manager: PeerManager; state: PeerState } {
  const manager = useContext(PeerContext);
  if (!manager) throw new Error('usePeers must be used inside PeerProvider');
  const state = useSyncExternalStore(manager.subscribe, manager.getState, manager.getState);
  return { manager, state };
}
