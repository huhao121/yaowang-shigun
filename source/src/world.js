import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const rngFactory = (seed) => {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

function canvasTexture(w, h, draw, { colorSpace = true, repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (colorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

function makeStoneTextures() {
  const rand = rngFactory(7717);
  const color = document.createElement('canvas');
  color.width = color.height = 512;
  const c = color.getContext('2d');
  c.fillStyle = '#5a5b51';
  c.fillRect(0, 0, 512, 512);
  // mottled mineral wash
  for (let i = 0; i < 420; i++) {
    const x = rand() * 512, y = rand() * 512, r = 8 + rand() * 80;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const light = rand() > 0.5;
    g.addColorStop(0, light ? 'rgba(156,154,137,.10)' : 'rgba(26,30,26,.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // irregular slabs
  c.strokeStyle = 'rgba(23,25,22,.55)';
  c.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    c.beginPath();
    let x = rand() * 512, y = 0;
    c.moveTo(x, y);
    for (let s = 0; s < 9; s++) {
      x += (rand() - 0.5) * 100;
      y += 512 / 9;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  for (let i = 0; i < 7; i++) {
    c.beginPath();
    let x = 0, y = rand() * 512;
    c.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += 512 / 8;
      y += (rand() - 0.5) * 80;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  // cracks and moss
  for (let i = 0; i < 32; i++) {
    c.strokeStyle = `rgba(20,23,20,${0.15 + rand() * 0.3})`;
    c.lineWidth = 0.6 + rand() * 1.4;
    c.beginPath();
    let x = rand() * 512, y = rand() * 512;
    c.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (rand() - 0.5) * 44; y += (rand() - 0.5) * 44;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const x = rand() * 512, y = rand() * 512, r = 5 + rand() * 30;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(65,84,50,${0.06 + rand() * 0.10})`);
    g.addColorStop(1, 'rgba(65,84,50,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // fine grain
  const img = c.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 22;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  c.putImageData(img, 0, 0);

  const bump = document.createElement('canvas');
  bump.width = bump.height = 512;
  const b = bump.getContext('2d');
  b.fillStyle = '#777';
  b.fillRect(0, 0, 512, 512);
  const br = rngFactory(7717);
  for (let i = 0; i < 800; i++) {
    const x = br() * 512, y = br() * 512, r = 1 + br() * 8;
    b.fillStyle = `rgba(${br() > 0.5 ? 190 : 60},${br() > 0.5 ? 190 : 60},${br() > 0.5 ? 190 : 60},.14)`;
    b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
  }
  return {
    map: new THREE.CanvasTexture(color),
    bump: new THREE.CanvasTexture(bump),
  };
}

function softCircleTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTexture(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(0.28, inner);
    g.addColorStop(0.62, 'rgba(255,255,255,.22)');
    g.addColorStop(1, outer);
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
}

function leafTexture() {
  return canvasTexture(64, 64, (c) => {
    c.translate(32, 32);
    c.rotate(0.5);
    c.fillStyle = '#d9a65b';
    c.beginPath();
    c.moveTo(0, -25);
    c.quadraticCurveTo(18, -8, 0, 24);
    c.quadraticCurveTo(-18, -8, 0, -25);
    c.fill();
    c.strokeStyle = 'rgba(78,42,20,.55)';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -20); c.lineTo(0, 18); c.stroke();
  });
}

function makeGlowTexture() {
  return canvasTexture(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,225,165,1)');
    g.addColorStop(0.15, 'rgba(255,177,92,.9)');
    g.addColorStop(0.42, 'rgba(239,112,48,.33)');
    g.addColorStop(1, 'rgba(255,110,40,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  });
}

function makeMoonTexture() {
  const rand = rngFactory(99);
  return canvasTexture(256, 256, (c) => {
    const halo = c.createRadialGradient(128, 128, 20, 128, 128, 128);
    halo.addColorStop(0, 'rgba(226,239,235,1)');
    halo.addColorStop(0.23, 'rgba(210,229,226,.92)');
    halo.addColorStop(0.30, 'rgba(166,194,192,.30)');
    halo.addColorStop(0.6, 'rgba(130,166,166,.08)');
    halo.addColorStop(1, 'rgba(100,140,140,0)');
    c.fillStyle = halo; c.fillRect(0, 0, 256, 256);
    c.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 45; i++) {
      const x = 128 + (rand() - 0.5) * 70, y = 128 + (rand() - 0.5) * 70, r = 2 + rand() * 12;
      c.fillStyle = `rgba(120,148,148,${0.05 + rand() * 0.08})`;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
  });
}

function makeSealTexture() {
  return canvasTexture(512, 512, (c) => {
    c.clearRect(0, 0, 512, 512);
    c.translate(256, 256);
    c.strokeStyle = 'rgba(211,173,100,.95)';
    c.lineWidth = 3;
    for (const r of [232, 214, 130, 116]) {
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
    }
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2;
      const r0 = i % 4 === 0 ? 205 : 218;
      c.beginPath();
      c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      c.lineTo(Math.cos(a) * 226, Math.sin(a) * 226);
      c.stroke();
    }
    // radial "seal script" ticks
    c.lineWidth = 5;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      c.save(); c.rotate(a);
      c.beginPath(); c.moveTo(150, 0); c.lineTo(185, 0); c.moveTo(165, -12); c.lineTo(165, 12); c.stroke();
      c.restore();
    }
    c.fillStyle = 'rgba(211,173,100,.72)';
    c.font = '700 116px "Songti SC","STSong",serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('镇', 0, 4);
    c.globalAlpha = 0.32;
    for (let i = 0; i < 4; i++) {
      c.save(); c.rotate(i * Math.PI / 2 + Math.PI / 4);
      c.font = '600 31px "Songti SC",serif';
      c.fillText('山 門 不 開', 0, -171);
      c.restore();
    }
  });
}

function makeBannerTexture(glyph) {
  const rand = rngFactory(515);
  return canvasTexture(256, 640, (c) => {
    c.clearRect(0, 0, 256, 640);
    const g = c.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, '#4c1715');
    g.addColorStop(0.25, '#7b2420');
    g.addColorStop(0.55, '#942d23');
    g.addColorStop(0.8, '#6a1b19');
    g.addColorStop(1, '#3c1111');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(8, 0); c.lineTo(248, 0); c.lineTo(248, 552);
    c.lineTo(226, 590); c.lineTo(208, 556); c.lineTo(192, 622);
    c.lineTo(172, 572); c.lineTo(148, 608); c.lineTo(126, 562);
    c.lineTo(104, 616); c.lineTo(82, 566); c.lineTo(58, 604);
    c.lineTo(40, 556); c.lineTo(8, 570); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(198,147,77,.65)';
    c.lineWidth = 3;
    c.strokeRect(22, 20, 212, 534);
    c.strokeRect(32, 30, 192, 514);
    c.fillStyle = 'rgba(198,147,77,.15)';
    for (let i = 0; i < 20; i++) {
      c.fillRect(32, 30 + rand() * 500, 192, 1);
    }
    c.fillStyle = 'rgba(214,171,98,.92)';
    c.font = '700 132px "Kaiti SC","STKaiti","KaiTi",serif';
    c.textAlign = 'center';
    c.fillText(glyph, 128, 220);
    c.font = '500 30px "Songti SC",serif';
    c.letterSpacing = '8px';
    c.fillText('镇 山', 128, 290);
    // torn holes
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) {
      const x = 30 + rand() * 196, y = 300 + rand() * 270, r = 2 + rand() * 10;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
  });
}

function makePlaqueTexture(text) {
  return canvasTexture(256, 320, (c) => {
    const g = c.createLinearGradient(0, 0, 256, 320);
    g.addColorStop(0, '#231c15'); g.addColorStop(0.5, '#33271a'); g.addColorStop(1, '#1b1510');
    c.fillStyle = g; c.fillRect(0, 0, 256, 320);
    c.strokeStyle = '#b8904f'; c.lineWidth = 7; c.strokeRect(10, 10, 236, 300);
    c.strokeStyle = 'rgba(184,144,79,.35)'; c.lineWidth = 2; c.strokeRect(24, 24, 208, 272);
    c.fillStyle = '#d4ae6f';
    c.font = '700 102px "Kaiti SC","STKaiti",serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text[0], 128, 106);
    c.fillText(text[1] || '', 128, 217);
  });
}

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 0;
    this.rand = rngFactory(20261114);
    this.lanternFlames = [];
    this.windMaterials = [];
    this.banners = [];
    this.mistSprites = [];
    this.grass = null;
    this.reeds = null;
    this.seal = null;
    this.reflector = null;
    this.leafParticles = null;
    this.snowParticles = null;
    this.embers = null;
    this.build();
  }

  build() {
    this.scene.fog = new THREE.FogExp2(0x172528, 0.0175);
    this.buildSky();
    this.buildMountains();
    this.buildWater();
    this.buildArena();
    this.buildTorii();
    this.buildLanterns();
    this.buildRuins();
    this.buildBanners();
    this.buildGrass();
    this.buildWeather();
    this.buildMist();
    this.buildLights();
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(220, 40, 24);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uHorizon: { value: srgb(0x566e72) },
        uZenith: { value: srgb(0x0b1720) },
        uMoonDir: { value: new THREE.Vector3(-0.52, 0.26, 0.81).normalize() },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        uniform vec3 uMoonDir;
        varying vec3 vWorld;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
        float noise(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                     mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
        }
        void main() {
          vec3 d = normalize(vWorld);
          float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, smoothstep(0.47, 0.86, h));
          float moonGlow = pow(max(dot(d, uMoonDir), 0.0), 12.0);
          col += vec3(0.34, 0.40, 0.39) * moonGlow * 0.32;
          float n = noise(d * 6.0 + vec3(uTime * 0.006, 0.0, 0.0));
          float band = smoothstep(0.47, 0.72, n) * smoothstep(0.35, 0.55, h) * (1.0 - smoothstep(0.72, 0.9, h));
          col = mix(col, vec3(0.20, 0.25, 0.27), band * 0.38);
          float n2 = noise(d * 16.0 + 3.0);
          col += vec3(0.03, 0.04, 0.045) * smoothstep(0.72, 0.9, n2) * smoothstep(0.4, 0.7, h);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.renderOrder = -20;
    this.scene.add(sky);
    this.skyMat = mat;

    const moonMat = new THREE.SpriteMaterial({
      map: makeMoonTexture(),
      color: 0xdcece7,
      transparent: true,
      depthWrite: false,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    const moon = new THREE.Sprite(moonMat);
    moon.position.set(-58, 36, 88);
    moon.scale.set(42, 42, 1);
    moon.renderOrder = -19;
    this.scene.add(moon);
    this.moon = moon;
  }

  buildMountains() {
    this.mountainLayers = [];
    const layers = [
      { radius: 48, base: -1.5, top: 8, color: 0x243638, fog: 0.58, segments: 128, seed: 4 },
      { radius: 72, base: -2.0, top: 14, color: 0x2a3b3d, fog: 0.36, segments: 128, seed: 9 },
      { radius: 112, base: -2.5, top: 19, color: 0x33494b, fog: 0.18, segments: 96, seed: 23 },
    ];
    for (const def of layers) {
      const rand = rngFactory(def.seed);
      const segs = def.segments;
      const positions = [];
      const heights = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs * Math.PI * 2;
        const n = Math.sin(t * 3.0 + 0.4) * 0.24 + Math.sin(t * 7.0 + 1.2) * 0.16 + (rand() - 0.5) * 0.5;
        heights.push(def.top * (0.52 + Math.max(0, n) * 1.15));
      }
      for (let i = 0; i < segs; i++) {
        const t0 = i / segs * Math.PI * 2;
        const t1 = (i + 1) / segs * Math.PI * 2;
        const x0 = Math.cos(t0) * def.radius, z0 = Math.sin(t0) * def.radius;
        const x1 = Math.cos(t1) * def.radius, z1 = Math.sin(t1) * def.radius;
        const y0 = heights[i], y1 = heights[i + 1];
        positions.push(x0, def.base, z0, x1, def.base, z1, x1, y1, z1);
        positions.push(x0, def.base, z0, x1, y1, z1, x0, y0, z0);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.MeshBasicMaterial({ color: def.color, side: THREE.BackSide, fog: true, transparent: true, opacity: 1 });
      // Vary the silhouette through fog instead of making every ridge equally dark.
      const mesh = new THREE.Mesh(geo, mat);
      if (def.fog < 0.3) mesh.material.color.lerp(srgb(0x8fa5a4), 1 - def.fog);
      else mesh.material.color.lerp(srgb(0x7f9695), 1 - def.fog * 1.3);
      mesh.renderOrder = -10 + def.radius * 0.001;
      this.scene.add(mesh);
      this.mountainLayers.push(mesh);
    }
  }

  buildWater() {
    const waterShader = {
      name: 'YaowangWater',
      uniforms: {
        color: { value: new THREE.Color(0x22383a) },
        tDiffuse: { value: null },
        textureMatrix: { value: new THREE.Matrix4() },
        uTime: { value: 0 },
        uFogColor: { value: new THREE.Color(0x172528) },
      },
      vertexShader: /* glsl */`
        uniform mat4 textureMatrix;
        varying vec4 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = textureMatrix * vec4(position, 1.0);
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 color;
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform vec3 uFogColor;
        varying vec4 vUv;
        varying vec3 vWorld;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        void main() {
          vec2 uv = vUv.xy / max(vUv.w, 0.0001);
          vec2 w = vec2(
            sin(uv.y * 94.0 + uTime * 1.2 + sin(uv.x * 17.0)) * 0.0015,
            cos(uv.x * 74.0 + uTime * 0.9 + sin(uv.y * 21.0)) * 0.0015
          );
          float n = hash(floor(uv * 180.0 + uTime * 0.18));
          float glint = smoothstep(0.965, 1.0, n) * 0.22;
          vec3 refl = texture2D(tDiffuse, clamp(uv + w, vec2(0.001), vec2(0.999))).rgb;
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.0);
          vec3 col = mix(refl * vec3(0.42, 0.55, 0.56), color, 0.30 + fres * 0.24);
          col += refl * glint * 1.8;
          col += vec3(0.018, 0.034, 0.035) * (0.5 + 0.5 * sin(uv.y * 60.0 + uTime * 0.6));
          float dist = length(cameraPosition - vWorld);
          col = mix(col, uFogColor, smoothstep(28.0, 78.0, dist) * 0.82);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    };
    this.reflector = new Reflector(new THREE.PlaneGeometry(130, 110, 1, 1), {
      clipBias: 0.003,
      textureWidth: 512,
      textureHeight: 512,
      color: 0x22383a,
      multisample: 0,
      shader: waterShader,
    });
    this.reflector.rotation.x = -Math.PI / 2;
    this.reflector.position.set(0, -0.58, -6);
    this.reflector.material.uniforms.uTime.value = 0;
    this.reflector.renderOrder = -2;
    this.scene.add(this.reflector);

    // Dark bank of fog / silt just under the platform hides the reflection seam.
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x142124, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(13.4, 17.2, 96), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.51;
    this.scene.add(ring);
  }

  buildArena() {
    const rand = this.rand;
    const shape = new THREE.Shape();
    const N = 96;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2;
      const r = 13.0 + Math.sin(a * 3 + 0.7) * 0.22 + Math.sin(a * 7.0 + 2.1) * 0.16 + (rand() - 0.5) * 0.18;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
    const floorGeo = new THREE.ShapeGeometry(shape);
    const tex = makeStoneTextures();
    tex.map.colorSpace = THREE.SRGBColorSpace;
    tex.map.wrapS = tex.map.wrapT = THREE.RepeatWrapping;
    tex.map.repeat.set(0.22, 0.22);
    tex.bump.wrapS = tex.bump.wrapT = THREE.RepeatWrapping;
    tex.bump.repeat.set(0.22, 0.22);
    tex.map.anisotropy = 8;
    const floorMat = new THREE.MeshStandardMaterial({
      map: tex.map,
      bumpMap: tex.bump,
      bumpScale: 0.075,
      color: 0xb3b3a7,
      roughness: 0.77,
      metalness: 0.03,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.floor = floor;

    const sideMat = new THREE.MeshStandardMaterial({ map: tex.map, bumpMap: tex.bump, bumpScale: 0.06, color: 0x777a6d, roughness: 0.9 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(13.05, 13.55, 0.72, 96), sideMat);
    base.position.y = -0.37;
    base.receiveShadow = true;
    base.castShadow = true;
    this.scene.add(base);

    // outer rim stones - broken, uneven, with gaps
    const rimGeo = new THREE.BoxGeometry(1.25, 0.34, 0.85);
    const rimMat = new THREE.MeshStandardMaterial({ map: tex.map, color: 0x9a9b8c, roughness: 0.85 });
    const rim = new THREE.InstancedMesh(rimGeo, rimMat, 72);
    rim.castShadow = true; rim.receiveShadow = true;
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2 + 0.015;
      if (rand() < 0.12) continue;
      const r = 13.32 + (rand() - 0.5) * 0.12;
      dummy.position.set(Math.cos(a) * r, -0.02 + (rand() - 0.5) * 0.12, Math.sin(a) * r);
      dummy.rotation.set((rand() - 0.5) * 0.16, -a + Math.PI / 2 + (rand() - 0.5) * 0.15, (rand() - 0.5) * 0.2);
      dummy.scale.set(0.8 + rand() * 0.55, 0.7 + rand() * 0.8, 0.7 + rand() * 0.5);
      dummy.updateMatrix();
      rim.setMatrixAt(idx++, dummy.matrix);
    }
    rim.count = idx;
    this.scene.add(rim);

    // centre seal
    const sealMat = new THREE.MeshBasicMaterial({
      map: makeSealTexture(),
      transparent: true,
      opacity: 0.30,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      color: 0xc4a266,
      toneMapped: false,
    });
    const seal = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 9.2), sealMat);
    seal.rotation.x = -Math.PI / 2;
    seal.position.y = 0.016;
    this.scene.add(seal);
    this.seal = seal;

    // scattered slab fragments and cracks
    const fragMat = new THREE.MeshStandardMaterial({ map: tex.map, color: 0x8b8d80, roughness: 0.9 });
    for (let i = 0; i < 30; i++) {
      const a = rand() * Math.PI * 2;
      const r = 1.2 + rand() * 10.5;
      const s = 0.08 + rand() * 0.28;
      const g = new THREE.BoxGeometry(s * 2.4, 0.05, s);
      const m = new THREE.Mesh(g, fragMat);
      m.position.set(Math.cos(a) * r, 0.018, Math.sin(a) * r);
      m.rotation.set((rand() - 0.5) * 0.2, rand() * 6, (rand() - 0.5) * 0.2);
      m.receiveShadow = true;
      this.scene.add(m);
    }
    const crackPositions = [];
    for (let i = 0; i < 30; i++) {
      let a = rand() * Math.PI * 2;
      let r = 1 + rand() * 10.5;
      let x = Math.cos(a) * r, z = Math.sin(a) * r;
      crackPositions.push(x, 0.022, z);
      for (let j = 0; j < 4; j++) {
        x += (rand() - 0.5) * 1.3; z += (rand() - 0.5) * 1.3;
        crackPositions.push(x, 0.022, z);
      }
    }
    const crackGeo = new THREE.BufferGeometry();
    crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(crackPositions, 3));
    const cracks = new THREE.LineSegments(crackGeo, new THREE.LineBasicMaterial({ color: 0x161c19, transparent: true, opacity: 0.55 }));
    this.scene.add(cracks);

    // shallow puddles in the arena
    const puddleMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x1b2f33) },
        uSky: { value: new THREE.Color(0x718b8b) },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uSky;
        varying vec2 vUv;
        varying vec3 vWorld;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        void main() {
          vec2 d = vUv - 0.5;
          float r = length(d);
          float edge = smoothstep(0.49, 0.32, r);
          float n = hash(floor(vUv * 70.0 + uTime * 0.06));
          float glint = smoothstep(0.96, 1.0, n) * 0.25;
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.0);
          vec3 col = mix(uColor, uSky, 0.28 + fres * 0.35);
          col += glint * vec3(0.55, 0.62, 0.60);
          gl_FragColor = vec4(col, edge * (0.40 + fres * 0.20));
        }
      `,
    });
    this.puddleMat = puddleMat;
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      const r = 3.2 + rand() * 6.2;
      const size = 1.1 + rand() * 2.4;
      const g = new THREE.CircleGeometry(size, 24);
      // create organic edge
      const pos = g.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        if (v === 0) continue;
        const x = pos.getX(v), y = pos.getY(v);
        const n = 1 + Math.sin(Math.atan2(y, x) * 5 + i) * 0.12 + Math.sin(Math.atan2(y, x) * 9) * 0.06;
        pos.setXY(v, x * n, y * n);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, puddleMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rand() * 3;
      m.position.set(Math.cos(a) * r, 0.012, Math.sin(a) * r);
      this.scene.add(m);
    }

    // stone steps to the gate behind the arena
    const stepMat = new THREE.MeshStandardMaterial({ map: tex.map, color: 0x8b8d80, roughness: 0.88 });
    for (let i = 0; i < 7; i++) {
      const w = 5.4 + i * 0.5;
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.78), stepMat);
      step.position.set(0, 0.11 + i * 0.12, -14.2 - i * 0.72);
      step.receiveShadow = true; step.castShadow = true;
      this.scene.add(step);
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9 + i * 0.12, 0.8), stepMat);
      wallL.position.set(-(w / 2 + 0.1), (0.45 + i * 0.12), -14.2 - i * 0.72);
      wallL.castShadow = true; wallL.receiveShadow = true; this.scene.add(wallL);
      const wallR = wallL.clone(); wallR.position.x *= -1; this.scene.add(wallR);
    }
  }

  buildTorii() {
    const group = new THREE.Group();
    group.position.set(0, 0.82, -14.2);
    this.scene.add(group);
    const vermilion = new THREE.MeshStandardMaterial({ color: 0x7c2a23, roughness: 0.7, metalness: 0.05 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x22211e, roughness: 0.72, metalness: 0.15 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x6b6e61, roughness: 0.92 });
    const gold = new THREE.MeshStandardMaterial({ color: 0x9a7741, roughness: 0.42, metalness: 0.62 });
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
      m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
    };
    for (const x of [-4.35, 4.35]) {
      const base = add(new THREE.BoxGeometry(1.35, 0.55, 1.35), stone, x, 0.28, 0);
      const pillar = add(new THREE.CylinderGeometry(0.34, 0.43, 6.9, 14), vermilion, x, 3.9, 0);
      pillar.rotation.z = x > 0 ? -0.025 : 0.025;
      add(new THREE.CylinderGeometry(0.48, 0.48, 0.18, 16), dark, x, 0.62, 0);
      add(new THREE.CylinderGeometry(0.47, 0.47, 0.18, 16), dark, x, 7.22, 0);
      // metal footing
      add(new THREE.CylinderGeometry(0.46, 0.5, 0.32, 8), gold, x, 0.82, 0);
      for (let r = 0; r < 3; r++) {
        add(new THREE.CylinderGeometry(0.43, 0.43, 0.045, 16), gold, x, 2.1 + r * 1.2, 0);
      }
      // moss beads
      add(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3d4d34, roughness: 1 }), x + 0.28, 0.85, 0.18);
    }
    // kasagi - layered curved top (three slabs)
    add(new THREE.BoxGeometry(11.8, 0.38, 0.9), dark, 0, 7.42, 0);
    add(new THREE.BoxGeometry(11.0, 0.30, 0.72), vermilion, 0, 7.13, 0);
    add(new THREE.BoxGeometry(12.5, 0.20, 1.12), dark, 0, 7.62, 0);
    add(new THREE.BoxGeometry(8.7, 0.32, 0.6), vermilion, 0, 5.72, 0);
    add(new THREE.BoxGeometry(9.6, 0.14, 0.76), gold, 0, 5.92, 0);
    // upturned end caps
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(1.4, 0.36, 1.14), dark, s * 6.15, 7.7, 0, 0, 0, s * 0.10);
      add(new THREE.BoxGeometry(1.0, 0.20, 0.9), gold, s * 5.9, 7.53, 0, 0, 0, s * 0.08);
    }
    // plaque
    const plaqueMat = new THREE.MeshStandardMaterial({ map: makePlaqueTexture('山门'), roughness: 0.6, metalness: 0.2, color: 0xd6c6a5 });
    const plaque = add(new THREE.BoxGeometry(1.45, 1.85, 0.16), plaqueMat, 0, 6.45, 0.48);
    add(new THREE.BoxGeometry(1.62, 2.02, 0.10), dark, 0, 6.45, 0.4);
    plaque.position.z = 0.51;
    // rope across, with paper shide
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x6d5a3c, roughness: 1 });
    const curvePts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      curvePts.push(new THREE.Vector3(-3.5 + 7 * t, 5.22 - Math.sin(t * Math.PI) * 0.42, 0.26));
    }
    const curve = new THREE.CatmullRomCurve3(curvePts);
    const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.075, 6, false), ropeMat);
    rope.castShadow = true;
    group.add(rope);
    const paper = new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.9, side: THREE.DoubleSide });
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      const p = curve.getPoint(t);
      for (let k = 0; k < 3; k++) {
        const shide = add(new THREE.BoxGeometry(0.16, 0.3, 0.018), paper, p.x, p.y - 0.23 - k * 0.28, p.z + 0.03, 0, 0, (k % 2 ? 1 : -1) * 0.2);
        shide.castShadow = false;
      }
    }
    // small bell hanging at centre
    const bell = add(new THREE.SphereGeometry(0.21, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.75), gold, 0, 4.82, 0.25);
    bell.scale.y = 1.12;
    add(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), dark, 0, 5.03, 0.25);
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 5), ropeMat, 0, 5.18, 0.25);
    // side plaques on pillars
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.16, 1.0, 0.06), gold, s * 4.35, 4.1, 0.42);
    }
    this.torii = group;
  }

  buildLanterns() {
    const stone = new THREE.MeshStandardMaterial({ color: 0x65695d, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x282a25, roughness: 0.7, metalness: 0.2 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xffb05c, emissive: 0xff7b2f, emissiveIntensity: 3.6, roughness: 0.4, toneMapped: true });
    const glowTex = makeGlowTexture();
    const positions = [
      [-9.7, -7.4, 1.08, true], [9.5, -7.3, 1.02, true], [-10.7, 3.9, 0.92, true], [10.8, 4.4, 0.98, true],
      [-5.8, -11.7, 0.86, false], [5.9, -11.6, 0.90, false], [-12.0, -1.4, 0.8, false], [12.3, -0.9, 0.82, false],
    ];
    for (let i = 0; i < positions.length; i++) {
      const [x, z, s, lit] = positions[i];
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.scale.setScalar(s);
      this.scene.add(g);
      const add = (geo, mat, y) => {
        const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
      };
      add(new THREE.CylinderGeometry(0.6, 0.72, 0.22, 8), dark, 0.11);
      add(new THREE.CylinderGeometry(0.4, 0.52, 0.18, 8), stone, 0.28);
      add(new THREE.CylinderGeometry(0.21, 0.27, 1.2, 10), stone, 0.97);
      add(new THREE.CylinderGeometry(0.36, 0.30, 0.16, 8), dark, 1.61);
      // fire chamber frame
      add(new THREE.BoxGeometry(0.88, 0.62, 0.88), dark, 1.98);
      const paneGeo = new THREE.BoxGeometry(0.52, 0.42, 0.52);
      const pane = add(paneGeo, glowMat, 1.98);
      // roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.46, 4), stone);
      roof.rotation.y = Math.PI / 4; roof.position.y = 2.50; roof.castShadow = true; g.add(roof);
      add(new THREE.SphereGeometry(0.10, 8, 6), dark, 2.80);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb15c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      flame.scale.setScalar(2.4);
      flame.position.y = 1.98;
      g.add(flame);
      if (lit) {
        const light = new THREE.PointLight(0xff9a4c, 20, 11, 2);
        light.position.set(0, 2.0, 0);
        g.add(light);
        this.lanternFlames.push({ sprite: flame, light, base: 20, phase: Math.random() * 8, group: g });
      } else {
        this.lanternFlames.push({ sprite: flame, light: null, base: 0, phase: Math.random() * 8, group: g });
      }
    }
  }

  buildRuins() {
    const stone = new THREE.MeshStandardMaterial({ color: 0x676a5d, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x353a32, roughness: 0.88 });
    const rand = this.rand;
    const columns = [
      { x: -10.2, z: 6.2, h: 3.3, tilt: 0.08 },
      { x: 9.8, z: 7.0, h: 1.7, tilt: -0.12 },
      { x: -8.9, z: -2.2, h: 2.3, tilt: 0.18 },
      { x: 11.1, z: -4.6, h: 4.4, tilt: -0.05 },
      { x: -12.0, z: 8.5, h: 1.2, tilt: 0.22 },
      { x: 6.0, z: 11.6, h: 2.8, tilt: -0.18 },
    ];
    for (let i = 0; i < columns.length; i++) {
      const c = columns[i];
      const g = new THREE.Group();
      g.position.set(c.x, 0, c.z);
      this.scene.add(g);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.28, 1.4), dark);
      base.position.y = 0.14; base.castShadow = true; base.receiveShadow = true; g.add(base);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, c.h, 10), stone);
      drum.position.y = 0.28 + c.h / 2; drum.rotation.z = c.tilt; drum.rotation.x = (rand() - 0.5) * 0.12;
      drum.castShadow = true; drum.receiveShadow = true; g.add(drum);
      // capital + broken jagged top
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.55, 0.25, 8), dark);
      cap.position.set(-Math.sin(c.tilt) * c.h, 0.28 + c.h, 0); cap.castShadow = true; g.add(cap);
      const breakMat = new THREE.MeshStandardMaterial({ color: 0x55584c, roughness: 1 });
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rand() * 0.22, 0), breakMat);
      chunk.position.set(cap.position.x + (rand() - 0.5) * 0.3, cap.position.y + 0.24, (rand() - 0.5) * 0.3);
      chunk.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      chunk.castShadow = true; g.add(chunk);
      // fallen drum nearby
      if (i % 2 === 0) {
        const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.4, 10), stone);
        fallen.rotation.z = Math.PI / 2; fallen.rotation.y = rand() * 3;
        fallen.position.set(c.x + 1.7 + rand() * 1.2, 0.5, c.z + (rand() - 0.5) * 2.2);
        fallen.castShadow = true; fallen.receiveShadow = true; this.scene.add(fallen);
      }
      // mossy patches
      const moss = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 5), new THREE.MeshStandardMaterial({ color: 0x3f5038, roughness: 1 }));
      moss.scale.set(1.2, 0.18, 0.8);
      moss.position.set(c.x + 0.4, 0.58, c.z + 0.35);
      moss.receiveShadow = true; this.scene.add(moss);
    }
    // half-buried guardian head
    const head = new THREE.Group();
    head.position.set(10.6, 0.2, 9.8);
    head.rotation.y = -0.8;
    this.scene.add(head);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x565a4f, roughness: 0.96 });
    const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(1.55, 0), headMat);
    skull.scale.set(1, 0.78, 0.92); skull.castShadow = true; skull.receiveShadow = true; head.add(skull);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 1.1), headMat);
    jaw.position.set(0, -0.8, 0.55); jaw.rotation.x = 0.2; head.add(jaw);
    for (const s of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.25), dark);
      brow.position.set(s * 0.46, 0.35, 1.22); brow.rotation.z = s * 0.17; head.add(brow);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1a1e19, roughness: 1 }));
      eye.position.set(s * 0.46, 0.18, 1.3); head.add(eye);
    }
    const headMoss = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshStandardMaterial({ color: 0x37462f, roughness: 1 }));
    headMoss.scale.set(1.3, 0.18, 1.1); headMoss.position.set(0.2, 0.86, -0.1); head.add(headMoss);

    // fallen beams near gate
    for (let i = 0; i < 4; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 3.2 + rand() * 2), dark);
      beam.position.set(-7.5 + rand() * 15, 0.2, -8.5 - rand() * 4);
      beam.rotation.set((rand() - 0.5) * 0.1, rand() * Math.PI, (rand() - 0.5) * 0.08);
      beam.castShadow = true; this.scene.add(beam);
    }
  }

  buildBanners() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x242722, roughness: 0.8, metalness: 0.3 });
    const gold = new THREE.MeshStandardMaterial({ color: 0x947342, roughness: 0.4, metalness: 0.7 });
    const placements = [
      { x: -7.4, z: -6.5, rot: 0.15, glyph: '妖' },
      { x: 7.6, z: -6.1, rot: -0.22, glyph: '镇' },
      { x: -11.8, z: -9.8, rot: 0.3, glyph: '山' },
    ];
    placements.forEach((p, i) => {
      const group = new THREE.Group();
      group.position.set(p.x, 0, p.z);
      group.rotation.y = p.rot;
      this.scene.add(group);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 6.2, 8), poleMat);
      pole.position.y = 3.1; pole.castShadow = true; group.add(pole);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 7), poleMat);
      arm.rotation.z = Math.PI / 2; arm.position.set(0.85, 5.2, 0); arm.castShadow = true; group.add(arm);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 7), gold);
      tip.position.y = 6.3; group.add(tip);
      const bannerMat = new THREE.MeshStandardMaterial({
        map: makeBannerTexture(p.glyph),
        transparent: true,
        alphaTest: 0.22,
        side: THREE.DoubleSide,
        roughness: 0.9,
        color: 0xd4b7a5,
      });
      const geo = new THREE.PlaneGeometry(1.85, 4.2, 12, 20);
      const banner = new THREE.Mesh(geo, bannerMat);
      banner.position.set(0.55, 3.05, 0.02);
      banner.castShadow = true;
      group.add(banner);
      const base = geo.attributes.position.array.slice();
      this.banners.push({ mesh: banner, base, phase: i * 1.7 });
    });
  }

  buildGrass() {
    const rand = this.rand;
    const blade = new THREE.BufferGeometry();
    // three tapered blades, bent
    const verts = [];
    const bladeDefs = [
      { a: 0.0, w: 0.055, h: 0.82, bend: 0.13 },
      { a: 2.0, w: 0.048, h: 0.68, bend: -0.10 },
      { a: 4.1, w: 0.06, h: 0.94, bend: 0.17 },
      { a: 5.3, w: 0.035, h: 0.55, bend: -0.12 },
    ];
    for (const b of bladeDefs) {
      const ca = Math.cos(b.a), sa = Math.sin(b.a);
      const segs = 3;
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs;
        const w0 = b.w * (1 - t0), w1 = b.w * (1 - t1);
        const y0 = b.h * t0, y1 = b.h * t1;
        const x0 = b.bend * t0 * t0, x1 = b.bend * t1 * t1;
        // two triangles per segment
        verts.push(
          -w0 * ca + x0 * ca, y0, -w0 * sa + x0 * sa,
          w0 * ca + x0 * ca, y0, w0 * sa + x0 * sa,
          -w1 * ca + x1 * ca, y1, -w1 * sa + x1 * sa,
          w0 * ca + x0 * ca, y0, w0 * sa + x0 * sa,
          w1 * ca + x1 * ca, y1, w1 * sa + x1 * sa,
          -w1 * ca + x1 * ca, y1, -w1 * sa + x1 * sa,
        );
      }
    }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    blade.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0.0,
      side: THREE.DoubleSide,
      vertexColors: false,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;');
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', /* glsl */`
        vec3 transformed = vec3(position);
        float phase = 1.7;
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
          phase = ip.x * 1.31 + ip.z * 1.73;
        #endif
        float h = smoothstep(0.0, 0.9, position.y);
        float sway = sin(uTime * 1.35 + phase) * 0.10 + sin(uTime * 2.8 + phase * 1.7) * 0.035;
        transformed.x += sway * h * h;
        transformed.z += cos(uTime * 1.1 + phase * 0.9) * 0.045 * h * h;
      `);
      mat.userData.shader = shader;
    };
    this.windMaterials.push(mat);
    const grass = new THREE.InstancedMesh(blade, mat, 9000);
    grass.receiveShadow = true;
    grass.castShadow = false;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    let idx = 0;
    for (let i = 0; i < 9000; i++) {
      let a = rand() * Math.PI * 2;
      let r = 8.7 + Math.pow(rand(), 0.55) * 5.3;
      // a few interior tufts around the edges and ruins
      if (i % 17 === 0) { r = 9.4 + rand() * 2.8; }
      if (r < 12.7 && rand() < 0.25) continue;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = 0.55 + rand() * 0.9;
      dummy.position.set(x, 0.01, z);
      dummy.rotation.y = rand() * Math.PI * 2;
      dummy.scale.set(0.7 + rand() * 0.8, h, 0.7 + rand() * 0.8);
      dummy.updateMatrix();
      grass.setMatrixAt(idx, dummy.matrix);
      const warm = rand();
      col.setRGB(0.17 + warm * 0.16, 0.19 + warm * 0.11, 0.10 + warm * 0.05);
      grass.setColorAt(idx, col);
      idx++;
    }
    grass.count = idx;
    this.scene.add(grass);
    this.grass = grass;

    // reeds near the water
    const reedGeo = new THREE.CylinderGeometry(0.012, 0.035, 1.8, 3);
    const reedMat = mat.clone();
    reedMat.onBeforeCompile = mat.onBeforeCompile;
    const reeds = new THREE.InstancedMesh(reedGeo, reedMat, 900);
    for (let i = 0; i < 900; i++) {
      const a = rand() * Math.PI * 2;
      const r = 13.7 + rand() * 4.5;
      dummy.position.set(Math.cos(a) * r, 0.6, Math.sin(a) * r);
      dummy.rotation.set((rand() - 0.5) * 0.2, rand() * 6, (rand() - 0.5) * 0.2);
      dummy.scale.set(1, 0.6 + rand() * 1.1, 1);
      dummy.updateMatrix();
      reeds.setMatrixAt(i, dummy.matrix);
      col.setRGB(0.22, 0.24, 0.15);
      reeds.setColorAt(i, col);
    }
    reeds.receiveShadow = true;
    this.scene.add(reeds);
    this.reeds = reeds;
  }

  buildWeather() {
    const makePoints = (count, texture, size, color, opacity, blending) => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const phase = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 42;
        pos[i * 3 + 1] = Math.random() * 16;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 42 - 4;
        phase[i] = Math.random() * 100;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ map: texture, color, size, transparent: true, opacity, depthWrite: false, alphaTest: 0.05, blending, sizeAttenuation: true });
      const p = new THREE.Points(geo, mat);
      p.frustumCulled = false;
      return { points: p, pos, phase, count };
    };
    this.leafParticles = makePoints(230, leafTexture(), 0.19, 0xd1a05a, 0.9, THREE.NormalBlending);
    this.snowParticles = makePoints(520, softCircleTexture(), 0.055, 0xc4d7d4, 0.75, THREE.NormalBlending);
    this.embers = makePoints(170, softCircleTexture(), 0.09, 0xff9c4c, 0.7, THREE.AdditiveBlending);
    this.scene.add(this.leafParticles.points, this.snowParticles.points, this.embers.points);
  }

  buildMist() {
    const tex = canvasTexture(256, 256, (c) => {
      const rand = rngFactory(12);
      for (let i = 0; i < 18; i++) {
        const x = 40 + rand() * 176, y = 90 + rand() * 100, r = 40 + rand() * 90;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(220,235,232,.12)');
        g.addColorStop(1, 'rgba(220,235,232,0)');
        c.fillStyle = g; c.fillRect(0, 0, 256, 256);
      }
    });
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: 0xaebfbc, transparent: true, opacity: 0.055 + Math.random() * 0.03, depthWrite: false, blending: THREE.NormalBlending });
      const s = new THREE.Sprite(mat);
      const a = Math.random() * Math.PI * 2;
      const r = 16 + Math.random() * 22;
      s.position.set(Math.cos(a) * r, 0.5 + Math.random() * 1.6, Math.sin(a) * r - 5);
      s.scale.set(18 + Math.random() * 18, 5 + Math.random() * 5, 1);
      s.userData.phase = Math.random() * 10;
      s.userData.baseX = s.position.x;
      this.scene.add(s);
      this.mistSprites.push(s);
    }
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0x8caab8, 0x241f17, 1.34);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xd6e5ea, 2.3);
    key.position.set(-10, 17, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -17;
    key.shadow.camera.right = 17;
    key.shadow.camera.top = 17;
    key.shadow.camera.bottom = -17;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 55;
    key.shadow.bias = -0.00035;
    key.shadow.normalBias = 0.025;
    this.scene.add(key);
    this.keyLight = key;

    // cold rim from behind the gate
    const rim = new THREE.DirectionalLight(0x8fb6c8, 1.5);
    rim.position.set(6, 12, -18);
    this.scene.add(rim);
    // warm low fill from the arena's right side
    const fill = new THREE.DirectionalLight(0xffb07a, 0.52);
    fill.position.set(14, 3, 8);
    this.scene.add(fill);
    // cool frontal fill: keeps faces and the hero readable at the play camera
    const faceFill = new THREE.DirectionalLight(0xbcd6dd, 1.08);
    faceFill.position.set(5, 8, 16);
    faceFill.target.position.set(0, 1.2, -2);
    this.scene.add(faceFill, faceFill.target);
    this.scene.add(new THREE.AmbientLight(0x2d3436, 0.34));

    // A single soft pool of light behind the boss so his silhouette separates from the gate.
    const spot = new THREE.SpotLight(0xffc390, 48, 28, 0.55, 0.8, 1.5);
    spot.position.set(0, 11, -12);
    spot.target.position.set(0, 0, -1);
    this.scene.add(spot, spot.target);
  }

  update(dt, time, camera) {
    this.time = time;
    if (this.skyMat) this.skyMat.uniforms.uTime.value = time;
    if (this.reflector) this.reflector.material.uniforms.uTime.value = time;
    if (this.puddleMat) this.puddleMat.uniforms.uTime.value = time;
    if (this.seal) this.seal.rotation.z = Math.sin(time * 0.06) * 0.03;

    for (const m of this.windMaterials) {
      if (m.userData.shader) m.userData.shader.uniforms.uTime.value = time;
    }
    for (const b of this.banners) {
      const pos = b.mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = b.base[i * 3], y = b.base[i * 3 + 1];
        const hang = (4.2 - (y + 2.1)) / 4.2;
        const sway = Math.sin(time * 1.2 + y * 0.7 + b.phase) * 0.10 * hang
          + Math.sin(time * 2.8 + x * 2.2 + b.phase) * 0.03 * hang;
        pos.setX(i, x + sway);
        pos.setZ(i, Math.sin(time * 0.9 + y * 0.55 + b.phase) * 0.08 * hang);
      }
      pos.needsUpdate = true;
      b.mesh.geometry.computeVertexNormals();
    }

    for (const l of this.lanternFlames) {
      const flicker = Math.sin(time * 8.3 + l.phase) * 0.06 + Math.sin(time * 19.7 + l.phase * 2.3) * 0.035;
      l.sprite.material.opacity = 0.70 + flicker;
      l.sprite.scale.setScalar(2.25 + flicker * 1.5);
      if (l.light) l.light.intensity = l.base * (0.86 + flicker * 1.5 + Math.sin(time * 3.1 + l.phase) * 0.04);
    }

    for (const s of this.mistSprites) {
      s.position.x = s.userData.baseX + Math.sin(time * 0.035 + s.userData.phase) * 4.2;
      s.position.y = 0.5 + Math.sin(time * 0.08 + s.userData.phase) * 0.4;
      s.material.opacity = 0.045 + 0.025 * (0.5 + 0.5 * Math.sin(time * 0.07 + s.userData.phase));
    }

    this.updateWeather(dt, time);
  }

  updateWeather(dt, time) {
    if (!this.leafParticles) return;
    const lp = this.leafParticles;
    for (let i = 0; i < lp.count; i++) {
      let y = lp.pos[i * 3 + 1] - dt * (0.55 + (i % 5) * 0.06);
      let x = lp.pos[i * 3] + dt * (0.5 + Math.sin(time * 0.7 + lp.phase[i]) * 0.4);
      let z = lp.pos[i * 3 + 2] + dt * 0.22;
      if (y < -0.2) { y = 14 + Math.random() * 4; x = (Math.random() - 0.5) * 42; z = (Math.random() - 0.5) * 42 - 4; }
      if (x > 21) x = -21; if (x < -21) x = 21;
      if (z > 17) z = -25;
      lp.pos[i * 3] = x; lp.pos[i * 3 + 1] = y; lp.pos[i * 3 + 2] = z;
    }
    lp.points.geometry.attributes.position.needsUpdate = true;
    lp.points.material.opacity = 0.82 + Math.sin(time * 0.3) * 0.08;

    const sp = this.snowParticles;
    for (let i = 0; i < sp.count; i++) {
      let y = sp.pos[i * 3 + 1] - dt * (0.35 + (i % 7) * 0.035);
      let x = sp.pos[i * 3] + dt * Math.sin(time * 0.5 + sp.phase[i]) * 0.28;
      let z = sp.pos[i * 3 + 2] + dt * Math.cos(time * 0.4 + sp.phase[i]) * 0.22;
      if (y < -0.15) { y = 12 + Math.random() * 5; x = (Math.random() - 0.5) * 42; z = (Math.random() - 0.5) * 42 - 4; }
      if (x > 21) x = -21; if (x < -21) x = 21;
      if (z > 17) z = -25;
      sp.pos[i * 3] = x; sp.pos[i * 3 + 1] = y; sp.pos[i * 3 + 2] = z;
    }
    sp.points.geometry.attributes.position.needsUpdate = true;

    const em = this.embers;
    for (let i = 0; i < em.count; i++) {
      let y = em.pos[i * 3 + 1] + dt * (0.18 + (i % 4) * 0.04);
      let x = em.pos[i * 3] + dt * Math.sin(time * 0.8 + em.phase[i]) * 0.12;
      let z = em.pos[i * 3 + 2] + dt * 0.02;
      if (y > 5.2) { y = -0.3; x = (Math.random() - 0.5) * 30; z = (Math.random() - 0.5) * 30 - 4; }
      em.pos[i * 3] = x; em.pos[i * 3 + 1] = y; em.pos[i * 3 + 2] = z;
    }
    em.points.geometry.attributes.position.needsUpdate = true;
    em.points.material.opacity = 0.42 + Math.sin(time * 1.1) * 0.16;
  }
}
