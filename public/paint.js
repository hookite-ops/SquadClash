// SQUAD CLASH — 그림을 그릴 수 있는 캐릭터
// 캐릭터는 머리·몸통·팔 둘·다리 둘, 여섯 덩어리로 된 하얀 인형이고, 앞·뒤 두 장에 그린 그림이 몸에 그대로 입혀진다.
// 그림 자료: 256 × 256 그림 한 장 (왼쪽 절반 = 앞, 오른쪽 절반 = 뒤, 위쪽이 머리). 주고받을 때는 압축한 그림(data URL).
import * as THREE from './vendor/three.module.js';

export const SW = 128, SH = 256, AW = SW * 2, PAINT_MAX = 60000;
const DW = 0.95, DH = 1.9, HW = DW / 2; // 그림 한 장이 덮는 몸 크기 (m)
export const isPaint = (v) => typeof v === 'string' && v.length > 100 && v.length <= PAINT_MAX && /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(v);
const PARTS = [[-0.205, 1.44, 0.205, 1.82], [-0.24, 0.76, 0.24, 1.44], [-0.475, 0.76, -0.24, 1.44], [0.24, 0.76, 0.475, 1.44], [-0.24, 0, 0, 0.76], [0, 0, 0.24, 0.76]]; // 머리, 몸통, 팔 둘, 다리 둘 (m)

function face(g) { // 기본 얼굴: 눈과 웃는 입 (앞 장 머리 자리)
  g.fillStyle = '#17181b'; for (const x of [53, 75]) { g.beginPath(); g.ellipse(x, 31, 3.6, 5.6, 0, 0, 7); g.fill(); }
  g.strokeStyle = '#17181b'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.arc(64, 36, 11, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
}
export function defaultDraw(g) { g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, AW, SH); face(g); }
export function camoDraw(g, seed) { // 무작위 위장 무늬 (봇, [무작위 위장] 버튼)
  let s = (seed * 2654435761) >>> 0; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const sets = [['#cfae78', '#8a6a42', '#5a4a3a', '#e3cfa2'], ['#8b9097', '#4b5058', '#2a2f38', '#b4b8bd'], ['#4f7a3c', '#2f5d34', '#7a5230', '#9aa860'], ['#3a3f48', '#1d2a44', '#6a7078', '#14161a'], ['#7a5230', '#cfae78', '#2f5d34', '#4a3626'], ['#1d2a44', '#2f62c8', '#4b5058', '#0f1626']], P = sets[Math.floor(R() * sets.length)];
  g.fillStyle = P[0]; g.fillRect(0, 0, AW, SH);
  for (let i = 0; i < 46; i++) {
    const x = R() * AW, y = R() * SH, r = 9 + R() * 22; g.fillStyle = P[1 + (i % 3)]; g.beginPath();
    for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.283, rr = r * (0.55 + R() * 0.6); g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.72); }
    g.closePath(); g.fill();
  }
  face(g);
}

