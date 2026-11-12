// Whole film is a pure function of time: renderFrame(t) rebuilds the SVG, so the
// offline renderer and the in-browser preview always produce identical frames.
const W = 576, H = 1024, DUR = 51.5, O = '#1b1426';

const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => cl((t - a) / (b - a));
const eio = x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const eout = x => 1 - Math.pow(1 - x, 3);
const back = x => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
const pop = (t, t0, d = 0.25) => (t < t0 ? 0 : back(prog(t, t0, t0 + d)));
const shake = (t, t0, d = 0.35, amp = 8) => {
  if (t < t0 || t > t0 + d) return [0, 0];
  const k = 1 - (t - t0) / d;
  return [Math.sin(t * 90) * amp * k, Math.cos(t * 70) * amp * k];
};
const f = n => Math.round(n * 100) / 100;

const g = (tr, inner, extra = '') => `<g transform="${tr}" ${extra}>${inner}</g>`;
const at = (x, y, s, inner, extra = '') => g(`translate(${f(x)},${f(y)}) scale(${f(s)})`, inner, extra);
const popAt = (x, y, k, inner) => (k <= 0 ? '' : g(`translate(${x},${y}) scale(${f(k)}) translate(${-x},${-y})`, inner));
const rect = (x, y, w, h, fill, o = {}) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${o.rx || 0}" fill="${fill}" stroke="${o.s === undefined ? O : o.s}" stroke-width="${o.sw === undefined ? 3 : o.sw}" ${o.x || ''}/>`;
const circ = (x, y, r, fill, o = {}) =>
  `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" stroke="${o.s === undefined ? O : o.s}" stroke-width="${o.sw === undefined ? 3 : o.sw}" ${o.x || ''}/>`;
const ell = (x, y, rx, ry, fill, o = {}) =>
  `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" stroke="${o.s === undefined ? O : o.s}" stroke-width="${o.sw === undefined ? 3 : o.sw}" ${o.x || ''}/>`;
const line = (x1, y1, x2, y2, o = {}) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${o.s || O}" stroke-width="${o.sw || 3}" stroke-linecap="round" ${o.x || ''}/>`;
const path = (d, fill, o = {}) =>
  `<path d="${d}" fill="${fill}" stroke="${o.s === undefined ? O : o.s}" stroke-width="${o.sw === undefined ? 3 : o.sw}" stroke-linejoin="round" stroke-linecap="round" ${o.x || ''}/>`;
