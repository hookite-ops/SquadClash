// SQUAD CLASH — 미리 굽는 효과음. 처음 소리를 켤 때 한 번, 표본 하나하나를 계산해 소리 조각을 만들어 둔다.
// 실시간으로 거르개 몇 개를 겹치던 예전 방식 대신, 실제 총소리를 이루는 층을 그대로 쌓는다:
// 화약 압력파(프리들랜더 파형) + 총알 충격파 '딱' + 점점 먹먹해지는 폭발 잡음 + 낮게 치는 '쿵' + 포화로 단단한 펀치
// + 노리쇠 쇳소리(진동 모드) + 건물 벽에서 돌아오는 메아리 + 멀리서 굴러오는 잔향 (좌우가 조금씩 달라 넓게 들림)
// 브라우저 없이도 돌아간다 (tools/sfx_preview.mjs 로 wav 를 뽑아 들어 볼 수 있음).
let SR = 48000;
export const setRate = (r) => { SR = r; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// RBJ 2차 거르개 (lp 낮은 소리만 · hp 높은 소리만 · bp 띠). f.set(새 주파수) 로 상태를 지킨 채 주파수만 옮길 수 있음
function biq(type, f, q = 0.707) {
  let B0, B1, B2, A1, A2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const fn = (x) => { const y = B0 * x + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  fn.set = (f2) => {
    const w = (2 * Math.PI * Math.min(Math.max(f2, 10), SR * 0.45)) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
    B0 = b0 / a0; B1 = b1 / a0; B2 = b2 / a0; A1 = (-2 * c) / a0; A2 = (1 - al) / a0;
  };
  fn.set(f);
  return fn;
}
const onePole = (f) => { const k = 1 - Math.exp((-2 * Math.PI * f) / SR); let y = 0; return (x) => (y += (x - y) * k); };
// 진동 모드: 쇠·나무가 맞았을 때 울리는 몇 개의 높이 (fs 높이들, tau 잦아드는 시간, amp 세기, t 시작)
function modal(out, t, fs, tau, amp, R, spread = 0.04) {
  const i0 = Math.floor(t * SR);
  fs.forEach((f0, k) => {
    const f = f0 * (1 + (R() - 0.5) * spread), w = (2 * Math.PI * f) / SR, a = amp / (1 + k * 0.7), ph = R() * 6.28, d = Math.exp(-1 / (SR * tau * Math.max(0.3, 1 - k * 0.12)));
    const n = Math.min(out.length - i0, Math.ceil(tau * 6 * SR));
    let e = a; for (let i = 0; i < n; i++) { out[i0 + i] += e * Math.sin(ph + w * i) * (i < 24 ? i / 24 : 1); e *= d; }
  });
}
// 잡음 터짐: tau 로 잦아드는 잡음을 거르개에 통과
function burst(out, t, tau, amp, R, filt, attack = 0.0004, len = tau * 7) {
  const i0 = Math.floor(t * SR), n = Math.min(out.length - i0, Math.ceil(len * SR)), na = Math.max(1, attack * SR), d = Math.exp(-1 / (SR * tau));
  let e = amp; for (let i = 0; i < n; i++) { const x = (R() * 2 - 1) * e * (i < na ? i / na : 1); out[i0 + i] += filt ? filt(x) : x; if (i >= na) e *= d; }
}
// 알갱이: 짧은 잡음 톡톡 (자갈·파편·풀)
function grains(out, t0, t1, n, amp, f, q, R, tau = 0.003) { for (let k = 0; k < n; k++) burst(out, t0 + R() * (t1 - t0), tau * (0.6 + R()), amp * (0.3 + R() * 0.7), R, biq('bp', f * (0.7 + R() * 0.6), q), 0.0002); }
// 화약 압력파: 순식간에 치솟았다가 T 초 만에 0 을 지나 길고 얕게 빨려 들어가는 모양
function friedlander(out, t, T, amp, b = 1.6) {
  const i0 = Math.floor(t * SR), n = Math.min(out.length - i0, Math.ceil(T * 6 * SR)), lp = biq('lp', Math.min(9000, 2.2 / T));
  for (let i = 0; i < n; i++) { const x = i / SR / T; out[i0 + i] += lp(amp * (1 - x) * Math.exp(-b * x)); }
}
// 초음속 총알이 남기는 N 모양 충격파 (아주 짧은 '딱')
function nwave(out, t, dur, amp) { const i0 = Math.floor(t * SR), nw = Math.max(2, Math.floor((dur / 2) * SR)); for (let i = 0; i < nw * 2 && i0 + i < out.length; i++) out[i0 + i] += amp * (i < nw ? 1 - i / nw : -(1 - (i - nw) / nw) * 0.8); }
const sat = (a, drive) => { const k = Math.tanh(drive); for (let i = 0; i < a.length; i++) a[i] = Math.tanh(a[i] * drive) / k; };
const peakOf = (chs) => { let m = 0; for (const a of chs) for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > m) m = v; } return m; };
const norm = (chs, peak = 0.95) => { const m = peakOf(chs); if (m > 0) { const k = peak / m; for (const a of chs) for (let i = 0; i < a.length; i++) a[i] *= k; } return chs; };
// 거의 안 들리는 끝부분(-60dB 아래)은 잘라 메모리를 아낌
const trim = (chs, floor = 0.001) => { let last = 0; for (const a of chs) for (let i = a.length - 1; i > last; i--) if (Math.abs(a[i]) > floor) { last = i; break; } const n = Math.min(chs[0].length, last + Math.floor(0.02 * SR)); return n < chs[0].length ? chs.map((a) => a.slice(0, n)) : chs; };
const fadeOut = (chs, sec = 0.03) => { for (const a of chs) { const n = Math.min(a.length, Math.floor(sec * SR)); for (let i = 0; i < n; i++) a[a.length - 1 - i] *= i / n; } return chs; };
const mono = (len) => [new Float32Array(Math.ceil(len * SR))];
// 굴러가는 잔향: 낮게 거른 잡음이 천천히 출렁이며(먼 산·건물에서 차례로 돌아오는 소리) 잦아듦
function rollTail(out, t, amp, tau, lpf, R, roll = 0.5) {
  const i0 = Math.floor(t * SR), n = out.length - i0, d = Math.exp(-1 / (SR * tau)), lp = biq('lp', lpf, 0.6), lp2 = onePole(lpf * 0.5), am = onePole(9), rise = 0.025 * SR;
  let e = amp, m = 1;
  for (let i = 0; i < n; i++) { if ((i & 255) === 0) m = 1 + (R() * 2 - 1) * roll * 2; const x = (R() * 2 - 1) * e * Math.min(1, i / rise) * Math.max(0.15, am(m)); out[i0 + i] += lp(x) * 0.75 + lp2(x) * 0.7; e *= d; }
}

