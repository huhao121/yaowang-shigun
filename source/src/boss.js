import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const dampAngle = (a, b, lambda, dt) => a + angleDelta(a, b) * (1 - Math.exp(-lambda * dt));
const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function seedRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 126);
  g.addColorStop(0, 'rgba(0,0,0,.48)');
  g.addColorStop(0.55, 'rgba(0,0,0,.2)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function eyeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,246,210,1)');
  g.addColorStop(0.18, 'rgba(255,186,98,.95)');
  g.addColorStop(0.5, 'rgba(255,92,32,.35)');
  g.addColorStop(1, 'rgba(255,50,10,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const SPEC = {
  slam: { telegraph: 0.98, attack: 0.84, recover: 1.14, radius: 3.5, damage: 26, poiseBreak: 0.5 },
  sweep: { telegraph: 0.84, attack: 0.78, recover: 0.96, radius: 6.1, half: 1.28, damage: 20, poiseBreak: 0.3 },
  charge: { telegraph: 0.80, attack: 0.98, recover: 1.12, radius: 3.0, damage: 30, poiseBreak: 0.4 },
};

export class Boss {
  constructor(scene, gltf) {
    this.scene = scene;
    this.rand = seedRandom(9123);
    this.root = new THREE.Group();
    this.root.position.set(0, 0, -4.4);
    this.yaw = 0;
    this.root.rotation.y = 0;
    scene.add(this.root);
    this.visual = new THREE.Group();
    this.root.add(this.visual);

    this.maxHp = 480;
    this.hp = this.maxHp;
    this.maxPoise = 100;
    this.poise = this.maxPoise;
    this.poiseDelay = 0;
    this.phase = 1;
    this.state = 'idle';
    this.stateTime = 0;
    this.stateDuration = 0;
    this.idleTimer = 1.25;
    this.cooldown = 1.4;
    this.attackType = '';
    this.attackSpec = null;
    this.hasHit = false;
    this.staggerTimer = 0;
    this.frozen = 0;
    this.flash = 0;
    this.auraTimer = 0;
    this.deadTimer = 0;
    this.attackCount = 0;
    this.startPos = new THREE.Vector3();
    this.landPoint = new THREE.Vector3();
    this.targetPoint = new THREE.Vector3();
    this.attackYaw = 0;
    this.warning = null;
    this.visualBaseY = 0;
    this.materials = [];
    this.baseEmissive = [];
    this.eyeL = null; this.eyeR = null;
    this.stepDist = 0;
    this.effectTimer = 0;

    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 4.65 / Math.max(0.001, size.y);
    model.scale.setScalar(scale);
    model.position.set(-(bounds.min.x + bounds.max.x) * 0.5, -bounds.min.y, -(bounds.min.z + bounds.max.z) * 0.5);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        m.metalness = Math.min(0.18, m.metalness ?? 0);
        m.roughness = Math.max(0.55, m.roughness ?? 0.9);
        this.materials.push(m);
        this.baseEmissive.push({ color: m.emissive ? m.emissive.clone() : null, intensity: m.emissiveIntensity ?? 1, opacity: m.opacity ?? 1 });
      }
    });
    this.model = model;
    this.visual.add(model);

    // Eyes: tiny authored lights so the static mesh has a focal point.
    const eyeTex = eyeTexture();
    const eyeMat = new THREE.SpriteMaterial({ map: eyeTex, color: 0xffc27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.eyeL = new THREE.Sprite(eyeMat);
    this.eyeR = new THREE.Sprite(eyeMat.clone());
    this.eyeL.position.set(-0.48, 3.02, 1.05);
    this.eyeR.position.set(0.48, 3.02, 1.05);
    this.eyeL.scale.setScalar(0.24);
    this.eyeR.scale.setScalar(0.24);
    this.visual.add(this.eyeL, this.eyeR);

    // Warm inner glow behind the stone, to keep the silhouette from going flat black.
    this.chestLight = new THREE.PointLight(0xff8844, 0, 7, 2);
    this.chestLight.position.set(0, 2.4, 0.8);
    this.visual.add(this.chestLight);

    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.45, 64),
      new THREE.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.set(0, 0.045, -4.4);
    scene.add(this.aura);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 6.4),
      new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x000000, transparent: true, opacity: 0.72, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(0, 0.018, -4.4);
    scene.add(this.shadow);

    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: eyeTex, color: 0xff7a3a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.glow.position.set(0, 2.1, 0);
    this.glow.scale.set(5.0, 5.0, 1);
    this.visual.add(this.glow);
  }

  reset() {
    this.hp = this.maxHp;
    this.poise = this.maxPoise;
    this.poiseDelay = 0;
    this.phase = 1;
    this.state = 'idle';
    this.stateTime = 0;
    this.stateDuration = 0;
    this.idleTimer = 1.25;
    this.cooldown = 0.9;
    this.attackType = '';
    this.attackSpec = null;
    this.hasHit = false;
    this.staggerTimer = 0;
    this.frozen = 0;
    this.flash = 0;
    this.deadTimer = 0;
    this.attackCount = 0;
    this.root.position.set(0, 0, -4.4);
    this.root.rotation.y = 0;
    this.yaw = 0;
    this.visual.position.set(0, 0, 0);
    this.visual.rotation.set(0, 0, 0);
    this.visual.scale.set(1, 1, 1);
    this.aura.material.opacity = 0;
    this.aura.scale.setScalar(1);
    this.eyeL.material.color.set(0xffc27a);
    this.eyeR.material.color.set(0xffc27a);
    this.chestLight.intensity = 0;
    this.glow.material.opacity = 0;
    this.materials.forEach((m, i) => {
      m.opacity = this.baseEmissive[i]?.opacity ?? 1;
      m.transparent = false;
      m.depthWrite = true;
      if (m.emissive && this.baseEmissive[i]?.color) m.emissive.copy(this.baseEmissive[i].color);
      if (this.baseEmissive[i]) m.emissiveIntensity = this.baseEmissive[i].intensity;
      m.needsUpdate = true;
    });
    this.model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.shadow.visible = true;
    this.clearWarning();
  }

  clearWarning() {
    if (this.warning) {
      this.warning.life = 0.001;
      this.warning = null;
    }
  }

  facePoint(p, lambda, dt) {
    const target = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z);
    this.yaw = dampAngle(this.yaw, target, lambda, dt);
    this.root.rotation.y = this.yaw;
  }

  chooseAttack(dist) {
    this.attackCount++;
    if (dist > 9.0) return 'charge';
    if (dist > 6.4) return this.attackCount % 2 ? 'charge' : 'slam';
    if (this.attackCount % 3 === 0) return 'sweep';
    if (this.attackCount % 3 === 2) return 'slam';
    return 'sweep';
  }

  startTelegraph(type, game) {
    this.attackType = type;
    const spec = SPEC[type];
    this.attackSpec = spec;
    this.state = 'telegraph';
    this.stateTime = 0;
    const speed = this.phase === 2 ? 0.82 : 1.0;
    this.stateDuration = spec.telegraph * speed;
    this.hasHit = false;
    const p = game.player;
    this.facePoint(p.root.position, 12, 0.04);
    this.attackYaw = this.yaw;
    this.targetPoint.copy(p.root.position);
    game.clampToArena(this.targetPoint, 10.8);
    this.startPos.copy(this.root.position);
    const isPhase2 = this.phase === 2;
    if (type === 'slam') {
      const radius = spec.radius * (isPhase2 ? 1.12 : 1);
      this.warning = game.vfx.warningCircle(this.targetPoint, radius, this.stateDuration, isPhase2 ? 0xff4a24 : 0xff7438);
      game.audio.roar(false);
    } else if (type === 'sweep') {
      const radius = spec.radius * (isPhase2 ? 1.12 : 1);
      const half = spec.half * (isPhase2 ? 1.08 : 1);
      this.warning = game.vfx.warningFan(this.root.position, this.attackYaw, radius, half, this.stateDuration, isPhase2 ? 0xff4a24 : 0xff7438);
      game.audio.roar(false);
    } else {
      const radius = spec.radius * (isPhase2 ? 1.15 : 1);
      this.warning = game.vfx.warningCircle(this.targetPoint, radius, this.stateDuration, isPhase2 ? 0xff4a24 : 0xff7438);
      game.audio.roar(true);
    }
  }

  startAttack(game) {
    this.state = 'attack';
    this.stateTime = 0;
    this.stateDuration = this.attackSpec.attack;
    this.hasHit = false;
    this.clearWarning();
    this.effectTimer = 0;
    if (this.attackType === 'slam' || this.attackType === 'charge') {
      this.startPos.copy(this.root.position);
      this.landPoint.copy(this.targetPoint);
    } else {
      this.attackYaw = this.yaw;
    }
  }

  finishAttack(game, damage) {
    this.state = 'recover';
    this.stateTime = 0;
    this.stateDuration = this.attackSpec.recover * (this.phase === 2 ? 0.78 : 1);
    this.cooldown = this.phase === 2 ? 0.62 : 0.95;
    this.visual.rotation.z = 0;
    this.visual.rotation.y = 0;
    this.visual.rotation.x = 0;
    game.audio.swing(true);
  }

  damagePlayer(game, amount, sourcePos) {
    const res = game.player.takeDamage(amount, sourcePos, game);
    if (res === 'parried') {
      this.onParried(game);
    } else if (res === 'dodged') {
      game.onBossMiss?.(this, this.attackType);
    }
    return res;
  }

  onParried(game) {
    this.state = 'stagger';
    this.stateTime = 0;
    this.stateDuration = this.phase === 2 ? 1.65 : 2.15;
    this.staggerTimer = this.stateDuration;
    this.poise = this.maxPoise;
    this.clearWarning();
    this.visual.rotation.set(-0.12, 0, -0.18);
    game.onBossParried(this);
  }

  takePlayerHit(damage, poiseDamage, attackType, contact, game) {
    if (this.state === 'dead' || this.state === 'phase') return { damage: 0, crit: false };
    const crit = this.state === 'stagger';
    const real = Math.round(damage * (crit ? 1.35 : 1));
    this.hp = Math.max(0, this.hp - real);
    this.poise = Math.max(0, this.poise - poiseDamage);
    this.poiseDelay = 1.4;
    this.flash = 0.085;
    game.vfx.sparks(contact, new THREE.Vector3(0, 1, 0), crit ? 28 : 16, crit ? [1.0, 0.82, 0.34] : [1.0, 0.68, 0.3], crit ? 1.4 : 1);
    game.vfx.hitFlash(contact, crit ? 0xffe0a0 : 0xffb46a, crit ? 1.05 : 0.72, 0.06);
    game.audio.hit(attackType === 'heavy', crit);

    if (this.hp <= 0) {
      this.die(game);
      return { damage: real, crit, killed: true };
    }
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.startPhase2(game);
      return { damage: real, crit, phase: true };
    }
    if (this.poise <= 0 && this.state !== 'stagger') {
      this.state = 'stagger';
      this.stateTime = 0;
      this.stateDuration = this.phase === 2 ? 1.5 : 1.95;
      this.staggerTimer = this.stateDuration;
      this.poise = this.maxPoise;
      this.clearWarning();
      game.onBossStagger(this);
    }
    return { damage: real, crit };
  }

  startPhase2(game) {
    this.phase = 2;
    this.phasePushed = false;
    this.state = 'phase';
    this.stateTime = 0;
    this.stateDuration = 2.15;
    this.clearWarning();
    this.poise = this.maxPoise;
    this.chestLight.intensity = 6;
    this.eyeL.material.color.set(0xff5b2c);
    this.eyeR.material.color.set(0xff5b2c);
    this.eyeL.scale.setScalar(0.5);
    this.eyeR.scale.setScalar(0.5);
    this.aura.material.opacity = 0.7;
    this.glow.material.opacity = 0.16;
    game.onBossPhase2(this);
  }

  die(game) {
    this.state = 'dead';
    this.stateTime = 0;
    this.deadTimer = 0;
    this.clearWarning();
    this.aura.material.opacity = 0;
    this.glow.material.opacity = 0;
    this.materials.forEach((m) => {
      m.transparent = true;
      m.depthWrite = false;
      m.needsUpdate = true;
    });
    game.onBossDeath(this);
  }

  update(dt, game) {
    this.stateTime += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.flash > 0 || this._wasFlash) this.applyFlash();
    if (this.state === 'dead') {
      this.updateDeath(dt);
      return;
    }

    if (this.frozen > 0) {
      this.frozen -= dt;
      this.visual.position.y = Math.sin(game.time * 2) * 0.03;
      this.aura.material.opacity = this.phase === 2 ? 0.9 : 0;
      this.aura.rotation.z += dt * 0.8;
      this.aura.position.x = this.root.position.x;
      this.aura.position.z = this.root.position.z;
      this.shadow.position.x = this.root.position.x;
      this.shadow.position.z = this.root.position.z;
      if (this.state === 'telegraph' || this.state === 'attack') {
        // freeze in place, but do not advance the attack timeline
        this.stateTime -= dt;
      }
      this.updateEyes(game);
      return;
    }

    this.poiseDelay = Math.max(0, this.poiseDelay - dt);
    if (this.poiseDelay <= 0 && this.state !== 'stagger' && this.state !== 'phase') {
      this.poise = Math.min(this.maxPoise, this.poise + dt * 7.5);
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    const p = game.player;

    if (this.state === 'idle' || this.state === 'approach') {
      this.facePoint(p.root.position, 5.2, dt);
      const dist = this.root.position.distanceTo(p.root.position);
      const desired = 3.35;
      let moving = false;
      if (dist > desired + 0.35) {
        const speed = this.phase === 2 ? 1.55 : 1.05;
        const dir = new THREE.Vector3().subVectors(p.root.position, this.root.position).setY(0).normalize();
        this.root.position.addScaledVector(dir, speed * dt);
        moving = true;
        this.stepDist += speed * dt;
        if (this.stepDist > 1.15) {
          this.stepDist = 0;
          game.onBossFootstep?.(this);
        }
      } else if (dist < desired - 0.55) {
        const dir = new THREE.Vector3().subVectors(this.root.position, p.root.position).setY(0).normalize();
        this.root.position.addScaledVector(dir, 0.55 * dt);
      }
      this.root.position.y = 0;
      const bob = Math.sin(game.time * (moving ? 5.2 : 1.4) + 0.3) * (moving ? 0.055 : 0.025);
      this.visual.position.y = bob;
      this.visual.rotation.z = Math.sin(game.time * (moving ? 4.6 : 0.8)) * (moving ? 0.03 : 0.012);
      if (this.cooldown <= 0) {
        this.idleTimer -= dt;
        if (this.idleTimer <= 0) {
          const type = this.chooseAttack(dist);
          this.startTelegraph(type, game);
        }
      }
    } else if (this.state === 'telegraph') {
      const windup = clamp(this.stateTime / this.stateDuration, 0, 1);
      this.visual.position.y = Math.sin(windup * Math.PI) * 0.11;
      this.visual.rotation.x = -0.06 - windup * 0.08;
      this.visual.rotation.z = Math.sin(windup * Math.PI) * 0.03;
      if (this.attackType === 'sweep') {
        this.visual.rotation.y = windup * 0.75;
      }
      if (this.stateTime >= this.stateDuration) {
        this.startAttack(game);
      }
    } else if (this.state === 'attack') {
      this.updateAttack(dt, game);
    } else if (this.state === 'recover') {
      const t = this.stateTime / this.stateDuration;
      this.visual.position.y = Math.sin(t * Math.PI) * 0.04;
      this.visual.rotation.x *= Math.pow(0.02, dt);
      this.visual.rotation.z *= Math.pow(0.05, dt);
      this.visual.rotation.y *= Math.pow(0.02, dt);
      if (this.stateTime >= this.stateDuration) {
        this.state = 'idle';
        this.stateTime = 0;
        this.idleTimer = this.phase === 2 ? 0.35 : 0.55;
        this.visual.rotation.set(0, 0, 0);
      }
    } else if (this.state === 'stagger') {
      const t = clamp(this.stateTime / this.stateDuration, 0, 1);
      this.visual.rotation.x = -0.12 - Math.sin(t * Math.PI) * 0.18;
      this.visual.rotation.z = -0.18 + Math.sin(game.time * 2.3) * 0.02;
      this.visual.position.y = Math.sin(t * Math.PI) * 0.06;
      this.aura.material.opacity = 0.35;
      this.aura.position.x = this.root.position.x;
      this.aura.position.z = this.root.position.z;
      if (this.stateTime >= this.stateDuration) {
        this.state = 'idle';
        this.stateTime = 0;
        this.visual.rotation.set(0, 0, 0);
        this.aura.material.opacity = this.phase === 2 ? 0.7 : 0;
        this.idleTimer = 0.55;
      }
    } else if (this.state === 'phase') {
      const t = clamp(this.stateTime / this.stateDuration, 0, 1);
      const roar = Math.sin(t * Math.PI);
      this.visual.position.y = roar * 0.22;
      this.visual.rotation.x = -roar * 0.12;
      this.visual.rotation.z = Math.sin(game.time * 18) * 0.01;
      this.aura.material.opacity = 0.4 + roar * 0.5;
      this.aura.rotation.z += dt * 2.2;
      this.aura.position.x = this.root.position.x;
      this.aura.position.z = this.root.position.z;
      this.aura.scale.setScalar(1 + roar * 0.25);
      this.chestLight.intensity = 3 + roar * 12;
      this.glow.material.opacity = 0.08 + roar * 0.3;
      if (!this.phasePushed && t > 0.35) {
        this.phasePushed = true;
        game.vfx.ring(this.root.position, 0xff5a2a, 8.5, 0.9, 0.4);
        game.vfx.sparks(new THREE.Vector3(this.root.position.x, 2.2, this.root.position.z), new THREE.Vector3(0, 1, 0), 46, [1, 0.45, 0.16], 1.6);
        game.onBossPhaseShockwave?.(this);
      }
      if (this.stateTime >= this.stateDuration) {
        this.state = 'idle';
        this.stateTime = 0;
        this.idleTimer = 0.3;
        this.cooldown = 0.4;
        this.aura.scale.setScalar(1);
        this.visual.rotation.set(0, 0, 0);
        this.visual.position.y = 0;
      }
    }

    // shadow and aura follow the ground position, even during leaps
    this.shadow.position.x = this.root.position.x;
    this.shadow.position.z = this.root.position.z;
    this.shadow.scale.setScalar(1 + Math.max(0, this.root.position.y) * 0.08);
    this.aura.position.x = this.root.position.x;
    this.aura.position.z = this.root.position.z;
    if (this.phase === 2 && this.state !== 'phase' && this.state !== 'stagger') {
      this.aura.material.opacity = 0.26 + 0.12 * (0.5 + 0.5 * Math.sin(game.time * 2.6));
      this.aura.rotation.z += dt * 0.55;
    } else if (this.phase === 1 && this.state !== 'stagger' && this.state !== 'phase') {
      this.aura.material.opacity = 0;
    }
    this.updateEyes(game);
  }

  updateEyes(game) {
    const heavy = this.phase === 2;
    const pulse = (heavy ? 0.82 : 0.34) + Math.sin(game.time * 3.4) * (heavy ? 0.12 : 0.05) + Math.sin(game.time * 8.1) * 0.025;
    this.eyeL.material.opacity = pulse;
    this.eyeR.material.opacity = pulse;
    this.eyeL.scale.setScalar(heavy ? 0.5 : 0.24);
    this.eyeR.scale.setScalar(heavy ? 0.5 : 0.24);
    if (heavy) this.chestLight.intensity = 7 + Math.sin(game.time * 3.2) * 2;
  }

  updateAttack(dt, game) {
    const t = this.stateTime;
    const dur = this.stateDuration;
    const p = game.player;
    const isPhase2 = this.phase === 2;
    if (this.attackType === 'slam') {
      const impact = 0.31;
      if (t < impact) {
        const u = clamp(t / impact, 0, 1);
        const e = easeInOut(u);
        this.root.position.lerpVectors(this.startPos, this.landPoint, e);
        this.root.position.y = Math.sin(u * Math.PI) * (isPhase2 ? 1.9 : 1.35);
        this.visual.rotation.x = -0.1 - u * 0.12;
        this.visual.rotation.z = Math.sin(u * Math.PI) * 0.05;
        if (u > 0.85) this.root.position.y = Math.max(0, this.root.position.y);
      } else {
        if (this.root.position.y > 0.02) this.root.position.y *= Math.pow(0.001, dt) ;
        this.root.position.y = 0;
        this.visual.rotation.x = 0.18;
        if (!this.hasHit) {
          this.hasHit = true;
          this.slamImpact(game);
        }
      }
      if (this.stateTime >= dur) {
        this.finishAttack(game, 26);
      }
    } else if (this.attackType === 'sweep') {
      const wind = clamp(t / 0.24, 0, 1);
      const swing = clamp((t - 0.16) / 0.38, 0, 1);
      this.visual.rotation.y = 0.75 - swing * 2.15;
      this.visual.rotation.z = Math.sin(wind * Math.PI) * 0.05 - 0.03;
      this.visual.position.y = Math.sin(wind * Math.PI) * 0.07;
      this.effectTimer += dt;
      if (this.effectTimer > 0.08 && t > 0.12 && t < 0.55 && !this.hasHit) {
        this.effectTimer = 0;
        game.vfx.dust(new THREE.Vector3(this.root.position.x, 0.1, this.root.position.z), 2, [0.3, 0.33, 0.31], 2.2, 0.65, 0.5);
      }
      if (t >= 0.27 && !this.hasHit) {
        this.hasHit = true;
        this.sweepImpact(game);
      }
      if (this.stateTime >= dur) {
        this.visual.rotation.y = 0;
        this.finishAttack(game, 20);
      }
    } else if (this.attackType === 'charge') {
      const impact = isPhase2 ? 0.46 : 0.52;
      if (t < impact) {
        const u = clamp(t / impact, 0, 1);
        this.root.position.lerpVectors(this.startPos, this.landPoint, u * u * (3 - 2 * u));
        this.root.position.y = isPhase2 ? Math.sin(u * Math.PI) * 2.6 : Math.sin(u * Math.PI) * 0.35;
        this.visual.rotation.x = 0.08 + u * 0.15;
        if (isPhase2 && u < 0.95) {
          this.effectTimer += dt;
          if (this.effectTimer > 0.06) {
            this.effectTimer = 0;
            game.vfx.embersPool.spawn({
              x: this.root.position.x + (Math.random() - 0.5) * 1.2, y: this.root.position.y + 0.8 + Math.random() * 1.8, z: this.root.position.z + (Math.random() - 0.5) * 1.2,
              vx: (Math.random() - 0.5) * 0.8, vy: Math.random() * 1.2, vz: (Math.random() - 0.5) * 0.8,
              life: 0.7, size: 0.12, color: [1, 0.47, 0.15], gravity: -0.2, drag: 1.2, grow: 1.3, alpha: 0.7,
            });
          }
        }
      } else {
        this.root.position.y = 0;
        if (!this.hasHit) {
          this.hasHit = true;
          this.chargeImpact(game);
        }
      }
      if (this.stateTime >= dur) {
        this.finishAttack(game, 30);
      }
    }
    // keep facing the player when recovering from a leap
    if (t > 0.5) this.facePoint(p.root.position, 2.2, dt);
  }

  slamImpact(game) {
    const radius = this.attackSpec.radius * (this.phase === 2 ? 1.12 : 1);
    const ground = new THREE.Vector3(this.root.position.x, 0.08, this.root.position.z);
    game.vfx.ring(ground, 0xffb06a, radius * 1.35, 0.7, 0.5);
    game.vfx.crack(ground, radius * 1.15);
    game.vfx.dust(ground, 28, [0.30, 0.32, 0.29], 2.4, 1.3, 1.1);
    game.vfx.hitFlash(ground.clone().setY(0.9), 0xffc57a, 1.6, 0.12);
    game.vfx.sparks(ground.clone().setY(0.35), new THREE.Vector3(0, 1, 0), 22, [1, 0.6, 0.24], 1.2);
    game.audio.slam();
    game.addTrauma(0.72);
    game.cameraKick(0.18);
    game.shakeFov(4.5);
    if (game.player.root.position.distanceTo(this.landPoint.clone().setY(game.player.root.position.y)) < radius) {
      this.damagePlayer(game, this.attackSpec.damage * (this.phase === 2 ? 1.28 : 1), this.root.position);
    }
    if (this.phase === 2) game.vfx.ring(ground, 0xff4a20, radius * 2.0, 0.9, 0.3);
  }

  sweepImpact(game) {
    const radius = this.attackSpec.radius * (this.phase === 2 ? 1.12 : 1);
    const half = this.attackSpec.half * (this.phase === 2 ? 1.08 : 1);
    const origin = new THREE.Vector3(this.root.position.x, 0.9, this.root.position.z);
    game.vfx.sweepWave(origin, this.attackYaw, radius, this.phase === 2 ? 0xffa05a : 0xffd8a0);
    game.vfx.dust(new THREE.Vector3(this.root.position.x, 0.2, this.root.position.z), 16, [0.32, 0.34, 0.31], 2.7, 0.9, 0.8);
    game.vfx.sparks(new THREE.Vector3(this.root.position.x, 1.7, this.root.position.z), new THREE.Vector3(Math.sin(this.attackYaw), 0.2, Math.cos(this.attackYaw)), 12, [1, 0.6, 0.25], 1.3);
    game.audio.swing(true);
    game.addTrauma(0.34);
    game.shakeFov(2.2);
    const toPlayer = new THREE.Vector3().subVectors(game.player.root.position, this.root.position).setY(0);
    const dist = toPlayer.length();
    const ang = Math.atan2(toPlayer.x, toPlayer.z);
    const diff = Math.abs(angleDelta(this.attackYaw, ang));
    if (dist < radius && diff < half) {
      this.damagePlayer(game, this.attackSpec.damage * (this.phase === 2 ? 1.3 : 1), this.root.position);
    }
  }

  chargeImpact(game) {
    const radius = this.attackSpec.radius * (this.phase === 2 ? 1.15 : 1);
    const ground = new THREE.Vector3(this.root.position.x, 0.08, this.root.position.z);
    game.vfx.ring(ground, 0xffb06a, radius * 1.5, 0.65, 0.4);
    game.vfx.crack(ground, radius * 1.0);
    game.vfx.dust(ground, 25, [0.30, 0.32, 0.29], 2.2, 1.25, 1.0);
    game.vfx.hitFlash(ground.clone().setY(0.8), 0xffbf74, 1.35, 0.1);
    game.audio.slam();
    game.addTrauma(0.6);
    game.cameraKick(0.15);
    game.shakeFov(3.8);
    if (game.player.root.position.distanceTo(this.landPoint.clone().setY(game.player.root.position.y)) < radius) {
      this.damagePlayer(game, this.attackSpec.damage * (this.phase === 2 ? 1.3 : 1), this.root.position);
    }
  }

  applyFlash() {
    this._wasFlash = this.flash > 0;
    const f = clamp(this.flash / 0.085, 0, 1);
    this.materials.forEach((m, i) => {
      if (!m.emissive) return;
      const base = this.baseEmissive[i];
      if (!base) return;
      if (f > 0) {
        m.emissive.setRGB(base.color.r + f * 0.11, base.color.g + f * 0.11, base.color.b + f * 0.11);
        m.emissiveIntensity = base.intensity + f * 0.08;
      } else {
        m.emissive.copy(base.color);
        m.emissiveIntensity = base.intensity;
      }
    });
  }

  updateDeath(dt) {
    this.deadTimer += dt;
    const t = clamp(this.deadTimer / 2.4, 0, 1);
    this.visual.rotation.z = -t * 0.55;
    this.visual.rotation.x = 0.2 + t * 0.45;
    this.visual.position.y = -t * t * 1.6;
    const fade = clamp(1 - t, 0, 1);
    this.materials.forEach((m) => { m.opacity = fade; });
    if (t > 0.35) {
      this.model.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    }
    this.aura.material.opacity = 0;
    this.shadow.material.opacity = (1 - t) * 0.72;
    this.eyeL.material.opacity = 0;
    this.eyeR.material.opacity = 0;
    this.chestLight.intensity = 0;
    this.glow.material.opacity = 0;
    if (this.deadTimer > 2.6) {
      this.model.visible = false;
      this.shadow.visible = false;
    }
  }
}