const txt = (x, y, s, o = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-family="${o.font || 'Montserrat'}" font-weight="${o.w || 900}" font-size="${o.size || 24}" fill="${o.fill || '#fff'}" text-anchor="${o.a || 'middle'}" ${o.stroke ? `stroke="${o.stroke}" stroke-width="${o.sw || 6}" paint-order="stroke" stroke-linejoin="round"` : ''} ${o.x || ''}>${s}</text>`;

const DEFS = `<defs>
  <linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a55"/><stop offset="1" stop-color="#4d3868"/></linearGradient>
  <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1d5c"/><stop offset=".55" stop-color="#7a3a86"/><stop offset="1" stop-color="#f08a5d"/></linearGradient>
  <linearGradient id="phoneBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#101a36"/><stop offset="1" stop-color="#0b0d1c"/></linearGradient>
  <radialGradient id="peepV" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity=".95"/></radialGradient>
  <radialGradient id="warm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
  <radialGradient id="vign" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
  <radialGradient id="redV" cx=".5" cy=".4" r=".8"><stop offset=".3" stop-color="#e5283a" stop-opacity="0"/><stop offset="1" stop-color="#e5283a" stop-opacity=".55"/></radialGradient>
  <radialGradient id="folderBg" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#5a3f29"/><stop offset="1" stop-color="#2c1d13"/></radialGradient>
  <pattern id="quilt" width="62" height="62" patternUnits="userSpaceOnUse"><path d="M0,0 L62,62 M62,0 L0,62" stroke="#6c2128" stroke-width="2.5" fill="none"/><circle cx="31" cy="31" r="4" fill="#d9b964" stroke="${O}" stroke-width="1.5"/><circle cx="0" cy="0" r="4" fill="#d9b964" stroke="${O}" stroke-width="1.5"/><circle cx="62" cy="0" r="4" fill="#d9b964" stroke="${O}" stroke-width="1.5"/><circle cx="0" cy="62" r="4" fill="#d9b964" stroke="${O}" stroke-width="1.5"/><circle cx="62" cy="62" r="4" fill="#d9b964" stroke="${O}" stroke-width="1.5"/></pattern>
  <pattern id="quiltBig" width="150" height="150" patternUnits="userSpaceOnUse"><path d="M0,0 L150,150 M150,0 L0,150" stroke="#6c2128" stroke-width="4" fill="none"/><circle cx="75" cy="75" r="8" fill="#d9b964" stroke="${O}" stroke-width="3"/><circle cx="0" cy="0" r="8" fill="#d9b964" stroke="${O}" stroke-width="3"/><circle cx="150" cy="0" r="8" fill="#d9b964" stroke="${O}" stroke-width="3"/><circle cx="0" cy="150" r="8" fill="#d9b964" stroke="${O}" stroke-width="3"/><circle cx="150" cy="150" r="8" fill="#d9b964" stroke="${O}" stroke-width="3"/></pattern>
  <pattern id="stripes" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="#4a3a5e"/><rect x="0" width="3" height="48" fill="#544368"/><rect x="24" width="1.5" height="48" fill="#45365a"/></pattern>
  <clipPath id="peepClip"><circle cx="288" cy="300" r="245"/></clipPath>
  <clipPath id="storyClip"><rect x="0" y="0" width="456" height="770" rx="22"/></clipPath>
  <clipPath id="winClip"><rect x="0" y="0" width="190" height="240"/></clipPath>
</defs>`;

/* ---------- characters ---------- */

function boy(x, y, s, o = {}) {
  const { aL = [8, 0], aR = [-8, 0], phone = false, mouth = 'flat', look = [0, 0], legLen = 80, glow = 0, brow = 0, blink = false } = o;
  const hood = '#3aa66b', hoodD = '#2a7f52', skin = '#f3c9a2', pants = '#2a2540', hair = '#5a3520';
  const arm = (sx, a1, a2) => g(`translate(${sx},-84) rotate(${f(a1)})`,
    rect(-12, -6, 24, 50, hood, { rx: 12 }) +
    g(`translate(0,40) rotate(${f(a2)})`, rect(-11, -6, 22, 44, hood, { rx: 11 }) + circ(0, 44, 10, skin)));
  const legs = rect(-24, -legLen - 4, 21, legLen, pants, { rx: 6 }) + rect(3, -legLen - 4, 21, legLen, pants, { rx: 6 }) +
    line(-6, -legLen + 6, -6, -14, { s: '#e9e6f2', sw: 2.5 }) + line(21, -legLen + 6, 21, -14, { s: '#e9e6f2', sw: 2.5 }) +
    path('M-30,-2 Q-30,-14 -14,-12 L-2,-12 L-2,-2 Z', '#e9e6f2') + path('M30,-2 Q30,-14 14,-12 L2,-12 L2,-2 Z', '#e9e6f2');
  const m = mouth === 'o' ? ell(0, -114, 5, 6.5, '#5a1f2a', { sw: 2.5 })
    : mouth === 'smile' ? path('M-9,-118 Q0,-106 9,-118', '#fff', { sw: 2.5 })
    : mouth === 'talk' ? ell(0, -114, 6, 4.5, '#5a1f2a', { sw: 2.5 })
    : line(-6, -114, 6, -114, { sw: 2.5 });
  const eye = ex => blink ? line(ex - 7, -134, ex + 7, -134, { sw: 2.5 })
    : circ(ex, -134, 8.5, '#fff', { sw: 2.5 }) + circ(ex + look[0], -134 + look[1], 3.4, O, { s: 'none' });
  const upper =
    path('M-32,-80 Q-34,-94 -18,-96 L18,-96 Q34,-94 32,-80 L36,2 Q0,10 -36,2 Z', hood) +
    path('M-18,-24 L18,-24 L23,1 Q0,7 -23,1 Z', hoodD, { sw: 2.5 }) +
    path('M-22,-94 Q0,-76 22,-94 Q0,-106 -22,-94 Z', hoodD, { sw: 2.5 }) +
    line(-6, -86, -6, -62, { s: '#e9e6f2', sw: 2.5 }) + line(6, -86, 6, -66, { s: '#e9e6f2', sw: 2.5 }) +
    path('M20,-72 L13,-60 L19,-60 L15,-49 L26,-64 L20,-64 Z', '#ffd447', { sw: 1.5 }) +
    arm(-30, aL[0], aL[1]) + arm(30, aR[0], aR[1]) +
    (phone ? g('translate(0,-58) rotate(-6)', rect(-11, -18, 22, 36, '#15131c', { rx: 4, sw: 2.5 }) + rect(-8, -14, 16, 26, '#9fd0ff', { s: 'none', rx: 2 })) : '') +
    rect(-7, -108, 14, 16, skin, { sw: 2.5 }) +
    circ(-31, -132, 7, skin) + circ(31, -132, 7, skin) +
    ell(0, -134, 30, 32, skin) +
    (glow ? ell(0, -130, 28, 30, '#9fd0ff', { s: 'none', x: `opacity="${f(glow * 0.3)}"` }) : '') +
    path('M-31,-138 Q-36,-174 0,-171 Q36,-174 31,-138 Q24,-153 10,-150 Q-4,-146 -14,-153 Q-24,-150 -31,-138 Z', hair) +
    path('M2,-169 Q6,-184 17,-181', 'none') +
    eye(-12) + eye(12) +
    line(-19, -148 - brow * 4, -6, -148 + brow * 2, { sw: 3 }) + line(19, -148 - brow * 4, 6, -148 + brow * 2, { sw: 3 }) +
    circ(-18, -122, 1.3, '#c98c6a', { s: 'none' }) + circ(-22, -126, 1.3, '#c98c6a', { s: 'none' }) + circ(18, -122, 1.3, '#c98c6a', { s: 'none' }) + circ(22, -126, 1.3, '#c98c6a', { s: 'none' }) +
    m;
  return at(x, y, s, legs + g(`translate(0,${-legLen})`, upper));
}

function man(x, y, s, o = {}) {
  const { aL = [6, 0], aR = [-6, 0], mouth = 'flat', backView = false, look = [0, 0], ghostPatch = 0 } = o;
  const jk = '#2f62b8', jkD = '#234a8f', skin = '#e2b48f', pants = '#232a45';
  const L = 105;
  const arm = (sx, a1, a2) => g(`translate(${sx},-110) rotate(${f(a1)})`,
    rect(-13, -6, 26, 58, jk, { rx: 13 }) +
    g(`translate(0,48) rotate(${f(a2)})`, rect(-12, -6, 24, 52, jk, { rx: 12 }) + rect(-12, 34, 24, 10, jkD, { sw: 2.5 }) + circ(0, 54, 11, skin)));
  const legs = rect(-26, -L - 4, 23, L, pants, { rx: 6 }) + rect(3, -L - 4, 23, L, pants, { rx: 6 }) +
    path('M-34,-2 Q-34,-16 -16,-14 L-2,-14 L-2,-2 Z', '#15131c') + path('M34,-2 Q34,-16 16,-14 L2,-14 L2,-2 Z', '#15131c');
  const face = backView
    ? path('M-26,-150 Q-26,-124 0,-122 Q26,-124 26,-150 Z', '#4a3a36')
    : path('M-25,-146 Q-25,-119 0,-119 Q25,-119 25,-146 Q0,-128 -25,-146 Z', '#8d7f86', { s: 'none', x: 'opacity=".55"' }) +
      ell(-10, -154, 5.5, 4.2, '#fff', { sw: 2 }) + ell(10, -154, 5.5, 4.2, '#fff', { sw: 2 }) +
      circ(-10 + look[0], -154 + look[1], 2.4, O, { s: 'none' }) + circ(10 + look[0], -154 + look[1], 2.4, O, { s: 'none' }) +
      line(-18, -164, -5, -159, { sw: 3.5 }) + line(18, -164, 5, -159, { sw: 3.5 }) +
      path('M0,-150 L-3,-141 L3,-141', 'none', { sw: 2 }) +
      (mouth === 'talk' ? ell(1, -131, 6, 4, '#4a1a22', { sw: 2.2 }) : path('M-7,-132 Q2,-129 9,-134', 'none', { sw: 2.5 }));
  const upper =
    path('M-40,-104 Q-42,-120 -24,-122 L24,-122 Q42,-120 40,-104 L40,4 L-40,4 Z', jk) +
    (backView ? rect(-40, -62, 80, 12, '#c7d3ea', { sw: 2.5 })
      : line(0, -112, 0, 4, { sw: 2.5 }) +
        path('M-20,-122 L0,-100 L-8,-122 Z', jkD, { sw: 2.5 }) + path('M20,-122 L0,-100 L8,-122 Z', jkD, { sw: 2.5 }) +
        rect(-32, -86, 22, 18, jkD, { sw: 2.5, rx: 2 }) + rect(-40, -42, 80, 10, '#c7d3ea', { sw: 2.5 }) +
        (ghostPatch ? `<rect x="9" y="-93" width="24" height="17" rx="2" fill="none" stroke="#ffd447" stroke-width="1.6" stroke-dasharray="3 2.5" opacity="${f(ghostPatch)}"/>` : '')) +
    arm(-38, aL[0], aL[1]) + arm(38, aR[0], aR[1]) +
    rect(-8, -132, 16, 16, skin, { sw: 2.5 }) +
    (backView ? '' : circ(-26, -150, 6, skin) + circ(26, -150, 6, skin)) +
    ell(0, -150, 26, 30, skin) + face +
    path('M-28,-164 Q-30,-192 0,-192 Q30,-192 28,-164 Z', jkD) +
    (backView ? '' : path('M-32,-166 L32,-166 Q37,-158 27,-156 L-27,-156 Q-37,-158 -32,-166 Z', '#1b3870'));
  return at(x, y, s, legs + g(`translate(0,${-L})`, upper));
}

/* ---------- sets ---------- */

function skyline(dark) {
  const b = (x, y, w) => rect(x, y, w, 260, '#2a1c47', { sw: 2 }) +
    [0, 1, 2, 3, 4, 5].map(r => [0, 1, 2].map(c => ((r * 3 + c + x) % 3 ? rect(x + 6 + c * (w - 10) / 3, y + 8 + r * 16, 6, 8, '#ffd447', { s: 'none' }) : '')).join('')).join('');
  return `<g clip-path="url(#winClip)">${rect(0, 0, 190, 240, 'url(#skyG)', { s: 'none' })}
    ${ell(60, 46, 44, 5, '#f39a7b', { s: 'none', x: 'opacity=".7"' })}${ell(140, 84, 36, 4, '#f39a7b', { s: 'none', x: 'opacity=".6"' })}
    ${b(4, 150, 46)}${b(56, 120, 40)}${b(102, 162, 44)}${b(150, 132, 40)}
    ${rect(0, 0, 190, 240, '#140c2e', { s: 'none', x: `opacity="${f(dark * 0.45)}"` })}</g>`;
}

function living(t, dark) {
  return rect(0, 0, W, 580, 'url(#wallG)', { s: 'none' }) + rect(0, 566, W, H, '#261c36', { s: 'none' }) + rect(0, 556, W, 16, '#33273f', { sw: 2.5 }) +
    [660, 760, 880].map(y => line(0, y, W, y, { s: '#1f162d', sw: 3 })).join('') + line(150, 572, 110, 660, { s: '#1f162d', sw: 3 }) + line(420, 660, 450, 760, { s: '#1f162d', sw: 3 }) + line(200, 760, 170, 880, { s: '#1f162d', sw: 3 }) +
    ell(288, 800, 236, 70, '#7a2f4f') + ell(288, 800, 196, 52, 'none', { s: '#f08a5d', sw: 4 }) + ell(288, 800, 120, 28, '#8f3a5e', { sw: 2.5 }) +
    // window
    rect(318, 78, 214, 264, '#cfc4dd', { rx: 4 }) + g('translate(330,90)', skyline(dark)) +
    line(425, 90, 425, 330, { s: '#cfc4dd', sw: 8 }) + line(330, 200, 520, 200, { s: '#cfc4dd', sw: 8 }) + rect(330, 90, 190, 240, 'none') +
    path('M300,70 L352,70 Q344,220 322,352 L300,352 Z', '#7a2f4f') + path('M548,70 L500,70 Q506,220 528,352 L548,352 Z', '#7a2f4f') + rect(290, 60, 270, 12, '#33273f', { rx: 5 }) +
    // picture + lamp
    rect(60, 130, 110, 84, '#e8dfc8', { rx: 3 }) + rect(70, 140, 90, 64, '#5b7fb5', { sw: 2 }) + path('M70,204 L100,168 L122,190 L138,176 L160,204 Z', '#3aa66b', { sw: 2 }) + circ(140, 156, 8, '#ffd447', { sw: 2 }) +
    circ(66, 330, 110, 'url(#warm)', { s: 'none' }) + line(66, 350, 66, 560, { sw: 6 }) + path('M40,350 L92,350 L80,300 L52,300 Z', '#ffd98a') + ell(66, 562, 26, 6, '#33273f') +
    // sofa
    rect(84, 372, 404, 150, '#6b4a8a', { rx: 26 }) + rect(64, 430, 60, 132, '#7a569c', { rx: 20 }) + rect(448, 430, 60, 132, '#7a569c', { rx: 20 }) +
    rect(118, 470, 336, 74, '#7a569c', { rx: 14 }) + line(286, 474, 286, 540, { sw: 2.5 }) + rect(126, 540, 320, 24, '#573c72', { rx: 6 });
}

function hall(t) {
  const lamp = circ(310, 20, 230, 'url(#warm)', { s: 'none', x: 'opacity=".7"' });
  return rect(0, 0, W, H, 'url(#stripes)', { s: 'none' }) + lamp +
    rect(0, 640, W, 400, '#2a2033', { s: 'none' }) + rect(0, 628, W, 16, '#33273f', { sw: 2.5 }) +
    [720, 820, 940].map(y => line(0, y, W, y, { s: '#1f1727', sw: 3 })).join('') + [-1, 0, 1, 2, 3, 4].map(i => line(60 + i * 110, 644, -80 + i * 170, 1024, { s: '#1f1727', sw: 3 })).join('') +
    rect(170, 90, 280, 546, '#2e2230', { rx: 4 }) + rect(186, 106, 248, 528, '#8c2f35') + rect(186, 106, 248, 528, 'url(#quilt)') +
    circ(310, 250, 10, '#c9b27a') + circ(310, 250, 4, '#15131c', { s: 'none' }) +
    rect(202, 356, 24, 78, '#c9b27a', { rx: 7 }) + rect(207, 374, 62, 15, '#e0cc94', { rx: 7.5 }) + circ(214, 418, 5, '#8a7a4e', { sw: 2 }) +
    rect(196, 178, 26, 14, '#c9b27a', { rx: 3, sw: 2.5 }) + `<path d="M196,186 Q180,200 176,220" fill="none" stroke="#c9b27a" stroke-width="4" stroke-dasharray="5 4" stroke-linecap="round"/>` +
    // coat rack
    rect(468, 268, 96, 12, '#33273f', { rx: 5 }) + path('M482,280 Q470,330 474,430 L540,430 Q548,330 532,280 Z', '#c98a3a') + line(507, 290, 507, 428, { sw: 2.5 }) +
    path('M476,300 Q500,330 478,372', 'none', { s: '#7a2f4f', sw: 9 }) +
    // mat + shoes
    rect(196, 650, 228, 26, '#5b4a3a', { rx: 8 }) + path('M472,636 Q472,616 496,620 L514,626 L514,636 Z', '#e9e6f2') + path('M520,636 Q520,618 542,622 L558,628 L558,636 Z', '#e9e6f2');
}

function bell(t, ringing) {
  const j = ringing ? Math.sin(t * 80) * 3 : 0;
  let s = g(`translate(${f(j)},0)`, rect(470, 120, 58, 44, '#e8dfc8', { rx: 7 }) + circ(499, 142, 11, '#c9b27a') + circ(499, 142, 4, '#8a7a4e', { s: 'none' }));
  if (ringing) {
    const k = (t * 3) % 1;
    for (let i = 0; i < 3; i++) {
      const r = 34 + ((k + i / 3) % 1) * 46;
      s += `<circle cx="499" cy="142" r="${f(r)}" fill="none" stroke="#ffd447" stroke-width="4" opacity="${f(1 - (r - 34) / 46)}"/>`;
    }
  }
  return s;
}

function banner(t, t0, label) {
  const k = pop(t, t0, 0.3);
  return popAt(288, 150, k, rect(98, 124, 380, 52, '#1b1426', { rx: 9, s: '#ff7a2f', sw: 3.5 }) + txt(288, 159, label, { size: 23 }));
}

function landing(open) {
  const fx = 72 + 116 * (1 - 0.55 * open);
  return rect(0, 0, W, 340, '#d2c8b4', { s: 'none' }) + rect(0, 330, W, 160, '#4f7f7a', { s: 'none' }) + line(0, 330, W, 330, { s: '#35605c', sw: 5 }) +
    rect(0, 482, W, 140, '#463e4f', { s: 'none' }) + line(0, 482, W, 482, { sw: 3 }) +
    circ(288, 60, 150, 'url(#warm)', { s: 'none' }) + rect(268, 44, 40, 14, '#e8dfc8', { rx: 4, sw: 2.5 }) +
    // neighbour door
    rect(60, 146, 140, 338, '#3a2a22', { rx: 3 }) + rect(72, 158, 116, 324, '#120d16', { sw: 2 }) +
    (open > 0 ? `<polygon points="${f(fx)},160 188,160 188,482 ${f(fx)},482" fill="#ffc861" opacity="${f(0.75 * open)}"/><polygon points="${f(fx)},482 188,482 290,560 ${f(fx - 30)},560" fill="#ffc861" opacity="${f(0.3 * open)}"/>` : '') +
    `<polygon points="72,158 ${f(fx)},${f(158 + 12 * open)} ${f(fx)},${f(482 - 10 * open)} 72,482" fill="#6b4630" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
    circ(fx - 12, 330, 5, '#c9b27a', { sw: 2 }) +
    rect(108, 112, 44, 26, '#e8dfc8', { rx: 3, sw: 2.5 }) + txt(130, 132, '46', { size: 18, fill: O }) +
    (open > 0.5 ? g('translate(226,508) rotate(-18)', ell(0, 0, 24, 10, '#d96a8a') + path('M-4,-9 Q14,-16 22,-2 Q10,0 -4,-9 Z', '#f08fab', { sw: 2.5 })) : '') +
    // electric box + stairs rail
    rect(430, 180, 80, 104, '#8d8794', { rx: 3 }) + line(470, 180, 470, 284, { sw: 2 }) + path('M462,214 L452,236 L462,236 L456,254 L474,228 L464,228 Z', '#ffd447', { sw: 1.5 }) +
    line(430, 482, 576, 396, { sw: 7 }) + [0, 1, 2, 3].map(i => line(452 + i * 36, 470 - i * 21, 452 + i * 36, 540 - i * 21, { sw: 4 })).join('') +
    txt(378, 318, 'ЛЁХА', { size: 13, fill: '#8a8296', font: 'Caveat', w: 700 });
}

