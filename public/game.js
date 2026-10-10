// SQUAD CLASH — 클라이언트
import * as THREE from './vendor/three.module.js';
import { ARENA, PLAYER, WEAPONS, SKINS, NADES, ECON, NADE_WEAPON, ZONE_WEAPON, VEH_WEAPON, W_KNIFE, W_PISTOL, MAPS, setMap, BOXES, SITES, siteAt, dirFrom, rayWorld, rayPlayer, hitNormal, HIT_M, segHitsSphere, groundAt, waterAt, boxesNear, PARTS, PART_SLOTS, PART_MAX, partSlots, partOk, cleanParts, effWeapon, SKIN_LV, SKIN_LV_NAME, skinLevel, OPS, OP_BASE } from './shared.js';
import { dressOp, tickOps, opDraw } from './operators.js';
import { loadGunModels } from './gunmodels.js';
await Promise.race([loadGunModels(), new Promise((r) => setTimeout(r, 9000))]); // 실제 총 모델을 먼저 받아 둠 (늦으면 코드 모델로 시작)
import { makeGun, makeArms, initGunEnv, tickSkins, skinFx, setGunQuality, gunBox, pulseSkin, skinFire, setGunAds } from './guns.js';
import { paintTex, isPaint, initPaintEditor, paintUI } from './paint.js';
import { makeRig, rigHold, rigShot, rigFlinch, rigMuzzle, animate as animRig, setAvatarFlash } from './avatar.js';
import { initAudio, audioOn, setVolume, sfxShot, sfxBoom, sfxStep, sfxSplash, sfxTone, sfxImpact as playImpact, sfxWhiz, sfxReload, sfxUI, setAmbient, engineSound, sfxSkin, sfxSample } from './audio.js';
import { initFx, flashTex, addTracer, hole, clearHoles, spark, emitSpark, emitChip, puff, lightFlash, explode, addSmoke, clearSmokes, smokes, glow, shock, updateFx as tickFx } from './fx.js';
import { buildWorld, blobShadow, MOODS, setWorldQuality } from './world.js';
import { makePost, TONE } from './post.js';

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
const QLOCK = /[?&]qlock/.test(location.search); // 테스트용: 느려도 화질을 자동으로 낮추지 않음
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, gfx === 'low' ? 1 : gfx === 'mid' ? 1.5 : 2));
renderer.autoClear = false;
renderer.info.autoReset = false; // 한 프레임에 그린 양을 모두 더해서 셈 (frame 에서 직접 초기화)
renderer.toneMapping = TONE; // 밝은 곳이 하얗게 날아가지 않고 부드럽게 눌림
setGunQuality(gfx);
initGunEnv(renderer);
setWorldQuality(gfx, renderer);
// 후처리(빛 번짐·선명도·색 보정). 화질 '낮음'은 쓰지 않고 바로 화면에 그림
const post = gfx === 'low' ? null : makePost(renderer, { samples: gfx === 'high' ? 4 : 2, levels: gfx === 'high' ? 5 : 3 });
let postOn = !!post && post.active;
const GRADE_UI = { bloom: 0.4, thresh: 1.0, sat: 1.04, con: 1.03, vig: 0.34, grain: 0.008 }; // 무기고·캐릭터 그리기 화면
function present(draw, now, grade) { // 그리기 함수를 후처리를 거쳐(또는 바로) 화면에 내보냄
  if (postOn) { post.setGrade(grade); post.begin(); draw(); post.end(now / 1000); }
  else { renderer.setRenderTarget(null); draw(); }
}
// 스킨: 무기마다 고른 스킨 번호, 등록한 코드, 쓸 수 있는 스킨
const jget = (k, d) => { try { const v = JSON.parse(store.get(k, '')); return v ?? d; } catch { return d; } };
let mySk = WEAPONS.map((_, i) => { const v = jget('sk', [])[i]; return SKINS[v] ? v : 0; });
// 파츠: 무기마다 단 파츠 번호 목록. ew(무기) = 파츠를 반영한 수치
let myParts = WEAPONS.map((_, i) => cleanParts(i, jget('parts', [])[i]));
const EW = [];
const ew = (wi) => EW[wi] || (EW[wi] = effWeapon(wi, myParts[wi]));
// 스킨 업그레이드: 스킨별 처치 수 → 레벨
const skXp = (() => { const o = jget('skx', {}); return o && typeof o === 'object' ? o : {}; })();
const myLv = (skin) => (skin > 0 && SKINS[skin] ? skinLevel(skXp[SKINS[skin].id] | 0) : 1);
let myCodes = jget('codes', []).filter((c) => typeof c === 'string').slice(0, 24);
const unlocked = new Set(SKINS.map((k, i) => (k.free ? i : -1)).filter((i) => i >= 0));
let myOp = (() => { const v = +store.get('op', 0) | 0; return OPS[v] ? v : 0; })(); // 요원 스킨 (0 = 내 그림)
let opShotAt = 0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500);
camera.rotation.order = 'YXZ';
const worldOpt = { shadows: gfx !== 'low', shadowSize: gfx === 'high' ? 2048 : 1024, lowFar: gfx === 'low', farK: gfx === 'low' ? 0.55 : gfx === 'mid' ? 0.8 : 1, mood: 0, hdr: postOn && post.hdr, lin: postOn };
let world = buildWorld(scene, renderer, worldOpt);
camera.far = world.far;

const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
const vmHemi = new THREE.HemisphereLight(0xffffff, 0x556070, 1.7);
const vmSun = new THREE.DirectionalLight(0xffffff, 1.4);
vmSun.position.set(-0.6, 2, 1.5);
const vmRim = new THREE.DirectionalLight(0xcfe2ff, 0); vmRim.position.set(1.5, 0.9, -2.2); // 뒤쪽에서 윤곽을 살리는 빛 (무기고에서 세게, 경기 중에는 약하게)
vmScene.add(vmHemi, vmSun, vmRim);
// 손에 든 총의 빛을 맵에 맞춤: 빛 색은 맵 분위기를 따르고, 해 방향은 시점에 따라 돌며, 그늘에 들어가면 어두워짐
const VML = { hemi: 1.7, sun: 1.4, shade: 0, t: 0, dir: new THREE.Vector3(-0.3, 0.8, 0.5).normalize() };
const _vq = new THREE.Quaternion(), _wc = new THREE.Color(0xffffff), _gc = new THREE.Color(0x556070);
let UIL = false; // 무기고 빛을 쓰고 있었는지
let DUST = 0, SURF = 0; // 발먼지 색 (먼지가 이는 땅이 아니면 0), 맵 바닥의 발소리 종류
function applyTheme() {
  const T = world.theme; UIL = false; vmRim.intensity = T.night ? 0.25 : 0.45;
  vmHemi.color.set(T.hemi[0]).lerp(_wc, 0.4); vmHemi.groundColor.set(T.hemi[1]).lerp(_gc, 0.45);
  vmSun.color.set(T.sun[0]).lerp(_wc, 0.25);
  VML.hemi = T.night ? 1.0 : 1.55; VML.sun = T.night ? 0.75 : Math.min(1.9, 0.6 + T.sun[1] * 0.42);
  VML.dir.set(T.sun[2][0], T.sun[2][1], T.sun[2][2]).normalize();
  DUST = { town: 0xd9c29a, station: 0xa39c90, isle: 0xb9a57e }[world.tkey] || 0;
  SURF = { town: 5, station: 6, castle: 5, isle: 5 }[world.tkey] || 0;
}
const _sv = new THREE.Vector3(), _sunC = new THREE.Color();
function updateVmLight(dt, now) { // 해가 가려졌는지(그늘) 가끔 확인 → 총의 밝기와, 해 쪽을 볼 때 화면에 번지는 빛
  if (now - VML.t > 140) {
    VML.t = now;
    VML.want = rayWorld([camera.position.x, camera.position.y, camera.position.z], [VML.dir.x, VML.dir.y, VML.dir.z], 90) < 90 ? 1 : 0;
  }
  VML.shade += ((VML.want || 0) - VML.shade) * Math.min(1, dt * 6);
  _sv.copy(VML.dir).applyQuaternion(_vq.copy(camera.quaternion).invert());
  vmSun.position.copy(_sv);
  vmSun.intensity = VML.sun * (1 - VML.shade * 0.72); vmHemi.intensity = VML.hemi * (1 - VML.shade * 0.18);
  if (postOn) {
    const T = world.theme, k = (1 - VML.shade) * (T.night ? 0.05 : 0.1), th = Math.tan((camera.fov * Math.PI) / 360);
    _sunC.set(T.sun[0]);
    post.setGlare(_sv, _sunC.r * k, _sunC.g * k, _sunC.b * k, th * camera.aspect, th);
  }
}
function uiLight() { vmHemi.color.set(0xffffff); vmHemi.groundColor.set(0x556070); vmHemi.intensity = 1.5; vmSun.color.set(0xfff6ea); vmSun.intensity = 2.3; vmSun.position.set(-0.7, 1.9, 1.6); vmRim.intensity = 2.0; if (postOn) post.setGlare(null, 0, 0, 0); UIL = true; } // 무기고·캐릭터 화면은 늘 같은 빛
applyTheme();

// 게임이 쓰는 화면 영역: 가로로 쥐면 화면 전체, 세로로 쥐면(터치 기기) 아래쪽 절반만 씀
let VW = window.innerWidth, VH = window.innerHeight, VT = 0; // 너비, 높이, 위쪽 여백
function resize() {
  const half = isTouch && window.innerHeight > window.innerWidth;
  VW = window.innerWidth; VH = half ? Math.round(window.innerHeight / 2) : window.innerHeight; VT = window.innerHeight - VH;
  document.body.classList.toggle('half', half);
  document.documentElement.style.setProperty('--vh', VH / 100 + 'px');
  const w = VW, h = VH;
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
  if (info.op && OPS[info.op]) return paintTex('op' + info.op, 'op', 0, (g) => opDraw(g, OPS[info.op].id)); // 요원 스킨이 그림보다 먼저
  const d = paints.get(info.id);
  if (isPaint(d)) return paintTex('p' + info.id + ':' + d.length + ':' + d.slice(-40), 'url', d);
  if (info.bot) return paintTex('b' + info.id, 'bot', info.id * 7 + 3);
  return paintTex('def');
}
// 적 잘 보이게: 몸 가장자리가 빨갛게 빛나는 윤곽광(멀수록 진하게) + 벽에 가리지 않고 보이는 적 머리 위의 빨간 표식 (화면 크기 고정)
function rimOf(mat) {
  const u = { value: new THREE.Color(0, 0, 0) };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = u;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += uRim * ( 0.25 + pow( 1.0 - saturate( abs( dot( normal, normalize( vViewPosition ) ) ) ), 2.0 ) );');
  };
  mat.customProgramCacheKey = () => 'rim';
  return u;
}
let markTex = null;
function enemyMark() {
  if (!markTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.beginPath(); g.moveTo(8, 10); g.lineTo(56, 10); g.lineTo(32, 50); g.closePath(); g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.6)'; g.stroke(); g.fillStyle = '#ff3b3b'; g.fill(); markTex = new THREE.CanvasTexture(cv); markTex.colorSpace = THREE.SRGBColorSpace; }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
  const k = isTouch ? 0.034 : 0.024; s.scale.set(k, k, 1); s.position.y = 2.42; s.renderOrder = 20; s.visible = false;
  return s;
}
function makeAvatar(info) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const br = info.ci !== undefined;
  const rig = makeRig(paintTexOf(info), br ? brMat[info.ci] : teamMat[info.team]); // 뼈대와 동작은 avatar.js
  if (info.op) dressOp(rig, info.op); // 요원 스킨: 투구·갑옷·망토 등이 뼈대를 따라 움직임
  g.add(rig.body);
  const tag = nameSprite(info.name, br ? 0 : info.team), shadow = blobShadow(), mark = enemyMark();
  g.add(tag, shadow, mark);
  g.visible = false;
  scene.add(g);
  const av = Object.assign(rig, { g, tag, shadow, mark, rim: rimOf(rig.mat), losT: 0, los: false, bot: !!info.bot, c: false, buf: [], x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, hp: 100, alive: false, wasAlive: false, deadT: 9, fallDir: 0, prot: false, stepT: 0, shotAt: 0, team: info.team, name: info.name, chute: null, ci: info.ci, id: info.id, op: info.op || 0, sk: info.sk || null, att: info.att || null, sl: info.sl || null });
  holdGun(av, W_PISTOL);
  return av;
}
function holdGun(o, wi) { const sk = o.sk ? o.sk[wi] : 0; rigHold(o, wi, sk, o.att ? o.att[wi] : null, o.sl ? o.sl[sk] : 1); } // 다른 사람이 든 무기 바꾸기

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
  const key = mySk[wi] + ':' + myParts[wi].join('.') + ':' + (myLv(mySk[wi]) >= 5);
  if (guns[wi] && guns[wi].userData.skin !== key) { vm.remove(guns[wi]); guns[wi] = null; }
  if (!guns[wi]) {
    const info = makeGun(wi, mySk[wi], myParts[wi], myLv(mySk[wi])), g = new THREE.Group(), v = VM[WEAPONS[wi].vm], arms = makeArms(info, sleeveMat);
    info.group.traverse((m) => { if (m.name === 'fpMask') m.visible = true; });
    g.add(info.group, arms);
    g.position.set(...v.pos);
    if (v.rot) info.group.rotation.set(...v.rot);
    g.userData.muzzle = info.muzzle; g.userData.ads = [0, -info.sight, info.adsZ || v.adsZ]; g.userData.skin = key; g.userData.info = info; g.userData.lh = arms.userData.lh;
    g.visible = wi === me.w;
    vm.add(g); guns[wi] = g;
  }
  return guns[wi];
}
setAvatarFlash(flashTex);
const FX0 = { tracer: 0xffffff, flash: 0xffd27a }, _fxc = new THREE.Color();
function fxOf(skin, lv = 1) { // 스킨의 궤적·불꽃 색. 스킨 레벨 2부터 궤적, 3부터 불꽃·탄착 색 (오로라는 무지갯빛으로 계속 바뀜). 얼티밋 번들은 처음부터 전부 + 전용 효과(kind)
  const sf = skinFx(skin);
  if (sf && sf.bundle) lv = Math.max(lv, 4);
  const f = lv >= 2 ? sf : null;
  if (!f) return FX0;
  const c = f.rainbow ? _fxc.setHSL((performance.now() / 700) % 1, 1, 0.68).getHex() : 0;
  return { tracer: c || f.tracer, flash: lv >= 3 ? c || f.flash : FX0.flash, tint: lv >= 3, kill: lv >= 4 ? c || f.flash : 0, kind: f.bundle ? f.sfx : '' };
}
const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
flash.visible = false;
const vmFlash = new THREE.PointLight(0xffc27a, 0, 2.6, 2); // 총구 불꽃이 손에 든 총을 비춤
vm.add(flash, vmFlash);

