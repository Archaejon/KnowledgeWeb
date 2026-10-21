import { useApp } from '../store-context';
import { applyTheme } from '../theme-transition';
import { THEMES } from '../components/ThemeSwitcher';
import { handleRadioGroupKeyDown } from '../components/radio-group';
import { ThemeMark } from '../components/ThemeMark';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, CardHeader, PageHeader, ScopeBadge } from '../components/ui';
import type { ThemeId } from '../core/types';

const themeDetails: Record<ThemeId, { heading: string; note: string; palette: string[] }> = {
  web: {
    heading: 'Printed field notes',
    note: 'Indigo ink on newsprint with silver-grey rules. Engraved serif headings, typewriter labels and hard-edged cards that look pressed rather than floated. Fine graph paper sits under a broad, faint orb web drawn from the top corner; no cartoon webs or gamified effects.',
    palette: ['#3d4670', '#23242b', '#cbc5b5', '#7d694c'],
  },
  tree: {
    heading: 'Ink on laid parchment',
    note: 'Forest green and bark brown on warm laid paper, with concentric growth rings and radial cracks rising from the lower corner under fine bark grain. A bookish serif body, small-caps labels and softly bound card edges. Multiple centres are allowed; the branching hierarchy is visual, never social.',
    palette: ['#3a5434', '#6b5436', '#e8ddc4', '#98712f'],
  },
  mycelium: {
    heading: 'Many centres, quiet filaments',
    note: 'Mushroom cream, moss and soil ochre over branching hyphae and scattered spores. Rounded humanist headings, dotted filaments and irregular cards with a little give. A visual connection never implies access.',
    palette: ['#566636', '#956c31', '#eae2ce', '#484435'],
  },
};

export function AppearancePage() {
  const { snapshot, store } = useApp();
  const toast = useToast();
  const theme = snapshot.settings.theme;

  const choose = (id: ThemeId, name: string) => {
    if (id === theme) return;
    void applyTheme(store, id);
    toast(`${name} theme applied. Data, consent and navigation are unchanged.`, 'info');
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Visual themes"
        title="Appearance"
        lede="Exactly three themes. Each has its own drawn background, type and material, not a colour swap. Changing theme crossfades smoothly and never changes membership, data, consent or sharing rules."
      />

      <div
        className="theme-choice-grid"
        role="radiogroup"
        aria-label="Choose a visual theme"
        onKeyDown={(event) =>
          handleRadioGroupKeyDown(
            event,
            THEMES.map((item) => item.id),
            theme,
            (id) => choose(id, THEMES.find((item) => item.id === id)?.name ?? id),
          )
        }
      >
        {THEMES.map((item) => {
          const selected = theme === item.id;
          return (
            <button
              type="button"
              key={item.id}
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              data-radio-value={item.id}
              className={`theme-choice${selected ? ' is-selected' : ''}`}
              onClick={() => choose(item.id, item.name)}
            >
              <div className="theme-choice-preview" data-theme={item.id} aria-hidden="true">
                <div className="theme-preview-top">
                  <ThemeMark theme={item.id} size={30} />
                  <span className="theme-preview-brand">Understory</span>
                  <span className="theme-preview-dot" />
                </div>
                <div className="theme-preview-type">
                  <b>Aa</b>
                  <em>
                    {item.id === 'web'
                      ? 'Palatino · Courier'
                      : item.id === 'tree'
                        ? 'Palatino · serif body'
                        : 'Trebuchet · humanist'}
                  </em>
                </div>
                <div className="theme-preview-lines">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="theme-preview-cards">
                  <span className="theme-preview-card">
                    <i />
                    <i />
                  </span>
                  <span className="theme-preview-card">
                    <i />
                    <i />
                  </span>
                </div>
              </div>
              <div className="theme-choice-body">
                <div className="theme-choice-heading">
                  {/* A heading may not live inside a button; the card itself is the radio. */}
                  <span className="theme-choice-title">{item.name}</span>
                  {selected ? (
                    <Badge tone="success" dot>
                      Selected
                    </Badge>
                  ) : (
                    <span className="muted tiny">{item.tagline}</span>
                  )}
                </div>
                <p>{item.description}</p>
                {/* Decorative palette swatches; the description carries the colour story. */}
                <div className="swatch-row" aria-hidden="true">
                  {themeDetails[item.id].palette.map((colour) => (
                    <span key={colour} className="swatch" style={{ background: colour }} />
                  ))}
                </div>
                <div className="theme-choice-action">
                  <Icon name={selected ? 'check' : 'palette'} size={15} />
                  {selected ? 'Currently applied' : `Apply ${item.name}`}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="two-col">
        <Card>
          <CardHeader icon="palette" title={themeDetails[theme].heading} />
          <p>{themeDetails[theme].note}</p>
          <div className="theme-anatomy">
            <div>
              <span className="field-inline-label">Controls</span>
              <div className="row-actions">
                <Button variant="primary">Primary action</Button>
                <Button>Quiet action</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
            </div>
            <div>
              <span className="field-inline-label">Scopes</span>
              <div className="row-actions">
                <ScopeBadge scope="private" />
                <ScopeBadge scope="relationship" />
                <ScopeBadge scope="community" />
                <ScopeBadge scope="public" />
              </div>
            </div>
            <div>
              <span className="field-inline-label">Sample card</span>
              <div className="theme-sample-card">
                <div className="theme-sample-graph">
                  <span className="sample-node" />
                  <span className="sample-node" />
                  <span className="sample-node" />
                  <span className="sample-node" />
                  <span className="sample-edge e1" />
                  <span className="sample-edge e2" />
                  <span className="sample-edge e3" />
                </div>
                <div>
                  <strong>Willowbank water table</strong>
                  <p className="muted tiny">Community-shared · 5 readings</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader icon="shield" title="Common behaviour, different feeling" />
          <ul className="principle-list">
            <li>All three themes use the same navigation, data and permission checks.</li>
            <li>The network map changes line treatment, type and node shape, never meaning.</li>
            <li>Each theme has its own typeface, ink colour and object edges, not just an accent swap.</li>
            <li>Charts use accessible series colours and always include labels and a data table.</li>
            <li>Typography stays legible; no low-contrast decorative text.</li>
            <li>Theme choice is stored with the node settings and survives reload.</li>
            <li>Animations are minimal and respect reduced-motion preferences.</li>
          </ul>
          <p className="muted small">
            The theme selector is also available in the sidebar and top bar, so it can be changed
            without losing your place.
          </p>
          <p className="muted tiny">
            Selected theme: <strong>{THEMES.find((item) => item.id === theme)?.name}</strong>. Stored
            locally with this node’s settings.
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader icon="info" title="Why these three?" />
        <p>
          Web emphasises interconnection and resilience. Tree emphasises rootedness, place and
          continuity. Mycelium emphasises cooperation, distributed intelligence and regeneration.
          They are metaphors for the same community infrastructure; none is a claim about biology,
          trust or knowledge quality.
        </p>
      </Card>
    </div>
  );
}
