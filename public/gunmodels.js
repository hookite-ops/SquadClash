// SQUAD CLASH — 실제 총 모델 (Sketchfab 'Low-Poly Weapon Asset Pack' by r2detta, CC-BY-4.0)
// tools/extract_guns.mjs 가 만든 public/models/guns.bin 을 읽어, 무기 이름 → 색 단계별 모양(BufferGeometry) 으로 둔다.
import * as THREE from './vendor/three.module.js';

export const GLB = { ready: false, models: null, credit: 'r2detta — Low-Poly Weapon Asset Pack (CC BY 4.0, sketchfab.com/r2detta)' };
let loading = null;
export function loadGunModels() {
  if (loading) return loading;
  loading = fetch('./models/guns.bin').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('guns.bin ' + r.status)))).then((buf) => {
    const hl = new DataView(buf).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), base = 4 + hl, models = {};
    for (const [name, w] of Object.entries(head.weapons)) {
      const groups = {};
      for (const [key, g] of Object.entries(w.groups)) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, base + g.p, g.n * 3), 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(buf, base + g.uv, g.n * 2), 2));
        geo.setIndex(new THREE.BufferAttribute(g.big ? new Uint32Array(buf, base + g.i, g.ni) : new Uint16Array(buf, base + g.i, g.ni), 1));
        geo.computeVertexNormals(); geo.computeBoundingBox();
        groups[key] = geo;
      }
      models[name] = { size: w.size, groups };
    }
    GLB.models = models; GLB.ready = true;
    return models;
  }).catch((e) => { console.warn('총 모델을 못 읽음 — 코드로 만든 모델을 씀', e); return null; });
  return loading;
}
