// 맵 질감 — 전부 코드로 그린다. 색 그림과 함께 높낮이 그림을 만들어, 화질이 높을 때는 요철(노멀) 지도로 쓴다.
// 그릴 때는 256 칸 기준으로 그리고, 실제 해상도(S)는 화질에 따라 256 또는 512.
const U = 256;
let S = 512, WANT_H = true, F = null;
export function setTexQuality(q) { const s = q === 'low' ? 256 : 512, h = q === 'high'; if (s !== S) F = null; S = s; WANT_H = h; }
export const texSize = () => S;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ───────────── 이어 붙여도 티 나지 않는 잡음 ─────────────
function valueNoise(cx, cy, seed) { // cx × cy 격자를 S × S 로 부드럽게 늘림 (0~1)
  const r = rng(seed), lat = new Float32Array(cx * cy), out = new Float32Array(S * S);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  for (let y = 0; y < S; y++) {
    const fy = (y / S) * cy, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty), r0 = (y0 % cy) * cx, r1 = ((y0 + 1) % cy) * cx;
    for (let x = 0; x < S; x++) {
      const fx = (x / S) * cx, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx), a = x0 % cx, b = (x0 + 1) % cx;
      const top = lat[r0 + a] + (lat[r0 + b] - lat[r0 + a]) * sx, bot = lat[r1 + a] + (lat[r1 + b] - lat[r1 + a]) * sx;
      out[y * S + x] = top + (bot - top) * sy;
    }
  }
  return out;
}
function fbm(base, oct, seed, gain = 0.5) {
  const out = new Float32Array(S * S);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) { const c = base << o; if (c > S / 2) break; const n = valueNoise(c, c, seed + o * 17); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; tot += amp; amp *= gain; }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
// a 큰 얼룩 · b 중간 얼룩 · c 잔 알갱이 · v 세로 줄무늬 · w 가로 줄무늬
function fields() {
  if (F) return F;
  const g = valueNoise(S / 4, S / 4, 91), r = rng(7), c = new Float32Array(S * S);
  for (let i = 0; i < c.length; i++) c[i] = g[i] * 0.55 + r() * 0.45;
  F = { a: fbm(3, 5, 11), b: fbm(10, 4, 23), c, v: valueNoise(S / 4, 3, 37), w: valueNoise(3, S / 4, 41), v2: valueNoise(S / 2, 6, 53) };
  return F;
}

