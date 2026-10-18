import chroma from 'chroma-js';

// Anchor hue is the app's existing brand color (indigo-600). Its role as the
// primary action color is unchanged; everything else here derives from it.
export const ANCHOR_HUE = '#4f46e5';

const anchorColor = chroma(ANCHOR_HUE);
const anchorH = anchorColor.get('lch.h');
const anchorChroma = anchorColor.get('lch.c');

export interface Ramp {
  50: string;
  100: string;
  200: string;
  400: string;
  600: string;
  900: string;
}

// Triadic companions in LCH space. Filled (600) states are pulled to L=44 so
// white-on-filled text keeps >= 4.5:1 (WCAG AA).
function companionRamp(hueDeg: number, chromaBase: number): Ramp {
  const step = (l: number, c: number) => chroma.lch(l, c, hueDeg).hex();
  return {
    50: step(97, chromaBase * 0.22),
    100: step(93, chromaBase * 0.3),
    200: step(86, chromaBase * 0.45),
    400: step(64, chromaBase * 0.9),
    600: step(44, chromaBase),
    900: step(30, chromaBase * 0.55),
  };
}

// Momentum: completion states, progress, active workflow items.
export const MOMENTUM = companionRamp((anchorH + 120) % 360, Math.max(anchorChroma, 50) * 0.73);
// Attention: alerts, unread badges, active timers, high-priority flags.
export const ATTENTION = companionRamp((anchorH + 240) % 360, Math.max(anchorChroma, 50) * 0.37);

// Slate anchors blended 2-4% toward the anchor hue in LCH so surfaces carry a
// faint brand cast instead of pure gray.
const SLATE: Record<string, string> = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
};

const TINT_STRENGTH: Record<string, number> = {
  50: 0.02,
  100: 0.03,
  200: 0.035,
  300: 0.035,
  400: 0.035,
  500: 0.035,
  600: 0.035,
  700: 0.035,
  800: 0.035,
  900: 0.03,
  950: 0.02,
};

export const TINTED_NEUTRALS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const key of Object.keys(SLATE)) {
    out[key] = chroma.mix(SLATE[key], ANCHOR_HUE, TINT_STRENGTH[key], 'lch').hex();
  }
  return out;
})();

export function glowShadow(size: 'sm' | 'md', alphaScale = 1): string {
  const alpha = (size === 'sm' ? 0.18 : 0.22) * alphaScale;
  const halo = (size === 'sm' ? 0.1 : 0.12) * alphaScale;
  return `0 ${size === 'sm' ? '1px 3px' : '4px 16px'} -1px ${chroma(ANCHOR_HUE).alpha(alpha).css()}, 0 0 ${size === 'sm' ? 8 : 12}px -2px ${chroma(ANCHOR_HUE).alpha(halo).css()}`;
}
