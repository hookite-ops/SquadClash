// SQUAD CLASH — 멀티플레이 FPS 서버: 폭탄전·팀 데스매치·생존전 (정적 파일 + WebSocket 한 프로세스)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { ARENA, PLAYER, WEAPONS, SKINS, NADES, ECON, NADE_WEAPON, ZONE_WEAPON, VEH_WEAPON, W_KNIFE, W_PISTOL, W_DEFAULT_PRIM, MAPS, ARENA_MAPS, setMap, MAP, floorAt, buildNav, SPAWNS, SPAWNS_TDM, SITES, siteAt, dirFrom, rayWorld, rayPlayer, segHitsSphere, groundAt, boxesNear } from './public/shared.js';

const PORT = process.env.PORT || 8080;
const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const TICK_MS = 50;
const MATCH_MS = 6 * 60 * 1000;
const KILL_LIMIT = Number(process.env.KILL_LIMIT) || 30;
const RESPAWN_MS = 3000;
const PROT_MS = 2000;
const END_MS = 9000;
// 폭탄전
const ROUNDS_WIN = 5;      // 먼저 따면 승리
const SWAP_AFTER = 4;      // 이 라운드 수 뒤 공수 교대
const FREEZE_MS = 8000;    // 라운드 시작 준비 시간
const ROUND_MS = 135000;   // 라운드 제한 시간
const BOMB_MS = 35000;     // 설치 후 폭발까지
const OVER_MS = 5000;      // 라운드 결과 표시
const PLANT_S = 3, DEFUSE_S = 5;
const BOT_PRIMS = [13, 12, 10, 16, 7, 6]; // 봇이 쓰는 주무기 (비싼 순)
const TEAM_MIN = process.env.NO_BOTS ? 0 : 5; // 사람이 부족하면 봇으로 채우는 팀 인원
const TEAM_MAX = 6; // 팀당 최대 사람 수
// 생존전(배틀로얄)
const BR = {
  total: process.env.NO_BOTS ? 0 : Number(process.env.BR_TOTAL) || 24, // 사람이 모자라면 봇으로 채우는 전체 인원
  max: 20,           // 한 방 최대 사람 수
  wait: Number(process.env.BR_WAIT) || 12000, // 시작 전 대기
  dropH: 130,        // 낙하 시작 높이
  r0: 400,           // 처음 안전 구역 반경
  // 단계: [대기 초, 줄어드는 초, 다음 반경 비율, 구역 밖 초당 피해]
  zones: [[45, 40, 0.58, 1], [32, 34, 0.55, 2], [24, 28, 0.5, 4], [16, 22, 0.45, 7], [10, 18, 0.4, 10], [6, 14, 0, 16]],
  heal: 60, healMs: 2200,
  // 아이템: 무기별 나올 비중
  wWeight: { 2: 3, 3: 3, 4: 3, 5: 2, 6: 4, 7: 3, 8: 3, 9: 2, 10: 3, 11: 2, 12: 2, 13: 3, 14: 2, 15: 1, 16: 2, 17: 1 },
  airLoot: [15, 17, 13, 12, 11], // 보급 상자에서 나오는 주무기
};
const BR_SCALE = Number(process.env.BR_SCALE) || 1; // 테스트용: 구역 시간을 줄임
// ───────────── 스킨 코드 ─────────────
// 코드 → 풀리는 스킨(들). 'all' 은 전부. 코드는 대소문자·줄표를 가리지 않는다.
// 바꾸려면 아래 표를 고치거나, 환경 변수로 덮어쓴다:  SKIN_CODES="코드1:gold,neon;코드2:all"
const SKIN_CODES = {
  'CARBON-R7K2-M4XQ': ['carbon'],
  'TIGER-9F3W-K8LP': ['tiger'],
  'SAKURA-5T8N-Q2VD': ['sakura'],
  'ICE-4H6J-Z7RB': ['ice'],
  'NEON-8P2C-X5WM': ['neon'],
  'LAVA-3K9D-F6TY': ['lava'],
  'GOLD-7Q4M-X9KP': ['gold'],
  'GALAXY-2V8B-N5HS': ['galaxy'],
  'AURORA-6W3G-J9CZ': ['aurora'],
  'HALLOWEEN-3J7X-P9KT': ['halloween'],
  'RARE-PACK-4N7T-B2QK': ['carbon', 'tiger', 'sakura'],
  'HERO-PACK-9M5X-D3VF': ['ice', 'neon', 'lava'],
  'SQUAD-ALL-8Z6R-P4WY': 'all',
};
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);
const CODES = new Map();
{
  const src = process.env.SKIN_CODES ? Object.fromEntries(process.env.SKIN_CODES.split(';').map((e) => e.split(':')).filter((e) => e.length === 2).map(([c, l]) => [c, l.trim() === 'all' ? 'all' : l.split(',').map((x) => x.trim())])) : SKIN_CODES;
  for (const [c, list] of Object.entries(src)) {
    const ids = list === 'all' ? SKINS.map((_, i) => i).filter((i) => !SKINS[i].free) : list.map((id) => SKINS.findIndex((k) => k.id === id)).filter((i) => i > 0);
    if (normCode(c).length >= 6 && ids.length) CODES.set(normCode(c), ids);
  }
}
const FREE_SKINS = SKINS.map((k, i) => (k.free ? i : -1)).filter((i) => i >= 0);
function skinsFor(codes) { // 코드들로 쓸 수 있는 스킨 번호 모음
  const set = new Set(FREE_SKINS);
  if (Array.isArray(codes)) for (const c of codes.slice(0, 24)) { const ids = CODES.get(normCode(c)); if (ids) for (const i of ids) set.add(i); }
  return set;
}
function cleanSkins(sk, owned) { return WEAPONS.map((_, i) => (Array.isArray(sk) && owned.has(sk[i]) ? sk[i] : 0)); }
const redeemLog = new Map(); // 주소별 시도 횟수 (마구 찍어 맞히기 방지)

const BOT_NAMES = ['알파', '브라보', '찰리', '델타', '에코', '폭스', '골프', '호텔', '주노', '킬로'];

// ───────────── 정적 파일 ─────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const cache = new Map();
function loadFile(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const full = path.join(PUBLIC, rel);
  if (!full.startsWith(PUBLIC + path.sep)) return null;
  let entry = null;
  try {
    const raw = fs.readFileSync(full);
    const ext = path.extname(full);
    const text = ['.html', '.js', '.css', '.json', '.svg'].includes(ext);
    entry = { raw, gz: text ? zlib.gzipSync(raw) : null, type: MIME[ext] || 'application/octet-stream', vendor: rel.startsWith('vendor/') };
  } catch { entry = null; }
  cache.set(rel, entry);
  return entry;
}
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch { url = '/'; }
  if (url === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (url === '/api/redeem') { // 스킨 코드 확인:  /api/redeem?c=코드[,코드…]
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(), now = Date.now();
    let r = redeemLog.get(ip);
    if (!r || now - r.t > 60000) { r = { t: now, n: 0 }; redeemLog.set(ip, r); if (redeemLog.size > 5000) redeemLog.clear(); }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    if (++r.n > 60) return res.end(JSON.stringify({ ok: false, wait: true, skins: FREE_SKINS }));
    let q = '';
    try { q = new URL(req.url, 'http://x').searchParams.get('c') || ''; } catch {}
    const codes = q.split(',').slice(0, 24), good = codes.filter((c) => CODES.has(normCode(c))).map(normCode);
    return res.end(JSON.stringify({ ok: good.length > 0, codes: good, skins: [...skinsFor(good)] }));
  }
  if (url === '/api/rooms') { // 방 목록: 사람이 있는 방만 (많은 순)
    const list = [];
    for (const r of rooms.values()) { const n = r.humans(); if (n > 0) { const max = r.mode === 'br' ? BR.max : TEAM_MAX * 2; list.push({ code: r.code, pub: r.isPublic, mode: r.mode, map: MAPS[r.map] ? MAPS[r.map].name : '', n, max, bot: r.botLv }); } }
    list.sort((a, b) => b.n - a.n);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ rooms: list.slice(0, 30) }));
  }
  if (url === '/') url = '/index.html';
  const f = loadFile(path.normalize(url).replace(/^[/\\]+/, ''));
  if (!f) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('없는 페이지'); }
  const gz = f.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const head = { 'content-type': f.type, 'cache-control': f.vendor ? 'public, max-age=604800' : 'no-cache' };
  if (gz) head['content-encoding'] = 'gzip';
  res.writeHead(200, head);
  res.end(gz ? f.gz : f.raw);
});