// ───────────── 효과 (예광탄·탄흔·불티·폭발·연막은 fx.js) ─────────────
const HDRK = postOn && post.hdr ? 2.2 : 1; // 빛나는 것의 밝기 배수 (빛이 번지도록)
initFx(scene, camera, { hdr: postOn && post.hdr, low: gfx === 'low' });
// 1인칭 탄피
const casings = [];
function updateCasings(dt) {
  for (const c of casings) { if (c.life <= 0) continue; c.life -= dt; c.v[1] -= 9 * dt; c.m.position.x += c.v[0] * dt; c.m.position.y += c.v[1] * dt; c.m.position.z += c.v[2] * dt; c.m.rotation.x += dt * 14; c.m.rotation.z += dt * 9; if (c.life <= 0) c.m.visible = false; }
}
// 맞은 곳의 재질: 0 돌·콘크리트 · 1 쇠 · 2 나무 · 3 천 · 4 유리 · 5 땅
const MATK = {};
for (const [k, list] of [[1, 'metal metalStep fence car bus truckCab truckBox trainA trainB forklift flatbed machine vent crane shipHull cR cB cG cY cW cO barrel silo bollard shelf wreck plane pump'], [2, 'crate wood trunk plank plankDark floorWood cabinet tableTop log shelfLow barnRed boat'], [3, 'tentCloth cloth pillow bed hay'], [4, 'cityGlass glassPane']]) for (const m of list.split(' ')) MATK[m] = k;
let lastImpSfx = 0;
function sfxImpact(k, x, z) {
  const now = performance.now();
  if (!audioOn() || now - lastImpSfx < 55) return;
  const [v, pan] = heard(x, z, 38);
  if (v < 0.05) return;
  lastImpSfx = now;
  playImpact(k, v, pan);
}
function impact(p, col = 0xffd890, tint = false, kind = '') { // 벽·바닥에 맞은 자리: 재질에 따라 탄흔, 먼지, 파편, 소리가 다름
  const wl = waterAt(p[0], p[2]);
  if (p[1] < wl - 0.02) { // 물: 물기둥과 물방울
    const q = [p[0], wl + 0.02, p[2]];
    if (Math.hypot(p[0] - camera.position.x, p[2] - camera.position.z) < 90) { puff(q, [0, 2.2, 0], 0xeaf6ff, 0.9, 0.4, 0.75); emitChip(q, [0, 1, 0], 7, 3.2, 0xdff1ff, 0.5, 9, 0.35); }
    sfxImpact(3, p[0], p[2]);
    return;
  }
  const n = hitNormal(p);
  if (!n) return;
  const k = HIT_M ? MATK[HIT_M] || 0 : 5, near = Math.hypot(p[0] - camera.position.x, p[2] - camera.position.z) < 75;
  const o = [p[0] + n[0] * 0.1, p[1] + n[1] * 0.1, p[2] + n[2] * 0.1];
  if (near) {
    const gc = MAPS[curMap].br ? 0x9a8660 : MAPS[curMap].key === 'town' ? 0xc9ab7c : MAPS[curMap].key === 'castle' ? 0x8a8f66 : 0x8a8d92;
    if (k === 1) { emitSpark(p, n, 7, 5.5, 0xffd27a, 0.28, 11, 0.7); puff(o, [n[0] * 0.6, 0.3, n[2] * 0.6], 0x6c6f74, 0.55, 0.3, 0.4); }
    else if (k === 2) { emitChip(p, n, 6, 2.6, 0xc7a06a, 0.5, 8); puff(o, [n[0], 0.3, n[2]], 0xc9a877, 0.8, 0.45, 0.5); }
    else if (k === 3) puff(o, [n[0] * 0.5, 0.2, n[2] * 0.5], 0xd8d2c4, 0.6, 0.4, 0.45);
    else if (k === 4) { emitSpark(p, n, 5, 3, 0xcfeaff, 0.3, 9); emitChip(p, n, 4, 2.2, 0xe8f6ff, 0.45, 9); }
    else if (k === 5) { emitChip(p, n, 7, 3.2, gc, 0.55, 9, 0.5); puff(o, [n[0] * 0.4, 1.3, n[2] * 0.4], gc, 1.25, 0.6, 0.6); }
    else { emitChip(p, n, 5, 2.8, 0x9a9c9f, 0.45, 9); if (Math.random() < 0.35) emitSpark(p, n, 2, 4, 0xffd27a, 0.18, 11); puff(o, [n[0] * 1.1, 0.35, n[2] * 1.1], 0xb0b2b5, 1, 0.5, 0.55); }
  }
  if (k !== 3) {
    hole(p, n, k);
  }
  if (tint || k <= 1) spark(p[0] + n[0] * 0.05, p[1] + n[1] * 0.05, p[2] + n[2] * 0.05, tint ? 0.42 : k === 1 ? 0.34 : 0.22, col, 0.09);
  if (kind && near) impactFx(kind, p, n, col);
  sfxImpact(k, p[0], p[2]);
}
// ───────────── 얼티밋 번들 효과 (스킨마다 착탄·총구·처치 모습이 다름) ─────────────
const STARC = [0xff8ad8, 0x8ad8ff, 0xb9ffd8, 0xffe28a, 0xc08bff];
function impactFx(kind, p, n, col) {
  const [x, y, z] = [p[0] + n[0] * 0.06, p[1] + n[1] * 0.06, p[2] + n[2] * 0.06];
  if (kind === 'prime') { emitSpark(p, n, 6, 3.5, 0x7fdcff, 0.35, 4); glow(x, y, z, 0x7fdcff, 0.08, 0.45, 0.18); }
  else if (kind === 'blade') { emitSpark(p, n, 8, 5, 0xffc46a, 0.4, 10); emitChip(p, n, 3, 2, 0xb3121c, 0.7, 3); }
  else if (kind === 'shard') { emitChip(p, n, 6, 3, 0x18141f, 0.6, 9); emitSpark(p, n, 4, 3, 0xc89cff, 0.3, 6); glow(x, y, z, 0xa060ff, 0.05, 0.3, 0.14); }
  else if (kind === 'crystal') { emitChip(p, n, 6, 3, 0xe8f8ff, 0.6, 8); spark(x, y, z, 0.55, 0xffffff, 0.14); }
  else if (kind === 'reactor') { glow(x, y, z, 0xffb050, 0.12, 0.7, 0.26, { c1: 0xff3000 }); emitSpark(p, n, 8, 4, 0xff7a20, 0.45, 8); }
  else if (kind === 'star') { for (let i = 0; i < 3; i++) emitSpark(p, n, 3, 3.5, STARC[(Math.random() * 5) | 0], 0.45, 2); spark(x, y, z, 0.4, col, 0.12); }
  else if (kind === 'void') { glow(x, y, z, 0xa040ff, 0.6, 0.04, 0.26); emitSpark(p, n, 5, 1.6, 0xb05cff, 0.4, -2); }
  else if (kind === 'race') { emitSpark(p, n, 8, 6, 0xff5a4a, 0.3, 10, 0.4); spark(x, y, z, 0.45, 0xff3020, 0.1); }
  else if (kind === 'beast') { emitSpark(p, n, 6, 4, 0xffa02a, 0.35, 8); emitChip(p, n, 3, 2, 0x17110c, 0.5, 8); glow(x, y, z, 0xb6ff3a, 0.05, 0.3, 0.14); }
  else if (kind === 'petal') { emitChip(p, n, 6, 1.6, 0xffc0d8, 1.2, 1.5, 1); spark(x, y, z, 0.4, 0xff8ab8, 0.12); }
  else if (kind === 'frost') { emitChip(p, n, 6, 3, 0xd8f4ff, 0.7, 9); glow(x, y, z, 0x8fd8ff, 0.08, 0.5, 0.2); }
  else if (kind === 'cyber') { emitSpark(p, n, 5, 4, 0x19e3ff, 0.3, 6); emitSpark(p, n, 4, 4, 0xff3df0, 0.3, 6); glow(x, y, z, 0x19e3ff, 0.05, 0.35, 0.12); }
  else if (kind === 'magma') { glow(x, y, z, 0xffb050, 0.15, 0.6, 0.3, { c1: 0xc02000 }); emitSpark(p, n, 7, 3, 0xff7a1a, 0.6, 9); puff([x, y, z], [n[0] * 0.5, 0.6, n[2] * 0.5], 0x2a2018, 0.5, 0.6, 0.5); }
  else if (kind === 'royal') { emitSpark(p, n, 9, 4.5, 0xffd84a, 0.45, 9); spark(x, y, z, 0.45, 0xfff0a0, 0.12); }
  else if (kind === 'cosmic') { glow(x, y, z, 0xc08cff, 0.4, 0.04, 0.24); for (let i = 0; i < 2; i++) emitSpark(p, n, 3, 2.5, [0x7a3cff, 0xff46be][i], 0.45, 1); }
  else if (kind === 'prism') { for (let i = 0; i < 3; i++) emitSpark(p, n, 3, 3.5, STARC[(Math.random() * 5) | 0], 0.4, 4); glow(x, y, z, 0xffffff, 0.05, 0.35, 0.14); }
  else if (kind === 'spooky') { emitSpark(p, n, 5, 3, 0xa64dff, 0.4, 3); emitSpark(p, n, 4, 3, 0xff8a1a, 0.4, 3); glow(x, y, z, 0x9dff3a, 0.05, 0.3, 0.16); }
  else if (kind === 'mecha') { glow(x, y, z, 0xffa050, 0.1, 0.55, 0.2); emitSpark(p, n, 8, 5, 0xff6a1a, 0.35, 9); emitChip(p, n, 2, 2, 0xf4f3ef, 0.5, 9); }
  else if (kind === 'dragon') { glow(x, y, z, 0xff4020, 0.15, 0.7, 0.28, { c1: 0x600000 }); emitSpark(p, n, 9, 4, 0xff2a10, 0.5, 6); puff([x, y, z], [n[0] * 0.4, 0.5, n[2] * 0.4], 0x1a0c0a, 0.5, 0.6, 0.5); }
  else if (kind === 'phoenix') { glow(x, y, z, 0xffd080, 0.12, 0.6, 0.26, { c1: 0xff3000 }); emitSpark(p, n, 9, 4, 0xffb040, 0.55, -1); }
  else if (kind === 'aqua') { glow(x, y, z, 0x4ae8ff, 0.08, 0.5, 0.2); emitSpark(p, n, 7, 4, 0x4ae8ff, 0.35, 6); emitChip(p, n, 3, 2, 0xe0f8ff, 0.6, 6); }
}
function muzzleFx(kind, a, d, col) { // 총구에서 스킨 색 불티가 튐 (3인칭·1인칭 공통, 세계 좌표)
  if (!kind) return;
  emitSpark(a, d, kind === 'reactor' ? 5 : 3, 2.4, col, 0.18, kind === 'void' ? -3 : 2, 0.35);
  if (kind === 'void' || kind === 'reactor') glow(a[0] + d[0] * 0.15, a[1] + d[1] * 0.15, a[2] + d[2] * 0.15, col, 0.25, 0.05, 0.12);
}
function bundleKill(kind, x, y, z, col) {
  const gy = Math.min(y - 1.05, groundAt(x, z)) + 0.06, up = [0, 1, 0];
  lightFlash(x, y, z, col, 60, 12, 0.35);
  if (kind === 'prime') { shock(x, gy, z, 0x7fdcff, 4, 0.5); emitSpark([x, y, z], up, 34, 5, 0x7fdcff, 0.9, 3, 1); for (let i = 0; i < 4; i++) glow(x, y - 0.6 + i * 0.35, z, 0x9fe6ff, 0.5, 0.05, 0.5, { wait: i * 0.05, v: [0, 2.2, 0], drag: 0.5 }); emitSpark([x, y, z], up, 10, 3, 0xffd27a, 0.7, 4, 1); }
  else if (kind === 'blade') { glow(x, y, z, 0xffd890, 1.4, 0.1, 0.3); emitSpark([x, y, z], [1, 0.2, 0], 26, 7, 0xffc46a, 0.6, 6, 0.5); emitSpark([x, y, z], [-1, 0.2, 0], 26, 7, 0xffc46a, 0.6, 6, 0.5); emitChip([x, y + 0.3, z], up, 30, 3, 0xc8141e, 2.2, 1.2, 1); }
  else if (kind === 'shard') { shock(x, gy, z, 0xa060ff, 3.5, 0.4); emitChip([x, y, z], up, 34, 6, 0x120f18, 1.2, 9, 1); emitSpark([x, y, z], up, 24, 5, 0xc89cff, 0.7, 5, 1); glow(x, y, z, 0xffffff, 0.3, 1.6, 0.16); }
  else if (kind === 'crystal') { shock(x, gy, z, 0xe0f4ff, 3.5, 0.45); emitChip([x, y, z], up, 44, 5, 0xe8f8ff, 1.3, 7, 1); for (let i = 0; i < 7; i++) setTimeout(() => spark(x + (Math.random() - 0.5) * 1.4, y + (Math.random() - 0.3) * 1.2, z + (Math.random() - 0.5) * 1.4, 0.7, 0xffffff, 0.16), i * 60); }
  else if (kind === 'reactor') { glow(x, y, z, 0xfff0c0, 0.4, 3.4, 0.45, { c1: 0xff3000 }); glow(x, y + 0.3, z, 0xffa040, 0.6, 2.4, 0.6, { c1: 0x801000, v: [0, 1.5, 0], wait: 0.06 }); shock(x, gy, z, 0xff7a20, 6, 0.5); emitSpark([x, y, z], up, 40, 8, 0xff7a20, 0.9, 9, 1); puff([x, y + 0.4, z], [0, 1.4, 0], 0x2a2420, 2.2, 1.4, 0.6); }
  else if (kind === 'star') { for (let i = 0; i < 5; i++) { emitSpark([x, y, z], up, 12, 5, STARC[i], 1.1, 2, 1); glow(x, y, z, STARC[i], 0.2, 0.05, 0.9, { v: [(Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3], drag: 1, wait: i * 0.04 }); } shock(x, gy, z, 0xffffff, 3.5, 0.5); }
  else if (kind === 'void') { // 빨려 들어갔다가 터짐
    glow(x, y, z, 0xa040ff, 2.6, 0.05, 0.34); emitSpark([x, y, z], up, 16, 1.2, 0xb05cff, 0.35, -6, 1);
    setTimeout(() => { glow(x, y, z, 0xd08aff, 0.1, 2.6, 0.32, { c1: 0x6020ff }); shock(x, gy, z, 0xa040ff, 5, 0.45); emitSpark([x, y, z], up, 36, 7, 0xb05cff, 0.8, 4, 1); emitSpark([x, y, z], up, 16, 6, 0xff40b0, 0.7, 4, 1); puff([x, y, z], [0, 0.6, 0], 0x14081e, 2, 1.2, 0.7); }, 330);
  }
  else if (kind === 'race') { shock(x, gy, z, 0xff3020, 4.5, 0.4); emitSpark([x, y, z], [1, 0.1, 0], 30, 9, 0xff5a4a, 0.5, 8, 0.3); emitSpark([x, y, z], [-1, 0.1, 0], 30, 9, 0xffffff, 0.5, 8, 0.3); for (let i = 0; i < 3; i++) glow(x, y - 0.4 + i * 0.4, z, 0xff3020, 0.6, 0.05, 0.3, { wait: i * 0.04 }); }
  else if (kind === 'beast') { glow(x, y, z, 0xffa02a, 0.3, 2.2, 0.3, { c1: 0x803000 }); for (const sx of [-0.25, 0, 0.25]) emitSpark([x + sx, y + 0.4, z], [0, -1, 0], 10, 6, 0xffa02a, 0.5, 4, 0.15); emitChip([x, y, z], up, 20, 4, 0x17110c, 1, 8, 1); glow(x, y + 0.2, z, 0xb6ff3a, 0.4, 0.05, 0.6); }
  else if (kind === 'petal') { emitChip([x, y + 0.4, z], up, 50, 3.2, 0xffc0d8, 2.6, 0.9, 1); emitChip([x, y + 0.4, z], up, 20, 3, 0xffffff, 2.4, 0.9, 1); glow(x, y, z, 0xff8ab8, 0.3, 2, 0.4); shock(x, gy, z, 0xff9ac0, 3.5, 0.6); }
  else if (kind === 'frost') { shock(x, gy, z, 0x8fd8ff, 4, 0.5); emitChip([x, y, z], up, 40, 5, 0xd8f4ff, 1.2, 8, 1); glow(x, y, z, 0xe0f8ff, 0.3, 2.4, 0.3); puff([x, gy + 0.3, z], [0, 0.4, 0], 0xe8f6ff, 2.2, 1.2, 0.5); }
  else if (kind === 'cyber') { shock(x, gy, z, 0x19e3ff, 4, 0.4); shock(x, gy + 0.02, z, 0xff3df0, 2.4, 0.5); for (let i = 0; i < 6; i++) glow(x, y - 0.8 + i * 0.3, z, i % 2 ? 0xff3df0 : 0x19e3ff, 0.9, 0.1, 0.25, { wait: i * 0.04 }); emitSpark([x, y, z], up, 30, 6, 0x19e3ff, 0.6, 5, 1); }
  else if (kind === 'magma') { glow(x, y, z, 0xffe0a0, 0.4, 3, 0.45, { c1: 0xb02000 }); shock(x, gy, z, 0xff5a10, 5, 0.6); emitSpark([x, y, z], up, 44, 7, 0xff7a1a, 1.2, 10, 1); puff([x, y + 0.5, z], [0, 1.6, 0], 0x1c1612, 2.4, 1.8, 0.7); }
  else if (kind === 'royal') { emitSpark([x, y + 0.3, z], up, 50, 6, 0xffd84a, 1.3, 9, 1); glow(x, y + 0.6, z, 0xfff0a0, 0.3, 1.6, 0.6, { v: [0, 1.2, 0] }); shock(x, gy, z, 0xffd84a, 4, 0.5); for (let i = 0; i < 5; i++) setTimeout(() => spark(x + (Math.random() - 0.5), y + 0.6 + Math.random() * 0.6, z + (Math.random() - 0.5), 0.6, 0xff2040, 0.15), i * 70); }
  else if (kind === 'cosmic') { glow(x, y, z, 0xc08cff, 2.4, 0.05, 0.35); setTimeout(() => { glow(x, y, z, 0xff46be, 0.1, 2.2, 0.35, { c1: 0x4020ff }); emitSpark([x, y, z], up, 30, 6, 0xffffff, 1, 2, 1); emitSpark([x, y, z], up, 20, 5, 0x7a3cff, 1, 2, 1); shock(x, gy, z, 0xc08cff, 4.5, 0.5); }, 300); }
  else if (kind === 'prism') { for (let i = 0; i < 5; i++) { emitSpark([x, y, z], up, 10, 6, STARC[i], 0.9, 4, 1); glow(x, y + 0.2 * i - 0.4, z, STARC[i], 0.7, 0.05, 0.35, { wait: i * 0.05 }); } shock(x, gy, z, 0xffffff, 4, 0.5); }
  else if (kind === 'mecha') { glow(x, y, z, 0xfff0d0, 0.3, 2.6, 0.32, { c1: 0xff5a00 }); shock(x, gy, z, 0xff6a1a, 5, 0.45); shock(x, gy + 0.02, z, 0xffffff, 3, 0.35); emitSpark([x, y, z], up, 40, 8, 0xff6a1a, 0.8, 8, 1); emitChip([x, y, z], up, 14, 5, 0xf4f3ef, 1, 9, 1); for (let i = 0; i < 4; i++) glow(x, y - 0.6 + i * 0.4, z, 0xd0141e, 0.7, 0.1, 0.3, { wait: 0.05 + i * 0.04 }); }
  else if (kind === 'dragon') { glow(x, y, z, 0xff6040, 0.4, 3.2, 0.5, { c1: 0x600000 }); for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283; glow(x, y, z, 0xff3010, 0.8, 0.2, 0.6, { v: [Math.cos(a) * 4, 1.5, Math.sin(a) * 4], drag: 2, c1: 0x400000 }); } shock(x, gy, z, 0xff2010, 6, 0.55); emitSpark([x, y, z], up, 44, 7, 0xff2a10, 1, 6, 1); puff([x, y + 0.5, z], [0, 1.2, 0], 0x140808, 2.4, 1.6, 0.7); }
  else if (kind === 'phoenix') { glow(x, y, z, 0xffe0a0, 0.4, 3, 0.5, { c1: 0xff4000 }); for (const s2 of [-1, 1]) emitSpark([x, y + 0.2, z], [s2, 0.8, 0], 30, 6, 0xffb040, 1.2, 1, 0.4); glow(x, y + 0.6, z, 0xffa040, 0.6, 1.8, 1, { v: [0, 2, 0], drag: 0.8, c1: 0xff2000 }); shock(x, gy, z, 0xffb040, 5, 0.6); }
  else if (kind === 'aqua') { glow(x, y, z, 0xe0faff, 0.3, 2.4, 0.3, { c1: 0x2a80ff }); shock(x, gy, z, 0x4ae8ff, 5, 0.45); shock(x, gy + 0.02, z, 0x1f5fe0, 3, 0.55); emitSpark([x, y, z], up, 36, 6, 0x4ae8ff, 0.8, 6, 1); puff([x, gy + 0.2, z], [0, 0.5, 0], 0xd8f4ff, 2, 1, 0.45); }
  else if (kind === 'spooky') { glow(x, y, z, 0x9dff3a, 0.3, 2.2, 0.4, { c1: 0x4a1080 }); emitChip([x, y + 0.3, z], up, 24, 4, 0x07050a, 1.4, 2, 1); emitSpark([x, y, z], up, 24, 4, 0xff8a1a, 0.9, 2, 1); glow(x, y + 0.3, z, 0xa64dff, 0.6, 1.4, 1.2, { v: [0, 1.4, 0], drag: 0.6 }); shock(x, gy, z, 0xa64dff, 3.5, 0.6); }
}
function skinEmblem(sk) { // 내가 얼티밋 스킨으로 처치하면 조준점 아래에 스킨 엠블럼이 튀어나옴
  const e = $('skKill'); if (!e || !SKINS[sk]) return;
  e.firstElementChild.style.background = SWATCH[SKINS[sk].id] || '#444'; e.lastElementChild.textContent = SKINS[sk].name;
  e.classList.remove('on'); void e.offsetWidth; e.classList.add('on');
}
// 스킨 4레벨 처치 효과: 스킨 색 불티가 터져 나옴
function killFx(x, y, z, hex) {
  emitSpark([x, y, z], [0, 0.6, 0], 30, 4.5, hex, 0.8, 5, 1);
  for (let i = 0; i < 2; i++) spark(x, y + i * 0.3, z, 1.5 - i * 0.5, hex, 0.16);
  lightFlash(x, y, z, hex, 30, 10, 0.2);
}
let lastWhiz = 0;
function whiz(a, e) { // 적의 총알이 귀 옆을 스치면 휙 소리
  const now = performance.now();
  if (!audioOn() || !me.alive || now - lastWhiz < 90) return;
  const dx = e[0] - a[0], dy = e[1] - a[1], dz = e[2] - a[2], l2 = dx * dx + dy * dy + dz * dz;
  if (l2 < 9) return;
  const t = ((eye[0] - a[0]) * dx + (eye[1] - a[1]) * dy + (eye[2] - a[2]) * dz) / l2;
  if (t < 0.05 || t > 1) return;
  const d = Math.hypot(a[0] + dx * t - eye[0], a[1] + dy * t - eye[1], a[2] + dz * t - eye[2]);
  if (d > 2.4) return;
  lastWhiz = now;
  const k = 1 - d / 2.4, rx = Math.cos(me.yaw) * (a[0] + dx * t - eye[0]) - Math.sin(me.yaw) * (a[2] + dz * t - eye[2]);
  sfxWhiz(0.08 + k * 0.14, clamp(rx * 1.4, -1, 1));
  me.shake = Math.max(me.shake, 0.08 + k * 0.1);
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
  if (hitBox(nx, nz)) { if (Math.abs(car.sp) > 6) { me.shake = Math.max(me.shake, 0.35); sfxStep(0.3, 0, 1); } car.sp *= -0.25; }
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

// ───────────── 소리 (만드는 쪽은 audio.js) ─────────────
let volume = parseFloat(store.get('vol', '0.8'));
if (!(volume >= 0 && volume <= 1)) volume = 0.8;
setVolume(volume);
function heard(x, z, range) { // 내 위치 기준 [크기 0~1, 좌우]
  const dx = x - camera.position.x, dz = z - camera.position.z, d = Math.hypot(dx, dz);
  const right = Math.cos(me.yaw) * dx - Math.sin(me.yaw) * dz;
  return [clamp(1 - d / range, 0, 1), d > 0.5 ? clamp(right / d, -1, 1) * 0.8 : 0];
}

// ───────────── 상태 ─────────────
const me = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, hp: 100, alive: false, w: W_PISTOL, lastW: W_KNIFE, burstLeft: 0, burstAt: 0, spin: 0, ammo: WEAPONS.map((w) => w.mag), reloadEnd: 0, lastShot: 0, shotN: 0, onGround: true, prot: false, scoped: false, kickAnim: 0, bob: 0, draw: 0, swx: 0, swy: 0, crouch: false, sprint: false, slideT: 0, slx: 0, slz: 0, drop: false, inspAt: -1e9, drawFx: -1e9, rackN: 0, eyeH: PLAYER.eye, adsP: 0, rqP: 0, rqY: 0, rcP: 0, rcY: 0, bloom: 0, snipeQ: 0, snipeHold: false, sprT: 0, stepT: 0, shake: 0, flashUntil: 0, flashDur: 1, land: 0, vmY: 0, vmR: 0 };
const inv = { money: 0, prim: 0, side: W_PISTOL, armor: 0, n: [0, 0, 0], med: 0 };
const others = new Map(), _mz = new THREE.Vector3();
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
  world.setZoneColors(TEAM_COL[west], TEAM_COL[west ^ 1]);
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
  ws.onopen = () => { timeOff = null; send({ t: 'join', name: lastJoin.name, room: lastJoin.room, mode: lastJoin.mode, map: lastJoin.map, bot: lastJoin.bot, sk: lastJoin.sk, att: lastJoin.att, sl: lastJoin.sl, op: lastJoin.op, codes: lastJoin.codes, paint: lastJoin.paint || undefined }); };
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
      $('menu').classList.add('hide'); $('hud').classList.remove('hide'); $('net').classList.add('hide'); $('board').classList.add('hide'); applyLayout();
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
        if (!o || o.team !== tm || o.name !== p.name || o.op !== (p.op || 0)) { if (o) scene.remove(o.g); others.set(p.id, makeAvatar(mode === 'br' ? { id: p.id, name: p.name, team: 1, ci: p.id % BR_COL.length, sk: p.sk, att: p.att, sl: p.sl, bot: p.bot, op: p.op } : p)); }
      }
      if (!$('board').classList.contains('hide')) drawBoard();
      break;
    }
    case 'inv': {
      const primChanged = inv.prim !== m.prim, sideChanged = inv.side !== m.side;
      inv.money = m.money; inv.prim = m.prim; inv.side = m.side; inv.armor = m.armor; inv.n = m.n; inv.med = m.med || 0;
      if (primChanged && inv.prim) { me.ammo[inv.prim] = ew(inv.prim).mag; if (me.alive) setWeapon(inv.prim, true); }
      if (sideChanged) { me.ammo[inv.side] = ew(inv.side).mag; if (me.alive && !(primChanged && inv.prim)) setWeapon(inv.side, true); }
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
        me.ammo = WEAPONS.map((w, i) => ew(i).mag); me.flashUntil = 0; setScope(false); me.rqP = me.rqY = me.rcP = me.rcY = me.bloom = 0;
        me.burstLeft = 0; me.spin = 0;
        setWeapon(inv.prim || inv.side, true);
        $('dead').classList.add('hide');
      } else { const o = others.get(m.id); if (o) o.buf.length = 0; }
      break;
    case 'shot': {
      const o = others.get(m.id);
      if (!o) break;
      const quiet = WEAPONS[m.w].quiet || WEAPONS[m.w].melee || m.q;
      if (!quiet) o.shotAt = performance.now(); // 소음 무기는 미니맵에 안 뜸
      const d = dirFrom(o.yaw, o.pitch);
      const a = [o.x + d[0] * 0.9, o.y + (o.c ? 0.9 : 1.3), o.z + d[2] * 0.9];
      if (o.alive && !WEAPONS[m.w].melee) { rigShot(o, quiet); if (rigMuzzle(o, _mz)) { a[0] = _mz.x; a[1] = _mz.y; a[2] = _mz.z; } if (!quiet && Math.hypot(o.x - camera.position.x, o.z - camera.position.z) < 70) lightFlash(a[0], a[1], a[2], 0xffc27a, 20, 12, 0.07); }
      const osk = o.sk ? o.sk[m.w] : 0, ofx = fxOf(osk, o.sl ? o.sl[osk] : 1);
      if (ofx.kind && o.alive && !WEAPONS[m.w].melee && Math.hypot(o.x - camera.position.x, o.z - camera.position.z) < 60) muzzleFx(ofx.kind, a, d, ofx.flash);
      for (const e of m.e) { addTracer(a, e, ofx === FX0 ? 0xfff1b0 : ofx.tracer, ofx === FX0 ? 0.1 : ofx.kind ? 0.16 : 0.14, ofx.kind ? 1.5 : 1); if (ofx.kind) addTracer(a, e, 0xffffff, 0.16, 0.45); impact(e, ofx.flash, ofx.tint, ofx.kind); if (o.team !== myTeam) whiz(a, e); }
      const [v, pan] = heard(o.x, o.z, quiet ? 26 : mode === 'br' ? 220 : 90);
      sfxShot(m.w, Math.min(1, v * 1.5) * 0.55, pan, 1 - v, Math.min(0.6, Math.hypot(o.x - camera.position.x, o.z - camera.position.z) / 340), !!m.q); // 멀수록 먹먹하고 늦게 들림
      if (ofx.kind) sfxSkin(ofx.kind, 'shot', Math.min(1, v * 1.5) * (m.q ? 0.25 : 0.55), pan, 1 - v, Math.min(0.6, Math.hypot(o.x - camera.position.x, o.z - camera.position.z) / 340));
      break;
    }
    case 'hit':
      if (m.by === myId && m.to !== myId) {
        const h = $('hitm');
        h.classList.toggle('head', m.head); h.classList.add('on');
        clearTimeout(h._t); h._t = setTimeout(() => h.classList.remove('on'), 90);
        sfxUI(m.head ? 'head' : 'hit');
        if (myOp || (SKINS[mySk[me.w]] && SKINS[mySk[me.w]].bundle)) sfxSample('hit', m.head ? 0.55 : 0.4, 0, m.head ? 1.12 : 1); // 스킨 팩 적중음
        const ho = others.get(m.to); if (ho) { hitBurst(ho.x, ho.y + (m.head ? 1.6 : 1.15), ho.z); rigFlinch(ho); }
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
        sfxUI('hurt');
        if (m.by !== myId && !m.zone) { me.rqP += 0.006 + Math.random() * 0.006; me.rqY += (Math.random() - 0.5) * 0.012; } // 맞으면 조준이 살짝 튐
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
      { // 쓰러지는 방향: 앞에서 맞으면 뒤로, 뒤에서 맞으면 앞으로, 옆에서 맞으면 옆으로
        const vo = others.get(m.to), ko = m.by === myId ? me : others.get(m.by);
        if (vo && ko && ko !== vo) { const dx = vo.x - ko.x, dz = vo.z - ko.z, l = Math.hypot(dx, dz) || 1, dot = (-Math.sin(vo.yaw) * dx - Math.cos(vo.yaw) * dz) / l; vo.fallDir = dot < -0.45 ? 0 : dot > 0.45 ? 1 : 2; }
        else if (vo) vo.fallDir = 0;
      }
      { // 스킨 4레벨부터 처치 효과
        const vo = m.to === myId ? me : others.get(m.to), ko = others.get(m.by), ksk = WEAPONS[m.w] ? (m.by === myId ? mySk[m.w] : ko && ko.sk ? ko.sk[m.w] : 0) : 0;
        const kfx = ksk ? fxOf(ksk, m.by === myId ? myLv(ksk) : ko && ko.sl ? ko.sl[ksk] : 1) : FX0;
        if (vo && kfx.kill && m.by !== m.to) {
          if (kfx.kind) { bundleKill(kfx.kind, vo.x, vo.y + 1.1, vo.z, kfx.kill); const [kv, kp] = heard(vo.x, vo.z, 60); sfxSkin(kfx.kind, 'kill', m.by === myId ? 0.8 : kv * 0.6, m.by === myId ? 0 : kp); if (m.by === myId) skinEmblem(ksk); }
          else killFx(vo.x, vo.y + 1.1, vo.z, kfx.kill);
        }
      }
      if (m.by === myId && b && m.to !== myId) {
        gainSkinXp(m.w, m.head);
        { const h = $('hitm'); h.classList.add('on', 'kill'); clearTimeout(h._t); h._t = setTimeout(() => h.classList.remove('on', 'kill'), 280); } // 처치: 붉고 큰 표시
        const nowT = performance.now();
        multiKill = nowT - lastKillAt < 4500 ? multiKill + 1 : 1; lastKillAt = nowT;
        const streak = ['', '', '더블 킬! ', '트리플 킬! ', '쿼드라 킬! '][multiKill] ?? '대활약! ';
        const vo = others.get(m.to), kd = vo ? Math.round(Math.hypot(vo.x - me.x, vo.z - me.z)) : 0;
        banner(`${streak}${b.name} 처치${m.head ? ' · 헤드샷!' : ''}${mode === 'bomb' ? ` · +${ECON.kill}` : ''}${mode === 'br' && kd > 3 ? ` · ${kd}m` : ''}`, multiKill > 1 ? 0xff8a3d : 0xffd23f);
        sfxUI(multiKill > 1 ? 'multi' : 'kill');
        if (myOp) sfxSample('kill', 0.7);
        if (multiKill >= 3) sfxSample('ultimate', 0.85, 0, 1, 0.15); // 트리플 킬부터 궁극기 소리
      }
      break;
    }
    case 'fx': {
      const [v, pan] = heard(m.x, m.z, 70);
      if (m.k === 0) {
        explode(m.x, m.y, m.z, 0, groundAt(m.x, m.z)); sfxBoom(v * 0.9, 1.1, pan);
        me.shake = Math.max(me.shake, clamp(1 - Math.hypot(m.x - me.x, m.z - me.z) / 16, 0, 1));
      } else if (m.k === 1) { addSmoke(m.x, m.y, m.z, NADES[1].radius, NADES[1].last, world.night); sfxBoom(v * 0.25, 0.7, pan); }
      else {
        explode(m.x, m.y, m.z, 2); sfxBoom(v * 0.5, 0.5, pan); sfxTone(2400, 0.5, v * 0.25, 'sine', 1800);
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
        sfxUI(mine ? 'win' : 'lose');
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
        clearSmokes();
        const att = myTeam === attack;
        banner(`${m.swap ? '공수 교대 · ' : ''}라운드 ${m.n} · ${att ? '공격: 폭탄을 설치하세요' : '수비: 설치를 막으세요'}`, TEAM_COL[myTeam]);
        if (m.carrier === myId) setTimeout(() => banner('폭탄을 가지고 있습니다 · A 또는 B 지점으로', 0xffd23f), 1900);
        sfxUI('start');
        setTimeout(() => { if (me.alive && phase === 'freeze') openShop(true); }, 300);
      } else {
        score = m.sc;
        const why = { elim: '전멸', time: '시간 종료', boom: '폭탄 폭발', defuse: '폭탄 해체' }[m.why] || '';
        banner(`${TEAM_NAME[m.win]} 라운드 승리 · ${why}`, TEAM_COL[m.win]);
        if (m.why === 'boom') { sfxBoom(); explode(bomb.x, groundAt(bomb.x, bomb.z) + 0.3, bomb.z, 1, groundAt(bomb.x, bomb.z)); me.shake = 1; }
        else sfxUI(m.win === myTeam ? 'win' : 'lose', 0.8);
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
      banner(`${nm} 획득`, 0xffd23f); sfxUI('pickup');
      break;
    }
    case 'br': // 생존전 진행 알림
      if (m.mood !== undefined && m.mood !== world.mood) setMood(m.mood);
      if (m.ev === 'wait') { phase = 'wait'; me.alive = false; me.drop = false; car.id = 0; zone.on = false; matchEnded = false; $('board').classList.add('hide'); $('dead').classList.add('hide'); }
      else if (m.ev === 'air') { banner('보급 상자가 떨어집니다 · 지도의 주황 표시', 0xff8a3d); sfxTone(520, 0.5, 0.12, 'sawtooth', 300); }
      else if (m.ev === 'airland') { const [v] = heard(m.x, m.z, 400); if (v > 0) sfxBoom(v * 0.3, 0.6, 0); }
      else if (m.ev === 'start') { phase = 'live'; brTotal = m.n; matchEnded = false; banner(`생존전 시작 · ${m.n}명 · ${MOODS[world.mood].name}`, 0xffd23f); $('board').classList.add('hide'); clearSmokes(); sfxUI('start'); }
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
      sfxUI('radio');
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
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); // 나타날 때 톡 튀어나오는 움직임을 다시 시작
  clearTimeout(b._t); b._t = setTimeout(() => { b.style.opacity = 0; }, 1700);
}
function feed(a, b, wi, head) {
  const d = document.createElement('div');
  const sa = document.createElement('span'), sb = document.createElement('span');
  sa.className = clsOf(a); sa.textContent = a.name;
  sb.className = clsOf(b); sb.textContent = b.name;
  if (wi === ZONE_WEAPON) d.append(sb, ' ▸ 구역 밖에서 탈락');
  else d.append(sa, ` ▸ ${wi === NADE_WEAPON ? '수류탄' : wi === VEH_WEAPON ? '차량' : WEAPONS[wi] ? WEAPONS[wi].name : '?'}${head ? ' ◎' : ''} ▸ `, sb);
  if (a.id === myId || b.id === myId) d.className = 'mine';
  const f = $('feed');
  f.append(d);
  while (f.children.length > (isTouch ? 2 : 4)) f.firstChild.remove(); // 휴대폰은 화면이 좁아 두 줄만
  setTimeout(() => d.remove(), isTouch ? 3500 : 5000);
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
  camera.far = world.far; camera.updateProjectionMatrix(); buildMiniBase(); applySides(); applyTheme();
}
function leaveCar() { // 차 왼쪽으로 내림 (막혀 있으면 오른쪽, 그것도 막혔으면 제자리)
  const rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw);
  for (const s of [-1.9, 1.9]) { const x = me.x + rx * s, z = me.z + rz * s; if (!collides(x, groundAt(x, z) + 0.05, z)) { me.x = x; me.z = z; break; } }
  me.y = groundAt(me.x, me.z); car.id = 0; car.sp = 0; me.pitch = 0;
}
function hitBurst(x, y, z) {
  for (let i = 0; i < 3; i++) spark(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.3, 0.22 + Math.random() * 0.2, 0xffd890, 0.12);
  emitChip([x, y, z], [0, 0.4, 0], 5, 2.2, 0xe9e4da, 0.4, 9, 1); puff([x, y, z], [0, 0.5, 0], 0xd8d2c8, 0.5, 0.3, 0.35);
}
function clearLoot() { for (const it of loot.values()) if (it.mesh) scene.remove(it.mesh); loot.clear(); nearLoot = null; }
function loadMap(i) { // 다른 맵으로 바꾸기
  if (MAPS[i] && MAPS.indexOf(MAPS[i]) === curMap) return;
  curMap = MAPS[i] ? i : 0;
  setMap(curMap);
  world.dispose();
  world = buildWorld(scene, renderer, worldOpt);
  camera.far = world.far; camera.updateProjectionMatrix();
  buildSites(); buildMiniBase(); applySides(); applyTheme();
  clearHoles(); clearSmokes();
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
  const W = ew(me.w);
  const amN = W.melee ? '근접' : me.reloadEnd ? '장전' : String(me.ammo[me.w]), amT = W.melee ? '' : `/ ${W.mag}`, lowAm = !W.melee && !me.reloadEnd && me.ammo[me.w] <= W.mag * 0.25;
  if (hudCache.amN !== amN) { hudCache.amN = amN; $('ammoN').textContent = amN; }
  if (hudCache.amT !== amT) { hudCache.amT = amT; $('ammoT').textContent = amT; }
  if (hudCache.amL !== lowAm) { hudCache.amL = lowAm; $('ammo').classList.toggle('low', lowAm); }
  const rl = me.alive && !!me.reloadEnd; // 장전하는 동안 조준점 아래에 막대
  if (hudCache.rl !== rl) { hudCache.rl = rl; $('reloadBar').classList.toggle('hide', !rl); }
  if (rl) $('reloadFill').style.width = Math.round(clamp(1 - (me.reloadEnd - now) / W.reload, 0, 1) * 100) + '%';
  const hintA = me.alive && !rl && !W.melee && !car.id && !me.scoped ? (me.ammo[me.w] === 0 ? '탄약 없음' : lowAm ? (isTouch ? '탄약 부족 · 장전' : '탄약 부족 · R 장전') : '') : '';
  if (hudCache.hintA !== hintA) { hudCache.hintA = hintA; $('ammoHint').textContent = hintA; $('ammoHint').classList.toggle('hide', !hintA); }
  if (hudCache.prot !== me.prot) { hudCache.prot = me.prot; $('prot').classList.toggle('hide', !me.prot || !me.alive); }
  if (!me.alive && !matchEnded) setTxt('deadIn', mode === 'bomb' ? '다음 라운드에 다시 참가합니다' : mode === 'br' ? '다음 경기에 다시 참가합니다' : `${Math.max(0, Math.ceil((respawnAt - now) / 1000))}초 뒤 리스폰`);
  const crossOn = me.alive && !car.id;
  if (hudCache.crossA !== crossOn) { hudCache.crossA = crossOn; $('cross').style.opacity = crossOn ? 1 : 0; }
  if (crossOn && !me.scoped) { // 조준점이 탄퍼짐만큼 벌어짐
    const cs = Math.round(clamp((Math.tan(curSpread(W)) / Math.tan((camera.fov * Math.PI) / 360)) * VH + 18, 22, 190) / 2) * 2;
    if (hudCache.cs !== cs) { hudCache.cs = cs; const c = $('cross').style; c.width = c.height = cs + 'px'; c.margin = -cs / 2 + 'px'; }
  }
  const low = me.alive && me.hp > 0 && me.hp < 30;
  if (hudCache.low !== low) { hudCache.low = low; $('lowHp').classList.toggle('on', low); }
  if (low && now - lastBeat > 900) { lastBeat = now; sfxUI('beat'); }
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
  me.w = wi; me.reloadEnd = 0; me.shotN = 0; me.burstLeft = 0; me.spin = 0; me.inspAt = -1e9; me.snipeQ = 0; me.snipeHold = false; me.bloom = 0; setScope(false);
  vmGun(wi);
  guns.forEach((g, i) => { if (g) g.visible = i === wi; });
  if (changed) { me.draw = 1; me.lastShot = Math.max(me.lastShot, performance.now() - WEAPONS[wi].interval + 350); sfxUI('equip'); const ef = fxOf(mySk[wi], myLv(mySk[wi])); me.drawFx = ef.kind ? performance.now() : -1e9; if (ef.kind) { sfxSkin(ef.kind, 'equip', 0.8); setTimeout(() => pulseSkin(), 520); } } // 얼티밋: 꺼내는 소리, 한 바퀴 돌며 올라오고 번쩍임
  refreshInv();
}
function inspect() { if (me.alive && !me.reloadEnd && !me.scoped && !car.id && performance.now() - me.inspAt > 3300) { me.inspAt = performance.now(); const f = fxOf(mySk[me.w], myLv(mySk[me.w])); if (f.kind) setTimeout(() => { if (performance.now() - me.inspAt < 2600) { sfxSkin(f.kind, 'equip', 0.55); pulseSkin(0.8); } }, 1650); } }
function swapWeapon() { setWeapon(owned(me.lastW) && me.lastW !== me.w ? me.lastW : me.w === inv.side ? (inv.prim || W_KNIFE) : inv.side); }
function setScope(on) {
  on = on && me.alive && !me.reloadEnd && !matchEnded && !WEAPONS[me.w].melee; // 칼 빼고 모든 무기 정조준
  me.scoped = on;
  if (on) me.sprint = false;
  $('cross').classList.toggle('hide', on); // 저격총 조준경 화면은 총을 다 올린 뒤에 뜸 (frame 에서 처리)
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
  const W = ew(me.w);
  if (W.melee || me.reloadEnd || me.ammo[me.w] >= W.mag || !me.alive) return;
  setScope(false); me.burstLeft = 0; me.inspAt = -1e9;
  me.reloadEnd = now + W.reload;
  sfxReload('out'); // 탄창을 빼고 → 끼우고 → 노리쇠를 당기는 소리
  const wAt = me.w, end = me.reloadEnd, still = () => me.reloadEnd === end && me.w === wAt;
  setTimeout(() => { if (still()) sfxReload('in'); }, W.reload * 0.55);
  setTimeout(() => { if (still()) { sfxReload('rack', 0.8); if (fxOf(mySk[wAt], 1).kind) pulseSkin(0.7); } }, W.reload * 0.86); // 얼티밋: 장전이 끝나면 번쩍
}
function throwNade(k) {
  if (!me.alive || !canFight() || acting || !(inv.n[k] > 0)) return;
  inv.n[k]--; refreshInv();
  send({ t: 'nade', k, d: dirFrom(me.yaw, clamp(me.pitch + 0.12, -1.4, 1.4)).map((v) => +v.toFixed(4)) });
  me.draw = 0.6; sfxUI('equip', 0.8);
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
const modalOpen = () => ctlOpen || layEdit || shopOpen || !$('leave').classList.contains('hide') || !$('board').classList.contains('hide'); // 창이 떠 있는 동안은 화면을 눌러도 쏘거나 돌지 않음
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
  clearSmokes();
  zoneWall.visible = false; myChute.visible = false; crate.visible = false; bombMesh.visible = false;
  input.fire = false; input.jump = false; input.act = false; input.sprint = false; input.jx = input.jy = 0; keys.clear(); touches.clear(); $('stick').classList.add('hide');
  engineSound(-1); setAmbient(null);
  if (document.pointerLockElement) document.exitPointerLock();
  document.body.classList.remove('playing', 'br', 'sqmini');
  $('menu').classList.remove('hide'); $('menuMsg').textContent = '게임에서 나왔어요.'; loadRooms();
  setMode(selMode);
}
// ───────────── 조작 설정 (감도 · 사격 방식 · 조준 보정 · 자이로 · 버튼 배치) ─────────────
const CTL_DEF = { snipeRel: true, touchDbg: false, touchFix: false, adsFire: false, adsHold: false, alwaysSprint: false, assist: true, sAds: 1, sScope: 1, sFire: 1, gyro: 0, gyroInv: false, opacity: 1, layout: {} };
let ctl = { ...CTL_DEF };
try { ctl = { ...CTL_DEF, ...JSON.parse(store.get('ctl', '{}')) }; if (!ctl.layout || typeof ctl.layout !== 'object') ctl.layout = {}; } catch {}
let ctlOpen = false, layEdit = false, adsByFire = false, assistSlow = 1;
const saveCtl = () => store.set('ctl', JSON.stringify(ctl));
const PADS = () => [...document.querySelectorAll('#hud .pad')];
function applyLayout() { // 저장해 둔 버튼 자리·크기 (화면 크기에 대한 비율)
  document.documentElement.style.setProperty('--padOp', ctl.opacity);
  for (const el of PADS()) {
    const L = ctl.layout[el.id];
    if (!L) { el.style.left = el.style.top = el.style.right = el.style.bottom = el.style.scale = ''; continue; }
    el.style.right = el.style.bottom = 'auto'; el.style.scale = L.s || 1;
    el.style.left = clamp(L.x * VW - el.offsetWidth / 2, 0, VW - el.offsetWidth) + 'px';
    el.style.top = clamp(L.y * VH - el.offsetHeight / 2, 0, VH - el.offsetHeight) + 'px';
  }
}
function syncCtl() {
  for (const b of $('ctlMode').children) b.classList.toggle('on', (b.dataset.v === 'simple') === autoFire);
  for (const b of $('ctlGyro').children) b.classList.toggle('on', +b.dataset.v === ctl.gyro);
  $('ctlAdsFire').checked = ctl.adsFire; $('ctlAdsHold').checked = ctl.adsHold; $('ctlSnipe').checked = ctl.snipeRel; $('ctlSprint').checked = ctl.alwaysSprint; $('ctlAssist').checked = ctl.assist; $('ctlGyroInv').checked = ctl.gyroInv; $('ctlTouchFix').checked = ctl.touchFix; $('ctlTouchDbg').checked = ctl.touchDbg;
  for (const [id, v] of [['ctlSens', sens], ['ctlSAds', ctl.sAds], ['ctlSScope', ctl.sScope], ['ctlSFire', ctl.sFire], ['ctlOp', ctl.opacity]]) { $(id).value = v; $(id + 'V').textContent = Math.round(v * 100) + '%'; }
  $('sens').value = sens;
}
function openCtl(on) {
  ctlOpen = on; $('ctl').classList.toggle('hide', !on);
  if (on) { syncCtl(); input.fire = false; input.jx = input.jy = 0; input.sprint = false; touches.clear(); $('stick').classList.add('hide'); if (document.pointerLockElement) document.exitPointerLock(); }
}
for (const b of $('ctlMode').children) b.onclick = () => { setAuto(b.dataset.v === 'simple'); syncCtl(); };
for (const b of $('ctlGyro').children) b.onclick = () => { ctl.gyro = +b.dataset.v; saveCtl(); syncCtl(); if (ctl.gyro) startGyro(); };
for (const [id, key] of [['ctlAdsFire', 'adsFire'], ['ctlAdsHold', 'adsHold'], ['ctlSnipe', 'snipeRel'], ['ctlSprint', 'alwaysSprint'], ['ctlAssist', 'assist'], ['ctlGyroInv', 'gyroInv'], ['ctlTouchFix', 'touchFix'], ['ctlTouchDbg', 'touchDbg']]) $(id).onchange = (e) => { ctl[key] = e.target.checked; saveCtl(); tdbgShow(); };
$('ctlSens').oninput = (e) => { sens = parseFloat(e.target.value) || 1; store.set('sens', sens); syncCtl(); };
for (const [id, key] of [['ctlSAds', 'sAds'], ['ctlSScope', 'sScope'], ['ctlSFire', 'sFire'], ['ctlOp', 'opacity']]) $(id).oninput = (e) => { ctl[key] = parseFloat(e.target.value) || 1; saveCtl(); syncCtl(); applyLayout(); };
$('ctlX').onclick = () => openCtl(false);
$('ctl').addEventListener('click', (e) => { if (e.target === $('ctl')) openCtl(false); });
$('ctlReset').onclick = () => { ctl = { ...CTL_DEF, layout: {} }; saveCtl(); sens = 1; store.set('sens', sens); applyLayout(); syncCtl(); };
$('openCtl').onclick = () => openCtl(true);
document.addEventListener('keydown', (e) => { if (e.code === 'Escape' && ctlOpen) openCtl(false); });
// 버튼 배치 바꾸기: 버튼을 끌어 옮기고, 고른 버튼의 크기를 바꿈
let laySel = null, layDrag = null;
function setLayEdit(on) {
  layEdit = on; document.body.classList.toggle('layedit', on); $('layBar').classList.toggle('hide', !on);
  if (on) { openCtl(false); $('hud').classList.remove('hide'); if (!joined) $('menu').classList.add('hide'); laySel = null; $('layMsg').textContent = '버튼을 끌어서 옮기세요'; }
  else { for (const el of PADS()) el.classList.remove('sel'); saveCtl(); if (!joined) { $('hud').classList.add('hide'); $('menu').classList.remove('hide'); openCtl(true); } }
  applyLayout();
}
const laySave = (el) => { const r = el.getBoundingClientRect(), s = (ctl.layout[el.id] && ctl.layout[el.id].s) || 1; ctl.layout[el.id] = { x: (r.left + r.width / 2) / VW, y: (r.top + r.height / 2 - VT) / VH, s }; };
document.addEventListener('pointerdown', (e) => {
  if (!layEdit) return;
  const el = e.target.closest ? e.target.closest('#hud .pad') : null; if (!el) return;
  e.preventDefault(); for (const p of PADS()) p.classList.toggle('sel', p === el);
  laySel = el; laySave(el); layDrag = { id: e.pointerId, dx: e.clientX - ctl.layout[el.id].x * VW, dy: e.clientY - VT - ctl.layout[el.id].y * VH };
  $('layMsg').textContent = `[${el.textContent}] 고름 · 크기 ${Math.round(ctl.layout[el.id].s * 100)}%`;
});
document.addEventListener('pointermove', (e) => { if (!layEdit || !layDrag || e.pointerId !== layDrag.id || !laySel) return; const L = ctl.layout[laySel.id]; L.x = clamp((e.clientX - layDrag.dx) / VW, 0.03, 0.97); L.y = clamp((e.clientY - VT - layDrag.dy) / VH, 0.05, 0.95); applyLayout(); });
const layEnd = (e) => { if (layDrag && e.pointerId === layDrag.id) { layDrag = null; saveCtl(); } };
document.addEventListener('pointerup', layEnd); document.addEventListener('pointercancel', layEnd);
const laySize = (k) => { if (!laySel) { $('layMsg').textContent = '먼저 버튼을 눌러 고르세요'; return; } const L = ctl.layout[laySel.id]; L.s = clamp(Math.round((L.s + k) * 20) / 20, 0.6, 1.8); applyLayout(); saveCtl(); $('layMsg').textContent = `[${laySel.textContent}] 고름 · 크기 ${Math.round(L.s * 100)}%`; };
$('laySm').onclick = () => laySize(-0.1); $('layBig').onclick = () => laySize(0.1);
$('layReset').onclick = () => { ctl.layout = {}; laySel = null; for (const el of PADS()) el.classList.remove('sel'); applyLayout(); saveCtl(); $('layMsg').textContent = '처음 배치로 돌렸어요'; };
$('layDone').onclick = () => setLayEdit(false);
$('ctlLayout').onclick = () => setLayEdit(true);
window.addEventListener('resize', applyLayout);
applyLayout();
// 조준 보정 (터치): 조준점 가까이에 보이는 적이 있으면 시점이 느려지고, 쏘거나 조준·이동 중이면 살짝 따라감
const _ad = [0, 0, 0];
function aimAssist(dt) {
  assistSlow = 1;
  if (!isTouch || !ctl.assist || !me.alive || me.drop || modalOpen()) return;
  const f = dirFrom(me.yaw, me.pitch);
  let best = null, ba = 0.12, bd = 0;
  for (const o of others.values()) {
    if (!o.alive || o.team === myTeam || !o.g.visible) continue;
    const dx = o.x - eye[0], dy = o.y + (o.c ? 0.7 : 1.05) - eye[1], dz = o.z - eye[2], d = Math.hypot(dx, dy, dz);
    if (d < 1.5 || d > 55) continue;
    const a = Math.acos(clamp((dx * f[0] + dy * f[1] + dz * f[2]) / d, -1, 1));
    if (a < ba) { ba = a; best = o; bd = d; _ad[0] = dx / d; _ad[1] = dy / d; _ad[2] = dz / d; }
  }
  if (!best || rayWorld(eye, _ad, bd) < bd - 0.6 || smoked(eye, [best.x, best.y + 1.05, best.z])) return; // 벽·연막 뒤는 보정하지 않음
  assistSlow = ba < 0.04 ? 0.5 : ba < 0.07 ? 0.66 : 0.85;
  const now = performance.now(), dragging = now - lookMv[2] < 120, moving = Math.abs(input.jx) + Math.abs(input.jy) > 0.25;
  if (ba < 0.1 && ba > 0.003 && (input.fire || me.scoped || dragging || moving)) {
    const wy = Math.atan2(-_ad[0], -_ad[2]), wp = Math.asin(clamp(_ad[1], -1, 1));
    let dyaw = wy - me.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    const dp = wp - me.pitch, away = dragging && -lookMv[0] * dyaw - lookMv[1] * dp < -0.0005 && Math.hypot(lookMv[0], lookMv[1]) > 3; // 손가락이 적에게서 멀어지는 쪽 → 그대로 둠
    if (!away) { const k = Math.min(1, dt * (me.scoped ? 2.6 : input.fire ? 2.1 : 1.4) * (1 - ba / 0.1)); me.yaw += dyaw * k; me.pitch = clamp(me.pitch + dp * k, -1.45, 1.45); }
  }
}
// 자이로: 기기를 기울여 시점을 돌림 (가로로 쥔 방향에 맞춰 축을 고름)
let gyroOn = false, gyroT = 0;
function onGyro(e) {
  const r = e.rotationRate, now = performance.now(), dt = Math.min(0.05, (now - gyroT) / 1000); gyroT = now;
  if (!r || !joined || !me.alive || modalOpen() || !(ctl.gyro === 2 || (ctl.gyro === 1 && me.scoped))) return;
  const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0, D = Math.PI / 180, inv = ctl.gyroInv ? -1 : 1;
  let yr, pr; // 왼쪽으로 도는 속도, 위로 드는 속도 (rad/s)
  if (ang === 90) { yr = (r.beta || 0) * D; pr = -(r.gamma || 0) * D; } else if (ang === 270 || ang === -90) { yr = -(r.beta || 0) * D; pr = (r.gamma || 0) * D; } else { yr = (r.gamma || 0) * D; pr = (r.beta || 0) * D; }
  if (Math.abs(yr) < 0.012) yr = 0; if (Math.abs(pr) < 0.012) pr = 0; // 손떨림은 무시
  const k = (me.scoped ? 0.7 : 1) * inv * dt;
  me.yaw += yr * k; me.pitch = clamp(me.pitch + pr * k, -1.45, 1.45);
}
function startGyro() {
  if (gyroOn || typeof DeviceMotionEvent === 'undefined') return;
  const go = () => { gyroOn = true; window.addEventListener('devicemotion', onGyro); };
  if (typeof DeviceMotionEvent.requestPermission === 'function') DeviceMotionEvent.requestPermission().then((s) => { if (s === 'granted') go(); }).catch(() => {}); else go();
}
if (ctl.gyro && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission !== 'function') startGyro();
// ───────────── 입력 ─────────────
function pressBtn(b, down, el) {
  if (el && el.classList.contains('pad')) el.classList.toggle('down', down);
  const now = performance.now();
  if (b === 'fire' && isTouch && ctl.snipeRel && WEAPONS[me.w].scope && !shopOpen) { // 저격총: 누르면 조준, 떼면 발사 (짧게 눌렀다 떼도 조준한 뒤 발사)
    if (down) { if (!me.scoped) { setScope(true); me.snipeHold = me.scoped; } else { me.snipeHold = false; input.fire = true; } }
    else { if (me.snipeHold && me.scoped) me.snipeQ = now; me.snipeHold = false; input.fire = false; }
  }
  else if (b === 'fire') { input.fire = down && !shopOpen; if (ctl.adsFire && !WEAPONS[me.w].melee) { if (down && !shopOpen && !me.scoped) { setScope(true); adsByFire = me.scoped; } else if (!down && adsByFire) { adsByFire = false; setScope(false); } } } // 1탭 조준 사격
  else if (b === 'jump') input.jump = down;
  else if (b === 'act') { input.act = down; if (down && mode === 'br') useOrRide(); }
  else if (b === 'heal') { if (down) useMed(); }
  else if (b === 'crouch') { if (down) toggleCrouch(); }
  else if (b === 'reload') { if (down) startReload(now); }
  else if (b === 'scope') { if (ctl.adsHold) setScope(down); else if (down) setScope(!me.scoped); }
  else if (b === 'ctl') { if (!down) openCtl(true); }
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
  else if (b.startsWith('buy:')) { if (down) { send({ t: 'buy', k: b.slice(4) }); sfxUI('buy'); } }
}
function goFullscreen(toggle) {
  try {
    if (document.fullscreenElement) { if (toggle) document.exitFullscreen(); return; }
    const el = document.documentElement;
    const p = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    if (p && p.then) p.then(() => { if (window.innerWidth > window.innerHeight) screen.orientation?.lock?.('landscape').catch(() => {}); }).catch(() => {}); // 세로로 쥐고 있으면 그대로 둠 (아래쪽 절반 모드)
  } catch {}
}
const touches = new Map();
const STICK_R = 52;
// 터치가 잠깐 끊겼다 다시 잡히는 패드를 위한 여유: 끊긴 뒤 0.16초 안에 같은 자리를 다시 누르면 이어진 것으로 봄
const GRACE = 160;
let lookMv = [0, 0, 0]; // 마지막 터치 시점 움직임 (조준 보정이 손가락 방향을 거스르지 않게)
let moveLost = null, fireLostT = 0;
const TAN_HIP = Math.tan((75 * Math.PI) / 360);
// 세로 시야각 배율: 화면이 가로로 길수록 가로 시야가 넓어져 적이 작아짐 → 가로 시야를 PC 100°대·터치 100° 안으로 묶음 (16:9 모니터는 거의 그대로)
function fovK() { const H = ((isTouch ? 100 : 106) * Math.PI) / 360, v = (2 * Math.atan(Math.tan(H) / Math.max(1, camera.aspect)) * 180) / Math.PI; return Math.min(1, v / 75); }
function look(dx, dy, base) {
  const zm = ew(me.w).zoom, adsK = Math.tan(((zm || VM[WEAPONS[me.w].vm].fov) * Math.PI) / 360) / TAN_HIP; // 정조준: 화면이 확대된 만큼만 느려져서 손 감각이 같음
  const k = base * sens * (me.scoped ? (WEAPONS[me.w].scope ? 0.3 * ctl.sScope : adsK * ctl.sAds) : 1) * (input.fire && isTouch ? ctl.sFire : 1) * assistSlow;
  const yd = -dx * k, pd = -dy * k;
  me.yaw += yd; me.pitch = clamp(me.pitch + pd, -1.45, 1.45);
  // 반동 되돌림: 손으로 반대쪽으로 눌러 준 만큼은 사격을 멈춘 뒤 되돌아오지 않게 하고,
  // 손으로 시점을 크게 옮기면(다른 곳을 겨누면) 남은 되돌림을 버림 → 쏘고 나서 화면이 엉뚱한 데로 끌려가지 않음
  if (pd < 0 && me.rcP > 0) me.rcP = Math.max(0, me.rcP + pd);
  if (yd * me.rcY < 0) me.rcY = Math.abs(yd) >= Math.abs(me.rcY) ? 0 : me.rcY + yd;
  const mv = Math.hypot(yd, pd); if (mv > 0) { const f = Math.max(0, 1 - mv * 6); me.rcP *= f; me.rcY *= f; }
  me.swx = clamp(me.swx + dx * k * 0.25, -0.07, 0.07); me.swy = clamp(me.swy + dy * k * 0.25, -0.05, 0.05);
}
document.addEventListener('touchstart', (e) => {
  if (!joined || ctlOpen || layEdit) return; // 설정 창과 버튼 배치 편집은 브라우저 기본 조작 그대로
  e.preventDefault();
  initAudio();
  for (const t of e.changedTouches) {
    const el = t.target.closest ? t.target.closest('[data-btn]') : null;
    const rec = { role: 'look', sx: t.clientX, sy: t.clientY, lx: t.clientX, ly: t.clientY, el, btn: el ? el.dataset.btn : null };
    if (el) { if (rec.btn === 'fire' && fireLostT) { clearTimeout(fireLostT); fireLostT = 0; } pressBtn(rec.btn, true, el); rec.role = rec.btn === 'fire' ? 'look' : 'btn'; }
    else if (modalOpen()) rec.role = 'btn';
    else if (!me.alive) { specIdx++; rec.role = 'btn'; }
    else if (moveLost && Math.hypot(t.clientX - moveLost.lx, t.clientY - moveLost.ly) < 110) { // 끊겼던 이동 터치가 다시 잡힘 → 스틱을 그대로 이어 씀
      clearTimeout(moveLost.timer); rec.role = 'move'; rec.sx = moveLost.sx; rec.sy = moveLost.sy; moveLost = null;
    }
    else if (t.clientX < VW * 0.42 && !moveLost && ![...touches.values()].some((r) => r.role === 'move')) {
      rec.role = 'move';
      const s = $('stick'); s.style.left = t.clientX + 'px'; s.style.top = t.clientY - VT + 'px'; s.classList.remove('hide'); $('stickHint').classList.add('hide');
      $('knob').style.transform = '';
    }
    touches.set(t.identifier, rec);
  }
}, { passive: false });
document.addEventListener('touchmove', (e) => {
  if (!joined || ctlOpen || layEdit) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const r = touches.get(t.identifier);
    if (!r) continue;
    if (r.role === 'move') {
      let dx = t.clientX - r.sx, dy = t.clientY - r.sy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R * 1.5 && dy < 0 && Math.abs(dx) < -dy * 0.8) input.sprint = true; // 위로 끝까지 밀면 달리기 고정
      else if (ctl.alwaysSprint && dy < -STICK_R * 0.55 && Math.abs(dx) < -dy) input.sprint = true; // 항상 달리기
      else if (dy > -STICK_R * 0.5) input.sprint = false;
      if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
      input.jx = dx / STICK_R; input.jy = dy / STICK_R;
      $('knob').style.transform = `translate(${dx}px,${dy}px)`;
    } else if (r.role === 'look') { const dx = t.clientX - r.lx, dy = t.clientY - r.ly, m = Math.hypot(dx, dy); if (m < Math.max(160, VW * 0.22)) { const cv = 0.68 + 0.6 * Math.min(1, m / 24); lookMv = [dx, dy, performance.now()]; look(dx * cv, dy * cv, 0.0055); } } // 한 번에 화면의 1/4 넘게 튄 값은 놓친 터치가 다시 잡힌 것 → 버림 · 손가락이 느리면 정밀하게(0.7배), 빠르면 크게(1.3배)
    r.lx = t.clientX; r.ly = t.clientY;
  }
}, { passive: false });
function touchEnd(e) {
  for (const t of e.changedTouches) {
    const r = touches.get(t.identifier);
    if (!r) continue;
    touches.delete(t.identifier);
    if (r.btn === 'fire' && ctl.touchFix) { // 사격 버튼: 바로 떼지 않고 잠깐 기다렸다가 뗌 (그 사이 다시 눌리면 계속 쏨)
      if (fireLostT) clearTimeout(fireLostT);
      const el = r.el; fireLostT = setTimeout(() => { fireLostT = 0; if (![...touches.values()].some((q) => q.btn === 'fire')) pressBtn('fire', false, el); }, GRACE);
    } else if (r.btn) pressBtn(r.btn, false, r.el);
    if (r.role === 'move' && !ctl.touchFix) { input.jx = input.jy = 0; input.sprint = false; $('stick').classList.add('hide'); }
    else if (r.role === 'move') { // 이동 스틱: 잠깐은 가던 방향을 유지
      if (moveLost) clearTimeout(moveLost.timer);
      const ml = { sx: r.sx, sy: r.sy, lx: r.lx, ly: r.ly, timer: 0 };
      ml.timer = setTimeout(() => { if (moveLost === ml) { moveLost = null; input.jx = input.jy = 0; input.sprint = false; $('stick').classList.add('hide'); } }, GRACE);
      moveLost = ml;
    }
  }
}
document.addEventListener('touchend', touchEnd);
document.addEventListener('touchcancel', touchEnd);
document.addEventListener('contextmenu', (e) => { if (joined) e.preventDefault(); });

