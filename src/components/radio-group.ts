import type { KeyboardEvent } from 'react';

/**
 * Arrow-key support for a roving `radiogroup`.
 *
 * ARIA radios are expected to expose a single tab stop and to move the
 * selection with the arrow keys (plus Home/End). Elements opt in by rendering
 * `data-radio-value={id}` and `tabIndex={selected ? 0 : -1}`.
 */
export function handleRadioGroupKeyDown<T extends string>(
  event: KeyboardEvent<HTMLElement>,
  ids: readonly T[],
  current: T,
  select: (id: T) => void,
) {
  const step: Record<string, number> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
  };
  let nextIndex: number | null = null;
  if (event.key in step) {
    const index = ids.indexOf(current);
    nextIndex = (index + step[event.key] + ids.length) % ids.length;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = ids.length - 1;
  }
  if (nextIndex === null) return;
  event.preventDefault();
  const id = ids[nextIndex];
  select(id);
  const group = event.currentTarget.closest('[role="radiogroup"]');
  group?.querySelector<HTMLElement>(`[data-radio-value="${id}"]`)?.focus();
}
