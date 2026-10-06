// 총 모델 추출: Sketchfab GLB 들 → public/models/guns.bin (게임이 쓰는 총만, 무기마다 색(재질)별로 합침)
//  · D_U (@DU1701) 의 low-poly 총들 (CC BY 4.0) — 파일마다 총 하나
//  · r2detta 'Low-Poly Weapon Asset Pack' (CC BY 4.0) — 아직 D_U 모델이 없는 총
// 사용:  node tools/extract_guns.mjs <GLB 들이 있는 폴더>
// 빼는 것: 낱개 탄·탄피, 빈 탄창, 겹치는 탄통, 탄띠 덩어리. 탄창·탄통은 'mag' 묶음(장전할 때 움직임)으로 따로 둠.
// 파일 구조: [u32 머리말 길이][머리말 JSON][0 채움][Int16 위치(무리별 min·scale 로 되돌림) … Uint16/32 번호]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const files = fs.readdirSync(dir);
const find = (pat) => { const f = files.find((n) => n.includes(pat)); if (!f) throw new Error('없음: ' + pat); return path.join(dir, f); };
// name: 게임 쪽 이름 · file: 파일 · drop: 더 뺄 부품 이름(정규식) · node: 팩 안의 총 노드 이름(r2detta)
const SRC = [
  { name: 'G21', file: find('g21_gen5') },
  { name: 'G18C', file: find('g18c') },
  { name: 'PB', file: find('pb_6p9') },
  { name: 'MP7', file: find('mp7_a1'), drop: /suppressor/ },
  { name: 'MP5', file: find('mp5_a3') },
  { name: 'M4S90', file: find('benelli_m4') },
  { name: 'Saiga12', file: find('saiga') },
  { name: 'SCAR16', file: find('scar_16s') },
  { name: 'SVDM', file: find('svdm') },
  { name: 'MG5', file: find('hk_mg5') },
  { name: 'PKM', file: find('pkm'), drop: /^(box\.001|ammo\.|strip)/ },
  ...['SawedOff', 'Revolver', 'Famas', 'VSS_Sniper', 'AK47', 'Barett'].map((n) => ({ name: n, file: find('weapon_asset_pack'), node: n })),
];
const AMMO = /empty|case|^[\d.x ]+(mm)?\s*_\d+$|^\.\d+acp_\d+$|^\d+n\d|bullets/i; // 낱개 탄·빈 탄창·탄피
const MAGN = /(^|[\s_])mag(\s|_|$|azine)|magazine|ammo box|^box|belt/i; // 장전할 때 움직이는 것
const NOMAG = /release/i;