// 터치 진단: 브라우저가 알려 주는 손가락(초록 원)과 게임이 맡긴 역할, 끝남·취소 횟수를 보여 줌
// '취소'가 늘면 시스템·브라우저 제스처가 터치를 가져간 것, '끝'만 늘면 기기가 손가락을 놓친 것
const tdbg = { start: 0, end: 0, cancel: 0, max: 0, last: '' }, tdots = new Map();
function tdbgShow() { $('tdbg').classList.toggle('hide', !ctl.touchDbg); if (!ctl.touchDbg) { for (const d of tdots.values()) d.remove(); tdots.clear(); } }
function tdbgOn(e) {
  if (!ctl.touchDbg) return;
  if (e.type === 'touchstart') tdbg.start += e.changedTouches.length; else if (e.type === 'touchend') tdbg.end += e.changedTouches.length; else if (e.type === 'touchcancel') tdbg.cancel += e.changedTouches.length;
  if (e.type !== 'touchmove') tdbg.last = e.type.slice(5) + ' ' + [...e.changedTouches].map((t) => Math.round(t.clientX) + ',' + Math.round(t.clientY)).join(' / ');
  tdbg.max = Math.max(tdbg.max, e.touches.length);
  const seen = new Set();
  for (const t of e.touches) {
    seen.add(t.identifier);
    let d = tdots.get(t.identifier);
    if (!d) { d = document.createElement('div'); d.className = 'tdot'; $('tdbg').appendChild(d); tdots.set(t.identifier, d); }
    const r = touches.get(t.identifier);
    d.style.left = t.clientX + 'px'; d.style.top = t.clientY - VT + 'px'; d.style.borderColor = r ? '#4ade80' : '#ff5a5a';
    d.textContent = r ? (r.role === 'move' ? '이동' : r.btn ? r.btn : '시점') : '안 잡힘';
  }
  for (const [id, d] of tdots) if (!seen.has(id)) { d.remove(); tdots.delete(id); }
  $('tdbgTxt').textContent = `손가락 ${e.touches.length}개 (게임이 잡은 것 ${touches.size}개) · 동시에 최대 ${tdbg.max}개\n시작 ${tdbg.start} · 끝 ${tdbg.end} · 취소 ${tdbg.cancel}\n마지막: ${tdbg.last}`;
}
for (const ty of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) document.addEventListener(ty, tdbgOn, { passive: true });
tdbgShow();
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
  if (document.pointerLockElement !== canvas) { lockPointer(); initAudio(); return; }
  if (e.button === 0) input.fire = true;
  if (e.button === 2) setScope(true);
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 2) setScope(false);
  if (e.button === 0 && document.pointerLockElement === canvas) input.fire = false;
});
// 마우스 시점: 잠금 직후의 첫 움직임(커서가 있던 자리에서 튄 값)과, 브라우저가 가끔 한 번씩 보내는 터무니없이 큰 값은 버림
// (이 값들이 그대로 들어가면 화면이 갑자기 엉뚱한 쪽으로 홱 돌아감)
let lockAt = 0, mAvg = 0;
function lockPointer() {
  const plain = () => { try { canvas.requestPointerLock?.(); } catch {} };
  try { const p = canvas.requestPointerLock?.({ unadjustedMovement: true }); if (p && p.catch) p.catch(plain); } catch { plain(); } // 가속 없는 마우스 값 (안 되는 브라우저는 보통 잠금)
}
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === canvas) { lockAt = performance.now(); mAvg = 0; } });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  const dx = e.movementX || 0, dy = e.movementY || 0, m = Math.hypot(dx, dy);
  if (performance.now() - lockAt < 150) return;
  if (m > 450 && m > mAvg * 6 + 200) return;
  mAvg = mAvg * 0.85 + m * 0.15;
  look(dx, dy, 0.0023);
});
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
  lastJoin = { name, room, mode: selMode, map: $('mapSel').value, bot: +$('botLv').value, sk: mySk, att: myParts, sl: SKINS.map((_, i) => myLv(i)), op: myOp, codes: myCodes, paint: isPaint(store.get('paint', '')) ? store.get('paint', '') : '' };
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
  if (!pvAv) { pvAv = makeRig(paintUI.tex, teamMat[1]); pvGroup.add(pvAv.body); rigHold(pvAv, 13, mySk[13]); }
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
$('vol').oninput = (e) => { volume = parseFloat(e.target.value); store.set('vol', volume); setVolume(volume); };
$('gfx').onchange = (e) => { store.set('gfx', e.target.value); location.reload(); };
$('mapSel').onchange = (e) => { store.set('map', e.target.value); setMode(selMode); };
$('botLv').value = store.get('bot', '1'); $('botLv').onchange = (e) => store.set('bot', e.target.value);
const setXhair = (c) => { document.documentElement.style.setProperty('--xh', c); store.set('xh', c); };
$('xhair').value = store.get('xh', '#ffffff'); setXhair($('xhair').value || '#ffffff'); $('xhair').onchange = (e) => setXhair(e.target.value);

