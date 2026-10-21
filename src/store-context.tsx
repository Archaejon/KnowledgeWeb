import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { NodeStore, StoreSnapshot } from './core/store';

interface AppContextValue {
  store: NodeStore;
  snapshot: StoreSnapshot;
}

const StoreContext = createContext<AppContextValue | null>(null);

export function StoreProvider({ store, children }: { store: NodeStore; children: ReactNode }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return <StoreContext.Provider value={{ store, snapshot }}>{children}</StoreContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useApp must be used inside StoreProvider');
  return value;
}

export function useActor() {
  const { snapshot } = useApp();
  const person = snapshot.data.people.find((p) => p.id === snapshot.settings.actorId);
  return { actorId: snapshot.settings.actorId, actor: person };
}
