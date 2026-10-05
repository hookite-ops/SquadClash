// 서버와 클라이언트가 함께 쓰는 맵·무기·판정 코드
import { MAPS, ARENA_MAPS, hmSample } from './maps.js';
export const ARENA = { ...MAPS[0].arena };
export const PLAYER = { r: 0.38, h: 1.75, eye: 1.6, eyeCrouch: 1.08, sprint: 1.4, speed: 6.4, jump: 7.2, gravity: 19, step: 0.5 };

// 무기표 — cat: 분류, slot: 드는 자리(melee 칼 / side 보조무기 / prim 주무기), vm: 1인칭 자세, model: 모델 종류와 옵션
// burst: 한 번 당기면 나가는 발수, spin: [처음 간격, 최고 속도 간격] (쏠수록 빨라짐), quiet: 소음기, ap: 방탄복 무시
export const WEAPONS = [
  { name: '칼', cat: 'melee', slot: 'melee', vm: 'knife', model: ['knife'], dmg: 55, head: 1, interval: 520, mag: 0, reload: 0, spread: 0, pellets: 1, range: 2.3, kick: 0, price: 0, move: 1.12, melee: true },
  { name: '권총', cat: 'side', slot: 'side', vm: 'pistol', model: ['pistol'], dmg: 27, head: 2.2, interval: 170, mag: 12, reload: 1400, spread: 0.016, pellets: 1, range: 70, kick: 0.012, price: 0 },
  { name: '쌍열 산탄총', cat: 'side', slot: 'side', vm: 'pistol', model: ['sawed'], dmg: 11, head: 1.3, interval: 420, mag: 2, reload: 1800, spread: 0.11, pellets: 10, range: 22, falloff: [4, 16], kick: 0.035, price: 250 },
  { name: '자동권총', cat: 'side', slot: 'side', vm: 'pistol', model: ['pistol', { ext: true }], dmg: 17, head: 1.9, interval: 85, mag: 15, reload: 1500, spread: 0.028, pellets: 1, range: 50, kick: 0.006, price: 450, auto: true },
  { name: '소음권총', cat: 'side', slot: 'side', vm: 'pistol', model: ['pistol', { supp: true }], dmg: 31, head: 2.4, interval: 190, mag: 13, reload: 1500, spread: 0.008, pellets: 1, range: 90, kick: 0.011, price: 500, quiet: true },
  { name: '리볼버', cat: 'side', slot: 'side', vm: 'pistol', model: ['revolver'], dmg: 58, head: 2.6, interval: 520, mag: 6, reload: 2200, spread: 0.006, pellets: 1, range: 110, kick: 0.03, price: 800 },
  { name: '속사 기관단총', cat: 'smg', slot: 'prim', vm: 'smg', model: ['smg', { compact: true }], dmg: 14, head: 1.7, interval: 62, mag: 22, reload: 1600, spread: 0.026, pellets: 1, range: 55, kick: 0.0042, price: 1000, auto: true },
  { name: '소음 기관단총', cat: 'smg', slot: 'prim', vm: 'smg', model: ['smg'], dmg: 17, head: 1.8, interval: 78, mag: 30, reload: 1800, spread: 0.017, pellets: 1, range: 75, kick: 0.004, price: 1600, auto: true, quiet: true },
  { name: '펌프 샷건', cat: 'sg', slot: 'prim', vm: 'shotgun', model: ['shotgun'], dmg: 13, head: 1.4, interval: 850, mag: 6, reload: 2300, spread: 0.075, pellets: 8, range: 40, falloff: [7, 30], kick: 0.03, price: 900 },
  { name: '자동 샷건', cat: 'sg', slot: 'prim', vm: 'shotgun', model: ['shotgun', { auto: true }], dmg: 10, head: 1.3, interval: 300, mag: 7, reload: 2400, spread: 0.085, pellets: 7, range: 32, falloff: [6, 24], kick: 0.022, price: 1900 },
  { name: '점사소총', cat: 'ar', slot: 'prim', vm: 'rifle', model: ['rifle', { burst: true, furn: 'tan' }], dmg: 23, head: 2.0, interval: 70, burst: 3, burstGap: 360, mag: 24, reload: 1900, spread: 0.009, pellets: 1, range: 120, kick: 0.005, price: 2000 },
  { name: '지정사수 소총', cat: 'ar', slot: 'prim', vm: 'rifle', model: ['rifle', { dmr: true, furn: 'olive' }], dmg: 42, head: 2.4, interval: 240, mag: 12, reload: 2000, spread: 0.004, pellets: 1, range: 160, kick: 0.016, price: 2300, zoom: 38 },
  { name: '소음소총', cat: 'ar', slot: 'prim', vm: 'rifle', model: ['rifle', { supp: true, furn: 'gray' }], dmg: 21, head: 1.95, interval: 92, mag: 30, reload: 2000, spread: 0.01, pellets: 1, range: 110, kick: 0.0052, price: 2900, auto: true, quiet: true },
  { name: '돌격소총', cat: 'ar', slot: 'prim', vm: 'rifle', model: ['rifle'], dmg: 23, head: 1.95, interval: 105, mag: 25, reload: 2100, spread: 0.012, pellets: 1, range: 140, kick: 0.0068, price: 2900, auto: true },
  { name: '경저격총', cat: 'sr', slot: 'prim', vm: 'sniper', model: ['sniper', { light: true }], dmg: 62, head: 2.0, interval: 1050, mag: 5, reload: 2300, spread: 0.002, hipSpread: 0.05, pellets: 1, range: 180, kick: 0.03, price: 1000, scope: true, zoom: 28 },
  { name: '중저격총', cat: 'sr', slot: 'prim', vm: 'sniper', model: ['sniper'], dmg: 105, head: 2.5, interval: 1400, mag: 5, reload: 2800, spread: 0.0015, hipSpread: 0.07, pellets: 1, range: 220, kick: 0.04, price: 4500, scope: true, zoom: 18, ap: true, move: 0.92 },
  { name: '경기관총', cat: 'mg', slot: 'prim', vm: 'mg', model: ['rifle', { lmg: true, furn: 'olive' }], dmg: 19, head: 1.7, interval: 88, mag: 50, reload: 2600, spread: 0.02, pellets: 1, range: 100, kick: 0.005, price: 1700, auto: true, move: 0.9 },
  { name: '중기관총', cat: 'mg', slot: 'prim', vm: 'mg', model: ['rifle', { hmg: true }], dmg: 22, head: 1.7, interval: 70, spin: [150, 70], mag: 100, reload: 3600, spread: 0.022, pellets: 1, range: 120, kick: 0.0055, price: 3100, auto: true, move: 0.82 },
];
export const W_KNIFE = 0, W_PISTOL = 1, W_DEFAULT_PRIM = 13;
// 스킨 — free 는 누구나, 나머지는 코드로 해금. 순서(번호)가 저장·전송에 쓰이니 뒤에만 추가할 것
export const SKINS = [
  { id: 'std', name: '기본', free: true },
  { id: 'desert', name: '디지털 사막', free: true },
  { id: 'forest', name: '우드랜드', free: true },
  { id: 'carbon', name: '카본 레드', tier: '희귀', bundle: true },
  { id: 'tiger', name: '맹호', tier: '희귀', bundle: true },
  { id: 'sakura', name: '벚꽃', tier: '희귀', bundle: true },
  { id: 'ice', name: '빙결', tier: '영웅', bundle: true },
  { id: 'neon', name: '네온 회로', tier: '영웅', bundle: true },
  { id: 'lava', name: '용암', tier: '영웅', bundle: true },
  { id: 'gold', name: '황금', tier: '전설', bundle: true },
  { id: 'galaxy', name: '은하', tier: '전설', bundle: true },
  { id: 'aurora', name: '오로라', tier: '전설', bundle: true },
  { id: 'halloween', name: '할로윈', tier: '한정', bundle: true },
  // 번호가 바뀌지 않게 새 스킨은 항상 끝에 붙인다
  { id: 'urban', name: '디지털 도심', free: true },
  // 얼티밋 번들 (발로란트식): 총 모양 · 총소리·꺼내는 소리·처치 소리 · 궤적·총구 불꽃·착탄·처치 효과 · 처치 엠블럼이 모두 바뀌고, 레벨과 상관없이 처음부터 다 켜짐
  { id: 'platinum', name: '플래티넘 프라임', tier: '얼티밋', bundle: true },
  { id: 'damascus', name: '다마스커스 사무라이', tier: '얼티밋', bundle: true },
  { id: 'obsidian', name: '흑요석 리퍼', tier: '얼티밋', bundle: true },
  { id: 'diamond', name: '다이아몬드 크라운', tier: '얼티밋', bundle: true },
  { id: 'atomic', name: '아토믹 리액터', tier: '얼티밋', bundle: true },
  { id: 'orion', name: '오리온 성좌', tier: '얼티밋', bundle: true },
  { id: 'darkmatter', name: '다크 매터 보이드', tier: '얼티밋', bundle: true },
  // 레전드: 장갑판·날개·가시로 총의 윤곽부터 바뀌는 최상위 스킨
  { id: 'crimson', name: '크림슨 메카', tier: '레전드', bundle: true },
  { id: 'dragon', name: '흑룡', tier: '레전드', bundle: true },
  { id: 'phoenix', name: '황금 불사조', tier: '레전드', bundle: true },
  { id: 'aqua', name: '아쿠아 메카', tier: '레전드', bundle: true },
];
// ───────────── 파츠(부착물) ─────────────
// 무기마다 자리(slot)별로 하나씩, 모두 합쳐 PART_MAX 개까지 단다. 수치는 곱하는 값 (1 = 그대로):
// range 사거리 · spread 정조준 탄퍼짐 · hip 지향사격 탄퍼짐 · ads 정조준 걸리는 시간 · kv 위로 튀는 반동 · kh 옆으로 튀는 반동 · move 이동 속도 · mag 탄창 · reload 장전 시간
export const PART_MAX = 5;
export const PART_SLOTS = [['muz', '총구'], ['bar', '총열'], ['opt', '조준경'], ['stk', '개머리판'], ['grp', '손잡이'], ['mag', '탄창'], ['las', '레이저']];
export const PARTS = [
  null,
  { id: 'sup', slot: 'muz', name: '소음기', desc: '총소리가 작아지고 미니맵에 안 뜸', quiet: true, range: 0.9, kv: 0.96, ads: 1.06 },
  { id: 'comp', slot: 'muz', name: '보정기', desc: '위로 튀는 반동을 줄임', kv: 0.8, kh: 1.08, hip: 1.06 },
  { id: 'brake', slot: 'muz', name: '제동기', desc: '좌우 흔들림을 줄임', kh: 0.72, kv: 0.95, ads: 1.04 },
  { id: 'long', slot: 'bar', name: '장총열', desc: '사거리와 명중률이 늘고 무거워짐', range: 1.25, spread: 0.8, move: 0.97, ads: 1.1 },
  { id: 'light', slot: 'bar', name: '경량 총열', desc: '가볍고 빠르지만 사거리가 줄어듦', range: 0.86, move: 1.04, ads: 0.9, kv: 1.06 },
  { id: 'dot', slot: 'opt', name: '레드 도트', desc: '점 하나로 빠르게 조준', ads: 0.96 },
  { id: 'holo', slot: 'opt', name: '홀로그램', desc: '넓은 창으로 또렷하게 조준', spread: 0.92, no: ['pistol', 'revolver'] },
  { id: 'x3', slot: 'opt', name: '3배율 조준경', desc: '멀리 있는 적을 크게 봄', zoom: 27, spread: 0.85, ads: 1.14, no: ['pistol', 'revolver', 'shotgun'] },
  { id: 'lstk', slot: 'stk', name: '경량 개머리판', desc: '정조준이 빨라지고 반동이 늘어남', ads: 0.86, move: 1.02, kv: 1.1 },
  { id: 'hstk', slot: 'stk', name: '안정 개머리판', desc: '반동이 줄고 정조준이 느려짐', kv: 0.87, kh: 0.88, ads: 1.1, move: 0.98 },
  { id: 'vgrip', slot: 'grp', name: '수직 손잡이', desc: '위로 튀는 반동을 줄임', kv: 0.86, move: 0.98 },
  { id: 'agrip', slot: 'grp', name: '경사 손잡이', desc: '정조준이 빨라지고 좌우 흔들림이 줄어듦', ads: 0.9, kh: 0.9 },
  { id: 'ext', slot: 'mag', name: '대용량 탄창', desc: '탄이 늘고 장전이 느려짐', mag: 1.4, reload: 1.12, ads: 1.05, move: 0.98 },
  { id: 'fast', slot: 'mag', name: '빠른 탄창', desc: '장전이 빨라짐', reload: 0.74 },
  { id: 'laser', slot: 'las', name: '레이저', desc: '조준하지 않고 쏠 때 탄이 덜 퍼짐', hip: 0.62, ads: 0.96 },
];
const MODEL_SLOTS = { knife: '', pistol: 'muz opt mag las', revolver: 'bar opt las', sawed: 'bar las', smg: 'muz bar opt stk grp mag las', rifle: 'muz bar opt stk grp mag las', shotgun: 'muz bar opt stk mag las', sniper: 'muz bar stk mag las' };
// 이 무기에 달 수 있는 자리 (소음기가 기본으로 달린 총은 총구를 못 바꿈)
export function partSlots(wi) {
  const W = WEAPONS[wi]; if (!W) return [];
  const s = MODEL_SLOTS[W.model[0]].split(' ').filter(Boolean);
  if (W.model[0] === 'shotgun' && W.model[1] && W.model[1].auto) s.splice(4, 0, 'grp');
  return W.quiet ? s.filter((k) => k !== 'muz') : s;
}
export function partOk(wi, pi) { const P = PARTS[pi]; return !!P && partSlots(wi).includes(P.slot) && !(P.no && P.no.includes(WEAPONS[wi].model[0])); }
// 받은 목록에서 쓸 수 있는 것만 남김 (자리마다 하나, 최대 PART_MAX 개)
export function cleanParts(wi, arr) {
  const out = [], used = new Set();
  if (Array.isArray(arr)) for (const v of arr) { const pi = v | 0; if (out.length >= PART_MAX || !partOk(wi, pi) || used.has(PARTS[pi].slot)) continue; used.add(PARTS[pi].slot); out.push(pi); }
  return out.sort((a, b) => a - b);
}
const ADS_MS = { knife: 0, pistol: 150, smg: 185, rifle: 235, shotgun: 225, sniper: 340, mg: 330 };
const HIP = { side: 0.017, smg: 0.025, ar: 0.034, mg: 0.046 };
// 파츠를 반영한 무기 수치. 표에 없는 값도 채운다: hip 지향사격 탄퍼짐, adsMs 정조준 시간, kv·kh 반동 배수
export function effWeapon(wi, parts) {
  const W = WEAPONS[wi], E = { ...W, kv: 1, kh: 1, hip: W.melee ? 0 : W.falloff ? W.spread : W.hipSpread || HIP[W.cat] || 0.03, adsMs: ADS_MS[W.vm] * (W.ap ? 1.2 : 1), move: W.move || 1, parts: [] };
  for (const pi of cleanParts(wi, parts)) {
    const P = PARTS[pi]; E.parts.push(pi);
    for (const k of ['range', 'spread', 'hip', 'kv', 'kh', 'move', 'reload']) if (P[k]) E[k] *= P[k];
    if (P.ads) E.adsMs *= P.ads;
    if (P.mag) E.mag = Math.round(W.mag * P.mag);
    if (P.quiet) E.quiet = true;
    if (P.zoom) E.zoom = Math.min(W.zoom || 99, P.zoom);
    if (P.range && W.falloff) E.falloff = [W.falloff[0] * P.range, W.falloff[1] * P.range];
  }
  E.reload = Math.round(E.reload); E.range = Math.round(E.range);
  return E;
}
// ───────────── 스킨 업그레이드 ─────────────
// 스킨을 낀 무기로 처치할수록 스킨 레벨이 오른다. 2 궤적 색 · 3 총구 불꽃과 탄착 색 · 4 처치 효과 · 5 각성(빛나는 겉면)
export const SKIN_LV = [0, 5, 15, 35, 70];
// 요원 스킨 (캐릭터 겉모습) — 0 은 내가 그린 그림. 코드로 해금하며 소유 번호는 OP_BASE + 번호. 순서는 뒤에만 추가
export const OP_BASE = 100;
export const OPS = [
  { id: 'none', name: '기본 (내 그림)', desc: '그리기 화면에서 그린 그림을 입어요.' },
  { id: 'vanguard', name: '네온 뱅가드', tier: '레전드', col: '#19e0ff', desc: '전술 바이저와 네온 회로가 빛나는 미래 강습 요원.' },
  { id: 'samurai', name: '크림슨 사무라이', tier: '레전드', col: '#ff3048', desc: '황금 초승달 투구와 붉은 갑옷, 등에 찬 카타나.' },
  { id: 'reactor', name: '인페르노 리액터', tier: '레전드', col: '#ff7a1a', desc: '가슴과 등의 원자로가 불타오르는 중장갑 요원.' },
  { id: 'reaper', name: '보이드 리퍼', tier: '레전드', col: '#b07aff', desc: '두건 속 빛나는 눈, 펄럭이는 망토와 등의 낫.' },
];
export const SKIN_LV_NAME = ['', '기본', '궤적 색', '파츠 스킨 (단 파츠에 스킨 장식)', '처치 효과', '각성 · 파츠 각성 (도는 고리·보석)'];
export function skinLevel(xp) { let l = 1; for (let i = 1; i < SKIN_LV.length; i++) if (xp >= SKIN_LV[i]) l = i + 1; return l; }
export const CATS = [['side', '보조무기'], ['smg', '기관단총'], ['sg', '샷건'], ['ar', '소총'], ['sr', '저격총'], ['mg', '기관총']];
export const NADE_WEAPON = 99; // 킬 로그에서 수류탄을 뜻하는 번호
export const ZONE_WEAPON = 98; // 안전 구역 밖에서 쓰러짐
export const VEH_WEAPON = 97;  // 차에 치임
// 투척 무기: 0 수류탄 · 1 연막탄 · 2 섬광탄
export const NADES = [
  { name: '수류탄', fuse: 1700, price: 300, radius: 7.5, dmg: 115 },
  { name: '연막탄', fuse: 1500, price: 300, radius: 4.4, last: 14000 },
  { name: '섬광탄', fuse: 1300, price: 200, radius: 26 },
];
export const ECON = { start: 1500, max: 9000, kill: 300, win: 3000, lose: 1900, plant: 300, defuse: 300, armor: 650 };

