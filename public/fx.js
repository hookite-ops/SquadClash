// SQUAD CLASH — 눈에 보이는 효과: 예광탄, 탄흔, 불티·파편, 먼지·연기, 폭발, 연막, 번쩍이는 빛
// 전부 미리 만들어 둔 묶음(풀)을 돌려 쓴다 → 싸우는 중에 새로 만들거나 버리는 것이 없다.
import * as THREE from './vendor/three.module.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let scene = null, camera = null, K = 1, LOW = false; // K = 빛나는 것의 밝기 배수 (밝기 범위가 넓은 버퍼에 그릴 때 빛이 번지도록 1 을 넘김)

// ───────────── 질감 ─────────────
export function softTex(stops, lines) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, c] of stops) rg.addColorStop(o, c);
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  if (lines) { g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 4; g.beginPath(); g.moveTo(32 - Math.cos(a) * 30, 32 - Math.sin(a) * 30); g.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30); g.stroke(); } }
  return new THREE.CanvasTexture(cv);
}
const rnd = (() => { let s = 20240; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const canvasTex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')); return new THREE.CanvasTexture(cv); };
// 총구 불꽃: 밝은 심지와 삐죽삐죽 뻗는 불길 (흰 바탕 — 색은 스킨에 따라 입힘)
export const flashTex = canvasTex(128, 128, (g) => {
  g.translate(64, 64);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 62); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.16, 'rgba(255,255,255,.7)'); rg.addColorStop(0.5, 'rgba(255,255,255,.14)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(-64, -64, 128, 128);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + rnd() * 0.5, l = 26 + rnd() * 34, w = 4 + rnd() * 6; g.save(); g.rotate(a); const lg = g.createLinearGradient(0, 0, l, 0); lg.addColorStop(0, 'rgba(255,255,255,.95)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(0, -w); g.quadraticCurveTo(l * 0.5, -w * 0.45, l, 0); g.quadraticCurveTo(l * 0.5, w * 0.45, 0, w); g.fill(); g.restore(); }
});
// 예광탄: 머리가 밝고 꼬리로 갈수록 흐려지는 빛줄기
const tracerTex = canvasTex(128, 16, (g) => {
  const lg = g.createLinearGradient(0, 0, 128, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.55, 'rgba(255,255,255,.5)'); lg.addColorStop(0.93, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lg; g.fillRect(0, 0, 128, 16);
  g.globalCompositeOperation = 'destination-in'; const vg = g.createLinearGradient(0, 0, 0, 16); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.5, 'rgba(0,0,0,1)'); vg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = vg; g.fillRect(0, 0, 128, 16);
});
const lumps = (g, n, spread, r0, r1, stops) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.283, d = rnd() * spread, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, r = r0 + rnd() * (r1 - r0), rg = g.createRadialGradient(x, y, 0, x, y, r); for (const [o, c] of stops) rg.addColorStop(o, c); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); } };
// 뭉게뭉게한 연기 덩이 (흰 바탕, 아래쪽이 조금 어두움)
export const puffTex = canvasTex(128, 128, (g) => {
  lumps(g, 26, 30, 16, 34, [[0, 'rgba(255,255,255,.5)'], [0.6, 'rgba(255,255,255,.24)'], [1, 'rgba(255,255,255,0)']]);
  g.globalCompositeOperation = 'source-atop'; const lg = g.createLinearGradient(0, 34, 0, 112); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(96,96,104,.42)'); g.fillStyle = lg; g.fillRect(0, 0, 128, 128);
});
// 불덩이 (가운데가 하얗게 뜨겁고 가장자리는 누렇다)
const fireTex = canvasTex(128, 128, (g) => {
  g.globalCompositeOperation = 'lighter';
  lumps(g, 16, 26, 16, 32, [[0, 'rgba(255,214,150,.5)'], [0.55, 'rgba(255,150,60,.22)'], [1, 'rgba(255,90,20,0)']]);
  lumps(g, 6, 10, 14, 24, [[0, 'rgba(255,255,255,.75)'], [1, 'rgba(255,240,200,0)']]);
});
const ringTex = canvasTex(128, 128, (g) => { const rg = g.createRadialGradient(64, 64, 30, 64, 64, 63); rg.addColorStop(0, 'rgba(255,255,255,0)'); rg.addColorStop(0.72, 'rgba(255,255,255,.75)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128); });
const scorchTex = canvasTex(128, 128, (g) => { lumps(g, 26, 26, 18, 36, [[0, 'rgba(8,7,6,.62)'], [0.6, 'rgba(8,7,6,.3)'], [1, 'rgba(8,7,6,0)']]); for (let i = 0; i < 14; i++) { const a = rnd() * 6.283, l = 30 + rnd() * 28; g.strokeStyle = 'rgba(10,8,6,.3)'; g.lineWidth = 2 + rnd() * 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(64 + Math.cos(a) * 12, 64 + Math.sin(a) * 12); g.lineTo(64 + Math.cos(a) * l, 64 + Math.sin(a) * l); g.stroke(); } });
export const sparkTex = softTex([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']]);
const chipTex = softTex([[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,255,255,1)'], [0.7, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]);
// 탄흔: 돌·콘크리트 / 쇠(밝은 테두리) / 나무(뜯긴 자국) / 유리(금)
function decalTex(draw) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; draw(cv.getContext('2d')); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
const ringG = (g, stops) => { const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); for (const [o, c] of stops) rg.addColorStop(o, c); g.fillStyle = rg; g.fillRect(0, 0, 64, 64); };
const holeMats = [
  (g) => { ringG(g, [[0, 'rgba(6,6,6,.97)'], [0.3, 'rgba(14,14,14,.9)'], [0.48, 'rgba(60,60,60,.35)'], [1, 'rgba(60,60,60,0)']]); g.strokeStyle = 'rgba(20,20,20,.55)'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i * 1.05 + Math.random(), r = 12 + Math.random() * 14; g.beginPath(); g.moveTo(32 + Math.cos(a) * 8, 32 + Math.sin(a) * 8); g.lineTo(32 + Math.cos(a + 0.2) * r, 32 + Math.sin(a + 0.2) * r); g.stroke(); } },
  (g) => { ringG(g, [[0, 'rgba(0,0,0,1)'], [0.22, 'rgba(10,10,10,.95)'], [0.3, 'rgba(235,235,225,.95)'], [0.4, 'rgba(120,120,120,.6)'], [0.62, 'rgba(30,30,30,.25)'], [1, 'rgba(30,30,30,0)']]); },
  (g) => { ringG(g, [[0, 'rgba(20,10,4,.97)'], [0.26, 'rgba(40,22,8,.9)'], [0.4, 'rgba(210,170,110,.5)'], [0.6, 'rgba(210,170,110,0)']]); g.strokeStyle = 'rgba(228,196,140,.85)'; g.lineWidth = 2; for (let i = 0; i < 7; i++) { const y = 32 + (Math.random() - 0.5) * 16, l = 8 + Math.random() * 14, x = 32 + (i % 2 ? 6 : -6 - l); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (Math.random() - 0.5) * 3); g.stroke(); } },
  (g) => { ringG(g, [[0, 'rgba(10,14,18,.9)'], [0.1, 'rgba(240,250,255,.9)'], [0.22, 'rgba(240,250,255,.25)'], [0.5, 'rgba(240,250,255,0)']]); g.strokeStyle = 'rgba(245,252,255,.9)'; g.lineWidth = 1; for (let i = 0; i < 11; i++) { const a = i * 0.571 + Math.random() * 0.3, r = 14 + Math.random() * 17; g.beginPath(); g.moveTo(32 + Math.cos(a) * 4, 32 + Math.sin(a) * 4); g.lineTo(32 + Math.cos(a + 0.12) * r * 0.6, 32 + Math.sin(a + 0.12) * r * 0.6); g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); g.stroke(); } g.beginPath(); g.arc(32, 32, 13, 0, 7); g.stroke(); },
].map((d) => new THREE.MeshBasicMaterial({ map: decalTex(d), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));

// ───────────── 묶음 ─────────────
const tracers = [], holes = [], sparks = [], rings = [], scorches = [];
let tracerIdx = 0, holeIdx = 0, sparkIdx = 0, ringIdx = 0, scorchIdx = 0;
let sparkPts = null, chipPts = null, firePool = null, smokePool = null, light = null;
const L = { t: 0, dur: 1, i: 0 }; // 번쩍이는 빛의 남은 시간·세기
export const smokes = [];
const _c = new THREE.Color(), _mid = new THREE.Vector3(), _dir = new THREE.Vector3(), _side = new THREE.Vector3(), _view = new THREE.Vector3(), _z = new THREE.Vector3();

function makePts(n, size, add) { // 점 묶음 (불티는 밝게 더해지고, 부스러기는 색 조각)
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3).fill(-9999), col = new Float32Array(n * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: add ? sparkTex : chipTex, vertexColors: true, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
  pts.frustumCulled = false; scene.add(pts);
  return { geo, pos, col, n, i: 0, live: 0, k: add ? K : 1, p: Array.from({ length: n }, () => ({ life: 0, max: 1, v: [0, 0, 0], g: 9 })) };
}
function makePool(n, tex, add) { // 덩이 묶음 (늘 화면을 보는 그림): 불덩이는 밝게 더해지고, 연기는 그대로 덮음
  const a = [];
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })); s.visible = false; s.renderOrder = add ? 6 : 5; scene.add(s); a.push({ s, life: 0, max: 1, v: [0, 0, 0], s0: 1, s1: 1, op: 1, drag: 2, g: 0, spin: 0, wait: 0, c0: new THREE.Color(), c1: new THREE.Color() }); }
  return { a, i: 0 };
}
export function initFx(sc, cam, o = {}) {
  scene = sc; camera = cam; K = o.hdr ? 2.2 : 1; LOW = !!o.low;
  const tg = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ map: tracerTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); m.matrixAutoUpdate = false; m.frustumCulled = false; m.visible = false; m.renderOrder = 6; scene.add(m); tracers.push({ m, life: 0 }); }
  for (let i = 0; i < 56; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), holeMats[0]); m.visible = false; scene.add(m); holes.push(m); }
  for (let i = 0; i < 20; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.visible = false; sp.renderOrder = 6; scene.add(sp); sparks.push({ s: sp, life: 0, max: 0.09 }); }
  sparkPts = makePts(LOW ? 110 : 240, 0.06, true); chipPts = makePts(LOW ? 90 : 160, 0.055, false);
  firePool = makePool(LOW ? 14 : 30, fireTex, true); smokePool = makePool(LOW ? 22 : 44, puffTex, false);
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); rings.push({ m, life: 0, max: 0.35, r: 6 }); }
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); scorches.push({ m, life: 0 }); }
  if (!LOW) { light = new THREE.PointLight(0xffc27a, 0, 14, 2); scene.add(light); } // 총구·폭발의 빛 (늘 하나만 두고 자리를 옮겨 씀)
}

