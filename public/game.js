// SQUAD CLASH — 클라이언트
import * as THREE from './vendor/three.module.js';
import { ARENA, PLAYER, WEAPONS, SKINS, NADES, ECON, NADE_WEAPON, ZONE_WEAPON, VEH_WEAPON, W_KNIFE, W_PISTOL, MAPS, setMap, BOXES, SITES, siteAt, dirFrom, rayWorld, rayPlayer, hitNormal, segHitsSphere, groundAt, waterAt, boxesNear } from './shared.js';
import { makeGun, makeArms, initGunEnv, tickSkins, skinFx } from './guns.js';
import { buildBody, paintTex, isPaint, initPaintEditor, paintUI } from './paint.js';
import { buildWorld, blobShadow, MOODS } from './world.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('touch', isTouch);
const store = {
  get(k, d) { try { const v = localStorage.getItem('sc_' + k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sc_' + k, v); } catch {} },
};
const TEAM_COL = [0xff4d5a, 0x3d9bff];
const TEAM_CSS = ['#ff4d5a', '#3d9bff'];
const TEAM_CLS = ['tr', 'tb'];
const TEAM_NAME = ['레드팀', '블루팀'];
const BR_COL = [0xff8a3d, 0x9b6bff, 0x3ddc97, 0xe8c33a, 0xff5fa2, 0x5ad1ff, 0xd94f4f, 0x8fa3b8]; // 생존전 조끼 색
const RADIO = ['A 지점으로!', 'B 지점으로!', '적 발견!', '도와줘!', '좋아!', '고마워!'];
const gfx = ['low', 'mid', 'high'].includes(store.get('gfx', '')) ? store.get('gfx', '') : (isTouch ? 'mid' : 'high');

// ───────────── 화면 ─────────────
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: gfx === 'high', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, gfx === 'low' ? 1 : gfx === 'mid' ? 1.5 : 2));
renderer.autoClear = false;
initGunEnv(renderer);
// 스킨: 무기마다 고른 스킨 번호, 등록한 코드, 쓸 수 있는 스킨
const jget = (k, d) => { try { const v = JSON.parse(store.get(k, '')); return v ?? d; } catch { return d; } };
let mySk = WEAPONS.map((_, i) => { const v = jget('sk', [])[i]; return SKINS[v] ? v : 0; });
let myCodes = jget('codes', []).filter((c) => typeof c === 'string').slice(0, 24);
const unlocked = new Set(SKINS.map((k, i) => (k.free ? i : -1)).filter((i) => i >= 0));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500);
camera.rotation.order = 'YXZ';
const worldOpt = { shadows: gfx !== 'low', shadowSize: gfx === 'high' ? 2048 : 1024, lowFar: gfx === 'low', farK: gfx === 'low' ? 0.55 : gfx === 'mid' ? 0.8 : 1, mood: 0 };
let world = buildWorld(scene, renderer, worldOpt);
camera.far = world.far;

const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
vmScene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.7));
const vmSun = new THREE.DirectionalLight(0xffffff, 1.4);
vmSun.position.set(-0.6, 2, 1.5);
vmScene.add(vmSun);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = vmCam.aspect = w / h;
  camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

// ───────────── 캐릭터 ─────────────
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const darkMat = lam(0x23262c), skinMat = lam(0xe9bf99), uniMat = lam(0x4a4f45), strapMat = lam(0x2f3338);
const teamMat = TEAM_COL.map((c) => lam(c));
const teamDark = TEAM_COL.map((c) => lam(new THREE.Color(c).multiplyScalar(0.62)));
const brMat = BR_COL.map((c) => lam(c)), brDark = BR_COL.map((c) => lam(new THREE.Color(c).multiplyScalar(0.62)));
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };

function nameSprite(text, team) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = '800 34px system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(text, 128, 32);
  g.fillStyle = team ? '#8cc4ff' : '#ff9aa2'; g.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(1.5, 0.375, 1);
  s.position.y = 2.2;
  return s;
}
// 캐릭터: 하얀 인형 몸에 저마다 그린 그림을 입힌다 (목의 띠가 팀 색). 봇은 무작위 위장 무늬
const paints = new Map(); // 사람 id → 그림 자료(문자열)
function paintTexOf(info) {
  const d = paints.get(info.id);
  if (isPaint(d)) return paintTex('p' + info.id + ':' + d.length + ':' + d.slice(-40), 'url', d);
  if (info.bot) return paintTex('b' + info.id, 'camo', info.id * 7 + 3);
  return paintTex('def');
}
function makeAvatar(info) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const br = info.ci !== undefined;
  const { body, head, legs, arms, mat } = buildBody(paintTexOf(info), br ? brMat[info.ci] : teamMat[info.team]); // body = 쓰러질 때 통째로 기울이는 부분
  g.add(body);
  const tag = nameSprite(info.name, br ? 0 : info.team);
  g.add(tag, blobShadow());
  g.visible = false;
  scene.add(g);
  const av = { g, body, head, legs, arms, tag, mat, bot: !!info.bot, guns: [], w: -1, c: false, cs: 1, buf: [], x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hp: 100, alive: false, wasAlive: false, deadT: 9, prot: false, walk: 0, stepT: 0, shotAt: 0, team: info.team, name: info.name, chute: null, ci: info.ci, id: info.id, sk: info.sk || null };
  holdGun(av, W_PISTOL);
  return av;
}
function holdGun(o, wi) { // 다른 사람이 든 무기 바꾸기 (모델은 처음 필요할 때 만든다)
  if (!WEAPONS[wi] || o.w === wi) return;
  if (!o.guns[wi]) {
    const gg = makeGun(wi, o.sk ? o.sk[wi] : 0).group, small = WEAPONS[wi].vm === 'pistol' || WEAPONS[wi].vm === 'knife';
    gg.scale.setScalar(1.3); gg.position.set(0.19, 0.07, small ? -0.7 : -0.52);
    o.arms.add(gg); o.guns[wi] = gg;
  }
  o.guns.forEach((gg, i) => { if (gg) gg.visible = i === wi; });
  o.w = wi;
}

