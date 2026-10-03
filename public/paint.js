// SQUAD CLASH — 그림을 그릴 수 있는 캐릭터
// 캐릭터는 머리·몸통·팔 둘·다리 둘, 여섯 덩어리로 된 각진 하얀 인형이고, 앞·뒤 두 장(각 36 × 72칸)에 그린 그림이 몸에 그대로 입혀진다.
// 그림 자료: 72 × 72칸, 칸마다 16색 중 하나 (가로 0~35 = 앞, 36~71 = 뒤, 위쪽이 머리)
import * as THREE from './vendor/three.module.js';

export const PW = 36, PH = 72, AW = PW * 2, PAINT_LEN = 3456; // 보낼 때 글자 수 (72 × 72칸 ÷ 2 → base64)
export const PAL = ['#f4f4f0', '#17181b', '#8b9097', '#4b5058', '#d83a34', '#f08a24', '#f2d03b', '#56b04a', '#2f5d34', '#49c4d8', '#2f62c8', '#8a4fc8', '#f08ab4', '#7a5230', '#cfae78', '#1d2a44'];
export const PAL_NAME = ['흰색', '검정', '회색', '진회색', '빨강', '주황', '노랑', '초록', '진초록', '하늘', '파랑', '보라', '분홍', '갈색', '모래', '남색'];
const RGB = PAL.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const DW = 0.95, DH = 1.9, HW = DW / 2; // 그림 한 장이 덮는 몸 크기 (m)

const eyes = (a) => { for (const c of [14, 15, 20, 21]) for (const r of [7, 8, 9]) a[r * AW + c] = 1; for (let c = 15; c <= 20; c++) a[12 * AW + c] = 1; return a; }; // 눈과 입
export function defaultPaint() { return eyes(new Uint8Array(AW * PH)); } // 하얀 몸에 눈만
export function camoPaint(seed) { // 무작위 위장 무늬 (봇, [무작위 위장] 버튼)
  let s = (seed * 2654435761) >>> 0; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const sets = [[14, 13, 3], [2, 3, 15], [8, 7, 13], [3, 15, 2], [13, 14, 8], [15, 10, 3]], P = sets[Math.floor(R() * sets.length)], a = new Uint8Array(AW * PH).fill(P[0]);
  for (let i = 0; i < 26; i++) {
    const cx = R() * AW, cy = R() * PH, rx = 3 + R() * 7, ry = 2 + R() * 6, c = P[1 + (i % 2)];
    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(PH, cy + ry); y++) for (let x = Math.floor(cx - rx); x < cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) a[y * AW + ((x % AW) + AW) % AW] = c;
  }
  return eyes(a);
}
export function encodePaint(a) { let s = ''; for (let i = 0; i < a.length; i += 2) s += String.fromCharCode(((a[i] & 15) << 4) | (a[i + 1] & 15)); return btoa(s); }
export function decodePaint(str) {
  if (typeof str !== 'string' || str.length !== PAINT_LEN) return null;
  let b; try { b = atob(str); } catch { return null; }
  if (b.length !== (AW * PH) / 2) return null;
  const a = new Uint8Array(AW * PH);
  for (let i = 0; i < b.length; i++) { const v = b.charCodeAt(i); a[i * 2] = v >> 4; a[i * 2 + 1] = v & 15; }
  return a;
}