// ───────────── 예광탄 ─────────────
export function addTracer(a, b, color, life = 0.1) { // 총구에서 맞은 곳까지 날아가는 빛줄기
  const t = tracers[tracerIdx = (tracerIdx + 1) % tracers.length];
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 0.01, big = life > 0.12;
  t.a = [a[0], a[1], a[2]]; t.d = [dx / len, dy / len, dz / len]; t.len = len; t.seg = big ? 16 : 11; t.t = -9; t.w = big ? 1.5 : 1;
  t.m.material.color.setHex(color).multiplyScalar(K > 1 ? (big ? 1.5 : 1.15) : 1); t.m.visible = true; t.life = 1;
  moveTracer(t);
}
function moveTracer(t) {
  const t0 = clamp(t.t, 0, t.len), t1 = clamp(t.t + t.seg, 0, t.len), len = Math.max(0.01, t1 - t0), tm = (t0 + t1) / 2;
  _mid.set(t.a[0] + t.d[0] * tm, t.a[1] + t.d[1] * tm, t.a[2] + t.d[2] * tm); _dir.set(t.d[0], t.d[1], t.d[2]);
  _view.subVectors(camera.position, _mid);
  const w = Math.max(0.022, _view.length() * 0.0022) * t.w;
  _side.crossVectors(_dir, _view); if (_side.lengthSq() < 1e-8) _side.set(0, 1, 0); _side.normalize(); _z.crossVectors(_dir, _side);
  const e = t.m.matrix.elements;
  e[0] = _dir.x * len; e[1] = _dir.y * len; e[2] = _dir.z * len; e[3] = 0; e[4] = _side.x * w; e[5] = _side.y * w; e[6] = _side.z * w; e[7] = 0; e[8] = _z.x; e[9] = _z.y; e[10] = _z.z; e[11] = 0; e[12] = _mid.x; e[13] = _mid.y; e[14] = _mid.z; e[15] = 1;
  t.m.matrixWorldNeedsUpdate = true;
}