// ───────────── 봇 길찾기용 격자 (맵마다 1m 칸) ─────────────
const GRIDS = MAPS.map((m, mi) => { setMap(mi); return buildNav(m); });
setMap(0);
let blocked = GRIDS[0].g, GW = GRIDS[0].W, GH = GRIDS[0].H, GX = GRIDS[0].hx, GZ = GRIDS[0].hz, hgt = GRIDS[0].hgt, STEPH = GRIDS[0].step;
// 방마다 맵이 다를 수 있어서, 방을 다루기 전에 그 방의 맵으로 맞춘다
function useMap(room) {
  if (MAP !== room.map) setMap(room.map);
  const G = GRIDS[room.map]; blocked = G.g; GW = G.W; GH = G.H; GX = G.hx; GZ = G.hz; hgt = G.hgt; STEPH = G.step;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const cellOf = (x, z) => clamp(Math.floor(z + GZ), 0, GH - 1) * GW + clamp(Math.floor(x + GX), 0, GW - 1);
const cellX = (c) => -GX + (c % GW) + 0.5;
const cellZ = (c) => -GZ + Math.floor(c / GW) + 0.5;
const isBlockedAt = (x, z) => x < -GX || x >= GX || z < -GZ || z >= GZ || blocked[cellOf(x, z)] === 1;
// 높이 차가 커서 걸어서 못 넘는 자리인지 (다리 위 ↔ 다리 아래, 축대 위 ↔ 아래)
const stepBlocked = (x0, z0, x1, z1) => STEPH > 0 && Math.abs(hgt[cellOf(x1, z1)] - hgt[cellOf(x0, z0)]) > STEPH;
function nearestFree(c) {
  if (!blocked[c]) return c;
  const ci = c % GW, cj = Math.floor(c / GW);
  for (let r = 1; r < 16; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const i = ci + di, j = cj + dj;
    if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
    if (!blocked[j * GW + i]) return j * GW + i;
  }
  return c;
}
// A* (이진 힙). 탐색마다 배열을 지우지 않도록 방문 번호를 쓴다
const GMAX = Math.max(...GRIDS.map((G) => G.W * G.H));
const _g = new Float32Array(GMAX), _f = new Float32Array(GMAX), _from = new Int32Array(GMAX), _seen = new Uint32Array(GMAX), _closed = new Uint32Array(GMAX);
let _run = 0;
const heap = [];
function hpush(n) { let i = heap.length; heap.push(n); const f = _f[n]; while (i > 0) { const p = (i - 1) >> 1; if (_f[heap[p]] <= f) break; heap[i] = heap[p]; i = p; } heap[i] = n; }
function hpop() {
  const top = heap[0], last = heap.pop(), n = heap.length;
  if (n) { let i = 0; const f = _f[last]; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && _f[heap[c + 1]] < _f[heap[c]]) c++; if (_f[heap[c]] >= f) break; heap[i] = heap[c]; i = c; } heap[i] = last; }
  return top;
}
function findPath(sx, sz, tx, tz) {
  const s = nearestFree(cellOf(sx, sz)), t = nearestFree(cellOf(tx, tz));
  if (s === t) return [];
  const run = ++_run;
  const ti = t % GW, tj = Math.floor(t / GW);
  const h = (c) => { const dx = Math.abs((c % GW) - ti), dz = Math.abs(Math.floor(c / GW) - tj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  heap.length = 0;
  _g[s] = 0; _f[s] = h(s); _from[s] = -1; _seen[s] = run; hpush(s);
  let found = false;
  for (let iter = 0; iter < 24000 && heap.length; iter++) {
    const c = hpop();
    if (c === t) { found = true; break; }
    if (_closed[c] === run) continue;
    _closed[c] = run;
    const ci = c % GW, cj = Math.floor(c / GW);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
      const n = j * GW + i;
      if (blocked[n] || _closed[n] === run) continue;
      if (di && dj && (blocked[cj * GW + i] || blocked[j * GW + ci])) continue;
      if (STEPH > 0) { const hc = hgt[c]; if (Math.abs(hgt[n] - hc) > STEPH || (di && dj && (Math.abs(hgt[cj * GW + i] - hc) > STEPH || Math.abs(hgt[j * GW + ci] - hc) > STEPH))) continue; }
      const ng = _g[c] + (di && dj ? 1.414 : 1);
      if (_seen[n] !== run || ng < _g[n]) { _seen[n] = run; _g[n] = ng; _f[n] = ng + h(n); _from[n] = c; hpush(n); }
    }
  }
  if (!found) return [];
  const out = [];
  for (let c = t; c !== s && c !== -1; c = _from[c]) out.push([cellX(c), cellZ(c)]);
  return out.reverse();
}

// ───────────── 방 ─────────────
let nextId = 1;
const rooms = new Map();
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const lootWire = (it) => [it.id, it.k, it.v, r2(it.x), r2(it.y), r2(it.z)];

class Room {
  constructor(code, isPublic, mode) {
    this.code = code; this.isPublic = isPublic; this.mode = mode;
    this.attack = 0; this.roundNo = 0; this.phase = mode === 'bomb' ? 'over' : mode === 'br' ? 'wait' : 'tdm'; this.phaseEnd = 0;
    this.loot = []; this.lootId = 1; this.zone = null; this.brTotal = 0; this.zoneHitAt = 0;
    this.bomb = { state: 'none', carrier: 0, x: 0, z: 0, explodeAt: 0 };
    this.botSite = 0; this.actor = 0; this.actProg = 0;
    this.nades = []; this.smokes = []; this.nadeId = 1; this.drops = []; this.dropId = 1;
    this.map = 0; this.botLv = 1; // 봇 난이도 0~3
    this.vehs = []; this.air = null; this.calmUntil = 0;
    this.players = new Map();
    this.score = [0, 0];
    this.state = 'play';
    this.endsAt = Date.now() + MATCH_MS;
    this.resetAt = 0;
    this.rosterDirty = true;
  }
  humans(team) { let n = 0; for (const p of this.players.values()) if (!p.bot && (team === undefined || p.team === team)) n++; return n; }
  bots(team) { const a = []; for (const p of this.players.values()) if (p.bot && p.team === team) a.push(p); return a; }
  send(p, msg) { if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg)); }
  broadcast(msg, except) {
    const s = JSON.stringify(msg);
    for (const p of this.players.values()) if (p.ws && p !== except && p.ws.readyState === 1) p.ws.send(s);
  }
  addPlayer(name, ws, team, bot) {
    const p = { id: nextId++, name, ws, team, bot, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hp: 100, alive: false, w: 0, k: 0, d: 0, respawnAt: 0, lastShot: 0, protUntil: 0, hist: [], c: false, acting: false, actT: 0, actX: 0, actZ: 0, wantTeam: -1, radioAt: 0, money: ECON.start, prim: this.mode === 'tdm' ? W_DEFAULT_PRIM : 0, side: W_PISTOL, armor: 0, nades: [0, 0, 0], blindUntil: 0, med: 0, healAt: 0, air: false, veh: 0, sk: null };
    if (bot) { Object.assign(p, { path: [], pathAt: 0, seen: 0, burst: 0, pauseUntil: 0, gx: 0, gz: 0, goal: null, goalAt: 0, lx: 0, lz: 0, stuckAt: 0, nadeAt: 0, strafe: Math.random() < 0.5 ? 1 : -1, strafeAt: 0 }); botInit(this, p); }
    this.players.set(p.id, p);
    this.rosterDirty = true;
    return p;
  }
  balanceBots() {
    if (this.mode === 'br') return; // 생존전은 경기 시작 때만 봇을 채움
    const target = process.env.NO_BOTS ? 0 : Math.max(TEAM_MIN, this.humans(0), this.humans(1)); // NO_BOTS=1 은 테스트용
    for (const team of [0, 1]) {
      const bots = this.bots(team);
      let want = Math.max(0, target - this.humans(team));
      while (bots.length > want) this.removePlayer(bots.pop());
      while (bots.length < want) {
        const used = new Set([...this.players.values()].map((p) => p.name));
        const nm = BOT_NAMES.map((n) => '봇 ' + n).find((n) => !used.has(n)) || '봇 ' + nextId;
        const b = this.addPlayer(nm, null, team, true);
        if (this.mode === 'tdm') this.spawn(b, Date.now()); // 폭탄전은 다음 라운드에 합류
        bots.push(b);
      }
    }
  }
  // ── 소지품과 돈 ──
  sendInv(p) { if (!p.bot) this.send(p, { t: 'inv', money: p.money, prim: p.prim, side: p.side, armor: p.armor, n: p.nades, med: p.med }); }
  owns(p, wi) { return wi === W_KNIFE || wi === p.side || (p.prim > 0 && wi === p.prim); }
  pay(p, v) { p.money = clamp(p.money + v, 0, ECON.max); }
  buy(p, k) {
    const bomb = this.mode === 'bomb';
    if (this.mode === 'br') return;
    if (bomb && (this.phase !== 'freeze' || !p.alive)) return;
    if (/^w\d{1,2}$/.test(k)) {
      const wi = +k.slice(1), W = WEAPONS[wi];
      if (!W || W.slot === 'melee') return;
      const price = bomb ? W.price : 0;
      if (p[W.slot] === wi || p.money < price) return;
      if (bomb) p.money -= price;
      p[W.slot] = wi; p.w = wi;
    } else if (!bomb) return; // 데스매치는 무기만 고름
    else if (k === 'armor') {
      if (p.armor >= 100 || p.money < ECON.armor) return;
      p.money -= ECON.armor; p.armor = 100;
    } else if (/^n[0-2]$/.test(k)) {
      const ni = +k[1];
      if (p.nades[ni] >= 1 || p.money < NADES[ni].price) return;
      p.money -= NADES[ni].price; p.nades[ni] = 1;
    } else return;
    this.sendInv(p);
  }
  botBuy(b) {
    if (b.prim === 0) { // 살 수 있는 것 중 좋은 주무기부터
      const pick = BOT_PRIMS.filter((wi) => WEAPONS[wi].price <= b.money);
      if (pick.length) { const wi = pick[Math.floor(Math.random() * Math.min(2, pick.length))]; b.money -= WEAPONS[wi].price; b.prim = wi; }
      else if (b.side === W_PISTOL && b.money >= WEAPONS[3].price + 200) { b.money -= WEAPONS[3].price; b.side = 3; }
    }
    if (b.armor < 100 && b.money >= ECON.armor + 300) { b.money -= ECON.armor; b.armor = 100; }
    if (!b.nades[0] && b.money >= NADES[0].price + 400 && Math.random() < 0.6) { b.money -= NADES[0].price; b.nades[0] = 1; }
    if (!b.nades[2] && b.money >= NADES[2].price + 800 && Math.random() < 0.4) { b.money -= NADES[2].price; b.nades[2] = 1; }
    b.w = b.prim || b.side;
  }
  // ── 투척 무기 ──
  throwNade(p, k, d, now) {
    if (!p.alive || !this.canFight() || !(p.nades[k] > 0)) return;
    p.nades[k]--;
    const ey = p.y + (p.c ? PLAYER.eyeCrouch : PLAYER.eye);
    this.nades.push({ id: this.nadeId++, k, owner: p.id, team: p.team, x: p.x + d[0] * 0.5, y: ey + d[1] * 0.5, z: p.z + d[2] * 0.5, vx: d[0] * 17, vy: d[1] * 17 + 2.6, vz: d[2] * 17, at: now + NADES[k].fuse });
    this.sendInv(p);
  }
  nadeHits(x, y, z) {
    if (y < groundAt(x, z) + 0.12) return true;
    for (const b of boxesNear(x, z, 0.2)) if (x > b.min[0] - 0.12 && x < b.max[0] + 0.12 && y > b.min[1] - 0.12 && y < b.max[1] + 0.12 && z > b.min[2] - 0.12 && z < b.max[2] + 0.12) return true;
    return false;
  }
  tickNades(now, dt) {
    if (this.smokes.length) this.smokes = this.smokes.filter((s) => s.until > now);
    for (const n of this.nades) {
      const steps = 3, h = dt / steps;
      for (let i = 0; i < steps; i++) {
        n.vy -= 17 * h;
        const nx = n.x + n.vx * h; if (this.nadeHits(nx, n.y, n.z)) n.vx *= -0.42; else n.x = nx;
        const nz = n.z + n.vz * h; if (this.nadeHits(n.x, n.y, nz)) n.vz *= -0.42; else n.z = nz;
        const ny = n.y + n.vy * h; if (this.nadeHits(n.x, ny, n.z)) { n.vy *= -0.38; n.vx *= 0.72; n.vz *= 0.72; if (Math.abs(n.vy) < 0.8) n.vy = 0; } else n.y = ny;
      }
      if (now >= n.at) { n.dead = true; this.explode(n, now); }
    }
    if (this.nades.some((n) => n.dead)) this.nades = this.nades.filter((n) => !n.dead);
  }
  explode(n, now) {
    const N = NADES[n.k], o = [n.x, n.y + 0.25, n.z];
    this.broadcast({ t: 'fx', k: n.k, x: r2(n.x), y: r2(n.y), z: r2(n.z) });
    const clear = (p, range) => { // 폭발 지점에서 가려지지 않았는지
      const dx = p.x - o[0], dy = p.y + 1.1 - o[1], dz = p.z - o[2], len = Math.hypot(dx, dy, dz);
      if (len > range) return -1;
      return len < 0.6 || rayWorld(o, [dx / len, dy / len, dz / len], len) >= len - 0.05 ? len : -1;
    };
    if (n.k === 1) { this.smokes.push({ x: n.x, y: n.y + 1.2, z: n.z, r: N.radius, until: now + N.last }); return; }
    if (n.k === 2) { for (const p of this.players.values()) if (p.bot && p.alive && clear(p, N.radius) >= 0) p.blindUntil = now + 2300; return; }
    const owner = this.players.get(n.owner);
    if (!owner) return;
    for (const p of [...this.players.values()]) {
      if (!p.alive || (p.team === n.team && p !== owner) || now < p.protUntil) continue;
      const d = clear(p, N.radius);
      if (d < 0) continue;
      const dmg = Math.round(N.dmg * (1 - d / N.radius) * (p === owner ? 0.5 : 1));
      if (dmg > 0) this.damage(owner, p, dmg, false, NADE_WEAPON, now);
    }
  }
  noise(src, range, now) { // 총소리를 들은 봇은 그쪽을 살피러 감
    for (const b of this.players.values()) {
      if (!b.bot || !b.alive || b === src || b.team === src.team || b.tgtId || (b.alert && now - b.alert.t < 2500)) continue;
      const d = Math.hypot(b.x - src.x, b.z - src.z);
      if (d < range && !(this.mode === 'br' && src.bot)) b.alert = { x: src.x + (Math.random() - 0.5) * d * 0.25, z: src.z + (Math.random() - 0.5) * d * 0.25, t: now };
    }
  }
  canFight() { return this.state === 'play' && (this.mode === 'tdm' || this.phase === 'live' || this.phase === 'planted'); }
  aliveAll() { let n = 0; for (const p of this.players.values()) if (p.alive) n++; return n; }
  aliveCount(team) { let n = 0; for (const p of this.players.values()) if (p.team === team && p.alive) n++; return n; }
  removePlayer(p) {
    this.vehLeave(p);
    if (this.bomb.state === 'carried' && this.bomb.carrier === p.id) this.dropBomb(p);
    this.players.delete(p.id);
    this.rosterDirty = true;
  }
  dropWeapon(p) { // 죽으면 주무기를 그 자리에 떨어뜨림
    if (!p.prim) return;
    const c = nearestFree(cellOf(p.x, p.z)), onGround = !blocked[cellOf(p.x, p.z)];
    this.drops.push({ id: this.dropId++, wi: p.prim, x: onGround ? p.x : cellX(c), z: onGround ? p.z : cellZ(c) });
    if (this.drops.length > 12) this.drops.shift();
    p.prim = 0;
  }
  pickupDrops() {
    if (!this.drops.length) return;
    for (const p of this.players.values()) {
      if (!p.alive || p.prim) continue;
      const i = this.drops.findIndex((d) => Math.hypot(d.x - p.x, d.z - p.z) < 1.3);
      if (i < 0) continue;
      p.prim = this.drops[i].wi; p.w = p.prim;
      this.drops.splice(i, 1);
      this.sendInv(p);
      this.send(p, { t: 'pickup', w: p.prim });
    }
  }
  setTeam(p, team, now) {
    if (p.team === team) return;
    if (this.bomb.state === 'carried' && this.bomb.carrier === p.id) this.dropBomb(p);
    p.team = team; p.wantTeam = -1; p.alive = false;
    this.rosterDirty = true;
  }
  dropBomb(p) {
    const c = nearestFree(cellOf(p.x, p.z));
    const onGround = !blocked[cellOf(p.x, p.z)];
    this.bomb.state = 'dropped'; this.bomb.carrier = 0;
    this.bomb.x = onGround ? p.x : cellX(c); this.bomb.z = onGround ? p.z : cellZ(c);
    this.broadcast({ t: 'bomb', ev: 'drop' });
  }
  startRound(now) {
    this.roundNo++;
    const fresh = this.roundNo === 1 || this.roundNo === SWAP_AFTER + 1; // 첫 라운드·공수 교대 때는 돈과 장비 초기화
    if (this.roundNo === SWAP_AFTER + 1) this.attack ^= 1;
    for (const p of this.players.values()) if (p.wantTeam >= 0) { if (this.humans(p.wantTeam) < TEAM_MAX) this.setTeam(p, p.wantTeam, now); p.wantTeam = -1; } // 팀 바꾸기 신청 반영
    this.balanceBots();
    this.nades = []; this.smokes = []; this.drops = [];
    for (const p of this.players.values()) {
      if (fresh) { p.money = ECON.start; p.prim = 0; p.side = W_PISTOL; p.armor = 0; p.nades = [0, 0, 0]; }
      else if (!p.alive) { p.prim = 0; p.side = W_PISTOL; p.armor = 0; p.nades = [0, 0, 0]; }
      if (p.bot) this.botBuy(p);
      p.w = p.prim || p.side;
    }
    this.phase = 'freeze'; this.phaseEnd = now + FREEZE_MS;
    this.actor = 0; this.actProg = 0;
    const attackers = [];
    for (const p of this.players.values()) {
      p.acting = false; p.actT = 0; p.respawnAt = 0;
      if (p.team === this.attack) attackers.push(p);
    }
    const c = attackers[Math.floor(Math.random() * attackers.length)];
    this.bomb = { state: c ? 'carried' : 'none', carrier: c ? c.id : 0, x: 0, z: 0, explodeAt: 0 };
    this.botSite = Math.random() < 0.5 ? 0 : 1;
    this.broadcast({ t: 'round', ev: 'start', n: this.roundNo, attack: this.attack, carrier: this.bomb.carrier, swap: this.roundNo === SWAP_AFTER + 1 });
    for (const p of this.players.values()) { this.spawn(p, now); this.sendInv(p); }
  }
  endRound(win, why, now) {
    if (this.phase === 'over') return;
    this.phase = 'over'; this.phaseEnd = now + OVER_MS;
    this.score[win]++;
    for (const p of this.players.values()) { this.pay(p, p.team === win ? ECON.win : ECON.lose); this.sendInv(p); }
    this.actor = 0; this.actProg = 0;
    this.rosterDirty = true;
    this.broadcast({ t: 'round', ev: 'end', win, why, sc: this.score });
  }
  tickBomb(now, dt) {
    const b = this.bomb, def = this.attack ^ 1;
    if (this.phase === 'freeze') {
      if (now >= this.phaseEnd) { this.phase = 'live'; this.phaseEnd = now + ROUND_MS; }
    } else if (this.phase === 'live' || this.phase === 'planted') {
      for (const p of this.players.values()) if (p.bot) botTick(this, p, dt, now);
      this.tickNades(now, dt);
      this.pickupDrops();
      if (b.state === 'dropped') {
        for (const p of this.players.values()) {
          if (p.alive && p.team === this.attack && Math.hypot(p.x - b.x, p.z - b.z) < 1.6) { b.state = 'carried'; b.carrier = p.id; this.broadcast({ t: 'bomb', ev: 'pickup', id: p.id }); break; }
        }
      }
      this.actor = 0; this.actProg = 0;
      for (const p of this.players.values()) {
        let need = 0;
        if (p.alive && p.acting) {
          if (this.phase === 'live' && b.state === 'carried' && b.carrier === p.id && siteAt(p.x, p.z) >= 0 && p.y - groundAt(p.x, p.z) < 0.3) need = PLANT_S;
          else if (this.phase === 'planted' && p.team === def && Math.hypot(p.x - b.x, p.z - b.z) < 1.9) need = DEFUSE_S;
        }
        if (need && p.actT > 0 && Math.hypot(p.x - p.actX, p.z - p.actZ) > 0.7) need = 0; // 움직이면 처음부터
        if (!need) { p.actT = 0; continue; }
        if (p.actT === 0) { p.actX = p.x; p.actZ = p.z; }
        p.actT += dt;
        if (!this.actor) { this.actor = p.id; this.actProg = Math.min(1, p.actT / need); }
        if (p.actT < need) continue;
        p.actT = 0; p.acting = false;
        if (this.phase === 'live') {
          b.state = 'planted'; b.carrier = 0; b.x = p.x; b.z = p.z; b.explodeAt = now + BOMB_MS;
          this.phase = 'planted'; this.phaseEnd = b.explodeAt;
          this.broadcast({ t: 'bomb', ev: 'planted', id: p.id, site: siteAt(p.x, p.z) });
          this.pay(p, ECON.plant); this.sendInv(p);
        } else {
          b.state = 'defused';
          this.broadcast({ t: 'bomb', ev: 'defused', id: p.id });
          this.pay(p, ECON.defuse);
          this.endRound(def, 'defuse', now);
        }
        break;
      }
      const a = this.aliveCount(this.attack), d = this.aliveCount(def);
      if (this.phase === 'live') {
        if (a === 0) this.endRound(def, 'elim', now);
        else if (d === 0) this.endRound(this.attack, 'elim', now);
        else if (now >= this.phaseEnd) this.endRound(def, 'time', now);
      } else if (this.phase === 'planted') {
        if (now >= b.explodeAt) { b.state = 'exploded'; this.endRound(this.attack, 'boom', now); }
        else if (d === 0) this.endRound(this.attack, 'elim', now);
      }
    } else if (this.phase === 'over' && now >= this.phaseEnd) {
      if (Math.max(this.score[0], this.score[1]) >= ROUNDS_WIN) this.endMatch(now);
      else this.startRound(now);
    }
  }
  spawn(p, now) {
    const pts = this.mode === 'bomb' ? SPAWNS[p.team === this.attack ? 0 : 1] : SPAWNS_TDM[p.team];
    let best = pts[0], bd = -1;
    for (const s of pts) { // 다른 사람과 가장 멀리 떨어진 자리
      let d = 1e9;
      for (const o of this.players.values()) if (o !== p && o.alive) d = Math.min(d, Math.hypot(o.x - s[0], o.z - s[1]));
      d += Math.random() * 2;
      if (d > bd) { bd = d; best = s; }
    }
    p.x = best[0]; p.y = floorAt(best[0], best[1]); p.z = best[1]; p.yaw = best[2]; p.pitch = 0;
    p.hp = 100; p.alive = true; p.protUntil = this.mode === 'tdm' ? now + PROT_MS : 0; p.hist.length = 0;
    p.acting = false; p.actT = 0; p.c = false; p.blindUntil = 0;
    if (this.mode === 'tdm') { p.nades = [1, 1, 1]; if (p.bot) p.prim = BOT_PRIMS[Math.floor(Math.random() * BOT_PRIMS.length)]; if (!p.prim) p.prim = W_DEFAULT_PRIM; this.sendInv(p); }
    p.w = p.prim || p.side;
    if (p.bot) { p.path = []; p.pathAt = 0; p.seen = 0; p.gx = (Math.random() - 0.5) * 5; p.gz = (Math.random() - 0.5) * 5; botInit(this, p); }
    this.broadcast({ t: 'spawn', id: p.id, p: [p.x, p.y, p.z], yaw: p.yaw });
  }
  roster() {
    return { t: 'roster', code: this.code, pub: this.isPublic, mode: this.mode, players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, bot: p.bot, k: p.k, d: p.d, sk: p.sk || undefined })) };
  }
  rewind(e, rt) {
    const h = e.hist;
    if (!h.length || rt >= h[h.length - 1].t) return [e.x, e.y, e.z];
    for (let i = h.length - 1; i > 0; i--) {
      const a = h[i - 1], b = h[i];
      if (rt >= a.t) { const f = (rt - a.t) / (b.t - a.t || 1); return [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f]; }
    }
    return [h[0].x, h[0].y, h[0].z];
  }
  fire(p, dirs, wi, rt, now) {
    const W = WEAPONS[wi];
    const o = [p.x, p.y + (p.c ? PLAYER.eyeCrouch : PLAYER.eye), p.z];
    const dmg = new Map(), ends = [];
    p.protUntil = 0; // 쏘면 무적 해제
    if (p.healAt) { p.healAt = 0; this.send(p, { t: 'heal', on: 0 }); } // 쏘면 치료 취소
    for (const d of dirs) {
      let tBest = rayWorld(o, d, W.range), hit = null, head = false;
      for (const e of this.players.values()) {
        if (e.team === p.team || !e.alive) continue;
        const pos = this.rewind(e, rt);
        const h = rayPlayer(o, d, pos[0], pos[1], pos[2], e.c);
        if (h && h.t < tBest) { tBest = h.t; hit = e; head = h.head; }
      }
      ends.push([r2(o[0] + d[0] * tBest), r2(o[1] + d[1] * tBest), r2(o[2] + d[2] * tBest)]);
      if (hit && now >= hit.protUntil) {
        let dm = W.dmg * (head ? W.head : 1) * (p.bot ? LV[this.botLv].dmg * (this.mode === 'br' ? (hit.bot ? 0.22 : 0.85) : 1) : 1);
        if (W.falloff) dm *= clamp(1 - (tBest - W.falloff[0]) / (W.falloff[1] - W.falloff[0]), 0.2, 1);
        const cur = dmg.get(hit) || { dmg: 0, head: false };
        cur.dmg += dm; cur.head = cur.head || head;
        dmg.set(hit, cur);
      }
    }
    this.broadcast({ t: 'shot', id: p.id, w: wi, e: W.melee ? [] : ends.slice(0, 4) }, p);
    if (!W.melee) this.noise(p, W.quiet ? 16 : 62, now);
    for (const [e, v] of dmg) this.damage(p, e, Math.round(v.dmg), v.head, wi, now);
  }
  damage(by, to, amount, head, wi, now) {
    if (!to.alive || !this.canFight()) return;
    if (to.armor > 0 && !head && !(WEAPONS[wi] && WEAPONS[wi].ap)) { // 방탄복이 몸통 피해 일부를 대신 받음
      const ab = Math.min(to.armor, Math.round(amount * 0.45));
      amount -= ab; to.armor -= ab;
    }
    to.hp = Math.max(0, to.hp - amount);
    if (to.bot && by !== to) { to.hitBy = { id: by.id, t: now }; if (!to.tgtId && !(this.mode === 'br' && by.bot && Math.hypot(by.x - to.x, by.z - to.z) > 15)) to.alert = { x: by.x, z: by.z, t: now }; } // 맞은 봇은 쏜 쪽을 돌아봄
    const msg = { t: 'hit', by: by.id, to: to.id, dmg: amount, head, hp: to.hp, ar: to.armor, ax: r2(by.x), az: r2(by.z) };
    this.send(by, msg); if (to !== by) this.send(to, msg);
    if (to.hp > 0) return;
    const self = by === to;
    to.alive = false; to.d++;
    if (!self) by.k++;
    this.broadcast({ t: 'kill', by: by.id, to: to.id, w: wi, head });
    this.rosterDirty = true;
    if (this.mode === 'br') { this.brDeath(to, now); return; }
    if (this.mode === 'bomb') {
      to.acting = false; to.actT = 0;
      if (!self) { this.pay(by, ECON.kill); this.sendInv(by); }
      this.dropWeapon(to);
      if (this.bomb.state === 'carried' && this.bomb.carrier === to.id) this.dropBomb(to);
      return;
    }
    to.respawnAt = now + RESPAWN_MS;
    if (self) return;
    this.score[by.team]++;
    if (this.score[by.team] >= KILL_LIMIT) this.endMatch(now);
  }
  // ───────── 생존전 ─────────
  brWait(now, ms) { // 다음 경기 대기
    this.phase = 'wait'; this.phaseEnd = now + ms;
    this.loot = []; this.zone = null; this.nades = []; this.smokes = []; this.vehs = []; this.air = null;
    for (const p of this.players.values()) { p.alive = false; p.air = false; p.healAt = 0; p.veh = 0; }
    this.broadcast({ t: 'br', ev: 'wait', ms });
    this.broadcast({ t: 'loot', all: [] });
  }
  randomLand(minGap) { // 물·건물이 아닌 땅 위 아무 곳
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * MAPS[this.map].land * 0.85, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (isBlockedAt(x, z) || groundAt(x, z, true) < 1) continue;
      let ok = true;
      for (const o of this.players.values()) if (o.alive && Math.hypot(o.x - x, o.z - z) < minGap) { ok = false; break; }
      if (ok || k > 40) return [x, z];
    }
    return [0, 0];
  }
  brBegin(now) {
    // 봇 채우기
    const bots = [...this.players.values()].filter((p) => p.bot);
    const want = Math.max(0, BR.total - this.humans());
    while (bots.length > want) this.removePlayer(bots.pop());
    while (bots.length < want) {
      const used = new Set([...this.players.values()].map((p) => p.name));
      const nm = BOT_NAMES.map((n) => '봇 ' + n).find((n) => !used.has(n)) || '봇 ' + nextId;
      const b = this.addPlayer(nm, null, 0, true); b.team = b.id;
      bots.push(b);
    }
    // 아이템 뿌리기
    this.loot = []; this.nades = []; this.smokes = [];
    const wList = [];
    for (const k in BR.wWeight) for (let i = 0; i < BR.wWeight[k]; i++) wList.push(+k);
    for (const [x, y, z] of MAPS[this.map].loot) {
      const r = Math.random();
      if (r < 0.1) continue;
      let k, v;
      if (r < 0.56) { k = 0; v = wList[Math.floor(Math.random() * wList.length)]; }
      else if (r < 0.7) { k = 1; v = Math.random() < 0.6 ? 50 : 100; }
      else if (r < 0.83) { k = 2; v = Math.floor(Math.random() * 3); }
      else { k = 3; v = 1; }
      this.loot.push({ id: this.lootId++, k, v, x, y, z });
    }
    this.zone = { stage: 0, cx: 0, cz: 0, r: BR.r0, nx: 0, nz: 0, nr: BR.r0, shrinking: false, until: 0, fx: 0, fz: 0, fr: BR.r0, t0: 0 };
    this.nextZone(now);
    this.vehs = (MAPS[this.map].veh || []).map(([x, z, y, yaw], i) => ({ id: i + 1, x, y, z, yaw, driver: 0, px: x, pz: z }));
    this.air = null; this.mood = Math.random() < 0.5 ? 0 : Math.random() < 0.6 ? 1 : 2; // 날씨: 맑음·노을·안개
    this.phase = 'live'; this.zoneHitAt = now + 1000;
    this.calmUntil = now + 28000; // 처음 28초는 봇이 싸우지 않고 아이템부터 줍는다
    for (const p of this.players.values()) { p.k = 0; p.d = 0; p.alive = false; }
    const spots = MAPS[this.map].loot.slice().sort(() => Math.random() - 0.5), usedSpots = [];
    for (const p of this.players.values()) {
      let x, z;
      if (p.bot && spots.length) { // 봇은 아이템 근처로, 서로 떨어져서 내려옴
        let s = spots.pop();
        for (let k = 0; k < 60 && spots.length && usedSpots.some((u) => Math.hypot(u[0] - s[0], u[2] - s[2]) < 60); k++) s = spots.pop();
        usedSpots.push(s);
        const c = nearestFree(cellOf(s[0] + 1.5, s[2] + 1.5)); x = cellX(c); z = cellZ(c);
      }
      else [x, z] = this.randomLand(25);
      const g = groundAt(x, z);
      p.veh = 0;
      Object.assign(p, { x, z, y: g + BR.dropH, yaw: Math.atan2(x, z), pitch: -0.5, hp: 100, alive: true, air: true, prim: 0, side: W_PISTOL, armor: 0, nades: [0, 0, 0], med: 0, healAt: 0, w: W_PISTOL, c: false, protUntil: 0, blindUntil: 0, acting: false });
      p.hist.length = 0;
      if (p.bot) { p.path = []; p.pathAt = 0; p.seen = 0; p.goal = null; p.goalAt = 0; p.stuckAt = now + 3000; p.lx = x; p.lz = z; p.y = g + BR.dropH * (0.5 + Math.random() * 0.4); botInit(this, p); }
    }
    this.brTotal = this.aliveAll();
    this.rosterDirty = true;
    this.broadcast({ t: 'br', ev: 'start', n: this.brTotal, mood: this.mood });
    this.broadcast({ t: 'loot', all: this.loot.map(lootWire) });
    for (const p of this.players.values()) { this.broadcast({ t: 'spawn', id: p.id, p: [r2(p.x), r2(p.y), r2(p.z)], yaw: r3(p.yaw), drop: 1 }); this.sendInv(p); }
  }
  nextZone(now) { // 다음 안전 구역을 정함 (지금 구역 안쪽, 섬 위)
    const z = this.zone, st = BR.zones[z.stage];
    if (!st) { z.until = now + 3600e3; z.nx = z.cx; z.nz = z.cz; z.nr = z.r; return; }
    z.nr = z.r * st[2];
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * (z.r - z.nr) * 0.85;
      z.nx = z.cx + Math.cos(a) * d; z.nz = z.cz + Math.sin(a) * d;
      if (Math.hypot(z.nx, z.nz) < MAPS[this.map].land * 0.72 && groundAt(z.nx, z.nz, true) > 1.2) break;
    }
    z.shrinking = false; z.until = now + st[0] * 1000 * BR_SCALE;
  }
  tickZone(now) {
    const z = this.zone, st = BR.zones[z.stage];
    if (!st) return;
    if (!z.shrinking) {
      if (now < z.until) return;
      z.shrinking = true; z.fx = z.cx; z.fz = z.cz; z.fr = z.r; z.t0 = now; z.until = now + st[1] * 1000 * BR_SCALE;
      this.broadcast({ t: 'br', ev: 'shrink', stage: z.stage });
    }
    const f = clamp((now - z.t0) / (z.until - z.t0), 0, 1);
    z.cx = z.fx + (z.nx - z.fx) * f; z.cz = z.fz + (z.nz - z.fz) * f; z.r = z.fr + (z.nr - z.fr) * f;
    if (f >= 1) { z.stage++; this.nextZone(now); this.broadcast({ t: 'br', ev: 'zone', stage: z.stage }); if (z.stage < BR.zones.length - 1) this.airDrop(now); } // 구역이 줄 때마다 보급 상자
  }
  lootAdd(k, v, x, y, z) { const it = { id: this.lootId++, k, v, x, y, z }; this.loot.push(it); this.broadcast({ t: 'loot', add: [lootWire(it)] }); return it; }
  lootTake(it) { const i = this.loot.indexOf(it); if (i >= 0) this.loot.splice(i, 1); this.broadcast({ t: 'loot', rm: [it.id] }); }
  // 지나가면 저절로 줍는 것: 빈 손 주무기, 기본 권총보다 나은 보조무기, 방탄복, 투척 무기, 치료 키트
  autoTake(p, it) {
    if (it.k === 0) {
      const W = WEAPONS[it.v];
      if (W.slot === 'prim' && !p.prim) { p.prim = it.v; p.w = it.v; return true; }
      if (W.slot === 'side' && p.side === W_PISTOL) { p.side = it.v; if (!p.prim) p.w = it.v; return true; }
      return false;
    }
    if (it.k === 1) { if (p.armor >= it.v) return false; p.armor = it.v; return true; }
    if (it.k === 2) { if (p.nades[it.v] >= 2) return false; p.nades[it.v]++; return true; }
    if (p.med >= 3) return false;
    p.med++; return true;
  }
  tickLoot() {
    if (!this.loot.length) return;
    for (const p of this.players.values()) {
      if (!p.alive || p.air) continue;
      for (let i = this.loot.length - 1; i >= 0; i--) {
        const it = this.loot[i];
        if (Math.abs(it.x - p.x) > 1.3 || Math.abs(it.z - p.z) > 1.3 || Math.abs(it.y - p.y) > 2 || !this.autoTake(p, it)) continue;
        this.loot.splice(i, 1);
        this.broadcast({ t: 'loot', rm: [it.id] });
        this.sendInv(p); this.send(p, { t: 'pickup', k: it.k, v: it.v });
      }
    }
  }
  useLoot(p) { // 가까운 무기와 지금 든 무기를 바꿈
    if (!p.alive || this.phase !== 'live') return;
    let best = null, bd = 2.2;
    for (const it of this.loot) { if (it.k !== 0 || Math.abs(it.y - p.y) > 2) continue; const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < bd) { bd = d; best = it; } }
    if (!best) return;
    const W = WEAPONS[best.v], old = p[W.slot];
    if (old === best.v) return;
    p[W.slot] = best.v; p.w = best.v;
    this.lootTake(best);
    if (old && old !== W_PISTOL) this.lootAdd(0, old, best.x, best.y, best.z);
    this.sendInv(p); this.send(p, { t: 'pickup', k: 0, v: best.v });
  }
  // ── 탈것 ──
  vehToggle(p) { // 가까운 빈 차에 타거나, 타고 있으면 내림
    if (!p.alive || this.phase !== 'live' || p.air) return;
    if (p.veh) { this.vehLeave(p); this.send(p, { t: 'veh', id: 0 }); return; }
    let best = null, bd = 3.8;
    for (const v of this.vehs) { if (v.driver) continue; const d = Math.hypot(v.x - p.x, v.z - p.z); if (d < bd) { bd = d; best = v; } }
    if (!best) return;
    best.driver = p.id; best.px = best.x; best.pz = best.z; p.veh = best.id; p.healAt = 0;
    this.send(p, { t: 'veh', id: best.id, x: best.x, z: best.z, yaw: best.yaw });
  }
  vehLeave(p) { if (!p.veh) return; const v = this.vehs.find((q) => q.id === p.veh); if (v) v.driver = 0; p.veh = 0; }
  tickVehs(now, dt) { // 달리는 차에 치이면 다침
    for (const v of this.vehs) {
      const sp = Math.hypot(v.x - v.px, v.z - v.pz) / dt; v.px = v.x; v.pz = v.z;
      if (!v.driver || sp < 8 || sp > 40) continue;
      const drv = this.players.get(v.driver);
      if (!drv || !drv.alive) { v.driver = 0; continue; }
      for (const p of [...this.players.values()]) {
        if (p === drv || !p.alive || p.air || p.veh || now < (p.rkAt || 0) || Math.hypot(p.x - v.x, p.z - v.z) > 1.9 || Math.abs(p.y - v.y) > 2) continue;
        p.rkAt = now + 1200;
        this.damage(drv, p, Math.round(Math.min(100, 25 + sp * 4)), false, VEH_WEAPON, now);
      }
    }
  }
  // ── 보급 상자 ──
  airDrop(now) {
    const z = this.zone;
    let x = z.nx, zz = z.nz;
    for (let k = 0; k < 25; k++) { const a = Math.random() * Math.PI * 2, r = Math.random() * Math.max(10, z.nr * 0.7); x = z.nx + Math.cos(a) * r; zz = z.nz + Math.sin(a) * r; if (!isBlockedAt(x, zz) && groundAt(x, zz, true) > 1.2) break; }
    const g = groundAt(x, zz);
    this.air = { x, z: zz, y: g + 150, g, landed: false, until: 0 };
    this.broadcast({ t: 'br', ev: 'air', x: r2(x), z: r2(zz) });
  }
  tickAir(now, dt) {
    const a = this.air;
    if (!a) return;
    if (a.landed) { if (now >= a.until) this.air = null; return; }
    a.y -= 8 * dt;
    if (a.y > a.g) return;
    a.y = a.g; a.landed = true; a.until = now + 100000;
    const items = [[0, BR.airLoot[Math.floor(Math.random() * BR.airLoot.length)]], [1, 100], [3, 1], [3, 1], [2, 0], [2, 1]];
    items.forEach(([k, v], i) => { const an = (i / items.length) * Math.PI * 2; this.lootAdd(k, v, r2(a.x + Math.cos(an) * 1.6), r2(a.g), r2(a.z + Math.sin(an) * 1.6)); });
    this.broadcast({ t: 'br', ev: 'airland', x: r2(a.x), z: r2(a.z) });
  }
  brDeath(to, now) { // 가진 것을 그 자리에 떨어뜨리고 순위를 알려 줌
    this.vehLeave(to);
    const drop = (k, v, i) => { const a = i * 1.3; this.lootAdd(k, v, r2(to.x + Math.cos(a) * 0.9), r2(to.air ? groundAt(to.x, to.z) : to.y), r2(to.z + Math.sin(a) * 0.9)); };
    let i = 0;
    if (to.prim) drop(0, to.prim, i++);
    if (to.side !== W_PISTOL) drop(0, to.side, i++);
    if (to.armor >= 30) drop(1, to.armor >= 75 ? 100 : 50, i++);
    to.nades.forEach((c, k) => { if (c > 0) drop(2, k, i++); });
    if (to.med > 0) drop(3, 1, i++);
    to.prim = 0; to.side = W_PISTOL; to.armor = 0; to.nades = [0, 0, 0]; to.med = 0; to.healAt = 0; to.air = false;
    const left = this.aliveAll();
    this.send(to, { t: 'rank', n: left + 1, of: this.brTotal });
    if (left <= (this.brTotal > 1 ? 1 : 0)) this.endMatch(now);
  }
  tickBR(now, dt) {
    if (this.phase === 'wait') { if (now >= this.phaseEnd && this.humans() > 0) this.brBegin(now); return; }
    for (const p of this.players.values()) {
      if (p.bot) botTick(this, p, dt, now);
      if (p.healAt && now >= p.healAt) { p.healAt = 0; if (p.alive && p.med > 0) { p.med--; p.hp = Math.min(100, p.hp + BR.heal); this.sendInv(p); this.send(p, { t: 'heal', on: 0, done: 1 }); } }
    }
    this.tickNades(now, dt);
    this.tickLoot();
    this.tickZone(now);
    this.tickVehs(now, dt);
    this.tickAir(now, dt);
    if (now >= this.zoneHitAt) { // 구역 밖 피해 (1초마다)
      this.zoneHitAt = now + 1000;
      const z = this.zone, dps = (BR.zones[Math.min(z.stage, BR.zones.length - 1)] || [0, 0, 0, 16])[3];
      for (const p of [...this.players.values()]) {
        if (!p.alive || p.air || Math.hypot(p.x - z.cx, p.z - z.cz) <= z.r) continue;
        p.hp = Math.max(0, p.hp - dps);
        this.send(p, { t: 'hit', by: 0, to: p.id, dmg: dps, head: false, hp: p.hp, ar: p.armor, ax: r2(z.cx), az: r2(z.cz), zone: 1 });
        if (p.hp > 0) continue;
        p.alive = false; p.d++;
        this.broadcast({ t: 'kill', by: p.id, to: p.id, w: ZONE_WEAPON, head: false });
        this.rosterDirty = true;
        this.brDeath(p, now);
        if (this.state === 'end') return;
      }
    }
    if (this.aliveAll() <= (this.brTotal > 1 ? 1 : 0)) this.endMatch(now);
  }
  endMatch(now) {
    if (this.state === 'end') return;
    this.state = 'end'; this.resetAt = now + END_MS;
    let winner = this.score[0] === this.score[1] ? -1 : this.score[0] > this.score[1] ? 0 : 1;
    if (this.mode === 'br') { winner = -1; for (const p of this.players.values()) if (p.alive) winner = p.id; } // 생존전: 마지막 생존자의 번호
    this.broadcast(this.roster());
    this.broadcast({ t: 'end', winner, score: this.score, next: END_MS });
  }
  restart(now) {
    this.state = 'play'; this.score = [0, 0]; this.endsAt = now + MATCH_MS;
    if (this.rotate) { this.map = (this.map + 1) % ARENA_MAPS; useMap(this); this.broadcast({ t: 'map', map: this.map }); } // 경기마다 맵 교대
    this.nades = []; this.smokes = []; this.drops = [];
    for (const p of this.players.values()) { p.k = 0; p.d = 0; }
    this.rosterDirty = true;
    this.broadcast({ t: 'start' });
    if (this.mode === 'bomb') { this.attack = 0; this.roundNo = 0; this.startRound(now); return; }
    if (this.mode === 'br') { this.brWait(now, 7000); return; }
    for (const p of this.players.values()) this.spawn(p, now);
  }
  tick(now, dt) {
    useMap(this);
    if (this.state === 'end') {
      if (now >= this.resetAt) this.restart(now);
    } else if (this.mode === 'bomb') {
      this.tickBomb(now, dt);
    } else if (this.mode === 'br') {
      this.tickBR(now, dt);
    } else {
      if (now >= this.endsAt) this.endMatch(now);
      this.tickNades(now, dt);
      for (const p of this.players.values()) {
        if (!p.alive && p.respawnAt && now >= p.respawnAt) { p.respawnAt = 0; this.spawn(p, now); }
        if (p.bot && this.state === 'play') botTick(this, p, dt, now);
      }
    }
    const list = [];
    for (const p of this.players.values()) {
      p.hist.push({ t: now, x: p.x, y: p.y, z: p.z });
      if (p.hist.length > 24) p.hist.shift();
      list.push([p.id, r2(p.x), r2(p.y), r2(p.z), r3(p.yaw), r3(p.pitch), p.hp, p.w, p.alive ? 1 : 0, now < p.protUntil ? 1 : 0, p.c ? 1 : 0]);
    }
    if (this.rosterDirty) { this.rosterDirty = false; this.broadcast(this.roster()); }
    const bm = this.bomb, zn = this.zone;
    this.broadcast({
      t: 'snap', st: now, p: list, sc: this.mode === 'br' ? [this.aliveAll(), this.brTotal] : this.score,
      tl: this.state !== 'play' ? 0 : Math.max(0, (this.mode === 'bomb' || (this.mode === 'br' && this.phase === 'wait') ? this.phaseEnd : this.mode === 'br' ? (zn ? zn.until : now) : this.endsAt) - now),
      v: this.mode === 'br' && this.vehs.length ? this.vehs.map((q) => [q.id, r2(q.x), r2(q.y), r2(q.z), r3(q.yaw), q.driver]) : undefined,
      ad: this.air ? [r2(this.air.x), r2(this.air.y), r2(this.air.z), this.air.landed ? 1 : 0] : undefined,
      z: this.mode === 'br' && zn && this.phase === 'live' ? [r2(zn.cx), r2(zn.cz), r2(zn.r), r2(zn.nx), r2(zn.nz), r2(zn.nr), zn.shrinking ? 1 : 0, zn.stage] : undefined,
      ph: this.phase, at: this.attack, rn: this.roundNo,
      b: this.mode === 'bomb' ? [bm.state, r2(bm.x), r2(bm.z), bm.carrier, this.actor, r2(this.actProg)] : null,
      n: this.nades.length ? this.nades.map((n) => [n.id, n.k, r2(n.x), r2(n.y), r2(n.z)]) : undefined,
      d: this.drops.length ? this.drops.map((d) => [d.id, d.wi, r2(d.x), r2(d.z)]) : undefined,
    });
  }
}

