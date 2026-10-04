// 맵 그리기 — 질감은 전부 코드로 그려서 만들고, 고정된 물체는 재질별로 하나로 합쳐 가볍게 그린다
import * as THREE from './vendor/three.module.js';
import { ARENA, BOXES, SITES, MAPS, MAP, groundAt, waterAt, boxesNear } from './shared.js';

import { TEX as TEXGEN, setTexQuality, normalMap, decalAtlas, DECALS } from './textures.js';

// 하늘이 비치는 재질(유리·차체): 비스듬히 볼수록 더 많이 비치게 (정면에서는 조금만)
THREE.ShaderChunk.envmap_fragment = THREE.ShaderChunk.envmap_fragment.replace(/specularStrength \* reflectivity/g, 'specularStrength * reflectivity * ( 0.28 + 0.72 * pow( 1.0 - abs( dot( cameraToFrag, worldNormal ) ), 2.0 ) )');

const rnd = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();

function canvasTex(size, draw, repeat = true) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// 질감은 한 번 만들어 맵이 바뀌어도 계속 쓴다 (만드는 데 시간이 걸림). q = 화질
const TEXC = { map: {}, nrm: {}, q: '', aniso: 4 };
export function setWorldQuality(q, renderer) {
  if (TEXC.q && TEXC.q !== q) { for (const k in TEXC.map) TEXC.map[k].dispose(); for (const k in TEXC.nrm) if (TEXC.nrm[k]) TEXC.nrm[k].dispose(); TEXC.map = {}; TEXC.nrm = {}; }
  TEXC.q = q; setTexQuality(q);
  TEXC.aniso = Math.min(q === 'high' ? 8 : q === 'mid' ? 4 : 2, renderer ? renderer.capabilities.getMaxAnisotropy() : 4);
}
function wrapTex(cv, srgb) { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = TEXC.aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
function texOf(k) { // 색 질감 (없는 이름이면 콘크리트)
  if (!TEXC.map[k]) { const r = (TEXGEN[k] || TEXGEN.concrete)(); TEXC.map[k] = wrapTex(r.c, k !== 'noise' && k !== 'detail' && k !== 'grassDetail'); TEXC.nrm[k] = r.h && TEXC.q === 'high' ? wrapTex(normalMap(r.h, r.k), false) : null; }
  return TEXC.map[k];
}
const nrmOf = (k) => (texOf(k), TEXC.nrm[k]);
function decalTex() { // 벽·바닥에 덧붙이는 무늬 모음 (한 장)
  if (!TEXC.map._decal) { const t = new THREE.CanvasTexture(decalAtlas()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = TEXC.aniso; TEXC.map._decal = t; }
  return TEXC.map._decal;
}
// 재질마다 붙일 수 있는 무늬 (DECALS 번호). 같은 번호를 여러 번 적으면 그만큼 자주 나옴
const DECAL_ON = {
  sand: [0, 0, 1, 1, 2, 4, 7], sand2: [0, 1, 1, 2, 4, 7], sandWall: [0, 1, 2, 4, 4],
  con: [2, 4, 4, 5, 7, 9, 10, 11], wall: [2, 4, 4, 5, 7, 10], brick: [4, 4, 7, 11, 2, 8], plaster: [2, 4, 4, 6, 1], stone: [6, 6, 4, 2],
  metal: [5, 5, 4, 9, 10], metalStep: [5, 4], plank: [4, 7], plankDark: [4], barnRed: [4, 4, 7],
  cR: [3], cB: [3], cG: [3], cY: [3], cW: [3], cO: [3], truckBox: [3],
};

// 재질: 색, 질감, 질감 한 장이 덮는 크기(m). fit = 면 크기에 맞춰 정수 번 반복, tv 0 = 높이에 한 장
const MATS = {
  con: { tex: 'concrete', color: 0xffffff, tu: 3, tv: 3 },
  wall: { tex: 'concrete', color: 0xd9d6cc, tu: 3, tv: 3 },
  brick: { tex: 'brick', color: 0xffffff, tu: 2, tv: 2 },
  metal: { tex: 'metal', color: 0xffffff, tu: 2.5, tv: 2.5 },
  roof: { tex: 'roof', color: 0xffffff, tu: 2, tv: 2 },
  crate: { tex: 'crate', color: 0xffffff, tu: 1.1, tv: 1.1, fit: true },
  barrier: { tex: 'barrier', color: 0xffffff, tu: 2, tv: 0, fit: true },
  shelf: { tex: 'shelf', color: 0xffffff, tu: 4.5, tv: 0, fit: true }, shelfLow: { tex: 'shelf', color: 0xffffff, tu: 2.5, tv: 0, fit: true },
  cR: { tex: 'container', color: 0xb8463c, tu: 2.4, tv: 0 }, cB: { tex: 'container', color: 0x2f6aa8, tu: 2.4, tv: 0 },
  cG: { tex: 'container', color: 0x3f8a5a, tu: 2.4, tv: 0 }, cY: { tex: 'container', color: 0xd3a02c, tu: 2.4, tv: 0 },
  cW: { tex: 'container', color: 0xc9cdd0, tu: 2.4, tv: 0 }, cO: { tex: 'container', color: 0xcc6a2a, tu: 2.4, tv: 0 },
  truckBox: { tex: 'container', color: 0xe9edf0, tu: 2.4, tv: 0 },
  sand: { tex: 'plaster', color: 0xffffff, tu: 4, tv: 4 }, sand2: { tex: 'plaster', color: 0xf0d2ae, tu: 4, tv: 4 }, sandWall: { tex: 'plaster', color: 0xf7ecdc, tu: 4, tv: 4 }, sandRoof: { tex: 'plaster', color: 0xd9c6a6, tu: 4, tv: 4 },
  stone: { tex: 'stone', color: 0xffffff, tu: 2.2, tv: 2.2 }, well: { tex: 'stone', color: 0xe8e0d0, tu: 2.2, tv: 2.2 },
  wood: { tex: 'planks', color: 0xffffff, tu: 2, tv: 2 }, cloth: { tex: 'cloth', color: 0xffffff, tu: 1.4, tv: 1.4 }, tentCloth: { tex: 'cloth', color: 0xe9dcc0, tu: 1.6, tv: 0 },
  floorWood: { tex: 'planks', color: 0xd9c4a4, tu: 2.4, tv: 2.4 }, floorCon: { tex: 'concrete', color: 0x9a9890, tu: 3, tv: 3 }, floorTile: { tex: 'tiles', color: 0xf2e6d0, tu: 3, tv: 3 },
  plaster: { tex: 'stucco', color: 0xffffff, tu: 3.5, tv: 3.5 }, plank: { tex: 'boards', color: 0xb99a6e, tu: 2.4, tv: 2.4 }, plankDark: { tex: 'boards', color: 0x6d5137, tu: 2.4, tv: 2.4 },
  barnRed: { tex: 'boards', color: 0xa8432f, tu: 2.4, tv: 2.4 }, hay: { tex: 'hay', color: 0xffffff, tu: 1.4, tv: 1.4, fit: true },
  fence: { tex: 'boards', color: 0x9a7b55, tu: 1.2, tv: 1.2 }, log: { tex: 'planks', color: 0x9a8263, tu: 2, tv: 2 },
  bed: { tex: 'cloth', color: 0x6f8fb8, tu: 1.2, tv: 1.2 }, pillow: { tex: 'stucco', color: 0xffffff, tu: 1, tv: 1 }, cabinet: { tex: 'boards', color: 0x7a5a3c, tu: 1.2, tv: 1.2 }, tableTop: { tex: 'boards', color: 0xa07a4e, tu: 1.4, tv: 1.4 },
  pump: { tex: 'metal', color: 0xd04a3a, tu: 1, tv: 1.5 },
  trainA: { tex: 'metal', color: 0x3a6ea8, tu: 3, tv: 3 }, trainB: { tex: 'metal', color: 0xc8ccd2, tu: 3, tv: 3 }, cityGlass: { tex: 'metal', color: 0x51627a, tu: 3, tv: 3 },
  machine: { tex: 'metal', color: 0x6e8f74, tu: 2, tv: 2 }, vent: { tex: 'metal', color: 0xb9c0c6, tu: 1.5, tv: 1.5 }, metalStep: { tex: 'roof', color: 0xaab2b9, tu: 1, tv: 1 },
};

function mergeGeos(list) { // 여러 도형을 하나로 (인스턴스용)
  let n = 0;
  const gs = list.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of gs) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of gs) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}
class Merger {
  constructor() { this.by = new Map(); this.noAo = new Set(['winWarm', 'glassLit', 'lamp', 'lanternA', 'lanternB', 'lanternC', 'glassPane']); }
  add(key, geo, m) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    if (!this.by.has(key)) this.by.set(key, []);
    this.by.get(key).push(g);
  }
  // 상자. 옆면은 바닥 가까이를 어둡게 칠해(꼭짓점 색) 땅에 놓인 느낌을 낸다. ao = false 면 색을 넣지 않음 (빛나는 재질)
  box(key, x0, y0, z0, x1, y1, z1, uv, ao = true) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    if (this.noAo.has(key)) ao = false;
    const band = ao && h > 0.45 ? Math.min(0.85, h * 0.45) : 0, nq = band ? 10 : 6, nv = nq * 6;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), col = ao ? new Float32Array(nv * 3) : null;
    // 상자마다 밝기를 조금씩 다르게 (같은 재질이 한 덩어리로 보이지 않게)
    const hsh = Math.sin(x0 * 12.9898 + y0 * 37.719 + z0 * 78.233) * 43758.5453, tone = 0.95 + (hsh - Math.floor(hsh)) * 0.1;
    let o = 0;
    const quad = (P, n, U0, V0, U1, V1, c0, c1) => { // P = 왼아래·오른아래·오른위·왼위, c0 = 아래쪽 밝기, c1 = 위쪽 밝기
      const ix = [0, 1, 2, 0, 2, 3], uu = [U0, U1, U1, U0], vv = [V0, V0, V1, V1], cc = [c0, c0, c1, c1];
      for (const i of ix) { pos[o * 3] = P[i][0]; pos[o * 3 + 1] = P[i][1]; pos[o * 3 + 2] = P[i][2]; nor[o * 3] = n[0]; nor[o * 3 + 1] = n[1]; nor[o * 3 + 2] = n[2]; uvs[o * 2] = uu[i]; uvs[o * 2 + 1] = vv[i]; if (col) col[o * 3] = col[o * 3 + 1] = col[o * 3 + 2] = cc[i] * tone; o++; }
    };
    const rep = (du, dv, side) => { let ru = 1, rv = 1; if (uv) { ru = du / uv.tu; rv = uv.tv === 0 ? (side ? 1 : dv / uv.tu) : dv / uv.tv; if (uv.fit) { ru = Math.max(1, Math.round(ru)); rv = Math.max(1, Math.round(rv)); } } return [ru, rv]; };
    const side = (bl, br, n, du) => { // 옆면: bl·br = 바닥의 두 꼭짓점 [x, z]
      const [ru, rv] = rep(du, h, true), lo = 0.56, ym = y0 + band, vm = rv * (band / h);
      if (band) { quad([[bl[0], y0, bl[1]], [br[0], y0, br[1]], [br[0], ym, br[1]], [bl[0], ym, bl[1]]], n, 0, 0, ru, vm, lo, 1); quad([[bl[0], ym, bl[1]], [br[0], ym, br[1]], [br[0], y1, br[1]], [bl[0], y1, bl[1]]], n, 0, vm, ru, rv, 1, 1); }
      else quad([[bl[0], y0, bl[1]], [br[0], y0, br[1]], [br[0], y1, br[1]], [bl[0], y1, bl[1]]], n, 0, 0, ru, rv, 1, 1);
    };
    side([x1, z1], [x1, z0], [1, 0, 0], d); side([x0, z0], [x0, z1], [-1, 0, 0], d);
    side([x0, z1], [x1, z1], [0, 0, 1], w); side([x1, z0], [x0, z0], [0, 0, -1], w);
    { const [ru, rv] = rep(w, d, false); quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], 0, 0, ru, rv, 1, 1); quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], 0, 0, ru, rv, 0.62, 0.62); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!this.by.has(key)) this.by.set(key, []);
    this.by.get(key).push(geo);
  }
  // 세 점씩 삼각형 (양면 재질용). uvScale = 질감 한 장 크기
  tris(key, pts, uvScale = 2) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flat()), 3));
    geo.computeVertexNormals();
    const uv = new Float32Array(pts.length * 2);
    pts.forEach((p, i) => { uv[i * 2] = (p[0] + p[2]) / uvScale; uv[i * 2 + 1] = p[1] / uvScale + (p[0] - p[2]) / (uvScale * 3); });
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.add(key, geo);
  }
  build(key, mat, shadow) {
    const list = this.by.get(key);
    if (!list) return null;
    let n = 0, anyCol = false;
    for (const g of list) { n += g.attributes.position.count; if (g.attributes.color) anyCol = true; }
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = anyCol ? new Float32Array(n * 3).fill(1) : null;
    let o = 0;
    for (const g of list) {
      pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      if (col && g.attributes.color) col.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count; g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) { geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); mat.vertexColors = true; }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = shadow;
    return mesh;
  }
}

function textPlane(text, w, h, opt = {}) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round(512 * h / w);
  const g = cv.getContext('2d');
  if (opt.bg) { g.fillStyle = opt.bg; g.fillRect(0, 0, cv.width, cv.height); if (opt.border) { g.strokeStyle = opt.border; g.lineWidth = 14; g.strokeRect(7, 7, cv.width - 14, cv.height - 14); } }
  g.fillStyle = opt.color || '#f2efe6';
  g.font = `900 ${Math.round(cv.height * (opt.size || 0.7))}px "Arial Black", system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, cv.width / 2, cv.height * 0.54);
  g.globalCompositeOperation = 'destination-out'; // 닳은 페인트 느낌
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.5})`; g.fillRect(rnd() * cv.width, rnd() * cv.height, 1 + rnd() * 5, 1 + rnd() * 2); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
}