// ───────────── 탄흔·불티·파편·먼지 ─────────────
export function hole(p, n, k) { // k: 0 돌, 1 쇠, 2 나무, 4 유리, 5 땅
  const h = holes[holeIdx = (holeIdx + 1) % holes.length];
  h.material = holeMats[k === 1 ? 1 : k === 2 ? 2 : k === 4 ? 3 : 0];
  h.position.set(p[0] + n[0] * 0.012, p[1] + n[1] * 0.012, p[2] + n[2] * 0.012);
  h.lookAt(p[0] + n[0], p[1] + n[1], p[2] + n[2]);
  h.rotation.z = Math.random() * 6; h.scale.setScalar(k === 4 ? 2.2 : k === 5 ? 0.8 : 0.85 + Math.random() * 0.4); h.visible = true;
}
export function clearHoles() { for (const h of holes) h.visible = false; for (const s of scorches) { s.m.visible = false; s.life = 0; } }
export function spark(x, y, z, scale, hex, life = 0.09) { // 한순간 번쩍이는 빛 한 점
  const sp = sparks[sparkIdx = (sparkIdx + 1) % sparks.length];
  sp.s.position.set(x, y, z); sp.s.scale.setScalar(scale); sp.s.material.color.setHex(hex).multiplyScalar(K); sp.s.material.opacity = 1; sp.s.visible = true; sp.life = sp.max = life;
}
// p 에서 n 방향으로 cnt 개를 흩뿌림 (speed 빠르기, spread 퍼짐, g 중력). add = 불티(밝게 더해짐), 아니면 부스러기
function emit(S, p, n, cnt, speed, hex, life, g = 9, spread = 0.8) {
  _c.setHex(hex);
  for (let k = 0; k < cnt; k++) {
    const i = S.i = (S.i + 1) % S.n, q = S.p[i], sp = speed * (0.4 + Math.random() * 0.8);
    q.v[0] = (n[0] + (Math.random() - 0.5) * 2 * spread) * sp; q.v[1] = (n[1] + (Math.random() - 0.5) * 2 * spread) * sp + 0.6; q.v[2] = (n[2] + (Math.random() - 0.5) * 2 * spread) * sp;
    q.life = q.max = life * (0.6 + Math.random() * 0.7); q.g = g;
    S.pos[i * 3] = p[0] + n[0] * 0.03; S.pos[i * 3 + 1] = p[1] + n[1] * 0.03; S.pos[i * 3 + 2] = p[2] + n[2] * 0.03;
    const sh = (0.75 + Math.random() * 0.25) * S.k; S.col[i * 4] = _c.r * sh; S.col[i * 4 + 1] = _c.g * sh; S.col[i * 4 + 2] = _c.b * sh; S.col[i * 4 + 3] = 1;
  }
  S.live = 1;
}
export const emitSpark = (p, n, cnt, speed, hex, life, g, spread) => emit(sparkPts, p, n, cnt, speed, hex, life, g, spread);
export const emitChip = (p, n, cnt, speed, hex, life, g, spread) => emit(chipPts, p, n, cnt, speed, hex, life, g, spread);
function updPts(S, dt) {
  if (!S.live) return;
  let any = 0;
  for (let i = 0; i < S.n; i++) {
    const q = S.p[i]; if (q.life <= 0) continue;
    q.life -= dt;
    if (q.life <= 0) { S.pos[i * 3 + 1] = -9999; S.col[i * 4 + 3] = 0; continue; }
    any = 1; q.v[1] -= q.g * dt;
    S.pos[i * 3] += q.v[0] * dt; S.pos[i * 3 + 1] += q.v[1] * dt; S.pos[i * 3 + 2] += q.v[2] * dt;
    S.col[i * 4 + 3] = Math.min(1, (q.life / q.max) * 1.6);
  }
  S.live = any; S.geo.attributes.position.needsUpdate = true; S.geo.attributes.color.needsUpdate = true;
}
// 덩이 하나 내보내기. o = { life 수명, s0·s1 처음·끝 크기, c0·c1 처음·끝 색, op 짙기, v 빠르기, drag 느려지는 정도, g 중력(음수면 떠오름), spin 도는 빠르기, wait 늦게 나타남, k 밝기 배수 }
function spawn(P, x, y, z, o) {
  const p = P.a[P.i = (P.i + 1) % P.a.length];
  p.life = p.max = o.life; p.wait = o.wait || 0; p.s0 = o.s0; p.s1 = o.s1 === undefined ? o.s0 : o.s1; p.op = o.op === undefined ? 1 : o.op; p.drag = o.drag === undefined ? 2 : o.drag; p.g = o.g || 0; p.spin = o.spin || 0;
  p.c0.setHex(o.c0).multiplyScalar(o.k || 1); p.c1.setHex(o.c1 === undefined ? o.c0 : o.c1).multiplyScalar(o.k || 1);
  p.v[0] = o.v ? o.v[0] : 0; p.v[1] = o.v ? o.v[1] : 0; p.v[2] = o.v ? o.v[2] : 0;
  p.s.position.set(x, y, z); p.s.scale.setScalar(p.s0); p.s.material.rotation = Math.random() * 6.283; p.s.material.opacity = 0; p.s.material.color.copy(p.c0); p.s.visible = !p.wait;
  return p;
}
function updPool(P, dt) {
  for (const p of P.a) {
    if (p.life <= 0) continue;
    if (p.wait > 0) { p.wait -= dt; if (p.wait > 0) continue; p.s.visible = true; }
    p.life -= dt;
    if (p.life <= 0) { p.s.visible = false; continue; }
    const f = 1 - p.life / p.max, e = 1 - (1 - f) * (1 - f), m = p.s.material;
    p.s.scale.setScalar(p.s0 + (p.s1 - p.s0) * e);
    p.v[1] -= p.g * dt; const d = Math.max(0, 1 - dt * p.drag); p.v[0] *= d; p.v[1] *= d; p.v[2] *= d;
    p.s.position.x += p.v[0] * dt; p.s.position.y += p.v[1] * dt; p.s.position.z += p.v[2] * dt;
    m.opacity = p.op * Math.min(1, f * 14) * Math.min(1, (1 - f) * 2.2); m.color.copy(p.c0).lerp(p.c1, f); m.rotation += p.spin * dt;
  }
}
export function puff(p, v, hex, k = 1, life = 0.5, op = 0.55) { // 먼지·연기 한 덩이
  spawn(smokePool, p[0], p[1], p[2], { life, s0: 0.22 * k, s1: 1.17 * k, c0: hex, op, v, drag: 3, spin: (Math.random() - 0.5) * 1.5 });
}