// ───────────── 맵 ─────────────
// 지금 쓰는 맵 — setMap 으로 바꾸면 아래 값들이 함께 바뀐다 (ARENA 는 같은 객체의 값만 바뀜)
export { MAPS, ARENA_MAPS };
let ACC = MAPS[0].acc, HM = MAPS[0].hm;
export let MAP = 0, BOXES = MAPS[0].boxes, SPAWNS = MAPS[0].spawns, SPAWNS_TDM = MAPS[0].spawnsTdm, SITES = MAPS[0].sites;
export function setMap(i) {
  const m = MAPS[i] || MAPS[0];
  MAP = MAPS.indexOf(m); BOXES = m.boxes; SPAWNS = m.spawns; SPAWNS_TDM = m.spawnsTdm; SITES = m.sites;
  ACC = m.acc; HM = m.hm; Object.assign(ARENA, m.arena);
}
// 땅 높이 (평지 맵은 0). raw = true 면 바닷속 실제 깊이
export function groundAt(x, z, raw) { return HM ? hmSample(HM, x, z, raw) : 0; }
// 걸어 다니는 바닥 높이: 땅, 또는 그 위에 놓인 다리·계단(deck 표시가 붙은 상자)의 윗면. 봇과 바닥에 놓는 물건이 씀
export function floorAt(x, z) {
  let y = groundAt(x, z);
  for (const b of boxesNear(x, z, 0)) if (b.deck && x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2] && b.max[1] > y) y = b.max[1];
  return y;
}
// 물 높이 (물이 없으면 -Infinity). 섬은 바다(0), 경기장은 맵에 적힌 물 구역
export function waterAt(x, z) {
  const m = MAPS[MAP];
  if (m.br) return 0;
  if (m.water) for (const w of m.water) if (x >= w[0] && x <= w[2] && z >= w[1] && z <= w[3]) return w[4];
  return -Infinity;
}
// 봇 길찾기 격자 (1m 칸): g = 막힌 칸, hgt = 칸 바닥 높이, step = 옆 칸과 이 높이 넘게 차이 나면 못 지나감 (0 = 제한 없음)
export function buildNav(m) {
  const hx = m.arena.hx, hz = m.arena.hz, W = hx * 2, H = hz * 2, g = new Uint8Array(W * H), hgt = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) hgt[j * W + i] = floorAt(-hx + i + 0.5, -hz + j + 0.5);
  for (const b of m.boxes) {
    const i0 = Math.max(0, Math.floor(b.min[0] - 0.45 + hx)), i1 = Math.min(W - 1, Math.floor(b.max[0] + 0.45 + hx));
    const j0 = Math.max(0, Math.floor(b.min[2] - 0.45 + hz)), j1 = Math.min(H - 1, Math.floor(b.max[2] + 0.45 + hz));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = -hx + i + 0.5, cz = -hz + j + 0.5;
      if (!(cx > b.min[0] - 0.45 && cx < b.max[0] + 0.45 && cz > b.min[2] - 0.45 && cz < b.max[2] + 0.45)) continue;
      const gy = hgt[j * W + i];
      if (b.max[1] > gy + 0.5 && b.min[1] < gy + 1.8) g[j * W + i] = 1;
    }
  }
  if (m.br) { for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (groundAt(-hx + i + 0.5, -hz + j + 0.5, true) < -0.5) g[j * W + i] = 1; } // 봇은 바다에 안 들어감
  else if (m.water) for (const w of m.water) for (let j = Math.max(0, Math.floor(w[1] + hz)); j < Math.min(H, Math.ceil(w[3] + hz)); j++) for (let i = Math.max(0, Math.floor(w[0] + hx)); i < Math.min(W, Math.ceil(w[2] + hx)); i++) if (hgt[j * W + i] < w[4] - 0.3) g[j * W + i] = 1; // 물에도
  return { g, hgt, W, H, hx, hz, step: m.br ? 0 : 0.95 };
}
// (x, z) 둘레 r 안에 걸칠 수 있는 상자들 (같은 상자가 두 번 나올 수 있음)
const _near = [];
export function boxesNear(x, z, r) {
  const { cs, nx, nz, ox, oz, cells } = ACC;
  const i0 = Math.max(0, Math.floor((x - r - ox) / cs)), i1 = Math.min(nx - 1, Math.floor((x + r - ox) / cs));
  const j0 = Math.max(0, Math.floor((z - r - oz) / cs)), j1 = Math.min(nz - 1, Math.floor((z + r - oz) / cs));
  if (i0 > i1 || j0 > j1) return _near.length ? (_near.length = 0, _near) : _near;
  if (i0 === i1 && j0 === j1) return cells[j0 * nx + i0];
  _near.length = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const c = cells[j * nx + i]; for (let k = 0; k < c.length; k++) _near.push(c[k]); }
  return _near;
}
export function siteAt(x, z) {
  for (let i = 0; i < SITES.length; i++) { const s = SITES[i]; if (Math.abs(x - s.x) <= s.r && Math.abs(z - s.z) <= s.r) return i; }
  return -1;
}