// 메뉴와 창의 단추를 누를 때 나는 소리
document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#menu button, #menu select, #locker button, #ctl button, #paint button, #layBar button, #shopBox .x, #shopFoot [data-btn], #boardBtns span, #leaveBox span, #radio span, #info .chip, #exitChip')) { initAudio(); sfxUI('click'); } });
// ───────────── 무기고: 스킨 미리 보기·장착·코드 등록 ─────────────
const SWATCH = { std: 'linear-gradient(90deg,#4a505a,#22252a)', carbon: 'repeating-linear-gradient(45deg,#16181c 0 4px,#4a4f58 4px 8px)', tiger: 'repeating-linear-gradient(100deg,#f6a12a 0 9px,#17110c 9px 14px)', sakura: 'linear-gradient(90deg,#ffd3e2,#f291b4)', ice: 'linear-gradient(120deg,#cdf3ff,#6fb7ea,#e8fbff)', neon: 'linear-gradient(90deg,#0b0e14,#19e3ff 45%,#ff3df0 55%,#0b0e14)', lava: 'linear-gradient(90deg,#17110f,#ff7a1a 50%,#17110f)', gold: 'linear-gradient(110deg,#a8780f,#ffe9a0 45%,#d8a93a)', galaxy: 'linear-gradient(110deg,#0a0822,#7a3cff 50%,#ff46be)', aurora: 'linear-gradient(90deg,#ff5a5a,#ffd23f,#5aff8a,#5ab8ff,#c08bff)', halloween: 'linear-gradient(90deg,#2e1646,#f07a12 50%,#2e1646)',
  desert: 'conic-gradient(from 90deg at 30% 40%,#cdb98f 25%,#806b4c 0 50%,#a8916a 0 75%,#584834 0) 0 0/10px 10px', forest: 'radial-gradient(circle at 20% 30%,#4e5a33 30%,transparent 32%),radial-gradient(circle at 70% 70%,#5f4630 25%,transparent 27%),radial-gradient(circle at 60% 20%,#1d1d19 14%,transparent 16%),#9c9465',
  urban: 'conic-gradient(from 90deg at 30% 40%,#a9aeb3 25%,#4a4f56 0 50%,#787e85 0 75%,#24272c 0) 0 0/10px 10px', platinum: 'linear-gradient(110deg,#8d939e,#f4f7fb 40%,#b9c0cb 60%,#eef1f6)', damascus: 'repeating-linear-gradient(160deg,#3a2414 0 3px,#a8723a 3px 6px,#f0d79a 6px 8px,#5c3a1e 8px 11px)',
  obsidian: 'linear-gradient(120deg,#08070c 40%,#d8d8e8 45%,#08070c 48%,#1a1428)', diamond: 'linear-gradient(120deg,#cfe9ff,#ffffff 30%,#a8d8ff 50%,#f0e6ff 70%,#ffffff)', atomic: 'linear-gradient(120deg,#5a0008,#d81e1a 35%,#ff6a1a 55%,#ffd45a 70%,#8e0a10)',
  orion: 'linear-gradient(110deg,#ff8ad8,#8ad8ff 30%,#b9ffd8 50%,#ffe28a 70%,#c08bff)', darkmatter: 'linear-gradient(120deg,#05040c,#3a1a7a 40%,#b05cff 50%,#ff3da8 55%,#05040c)',
  crimson: 'linear-gradient(115deg,#f4f3ef 40%,#d0141e 41% 58%,#ff8a20 60%,#1a1b1f 62%)', dragon: 'radial-gradient(circle at 30% 50%,#ff3010 6%,transparent 8%),linear-gradient(120deg,#050405,#2a1418 45%,#ff2a10 50%,#050405 56%)', phoenix: 'linear-gradient(110deg,#7a4a08,#ffd98a 35%,#ff7a1a 52%,#ffe9a0 70%,#a86a10)', aqua: 'linear-gradient(115deg,#eef2f6 38%,#1f5fe0 39% 60%,#4ae8ff 62%,#141c2c 64%)' };
