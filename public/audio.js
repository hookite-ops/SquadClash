// SQUAD CLASH — 소리. 녹음 파일 없이 전부 그 자리에서 만든다 (잡음과 떨림을 깎고 겹쳐서).
// 총소리는 '탁' 하는 머리 + 몸통 + 낮게 치는 울림 + 멀리 퍼지는 잔향을 겹치고, 멀수록 먹먹하고 늦게 들린다.
import { WEAPONS } from './shared.js';

let AC = null, master = null, comp = null, rev = null, noiseBuf = null;
let volume = 0.8, lastShotAt = 0, shotBurst = 0;
const R = Math.random;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const audioOn = () => !!AC;
export function setVolume(v) { volume = clamp(v, 0, 1); if (master) master.gain.value = volume; }
export function initAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = volume;
      comp = AC.createDynamicsCompressor(); comp.threshold.value = -8; comp.knee.value = 12; comp.ratio.value = 2.5; comp.attack.value = 0.006; comp.release.value = 0.18; // 여러 소리가 겹쳐도 찢어지지 않게 눌러 줌
      master.connect(comp).connect(AC.destination);
      const sr = AC.sampleRate;
      noiseBuf = AC.createBuffer(1, sr * 1.5, sr);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1;
      // 잔향: 점점 잦아들고 먹먹해지는 잡음 (탁 트인 곳에서 메아리치는 느낌)
      const len = Math.floor(sr * 1.7), ir = AC.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len, k = 0.1 + 0.75 * t; lp += ((R() * 2 - 1) - lp) * (1 - k); ch[i] = lp * Math.pow(1 - t, 2.6) * (i < sr * 0.012 ? i / (sr * 0.012) : 1); } }
      rev = AC.createConvolver(); rev.buffer = ir;
      const rg = AC.createGain(); rg.gain.value = 0.9; rev.connect(rg).connect(master);
    }
    if (AC.state === 'suspended') AC.resume();
  } catch { AC = null; }
}
// 소리 하나가 나가는 길: 좌우 방향(pan)과 잔향으로 보내는 양(send)
function out(pan, send = 0) {
  const g = AC.createGain();
  if (pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p).connect(master); } else g.connect(master);
  if (send > 0 && rev) { const s = AC.createGain(); s.gain.value = send; g.connect(s).connect(rev); }
  return g;
}
// 잡음 한 줄기: type 거르개로 f0 → f1 을 훑으며 dur 초 동안 잦아듦
function noise(t, dur, type, f0, f1, q, peak, dst, attack = 0.002) {
  if (peak < 0.0008) return;
  const src = AC.createBufferSource(); src.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(Math.max(30, f0), t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(peak * 0.012, t + attack + dur); g.gain.linearRampToValueAtTime(0, t + attack + dur + 0.015);
  src.connect(f).connect(g).connect(dst); src.start(t, R() * 1.2); src.stop(t + attack + dur + 0.03);
}
// 떨림 한 줄기: f0 → f1 로 미끄러지며 잦아듦
function tone(t, dur, type, f0, f1, peak, dst, attack = 0.003) {
  if (peak < 0.0008) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(peak * 0.012, t + attack + dur); g.gain.linearRampToValueAtTime(0, t + attack + dur + 0.015);
  o.connect(g).connect(dst); o.start(t); o.stop(t + attack + dur + 0.03);
}

// ───────────── 총소리 ─────────────
// crack 머리의 세기 · body [시작, 끝 주파수, 길이] · thump [시작, 끝, 길이] · tail 잔향
const SHOT = {
  side: { crack: 0.5, body: [1500, 520, 0.14], thump: [230, 62, 0.11], tail: 0.2 },
  smg: { crack: 0.45, body: [1800, 620, 0.12], thump: [210, 60, 0.09], tail: 0.18 },
  ar: { crack: 0.6, body: [1250, 380, 0.19], thump: [172, 48, 0.15], tail: 0.3 },
  sg: { crack: 0.5, body: [820, 200, 0.36], thump: [128, 38, 0.3], tail: 0.45 },
  sr: { crack: 0.85, body: [920, 210, 0.46], thump: [118, 33, 0.4], tail: 0.65 },
  mg: { crack: 0.55, body: [1050, 320, 0.2], thump: [150, 44, 0.16], tail: 0.32 },
};
// far 0~1: 멀수록 먹먹함. delay: 소리가 늦게 닿는 시간(초). quiet: 소음기
export function sfxShot(wi, vol, pan = 0, far = 0, delay = 0, quiet = false) {
  const W = WEAPONS[wi];
  if (!AC || !W) return;
  if (W.melee) { const t = AC.currentTime, dst = out(pan); noise(t, 0.09, 'bandpass', 2600, 900, 0.8, vol * 0.5, dst, 0.012); return; } // 칼 휘두르는 소리
  quiet = quiet || !!W.quiet;
  if (quiet) vol *= 0.42;
  if (vol < 0.02) return;
  vol *= 2.3;
  const now = AC.currentTime;
  if (now - lastShotAt < 0.03) { if (++shotBurst > 3 && far > 0.2) return; } else shotBurst = 0; // 한꺼번에 너무 많이 겹치면 먼 소리는 건너뜀
  lastShotAt = now;
  const S = SHOT[W.pellets > 1 ? 'sg' : W.dmg > 50 && W.cat === 'side' ? 'sr' : W.cat] || SHOT.ar, t = now + delay, p = 0.94 + R() * 0.12; // 쏠 때마다 높낮이가 조금씩 다름
  const dst = out(pan, quiet ? 0.04 : S.tail * (0.5 + far * 1.3));
  if (quiet) { // 소음기: 짧고 낮은 '픽'
    noise(t, 0.09, 'bandpass', 1500 * p, 600, 1.1, vol * 1.3, dst); tone(t, 0.08, 'triangle', 150 * p, 60, vol * 0.6, dst);
    return;
  }
  const near = 1 - far, lpK = 1 - 0.86 * far, len = 1 + far * 0.6;
  noise(t, 0.03, 'highpass', 2600, 2600, 0.7, vol * S.crack * near * near, dst, 0.0006);                       // 머리: '탁'
  noise(t, S.body[2] * len, 'lowpass', S.body[0] * 3.2 * p * lpK + 300, S.body[1] * lpK + 120, 0.8, vol * 0.75, dst, 0.001); // 몸통
  if (far < 0.7) noise(t, S.body[2] * 0.6, 'bandpass', S.body[0] * p, S.body[1], 1.1, vol * 0.4 * near, dst, 0.001);
  tone(t, S.thump[2] * len, 'triangle', S.thump[0] * p, S.thump[1], vol * 0.62, dst, 0.001);                    // 낮게 치는 울림
}
// ───────────── 얼티밋 스킨 소리: 총소리에 겹치는 전용 소리 · 꺼낼 때 · 처치할 때 ─────────────
// kind: prime 플래티넘 · blade 다마스커스 · shard 흑요석 · crystal 다이아몬드 · reactor 아토믹 · star 오리온 · void 다크 매터
export function sfxSkin(kind, what, vol = 1, pan = 0, far = 0, delay = 0) {
  if (!AC || !kind || vol < 0.02) return;
  const t = AC.currentTime + delay, near = 1 - far, d = out(pan, what === 'shot' ? 0.12 + far * 0.4 : 0.18), p = 0.96 + R() * 0.08;
  const T = (dt, len, type, f0, f1, v, at = 0.002) => tone(t + dt, len, type, f0 * p, f1 * p, v * vol, d, at), N = (dt, len, type, f0, f1, q, v, at = 0.001) => noise(t + dt, len, type, f0, f1, q, v * vol, d, at);
  if (what === 'shot') {
    vol *= near * 0.9 + 0.1;
    if (kind === 'prime') { T(0, 0.09, 'sine', 2600, 1300, 0.16); T(0.004, 0.06, 'square', 5200, 3100, 0.025); N(0, 0.07, 'bandpass', 6000, 3500, 3, 0.08); }
    else if (kind === 'blade') { T(0, 0.22, 'triangle', 3150, 3000, 0.07); T(0, 0.18, 'sine', 4420, 4300, 0.05); N(0, 0.05, 'highpass', 7000, 4000, 1, 0.1); }
    else if (kind === 'shard') { N(0, 0.06, 'highpass', 6500, 3000, 0.8, 0.16); T(0, 0.07, 'triangle', 2700, 1900, 0.06); T(0.01, 0.12, 'sine', 3900, 3500, 0.03); }
    else if (kind === 'crystal') { T(0, 0.28, 'sine', 1760, 1760, 0.07); T(0, 0.22, 'sine', 2637, 2637, 0.05); T(0, 0.16, 'sine', 3520, 3520, 0.03); N(0, 0.03, 'highpass', 8000, 8000, 1, 0.07); }
    else if (kind === 'reactor') { T(0, 0.12, 'sawtooth', 920, 110, 0.11); T(0, 0.16, 'sine', 90, 42, 0.2); N(0, 0.09, 'bandpass', 3000, 600, 2, 0.08); }
    else if (kind === 'star') { T(0, 0.12, 'sine', 1400, 2800, 0.08); T(0.03, 0.2, 'sine', 2100, 2100, 0.05); N(0, 0.05, 'bandpass', 5000, 9000, 4, 0.05); }
    else if (kind === 'void') { T(0, 0.22, 'sine', 120, 38, 0.26); N(0, 0.12, 'bandpass', 300, 2400, 3, 0.1, 0.06); T(0.02, 0.1, 'sawtooth', 220, 70, 0.05); }
    else if (kind === 'race') { T(0, 0.08, 'sawtooth', 340, 180, 0.08); N(0, 0.05, 'bandpass', 1800, 900, 2, 0.08); }
    else if (kind === 'beast') { T(0, 0.14, 'sawtooth', 110, 60, 0.12); N(0, 0.12, 'lowpass', 900, 200, 1, 0.12); }
    else if (kind === 'petal') { T(0, 0.2, 'sine', 1568, 1568, 0.06); T(0.02, 0.18, 'sine', 2349, 2349, 0.04); N(0, 0.06, 'bandpass', 4000, 6000, 3, 0.04, 0.02); }
    else if (kind === 'frost') { N(0, 0.07, 'highpass', 5000, 2500, 1, 0.14); T(0, 0.12, 'triangle', 3600, 2400, 0.05); }
    else if (kind === 'cyber') { T(0, 0.07, 'square', 1800, 600, 0.05); T(0, 0.1, 'sawtooth', 880, 220, 0.06); }
    else if (kind === 'magma') { N(0, 0.2, 'lowpass', 1400, 150, 0.8, 0.18); T(0, 0.18, 'sine', 70, 35, 0.2); }
    else if (kind === 'royal') { T(0, 0.3, 'triangle', 1318, 1318, 0.06); T(0, 0.26, 'sine', 1975, 1975, 0.04); }
    else if (kind === 'cosmic') { T(0, 0.16, 'sine', 600, 2400, 0.07); T(0, 0.2, 'sine', 300, 120, 0.12); }
    else if (kind === 'prism') { T(0, 0.18, 'sine', 2093, 2637, 0.05); T(0.02, 0.18, 'sine', 3136, 3520, 0.04); }
    else if (kind === 'spooky') { T(0, 0.22, 'sine', 520, 380, 0.06); T(0, 0.18, 'triangle', 260, 180, 0.08); N(0, 0.1, 'bandpass', 700, 300, 4, 0.06, 0.03); }
    else if (kind === 'mecha') { T(0, 0.1, 'square', 1200, 300, 0.05); T(0, 0.14, 'sine', 140, 55, 0.18); N(0, 0.06, 'bandpass', 3500, 1500, 2, 0.08); }
    else if (kind === 'dragon') { T(0, 0.18, 'sawtooth', 160, 70, 0.1); N(0, 0.16, 'lowpass', 2200, 300, 0.8, 0.16); T(0, 0.12, 'sine', 80, 40, 0.18); }
    else if (kind === 'phoenix') { N(0, 0.14, 'bandpass', 3000, 900, 1.5, 0.12); T(0, 0.2, 'triangle', 1568, 1318, 0.05); T(0, 0.16, 'sine', 110, 60, 0.12); }
    else if (kind === 'aqua') { T(0, 0.12, 'sine', 2200, 800, 0.08); T(0.01, 0.1, 'square', 3300, 1600, 0.025); N(0, 0.08, 'bandpass', 5000, 2500, 3, 0.06); }
    return;
  }
  if (what === 'equip') {
    if (kind === 'prime') { [880, 1320, 1760].forEach((f, i) => T(i * 0.06, 0.18, 'sine', f, f, 0.07)); N(0, 0.25, 'bandpass', 2000, 7000, 2, 0.05, 0.08); }
    else if (kind === 'blade') { N(0, 0.32, 'bandpass', 2500, 7000, 4, 0.12, 0.2); T(0.3, 0.6, 'triangle', 3150, 3100, 0.07); T(0.3, 0.5, 'sine', 4420, 4400, 0.05); }
    else if (kind === 'shard') { N(0, 0.2, 'highpass', 3000, 8000, 1, 0.08, 0.1); [2700, 2000, 3400].forEach((f, i) => T(0.05 + i * 0.05, 0.12, 'triangle', f, f * 0.9, 0.05)); }
    else if (kind === 'crystal') { [1760, 2217, 2637, 3520].forEach((f, i) => T(i * 0.07, 0.5, 'sine', f, f, 0.06)); }
    else if (kind === 'reactor') { T(0, 0.6, 'sawtooth', 60, 240, 0.08, 0.05); T(0, 0.6, 'sine', 120, 480, 0.08, 0.05); N(0.5, 0.1, 'bandpass', 2000, 900, 2, 0.08); }
    else if (kind === 'star') { [1047, 1319, 1568, 2093].forEach((f, i) => T(i * 0.08, 0.45, 'sine', f, f, 0.06)); N(0, 0.4, 'bandpass', 6000, 10000, 5, 0.04, 0.1); }
    else if (kind === 'void') { N(0, 0.5, 'bandpass', 200, 3000, 2, 0.12, 0.45); T(0.45, 0.4, 'sine', 70, 35, 0.3); }
    else if (kind === 'race') { T(0, 0.55, 'sawtooth', 90, 420, 0.07, 0.05); T(0.5, 0.2, 'sawtooth', 420, 300, 0.05); N(0.5, 0.15, 'bandpass', 1200, 600, 2, 0.06); }
    else if (kind === 'beast') { T(0, 0.6, 'sawtooth', 80, 120, 0.12, 0.1); N(0, 0.6, 'lowpass', 600, 300, 1, 0.12, 0.15); }
    else if (kind === 'petal') { [1047, 1319, 1568, 2093].forEach((f, i) => T(i * 0.09, 0.5, 'sine', f, f, 0.05)); N(0, 0.5, 'bandpass', 5000, 3000, 3, 0.03, 0.2); }
    else if (kind === 'frost') { N(0, 0.4, 'highpass', 2000, 7000, 1, 0.07, 0.2); [3136, 2637, 3520].forEach((f, i) => T(0.1 + i * 0.07, 0.3, 'triangle', f, f, 0.04)); }
    else if (kind === 'cyber') { [440, 660, 880, 1320].forEach((f, i) => T(i * 0.05, 0.08, 'square', f, f, 0.04)); T(0.22, 0.3, 'sawtooth', 220, 880, 0.04); }
    else if (kind === 'magma') { N(0, 0.7, 'lowpass', 300, 1400, 0.8, 0.14, 0.4); T(0.4, 0.4, 'sine', 60, 40, 0.25); }
    else if (kind === 'royal') { [784, 988, 1175, 1568].forEach((f, i) => T(i * 0.1, 0.5, 'triangle', f, f, 0.06)); }
    else if (kind === 'cosmic') { T(0, 0.6, 'sine', 200, 1600, 0.07, 0.1); T(0.3, 0.5, 'sine', 2400, 2400, 0.04); N(0, 0.6, 'bandpass', 800, 6000, 4, 0.04, 0.3); }
    else if (kind === 'prism') { [1568, 1976, 2349, 2794, 3136].forEach((f, i) => T(i * 0.05, 0.4, 'sine', f, f, 0.045)); }
    else if (kind === 'spooky') { T(0, 0.8, 'sine', 400, 260, 0.07, 0.2); T(0.05, 0.8, 'sine', 410, 250, 0.05, 0.2); N(0.3, 0.3, 'bandpass', 900, 400, 6, 0.05, 0.05); }
    else if (kind === 'mecha') { T(0, 0.5, 'sawtooth', 80, 320, 0.07, 0.05); [0.15, 0.3, 0.45].forEach((d) => N(d, 0.03, 'bandpass', 2400, 1800, 3, 0.1)); T(0.5, 0.3, 'sine', 880, 1320, 0.06); }
    else if (kind === 'dragon') { T(0, 0.9, 'sawtooth', 90, 160, 0.14, 0.15); N(0, 0.9, 'lowpass', 500, 1500, 0.8, 0.14, 0.3); T(0.4, 0.5, 'sawtooth', 200, 90, 0.08); }
    else if (kind === 'phoenix') { N(0, 0.7, 'bandpass', 600, 4000, 1.5, 0.1, 0.3); [1319, 1760, 2349].forEach((f, i) => T(0.3 + i * 0.08, 0.5, 'triangle', f, f, 0.05)); }
    else if (kind === 'aqua') { T(0, 0.5, 'sine', 300, 1800, 0.07, 0.05); N(0.1, 0.4, 'bandpass', 1500, 6000, 3, 0.06, 0.1); T(0.45, 0.25, 'sine', 2400, 2400, 0.05); }
    return;
  }
  // 처치
  if (kind === 'prime') { [1320, 1760, 2640].forEach((f, i) => T(i * 0.05, 0.3, 'sine', f, f, 0.08)); T(0, 0.2, 'square', 220, 110, 0.03); }
  else if (kind === 'blade') { N(0, 0.14, 'bandpass', 3000, 9000, 3, 0.14, 0.1); T(0.14, 0.9, 'triangle', 3150, 3100, 0.08); T(0.14, 0.7, 'sine', 4420, 4400, 0.06); T(0.14, 0.4, 'sine', 196, 180, 0.12); }
  else if (kind === 'shard') { N(0, 0.4, 'highpass', 4000, 2000, 0.8, 0.2); for (let i = 0; i < 6; i++) T(i * 0.03, 0.1, 'triangle', 2000 + R() * 3000, 1500, 0.05); }
  else if (kind === 'crystal') { [2637, 3136, 3951, 5274].forEach((f, i) => T(i * 0.05, 0.6, 'sine', f, f, 0.06)); N(0, 0.3, 'highpass', 7000, 7000, 1, 0.08); }
  else if (kind === 'reactor') { T(0, 0.5, 'sine', 160, 30, 0.35); N(0, 0.6, 'lowpass', 2400, 120, 0.7, 0.3, 0.003); T(0, 0.25, 'sawtooth', 1200, 80, 0.07); }
  else if (kind === 'star') { [1568, 2093, 2637, 3136, 4186].forEach((f, i) => T(i * 0.06, 0.5, 'sine', f, f, 0.05)); }
  else if (kind === 'void') { N(0, 0.35, 'bandpass', 3000, 150, 2, 0.16, 0.3); T(0.32, 0.7, 'sine', 55, 28, 0.42); T(0.32, 0.3, 'sawtooth', 110, 40, 0.06); }
  else if (kind === 'race') { T(0, 0.7, 'sawtooth', 600, 200, 0.07); T(0, 0.7, 'sawtooth', 640, 210, 0.05); N(0, 0.3, 'bandpass', 2000, 800, 2, 0.08); }
  else if (kind === 'beast') { T(0, 0.9, 'sawtooth', 140, 70, 0.16, 0.08); N(0, 0.9, 'lowpass', 1200, 200, 1, 0.16, 0.08); }
  else if (kind === 'petal') { [2093, 2637, 3136, 4186].forEach((f, i) => T(i * 0.06, 0.7, 'sine', f, f, 0.05)); N(0, 0.6, 'bandpass', 3000, 6000, 2, 0.05, 0.1); }
  else if (kind === 'frost') { N(0, 0.5, 'highpass', 6000, 2000, 0.8, 0.18); for (let i = 0; i < 5; i++) T(i * 0.04, 0.2, 'triangle', 2500 + R() * 2500, 2000, 0.04); }
  else if (kind === 'cyber') { [880, 1320, 1760, 2640].forEach((f, i) => T(i * 0.06, 0.12, 'square', f, f, 0.04)); N(0.25, 0.3, 'bandpass', 4000, 1000, 3, 0.06); }
  else if (kind === 'magma') { N(0, 0.9, 'lowpass', 2000, 100, 0.8, 0.3, 0.003); T(0, 0.6, 'sine', 90, 25, 0.35); }
  else if (kind === 'royal') { [1047, 1319, 1568, 2093].forEach((f, i) => T(i * 0.08, 0.8, 'triangle', f, f, 0.06)); for (let i = 0; i < 6; i++) T(0.3 + i * 0.05, 0.08, 'sine', 3000 + R() * 2000, 2800, 0.03); }
  else if (kind === 'cosmic') { T(0, 0.8, 'sine', 2400, 120, 0.1); T(0.1, 0.9, 'sine', 600, 600, 0.04); N(0, 0.8, 'bandpass', 6000, 400, 3, 0.06); }
  else if (kind === 'prism') { [2093, 2637, 3136, 3951, 4699, 5274].forEach((f, i) => T(i * 0.05, 0.6, 'sine', f, f, 0.04)); }
  else if (kind === 'spooky') { T(0, 1.0, 'sine', 600, 300, 0.08, 0.1); T(0, 1.0, 'sine', 612, 290, 0.06, 0.1); for (let i = 0; i < 4; i++) N(0.1 + i * 0.08, 0.06, 'bandpass', 3000, 2000, 6, 0.05); }
  else if (kind === 'mecha') { T(0, 0.6, 'sine', 140, 40, 0.3); N(0, 0.5, 'lowpass', 3000, 200, 0.8, 0.22, 0.003); [1320, 1760, 2640].forEach((f, i) => T(0.15 + i * 0.06, 0.25, 'square', f, f, 0.03)); }
  else if (kind === 'dragon') { T(0, 1.2, 'sawtooth', 180, 60, 0.18, 0.06); N(0, 1.2, 'lowpass', 2500, 200, 0.8, 0.2, 0.06); N(0.1, 0.7, 'bandpass', 800, 300, 1, 0.12, 0.1); }
  else if (kind === 'phoenix') { N(0, 1.0, 'bandpass', 300, 5000, 1, 0.16, 0.2); [1568, 2093, 2637, 3136].forEach((f, i) => T(0.25 + i * 0.07, 0.7, 'triangle', f, f, 0.05)); }
  else if (kind === 'aqua') { T(0, 0.7, 'sine', 1800, 200, 0.1); N(0, 0.8, 'bandpass', 6000, 500, 3, 0.1); [2093, 2637].forEach((f, i) => T(0.2 + i * 0.1, 0.4, 'sine', f, f, 0.05)); }
}
export function sfxBoom(vol = 0.9, dur = 1.8, pan = 0) {
  if (!AC || vol < 0.02) return;
  vol *= 1.5;
  const t = AC.currentTime, dst = out(pan, 0.55);
  noise(t, 0.05, 'highpass', 1400, 1400, 0.7, vol * 0.55, dst, 0.0006);
  noise(t, dur * 0.75, 'lowpass', 1500, 70, 0.8, vol * 0.95, dst, 0.002);
  tone(t, Math.min(0.9, dur * 0.6), 'sine', 88, 27, vol * 0.95, dst, 0.002);
  for (let i = 0; i < 7; i++) noise(t + 0.08 + R() * dur * 0.4, 0.02 + R() * 0.03, 'bandpass', 1800 + R() * 2600, 1200, 2, vol * (0.1 + R() * 0.12), dst, 0.001); // 파편 떨어지는 소리
}
// 발소리·부딪는 소리. surf: 0 돌·콘크리트 · 1 쇠 · 2 나무 · 5 흙·모래·풀 · 6 자갈
export function sfxStep(vol, pan = 0, surf = 0) {
  if (!AC || vol < 0.012) return;
  vol *= 4.5;
  const t = AC.currentTime, dst = out(pan);
  if (surf === 1) { noise(t, 0.05, 'bandpass', 2400, 1700, 1.5, vol * 0.7, dst); tone(t, 0.2, 'sine', 600 + R() * 220, 560, vol * 0.16, dst); tone(t, 0.14, 'sine', 1150 + R() * 320, 1080, vol * 0.07, dst); }
  else if (surf === 2) { noise(t, 0.11, 'bandpass', 330 + R() * 90, 250, 3.5, vol * 1.6, dst); noise(t, 0.03, 'highpass', 1800, 1800, 0.7, vol * 0.25, dst); }
  else if (surf === 5) noise(t, 0.14, 'bandpass', 720 + R() * 300, 420, 0.9, vol * 1.0, dst, 0.012);
  else if (surf === 6) { noise(t, 0.12, 'bandpass', 2500 + R() * 900, 1500, 1.2, vol * 0.7, dst, 0.004); noise(t + 0.028, 0.08, 'bandpass', 3300, 2000, 1.5, vol * 0.4, dst); }
  else { noise(t, 0.06, 'bandpass', 1500 + R() * 500, 900, 1.3, vol * 0.8, dst); noise(t, 0.1, 'lowpass', 270, 120, 0.7, vol * 1.1, dst); }
}
export function sfxSplash(vol) {
  if (!AC || vol < 0.015) return;
  const t = AC.currentTime, dst = out(0);
  noise(t, 0.22, 'bandpass', 900 + R() * 500, 600, 0.7, vol, dst, 0.01); noise(t + 0.03, 0.12, 'highpass', 3000, 3000, 0.7, vol * 0.3, dst, 0.01);
}
// 예전부터 쓰던 단순한 '삐' 소리 (알림음 등)
export function sfxTone(freq, dur, vol, type = 'sine', to = freq) {
  if (!AC) return;
  tone(AC.currentTime, dur, type, freq, to, vol, master, 0.004);
}
// 총알이 맞은 자리. k: 0 돌 · 1 쇠 · 2 나무 · 3 천 · 4 유리 · 5 땅
export function sfxImpact(k, vol, pan) {
  if (!AC || vol < 0.02) return;
  vol *= 1.8;
  const t = AC.currentTime, dst = out(pan, 0.05);
  if (k === 1) { noise(t, 0.02, 'highpass', 3000, 3000, 0.7, vol * 0.3, dst, 0.0006); const f = 1900 + R() * 2600; tone(t, 0.16, 'sine', f, f * 0.96, vol * 0.11, dst, 0.001); tone(t, 0.1, 'sine', f * 1.52, f * 1.5, vol * 0.05, dst, 0.001); }
  else if (k === 4) { for (let i = 0; i < 4; i++) tone(t + i * 0.018 + R() * 0.01, 0.07, 'sine', 3800 + R() * 3600, 3000, vol * 0.07, dst, 0.001); noise(t, 0.04, 'highpass', 5000, 5000, 0.7, vol * 0.18, dst, 0.001); }
  else if (k === 2) { noise(t, 0.06, 'bandpass', 380 + R() * 140, 240, 3, vol * 0.55, dst, 0.001); noise(t, 0.02, 'highpass', 2200, 2200, 0.7, vol * 0.2, dst, 0.001); }
  else if (k === 3) noise(t, 0.06, 'bandpass', 900, 500, 0.8, vol * 0.2, dst, 0.004);
  else if (k === 5) noise(t, 0.08, 'lowpass', 900, 200, 0.8, vol * 0.4, dst, 0.002);
  else { noise(t, 0.03, 'bandpass', 2400 + R() * 1200, 1200, 1.2, vol * 0.4, dst, 0.0008); noise(t, 0.06, 'lowpass', 500, 180, 0.8, vol * 0.3, dst, 0.001); }
}
export function sfxWhiz(vol, pan) { // 총알이 귀 옆을 스침
  if (!AC) return;
  const t = AC.currentTime, dst = out(pan);
  noise(t, 0.16, 'bandpass', 4200 + R() * 1500, 900, 2.2, vol * 3, dst, 0.008); noise(t, 0.02, 'highpass', 3500, 3500, 0.7, vol * 1.4, dst, 0.0006);
}
// 장전: out 탄창 빼기 · in 탄창 끼우기 · rack 노리쇠 당기기
export function sfxReload(stage, vol = 1) {
  if (!AC) return;
  vol *= 2.6;
  const t = AC.currentTime, dst = out(0);
  if (stage === 'out') { noise(t, 0.012, 'highpass', 3200, 3200, 0.7, 0.12 * vol, dst, 0.0006); noise(t + 0.02, 0.1, 'bandpass', 1900, 800, 1.4, 0.07 * vol, dst, 0.01); }
  else if (stage === 'in') { noise(t, 0.03, 'bandpass', 1300, 900, 2.2, 0.16 * vol, dst, 0.0008); noise(t, 0.05, 'lowpass', 340, 160, 0.8, 0.14 * vol, dst, 0.001); noise(t + 0.055, 0.012, 'highpass', 3000, 3000, 0.7, 0.09 * vol, dst, 0.0006); }
  else { noise(t, 0.016, 'highpass', 2800, 2800, 0.7, 0.13 * vol, dst, 0.0006); tone(t, 0.07, 'sine', 940, 900, 0.03 * vol, dst, 0.001); noise(t + 0.085, 0.022, 'bandpass', 1700, 1100, 2, 0.17 * vol, dst, 0.0006); noise(t + 0.085, 0.04, 'lowpass', 300, 150, 0.8, 0.1 * vol, dst, 0.001); }
}
// 알림·조작 소리
const UIK = { click: 2.6, hit: 3.6, head: 2.8, equip: 2.6, hurt: 2.6, error: 2, beat: 1.6, pickup: 2, buy: 2, radio: 2.2 }; // 종류별 세기 보정
export function sfxUI(k, vol = 1) {
  if (!AC) return;
  vol *= UIK[k] || 1.4;
  const t = AC.currentTime, d = out(0, 0.08), n = (dt, f, len, v, type = 'sine', to = f) => tone(t + dt, len, type, f, to, v * vol, d, 0.004);
  if (k === 'click') { n(0, 760, 0.045, 0.06, 'sine', 620); }
  else if (k === 'buy') { n(0, 880, 0.07, 0.08, 'triangle'); n(0.07, 1320, 0.14, 0.08, 'triangle'); }
  else if (k === 'error') { n(0, 190, 0.16, 0.09, 'square', 150); }
  else if (k === 'equip') { noise(t, 0.09, 'bandpass', 1400, 2600, 1, 0.07 * vol, d, 0.02); noise(t + 0.09, 0.03, 'bandpass', 900, 700, 2, 0.11 * vol, d, 0.001); }
  else if (k === 'hit') { n(0, 1250, 0.05, 0.11, 'triangle', 1100); noise(t, 0.012, 'highpass', 4000, 4000, 0.7, 0.05 * vol, d, 0.0006); }
  else if (k === 'head') { n(0, 1900, 0.14, 0.12, 'sine', 1860); n(0, 2850, 0.1, 0.05); noise(t, 0.012, 'highpass', 5000, 5000, 0.7, 0.07 * vol, d, 0.0006); }
  else if (k === 'kill') { n(0, 660, 0.12, 0.12, 'triangle'); n(0.1, 990, 0.22, 0.13, 'triangle'); }
  else if (k === 'multi') { n(0, 660, 0.1, 0.12, 'triangle'); n(0.09, 880, 0.1, 0.12, 'triangle'); n(0.18, 1320, 0.28, 0.14, 'triangle'); }
  else if (k === 'level') { [660, 880, 1100, 1320, 1760].forEach((f, i) => n(i * 0.07, f, 0.2, 0.1, 'triangle')); }
  else if (k === 'start') { n(0, 392, 0.16, 0.09, 'sawtooth'); n(0.02, 587, 0.2, 0.07, 'triangle'); n(0.16, 784, 0.34, 0.09, 'triangle'); }
  else if (k === 'win') { [523, 659, 784, 1047].forEach((f, i) => n(i * 0.12, f, 0.34, 0.11, 'triangle')); n(0.5, 1319, 0.6, 0.09, 'sine'); }
  else if (k === 'lose') { [440, 370, 311, 247].forEach((f, i) => n(i * 0.16, f, 0.36, 0.1, 'triangle')); }
  else if (k === 'pickup') { n(0, 620, 0.06, 0.09, 'triangle'); n(0.055, 930, 0.1, 0.09, 'triangle'); }
  else if (k === 'radio') { noise(t, 0.05, 'bandpass', 2200, 2200, 3, 0.05 * vol, d, 0.002); n(0.03, 1040, 0.07, 0.07, 'sine', 1240); }
  else if (k === 'hurt') { n(0, 170, 0.15, 0.2, 'sawtooth', 70); noise(t, 0.06, 'lowpass', 500, 160, 0.8, 0.16 * vol, d, 0.001); }
  else if (k === 'beat') { n(0, 58, 0.14, 0.22, 'sine', 40); n(0.17, 50, 0.12, 0.16, 'sine', 36); }
}

// ───────────── 배경음: 맵마다 바람·새소리·웅웅거림 ─────────────
const AMB = { // wind [거르개 주파수, 크기], hum 낮은 웅웅거림, birds 새소리 잦기(초), water 물결
  town: { wind: [520, 0.045], birds: 14 }, dock: { wind: [420, 0.04], hum: 0.012, water: 0.02 }, station: { wind: [380, 0.03], hum: 0.02 },
  castle: { wind: [460, 0.035], birds: 5 }, city: { wind: [300, 0.025], hum: 0.028 }, isle: { wind: [420, 0.05], birds: 7, water: 0.012 },
};
let amb = null;
export function setAmbient(kind) { // kind: 맵 분위기 이름, 끄려면 null
  if (!AC || (amb ? amb.kind : null) === (kind || null)) return;
  if (amb) { const a = amb; amb = null; a.g.gain.setTargetAtTime(0, AC.currentTime, 0.4); clearInterval(a.timer); setTimeout(() => { for (const n of a.nodes) { try { n.stop(); } catch {} } }, 1500); }
  const A = AMB[kind];
  if (!A) return;
  const g = AC.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, AC.currentTime, 1.2); g.connect(master);
  const nodes = [], src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true; nodes.push(src);
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = A.wind[0];
  const wg = AC.createGain(); wg.gain.value = A.wind[1];
  const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 0.11 + R() * 0.05; lg.gain.value = A.wind[1] * 0.5; lfo.connect(lg).connect(wg.gain); lfo.start(); nodes.push(lfo);
  src.connect(f).connect(wg).connect(g);
  if (A.water) { const f2 = AC.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 520; f2.Q.value = 0.6; const g2 = AC.createGain(); g2.gain.value = A.water; const l2 = AC.createOscillator(), lg2 = AC.createGain(); l2.frequency.value = 0.23; lg2.gain.value = A.water * 0.8; l2.connect(lg2).connect(g2.gain); l2.start(); nodes.push(l2); src.connect(f2).connect(g2).connect(g); }
  if (A.hum) { const o = AC.createOscillator(), og = AC.createGain(); o.type = 'sine'; o.frequency.value = 55; og.gain.value = A.hum; o.connect(og).connect(g); o.start(); nodes.push(o); const o2 = AC.createOscillator(), og2 = AC.createGain(); o2.type = 'triangle'; o2.frequency.value = 110.6; og2.gain.value = A.hum * 0.3; o2.connect(og2).connect(g); o2.start(); nodes.push(o2); }
  src.start();
  const timer = A.birds ? setInterval(() => { if (!AC || AC.state !== 'running' || R() > 1.5 / A.birds) return; const t = AC.currentTime, d = out((R() - 0.5) * 1.6, 0.25), f0 = 2400 + R() * 1800, n = 2 + Math.floor(R() * 3); for (let i = 0; i < n; i++) tone(t + i * (0.09 + R() * 0.04), 0.06, 'sine', f0 * (1 + R() * 0.15), f0 * (1.25 + R() * 0.3), 0.012 + R() * 0.012, d, 0.01); }, 1500) : 0;
  amb = { kind, g, nodes, timer };
}
// 차 엔진 (sp < 0 이면 끔)
let engine = null;
export function engineSound(sp) {
  if (!AC) return;
  if (sp < 0) { if (engine) { engine.g.gain.setTargetAtTime(0, AC.currentTime, 0.1); const e = engine; engine = null; setTimeout(() => { try { e.o.stop(); e.o2.stop(); } catch {} }, 400); } return; }
  if (!engine) { const o = AC.createOscillator(), o2 = AC.createOscillator(), f = AC.createBiquadFilter(), g = AC.createGain(); o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g).connect(master); o.start(); o2.start(); engine = { o, o2, g, f }; }
  const t = AC.currentTime, hz = 42 + sp * 5.5;
  engine.o.frequency.setTargetAtTime(hz, t, 0.08); engine.o2.frequency.setTargetAtTime(hz * 0.502, t, 0.08); engine.g.gain.setTargetAtTime(0.04 + Math.min(0.045, sp * 0.003), t, 0.1); engine.f.frequency.setTargetAtTime(380 + sp * 30, t, 0.1);
}
