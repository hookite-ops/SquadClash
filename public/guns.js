// 무기 18종을 코드로 모델링 — 옆모습 윤곽을 그려 두께를 주고(모서리 둥글림), 총열·조준경은 원통으로 만듦
// 좌표: 앞 = -Z, 위 = +Y, 원점 = 총열 중심선 위·방아쇠 근처. 단위 m.
// 질감·요철·반사는 전부 코드로 그린다. 무료 스킨은 재질만, 코드로 여는 스킨은 형태(키트)까지 바뀐다.
import * as THREE from './vendor/three.module.js';
import { WEAPONS, SKINS, PARTS, cleanParts } from './shared.js';
import { GLB } from './gunmodels.js';

// ───────────── 질감 도구 ─────────────
const rnd = (() => { let s = 4242; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
function canvas(s, draw) { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); return c; }
function texOf(c, srgb, rep = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 밝기를 높이로 보고 요철(노멀) 지도를 만든다
function normalOf(c, k, rep = 1) {
  const s = c.width, src = c.getContext('2d').getImageData(0, 0, s, s).data;
  const out = canvas(s, (g) => {
    const img = g.createImageData(s, s), d = img.data;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const h = (xx, yy) => src[(((yy + s) % s) * s + ((xx + s) % s)) * 4] / 255;
      let nx = (h(x - 1, y) - h(x + 1, y)) * k, ny = (h(x, y + 1) - h(x, y - 1)) * k, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const o = (y * s + x) * 4; d[o] = (nx * 0.5 + 0.5) * 255; d[o + 1] = (ny * 0.5 + 0.5) * 255; d[o + 2] = (nz * 0.5 + 0.5) * 255; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  return texOf(out, false, rep);
}
// 무늬가 이어지도록 가장자리를 넘겨 9번 그림
function wrap(g, s, fn) { for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } }

const H = {
  brushed: () => canvas(256, (g, s) => { g.fillStyle = '#808080'; g.fillRect(0, 0, s, s); for (let i = 0; i < 1400; i++) { const v = 90 + rnd() * 80 | 0; g.fillStyle = `rgba(${v},${v},${v},.5)`; g.fillRect(rnd() * s - 40, rnd() * s, 20 + rnd() * 90, 1); } }),
  stipple: () => canvas(128, (g, s) => { g.fillStyle = '#707070'; g.fillRect(0, 0, s, s); for (let i = 0; i < 700; i++) { const v = rnd() < 0.5 ? 30 : 220; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(rnd() * s, rnd() * s, 1.2 + rnd() * 1.6, 0, 7); g.fill(); } }),
  wood: () => canvas(256, (g, s) => {
    const lg = g.createLinearGradient(0, 0, 0, s); lg.addColorStop(0, '#8a5226'); lg.addColorStop(0.5, '#a5652f'); lg.addColorStop(1, '#7c4720'); g.fillStyle = lg; g.fillRect(0, 0, s, s);
    wrap(g, s, () => { for (let i = 0; i < 46; i++) { const y = rnd() * s; g.strokeStyle = `rgba(${50 + rnd() * 40 | 0},${24 + rnd() * 20 | 0},8,${0.25 + rnd() * 0.4})`; g.lineWidth = 0.6 + rnd() * 2.2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s * 0.3, y + (rnd() - 0.5) * 22, s * 0.7, y + (rnd() - 0.5) * 22, s, y); g.stroke(); } });
    for (let i = 0; i < 5; i++) { const x = rnd() * s, y = rnd() * s; for (let r = 9; r > 1; r -= 2) { g.strokeStyle = 'rgba(55,26,8,.35)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, r * 2.2, r, 0, 0, 7); g.stroke(); } }
  }),
};
// 쇠 겉면: 얼룩·잔흠집·점. 재질 색에 곱해지므로 바탕은 회색(160)이고, 흠집은 그보다 밝게 드러남
H.metalAlb = () => canvas(512, (g, s) => {
  g.fillStyle = '#a0a0a0'; g.fillRect(0, 0, s, s);
  wrap(g, s, () => {
    for (let i = 0; i < 34; i++) { const x = rnd() * s, y = rnd() * s, r = 30 + rnd() * 90, d = rnd() < 0.6, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, d ? 'rgba(40,40,44,.2)' : 'rgba(225,228,235,.12)'); rg.addColorStop(1, d ? 'rgba(40,40,44,0)' : 'rgba(225,228,235,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 230; i++) { const x = rnd() * s, y = rnd() * s, a = (rnd() - 0.5) * (rnd() < 0.8 ? 0.5 : 3), l = 5 + rnd() * rnd() * 90; g.strokeStyle = rnd() < 0.72 ? `rgba(255,255,255,${0.1 + rnd() * 0.32})` : `rgba(20,20,22,${0.15 + rnd() * 0.3})`; g.lineWidth = 0.35 + rnd() * 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    for (let i = 0; i < 520; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.2)'; g.fillRect(rnd() * s, rnd() * s, 0.8 + rnd(), 0.8 + rnd()); }
  });
});
// 플라스틱 겉면: 잔 알갱이와 손이 닿아 번들거리는 옅은 얼룩
H.polyAlb = () => canvas(256, (g, s) => {
  g.fillStyle = '#a0a0a0'; g.fillRect(0, 0, s, s);
  wrap(g, s, () => {
    for (let i = 0; i < 16; i++) { const x = rnd() * s, y = rnd() * s, r = 20 + rnd() * 50, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, rnd() < 0.5 ? 'rgba(30,30,32,.16)' : 'rgba(230,230,235,.1)'); rg.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 1500; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.14)'; g.fillRect(rnd() * s, rnd() * s, 1 + rnd(), 1 + rnd()); }
    for (let i = 0; i < 26; i++) { const x = rnd() * s, y = rnd() * s, a = rnd() * 6.28, l = 4 + rnd() * 26; g.strokeStyle = `rgba(255,255,255,${0.08 + rnd() * 0.14})`; g.lineWidth = 0.5 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  });
});
// 질감 바탕(160)에 곱해져도 원하는 색이 나오게 색을 올려 줌
const over = (hex) => { const c = new THREE.Color(hex), k = 1 / 0.352; return c.setRGB(Math.min(1, c.r * k), Math.min(1, c.g * k), Math.min(1, c.b * k)); };
const TEXC = {};
const nStip = () => T('nStipple', () => normalOf(H.stipple(), 1.4, 9));
const T = (k, f) => TEXC[k] || (TEXC[k] = f());

// ───────────── 재질 ─────────────
const allMats = new Set();
let ENV = null, PQ = 2, PHYS = true;
// 모서리 닳음: 둥글린 모서리(aWear = 1)에서 칠이 벗겨져 쇠가 드러나 보이게 한다. wear = 정도(0 이면 없음), wearCol = 드러나는 색
const wearNoise = () => T('wearNoise', () => texOf(canvas(256, (g, s) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
  wrap(g, s, () => { for (let i = 0; i < 420; i++) { const x = rnd() * s, y = rnd() * s, r = 3 + rnd() * rnd() * 30, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(255,255,255,${0.25 + rnd() * 0.5})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); } });
}), false, 1));
function std(o) {
  o = { ...o };
  const wear = o.wear === undefined ? 0.55 : o.wear, wearCol = o.wearCol === undefined ? 0x9aa0a8 : o.wearCol; delete o.wear; delete o.wearCol;
  const phys = o.clearcoat !== undefined || o.iridescence !== undefined;
  if (phys && !PHYS) for (const k of ['clearcoat', 'clearcoatRoughness', 'iridescence', 'iridescenceIOR']) delete o[k];
  const m = phys && PHYS ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o); if (ENV) m.envMap = ENV; m.envMapIntensity = 1.5; allMats.add(m);
  const W = wear > 0 && !o.flatShading && !o.transparent, uW = { value: wear }, uC = { value: new THREE.Color(wearCol) };
  m.userData.rim = { value: new THREE.Color(0, 0, 0) }; // 윤곽광: 비스듬히 보이는 가장자리가 스킨 색으로 빛남 (스킨이 정함)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = m.userData.rim;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += uRim * pow( 1.0 - saturate( abs( dot( normal, normalize( vViewPosition ) ) ) ), 2.6 );');
    if (!W) return;
    sh.uniforms.uWear = uW; sh.uniforms.uWearCol = uC; sh.uniforms.tWear = { value: wearNoise() };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aWear; varying float vWear; varying vec2 vWuv;').replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvWear = aWear; vWuv = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWear; varying vec2 vWuv; uniform float uWear; uniform vec3 uWearCol; uniform sampler2D tWear; float wearK = 0.0;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n\twearK = smoothstep( 0.6, 0.86, vWear * ( 0.22 + texture2D( tWear, vWuv * 4.3 ).r * 1.2 ) ) * uWear;\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, uWearCol, wearK );')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = mix( roughnessFactor, 0.32, wearK );')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tmetalnessFactor = mix( metalnessFactor, 1.0, wearK );');
  };
  m.customProgramCacheKey = () => (W ? 'gunwear+rim' : 'gunrim');
  return m;
}
// 총에 비칠 주변 풍경(밝은 하늘, 어두운 땅, 조명판 몇 개)을 작게 만들어 반사에 쓴다
export function initGunEnv(renderer) {
  const sc = new THREE.Scene();
  const sky = canvas(256, (g, s) => { const lg = g.createLinearGradient(0, 0, 0, s); lg.addColorStop(0, '#dfeeff'); lg.addColorStop(0.45, '#9fc4ee'); lg.addColorStop(0.5, '#e8e2d2'); lg.addColorStop(0.56, '#5a5448'); lg.addColorStop(1, '#2a2824'); g.fillStyle = lg; g.fillRect(0, 0, s, s); });
  const st = new THREE.CanvasTexture(sky); st.colorSpace = THREE.SRGBColorSpace;
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), new THREE.MeshBasicMaterial({ map: st, side: THREE.BackSide })));
  const panel = (x, y, z, w, h, v) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v * 0.95), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
  panel(-8, 9, 6, 10, 5, 9); panel(9, 6, -4, 6, 7, 5.5); panel(0, 12, -9, 14, 3, 7); panel(-10, 2, -8, 3, 9, 3.5); panel(4, 10, 8, 5, 2.4, 6); panel(11, 1.5, 6, 2, 7, 3);
  const pm = new THREE.PMREMGenerator(renderer);
  ENV = pm.fromScene(sc, 0.035).texture;
  pm.dispose(); st.dispose();
  for (const m of allMats) { m.envMap = ENV; m.needsUpdate = true; }
}

// 스킨과 상관없이 같은 재질
const FIX = {
  rubber: std({ wear: 0, color: 0x0f1012, metalness: 0, roughness: 0.95 }),
  dark: std({ wear: 0, color: 0x08090a, metalness: 0, roughness: 1 }),
  glass: std({ wear: 0, color: 0x1d4f86, metalness: 0.6, roughness: 0.08, emissive: 0x0a2440 }),
  lens: new THREE.MeshStandardMaterial({ color: 0x6fd0ff, metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  brass: std({ wear: 0, color: 0xc9a04a, metalness: 1, roughness: 0.3 }),
  glove: std({ wear: 0, color: 0x22252a, metalness: 0, roughness: 0.9 }),
  gloveHard: std({ wear: 0, color: 0x15171a, metalness: 0.1, roughness: 0.6 }),
  dot: new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
  white: new THREE.MeshBasicMaterial({ color: 0xf2f2ee }),
  reticle: new THREE.MeshBasicMaterial({ map: (() => texOf(canvas(64, (g) => { g.strokeStyle = '#ff4030'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 20, 0, 7); g.stroke(); g.fillStyle = '#ff4030'; g.beginPath(); g.arc(32, 32, 3.5, 0, 7); g.fill(); for (const [x, y, w, h] of [[30.5, 4, 3, 10], [30.5, 50, 3, 10], [4, 30.5, 10, 3], [50, 30.5, 10, 3]]) g.fillRect(x, y, w, h); }), true))(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  rdot: new THREE.MeshBasicMaterial({ map: (() => texOf(canvas(32, (g) => { const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16); rg.addColorStop(0, '#fff'); rg.addColorStop(0.3, '#ff3020'); rg.addColorStop(1, 'rgba(255,40,20,0)'); g.fillStyle = rg; g.fillRect(0, 0, 32, 32); }), true))(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  xret: new THREE.MeshBasicMaterial({ map: (() => texOf(canvas(128, (g) => { g.strokeStyle = '#ff4030'; g.lineWidth = 2; g.beginPath(); g.moveTo(64, 70); g.lineTo(64, 122); g.moveTo(6, 64); g.lineTo(52, 64); g.moveTo(76, 64); g.lineTo(122, 64); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(54, 74); g.lineTo(64, 60); g.lineTo(74, 74); g.stroke(); for (let i = 1; i < 4; i++) g.fillRect(58, 70 + i * 12, 12, 1.5); }), true))(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  beam: new THREE.MeshBasicMaterial({ map: (() => { const t = texOf(canvas(64, (g) => { const lg = g.createLinearGradient(0, 0, 0, 64); lg.addColorStop(0, 'rgba(255,40,20,0)'); lg.addColorStop(0.55, 'rgba(255,40,20,.35)'); lg.addColorStop(1, 'rgba(255,60,30,.9)'); g.fillStyle = lg; g.fillRect(0, 0, 64, 64); }), true); return t; })(), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  ldot: new THREE.MeshBasicMaterial({ color: 0xff3a2a }),
  tubeIn: new THREE.MeshBasicMaterial({ color: 0x040506, side: THREE.BackSide }),
  mask: new THREE.MeshBasicMaterial({ colorWrite: false }), // 1인칭 전용: 조준경 안쪽으로 총의 앞부분이 비쳐 보이지 않게 가림
  lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff6e0).multiplyScalar(2.2) }), // 전술 라이트 렌즈
};
allMats.delete(FIX.lens);

// 스킨마다 바뀌는 재질: recv 몸통, steel 총열, bolt 밝은 쇠, slide 권총 윗몸, poly 손잡이, mag 탄창, 나무·색 부품, accent 포인트
function baseMats() {
  const br = () => T('nBrushed', () => normalOf(H.brushed(), 0.6, 3)), sp = () => T('nStipple', () => normalOf(H.stipple(), 1.4, 9));
  const wood = () => T('wood', () => texOf(H.wood(), true, 2)), woodN = () => T('nWood', () => normalOf(H.wood(), 1.2, 2));
  const ma = () => T('metalAlb', () => texOf(H.metalAlb(), true, 2)), pa = () => T('polyAlb', () => texOf(H.polyAlb(), true, 5));
  const ns = new THREE.Vector2(0.35, 0.35);
  return {
    recv: std({ color: over(0x3c424b), map: ma(), metalness: 0.9, roughness: 0.34, roughnessMap: smudge(), normalMap: br(), normalScale: ns, clearcoat: 0.55, clearcoatRoughness: 0.22 }), // 그래파이트 금속 + 얇은 겉칠
    steel: std({ color: over(0x1c1f24), map: ma(), metalness: 0.97, roughness: 0.24, roughnessMap: smudge(), normalMap: br(), normalScale: ns, wear: 0.7 }),
    bolt: std({ color: 0xdfe4ea, metalness: 1, roughness: 0.1, roughnessMap: smudge(), wear: 0 }), // 크롬
    slide: std({ color: over(0x535a64), map: ma(), metalness: 0.94, roughness: 0.28, roughnessMap: smudge(), normalMap: br(), normalScale: ns, wearCol: 0xd0d5dc, clearcoat: 0.6, clearcoatRoughness: 0.18 }),
    poly: std({ wear: 0.3, wearCol: 0x62676e, color: over(0x1a1c20), map: pa(), metalness: 0, roughness: 0.8, normalMap: sp(), normalScale: new THREE.Vector2(0.5, 0.5) }),
    furn: std({ wear: 0.35, wearCol: 0xd8c8a8, color: over(0x4f402e), map: pa(), metalness: 0.06, roughness: 0.6, normalMap: sp(), normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 0.25, clearcoatRoughness: 0.5 }), // 탄색 손잡이·총열덮개
    mag: std({ color: over(0x45382a), map: pa(), metalness: 0.08, roughness: 0.58, normalMap: sp(), normalScale: new THREE.Vector2(0.3, 0.3) }),
    wood: std({ wear: 0.35, wearCol: 0xc99a62, color: 0xffffff, map: wood(), metalness: 0, roughness: 0.4, normalMap: woodN(), normalScale: new THREE.Vector2(0.4, 0.4), clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    woodDark: std({ wear: 0.35, wearCol: 0xa8845a, color: 0x9a8a80, map: wood(), metalness: 0, roughness: 0.48, normalMap: woodN(), normalScale: new THREE.Vector2(0.4, 0.4), clearcoat: 0.4, clearcoatRoughness: 0.35 }),
    olive: std({ wear: 0.4, wearCol: 0x8f9878, color: over(0x586244), map: pa(), metalness: 0.04, roughness: 0.78, normalMap: sp(), normalScale: new THREE.Vector2(0.3, 0.3) }),
    tan: std({ wear: 0.4, wearCol: 0xd9c7a0, color: over(0xa88f62), map: pa(), metalness: 0.04, roughness: 0.76, normalMap: sp(), normalScale: new THREE.Vector2(0.3, 0.3) }),
    gray: std({ color: over(0x747c85), map: ma(), metalness: 0.3, roughness: 0.58, roughnessMap: smudge(), normalMap: br(), normalScale: ns }),
    accent: std({ wear: 0.4, color: 0xff4a30, metalness: 0.3, roughness: 0.35, emissive: 0xff2a10, emissiveIntensity: 0.5 }),
  };
}

// ───────────── 스킨 무늬 (512 칸 기준으로 그리고 PQ 배 해상도로 굽는다, 0.5m 마다 반복) ─────────────
// 화질 설정: 낮음이면 무늬 해상도를 절반으로, 겉칠(클리어코트) 재질도 끔. 총을 만들기 전에 불러야 함
export function setGunQuality(q) { PQ = q === 'low' ? 1 : 2; PHYS = q !== 'low'; }
const pcan = (draw, amt = 12) => { const c = canvas(512 * PQ, (g) => { g.scale(PQ, PQ); draw(g, 512); }); return amt ? grain(c, amt) : c; };
// 잔 알갱이를 얹어 가까이서 봐도 밋밋하지 않게
function grain(c, amt) {
  const g = c.getContext('2d'), s = c.width, img = g.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  return c;
}
const nrm = (c, k) => normalOf(c, k * PQ);
// 부드러운 얼룩
const blob = (g, x, y, r, col, sq = 0.7) => {
  const P = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.283, rr = r * (0.6 + rnd() * 0.6); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq]); }
  g.fillStyle = col; g.beginPath();
  for (let i = 0; i <= 9; i++) { const p = P[i % 9], q = P[(i + 1) % 9], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; if (!i) g.moveTo(mx, my); else g.quadraticCurveTo(p[0], p[1], mx, my); }
  g.closePath(); g.fill();
};
const dot = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
// 겉면 얼룩·잔흠집: 반사가 고르지 않게 (초록 = 거칠기 배수)
const smudge = () => T('smudge', () => texOf(canvas(512, (g, s) => {
  g.fillStyle = 'rgb(255,232,255)'; g.fillRect(0, 0, s, s);
  wrap(g, s, () => {
    for (let i = 0; i < 26; i++) { const x = rnd() * s, y = rnd() * s, r = 30 + rnd() * 70, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(255,${150 + rnd() * 50 | 0},255,.55)`); rg.addColorStop(1, 'rgba(255,200,255,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 150; i++) { const x = rnd() * s, y = rnd() * s, a = rnd() * 6.28, l = 6 + rnd() * 40; g.strokeStyle = `rgba(255,255,255,${0.25 + rnd() * 0.5})`; g.lineWidth = 0.5 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.3); g.stroke(); }
  });
}), false, 1));
// 각성(5레벨) 스킨에 흐르는 빛줄기
const veins = () => T('veins', () => texOf(canvas(256, (g, s) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
  wrap(g, s, () => { g.lineCap = 'round'; for (const [w, a] of [[9, 0.16], [4, 0.4], [1.4, 1]]) for (let i = 0; i < 7; i++) { const y = (i + 0.5) * (s / 7); g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = w; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin((x / s) * 6.283 * (1 + (i % 3)) + i * 1.9) * 11 + Math.sin((x / s) * 6.283 * 4 + i) * 4); g.stroke(); } });
}), true, 1));
const PAT = {
  gold: (g, s) => { // 결을 낸 금판에 도드라지게 새긴 덩굴무늬와 띠 장식
    const lg = g.createLinearGradient(0, 0, 0, s); lg.addColorStop(0, '#e6bb4c'); lg.addColorStop(0.5, '#cf9d2e'); lg.addColorStop(1, '#e2b545'); g.fillStyle = lg; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,244,190' : '110,72,8'},${0.05 + rnd() * 0.1})`; g.fillRect(rnd() * s - 30, rnd() * s, 20 + rnd() * 80, 0.7); }
    const sc = []; for (let i = 0; i < 20; i++) sc.push([rnd() * s, rnd() * s, rnd() * 6.28, rnd() < 0.5 ? 1 : -1, 20 + (rnd() * 12 | 0)]);
    wrap(g, s, () => {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [ox, oy, col, w] of [[1.6, 1.6, 'rgba(84,52,4,.9)', 4.2], [-1.2, -1.2, 'rgba(255,246,200,.95)', 3.4], [0, 0, '#b88a22', 3]]) for (const [x0, y0, a0, dir, n] of sc) {
        let x = x0 + ox, y = y0 + oy, a = a0; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < n; k++) { a += dir * (0.2 + k * 0.018); x += Math.cos(a) * 7; y += Math.sin(a) * 7; g.lineTo(x, y); } g.stroke();
        g.fillStyle = col; g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(4, 0, 7, 3.2, 0, 0, 7); g.fill(); g.restore();
      }
      for (const y of [s * 0.04, s * 0.54]) { g.fillStyle = 'rgba(96,60,6,.85)'; g.fillRect(0, y, s, 2); g.fillRect(0, y + 14, s, 2); for (let x = 0; x < s; x += 16) { g.fillStyle = 'rgba(255,244,196,.9)'; g.beginPath(); g.moveTo(x + 8, y + 3.5); g.lineTo(x + 13, y + 8); g.lineTo(x + 8, y + 12.5); g.lineTo(x + 3, y + 8); g.closePath(); g.fill(); g.fillStyle = 'rgba(110,70,8,.9)'; dot(g, x + 8, y + 8, 1.3); } }
    });
  },
  neon: (g, s, em) => { // 검은 판의 육각 격자 위로 빛나는 회로
    g.fillStyle = em ? '#000' : '#0a0d13'; g.fillRect(0, 0, s, s);
    if (!em) { g.strokeStyle = '#151c29'; g.lineWidth = 1; for (let y = 0; y < s; y += 16) for (let x = (y / 16) % 2 ? 9.25 : 0; x < s; x += 18.5) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * 1.0472 + 0.5236; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 9.6, y + Math.sin(a) * 9.6); } g.closePath(); g.stroke(); } }
    const seed = [], chips = [];
    for (let i = 0; i < 40; i++) seed.push([Math.round(rnd() * 16) * 32, Math.round(rnd() * 16) * 32, rnd() < 0.5, 2 + Math.floor(rnd() * 5), i % 3]);
    for (let i = 0; i < 7; i++) chips.push([Math.round(rnd() * 15) * 32 + 6, Math.round(rnd() * 15) * 32 + 6, i % 3]);
    const C = ['#19e3ff', '#ff3df0', '#7dff5a'];
    wrap(g, s, () => {
      for (const [w, blur, a] of em ? [[5, 14, 0.9]] : [[6, 12, 0.35], [2.4, 0, 1]]) {
        g.lineWidth = w; g.lineCap = 'square'; g.shadowBlur = blur * PQ; g.globalAlpha = a;
        for (const [x, y, hz, n, c] of seed) { g.strokeStyle = g.shadowColor = g.fillStyle = C[c]; g.beginPath(); g.moveTo(x, y); let px = x, py = y; for (let k = 0; k < n; k++) { if ((k % 2 === 0) === hz) px += 64; else py += 32; g.lineTo(px, py); } g.stroke(); g.fillRect(px - 4.5, py - 4.5, 9, 9); if (!em && w < 3) { g.fillStyle = '#fff'; g.fillRect(px - 1.5, py - 1.5, 3, 3); } }
        for (const [x, y, c] of chips) { g.strokeStyle = g.shadowColor = C[c]; g.strokeRect(x, y, 20, 20); for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + 4 + k * 6, y); g.lineTo(x + 4 + k * 6, y - 5); g.moveTo(x + 4 + k * 6, y + 20); g.lineTo(x + 4 + k * 6, y + 25); g.stroke(); } }
      }
      g.shadowBlur = 0; g.globalAlpha = 1;
    });
  },
  lava: (g, s, em) => { // 식은 바위 껍질과 그 틈에서 빛나는 용암
    g.fillStyle = em ? '#000' : '#191210'; g.fillRect(0, 0, s, s);
    if (!em) wrap(g, s, () => { for (let i = 0; i < 90; i++) { const x = rnd() * s, y = rnd() * s, r = 8 + rnd() * 22; blob(g, x, y, r, `rgb(${30 + rnd() * 26 | 0},${22 + rnd() * 14 | 0},${18 + rnd() * 8 | 0})`, 0.8); g.strokeStyle = 'rgba(96,74,60,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r * 0.7, 3.6, 5.6); g.stroke(); } for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + rnd() * 0.4})`; dot(g, rnd() * s, rnd() * s, 0.6 + rnd() * 1.4); } });
    const cr = []; for (let i = 0; i < 22; i++) { const p = [[rnd() * s, rnd() * s]]; let a = rnd() * 6.28; for (let k = 0; k < 10; k++) { a += (rnd() - 0.5) * 1.5; const q = p[p.length - 1]; p.push([q[0] + Math.cos(a) * 24, q[1] + Math.sin(a) * 24]); if (k === 4 && i % 2) { const b = a + 1.1; p.branch = [[q[0], q[1]], [q[0] + Math.cos(b) * 22, q[1] + Math.sin(b) * 22], [q[0] + Math.cos(b + 0.4) * 44, q[1] + Math.sin(b + 0.4) * 44]]; } } cr.push(p); if (p.branch) cr.push(p.branch); }
    const em2 = []; for (let i = 0; i < 60; i++) em2.push([rnd() * s, rnd() * s, 0.8 + rnd() * 1.6]);
    wrap(g, s, () => {
      g.lineJoin = g.lineCap = 'round';
      for (const [w, col, blur] of em ? [[8, 'rgba(255,70,0,.28)', 8], [3.2, '#ff8a20', 3], [1.3, '#ffe9a0', 0]] : [[10, 'rgba(120,26,4,.8)', 6], [4, '#e85a0c', 3], [1.6, '#ffd890', 0]]) { g.strokeStyle = g.shadowColor = col; g.shadowBlur = blur * PQ; g.lineWidth = w; for (const p of cr) { g.beginPath(); p.forEach((q, i) => g[i ? 'lineTo' : 'moveTo'](q[0], q[1])); g.stroke(); } }
      g.shadowBlur = 0; g.fillStyle = em ? '#ffb050' : '#ffc060'; for (const [x, y, r] of em2) dot(g, x, y, r);
    });
  },
  ice: (g, s) => { // 깊은 얼음: 결정면, 실금, 성에
    const lg = g.createLinearGradient(0, 0, s, s); lg.addColorStop(0, '#c9eeff'); lg.addColorStop(0.35, '#6cb6ec'); lg.addColorStop(0.7, '#3f8fd6'); lg.addColorStop(1, '#c9eeff'); g.fillStyle = lg; g.fillRect(0, 0, s, s);
    wrap(g, s, () => {
      for (let i = 0; i < 70; i++) { const x = rnd() * s, y = rnd() * s, r = 14 + rnd() * 52, a = rnd() * 6.28, x1 = x + Math.cos(a) * r, y1 = y + Math.sin(a) * r, fg = g.createLinearGradient(x, y, x1, y1); fg.addColorStop(0, `rgba(255,255,255,${0.1 + rnd() * 0.32})`); fg.addColorStop(1, 'rgba(120,190,240,.04)'); g.fillStyle = fg; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x + Math.cos(a + 2.2) * r * 0.5, y + Math.sin(a + 2.2) * r * 0.5); g.lineTo(x + Math.cos(a + 3.6) * r * 0.9, y + Math.sin(a + 3.6) * r * 0.9); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.8; g.stroke(); }
      for (let i = 0; i < 16; i++) { let x = rnd() * s, y = rnd() * s, a = rnd() * 6.28; const P = [[x, y]]; for (let k = 0; k < 9; k++) { a += (rnd() - 0.5) * 1.2; x += Math.cos(a) * 16; y += Math.sin(a) * 16; P.push([x, y]); } for (const [o, col, w] of [[1.2, 'rgba(20,70,130,.5)', 1.6], [0, 'rgba(255,255,255,.9)', 1.1]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); P.forEach((q, k) => g[k ? 'lineTo' : 'moveTo'](q[0] + o, q[1] + o)); g.stroke(); } }
      g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 900; i++) dot(g, rnd() * s, rnd() * s, 0.4 + rnd() * 0.9);
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1; for (let i = 0; i < 16; i++) { const x = rnd() * s, y = rnd() * s, r = 5 + rnd() * 8; for (let k = 0; k < 3; k++) { const a = k * 1.0472; g.beginPath(); g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); } }
    });
  },
  galaxy: (g, s, em) => { // 성운, 소용돌이 은하, 크고 작은 별
    if (em) { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); } else { const lg = g.createLinearGradient(0, 0, s, s); lg.addColorStop(0, '#070518'); lg.addColorStop(0.5, '#150f3a'); lg.addColorStop(1, '#070518'); g.fillStyle = lg; g.fillRect(0, 0, s, s); }
    const neb = [], st = [];
    for (let i = 0; i < 26; i++) neb.push([rnd() * s, rnd() * s, 36 + rnd() * 90, i % 5]);
    for (let i = 0; i < 520; i++) st.push([rnd() * s, rnd() * s, rnd() < 0.05 ? 1.9 : rnd() < 0.25 ? 1.1 : 0.6, 0.45 + rnd() * 0.55, rnd()]);
    wrap(g, s, () => {
      g.globalCompositeOperation = 'lighter';
      for (const [x, y, r, k] of neb) { const rg = g.createRadialGradient(x, y, 0, x, y, r), c = ['120,60,255', '255,70,190', '40,150,255', '70,30,160', '30,200,220'][k]; rg.addColorStop(0, `rgba(${c},${em ? 0.2 : 0.42})`); rg.addColorStop(1, `rgba(${c},0)`); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
      g.save(); g.translate(s * 0.68, s * 0.3); g.rotate(-0.5); g.scale(1, 0.45); const rg = g.createRadialGradient(0, 0, 0, 0, 0, 60); rg.addColorStop(0, 'rgba(255,240,220,.95)'); rg.addColorStop(0.25, 'rgba(200,150,255,.5)'); rg.addColorStop(1, 'rgba(120,80,255,0)'); g.fillStyle = rg; g.fillRect(-60, -60, 120, 120);
      g.fillStyle = 'rgba(230,220,255,.7)'; for (let k = 0; k < 220; k++) { const t = k / 220, a = t * 9 + (k % 2) * 3.1416, r = 8 + t * 50; dot(g, Math.cos(a) * r + (kr(k) - 0.5) * 5, Math.sin(a) * r + (kr(k + 9) - 0.5) * 5, 0.7); } g.restore();
      for (const [x, y, r, a, h] of st) { g.fillStyle = `rgba(${h < 0.2 ? '255,214,170' : h < 0.4 ? '170,210,255' : '255,255,255'},${a})`; dot(g, x, y, r); if (r > 1.5) { g.strokeStyle = `rgba(255,255,255,${a * 0.7})`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.moveTo(x, y - 7); g.lineTo(x, y + 7); g.stroke(); } }
      g.globalCompositeOperation = 'source-over';
    });
  },
  tiger: (g, s) => { // 호랑이 털: 등은 주황, 배는 흰빛, 털결을 따라 번지는 줄무늬
    const lg = g.createLinearGradient(0, 0, 0, s); lg.addColorStop(0, '#e8780f'); lg.addColorStop(0.5, '#f59a22'); lg.addColorStop(0.82, '#f8d9a4'); lg.addColorStop(1, '#fbeedb'); g.fillStyle = lg; g.fillRect(0, 0, s, s);
    const st = []; for (let i = 0; i < 20; i++) st.push([i * (s / 20) + (rnd() - 0.5) * 12, rnd() * s * 0.5, s * (0.3 + rnd() * 0.45), 5 + rnd() * 8, (rnd() - 0.5) * 30, rnd() * 9]);
    wrap(g, s, () => {
      g.lineCap = 'round';
      for (let i = 0; i < 1400; i++) { const x = rnd() * s, y = rnd() * s, l = 5 + rnd() * 9; g.strokeStyle = rnd() < 0.5 ? 'rgba(255,236,196,.16)' : 'rgba(120,52,0,.14)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (rnd() - 0.5) * 3); g.stroke(); }
      g.strokeStyle = '#16100b';
      for (const [x0, y0, len, w, bend, ph] of st) for (let k = 0, N = Math.ceil(len / 1.2); k <= N; k++) { const t = k / N, x = x0 + Math.sin(t * 3.1416) * bend + Math.sin(t * 9 + ph) * 3, y = y0 + t * len, hw = w * Math.sin(t * 3.1416) ** 0.7 * (0.75 + kr(k + ph) * 0.5); g.lineWidth = 2; g.beginPath(); g.moveTo(x - hw - kr(k + 7 + ph) * 3.5, y); g.lineTo(x + hw + kr(k + 3 + ph) * 3.5, y + (kr(k + ph * 2) - 0.5) * 1.5); g.stroke(); }
    });
  },
  carbon: (g, s) => { // 탄소 섬유 능직 짜임과 경주 띠
    g.fillStyle = '#0d0e11'; g.fillRect(0, 0, s, s);
    const c = 4; for (let y = 0; y < s / c; y++) for (let x = 0; x < s / c; x++) { const k = (x + y) % 4, up = k < 2, t = (up ? (x + y * 3) % 2 : (x * 3 + y) % 2) ? 0.82 : 1, lg = up ? g.createLinearGradient(x * c, 0, x * c + c, 0) : g.createLinearGradient(0, y * c, 0, y * c + c); const v = (up ? 92 : 58) * t | 0; lg.addColorStop(0, '#121317'); lg.addColorStop(0.5, `rgb(${v},${v + 4},${v + 12})`); lg.addColorStop(1, '#121317'); g.fillStyle = lg; g.fillRect(x * c, y * c, c, c); }
    const y0 = s * 0.44; g.fillStyle = '#c4141d'; g.fillRect(0, y0, s, 22); const hl = g.createLinearGradient(0, y0, 0, y0 + 22); hl.addColorStop(0, 'rgba(255,120,120,.5)'); hl.addColorStop(0.4, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = hl; g.fillRect(0, y0, s, 22);
    g.fillStyle = '#f2f2ee'; g.fillRect(0, y0 + 26, s, 3); g.fillRect(0, y0 - 6, s, 1.5);
    g.fillStyle = 'rgba(12,12,14,.9)'; for (let x = 0; x < s; x += 32) { g.beginPath(); g.moveTo(x + 4, y0 + 4); g.lineTo(x + 14, y0 + 4); g.lineTo(x + 22, y0 + 11); g.lineTo(x + 14, y0 + 18); g.lineTo(x + 4, y0 + 18); g.lineTo(x + 12, y0 + 11); g.closePath(); g.fill(); }
  },
  sakura: (g, s) => { // 벚나무 가지와 꽃, 흩날리는 꽃잎
    const lg = g.createLinearGradient(0, 0, s, s); lg.addColorStop(0, '#ffe2ec'); lg.addColorStop(0.5, '#fbc3d6'); lg.addColorStop(1, '#f39dbc'); g.fillStyle = lg; g.fillRect(0, 0, s, s);
    const fl = [], pt = [];
    for (let i = 0; i < 40; i++) fl.push([rnd() * s, rnd() * s, 8 + rnd() * 11, rnd() * 6.28, i % 3]);
    for (let i = 0; i < 46; i++) pt.push([rnd() * s, rnd() * s, 3 + rnd() * 4, rnd() * 6.28]);
    wrap(g, s, () => {
      for (let i = 0; i < 18; i++) { const x = kr(i + 70) * s, y = kr(i + 90) * s, r = 14 + kr(i + 30) * 30, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,255,255,.3)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
      g.lineCap = 'round';
      for (const [w, col, o] of [[6.5, '#4a2e2a', 0], [2, 'rgba(150,104,90,.8)', -1.5]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(0, s * 0.8 + o); g.bezierCurveTo(s * 0.3, s * 0.6 + o, s * 0.6, s * 0.75 + o, s, s * 0.5 + o); g.stroke(); g.lineWidth = w * 0.55; g.beginPath(); g.moveTo(s * 0.4, s * 0.685 + o); g.quadraticCurveTo(s * 0.44, s * 0.52 + o, s * 0.54, s * 0.4 + o); g.moveTo(s * 0.72, s * 0.655 + o); g.quadraticCurveTo(s * 0.8, s * 0.74 + o, s * 0.86, s * 0.86 + o); g.moveTo(s * 0.16, s * 0.715 + o); g.quadraticCurveTo(s * 0.2, s * 0.6 + o, s * 0.14, s * 0.48 + o); g.stroke(); }
      for (const [x, y, r, rot, k] of fl) {
        for (let p = 0; p < 5; p++) { const a = rot + (p / 5) * 6.283, cx = x + Math.cos(a) * r * 0.58, cy = y + Math.sin(a) * r * 0.58, pg = g.createRadialGradient(x, y, r * 0.1, cx, cy, r * 0.75); pg.addColorStop(0, k ? '#ff9fc0' : '#ff7fae'); pg.addColorStop(0.45, k ? '#ffeaf2' : '#ffd0e0'); pg.addColorStop(1, '#ffffff'); g.fillStyle = pg; g.beginPath(); g.ellipse(cx, cy, r * 0.56, r * 0.36, a, 0, 7); g.fill(); g.strokeStyle = 'rgba(214,96,140,.35)'; g.lineWidth = 0.6; g.stroke(); }
        g.fillStyle = '#d6336c'; dot(g, x, y, r * 0.13); g.fillStyle = '#ffd23f'; for (let p = 0; p < 7; p++) { const a = rot + p * 0.9; dot(g, x + Math.cos(a) * r * 0.26, y + Math.sin(a) * r * 0.26, r * 0.055 + 0.4); }
      }
      for (const [x, y, r, a] of pt) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(-r, 0); g.quadraticCurveTo(0, -r * 0.8, r, 0); g.quadraticCurveTo(0, r * 0.5, -r, 0); g.fill(); g.restore(); }
    });
  },
  aurora: (g, s, em) => { // 밤하늘에 드리운 오로라 장막 (em = 빛나는 장막만)
    if (em) { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); } else { const lg = g.createLinearGradient(0, 0, 0, s); lg.addColorStop(0, '#080c28'); lg.addColorStop(0.5, '#0d2a46'); lg.addColorStop(1, '#08142c'); g.fillStyle = lg; g.fillRect(0, 0, s, s); }
    wrap(g, s, () => {
      [[0.2, '90,255,170'], [0.52, '70,225,255'], [0.84, '190,120,255']].forEach(([cy, col], bi) => {
        for (let x = 0; x < s; x += 2) {
          const t = (x / s) * 6.283, y = cy * s + Math.sin(t * 2 + bi * 1.7) * 26 + Math.sin(t * 5 + bi) * 9, h = 78 + Math.sin(t * 3 + bi * 2.1) * 28 + Math.sin(t * 11 + bi) * 10;
          const lg = g.createLinearGradient(0, y - h, 0, y + 14); lg.addColorStop(0, `rgba(${col},0)`); lg.addColorStop(0.72, `rgba(${col},${em ? 0.5 : 0.66})`); lg.addColorStop(0.93, `rgba(255,255,255,${em ? 0.45 : 0.72})`); lg.addColorStop(1, `rgba(${col},0)`);
          g.fillStyle = lg; g.fillRect(x, y - h, 2.3, h + 14);
        }
      });
      if (!em) { g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 110; i++) dot(g, rnd() * s, rnd() * s, 0.4 + rnd() * 1.0); }
    });
  },
  halloween: (g, s, em) => { // 보랏빛 밤에 호박등·박쥐·거미줄 (em = 빛나는 얼굴만)
    if (em) { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); } else { const lg = g.createLinearGradient(0, 0, s, s); lg.addColorStop(0, '#1b1026'); lg.addColorStop(0.5, '#2e1646'); lg.addColorStop(1, '#140c1c'); g.fillStyle = lg; g.fillRect(0, 0, s, s); }
    const P = [], Bt = [], el = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); }, poly = (pts) => { g.beginPath(); pts.forEach((q, i) => g[i ? 'lineTo' : 'moveTo'](q[0], q[1])); g.closePath(); g.fill(); };
    for (let i = 0; i < 9; i++) P.push([((i % 3) + 0.2 + kr(i * 3 + 1) * 0.6) * s / 3, (Math.floor(i / 3) + 0.2 + kr(i * 3 + 2) * 0.6) * s / 3, 26 + kr(i * 3 + 3) * 16, (kr(i + 50) - 0.5) * 0.6]);
    for (let i = 0; i < 11; i++) Bt.push([kr(i * 5 + 101) * s, kr(i * 5 + 102) * s, 0.9 + kr(i * 5 + 103) * 1.1, (kr(i + 150) - 0.5) * 0.8]);
    wrap(g, s, () => {
      if (!em) {
        g.strokeStyle = 'rgba(214,204,236,.2)'; g.lineWidth = 1.5;
        for (const [cx, cy] of [[s * 0.12, s * 0.18], [s * 0.72, s * 0.66]]) {
          for (let a = 0; a < 8; a++) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a * 0.7854) * 120, cy + Math.sin(a * 0.7854) * 120); g.stroke(); }
          for (let r = 26; r <= 116; r += 30) { g.beginPath(); for (let a = 0; a <= 8; a++) { const x = cx + Math.cos(a * 0.7854) * r, y = cy + Math.sin(a * 0.7854) * r; if (a) g.quadraticCurveTo(cx + Math.cos((a - 0.5) * 0.7854) * r * 0.8, cy + Math.sin((a - 0.5) * 0.7854) * r * 0.8, x, y); else g.moveTo(x, y); } g.stroke(); }
        }
        g.fillStyle = '#07050a';
        for (const [x, y, k, rot] of Bt) { g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k); poly([[0, -2], [-2, -6], [-3.5, -2], [-9, -5], [-16, -1], [-12, 0], [-9, 3], [-6, 1], [-3, 5], [0, 2], [3, 5], [6, 1], [9, 3], [12, 0], [16, -1], [9, -5], [3.5, -2], [2, -6]]); g.restore(); }
      }
      for (const [x, y, r, rot] of P) {
        g.save(); g.translate(x, y); g.rotate(rot);
        if (!em) { g.fillStyle = '#4d6b2a'; g.fillRect(-r * 0.1, -r * 1.02, r * 0.2, r * 0.34); g.fillStyle = '#c4560a'; el(-r * 0.46, 0, r * 0.52, r * 0.74); el(r * 0.46, 0, r * 0.52, r * 0.74); g.fillStyle = '#f07a12'; el(0, 0, r * 0.6, r * 0.8); }
        g.fillStyle = em ? '#ffae2e' : '#ffe27a';
        for (const m of [-1, 1]) poly([[m * r * 0.5, -r * 0.08], [m * r * 0.14, -r * 0.08], [m * r * 0.3, -r * 0.42]]);
        poly([[-r * 0.08, r * 0.1], [r * 0.08, r * 0.1], [0, -r * 0.04]]);
        poly([[-r * 0.58, r * 0.2], [-r * 0.36, r * 0.32], [-r * 0.18, r * 0.2], [0, r * 0.34], [r * 0.18, r * 0.2], [r * 0.36, r * 0.32], [r * 0.58, r * 0.2], [r * 0.36, r * 0.56], [r * 0.12, r * 0.5], [0, r * 0.62], [-r * 0.12, r * 0.5], [-r * 0.36, r * 0.56]]);
        g.restore();
      }
    });
  },
};
// ───────────── 무늬: 콜 오브 듀티식 디지털·우드랜드 위장과 얼티밋 번들의 겉면 ─────────────
// 칸마다 계산하는 무늬는 이어지는 잡음(주기가 정수인 값 잡음)으로 만들어 가장자리가 맞물린다. u, v = 0~1
const hsh = (x, y, sd) => { let h = (x * 374761393 + y * 668265263 + sd * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const wrp = (a, p) => ((a % p) + p) % p;
function vnoise(x, y, px, py, sd) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const x0 = wrp(ix, px), x1 = wrp(ix + 1, px), y0 = wrp(iy, py), y1 = wrp(iy + 1, py);
  const a = hsh(x0, y0, sd), b = hsh(x1, y0, sd), c = hsh(x0, y1, sd), d = hsh(x1, y1, sd);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// 여러 겹 잡음 (px, py = 첫 겹의 칸 수, 겹마다 두 배)
function fbm(u, v, px, py, oct, sd) { let s = 0, a = 0.5, n = 0; for (let o = 0; o < oct; o++) { s += vnoise(u * px, v * py, px, py, sd + o * 17) * a; n += a; a *= 0.5; px *= 2; py *= 2; } return s / n; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hex3 = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
// 색 띠: stops = [[위치, 0xRRGGBB], ...]
function ramp(stops) { const S = stops.map(([t, h]) => [t, hex3(h)]); return (t, o) => { t = Math.min(1, Math.max(0, t)); let i = 1; while (i < S.length - 1 && t > S[i][0]) i++; const [t0, a] = S[i - 1], [t1, b] = S[i], k = (t - t0) / (t1 - t0 || 1); o[0] = a[0] + (b[0] - a[0]) * k; o[1] = a[1] + (b[1] - a[1]) * k; o[2] = a[2] + (b[2] - a[2]) * k; return o; }; }
// 칸마다 fn(u, v, out) 으로 색을 정해 그림 한 장을 만든다
function field(n, fn) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), d = img.data, o = [0, 0, 0];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { fn(x / n, y / n, o); const i = (y * n + x) * 4; d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
}
const FN = () => Math.min(512, 256 * PQ); // 칸 계산 무늬의 해상도 (화질 '낮음'이면 절반)
// 이어지는 보로노이(결정면): 점마다 가장 가까운 점·두 번째 점까지의 거리
function voro(n, sd) { const P = []; for (let i = 0; i < n; i++) P.push([hsh(i, 1, sd), hsh(i, 2, sd), hsh(i, 3, sd), hsh(i, 4, sd) * 6.283]); return (u, v) => { let d1 = 9, d2 = 9, k = 0, ex = 0, ey = 0; for (let i = 0; i < n; i++) { let dx = u - P[i][0], dy = v - P[i][1]; dx -= Math.round(dx); dy -= Math.round(dy); const d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; k = i; ex = dx; ey = dy; } else if (d < d2) d2 = d; } return [Math.sqrt(d1), Math.sqrt(d2), k, ex, ey, P[k][2], P[k][3]]; }; }
// 비스듬히 지나가는 빛 띠 (얼티밋 번들 겉면의 광택 훑기)
const sweepTex = (w = 0.045) => texOf(field(128, (u, v, o) => { const d = (u + v) % 1, k = Math.exp(-(((d - 0.5) / w) ** 2)) + Math.exp(-(((d - 0.62) / (w * 0.35)) ** 2)) * 0.5; o[0] = o[1] = o[2] = Math.min(255, k * 255); }), true, 1);
// 디지털 위장: 8칸 네모를 잡음 높이로 네 가지 색에 나눔 (큰 덩어리 + 잔 네모가 섞인 MARPAT 느낌)
function digital(pal, sd) {
  return (g, s) => {
    const N = 64, cs = s / N, tex = (cx, cy) => fbm(cx / N, cy / N, 4, 4, 4, sd) * 0.8 + fbm(cx / N, cy / N, 16, 16, 2, sd + 5) * 0.2 + (hsh(cx, cy, sd + 9) - 0.5) * 0.16;
    for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
      const h = tex(cx, cy), i = h < 0.4 ? 3 : h < 0.48 ? 2 : h < 0.57 ? 1 : 0, j = hsh(cx, cy, sd + 3);
      g.fillStyle = pal[i]; g.fillRect(cx * cs, cy * cs, cs + 0.3, cs + 0.3);
      if (j < 0.12) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(cx * cs, cy * cs, cs, cs); } else if (j > 0.9) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(cx * cs, cy * cs, cs, cs); }
    }
    g.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 260; i++) g.fillRect((rnd() * N | 0) * cs, (rnd() * N | 0) * cs, cs, cs * 0.25); // 칠 결
  };
}
const CAMO = {
  desert: digital(['#cdb98f', '#a8916a', '#806b4c', '#584834'], 11),
  urban: digital(['#a9aeb3', '#787e85', '#4a4f56', '#24272c'], 23),
  forest: (g, s) => { // 우드랜드: 휘어진 큰 얼룩 네 가지 색 (카키 바탕, 초록, 갈색, 검정 붓질)
    const pal = [hex3(0x9c9465), hex3(0x4e5a33), hex3(0x5f4630), hex3(0x1d1d19)];
    g.imageSmoothingEnabled = true;
    g.drawImage(field(FN(), (u, v, o) => {
      const wu = u + (fbm(u, v, 3, 3, 3, 40) - 0.5) * 0.18, wv = v + (fbm(u, v, 3, 3, 3, 41) - 0.5) * 0.18;
      const a = sstep(0.5, 0.53, fbm(wu, wv * 1.2, 3, 3, 4, 42)), b = sstep(0.57, 0.6, fbm(wu * 1.1, wv, 3, 3, 4, 47)), c = sstep(0.64, 0.665, fbm(wu, wv, 4, 4, 4, 53));
      for (let k = 0; k < 3; k++) { let x = pal[0][k]; x += (pal[1][k] - x) * a; x += (pal[2][k] - x) * b; x += (pal[3][k] - x) * c; o[k] = x; }
    }), 0, 0, s, s);
  },
  platinum: (g, s) => { // 결을 낸 백금판에 가늘게 새긴 육각 무늬
    g.drawImage(field(FN(), (u, v, o) => { const b = fbm(u, v, 2, 96, 3, 60), k = 0.8 + b * 0.24 + (fbm(u, v, 3, 3, 2, 61) - 0.5) * 0.1; o[0] = 214 * k; o[1] = 219 * k; o[2] = 228 * k; }), 0, 0, s, s);
    g.lineWidth = 1.1;
    for (let y = 0, r = 0; y < s + 32; y += 27.7, r++) for (let x = r % 2 ? 16 : 0; x < s + 32; x += 32) {
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * 1.0472 + 0.5236; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 15.5, y + Math.sin(a) * 15.5); } g.closePath();
      g.strokeStyle = 'rgba(70,76,90,.32)'; g.stroke(); g.save(); g.translate(0.8, 0.8); g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke(); g.restore();
    }
  },
  damascus: (g, s) => { // 접쇠(다마스커스) 물결: 휘어진 겹 무늬, 구리·금빛
    const R = ramp([[0, 0x22160c], [0.3, 0x5c3a1e], [0.55, 0xa8723a], [0.78, 0xe2c27e], [0.92, 0xfff0c6], [1, 0xfff8e4]]);
    g.drawImage(field(FN(), (u, v, o) => { const w = fbm(u, v, 2, 2, 4, 70) * 1.5 + fbm(u, v, 5, 5, 3, 71) * 0.35, ph = v * 16 + u * 3 + w * 2.2, t = 0.5 + 0.5 * Math.sin(6.2832 * ph), l2 = 0.5 + 0.5 * Math.sin(6.2832 * ph * 3 + 1.3), q = Math.pow(t, 1.4) * 0.72 + l2 * 0.16 + fbm(u, v, 32, 32, 2, 72) * 0.12; R(q, o); }), 0, 0, s, s);
  },
  obsidian: (g, s) => { // 흑요석: 검은 유리에 은빛 대리석 실금, 깊은 보랏빛
    g.drawImage(field(FN(), (u, v, o) => {
      const wu = u + fbm(u, v, 2, 2, 4, 80) * 0.5, wv = v + fbm(u, v, 2, 2, 4, 81) * 0.5, r = 1 - Math.abs(2 * fbm(wu, wv, 3, 3, 5, 82) - 1), r2 = 1 - Math.abs(2 * fbm(wu, wv, 6, 6, 3, 83) - 1);
      const vein = sstep(0.935, 0.99, r) + sstep(0.965, 0.997, r2) * 0.5, cl = fbm(u, v, 3, 3, 3, 84);
      o[0] = 8 + cl * 18 + vein * 215; o[1] = 7 + cl * 8 + vein * 215; o[2] = 12 + cl * 30 + vein * 225;
    }), 0, 0, s, s);
  },
  diamond: (g, s) => { // 다이아몬드: 깎은 결정면마다 다른 밝기, 빛나는 모서리
    const V = voro(150, 90);
    g.drawImage(field(FN(), (u, v, o) => {
      const [d1, d2, k, ex, ey, h, a] = V(u, v), sh = Math.min(1, Math.max(0, 0.5 + (ex * Math.cos(a) + ey * Math.sin(a)) * 14)), e = 1 - sstep(0, 0.006, d2 - d1), tone = hsh(k, 7, 91);
      const L = Math.min(1, 0.32 + h * 0.45 + sh * 0.3) + e * 0.6, tc = tone < 0.18 ? [255, 214, 236] : tone < 0.4 ? [196, 228, 255] : tone < 0.5 ? [220, 206, 255] : [236, 244, 255];
      o[0] = Math.min(255, tc[0] * L); o[1] = Math.min(255, tc[1] * L); o[2] = Math.min(255, tc[2] * L);
    }), 0, 0, s, s);
  },
  diamondEm: (g, s) => { // 반짝이는 별빛 (빛나는 층)
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
    wrap(g, s, () => { g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 70; i++) { const x = kr(i + 300) * s, y = kr(i + 400) * s, r = 4 + kr(i + 500) * 10, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, 'rgba(190,230,255,.6)'); rg.addColorStop(1, 'rgba(120,180,255,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); g.fillStyle = 'rgba(230,245,255,.85)'; g.fillRect(x - r * 1.8, y - 0.6, r * 3.6, 1.2); g.fillRect(x - 0.6, y - r * 1.8, 1.2, r * 3.6); } g.globalCompositeOperation = 'source-over'; });
  },
  atomic: (g, s, em) => { // 아토믹: 반짝이는 붉은 액체가 소용돌이치는 결
    const R = ramp(em ? [[0, 0x000000], [0.62, 0x000000], [0.8, 0x9a1808], [0.92, 0xff7a20], [1, 0xffe6a0]] : [[0, 0x3a0004], [0.25, 0x8e0a10], [0.5, 0xd81e1a], [0.72, 0xff6a1a], [0.88, 0xffcf5a], [1, 0xfff4d8]]);
    g.drawImage(field(FN(), (u, v, o) => { const q = fbm(u, v, 3, 3, 4, 100), r = fbm(u, v, 3, 3, 4, 101), f = fbm(u + q * 0.4, v + r * 0.4, 3, 3, 5, 102), t = 0.5 + 0.5 * Math.sin(f * 30); R(Math.pow(t, 1.6) * 0.82 + f * 0.25, o); }), 0, 0, s, s);
  },
  orion: (g, s, em) => { // 오리온: 무지갯빛 진주 물결과 가는 빛줄기
    const c = new THREE.Color();
    g.drawImage(field(FN(), (u, v, o) => {
      const q = fbm(u, v, 2, 2, 4, 110), f = fbm(u + q * 0.5, v + q * 0.3, 3, 3, 5, 111), line = Math.pow(0.5 + 0.5 * Math.sin(f * 40), 12);
      if (em) { const k = Math.min(1, line * 0.9 + sstep(0.62, 0.8, f) * 0.35); o[0] = o[1] = o[2] = k * 255; return; }
      c.setHSL((f * 2.4 + v * 0.35) % 1, 0.7, 0.5 + line * 0.3); const w = 0.25 + q * 0.2; o[0] = (c.r * (1 - w) + w) * 255; o[1] = (c.g * (1 - w) + w) * 255; o[2] = (c.b * (1 - w) + w) * 255;
    }), 0, 0, s, s);
  },
  darkmatter: (g, s, em) => { // 다크 매터: 검은 결정 위로 흐르는 보라·파랑·붉은 빛 조각
    if (!em) {
      g.drawImage(field(FN(), (u, v, o) => { const n = fbm(u, v, 3, 3, 5, 120), m = fbm(u + n * 0.3, v, 4, 4, 3, 121); o[0] = 6 + Math.pow(m, 3) * 70; o[1] = 4 + Math.pow(n, 3) * 18; o[2] = 14 + Math.pow(n, 2.2) * 70; }), 0, 0, s, s);
      wrap(g, s, () => { for (let i = 0; i < 46; i++) { const x = kr(i + 600) * s, y = kr(i + 700) * s, r = 14 + kr(i + 800) * 34, a = kr(i + 900) * 6.28; g.fillStyle = `rgba(${60 + kr(i) * 60 | 0},${30 + kr(i + 1) * 30 | 0},${120 + kr(i + 2) * 100 | 0},${0.08 + kr(i + 3) * 0.14})`; g.beginPath(); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(a + 2.4) * r * 0.5, y + Math.sin(a + 2.4) * r * 0.5); g.lineTo(x + Math.cos(a + 3.9) * r * 0.8, y + Math.sin(a + 3.9) * r * 0.8); g.closePath(); g.fill(); g.strokeStyle = 'rgba(170,140,255,.18)'; g.lineWidth = 0.8; g.stroke(); } });
      return;
    }
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
    const C = ['168,80,255', '70,120,255', '255,60,170', '255,70,60'];
    wrap(g, s, () => {
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (let i = 0; i < 40; i++) { const x = kr(i + 1000) * s, y = kr(i + 1100) * s, l = 30 + kr(i + 1200) * 90, c = C[i % 4], a = -0.55 + (kr(i + 1300) - 0.5) * 0.3; for (const [w, al] of [[5, 0.12], [2, 0.4], [0.8, 1]]) { g.strokeStyle = `rgba(${c},${al})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } }
      for (let i = 0; i < 90; i++) { const x = kr(i + 1400) * s, y = kr(i + 1500) * s, r = 1.5 + kr(i + 1600) * 5, c = C[i % 4], a = kr(i + 1700) * 6.28; g.fillStyle = `rgba(${c},.9)`; g.beginPath(); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(a + 2.2) * r * 0.6, y + Math.sin(a + 2.2) * r * 0.6); g.lineTo(x + Math.cos(a + 4) * r * 0.7, y + Math.sin(a + 4) * r * 0.7); g.closePath(); g.fill(); const rg = g.createRadialGradient(x, y, 0, x, y, r * 3); rg.addColorStop(0, `rgba(${c},.35)`); rg.addColorStop(1, `rgba(${c},0)`); g.fillStyle = rg; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); }
      g.globalCompositeOperation = 'source-over';
    });
  },
};
// 광택 훑기: sweep 빛 띠가 일정하게 지나가며, 띠의 세기는 t 에 따라 숨쉬듯 바뀜
const sweepAnim = (tex, base, amp, speed = 0.32) => (m, t) => { tex.offset.x = t * speed; m.body.emissiveIntensity = base + amp * (0.6 + 0.4 * Math.sin(t * 1.9)); };
// 스킨별 재질: body = 몸통 무늬, grip = 손잡이, metal = 총열, bolt, accent. anim = 매 프레임 움직임
// clearcoat 겉칠 · iridescence 무지갯빛 막은 화질 '낮음'에서는 빠진다
const SKIN_DEF = {
  desert: () => { const c = pcan(CAMO.desert, 10), m = texOf(c, true), n = nrm(c, 0.35); return { body: { wear: 0.5, wearCol: 0xb0a690, color: 0xffffff, map: m, normalMap: n, metalness: 0.06, roughness: 0.78 }, body2: { wear: 0.5, color: 0xc2b294, map: m, normalMap: n, metalness: 0.06, roughness: 0.84 }, grip: { color: 0x4a4234, roughness: 0.85 }, metal: { color: 0x4f473b, metalness: 0.78, roughness: 0.44 }, accent: { color: 0xe2c078 } }; },
  forest: () => { const c = pcan(CAMO.forest, 10), m = texOf(c, true), n = nrm(c, 0.3); return { body: { wear: 0.5, color: 0xffffff, map: m, normalMap: n, metalness: 0.05, roughness: 0.8 }, body2: { wear: 0.5, color: 0xb2b49a, map: m, normalMap: n, metalness: 0.05, roughness: 0.86 }, grip: { color: 0x2c3024, roughness: 0.85 }, metal: { color: 0x2b2e28, metalness: 0.8, roughness: 0.45 }, accent: { color: 0x9db55a } }; },
  urban: () => { const c = pcan(CAMO.urban, 10), m = texOf(c, true), n = nrm(c, 0.35); return { body: { wear: 0.55, wearCol: 0xd0d5dc, color: 0xffffff, map: m, normalMap: n, metalness: 0.1, roughness: 0.72 }, body2: { wear: 0.5, color: 0xb8bcc2, map: m, normalMap: n, metalness: 0.1, roughness: 0.8 }, grip: { color: 0x1c1e22, roughness: 0.85 }, metal: { color: 0x2a2d32, metalness: 0.85, roughness: 0.4 }, accent: { color: 0xd8dde3 } }; },
  // ── 얼티밋 번들 겉면: 모두 빛 층(emissive)이 있고, 매 프레임 세기를 다시 정한다 (각성 효과가 그 위에 곱해짐) ──
  platinum: () => { const c = pcan(CAMO.platinum, 5), sw = sweepTex(); return { body: { wear: 0.3, wearCol: 0xffffff, color: 0xffffff, map: texOf(c, true), normalMap: nrm(c, 0.9), metalness: 1, roughness: 0.14, roughnessMap: smudge(), clearcoat: 1, clearcoatRoughness: 0.06, emissive: 0xe8f0ff, emissiveMap: sw, emissiveIntensity: 0.4 }, grip: { color: 0x15171b, metalness: 0.3, roughness: 0.5 }, metal: { color: 0xeef1f6, metalness: 1, roughness: 0.1 }, bolt: { color: 0xffffff, metalness: 1, roughness: 0.05 }, accent: { color: 0x9fb6d8 }, envI: 1.9, anim: sweepAnim(sw, 0.15, 0.55) }; },
  damascus: () => { const c = pcan(CAMO.damascus, 5), sw = sweepTex(0.05); return { body: { wear: 0.25, wearCol: 0xfff2c8, color: 0xffffff, map: texOf(c, true), normalMap: nrm(c, 1.1), metalness: 1, roughness: 0.24, roughnessMap: smudge(), clearcoat: 0.7, clearcoatRoughness: 0.1, emissive: 0xffd890, emissiveMap: sw, emissiveIntensity: 0.4 }, grip: { color: 0x1d140d, metalness: 0.25, roughness: 0.55 }, metal: { color: 0x3a2618, metalness: 1, roughness: 0.22 }, bolt: { color: 0xf3cf8a, metalness: 1, roughness: 0.1 }, accent: { color: 0xe2a24a }, envI: 1.7, anim: sweepAnim(sw, 0.12, 0.5) }; },
  obsidian: () => { const c = pcan(CAMO.obsidian, 4), sw = sweepTex(0.035); return { body: { wear: 0, color: 0xffffff, map: texOf(c, true), normalMap: nrm(c, 0.6), metalness: 0.35, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0xc8b8ff, emissiveMap: sw, emissiveIntensity: 0.3 }, grip: { color: 0x0a0a0d, metalness: 0.4, roughness: 0.35 }, metal: { color: 0x121216, metalness: 1, roughness: 0.12 }, bolt: { color: 0xe6e8ee, metalness: 1, roughness: 0.06 }, accent: { color: 0xffffff }, envI: 2, anim: sweepAnim(sw, 0.1, 0.45, 0.26) }; },
  diamond: () => { const c = pcan(CAMO.diamond, 4), em = texOf(pcan(CAMO.diamondEm, 0), true); return { body: { wear: 0, color: 0xffffff, map: texOf(c, true), normalMap: nrm(c, 1.6), metalness: 0.55, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 1, iridescenceIOR: 2.0, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 1 }, grip: { color: 0x1c2534, metalness: 0.3, roughness: 0.4 }, metal: { color: 0xe4f4ff, metalness: 1, roughness: 0.06 }, bolt: { color: 0xffffff, metalness: 1, roughness: 0.03 }, accent: { color: 0x9fe4ff, emissive: 0x5fc8ff, emissiveIntensity: 0.6 }, envI: 2.2,
    anim: (m, t) => { const st = Math.floor(t * 4), k = t * 4 - st; em.offset.set(kr(st) * 0.9, kr(st + 77) * 0.9); m.body.emissiveIntensity = 0.25 + Math.sin(k * Math.PI) * 1.6; } }; }, // 반짝임이 자리를 옮기며 깜박임
  atomic: () => { const c = pcan(CAMO.atomic, 4), mp = texOf(c, true), em = texOf(pcan((g, s) => CAMO.atomic(g, s, true), 0), true); return { body: { wear: 0, color: 0xffffff, map: mp, normalMap: nrm(c, 0.5), metalness: 0.55, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 1 }, grip: { color: 0x200608, metalness: 0.3, roughness: 0.45 }, metal: { color: 0x7a0a0e, metalness: 1, roughness: 0.16 }, bolt: { color: 0xffb070, metalness: 1, roughness: 0.1, emissive: 0xff4a10, emissiveIntensity: 0.5 }, accent: { color: 0xffd45a, emissive: 0xff7a1a, emissiveIntensity: 0.9 }, envI: 1.8,
    anim: (m, t) => { mp.offset.set(t * 0.018, t * 0.01); em.offset.set(t * 0.018, t * 0.01); m.body.emissiveIntensity = 0.8 + Math.sin(t * 2.4) * 0.35 + Math.sin(t * 6.1) * 0.08; } }; }, // 결이 천천히 흐름
  orion: () => { const c = pcan(CAMO.orion, 4), mp = texOf(c, true), em = texOf(pcan((g, s) => CAMO.orion(g, s, true), 0), true), hc = new THREE.Color(); return { body: { wear: 0, color: 0xffffff, map: mp, normalMap: nrm(c, 0.4), metalness: 0.7, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 1, iridescenceIOR: 1.8, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 1 }, grip: { color: 0x141a2c, metalness: 0.3, roughness: 0.4 }, metal: { color: 0xd8e2f6, metalness: 1, roughness: 0.08 }, bolt: { color: 0xffffff, metalness: 1, roughness: 0.04 }, accent: { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 }, envI: 2,
    anim: (m, t) => { mp.offset.x = t * 0.025; em.offset.set(-t * 0.04, t * 0.012); m.body.emissive.copy(hc.setHSL((t * 0.09) % 1, 0.95, 0.6)); m.accent.emissive.copy(hc); m.body.emissiveIntensity = 1.0 + Math.sin(t * 1.6) * 0.3; } }; }, // 빛 색이 무지개로 돎
  darkmatter: () => { const c = pcan(CAMO.darkmatter, 5), mp = texOf(c, true), em = texOf(pcan((g, s) => CAMO.darkmatter(g, s, true), 0), true); return { body: { wear: 0, color: 0xffffff, map: mp, normalMap: nrm(c, 0.8), metalness: 0.65, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 1.2 }, grip: { color: 0x0c0a16, metalness: 0.3, roughness: 0.45 }, metal: { color: 0x1a1030, metalness: 1, roughness: 0.14 }, bolt: { color: 0xb070ff, metalness: 1, roughness: 0.1, emissive: 0x7a30ff, emissiveIntensity: 0.6 }, accent: { color: 0xff3da8, emissive: 0xff3da8, emissiveIntensity: 1 }, envI: 1.8,
    anim: (m, t) => { mp.offset.x = -t * 0.008; em.offset.set(t * 0.07, -t * 0.04); m.body.emissiveIntensity = 1.1 + Math.sin(t * 2.2) * 0.35 + Math.sin(t * 7.3) * 0.1; } }; }, // 빛 조각이 비스듬히 흘러감
  gold: () => { const c = pcan(PAT.gold, 6); return { body: { wear: 0.45, wearCol: 0xfff2c0, color: 0xffffff, map: texOf(c, true), normalMap: nrm(c, 1.5), metalness: 1, roughness: 0.24, roughnessMap: smudge(), clearcoat: 0.6, clearcoatRoughness: 0.12 }, grip: { color: 0x1a1612, metalness: 0.2, roughness: 0.6 }, metal: { color: 0xf0c45a, metalness: 1, roughness: 0.18, roughnessMap: smudge() }, bolt: { color: 0xfff0b8, metalness: 1, roughness: 0.1 }, accent: { color: 0x1a1612 }, envI: 1.6 }; },
  neon: () => { const c = pcan(PAT.neon, 6), mp = texOf(c, true), em = texOf(pcan((g, s) => PAT.neon(g, s, true), 0), true); return { body: { wear: 0.15, color: 0xffffff, map: mp, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 1.2, normalMap: nrm(c, 0.6), metalness: 0.7, roughness: 0.32, roughnessMap: smudge(), clearcoat: 0.5, clearcoatRoughness: 0.2 }, grip: { color: 0x0b0e14, roughness: 0.7 }, metal: { color: 0x10141c, metalness: 0.9, roughness: 0.3 }, bolt: { color: 0x19e3ff, emissive: 0x19e3ff, emissiveIntensity: 0.8 }, accent: { color: 0xff3df0, emissive: 0xff3df0, emissiveIntensity: 1 }, anim: (m, t) => { m.body.emissiveIntensity = 0.95 + Math.sin(t * 3) * 0.5; } }; },
  lava: () => { const c = pcan(PAT.lava), em = texOf(pcan((g, s) => PAT.lava(g, s, true), 0), true); return { body: { wear: 0, color: 0xffffff, map: texOf(c, true), emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 1.0, normalMap: nrm(c, 1.3), metalness: 0.15, roughness: 0.86 }, grip: { color: 0x17110f, roughness: 0.9 }, metal: { color: 0x2a1a14, metalness: 0.8, roughness: 0.4 }, bolt: { color: 0xff8a2a, emissive: 0xff5a00, emissiveIntensity: 0.9 }, accent: { color: 0xffd27a, emissive: 0xff7a1a, emissiveIntensity: 1 }, anim: (m, t) => { m.body.emissiveIntensity = 0.85 + Math.sin(t * 1.7) * 0.4 + Math.sin(t * 5.3) * 0.12; } }; },
  ice: () => { const c = pcan(PAT.ice, 6); return { body: { wear: 0, color: 0xffffff, map: texOf(c, true), normalMap: nrm(c, 1.2), metalness: 0.35, roughness: 0.16, roughnessMap: smudge(), clearcoat: 1, clearcoatRoughness: 0.05 }, grip: { color: 0x2a4a66, roughness: 0.5 }, metal: { color: 0xd8f1ff, metalness: 0.9, roughness: 0.12 }, bolt: { color: 0xffffff, metalness: 1, roughness: 0.08 }, accent: { color: 0x2f8fff }, envI: 1.6 }; },
  galaxy: () => { const mp = texOf(pcan(PAT.galaxy, 5), true), em = texOf(pcan((g, s) => PAT.galaxy(g, s, true), 0), true); return { body: { wear: 0, color: 0xffffff, map: mp, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 0.8, metalness: 0.55, roughness: 0.26, roughnessMap: smudge(), clearcoat: 1, clearcoatRoughness: 0.08 }, grip: { color: 0x120e2c, roughness: 0.6 }, metal: { color: 0x2a1f5e, metalness: 0.95, roughness: 0.25 }, bolt: { color: 0xc59bff, metalness: 1, roughness: 0.15 }, accent: { color: 0xff46be, emissive: 0xff46be, emissiveIntensity: 0.8 }, anim: (m, t) => { mp.offset.x = em.offset.x = t * 0.03; mp.offset.y = em.offset.y = t * 0.012; m.body.emissiveIntensity = 0.75 + Math.sin(t * 2.1) * 0.25; } }; },
  tiger: () => { const c = pcan(PAT.tiger); return { body: { wear: 0.4, color: 0xffffff, map: texOf(c, true), normalMap: nrm(c, 0.25), metalness: 0.1, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.35 }, grip: { color: 0x17110c, roughness: 0.8 }, metal: { color: 0x1a1512, metalness: 0.85, roughness: 0.35 }, accent: { color: 0xf7e3c0 } }; },
  carbon: () => { const c = pcan(PAT.carbon, 0); return { body: { wear: 0.25, color: 0xffffff, map: texOf(c, true), normalMap: nrm(c, 0.7), metalness: 0.5, roughness: 0.36, roughnessMap: smudge(), clearcoat: 1, clearcoatRoughness: 0.1 }, grip: { color: 0x121316, roughness: 0.7 }, metal: { color: 0xb0161e, metalness: 0.9, roughness: 0.28 }, bolt: { color: 0xe0282f, metalness: 1, roughness: 0.2 }, accent: { color: 0xf2f2ee }, envI: 1.4 }; },
  sakura: () => { const c = pcan(PAT.sakura, 6); return { body: { wear: 0.12, color: 0xffffff, map: texOf(c, true), normalMap: nrm(c, 0.35), metalness: 0.08, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.12 }, grip: { color: 0x4a2f3a, roughness: 0.7 }, metal: { color: 0xf2c4d2, metalness: 0.85, roughness: 0.25 }, bolt: { color: 0xffffff, metalness: 1, roughness: 0.15 }, accent: { color: 0xff5f95 } }; },
  aurora: () => { const mp = texOf(pcan((g, s) => PAT.aurora(g, s, false), 4), true), em = texOf(pcan((g, s) => PAT.aurora(g, s, true), 0), true); return { body: { color: 0xffffff, map: mp, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 0.7, metalness: 0.75, roughness: 0.2, roughnessMap: smudge(), clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.7, iridescenceIOR: 1.5, wear: 0 }, grip: { color: 0x10182a, metalness: 0.3, roughness: 0.45 }, metal: { color: 0xdfe8f2, metalness: 1, roughness: 0.1, wear: 0 }, bolt: { color: 0xffffff, metalness: 1, roughness: 0.05 }, accent: { color: 0x7dffc8, emissive: 0x3dffb0, emissiveIntensity: 0.8 }, envI: 1.6, anim: (m, t) => { mp.offset.x = em.offset.x = t * 0.035; m.body.emissiveIntensity = 0.62 + Math.sin(t * 1.3) * 0.22; } }; },
  halloween: () => { const c = pcan((g, s) => PAT.halloween(g, s, false), 8), mp = texOf(c, true), em = texOf(pcan((g, s) => PAT.halloween(g, s, true), 0), true); return { body: { wear: 0.25, color: 0xffffff, map: mp, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 1.1, normalMap: nrm(c, 0.4), metalness: 0.2, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.3 }, grip: { color: 0x1a1220, roughness: 0.8 }, metal: { color: 0x2c1d3a, metalness: 0.88, roughness: 0.32 }, bolt: { color: 0xff8a1a, metalness: 0.7, roughness: 0.3, emissive: 0x7a2c00, emissiveIntensity: 0.5 }, accent: { color: 0x9dff3a, emissive: 0x6fd020, emissiveIntensity: 0.9 }, anim: (M, t) => { const k = 1.75 + Math.sin(t * 9.1) * 0.22 + Math.sin(t * 23.7) * 0.16; M.glow.emissiveIntensity = k; M.body.emissiveIntensity = 0.75 + (k - 1.75) * 1.1 + 0.35; } }; }, // 촛불처럼 일렁임
};
// 형태 키트가 없는 스킨(무료·위장)의 궤적·불꽃 색 (형태 키트가 있는 스킨은 키트에 적혀 있음)
const FX_FREE = { desert: { tracer: 0xffd08a, flash: 0xffb45a }, forest: { tracer: 0xbfff8a, flash: 0xd9ff9a }, urban: { tracer: 0xdfe8f2, flash: 0xfff0d0 } };
// 형태 키트가 쓰는 스킨 전용 재질
const KMATS = {
  tiger: () => ({ fang: { color: 0xf3ead2, metalness: 0.1, roughness: 0.32 }, eye: { color: 0xb6ff3a, emissive: 0x9dff3a, emissiveIntensity: 1.3, roughness: 0.2 } }),
  sakura: () => ({ petal: { color: 0xfff6fa, metalness: 0, roughness: 0.45, emissive: 0x4a1024, emissiveIntensity: 0.25 }, twig: { color: 0x5a3a34, metalness: 0, roughness: 0.8 } }),
  ice: () => ({ crystal: { color: 0xcdefff, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.74, emissive: 0x3a8fd0, emissiveIntensity: 0.4, flatShading: true } }),
  neon: () => ({ glow: { color: 0x19e3ff, emissive: 0x19e3ff, emissiveIntensity: 1.7, roughness: 0.3 }, glow2: { color: 0xff3df0, emissive: 0xff3df0, emissiveIntensity: 1.5, roughness: 0.3 } }),
  lava: () => ({ core: { color: 0xffb040, emissive: 0xff5a00, emissiveIntensity: 1.9, roughness: 0.6 }, horn: { color: 0x241a16, metalness: 0.25, roughness: 0.55, flatShading: true } }),
  gold: () => ({ gem: { color: 0xff1a3c, metalness: 0.3, roughness: 0.04, emissive: 0xc00018, emissiveIntensity: 1.3, flatShading: true } }),
  galaxy: () => ({ star: { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6 }, planet: { color: 0xff9ad8, emissive: 0x8030ff, emissiveIntensity: 0.5, roughness: 0.4 }, portal: { color: 0xb060ff, emissive: 0xa040ff, emissiveIntensity: 1.6, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false } }),
  aurora: (M) => ({ prism: { color: 0xffffff, map: M.body.map, metalness: 0.55, roughness: 0.05, transparent: true, opacity: 0.66, emissive: 0xffffff, emissiveMap: M.body.map, emissiveIntensity: 0.4, side: THREE.DoubleSide } }),
  platinum: () => ({ holo: { color: 0x9fe6ff, emissive: 0x3ab8ff, emissiveIntensity: 2.2, roughness: 0.3 }, trim: { color: 0xffd27a, metalness: 1, roughness: 0.14 } }),
  damascus: () => ({ wrap: { color: 0x17120e, metalness: 0.05, roughness: 0.92 }, gilt: { color: 0xf0c060, metalness: 1, roughness: 0.16 }, silk: { color: 0xb3121c, metalness: 0, roughness: 0.75, emissive: 0x3a0004, emissiveIntensity: 0.4 }, hamon: { color: 0xe8edf2, metalness: 1, roughness: 0.08 } }),
  obsidian: () => ({ shard: { color: 0x0b0a10, metalness: 0.5, roughness: 0.03, flatShading: true }, rift: { color: 0xd8b8ff, emissive: 0xa060ff, emissiveIntensity: 2.4, roughness: 0.4 } }),
  diamond: () => ({ crystal: { color: 0xe8f8ff, metalness: 0.1, roughness: 0.02, transparent: true, opacity: 0.72, emissive: 0x6fc0ff, emissiveIntensity: 0.55, flatShading: true }, gilt: { color: 0xf3d27a, metalness: 1, roughness: 0.12 }, pink: { color: 0xff8fcf, metalness: 0.3, roughness: 0.04, emissive: 0x80104a, emissiveIntensity: 0.6, flatShading: true } }),
  atomic: () => ({ core: { color: 0xff9a40, emissive: 0xff4a00, emissiveIntensity: 2.4, roughness: 0.5 }, glassR: { color: 0xffe0c0, metalness: 0.2, roughness: 0.04, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }, hazard: { color: 0xffc21a, metalness: 0.3, roughness: 0.45, emissive: 0x3a2400, emissiveIntensity: 0.4 } }),
  orion: () => ({ star: { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 }, line: { color: 0xc8e4ff, emissive: 0x8fc8ff, emissiveIntensity: 1.6, roughness: 0.3 } }),
  darkmatter: () => ({ voidm: { color: 0x000000, metalness: 0, roughness: 1 }, rim: { color: 0xd8a0ff, emissive: 0xa040ff, emissiveIntensity: 2.4, roughness: 0.4 }, halo: { color: 0x8040ff, emissive: 0xa040ff, emissiveIntensity: 1.6, transparent: true, opacity: 0.55, side: THREE.BackSide, depthWrite: false }, disk: { color: 0xff8ad8, emissive: 0xff40b0, emissiveIntensity: 2, roughness: 0.4 } }),
  halloween: () => ({ pumpkin: { color: 0xc94f08, metalness: 0.05, roughness: 0.6 }, glow: { color: 0xffe070, emissive: 0xffc030, emissiveIntensity: 1.8, roughness: 0.6 }, wing: { color: 0x17101f, metalness: 0.35, roughness: 0.45, side: THREE.DoubleSide }, stem: { color: 0x4d6b2a, metalness: 0, roughness: 0.8 }, eye: { color: 0xb6ff3a, emissive: 0x9dff3a, emissiveIntensity: 1.5, roughness: 0.3 } }),
};
const SETS = new Map(), animated = [], bundleSets = [];
const RIMK = { crimson: 0.12, aqua: 0.12, phoenix: 0.35, sakura: 0.3, ice: 0.45, aurora: 0.6, halloween: 0.5, tiger: 0.55, diamond: 0.4, platinum: 0.5, orion: 0.45, gold: 0.8 };
let pulseAt = -9, pulseK = 1, spinAcc = 0, spinLast = 0, spinBoost = 0;
// 도는 장식의 각도: 보통은 시간만큼, 쏘거나 살펴볼 때는 몇 배 빠르게 감음
function spinPhase() { const t = performance.now() / 1000, dt = Math.min(0.1, Math.max(0, t - spinLast)); spinLast = t; spinBoost = Math.max(0, spinBoost - dt * 1.6); spinAcc += dt * (1 + spinBoost * 7); return spinAcc; }
export function skinFire(k = 0.35) { spinBoost = Math.min(1.5, spinBoost + k); }
// aw = 각성(스킨 5레벨): 총열과 몸통에 빛줄기가 흐르고 빛이 더 세게 맥박침
function matsFor(skin, aw) {
  const key = skin + (aw ? 'a' : '');
  if (SETS.has(key)) return SETS.get(key);
  const M = { ...FIX, ...baseMats() }, id = SKINS[skin] ? SKINS[skin].id : 'std', def = SKIN_DEF[id] ? SKIN_DEF[id]() : null;
  if (def) {
    const mk = (o) => { const m = std(o); if (def.envI) m.envMapIntensity = def.envI; return m; };
    const body = mk(def.body), body2 = def.body2 ? mk(def.body2) : body, grip = mk({ wear: 0.25, wearCol: 0x6a6f76, normalMap: nStip(), normalScale: new THREE.Vector2(0.45, 0.45), ...def.grip }), metal = mk({ wear: 0.45, roughnessMap: smudge(), ...def.metal });
    Object.assign(M, { recv: body, slide: body, gray: body, mag: body2, olive: body2, tan: body2, wood: body2, woodDark: body2, furn: body2, poly: grip, steel: metal, bolt: mk(def.bolt || { color: 0xc2c7ce, metalness: 1, roughness: 0.22 }) });
    if (def.accent) M.accent = mk(def.accent);
    M.body = body;
    if (KMATS[id]) for (const [k, o] of Object.entries(KMATS[id](M))) M[k] = mk(o);
    if (KITS[id] && KITS[id].fx.bundle) { M._glow = Object.keys(KMATS[id] ? KMATS[id](M) : {}).map((k) => M[k]).filter((m) => m.emissiveIntensity > 0 && m.emissive && m.emissive.getHex()).map((m) => [m, m.emissiveIntensity]); bundleSets.push(M); }
    { // 윤곽광: 유료 스킨은 테마 색으로 가장자리가 은은히 빛나고, 무료 스킨은 아주 약하게
      const th = new THREE.Color((skinFx(skin) || {}).flash || 0xbfc8d4), paid = !SKINS[skin].free, rk = RIMK[id] ?? 1; // 밝은 겉면은 윤곽광을 줄여 하얗게 뜨지 않게
      M._rims = [[body, paid ? 0.3 * rk : 0.08], [body2, paid ? 0.2 * rk : 0.05], [metal, paid ? 0.26 * rk : 0.05], [M.bolt, paid ? 0.2 * rk : 0], [grip, paid ? 0.1 * rk : 0]].map(([m, k]) => { m.userData.rim.value.copy(th).multiplyScalar(k); return [m, m.userData.rim.value.clone()]; });
    }
    if (def.anim) animated.push({ M, f: def.anim });
    if (aw) {
      const col = (skinFx(skin) || {}).flash || 0xffe9a8, v = veins(), own = !!body.emissiveMap;
      if (!own) { body.emissive = new THREE.Color(col); body.emissiveMap = v; body.emissiveIntensity = 0.5; }
      metal.emissive = new THREE.Color(col); metal.emissiveMap = v; metal.emissiveIntensity = 1;
      animated.push({ M, f: (m, t) => { const k = 0.5 + 0.5 * Math.sin(t * 2.6); v.offset.x = t * 0.22; v.offset.y = Math.sin(t * 0.7) * 0.05; metal.emissiveIntensity = 0.9 + k * 1.3; if (own) body.emissiveIntensity *= 1.25 + k * 0.35; else body.emissiveIntensity = 0.3 + k * 0.6; } });
    }
  }
  else { // 기본 스킨: 금속 위로 은은한 광택이 지나가고, 가장자리가 차갑게 빛남
    const sw = sweepTex(0.04);
    for (const m of [M.recv, M.slide, M.steel]) { m.emissive = new THREE.Color(0xd8e6ff); m.emissiveMap = sw; m.emissiveIntensity = 0; m.userData.rim.value.setRGB(0.07, 0.09, 0.12); }
    M.body = M.recv; animated.push({ M, f: (m, t) => { sw.offset.x = t * 0.22; const k = 0.08 + 0.14 * Math.max(0, Math.sin(t * 0.9)) ** 3; m.recv.emissiveIntensity = m.slide.emissiveIntensity = k; m.steel.emissiveIntensity = k * 0.6; } });
  }
  SETS.set(key, M);
  return M;
}
// 움직이는 스킨(빛나는 맥박, 흐르는 무늬)
export function tickSkins(t) {
  for (const a of animated) a.f(a.M, t);
  const k = pulseK * Math.max(0, 1 - (performance.now() / 1000 - pulseAt) / 0.8) ** 2; // 꺼낼 때 한 번 확 밝아짐
  for (const M of bundleSets) { // 얼티밋 스킨: 빛나는 부품이 숨 쉬듯 일렁임
    M._glow.forEach(([m, b], i) => { m.emissiveIntensity = b * (0.82 + 0.22 * Math.sin(t * 3.1 + i * 1.7) + k * 2.6); });
    if (k && M.body.emissiveMap) M.body.emissiveIntensity *= 1 + k * 2;
    if (M._rims) for (const [m, c] of M._rims) m.userData.rim.value.copy(c).multiplyScalar(1 + 0.18 * Math.sin(t * 2.2) + k * 4);
  }
}
// 얼티밋 스킨을 꺼낼 때 빛이 번쩍이게
export function pulseSkin(k = 1) { pulseAt = performance.now() / 1000; pulseK = k; spinBoost = Math.min(1.5, spinBoost + k * 0.8); }

// ───────────── 형태 도구 ─────────────
const labelMats = new Map();
function labelMat(text) {
  if (!labelMats.has(text)) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d'); g.fillStyle = '#e9ebee'; g.font = '700 30px "Arial Narrow", Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText(text, 4, 34);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    labelMats.set(text, new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  }
  return labelMats.get(text);
}
const V3 = (p) => new THREE.Vector3(p[2] || 0, p[1], -p[0]);
const dist = (a, c) => V3(a).distanceTo(V3(c));
function roundPts(pts, r) { // 꼭짓점을 둥글게
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], c = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lc = Math.hypot(c[0] - p[0], c[1] - p[1]), d = Math.min(r, la * 0.45, lc * 0.45);
    const p0 = [p[0] + ((a[0] - p[0]) / la) * d, p[1] + ((a[1] - p[1]) / la) * d], p1 = [p[0] + ((c[0] - p[0]) / lc) * d, p[1] + ((c[1] - p[1]) / lc) * d];
    for (const t of [0, 0.5, 1]) { const u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * p[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * p[1] + t * t * p1[1]]); }
  }
  return out;
}
// 밀어낸 형태에서 둥글린 모서리 면(앞뒤 면도 옆벽도 아닌 비스듬한 면)을 찾아 aWear = 1 로 표시 → 모서리 닳음에 씀
function tagBevel(geo, k = 1) {
  const p = geo.attributes.position, n = p.count, w = new Float32Array(n), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); C.fromBufferAttribute(p, i + 2);
    B.sub(A); C.sub(A); B.cross(C); const l = B.length(); if (!l) continue;
    const nz = Math.abs(B.z / l); if (nz > 0.12 && nz < 0.97) w[i] = w[i + 1] = w[i + 2] = k;
  }
  geo.setAttribute('aWear', new THREE.BufferAttribute(w, 1));
}
// 넓은 평면이 이기는 부드러운 법선: 같은 자리의 꼭짓점끼리, 꺾인 각이 60° 안쪽인 면들의 법선을 '그 면이 속한 평면의 넓이'로 가중해 합친다.
// 넓은 옆면은 평평하게 남고 좁은 모서리 면만 둥글게 이어져, 모서리에 빛이 맺힌다
function softNormals(pos, nor, n) {
  const fc = n / 3, fn = new Float32Array(fc * 3), pid = new Int32Array(fc), planes = new Map(), area = [];
  for (let f = 0; f < fc; f++) {
    const i = f * 9, ax = pos[i], ay = pos[i + 1], az = pos[i + 2], ux = pos[i + 3] - ax, uy = pos[i + 4] - ay, uz = pos[i + 5] - az, vx = pos[i + 6] - ax, vy = pos[i + 7] - ay, vz = pos[i + 8] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1e-12; nx /= l; ny /= l; nz /= l;
    fn[f * 3] = nx; fn[f * 3 + 1] = ny; fn[f * 3 + 2] = nz;
    const k = Math.round(nx * 60) + ',' + Math.round(ny * 60) + ',' + Math.round(nz * 60) + ',' + Math.round((nx * ax + ny * ay + nz * az) * 4000);
    let id = planes.get(k); if (id === undefined) { id = area.length; planes.set(k, id); area.push(0); }
    pid[f] = id; area[id] += l;
  }
  const vmap = new Map(), vf = [];
  for (let v = 0; v < n; v++) { const k = Math.round(pos[v * 3] * 20000) + ',' + Math.round(pos[v * 3 + 1] * 20000) + ',' + Math.round(pos[v * 3 + 2] * 20000); let a = vmap.get(k); if (!a) { a = []; vmap.set(k, a); } a.push((v / 3) | 0); vf.push(a); }
  const seen = [];
  for (let v = 0; v < n; v++) {
    const f = (v / 3) | 0, fx = fn[f * 3], fy = fn[f * 3 + 1], fz = fn[f * 3 + 2]; let x = 0, y = 0, z = 0; seen.length = 0;
    for (const g of vf[v]) { const id = pid[g]; if (seen.includes(id)) continue; const gx = fn[g * 3], gy = fn[g * 3 + 1], gz = fn[g * 3 + 2]; if (fx * gx + fy * gy + fz * gz < 0.5) continue; seen.push(id); const w = area[id]; x += gx * w; y += gy * w; z += gz * w; }
    const l = Math.hypot(x, y, z) || 1; nor[v * 3] = x / l; nor[v * 3 + 1] = y / l; nor[v * 3 + 2] = z / l;
  }
}
class Builder {
  constructor() { this.parts = []; this.cur = ''; this.shift = 0; this.pivots = {}; }
  // 이후에 넣는 부품은 이 이름의 움직이는 묶음에 들어감. pivot 을 주면 그 점을 중심으로 도는 묶음(spin…)이 됨
  part(name = '', pivot, speed, axis) { this.cur = name; if (pivot) this.pivots[name] = { p: pivot, speed: speed || 1, axis: axis || 'z' }; return this; } // axis: 'z' 총열 둘레로 돎, 'x' 옆면에서 바퀴처럼 돎
  add(geo, mat, m, keepUV) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    if (this.shift) g.translate(this.shift, 0, 0);
    this.parts.push({ g, mat, part: this.cur, keepUV });
    return this;
  }
  // 옆모습 윤곽 [[앞, 위], …] 을 두께 w 로 밀어냄. opt.r = 꼭짓점 둥글림, opt.holes = 뚫린 구멍들
  prof(pts, w, mat, bevel = 0.004, x = 0, opt = {}) {
    const s = new THREE.Shape(), P = opt.r ? roundPts(pts, opt.r) : pts;
    if (opt.hr) opt = { ...opt, holes: (opt.holes || []).map((h) => roundPts(h, opt.hr)) };
    P.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
    s.closePath();
    for (const h of opt.holes || []) { const hp = new THREE.Path(); h.forEach((p, i) => (i ? hp.lineTo(p[0], p[1]) : hp.moveTo(p[0], p[1]))); hp.closePath(); s.holes.push(hp); }
    if (bevel >= 0.003 && w >= 0.024 && !opt.flat) bevel = Math.min(0.0105, Math.max(bevel, w * 0.19)); // 두꺼운 부품은 옆면 모서리를 넉넉히 둥글려 판자처럼 보이지 않게
    const depth = Math.max(0.001, w - bevel * 2);
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: bevel >= 0.006 ? 3 : 2, bevelOffset: -bevel, curveSegments: 6 });
    tagBevel(geo, bevel > 0.0048 ? 0.5 : 1); // 넓게 둥글린 면은 거의 닳지 않게
    geo.translate(0, 0, -depth / 2);
    geo.rotateY(Math.PI / 2);
    geo.translate(x, 0, 0);
    if (opt.roll) { const cu = opt.cu || 0; geo.translate(0, -cu, 0); geo.rotateZ(opt.roll); geo.translate(0, cu, 0); } // 총열 축을 중심으로 돌려 세움
    return this.add(geo, mat);
  }
  // ── 스킨 형태용 도구. 점은 [앞, 위, 옆] ──
  _lay(geo, a, c) { // 세로(Y)로 선 형태를 a→c 방향으로 눕혀 그 사이에 놓음
    const A = V3(a), C = V3(c), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), C.clone().sub(A).normalize());
    return geo.applyMatrix4(new THREE.Matrix4().compose(A.add(C).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  }
  spike(a, c, r, mat, seg = 6) { return this.add(this._lay(new THREE.ConeGeometry(r, dist(a, c), seg), a, c), mat); }          // 가시·뿔
  rod(a, c, rA, rC, mat, seg = 8) { return this.add(this._lay(new THREE.CylinderGeometry(rC, rA, dist(a, c), seg), a, c), mat); } // 두 점을 잇는 막대
  crys(a, c, r, mat, seg = 5) { const m = [0, 1, 2].map((i) => (a[i] || 0) + ((c[i] || 0) - (a[i] || 0)) * 0.5); return this.rod(a, m, r * 0.62, r, mat, seg).spike(m, c, r, mat, seg); } // 결정
  lump(r, p, mat, s = [1, 1, 1], rot = 0) { const g = new THREE.DodecahedronGeometry(r, 0); g.rotateX(rot * 1.7); g.rotateY(rot * 2.3); g.scale(s[2], s[1], s[0]); g.translate(p[2] || 0, p[1], -p[0]); return this.add(g, mat); } // 돌덩이
  gem(r, p, mat, s = [1, 1, 1]) { const g = new THREE.OctahedronGeometry(r, 0); g.scale(s[2], s[1], s[0]); g.translate(p[2] || 0, p[1], -p[0]); return this.add(g, mat); }
  ball(r, p, mat, s = [1, 1, 1], seg = 12) { const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 3)); g.scale(s[2], s[1], s[0]); g.translate(p[2] || 0, p[1], -p[0]); return this.add(g, mat); }
  tor(R, t, p, mat, rx = 0, ry = 0, arc = 6.2832, seg = 28) { const g = new THREE.TorusGeometry(R, t, 6, seg, arc); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(p[2] || 0, p[1], -p[0]); return this.add(g, mat); } // 고리 (기본: 총열을 감쌈)
  ecyl(rx, ru, f, len, u, mat, k = 1, seg = 18, x = 0) { const g = new THREE.CylinderGeometry(k, 1, len, seg, 1, false); g.rotateX(-Math.PI / 2); g.scale(rx, ru, 1); g.translate(x, u, -(f + len / 2)); return this.add(g, mat); } // 납작한(타원) 통. k = 앞쪽 굵기 비율
  radial(n, fn, f, u, mat, a0 = 0) { for (let k = 0; k < n; k++) { const g = fn(k); g.rotateZ(a0 + (k / n) * 6.2832); g.translate(0, u, -f); this.add(g, mat); } return this; } // 총열 둘레로 n 개. fn 은 +Y 가 바깥, -Z 가 앞인 형태를 돌려줌
  // 앞뒤 방향 원통: f 에서 시작해 앞으로 len. rB = 뒤쪽 반지름, rF = 앞쪽 반지름
  cyl(rB, rF, f, len, u, mat, x = 0, seg = 16) {
    const geo = new THREE.CylinderGeometry(rF, rB, len, seg, 1, false);
    geo.rotateX(-Math.PI / 2);
    geo.translate(x, u, -(f + len / 2));
    return this.add(geo, mat);
  }
  tube(rB, rF, f, len, u, mat, seg = 18) { const geo = new THREE.CylinderGeometry(rF, rB, len, seg, 1, true); geo.rotateX(-Math.PI / 2); geo.translate(0, u, -(f + len / 2)); return this.add(geo, mat); } // 속이 빈 통
  vcyl(r, h, f, u, mat, x = 0, seg = 12) { // 세로 원통
    const geo = new THREE.CylinderGeometry(r, r, h, seg);
    geo.translate(x, u, -f);
    return this.add(geo, mat);
  }
  xcyl(r, w, f, u, mat, x = 0, seg = 10) { // 좌우 방향 원통 (핀·손잡이)
    const geo = new THREE.CylinderGeometry(r, r, w, seg);
    geo.rotateZ(Math.PI / 2); geo.translate(x, u, -f);
    return this.add(geo, mat);
  }
  box(w, h, l, f, u, mat, x = 0, rx = 0, rz = 0) {
    const mn = Math.min(w, h, l);
    let geo;
    if (mn >= 0.0075 && mat.isMeshStandardMaterial) { // 큰 상자는 모서리를 둥글림
      const r = Math.min(0.0022, mn * 0.2), sh = new THREE.Shape(); roundPts([[-l / 2, -h / 2], [l / 2, -h / 2], [l / 2, h / 2], [-l / 2, h / 2]], r).forEach((q, i) => (i ? sh.lineTo(q[0], q[1]) : sh.moveTo(q[0], q[1]))); sh.closePath();
      geo = new THREE.ExtrudeGeometry(sh, { depth: w - r * 2, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 2, bevelOffset: -r, curveSegments: 2 });
      tagBevel(geo); geo.translate(0, 0, -(w - r * 2) / 2); geo.rotateY(Math.PI / 2);
    } else geo = new THREE.BoxGeometry(w, h, l);
    if (rx) geo.rotateX(rx);
    if (rz) geo.rotateZ(rz);
    geo.translate(x, u, -f);
    return this.add(geo, mat);
  }
  disc(r, f, u, mat, back = false, x = 0) { // 앞(또는 뒤)을 보는 원판
    const geo = new THREE.CircleGeometry(r, 18);
    if (!back) geo.rotateY(Math.PI);
    geo.translate(x, u, -f);
    return this.add(geo, mat);
  }
  sdisc(r, f, u, x, mat) { // 옆을 보는 원판
    const geo = new THREE.CircleGeometry(r, 12);
    geo.rotateY(x < 0 ? -Math.PI / 2 : Math.PI / 2); geo.translate(x, u, -f);
    return this.add(geo, mat);
  }
  ring(r, t, f, u, mat) { const geo = new THREE.TorusGeometry(r, t, 6, 16); geo.translate(0, u, -f); return this.add(geo, mat); }
  label(text, f, u, x, w, h) { // 옆면 각인
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateY(x < 0 ? -Math.PI / 2 : Math.PI / 2); geo.translate(x, u, -f);
    return this.add(geo, labelMat(text), null, true);
  }
  capsule(r, len, from, to, mat) { // from/to = [x, y, z]
    const geo = new THREE.CapsuleGeometry(r, len, 4, 10);
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return this.add(geo, mat, m);
  }
  build() {
    const root = new THREE.Group(), groups = new Map([['', root]]);
    const by = new Map();
    for (const p of this.parts) { const k = p.part; if (!by.has(k)) by.set(k, new Map()); const m = by.get(k); if (!m.has(p.mat)) m.set(p.mat, []); m.get(p.mat).push(p); }
    for (const [name, mm] of by) {
      let grp = groups.get(name);
      if (!grp) { grp = new THREE.Group(); grp.name = name; root.add(grp); groups.set(name, grp); }
      const pv = this.pivots[name];
      if (pv) { grp.position.set(pv.p[2] || 0, pv.p[1], -pv.p[0]); grp.userData.spin = pv.speed; grp.userData.axis = pv.axis; }
      for (const [mat, list] of mm) {
        let n = 0;
        for (const p of list) n += p.g.attributes.position.count;
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), wr = new Float32Array(n), lit = mat.isMeshStandardMaterial && !mat.flatShading;
        let o = 0;
        for (const p of list) {
          const g = p.g, c = g.attributes.position.count, pa = g.attributes.position.array;
          pos.set(pa, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.aWear) wr.set(g.attributes.aWear.array, o);
          if (p.keepUV) uv.set(g.attributes.uv.array, o * 2);
          else for (let i = 0; i < c; i++) { uv[(o + i) * 2] = -pa[i * 3 + 2] * 2 + pa[i * 3] * 0.6; uv[(o + i) * 2 + 1] = pa[i * 3 + 1] * 2 + 0.5; } // 옆에서 본 평면으로 무늬를 입힘
          o += c; g.dispose();
        }
        if (pv) for (let i = 0; i < n; i++) { pos[i * 3] -= grp.position.x; pos[i * 3 + 1] -= grp.position.y; pos[i * 3 + 2] -= grp.position.z; }
        if (lit && n % 3 === 0) softNormals(pos, nor, n);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        if (lit) geo.setAttribute('aWear', new THREE.BufferAttribute(wr, 1));
        const mesh = new THREE.Mesh(geo, mat);
        if (mat === FIX.mask) { mesh.renderOrder = -1; mesh.visible = false; mesh.name = 'fpMask'; } // 1인칭 총에서만 켬
        grp.add(mesh);
      }
    }
    return root;
  }
}

// ───────────── 공통 부품 ─────────────
function tguard(b, f, u, M, mat) { // 방아쇠울(고리)과 방아쇠
  b.prof([[f - 0.04, u + 0.004], [f + 0.046, u + 0.004], [f + 0.041, u - 0.03], [f + 0.022, u - 0.044], [f - 0.026, u - 0.044], [f - 0.04, u - 0.03]], 0.012, mat || M.recv, 0.0015, 0,
    { holes: [[[f - 0.034, u - 0.001], [f + 0.039, u - 0.001], [f + 0.035, u - 0.027], [f + 0.019, u - 0.038], [f - 0.023, u - 0.038], [f - 0.034, u - 0.027]]] });
  b.prof([[f - 0.003, u], [f + 0.006, u], [f + 0.002, u - 0.014], [f + 0.007, u - 0.028], [f + 0.002, u - 0.029], [f - 0.005, u - 0.015]], 0.006, M.bolt, 0.001);
}
function rail(b, f0, f1, u, M, w = 0.021) { // 톱니 레일
  b.box(w, 0.005, f1 - f0, (f0 + f1) / 2, u + 0.0025, M.recv);
  for (let i = 0, n = Math.floor((f1 - f0) / 0.0105); i < n; i++) b.box(w, 0.0045, 0.0056, f0 + 0.005 + i * 0.0105, u + 0.007, M.recv);
}
function slots(b, f0, n, pitch, u, hw, M, len = 0.028, h = 0.008) { for (let i = 0; i < n; i++) for (const s of [-1, 1]) b.box(0.0014, h, len, f0 + i * pitch, u, M.dark, s * hw); }
// 테두리 조준기(유리 + 빨간 조준점). 가운데 높이를 돌려줌
function holo(b, f, u0, M, k = 1) {
  const cy = u0 + 0.012 + 0.021 * k, hw = 0.019 * k, hh = 0.021 * k;
  b.box(0.032 * k, 0.012, 0.058 * k, f, u0 + 0.006, M.recv);
  b.xcyl(0.0055, 0.042 * k, f - 0.014, u0 + 0.006, M.steel);
  for (const s of [-1, 1]) b.box(0.004, hh * 2 + 0.004, 0.034 * k, f + 0.008, cy, M.recv, s * (hw + 0.002));
  b.box(hw * 2 + 0.008, 0.004, 0.034 * k, f + 0.008, cy + hh + 0.002, M.recv);
  b.box(hw * 2 + 0.008, 0.003, 0.012, f + 0.02 * k, cy - hh, M.recv);
  b.add(new THREE.PlaneGeometry(hw * 2, hh * 2).translate(0, cy, -(f + 0.02 * k)), M.lens, null, true);
  b.add(new THREE.PlaneGeometry(0.02 * k, 0.02 * k).translate(0, cy, -(f + 0.0195 * k)), M.reticle, null, true);
  b.vcyl(0.004, 0.006, f - 0.005, cy + hh + 0.006, M.steel);
  return cy;
}
function muzzleBrake(b, f, u, M, r = 0.014, len = 0.05) {
  b.cyl(r * 0.8, r, f, 0.012, u, M.steel); b.cyl(r, r, f + 0.012, len - 0.012, u, M.steel, 0, 10);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) b.box(0.002, r * 0.9, 0.006, f + 0.02 + i * 0.01, u, M.dark, s * r * 0.93);
  b.disc(r * 0.55, f + len + 0.0005, u, M.dark);
  return f + len;
}
function suppressor(b, f, len, r, u, M) {
  b.cyl(r, r, f, len, u, M.steel, 0, 18);
  for (let i = 0; i < 7; i++) b.cyl(r + 0.0012, r + 0.0012, f + 0.006 + i * 0.006, 0.003, u, M.recv, 0, 18);
  b.cyl(r + 0.001, r + 0.001, f + len - 0.012, 0.012, u, M.recv, 0, 18);
  b.disc(r * 0.4, f + len + 0.0005, u, M.dark);
  return f + len;
}
function buttPad(b, f, u, h, M, w = 0.044) { b.prof([[f, u - h / 2], [f, u + h / 2], [f - 0.012, u + h / 2 - 0.004], [f - 0.014, u], [f - 0.012, u - h / 2 + 0.004]], w, M.rubber, 0.004); for (let i = -2; i <= 2; i++) b.box(w + 0.001, 0.003, 0.01, f - 0.007, u + i * h * 0.17, M.dark); }
function pistolGrip(b, M, f = 0, u = 0) { // 권총형 손잡이 (홈과 밑판)
  b.prof([[f - 0.076, u - 0.046], [f - 0.03, u - 0.046], [f - 0.044, u - 0.085], [f - 0.064, u - 0.158], [f - 0.114, u - 0.152], [f - 0.101, u - 0.09], [f - 0.088, u - 0.058]], 0.034, M.poly, 0.008, 0, { r: 0.006 });
  for (let i = 0; i < 5; i++) b.box(0.0345, 0.0026, 0.007, f - 0.096 - i * 0.0035, u - 0.082 - i * 0.014, M.dark, 0, 0.25);
  b.box(0.03, 0.005, 0.05, f - 0.089, u - 0.1575, M.rubber, 0, 0.12);
}
function bipod(b, f, u, M, sp = 0.02) { for (const s of [-1, 1]) { b.cyl(0.0048, 0.0048, f - 0.2, 0.2, u, M.steel, s * sp, 8); b.cyl(0.007, 0.007, f - 0.2, 0.03, u, M.rubber, s * sp, 8); } b.box(sp * 2 + 0.012, 0.014, 0.022, f, u, M.recv); }

// ───────────── 파츠 형태 ─────────────
function reddot(b, f, u0, M) { // 레드 도트: 낮은 받침에 테두리 달린 작은 창
  const cy = u0 + 0.025, hw = 0.0125, hh = 0.013;
  b.box(0.028, 0.009, 0.044, f, u0 + 0.0045, M.recv);
  b.xcyl(0.004, 0.034, f - 0.012, u0 + 0.005, M.steel);
  for (const s of [-1, 1]) b.box(0.003, hh * 2 + 0.005, 0.008, f + 0.014, cy, M.recv, s * (hw + 0.0015));
  b.box(hw * 2 + 0.006, 0.003, 0.008, f + 0.014, cy + hh + 0.0015, M.recv);
  b.box(0.02, 0.006, 0.02, f - 0.008, u0 + 0.012, M.steel);
  b.add(new THREE.PlaneGeometry(hw * 2, hh * 2).translate(0, cy, -(f + 0.014)), M.lens, null, true);
  b.add(new THREE.PlaneGeometry(0.0065, 0.0065).translate(0, cy, -(f + 0.0136)), M.rdot, null, true);
  return cy;
}
function scope3(b, f, u0, M) { // 3배율 조준경: 앞이 넓은 짧은 통. 안쪽 벽은 어두워서 들여다보면 깨끗한 원이 보임
  const cy = u0 + 0.031, f0 = f - 0.075, f1 = f + 0.075, r0 = 0.02, r1 = 0.03;
  b.box(0.022, 0.012, 0.09, f, u0 + 0.006, M.steel);
  for (const d of [-0.03, 0.03]) b.box(0.012, 0.014, 0.012, f + d, u0 + 0.012, M.recv);
  b.tube(r0, r1, f0, f1 - f0, cy, M.recv, 24); b.tube(r0 - 0.0012, r1 - 0.0012, f0, f1 - f0, cy, M.tubeIn, 24);
  b.ring(r1, 0.0028, f1, cy, M.steel); b.ring(r0, 0.003, f0, cy, M.rubber);
  b.vcyl(0.008, 0.012, f, cy + 0.03, M.steel); b.xcyl(0.008, 0.012, f, cy, M.steel, 0.03);
  b.add(new THREE.CircleGeometry(r1 - 0.002, 24).rotateY(Math.PI).translate(0, cy, -(f1 - 0.004)), M.glass, null, true);
  b.add(new THREE.CircleGeometry(r0 - 0.0015, 24).translate(0, cy, -(f0 + 0.01)), M.mask, null, true);
  b.add(new THREE.CircleGeometry(r0 - 0.002, 24).translate(0, cy, -(f0 + 0.006)), M.lens, null, true);
  b.add(new THREE.PlaneGeometry(0.03, 0.03).translate(0, cy, -(f0 + 0.0055)), M.xret, null, true);
  b.adsZ = -(0.09 - f0); // 눈을 접안렌즈 가까이
  return cy;
}
// 조준경 파츠 (holoL = 큰 테두리 조준기). 가운데 높이를 돌려줌
function optic0(b, kind, f, u0, M) { return kind === 'dot' ? reddot(b, f, u0, M) : kind === 'x3' ? scope3(b, f, u0, M) : holo(b, f, u0, M, kind === 'holoL' ? 1.25 : 1); }
function muzzleAtt0(b, kind, f, u, r, M) { // 총구 파츠. f = 총열 끝, 돌려주는 값 = 새 총구 끝
  if (kind === 'sup') return suppressor(b, f - 0.012, Math.max(0.1, r * 9.5), r * 1.4, u, M);
  if (kind === 'comp') { // 보정기: 위로 구멍이 난 각진 통
    const len = r * 3.6, w = r * 1.75, f0 = f + 0.004;
    b.cyl(r * 0.85, r * 0.85, f - 0.006, 0.01, u, M.steel);
    b.prof([[f0, u - w / 2], [f0, u + w / 2], [f0 + len, u + w / 2], [f0 + len, u - w / 2]], w, M.steel, 0.004, 0, { r: 0.003 });
    for (let i = 0; i < 3; i++) b.box(w * 0.6, 0.002, len * 0.16, f0 + len * (0.25 + i * 0.25), u + w / 2 + 0.0002, M.dark);
    for (const s of [-1, 1]) b.box(0.002, w * 0.45, len * 0.2, f0 + len * 0.75, u, M.dark, s * (w / 2 + 0.0002));
    b.disc(r * 0.55, f0 + len + 0.0005, u, M.dark);
    return f0 + len;
  }
  const len = r * 5, w = r * 2.6, h = r * 2, f0 = f + 0.006, hole = (a, c) => [[f0 + len * a, u - h * 0.3], [f0 + len * a, u + h * 0.3], [f0 + len * c, u + h * 0.3], [f0 + len * c, u - h * 0.3]]; // 제동기: 옆으로 크게 뚫린 두 칸
  b.cyl(r * 0.85, r * 0.85, f - 0.006, 0.012, u, M.steel);
  b.prof([[f0, u - h / 2], [f0, u + h / 2], [f0 + len, u + h / 2], [f0 + len, u - h / 2]], w, M.steel, 0.003, 0, { holes: [hole(0.14, 0.42), hole(0.56, 0.86)] });
  b.disc(r * 0.5, f0 + len + 0.0005, u, M.dark);
  return f0 + len;
}
function underGrip0(b, kind, f, u, M) { // 총열덮개 아래 손잡이. 왼손 자리를 돌려줌
  b.box(0.024, 0.008, 0.05, f, u - 0.004, M.recv);
  if (kind === 'vgrip') { b.prof([[f - 0.016, u - 0.008], [f + 0.016, u - 0.008], [f + 0.013, u - 0.085], [f - 0.013, u - 0.085]], 0.028, M.poly, 0.007, 0, { r: 0.006 }); for (let i = 0; i < 4; i++) b.box(0.0285, 0.003, 0.026, f, u - 0.028 - i * 0.013, M.dark); b.box(0.03, 0.006, 0.03, f, u - 0.086, M.rubber); return [0, u - 0.05, -f]; }
  b.prof([[f - 0.05, u - 0.008], [f + 0.05, u - 0.008], [f + 0.02, u - 0.04], [f - 0.035, u - 0.046]], 0.028, M.poly, 0.007, 0, { r: 0.006 }); for (let i = 0; i < 3; i++) b.box(0.0285, 0.003, 0.02, f - 0.02 + i * 0.016, u - 0.03, M.dark, 0, 0.35);
  return [0, u - 0.035, -(f - 0.005)];
}
function laserAtt0(b, f, u, x, M) { // 레이저: 작은 상자와 앞으로 뻗는 빛줄기
  b.box(0.014, 0.016, 0.046, f, u, M.recv, x); b.box(0.015, 0.004, 0.02, f - 0.006, u + 0.009, M.dark, x);
  b.cyl(0.0042, 0.0042, f + 0.023, 0.004, u, M.steel, x, 10); b.disc(0.0034, f + 0.0275, u, M.ldot, false, x);
  const L = 1.5; // 빛줄기: 십자로 겹친 얇은 판 두 장, 멀어질수록 흐려짐
  for (const rz of [0, Math.PI / 2]) b.add(new THREE.PlaneGeometry(0.0024, L).rotateX(-Math.PI / 2).rotateZ(rz).translate(x, u, -(f + 0.028 + L / 2)), M.beam, null, true);
}
function magAtt0(b, kind, f0, f1, u, w, M, sl = 0.008) { // 탄창 파츠: 밑으로 늘이거나(대용량) 당김 고리를 닮(빠른 탄창). 탄창과 함께 움직임
  b.part('mag');
  if (kind === 'ext') { const h = 0.05; b.prof([[f0, u + 0.004], [f1, u + 0.004], [f1 + sl, u - h], [f0 + sl, u - h]], w, M.mag, 0.003); b.box(w + 0.004, 0.007, f1 - f0 + 0.008, (f0 + f1) / 2 + sl, u - h - 0.002, M.rubber); b.box(w + 0.0015, 0.003, f1 - f0 + 0.002, (f0 + f1) / 2, u, M.steel); }
  else { b.box(w + 0.003, 0.014, f1 - f0 + 0.006, (f0 + f1) / 2, u + 0.014, M.accent); b.tor(0.011, 0.003, [(f0 + f1) / 2, u - 0.012, 0], M.accent, 0, Math.PI / 2); }
  b.part();
}
// 개머리판 파츠: 원래 개머리판 대신 들어감. 구역 r = {f 총몸 뒤, end 맨 뒤, top, bot, j0 아래쪽 이음, w 두께}, F = 몸통 재질
function stockPart0(b, kind, M, r, F) {
  const { f, end, top, bot, j0, w } = r, mid = (top + bot) / 2;
  if (kind === 'hstk') { // 안정: 가운데를 판 굵은 몸통, 높이 조절 뺨받침, 막대로 밀어내는 어깨받침
    const e = end + 0.03;
    b.prof([[f, top], [e, top], [e, bot], [e + 0.035, bot], [f - 0.06, j0 - 0.012], [f, j0]], w, F, 0.006, 0, { r: 0.006, holes: [[[f - 0.07, top - 0.024], [e + 0.028, top - 0.024], [e + 0.028, bot + 0.026], [f - 0.09, j0 - 0.004]]], hr: 0.005 });
    b.prof([[f - 0.07, top], [f - 0.078, top + 0.013], [e + 0.05, top + 0.013], [e + 0.042, top]], w * 0.8, M.poly, 0.004, 0, { r: 0.003 });
    for (const q of [f - 0.085, e + 0.072]) { b.xcyl(0.0045, w + 0.006, q, top - 0.011, M.steel); for (const sd of [-1, 1]) b.sdisc(0.0068, q, top - 0.011, sd * (w / 2 + 0.0032), M.bolt); }
    for (const u of [top - 0.02, bot + 0.022]) b.cyl(0.0042, 0.0042, end + 0.008, 0.03, u, M.bolt, 0, 10);
    b.xcyl(0.009, w * 0.5, e + 0.012, mid, M.steel, 0, 14);
    buttPad(b, end + 0.012, mid, top - bot - 0.006, M, w * 0.96);
    return;
  }
  // 경량: 쇠막대 두 줄과 얇은 어깨받침뿐인 뼈대
  b.box(w * 0.86, top - j0 + 0.004, 0.022, f - 0.009, (top + j0) / 2, M.recv);
  b.cyl(0.0068, 0.0068, end + 0.01, f - end - 0.02, top - 0.011, M.steel, 0, 12);
  b.rod([f - 0.016, j0 + 0.006, 0], [end + 0.016, bot + 0.014, 0], 0.0055, 0.0055, M.steel, 10);
  b.prof([[end + 0.016, top], [end + 0.016, bot], [end + 0.002, bot + 0.006], [end, mid], [end + 0.002, top - 0.006]], w * 0.8, M.rubber, 0.004);
  b.cyl(0.0095, 0.0095, f - 0.05, 0.02, top - 0.011, M.accent, 0, 12);
  b.box(w * 0.5, 0.004, 0.03, (f + end) / 2, top - 0.003, M.poly);
}
// ───────────── 파츠 스킨 (스킨 업그레이드): Lv.3 부터 단 파츠에도 스킨 색의 빛 고리·빛줄·장갑판이 붙고, Lv.5 는 도는 고리와 보석까지 ─────────────
let PS = null; // 지금 만드는 총의 파츠 스킨 단계 { lv: 1 파츠 스킨 | 2 파츠 각성 } (makeGun 이 정함)
function optic(b, kind, f, u0, M) {
  const cy = optic0(b, kind, f, u0, M); if (!PS) return cy;
  const G = gmat(M), P = pmat(M), B = bmat(M);
  if (kind === 'x3') { for (const d of [-0.072, 0, 0.072]) b.tor(d > 0 ? 0.034 : d < 0 ? 0.024 : 0.03, 0.0032, [f + d, cy, 0], G, 0, 0, 6.2832, 24); both((s) => { b.box(0.0024, 0.006, 0.11, f, cy, G, s * 0.028); b.box(0.005, 0.016, 0.06, f, u0 + 0.012, P, s * 0.015); }); b.prof([[f - 0.05, cy + 0.024], [f + 0.03, cy + 0.03], [f + 0.05, cy + 0.042], [f - 0.03, cy + 0.036]], 0.004, P, 0.001); b.box(0.0045, 0.002, 0.07, f, cy + 0.033, G); }
  else { const hw = kind === 'dot' ? 0.0125 : kind === 'holoL' ? 0.024 : 0.019; both((s) => { b.box(0.0022, 0.003, 0.04, f + 0.004, u0 + 0.008, G, s * (hw + 0.004)); b.prof([[f - 0.02, u0 + 0.002], [f + 0.02, u0 + 0.002], [f + 0.012, cy + 0.006], [f - 0.006, cy - 0.004]], 0.0022, P, 0.0005, s * (hw + 0.005)); b.ball(0.0018, [f + 0.012, u0 + 0.012, s * (hw + 0.006)], B, [1, 1, 0.6], 6); }); b.tor(hw + 0.006, 0.0016, [f + 0.02, cy, 0], G, 0, 0, 6.2832, 24); }
  if (PS.lv > 1) spinAt(b, f, cy, 1.4, () => { b.tor(0.038, 0.0014, [f, cy, 0], G, 0.35, 0, 6.2832, 32); for (let i = 0; i < 3; i++) { const a = i * 2.094; b.gem(0.0034, [f, cy + Math.cos(a) * 0.038 * 0.94, Math.sin(a) * 0.038], B); } });
  return cy;
}
function muzzleAtt(b, kind, f, u, r, M) {
  const tip = muzzleAtt0(b, kind, f, u, r, M); if (!PS) return tip;
  const G = gmat(M), B = bmat(M), L = tip - f, rr = kind === 'sup' ? r * 1.4 : r * 1.3;
  for (const t of [0.22, 0.5, 0.78]) b.tor(rr * 1.14, rr * 0.16, [f + L * t, u, 0], G, 0, 0, 6.2832, 20);
  b.tor(rr * 1.16, rr * 0.09, [f + L * 0.04, u, 0], B, 0, 0, 6.2832, 20); b.tor(rr * 1.1, rr * 0.08, [tip - L * 0.04, u, 0], B, 0, 0, 6.2832, 20);
  b.radial(6, () => new THREE.ConeGeometry(rr * 0.24, rr * 2.2, 4).rotateX(-Math.PI / 2 + 0.25).translate(0, rr * 1.35, -rr * 0.6), f + L * 0.36, u, B, 0.52);
  if (PS.lv > 1) spinAt(b, f + L * 0.42, u, 2.6, () => { b.tor(rr * 1.9, rr * 0.07, [f + L * 0.42, u, 0], G, 0, 0, 6.2832, 24); for (let i = 0; i < 3; i++) { const a = i * 2.094; b.gem(rr * 0.22, [f + L * 0.42, u + Math.cos(a) * rr * 1.9, Math.sin(a) * rr * 1.9], B); } });
  return tip;
}
function underGrip(b, kind, f, u, M) {
  const fore = underGrip0(b, kind, f, u, M); if (!PS) return fore;
  const G = gmat(M), B = bmat(M), P = pmat(M);
  if (kind === 'vgrip') { b.box(0.03, 0.06, 0.003, f + 0.0155, u - 0.046, G); both((s) => { for (let i = 0; i < 3; i++) b.ball(0.0018, [f - 0.006, u - 0.025 - i * 0.02, s * 0.0148], B, [1, 1, 0.6], 6); }); b.cyl(0.017, 0.017, f - 0.017, 0.034, u - 0.09, P, 0, 14); b.tor(0.017, 0.002, [f, u - 0.09, 0], G, 0, 0, 6.2832, 18); if (PS.lv > 1) b.ball(0.006, [f, u - 0.097, 0], G, [1, 1, 1], 10); }
  else { b.box(0.0302, 0.003, 0.07, f - 0.008, u - 0.024, G, 0, 0.35); both((s) => b.ball(0.0018, [f - 0.03, u - 0.03, s * 0.0148], B, [1, 1, 0.6], 6)); if (PS.lv > 1) b.ball(0.005, [f + 0.04, u - 0.012, 0], G, [1, 1, 1], 10); }
  return fore;
}
function laserAtt(b, f, u, x, M) {
  laserAtt0(b, f, u, x, M); if (!PS) return;
  const G = gmat(M), P = pmat(M), B = bmat(M);
  b.box(0.016, 0.004, 0.05, f, u + 0.01, P, x); b.tor(0.0065, 0.0014, [f + 0.024, u, x], G, 0, 0, 6.2832, 16); b.box(0.0162, 0.0016, 0.03, f - 0.004, u - 0.0085, G, x);
  if (PS.lv > 1) b.gem(0.004, [f - 0.016, u + 0.014, x], B);
}
function magAtt(b, kind, f0, f1, u, w, M, sl = 0.008) {
  magAtt0(b, kind, f0, f1, u, w, M, sl); if (!PS) return;
  const G = gmat(M), P = pmat(M), B = bmat(M), uu = kind === 'ext' ? u - 0.03 : u + 0.004;
  b.part('mag'); b.box(w + 0.0045, 0.004, f1 - f0 + 0.004, (f0 + f1) / 2 + (kind === 'ext' ? sl * 0.6 : 0), uu, G); both((s) => b.box(0.0015, 0.012, (f1 - f0) * 0.6, (f0 + f1) / 2, uu + 0.01, P, s * (w / 2 + 0.002))); if (PS.lv > 1) both((s) => b.gem(0.0035, [(f0 + f1) / 2, uu + 0.016, s * (w / 2 + 0.003)], B, [1, 1, 0.6])); b.part();
}
function stockPart(b, kind, M, r, F) {
  stockPart0(b, kind, M, r, F); if (!PS) return;
  const { f, end, top, bot, w } = r, G = gmat(M), P = pmat(M), B = bmat(M);
  both((s) => { b.box(0.002, 0.003, (f - end) * 0.7, (f + end) / 2, top - 0.006, G, s * (w / 2 + 0.0025)); for (let i = 0; i < 4; i++) b.ball(0.0018, [end + 0.03 + i * 0.024, (top + bot) / 2, s * (w / 2 + 0.0015)], B, [1, 1, 0.6], 6); });
  for (let i = 0; i < 3; i++) b.prof([[end + 0.016 + i * 0.012, bot + 0.004], [end + 0.004 + i * 0.012, bot - 0.016 - i * 0.003], [end + 0.012 + i * 0.012, bot + 0.004]], 0.0034, i % 2 ? G : P, 0.0006);
  if (PS.lv > 1) spinAt(b, end + 0.05, (top + bot) / 2, 2, () => { b.tor(0.02, 0.0016, [end + 0.05, (top + bot) / 2, w / 2 + 0.006], G, 0, Math.PI / 2, 6.2832, 24); b.tor(0.02, 0.0016, [end + 0.05, (top + bot) / 2, -(w / 2 + 0.006)], G, 0, Math.PI / 2, 6.2832, 24); }, 'x');
}
const barDl = (A) => (A.bar === 'long' ? 0.07 : A.bar === 'light' ? -0.035 : 0);

// ───────────── 스킨별 형태 키트 ─────────────
// 유료 스킨은 무늬만이 아니라 형태가 바뀐다: hg 총열덮개 · stock 개머리판 · muzzle 총구 · orn 몸통 장식 · blade 칼날.
// 구역 값: hg {f0,f1,u0,u1,w,uc} · stock {f,end,top,bot,j0,w} · muzzle (f,u,r,len) → 총구 끝 · orn {f0,f1,top,u,hw,small}
const kr = (i) => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
let spinN = 0;
function flower(b, M, f, u, x, r) { // 옆면에 붙는 다섯 잎 꽃
  const s = Math.sign(x) || 1;
  for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.2832 + 0.3; b.ball(r * 0.5, [f + Math.cos(a) * r * 0.55, u + Math.sin(a) * r * 0.55, x + s * r * 0.06], M.petal, [1, 1, 0.3], 7); }
  b.ball(r * 0.24, [f, u, x + s * r * 0.18], M.brass, [1, 1, 0.7], 8);
}
const KITS = {
  // 탄소 섬유 — 경주차: 삼각 뼈대, 날개, 빨간 속통
  carbon: {
    fx: { tracer: 0xff5a4a, flash: 0xff9a80, sfx: 'race', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, n = Math.max(2, Math.round(L / 0.055)), st = (L - 0.024) / n, m = 0.011, holes = [], uc = R.uc ?? (u0 + u1) / 2;
      for (let i = 0; i < n; i++) { const a = f0 + 0.012 + i * st, c = a + st - 0.008; holes.push([[a, u0 + m], [c, u0 + m], [(a + c) / 2, u1 - m]]); if (i < n - 1) holes.push([[a + st / 2, u1 - m], [c + st / 2, u1 - m], [(a + c + st) / 2, u0 + m]]); }
      for (const s of [-1, 1]) b.prof([[f0, u0], [f0, u1], [f1 + 0.03, u1], [f1 + 0.008, (u0 + u1) / 2], [f1 - 0.012, u0]], 0.0045, M.recv, 0.0012, s * (hw - 0.00225), { holes });
      b.box(w, 0.007, L, (f0 + f1) / 2, u1 - 0.0035, M.recv); b.box(w * 0.7, 0.006, L - 0.02, (f0 + f1) / 2 - 0.01, u0 + 0.003, M.recv);
      const rr = Math.max(0.006, Math.min(0.017, Math.min(u1 - uc, uc - u0) - 0.012));
      b.cyl(rr, rr, f0, L, uc, M.steel, 0, 10);
      for (let i = 0; i < n; i++) b.cyl(rr + 0.002, rr + 0.002, f0 + 0.03 + i * st, 0.006, uc, M.dark, 0, 10);
      for (const s of [-1, 1]) { b.box(0.022, 0.0025, L * 0.42, f1 - L * 0.25, u0 + 0.014, M.bolt, s * (hw + 0.008), 0, s * -0.35); b.box(0.0016, 0.005, L * 0.8, (f0 + f1) / 2, u1 - 0.004, M.accent, s * (hw + 0.0006)); }
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, k = f - L * 0.35;
      b.prof([[f, top], [end + 0.02, top], [end, top - 0.02], [end, bot], [end + 0.028, bot], [k, j0], [f, j0]], w * 0.8, M.recv, 0.004, 0,
        { holes: [[[f - 0.035, top - 0.013], [end + 0.035, top - 0.013], [end + 0.016, top - 0.03], [end + 0.016, bot + 0.016], [end + 0.034, bot + 0.014], [k - 0.006, j0 + 0.013], [f - 0.035, j0 + 0.013]]] });
      b.rod([f - 0.035, j0 + 0.013, 0], [end + 0.016, top - 0.03, 0], 0.005, 0.005, M.steel, 6);
      b.box(w + 0.03, 0.003, 0.05, end + 0.05, top + 0.012, M.recv); for (const s of [-1, 1]) b.box(0.003, 0.014, 0.03, end + 0.05, top + 0.005, M.bolt, s * (w / 2 - 0.006));
      buttPad(b, end, (top + bot) / 2, top - bot, M, w);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 0.8, r * 1.15, f, len * 0.2, u, M.steel, 0, 8);
      b.prof([[f + len * 0.2, u - r * 1.15], [f + len * 0.2, u + r * 1.15], [f + len * 0.78, u + r * 1.15], [f + len, u - r * 0.1], [f + len * 0.9, u - r * 1.15]], r * 2.3, M.recv, 0.003, 0,
        { holes: [[[f + len * 0.3, u - r * 0.5], [f + len * 0.3, u + r * 0.5], [f + len * 0.45, u + r * 0.5], [f + len * 0.45, u - r * 0.5]], [[f + len * 0.55, u - r * 0.5], [f + len * 0.55, u + r * 0.5], [f + len * 0.7, u + r * 0.5], [f + len * 0.76, u - r * 0.5]]] });
      b.cyl(r * 0.5, r * 0.5, f + len * 0.2, len * 0.6, u, M.steel, 0, 8);
      for (const s of [-1, 1]) b.box(r * 1.3, 0.002, len * 0.5, f + len * 0.5, u, M.bolt, s * r * 1.7);
      return f + len;
    },
    orn(b, M, R) {
      const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.6 : 1;
      for (const s of [-1, 1]) { b.box(0.0014, 0.005 * k, L * 0.8, (f0 + f1) / 2, u + 0.016 * k, M.accent, s * (hw + 0.0006)); for (let i = 0; i < 3; i++) b.box(0.003, 0.016 * k, 0.004, f0 + L * 0.12 + i * 0.012, u, M.bolt, s * (hw + 0.001), 0.5); }
    },
    blade(b, M) {
      b.prof([[0.03, -0.016], [0.2, -0.016], [0.25, 0.008], [0.238, 0.022], [0.03, 0.022]], 0.005, M.recv, 0.0015, 0, { holes: [0.075, 0.115, 0.155].map((f) => [[f - 0.012, -0.002], [f + 0.012, -0.002], [f + 0.018, 0.012], [f - 0.006, 0.012]]) });
      b.prof([[0.035, -0.0165], [0.2, -0.0165], [0.249, 0.007], [0.2, -0.008], [0.035, -0.008]], 0.0056, M.bolt, 0.0005);
    },
  },
  // 호랑이 — 맹수: 갈기, 발톱, 송곳니 총구, 빛나는 눈
  tiger: {
    fx: { tracer: 0xffa02a, flash: 0xffb040, sfx: 'beast', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2;
      b.prof([[f0, u0], [f0, u1], [f1 - 0.03, u1], [f1 + 0.014, um + 0.012], [f1 + 0.014, um - 0.01], [f1 - 0.02, u0]], w, M.recv, 0.009, 0, { r: 0.008 });
      const n = Math.max(3, Math.round(L / 0.036));
      for (let i = 0; i < n; i++) for (const s of [-1, 1]) { const f = f0 + 0.03 + (i * (L - 0.05)) / (n - 1), k = 1 - i * 0.05; b.spike([f, u1 - 0.008, s * (hw - 0.004)], [f - 0.04 * k, u1 + 0.016 * k, s * (hw + 0.013 * k)], 0.0075, i % 2 ? M.fang : M.poly, 5); }
      for (const x of [-0.015, 0, 0.015]) { b.rod([f1 - 0.06, u0 + 0.004, x], [f1 - 0.032, u0 - 0.02, x], 0.007, 0.0052, M.fang, 6); b.spike([f1 - 0.033, u0 - 0.019, x], [f1 - 0.002, u0 - 0.03, x], 0.0054, M.fang, 6); }
      for (const s of [-1, 1]) { b.ball(0.0075, [f1 - 0.035, um + 0.012, s * (hw - 0.002)], M.eye, [1.5, 0.75, 0.5], 10); b.box(0.002, 0.008, 0.0026, f1 - 0.035, um + 0.012, M.dark, s * (hw + 0.0016)); b.box(0.003, 0.004, 0.028, f1 - 0.036, um + 0.021, M.poly, s * (hw + 0.0005), 0.25); }
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end;
      b.prof([[f, top], [end + 0.045, top], [end, top - 0.03], [end, bot + 0.02], [end + 0.022, bot], [end + 0.075, bot + 0.022], [f - L * 0.4, j0 - 0.004], [f, j0]], w, M.recv, 0.008, 0, { r: 0.008 });
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) b.box(0.002, 0.05, 0.007, end + 0.06 + i * 0.022, (top + bot) / 2 + 0.012, M.dark, s * (w / 2), 0.5);
      for (let i = 0; i < 3; i++) b.spike([end + 0.05 + i * 0.04, top - 0.006, 0], [end + 0.02 + i * 0.04, top + 0.016, 0], 0.008, i % 2 ? M.poly : M.fang, 5);
      buttPad(b, end, (top + bot) / 2 - 0.005, top - bot - 0.045, M, w);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 1.25, r * 1.25, f, len * 0.3, u, M.recv, 0, 10);
      b.cyl(r * 0.55, r * 0.55, f, len * 0.86, u, M.steel, 0, 10); b.disc(r * 0.36, f + len * 0.862, u, M.dark);
      b.prof([[f + len * 0.1, u + r * 0.62], [f + len * 0.1, u + r * 1.5], [f + len * 0.75, u + r * 1.5], [f + len * 1.1, u + r * 1.0], [f + len * 1.1, u + r * 0.62]], r * 2.5, M.recv, 0.003, 0, { r: 0.003 });
      b.prof([[f + len * 0.1, u - r * 0.62], [f + len * 0.1, u - r * 1.4], [f + len * 0.6, u - r * 1.4], [f + len * 0.95, u - r * 1.0], [f + len * 0.95, u - r * 0.62]], r * 2.3, M.recv, 0.003, 0, { r: 0.003 });
      for (const s of [-1, 1]) {
        b.spike([f + len * 1.02, u + r * 0.66, s * r * 0.85], [f + len * 1.04, u - r * 0.5, s * r * 0.85], r * 0.26, M.fang, 5); b.spike([f + len * 0.84, u - r * 0.66, s * r * 0.75], [f + len * 0.86, u + r * 0.3, s * r * 0.75], r * 0.22, M.fang, 5);
        for (let i = 0; i < 3; i++) b.spike([f + len * (0.45 + i * 0.16), u + r * 0.66, s * r * 1.05], [f + len * (0.45 + i * 0.16), u + r * 0.1, s * r * 1.05], r * 0.14, M.fang, 4);
      }
      return f + len * 0.9;
    },
    orn(b, M, R) {
      const { f0, top, hw } = R, k = R.small ? 0.6 : 1;
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) b.spike([f0 + (0.035 + i * 0.03) * k, top - 0.008 * k, s * (hw - 0.002)], [f0 + (0.008 + i * 0.03) * k, top + 0.012 * k, s * (hw + 0.008 * k)], 0.006 * k, i % 2 ? M.fang : M.poly, 5);
    },
    blade(b, M) {
      b.prof([[0.03, -0.012], [0.1, -0.02], [0.17, -0.014], [0.222, 0.016], [0.24, 0.062], [0.2, 0.032], [0.15, 0.016], [0.09, 0.014], [0.03, 0.02]], 0.0055, M.fang, 0.002, 0, { r: 0.006 });
      b.prof([[0.04, -0.013], [0.1, -0.0205], [0.17, -0.0145], [0.222, 0.016], [0.239, 0.06], [0.214, 0.022], [0.165, -0.004], [0.1, -0.011], [0.04, -0.005]], 0.006, M.recv, 0.0005);
      for (let i = 0; i < 3; i++) b.box(0.0062, 0.003, 0.02, 0.07 + i * 0.03, 0.006, M.dark, 0, 0.5);
    },
  },
  // 벚꽃 — 둥근 몸, 꽃 장식, 꽃잎 총구, 술
  sakura: {
    fx: { tracer: 0xff8fc0, flash: 0xffa6cf, sfx: 'petal', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2;
      const kf = (f) => 1 - 0.2 * ((f - f0) / L), sx = (f, du) => hw * kf(f) * Math.sqrt(Math.max(0.05, 1 - (du / (hh * kf(f))) ** 2));
      b.ecyl(hw, hh, f0, L, um, M.recv, 0.8, 20); b.ball(1, [f1, um, 0], M.recv, [0.022, hh * 0.8, hw * 0.8], 14);
      for (const f of [f0 + 0.004, f1 - 0.032]) b.ecyl(hw * kf(f) + 0.0022, hh * kf(f) + 0.0022, f, 0.012, um, M.petal, 0.99, 20);
      for (const s of [-1, 1]) {
        const p = (t, v) => [f0 + L * t, um + hh * v, s * (sx(f0 + L * t, hh * v) + 0.001)];
        b.rod(p(0.1, -0.5), p(0.55, 0.1), 0.003, 0.0022, M.twig, 6); b.rod(p(0.55, 0.1), p(0.85, 0.35), 0.0022, 0.0015, M.twig, 6);
        for (const [t, v, r] of [[0.3, -0.1, 0.02], [0.62, 0.25, 0.014], [0.84, -0.15, 0.011]]) { const q = p(t, v); flower(b, M, q[0], q[1], q[2], r); }
      }
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      b.prof([[f, top], [f - L * 0.5, top + 0.004], [end + 0.012, top - 0.01], [end, top - 0.04], [end, bot + 0.012], [end + 0.03, bot], [f - L * 0.5, j0 - 0.016], [f, j0]], w, M.recv, 0.01, 0,
        { r: 0.016, holes: [[[f - L * 0.28, top - 0.016], [f - L * 0.7, top - 0.02], [f - L * 0.76, bot + 0.05], [f - L * 0.45, j0 + 0.004]]], hr: 0.012 });
      for (const s of [-1, 1]) { flower(b, M, end + 0.04, um + 0.004, s * (w / 2 + 0.001), 0.02); flower(b, M, f - L * 0.14, (top + j0) / 2, s * (w / 2 + 0.001), 0.012); }
      b.rod([end + 0.085, bot + 0.036, 0], [end + 0.09, bot - 0.02, 0], 0.0016, 0.0016, M.accent, 5); b.ball(0.007, [end + 0.09, bot - 0.024, 0], M.brass); b.spike([end + 0.09, bot - 0.064, 0], [end + 0.09, bot - 0.026, 0], 0.008, M.accent, 8);
      buttPad(b, end, um - 0.012, top - bot - 0.05, M, w);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 1.1, r * 1.1, f, len * 0.35, u, M.steel, 0, 12); b.cyl(r * 1.25, r * 1.25, f + len * 0.1, len * 0.1, u, M.petal, 0, 12);
      b.cyl(r * 0.6, r * 0.6, f, len * 0.8, u, M.steel, 0, 10); b.disc(r * 0.4, f + len * 0.802, u, M.dark);
      b.radial(5, () => new THREE.SphereGeometry(1, 10, 7).scale(r * 0.8, r * 0.2, len * 0.42).rotateX(0.42).translate(0, r * 1.2, -len * 0.38), f + len * 0.3, u, M.petal, 0.63);
      b.radial(5, () => new THREE.SphereGeometry(1, 8, 6).scale(r * 0.5, r * 0.16, len * 0.3).rotateX(0.75).translate(0, r * 1.1, -len * 0.22), f + len * 0.28, u, M.accent, 0);
      return f + len * 0.85;
    },
    orn(b, M, R) { const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1; for (const s of [-1, 1]) { flower(b, M, f0 + L * 0.22, u + 0.004 * k, s * (hw + 0.001), 0.016 * k); flower(b, M, f0 + L * 0.42, u - 0.008 * k, s * (hw + 0.001), 0.01 * k); } },
    blade(b, M) {
      b.prof([[0.03, -0.01], [0.12, -0.015], [0.2, -0.008], [0.255, 0.02], [0.2, 0.013], [0.12, 0.008], [0.03, 0.014]], 0.0046, M.bolt, 0.0018, 0, { r: 0.004 });
      b.prof([[0.04, -0.0105], [0.12, -0.0155], [0.2, -0.0085], [0.254, 0.0195], [0.2, 0.002], [0.12, -0.006], [0.04, -0.003]], 0.0052, M.recv, 0.0005);
      for (const s of [-1, 1]) flower(b, M, 0.026, 0.002, s * 0.0075, 0.016);
    },
  },
  // 빙결 — 반투명 얼음 결정이 돋아남
  ice: {
    fx: { tracer: 0x9fe6ff, flash: 0xbfeeff, sfx: 'frost', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2;
      b.prof([[f0, u0 + 0.008], [f0, u1], [f1, u1], [f1 + 0.022, um + 0.008], [f1, u0 + 0.014], [f0 + L * 0.5, u0]], w * 0.84, M.recv, 0.008);
      const n = Math.max(3, Math.round(L / 0.04));
      for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
        const q = i * 2 + (s > 0 ? 1 : 0), f = f0 + 0.01 + (i * (L - 0.06)) / (n - 1), du = (kr(q) - 0.5) * hh * 1.1;
        b.crys([f, um + du, s * hw * 0.5], [f + 0.05 + kr(q + 9) * 0.035, um + du * 1.5 + (kr(q + 5) - 0.5) * 0.02, s * (hw + 0.012 + kr(q + 3) * 0.014)], 0.008 + kr(q + 7) * 0.005, M.crystal);
      }
      for (let i = 0; i < 3; i++) b.crys([f0 + L * (0.3 + i * 0.22), u0 + 0.008, (i - 1) * 0.008], [f0 + L * (0.3 + i * 0.22) + 0.06, u0 - 0.022 - i * 0.004, (i - 1) * 0.014], 0.011, M.crystal);
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      b.prof([[f, top], [end + 0.06, top + 0.004], [end, top - 0.03], [end, bot + 0.03], [end + 0.045, bot], [f - L * 0.5, j0 - 0.03], [f - L * 0.22, j0 - 0.002], [f, j0]], w, M.recv, 0.012, 0, { holes: [[[f - L * 0.3, top - 0.018], [end + 0.05, top - 0.022], [end + 0.03, um - 0.012], [f - L * 0.42, j0 + 0.008]]] });
      b.crys([end + 0.07, um, 0], [end + 0.012, bot - 0.02, 0], 0.014, M.crystal); b.crys([end + 0.1, um - 0.01, 0.006], [end + 0.07, bot - 0.012, 0.012], 0.01, M.crystal); b.crys([f - L * 0.36, (top + j0) / 2, 0], [end + 0.06, um + 0.004, 0], 0.012, M.crystal, 6);
      for (const s of [-1, 1]) b.crys([end + 0.05, top - 0.02, s * w * 0.3], [end + 0.015, top + 0.012, s * (w / 2 + 0.01)], 0.008, M.crystal);
      buttPad(b, end, um, top - bot - 0.07, M, w);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 1.15, r * 1.15, f, len * 0.3, u, M.steel, 0, 6); b.cyl(r * 0.6, r * 0.6, f, len * 0.8, u, M.steel, 0, 8); b.disc(r * 0.4, f + len * 0.802, u, M.dark);
      b.radial(6, (k) => { const l = len * (k % 2 ? 0.75 : 1.05); return new THREE.ConeGeometry(r * 0.48, l, 5).rotateX(-Math.PI / 2 + 0.2).translate(0, r * 1.05 + l * 0.1, -l * 0.5); }, f + len * 0.12, u, M.crystal, 0.52);
      return f + len * 0.85;
    },
    orn(b, M, R) { const { f0, top, u, hw } = R, k = R.small ? 0.55 : 1; for (let i = 0; i < 3; i++) for (const s of [-1, 1]) b.crys([f0 + (0.05 + i * 0.022) * k, u + (0.01 - i * 0.008) * k, s * hw * 0.6], [f0 + (0.012 + i * 0.03) * k, Math.min(top + 0.012 * k, u + (0.04 - i * 0.02) * k), s * (hw + (0.016 - i * 0.003) * k)], 0.0075 * k, M.crystal); },
    blade(b, M) {
      b.prof([[0.03, -0.016], [0.1, -0.024], [0.13, -0.014], [0.2, -0.02], [0.262, 0.004], [0.21, 0.014], [0.17, 0.028], [0.12, 0.018], [0.07, 0.028], [0.03, 0.02]], 0.011, M.crystal, 0.0045);
      b.prof([[0.03, -0.004], [0.2, -0.004], [0.245, 0.003], [0.2, 0.009], [0.03, 0.009]], 0.004, M.bolt, 0.001);
    },
  },
  // 네온 — 뼈대만 남긴 틀 속에 빛나는 에너지 관
  neon: {
    fx: { tracer: 0x19e3ff, flash: 0x7af4ff, sfx: 'cyber', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, uc = R.uc ?? (u0 + u1) / 2, rr = Math.max(0.006, Math.min(0.0125, Math.min(u1 - uc, uc - u0) - 0.012));
      for (const s of [-1, 1]) for (const u of [u0 + 0.004, u1 - 0.004]) b.box(0.007, 0.008, L, (f0 + f1) / 2, u, M.recv, s * (hw - 0.0035));
      const nf = Math.max(2, Math.round(L / 0.09));
      for (let i = 0; i <= nf; i++) { const f = f0 + 0.006 + (i * (L - 0.012)) / nf; b.box(w, 0.008, 0.012, f, u1 - 0.004, M.recv); b.box(w, 0.008, 0.012, f, u0 + 0.004, M.recv); for (const s of [-1, 1]) b.box(0.007, u1 - u0, 0.012, f, (u0 + u1) / 2, M.recv, s * (hw - 0.0035)); }
      b.cyl(rr, rr, f0, L, uc, M.glow, 0, 12);
      const nr = Math.round(L / 0.03); for (let i = 1; i < nr; i++) b.tor(rr + 0.006, 0.0022, [f0 + (i * L) / nr, uc, 0], M.glow2, 0, 0, 6.2832, 16);
      b.box(w * 0.5, 0.004, L, (f0 + f1) / 2, u1 - 0.002, M.recv);
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2, k = f - L * 0.4, uj = (top + j0) / 2;
      b.prof([[f, top], [end + 0.015, top], [end, top - 0.015], [end, bot + 0.01], [end + 0.03, bot], [k, j0], [f, j0]], w * 0.7, M.recv, 0.0025, 0,
        { holes: [[[f - 0.012, top - 0.01], [end + 0.022, top - 0.01], [end + 0.012, top - 0.022], [end + 0.012, bot + 0.022], [end + 0.034, bot + 0.016], [k - 0.006, j0 + 0.012], [f - 0.012, j0 + 0.012]]] });
      b.rod([f - 0.012, uj, 0], [end + 0.011, uj - 0.004, 0], 0.006, 0.006, M.glow, 10);
      for (let i = 1; i < 6; i++) b.tor(0.0105, 0.002, [f - 0.012 - (i * (L - 0.03)) / 6, uj - 0.0007 * i, 0], M.glow2, 0, 0, 6.2832, 14);
      b.rod([end + 0.02, bot + 0.014, 0], [k - 0.02, j0 + 0.012, 0], 0.003, 0.003, M.glow2, 6);
      buttPad(b, end, um, top - bot, M, w * 0.8);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 1.2, r * 1.2, f, len * 0.3, u, M.recv, 0, 8); b.tor(r * 1.3, r * 0.14, [f + len * 0.12, u, 0], M.glow2, 0, 0, 6.2832, 16); b.tor(r * 1.3, r * 0.14, [f + len * 0.24, u, 0], M.glow, 0, 0, 6.2832, 16);
      for (const s of [-1, 1]) { b.box(r * 0.5, r * 1.2, len * 0.9, f + len * 0.65, u, M.steel, s * r * 1.25); b.box(r * 0.2, r * 0.3, len * 0.7, f + len * 0.7, u, M.glow, s * r * 0.98); }
      b.ball(r * 0.55, [f + len * 0.62, u, 0], M.glow, [1.3, 1, 1], 10);
      return f + len * 0.7;
    },
    orn(b, M, R) { const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.6 : 1; for (const s of [-1, 1]) { b.box(0.0016, 0.004 * k, L * 0.5, f0 + L * 0.33, u + 0.016 * k, M.glow, s * (hw + 0.0008)); b.box(0.0016, 0.003 * k, L * 0.3, f0 + L * 0.2, u + 0.006 * k, M.glow2, s * (hw + 0.0008)); for (let i = 0; i < 3; i++) b.box(0.0016, 0.006 * k, 0.006 * k, f0 + L * 0.42 + i * 0.012 * k, u + 0.006 * k, M.glow, s * (hw + 0.0008)); } },
    blade(b, M) {
      const inner = [[0.045, -0.008], [0.195, -0.008], [0.228, 0.004], [0.205, 0.014], [0.045, 0.014]];
      b.prof([[0.03, -0.016], [0.2, -0.016], [0.25, 0.004], [0.215, 0.022], [0.03, 0.022]], 0.006, M.recv, 0.0015, 0, { holes: [inner] });
      b.prof(inner, 0.0028, M.glow, 0.0005);
      b.prof([[0.2, -0.0165], [0.251, 0.004], [0.24, 0.006], [0.2, -0.011]], 0.0064, M.glow2, 0.0005);
    },
  },
  // 용암 — 갈라진 바위 덩어리와 빛나는 속, 뿔
  lava: {
    fx: { tracer: 0xff7a1a, flash: 0xff6a20, sfx: 'magma', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2;
      b.ecyl(hw * 0.62, hh * 0.72, f0, L, um, M.core, 1, 10);
      const n = Math.max(3, Math.round(L / 0.038));
      for (let i = 0; i < n; i++) { const f = f0 + 0.016 + (i * (L - 0.03)) / (n - 1);
        [[1, 0.52], [-1, 0.52], [1, -0.5], [-1, -0.5]].forEach(([s, v], j) => { const q = i * 4 + j, rr = Math.min(0.019 + kr(q) * 0.007, hh * 0.75 + 0.004); b.lump(rr, [f + (kr(q + 2) - 0.5) * 0.014 + (j > 1 ? 0.018 : 0), Math.min(um + v * hh, u1 - rr * 0.78), s * hw * 0.56], M.recv, [1.25, 1, 0.95], q); }); }
      const hk = Math.min(1, L / 0.2);
      for (const s of [-1, 1]) { b.rod([f1 - 0.075 * hk, u1 - 0.012 * hk, s * hw * 0.9], [f1 - 0.03 * hk, u1 + 0.014 * hk, s * (hw + 0.018 * hk)], 0.01 * hk, 0.007 * hk, M.horn, 6); b.spike([f1 - 0.032 * hk, u1 + 0.013 * hk, s * (hw + 0.0175 * hk)], [f1 + 0.03 * hk, u1 + 0.026 * hk, s * (hw + 0.008 * hk)], 0.0072 * hk, M.horn, 6); }
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      const out = [[f, top], [f - L * 0.3, top + 0.006], [f - L * 0.5, top - 0.004], [end + 0.03, top + 0.003], [end, top - 0.03], [end, bot + 0.02], [end + 0.04, bot], [f - L * 0.55, j0 - 0.034], [f - L * 0.4, j0 - 0.01], [f - L * 0.15, j0 - 0.014], [f, j0]];
      const holes = [[[f - L * 0.2, top - 0.016], [f - L * 0.45, top - 0.022], [f - L * 0.62, um + 0.01], [f - L * 0.5, um + 0.004], [f - L * 0.4, top - 0.036], [f - L * 0.22, top - 0.026]], [[f - L * 0.66, um - 0.004], [f - L * 0.85, um + 0.012], [f - L * 0.88, um - 0.02], [f - L * 0.72, um - 0.018]]];
      b.prof(out, w, M.recv, 0.011, 0, { holes }); b.prof(out, w * 0.3, M.core, 0);
      b.lump(0.02, [end + 0.05, top - 0.012, 0], M.recv, [1.3, 0.8, 1.1], 3); b.lump(0.017, [f - L * 0.3, j0 - 0.012, 0], M.recv, [1.2, 0.9, 1.2], 5);
      b.spike([end + 0.05, top - 0.004, 0], [end + 0.005, top + 0.02, 0], 0.009, M.horn, 6);
      buttPad(b, end, um, top - bot - 0.06, M, w);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 0.85, r * 1.5, f, len * 0.75, u, M.recv, 0, 7); b.disc(r * 1.28, f + len * 0.752, u, M.core);
      b.radial(6, (k) => new THREE.DodecahedronGeometry(r * (0.42 + kr(k) * 0.2), 0).translate(0, r * 1.38, 0), f + len * 0.72, u, M.recv, 0.5);
      b.radial(3, () => new THREE.ConeGeometry(r * 0.3, len * 0.5, 5).rotateX(-Math.PI / 2 + 0.35).translate(0, r * 1.5, -len * 0.2), f + len * 0.6, u, M.horn, 1.05);
      return f + len * 0.8;
    },
    orn(b, M, R) { const { f0, top, u, hw } = R, k = R.small ? 0.5 : 1; for (const s of [-1, 1]) { b.lump(0.014 * k, [f0 + 0.03 * k, u + 0.012 * k, s * (hw - 0.002)], M.recv, [1.4, 1, 0.8], 2); b.lump(0.011 * k, [f0 + 0.058 * k, u - 0.002, s * (hw - 0.002)], M.recv, [1.2, 1, 0.8], 7); b.spike([f0 + 0.03 * k, u + 0.016 * k, s * hw], [f0 - 0.012 * k, Math.min(top + 0.014 * k, u + 0.04 * k), s * (hw + 0.012 * k)], 0.0065 * k, M.horn, 5); } },
    blade(b, M) {
      const out = [[0.03, -0.016], [0.09, -0.021], [0.12, -0.012], [0.19, -0.019], [0.252, 0.01], [0.2, 0.018], [0.16, 0.031], [0.11, 0.02], [0.06, 0.029], [0.03, 0.02]];
      b.prof(out, 0.0075, M.horn, 0.003, 0, { holes: [[[0.05, 0.002], [0.1, -0.004], [0.15, 0.006], [0.2, 0.0], [0.215, 0.006], [0.15, 0.012], [0.1, 0.003], [0.05, 0.009]]] });
      b.prof(out, 0.0026, M.core, 0);
    },
  },
  // 황금 — 왕실: 둥근 통과 띠, 깃털 날개, 붉은 보석, 왕관 총구
  gold: {
    fx: { tracer: 0xffd84a, flash: 0xffe27a, sfx: 'royal', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2;
      b.ecyl(hw * 0.96, hh, f0, L, um, M.recv, 0.86, 12); b.ecyl(hw * 0.83, hh * 0.86, f1 - 0.001, 0.02, um, M.bolt, 0.6, 12);
      const kf = (f) => 1 - 0.14 * ((f - f0) / L);
      for (const f of [f0 + 0.004, f0 + L * 0.56, f1 - 0.02]) { const k = kf(f); b.ecyl(hw * 0.96 * k + 0.003, hh * k + 0.003, f, 0.012, um, M.bolt, 0.99, 20); for (const s of [-1, 1]) b.gem(0.0065, [f + 0.006, um, s * (hw * 0.96 * k + 0.004)], M.gem, [1.3, 1.3, 0.7]); }
      const fk = Math.min(1, L / 0.16);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const fa = f0 + L * 0.3 + (0.012 - i * 0.018) * fk, ua = um + (-0.012 + i * 0.012) * fk;
        b.prof([[fa + 0.03 * fk, ua - 0.006 * fk], [fa - 0.02 * fk, ua + 0.002 * fk], [fa - (0.062 + i * 0.008) * fk, ua + (0.022 + i * 0.004) * fk], [fa - 0.02 * fk, ua + 0.014 * fk], [fa + 0.024 * fk, ua + 0.004 * fk]], 0.003, M.bolt, 0.001, s * (hw + 0.003 + i * 0.0022), { r: 0.004 * fk }); }
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      b.prof([[f, top], [end + 0.05, top + 0.004], [end, top - 0.022], [end, bot + 0.012], [end + 0.03, bot], [f - L * 0.5, j0 - 0.012], [f, j0]], w, M.recv, 0.009, 0, { r: 0.012, holes: [[[f - L * 0.25, top - 0.016], [f - L * 0.62, top - 0.02], [f - L * 0.7, um], [f - L * 0.4, j0 + 0.006]]], hr: 0.01 });
      for (const s of [-1, 1]) { const x = s * (w / 2 + 0.001); b.tor(0.02, 0.0035, [end + 0.045, um, x], M.bolt, 0, Math.PI / 2, 6.2832, 20); b.gem(0.011, [end + 0.045, um, x], M.gem, [1, 1, 0.6]); for (const d of [-1, 1]) b.tor(0.011, 0.0028, [end + 0.075, um + d * 0.026, x], M.bolt, 0, Math.PI / 2, 4.4, 14); }
      b.prof([[end + 0.003, bot + 0.004], [end + 0.003, top - 0.012], [end + 0.012, top - 0.006], [end + 0.012, bot + 0.002]], w + 0.004, M.bolt, 0.002);
      buttPad(b, end, um, top - bot - 0.03, M, w);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 1.25, r * 1.25, f, len * 0.36, u, M.bolt, 0, 14); b.cyl(r * 1.35, r * 1.35, f + len * 0.04, len * 0.07, u, M.recv, 0, 14); b.cyl(r * 1.35, r * 1.35, f + len * 0.26, len * 0.07, u, M.recv, 0, 14);
      b.radial(4, () => new THREE.OctahedronGeometry(r * 0.3, 0).translate(0, r * 1.3, 0), f + len * 0.18, u, M.gem, 0.785);
      b.cyl(r * 0.6, r * 0.6, f, len * 0.8, u, M.steel, 0, 10); b.disc(r * 0.4, f + len * 0.802, u, M.dark);
      b.radial(6, () => new THREE.ConeGeometry(r * 0.3, len * 0.6, 4).rotateX(-Math.PI / 2 + 0.16).translate(0, r * 1.12, -len * 0.3), f + len * 0.36, u, M.bolt, 0.52);
      b.radial(6, () => new THREE.SphereGeometry(r * 0.2, 8, 6).translate(0, r * 1.12 + len * 0.1, -len * 0.62), f + len * 0.36, u, M.bolt, 0.52);
      return f + len * 0.85;
    },
    orn(b, M, R) { const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1; for (const s of [-1, 1]) { const x = s * (hw + 0.001), f = f0 + L * 0.2; b.tor(0.011 * k, 0.0026 * k, [f, u, x], M.bolt, 0, Math.PI / 2, 6.2832, 16); b.gem(0.008 * k, [f, u, x], M.gem, [1, 1, 0.6]); for (const d of [-1, 1]) b.prof([[f + d * 0.014 * k, u - 0.003 * k], [f + d * 0.04 * k, u + 0.008 * k], [f + d * 0.03 * k, u - 0.0005], [f + d * 0.014 * k, u + 0.003 * k]], 0.0026, M.bolt, 0.0008, x); } },
    blade(b, M) {
      b.prof([[0.03, -0.014], [0.07, -0.021], [0.11, -0.012], [0.15, -0.021], [0.19, -0.012], [0.255, 0.004], [0.19, 0.018], [0.15, 0.025], [0.11, 0.016], [0.07, 0.025], [0.03, 0.018]], 0.0055, M.bolt, 0.0022, 0, { r: 0.01 });
      b.prof([[0.04, 0.0005], [0.2, 0.0005], [0.225, 0.003], [0.2, 0.0055], [0.04, 0.0055]], 0.0062, M.recv, 0.0008);
      for (const s of [-1, 1]) b.gem(0.009, [0.026, 0.002, s * 0.0075], M.gem, [1, 1, 0.6]);
    },
  },
  // 은하 — 도는 궤도 고리, 초승달 개머리판, 차원문 총구, 별
  galaxy: {
    fx: { tracer: 0xc08cff, flash: 0xd0a0ff, sfx: 'cosmic', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, fm = (f0 + f1) / 2;
      b.ecyl(hw, hh, f0 + 0.012, L - 0.03, um, M.recv, 1, 20); b.ball(1, [f1 - 0.018, um, 0], M.recv, [0.034, hh, hw], 16); b.ball(1, [f0 + 0.012, um, 0], M.recv, [0.016, hh, hw], 16);
      const RR = Math.max(hw, hh) + 0.014, prev = b.cur, spin = prev === '';
      if (spin) b.part('spin' + ++spinN, [fm, um, b.shift], 0.9);
      b.tor(RR, 0.0022, [fm, um, 0], M.bolt, 0.5, 0, 6.2832, 36); b.ball(0.0065, [fm, um, RR], M.planet);
      if (spin) b.part('spin' + ++spinN, [fm, um, b.shift], -0.6);
      b.tor(RR + 0.006, 0.0016, [fm, um, 0], M.star, -0.55, 0, 6.2832, 36); b.ball(0.0045, [fm, um, -(RR + 0.006)], M.bolt);
      b.cur = prev;
      for (let i = 0; i < 10; i++) b.gem(0.0034, [f0 + L * (0.06 + kr(i) * 0.9), Math.min(um + (kr(i + 3) - 0.55) * hh * 2.4, u1 + 0.008), (i % 2 ? 1 : -1) * (hw + 0.008 + kr(i + 6) * 0.012)], M.star);
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, um = (top + bot) / 2, Ro = (top - bot) / 2, cx = end + Ro * 0.92, pts = [];
      for (let i = 0; i <= 14; i++) { const a = 0.7 + (i / 14) * (6.2832 - 1.4); pts.push([cx + Math.cos(a) * Ro, um + Math.sin(a) * Ro]); }
      for (let i = 14; i >= 0; i--) { const a = 1.0 + (i / 14) * (6.2832 - 2.0); pts.push([cx + Ro * 0.36 + Math.cos(a) * Ro * 0.74, um + Math.sin(a) * Ro * 0.74]); }
      b.prof(pts, w * 0.8, M.recv, 0.006);
      b.prof([[f, top - 0.004], [cx - Ro * 0.3, um + 0.011], [cx - Ro * 0.3, um - 0.011], [f, j0 + 0.004]], w * 0.5, M.steel, 0.004);
      b.ball(Ro * 0.27, [cx + Ro * 0.3, um, 0], M.planet); b.tor(Ro * 0.42, 0.002, [cx + Ro * 0.3, um, 0], M.bolt, 1.25, 0, 6.2832, 28);
      for (let i = 0; i < 5; i++) b.gem(0.0036, [cx + (kr(i + 20) - 0.3) * Ro * 1.2, um + (kr(i + 30) - 0.5) * Ro * 1.5, (i % 2 ? 1 : -1) * (w * 0.4 + 0.008)], M.star);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 1.1, r * 1.1, f, len * 0.3, u, M.steel, 0, 12); b.cyl(r * 0.6, r * 0.6, f, len * 0.62, u, M.steel, 0, 10); b.disc(r * 0.4, f + len * 0.622, u, M.dark);
      b.tor(r * 1.85, r * 0.26, [f + len * 0.85, u, 0], M.bolt, 0, 0, 6.2832, 24);
      for (const a of [1.047, 3.1416, 5.236]) b.rod([f + len * 0.15, u + Math.cos(a) * r, Math.sin(a) * r], [f + len * 0.85, u + Math.cos(a) * r * 1.85, Math.sin(a) * r * 1.85], r * 0.16, r * 0.12, M.steel, 5);
      b.disc(r * 1.7, f + len * 0.85, u, M.portal);
      const prev = b.cur; b.part('spin' + ++spinN, [f + len * 0.85, u, b.shift], 2.4);
      for (let k = 0; k < 3; k++) { const a = (k / 3) * 6.2832; b.gem(r * 0.24, [f + len * 0.85, u + Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3], M.star, [2, 1, 1]); }
      b.cur = prev;
      return f + len * 0.9;
    },
    orn(b, M, R) { const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1; for (const s of [-1, 1]) { const x = s * (hw + 0.004 * k), f = f0 + L * 0.2; b.ball(0.009 * k, [f, u + 0.004 * k, x], M.planet, [1, 1, 0.6]); b.tor(0.015 * k, 0.0014, [f, u + 0.004 * k, x], M.bolt, 1.25, 0, 6.2832, 20); for (let i = 0; i < 4; i++) b.gem(0.003 * k + 0.001, [f0 + L * (0.34 + i * 0.1), u + (kr(i + (s > 0 ? 5 : 0)) - 0.3) * 0.03 * k, s * (hw + 0.003)], M.star); } },
    blade(b, M) {
      const pts = [[0.03, -0.014]];
      for (let i = 0; i <= 9; i++) { const a = ((-98 + i * 8.6) * Math.PI) / 180; pts.push([0.062 + Math.cos(a) * 0.185, 0.168 + Math.sin(a) * 0.185]); }
      pts.push([0.24, 0.122]);
      for (let i = 9; i >= 0; i--) { const a = ((-96 + i * 7.6) * Math.PI) / 180; pts.push([0.075 + Math.cos(a) * 0.15, 0.158 + Math.sin(a) * 0.15]); }
      pts.push([0.03, 0.02]);
      b.prof(pts, 0.005, M.recv, 0.002);
      for (let i = 0; i < 4; i++) { const a = ((-80 + i * 16) * Math.PI) / 180; for (const s of [-1, 1]) b.gem(0.0034, [0.068 + Math.cos(a) * 0.168, 0.163 + Math.sin(a) * 0.168, s * 0.0045], M.star); }
    },
  },
  // 오로라 — 반투명 프리즘 날이 감싼 크롬 몸
  aurora: {
    fx: { tracer: 0xffffff, flash: 0xd8f4ff, rainbow: true, sfx: 'prism', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, hh = (u1 - u0) / 2, uc = R.uc ?? (u0 + u1) / 2, rc = Math.max(0.008, Math.min(0.019, Math.min(u1 - uc, uc - u0) - 0.004));
      b.cyl(rc, rc, f0, L, uc, M.steel, 0, 16); b.cyl(rc + 0.004, rc + 0.004, f0, 0.014, uc, M.bolt, 0, 16); b.cyl(rc + 0.004, rc + 0.003, f1 - 0.014, 0.014, uc, M.bolt, 0, 16);
      const r0 = rc * 0.6, r1 = Math.max(hw, hh) + 0.012;
      for (const [a, k] of [[1.05, 1], [-1.05, 1], [Math.PI, 0.9], [2.2, 0.72], [-2.2, 0.72]])
        b.prof([[f0 + 0.006, uc + r0], [f0 + 0.03, uc + r1 * k], [f1 - 0.04, uc + r1 * k * 0.86], [f1 + 0.05 * k, uc + r0 + 0.003], [f1 - 0.02, uc + r0]], 0.0045, M.prism, 0.0015, 0, { roll: a, cu: uc });
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2, uj = (top + j0) / 2;
      b.prof([[f, top], [end, top], [end, top - 0.014], [f - L * 0.3, top - 0.016], [f, j0]], w * 0.6, M.steel, 0.004);
      for (let i = 0; i < 4; i++) { const t = i / 3, tu = top - 0.024 - t * (top - bot - 0.04), tf = end + 0.014 + t * 0.03;
        b.prof([[f - 0.01, uj + 0.008 - t * 0.02], [tf, tu + 0.012], [tf - 0.008, tu], [f - 0.03, uj - 0.014 - t * 0.012]], 0.004, M.prism, 0.0012, (i % 2 ? 1 : -1) * 0.005); }
      b.prof([[end, top], [end, bot + 0.03], [end + 0.012, bot + 0.036], [end + 0.012, top - 0.014]], w * 0.7, M.steel, 0.003);
      buttPad(b, end, um + 0.012, top - bot - 0.03, M, w * 0.8);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 1.15, r * 1.15, f, len * 0.3, u, M.bolt, 0, 14); b.cyl(r * 0.6, r * 0.6, f, len * 0.85, u, M.steel, 0, 10); b.disc(r * 0.4, f + len * 0.852, u, M.dark);
      for (const a of [1.05, -1.05, Math.PI]) b.prof([[f + len * 0.05, u + r * 0.7], [f + len * 0.3, u + r * 2.0], [f + len * 1.25, u + r * 0.62], [f + len * 0.9, u + r * 0.5], [f + len * 0.05, u + r * 0.5]], r * 0.3, M.prism, r * 0.08, 0, { roll: a, cu: u });
      return f + len * 0.9;
    },
    orn(b, M, R) { const { f0, f1, top, u, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1; for (const s of [-1, 1]) for (let i = 0; i < 2; i++) b.prof([[f0 + L * 0.42 - i * 0.03 * k, u - 0.004 * k], [f0 + L * 0.42 + (0.03 - i * 0.03) * k, u + 0.004 * k], [f0 + 0.004 - i * 0.008 * k, Math.min(top + 0.016 * k, u + 0.044 * k) - i * 0.012 * k], [f0 + L * 0.25 - i * 0.03 * k, u + 0.002 * k]], 0.003, M.prism, 0.001, s * (hw + 0.002 + i * 0.003)); },
    blade(b, M) {
      b.prof([[0.03, -0.015], [0.19, -0.022], [0.265, 0.003], [0.19, 0.028], [0.03, 0.021]], 0.009, M.prism, 0.004);
      b.prof([[0.03, -0.002], [0.2, 0.0], [0.245, 0.003], [0.2, 0.006], [0.03, 0.008]], 0.0035, M.bolt, 0.001);
      for (const s of [-1, 1]) b.prof([[0.034, 0.02], [0.07, 0.022], [0.02, 0.05]], 0.003, M.prism, 0.001, s * 0.006);
    },
  },
  // 할로윈 — 속에서 불빛이 새는 호박등 총열덮개, 박쥐 날개 개머리판, 호박 총구, 낫 모양 칼
  halloween: {
    fx: { tracer: 0xa64dff, flash: 0xff8a1a, sfx: 'spooky', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, bv = Math.min(0.005, hh * 0.22);
      const out = [[f0, u0 + hh * 0.3], [f0, u1 - hh * 0.3], [f0 + L * 0.06, u1], [f1 - L * 0.06, u1], [f1, u1 - hh * 0.3], [f1, u0 + hh * 0.3], [f1 - L * 0.06, u0], [f0 + L * 0.06, u0]];
      const eye = (c) => [[f0 + L * (c - 0.12), um + hh * 0.06], [f0 + L * (c + 0.12), um + hh * 0.06], [f0 + L * c, um + hh * 0.66]];
      const mouth = [[0.18, -0.1], [0.31, -0.34], [0.4, -0.12], [0.5, -0.34], [0.6, -0.12], [0.69, -0.34], [0.82, -0.1], [0.7, -0.7], [0.57, -0.56], [0.5, -0.72], [0.43, -0.56], [0.3, -0.7]].map(([a, v]) => [f0 + L * a, um + hh * v]);
      b.prof(out, w, M.pumpkin, bv, 0, { holes: [eye(0.33), eye(0.67), mouth] }); b.prof(out, w * 0.34, M.glow, 0);
      for (const a of [0.14, 0.5, 0.86]) b.box(w * 0.5, 0.0016, 0.004, f0 + L * a, u1 + 0.0004, M.stem);                          // 호박 골
      b.rod([f0 + L * 0.5, u1 - 0.002, 0], [f0 + L * 0.5 - 0.01, u1 + 0.014, 0], 0.0062, 0.0042, M.stem, 6);                  // 꼭지
      const k = Math.min(1, L / 0.2), a = f0 + L * 0.2;
      for (const s of [-1, 1]) b.prof([[a, u1 - 0.006], [a + 0.05 * k, u1 - 0.006], [a + 0.032 * k, u1 + 0.01 * k], [a + 0.014 * k, u1 + 0.004 * k], [a - 0.002 * k, u1 + 0.026 * k], [a - 0.014 * k, u1 + 0.01 * k], [a - 0.032 * k, u1 + 0.03 * k], [a - 0.024 * k, u1 - 0.002]], 0.0022, M.wing, 0, s * (hw + 0.0016)); // 박쥐 날개
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      const out = [[f, top], [end + 0.035, top], [end, top - 0.03], [end, bot + 0.02], [end + 0.03, bot], [end + L * 0.3, bot + 0.034], [end + L * 0.42, bot + 0.012], [end + L * 0.6, j0 - 0.014], [end + L * 0.72, j0 - 0.032], [f - L * 0.12, j0 - 0.006], [f, j0]];
      const cx = end + L * 0.38, cy = top - 0.03, r0 = 0.013, moon = [];
      for (let i = 0; i <= 6; i++) { const t = 1.0 + (i / 6) * 4.28; moon.push([cx + Math.cos(t) * r0, cy + Math.sin(t) * r0]); }
      for (let i = 0; i <= 4; i++) { const t = 5.0 - (i / 4) * 3.72; moon.push([cx + 0.007 + Math.cos(t) * r0 * 0.78, cy + Math.sin(t) * r0 * 0.78]); }
      b.prof(out, w, M.recv, 0.008, 0, { holes: [moon] }); b.prof(out, w * 0.3, M.glow, 0);
      for (const s of [-1, 1]) { b.ball(0.012, [end + L * 0.72, top - 0.026, s * (w / 2)], M.pumpkin, [1.1, 0.9, 0.55], 9); for (const d of [-0.004, 0.004]) b.box(0.002, 0.004, 0.003, end + L * 0.72 + d, top - 0.023, M.glow, s * (w / 2 + 0.0064)); }
      buttPad(b, end, um, top - bot - 0.06, M, w);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 0.62, r * 0.62, f, len * 1.0, u, M.steel, 0, 10); b.disc(r * 0.4, f + len * 1.002, u, M.dark);
      b.cyl(r * 1.1, r * 1.1, f + len * 0.1, len * 0.78, u, M.glow, 0, 10);
      b.radial(7, () => { const g = new THREE.SphereGeometry(r * 0.72, 8, 6); g.scale(0.8, 0.8, (len * 0.47) / (r * 0.72)); g.translate(0, r * 1.12, -len * 0.5); return g; }, f, u, M.pumpkin, 0.22);
      b.rod([f + len * 0.5, u + r * 1.7, 0], [f + len * 0.36, u + r * 2.5, 0], r * 0.3, r * 0.2, M.stem, 6);
      return f + len;
    },
    orn(b, M, R) {
      const { f0, u, hw } = R, k = R.small ? 0.55 : 1, fc = f0 + 0.042 * k, uc = u + 0.004;
      const bat = [[-28, 8], [-16, 2], [-8, 9], [-4, 4], [-2.5, 12], [0, 6], [2.5, 12], [4, 4], [8, 9], [16, 2], [28, 8], [20, -6], [12, -2], [6, -8], [0, -4], [-6, -8], [-12, -2], [-20, -6]].map(([a, v]) => [fc + a * 0.001 * k, uc + v * 0.001 * k]);
      for (const s of [-1, 1]) { b.prof(bat, 0.0024, M.wing, 0, s * (hw + 0.0016)); for (const d of [-0.0022, 0.0022]) b.ball(0.0013 * k + 0.0004, [fc + d * k, uc + 0.004 * k, s * (hw + 0.003)], M.eye, [1, 1, 0.6], 6); }
    },
    blade(b, M) {
      const out = [[0.03, -0.014], [0.1, -0.02], [0.17, -0.016], [0.222, -0.002], [0.248, 0.028], [0.254, 0.064], [0.232, 0.038], [0.2, 0.022], [0.15, 0.015], [0.09, 0.017], [0.03, 0.02]];
      const tri = (c) => [[c - 0.01, 0.0], [c + 0.01, 0.0], [c, 0.009]];
      b.prof(out, 0.007, M.wing, 0.0028, 0, { holes: [tri(0.075), tri(0.115), [[0.06, -0.006], [0.078, -0.011], [0.095, -0.006], [0.112, -0.011], [0.13, -0.006], [0.112, -0.0145], [0.095, -0.012], [0.078, -0.0145]]] });
      b.prof(out, 0.0024, M.glow, 0);
      b.prof([[0.15, -0.0165], [0.222, -0.002], [0.248, 0.028], [0.254, 0.064], [0.25, 0.03], [0.228, 0.004], [0.17, -0.012]], 0.0074, M.pumpkin, 0.0004); // 주황 날
    },
  },
  // ───────────── 얼티밋 번들: 형태 + 전용 총소리·장착음·처치음 + 궤적·불꽃·착탄·처치 효과가 모두 바뀐다 (발로란트식) ─────────────
  // 플래티넘 프라임 — 각진 장갑판, 금빛 테두리, 푸른 홀로그램 빛줄
  platinum: {
    fx: { tracer: 0x7fdcff, flash: 0xbfeaff, sfx: 'prime', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, k = Math.min(1, L / 0.2);
      b.prof([[f0, u0], [f0, u1], [f1 - 0.03 * k, u1], [f1 + 0.012 * k, um + hh * 0.25], [f1 - 0.006, u0]], w, M.recv, 0.003, 0, { r: 0.004 });
      b.box(w * 0.5, 0.003, L * 0.82, f0 + L * 0.45, u1 + 0.0012, M.trim);
      for (const s of [-1, 1]) {
        const x = s * (hw + 0.0009);
        b.box(0.0016, 0.0042, L * 0.66, f0 + L * 0.42, um + hh * 0.1, M.holo, x); b.box(0.0016, 0.002, L * 0.4, f0 + L * 0.36, um - hh * 0.42, M.holo, x);
        for (let i = 0; i < 3; i++) { const f = f0 + L * 0.74 + i * 0.012 * k, a = 0.011 * k; b.prof([[f, um], [f + a, um + a], [f + a + 0.005, um + a], [f + 0.005, um], [f + a + 0.005, um - a], [f + a, um - a]], 0.0018, M.trim, 0, x); }
        b.prof([[f0 + 0.004, u0 + hh * 0.3], [f0 + L * 0.2, u0 + 0.002], [f0 + L * 0.62, u0 + 0.002], [f0 + L * 0.7, u0 + hh * 0.35]], 0.002, M.trim, 0, s * (hw + 0.0016));
      }
      for (let i = 0; i < Math.max(2, Math.round(L / 0.04)); i++) b.box(w * 0.5, 0.002, 0.012, f0 + 0.02 + i * 0.035, u0 - 0.0006, M.holo);
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      const out = [[f, top], [end + 0.03, top + 0.005], [end, top - 0.012], [end, bot + 0.01], [end + 0.022, bot], [f - L * 0.45, j0 - 0.012], [f, j0]];
      const hole = [[f - 0.03, top - 0.012], [end + 0.04, top - 0.008], [end + 0.022, um], [end + 0.03, bot + 0.016], [f - L * 0.45, j0 - 0.002 - 0.012 + 0.012], [f - 0.03, j0 + 0.006]];
      b.prof(out, w, M.recv, 0.004, 0, { holes: [hole] }); b.prof(hole, w * 0.28, M.holo, 0);
      for (const s of [-1, 1]) b.prof([[f - 0.004, top + 0.001], [end + 0.03, top + 0.006], [end + 0.026, top + 0.002], [f - 0.006, top - 0.003]], 0.002, M.trim, 0, s * (w / 2 + 0.001));
      buttPad(b, end, um, top - bot - 0.02, M, w);
    },
    muzzle(b, M, f, u, r, len) {
      b.prof([[f, u - r * 1.3], [f, u + r * 1.3], [f + len * 0.78, u + r * 1.1], [f + len, u], [f + len * 0.78, u - r * 1.1]], r * 2.4, M.recv, 0.002);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.box(0.0012, r * 0.32, len * 0.12, f + len * (0.22 + i * 0.18), u, M.holo, s * (r * 1.2 + 0.0006));
      b.box(r * 1.2, 0.0016, len * 0.6, f + len * 0.4, u + r * 1.25, M.trim);
      b.tor(r * 1.7, r * 0.11, [f + len * 1.02, u, 0], M.holo, 0, 0, 6.2832, 24);
      b.disc(r * 0.5, f + len + 0.0005, u, M.dark);
      return f + len;
    },
    orn(b, M, R) {
      const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1;
      for (const s of [-1, 1]) { const x = s * (hw + 0.0009), f = f0 + L * 0.25; for (let i = 0; i < 2; i++) { const a = 0.012 * k, g = f + i * 0.009 * k; b.prof([[g, u], [g + a, u + a], [g + a + 0.004 * k, u + a], [g + 0.004 * k, u], [g + a + 0.004 * k, u - a], [g + a, u - a]], 0.0018, i ? M.holo : M.trim, 0, x); } b.box(0.0014, 0.0025 * k, L * 0.4, f0 + L * 0.62, u + 0.012 * k, M.holo, x); }
    },
    blade(b, M) {
      b.prof([[0.03, -0.016], [0.2, -0.016], [0.255, 0.004], [0.236, 0.021], [0.03, 0.021]], 0.0052, M.recv, 0.0015);
      b.prof([[0.035, -0.0166], [0.2, -0.0166], [0.254, 0.0035], [0.2, -0.0105], [0.035, -0.0105]], 0.0058, M.holo, 0.0004);
      for (const s of [-1, 1]) b.box(0.0014, 0.002, 0.15, 0.12, 0.016, M.trim, s * 0.0028);
    },
  },
  // 다마스커스 사무라이 — 실로 감은 손잡이, 금빛 코등이, 붉은 술, 총검처럼 뻗은 칼끝
  damascus: {
    fx: { tracer: 0xffb04a, flash: 0xffd890, sfx: 'blade', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, k = Math.min(1, L / 0.2);
      b.prof([[f0, u0], [f0, u1], [f1, u1], [f1, u0]], w, M.recv, 0.003, 0, { r: Math.min(0.012, hh * 0.6) });
      const n = Math.max(3, Math.round((L - 0.03) / 0.022));
      for (let i = 0; i < n; i++) { const f = f0 + 0.015 + (i + 0.5) * ((L - 0.03) / n); for (const a of [0.62, -0.62]) b.box(w + 0.002, (u1 - u0) * 1.02, 0.0042, f, um, M.wrap, 0, a); }
      b.ecyl(hw * 1.7, hh * 1.55, f1 - 0.004, 0.006, um, M.gilt, 1, 20); b.ecyl(hw * 1.2, hh * 1.12, f1 - 0.012, 0.008, um, M.gilt, 1, 16); // 코등이(쓰바)와 덧쇠
      b.ecyl(hw * 1.06, hh * 1.04, f0, 0.008, um, M.gilt, 1, 16);
      const fx = f0 + 0.02, ux = u0 - 0.002; // 붉은 술(사게오)
      b.rod([fx, ux, 0], [fx - 0.004, ux - 0.03 * k, 0], 0.0022, 0.0022, M.silk, 6); b.ball(0.005 * k + 0.002, [fx - 0.004, ux - 0.032 * k, 0], M.gilt, [1, 1, 1], 8);
      b.rod([fx - 0.004, ux - 0.034 * k, 0], [fx - 0.006, ux - 0.07 * k, 0], 0.0045 * k + 0.001, 0.0012, M.silk, 7);
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      b.prof([[f, top], [end + 0.04, top + 0.004], [end, top - 0.016], [end, bot + 0.014], [end + 0.03, bot], [f - L * 0.5, j0 - 0.016], [f, j0]], w, M.recv, 0.006, 0, { r: 0.01 });
      for (let i = 0; i < 4; i++) { const ff = f - 0.03 - i * 0.02; for (const a of [0.62, -0.62]) b.box(w + 0.002, (top - j0) * 1.0, 0.004, ff, (top + j0) / 2, M.wrap, 0, a); }
      for (const s of [-1, 1]) { const x = s * (w / 2 + 0.0012); b.sdisc(0.014, end + 0.06, um, x, M.gilt); for (let i = 0; i < 3; i++) { const a = i * 2.094; b.ball(0.0034, [end + 0.06 + Math.cos(a) * 0.006, um + Math.sin(a) * 0.006, x + s * 0.0012], M.wrap, [1, 1, 0.5], 6); } }
      b.prof([[end + 0.004, bot + 0.012], [end + 0.004, top - 0.014], [end + 0.012, top - 0.008], [end + 0.012, bot + 0.008]], w + 0.004, M.gilt, 0.002);
      b.rod([end + 0.02, bot + 0.004, 0], [end + 0.018, bot - 0.03, 0], 0.002, 0.002, M.silk, 6); b.rod([end + 0.018, bot - 0.03, 0], [end + 0.016, bot - 0.06, 0], 0.0045, 0.0012, M.silk, 7);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 1.15, r * 1.15, f, len * 0.16, u, M.gilt, 0, 14); b.cyl(r * 0.85, r * 0.85, f + len * 0.16, len * 0.5, u, M.steel, 0, 12); b.cyl(r * 1.05, r * 1.05, f + len * 0.6, len * 0.1, u, M.gilt, 0, 14);
      b.disc(r * 0.5, f + len * 0.7 + 0.0005, u, M.dark);
      const ub = u - r * 1.25; // 총열 아래로 뻗은 칼끝 (칼날 무늬 하몬)
      b.prof([[f + len * 0.05, ub - r * 0.9], [f + len * 1.5, ub - r * 0.9], [f + len * 1.95, ub + r * 0.2], [f + len * 1.5, ub + r * 0.35], [f + len * 0.05, ub + r * 0.35]], r * 0.55, M.hamon, r * 0.12);
      b.prof([[f + len * 0.05, ub - r * 0.95], [f + len * 1.5, ub - r * 0.95], [f + len * 1.93, ub + r * 0.15], [f + len * 1.5, ub - r * 0.4], [f + len * 0.05, ub - r * 0.4]], r * 0.6, M.bolt, 0);
      return f + len * 0.7;
    },
    orn(b, M, R) {
      const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1;
      for (const s of [-1, 1]) { const x = s * (hw + 0.0011), f = f0 + L * 0.3, rr = 0.011 * k; b.sdisc(rr, f, u + 0.004 * k, x, M.gilt); for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; b.ball(rr * 0.28, [f + Math.cos(a) * rr * 0.5, u + 0.004 * k + Math.sin(a) * rr * 0.5, x + s * 0.001], M.wrap, [1, 1, 0.5], 6); } b.box(0.0014, 0.0022 * k, L * 0.36, f0 + L * 0.66, u + 0.006 * k, M.gilt, x); }
    },
    blade(b, M) { // 휜 일본도: 칼날(하몬)과 등, 금빛 덧쇠
      const lo = [], hi = [], cv = (t) => Math.sin(t * 1.3) * 0.014;
      for (let i = 0; i <= 12; i++) { const t = i / 12, f = 0.034 + t * 0.228; lo.push([f, -0.011 + cv(t) + (t > 0.78 ? ((t - 0.78) / 0.22) ** 1.6 * 0.02 : 0)]); hi.push([f, 0.011 + cv(t)]); }
      const tip = [0.272, 0.011 + cv(1) - 0.002];
      b.prof([...lo, tip, ...hi.slice().reverse()], 0.0055, M.hamon, 0.0018);
      b.prof([...hi.slice(0, 11), ...hi.slice(0, 11).reverse().map(([f, uu]) => [f, uu - 0.006])], 0.0062, M.recv, 0.0006);
      b.prof([[0.026, -0.022], [0.034, -0.022], [0.034, 0.026], [0.026, 0.026]], 0.012, M.gilt, 0.002);
    },
  },
  // 흑요석 리퍼 — 검은 유리 조각이 돋고, 갈라진 틈에서 보랏빛이 샘. 칼은 낫
  obsidian: {
    fx: { tracer: 0xc89cff, flash: 0xe0c8ff, sfx: 'shard', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, k = Math.min(1, L / 0.2);
      b.prof([[f0, u0 + hh * 0.2], [f0, u1], [f0 + L * 0.4, u1 + 0.004 * k], [f1 - 0.01, u1 - hh * 0.1], [f1 + 0.02 * k, um - hh * 0.3], [f1 - 0.02, u0], [f0 + L * 0.3, u0 - 0.004 * k]], w, M.recv, 0.002);
      for (const s of [-1, 1]) { const x = s * (hw + 0.0008), P = []; for (let i = 0; i <= 7; i++) P.push([f0 + 0.01 + i * (L - 0.02) / 7, um + (i % 2 ? 0.4 : -0.3) * hh * (0.6 + kr(i + (s > 0 ? 9 : 0)) * 0.5)]); for (let i = 0; i < 7; i++) b.rod([P[i][0], P[i][1], x], [P[i + 1][0], P[i + 1][1], x], 0.0011, 0.0011, M.rift, 4); }
      const n = Math.max(3, Math.round(L / 0.035));
      for (let i = 0; i < n; i++) { const f = f0 + 0.012 + (i * (L - 0.03)) / (n - 1), hgt = (0.014 + kr(i + 4) * 0.016) * k; b.crys([f, u1 - 0.002, (kr(i) - 0.5) * hw], [f + 0.012 * k, u1 + hgt, (kr(i + 1) - 0.5) * hw * 1.6], 0.005 * k + 0.002, M.shard, 4); if (i % 2) for (const s of [-1, 1]) b.crys([f, um - hh * 0.2, s * hw * 0.8], [f + 0.01 * k, um - hh * 0.5, s * (hw + 0.014 * k)], 0.004 * k + 0.0015, M.shard, 4); }
    },
    stock(b, M, R) { // 낫날처럼 휘어 내려간 개머리판
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      const out = [[f, top], [f - L * 0.4, top + 0.008], [end + 0.01, top - 0.004], [end - 0.012, top - 0.03], [end + 0.008, bot + 0.006], [end + 0.03, bot - 0.012], [end + 0.04, bot + 0.012], [f - L * 0.5, j0 - 0.02], [f, j0]];
      b.prof(out, w, M.recv, 0.003, 0, { holes: [[[f - 0.03, top - 0.012], [end + 0.04, top - 0.014], [end + 0.03, um], [f - L * 0.5, j0 - 0.006], [f - 0.03, j0 + 0.004]]] });
      b.prof([[f - 0.03, top - 0.012], [end + 0.04, top - 0.014], [end + 0.03, um], [f - L * 0.5, j0 - 0.006], [f - 0.03, j0 + 0.004]], w * 0.25, M.rift, 0);
      for (let i = 0; i < 3; i++) b.crys([end + 0.03 + i * 0.03, top - 0.002, 0], [end + 0.02 + i * 0.03, top + 0.016 + kr(i + 20) * 0.01, 0], 0.005, M.shard, 4);
      b.crys([end + 0.03, bot - 0.004, 0], [end + 0.05, bot - 0.03, 0], 0.005, M.shard, 4);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 0.9, r * 1.1, f, len * 0.5, u, M.recv, 0, 7); b.cyl(r * 0.55, r * 0.55, f, len * 0.75, u, M.steel, 0, 8); b.disc(r * 0.4, f + len * 0.752, u, M.dark);
      b.tor(r * 1.15, r * 0.12, [f + len * 0.45, u, 0], M.rift, 0, 0, 6.2832, 14);
      b.radial(3, () => new THREE.ConeGeometry(r * 0.38, len * 0.95, 4).rotateX(-Math.PI / 2 + 0.22).translate(0, r * 1.3, -len * 0.35), f + len * 0.35, u, M.shard, 0.5);
      return f + len * 0.78;
    },
    orn(b, M, R) {
      const { f0, f1, u, top, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1;
      for (const s of [-1, 1]) { for (let i = 0; i < 3; i++) b.crys([f0 + L * (0.2 + i * 0.06), u, s * (hw - 0.002)], [f0 + L * (0.16 + i * 0.07), Math.min(top + 0.01 * k, u + (0.014 + i * 0.006) * k), s * (hw + (0.01 + i * 0.003) * k)], 0.0035 * k + 0.001, M.shard, 4); b.box(0.0012, 0.0016, L * 0.45, f0 + L * 0.62, u - 0.004 * k, M.rift, s * (hw + 0.0007)); }
    },
    blade(b, M) { // 낫
      const pts = [[0.03, -0.014]];
      for (let i = 0; i <= 10; i++) { const a = ((-88 + i * 9) * Math.PI) / 180; pts.push([0.11 + Math.cos(a) * 0.15, 0.13 + Math.sin(a) * 0.15]); }
      for (let i = 10; i >= 0; i--) { const a = ((-84 + i * 8) * Math.PI) / 180; pts.push([0.12 + Math.cos(a) * 0.12, 0.122 + Math.sin(a) * 0.12]); }
      pts.push([0.03, 0.02]);
      b.prof(pts, 0.0052, M.shard, 0.0018);
      for (const s of [-1, 1]) for (let i = 0; i < 9; i++) { const a0 = ((-86 + i * 9) * Math.PI) / 180, a1 = ((-86 + (i + 1) * 9) * Math.PI) / 180; b.rod([0.115 + Math.cos(a0) * 0.135, 0.126 + Math.sin(a0) * 0.135, s * 0.0029], [0.115 + Math.cos(a1) * 0.135, 0.126 + Math.sin(a1) * 0.135, s * 0.0029], 0.0011, 0.0011, M.rift, 4); }
    },
  },
  // 다이아몬드 크라운 — 금빛 띠에 박힌 결정 무리, 왕관 총구, 큰 보석을 문 개머리판
  diamond: {
    fx: { tracer: 0xbff0ff, flash: 0xeaf8ff, sfx: 'crystal', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, k = Math.min(1, L / 0.2);
      b.ecyl(hw * 1.05, hh, f0, L, um, M.recv, 0.92, 6);
      for (const f of [f0 + 0.003, f0 + L * 0.5, f1 - 0.012]) b.ecyl(hw * 1.1, hh * 1.05, f, 0.009, um, M.gilt, 1, 6);
      const n = Math.max(2, Math.round(L / 0.05));
      for (let i = 0; i < n; i++) { const f = f0 + 0.02 + (i * (L - 0.04)) / Math.max(1, n - 1); b.crys([f, u1 - 0.004, 0], [f - 0.004, u1 + (0.018 + kr(i) * 0.012) * k, 0], 0.006 * k + 0.002, M.crystal, 6); for (const s of [-1, 1]) { b.crys([f + 0.008, u1 - 0.004, s * hw * 0.4], [f + 0.012, u1 + 0.01 * k, s * (hw * 0.4 + 0.008 * k)], 0.004 * k + 0.0015, M.crystal, 5); b.gem(0.0045 * k + 0.0015, [f, um, s * (hw * 1.02 + 0.002)], M.pink, [1.2, 1.2, 0.6]); } }
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2, cx = end + L * 0.42;
      b.prof([[f, top], [end + 0.03, top], [end, top - 0.02], [end, bot + 0.01], [end + 0.03, bot], [f - L * 0.5, j0 - 0.014], [f, j0]], w * 0.8, M.recv, 0.004, 0, { holes: [[[cx, top - 0.01], [cx + 0.03, um], [cx, bot + 0.014], [cx - 0.03, um]]] });
      b.gem(0.026, [cx, um + 0.002, 0], M.crystal, [1.1, 1.5, 0.55]);
      for (const s of [-1, 1]) for (const [df, du] of [[0.04, 0], [-0.045, 0], [0, (top - um) * 0.7]]) b.gem(0.005, [cx + df, um + du, s * (w * 0.4 + 0.002)], M.pink, [1, 1, 0.6]);
      b.prof([[end + 0.003, bot + 0.004], [end + 0.003, top - 0.016], [end + 0.012, top - 0.01], [end + 0.012, bot + 0.002]], w + 0.004, M.gilt, 0.002);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 1.25, r * 1.25, f, len * 0.3, u, M.gilt, 0, 6); b.cyl(r * 0.6, r * 0.6, f, len * 0.6, u, M.steel, 0, 10); b.disc(r * 0.4, f + len * 0.602, u, M.dark);
      b.radial(6, () => new THREE.ConeGeometry(r * 0.32, len * 0.75, 4).rotateX(-Math.PI / 2 + 0.3).translate(0, r * 1.25, -len * 0.3), f + len * 0.3, u, M.crystal, 0.52);
      b.radial(6, () => new THREE.OctahedronGeometry(r * 0.24, 0).translate(0, r * 1.32, 0), f + len * 0.16, u, M.pink);
      return f + len * 0.65;
    },
    orn(b, M, R) {
      const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1;
      for (const s of [-1, 1]) { const x = s * (hw + 0.001), f = f0 + L * 0.25; b.tor(0.011 * k, 0.002 * k, [f, u, x], M.gilt, 0, Math.PI / 2, 6.2832, 6); b.gem(0.009 * k, [f, u, x], M.crystal, [1, 1, 0.55]); for (let i = 0; i < 3; i++) b.gem(0.003 * k + 0.001, [f0 + L * (0.45 + i * 0.1), u + 0.004 * k, x], M.pink, [1, 1, 0.6]); }
    },
    blade(b, M) {
      b.prof([[0.03, -0.015], [0.2, -0.02], [0.262, 0.004], [0.2, 0.026], [0.03, 0.02]], 0.006, M.recv, 0.0022);
      b.prof([[0.03, -0.0175], [0.2, -0.0225], [0.27, 0.004], [0.2, -0.012], [0.03, -0.01]], 0.0035, M.crystal, 0.001);
      for (const s of [-1, 1]) for (let i = 0; i < 5; i++) b.gem(0.003, [0.06 + i * 0.035, 0.004 + (i % 2) * 0.004, s * 0.0034], M.pink, [1, 1, 0.6]);
      b.prof([[0.026, -0.024], [0.034, -0.024], [0.034, 0.028], [0.026, 0.028]], 0.012, M.gilt, 0.002);
      for (const s of [-1, 1]) b.gem(0.006, [0.03, 0.002, s * 0.0065], M.pink, [1, 1, 0.6]);
    },
  },
  // 아토믹 리액터 — 유리관 속 빛나는 노심과 도는 고리, 방열판, 테슬라 코일 총구
  atomic: {
    fx: { tracer: 0xff6a1a, flash: 0xffa040, sfx: 'reactor', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, k = Math.min(1, L / 0.2), rc = Math.max(0.006, Math.min(hw, hh) * 0.82);
      b.box(w * 0.9, 0.007, L, f0 + L / 2, u1 - 0.0035, M.recv); b.box(w * 0.9, 0.007, L, f0 + L / 2, u0 + 0.0035, M.recv);
      for (const f of [f0 + 0.006, f1 - 0.006]) b.ecyl(hw * 1.05, hh, f - 0.006, 0.012, um, M.recv, 1, 14);
      b.cyl(rc * 0.42, rc * 0.42, f0 + 0.01, L - 0.02, um, M.core, 0, 10);
      b.tube(rc, rc, f0 + 0.012, L - 0.024, um, M.glassR, 16);
      for (let i = 0, n = Math.max(3, Math.round(L / 0.03)); i < n; i++) { const f = f0 + 0.02 + (i * (L - 0.04)) / (n - 1); b.box(w * 0.92, 0.0016, 0.006, f, u1 + 0.0004, i % 2 ? M.hazard : M.dark); b.box(w * 0.92, 0.0016, 0.006, f, u0 - 0.0004, i % 2 ? M.dark : M.hazard); }
      const prev = b.cur, fm = f0 + L / 2;
      if (prev === '') b.part('spin' + ++spinN, [fm, um, b.shift], 3);
      for (const df of [-L * 0.25, L * 0.25]) { b.tor(rc * 1.06, 0.0014, [fm + df, um, 0], M.hazard, 0, 0, 6.2832, 20); b.ball(0.0026, [fm + df, um + rc * 1.06, 0], M.core, [1, 1, 1], 6); }
      b.cur = prev;
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.box(0.012 * k, 0.0025, 0.022 * k, f0 + L * 0.25 + i * 0.03 * k, um - hh * 0.6, M.recv, s * (hw + 0.004 * k), 0, s * 0.4);
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      b.prof([[f, top], [end, top], [end, bot], [end + 0.03, bot], [f - L * 0.4, j0 - 0.01], [f, j0]], w * 0.4, M.recv, 0.003);
      for (let i = 0; i < 6; i++) b.box(w * 1.1, top - bot - 0.012, 0.0032, end + 0.024 + i * 0.012, um, M.steel);
      b.cyl(0.013, 0.013, f - L * 0.42, L * 0.3, um + 0.004, M.recv, 0, 14); b.cyl(0.006, 0.006, f - L * 0.41, L * 0.28, um + 0.004, M.core, 0, 10); b.tube(0.0105, 0.0105, f - L * 0.4, L * 0.26, um + 0.004, M.glassR, 14);
      b.box(w + 0.003, 0.004, 0.02, end + 0.008, top - 0.004, M.hazard);
      buttPad(b, end, um, top - bot - 0.01, M, w);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 0.7, r * 0.7, f, len * 0.9, u, M.steel, 0, 10);
      for (let i = 0; i < 4; i++) b.cyl(r * (1.7 - i * 0.22), r * (1.7 - i * 0.22), f + len * (0.08 + i * 0.18), len * 0.06, u, i % 2 ? M.hazard : M.recv, 0, 14);
      b.ball(r * 0.75, [f + len * 0.95, u, 0], M.core, [1.2, 1, 1], 10);
      const prev = b.cur; if (prev === '') b.part('spin' + ++spinN, [f + len * 0.95, u, b.shift], -4);
      b.tor(r * 1.4, r * 0.08, [f + len * 0.95, u, 0], M.core, 0.6, 0, 6.2832, 18); b.cur = prev;
      return f + len;
    },
    orn(b, M, R) {
      const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1;
      for (const s of [-1, 1]) { const x = s * (hw + 0.001), f = f0 + L * 0.28, rr = 0.012 * k; b.sdisc(rr, f, u, x, M.hazard); for (let i = 0; i < 3; i++) { const a = i * 2.094 + 1.5708, P = [[f, u]]; for (let j = 0; j <= 4; j++) { const t = a - 0.5 + j * 0.25; P.push([f + Math.cos(t) * rr * 0.9, u + Math.sin(t) * rr * 0.9]); } b.prof(P, 0.0012, M.dark, 0, x + s * 0.0004); } b.sdisc(rr * 0.22, f, u, x + s * 0.0009, M.hazard); }
    },
    blade(b, M) {
      b.prof([[0.03, -0.015], [0.2, -0.015], [0.255, 0.004], [0.215, 0.021], [0.03, 0.021]], 0.008, M.glassR, 0.003);
      b.prof([[0.04, -0.006], [0.19, -0.006], [0.23, 0.004], [0.19, 0.012], [0.04, 0.012]], 0.003, M.core, 0.001);
      for (let i = 0; i < 4; i++) b.box(0.012, 0.042, 0.0024, 0.032 - i * 0.004, 0.003, i % 2 ? M.hazard : M.dark);
    },
  },
  // 오리온 성좌 — 별자리 빛줄, 둘레를 도는 후광 고리, 네 갈래 별 총구
  orion: {
    fx: { tracer: 0xffffff, flash: 0xe0e8ff, rainbow: true, sfx: 'star', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, fm = f0 + L / 2;
      b.ecyl(hw, hh, f0 + 0.008, L - 0.022, um, M.recv, 0.94, 20); b.ball(1, [f1 - 0.014, um, 0], M.recv, [0.022, hh * 0.94, hw * 0.94], 14);
      for (const s of [-1, 1]) { const x = s * (hw + 0.0012), P = []; for (let i = 0; i < 6; i++) P.push([f0 + 0.016 + i * (L - 0.04) / 5 + (kr(i + (s > 0 ? 40 : 50)) - 0.5) * 0.01, um + (kr(i + (s > 0 ? 60 : 70)) - 0.5) * hh * 1.2]);
        for (let i = 0; i < 5; i++) b.rod([P[i][0], P[i][1], x], [P[i + 1][0], P[i + 1][1], x], 0.0008, 0.0008, M.line, 4);
        P.forEach(([f, uu], i) => b.gem(i % 2 ? 0.0024 : 0.0036, [f, uu, x + s * 0.001], M.star, [1, 1, 0.6])); }
      const RR = Math.max(hw, hh) + 0.012, prev = b.cur;
      if (prev === '') b.part('spin' + ++spinN, [fm, um, b.shift], 1.2);
      b.tor(RR, 0.0016, [fm, um, 0], M.line, 0.35, 0, 6.2832, 32); for (let i = 0; i < 3; i++) { const a = i * 2.094; b.gem(0.003, [fm + Math.sin(a) * RR * 0.34, um + Math.cos(a) * RR * 0.94, Math.sin(a) * RR * 0.94], M.star); }
      if (prev === '') b.part('spin' + ++spinN, [fm, um, b.shift], -0.8);
      b.tor(RR + 0.006, 0.0012, [fm + L * 0.2, um, 0], M.line, -0.4, 0, 6.2832, 32); b.gem(0.0034, [fm + L * 0.2, um - RR - 0.006, 0], M.star);
      b.cur = prev;
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2, cx = end + L * 0.45, rr = Math.min(0.03, (top - bot) * 0.36), star = [];
      for (let i = 0; i < 10; i++) { const a = -1.5708 + (i * Math.PI) / 5, q = i % 2 ? 0.45 : 1; star.push([cx + Math.cos(a) * rr * q, um + Math.sin(a) * rr * q]); }
      b.prof([[f, top], [end + 0.02, top], [end, top - 0.016], [end, bot + 0.01], [end + 0.024, bot], [f - L * 0.5, j0 - 0.012], [f, j0]], w * 0.8, M.recv, 0.004, 0, { r: 0.008, holes: [star] });
      b.prof(star, w * 0.3, M.star, 0);
      buttPad(b, end, um, top - bot - 0.026, M, w * 0.8);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 1.1, r * 1.1, f, len * 0.3, u, M.bolt, 0, 14); b.cyl(r * 0.6, r * 0.6, f, len * 0.7, u, M.steel, 0, 10); b.disc(r * 0.4, f + len * 0.702, u, M.dark);
      b.radial(4, () => new THREE.ConeGeometry(r * 0.28, r * 2.2, 4).translate(0, r * 1.7, 0), f + len * 0.62, u, M.star, 0.785);
      b.ball(r * 0.5, [f + len * 0.62, u + r * 0.001, 0], M.star, [0.5, 1, 1], 8);
      const prev = b.cur; if (prev === '') b.part('spin' + ++spinN, [f + len * 0.62, u, b.shift], 2);
      b.tor(r * 2.1, r * 0.08, [f + len * 0.62, u, 0], M.line, 0, 0, 6.2832, 24); b.gem(r * 0.25, [f + len * 0.62, u + r * 2.1, 0], M.star); b.cur = prev;
      return f + len * 0.72;
    },
    orn(b, M, R) {
      const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1;
      for (const s of [-1, 1]) { const x = s * (hw + 0.001), P = [[f0 + L * 0.15, u + 0.008 * k], [f0 + L * 0.3, u - 0.004 * k], [f0 + L * 0.45, u + 0.01 * k], [f0 + L * 0.6, u]]; for (let i = 0; i < 3; i++) b.rod([P[i][0], P[i][1], x], [P[i + 1][0], P[i + 1][1], x], 0.0007, 0.0007, M.line, 4); P.forEach(([f, uu], i) => b.gem(i === 2 ? 0.0034 * k + 0.001 : 0.0022 * k + 0.001, [f, uu, x + s * 0.001], M.star, [1, 1, 0.6])); }
    },
    blade(b, M) {
      b.prof([[0.03, -0.014], [0.21, -0.014], [0.262, 0.004], [0.21, 0.02], [0.03, 0.02]], 0.005, M.recv, 0.002);
      const P = [[0.06, 0.004], [0.1, 0.012], [0.14, -0.004], [0.18, 0.008], [0.22, 0.003]];
      for (const s of [-1, 1]) { for (let i = 0; i < 4; i++) b.rod([P[i][0], P[i][1], s * 0.0028], [P[i + 1][0], P[i + 1][1], s * 0.0028], 0.0006, 0.0006, M.line, 4); P.forEach(([f, uu]) => b.gem(0.0024, [f, uu, s * 0.003], M.star, [1, 1, 0.6])); }
    },
  },
  // 다크 매터 보이드 — 우리 안에 떠 있는 검은 구슬과 도는 빛 고리, 블랙홀 총구
  darkmatter: {
    fx: { tracer: 0xb05cff, flash: 0xd08aff, sfx: 'void', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, k = Math.min(1, L / 0.2), fm = f0 + L * 0.52, ro = Math.min(hh, hw * 1.4, L * 0.22) * 0.95;
      for (const s of [-1, 1]) b.prof([[f0, um + s * hh], [f1 - 0.01, um + s * hh * 0.85], [f1 + 0.01 * k, um + s * hh * 0.3], [f1 - 0.004, um + s * hh * 0.25], [f1 - 0.016, um + s * (hh - 0.007)], [f0, um + s * (hh - 0.007)]], w * 0.8, M.recv, 0.002);
      for (const df of [-L * 0.36, L * 0.34]) for (const s of [-1, 1]) b.rod([fm + df, um - hh + 0.004, s * hw * 0.7], [fm + df + 0.012 * k, um + hh - 0.004, s * hw * 0.7], 0.0022, 0.0022, M.recv, 6);
      b.ecyl(hw * 0.95, hh * 0.9, f0, 0.012, um, M.recv, 1, 14); b.ecyl(hw * 0.9, hh * 0.85, f1 - 0.016, 0.014, um, M.recv, 1, 14);
      b.cyl(0.004, 0.004, f0, L, um, M.steel, 0, 8);
      b.ball(ro, [fm, um, 0], M.voidm, [1, 1, 1], 18); b.ball(ro * 1.08, [fm, um, 0], M.halo, [1, 1, 1], 18);
      const prev = b.cur;
      if (prev === '') b.part('spin' + ++spinN, [fm, um, b.shift], 2.6);
      b.tor(ro * 1.5, 0.0015, [fm, um, 0], M.disk, 0.5, 0, 6.2832, 28); for (let i = 0; i < 3; i++) { const a = i * 2.094; b.ball(0.0024, [fm + Math.sin(a) * ro * 0.7, um + Math.cos(a) * ro * 1.3, Math.sin(a) * ro * 1.3], M.rim, [1, 1, 1], 6); }
      b.cur = prev;
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2, rr = Math.min(0.032, (top - bot) * 0.42), cx = end + rr + 0.012;
      b.prof([[f, top], [cx + rr * 0.6, top - 0.002], [cx + rr * 0.6, top - 0.012], [f - 0.02, top - 0.014], [f - 0.02, j0 + 0.01], [cx + rr * 0.8, um - 0.006], [cx + rr * 0.8, um - 0.018], [f, j0]], w * 0.7, M.recv, 0.003);
      b.tor(rr, 0.0055, [cx, um, 0], M.recv, 0, Math.PI / 2, 6.2832, 28); b.tor(rr - 0.006, 0.0015, [cx, um, 0], M.rim, 0, Math.PI / 2, 6.2832, 28);
      b.ball(rr * 0.42, [cx, um, 0], M.voidm, [1, 1, 1], 14); b.ball(rr * 0.47, [cx, um, 0], M.halo, [1, 1, 1], 14);
      b.prof([[end + 0.002, um - rr * 0.8], [end + 0.002, um + rr * 0.8], [end - 0.008, um + rr * 0.6], [end - 0.008, um - rr * 0.6]], w * 0.9, M.rubber, 0.003);
    },
    muzzle(b, M, f, u, r, len) {
      b.cyl(r * 0.6, r * 0.6, f, len * 0.4, u, M.steel, 0, 10);
      for (const a of [0, 2.094, 4.189]) b.rod([f + len * 0.05, u + Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7], [f + len * 0.55, u + Math.cos(a) * r * 1.9, Math.sin(a) * r * 1.9], r * 0.18, r * 0.1, M.recv, 5);
      b.ball(r * 1.15, [f + len * 0.75, u, 0], M.voidm, [1, 1, 1], 14); b.ball(r * 1.24, [f + len * 0.75, u, 0], M.halo, [1, 1, 1], 14);
      const prev = b.cur; if (prev === '') b.part('spin' + ++spinN, [f + len * 0.75, u, b.shift], 3.5);
      for (let i = 0; i < 3; i++) b.tor(r * (1.7 + i * 0.35), r * 0.06, [f + len * 0.75, u, 0], M.disk, 0, 0, 6.2832, 24);
      b.ball(r * 0.18, [f + len * 0.75, u + r * 2.05, 0], M.rim, [1, 1, 1], 6); b.ball(r * 0.14, [f + len * 0.75, u - r * 1.7, 0], M.rim, [1, 1, 1], 6); b.cur = prev;
      return f + len * 0.9;
    },
    orn(b, M, R) {
      const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1;
      for (const s of [-1, 1]) { const x = s * (hw + 0.003 * k), f = f0 + L * 0.25; b.ball(0.008 * k, [f, u + 0.003 * k, x], M.voidm, [1, 1, 0.6], 10); b.tor(0.0105 * k, 0.0012, [f, u + 0.003 * k, x], M.rim, 0, Math.PI / 2, 6.2832, 20); b.box(0.0012, 0.0018, L * 0.42, f0 + L * 0.64, u - 0.004 * k, M.rim, s * (hw + 0.0007)); }
    },
    blade(b, M) {
      const out = [[0.03, -0.015], [0.12, -0.02], [0.2, -0.014], [0.262, 0.006], [0.2, 0.02], [0.12, 0.026], [0.03, 0.02]];
      b.prof(out, 0.006, M.voidm, 0.0022); b.prof(out.map(([f, uu]) => [f + (f > 0.25 ? 0.005 : 0), uu * 1.14]), 0.0026, M.rim, 0);
      for (const s of [-1, 1]) b.rod([0.05, 0.003, s * 0.0031], [0.24, 0.005, s * 0.0031], 0.0009, 0.0009, M.rim, 4);
      b.ball(0.008, [0.05, 0.003, 0], M.voidm, [1, 1, 1], 10); b.ball(0.009, [0.05, 0.003, 0], M.halo, [1, 1, 1], 10);
    },
  },
};
// ───────────── 레전드 스킨 4종: 실루엣을 깨는 장갑판·날개·가시, 겹겹의 재질, 빛나는 에너지 선 ─────────────
const both = (fn) => { fn(-1); fn(1); };
// 겉면 무늬
const LPAT = {
  crimson: (g, s) => { // 흰 장갑판: 패널 선, 작은 표기, 빨간 줄
    g.fillStyle = '#ecebe7'; g.fillRect(0, 0, s, s);
    wrap(g, s, () => {
      for (let i = 0; i < 14; i++) { const x = kr(i + 2000) * s, y = kr(i + 2100) * s, w = 40 + kr(i + 2200) * 120, h = 20 + kr(i + 2300) * 60; g.strokeStyle = 'rgba(60,62,68,.55)'; g.lineWidth = 1.4; g.strokeRect(x, y, w, h); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.8; g.strokeRect(x + 1.2, y + 1.2, w, h); }
      for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(40,42,48,.5)'; g.fillRect(kr(i + 2400) * s, kr(i + 2500) * s, 6 + kr(i + 2600) * 14, 1.6); }
      for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(70,72,78,.6)'; dot(g, kr(i + 2700) * s, kr(i + 2800) * s, 1.6); }
    });
    g.fillStyle = '#c8121c'; g.fillRect(0, s * 0.62, s, 14); g.fillStyle = '#1a1b1f'; g.fillRect(0, s * 0.62 + 16, s, 3);
    g.fillStyle = '#c8121c'; for (let x = 0; x < s; x += 64) { g.beginPath(); g.moveTo(x, s * 0.2); g.lineTo(x + 18, s * 0.2); g.lineTo(x + 30, s * 0.2 + 12); g.lineTo(x + 12, s * 0.2 + 12); g.closePath(); g.fill(); }
  },
  dragon: (g, s, em) => { // 용 비늘: 겹친 반달 비늘, 틈에서 붉은 빛
    g.fillStyle = em ? '#000' : '#0b0a0c'; g.fillRect(0, 0, s, s);
    const R = 22, rows = Math.round(s / (R * 0.9));
    for (let row = -1; row <= rows + 1; row++) for (let i = -1; i <= s / (R * 2) + 1; i++) {
      const x = i * R * 2 + (row % 2 ? R : 0), y = row * R * 0.9;
      if (em) { if (kr(row * 37 + i) > 0.82) { g.strokeStyle = 'rgba(255,50,20,.95)'; g.lineWidth = 2.2; g.shadowColor = '#ff3010'; g.shadowBlur = 6 * PQ; g.beginPath(); g.arc(x, y, R, 0.15, Math.PI - 0.15); g.stroke(); g.shadowBlur = 0; } continue; }
      const gr = g.createRadialGradient(x, y - R * 0.3, 2, x, y, R); gr.addColorStop(0, '#2c2830'); gr.addColorStop(0.7, '#141216'); gr.addColorStop(1, '#050405'); g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, R, 0, Math.PI); g.closePath(); g.fill(); g.strokeStyle = 'rgba(120,40,30,.55)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, R - 1, 0.1, Math.PI - 0.1); g.stroke();
    }
  },
  aqua: (g, s) => { // 흰 바탕에 파란 사선 판과 육각 선
    g.fillStyle = '#eef2f6'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#1f5fe0'; for (let i = -2; i < 6; i++) { const x = i * 128; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 50, 0); g.lineTo(x + 50 + s * 0.4, s); g.lineTo(x + s * 0.4, s); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(30,60,120,.35)'; g.lineWidth = 1;
    for (let y = 0, r = 0; y < s + 30; y += 26, r++) for (let x = r % 2 ? 15 : 0; x < s + 30; x += 30) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * 1.0472 + 0.5236; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 15, y + Math.sin(a) * 15); } g.closePath(); g.stroke(); }
    g.fillStyle = '#0d1a33'; g.fillRect(0, s * 0.48, s, 4); g.fillStyle = '#4ae8ff'; g.fillRect(0, s * 0.48 + 6, s, 2);
  },
};
Object.assign(SKIN_DEF, {
  crimson: () => { const c = pcan(LPAT.crimson, 5), sw = sweepTex(); return { body: { wear: 0.2, wearCol: 0xffffff, color: 0xc4c6ca, map: texOf(c, true), normalMap: nrm(c, 0.4), metalness: 0.15, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0xffe0c0, emissiveMap: sw, emissiveIntensity: 0.3 }, grip: { color: 0x1a1b1f, roughness: 0.6 }, metal: { color: 0x1c1d22, metalness: 0.95, roughness: 0.22 }, bolt: { color: 0xd8dde4, metalness: 1, roughness: 0.12 }, accent: { color: 0xd0141e }, envI: 1.3, anim: sweepAnim(sw, 0.02, 0.14) }; },
  dragon: () => { const c = pcan((g, s) => LPAT.dragon(g, s, false), 4), em = texOf(pcan((g, s) => LPAT.dragon(g, s, true), 0), true); return { body: { wear: 0, color: 0xffffff, map: texOf(c, true), normalMap: nrm(c, 1.4), metalness: 0.6, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: 1.2 }, grip: { color: 0x0c0a0c, roughness: 0.6 }, metal: { color: 0x141012, metalness: 1, roughness: 0.2 }, bolt: { color: 0xff3a20, metalness: 0.6, roughness: 0.3, emissive: 0xc01000, emissiveIntensity: 0.8 }, accent: { color: 0xff3020, emissive: 0xff2010, emissiveIntensity: 1.2 }, envI: 1.7, anim: (m, t) => { m.body.emissiveIntensity = 0.9 + Math.sin(t * 2.6) * 0.45 + Math.sin(t * 7.1) * 0.1; } }; },
  phoenix: () => { const c = pcan(PAT.gold, 6), sw = sweepTex(0.05); return { body: { wear: 0.3, wearCol: 0xfff2c0, color: 0xffe2b0, map: texOf(c, true), normalMap: nrm(c, 1.5), metalness: 1, roughness: 0.2, roughnessMap: smudge(), clearcoat: 0.8, clearcoatRoughness: 0.08, emissive: 0xffc070, emissiveMap: sw, emissiveIntensity: 0.4 }, grip: { color: 0x2a1408, metalness: 0.2, roughness: 0.6 }, metal: { color: 0xe8b050, metalness: 1, roughness: 0.16 }, bolt: { color: 0xfff0c0, metalness: 1, roughness: 0.08 }, accent: { color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 1 }, envI: 1.6, anim: sweepAnim(sw, 0.04, 0.2) }; },
  aqua: () => { const c = pcan(LPAT.aqua, 5), sw = sweepTex(); return { body: { wear: 0.25, wearCol: 0xffffff, color: 0xc4c8ce, map: texOf(c, true), normalMap: nrm(c, 0.35), metalness: 0.2, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08, emissive: 0xc0f4ff, emissiveMap: sw, emissiveIntensity: 0.3 }, grip: { color: 0x141c2c, roughness: 0.55 }, metal: { color: 0x1a2a4a, metalness: 0.95, roughness: 0.2 }, bolt: { color: 0xe0ecff, metalness: 1, roughness: 0.1 }, accent: { color: 0x4ae8ff, emissive: 0x2ad0ff, emissiveIntensity: 1 }, envI: 1.3, anim: sweepAnim(sw, 0.02, 0.14) }; },
});
Object.assign(KMATS, {
  crimson: () => ({ armor: { color: 0xc8c8c4, metalness: 0.15, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 }, trim: { color: 0xd0141e, metalness: 0.35, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }, frame: { color: 0x1a1b1f, metalness: 0.85, roughness: 0.3 }, glow: { color: 0xffb070, emissive: 0xff5a08, emissiveIntensity: 2.8, roughness: 0.4 } }),
  dragon: () => ({ scale: { color: 0x141116, metalness: 0.7, roughness: 0.16, flatShading: true }, horn: { color: 0x1a1518, metalness: 0.55, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 }, fang: { color: 0xece4d2, metalness: 0.1, roughness: 0.3 }, glow: { color: 0xff6040, emissive: 0xff1a08, emissiveIntensity: 3, roughness: 0.4 } }),
  phoenix: () => ({ trim: { color: 0xffd98a, metalness: 1, roughness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.06 }, feather: { color: 0xffb040, metalness: 0.9, roughness: 0.18, emissive: 0x803000, emissiveIntensity: 0.6 }, glow: { color: 0xffd080, emissive: 0xff6a00, emissiveIntensity: 2.8, roughness: 0.4 }, gem: { color: 0xff3020, metalness: 0.3, roughness: 0.04, emissive: 0xc01000, emissiveIntensity: 1.4, flatShading: true } }),
  aqua: () => ({ armor: { color: 0xc6cad0, metalness: 0.2, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 }, trim: { color: 0x1f5fe0, metalness: 0.45, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }, frame: { color: 0x141c2c, metalness: 0.9, roughness: 0.25 }, glow: { color: 0xa8f4ff, emissive: 0x2ad8ff, emissiveIntensity: 2.6, roughness: 0.3 } }),
});
Object.assign(KITS, {
  // 크림슨 메카 — 마디진 흰 장갑판 사이로 주황 코어가 빛남, 빨간 칼날 지느러미
  crimson: {
    fx: { tracer: 0xff6a1a, flash: 0xffa050, sfx: 'mecha', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, k = Math.min(1, L / 0.2);
      b.ecyl(hw * 0.9, hh * 0.86, f0, L, um, M.glow, 1, 12);
      both((s) => b.box(0.004, hh * 0.7, L * 0.98, f0 + L / 2, u0 + hh * 0.35, M.frame, s * (hw - 0.001)));
      b.box(w * 0.86, 0.005, L, f0 + L / 2, u0 + 0.004, M.frame); b.box(w * 0.86, 0.005, L, f0 + L / 2, u1 - 0.003, M.frame);
      const n = Math.max(2, Math.round(L / 0.065)), sl = L / n;
      for (let i = 0; i < n; i++) { const a = f0 + i * sl + 0.006, c = a + sl - 0.014;
        both((s) => { const x = s * (hw - 0.0015); b.prof([[a, um - hh * 0.25], [a + 0.006, u1], [c - 0.002, u1], [c + 0.006, um + hh * 0.2], [c, um - hh * 0.25]], 0.006, M.armor, 0.0015, x);
          b.box(0.0015, 0.0034, (c - a) * 0.62, (a + c) / 2, um - hh * 0.36, M.trim, s * (hw + 0.0024)); b.box(0.0012, 0.0018, (c - a) * 0.45, (a + c) / 2 + 0.002, um + hh * 0.36, M.glow, s * (hw + 0.0024)); }); }
      b.box(w * 0.92, 0.006, L * 0.96, f0 + L / 2, u1 + 0.002, M.armor);
      b.prof([[f0 + L * 0.12, u1 + 0.004], [f0 + L * 0.6, u1 + 0.004], [f0 + L * 0.3, u1 + 0.034 * k], [f0 + L * 0.02, u1 + 0.04 * k]], 0.0042, M.trim, 0.001);
      b.prof([[f0 + L * 0.14, u1 + 0.006], [f0 + L * 0.5, u1 + 0.006], [f0 + L * 0.28, u1 + 0.026 * k]], 0.0048, M.glow, 0);
      b.prof([[f1 - 0.006, u0], [f0 + L * 0.35, u0], [f0 + L * 0.5, u0 - 0.024 * k], [f1 + 0.03 * k, u0 - 0.016 * k]], 0.005, M.armor, 0.0012);
      b.prof([[f0 + L * 0.5, u0 - 0.024 * k], [f1 + 0.03 * k, u0 - 0.016 * k], [f1 + 0.026 * k, u0 - 0.02 * k], [f0 + L * 0.52, u0 - 0.027 * k]], 0.0056, M.trim, 0);
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      const out = [[f, top], [f - L * 0.3, top + 0.008], [end + 0.02, top + 0.012], [end - 0.01, top + 0.022], [end, top - 0.01], [end, bot + 0.01], [end + 0.02, bot], [f - L * 0.45, j0 - 0.016], [f, j0]];
      b.prof(out, w, M.armor, 0.004, 0, { holes: [[[f - 0.04, um - 0.004], [end + 0.045, um - 0.004], [end + 0.03, bot + 0.014], [f - L * 0.45, j0 - 0.006]]] });
      b.prof([[f - 0.015, top - 0.004], [end + 0.025, top + 0.002], [end + 0.02, um + 0.003], [f - 0.03, um + 0.003]], w + 0.003, M.trim, 0.001);
      b.box(w + 0.005, 0.0022, L * 0.45, f - L * 0.42, (top + um) / 2 + 0.002, M.glow);
      b.prof([[f - 0.02, um - 0.002], [end + 0.03, um - 0.002], [end + 0.012, bot + 0.01], [end + 0.022, bot], [f - L * 0.45, j0 - 0.016], [f - 0.02, j0]], w + 0.0024, M.frame, 0.001, 0, { holes: [[[f - 0.04, um - 0.006], [end + 0.045, um - 0.006], [end + 0.03, bot + 0.014], [f - L * 0.45, j0 - 0.008]]] });
      both((s) => { b.rod([f - 0.02, um - 0.003, s * (w / 2 + 0.0016)], [end + 0.03, um - 0.003, s * (w / 2 + 0.0016)], 0.0012, 0.0012, M.glow, 4); for (let i = 0; i < 3; i++) b.box(0.0012, 0.003, 0.012, end + 0.05 + i * 0.016, top - 0.006, M.frame, s * (w / 2 + 0.0018)); });
      b.prof([[end + 0.034, top + 0.01], [end - 0.014, top + 0.034], [end - 0.004, top + 0.008]], 0.0042, M.trim, 0.001);
      b.prof([[end + 0.04, bot + 0.004], [end - 0.008, bot - 0.02], [end + 0.006, bot + 0.012]], 0.0042, M.armor, 0.001);
      buttPad(b, end, um, top - bot - 0.02, M, w);
    },
    muzzle(b, M, f, u, r, len) {
      b.prof([[f, u - r * 1.4], [f, u + r * 1.5], [f + len * 0.6, u + r * 1.6], [f + len * 1.05, u + r * 0.6], [f + len * 1.05, u - r * 0.7], [f + len * 0.6, u - r * 1.5]], r * 2.6, M.armor, 0.002);
      b.box(r * 2.7, r * 2.0, len * 0.12, f + len * 0.92, u, M.trim);
      both((s) => { for (let i = 0; i < 3; i++) b.box(0.0012, r * 0.42, len * 0.1, f + len * (0.18 + i * 0.2), u + r * 0.3, M.glow, s * (r * 1.3 + 0.0006)); });
      b.prof([[f + len * 0.3, u + r * 1.5], [f + len * 1.3, u + r * 1.15], [f + len * 0.75, u + r * 2.0]], r * 0.6, M.trim, 0);
      b.prof([[f + len * 0.2, u - r * 1.4], [f + len * 1.2, u - r * 1.0], [f + len * 0.6, u - r * 1.9]], r * 0.6, M.armor, 0);
      b.disc(r * 0.55, f + len * 1.05 + 0.0005, u, M.dark); b.tor(r * 0.75, r * 0.1, [f + len * 1.05, u, 0], M.glow, 0, 0, 6.2832, 16);
      return f + len * 1.05;
    },
    orn(b, M, R) {
      const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1;
      both((s) => { const x = s * (hw + 0.0016); b.prof([[f0 + L * 0.08, u - 0.017 * k], [f0 + L * 0.08, u + 0.014 * k], [f0 + L * 0.5, u + 0.019 * k], [f0 + L * 0.78, u + 0.008 * k], [f0 + L * 0.72, u - 0.017 * k]], 0.003, M.armor, 0.001, x);
        b.prof([[f0 + L * 0.2, u - 0.006 * k], [f0 + L * 0.42, u + 0.008 * k], [f0 + L * 0.46, u + 0.008 * k], [f0 + L * 0.26, u - 0.006 * k]], 0.003, M.trim, 0, x + s * 0.0016);
        b.box(0.0012, 0.003 * k, L * 0.25, f0 + L * 0.58, u + 0.002, M.glow, x + s * 0.0016);
        b.prof([[f0 + L * 0.5, u - 0.017 * k], [f0 + L * 0.95, u - 0.017 * k], [f0 + L * 0.9, u - 0.002 * k], [f0 + L * 0.56, u - 0.002 * k]], 0.003, M.frame, 0.0008, x);
        b.box(0.0012, 0.0016, L * 0.3, f0 + L * 0.73, u - 0.007 * k, M.glow, x + s * 0.0017); });
    },
    blade(b, M) {
      b.prof([[0.03, -0.016], [0.19, -0.016], [0.258, 0.004], [0.23, 0.022], [0.03, 0.022]], 0.0055, M.armor, 0.0016);
      b.prof([[0.035, -0.0168], [0.19, -0.0168], [0.257, 0.0035], [0.19, -0.011], [0.035, -0.011]], 0.006, M.trim, 0.0004);
      both((s) => b.box(0.0012, 0.0024, 0.14, 0.12, 0.012, M.glow, s * 0.003));
    },
  },
  // 흑룡 — 검은 비늘, 붉은 핏줄, 등가시와 칼날 날개, 입을 벌린 용 머리 총구, 꼬리 개머리판
  dragon: {
    fx: { tracer: 0xff2a1a, flash: 0xff6a40, sfx: 'dragon', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, k = Math.min(1, L / 0.2);
      b.ecyl(hw * 0.96, hh, f0, L, um, M.recv, 0.9, 10);
      const n = Math.max(3, Math.round(L / 0.03));
      for (let i = 0; i < n; i++) { const f = f0 + 0.012 + (i * (L - 0.024)) / (n - 1); both((s) => { for (let r = 0; r < 2; r++) b.gem(0.0085 * Math.min(1, hh / 0.035) + 0.002, [f + (r ? 0.012 : 0), um + (r ? -0.35 : 0.3) * hh, s * hw * 0.92], M.scale, [1.7, 1, 0.45]); }); }
      both((s) => { const x = s * (hw + 0.0035), P = []; for (let i = 0; i <= 6; i++) P.push([f0 + 0.008 + (i * (L - 0.016)) / 6, um + (i % 2 ? 0.05 : -0.1) * hh]); for (let i = 0; i < 6; i++) b.rod([P[i][0], P[i][1], x], [P[i + 1][0], P[i + 1][1], x], 0.0012, 0.0012, M.glow, 4); });
      const ns = Math.max(3, Math.round(L / 0.045));
      for (let i = 0; i < ns; i++) { const f = f0 + 0.02 + (i * (L - 0.03)) / (ns - 1), hgt = (0.02 + (i % 2) * 0.012) * k; b.spike([f, u1 - 0.004, 0], [f - 0.022 * k, u1 + hgt, 0], 0.0055 * k + 0.0015, M.horn, 5); }
      both((s) => { b.prof([[f1, um + hh * 0.2], [f0 + L * 0.55, um + hh * 1.3], [f0 + L * 0.1, um + hh * 2.1], [f0 + L * 0.3, um + hh * 1.05], [f0 + L * 0.2, um + hh * 0.5]], 0.003, M.horn, 0.0008, s * (hw + 0.006));
        b.prof([[f1 - L * 0.1, um - hh * 0.3], [f0 + L * 0.5, um - hh * 1.4], [f0 + L * 0.2, um - hh * 1.9], [f0 + L * 0.35, um - hh * 0.9]], 0.003, M.horn, 0.0008, s * (hw + 0.006));
        b.rod([f1 - 0.01, um + hh * 0.25, s * (hw + 0.0078)], [f0 + L * 0.12, um + hh * 1.95, s * (hw + 0.0078)], 0.0009, 0.0009, M.glow, 4); });
    },
    stock(b, M, R) { // 꼬리
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      b.prof([[f, top], [end + 0.02, top - 0.004], [end - 0.03, um + 0.01], [end - 0.034, um - 0.004], [end + 0.01, bot + 0.006], [end + 0.03, bot], [f - L * 0.45, j0 - 0.016], [f, j0]], w, M.recv, 0.004, 0, { holes: [[[f - 0.035, top - 0.012], [end + 0.05, top - 0.014], [end + 0.03, um], [f - L * 0.45, j0 - 0.006], [f - 0.035, j0 + 0.004]]] });
      for (let i = 0; i < 5; i++) { const ff = f - 0.02 - i * (L / 5.5); b.spike([ff, top - 0.002, 0], [ff - 0.02, top + 0.016 + (i % 2) * 0.01, 0], 0.005, M.horn, 5); }
      for (let i = 0; i < 2; i++) b.spike([end + 0.03 + i * 0.03, bot + 0.004, 0], [end + 0.01 + i * 0.03, bot - 0.022, 0], 0.005, M.horn, 5);
      b.spike([end - 0.03, um + 0.004, 0], [end - 0.07, um + 0.012, 0], 0.008, M.horn, 5);
      both((s) => b.rod([f - 0.01, um + 0.002, s * (w / 2 + 0.0008)], [end - 0.02, um + 0.006, s * (w / 2 + 0.0008)], 0.001, 0.001, M.glow, 4));
    },
    muzzle(b, M, f, u, r, len) { // 용 머리
      b.cyl(r * 0.7, r * 0.7, f, len * 0.9, u, M.steel, 0, 10);
      b.prof([[f, u + r * 0.5], [f, u + r * 2.0], [f + len * 0.55, u + r * 2.3], [f + len * 1.45, u + r * 0.9], [f + len * 1.15, u + r * 0.45]], r * 2.3, M.recv, r * 0.25);
      b.prof([[f, u - r * 0.5], [f, u - r * 1.8], [f + len * 1.25, u - r * 1.3], [f + len * 0.95, u - r * 0.5]], r * 1.9, M.recv, r * 0.2);
      for (let i = 0; i < 4; i++) { const ff = f + len * (0.45 + i * 0.22); both((s) => { b.spike([ff, u + r * 0.6, s * r * 0.75], [ff + len * 0.04, u - r * 0.15, s * r * 0.75], r * 0.15, M.fang, 4); if (i < 3) b.spike([ff, u - r * 0.6, s * r * 0.65], [ff + len * 0.04, u + r * 0.1, s * r * 0.65], r * 0.13, M.fang, 4); }); }
      both((s) => { b.ball(r * 0.26, [f + len * 0.42, u + r * 1.65, s * r * 1.12], M.glow, [1.4, 0.7, 0.6], 8); b.spike([f + len * 0.25, u + r * 2.0, s * r * 0.6], [f - len * 0.7, u + r * 3.4, s * r * 1.1], r * 0.32, M.horn, 5); b.spike([f + len * 0.6, u - r * 1.6, s * r * 0.7], [f + len * 0.1, u - r * 2.6, s * r * 1.1], r * 0.22, M.horn, 5); });
      b.disc(r * 0.9, f + len * 0.9, u, M.glow);
      return f + len * 1.0;
    },
    orn(b, M, R) {
      const { f0, f1, u, top, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1;
      both((s) => { for (let i = 0; i < 4; i++) b.gem(0.006 * k, [f0 + L * (0.2 + i * 0.08), u + 0.004 * k, s * (hw + 0.0012)], M.scale, [1.7, 1, 0.45]); b.rod([f0 + L * 0.15, u - 0.006 * k, s * (hw + 0.002)], [f0 + L * 0.6, u - 0.002 * k, s * (hw + 0.002)], 0.0009, 0.0009, M.glow, 4); b.spike([f0 + L * 0.6, u + 0.004 * k, s * hw], [f0 + L * 0.48, Math.min(top + 0.016 * k, u + 0.03 * k), s * (hw + 0.008 * k)], 0.004 * k + 0.001, M.horn, 5); });
    },
    blade(b, M) { // 톱니 용 이빨 칼
      const out = [[0.03, -0.016], [0.07, -0.02], [0.09, -0.014], [0.12, -0.022], [0.15, -0.015], [0.18, -0.024], [0.21, -0.014], [0.265, 0.006], [0.2, 0.02], [0.12, 0.024], [0.03, 0.022]];
      b.prof(out, 0.006, M.horn, 0.0022);
      both((s) => { for (let i = 0; i < 4; i++) b.rod([0.05 + i * 0.05, -0.004, s * 0.0031], [0.1 + i * 0.05, 0.002 - (i % 2) * 0.006, s * 0.0031], 0.0009, 0.0009, M.glow, 4); });
      for (let i = 0; i < 3; i++) b.spike([0.06 + i * 0.05, 0.02, 0], [0.04 + i * 0.05, 0.036, 0], 0.004, M.horn, 4);
    },
  },
  // 황금 불사조 — 겹겹의 금빛 깃털 날개, 불꽃 코어, 부리 총구, 꼬리깃 개머리판
  phoenix: {
    fx: { tracer: 0xffb040, flash: 0xffd080, sfx: 'phoenix', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, k = Math.min(1, L / 0.2);
      b.ecyl(hw, hh, f0, L, um, M.recv, 0.88, 14);
      for (const f of [f0 + 0.004, f1 - 0.012]) b.ecyl(hw * 1.06, hh * 1.06, f, 0.008, um, M.trim, 1, 14);
      both((s) => { const x = s * (hw + 0.0012), fc = f0 + L * 0.62, P = [], Q = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.2832; P.push([fc + Math.cos(a) * L * 0.14, um + Math.sin(a) * hh * 0.62]); Q.push([fc + Math.cos(a) * L * 0.17, um + Math.sin(a) * hh * 0.78]); }
        b.prof(Q, 0.002, M.trim, 0, x); b.prof(P, 0.0024, M.glow, 0, x + s * 0.0004); b.gem(0.005 * k + 0.002, [fc, um, x + s * 0.002], M.gem, [1, 1, 0.6]);
        const fan = (fp, up, angs, lens, dir) => angs.forEach((ang, i) => { const len = lens[i] * k, dx = -Math.cos(ang), dy = Math.sin(ang) * dir, nx = Math.sin(ang), ny = Math.cos(ang) * dir, wd = 0.012 * k + 0.003, bf = fp - i * 0.007, bu = up;
          const tipF = bf + dx * len, tipU = bu + dy * len;
          b.prof([[bf, bu], [bf + dx * len * 0.45 + nx * wd, bu + dy * len * 0.45 - ny * wd], [tipF, tipU], [bf + dx * len * 0.55 - nx * wd * 0.5, bu + dy * len * 0.55 + ny * wd * 0.5]], 0.0026, i % 2 ? M.feather : M.trim, 0.0007, s * (hw + 0.004 + i * 0.002));
          b.rod([bf + dx * len * 0.08, bu + dy * len * 0.08, s * (hw + 0.0055 + i * 0.002)], [bf + dx * len * 0.82, bu + dy * len * 0.82, s * (hw + 0.0055 + i * 0.002)], 0.0008, 0.0006, M.glow, 4); });
        fan(f0 + L * 0.42, u1 - 0.004, [0.3, 0.5, 0.72, 0.95, 1.18], [L * 0.62, L * 0.74, L * 0.8, L * 0.72, L * 0.58], 1);
        fan(f0 + L * 0.38, u0 + 0.004, [0.35, 0.6, 0.85], [L * 0.36, L * 0.4, L * 0.32], -1); });
      b.box(w * 0.5, 0.003, L * 0.8, f0 + L / 2, u1 + 0.001, M.glow);
    },
    stock(b, M, R) { // 부채꼴 꼬리깃
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      b.prof([[f, top], [end + 0.05, top], [end + 0.03, um], [end + 0.05, bot + 0.01], [f - L * 0.45, j0 - 0.012], [f, j0]], w * 0.8, M.recv, 0.004);
      for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3, l = L * (0.55 + (2 - Math.abs(i - 2)) * 0.1), cx = end + 0.05, cy = um, tx = cx - Math.cos(a) * l, ty = cy + Math.sin(a) * l, nx = -Math.sin(a) * 0.009, ny = -Math.cos(a) * 0.009;
        b.prof([[cx, cy + 0.004], [cx - Math.cos(a) * l * 0.5 - nx, cy + Math.sin(a) * l * 0.5 + ny], [tx, ty], [cx - Math.cos(a) * l * 0.5 + nx, cy + Math.sin(a) * l * 0.5 - ny], [cx, cy - 0.004]], w * (i % 2 ? 0.5 : 0.7), i % 2 ? M.feather : M.trim, 0.001);
        b.ball(0.0028, [tx + Math.cos(a) * 0.006, ty - Math.sin(a) * 0.006, 0], M.glow, [1, 1, 1], 6); }
      b.gem(0.008, [end + 0.05, um, w * 0.42], M.gem, [1, 1, 0.6]); b.gem(0.008, [end + 0.05, um, -w * 0.42], M.gem, [1, 1, 0.6]);
    },
    muzzle(b, M, f, u, r, len) { // 불꽃 부리
      b.cyl(r * 1.2, r * 1.0, f, len * 0.3, u, M.trim, 0, 14); b.cyl(r * 0.6, r * 0.6, f, len * 0.7, u, M.steel, 0, 10);
      b.radial(5, () => new THREE.ConeGeometry(r * 0.36, len * 0.9, 5).rotateX(-Math.PI / 2 + 0.28).translate(0, r * 1.2, -len * 0.38), f + len * 0.3, u, M.feather, 0.3);
      b.radial(5, () => new THREE.ConeGeometry(r * 0.22, len * 0.7, 4).rotateX(-Math.PI / 2 + 0.12).translate(0, r * 0.75, -len * 0.3), f + len * 0.35, u, M.glow, 0.93);
      b.tor(r * 1.3, r * 0.12, [f + len * 0.3, u, 0], M.trim, 0, 0, 6.2832, 18);
      b.disc(r * 0.4, f + len * 0.7 + 0.0005, u, M.dark);
      return f + len * 0.72;
    },
    orn(b, M, R) {
      const { f0, f1, u, top, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1;
      both((s) => { const x = s * (hw + 0.0014); for (let i = 0; i < 3; i++) { const fa = f0 + L * (0.42 + i * 0.03), ua = u - 0.004 * k, h = (0.016 + i * 0.006) * k, l = L * (0.25 + i * 0.06); b.prof([[fa, ua], [fa - l * 0.4, ua + h * 0.6], [fa - l, Math.min(top + 0.012 * k, ua + h)], [fa - l * 0.2, ua - 0.003 * k]], 0.002, i % 2 ? M.feather : M.trim, 0, x + s * i * 0.0015); } b.gem(0.005 * k, [f0 + L * 0.48, u, x + s * 0.003], M.gem, [1, 1, 0.6]); });
    },
    blade(b, M) { // 깃털 칼
      b.prof([[0.03, -0.014], [0.12, -0.022], [0.2, -0.018], [0.268, 0.004], [0.2, 0.024], [0.12, 0.026], [0.03, 0.02]], 0.0055, M.trim, 0.002);
      b.prof([[0.05, -0.002], [0.2, -0.002], [0.24, 0.003], [0.2, 0.008], [0.05, 0.008]], 0.0062, M.glow, 0.0008);
      for (let i = 0; i < 6; i++) both((s) => b.box(0.0012, 0.0016, 0.022, 0.06 + i * 0.025, 0.014 - (i % 2) * 0.026, M.feather, s * 0.0029, 0.5 * (i % 2 ? -1 : 1)));
      both((s) => b.gem(0.006, [0.03, 0.003, s * 0.006], M.gem, [1, 1, 0.6]));
    },
  },
  // 아쿠아 메카 — 흰 통 마디와 파란 판, 하늘색 빛 고리, 층층 지느러미 총구
  aqua: {
    fx: { tracer: 0x4ae8ff, flash: 0xa8f4ff, sfx: 'aqua', bundle: true },
    hg(b, M, R) {
      const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, k = Math.min(1, L / 0.2);
      const n = Math.max(2, Math.round(L / 0.06)), sl = L / n;
      for (let i = 0; i < n; i++) { const a = f0 + i * sl; b.ecyl(hw, hh, a + 0.004, sl - 0.01, um, M.armor, 0.97, 14); b.ecyl(hw * 0.92, hh * 0.92, a + sl - 0.006, 0.006, um, M.frame, 1, 14); b.ecyl(hw * 0.95, hh * 0.95, a + sl - 0.0045, 0.0028, um, M.glow, 1, 14); }
      both((s) => { b.prof([[f0 + 0.01, um - hh * 0.5], [f0 + 0.01, um + hh * 0.45], [f1 - L * 0.2, um + hh * 0.55], [f1 - 0.01, um + hh * 0.1], [f1 - 0.01, um - hh * 0.5]], 0.004, M.trim, 0.001, s * (hw + 0.001));
        b.box(0.0012, 0.0022, L * 0.6, f0 + L * 0.45, um + hh * 0.15, M.glow, s * (hw + 0.0032)); for (let i = 0; i < 4; i++) b.box(0.0012, hh * 0.35, 0.003, f0 + L * (0.2 + i * 0.05), um - hh * 0.2, M.frame, s * (hw + 0.0032)); });
      for (let i = 0; i < Math.max(3, Math.round(L / 0.025)); i++) b.box(w * 0.5, 0.008 * k + 0.003, 0.0028, f0 + 0.015 + i * 0.022, u1 + 0.004 * k, i % 3 ? M.armor : M.trim);
      b.prof([[f0 + L * 0.1, u0], [f1 - L * 0.1, u0], [f1, u0 - 0.012 * k], [f0 + L * 0.3, u0 - 0.014 * k]], w * 0.7, M.frame, 0.002);
      b.box(w * 0.72, 0.002, L * 0.5, f0 + L * 0.6, u0 - 0.013 * k, M.glow);
    },
    stock(b, M, R) {
      const { f, end, top, bot, j0, w } = R, L = f - end, um = (top + bot) / 2;
      b.prof([[f, top], [end + 0.03, top], [end + 0.015, um + 0.006], [end + 0.03, bot], [f - L * 0.45, j0 - 0.012], [f, j0]], w * 0.45, M.frame, 0.003);
      for (let i = 0; i < 4; i++) b.prof([[f - 0.03 - i * 0.03, top - 0.002], [f - 0.042 - i * 0.03, top - 0.002], [f - 0.048 - i * 0.03, um - 0.014], [f - 0.036 - i * 0.03, um - 0.01]], w * 0.9, i % 2 ? M.trim : M.armor, 0.002);
      b.cyl(0.006, 0.006, end + 0.03, L * 0.6, um + 0.004, M.glow, 0, 10);
      b.prof([[end + 0.022, top + 0.002], [end, top], [end - 0.004, um], [end, bot], [end + 0.022, bot + 0.004]], w * 0.85, M.armor, 0.004);
      b.box(w * 0.88, 0.003, 0.018, end + 0.01, um, M.glow); b.box(w * 0.9, (top - bot) * 0.5, 0.004, end + 0.024, um, M.trim);
    },
    muzzle(b, M, f, u, r, len) {
      b.prof([[f, u - r * 1.35], [f, u + r * 1.35], [f + len * 0.9, u + r * 1.35], [f + len * 0.9, u - r * 1.35]], r * 2.7, M.armor, 0.002);
      for (let i = 0; i < 4; i++) b.prof([[f + len * (0.12 + i * 0.2), u - r * 1.9], [f + len * (0.12 + i * 0.2), u + r * 1.9], [f + len * (0.2 + i * 0.2), u + r * 1.7], [f + len * (0.2 + i * 0.2), u - r * 1.7]], r * 3.2, i % 2 ? M.trim : M.frame, 0.001);
      both((s) => b.box(0.0012, r * 0.3, len * 0.7, f + len * 0.45, u, M.glow, s * (r * 1.6 + 0.0008)));
      b.tor(r * 1.0, r * 0.12, [f + len * 0.92, u, 0], M.glow, 0, 0, 6.2832, 16); b.disc(r * 0.55, f + len * 0.92, u, M.dark);
      return f + len * 0.92;
    },
    orn(b, M, R) {
      const { f0, f1, u, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1;
      both((s) => { const x = s * (hw + 0.0014); b.prof([[f0 + L * 0.1, u - 0.01 * k], [f0 + L * 0.1, u + 0.012 * k], [f0 + L * 0.65, u + 0.012 * k], [f0 + L * 0.72, u - 0.01 * k]], 0.0026, M.trim, 0.0008, x); b.box(0.0012, 0.0022 * k, L * 0.45, f0 + L * 0.4, u + 0.004 * k, M.glow, x + s * 0.0016); for (let i = 0; i < 3; i++) b.box(0.0012, 0.006 * k, 0.003, f0 + L * (0.18 + i * 0.04), u - 0.003 * k, M.armor, x + s * 0.0016); });
    },
    blade(b, M) {
      b.prof([[0.03, -0.016], [0.2, -0.016], [0.26, 0.004], [0.2, 0.022], [0.03, 0.022]], 0.0055, M.armor, 0.0016);
      b.prof([[0.035, -0.0168], [0.2, -0.0168], [0.259, 0.0035], [0.2, -0.011], [0.035, -0.011]], 0.006, M.trim, 0.0004);
      both((s) => b.box(0.0012, 0.0024, 0.15, 0.12, 0.013, M.glow, s * 0.003));
    },
  },
});
// ───────────── 기존 형태 키트 보강: 빛나는 부품과 도는 장식 (얼티밋급으로) ─────────────
const KPLUS_MATS = {
  carbon: { led: { color: 0xff6050, emissive: 0xff2010, emissiveIntensity: 2.6, roughness: 0.3 }, fan: { color: 0x2a2c30, metalness: 1, roughness: 0.25 } },
  tiger: {}, neon: {}, lava: {}, halloween: {}, galaxy: {},
  sakura: { lantern: { color: 0xffd0e0, emissive: 0xff5a9a, emissiveIntensity: 1.8, roughness: 0.6 } },
  ice: { frost: { color: 0xc8f0ff, emissive: 0x4ac8ff, emissiveIntensity: 2.2, roughness: 0.2 } },
  gold: { halo: { color: 0xffe08a, emissive: 0xffb020, emissiveIntensity: 1.4, metalness: 1, roughness: 0.1 } },
  aurora: { glint: { color: 0xc8fff0, emissive: 0x6affc8, emissiveIntensity: 2, roughness: 0.2 } },
};
for (const [id, mats] of Object.entries(KPLUS_MATS)) { const f0 = KMATS[id]; KMATS[id] = (M) => ({ ...(f0 ? f0(M) : {}), ...mats }); }
const spinAt = (b, f, u, sp, fn, axis) => { const prev = b.cur; if (prev === '') b.part('spin' + ++spinN, [f, u, b.shift], sp, axis); fn(); b.cur = prev; };
const KPLUS = {
  carbon: {
    hg(b, M, R) { const { f0, f1, u0, w } = R, L = f1 - f0; for (const s of [-1, 1]) { b.box(0.0014, 0.0026, L * 0.7, f0 + L * 0.45, u0 + 0.008, M.led, s * (w / 2 + 0.0035)); for (let i = 0; i < 3; i++) b.box(0.0014, 0.004, 0.004, f1 - 0.012 - i * 0.008, u0 + 0.016, M.led, s * (w / 2 + 0.0035)); } },
    muzzle(b, M, f, u, r, len, tip) { spinAt(b, f + len * 0.1, u, 9, () => { b.radial(6, () => new THREE.BoxGeometry(r * 0.25, r * 1.1, 0.002).rotateY(0.6).translate(0, r * 0.9, 0), f + len * 0.1, u, M.fan); }); b.tor(r * 1.55, r * 0.08, [f + len * 0.1, u, 0], M.led, 0, 0, 6.2832, 20); },
    stock(b, M, R) { const { end, top, bot, w } = R; b.box(w + 0.004, (top - bot) * 0.5, 0.003, end - 0.001, (top + bot) / 2, M.led); },
  },
  tiger: {
    hg(b, M, R) { const { f0, f1, u0, u1, w } = R, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.box(0.0014, hh * 1.3, 0.0022, f0 + L * (0.42 + i * 0.07), um, M.eye, s * (w / 2 + 0.006), 0.5); },
  },
  sakura: {
    hg(b, M, R) { const { f0, f1, u0, u1, w } = R, L = f1 - f0, um = (u0 + u1) / 2, fm = f0 + L / 2, RR = Math.max(w / 2, (u1 - u0) / 2) + 0.016; spinAt(b, fm, um, 0.9, () => { for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.2832; b.ball(0.006, [fm + Math.sin(a * 2) * L * 0.25, um + Math.cos(a) * RR, Math.sin(a) * RR], M.petal, [1.2, 0.35, 1], 7); } }); },
    muzzle(b, M, f, u, r, len) { b.rod([f + len * 0.4, u - r, 0], [f + len * 0.42, u - r - 0.02, 0], 0.0012, 0.0012, M.twig, 4); b.ball(0.008, [f + len * 0.42, u - r - 0.028, 0], M.lantern, [1, 1.25, 1], 10); },
  },
  ice: {
    hg(b, M, R) { const { f0, f1, u0, u1, w } = R, L = f1 - f0, um = (u0 + u1) / 2; for (const s of [-1, 1]) b.box(0.0014, 0.003, L * 0.8, f0 + L / 2, um, M.frost, s * (w / 2 + 0.0012)); },
    muzzle(b, M, f, u, r, len, tip) { spinAt(b, tip + 0.004, u, 1.6, () => { b.radial(6, () => new THREE.BoxGeometry(r * 0.16, r * 1.6, 0.002).translate(0, r * 1.2, 0), tip + 0.004, u, M.frost); b.radial(6, () => new THREE.OctahedronGeometry(r * 0.22, 0).translate(0, r * 2.05, 0), tip + 0.004, u, M.crystal); }); },
  },
  neon: {
    muzzle(b, M, f, u, r, len, tip) { spinAt(b, tip, u, -3, () => { b.tor(r * 1.9, r * 0.07, [tip, u, 0], M.glow, 0, 0, 6.2832, 28); b.radial(8, () => new THREE.BoxGeometry(r * 0.12, r * 0.45, 0.002).translate(0, r * 2.15, 0), tip, u, M.glow2); }); },
  },
  lava: {
    hg(b, M, R) { const { f0, f1, u0, u1, w } = R, L = f1 - f0, um = (u0 + u1) / 2, fm = f0 + L * 0.5, RR = Math.max(w / 2, (u1 - u0) / 2) + 0.01; spinAt(b, fm, um, 1.4, () => { b.tor(RR, 0.002, [fm, um, 0], M.core, 0.4, 0, 6.2832, 30); for (let i = 0; i < 3; i++) { const a = i * 2.094; b.lump(0.0035, [fm, um + Math.cos(a) * RR, Math.sin(a) * RR], M.core, [1, 1, 1], i); } }); },
    muzzle(b, M, f, u, r, len) { for (let i = 0; i < 3; i++) b.ball(r * (0.22 - i * 0.05), [f + len * (0.3 + i * 0.12), u - r * (1.4 + i * 0.35), 0], M.core, [0.8, 1.4, 0.8], 8); },
  },
  gold: {
    hg(b, M, R) { const { f0, f1, u0, u1, w } = R, L = f1 - f0, um = (u0 + u1) / 2, fm = f0 + L * 0.3, RR = Math.max(w / 2, (u1 - u0) / 2) + 0.014; spinAt(b, fm, um, 0.7, () => { b.tor(RR, 0.0022, [fm, um, 0], M.halo, 0, 0, 6.2832, 32); for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.2832 + 0.4; b.gem(0.0042, [fm, um + Math.cos(a) * RR, Math.sin(a) * RR], M.gem); } }); },
  },
  galaxy: {},
  aurora: {
    hg(b, M, R) { const { f0, f1, u0, u1, w } = R, L = f1 - f0, um = (u0 + u1) / 2, fm = f0 + L / 2, RR = Math.max(w / 2, (u1 - u0) / 2) + 0.02; spinAt(b, fm, um, 0.8, () => { for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.2832, x = Math.sin(a) * RR, y = um + Math.cos(a) * RR; b.crys([fm - 0.01, y, x], [fm + 0.012, y + Math.cos(a) * 0.006, x + Math.sin(a) * 0.006], 0.004, M.prism, 4); b.ball(0.0018, [fm + 0.012, y, x], M.glint, [1, 1, 1], 6); } }); },
  },
  halloween: {
    muzzle(b, M, f, u, r, len, tip) { const fm = f + len * 0.5, RR = r * 2.6; spinAt(b, fm, u, 2.2, () => { for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.2832, y = u + Math.cos(a) * RR, x = Math.sin(a) * RR, k = r * 0.08; b.prof([[fm - 9 * k, y + 2 * k], [fm - 4 * k, y - 1 * k], [fm, y + 1.5 * k], [fm + 4 * k, y - 1 * k], [fm + 9 * k, y + 2 * k], [fm + 5 * k, y - 3 * k], [fm, y - 1.5 * k], [fm - 5 * k, y - 3 * k]], 0.002, M.wing, 0, x); b.ball(k * 0.8, [fm, y, x + 0.0012], M.eye, [1, 1, 0.6], 6); } }); },
  },
};
// 레전드: 가운데 에너지 코어, 들여다보이는 빛나는 배관, 번개 고리
Object.assign(KPLUS_MATS, {
  crimson: { core: { color: 0xfff0d0, emissive: 0xff7a20, emissiveIntensity: 3.2, roughness: 0.3 }, pipe: { color: 0xffa060, emissive: 0xff4a00, emissiveIntensity: 2.2, roughness: 0.4 } },
  aqua: { core: { color: 0xe8fcff, emissive: 0x30d0ff, emissiveIntensity: 3.2, roughness: 0.2 } },
  dragon: { thunder: { color: 0xe0b0ff, emissive: 0xa040ff, emissiveIntensity: 3, roughness: 0.3 } },
  phoenix: { core: { color: 0xfff4d0, emissive: 0xff8a10, emissiveIntensity: 3.2, roughness: 0.3 } },
});
for (const id of ['crimson', 'aqua', 'dragon', 'phoenix']) { const f0 = KMATS[id], mats = KPLUS_MATS[id]; KMATS[id] = (M) => ({ ...(f0 ? f0(M) : {}), ...mats }); }
Object.assign(KPLUS, {
  crimson: {
    hg(b, M, R) { const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, Rc = Math.min(hh * 0.95, 0.03);
      for (const [du, dz] of [[0.45, 0.55], [0, 0.75], [-0.4, 0.5]]) both((s) => b.rod([f0 + 0.008, um + du * hh, s * hw * dz], [f1 - 0.008, um + du * hh * 0.6, s * hw * dz], 0.0022, 0.0022, M.pipe, 6));
      energyCore(b, M, f0 + L * 0.34, um, Rc, hw, M.core, M.glow, M.frame); },
  },
  aqua: {
    hg(b, M, R) { const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, Rc = Math.min(hh * 0.95, 0.03), fc = f0 + L * 0.42;
      energyCore(b, M, fc, um, Rc, hw, M.core, M.glow, M.frame, 16);
      both((s) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.2832; b.crys([fc + Math.cos(a) * Rc * 1.2, um + Math.sin(a) * Rc * 1.2, s * (hw + 0.004)], [fc + Math.cos(a) * Rc * 2.4, um + Math.sin(a) * Rc * 2.4, s * (hw + 0.012)], 0.0025, M.glow, 4); } }); },
  },
  dragon: {
    hg(b, M, R) { const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, fc = f0 + L * 0.45, RR = hh * 2.3;
      spinAt(b, fc, um, 0.9, () => { b.tor(RR, 0.0035, [fc, um, 0], M.thunder, 0, Math.PI / 2, 6.2832, 40); for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.2832; b.spike([fc + Math.cos(a) * RR, um + Math.sin(a) * RR, 0], [fc + Math.cos(a + 0.35) * RR * 1.25, um + Math.sin(a + 0.35) * RR * 1.25, 0], 0.004, M.horn, 4); } }, 'x');
      spinAt(b, fc, um, -1.5, () => b.tor(RR * 0.82, 0.0018, [fc, um, 0], M.glow, 0, Math.PI / 2, 6.2832 * 0.75, 30), 'x'); },
  },
  phoenix: {
    hg(b, M, R) { const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2; energyCore(b, M, f0 + L * 0.62, um, Math.min(hh * 0.9, 0.028), hw, M.core, M.glow, M.trim, 10); },
  },
});
// 모든 유료 스킨: 총 둘레에 늘 움직이는 입자
const AURA = {
  carbon: { kind: 'spark', c0: 0xff4030 }, tiger: { kind: 'ember', c0: 0xffb040, c1: 0xff5a10 }, sakura: { kind: 'fall', c0: 0xffc0dc, c1: 0xff80b0 }, ice: { kind: 'fall', c0: 0xe8f8ff, c1: 0x8fd8ff },
  neon: { kind: 'spark', c0: 0x19e3ff, c1: 0xff3df0, bolt: 0x19e3ff }, lava: { kind: 'ember', c0: 0xffd080, c1: 0xff3000, n: 60 }, gold: { kind: 'spark', c0: 0xffe9a0, c1: 0xffc040 },
  galaxy: { kind: 'spark', c0: 0xffffff, c1: 0xc08cff, n: 60 }, aurora: { kind: 'orbit', c0: 0x7dffc8, c1: 0x7ab8ff }, halloween: { kind: 'ember', c0: 0xa64dff, c1: 0x9dff3a },
  platinum: { kind: 'spark', c0: 0xbfeaff }, damascus: { kind: 'ember', c0: 0xffe0a0, c1: 0xffa040 }, obsidian: { kind: 'orbit', c0: 0xd8b8ff, c1: 0x8040ff }, diamond: { kind: 'spark', c0: 0xffffff, c1: 0xbfe8ff, n: 60 },
  atomic: { kind: 'ember', c0: 0xffd070, c1: 0xff3000, bolt: 0xff8a30 }, orion: { kind: 'orbit', c0: 0xffffff, c1: 0xff8ad8, n: 56 }, darkmatter: { kind: 'orbit', c0: 0xd08aff, c1: 0xff40b0, bolt: 0xb05cff },
  crimson: { kind: 'ember', c0: 0xffd080, c1: 0xff2a00, n: 64, bolt: 0xff7a20 }, dragon: { kind: 'ember', c0: 0xff6040, c1: 0xa040ff, n: 60, bolt: 0xc060ff },
  phoenix: { kind: 'ember', c0: 0xfff0b0, c1: 0xff4000, n: 72 }, aqua: { kind: 'orbit', c0: 0xc8f8ff, c1: 0x2a80ff, n: 60, bolt: 0x6ae8ff },
};
for (const [id, a] of Object.entries(AURA)) if (KITS[id]) KITS[id].aura = a;
for (const [id, P] of Object.entries(KPLUS)) {
  const K = KITS[id];
  for (const part of ['hg', 'stock', 'orn']) if (P[part] && K[part]) { const o = K[part]; K[part] = (b, M, R) => { o(b, M, R); P[part](b, M, R); }; }
  if (P.muzzle && K.muzzle) { const o = K.muzzle; K.muzzle = (b, M, f, u, r, len) => { const tip = o(b, M, f, u, r, len); P.muzzle(b, M, f, u, r, len, tip); return tip; }; }
}
// ───────────── 장식 부품 잔뜩: 리벳·배관·빛나는 홈·에너지 셀·방열핀·지느러미 (모든 유료 스킨, 테마 재질로) ─────────────
const GLOWK = ['glow', 'holo', 'core', 'rim', 'rift', 'star', 'line', 'eye', 'frost', 'led', 'lantern', 'halo', 'thunder', 'pipe', 'glow2', 'glint', 'disk'];
const gmat = (M) => { for (const k of GLOWK) if (M[k]) return M[k]; return M.accent; };
const pmat = (M) => M.armor || M.trim || M.gilt || M.recv, dmat = (M) => M.frame || M.steel, bmat = (M) => M.gilt || M.trim || M.bolt;
const GREEB = {
  hg(b, M, R) {
    const { f0, f1, u0, u1, w } = R, hw = w / 2, L = f1 - f0, um = (u0 + u1) / 2, hh = (u1 - u0) / 2, G = gmat(M), P = pmat(M), D = dmat(M), B = bmat(M), k = Math.min(1, L / 0.2), small = L < 0.13; // 작은 총(권총·쌍열)은 판·리벳·빛 홈만
    if (!small) both((s) => { b.box(0.008, 0.007 * k + 0.003, L * 0.92, f0 + L / 2, u1 + 0.0035, P, s * (hw - 0.001)); b.box(0.0086, 0.0016, L * 0.92, f0 + L / 2, u1 + 0.0035 + (0.0035 * k + 0.0015), D, s * (hw - 0.001)); for (let i = 0, n = Math.max(3, Math.round(L / 0.03)); i < n; i++) b.ball(0.0016, [f0 + 0.012 + (i * (L - 0.024)) / (n - 1), u1 + 0.004, s * (hw + 0.003)], G, [1, 1, 0.6], 6); }); // 위 모서리 덮개 띠와 빛나는 점
    if (!small) { b.box(w * 0.42, 0.006 * k + 0.002, L * 0.4, f0 + L * 0.48, u1 + 0.006 * k, D); b.box(w * 0.18, 0.003, L * 0.38, f0 + L * 0.48, u1 + 0.009 * k + 0.002, G); for (const ff of [f0 + L * 0.29, f0 + L * 0.67]) b.box(w * 0.48, 0.008 * k + 0.002, 0.008, ff, u1 + 0.006 * k, P); } // 위 에너지 레일 (가늠쇠를 피해 가운데)
    both((s) => {
      const x = s * (hw + 0.006), fa = f0 + L * 0.04, fb = f0 + L * 0.44;
      b.prof([[fa, um - hh * 0.75], [fa + 0.01, um + hh * 0.85], [fb, um + hh * 0.85], [fb + 0.014, um], [fb, um - hh * 0.75]], 0.006, P, 0.0014, x); // 장갑판
      for (let i = 0; i < 3; i++) b.box(0.0014, 0.0042, (fb - fa) * 0.66, (fa + fb) / 2 + 0.002, um + hh * (0.5 - i * 0.45), G, x + s * 0.0032); // 빛나는 홈
      for (const [ff, uu] of [[fa + 0.008, um + hh * 0.65], [fa + 0.008, um - hh * 0.6], [fb - 0.004, um + hh * 0.65], [fb - 0.004, um - hh * 0.6]]) b.ball(0.0026, [ff, uu, x + s * 0.0032], B, [1, 1, 0.6], 8); // 리벳
      if (small) return;
      const xp = s * (hw + 0.009), uc = um + hh * 0.05, rc0 = Math.min(0.009, hh * 0.5); // 옆면 에너지 캐니스터
      b.cyl(rc0, rc0, f0 + L * 0.5, L * 0.44, uc, D, xp, 14); b.cyl(rc0 * 1.04, rc0 * 1.04, f0 + L * 0.58, L * 0.26, uc, G, xp, 14);
      for (let i = 0; i < 4; i++) { const ff = f0 + L * (0.52 + i * 0.13); b.cyl(rc0 * 1.25, rc0 * 1.25, ff, 0.004, uc, B, xp, 14); b.box(0.008, rc0 * 0.8, 0.004, ff + 0.002, uc, D, s * (hw + 0.003)); }
      b.cyl(rc0 * 0.7, rc0 * 0.4, f1 - L * 0.06 - 0.01, 0.012, uc, B, xp, 12);
      const fc = f0 + L * 0.24, rc = Math.min(hh * 0.62, 0.018), ug = um - hh * 0.05;
      b.sdisc(rc, fc, ug, x + s * 0.0036, D); b.tor(rc * 1.05, rc * 0.12, [fc, ug, x + s * 0.0036], B, 0, Math.PI / 2, 6.2832, 20);
      spinAt(b, fc, ug, s * 3, () => { b.tor(rc * 0.78, rc * 0.1, [fc, ug, x + s * 0.0044], G, 0, Math.PI / 2, 6.2832, 18); for (let i = 0; i < 6; i++) { const a = i * 1.0472; b.box(0.0016, rc * 0.5, rc * 0.16, fc + Math.cos(a) * rc * 0.42, ug + Math.sin(a) * rc * 0.42, B, x + s * 0.0046, a); } }, 'x'); // 도는 장치
    });
    if (small) return;
    for (let i = 0, n = Math.max(3, Math.round(L * 0.3 / 0.014)); i < n; i++) b.box(w * 0.6, 0.012 * k + 0.004, 0.0026, f0 + L * 0.64 + (i * L * 0.3) / (n - 1), u0 - 0.006 * k - 0.002, i % 2 ? D : P); // 아래 방열핀 (왼손 쥐는 자리를 피해 앞쪽)
    b.box(w * 0.62, 0.0024, L * 0.32, f0 + L * 0.79, u0 - 0.012 * k - 0.004, G);
  },
  orn(b, M, R) {
    const { f0, f1, u, top, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1, G = gmat(M), P = pmat(M), D = dmat(M), B = bmat(M);
    both((s) => {
      const x = s * (hw + 0.008 * k), fc = f0 + L * 0.66, rr = 0.008 * k;
      b.cyl(rr, rr, fc - L * 0.14, L * 0.28, u - 0.017 * k, P, x, 14); b.cyl(rr * 1.06, rr * 1.06, fc - L * 0.05, L * 0.1, u - 0.017 * k, G, x, 14); // 에너지 셀
      for (const ff of [fc - L * 0.14, fc + L * 0.14]) b.cyl(rr * 1.25, rr * 1.25, ff - 0.003, 0.006, u - 0.017 * k, B, x, 14);
      b.box(0.008 * k, rr * 2.2, 0.008 * k, fc, u - 0.017 * k, D, s * (hw + 0.003));
      b.sdisc(0.008 * k, f0 + L * 0.3, u + 0.008 * k, s * (hw + 0.0022), G); b.tor(0.0092 * k, 0.0016, [f0 + L * 0.3, u + 0.008 * k, s * (hw + 0.0024)], B, 0, Math.PI / 2, 6.2832, 6); // 빛나는 육각 표식
      for (let i = 0; i < 5; i++) b.ball(0.0022 * k + 0.0004, [f0 + L * (0.1 + i * 0.045), u - 0.02 * k, s * (hw + 0.0014)], B, [1, 1, 0.6], 6);
      b.prof([[f0 + L * 0.03, top - 0.004], [f0 + L * 0.14, top - 0.004], [f0 + L * 0.0, top + 0.026 * k], [f0 - L * 0.02, top + 0.022 * k]], 0.0028, i2(P, G, s), 0.0006, s * 0.008); // 뒤쪽 큰 지느러미
    });
    b.box(0.018 * k, 0.008 * k, 0.016 * k, f0 + L * 0.42, u + 0.004 * k, B, (hw + 0.01 * k)); b.box(0.004 * k, 0.004 * k, 0.016 * k, f0 + L * 0.42, u + 0.004 * k, G, (hw + 0.0195 * k)); // 큰 장전손잡이
  },
  stock(b, M, R) {
    const { f, end, top, bot, w } = R, um = (top + bot) / 2, G = gmat(M), B = bmat(M), P = pmat(M);
    both((s) => { const x = s * (w / 2 + 0.005); b.cyl(0.0034, 0.0034, end + 0.03, f - end - 0.04, top - 0.009, G, x, 10); for (let i = 0; i < 3; i++) { const ff = end + 0.04 + i * (f - end - 0.06) / 2; b.cyl(0.005, 0.005, ff, 0.004, top - 0.009, B, x, 10); }
      for (let i = 0; i < 5; i++) b.ball(0.0022, [end + 0.03 + i * 0.022, um - 0.006, s * (w / 2 + 0.0014)], B, [1, 1, 0.6], 6); });
    for (let i = 0; i < 4; i++) b.prof([[end + 0.016 + i * 0.013, bot + 0.004], [end + 0.002 + i * 0.013, bot - 0.022 - i * 0.004], [end + 0.012 + i * 0.013, bot + 0.004]], 0.0034, i % 2 ? G : P, 0.0006);
    for (let i = 0; i < 3; i++) b.prof([[end + 0.03 + i * 0.016, top + 0.002], [end + 0.016 + i * 0.016, top + 0.02 + i * 0.004], [end + 0.026 + i * 0.016, top + 0.002]], 0.003, i % 2 ? P : G, 0.0006);
  },
  muzzle(b, M, f, u, r, len, tip) {
    const G = gmat(M), B = bmat(M);
    b.tor(r * 1.4, r * 0.14, [f + len * 0.18, u, 0], G, 0, 0, 6.2832, 18); b.tor(r * 1.45, r * 0.1, [f + len * 0.04, u, 0], B, 0, 0, 6.2832, 18);
    b.radial(6, () => new THREE.ConeGeometry(r * 0.2, r * 1.6, 4).rotateX(-Math.PI / 2).translate(0, r * 1.5, -r * 0.5), f + len * 0.18, u, B, 0.52);
  },
};
const i2 = (a, c, s) => (s > 0 ? a : c);
for (const [id, K] of Object.entries(KITS)) {
  if (!K.fx || !K.fx.bundle) continue;
  for (const part of ['hg', 'stock', 'orn']) if (K[part]) { const o = K[part]; K[part] = (b, M, R) => { o(b, M, R); GREEB[part](b, M, R); }; }
  if (K.muzzle) { const o = K.muzzle; K.muzzle = (b, M, f, u, r, len) => { const tip = o(b, M, f, u, r, len); GREEB.muzzle(b, M, f, u, r, len, tip); return tip; }; }
}
// 기본·무료 위장 스킨: 몸통 옆면에 전술 장비 (배터리 셀, 리벳, 빨간 표시등)
const tactOrn = (b, M, R) => { const { f0, f1, u, top, hw } = R, L = f1 - f0, k = R.small ? 0.55 : 1;
  both((s) => { const x = s * (hw + 0.008 * k), fc = f0 + L * 0.66, rr = 0.0075 * k;
    b.cyl(rr, rr, fc - L * 0.13, L * 0.26, u - 0.017 * k, M.bolt, x, 14); b.cyl(rr * 1.08, rr * 1.08, fc + L * 0.03, L * 0.03, u - 0.017 * k, M.accent, x, 14); for (const ff of [fc - L * 0.13, fc + L * 0.13]) b.cyl(rr * 1.2, rr * 1.2, ff - 0.003, 0.006, u - 0.017 * k, M.steel, x, 14); b.box(0.008 * k, rr * 2.2, 0.008 * k, fc, u - 0.017 * k, M.steel, s * (hw + 0.003)); // 배터리 셀
    for (let i = 0; i < 5; i++) b.ball(0.002 * k + 0.0004, [f0 + L * (0.1 + i * 0.045), u - 0.02 * k, s * (hw + 0.0014)], M.bolt, [1, 1, 0.6], 6);
    b.sdisc(0.0042 * k, f0 + L * 0.3, u + 0.008 * k, s * (hw + 0.002), M.accent); b.tor(0.0055 * k, 0.0012, [f0 + L * 0.3, u + 0.008 * k, s * (hw + 0.0022)], M.bolt, 0, Math.PI / 2, 6.2832, 12); });
  const fl = f1 - L * 0.04, ul = u - 0.026 * k; // 양옆 전술 라이트 (빛나는 렌즈)
  both((s) => { const xl = s * (hw + 0.012 * k); b.box(0.016 * k, 0.016 * k, 0.05 * k, fl - 0.025 * k, ul, M.steel, xl); b.cyl(0.0085 * k, 0.0095 * k, fl, 0.012 * k, ul, M.bolt, xl, 14); b.disc(0.0075 * k, fl + 0.0122 * k, ul, M.lamp, false, xl); b.box(0.004 * k, 0.006 * k, 0.012 * k, fl - 0.04 * k, ul + 0.01 * k, M.accent, xl); });
  b.prof([[f0 + L * 0.03, top - 0.004], [f0 + L * 0.12, top - 0.004], [f0 + L * 0.02, top + 0.014 * k]], 0.003, M.steel, 0.0006); };
for (const id of ['std', 'desert', 'forest', 'urban']) KITS[id] = { fx: FX_FREE[id] || { tracer: 0xfff1b0, flash: 0xffd27a }, orn: tactOrn };
export function skinFx(skin) { const id = SKINS[skin] && SKINS[skin].id, k = KITS[id]; return k ? k.fx : FX_FREE[id] || null; }

// ───────────── 소총 계열: 돌격소총 / 소음소총(supp) / 점사소총(burst) / 지정사수소총(dmr) / 경기관총(lmg) / 중기관총(hmg) ─────────────
function rifle(M, o = {}) {
  const b = new Builder(), F = M[o.furn || 'furn'], heavy = o.lmg || o.hmg, K = o.kit || {}, A = o.att || {}, dl = barDl(A);
  // 총몸 (위·아래)
  b.prof([[-0.105, -0.006], [-0.105, 0.03], [-0.09, 0.042], [0.135, 0.042], [0.135, -0.006]], 0.044, M.recv, 0.004);
  b.prof([[-0.105, -0.006], [0.112, -0.006], [0.112, -0.034], [0.118, -0.07], [0.03, -0.07], [0.022, -0.05], [-0.078, -0.05], [-0.105, -0.04]], 0.04, M.recv, 0.004);
  b.box(0.0446, 0.0016, 0.236, 0.015, -0.006, M.dark);
  b.xcyl(0.0042, 0.0464, -0.088, -0.022, M.bolt); b.xcyl(0.0042, 0.0464, 0.098, -0.02, M.bolt); b.xcyl(0.003, 0.042, -0.01, -0.03, M.steel);
  b.box(0.002, 0.02, 0.06, 0.045, 0.016, M.dark, 0.0222); b.box(0.002, 0.012, 0.05, 0.045, 0.017, M.bolt, 0.0226); b.box(0.003, 0.006, 0.064, 0.045, 0.002, M.steel, 0.0225); // 탄피 배출구와 먼지덮개
  b.box(0.004, 0.006, 0.022, -0.022, -0.017, M.steel, -0.0218, -0.5); b.sdisc(0.0046, -0.03, -0.018, -0.0224, M.steel); b.sdisc(0.0022, -0.014, -0.01, -0.0206, M.accent); b.sdisc(0.0016, -0.014, -0.026, -0.0206, M.white); // 조정간
  b.box(0.004, 0.018, 0.01, 0.066, -0.014, M.steel, -0.0212); b.box(0.004, 0.008, 0.014, 0.1, -0.03, M.steel, 0.0212);
  if (o.label) b.label(o.label, 0.075, 0.024, -0.0228, 0.076, 0.019);
  b.box(0.002, 0.007, 0.1, 0.035, 0.008, M.dark, -0.0222);                                   // 왼쪽 장전손잡이 홈
  b.part('slide'); b.box(0.012, 0.01, 0.012, 0.075, 0.008, M.bolt, -0.027); b.xcyl(0.006, 0.014, 0.075, 0.008, M.bolt, -0.036); b.part();
  b.box(0.05, 0.007, 0.02, -0.1, 0.0355, M.steel); b.box(0.012, 0.009, 0.03, -0.092, 0.036, M.steel);
  // 탄창
  b.part('mag');
  if (heavy) {                                                    // 상자형 탄통과 탄띠
    const k = o.hmg ? 1.3 : 1;
    b.prof([[0.005, -0.07], [0.135, -0.07], [0.135, -0.07 - 0.11 * k], [0.005, -0.07 - 0.11 * k]], 0.08 * k, M.olive, 0.006);
    b.box(0.084 * k, 0.012, 0.134, 0.07, -0.07 - 0.028 * k, M.recv); b.box(0.084 * k, 0.006, 0.134, 0.07, -0.07 - 0.085 * k, M.recv);
    b.box(0.03, 0.012, 0.03, 0.07, -0.07 - 0.055 * k, M.steel, 0.041 * k);
    for (let i = 0; i < 6; i++) b.cyl(0.0042, 0.0042, 0.05, 0.04, -0.062 + i * 0.011, M.brass, -0.026 - i * 0.0012, 8); // 탄띠
  } else if (o.dmr || o.burst) {
    b.prof([[0.038, -0.06], [0.1, -0.06], [0.106, -0.168], [0.046, -0.168]], 0.026, M.mag, 0.003);
    b.prof([[0.044, -0.164], [0.108, -0.164], [0.109, -0.174], [0.045, -0.174]], 0.03, M.rubber, 0.002);
    for (const s of [-1, 1]) b.box(0.0012, 0.08, 0.008, 0.074, -0.11, M.dark, s * 0.0132, 0.055);
  } else {
    b.prof([[0.036, -0.06], [0.098, -0.06], [0.106, -0.12], [0.124, -0.2], [0.12, -0.232], [0.066, -0.238], [0.056, -0.2], [0.042, -0.125]], 0.026, M.mag, 0.003, 0, { r: 0.004 });
    for (const u of [-0.1, -0.13, -0.16, -0.19]) b.box(0.0285, 0.004, 0.05, 0.078 + (-0.06 - u) * 0.12, u, M.steel, 0, 0.12);
    b.prof([[0.062, -0.228], [0.124, -0.222], [0.125, -0.234], [0.064, -0.242]], 0.03, M.rubber, 0.002);
    if (o.supp) for (const s of [-1, 1]) b.box(0.0012, 0.07, 0.007, 0.082, -0.125, M.bolt, s * 0.0134, 0.1);
  }
  b.part();
  if (A.mag && heavy) { const k = o.hmg ? 1.3 : 1; magAtt(b, A.mag, 0.005, 0.135, -0.07 - 0.11 * k - 0.002, 0.08 * k, M, 0); }
  else if (A.mag) { if (o.dmr || o.burst) magAtt(b, A.mag, 0.046, 0.108, -0.172, 0.027, M, 0.003); else magAtt(b, A.mag, 0.064, 0.124, -0.238, 0.027, M); }
  pistolGrip(b, M);
  tguard(b, 0, -0.05, M);
  // 총열덮개
  const hg = o.dmr || heavy ? 0.45 : 0.405, hw = o.hmg ? 0.058 : 0.05;
  b.cyl(0.0235, 0.0235, 0.128, 0.012, 0, M.steel, 0, 12);
  if (K.hg) K.hg(b, M, { f0: 0.135, f1: hg, u0: -0.038, u1: 0.041, w: hw, uc: 0 });
  else {
    b.prof([[0.135, -0.038], [0.135, 0.041], [hg, 0.041], [hg, -0.024], [hg - 0.017, -0.038]], hw, F, 0.007);
    const ns = Math.floor((hg - 0.175) / 0.042);
    slots(b, 0.172, ns, 0.042, 0.014, hw / 2 + 0.0002, M); slots(b, 0.172, ns, 0.042, -0.014, hw / 2 + 0.0002, M);
    for (let i = 0; i < ns; i++) b.box(0.01, 0.0014, 0.028, 0.172 + i * 0.042, -0.0384, M.dark);
    b.cyl(0.019, 0.019, hg - 0.003, 0.005, 0, M.steel, 0, 12);
  }
  if (heavy && !K.hg) for (let i = 0; i < 6; i++) for (const s of [-1, 1]) b.sdisc(0.005, 0.19 + i * 0.04, 0.028, s * (hw / 2 + 0.0004), M.dark);
  if (o.burst && !A.grp) { b.prof([[0.2, -0.038], [0.3, -0.038], [0.238, -0.104], [0.204, -0.104]], 0.03, M.poly, 0.007, 0, { r: 0.006 }); for (let i = 0; i < 3; i++) b.box(0.0305, 0.003, 0.03, 0.222, -0.06 - i * 0.012, M.dark); }  // 각진 앞손잡이
  if (o.supp && !K.hg && !A.grp) { b.prof([[0.21, -0.038], [0.3, -0.038], [0.275, -0.066], [0.225, -0.066]], 0.026, M.poly, 0.006, 0, { r: 0.005 }); b.box(0.02, 0.02, 0.05, 0.36, -0.048, M.steel); b.disc(0.0085, 0.3855, -0.048, M.glass); } // 손멈치와 전등
  if (o.hmg) { b.prof([[-0.07, 0.042], [-0.07, 0.074], [0.13, 0.074], [0.13, 0.042]], 0.052, M.recv, 0.005); b.box(0.054, 0.004, 0.012, 0.118, 0.06, M.steel); }  // 급탄 덮개
  if (heavy && !(o.hmg && A.opt)) { b.prof([[0.15, 0.05], [0.16, 0.085], [0.27, 0.085], [0.28, 0.05], [0.268, 0.05], [0.262, 0.073], [0.168, 0.073], [0.162, 0.05]], 0.014, M.steel, 0.003, o.hmg ? 0 : 0.03); } // 운반 손잡이
  // 레일과 조준기
  if (!o.hmg) rail(b, -0.087, hg - 0.005, 0.042, M); else rail(b, 0.14, hg - 0.005, 0.042, M);
  let sight = 0.0905, fore = o.burst && !A.grp ? [0, -0.08, -0.235] : [0, -0.04, -0.27];
  const op = A.opt || (o.dmr ? 'holoL' : o.lmg || o.supp ? 'holo' : '');
  if (A.grp) fore = underGrip(b, A.grp, 0.25, -0.038, M);
  if (A.las) laserAtt(b, hg - 0.075, 0.004, -(hw / 2 + 0.008), M);
  if (op && o.hmg) { rail(b, -0.065, 0.125, 0.074, M); sight = optic(b, op, 0.0, 0.083, M); } // 중기관총: 급탄 덮개 위에 얹음 (운반 손잡이는 뗌)
  else if (op) sight = optic(b, op, o.dmr && !A.opt ? -0.01 : -0.02, 0.051, M);
  else if (o.burst) {                                              // 운반 손잡이형 가늠자 + 세모 가늠쇠
    for (const s of [-1, 1]) b.prof([[-0.09, 0.05], [-0.082, 0.082], [0.03, 0.082], [0.085, 0.05], [0.07, 0.05], [0.022, 0.071], [-0.07, 0.071], [-0.074, 0.05]], 0.005, M.recv, 0.0015, s * 0.0125);
    b.ring(0.0062, 0.0018, -0.07, 0.0905, M.steel); b.box(0.03, 0.006, 0.012, -0.07, 0.0815, M.recv);
    b.prof([[0.35, 0.05], [0.372, 0.092], [0.38, 0.092], [0.4, 0.05]], 0.03, M.recv, 0.003, 0, { holes: [[[0.362, 0.056], [0.374, 0.08], [0.378, 0.08], [0.388, 0.056]]] });
    b.box(0.003, 0.012, 0.004, 0.376, 0.086, M.bolt);
  } else if (!o.hmg) {                                             // 접이식 가늠자·가늠쇠
    b.box(0.03, 0.01, 0.034, -0.06, 0.056, M.recv); for (const s of [-1, 1]) b.box(0.005, 0.03, 0.012, -0.06, 0.076, M.recv, s * 0.0125);
    b.ring(0.0062, 0.0018, -0.06, 0.0905, M.steel); b.xcyl(0.004, 0.036, -0.06, 0.063, M.steel);
    b.box(0.026, 0.01, 0.03, 0.375, 0.056, M.recv); b.box(0.0035, 0.03, 0.005, 0.375, 0.076, M.bolt);
    for (const s of [-1, 1]) b.box(0.004, 0.032, 0.018, 0.375, 0.074, M.recv, s * 0.011, 0, s * 0.2);
  } else { sight = 0.105; b.box(0.022, 0.02, 0.02, -0.06, 0.084, M.recv); b.ring(0.006, 0.0018, -0.06, 0.105, M.steel); b.box(0.004, 0.05, 0.006, 0.44, 0.08, M.bolt); b.box(0.018, 0.012, 0.02, 0.44, 0.058, M.recv); }
  // 총열 · 총구
  const end = (o.dmr ? 0.66 : o.lmg ? 0.62 : o.hmg ? 0.68 : o.burst ? 0.5 : 0.54) + dl, br = heavy ? 0.0125 : o.dmr ? 0.011 : 0.0095;
  b.cyl(br, br, hg - 0.005, end - hg + 0.005, 0, M.steel);
  b.cyl(0.015, 0.015, hg + 0.005, 0.028, 0, M.recv, 0, 10);
  if (o.dmr || heavy) for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; b.box(0.0025, 0.0025, end - hg - 0.06, (hg + end) / 2 + 0.01, Math.cos(a) * br, M.dark, Math.sin(a) * br); } // 총열 홈
  let tip;
  if (o.supp) { tip = suppressor(b, end - 0.03, 0.185, 0.02, 0, M); if (K.muzzle) tip = K.muzzle(b, M, tip - 0.01, 0, 0.017, 0.045); }
  else if (A.muz) tip = muzzleAtt(b, A.muz, end, 0, heavy ? 0.017 : 0.014, M);
  else if (K.muzzle) tip = K.muzzle(b, M, end - 0.005, 0, heavy ? 0.017 : 0.014, heavy ? 0.06 : 0.05);
  else tip = muzzleBrake(b, end - 0.005, 0, M, heavy ? 0.017 : 0.014, heavy ? 0.06 : 0.05);
  if ((heavy || o.dmr) && !A.grp) bipod(b, hg - 0.02, -0.044, M);
  // 개머리판
  if (K.orn) K.orn(b, M, { f0: -0.1, f1: 0.13, top: 0.042, u: 0.012, hw: 0.0222 });
  const SK = A.stk ? (b2, M2, r) => stockPart(b2, A.stk, M2, r, F) : K.stock;
  if (SK) SK(b, M, { f: -0.105, end: -0.352, top: 0.032, bot: -0.108, j0: -0.04, w: 0.042 });
  else if (o.dmr || heavy) {
    b.prof([[-0.105, 0.03], [-0.33, 0.03], [-0.35, 0.012], [-0.35, -0.105], [-0.325, -0.11], [-0.2, -0.05], [-0.105, -0.04]], 0.04, F, 0.007, 0, { r: 0.006, holes: o.dmr ? [[[-0.22, -0.02], [-0.31, -0.02], [-0.31, -0.07], [-0.24, -0.04]]] : [] });
    b.prof([[-0.19, 0.03], [-0.2, 0.046], [-0.3, 0.046], [-0.31, 0.03]], 0.036, M.poly, 0.005);
    buttPad(b, -0.35, -0.045, 0.118, M);
  } else {
    b.cyl(0.0145, 0.0145, -0.3, 0.195, 0.006, M.steel); b.cyl(0.0185, 0.0185, -0.114, 0.01, 0.006, M.steel, 0, 8);
    b.prof([[-0.19, 0.032], [-0.335, 0.032], [-0.352, 0.016], [-0.352, -0.1], [-0.326, -0.108], [-0.272, -0.036], [-0.19, -0.024]], 0.042, F, 0.006, 0, { r: 0.005, holes: [[[-0.305, -0.03], [-0.338, -0.03], [-0.338, -0.082], [-0.322, -0.086]]] });
    b.box(0.014, 0.012, 0.04, -0.235, -0.03, M.steel); for (const s of [-1, 1]) b.sdisc(0.006, -0.3, 0.012, s * 0.0214, M.dark);
    buttPad(b, -0.352, -0.042, 0.118, M);
  }
  return { group: b.build(), muzzle: [0, 0, -(tip + 0.015)], grip: [0, -0.1, 0.085], fore, sight, adsZ: b.adsZ, travel: 0.055 };
}

// ───────────── 샷건: 펌프(나무) / 자동(auto: 상자 탄창, 권총손잡이) ─────────────
function shotgun(M, o = {}) {
  const b = new Builder(), W = o.auto ? M.furn : M.wood, W2 = o.auto ? M.dark : M.woodDark, K = o.kit || {}, A = o.att || {}, dl = barDl(A);
  const SK = A.stk ? (b2, M2, r) => stockPart(b2, A.stk, M2, r, W) : K.stock;
  b.prof([[-0.115, -0.038], [-0.125, 0.018], [-0.105, 0.036], [0.125, 0.036], [0.125, -0.048], [-0.03, -0.048]], 0.046, M.recv, 0.005, 0, { r: 0.004 });
  b.box(0.002, 0.02, 0.07, 0.04, 0.008, M.dark, 0.0234); b.box(0.002, 0.013, 0.06, 0.04, 0.009, M.bolt, 0.0238);
  b.xcyl(0.0035, 0.048, -0.07, -0.02, M.bolt); b.xcyl(0.0035, 0.048, 0.09, -0.03, M.bolt); b.sdisc(0.005, -0.09, 0.012, -0.0234, M.accent);
  if (o.label) b.label(o.label, 0.03, 0.016, -0.0238, 0.07, 0.018);
  tguard(b, -0.045, -0.046, M);
  b.cyl(0.0135, 0.0125, 0.125, (o.auto ? 0.44 : 0.52) + dl, 0.016, M.steel);
  let tip = (o.auto ? 0.565 : 0.645) + dl;
  if (A.muz) tip = muzzleAtt(b, A.muz, tip, 0.016, 0.0145, M);
  else if (K.muzzle) tip = K.muzzle(b, M, tip - 0.006, 0.016, 0.0145, 0.045);
  else { b.cyl(0.0145, 0.0145, tip - 0.02, 0.02, 0.016, M.recv); b.disc(0.0098, tip + 0.0005, 0.016, M.dark); }
  if (K.orn) K.orn(b, M, { f0: -0.115, f1: 0.12, top: 0.036, u: 0, hw: 0.0232 });
  b.box(0.01, 0.0035, 0.36, 0.3, 0.0312, M.steel); for (let i = 0; i < 9; i++) b.box(0.006, 0.006, 0.006, 0.14 + i * 0.04, 0.0275, M.steel); // 뜬 가늠대
  if (o.auto) {
    b.part('mag'); b.prof([[0.02, -0.048], [0.1, -0.048], [0.106, -0.17], [0.03, -0.17]], 0.034, M.mag, 0.004); for (const u of [-0.09, -0.12, -0.15]) b.box(0.036, 0.004, 0.07, 0.066, u, M.steel); b.box(0.038, 0.008, 0.082, 0.068, -0.172, M.rubber); b.part();
    if (A.mag) magAtt(b, A.mag, 0.03, 0.106, -0.176, 0.035, M, 0.004);
    if (A.las) laserAtt(b, 0.33, -0.01, -0.033, M);
    if (K.hg) K.hg(b, M, { f0: 0.125, f1: 0.4, u0: -0.045, u1: 0.008, w: 0.05 });
    else { b.prof([[0.125, -0.045], [0.125, 0.008], [0.4, 0.008], [0.4, -0.03], [0.38, -0.045]], 0.05, W, 0.006); slots(b, 0.165, 5, 0.045, -0.018, 0.0252, M); }
    b.cyl(0.011, 0.011, 0.4, 0.1, -0.014, M.steel); b.cyl(0.013, 0.013, 0.49, 0.012, -0.014, M.recv, 0, 10);
    b.box(0.002, 0.007, 0.08, 0.03, 0.02, M.dark, -0.0234); b.part('slide'); b.box(0.012, 0.01, 0.012, 0.06, 0.02, M.bolt, -0.028); b.xcyl(0.0055, 0.012, 0.06, 0.02, M.bolt, -0.036); b.part();
    pistolGrip(b, M, -0.02, 0.002);
    if (SK) SK(b, M, { f: -0.115, end: -0.38, top: 0.03, bot: -0.108, j0: -0.03, w: 0.04 });
    else {
      b.prof([[-0.115, 0.03], [-0.36, 0.03], [-0.38, 0.012], [-0.38, -0.105], [-0.355, -0.11], [-0.22, -0.04], [-0.115, -0.03]], 0.04, W, 0.007, 0, { r: 0.006, holes: [[[-0.24, -0.015], [-0.34, -0.015], [-0.34, -0.07], [-0.26, -0.035]]] });
      buttPad(b, -0.38, -0.04, 0.118, M);
    }
    rail(b, -0.09, 0.11, 0.036, M);
    const sg = optic(b, A.opt || 'holo', 0.02, 0.045, M), afore = A.grp ? underGrip(b, A.grp, 0.26, -0.045, M) : [0, -0.05, -0.28];
    return { group: b.build(), muzzle: [0, 0.016, -(tip + 0.015)], grip: [0, -0.1, 0.1], fore: afore, sight: sg, adsZ: b.adsZ, travel: 0.05 };
  }
  b.box(0.03, 0.006, 0.09, 0.05, -0.05, M.steel);
  b.cyl(0.012, 0.012, 0.125, 0.4, -0.016, M.steel); b.cyl(0.0135, 0.0135, 0.525, 0.016, -0.016, M.recv, 0, 10);
  b.box(0.012, 0.05, 0.014, 0.5, 0, M.recv);
  if (!K.muzzle && !A.muz) b.vcyl(0.003, 0.008, 0.635 + dl, 0.035, M.brass);
  if (A.mag === 'ext') { b.cyl(0.012, 0.012, 0.541, 0.085, -0.016, M.steel); b.cyl(0.0135, 0.0135, 0.62, 0.008, -0.016, M.recv, 0, 10); } else if (A.mag) b.cyl(0.0142, 0.0142, 0.5, 0.02, -0.016, M.accent, 0, 12);
  if (A.las) laserAtt(b, 0.46, 0.0, -0.03, M);
  let psight = 0.06;
  if (A.opt) { rail(b, -0.09, 0.11, 0.036, M); psight = optic(b, A.opt, 0.0, 0.045, M); }
  b.part('slide');                                                // 펌프 손잡이 (쏘고 나면 당겨짐)
  if (K.hg) K.hg(b, M, { f0: 0.2, f1: 0.38, u0: -0.043, u1: 0.007, w: 0.05 });
  else { b.cyl(0.0245, 0.0245, 0.2, 0.18, -0.018, W, 0, 14); for (let i = 0; i < 8; i++) b.cyl(0.0258, 0.0258, 0.21 + i * 0.021, 0.008, -0.018, W2, 0, 14); }
  b.box(0.008, 0.008, 0.2, 0.2, 0.004, M.steel, -0.02);
  b.part();
  if (SK) { // 손목 부분은 남기고 그 뒤를 바꿈
    b.prof([[-0.105, 0.024], [-0.17, 0.014], [-0.205, 0.011], [-0.215, -0.072], [-0.165, -0.082], [-0.13, -0.06], [-0.11, -0.04]], 0.042, W, 0.009, 0, { r: 0.008 });
    SK(b, M, { f: -0.2, end: -0.404, top: 0.011, bot: -0.13, j0: -0.07, w: 0.042 });
  } else {
    b.prof([[-0.105, 0.024], [-0.17, 0.014], [-0.4, -0.006], [-0.408, -0.128], [-0.39, -0.134], [-0.215, -0.072], [-0.165, -0.082], [-0.13, -0.06], [-0.11, -0.04]], 0.042, W, 0.009, 0, { r: 0.008 });
    buttPad(b, -0.404, -0.068, 0.124, M, 0.042);
    for (const s of [-1, 1]) b.sdisc(0.007, -0.3, -0.06, s * 0.0214, M.brass);
  }
  return { group: b.build(), muzzle: [0, 0.016, -(tip + 0.015)], grip: [0, -0.07, 0.15], fore: [0, -0.05, -0.28], sight: psight, adsZ: b.adsZ, travel: 0.075, rack: true, pump: true };
}

// ───────────── 저격총: 중저격총 / 경저격총(light: 짧은 총열, 나무 총몸) ─────────────
function sniper(M, o = {}) {
  const b = new Builder(), S = o.light ? M.wood : M.olive, K = o.kit || {}, A = o.att || {}, dl = barDl(A);
  const SK = A.stk ? (b2, M2, r) => stockPart(b2, A.stk, M2, r, S) : K.stock;
  if (SK) { // 가운데 몸통만 남기고 앞(총열덮개)과 뒤(개머리판)를 스킨·파츠 형태로
    b.prof([[0.1, -0.014], [0.1, -0.054], [0.02, -0.052], [-0.022, -0.062], [-0.06, -0.135], [-0.102, -0.14], [-0.108, -0.085], [-0.165, -0.062], [-0.165, 0.0], [-0.11, -0.006], [-0.11, -0.014]], 0.046, S, 0.008, 0, { r: 0.006 });
    if (K.hg) K.hg(b, M, { f0: 0.1, f1: 0.37, u0: -0.056, u1: 0.018, w: 0.046 });
    else { b.prof([[0.37, -0.014], [0.37, -0.04], [0.1, -0.054], [0.1, -0.014]], 0.046, S, 0.008, 0, { r: 0.006 }); for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.box(0.0014, 0.006, 0.03, 0.16 + i * 0.05, -0.034, M.dark, s * 0.0234); }
    SK(b, M, { f: -0.165, end: -0.405, top: 0.03, bot: -0.105, j0: -0.062, w: 0.046 });
    if (K.orn) K.orn(b, M, { f0: -0.1, f1: 0.1, top: -0.004, u: -0.034, hw: 0.0232 });
  } else {
  b.prof([[0.37, -0.014], [0.37, -0.04], [0.1, -0.054], [0.02, -0.052], [-0.022, -0.062], [-0.06, -0.135], [-0.102, -0.14], [-0.108, -0.085], [-0.165, -0.062], [-0.385, -0.105], [-0.405, -0.1], [-0.405, 0.012], [-0.39, 0.03], [-0.215, 0.03], [-0.18, 0.004], [-0.11, -0.006], [-0.11, -0.014]], 0.046, S, 0.008, 0,
    { r: 0.006, holes: o.light ? [] : [[[-0.2, -0.03], [-0.34, -0.03], [-0.34, -0.07], [-0.22, -0.05]]] });
  buttPad(b, -0.405, -0.042, 0.118, M, 0.046);
  for (const s of [-1, 1]) b.sdisc(0.005, -0.37, -0.02, s * 0.0234, M.steel);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) b.box(0.0014, 0.006, 0.03, 0.16 + i * 0.05, -0.034, M.dark, s * 0.0234);
  }
  if (!o.light && !SK) { b.prof([[-0.22, 0.03], [-0.23, 0.05], [-0.34, 0.05], [-0.35, 0.03]], 0.038, M.poly, 0.006); for (const f of [-0.25, -0.32]) b.xcyl(0.005, 0.05, f, 0.02, M.steel); } // 높이 조절 뺨받침
  b.cyl(0.0175, 0.0175, -0.115, 0.26, 0, M.recv);                  // 노리쇠 집
  b.box(0.002, 0.012, 0.07, 0.03, 0.004, M.dark, 0.0176); b.box(0.002, 0.007, 0.062, 0.03, 0.004, M.bolt, 0.018);
  if (o.label) b.label(o.label, 0.085, 0.004, -0.0178, 0.06, 0.015);
  b.cyl(0.0175, 0.013, 0.145, 0.03, 0, M.recv);
  const bl = (o.light ? 0.36 : 0.5) + dl;
  b.cyl(0.013, 0.0098, 0.175, bl, 0, M.steel);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; b.box(0.0028, 0.0028, bl * 0.6, 0.2 + bl * 0.36, Math.cos(a) * 0.0112, M.dark, Math.sin(a) * 0.0112); }
  let tip = 0.175 + bl;
  if (A.muz) tip = muzzleAtt(b, A.muz, tip, 0, o.light ? 0.0125 : 0.016, M);
  else if (K.muzzle) tip = o.light ? K.muzzle(b, M, tip - 0.01, 0, 0.0115, 0.04) : K.muzzle(b, M, 0.67 + dl, 0, 0.016, 0.07);
  else if (!o.light) { const q = 0.67 + dl; b.cyl(0.011, 0.016, q, 0.012, 0, M.steel); b.prof([[q + 0.012, -0.014], [q + 0.012, 0.014], [q + 0.07, 0.014], [q + 0.07, -0.014]], 0.034, M.steel, 0.004, 0, { holes: [[[q + 0.02, -0.008], [q + 0.02, 0.008], [q + 0.034, 0.008], [q + 0.034, -0.008]], [[q + 0.042, -0.008], [q + 0.042, 0.008], [q + 0.058, 0.008], [q + 0.058, -0.008]]] }); tip = q + 0.07; } // 큰 제퇴기
  else { b.cyl(0.0115, 0.0115, tip - 0.014, 0.014, 0, M.recv, 0, 10); b.box(0.004, 0.014, 0.006, tip - 0.02, 0.016, M.bolt); }
  if (!K.muzzle && !A.muz) b.disc(0.006, tip + 0.0005, 0, M.dark);
  b.part('slide');                                                // 노리쇠 손잡이
  b.cyl(0.012, 0.012, -0.14, 0.03, 0, M.bolt, 0, 10);
  b.capsule(0.005, 0.04, [0.018, 0, 0.07], [0.052, -0.022, 0.078], M.bolt);
  b.add(new THREE.SphereGeometry(0.0115, 12, 9).translate(0.056, -0.025, 0.079), M.recv);
  b.part();
  b.part('mag'); b.prof([[0.0, -0.052], [0.085, -0.054], [0.082, -0.102], [0.004, -0.1]], 0.03, M.mag, 0.004); b.box(0.032, 0.006, 0.082, 0.043, -0.103, M.rubber); b.part();
  if (A.mag) magAtt(b, A.mag, 0.004, 0.082, -0.106, 0.031, M, 0);
  if (A.las) laserAtt(b, 0.3, -0.026, -0.031, M);
  tguard(b, -0.045, -0.056, M, M.steel);
  // 조준경
  const su = 0.062, k = o.light ? 0.8 : 1;
  b.cyl(0.0155 * k, 0.0155 * k, -0.07, 0.25, su, M.recv);
  b.cyl(0.0155 * k, 0.027 * k, 0.18, 0.045, su, M.recv);
  b.cyl(0.027 * k, 0.027 * k, 0.225, 0.055, su, M.recv, 0, 20); b.cyl(0.0285 * k, 0.0285 * k, 0.266, 0.016, su, M.steel, 0, 20);
  b.disc(0.0235 * k, 0.272, su, M.glass);
  b.cyl(0.022 * k, 0.0155 * k, -0.115, 0.045, su, M.recv);
  b.cyl(0.022 * k, 0.022 * k, -0.15, 0.036, su, M.recv, 0, 20); b.cyl(0.0235 * k, 0.0235 * k, -0.152, 0.012, su, M.rubber, 0, 20);
  b.disc(0.019 * k, -0.146, su, M.glass, true);
  b.vcyl(0.011, 0.022, 0.05, su + 0.022 * k, M.steel); b.vcyl(0.012, 0.005, 0.05, su + 0.033 * k, M.recv, 0, 16);
  b.xcyl(0.011, 0.022, 0.05, su, M.steel, 0.024, 12); b.xcyl(0.012, 0.005, 0.05, su, M.recv, 0.036, 16);
  b.xcyl(0.008, 0.012, 0.05, su, M.steel, -0.02, 12);
  for (const f of [-0.03, 0.125]) { b.box(0.016, 0.03, 0.018, f, su - 0.03, M.steel); b.cyl(0.0188 * k, 0.0188 * k, f - 0.009, 0.018, su, M.steel, 0, 16); for (const s of [-1, 1]) b.sdisc(0.003, f, su - 0.012, s * 0.0192 * k, M.bolt); }
  rail(b, -0.06, 0.16, 0.014, M, 0.016);
  if (!o.light) bipod(b, 0.345, -0.05, M, 0.017);
  return { group: b.build(), muzzle: [0, 0, -(tip + 0.015)], grip: [0, -0.1, 0.08], fore: [0, -0.055, -0.22], sight: su, travel: 0.06, rack: true };
}

// ───────────── 권총: 기본 / 소음(supp) / 자동(ext: 긴 탄창) ─────────────
function pistol(M, o = {}) {
  const b = new Builder(), SL = o.ext ? M.gray : M.slide, K = o.kit || {}, A = o.att || {};
  b.prof([[-0.088, -0.012], [0.078, -0.012], [0.078, -0.03], [0.03, -0.036], [-0.02, -0.036], [-0.088, -0.03]], 0.026, M.recv, 0.003);      // 몸통
  if (K.hg) K.hg(b, M, { f0: 0.05, f1: 0.1, u0: -0.06, u1: -0.03, w: 0.028 });                                                           // 총열 아래 덧몸
  else for (let i = 0; i < 3; i++) b.box(0.0265, 0.003, 0.005, 0.045 + i * 0.011, -0.031, M.dark);                                         // 아래 레일
  b.prof([[-0.088, -0.03], [-0.03, -0.034], [-0.046, -0.08], [-0.058, -0.132], [-0.11, -0.128], [-0.102, -0.07], [-0.094, -0.04]], 0.03, M.poly, 0.007, 0, { r: 0.005 });
  for (let i = 0; i < 5; i++) b.box(0.0305, 0.0024, 0.006, -0.1 - i * 0.002, -0.06 - i * 0.013, M.dark, 0, 0.12);
  for (const s of [-1, 1]) b.sdisc(0.006, -0.075, -0.085, s * 0.0152, M.accent);
  b.xcyl(0.003, 0.028, -0.01, -0.018, M.bolt); b.box(0.004, 0.006, 0.018, -0.045, -0.014, M.steel, -0.014); b.box(0.004, 0.005, 0.03, 0.02, -0.014, M.steel, -0.014); // 분해 핀, 안전장치, 멈치
  tguard(b, 0.002, -0.034, M, M.recv);
  b.part('mag');
  if (o.ext) { b.prof([[-0.064, -0.128], [-0.106, -0.124], [-0.122, -0.2], [-0.078, -0.204]], 0.024, M.mag, 0.003); b.box(0.027, 0.006, 0.05, -0.1, -0.203, M.rubber, 0, 0.08); }
  else b.box(0.031, 0.009, 0.052, -0.084, -0.134, M.rubber, 0, 0.07);
  b.part();
  if (A.mag) { if (o.ext) magAtt(b, A.mag, -0.122, -0.078, -0.206, 0.025, M, -0.008); else magAtt(b, A.mag, -0.108, -0.062, -0.14, 0.026, M, -0.008); }
  if (A.las) laserAtt(b, 0.072, K.hg ? -0.07 : -0.041, 0, M);
  b.cyl(0.0068, 0.0068, 0.06, 0.036, 0.008, M.bolt);                                                                                         // 총열
  let tip = 0.096;
  if (o.supp) { tip = suppressor(b, 0.094, 0.13, 0.0145, 0.008, M); if (K.muzzle) tip = K.muzzle(b, M, tip - 0.008, 0.008, 0.012, 0.032); }
  else if (A.muz === 'sup') tip = muzzleAtt(b, 'sup', 0.098, 0.008, 0.0105, M);
  else if (A.muz) { b.cyl(0.0068, 0.0068, 0.094, 0.012, 0.008, M.bolt); tip = muzzleAtt(b, A.muz, 0.104, 0.008, 0.0085, M); }
  else if (K.muzzle) tip = K.muzzle(b, M, 0.093, 0.008, 0.0095, 0.036);
  else b.disc(0.0045, tip + 0.0005, 0.008, M.dark);
  b.part('slide');                                                                                                                         // 윗몸 (쏘면 뒤로 밀림)
  b.prof([[-0.092, -0.012], [-0.092, 0.02], [-0.085, 0.027], [0.084, 0.027], [0.092, 0.016], [0.092, -0.012]], 0.028, SL, 0.003);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) b.box(0.0012, 0.022, 0.004, -0.082 + i * 0.008, 0.006, M.dark, s * 0.0142);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) b.box(0.0012, 0.018, 0.004, 0.062 + i * 0.008, 0.008, M.dark, s * 0.0142);
  b.box(0.0016, 0.012, 0.03, 0.025, 0.015, M.dark, 0.0142); b.box(0.0016, 0.007, 0.026, 0.025, 0.015, M.bolt, 0.0146);
  if (o.label) b.label(o.label, 0.02, 0.008, -0.0146, 0.05, 0.0125);
  b.box(0.018, 0.008, 0.012, -0.08, 0.031, M.steel); for (const s of [-1, 1]) b.disc(0.0014, -0.0862, 0.031, M.white, true, s * 0.0055);
  b.box(0.004, 0.008, 0.008, 0.08, 0.031, M.steel); b.disc(0.0014, 0.0758, 0.032, M.white, true);
  if (o.ext) for (let i = 0; i < 2; i++) b.box(0.012, 0.0016, 0.02, 0.02 + i * 0.03, 0.0274, M.dark);
  if (K.orn) K.orn(b, M, { f0: -0.092, f1: 0.092, top: 0.027, u: 0.004, hw: 0.0142, small: true });
  let sight = 0.037;
  if (A.opt) sight = reddot(b, -0.05, 0.027, M);                                                                                          // 윗몸 뒤쪽에 얹음 (함께 움직임)
  b.part();
  b.box(0.008, 0.014, 0.008, -0.094, 0.004, M.steel, 0, 0.3);                                                                                // 공이치기
  return { group: b.build(), muzzle: [0, 0.008, -(tip + 0.015)], grip: [0, -0.085, 0.072], fore: [0.012, -0.075, 0.035], sight, travel: 0.034 };
}

function revolver(M, o = {}) {
  const b = new Builder(), K = o.kit || {}, A = o.att || {}, L = 0.2 + barDl(A) * 0.8;
  let tip = L;
  if (K.muzzle) { tip = K.muzzle(b, M, L - 0.002, 0.012, 0.009, 0.034); K.orn(b, M, { f0: 0.06, f1: L, top: 0.03, u: 0.006, hw: 0.0102, small: true }); }
  b.prof([[-0.06, -0.022], [-0.07, 0.01], [-0.05, 0.03], [0.06, 0.03], [0.06, -0.022], [0.02, -0.03], [-0.03, -0.03]], 0.026, M.slide, 0.003, 0, { r: 0.004 });
  b.cyl(0.0235, 0.0235, -0.012, 0.05, 0.002, M.gray, 0, 18);                                                                                // 탄창(회전식)
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + 0.52; b.cyl(0.0045, 0.0045, -0.006, 0.03, 0.002 + Math.cos(a) * 0.0225, M.dark, Math.sin(a) * 0.0225, 8); const a2 = (i / 6) * 6.283; b.disc(0.0045, 0.0385, 0.002 + Math.cos(a2) * 0.014, M.brass, false, Math.sin(a2) * 0.014); }
  b.prof([[0.06, -0.012], [0.06, 0.03], [L, 0.03], [L, 0.0], [L - 0.01, -0.012]], 0.02, M.slide, 0.003);                                    // 긴 총열
  b.cyl(0.005, 0.005, 0.062, 0.1, -0.014, M.steel, 0, 8);                                                                                  // 탄피 밀대
  b.box(0.007, 0.005, L - 0.07, (L + 0.06) / 2, 0.034, M.steel); for (let i = 0; i < 5; i++) b.box(0.0072, 0.0016, 0.012, 0.075 + i * 0.022, 0.0362, M.dark);
  b.box(0.004, 0.012, 0.01, L - 0.01, 0.04, M.accent); b.box(0.014, 0.01, 0.01, -0.05, 0.036, M.steel);
  b.disc(0.006, L + 0.0005, 0.012, M.dark);
  let sight = 0.047;
  if (A.opt) sight = reddot(b, 0.0, 0.03, M);
  if (A.las) laserAtt(b, 0.125, -0.03, 0, M);
  if (o.label) b.label(o.label, 0.13, 0.012, -0.0106, 0.05, 0.0125);
  b.part('slide'); b.prof([[-0.064, 0.014], [-0.08, 0.036], [-0.092, 0.04], [-0.09, 0.03], [-0.076, 0.012]], 0.008, M.steel, 0.0015); b.part();   // 공이치기
  b.prof([[-0.062, -0.022], [-0.02, -0.03], [-0.04, -0.075], [-0.06, -0.135], [-0.112, -0.125], [-0.1, -0.06], [-0.075, -0.01]], 0.03, M.wood, 0.008, 0, { r: 0.008 });
  for (const s of [-1, 1]) b.sdisc(0.006, -0.072, -0.07, s * 0.0152, M.brass);
  b.xcyl(0.003, 0.031, -0.096, -0.118, M.bolt);
  tguard(b, 0.004, -0.028, M, M.slide);
  return { group: b.build(), muzzle: [0, 0.012, -(tip + 0.015)], grip: [0, -0.085, 0.07], fore: [0.012, -0.075, 0.035], sight, travel: 0.008 };
}

// 짧게 자른 쌍열 산탄총
function sawed(M, o = {}) {
  const b = new Builder(), K = o.kit || {}, A = o.att || {}, dl = barDl(A);
  let tip = 0.25 + dl;
  if (K.muzzle) { tip = K.muzzle(b, M, 0.24 + dl, 0.012, 0.018, 0.04); K.orn(b, M, { f0: -0.06, f1: 0.05, top: 0.03, u: 0, hw: 0.0222, small: true }); }
  b.prof([[-0.06, -0.03], [-0.07, 0.012], [-0.05, 0.03], [0.05, 0.03], [0.05, -0.03]], 0.044, M.slide, 0.004, 0, { r: 0.005 });
  for (const s of [-1, 1]) { b.cyl(0.0128, 0.0128, 0.05, 0.2 + dl, 0.012, M.steel, s * 0.0128, 14); b.disc(0.0095, 0.2505 + dl, 0.012, M.dark, false, s * 0.0128); b.cyl(0.0138, 0.0138, 0.236 + dl, 0.014, 0.012, M.recv, s * 0.0128, 14); }
  b.box(0.008, 0.005, 0.2 + dl, 0.15 + dl / 2, 0.0265, M.steel); b.vcyl(0.003, 0.008, 0.24 + dl, 0.032, M.brass);
  if (A.las) laserAtt(b, 0.12, -0.042, 0, M);
  b.box(0.01, 0.006, 0.03, -0.03, 0.033, M.steel); b.xcyl(0.004, 0.046, 0.045, -0.018, M.bolt);                                              // 꺾음 손잡이와 축
  for (const s of [-1, 1]) { b.sdisc(0.012, -0.01, 0.004, s * 0.0224, M.steel); b.sdisc(0.005, -0.01, 0.004, s * 0.0228, M.brass); }
  if (o.label) b.label(o.label, 0.035, -0.018, -0.0228, 0.045, 0.0115);
  b.part('slide'); for (const s of [-1, 1]) b.prof([[-0.058, 0.02], [-0.072, 0.04], [-0.082, 0.042], [-0.08, 0.032], [-0.068, 0.018]], 0.007, M.steel, 0.0015, s * 0.011); b.part();
  if (K.hg) K.hg(b, M, { f0: 0.05, f1: 0.19, u0: -0.034, u1: -0.002, w: 0.046 });
  else { b.prof([[0.05, -0.03], [0.05, -0.002], [0.19, -0.002], [0.19, -0.022], [0.17, -0.03]], 0.046, M.wood, 0.007, 0, { r: 0.005 }); for (let i = 0; i < 4; i++) b.box(0.047, 0.002, 0.014, 0.08 + i * 0.026, -0.022, M.dark, 0, 0.6); }
  b.prof([[-0.06, -0.03], [-0.02, -0.03], [-0.045, -0.075], [-0.075, -0.13], [-0.125, -0.115], [-0.105, -0.055], [-0.07, 0.0]], 0.034, M.wood, 0.009, 0, { r: 0.008 });
  tguard(b, 0.0, -0.028, M, M.slide);
  return { group: b.build(), muzzle: [0, 0.012, -(tip + 0.015)], grip: [0, -0.085, 0.075], fore: [0, -0.04, -0.12], sight: K.muzzle ? 0.054 : 0.036, travel: 0.008 };
}

// ───────────── 기관단총: 소음형(기본) / 소형 속사형(compact) ─────────────
function smg(M, o = {}) {
  const b = new Builder(), c = o.compact, R = c ? M.gray : M.recv, K = o.kit || {}, A = o.att || {}, dl = barDl(A);
  b.prof([[-0.1, -0.03], [-0.1, 0.03], [-0.088, 0.04], [0.16, 0.04], [0.16, -0.03]], 0.042, R, 0.004);
  b.prof([[-0.1, -0.03], [0.105, -0.03], [0.105, -0.06], [0.02, -0.06], [0.012, -0.048], [-0.072, -0.048], [-0.1, -0.04]], 0.038, M.recv, 0.004);
  b.box(0.002, 0.018, 0.05, 0.05, 0.012, M.dark, 0.0212); b.box(0.002, 0.011, 0.042, 0.05, 0.012, M.bolt, 0.0216);
  b.xcyl(0.0038, 0.044, -0.085, -0.02, M.bolt); b.xcyl(0.0038, 0.044, 0.09, -0.018, M.bolt);
  b.box(0.004, 0.006, 0.02, -0.025, -0.014, M.steel, -0.021, -0.5); b.sdisc(0.002, -0.012, -0.006, -0.0214, M.accent);
  if (o.label) b.label(o.label, 0.08, 0.02, -0.0218, 0.064, 0.016);
  b.box(0.002, 0.007, 0.09, 0.06, 0.004, M.dark, -0.0212); b.part('slide'); b.box(0.012, 0.01, 0.012, 0.095, 0.004, M.bolt, -0.026); b.xcyl(0.0055, 0.012, 0.095, 0.004, M.bolt, -0.034); b.part();
  const hg = c ? 0.215 : 0.275;
  if (K.hg) K.hg(b, M, { f0: 0.16, f1: hg, u0: -0.032, u1: 0.036, w: 0.046, uc: 0 });
  else { b.prof([[0.16, -0.032], [0.16, 0.036], [hg, 0.036], [hg, -0.022], [hg - 0.013, -0.032]], 0.046, M.furn, 0.005); slots(b, 0.185, c ? 1 : 3, 0.032, 0.004, 0.0232, M, 0.022); }
  if (K.orn) K.orn(b, M, { f0: -0.095, f1: 0.155, top: 0.04, u: 0.008, hw: 0.0212 });
  let fore = c ? [0, -0.05, -0.17] : [0, -0.07, -0.218];
  if (A.grp) fore = underGrip(b, A.grp, c ? 0.19 : 0.22, -0.032, M);
  else if (!c) { b.prof([[0.2, -0.032], [0.238, -0.032], [0.232, -0.105], [0.202, -0.105]], 0.03, M.poly, 0.007, 0, { r: 0.006 }); for (let i = 0; i < 3; i++) b.box(0.0305, 0.003, 0.03, 0.218, -0.055 - i * 0.014, M.dark); }
  else b.prof([[0.165, -0.032], [0.205, -0.032], [0.195, -0.05], [0.172, -0.05]], 0.03, M.poly, 0.005);
  b.part('mag');
  if (c) { b.prof([[0.032, -0.055], [0.078, -0.055], [0.084, -0.15], [0.04, -0.15]], 0.024, M.mag, 0.003); b.box(0.027, 0.006, 0.05, 0.062, -0.151, M.rubber); }
  else { b.prof([[0.032, -0.055], [0.078, -0.055], [0.09, -0.215], [0.046, -0.215]], 0.024, M.mag, 0.003); b.box(0.027, 0.006, 0.05, 0.068, -0.216, M.rubber); for (const s of [-1, 1]) b.box(0.0012, 0.1, 0.006, 0.062, -0.13, M.dark, s * 0.0122, 0.075); }
  b.part();
  if (A.mag) { if (c) magAtt(b, A.mag, 0.04, 0.084, -0.154, 0.025, M, 0.004); else magAtt(b, A.mag, 0.046, 0.09, -0.219, 0.025, M, 0.004); }
  if (A.las) laserAtt(b, hg - 0.035, 0.012, -0.031, M);
  pistolGrip(b, M, 0, 0.002);
  tguard(b, 0, -0.048, M);
  rail(b, -0.085, c ? 0.195 : 0.255, 0.04, M);
  let sight = 0.082;
  const fs = c ? 0.19 : 0.25;
  if (A.opt) sight = optic(b, A.opt, -0.01, 0.049, M);
  else {
    b.box(0.028, 0.012, 0.02, -0.06, 0.055, M.recv); for (const s of [-1, 1]) b.box(0.004, 0.02, 0.01, -0.06, 0.07, M.recv, s * 0.011); b.ring(0.0055, 0.0016, -0.06, 0.082, M.steel);
    b.box(0.022, 0.012, 0.022, fs, 0.055, M.recv); b.box(0.0035, 0.024, 0.005, fs, 0.071, M.bolt); for (const s of [-1, 1]) b.box(0.0035, 0.026, 0.014, fs, 0.07, M.recv, s * 0.0095, 0, s * 0.2);
  }
  let tip;
  if (c) {
    b.cyl(0.009, 0.009, hg, 0.05 + dl, 0, M.steel);
    tip = A.muz ? muzzleAtt(b, A.muz, hg + 0.045 + dl, 0, 0.0125, M) : K.muzzle ? K.muzzle(b, M, hg + 0.035 + dl, 0, 0.013, 0.04) : muzzleBrake(b, hg + 0.035 + dl, 0, M, 0.013, 0.032);
  }
  else { b.cyl(0.009, 0.009, 0.275, 0.05 + dl, 0, M.steel); tip = suppressor(b, 0.305 + dl, 0.095, 0.0175, 0, M); if (K.muzzle) tip = K.muzzle(b, M, tip - 0.01, 0, 0.015, 0.04); }
  const SK = A.stk ? (b2, M2, r) => stockPart(b2, A.stk, M2, r, M.furn) : K.stock;
  if (SK) SK(b, M, c ? { f: -0.1, end: -0.25, top: 0.03, bot: -0.062, j0: -0.04, w: 0.034 } : { f: -0.1, end: -0.312, top: 0.03, bot: -0.07, j0: -0.04, w: 0.036 });
  else if (!c) { for (const u of [0.022, -0.022]) b.cyl(0.0055, 0.0055, -0.3, 0.2, u, M.steel, 0, 8); b.prof([[-0.298, 0.04], [-0.298, -0.05], [-0.312, -0.05], [-0.312, 0.04]], 0.032, M.rubber, 0.004); b.box(0.034, 0.012, 0.02, -0.11, 0.0, M.steel); }
  else { b.box(0.03, 0.06, 0.012, -0.106, 0.0, M.rubber); for (const s of [-1, 1]) b.box(0.004, 0.008, 0.12, -0.04, 0.03, M.steel, s * 0.0232); }
  return { group: b.build(), muzzle: [0, 0, -(tip + 0.015)], grip: [0, -0.1, 0.085], fore, sight, adsZ: b.adsZ, travel: 0.045 };
}

function knife(M, o = {}) {
  const b = new Builder(), K = o.kit || {};
  if (K.blade) K.blade(b, M); else {
  b.prof([[0.03, -0.014], [0.2, -0.014], [0.245, 0.006], [0.215, 0.02], [0.03, 0.02]], 0.005, M.bolt, 0.0018);                               // 칼날
  b.prof([[0.035, -0.0145], [0.2, -0.0145], [0.243, 0.005], [0.2, -0.006], [0.035, -0.006]], 0.0056, M.slide, 0.0005);                       // 날 (간 면)
  b.prof([[0.05, 0.004], [0.19, 0.004], [0.19, 0.011], [0.05, 0.011]], 0.0062, M.steel, 0.001);                                             // 홈
  for (let i = 0; i < 7; i++) b.box(0.0054, 0.004, 0.005, 0.05 + i * 0.011, 0.02, M.dark);                                                  // 등 톱니
  }
  b.prof([[0.018, -0.03], [0.034, -0.03], [0.034, 0.03], [0.018, 0.03]], 0.014, M.recv, 0.003, 0, { r: 0.004 });                              // 코등이
  b.prof([[-0.105, -0.016], [0.02, -0.016], [0.02, 0.022], [-0.105, 0.022], [-0.115, 0.003]], 0.026, M.poly, 0.008, 0, { r: 0.006 });
  for (let i = 0; i < 6; i++) b.box(0.0268, 0.04, 0.004, -0.09 + i * 0.018, 0.003, M.dark);
  b.prof([[-0.105, -0.018], [-0.105, 0.024], [-0.125, 0.018], [-0.128, 0.003], [-0.122, -0.012]], 0.022, M.recv, 0.003, 0, { holes: [[[-0.112, -0.004], [-0.112, 0.008], [-0.12, 0.006], [-0.12, -0.002]]] }); // 손잡이 끝과 끈 구멍
  return { group: b.build(), muzzle: [0, 0, -0.25], grip: [0, -0.02, 0.045], fore: [0, 0, 0], sight: 0, oneHand: true, travel: 0 };
}

// ───────────── 오라: 총 둘레에 늘 살아 움직이는 입자 (불티·반짝임·꽃잎·번개) ─────────────
// cfg = { kind: 'ember' 위로 피어오름 | 'spark' 제자리 반짝임 | 'fall' 떨어짐 | 'orbit' 총을 감고 돎, c0, c1 색, n 개수, bolt 번개 색(있으면 번개도 침) }
const auraTex = (() => { const c = canvas(64, (g) => { const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, 'rgba(255,255,255,.75)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64); }); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
function makeAura(cfg, box) {
  const g = new THREE.Group(), n = cfg.n || 46, min = box.min.clone(), size = box.getSize(new THREE.Vector3()), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: cfg.size || Math.max(0.008, size.z * 0.022), map: auraTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; g.add(pts);
  const P = [], c0 = new THREE.Color(cfg.c0), c1 = new THREE.Color(cfg.c1 ?? cfg.c0), tc = new THREE.Color();
  for (let i = 0; i < n; i++) P.push({ x: Math.random(), y: Math.random(), z: Math.random(), ph: Math.random(), sp: 0.6 + Math.random() * 0.8 });
  const step = (t) => {
    for (let i = 0; i < n; i++) {
      const q = P[i], life = (t * q.sp * 0.6 + q.ph) % 1, o = i * 3; let x, y, z, k;
      if (cfg.kind === 'ember') { x = q.x; y = q.y * 0.6 + life * 0.9; z = q.z + Math.sin(t * 2 + i) * 0.02; k = Math.sin(life * Math.PI); }
      else if (cfg.kind === 'fall') { x = q.x + Math.sin(t + i) * 0.08; y = 1.1 - life * 1.3; z = q.z; k = Math.sin(life * Math.PI); }
      else if (cfg.kind === 'orbit') { const a = t * 2.2 * q.sp + q.ph * 6.283; x = 0.5 + Math.cos(a) * 0.62; y = 0.5 + Math.sin(a) * 0.62; z = (q.z + t * 0.05 * q.sp) % 1; k = 0.5 + 0.5 * Math.sin(t * 5 + i); }
      else { x = q.x; y = q.y; z = q.z; k = Math.max(0, Math.sin(life * Math.PI * 2)) ** 3; if (life < 0.02) { q.x = Math.random(); q.y = Math.random(); q.z = Math.random(); } }
      pos[o] = min.x + x * size.x; pos[o + 1] = min.y + y * size.y; pos[o + 2] = min.z + z * size.z;
      tc.copy(c0).lerp(c1, life).multiplyScalar(k * 1.6); col[o] = tc.r; col[o + 1] = tc.g; col[o + 2] = tc.b;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  };
  pts.onBeforeRender = () => step(performance.now() / 1000);
  if (cfg.bolt) { // 번개: 짧게 꺾이는 빛줄기를 자주 새로 그림
    const m = 4, seg = 7, lp = new Float32Array(m * seg * 6), lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    const ln = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(cfg.bolt).multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    ln.frustumCulled = false; g.add(ln); let last = 0;
    ln.onBeforeRender = () => {
      const now = performance.now(); if (now - last < 70) return; last = now;
      for (let b = 0; b < m; b++) {
        const on = Math.random() < 0.55; let x = 0.2 + Math.random() * 0.6, y = 0.35 + Math.random() * 0.4, z = Math.random() * 0.7 + 0.15; const ex = 0.2 + Math.random() * 0.6, ey = 0.35 + Math.random() * 0.4, ez = z + (Math.random() - 0.5) * 0.25;
        for (let s2 = 0; s2 < seg; s2++) { const o = (b * seg + s2) * 6, f = (s2 + 1) / seg, nx = x + (ex - x) / (seg - s2) + (Math.random() - 0.5) * 0.12, ny = y + (ey - y) / (seg - s2) + (Math.random() - 0.5) * 0.12, nz = z + (ez - z) / (seg - s2) + (Math.random() - 0.5) * 0.06;
          const A = on ? [min.x + x * size.x, min.y + y * size.y, min.z + z * size.z] : [0, -99, 0], B = on ? [min.x + nx * size.x, min.y + ny * size.y, min.z + nz * size.z] : [0, -99, 0];
          lp.set(A, o); lp.set(B, o + 3); x = nx; y = ny; z = nz; void f; }
      }
      lg.attributes.position.needsUpdate = true;
    };
  }
  return g;
}
// 에너지 코어: 옆으로 불룩 튀어나온 빛나는 구슬과, 양옆에서 바퀴처럼 도는 눈금 고리 (fc, uc = 자리, R = 구슬 반지름, hw = 몸 반폭)
function energyCore(b, M, fc, uc, R, hw, mc, mr, md, ticks = 12) {
  b.ball(R, [fc, uc, 0], mc, [1, 1, Math.max(1, (hw + 0.004) / R)], 18);
  for (const s of [-1, 1]) { const x = s * (hw + 0.004);
    b.tor(R * 1.12, R * 0.16, [fc, uc, x], md, 0, Math.PI / 2, 6.2832, 28);
    spinAt(b, fc, uc, s * 1.6, () => { b.tor(R * 1.42, R * 0.05, [fc, uc, x + s * 0.001], mr, 0, Math.PI / 2, 6.2832, 32); for (let i = 0; i < ticks; i++) { const a = (i / ticks) * 6.2832; b.box(0.0014, R * 0.22, R * 0.08, fc + Math.cos(a) * R * 1.62, uc + Math.sin(a) * R * 1.62, mr, x + s * 0.001, a); } }, 'x');
    spinAt(b, fc, uc, -s * 0.7, () => { b.tor(R * 1.85, R * 0.035, [fc, uc, x + s * 0.002], mr, 0, Math.PI / 2, 6.2832 * 0.7, 28); b.tor(R * 1.85, R * 0.035, [fc, uc, x + s * 0.002], md, 0, Math.PI / 2, 6.2832 * 0.25, 10); }, 'x');
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; b.prof([[fc + Math.cos(a) * R * 1.0, uc + Math.sin(a) * R * 1.0], [fc + Math.cos(a - 0.25) * R * 2.1, uc + Math.sin(a - 0.25) * R * 2.1], [fc + Math.cos(a + 0.25) * R * 2.1, uc + Math.sin(a + 0.25) * R * 2.1]], 0.003, md, 0.0006, x); }
  }
}
const builders = { rifle, shotgun, sniper, pistol, revolver, sawed, smg, knife };
const LABELS = ['', 'P-12', 'DB-2', 'AP-15', 'SP-13', 'RV-6', 'VX-22', 'SD-30', 'M-6', 'AS-7', 'BR-24', 'DM-12', 'SR-30', 'AR-25', 'LS-5', 'HS-5', 'LM-50', 'HM-100'];
// ───────────── 실제 총 모델 (기본·무료 스킨) ─────────────
// 'Low-Poly Weapon Asset Pack' by r2detta (CC BY 4.0). 모델은 gunmodels.js 가 읽어 둠. 유료(번들) 스킨은 형태가 바뀌므로 코드 모델을 그대로 씀.
// 자리 표기 [u, v] = 옆에서 본 상자 안의 % 위치: u 는 총구(0) → 개머리(100), v 는 위(0) → 아래(100)
// g 오른손(손잡이) · f 왼손 · m 총구 높이 v · s 조준선 높이 v · top 조준경 파츠 자리 · un 총열 아래(손잡이·레이저) · mg 탄창 바닥 [u0, u1, v]
// scope: 모델에 조준경이 붙어 있음 · wood: b50(중간 갈색)을 나무로 · supp: 소음기를 덧붙임 · k: 길이 배율
const GLB_FIT = {
  1: { n: 'Glock17', g: [80, 55], m: 17, s: 3, top: [45, 3], un: [25, 30], mg: [74, 90, 97] },
  2: { n: 'SawedOff', g: [86, 65], f: [52, 35], m: 12, s: 3, un: [40, 40], wood30: true },
  3: { n: 'Deagle', g: [83, 62], m: 22, s: 4, top: [45, 3], un: [30, 38], mg: [72, 88, 98] },
  4: { n: 'Usp45_Silenced', g: [88, 62], m: 15, s: 2, top: [70, 2], un: [57, 35], mg: [84, 95, 98] },
  5: { n: 'Revolver', g: [90, 65], m: 17, s: 3, top: [40, 2], un: [40, 30] },
  6: { n: 'Kriss_Vector', g: [59, 45], f: [33, 38], m: 33, s: 6, top: [45, 8], un: [24, 36], mg: [40, 47, 98] },
  7: { n: 'Mp5K', g: [83, 65], f: [38, 62], m: 22, s: 7, top: [50, 10], un: [22, 30], mg: [30, 40, 95], supp: true },
  8: { n: 'Spas_12', g: [91, 72], f: [40, 42], m: 21, s: 15, top: [62, 16], un: [33, 55] },
  9: { n: 'AA12', g: [70, 62], f: [35, 45], m: 40, s: 15, top: [45, 22], un: [33, 48], mg: [50, 58, 98] },
  10: { n: 'Famas', g: [58, 62], f: [32, 44], m: 34, s: 20, top: [55, 4], un: [30, 47], mg: [68, 77, 98] },
  11: { n: 'ScarH', g: [68, 72], f: [40, 52], m: 33, s: 10, top: [55, 15], un: [35, 48], mg: [48, 57, 98] },
  12: { n: 'VSS_Sniper', g: [64, 70], f: [45, 55], m: 45, s: 13, scope: true, un: [42, 58], mg: [45, 55, 90] },
  13: { n: 'AK47', g: [70, 72], f: [36, 28], m: 20, s: 6, top: [45, 8], un: [34, 30], mg: [40, 50, 95], wood: true },
  14: { n: 'L115_Awp', g: [76, 70], f: [50, 55], m: 43, s: 20, scope: true, un: [45, 60], mg: [57, 65, 80] },
  15: { n: 'Barett', g: [76, 70], f: [45, 40], m: 34, s: 15, scope: true, un: [45, 45], mg: [57, 67, 80] },
  16: { n: 'M249', g: [70, 80], f: [38, 53], m: 30, s: 15, top: [50, 18], un: [38, 55], mg: [50, 56, 75] },
  17: { n: 'Minigun', g: [96, 30], f: [57, 55], m: 30, s: 10, top: [65, 22], spin: true },
};
const procRefs = new Map();
function procRef(wi) { // 같은 무기의 코드 모델 (기본 스킨): 크기와 손 자리·조준 거리를 그대로 이어받음
  if (procRefs.has(wi)) return procRefs.get(wi);
  const [fn, o] = WEAPONS[wi].model, r = builders[fn](matsFor(0, false), { ...(o || {}), label: '', kit: undefined, att: {} }), bx = gunBox(r.group), sz = bx.getSize(new THREE.Vector3());
  const ref = { len: sz.z, grip: r.grip, fore: r.fore, muzzle: r.muzzle, sight: r.sight, adsZ: r.adsZ, travel: r.travel, oneHand: r.oneHand };
  r.group.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
  procRefs.set(wi, ref);
  return ref;
}
function glbGun(wi, M, o) {
  const F = GLB_FIT[wi], mdl = GLB.models && GLB.models[F.n];
  if (!mdl) return null;
  const P = procRef(wi), [, sy, sz] = mdl.size, A = o.att || {};
  // 맞춤: 총열 높이는 코드 모델의 총구 높이에, 손잡이 앞뒤 자리는 코드 모델의 손잡이에. 크기는 손잡이~총구 거리가 같도록
  const unit = (u, v) => [sy / 2 - (v / 100) * sy, -sz / 2 + (u / 100) * sz], gU = unit(F.g[0], F.g[1]), mU = unit(0, F.m);
  const sc = ((P.grip[2] - P.muzzle[2]) / (gU[1] - mU[1])) * (F.k || 1), off = [0, P.muzzle[1] - sc * mU[0], P.grip[2] - sc * gU[1]];
  const at = (u, v) => { const q = unit(u, v); return [0, sc * q[0] + off[1], sc * q[1] + off[2]]; };
  const mat = new THREE.Matrix4().makeTranslation(off[0], off[1], off[2]).multiply(new THREE.Matrix4().makeScale(sc, sc, sc)).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
  const furn = M[(WEAPONS[wi].model[1] || {}).furn || 'furn'];
  const role = (k) => ({ b30: F.wood30 ? M.wood : furn, b50: F.wood ? M.wood : furn, b60: M.recv, b70: M.poly, b80: M.dark, glass: M.glass, white: M.bolt })[k] || M.recv;
  const b = new Builder(), front = at(0, F.m), yM = front[1];
  if (F.spin) b.part('spin', [-front[2], yM, 0], 2.4, 'z');
  for (const [key, geo] of Object.entries(mdl.groups)) {
    const [grp, shade] = key.includes(':') ? key.split(':') : ['', key];
    if (grp === 'spin' && !F.spin) continue;
    b.part(grp === 'mag' ? 'mag' : grp === 'spin' ? 'spin' : '');
    b.add(geo, grp === 'mag' ? M.mag : grp === 'spin' ? (shade === 'white' ? M.bolt : M.steel) : role(shade), mat);
  }
  b.part();
  // 파츠
  const grip = at(F.g[0], F.g[1]);
  let tip = -front[2], sight = at(0, F.s)[1], adsZ = F.scope ? P.adsZ : undefined, fore = F.f ? at(F.f[0], F.f[1]) : [P.fore[0], grip[1] + (P.fore[1] - P.grip[1]), grip[2] + (P.fore[2] - P.grip[2])]; // 권총: 왼손은 오른손 옆
  const pistol = WEAPONS[wi].slot === 'side', r = pistol ? 0.011 : 0.014;
  if (F.supp && !A.muz) { b.cyl(0.019, 0.019, tip - 0.01, 0.16, yM, M.poly, 0, 18); b.cyl(0.0195, 0.0195, tip + 0.13, 0.02, yM, M.steel, 0, 18); tip += 0.15; }
  if (A.muz) tip = muzzleAtt(b, A.muz, tip, yM, r, M);
  if (A.opt && F.top && !F.scope) { const t = at(F.top[0], F.top[1]), f = -t[2]; rail(b, f - 0.07, f + 0.07, t[1] + 0.004, M); b.adsZ = undefined; sight = optic(b, A.opt, f, t[1] + 0.012, M); if (b.adsZ !== undefined) adsZ = b.adsZ; }
  if (F.un && A.grp && !pistol) { const t = at(F.un[0], F.un[1]); fore = underGrip(b, A.grp, -t[2], t[1], M); }
  if (F.un && A.las) { const t = at(F.un[0] + 4, F.un[1]); laserAtt(b, -t[2], t[1] - 0.008, pistol ? 0 : -0.024, M); }
  if (F.mg && A.mag) { const t0 = at(F.mg[0], F.mg[2]), t1 = at(F.mg[1], F.mg[2]); b.part('mag'); magAtt(b, A.mag, -t0[2], -t1[2], t0[1], pistol ? 0.026 : 0.03, M, 0); b.part(); }
  return { group: b.build(), muzzle: [0, yM, -(tip + 0.015)], grip, fore, sight, adsZ, oneHand: P.oneHand, travel: P.travel || 0, glb: true };
}
export const GLB_WEAPONS = Object.keys(GLB_FIT).map(Number);

const cache = new Map();
// 같은 모양·같은 스킨을 여러 번 써도 형태 데이터는 한 번만 만든다
// parts = 파츠 번호 목록, lv = 스킨 레벨 (5 = 각성)
export function makeGun(wi, skin = 0, parts, lv = 1, opt = {}) {
  if (!SKINS[skin]) skin = 0;
  const pl = cleanParts(wi, parts), bun = !!(KITS[SKINS[skin].id] && KITS[SKINS[skin].id].fx.bundle), aw = skin > 0 && (lv >= 5 || bun), pt = bun && pl.length ? (lv >= 5 ? 2 : lv >= 3 ? 1 : 0) : 0, real = GLB.ready && !bun && !opt.proc && !!GLB_FIT[wi], key = wi + ':' + skin + ':' + pl.join('.') + (aw ? 'a' : '') + ':p' + pt + (real ? ':g' : ''); // real: 실제 총 모델
  if (!cache.has(key)) {
    const [fn, opt] = WEAPONS[wi].model, att = {}; for (const pi of pl) att[PARTS[pi].slot] = PARTS[pi].id;
    const r = real ? glbGun(wi, matsFor(skin, aw), { att }) : null;
    if (r) cache.set(key, r);
    else { PS = pt ? { lv: pt } : null; try { cache.set(key, builders[fn](matsFor(skin, aw), { ...(opt || {}), label: LABELS[wi] ? 'SC ' + LABELS[wi] : '', kit: KITS[SKINS[skin].id], att })); } finally { PS = null; } } // 파츠 스킨: 파츠를 단 유료 스킨, Lv.3·5
  } // 파츠 스킨: 파츠를 단 유료 스킨, Lv.3·5
  const src = cache.get(key), group = src.group.clone();
  for (const c of group.children) if (c.userData.spin) { const sp = c.userData.spin, ax = c.userData.axis || 'z'; for (const m of c.children) m.onBeforeRender = () => { c.rotation[ax] = spinPhase() * sp; }; } // 도는 장식 (쏘거나 살펴볼 때 빨라짐)
  const kit = KITS[SKINS[skin].id];
  if (kit && kit.aura && !opt.noAura) { if (!src.box) src.box = gunBox(src.group); group.add(makeAura(kit.aura, src.box)); } // 총 둘레에 늘 피어오르는 불티·번개·반짝이
  return { group, muzzle: src.muzzle, grip: src.grip, fore: src.fore, sight: src.sight, adsZ: src.adsZ, oneHand: src.oneHand, travel: src.travel || 0, rack: !!src.rack, pump: !!src.pump, slide: group.getObjectByName('slide') || null, mag: group.getObjectByName('mag') || null };
}

// 총의 크기 상자 (길게 뻗는 레이저 빛줄기는 빼고 잼)
export function gunBox(group) {
  const box = new THREE.Box3(), t = new THREE.Box3();
  group.updateMatrixWorld(true);
  group.traverse((m) => { if (!m.isMesh || m.material === FIX.beam) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); box.union(t.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld)); });
  return box;
}

// 1인칭용 팔 (장갑 낀 손 + 소매). sleeveMat = 팀 색. 왼손은 'lh' 묶음 (펌프 샷건에서 함께 움직임)
export function makeArms(info, sleeveMat) {
  const b = new Builder();
  const [gx, gy, gz] = info.grip, [fx, fy, fz] = info.fore;
  b.capsule(0.03, 0.05, [gx + 0.004, gy + 0.035, gz - 0.008], [gx + 0.012, gy - 0.03, gz + 0.02], FIX.glove);       // 오른손
  b.capsule(0.011, 0.03, [gx - 0.02, gy + 0.05, gz - 0.03], [gx - 0.014, gy + 0.045, gz - 0.07], FIX.glove);          // 엄지
  b.box(0.05, 0.02, 0.03, -gz + 0.012, gy + 0.03, FIX.gloveHard, gx + 0.026, 0.3);                                   // 손등 보호대
  b.capsule(0.032, 0.3, [gx + 0.02, gy - 0.035, gz + 0.04], [gx + 0.12, gy - 0.24, gz + 0.3], sleeveMat);            // 오른팔
  b.capsule(0.036, 0.02, [gx + 0.018, gy - 0.032, gz + 0.036], [gx + 0.03, gy - 0.056, gz + 0.066], FIX.gloveHard);   // 손목 조임
  if (!info.oneHand) {
    b.part('lh');
    b.capsule(0.03, 0.06, [fx - 0.012, fy - 0.004, fz - 0.035], [fx - 0.012, fy - 0.004, fz + 0.035], FIX.glove);    // 왼손
    b.capsule(0.011, 0.03, [fx - 0.02, fy + 0.026, fz - 0.02], [fx + 0.012, fy + 0.034, fz - 0.03], FIX.glove);
    b.capsule(0.032, 0.34, [fx - 0.03, fy - 0.025, fz + 0.03], [fx - 0.26, fy - 0.3, fz + 0.24], sleeveMat);         // 왼팔
    b.capsule(0.036, 0.02, [fx - 0.028, fy - 0.022, fz + 0.028], [fx - 0.048, fy - 0.046, fz + 0.046], FIX.gloveHard);
    b.part();
  }
  const g = b.build();
  g.userData.lh = g.getObjectByName('lh') || null;
  return g;
}
