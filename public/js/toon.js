// 카툰 렌더링 헬퍼: 3단 툰 셰이딩 + 뒷면 확대 방식 외곽선
import * as THREE from 'three';

const ramp = new Uint8Array([80, 160, 255]);
export const GRADIENT = new THREE.DataTexture(ramp, 3, 1, THREE.RedFormat);
GRADIENT.minFilter = GRADIENT.magFilter = THREE.NearestFilter;
GRADIENT.needsUpdate = true;

export function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT, ...extra });
}

const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1b1d2a, side: THREE.BackSide });

// 지오메트리가 원점 중심일 때만 정확합니다.
export function addOutline(mesh, t = 0.035) {
  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const s = new THREE.Vector3();
  geo.boundingBox.getSize(s);
  const o = new THREE.Mesh(geo, OUTLINE);
  o.scale.set(1 + 2 * t / Math.max(s.x, 1e-3), 1 + 2 * t / Math.max(s.y, 1e-3), 1 + 2 * t / Math.max(s.z, 1e-3));
  o.raycast = () => {};
  mesh.add(o);
  return o;
}

export function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