// ───────────── 번쩍이는 빛 ─────────────
export function lightFlash(x, y, z, hex, intensity, dist, dur) { // 더 센 빛이 남아 있으면 건드리지 않음
  if (!light || (L.t > 0 && L.i * (L.t / L.dur) > intensity)) return;
  light.position.set(x, y, z); light.color.setHex(hex); light.distance = dist; L.i = intensity; L.t = L.dur = dur;
}

// ───────────── 폭발 ─────────────
// kind: 0 수류탄, 1 큰 폭발(폭탄), 2 섬광탄. ground = 바닥 높이 (그을음·충격파를 깔 자리)
export function explode(x, y, z, kind = 0, ground = y) {
  const big = kind === 1 ? 2.6 : 1, R = Math.random, far = camera ? Math.hypot(x - camera.position.x, z - camera.position.z) > 140 : false;
  spawn(firePool, x, y + 0.5, z, { life: kind === 2 ? 0.22 : 0.12, s0: 3 * big, s1: (kind === 2 ? 11 : 7.5) * big, c0: 0xffffff, c1: kind === 2 ? 0xffffff : 0xffe2a0, k: 2.2 * K });
  lightFlash(x, y + 0.9, z, kind === 2 ? 0xffffff : 0xffb060, (kind === 2 ? 260 : 190) * big, 28 * big, kind === 2 ? 0.3 : 0.24);
  if (kind === 2) { emit(sparkPts, [x, y + 0.3, z], [0, 1, 0], 22, 7, 0xffffff, 0.5, 8, 1); return; }
  if (far) return;
  for (let i = 0; i < (LOW ? 3 : 6); i++) { // 불덩이
    const a = R() * 6.283, r = 0.7 * big * R();
    spawn(firePool, x + Math.cos(a) * r, y + 0.4 + R() * 0.9 * big, z + Math.sin(a) * r, { life: 0.36 + R() * 0.26, s0: 1.3 * big, s1: (3 + R() * 1.8) * big, c0: 0xffe9b8, c1: 0xb0340a, v: [Math.cos(a) * 2.4 * big, (1.4 + R() * 2.4) * big, Math.sin(a) * 2.4 * big], drag: 3.2, spin: (R() - 0.5) * 2.4, k: 1.5 * K });
  }
  for (let i = 0; i < (LOW ? 4 : 8); i++) { // 검은 연기가 피어오름
    const a = R() * 6.283, r = 0.9 * big * R();
    spawn(smokePool, x + Math.cos(a) * r, y + 0.5 + R() * big, z + Math.sin(a) * r, { life: 1.9 + R() * 1.6, wait: 0.04 + R() * 0.12, s0: 1.5 * big, s1: (3.8 + R() * 2.4) * big, c0: 0x1c1a18, c1: 0x5c5a58, op: 1, v: [Math.cos(a) * 1.8 * big, (1.5 + R() * 1.8) * big, Math.sin(a) * 1.8 * big], drag: 1.3, g: -0.5, spin: (R() - 0.5) * 0.9 });
  }
  emit(sparkPts, [x, y + 0.3, z], [0, 1, 0], LOW ? 14 : 30, 9.5 * big, 0xffc060, 0.95, 12, 1);   // 불티
  emit(chipPts, [x, y + 0.3, z], [0, 1, 0], LOW ? 8 : 16, 6.5 * big, 0x3a3632, 1.1, 14, 1);       // 흙·파편
  const rg = rings[ringIdx = (ringIdx + 1) % rings.length]; rg.m.position.set(x, ground + 0.06, z); rg.life = rg.max = 0.34; rg.r = 9 * big; rg.m.material.color.setHex(0xffd9a8).multiplyScalar(K * 0.5); rg.m.visible = true; // 바닥을 훑는 충격파
  const sc = scorches[scorchIdx = (scorchIdx + 1) % scorches.length]; sc.m.position.set(x, ground + 0.03, z); sc.m.scale.setScalar(4.6 * big); sc.m.rotation.z = R() * 6; sc.m.material.opacity = 1; sc.life = 26; sc.m.visible = true; // 그을음
}

