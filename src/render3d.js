// three.js preview of the hung piece: a wall, four acrylic sheets on
// standoffs, and colored filtering where sheets overlap.
//
// Translucent acrylic acts as a color filter, so each sheet's face is drawn
// with multiply blending: what's behind it gets multiplied by the sheet's
// tint, and holes (drawn white) let light through unchanged. Multiply is
// order-independent, so overlapping sheets mix correctly from any angle.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SHEET, standoffCenters } from './sheet.js';

const PX_PER_IN = 80;

function multiplyMaterial(params) {
  return new THREE.MeshBasicMaterial({
    ...params,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.ZeroFactor,
  });
}

// Color the acrylic multiplies by: white blended toward the sheet color.
function tintColor(layer) {
  return new THREE.Color('#ffffff').lerp(new THREE.Color(layer.color), layer.strength);
}

function traceHole(ctx, h) {
  if (h.shape === 'poly') {
    ctx.beginPath();
    h.points.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x * PX_PER_IN, y * PX_PER_IN));
    ctx.closePath();
    return;
  }
  ctx.save();
  ctx.translate(h.x * PX_PER_IN, h.y * PX_PER_IN);
  ctx.rotate(h.rot);
  const w = h.w * PX_PER_IN;
  const hh = h.h * PX_PER_IN;
  ctx.beginPath();
  if (h.shape === 'circle') ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
  else if (h.shape === 'bar') ctx.roundRect(-w / 2, -hh / 2, w, hh, Math.min(w, hh) / 2);
  else ctx.rect(-w / 2, -hh / 2, w, hh);
  ctx.restore();
}

function drawSheet(canvas, layer, holes, cut) {
  const ctx = canvas.getContext('2d');
  const tint = tintColor(layer);
  // Cut edges scatter light, so they read slightly darker than the face.
  const edge = tint.clone().multiplyScalar(0.72);

  ctx.fillStyle = `#${tint.getHexString()}`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const all = [
    ...holes,
    ...standoffCenters(cut).map((c) => ({
      shape: 'circle', x: c.x, y: c.y, w: cut.standoffDia, h: cut.standoffDia, rot: 0,
    })),
  ];
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = `#${edge.getHexString()}`;
  ctx.lineWidth = 1.25;
  for (const h of all) {
    traceHole(ctx, h);
    ctx.fill();
    ctx.stroke();
  }
}

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1c1d21');

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 500);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight('#ffffff', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 1.4);
  sun.position.set(10, 20, 30);
  scene.add(sun);

  const wallMat = new THREE.MeshStandardMaterial({ color: '#f2f0ec', roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), wallMat);
  scene.add(wall);

  const rodMat = new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.35, roughness: 0.35 });
  const rods = new THREE.Group();
  scene.add(rods);

  const sheets = []; // { mesh, canvas, texture, faceMat, edgeMat }

  function makeSheet() {
    const canvas = document.createElement('canvas');
    canvas.width = SHEET.w * PX_PER_IN;
    canvas.height = SHEET.h * PX_PER_IN;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const faceMat = multiplyMaterial({ map: texture });
    const edgeMat = multiplyMaterial({ color: '#ffffff' });
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    // BoxGeometry material order: +x, -x, +y, -y, +z (front), -z (back)
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(SHEET.w, SHEET.h, SHEET.t),
      [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, hidden],
    );
    scene.add(mesh);
    const curves = new THREE.Group();
    curves.position.z = SHEET.t / 2 + 0.02;
    mesh.add(curves);
    return { mesh, canvas, texture, faceMat, edgeMat, curves, w: SHEET.w, h: SHEET.h };
  }

  function sheetZ(g, depth) {
    return g.wallGap + depth * (g.gap + SHEET.t) + SHEET.t / 2;
  }

  function update(state, results) {
    const g = state.global;
    wallMat.color.set(g.wallColor);

    // A new sheet size needs new geometry and canvases.
    if (sheets.length && (sheets[0].w !== SHEET.w || sheets[0].h !== SHEET.h)) {
      for (const s of sheets) {
        scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.texture.dispose();
      }
      sheets.length = 0;
    }

    state.layers.forEach((layer, i) => {
      if (!sheets[i]) sheets[i] = makeSheet();
      const s = sheets[i];
      s.mesh.visible = layer.visible;
      s.mesh.position.set(0, 0, sheetZ(g, layer.depth));

      drawSheet(s.canvas, layer, results[i].holes, g.cut);
      s.texture.needsUpdate = true;
      // Acrylic edges look more saturated than the face: light travels
      // the long way through the material.
      const t = tintColor(layer);
      s.edgeMat.color.copy(t.multiply(t));

      // Wave overlay: drawn just in front of the sheet, darker than its tint.
      s.curves.children.forEach((c) => c.geometry.dispose());
      s.curves.clear();
      s.curves.visible = layer.visible && layer.showCurve;
      if (s.curves.visible) {
        const color = new THREE.Color(layer.color).multiplyScalar(0.55);
        for (const c of results[i].curves) {
          const pts = c.points.map(([x, y]) => new THREE.Vector3(x - SHEET.w / 2, SHEET.h / 2 - y, 0));
          const geom = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = c.dashed
            ? new THREE.LineDashedMaterial({ color, dashSize: 0.25, gapSize: 0.18 })
            : new THREE.LineBasicMaterial({ color });
          const line = new THREE.Line(geom, mat);
          if (c.dashed) line.computeLineDistances();
          s.curves.add(line);
        }
      }
    });

    // Standoff rods from the wall through the front sheet.
    rods.clear();
    const maxDepth = Math.max(...state.layers.map((l) => l.depth));
    const front = sheetZ(g, maxDepth) + SHEET.t / 2 + 0.3;
    for (const c of standoffCenters(g.cut)) {
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(g.cut.standoffDia / 2 - 0.01, g.cut.standoffDia / 2 - 0.01, front, 24),
        rodMat,
      );
      rod.rotation.x = Math.PI / 2;
      rod.position.set(c.x - SHEET.w / 2, SHEET.h / 2 - c.y, front / 2);
      rods.add(rod);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.3, 32), rodMat);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(rod.position.x, rod.position.y, front - 0.15);
      rods.add(cap);
    }
  }

  function setView(name) {
    const target = new THREE.Vector3(0, 0, 1.5);
    const positions = {
      front: [0, 0, 62],
      angle: [34, 8, 44],
      side: [58, 0, 6],
      close: [4, 7, 16],
    };
    camera.position.set(...positions[name]);
    controls.target.copy(name === 'close' ? new THREE.Vector3(2, 5, 1.5) : target);
    controls.update();
  }

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();
  setView('angle');

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return { update, setView };
}