export function dirFrom(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

export function rayBox(o, d, b) {
  let t0 = 0, t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < b.min[i] || o[i] > b.max[i]) return Infinity;
    } else {
      let a = (b.min[i] - o[i]) / d[i], c = (b.max[i] - o[i]) / d[i];
      if (a > c) { const s = a; a = c; c = s; }
      if (a > t0) t0 = a;
      if (c < t1) t1 = c;
      if (t0 > t1) return Infinity;
    }
  }
  return t0;
}

// 맵(상자·땅)에 처음 닿는 거리
export function rayWorld(o, d, maxT) {
  let t = maxT;
  if (HM) { // 지형: 일정 간격으로 따라가다 땅 밑으로 들어가면 그 사이를 좁혀 찾는다
    if (!(d[1] >= 0 && o[1] > 34)) {
      let pt = 0, step = 1.5;
      for (let s = step; s < t + step; s += step) {
        const c = Math.min(s, t), y = o[1] + d[1] * c;
        if (y > 34 && d[1] >= 0) break;
        if (y < hmSample(HM, o[0] + d[0] * c, o[2] + d[2] * c)) {
          let lo = pt, hi = c;
          for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (o[1] + d[1] * m < hmSample(HM, o[0] + d[0] * m, o[2] + d[2] * m)) hi = m; else lo = m; }
          t = lo; break;
        }
        pt = c;
        if (c >= t) break;
      }
    }
  } else if (d[1] < -1e-9) { const tf = -o[1] / d[1]; if (tf >= 0 && tf < t) t = tf; }
  // 상자: 8m 격자를 광선이 지나는 칸만 차례로 검사
  const { cs, nx, nz, ox, oz, cells } = ACC;
  let ix = Math.floor((o[0] - ox) / cs), iz = Math.floor((o[2] - oz) / cs);
  if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) { for (const b of BOXES) { const tb = rayBox(o, d, b); if (tb < t) t = tb; } return t; }
  const sx = d[0] > 0 ? 1 : -1, sz = d[2] > 0 ? 1 : -1;
  const ax = Math.abs(d[0]), az = Math.abs(d[2]);
  let tx = ax < 1e-9 ? Infinity : ((d[0] > 0 ? (ix + 1) * cs + ox - o[0] : o[0] - (ix * cs + ox)) / ax);
  let tz = az < 1e-9 ? Infinity : ((d[2] > 0 ? (iz + 1) * cs + oz - o[2] : o[2] - (iz * cs + oz)) / az);
  const dx = ax < 1e-9 ? Infinity : cs / ax, dz = az < 1e-9 ? Infinity : cs / az;
  for (;;) {
    const c = cells[iz * nx + ix];
    for (let k = 0; k < c.length; k++) { const tb = rayBox(o, d, c[k]); if (tb < t) t = tb; }
    const next = tx < tz ? tx : tz;
    if (t <= next) break;
    if (tx < tz) { ix += sx; tx += dx; } else { iz += sz; tz += dz; }
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) break;
  }
  return t;
}
// 닿은 지점의 면 방향 (탄흔 그릴 때 사용)
export let HIT_M = ''; // hitNormal 이 마지막으로 찾은 곳의 재질 ('' = 땅)
export function hitNormal(p) {
  let best = 0.06, n = null; HIT_M = '';
  for (const b of boxesNear(p[0], p[2], 0.1)) {
    if (p[0] < b.min[0] - 0.05 || p[0] > b.max[0] + 0.05 || p[1] < b.min[1] - 0.05 || p[1] > b.max[1] + 0.05 || p[2] < b.min[2] - 0.05 || p[2] > b.max[2] + 0.05) continue;
    for (let i = 0; i < 3; i++) {
      const a = Math.abs(p[i] - b.min[i]), c = Math.abs(p[i] - b.max[i]);
      if (a < best) { best = a; n = [0, 0, 0]; n[i] = -1; HIT_M = b.m || ''; }
      if (c < best) { best = c; n = [0, 0, 0]; n[i] = 1; HIT_M = b.m || ''; }
    }
  }
  if (n) return n;
  if (!HM) return p[1] < 0.02 ? [0, 1, 0] : null;
  if (p[1] > hmSample(HM, p[0], p[2]) + 0.25) return null;
  const e = 1, gx = hmSample(HM, p[0] + e, p[2]) - hmSample(HM, p[0] - e, p[2]), gz = hmSample(HM, p[0], p[2] + e) - hmSample(HM, p[0], p[2] - e);
  const l = Math.hypot(gx, 2 * e, gz);
  return [-gx / l, (2 * e) / l, -gz / l];
}