// 맵 분위기. sky = 하늘 색 [꼭대기, 중간, 지평선], cl = 구름 [덮인 정도, 밝은 쪽 색, 그늘 색, 짙기], grade = 화면 색 보정
// 빛: 해는 따뜻한 흰빛으로 세게, 하늘빛(hemi)은 푸르게 → 그늘이 푸르스름해져 양지와 또렷이 갈림
const THEMES = {
  dock: { sky: ['#1b56b4', '#4a92dc', '#bcd8f0'], cl: [0.44, 0xffffff, 0x9db0c8, 0.96], fog: 0xcbdcea, fogD: [110, 430], hemi: [0xcfe0ff, 0x8d877c, 1.3], sun: [0xfff2dc, 3.0, [-0.64, 0.61, -0.46]], floor: 'asphalt', out: 0x50545a, outTex: 'asphalt', cap: 'dark',
    grade: { sat: 1.05, con: 1.03, gain: [1, 1, 1.01], lift: [0, 0.002, 0.006], bloom: 0.5 } },
  town: { sky: ['#2260bc', '#62a0e0', '#e6dcc6'], cl: [0.3, 0xfffaf0, 0xc4b6a4, 0.92], fog: 0xe6d8bc, fogD: [110, 430], hemi: [0xd2e2ff, 0xc9a877, 1.25], sun: [0xfff0d8, 3.0, [-0.78, 0.51, 0.37]], floor: 'sandFloor', out: 0xc7aa7c, outTex: 'sandFloor', cap: 'sandCap',
    grade: { sat: 1.05, con: 1.03, gain: [1.02, 1, 0.97], lift: [0.005, 0.003, 0], bloom: 0.55 } },
  station: { sky: ['#2c3f86', '#a87a9c', '#f6b27e'], cl: [0.52, 0xffd6b2, 0x8e6f92, 0.95], fog: 0xe6bc9c, fogD: [100, 400], hemi: [0xc6c6f2, 0x7c6c62, 1.6], sun: [0xffb87e, 2.9, [-0.8, 0.38, 0.42]], floor: 'gravel', out: 0x5a554e, outTex: 'gravel', cap: 'dark',
    grade: { sat: 1.05, con: 1.04, gain: [1.03, 0.995, 0.96], lift: [0, 0.003, 0.012], bloom: 0.75, thresh: 0.95 } },
  castle: { sky: ['#1c5cc0', '#4f9ae4', '#b6d9f4'], cl: [0.5, 0xffffff, 0xa3b6cc, 0.96], fog: 0xcbe0ee, fogD: [110, 430], hemi: [0xd0e2ff, 0x74905a, 1.3], sun: [0xfff3da, 3.05, [0.5, 0.66, -0.5]], floor: 'grassFloor', out: 0x5f8a4a, outTex: 'grassFloor', cap: 'stoneCol',
    grade: { sat: 1.06, con: 1.03, gain: [1, 1.005, 0.99], lift: [0, 0.002, 0.005], bloom: 0.5 } },
  city: { sky: ['#040714', '#0b1430', '#222a55'], cl: [0.42, 0x39416e, 0x10142a, 0.85], stars: 1, fog: 0x191e36, fogD: [70, 300], hemi: [0x93a5e2, 0x3e4050, 1.3], sun: [0xa8b8ff, 1.05, [0.4, 0.75, 0.5]], floor: 'asphalt', out: 0x1c1e24, outTex: 'asphalt', cap: 'dark', night: true,
    grade: { sat: 1.08, con: 1.05, gain: [0.97, 1, 1.05], lift: [0, 0.003, 0.014], bloom: 1.0, thresh: 0.85, vig: 0.28 } },
  isle: { sky: ['#1c5cc0', '#4f9ae4', '#b6d9f4'], cl: [0.48, 0xffffff, 0xa3b6cc, 0.96], fog: 0xc4dff0, fogD: [170, 720], hemi: [0xd0e2ff, 0x7a8f62, 1.3], sun: [0xfff2d8, 3.05, [-0.55, 0.66, 0.5]], floor: null, out: 0, water: 0x1f6f9c,
    grade: { sat: 1.06, con: 1.03, gain: [1, 1.005, 0.99], lift: [0, 0.002, 0.005], bloom: 0.5 } },
};
// 섬의 날씨·시간대 (경기마다 바뀜): 0 맑은 낮, 1 노을, 2 흐리고 안개
export const MOODS = [
  { name: '맑은 낮' },
  { name: '노을', sky: ['#2c3f86', '#b8789a', '#ffb470'], cl: [0.54, 0xffd0aa, 0x94708e, 0.95], fog: 0xeebe9c, fogD: [150, 640], hemi: [0xc6c6f0, 0x84745f, 1.55], sun: [0xffac68, 2.9, [-0.84, 0.3, 0.45]], water: 0x2c5a80,
    grade: { sat: 1.05, con: 1.04, gain: [1.03, 0.995, 0.96], lift: [0, 0.003, 0.012], bloom: 0.75, thresh: 0.95 } },
  { name: '안개', sky: ['#7b8ea2', '#a2b0be', '#c4cdd4'], cl: [0.95, 0xe4e9ee, 0xaab4be, 1], fog: 0xc0c9d0, fogD: [50, 300], hemi: [0xd4dde8, 0x707a66, 1.5], sun: [0xe6eaee, 1.3, [-0.4, 0.8, 0.44]], water: 0x3f6a80,
    grade: { sat: 0.92, con: 1.02, gain: [0.99, 1, 1.01], lift: [0.008, 0.01, 0.014], bloom: 0.4 } },
];

