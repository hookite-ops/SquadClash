// 총 모델 추출: Sketchfab 'Low-Poly Weapon Asset Pack' (r2detta, CC-BY-4.0) GLB → public/models/guns.bin
// 쓰는 총만 골라, 무기마다 색(재질) 별로 꼭짓점을 합쳐 작은 파일 하나로 만든다. 노드 변환은 미리 적용(월드 좌표).
// 사용:  node tools/extract_guns.mjs <pack.glb>
// 파일 구조: [u32 머리말 길이][머리말 JSON][0 채움][Float32 위치·UV … Uint16/32 번호]
import fs from 'node:fs';

const KEEP = ['Glock17', 'SawedOff', 'M1911', 'Usp45_Silenced', 'Revolver', 'Kriss_Vector', 'Mp5K', 'Spas_12', 'AA12', 'Famas', 'ScarH', 'VSS_Sniper', 'AK47', 'L115_Awp', 'Barett', 'M249', 'Minigun', 'Deagle', 'M16A4', 'G36', 'Uzi', 'P90'];
const src = process.argv[2];
const d = fs.readFileSync(src), jl = d.readUInt32LE(12), J = JSON.parse(d.subarray(20, 20 + jl).toString());
const binOff = 20 + jl + 8;

const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function local(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}
function acc(i) {
  const a = J.accessors[i], bv = J.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const C = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
  const off = binOff + (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n * C.BYTES_PER_ELEMENT;
  const out = new (C === Float32Array ? Float32Array : Uint32Array)(a.count * n), dv = new DataView(d.buffer, d.byteOffset);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
    const p = off + k * stride + c * C.BYTES_PER_ELEMENT;
    out[k * n + c] = C === Float32Array ? dv.getFloat32(p, true) : C === Uint32Array ? dv.getUint32(p, true) : C === Uint16Array ? dv.getUint16(p, true) : dv.getUint8(p);
  }
  return out;
}
// 재질 이름 → 색 단계 (밝기). 30 이 가장 밝고 80 이 가장 어두움
const SHADE = (m) => { const nm = J.materials[m].name; return nm === 'Glass' ? 'glass' : nm === 'White' ? 'white' : nm === 'L115_Awp__0' ? 'b30' : ({ material: 'b30', material_7: 'b50', material_2: 'b60', material_4: 'b70', material_5: 'b80' })[nm] || 'b60'; };

const weapons = {}, chunks = [];
let bytes = 0;
function walk(ni, M, wName, sub) {
  const n = J.nodes[ni], W = mul(M, local(n));
  if (KEEP.includes(n.name) && !wName) { wName = n.name; weapons[wName] = { groups: {} }; }
  const isMag = /magazine/i.test(n.name || ''), sub2 = sub || (isMag ? 'mag' : wName && /_Top$/.test(n.name) ? 'top' : wName && /Minigun_Front$/.test(n.name) ? 'spin' : null);
  if (wName && n.mesh !== undefined) for (const p of J.meshes[n.mesh].primitives) {
    const pos = acc(p.attributes.POSITION), uv = p.attributes.TEXCOORD_0 !== undefined ? acc(p.attributes.TEXCOORD_0) : null, idx = acc(p.indices);
    const key = (sub2 ? sub2 + ':' : '') + SHADE(p.material), G = (weapons[wName].groups[key] ||= { p: [], uv: [], i: [] });
    const base = G.p.length / 3;
    for (let k = 0; k < pos.length; k += 3) { const x = pos[k], y = pos[k + 1], z = pos[k + 2]; G.p.push(W[0] * x + W[4] * y + W[8] * z + W[12], W[1] * x + W[5] * y + W[9] * z + W[13], W[2] * x + W[6] * y + W[10] * z + W[14]); }
    if (uv) for (const v of uv) G.uv.push(v); else for (let k = 0; k < pos.length / 3; k++) G.uv.push(0, 0);
    for (const v of idx) G.i.push(v + base);
  }
  for (const c of n.children || []) walk(c, W, wName, sub2);
}
for (const r of J.scenes[0].nodes) walk(r, I, null, null);

// 무기마다 원점 이동 (상자 가운데) — 좌표는 원본 단위 그대로, 크기·방향 맞춤은 게임 쪽 표(GLB_FIT)에서
const head = { src: J.asset.extras, weapons: {} };
for (const [name, w] of Object.entries(weapons)) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const G of Object.values(w.groups)) for (let k = 0; k < G.p.length; k++) { const a = k % 3; mn[a] = Math.min(mn[a], G.p[k]); mx[a] = Math.max(mx[a], G.p[k]); }
  const c = mn.map((v, a) => (v + mx[a]) / 2), H = (head.weapons[name] = { size: mx.map((v, a) => +(v - mn[a]).toFixed(4)), groups: {} });
  for (const [key, G] of Object.entries(w.groups)) {
    const pf = new Float32Array(G.p.length); for (let k = 0; k < G.p.length; k++) pf[k] = G.p[k] - c[k % 3];
    const big = G.p.length / 3 > 65535, ib = big ? new Uint32Array(G.i) : new Uint16Array(G.i), uf = new Float32Array(G.uv);
    const ent = { n: G.p.length / 3, ni: G.i.length, big };
    for (const [k, arr] of [['p', pf], ['uv', uf], ['i', ib]]) { ent[k] = bytes; chunks.push(Buffer.from(arr.buffer)); bytes += arr.byteLength; if (bytes % 4) { const pad = 4 - (bytes % 4); chunks.push(Buffer.alloc(pad)); bytes += pad; } }
    H.groups[key] = ent;
  }
}
let hj = Buffer.from(JSON.stringify(head));
const hpad = (4 - ((4 + hj.length) % 4)) % 4;
hj = Buffer.concat([hj, Buffer.alloc(hpad, 32)]);
const len = Buffer.alloc(4); len.writeUInt32LE(hj.length);
fs.mkdirSync('public/models', { recursive: true });
fs.writeFileSync('public/models/guns.bin', Buffer.concat([len, hj, ...chunks]));
console.log('weapons', Object.keys(head.weapons).length, 'bytes', 4 + hj.length + bytes);
for (const [n, w] of Object.entries(head.weapons)) console.log(n, w.size.join(' x '), Object.keys(w.groups).join(','));