// ───────────── 총소리 ─────────────
// 종류별 값:
// len 길이 · fr [압력파 길이(초), 세기] · crack 충격파 세기 · hi [시간, 세기] 맨 앞의 날카로운 '칙'
// blast [잦아드는 시간, 처음 거르개, 나중 거르개, 세기] 점점 먹먹해지는 폭발 몸통 · punch [높이, 시간, 세기] 가운데 높이를 받치는 '퍽'
// thump [처음 높이, 끝 높이, 시간, 세기] 낮게 치는 '쿵' · drive 포화 · mech [[시작, 세기, 시간, 높이들]] 노리쇠 쇳소리
// er [메아리 수, 처음, 끝, 세기] 가까운 벽 · slap [[시간, 세기]] 건물 벽 메아리 · tail [세기, 시간, 거르개, 출렁임] 굴러오는 잔향
export const GUN = {
  side: { len: 0.95, fr: [0.0007, 0.6], crack: 0.45, hi: [0.0035, 0.33], blast: [0.016, 4200, 900, 2.6], punch: [1105, 0.015, 3.51], thump: [190, 85, 0.022, 0.43], drive: 1.9, mech: [[0.03, 0.14, 0.011, [2400, 3800, 5300]]], er: [7, 0.012, 0.07, 0.3], slap: [[0.11, 0.26], [0.23, 0.16]], tail: [0.125, 0.24, 2300, 0.4] },
  mag: { len: 1.25, fr: [0.0011, 0.75], crack: 0.75, hi: [0.0045, 0.36], blast: [0.026, 3900, 650, 3.0], punch: [850, 0.026, 3.78], thump: [150, 66, 0.035, 0.48], drive: 2.3, mech: [], er: [8, 0.014, 0.09, 0.34], slap: [[0.12, 0.34], [0.27, 0.21], [0.44, 0.1]], tail: [0.2, 0.38, 2000, 0.5] },
  smg: { len: 0.9, fr: [0.0006, 0.55], crack: 0.4, hi: [0.003, 0.3], blast: [0.014, 4500, 1000, 2.4], punch: [1190, 0.013, 3.24], thump: [200, 90, 0.02, 0.39], drive: 1.8, mech: [[0.018, 0.12, 0.009, [2000, 3200, 4500]]], er: [7, 0.012, 0.065, 0.28], slap: [[0.1, 0.22], [0.21, 0.13]], tail: [0.112, 0.22, 2300, 0.4] },
  ar: { len: 1.3, fr: [0.0012, 0.7], crack: 0.7, hi: [0.004, 0.33], blast: [0.024, 4200, 700, 2.8], punch: [950, 0.022, 3.51], thump: [160, 72, 0.03, 0.42], drive: 2.2, mech: [[0.024, 0.1, 0.011, [1750, 2950, 4250]]], er: [8, 0.013, 0.09, 0.34], slap: [[0.12, 0.31], [0.26, 0.2], [0.41, 0.1]], tail: [0.188, 0.42, 2100, 0.55] },
  dmr: { len: 1.55, fr: [0.0015, 0.8], crack: 0.85, hi: [0.0045, 0.36], blast: [0.03, 4500, 650, 3.0], punch: [880, 0.028, 3.65], thump: [145, 64, 0.038, 0.5], drive: 2.4, mech: [[0.03, 0.1, 0.012, [1600, 2700, 4000]]], er: [9, 0.014, 0.11, 0.36], slap: [[0.13, 0.35], [0.29, 0.22], [0.47, 0.13]], tail: [0.213, 0.55, 1950, 0.6] },
  mg: { len: 1.3, fr: [0.0013, 0.75], crack: 0.7, hi: [0.004, 0.3], blast: [0.026, 4080, 650, 2.9], punch: [900, 0.024, 3.65], thump: [150, 66, 0.033, 0.48], drive: 2.3, mech: [[0.022, 0.09, 0.011, [1500, 2600, 3900]]], er: [8, 0.013, 0.09, 0.36], slap: [[0.12, 0.33], [0.27, 0.2]], tail: [0.2, 0.45, 2000, 0.55] },
  sg: { len: 1.6, fr: [0.0022, 0.9], crack: 0.25, hi: [0.005, 0.3], blast: [0.04, 3300, 450, 3.2], punch: [650, 0.04, 3.78], thump: [120, 52, 0.05, 0.63], drive: 2.6, mech: [], er: [9, 0.015, 0.12, 0.4], slap: [[0.13, 0.39], [0.3, 0.23], [0.5, 0.13]], tail: [0.25, 0.58, 1700, 0.6] },
  sr: { len: 2.1, fr: [0.0019, 0.9], crack: 1.0, hi: [0.005, 0.39], blast: [0.036, 4800, 550, 3.1], punch: [760, 0.034, 3.65], thump: [128, 56, 0.048, 0.59], drive: 2.6, mech: [], er: [10, 0.016, 0.14, 0.4], slap: [[0.15, 0.42], [0.34, 0.26], [0.58, 0.16], [0.85, 0.08]], tail: [0.275, 0.8, 1800, 0.7] },
  hsr: { len: 2.6, fr: [0.003, 1.0], crack: 1.0, hi: [0.006, 0.36], blast: [0.05, 3900, 420, 3.3], punch: [600, 0.045, 3.78], thump: [105, 46, 0.065, 0.77], drive: 2.9, mech: [], er: [11, 0.016, 0.16, 0.44], slap: [[0.16, 0.47], [0.37, 0.31], [0.62, 0.18], [0.95, 0.1]], tail: [0.325, 1.0, 1500, 0.8] },
};
// 먼 곳: 높은 소리는 공기에 먹혀 둔탁한 '퉁' 과 길게 굴러오는 메아리만 남음
export const FAR = (P) => ({ ...P, len: P.len * 1.45, fr: [P.fr[0] * 2.2, P.fr[1] * 0.8], crack: P.crack * 0.1, hi: [P.hi[0], P.hi[1] * 0.08], blast: [P.blast[0] * 1.8, 1400, 360, P.blast[3] * 1.3], punch: [P.punch[0] * 0.45, P.punch[1] * 1.6, P.punch[2] * 0.6], thump: [P.thump[0] * 0.8, P.thump[1], P.thump[2] * 1.8, P.thump[3] * 1.3], drive: P.drive * 0.8, mech: [], er: [P.er[0] + 4, 0.05, 0.5, P.er[3] * 1.5], slap: P.slap.map(([t, g]) => [t * 1.8, g * 1.6]), tail: [P.tail[0] * 2.6, P.tail[1] * 1.5, 850, P.tail[3] + 0.2] });
// 소음기: 충격파·폭발이 거의 사라지고 짧은 '퍽' + 가스 새는 '츳' + 노리쇠 쇳소리가 또렷함
export const SUP = (P) => ({ ...P, len: 0.5, fr: [P.fr[0] * 1.6, 0.35], crack: 0, hi: [0.002, 0.15], blast: [0.009, 3000, 500, 2.2], punch: [800, 0.011, 1.6], thump: [P.thump[0] * 1.15, P.thump[1] * 1.3, 0.022, P.thump[3] * 0.6], drive: 1.5, gas: [0.02, 0.22], mech: [[0.008, 0.3, 0.01, [2200, 3500, 4900, 6200]], [0.045, 0.18, 0.009, [1850, 3050, 4350]]], er: [4, 0.01, 0.05, 0.12], slap: [[0.09, 0.05]], tail: [0.012, 0.12, 2200, 0.2] });

