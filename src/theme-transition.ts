import { flushSync } from 'react-dom';
import type { NodeStore } from './core/store';
import type { ThemeId } from './core/types';

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/**
 * Apply a theme with a short crossfade. The View Transition API snapshots the
 * old and new shells, so changing typefaces and textures cannot look like a
 * jump-cut. Browsers without it (or users who ask for reduced motion) get the
 * immediate change; CSS still animates ink, surfaces and borders.
 */
export function applyTheme(store: NodeStore, theme: ThemeId): Promise<void> {
  const doc = document as TransitionDocument;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (!doc.startViewTransition || reduceMotion) {
    store.setTheme(theme);
    return Promise.resolve();
  }

  try {
    const transition = doc.startViewTransition(() => {
      flushSync(() => store.setTheme(theme));
    });
    return transition.finished.catch(() => undefined);
  } catch {
    store.setTheme(theme);
    return Promise.resolve();
  }
}