const TIERN = { 희귀: 1, 영웅: 2, 전설: 3, 한정: 4, 얼티밋: 5, 레전드: 6 };
const CATN = { melee: '근접', side: '보조', smg: '기관단총', sg: '샷건', ar: '소총', sr: '저격총', mg: '기관총' };
let lkAnimAt = -1e9, lockerOpen = false, lkW = 13, lkSkin = 0, lkYaw = 0.7, lkDrag = null, lkGun = null, lkKey = '', lkSpin = true, lkTab = 'skin';
const lkGroup = new THREE.Group();
lkGroup.visible = false; vmScene.add(lkGroup);
const lkGlow = new THREE.PointLight(0xffffff, 0, 3, 2); lkGlow.visible = false; vmScene.add(lkGlow); // 무기고: 스킨 색으로 총 아래를 물들이는 빛
const lkTint = new THREE.Color(1, 1, 1), lkTheme = new THREE.Color(1, 1, 1);
const lkBack = (() => { // 무기고 배경: 총 뒤로 은은한 조명과 바닥 빛
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'), rg = g.createRadialGradient(128, 116, 0, 128, 116, 128);
  rg.addColorStop(0, 'rgba(92,112,146,.55)'); rg.addColorStop(0.45, 'rgba(52,64,86,.3)'); rg.addColorStop(1, 'rgba(22,26,33,0)'); g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  g.save(); g.translate(128, 178); g.scale(1, 0.16); const fg = g.createRadialGradient(0, 0, 0, 0, 0, 108); fg.addColorStop(0, 'rgba(170,196,236,.22)'); fg.addColorStop(1, 'rgba(170,196,236,0)'); g.fillStyle = fg; g.fillRect(-128, -128, 256, 256); g.restore();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  m.visible = false; vmScene.add(m); return m;
})();
let lkOp = 0;
function lkBuild() { // 가운데에 띄울 모델
  if (lkTab === 'op') { // 요원 칸: 총 대신 캐릭터
    const key = 'op:' + lkOp + ':' + mySk[13];
    if (key === lkKey) return;
    lkKey = key;
    if (lkGun) lkGroup.remove(lkGun);
    const rig = makeRig(paintTexOf({ id: myId || 0, op: lkOp }), teamMat[1]);
    if (lkOp) dressOp(rig, lkOp);
    rigHold(rig, 13, mySk[13], myParts[13], myLv(mySk[13]));
    rig.body.position.y = -0.95;
    lkGun = new THREE.Group(); lkGun.add(rig.body); lkGun.userData.len = 1.2; lkGun.userData.rig = rig;
    { const c = OPS[lkOp].col; lkTheme.set(c || '#bfd0e8'); lkTint.setRGB(1, 1, 1).lerp(lkTheme, c ? 0.6 : 0.1); }
    lkGroup.add(lkGun);
    return;
  }
  const key = lkW + ':' + lkSkin + ':' + myParts[lkW].join('.') + ':' + myLv(lkSkin);
  if (key === lkKey) return;
  lkKey = key;
  if (lkGun) lkGroup.remove(lkGun);
  const info = makeGun(lkW, lkSkin, myParts[lkW], myLv(lkSkin)), box3 = gunBox(info.group), c = box3.getCenter(new THREE.Vector3()), sz = box3.getSize(new THREE.Vector3());
  info.group.position.sub(c);
  { const f = skinFx(lkSkin); lkTheme.setHex(f ? f.flash : 0xbfd0e8); lkTint.setRGB(1, 1, 1).lerp(lkTheme, f ? 0.65 : 0.1); }
  lkGun = new THREE.Group(); lkGun.add(info.group); lkGun.userData.len = Math.max(sz.z, sz.y * 1.7, 0.3);
  lkGroup.add(lkGun);
}
function lkRefresh() {
  for (const b of $('lkLeft').querySelectorAll('button')) b.classList.toggle('on', +b.dataset.w === lkW);
  const k = SKINS[lkSkin];
  $('lkName').textContent = WEAPONS[lkW].name;
  $('lkSkin').textContent = `${k.name} · ${k.free ? '무료' : k.tier + (k.bundle ? ' · 형태·이펙트·소리 전부 변경' : ' · 형태 변경')}${unlocked.has(lkSkin) ? '' : ' · 잠김'}`; $('lkSkin').className = 't' + (TIERN[k.tier] || 0);
  for (const b of $('lkSkins').children) { const i = +b.dataset.s; b.classList.toggle('on', i === lkSkin); b.classList.toggle('eq', mySk[lkW] === i); b.classList.toggle('lock', !unlocked.has(i)); }
  for (const b of $('lkTabs').children) b.classList.toggle('on', b.dataset.tab === lkTab);
  $('lkTabSkin').classList.toggle('hide', lkTab !== 'skin'); $('lkTabPart').classList.toggle('hide', lkTab !== 'part'); $('lkTabOp').classList.toggle('hide', lkTab !== 'op');
  if (lkTab === 'op') { // 요원 스킨
    const o = OPS[lkOp], own = !lkOp || unlocked.has(OP_BASE + lkOp);
    $('lkName').textContent = '요원'; $('lkSkin').textContent = `${o.name}${o.tier ? ' · ' + o.tier : ''}${own ? '' : ' · 잠김'}`; $('lkSkin').className = 't' + (TIERN[o.tier] || 0);
    for (const b of $('lkOps').children) { const i = +b.dataset.o; b.classList.toggle('on', i === lkOp); b.classList.toggle('eq', myOp === i); b.classList.toggle('lock', !!i && !unlocked.has(OP_BASE + i)); }
    $('lkOpDesc').textContent = o.desc; $('lkOpFx').textContent = lkOp ? '효과 미리보기' : '동작 보기';
    return;
  }
  // 스킨 레벨
  const lv = myLv(lkSkin), xp = lkSkin ? skXp[k.id] | 0 : 0, L = $('lkLv');
  L.style.display = lkSkin ? '' : 'none';
  L.children[0].textContent = `${k.name} Lv.${lv}${lv >= 5 ? ' · 각성' : ''}`;
  L.children[1].firstElementChild.style.width = (lv >= 5 ? 100 : Math.round(((xp - SKIN_LV[lv - 1]) / (SKIN_LV[lv] - SKIN_LV[lv - 1])) * 100)) + '%';
  L.children[2].textContent = lv >= 5 ? `처치 ${xp} · 모든 효과가 열렸어요` : `처치 ${xp} / ${SKIN_LV[lv]} · 다음: ${SKIN_LV_NAME[lv + 1]}`;
  $('lkFx').textContent = k.bundle ? '효과 미리보기' : '동작 보기';
  if (lkTab === 'part') lkPartsRefresh();
}
$('lkFx').onclick = () => { // 얼티밋 번들: 꺼내기 → 사격 세 발 → 처치 소리·엠블럼을 들어 보기
  initAudio(); const f = skinFx(lkSkin);
  if (!f || !f.bundle) { pulseSkin(0.6); lkSpin = true; lkAnimAt = performance.now(); sfxUI('equip'); return; } // 무료 스킨: 손기술 동작만
  pulseSkin(); lkSpin = true; lkAnimAt = performance.now(); sfxSkin(f.sfx, 'equip', 0.8);
  for (let i = 0; i < 3; i++) setTimeout(() => { sfxShot(lkW, 0.5, 0); if (!WEAPONS[lkW].melee) sfxSkin(f.sfx, 'shot', 0.55); }, 750 + i * (WEAPONS[lkW].melee ? 380 : Math.max(130, WEAPONS[lkW].interval)));
  setTimeout(() => { sfxSkin(f.sfx, 'kill', 0.8); skinEmblem(lkSkin); pulseSkin(); lkAnimAt = performance.now(); }, 1700);
};
// 파츠 칸: 자리별로 고르는 단추와 성능 막대
const STATS = [
  ['피해', (W) => Math.min(100, (W.dmg * W.pellets) / 1.1)],
  ['연사', (W) => Math.min(100, 6000 / W.interval)],
  ['사거리', (W) => Math.min(100, W.range / 2.3)],
  ['정확도', (W) => 100 - clamp(W.hip * 900 + W.spread * 1500, 0, 92)],
  ['반동 제어', (W) => 100 - clamp(((W.kick * (W.kv * 0.7 + W.kh * 0.3) * 1000) / W.interval) * 900, 0, 92)],
  ['기동성', (W) => clamp(W.move * 62 + ((420 - W.adsMs) / 420) * 44, 5, 100)],
  ['탄창', (W) => Math.min(100, W.mag)],
  ['장전', (W) => clamp(100 - W.reload / 40, 5, 100)],
];
function lkPartsRefresh() {
  const slots = partSlots(lkW), cur = myParts[lkW], box = $('lkParts');
  box.textContent = '';
  { const sk = mySk[lkW], lv = myLv(sk), bun = SKINS[sk] && SKINS[sk].bundle; $('lkPartN').textContent = slots.length ? `파츠 ${cur.length} / ${PART_MAX}` + (bun ? ` · 파츠 스킨 ${lv >= 5 ? '각성 (도는 고리·보석)' : lv >= 3 ? '켜짐' : `Lv.3에 열림 (지금 Lv.${lv})`}` : '') : '이 무기에는 파츠를 달 수 없어요'; } // 스킨 업그레이드로 파츠도 스킨 장식
  for (const [sid, sname] of PART_SLOTS) {
    const builtIn = sid === 'muz' && WEAPONS[lkW].quiet && WEAPONS[lkW].model[0] !== 'knife';
    if (!slots.includes(sid) && !builtIn) continue;
    const row = document.createElement('div'), hd = document.createElement('b'), bx = document.createElement('div'); row.className = 'ptSlot' + (builtIn ? ' lock' : ''); hd.textContent = sname; row.append(hd, bx);
    if (!builtIn) PARTS.forEach((P, pi) => {
      if (!P || P.slot !== sid || !partOk(lkW, pi)) return;
      const b = document.createElement('button'); b.textContent = P.name; b.title = P.desc; b.classList.toggle('on', cur.includes(pi));
      b.onclick = () => {
        let next = cur.filter((v) => PARTS[v].slot !== sid);
        if (!cur.includes(pi)) { if (next.length >= PART_MAX) { $('lkMsg').textContent = `파츠는 ${PART_MAX}개까지 달 수 있어요. 하나를 빼고 다시 골라 주세요.`; return; } next.push(pi); $('lkMsg').textContent = `${P.name}: ${P.desc}`; } else $('lkMsg').textContent = '';
        setParts(lkW, next);
      };
      bx.append(b);
    });
    box.append(row);
  }
  const base = effWeapon(lkW, []), eff = ew(lkW), st = $('lkStats');
  st.textContent = '';
  if (!WEAPONS[lkW].melee) for (const [name, f] of STATS) {
    const a = f(base), b = f(eff), d = Math.round(b) - Math.round(a), row = document.createElement('div'); row.className = 'stRow';
    const sp = document.createElement('span'), bar = document.createElement('div'), fill = document.createElement('i'), dl = document.createElement('u'), em = document.createElement('em');
    sp.textContent = name; bar.className = 'stBar'; fill.style.width = Math.min(a, b) + '%'; dl.style.left = Math.min(a, b) + '%'; dl.style.width = Math.abs(b - a) + '%'; dl.style.background = d > 0 ? '#4ade80' : '#ff6b6b';
    em.textContent = d ? (d > 0 ? '+' : '') + d : Math.round(b); em.className = d > 0 ? 'up' : d < 0 ? 'dn' : '';
    bar.append(fill, dl); row.append(sp, bar, em); st.append(row);
  }
}
function setParts(wi, list) { myParts[wi] = cleanParts(wi, list); EW[wi] = null; store.set('parts', JSON.stringify(myParts)); lkSpin = true; lkRefresh(); }
for (const b of $('lkTabs').children) b.onclick = () => { lkTab = b.dataset.tab; lkKey = ''; if (lkTab === 'part') lkSkin = mySk[lkW]; if (lkTab === 'op') lkOp = myOp; $('lkMsg').textContent = ''; lkRefresh(); };
$('lkPartClear').onclick = () => { $('lkMsg').textContent = ''; setParts(lkW, []); };
// 스킨 경험치: 스킨을 낀 무기로 처치하면 오름 (헤드샷은 2)
function gainSkinXp(wi, head) {
  const sk = WEAPONS[wi] ? mySk[wi] : 0;
  if (!sk) return;
  const id = SKINS[sk].id, before = myLv(sk);
  skXp[id] = (skXp[id] | 0) + (head ? 2 : 1); store.set('skx', JSON.stringify(skXp));
  const lv = myLv(sk);
  if (lv > before) { setTimeout(() => { banner(`스킨 레벨 업! ${SKINS[sk].name} Lv.${lv} · ${SKIN_LV_NAME[lv]}`, 0x7af4ff); sfxUI('level'); if (lv >= 5) sfxSample('ultimate', 0.8); }, 900); if (lv >= 5 && me.alive) vmGun(me.w).visible = true; }
}
function saveSkins() { store.set('sk', JSON.stringify(mySk)); }
function openLocker() {
  if (joined) return;
  lockerOpen = true; lkSkin = mySk[lkW]; lkKey = '';
  $('menu').classList.add('hide'); $('locker').classList.remove('hide'); $('lkMsg').textContent = '';
  if ($('lkLeft').children.length < 3) {
    WEAPONS.forEach((W, i) => { const b = document.createElement('button'); b.dataset.w = i; b.textContent = W.name; const sm = document.createElement('small'); sm.textContent = CATN[W.cat] || ''; b.append(sm); b.onclick = () => { lkW = i; lkSkin = mySk[i]; lkRefresh(); }; $('lkLeft').append(b); });
    SKINS.forEach((k, i) => {
      const b = document.createElement('button'); b.className = 'sk' + (k.bundle ? ' m' : ''); b.dataset.s = i;
      const sw = document.createElement('i'); sw.style.background = SWATCH[k.id] || '#444';
      const nm = document.createElement('span'); nm.textContent = k.name;
      const tr = document.createElement('em'); tr.textContent = k.free ? '무료' : k.tier; tr.className = 't' + (TIERN[k.tier] || 0);
      b.append(sw, nm, tr);
      b.onclick = () => {
        lkSkin = i;
        sfxSample('ui', 0.5);
        if (unlocked.has(i)) { mySk[lkW] = i; saveSkins(); $('lkMsg').textContent = ''; if (k.bundle) sfxSample('equip', 0.55); }
        else $('lkMsg').textContent = '잠긴 스킨이에요. 코드를 등록하면 쓸 수 있어요.';
        lkRefresh();
      };
      $('lkSkins').append(b);
    });
    OPS.forEach((o, i) => { // 요원 스킨 버튼
      const b = document.createElement('button'); b.className = 'sk' + (i ? ' m' : ''); b.dataset.o = i;
      const sw = document.createElement('i'); sw.style.background = i ? `linear-gradient(135deg, #0d0f14 0%, ${o.col} 55%, #0d0f14 100%)` : '#f4f4f0';
      const nm = document.createElement('span'); nm.textContent = o.name;
      const tr = document.createElement('em'); tr.textContent = o.tier || '무료'; tr.className = 't' + (TIERN[o.tier] || 0);
      b.append(sw, nm, tr);
      b.onclick = () => {
        lkOp = i; lkSpin = true; sfxSample('ui', 0.5);
        if (!i || unlocked.has(OP_BASE + i)) { myOp = i; store.set('op', String(i)); $('lkMsg').textContent = ''; if (i) { sfxSample('equip', 0.75); lkAnimAt = performance.now(); } }
        else $('lkMsg').textContent = '잠긴 요원이에요. 코드를 등록하면 쓸 수 있어요.';
        lkRefresh();
      };
      $('lkOps').append(b);
    });
  }
  lkRefresh();
}
function closeLocker() {
  if (!lockerOpen) return;
  lockerOpen = false; lkGroup.visible = false; lkBack.visible = false;
  $('locker').classList.add('hide'); if (!joined) $('menu').classList.remove('hide');
}
$('openLocker').onclick = openLocker; $('lkClose').onclick = closeLocker; $('lkClose2').onclick = closeLocker; $('lkClose3').onclick = closeLocker;
$('lkOpFx').onclick = () => { // 요원 미리보기: 등장 → 사격 → 처치 → 궁극기
  initAudio(); lkSpin = true; lkAnimAt = performance.now();
  if (!lkOp) { sfxUI('equip'); return; }
  sfxSample('equip', 0.8);
  for (let i = 0; i < 3; i++) sfxSample('shot', 0.45, 0, 0.95 + i * 0.04, 0.8 + i * 0.16);
  sfxSample('hit', 0.5, 0, 1.1, 1.35); sfxSample('kill', 0.8, 0, 1, 1.6); sfxSample('ultimate', 0.85, 0, 1, 2.2);
}; $('lkX').onclick = closeLocker;
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
    for (const i of j.skins || []) if (SKINS[i] || (i > OP_BASE && OPS[i - OP_BASE])) unlocked.add(i);
    if (j.ok) { myCodes = [...new Set([...myCodes, ...j.codes])].slice(0, 24); store.set('codes', JSON.stringify(myCodes)); }
    if (quiet) { mySk = mySk.map((v) => (unlocked.has(v) ? v : 0)); if (myOp && !unlocked.has(OP_BASE + myOp)) myOp = 0; return; } // 시작할 때: 더는 쓸 수 없는 스킨은 기본으로
    const got = (j.skins || []).filter((i) => !before.has(i)).map((i) => (i >= OP_BASE ? OPS[i - OP_BASE] : SKINS[i])).filter(Boolean).map((k) => k.name);
    $('lkMsg').textContent = !j.ok ? '없는 코드예요. 다시 확인해 주세요.' : got.length ? `해금: ${got.join(', ')}` : '이미 등록한 코드예요.';
    if (j.ok) { $('lkInput').value = ''; sfxUI('level'); }
    lkRefresh();
  } catch { if (!quiet) $('lkMsg').textContent = '서버에 연결하지 못했어요.'; }
}
$('lkRedeem').onclick = () => { const c = $('lkInput').value.trim(); if (c) { initAudio(); redeem([c], false); } };
$('lkInput').onkeydown = (e) => { if (e.key === 'Enter') $('lkRedeem').onclick(); };
if (myCodes.length) redeem(myCodes, true); else { mySk = mySk.map((v) => (unlocked.has(v) ? v : 0)); myOp = 0; }
$('lkMid').addEventListener('pointerdown', (e) => { lkDrag = e.clientX; lkSpin = false; $('lkMid').setPointerCapture(e.pointerId); });
$('lkMid').addEventListener('pointermove', (e) => { if (lkDrag === null) return; lkYaw += (e.clientX - lkDrag) * 0.012; lkDrag = e.clientX; });
for (const ev of ['pointerup', 'pointercancel']) $('lkMid').addEventListener(ev, () => { lkDrag = null; });

