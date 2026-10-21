// Token-level contrast matrix for every theme.
// Parses the theme blocks in src/styles/app.css and checks the text/background
// pairings the UI actually uses. Usage: node .tooling/a11y-tokens.mjs
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'styles', 'app.css'), 'utf8');

const readTheme = (name) => {
  const start = css.indexOf(`[data-theme="${name}"] {`);
  const end = css.indexOf('\n}', start);
  const block = css.slice(start, end);
  const tokens = {};
  for (const [, key, value] of block.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8});/g)) {
    tokens[key.replace(/^--/, '')] = value;
  }
  return tokens;
};

const hexToRgb = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};
const mix = (over, under, pct) => ({
  r: over.r * pct + under.r * (1 - pct),
  g: over.g * pct + under.g * (1 - pct),
  b: over.b * pct + under.b * (1 - pct),
});
const lum = ({ r, g, b }) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const fmt = (color) =>
  '#' +
  [color.r, color.g, color.b]
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('');

const themes = ['web', 'tree', 'mycelium'];
const pairs = [
  // [label, foreground token, background token or mixture spec]
  ['body ink / surface', 'ink', ['surface']],
  ['soft ink / surface', 'ink-soft', ['surface']],
  ['muted / surface', 'muted', ['surface']],
  ['muted / surface-2', 'muted', ['surface-2']],
  ['muted / surface-3', 'muted', ['surface-3']],
  ['muted / sidebar', 'muted', ['sidebar-bg']],
  ['faint / surface', 'faint', ['surface']],
  ['faint / surface-2', 'faint', ['surface-2']],
  ['faint / surface-3', 'faint', ['surface-3']],
  ['faint / sidebar', 'faint', ['sidebar-bg']],
  ['faint / bg', 'faint', ['bg']],
  ['faint / gold-soft', 'faint', ['gold-soft']],
  ['faint / accent-soft', 'faint', ['accent-soft']],
  ['accent-contrast / accent', 'accent-contrast', ['accent']],
  ['accent-contrast / accent-strong', 'accent-contrast', ['accent-strong']],
  ['accent-strong / accent-soft', 'accent-strong', ['accent-soft']],
  ['badge-sample ink (62% gold + ink) / gold-soft', 'gold', ['gold-soft'], 0.62],
  ['success / success-soft', 'success', ['success-soft']],
  ['warning / warning-soft', 'warning', ['warning-soft']],
  ['danger / danger-soft', 'danger', ['danger-soft']],
  ['white / danger', null, ['danger']],
  ['scope private / 9% tint', 'scope-private', ['scope-private', 0.09, 'surface']],
  ['scope relationship / 9% tint', 'scope-relationship', ['scope-relationship', 0.09, 'surface']],
  ['scope community / 10% tint', 'scope-community', ['scope-community', 0.1, 'surface']],
  ['scope public / 9% tint', 'scope-public', ['scope-public', 0.09, 'surface']],
  ['scope public / surface-2', 'scope-public', ['surface-2']],
  ['scope public / surface-3', 'scope-public', ['surface-3']],
  ['scope community / surface-2', 'scope-community', ['surface-2']],
  ['scope private / surface-3', 'scope-private', ['surface-3']],
];

let failures = 0;
for (const theme of themes) {
  const tokens = readTheme(theme);
  console.log(`\n## ${theme}`);
  for (const [label, fgToken, bgSpec, mixWithInk] of pairs) {
    const fg = mixWithInk
      ? mix(hexToRgb(tokens[fgToken]), hexToRgb(tokens.ink), mixWithInk)
      : fgToken
        ? hexToRgb(tokens[fgToken])
        : { r: 255, g: 255, b: 255 };
    let bg;
    let bgLabel;
    if (bgSpec.length === 3) {
      bg = mix(hexToRgb(tokens[bgSpec[0]]), hexToRgb(tokens[bgSpec[2]]), bgSpec[1]);
      bgLabel = `${bgSpec[0]} tint on ${bgSpec[2]}`;
    } else {
      bg = hexToRgb(tokens[bgSpec[0]]);
      bgLabel = bgSpec[0];
    }
    const value = ratio(fg, bg);
    const pass = value >= 4.5;
    if (!pass) failures += 1;
    console.log(
      `${pass ? 'pass' : 'FAIL'} ${value.toFixed(2).padStart(5)}  ${label.padEnd(32)} ${fmt(fg)} on ${fmt(bg)}  (${bgLabel})`,
    );
  }
}
console.log(`\n${failures} token pairings below 4.5:1`);
