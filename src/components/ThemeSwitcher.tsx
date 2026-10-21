import { useApp } from '../store-context';
import { applyTheme } from '../theme-transition';
import type { ThemeId } from '../core/types';
import { handleRadioGroupKeyDown } from './radio-group';
import { ThemeMark } from './ThemeMark';

export const THEMES: { id: ThemeId; name: string; tagline: string; description: string }[] = [
  {
    id: 'web',
    name: 'Web',
    tagline: 'Web / spider',
    description:
      'Indigo ink on newsprint, with fine graph paper and a faint orb web drawn from the corner. Typewriter labels, engraved serif headings and hard-edged printed cards.',
  },
  {
    id: 'tree',
    name: 'Tree',
    tagline: 'Tree',
    description:
      'Forest green and bark on laid parchment, with concentric growth rings and bark grain. A bookish serif body, warm ink and softly bound card edges.',
  },
  {
    id: 'mycelium',
    name: 'Mycelium',
    tagline: 'Mushroom / mycelium',
    description:
      'Mushroom cream, moss and ochre, over branching hyphae and spores. Rounded humanist headings, dashed filaments and soft, irregular cards.',
  },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { store, snapshot } = useApp();
  const current = snapshot.settings.theme;
  return (
    <div
      className={`theme-switcher${compact ? ' theme-switcher-compact' : ''}`}
      role="radiogroup"
      aria-label="Visual theme"
      onKeyDown={(event) =>
        handleRadioGroupKeyDown(
          event,
          THEMES.map((theme) => theme.id),
          current,
          (id) => void applyTheme(store, id),
        )
      }
    >
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          role="radio"
          aria-checked={current === theme.id}
          tabIndex={current === theme.id ? 0 : -1}
          data-radio-value={theme.id}
          className={`theme-option${current === theme.id ? ' is-active' : ''}`}
          title={`${theme.name} theme`}
          onClick={() => void applyTheme(store, theme.id)}
        >
          <ThemeMark theme={theme.id} size={compact ? 18 : 20} />
          {compact ? <span className="sr-only">{theme.name}</span> : <span>{theme.name}</span>}
        </button>
      ))}
    </div>
  );
}
