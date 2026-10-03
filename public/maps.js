// 맵 정의 — 서버와 클라이언트가 같은 파일을 쓴다 (충돌 상자, 장식 정보, 지형 높이, 아이템 자리)
// 상자: B(x0, z0, x1, z1, y0, y1, 재질).  좌표: +x 동쪽, +z 북쪽, y 높이. 단위 m.
const HP = Math.PI / 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function builder() {
  const boxes = [], decor = [], loot = [];
  return {
    boxes, decor, loot,
    B: (x0, z0, x1, z1, y0, y1, m, nv) => { const b = { min: [x0, y0, z0], max: [x1, y1, z1], m }; if (nv) b.nv = true; boxes.push(b); return b; },
    D: (o) => { decor.push(o); return o; },
    L: (x, y, z) => loot.push([x, y, z]),
  };
}

// 들어갈 수 있는 건물: 벽 4면(문·창 구멍), 바닥, 지붕
// ops: [면 'n'|'s'|'e'|'w', 벽을 따라 잰 중심 좌표, 너비, 'door'|'win']
function house(K, x0, z0, x1, z1, y, h, wall, o = {}) {
  const { B, D, L } = K, t = 0.3, top = y + h, ops = o.ops || [];
  for (const side of ['n', 's', 'e', 'w']) {
    const horiz = side === 'n' || side === 's';
    const a0 = horiz ? x0 : z0 + t, a1 = horiz ? x1 : z1 - t;
    const c0 = side === 's' ? z0 : side === 'n' ? z1 - t : side === 'w' ? x0 : x1 - t;
    const put = (a, b, ya, yb) => { if (b - a < 0.02 || yb - ya < 0.02) return; if (horiz) B(a, c0, b, c0 + t, ya, yb, wall); else B(c0, a, c0 + t, b, ya, yb, wall); };
    let cur = a0;
    for (const [, at, w, kind, lv] of ops.filter((p) => p[0] === side).sort((p, q) => p[1] - q[1])) {
      const s = at - w / 2, e = at + w / 2; // lv: 1 = 2층에만 창, 2 = 1·2층 모두 (문은 1 = 위에 창)
      put(cur, s, y - 1.2, top);
      if (kind === 'door') { if (lv) { put(s, e, y + 2.25, y + 4.0); put(s, e, y + 5.2, top); } else put(s, e, y + 2.25, top); }
      else if (lv === 1) { put(s, e, y - 1.2, y + 4.0); put(s, e, y + 5.2, top); }
      else if (lv === 2) { put(s, e, y - 1.2, y + 1.0); put(s, e, y + 2.2, y + 4.0); put(s, e, y + 5.2, top); }
      else { put(s, e, y - 1.2, y + 1.0); put(s, e, y + 2.2, top); }
      cur = e;
    }
    put(cur, a1, y - 1.2, top);
  }
  if (o.floor !== false) B(x0 + t, z0 + t, x1 - t, z1 - t, y - 1.2, y + 0.06, o.floor || 'floorWood');
  if (o.roof !== false) B(x0 - 0.25, z0 - 0.25, x1 + 0.25, z1 + 0.25, top, top + 0.22, o.roofMat || 'roof');
  D({ t: 'house', x0, z0, x1, z1, y, top, ops, gable: o.gable || 0, gcol: o.gcol || 'roofTile', trim: o.trim || 'doorWood' });
  if (o.floor2) { // 2층 바닥과 안쪽 계단 (서쪽 벽을 따라 올라감)
    const sx = x0 + t, sz = z0 + t + 1.1, len = stairs(K, sx, sz, '+z', y, y + 3, 1.3, 'wood');
    B(x0 + t + 1.3, z0 + t, x1 - t, z1 - t, y + 2.8, y + 3, 'floorWood'); B(x0 + t, sz + len, x0 + t + 1.3, z1 - t, y + 2.8, y + 3, 'floorWood');
    B(x0 + t + 1.3, z0 + t, x0 + t + 1.4, sz + len - 1, y + 3, y + 3.9, 'fence'); // 난간
    L(x1 - 1.2, y + 3, z1 - 1.2); L(x1 - 1.2, y + 3, z0 + 1.2); L((x0 + x1) / 2, y + 3, (z0 + z1) / 2);
  }
  if (K.furn && o.furn !== false) { // 가구: 문에서 먼 구석에 침대·장, 가운데 탁자
    const nearDoor = (cx, cz) => ops.some(([sd, at, w, kind]) => kind === 'door' && Math.hypot((sd === 'n' || sd === 's' ? at : sd === 'w' ? x0 : x1) - cx, (sd === 'e' || sd === 'w' ? at : sd === 's' ? z0 : z1) - cz) < 3 + w / 2);
    if (!(o.loot > 2) && !o.floor2) {
      if (!nearDoor(x1, z0)) { B(x1 - t - 2, z0 + t, x1 - t, z0 + t + 1, y, y + 0.5, 'bed'); B(x1 - t - 0.5, z0 + t + 0.1, x1 - t - 0.05, z0 + t + 0.9, y + 0.5, y + 0.62, 'pillow'); }
      if (!nearDoor(x0, z1)) B(x0 + t, z1 - t - 0.5, x0 + t + 1.2, z1 - t, y, y + 1.8, 'cabinet');
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (x1 - x0 >= 7 && z1 - z0 >= 6 && !(o.loot > 4) && !o.floor2) { B(cx - 0.7, cz - 0.45, cx + 0.7, cz + 0.45, y + 0.68, y + 0.76, 'tableTop'); for (const [dx, dz] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) B(cx + dx - 0.05, cz + dz - 0.05, cx + dx + 0.05, cz + dz + 0.05, y, y + 0.68, 'tableTop'); B(cx - 0.25, cz + 0.7, cx + 0.25, cz + 1.15, y, y + 0.45, 'cabinet'); }
  }
  if (o.loot) { // 아이템 자리: 구석 두 곳 (+ 큰 건물은 가운데)
    L(x0 + 1.2, y + 0.06, z0 + 1.2); L(x1 - 1.2, y + 0.06, z1 - 1.2);
    if (o.loot > 2) { L(x1 - 1.2, y + 0.06, z0 + 1.2); L(x0 + 1.2, y + 0.06, z1 - 1.2); }
    if (o.loot > 4) { L((x0 + x1) / 2, y + 0.06, (z0 + z1) / 2); L((x0 + x1) / 2 + 2, y + 0.06, (z0 + z1) / 2 - 1.5); }
  }
  return top + 0.22;
}
// 계단: (x, z) 에서 dir 방향으로 올라감. 한 칸 0.4m 이하라 걸어서 오를 수 있다
function stairs(K, x, z, dir, y0, y1, w, mat) {
  const n = Math.ceil((y1 - y0) / 0.4), sh = (y1 - y0) / n, sd = 0.58;
  for (let i = 0; i < n; i++) {
    const a = i * sd, b = a + sd, yt = y0 + sh * (i + 1);
    if (dir === '+x') K.B(x + a, z, x + b, z + w, y0 - 1.2, yt, mat);
    else if (dir === '-x') K.B(x - b, z, x - a, z + w, y0 - 1.2, yt, mat);
    else if (dir === '+z') K.B(x, z + a, x + w, z + b, y0 - 1.2, yt, mat);
    else K.B(x, z - b, x + w, z - a, y0 - 1.2, yt, mat);
  }
  return n * sd;
}

// ───────────── 경기장 맵 (폭탄전·데스매치) ─────────────
// 맵마다 뼈대가 되는 구조와 높낮이가 다르다: 수로와 언덕 / 건선거와 창고 홀 / 낮은 선로와 육교 / 해자와 성 / 고가도로와 지하 주차장
// 공통: 서쪽 = 폭탄전 공격 진영, 동쪽 = 수비 진영. 봇이 지나가려면 문 너비 2.4m 이상, 경사는 1m 에 0.9m 미만.
// 땅 높이(K.T)는 1m 격자. 높이 차가 큰 자리에는 축대(벽)가 저절로 생긴다. 다리·계단처럼 봇도 올라설 바닥은 deck 표시.
function makeTerrain(hx, hz) {
  const nx = hx * 2 + 1, nz = hz * 2 + 1, H = new Float32Array(nx * nz);
  const each = (x0, z0, x1, z1, fn) => { for (let j = Math.max(0, Math.ceil(z0 + hz)); j <= Math.min(nz - 1, Math.floor(z1 + hz)); j++) for (let i = Math.max(0, Math.ceil(x0 + hx)); i <= Math.min(nx - 1, Math.floor(x1 + hx)); i++) H[j * nx + i] = fn(i - hx, j - hz, H[j * nx + i]); };
  return {
    H, nx, nz,
    flat: (x0, z0, x1, z1, h) => each(x0, z0, x1, z1, () => h),                                                   // 평평하게
    ramp: (x0, z0, x1, z1, hA, hB, ax) => each(x0, z0, x1, z1, (x, z) => (ax === 'x' ? hA + ((hB - hA) * (x - x0)) / (x1 - x0) : hA + ((hB - hA) * (z - z0)) / (z1 - z0))), // 경사로 (hA → hB)
    hill: (cx, cz, r, h) => each(cx - r, cz - r, cx + r, cz + r, (x, z, v) => { const d = Math.hypot(x - cx, z - cz) / r; return d >= 1 ? v : v + h * (0.5 + 0.5 * Math.cos(d * Math.PI)); }), // 둥근 언덕
    at: (x, z) => { const fx = clamp(x + hx, 0, nx - 1.001), fz = clamp(z + hz, 0, nz - 1.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, a = H[j * nx + i], b = H[j * nx + i + 1], c = H[(j + 1) * nx + i], d = H[(j + 1) * nx + i + 1]; return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; },
  };
}
// 높이 차가 큰 칸마다 축대를 세움 (윗면은 높은 쪽 땅과 같은 높이)
function cliffs(K, mat) {
  const { H, nx, nz } = K.T, hx = (nx - 1) / 2, hz = (nz - 1) / 2;
  for (let j = 0; j < nz - 1; j++) {
    let run = null;
    for (let i = 0; i <= nx - 1; i++) {
      let lo = 0, hi = 0, steep = false;
      if (i < nx - 1) { const a = H[j * nx + i], b = H[j * nx + i + 1], c = H[(j + 1) * nx + i], d = H[(j + 1) * nx + i + 1]; lo = Math.min(a, b, c, d); hi = Math.max(a, b, c, d); steep = hi - lo > 0.9; }
      if (run && (!steep || Math.abs(lo - run.lo) > 0.05 || Math.abs(hi - run.hi) > 0.05)) { K.B(run.i - hx, j - hz, i - hx, j - hz + 1, run.lo - 0.3, run.hi, mat); run = null; }
      if (steep && !run) run = { i, lo, hi };
    }
  }
}
function arenaMap(key, name, arena, wallMat, theme, fill, sites, tdmExtra, cliffMat) {
  const K = builder(), { hx, hz, wallH: H } = arena, B = K.B;
  K.T = makeTerrain(hx, hz); K.g = K.T.at; K.water = [];
  fill(K);
  cliffs(K, cliffMat || wallMat);
  B(-hx - 1, -hz - 1, -hx, hz + 1, -8, H, wallMat); B(hx, -hz - 1, hx + 1, hz + 1, -8, H, wallMat);
  B(-hx, -hz - 1, hx, -hz, -8, H, wallMat); B(-hx, hz, hx, hz + 1, -8, H, wallMat);
  const spawns = [SPAWN_Z.map((z) => [-hx + 3, z, -HP]), SPAWN_Z.map((z) => [hx - 3, z, HP])];
  const spawnsTdm = [[...spawns[0], ...tdmExtra[0].map(([x, z]) => [x, z, -HP])], [...spawns[1], ...tdmExtra[1].map(([x, z]) => [x, z, HP])]]; // 데스매치는 구석에서도 리스폰
  const flatMap = K.T.H.every((v) => v === 0);
  return { key, name, theme, arena, boxes: K.boxes, decor: K.decor, loot: K.loot, spawns, spawnsTdm, sites, water: K.water, hm: flatMap ? null : { H: K.T.H, n: K.T.nx, nz: K.T.nz, res: 1, hx, hz, min: -99 } };
}
const SPAWN_Z = [-6, -3, 0, 3, 6, -9, 9];

// ── 짓는 도구 (모두 그 자리 땅 높이에 맞춰 놓임) ──
const gLo = (K, x0, z0, x1, z1) => Math.min(K.g(x0, z0), K.g(x1, z0), K.g(x0, z1), K.g(x1, z1), K.g((x0 + x1) / 2, (z0 + z1) / 2));
const gMid = (K, x0, z0, x1, z1) => K.g((x0 + x1) / 2, (z0 + z1) / 2);
// 땅에 놓는 상자: 가운데 땅 높이에서 h 만큼 올라오고, 비탈이면 낮은 쪽까지 묻음. y = 바닥에서 띄울 높이
const put = (K, x0, z0, x1, z1, h, mat, y = 0) => { const g = gMid(K, x0, z0, x1, z1); return K.B(x0, z0, x1, z1, y ? g + y : gLo(K, x0, z0, x1, z1) - 0.1, g + y + h, mat); };
const deck = (K, fn) => { const n = K.boxes.length; fn(); for (let i = n; i < K.boxes.length; i++) K.boxes[i].deck = true; }; // fn 이 만든 상자를 봇도 올라서는 바닥으로
// 담: (x0,z0)→(x1,z1) 직선. gaps = [[시작, 끝, 문틀 높이?, 창턱 높이?]] 를 벽을 따라 잰 좌표로 비움
function wall(K, x0, z0, x1, z1, h, mat, gaps = [], th = 0.6) {
  const ax = Math.abs(x1 - x0) >= Math.abs(z1 - z0), a0 = ax ? Math.min(x0, x1) : Math.min(z0, z1), a1 = ax ? Math.max(x0, x1) : Math.max(z0, z1), c = ax ? z0 : x0;
  const gAt = (a) => (ax ? K.g(a, c) : K.g(c, a)), base = Math.min(gAt(a0), gAt(a1)) - 0.6, top = Math.max(gAt(a0), gAt(a1)) + h;
  const add = (a, b, y0, y1) => { if (b - a < 0.05 || y1 - y0 < 0.05) return; if (ax) K.B(a, c - th / 2, b, c + th / 2, y0, y1, mat); else K.B(c - th / 2, a, c + th / 2, b, y0, y1, mat); };
  let cur = a0;
  for (const [ga, gb, lintel, sill] of [...gaps].sort((p, q) => p[0] - q[0])) { const gg = gAt((ga + gb) / 2); add(cur, ga, base, top); if (lintel) add(ga, gb, gg + lintel, top); if (sill) add(ga, gb, base, gg + sill); cur = gb; }
  add(cur, a1, base, top);
}
// 방: 네 벽(면마다 gaps)과 지붕
function room(K, x0, z0, x1, z1, h, mat, o = {}) {
  const th = o.th || 0.6, y = o.y === undefined ? gMid(K, x0, z0, x1, z1) : o.y;
  wall(K, x0, z1, x1, z1, h, mat, o.n, th); wall(K, x0, z0, x1, z0, h, mat, o.s, th); wall(K, x0, z0, x0, z1, h, mat, o.w, th); wall(K, x1, z0, x1, z1, h, mat, o.e, th);
  if (o.roof !== false) K.B(x0 - th / 2 - 0.2, z0 - th / 2 - 0.2, x1 + th / 2 + 0.2, z1 + th / 2 + 0.2, y + h, y + h + 0.3, o.roof || 'roof');
  if (o.floor) K.D({ t: 'slab', tex: o.floor[0], x0, z0, x1, z1, tile: 3, color: o.floor[1], y: y + 0.012 });
  return y;
}
// 다리: 윗면 높이 y 의 바닥판과 난간(긴 쪽 양옆). o.bot = false 면 사람만 건넘, o.piers = 다릿기둥 자리 [[x, z], …]
function bridge(K, x0, z0, x1, z1, y, mat, o = {}) {
  const b = K.B(x0, z0, x1, z1, y - 0.45, y, mat); if (o.bot !== false) b.deck = true;
  const rm = o.rail || 'fence', rh = o.rh || 1;
  if (o.rail !== false) { if (x1 - x0 >= z1 - z0) { K.B(x0, z0 - 0.02, x1, z0 + 0.14, y, y + rh, rm); K.B(x0, z1 - 0.14, x1, z1 + 0.02, y, y + rh, rm); } else { K.B(x0 - 0.02, z0, x0 + 0.14, z1, y, y + rh, rm); K.B(x1 - 0.14, z0, x1 + 0.02, z1, y, y + rh, rm); } }
  for (const [px, pz] of o.piers || []) K.B(px - 0.5, pz - 0.5, px + 0.5, pz + 0.5, K.g(px, pz) - 0.2, y - 0.45, o.pier || mat);
}
const slab = (K, tex, x0, z0, x1, z1, tile, color) => K.D({ t: 'slab', tex, x0, z0, x1, z1, tile, color, y: gMid(K, x0, z0, x1, z1) + 0.012 });
const water = (K, x0, z0, x1, z1, level) => { K.water.push([x0, z0, x1, z1, level]); K.D({ t: 'water', x0, z0, x1, z1, y: level }); };
const sign = (K, text, w, h, x, y, z, ry, st) => K.D({ t: 'sign', text, w, h, x, y: y + K.g(x, z), z, ry, ...st });
const lanterns = (K, x0, z0, x1, z1, y, n) => K.D({ t: 'lanterns', x0, z0, x1, z1, y: y + Math.max(K.g(x0, z0), K.g(x1, z1)), n });
const deco = (K, k, list) => K.D({ t: 'deco', k, b: list }); // 충돌 없는 장식 상자 [x0, y0, z0, x1, y1, z1] (높이는 직접 줌)
function cont(K, x, z, ax, mats) { // 컨테이너(12 × 2.5 × 2.6m)를 mats 수만큼 쌓음. ax = 긴 쪽 방향
  const x1 = ax === 'x' ? x + 12 : x + 2.5, z1 = ax === 'x' ? z + 2.5 : z + 12, g = gMid(K, x, z, x1, z1), lo = gLo(K, x, z, x1, z1);
  mats.forEach((m, i) => K.B(x, z, x1, z1, i ? g + i * 2.6 : lo - 0.05, g + i * 2.6 + 2.6, m));
}
function truck(K, x, z, flip) { // 동서로 세운 화물차 (flip = 머리가 동쪽)
  const g = gMid(K, x, z, x + 8.5, z + 2.8);
  if (flip) { K.B(x + 6.3, z + 0.2, x + 8.5, z + 2.6, g, g + 2.5, 'truckCab'); K.B(x, z, x + 6.1, z + 2.8, g + 0.8, g + 3.4, 'truckBox'); }
  else { K.B(x, z + 0.2, x + 2.2, z + 2.6, g, g + 2.5, 'truckCab'); K.B(x + 2.4, z, x + 8.5, z + 2.8, g + 0.8, g + 3.4, 'truckBox'); }
}
const crates = (K, list) => { for (const [x, z, s = 2, n = 1] of list) { const g = gMid(K, x, z, x + s, z + s), lo = gLo(K, x, z, x + s, z + s); for (let i = 0; i < n; i++) K.B(x, z, x + s, z + s, i ? g + i * 1.2 : lo - 0.1, g + i * 1.2 + 1.2, 'crate'); } };
const barrels = (K, list) => { for (const [x, z] of list) { const g = K.g(x + 0.8, z + 0.6); K.B(x, z, x + 0.8, z + 0.8, g, g + 1.1, 'barrel'); K.B(x + 0.9, z + 0.4, x + 1.7, z + 1.2, g, g + 1.1, 'barrel'); } };
const lows = (K, mat, h, list) => { for (const [x0, z0, x1, z1] of list) put(K, x0, z0, x1, z1, h, mat); }; // 낮은 엄폐물 여러 개
const tent = (K, x, z) => { const g = gMid(K, x, z, x + 5, z + 5); put(K, x, z, x + 5, z + 5, 2.3, 'tentCloth'); K.D({ t: 'tentTop', x: x + 2.5, z: z + 2.5, y: g + 2.3, r: 3.9, h: 1.5 }); };
const stall = (K, x, z, ax) => { // 천막 친 좌판
  const g = K.g(x + 1, z + 1);
  if (ax) { put(K, x, z, x + 1, z + 4, 1, 'wood'); K.B(x - 0.6, z - 0.3, x + 1.6, z + 4.3, g + 2.3, g + 2.42, 'cloth'); K.D({ t: 'posts', x0: x - 0.5, z0: z - 0.2, x1: x + 1.5, z1: z + 4.2, h: 2.3, y: g }); }
  else { put(K, x, z, x + 4, z + 1, 1, 'wood'); K.B(x - 0.3, z - 0.6, x + 4.3, z + 1.6, g + 2.3, g + 2.42, 'cloth'); K.D({ t: 'posts', x0: x - 0.2, z0: z - 0.5, x1: x + 4.2, z1: z + 1.5, h: 2.3, y: g }); }
};
const cars = (K, list) => { for (const [x, z, ax] of list) { const x1 = ax ? x + 1.9 : x + 4.4, z1 = ax ? z + 4.4 : z + 1.9, g = gMid(K, x, z, x1, z1); K.B(x, z, x1, z1, g, g + 1.5, 'car'); } };
const bus = (K, x, z, ax) => { const x1 = ax ? x + 2.6 : x + 11, z1 = ax ? z + 11 : z + 2.6, g = gMid(K, x, z, x1, z1); K.B(x, z, x1, z1, g, g + 3.1, 'bus'); };
function trees(K, kind, list) { // 나무 (줄기만 부딪힘). kind: 0 침엽수, 1 활엽수, 2 야자수
  const out = [];
  list.forEach(([x, z, s = 1], i) => { const g = K.g(x, z); out.push([x, z, g, s, kind, i * 1.7]); K.B(x - 0.28, z - 0.28, x + 0.28, z + 0.28, g, g + 4, 'trunk', true); });
  K.D({ t: 'trees', list: out });
}
// 길만 파내고 나머지를 건물 덩어리로 채우는 방식 (골목 많은 맵). open = 뚫을 직사각형 [x0, z0, x1, z1] 들
function carve(hx, hz, open) {
  const W = hx * 2, H = hz * 2, g = new Uint8Array(W * H).fill(1);
  for (const [x0, z0, x1, z1] of open) for (let j = z0 + hz; j < z1 + hz; j++) for (let i = x0 + hx; i < x1 + hx; i++) g[j * W + i] = 0;
  return { g, W, H, hx, hz, solid: (x, z) => { const i = Math.floor(x + hx), j = Math.floor(z + hz); return i < 0 || j < 0 || i >= W || j >= H ? 2 : g[j * W + i]; } };
}
// 파내고 남은 자리를 건물로: 덩어리마다 높이·재질을 달리하고, 길 쪽 벽에 창문·문 장식을 붙임
function blocks(K, C, o) {
  const { g, W, H, hx, hz } = C, used = new Uint8Array(W * H), R = rng(o.seed || 1), max = o.max || 24, wins = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!g[j * W + i] || used[j * W + i]) continue;
    const lim = max - Math.floor(R() * max * 0.35);
    let w = 0; while (i + w < W && w < lim && g[j * W + i + w] && !used[j * W + i + w]) w++;
    let h = 1; rows: while (j + h < H && h < lim) { for (let k = 0; k < w; k++) if (!g[(j + h) * W + i + k] || used[(j + h) * W + i + k]) break rows; h++; }
    for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) used[(j + b) * W + i + a] = 1;
    const x0 = i - hx, z0 = j - hz, x1 = x0 + w, z1 = z0 + h, edge = x0 <= -hx || z0 <= -hz || x1 >= hx || z1 >= hz;
    let glo = 1e9, ghi = -1e9; for (let b = 0; b <= 4; b++) for (let a = 0; a <= 4; a++) { const v = K.g(x0 + (w * a) / 4, z0 + (h * b) / 4); glo = Math.min(glo, v); ghi = Math.max(ghi, v); }
    const ht = ghi + Math.round((o.h[0] + R() * (o.h[1] - o.h[0]) + (edge && o.edge ? o.edge : 0)) * 2) / 2, mat = o.mats[Math.floor(R() * o.mats.length)];
    K.B(x0, z0, x1, z1, glo - 1, ht, mat);
    if (o.cap) K.B(x0 - 0.15, z0 - 0.15, x1 + 0.15, z1 + 0.15, ht, ht + 0.3, o.cap);
    if (o.dome && w >= 8 && h >= 8 && R() < o.dome) K.D({ t: 'dome', x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: ht + (o.cap ? 0.3 : 0), r: Math.min(w, h) * 0.26 });
    // 길에 면한 벽에 창문(0 어두움, 1 불 켜짐)과 문(2) — 그 자리 땅 높이 기준
    const face = (n, at, fx, fz, ax) => {
      for (let k = 0; k < n; k++) {
        const t = at(k), px = fx(t), pz = fz(t), ox = px + (ax === 2 ? 0.5 : ax === 3 ? -0.5 : 0), oz = pz + (ax === 0 ? 0.5 : ax === 1 ? -0.5 : 0);
        if (C.solid(ox, oz)) continue;
        const gy = Math.max(K.g(ox, oz), K.g(px, pz));
        if (o.door && R() < o.door) wins.push([px, gy, pz, ax, 2]);
        for (let y = gy + (o.y0 || 2.6); y < ht - 1.4; y += o.dy || 3) if (R() < (o.fill || 0.8)) wins.push([px, y, pz, ax, R() < (o.lit || 0) ? 1 : 0]);
      }
    };
    const sp = o.sp || 4.5, nx = Math.floor((w - 2) / sp) + 1, nz = Math.floor((h - 2) / sp) + 1;
    if (w >= 4) { face(nx, (k) => x0 + (w - (nx - 1) * sp) / 2 + k * sp, (t) => t, () => z1, 0); face(nx, (k) => x0 + (w - (nx - 1) * sp) / 2 + k * sp, (t) => t, () => z0, 1); }
    if (h >= 4) { face(nz, (k) => z0 + (h - (nz - 1) * sp) / 2 + k * sp, () => x1, (t) => t, 2); face(nz, (k) => z0 + (h - (nz - 1) * sp) / 2 + k * sp, () => x0, (t) => t, 3); }
  }
  K.D({ t: 'wins', list: wins });
}