const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function local(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}
function load(file) {
  const d = fs.readFileSync(file), jl = d.readUInt32LE(12), J = JSON.parse(d.subarray(20, 20 + jl).toString()), binOff = 20 + jl + 8, dv = new DataView(d.buffer, d.byteOffset);
  const acc = (i) => {
    const a = J.accessors[i], bv = J.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const C = { 5126: [4, 'getFloat32'], 5125: [4, 'getUint32'], 5123: [2, 'getUint16'], 5121: [1, 'getUint8'] }[a.componentType];
    const off = binOff + (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n * C[0], out = new Float64Array(a.count * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = dv[C[1]](off + k * stride + c * C[0], true);
    return out;
  };
  return { J, acc };
}
// 재질 → 게임 색 역할: body(총몸) · metal(강철) · poly(손잡이·플라스틱) · brass(놋쇠) · light(밝은 작은 부품) · olive · glass
function roleOf(J, m) {
  const M = J.materials[m] || {}, nm = (M.name || '').toLowerCase(), c = (M.pbrMetallicRoughness || {}).baseColorFactor || [1, 1, 1, 1];
  const [r, g, b] = c;
  if (/glass|lens/.test(nm)) return 'glass';
  if (/brass|copper/.test(nm)) return 'brass';
  if (/olive/.test(nm) || (g > r && g > b && g > 0.1 && g < 0.5)) return 'olive';          // 국방색 탄통
  if (/tritium|white/.test(nm) || r + g + b > 2.4 || g > 0.9) return 'light';           // 야광점·작은 밝은 부품
  if (r > 0.3 && g < 0.1) return 'accent';                                              // 빨간 안전장치 표시
  if (r > 0.3 && b < 0.2 && g / r > 0.55) return 'tan';                                 // 사막색(FDE) 총몸
  if (r > 0.3 && b < 0.2) return 'brass';                                               // 주황 = 탄
  if (r < 0.15 && r > 0.05 && r > b * 2 && r > g) return 'wood';                        // 짙은 갈색 = 나무
  if (/poly|resin|grip|black|rubber/.test(nm)) return 'poly';
  if (/stell|steel|chrome/.test(nm)) return 'metal';
  return 'body';
}
// r2detta 팩: 밝기 단계 → 역할 (기존 b30… 그대로)
const SHADE = (nm) => (nm === 'Glass' ? 'glass' : nm === 'White' ? 'white' : nm === 'L115_Awp__0' ? 'b30' : ({ material: 'b30', material_7: 'b50', material_2: 'b60', material_4: 'b70', material_5: 'b80' })[nm] || 'b60');

const weapons = {};
for (const S of SRC) {
  const { J, acc } = load(S.file), W = (weapons[S.name] = { groups: {}, src: J.asset.extras });
  const isPack = !!S.node;
  function walk(ni, M, inGun, sub, drop) {
    const n = J.nodes[ni], Wm = mul(M, local(n)), nm = (n.name || '').trim();
    let g = inGun, s = sub, dr = drop;
    if (isPack && nm === S.node) g = true;
    if (!isPack) g = true;
    if (g && !dr) {
      if (!isPack && (AMMO.test(nm) || (S.drop && S.drop.test(nm)))) dr = true;
      if (!s && MAGN.test(nm) && !NOMAG.test(nm)) s = 'mag';
      if (isPack && /_Top$/.test(nm)) s = 'top';
      if (isPack && /Minigun_Front$/.test(nm)) s = 'spin';
    }
    if (g && !dr && n.mesh !== undefined) for (const p of J.meshes[n.mesh].primitives) {
      const pos = acc(p.attributes.POSITION), idx = p.indices !== undefined ? acc(p.indices) : Float64Array.from({ length: pos.length / 3 }, (_, i) => i);
      const role = isPack ? SHADE(J.materials[p.material].name) : roleOf(J, p.material), key = (s ? s + ':' : '') + role, G = (W.groups[key] ||= { p: [], i: [] }), base = G.p.length / 3;
      for (let k = 0; k < pos.length; k += 3) { const x = pos[k], y = pos[k + 1], z = pos[k + 2]; G.p.push(Wm[0] * x + Wm[4] * y + Wm[8] * z + Wm[12], Wm[1] * x + Wm[5] * y + Wm[9] * z + Wm[13], Wm[2] * x + Wm[6] * y + Wm[10] * z + Wm[14]); }
      for (const v of idx) G.i.push(v + base);
    }
    for (const c of n.children || []) walk(c, Wm, g, s, dr);
  }
  for (const r of J.scenes[0].nodes) walk(r, I, false, null, false);
}

// 무기마다: 가장 긴 축을 총열(z)로, 상자 가운데를 원점으로. 방향(총구가 +z/-z, 위아래)은 게임 쪽 표(GLB_FIT)의 flip 으로 맞춤
const head = { credits: {}, weapons: {} }, chunks = [];
let bytes = 0;
const push = (arr) => { chunks.push(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)); const at = bytes; bytes += arr.byteLength; if (bytes % 4) { const pad = 4 - (bytes % 4); chunks.push(Buffer.alloc(pad)); bytes += pad; } return at; };
for (const [name, w] of Object.entries(weapons)) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const G of Object.values(w.groups)) for (let k = 0; k < G.p.length; k++) { const a = k % 3; mn[a] = Math.min(mn[a], G.p[k]); mx[a] = Math.max(mx[a], G.p[k]); }
  const ext = mx.map((v, a) => v - mn[a]), c = mn.map((v, a) => (v + mx[a]) / 2);
  // 축 바꾸기: 가장 긴 축 → z, 남은 것 중 긴 축 → y(높이), 가장 짧은 축 → x(두께)
  const order = [0, 1, 2].sort((a, b) => ext[a] - ext[b]), [ax, ay, az] = order, unit = Math.max(...ext);
  const H = (head.weapons[name] = { size: [ext[ax], ext[ay], ext[az]].map((v) => +(v / unit).toFixed(5)), groups: {} });
  head.credits[name] = w.src && w.src.author ? `${w.src.title} — ${w.src.author} — ${w.src.license}` : '';
  for (const [key, G] of Object.entries(w.groups)) {
    const n = G.p.length / 3, q = new Int16Array(n * 3);
    const odd = ['021', '102', '210'].includes([ax, ay, az].join('')); // 축 바꾸기가 거울상이 되면 두께 축을 뒤집어 그냥 회전으로 만듦
    for (let i = 0; i < n; i++) for (const [o, a] of [[0, ax], [1, ay], [2, az]]) q[i * 3 + o] = Math.round(((G.p[i * 3 + a] - c[a]) / unit) * (o === 0 && odd ? -1 : 1) * 2 * 32767); // -0.5…0.5 → Int16
    const big = n > 65535, ib = big ? new Uint32Array(G.i) : new Uint16Array(G.i);
    H.groups[key] = { n, ni: G.i.length, big, p: push(q), i: push(ib) };
  }
}
let hj = Buffer.from(JSON.stringify(head));
hj = Buffer.concat([hj, Buffer.alloc((4 - ((4 + hj.length) % 4)) % 4, 32)]);
const len = Buffer.alloc(4); len.writeUInt32LE(hj.length);
fs.mkdirSync('public/models', { recursive: true });
fs.writeFileSync('public/models/guns.bin', Buffer.concat([len, hj, ...chunks]));
console.log('weapons', Object.keys(head.weapons).length, 'bytes', 4 + hj.length + bytes);
for (const [n, w] of Object.entries(head.weapons)) console.log(n.padEnd(11), w.size.join(' x '), Object.entries(w.groups).map(([k, g]) => k + ':' + g.n).join(' '));