// 하늘: 높이에 따른 색, 해(달)와 그 둘레의 빛, 흘러가는 구름(해 쪽 가장자리가 밝고 속은 어두움), 밤에는 별
const SKY_VS = 'varying vec3 vDir;\nvoid main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); gl_Position = p.xyww; }';
const SKY_FS = `
uniform vec3 uZen; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uGnd; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uCloud; uniform vec3 uShade;
uniform float uCover; uniform float uAlpha; uniform float uTime; uniform float uStars; uniform float uDisc;
uniform sampler2D uNoise;
varying vec3 vDir;
float cl( vec2 q ) { return texture2D( uNoise, q ).r * 0.5 + texture2D( uNoise, q * 2.37 + 0.37 ).g * 0.3 + texture2D( uNoise, q * 5.3 + 0.11 ).b * 0.2; }
float hash3( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
void main() {
  vec3 d = normalize( vDir );
  float y = d.y, t = pow( clamp( y, 0.0, 1.0 ), 0.5 );
  vec3 col = mix( uHor, uMid, smoothstep( 0.0, 0.42, t ) );
  col = mix( col, uZen, smoothstep( 0.36, 1.0, t ) );
  float sd = max( dot( d, uSunDir ), 0.0 );
  col += uSunCol * ( pow( sd, 6.0 ) * 0.1 + pow( sd, 48.0 ) * 0.26 + pow( sd, 500.0 ) * 0.7 );
  col += uSunCol * pow( sd, 3.0 ) * 0.16 * ( 1.0 - smoothstep( 0.0, 0.45, y ) );
  if ( uStars > 0.0 && y > 0.0 ) {
    vec3 q = d * 190.0, c = floor( q ); float h = hash3( c );
    float tw = 0.6 + 0.4 * sin( uTime * ( 1.0 + h * 3.0 ) + h * 40.0 );
    col += vec3( 0.9, 0.95, 1.0 ) * step( 0.992, h ) * smoothstep( 0.42, 0.0, length( fract( q ) - 0.5 ) ) * tw * smoothstep( 0.0, 0.25, y ) * uStars * 1.6;
  }
  float dens = 0.0;
  if ( y > 0.0 ) {
    vec2 p = d.xz / ( y + 0.12 ), w = vec2( uTime * 0.004, uTime * 0.0015 ), q = p * 0.19 + w;
    // 높은 하늘의 엷은 새털구름
    float ci = texture2D( uNoise, p * vec2( 0.021, 0.064 ) + w * 0.4 + 0.2 ).b * 0.6 + texture2D( uNoise, p * vec2( 0.05, 0.16 ) - w * 0.3 ).r * 0.4;
    col = mix( col, mix( uHor, uCloud, 0.75 ), smoothstep( 0.5, 0.74, ci ) * 0.3 * uAlpha * smoothstep( 0.02, 0.3, y ) * min( 1.0, uCover * 2.2 ) );
    // 뭉게구름
    float big = texture2D( uNoise, q * 0.23 + 0.53 ).g - 0.5;
    float n = cl( q ) + big * 0.55;
    float e0 = 0.475 + ( 0.5 - uCover ) * 0.3;
    dens = smoothstep( e0, e0 + 0.075, n );
    float thick = smoothstep( e0 + 0.03, e0 + 0.2, n );
    vec2 ls = normalize( uSunDir.xz + vec2( 1e-4 ) ) * 0.03;
    float n2 = cl( q + ls ) + big * 0.55;
    float lit = clamp( ( n - n2 ) * 9.0, -1.0, 1.0 );
    vec3 cc = mix( uCloud, uShade, clamp( thick * 0.9 - lit * 0.4, 0.0, 1.0 ) );
    cc += uSunCol * pow( sd, 10.0 ) * 0.5 * ( 1.0 - thick );
    cc = mix( uHor, cc, 0.35 + 0.65 * smoothstep( 0.0, 0.3, y ) );
    dens *= smoothstep( 0.0, 0.09, y ) * uAlpha;
    col = mix( col, cc, dens );
  }
  col += uSunCol * smoothstep( uDisc, uDisc + 0.00016, sd ) * 9.0 * ( 1.0 - dens );
  col = mix( col, uGnd, smoothstep( 0.0, -0.1, y ) );
  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 물: 잔물결이 흐르고, 비스듬히 볼수록 하늘이 비치며, 해 쪽으로는 반짝임이 생긴다
const WATER_VS = `
#include <common>
#include <fog_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4( position, 1.0 );
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FS = `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uNoise; uniform float uTime; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uAlpha; uniform float uBump;
varying vec3 vWorld;
void main() {
  vec3 toCam = cameraPosition - vWorld; float dist = length( toCam ); vec3 V = toCam / dist;
  vec2 p = vWorld.xz;
  vec3 a = texture2D( uNoise, p * 0.021 + vec2( uTime * 0.006, uTime * 0.004 ) ).rgb;
  vec3 b = texture2D( uNoise, p * 0.067 - vec2( uTime * 0.011, -uTime * 0.008 ) ).rgb;
  vec3 c = texture2D( uNoise, p * 0.19 + vec2( -uTime * 0.021, uTime * 0.017 ) ).rgb;
  vec2 g = ( a.rg - 0.5 ) * 1.1 + ( b.gb - 0.5 ) * 0.8 + ( c.br - 0.5 ) * 0.45;
  float k = uBump / ( 1.0 + dist * 0.012 );
  vec3 N = normalize( vec3( g.x * k, 1.0, g.y * k ) );
  float fres = 0.03 + 0.97 * pow( 1.0 - max( dot( N, V ), 0.0 ), 5.0 );
  vec3 R = reflect( -V, N ); R.y = abs( R.y );
  vec3 sky = mix( uHor, uSky, smoothstep( 0.0, 0.55, R.y ) );
  float sd = max( dot( R, uSunDir ), 0.0 );
  vec3 spec = uSunCol * ( pow( sd, 260.0 ) * 5.0 + pow( sd, 22.0 ) * 0.16 );
  vec3 col = mix( uDeep * ( 0.7 + 0.55 * a.r ), sky, fres ) + spec;
  gl_FragColor = vec4( col, mix( uAlpha, 1.0, fres ) );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function buildWorld(scene, renderer, opt = {}) {
  const shadows = opt.shadows !== false;
  const map = MAPS[MAP], key = map.key, theme = map.theme || key, town = theme === 'town', dock = theme === 'dock', isle = key === 'isle';
  const hx = ARENA.hx, hz = ARENA.hz;
  const getTex = texOf, low = TEXC.q === 'low';
  const mg = new Merger();
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  // 가까이에서도 흐릿하지 않게 잔 알갱이를 곱하고, 같은 질감이 되풀이되는 티가 나지 않게 넓은 얼룩을 곱함 (화질 '낮음'은 뺌). 땅에는 물체 둘레의 그늘(ao)도 곱함
  const detailTex = low ? null : texOf('detail'), macroTex = low ? null : texOf('noise');
  const fx = (m, k = 6, ao) => {
    if (!detailTex && !ao) return m;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.detailMap = { value: detailTex }; sh.uniforms.macroMap = { value: macroTex }; if (ao) { sh.uniforms.aoTex = { value: ao.tex }; sh.uniforms.aoST = { value: ao.st }; }
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D detailMap; uniform sampler2D macroMap;' + (ao ? '\nuniform sampler2D aoTex; uniform vec4 aoST;' : ''))
        .replace('#include <map_fragment>', '#include <map_fragment>' + (detailTex ? `\n\tdiffuseColor.rgb *= ( texture2D( detailMap, vMapUv * ${k.toFixed(1)} ).r * 0.8 + 0.6 ) * ( 0.66 + 0.4 * texture2D( macroMap, vMapUv * 0.173 ).r + 0.28 * texture2D( macroMap, vMapUv * 0.037 + 0.31 ).g );` : '') + (ao ? '\n\tdiffuseColor.rgb *= texture2D( aoTex, vMapUv * aoST.xy + aoST.zw ).r;' : ''));
    };
    m.customProgramCacheKey = () => 'fx' + (detailTex ? k : 'n') + (ao ? 'a' : '');
    return m;
  };
  // 질감을 입힌 재질 (화질 '높음'은 요철 지도까지)
  const tmat = (texKey, o = {}, k = 6) => { const m = lam({ map: texOf(texKey), ...o }), n = nrmOf(texKey); if (n) m.normalMap = n; return fx(m, k); };
  // 땅에 닿은 물체 둘레를 어둡게 하는 그늘 지도 (경기장 전체를 덮는 그림 한 장)
  const aoCanvas = (hxx, hzz, size) => {
    const ppm = Math.min(8, size / (Math.max(hxx, hzz) * 2)), cv = document.createElement('canvas'); cv.width = Math.ceil(hxx * 2 * ppm); cv.height = Math.ceil(hzz * 2 * ppm);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = ppm * 1.1; g.fillStyle = 'rgba(0,0,0,.34)';
    for (const b of BOXES) {
      if (b.nv || b.max[1] - b.min[1] < 0.3) continue;
      const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      if (b.min[1] > groundAt(cx, cz) + 0.4) continue; // 공중에 뜬 것은 뺌
      g.fillRect((b.min[0] + hxx) * ppm, (b.min[2] + hzz) * ppm, (b.max[0] - b.min[0]) * ppm, (b.max[2] - b.min[2]) * ppm);
    }
    return cv;
  };
  const group = new THREE.Group();
  scene.add(group);
  const T = { ...(THEMES[theme] || THEMES.dock), ...(isle && opt.mood ? MOODS[opt.mood] : {}) };
  const owned = []; // 맵을 바꿀 때 함께 지울 질감

  // 하늘 (카메라를 따라다님)
  const skyR = isle ? 1500 : 420;
  const sunDir = new THREE.Vector3(...T.sun[2]).normalize();
  const col3 = (c) => { const k = new THREE.Color(c); return new THREE.Vector3(k.r, k.g, k.b); };
  const skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false, uniforms: {
    uZen: { value: col3(T.sky[0]) }, uMid: { value: col3(T.sky[1]) }, uHor: { value: col3(T.sky[2]) }, uGnd: { value: col3(T.fog) }, uSunDir: { value: sunDir }, uSunCol: { value: col3(T.sun[0]).multiplyScalar(T.night ? 0.55 : 1) },
    uCloud: { value: col3(T.cl[1]) }, uShade: { value: col3(T.cl[2]) }, uCover: { value: T.cl[0] }, uAlpha: { value: T.cl[3] }, uTime: { value: 0 }, uStars: { value: T.stars || 0 }, uDisc: { value: T.night ? 0.99935 : 0.99972 }, uNoise: { value: texOf('noise') } } });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(skyR, 32, 18), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false;
  group.add(sky);
  scene.background = new THREE.Color(T.fog);
  // 유리·차체·쇠에 비칠 하늘: 하늘만 작은 큐브맵으로 한 번 찍어 둔다 (화질 '낮음'은 뺌)
  let envTex = null;
  if (!low) {
    try {
      const crt = new THREE.WebGLCubeRenderTarget(64, { type: opt.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType }), cc = new THREE.CubeCamera(1, skyR * 2, crt), tmp = new THREE.Scene(), disc = skyMat.uniforms.uDisc.value;
      const sk2 = new THREE.Mesh(sky.geometry, skyMat); sk2.frustumCulled = false; tmp.add(sk2);
      skyMat.uniforms.uDisc.value = 2; cc.update(renderer, tmp); skyMat.uniforms.uDisc.value = disc;
      envTex = crt.texture; owned.push(crt);
    } catch (e) { envTex = null; }
  }
  // 물 재질 (바다·연못·해자). 색, 비치는 정도, 물결 세기
  const waters = [];
  const waterMatOf = (color, alpha, bump) => {
    const m = new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false, fog: true, uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uNoise: { value: texOf('noise') }, uTime: { value: 0 }, uDeep: { value: col3(color).multiplyScalar(T.night ? 0.35 : 1) }, uSky: { value: col3(T.sky[1]) }, uHor: { value: col3(T.sky[2]) }, uSunDir: { value: sunDir }, uSunCol: { value: col3(T.sun[0]).multiplyScalar(T.night ? 0.5 : 1) }, uAlpha: { value: alpha }, uBump: { value: bump } } });
    waters.push(m); return m;
  };
  scene.fog = new THREE.Fog(T.fog, T.fogD[0] * (opt.lowFar ? 0.7 : 1), T.fogD[1] * (opt.lowFar ? 0.62 : 1));

  // 빛과 그림자
  const hemi = new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]);
  const sun = new THREE.DirectionalLight(T.sun[0], T.sun[1]);
  const follow = isle; // 큰 맵은 그림자가 카메라 둘레만 덮고 따라다님
  const shR = follow ? (opt.shadowSize >= 2048 ? 85 : 62) : Math.hypot(hx, hz) + 6;
  const sunDist = follow ? 190 : 170;
  sun.position.copy(sunDir).multiplyScalar(sunDist);
  sun.target.position.set(0, 0, 0);
  if (shadows) {
    sun.castShadow = true;
    const size = follow ? (opt.shadowSize || 2048) : (opt.shadowSize >= 2048 ? 4096 : 2048);
    sun.shadow.mapSize.set(size, size);
    const c = sun.shadow.camera; c.left = -shR; c.right = shR; c.top = shR; c.bottom = -shR; c.near = 5; c.far = sunDist * 2 + 40; sun.shadow.radius = 2.2;
    if (!follow) { // 경기장: 해 방향에서 본 맵 크기에 꼭 맞춰 그림자 해상도를 아낌
      const ax = new THREE.Vector3(0, 1, 0).cross(sunDir).normalize(), ay = sunDir.clone().cross(ax), p = new THREE.Vector3();
      let l = 1e9, r = -1e9, bt = 1e9, tp = -1e9;
      for (const x of [-hx - 2, hx + 2]) for (const y of [-6, 18]) for (const z of [-hz - 2, hz + 2]) { p.set(x, y, z); const u = p.dot(ax), v = p.dot(ay); l = Math.min(l, u); r = Math.max(r, u); bt = Math.min(bt, v); tp = Math.max(tp, v); }
      c.left = l; c.right = r; c.bottom = bt; c.top = tp;
    }
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = follow ? 0.09 : 0.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false; // 맵은 움직이지 않으니 그림자는 필요할 때만 다시 계산
  }
  group.add(hemi, sun, sun.target);

  const flat = (m, x, z, rot = 0, y = 0.02) => { m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, y, z); group.add(m); return m; };
  const slab = (texKey, x0, z0, x1, z1, tile, color = 0xffffff, y = 0.012) => {
    const t = getTex(texKey).clone(); t.needsUpdate = true; t.repeat.set((x1 - x0) / tile, (z1 - z0) / tile); owned.push(t);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), fx(lam({ map: t, color }), 6));
    m.receiveShadow = shadows;
    return flat(m, (x0 + x1) / 2, (z0 + z1) / 2, 0, y);
  };
  // 덧바닥을 땅 높이에 맞춰 까는 판 (경사로·구덩이처럼 높이가 다른 칸은 건너뜀)
  const slabOn = (texKey, x0, z0, x1, z1, tile, color, y, any) => {
    const t = getTex(texKey).clone(); t.needsUpdate = true; t.repeat.set(1, 1); owned.push(t);
    const xs = [x0], zs = [z0], pos = [], uvs = [], idx = [];
    for (let x = Math.floor(x0) + 1; x < x1; x++) xs.push(x); xs.push(x1);
    for (let z = Math.floor(z0) + 1; z < z1; z++) zs.push(z); zs.push(z1);
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) {
      const c = [[xs[i], zs[j]], [xs[i + 1], zs[j]], [xs[i], zs[j + 1]], [xs[i + 1], zs[j + 1]]].map(([x, z]) => [x, groundAt(x, z), z]);
      if (!any && c.some((p) => Math.abs(p[1] - y) > 0.3)) continue;
      const n = pos.length / 3; for (const p of c) { pos.push(p[0], p[1] + 0.014, p[2]); uvs.push((p[0] - x0) / tile, -(p[2] - z0) / tile); }
      idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
    const sm = lam({ map: t, color, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), sn = nrmOf(texKey);
    if (sn) sm.normalMap = sn;
    const m = new THREE.Mesh(g, fx(sm, 6, groundAo && { tex: groundAo, st: new THREE.Vector4(tile / (2 * hx), tile / (2 * hz), 0.5 + x0 / (2 * hx), 0.5 - z0 / (2 * hz)) })); m.receiveShadow = shadows; group.add(m);
  };
  let water = null, splat = null, splatPix = null, splatN = 0, groundAo = null;
  if (!isle) {
    { const t = new THREE.CanvasTexture(aoCanvas(hx, hz, low ? 512 : 1024)); t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter; groundAo = t; owned.push(t); }
    // 바닥
    if (map.hm) { // 높낮이 있는 바닥: 1m 격자, 낮은 곳은 조금 어둡게
      const hm = map.hm, nx = hm.n, nz = hm.nz, pos = new Float32Array(nx * nz * 3), uvs = new Float32Array(nx * nz * 2), col = new Float32Array(nx * nz * 3), idx = [];
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i, x = -hm.hx + i, z = -hm.hz + j, h = hm.H[k], c = Math.min(1.12, Math.max(0.62, 1 + h * (h < 0 ? 0.075 : 0.03)));
        pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; uvs[k * 2] = x / 4; uvs[k * 2 + 1] = -z / 4; col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = c;
      }
      for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
      const ft = getTex(T.floor).clone(); ft.needsUpdate = true; ft.repeat.set(1, 1); owned.push(ft);
      const gm = lam({ map: ft, vertexColors: true }), gn = nrmOf(T.floor); if (gn) gm.normalMap = gn;
      const tm = new THREE.Mesh(tg, fx(gm, 6, { tex: groundAo, st: new THREE.Vector4(2 / hx, 2 / hz, 0.5, 0.5) })); tm.receiveShadow = shadows; group.add(tm);
    } else slab(T.floor, -hx, -hz, hx, hz, 4, 0xffffff, 0);
    { // 담장 밖 땅 (안쪽은 파인 곳이 있어서 덮지 않음). 6m 마다 되풀이되는 질감
      for (const [x0, z0, x1, z1] of [[-450, hz, 450, 450], [-450, -450, 450, -hz], [-450, -hz, -hx, hz], [hx, -hz, 450, hz]]) {
        const t = getTex(T.outTex || 'dirt').clone(); t.needsUpdate = true; t.repeat.set((x1 - x0) / 6, (z1 - z0) / 6); owned.push(t);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), fx(lam({ map: t, color: 0xd8d8d8 }), 6)); m.receiveShadow = false; flat(m, (x0 + x1) / 2, (z0 + z1) / 2, 0, -0.04);
      }
    }
  } else {
    // ── 지형 ──
    const hm = map.hm, n = hm.n, res = hm.res;
    const pos = new Float32Array(n * n * 3), uvs = new Float32Array(n * n * 2), idx = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      pos[k * 3] = -hm.hx + i * res; pos[k * 3 + 1] = hm.H[k]; pos[k * 3 + 2] = -hm.hz + j * res;
      uvs[k * 2] = i / (n - 1); uvs[k * 2 + 1] = j / (n - 1);
    }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
    const tg = new THREE.BufferGeometry();
    const posA = new THREE.BufferAttribute(pos, 3), uvA = new THREE.BufferAttribute(uvs, 2);
    tg.setAttribute('position', posA); tg.setAttribute('uv', uvA); tg.setIndex(idx); tg.computeVertexNormals();
    const norA = tg.attributes.normal;
    // 색 지도: 높이·기울기로 모래/풀/흙을 칠하고 길과 건물 터를 그린다 (미니맵에도 씀)
    const SP = 640, cv = document.createElement('canvas'); cv.width = cv.height = SP;
    const g2 = cv.getContext('2d'), img = g2.createImageData(SP, SP), px = img.data;
    const nz = (x, z) => Math.sin(x * 0.11 + 1.7) * Math.cos(z * 0.13 + 0.3) * 0.5 + Math.sin((x + z) * 0.047) * 0.5;
    for (let py = 0; py < SP; py++) for (let qx = 0; qx < SP; qx++) {
      const x = -hm.hx + ((qx + 0.5) / SP) * hm.hx * 2, z = hm.hz - ((py + 0.5) / SP) * hm.hz * 2;
      const h = groundAt(x, z, true), sl = Math.hypot(groundAt(x + 2, z, true) - groundAt(x - 2, z, true), groundAt(x, z + 2, true) - groundAt(x, z - 2, true)) / 4;
      const v = nz(x, z);
      let r, g, b;
      if (h < 1.4) { // 깊은 바닥(바다색) → 얕은 모래 → 백사장
        const w = Math.max(0, Math.min(1, (h + 1.2) / 2.6)), dp = Math.max(0, Math.min(1, (-1.2 - h) / 1.8));
        r = 168 + w * 64; g = 166 + w * 46; b = 132 + w * 36;
        r += (31 - r) * dp; g += (95 - g) * dp; b += (138 - b) * dp;
      } else {
        const dry = Math.max(0, Math.min(1, (h - 11) / 6)), v2 = Math.sin(x * 0.023 - 0.7) * Math.cos(z * 0.019 + 1.1);
        r = 96 + v * 20 + v2 * 14 + dry * 44; g = 140 + v * 18 + v2 * 10 + dry * 10; b = 64 + v * 10 - v2 * 6 + dry * 14;
        const t = Math.max(0, Math.min(1, (h - 1.4) / 1.2));
        r = 232 + (r - 232) * t; g = 212 + (g - 212) * t; b = 168 + (b - 168) * t;
        const rock = Math.max(0, Math.min(1, (sl - 0.2) / 0.16));
        r += (128 - r) * rock; g += (118 - g) * rock; b += (100 - b) * rock;
      }
      const o = (py * SP + qx) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
    g2.putImageData(img, 0, 0);
    const BS = opt.lowFar ? 1024 : 2048, big = document.createElement('canvas'); big.width = big.height = BS;
    const g3 = big.getContext('2d'); g3.imageSmoothingEnabled = true; g3.drawImage(cv, 0, 0, BS, BS);
    const P2 = BS / (hm.hx * 2), X = (x) => (x + hm.hx) * P2, Z = (z) => (hm.hz - z) * P2;
    const roads = map.decor.find((d) => d.t === 'roads');
    if (roads) {
      for (const [x, z, r] of roads.pads) { const rg = g3.createRadialGradient(X(x), Z(z), r * P2 * 0.5, X(x), Z(z), (r + 5) * P2); rg.addColorStop(0, 'rgba(158,140,108,.62)'); rg.addColorStop(1, 'rgba(158,140,108,0)'); g3.fillStyle = rg; g3.beginPath(); g3.arc(X(x), Z(z), (r + 5) * P2, 0, 7); g3.fill(); }
      g3.lineCap = g3.lineJoin = 'round';
      for (const [w, col] of [[7, 'rgba(120,104,76,.35)'], [4.4, 'rgba(168,146,108,.92)']]) {
        g3.lineWidth = w * P2; g3.strokeStyle = col;
        for (const line of roads.list) { g3.beginPath(); line.forEach((p, i) => (i ? g3.lineTo(X(p[0]), Z(p[1])) : g3.moveTo(X(p[0]), Z(p[1])))); g3.stroke(); }
      }
    }
    for (const d of map.decor) { // 활주로·헬기장 페인트
      if (d.t === 'runway') {
        g3.fillStyle = '#4c5056'; g3.fillRect(X(d.x0), Z(d.z1), (d.x1 - d.x0) * P2, (d.z1 - d.z0) * P2);
        g3.fillStyle = 'rgba(240,240,235,.85)'; const zc = (d.z0 + d.z1) / 2;
        for (let x = d.x0 + 6; x < d.x1 - 8; x += 12) g3.fillRect(X(x), Z(zc + 0.3), 6 * P2, 0.6 * P2);
        for (const xe of [d.x0 + 1.5, d.x1 - 4.5]) for (let k = 0; k < 5; k++) g3.fillRect(X(xe), Z(d.z1 - 2 - k * 2.2), 3 * P2, 1 * P2);
        g3.strokeStyle = 'rgba(240,200,60,.8)'; g3.lineWidth = 0.35 * P2; g3.strokeRect(X(d.x0 + 0.6), Z(d.z1 - 0.6), (d.x1 - d.x0 - 1.2) * P2, (d.z1 - d.z0 - 1.2) * P2);
      } else if (d.t === 'helipad') {
        g3.fillStyle = '#55595f'; g3.beginPath(); g3.arc(X(d.x), Z(d.z), d.r * P2, 0, 7); g3.fill();
        g3.strokeStyle = 'rgba(245,245,240,.9)'; g3.lineWidth = 0.5 * P2; g3.beginPath(); g3.arc(X(d.x), Z(d.z), (d.r - 1) * P2, 0, 7); g3.stroke();
        g3.fillStyle = 'rgba(245,245,240,.9)'; g3.font = `900 ${Math.round(d.r * P2 * 1.1)}px Arial, sans-serif`; g3.textAlign = 'center'; g3.textBaseline = 'middle'; g3.fillText('H', X(d.x), Z(d.z));
      }
    }
    g2.drawImage(big, 0, 0, SP, SP); splatPix = g2.getImageData(0, 0, SP, SP).data; splatN = SP; // 풀 심을 곳을 고를 때 쓰는 축소본 (길·건물 터 포함)
    splat = big;
    const splatTex = new THREE.CanvasTexture(big); splatTex.colorSpace = THREE.SRGBColorSpace; splatTex.anisotropy = 8; owned.push(splatTex);
    const detail = getTex('grassDetail');
    const tm = lam({ map: splatTex });
    tm.onBeforeCompile = (sh) => { // 가까이서도 흐릿하지 않게 잔무늬를 곱함
      sh.uniforms.detailMap = { value: detail };
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform sampler2D detailMap;\nvoid main() {').replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb *= texture2D( detailMap, vMapUv * 150.0 ).rgb * 1.6 + 0.2;');
    };
    // 지형을 5×5 조각으로 나눠, 화면 밖 조각은 그리지 않는다
    const CH = 5, q = (n - 1) / CH;
    for (let cj = 0; cj < CH; cj++) for (let ci = 0; ci < CH; ci++) {
      const ix = [];
      let lo = 1e9, hi = -1e9;
      for (let j = cj * q; j < (cj + 1) * q; j++) for (let i = ci * q; i < (ci + 1) * q; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; ix.push(a, c, b, b, c, d); const h = hm.H[a]; if (h < lo) lo = h; if (h > hi) hi = h; }
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', posA); cg.setAttribute('uv', uvA); cg.setAttribute('normal', norA); cg.setIndex(ix);
      const sz = q * res;
      cg.boundingSphere = new THREE.Sphere(new THREE.Vector3(-hm.hx + (ci + 0.5) * sz, (lo + hi) / 2, -hm.hz + (cj + 0.5) * sz), Math.hypot(sz * 0.71, (hi - lo) / 2) + 2);
      const mesh = new THREE.Mesh(cg, tm);
      mesh.receiveShadow = shadows;
      group.add(mesh);
    }
    // ── 바다 ──
    water = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), waterMatOf(T.water, 0.8, 1.15));
    water.renderOrder = 1; flat(water, 0, 0, 0, 0);
    const deep = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), new THREE.MeshLambertMaterial({ color: new THREE.Color(T.water).multiplyScalar(0.62) })); flat(deep, 0, 0, 0, -3.6);
  }

  // ── 충돌 상자 → 눈에 보이는 물체 ──
  const barrels = [];
  for (const b of BOXES) {
    if (b.nv) continue;
    const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
    if (b.m === 'barrel') { barrels.push(b); continue; }
    if (b.m === 'forklift') { // 지게차
      const cx = (x0 + x1) / 2, g = y1 - 2;
      mg.box('yellow', x0, g + 0.25, z0 + 0.5, x1, g + 1.05, z1); mg.box('dark', x0 + 0.1, g + 1.05, z0 + 1.3, x1 - 0.1, g + 1.25, z1 - 0.1);
      for (const sx of [x0 + 0.08, x1 - 0.16]) { mg.box('dark', sx, g + 1.05, z0 + 1.2, sx + 0.08, g + 2, z0 + 1.28); mg.box('dark', sx, g + 1.05, z1 - 0.2, sx + 0.08, g + 2, z1 - 0.12); }
      mg.box('yellow', x0, g + 1.94, z0 + 1.15, x1, g + 2, z1 - 0.08);
      mg.box('dark', cx - 0.5, g, z0 + 0.36, cx - 0.4, g + 2, z0 + 0.5); mg.box('dark', cx + 0.4, g, z0 + 0.36, cx + 0.5, g + 2, z0 + 0.5);
      mg.box('steel', cx - 0.45, g + 0.06, z0, cx - 0.33, g + 0.12, z0 + 0.5); mg.box('steel', cx + 0.33, g + 0.06, z0, cx + 0.45, g + 0.12, z0 + 0.5);
      for (const [wx, wz] of [[x0 - 0.02, z0 + 0.8], [x1 - 0.2, z0 + 0.8], [x0 - 0.02, z1 - 0.5], [x1 - 0.2, z1 - 0.5]]) mg.box('tire', wx, g, wz - 0.25, wx + 0.22, g + 0.5, wz + 0.25);
      continue;
    }
    if (b.m === 'truckCab') { // 트럭 머리
      const g = y1 - 2.5;
      mg.box('truckBlue', x0, g + 0.5, z0, x1, g + 2.5, z1); mg.box('glass', x0 - 0.02, g + 1.5, z0 + 0.2, x0 + 0.05, g + 2.3, z1 - 0.2);
      mg.box('glass', x0 + 0.3, g + 1.55, z0 - 0.02, x0 + 1.3, g + 2.25, z0 + 0.03); mg.box('glass', x0 + 0.3, g + 1.55, z1 - 0.03, x0 + 1.3, g + 2.25, z1 + 0.02);
      mg.box('dark', x0 - 0.12, g + 0.45, z0 + 0.1, x0, g + 0.8, z1 - 0.1);
      mg.box('lamp', x0 - 0.03, g + 0.9, z0 + 0.15, x0 + 0.02, g + 1.1, z0 + 0.5); mg.box('lamp', x0 - 0.03, g + 0.9, z1 - 0.5, x0 + 0.02, g + 1.1, z1 - 0.15);
      for (const wz of [z0 - 0.05, z1 - 0.25]) mg.box('tire', x0 + 0.5, g, wz, x0 + 1.5, g + 1, wz + 0.3);
      continue;
    }
    if (b.m === 'truckBox') { // 트럭 짐칸
      const g = y1 - 3.4;
      mg.box('truckBox', x0, y0, z0, x1, y1, z1, MATS.truckBox);
      mg.box('dark', x0 - 0.2, g + 0.55, z0 + 0.5, x1, g + 0.8, z1 - 0.5);
      for (const wx of [x0 + 0.5, x1 - 2.6, x1 - 1.4]) for (const wz of [z0 + 0.05, z1 - 0.35]) mg.box('tire', wx, g, wz, wx + 1, g + 1, wz + 0.3);
      continue;
    }
    if (b.m === 'flatbed') { // 화차 바닥과 바퀴
      mg.box('dark', x0, y0 + 0.45, z0, x1, y1, z1);
      for (const wx of [x0 + 0.8, x0 + 2, x1 - 3, x1 - 1.8]) for (const wz of [z0 - 0.05, z1 - 0.1]) mg.box('tire', wx, y0, wz, wx + 0.9, y0 + 0.75, wz + 0.15);
      continue;
    }
    if (b.m === 'car') { // 승용차 (긴 쪽이 앞뒤)
      const body = 'car' + (Math.abs(Math.round(x0 * 7 + z0 * 13)) % 5), P = x1 - x0 > z1 - z0 ? (a0, ya, c0, a1, yb, c1, k) => mg.box(k, x0 + a0, y0 + ya, z0 + c0, x0 + a1, y0 + yb, z0 + c1) : (a0, ya, c0, a1, yb, c1, k) => mg.box(k, x0 + c0, y0 + ya, z0 + a0, x0 + c1, y0 + yb, z0 + a1);
      P(0, 0.35, 0, 4.4, 0.95, 1.9, body); P(1.1, 0.95, 0.1, 3.5, 1.4, 1.8, 'glass'); P(1.25, 1.4, 0.14, 3.35, 1.5, 1.76, body);
      for (const a of [0.5, 3.15]) for (const c of [-0.04, 1.72]) P(a, 0, c, a + 0.75, 0.7, c + 0.22, 'tire');
      P(-0.03, 0.6, 0.15, 0.02, 0.8, 0.55, 'lamp'); P(-0.03, 0.6, 1.35, 0.02, 0.8, 1.75, 'lamp'); P(4.38, 0.6, 0.15, 4.43, 0.8, 0.55, 'redPaint'); P(4.38, 0.6, 1.35, 4.43, 0.8, 1.75, 'redPaint');
      continue;
    }
    if (b.m === 'bus') { // 시내버스
      const lx = x1 - x0 > z1 - z0, L = lx ? x1 - x0 : z1 - z0, P = lx ? (a0, ya, c0, a1, yb, c1, k) => mg.box(k, x0 + a0, y0 + ya, z0 + c0, x0 + a1, y0 + yb, z0 + c1) : (a0, ya, c0, a1, yb, c1, k) => mg.box(k, x0 + c0, y0 + ya, z0 + a0, x0 + c1, y0 + yb, z0 + a1);
      P(0, 0.4, 0, L, 3.1, 2.6, 'busBody'); P(0.4, 1.5, -0.03, L - 0.4, 2.5, 2.63, 'glass'); P(-0.03, 1.4, 0.2, L + 0.03, 2.6, 2.4, 'glass'); P(0, 0.9, -0.02, L, 1.1, 2.62, 'whitePaint');
      for (const a of [1.2, L - 2.4]) for (const c of [-0.05, 2.35]) P(a, 0, c, a + 1, 1, c + 0.3, 'tire');
      continue;
    }
    if (b.m === 'trainA' || b.m === 'trainB') { // 객차: 창문 띠와 문
      mg.box(b.m, x0, y0, z0, x1, y1, z1, MATS[b.m]);
      mg.box('glass', x0 + 1, y0 + 1.5, z0 - 0.03, x1 - 1, y0 + 2.5, z1 + 0.03); mg.box('yellow', x0, y0 + 0.5, z0 - 0.02, x1, y0 + 0.7, z1 + 0.02);
      for (const dx of [0.3, x1 - x0 - 1.5]) mg.box('steel', x0 + dx, y0 + 0.1, z0 - 0.045, x0 + dx + 1.2, y0 + 2.7, z1 + 0.045);
      mg.box('dark', x0 + 0.3, y1, z0 + 0.4, x1 - 0.3, y1 + 0.18, z1 - 0.4);
      continue;
    }
    const md = MATS[b.m];
    mg.box(b.m, x0, y0, z0, x1, y1, z1, md);
    if (b.m === 'wall' || b.m === 'sandWall') { // 담장 위 덮개
      mg.box(T.cap, x0 - (x1 - x0 < 2 ? 0.15 : 0), y1, z0 - (z1 - z0 < 2 ? 0.15 : 0), x1 + (x1 - x0 < 2 ? 0.15 : 0), y1 + 0.25, z1 + (z1 - z0 < 2 ? 0.15 : 0));
    }
    if (b.m[0] === 'c' && b.m.length === 2) { // 컨테이너 모서리 기둥
      for (const cx of [x0, x1 - 0.12]) for (const cz of [z0, z1 - 0.12]) mg.box('steel', cx - 0.01, y0, cz - 0.01, cx + 0.13, y1 + 0.02, cz + 0.13);
    }
  }
  // 드럼통
  barrels.forEach((b, i) => {
    const r = (b.max[0] - b.min[0]) / 2, h = b.max[1] - b.min[1];
    const geo = new THREE.CylinderGeometry(r, r, h, 14);
    geo.translate((b.min[0] + b.max[0]) / 2, b.min[1] + h / 2, (b.min[2] + b.max[2]) / 2);
    mg.add('barrel' + (i % 3), geo);
  });

  // ── 맵 자료에 든 장식 ──
  let glowMat = null;
  const glowTex = () => { const t = canvasTex(64, (g) => { const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.5, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64); }, false); owned.push(t); return t; };
  const half = (r, x, y, z, k = 'dome') => { const g = new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(x, y, z); mg.add(k, g); };
  const cyl = (k, rt, rb, h, x, y, z, seg = 14) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y + h / 2, z); mg.add(k, g); };
  const instanced = [], cullList = [], spinners = [];
  const spinMat = new THREE.MeshLambertMaterial({ color: 0xf0efe9 });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(), C = new THREE.Color(), E = new THREE.Euler(), UP = new THREE.Vector3(0, 1, 0);
  const chunked = (list) => { const m = new Map(); for (const t of list) { const k = Math.floor(t[0] / 100) + ',' + Math.floor(t[1] / 100); if (!m.has(k)) m.set(k, []); m.get(k).push(t); } return m; };
  const addInst = (geo, mat, list, setM, cast, far) => { // 한 구역의 같은 물체를 한 번에 그림
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    let cx = 0, cz = 0;
    list.forEach((t, i) => { setM(t, i, im); cx += t[0]; cz += t[1]; });
    im.castShadow = shadows && cast; im.receiveShadow = false;
    im.computeBoundingSphere();
    group.add(im); instanced.push(im); cullList.push({ im, x: cx / list.length, z: cz / list.length, far: far * (opt.farK || 1) });
    return im;
  };
  for (const d of map.decor) {
    if (d.t === 'house') {
      const { x0, z0, x1, z1, y, top, ops } = d, t = 0.3;
      if (d.gable) { // 박공지붕
        const o = 0.55, yb = top + 0.22, yr = yb + d.gable;
        if (x1 - x0 >= z1 - z0) {
          const zc = (z0 + z1) / 2, A = [x0 - o, yb, z0 - o], Bp = [x1 + o, yb, z0 - o], C = [x1 + o, yb, z1 + o], Dp = [x0 - o, yb, z1 + o], R0 = [x0 - o, yr, zc], R1 = [x1 + o, yr, zc];
          mg.tris(d.gcol, [A, R0, R1, A, R1, Bp, Dp, C, R1, Dp, R1, R0]); mg.tris('gableEnd', [A, Dp, R0, Bp, R1, C], 3);
        } else {
          const xc = (x0 + x1) / 2, A = [x0 - o, yb, z0 - o], Bp = [x0 - o, yb, z1 + o], C = [x1 + o, yb, z1 + o], Dp = [x1 + o, yb, z0 - o], R0 = [xc, yr, z0 - o], R1 = [xc, yr, z1 + o];
          mg.tris(d.gcol, [A, R0, R1, A, R1, Bp, Dp, C, R1, Dp, R1, R0]); mg.tris('gableEnd', [A, Dp, R0, Bp, R1, C], 3);
        }
      }
      for (const [side, at, w, kind, lv] of ops) for (const f of kind === 'door' ? (lv ? [0, 3] : [0]) : lv === 1 ? [3] : lv === 2 ? [0, 3] : [0]) { // 문틀·창틀 (f = 층 높이)
        const isDoor = kind === 'door' && f === 0, y = d.y + f;
        const horiz = side === 'n' || side === 's';
        const c = side === 's' ? z0 : side === 'n' ? z1 - t : side === 'w' ? x0 : x1 - t;
        const bx = (a0, ya, a1, yb, th = 0.06) => (horiz ? mg.box(d.trim, a0, ya, c - th, a1, yb, c + t + th) : mg.box(d.trim, c - th, ya, a0, c + t + th, yb, a1));
        const s = at - w / 2, e = at + w / 2;
        if (isDoor) { bx(s - 0.09, y, s, y + 2.33); bx(e, y, e + 0.09, y + 2.33); bx(s - 0.09, y + 2.25, e + 0.09, y + 2.36); }
        else { bx(s - 0.08, y + 0.94, e + 0.08, y + 1.02, 0.1); bx(s - 0.08, y + 2.18, e + 0.08, y + 2.26); bx(s - 0.08, y + 1.0, s, y + 2.2); bx(e, y + 1.0, e + 0.08, y + 2.2); bx(at - 0.03, y + 1.0, at + 0.03, y + 2.2, -0.1); bx(s, y + 1.57, e, y + 1.63, -0.1); }
      }
    } else if (d.t === 'rail') {
      const ry = d.y || 0;
      for (const dz of [-0.75, 0.75]) mg.box('steel', d.x0, ry + 0.1, d.z + dz - 0.05, d.x1, ry + 0.2, d.z + dz + 0.05);
      for (let x = d.x0 + 0.5; x < d.x1; x += 1.4) mg.box('sleeper', x, ry + 0.01, d.z - 1.15, x + 0.3, ry + 0.1, d.z + 1.15);
    } else if (d.t === 'gantry') {
      const y = (d.y || 0) + d.h;
      mg.box('crane', d.x0 - 1, y, d.z0 - 0.5, d.x1 + 1, y + 0.9, d.z0 + 0.5); mg.box('crane', d.x0 - 1, y, d.z1 - 0.5, d.x1 + 1, y + 0.9, d.z1 + 0.5);
      mg.box('crane', d.x0 - 0.4, y, d.z0, d.x0 + 0.4, y + 0.7, d.z1); mg.box('crane', d.x1 - 0.4, y, d.z0, d.x1 + 0.4, y + 0.7, d.z1);
      const cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2;
      mg.box('dark', cx - 1.4, y + 0.9, cz - 1.6, cx + 1.4, y + 2.4, cz + 1.6); mg.box('glass', cx - 1.45, y + 1.5, cz - 1.2, cx - 1.38, y + 2.2, cz + 1.2);
      mg.box('steel', cx - 0.06, y - 4, cz - 0.06, cx + 0.06, y, cz + 0.06); mg.box('yellow', cx - 0.8, y - 4.3, cz - 0.3, cx + 0.8, y - 4, cz + 0.3);
    } else if (d.t === 'tentTop') { const g = new THREE.ConeGeometry(d.r, d.h, 4); g.rotateY(Math.PI / 4); g.translate(d.x, d.y + d.h / 2, d.z); mg.add('tentRoof', g); }
    else if (d.t === 'pond') { const m = new THREE.Mesh(new THREE.CircleGeometry(d.r, 28), waterMatOf(0x2f7f9c, 0.84, 0.7)); m.renderOrder = 1; flat(m, d.x, d.z, 0, 0.06); }
    else if (d.t === 'posts') { const y0 = d.y || 0; for (const [x, z] of [[d.x0, d.z0], [d.x1, d.z0], [d.x0, d.z1], [d.x1, d.z1]]) mg.box('doorWood', x - 0.05, y0, z - 0.05, x + 0.05, y0 + d.h, z + 0.05); }
    else if (d.t === 'dome') half(d.r, d.x, d.y, d.z, d.col === 'white' ? 'whitePaint' : 'dome');
    else if (d.t === 'spire') { const g = new THREE.ConeGeometry(d.r, d.h, 8); g.translate(d.x, d.y + d.h / 2, d.z); mg.add('roofSlate', g); }
    else if (d.t === 'deco') { for (const b of d.b) mg.box(d.k, ...b); }
    else if (d.t === 'wins') { // 건물 벽의 창문(0 어두움, 1 불 켜짐)과 문(2). ax: 0 북, 1 남, 2 동, 3 서쪽을 보는 벽
      for (const [x, y, z, ax, kind] of d.list) {
        const sgn = ax === 0 || ax === 2 ? 1 : -1;
        const bx = (hw, y0, hh, dep, k) => (ax < 2 ? mg.box(k, x - hw, y0, sgn > 0 ? z : z - dep, x + hw, y0 + hh, sgn > 0 ? z + dep : z) : mg.box(k, sgn > 0 ? x : x - dep, y0, z - hw, sgn > 0 ? x + dep : x, y0 + hh, z + hw));
        if (kind === 2) { bx(0.62, 0, 2.2, 0.07, T.night ? 'dark' : 'doorWood'); bx(0.82, 2.2, 0.12, 0.14, T.cap); if (T.night) bx(1.5, 2.34, 0.5, 0.06, ['lanternA', 'lanternB', 'lanternC', 'glassLit'][Math.abs(Math.round(x + z)) % 4]); }
        else if (T.night) bx(1.15, y, 1.6, 0.05, kind ? (Math.abs(Math.round(x * 3 + y * 5 + z * 7)) % 3 ? 'winWarm' : 'glassLit') : 'winDark');
        else { bx(0.5, y, 1.15, 0.06, 'winDark'); bx(0.74, y - 0.1, 0.1, 0.13, T.cap); if (town) { const o = 0.76; for (const s2 of [-1, 1]) (ax < 2 ? mg.box('doorWood', x + s2 * o - 0.25, y, sgn > 0 ? z : z - 0.09, x + s2 * o + 0.25, y + 1.15, sgn > 0 ? z + 0.09 : z) : mg.box('doorWood', sgn > 0 ? x : x - 0.09, y, z + s2 * o - 0.25, sgn > 0 ? x + 0.09 : x, y + 1.15, z + s2 * o + 0.25)); } }
      }
    } else if (d.t === 'lanterns') { // 길 위에 걸친 등불 줄
      const cols = ['lanternA', 'lanternB', 'lanternC'];
      mg.box('winDark', Math.min(d.x0, d.x1) - 0.02, d.y, Math.min(d.z0, d.z1) - 0.02, Math.max(d.x0, d.x1) + 0.02, d.y + 0.04, Math.max(d.z0, d.z1) + 0.02);
      for (let i = 1; i < d.n; i++) { const x = d.x0 + ((d.x1 - d.x0) * i) / d.n, z = d.z0 + ((d.z1 - d.z0) * i) / d.n; mg.box(cols[i % 3], x - 0.13, d.y - 0.38, z - 0.13, x + 0.13, d.y - 0.04, z + 0.13); }
    } else if (d.t === 'lampPosts') { // 가로등 (밤 맵에서는 바닥에 불빛)
      for (const [x, z] of d.list) {
        const y = groundAt(x, z);
        mg.box('steel', x - 0.08, y, z - 0.08, x + 0.08, y + 6, z + 0.08); mg.box('steel', x - 0.06, y + 5.9, z - 0.06, x + 1.2, y + 6, z + 0.06); mg.box('lamp', x + 0.7, y + 5.78, z - 0.16, x + 1.25, y + 5.9, z + 0.16);
        if (T.night) { glowMat = glowMat || new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xffd9a0, transparent: true, opacity: opt.lin ? 0.2 : 0.5, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -1 }); flat(new THREE.Mesh(new THREE.CircleGeometry(7, 20), glowMat), x + 0.9, z, 0, y + 0.03); }
      }
    }
    else if (d.t === 'wellRoof') {
      for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]]) mg.box('doorWood', d.x + x - 0.07, d.y + 1.1, d.z + z - 0.07, d.x + x + 0.07, d.y + 2.5, d.z + z + 0.07);
      const g = new THREE.ConeGeometry(2.2, 0.9, 4); g.rotateY(Math.PI / 4); g.translate(d.x, d.y + 2.95, d.z); mg.add('roofTile', g);
      mg.box('winDark', d.x - 0.9, d.y + 1.1, d.z - 0.9, d.x + 0.9, d.y + 1.12, d.z + 0.9);
    } else if (d.t === 'lighthouse') {
      const { x, y, z, h } = d;
      cyl('whitePaint', 1.7, 2.4, h, x, y, z, 18);
      for (const f of [0.18, 0.5]) cyl('redPaint', 2.4 - 0.7 * (f + 0.12) + 0.02, 2.4 - 0.7 * f + 0.02, h * 0.12, x, y + h * f, z, 18);
      cyl('dark', 2.3, 2.3, 0.25, x, y + h, z, 18); cyl('lamp', 1.1, 1.1, 1.5, x, y + h + 0.25, z, 12);
      { const g = new THREE.ConeGeometry(1.7, 1.4, 12); g.translate(x, y + h + 2.45, z); mg.add('redPaint', g); }
      mg.box('doorWood', x - 0.5, y, z - 2.45, x + 0.5, y + 2.1, z - 2.3);
    } else if (d.t === 'pier') { if (d.alongX) { for (let x = d.x0 + 2; x < d.x1; x += 6) for (const z of [d.z0 + 0.2, d.z1 - 0.2]) cyl('trunk', 0.18, 0.18, d.y + 3.8, x, -3.2, z, 8); } else for (let z = d.z0 + 2; z < d.z1; z += 6) for (const x of [d.x0 + 0.2, d.x1 - 0.2]) cyl('trunk', 0.18, 0.18, d.y + 3.8, x, -3.2, z, 8); }
    else if (d.t === 'silo') { cyl('siloMetal', d.r, d.r, d.h, d.x, d.y, d.z, 18); if (d.flat) cyl('steel', d.r + 0.05, d.r + 0.05, 0.25, d.x, d.y + d.h, d.z, 18); else { const g = new THREE.ConeGeometry(d.r + 0.1, 1.6, 18); g.translate(d.x, d.y + d.h + 0.8, d.z); mg.add('steel', g); } }
    else if (d.t === 'windmill') {
      const { x, y, z, h } = d;
      cyl('stoneCol', 0.75, 1.15, h, x, y, z, 10); { const g = new THREE.ConeGeometry(1, 1.3, 10); g.translate(x, y + h + 0.65, z); mg.add('roofTile', g); }
      for (let i = 0; i < 4; i++) { const g = new THREE.BoxGeometry(0.7, 4.6, 0.06); g.translate(0, 2.6, 0); const m4 = new THREE.Matrix4().makeRotationZ(i * Math.PI / 2 + 0.4); m4.setPosition(x, y + h - 0.6, z - 1.25); mg.add('sail', g, m4); }
    } else if (d.t === 'chimneyTop') mg.box('dark', d.x - 1.4, d.y, d.z - 1.4, d.x + 1.4, d.y + 0.4, d.z + 1.4);
    else if (d.t === 'antenna') { cyl('steel', 0.05, 0.08, d.h, d.x, d.y, d.z, 6); mg.box('redPaint', d.x - 0.1, d.y + d.h, d.z - 0.1, d.x + 0.1, d.y + d.h + 0.2, d.z + 0.1); for (const f of [0.5, 0.75]) mg.box('steel', d.x - 0.9, d.y + d.h * f, d.z - 0.03, d.x + 0.9, d.y + d.h * f + 0.06, d.z + 0.03); }
    else if (d.t === 'campfire') {
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; mg.box('stoneCol', d.x + Math.cos(a) * 0.8 - 0.2, d.y, d.z + Math.sin(a) * 0.8 - 0.2, d.x + Math.cos(a) * 0.8 + 0.2, d.y + 0.25, d.z + Math.sin(a) * 0.8 + 0.2); }
      { const g = new THREE.ConeGeometry(0.4, 0.9, 6); g.translate(d.x, d.y + 0.5, d.z); mg.add('lanternB', g); } mg.box('trunk', d.x - 0.5, d.y + 0.02, d.z - 0.08, d.x + 0.5, d.y + 0.18, d.z + 0.08); mg.box('trunk', d.x - 0.08, d.y + 0.02, d.z - 0.5, d.x + 0.08, d.y + 0.18, d.z + 0.5);
    } else if (d.t === 'radioTower') {
      const { x, y, z, h } = d;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const g = new THREE.CylinderGeometry(0.09, 0.14, h, 6); g.translate(0, h / 2, 0); const m4 = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-sz * 0.046, 0, sx * 0.046)); m4.setPosition(x + sx * 1.6, y, z + sz * 1.6); mg.add('crane', g, m4); }
      for (let yy = 3; yy < h; yy += 3) { const w = 1.6 * (1 - yy / h) + 0.22; mg.box('crane', x - w, y + yy, z - w, x + w, y + yy + 0.1, z - w + 0.1); mg.box('crane', x - w, y + yy, z + w - 0.1, x + w, y + yy + 0.1, z + w); mg.box('crane', x - w, y + yy, z - w, x - w + 0.1, y + yy + 0.1, z + w); mg.box('crane', x + w - 0.1, y + yy, z - w, x + w, y + yy + 0.1, z + w); }
      mg.box('redPaint', x - 0.25, y + h, z - 0.25, x + 0.25, y + h + 0.5, z + 0.25);
    } else if (d.t === 'trees') {
      // 나무: 100m 구역마다 종류별로 묶어 그림 (0 침엽수, 1 활엽수, 2 야자수) — 화면 밖·먼 구역은 건너뜀
      const cone = (r, h, y) => { const g = new THREE.ConeGeometry(r, h, 7); g.translate(0, y + h / 2, 0); return g; };
      const blob = (r, x, y, z, sy = 0.8, det = 0) => { const g = new THREE.IcosahedronGeometry(r, det); g.scale(1, sy, 1); g.translate(x, y, z); return g; };
      const leafG = []; for (let i = 0; i < 7; i++) { const g = new THREE.BoxGeometry(0.55, 0.05, 2.7); g.translate(0, 0, 1.35); g.applyMatrix4(new THREE.Matrix4().makeRotationY((i / 7) * 6.283).multiply(new THREE.Matrix4().makeRotationX(0.5))); g.translate(0, 5.6, 0); leafG.push(g); }
      const kinds = [
        { trunk: (() => { const g = new THREE.CylinderGeometry(0.14, 0.26, 2.6, 6); g.translate(0, 1.3, 0); return g; })(), top: mergeGeos([cone(1.9, 2.6, 1.5), cone(1.5, 2.3, 3.1), cone(1.0, 2.0, 4.6)]), col: 0x2f6b3c, tcol: 0x5b432c },
        { trunk: (() => { const g = new THREE.CylinderGeometry(0.2, 0.32, 3, 6); g.translate(0, 1.5, 0); return g; })(), top: mergeGeos([blob(2.0, 0, 4.2, 0, 0.8, 1), blob(1.4, 1.2, 3.6, 0.5), blob(1.3, -1, 3.8, -0.7), blob(1.2, 0.2, 5.3, 0.3)]), col: 0x4b8f3a, tcol: 0x6b5236 },
        { trunk: (() => { const g = new THREE.CylinderGeometry(0.15, 0.24, 5.6, 6); g.translate(0, 2.8, 0); return g; })(), top: mergeGeos(leafG), col: 0x4f9a40, tcol: 0x8a6c48 },
      ];
      kinds.forEach((K, ki) => {
        const tm = lam({ color: K.tcol }), fm = new THREE.MeshLambertMaterial({ color: 0xffffff, side: ki === 2 ? THREE.DoubleSide : THREE.FrontSide });
        for (const list of chunked(d.list.filter((t) => t[4] === ki)).values()) {
          const set = (t, i, im, tint) => { Q.setFromAxisAngle(UP, t[5]); V.set(t[0], t[2] - 0.15, t[1]); Sc.setScalar(t[3]); M.compose(V, Q, Sc); im.setMatrixAt(i, M); if (tint) { C.setHex(K.col).multiplyScalar(0.82 + ((t[0] * 13 + t[1] * 7) % 10 + 10) % 10 * 0.036); im.setColorAt(i, C); } };
          addInst(K.trunk, tm, list, (t, i, im) => set(t, i, im, false), true, 200);
          addInst(K.top, fm, list, (t, i, im) => set(t, i, im, true), true, 420);
        }
      });
    } else if (d.t === 'rocks' || d.t === 'bushes' || d.t === 'pile') {
      const rock = d.t !== 'bushes';
      const geo = rock ? new THREE.DodecahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 0), mat = lam({ color: 0xffffff, flatShading: true });
      let n = 0;
      for (const list of chunked(d.list).values()) addInst(geo, mat, list, (t, i, im) => {
        const s = t[3]; n++;
        if (rock) { E.set(t[4] * 0.3, t[4], t[4] * 0.2); Q.setFromEuler(E); V.set(t[0], t[2] + s * 0.3, t[1]); Sc.set(s, s * 0.75, s); C.setHex(0x8d8a82).multiplyScalar(0.85 + (n % 5) * 0.06); }
        else { Q.identity(); V.set(t[0], t[2] + s * 0.3, t[1]); Sc.set(s * 1.2, s * 0.75, s * 1.2); C.setHex(0x3f7d37).multiplyScalar(0.8 + (n % 6) * 0.07); }
        M.compose(V, Q, Sc); im.setMatrixAt(i, M); im.setColorAt(i, C);
      }, rock, rock ? 380 : 170);
    } else if (d.t === 'poles') { // 전봇대
      const g1 = new THREE.CylinderGeometry(0.1, 0.14, 7.5, 6); g1.translate(0, 3.75, 0);
      const g2 = new THREE.BoxGeometry(2.2, 0.12, 0.12); g2.translate(0, 6.9, 0);
      const g3 = new THREE.BoxGeometry(1.4, 0.1, 0.1); g3.translate(0, 6.3, 0);
      const geo = mergeGeos([g1, g2, g3]), mat = lam({ color: 0x5b4632 });
      for (const list of chunked(d.list).values()) addInst(geo, mat, list, (t, i, im) => { Q.setFromAxisAngle(UP, t[3]); V.set(t[0], t[2] - 0.2, t[1]); Sc.setScalar(1); M.compose(V, Q, Sc); im.setMatrixAt(i, M); }, true, 320);
    } else if (d.t === 'lamps') { // 가로등
      for (const [x, z, y] of d.list) { mg.box('steel', x - 0.07, y, z - 0.07, x + 0.07, y + 4.6, z + 0.07); mg.box('steel', x - 0.05, y + 4.5, z - 0.05, x + 0.9, y + 4.6, z + 0.05); mg.box('lamp', x + 0.45, y + 4.4, z - 0.14, x + 0.95, y + 4.5, z + 0.14); }
    } else if (d.t === 'signs') { // 이정표
      for (const [text, x, z, y, yaw] of d.list) {
        mg.box('doorWood', x - 0.06, y, z - 0.06, x + 0.06, y + 2.5, z + 0.06);
        for (const side of [0, Math.PI]) { const m = textPlane(text, 2.4, 0.7, { bg: '#2e5f3a', border: '#f0efe6', size: 0.6 }); m.position.set(x + Math.sin(yaw + side) * 0.08, y + 2.3, z + Math.cos(yaw + side) * 0.08); m.rotation.y = yaw + side; group.add(m); }
      }
    } else if (d.t === 'wreck') { // 버려진 차
      const { x, y, z } = d;
      mg.box('rust', x - 1, y + 0.35, z - 2.1, x + 1, y + 0.95, z + 2.1); mg.box('rust2', x - 0.9, y + 0.95, z - 1, x + 0.9, y + 1.5, z + 0.9);
      mg.box('winDark', x - 0.92, y + 1.02, z - 0.6, x + 0.92, y + 1.42, z + 0.5); mg.box('winDark', x - 0.8, y + 1.02, z - 1.02, x + 0.8, y + 1.42, z + 0.92);
      for (const [dx, dz] of [[-1, -1.4], [0.82, -1.4], [-1, 1.3]]) mg.box('tire', x + dx, y, z + dz - 0.33, x + dx + 0.2, y + 0.66, z + dz + 0.33);
    } else if (d.t === 'boat') { // 뭍에 올려 둔 배
      const m4 = new THREE.Matrix4().makeRotationY(d.yaw); m4.setPosition(d.x, d.y, d.z);
      const hull = new THREE.CylinderGeometry(0.8, 0.45, 3.4, 8, 1, false, 0, Math.PI); hull.rotateZ(Math.PI / 2); hull.rotateX(Math.PI / 2); hull.scale(1, 0.7, 1); hull.translate(0, 0.55, 0);
      mg.add('boatHull', hull, m4);
      for (const zx of [-0.8, 0.5]) { const s = new THREE.BoxGeometry(0.2, 0.06, 1.2); s.translate(zx, 0.5, 0); mg.add('doorWood', s, m4.clone()); }
    } else if (d.t === 'plane') { // 세워 둔 경비행기
      const { x, y, z } = d;
      { const g = new THREE.CylinderGeometry(1.05, 0.5, 12, 10); g.rotateZ(Math.PI / 2); g.translate(x - 0.5, y + 1.9, z); mg.add('whitePaint', g); }
      { const g = new THREE.ConeGeometry(1.05, 2, 10); g.rotateZ(-Math.PI / 2); g.translate(x + 6.5, y + 1.9, z); mg.add('redPaint', g); }
      mg.box('whitePaint', x - 1.4, y + 1.55, z - 6.5, x + 1.8, y + 1.8, z + 6.5); mg.box('redPaint', x - 1.4, y + 1.55, z - 6.5, x + 1.8, y + 1.82, z - 5.6); mg.box('redPaint', x - 1.4, y + 1.55, z + 5.6, x + 1.8, y + 1.82, z + 6.5);
      mg.box('whitePaint', x - 6.4, y + 2.1, z - 2.2, x - 5.2, y + 2.3, z + 2.2); mg.box('redPaint', x - 6.5, y + 2.2, z - 0.08, x - 5, y + 4.1, z + 0.08);
      mg.box('glass', x + 2.2, y + 2.5, z - 0.75, x + 4.4, y + 3.05, z + 0.75);
      for (const dz of [-1.6, 1.6]) { mg.box('steel', x + 0.7, y + 0.5, z + dz - 0.05, x + 0.8, y + 1.6, z + dz + 0.05); mg.box('tire', x + 0.45, y, z + dz - 0.12, x + 1.05, y + 0.6, z + dz + 0.12); }
      mg.box('tire', x - 5.4, y, z - 0.08, x - 5, y + 0.4, z + 0.08); mg.box('dark', x + 7.5, y + 0.6, z - 0.1, x + 7.6, y + 3.2, z + 0.1);
    } else if (d.t === 'playground') {
      const { x, y, z } = d;
      mg.box('redPaint', x - 0.2, y + 2.15, z - 0.7, x + 4.2, y + 2.25, z - 0.5); for (const dx of [1, 2.8]) { mg.box('steel', x + dx - 0.02, y + 0.6, z - 0.62, x + dx + 0.02, y + 2.15, z - 0.58); mg.box('doorWood', x + dx - 0.3, y + 0.52, z - 0.75, x + dx + 0.3, y + 0.6, z - 0.45); }
      mg.box('yellow', x - 6, y, z - 1.5, x - 5.2, y + 1.6, z - 0.7); { const g = new THREE.BoxGeometry(0.8, 0.08, 3.2); g.rotateX(0.5); g.translate(x - 5.6, y + 0.82, z + 0.6); mg.add('glassLit', g); }
    } else if (d.t === 'turbine') {
      const { x, y, z, h } = d;
      cyl('whitePaint', 0.55, 1.05, h, x, y, z, 12); mg.box('whitePaint', x - 0.8, y + h - 0.3, z - 2.4, x + 0.8, y + h + 1.1, z + 1.4);
      const rotor = new THREE.Group();
      for (let i = 0; i < 3; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 15, 0.16), spinMat); bl.geometry.translate(0, 7.8, 0); bl.rotation.z = (i * Math.PI * 2) / 3; rotor.add(bl); }
      rotor.position.set(x, y + h + 0.4, z - 2.6); group.add(rotor); spinners.push(rotor);
    }
  }

  const palm = (x, y, z, h) => {
    const t = new THREE.CylinderGeometry(0.16, 0.26, h, 8); t.translate(x, y + h / 2, z); mg.add('trunk', t);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rnd() * 0.3, leaf = new THREE.BoxGeometry(0.5, 0.05, 2.6);
      leaf.translate(0, 0, 1.3);
      const m4 = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(0.45 + rnd() * 0.25));
      m4.setPosition(x, y + h, z);
      mg.add('leaf', leaf, m4);
    }
  };
  const around = (n, d0, d1, fn) => { // 담장 밖을 빙 둘러 n 개
    for (let i = 0; i < n; i++) { const t = (i + rnd() * 0.6) / n, d = d0 + rnd() * (d1 - d0), per = (hx + hz) * 4, p = t * per; let x, z;
      if (p < hx * 2) { x = -hx + p; z = hz + d; } else if (p < hx * 2 + hz * 2) { x = hx + d; z = hz - (p - hx * 2); } else if (p < hx * 4 + hz * 2) { x = hx - (p - hx * 2 - hz * 2); z = -hz - d; } else { x = -hx - d; z = -hz + (p - hx * 4 - hz * 2); }
      fn(x, z, i); }
  };
  if (theme === 'dock') {
    // 담장 밖 컨테이너 더미, 크레인, 화물선
    around(16, 6, 10, (x, z, i) => { const m = ['cB', 'cR', 'cY', 'cG', 'cO', 'cW'][i % 6], h = 5.2 + (i % 3) * 2.6, along = Math.abs(x) > hx;
      for (let y = 0; y < h - 0.1; y += 2.6) { const off = (y / 2.6) % 2 ? 0.6 : 0; if (along) mg.box(m, x - 1.25, y, z - 6 + off, x + 1.25, y + 2.6, z + 6 + off, MATS[m]); else mg.box(m, x - 6 + off, y, z - 1.25, x + 6 + off, y + 2.6, z + 1.25, MATS[m]); } });
    for (const [cx, cz, rot] of [[hx + 36, -6, 0], [-20, -hz - 30, 1], [36, -hz - 30, 1], [-hx - 34, 22, 0]]) { // 크레인 (가는 철골)
      const P = (x0, y0, z0, x1, y1, z1) => (rot ? mg.box('crane', cx + z0, y0, cz + x0, cx + z1, y1, cz + x1) : mg.box('crane', cx + x0, y0, cz + z0, cx + x1, y1, cz + z1));
      for (const lx of [-4, 4]) for (const lz of [-9, 9]) { P(lx - 0.5, 0, lz - 0.5, lx + 0.5, 27, lz + 0.5); }
      for (const lz of [-9, 9]) { P(-4, 12, lz - 0.3, 4, 12.6, lz + 0.3); P(-4, 26.4, lz - 0.3, 4, 27, lz + 0.3); }
      for (const lx of [-4, 4]) P(lx - 0.3, 26.4, -9, lx + 0.3, 27, 9);
      P(-22, 27, -1.2, 16, 28.6, -0.4); P(-22, 27, 0.4, 16, 28.6, 1.2);
      for (let x = -22; x < 16; x += 4) P(x, 27.2, -0.4, x + 0.5, 28.4, 0.4);
      P(-1.5, 28.6, -1.5, 1.5, 33, 1.5); P(-12, 24.4, -1.4, -9, 27, 1.4);
    }
    mg.box('shipHull', -70, -2, -hz - 22, 50, 9, -hz - 8); mg.box('shipRed', -70, -2, -hz - 22.05, 50, 2, -hz - 7.95);
    mg.box('whitePaint', 24, 9, -hz - 20, 44, 20, -hz - 10); mg.box('glass', 23.9, 16.5, -hz - 19, 44.1, 18.5, -hz - 11); mg.box('crane', 30, 20, -hz - 16.5, 33, 25, -hz - 13.5);
    for (let x = -62; x < 18; x += 13) for (let y = 9; y < 14; y += 2.6) mg.box(['cR', 'cB', 'cG', 'cY', 'cO', 'cW'][(Math.abs(x) + y * 3 | 0) % 6], x, y, -hz - 19, x + 12, y + 2.6, -hz - 11, MATS.cR);
  } else if (theme === 'town') {
    // 담장 밖 마을, 탑, 모래 언덕, 야자수
    around(16, 7, 11, (x, z, i) => { const w = 8 + rnd() * 5, d = 8 + rnd() * 4, h = 6.5 + rnd() * 4.5; mg.box(i % 2 ? 'sand2' : 'sand', x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, MATS.sand); if (i % 3 === 0) half(Math.min(w, d) * 0.3, x, h, z); });
    mg.box('sand', hx + 13, 0, hz + 2, hx + 17, 20, hz + 6, MATS.sand); half(2.3, hx + 15, 20, hz + 4); mg.box('sand2', -hx - 17, 0, -hz - 6, -hx - 13, 17, -hz - 2, MATS.sand); half(2.3, -hx - 15, 17, -hz - 4);
    for (const [x, z, r] of [[-190, 40, 56], [180, -70, 62], [30, 190, 60], [-40, -190, 66], [210, 90, 54], [-210, -60, 58]]) { const g = new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.28, 1); g.translate(x, -1, z); mg.add('dune', g); }
    around(14, 4, 7, (x, z) => palm(x, 0, z, 6.5 + rnd() * 2));
  } else if (theme === 'station') {
    // 담장 밖: 전철 기둥과 멀리 보이는 시가지
    around(26, 18, 60, (x, z, i) => { const w = 10 + rnd() * 14, d = 10 + rnd() * 12, h = 8 + rnd() * 22; mg.box('cityFar', x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2); });
    for (let x = -hx; x <= hx; x += 24) for (const z of [20.4, -2.4, -20.4]) { mg.box('steel', x - 0.1, 0, z - 0.1, x + 0.1, 6.4, z + 0.1); mg.box('steel', x - 0.06, 6.2, z - 0.06, x + 0.06, 6.3, z + (z > 0 ? -4.4 : 4.4)); }
    for (const z of [18, 0, -18]) mg.box('dark', -hx, 5.6, z - 0.02, hx, 5.63, z + 0.02);
  } else if (theme === 'castle') {
    // 담장 밖: 숲과 언덕
    for (const [x, z, r] of [[-200, 30, 70], [190, -60, 76], [20, 200, 70], [-30, -200, 80], [210, 110, 60], [-210, -90, 66]]) { const g = new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.34, 1); g.translate(x, -1, z); mg.add('hill', g); }
    around(70, 4, 26, (x, z, i) => { const s = 0.9 + rnd() * 0.8; const t = new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 2.6 * s, 6); t.translate(x, 1.3 * s, z); mg.add('trunk', t);
      for (const [r, h, y] of [[1.9, 2.6, 1.5], [1.5, 2.3, 3.1], [1.0, 2.0, 4.6]]) { const g = new THREE.ConeGeometry(r * s, h * s, 7); g.translate(x, (y + h / 2) * s, z); mg.add(i % 3 ? 'pine' : 'pine2', g); } });
  } else if (theme === 'city') {
    // 담장 밖: 불 켜진 고층 건물
    around(30, 8, 46, (x, z, i) => { const w = 12 + rnd() * 12, d = 12 + rnd() * 10, h = 22 + rnd() * 46; mg.box('skyline', x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2);
      const face = Math.abs(x) > hx ? (x > 0 ? x - w / 2 - 0.06 : x + w / 2 + 0.06) : (z > 0 ? z - d / 2 - 0.06 : z + d / 2 + 0.06);
      for (let y = 9; y < h - 3; y += 3.4) for (let a = -Math.floor((Math.abs(x) > hx ? d : w) / 2) + 2; a < (Math.abs(x) > hx ? d : w) / 2 - 2; a += 3) { if (rnd() > 0.38) continue; const k = rnd() < 0.7 ? 'winWarm' : 'glassLit';
        if (Math.abs(x) > hx) mg.box(k, face - 0.03, y, z + a, face + 0.03, y + 1.5, z + a + 1.8); else mg.box(k, x + a, y, face - 0.03, x + a + 1.8, y + 1.5, face + 0.03); } });
  }
  // ── 덧붙이는 무늬: 벽의 얼룩·금·벗겨진 자리·표지, 바닥의 기름 얼룩·맨홀·금 (화질 '낮음'은 뺌). 전부 한 덩어리로 그림 ──
  if (!low) {
    const dP = [], dN = [], dU = [], dC = [];
    const covered = (x, y, z, self) => { for (const b of boxesNear(x, z, 0.06)) if (b !== self && !b.nv && x > b.min[0] && x < b.max[0] && y > b.min[1] && y < b.max[1] && z > b.min[2] && z < b.max[2]) return true; return false; };
    const put = (kind, c, ax, ay, n, w, h, tint) => { // c 가운데, ax 오른쪽·ay 위쪽 방향, n 바깥 방향
      const u0 = (kind % 4) / 4 + 0.008, u1 = u0 + 0.234, v1 = 1 - (kind >> 2) / 4 - 0.008, v0 = v1 - 0.234;
      const P = [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]].map(([a, b2, u, v]) => [c[0] + ax[0] * a * w / 2 + ay[0] * b2 * h / 2 + n[0] * 0.014, c[1] + ax[1] * a * w / 2 + ay[1] * b2 * h / 2 + n[1] * 0.014, c[2] + ax[2] * a * w / 2 + ay[2] * b2 * h / 2 + n[2] * 0.014, u, v]);
      for (const i of [0, 1, 2, 0, 2, 3]) { dP.push(P[i][0], P[i][1], P[i][2]); dN.push(n[0], n[1], n[2]); dU.push(P[i][3], P[i][4]); dC.push(tint[0], tint[1], tint[2]); }
    };
    const W1 = [1, 1, 1], posters = theme === 'station' || theme === 'city' || isle;
    let nWall = 0;
    for (const b of BOXES) {
      const kinds = DECAL_ON[b.m];
      if (!kinds || b.nv || nWall > 520) continue;
      const [x0, yb, z0] = b.min, [x1, y1, z1] = b.max, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y0 = Math.max(yb, groundAt(cx, cz) + 0.04), fh = y1 - y0;
      if (fh < 1.9) continue;
      let sd = (Math.abs(Math.round(x0 * 31 + z0 * 57 + y1 * 13 + x1 * 7)) % 9973) + 1; const R = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      const box = b.m[0] === 'c' && b.m.length === 2 || b.m === 'truckBox';
      for (let f = 0; f < 4; f++) { // 옆면 넷: +x, -x, +z, -z
        const alongZ = f < 2, fw = alongZ ? z1 - z0 : x1 - x0;
        if (fw < 2.2) continue;
        const n = f === 0 ? [1, 0, 0] : f === 1 ? [-1, 0, 0] : f === 2 ? [0, 0, 1] : [0, 0, -1], ax = [n[2], 0, -n[0]], fx0 = f === 0 ? x1 : f === 1 ? x0 : 0, fz0 = f === 2 ? z1 : f === 3 ? z0 : 0;
        let cnt = box ? (fw > 5 ? 1 : 0) : Math.min(3, Math.floor((fw * fh) / 15 + R() * 0.9));
        for (let k = 0; k < cnt; k++) {
          let kind = kinds[Math.floor(R() * kinds.length)];
          if (kind === 8 && !posters) kind = 4;
          const D = DECALS[kind]; let sc = 0.8 + R() * 0.45, w = D[0] * sc, h = D[1] * sc;
          if (w > fw - 0.35 || h > fh - 0.15) { sc = Math.min((fw - 0.35) / D[0], (fh - 0.15) / D[1]); if (sc < 0.6) continue; w = D[0] * sc; h = D[1] * sc; }
          const u = w / 2 + 0.17 + R() * Math.max(0, fw - w - 0.34);
          let y;
          if (box) y = y1 - h / 2 - 0.42;
          else if (D[2] === 1) y = y1 - h / 2 - 0.01;
          else if (D[2] === 2) y = y0 + h / 2;
          else if (kind >= 8 && kind <= 10) y = Math.min(y1 - h / 2 - 0.1, y0 + (kind === 10 ? 2.1 : 1.5) + R() * 0.5);
          else if (kind === 11) y = Math.min(y1 - h / 2 - 0.2, y0 + 2.6 + R() * 1.2);
          else y = y0 + h / 2 + 0.1 + R() * Math.max(0, fh - h - 0.2);
          if (y - h / 2 < y0 - 0.001) continue;
          const c = alongZ ? [fx0, y, n[0] > 0 ? z1 - u : z0 + u] : [n[2] > 0 ? x0 + u : x1 - u, y, fz0];
          if (box) { const uu = fw - w / 2 - 0.5; if (alongZ) c[2] = n[0] > 0 ? z1 - uu : z0 + uu; else c[0] = n[2] > 0 ? x0 + uu : x1 - uu; }
          let bad = false;
          for (const [a, b2] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) if (covered(c[0] + ax[0] * a * w * 0.46 + n[0] * 0.06, c[1] + b2 * h * 0.46, c[2] + ax[2] * a * w * 0.46 + n[2] * 0.06, b)) { bad = true; break; }
          if (bad) continue;
          put(kind, c, ax, [0, 1, 0], n, w, h, W1); nWall++;
        }
      }
    }
    if (!isle) { // 바닥
      let sd = 4711 + MAP * 97; const R = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      const gk = theme === 'town' ? [15, 15, 15, 14, 14] : theme === 'castle' ? [15, 15, 15, 15] : [12, 12, 14, 14, 14, 13];
      const tints = theme === 'town' ? [[0.93, 0.85, 0.68]] : theme === 'castle' ? [[0.8, 0.62, 0.2], [0.66, 0.4, 0.16], [0.55, 0.6, 0.24]] : [[0.72, 0.72, 0.7]];
      let want = Math.round((hx * hz * 4) / 210), holes = 0;
      for (let tries = 0; tries < want * 5 && want > 0; tries++) {
        const kind = gk[Math.floor(R() * gk.length)], D = DECALS[kind], sc = 0.75 + R() * 0.6, w = D[0] * sc, x = (R() * 2 - 1) * (hx - 3), z = (R() * 2 - 1) * (hz - 3), rot = kind === 13 ? 0 : R() * 6.283;
        if (kind === 13 && ++holes > 5) continue;
        const gy = groundAt(x, z), q = w * 0.5;
        if (gy < waterAt(x, z) + 0.05) continue;
        let bad = false;
        for (const [a, b2] of [[0, 0], [-q, -q], [q, -q], [q, q], [-q, q]]) if (Math.abs(groundAt(x + a, z + b2) - gy) > 0.03 || covered(x + a, gy + 0.3, z + b2, null)) { bad = true; break; }
        if (bad) continue;
        const cs = Math.cos(rot), sn = Math.sin(rot);
        put(kind, [x, gy + 0.012, z], [cs, 0, sn], [sn, 0, -cs], [0, 1, 0], w, w, kind === 15 ? tints[Math.floor(R() * tints.length)] : kind === 14 ? [0.5, 0.5, 0.5] : W1);
        want--;
      }
    }
    if (dP.length) {
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.Float32BufferAttribute(dP, 3)); dg.setAttribute('normal', new THREE.Float32BufferAttribute(dN, 3)); dg.setAttribute('uv', new THREE.Float32BufferAttribute(dU, 2)); dg.setAttribute('color', new THREE.Float32BufferAttribute(dC, 3));
      const dm = new THREE.Mesh(dg, new THREE.MeshLambertMaterial({ map: decalTex(), transparent: true, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      dm.receiveShadow = shadows; dm.renderOrder = 2; group.add(dm);
    }
  }
  const glowK = opt.hdr ? (T.night ? 2.6 : 1.3) : 1;
  const glow = (hex, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(Math.max(1, glowK * k)) }); // 불빛: 밝기 범위를 넘겨 빛이 번지게
  const refl = (m, r) => { if (envTex) { m.envMap = envTex; m.combine = THREE.MixOperation; m.reflectivity = r; } return m; };  // 하늘이 비치는 재질
  const mats = {
    car0: refl(lam({ color: 0xb23a32 }), 0.16), car1: refl(lam({ color: 0x2f5fa0 }), 0.16), car2: refl(lam({ color: 0xd9dbdd }), 0.12), car3: refl(lam({ color: 0x2b2f36 }), 0.2), car4: refl(lam({ color: 0x3f8a5a }), 0.16),
    busBody: refl(lam({ color: 0x2f8f6a }), 0.12), glassPane: refl(new THREE.MeshLambertMaterial({ color: 0x9fd0e6, transparent: true, opacity: 0.38 }), 0.55),
    winWarm: glow(0xffd58a, 0.8), cityFar: lam({ color: 0x8f7f7a }), skyline: lam({ color: 0x141a2c }), hill: lam({ color: 0x5f8a4a }), pine: lam({ color: 0x2f6b3c }), pine2: lam({ color: 0x3f7f44 }),
    yellow: lam({ color: 0xe0a91f }), dark: lam({ color: 0x2a2e34 }), steel: refl(lam({ color: 0x6d7680 }), 0.22), tire: lam({ color: 0x17181a }),
    truckBlue: refl(lam({ color: 0x2c5fa5 }), 0.12), glass: refl(lam({ color: 0x1c2733 }), 0.7), crane: lam({ color: 0xc9772b }),
    glassLit: glow(0xbfe0f2, 0.7), lamp: glow(0xfff3c4, 1.15),
    barrel0: tmat('barrel', { color: 0x2f6fb0 }, 3), barrel1: tmat('barrel', { color: 0xb03a2e }, 3), barrel2: tmat('barrel', { color: 0xd7a52a }, 3),
    sandCap: lam({ color: 0xc9ac80 }), dome: lam({ color: 0xefe3c8 }), doorWood: lam({ color: 0x6f4a2a }), winDark: lam({ color: 0x241c16 }),
    roofTile: tmat('shingle', { color: 0xc0603a, side: THREE.DoubleSide }), roofSlate: tmat('shingle', { color: 0x5d6b78, side: THREE.DoubleSide }),
    gableEnd: new THREE.MeshLambertMaterial({ color: 0x8a7458, side: THREE.DoubleSide }),
    pot: lam({ color: 0xb46a3c }), trunk: lam({ color: 0x7a5a3a }), leaf: new THREE.MeshLambertMaterial({ color: 0x3f8a3a, side: THREE.DoubleSide }), dune: lam({ color: 0xd9bd8c }),
    lanternA: glow(0xffc04a), lanternB: glow(0xff7a4a), lanternC: glow(0x7ad1c0),
    rugA: lam({ color: 0x9c2f2a }), rugB: lam({ color: 0x2f5f8a }),
    rust: lam({ color: 0x8a4a2c }), rust2: lam({ color: 0x6f5a48 }), boatHull: new THREE.MeshLambertMaterial({ color: 0x3f6f8f, side: THREE.DoubleSide }), white: lam({ color: 0xf0efe9 }),
    bollard: lam({ color: 0x2a2e34 }), sleeper: lam({ color: 0x4a3a2c }), tentRoof: lam({ color: 0xd9c9a6 }), whitePaint: lam({ color: 0xf0efe9 }), redPaint: lam({ color: 0xc23b32 }),
    siloMetal: refl(lam({ color: 0xb9c1c8 }), 0.3), stoneCol: lam({ color: 0x9a948a }), sail: new THREE.MeshLambertMaterial({ color: 0xe9e2d0, side: THREE.DoubleSide }),
    shipHull: lam({ color: 0x24303c }), shipRed: lam({ color: 0x8a2f2a }),
  };
  const noShadow = new Set(['winWarm', 'cityFar', 'skyline', 'hill', 'glassPane', 'glassLit', 'lamp', 'dune', 'lanternA', 'lanternB', 'lanternC', 'rugA', 'rugB', 'sleeper', 'shipHull', 'shipRed']);
  for (const k of mg.by.keys()) {
    const md = MATS[k];
    const mat = mats[k] || tmat(md ? md.tex : 'concrete', { color: md ? md.color : 0xffffff });
    const mesh = mg.build(k, mat, shadows);
    if (noShadow.has(k)) mesh.castShadow = false;
    if (k === 'dune' || k === 'hill' || k === 'skyline' || k === 'cityFar') mesh.receiveShadow = false;
    group.add(mesh);
  }

  // 바닥 페인트와 표지
  const paint = new THREE.MeshBasicMaterial({ color: 0xe8c33a, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const white = new THREE.MeshBasicMaterial({ color: 0xe9e9e4, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const line = (x0, z0, x1, z1, mat = paint) => flat(new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0) || 0.18, Math.abs(z1 - z0) || 0.18), mat), (x0 + x1) / 2, (z0 + z1) / 2);
  let waterMat = null;
  const wallSign = (text, w, h, x, y, z, ry, o) => { const m = textPlane(text, w, h, o); m.position.set(x, y, z); m.rotation.y = ry; group.add(m); };
  for (const d of map.decor) {
    if (d.t === 'slab') (map.hm ? slabOn : slab)(d.tex, d.x0, d.z0, d.x1, d.z1, d.tile || 4, d.color === undefined ? 0xffffff : d.color, map.hm ? (d.y || 0.012) - 0.012 : d.y || 0.012, d.any);
    else if (d.t === 'line') { const m = d.white ? white : paint, ly = (d.y === undefined ? groundAt((d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2) : d.y) + 0.02; if (d.wide) flat(new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(d.x1 - d.x0), Math.abs(d.z1 - d.z0)), m), (d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2, 0, ly); else line(d.x0, d.z0, d.x1, d.z1, m).position.y = ly; }
    else if (d.t === 'water') { waterMat = waterMat || waterMatOf(theme === 'castle' ? 0x2f6b72 : 0x2f7f9c, 0.8, 0.75); const m = new THREE.Mesh(new THREE.PlaneGeometry(d.x1 - d.x0, d.z1 - d.z0), waterMat); m.renderOrder = 1; flat(m, (d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2, 0, d.y); }
    else if (d.t === 'floorText') flat(textPlane(d.text, d.size || 4, d.size || 4, { color: d.color || '#f0c53a', size: 0.9 }), d.x - 6, d.z, -Math.PI / 2, groundAt(d.x - 6, d.z) + 0.04);
    else if (d.t === 'sign') wallSign(d.text, d.w, d.h, d.x, d.y, d.z, d.ry, { bg: d.bg, border: d.border, color: d.color, size: d.size });
  }

  // 팀 진영 바닥 색 (생존전에는 없음)
  const zones = [0, 1].map((t) => {
    const w = 8;
    const z = new THREE.Mesh(new THREE.PlaneGeometry(w, hz * 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: opt.lin ? 0.042 : 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    flat(z, t ? hx - 4 : -hx + 4, 0);
    z.visible = !isle;
    return z;
  });

  // 풀: 카메라 둘레에만 심고, 움직이면 다시 심는다 (색은 땅 색을 따라감)
  let grass = null;
  const GR = 30, GC = 1.15, GMAX = 2600, grassC = new THREE.Vector3(1e9, 0, 0);
  const gPads = isle ? (map.decor.find((d) => d.t === 'roads') || { pads: [] }).pads : [];
  if (isle && splatPix && !opt.lowFar) {
    const blades = [];
    for (let i = 0; i < 6; i++) { const hh = 0.24 + (i % 3) * 0.09, g = new THREE.ConeGeometry(0.028 + (i % 2) * 0.012, hh, 3, 1, true); const a = i * 1.05; g.translate(0, hh / 2, 0); g.rotateZ(Math.cos(a) * 0.3); g.rotateX(Math.sin(a) * 0.3); g.translate(Math.cos(a) * 0.14 * (1 + (i % 2)), 0, Math.sin(a) * 0.14 * (1 + (i % 2))); blades.push(g); }
    grass = new THREE.InstancedMesh(mergeGeos(blades), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), GMAX);
    grass.frustumCulled = false; grass.castShadow = false; grass.receiveShadow = false; grass.count = 0;
    group.add(grass); instanced.push(grass);
  }
  const plantGrass = (cam) => {
    grassC.set(cam.x, 0, cam.z);
    const hm = map.hm, i0 = Math.floor((cam.x - GR) / GC), i1 = Math.floor((cam.x + GR) / GC), j0 = Math.floor((cam.z - GR) / GC), j1 = Math.floor((cam.z + GR) / GC);
    let n = 0;
    const near = gPads.filter((p) => Math.hypot(p[0] - cam.x, p[1] - cam.z) < p[2] + GR + 4);
    for (let j = j0; j <= j1 && n < GMAX; j++) for (let i = i0; i <= i1 && n < GMAX; i++) {
      let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; const r1 = ((h >>> 8) & 1023) / 1023, r2 = ((h >>> 18) & 1023) / 1023;
      const x = (i + r1) * GC, z = (j + r2) * GC, d = Math.hypot(x - cam.x, z - cam.z);
      if (d > GR) continue;
      let inPad = false; for (const p of near) if (Math.hypot(p[0] - x, p[1] - z) < p[2] + 3) { inPad = true; break; }
      if (inPad) continue;
      const px = Math.floor(((x + hm.hx) / (hm.hx * 2)) * splatN), py = Math.floor(((hm.hz - z) / (hm.hz * 2)) * splatN);
      if (px < 0 || py < 0 || px >= splatN || py >= splatN) continue;
      const o = (py * splatN + px) * 4, r = splatPix[o], g = splatPix[o + 1], b = splatPix[o + 2];
      if (g < r + 14 || g < b + 34) continue; // 풀밭이 아니면 건너뜀
      const s = (0.8 + r1 * 0.8) * Math.min(1, (GR - d) / 9);
      Q.setFromAxisAngle(UP, r2 * 6.28); V.set(x, groundAt(x, z) - 0.03, z); Sc.set(s, s, s); M.compose(V, Q, Sc); grass.setMatrixAt(n, M);
      C.setRGB((r / 255) * (0.8 + r1 * 0.22), (g / 255) * (0.86 + r2 * 0.2), (b / 255) * 0.8, THREE.SRGBColorSpace); grass.setColorAt(n, C);
      n++;
    }
    grass.count = n; grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  };
  // 매 프레임: 하늘과 해는 카메라를 따라가고, 큰 맵에서는 그림자 영역도 따라간다
  const shC = new THREE.Vector3(1e9, 0, 0);
  let wt = 0, cullT = 0;
  const update = (cam, dt) => {
    sky.position.copy(cam); skyMat.uniforms.uTime.value += dt;
    for (const r of spinners) r.rotation.z += dt * 0.9;
    if (grass && (Math.abs(cam.x - grassC.x) > 4 || Math.abs(cam.z - grassC.z) > 4)) plantGrass(cam);
    cullT -= dt;
    if (cullT <= 0) { cullT = 0.4; for (const c of cullList) c.im.visible = Math.hypot(c.x - cam.x, c.z - cam.z) < c.far + 75; } // 먼 구역은 안 그림
    wt += dt; for (const m of waters) m.uniforms.uTime.value = wt;
    if (follow && shadows && (Math.abs(cam.x - shC.x) > 14 || Math.abs(cam.z - shC.z) > 14)) {
      const step = 4; shC.set(Math.round(cam.x / step) * step, 0, Math.round(cam.z / step) * step);
      const gy = groundAt(shC.x, shC.z);
      sun.target.position.set(shC.x, gy, shC.z); sun.position.copy(sunDir).multiplyScalar(sunDist).add(sun.target.position);
      sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
      renderer.shadowMap.needsUpdate = true;
    }
  };
  if (shadows) renderer.shadowMap.needsUpdate = true;
  const dispose = () => { // 맵을 바꿀 때 이전 맵 정리
    scene.remove(group);
    const keep = new Set([...Object.values(TEXC.map), ...Object.values(TEXC.nrm)]);
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map && !keep.has(o.material.map)) o.material.map.dispose(); o.material.dispose(); } });
    for (const im of instanced) im.dispose();
    for (const t of owned) t.dispose();
  };
  return { group, zones, sun, hemi, dispose, update, splat, far: isle ? 1700 : 520, mood: opt.mood || 0, grade: T.grade || null, night: !!T.night, theme: T };
}

// 캐릭터 발밑 그림자
let blobTex = null;
export function blobShadow() {
  blobTex = blobTex || canvasTex(64, (g, s) => { const rg = g.createRadialGradient(32, 32, 2, 32, 32, 30); rg.addColorStop(0, 'rgba(0,0,0,.62)'); rg.addColorStop(0.6, 'rgba(0,0,0,.3)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, s, s); }, false);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03;
  return m;
}
export { SITES };