// ───────────── 1. 사막 마을 — 세 갈래 길 + 마른 수로와 돌다리, 지하 통로, 언덕 위 A ─────────────
const TOWN = arenaMap('town', '사막 마을', { hx: 78, hz: 54, wallH: 7 }, 'sandWall', 'town', (K) => {
  const { B, D, T } = K;
  // 높낮이
  T.flat(-58, -48, -49, 48, -2.6);                                                        // 마른 수로 (서쪽 길)
  T.ramp(-62, 9, -58, 18, 0, -2.6, 'x'); T.ramp(-62, -18, -58, -9, 0, -2.6, 'x');         // 진영 → 수로 비탈 두 곳
  T.ramp(-49, 34, -41, 46, -2.6, 0, 'x');                                                 // 수로 → 긴 길
  T.ramp(14, 34, 34, 46, 0, 3, 'x'); T.flat(34, 34, 36, 46, 3); T.flat(36, 22, 64, 52, 3); // 긴 길 오르막 → 언덕 위 A
  T.ramp(12, 8, 22, 24, 0, 3, 'z'); T.flat(12, 24, 22, 27, 3); T.flat(22, 21, 36, 27, 3);  // 짧은 길 오르막
  T.ramp(34, 10, 45, 20, 0, 3, 'z'); T.flat(38, 20, 45, 22, 3);                           // 동쪽 길 오르막
  T.ramp(58, 10, 64, 20, 0, 3, 'z'); T.flat(58, 20, 64, 22, 3);                           // 수비 진영 오르막
  T.ramp(-49, -44, -39, -30, -2.6, -3.4, 'x'); T.flat(-39, -44, -8, -30, -3.4); T.ramp(-8, -44, 2, -30, -3.4, 0, 'x'); // 지하 통로
  T.ramp(-26, -30, -17, -8, -3.4, 0, 'z');                                                // 중앙 길 → 지하 통로
  const C = carve(78, 54, [
    [-78, -20, -58, 20], [-58, -48, -49, 48],              // 공격 진영, 수로
    [-49, 34, 36, 46], [36, 22, 64, 52],                   // 긴 길 → A 지점
    [-49, -6, 34, 6], [12, 6, 22, 27], [22, 21, 36, 27],   // 중앙 길, 짧은 길 → A
    [-26, -30, -17, -6], [-49, -44, 2, -30],               // 지하 통로 (내리막·본통로)
    [2, -52, 32, -20], [10, -20, 18, -6], [32, -43, 34, -39], // B 지점, 중앙에서 오는 샛길, B 문
    [34, -48, 45, 20], [38, 20, 45, 22],                   // 동쪽 길
    [45, -9, 58, 9], [58, -20, 78, 20], [58, 20, 64, 22],  // 수비 진영
  ]);
  blocks(K, C, { mats: ['sand', 'sand2'], h: [4.4, 7.2], seed: 5, max: 22, cap: 'sandCap', dome: 0.3, door: 0.2, fill: 0.7 });
  // 지하 통로: 위에는 건물이 서 있음. 중앙에서 내려오는 길은 지붕만 덮음
  B(-49, -44, -8, -30, -0.45, 0, 'sand2'); B(-49, -44, -8, -30, 0, 5.2, 'sand'); B(-49.15, -44.15, -7.85, -29.85, 5.2, 5.5, 'sandCap');
  B(-26.3, -30, -16.7, -6, 3.2, 3.6, 'sand2');
  deco(K, 'lanternA', [-44, -32, -20, -12].map((x) => [x - 0.15, -1.3, -37.15, x + 0.15, -0.9, -36.85]).concat([[-21.65, 1.9, -18.15, -21.35, 2.3, -17.85]]));
  wall(K, -40, 34, -40, 46, 4.4, 'sand', [[35.5, 38.5, 2.6], [41.5, 44.5, 2.6]], 0.8);               // 긴 길 쌍문
  wall(K, 6, -6, 6, 6, 4.4, 'sand2', [[-1.5, 1.5, 2.6]], 0.8);                                       // 중앙 문
  wall(K, 10, -20, 18, -20, 4.4, 'sand2', [[12.5, 15.5, 2.5]]);                                      // B 창문 길
  wall(K, 2, -44, 2, -30, 4.4, 'sand', [[-40, -36, 2.6]], 0.8);                                      // 지하 통로 출구
  // 수로 위 돌다리 (진영 ↔ 중앙 길). 다리 밑으로는 수로를 따라 지나감
  bridge(K, -59, -3, -48, 3, 0, 'stone', { rail: 'stone', rh: 0.9, piers: [[-53.5, -2.4], [-53.5, 2.4]] });
  // 공격 진영 · 수로
  tent(K, -74, 9); tent(K, -73, -17); crates(K, [[-66, -5, 2, 2], [-67, 13, 1.6], [-56.5, 27, 2], [-52, -20, 1.6, 2]]); barrels(K, [[-65, -13], [-56, 40], [-52.5, -40]]);
  lows(K, 'stone', 1.2, [[-57, -24, -53, -23.2], [-58, 22, -54, 22.8], [-52, 10, -51.2, 14]]);
  // 긴 길
  put(K, -30, 36, -29.2, 41, 2.4, 'sand2'); crates(K, [[-12, 43, 2, 2], [-9.6, 43.6, 1.6], [8, 35, 2]]); cars(K, [[-23, 35.2]]);
  lows(K, 'stone', 1.2, [[20, 39.5, 26, 40.3], [30, 34.5, 35, 35.3]]); barrels(K, [[0, 44.4]]);
  // A 지점 (언덕 위)
  crates(K, [[45, 33, 2, 2], [47.2, 33.4, 1.6], [55, 44, 2, 2], [41, 48, 2], [59, 28, 2]]); lows(K, 'stone', 1.2, [[48, 42, 53, 42.8]]); put(K, 43, 24, 43.8, 29, 2.6, 'sand'); put(K, 56.2, 34.2, 58.8, 36.8, 1.1, 'well');
  // 중앙 길 · 짧은 길
  stall(K, -36, 3.6); crates(K, [[-20, -5.4, 2, 2], [-4, 3.6, 1.6], [20, -5.4, 2], [27, 3.2, 1.6]]); put(K, -10, -6, -9.2, -1.5, 2.4, 'sand'); lows(K, 'stone', 1.2, [[-44, -1, -43.2, 3]]);
  crates(K, [[13, 14, 2], [19.6, 24.4, 1.6, 2]]); lows(K, 'stone', 1.2, [[28, 21.6, 28.8, 24.2]]);
  // 지하 통로 안
  crates(K, [[-40, -33, 2], [-12, -43.6, 2, 2], [-24.6, -20, 1.6]]); barrels(K, [[-30, -43.4], [-19.2, -12]]);
  // B 지점
  crates(K, [[11, -34, 2, 2], [13.2, -33.6, 1.6], [22, -45, 2, 2], [8, -49, 2], [27, -27, 2]]); lows(K, 'stone', 1.2, [[19, -31, 25, -30.2]]); put(K, 6, -37, 6.8, -32, 2.6, 'sand2'); put(K, 24, -51, 29, -50, 1, 'wood');
  // 동쪽 길 · 수비 진영
  stall(K, 43.4, -30, 1); stall(K, 34.6, 2, 1); crates(K, [[36, -34, 2], [42.4, -14, 1.6, 2], [39, -46, 2, 2]]); lows(K, 'stone', 1.2, [[38, -1.5, 38.8, 1.5], [50, 4.5, 54, 5.3]]);
  crates(K, [[62, -13, 2, 2], [70, 12, 1.6]]); barrels(K, [[60, 6], [72, -15]]); tent(K, 71, -19.5);
  // 장식
  trees(K, 2, [[-70, 0, 1.05], [-64, -19, 0.95], [-46, 45, 0.9], [10, 45, 1], [38, 50, 1.1], [62, 50, 0.95], [-47, 4.6, 0.9], [30, -4.8, 0.95], [4, -50, 1], [30, -22, 0.9], [44, -46, 1], [66, -17, 1], [76, 19, 1.05], [-52, 30, 0.9]]);
  slab(K, 'tiles', 36, 22, 64, 52, 3, 0xffffff); slab(K, 'stone', 2, -52, 32, -20, 3, 0xd8cfc0); slab(K, 'tiles', -48, -6, 34, 6, 4, 0xf2e6d0);
  for (const x of [-30, -14, 2]) lanterns(K, x, 34, x, 46, 4.2, 6);
  for (const x of [-34, -18, 22]) lanterns(K, x, -6, x, 6, 4.1, 5);
  for (const z of [-34, -14, 2]) lanterns(K, 34, z, 45, z, 4.1, 5);
  D({ t: 'floorText', text: 'A', x: 50, z: 37, size: 5, color: '#8a3324' }); D({ t: 'floorText', text: 'B', x: 17, z: -38, size: 5, color: '#8a3324' });
  const sg = { bg: '#6f4a2a', border: '#e9d9b8', size: 0.62 };
  sign(K, '긴 길 → A', 3.6, 1, -39.55, 3.4, 40, -HP, sg); sign(K, '중앙 문', 2.8, 0.9, 5.55, 3.4, 3.6, -HP, sg);
  D({ t: 'sign', text: '지하 통로 → B', w: 4, h: 1, x: -49.05, y: 1.6, z: -37, ry: -HP, ...sg }); sign(K, '언덕 A', 3, 1, 36.05, 3.6, 30, HP, sg); sign(K, '시장 B', 3, 1, 31.95, 3.6, -34, -HP, sg);
}, [{ name: 'A', x: 50, z: 37, r: 4 }, { name: 'B', x: 17, z: -38, r: 4 }], [
  [[-74, -16], [-74, 16], [-53, 44], [-53, -46], [-36, 40], [-44, -37]],
  [[74, 17], [75, -12], [42, -42], [40, 4], [61, 46], [27, -48]],
], 'stone');

