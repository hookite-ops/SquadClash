// SQUAD CLASH — 3인칭 캐릭터의 뼈대와 동작
// 몸은 paint.js 의 buildBody 가 만든다 (엉덩이·허리·무릎·팔꿈치 관절). 여기서는 총을 쥐여 주고, 매 프레임 자세를 잡는다:
// 걷기·달리기(무릎이 굽음), 앉기(한쪽 무릎을 꿇음), 점프, 몸 기울임, 사격 반동, 맞았을 때 움찔, 쓰러짐.
import * as THREE from './vendor/three.module.js';
import { WEAPONS } from './shared.js';
import { makeGun, gunBox } from './guns.js';
import { buildBody } from './paint.js';

const TH = 0.38, SHIN = 0.38, UA = 0.36, FA = 0.38, REACH = UA + FA - 0.012;
const SHO = [new THREE.Vector3(0.3575, 0.05, 0.02), new THREE.Vector3(-0.3575, 0.05, 0.02)]; // 어깨: 오른쪽·왼쪽 (팔 묶음의 중심 기준, 몸통을 틀지 않았을 때)
const DOWN = new THREE.Vector3(0, -1, 0);
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Vector3(), _h = new THREE.Vector3(), _t = new THREE.Vector3();
const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (v) => v * v * (3 - 2 * v);
// 총을 들지 않았을 때(쓰러짐 등) 손이 가는 자리
const RAG_R = new THREE.Vector3(0.62, -0.22, -0.12), RAG_L = new THREE.Vector3(-0.6, -0.16, -0.2), NOH = { r: new THREE.Vector3(0.3, -0.5, -0.1), l: new THREE.Vector3(-0.3, -0.5, -0.1), twist: 0, muzzle: new THREE.Vector3(0.2, 0, -0.9) };

let flashTex = null;
export function setAvatarFlash(tex) { flashTex = tex; }

export function makeRig(tex, bandMat) {
  const r = buildBody(tex, bandMat);
  r.guns = []; r.hands = []; r.w = -1; r.flash = null;
  r.an = { walk: 0, cr: 0, air: 0, spr: 0, kick: 0, flinch: 0, lean: 0, roll: 0, dead: 0, deadT: 0, t: Math.random() * 9, fall: 0, tw: 0.3, hr: new THREE.Vector3(0.2, -0.07, -0.34), hl: new THREE.Vector3(0.2, 0, -0.7) };
  return r;
}
// 무기를 쥐여 줌 (모델은 처음 필요할 때 만든다). sk·parts·lv = 스킨, 파츠, 스킨 레벨
export function rigHold(o, wi, sk = 0, parts = null, lv = 1) {
  if (!WEAPONS[wi] || o.w === wi) return;
  if (!o.guns[wi]) {
    const info = makeGun(wi, sk, parts, lv), gg = info.group, vm = WEAPONS[wi].vm, kind = vm === 'knife' ? 2 : vm === 'pistol' ? 1 : 0, sc = kind ? 1.3 : 1.2;
    const back = kind === 0 ? Math.max(0.24, gunBox(gg).max.z) : 0; // 개머리판 끝까지의 길이 → 어깨 앞에 닿게 놓음
    const pos = kind === 2 ? [0.3, -0.2, -0.34] : kind === 1 ? [0.06, 0.0, -0.5] : [0.2, 0.05, -0.02 - back * sc];
    gg.scale.setScalar(sc); gg.position.set(pos[0], pos[1], pos[2]);
    o.arms.add(gg); o.guns[wi] = gg;
    const at = (v) => new THREE.Vector3(pos[0] + v[0] * sc, pos[1] + v[1] * sc, pos[2] + v[2] * sc), r = at(info.grip);
    o.hands[wi] = { r, l: kind === 0 ? at(info.fore) : kind === 1 ? r.clone().add(_t.set(-0.075, -0.015, 0.012)) : new THREE.Vector3(-0.34, -0.5, -0.12), twist: kind === 0 ? 0.42 : kind === 1 ? 0.1 : 0.22, muzzle: at(info.muzzle) };
  }
  o.guns.forEach((gg, i) => { if (gg) gg.visible = i === wi; });
  o.w = wi;
}
// 사격: 팔이 뒤로 튀고 총구에 불꽃이 번쩍임
export function rigShot(o, quiet) {
  o.an.kick = 1;
  if (quiet || !flashTex) return;
  if (!o.flash) { o.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: 0xffd9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); o.flash.visible = false; o.arms.add(o.flash); }
  const H = o.hands[o.w] || NOH;
  o.flash.position.copy(H.muzzle); o.flash.position.z -= 0.08; o.flash.scale.setScalar(0.55 + Math.random() * 0.3); o.flash.material.rotation = Math.random() * 3; o.flash.visible = true; o.flashT = 0.055;
}
export function rigFlinch(o) { o.an.flinch = 1; }

