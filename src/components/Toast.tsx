import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

type Tone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, tone: Tone = 'success') => {
    const id = ++counter.current;
    setItems((prev) => [...prev.slice(-2), { id, message, tone }]);
    // Errors stay until dismissed; other notices linger long enough to read.
    if (tone === 'error') return;
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 8000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Outside #root: the app goes inert while a modal is open, but a status
          message raised from that modal still has to be announced. */}
      {createPortal(
        <div className="toasts" role="status" aria-live="polite" aria-relevant="additions text">
          {items.map((item) => (
            <div className={`toast toast-${item.tone}`} key={item.id}>
              <Icon
                name={item.tone === 'error' ? 'alert' : item.tone === 'info' ? 'info' : 'check'}
                size={18}
              />
              <span>{item.message}</span>
              <button
                type="button"
                className="toast-close"
                aria-label="Dismiss message"
                onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