// ───────────── 2. 부두 야적장 — 큰 창고 홀 + 건선거(파 놓은 독)와 가로지르는 다리, 배수 터널, 철길 둑 ─────────────
const DOCK = arenaMap('dock', '부두 야적장', { hx: 80, hz: 56, wallH: 7 }, 'wall', 'dock', (K) => {
  const { B, D, T } = K;
  // 높낮이
  T.flat(6, -46, 38, -20, -4.5);                                                          // 건선거 바닥 (B 지점)
  T.ramp(-8, -37, 6, -30, 0, -4.5, 'x'); T.ramp(38, -37, 52, -30, -4.5, 0, 'x');          // 서·동 경사로
  T.flat(13, -20, 17, 2, -4.5); T.ramp(13, 2, 17, 14, -4.5, 0, 'z');                      // 배수 터널 → 창고 안으로 올라옴
  T.ramp(-80, 41, 80, 44, 0, 1.5, 'z'); T.flat(-80, 44, 80, 56, 1.5);                     // 철길 둑
  // 큰 창고 (A 지점): 문 다섯 개, 안쪽 북벽을 따라 2층 통로, 바닥에 터널 입구
  room(K, -8, 6, 36, 40, 7, 'metal', { w: [[18, 24, 4]], s: [[7, 11, 3.2], [26, 30, 3.2]], e: [[23, 27, 3.2]], n: [[12, 15.5, 2.8]], roof: 'roof', th: 0.8 });
  slab(K, 'concrete', -7.6, 14.2, 35.6, 39.6, 3, 0xb9b6ad); slab(K, 'concrete', -7.6, 6.4, 11.9, 14.2, 3, 0xb9b6ad); slab(K, 'concrete', 18.1, 6.4, 35.6, 14.2, 3, 0xb9b6ad);
  B(-7.6, 36.4, 35.6, 39.6, 3.4, 3.6, 'metalStep'); B(-6, 36.3, 35.6, 36.4, 3.6, 4.5, 'fence'); stairs(K, -7.6, 31.1, '+z', 0, 3.4, 1.5, 'metalStep');
  for (const [x0, z0] of [[-3, 10], [-3, 16], [4, 31], [21, 9.5]]) put(K, x0, z0, x0 + 4.5, z0 + 1, 3, 'shelf');
  crates(K, [[8, 21, 2, 2], [10.2, 21.4, 1.6], [19, 28, 2, 2], [21, 15, 2], [28, 31, 2, 2], [30.4, 18, 1.6], [1, 26, 2]]); put(K, 24, 21, 25.6, 23.5, 2, 'forklift'); put(K, 30, 9.5, 34, 13.5, 2.6, 'machine'); B(31, 10.5, 33, 12.5, 2.6, 3.3, 'vent');
  lows(K, 'barrier', 1.1, [[11.2, 7, 11.8, 13], [18.2, 7, 18.8, 13]]);
  deco(K, 'lamp', [[2, 10], [2, 22], [14, 20], [14, 30], [26, 16], [26, 30]].map(([x, z]) => [x - 0.9, 6.86, z - 0.15, x + 0.9, 6.98, z + 0.15]));
  // 배수 터널 뚜껑 (마당 바닥)과 안쪽 등
  { const b = B(12, -20, 18, 6, -0.45, 0, 'con'); b.deck = true; }
  deco(K, 'lamp', [-14, -6, 2].map((z) => [14.4, -0.62, z - 0.5, 15.6, -0.5, z + 0.5]));
  D({ t: 'slab', tex: 'concrete', x0: 13, z0: -20, x1: 17, z1: 14, tile: 3, color: 0x9d9a92, any: 1 }); D({ t: 'slab', tex: 'concrete', x0: 6, z0: -46, x1: 38, z1: -20, tile: 4, color: 0xa6a39a, any: 1 });
  // 건선거: 가로지르는 다리, 들어와 있는 배, 받침목
  bridge(K, 26, -47, 30, -19, 0, 'metalStep', { bot: false, piers: [[28, -40], [28, -26]], pier: 'crane' });
  B(32.5, -44, 37, -23, -4.6, 1.6, 'shipHull'); B(33.5, -40, 36, -30, 1.6, 3.6, 'whitePaint'); deco(K, 'glass', [[33.45, 2.4, -39, 36.05, 3.1, -31]]);
  lows(K, 'wood', 0.5, [[8, -44, 9, -22], [22, -44, 23, -22]]);
  crates(K, [[11, -30, 2, 2], [13.2, -29.6, 1.6], [18, -40, 2, 2], [10, -42, 2], [20, -27, 1.6], [24, -36, 2]]); lows(K, 'barrier', 1.1, [[12, -24, 18, -23.4]]); barrels(K, [[19, -44.4], [9.4, -34]]);
  // 북쪽 철길 (둑 위)
  for (const z of [45.5, 50.5]) D({ t: 'rail', z: z + 1.25, x0: -80, x1: 80, y: 1.5 });
  const flatcar = (a, z, m) => { put(K, a + 0.3, z + 0.3, a + 11.7, z + 2.2, 0.8, 'flatbed'); put(K, a, z, a + 12, z + 2.5, 2.6, m, 0.8); };
  for (const [a, m] of [[-72, 'cR'], [-52, 'cB'], [-22, 'cG'], [-2, 'cY'], [30, 'cW'], [54, 'cO']]) flatcar(a, 45.5, m);
  for (const [a, m] of [[-62, 'cO'], [-36, 'cW'], [-10, 'cR'], [16, 'cB'], [42, 'cY'], [64, 'cG']]) flatcar(a, 50.5, m);
  crates(K, [[-44, 38, 2, 2], [-16, 42, 1.6], [48, 38, 2], [20, 42.6, 1.6]]); barrels(K, [[-28, 42], [60, 39]]);
  // 정문 담 (서쪽)과 경비실
  wall(K, -56, -56, -56, 56, 3.4, 'con', [[-45, -39], [-5, 5], [41, 54]], 0.6);
  house(K, -54.5, 8, -48, 14.5, 0, 3, 'brick', { ops: [['e', 11.2, 2, 'door'], ['s', -51.2, 1.4, 'win'], ['w', 11.2, 1.4, 'win']], floor: 'floorCon', furn: false });
  lows(K, 'barrier', 1.1, [[-66, -8, -65.4, -3], [-66, 3, -65.4, 8], [-50, -4, -49.4, -1], [-50, 1, -49.4, 4]]);
  truck(K, -74, 24); truck(K, -74, 31, true); cont(K, -76, -34, 'x', ['cW', 'cB']); cont(K, -72, -46, 'x', ['cO']); crates(K, [[-62, 18, 2, 2], [-70, -18], [-60, -26, 1.6]]); barrels(K, [[-63, 38], [-58.6, -52]]);
  // 서쪽 마당 (창고 앞)
  cont(K, -44, 22, 'x', ['cG', 'cY']); cont(K, -40, 10, 'x', ['cR']); cont(K, -24, 26, 'z', ['cB']); lows(K, 'barrier', 1.1, [[-18, 14, -17.4, 19], [-30, 2, -24, 2.6]]); crates(K, [[-14, 30, 2, 2], [-46, 34, 1.6]]);
  // 야적장: 컨테이너 줄 사이 통로, 갠트리 크레인
  cont(K, -48, -12, 'x', ['cB', 'cR']); cont(K, -32, -12, 'x', ['cG']); cont(K, -48, -24, 'x', ['cY']); cont(K, -31, -24, 'x', ['cW', 'cO', 'cR']);
  cont(K, -45, -38, 'x', ['cO', 'cB']); cont(K, -27, -42, 'x', ['cG']); cont(K, -50, -51, 'x', ['cW']); cont(K, -34, -51, 'x', ['cR', 'cY']); cont(K, -12, -52, 'x', ['cB']);
  cont(K, -12, -8, 'z', ['cO', 'cW']); cont(K, -2, -18, 'x', ['cY', 'cG']); cont(K, -2, -6, 'x', ['cB']);
  for (const lx of [-22, -4]) for (const lz of [-46, -16]) B(lx - 0.6, lz - 0.6, lx + 0.6, lz + 0.6, 0, 10, 'crane');
  D({ t: 'gantry', x0: -22, x1: -4, z0: -46, z1: -16, h: 10 });
  crates(K, [[-18, -22, 2, 2], [-38, -30, 2], [-20, -48.6, 1.6], [0, -28, 1.6]]); barrels(K, [[-14, -28], [-52, -30]]); put(K, -24, -4, -22.4, -1.5, 2, 'forklift');
  for (const [x, z] of [[27, -10], [34, -10]]) { B(x - 2.6, z - 2.6, x + 2.6, z + 2.6, 0, 6, 'silo', true); D({ t: 'silo', x, z, y: 0, r: 3, h: 6, flat: true }); }
  for (let x = -76; x <= 76; x += 16) B(x - 0.25, -55.6, x + 0.25, -55.1, 0, 0.7, 'bollard');
  // 동쪽: 차고 통로와 관리동 (수비 진영)
  wall(K, 40, -56, 40, 56, 3.4, 'con', [[-50, -45], [-37, -30], [-11, -5], [22, 28], [42, 54]], 0.6);
  room(K, 44, -14, 62, -2, 4.6, 'con', { w: [[-11, -5, 3.6]], e: [[-11, -5, 3.6]], roof: 'roof', floor: ['concrete', 0x8f8d86] });
  house(K, 50, 20, 68, 36, 0, 6, 'brick', { ops: [['s', 59, 2.2, 'door', 1], ['w', 28, 2.2, 'door'], ['s', 53, 1.4, 'win', 2], ['s', 65, 1.4, 'win', 2], ['n', 56, 1.4, 'win', 2], ['n', 64, 1.4, 'win', 2], ['e', 28, 1.4, 'win', 1]], floor2: true, floor: 'floorCon', roofMat: 'roof', furn: false });
  cont(K, 54, -27, 'x', ['cG', 'cB']); cont(K, 62, -44, 'x', ['cY']); cont(K, 46, 6, 'x', ['cR']); truck(K, 64, -22, true); truck(K, 66, 10);
  lows(K, 'barrier', 1.1, [[65.4, -8, 66, -3], [65.4, 3, 66, 8], [44, 14, 50, 14.6]]); crates(K, [[70, -14, 2, 2], [44, -42, 2], [72, 38, 1.6], [58, -52, 2, 2], [44, 30, 1.6]]); barrels(K, [[52, -20], [73, 20], [47, 39]]);
  // 장식
  slab(K, 'gravel', -80, 44.2, 80, 56, 4, 0xffffff); slab(K, 'concrete', 40.3, -29.6, 80, 40.8, 5, 0xb4b1a8);
  D({ t: 'lampPosts', list: [[-66, 0], [-44, 4], [-30, -30], [-16, -54], [2, -24], [22, -14], [40.6, -42], [52, 0], [72, -34], [72, 38], [-20, 40], [24, 41], [-62, -40], [-30, 36], [4, -48], [39, -18]] });
  D({ t: 'floorText', text: 'A', x: 22, z: 24, size: 5, color: '#f0c53a' }); D({ t: 'floorText', text: 'B', x: 15, z: -34, size: 5, color: '#f0c53a' });
  const sg = { bg: '#1f4f8f', border: '#e9e9e4', size: 0.62 };
  sign(K, '창고 A', 3.4, 1.1, -8.45, 5, 21, -HP, sg); sign(K, '창고 A', 3.4, 1.1, 36.45, 4.4, 25, HP, sg);
  sign(K, '건선거 B →', 4, 1, -55.65, 2.4, -34, HP, { bg: '#8a5a12', border: '#e9e9e4', size: 0.6 }); sign(K, '차고', 2.2, 0.9, 43.65, 4, -8, -HP, { bg: '#26282b', border: '#e9e9e4', size: 0.62 });
  D({ t: 'sign', text: '배수 터널', w: 3, h: 0.9, x: 15, y: -1.2, z: -19.94, ry: Math.PI, bg: '#26282b', border: '#e5b62c', size: 0.6 });
}, [{ name: 'A', x: 22, z: 24, r: 4 }, { name: 'B', x: 15, z: -34, r: 4 }], [
  [[-77, 40], [-77, -40], [-60, 39], [-60, -48], [-46, 38], [-52, -20]],
  [[77, 40], [77, -40], [44, 46], [44, -52], [70, 14], [56, -18]],
], 'con');

