import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { NodeStore } from './core/store';
import { createStorage } from './core/storage';
import { PeerManager } from './core/peer/manager';
import { IndexedDbKeyStore } from './core/peer/keystore';
import { PeerProvider } from './peer-context';
import { StoreProvider } from './store-context';
import { ToastProvider } from './components/Toast';
import './styles/app.css';

const store = new NodeStore(createStorage());
// Live connections. The WebRTC transport is only downloaded once a room is needed.
const peers = new PeerManager(store, new IndexedDbKeyStore(), () =>
  import('./core/peer/transport').then((m) => m.join),
);
void peers.start();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider store={store}>
      <PeerProvider manager={peers}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </PeerProvider>
    </StoreProvider>
  </React.StrictMode>,
);
