// 미리 굽는 효과음(public/sfxbank.js)을 wav 와 스펙트로그램 png 로 뽑아 확인한다.
// node tools/sfx_preview.mjs [출력 폴더]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as B from '../public/sfxbank.js';

const SR = 48000, OUT = process.argv[2] || 'sfx_out';
B.setRate(SR);
fs.mkdirSync(OUT, { recursive: true });

function wav(file, chs) {
  const n = chs[0].length, c = chs.length, buf = Buffer.alloc(44 + n * c * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * c * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(c, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * c * 2, 28); buf.writeUInt16LE(c * 2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * c * 2, 40);
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(chs[k][i] * 32767))), 44 + (i * c + k) * 2);
  fs.writeFileSync(file, buf);
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = (-2 * Math.PI) / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c; re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; } }
}
function png(file, w, h, px) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; px.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
// 위: 파형(엔벨로프), 아래: 로그 주파수 스펙트로그램 (20Hz~20kHz)
function spectro(file, a) {
  const W = 600, H1 = 80, H2 = 220, H = H1 + H2, px = Buffer.alloc(W * H * 3, 16), F = 2048, hop = Math.max(1, Math.floor((a.length - F) / W));
  for (let x = 0; x < W; x++) { let m = 0; const i0 = Math.floor((x / W) * a.length), i1 = Math.floor(((x + 1) / W) * a.length); for (let i = i0; i < i1; i++) m = Math.max(m, Math.abs(a[i])); const hh = Math.round(m * (H1 / 2 - 2)); for (let y = H1 / 2 - hh; y <= H1 / 2 + hh; y++) { const o = (y * W + x) * 3; px[o] = 120; px[o + 1] = 200; px[o + 2] = 255; } }
  for (let x = 0; x < W; x++) {
    const re = new Float64Array(F), im = new Float64Array(F), i0 = x * hop;
    for (let i = 0; i < F; i++) re[i] = (a[i0 + i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / F));
    fft(re, im);
    for (let y = 0; y < H2; y++) { const f = 20 * Math.pow(1000, 1 - y / H2), b = Math.min(F / 2 - 1, Math.round((f / SR) * F)), m = Math.hypot(re[b], im[b]), db = 20 * Math.log10(m + 1e-9), v = Math.max(0, Math.min(1, (db + 40) / 70)), o = ((H1 + y) * W + x) * 3; px[o] = Math.round(255 * Math.min(1, v * 1.6)); px[o + 1] = Math.round(255 * Math.max(0, v * 1.6 - 0.6)); px[o + 2] = Math.round(255 * Math.max(0, v - 0.7) * 3 + 40 * (1 - v)); }
  }
  png(file, W, H, px);
}
function stats(chs) {
  const a = chs[0]; let pk = 0, s = 0, s50 = 0; const n50 = Math.min(a.length, Math.floor(0.05 * SR));
  for (let i = 0; i < a.length; i++) { pk = Math.max(pk, Math.abs(a[i])); s += a[i] * a[i]; if (i < n50) s50 += a[i] * a[i]; }
  let bad = 0; for (const c of chs) for (const v of c) if (!Number.isFinite(v)) bad++;
  // 처음 60ms 의 대역별 세기 (dB, 가장 센 대역 = 0)
  const F = 4096, re = new Float64Array(F), im = new Float64Array(F); for (let i = 0; i < Math.min(F, Math.floor(0.06 * SR)); i++) re[i] = a[i] || 0; fft(re, im);
  const bands = [[20, 100], [100, 300], [300, 1000], [1000, 3000], [3000, 8000], [8000, 20000]].map(([f0, f1]) => { let e = 0; for (let b = Math.ceil((f0 / SR) * F); b < Math.min(F / 2, (f1 / SR) * F); b++) e += re[b] * re[b] + im[b] * im[b]; return 10 * Math.log10(e + 1e-12); });
  const bm = Math.max(...bands), bs = bands.map((v) => Math.round(v - bm).toString().padStart(4)).join('');
  return `${(a.length / SR).toFixed(2)}s [${bs}]`;
  return `${(a.length / SR).toFixed(2)}s pk ${pk.toFixed(2)} rms ${(20 * Math.log10(Math.sqrt(s / a.length) + 1e-9)).toFixed(1)}dB rms50ms ${(20 * Math.log10(Math.sqrt(s50 / n50) + 1e-9)).toFixed(1)}dB${bad ? ' NaN!' : ''}`;
}
const jobs = [];
for (const c of Object.keys(B.GUN)) { jobs.push([`shot_${c}`, () => B.bakeShot(B.GUN[c], 1)]); jobs.push([`shot_${c}_far`, () => B.bakeShot(B.FAR(B.GUN[c]), 2)]); }
for (const c of ['side', 'smg', 'ar', 'sr']) jobs.push([`shot_${c}_sup`, () => B.bakeShot(B.SUP(B.GUN[c]), 3)]);
for (const s of [0, 1, 2, 5, 6]) jobs.push([`step_${s}`, () => B.bakeStep(s, 4)]);
for (const s of ['out', 'in', 'rack']) jobs.push([`reload_${s}`, () => B.bakeReload(s, 5)]);
for (const k of [0, 1, 2, 3, 4, 5]) jobs.push([`impact_${k}`, () => B.bakeImpact(k, 6)]);
jobs.push(['boom', () => B.bakeBoom(7)], ['whiz', () => B.bakeWhiz(8)], ['swish', () => B.bakeSwish(9)], ['tick_hit', () => B.bakeTick('hit')], ['tick_head', () => B.bakeTick('head')], ['ir', () => B.bakeIR()]);
let total = 0;
for (const [name, fn] of jobs) {
  const t0 = performance.now(), chs = fn(), ms = performance.now() - t0; total += ms;
  wav(path.join(OUT, name + '.wav'), chs); spectro(path.join(OUT, name + '.png'), chs[0]);
  console.log(name.padEnd(16), ms.toFixed(1).padStart(6) + 'ms', stats(chs));
}
console.log('total', total.toFixed(0) + 'ms');
