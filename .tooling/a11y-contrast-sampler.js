window.__contrastSample = async (pngBase64) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + pngBase64;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // PNG screenshots can carry alpha; flatten onto white so the sampled colours
  // match what a person sees.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const parse = (value) => {
    const m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
  const selector = (el) => {
    const parts = [];
    let node = el;
    while (node && node !== document.body && parts.length < 4) {
      let part = node.tagName.toLowerCase();
      if (node.className && typeof node.className === 'string') {
        part += '.' + node.className.trim().split(/\s+/).slice(0, 3).join('.');
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  };

  const results = [];
  // When a modal is open its backdrop dims the page behind it; only the dialog
  // itself is expected to meet contrast.
  const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
  const scope = dialog ?? document.body;
  const all = [...scope.querySelectorAll('*')];
  for (const el of all) {
    // SVG labels sit on top of chart lines; pixel sampling cannot separate them.
    if (el instanceof SVGElement) continue;
    const ownText = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!ownText) continue;
    // Decorative text (aria-hidden) is not part of the accessible content.
    if (el.closest('[aria-hidden="true"]')) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    if (Number(style.opacity) < 0.5) continue;
    if (style.color === 'rgba(0, 0, 0, 0)') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    // Inset past the border so the mode is the interior fill, not the outline.
    const inset = 2;
    const left = Math.max(1, Math.floor(rect.left) + inset);
    const top = Math.max(1, Math.floor(rect.top) + inset);
    const right = Math.min(window.innerWidth - 1, Math.ceil(rect.right) - inset);
    const bottom = Math.min(window.innerHeight - 1, Math.ceil(rect.bottom) - inset);
    // Tiny badges have no reliable interior; axe checks those with computed colours.
    if (right - left < 6 || bottom - top < 6) continue;
    const fg = parse(style.color);
    if (!fg) continue;

    const buckets = new Map();
    let total = 0;
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const i = (y * canvas.width + x) * 4;
        const px = { r: data[i], g: data[i + 1], b: data[i + 2] };
        if (dist(px, fg) < 42) continue; // glyph core
        const r = px.r >> 3;
        const g = px.g >> 3;
        const b = px.b >> 3;
        const key = String(r) + '-' + String(g) + '-' + String(b);
        const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
        bucket.r += px.r;
        bucket.g += px.g;
        bucket.b += px.b;
        bucket.n += 1;
        buckets.set(key, bucket);
        total += 1;
      }
    }
    if (total < 12) continue;
    const clusters = [...buckets.values()]
      .map((bucket) => ({
        r: bucket.r / bucket.n,
        g: bucket.g / bucket.n,
        b: bucket.b / bucket.n,
        share: bucket.n / total,
      }))
      .sort((a, b) => b.share - a.share);
    // Glyph antialiasing blends text and background, so the most common pixel
    // is not always the surface. This UI is light-on-dark text on light
    // surfaces: take the brightest common cluster for dark text and the
    // darkest for light text.
    const common = clusters.filter((c) => c.share >= 0.08);
    const pool = common.length > 0 ? common : clusters;
    const fgLum = lum(fg);
    const mode = pool.reduce((best, c) => {
      const better = fgLum < 0.4 ? lum(c) > lum(best) : lum(c) < lum(best);
      return better ? c : best;
    }, pool[0]);
    const fontSize = parseFloat(style.fontSize);
    const weight = Number(style.fontWeight) || 400;
    const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
    const threshold = large ? 3 : 4.5;
    const ratio = contrast(fg, mode);
    const secondary = clusters.find((c) => c.share >= 0.12 && contrast(fg, c) < ratio);
    const worst = secondary ? Math.min(ratio, contrast(fg, secondary)) : ratio;
    results.push({
      selector: selector(el),
      text: ownText.slice(0, 70),
      fg: style.color,
      bg:
        'rgb(' +
        Math.round(mode.r) +
        ', ' +
        Math.round(mode.g) +
        ', ' +
        Math.round(mode.b) +
        ')',
      ratio: Number(ratio.toFixed(2)),
      worst: Number(worst.toFixed(2)),
      threshold,
      fontSize,
      weight,
      pass: ratio >= threshold,
    });
  }
  return results;
};
true;