// ───────────── 3. 기차역 — 승강장보다 낮은 선로, 열차 사이 건널목, 육교와 지하도 ─────────────
const STATION = arenaMap('station', '기차역', { hx: 96, hz: 44, wallH: 6 }, 'wall', 'station', (K) => {
  const { B, D, T } = K;
  // 높낮이: 선로 바닥은 승강장보다 1.1m 낮음. 건널목만 승강장 높이
  for (const z of [18, 0, -18]) T.flat(-84, z - 2, 84, z + 2, -1.1);
  const cross = (z, x0, x1) => T.flat(x0, z - 3, x1, z + 3, 0);
  for (const [x0, x1] of [[-40, -35], [-3, 2], [49, 54]]) cross(18, x0, x1);
  for (const [x0, x1] of [[-47, -42], [6, 11], [43, 48]]) cross(0, x0, x1);
  for (const [x0, x1] of [[-27, -22], [25, 30]]) cross(-18, x0, x1);
  T.flat(64, -26, 68, 26, -3.4); T.ramp(64, 26, 68, 36, -3.4, 0, 'z'); T.ramp(64, -36, 68, -26, 0, -3.4, 'z'); // 지하도 (동쪽)
  T.hill(-74, -33, 7, 2.4); T.hill(6, -36, 6, 2); T.hill(80, -36, 7, 2.6);                 // 석탄·자갈 더미
  const car = (a, z, m, len = 14) => { B(a + 0.5, z - 1.2, a + len - 0.5, z + 1.2, -1.1, -0.2, 'flatbed'); B(a, z - 1.5, a + len, z + 1.5, -0.2, 3.2, m); }; // 선로 바닥(-1.1) 기준
  const flat = (a, z, len = 14) => B(a, z - 1.4, a + len, z + 1.4, -1.1, -0.2, 'flatbed');
  for (const z of [18, 0, -18]) D({ t: 'rail', z, x0: -84, x1: 84, y: -1.1 });
  for (const z of [18, 0, -18]) for (const x of [-84.6, 84]) put(K, x, z - 1.6, x + 0.6, z + 1.6, 1.2, 'barrier');   // 차막이
  // 1번 선(북): 여객 열차 — 틈 세 곳
  for (const a of [-82, -70.5, -56, -34, -19, 3, 18, 33, 55, 69.5]) car(a, 18, a % 2 ? 'trainA' : 'trainB', a === -82 || a === -70.5 ? 11 : 14);
  // 2번 선(가운데): 틈 위치를 엇갈리게
  for (const a of [-78, -63, -40, -25, -10, 12, 27, 49, 64]) car(a, 0, a % 2 ? 'trainB' : 'trainA');
  // 3번 선(남): 화물 열차 — 빈 화차는 밟고 건널 수 있음
  for (const [a, m] of [[-80, 'cR'], [-66, 0], [-58, 'cB'], [-43, 'cG'], [-21, 0], [-6, 'cY'], [9, 'cW'], [31, 'cO'], [46, 0], [69, 'cR']]) { if (m) car(a, -18, m, a === -80 ? 13 : 14); else flat(a, -18, a === -66 ? 7 : 14); }
  // 승강장 지붕과 기둥, 매점, 긴 의자
  B(-70, 5.5, 60, 12.5, 3.8, 4.05, 'roof'); for (let x = -66; x <= 54; x += 12) B(x - 0.25, 8.75, x + 0.25, 9.25, 0, 3.8, 'crane');
  B(-37, -12.5, 44, -5.5, 3.8, 4.05, 'roof'); for (let x = -28; x <= 40; x += 12) B(x - 0.25, -9.25, x + 0.25, -8.75, 0, 3.8, 'crane');
  for (const [x, z] of [[-28, 7], [22, 7], [-8, -11]]) { B(x, z, x + 4, z + 4, 0, 2.8, 'metal'); deco(K, 'glassLit', [[x + 0.5, 1.1, z - 0.04, x + 3.5, 2.2, z + 4.04]]); }
  lows(K, 'wood', 0.5, [[-50, 8.6, -47.6, 9.4], [-14, 8.6, -11.6, 9.4], [4, 8.6, 6.4, 9.4], [40, 8.6, 42.4, 9.4], [-34, -9.4, -31.6, -8.6], [16, -9.4, 18.4, -8.6], [-64, 24, -61.6, 24.8], [74, 24, 76.4, 24.8]]);
  crates(K, [[-60, 5, 1.6], [-4, 12, 1.6, 2], [34, 5.2, 2], [58, 11, 1.6], [-44, -13, 1.6], [2, -6.6, 2, 2], [36, -13, 1.6], [-90, 12, 2, 2], [89, -13, 2, 2], [-74, -8, 1.6]]);
  for (const [x, z] of [[-18, 5], [28, 12.4], [-22, -6.6], [52, -12.6], [-52, 23]]) B(x, z, x + 1, z + 0.8, 0, 1.9, 'machine');
  // 역 건물 (A 지점: 대합실)
  room(K, -14, 30, 50, 44, 6, 'brick', { s: [[-8, -4, 3.2], [14, 22, 3.6], [40, 44, 3.2]], w: [[35, 39, 3]], e: [[35, 39, 3]], roof: 'roof', th: 0.8, floor: ['tiles', 0xd9d2c4] });
  for (const x of [2, 34]) for (const z of [34, 40]) B(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0, 6, 'con');
  B(8, 41, 28, 43.4, 0, 2.6, 'wood'); deco(K, 'glassLit', [[9, 1.1, 40.96, 27, 2.2, 41.04]]); lows(K, 'wood', 0.5, [[-8, 36, -5.6, 36.8], [40, 36, 42.4, 36.8], [22, 33, 24.4, 33.8]]); crates(K, [[-11, 41, 1.6], [45, 32, 1.6, 2]]);
  deco(K, 'lamp', [[0, 34], [18, 34], [36, 34], [9, 39], [27, 39]].map(([x, z]) => [x - 0.9, 5.86, z - 0.15, x + 0.9, 5.98, z + 0.15]));
  // 역 앞 (서쪽)과 소화물 창고 (동쪽)
  house(K, -72, 33, -62, 42, 0, 3.4, 'brick', { ops: [['s', -67, 2, 'door'], ['e', 37.5, 2, 'door'], ['n', -67, 1.4, 'win'], ['w', 37.5, 1.4, 'win']], floor: 'floorCon' });
  cars(K, [[-52, 38], [-28, 39.5], [-86, 36, 1]]); lows(K, 'barrier', 1.1, [[-34, 30, -28, 30.6], [-24, 26, -23.4, 31]]); crates(K, [[-90, 24, 2, 2], [-34, 23, 1.6]]);
  cont(K, 72, 39, 'x', ['cG', 'cY']); cont(K, 80, 31, 'x', ['cB']); crates(K, [[90, 39, 2, 2], [84, 22, 1.6], [58, 40, 2]]); barrels(K, [[53, 41], [92, 26]]);
  // 육교 (서쪽): 3번 승강장 계단 → 선로 위 → 역 앞 계단 (사람만 — 봇은 밑으로 다님)
  B(-42, -10, -39, 26, 4.35, 4.8, 'metalStep'); stairs(K, -49, -10, '+x', 0, 4.8, 3, 'metalStep'); stairs(K, -42, 33, '-z', 0, 4.8, 3, 'metalStep');
  for (const z of [-4.5, 4.5, 13, 22.5]) B(-40.9, z - 0.4, -40.1, z + 0.4, 0, 4.35, 'con');
  B(-42.1, -7, -42, 26, 4.8, 5.8, 'fence'); B(-39, -10, -38.9, 26, 4.8, 5.8, 'fence');
  // 지하도 (동쪽): 역 앞에서 선로 밑을 지나 남쪽 구내로. 위는 승강장·선로 바닥
  for (const [z0, z1, y] of [[-26, -20.5, 0], [-20.5, -15.5, -1.1], [-15.5, -2.5, 0], [-2.5, 2.5, -1.1], [2.5, 15.5, 0], [15.5, 20.5, -1.1], [20.5, 26, 0]]) { const b = B(63, z0, 69, z1, y - 0.4, y, 'con'); b.deck = true; }
  deco(K, 'lamp', [-22, -9, 9, 22].map((z) => [65.4, -0.56, z - 0.5, 66.6, -0.44, z + 0.5]));
  D({ t: 'slab', tex: 'concrete', x0: 64, z0: -36, x1: 68, z1: 36, tile: 3, color: 0xa9a59a, any: 1 });
  lows(K, 'barrier', 1.1, [[62.4, 27, 63, 36], [69, 27, 69.6, 36], [62.4, -36, 63, -27], [69, -36, 69.6, -27]]);
  // 기관차고 (B 지점)
  room(K, 16, -42, 46, -24, 6.5, 'metal', { n: [[20, 24, 3.4], [36, 40, 3.4]], w: [[-36, -31, 4.2]], e: [[-36, -31, 4.2]], roof: 'roof', th: 0.8, floor: ['concrete', 0x8f8d86] });
  B(22, -40.4, 38, -37.6, 0, 3.6, 'machine'); B(24, -40, 27, -38, 3.6, 4.4, 'vent'); crates(K, [[18, -28, 2, 2], [42, -29, 1.6], [30, -27.4, 1.6]]);
  deco(K, 'lamp', [[24, -31], [38, -31]].map(([x, z]) => [x - 0.9, 6.36, z - 0.15, x + 0.9, 6.48, z + 0.15]));
  // 남쪽 구내: 급수탑, 신호소, 자재
  B(-62.6, -27.6, -57.4, -22.4, 0, 9, 'silo', true); D({ t: 'silo', x: -60, z: -25, y: 0, r: 3, h: 9 });
  house(K, -34, -42, -24, -34, 0, 3.4, 'brick', { ops: [['n', -29, 2, 'door'], ['w', -38, 2, 'door'], ['e', -38, 1.4, 'win'], ['s', -29, 1.4, 'win']], floor: 'floorCon' });
  lows(K, 'wood', 1.2, [[-12, -40, -6, -38], [50, -40, 56, -38], [-46, -26, -42, -24.5]]);
  crates(K, [[-52, -40, 2, 2], [-16, -28, 2], [-6, -32, 1.6, 2], [52, -28, 2, 2], [86, -24, 2], [-88, -40, 1.6], [58, -24.6, 1.6]]); barrels(K, [[-4, -24.6], [48, -42.6], [-88, -24], [72, -42]]);
  truck(K, -20, -33, true);
  // 장식
  slab(K, 'concrete', -92, 20, 92, 30, 4, 0xbdb9ae); slab(K, 'concrete', -84, 2, 84, 16, 4, 0xbdb9ae); slab(K, 'concrete', -84, -16, 84, -2, 4, 0xbdb9ae); slab(K, 'asphalt', -96, 30, -14.4, 44, 4, 0xffffff);
  for (const z of [20.3, 15.7, 2.3, -2.3, -15.7]) D({ t: 'line', x0: -84, z0: z, x1: 84, z1: z, y: 0.03 });
  D({ t: 'lampPosts', list: [[-80, 26], [-54, 26], [-26, 26], [56, 26], [86, 26], [-70, -24], [-38, -24], [-8, -30], [60, -24], [88, -34], [-90, 4], [90, -5], [-58, 40], [-34, 42]] });
  D({ t: 'floorText', text: 'A', x: 18, z: 36, size: 4.5, color: '#f0c53a' }); D({ t: 'floorText', text: 'B', x: 31, z: -30, size: 4.5, color: '#f0c53a' });
  const sg = { bg: '#1b3f73', border: '#e9e9e4', size: 0.6 };
  sign(K, '대합실 A', 3.8, 1.1, 18, 4.6, 29.55, Math.PI, sg); sign(K, '기관차고 B', 4.2, 1.1, 30, 4.8, -23.55, 0, sg);
  sign(K, '지하도', 2.6, 0.9, 62.35, 2, 31, -HP, sg); sign(K, '지하도', 2.6, 0.9, 62.35, 2, -31, -HP, sg); sign(K, '육교', 2.2, 0.9, -43, 2.4, 36.2, 0, sg);
}, [{ name: 'A', x: 18, z: 36, r: 4 }, { name: 'B', x: 31, z: -30, r: 4 }], [
  [[-93, 24], [-93, -26], [-80, 40], [-84, -36], [-58, 27], [-66, -30]],
  [[93, 24], [93, -26], [74, 28], [90, -30], [54, 34], [56, -34]],
], 'con');

// ───────────── 4. 옛 성 — 해자와 돌다리 네 개, 둔덕 위 본채, 성 밖에서 마구간으로 통하는 비밀 지하 통로 ─────────────
const CASTLE = arenaMap('castle', '옛 성', { hx: 76, hz: 62, wallH: 5 }, 'stone', 'castle', (K) => {
  const { B, D, T } = K, X0 = -28, X1 = 60, Z0 = -44, Z1 = 44;
  // 높낮이: 해자(성벽 바깥을 두른 물길), 본채가 선 둔덕, 지하 통로
  T.flat(X0 - 9, Z0 - 9, X0 - 2, Z1 + 9, -2.2); T.flat(X1 + 2, Z0 - 9, X1 + 9, Z1 + 9, -2.2); T.flat(X0 - 9, Z1 + 2, X1 + 9, Z1 + 9, -2.2); T.flat(X0 - 9, Z0 - 9, X1 + 9, Z0 - 2, -2.2);
  T.ramp(X0 - 13, 28, X0 - 9, 32, 0, -2.2, 'x'); T.ramp(X0 - 13, -20, X0 - 9, -16, 0, -2.2, 'x'); T.ramp(-4, Z1 + 9, 0, Z1 + 13, -2.2, 0, 'z'); T.ramp(36, Z0 - 13, 40, Z0 - 9, 0, -2.2, 'z'); // 해자에서 올라오는 비탈
  T.flat(8, -21, 52, 21, 2.5);                                                                                         // 둔덕
  T.ramp(2, -4, 8, 4, 0, 2.5, 'x'); T.ramp(52, -4, 58, 4, 2.5, 0, 'x'); T.ramp(16, 21, 24, 27, 2.5, 0, 'z'); T.ramp(22, -27, 30, -21, 0, 2.5, 'z'); // 둔덕 오르막 넷
  T.ramp(-60, -36, -50, -33, 0, -5.4, 'x'); T.flat(-50, -36, -12, -33, -5.4); T.ramp(-12, -36, -4, -33, -5.4, 0, 'x'); // 비밀 지하 통로
  for (const [x0, z0, x1, z1] of [[X0 - 9, Z0 - 9, X0 - 2, Z1 + 9], [X1 + 2, Z0 - 9, X1 + 9, Z1 + 9], [X0 - 2, Z1 + 2, X1 + 2, Z1 + 9], [X0 - 2, Z0 - 9, X1 + 2, Z0 - 2]]) water(K, x0, z0, x1, z1, -1.2);
  // 바깥 성벽: 서문·동문(큰 문), 북문, 남쪽 샛문 — 문마다 해자를 건너는 돌다리
  wall(K, X0, Z0, X0, Z1, 7, 'stone', [[-3, 3, 3.8]], 2); wall(K, X1, Z0, X1, Z1, 7, 'stone', [[-3, 3, 3.8]], 2);
  wall(K, X0, Z1, X1, Z1, 7, 'stone', [[10, 14, 3.6]], 2); wall(K, X0, Z0, X1, Z0, 7, 'stone', [[20, 24, 3.6]], 2);
  for (const [x, z] of [[X0, Z0], [X0, Z1], [X1, Z0], [X1, Z1]]) { B(x - 3.5, z - 3.5, x + 3.5, z + 3.5, -3, 11, 'stone'); D({ t: 'spire', x, z, y: 11, r: 4.6, h: 4.5 }); }
  for (const x of [X0, X1]) for (const s of [-1, 1]) { B(x - 3, s > 0 ? 3 : -8, x + 3, s > 0 ? 8 : -3, -3, 9.5, 'stone'); D({ t: 'spire', x, z: s * 5.5, y: 9.5, r: 3.8, h: 3.6 }); }
  const br = { rail: 'stone', rh: 0.9 };
  bridge(K, X0 - 10, -2.6, X0 - 1, 2.6, 0, 'stone', { ...br, piers: [[X0 - 5.5, -2], [X0 - 5.5, 2]] }); bridge(K, X1 + 1, -2.6, X1 + 10, 2.6, 0, 'stone', { ...br, piers: [[X1 + 5.5, -2], [X1 + 5.5, 2]] });
  bridge(K, 9.4, Z1 + 1, 14.6, Z1 + 10, 0, 'stone', { ...br, piers: [[10, Z1 + 5.5], [14, Z1 + 5.5]] }); bridge(K, 19.4, Z0 - 10, 24.6, Z0 - 1, 0, 'stone', { ...br, piers: [[20, Z0 - 5.5], [24, Z0 - 5.5]] });
  // 성벽 위 길 (북벽 안쪽, 계단으로 오름)
  B(X0 + 4, Z1 - 4.2, 0, Z1 - 1, 4.8, 5.1, 'wood'); stairs(K, 7, Z1 - 4.2, '-x', 0, 4.8, 3.2, 'stone'); B(X0 + 4, Z1 - 4.3, 0, Z1 - 4.2, 5.1, 6, 'fence');
  // 본채 큰 홀 (A 지점, 둔덕 위)
  const hy = room(K, 14, -15, 46, 15, 8, 'stone', { w: [[-2, 2, 3.6]], e: [[-2, 2, 3.6]], n: [[26, 29.5, 3]], s: [[32, 35.5, 3]], roof: 'roof', th: 1.2, floor: ['tiles', 0xb8ab98] });
  for (const x of [22, 30, 38]) for (const z of [-8, 8]) B(x - 0.6, z - 0.6, x + 0.6, z + 0.6, hy, hy + 8, 'stone');
  lows(K, 'wood', 0.9, [[17, -11, 23, -9.4], [17, 9.4, 23, 11], [40, -3, 43, 3]]); crates(K, [[26, -12.4, 1.6, 2], [36, 10.6, 1.6], [42, -12, 2]]); barrels(K, [[16, 5], [43, 11]]);
  deco(K, 'rugA', [[24, hy + 0.07, -1.6, 40, hy + 0.085, 1.6]]); deco(K, 'lanternA', [22, 30, 38].flatMap((x) => [-8, 8].map((z) => [x - 0.2, hy + 4.2, z - 0.9, x + 0.2, hy + 4.7, z - 0.6])));
  crates(K, [[10, 16, 2], [48, -19, 2, 2], [9, -12, 1.6]]); lows(K, 'stone', 1.2, [[48, 8, 48.8, 14], [10, 6, 10.8, 12]]);
  // 예배당과 북쪽 안뜰 (B 지점)
  room(K, 28, 26, 48, 40, 6.5, 'stone', { w: [[31, 35, 3.2]], s: [[36, 39.5, 3]], roof: 'roof', floor: ['tiles', 0xc8bca8] }); D({ t: 'spire', x: 38, z: 33, y: 6.8, r: 4, h: 6 });
  lows(K, 'wood', 0.5, [[32, 29, 35, 29.8], [41, 29, 44, 29.8], [41, 36, 44, 36.8]]);
  put(K, 1.7, 33.7, 4.3, 36.3, 1.1, 'well'); crates(K, [[16, 35, 2, 2], [18.2, 35.4, 1.6], [4, 24, 2], [22, 30, 1.6]]); lows(K, 'stone', 1.2, [[6, 28, 10, 28.8], [-4, 26, -3.2, 31]]); lows(K, 'hay', 1.3, [[20, 38, 22, 40], [22.2, 38.4, 24.2, 40.4]]);
  // 대장간, 마구간(바닥에 지하 통로 입구), 병영
  room(K, -22, 22, -8, 34, 4, 'stone', { e: [[26, 30, 3]], s: [[-17, -13.5, 3]], roof: 'roof' }); put(K, -20.5, 30, -18, 32.5, 1.2, 'machine');
  room(K, -22, -40, -2, -28, 3.8, 'wood', { n: [[-18, -14, 3], [-10, -6, 3]], e: [[-31.5, -28.6, 3]], roof: 'roof', y: 0 }); lows(K, 'hay', 1.3, [[-21, -39.4, -19, -37.4], [-17.6, -39.4, -15.6, -37.4]]);
  room(K, 34, -40, 56, -26, 5, 'stone', { n: [[40, 43.5, 3]], w: [[-35, -31.5, 3]], roof: 'roof' }); lows(K, 'wood', 0.5, [[46, -38, 48, -34], [51, -38, 53, -34]]);
  // 안뜰 소품
  stall(K, -18, 8); stall(K, -19, -11); stall(K, 2, -20, 1);
  crates(K, [[-10, 12, 2, 2], [-7.6, 12.4, 1.6], [0, -9, 2], [-14, -22, 1.6, 2], [54, 18, 2, 2], [54, -18, 1.6], [8, -38, 2], [14, -26, 1.6]]); barrels(K, [[-20, -4], [3, 14], [56, 8], [2, -28]]);
  lows(K, 'stone', 1.2, [[-12, -3, -11.2, 3], [-4, 6, 0, 6.8], [55, -8, 55.8, -5], [55, 5, 55.8, 8]]); lows(K, 'hay', 1.3, [[-24, 14, -22, 16], [56, -22, 58, -20], [4, 18, 6, 20]]);
  lows(K, 'wood', 1.5, [[-4, 16, -1, 18], [30, -34, 33, -32]]);
  // 비밀 지하 통로: 들판의 돌 입구 → 해자 밑 → 성벽 밑 → 마구간. 위는 들판·해자 바닥·안뜰
  { const b1 = B(-50, -37, -38, -32, -0.45, 0, 'stone'); b1.deck = true; B(-38, -37, -29, -32, -2.65, -2.2, 'stone'); const b2 = B(-27, -37, -12, -32, -0.45, 0, 'stone'); b2.deck = true; }
  B(-51, -37.4, -49.6, -31.6, 0, 2.6, 'stone'); B(-61, -37.6, -49.6, -36.4, 0, 1.1, 'stone'); B(-61, -32.6, -49.6, -31.4, 0, 1.1, 'stone');
  deco(K, 'lanternA', [-46, -34, -22, -15].map((x) => [x - 0.15, -3.2, -36.15, x + 0.15, -2.8, -35.85]));
  D({ t: 'slab', tex: 'stone', x0: -60, z0: -36, x1: -4, z1: -33, tile: 3, color: 0x9a9284, any: 1 });
  // 성 밖 서쪽 들판 (공격 진영): 목책, 천막, 수레
  wall(K, -52, -28, -52, -8, 2.4, 'log', [], 0.5); wall(K, -52, 8, -52, 28, 2.4, 'log', [], 0.5); wall(K, -48, 54, -40, 54, 2.4, 'log', [], 0.5); wall(K, -48, -54, -40, -54, 2.4, 'log', [], 0.5);
  tent(K, -70, 12); tent(K, -66, -18); tent(K, -60, 32); tent(K, -66, -46); lows(K, 'wood', 1.5, [[-46, -2, -43, 0], [-46, 14, -43, 16], [-46, -22, -43, -20]]);
  lows(K, 'hay', 1.3, [[-44, -12, -42, -10], [-45, 22, -43, 24], [-58, -6, -56, -4]]); crates(K, [[-64, 4, 2, 2], [-48, 40, 2], [-56, -48, 1.6, 2], [-42, 6, 1.6]]); barrels(K, [[-56, 20], [-58, -24]]);
  lows(K, 'stone', 1.6, [[-70, 44, -66, 47], [-44, 2.6, -43, 6]]);
  // 해자 바깥 북·남 길과 동쪽 (수비 진영)
  lows(K, 'stone', 1.6, [[-12, 56, -9, 59], [26, 55, 30, 57.6], [-6, -59, -2, -56], [44, -59, 47, -56]]); crates(K, [[4, 57, 2, 2], [44, 57, 1.6], [16, -57, 2], [-20, -58, 1.6, 2], [58, 56, 2]]); lows(K, 'hay', 1.3, [[18, 55, 20, 57], [30, -57, 32, -55]]);
  tent(K, 70, 16); tent(K, 70, -24); crates(K, [[71.6, 11, 1.6], [71, -12, 2, 2]]); barrels(K, [[72, 46], [72, -47]]);
  trees(K, 1, [[-72, 30, 1.1], [-74, -28, 1], [-56, 50, 1.2], [-58, -56, 1.1], [-44, 30, 0.9], [-34, 58, 1], [-32, -59, 1.1], [-14, 60, 1], [22, 59, 1.1], [34, -60, 1], [52, 59, 1], [54, -58, 1.1], [72, 52, 1.2], [72, -54, 1], [73, 30, 1], [-66, 58, 1], [-70, -58, 1.1]]);
  trees(K, 0, [[-74, 2, 1.1], [-62, 44, 1], [-50, -16, 0.9], [-42, 46, 1], [4, 60, 0.9], [46, 60, 1], [66, 58, 1.1], [62, -60, 1], [12, -60, 1], [-24, 59, 1], [-26, -59, 1.1], [-8, 20, 0.8], [52, 30, 0.9], [8, -24, 0.8]]);
  // 장식
  slab(K, 'gravel', -76, -3, X0 - 10, 3, 4, 0xd2c6ae); slab(K, 'gravel', X1 + 10, -3, 76, 3, 4, 0xd2c6ae);
  D({ t: 'slab', tex: 'stone', x0: X0 + 1, z0: Z0 + 1, x1: 1, z1: Z1 - 1, tile: 4, color: 0xb9b1a2, y: 0.008 }); D({ t: 'slab', tex: 'stone', x0: 9, z0: -20, x1: 51, z1: 20, tile: 4, color: 0xc2b9a8, y: 2.508 });
  D({ t: 'slab', tex: 'stone', x0: 1, z0: 28, x1: X1 - 1, z1: Z1 - 1, tile: 4, color: 0xb9b1a2, y: 0.008 }); D({ t: 'slab', tex: 'stone', x0: 1, z0: Z0 + 1, x1: X1 - 1, z1: -28, tile: 4, color: 0xb9b1a2, y: 0.008 });
  deco(K, 'lanternA', [[X0 + 1.1, -4.6], [X0 + 1.1, 4.3], [X1 - 1.4, -4.6], [X1 - 1.4, 4.3], [9, 42.7], [14.7, 42.7]].map(([x, z]) => [x, 2.9, z, x + 0.3, 3.4, z + 0.3]).concat([[13.2, -3.4], [13.2, 3.1], [46.7, -3.4], [46.7, 3.1]].map(([x, z]) => [x, hy + 2.9, z, x + 0.3, hy + 3.4, z + 0.3])));
  D({ t: 'floorText', text: 'A', x: 32, z: 0, size: 4.5, color: '#e9d9b8' }); D({ t: 'floorText', text: 'B', x: 12, z: 32, size: 4.5, color: '#e9d9b8' });
  const sg = { bg: '#3a2f26', border: '#d9c9a6', size: 0.62 };
  sign(K, '서문', 2.4, 1, X0 - 1.05, 4.8, 0, -HP, sg); sign(K, '동문', 2.4, 1, X1 + 1.05, 4.8, 0, HP, sg);
  sign(K, '북문', 2.4, 1, 12, 4.6, Z1 + 1.05, 0, sg); D({ t: 'sign', text: '큰 홀 A', w: 3.2, h: 1, x: 13.35, y: hy + 4.6, z: 0, ry: -HP, ...sg }); sign(K, '예배당', 2.8, 1, 27.65, 4.4, 37, -HP, sg);
}, [{ name: 'A', x: 32, z: 0, r: 4 }, { name: 'B', x: 12, z: 32, r: 4 }], [
  [[-73, 40], [-73, -40], [-48, 58], [-48, -58], [-42, 10], [-42, -14]],
  [[73, 40], [73, -40], [50, 58], [50, -58], [72, 22], [72, -18]],
], 'stone');