function peep(inner) {
  // Seen from inside: the dim padded door surrounds the lens.
  return rect(0, 0, W, H, '#3a1418', { s: 'none' }) + rect(0, 0, W, H, 'url(#quiltBig)', { s: 'none', x: 'opacity=".5"' }) + rect(0, 0, W, H, '#07050b', { s: 'none', x: 'opacity=".72"' }) +
    `<g clip-path="url(#peepClip)">${inner}<rect width="576" height="620" fill="#3b2a66" opacity=".22"/></g>` +
    circ(288, 300, 245, 'url(#peepV)', { s: 'none' }) + circ(288, 300, 251, 'none', { s: '#2b2536', sw: 14 }) + circ(288, 300, 259, 'none', { s: '#15101d', sw: 4 }) +
    `<path d="M120,190 A200,200 0 0 1 220,110" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".16"/>`;
}

function phoneFrame(inner, time = '19:53') {
  return rect(0, 0, W, H, 'url(#phoneBg)', { s: 'none' }) +
    rect(40, 56, 496, 934, '#14121c', { rx: 50, s: '#34344a', sw: 5 }) + rect(248, 76, 80, 16, '#07060a', { rx: 8, s: 'none' }) +
    txt(74, 98, time, { a: 'start', size: 18, w: 800 }) + rect(474, 82, 30, 15, 'none', { rx: 4, s: '#fff', sw: 2 }) + rect(477, 85, 20, 9, '#fff', { s: 'none', rx: 2 }) + inner;
}

