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

// ── 질감 ──
function mkTex(cv) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const texCache = new Map();
export function paintTex(key, kind, val) { // kind: 'url' 사람이 그린 그림 · 'camo' 봇 위장 · 그 외 기본. 같은 그림은 질감 하나를 같이 씀
  let t = texCache.get(key);
  if (t) return t;
  if (texCache.size > 60) { for (const v of texCache.values()) v.dispose(); texCache.clear(); }
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = SH;
  const g = cv.getContext('2d');
  if (kind === 'camo') camoDraw(g, val); else defaultDraw(g);
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
function armPiece(g, len, armX, y0, y1, a, b) { // 팔: 그림에서는 옆으로 내린 팔 자리, 몸에서는 총을 든 자세
  g = g.index ? g.toNonIndexed() : g;
  const p = g.attributes.position, nr = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i += 3) {
    const front = nr.getZ(i) + nr.getZ(i + 1) + nr.getZ(i + 2) > -0.03; // 앞으로 뻗은 팔은 윗면·옆면이 앞 그림, 아랫면이 뒤 그림
    for (let k = 0; k < 3; k++) { const t = Math.min(1, Math.max(0, p.getY(i + k) / len + 0.5)), q = uvOf(armX + Math.max(-0.1035, Math.min(0.1035, p.getX(i + k))), y0 + (y1 - y0) * t, front); uv[(i + k) * 2] = q[0]; uv[(i + k) * 2 + 1] = q[1]; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A).normalize();
  g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), new THREE.Vector3(1, 1, 1)));
  return g;
}
function merge(list) {
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) { const n = k === 'uv' ? 2 : 3, arr = new Float32Array(list.reduce((s, g) => s + g.attributes[k].array.length, 0)); let o = 0; for (const g of list) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(arr, n)); }
  return out;
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
function geos() { // 몸통 0.48 × 0.68 × 0.24, 팔·다리 0.235 × (0.68 / 0.76) × 0.24, 머리는 모서리를 둥글린 원통
  if (GEO) return GEO;
  const torso = rbox(0.48, 0.68, 0.24, 0.035);
  const head = new THREE.LatheGeometry([[0, -0.19], [0.14, -0.19], [0.18, -0.178], [0.2, -0.15], [0.205, -0.11], [0.205, 0.11], [0.2, 0.15], [0.18, 0.178], [0.14, 0.19], [0, 0.19]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
  head.rotateY(Math.PI / 24); // 앞·뒤 경계가 꼭짓점 줄에 오도록
  const leg = (x) => { const a = rbox(0.235, 0.76, 0.24, 0.03); a.translate(0, -0.38, 0); return dollMap(a, x, 0.76, 0.1175); };
  const arm = (a, b, x) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); return armPiece(rbox(0.235, L, 0.24, 0.03), L, x, 1.44, 0.76, a, b); };
  const band = rbox(0.5, 0.06, 0.26, 0.02);
  GEO = { torso: dollMap(torso, 0, 1.1, 0.24), head: dollMap(head, 0, 1.63, 0.205), legL: leg(-0.12), legR: leg(0.12), arms: merge([arm([0.3575, 0.05, 0.02], [0.33, -0.05, -0.64], 0.3575), arm([-0.3575, 0.05, 0.02], [-0.02, -0.07, -0.58], -0.3575)]), band };
  return GEO;
}
// 그림 질감 tex 를 입힌 몸. bandMat = 목에 두르는 팀 색 띠
export function buildBody(tex, bandMat) {
  const G = geos(), mat = new THREE.MeshLambertMaterial({ map: tex }), body = new THREE.Group();
  const t = new THREE.Mesh(G.torso, mat); t.position.y = 1.1;
  const bd = new THREE.Mesh(G.band, bandMat); bd.position.y = 1.425;
  body.add(t, bd);
  const head = new THREE.Group(); head.position.y = 1.44;
  const h = new THREE.Mesh(G.head, mat); h.position.y = 0.19; head.add(h); body.add(head);
  const legs = [-0.12, 0.12].map((x, i) => { const l = new THREE.Group(); l.position.set(x, 0.76, 0); l.add(new THREE.Mesh(i ? G.legR : G.legL, mat)); body.add(l); return l; });
  const arms = new THREE.Group(); arms.position.y = 1.32; arms.add(new THREE.Mesh(G.arms, mat)); body.add(arms);
  return { body, head, legs, arms, mat };
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