// 총소리 한 발 (좌우 두 줄)
export function bakeShot(P, seed) {
  const R = rng(seed), N = Math.ceil(P.len * SR), L = new Float32Array(N), Rt = new Float32Array(N), dry = new Float32Array(Math.ceil(Math.min(P.len, 0.5) * SR));
  const pv = 1 + (R() - 0.5) * 0.07; // 발마다 조금씩 다른 높이
  friedlander(dry, 0, P.fr[0] * pv, P.fr[1]);
  if (P.crack > 0.05) nwave(dry, 0, 0.0004, P.crack);
  burst(dry, 0, P.hi[0], P.hi[1], R, biq('hp', 1000, 0.6), 0.0001);
  { // 폭발 몸통: 잡음이 처음 거르개 → 나중 거르개로 먹먹해지며 잦아듦 (거르개를 표본마다 옮김)
    const [tau, f0, f1, amp] = P.blast, n = Math.min(dry.length, Math.ceil(tau * 9 * SR)), d = Math.exp(-1 / (SR * tau)), lp = biq('lp', f0, 0.8), hp = biq('hp', 110, 0.7), fd = Math.pow(f1 / f0, 1 / (tau * 2.5 * SR));
    let e = amp;
    for (let i = 0; i < n; i++) { if ((i & 15) === 0) lp.set(Math.max(f1, f0 * Math.pow(fd, i))); dry[i] += hp(lp((R() * 2 - 1) * e * (i < 8 ? i / 8 : 1))); e *= d; }
  }
  burst(dry, 0, P.punch[1], P.punch[2], R, biq('bp', P.punch[0] * pv, 1.0), 0.0004);
  { // 낮게 치는 '쿵': 높이가 미끄러지며 잦아드는 떨림 (+ 2배음)
    const [f0, f1, tau, amp] = P.thump, n = Math.min(dry.length, Math.ceil(tau * 7 * SR)), d = Math.exp(-1 / (SR * tau));
    let ph = 0, e = amp;
    for (let i = 0; i < n; i++) { const f = (f1 + (f0 - f1) * Math.exp(-i / (SR * tau * 0.6))) * pv; ph += (2 * Math.PI * f) / SR; dry[i] += e * (Math.sin(ph) + 0.35 * Math.sin(2 * ph + 0.5)) * (i < 30 ? i / 30 : 1); e *= d; }
  }
  if (P.gas) burst(dry, 0.001, P.gas[0], P.gas[1], R, biq('hp', 2400, 0.7), 0.0015);
  sat(dry, P.drive);
  for (let i = 0; i < dry.length; i++) { L[i] += dry[i]; Rt[i] += dry[i]; }
  // 노리쇠·슬라이드 쇳소리 (포화 뒤에 깨끗하게, 좌우로 살짝 벌려서)
  for (const [t, amp, tau, fs] of P.mech || []) {
    const m = new Float32Array(Math.ceil(tau * 7 * SR) + 64), t0 = t * (0.95 + R() * 0.1);
    modal(m, 0, fs.map((f) => f * pv), tau, amp, R); burst(m, 0, 0.0014, amp * 0.6, R, biq('hp', 3000), 0.0001);
    const i0 = Math.floor(t0 * SR), sh = Math.floor(0.0004 * SR); for (let i = 0; i < m.length && i0 + i + sh < N; i++) { L[i0 + i] += m[i] * 1.05; Rt[i0 + i + sh] += m[i] * 0.95; }
  }
  // 메아리: 가까운 벽 여러 개(er) + 또렷한 건물 메아리(slap). 낮은 웅웅거림은 빼고, 늦게 올수록 더 먹먹하게
  const src = new Float32Array(Math.ceil(0.22 * SR)); { const hp = biq('hp', 170, 0.7), lp = onePole(P.tail[2] * 1.3); for (let i = 0; i < src.length && i < dry.length; i++) src[i] = lp(hp(dry[i])); }
  const src2 = new Float32Array(src.length); { const lp = onePole(P.tail[2] * 0.55); for (let i = 0; i < src.length; i++) src2[i] = lp(src[i]); }
  const echo = (ch, t, a, s) => { const i0 = Math.floor(t * SR); for (let i = 0; i < s.length && i0 + i < N; i++) ch[i0 + i] += s[i] * a; };
  for (const ch of [L, Rt]) {
    const [n, tA, tB, g] = P.er;
    for (let k = 0; k < n; k++) { const t = tA + (tB - tA) * Math.pow(R(), 0.8); echo(ch, t, g * (R() < 0.5 ? -1 : 1) * (0.4 + R() * 0.6) * Math.pow(1 - (t - tA) / (tB - tA + 0.001), 0.6), src); }
    for (const [t, g] of P.slap || []) echo(ch, t * (0.9 + R() * 0.2), g * (0.8 + R() * 0.4), src2);
    rollTail(ch, 0.01, P.tail[0], P.tail[1], P.tail[2], R, P.tail[3]);
    const dc = biq('hp', 28, 0.7); for (let i = 0; i < N; i++) ch[i] = dc(ch[i]); // 한쪽으로 치우친 압력(직류) 걷어내기
  }
  return fadeOut(trim(norm([L, Rt])), 0.08);
}

