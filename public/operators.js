// SQUAD CLASH — 요원 스킨: 캐릭터 몸(paint.js)에 입히는 복장 그림 + 뼈대에 붙는 갑옷·장식 (움직임은 그대로 따라감)
// 네온 뱅가드 · 크림슨 사무라이 · 인페르노 리액터 · 보이드 리퍼 (스킨 팩 GLB 모델의 이름·색·모양을 따서 다시 만듦)
import * as THREE from './vendor/three.module.js';
import { SW, SH, AW } from './paint.js';
import { OPS } from './shared.js';

const DW = 0.95, DH = 1.9, HW = DW / 2;
// 요원별 색: 옷, 갑옷(어두운), 빛, 금속/포인트, 피부/얼굴
const PAL = {
  vanguard: { suit: '#4a5663', armor: '#1d242c', glow: '#19e0ff', trim: '#8fa3b5', face: '#0b1a22' },
  samurai: { suit: '#7a1824', armor: '#3a0a12', glow: '#ff3048', trim: '#e0b54a', face: '#141014' },
  reactor: { suit: '#5a3a22', armor: '#2a1a12', glow: '#ff7a1a', trim: '#c9a070', face: '#1a120c' },
  reaper: { suit: '#33264f', armor: '#120c1e', glow: '#b07aff', trim: '#6a5a90', face: '#05030a' },
};

// ── 복장 그림 (앞·뒤 두 장) ──
export function opDraw(g, id) {
  const P = PAL[id]; if (!P) return;
  const X = (x) => (1 - (x + HW) / DW) * SW, Y = (y) => (1 - y / DH) * SH;
  for (const side of [0, 1]) {
    g.save(); g.beginPath(); g.rect(side * SW, 0, SW, SH); g.clip(); g.translate(side * SW, 0);
    const box = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(Math.min(X(x0), X(x1)), Y(y1), Math.abs(X(x1) - X(x0)), Y(y0) - Y(y1)); };
    const glowBox = (x0, y0, x1, y1) => { g.shadowColor = P.glow; g.shadowBlur = 6; box(x0, y0, x1, y1, P.glow); g.shadowBlur = 0; };
    box(-0.48, 0, 0.48, 1.9, P.suit);
    // 바지·군화·무릎
    box(-0.25, 0, 0.25, 0.77, P.armor); box(-0.25, 0, 0.25, 0.16, '#0c0d10');
    for (const x of [-0.225, 0.015]) { box(x, 0.33, x + 0.21, 0.5, P.suit); box(x + 0.02, 0.36, x + 0.19, 0.47, P.armor); }
    // 허리띠
    box(-0.25, 0.74, 0.25, 0.81, '#141518'); if (!side) box(-0.05, 0.75, 0.05, 0.8, P.trim);
    // 장갑·소매
    for (const sx of [-1, 1]) { box(sx * 0.25, 0.76, sx * 0.48, 0.92, '#141518'); box(sx * 0.25, 0.92, sx * 0.48, 0.95, P.trim); }
    if (id === 'vanguard') {
      box(-0.22, 0.85, 0.22, 1.4, P.armor);
      if (!side) { glowBox(-0.2, 1.32, -0.02, 1.34); glowBox(0.02, 1.32, 0.2, 1.34); glowBox(-0.012, 0.86, 0.012, 1.3); glowBox(-0.16, 1.0, 0.16, 1.015); }
      else { glowBox(-0.14, 0.9, -0.12, 1.36); glowBox(0.12, 0.9, 0.14, 1.36); }
      for (const x of [-0.13, 0.11]) glowBox(x, 0.02, x + 0.02, 0.72); // 다리 네온 줄
      for (const sx of [-1, 1]) glowBox(sx * 0.25, 1.1, sx * 0.48, 1.115);
    } else if (id === 'samurai') {
      for (let i = 0; i < 6; i++) { const y = 0.84 + i * 0.09; box(-0.24, y, 0.24, y + 0.075, i % 2 ? P.armor : P.suit); box(-0.24, y, 0.24, y + 0.012, P.trim); } // 미늘 갑옷
      if (!side) { box(-0.05, 1.2, 0.05, 1.3, P.trim); }
      for (const x of [-0.225, 0.015]) for (let i = 0; i < 3; i++) box(x, 0.52 + i * 0.07, x + 0.21, 0.53 + i * 0.07, P.trim); // 허벅지 미늘
      for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) box(sx * 0.25, 1.0 + i * 0.1, sx * 0.48, 1.012 + i * 0.1, P.trim);
    } else if (id === 'reactor') {
      box(-0.23, 0.84, 0.23, 1.42, P.armor);
      for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#1a1410' : '#e0a020'; g.beginPath(); const x0 = X(-0.23 + i * 0.066), y0 = Y(0.84), y1 = Y(0.9); g.moveTo(x0, y0); g.lineTo(x0 - 6, y0); g.lineTo(x0 - 6 + 4, y1); g.lineTo(x0 + 4, y1); g.fill(); } // 경고 줄무늬
      if (side) { glowBox(-0.1, 1.0, 0.1, 1.03); glowBox(-0.1, 1.12, 0.1, 1.15); }
      for (const x of [-0.2, 0.04]) glowBox(x, 0.4, x + 0.16, 0.42);
      for (const sx of [-1, 1]) { box(sx * 0.25, 1.15, sx * 0.48, 1.42, P.armor); glowBox(sx * 0.3, 1.2, sx * 0.43, 1.22); }
    } else if (id === 'reaper') {
      box(-0.24, 0.6, 0.24, 1.42, P.armor); // 긴 겉옷
      if (!side) { box(-0.03, 0.6, 0.03, 1.4, P.suit); glowBox(-0.2, 0.62, 0.2, 0.635); for (const y of [1.05, 1.2]) glowBox(-0.008, y, 0.008, y + 0.08); }
      else glowBox(-0.2, 0.62, 0.2, 0.635);
      for (const sx of [-1, 1]) { box(sx * 0.25, 0.95, sx * 0.48, 1.44, P.armor); glowBox(sx * 0.25, 0.95, sx * 0.48, 0.965); }
    }
    // 얼굴 자리 (머리는 대부분 투구·두건이 덮음)
    box(-0.21, 1.44, 0.21, 1.82, P.face);
    if (!side && id === 'vanguard') glowBox(-0.17, 1.63, 0.17, 1.67);
    if (!side && id === 'samurai') { box(-0.17, 1.5, 0.17, 1.6, '#1d1a1c'); g.fillStyle = P.glow; g.shadowColor = P.glow; g.shadowBlur = 6; for (const x of [52, 76]) g.fillRect(x - 6, Y(1.66), 12, 3); g.shadowBlur = 0; }
    g.restore();
  }
}