// ───────────── 게임 로직 ─────────────
function surfUnder() { // 발밑이 무엇인지: 상자 위에 서 있으면 그 재질, 아니면 맵 바닥
  for (const b of boxesNear(me.x, me.z, 0.1)) if (me.x > b.min[0] && me.x < b.max[0] && me.z > b.min[2] && me.z < b.max[2] && Math.abs(b.max[1] - me.y) < 0.06) { const k = MATK[b.m]; return k === 1 ? 1 : k === 2 ? 2 : 0; }
  return SURF;
}
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
  const sp = me.drop ? 15 : PLAYER.speed * ew(me.w).move * (me.scoped ? 0.45 : 1) * (me.crouch ? 0.5 : 1) * (me.sprint ? PLAYER.sprint : 1) * (wading ? 0.6 : 1) * (healEnd > now ? 0.5 : 1);
  const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
  let tx = (-sy * fwd + cy * str) * sp, tz = (-cy * fwd - sy * str) * sp;
  if (me.slideT > 0) { me.slideT -= dt; const f = PLAYER.speed * (0.8 + 1.2 * Math.max(0, me.slideT) / 0.55); tx = me.slx * f; tz = me.slz * f; }
  const k = Math.min(1, (me.drop ? 2.5 : me.onGround ? 14 : 4) * dt);
  me.vx += (tx - me.vx) * k; me.vz += (tz - me.vz) * k;
  if ((input.jump || keys.has('Space')) && me.onGround && phase !== 'freeze' && !acting) { me.vy = PLAYER.jump; me.onGround = false; me.slideT = 0; if (me.crouch) toggleCrouch(); sfxStep(0.07, 0, surfUnder()); }
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
    else if (moving > 4.5 && !me.crouch) { me.stepT += dt * moving; if (me.stepT > 2.7) { me.stepT = 0; sfxStep(me.sprint ? 0.11 : 0.065, (Math.random() - 0.5) * 0.3, surfUnder()); } }
  }
}
const eye = [0, 0, 0];
let dbgCam = null; // 테스트·촬영용 자유 시점 { p: [x, y, z], yaw, pitch }
function applyDbgCam() {
  if (!dbgCam) return false;
  camera.rotation.order = 'YXZ';
  if (dbgCam.follow !== undefined) { // 캐릭터 하나를 따라다니며 봄: { follow: id, d: 거리, a: 정면에서 벗어난 각, h: 높이 }
    const o = others.get(dbgCam.follow); if (!o) return false;
    const yaw = o.yaw + (dbgCam.a || 0), d = dbgCam.d || 3;
    camera.position.set(o.x - Math.sin(yaw) * d, o.y + (dbgCam.h || 1.4), o.z - Math.cos(yaw) * d); camera.rotation.set(dbgCam.pitch || -0.06, yaw + Math.PI, 0);
    return true;
  }
  camera.position.set(dbgCam.p[0], dbgCam.p[1], dbgCam.p[2]); camera.rotation.set(dbgCam.pitch || 0, dbgCam.yaw || 0, 0); return true;
}
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
// 반동 무늬: 총마다 정해진 순서로 튄다 → [위, 옆] (kick 의 배수). 연사 총은 처음 몇 발이 크게 솟고, 그 뒤로는 좌우로 흔들림
const hsh = (i) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
function recoilAt(W, wi, n) {
  if (!(W.auto || W.burst)) return [1, (hsh(wi * 7 + n) - 0.5) * 0.5];
  const up = n < 4 ? 1 + n * 0.16 : Math.max(0.6, 1.48 - (n - 3) * 0.11);
  return [up, (Math.sin(n * 0.52 + wi * 1.9) * 0.6 + Math.sin(n * 0.21 + wi * 0.7) * 0.5) * Math.min(1, n / 3) * 0.85];
}
// 지금 탄이 퍼지는 각도. 정조준을 끝까지 하면 거의 조준점 그대로, 지향사격은 움직임·점프·연사에 따라 벌어짐
function curSpread(W) {
  if (W.melee) return 0;
  const mv = clamp(Math.hypot(me.vx, me.vz) / PLAYER.speed, 0, 1.4), air = !me.onGround;
  if (W.falloff) return me.adsP >= 1 ? W.spread * 0.8 : W.hip; // 샷건
  const hip = W.hip * (1 + mv * 0.55 + (air ? 0.9 : 0)) * (me.crouch ? 0.8 : 1) * (1 + me.bloom);
  const ads = W.spread * 0.12 * (1 + mv * 0.5 + (air ? 2 : 0)) * (1 + me.bloom * 0.5);
  return hip + (ads - hip) * (me.adsP >= 1 ? 1 : me.adsP * 0.6);
}
function tryFire(now) {
  const W = ew(me.w);
  if (me.reloadEnd || now - me.lastShot < fireInterval(W)) return false;
  if (W.melee) { // 칼: 바로 앞을 찌름
    me.lastShot = now; me.kickAnim = 1;
    send({ t: 'shoot', w: me.w, d: [dirFrom(me.yaw, me.pitch).map((v) => Math.round(v * 1e4) / 1e4)], rt: Math.round(performance.now() + (timeOff || 0) - 100) });
    sfxShot(me.w, 0.5, 0);
    { const kf = fxOf(mySk[me.w], myLv(mySk[me.w])); if (kf.kind) sfxSkin(kf.kind, 'shot', 0.4); }
    return true;
  }
  if (me.ammo[me.w] <= 0) { me.burstLeft = 0; startReload(now); return false; }
  me.shotN = now - me.lastShot > Math.max(260, W.interval * 1.8) ? 0 : me.shotN + 1;
  me.lastShot = now; me.ammo[me.w]--; me.inspAt = -1e9; me.rackN = 1;
  if (W.burst) { if (me.burstLeft > 0) me.burstLeft--; else { me.burstLeft = W.burst - 1; me.burstAt = now; } }
  camera.getWorldDirection(_f);
  _r.crossVectors(_f, camera.up).normalize(); _u.crossVectors(_r, _f);
  const spread = curSpread(W);
  const dirs = [], myFx = fxOf(mySk[me.w], myLv(mySk[me.w]));
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
      addTracer(muzzle, end, myFx.tracer, myFx === FX0 ? 0.1 : myFx.kind ? 0.16 : 0.14, myFx.kind ? 1.5 : 1);
      if (myFx.kind) addTracer(muzzle, end, 0xffffff, 0.16, 0.45); // 얼티밋: 흰 속심이 있는 굵은 궤적
      if (t === tw && tw < W.range) impact(end, myFx.flash, myFx.tint, myFx.kind);
    }
  }
  send({ t: 'shoot', w: me.w, d: dirs.map((d) => d.map((v) => Math.round(v * 1e4) / 1e4)), rt: Math.round(performance.now() + (timeOff || 0) - 100) });
  // 반동: 정해진 무늬대로 화면이 튀고(부드럽게 나눠 적용), 사격을 멈추면 제자리로 돌아옴
  const [rv, rh] = recoilAt(W, me.w, me.shotN), aim = (me.adsP >= 1 ? 0.8 : 1) * (me.crouch ? 0.88 : 1);
  me.rqP += W.kick * rv * W.kv * aim * (0.94 + Math.random() * 0.12);
  me.rqY += W.kick * (rh * W.kh + (Math.random() - 0.5) * 0.18) * aim;
  me.bloom = Math.min(1.6, me.bloom + (W.auto || W.burst ? 0.2 : 0.4));
  me.kickAnim = 1;
  flash.material.color.setHex(myFx.flash).multiplyScalar(HDRK > 1 ? 1.25 : 1);
  flash.visible = !W.quiet || Math.random() < 0.35; flash.rotation.z = Math.random() * 6.283; flash.scale.setScalar((0.85 + Math.random() * 0.5) * (W.quiet ? 0.45 : 1)); flash._off = now + 50;
  if (flash.visible) { vmFlash.color.setHex(myFx.flash); vmFlash.intensity = W.quiet ? 0.5 : 2.4; lightFlash(muzzle[0], muzzle[1], muzzle[2], myFx.flash, W.quiet ? 6 : 24, 13, 0.07); }
  if (!scopeOn) { // 탄피가 오른쪽으로 튀어나감
    let c = casings.find((q) => q.life <= 0);
    if (!c && casings.length < 10) { c = { m: new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.034), new THREE.MeshStandardMaterial({ color: 0xc89b3c, metalness: 0.6, roughness: 0.4 })), v: [0, 0, 0], life: 0 }; vmScene.add(c.m); casings.push(c); }
    if (c) { const g = vmGun(me.w); c.m.position.set(g.position.x + 0.03, g.position.y + 0.03, g.position.z + 0.02); c.m.rotation.set(0, 0, 0); c.v = [0.9 + Math.random() * 0.6, 1.1 + Math.random() * 0.6, 0.2 + Math.random() * 0.3]; c.life = 0.55; c.m.visible = true; }
  }
  sfxShot(me.w, 0.55, 0, 0, 0, !!W.quiet);
  if (myOp && !W.melee && performance.now() - opShotAt > 110) { opShotAt = performance.now(); sfxSample('shot', W.quiet ? 0.1 : 0.2, 0, 0.94 + Math.random() * 0.12); } // 요원 스킨: 총소리에 겹치는 소리
  skinFire(myFx.kind ? 0.4 : 0.2);
  if (myFx.kind) { sfxSkin(myFx.kind, 'shot', W.quiet ? 0.25 : 0.55); muzzleFx(myFx.kind, muzzle, [_f.x, _f.y, _f.z], myFx.flash); }
  if (W.scope) { me.snipeQ = 0; setTimeout(() => setScope(false), 60); }
  if (me.ammo[me.w] <= 0) { me.burstLeft = 0; setTimeout(() => startReload(performance.now()), 250); }
  return true;
}
let scopeOn = false; // 저격총 조준경 화면이 떠 있는지
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
      o.g.visible = o.deadT < 4.2;
      if (o.g.visible) { animRig(o, dt, { dead: true, fall: o.fallDir }); o.tag.visible = false; o.shadow.visible = false; o.mark.visible = false; o.rim.value.setRGB(0, 0, 0); }
      continue;
    }
    if (!o.wasAlive) { o.wasAlive = true; o.tag.visible = true; o.shadow.visible = true; o.vx = o.vy = o.vz = 0; }
    o.g.visible = true;
    if (mode === 'br') { // 낙하산과 이름표 (멀면 이름을 숨김)
      const air = o.y - groundAt(o.x, o.z) > 3.5 && o.y < py - 0.02;
      if (air && !o.chute) { o.chute = makeChute(BR_COL[(o.ci || 0) % BR_COL.length]); o.g.add(o.chute); }
      if (o.chute) o.chute.visible = air;
      o.tag.visible = Math.hypot(o.x - camera.position.x, o.z - camera.position.z) < 28;
    } else if (o.chute) o.chute.visible = false;
    o.g.position.set(o.x, o.y, o.z); o.g.rotation.y = o.yaw;
    // 움직이는 빠르기 (앞뒤·좌우·위아래) → 걷기·기울임·점프 자세
    const idt = 1 / (dt || 0.016), kv = Math.min(1, dt * 10);
    o.vx += ((o.x - px) * idt - o.vx) * kv; o.vy += ((o.y - py) * idt - o.vy) * kv; o.vz += ((o.z - pz) * idt - o.vz) * kv;
    const sp = Math.hypot(o.vx, o.vz), sy = Math.sin(o.yaw), cy = Math.cos(o.yaw);
    let seated = false;
    if (vehs.size) for (const v of vehs.values()) if (v.driver === o.id) { seated = true; o.g.position.y = o.y + 0.25; o.g.rotation.y = v.yaw; break; }
    const camD = Math.hypot(o.x - camera.position.x, o.z - camera.position.z), far = camD > 120; // 멀리 있는 캐릭터는 자세 계산을 건너뜀
    { // 적: 빨간 윤곽광 (멀수록 진하게) + 보이는 적 머리 위 표식 (0.12초마다 시야를 다시 재고, 연막·섬광 중엔 숨김)
      const foe = mode === 'br' || o.team !== myTeam, k = foe ? clamp(camD / 30, 0.28, 0.85) : 0;
      o.rim.value.setRGB(k, k * 0.1, k * 0.08);
      let show = false;
      if (foe && me.alive && camD > 5 && camD < 130 && now >= (me.flashUntil || 0)) {
        if (now - o.losT > 120) { o.losT = now; const tx = o.x - eye[0], ty = o.y + (o.c ? 0.9 : 1.3) - eye[1], tz = o.z - eye[2], d = Math.hypot(tx, ty, tz); o.los = d > 0.1 && rayWorld(eye, [tx / d, ty / d, tz / d], d) >= d - 0.4 && !smoked(eye, [o.x, o.y + 1.2, o.z]); }
        show = o.los;
      }
      o.mark.visible = show; if (show) o.mark.position.y = o.c ? 1.95 : 2.42;
    }
    { const k = clamp(camD / 5, 0.42, 1); o.tag.scale.set(1.5 * k, 0.375 * k, 1); o.tag.position.y = 2.02 + 0.18 * k; } // 코앞에서는 이름표를 작게
    if (!far || !o.posed) { o.posed = true; animRig(o, dt, { speed: seated ? 0 : sp, vf: -sy * o.vx - cy * o.vz, vs: cy * o.vx - sy * o.vz, pitch: o.pitch, crouch: o.c && !seated, air: Math.abs(o.vy) > 2.4 && !(o.chute && o.chute.visible), sprint: sp > 6.3 && now - o.shotAt > 600, seated }); }
    const sc0 = o.prot ? 1.04 : 1;
    o.g.scale.set(sc0, sc0, sc0);
    if (sp > 4.5 && !o.c) { // 발소리
      o.stepT += dt * sp;
      if (o.stepT > 2.7) { o.stepT = 0; const [v, pan] = heard(o.x, o.z, 22); sfxStep(v * 0.3, pan, SURF); if (DUST && sp > 6 && Math.hypot(o.x - camera.position.x, o.z - camera.position.z) < 45) puff([o.x, o.y + 0.08, o.z], [-o.vx * 0.08, 0.4, -o.vz * 0.08], DUST, 0.6, 0.5, 0.3); }
    }
  }
}
let fxHold = false; // 테스트용: 효과를 멈춰 두고 한 걸음씩 넘김
function updateFx(dt) {
  if (!fxHold) tickFx(dt);
  for (const ms of nadeMeshes.values()) { const t = ms.userData.to; ms.position.x += (t[0] - ms.position.x) * Math.min(1, dt * 18); ms.position.y += (t[1] - ms.position.y) * Math.min(1, dt * 18); ms.position.z += (t[2] - ms.position.z) * Math.min(1, dt * 18); }
}