// ───────────── 봇 AI ─────────────
function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function canSee(room, a, b) {
  const o = [a.x, a.y + PLAYER.eye, a.z], t = [b.x, b.y + (b.c ? 0.7 : 1.1), b.z];
  const dx = t[0] - o[0], dy = t[1] - o[1], dz = t[2] - o[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  if (rayWorld(o, [dx / len, dy / len, dz / len], len) < len - 0.01) return false;
  for (const s of room.smokes) if (segHitsSphere(o, t, [s.x, s.y, s.z], s.r)) return false; // 연막 너머는 못 봄
  return true;
}
function botMove(b, dx, dz, speed, dt) {
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return false;
  const nx = b.x + (dx / len) * speed * dt, nz = b.z + (dz / len) * speed * dt;
  let moved = false;
  if (!isBlockedAt(nx, b.z) && !stepBlocked(b.x, b.z, nx, b.z)) { b.x = nx; moved = true; }
  if (!isBlockedAt(b.x, nz) && !stepBlocked(b.x, b.z, b.x, nz)) { b.z = nz; moved = true; }
  return moved;
}
// 난이도별 봇 능력: 반응(ms), 조준 오차(rad), 몸 돌리는 속도, 피해 배율, 시야각(cos), 엄폐·앉아 쏘기 여부
const LV = [
  { name: '쉬움', react: 720, err: 0.115, turn: 5, dmg: 0.42, fov: 0.4, smart: false },
  { name: '보통', react: 520, err: 0.075, turn: 6.5, dmg: 0.6, fov: 0.2, smart: true },
  { name: '어려움', react: 370, err: 0.05, turn: 8.5, dmg: 0.78, fov: 0, smart: true },
  { name: '매우 어려움', react: 250, err: 0.032, turn: 11, dmg: 0.95, fov: -0.2, smart: true },
];
const PREF = { melee: 2, side: 12, smg: 12, sg: 6, ar: 24, sr: 46, mg: 26 }; // 무기 종류별로 유지하려는 거리
function botInit(room, b) { // 난이도에 봇마다 조금씩 차이를 둠
  const L = LV[room.botLv], k = 0.85 + Math.random() * 0.3;
  Object.assign(b, { react: L.react * k, err: L.err * k, turn: L.turn / k, magW: -1, mag: 0, reloadUntil: 0, aimT: 0, tgtId: 0, lastSeen: null, alert: null, cover: null, crouchAt: 0, hitBy: null, shareAt: 0 });
}
function lineFree(x0, z0, x1, z1) { // 격자에서 두 점 사이가 뚫려 있는지
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.4);
  let px = x0, pz = z0;
  for (let i = 1; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n; if (isBlockedAt(x, z) || stepBlocked(px, pz, x, z)) return false; px = x; pz = z; }
  return true;
}
function botFollow(b, tx, tz, dt, now, speed) {
  if (now >= b.pathAt) {
    const d = Math.hypot(tx - b.x, tz - b.z);
    if (d > 55) { tx = b.x + ((tx - b.x) / d) * 50; tz = b.z + ((tz - b.z) / d) * 50; } // 먼 곳은 중간 지점까지만 길을 찾음
    b.path = findPath(b.x, b.z, tx, tz); b.pathAt = now + 900 + Math.random() * 500;
  }
  const p = b.path;
  while (p.length && Math.hypot(p[0][0] - b.x, p[0][1] - b.z) < 0.35) p.shift();
  if (!p.length) return [0, 0];
  let k = 0; // 보이는 가장 먼 지점으로 곧장 감 (격자 따라 지그재그로 걷지 않게)
  while (k + 1 < p.length && k < 9 && lineFree(b.x, b.z, p[k + 1][0], p[k + 1][1])) k++;
  if (k) p.splice(0, k);
  const dx = p[0][0] - b.x, dz = p[0][1] - b.z;
  botMove(b, dx, dz, speed, dt);
  return [dx, dz];
}
function findCover(room, b, e, now) { // 적에게서 가려지는 가까운 자리
  const eye = [e.x, e.y + PLAYER.eye, e.z];
  let best = null, bd = 1e9;
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 7, x = b.x + Math.cos(a) * r, z = b.z + Math.sin(a) * r;
    if (isBlockedAt(x, z)) continue;
    const dx = x - eye[0], dy = groundAt(x, z) + 1.1 - eye[1], dz = z - eye[2], len = Math.hypot(dx, dy, dz);
    if (rayWorld(eye, [dx / len, dy / len, dz / len], len) >= len - 0.3) continue; // 적에게 보이는 자리
    if (r < bd && lineFree(b.x, b.z, x, z)) { bd = r; best = { x, z }; }
  }
  return best ? { x: best.x, z: best.z, ok: true, until: now + 2600 } : { ok: false, until: now + 1200 };
}
// 폭탄전에서 봇이 향할 곳 → { x, z, r(도착 반경), act(도착하면 설치/해체), must(다른 일보다 먼저) }
function botGoal(room, b, now) {
  const bm = room.bomb;
  if (b.team === room.attack) {
    if (bm.state === 'planted') return { x: bm.x + b.gx, z: bm.z + b.gz, r: 1.5 };
    if (bm.state === 'dropped') return { x: bm.x, z: bm.z, r: 0.3, must: true };
    const s = SITES[room.botSite];
    if (bm.carrier === b.id) return { x: s.x + b.gx * 0.4, z: s.z + b.gz * 0.4, r: 0.9, act: siteAt(b.x, b.z) >= 0, must: true };
    const c = room.players.get(bm.carrier);
    if (c && !c.bot && c.alive) return { x: c.x + b.gx * 0.6, z: c.z + b.gz * 0.6, r: 2.2 };
    return { x: s.x + b.gx, z: s.z + b.gz, r: 1.6 };
  }
  if (bm.state === 'planted') return { x: bm.x, z: bm.z, r: 1.2, act: true, must: true };
  // 공격팀이 한 명 남았거나 시간이 얼마 안 남으면 찾아 나섬
  if (room.aliveCount(room.attack) <= 1 || room.phaseEnd - now < 40000) {
    let near = null, nd = 1e9;
    for (const e of room.players.values()) { if (e.team === b.team || !e.alive) continue; const d = Math.hypot(e.x - b.x, e.z - b.z); if (d < nd) { nd = d; near = e; } }
    if (near) return { x: near.x, z: near.z, r: 3 };
  }
  const s = SITES[b.id % 2];
  return { x: s.x + b.gx * 0.8, z: s.z + b.gz * 0.8, r: 1.4 };
}
function botTick(room, b, dt, now) {
  if (!b.alive) return;
  const br = room.mode === 'br', L = LV[room.botLv];
  if (b.air) { // 낙하산으로 내려오는 중
    const g = groundAt(b.x, b.z);
    b.y -= 9 * dt; b.yaw += dt * 0.25;
    if (b.y <= g) { b.y = g; b.air = false; b.stuckAt = now + 3000; }
    return;
  }
  b.y = floorAt(b.x, b.z);
  // 무기와 탄창
  const wi = b.prim || b.side, W = WEAPONS[wi];
  if (b.magW !== wi) { b.magW = wi; b.mag = W.mag; b.reloadUntil = 0; }
  if (b.reloadUntil && now >= b.reloadUntil) { b.reloadUntil = 0; b.mag = W.mag; }
  b.w = wi;
  // ── 보기: 시야각 안에서 가려지지 않은 적 (쫓던 적·나를 쏜 적은 방향과 상관없이 알아챔) ──
  let vis = null, vs = 1e9, vd = 0, near = null, nd = 1e9;
  const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw), sight = br ? 60 : 70;
  const hit = b.hitBy && now - b.hitBy.t < 3000 ? b.hitBy.id : 0;
  for (const e of room.players.values()) {
    if (e === b || e.team === b.team || !e.alive) continue;
    const dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz);
    if (d < nd) { nd = d; near = e; }
    if (now < b.blindUntil || (br && (now < room.calmUntil || e.air || e.y - groundAt(e.x, e.z) > 9))) continue; // 생존전: 시작 직후와 내려오는 중인 사람은 쏘지 않음
    if (d > (br && e.bot ? 15 : sight)) continue; // 생존전: 봇끼리는 가까울 때만 싸움
    const known = e.id === b.tgtId || e.id === hit;
    if (!known && d > 7 && (dx * fx + dz * fz) / d < L.fov) continue;
    const score = d * (known ? 0.6 : 1);
    if (score < vs && canSee(room, b, e)) { vs = score; vis = e; vd = d; }
  }
  if (vis) {
    // ── 교전 ──
    const dx = vis.x - b.x, dz = vis.z - b.z;
    if (b.tgtId !== vis.id) { b.tgtId = vis.id; b.seen = now; b.aimT = 0; }
    b.aimT += dt; b.lastSeen = { x: vis.x, z: vis.z, t: now }; b.alert = null; b.acting = false;
    if (!br && now >= b.shareAt) { // 본 것을 가까운 팀원에게 알림
      b.shareAt = now + 900;
      for (const t of room.players.values()) if (t.bot && t !== b && t.team === b.team && t.alive && !t.tgtId && Math.hypot(t.x - b.x, t.z - b.z) < 45 && !(t.alert && now - t.alert.t < 1500)) t.alert = { x: vis.x, z: vis.z, t: now };
    }
    const wantYaw = Math.atan2(-dx, -dz), diff = angDiff(b.yaw, wantYaw);
    b.yaw += clamp(diff, -b.turn * dt, b.turn * dt);
    b.pitch = Math.atan2(vis.y + (vis.c ? 0.7 : 1.1) - (b.y + PLAYER.eye), vd || 1);
    // 움직임: 체력이 낮거나 장전 중이면 엄폐, 아니면 무기에 맞는 거리를 유지하며 좌우로 움직임
    const pref = PREF[W.cat] || 15, hurt = b.hp < 38 || b.reloadUntil > 0;
    let moved = false;
    if (hurt && L.smart) {
      if (!b.cover || now >= b.cover.until) b.cover = findCover(room, b, vis, now);
      if (b.cover.ok) { moved = true; if (Math.hypot(b.cover.x - b.x, b.cover.z - b.z) > 0.5) botMove(b, b.cover.x - b.x, b.cover.z - b.z, PLAYER.speed * 1.05, dt); }
    }
    if (!moved) {
      if (vd > pref * 1.6) botFollow(b, vis.x, vis.z, dt, now, PLAYER.speed * 0.8);
      else {
        if (now >= b.strafeAt) { b.strafe = -b.strafe; b.strafeAt = now + 500 + Math.random() * 1300; }
        const back = vd < pref * 0.45 && W.cat !== 'sg' && !W.melee ? -0.7 : W.cat === 'sg' && vd > 5 ? 0.7 : 0; // 너무 가까우면 물러나고, 샷건은 붙음
        const hold = W.cat === 'sr' && b.aimT < 1.4; // 저격총은 멈춰서 조준
        if (!hold && !botMove(b, -dz * b.strafe + dx * back, dx * b.strafe + dz * back, PLAYER.speed * 0.55, dt)) b.strafe = -b.strafe;
      }
    }
    if (now >= b.crouchAt) { b.crouchAt = now + 1500 + Math.random() * 2500; b.c = L.smart && vd > 14 && Math.random() < 0.3; }
    if (now >= b.nadeAt && now - b.seen > b.react && vd > 9 && vd < 24) { // 가끔 수류탄·섬광탄을 던짐
      b.nadeAt = now + 2500;
      const k = b.nades[0] ? 0 : b.nades[2] ? 2 : -1;
      if (k >= 0 && Math.random() < 0.35) { room.throwNade(b, k, dirFrom(wantYaw, 0.16 + vd * 0.011), now); b.nadeAt = now + 9000; }
    }
    // 사격: 탄창을 다 쓰면 장전, 멀면 끊어 쏘고, 오래 겨눌수록 정확해짐
    if (b.reloadUntil) return;
    if (b.mag <= 0 && !W.melee) { b.reloadUntil = now + W.reload; b.cover = null; return; }
    const gap = W.auto || W.burst ? W.interval : W.interval + 110 + Math.random() * 170;
    if (now - b.seen > b.react + (br ? 250 : 0) && Math.abs(diff) < 0.22 && now >= b.pauseUntil && now - b.lastShot >= gap && vd < (W.melee ? 2.2 : W.range)) {
      b.lastShot = now;
      const h = vis.hist, tv = h.length > 3 ? Math.hypot(h[h.length - 1].x - h[h.length - 4].x, h[h.length - 1].z - h[h.length - 4].z) / 0.15 : 0; // 상대가 움직이는 속도
      const e = b.err * Math.max(0.45, 1 - b.aimT / 1.6) * (1 + Math.min(1, tv / 7) * 0.7) * (W.slot === 'side' ? 1.15 : 1) * (W.cat === 'sr' ? 0.45 : 1) * (b.c ? 0.8 : 1) * (br ? 1.2 : 1);
      const dirs = [];
      const ay = wantYaw + (Math.random() + Math.random() - 1) * e * 1.6, ap = b.pitch + (Math.random() + Math.random() - 1) * e * 1.6;
      for (let i = 0; i < W.pellets; i++) dirs.push(W.pellets > 1 ? dirFrom(ay + (Math.random() - 0.5) * W.spread * 1.6, ap + (Math.random() - 0.5) * W.spread * 1.6) : dirFrom(ay, ap));
      room.fire(b, dirs, wi, now, now);
      if (!W.melee) b.mag--;
      const far = vd > 30, auto = W.auto || W.burst;
      if (++b.burst >= (auto ? (far ? 3 : 5) + Math.floor(Math.random() * 3) : 1)) { b.burst = 0; b.pauseUntil = now + (auto ? (far ? 520 : 260) + Math.random() * 450 : 0); }
    }
    return;
  }
  // ── 적이 안 보일 때 ──
  b.tgtId = 0; b.aimT = 0; b.seen = 0; b.pitch *= 0.8; b.c = false; b.cover = null;
  if (!b.reloadUntil && !W.melee && b.mag < W.mag * 0.5) b.reloadUntil = now + W.reload; // 여유 있을 때 장전
  const face = (mv) => { if (mv[0] || mv[1]) b.yaw += clamp(angDiff(b.yaw, Math.atan2(-mv[0], -mv[1])), -5 * dt, 5 * dt); };
  const g = room.mode === 'bomb' ? botGoal(room, b, now) : null;
  // 방금 놓친 적이 있던 곳, 총소리가 난 곳을 살핌 (폭탄을 들었거나 해체하러 갈 때는 임무가 먼저)
  const ls = b.lastSeen && now - b.lastSeen.t < 5000 ? b.lastSeen : null;
  const al = b.alert && now - b.alert.t < 7000 && !(g && b.team !== room.attack && Math.hypot(b.alert.x - b.x, b.alert.z - b.z) > 30) ? b.alert : null; // 수비 봇은 먼 총소리에 자리를 비우지 않음
  const poi = ls || al;
  if (poi && !(g && g.must) && !(br && Math.hypot(b.x - room.zone.cx, b.z - room.zone.cz) > room.zone.r - 4)) {
    const d = Math.hypot(poi.x - b.x, poi.z - b.z);
    if (b.reloadUntil && ls && L.smart) { b.yaw += clamp(angDiff(b.yaw, Math.atan2(-(poi.x - b.x), -(poi.z - b.z))), -5 * dt, 5 * dt); return; } // 장전이 끝날 때까지 숨어서 기다림
    if (ls && now >= b.nadeAt && d > 8 && d < 26 && b.nades[0] && L.smart) { // 엄폐 뒤로 수류탄
      b.nadeAt = now + 6000;
      if (Math.random() < 0.5) { room.throwNade(b, 0, dirFrom(Math.atan2(-(poi.x - b.x), -(poi.z - b.z)), 0.2 + d * 0.012), now); b.nadeAt = now + 10000; }
    }
    if (d > 2.5) { const mv = botFollow(b, poi.x, poi.z, dt, now, PLAYER.speed * 0.9); if (mv[0] || mv[1]) face(mv); else { b.lastSeen = null; b.alert = null; } }
    else { b.lastSeen = null; b.alert = null; b.yaw += dt * 2.2; }
    return;
  }
  if (br) { brBotMove(room, b, dt, now); return; }
  if (g) {
    const d = Math.hypot(g.x - b.x, g.z - b.z);
    let mv = [0, 0];
    if (d > g.r) mv = botFollow(b, g.x, g.z, dt, now, PLAYER.speed * 0.85);
    const arrived = d <= g.r || (!mv[0] && !mv[1] && d < 1.9);
    b.acting = arrived && !!g.act;
    if (mv[0] || mv[1]) face(mv);
    else if (!b.acting) b.yaw += Math.sin(now / 900 + b.id) * dt * 0.9; // 제자리 경계
    return;
  }
  face(near ? botFollow(b, near.x, near.z, dt, now, PLAYER.speed * 0.8) : botFollow(b, 0, b.team ? 6 : -6, dt, now, PLAYER.speed * 0.8));
}