// ───────────── 폭탄전: 설치 지점 · 폭탄 ─────────────
const siteMarks = new THREE.Group();
siteMarks.visible = false;
scene.add(siteMarks);
function labelSprite(text, color, size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(14,17,22,.78)'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = color; g.stroke();
  g.fillStyle = color; g.font = `900 ${text.length > 1 ? 44 : 78}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 68);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.set(size, size, 1); sp.renderOrder = 5;
  return sp;
}
function buildSites() { // 맵이 바뀌면 다시 만든다
  for (const c of [...siteMarks.children]) { siteMarks.remove(c); if (c.material.map) c.material.map.dispose(); c.material.dispose(); }
  for (const st of SITES) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(255,160,40,.16)'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,190,70,.95)'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
    g.setLineDash([10, 8]); g.lineWidth = 3; g.strokeRect(16, 16, 96, 96);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(st.r * 2, st.r * 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    pl.rotation.x = -Math.PI / 2; const sy = groundAt(st.x, st.z); pl.position.set(st.x, sy + 0.035, st.z);
    const sp = labelSprite(st.name, '#ffbe46', 2.2);
    sp.position.set(st.x, sy + 7, st.z);
    siteMarks.add(pl, sp);
  }
}
buildSites();
const bombMesh = new THREE.Group();
const bombLight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
bombLight.position.set(0.09, 0.2, 0);
const bombTag = labelSprite('폭탄', '#ff5a4d', 0.9);
bombTag.position.y = 1.5;
bombMesh.add(box(0.36, 0.16, 0.24, darkMat, 0, 0.08, 0), box(0.2, 0.05, 0.12, lam(0xc8a24a), -0.04, 0.18, 0), bombLight, bombTag);
bombMesh.visible = false;
scene.add(bombMesh);

// ───────────── 1인칭 총 ─────────────
const vm = new THREE.Group();
vmScene.add(vm);
const sleeveMat = new THREE.MeshStandardMaterial({ color: TEAM_COL[0], roughness: 0.9, metalness: 0 });
const VM = { // 무기 자세별 1인칭 위치, 정조준 깊이, 반동 [뒤로 밀림, 위로 들림], 정조준 시야각
  knife: { pos: [0.17, -0.1, -0.36], adsZ: -0.36, kick: [-0.17, -0.3], fov: 75, rot: [0.45, 0.3, -0.35] },
  pistol: { pos: [0.16, -0.15, -0.42], adsZ: -0.36, kick: [0.05, 0.12], fov: 60 },
  smg: { pos: [0.19, -0.185, -0.47], adsZ: -0.33, kick: [0.02, 0.03], fov: 56 },
  rifle: { pos: [0.19, -0.185, -0.5], adsZ: -0.34, kick: [0.03, 0.035], fov: 52 },
  shotgun: { pos: [0.19, -0.175, -0.52], adsZ: -0.54, kick: [0.09, 0.16], fov: 62 },
  sniper: { pos: [0.19, -0.2, -0.5], adsZ: -0.5, kick: [0.1, 0.14], fov: 20 },
  mg: { pos: [0.2, -0.2, -0.5], adsZ: -0.36, kick: [0.03, 0.03], fov: 56 },
};
const guns = [];
function vmGun(wi) { // 1인칭 총 모델도 처음 들 때 만든다 (스킨이 바뀌면 다시 만듦)
  if (guns[wi] && guns[wi].userData.skin !== mySk[wi]) { vm.remove(guns[wi]); guns[wi] = null; }
  if (!guns[wi]) {
    const info = makeGun(wi, mySk[wi]), g = new THREE.Group(), v = VM[WEAPONS[wi].vm], arms = makeArms(info, sleeveMat);
    g.add(info.group, arms);
    g.position.set(...v.pos);
    if (v.rot) info.group.rotation.set(...v.rot);
    g.userData.muzzle = info.muzzle; g.userData.ads = [0, -info.sight, v.adsZ]; g.userData.skin = mySk[wi]; g.userData.info = info; g.userData.lh = arms.userData.lh;
    g.visible = wi === me.w;
    vm.add(g); guns[wi] = g;
  }
  return guns[wi];
}
function softTex(stops, lines) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, c] of stops) rg.addColorStop(o, c);
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  if (lines) { g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 4; g.beginPath(); g.moveTo(32 - Math.cos(a) * 30, 32 - Math.sin(a) * 30); g.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30); g.stroke(); } }
  return new THREE.CanvasTexture(cv);
}
const flashTex = softTex([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.85)'], [0.6, 'rgba(255,255,255,.3)'], [1, 'rgba(255,255,255,0)']], true); // 흰 바탕 — 색은 스킨에 따라 입힘
const FX0 = { tracer: 0xffffff, flash: 0xffd27a }, _fxc = new THREE.Color();
function fxOf(skin) { // 스킨의 궤적·불꽃 색 (오로라는 무지갯빛으로 계속 바뀜)
  const f = skinFx(skin);
  if (!f) return FX0;
  if (f.rainbow) { const c = _fxc.setHSL((performance.now() / 700) % 1, 1, 0.68).getHex(); return { tracer: c, flash: c }; }
  return f;
}
const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
flash.visible = false;
vm.add(flash);

// ───────────── 효과: 궤적 · 탄흔 · 불꽃 · 폭발 · 연막 ─────────────
const tracers = [];
for (let i = 0; i < 28; i++) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0 }));
  l.frustumCulled = false; l.visible = false;
  scene.add(l);
  tracers.push({ l, life: 0 });
}
let tracerIdx = 0;
function addTracer(a, b, color, life = 0.1) {
  const t = tracers[tracerIdx = (tracerIdx + 1) % tracers.length];
  const p = t.l.geometry.attributes.position;
  p.setXYZ(0, a[0], a[1], a[2]); p.setXYZ(1, b[0], b[1], b[2]);
  p.needsUpdate = true;
  t.l.material.color.setHex(color); t.l.visible = true; t.life = life;
}
const holeMat = new THREE.MeshBasicMaterial({ map: softTex([[0, 'rgba(8,8,8,.95)'], [0.45, 'rgba(15,15,15,.85)'], [0.7, 'rgba(40,40,40,.3)'], [1, 'rgba(40,40,40,0)']]), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const holes = [];
for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), holeMat); m.visible = false; scene.add(m); holes.push(m); }
let holeIdx = 0;
const sparkTex = softTex([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']]);
const sparks = [];
for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.visible = false; scene.add(s); sparks.push({ s, life: 0 }); }
let sparkIdx = 0;
const dusts = [];
for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: null, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; scene.add(sp); dusts.push({ s: sp, life: 0 }); }
let dustIdx = 0;
// 1인칭 탄피
const casings = [];
function updateCasings(dt) {
  for (const c of casings) { if (c.life <= 0) continue; c.life -= dt; c.v[1] -= 9 * dt; c.m.position.x += c.v[0] * dt; c.m.position.y += c.v[1] * dt; c.m.position.z += c.v[2] * dt; c.m.rotation.x += dt * 14; c.m.rotation.z += dt * 9; if (c.life <= 0) c.m.visible = false; }
  for (const d of dusts) { if (d.life <= 0) continue; d.life -= dt; const f = 1 - d.life / 0.5; d.s.scale.setScalar(0.25 + f * 0.9); d.s.position.y += dt * 0.5; d.s.material.opacity = 0.55 * (1 - f); if (d.life <= 0) d.s.visible = false; }
}
function impact(p, col = 0xffd890) { // 벽·바닥에 맞은 자리
  const n = hitNormal(p);
  if (!n) return;
  if (Math.hypot(p[0] - camera.position.x, p[2] - camera.position.z) < 70) { // 먼지: 땅은 흙빛, 벽은 잿빛
    const d = dusts[dustIdx = (dustIdx + 1) % dusts.length];
    if (!d.s.material.map) d.s.material.map = smokeTex;
    d.s.material.color.setHex(n[1] > 0.7 ? (MAPS[curMap].br ? 0x9a8660 : MAPS[curMap].key === 'town' ? 0xc9ab7c : MAPS[curMap].key === 'castle' ? 0x8a8f66 : 0x8a8d92) : 0xb0b2b5);
    d.s.position.set(p[0] + n[0] * 0.12, p[1] + n[1] * 0.12, p[2] + n[2] * 0.12); d.s.visible = true; d.life = 0.5;
  }
  const h = holes[holeIdx = (holeIdx + 1) % holes.length];
  h.position.set(p[0] + n[0] * 0.012, p[1] + n[1] * 0.012, p[2] + n[2] * 0.012);
  h.lookAt(p[0] + n[0], p[1] + n[1], p[2] + n[2]);
  h.rotation.z = Math.random() * 6; h.visible = true;
  const sp = sparks[sparkIdx = (sparkIdx + 1) % sparks.length];
  sp.s.position.set(p[0] + n[0] * 0.05, p[1] + n[1] * 0.05, p[2] + n[2] * 0.05); sp.s.scale.setScalar(0.35); sp.s.material.color.setHex(col); sp.s.visible = true; sp.life = 0.09;
}
const boomTex = softTex([[0, 'rgba(255,250,220,1)'], [0.3, 'rgba(255,190,80,.9)'], [0.65, 'rgba(230,90,30,.45)'], [1, 'rgba(120,40,10,0)']]);
const smokeTex = softTex([[0, 'rgba(205,208,212,.95)'], [0.5, 'rgba(190,194,198,.75)'], [1, 'rgba(180,184,190,0)']]);
const booms = [], smokes = [];
function addBoom(x, y, z) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: boomTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.position.set(x, y + 0.6, z); scene.add(s); booms.push({ s, t: 0 });
}
function addSmoke(x, y, z, r, last) {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, color: 0xd6d9dd }));
    const a = Math.random() * 6.28, d = Math.random() * r * 0.55;
    s.position.set(Math.cos(a) * d, 0.5 + Math.random() * r * 0.5, Math.sin(a) * d);
    s.userData.k = 0.8 + Math.random() * 0.5;
    g.add(s);
  }
  g.position.set(x, y, z); scene.add(g);
  smokes.push({ g, x, y: y + 1.2, z, r, t: 0, last: last / 1000 });
}
const nadeMeshes = new Map(), dropMeshes = new Map();
const nadeGeo = new THREE.SphereGeometry(0.09, 10, 8);
const nadeMats = [lam(0x44552f), lam(0x8d939a), lam(0xe6e6e6)];

// ───────────── 생존전: 안전 구역 벽 · 낙하산 · 바닥 아이템 ─────────────
const zoneTex = (() => {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d'), lg = g.createLinearGradient(0, 0, 0, 256);
  lg.addColorStop(0, 'rgba(90,170,255,0)'); lg.addColorStop(0.55, 'rgba(90,170,255,.2)'); lg.addColorStop(1, 'rgba(120,200,255,.6)');
  g.fillStyle = lg; g.fillRect(0, 0, 64, 256);
  g.fillStyle = 'rgba(200,235,255,.14)'; for (let i = 0; i < 2; i++) g.fillRect(i * 32, 0, 2, 256);
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.repeat.set(160, 1); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const zoneWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), new THREE.MeshBasicMaterial({ map: zoneTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }));
zoneWall.visible = false; zoneWall.renderOrder = 3; zoneWall.frustumCulled = false;
scene.add(zoneWall);
function makeChute(col) { // 낙하산: 반구 덮개와 줄
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.3), new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }));
  top.scale.y = 0.6; top.position.y = 3.6;
  g.add(top);
  const lm = new THREE.LineBasicMaterial({ color: 0xdddddd });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(Math.cos(a) * 2.5, 3.75, Math.sin(a) * 2.5)]), lm)); }
  return g;
}
const myChute = makeChute(0xffd23f);
myChute.visible = false; scene.add(myChute);
const medMat = lam(0xf2f2f2), medRed = lam(0xd83a3a), vestMat = lam(0x3f6fb0), vestMat2 = lam(0x25446e);
function lootMesh(it) {
  const g = new THREE.Group();
  let ringCol = 0xffffff;
  if (it.k === 0) {
    const gun = makeGun(it.v).group; gun.rotation.z = Math.PI / 2; gun.position.y = 0.07; gun.scale.setScalar(1.3); g.add(gun);
    const pr = WEAPONS[it.v].price; ringCol = pr >= 2900 ? 0xffb02e : pr >= 1600 ? 0xb07cff : pr >= 900 ? 0x5ab8ff : 0xe8edf3;
  } else if (it.k === 1) { g.add(box(0.46, 0.5, 0.2, it.v >= 100 ? vestMat2 : vestMat, 0, 0.3, 0), box(0.14, 0.14, 0.2, it.v >= 100 ? vestMat2 : vestMat, -0.17, 0.6, 0), box(0.14, 0.14, 0.2, it.v >= 100 ? vestMat2 : vestMat, 0.17, 0.6, 0)); ringCol = 0x7fc0ff; }
  else if (it.k === 2) { const m = new THREE.Mesh(nadeGeo, nadeMats[it.v]); m.scale.setScalar(1.6); m.position.y = 0.16; g.add(m); ringCol = 0xd0d6dd; }
  else { g.add(box(0.42, 0.26, 0.3, medMat, 0, 0.14, 0), box(0.2, 0.02, 0.07, medRed, 0, 0.28, 0), box(0.07, 0.02, 0.2, medRed, 0, 0.28, 0)); ringCol = 0x4ade80; }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.55, 20), new THREE.MeshBasicMaterial({ color: ringCol, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6, 1, true), new THREE.MeshBasicMaterial({ color: ringCol, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.y = 0.9;
  g.add(ring, beam);
  g.position.set(it.x, it.y, it.z); g.rotation.y = (it.x * 7 + it.z * 3) % 6.28;
  scene.add(g);
  return g;
}
// 탈것 (사륜차)
const carBody = [lam(0x9aa34a), lam(0xb85c38), lam(0x4a7fa8), lam(0xd9d2c0)], carDark = lam(0x202327), carTire = lam(0x151617), carSeat = lam(0x4a3626), carLamp = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
function makeCar(id) {
  const g = new THREE.Group(), b = carBody[id % carBody.length];
  g.rotation.order = 'YXZ';
  g.add(box(1.7, 0.35, 3.3, b, 0, 0.62, 0), box(1.5, 0.3, 1.0, b, 0, 0.92, -1.1), box(1.7, 0.12, 0.5, carDark, 0, 0.5, -1.72), box(1.7, 0.12, 0.4, carDark, 0, 0.5, 1.7));
  g.add(box(0.5, 0.5, 0.55, carSeat, -0.42, 1.0, 0.3), box(0.5, 0.5, 0.55, carSeat, 0.42, 1.0, 0.3), box(1.4, 0.5, 0.5, b, 0, 0.95, 1.25));
  for (const x of [-0.8, 0.8]) for (const z of [-0.4, 1.0]) g.add(box(0.07, 1.0, 0.07, carDark, x, 1.3, z));
  g.add(box(1.67, 0.07, 1.47, carDark, 0, 1.82, 0.3), box(0.07, 0.07, 1.4, carDark, -0.8, 1.82, 0.3));
  for (const x of [-0.5, 0.5]) g.add(box(0.26, 0.14, 0.05, carLamp, x, 0.86, -1.63));
  for (const x of [-0.92, 0.92]) for (const z of [-1.1, 1.15]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), carTire); w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w); }
  g.add(box(0.4, 0.04, 0.4, carDark, -0.42, 1.25, -0.25)); // 운전대
  scene.add(g);
  return g;
}
function syncVehs(list) {
  const seen = new Set();
  for (const a of list) {
    seen.add(a[0]);
    let v = vehs.get(a[0]);
    if (!v) { v = { g: makeCar(a[0]), x: a[1], y: a[2], z: a[3], yaw: a[4], driver: 0 }; vehs.set(a[0], v); }
    v.tx = a[1]; v.ty = a[2]; v.tz = a[3]; v.tyaw = a[4]; v.driver = a[5];
  }
  for (const [id, v] of vehs) if (!seen.has(id)) { scene.remove(v.g); vehs.delete(id); }
}
function clearVehs() { for (const v of vehs.values()) scene.remove(v.g); vehs.clear(); car.id = 0; nearVeh = null; }
function updateVehs(dt) {
  nearVeh = null; let nd = 3.8;
  for (const [id, v] of vehs) {
    if (id === car.id) { v.x = me.x; v.y = me.y; v.z = me.z; v.yaw = car.yaw; }
    else {
      const k = Math.min(1, dt * 12);
      v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k; v.z += (v.tz - v.z) * k;
      let dy = (v.tyaw - v.yaw) % (Math.PI * 2); if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2;
      v.yaw += dy * k;
      if (!v.driver && me.alive && !car.id) { const d = Math.hypot(v.x - me.x, v.z - me.z); if (d < nd && Math.abs(v.y - me.y) < 2.5) { nd = d; nearVeh = v; } }
    }
    const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw); // 땅 기울기에 맞춰 차체를 기울임
    const pitch = Math.atan2(groundAt(v.x + fx * 1.3, v.z + fz * 1.3) - groundAt(v.x - fx * 1.3, v.z - fz * 1.3), 2.6), roll = Math.atan2(groundAt(v.x - fz * 0.9, v.z + fx * 0.9) - groundAt(v.x + fz * 0.9, v.z - fx * 0.9), 1.8);
    v.g.position.set(v.x, v.y, v.z); v.g.rotation.set(pitch, v.yaw, roll);
    v.g.visible = Math.hypot(v.x - camera.position.x, v.z - camera.position.z) < 260;
  }
}
// 차 몰기: 이동 조작 앞뒤 = 가속·후진, 좌우 = 방향
function driveCar(dt) {
  let thr = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - input.jy;
  let steer = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + input.jx;
  thr = clamp(thr, -1, 1); steer = clamp(steer, -1, 1);
  if (Math.abs(thr) < 0.15) thr = 0;
  const wet = groundAt(me.x, me.z, true) < -0.6, max = wet ? 3.5 : 21;
  if (thr) car.sp += thr * (Math.sign(thr) !== Math.sign(car.sp) && Math.abs(car.sp) > 0.5 ? 22 : thr > 0 ? 9 : 6) * dt;
  else car.sp -= Math.sign(car.sp) * Math.min(Math.abs(car.sp), 5 * dt);
  car.sp = clamp(car.sp, -7, max);
  const turn = -steer * 1.75 * dt * clamp(car.sp / 6, -1, 1) / (1 + Math.abs(car.sp) * 0.035);
  car.yaw += turn; me.yaw += turn; // 시점도 차를 따라 돈다
  const lim = 1.3, nx = clamp(me.x - Math.sin(car.yaw) * car.sp * dt, -ARENA.hx + lim, ARENA.hx - lim), nz = clamp(me.z - Math.cos(car.yaw) * car.sp * dt, -ARENA.hz + lim, ARENA.hz - lim);
  const hitBox = (x, z) => { const y = groundAt(x, z) + 0.35; for (const b of boxesNear(x, z, 1.15)) if (x + 1.1 > b.min[0] && x - 1.1 < b.max[0] && z + 1.1 > b.min[2] && z - 1.1 < b.max[2] && y < b.max[1] && y + 1.3 > b.min[1]) return true; return false; };
  if (hitBox(nx, nz)) { if (Math.abs(car.sp) > 6) { me.shake = Math.max(me.shake, 0.35); sfxStep(0.25, 0); } car.sp *= -0.25; }
  else { me.x = nx; me.z = nz; }
  me.y = groundAt(me.x, me.z); me.vx = me.vy = me.vz = 0; me.onGround = true;
}
// 보급 상자
const crate = new THREE.Group();
{
  const cm = lam(0x3f6b52), cs = lam(0xd9a52a);
  crate.add(box(1.5, 1.2, 1.5, cm, 0, 0.6, 0), box(1.56, 0.16, 1.56, cs, 0, 0.3, 0), box(1.56, 0.16, 1.56, cs, 0, 0.9, 0));
  const ch = makeChute(0xe04a3a); ch.scale.setScalar(1.5); ch.position.y = -0.6; crate.add(ch); crate.userData.chute = ch;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 60, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.y = 31; crate.add(beam); crate.userData.beam = beam;
  crate.visible = false; scene.add(crate);
}
let lootT = 0;
function updateLoot(dt) { // 가까운 아이템만 그리고, 바꿔 들 수 있는 무기를 찾는다
  lootT -= dt;
  if (lootT > 0) return;
  lootT = 0.25;
  const cx = camera.position.x, cz = camera.position.z;
  nearLoot = null; let nd = 2.2;
  for (const it of loot.values()) {
    const d = Math.hypot(it.x - cx, it.z - cz);
    if (d < 65) { if (!it.mesh) it.mesh = lootMesh(it); it.mesh.visible = true; } else if (it.mesh) it.mesh.visible = false;
    if (it.k === 0 && me.alive && d < nd && Math.abs(it.y - me.y) < 2) { const W = WEAPONS[it.v]; if (inv[W.slot] !== it.v && (W.slot === 'prim' ? inv.prim > 0 : inv.side !== W_PISTOL)) { nd = d; nearLoot = it; } }
  }
}

// ───────────── 소리 ─────────────
let AC = null, noiseBuf = null, master = null;
let volume = parseFloat(store.get('vol', '0.8'));
if (!(volume >= 0 && volume <= 1)) volume = 0.8;
function initAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = volume; master.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.4, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (AC.state === 'suspended') AC.resume();
  } catch { AC = null; }
}
let ambient = null;
function setAmbient(on) { // 섬에서는 바람 소리가 잔잔히 깔림
  if (!AC || !!ambient === on) return;
  if (!on) { try { ambient.src.stop(); } catch {} ambient = null; return; }
  const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
  const g = AC.createGain(); g.gain.value = 0.05;
  const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 0.025; lfo.connect(lg).connect(g.gain); lfo.start();
  src.connect(f).connect(g).connect(master); src.start();
  ambient = { src };
}
let engine = null;
function engineSound(sp) { // sp < 0 이면 끔
  if (!AC) return;
  if (sp < 0) { if (engine) { engine.g.gain.setTargetAtTime(0, AC.currentTime, 0.1); const e = engine; engine = null; setTimeout(() => { try { e.o.stop(); } catch {} }, 400); } return; }
  if (!engine) { const o = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0; o.connect(f).connect(g).connect(master); o.start(); engine = { o, g, f }; }
  engine.o.frequency.setTargetAtTime(42 + sp * 5.5, AC.currentTime, 0.08); engine.g.gain.setTargetAtTime(0.045 + Math.min(0.05, sp * 0.003), AC.currentTime, 0.1); engine.f.frequency.setTargetAtTime(380 + sp * 30, AC.currentTime, 0.1);
}
function sfxSplash(vol) {
  if (!AC || vol < 0.015) return;
  const t = AC.currentTime, src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 500; f.Q.value = 0.7;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  src.connect(f).connect(g).connect(master); src.start(t, Math.random() * 0.1); src.stop(t + 0.24);
}
function out(pan) { // 좌우 방향이 있는 소리 출력
  if (!pan || !AC.createStereoPanner) return master;
  const p = AC.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(master); return p;
}
const SHOT = { side: [0.09, 3600, 200], smg: [0.08, 3400, 190], ar: [0.11, 3200, 170], sg: [0.26, 1700, 110], sr: [0.34, 2400, 90], mg: [0.13, 2700, 140] };
function sfxShot(wi, vol, pan, far = 0) { // far 0~1: 멀수록 먹먹하게
  const W = WEAPONS[wi];
  if (W.melee) { sfxStep(vol * 0.5, pan); return; }
  if (W.quiet) vol *= 0.4;
  if (!AC || vol < 0.02) return;
  let [dur, lp, osc] = SHOT[W.pellets > 1 ? 'sg' : W.dmg > 50 && W.cat === 'side' ? 'sr' : W.cat] || SHOT.ar;
  if (W.quiet) { dur *= 0.7; lp = 1400; }
  if (far > 0) { lp *= 1 - 0.8 * far; dur *= 1 + far * 0.6; }
  const t = AC.currentTime, dst = out(pan);
  const src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(lp, t); f.frequency.exponentialRampToValueAtTime(300, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(dst); src.start(t); src.stop(t + dur);
  const o = AC.createOscillator(), og = AC.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(osc, t); o.frequency.exponentialRampToValueAtTime(40, t + dur * 0.7);
  og.gain.setValueAtTime(vol * 0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.7);
  o.connect(og).connect(dst); o.start(t); o.stop(t + dur);
}
function sfxBoom(vol = 0.9, dur = 1.8, pan = 0) {
  if (!AC || vol < 0.02) return;
  const t = AC.currentTime, src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(60, t + dur * 0.9);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(out(pan)); src.start(t); src.stop(t + dur);
}
function sfxStep(vol, pan) {
  if (!AC || vol < 0.015) return;
  const t = AC.currentTime, src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420 + Math.random() * 160; f.Q.value = 1.2;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.connect(f).connect(g).connect(out(pan)); src.start(t, Math.random() * 0.2); src.stop(t + 0.1);
}
function sfxTone(freq, dur, vol, type = 'sine', to = freq) {
  if (!AC) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur);
}
function heard(x, z, range) { // 내 위치 기준 [크기 0~1, 좌우]
  const dx = x - camera.position.x, dz = z - camera.position.z, d = Math.hypot(dx, dz);
  const right = Math.cos(me.yaw) * dx - Math.sin(me.yaw) * dz;
  return [clamp(1 - d / range, 0, 1), d > 0.5 ? clamp(right / d, -1, 1) * 0.8 : 0];
}

// ───────────── 상태 ─────────────
const me = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, hp: 100, alive: false, w: W_PISTOL, lastW: W_KNIFE, burstLeft: 0, burstAt: 0, spin: 0, ammo: WEAPONS.map((w) => w.mag), reloadEnd: 0, lastShot: 0, shotN: 0, onGround: true, prot: false, scoped: false, kickAnim: 0, bob: 0, draw: 0, swx: 0, swy: 0, crouch: false, sprint: false, slideT: 0, slx: 0, slz: 0, drop: false, inspAt: -1e9, rackN: 0, eyeH: PLAYER.eye, adsT: 0, sprT: 0, stepT: 0, shake: 0, flashUntil: 0, flashDur: 1 };
const inv = { money: 0, prim: 0, side: W_PISTOL, armor: 0, n: [0, 0, 0], med: 0 };
const others = new Map();
let roster = [];
let ws = null, myId = 0, myTeam = 0, joined = false, lastJoin = null, timeOff = null, ping = 0;
let score = [0, 0], timeLeft = 0, matchEnded = false, respawnAt = 0, killLimit = 30;
let sens = parseFloat(store.get('sens', '1')) || 1;
let autoFire = isTouch && store.get('auto', '1') === '1'; // 자동 사격은 모바일(터치) 전용
$('sens').value = sens; $('autoFire').checked = autoFire; $('name').value = store.get('name', ''); $('vol').value = volume; $('gfx').value = gfx;
const input = { jx: 0, jy: 0, fire: false, jump: false, act: false, sprint: false };
let curMap = 0, specIdx = 0, multiKill = 0, lastKillAt = 0, radioOpen = false;
let mode = 'tdm', phase = 'tdm', attack = 0, roundNo = 0, acting = false, actSent = false, lastBeep = 0, shopOpen = false;
let selMode = ['tdm', 'br'].includes(store.get('mode', 'bomb')) ? store.get('mode', 'bomb') : 'bomb';
const bomb = { st: 'none', x: 0, z: 0, carrier: 0, actor: 0, prog: 0 };
const zone = { on: false, cx: 0, cz: 0, r: 190, nx: 0, nz: 0, nr: 190, shrinking: false, stage: 0 }; // 생존전 안전 구역
const loot = new Map(); // 생존전 바닥 아이템: id → { k, v, x, y, z, mesh }
let myRank = 0, brTotal = 0, healEnd = 0, healDur = 1, nearLoot = null, brWinner = 0, nearVeh = null;
const vehs = new Map(); // 탈것: id → { g, x, y, z, yaw, tx, ty, tz, tyaw, driver }
const car = { id: 0, yaw: 0, sp: 0, at: 0 }; // 내가 모는 차 (at = 탄 시각)
let airdrop = null; // 보급 상자 [x, y, z, 착지]
const keys = new Set();
const owned = (wi) => wi === W_KNIFE || wi === inv.side || (inv.prim > 0 && wi === inv.prim);
const canFight = () => !matchEnded && (mode === 'tdm' || phase === 'live' || phase === 'planted') && !me.drop && !car.id;
const clsOf = (p) => (mode === 'br' ? (p.id === myId ? 'tme' : 'tn') : TEAM_CLS[p.team]);
function applySides() { // 진영 바닥 색: 폭탄전은 서쪽이 공격팀
  const west = mode === 'bomb' ? attack : 0;
  world.zones[0].material.color.setHex(TEAM_COL[west]); world.zones[1].material.color.setHex(TEAM_COL[west ^ 1]);
}
applySides();
function canAct() {
  if (mode === 'br') return (!!nearLoot || !!nearVeh || !!car.id) && me.alive && !matchEnded && !me.drop;
  if (mode !== 'bomb' || !me.alive || matchEnded) return false;
  if (phase === 'live') return bomb.st === 'carried' && bomb.carrier === myId && siteAt(me.x, me.z) >= 0 && me.y - groundAt(me.x, me.z) < 0.3;
  if (phase === 'planted') return myTeam !== attack && Math.hypot(me.x - bomb.x, me.z - bomb.z) < 1.8;
  return false;
}

// ───────────── 네트워크 ─────────────
function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  ws.onopen = () => { timeOff = null; send({ t: 'join', name: lastJoin.name, room: lastJoin.room, mode: lastJoin.mode, map: lastJoin.map, bot: lastJoin.bot, sk: lastJoin.sk, codes: lastJoin.codes, paint: lastJoin.paint || undefined }); };
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
  ws.onclose = () => {
    if (!lastJoin) return;
    if (joined) $('net').classList.remove('hide'); else $('menuMsg').textContent = '서버에 연결하는 중…';
    for (const o of others.values()) scene.remove(o.g);
    others.clear();
    setTimeout(connect, 1500);
  };
}
function onMsg(m) {
  switch (m.t) {
    case 'welcome':
      mode = m.mode;
      myId = m.id; myTeam = mode === 'br' ? 0 : m.team; sleeveMat.color.setHex(0x2c2f36).lerp(new THREE.Color(mode === 'br' ? 0x4a4f45 : TEAM_COL[myTeam]), 0.22); killLimit = m.limit; joined = true; matchEnded = false;
      loadMap(m.map || 0);
      if (Array.isArray(m.sk)) mySk = m.sk.slice();
      attack = m.attack; phase = mode === 'bomb' ? 'over' : mode === 'br' ? 'wait' : 'tdm'; me.alive = false; me.drop = false; bomb.st = 'none'; siteMarks.visible = mode === 'bomb'; applySides(); $('dead').classList.add('hide');
      document.body.classList.toggle('br', mode === 'br'); zone.on = false; clearLoot(); clearVehs(); airdrop = null; myRank = 0; healEnd = 0; openShop(false);
      $('mini').height = mode === 'br' ? 300 : 216; $('mini').style.height = ''; document.body.classList.toggle('sqmini', mode === 'br');
      $('menu').classList.add('hide'); $('hud').classList.remove('hide'); $('net').classList.add('hide'); $('board').classList.add('hide');
      document.body.classList.add('playing');
      $('roomTxt').textContent = m.pub ? '공개방' : '방 ' + m.code;
      $('sR').classList.toggle('mine', myTeam === 0); $('sB').classList.toggle('mine', myTeam === 1);
      $('roomTxt').textContent += ` · 봇 ${['쉬움', '보통', '어려움', '매우 어려움'][m.botLv ?? 1]}`;
      if (mode === 'br') banner(`${MAPS[curMap].name} · 생존전`, 0xffd23f); else banner(`${MAPS[curMap].name} · ${TEAM_NAME[myTeam]}`, TEAM_COL[myTeam]);
      buildShop();
      break;
    case 'paint': if (isPaint(m.d)) { paints.set(m.id, m.d); const o = others.get(m.id); if (o) { o.mat.map = paintTexOf(o); o.mat.needsUpdate = true; } } break;
    case 'full': $('menuMsg').textContent = '방이 가득 찼어요. 다른 코드를 써 주세요.'; lastJoin = null; ws.close(); break;
    case 'roster': {
      roster = m.players;
      const ids = new Set(roster.map((p) => p.id));
      for (const [id, o] of others) if (!ids.has(id)) { scene.remove(o.g); others.delete(id); }
      for (const p of roster) {
        if (p.id === myId) {
          if (mode !== 'br' && myTeam !== p.team) { // 팀이 바뀜
            myTeam = p.team; sleeveMat.color.setHex(0x2c2f36).lerp(new THREE.Color(TEAM_COL[myTeam]), 0.22);
            $('sR').classList.toggle('mine', myTeam === 0); $('sB').classList.toggle('mine', myTeam === 1);
            banner(`${TEAM_NAME[myTeam]}으로 옮겼습니다`, TEAM_COL[myTeam]);
          }
          continue;
        }
        const o = others.get(p.id), tm = mode === 'br' ? 1 : p.team; // 생존전에서는 나 말고 모두 적
        if (!o || o.team !== tm || o.name !== p.name) { if (o) scene.remove(o.g); others.set(p.id, makeAvatar(mode === 'br' ? { id: p.id, name: p.name, team: 1, ci: p.id % BR_COL.length, sk: p.sk, bot: p.bot } : p)); }
      }
      if (!$('board').classList.contains('hide')) drawBoard();
      break;
    }
    case 'inv': {
      const primChanged = inv.prim !== m.prim, sideChanged = inv.side !== m.side;
      inv.money = m.money; inv.prim = m.prim; inv.side = m.side; inv.armor = m.armor; inv.n = m.n; inv.med = m.med || 0;
      if (primChanged && inv.prim) { me.ammo[inv.prim] = WEAPONS[inv.prim].mag; if (me.alive) setWeapon(inv.prim, true); }
      if (sideChanged) { me.ammo[inv.side] = WEAPONS[inv.side].mag; if (me.alive && !(primChanged && inv.prim)) setWeapon(inv.side, true); }
      if (!owned(me.w)) setWeapon(inv.prim || inv.side, true);
      refreshInv();
      break;
    }
    case 'snap': {
      const off = m.st - performance.now();
      timeOff = timeOff === null || off > timeOff ? off : timeOff * 0.995 + off * 0.005;
      if (mode === 'br' && phase === 'live' && m.sc[0] < score[0] && m.sc[0] > 1 && (m.sc[0] <= 3 || m.sc[0] === 5 || m.sc[0] === 10) && me.alive) banner(`${m.sc[0]}명 남았습니다`, 0xffffff);
      score = m.sc; timeLeft = m.tl;
      if (m.ph) phase = m.ph;
      if (m.at !== attack) { attack = m.at; applySides(); }
      roundNo = m.rn || 0;
      if (m.b) { bomb.st = m.b[0]; bomb.x = m.b[1]; bomb.z = m.b[2]; bomb.carrier = m.b[3]; bomb.actor = m.b[4]; bomb.prog = m.b[5]; }
      if (m.z) { zone.on = true; zone.cx = m.z[0]; zone.cz = m.z[1]; zone.r = m.z[2]; zone.nx = m.z[3]; zone.nz = m.z[4]; zone.nr = m.z[5]; zone.shrinking = !!m.z[6]; zone.stage = m.z[7]; } else zone.on = false;
      if (mode === 'br') { if (m.v) syncVehs(m.v); else if (vehs.size) clearVehs(); airdrop = m.ad || null; }
      for (const a of m.p) {
        if (a[0] === myId) { me.hp = a[6]; me.prot = !!a[9]; if (!a[8] && me.alive) me.alive = false; continue; }
        const o = others.get(a[0]);
        if (!o) continue;
        o.buf.push({ t: m.st, x: a[1], y: a[2], z: a[3], yaw: a[4], pitch: a[5] });
        if (o.buf.length > 30) o.buf.shift();
        o.hp = a[6]; o.alive = !!a[8]; o.prot = !!a[9]; o.c = !!a[10];
        if (o.w !== a[7]) holdGun(o, a[7]);
      }
      const seen = new Set();
      if (m.n) for (const n of m.n) {
        seen.add(n[0]);
        let ms = nadeMeshes.get(n[0]);
        if (!ms) { ms = new THREE.Mesh(nadeGeo, nadeMats[n[1]]); scene.add(ms); nadeMeshes.set(n[0], ms); ms.position.set(n[2], n[3], n[4]); }
        ms.userData.to = [n[2], n[3], n[4]];
      }
      for (const [id, ms] of nadeMeshes) if (!seen.has(id)) { scene.remove(ms); nadeMeshes.delete(id); }
      seen.clear(); // 바닥에 떨어진 무기
      if (m.d) for (const d of m.d) {
        seen.add(d[0]);
        if (dropMeshes.has(d[0])) continue;
        const g = new THREE.Group(), gun = makeGun(d[1]).group;
        gun.rotation.z = Math.PI / 2; gun.position.y = 0.06; gun.scale.setScalar(1.3);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
        g.add(gun, ring); g.position.set(d[2], groundAt(d[2], d[3]), d[3]); g.rotation.y = d[0] * 1.7; g.userData.xz = [d[2], d[3]];
        scene.add(g); dropMeshes.set(d[0], g);
      }
      for (const [id, g] of dropMeshes) if (!seen.has(id)) { scene.remove(g); dropMeshes.delete(id); }
      break;
    }
    case 'spawn':
      if (m.id === myId) {
        me.x = m.p[0]; me.y = m.p[1]; me.z = m.p[2]; me.yaw = m.yaw; me.pitch = m.drop ? -0.7 : 0; me.vx = me.vy = me.vz = 0;
        me.drop = !!m.drop; me.onGround = !m.drop; myRank = 0; healEnd = 0; car.id = 0;
        if (m.drop) banner('낙하 시작 · 이동 조작으로 내릴 곳을 고르세요', 0xffd23f);
        me.hp = 100; me.alive = true; me.reloadEnd = 0; me.sprint = false; me.slideT = 0; if (me.crouch) toggleCrouch();
        me.ammo = WEAPONS.map((w) => w.mag); me.flashUntil = 0; setScope(false);
        me.burstLeft = 0; me.spin = 0;
        setWeapon(inv.prim || inv.side, true);
        $('dead').classList.add('hide');
      } else { const o = others.get(m.id); if (o) o.buf.length = 0; }
      break;
    case 'shot': {
      const o = others.get(m.id);
      if (!o) break;
      const quiet = WEAPONS[m.w].quiet || WEAPONS[m.w].melee;
      if (!quiet) o.shotAt = performance.now(); // 소음 무기는 미니맵에 안 뜸
      const d = dirFrom(o.yaw, o.pitch);
      const a = [o.x + d[0] * 0.9, o.y + (o.c ? 0.9 : 1.3), o.z + d[2] * 0.9];
      const ofx = fxOf(o.sk ? o.sk[m.w] : 0);
      for (const e of m.e) { addTracer(a, e, ofx === FX0 ? 0xfff1b0 : ofx.tracer, ofx === FX0 ? 0.1 : 0.14); impact(e, ofx.flash); }
      const [v, pan] = heard(o.x, o.z, quiet ? 26 : mode === 'br' ? 220 : 90);
      sfxShot(m.w, Math.min(1, v * 1.5) * 0.55, pan, 1 - v);
      break;
    }
    case 'hit':
      if (m.by === myId && m.to !== myId) {
        const h = $('hitm');
        h.classList.toggle('head', m.head); h.classList.add('on');
        clearTimeout(h._t); h._t = setTimeout(() => h.classList.remove('on'), 90);
        sfxTone(m.head ? 1500 : 950, 0.07, 0.16, 'square');
        const ho = others.get(m.to); if (ho) hitBurst(ho.x, ho.y + (m.head ? 1.6 : 1.15), ho.z);
        const sp = document.createElement('span'); // 준 피해 숫자
        sp.textContent = m.dmg; if (m.head) sp.className = 'h';
        sp.style.left = 14 + Math.random() * 16 + 'px'; sp.style.top = -34 + Math.random() * 14 + 'px';
        $('dmgNums').append(sp); setTimeout(() => sp.remove(), 720);
      }
      if (m.to === myId) {
        me.hp = m.hp; inv.armor = m.ar; refreshInv();
        const rel = Math.atan2(-(m.ax - me.x), -(m.az - me.z)) - me.yaw;
        const d = $('dmgDir'); d.style.transition = 'none'; d.style.opacity = m.by === myId || m.zone ? 0 : 1; d.style.transform = `rotate(${-rel}rad)`;
        const v = $('dmg'); v.style.transition = 'none'; v.style.opacity = clamp(0.35 + m.dmg / 80, 0, 1);
        requestAnimationFrame(() => { d.style.transition = v.style.transition = ''; d.style.opacity = 0; v.style.opacity = 0; });
        sfxTone(180, 0.14, 0.25, 'sawtooth', 70);
        if (navigator.vibrate) try { navigator.vibrate(30); } catch {}
      }
      break;
    case 'kill': {
      const a = roster.find((p) => p.id === m.by), b = roster.find((p) => p.id === m.to);
      if (a && b) feed(a, b, m.w, m.head);
      if (m.to === myId) {
        me.alive = false; me.drop = false; car.id = 0; setScope(false); openShop(false); respawnAt = performance.now() + 3000; healEnd = 0;
        if (mode !== 'tdm') setTimeout(() => $('dead').classList.add('hide'), mode === 'br' ? 2600 : 1600);
        $('deadBy').textContent = m.w === ZONE_WEAPON ? '안전 구역 밖에서 쓰러졌습니다' : a && a.id !== myId ? `${a.name} 에게 당했습니다` : '';
        $('dead').firstElementChild.textContent = mode === 'br' ? '탈락했습니다' : '처치당했습니다';
        $('dead').classList.remove('hide');
      }
      if (m.by === myId && b && m.to !== myId) {
        const nowT = performance.now();
        multiKill = nowT - lastKillAt < 4500 ? multiKill + 1 : 1; lastKillAt = nowT;
        const streak = ['', '', '더블 킬! ', '트리플 킬! ', '쿼드라 킬! '][multiKill] ?? '대활약! ';
        const vo = others.get(m.to), kd = vo ? Math.round(Math.hypot(vo.x - me.x, vo.z - me.z)) : 0;
        banner(`${streak}${b.name} 처치${m.head ? ' · 헤드샷!' : ''}${mode === 'bomb' ? ` · +${ECON.kill}` : ''}${mode === 'br' && kd > 3 ? ` · ${kd}m` : ''}`, multiKill > 1 ? 0xff8a3d : 0xffd23f);
        sfxTone(660, 0.18, 0.2, 'triangle', 1320); if (multiKill > 1) setTimeout(() => sfxTone(880, 0.2, 0.2, 'triangle', 1760), 120);
      }
      break;
    }
    case 'fx': {
      const [v, pan] = heard(m.x, m.z, 70);
      if (m.k === 0) {
        addBoom(m.x, m.y, m.z); sfxBoom(v * 0.9, 1.1, pan);
        me.shake = Math.max(me.shake, clamp(1 - Math.hypot(m.x - me.x, m.z - me.z) / 16, 0, 1));
      } else if (m.k === 1) { addSmoke(m.x, m.y, m.z, NADES[1].radius, NADES[1].last); sfxBoom(v * 0.25, 0.7, pan); }
      else {
        addBoom(m.x, m.y, m.z); booms[booms.length - 1].white = true; sfxTone(2400, 0.5, v * 0.25, 'sine', 1800);
        if (me.alive) {
          const dx = m.x - eye[0], dy = m.y + 0.3 - eye[1], dz = m.z - eye[2], len = Math.hypot(dx, dy, dz);
          if (len < NADES[2].radius && (len < 0.6 || rayWorld(eye, [dx / len, dy / len, dz / len], len) >= len - 0.05)) {
            const f = dirFrom(me.yaw, me.pitch), facing = (f[0] * dx + f[1] * dy + f[2] * dz) / (len || 1);
            me.flashDur = (facing > 0.3 ? 2800 : facing > -0.2 ? 1400 : 500) * clamp(1.15 - len / 40, 0.4, 1);
            me.flashUntil = performance.now() + me.flashDur;
          }
        }
      }
      break;
    }
    case 'end': {
      matchEnded = true; setScope(false); openShop(false);
      const mvp = [...roster].sort((a, b) => b.k - a.k || a.d - b.d)[0];
      if (mode === 'br') { // 생존전: 마지막 생존자
        const w = roster.find((p) => p.id === m.winner), mine = m.winner === myId;
        brWinner = m.winner;
        $('boardTitle').textContent = mine ? '1위! 최후의 생존자' : w ? `최후의 생존자: ${w.name}` : '경기 종료';
        $('boardTitle').style.color = mine ? '#ffd23f' : '';
        $('boardSub').textContent = (mine || !myRank ? '' : `내 순위 ${myRank}위 · `) + (mvp && mvp.k ? `최다 처치 ${mvp.name} (${mvp.k}킬) · ` : '') + '다음 경기가 곧 시작됩니다';
        if (mine) { sfxTone(660, 0.25, 0.2, 'triangle', 990); setTimeout(() => sfxTone(990, 0.4, 0.2, 'triangle', 1320), 220); }
        $('dead').classList.add('hide');
        drawBoard(); $('board').classList.remove('hide');
        break;
      }
      $('boardTitle').textContent = m.winner < 0 ? '경기 종료' : `${TEAM_NAME[m.winner]} 승리!`;
      $('boardTitle').style.color = m.winner < 0 ? '' : TEAM_CSS[m.winner];
      $('boardSub').textContent = (m.winner < 0 ? '' : m.winner === myTeam ? '승리했습니다 · ' : '패배했습니다 · ') + (mvp && mvp.k ? `MVP ${mvp.name} (${mvp.k}킬) · ` : '') + '다음 경기가 곧 시작됩니다';
      $('dead').classList.add('hide');
      drawBoard(); $('board').classList.remove('hide');
      break;
    }
    case 'round':
      if (m.ev === 'start') {
        attack = m.attack; roundNo = m.n; applySides(); $('board').classList.add('hide');
        for (const s of smokes) scene.remove(s.g);
        smokes.length = 0;
        const att = myTeam === attack;
        banner(`${m.swap ? '공수 교대 · ' : ''}라운드 ${m.n} · ${att ? '공격: 폭탄을 설치하세요' : '수비: 설치를 막으세요'}`, TEAM_COL[myTeam]);
        if (m.carrier === myId) setTimeout(() => banner('폭탄을 가지고 있습니다 · A 또는 B 지점으로', 0xffd23f), 1900);
        sfxTone(520, 0.12, 0.12, 'triangle', 780);
        setTimeout(() => { if (me.alive && phase === 'freeze') openShop(true); }, 300);
      } else {
        score = m.sc;
        const why = { elim: '전멸', time: '시간 종료', boom: '폭탄 폭발', defuse: '폭탄 해체' }[m.why] || '';
        banner(`${TEAM_NAME[m.win]} 라운드 승리 · ${why}`, TEAM_COL[m.win]);
        if (m.why === 'boom') { sfxBoom(); addBoom(bomb.x, 0.5, bomb.z); booms[booms.length - 1].big = true; me.shake = 1; }
        else sfxTone(m.win === myTeam ? 660 : 300, 0.3, 0.18, 'triangle', m.win === myTeam ? 990 : 200);
      }
      break;
    case 'bomb':
      if (m.ev === 'planted') { banner(`폭탄 설치됨 · ${SITES[m.site] ? SITES[m.site].name : ''} 지점`, 0xff8a3d); sfxTone(880, 0.25, 0.2, 'square'); }
      else if (m.ev === 'drop') banner('폭탄이 떨어졌습니다', 0xffd23f);
      else if (m.ev === 'pickup' && m.id === myId) banner('폭탄을 주웠습니다', 0xffd23f);
      else if (m.ev === 'defused') sfxTone(440, 0.4, 0.2, 'sine', 880);
      break;
    case 'map': loadMap(m.map); banner(`맵: ${MAPS[curMap].name}`, 0xffffff); break;
    case 'note': banner(m.text, 0xffffff); break;
    case 'pickup': {
      const nm = m.k === undefined || m.k === 0 ? WEAPONS[m.k === undefined ? m.w : m.v].name : m.k === 1 ? `방탄복 (${m.v})` : m.k === 2 ? NADES[m.v].name : '치료 키트';
      banner(`${nm} 획득`, 0xffd23f); sfxTone(520, 0.08, 0.12, 'square', 780);
      break;
    }
    case 'br': // 생존전 진행 알림
      if (m.mood !== undefined && m.mood !== world.mood) setMood(m.mood);
      if (m.ev === 'wait') { phase = 'wait'; me.alive = false; me.drop = false; car.id = 0; zone.on = false; matchEnded = false; $('board').classList.add('hide'); $('dead').classList.add('hide'); }
      else if (m.ev === 'air') { banner('보급 상자가 떨어집니다 · 지도의 주황 표시', 0xff8a3d); sfxTone(520, 0.5, 0.12, 'sawtooth', 300); }
      else if (m.ev === 'airland') { const [v] = heard(m.x, m.z, 400); if (v > 0) sfxBoom(v * 0.3, 0.6, 0); }
      else if (m.ev === 'start') { phase = 'live'; brTotal = m.n; matchEnded = false; banner(`생존전 시작 · ${m.n}명 · ${MOODS[world.mood].name}`, 0xffd23f); $('board').classList.add('hide'); for (const sm of smokes) scene.remove(sm.g); smokes.length = 0; sfxTone(520, 0.12, 0.12, 'triangle', 780); }
      else if (m.ev === 'shrink') { banner('안전 구역이 줄어듭니다!', 0x6ab8ff); sfxTone(700, 0.3, 0.14, 'sine', 500); }
      else if (m.ev === 'zone') { banner('다음 안전 구역이 표시되었습니다', 0xffffff); sfxTone(900, 0.1, 0.1, 'sine', 1100); }
      else if (m.ev === 'late') { phase = 'live'; banner('진행 중인 경기입니다 · 다음 경기부터 참가', 0xffffff); }
      break;
    case 'loot':
      if (m.all) { clearLoot(); for (const l of m.all) loot.set(l[0], { k: l[1], v: l[2], x: l[3], y: l[4], z: l[5], mesh: null }); }
      if (m.add) for (const l of m.add) loot.set(l[0], { k: l[1], v: l[2], x: l[3], y: l[4], z: l[5], mesh: null });
      if (m.rm) for (const id of m.rm) { const it = loot.get(id); if (it) { if (it.mesh) scene.remove(it.mesh); loot.delete(id); } }
      break;
    case 'veh': // 차에 탔거나(id) 내렸음(0)
      if (m.id) { car.id = m.id; car.at = performance.now(); car.yaw = m.yaw; car.sp = 0; me.x = m.x; me.z = m.z; me.y = groundAt(me.x, me.z); me.yaw = m.yaw; me.pitch = -0.25; setScope(false); if (me.crouch) toggleCrouch(); sfxTone(110, 0.25, 0.14, 'sawtooth', 160); }
      else if (car.id) leaveCar();
      break;
    case 'rank':
      myRank = m.n; brTotal = m.of;
      $('deadBy').textContent = `${m.of}명 중 ${m.n}위 · ` + $('deadBy').textContent;
      break;
    case 'heal':
      if (m.on) { healDur = m.ms; healEnd = performance.now() + m.ms; setScope(false); sfxTone(440, 0.12, 0.1, 'sine', 520); }
      else { healEnd = 0; if (m.done) { banner('치료 완료', 0x4ade80); sfxTone(660, 0.16, 0.12, 'sine', 990); } }
      break;
    case 'radio': {
      const p = roster.find((r) => r.id === m.id);
      if (!p) break;
      const d = document.createElement('div'); d.className = 'radio';
      const sn = document.createElement('span'); sn.className = clsOf(p); sn.textContent = p.name;
      d.append('무전 ', sn, ': ' + RADIO[m.k]);
      const f = $('feed'); f.append(d); while (f.children.length > 4) f.firstChild.remove();
      setTimeout(() => d.remove(), 4500);
      const o = others.get(m.id); if (o) o.pingAt = performance.now();
      sfxTone(980, 0.06, 0.1, 'sine', 1240);
      break;
    }
    case 'start': matchEnded = false; $('board').classList.add('hide'); banner('경기 시작!', 0xffffff); break;
    case 'pong': ping = Math.round(performance.now() - m.c); $('pingTxt').textContent = ping + 'ms'; break;
  }
}
setInterval(() => send({ t: 'ping', c: performance.now() }), 2000);

// ───────────── HUD ─────────────
function banner(text, col) {
  const b = $('banner');
  b.textContent = text; b.style.color = '#' + col.toString(16).padStart(6, '0'); b.style.opacity = 1;
  clearTimeout(b._t); b._t = setTimeout(() => { b.style.opacity = 0; }, 1600);
}
function feed(a, b, wi, head) {
  const d = document.createElement('div');
  const sa = document.createElement('span'), sb = document.createElement('span');
  sa.className = clsOf(a); sa.textContent = a.name;
  sb.className = clsOf(b); sb.textContent = b.name;
  if (wi === ZONE_WEAPON) d.append(sb, ' ▸ 구역 밖에서 탈락');
  else d.append(sa, ` ▸ ${wi === NADE_WEAPON ? '수류탄' : wi === VEH_WEAPON ? '차량' : WEAPONS[wi] ? WEAPONS[wi].name : '?'}${head ? ' ◎' : ''} ▸ `, sb);
  const f = $('feed');
  f.append(d);
  while (f.children.length > 4) f.firstChild.remove();
  setTimeout(() => d.remove(), 5000);
}
function drawBoard() {
  const cols = $('cols');
  cols.textContent = '';
  if (mode === 'br') { // 생존전: 한 줄 순위표 + 전체 지도
    const tb = document.createElement('table'), hr = tb.insertRow();
    for (const s of [matchEnded ? `참가 ${score[1]}명` : `생존 ${score[0]} / ${score[1]}`, '킬', '상태']) { const th = document.createElement('th'); th.textContent = s; hr.append(th); }
    const live = (p) => (matchEnded ? p.id === brWinner : p.id === myId ? me.alive : !!(others.get(p.id) && others.get(p.id).alive));
    for (const p of [...roster].sort((a, b) => live(b) - live(a) || b.k - a.k).slice(0, 12)) {
      const r = tb.insertRow();
      if (p.id === myId) r.className = 'me';
      r.insertCell().textContent = p.name; r.insertCell().textContent = p.k; r.insertCell().textContent = live(p) ? '생존' : '탈락';
      if (!live(p) && p.id !== myId) r.style.opacity = 0.5;
    }
    cols.append(tb);
    drawBigMap();
    return;
  }
  for (const t of [0, 1]) {
    const tb = document.createElement('table');
    const hr = tb.insertRow();
    for (const [i, s] of [`${TEAM_NAME[t]}  ${score[t]}`, '킬', '데스'].entries()) { const th = document.createElement('th'); th.textContent = s; if (!i) th.className = TEAM_CLS[t]; hr.append(th); }
    for (const p of roster.filter((p) => p.team === t).sort((a, b) => b.k - a.k || a.d - b.d)) {
      const r = tb.insertRow();
      if (p.id === myId) r.className = 'me';
      r.insertCell().textContent = p.name; r.insertCell().textContent = p.k; r.insertCell().textContent = p.d;
    }
    cols.append(tb);
  }
}
// 상점
function buildShop() {
  const bombMode = mode === 'bomb';
  const mk = (k, name, price) => { const d = document.createElement('div'); d.className = 'item'; d.dataset.btn = 'buy:' + k; d.dataset.price = price; d.append(name); const sm = document.createElement('small'); sm.textContent = bombMode && price ? price : '무료'; d.append(sm); return d; };
  const rows = $('shopRows');
  rows.textContent = '';
  const row = (label, items) => { const r = document.createElement('div'); r.className = 'srow'; const l = document.createElement('span'); l.className = 'lbl'; l.textContent = label; const it = document.createElement('div'); it.className = 'items'; it.append(...items); r.append(l, it); rows.append(r); };
  for (const [label, cats] of [['보조무기', ['side']], ['기관단총\n샷건', ['smg', 'sg']], ['소총', ['ar']], ['저격총\n기관총', ['sr', 'mg']]]) {
    row(label, WEAPONS.map((W, i) => (cats.includes(W.cat) ? mk('w' + i, W.name, W.price) : null)).filter(Boolean));
  }
  if (bombMode) row('장비', [mk('armor', '방탄복', ECON.armor), ...NADES.map((n, i) => mk('n' + i, n.name, n.price))]);
  $('shopNote').textContent = bombMode ? '준비 시간에만 살 수 있어요 · 죽으면 장비를 잃습니다' : '데스매치에서는 무기를 무료로 고릅니다';
  refreshInv();
}
function refreshInv() {
  $('money').textContent = mode === 'bomb' && joined ? `${inv.money}원` : '';
  $('shopMoney').textContent = mode === 'bomb' ? `${inv.money}원` : '';
  $('slot0').textContent = inv.prim ? WEAPONS[inv.prim].name : '주무기 없음';
  $('slot1').textContent = WEAPONS[inv.side].name;
  $('slot0').classList.toggle('on', me.w === inv.prim && inv.prim > 0); $('slot1').classList.toggle('on', me.w === inv.side); $('slot2').classList.toggle('on', me.w === W_KNIFE);
  inv.n.forEach((c, i) => { $('nd' + i).classList.toggle('none', !c); if (mode === 'br') $('nd' + i).textContent = ['수류탄', '연막', '섬광'][i] + (c > 1 ? ' ' + c : ''); });
  $('slotMed').textContent = `치료 ${inv.med}`; $('slotMed').classList.toggle('none', !inv.med); $('bHeal').textContent = `치료 ${inv.med}`; $('bHeal').classList.toggle('none', !inv.med);
  $('arTxt').textContent = inv.armor > 0 ? `방탄 ${inv.armor}` : '';
  for (const el of document.querySelectorAll('#shop .item')) {
    const k = el.dataset.btn.slice(4);
    const own = k[0] === 'w' ? (inv.prim === +k.slice(1) || inv.side === +k.slice(1)) : k === 'armor' ? inv.armor >= 100 : inv.n[+k[1]] > 0;
    el.classList.toggle('own', own);
    el.classList.toggle('no', !own && mode === 'bomb' && inv.money < +el.dataset.price);
  }
}
function openShop(on) {
  if (on && (matchEnded || !joined || mode === 'br')) return;
  shopOpen = on;
  $('shop').classList.toggle('hide', !on);
  if (on) { refreshInv(); input.fire = false; if (document.pointerLockElement) document.exitPointerLock(); }
}
// 미니맵 — 경기장 맵은 전체, 섬은 내 둘레만 보여 준다 (전체 지도는 점수판에)
const mini = $('mini'), mg = mini.getContext('2d');
let MS = 1, MOX = 0, MOZ = 0; // 배율(px/m)과 여백
const miniBase = document.createElement('canvas');
function buildMiniBase() {
  const isle = !!MAPS[curMap].br;
  if (isle) { miniBase.width = miniBase.height = 2048; MS = 2048 / (ARENA.hx * 2); MOX = MOZ = 0; }
  else { miniBase.width = 300; miniBase.height = 216; MS = Math.min(300 / (ARENA.hx * 2), 216 / (ARENA.hz * 2)); MOX = (300 - ARENA.hx * 2 * MS) / 2; MOZ = (216 - ARENA.hz * 2 * MS) / 2; }
  const g = miniBase.getContext('2d'), W = miniBase.width, H = miniBase.height;
  const X = (x) => MOX + (x + ARENA.hx) * MS, Z = (z) => MOZ + (ARENA.hz - z) * MS;
  g.clearRect(0, 0, W, H);
  if (isle && world.splat) g.drawImage(world.splat, 0, 0, W, H);
  else { g.fillStyle = 'rgba(40,46,56,.92)'; g.fillRect(0, 0, W, H); }
  for (const s of SITES) { g.fillStyle = 'rgba(255,170,50,.28)'; g.fillRect(X(s.x - s.r), Z(s.z + s.r), s.r * 2 * MS, s.r * 2 * MS); }
  for (const b of BOXES) {
    if (b.m === 'wall' || b.m === 'sandWall' || b.m === 'trunk' || b.m === 'rock' || b.m.startsWith('floor')) continue;
    const gy = groundAt((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2);
    if (b.min[1] > gy + 1.8 && !(isle && b.m.startsWith('roof'))) continue;
    if (isle) { if (b.max[1] < gy + 1.4 && b.m !== 'wood') continue; g.fillStyle = b.m === 'wood' ? '#8a6a45' : 'rgba(58,52,48,.9)'; }
    else { if (b.max[1] < gy + 0.3) continue; g.fillStyle = b.max[1] > gy + 1.6 ? '#9aa5b5' : '#677181'; }
    g.fillRect(X(b.min[0]), Z(b.max[2]), Math.max(1, (b.max[0] - b.min[0]) * MS), Math.max(1, (b.max[2] - b.min[2]) * MS));
  }
  g.fillStyle = '#ffc24a'; g.font = '900 22px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const s of SITES) g.fillText(s.name, X(s.x), Z(s.z) + 1);
}
buildMiniBase();
function setMood(i) { // 날씨·시간대가 바뀌면 섬을 다시 그림
  worldOpt.mood = i;
  if (!MAPS[curMap].br) return;
  world.dispose(); world = buildWorld(scene, renderer, worldOpt);
  camera.far = world.far; camera.updateProjectionMatrix(); buildMiniBase(); applySides();
}
function leaveCar() { // 차 왼쪽으로 내림 (막혀 있으면 오른쪽, 그것도 막혔으면 제자리)
  const rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw);
  for (const s of [-1.9, 1.9]) { const x = me.x + rx * s, z = me.z + rz * s; if (!collides(x, groundAt(x, z) + 0.05, z)) { me.x = x; me.z = z; break; } }
  me.y = groundAt(me.x, me.z); car.id = 0; car.sp = 0; me.pitch = 0;
}
function hitBurst(x, y, z) {
  for (let i = 0; i < 3; i++) { const sp = sparks[sparkIdx = (sparkIdx + 1) % sparks.length]; sp.s.position.set(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.3); sp.s.scale.setScalar(0.22 + Math.random() * 0.2); sp.s.material.color.setHex(0xffd890); sp.s.visible = true; sp.life = 0.12; }
}
function clearLoot() { for (const it of loot.values()) if (it.mesh) scene.remove(it.mesh); loot.clear(); nearLoot = null; }
function loadMap(i) { // 다른 맵으로 바꾸기
  if (MAPS[i] && MAPS.indexOf(MAPS[i]) === curMap) return;
  curMap = MAPS[i] ? i : 0;
  setMap(curMap);
  world.dispose();
  world = buildWorld(scene, renderer, worldOpt);
  camera.far = world.far; camera.updateProjectionMatrix();
  buildSites(); buildMiniBase(); applySides();
  for (const h of holes) h.visible = false;
  for (const sm of smokes) scene.remove(sm.g);
  smokes.length = 0;
}
function zoneArc(g, X, Z, k) { // 안전 구역: 지금(흰 선)과 다음(점선)
  if (!zone.on) return;
  g.lineWidth = 2; g.strokeStyle = 'rgba(120,190,255,.95)'; g.fillStyle = 'rgba(40,110,255,.16)';
  g.beginPath(); g.rect(-4000, -4000, 8000, 8000); g.arc(X(zone.cx), Z(zone.cz), Math.max(0.5, zone.r * k), 0, Math.PI * 2, true); g.fill('evenodd');
  g.beginPath(); g.arc(X(zone.cx), Z(zone.cz), Math.max(0.5, zone.r * k), 0, 7); g.stroke();
  if (zone.nr < zone.r - 0.5) { g.setLineDash([5, 4]); g.strokeStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(X(zone.nx), Z(zone.nz), Math.max(0.5, zone.nr * k), 0, 7); g.stroke(); g.setLineDash([]); }
}
function meArrow(g, x, y, s) {
  const fx = -Math.sin(me.yaw), fz = Math.cos(me.yaw);
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x + fx * 10 * s, y + fz * 10 * s); g.lineTo(x - (fx * 5 + fz * 6) * s, y - (fz * 5 - fx * 6) * s); g.lineTo(x - (fx * 5 - fz * 6) * s, y - (fz * 5 + fx * 6) * s); g.closePath(); g.fill(); g.stroke();
}
let lastMini = 0;
function drawMini(now) {
  if (mode === 'br') { // 내 둘레 90m
    const R = 90, k = mini.width / (R * 2), cx = camera.position.x, cz = camera.position.z;
    mg.fillStyle = '#1f5f8a'; mg.fillRect(0, 0, mini.width, mini.height);
    mg.drawImage(miniBase, (cx - R + ARENA.hx) * MS, (ARENA.hz - cz - R) * MS, R * 2 * MS, R * 2 * MS, 0, 0, mini.width, mini.height);
    const X = (x) => (x - cx + R) * k, Z = (z) => (cz - z + R) * k;
    zoneArc(mg, X, Z, k);
    if (zone.on && me.alive) { // 다음 구역 중심 방향 선
      const d = Math.hypot(zone.nx - me.x, zone.nz - me.z);
      if (d > zone.nr) { mg.strokeStyle = 'rgba(255,255,255,.7)'; mg.lineWidth = 1.5; mg.setLineDash([3, 5]); mg.beginPath(); mg.moveTo(X(me.x), Z(me.z)); mg.lineTo(X(zone.nx), Z(zone.nz)); mg.stroke(); mg.setLineDash([]); }
    }
    mg.fillStyle = '#fff'; for (const v of vehs.values()) { if (v.driver || Math.abs(v.x - cx) > R || Math.abs(v.z - cz) > R) continue; mg.fillRect(X(v.x) - 4, Z(v.z) - 2.5, 8, 5); mg.strokeStyle = '#000'; mg.lineWidth = 1; mg.strokeRect(X(v.x) - 4, Z(v.z) - 2.5, 8, 5); }
    if (airdrop) { const ax = clamp(X(airdrop[0]), 8, mini.width - 8), az = clamp(Z(airdrop[2]), 8, mini.height - 8); mg.fillStyle = '#ff8a3d'; mg.beginPath(); mg.moveTo(ax, az - 8); mg.lineTo(ax + 7, az); mg.lineTo(ax, az + 8); mg.lineTo(ax - 7, az); mg.fill(); }
    for (const it of loot.values()) { if (Math.abs(it.x - cx) > R || Math.abs(it.z - cz) > R) continue; mg.fillStyle = it.k === 0 ? '#ffd23f' : it.k === 1 ? '#7fc0ff' : it.k === 3 ? '#4ade80' : '#d0d6dd'; mg.fillRect(X(it.x) - 2, Z(it.z) - 2, 4, 4); }
    for (const o of others.values()) {
      if (!o.alive || !o.buf.length || now - o.shotAt > 1300) continue;
      mg.globalAlpha = 1 - (now - o.shotAt) / 1300; mg.fillStyle = '#ff3b30'; mg.beginPath(); mg.arc(X(o.x), Z(o.z), 5, 0, 7); mg.fill(); mg.globalAlpha = 1;
    }
    if (me.alive) meArrow(mg, X(me.x), Z(me.z), 1);
    return;
  }
  mg.clearRect(0, 0, mini.width, mini.height);
  mg.drawImage(miniBase, 0, 0);
  const px = (x) => MOX + (x + ARENA.hx) * MS, pz = (z) => MOZ + (ARENA.hz - z) * MS;
  if (mode === 'bomb' && (bomb.st === 'dropped' || bomb.st === 'planted') && (now % 600 < 400)) { mg.fillStyle = '#ff3b30'; mg.fillRect(px(bomb.x) - 5, pz(bomb.z) - 5, 10, 10); }
  mg.fillStyle = '#ffd23f'; for (const g of dropMeshes.values()) mg.fillRect(px(g.userData.xz[0]) - 3, pz(g.userData.xz[1]) - 3, 6, 6);
  for (const o of others.values()) {
    if (!o.alive || !o.buf.length) continue;
    if (o.pingAt && now - o.pingAt < 2500) { mg.strokeStyle = '#ffd23f'; mg.lineWidth = 2; mg.beginPath(); mg.arc(px(o.x), pz(o.z), 6 + ((now - o.pingAt) % 800) / 60, 0, 7); mg.stroke(); }
    if (o.team === myTeam) { mg.fillStyle = TEAM_CSS[o.team]; mg.beginPath(); mg.arc(px(o.x), pz(o.z), 4.5, 0, 7); mg.fill(); if (bomb.carrier && roster.length && bomb.st === 'carried' && myTeam === attack && o === others.get(bomb.carrier)) { mg.strokeStyle = '#ffd23f'; mg.lineWidth = 2; mg.stroke(); } }
    else if (now - o.shotAt < 1300) { mg.globalAlpha = 1 - (now - o.shotAt) / 1300; mg.fillStyle = '#ff3b30'; mg.beginPath(); mg.arc(px(o.x), pz(o.z), 4.5, 0, 7); mg.fill(); mg.globalAlpha = 1; }
  }
  if (me.alive) meArrow(mg, px(me.x), pz(me.z), 0.85);
}
const cmp = $('compass'), cg = cmp.getContext('2d');
const CDIR = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
let lastCmp = 0;
function drawCompass() { // 화면 위 방위 띠: 방위, 다음 안전 구역(파란 표시), 보급 상자(주황 표시)
  const now = performance.now();
  if (now - lastCmp < 60) return;
  lastCmp = now;
  const W = cmp.width, H = cmp.height, yaw = camera.rotation.y, head = Math.atan2(-Math.sin(yaw), -Math.cos(yaw)) * 180 / Math.PI; // 북쪽에서 시계 방향
  const X = (deg) => { let d = ((deg - head + 540) % 360) - 180; return W / 2 + d * (W / 150); };
  cg.clearRect(0, 0, W, H);
  cg.textAlign = 'center'; cg.textBaseline = 'middle';
  for (let a = 0; a < 360; a += 15) {
    const x = X(a); if (x < 6 || x > W - 6) continue;
    if (a % 45 === 0) { cg.fillStyle = a % 90 === 0 ? '#fff' : 'rgba(255,255,255,.75)'; cg.font = `${a % 90 === 0 ? 900 : 700} ${a % 90 === 0 ? 22 : 17}px system-ui, sans-serif`; cg.fillText(CDIR[a / 45], x, H / 2 + 1); }
    else { cg.fillStyle = 'rgba(255,255,255,.5)'; cg.fillRect(x - 1, H / 2 - 6, 2, 12); }
  }
  const mark = (tx, tz, col) => { const x = clamp(X(Math.atan2(tx - camera.position.x, tz - camera.position.z) * 180 / Math.PI), 8, W - 8); cg.fillStyle = col; cg.beginPath(); cg.moveTo(x - 8, 0); cg.lineTo(x + 8, 0); cg.lineTo(x, 12); cg.fill(); };
  if (zone.on && zone.nr < zone.r - 0.5) mark(zone.nx, zone.nz, '#6ab8ff');
  if (airdrop) mark(airdrop[0], airdrop[2], '#ff8a3d');
  cg.fillStyle = '#ffd23f'; cg.fillRect(W / 2 - 1.5, H - 9, 3, 9);
}
function drawBigMap() { // 생존전 전체 지도 (점수판)
  const cv = $('bigMap'), g = cv.getContext('2d'), k = cv.width / (ARENA.hx * 2);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(miniBase, 0, 0, cv.width, cv.height);
  const X = (x) => (x + ARENA.hx) * k, Z = (z) => (ARENA.hz - z) * k;
  zoneArc(g, X, Z, k);
  const names = MAPS[curMap].decor.find((d) => d.t === 'names');
  if (names) { g.font = '800 13px system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.fillStyle = '#fff'; for (const [t, x, z] of names.list) { g.strokeText(t, X(x), Z(z) - 12); g.fillText(t, X(x), Z(z) - 12); } }
  g.fillStyle = '#fff'; for (const v of vehs.values()) if (!v.driver) g.fillRect(X(v.x) - 2.5, Z(v.z) - 1.5, 5, 3);
  if (airdrop) { g.fillStyle = '#ff8a3d'; g.beginPath(); g.arc(X(airdrop[0]), Z(airdrop[2]), 6, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
  const p = me.alive ? me : camera.position;
  meArrow(g, X(p.x), Z(p.z), 1);
}
const hudCache = {};
let lastBeat = 0;
function setTxt(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHud(now) {
  if (mode === 'br') { const mine = roster.find((p) => p.id === myId); setTxt('sR', `생존 ${score[0]}`); setTxt('sB', `킬 ${mine ? mine.k : 0}`); }
  else { setTxt('sR', score[0]); setTxt('sB', score[1]); }
  const s = Math.ceil(timeLeft / 1000);
  setTxt('timer', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  setTxt('hpTxt', me.alive ? me.hp : 0);
  const hp = me.alive ? me.hp : 0;
  if (hudCache.hpW !== hp) { hudCache.hpW = hp; $('hpFill').style.width = hp + '%'; $('hpFill').style.background = hp > 50 ? '#4ade80' : hp > 25 ? '#ffd23f' : '#ff4d5a'; }
  const W = WEAPONS[me.w];
  const am = W.melee ? '근접' : me.reloadEnd ? '장전 중…' : `${me.ammo[me.w]} / ${W.mag}`;
  if (hudCache.ammo !== am) { hudCache.ammo = am; $('ammo').textContent = am; $('ammo').style.color = !W.melee && !me.reloadEnd && me.ammo[me.w] <= W.mag * 0.25 ? '#ff4d5a' : ''; }
  if (hudCache.prot !== me.prot) { hudCache.prot = me.prot; $('prot').classList.toggle('hide', !me.prot || !me.alive); }
  if (!me.alive && !matchEnded) setTxt('deadIn', mode === 'bomb' ? '다음 라운드에 다시 참가합니다' : mode === 'br' ? '다음 경기에 다시 참가합니다' : `${Math.max(0, Math.ceil((respawnAt - now) / 1000))}초 뒤 리스폰`);
  const crossOn = me.alive && !car.id;
  if (hudCache.crossA !== crossOn) { hudCache.crossA = crossOn; $('cross').style.opacity = crossOn ? 1 : 0; }
  const low = me.alive && me.hp > 0 && me.hp < 30;
  if (hudCache.low !== low) { hudCache.low = low; $('lowHp').classList.toggle('on', low); }
  if (low && now - lastBeat > 900) { lastBeat = now; sfxTone(58, 0.14, 0.22, 'sine', 40); setTimeout(() => sfxTone(50, 0.12, 0.16, 'sine', 36), 170); }
  const driving = !!car.id && me.alive;
  if (hudCache.drv !== driving) { hudCache.drv = driving; $('speedo').classList.toggle('hide', !driving); }
  if (driving) setTxt('speedo', `${Math.round(Math.abs(car.sp) * 3.6)} km/h`);
  let role = '';
  if (mode === 'bomb') {
    const att = myTeam === attack;
    role = `R${roundNo} · ${att ? '공격' : '수비'}`;
    if (phase === 'freeze') role += ` · 준비 ${Math.ceil(timeLeft / 1000)}`;
    else if (bomb.st === 'planted') role += ' · 폭탄 설치됨';
    else if (bomb.carrier === myId) role += ' · 폭탄 보유';
    else if (bomb.st === 'dropped' && att) role += ' · 폭탄 떨어짐';
  }
  let outside = false;
  if (mode === 'br') {
    if (phase === 'wait') role = `곧 시작 · ${Math.ceil(timeLeft / 1000)}초`;
    else if (zone.on) {
      outside = me.alive && !me.drop && Math.hypot(me.x - zone.cx, me.z - zone.cz) > zone.r;
      role = me.drop ? `낙하 중 · 고도 ${Math.max(0, Math.round(me.y - groundAt(me.x, me.z)))}m` : outside ? '구역 밖! 안쪽으로 이동하세요' : zone.shrinking ? `구역 축소 중 · ${Math.ceil(timeLeft / 1000)}초` : zone.nr < zone.r - 0.5 ? `축소까지 ${Math.ceil(timeLeft / 1000)}초` : '마지막 구역';
    }
  }
  if (hudCache.outside !== outside) { hudCache.outside = outside; $('zoneOv').style.opacity = outside ? 1 : 0; $('role').style.color = outside ? '#ff8a8a' : ''; }
  setTxt('role', role);
  const planted = mode === 'bomb' && phase === 'planted';
  if (hudCache.planted !== planted) { hudCache.planted = planted; $('timer').style.color = planted ? '#ff5a4d' : ''; }
  const can = canAct(), att = myTeam === attack;
  const healing = healEnd > now && me.alive;
  const showBar = healing || (mode === 'bomb' && bomb.actor && (phase === 'live' || phase === 'planted'));
  if (hudCache.bar !== showBar) { hudCache.bar = showBar; $('actWrap').classList.toggle('hide', !showBar); }
  if (healing) { setTxt('actLbl', '치료 중…'); $('actFill').style.width = Math.round((1 - (healEnd - now) / healDur) * 100) + '%'; }
  else if (showBar) { setTxt('actLbl', phase === 'live' ? '폭탄 설치 중…' : '폭탄 해체 중…'); $('actFill').style.width = Math.round(bomb.prog * 100) + '%'; }
  const hint = can && !showBar && !(car.id && now - car.at > 3500);
  if (hudCache.hint !== hint) { hudCache.hint = hint; $('actHint').classList.toggle('hide', !hint); }
  if (hint) setTxt('actHint', mode === 'br' ? (car.id ? (isTouch ? '' : '[E] 내리기') : nearLoot ? `${isTouch ? '[줍기]' : '[E]'} ${WEAPONS[nearLoot.v].name}(으)로 바꾸기` : `${isTouch ? '[탑승]' : '[E]'} 차에 타기`) : (isTouch ? '버튼을 길게 눌러 ' : '[E] 길게 눌러 ') + (att ? '폭탄 설치' : '폭탄 해체'));
  if (hudCache.can !== can) { hudCache.can = can; $('bAct').classList.toggle('hide', !can); }
  if (can) setTxt('bAct', mode === 'br' ? (car.id ? '내리기' : nearLoot ? '줍기' : '탑승') : att ? '설치' : '해체');
  const spec = mode !== 'tdm' && !me.alive && !matchEnded;
  if (hudCache.spec !== spec) { hudCache.spec = spec; $('spec').classList.toggle('hide', !spec); }
  if (shopOpen && mode === 'bomb' && phase !== 'freeze') openShop(false);
  const fl = me.flashUntil > now ? clamp((me.flashUntil - now) / Math.min(900, me.flashDur * 0.6), 0, 1) : 0;
  if (hudCache.fl !== fl) { hudCache.fl = fl; $('flashOv').style.opacity = fl; }
  if (now - lastMini > 110) { lastMini = now; drawMini(now); }
}
function setWeapon(wi, force) {
  if (!owned(wi) || (!force && (wi === me.w || !me.alive))) return;
  const changed = wi !== me.w;
  if (changed) me.lastW = me.w;
  me.w = wi; me.reloadEnd = 0; me.shotN = 0; me.burstLeft = 0; me.spin = 0; me.inspAt = -1e9; setScope(false);
  vmGun(wi);
  guns.forEach((g, i) => { if (g) g.visible = i === wi; });
  if (changed) { me.draw = 1; me.lastShot = Math.max(me.lastShot, performance.now() - WEAPONS[wi].interval + 350); sfxTone(520, 0.05, 0.08, 'square'); }
  refreshInv();
}
function inspect() { if (me.alive && !me.reloadEnd && !me.scoped && !car.id && performance.now() - me.inspAt > 2600) me.inspAt = performance.now(); }
function swapWeapon() { setWeapon(owned(me.lastW) && me.lastW !== me.w ? me.lastW : me.w === inv.side ? (inv.prim || W_KNIFE) : inv.side); }
function setScope(on) {
  on = on && me.alive && !me.reloadEnd && !matchEnded && !WEAPONS[me.w].melee; // 칼 빼고 모든 무기 정조준
  me.scoped = on;
  if (on) me.sprint = false;
  $('scopeOv').classList.toggle('hide', !(on && WEAPONS[me.w].scope)); $('cross').classList.toggle('hide', on);
  $('bScope').classList.toggle('on', on);
}
function toggleCrouch() {
  if (!me.alive) return;
  if (!me.crouch && me.sprint && me.onGround) { // 달리다 앉으면 슬라이딩
    const v = Math.hypot(me.vx, me.vz) || 1;
    me.slx = me.vx / v; me.slz = me.vz / v; me.slideT = 0.55;
  }
  me.crouch = !me.crouch; me.sprint = false;
  $('bCrouch').classList.toggle('on', me.crouch);
}
function startReload(now) {
  const W = WEAPONS[me.w];
  if (W.melee || me.reloadEnd || me.ammo[me.w] >= W.mag || !me.alive) return;
  setScope(false); me.burstLeft = 0; me.inspAt = -1e9;
  me.reloadEnd = now + W.reload;
  sfxTone(300, 0.08, 0.1, 'square', 200);
  const wAt = me.w; setTimeout(() => { if (me.reloadEnd && me.w === wAt) { sfxStep(0.12, 0); sfxTone(180, 0.05, 0.08, 'square', 140); } }, W.reload * 0.55); // 탄창 끼우는 소리
}
function throwNade(k) {
  if (!me.alive || !canFight() || acting || !(inv.n[k] > 0)) return;
  inv.n[k]--; refreshInv();
  send({ t: 'nade', k, d: dirFrom(me.yaw, clamp(me.pitch + 0.12, -1.4, 1.4)).map((v) => +v.toFixed(4)) });
  me.draw = 0.6; sfxTone(240, 0.12, 0.12, 'triangle', 420);
}
function sendRadio(k) { if (mode === 'br') return; send({ t: 'radio', k }); radioOpen = false; $('radio').classList.add('hide'); }
function useOrRide() { if (!me.alive || me.drop) return; if (car.id || (!nearLoot && nearVeh)) send({ t: 'veh' }); else send({ t: 'use' }); }
function useMed() { if (mode === 'br' && me.alive && !me.drop && inv.med > 0 && me.hp < 100 && healEnd < performance.now()) send({ t: 'heal' }); else if (mode === 'br' && me.alive && inv.med > 0 && me.hp >= 100) banner('체력이 가득합니다', 0xffffff); }
function setAuto(on) { if (!isTouch) on = false; else store.set('auto', on ? '1' : '0'); autoFire = on; $('autoChip').classList.toggle('on', on); $('autoFire').checked = on; }
setAuto(autoFire);

// 점수판(생존전은 지도·순위) 열고 닫기
function showBoard(on) {
  if (on && !matchEnded) {
    drawBoard();
    $('boardTitle').textContent = mode === 'br' ? '지도 · 순위' : '점수판'; $('boardTitle').style.color = '';
    $('boardSub').textContent = mode === 'br' ? '마지막까지 살아남으면 승리 · 흰 점선 = 다음 안전 구역' : mode === 'bomb' ? `${killLimit}라운드 선취 승리` : `${killLimit}킬 선취 승리`;
  }
  $('board').classList.toggle('hide', !on);
  if (on) { input.fire = false; if (document.pointerLockElement) document.exitPointerLock(); }
}
setInterval(() => { if (joined && !matchEnded && !$('board').classList.contains('hide')) drawBoard(); }, 1000);
const modalOpen = () => shopOpen || !$('leave').classList.contains('hide') || !$('board').classList.contains('hide'); // 창이 떠 있는 동안은 화면을 눌러도 쏘거나 돌지 않음
// 나가기: 물어보고 → 메뉴로
function askLeave(on) {
  $('leave').classList.toggle('hide', !on);
  if (on) { input.fire = false; openShop(false); radioOpen = false; $('radio').classList.add('hide'); if (document.pointerLockElement) document.exitPointerLock(); }
}
function leaveGame() {
  lastJoin = null;
  if (ws) { ws.onclose = null; try { ws.close(); } catch {} ws = null; }
  joined = false; matchEnded = false; me.alive = false; me.drop = false; zone.on = false; airdrop = null; radioOpen = false;
  setScope(false); openShop(false);
  for (const id of ['radio', 'board', 'leave', 'net', 'dead', 'hud']) $(id).classList.add('hide');
  for (const o of others.values()) scene.remove(o.g);
  others.clear(); clearLoot(); clearVehs();
  for (const ms of nadeMeshes.values()) scene.remove(ms); nadeMeshes.clear();
  for (const g of dropMeshes.values()) scene.remove(g); dropMeshes.clear();
  for (const sm of smokes) scene.remove(sm.g); smokes.length = 0;
  zoneWall.visible = false; myChute.visible = false; crate.visible = false; bombMesh.visible = false;
  input.fire = false; input.jump = false; input.act = false; input.sprint = false; input.jx = input.jy = 0; keys.clear(); touches.clear(); $('stick').classList.add('hide');
  engineSound(-1); setAmbient(false);
  if (document.pointerLockElement) document.exitPointerLock();
  document.body.classList.remove('playing', 'br', 'sqmini');
  $('menu').classList.remove('hide'); $('menuMsg').textContent = '게임에서 나왔어요.'; loadRooms();
  setMode(selMode);
}
// ───────────── 입력 ─────────────
function pressBtn(b, down, el) {
  if (el && el.classList.contains('pad')) el.classList.toggle('down', down);
  const now = performance.now();
  if (b === 'fire') input.fire = down && !shopOpen;
  else if (b === 'jump') input.jump = down;
  else if (b === 'act') { input.act = down; if (down && mode === 'br') useOrRide(); }
  else if (b === 'heal') { if (down) useMed(); }
  else if (b === 'crouch') { if (down) toggleCrouch(); }
  else if (b === 'reload') { if (down) startReload(now); }
  else if (b === 'scope') { if (down) setScope(!me.scoped); }
  else if (b === 'score') { if (down) showBoard($('board').classList.contains('hide')); }      // 버튼: 누를 때마다 열고 닫음
  else if (b === 'scoreHold') { if (!matchEnded) showBoard(down); }                               // Tab: 누르는 동안만
  else if (b === 'boardClose') { if (down) showBoard(false); }
  else if (b === 'leaveAsk') { if (down) askLeave(true); }
  else if (b === 'leaveNo') { if (down) askLeave(false); }
  else if (b === 'leaveYes') { if (!down) leaveGame(); }
  else if (b === 'auto') { if (down) setAuto(!autoFire); }
  else if (b === 'fs') { if (!down) goFullscreen(true); }
  else if (b === 'shop') { if (down) openShop(!shopOpen); }
  else if (b === 'shopClose') { if (down) openShop(false); }
  else if (b === 'team') { if (down) { send({ t: 'team' }); openShop(false); } }
  else if (b === 'radioOpen') { if (down) { radioOpen = !radioOpen; $('radio').classList.toggle('hide', !radioOpen); } }
  else if (b.startsWith('radio:')) { if (down) sendRadio(+b.slice(6)); }
  else if (b === 'slot0') { if (down && inv.prim) { if (me.w === inv.prim) inspect(); else setWeapon(inv.prim); } } // 든 무기를 다시 누르면 살펴보기
  else if (b === 'slot1') { if (down) { if (me.w === inv.side) inspect(); else setWeapon(inv.side); } }
  else if (b === 'slot2') { if (down) { if (me.w === W_KNIFE) inspect(); else setWeapon(W_KNIFE); } }
  else if (b.startsWith('nade')) { if (down) throwNade(+b[4]); }
  else if (b.startsWith('buy:')) { if (down) { send({ t: 'buy', k: b.slice(4) }); sfxTone(700, 0.05, 0.08, 'square', 900); } }
}
function goFullscreen(toggle) {
  try {
    if (document.fullscreenElement) { if (toggle) document.exitFullscreen(); return; }
    const el = document.documentElement;
    const p = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    if (p && p.then) p.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
  } catch {}
}
const touches = new Map();
const STICK_R = 52;
function look(dx, dy, base) {
  const k = base * sens * (me.scoped ? (WEAPONS[me.w].scope ? 0.3 : WEAPONS[me.w].zoom ? 0.45 : 0.6) : 1);
  me.yaw -= dx * k; me.pitch = clamp(me.pitch - dy * k, -1.45, 1.45);
  me.swx = clamp(me.swx + dx * k * 0.25, -0.07, 0.07); me.swy = clamp(me.swy + dy * k * 0.25, -0.05, 0.05);
}
document.addEventListener('touchstart', (e) => {
  if (!joined) return;
  e.preventDefault();
  initAudio();
  for (const t of e.changedTouches) {
    const el = t.target.closest ? t.target.closest('[data-btn]') : null;
    const rec = { role: 'look', sx: t.clientX, sy: t.clientY, lx: t.clientX, ly: t.clientY, el, btn: el ? el.dataset.btn : null };
    if (el) { pressBtn(rec.btn, true, el); rec.role = rec.btn === 'fire' ? 'look' : 'btn'; }
    else if (modalOpen()) rec.role = 'btn';
    else if (!me.alive) { specIdx++; rec.role = 'btn'; }
    else if (t.clientX < window.innerWidth * 0.42 && ![...touches.values()].some((r) => r.role === 'move')) {
      rec.role = 'move';
      const s = $('stick'); s.style.left = t.clientX + 'px'; s.style.top = t.clientY + 'px'; s.classList.remove('hide'); $('stickHint').classList.add('hide');
      $('knob').style.transform = '';
    }
    touches.set(t.identifier, rec);
  }
}, { passive: false });
document.addEventListener('touchmove', (e) => {
  if (!joined) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const r = touches.get(t.identifier);
    if (!r) continue;
    if (r.role === 'move') {
      let dx = t.clientX - r.sx, dy = t.clientY - r.sy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R * 1.5 && dy < 0 && Math.abs(dx) < -dy * 0.8) input.sprint = true; // 위로 끝까지 밀면 달리기 고정
      else if (dy > -STICK_R * 0.5) input.sprint = false;
      if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
      input.jx = dx / STICK_R; input.jy = dy / STICK_R;
      $('knob').style.transform = `translate(${dx}px,${dy}px)`;
    } else if (r.role === 'look') look(t.clientX - r.lx, t.clientY - r.ly, 0.0055);
    r.lx = t.clientX; r.ly = t.clientY;
  }
}, { passive: false });
function touchEnd(e) {
  for (const t of e.changedTouches) {
    const r = touches.get(t.identifier);
    if (!r) continue;
    touches.delete(t.identifier);
    if (r.btn) pressBtn(r.btn, false, r.el);
    if (r.role === 'move') { input.jx = input.jy = 0; input.sprint = false; $('stick').classList.add('hide'); }
  }
}
document.addEventListener('touchend', touchEnd);
document.addEventListener('touchcancel', touchEnd);
document.addEventListener('contextmenu', (e) => { if (joined) e.preventDefault(); });

// PC 조작
const canvas = $('c');
let lastTouchAt = 0;
document.addEventListener('touchstart', () => { lastTouchAt = Date.now(); }, { passive: true, capture: true });
const isTouchEvent = () => Date.now() - lastTouchAt < 800;
document.addEventListener('mousedown', (e) => {
  if (!joined || isTouchEvent()) return;
  const el = e.target.closest('[data-btn]');
  if (el) { pressBtn(el.dataset.btn, true, el); const up = () => { pressBtn(el.dataset.btn, false, el); removeEventListener('mouseup', up); }; addEventListener('mouseup', up); return; }
  if (modalOpen()) return;
  if (!me.alive && e.button === 0) specIdx++;
  if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); initAudio(); return; }
  if (e.button === 0) input.fire = true;
  if (e.button === 2) setScope(true);
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 2) setScope(false);
  if (e.button === 0 && document.pointerLockElement === canvas) input.fire = false;
});
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) look(e.movementX, e.movementY, 0.0023); });
document.addEventListener('keydown', (e) => {
  if (!joined) return;
  if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) pressBtn('scoreHold', true); return; }
  keys.add(e.code);
  if (e.repeat) return;
  const c = e.code;
  if (c === 'KeyR') startReload(performance.now());
  else if (c === 'KeyC') toggleCrouch();
  else if (c === 'KeyB') openShop(!shopOpen);
  else if (c === 'KeyQ') swapWeapon();
  else if (c === 'KeyT') inspect();
  else if (c === 'Digit1') { if (inv.prim) setWeapon(inv.prim); }
  else if (c === 'Digit2') setWeapon(inv.side);
  else if (c === 'Digit3') setWeapon(W_KNIFE);
  else if (c === 'Digit4' || c === 'KeyG') throwNade(0);
  else if (c === 'Digit5') throwNade(1);
  else if (c === 'Digit6') throwNade(2);
  else if (c === 'Escape') { if (!$('leave').classList.contains('hide')) askLeave(false); else if (shopOpen) openShop(false); else if (radioOpen) pressBtn('radioOpen', true); else if (!$('board').classList.contains('hide') && !matchEnded) showBoard(false); }
  else if (c === 'KeyP') askLeave($('leave').classList.contains('hide'));
  else if (c === 'KeyZ') sendRadio(0);
  else if (c === 'KeyX') sendRadio(1);
  else if (c === 'KeyV') sendRadio(2);
  else if (c === 'KeyH') { if (mode === 'br') useMed(); else sendRadio(3); }
  else if (c === 'KeyE') { if (mode === 'br') useOrRide(); }
  else if (c === 'Space' && !me.alive) specIdx++;
});
document.addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'Tab' && joined) pressBtn('scoreHold', false); });
window.addEventListener('blur', () => { keys.clear(); input.fire = false; });

// 메뉴
function join(room) {
  if (!store.get('paintSeen', '')) { pendingJoin = room; openPaint('이대로 시작'); return; } // 처음 시작할 때는 캐릭터부터 그림
  initAudio();
  if (isTouch) goFullscreen(false);
  const name = $('name').value.trim();
  store.set('name', name);
  closeLocker();
  lastJoin = { name, room, mode: selMode, map: $('mapSel').value, bot: +$('botLv').value, sk: mySk, codes: myCodes, paint: isPaint(store.get('paint', '')) ? store.get('paint', '') : '' };
  $('menuMsg').textContent = '접속 중…';
  if (ws) { ws.onclose = null; ws.close(); }
  connect();
}
function setMode(m) {
  selMode = m; store.set('mode', m);
  $('modeBomb').classList.toggle('on', m === 'bomb'); $('modeTdm').classList.toggle('on', m === 'tdm'); $('modeBr').classList.toggle('on', m === 'br');
  $('modeSub').textContent = m === 'bomb' ? '공격은 폭탄 설치, 수비는 해체 · 5라운드 선취 · 돈을 벌어 장비 구매' : m === 'br' ? '큰 섬에 낙하 → 아이템을 주워 싸우고 → 줄어드는 구역에서 마지막까지 생존' : '레드 vs 블루 · 30킬 선취 팀 데스매치 · 빈자리는 봇이 채워요';
  $('mapSel').disabled = m === 'br';
  if (!joined) loadMap(m === 'br' ? MAPS.findIndex((x) => x.br) : MAPS.findIndex((x) => x.key === $('mapSel').value) >= 0 ? MAPS.findIndex((x) => x.key === $('mapSel').value) : 0); // 메뉴 배경도 그 모드의 맵으로
}
$('modeBomb').onclick = () => setMode('bomb'); $('modeTdm').onclick = () => setMode('tdm'); $('modeBr').onclick = () => setMode('br');
$('mapSel').value = store.get('map', '');
setMode(selMode);
$('quick').onclick = () => join('');
// 캐릭터 그리기: 메뉴의 [캐릭터 그리기], 그리고 처음 시작할 때 한 번
let pendingJoin = null, pvAv = null;
const pvGroup = new THREE.Group(); pvGroup.visible = false; vmScene.add(pvGroup);
const paintEd = initPaintEditor($, () => store.get('paint', ''), (data) => {
  if (data) store.set('paint', data);
  store.set('paintSeen', '1'); pvGroup.visible = false;
  if (!joined) $('menu').classList.remove('hide');
  if (pendingJoin !== null) { const r = pendingJoin; pendingJoin = null; join(r); }
});
function openPaint(label) {
  if (joined) return;
  closeLocker();
  if (!pvAv) { pvAv = { ...buildBody(paintUI.tex, teamMat[1]), guns: [], w: -1, sk: mySk }; pvGroup.add(pvAv.body); holdGun(pvAv, 13); }
  $('menu').classList.add('hide'); paintEd.open(label);
}
$('openPaint').onclick = () => { pendingJoin = null; openPaint('완료'); };
$('ptX').onclick = () => { pendingJoin = null; paintEd.close(); };
document.addEventListener('keydown', (e) => { if (e.code === 'Escape' && paintUI.open) { pendingJoin = null; paintEd.close(); } });
// 방 목록: 메뉴가 떠 있는 동안 몇 초마다 새로 받아 온다. 누르면 그 방으로 들어감
const MODE_NAME = { bomb: '폭탄전', tdm: '데스매치', br: '생존전' };
let roomBusy = false;
async function loadRooms() {
  if (roomBusy || joined || document.hidden) return;
  roomBusy = true;
  try {
    const r = await fetch('./api/rooms', { cache: 'no-store' }), d = await r.json(), box = $('roomList');
    const list = Array.isArray(d.rooms) ? d.rooms : [];
    box.textContent = '';
    $('roomInfo').textContent = list.length ? `${list.length}개 · ${list.reduce((a, x) => a + x.n, 0)}명 접속 중` : '';
    if (!list.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = '열린 방이 없어요. 빠른 참가나 방 코드로 새 방을 만들어 보세요.'; box.appendChild(e); }
    for (const x of list) {
      const full = x.n >= x.max, b = document.createElement('button'); b.className = 'room' + (full ? ' full' : ''); b.type = 'button';
      const add = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = txt; b.appendChild(e); };
      add('i', '', MODE_NAME[x.mode] || x.mode); add('span', 'rc', x.pub ? '공개방' : String(x.code)); add('span', 'rm', String(x.map || '')); add('span', 'rn', `${x.n}/${x.max}`); add('em', '', full ? '가득 참' : '참가');
      if (!full) b.onclick = () => { $('code').value = x.pub ? '' : x.code; join(String(x.code)); };
      box.appendChild(b);
    }
  } catch { $('roomInfo').textContent = '목록을 불러오지 못했어요'; }
  roomBusy = false;
}
$('roomRef').onclick = loadRooms;
setInterval(loadRooms, 6000); document.addEventListener('visibilitychange', loadRooms); loadRooms();
$('joinCode').onclick = () => { const c = $('code').value.trim(); if (!c) { $('menuMsg').textContent = '방 코드를 입력해 주세요.'; return; } join(c); };
$('sens').oninput = (e) => { sens = parseFloat(e.target.value) || 1; store.set('sens', sens); };
$('autoFire').onchange = (e) => setAuto(e.target.checked);
$('vol').oninput = (e) => { volume = parseFloat(e.target.value); store.set('vol', volume); if (master) master.gain.value = volume; };
$('gfx').onchange = (e) => { store.set('gfx', e.target.value); location.reload(); };
$('mapSel').onchange = (e) => { store.set('map', e.target.value); setMode(selMode); };
$('botLv').value = store.get('bot', '1'); $('botLv').onchange = (e) => store.set('bot', e.target.value);
const setXhair = (c) => { document.documentElement.style.setProperty('--xh', c); store.set('xh', c); };
$('xhair').value = store.get('xh', '#ffffff'); setXhair($('xhair').value || '#ffffff'); $('xhair').onchange = (e) => setXhair(e.target.value);

// ───────────── 무기고: 스킨 미리 보기·장착·코드 등록 ─────────────
const SWATCH = { std: 'linear-gradient(90deg,#4a505a,#22252a)', desert: 'linear-gradient(90deg,#c9b083,#8d7a56)', forest: 'linear-gradient(90deg,#4c5a36,#2f3a24 40%,#7f8a5a)', carbon: 'repeating-linear-gradient(45deg,#16181c 0 4px,#4a4f58 4px 8px)', tiger: 'repeating-linear-gradient(100deg,#f6a12a 0 9px,#17110c 9px 14px)', sakura: 'linear-gradient(90deg,#ffd3e2,#f291b4)', ice: 'linear-gradient(120deg,#cdf3ff,#6fb7ea,#e8fbff)', neon: 'linear-gradient(90deg,#0b0e14,#19e3ff 45%,#ff3df0 55%,#0b0e14)', lava: 'linear-gradient(90deg,#17110f,#ff7a1a 50%,#17110f)', gold: 'linear-gradient(110deg,#a8780f,#ffe9a0 45%,#d8a93a)', galaxy: 'linear-gradient(110deg,#0a0822,#7a3cff 50%,#ff46be)', aurora: 'linear-gradient(90deg,#ff5a5a,#ffd23f,#5aff8a,#5ab8ff,#c08bff)' };
const TIERN = { 희귀: 1, 영웅: 2, 전설: 3, 한정: 4 };
const CATN = { melee: '근접', side: '보조', smg: '기관단총', sg: '샷건', ar: '소총', sr: '저격총', mg: '기관총' };
let lockerOpen = false, lkW = 13, lkSkin = 0, lkYaw = 0.7, lkDrag = null, lkGun = null, lkKey = '', lkSpin = true;
const lkGroup = new THREE.Group();
lkGroup.visible = false; vmScene.add(lkGroup);
function lkBuild() { // 가운데에 띄울 모델
  const key = lkW + ':' + lkSkin;
  if (key === lkKey) return;
  lkKey = key;
  if (lkGun) lkGroup.remove(lkGun);
  const info = makeGun(lkW, lkSkin), box3 = new THREE.Box3().setFromObject(info.group), c = box3.getCenter(new THREE.Vector3()), sz = box3.getSize(new THREE.Vector3());
  info.group.position.sub(c);
  lkGun = new THREE.Group(); lkGun.add(info.group); lkGun.userData.len = Math.max(sz.z, sz.y * 1.7, 0.3);
  lkGroup.add(lkGun);
}
function lkRefresh() {
  for (const b of $('lkLeft').querySelectorAll('button')) b.classList.toggle('on', +b.dataset.w === lkW);
  const k = SKINS[lkSkin];
  $('lkName').textContent = WEAPONS[lkW].name;
  $('lkSkin').textContent = `${k.name} · ${k.free ? '무료' : k.tier + ' · 형태 변경'}${unlocked.has(lkSkin) ? '' : ' · 잠김'}`; $('lkSkin').className = 't' + (TIERN[k.tier] || 0);
  for (const b of $('lkSkins').children) { const i = +b.dataset.s; b.classList.toggle('on', i === lkSkin); b.classList.toggle('eq', mySk[lkW] === i); b.classList.toggle('lock', !unlocked.has(i)); }
}
function saveSkins() { store.set('sk', JSON.stringify(mySk)); }
function openLocker() {
  if (joined) return;
  lockerOpen = true; lkSkin = mySk[lkW]; lkKey = '';
  $('menu').classList.add('hide'); $('locker').classList.remove('hide'); $('lkMsg').textContent = '';
  if ($('lkLeft').children.length < 3) {
    WEAPONS.forEach((W, i) => { const b = document.createElement('button'); b.dataset.w = i; b.textContent = W.name; const sm = document.createElement('small'); sm.textContent = CATN[W.cat] || ''; b.append(sm); b.onclick = () => { lkW = i; lkSkin = mySk[i]; lkRefresh(); }; $('lkLeft').append(b); });
    SKINS.forEach((k, i) => {
      const b = document.createElement('button'); b.className = 'sk'; b.dataset.s = i;
      const sw = document.createElement('i'); sw.style.background = SWATCH[k.id] || '#444';
      const nm = document.createElement('span'); nm.textContent = k.name;
      const tr = document.createElement('em'); tr.textContent = k.free ? '무료' : k.tier; tr.className = 't' + (TIERN[k.tier] || 0);
      b.append(sw, nm, tr);
      b.onclick = () => {
        lkSkin = i;
        if (unlocked.has(i)) { mySk[lkW] = i; saveSkins(); $('lkMsg').textContent = ''; }
        else $('lkMsg').textContent = '잠긴 스킨이에요. 코드를 등록하면 쓸 수 있어요.';
        lkRefresh();
      };
      $('lkSkins').append(b);
    });
  }
  lkRefresh();
}
function closeLocker() {
  if (!lockerOpen) return;
  lockerOpen = false; lkGroup.visible = false;
  $('locker').classList.add('hide'); if (!joined) $('menu').classList.remove('hide');
}
$('openLocker').onclick = openLocker; $('lkClose').onclick = closeLocker; $('lkX').onclick = closeLocker;
document.addEventListener('keydown', (e) => { if (e.code === 'Escape' && lockerOpen) closeLocker(); });
$('menuExit').onclick = () => { // 메뉴에서 나가기: 전체화면을 풀고 창 닫기를 시도 (브라우저가 막으면 안내)
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch {}
  try { window.close(); } catch {}
  setTimeout(() => { $('menuMsg').textContent = '전체화면을 껐어요. 브라우저 탭을 닫거나 홈 버튼을 누르면 게임이 꺼집니다.'; }, 150);
};
$('lkAll').onclick = () => {
  if (!unlocked.has(lkSkin)) { $('lkMsg').textContent = '잠긴 스킨은 적용할 수 없어요.'; return; }
  mySk = mySk.map(() => lkSkin); saveSkins(); lkRefresh(); $('lkMsg').textContent = `모든 무기에 '${SKINS[lkSkin].name}' 적용`;
};
async function redeem(codes, quiet) { // 서버에 코드를 확인받아 스킨을 연다
  try {
    const r = await fetch('/api/redeem?c=' + encodeURIComponent(codes.join(',')), { cache: 'no-store' }), j = await r.json();
    if (j.wait) { if (!quiet) $('lkMsg').textContent = '잠시 뒤에 다시 시도해 주세요.'; return; }
    const before = new Set(unlocked);
    for (const i of j.skins || []) if (SKINS[i]) unlocked.add(i);
    if (j.ok) { myCodes = [...new Set([...myCodes, ...j.codes])].slice(0, 24); store.set('codes', JSON.stringify(myCodes)); }
    if (quiet) { mySk = mySk.map((v) => (unlocked.has(v) ? v : 0)); return; } // 시작할 때: 더는 쓸 수 없는 스킨은 기본으로
    const got = (j.skins || []).filter((i) => !before.has(i)).map((i) => SKINS[i].name);
    $('lkMsg').textContent = !j.ok ? '없는 코드예요. 다시 확인해 주세요.' : got.length ? `해금: ${got.join(', ')}` : '이미 등록한 코드예요.';
    if (j.ok) { $('lkInput').value = ''; sfxTone(660, 0.12, 0.14, 'triangle', 990); }
    lkRefresh();
  } catch { if (!quiet) $('lkMsg').textContent = '서버에 연결하지 못했어요.'; }
}
$('lkRedeem').onclick = () => { const c = $('lkInput').value.trim(); if (c) { initAudio(); redeem([c], false); } };
$('lkInput').onkeydown = (e) => { if (e.key === 'Enter') $('lkRedeem').onclick(); };
if (myCodes.length) redeem(myCodes, true); else mySk = mySk.map((v) => (unlocked.has(v) ? v : 0));
$('lkMid').addEventListener('pointerdown', (e) => { lkDrag = e.clientX; lkSpin = false; $('lkMid').setPointerCapture(e.pointerId); });
$('lkMid').addEventListener('pointermove', (e) => { if (lkDrag === null) return; lkYaw += (e.clientX - lkDrag) * 0.012; lkDrag = e.clientX; });
for (const ev of ['pointerup', 'pointercancel']) $('lkMid').addEventListener(ev, () => { lkDrag = null; });

// ───────────── 게임 로직 ─────────────
function collides(x, y, z) {
  const r = PLAYER.r;
  for (const b of boxesNear(x, z, r)) {
    if (x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2] && y < b.max[1] - 0.001 && y + PLAYER.h > b.min[1]) return b;
  }
  return null;
}
// 낮은 턱은 걸어서 올라감. 올라갈 수 있으면 새 높이, 아니면 -1
function stepUp(b, x, z) {
  const top = b.max[1];
  return me.onGround && top > me.y && top - me.y <= PLAYER.step && !collides(x, top + 0.002, z) ? top : -1;
}
function movePlayer(dt, now) {
  let fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - input.jy;
  let str = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + input.jx;
  if (phase === 'freeze' || acting || shopOpen) { fwd = 0; str = 0; }
  const len = Math.hypot(fwd, str);
  if (len > 1) { fwd /= len; str /= len; }
  const wasGround = me.onGround, g0 = groundAt(me.x, me.z);
  const wl = waterAt(me.x, me.z), wading = g0 < wl - 0.25 && me.y < wl + 0.2; // 물속에서는 느려짐
  me.sprint = !me.drop && (input.sprint || keys.has('ShiftLeft') || keys.has('ShiftRight')) && fwd > 0.6 && !me.scoped && !me.crouch && !input.fire && me.slideT <= 0 && !wading;
  const sp = me.drop ? 15 : PLAYER.speed * (WEAPONS[me.w].move || 1) * (me.scoped ? 0.45 : 1) * (me.crouch ? 0.5 : 1) * (me.sprint ? PLAYER.sprint : 1) * (wading ? 0.6 : 1) * (healEnd > now ? 0.5 : 1);
  const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
  let tx = (-sy * fwd + cy * str) * sp, tz = (-cy * fwd - sy * str) * sp;
  if (me.slideT > 0) { me.slideT -= dt; const f = PLAYER.speed * (0.8 + 1.2 * Math.max(0, me.slideT) / 0.55); tx = me.slx * f; tz = me.slz * f; }
  const k = Math.min(1, (me.drop ? 2.5 : me.onGround ? 14 : 4) * dt);
  me.vx += (tx - me.vx) * k; me.vz += (tz - me.vz) * k;
  if ((input.jump || keys.has('Space')) && me.onGround && phase !== 'freeze' && !acting) { me.vy = PLAYER.jump; me.onGround = false; me.slideT = 0; if (me.crouch) toggleCrouch(); sfxStep(0.07, 0); }
  if (me.drop) me.vy += (-10 - me.vy) * Math.min(1, dt * 3); // 낙하산: 일정한 속도로 내려옴
  else me.vy -= PLAYER.gravity * dt;
  const lim = PLAYER.r;
  let nx = clamp(me.x + me.vx * dt, -ARENA.hx + lim, ARENA.hx - lim), b = collides(nx, me.y, me.z);
  if (b) { const up = stepUp(b, nx, me.z); if (up >= 0) me.y = up; else { nx = me.x; me.vx = 0; } }
  me.x = nx;
  let nz = clamp(me.z + me.vz * dt, -ARENA.hz + lim, ARENA.hz - lim);
  b = collides(me.x, me.y, nz);
  if (b) { const up = stepUp(b, me.x, nz); if (up >= 0) me.y = up; else { nz = me.z; me.vz = 0; } }
  me.z = nz;
  const gy = groundAt(me.x, me.z);
  let ny = me.y + me.vy * dt;
  me.onGround = false;
  if (ny <= gy) { ny = gy; me.vy = 0; me.onGround = true; }
  else {
    b = collides(me.x, ny, me.z);
    if (b) { if (me.vy <= 0) { ny = b.max[1]; me.onGround = true; } else ny = me.y; me.vy = 0; }
    else if (wasGround && me.vy <= 0 && ny - gy < 0.55 && !collides(me.x, gy, me.z)) { ny = gy; me.vy = 0; me.onGround = true; } // 내리막에서 땅에 붙어 감
  }
  me.y = ny;
  if (me.drop && me.onGround) { me.drop = false; sfxStep(0.2, 0); me.shake = 0.3; }
  const moving = Math.hypot(me.vx, me.vz);
  if (me.onGround && moving > 0.5) {
    me.bob += dt * moving * 1.7;
    if (wading) { me.stepT += dt * moving; if (me.stepT > 2.2) { me.stepT = 0; sfxSplash(0.07); } }
    else if (moving > 4.5 && !me.crouch) { me.stepT += dt * moving; if (me.stepT > 2.7) { me.stepT = 0; sfxStep(me.sprint ? 0.09 : 0.05, 0); } }
  }
}
const eye = [0, 0, 0];
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
function smoked(a, b) { for (const s of smokes) if (s.t < s.last && segHitsSphere(a, b, [s.x, s.y, s.z], s.r)) return true; return false; }
function aimedEnemy(maxT) {
  const d = dirFrom(me.yaw, me.pitch);
  let t = rayWorld(eye, d, maxT), hit = null;
  for (const o of others.values()) {
    if (!o.alive || o.team === myTeam) continue;
    const h = rayPlayer(eye, d, o.x, o.y, o.z, o.c);
    if (h && h.t < t) { t = h.t; hit = o; }
  }
  return hit && !smoked(eye, [hit.x, hit.y + 1.1, hit.z]);
}
function tryFire(now) {
  const W = WEAPONS[me.w];
  if (me.reloadEnd || now - me.lastShot < fireInterval(W)) return;
  if (W.melee) { // 칼: 바로 앞을 찌름
    me.lastShot = now; me.kickAnim = 1;
    send({ t: 'shoot', w: me.w, d: [dirFrom(me.yaw, me.pitch).map((v) => Math.round(v * 1e4) / 1e4)], rt: Math.round(performance.now() + (timeOff || 0) - 100) });
    sfxShot(me.w, 0.5, 0);
    return;
  }
  if (me.ammo[me.w] <= 0) { me.burstLeft = 0; startReload(now); return; }
  me.shotN = now - me.lastShot > 320 ? 0 : me.shotN + 1;
  me.lastShot = now; me.ammo[me.w]--; me.inspAt = -1e9; me.rackN = 1;
  if (W.burst) { if (me.burstLeft > 0) me.burstLeft--; else { me.burstLeft = W.burst - 1; me.burstAt = now; } }
  camera.getWorldDirection(_f);
  _r.crossVectors(_f, camera.up).normalize(); _u.crossVectors(_r, _f);
  const moving = Math.hypot(me.vx, me.vz) > 2 || !me.onGround;
  const spread = (W.scope && !me.scoped ? W.hipSpread : W.spread) * (me.scoped && !W.scope ? 0.4 : 1) * (me.crouch ? 0.75 : 1) * (moving && !W.falloff ? (W.cat === 'smg' ? 1.25 : 1.7) : 1);
  const dirs = [], myFx = fxOf(mySk[me.w]);
  const muzzle = [eye[0] + _f.x * 0.7 + _r.x * 0.2 - _u.x * 0.14, eye[1] + _f.y * 0.7 + _r.y * 0.2 - _u.y * 0.14, eye[2] + _f.z * 0.7 + _r.z * 0.2 - _u.z * 0.14];
  for (let i = 0; i < W.pellets; i++) {
    const a = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * spread;
    const sx = Math.cos(a) * rad, sy = Math.sin(a) * rad;
    const d = [_f.x + _r.x * sx + _u.x * sy, _f.y + _r.y * sx + _u.y * sy, _f.z + _r.z * sx + _u.z * sy];
    const l = Math.hypot(d[0], d[1], d[2]);
    d[0] /= l; d[1] /= l; d[2] /= l;
    dirs.push(d);
    if (i < 4) {
      const tw = rayWorld(eye, d, W.range);
      let t = tw;
      for (const o of others.values()) { if (!o.alive || o.team === myTeam) continue; const h = rayPlayer(eye, d, o.x, o.y, o.z, o.c); if (h && h.t < t) t = h.t; }
      const end = [eye[0] + d[0] * t, eye[1] + d[1] * t, eye[2] + d[2] * t];
      addTracer(muzzle, end, myFx.tracer, myFx === FX0 ? 0.1 : 0.14);
      if (t === tw && tw < W.range) impact(end, myFx.flash);
    }
  }
  send({ t: 'shoot', w: me.w, d: dirs.map((d) => d.map((v) => Math.round(v * 1e4) / 1e4)), rt: Math.round(performance.now() + (timeOff || 0) - 100) });
  // 반동: 연사 무기는 쏠수록 위로 올라가다가 좌우로 흔들리는 고정 패턴
  const auto = !!W.auto || !!W.burst, n = me.shotN, aim = me.scoped ? 0.55 : 1;
  const up = W.kick * (auto ? 1 + Math.min(n, 9) * 0.16 : 1) * aim;
  const side = auto && n >= 4 ? W.kick * 1.5 * Math.sin((n - 4) * 0.6) * aim : (Math.random() - 0.5) * W.kick * 0.6;
  me.pitch = clamp(me.pitch + up, -1.45, 1.45);
  me.yaw += side;
  me.kickAnim = 1;
  flash.material.color.setHex(myFx.flash);
  flash.visible = true; flash.rotation.z = Math.random() * 3; flash.scale.setScalar(0.8 + Math.random() * 0.5); flash._off = now + 45;
  if (!(me.scoped && W.scope)) { // 탄피가 오른쪽으로 튀어나감
    let c = casings.find((q) => q.life <= 0);
    if (!c && casings.length < 10) { c = { m: new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.034), new THREE.MeshStandardMaterial({ color: 0xc89b3c, metalness: 0.6, roughness: 0.4 })), v: [0, 0, 0], life: 0 }; vmScene.add(c.m); casings.push(c); }
    if (c) { const g = vmGun(me.w); c.m.position.set(g.position.x + 0.03, g.position.y + 0.03, g.position.z + 0.02); c.m.rotation.set(0, 0, 0); c.v = [0.9 + Math.random() * 0.6, 1.1 + Math.random() * 0.6, 0.2 + Math.random() * 0.3]; c.life = 0.55; c.m.visible = true; }
  }
  sfxShot(me.w, 0.5, 0);
  if (W.scope) setTimeout(() => setScope(false), 60);
  if (me.ammo[me.w] <= 0) { me.burstLeft = 0; setTimeout(() => startReload(performance.now()), 250); }
}
function fireInterval(W) { return W.spin ? W.spin[0] + (W.spin[1] - W.spin[0]) * me.spin : W.interval; }

function updateOthers(dt, now) {
  const rt = now + (timeOff || 0) - 100;
  for (const o of others.values()) {
    const b = o.buf;
    while (b.length > 2 && b[1].t <= rt) b.shift();
    if (!b.length) { o.g.visible = false; continue; }
    const px = o.x, pz = o.z, py = o.y;
    if (b.length === 1 || rt <= b[0].t) { const s = b[0]; o.x = s.x; o.y = s.y; o.z = s.z; o.yaw = s.yaw; o.pitch = s.pitch; }
    else {
      const a = b[0], c = b[1], f = clamp((rt - a.t) / (c.t - a.t || 1), 0, 1.3);
      o.x = a.x + (c.x - a.x) * f; o.y = a.y + (c.y - a.y) * f; o.z = a.z + (c.z - a.z) * f;
      let dy = (c.yaw - a.yaw) % (Math.PI * 2); if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2;
      o.yaw = a.yaw + dy * f; o.pitch = a.pitch + (c.pitch - a.pitch) * f;
    }
    if (!o.alive) { // 쓰러지는 동작
      if (o.wasAlive) { o.wasAlive = false; o.deadT = 0; }
      o.deadT += dt;
      o.g.visible = o.deadT < 4;
      if (o.g.visible) { const f = Math.min(1, o.deadT / 0.45); o.body.rotation.x = f * f * 1.5; o.body.position.y = f * 0.16; o.tag.visible = false; }
      continue;
    }
    if (!o.wasAlive) { o.wasAlive = true; o.body.rotation.x = 0; o.body.position.y = 0; o.tag.visible = true; }
    o.g.visible = true;
    if (mode === 'br') { // 낙하산과 이름표 (멀면 이름을 숨김)
      const air = o.y - groundAt(o.x, o.z) > 3.5 && o.y < py - 0.02;
      if (air && !o.chute) { o.chute = makeChute(BR_COL[(o.ci || 0) % BR_COL.length]); o.g.add(o.chute); }
      if (o.chute) o.chute.visible = air;
      o.tag.visible = Math.hypot(o.x - camera.position.x, o.z - camera.position.z) < 28;
    } else if (o.chute) o.chute.visible = false;
    o.g.position.set(o.x, o.y, o.z); o.g.rotation.y = o.yaw;
    o.head.rotation.x = o.pitch * 0.8; o.arms.rotation.x = o.pitch;
    const sp = Math.hypot(o.x - px, o.z - pz) / (dt || 0.016);
    if (sp > 0.5) o.walk += dt * (6 + sp * 0.9); else o.walk *= 0.8;
    const sw = Math.sin(o.walk) * Math.min(0.75, sp * 0.13);
    o.legs[0].rotation.x = sw; o.legs[1].rotation.x = -sw;
    o.body.position.y = Math.abs(Math.sin(o.walk)) * Math.min(0.05, sp * 0.008);
    let seated = false;
    if (vehs.size) for (const v of vehs.values()) if (v.driver === o.id) { seated = true; o.g.position.y = o.y + 0.25; o.g.rotation.y = v.yaw; o.legs[0].rotation.x = o.legs[1].rotation.x = -1.3; break; }
    o.cs += ((o.c || seated ? 0.7 : 1) - o.cs) * Math.min(1, dt * 12);
    const sc0 = o.prot ? 1.04 : 1;
    o.g.scale.set(sc0, sc0 * o.cs, sc0);
    if (sp > 4.5 && !o.c) { // 발소리
      o.stepT += dt * sp;
      if (o.stepT > 2.7) { o.stepT = 0; const [v, pan] = heard(o.x, o.z, 22); sfxStep(v * 0.3, pan); }
    }
  }
}
function updateFx(dt) {
  for (const t of tracers) if (t.life > 0) { t.life -= dt; t.l.material.opacity = Math.max(0, t.life / 0.1) * 0.9; if (t.life <= 0) t.l.visible = false; }
  for (const s of sparks) if (s.life > 0) { s.life -= dt; s.s.material.opacity = Math.max(0, s.life / 0.09); if (s.life <= 0) s.s.visible = false; }
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i]; b.t += dt;
    const dur = b.big ? 1.1 : 0.45, f = b.t / dur;
    b.s.scale.setScalar((b.big ? 26 : b.white ? 5 : 9) * (0.25 + f * 0.75));
    b.s.material.opacity = Math.max(0, 1 - f);
    if (b.white) b.s.material.color.setHex(0xffffff);
    if (f >= 1) { scene.remove(b.s); b.s.material.dispose(); booms.splice(i, 1); }
  }
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i]; s.t += dt;
    const grow = Math.min(1, s.t / 1.2), fade = clamp((s.last - s.t) / 2.5, 0, 1);
    for (const sp of s.g.children) { sp.scale.setScalar(s.r * 1.5 * sp.userData.k * (0.2 + grow * 0.8)); sp.material.opacity = 0.9 * fade; }
    if (s.t >= s.last) { scene.remove(s.g); smokes.splice(i, 1); }
  }
  for (const ms of nadeMeshes.values()) { const t = ms.userData.to; ms.position.x += (t[0] - ms.position.x) * Math.min(1, dt * 18); ms.position.y += (t[1] - ms.position.y) * Math.min(1, dt * 18); ms.position.z += (t[2] - ms.position.z) * Math.min(1, dt * 18); }
}

let lastT = performance.now(), lastSend = 0, menuAng = 0, perfT = 0, perfN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (!joined && paintUI.open) { // 캐릭터 그리기: 오른쪽에 그린 그림을 입은 캐릭터를 돌려 보여 줌
    const r = $('ptPrev').getBoundingClientRect(), asp = vmCam.aspect;
    const d = Math.min(9, Math.max(2.1 / (1.108 * Math.max(0.2, r.height / window.innerHeight)), 1.05 / (1.108 * asp * Math.max(0.08, r.width / window.innerWidth))));
    if (!paintUI.drag) paintUI.yaw = now / 1400;
    pvGroup.position.set((((r.left + r.right) / 2 / window.innerWidth) * 2 - 1) * 0.554 * d * asp, -(((r.top + r.bottom) / 2 / window.innerHeight) * 2 - 1) * 0.554 * d - 0.95, -d);
    pvGroup.rotation.y = paintUI.yaw;
    pvGroup.visible = true; vm.visible = false; lkGroup.visible = false;
    renderer.setClearColor(0x161a21, 1); renderer.clear(); renderer.render(vmScene, vmCam);
    return;
  }
  if (!joined && lockerOpen) { // 무기고: 어두운 배경에 총만 크게
    lkBuild();
    const r = $('lkMid').getBoundingClientRect(), asp = vmCam.aspect, wf = Math.max(0.2, r.width / window.innerWidth);
    const d = Math.max(0.36, lkGun.userData.len / (0.8 * wf * 1.108 * asp));
    lkGroup.position.set((((r.left + r.right) / 2 / window.innerWidth) * 2 - 1) * 0.554 * d * asp, -0.015 * d, -d);
    if (lkSpin) lkYaw = Math.PI / 2 + Math.sin(now / 1900) * 0.95; // 옆모습을 중심으로 천천히 흔들어 보여 줌
    lkGun.rotation.set(0.1, lkYaw, 0);
    lkGroup.visible = true; vm.visible = false;
    tickSkins(now / 1000);
    renderer.setClearColor(0x161a21, 1); renderer.clear(); renderer.render(vmScene, vmCam);
    return;
  }
  if (!joined) {
    menuAng += dt * 0.07;
    const big = ARENA.hx > 100;
    camera.position.set(Math.cos(menuAng) * ARENA.hx * (big ? 0.7 : 0.95), big ? ARENA.hx * 0.36 : 30, Math.sin(menuAng) * ARENA.hz * (big ? 0.7 : 1.05));
    camera.lookAt(4, big ? 6 : 0, 0);
    world.update(camera.position, dt);
    renderer.clear(); renderer.render(scene, camera);
    return;
  }
  if (me.alive && !matchEnded && car.id) { // 운전 중: 차 뒤에서 따라가는 시점
    driveCar(dt);
    me.pitch = clamp(me.pitch, -0.9, 0.25);
    eye[0] = me.x; eye[1] = me.y + 1.5; eye[2] = me.z;
    const d = dirFrom(me.yaw, me.pitch), back = Math.min(6.5, rayWorld(eye, [-d[0], -d[1], -d[2]], 6.8) - 0.3);
    me.shake = Math.max(0, me.shake - dt * 2.2);
    camera.position.set(eye[0] - d[0] * back, Math.max(eye[1] - d[1] * back + 0.5, groundAt(eye[0] - d[0] * back, eye[2] - d[2] * back) + 0.4), eye[2] - d[2] * back);
    camera.rotation.set(me.pitch + (Math.random() - 0.5) * me.shake * 0.05, me.yaw, 0);
    if (actSent) { actSent = false; acting = false; }
  } else if (me.alive && !matchEnded) {
    const wasAir = !me.onGround, vy0 = me.vy;
    movePlayer(dt, now);
    if (wasAir && me.onGround && vy0 < -7 && !me.drop) { sfxStep(0.16, 0); me.shake = Math.max(me.shake, Math.min(0.5, -vy0 / 30)); } // 착지
    me.eyeH += ((me.crouch ? PLAYER.eyeCrouch : PLAYER.eye) - me.eyeH) * Math.min(1, dt * 12);
    eye[0] = me.x; eye[1] = me.y + me.eyeH; eye[2] = me.z;
    camera.position.set(eye[0], eye[1], eye[2]);
    me.shake = Math.max(0, me.shake - dt * 2.2);
    camera.rotation.set(me.pitch + (Math.random() - 0.5) * me.shake * 0.05, me.yaw + (Math.random() - 0.5) * me.shake * 0.05, 0);
    if (me.reloadEnd && now >= me.reloadEnd) { me.reloadEnd = 0; me.ammo[me.w] = WEAPONS[me.w].mag; sfxTone(420, 0.06, 0.1, 'square', 640); }
    const W = WEAPONS[me.w];
    let want = input.fire && !shopOpen;
    if (!want && autoFire && !shopOpen && !me.reloadEnd && !me.drop && now - me.lastShot >= W.interval && (!W.scope || me.scoped)) want = aimedEnemy(W.falloff ? 14 : Math.min(W.range, mode === 'br' ? 90 : 999));
    if (W.burst) { if (me.burstLeft > 0) want = true; else if (want && now - me.burstAt < W.burstGap) want = false; } // 점사
    me.spin = clamp(me.spin + (want && W.spin && !me.reloadEnd ? dt / 1.3 : -dt / 0.5), 0, 1);                       // 쏠수록 빨라지는 기관총
    const wantAct = mode !== 'br' && (input.act || keys.has('KeyE')) && canAct();
    if (wantAct !== actSent) { actSent = wantAct; send({ t: 'act', on: wantAct }); }
    acting = wantAct;
    if (want && !acting && canFight()) tryFire(now);
  } else if (!me.alive) {
    if (actSent) { actSent = false; acting = false; send({ t: 'act', on: false }); }
    let tgt = null;
    if (mode !== 'tdm' && phase !== 'wait') { // 화면을 누르거나 Space 로 관전 대상 바꾸기
      let list = [...others.values()].filter((o) => o.alive && o.team === myTeam && o.buf.length);
      if (!list.length) list = [...others.values()].filter((o) => o.alive && o.buf.length);
      if (list.length) tgt = list[specIdx % list.length];
    }
    if (tgt) { // 살아 있는 팀원을 뒤에서 따라가며 관전
      const d = dirFrom(tgt.yaw, 0), k = Math.min(1, dt * 7);
      let back = 3.2; // 벽에 파묻히지 않게 뒤쪽 거리 조절
      const hitT = rayWorld([tgt.x, tgt.y + 1.9, tgt.z], [-d[0], 0, -d[2]], 3.4);
      if (hitT < 3.4) back = Math.max(0.6, hitT - 0.3);
      camera.position.x += (tgt.x - d[0] * back - camera.position.x) * k;
      camera.position.y += (tgt.y + 2.3 - camera.position.y) * k;
      camera.position.z += (tgt.z - d[2] * back - camera.position.z) * k;
      camera.lookAt(tgt.x + d[0] * 2, tgt.y + 1.3, tgt.z + d[2] * 2);
      setTxt('spec', `관전 중 · ${tgt.name} · ${isTouch ? '화면을 누르면' : 'Space로'} 다른 ${mode === 'br' ? '생존자' : '팀원'}`);
    } else if (mode === 'br' && (phase === 'wait' || !others.size)) { // 시작을 기다리는 동안 섬을 한 바퀴
      menuAng += dt * 0.05;
      camera.position.set(Math.cos(menuAng) * ARENA.hx * 0.7, ARENA.hx * 0.36, Math.sin(menuAng) * ARENA.hx * 0.7);
      camera.lookAt(0, 6, 0);
      setTxt('spec', phase === 'wait' ? `생존전이 곧 시작됩니다 · 참가 ${roster.filter((p) => !p.bot).length}명` : '다음 경기를 기다리는 중');
    } else {
      camera.position.y += (me.y + 3.6 - camera.position.y) * Math.min(1, dt * 3);
      camera.rotation.x += (-0.9 - camera.rotation.x) * Math.min(1, dt * 3);
      if (mode !== 'tdm') setTxt('spec', mode === 'br' ? '다음 경기를 기다리는 중' : '다음 라운드를 기다리는 중');
    }
  }
  // 폭탄 표시와 경고음
  if (mode === 'bomb' && (bomb.st === 'dropped' || bomb.st === 'planted')) {
    bombMesh.visible = true; bombMesh.position.set(bomb.x, groundAt(bomb.x, bomb.z), bomb.z);
    const gap = bomb.st === 'planted' ? clamp(timeLeft / 35000, 0.12, 1) * 1000 : 1e9;
    bombLight.visible = bomb.st !== 'planted' || now - lastBeep < gap * 0.4;
    if (bomb.st === 'planted' && phase === 'planted' && now - lastBeep > gap) {
      lastBeep = now;
      const [v] = heard(bomb.x, bomb.z, 55);
      sfxTone(1250, 0.05, Math.max(0.05, v) * 0.16, 'square');
    }
  } else bombMesh.visible = false;
  // 느린 기기면 화질을 자동으로 낮춤
  perfT += dt; perfN++;
  if (perfT > 3) { if (perfT / perfN > 0.03 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); resize(); } perfT = 0; perfN = 0; }
  updateOthers(dt, now);
  updateFx(dt);
  world.update(camera.position, dt);
  if (AC && !!ambient !== (mode === 'br')) setAmbient(mode === 'br');
  if (mode === 'br') {
    updateLoot(dt); updateVehs(dt);
    crate.visible = !!airdrop;
    if (airdrop) { crate.position.set(airdrop[0], airdrop[1], airdrop[2]); crate.userData.chute.visible = !airdrop[3]; crate.userData.beam.material.opacity = 0.22 + Math.sin(now / 300) * 0.08; }
    drawCompass();
    zoneWall.visible = zone.on;
    if (zone.on) { zoneWall.position.set(zone.cx, 60, zone.cz); zoneWall.scale.set(Math.max(0.5, zone.r), 170, Math.max(0.5, zone.r)); zoneTex.offset.x = now * 0.00002; zoneTex.repeat.x = Math.max(6, zone.r * 0.8); }
    myChute.visible = me.alive && me.drop;
    if (myChute.visible) myChute.position.set(me.x, me.y + 0.6, me.z);
  } else if (zoneWall.visible || crate.visible) { zoneWall.visible = false; myChute.visible = false; crate.visible = false; }
  engineSound(car.id && me.alive ? Math.abs(car.sp) : -1);
  updateCasings(dt);

  // 1인칭 총 움직임
  me.kickAnim = Math.max(0, me.kickAnim - dt * 8);
  me.draw = Math.max(0, me.draw - dt * 4.5);
  const damp = Math.exp(-dt * 9);
  me.swx *= damp; me.swy *= damp;
  const W = WEAPONS[me.w];
  const rel = me.reloadEnd ? Math.min(1, Math.min(now - (me.reloadEnd - W.reload), me.reloadEnd - now) / 280) : 0;
  const ease = (v) => v * v * (3 - 2 * v);
  const lower = ease(rel) * 0.16 + ease(me.draw) * 0.8; // 장전할 때는 살짝만 내려 탄창 갈아 끼우는 모습이 보이게
  const [kz, kr] = VM[W.vm].kick;
  const adsOn = me.scoped && !W.scope;
  me.adsT += ((adsOn ? 1 : 0) - me.adsT) * Math.min(1, dt * 16);
  me.sprT += ((me.sprint && me.alive ? 1 : 0) - me.sprT) * Math.min(1, dt * 10);
  const ad = me.adsT, hip = 1 - ad, gp = vmGun(me.w), vp = VM[W.vm].pos, ap = gp.userData.ads;
  gp.position.set(vp[0] + (ap[0] - vp[0]) * ad, vp[1] + (ap[1] - vp[1]) * ad, vp[2] + (ap[2] - vp[2]) * ad);
  vm.position.set(Math.cos(me.bob) * 0.005 * hip, -Math.abs(Math.sin(me.bob)) * 0.007 * hip - me.sprT * 0.04, me.kickAnim * kz * (1 - ad * 0.5));
  vm.rotation.set(me.kickAnim * kr * 0.35 * (1 - ad * 0.6) - lower + me.swy * hip - me.sprT * 0.1, (0.04 + me.swx) * hip + me.sprT * 0.38 + ease(rel) * 0.22, ease(rel) * 0.42 + me.sprT * 0.18);
  gp.rotation.x = me.kickAnim * kr * 0.65 * (1 - ad * 0.6);
  // 움직이는 부품: 슬라이드·노리쇠·펌프, 장전할 때 빠졌다 끼워지는 탄창
  const gi = gp.userData.info;
  if (gi.slide) {
    let tr = me.kickAnim;
    if (gi.rack) { const ts = (now - me.lastShot) / 1000; tr = ts > 0.16 && ts < 0.6 ? Math.sin(((ts - 0.16) / 0.44) * Math.PI) : 0; if (me.rackN && ts > 0.3) { me.rackN = 0; sfxStep(0.14, 0); sfxTone(210, 0.05, 0.07, 'square', 150); } }
    gi.slide.position.z = tr * gi.travel;
    if (gi.pump && gp.userData.lh) gp.userData.lh.position.z = tr * gi.travel;
  }
  if (gi.mag) {
    let d = 0;
    if (me.reloadEnd) { const p = clamp(1 - (me.reloadEnd - now) / W.reload, 0, 1); d = p < 0.25 ? ease(p / 0.25) : p < 0.6 ? 1 : 1 - ease((p - 0.6) / 0.3 > 1 ? 1 : (p - 0.6) / 0.3); }
    gi.mag.position.y = -d * 0.24; gi.mag.rotation.x = d * 0.25;
  }
  // 살펴보기: 총을 돌려 옆면을 보여 줌
  const it = (now - me.inspAt) / 2400;
  if (it >= 0 && it < 1) { const k = Math.sin(Math.PI * Math.min(1, it * 1.15)) ** 0.5; gp.rotation.y = k * 1.05; gp.rotation.z = Math.sin(it * Math.PI * 2) * 0.28 * k; gp.position.x -= k * 0.13; gp.position.y += k * 0.06; gp.position.z -= k * 0.05; }
  else { gp.rotation.y = 0; gp.rotation.z = 0; }
  tickSkins(now / 1000);
  if (flash.visible) { const m = gp.userData.muzzle; flash.position.set(gp.position.x + m[0], gp.position.y + m[1], gp.position.z + m[2] - 0.03); if (now > flash._off) flash.visible = false; }
  vm.visible = me.alive && !(me.scoped && W.scope) && !matchEnded && !me.drop && !car.id;
  const tf = me.alive && me.scoped ? (W.zoom || VM[W.vm].fov) : me.alive && car.id ? 75 + Math.min(10, Math.abs(car.sp) * 0.5) : me.alive && me.sprint ? 81 : 75;
  if (Math.abs(camera.fov - tf) > 0.05) { camera.fov += (tf - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
  if (hudCache.spr !== me.sprint) { hudCache.spr = me.sprint; $('sprintTag').classList.toggle('on', me.sprint); }

  if (now - lastSend >= 50 && me.alive) {
    lastSend = now;
    send({ t: 'in', p: [+me.x.toFixed(2), +me.y.toFixed(2), +me.z.toFixed(2)], r: [+me.yaw.toFixed(3), +me.pitch.toFixed(3)], w: me.w, c: me.crouch ? 1 : 0, a: me.drop ? 1 : 0, vy: car.id ? +car.yaw.toFixed(3) : undefined });
  }
  updateHud(now);
  renderer.clear(); renderer.render(scene, camera);
  renderer.clearDepth(); renderer.render(vmScene, vmCam);
}
requestAnimationFrame(frame);

// 테스트·디버그용
window.__sc = { get mySk() { return mySk; }, unlocked, me, inv, others, dropMeshes, loot, zone, camera, car, vehs, get air() { return airdrop; }, get near() { return nearLoot; }, get world() { return world; }, get map() { return curMap; }, input, bomb, smokes, nadeMeshes, get myId() { return myId; }, get phase() { return phase; }, get attack() { return attack; }, get myTeam() { return myTeam; }, get mode() { return mode; }, get joined() { return joined; }, get roster() { return roster; }, get score() { return score; }, get shop() { return shopOpen; } };
