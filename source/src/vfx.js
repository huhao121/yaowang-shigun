import * as THREE from 'three';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,190,110,.55)', outer = 'rgba(255,120,40,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.24, mid);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function runeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);
  ctx.translate(256, 256);
  ctx.strokeStyle = 'rgba(232,189,108,.92)';
  ctx.fillStyle = 'rgba(232,189,108,.92)';
  ctx.lineWidth = 2.4;
  for (const r of [242, 234, 186, 178, 126]) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  }
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(190, 0); ctx.lineTo(228, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 208, -0.035, 0.035); ctx.stroke();
    ctx.restore();
  }
  // pseudo seal-script glyphs around the ring
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU + 0.1;
    ctx.save();
    ctx.rotate(a + Math.PI / 2);
    ctx.translate(0, -155);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const h = 11 + (i % 3) * 5;
    ctx.moveTo(-9, -h); ctx.lineTo(9, -h); ctx.lineTo(5, h); ctx.lineTo(-5, h); ctx.closePath();
    ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
    if (i % 2) { ctx.moveTo(0, -h); ctx.lineTo(0, h); }
    ctx.stroke();
    ctx.restore();
  }
  ctx.font = '700 82px "Kaiti SC","STKaiti","KaiTi",serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('定', 0, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function crackTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);
  ctx.translate(256, 256);
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU + Math.random() * 0.2;
    let x = Math.cos(a) * 20, y = Math.sin(a) * 20;
    ctx.strokeStyle = `rgba(255,${140 + Math.random() * 60},70,${0.5 + Math.random() * 0.5})`;
    ctx.lineWidth = 2 + Math.random() * 3.5;
    ctx.beginPath(); ctx.moveTo(x, y);
    const steps = 4 + Math.floor(Math.random() * 4);
    for (let s = 1; s <= steps; s++) {
      const r = s / steps * (170 + Math.random() * 70);
      x = Math.cos(a + (Math.random() - 0.5) * 0.3) * r;
      y = Math.sin(a + (Math.random() - 0.5) * 0.3) * r;
      ctx.lineTo(x, y);
      if (Math.random() < 0.5) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60);
        ctx.moveTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,220,160,.9)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class ParticlePool {
  constructor(scene, capacity, blending, texture) {
    this.capacity = capacity;
    this.cursor = 0;
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.baseAlpha = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uScale: { value: 700 },
      },
      transparent: true,
      depthWrite: false,
      blending,
      vertexShader: /* glsl */`
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uScale;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uScale / max(0.5, -mv.z), 0.0, 96.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          float a = tex.a * vAlpha;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vColor * (0.7 + tex.a * 0.6), a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    for (let i = 0; i < capacity; i++) {
      this.positions[i * 3 + 1] = -999;
      this.alphas[i] = 0;
    }
  }

  spawn({ x, y, z, vx = 0, vy = 0, vz = 0, life = 0.4, size = 0.08, color = [1, 0.6, 0.2], gravity = 0, drag = 0, grow = 0, alpha = 1 }) {
    const i = this.cursor++ % this.capacity;
    this.positions[i * 3] = x; this.positions[i * 3 + 1] = y; this.positions[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.colors[i * 3] = color[0]; this.colors[i * 3 + 1] = color[1]; this.colors[i * 3 + 2] = color[2];
    this.life[i] = life; this.maxLife[i] = life;
    this.sizes[i] = size; this.baseSize[i] = size;
    this.alphas[i] = alpha; this.baseAlpha[i] = alpha;
    this.gravity[i] = gravity; this.drag[i] = drag; this.grow[i] = grow;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      if (this.life[i] <= 0) {
        this.alphas[i] = 0;
        this.positions[i * 3 + 1] = -999;
        dirty = true;
        continue;
      }
      this.vel[i * 3 + 1] -= this.gravity[i] * dt;
      const dr = Math.pow(Math.max(0, 1 - this.drag[i] * dt), 1);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 1] *= dr; this.vel[i * 3 + 2] *= dr;
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alphas[i] = this.baseAlpha[i] * Math.pow(f, 0.65);
      this.sizes[i] = this.baseSize[i] * (1 + this.grow[i] * (1 - f));
      dirty = true;
    }
    if (dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
    }
  }
}

export class VFX {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 0;
    const soft = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,.5)', 'rgba(255,255,255,0)');
    const spark = glowTexture('rgba(255,255,240,1)', 'rgba(255,208,130,.8)', 'rgba(255,120,40,0)');
    this.sparkPool = new ParticlePool(scene, 900, THREE.AdditiveBlending, spark);
    this.dustPool = new ParticlePool(scene, 600, THREE.NormalBlending, soft);
    this.embersPool = new ParticlePool(scene, 300, THREE.AdditiveBlending, spark);
    this.rings = [];
    this.flashes = [];
    this.warnings = [];
    this.spells = [];
    this.cracks = [];
    this.waves = [];
    this.slashes = [];
    this.glowTex = glowTexture();
    this.runeTex = runeTexture();
    this.crackTex = crackTexture();
    this.setupBladeTrail();
    this.resize();
  }

  resize() {
    const height = this.renderer.domElement.height || 900;
    const scale = height / (2 * Math.tan(THREE.MathUtils.degToRad(52) / 2));
    this.sparkPool.points.material.uniforms.uScale.value = scale;
    this.dustPool.points.material.uniforms.uScale.value = scale;
    this.embersPool.points.material.uniforms.uScale.value = scale;
  }

  setupBladeTrail() {
    this.trailMax = 30;
    const count = this.trailMax * 2;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const uvs = new Float32Array(count * 2);
    const indices = [];
    for (let i = 0; i < this.trailMax - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      indices.push(a, b, c, b, d, c);
    }
    for (let i = 0; i < this.trailMax; i++) {
      uvs[i * 4] = 0; uvs[i * 4 + 1] = i / (this.trailMax - 1);
      uvs[i * 4 + 2] = 1; uvs[i * 4 + 3] = i / (this.trailMax - 1);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0xffe0a0) },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */`
        attribute float aAlpha;
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          vUv = uv;
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        uniform float uTime;
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          float edge = smoothstep(0.0, 0.36, min(vUv.x, 1.0 - vUv.x));
          float tail = pow(vUv.y, 0.82);
          float grain = 0.68 + 0.32 * sin(vUv.y * 48.0 - uTime * 19.0 + sin(vUv.x * 12.0 + uTime * 7.0) * 5.0);
          float streak = 0.55 + 0.45 * smoothstep(0.2, 0.85, sin(vUv.x * 8.0 + vUv.y * 40.0 + uTime * 4.0) * 0.5 + 0.5);
          float a = vAlpha * edge * tail * grain * streak * 0.95;
          if (a < 0.005) discard;
          vec3 col = uColor * (1.0 + 1.8 * tail * tail);
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.trailMesh = new THREE.Mesh(geo, mat);
    this.trailMesh.frustumCulled = false;
    this.trailMesh.renderOrder = 6;
    this.scene.add(this.trailMesh);
    this.trailSamples = [];
    this.trailPositions = positions;
    this.trailAlphas = alphas;
    this.lastTrailSample = 0;
  }

  updateBladeTrail(active, base, tip, dt, color = 0xffdda0) {
    this.trailMesh.material.uniforms.uColor.value.set(color);
    this.trailMesh.material.uniforms.uTime.value = this.time;
    for (const s of this.trailSamples) s.age += dt;
    while (this.trailSamples.length && this.trailSamples[this.trailSamples.length - 1].age > 0.30) {
      this.trailSamples.pop();
    }
    if (active && base && tip) {
      this.lastTrailSample += dt;
      if (this.lastTrailSample > 0.004) {
        this.lastTrailSample = 0;
        this.trailSamples.unshift({
          base: base.clone(), tip: tip.clone(), age: 0,
        });
        if (this.trailSamples.length > this.trailMax) this.trailSamples.length = this.trailMax;
      }
    }
    const n = this.trailSamples.length;
    for (let i = 0; i < n; i++) {
      const s = this.trailSamples[i];
      const fade = Math.pow(Math.max(0, 1 - s.age / 0.30), 1.25) * (1 - i / this.trailMax * 0.35);
      const pi = i * 6;
      this.trailPositions[pi] = s.base.x;
      this.trailPositions[pi + 1] = s.base.y;
      this.trailPositions[pi + 2] = s.base.z;
      this.trailPositions[pi + 3] = s.tip.x;
      this.trailPositions[pi + 4] = s.tip.y;
      this.trailPositions[pi + 5] = s.tip.z;
      this.trailAlphas[i * 2] = fade * 0.38;
      this.trailAlphas[i * 2 + 1] = fade;
    }
    this.trailMesh.geometry.attributes.position.needsUpdate = true;
    this.trailMesh.geometry.attributes.aAlpha.needsUpdate = true;
    this.trailMesh.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
    this.trailMesh.visible = n > 1;
  }

  sparks(pos, dir, count = 14, color = [1.0, 0.66, 0.25], power = 1) {
    const d = dir ? dir.clone().normalize() : new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(
        d.x * rand(-1, 3) + rand(-2.6, 2.6),
        rand(0.4, 4.8),
        d.z * rand(-1, 3) + rand(-2.6, 2.6),
      ).multiplyScalar(power);
      this.sparkPool.spawn({
        x: pos.x + rand(-0.18, 0.18), y: pos.y + rand(-0.18, 0.18), z: pos.z + rand(-0.18, 0.18),
        vx: v.x, vy: v.y, vz: v.z,
        life: rand(0.22, 0.58), size: rand(0.035, 0.11) * power,
        color, gravity: rand(7, 15), drag: 0.8, alpha: 1,
      });
    }
    for (let i = 0; i < Math.max(2, count * 0.35); i++) {
      this.embersPool.spawn({
        x: pos.x + rand(-0.3, 0.3), y: pos.y + rand(-0.2, 0.3), z: pos.z + rand(-0.3, 0.3),
        vx: rand(-0.7, 0.7), vy: rand(0.6, 2.2), vz: rand(-0.7, 0.7),
        life: rand(0.5, 1.2), size: rand(0.04, 0.1), color: [1.0, 0.56, 0.2],
        gravity: -0.3, drag: 1.4, grow: 1.2, alpha: 0.85,
      });
    }
  }

  dust(pos, count = 12, color = [0.35, 0.37, 0.32], spread = 1.4, size = 0.7, upward = 0.6) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const r = Math.random() * spread;
      this.dustPool.spawn({
        x: pos.x + Math.cos(a) * r, y: pos.y + rand(0.04, 0.28), z: pos.z + Math.sin(a) * r,
        vx: Math.cos(a) * rand(0.4, 2.4) * spread, vy: rand(0.2, upward * 2.2), vz: Math.sin(a) * rand(0.4, 2.4) * spread,
        life: rand(0.5, 1.35), size: rand(0.3, size), color, gravity: -0.18, drag: 1.2, grow: 1.9, alpha: 0.30,
      });
    }
  }

  hitFlash(pos, color = 0xffd48a, size = 1.05, life = 0.09) {
    const mat = new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1 });
    const s = new THREE.Sprite(mat);
    s.position.copy(pos);
    s.scale.setScalar(size);
    this.scene.add(s);
    this.flashes.push({ sprite: s, life, maxLife: life, size });
  }

  ring(pos, color = 0xffb06a, maxRadius = 4.5, duration = 0.55, thickness = 0.32) {
    const geo = new THREE.RingGeometry(0.92, 1.0, 64);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos); m.position.y = Math.max(0.04, pos.y);
    m.scale.setScalar(0.3);
    this.scene.add(m);
    this.rings.push({ mesh: m, life: duration, maxLife: duration, maxRadius, thickness });
    // low dust skirt
    this.dust(pos, 14, [0.28, 0.3, 0.27], 1.4, 0.9, 0.7);
  }

  warningCircle(center, radius, duration, color = 0xff7438) {
    const geo = new THREE.CircleGeometry(1, 72);
    const mat = this.makeWarningMaterial(color, false);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center.x, 0.045, center.z);
    mesh.scale.setScalar(radius);
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    const w = { mesh, life: duration, maxLife: duration, radius, progress: 0, kind: 'circle', origin: center.clone(), yaw: 0 };
    this.warnings.push(w);
    return w;
  }

  warningFan(origin, yaw, radius, halfAngle, duration, color = 0xff7438) {
    const geo = new THREE.CircleGeometry(1, 64, -halfAngle, halfAngle * 2);
    const mat = this.makeWarningMaterial(color, true);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    const group = new THREE.Group();
    group.position.set(origin.x, 0.045, origin.z);
    group.rotation.y = yaw - Math.PI / 2;
    group.add(mesh);
    group.scale.setScalar(radius);
    group.renderOrder = 2;
    this.scene.add(group);
    const w = { mesh, group, life: duration, maxLife: duration, radius, progress: 0, kind: 'fan', origin: origin.clone(), yaw, halfAngle };
    this.warnings.push(w);
    return w;
  }

  makeWarningMaterial(color, fan) {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uFan: { value: fan ? 1 : 0 },
        uAlpha: { value: 0.72 },
      },
      vertexShader: /* glsl */`
        varying vec2 vPos;
        varying vec2 vUv;
        void main() {
          vPos = position.xy;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uProgress;
        uniform float uFan;
        uniform float uAlpha;
        varying vec2 vPos;
        varying vec2 vUv;
        void main() {
          float r = length(vPos);
          float a = atan(vPos.y, vPos.x);
          float edge = smoothstep(0.965, 0.995, r) * smoothstep(0.998, 0.99, r);
          float inner = smoothstep(0.44, 0.48, r) * smoothstep(0.54, 0.49, r);
          float rays = smoothstep(0.34, 0.72, sin(a * 23.0 + uTime * 2.4) * 0.5 + 0.5);
          float flow = smoothstep(0.38, 0.8, sin(r * 32.0 - uTime * 5.5 + sin(a * 4.0) * 2.2) * 0.5 + 0.5);
          float spoke = smoothstep(0.10, 0.18, abs(mod(a + 3.14159265, 0.3927) - 0.19635));
          float headAngle = -3.14159265 + uProgress * 6.2831853;
          float dh = atan(sin(a - headAngle), cos(a - headAngle));
          float head = smoothstep(0.055, 0.0, abs(dh));
          float fill = smoothstep(0.0, 0.04, uProgress - (a + 3.14159265) / 6.2831853);
          vec3 col = mix(uColor, vec3(1.0, 0.82, 0.42), uProgress * 0.55);
          float alpha = edge * 0.75 + inner * 0.15 + rays * flow * 0.18 + head * 0.7;
          alpha += fill * 0.055;
          alpha *= uAlpha * (0.55 + 0.45 * sin(uTime * 9.0 + r * 12.0) * 0.5 + 0.5);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col * (1.0 + head * 2.0), alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
  }

  slashArc(origin, yaw, { radius = 1.7, height = 1.3, color = 0xffe2a8, heavy = false, flip = false, duration = 0.26, camera = null } = {}) {
    // A camera-facing crescent ribbon. It is built from 36 quads following a
    // curved, tapered path, so the cut has a head, a tail and a bright edge.
    const N = 36;
    const length = radius * 1.9;
    const width = heavy ? 0.20 : 0.14;
    const slope = heavy ? -0.66 : (flip ? 0.5 : -0.5);
    const curve = heavy ? 0.22 : 0.17;
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N * 2 - 1;
      const cx = t * length * 0.5;
      const cy = t * slope * length * 0.5 + curve * (1 - t * t);
      const dx = length * 0.5;
      const dy = slope * length * 0.5 - 2 * curve * t;
      const dl = Math.hypot(dx, dy) || 1;
      const nx = -dy / dl;
      const ny = dx / dl;
      const w = width * Math.pow(Math.max(0, 1 - Math.abs(t)), 0.48);
      positions.push(cx - nx * w, cy - ny * w, 0, cx + nx * w, cy + ny * w, 0);
      const v = t * 0.5 + 0.5;
      uvs.push(0, v, 1, v);
      if (i < N) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uTime: { value: 0 },
        uLife: { value: 1 },
        uHeavy: { value: heavy ? 1 : 0 },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uLife;
        uniform float uHeavy;
        varying vec2 vUv;
        void main() {
          float edge = smoothstep(0.0, 0.28, min(vUv.x, 1.0 - vUv.x));
          float taper = pow(max(0.0, sin(vUv.y * 3.14159)), 0.40);
          float streak = 0.62 + 0.38 * sin(vUv.y * 54.0 + uTime * 22.0 + vUv.x * 6.0);
          float grain = 0.78 + 0.22 * sin(vUv.y * 133.0 + vUv.x * 17.0 - uTime * 27.0);
          float a = uLife * (0.12 + edge * 0.42) * taper * streak * grain;
          a *= mix(0.62, 0.95, uHeavy);
          if (a < 0.006) discard;
          vec3 col = uColor * (0.62 + edge * 1.18 + uHeavy * 0.12);
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 8;
    const group = new THREE.Group();
    group.position.set(origin.x + Math.sin(yaw) * 0.96, height + 0.22, origin.z + Math.cos(yaw) * 0.96);
    if (camera) {
      group.quaternion.copy(camera.quaternion);
    } else {
      group.rotation.order = 'YXZ';
      group.rotation.y = yaw + Math.PI;
    }
    group.add(mesh);
    this.scene.add(group);
    this.slashes.push({ group, mesh, mat, life: duration, maxLife: duration, radius, heavy, flip });
  }

  sweepWave(origin, yaw, radius = 6, color = 0xffdcb0) {
    const geo = new THREE.RingGeometry(0.12, 1.0, 72, 1, -1.25, 2.5);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uProgress: { value: 0 }, uColor: { value: new THREE.Color(color) } },
      vertexShader: /* glsl */`
        varying vec2 vPos;
        void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */`
        uniform float uProgress;
        uniform vec3 uColor;
        varying vec2 vPos;
        void main() {
          float r = length(vPos);
          float a = atan(vPos.y, vPos.x);
          float head = -1.25 + uProgress * 2.5;
          float d = atan(sin(a - head), cos(a - head));
          float band = smoothstep(0.55, 0.0, abs(d)) * smoothstep(0.08, 0.7, r);
          float inner = smoothstep(0.0, 0.85, r);
          float aAlpha = band * inner * (1.0 - smoothstep(0.75, 1.0, uProgress));
          if (aAlpha < 0.01) discard;
          gl_FragColor = vec4(uColor * (1.0 + band * 1.4), aAlpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const group = new THREE.Group();
    group.position.set(origin.x, 1.2, origin.z);
    group.rotation.y = yaw - Math.PI / 2;
    group.add(mesh);
    this.scene.add(group);
    this.waves.push({ group, mat, life: 0.45, maxLife: 0.45, radius });
  }

  spell(center, duration = 2.3) {
    const group = new THREE.Group();
    group.position.set(center.x, 0.05, center.z);
    this.scene.add(group);
    const mats = [];
    const makeDisc = (scale, rot, opacity) => {
      const mat = new THREE.MeshBasicMaterial({ map: this.runeTex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xffd27c, toneMapped: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale), mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rot;
      group.add(m); mats.push(mat);
      return m;
    };
    const discA = makeDisc(3.8, 0, 0.72);
    const discB = makeDisc(2.6, 1.2, 0.48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc66d, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.15, 2.26, 64), ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring); mats.push(ringMat);
    const chains = [];
    for (let i = 0; i < 4; i++) {
      const cm = new THREE.MeshBasicMaterial({ color: 0xffc06a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const chain = new THREE.Mesh(new THREE.TorusGeometry(1.65 + i * 0.22, 0.013, 6, 48), cm);
      chain.rotation.x = Math.PI / 2;
      chain.rotation.y = i * 0.7;
      chain.position.y = 1.2 + i * 0.65;
      group.add(chain); chains.push(chain); mats.push(cm);
    }
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffb65d, transparent: true, opacity: 0.065, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 4.2, 24, 1, true), beamMat);
    beam.position.y = 2.1; beam.visible = false; group.add(beam); mats.push(beamMat);
    const matOpacity = mats.map((m) => m.opacity);
    const light = new THREE.PointLight(0xffb259, 22, 11, 2);
    light.position.set(center.x, 1.5, center.z);
    this.scene.add(light);
    this.spells.push({ group, life: duration, maxLife: duration, discA, discB, ring, chains, beam, mats, matOpacity, light });
  }

  crack(pos, scale = 3.4) {
    const mat = new THREE.MeshBasicMaterial({ map: this.crackTex, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xffb888, toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * TAU;
    m.position.set(pos.x, 0.035, pos.z);
    m.scale.setScalar(scale);
    this.scene.add(m);
    this.cracks.push({ mesh: m, mat, life: 3.6, maxLife: 3.6 });
  }

  update(dt, time) {
    this.time = time;
    this.sparkPool.update(dt);
    this.dustPool.update(dt);
    this.embersPool.update(dt);

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const t = 1 - r.life / r.maxLife;
      const s = 0.3 + (r.maxRadius - 0.3) * (1 - Math.pow(1 - t, 2.2));
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = (1 - t) * 0.8;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose(); r.mesh.material.dispose();
        this.rings.splice(i, 1);
      }
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      const t = 1 - f.life / f.maxLife;
      f.sprite.material.opacity = Math.pow(1 - t, 1.4);
      f.sprite.scale.setScalar(f.size * (0.55 + t * 0.9));
      if (f.life <= 0) {
        this.scene.remove(f.sprite); f.sprite.material.dispose();
        this.flashes.splice(i, 1);
      }
    }

    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i];
      w.life -= dt;
      w.progress = clamp(1 - w.life / w.maxLife, 0, 1);
      const m = w.mesh.material;
      m.uniforms.uTime.value = time;
      m.uniforms.uProgress.value = w.progress;
      m.uniforms.uAlpha.value = 0.4 + 0.45 * Math.min(1, w.progress * 3);
      if (w.kind === 'fan' && w.group) w.group.position.y = 0.045;
      if (w.life <= 0) {
        this.scene.remove(w.group || w.mesh);
        w.mesh.geometry.dispose(); w.mesh.material.dispose();
        this.warnings.splice(i, 1);
      }
    }

    for (let i = this.spells.length - 1; i >= 0; i--) {
      const s = this.spells[i];
      s.life -= dt;
      const t = 1 - s.life / s.maxLife;
      const fade = Math.min(1, s.life * 3) * Math.min(1, t * 8);
      s.discA.rotation.z += dt * 0.5;
      s.discB.rotation.z -= dt * 0.9;
      s.ring.scale.setScalar(1 + Math.sin(time * 5) * 0.04);
      s.chains.forEach((c, idx) => { c.rotation.z += dt * (0.3 + idx * 0.12); c.position.y = 1.2 + idx * 0.65 + Math.sin(time * 3 + idx) * 0.08; });
      s.mats.forEach((m, idx) => { m.opacity = s.matOpacity[idx] * fade; });
      s.light.intensity = 22 * fade;
      if (s.life <= 0) {
        this.scene.remove(s.group); this.scene.remove(s.light);
        s.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        this.spells.splice(i, 1);
      }
    }

    for (let i = this.cracks.length - 1; i >= 0; i--) {
      const c = this.cracks[i];
      c.life -= dt;
      c.mat.opacity = Math.min(1, c.life * 0.8) * 0.8;
      if (c.life <= 0) {
        this.scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mat.dispose();
        this.cracks.splice(i, 1);
      }
    }

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.life -= dt;
      const t = 1 - w.life / w.maxLife;
      w.mat.uniforms.uProgress.value = Math.min(1, t * 1.4);
      w.group.scale.setScalar(0.5 + w.radius * (0.45 + t * 0.55));
      w.mat.opacity = 1;
      if (w.life <= 0) {
        this.scene.remove(w.group); w.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        this.waves.splice(i, 1);
      }
    }

    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.life -= dt;
      const t = 1 - s.life / s.maxLife;
      const fade = Math.sin(Math.min(1, t) * Math.PI) * 0.8 + Math.min(1, t * 5) * 0.2;
      s.mat.uniforms.uTime.value = time;
      s.mat.uniforms.uLife.value = Math.max(0, Math.min(1, fade * (1 - t * 0.32)));
      s.mesh.rotation.z += (s.flip ? -1 : 1) * dt * 0.55;
      s.mesh.scale.setScalar(s.radius * (1 + t * 0.12));
      if (s.life <= 0) {
        this.scene.remove(s.group);
        s.mesh.geometry.dispose();
        s.mat.dispose();
        this.slashes.splice(i, 1);
      }
    }
  }

  clear() {
    for (const r of this.rings) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); }
    this.rings.length = 0;
    for (const f of this.flashes) { this.scene.remove(f.sprite); f.sprite.material.dispose(); }
    this.flashes.length = 0;
    for (const w of this.warnings) { this.scene.remove(w.group || w.mesh); w.mesh.geometry.dispose(); w.mesh.material.dispose(); }
    this.warnings.length = 0;
    for (const s of this.spells) { this.scene.remove(s.group); this.scene.remove(s.light); }
    this.spells.length = 0;
    for (const c of this.cracks) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mat.dispose(); }
    this.cracks.length = 0;
    for (const w of this.waves) { this.scene.remove(w.group); }
    this.waves.length = 0;
    for (const s of this.slashes) { this.scene.remove(s.group); s.mesh.geometry.dispose(); s.mat.dispose(); }
    this.slashes.length = 0;
    this.trailSamples.length = 0;
  }
}