// ───────────── 그리기 도구 ─────────────
function mk() { const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d', { willReadFrequently: true }); g.scale(S / U, S / U); return [cv, g]; }
function pixels(cv, fn) { // 점마다 밝기 배수
  const g = cv.getContext('2d'), im = g.getImageData(0, 0, S, S), d = im.data;
  for (let i = 0, p = 0; i < S * S; i++, p += 4) { const m = fn(i); d[p] *= m; d[p + 1] *= m; d[p + 2] *= m; }
  g.putImageData(im, 0, 0);
}
function tint(cv, col, fn) { // 점마다 col 쪽으로 섞는 정도 (0~1)
  const g = cv.getContext('2d'), im = g.getImageData(0, 0, S, S), d = im.data;
  for (let i = 0, p = 0; i < S * S; i++, p += 4) { const t = fn(i); if (t <= 0) continue; d[p] += (col[0] - d[p]) * t; d[p + 1] += (col[1] - d[p + 1]) * t; d[p + 2] += (col[2] - d[p + 2]) * t; }
  g.putImageData(im, 0, 0);
}
function hnoise(cv, fa, fb, fc) { // 높낮이 그림에 잡음을 더함 (255 기준)
  if (!cv) return;
  const N = fields(), g = cv.getContext('2d'), im = g.getImageData(0, 0, S, S), d = im.data;
  for (let i = 0, p = 0; i < S * S; i++, p += 4) { const v = d[p] + (N.a[i] - 0.5) * fa + (N.b[i] - 0.5) * fb + (N.c[i] - 0.5) * fc; d[p] = d[p + 1] = d[p + 2] = v; }
  g.putImageData(im, 0, 0);
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gray = (v) => { v = Math.max(0, Math.min(255, v | 0)); return `rgb(${v},${v},${v})`; };
const rgb = (r, g, b, a) => (a === undefined ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`);
function wrap(g, fn) { for (const dx of [-U, 0, U]) for (const dy of [-U, 0, U]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } }
function crack(g, r, n, len, col, w = 1) { // 갈라진 금
  g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round';
  for (let i = 0; i < n; i++) { let x = r() * U, y = r() * U, a = r() * 6.28; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { a += (r() - 0.5) * 1.3; x += Math.cos(a) * len * (0.5 + r()); y += Math.sin(a) * len * (0.5 + r()); g.lineTo(x, y); } g.stroke(); }
}

// 높낮이 그림 → 요철(노멀) 지도
export function normalMap(hc, k = 1) {
  const src = hc.getContext('2d').getImageData(0, 0, S, S).data, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), im = g.createImageData(S, S), d = im.data, kk = k * (S / 256) / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const xl = (x + S - 1) % S, xr = (x + 1) % S, yu = (y + S - 1) % S, yd = (y + 1) % S;
    let nx = (src[(y * S + xl) * 4] - src[(y * S + xr) * 4]) * kk, ny = (src[(yd * S + x) * 4] - src[(yu * S + x) * 4]) * kk;
    const l = 1 / Math.hypot(nx, ny, 1), o = (y * S + x) * 4;
    d[o] = (nx * l * 0.5 + 0.5) * 255; d[o + 1] = (ny * l * 0.5 + 0.5) * 255; d[o + 2] = (l * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return cv;
}

// ───────────── 질감 ─────────────
// 각 함수는 { c: 색 그림, h: 높낮이 그림(없을 수 있음), k: 요철 세기 } 를 돌려준다
const T = {};

T.asphalt = () => {
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(101), N = fields();
  g.fillStyle = '#4b4f56'; g.fillRect(0, 0, U, U);
  if (hg) { hg.fillStyle = gray(128); hg.fillRect(0, 0, U, U); }
  wrap(g, () => { // 덧씌운 자리와 기름 얼룩
    for (let i = 0; i < 2; i++) { g.fillStyle = rgb(58, 61, 67, 0.26); const x = r() * U, y = r() * U; g.fillRect(x, y, 30 + r() * 50, 18 + r() * 30); }
    for (let i = 0; i < 3; i++) { const x = r() * U, y = r() * U, rr = 8 + r() * 16, rg = g.createRadialGradient(x, y, 0, x, y, rr); rg.addColorStop(0, 'rgba(22,22,26,.2)'); rg.addColorStop(1, 'rgba(22,22,26,0)'); g.fillStyle = rg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  });
  for (let i = 0; i < 2600; i++) { const v = 70 + r() * 110; g.fillStyle = rgb(v, v, v + 4, 0.2 + r() * 0.3); const q = 0.5 + r() * 1.3; g.fillRect(r() * U, r() * U, q, q); } // 골재
  wrap(g, () => crack(g, rng(5), 4, 16, 'rgba(18,19,22,.5)', 0.9));
  if (hg) wrap(hg, () => crack(hg, rng(5), 4, 16, gray(60), 1.2));
  pixels(c, (i) => 0.92 + N.a[i] * 0.06 + (N.c[i] - 0.5) * 0.3);
  hnoise(h, 10, 20, 90);
  return { c, h, k: 1.1 };
};

T.concrete = () => {
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(202), N = fields();
  g.fillStyle = '#a9a8a1'; g.fillRect(0, 0, U, U);
  if (hg) { hg.fillStyle = gray(150); hg.fillRect(0, 0, U, U); }
  for (let i = 0; i < 520; i++) { g.fillStyle = rgb(70, 68, 62, 0.12 + r() * 0.2); const q = 0.5 + r() * 1.4; g.beginPath(); g.arc(r() * U, r() * U, q, 0, 7); g.fill(); } // 기포 자국
  // 거푸집 이음매와 고정 구멍 (질감 한 장 = 판 한 장)
  g.strokeStyle = 'rgba(52,51,48,.5)'; g.lineWidth = 2.4; g.strokeRect(0, 0, U, U);
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.strokeRect(2.2, 2.2, U - 4.4, U - 4.4);
  for (const [x, y] of [[22, 22], [234, 22], [22, 234], [234, 234]]) { g.fillStyle = 'rgba(40,40,38,.62)'; g.beginPath(); g.arc(x, y, 4.2, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(x - 0.8, y + 1.2, 4.2, 0.4, 2.4); g.fill(); }
  if (hg) { hg.strokeStyle = gray(70); hg.lineWidth = 3; hg.strokeRect(0, 0, U, U); for (const [x, y] of [[22, 22], [234, 22], [22, 234], [234, 234]]) { hg.fillStyle = gray(40); hg.beginPath(); hg.arc(x, y, 4.2, 0, 7); hg.fill(); } }
  wrap(g, () => crack(g, rng(9), 2, 14, 'rgba(60,58,54,.4)', 0.7));
  // 빗물 자국 (위에서 아래로)과 얼룩
  pixels(c, (i) => { const y = (i / S | 0) / S; return 0.93 + N.a[i] * 0.06 + (N.b[i] - 0.5) * 0.1 + (N.c[i] - 0.5) * 0.1 - sm(0.55, 0.9, N.v[i]) * 0.08 * (1 - y * 0.5); });
  tint(c, [112, 104, 88], (i) => sm(0.6, 0.9, N.b[i]) * 0.1);
  hnoise(h, 8, 14, 34);
  return { c, h, k: 0.9 };
};

T.brick = () => {
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(303), N = fields();
  g.fillStyle = '#8e877b'; g.fillRect(0, 0, U, U); // 줄눈
  if (hg) { hg.fillStyle = gray(70); hg.fillRect(0, 0, U, U); }
  const bh = 32, bw = 64, m = 2.4;
  for (let row = 0; row < U / bh; row++) for (let col = -1; col < U / bw + 1; col++) {
    const x = col * bw + (row % 2 ? bw / 2 : 0), y = row * bh, v = r(), k = r();
    const R = 150 + v * 44 - k * 22, G = 74 + v * 22 - k * 14, B = 56 + v * 16 - k * 8;
    for (const dx of [0, U, -U]) {
      g.fillStyle = rgb(R, G, B); g.fillRect(x + m + dx, y + m, bw - m * 2, bh - m * 2);
      g.fillStyle = 'rgba(255,225,200,.16)'; g.fillRect(x + m + dx, y + m, bw - m * 2, 3); g.fillRect(x + m + dx, y + m, 2, bh - m * 2);
      g.fillStyle = 'rgba(30,12,6,.26)'; g.fillRect(x + m + dx, y + bh - m - 4, bw - m * 2, 4); g.fillRect(x + bw - m - 2.4 + dx, y + m, 2.4, bh - m * 2);
      if (hg) { hg.fillStyle = gray(165 + v * 40); hg.fillRect(x + m + dx, y + m, bw - m * 2, bh - m * 2); }
    }
  }
  for (let i = 0; i < 70; i++) { g.fillStyle = rgb(60, 28, 18, 0.25 + r() * 0.3); const x = r() * U, y = r() * U; g.fillRect(x, y, 1 + r() * 4, 1 + r() * 2.5); } // 깨진 자리
  pixels(c, (i) => 0.9 + N.a[i] * 0.07 + (N.b[i] - 0.5) * 0.18 + (N.c[i] - 0.5) * 0.16);
  tint(c, [236, 228, 214], (i) => sm(0.7, 0.95, N.b[i]) * 0.2); // 흰 얼룩(백화)
  hnoise(h, 0, 22, 30);
  return { c, h, k: 1.5 };
};

function corrugated(n, light, dark, mid) { // 골이 진 철판 (세로 골 n 개)
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], w = U / n;
  for (let i = 0; i < n; i++) {
    const x = i * w, lg = g.createLinearGradient(x, 0, x + w, 0);
    lg.addColorStop(0, light); lg.addColorStop(0.3, mid); lg.addColorStop(0.5, dark); lg.addColorStop(0.62, mid); lg.addColorStop(1, light);
    g.fillStyle = lg; g.fillRect(x, 0, w + 0.5, U);
    if (hg) { const hl = hg.createLinearGradient(x, 0, x + w, 0); hl.addColorStop(0, gray(210)); hl.addColorStop(0.5, gray(60)); hl.addColorStop(1, gray(210)); hg.fillStyle = hl; hg.fillRect(x, 0, w + 0.5, U); }
  }
  return [c, g, h, hg];
}
T.metal = () => {
  const [c, g, h, hg] = corrugated(8, '#b6c2ca', '#74828b', '#93a1aa'), r = rng(404), N = fields();
  g.fillStyle = 'rgba(46,56,64,.6)'; g.fillRect(0, 0, U, 4); g.fillRect(0, U - 4, U, 4);
  g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, 4, U, 1.2);
  for (let x = 16; x < U; x += 32) for (const y of [9, U - 9]) { g.fillStyle = 'rgba(40,48,56,.75)'; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x - 0.5, y - 0.5, 0.8, 0, 7); g.fill(); }
  if (hg) { hg.fillStyle = gray(30); hg.fillRect(0, 0, U, 3); hg.fillRect(0, U - 3, U, 3); }
  pixels(c, (i) => 0.95 + N.a[i] * 0.05 + (N.c[i] - 0.5) * 0.08);
  tint(c, [124, 76, 42], (i) => { const y = (i / S | 0) / S; return sm(0.6, 0.86, N.v[i] * 0.6 + N.b[i] * 0.4) * (0.22 + y * 0.3); }); // 녹물
  hnoise(h, 0, 6, 10);
  return { c, h, k: 1.3 };
};
T.container = () => { // 흰 바탕 — 재질 색으로 물들임
  const [c, g, h, hg] = corrugated(16, '#f6f6f6', '#a4a4a4', '#d6d6d6'), r = rng(505), N = fields();
  g.fillStyle = '#8e8e8e'; g.fillRect(0, 0, U, 15); g.fillRect(0, U - 15, U, 15);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 0, U, 2); g.fillRect(0, U - 15, U, 1.5);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 15, U, 3); g.fillRect(0, U - 18, U, 3);
  if (hg) { hg.fillStyle = gray(235); hg.fillRect(0, 0, U, 15); hg.fillRect(0, U - 15, U, 15); }
  for (let i = 0; i < 26; i++) { g.fillStyle = rgb(70, 44, 26, 0.25 + r() * 0.3); g.fillRect(r() * U, 18 + r() * 200, 1 + r() * 3, 1 + r() * 4); } // 칠이 벗겨진 자리
  pixels(c, (i) => 0.94 + N.a[i] * 0.05 + (N.c[i] - 0.5) * 0.07);
  tint(c, [120, 72, 40], (i) => { const y = (i / S | 0) / S; return sm(0.62, 0.9, N.v[i] * 0.65 + N.b[i] * 0.35) * (0.16 + y * 0.34); });
  hnoise(h, 0, 5, 8);
  return { c, h, k: 1.5 };
};
T.roof = () => { // 골 지붕 철판
  const [c, g, h, hg] = corrugated(8, '#667279', '#3d464d', '#525d65'), N = fields();
  pixels(c, (i) => 0.86 + N.a[i] * 0.2 + (N.c[i] - 0.5) * 0.1);
  tint(c, [96, 70, 50], (i) => sm(0.66, 0.92, N.b[i]) * 0.25);
  hnoise(h, 0, 6, 10);
  return { c, h, k: 1.3 };
};

// 나뭇결이 있는 널빤지 한 장을 그림 (가로로 긴 결이면 hz = true)
function board(g, hg, r, x, y, w, hh, base, hz, hv = 190) {
  const v = r();
  g.fillStyle = rgb(base[0] + v * base[3], base[1] + v * base[3] * 0.8, base[2] + v * base[3] * 0.55); g.fillRect(x, y, w, hh);
  g.save(); g.beginPath(); g.rect(x, y, w, hh); g.clip();
  const n = Math.round((hz ? hh : w) / 2.2);
  for (let k = 0; k < n; k++) { // 결
    g.strokeStyle = r() < 0.5 ? rgb(40, 24, 10, 0.1 + r() * 0.2) : rgb(255, 230, 190, 0.06 + r() * 0.1); g.lineWidth = 0.4 + r() * 0.9;
    const o = (hz ? y : x) + r() * (hz ? hh : w), b1 = (r() - 0.5) * 5, b2 = (r() - 0.5) * 5; g.beginPath();
    if (hz) { g.moveTo(x, o); g.bezierCurveTo(x + w * 0.33, o + b1, x + w * 0.66, o + b2, x + w, o); } else { g.moveTo(o, y); g.bezierCurveTo(o + b1, y + hh * 0.33, o + b2, y + hh * 0.66, o, y + hh); }
    g.stroke();
  }
  if (r() < 0.45) { // 옹이
    const kx = x + w * (0.2 + r() * 0.6), ky = y + hh * (0.2 + r() * 0.6), kr = 1.5 + r() * 2.5;
    for (let q = 3; q > 0; q--) { g.strokeStyle = rgb(48, 28, 12, 0.22); g.lineWidth = 0.8; g.beginPath(); g.ellipse(kx, ky, kr * q * (hz ? 1.8 : 0.9), kr * q * (hz ? 0.9 : 1.8), 0, 0, 7); g.stroke(); }
    g.fillStyle = rgb(52, 30, 14, 0.75); g.beginPath(); g.ellipse(kx, ky, kr * (hz ? 1.3 : 0.8), kr * (hz ? 0.8 : 1.3), 0, 0, 7); g.fill();
  }
  g.restore();
  g.fillStyle = 'rgba(255,235,200,.13)'; g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, hh);
  g.fillStyle = 'rgba(24,14,6,.34)'; g.fillRect(x, y + hh - 1.2, w, 1.2); g.fillRect(x + w - 1.2, y, 1.2, hh);
  if (hg) { hg.fillStyle = gray(hv + v * 30); hg.fillRect(x + 0.8, y + 0.8, w - 1.6, hh - 1.6); }
}
T.planks = () => { // 세로 널
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(606), N = fields();
  g.fillStyle = '#2e1c0e'; g.fillRect(0, 0, U, U); if (hg) { hg.fillStyle = gray(60); hg.fillRect(0, 0, U, U); }
  const bw = U / 6;
  for (let i = 0; i < 6; i++) { const cut = 40 + r() * 170; board(g, hg, r, i * bw, 0, bw - 1.2, cut, [126, 88, 50, 30], false); board(g, hg, r, i * bw, cut + 1.2, bw - 1.2, U - cut - 1.2, [126, 88, 50, 30], false);
    for (const yy of [cut - 5, cut + 6]) for (const xx of [i * bw + 6, i * bw + bw - 8]) { g.fillStyle = 'rgba(28,20,14,.8)'; g.beginPath(); g.arc(xx, yy, 1.1, 0, 7); g.fill(); } }
  pixels(c, (i) => 0.86 + N.a[i] * 0.18 + (N.v2[i] - 0.5) * 0.14 + (N.c[i] - 0.5) * 0.08);
  hnoise(h, 0, 8, 12);
  return { c, h, k: 1.2 };
};
T.boards = () => { // 칠한 널벽 (밝은 바탕 — 재질 색으로 물들임)
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(707), N = fields();
  g.fillStyle = '#4a4238'; g.fillRect(0, 0, U, U); if (hg) { hg.fillStyle = gray(50); hg.fillRect(0, 0, U, U); }
  for (let i = 0; i < 8; i++) board(g, hg, r, i * 32, 0, 30.4, U, [208, 204, 196, 32], false, 200);
  for (let i = 0; i < 60; i++) { g.fillStyle = rgb(92, 78, 62, 0.25 + r() * 0.3); g.fillRect(r() * U, r() * U, 0.8 + r() * 2.5, 2 + r() * 9); } // 칠이 벗겨진 자리
  pixels(c, (i) => { const y = (i / S | 0) / S; return 0.88 + N.a[i] * 0.14 + (N.v2[i] - 0.5) * 0.1 + (N.c[i] - 0.5) * 0.07 - sm(0.8, 1, y) * 0.1; });
  hnoise(h, 0, 6, 10);
  return { c, h, k: 1.1 };
};
T.crate = () => {
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(808), N = fields();
  for (let i = 0; i < 6; i++) board(g, hg, r, 0, i * (U / 6), U, U / 6 - 1, [170, 130, 80, 26], true, 120);
  const frame = (pts, w) => { // 테두리와 가로대 (도드라짐)
    g.lineCap = 'butt'; g.lineJoin = 'miter';
    g.strokeStyle = 'rgba(30,18,8,.45)'; g.lineWidth = w + 3; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    g.strokeStyle = '#8a6336'; g.lineWidth = w; g.stroke();
    g.strokeStyle = 'rgba(255,225,170,.16)'; g.lineWidth = 1.2; g.save(); g.translate(-w / 2 + 1, -w / 2 + 1); g.stroke(); g.restore();
    if (hg) { hg.strokeStyle = gray(235); hg.lineWidth = w; hg.beginPath(); pts.forEach((p, i) => (i ? hg.lineTo(p[0], p[1]) : hg.moveTo(p[0], p[1]))); hg.stroke(); }
  };
  frame([[26, U - 26], [U - 26, 26]], 22);
  frame([[13, 13], [U - 13, 13], [U - 13, U - 13], [13, U - 13], [13, 13], [U - 13, 13]], 26);
  g.strokeStyle = 'rgba(26,16,8,.6)'; g.lineWidth = 2; g.strokeRect(1, 1, U - 2, U - 2);
  for (const [x, y] of [[13, 13], [U - 13, 13], [13, U - 13], [U - 13, U - 13], [128, 13], [128, U - 13], [13, 128], [U - 13, 128]]) { g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(x - 0.8, y - 0.8, 1.2, 0, 7); g.fill(); }
  pixels(c, (i) => 0.86 + N.a[i] * 0.2 + (N.w[i] - 0.5) * 0.12 + (N.c[i] - 0.5) * 0.08);
  hnoise(h, 0, 6, 12);
  return { c, h, k: 1.4 };
};

T.barrier = () => {
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(909), N = fields();
  g.fillStyle = '#b5b3aa'; g.fillRect(0, 0, U, U); if (hg) { hg.fillStyle = gray(150); hg.fillRect(0, 0, U, U); }
  g.save(); g.beginPath(); g.rect(0, 0, U, 70); g.clip();
  for (let i = -4; i < 12; i++) { g.fillStyle = i % 2 ? '#e2b32a' : '#26282b'; g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 32, 0); g.lineTo(i * 32 + 102, 70); g.lineTo(i * 32 + 70, 70); g.fill(); }
  g.restore();
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 70, U, 3); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, 73, U, 1.5);
  const lg = g.createLinearGradient(0, U - 60, 0, U); lg.addColorStop(0, 'rgba(60,56,50,0)'); lg.addColorStop(1, 'rgba(60,56,50,.5)'); g.fillStyle = lg; g.fillRect(0, U - 60, U, 60); // 아래쪽 때
  for (let i = 0; i < 46; i++) { g.fillStyle = rgb(120, 118, 110, 0.5 + r() * 0.4); g.fillRect(r() * U, r() * 70, 1 + r() * 5, 1 + r() * 3); } // 긁힌 칠
  if (hg) { hg.fillStyle = gray(90); hg.fillRect(0, 70, U, 3); }
  pixels(c, (i) => 0.86 + N.a[i] * 0.2 + (N.c[i] - 0.5) * 0.12 - sm(0.6, 0.9, N.v[i]) * 0.08);
  hnoise(h, 6, 12, 30);
  return { c, h, k: 0.9 };
};
T.barrel = () => {
  const [c, g] = mk(), r = rng(111), N = fields();
  g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, U, U);
  for (const y of [0, 76, 168, 244]) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, y, U, 12); g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(0, y + 1, U, 2.4); }
  for (let i = 0; i < 40; i++) { g.fillStyle = rgb(70, 44, 26, 0.3 + r() * 0.3); g.fillRect(r() * U, r() * U, 1 + r() * 5, 1 + r() * 3); }
  pixels(c, (i) => 0.86 + N.a[i] * 0.2 + (N.c[i] - 0.5) * 0.08);
  tint(c, [110, 66, 36], (i) => sm(0.66, 0.92, N.b[i] * 0.5 + N.v[i] * 0.5) * 0.3);
  return { c, h: null, k: 0 };
};
T.shelf = () => { // 창고 선반: 칸마다 상자
  const [c, g] = mk(), r = rng(121), N = fields();
  g.fillStyle = '#20242a'; g.fillRect(0, 0, U, U);
  for (let row = 0; row < 3; row++) {
    const y = row * 85 + 6;
    for (let col = 0; col < 4; col++) {
      const v = r(), w = 44 + r() * 14, hh = 44 + r() * 22, x = col * 64 + 7, kind = r();
      const base = kind < 0.6 ? [176 + v * 26, 140 + v * 22, 90 + v * 18] : kind < 0.8 ? [60 + v * 20, 90 + v * 30, 130 + v * 30] : [150 + v * 20, 60 + v * 16, 50 + v * 12];
      g.fillStyle = rgb(base[0], base[1], base[2]); g.fillRect(x, y + 70 - hh, w, hh);
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, y + 70 - hh, w, 2.5); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + w - 3, y + 70 - hh, 3, hh);
      g.fillStyle = 'rgba(90,60,30,.5)'; g.fillRect(x + w / 2 - 3, y + 70 - hh, 6, hh);
      g.fillStyle = 'rgba(245,245,235,.8)'; g.fillRect(x + 4, y + 70 - hh * 0.55, 10, 7);
    }
    g.fillStyle = '#df7a22'; g.fillRect(0, y + 70, U, 9); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, y + 70, U, 1.6); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y + 79, U, 3);
  }
  for (const x of [0, 124, U - 8]) { g.fillStyle = '#3a5fa8'; g.fillRect(x, 0, 8, U); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x, 0, 2, U); for (let y = 6; y < U; y += 12) { g.fillStyle = 'rgba(10,20,40,.5)'; g.fillRect(x + 3, y, 2.4, 5); } }
  pixels(c, (i) => 0.9 + N.a[i] * 0.14 + (N.c[i] - 0.5) * 0.06);
  return { c, h: null, k: 0 };
};

// 회칠이 떨어져 벽돌이 드러난 자리 하나 (둘레가 울퉁불퉁한 조각)
function brickPatch(g, hg, x, y, rad, seed) {
  const q = rng(seed), pts = [];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.283, rr = rad * (0.62 + q() * 0.55); pts.push([x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr * 0.82]); }
  const path = (c) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); };
  for (const [c, isH] of [[g, false], [hg, true]]) {
    if (!c) continue;
    c.save(); path(c); c.clip();
    c.fillStyle = isH ? gray(84) : '#7d654c'; c.fillRect(x - rad * 2, y - rad * 2, rad * 4, rad * 4);
    const q2 = rng(seed + 9), y0 = Math.floor((y - rad * 1.2) / 10) * 10;
    for (let row = 0; row < Math.ceil((rad * 2.4) / 10) + 1; row++) for (let col = -1; col < Math.ceil((rad * 3.4) / 22) + 1; col++) {
      const bx = Math.floor((x - rad * 1.7) / 22) * 22 + col * 22 + (row % 2 ? 11 : 0), by = y0 + row * 10, v = q2();
      c.fillStyle = isH ? gray(118 + v * 26) : rgb(168 + v * 34, 98 + v * 26, 66 + v * 18); c.fillRect(bx + 1, by + 1, 20, 8);
      if (!isH) { c.fillStyle = 'rgba(255,220,190,.16)'; c.fillRect(bx + 1, by + 1, 20, 1.6); c.fillStyle = 'rgba(40,18,8,.28)'; c.fillRect(bx + 1, by + 7.2, 20, 1.8); }
    }
    c.restore();
    if (!isH) { // 떨어져 나간 가장자리: 위쪽은 그늘, 아래쪽은 밝은 테
      c.save(); path(c); c.lineWidth = 2.2; c.strokeStyle = 'rgba(56,34,16,.5)'; c.stroke(); c.clip(); c.translate(0, 2.4); path(c); c.lineWidth = 3; c.strokeStyle = 'rgba(30,16,6,.34)'; c.stroke(); c.restore();
    } else { c.save(); path(c); c.lineWidth = 1.6; c.strokeStyle = gray(150); c.stroke(); c.restore(); }
  }
}
T.plaster = () => { // 흙벽: 회칠 벽, 군데군데 떨어져 벽돌이 드러남
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(131), N = fields();
  g.fillStyle = '#dbc7a6'; g.fillRect(0, 0, U, U);
  if (hg) { hg.fillStyle = gray(190); hg.fillRect(0, 0, U, U); }
  // 흙손 자국 (넓고 흐린 붓질)
  wrap(g, () => { for (let i = 0; i < 46; i++) { const x = r() * U, y = r() * U, l = 24 + r() * 44, a = (r() - 0.5) * 0.9; g.strokeStyle = r() < 0.5 ? 'rgba(255,244,220,.04)' : 'rgba(110,80,44,.035)'; g.lineWidth = 5 + r() * 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } });
  wrap(g, () => crack(g, rng(14), 1, 11, 'rgba(96,66,38,.3)', 0.7));
  if (hg) wrap(hg, () => crack(hg, rng(14), 1, 11, gray(140), 1.1));
  pixels(c, (i) => { const y = (i / S | 0) / S; return 0.95 + N.a[i] * 0.05 + (N.b[i] - 0.5) * 0.07 + (N.c[i] - 0.5) * 0.08 - sm(0.62, 0.92, N.v[i]) * 0.05 * (1 - y * 0.6); });
  tint(c, [150, 118, 84], (i) => sm(0.6, 0.9, N.b[i]) * 0.08); // 얼룩
  hnoise(h, 6, 14, 30);
  return { c, h, k: 1.1 };
};
T.stucco = () => { // 흰 회벽
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], N = fields();
  g.fillStyle = '#ede7db'; g.fillRect(0, 0, U, U); if (hg) { hg.fillStyle = gray(128); hg.fillRect(0, 0, U, U); }
  wrap(g, () => crack(g, rng(15), 1, 11, 'rgba(120,108,92,.28)', 0.7));
  pixels(c, (i) => { const y = (i / S | 0) / S; return 0.94 + N.a[i] * 0.05 + (N.b[i] - 0.5) * 0.08 + (N.c[i] - 0.5) * 0.07 - sm(0.62, 0.92, N.v[i]) * 0.06 * (1 - y * 0.5); });
  tint(c, [150, 140, 118], (i) => sm(0.62, 0.92, N.b[i]) * 0.08);
  hnoise(h, 10, 30, 50);
  return { c, h, k: 0.7 };
};
T.sandFloor = () => {
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(141), N = fields();
  g.fillStyle = '#cdae7e'; g.fillRect(0, 0, U, U); if (hg) { hg.fillStyle = gray(128); hg.fillRect(0, 0, U, U); }
  wrap(g, () => { for (let i = 0; i < 70; i++) { const x = r() * U, y = r() * U, a = 1.2 + r() * 2.6, b = 0.8 + r() * 1.8, v = r(); g.fillStyle = 'rgba(70,48,24,.3)'; g.beginPath(); g.ellipse(x + 0.8, y + 0.9, a, b, r() * 3, 0, 7); g.fill(); g.fillStyle = rgb(150 + v * 60, 128 + v * 50, 98 + v * 40); g.beginPath(); g.ellipse(x, y, a, b, r() * 3, 0, 7); g.fill(); if (hg) { hg.fillStyle = gray(200); hg.beginPath(); hg.ellipse(x, y, a, b, 0, 0, 7); hg.fill(); } } });
  // 바람결: 가로 줄무늬 잡음
  pixels(c, (i) => 0.94 + N.a[i] * 0.05 + (N.w[i] - 0.5) * 0.04 + (N.c[i] - 0.5) * 0.16 + (N.b[i] - 0.5) * 0.08);
  tint(c, [236, 214, 170], (i) => sm(0.6, 0.9, N.b[i]) * 0.14);
  hnoise(h, 16, 30, 60);
  return { c, h, k: 0.8 };
};

function blocks(g, hg, r, rows, wMin, wMax, base, vary, gap = 2) { // 크기가 제각각인 돌 블록 (좌우로 이어 붙여도 맞음)
  const rh = U / rows;
  for (let row = 0; row < rows; row++) {
    const y = row * rh, ws = []; let tot = 0;
    while (tot < U) { const w = wMin + r() * (wMax - wMin); ws.push(w); tot += w; }
    let x = r() * wMin;
    for (const w0 of ws) {
      const w = (w0 * U) / tot, v = r();
      for (const xx of x + w > U ? [x, x - U] : [x]) {
        g.fillStyle = rgb(base[0] + v * vary, base[1] + v * vary * 0.92, base[2] + v * vary * 0.8); g.fillRect(xx + gap / 2, y + gap / 2, w - gap, rh - gap);
        g.fillStyle = 'rgba(255,250,235,.15)'; g.fillRect(xx + gap / 2, y + gap / 2, w - gap, 3); g.fillRect(xx + gap / 2, y + gap / 2, 2, rh - gap);
        g.fillStyle = 'rgba(20,16,10,.25)'; g.fillRect(xx + gap / 2, y + rh - gap / 2 - 3.5, w - gap, 3.5); g.fillRect(xx + w - gap / 2 - 2.2, y + gap / 2, 2.2, rh - gap);
        if (hg) { hg.fillStyle = gray(160 + v * 60); hg.fillRect(xx + gap / 2 + 0.6, y + gap / 2 + 0.6, w - gap - 1.2, rh - gap - 1.2); }
      }
      x = (x + w) % U;
    }
  }
}
T.stone = () => {
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(151), N = fields();
  g.fillStyle = '#5c564b'; g.fillRect(0, 0, U, U); if (hg) { hg.fillStyle = gray(50); hg.fillRect(0, 0, U, U); }
  blocks(g, hg, r, 4, 46, 96, [150, 141, 122], 38, 3);
  wrap(g, () => crack(g, rng(16), 3, 9, 'rgba(50,44,36,.4)', 0.7));
  pixels(c, (i) => 0.89 + N.a[i] * 0.06 + (N.b[i] - 0.5) * 0.22 + (N.c[i] - 0.5) * 0.14);
  tint(c, [96, 110, 70], (i) => sm(0.62, 0.9, N.b[i]) * 0.12); // 이끼
  hnoise(h, 0, 30, 36);
  return { c, h, k: 1.5 };
};
T.tiles = () => { // 바닥 타일 (밝은 바탕 — 재질 색으로 물들임)
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(161), N = fields();
  g.fillStyle = '#8c7a60'; g.fillRect(0, 0, U, U); if (hg) { hg.fillStyle = gray(70); hg.fillRect(0, 0, U, U); }
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const v = r(), x = col * 64 + 1.6, y = row * 64 + 1.6, w = 60.8;
    g.fillStyle = (row + col) % 2 ? rgb(200 + v * 16, 176 + v * 14, 136 + v * 12) : rgb(186 + v * 16, 144 + v * 14, 108 + v * 12); g.fillRect(x, y, w, w);
    g.fillStyle = 'rgba(255,245,225,.16)'; g.fillRect(x, y, w, 2); g.fillRect(x, y, 2, w); g.fillStyle = 'rgba(40,26,12,.2)'; g.fillRect(x, y + w - 2.4, w, 2.4); g.fillRect(x + w - 2.4, y, 2.4, w);
    if (hg) { hg.fillStyle = gray(190 + v * 20); hg.fillRect(x + 0.5, y + 0.5, w - 1, w - 1); }
    if (r() < 0.3) { g.strokeStyle = 'rgba(60,40,24,.4)'; g.lineWidth = 0.7; g.beginPath(); let cx = x + r() * w, cy = y; g.moveTo(cx, cy); for (let k = 0; k < 4; k++) { cx += (r() - 0.5) * 16; cy += w / 4; g.lineTo(Math.min(x + w, Math.max(x, cx)), cy); } g.stroke(); }
  }
  pixels(c, (i) => 0.92 + N.a[i] * 0.06 + (N.b[i] - 0.5) * 0.12 + (N.c[i] - 0.5) * 0.1);
  hnoise(h, 0, 10, 22);
  return { c, h, k: 1.1 };
};
T.shingle = () => { // 기와 (밝은 바탕 — 재질 색으로 물들임)
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(171), N = fields();
  g.fillStyle = '#7c7c7c'; g.fillRect(0, 0, U, U); if (hg) { hg.fillStyle = gray(60); hg.fillRect(0, 0, U, U); }
  for (let row = 0; row < 8; row++) for (let col = -1; col < 9; col++) {
    const v = r(), x = col * 32 + (row % 2 ? 16 : 0), y = row * 32, lg = g.createLinearGradient(0, y, 0, y + 32);
    lg.addColorStop(0, gray(150 + v * 50)); lg.addColorStop(0.75, gray(215 + v * 40)); lg.addColorStop(1, gray(235 + v * 20)); g.fillStyle = lg;
    g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + 31, y); g.lineTo(x + 31, y + 24); g.quadraticCurveTo(x + 16, y + 33, x + 1, y + 24); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.26)'; g.fillRect(x + 1, y, 30, 4);
    if (hg) { const hl = hg.createLinearGradient(0, y, 0, y + 32); hl.addColorStop(0, gray(90)); hl.addColorStop(1, gray(240)); hg.fillStyle = hl; hg.beginPath(); hg.moveTo(x + 1, y); hg.lineTo(x + 31, y); hg.lineTo(x + 31, y + 24); hg.quadraticCurveTo(x + 16, y + 33, x + 1, y + 24); hg.closePath(); hg.fill(); }
  }
  pixels(c, (i) => 0.84 + N.a[i] * 0.2 + (N.b[i] - 0.5) * 0.16 + (N.c[i] - 0.5) * 0.08);
  hnoise(h, 0, 8, 12);
  return { c, h, k: 1.3 };
};
T.cloth = () => { // 줄무늬 천
  const [c, g] = mk(), r = rng(181), N = fields();
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#efe2c6' : '#b5402f'; g.fillRect(i * 32, 0, 32, U); }
  g.globalAlpha = 0.1; for (let y = 0; y < U; y += 2) { g.fillStyle = y % 4 ? '#000' : '#fff'; g.fillRect(0, y, U, 1); } for (let x = 0; x < U; x += 2) { g.fillStyle = x % 4 ? '#000' : '#fff'; g.fillRect(x, 0, 1, U); } g.globalAlpha = 1; // 올
  pixels(c, (i) => 0.84 + N.a[i] * 0.2 + (N.w[i] - 0.5) * 0.14 + (N.c[i] - 0.5) * 0.06);
  return { c, h: null, k: 0 };
};
T.gravel = () => { // 자갈 (밝은 쪽에서 빛을 받는 돌멩이)
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(191), N = fields();
  g.fillStyle = '#4e4b45'; g.fillRect(0, 0, U, U); if (hg) { hg.fillStyle = gray(40); hg.fillRect(0, 0, U, U); }
  wrap(g, () => { for (let i = 0; i < 1700; i++) { const x = r() * U, y = r() * U, a = 1.4 + r() * 2.8, b = 1.1 + r() * 2, rot = r() * 3, v = 86 + r() * 80;
    g.fillStyle = 'rgba(16,14,12,.45)'; g.beginPath(); g.ellipse(x + 1, y + 1.4, a, b, rot, 0, 7); g.fill();
    g.fillStyle = rgb(v + 8, v + 3, v - 6); g.beginPath(); g.ellipse(x, y, a, b, rot, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,250,240,.2)'; g.beginPath(); g.ellipse(x - a * 0.25, y - b * 0.3, a * 0.5, b * 0.4, rot, 0, 7); g.fill(); } });
  if (hg) wrap(hg, () => { const q = rng(191); for (let i = 0; i < 1700; i++) { const x = q() * U, y = q() * U, a = 1.4 + q() * 2.8, b = 1.1 + q() * 2, rot = q() * 3; q(); const rg = hg.createRadialGradient(x, y, 0, x, y, a); rg.addColorStop(0, gray(240)); rg.addColorStop(1, gray(120)); hg.fillStyle = rg; hg.beginPath(); hg.ellipse(x, y, a, b, rot, 0, 7); hg.fill(); } });
  pixels(c, (i) => 0.93 + N.a[i] * 0.06 + (N.c[i] - 0.5) * 0.1);
  return { c, h, k: 1.4 };
};
T.hay = () => {
  const [c, g] = mk(), r = rng(211), N = fields();
  g.fillStyle = '#c4a040'; g.fillRect(0, 0, U, U);
  wrap(g, () => { for (let i = 0; i < 1500; i++) { g.strokeStyle = ['rgba(244,220,128,.55)', 'rgba(132,98,36,.5)', 'rgba(206,176,84,.55)', 'rgba(255,238,170,.4)'][i % 4]; g.lineWidth = 0.7 + r() * 0.8; const x = r() * U, y = r() * U, l = 10 + r() * 26; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.3) * l, y + (r() - 0.5) * 7); g.stroke(); } });
  for (const y of [76, 172]) { g.fillStyle = 'rgba(84,56,22,.55)'; g.fillRect(0, y, U, 6); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, y, U, 1.4); }
  pixels(c, (i) => 0.84 + N.a[i] * 0.22 + (N.c[i] - 0.5) * 0.08);
  return { c, h: null, k: 0 };
};
T.grassFloor = () => {
  const [c, g] = mk(), [h, hg] = WANT_H ? mk() : [null, null], r = rng(221), N = fields();
  g.fillStyle = '#5a8c44'; g.fillRect(0, 0, U, U); if (hg) { hg.fillStyle = gray(128); hg.fillRect(0, 0, U, U); }
  wrap(g, () => {
    for (let i = 0; i < 5200; i++) { const v = r(), x = r() * U, y = r() * U, l = 2.5 + r() * 5; g.strokeStyle = rgb(44 + v * 80, 96 + v * 90, 36 + v * 50, 0.35 + r() * 0.4); g.lineWidth = 0.7 + r() * 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2.4, y - l); g.stroke(); }
    for (let i = 0; i < 24; i++) { const x = r() * U, y = r() * U; g.fillStyle = r() < 0.6 ? 'rgba(250,250,240,.85)' : 'rgba(250,220,90,.85)'; g.beginPath(); g.arc(x, y, 0.9, 0, 7); g.fill(); } // 들꽃
  });
  pixels(c, (i) => 0.91 + N.a[i] * 0.07 + (N.b[i] - 0.5) * 0.14 + (N.c[i] - 0.5) * 0.1);
  tint(c, [140, 150, 70], (i) => sm(0.6, 0.86, N.b[i]) * 0.22);  // 마른 풀빛
  hnoise(h, 10, 40, 80);
  return { c, h, k: 0.9 };
};
T.grassDetail = () => { // 섬 땅에 곱하는 잔무늬 (회색)
  const [c, g] = mk(), r = rng(231), N = fields();
  g.fillStyle = '#808080'; g.fillRect(0, 0, U, U);
  wrap(g, () => { for (let i = 0; i < 7000; i++) { const v = 90 + r() * 80; g.strokeStyle = rgb(v, v, v, 0.55); g.lineWidth = 0.6 + r() * 0.5; const x = r() * U, y = r() * U; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4); g.stroke(); } });
  pixels(c, (i) => 0.84 + N.b[i] * 0.3 + (N.c[i] - 0.5) * 0.2);
  return { c, h: null, k: 0 };
};
T.dirt = () => { // 흙바닥 (담장 밖 땅 등)
  const [c, g] = mk(), r = rng(241), N = fields();
  g.fillStyle = '#8a7256'; g.fillRect(0, 0, U, U);
  wrap(g, () => { for (let i = 0; i < 160; i++) { const x = r() * U, y = r() * U, a = 1 + r() * 2.4, v = r(); g.fillStyle = 'rgba(40,28,16,.3)'; g.beginPath(); g.ellipse(x + 0.7, y + 0.8, a, a * 0.7, 0, 0, 7); g.fill(); g.fillStyle = rgb(120 + v * 50, 104 + v * 44, 84 + v * 36); g.beginPath(); g.ellipse(x, y, a, a * 0.7, 0, 0, 7); g.fill(); } });
  pixels(c, (i) => 0.91 + N.a[i] * 0.07 + (N.b[i] - 0.5) * 0.14 + (N.c[i] - 0.5) * 0.14);
  return { c, h: null, k: 0 };
};

// ───────────── 덧붙이는 무늬 (벽의 얼룩·금·벗겨진 자리·표지, 바닥의 기름 얼룩·맨홀 등) ─────────────
// 4 × 4 칸짜리 그림 한 장. 칸마다 바탕이 비치는 그림 하나. DECALS[i] = [가로 m, 세로 m, 붙는 자리(0 아무 데나, 1 벽 위쪽에 맞춤, 2 벽 아래쪽에 맞춤, 3 바닥)]
export const DECALS = [
  [1.7, 1.25, 0], [1.1, 0.95, 0], [0.8, 2.1, 0], [1.5, 0.62, 0],
  [1.3, 1.9, 1], [0.7, 1.5, 0], [2.0, 1.0, 2], [1.5, 1.5, 0],
  [0.72, 1.0, 0], [0.6, 0.6, 0], [1.2, 0.72, 0], [0.8, 0.56, 0],
  [1.9, 1.9, 3], [1.05, 1.05, 3], [2.6, 2.6, 3], [2.4, 2.4, 3],
];
export function decalAtlas() {
  const N = 1024, C = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const cell = (i, fn) => { g.save(); g.translate((i % 4) * C, (i >> 2) * C); g.beginPath(); g.rect(6, 6, C - 12, C - 12); g.clip(); fn(rng(900 + i * 31)); g.restore(); };
  const blob = (r, x, y, rad, n = 12, sx = 1.3, sy = 0.82, jag = 0.55) => { const pts = []; for (let k = 0; k < n; k++) { const a = (k / n) * 6.283, rr = rad * (1 - jag / 2 + r() * jag); pts.push([x + Math.cos(a) * rr * sx, y + Math.sin(a) * rr * sy]); } return pts; };
  const path = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
  const bricks = (r, x0, y0, x1, y1) => { // 드러난 벽돌
    g.fillStyle = '#75604a'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let row = 0, y = y0; y < y1; row++, y += 15) for (let x = x0 - (row % 2 ? 17 : 0); x < x1; x += 34) {
      const v = r(); g.fillStyle = rgb(160 + v * 40, 92 + v * 30, 62 + v * 20); g.fillRect(x + 1.5, y + 1.5, 31, 12);
      g.fillStyle = 'rgba(255,225,195,.18)'; g.fillRect(x + 1.5, y + 1.5, 31, 2.2); g.fillStyle = 'rgba(40,18,8,.3)'; g.fillRect(x + 1.5, y + 10.6, 31, 2.9);
    }
  };
  const patch = (r, x, y, rad, sx, sy) => { // 회칠이 떨어진 자리: 안쪽 벽돌 + 떨어져 나간 가장자리의 그늘
    const pts = blob(r, x, y, rad, 13, sx, sy);
    g.save(); path(pts); g.clip(); bricks(r, x - rad * sx - 4, y - rad * sy - 4, x + rad * sx + 4, y + rad * sy + 4);
    g.translate(0, 5); path(pts); g.lineWidth = 9; g.strokeStyle = 'rgba(26,14,6,.42)'; g.stroke(); g.restore();
    path(pts); g.lineWidth = 2.4; g.strokeStyle = 'rgba(70,48,28,.7)'; g.stroke();
  };
  const crackLine = (r, x, y, a, len, w, depth = 0) => { // 가지 치는 금
    g.lineCap = 'round'; g.lineJoin = 'round';
    const pts = [[x, y]]; let steps = Math.max(3, Math.round(len / 13));
    for (let k = 0; k < steps; k++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 13 * (0.6 + r() * 0.8); y += Math.sin(a) * 13 * (0.6 + r() * 0.8); pts.push([x, y]); if (depth < 2 && r() < 0.24) crackLine(r, x, y, a + (r() < 0.5 ? 0.8 : -0.8), len * 0.42, w * 0.62, depth + 1); }
    for (const [dx, dy, col, lw] of [[1.2, 1.2, 'rgba(255,255,255,.22)', w * 0.7], [0, 0, 'rgba(18,14,10,.86)', w]]) { g.strokeStyle = col; g.beginPath(); pts.forEach((p, i) => { g.lineWidth = lw * (1 - (i / pts.length) * 0.65); i ? g.lineTo(p[0] + dx, p[1] + dy) : g.moveTo(p[0] + dx, p[1] + dy); }); g.stroke(); }
  };
  const soft = (x, y, rx, ry, col, a) => { g.save(); g.translate(x, y); g.scale(1, ry / rx); const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx); rg.addColorStop(0, `rgba(${col},${a})`); rg.addColorStop(0.55, `rgba(${col},${a * 0.55})`); rg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = rg; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore(); };
  const streak = (r, x, y, len, w, col, a) => { const lg = g.createLinearGradient(0, y, 0, y + len); lg.addColorStop(0, `rgba(${col},${a})`); lg.addColorStop(0.3, `rgba(${col},${a * 0.6})`); lg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = lg; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.lineTo(x + w * 0.18 + (r() - 0.5) * 3, y + len); g.lineTo(x - w * 0.18 + (r() - 0.5) * 3, y + len); g.fill(); };

  cell(0, (r) => { patch(r, 128, 126, 76, 1.22, 0.86); for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = 96 + r() * 16; const pts = blob(r, clampN(128 + Math.cos(a) * d * 1.1, 26, 230), clampN(126 + Math.sin(a) * d * 0.8, 26, 230), 5 + r() * 6, 7, 1.2, 0.9); path(pts); g.fillStyle = 'rgba(96,66,44,.85)'; g.fill(); } });
  cell(1, (r) => { patch(r, 118, 132, 54, 1.25, 0.9); patch(r, 204, 70, 20, 1.2, 0.9); for (let i = 0; i < 7; i++) { const pts = blob(r, 30 + r() * 196, 30 + r() * 196, 3 + r() * 5, 7, 1.2, 0.9); path(pts); g.fillStyle = 'rgba(90,62,42,.8)'; g.fill(); } });
  cell(2, (r) => { crackLine(r, 120 + r() * 20, 12, Math.PI / 2, 230, 3.4); });
  cell(3, () => { // 컨테이너·창고 벽의 표기 (지어낸 글자)
    g.fillStyle = 'rgba(245,245,238,.92)'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = '900 54px "Arial Black", Arial, sans-serif'; g.fillText('SQCU', 14, 60);
    g.font = '900 44px "Arial Black", Arial, sans-serif'; g.fillText('407 218', 14, 118);
    g.font = '700 19px Arial, sans-serif'; for (const [t, y] of [['MAX GR  30,480 KG', 164], ['TARE     2,250 KG', 188], ['CU.CAP.   33.2 CBM', 212]]) g.fillText(t, 16, y);
    g.strokeStyle = 'rgba(245,245,238,.92)'; g.lineWidth = 3; g.strokeRect(196, 96, 44, 44); g.font = '900 30px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('2', 218, 120);
    g.globalCompositeOperation = 'destination-out'; const q = rng(77); for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${q() * 0.6})`; g.fillRect(q() * 256, q() * 256, 1 + q() * 5, 1 + q() * 2.5); }
  });
  cell(4, (r) => { for (let i = 0; i < 16; i++) streak(r, 22 + r() * 212, 6, 90 + r() * 150, 5 + r() * 16, '34,28,22', 0.2 + r() * 0.3); soft(128, 8, 120, 26, '30,26,20', 0.4); });
  cell(5, (r) => { for (let i = 0; i < 9; i++) streak(r, 82 + r() * 92, 34 + r() * 14, 90 + r() * 120, 4 + r() * 12, '150,74,26', 0.3 + r() * 0.35); const pts = blob(r, 128, 40, 30, 11, 1.5, 0.5); path(pts); g.fillStyle = 'rgba(120,56,20,.85)'; g.fill(); soft(128, 40, 54, 22, '170,90,34', 0.5); });
  cell(6, (r) => { for (let i = 0; i < 26; i++) soft(20 + r() * 216, 250 - r() * r() * 150, 16 + r() * 34, 12 + r() * 26, r() < 0.6 ? '52,76,38' : '34,48,30', 0.24 + r() * 0.3); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${40 + r() * 40 | 0},${70 + r() * 50 | 0},${30 + r() * 20 | 0},${0.3 + r() * 0.4})`; const y = 250 - r() * r() * 170; g.fillRect(12 + r() * 232, y, 1 + r() * 3, 1 + r() * 3); } });
  cell(7, (r) => { for (let i = 0; i < 9; i++) soft(128 + (r() - 0.5) * 80, 128 + (r() - 0.5) * 80, 40 + r() * 50, 36 + r() * 50, '24,22,20', 0.16 + r() * 0.16); });
  cell(8, (r) => { // 찢어진 벽보 (지어낸 도안)
    g.save(); g.translate(128, 128); g.rotate(-0.035);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-78, -108, 164, 224);
    g.beginPath(); g.moveTo(-84, -114); g.lineTo(84, -114); g.lineTo(84, 70); g.lineTo(60, 92); g.lineTo(70, 112); g.lineTo(-84, 112); g.closePath(); g.fillStyle = '#e4dcc8'; g.fill();
    g.fillStyle = '#c2452f'; g.fillRect(-84, -114, 168, 58);
    g.fillStyle = '#f2ead6'; g.font = '900 34px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SQUAD', 0, -94); g.font = '900 22px Arial, sans-serif'; g.fillText('CLASH', 0, -68);
    g.fillStyle = '#2f5f8a'; g.beginPath(); g.arc(0, -8, 30, 0, 7); g.fill(); g.fillStyle = '#e4dcc8'; g.beginPath(); g.moveTo(-12, -22); g.lineTo(18, -8); g.lineTo(-12, 6); g.fill();
    g.fillStyle = 'rgba(40,40,44,.75)'; for (let i = 0; i < 5; i++) g.fillRect(-64, 38 + i * 13, 128 - (i === 4 ? 60 : r() * 30), 5);
    g.fillStyle = 'rgba(90,80,60,.22)'; for (let i = 0; i < 40; i++) g.fillRect(-84 + r() * 168, -114 + r() * 226, 2 + r() * 14, 1 + r() * 3);
    g.restore();
  });
  cell(9, () => { // 주의 표지
    g.save(); g.translate(128, 132);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-98, -96, 204, 204);
    g.fillStyle = '#e9c21f'; g.fillRect(-104, -104, 208, 208); g.strokeStyle = '#1b1c1e'; g.lineWidth = 9; g.strokeRect(-92, -92, 184, 184);
    g.beginPath(); g.moveTo(0, -66); g.lineTo(70, 56); g.lineTo(-70, 56); g.closePath(); g.lineJoin = 'round'; g.lineWidth = 13; g.stroke();
    g.fillStyle = '#1b1c1e'; g.fillRect(-7, -30, 14, 46); g.beginPath(); g.arc(0, 34, 8.5, 0, 7); g.fill();
    for (const [x, y] of [[-78, -78], [78, -78], [-78, 78], [78, 78]]) { g.fillStyle = '#6a6c70'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
    g.restore();
  });
  cell(10, () => { // 벽에 찍은 구역 번호와 화살표
    g.fillStyle = 'rgba(246,244,236,.9)'; g.font = '900 120px "Arial Black", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('07', 12, 108);
    g.beginPath(); g.moveTo(176, 84); g.lineTo(214, 84); g.lineTo(214, 62); g.lineTo(248, 108); g.lineTo(214, 154); g.lineTo(214, 132); g.lineTo(176, 132); g.closePath(); g.fill();
    g.fillRect(12, 182, 236, 12); g.font = '900 30px Arial, sans-serif'; g.fillText('SECTOR', 12, 222);
    g.globalCompositeOperation = 'destination-out'; const q = rng(78); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(0,0,0,${q() * 0.7})`; g.fillRect(q() * 256, q() * 256, 1 + q() * 7, 1 + q() * 3); }
  });
  cell(11, (r) => { // 환풍구
    g.fillStyle = 'rgba(0,0,0,.34)'; g.fillRect(22, 44, 222, 176);
    g.fillStyle = '#8a9299'; g.fillRect(14, 34, 228, 176); g.fillStyle = '#5c646c'; g.fillRect(26, 46, 204, 152);
    for (let y = 52; y < 192; y += 18) { const lg = g.createLinearGradient(0, y, 0, y + 15); lg.addColorStop(0, '#b4bcc3'); lg.addColorStop(0.5, '#7c858d'); lg.addColorStop(1, '#22262b'); g.fillStyle = lg; g.fillRect(28, y, 200, 15); }
    for (const [x, y] of [[20, 40], [236, 40], [20, 204], [236, 204]]) { g.fillStyle = '#3a4046'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    for (let i = 0; i < 5; i++) streak(r, 40 + r() * 176, 210, 18 + r() * 24, 5 + r() * 9, '40,34,28', 0.3);
  });
  cell(12, (r) => { for (let i = 0; i < 12; i++) soft(128 + (r() - 0.5) * 96, 128 + (r() - 0.5) * 96, 30 + r() * 46, 26 + r() * 40, '14,13,16', 0.22 + r() * 0.22); soft(128, 128, 60, 52, '8,8,10', 0.5); for (let i = 0; i < 3; i++) soft(104 + r() * 50, 104 + r() * 50, 30, 16, i ? '96,76,140' : '60,116,126', 0.1); });
  cell(13, () => { // 맨홀 뚜껑
    g.save(); g.translate(128, 128);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(0, 0, 116, 0, 7); g.fill();
    g.fillStyle = '#3c4046'; g.beginPath(); g.arc(0, 0, 110, 0, 7); g.fill(); g.fillStyle = '#5a5f66'; g.beginPath(); g.arc(0, 0, 98, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(0, 0, 92, 0, 7); g.clip(); for (let y = -96; y < 96; y += 18) for (let x = -96; x < 96; x += 18) { g.fillStyle = (x + y) % 36 ? '#474c53' : '#6c727a'; g.fillRect(x + 2, y + 2, 13, 13); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x + 2, y + 2, 13, 2.5); } g.restore();
    g.strokeStyle = '#2a2d32'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 96, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 34, 0, 7); g.stroke(); g.fillStyle = '#4c5158'; g.beginPath(); g.arc(0, 0, 31, 0, 7); g.fill();
    for (const a of [0.6, 3.74]) { g.fillStyle = '#17181b'; g.beginPath(); g.ellipse(Math.cos(a) * 68, Math.sin(a) * 68, 9, 5, a, 0, 7); g.fill(); }
    g.restore();
  });
  cell(14, (r) => { for (let i = 0; i < 3; i++) crackLine(r, 128, 128, (i / 3) * 6.28 + r(), 116, 3.2); crackLine(r, 128, 128, 4 + r(), 60, 2.2, 1); });
  cell(15, (r) => { // 흩어진 부스러기 (낙엽·모래·잔돌 — 색은 맵에 맞춰 물들임)
    for (let i = 0; i < 9; i++) soft(128 + (r() - 0.5) * 120, 128 + (r() - 0.5) * 120, 40 + r() * 40, 30 + r() * 36, '255,255,255', 0.07 + r() * 0.08);
    for (let i = 0; i < 150; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 112, v = 190 + r() * 65 | 0; g.fillStyle = `rgba(${v},${v},${v},${0.45 + r() * 0.5})`; g.save(); g.translate(128 + Math.cos(a) * d, 128 + Math.sin(a) * d); g.rotate(r() * 3); g.beginPath(); g.ellipse(0, 0, 2.5 + r() * 4, 1.4 + r() * 2, 0, 0, 7); g.fill(); g.restore(); }
  });
  return cv;
}
const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);

// 여러 곳에서 겹쳐 쓰는 회색 잡음 (가까이에서 곱하는 잔무늬, 하늘 구름, 물결)
T.noise = () => {
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), im = g.createImageData(S, S), d = im.data, N = fields(), n2 = fbm(5, 5, 77), n3 = fbm(4, 6, 131, 0.55);
  for (let i = 0, p = 0; i < S * S; i++, p += 4) { d[p] = N.a[i] * 255; d[p + 1] = n2[i] * 255; d[p + 2] = n3[i] * 255; d[p + 3] = 255; }
  g.putImageData(im, 0, 0);
  return { c: cv, h: null, k: 0 };
};
T.detail = () => { // 가까이에서 곱하는 잔 알갱이 (평균 밝기 0.5)
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), im = g.createImageData(S, S), d = im.data, N = fields();
  for (let i = 0, p = 0; i < S * S; i++, p += 4) { const v = 128 + (N.c[i] - 0.5) * 150 + (N.b[i] - 0.5) * 60; d[p] = d[p + 1] = d[p + 2] = v; d[p + 3] = 255; }
  g.putImageData(im, 0, 0);
  return { c: cv, h: null, k: 0 };
};

export const TEX = T;