// ───────────── 발소리 · 장전 · 탄착 · 폭발 · 스침 ─────────────
// surf: 0 돌·콘크리트 · 1 쇠 · 2 나무 · 5 흙·풀 · 6 자갈. 뒤꿈치 '툭' 다음에 앞꿈치가 닿거나 끌리는 소리
export function bakeStep(surf, seed) {
  const R = rng(seed), o = mono(0.26), a = o[0], t2 = 0.038 + R() * 0.016;
  if (surf === 1) { burst(a, 0, 0.01, 0.8, R, biq('lp', 650)); modal(a, 0, [520 + R() * 120, 1180, 1730, 2410], 0.07, 0.35, R, 0.12); burst(a, t2, 0.007, 0.3, R, biq('bp', 2400, 1.4)); modal(a, t2, [1900, 2900], 0.03, 0.1, R, 0.1); }
  else if (surf === 2) { modal(a, 0, [170 + R() * 40, 310, 500, 760], 0.04, 0.9, R, 0.15); burst(a, 0, 0.009, 0.55, R, biq('bp', 420, 1.2)); burst(a, t2, 0.006, 0.25, R, biq('bp', 1400, 1.5)); if (R() < 0.35) modal(a, 0.05, [880 + R() * 300], 0.05, 0.08, R); }
  else if (surf === 5) { burst(a, 0, 0.016, 0.75, R, biq('lp', 420)); grains(a, 0.004, 0.08, 24, 0.32, 1300, 1.3, R, 0.004); grains(a, t2, t2 + 0.08, 12, 0.2, 2300, 1.5, R); }
  else if (surf === 6) { burst(a, 0, 0.011, 0.55, R, biq('lp', 520)); grains(a, 0.002, 0.1, 38, 0.5, 2500, 1.2, R, 0.0025); grains(a, t2, t2 + 0.1, 16, 0.32, 3500, 1.3, R, 0.002); }
  else { burst(a, 0, 0.01, 1.0, R, biq('lp', 800)); burst(a, 0, 0.0022, 0.22, R, biq('hp', 2300)); modal(a, 0, [150 + R() * 40], 0.008, 0.12, R); burst(a, t2, 0.012, 0.32, R, biq('bp', 1700, 1.2), 0.004); burst(a, t2, 0.03, 0.08, R, biq('hp', 3200), 0.01); }
  return fadeOut(norm(o, 0.9));
}
// 장전: out 탄창 빼기 · in 탄창 끼우기 · rack 노리쇠 당겼다 놓기
export function bakeReload(stage, seed) {
  const R = rng(seed), o = mono(0.32), a = o[0];
  if (stage === 'out') { burst(a, 0, 0.003, 0.5, R, biq('hp', 2500)); modal(a, 0, [2100, 3300, 4800], 0.015, 0.45, R); burst(a, 0.012, 0.045, 0.3, R, biq('bp', 1700, 1.6), 0.02); modal(a, 0.1, [1350, 2450], 0.02, 0.2, R); burst(a, 0.1, 0.012, 0.25, R, biq('lp', 400)); }
  else if (stage === 'in') { burst(a, 0, 0.028, 0.28, R, biq('bp', 1250, 1.4), 0.012); modal(a, 0.055, [1500, 2600, 3900, 5300], 0.02, 0.9, R); burst(a, 0.055, 0.022, 0.75, R, biq('lp', 250)); burst(a, 0.055, 0.0018, 0.5, R, biq('hp', 3500), 0.0001); modal(a, 0.075, [3100, 4700], 0.008, 0.25, R); }
  else { modal(a, 0, [1800, 2900, 4100], 0.012, 0.6, R); burst(a, 0, 0.0018, 0.4, R, biq('hp', 3200), 0.0001); burst(a, 0.018, 0.05, 0.22, R, biq('bp', 2600, 2), 0.012); modal(a, 0.11, [1300, 2200, 3600, 5000], 0.024, 1.0, R); burst(a, 0.11, 0.02, 0.65, R, biq('lp', 290)); burst(a, 0.11, 0.0018, 0.5, R, biq('hp', 3000), 0.0001); }
  return fadeOut(norm(o, 0.9));
}
// 총알이 맞은 자리. k: 0 돌 · 1 쇠 · 2 나무 · 3 천·몸 · 4 유리 · 5 땅
export function bakeImpact(k, seed) {
  const R = rng(seed), o = mono(k === 1 ? 0.45 : 0.32), a = o[0];
  if (k === 1) { const f = 1600 + R() * 1900; burst(a, 0, 0.0018, 0.8, R, biq('hp', 2500), 0.0001); modal(a, 0, [f, f * 1.47, f * 2.09, f * 2.93], 0.1 + R() * 0.12, 0.55, R, 0.02); burst(a, 0, 0.008, 0.3, R, biq('lp', 700)); }
  else if (k === 4) { burst(a, 0, 0.004, 0.7, R, biq('hp', 3500)); for (let i = 0; i < 10; i++) modal(a, R() * 0.2, [3500 + R() * 4500], 0.025 + R() * 0.04, 0.18 * (1 - i * 0.06), R); }
  else if (k === 2) { modal(a, 0, [230 + R() * 70, 410, 690, 980], 0.032, 0.9, R, 0.15); burst(a, 0, 0.005, 0.5, R, biq('bp', 520, 1)); grains(a, 0.01, 0.12, 8, 0.15, 2600, 1.5, R); }
  else if (k === 3) { burst(a, 0, 0.022, 0.9, R, biq('lp', 480)); modal(a, 0, [110, 180], 0.035, 0.5, R, 0.2); burst(a, 0, 0.004, 0.2, R, biq('bp', 1800, 1)); }
  else if (k === 5) { burst(a, 0, 0.028, 0.9, R, biq('lp', 600)); grains(a, 0.005, 0.22, 20, 0.25, 1100, 1.2, R, 0.004); }
  else { burst(a, 0, 0.0025, 0.9, R, biq('hp', 2300), 0.0001); burst(a, 0, 0.016, 0.6, R, biq('bp', 1250, 1.1)); grains(a, 0.015, 0.28, 18, 0.22, 2800, 1.3, R, 0.0025); }
  return fadeOut(norm(o, 0.9));
}
// 폭발: 압력파 + 먹먹해지는 굉음 + 땅이 울리는 저음 + 우르르 + 떨어지는 파편 + 주변 메아리
export function bakeBoom(seed) {
  const R = rng(seed), N = Math.ceil(2.8 * SR), L = new Float32Array(N), Rt = new Float32Array(N), d = new Float32Array(Math.ceil(0.8 * SR));
  friedlander(d, 0, 0.006, 1.4, 1.2); nwave(d, 0, 0.0012, 0.8);
  { const n = d.length, dd = Math.exp(-1 / (SR * 0.12)), lp = biq('lp', 6500, 0.6); let e = 1, f = 6500; for (let i = 0; i < n; i++) { if ((i & 15) === 0) { f = Math.max(240, 6500 * Math.pow(0.9994, i)); lp.set(f); } d[i] += lp((R() * 2 - 1) * e) * 2.3; e *= dd; } }
  { let ph = 0; const n = d.length, dd = Math.exp(-1 / (SR * 0.22)); let e = 0.8; for (let i = 0; i < n; i++) { const f = 24 + 48 * Math.exp(-i / (SR * 0.17)); ph += (2 * Math.PI * f) / SR; d[i] += e * Math.sin(ph) * Math.min(1, i / 60); e *= dd; } }
  sat(d, 3.4);
  for (let i = 0; i < d.length; i++) { L[i] += d[i]; Rt[i] += d[i]; }
  const s2 = new Float32Array(Math.floor(0.4 * SR)); { const lp = onePole(650); for (let i = 0; i < s2.length; i++) s2[i] = lp(d[i]); }
  for (const ch of [L, Rt]) {
    { const lp = biq('lp', 150, 0.6), dd = Math.exp(-1 / (SR * 0.6)); let e = 0.9; for (let i = 0; i < N; i++) { ch[i] += lp(R() * 2 - 1) * e * 1.3 * Math.min(1, i / (0.04 * SR)); e *= dd; } } // 땅이 우르르
    { const bp = biq('bp', 420, 0.8), dd = Math.exp(-1 / (SR * 0.22)); let e = 1; for (let i = 0; i < N; i++) { ch[i] += bp(R() * 2 - 1) * e * 1.1 * Math.min(1, i / (0.01 * SR)); e *= dd; } } // 불덩이가 터지며 으르렁
    grains(ch, 0.15, 1.6, 30, 0.16, 2400, 1.2, R, 0.004);
    for (let k = 0; k < 8; k++) { const i0 = Math.floor((0.09 + R() * 1.0) * SR), g = 0.26 * (1 - k * 0.08) * (R() < 0.5 ? -1 : 1); for (let i = 0; i < s2.length && i0 + i < N; i++) ch[i0 + i] += s2[i] * g; }
    rollTail(ch, 0.05, 0.12, 0.9, 700, R, 0.8);
  }
  return fadeOut(norm([L, Rt]), 0.4);
}
// 총알이 귀 옆을 스침: 충격파 '짝' + 높이가 떨어지는 '휭'
export function bakeWhiz(seed) {
  const R = rng(seed), o = mono(0.32), a = o[0];
  nwave(a, 0, 0.0004, 0.9); burst(a, 0, 0.001, 0.5, R, biq('hp', 3500), 0.0001);
  { const bp = biq('bp', 5500, 2.2), c = 0.04 + R() * 0.03; let f = 5200 + R() * 1500; for (let i = 0; i < a.length; i++) { if ((i & 31) === 0) bp.set((f *= 0.992)); const t = i / SR, e = Math.exp(-Math.pow((t - c) / 0.045, 2)); a[i] += bp(R() * 2 - 1) * e * 1.4; } }
  return fadeOut(norm(o, 0.9));
}
// 칼 휘두르기: 공기를 가르는 '휙'
export function bakeSwish(seed) {
  const R = rng(seed), o = mono(0.26), a = o[0], bp = biq('bp', 900, 1.4);
  for (let i = 0; i < a.length; i++) { const t = i / SR, u = t / 0.2, e = u < 1 ? Math.pow(Math.sin(Math.PI * u), 2) : 0; if ((i & 31) === 0) bp.set(700 + 2600 * Math.sin(Math.PI * Math.min(1, u))); a[i] += bp(R() * 2 - 1) * e; }
  return fadeOut(norm(o, 0.9));
}
// 맞혔을 때 '틱' / 머리 '팅'
export function bakeTick(kind) {
  const R = rng(kind === 'head' ? 7 : 3), o = mono(kind === 'head' ? 0.42 : 0.1), a = o[0];
  if (kind === 'head') { modal(a, 0, [2093, 3140, 4710, 6280], 0.13, 0.7, R, 0); burst(a, 0, 0.002, 0.5, R, biq('hp', 4000), 0.0001); modal(a, 0, [1046], 0.05, 0.3, R, 0); }
  else { modal(a, 0, [3100, 4900], 0.012, 0.8, R, 0); burst(a, 0, 0.0015, 0.6, R, biq('hp', 3500), 0.0001); modal(a, 0, [1250], 0.02, 0.35, R, 0); }
  return fadeOut(norm(o, 0.9), 0.01);
}
// 공간 울림(컨볼버): 초기 반사 몇 개 + 높은 소리부터 먼저 잦아드는 좌우가 다른 잔향
export function bakeIR(sec = 1.6, seed = 11) {
  const R = rng(seed), N = Math.ceil(sec * SR), out = [new Float32Array(N), new Float32Array(N)];
  for (const ch of out) {
    for (let k = 0; k < 10; k++) { const i = Math.floor((0.004 + R() * 0.06) * SR); ch[i] += (R() < 0.5 ? -1 : 1) * (0.3 + R() * 0.5) * (1 - k * 0.06); }
    const lp = biq('lp', 7000, 0.6); let f = 7000;
    for (let i = 0; i < N; i++) { const t = i / N; if ((i & 63) === 0) { f = 7000 * Math.pow(500 / 7000, Math.min(1, t * 1.3)); lp.set(f); } ch[i] += lp(R() * 2 - 1) * Math.pow(1 - t, 2.4) * 0.5 * Math.min(1, i / (0.01 * SR)); }
  }
  return norm(out, 0.6);
}