// ── 질감 ──
export function drawPaint(cv, a) { const g = cv.getContext('2d'), im = g.createImageData(AW, PH), d = im.data; for (let i = 0; i < a.length; i++) { const c = RGB[a[i] & 15]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); }
export function makePaintTex(a) {
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = PH; drawPaint(cv, a);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const texCache = new Map();
export function paintTexFor(key, make) { // 같은 그림은 질감 하나를 같이 씀
  let t = texCache.get(key);
  if (!t) { if (texCache.size > 80) { for (const v of texCache.values()) v.dispose(); texCache.clear(); } t = makePaintTex(make()); texCache.set(key, t); }
  return t;
}

// ── 몸 (그림이 입혀지는 자리 계산) ──
const uvOf = (x, y, front) => { const xn = Math.min(1 - 0.5 / PW, Math.max(0.5 / PW, (x + HW) / DW)), v = Math.min(1 - 0.5 / PH, Math.max(0.5 / PH, y / DH)); return [front ? (1 - xn) * 0.5 : 0.5 + xn * 0.5, v]; };
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
function geos() { // 몸통 0.48 × 0.68 × 0.24, 팔·다리 0.235 × (0.68 / 0.76) × 0.24, 머리는 모서리를 깎은 원통
  if (GEO) return GEO;
  const torso = new THREE.BoxGeometry(0.48, 0.68, 0.24);
  const head = new THREE.LatheGeometry([[0, -0.19], [0.17, -0.19], [0.205, -0.15], [0.205, 0.15], [0.17, 0.19], [0, 0.19]].map(([x, y]) => new THREE.Vector2(x, y)), 18);
  head.rotateY(Math.PI / 18); // 앞·뒤 경계가 꼭짓점 줄에 오도록
  const leg = (x) => { const a = new THREE.BoxGeometry(0.235, 0.76, 0.24); a.translate(0, -0.38, 0); return dollMap(a, x, 0.76, 0.1175); };
  const arm = (a, b, x) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); return armPiece(new THREE.BoxGeometry(0.235, L, 0.24), L, x, 1.44, 0.76, a, b); };
  const band = new THREE.BoxGeometry(0.5, 0.05, 0.26);
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
const inDoll = (x, y) => (Math.abs(x) <= 0.205 && y > 1.44 && y <= 1.82) || (Math.abs(x) <= 0.475 && y > 0.76 && y <= 1.44) || (Math.abs(x) <= 0.24 && y >= 0 && y <= 0.76);
export const paintUI = { open: false, tex: null, arr: null, yaw: 0.5, drag: false };
export function initPaintEditor($, getSaved, onDone) {
  let arr = decodePaint(getSaved()) || defaultPaint(), color = 1, size = 2, fill = false, undo = [], scale = 4, last = null, dirty = false;
  const tex = makePaintTex(arr), cv = tex.image, g72 = cv.getContext('2d');
  paintUI.tex = tex; paintUI.arr = arr;
  const mask = document.createElement('canvas'); mask.width = PW; mask.height = PH;
  { const g = mask.getContext('2d'); g.fillStyle = 'rgba(12,14,18,.78)'; for (let r = 0; r < PH; r++) for (let c = 0; c < PW; c++) if (!inDoll((1 - (c + 0.5) / PW) * DW - HW, (1 - (r + 0.5) / PH) * DH)) g.fillRect(c, r, 1, 1); }
  const views = [$('ptF'), $('ptB')];
  const redraw = () => { dirty = false; views.forEach((v, i) => { const g = v.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(cv, i * PW, 0, PW, PH, 0, 0, v.width, v.height); g.drawImage(mask, 0, 0, v.width, v.height); }); };
  const touch = () => { tex.needsUpdate = true; if (!dirty) { dirty = true; requestAnimationFrame(redraw); } };
  const setCell = (i, c, r, col) => { if (c < 0 || r < 0 || c >= PW || r >= PH) return; arr[r * AW + i * PW + c] = col; g72.fillStyle = PAL[col]; g72.fillRect(i * PW + c, r, 1, 1); };
  const dab = (i, c, r) => { const o = Math.floor((size - 1) / 2); for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) setCell(i, c - o + x, r - o + y, color); };
  const flood = (i, c, r) => { const from = arr[r * AW + i * PW + c]; if (from === color) return; const st = [[c, r]]; while (st.length) { const [x, y] = st.pop(); if (x < 0 || y < 0 || x >= PW || y >= PH || arr[y * AW + i * PW + x] !== from) continue; setCell(i, x, y, color); st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } };
  const snap = () => { undo.push(arr.slice()); if (undo.length > 20) undo.shift(); };
  const load = (a) => { arr.set(a); drawPaint(cv, arr); touch(); };
  const fit = () => { const mid = $('ptMid').getBoundingClientRect(); scale = Math.max(2, Math.floor(Math.min((mid.height - 26) / PH, (mid.width - 28) / 2 / PW))); for (const v of views) { v.width = PW * scale; v.height = PH * scale; } redraw(); };
  views.forEach((v, i) => {
    const cell = (e) => { const b = v.getBoundingClientRect(); return [Math.floor(((e.clientX - b.left) / b.width) * PW), Math.floor(((e.clientY - b.top) / b.height) * PH)]; };
    v.addEventListener('pointerdown', (e) => { e.preventDefault(); try { v.setPointerCapture(e.pointerId); } catch {} snap(); const [c, r] = cell(e); if (fill) { if (c >= 0 && r >= 0 && c < PW && r < PH) flood(i, c, r); last = null; } else { dab(i, c, r); last = [c, r]; } touch(); });
    v.addEventListener('pointermove', (e) => { if (!last) return; e.preventDefault(); const [c, r] = cell(e), n = Math.max(Math.abs(c - last[0]), Math.abs(r - last[1]), 1); for (let k = 1; k <= n; k++) dab(i, Math.round(last[0] + ((c - last[0]) * k) / n), Math.round(last[1] + ((r - last[1]) * k) / n)); last = [c, r]; touch(); });
    const end = () => { last = null; };
    v.addEventListener('pointerup', end); v.addEventListener('pointercancel', end);
  });
  PAL.forEach((h, i) => { const b = document.createElement('button'); b.style.background = h; b.title = PAL_NAME[i]; b.setAttribute('aria-label', PAL_NAME[i]); b.onclick = () => { color = i; mark(); }; $('ptPal').appendChild(b); });
  const mark = () => { [...$('ptPal').children].forEach((b, i) => b.classList.toggle('on', i === color)); for (const b of $('ptSize').children) b.classList.toggle('on', +b.dataset.s === size); $('ptFill').classList.toggle('on', fill); };
  for (const b of $('ptSize').children) b.onclick = () => { size = +b.dataset.s; fill = false; mark(); };
  $('ptFill').onclick = () => { fill = !fill; mark(); };
  $('ptUndo').onclick = () => { if (undo.length) load(undo.pop()); };
  $('ptCopy').onclick = () => { snap(); for (let r = 0; r < PH; r++) for (let c = 0; c < PW; c++) setCell(1, PW - 1 - c, r, arr[r * AW + c]); touch(); };
  $('ptCamo').onclick = () => { snap(); load(camoPaint(Math.floor(Math.random() * 1e9))); };
  $('ptClear').onclick = () => { snap(); load(defaultPaint()); };
  const prev = $('ptPrev'); let px = null;
  prev.addEventListener('pointerdown', (e) => { px = e.clientX; paintUI.drag = true; try { prev.setPointerCapture(e.pointerId); } catch {} });
  prev.addEventListener('pointermove', (e) => { if (px === null) return; paintUI.yaw += (e.clientX - px) * 0.012; px = e.clientX; });
  prev.addEventListener('pointerup', () => { px = null; }); prev.addEventListener('pointercancel', () => { px = null; });
  window.addEventListener('resize', () => { if (paintUI.open) fit(); });
  const close = (save) => { if (!paintUI.open) return; paintUI.open = false; $('paint').classList.add('hide'); onDone(save ? encodePaint(arr) : null); };
  $('ptDone').onclick = () => close(true);
  mark();
  return { open(label) { paintUI.open = true; paintUI.drag = false; undo = []; $('ptDone').textContent = label || '완료'; $('paint').classList.remove('hide'); fit(); }, close: () => close(true) };
}