// ── 3D 장식 ──
const MATS = {}; // 요원마다 재질을 같이 써서 한꺼번에 반짝이게 함
function mats(id) {
  if (MATS[id]) return MATS[id];
  const P = PAL[id], c = (h) => new THREE.Color(h);
  const M = {
    armor: new THREE.MeshPhongMaterial({ color: c(P.armor), specular: 0x555a66, shininess: 60 }),
    suit: new THREE.MeshPhongMaterial({ color: c(P.suit), specular: 0x333333, shininess: 30 }),
    trim: new THREE.MeshPhongMaterial({ color: c(P.trim), specular: 0xffffff, shininess: 90 }),
    dark: new THREE.MeshPhongMaterial({ color: 0x0c0d10, specular: 0x222222, shininess: 40 }),
    glow: new THREE.MeshBasicMaterial({ color: c(P.glow) }),
    hot: new THREE.MeshBasicMaterial({ color: c(P.glow).lerp(c('#ffffff'), 0.55) }),
    cloth: new THREE.MeshLambertMaterial({ color: c(P.suit).multiplyScalar(0.7), side: THREE.DoubleSide }),
    base: c(P.glow), hotBase: c(P.glow).lerp(c('#ffffff'), 0.55),
  };
  return (MATS[id] = M);
}
export function tickOps(t) { // 빛나는 부분이 숨 쉬듯 밝아졌다 어두워짐
  for (const id in MATS) {
    const M = MATS[id], k = 0.78 + Math.sin(t * 3.1 + id.length) * 0.22;
    M.glow.color.copy(M.base).multiplyScalar(0.75 + k * 0.45);
    M.hot.color.copy(M.hotBase).multiplyScalar(0.85 + k * 0.3);
  }
}