// 두 토막 팔: 어깨 S 에서 손 자리 H 까지. 닿지 않으면 총을 따라 몸 쪽으로 당겨 잡는다. side = 팔꿈치가 벌어지는 쪽 (+1 오른쪽, -1 왼쪽)
function solveArm(arm, S, H, side) {
  _d.subVectors(H, S);
  let d = _d.length();
  if (d > REACH) { const r2 = REACH * REACH - _d.x * _d.x - _d.y * _d.y; if (r2 > 0.0004 && _d.z < 0) _d.z = -Math.sqrt(r2); else _d.multiplyScalar(REACH / d); d = REACH; }
  if (d < 0.08) { _d.set(0, -0.08, 0); d = 0.08; }
  _u.copy(_d).divideScalar(d);
  const cosA = clampN((UA * UA + d * d - FA * FA) / (2 * UA * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  _p.set(side * 0.6, -1, 0.3); _p.addScaledVector(_u, -_p.dot(_u)).normalize();
  _e.copy(S).addScaledVector(_u, UA * cosA).addScaledVector(_p, UA * sinA); // 팔꿈치
  arm.up.position.copy(S); arm.up.quaternion.setFromUnitVectors(DOWN, _h.subVectors(_e, S).normalize());
  arm.fore.position.copy(_e); arm.fore.quaternion.setFromUnitVectors(DOWN, _h.copy(S).add(_d).sub(_e).normalize());
}

// 매 프레임 자세 잡기.
// s = { speed 빠르기(m/s), vf 앞으로·vs 오른쪽으로 가는 빠르기, pitch 올려다보는 각, crouch, air 공중, sprint 달리기, seated 차에 탐, dead 쓰러짐 }
export function animate(o, dt, s) {
  const a = o.an;
  a.t += dt;
  if (o.flash && o.flash.visible) { o.flashT -= dt; if (o.flashT <= 0) o.flash.visible = false; }
  if (s.dead) {
    if (!a.dead) { a.dead = 1; a.deadT = 0; a.fall = s.fall === undefined ? ((o.id || 0) * 7 + Math.floor(a.t * 10)) % 3 : s.fall; for (const g of o.guns) if (g) g.visible = false; if (o.flash) o.flash.visible = false; }
    a.deadT += dt;
  } else if (a.dead) { a.dead = 0; a.deadT = 0; o.body.rotation.set(0, 0, 0); o.body.position.y = 0; if (o.guns[o.w]) o.guns[o.w].visible = true; }
  const H = o.hands[o.w] || NOH, sp = s.dead ? 0 : s.speed || 0, f = a.dead ? ease(Math.min(1, a.deadT / 0.5)) : 0; // f = 쓰러진 정도
  a.cr += ((s.crouch && !s.dead ? 1 : 0) - a.cr) * Math.min(1, dt * 12);
  a.air += ((s.air && !s.dead ? 1 : 0) - a.air) * Math.min(1, dt * 9);
  a.spr += ((s.sprint && !s.dead ? 1 : 0) - a.spr) * Math.min(1, dt * 7);
  a.kick = Math.max(0, a.kick - dt * 9); a.flinch = Math.max(0, a.flinch - dt * 4.5);
  a.lean += (clampN((s.vf || 0) * 0.024, -0.1, 0.2) * (1 - f) - a.lean) * Math.min(1, dt * 8);
  a.roll += (clampN(-(s.vs || 0) * 0.03, -0.14, 0.14) * (1 - f) - a.roll) * Math.min(1, dt * 8);
  a.tw += (H.twist * (1 - f) - a.tw) * Math.min(1, dt * 10);
  if (sp > 0.5) a.walk += dt * (5.2 + sp * 1.1) * ((s.vf || 0) < -0.5 ? -1 : 1);
  else a.walk += (Math.round(a.walk / Math.PI) * Math.PI - a.walk) * Math.min(1, dt * 9); // 멈추면 두 발을 모은 자세로

  // 다리: 걸을 때 허벅지가 앞뒤로 흔들리고, 앞으로 내딛는 쪽 무릎이 굽는다. 엉덩이 높이는 발이 땅에 닿게 맞춤
  const amp = Math.min(1, sp / 6) * (1 - a.air) * (s.seated ? 0 : 1), A = 0.72 * amp * (1 - a.cr * 0.3), K = 1.2 * amp, still = (1 - amp) * (1 - a.cr) * (1 - f);
  let foot = 0;
  for (let i = 0; i < 2; i++) {
    const ph = a.walk + i * Math.PI, side = i ? 1 : -1;
    let th = A * Math.sin(ph) + (i ? -0.1 : 0.12) * still, kn = -K * Math.max(0, Math.cos(ph)) - 0.1 * (1 - f) - 0.06 * amp;
    th += a.cr * (i ? 0.9 : 1.35); kn -= a.cr * (i ? 2.2 : 2.0);          // 앉기: 오른 무릎을 꿇음
    th += a.air * (i ? 0.15 : 0.6); kn -= a.air * (i ? 0.55 : 0.95);      // 점프: 다리를 당겨 올림
    if (s.seated) { th = 1.35; kn = -1.25; }
    th += f * (i ? 0.25 : 0.5); kn -= f * (i ? 0.5 : 0.95);               // 쓰러짐: 다리가 풀림
    const L = o.legs[i]; L.thigh.rotation.set(th, 0, side * (0.035 * still + 0.12 * f)); L.knee.rotation.x = kn;
    foot = Math.max(foot, TH * Math.cos(th) + SHIN * Math.cos(th + kn));
  }
  o.hips.position.y = foot + (0.76 - foot) * a.air * 0.6;

  // 허리·머리
  const lean = 0.05 * (1 - f) + a.lean + a.cr * 0.4 + a.spr * 0.14 - a.flinch * 0.17, sway = Math.sin(a.walk) * 0.07 * amp;
  o.spine.rotation.set(-lean, -a.tw + sway, a.roll);
  o.spine.position.y = Math.sin(a.t * 1.7) * 0.004 * (1 - f);
  const pitch = (s.pitch || 0) * (1 - f);
  o.head.rotation.set(pitch * 0.75 + lean * 0.8 + a.flinch * 0.2 - f * 0.25, a.tw - sway, -a.roll * 0.6 + f * 0.3);
  // 조준 묶음(팔·총): 몸통의 비틀림·기울임을 되돌려 조준 방향만 남긴다. 달릴 때는 총을 비스듬히 내림
  o.arms.rotation.set(pitch + lean - a.spr * 0.55 + a.kick * 0.05, a.tw + a.spr * 0.5 - sway, 0);
  o.arms.position.z = a.kick * 0.045;
  // 팔: 손은 총을 따라가고(쓰러지면 옆으로 벌어짐), 어깨는 몸통에 붙어 있다
  a.hr.copy(H.r).lerp(RAG_R, f); a.hl.copy(H.l).lerp(RAG_L, f);
  _q.copy(o.arms.quaternion).invert();
  _s.copy(SHO[0]); _s.z -= o.arms.position.z; _s.applyQuaternion(_q); solveArm(o.armR, _s, a.hr, 1);
  _s.copy(SHO[1]); _s.z -= o.arms.position.z; _s.applyQuaternion(_q); solveArm(o.armL, _s, a.hl, -1);

  // 쓰러짐: 발을 축으로 넘어감 (0 뒤로 눕듯이, 1 앞으로 엎어짐, 2 옆으로), 조금 뒤 땅으로 가라앉음
  if (a.dead) {
    const ang = f * 1.5;
    if (a.fall === 1) o.body.rotation.set(-ang, 0, 0); else if (a.fall === 2) o.body.rotation.set(0, 0, ang); else o.body.rotation.set(ang, 0, 0);
    o.body.position.y = f * 0.14 - Math.max(0, a.deadT - 2.8) * 0.5;
  }
}
// 미리 보기용: 가만히 선 자세
export function rigIdle(o) { animate(o, 0.016, { speed: 0, pitch: 0 }); }
// 총구의 실제 자리 (예광탄이 나가는 곳). 아직 화면에 그려진 적이 없으면 false
export function rigMuzzle(o, out) {
  const H = o.hands[o.w];
  if (!H || !o.g || !o.g.visible) return false;
  out.copy(H.muzzle); o.arms.localToWorld(out);
  return true;
}