const pin = (x, y, s, fill = '#e5283a') => at(x, y, s, path('M0,14 Q-12,-2 -12,-8 A12,12 0 1 1 12,-8 Q12,-2 0,14 Z', fill, { sw: 2.5 }) + circ(0, -8, 4, '#fff', { s: 'none' }));

function storyArt(t, rings) {
  const ring = (cx, cy, rx, ry, t0, rot) => {
    const p = prog(t, t0, t0 + 0.35);
    return p <= 0 ? '' : `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#e5283a" stroke-width="6" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${f(1 - eout(p))}" transform="rotate(${rot} ${cx} ${cy})"/>`;
  };
  return `<g clip-path="url(#storyClip)">` +
    rect(0, 0, 456, 770, 'url(#wallG)', { s: 'none' }) + rect(-10, 500, 476, 300, '#6b4a8a', { rx: 30 }) + rect(-10, 640, 476, 160, '#7a569c', { rx: 14 }) +
    boy(200, 930, 2.3, { mouth: 'smile', aL: [20, -150], aR: [-12, 0], look: [1, 0] }) +
    // pizza box with delivery label
    g('translate(352,650) rotate(-8)', rect(-70, -40, 140, 86, '#e8dfc8', { rx: 6 }) + circ(-22, 2, 26, '#e0733a', { sw: 2.5 }) + circ(-28, -4, 5, '#b3261e', { s: 'none' }) + circ(-14, 8, 5, '#b3261e', { s: 'none' }) +
      rect(10, -26, 52, 34, '#fff', { rx: 3, sw: 2 }) + txt(36, -3, 'КВ. 47', { size: 13, fill: O })) +
    g('translate(228,176) rotate(-5)', rect(-150, -52, 300, 104, '#fff', { rx: 12 }) + txt(0, -8, 'ОДИН ДОМА', { size: 38, fill: O }) + txt(0, 34, 'до 22:00', { size: 30, fill: '#e5283a' })) +
    g('translate(150,300) rotate(4)', rect(-112, -24, 224, 48, '#7c4dff', { rx: 24 }) + pin(-86, 0, 0.9, '#fff') + txt(14, 9, 'ЛЕСНАЯ 12', { size: 24 })) +
    rect(16, 14, 424, 6, '#fff', { rx: 3, s: 'none', x: 'opacity=".9"' }) + circ(42, 56, 18, '#3aa66b', { s: '#fff', sw: 2.5 }) +
    txt(70, 54, 'твоя история', { a: 'start', size: 18, w: 800 }) + txt(70, 74, '10 мин назад', { a: 'start', size: 14, w: 600, fill: '#d8d2e6' }) +
    (rings ? ring(228, 176, 172, 70, 39.0, -5) + ring(150, 300, 128, 38, 39.6, 4) + ring(388, 630, 50, 34, 40.2, -8) : '') + `</g>`;
}

/* ---------- scenes ---------- */

function scSofa(t) {
  const later = prog(t, 2.96, 3.9);
  const fly = eout(prog(t, 0.35, 0.95));
  const card = fly <= 0 ? '' : g(`translate(${f(lerp(250, 396, fly))},${f(lerp(430, 96, fly))}) rotate(${f(lerp(-20, 7, fly))}) scale(${f(lerp(0.05, 0.31, fly) * (1 + 0.04 * Math.sin(t * 5)))})`,
    rect(-12, -12, 480, 794, '#fff', { rx: 34, sw: 8 }) + storyArt(t, false)) ;
  const pill = popAt(288, 250, pop(t, 2.96, 0.3), rect(128, 222, 320, 56, '#1b1426', { rx: 10, s: '#ff7a2f', sw: 3.5 }) + txt(288, 259, '10 МИНУТ СПУСТЯ', { size: 24 }));
  return living(t, later) + boy(288, 566, 1.55, { legLen: 46, aL: [15, -115], aR: [-15, 115], phone: true, glow: 1, look: [0, 3], mouth: t < 2.4 ? 'smile' : 'flat', blink: (t % 2.1) < 0.1 }) +
    rect(0, 0, W, H, '#140c2e', { s: 'none', x: `opacity="${f(later * 0.3)}"` }) + card + (later > 0 ? pill : '');
}