const GEO = new Map();
const geo = (key, make) => { let g = GEO.get(key); if (!g) GEO.set(key, (g = make())); return g; };
function add(parent, g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o; }
const B = (w, h, d) => geo(`b${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
const C = (rt, rb, h, s = 12) => geo(`c${rt}:${rb}:${h}:${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const S = (r, s = 14) => geo(`s${r}:${s}`, () => new THREE.SphereGeometry(r, s, Math.max(6, s >> 1)));
const T = (r, t, arc = Math.PI * 2, s = 24) => geo(`t${r}:${t}:${arc}:${s}`, () => new THREE.TorusGeometry(r, t, 6, s, arc));

// 뼈대 rig (paint.js buildBody): spine(허리, 몸통 0.48×0.68×0.24, 앞이 -z) · head(머리 0~0.38) · armR/armL.up·fore · legs[i].thigh·knee · hips
export function dressOp(rig, op) {
  const id = OPS[op] && OPS[op].id;
  if (!PAL[id]) return;
  const M = mats(id), sp = rig.spine, hd = rig.head, ups = [rig.armR.up, rig.armL.up], fores = [rig.armR.fore, rig.armL.fore];
  const knees = rig.legs.map((l) => l.knee), thighs = rig.legs.map((l) => l.thigh);
  if (id === 'vanguard') {
    add(hd, B(0.45, 0.13, 0.45), M.armor, 0, 0.34, 0);                       // 투구 윗판
    add(hd, B(0.44, 0.22, 0.06), M.armor, 0, 0.2, -0.2);                     // 바이저 틀
    add(hd, B(0.38, 0.06, 0.02), M.glow, 0, 0.21, -0.235);                   // 빛나는 바이저
    for (const sx of [-1, 1]) { add(hd, C(0.06, 0.06, 0.05, 10), M.armor, sx * 0.225, 0.2, 0, 0, 0, Math.PI / 2); add(hd, T(0.045, 0.008, Math.PI * 2, 14), M.glow, sx * 0.252, 0.2, 0, 0, Math.PI / 2, 0); }
    add(hd, C(0.008, 0.008, 0.22, 5), M.trim, 0.2, 0.42, 0.06); add(hd, S(0.016, 8), M.glow, 0.2, 0.53, 0.06); // 안테나
    add(sp, B(0.42, 0.28, 0.04), M.armor, 0, 0.48, -0.135);                   // 가슴판
    add(sp, C(0.05, 0.05, 0.02, 6), M.hot, 0, 0.48, -0.16, Math.PI / 2, 0, 0); // 가슴 코어
    for (const sx of [-1, 1]) add(sp, B(0.16, 0.012, 0.012), M.glow, sx * 0.1, 0.42, -0.158, 0, 0, sx * 0.5);
    add(sp, B(0.32, 0.36, 0.1), M.armor, 0, 0.4, 0.17);                       // 등짐
    for (const sx of [-1, 1]) { add(sp, B(0.03, 0.34, 0.14), M.trim, sx * 0.12, 0.62, 0.22, -0.3, 0, sx * 0.2); add(sp, B(0.012, 0.3, 0.012), M.glow, sx * 0.12, 0.62, 0.3, -0.3, 0, sx * 0.2); } // 등 지느러미
    add(sp, B(0.012, 0.3, 0.012), M.glow, 0, 0.4, 0.222);
    ups.forEach((u) => { add(u, B(0.27, 0.11, 0.27), M.armor, 0, 0.03, 0); add(u, B(0.272, 0.014, 0.272), M.glow, 0, -0.02, 0); });
    fores.forEach((f) => add(f, B(0.22, 0.04, 0.23), M.glow, 0, -0.3, 0));
    knees.forEach((k) => { add(k, B(0.2, 0.14, 0.05), M.armor, 0, 0, -0.125); add(k, S(0.018, 8), M.glow, 0, 0, -0.152); });
  } else if (id === 'samurai') {
    const dome = add(hd, S(0.235, 18), M.armor, 0, 0.25, 0.01); dome.scale.set(1, 0.72, 1.05);   // 투구
    add(hd, C(0.25, 0.32, 0.1, 18), M.suit, 0, 0.2, 0.03);                    // 목가리개(시코로)
    add(hd, T(0.33, 0.012, Math.PI * 2, 24), M.trim, 0, 0.15, 0.03, Math.PI / 2, 0, 0);
    add(hd, T(0.15, 0.016, Math.PI * 0.9, 20), M.trim, 0, 0.36, -0.22, 0, 0, Math.PI * 0.05); // 황금 초승달 장식
    add(hd, S(0.03, 10), M.glow, 0, 0.32, -0.235);
    add(hd, B(0.3, 0.13, 0.05), M.dark, 0, 0.09, -0.2);                       // 가면(멘포)
    add(hd, B(0.3, 0.012, 0.052), M.trim, 0, 0.15, -0.2);
    for (const sx of [-1, 1]) add(hd, B(0.07, 0.012, 0.01), M.glow, sx * 0.07, 0.21, -0.208); // 붉은 눈빛
    for (let i = 0; i < 4; i++) { const y = 0.14 + i * 0.12; add(sp, B(0.5, 0.06, 0.26), i % 2 ? M.armor : M.suit, 0, y, 0); add(sp, B(0.505, 0.01, 0.265), M.trim, 0, y - 0.03, 0); } // 미늘 몸통
    ups.forEach((u) => { for (let i = 0; i < 3; i++) { add(u, B(0.31 - i * 0.02, 0.06, 0.31 - i * 0.02), i % 2 ? M.armor : M.suit, 0, 0.04 - i * 0.075, 0); add(u, B(0.315 - i * 0.02, 0.01, 0.315 - i * 0.02), M.trim, 0, 0.01 - i * 0.075, 0); } }); // 큰 어깨 갑옷(소데)
    fores.forEach((f) => { add(f, B(0.22, 0.2, 0.23), M.armor, 0, -0.2, 0); add(f, B(0.225, 0.01, 0.235), M.trim, 0, -0.1, 0); });
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; add(rig.hips, B(0.2, 0.22, 0.03), M.suit, Math.sin(a) * 0.2, -0.08, Math.cos(a) * 0.15, 0.15 * Math.cos(a), a, 0); } // 허리 치마(쿠사즈리)
    const kat = new THREE.Group(); kat.position.set(0, 0.42, 0.17); kat.rotation.z = 0.75; sp.add(kat); // 등의 카타나
    add(kat, C(0.026, 0.026, 0.72, 10), M.suit, 0, -0.1, 0); add(kat, C(0.027, 0.027, 0.02, 10), M.trim, 0, -0.46, 0);
    add(kat, C(0.06, 0.06, 0.012, 16), M.trim, 0, 0.27, 0); add(kat, C(0.02, 0.02, 0.24, 8), M.dark, 0, 0.4, 0);
    for (let i = 0; i < 4; i++) add(kat, T(0.021, 0.004, Math.PI * 2, 8), M.trim, 0, 0.31 + i * 0.05, 0, Math.PI / 2, 0, 0);
    knees.forEach((k) => add(k, B(0.22, 0.16, 0.05), M.armor, 0, -0.02, -0.12));
  } else if (id === 'reactor') {
    add(hd, B(0.46, 0.4, 0.46), M.armor, 0, 0.19, 0);                         // 용접 투구
    add(hd, B(0.34, 0.04, 0.02), M.hot, 0, 0.2, -0.235);                       // 빛나는 틈
    add(hd, B(0.36, 0.1, 0.03), M.trim, 0, 0.08, -0.235);
    for (const sx of [-1, 1]) add(hd, C(0.05, 0.05, 0.06, 10), M.trim, sx * 0.17, 0.06, -0.24, Math.PI / 2, 0, 0); // 호흡기
    add(sp, B(0.4, 0.3, 0.05), M.armor, 0, 0.46, -0.14);
    add(sp, T(0.085, 0.02, Math.PI * 2, 20), M.glow, 0, 0.46, -0.17);         // 가슴 원자로
    add(sp, S(0.05, 12), M.hot, 0, 0.46, -0.17);
    const tank = new THREE.Group(); tank.position.set(0, 0.36, 0.22); sp.add(tank); // 등의 원자로 통
    add(tank, C(0.12, 0.12, 0.46, 14), M.armor); add(tank, C(0.13, 0.13, 0.04, 14), M.trim, 0, 0.24, 0); add(tank, C(0.13, 0.13, 0.04, 14), M.trim, 0, -0.24, 0);
    for (const y of [-0.12, 0, 0.12]) add(tank, T(0.124, 0.012, Math.PI * 2, 18), M.glow, 0, y, 0, Math.PI / 2, 0, 0);
    for (const sx of [-1, 1]) add(sp, C(0.018, 0.018, 0.34, 6), M.trim, sx * 0.14, 0.55, 0.16, 0.5, 0, sx * 0.5); // 관
    ups.forEach((u) => { add(u, S(0.14, 14), M.armor, 0, 0.03, 0); add(u, S(0.06, 10), M.hot, 0, 0.15, 0); add(u, T(0.142, 0.01, Math.PI * 2, 18), M.glow, 0, 0.0, 0, Math.PI / 2, 0, 0); }); // 어깨 원자로 공
    fores.forEach((f) => { add(f, B(0.24, 0.2, 0.25), M.armor, 0, -0.22, 0); add(f, B(0.245, 0.02, 0.255), M.glow, 0, -0.15, 0); });
    knees.forEach((k) => { add(k, B(0.24, 0.2, 0.06), M.armor, 0, -0.02, -0.12); add(k, B(0.16, 0.02, 0.02), M.glow, 0, -0.02, -0.155); });
    thighs.forEach((t) => add(t, B(0.25, 0.1, 0.26), M.armor, 0, -0.08, 0));
  } else if (id === 'reaper') {
    const hood = add(hd, geo('hood', () => new THREE.CylinderGeometry(0.235, 0.27, 0.44, 18, 1, true, Math.PI * 0.18 + Math.PI, Math.PI * 1.64)), M.cloth, 0, 0.2, 0.01); // 앞이 트인 두건
    const top = add(hd, S(0.236, 18), M.cloth, 0, 0.42, 0.02); top.scale.set(1, 0.55, 1.08); top.material = M.cloth;
    add(hd, geo('hoodTip', () => new THREE.ConeGeometry(0.12, 0.22, 10)), M.cloth, 0, 0.5, 0.16, -1.1, 0, 0);
    add(hd, B(0.3, 0.3, 0.02), M.dark, 0, 0.18, -0.19);                       // 얼굴 없는 어둠
    for (const sx of [-1, 1]) add(hd, S(0.022, 8), M.hot, sx * 0.065, 0.22, -0.205); // 빛나는 눈
    hood.renderOrder = 1;
    const cape = new THREE.Group(); cape.position.set(0, 0.66, 0.13); sp.add(cape); // 망토 (위가 축, 펄럭임)
    const cm = add(cape, geo('cape', () => { const g = new THREE.PlaneGeometry(0.56, 1.12, 1, 6); g.translate(0, -0.56, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + -y * 0.35)); p.setZ(i, (y * y) * 0.12); } g.computeVertexNormals(); return g; }), M.cloth);
    add(cape, B(0.62, 0.016, 0.01), M.glow, 0, -1.115, 0.15);
    const seed = Math.random() * 9;
    cm.onBeforeRender = () => { cape.rotation.x = 0.1 + Math.sin(performance.now() / 420 + seed) * 0.07; };
    const sc = new THREE.Group(); sc.position.set(0, 0.36, 0.2); sc.rotation.z = -0.6; sp.add(sc); // 등의 낫
    add(sc, C(0.017, 0.017, 1.15, 8), M.dark); add(sc, T(0.22, 0.02, Math.PI * 0.6, 16), M.armor, 0.2, 0.52, 0, 0, 0, Math.PI * 0.35);
    add(sc, T(0.235, 0.007, Math.PI * 0.6, 16), M.glow, 0.2, 0.52, 0, 0, 0, Math.PI * 0.35);
    ups.forEach((u) => { add(u, B(0.27, 0.1, 0.27), M.armor, 0, 0.03, 0); for (const z of [-0.07, 0.07]) { add(u, geo('spike', () => new THREE.ConeGeometry(0.03, 0.14, 6)), M.armor, 0, 0.13, z); add(u, S(0.012, 6), M.glow, 0, 0.2, z); } }); // 가시 어깨
    fores.forEach((f) => add(f, B(0.22, 0.03, 0.23), M.glow, 0, -0.32, 0));
    const orb = add(sp, S(0.04, 12), M.hot, 0.35, 0.75, 0); const os = Math.random() * 9; // 곁을 도는 영혼 구슬
    orb.onBeforeRender = () => { const t = performance.now() / 900 + os; orb.position.set(Math.cos(t) * 0.42, 0.72 + Math.sin(t * 2.3) * 0.06, Math.sin(t) * 0.3); };
  }
}
