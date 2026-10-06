// SQUAD CLASH 트레일러 (46초) — 게임의 맵·캐릭터·스킨·효과를 그대로 써서 연출한다.
// 그냥 열면 [재생]을 눌러 소리와 함께 본다. ?render 로 열면 바깥(영상 만들기 스크립트)에서 window.__render(t) 로 한 장씩 그리고,
// window.__audio() 로 소리 전체를 WAV 로 받아 간다.
import * as THREE from './vendor/three.module.js';
import { MAPS, setMap, ARENA, groundAt, SKINS } from './shared.js';
import { makeGun, initGunEnv, tickSkins, setGunQuality, pulseSkin } from './guns.js';
import { buildWorld, setWorldQuality } from './world.js';
import { makeRig, rigHold, rigShot, rigMuzzle, animate, setAvatarFlash } from './avatar.js';
import { paintTex } from './paint.js';
import { initFx, flashTex, addTracer, emitSpark, emitChip, spark, puff, lightFlash, explode, glow, shock, updateFx } from './fx.js';
import { makePost, TONE } from './post.js';
import { initAudio, sfxShot, sfxBoom, sfxSkin, sfxUI } from './audio.js';
import { loadGunModels } from './gunmodels.js';
await loadGunModels(); // 게임과 같은 실제 총 모델

const DUR = 46, RENDER = /[?&]render/.test(location.search), $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: false });
renderer.setPixelRatio(1); renderer.autoClear = false; renderer.toneMapping = TONE;
setGunQuality('high'); initGunEnv(renderer); setWorldQuality('high', renderer);
const post = makePost(renderer, { samples: 4, levels: 5 });
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 600); camera.rotation.order = 'YXZ';
const worldOpt = { shadows: true, shadowSize: 2048, farK: 1, mood: 0, hdr: post.hdr, lin: true };
let world = null, mapNow = -1;
initFx(scene, camera, { hdr: post.hdr });
setAvatarFlash(flashTex);
function useMap(i) { if (mapNow === i) return; if (world) world.dispose(); setMap(i); world = buildWorld(scene, renderer, worldOpt); camera.far = world.far; camera.updateProjectionMatrix(); mapNow = i; }
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = stageCam.aspect = w / h; camera.updateProjectionMatrix(); stageCam.updateProjectionMatrix(); post.resize(); }

// ───────────── 무대 (스킨 쇼케이스·엔딩) ─────────────
const stage = new THREE.Scene(), stageCam = new THREE.PerspectiveCamera(32, 16 / 9, 0.01, 40);
stage.add(new THREE.HemisphereLight(0xffffff, 0x404858, 1.4));
const key = new THREE.DirectionalLight(0xfff4e8, 2.4); key.position.set(-1, 2, 2); stage.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 3); rim.position.set(1.5, 0.8, -2.5); stage.add(rim);
const under = new THREE.PointLight(0xffffff, 1.2, 3, 2); under.position.set(0, -0.35, 0.3); stage.add(under);
const bgTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d'), rg = g.createRadialGradient(256, 230, 10, 256, 256, 300); rg.addColorStop(0, '#6a7690'); rg.addColorStop(0.45, '#262c3a'); rg.addColorStop(1, '#05060a'); g.fillStyle = rg; g.fillRect(0, 0, 512, 512); g.globalAlpha = 0.08; for (let y = 0; y < 512; y += 4) { g.fillStyle = y % 8 ? '#000' : '#fff'; g.fillRect(0, y, 512, 1); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const bg = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), new THREE.MeshBasicMaterial({ map: bgTex, color: 0xffffff, depthWrite: false, fog: false })); bg.position.set(0, 0, -5); stage.add(bg);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2; ring.position.y = -0.26; stage.add(ring);
const pivot = new THREE.Group(); stage.add(pivot);
let stageGun = null, stageKey = '';
function stageShow(wi, sk) { const k = wi + ':' + sk; if (k === stageKey) return; stageKey = k; if (stageGun) pivot.remove(stageGun); const info = makeGun(wi, sk, [], 5), g = info.group, b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3()); g.position.sub(c); stageGun = new THREE.Group(); stageGun.add(g); stageGun.scale.setScalar(0.74 / Math.max(0.3, b.getSize(new THREE.Vector3()).z)); pivot.add(stageGun); } // 총 길이를 맞춰 글자와 겹치지 않게