// ───────────── 5. 도심 교차로 — 큰길 위를 넘는 고가도로, 지하 주차장, 공원 언덕, 공사장 터파기 (밤) ─────────────
const CITY = arenaMap('city', '도심 교차로', { hx: 80, hz: 60, wallH: 8 }, 'con', 'city', (K) => {
  const { B, D, T } = K;
  // 높낮이
  T.ramp(-4, 12, 4, 30, 5, 0, 'z'); T.ramp(-4, -30, 4, -12, 0, 5, 'z');                    // 고가도로 오르막 (가운데 세로길)
  T.flat(-27, -43, -8, -13, -3.4); T.ramp(-17, -22, -8, -18, -3.4, 0, 'x'); T.ramp(-20, -44, -14, -34, 0, -3.4, 'z'); // 지하 주차장과 진입로 둘
  T.hill(-17, 35, 8, 2.2);                                                                // 공원 언덕
  T.flat(41, -42, 54, -33, -2.6); T.ramp(35, -40, 41, -35, 0, -2.6, 'x');                 // 공사장 터파기
  const C = carve(80, 60, [
    [-80, -14, -64, 14], [64, -14, 80, 14],                              // 진영
    [-64, -7, 64, 7], [-7, -44, 7, 44],                                  // 큰길, 가운데 세로길
    [-64, -52, -56, 52], [56, -52, 64, 52], [-64, 44, 64, 52], [-64, -52, 64, -44], // 바깥 순환로
    [-34, 7, -28, 44], [-34, -44, -28, -7], [28, 7, 34, 44], [28, -44, 34, -7],     // 샛길
    [7, 12, 28, 32], [-28, -44, -7, -12],                                // 은행 앞 광장(A), 지하 주차장(B) 자리
    [-28, 26, -7, 44], [34, -44, 56, -30],                               // 공원, 공사장
    [-56, 14, -34, 20], [34, -24, 56, -18], [34, 24, 56, 29], [-56, -27, -34, -22], [7, -27, 28, -21], // 건물을 뚫고 가는 통로
  ]);
  blocks(K, C, { mats: ['brick', 'con', 'plaster', 'cityGlass'], h: [9, 17], edge: 6, seed: 11, max: 26, y0: 3.8, dy: 3.2, sp: 3.6, lit: 0.42, fill: 0.92, door: 0.12 });
  // 고가도로: 큰길 위를 넘는 다리 (사람만 — 봇은 밑으로 다님)
  bridge(K, -4, -12.4, 4, 12.4, 5, 'con', { bot: false, rail: 'barrier', rh: 0.9, piers: [[-3.4, -8], [3.4, -8], [-3.4, 8], [3.4, 8]] });
  for (const sx of [-4.2, 4]) for (let k = 0; k < 6; k++) { const h0 = (5 * k) / 6, h1 = (5 * (k + 1)) / 6; B(sx, -30 + k * 3, sx + 0.2, -27 + k * 3, h0 - 0.2, h1 + 0.9, 'barrier'); B(sx, 27 - k * 3, sx + 0.2, 30 - k * 3, h0 - 0.2, h1 + 0.9, 'barrier'); } // 오르막 난간 (계단식)
  deco(K, 'lamp', [-6, 6].map((z) => [-1, 4.42, z - 0.15, 1, 4.54, z + 0.15]));
  // 지하 주차장 (B): 위는 광장. 내려가는 길 둘 (가운데 세로길 쪽, 남쪽 순환로 쪽)
  for (const [x0, z0, x1, z1] of [[-28, -18, -7, -12], [-28, -22, -17, -18], [-28, -34, -7, -22], [-28, -44, -20, -34], [-14, -44, -7, -34]]) B(x0, z0, x1, z1, -0.45, 0, 'con');
  for (const x of [-23, -12]) for (const z of [-38, -28, -16]) B(x - 0.35, z - 0.35, x + 0.35, z + 0.35, -3.4, -0.45, 'con');
  cars(K, [[-26.4, -16], [-26.4, -32], [-12.4, -42.9], [-25, -41.6, 1]]); crates(K, [[-10.6, -30, 1.6], [-22, -36, 1.6, 2]]); lows(K, 'barrier', 1.1, [[-20, -30.6, -15, -30]]);
  deco(K, 'lamp', [[-22, -22], [-12, -26], [-17.5, -15.5], [-17.5, -31], [-23, -39], [-11, -38]].map(([x, z]) => [x - 0.8, -0.58, z - 0.12, x + 0.8, -0.47, z + 0.12]));
  for (const [x0, z0, x1, z1] of [[-17.6, -22.6, -8, -22], [-17.6, -18, -8, -17.4], [-20.6, -44, -20, -34], [-14, -44, -13.4, -34]]) B(x0, z0, x1, z1, 0, 0.9, 'barrier');                   // 진입로 난간 (광장 쪽)
  lows(K, 'stone', 0.9, [[-26, -27, -20, -25.8]]); lows(K, 'wood', 0.5, [[-24, -14.6, -21.6, -13.8], [-12, -33, -9.6, -32.2]]);
  for (const [x0, z0, x1, z1] of [[-26, -30, -22, -28.8], [-12, -27, -10.8, -23], [-24, -40, -22.8, -36]]) B(x0, z0, x1, z1, 0, 0.9, 'stone'); // 광장 화단 (주차장 지붕 위)
  // 건물을 뚫는 통로 지붕
  for (const [x0, z0, x1, z1] of [[-56, 14, -34, 20], [34, -24, 56, -18], [34, 24, 56, 29], [-56, -27, -34, -22], [7, -27, 28, -21]]) {
    B(x0, z0, x1, z1, 3.6, 4, 'con'); const cz = (z0 + z1) / 2;
    deco(K, 'lamp', [x0 + 5, (x0 + x1) / 2, x1 - 5].map((x) => [x - 0.8, 3.48, cz - 0.12, x + 0.8, 3.58, cz + 0.12]));
  }
  crates(K, [[-46, 14.2, 1.4], [44, -19.6, 1.4], [46, 27.4, 1.4], [-44, -26.8, 1.4], [16, -22.6, 1.4, 2]]);
  // 은행 앞 광장 (A): 분수, 화단, 매점
  put(K, 19.5, 24.5, 22.5, 27.5, 0.9, 'well'); lows(K, 'stone', 0.9, [[9, 27, 15, 28.2], [22, 14, 26, 15.2], [9, 13, 10.2, 18]]); put(K, 23, 19, 26, 22, 2.8, 'metal'); deco(K, 'glassLit', [[22.96, 1.1, 19.4, 26.04, 2.2, 21.6]]);
  lows(K, 'wood', 0.5, [[12, 23, 14.4, 23.8], [15, 30, 17.4, 30.8]]); crates(K, [[11, 15, 1.6]]);
  // 공원: 언덕, 나무, 긴 의자
  trees(K, 1, [[-24, 30, 1], [-17, 40, 1.1], [-11, 30.5, 0.9], [-23, 41, 0.9], [-10, 41, 1]]);
  lows(K, 'stone', 0.9, [[-27.2, 30, -26.4, 36]]); lows(K, 'wood', 0.5, [[-18.2, 34.6, -15.8, 35.4], [-22, 27, -19.6, 27.8]]);
  // 공사장: 파 놓은 터, 컨테이너 사무실, 자재
  cont(K, 42, -41.5, 'x', ['cY']); lows(K, 'stone', 1.4, [[50, -37, 53, -34]]); lows(K, 'wood', 1.2, [[35, -34, 39, -32]]); crates(K, [[45, -36, 2, 2], [36, -44, 1.6]]);
  cont(K, 42, -32.4, 'x', ['cO', 'cW']); lows(K, 'barrier', 1.1, [[34, -30.6, 40, -30]]);
  // 큰길과 세로길: 버스, 승용차, 방호벽, 정류장
  bus(K, -46, -5.6); bus(K, 24, 3);
  cars(K, [[-58, 3.6], [-22, 4.4], [-16, -6.4], [12, -6.2], [44, -6.4], [50, 4.2], [-6.9, 16, 1], [5, -24, 1], [-6.4, 36, 1], [4.6, -40, 1]]);
  lows(K, 'barrier', 1.1, [[-28, -1.5, -27.4, 1.5], [16, -1.5, 16.6, 1.5], [-66, -9, -65.4, -4], [-66, 4, -65.4, 9], [65.4, -9, 66, -4], [65.4, 4, 66, 9], [-1.5, 38, 1.5, 38.6], [-1.5, -38.6, 1.5, -38]]);
  for (const [x, z] of [[-52, 5], [40, -6.6]]) { B(x, z, x + 5, z + 1.6, 2.4, 2.55, 'metal'); B(x, z + (z > 0 ? 1.5 : 0), x + 5, z + (z > 0 ? 1.6 : 0.1), 0, 2.4, 'glassPane'); lows(K, 'wood', 0.5, [[x + 1, z + 0.4, x + 4, z + 1]]); }
  // 순환로와 샛길: 주차된 차, 쓰레기통, 자재
  cars(K, [[-63.4, 26, 1], [-58.4, -34, 1], [61.6, 34, 1], [57, -20, 1], [-48, 49.4], [-14, 44.6], [22, 49.6], [44, 45], [-46, -46.4], [14, -46.2], [-33.6, 30, 1], [32, 12, 1], [-30, -40, 1], [28.4, -14, 1]]);
  bus(K, -44, 45); bus(K, 40, -50.6);
  for (const [x, z] of [[-33.6, 10], [-29.4, 22], [28.4, 38], [32.6, 18], [-33.6, -12], [-29.4, -30], [28.4, -36], [32.6, -10], [-55, 45], [55, -45.8], [8, 45], [-9, -51], [-63.6, -10], [62.6, 40]]) put(K, x, z, x + 1, z + 1.6, 1.3, 'machine');
  crates(K, [[-32, 36, 1.6], [31, 30, 1.6, 2], [-31, -19, 1.6], [30, -26, 1.6], [-62, -48, 2, 2], [60, 48, 2], [-60, 48, 1.6], [61, -49, 1.6], [-62, 40, 2], [60, -40, 2, 2]]);
  lows(K, 'barrier', 1.1, [[-56, 38, -55.4, 43], [56, -43, 56.6, -38], [-20, 51.4, -14, 52], [20, -52, 26, -51.4]]);
  // 장식: 차선, 횡단보도, 가로등, 신호등
  for (const [x0, x1] of [[-62, -9], [9, 62]]) for (let x = x0; x < x1 - 3; x += 7) D({ t: 'line', x0: x, z0: 0, x1: x + 3.5, z1: 0, white: true });
  for (const x of [-9.5, 8.5]) for (let z = -6; z < 6; z += 1.4) D({ t: 'line', x0: x, z0: z, x1: x + 1.6, z1: z + 0.7, white: true, wide: true });
  D({ t: 'lampPosts', list: [[-56.6, 7.6], [-40, -7.6], [-20, 7.6], [20, -7.6], [40, 7.6], [56.6, -7.6], [-7.6, 40], [7.6, -40], [-44, 43.4], [-20, 52.6], [20, 43.4], [46, 52.6], [-46, -43.4], [-24, -52.6], [22, -43.4], [44, -52.6],
    [-64.6, 30], [-55.4, -30], [64.6, -30], [55.4, 30], [10, 30], [27, 13], [-72, 13], [72, -13], [-34.6, 26], [-34.6, -26], [34.6, 36], [27.4, -36], [-18, 27], [48, -31], [-8.4, -14], [-27, -44.6]] });
  deco(K, 'steel', [[-7.4, 7.2], [7.2, -7.4], [-7.4, -7.4], [7.2, 7.2]].map(([x, z]) => [x, 0, z, x + 0.16, 5.2, z + 0.16]));
  deco(K, 'lanternB', [[-7.5, 7.1], [7.1, -7.5], [-7.5, -7.5], [7.1, 7.1]].map(([x, z]) => [x, 4.5, z, x + 0.36, 4.86, z + 0.36]));
  D({ t: 'floorText', text: 'A', x: 17, z: 21, size: 4.5, color: '#f0c53a' }); D({ t: 'floorText', text: 'B', x: -17, z: -27, size: 4.5, color: '#f0c53a' });
  const sg = { bg: '#12264a', border: '#7fd0ff', color: '#bfe8ff', size: 0.62 }, pk = { bg: '#4a1238', border: '#ff7ad0', color: '#ffd0f0', size: 0.62 };
  sign(K, '은행 A', 3.4, 1.1, 17, 4.4, 31.95, Math.PI, sg);
  D({ t: 'sign', text: '지하 주차장 B', w: 4.4, h: 1, x: -7.6, y: 3.4, z: -20, ry: HP, ...sg }); D({ t: 'sign', text: '지하 주차장 B', w: 4.4, h: 1, x: -17, y: 3.4, z: -43.6, ry: Math.PI, ...sg });
  deco(K, 'steel', [[-7.7, 0, -22.45, -7.55, 3.95, -22.3], [-7.7, 0, -17.7, -7.55, 3.95, -17.55], [-19.45, 0, -43.7, -19.3, 3.95, -43.55], [-14.7, 0, -43.7, -14.55, 3.95, -43.55]]);
  sign(K, '상가', 2.4, 1, -56.05, 4.6, 17, -HP, pk); sign(K, '상가', 2.4, 1, 56.05, 4.6, -21, HP, pk);
  sign(K, '공원', 2.4, 1, -6.95, 2.2, 28, HP, { bg: '#16402a', border: '#9fe0b0', color: '#d0ffe0', size: 0.62 });
}, [{ name: 'A', x: 17, z: 21, r: 4 }, { name: 'B', x: -17, z: -27, r: 4 }], [
  [[-77, 12], [-77, -12], [-60, 46], [-60, -44.5], [-31, 12], [-31, -12]],
  [[77, 12], [77, -12], [60, 44.5], [60, -46], [31, 14], [31, -12]],
], 'con');
const ARENAS = [TOWN, DOCK, STATION, CASTLE, CITY];