function raySphere(o, d, cx, cy, cz, r) {
  const ox = o[0] - cx, oy = o[1] - cy, oz = o[2] - cz;
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : Infinity;
}
// 선분 a→b 가 연막(구) 을 지나는지
export function segHitsSphere(a, b, c, r) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len2 = dx * dx + dy * dy + dz * dz || 1e-9;
  let t = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy + (c[2] - a[2]) * dz) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = a[0] + dx * t - c[0], py = a[1] + dy * t - c[1], pz = a[2] + dz * t - c[2];
  return px * px + py * py + pz * pz < r * r;
}

const _body = { min: [0, 0, 0], max: [0, 0, 0] };
// 플레이어(발 위치 px,py,pz) 피격 판정 → {t, head} 또는 null
export function rayPlayer(o, d, px, py, pz, crouch) {
  const th = raySphere(o, d, px, py + (crouch ? 1.14 : 1.64), pz, 0.25);
  _body.min[0] = px - 0.4; _body.min[1] = py; _body.min[2] = pz - 0.4;
  _body.max[0] = px + 0.4; _body.max[1] = py + (crouch ? 0.98 : 1.45); _body.max[2] = pz + 0.4;
  const tb = rayBox(o, d, _body);
  if (th === Infinity && tb === Infinity) return null;
  return th <= tb ? { t: th, head: true } : { t: tb, head: false };
}