// ───────────── 분대 (전투 장면) ─────────────
const teamMat = [0xff4d5a, 0x3d9bff].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
const RED = [22, 21, 18, 23], BLUE = [24, 20, 19, 14], squad = [];
function buildSquad() {
  if (squad.length) return;
  for (let t = 0; t < 2; t++) for (let i = 0; i < 4; i++) {
    const r = makeRig(paintTex('tr' + t + i, 'bot', 11 + t * 17 + i * 5), teamMat[t]);
    rigHold(r, i === 3 ? 15 : 13, (t ? BLUE : RED)[i], [], 5);
    const x = (t ? 1 : -1) * (7 + (i % 2) * 2.6), z = -4.5 + i * 3;
    r.body.position.set(x, groundAt(x, z), z); r.body.rotation.y = t ? Math.PI / 2 : -Math.PI / 2;
    r.team = t; r.sk = (t ? BLUE : RED)[i]; r.alive = true; scene.add(r.body); squad.push(r);
  }
}
function dropSquad() { for (const r of squad) scene.remove(r.body); squad.length = 0; }
const _m = new THREE.Vector3(), rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const fxOf = (sk) => { const id = SKINS[sk].id; return { crimson: [0xff6a1a, 'mecha'], dragon: [0xff2a1a, 'dragon'], phoenix: [0xffb040, 'phoenix'], aqua: [0x4ae8ff, 'aqua'], darkmatter: [0xb05cff, 'void'], orion: [0xffffff, 'star'], atomic: [0xff6a1a, 'reactor'], platinum: [0x7fdcff, 'prime'] }[id] || [0xffd890, '']; };
function fire(r, target) { // 한 발: 반동, 총구 불꽃, 굵은 궤적, 맞은 자리 불티
  rigShot(r); rigMuzzle(r, _m); const [col] = fxOf(r.sk), a = [_m.x, _m.y, _m.z];
  addTracer(a, target, col, 0.16, 1.5); addTracer(a, target, 0xffffff, 0.16, 0.45);
  emitSpark(target, [-(target[0] - a[0]) * 0.1, 0.4, 0], 6, 4, col, 0.4, 8); glow(target[0], target[1], target[2], col, 0.1, 0.55, 0.2); lightFlash(a[0], a[1], a[2], col, 20, 10, 0.06);
}
function killBurst(x, y, z, col) { glow(x, y, z, 0xffffff, 0.3, 2.6, 0.35, { c1: col }); shock(x, groundAt(x, z) + 0.06, z, col, 5, 0.5); emitSpark([x, y, z], [0, 1, 0], 40, 7, col, 0.9, 6, 1); lightFlash(x, y, z, col, 80, 14, 0.35); }