let lastT = performance.now(), lastSend = 0, menuAng = 0, perfT = 0, perfN = 0, perfFrom = 0, perfFast = 0;
const drawVm = () => { renderer.setClearColor(0x161a21, 1); renderer.clear(); renderer.render(vmScene, vmCam); };
const drawWorld = () => { renderer.clear(); renderer.render(scene, camera); };
const drawGame = () => { renderer.clear(); renderer.render(scene, camera); renderer.clearDepth(); renderer.render(vmScene, vmCam); };
// 화질 자동 조절. 느리면 한 단계씩 낮춤: 계단 현상 줄이기(다중 표본 → 가벼운 FXAA) → 해상도 → 빛 번짐 줄임 → 해상도(조금씩) → 후처리 끔
// 오래 넉넉하면 해상도를 다시 올림 (고해상도 휴대폰 화면이 한 번 느려졌다고 끝까지 흐릿하지 않게)
const DPR = window.devicePixelRatio || 1, PR_MAX = Math.min(DPR, gfx === 'low' ? 1 : gfx === 'mid' ? (isTouch ? 2 : 1.5) : 2), PR_MIN = Math.min(DPR, isTouch && gfx !== 'low' ? 1.25 : 1);
const setPR = (v) => { renderer.setPixelRatio(v); resize(); };
let lastUp = -1e9, noUp = false;
function qualityDown(now) {
  if (now - lastUp < 8000) noUp = true; // 올렸더니 바로 느려짐 → 더는 올리지 않음
  const pr = renderer.getPixelRatio();
  if (postOn && post.samples > 0) post.config({ samples: 0 });
  else if (pr > 1.5) setPR(1.5);
  else if (postOn && post.levels > 3) post.config({ levels: 3 });
  else if (pr > PR_MIN + 0.01) setPR(Math.max(PR_MIN, pr - 0.25));
  else if (pr > 1) setPR(1);
  else if (postOn) { postOn = false; post.dispose(); }
}
function qualityUp(now) { const pr = renderer.getPixelRatio(); if (noUp || pr >= PR_MAX - 0.01) return; setPR(Math.min(PR_MAX, pr + 0.25)); lastUp = now; }
let booted = false;
function frame(now) {
  requestAnimationFrame(frame);
  renderer.info.reset();
  if (!booted) { booted = true; requestAnimationFrame(() => { const b = $('boot'); if (b) { b.classList.add('done'); setTimeout(() => b.remove(), 600); } }); } // 첫 화면이 그려지면 시작 화면을 걷음
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  lkGlow.visible = false; vmRim.color.set(0xcfe2ff); // 무기고에서 물들인 빛은 매 프레임 되돌림 (무기고면 아래에서 다시 칠함)
  if (!joined && paintUI.open) { // 캐릭터 그리기: 오른쪽에 그린 그림을 입은 캐릭터를 돌려 보여 줌
    const r = $('ptPrev').getBoundingClientRect(), asp = vmCam.aspect;
    const d = Math.min(9, Math.max(2.1 / (1.108 * Math.max(0.2, r.height / VH)), 1.05 / (1.108 * asp * Math.max(0.08, r.width / VW))));
    if (!paintUI.drag) paintUI.yaw = now / 1400;
    pvGroup.position.set((((r.left + r.right) / 2 / VW) * 2 - 1) * 0.554 * d * asp, -((((r.top + r.bottom) / 2 - VT) / VH) * 2 - 1) * 0.554 * d - 0.95, -d);
    pvGroup.rotation.y = paintUI.yaw;
    if (pvAv) animRig(pvAv, dt, { speed: 0, pitch: 0 });
    pvGroup.visible = true; vm.visible = false; lkGroup.visible = false;
    uiLight(); present(drawVm, now, GRADE_UI);
    return;
  }
  if (!joined && lockerOpen) { // 무기고: 어두운 배경에 총만 크게
    lkBuild();
    const r = $('lkMid').getBoundingClientRect(), asp = vmCam.aspect, wf = Math.max(0.2, r.width / VW);
    const opv = lkTab === 'op' && lkGun.userData.rig, d = opv ? Math.min(12, 1.4 * Math.max(2.3 / (1.108 * Math.max(0.2, r.height / VH)), 1.2 / (1.108 * asp * wf))) : Math.max(0.36, lkGun.userData.len / (0.8 * wf * 1.108 * asp));
    lkGroup.position.set((((r.left + r.right) / 2 / VW) * 2 - 1) * 0.554 * d * asp, -0.015 * d, -d);
    if (opv) { // 요원: 앞모습을 중심으로 흔들고, [미리보기]면 한 바퀴 돌며 뛰어오름
      if (lkSpin) lkYaw = Math.PI + 0.5 + now / 2600; // 천천히 돌며 앞·옆·뒤(망토·낫·원자로 통)를 다 보여 줌
      const a = (now - lkAnimAt) / 1800, e = (x) => x * x * (3 - 2 * x);
      lkGun.rotation.set(0.05, lkYaw + (a >= 0 && a < 1 ? e(a) * Math.PI * 2 : 0), 0);
      lkGun.position.y = a >= 0 && a < 1 ? Math.sin(a * Math.PI) * 0.25 : 0;
      animRig(lkGun.userData.rig, dt, { speed: 0, pitch: 0, air: a >= 0 && a < 0.6 });
    } else {
    if (lkSpin) lkYaw = Math.PI / 2 + Math.sin(now / 1900) * 0.95; // 옆모습을 중심으로 천천히 흔들어 보여 줌
    lkGun.rotation.set(0.1, lkYaw, 0);
    { const a = (now - lkAnimAt) / 2600, inner = lkGun.children[0]; // [효과 미리보기]: 총열 축으로 돌리고 뒤집는 손기술
      if (a >= 0 && a < 1) { const e = (x) => x * x * (3 - 2 * x), s1 = e(clamp(a / 0.45, 0, 1)), s2 = e(clamp((a - 0.5) / 0.4, 0, 1)); inner.rotation.z = s1 * Math.PI * 2; lkGun.rotation.y += Math.sin(s2 * Math.PI) * 1.2; lkGun.position.y = Math.sin(clamp(a / 0.45, 0, 1) * Math.PI) * 0.04 * lkGun.userData.len; skinFire(0.05); }
      else { inner.rotation.z = 0; lkGun.position.y = 0; } }
    }
    lkGroup.visible = true; vm.visible = false;
    { const D = d + 2.6, k = D / d; lkBack.position.set(lkGroup.position.x * k, lkGroup.position.y * k, -D); lkBack.scale.setScalar(D * 1.9); lkBack.visible = true; }
    tickSkins(now / 1000); tickOps(now / 1000);
    uiLight();
    vmRim.color.copy(lkTheme); vmRim.intensity = 2.4; lkBack.material.color.copy(lkTint).multiplyScalar(1.25);
    lkGlow.visible = true; lkGlow.color.copy(lkTheme); lkGlow.intensity = 0.8 + Math.sin(now / 600) * 0.15; lkGlow.distance = d * 1.6; lkGlow.position.set(lkGroup.position.x, lkGroup.position.y - d * 0.18, lkGroup.position.z + d * 0.25);
    present(drawVm, now, GRADE_UI);
    return;
  }
  if (!joined) {
    menuAng += dt * 0.07;
    const big = ARENA.hx > 100;
    camera.position.set(Math.cos(menuAng) * ARENA.hx * (big ? 0.7 : 0.95), big ? ARENA.hx * 0.36 : 30, Math.sin(menuAng) * ARENA.hz * (big ? 0.7 : 1.05));
    camera.lookAt(4, big ? 6 : 0, 0);
    applyDbgCam();
    world.update(camera.position, dt);
    if (UIL) applyTheme();
    updateVmLight(dt, now); updateFx(dt);
    present(drawWorld, now, world.grade);
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
    if (wasAir && me.onGround && vy0 < -3.5 && !me.drop) { me.land = Math.min(1, -vy0 / 9); if (DUST) for (let i = 0; i < 3; i++) { const a = i * 2.1 + me.yaw; puff([me.x + Math.cos(a) * 0.3, me.y + 0.06, me.z + Math.sin(a) * 0.3], [Math.cos(a) * 1.2, 0.3, Math.sin(a) * 1.2], DUST, 0.7, 0.55, 0.3); } }
    if (wasAir && me.onGround && vy0 < -3.5 && !me.drop) sfxStep(Math.min(0.2, -vy0 / 45), 0, surfUnder());
    if (wasAir && me.onGround && vy0 < -7 && !me.drop) me.shake = Math.max(me.shake, Math.min(0.5, -vy0 / 30)); // 착지
    me.eyeH += ((me.crouch ? PLAYER.eyeCrouch : PLAYER.eye) - me.eyeH) * Math.min(1, dt * 12);
    eye[0] = me.x; eye[1] = me.y + me.eyeH; eye[2] = me.z;
    camera.position.set(eye[0], eye[1] - Math.sin(Math.min(1, me.land) * Math.PI) * 0.07, eye[2]);
    me.shake = Math.max(0, me.shake - dt * 2.2);
    const sway = scopeOn ? (me.crouch ? 0.5 : 1) * (Math.hypot(me.vx, me.vz) > 1 ? 2.2 : 1) : 0; // 조준경을 들여다보면 숨결에 따라 살짝 흔들림
    camera.rotation.set(me.pitch + (Math.random() - 0.5) * me.shake * 0.05 + Math.sin(now / 780) * 0.0026 * sway, me.yaw + (Math.random() - 0.5) * me.shake * 0.05 + Math.sin(now / 1130 + 1) * 0.0034 * sway, 0);
    if (me.reloadEnd && now >= me.reloadEnd) { me.reloadEnd = 0; me.ammo[me.w] = ew(me.w).mag; }
    aimAssist(dt);
    const W = ew(me.w);
    // 반동을 나눠 적용하고, 사격을 멈추면 솟은 만큼 되돌림. 연사로 벌어진 탄퍼짐도 줄어듦
    { const k = 1 - Math.exp(-dt * 30), dp = me.rqP * k, dy = me.rqY * k; me.rqP -= dp; me.rqY -= dy; me.pitch = clamp(me.pitch + dp, -1.45, 1.45); me.yaw += dy; me.rcP += dp; me.rcY += dy; }
    if (now - me.lastShot > Math.max(110, fireInterval(W) * 1.3)) { const r = 1 - Math.exp(-dt * 8); me.pitch = clamp(me.pitch - me.rcP * r, -1.45, 1.45); me.yaw -= me.rcY * r; me.rcP *= 1 - r; me.rcY *= 1 - r; }
    me.bloom = Math.max(0, me.bloom - dt * (now - me.lastShot > 140 ? 4.2 : 1.2));
    me.adsP = clamp(me.adsP + ((me.scoped ? dt : -dt * 1.4) * 1000) / (W.adsMs || 1), 0, 1);
    let want = input.fire && !shopOpen;
    if (me.snipeQ) { if (!me.scoped || !W.scope || now - me.snipeQ > 1600) me.snipeQ = 0; else if (me.adsP >= 1) want = true; } // 저격총: 손을 떼면 조준이 끝나는 대로 발사
    if (!want && autoFire && !shopOpen && !me.reloadEnd && !me.drop && now - me.lastShot >= W.interval && (!W.scope || (me.scoped && me.adsP >= 1))) want = aimedEnemy(W.falloff ? 14 : Math.min(W.range, mode === 'br' ? 90 : 999));
    if (want && W.scope && me.scoped && me.adsP < 1) want = false; // 저격총은 조준 중이면 총을 다 올린 뒤에 나감 (조준하지 않고 쏘는 것은 그대로)
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
  // 화질 자동 조절 (게임 시작 5초 뒤부터 잼): 3초 평균이 초당 33장에 못 미치면 한 단계 낮추고, 초당 55장 넘게 9초 이어지면 해상도를 올림
  if (!perfFrom) perfFrom = now;
  if (now - perfFrom > 5000) { perfT += dt; perfN++; }
  if (perfT > 3) { const a = perfT / perfN; if (!QLOCK) { if (a > 0.03) { qualityDown(now); perfFast = 0; } else if (a < 0.018) { if (++perfFast >= 3) { qualityUp(now); perfFast = 0; } } else perfFast = 0; } perfT = 0; perfN = 0; }
  updateOthers(dt, now);
  updateFx(dt);
  applyDbgCam();
  world.update(camera.position, dt);
  if (audioOn()) setAmbient(world.tkey === 'isle' && world.mood === 2 ? 'dock' : world.tkey); // 맵마다 다른 배경음 (안개 낀 섬은 바람과 물소리만)
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
  const W = ew(me.w);
  if (!me.alive) me.adsP = 0;
  const so = me.alive && me.scoped && !!W.scope && me.adsP > 0.82;
  if (so !== scopeOn) { scopeOn = so; $('scopeOv').classList.toggle('hide', !so); }
  const rel = me.reloadEnd ? Math.min(1, Math.min(now - (me.reloadEnd - W.reload), me.reloadEnd - now) / 280) : 0;
  const ease = (v) => v * v * (3 - 2 * v);
  const lower = ease(rel) * 0.16 + ease(me.draw) * 0.8; // 장전할 때는 살짝만 내려 탄창 갈아 끼우는 모습이 보이게
  const [kz, kr] = VM[W.vm].kick;
  me.sprT += ((me.sprint && me.alive ? 1 : 0) - me.sprT) * Math.min(1, dt * 10);
  const ad = ease(me.adsP), hip = 1 - ad, gp = vmGun(me.w), vp = VM[W.vm].pos, ap = gp.userData.ads;
  setGunAds(ad, gp.userData.info.aura); // 정조준할수록 스킨 빛·불티를 줄여 조준점 둘레를 깨끗하게
  gp.position.set(vp[0] + (ap[0] - vp[0]) * ad, vp[1] + (ap[1] - vp[1]) * ad, vp[2] + (ap[2] - vp[2]) * ad);
  me.land = Math.max(0, me.land - dt * 4.5);
  { // 점프하면 총이 한 박자 늦게 따라오고, 옆으로 걸으면 살짝 기울고, 가만히 있으면 숨결에 흔들림
    const vs = Math.cos(me.yaw) * me.vx - Math.sin(me.yaw) * me.vz, kk = Math.min(1, dt * 9);
    me.vmY += (clamp(-me.vy * 0.004, -0.03, 0.035) - me.vmY) * kk; me.vmR += (clamp(-vs * 0.011, -0.07, 0.07) - me.vmR) * kk;
  }
  const idle = Math.sin(now / 950) * 0.0022 * hip, dip = Math.sin(Math.min(1, me.land) * Math.PI) * 0.03;
  vm.position.set(Math.cos(me.bob) * 0.005 * hip, -Math.abs(Math.sin(me.bob)) * 0.007 * hip - me.sprT * 0.04 + (me.vmY + idle) * (0.35 + hip * 0.65) - dip, me.kickAnim * kz * (1 - ad * 0.5));
  vm.rotation.set(me.kickAnim * kr * 0.35 * (1 - ad * 0.6) - lower + me.swy * hip - me.sprT * 0.1 + idle * 0.8 - dip * 0.8, (0.04 + me.swx) * hip + me.sprT * 0.38 + ease(rel) * 0.22, ease(rel) * 0.42 + me.sprT * 0.18 + me.vmR * (0.3 + hip * 0.7));
  gp.rotation.x = me.kickAnim * kr * 0.65 * (1 - ad * 0.6);
  // 움직이는 부품: 슬라이드·노리쇠·펌프, 장전할 때 빠졌다 끼워지는 탄창
  const gi = gp.userData.info;
  if (gi.slide) {
    let tr = me.kickAnim;
    if (gi.rack) { const ts = (now - me.lastShot) / 1000; tr = ts > 0.16 && ts < 0.6 ? Math.sin(((ts - 0.16) / 0.44) * Math.PI) : 0; if (me.rackN && ts > 0.3) { me.rackN = 0; sfxReload('rack', 0.9); } }
    gi.slide.position.z = tr * gi.travel;
    if (gi.pump && gp.userData.lh) gp.userData.lh.position.z = tr * gi.travel;
  }
  if (gi.mag) {
    let d = 0;
    if (me.reloadEnd) { const p = clamp(1 - (me.reloadEnd - now) / W.reload, 0, 1); d = p < 0.25 ? ease(p / 0.25) : p < 0.6 ? 1 : 1 - ease((p - 0.6) / 0.3 > 1 ? 1 : (p - 0.6) / 0.3); }
    gi.mag.position.y = -d * 0.24; gi.mag.rotation.x = d * 0.25;
    const lh = gp.userData.lh;
    if (lh && !gi.pump) { lh.position.y = -d * 0.2; lh.position.z = d * 0.03; }
    if (gi.slide && !gi.rack && me.reloadEnd) { const p = clamp(1 - (me.reloadEnd - now) / W.reload, 0, 1); if (p > 0.84) { gi.slide.position.z = Math.sin(clamp((p - 0.84) / 0.14, 0, 1) * Math.PI) * gi.travel; } }
  }
  // 살펴보기: 총을 돌려 옆면을 보여 줌
  gp.rotation.y = 0; gp.rotation.z = 0;
  const fancy = fxOf(mySk[me.w], 1).kind, it = (now - me.inspAt) / (fancy ? 3200 : 2600);
  if (it >= 0 && it < 1) { // 살펴보기: 왼쪽 옆면 → 오른쪽 옆면 → (얼티밋) 총열 축으로 한 바퀴 돌리는 손기술
    const env = Math.sin(Math.PI * Math.min(1, it * 1.08)) ** 0.5, a = ease(clamp(it / 0.32, 0, 1)), b = ease(clamp((it - 0.34) / 0.22, 0, 1)), c = fancy ? ease(clamp((it - 0.5) / 0.28, 0, 1)) : 0;
    gp.rotation.y = (a * 1.05 - b * 1.6) * env; gp.rotation.z = (Math.sin(it * Math.PI * 2) * 0.22 + c * Math.PI * 2) * env + (c > 0 && c < 1 ? 0 : 0);
    gp.rotation.x += Math.sin(clamp((it - 0.5) / 0.28, 0, 1) * Math.PI) * (fancy ? 0.35 : 0);
    gp.position.x -= env * 0.12; gp.position.y += env * 0.06 + Math.sin(clamp((it - 0.5) / 0.28, 0, 1) * Math.PI) * (fancy ? 0.05 : 0); gp.position.z -= env * 0.06;
    if (fancy && c > 0 && c < 1) skinFire(0.05);
  }
  const dfx = (now - me.drawFx) / 750;
  if (dfx >= 0 && dfx < 1) { // 얼티밋 꺼내기: 아래에서 크게 돌며 올라와 제자리에 딱 멈춤
    const e = 1 - (1 - dfx) ** 3; gp.rotation.z += (1 - e) * Math.PI * 2; gp.position.y -= (1 - e) * 0.16; gp.position.x += (1 - e) * 0.06; gp.rotation.x += (1 - e) * 0.5; skinFire(0.04);
  }
  tickSkins(now / 1000); tickOps(now / 1000);
  if (flash.visible) { const m = gp.userData.muzzle; flash.position.set(gp.position.x + m[0], gp.position.y + m[1], gp.position.z + m[2] - 0.03); vmFlash.position.copy(flash.position); if (now > flash._off) flash.visible = false; }
  if (vmFlash.intensity > 0.01) vmFlash.intensity *= Math.exp(-dt * 38); else vmFlash.intensity = 0;
  vm.visible = me.alive && !scopeOn && !matchEnded && !me.drop && !car.id && !dbgCam;
  const tf = fovK() * (me.alive && me.scoped ? (W.scope && !scopeOn ? 62 : W.zoom || VM[W.vm].fov) : me.alive && car.id ? 75 + Math.min(10, Math.abs(car.sp) * 0.5) : me.alive && me.sprint ? 81 : 75);
  if (Math.abs(camera.fov - tf) > 0.05) { camera.fov += (tf - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
  if (hudCache.spr !== me.sprint) { hudCache.spr = me.sprint; $('sprintTag').classList.toggle('on', me.sprint); }

  if (now - lastSend >= 50 && me.alive) {
    lastSend = now;
    send({ t: 'in', p: [+me.x.toFixed(2), +me.y.toFixed(2), +me.z.toFixed(2)], r: [+me.yaw.toFixed(3), +me.pitch.toFixed(3)], w: me.w, c: me.crouch ? 1 : 0, a: me.drop ? 1 : 0, vy: car.id ? +car.yaw.toFixed(3) : undefined });
  }
  updateHud(now);
  if (UIL) applyTheme();
  updateVmLight(dt, now);
  present(drawGame, now, world.grade);
}
requestAnimationFrame(frame);

// 테스트·디버그용
window.__sc = { set cam(v) { dbgCam = v; }, get cam() { return dbgCam; }, loadMap, setMood, post, get postOn() { return postOn; }, fx: { explode, addSmoke, addTracer, puff, spark, emitSpark, emitChip, lightFlash, step: tickFx, set hold(v) { fxHold = v; } }, groundAt, renderer, scene, send, setWeapon, setParts, ew, gainSkinXp, impact, killFx, skXp, get parts() { return myParts; }, get mySk() { return mySk; }, unlocked, me, inv, others, dropMeshes, loot, zone, camera, car, vehs, get air() { return airdrop; }, get near() { return nearLoot; }, get world() { return world; }, get map() { return curMap; }, input, bomb, smokes, nadeMeshes, get myId() { return myId; }, get phase() { return phase; }, get attack() { return attack; }, get myTeam() { return myTeam; }, get mode() { return mode; }, get joined() { return joined; }, get roster() { return roster; }, get score() { return score; }, get shop() { return shopOpen; } };