export function outfitDraw(g, seed) { // 봇 복장: 헬멧·조끼·장갑·무릎 보호대·군화 (색 조합 여섯 가지)
  let s = (seed * 2654435761) >>> 0; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const sets = [ // 군복, 조끼, 헬멧, 바지, 포인트
    ['#b99a6a', '#6f5a3c', '#8a7350', '#a48a5e', '#3d3226'], ['#5c6d44', '#39432c', '#4a5838', '#515f3d', '#2a2f22'], ['#6f757d', '#3c4148', '#555b63', '#5d636b', '#24272c'],
    ['#2c3c5c', '#1a2438', '#25324c', '#27344f', '#111827'], ['#2b2d31', '#17181b', '#222428', '#26282c', '#5a5f66'], ['#7d6a52', '#4a5a3a', '#5e6b48', '#6b5a44', '#2e2a22']];
  const [U, V, H, P, K] = sets[Math.floor(R() * sets.length)], skin = ['#f0c8a4', '#d9a57c', '#b07a54', '#8a5a3a'][Math.floor(R() * 4)];
  const X = (x) => (1 - (x + HW) / DW) * SW, Y = (y) => (1 - y / DH) * SH; // 몸 자리(m) → 그림 자리
  for (const side of [0, 1]) {
    g.save(); g.beginPath(); g.rect(side * SW, 0, SW, SH); g.clip(); g.translate(side * SW, 0);
    const box = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(Math.min(X(x0), X(x1)), Y(y1), Math.abs(X(x1) - X(x0)), Y(y0) - Y(y1)); };
    box(-0.48, 0, 0.48, 1.9, U);
    box(-0.25, 0, 0.25, 0.77, P); box(-0.25, 0, 0.25, 0.13, '#17181b'); box(-0.25, 0.13, 0.25, 0.155, '#0c0d0f');              // 바지, 군화
    for (const x of [-0.225, 0.015]) box(x, 0.36, x + 0.21, 0.5, K);                                                             // 무릎 보호대
    box(-0.25, 0.74, 0.25, 0.8, '#1c1d20'); if (!side) box(-0.04, 0.745, 0.04, 0.795, '#8a8f97');                                 // 허리띠
    box(-0.2, 0.83, 0.2, 1.38, V);                                                                                               // 조끼
    if (!side) { for (const x of [-0.17, -0.05, 0.07]) { box(x, 0.86, x + 0.1, 1.02, K); box(x, 1.0, x + 0.1, 1.02, '#0e0f11'); } box(-0.17, 1.2, -0.05, 1.3, K); box(0.06, 1.22, 0.16, 1.27, '#c9ccd1'); }
    else { box(-0.16, 0.9, 0.16, 1.34, K); box(-0.12, 1.12, 0.12, 1.16, '#0e0f11'); box(-0.1, 0.94, 0.1, 1.06, V); }              // 등에는 배낭
    for (const x of [-0.2, 0.15]) box(x, 1.38, x + 0.05, 1.44, '#1c1d20');                                                       // 어깨끈
    for (const sx of [-1, 1]) { box(sx * 0.25, 0.76, sx * 0.48, 0.9, '#1c1d20'); box(sx * 0.25, 0.9, sx * 0.48, 0.93, K); box(sx * 0.27, 1.22, sx * 0.45, 1.32, V); } // 장갑, 소매 끝, 팔 표식
    box(-0.21, 1.44, 0.21, 1.82, skin);                                                                                          // 얼굴
    box(-0.21, side ? 1.56 : 1.67, 0.21, 1.82, H); box(-0.21, side ? 1.56 : 1.67, 0.21, (side ? 1.56 : 1.67) + 0.025, K);         // 헬멧 (뒤는 더 깊이 덮음)
    if (!side) { g.fillStyle = '#17181b'; for (const x of [53, 75]) { g.beginPath(); g.ellipse(x, 39, 3.2, 4.4, 0, 0, 7); g.fill(); } g.fillRect(57, 49, 14, 2.4); box(-0.21, 1.47, -0.17, 1.67, '#1c1d20'); box(0.17, 1.47, 0.21, 1.67, '#1c1d20'); } // 눈, 입, 턱끈
    g.restore();
  }
}

// ── 질감 ──
function mkTex(cv) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const texCache = new Map();
export function paintTex(key, kind, val, draw) { // draw: 직접 그리는 함수 (요원 스킨) // kind: 'url' 사람이 그린 그림 · 'bot' 봇 복장 · 'camo' 위장 무늬 · 그 외 기본. 같은 그림은 질감 하나를 같이 씀
  let t = texCache.get(key);
  if (t) return t;
  if (texCache.size > 60) { for (const v of texCache.values()) v.dispose(); texCache.clear(); }
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = SH;
  const g = cv.getContext('2d');
  if (draw) draw(g); else if (kind === 'bot') outfitDraw(g, val); else if (kind === 'camo') camoDraw(g, val); else defaultDraw(g);
  t = mkTex(cv);
  if (kind === 'url') { const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0, AW, SH); t.needsUpdate = true; }; im.src = val; }
  texCache.set(key, t);
  return t;
}