// ───────────── 글자 ─────────────
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x)), win = (t, a, b, f = 0.25) => ease((t - a) / f) * (1 - ease((t - b + f) / f));
// 장면마다 글자 상태를 계산 (같은 상태로 화면 글자와 영상 글자를 그림)
function uiState(t) {
  const lk = Math.min(1, win(t, 0.6, 3.6, 0.35) + (t > 41.2 ? ease((t - 41.2) / 0.5) : 0));
  const S = { logo: { op: lk, sc: t < 4 ? 1.25 - 0.25 * ease((t - 0.6) / 0.5) + (t - 0.6) * 0.012 : 1 + (t - 41.2) * 0.01, top: t > 40 ? 0.36 : 0.44, sub: t > 40 ? '' : '모바일 브라우저 멀티플레이 FPS' } };
  const M = MAPN.find((m) => t >= m[0] && t < m[1]);
  let cap = null;
  if (M) cap = [M[2], M[3], M[0], M[1]];
  else if (t >= 13 && t < 17.5) cap = ['실시간 멀티플레이', '5 VS 5 · 봇과도 바로', 13, 17.5];
  else if (t >= 36 && t < 41) cap = ['생존전 · 외딴 섬', '하늘에서 낙하 · 최후의 1인', 36, 41];
  S.cap = cap ? { t: cap[0], s: cap[1], op: win(t, cap[2], cap[3], 0.3) } : null;
  S.mid = t >= 17.6 && t < 21.8 ? { t: '폭탄전 · 팀 데스매치 · 생존전', s: '세 가지 모드', op: win(t, 17.6, 21.8, 0.3) } : null;
  const W = SHOW.find((w) => t >= w[0] && t < w[0] + 2);
  if (W) S.skin = { tier: SKINS[W[1]].tier, t: SKINS[W[1]].name, s: W[4], col: W[3], op: win(t, W[0], W[0] + 2, 0.22) };
  else if (t >= 33.98 && t < 36) S.skin = { tier: '21종', t: '스킨 컬렉션', s: '총 모양 · 소리 · 이펙트가 통째로 바뀜', col: '#ffd23f', op: win(t, 34, 36, 0.25) };
  S.end = t > 42 ? ease((t - 42) / 0.5) : 0;
  S.fade = t < 0.5 ? 1 - t / 0.5 : t > 45.2 ? ease((t - 45.2) / 0.8) : 0;
  const cut = CUTS.reduce((m, c) => Math.min(m, Math.abs(t - c)), 9); S.flash = cut < 0.12 ? (1 - cut / 0.12) * 0.55 : 0;
  return S;
}
const URL_TXT = '설치 없이 · 무료 · squadclash-394173969859.asia-northeast3.run.app';
function setText(id, html) { const e = $(id); if (e.dataset.h !== html) { e.dataset.h = html; e.innerHTML = html; } }
function ui(t) { // 화면(브라우저로 볼 때)
  const S = uiState(t), L = $('logo');
  L.style.opacity = S.logo.op; L.style.transform = `translate(-50%,-50%) scale(${S.logo.sc})`; L.style.top = S.logo.top * 100 + '%'; L.lastElementChild.textContent = S.logo.sub;
  const C = $('cap'); if (S.cap) { setText('cap', `<b>${S.cap.t}</b><span>${S.cap.s}</span>`); C.style.opacity = S.cap.op; C.style.transform = `translateX(${(1 - S.cap.op) * -4}vw)`; } else C.style.opacity = 0;
  if (S.mid) setText('mid', `<b>${S.mid.t}</b><span>${S.mid.s}</span>`); $('mid').style.opacity = S.mid ? S.mid.op : 0;
  const K = $('skin'); if (S.skin) { setText('skin', `<em>${S.skin.tier}</em><b style="color:${S.skin.col}">${S.skin.t}</b><span>${S.skin.s}</span>`); K.style.opacity = S.skin.op; K.style.transform = `translate(${(1 - S.skin.op) * 3}vw,-50%)`; } else K.style.opacity = 0;
  const E = $('end'); E.style.opacity = S.end; E.lastElementChild.textContent = URL_TXT;
  $('fade').style.opacity = S.fade; $('flash').style.opacity = S.flash;
}
// 영상: 3D 화면 위에 글자를 직접 그려 한 장으로 합침
const outCv = document.createElement('canvas'), og = outCv.getContext('2d');
const FONT = 'system-ui,-apple-system,"Noto Sans KR","Noto Sans CJK KR",sans-serif';
function composite(t) {
  const W = outCv.width = renderer.domElement.width, H = outCv.height = renderer.domElement.height, vh = H / 100, S = uiState(t);
  og.drawImage(renderer.domElement, 0, 0);
  og.fillStyle = '#000'; og.fillRect(0, 0, W, 6.5 * vh); og.fillRect(0, H - 6.5 * vh, W, 6.5 * vh); // 영화 띠
  const txt = (s, x, y, size, o = {}) => { og.save(); og.globalAlpha = o.a ?? 1; og.font = `${o.it ? 'italic ' : ''}${o.w || 900} ${size}px ${FONT}`; og.textAlign = o.al || 'left'; og.textBaseline = 'alphabetic'; if (o.ls) og.letterSpacing = o.ls + 'px'; if (o.glow) { og.shadowColor = o.glow; og.shadowBlur = o.blur || size * 0.4; } og.fillStyle = o.fill || '#fff'; og.fillText(s, x, y); og.restore(); };
  if (S.logo.op > 0.01) { og.save(); og.translate(W / 2, S.logo.top * H); og.scale(S.logo.sc, S.logo.sc); const gr = og.createLinearGradient(0, -6 * vh, 0, 4 * vh); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#ffe08a'); gr.addColorStop(1, '#ff7a2a');
    txt('SQUAD CLASH', 0, 3.5 * vh, 11 * vh, { al: 'center', it: true, a: S.logo.op, fill: gr, glow: 'rgba(255,140,40,.8)', blur: 2.5 * vh, ls: 0.6 * vh }); txt('스쿼드 클래시', 0, 8.5 * vh, 2.6 * vh, { al: 'center', w: 800, a: S.logo.op, fill: '#ffd9a0', ls: 1.4 * vh, glow: 'rgba(255,150,60,.8)' });
    if (S.logo.sub) txt(S.logo.sub, 0, 13 * vh, 2.2 * vh, { al: 'center', w: 700, a: S.logo.op * 0.9, fill: '#e8edf5', ls: 0.3 * vh }); og.restore(); }
  if (S.cap && S.cap.op > 0.01) { const x = 0.07 * W - (1 - S.cap.op) * 0.04 * W, y = H - 13 * vh; txt(S.cap.t, x, y - 4 * vh, 6 * vh, { it: true, a: S.cap.op, glow: 'rgba(0,0,0,.85)', blur: 1.6 * vh });
    og.save(); og.globalAlpha = S.cap.op; og.font = `800 ${2.2 * vh}px ${FONT}`; og.letterSpacing = 0.3 * vh + 'px'; const w = og.measureText(S.cap.s).width + 2.8 * vh, gr = og.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#ff3a2a'); gr.addColorStop(1, '#ff8a2a'); og.fillStyle = gr; og.shadowColor = 'rgba(255,90,40,.6)'; og.shadowBlur = 2 * vh; og.fillRect(x, y - 1.2 * vh, w, 3.6 * vh); og.restore(); txt(S.cap.s, x + 1.4 * vh, y + 1.5 * vh, 2.2 * vh, { w: 800, a: S.cap.op, ls: 0.3 * vh }); }
  if (S.mid && S.mid.op > 0.01) { txt(S.mid.t, W / 2, H / 2, 7 * vh, { al: 'center', it: true, a: S.mid.op, glow: 'rgba(0,0,0,.95)', blur: 3 * vh }); txt(S.mid.s, W / 2, H / 2 + 4.5 * vh, 2.6 * vh, { al: 'center', w: 800, a: S.mid.op, fill: '#ffd9a0', ls: 0.8 * vh }); }
  if (S.skin && S.skin.op > 0.01) { const x = W - 0.07 * W + (1 - S.skin.op) * 0.03 * W, y = H / 2;
    og.save(); og.globalAlpha = S.skin.op; og.font = `900 ${2.1 * vh}px ${FONT}`; og.letterSpacing = 0.6 * vh + 'px'; const tw = og.measureText(S.skin.tier).width + 2.4 * vh; og.fillStyle = 'rgba(255,255,255,.14)'; og.strokeStyle = 'rgba(255,255,255,.45)'; og.fillRect(x - tw, y - 7.6 * vh, tw, 3.4 * vh); og.strokeRect(x - tw, y - 7.6 * vh, tw, 3.4 * vh); og.restore();
    txt(S.skin.tier, x - 1.2 * vh, y - 5.1 * vh, 2.1 * vh, { al: 'right', a: S.skin.op, ls: 0.6 * vh }); txt(S.skin.t, x, y + 2 * vh, 6.2 * vh, { al: 'right', it: true, a: S.skin.op, fill: S.skin.col, glow: S.skin.col, blur: 2.4 * vh }); txt(S.skin.s, x, y + 5.6 * vh, 2 * vh, { al: 'right', w: 700, a: S.skin.op, fill: '#cfd8e6', ls: 0.15 * vh }); }
  if (S.end > 0.01) { og.save(); og.globalAlpha = S.end; og.font = `900 ${3 * vh}px ${FONT}`; og.letterSpacing = 0.36 * vh + 'px'; const bw = og.measureText('지금 바로 플레이').width + 6 * vh, by = H - 16 * vh - 5.4 * vh, gr = og.createLinearGradient(W / 2 - bw / 2, 0, W / 2 + bw / 2, 0); gr.addColorStop(0, '#ffd23f'); gr.addColorStop(1, '#ff8a2a'); og.fillStyle = gr; og.shadowColor = 'rgba(255,170,60,.6)'; og.shadowBlur = 3 * vh; og.beginPath(); og.roundRect(W / 2 - bw / 2, by, bw, 5.4 * vh, vh); og.fill(); og.restore();
    txt('지금 바로 플레이', W / 2, by + 3.8 * vh, 3 * vh, { al: 'center', a: S.end, fill: '#14161a', ls: 0.36 * vh }); txt(URL_TXT, W / 2, H - 16 * vh + 3.4 * vh, 2 * vh, { al: 'center', w: 700, a: S.end, fill: '#dfe6ef' }); }
  if (S.flash > 0) { og.globalCompositeOperation = 'screen'; og.fillStyle = `rgba(255,255,255,${S.flash})`; og.fillRect(0, 0, W, H); og.globalCompositeOperation = 'source-over'; }
  if (S.fade > 0) { og.fillStyle = `rgba(0,0,0,${S.fade})`; og.fillRect(0, 0, W, H); }
  return outCv.toDataURL('image/jpeg', 0.9);
}

// ───────────── 장면 순서 ─────────────
// 맵 비행: [시작, 끝, 이름, 설명, 맵 번호]
const MAPN = [[3.5, 5.4, '사막 마을', '폭탄전 · 팀 데스매치', 0], [5.4, 7.3, '옛 성', '성벽과 안뜰', 3], [7.3, 9.2, '기차역', '긴 승강장 저격전', 2], [9.2, 11.1, '부두 야적장', '컨테이너 사이 근접전', 1], [11.1, 13, '도심 교차로', '네온이 켜진 밤', 4]];
// 스킨: [시작, 스킨 번호, 총 번호, 글자 색, 설명]
const SHOW = [[22, 22, 13, '#ff5a3a', '검은 비늘 · 용 머리 총구 · 번개 고리'], [24, 21, 13, '#ff8a3a', '흰 장갑판 · 빛나는 에너지 코어'], [26, 24, 13, '#6ae8ff', '흰·파랑 메카 · 결정 코어'], [28, 23, 15, '#ffc24a', '금빛 깃털 날개 · 불꽃 코어'], [30, 20, 13, '#c08bff', '떠 있는 검은 구슬 · 블랙홀 총구'], [32, 18, 16, '#ff7a2a', '유리관 노심 · 테슬라 코일']];
const CUTS = [3.5, 13, 22, 24, 26, 28, 30, 32, 34, 36, 41];
let last = -1, prevT = 0;
function frame(t) {
  const dt = Math.max(0, Math.min(0.1, t - prevT)); prevT = t;
  if (!RENDER) ui(t);
  if (t < 3.5 || t >= 22) { drawStage(t, dt); }
  else drawWorld(t, dt);
  last = t;
}
function drawWorld(t, dt) {
  const M = MAPN.find((m) => t >= m[0] && t < m[1]);
  if (M) { useMap(M[4]); const u = (t - M[0]) / (M[1] - M[0]), a0 = M[4] * 1.3 + 0.6, a = a0 + u * 0.55, R = ARENA.hx * (0.62 - u * 0.12), h = 24 - u * 8; camera.position.set(Math.cos(a) * R, h, Math.sin(a) * R * (ARENA.hz / ARENA.hx)); camera.lookAt(Math.cos(a + 1.2) * 6, 2, Math.sin(a + 1.2) * 6); }
  else if (t < 22) { // 전투
    useMap(4); buildSquad();
    const u = t - 13;
    if (u < 4.6) { const k = u / 4.6; camera.position.set(-15 + k * 3, 1.8 + k * 0.3, 2.5 - k * 1.5); camera.lookAt(8, 1.2, -0.5 + k); }
    else if (u < 7) { const k = (u - 4.6) / 2.4; camera.position.set(-6 + k * 10, 2.2, 9 - k * 1); camera.lookAt(-1 + k * 6, 1.1, 0); }
    else { const k = (u - 7) / 2; camera.position.set(15.5 - k * 2.5, 1.9 + k * 0.4, -2.5 + k * 1.5); camera.lookAt(-8, 1.2, 0.5 - k); } // 파랑팀 뒤에서 빨강팀을 봄
    for (const r of squad) { if (r.alive) animate(r, dt, { speed: 0, pitch: 0 }); else animate(r, dt, { dead: true, fall: 0 }); }
    // 정해진 박자에 맞춰 쏨 (영상과 소리가 같은 표를 씀)
    for (const s of SHOTS) if (s[0] > t - dt && s[0] <= t) { const r = squad[s[1]]; if (!r || !r.alive) continue; const tgt = squad[s[2]]; fire(r, [tgt.body.position.x + (rnd() - 0.5) * 0.8, tgt.body.position.y + 1 + (rnd() - 0.5) * 0.8, tgt.body.position.z + (rnd() - 0.5) * 0.8]); }
    if (t - dt < 16.1 && t >= 16.1) explode(9.5, groundAt(9.5, 4) + 0.2, 4, 0);
    if (t - dt < 19.6 && t >= 19.6) explode(7.5, groundAt(7.5, -3) + 0.2, -3, 0);
    for (const k of KILLS) if (k[0] > t - dt && k[0] <= t) { const r = squad[k[1]]; r.alive = false; const p = r.body.position; killBurst(p.x, p.y + 1.1, p.z, fxOf(squad[k[2]].sk)[0]); }
  }
  world.update(camera.position, dt); updateFx(dt); tickSkins(t);
  post.setGrade(world.grade || { bloom: 0.6 }); post.begin(); renderer.clear(); renderer.render(scene, camera); post.end(t);
}
function drawStage(t, dt) {
  let wi = 13, sk = 22, col = 0xff5a3a, spin = t * 0.5;
  if (t < 3.5) { sk = 22; col = 0xff6a20; }
  else if (t >= 41) { sk = 22; col = 0xff5a3a; }
  else if (t >= 34) { const i = Math.floor((t - 34) * 3) % 21; sk = i + 1; wi = 13; col = 0xffd23f; }
  else { const S = SHOW.find((s) => t >= s[0] && t < s[0] + 2) || SHOW[0]; sk = S[1]; wi = S[2]; col = new THREE.Color(S[3]).getHex(); spin = (t - S[0]) * 0.7 - 0.5; }
  if (t >= 36 && t < 41) { drawIsle(t, dt); return; }
  stageShow(wi, sk);
  for (const c of CUTS) if (c > t - dt && c <= t) pulseSkin();
  const dim = t < 3.5 ? 0.35 : t >= 41 ? 0.3 : 1;
  rim.color.setHex(col); under.color.setHex(col); ring.material.color.setHex(col).multiplyScalar(dim); bg.material.color.setHex(col).lerp(new THREE.Color(1, 1, 1), 0.55).multiplyScalar(dim);
  const side = t >= 22 && t < 36; pivot.position.x = side ? -0.2 : 0; pivot.rotation.set(0.12, Math.PI / 2 + Math.sin(spin) * 0.6, 0);
  const d = t >= 34 && t < 36 ? 1.2 : t < 3.5 || t >= 41 ? 1.5 : 1.1 - ((t - 22) % 2) * 0.04;
  stageCam.position.set(side ? 0.05 : 0, t < 3.5 || t >= 41 ? -0.15 : 0.03, d); stageCam.lookAt(side ? 0.05 : 0, t < 3.5 || t >= 41 ? -0.08 : 0, 0);
  tickSkins(t);
  post.setGrade({ bloom: 0.75, thresh: 0.9, sat: 1.08, con: 1.06, vig: 0.45, grain: 0.01 }); post.begin(); renderer.clear(); renderer.render(stage, stageCam); post.end(t);
}
function drawIsle(t, dt) {
  useMap(5); dropSquad();
  const u = (t - 36) / 5, a = 0.4 + u * 0.5, R = 260 - u * 80;
  camera.position.set(Math.cos(a) * R, 140 - u * 50, Math.sin(a) * R); camera.lookAt(0, 10, 0);
  world.update(camera.position, dt); updateFx(dt);
  post.setGrade(world.grade || { bloom: 0.5 }); post.begin(); renderer.clear(); renderer.render(scene, camera); post.end(t);
}
// 전투 박자표: [시각, 쏘는 사람, 맞는 사람]  (0~3 빨강, 4~7 파랑)
const SHOTS = [], KILLS = [[15.4, 5, 0], [18.2, 1, 6], [20.6, 7, 2]];
{ let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); for (let tt = 13.3; tt < 21.8; tt += 0.09 + r() * 0.12) { const red = r() < 0.5, a = (red ? 0 : 4) + Math.floor(r() * 4), b = (red ? 4 : 0) + Math.floor(r() * 4); SHOTS.push([+tt.toFixed(3), a, b]); } }

