// 맵 그리기 — 질감은 전부 코드로 그려서 만들고, 고정된 물체는 재질별로 하나로 합쳐 가볍게 그린다
import * as THREE from './vendor/three.module.js';
import { ARENA, BOXES, SITES, MAPS, MAP, groundAt } from './shared.js';

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
function speckle(g, s, n, colors, max = 2.2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(rnd() * colors.length) | 0];
    const r = 0.4 + rnd() * max;
    g.fillRect(rnd() * s, rnd() * s, r, r);
  }
}
const TEX = {
  asphalt: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#4a4e55'; g.fillRect(0, 0, s, s);
    speckle(g, s, 5200, ['rgba(255,255,255,.06)', 'rgba(0,0,0,.10)', 'rgba(120,125,135,.10)', 'rgba(20,22,26,.12)']);
    g.strokeStyle = 'rgba(15,17,20,.35)'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) { g.beginPath(); let x = rnd() * s, y = rnd() * s; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  }),
  concrete: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#a5a49d'; g.fillRect(0, 0, s, s);
    speckle(g, s, 4200, ['rgba(255,255,255,.07)', 'rgba(0,0,0,.07)', 'rgba(90,85,75,.08)'], 3);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(60,58,52,${0.03 + rnd() * 0.05})`; const x = rnd() * s; g.fillRect(x, 0, 3 + rnd() * 10, s * (0.3 + rnd() * 0.7)); }
    g.strokeStyle = 'rgba(40,40,38,.45)'; g.lineWidth = 3; g.strokeRect(0, 0, s, s);
    g.fillStyle = 'rgba(40,40,38,.5)'; for (const [x, y] of [[20, 20], [236, 20], [20, 236], [236, 236]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  }),
  brick: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#6f6a62'; g.fillRect(0, 0, s, s);
    const bh = 32, bw = 64;
    for (let r = 0; r < s / bh; r++) for (let c = -1; c < s / bw + 1; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh;
      const v = rnd();
      g.fillStyle = `rgb(${132 + v * 40 | 0},${66 + v * 22 | 0},${50 + v * 18 | 0})`;
      g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 2, y + 2, bw - 4, 4);
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 2, y + bh - 7, bw - 4, 5);
    }
    speckle(g, s, 1500, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.05)']);
  }),
  metal: () => canvasTex(256, (g, s) => {
    for (let i = 0; i < 8; i++) {
      const x = i * 32, lg = g.createLinearGradient(x, 0, x + 32, 0);
      lg.addColorStop(0, '#aebbc3'); lg.addColorStop(0.42, '#8c9aa3'); lg.addColorStop(0.5, '#6f7d86'); lg.addColorStop(0.58, '#93a1aa'); lg.addColorStop(1, '#b4c1c9');
      g.fillStyle = lg; g.fillRect(x, 0, 32, s);
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(110,70,40,${0.03 + rnd() * 0.07})`; g.fillRect(rnd() * s, 0, 2 + rnd() * 4, s * rnd() * 0.6); }
    g.fillStyle = 'rgba(50,60,68,.55)'; g.fillRect(0, 0, s, 5); g.fillRect(0, s - 5, s, 5);
  }),
  container: () => canvasTex(256, (g, s) => {
    for (let i = 0; i < 16; i++) {
      const x = i * 16, lg = g.createLinearGradient(x, 0, x + 16, 0);
      lg.addColorStop(0, '#f4f4f4'); lg.addColorStop(0.4, '#cfcfcf'); lg.addColorStop(0.55, '#9b9b9b'); lg.addColorStop(0.7, '#d9d9d9'); lg.addColorStop(1, '#f4f4f4');
      g.fillStyle = lg; g.fillRect(x, 0, 16, s);
    }
    g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, s, 16); g.fillRect(0, s - 16, s, 16);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 16, s, 3); g.fillRect(0, s - 19, s, 3);
    for (let i = 0; i < 46; i++) { g.fillStyle = `rgba(70,40,20,${0.04 + rnd() * 0.1})`; g.fillRect(rnd() * s, 16, 1 + rnd() * 3, 20 + rnd() * 150); }
    speckle(g, s, 500, ['rgba(60,35,20,.18)', 'rgba(255,255,255,.08)'], 3);
  }),
  crate: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#b08a55'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) {
      const y = i * (s / 6), v = rnd();
      g.fillStyle = `rgb(${168 + v * 26 | 0},${130 + v * 22 | 0},${80 + v * 16 | 0})`; g.fillRect(0, y, s, s / 6 - 2);
      g.strokeStyle = 'rgba(90,60,30,.25)'; g.lineWidth = 1;
      for (let k = 0; k < 4; k++) { g.beginPath(); const yy = y + rnd() * (s / 6); g.moveTo(0, yy); g.bezierCurveTo(80, yy + (rnd() - 0.5) * 8, 170, yy + (rnd() - 0.5) * 8, s, yy); g.stroke(); }
    }
    g.strokeStyle = '#7a5630'; g.lineWidth = 26; g.strokeRect(13, 13, s - 26, s - 26);
    g.lineWidth = 22; g.beginPath(); g.moveTo(26, s - 26); g.lineTo(s - 26, 26); g.stroke();
    g.strokeStyle = 'rgba(40,25,10,.5)'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2); g.strokeRect(26, 26, s - 52, s - 52);
    g.fillStyle = '#3d2c1a'; for (const [x, y] of [[13, 13], [s - 13, 13], [13, s - 13], [s - 13, s - 13]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  }),
  barrier: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#b3b1a8'; g.fillRect(0, 0, s, s);
    speckle(g, s, 2600, ['rgba(255,255,255,.07)', 'rgba(0,0,0,.08)'], 3);
    g.save(); g.beginPath(); g.rect(0, 0, s, 70); g.clip();
    for (let i = -4; i < 12; i++) { g.fillStyle = i % 2 ? '#e5b62c' : '#26282b'; g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 32, 0); g.lineTo(i * 32 + 102, 70); g.lineTo(i * 32 + 70, 70); g.fill(); }
    g.restore();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 70, s, 4); g.fillRect(0, s - 40, s, 40);
  }),
  barrel: () => canvasTex(128, (g, s) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(0,0,0,.28)'; for (const y of [0, 38, 84, 122]) g.fillRect(0, y, s, 6);
    speckle(g, s, 500, ['rgba(60,35,20,.2)', 'rgba(0,0,0,.1)'], 3);
  }),
  shelf: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#2c3138'; g.fillRect(0, 0, s, s);
    for (let r = 0; r < 3; r++) {
      const y = r * 85 + 6;
      for (let c = 0; c < 4; c++) { const v = rnd(); g.fillStyle = `rgb(${170 + v * 30 | 0},${135 + v * 25 | 0},${85 + v * 20 | 0})`; const w = 44 + rnd() * 14, h = 44 + rnd() * 22; g.fillRect(c * 64 + 6, y + 70 - h, w, h); g.fillStyle = 'rgba(80,50,20,.5)'; g.fillRect(c * 64 + 6 + w / 2 - 3, y + 70 - h, 6, h); }
      g.fillStyle = '#e07b22'; g.fillRect(0, y + 70, s, 9);
    }
    g.fillStyle = '#3a5fa8'; g.fillRect(0, 0, 8, s); g.fillRect(s - 8, 0, 8, s); g.fillRect(124, 0, 8, s);
  }),
  plaster: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#dcbd8e'; g.fillRect(0, 0, s, s);
    speckle(g, s, 5200, ['rgba(255,255,255,.06)', 'rgba(120,85,45,.07)', 'rgba(90,60,30,.05)'], 3);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(120,85,50,${0.03 + rnd() * 0.06})`; g.fillRect(rnd() * s, 0, 4 + rnd() * 14, s * (0.2 + rnd() * 0.8)); }
    for (let k = 0; k < 3; k++) { // 벗겨져 드러난 벽돌
      const cx = rnd() * s, cy = rnd() * s;
      for (let i = 0; i < 9; i++) { const x = cx + ((i % 3) - 1) * 22 + (Math.floor(i / 3) % 2 ? 11 : 0), y = cy + (Math.floor(i / 3) - 1) * 11; if (rnd() < 0.75) { g.fillStyle = `rgb(${170 + rnd() * 25 | 0},${118 + rnd() * 20 | 0},${78 + rnd() * 16 | 0})`; g.fillRect(x, y, 20, 9); } }
    }
    g.strokeStyle = 'rgba(80,55,30,.3)'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { g.beginPath(); let x = rnd() * s, y = rnd() * s; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 30; y += rnd() * 40; g.lineTo(x, y); } g.stroke(); }
  }),
  sandFloor: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#c9ab7c'; g.fillRect(0, 0, s, s);
    speckle(g, s, 7000, ['rgba(255,245,220,.09)', 'rgba(110,80,45,.10)', 'rgba(150,120,80,.10)'], 2.6);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${130 + rnd() * 40 | 0},${110 + rnd() * 30 | 0},${85 + rnd() * 20 | 0},.5)`; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 1.5 + rnd() * 3, 1 + rnd() * 2, rnd() * 3, 0, 7); g.fill(); }
  }),
  stone: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#6f685c'; g.fillRect(0, 0, s, s);
    for (let r = 0; r < 4; r++) { let x = r % 2 ? -30 : 0; while (x < s) { const w = 50 + rnd() * 50, v = rnd(); g.fillStyle = `rgb(${158 + v * 30 | 0},${148 + v * 28 | 0},${128 + v * 24 | 0})`; g.fillRect(x + 2, r * 64 + 2, w - 4, 60); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 2, r * 64 + 2, w - 4, 6); x += w; } }
    speckle(g, s, 2600, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.06)'], 3);
  }),
  tiles: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#9c8a6e'; g.fillRect(0, 0, s, s);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const v = rnd(); g.fillStyle = (r + c) % 2 ? `rgb(${196 + v * 16 | 0},${172 + v * 14 | 0},${132 + v * 12 | 0})` : `rgb(${182 + v * 16 | 0},${140 + v * 14 | 0},${104 + v * 12 | 0})`; g.fillRect(c * 64 + 2, r * 64 + 2, 60, 60); }
    speckle(g, s, 2400, ['rgba(0,0,0,.07)', 'rgba(255,255,255,.05)'], 3);
  }),
  planks: () => canvasTex(256, (g, s) => {
    for (let i = 0; i < 6; i++) { const v = rnd(); g.fillStyle = `rgb(${128 + v * 28 | 0},${90 + v * 22 | 0},${52 + v * 16 | 0})`; g.fillRect(i * (s / 6), 0, s / 6 - 2, s); g.strokeStyle = 'rgba(60,38,18,.3)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { const x = i * (s / 6) + rnd() * (s / 6); g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (rnd() - 0.5) * 8, 80, x + (rnd() - 0.5) * 8, 170, x, s); g.stroke(); } }
    g.fillStyle = 'rgba(40,25,10,.6)'; for (let i = 0; i < 6; i++) g.fillRect(i * (s / 6) + s / 6 - 2, 0, 2, s);
  }),
  cloth: () => canvasTex(128, (g, s) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#efe2c6' : '#b5402f'; g.fillRect(i * 16, 0, 16, s); }
    speckle(g, s, 600, ['rgba(0,0,0,.08)'], 2);
  }),
  gravel: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#6d6a63'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) { const v = 70 + rnd() * 90 | 0; g.fillStyle = `rgb(${v + 8},${v + 4},${v - 4})`; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 1 + rnd() * 3, 1 + rnd() * 2.2, rnd() * 3, 0, 7); g.fill(); }
  }),
  stucco: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#ece6da'; g.fillRect(0, 0, s, s);
    speckle(g, s, 5200, ['rgba(255,255,255,.08)', 'rgba(120,110,95,.07)', 'rgba(90,80,70,.05)'], 3);
    for (let i = 0; i < 24; i++) { g.fillStyle = `rgba(110,100,85,${0.03 + rnd() * 0.05})`; g.fillRect(rnd() * s, 0, 4 + rnd() * 12, s * (0.2 + rnd() * 0.7)); }
    g.fillStyle = 'rgba(90,80,65,.16)'; g.fillRect(0, s - 26, s, 26);
  }),
  boards: () => canvasTex(256, (g, s) => {
    for (let i = 0; i < 8; i++) { const v = rnd(); g.fillStyle = `rgb(${205 + v * 35 | 0},${200 + v * 35 | 0},${192 + v * 35 | 0})`; g.fillRect(i * 32, 0, 30, s); g.strokeStyle = 'rgba(60,50,40,.22)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { const x = i * 32 + rnd() * 30; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (rnd() - 0.5) * 6, 80, x + (rnd() - 0.5) * 6, 170, x, s); g.stroke(); } g.fillStyle = 'rgba(30,22,14,.55)'; g.fillRect(i * 32 + 30, 0, 2, s); }
    speckle(g, s, 900, ['rgba(0,0,0,.07)', 'rgba(255,255,255,.05)'], 3);
  }),
  shingle: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, s, s);
    for (let r = 0; r < 8; r++) for (let c = -1; c < 9; c++) { const v = rnd(); g.fillStyle = `rgb(${190 + v * 60 | 0},${190 + v * 60 | 0},${190 + v * 60 | 0})`; g.fillRect(c * 32 + (r % 2 ? 16 : 0) + 1, r * 32 + 1, 30, 30); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(c * 32 + (r % 2 ? 16 : 0) + 1, r * 32 + 25, 30, 6); }
  }),
  hay: () => canvasTex(128, (g, s) => {
    g.fillStyle = '#c9a646'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 700; i++) { g.strokeStyle = ['rgba(240,215,120,.5)', 'rgba(140,105,40,.45)', 'rgba(200,170,80,.5)'][i % 3]; g.lineWidth = 1; const x = rnd() * s, y = rnd() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 22, y + (rnd() - 0.5) * 5); g.stroke(); }
    g.fillStyle = 'rgba(90,60,25,.45)'; g.fillRect(0, 38, s, 4); g.fillRect(0, 86, s, 4);
  }),
  grassFloor: () => canvasTex(256, (g, s) => { // 잔디밭 (성 맵 바닥)
    g.fillStyle = '#5f9148'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) { const v = rnd(); g.fillStyle = `rgba(${40 + v * 70 | 0},${100 + v * 80 | 0},${40 + v * 40 | 0},${0.25 + rnd() * 0.4})`; g.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 2, 2 + rnd() * 4); }
    for (let i = 0; i < 26; i++) { const x = rnd() * s, y = rnd() * s, r = 10 + rnd() * 26, rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, rnd() < 0.5 ? 'rgba(130,150,70,.3)' : 'rgba(50,100,50,.3)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
  }),
  grassDetail: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) { const v = 90 + rnd() * 80 | 0; g.strokeStyle = `rgba(${v},${v},${v},.55)`; g.lineWidth = 1; const x = rnd() * s, y = rnd() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 4); g.stroke(); }
    speckle(g, s, 1800, ['rgba(60,60,60,.25)', 'rgba(200,200,200,.2)'], 2.5);
  }),
  water: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${150 + rnd() * 60 | 0},${190 + rnd() * 40 | 0},${215 + rnd() * 30 | 0},${0.25 + rnd() * 0.3})`; g.lineWidth = 1 + rnd() * 2; const x = rnd() * s, y = rnd() * s, w = 14 + rnd() * 36; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3 - rnd() * 3, x + w, y); g.stroke(); }
  }),
  roof: () => canvasTex(128, (g, s) => {
    for (let i = 0; i < 8; i++) { const x = i * 16, lg = g.createLinearGradient(x, 0, x + 16, 0); lg.addColorStop(0, '#5b666e'); lg.addColorStop(0.5, '#3f484f'); lg.addColorStop(1, '#5b666e'); g.fillStyle = lg; g.fillRect(x, 0, 16, s); }
  }),
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
  sand: { tex: 'plaster', color: 0xffffff, tu: 4, tv: 4 }, sand2: { tex: 'plaster', color: 0xe7c7a2, tu: 4, tv: 4 }, sandWall: { tex: 'plaster', color: 0xf3e2c8, tu: 4, tv: 4 }, sandRoof: { tex: 'plaster', color: 0xcdb48c, tu: 4, tv: 4 },
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
  constructor() { this.by = new Map(); }
  add(key, geo, m) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    if (!this.by.has(key)) this.by.set(key, []);
    this.by.get(key).push(g);
  }
  box(key, x0, y0, z0, x1, y1, z1, uv) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    if (uv) {
      const a = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) {
        const side = f !== 2 && f !== 3;
        let ru = dims[f][0] / uv.tu, rv = uv.tv === 0 ? (side ? 1 : dims[f][1] / uv.tu) : dims[f][1] / uv.tv;
        if (uv.fit) { ru = Math.max(1, Math.round(ru)); rv = Math.max(1, Math.round(rv)); }
        for (let i = f * 6; i < f * 6 + 6; i++) a.setXY(i, a.getX(i) * ru, a.getY(i) * rv);
      }
    }
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.add(key, geo);
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
    let n = 0;
    for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const g of list) {
      pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count; g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
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

const THEMES = {
  dock: { sky: ['#2f6fc0', '#6aa6e0', '#cfe2f1', '#e6eef2'], cloud: 'rgba(255,255,255,.35)', clouds: 26, fog: 0xd3e2ee, fogD: [100, 380], hemi: [0xdcebff, 0x7d766a, 1.05], sun: [0xfff0d6, 2.3, [-0.64, 0.61, -0.46]], floor: 'asphalt', out: 0x50545a, cap: 'dark' },
  town: { sky: ['#2c62ad', '#6f9fd2', '#f1d6ad', '#f6e2c2'], cloud: 'rgba(255,236,205,.3)', clouds: 12, fog: 0xead6b4, fogD: [100, 380], hemi: [0xfff1dc, 0x94794f, 1.0], sun: [0xffd6a0, 2.5, [-0.78, 0.51, 0.37]], floor: 'sandFloor', out: 0xc7aa7c, cap: 'sandCap' },
  station: { sky: ['#34508f', '#b58aa8', '#f7b98a', '#fbd8b0'], cloud: 'rgba(255,205,170,.42)', clouds: 22, fog: 0xe9c2a2, fogD: [100, 380], hemi: [0xffe6d2, 0x6f6a66, 1.02], sun: [0xffb478, 2.2, [-0.8, 0.38, 0.42]], floor: 'gravel', out: 0x5a554e, cap: 'dark' },
  castle: { sky: ['#2a6cc4', '#62a4e6', '#bfe0f4', '#d8ecf6'], cloud: 'rgba(255,255,255,.42)', clouds: 30, fog: 0xcfe4ee, fogD: [100, 380], hemi: [0xe6f2ff, 0x6f8058, 1.08], sun: [0xfff2d8, 2.3, [0.5, 0.66, -0.5]], floor: 'grassFloor', out: 0x5f8a4a, cap: 'stoneCol' },
  city: { sky: ['#060a18', '#0f1834', '#262e58', '#3a3560'], cloud: 'rgba(120,130,170,.16)', clouds: 14, fog: 0x1b2038, fogD: [70, 300], hemi: [0x97a8dc, 0x34363f, 0.95], sun: [0xa8b8ff, 0.85, [0.4, 0.75, 0.5]], floor: 'asphalt', out: 0x1c1e24, cap: 'dark', night: true },
  isle: { sky: ['#2a6cc4', '#62a4e6', '#bfe0f4', '#d8ecf6'], cloud: 'rgba(255,255,255,.4)', clouds: 34, fog: 0xc6e0f0, fogD: [160, 700], hemi: [0xe2f0ff, 0x6f7f5a, 1.08], sun: [0xfff1d8, 2.4, [-0.55, 0.66, 0.5]], floor: null, out: 0, water: 0x2f86b8 },
};
// 섬의 날씨·시간대 (경기마다 바뀜): 0 맑은 낮, 1 노을, 2 흐리고 안개
export const MOODS = [
  { name: '맑은 낮' },
  { name: '노을', sky: ['#35508f', '#c9809a', '#ffb877', '#ffd9a8'], cloud: 'rgba(255,200,170,.42)', clouds: 26, fog: 0xf0c2a0, fogD: [140, 620], hemi: [0xffe0cc, 0x7a6a58, 1.08], sun: [0xffa860, 2.4, [-0.84, 0.3, 0.45]], water: 0x3f6f96 },
  { name: '안개', sky: ['#8496a8', '#a9b6c2', '#c8d0d6', '#d2d8dc'], cloud: 'rgba(235,238,242,.5)', clouds: 60, fog: 0xc3ccd3, fogD: [50, 300], hemi: [0xd8e0e8, 0x66705c, 1.15], sun: [0xe4e8ec, 1.15, [-0.4, 0.8, 0.44]], water: 0x4f7e94 },
];

export function buildWorld(scene, renderer, opt = {}) {
  const shadows = opt.shadows !== false;
  const map = MAPS[MAP], key = map.key, theme = map.theme || key, town = theme === 'town', dock = theme === 'dock', isle = key === 'isle';
  const hx = ARENA.hx, hz = ARENA.hz;
  const tex = {};
  const getTex = (k) => tex[k] || (tex[k] = TEX[k]());
  const mg = new Merger();
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const group = new THREE.Group();
  scene.add(group);
  const T = { ...(THEMES[theme] || THEMES.dock), ...(isle && opt.mood ? MOODS[opt.mood] : {}) };
  const owned = []; // 맵을 바꿀 때 함께 지울 질감

  // 하늘 (카메라를 따라다님)
  const skyTex = canvasTex(1024, (g, s) => {
    const lg = g.createLinearGradient(0, 0, 0, s);
    lg.addColorStop(0, T.sky[0]); lg.addColorStop(0.32, T.sky[1]); lg.addColorStop(0.5, T.sky[2]); lg.addColorStop(0.56, T.sky[3]); lg.addColorStop(1, T.sky[3]);
    g.fillStyle = lg; g.fillRect(0, 0, s, s);
    for (let i = 0; i < T.clouds; i++) { // 구름
      const cx = rnd() * s, cy = s * (0.16 + rnd() * 0.3), w = 60 + rnd() * 130;
      for (let k = 0; k < 9; k++) { const ox = (rnd() - 0.5) * w, oy = (rnd() - 0.5) * 12, r = w * (0.22 + rnd() * 0.3); const rg = g.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r); rg.addColorStop(0, T.cloud); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(cx + ox - r, cy + oy - r * 0.5, r * 2, r); }
    }
  }, false);
  owned.push(skyTex);
  const skyR = isle ? 1500 : 420;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(skyR, 28, 18), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  group.add(sky);
  // 해
  const sunDir = new THREE.Vector3(...T.sun[2]).normalize();
  const sunTex = canvasTex(128, (g, s) => { const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, 'rgba(255,255,245,1)'); rg.addColorStop(0.12, 'rgba(255,250,225,.95)'); rg.addColorStop(0.3, 'rgba(255,235,180,.3)'); rg.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = rg; g.fillRect(0, 0, s, s); }, false);
  owned.push(sunTex);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  sunSprite.scale.setScalar(skyR * 0.36); sunSprite.renderOrder = -9;
  group.add(sunSprite);
  scene.background = new THREE.Color(T.fog);
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
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), lam({ map: t, color }));
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
    const m = new THREE.Mesh(g, lam({ map: t, color, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); m.receiveShadow = shadows; group.add(m);
  };
  let water = null, waterTex = null, splat = null, splatPix = null, splatN = 0;
  if (!isle) {
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
      const tm = new THREE.Mesh(tg, lam({ map: ft, vertexColors: true })); tm.receiveShadow = shadows; group.add(tm);
    } else slab(T.floor, -hx, -hz, hx, hz, 4, 0xffffff, 0);
    { // 담장 밖 땅 (안쪽은 파인 곳이 있어서 덮지 않음)
      const om = lam({ color: T.out });
      for (const [x0, z0, x1, z1] of [[-450, hz, 450, 450], [-450, -450, 450, -hz], [-450, -hz, -hx, hz], [hx, -hz, 450, hz]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), om); m.receiveShadow = false; flat(m, (x0 + x1) / 2, (z0 + z1) / 2, 0, -0.04); }
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
    const detail = getTex('grassDetail'); detail.colorSpace = THREE.NoColorSpace;
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
    waterTex = getTex('water');
    waterTex.repeat.set(320, 320);
    water = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), new THREE.MeshLambertMaterial({ color: T.water, map: waterTex, transparent: true, opacity: 0.8, depthWrite: false }));
    water.renderOrder = 1; flat(water, 0, 0, 0, 0);
    const deep = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), new THREE.MeshLambertMaterial({ color: 0x1f5f8a })); flat(deep, 0, 0, 0, -3.6);
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
    else if (d.t === 'pond') { const m = new THREE.Mesh(new THREE.CircleGeometry(d.r, 28), new THREE.MeshLambertMaterial({ color: 0x3f8fb0, transparent: true, opacity: 0.85 })); flat(m, d.x, d.z, 0, 0.06); }
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
        if (T.night) { glowMat = glowMat || new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xffd9a0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -1 }); flat(new THREE.Mesh(new THREE.CircleGeometry(7, 20), glowMat), x + 0.9, z, 0, y + 0.03); }
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
  const mats = {
    car0: lam({ color: 0xb23a32 }), car1: lam({ color: 0x2f5fa0 }), car2: lam({ color: 0xd9dbdd }), car3: lam({ color: 0x2b2f36 }), car4: lam({ color: 0x3f8a5a }),
    busBody: lam({ color: 0x2f8f6a }), glassPane: new THREE.MeshLambertMaterial({ color: 0x9fd0e6, transparent: true, opacity: 0.35 }),
    winWarm: new THREE.MeshBasicMaterial({ color: 0xffd58a }), cityFar: lam({ color: 0x8f7f7a }), skyline: lam({ color: 0x141a2c }), hill: lam({ color: 0x5f8a4a }), pine: lam({ color: 0x2f6b3c }), pine2: lam({ color: 0x3f7f44 }),
    yellow: lam({ color: 0xe0a91f }), dark: lam({ color: 0x2a2e34 }), steel: lam({ color: 0x6d7680 }), tire: lam({ color: 0x17181a }),
    truckBlue: lam({ color: 0x2c5fa5 }), glass: lam({ color: 0x1c2733 }), crane: lam({ color: 0xc9772b }),
    glassLit: new THREE.MeshBasicMaterial({ color: 0xbfe0f2 }), lamp: new THREE.MeshBasicMaterial({ color: 0xfff3c4 }),
    barrel0: lam({ map: getTex('barrel'), color: 0x2f6fb0 }), barrel1: lam({ map: getTex('barrel'), color: 0xb03a2e }), barrel2: lam({ map: getTex('barrel'), color: 0xd7a52a }),
    sandCap: lam({ color: 0xc9ac80 }), dome: lam({ color: 0xefe3c8 }), doorWood: lam({ color: 0x6f4a2a }), winDark: lam({ color: 0x241c16 }),
    roofTile: new THREE.MeshLambertMaterial({ map: getTex('shingle'), color: 0xc0603a, side: THREE.DoubleSide }), roofSlate: new THREE.MeshLambertMaterial({ map: getTex('shingle'), color: 0x5d6b78, side: THREE.DoubleSide }),
    gableEnd: new THREE.MeshLambertMaterial({ color: 0x8a7458, side: THREE.DoubleSide }),
    pot: lam({ color: 0xb46a3c }), trunk: lam({ color: 0x7a5a3a }), leaf: new THREE.MeshLambertMaterial({ color: 0x3f8a3a, side: THREE.DoubleSide }), dune: lam({ color: 0xd9bd8c }),
    lanternA: new THREE.MeshBasicMaterial({ color: 0xffc04a }), lanternB: new THREE.MeshBasicMaterial({ color: 0xff7a4a }), lanternC: new THREE.MeshBasicMaterial({ color: 0x7ad1c0 }),
    rugA: lam({ color: 0x9c2f2a }), rugB: lam({ color: 0x2f5f8a }),
    rust: lam({ color: 0x8a4a2c }), rust2: lam({ color: 0x6f5a48 }), boatHull: new THREE.MeshLambertMaterial({ color: 0x3f6f8f, side: THREE.DoubleSide }), white: lam({ color: 0xf0efe9 }),
    bollard: lam({ color: 0x2a2e34 }), sleeper: lam({ color: 0x4a3a2c }), tentRoof: lam({ color: 0xd9c9a6 }), whitePaint: lam({ color: 0xf0efe9 }), redPaint: lam({ color: 0xc23b32 }),
    siloMetal: lam({ color: 0xb9c1c8 }), stoneCol: lam({ color: 0x9a948a }), sail: new THREE.MeshLambertMaterial({ color: 0xe9e2d0, side: THREE.DoubleSide }),
    shipHull: lam({ color: 0x24303c }), shipRed: lam({ color: 0x8a2f2a }),
  };
  const noShadow = new Set(['winWarm', 'cityFar', 'skyline', 'hill', 'glassPane', 'glassLit', 'lamp', 'dune', 'lanternA', 'lanternB', 'lanternC', 'rugA', 'rugB', 'sleeper', 'shipHull', 'shipRed']);
  for (const k of mg.by.keys()) {
    const md = MATS[k];
    const mat = mats[k] || lam({ map: getTex(md ? md.tex : 'concrete'), color: md ? md.color : 0xffffff });
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
    else if (d.t === 'water') { waterMat = waterMat || new THREE.MeshLambertMaterial({ color: theme === 'castle' ? 0x3f7f8a : 0x3f8fb0, transparent: true, opacity: 0.78, depthWrite: false }); const m = new THREE.Mesh(new THREE.PlaneGeometry(d.x1 - d.x0, d.z1 - d.z0), waterMat); m.receiveShadow = shadows; flat(m, (d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2, 0, d.y); }
    else if (d.t === 'floorText') flat(textPlane(d.text, d.size || 4, d.size || 4, { color: d.color || '#f0c53a', size: 0.9 }), d.x - 6, d.z, -Math.PI / 2, groundAt(d.x - 6, d.z) + 0.04);
    else if (d.t === 'sign') wallSign(d.text, d.w, d.h, d.x, d.y, d.z, d.ry, { bg: d.bg, border: d.border, color: d.color, size: d.size });
  }

  // 팀 진영 바닥 색 (생존전에는 없음)
  const zones = [0, 1].map((t) => {
    const w = 8;
    const z = new THREE.Mesh(new THREE.PlaneGeometry(w, hz * 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
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
    sky.position.copy(cam); sky.rotation.y += dt * 0.004;
    for (const r of spinners) r.rotation.z += dt * 0.9;
    if (grass && (Math.abs(cam.x - grassC.x) > 4 || Math.abs(cam.z - grassC.z) > 4)) plantGrass(cam);
    cullT -= dt;
    if (cullT <= 0) { cullT = 0.4; for (const c of cullList) c.im.visible = Math.hypot(c.x - cam.x, c.z - cam.z) < c.far + 75; } // 먼 구역은 안 그림
    sunSprite.position.copy(sunDir).multiplyScalar(skyR * 0.92).add(cam);
    if (waterTex) { wt += dt; waterTex.offset.set(wt * 0.012, wt * 0.008); }
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
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    for (const im of instanced) im.dispose();
    for (const k in tex) tex[k].dispose();
    for (const t of owned) t.dispose();
  };
  return { group, zones, sun, hemi, dispose, update, splat, far: isle ? 1700 : 520, mood: opt.mood || 0 };
}

// 캐릭터 발밑 그림자
let blobTex = null;
export function blobShadow() {
  blobTex = blobTex || canvasTex(64, (g, s) => { const rg = g.createRadialGradient(32, 32, 2, 32, 32, 30); rg.addColorStop(0, 'rgba(0,0,0,.5)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, s, s); }, false);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03;
  return m;
}
export { SITES };