// ───────────── 외딴 섬 (생존전) ─────────────
function makeIsle() {
  const K = builder(), { B, D, L } = K;
  K.furn = true; // 건물 안에 가구를 놓는다
  const HX = 400, RES = 4, N = (HX * 2) / RES + 1, R = rng(20261003), LAND = 380;
  const pads = [], veh = [];
  const raw = (x, z) => {
    const m = smooth((1 - Math.hypot(x, z) / LAND) / 0.3);
    const n = 6 * Math.sin(x * 0.012 + 1.3) * Math.cos(z * 0.01 + 0.4) + 3.5 * Math.sin(x * 0.026 + z * 0.019) + 1.6 * Math.sin(z * 0.05 - x * 0.03 + 2);
    const hill = 14 * Math.exp(-((x + 120) ** 2 + (z - 160) ** 2) / 60 ** 2) + 9 * Math.exp(-((x - 250) ** 2 + (z + 70) ** 2) / 55 ** 2) + 11 * Math.exp(-((x + 200) ** 2 + (z - 60) ** 2) / 60 ** 2) + 8 * Math.exp(-((x - 60) ** 2 + (z - 60) ** 2) / 50 ** 2);
    return -3.4 + m * (4.6 + 0.5 * (n + 11.1) + hill);
  };
  const pad = (x, z, r, h) => { const p = { x, z, r, h: h === undefined ? Math.max(1.8, Math.round(raw(x, z) * 10) / 10) : h }; pads.push(p); return p.h; };
  const height = (x, z) => {
    let h = raw(x, z);
    for (const p of pads) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 12) h += (p.h - h) * smooth(1 - (d - p.r) / 12); }
    return h;
  };
  // 평평하게 다진 자리 (건물 터)
  const yV = pad(200, 190, 36), yLt = pad(236, 222, 8, 2.6), yH = pad(20, -290, 40, 2.0), yF = pad(-230, -60, 38), yFac = pad(90, -30, 38);
  const yO = pad(-120, 160, 16), yC = pad(-30, 70, 28), yRu = pad(190, -190, 17), yT = pad(50, 150, 11);
  const yTn = pad(0, -120, 56), yB = pad(270, 20, 52), yA = pad(100, 285, 66, 3.2), yFi = pad(-280, 120, 34, 2.0), yQ = pad(-110, -230, 40, 1.4), yG = pad(-70, -30, 17), yS = pad(-20, 245, 40);
  const turbines = [[-200, 60], [-222, 24], [-178, 98]].map(([x, z]) => [x, z, pad(x, z, 7)]);
  const cabins = [[-300, -10], [-160, -120], [150, -110], [130, 90], [-60, -190], [60, 230], [300, 120], [-190, 250], [-90, -320], [200, -100], [-260, -170], [-110, 30], [300, -110], [10, 10], [140, -250], [-140, 280], [250, 100], [-40, 160], [120, 190], [-200, -240], [40, -200], [-320, 60], [180, 60], [-90, 100]].map(([x, z]) => [x, z, pad(x, z, 12)]);
  const H = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = height(-HX + i * RES, -HX + j * RES);
  const hm = { H, n: N, res: RES, hx: HX, hz: HX, sea: 0, min: -1.3 };
  const gAt = (x, z) => hmSample(hm, x, z);
  const win = (s, at, lv) => [s, at, 1.3, 'win', lv || 0], door = (s, at, w = 2, lv = 0) => [s, at, w, 'door', lv]; // lv: 1 = 2층에만 창, 2 = 1·2층 모두 (문은 1 = 위에 창)
  // 옛 좌표로 적은 구역을 새 자리로 옮기는 도구
  const shift = (dx, dz) => {
    const sh = (o) => { const r = { ...o }; for (const k of ['x', 'x0', 'x1']) if (k in r) r[k] += dx; for (const k of ['z', 'z0', 'z1']) if (k in r) r[k] += dz; if (r.ops) r.ops = r.ops.map(([s, at, w, kind, lv]) => [s, at + (s === 'n' || s === 's' ? dx : dz), w, kind, lv || 0]); if (r.list) r.list = r.list.map((q) => [q[0] + dx, q[1] + dz, ...q.slice(2)]); return r; };
    return { furn: K.furn, boxes: K.boxes, decor: K.decor, loot: K.loot, B: (x0, z0, x1, z1, y0, y1, m, nv) => K.B(x0 + dx, z0 + dz, x1 + dx, z1 + dz, y0, y1, m, nv), D: (o) => K.D(sh(o)), L: (x, y, z) => K.L(x + dx, y, z + dz) };
  };
  // 망루: 다리 4개 + 발판 + 계단
  const tower = (K2, cx, cz, y, hgt) => {
    const b = K2.B, top = y + hgt;
    for (const [dx, dz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) b(cx + dx - 0.15, cz + dz - 0.15, cx + dx + 0.15, cz + dz + 0.15, y, top, 'plankDark');
    b(cx - 2.2, cz - 2.2, cx + 2.2, cz + 2.2, top - 0.2, top, 'wood');
    stairs(K2, cx - 2.2 + Math.ceil(hgt / 0.4) * 0.58, cz - 3.4, '-x', y, top, 1.2, 'wood'); // 남쪽 바깥에서 서쪽으로 올라가 발판에 닿음
    for (const [x0, z0, x1, z1] of [[cx - 2.2, cz + 2.05, cx + 2.2, cz + 2.2], [cx + 2.05, cz - 2.2, cx + 2.2, cz + 2.2], [cx - 2.2, cz - 2.2, cx - 2.05, cz + 2.2]]) b(x0, z0, x1, z1, top, top + 1, 'fence');
    K2.D({ t: 'tentTop', x: cx, z: cz, y: top + 2.4, r: 3.4, h: 1.2 });
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) b(cx + dx - 0.08, cz + dz - 0.08, cx + dx + 0.08, cz + dz + 0.08, top, top + 2.4, 'plankDark');
    K2.L(cx, top, cz);
  };
  const cotAt = (K2, cx, cz, y, i, o = {}) => { // 작은 집 (문 방향은 번호로)
    const s = o.side || ['s', 'e', 'n', 'w'][i % 4], horiz = s === 'n' || s === 's', w = o.w || 4.5, d = o.d || 3.5;
    const o2 = horiz ? 'e' : 'n', a2 = o2 === 'e' ? cz : cx;
    return house(K2, cx - w, cz - d, cx + w, cz + d, y, 3, o.wall || (i % 2 ? 'plank' : 'plaster'), { ops: [door(s, horiz ? cx : cz), win(o2, a2), win(o2 === 'e' ? 'w' : 's', a2)], gable: 1.4, gcol: i % 3 ? 'roofSlate' : 'roofTile', loot: 2, roofMat: 'plankDark' });
  };

  { // (옛 좌표로 적고 새 자리로 옮겨 놓음)
    const K2 = shift(108, 102), { B, D, L } = K2;
    // ── 등대 마을 ──
    const cot = (x0, z0, x1, z1, ops, wall, gcol) => house(K2, x0, z0, x1, z1, yV, 3, wall, { ops, gable: 1.5, gcol, loot: 2, roofMat: 'plankDark' });
    cot(74, 96, 83, 104, [door('s', 78.5), win('e', 100), win('n', 78.5), win('w', 100)], 'plaster', 'roofTile');
    cot(88, 99, 97, 107, [door('s', 92.5), win('e', 103), win('w', 103)], 'plank', 'roofSlate');
    cot(102, 92, 111, 100, [door('w', 96), win('s', 106.5), win('n', 106.5), win('e', 96)], 'plaster', 'roofSlate');
    cot(74, 76, 83, 85, [door('n', 78.5), door('e', 80.5), win('s', 78.5), win('w', 80.5)], 'plank', 'roofTile');
    cot(104, 76, 112, 84, [door('w', 80), win('s', 108), win('n', 108)], 'plaster', 'roofTile');
    { // 마을 회관 (옥상에 올라갈 수 있음)
      const top = house(K2, 88, 72, 99, 82, yV, 3.4, 'brick', { ops: [door('n', 93.5, 2.2), door('w', 77), win('s', 91), win('s', 96), win('e', 77)], loot: 4, roofMat: 'roof' });
      stairs(K2, 99.25, 72.5, '+z', yV, top, 1.3, 'stone');
      B(87.75, 71.75, 99.25, 71.95, top, top + 0.9, 'brick'); B(87.75, 82.05, 99.25, 82.25, top, top + 0.9, 'brick'); B(87.75, 71.95, 87.95, 82.05, top, top + 0.9, 'brick');
      L(93, top, 77);
    }
    B(91.6, 89.6, 94.4, 92.4, yV, yV + 1.1, 'well'); D({ t: 'wellRoof', x: 93, z: 91, y: yV });
    B(86, 93, 87.5, 94.5, yV, yV + 1.2, 'crate'); B(99, 87, 101, 89, yV, yV + 1.2, 'crate'); B(84.2, 88, 85, 88.8, yV, yV + 1.1, 'barrel');
    for (const [a, b, z] of [[72, 80, 108], [84, 100, 110.5], [104, 114, 104]]) B(a, z, b, z + 0.15, yV, yV + 1.1, 'fence');
    L(93, yV, 95); L(100, yV, 86); L(80, yV, 91);
    // 등대
    B(125.6, 117.6, 130.4, 122.4, yLt - 1.5, yLt + 24, 'white', true); D({ t: 'lighthouse', x: 128, z: 120, y: yLt, h: 24 });
    L(124, yLt, 118); L(127, yLt, 115.5);
  }
  veh.push([196, 160, 0.4], [226, 200, 2]);
  { // (옛 좌표로 적고 새 자리로 옮겨 놓음)
    const K2 = shift(12, -164), { B, D, L } = K2;
    // ── 항구 ──
    house(K2, -16, -134, 6, -119, yH, 5, 'metal', { ops: [door('e', -126.5, 3), door('w', -126.5, 3), door('n', -5, 2), win('s', -10), win('s', 0), win('n', -12)], loot: 6, floor: 'floorCon', roofMat: 'roof' });
    B(-13, -132, -11, -130, yH, yH + 1.2, 'crate'); B(-13, -132, -11, -130, yH + 1.2, yH + 2.4, 'crate'); B(-11, -131.6, -9.6, -130.2, yH, yH + 1.2, 'crate');
    B(-2, -123, 3.5, -122, yH, yH + 3, 'shelf'); B(-8, -127.5, -6, -125.5, yH, yH + 1.4, 'crate');
    for (const [x, z, m, two] of [[12, -120, 'cB', 'cR'], [12, -115.5, 'cG', 0], [20, -138, 'cO', 'cW'], [-30, -116, 'cY', 0], [-34, -140, 'cR', 'cB'], [28, -126, 'cW', 0]]) {
      B(x, z, x + 12, z + 2.5, yH, yH + 2.6, m); if (two) B(x + 2, z, x + 8, z + 2.5, yH + 2.6, yH + 5.2, two);
    }
    house(K2, 16, -152, 25, -144, yH, 3.2, 'con', { ops: [door('n', 20.5), door('w', -148), win('e', -148), win('s', 20.5)], loot: 2, floor: 'floorCon', roofMat: 'roof' });
    B(-24, -128, -21.8, -125.6, yH, yH + 2.5, 'truckCab'); B(-21.6, -128.2, -15.5, -125.4, yH + 0.8, yH + 3.4, 'truckBox');
    B(4, -197, 10, -158, yH - 0.45, yH, 'wood'); D({ t: 'pier', x0: 4, x1: 10, z0: -197, z1: -158, y: yH }); // 부잔교
    B(6, -196, 8, -194.5, yH, yH + 1.2, 'crate'); L(7, yH, -192); L(7, yH, -176);
    for (const lx of [-8, 2]) for (const lz of [-156, -146]) B(lx - 0.6, lz - 0.6, lx + 0.6, lz + 0.6, yH, yH + 9, 'crane');
    D({ t: 'gantry', x0: -8, x1: 2, z0: -156, z1: -146, h: 9, y: yH });
    B(30, -150, 31.6, -147.5, yH, yH + 2, 'forklift'); B(-6.4, -112, -5.6, -111.2, yH, yH + 1.1, 'barrel'); B(-5.5, -111.6, -4.7, -110.8, yH, yH + 1.1, 'barrel');
    for (const x of [-20, -8, 16, 28]) B(x - 0.25, -158.4, x + 0.25, -157.9, yH, yH + 0.7, 'bollard');
    L(18, yH, -116.5); L(26, yH, -134); L(-26, yH, -120); L(-3, yH, -151); L(34, yH, -122);
  }
  veh.push([44, -268, 1.2], [-12, -258, 0]);
  { // (옛 좌표로 적고 새 자리로 옮겨 놓음)
    const K2 = shift(-126, -32), { B, D, L } = K2;
    // ── 농장 ──
    house(K2, -122, -42, -106, -28, yF, 5, 'barnRed', { ops: [door('e', -35, 3), door('w', -35, 3), win('n', -114), win('s', -114)], gable: 2.6, gcol: 'roofSlate', loot: 4, roofMat: 'plankDark' });
    for (const [x, z] of [[-118, -41.3], [-116.5, -41.3], [-115, -41.3], [-112.5, -30.2]]) B(x, z, x + 1.4, z + 1.4, yF, yF + 1.3, 'hay');
    B(-117.2, -41.3, -115.8, -39.9, yF + 1.3, yF + 2.6, 'hay');
    cot2(K2, -98, -22, -88, -13, yF, [door('s', -93), win('e', -17.5), win('w', -17.5), win('n', -93)], 'plank', 'roofTile');
    B(-103.5, -48.5, -98.5, -43.5, yF, yF + 10, 'silo', true); D({ t: 'silo', x: -101, z: -46, y: yF, r: 2.5, h: 10 });
    for (const [x0, z0, x1, z1] of [[-124, -12, -106, -11.85], [-124, 2, -100, 2.15], [-124, -11.85, -123.85, 2], [-100, -8, -99.85, 2.15]]) B(x0, z0, x1, z1, yF, yF + 1.1, 'fence');
    for (const [x, z] of [[-116, -6], [-110, -2], [-104, -7], [-90, -34], [-86, -30]]) B(x, z, x + 1.4, z + 1.4, yF, yF + 1.3, 'hay');
    B(-84.9, -48.9, -83.1, -47.1, yF, yF + 9, 'stone', true); D({ t: 'windmill', x: -84, z: -48, y: yF, h: 9 });
    B(-96, -40, -93.8, -37.6, yF, yF + 2.5, 'truckCab'); B(-93.6, -40.2, -87.5, -37.4, yF + 0.8, yF + 3.4, 'truckBox');
    L(-112, yF, -4); L(-102, yF, -36); L(-92, yF, -26); L(-82, yF, -44);
  }
  veh.push([-196, -52, 1.6]);
  { // (옛 좌표로 적고 새 자리로 옮겨 놓음)
    const K2 = shift(42, -18), { B, D, L } = K2;
    // ── 폐공장 ──
    {
      const top = house(K2, 30, -27, 60, -7, yFac, 6, 'brick', { ops: [door('w', -17, 3), door('e', -17, 3), door('s', 44, 2), door('n', 38, 2), door('n', 52, 2), win('s', 34), win('s', 54), win('n', 45), win('w', -11), win('e', -11)], loot: 6, floor: 'floorCon', roofMat: 'roof' });
      B(41.35, -27, 41.65, -15, yFac, yFac + 6, 'brick'); // 안쪽 칸막이
      B(32, -25, 36, -24, yFac, yFac + 3, 'shelf'); B(48, -12, 54, -10, yFac, yFac + 2.2, 'machine'); B(50, -24, 53, -21, yFac, yFac + 2.6, 'machine');
      B(38, -13, 40, -11, yFac, yFac + 1.2, 'crate'); B(38, -13, 40, -11, yFac + 1.2, yFac + 2.4, 'crate'); B(40, -12.6, 41.4, -11.2, yFac, yFac + 1.2, 'crate');
      B(33, -17, 34.5, -15.5, yFac, yFac + 1.5, 'crate'); B(56, -18, 58, -16, yFac, yFac + 1.2, 'crate');
      stairs(K2, 60.25, -26.5, '+z', yFac, top, 1.4, 'metalStep'); // 옥상 계단
      B(29.75, -27.25, 60.25, -27.05, top, top + 0.9, 'brick'); B(29.75, -6.95, 60.25, -6.75, top, top + 0.9, 'brick'); B(29.75, -27.05, 29.95, -6.95, top, top + 0.9, 'brick');
      B(40, -20, 43, -17, top, top + 1.2, 'vent'); L(50, top, -14); L(36, top, -22);
    }
    B(63, -4, 65.4, -1.6, yFac, yFac + 17, 'brick'); D({ t: 'chimneyTop', x: 64.2, z: -2.8, y: yFac + 17 });
    for (const [x, z] of [[66, -24], [66, -17]]) { B(x, z, x + 5, z + 5, yFac, yFac + 5, 'silo', true); D({ t: 'silo', x: x + 2.5, z: z + 2.5, y: yFac, r: 2.5, h: 5, flat: true }); }
    B(24, 0, 36, 2.5, yFac, yFac + 2.6, 'cB'); B(40, 6, 52, 8.5, yFac, yFac + 2.6, 'cR'); B(42, 6, 48, 8.5, yFac + 2.6, yFac + 5.2, 'cY');
    B(20, -22, 22, -20, yFac, yFac + 1.2, 'crate'); B(56, 0, 58, 2, yFac, yFac + 1.2, 'crate'); B(26.4, -30.4, 27.2, -29.6, yFac, yFac + 1.1, 'barrel');
    B(68, -8, 68.6, -2, yFac, yFac + 1.1, 'barrier'); B(22, -34, 28, -33.4, yFac, yFac + 1.1, 'barrier');
    L(30, yFac, 4); L(46, yFac, 4); L(64, yFac, -10); L(24, yFac, -28);
  }
  veh.push([112, 6, 2.2], [66, -62, 0.5]);
  { // (옛 좌표로 적고 새 자리로 옮겨 놓음)
    const K2 = shift(-65, 85), { B, D, L } = K2;
    // ── 언덕 관측소 ──
    {
      const top = house(K2, -61, 70, -50, 80, yO, 3.5, 'con', { ops: [door('s', -55.5), door('e', 75), win('n', -55.5), win('w', 75)], loot: 4, floor: 'floorCon', roofMat: 'roof' });
      stairs(K2, -62.55, 70.5, '+z', yO, top, 1.3, 'metalStep');
      D({ t: 'dome', x: -57.5, z: 76.5, y: top, r: 2.6, col: 'white' }); D({ t: 'antenna', x: -52.5, z: 72, y: top, h: 9 }); L(-53, top, 78);
    }
  }

  { // (옛 좌표로 적고 새 자리로 옮겨 놓음)
    const K2 = shift(-18, 34), { B, D, L } = K2;
    // ── 캠프장 ──
    for (const [x, z] of [[-24, 28], [-18, 44], [-2, 26], [2, 40]]) { B(x, z, x + 3.6, z + 3.6, yC, yC + 2, 'tentCloth'); D({ t: 'tentTop', x: x + 1.8, z: z + 1.8, y: yC + 2, r: 2.9, h: 1.3 }); L(x + 1.8, yC, z - 1.2); }
    D({ t: 'campfire', x: -11, z: 35, y: yC });
    for (const [x0, z0, x1, z1] of [[-14, 31, -8, 31.6], [-14, 38.4, -8, 39], [-15.6, 33, -15, 37]]) B(x0, z0, x1, z1, yC, yC + 0.5, 'log');
    cot2(K2, -12, 46, -3, 54, yC, [door('s', -7.5), win('e', 50), win('w', 50)], 'plank', 'roofSlate');
    B(-30, 38, -28.5, 39.5, yC, yC + 1.5, 'crate'); L(-11, yC, 33);
  }
  veh.push([-52, 84, 1]);
  { // (옛 좌표로 적고 새 자리로 옮겨 놓음)
    const K2 = shift(28, 78), { B, D, L } = K2;
    // ── 송신탑 ──
    for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) B(22 + dx - 0.2, 72 + dz - 0.2, 22 + dx + 0.2, 72 + dz + 0.2, yT, yT + 6, 'crane');
    D({ t: 'radioTower', x: 22, z: 72, y: yT, h: 30 });
    house(K2, 26, 74, 31, 79, yT, 2.8, 'con', { ops: [door('w', 76.5), win('s', 28.5)], loot: 2, floor: 'floorCon', roofMat: 'roof' });
  }

  { // (옛 좌표로 적고 새 자리로 옮겨 놓음)
    const K2 = shift(108, -108), { B, D, L } = K2;
    // ── 옛 성터 ──
    for (const [x0, z0, x1, z1, h] of [[72, -92, 80, -91.2, 3], [84, -92, 92, -91.2, 2], [72, -91.2, 72.8, -82, 2.4], [72, -78, 72.8, -72, 3.2], [72.8, -72.8, 82, -72, 1.6], [86, -72.8, 92, -72, 3], [91.2, -91.2, 92, -84, 3.4], [91.2, -80, 92, -72.8, 1.2]]) B(x0, z0, x1, z1, yRu, yRu + h, 'stone');
    for (const [x, z, h] of [[78, -86, 4], [86, -86, 2.2], [78, -78, 3], [86, -78, 4.4]]) B(x - 0.5, z - 0.5, x + 0.5, z + 0.5, yRu, yRu + h, 'stone');
    B(81, -83, 83, -81, yRu, yRu + 0.5, 'stone'); L(82, yRu + 0.5, -82); L(75, yRu, -88); L(89, yRu, -75);
  }
  veh.push([170, -172, 0.8]);
  // ── 읍내 ──
  {
    const K2 = shift(0, -120), b = K2.B, y = yTn;
    [-39.5, -25.5, -11.5].forEach((x, i) => cotAt(K2, x, 10, y, i, { side: 's' }));
    [12.5, 26.5, 40.5].forEach((x, i) => cotAt(K2, x, 10, y, i + 1, { side: 's' }));
    [-39.5, -25.5].forEach((x, i) => cotAt(K2, x, -10, y, i, { side: 'n' }));
    cotAt(K2, 32.5, -10, y, 2, { side: 'n' });
    [-33.5, -1.5, 34.5].forEach((x, i) => cotAt(K2, x, 24, y, i + 2, { side: 's' }));
    [-35.5, 30.5].forEach((x, i) => cotAt(K2, x, -26, y, i + 1, { side: 'n' }));
    { // 상점 (옥상에 올라갈 수 있음)
      const top = house(K2, 8, -16, 22, -6, y, 3.4, 'brick', { ops: [door('n', 15, 2.4), door('w', -11), win('n', 10.5), win('n', 19.5), win('s', 15), win('e', -11)], loot: 4, floor: 'floorTile', roofMat: 'roof', furn: false });
      stairs(K2, 22.25, -15.5, '+z', y, top, 1.3, 'stone');
      b(7.75, -16.25, 22.25, -16.05, top, top + 0.9, 'brick'); b(7.75, -5.95, 22.25, -5.75, top, top + 0.9, 'brick'); b(7.75, -16.05, 7.95, -5.95, top, top + 0.9, 'brick');
      b(10, -14.6, 14, -13.8, y, y + 1.1, 'shelfLow'); b(16, -9.6, 20, -8.8, y, y + 1.1, 'shelfLow'); K2.L(15, top, -11);
    }
    // 여관 (2층)
    house(K2, -17, -19, -5, -6, y, 6, 'plaster', { ops: [door('n', -11, 2.2, 1), door('e', -14), win('n', -15, 2), win('n', -7, 1), win('s', -11, 2), win('e', -9, 1), win('w', -9, 2)], floor2: true, loot: 2, gable: 1.8, gcol: 'roofTile', roofMat: 'plankDark' });
    b(-0.8, -0.8, 0.8, 0.8, y, y + 2.6, 'stone'); K2.D({ t: 'dome', x: 0, z: 0, y: y + 2.6, r: 0.8 });
    for (const x of [-22, 4, 24]) { b(x, 3.4, x + 4, 4.4, y, y + 1, 'wood'); b(x - 0.3, 2.8, x + 4.3, 5, y + 2.3, y + 2.42, 'cloth'); K2.D({ t: 'posts', x0: x - 0.2, z0: 2.9, x1: x + 4.2, z1: 4.9, h: 2.3, y }); }
    b(-46, -1, -44, 1, y, y + 1.2, 'crate'); b(45, 2, 47, 4, y, y + 1.2, 'crate'); b(45, 2, 47, 4, y + 1.2, y + 2.4, 'crate'); b(-4.4, 17, -3.6, 17.8, y, y + 1.1, 'barrel'); b(20.4, -22, 21.2, -21.2, y, y + 1.1, 'barrel');
    b(-12, -1.6, -9, -1.1, y, y + 0.5, 'log'); b(9, 1.1, 12, 1.6, y, y + 0.5, 'log');
    b(-3.2, -30, -0.8, -25.4, y, y + 1.5, 'wreck', true); K2.D({ t: 'wreck', x: -2, z: -27.7, y, yaw: 0 });
    for (const [x0, z0, x1, z1] of [[-48, 31, -20, 31.15], [-14, 31, 20, 31.15], [-48, -33, -20, -32.85], [10, -33, 44, -32.85]]) b(x0, z0, x1, z1, y, y + 1.1, 'fence');
    K2.L(-6, y, 2); K2.L(18, y, 0); K2.L(-30, y, 0); K2.L(40, y, -22); K2.L(-20, y, 22); K2.L(2, y, -28);
    K2.D({ t: 'lamps', list: [[-34, 2.6], [-12, -2.6], [12, 2.6], [34, -2.6], [2.6, 18], [-2.6, -20]].map(([x, z]) => [x, z, y]) });
  }
  veh.push([-6, -152, 0], [52, -124, 1.6]);
  // ── 군사 기지 ──
  {
    const K2 = shift(270, 20), b = K2.B, y = yB;
    for (const [x0, z0, x1, z1] of [[-40, 34, 40, 34.4], [-40, -34.4, -4, -34], [4, -34.4, 40, -34], [39.6, -34, 40, 34], [-40, -34, -39.6, -4], [-40, 4, -39.6, 34]]) b(x0, z0, x1, z1, y - 0.5, y + 2.6, 'con');
    [[-34, 14, -14, 22, -24], [-9, 14, 11, 22, 1], [16, 14, 36, 22, 26]].forEach(([x0, z0, x1, z1, dx]) => house(K2, x0, z0, x1, z1, y, 3.1, 'con', { ops: [door('s', dx, 2.2), win('s', dx - 6), win('s', dx + 6), win('n', dx - 5), win('n', dx + 5), door(x0 < 0 ? 'e' : 'w', 18)], loot: 4, floor: 'floorCon', roofMat: 'roof' }));
    house(K2, 16, -26, 30, -12, y, 6, 'con', { ops: [door('n', 23, 2.2, 1), door('e', -19), win('n', 19, 2), win('n', 27, 2), win('s', 20, 2), win('s', 26, 2), win('w', -16, 1)], floor2: true, loot: 4, floor: 'floorCon', roofMat: 'roof' });
    tower(K2, -34, 28, y, 5); tower(K2, 34, -22, y, 5);
    b(-30, -8, -18, -5.5, y, y + 2.6, 'cG'); b(-30, -24, -18, -21.5, y, y + 2.6, 'cG'); b(-28, -24, -22, -21.5, y + 2.6, y + 5.2, 'cW');
    b(-9, -30, -8.4, -26, y, y + 1.1, 'barrier'); b(8.4, -30, 9, -26, y, y + 1.1, 'barrier'); b(-36, -9, -32, -8.4, y, y + 1.1, 'barrier'); b(-36, 8.4, -32, 9, y, y + 1.1, 'barrier');
    b(-4, 2, -1.8, 4.4, y, y + 2.5, 'truckCab'); b(-1.6, 1.8, 4.5, 4.6, y + 0.8, y + 3.4, 'truckBox');
    b(2, -10, 4, -8, y, y + 1.2, 'crate'); b(2, -10, 4, -8, y + 1.2, y + 2.4, 'crate'); b(4, -9.4, 5.4, -8, y, y + 1.2, 'crate'); b(-12, 6, -10.5, 7.5, y, y + 1.5, 'crate');
    for (const [x, z] of [[33, 2], [33, 8]]) { b(x - 2.5, z - 2.5, x + 2.5, z + 2.5, y, y + 5, 'silo', true); K2.D({ t: 'silo', x, z, y, r: 2.5, h: 5, flat: true }); }
    K2.D({ t: 'helipad', x: -14, z: -14, r: 7 }); K2.D({ t: 'antenna', x: 36, z: 30, y, h: 16 });
    K2.L(-14, y, -14); K2.L(-24, y, -14); K2.L(0, y, -20); K2.L(8, y, 6); K2.L(-30, y, 2); K2.L(30, y, -4);
    K2.D({ t: 'lamps', list: [[-6, -31], [6, -31], [-37, -6], [-37, 6], [0, 11]].map(([x, z]) => [x, z, y]) });
  }
  veh.push([222, 14, -1.57], [274, -22, 0]);
  // ── 비행장 ──
  {
    const K2 = shift(100, 285), b = K2.B, y = yA;
    K2.D({ t: 'runway', x0: -60, x1: 60, z0: -9, z1: 5 });
    for (const x0 of [-52, -26]) house(K2, x0, 14, x0 + 20, 30, y, 6, 'metal', { ops: [door('s', x0 + 10, 9), win('n', x0 + 5), win('n', x0 + 15), win(x0 < -40 ? 'w' : 'e', 22)], loot: 4, floor: 'floorCon', roofMat: 'roof', furn: false });
    b(-48, 25, -46, 27, y, y + 1.2, 'crate'); b(-48, 25, -46, 27, y + 1.2, y + 2.4, 'crate'); b(-12, 26, -9, 28.6, y, y + 2.2, 'machine'); b(-21, 16, -19.5, 17.5, y, y + 1.5, 'crate');
    const top = house(K2, 6, 14, 14, 22, y, 6, 'con', { ops: [door('s', 10, 2, 1), win('e', 18, 2), win('w', 19.5, 1), win('n', 10, 2)], floor2: true, loot: 2, floor: 'floorCon', roofMat: 'roof' });
    K2.D({ t: 'antenna', x: 10, z: 18, y: top, h: 7 });
    b(22, 15.6, 36, 18.4, y + 0.7, y + 2.9, 'plane', true); b(27, 10.5, 30.2, 23.5, y + 1.4, y + 1.9, 'plane', true); K2.D({ t: 'plane', x: 29, z: 17, y });
    for (const [x, z] of [[44, 24], [51, 24]]) { b(x - 2.5, z - 2.5, x + 2.5, z + 2.5, y, y + 5, 'silo', true); K2.D({ t: 'silo', x, z, y, r: 2.5, h: 5, flat: true }); }
    b(-58, 9, -52, 9.6, y, y + 1.1, 'barrier'); b(40, 9, 46, 9.6, y, y + 1.1, 'barrier'); b(18, 26, 20, 28, y, y + 1.2, 'crate');
    b(0, -22, 12, -19.5, y, y + 2.6, 'cB'); b(-30, -22, -18, -19.5, y, y + 2.6, 'cO');
    K2.L(-40, y, 8); K2.L(-14, y, 8); K2.L(30, y, 8); K2.L(48, y, 14); K2.L(-56, y, -2); K2.L(56, y, -2); K2.L(6, y, -17);
    K2.D({ t: 'lamps', list: [[-56, 11], [-2, 11], [40, 11]].map(([x, z]) => [x, z, y]) });
  }
  veh.push([70, 262, 1.57], [142, 300, 0]);
  // ── 어촌 ──
  {
    const K2 = shift(-280, 120), b = K2.B, y = yFi;
    [[-2, 18, 's'], [14, 6, 'w'], [12, -14, 'w'], [-4, -22, 'n'], [-18, 2, 'e']].forEach(([x, z, sd], i) => cotAt(K2, x, z, y, i, { side: sd, wall: i % 2 ? 'plank' : 'plaster' }));
    b(-82, -1.5, -30, 1.5, y - 0.45, y, 'wood'); K2.D({ t: 'pier', x0: -82, x1: -30, z0: -1.5, z1: 1.5, y, alongX: true });
    b(-80, -1, -78.6, 0.4, y, y + 1.2, 'crate'); K2.L(-76, y, 0); K2.L(-56, y, 0);
    for (const [x, z, yaw] of [[-28, 10, 0.4], [-27, -11, -0.3], [-31, 20, 1.2]]) { b(x - 1.6, z - 0.8, x + 1.6, z + 0.8, y, y + 0.6, 'boat', true); K2.D({ t: 'boat', x, z, y, yaw }); }
    for (const [x0, z0, x1, z1] of [[-12, -8, -4, -7.85], [-12, 8, -6, 8.15], [2, -4, 2.15, 4]]) b(x0, z0, x1, z1, y, y + 1.4, 'fence');
    b(-1.6, -1.6, -0.2, -0.2, y, y + 1.1, 'crate'); b(0.4, -1.2, 1.2, -0.4, y, y + 1.1, 'barrel'); b(1.3, -0.8, 2.1, 0, y, y + 1.1, 'barrel');
    K2.L(-8, y, 0); K2.L(4, y, -6); K2.L(-24, y, -2);
  }
  veh.push([-256, 136, 0]);
  // ── 채석장 (움푹 팬 곳) ──
  {
    const K2 = shift(-110, -230), b = K2.B, y = yQ;
    house(K2, -10, 12, -1, 19, y, 3, 'plank', { ops: [door('s', -5.5), win('e', 15.5), win('w', 15.5)], loot: 2, roofMat: 'roof' });
    b(8, -8, 14, -2, y, y + 4, 'machine'); b(14, -5.6, 28, -4.4, y, y + 1.8, 'machine'); b(28, -7, 31, -3, y, y + 2.6, 'machine');
    b(-26, -6, -14, -3.5, y, y + 2.6, 'cY'); b(-24, 4, -12, 6.5, y, y + 2.6, 'cO');
    b(0, -22, 2.2, -19.6, y, y + 2.5, 'truckCab'); b(2.4, -22.2, 8.5, -19.4, y + 0.8, y + 3.4, 'truckBox');
    b(-4, -4, -2, -2, y, y + 1.2, 'crate'); b(18, 8, 20, 10, y, y + 1.2, 'crate'); b(18, 8, 20, 10, y + 1.2, y + 2.4, 'crate'); b(-18, -18, -17.2, -17.2, y, y + 1.1, 'barrel');
    K2.D({ t: 'pile', list: [[14, 16, 2.4], [22, -16, 2.8], [-22, 18, 2.2], [-30, -18, 2.6], [30, 10, 2]].map(([x, z, s]) => { b(x - s * 0.8, z - s * 0.8, x + s * 0.8, z + s * 0.8, y, y + s * 1.05, 'rock', true); return [x, z, y, s, x * 0.37]; }) });
    K2.L(4, y, 4); K2.L(-8, y, -12); K2.L(20, y, 0); K2.L(-20, y, 12); K2.L(10, y, -14);
  }
  veh.push([-88, -202, 2.6]);
  // ── 주유소 ──
  {
    const K2 = shift(-70, -30), b = K2.B, y = yG;
    for (const [x, z] of [[-4.5, -3], [4.5, -3], [-4.5, 3], [4.5, 3]]) b(x - 0.15, z - 0.15, x + 0.15, z + 0.15, y, y + 4, 'metalStep');
    b(-6, -4.5, 6, 4.5, y + 4, y + 4.35, 'roof');
    for (const x of [-2.2, 2.2]) { b(x - 0.4, -0.5, x + 0.4, 0.5, y, y + 1.5, 'pump'); }
    house(K2, -6, 7, 6, 13.5, y, 3, 'plaster', { ops: [door('s', 0, 2.2), win('s', -4), win('s', 4), win('e', 10.2)], loot: 2, floor: 'floorTile', roofMat: 'roof' });
    b(8, -2.3, 10.4, 2.3, y, y + 1.5, 'wreck', true); K2.D({ t: 'wreck', x: 9.2, z: 0, y, yaw: 0 });
    b(-9, 8, -8.2, 8.8, y, y + 1.1, 'barrel'); K2.L(0, y, -6); K2.L(-8, y, 2);
    K2.D({ t: 'lamps', list: [[-7, -5.5], [7, -5.5]].map(([x, z]) => [x, z, y]) });
  }
  veh.push([-62, -44, 1.57]);
  // ── 폐교 ──
  {
    const K2 = shift(-20, 245), b = K2.B, y = yS;
    house(K2, -16, -2, 16, 10, y, 6, 'brick', { ops: [door('s', -9, 2.2, 1), door('s', 9, 2.2, 1), door('e', 4, 2, 1), win('s', -13, 2), win('s', -4, 2), win('s', 0, 2), win('s', 4, 2), win('s', 13, 2), win('n', -10, 2), win('n', 0, 2), win('n', 10, 2), win('w', 6, 1)], floor2: true, loot: 4, floor: 'floorWood', roofMat: 'roof' });
    b(-5.15, -1.7, -4.85, 5.4, y, y + 2.8, 'plaster'); b(4.85, -1.7, 5.15, 5.4, y, y + 2.8, 'plaster');
    for (const x of [-1.5, 1.5, 9, 12]) b(x - 0.5, 1.5, x + 0.5, 2.3, y, y + 0.75, 'tableTop');
    house(K2, -34, -6, -22, 10, y, 5, 'brick', { ops: [door('e', 2, 2.4), win('s', -28), win('n', -28), win('w', 2)], loot: 4, floor: 'floorWood', roofMat: 'roof', furn: false });
    for (const [x0, z0, x1, z1] of [[-34, -16, -6, -15.7], [2, -16, 24, -15.7], [23.7, -15.7, 24, 16], [-34, -15.7, -33.7, -8]]) b(x0, z0, x1, z1, y - 0.4, y + 1.3, 'con');
    K2.D({ t: 'playground', x: 12, z: -9, y }); b(11.9, -9.6, 12.1, -9.4, y, y + 2.2, 'metalStep'); b(15.9, -9.6, 16.1, -9.4, y, y + 2.2, 'metalStep');
    K2.D({ t: 'antenna', x: -2, z: -12, y, h: 8 });
    b(18, 4, 20, 6, y, y + 1.2, 'crate'); K2.L(0, y, -8); K2.L(-12, y, -10); K2.L(20, y, -4); K2.L(-28, y, 14);
  }
  veh.push([-2, 222, 1.57]);
  // ── 풍력 발전기 ──
  turbines.forEach(([x, z, y]) => { B(x - 1.1, z - 1.1, x + 1.1, z + 1.1, y - 1, y + 34, 'white', true); D({ t: 'turbine', x, z, y, h: 34 }); L(x + 3, y, z); });
  // ── 외딴 오두막들 ──
  cabins.forEach(([x, z, y], i) => {
    cotAt(K, x, z, y, i);
    if (i % 2) B(x - 0.7, z + 4.3, x + 0.7, z + 5.7, y, y + 1.2, 'crate'); else B(x - 6.6, z + 1, x - 5.8, z + 1.8, y, y + 1.1, 'barrel');
    L(x + (i % 2 ? -6 : 6), y, z + 2);
    if (i % 5 === 2) veh.push([x + 7.5, z - 4, i]);
  });

  // ── 길 ──
  const P = { vil: [200, 188], tow: [50, 144], camp: [-30, 66], obs: [-120, 150], fac: [86, -22], har: [8, -262], farm: [-222, -54], town: [0, -120], base: [228, 20], air: [100, 276], fish: [-262, 120], qua: [-96, -214], gas: [-70, -38], sch: [-20, 228], ruin: [184, -180] };
  const roads = [
    [P.town, [-6, -180], [0, -230], P.har], [P.town, [40, -80], P.fac], [P.town, [-40, -70], P.gas], [P.gas, [-140, -44], P.farm], [P.gas, [-50, 20], P.camp],
    [P.camp, [-70, 110], P.obs], [P.camp, [10, 110], P.tow], [P.tow, [120, 170], P.vil], [P.tow, [20, 190], P.sch], [P.sch, [40, 262], P.air], [P.air, [160, 250], P.vil],
    [P.fac, [150, 0], P.base], [P.base, [240, 110], P.vil], [P.fac, [130, -100], P.ruin], [P.town, [-50, -170], P.qua], [P.farm, [-250, 30], P.fish], [P.obs, [-200, 150], P.fish], [P.vil, [222, 206], [234, 218]],
    [P.farm, [-180, -150], P.qua], [P.ruin, [100, -230], [40, -250], P.har],
  ];
  const segs = [];
  for (const line of roads) for (let i = 0; i + 1 < line.length; i++) segs.push([line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]]);
  const roadDist = (x, z) => { let m = 1e9; for (const [ax, az, bx, bz] of segs) { const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t); if (d < m) m = d; } return m; };
  const clear = (x, z, m) => { for (const p of pads) if (Math.hypot(x - p.x, z - p.z) < p.r + m) return false; return true; };
  // 전봇대 (길을 따라)
  const poles = [];
  for (const [ax, az, bx, bz] of segs) {
    const len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let d = 20; d < len - 10; d += 32) { const x = ax + ((bx - ax) * d) / len + nx * 5, z = az + ((bz - az) * d) / len + nz * 5, g = gAt(x, z); if (g < 1 || !clear(x, z, 2) || poles.some((q) => Math.hypot(q[0] - x, q[1] - z) < 14)) continue; poles.push([+x.toFixed(1), +z.toFixed(1), +g.toFixed(2), +Math.atan2(bx - ax, bz - az).toFixed(2)]); B(x - 0.16, z - 0.16, x + 0.16, z + 0.16, g - 1, g + 7.5, 'trunk', true); }
  }
  D({ t: 'poles', list: poles });

  // ── 나무·바위·덤불 (씨앗 고정이라 서버와 화면이 같다) ──
  const trees = [], rocks = [], bushes = [], tg = new Map(); // tg: 가까운 나무 찾기용 6m 칸
  const tkey = (x, z) => Math.floor(x / 6) + ',' + Math.floor(z / 6);
  const nearTree = (x, z, r) => { const ci = Math.floor(x / 6), cj = Math.floor(z / 6); for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) { const l = tg.get(i + ',' + j); if (l) for (const t of l) if (Math.abs(t[0] - x) < r && Math.abs(t[1] - z) < r) return true; } return false; };
  const forest = (x, z) => Math.sin(x * 0.019 + 2) * Math.cos(z * 0.017 - 1) + 0.7 * Math.sin((x + z) * 0.008 + 0.5);
  for (let i = 0; i < 12000 && trees.length < 1900; i++) {
    const x = (R() - 0.5) * 760, z = (R() - 0.5) * 760, g = gAt(x, z), f = forest(x, z);
    if (g < 0.9 || !clear(x, z, 3) || roadDist(x, z) < 5) continue;
    const beach = g < 2.2;
    if (!beach && R() > 0.2 + (f + 1) * 0.4) continue;
    if (beach && R() > 0.14) continue;
    if (nearTree(x, z, 2.6)) continue;
    const k = beach ? 2 : f > 0.2 ? 0 : R() < 0.7 ? 1 : 0, s = 0.8 + R() * 0.6;
    const t = [+x.toFixed(1), +z.toFixed(1), +g.toFixed(2), +s.toFixed(2), k, +(R() * 6.28).toFixed(2)];
    trees.push(t); const key = tkey(x, z); if (!tg.has(key)) tg.set(key, []); tg.get(key).push(t);
    B(x - 0.32, z - 0.32, x + 0.32, z + 0.32, g - 1, g + 4.5 * s, 'trunk', true);
  }
  for (let i = 0; i < 1600 && rocks.length < 230; i++) {
    const x = (R() - 0.5) * 750, z = (R() - 0.5) * 750, g = gAt(x, z);
    if (g < 0.2 || !clear(x, z, 4) || roadDist(x, z) < 6 || nearTree(x, z, 3) || rocks.some((t) => Math.abs(t[0] - x) < 5 && Math.abs(t[1] - z) < 5)) continue;
    const s = 0.8 + R() * 1.5;
    rocks.push([+x.toFixed(1), +z.toFixed(1), +g.toFixed(2), +s.toFixed(2), +(R() * 6.28).toFixed(2)]);
    B(x - s * 0.8, z - s * 0.8, x + s * 0.8, z + s * 0.8, g - 1, g + s * 1.05, 'rock', true);
  }
  for (let i = 0; i < 3000 && bushes.length < 760; i++) {
    const x = (R() - 0.5) * 750, z = (R() - 0.5) * 750, g = gAt(x, z);
    if (g < 1.4 || !clear(x, z, 1) || roadDist(x, z) < 3.2) continue;
    bushes.push([+x.toFixed(1), +z.toFixed(1), +g.toFixed(2), +(0.6 + R() * 0.7).toFixed(2)]);
  }
  D({ t: 'trees', list: trees }); D({ t: 'rocks', list: rocks }); D({ t: 'bushes', list: bushes });
  // 들판에 흩어진 아이템 자리
  for (let i = 0, n = 0; i < 1500 && n < 90; i++) {
    const x = (R() - 0.5) * 640, z = (R() - 0.5) * 640, g = gAt(x, z);
    if (g < 1.5 || !clear(x, z, 6) || nearTree(x, z, 1.5) || rocks.some((t) => Math.abs(t[0] - x) < 4 && Math.abs(t[1] - z) < 4)) continue;
    L(+x.toFixed(1), +g.toFixed(2), +z.toFixed(1)); n++;
  }
  D({ t: 'roads', list: roads, pads: pads.map((p) => [p.x, p.z, p.r]) });
  const names = [['등대 마을', 200, 190], ['항구', 16, -292], ['농장', -232, -60], ['폐공장', 88, -32], ['관측소', -120, 160], ['캠프장', -30, 70], ['옛 성터', 190, -190], ['송신탑', 50, 150], ['읍내', 0, -120], ['군사 기지', 270, 20], ['비행장', 100, 290], ['어촌', -280, 120], ['채석장', -110, -230], ['주유소', -70, -24], ['폐교', -20, 248], ['풍력 단지', -200, 62]];
  D({ t: 'names', list: names });
  // 길가 이정표
  D({ t: 'signs', list: [['읍내', -8, -62, 0.3], ['항구', 6, -236, 0], ['농장', -186, -50, 1.4], ['폐공장', 58, -52, -0.8], ['캠프장', -44, 44, 0.2], ['관측소', -92, 132, 0.8], ['등대 마을', 160, 180, -1.3], ['군사 기지', 204, 12, -1.5], ['비행장', 64, 262, -0.6], ['어촌', -236, 104, 1.3], ['채석장', -74, -196, 0.6], ['폐교', -4, 212, 0.3], ['옛 성터', 160, -150, -0.8], ['주유소', -52, -52, 0.8]].map(([t, x, z, yaw]) => [t, x, z, +gAt(x, z).toFixed(2), yaw]) });
  const okSpot = ([x, y, z]) => !K.boxes.some((b) => x + 0.45 > b.min[0] && x - 0.45 < b.max[0] && z + 0.45 > b.min[2] && z - 0.45 < b.max[2] && y + 0.1 < b.max[1] && y + 1.8 > b.min[1]);
  const vehOk = veh.map(([x, z, yaw]) => [x, z, +gAt(x, z).toFixed(2), +(yaw % 6.28).toFixed(2)]).filter(([x, z, y]) => y > 0.8 && !K.boxes.some((b) => x + 1.6 > b.min[0] && x - 1.6 < b.max[0] && z + 1.6 > b.min[2] && z - 1.6 < b.max[2] && y + 0.2 < b.max[1] && y + 1.6 > b.min[1]));
  return { key: 'isle', name: '외딴 섬', arena: { hx: HX, hz: HX, wallH: 0 }, boxes: K.boxes, decor: K.decor, loot: K.loot.filter(okSpot), veh: vehOk, spawns: [[[0, 0, 0]], [[0, 0, 0]]], spawnsTdm: [[[0, 0, 0]], [[0, 0, 0]]], sites: [], hm, br: true, land: LAND - 40 };
}
function cot2(K, x0, z0, x1, z1, y, ops, wall, gcol) { return house(K, x0, z0, x1, z1, y, 3, wall, { ops, gable: 1.5, gcol, loot: 2, roofMat: 'plankDark' }); }

