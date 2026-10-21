import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { NodeStore } from './core/store';
import { createStorage } from './core/storage';
import { StoreProvider } from './store-context';
import { ToastProvider } from './components/Toast';
import './styles/app.css';

const store = new NodeStore(createStorage());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider store={store}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>
  </React.StrictMode>,
);