// ───────────── 소리 (게임 소리 + 배경 음악) ─────────────
const SR = 44100;
async function renderAudio() {
  const ctx = new OfflineAudioContext(2, SR * DUR, SR); let at = 0;
  Object.defineProperty(ctx, 'currentTime', { get: () => at });
  const Real = window.AudioContext; window.AudioContext = function () { return ctx; }; initAudio(); window.AudioContext = Real;
  const out = ctx.createGain(); out.gain.value = 0.55; out.connect(ctx.destination);
  const nb = ctx.createBuffer(1, SR * 2, SR), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const tone = (t0, dur, type, f0, f1, v, dst = out) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(dst); o.start(t0); o.stop(t0 + dur + 0.02); };
  const noise = (t0, dur, type, f, v, q = 1, f1 = f) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = nb; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t0); if (f1 !== f) fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(fl).connect(g).connect(out); s.start(t0, Math.random()); s.stop(t0 + dur + 0.02); };
  const pad = (t0, dur, f, v) => { for (const d of [1, 1.005, 0.995]) { const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f * d; fl.type = 'lowpass'; fl.frequency.value = 900; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.4); g.gain.setValueAtTime(v, t0 + dur - 0.5); g.gain.linearRampToValueAtTime(0.0001, t0 + dur); o.connect(fl).connect(g).connect(out); o.start(t0); o.stop(t0 + dur + 0.05); } };
  const kick = (t0, v = 1) => { tone(t0, 0.32, 'sine', 140, 40, 0.9 * v); noise(t0, 0.02, 'highpass', 3000, 0.12 * v); };
  const snare = (t0, v = 1) => { noise(t0, 0.18, 'bandpass', 1800, 0.45 * v, 0.8); tone(t0, 0.1, 'triangle', 220, 160, 0.25 * v); };
  const hat = (t0, v = 1) => noise(t0, 0.04, 'highpass', 8000, 0.12 * v);
  const riser = (t0, dur, v = 0.35) => { noise(t0, dur, 'bandpass', 300, v, 2, 6000); tone(t0, dur, 'sawtooth', 110, 880, v * 0.25); };
  const hit = (t0, v = 1) => { tone(t0, 1.4, 'sine', 70, 30, 0.9 * v); noise(t0, 1.2, 'lowpass', 4000, 0.5 * v, 0.7, 120); tone(t0, 0.6, 'sawtooth', 220, 55, 0.2 * v); };
  const B = 0.5, ROOT = [55, 43.65, 65.41, 49]; // 120BPM, A-F-C-G
  // 도입: 낮은 울림과 끌어올림
  pad(0, 3.6, 55, 0.05); riser(1.6, 1.9, 0.3); hit(3.5, 1.1);
  // 본편 박자
  for (let t0 = 3.5; t0 < 41; t0 += B) {
    const beat = Math.round((t0 - 3.5) / B), bar = Math.floor(beat / 4), drop = t0 >= 13 && t0 < 22 || t0 >= 22 && t0 < 36, brk = t0 >= 36;
    if (brk) { if (beat % 4 === 0) kick(t0, 0.6); continue; }
    kick(t0, beat % 2 ? 0.7 : 1); if (beat % 4 === 2 || (drop && beat % 4 === 3 && bar % 2)) snare(t0, beat % 4 === 2 ? 1 : 0.5);
    hat(t0 + B / 2, 0.8); if (drop) { hat(t0 + B / 4, 0.4); hat(t0 + B * 0.75, 0.4); }
    const f = ROOT[bar % 4]; tone(t0, B * 0.9, 'sawtooth', f, f, 0.16); tone(t0 + B / 2, B * 0.4, 'sawtooth', f * 2, f * 2, 0.08);
    if (t0 >= 22 && t0 < 36) { const arp = [1, 1.5, 2, 3][beat % 4]; tone(t0, 0.22, 'triangle', f * 8 * arp, f * 8 * arp, 0.05); tone(t0 + B / 2, 0.2, 'triangle', f * 6 * arp, f * 6 * arp, 0.04); }
    if (beat % 16 === 0) pad(t0, B * 16, f * 4, 0.03);
  }
  riser(11.2, 1.8); hit(13, 0.9); riser(20.2, 1.8); hit(22, 1); riser(34.5, 1.5, 0.25); hit(36, 0.8);
  pad(36, 5.2, 55, 0.06); pad(36, 5.2, 82.4, 0.04); riser(39, 2, 0.4); hit(41, 1.3); pad(41, 5, 55, 0.07); pad(41, 5, 65.4, 0.05); pad(41, 5, 82.4, 0.05);
  for (const c of [5.4, 7.3, 9.2, 11.1]) noise(c - 0.25, 0.35, 'bandpass', 600, 0.25, 1.5, 5000); // 맵 넘길 때 휙
  // 게임 소리: 전투 총성, 폭발, 처치, 스킨 장착음
  const at_ = (t, fn) => { at = t; fn(); };
  for (const s of SHOTS) at_(s[0], () => { const red = s[1] < 4; sfxShot(s[1] % 4 === 3 ? 15 : 13, 0.32, red ? -0.35 : 0.35); const k = fxOf((red ? RED : BLUE)[s[1] % 4])[1]; if (k && rnd() < 0.5) sfxSkin(k, 'shot', 0.28, red ? -0.3 : 0.3); });
  at_(16.1, () => sfxBoom(0.8, 1.6, 0.3)); at_(19.6, () => sfxBoom(0.8, 1.6, -0.2));
  for (const k of KILLS) at_(k[0], () => { const t2 = squadSkin(k[2]); sfxSkin(fxOf(t2)[1], 'kill', 0.7); sfxUI('kill', 0.6); });
  for (const S of SHOW) at_(S[0] + 0.05, () => { sfxSkin(fxOf(S[1])[1], 'equip', 0.75); });
  for (const S of SHOW) for (let i = 0; i < 3; i++) at_(S[0] + 0.9 + i * 0.13, () => { sfxShot(S[2], 0.3, 0); sfxSkin(fxOf(S[1])[1], 'shot', 0.4); });
  at_(41, () => sfxSkin('dragon', 'kill', 0.6));
  const buf = await ctx.startRendering();
  return buf;
}
const squadSkin = (i) => (i < 4 ? RED[i] : BLUE[i - 4]);
function wav(buf) { // 16비트 스테레오 WAV
  const n = buf.length, L = buf.getChannelData(0), Rr = buf.getChannelData(1), dv = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i])); const g = peak > 0.98 ? 0.98 / peak : 1;
  for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] * g)) * 32767, true); dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rr[i] * g)) * 32767, true); }
  return new Uint8Array(dv.buffer);
}

addEventListener('resize', resize); resize();
if (RENDER) {
  window.__render = (t, shot) => { window.__vt = t * 1000; frame(t); return shot ? composite(t) : true; };
  window.__audio = async () => { const b = wav(await renderAudio()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  window.__ready = true;
} else {
  $('start').onclick = async () => {
    $('start').innerHTML = '불러오는 중…';
    const buf = await renderAudio(), ac = new AudioContext(), src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination);
    $('start').remove(); const t0 = performance.now(); src.start();
    const loop = () => { const t = (performance.now() - t0) / 1000; if (t < DUR) { frame(t); requestAnimationFrame(loop); } else { $('ui').querySelector('#fade').style.opacity = 1; } };
    loop();
  };
}