// ───────────── 구울 목록 (자주 듣는 것부터) ─────────────
// where: 넣을 곳 (top 이면 맨 위 목록, ir 이면 공간 울림) · key: 이름 · half: 높은 소리가 없어 절반 표본률·한 줄로 (메모리 절약)
export function bakeList() {
  const L = [], cats = Object.keys(GUN);
  let seed = 1;
  const add = (where, key, fn, half = false) => { const s = seed++; L.push({ where, key, half, fn: () => fn(s) }); };
  for (let v = 0; v < 3; v++) for (const c of cats) if (v < 2 || 'side smg ar mg'.includes(c)) add('shot', c, (s) => bakeShot(GUN[c], s)); // 연사하는 총은 세 가지, 나머지는 두 가지
  for (const g of ['side', 'smg', 'ar', 'sr']) for (let v = 0; v < 2; v++) add('sup', g, (s) => bakeShot(SUP(GUN[g]), s));
  for (const f of [0, 1, 2, 5, 6]) for (let v = 0; v < 4; v++) add('step', f, (s) => bakeStep(f, s));
  for (let k = 0; k < 6; k++) for (let v = 0; v < 3; v++) add('imp', k, (s) => bakeImpact(k, s));
  for (const st of ['out', 'in', 'rack']) for (let v = 0; v < 2; v++) add('reload', st, (s) => bakeReload(st, s));
  add('tick', 'hit', () => bakeTick('hit')); add('tick', 'head', () => bakeTick('head'));
  for (let v = 0; v < 3; v++) add('top', 'whiz', (s) => bakeWhiz(s));
  for (let v = 0; v < 2; v++) add('top', 'swish', (s) => bakeSwish(s));
  for (let v = 0; v < 2; v++) for (const c of cats) add('far', c, (s) => bakeShot(FAR(GUN[c]), s), true);
  for (let v = 0; v < 2; v++) add('top', 'boom', (s) => bakeBoom(s));
  add('ir', '', () => bakeIR(1.6));
  return L;
}
// 목록 하나 굽기 (sr: 원래 표본률)
export function runJob(j, sr) {
  if (!j.half) { setRate(sr); return j.fn(); }
  setRate(sr / 2);
  try { return [j.fn()[0]]; } finally { setRate(sr); }
}