// 지형 높이 (격자 사이는 부드럽게 이음). 바다는 min 보다 깊어지지 않는다 = 얕은 물을 걸어 다닐 수 있다
export function hmSample(hm, x, z, rawH) {
  const n = hm.n, nz = hm.nz || n; // n = 가로 칸 수, nz = 세로 칸 수 (없으면 정사각형)
  const fx = clamp((x + hm.hx) / hm.res, 0, n - 1.001), fz = clamp((z + hm.hz) / hm.res, 0, nz - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, H = hm.H;
  const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
  const h = (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  return rawH || h > hm.min ? h : hm.min;
}

// 상자를 8m 격자에 나눠 담아 둔다 (큰 맵에서 충돌·사격 판정을 빠르게)
function accel(m) {
  const cs = 8, nx = Math.ceil((m.arena.hx * 2 + 2) / cs), nz = Math.ceil((m.arena.hz * 2 + 2) / cs), ox = -m.arena.hx - 1, oz = -m.arena.hz - 1;
  const cells = Array.from({ length: nx * nz }, () => []);
  for (const b of m.boxes) {
    const i0 = clamp(Math.floor((b.min[0] - ox) / cs), 0, nx - 1), i1 = clamp(Math.floor((b.max[0] - ox) / cs), 0, nx - 1);
    const j0 = clamp(Math.floor((b.min[2] - oz) / cs), 0, nz - 1), j1 = clamp(Math.floor((b.max[2] - oz) / cs), 0, nz - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells[j * nx + i].push(b);
  }
  m.acc = { cs, nx, nz, ox, oz, cells };
  return m;
}

export const MAPS = [...ARENAS, makeIsle()].map(accel);
export const ARENA_MAPS = MAPS.filter((m) => !m.br).length; // 폭탄전·데스매치에서 번갈아 쓰는 맵 수