function scBell(t) {
  const [sx, sy] = shake(t, 4.02, 1.4, 5);
  const k = pop(t, 4.05, 0.2);
  return g(`translate(${f(sx)},${f(sy)})`, hall(t) + bell(t, t < 5.5) +
    popAt(410, 250, k, g(`rotate(${f(-8 + Math.sin(t * 40) * 3)} 410 250)`, txt(410, 262, 'ДЗЫНЬ!', { size: 46, fill: '#ffd447', stroke: O, sw: 10 }))));
}

function scPeep(t) {
  const z = eio(prog(t, 10.3, 10.85));
  const k = lerp(1, 2.3, z), fx = 327, fy = 279;
  const talking = t > 8.36 && t < 9.94;
  const world = landing(0) + man(288 + Math.sin(t * 1.3) * 2, 640, 1.9, { mouth: talking && Math.sin(t * 22) > 0 ? 'talk' : 'flat', look: [0, 0.6], aR: [-10, 12], aL: [10, -12], ghostPatch: z });
  const bub = popAt(400, 150, pop(t, 8.3, 0.25) * (1 - prog(t, 10.2, 10.35)),
    path('M262,96 H520 Q536,96 536,112 V170 Q536,186 520,186 H372 L330,222 L340,186 H262 Q246,186 246,170 V112 Q246,96 262,96 Z', '#fff') +
    txt(391, 134, '«Газовая служба.', { size: 21, fill: O, w: 800 }) + txt(391, 164, 'Проверка».', { size: 21, fill: O, w: 800 }));
  const br = (x, y, dx, dy) => `<path d="M${x + dx * 26},${y} H${x} V${y + dy * 26}" fill="none" stroke="#ffd447" stroke-width="5" stroke-linecap="round"/>`;
  const p2 = pop(t, 10.9, 0.25);
  const hud = z < 1 ? '' : popAt(288, 300, p2, br(208, 246, 1, 1) + br(368, 246, -1, 1) + br(208, 354, 1, -1) + br(368, 354, -1, -1) +
    txt(288, 322, '?', { size: 62, fill: '#ffd447', stroke: O, sw: 9, x: `opacity="${f(0.65 + 0.35 * Math.sin(t * 9))}"` })) +
    popAt(288, 410, pop(t, 11.4, 0.25), rect(188, 388, 200, 42, '#e5283a', { rx: 6 }) + txt(288, 417, 'НАШИВКИ НЕТ', { size: 20 }));
  return peep(g(`translate(${f(lerp(fx, 288, z))},${f(lerp(fy, 300, z))}) scale(${f(k)}) translate(${-fx},${-fy})`, world)) + bub + hud;
}

function scNeighbor(t) {
  const open = eio(prog(t, 13.5, 14.7));
  const pan = eio(prog(t, 12.6, 13.4));
  const world = landing(open) + man(330, 640, 1.9, { look: [-2.2 * open, 0], aR: [-10, 12], aL: [10, -12] });
  return peep(g(`translate(${f(lerp(60, 150, pan))},-20) scale(1.12)`, world));
}

function scRule1(t) {
  const talk = t > 19.76 && t < 22.0;
  const xk = pop(t, 16.5, 0.22) * (1 - prog(t, 18.4, 18.7));
  const cross = popAt(310, 360, xk, line(240, 290, 380, 430, { s: '#e5283a', sw: 26 }) + line(380, 290, 240, 430, { s: '#e5283a', sw: 26 }) + circ(310, 360, 112, 'none', { s: '#e5283a', sw: 12 }));
  const words = [['«Папа', 19.76], ['спит,', 20.34], ['приходите', 20.78], ['позже!»', 21.24]];
  const shown = words.filter(w => t >= w[1] - 0.05).map(w => w[0]);
  const bub = popAt(250, 300, pop(t, 19.6, 0.25),
    path('M214,214 H528 Q546,214 546,232 V298 Q546,316 528,316 H262 L196,356 L226,316 H214 Q196,316 196,298 V232 Q196,214 214,214 Z', '#fff') +
    txt(371, 256, shown.slice(0, 2).join(' '), { size: 26, fill: O, w: 800 }) + txt(371, 292, shown.slice(2).join(' '), { size: 26, fill: O, w: 800 }));
  return hall(t) + bell(t, false) + cross +
    boy(104, 664, 1.5, { aR: talk ? [-58 + Math.sin(t * 6) * 4, -40] : [-8, 0], mouth: talk && Math.sin(t * 20) > 0 ? 'talk' : 'flat', look: [2.5, 0], brow: 1 }) +
    banner(t, 15.5, '1 · НЕ ОТКРЫВАЙ') + bub;
}

function scHandle(t) {
  const down = eio(prog(t, 22.0, 24.4));
  const snap = prog(t, 24.56, 24.86);
  const ang = t < 24.56 ? down * 27 + Math.sin(t * 31) * 0.8 * down : lerp(31, 0, back(snap));
  const [sx, sy] = shake(t, 24.56, 0.4, 12);
  const burst = t >= 24.56 && t < 25.2 ? [...Array(10)].map((_, i) => {
    const a = (i / 10) * Math.PI * 2, p = prog(t, 24.56, 25.1), r1 = 150 + p * 60, r2 = r1 + 50 * (1 - p);
    return line(300 + Math.cos(a) * r1, 330 + Math.sin(a) * r1, 300 + Math.cos(a) * r2, 330 + Math.sin(a) * r2, { s: '#fff', sw: 7, x: `opacity="${f(1 - p)}"` });
  }).join('') : '';
  const locked = t >= 24.56;
  const badge = popAt(440, 470, pop(t, 25.78, 0.25), circ(440, 470, 46, '#2bd45a', { sw: 4 }) + path('M418,470 L434,488 L464,452', 'none', { s: '#fff', sw: 10 }));
  return g(`translate(${f(sx)},${f(sy)})`,
    rect(-20, -20, 616, 1064, '#8c2f35', { s: 'none' }) + rect(-20, -20, 616, 1064, 'url(#quiltBig)', { s: 'none' }) +
    rect(-20, -20, 76, 1064, '#2e2230') +
    rect(196, 236, 96, 300, '#c9b27a', { rx: 16, sw: 4 }) + circ(244, 262, 6, '#8a7a4e', { sw: 2 }) + circ(244, 512, 6, '#8a7a4e', { sw: 2 }) +
    // thumb-turn
    circ(244, 450, 26, '#e0cc94', { sw: 4 }) + g(`rotate(${locked ? 90 * eout(prog(t, 24.56, 24.7)) : 0} 244 450)`, rect(236, 420, 16, 60, '#b89e5e', { rx: 8, sw: 3.5 })) +
    // lever
    g(`rotate(${f(ang)} 244 320)`, rect(222, 300, 200, 40, '#e0cc94', { rx: 20, sw: 4 }) + line(250, 310, 400, 310, { s: '#f3e6c0', sw: 5 })) + circ(244, 320, 30, '#d4be82', { sw: 4 }) + circ(244, 320, 9, '#8a7a4e', { sw: 2.5 }) +
    burst) + badge;
}