// 생존전 봇: 구역 안으로 이동 → 쓸 만한 아이템 줍기 → 돌아다니기
function botWants(b, it) {
  if (it.k === 0) { const W = WEAPONS[it.v]; return W.slot === 'prim' ? !b.prim || W.price > WEAPONS[b.prim].price + 500 : b.side === W_PISTOL && !b.prim; }
  if (it.k === 1) return b.armor < it.v;
  if (it.k === 2) return b.nades[it.v] < 1;
  return b.med < 2;
}
function brBotMove(room, b, dt, now) {
  const z = room.zone;
  if (b.hp < 55 && b.med > 0 && !b.healAt) b.healAt = now + BR.healMs;
  const soon = z.shrinking || z.until - now < 12000;
  const tx = soon ? z.nx : z.cx, tz = soon ? z.nz : z.cz, tr = soon ? z.nr : z.r;
  const out = Math.hypot(b.x - tx, b.z - tz) > Math.max(3, tr * 0.85);
  const g = b.goal;
  const lost = g && g.k === 'loot' && !room.loot.some((it) => it.id === g.id);
  if (!g || lost || now >= b.goalAt || (out && g.k !== 'zone') || Math.hypot(g.x - b.x, g.z - b.z) < 1.2) {
    let ng = null;
    if (out) { const a = Math.random() * 6.28, r = Math.random() * tr * 0.5; ng = { x: tx + Math.cos(a) * r, z: tz + Math.sin(a) * r, k: 'zone' }; }
    else {
      let best = null, bd = b.prim ? 35 : 120;
      for (const it of room.loot) { const d = Math.hypot(it.x - b.x, it.z - b.z); if (d < bd && Math.abs(it.y - groundAt(it.x, it.z)) < 1 && botWants(b, it)) { bd = d; best = it; } }
      if (best) ng = { x: best.x, z: best.z, k: 'loot', id: best.id };
      else { const a = Math.random() * 6.28, r = Math.random() * Math.max(6, tr * 0.7); ng = { x: tx + Math.cos(a) * r, z: tz + Math.sin(a) * r, k: 'roam' }; }
    }
    if (g && g.k === 'loot' && !lost && Math.hypot(g.x - b.x, g.z - b.z) < 2.2) room.useLoot(b); // 더 좋은 무기로 바꿈
    b.goal = ng; b.goalAt = now + (ng.k === 'roam' ? 9000 : 14000); b.pathAt = 0;
  }
  const mv = botFollow(b, b.goal.x, b.goal.z, dt, now, PLAYER.speed * (out ? 1.15 : 0.9));
  if (mv[0] || mv[1]) b.yaw += clamp(angDiff(b.yaw, Math.atan2(-mv[0], -mv[1])), -5 * dt, 5 * dt);
  else b.yaw += Math.sin(now / 900 + b.id) * dt * 0.9;
  if (now >= b.stuckAt) { // 2.5초 동안 거의 못 움직였으면 다른 곳으로
    if (Math.hypot(b.x - b.lx, b.z - b.lz) < 1.2) { b.goal = null; b.pathAt = 0; }
    b.lx = b.x; b.lz = b.z; b.stuckAt = now + 2500;
  }
}