// ───────────── 연막 ─────────────
export function addSmoke(x, y, z, r, last, night) {
  const g = new THREE.Group(), n = LOW ? 7 : 11;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, color: new THREE.Color(night ? 0x8a8f9c : 0xdadde2).multiplyScalar(0.82 + Math.random() * 0.22), opacity: 0 }));
    const a = Math.random() * 6.28, d = Math.random() * r * 0.55;
    s.position.set(Math.cos(a) * d, 0.5 + Math.random() * r * 0.5, Math.sin(a) * d);
    s.userData = { k: 0.8 + Math.random() * 0.5, at: i * 0.07, spin: (Math.random() - 0.5) * 0.25, vx: (Math.random() - 0.5) * 0.12, vz: (Math.random() - 0.5) * 0.12 };
    s.material.rotation = Math.random() * 6.283; s.renderOrder = 5;
    g.add(s);
  }
  g.position.set(x, y, z); scene.add(g);
  smokes.push({ g, x, y: y + 1.2, z, r, t: 0, last: last / 1000 });
}
export function clearSmokes() { for (const s of smokes) { scene.remove(s.g); for (const sp of s.g.children) sp.material.dispose(); } smokes.length = 0; }

// ───────────── 매 프레임 ─────────────
export function updateFx(dt) {
  for (const t of tracers) if (t.life > 0) { t.t += dt * 300; if (t.t >= t.len) { t.life = 0; t.m.visible = false; } else moveTracer(t); }
  for (const s of sparks) if (s.life > 0) { s.life -= dt; s.s.material.opacity = clamp(s.life / s.max, 0, 1); if (s.life <= 0) s.s.visible = false; }
  updPts(sparkPts, dt); updPts(chipPts, dt); updPool(firePool, dt); updPool(smokePool, dt);
  for (const r of rings) if (r.life > 0) { r.life -= dt; const f = 1 - r.life / r.max; r.m.scale.setScalar(0.6 + r.r * (1 - (1 - f) * (1 - f))); r.m.material.opacity = 0.7 * (1 - f); if (r.life <= 0) r.m.visible = false; }
  for (const s of scorches) if (s.life > 0) { s.life -= dt; if (s.life < 4) s.m.material.opacity = Math.max(0, s.life / 4); if (s.life <= 0) s.m.visible = false; }
  if (light) { if (L.t > 0) { L.t -= dt; light.intensity = L.t > 0 ? L.i * (L.t / L.dur) * (L.t / L.dur) : 0; } else if (light.intensity) light.intensity = 0; }
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i]; s.t += dt;
    const fade = clamp((s.last - s.t) / 2.5, 0, 1);
    for (const sp of s.g.children) { const u = sp.userData, grow = clamp((s.t - u.at) / 1.3, 0, 1); sp.scale.setScalar(s.r * 1.5 * u.k * (0.2 + grow * 0.8)); sp.material.opacity = 0.92 * fade * Math.min(1, grow * 3); sp.material.rotation += u.spin * dt; sp.position.x += u.vx * dt; sp.position.z += u.vz * dt; }
    if (s.t >= s.last) { scene.remove(s.g); for (const sp of s.g.children) sp.material.dispose(); smokes.splice(i, 1); }
  }
}