function scCall(t) {
  const sec = Math.max(0, Math.floor((t - 28.44) * 1));
  const dialing = t < 28.44;
  const rings = [0, 1, 2].map(i => { const k = ((t * 0.9) + i / 3) % 1; return `<circle cx="288" cy="300" r="${f(62 + k * 70)}" fill="none" stroke="#2bd45a" stroke-width="3" opacity="${f(0.7 * (1 - k))}"/>`; }).join('');
  const thumbY = lerp(1100, 880, eout(prog(t, 26.9, 27.3)));
  return phoneFrame(rings + circ(288, 300, 60, '#1f3a5c', { s: '#2bd45a', sw: 4 }) +
    path('M262,300 Q262,270 288,270 Q314,270 314,300', 'none', { s: '#fff', sw: 8 }) + rect(254, 296, 16, 28, '#fff', { rx: 6, s: 'none' }) + rect(306, 296, 16, 28, '#fff', { rx: 6, s: 'none' }) +
    popAt(288, 420, pop(t, 26.9, 0.25), txt(288, 446, '112', { size: 84 })) +
    txt(288, 494, 'Экстренная служба', { size: 22, w: 700, fill: '#9aa0b4' }) +
    txt(288, 534, dialing ? 'вызов…' : `00:0${Math.min(sec, 9)}`, { size: 24, font: 'JetBrains Mono', w: 800, fill: '#2bd45a' }) +
    circ(288, 860, 44, '#e5283a', { s: 'none' }) + rect(264, 852, 48, 16, '#fff', { rx: 8, s: 'none' }), '19:51') +
    g(`translate(430,${f(thumbY)}) rotate(-24)`, rect(-34, 0, 68, 300, '#3aa66b', { rx: 20 }) + rect(-30, -70, 60, 100, '#f3c9a2', { rx: 28 }));
}

const ICON = {
  addr: pin(0, 0, 1.5),
  floor: path('M-18,16 H-6 V4 H6 V-8 H18 V-20', 'none', { s: '#ffd447', sw: 5 }),
  look: path('M-16,-14 L-6,-18 L0,-12 L6,-18 L16,-14 L20,2 L12,4 L12,18 L-12,18 L-12,4 L-20,2 Z', '#2f62b8', { sw: 2.5 }),
  act: rect(-18, -8, 36, 12, '#e0cc94', { rx: 6, sw: 2.5 }) + circ(-16, -2, 9, '#c9b27a', { sw: 2.5 }) + path('M8,8 L8,20 M2,14 L8,20 L14,14', 'none', { s: '#e5283a', sw: 3.5 }),
};

function scCards(t) {
  const cards = [['АДРЕС', 'Лесная 12, кв. 47', 'addr', 30.64], ['ЭТАЖ', 'четвёртый', 'floor', 31.3], ['ПРИМЕТЫ', 'синяя форма, кепка', 'look', 31.78], ['ЧТО ДЕЛАЕТ', 'дёргает ручку', 'act', 32.68]];
  const body = cards.map((c, i) => {
    const x = 34 + (i % 2) * 262, y = 250 + Math.floor(i / 2) * 136, on = t >= c[3] - 0.05, k = on ? 1 + 0.08 * (1 - eout(prog(t, c[3], c[3] + 0.25))) : 1;
    return g(`translate(${x + 123},${y + 59}) scale(${f(k)}) translate(${-x - 123},${-y - 59})`,
      rect(x, y, 246, 118, on ? '#2c2456' : '#1f1a2b', { rx: 12, s: on ? '#ff9a5c' : '#2c2640', sw: on ? 4 : 3 }) +
      g(`translate(${x + 44},${y + 60})`, ICON[c[2]], on ? '' : 'opacity=".35"') +
      txt(x + 84, y + 54, c[0], { a: 'start', size: 21, fill: on ? '#fff' : '#6d6880' }) +
      txt(x + 84, y + 80, c[1], { a: 'start', size: 13.5, w: 700, fill: on ? '#ffb48a' : '#57526a' }) +
      popAt(x + 228, y + 12, pop(t, c[3], 0.25), circ(x + 228, y + 12, 15, '#2bd45a', { sw: 3 }) + path(`M${x + 221},${y + 12} L${x + 226},${y + 18} L${x + 236},${y + 6}`, 'none', { s: '#fff', sw: 4 })));
  }).join('');
  const waves = [0, 1, 2].map(i => `<path d="M${352 + i * 12},${198} q10,12 0,24" fill="none" stroke="#2bd45a" stroke-width="3.5" stroke-linecap="round" opacity="${f(0.35 + 0.65 * (Math.sin(t * 8 - i) > 0 ? 1 : 0))}"/>`).join('');
  const say = '«Лесная 12, квартира 47, четвёртый этаж. Мужчина в синей форме дёргает ручку двери».';
  const n = Math.floor(prog(t, 30.5, 33.2) * say.length);
  const typed = say.slice(0, n), cut = typed.lastIndexOf(' ', 30) > 0 && typed.length > 30 ? typed.lastIndexOf(' ', 30) : typed.length;
  const l1 = typed.slice(0, cut), rest = typed.slice(cut + 1), cut2 = rest.length > 32 ? rest.lastIndexOf(' ', 32) : rest.length;
  return rect(0, 0, W, H, '#17131f', { s: 'none' }) + banner(t, 29.2, '2 · ГОВОРИ ЧЁТКО') +
    rect(232, 190, 108, 40, '#2bd45a', { rx: 20 }) + txt(286, 219, '112', { size: 25 }) + waves + body +
    rect(34, 770, 508, 150, '#141a17', { rx: 12, s: '#2bd45a', sw: 3 }) + txt(54, 802, 'ТАК И ГОВОРИ:', { a: 'start', size: 15, fill: '#2bd45a' }) +
    txt(54, 836, l1, { a: 'start', size: 19, w: 800 }) + txt(54, 866, rest.slice(0, cut2), { a: 'start', size: 19, w: 800 }) + txt(54, 896, rest.slice(cut2 + 1), { a: 'start', size: 19, w: 800 });
}

function scLeave(t) {
  const p = eio(prog(t, 33.6, 35.0));
  const guy = p < 1 ? g('', man(lerp(300, 500, p), lerp(640, 500, p) + Math.abs(Math.sin(t * 9)) * 4, lerp(1.9, 0.8, p), { backView: true }), `opacity="${f(1 - prog(p, 0.8, 1))}"`) : '';
  return peep(landing(1) + guy);
}

function scExhale(t) {
  const up = eio(prog(t, 36.6, 37.2));
  const puffs = [0, 1, 2].map(i => {
    const p = prog(t, 35.5 + i * 0.18, 36.7 + i * 0.18);
    return p <= 0 || p >= 1 ? '' : circ(350 + p * 70 + i * 8, 372 - p * 60 - i * 12, 10 + p * 16, '#fff', { s: 'none', x: `opacity="${f(0.5 * (1 - p))}"` });
  }).join('');
  const sag = eout(prog(t, 35.3, 35.9)) * 10;
  return hall(t) + bell(t, false) +
    boy(310, 664 + sag * 0.4, 1.5, { aL: [lerp(8, 15, up), lerp(0, -115, up)], aR: [lerp(-8, -15, up), lerp(0, 115, up)], phone: up > 0.6, glow: up, mouth: t < 36.3 ? 'o' : 'flat', look: [0, up * 3], brow: 1 - up, blink: t > 35.45 && t < 36.0 }) + puffs;
}