// ── 몸 (그림이 입혀지는 자리 계산) ──
const uvOf = (x, y, front) => { const xn = Math.min(1 - 1.5 / SW, Math.max(1.5 / SW, (x + HW) / DW)), v = Math.min(1 - 1.5 / SH, Math.max(1.5 / SH, y / DH)); return [front ? (1 - xn) * 0.5 : 0.5 + xn * 0.5, v]; };
function dollMap(g, ox, oy, hw = 9) { // hw = 덩어리 반 너비 (옆면이 옆 덩어리 자리의 색을 집지 않게 안쪽으로 당김) // 서 있는 자세의 앞·뒤에서 본 자리 그대로 그림을 입힘 (삼각형마다 앞·뒤를 정함)
  g = g.index ? g.toNonIndexed() : g;
  const p = g.attributes.position, nr = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i += 3) {
    const front = nr.getZ(i) + nr.getZ(i + 1) + nr.getZ(i + 2) < 0.03; // 뒤를 보는 면만 뒤 그림, 옆·위·아래 면은 앞 그림의 가장자리 색
    for (let k = 0; k < 3; k++) { const q = uvOf(ox + Math.max(-hw + 0.014, Math.min(hw - 0.014, p.getX(i + k))), oy + p.getY(i + k), front); uv[(i + k) * 2] = q[0]; uv[(i + k) * 2 + 1] = q[1]; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
let GEO = null;
function rbox(w, h, d, r) { // 모서리를 둥글린 상자 (모서리마다 비스듬한 면 하나 + 부드러운 음영)
  const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3), p = g.attributes.position, n = g.attributes.normal, H = [w / 2, h / 2, d / 2], v = [0, 0, 0], q = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    v[0] = p.getX(i); v[1] = p.getY(i); v[2] = p.getZ(i); let L = 0;
    for (let a = 0; a < 3; a++) { if (Math.abs(v[a]) < H[a] - 1e-5) v[a] = (Math.sign(v[a]) || 1) * (H[a] - r); q[a] = Math.max(-(H[a] - r), Math.min(H[a] - r, v[a])); L += (v[a] - q[a]) ** 2; }
    L = Math.sqrt(L) || 1;
    p.setXYZ(i, q[0] + ((v[0] - q[0]) / L) * r, q[1] + ((v[1] - q[1]) / L) * r, q[2] + ((v[2] - q[2]) / L) * r); n.setXYZ(i, (v[0] - q[0]) / L, (v[1] - q[1]) / L, (v[2] - q[2]) / L);
  }
  return g;
}
function geos() { // 몸통 0.48 × 0.68 × 0.24, 머리는 모서리를 둥글린 원통. 팔·다리는 관절(팔꿈치·무릎)에서 나뉜 두 토막
  if (GEO) return GEO;
  const torso = rbox(0.48, 0.68, 0.24, 0.035);
  const head = new THREE.LatheGeometry([[0, -0.19], [0.14, -0.19], [0.18, -0.178], [0.2, -0.15], [0.205, -0.11], [0.205, 0.11], [0.2, 0.15], [0.18, 0.178], [0.14, 0.19], [0, 0.19]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
  head.rotateY(Math.PI / 24); // 앞·뒤 경계가 꼭짓점 줄에 오도록
  // 토막 하나: 관절에서 아래로 뻗음 (top = 관절보다 얼마나 위에서 시작하는지). 그림에서는 서 있는 자세의 자리(x, oy)를 그대로 입힘
  const seg = (w, len, d, top, x, oy, hw) => { const a = rbox(w, len, d, 0.03); a.translate(0, top - len / 2, 0); return dollMap(a, x, oy, hw); };
  const band = rbox(0.5, 0.06, 0.26, 0.02);
  GEO = { torso: dollMap(torso, 0, 1.1, 0.24), head: dollMap(head, 0, 1.63, 0.205), band,
    thigh: [-0.12, 0.12].map((x) => seg(0.235, 0.44, 0.24, 0.02, x, 0.76, 0.1175)),
    shin: [-0.12, 0.12].map((x) => seg(0.228, 0.44, 0.234, 0.06, x, 0.38, 0.1175)),
    armU: [0.3575, -0.3575].map((x) => seg(0.215, 0.42, 0.225, 0.03, x, 1.41, 0.1035)),
    armF: [0.3575, -0.3575].map((x) => seg(0.2, 0.43, 0.21, 0.04, x, 1.165, 0.1035)) };
  return GEO;
}
// 그림 질감 tex 를 입힌 몸. bandMat = 목에 두르는 팀 색 띠
// 뼈대: body(발밑) → hips(엉덩이) → 다리(thigh → knee), spine(허리) → 몸통·머리·arms(조준 방향 묶음: 팔 토막과 총)
export function buildBody(tex, bandMat) {
  const G = geos(), mat = new THREE.MeshLambertMaterial({ map: tex }), body = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.76; body.add(hips);
  const spine = new THREE.Group(); hips.add(spine);
  const t = new THREE.Mesh(G.torso, mat); t.position.y = 0.34;
  const bd = new THREE.Mesh(G.band, bandMat); bd.position.y = 0.665;
  const head = new THREE.Group(); head.position.y = 0.68; head.rotation.order = 'YXZ';
  const h = new THREE.Mesh(G.head, mat); h.position.y = 0.19; head.add(h);
  const arms = new THREE.Group(); arms.position.y = 0.56; arms.rotation.order = 'YXZ';
  spine.add(t, bd, head, arms);
  const legs = [-0.12, 0.12].map((x, i) => { // 0 왼쪽, 1 오른쪽
    const thigh = new THREE.Group(), knee = new THREE.Group(); thigh.position.x = x; knee.position.y = -0.38;
    thigh.add(new THREE.Mesh(G.thigh[i], mat), knee); knee.add(new THREE.Mesh(G.shin[i], mat)); hips.add(thigh);
    return { thigh, knee };
  });
  const arm = (i) => { const up = new THREE.Group(), fore = new THREE.Group(); up.add(new THREE.Mesh(G.armU[i], mat)); fore.add(new THREE.Mesh(G.armF[i], mat)); arms.add(up, fore); return { up, fore }; };
  return { body, hips, spine, head, legs, arms, armR: arm(0), armL: arm(1), mat };
}

// ── 그리기 화면 ──
const PAL = ['#f4f4f0', '#17181b', '#8b9097', '#4b5058', '#d83a34', '#f08a24', '#f2d03b', '#a4d840', '#56b04a', '#2f5d34', '#2aa79a', '#49c4d8', '#2f62c8', '#1d2a44', '#8a4fc8', '#f08ab4', '#f3c9a5', '#cfae78', '#a0703c', '#5a3a22'];
const SIZES = [3, 7, 14, 28];
export const paintUI = { open: false, tex: null, yaw: 0.5, drag: false };
export function initPaintEditor($, getSaved, onDone) {
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = SH;
  const g = cv.getContext('2d', { willReadFrequently: true });
  defaultDraw(g);
  const tex = mkTex(cv); paintUI.tex = tex;
  let color = '#17181b', size = SIZES[1], fill = false, undo = [], last = null, dirty = false, changed = false;
  const views = [$('ptF'), $('ptB')];
  const mask = document.createElement('canvas'); mask.width = SW; mask.height = SH;
  { const m = mask.getContext('2d'); m.fillStyle = 'rgba(12,14,18,.8)'; m.fillRect(0, 0, SW, SH); for (const [x0, y0, x1, y1] of PARTS) m.clearRect(((x0 + HW) / DW) * SW, (1 - y1 / DH) * SH, ((x1 - x0) / DW) * SW, ((y1 - y0) / DH) * SH); }
  const redraw = () => {
    dirty = false;
    views.forEach((v, i) => {
      const c = v.getContext('2d'), w = v.width, h = v.height;
      c.imageSmoothingEnabled = true; c.drawImage(cv, i * SW, 0, SW, SH, 0, 0, w, h); c.drawImage(mask, 0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.38)'; c.lineWidth = Math.max(1, w / 180);
      for (const [x0, y0, x1, y1] of PARTS) c.strokeRect(((x0 + HW) / DW) * w, (1 - y1 / DH) * h, ((x1 - x0) / DW) * w, ((y1 - y0) / DH) * h);
    });
  };
  const touch = () => { tex.needsUpdate = true; changed = true; if (!dirty) { dirty = true; requestAnimationFrame(redraw); } };
  const saved = getSaved();
  if (isPaint(saved)) { const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0, AW, SH); touch(); changed = false; }; im.src = saved; }
  const snap = () => { undo.push(g.getImageData(0, 0, AW, SH)); if (undo.length > 15) undo.shift(); };
  const inPanel = (i, fn) => { g.save(); g.beginPath(); g.rect(i * SW, 0, SW, SH); g.clip(); fn(); g.restore(); };
  const dot = (i, x, y) => inPanel(i, () => { g.fillStyle = color; g.beginPath(); g.arc(i * SW + x, y, size / 2, 0, 7); g.fill(); });
  const seg = (i, a, b) => inPanel(i, () => { g.strokeStyle = color; g.lineWidth = size; g.lineCap = g.lineJoin = 'round'; g.beginPath(); g.moveTo(i * SW + a[0], a[1]); g.lineTo(i * SW + b[0], b[1]); g.stroke(); });
  const flood = (i, x, y) => { // 비슷한 색으로 이어진 자리를 채움
    x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= SW || y >= SH) return;
    const im = g.getImageData(i * SW, 0, SW, SH), d = im.data, o = (y * SW + x) * 4, r0 = d[o], g0 = d[o + 1], b0 = d[o + 2];
    const c = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
    if (Math.abs(r0 - c[0]) + Math.abs(g0 - c[1]) + Math.abs(b0 - c[2]) < 6) return;
    const seen = new Uint8Array(SW * SH), st = [y * SW + x];
    while (st.length) {
      const k = st.pop(); if (seen[k]) continue; const q = k * 4;
      if (Math.abs(d[q] - r0) + Math.abs(d[q + 1] - g0) + Math.abs(d[q + 2] - b0) > 90) continue;
      seen[k] = 1; d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255;
      const px = k % SW; if (px > 0) st.push(k - 1); if (px < SW - 1) st.push(k + 1); if (k >= SW) st.push(k - SW); if (k < SW * (SH - 1)) st.push(k + SW);
    }
    g.putImageData(im, i * SW, 0);
  };
  const fit = () => {
    const mid = $('ptMid').getBoundingClientRect(), h = Math.max(120, Math.floor(Math.min(mid.height - 30, (mid.width - 30) / 2 * 2))), w = Math.floor(h / 2), dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const v of views) { v.style.width = w + 'px'; v.style.height = h + 'px'; v.width = Math.round(w * dpr); v.height = Math.round(h * dpr); }
    redraw();
  };
  views.forEach((v, i) => {
    const at = (e) => { const b = v.getBoundingClientRect(); return [((e.clientX - b.left) / b.width) * SW, ((e.clientY - b.top) / b.height) * SH]; };
    v.addEventListener('pointerdown', (e) => { e.preventDefault(); try { v.setPointerCapture(e.pointerId); } catch {} snap(); const p = at(e); if (fill) { flood(i, p[0], p[1]); last = null; } else { dot(i, p[0], p[1]); last = p; } touch(); });
    v.addEventListener('pointermove', (e) => { if (!last) return; e.preventDefault(); const p = at(e); seg(i, last, p); last = p; touch(); });
    const end = () => { last = null; };
    v.addEventListener('pointerup', end); v.addEventListener('pointercancel', end);
  });
  const mark = () => { [...$('ptPal').children].forEach((b) => b.classList.toggle('on', b.dataset.c === color)); for (const b of $('ptSize').children) b.classList.toggle('on', +b.dataset.s === size && !fill); $('ptFill').classList.toggle('on', fill); $('ptPick').value = color; };
  PAL.forEach((h) => { const b = document.createElement('button'); b.style.background = h; b.dataset.c = h; b.setAttribute('aria-label', '색 ' + h); b.onclick = () => { color = h; mark(); }; $('ptPal').appendChild(b); });
  $('ptPick').oninput = (e) => { color = e.target.value; mark(); };
  [...$('ptSize').children].forEach((b, k) => { b.dataset.s = SIZES[k]; b.onclick = () => { size = SIZES[k]; fill = false; mark(); }; });
  $('ptFill').onclick = () => { fill = !fill; mark(); };
  $('ptUndo').onclick = () => { if (undo.length) { g.putImageData(undo.pop(), 0, 0); touch(); } };
  $('ptCopy').onclick = () => { snap(); g.save(); g.translate(AW, 0); g.scale(-1, 1); g.drawImage(cv, 0, 0, SW, SH, 0, 0, SW, SH); g.restore(); touch(); }; // 좌우를 뒤집어 붙여야 몸을 감싸듯 이어짐
  $('ptCamo').onclick = () => { snap(); camoDraw(g, Math.floor(Math.random() * 1e9)); touch(); };
  $('ptClear').onclick = () => { snap(); defaultDraw(g); touch(); };
  const prev = $('ptPrev'); let px = null;
  prev.addEventListener('pointerdown', (e) => { px = e.clientX; paintUI.drag = true; try { prev.setPointerCapture(e.pointerId); } catch {} });
  prev.addEventListener('pointermove', (e) => { if (px === null) return; paintUI.yaw += (e.clientX - px) * 0.012; px = e.clientX; });
  prev.addEventListener('pointerup', () => { px = null; }); prev.addEventListener('pointercancel', () => { px = null; });
  window.addEventListener('resize', () => { if (paintUI.open) fit(); });
  const out = () => { // 보낼 수 있는 크기로 압축
    for (const [type, q] of [['image/webp', 0.92], ['image/jpeg', 0.9], ['image/jpeg', 0.75], ['image/jpeg', 0.55]]) { let u = ''; try { u = cv.toDataURL(type, q); } catch {} if (u.startsWith('data:' + type) && isPaint(u)) return u; }
    return '';
  };
  const close = () => { if (!paintUI.open) return; paintUI.open = false; $('paint').classList.add('hide'); onDone(changed ? out() : null); changed = false; };
  $('ptDone').onclick = close;
  mark();
  return { open(label) { paintUI.open = true; paintUI.drag = false; undo = []; $('ptDone').textContent = label || '완료'; $('paint').classList.remove('hide'); fit(); }, close };
}
