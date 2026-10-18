const chroma = require('chroma-js');

const ANCHOR = '#4f46e5'; // indigo-600, the primary brand color used across buttons/accents

const base = chroma(ANCHOR);
const [l, c, h] = base.get('lch');
console.log('=== Anchor ===');
console.log('hex:', ANCHOR, 'lch:', l.toFixed(2), c.toFixed(2), h.toFixed(2));

const momentum = chroma.lch(l, Math.max(c, 50), (h + 120) % 360);
const attention = chroma.lch(l, Math.max(c, 50), (h + 240) % 360);

console.log('\n=== Triad (raw) ===');
console.log('momentum (h+120):', momentum.hex(), momentum.get('lch').map(v => v.toFixed(1)).join(','));
console.log('attention (h+240):', attention.hex(), attention.get('lch').map(v => v.toFixed(1)).join(','));

// For each companion build a 6-step functional ramp (light -> dark) usable in
// both light and dark modes. Keep chroma moderate for harmony with indigo.
function ramp(seedLch) {
  const [l0, c0, h0] = seedLch;
  const steps = [
    { name: 50, l: 97, c: c0 * 0.22 },
    { name: 100, l: 93, c: c0 * 0.3 },
    { name: 200, l: 86, c: c0 * 0.45 },
    { name: 400, l: 66, c: c0 * 0.9 },
    { name: 600, l: 52, c: c0 },
    { name: 900, l: 32, c: c0 * 0.55 },
  ];
  return steps.map(({ name, l, c }) => ({ step: name, hex: chroma.lch(l, c, h0).hex() }));
}

const momRamp = ramp(momentum.get('lch'));
const attRamp = ramp(attention.get('lch'));

console.log('\n=== Momentum ramp ===');
for (const s of momRamp) console.log(`  ${s.step}: ${s.hex}`);
console.log('=== Attention ramp ===');
for (const s of attRamp) console.log(`  ${s.step}: ${s.hex}`);

// Tinted neutrals: blend 4% anchor into slate anchors.
const neutralAnchors = {
  50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
  400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
  800: '#1e293b', 900: '#0f172a', 950: '#020617',
};
console.log('\n=== Tinted neutrals (4% anchor mix) ===');
const tints = {};
for (const [step, hex] of Object.entries(neutralAnchors)) {
  const mixed = chroma.mix(hex, ANCHOR, 0.04, 'lch');
  tints[step] = mixed.hex();
  console.log(`  slate-${step}: ${hex} -> ${mixed.hex()}`);
}

// Elevation glow tokens
console.log('\n=== Glow tokens ===');
console.log('  glow-sm:', `0 1px 3px -1px ${chroma(ANCHOR).alpha(0.18).css()}, 0 0 8px -2px ${chroma(ANCHOR).alpha(0.10).css()}`);
console.log('  glow-md:', `0 4px 16px -4px ${chroma(ANCHOR).alpha(0.22).css()}, 0 0 12px -3px ${chroma(ANCHOR).alpha(0.12).css()}`);
console.log('  glow-focus ring:', chroma(ANCHOR).alpha(0.35).css());

// Contrast verification: body text vs tinted surfaces, both modes.
function ratio(fg, bg) {
  return chroma.contrast(fg, bg).toFixed(2);
}
console.log('\n=== WCAG AA contrast checks ===');
console.log('  light text #0f172a-ish (slate-900) on tinted slate-50:', ratio(tints[900], tints[50]));
console.log('  light body #334155-ish (tinted 700) on tinted slate-50:', ratio(tints[700], tints[50]));
console.log('  dark text tinted-100 on tinted slate-950:', ratio(tints[100], tints[950]));
console.log('  dark body tinted-300 on tinted slate-950:', ratio(tints[300], tints[950]));
console.log('  white on anchor (#4f46e5):', ratio('#ffffff', ANCHOR));
console.log('  white on momentum-600:', ratio('#ffffff', momRamp.find(s => s.step === 600).hex));
console.log('  attention-900 on attention-100 (badge):', ratio(attRamp.find(s => s.step === 900).hex, attRamp.find(s => s.step === 100).hex));
console.log('  momentum-900 on momentum-100 (badge):', ratio(momRamp.find(s => s.step === 900).hex, momRamp.find(s => s.step === 100).hex));