function scStory(t) {
  const scan = 130 + ((t - 38.5) / 2.4) * 770;
  return phoneFrame(g('translate(60,130)', storyArt(t, true)) +
    `<rect x="60" y="${f(scan)}" width="456" height="4" fill="#e5283a" opacity=".7"/>` +
    ell(96, 936, 14, 9, 'none', { s: '#fff', sw: 3 }) + circ(96, 936, 4, '#fff', { s: 'none' }) + txt(120, 943, '1', { a: 'start', size: 20 }), '19:52');
}

function scFolder(t) {
  const items = [['АДРЕС', 41.1], ['ЭТАЖ', 41.98], ['ОДИН ДОМА', 42.8], ['ДО СКОЛЬКИ', 43.78], ['ИМЯ', 99]];
  const rows = items.map((it, i) => {
    const y = 338 + i * 54, p = prog(t, it[1], it[1] + 0.22);
    return rect(112, y - 28, 32, 32, '#f8efd6', { sw: 3 }) + txt(164, y, it[0], { a: 'start', size: 38, font: 'Caveat', w: 700, fill: '#2a2030' }) +
      (p > 0 ? `<path d="M116,${y - 14} L127,${y - 1} L146,${y - 34}" fill="none" stroke="#e5283a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${f(1 - p)}"/>` +
        line(162, y + 8, 162 + 250 * p, y + 6, { s: '#e5283a', sw: 3 }) : '');
  }).join('');
  const sp = prog(t, 44.15, 44.33);
  const [sx, sy] = shake(t, 44.33, 0.3, 9);
  const stamp = sp <= 0 ? '' : g(`translate(390,820) rotate(-11) scale(${f(lerp(2.6, 1, eout(sp)))})`,
    rect(-92, -38, 184, 76, 'none', { rx: 8, s: '#e5283a', sw: 6 }) + txt(0, 15, '4 из 5', { size: 42, fill: '#e5283a', x: 'font-style="italic"' }), `opacity="${f(sp)}"`);
  return rect(0, 0, W, H, 'url(#folderBg)', { s: 'none' }) + g(`translate(${f(sx)},${f(sy)})`,
    path('M56,154 L56,970 L520,970 L520,154 L306,154 L284,122 L92,122 Z', '#c9a15e', { sw: 4 }) +
    g('rotate(-1.2 288 560)', rect(84, 176, 408, 770, '#f3e6c3', { sw: 3.5 }) +
      txt(288, 232, 'ЧТО ОН ЗНАЕТ', { size: 27, font: 'JetBrains Mono', w: 800, fill: '#2a2030' }) + txt(288, 266, 'О ТЕБЕ', { size: 27, font: 'JetBrains Mono', w: 800, fill: '#2a2030' }) +
      line(112, 286, 464, 286, { s: '#2a2030', sw: 2.5 }) + rows + stamp) +
    rect(250, 108, 70, 26, '#e2cf8f', { sw: 2.5, x: 'transform="rotate(-4 285 121)" opacity=".9"' }));
}

function scViewers(t) {
  const r = eout(prog(t, 45.75, 46.1));
  const row = r <= 0 ? '' : g(`translate(${f((1 - r) * 80)},0)`,
    rect(66, 228, 444, 92, '#221f30', { rx: 16, s: '#e5283a', sw: 3 }) +
    circ(118, 274, 30, '#34344a') + circ(118, 266, 10, '#15131c', { s: 'none' }) + path('M98,292 Q118,268 138,292 Z', '#15131c', { s: 'none' }) +
    txt(166, 268, 'id84513290', { a: 'start', size: 23 }) + circ(172, 292, 5, '#e5283a', { s: 'none', x: `opacity="${f(0.4 + 0.6 * (Math.sin(t * 10) > 0))}"` }) +
    txt(184, 298, 'смотрит сейчас', { a: 'start', size: 16, w: 700, fill: '#ff8a96' }), `opacity="${f(r)}"`);
  const msg = 'красивая дверь.';
  const n = Math.floor(prog(t, 48.18, 49.3) * msg.length + 0.001);
  const dots = '...'.slice(0, 1 + Math.floor((t * 4) % 3));
  const m1 = popAt(100, 440, pop(t, 47.2, 0.25),
    txt(84, 384, 'Новое сообщение', { a: 'start', size: 17, w: 700, fill: '#9aa0b4' }) +
    rect(76, 400, 372, 78, '#2c2a3e', { rx: 26 }) + txt(104, 449, t < 48.18 ? dots : msg.slice(0, n), { a: 'start', size: 30, w: 800 }));
  const m2 = popAt(140, 530, pop(t, 49.58, 0.2), rect(76, 492, 132, 84, '#e5283a', { rx: 28 }) + txt(142, 552, '47', { size: 50 }));
  return phoneFrame(txt(74, 176, 'Просмотры', { a: 'start', size: 32 }) + popAt(300, 166, pop(t, 45.75, 0.25), circ(300, 166, 17, '#e5283a', { s: 'none' }) + txt(300, 174, '1', { size: 20 })) +
    line(66, 204, 510, 204, { s: '#2c2a3e', sw: 3 }) + row + m1 + m2, '19:53');
}

function scDoor(t) {
  const z = lerp(0.92, 1.12, eout(prog(t, 50.0, 50.5))) + (t - 50) * 0.03;
  const pulse = 1 + 0.05 * Math.sin((t - 50) * 14);
  const sh = eout(prog(t, 50.05, 50.7));
  const cross = g(`translate(288,282) scale(${f(pulse)})`, circ(0, 0, 80, 'none', { s: '#e5283a', sw: 6 }) + circ(0, 0, 96, 'none', { s: '#e5283a', sw: 2 }) +
    [0, 90, 180, 270].map(a => g(`rotate(${a})`, line(0, -112, 0, -66, { s: '#e5283a', sw: 6 }))).join(''));
  return g(`translate(288,282) scale(${f(z)}) translate(-288,-282)`,
    rect(-60, -60, 700, 1200, '#241a33', { s: 'none' }) + rect(-60, 880, 700, 300, '#18111f', { s: 'none' }) +
    rect(118, 108, 340, 776, '#1a1220', { rx: 4 }) + rect(136, 126, 304, 756, '#5e2228') + rect(136, 126, 304, 756, 'url(#quiltBig)') +
    rect(232, 244, 112, 76, '#c9b27a', { rx: 9, sw: 4 }) + txt(288, 300, '47', { size: 52, fill: O }) +
    circ(288, 400, 11, '#c9b27a') + circ(288, 400, 4, '#15131c', { s: 'none' }) + rect(392, 520, 22, 80, '#c9b27a', { rx: 7 }) +
    g(`translate(${f(lerp(-260, -40, sh))},0)`, path('M40,900 L40,420 Q40,360 90,350 Q70,320 76,286 Q84,240 130,240 Q176,240 184,286 Q190,320 170,350 Q220,360 220,420 L220,900 Z', '#0a070f', { s: 'none', x: 'opacity=".6"' })) + cross) +
    rect(0, 0, W, H, 'url(#redV)', { s: 'none' });
}