// ───────────── 접속 처리 ─────────────
const num = (v) => typeof v === 'number' && Number.isFinite(v);
function cleanName(s) {
  s = String(s || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 12);
  return s || '용병' + Math.floor(100 + Math.random() * 900);
}
function initMap(r, want) { // want: 'dock' | 'town' | 그 외(번갈아)
  if (r.mode === 'br') { r.rotate = false; r.map = MAPS.findIndex((m) => m.br); return; } // 생존전은 섬 맵
  const i = MAPS.findIndex((m) => m.key === want && !m.br);
  r.rotate = i < 0;
  r.map = i < 0 ? Math.floor(Math.random() * ARENA_MAPS) : i;
}
function pickRoom(code, mode, want, lv) {
  if (code) {
    let r = rooms.get(code);
    if (!r) { r = new Room(code, false, mode); r.botLv = lv; initMap(r, want); rooms.set(code, r); } // 봇 난이도는 방을 만든 사람이 정함
    return r.humans() < (r.mode === 'br' ? BR.max : TEAM_MAX * 2) ? r : null;
  }
  for (const r of rooms.values()) if (r.isPublic && r.mode === mode && r.humans() < (mode === 'br' ? BR.max : TEAM_MAX * 2)) return r;
  let c;
  do { c = 'P' + Math.floor(1000 + Math.random() * 9000); } while (rooms.has(c));
  const r = new Room(c, true, mode);
  initMap(r, '');
  rooms.set(c, r);
  return r;
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });
const cleanPaint = (v) => (typeof v === 'string' && v.length === 3456 && /^[A-Za-z0-9+/=]+$/.test(v) ? v : ''); // 캐릭터 그림 (72 × 72칸, 16색)
wss.on('connection', (ws) => {
  let room = null, me = null, msgCount = 0, windowAt = Date.now();
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    const now = Date.now();
    if (now - windowAt > 1000) { windowAt = now; msgCount = 0; }
    if (++msgCount > 120) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (m.t === 'join') {
      if (me) return;
      const code = String(m.room || '').toUpperCase().replace(/[^A-Z0-9가-힣]/g, '').slice(0, 8);
      room = pickRoom(code, m.mode === 'tdm' ? 'tdm' : m.mode === 'br' ? 'br' : 'bomb', String(m.map || ''), m.bot >= 0 && m.bot <= 3 ? m.bot | 0 : 1);
      if (!room) return ws.send(JSON.stringify({ t: 'full' }));
      useMap(room);
      const team = room.humans(0) <= room.humans(1) ? 0 : 1;
      me = room.addPlayer(cleanName(m.name), ws, team, false);
      if (room.mode === 'br') me.team = me.id; // 생존전은 모두가 적
      me.sk = cleanSkins(m.sk, skinsFor(m.codes)); // 가진 스킨만 인정
      me.paint = cleanPaint(m.paint);
      for (const p of room.players.values()) if (p !== me && p.paint) room.send(me, { t: 'paint', id: p.id, d: p.paint }); // 먼저 있던 사람들의 그림
      if (me.paint) room.broadcast({ t: 'paint', id: me.id, d: me.paint }, me);
      room.send(me, { t: 'welcome', id: me.id, team, code: room.code, pub: room.isPublic, mode: room.mode, map: room.map, botLv: room.botLv, sk: me.sk, attack: room.attack, limit: room.mode === 'bomb' ? ROUNDS_WIN : KILL_LIMIT });
      room.balanceBots();
      room.send(me, room.roster());
      room.sendInv(me);
      if (room.mode === 'br') {
        if (room.phase === 'wait') { if (!room.phaseEnd) room.phaseEnd = now + BR.wait; room.send(me, { t: 'br', ev: 'wait', ms: Math.max(0, room.phaseEnd - now) }); }
        else { room.send(me, { t: 'loot', all: room.loot.map(lootWire) }); room.send(me, { t: 'br', ev: 'late', mood: room.mood || 0 }); } // 진행 중이면 다음 경기부터
      }
      else if (room.mode === 'tdm') room.spawn(me, now);
      else if (room.roundNo === 0) room.startRound(now);
      else if (room.phase === 'freeze') { room.spawn(me, now); room.sendInv(me); } // 그 외에는 다음 라운드부터 참가
      if (room.state === 'end') room.send(me, { t: 'end', winner: -1, score: room.score, next: Math.max(0, room.resetAt - now) });
      return;
    }
    if (m.t === 'ping') return ws.send(JSON.stringify({ t: 'pong', c: m.c }));
    if (!me) return;
    useMap(room);

    if (m.t === 'in') {
      if (!me.alive || !Array.isArray(m.p) || !Array.isArray(m.r)) return;
      const [x, y, z] = m.p, [yaw, pitch] = m.r;
      if (!num(x) || !num(y) || !num(z) || !num(yaw) || !num(pitch)) return;
      if (room.phase !== 'freeze') { // 준비 시간에는 제자리
        me.x = clamp(x, -ARENA.hx + PLAYER.r, ARENA.hx - PLAYER.r);
        me.z = clamp(z, -ARENA.hz + PLAYER.r, ARENA.hz - PLAYER.r);
        const g = groundAt(me.x, me.z);
        me.y = clamp(y, g - 0.3, g + (room.mode === 'br' ? 130 : 12));
      }
      me.yaw = yaw; me.pitch = clamp(pitch, -1.5, 1.5);
      if (room.mode === 'br') {
        me.air = !!m.a; // 낙하산으로 내려오는 중인지는 클라이언트가 알려 줌
        if (me.veh) { const v = room.vehs.find((q) => q.id === me.veh); if (v) { v.x = me.x; v.y = me.y; v.z = me.z; if (num(m.vy)) v.yaw = m.vy; } }
      }
      if (room.owns(me, m.w)) me.w = m.w;
      me.c = !!m.c;
    } else if (m.t === 'act') {
      me.acting = !!m.on;
    } else if (m.t === 'use') {
      if (room.mode === 'br') room.useLoot(me);
    } else if (m.t === 'veh') {
      if (room.mode === 'br') room.vehToggle(me);
    } else if (m.t === 'heal') {
      if (room.mode !== 'br' || !me.alive || me.med < 1 || me.hp >= 100 || me.healAt) return;
      me.healAt = now + BR.healMs; room.send(me, { t: 'heal', on: 1, ms: BR.healMs });
    } else if (m.t === 'radio') { // 정해진 문구만 팀에게 전달
      if (room.mode === 'br' || !(m.k >= 0 && m.k <= 5) || now - me.radioAt < 1200) return;
      me.radioAt = now;
      const msg = JSON.stringify({ t: 'radio', id: me.id, k: m.k | 0 });
      for (const p of room.players.values()) if (p.ws && p.team === me.team && p.ws.readyState === 1) p.ws.send(msg);
    } else if (m.t === 'team') { // 팀 바꾸기
      if (room.mode === 'br') return;
      const other = me.team ^ 1;
      if (room.humans(other) >= TEAM_MAX) return room.send(me, { t: 'note', text: '상대 팀이 가득 찼어요' });
      if (room.mode === 'tdm') { room.setTeam(me, other, now); room.balanceBots(); room.spawn(me, now); room.send(me, { t: 'note', text: '팀을 바꿨습니다' }); }
      else { me.wantTeam = me.wantTeam === other ? -1 : other; room.send(me, { t: 'note', text: me.wantTeam >= 0 ? '다음 라운드에 팀이 바뀝니다' : '팀 바꾸기를 취소했습니다' }); }
    } else if (m.t === 'buy') {
      room.buy(me, String(m.k || ''));
    } else if (m.t === 'nade') {
      const d = m.d;
      if ((m.k !== 0 && m.k !== 1 && m.k !== 2) || !Array.isArray(d) || !num(d[0]) || !num(d[1]) || !num(d[2])) return;
      const len = Math.hypot(d[0], d[1], d[2]);
      if (len > 1e-6) room.throwNade(me, m.k, [d[0] / len, d[1] / len, d[2] / len], now);
    } else if (m.t === 'shoot') {
      if (!me.alive || !room.canFight() || me.air || me.veh) return;
      me.acting = false;
      const wi = m.w;
      if (!room.owns(me, wi)) return;
      const W = WEAPONS[wi];
      if (now - me.lastShot < W.interval * 0.8 || !Array.isArray(m.d)) return;
      const dirs = [];
      for (const d of m.d.slice(0, W.pellets)) {
        if (!Array.isArray(d) || !num(d[0]) || !num(d[1]) || !num(d[2])) continue;
        const len = Math.hypot(d[0], d[1], d[2]);
        if (len > 1e-6) dirs.push([d[0] / len, d[1] / len, d[2] / len]);
      }
      if (!dirs.length) return;
      me.lastShot = now; me.w = wi;
      room.fire(me, dirs, wi, clamp(num(m.rt) ? m.rt : now, now - 500, now), now);
    }
  });
  ws.on('close', () => {
    if (!room || !me) return;
    useMap(room);
    room.removePlayer(me);
    if (room.humans() === 0) rooms.delete(room.code);
    else room.balanceBots();
  });
  ws.on('error', () => {});
});

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.2, (now - last) / 1000);
  last = now;
  for (const r of rooms.values()) r.tick(now, dt);
}, TICK_MS);
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); }
}, 25000);

server.listen(PORT, () => console.log(`SQUAD CLASH 서버 실행 중 → http://localhost:${PORT}`));