const SCENES = [
  { a: 0, b: 4.0, ts: 1, draw: scSofa, drift: 0.05 },
  { a: 4.0, b: 5.7, ts: 1, draw: scBell, drift: 0.08 },
  { a: 5.7, b: 12.55, ts: 1, draw: scPeep, drift: 0 },
  { a: 12.55, b: 15.45, ts: 1, draw: scNeighbor, drift: 0 },
  { a: 15.45, b: 22.0, ts: 1, draw: scRule1, drift: 0.04 },
  { a: 22.0, b: 26.75, ts: 1, draw: scHandle, drift: 0.06 },
  { a: 26.75, b: 29.2, ts: 0, draw: scCall, drift: 0.03 },
  { a: 29.2, b: 33.55, ts: 0, draw: scCards, drift: 0 },
  { a: 33.55, b: 35.2, ts: 1, draw: scLeave, drift: 0 },
  { a: 35.2, b: 38.45, ts: 1, draw: scExhale, drift: 0.06 },
  { a: 38.45, b: 40.9, ts: 0, draw: scStory, drift: 0.04 },
  { a: 40.9, b: 44.8, ts: 0, draw: scFolder, drift: 0.03 },
  { a: 44.8, b: 50.0, ts: 0, draw: scViewers, drift: 0.03 },
  { a: 50.0, b: DUR, ts: 1, draw: scDoor, drift: 0 },
];

/* ---------- overlays ---------- */

function stamp(t) {
  const mm = t < 2.96 ? 40 : t < 3.9 ? 40 + Math.floor(prog(t, 2.96, 3.9) * 10) : t < 22 ? 50 : t < 33.5 ? 51 : t < 44.8 ? 52 : 53;
  return circ(34, 56, 7, '#e5283a', { s: 'none', x: `opacity="${Math.sin(t * 5) > -0.3 ? 1 : 0.25}"` }) +
    txt(50, 65, `19:${mm}`, { a: 'start', size: 25, font: 'JetBrains Mono', w: 800, stroke: '#140f1d', sw: 6 });
}

const CAPTIONS = `ТЫ ВЫЛОЖИЛ СТОРИС:|«ОДИН ДОМА».|ЧЕРЕЗ ДЕСЯТЬ МИНУТ…|ЗВОНОК В ДВЕРЬ.|В ГЛАЗКЕ_— МУЖИК|В СИНЕЙ ФОРМЕ.|«ГАЗОВАЯ СЛУЖБА,|ПРОВЕРКА».|НО НА КУРТКЕ…|*НЕТ *НАШИВКИ.|А ЗА ЕГО СПИНОЙ|СОСЕД УЖЕ ОТКРЫЛ|СВОЮ ДВЕРЬ.|ПЕРВОЕ ПРАВИЛО:|*НЕ *ОТКРЫВАЙ.|И НЕ МОЛЧИ.|СКАЖИ ЧЕРЕЗ ДВЕРЬ:|«ПАПА СПИТ,|ПРИХОДИТЕ ПОЗЖЕ».|РУЧКА МЕДЛЕННО|ИДЁТ ВНИЗ.|*ЩЁЛК…|ЗАПЕРТО.|ПРАВИЛО ВТОРОЕ:|ЗВОНИ *112.|ГОВОРИ ЧЁТКО:|АДРЕС, ЭТАЖ,|КАК ВЫГЛЯДИТ,|ЧТО ДЕЛАЕТ.|ОН УХОДИТ.|ТЫ ВЫДЫХАЕШЬ…|И ОТКРЫВАЕШЬ|СВОЮ СТОРИС.|ОДНОЙ СТОРИС|ТЫ ОТДАЛ ЕМУ ВСЁ:|АДРЕС… ЭТАЖ…|ЧТО ТЫ ОДИН…|И ДО СКОЛЬКИ.|ПОД СТОРИС_—|НОВЫЙ ПРОСМОТР.|И СООБЩЕНИЕ:|«КРАСИВАЯ ДВЕРЬ.|*СОРОК *СЕМЬ».`;

let GROUPS = [];
function buildCaptions() {
  const spoken = window.WORDS.filter(w => /[\p{L}\p{N}]/u.test(w.w));
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = '900 50px Montserrat';
  let i = 0;
  GROUPS = CAPTIONS.split('|').map(str => {
    const words = str.split(' ').map(raw => {
      const red = raw.startsWith('*');
      const w = { text: raw.replace('*', '').replace('_', ' '), red, s: spoken[i].s, e: spoken[i].e };
      i++;
      return w;
    });
    const lines = [[]];
    for (const w of words) {
      const cur = lines[lines.length - 1];
      if (cur.length && ctx.measureText([...cur, w].map(x => x.text).join(' ')).width > 510) lines.push([w]); else cur.push(w);
    }
    return { words, lines, s: words[0].s, e: words[words.length - 1].e };
  });
  if (i !== spoken.length) throw new Error(`caption words ${i} != spoken words ${spoken.length}`);
  GROUPS.forEach((gr, k) => { gr.end = k + 1 < GROUPS.length ? Math.min(GROUPS[k + 1].s - 0.06, gr.e + 0.9) : DUR - 0.25; });
}

function captions(t) {
  const gr = GROUPS.find(x => t >= x.s - 0.06 && t < x.end);
  if (!gr) return '';
  const k = 0.88 + 0.12 * back(prog(t, gr.s - 0.06, gr.s + 0.08));
  const layer = (dy, shadow) => gr.lines.map((ln, i) =>
    `<text x="288" y="${645 + i * 54 + dy}" font-family="Montserrat" font-weight="900" font-size="50" text-anchor="middle" stroke="${shadow ? '#000' : '#140f1d'}" stroke-width="10" paint-order="stroke" stroke-linejoin="round">` +
    ln.map(w => `<tspan fill="${shadow ? '#000' : t >= w.s - 0.04 ? (w.red ? '#ff3b4e' : '#fff') : '#7f8698'}">${w.text}</tspan>`).join(' ') + `</text>`).join('');
  const cy = 645 + (gr.lines.length - 1) * 27 - 18;
  return g(`translate(288,${cy}) scale(${f(k)}) translate(-288,${-cy})`, g('', layer(5, true), 'opacity=".4"') + layer(0, false));
}

function renderFrame(t) {
  t = cl(t, 0, DUR);
  const sc = SCENES.find(s => t >= s.a && t < s.b) || SCENES[SCENES.length - 1];
  const z = 1 + sc.drift * prog(t, sc.a, sc.b) + 0.035 * (1 - eout(prog(t, sc.a, sc.a + 0.2)));
  const black = t > DUR - 0.25;
  document.getElementById('stage').innerHTML = DEFS + rect(0, 0, W, H, '#000', { s: 'none' }) +
    (black ? '' : g(`translate(288,420) scale(${f(z)}) translate(-288,-420)`, sc.draw(t)) + rect(0, 0, W, H, 'url(#vign)', { s: 'none' }) + (sc.ts ? stamp(t) : '')) +
    (black ? '' : captions(t));
}

window.DUR = DUR;
window.renderFrame = renderFrame;
window.ready = Promise.all(['900 50px Montserrat', '700 38px Caveat', '800 25px "JetBrains Mono"'].map(x => document.fonts.load(x, 'Жя1'))).then(() => {
  buildCaptions();
  renderFrame(0);
  if (!location.search.includes('render')) {
    // Interactive preview: click to play in sync with the mixed audio.
    document.body.classList.add('preview');
    const a = document.getElementById('voice');
    document.getElementById('stage').addEventListener('click', () => (a.paused ? a.play() : a.pause()));
    const tick = () => { renderFrame(a.currentTime); requestAnimationFrame(tick); };
    tick();
  }
});
