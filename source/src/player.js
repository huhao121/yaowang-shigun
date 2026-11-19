import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const dampAngle = (a, b, lambda, dt) => a + angleDelta(a, b) * (1 - Math.exp(-lambda * dt));

const ATTACKS = {
  light1: { duration: 0.43, active: [0.10, 0.18], damage: 13, poise: 11, lunge: 1.45, stamina: 8, timeScale: 3.6 },
  light2: { duration: 0.40, active: [0.09, 0.17], damage: 16, poise: 12, lunge: 1.35, stamina: 9, timeScale: 3.85 },
  light3: { duration: 0.52, active: [0.14, 0.24], damage: 23, poise: 19, lunge: 2.1, stamina: 12, timeScale: 3.1 },
  heavy: { duration: 0.78, active: [0.32, 0.44], damage: 34, poise: 32, lunge: 2.6, stamina: 19, timeScale: 2.0 },
};

function softShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,.45)');
  g.addColorStop(0.55, 'rgba(0,0,0,.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeStaff() {
  const group = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0x7b2015, metalness: 0.55, roughness: 0.36 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a044, metalness: 0.82, roughness: 0.25 });

  // A straight, double-ended staff held off-centre, with gold sleeves on both ends.
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.05, 16), red);
  shaft.position.y = 0.45;
  shaft.castShadow = true;
  group.add(shaft);
  for (const y of [-0.52, 1.42]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.22, 16), gold);
    sleeve.position.y = y;
    sleeve.castShadow = true;
    group.add(sleeve);
    for (const offset of [-0.08, 0.08]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.053, 0.009, 6, 16), gold);
      band.rotation.x = Math.PI / 2;
      band.position.y = y + offset;
      group.add(band);
    }
  }
  return group;
}

export class Player {
  constructor(scene, gltf) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.position.set(0, 0, 4.2);
    this.yaw = Math.PI;
    this.root.rotation.y = this.yaw;
    scene.add(this.root);
    this.tilt = new THREE.Group();
    this.root.add(this.tilt);

    this.maxHp = 120;
    this.hp = this.maxHp;
    this.maxStamina = 100;
    this.stamina = this.maxStamina;
    this.maxFlasks = 3;
    this.flasks = 3;
    this.spellCd = 0;
    this.spellMaxCd = 12;
    this.state = 'idle';
    this.stateTime = 0;
    this.stateDuration = 0;
    this.comboIndex = 0;
    this.comboGrace = 0;
    this.attackType = '';
    this.attackData = ATTACKS.light1;
    this.hitDone = false;
    this.lungeDir = new THREE.Vector3();
    this.lungeLeft = 0;
    this.invuln = 0;
    this.hurtInvuln = 0;
    this.flash = 0;
    this.deadTimer = 0;
    this.parrySuccess = 0;
    this.buffer = null;
    this.staminaDelay = 0;
    this.exhausted = false;
    this.footDist = 0;
    this.stepSide = 0;
    this.ghostTimer = 0;
    this.healTimer = 0;
    this.spellCastTimer = 0;
    this.wasLocked = false;
    this.weaponActive = false;
    this.trailBase = new THREE.Vector3();
    this.trailTip = new THREE.Vector3();
    this._base = new THREE.Vector3();
    this._tip = new THREE.Vector3();
    this.materials = [];
    this.baseEmissive = [];
    this.actions = {};
    this.currentAction = null;
    this.currentActionName = '';

    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 1.92 / Math.max(0.001, size.y);
    model.scale.setScalar(scale);
    bounds.setFromObject(model);
    model.position.set(-(bounds.min.x + bounds.max.x) * 0.5, -bounds.min.y, -(bounds.min.z + bounds.max.z) * 0.5);
    // Recompute after centring, because the source was pre-rotated on some exports.
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        m.roughness = Math.max(0.45, m.roughness ?? 0.8);
        m.metalness = Math.min(0.25, m.metalness ?? 0);
        this.materials.push(m);
        this.baseEmissive.push({ color: m.emissive ? m.emissive.clone() : null, intensity: m.emissiveIntensity ?? 1 });
      }
    });
    this.model = model;
    this.tilt.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    const clips = gltf.animations;
    const names = ['idle', 'run', 'roll', 'attack', 'spell'];
    clips.forEach((clip, i) => {
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      if (i === 0 || i === 1) action.setLoop(THREE.LoopRepeat, Infinity);
      else action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = i !== 0 && i !== 1;
      this.actions[names[i] || `clip${i}`] = action;
    });
    this.playAction('idle', 0);

    // Attach the weapon to the right hand bone if present.
    let handBone = null;
    model.traverse((o) => {
      if (o.isBone && /RightHand/i.test(o.name)) handBone = o;
    });
    this.staff = makeStaff();
    this.staff.position.set(0, 0.02, 0);
    this.staff.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.5);
    if (handBone) {
      this.handBone = handBone;
      handBone.add(this.staff);
    } else {
      this.handBone = null;
      this.staff.position.set(0.55, 1.0, 0.15);
      this.model.add(this.staff);
    }
    // A tiny point of ki at the grip, so the weapon reads at distance.
    const guardGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: (() => {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d');
        const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        rg.addColorStop(0, 'rgba(255,236,190,1)'); rg.addColorStop(1, 'rgba(255,170,80,0)');
        g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
      })(),
      color: 0xffc98a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    guardGlow.scale.setScalar(0.24);
    guardGlow.position.set(0, 0.02, 0);
    this.staff.add(guardGlow);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 24),
      new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, opacity: 0.6, depthWrite: false, color: 0x000000 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    this.root.add(shadow);
    this.shadow = shadow;
    this.root.updateMatrixWorld(true);
  }

  reset() {
    this.root.position.set(0, 0, 4.2);
    this.yaw = Math.PI;
    this.root.rotation.y = this.yaw;
    this.tilt.rotation.set(0, 0, 0);
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.flasks = this.maxFlasks;
    this.spellCd = 0;
    this.state = 'idle';
    this.stateTime = 0;
    this.comboIndex = 0;
    this.attackType = '';
    this.hitDone = false;
    this.invuln = 0;
    this.hurtInvuln = 0;
    this.flash = 0;
    this.deadTimer = 0;
    this.buffer = null;
    this.staminaDelay = 0;
    this.exhausted = false;
    this.footDist = 0;
    this.parrySuccess = 0;
    this.healTimer = 0;
    this.spellCastTimer = 0;
    this.weaponActive = false;
    this.playAction('idle', 0.1, true);
    this.materials.forEach((m, i) => { if (m.emissive && this.baseEmissive[i]?.color) m.emissive.copy(this.baseEmissive[i].color); if (this.baseEmissive[i]) m.emissiveIntensity = this.baseEmissive[i].intensity; });
  }

  playAction(name, fade = 0.12, force = false, timeScale = 1) {
    const next = this.actions[name];
    if (!next) return;
    if (!force && this.currentActionName === name && next.isRunning()) return;
    const prev = this.currentAction;
    next.reset();
    next.setEffectiveTimeScale(timeScale);
    next.setEffectiveWeight(1);
    next.enabled = true;
    next.paused = false;
    next.play();
    if (prev && prev !== next) prev.crossFadeTo(next, fade, false);
    else next.fadeIn(fade);
    this.currentAction = next;
    this.currentActionName = name;
  }

  holdPose(name, time, fade = 0.08) {
    const action = this.actions[name];
    if (!action) return;
    const prev = this.currentAction;
    action.reset();
    action.setEffectiveWeight(1);
    action.enabled = true;
    action.play();
    action.paused = true;
    action.time = time;
    if (prev && prev !== action) prev.crossFadeTo(action, fade, false);
    this.currentAction = action;
    this.currentActionName = name + ':pose';
  }

  canAct() {
    return this.state === 'idle' || this.state === 'move' || this.state === 'sprint';
  }

  canDodge() {
    return !['dodge', 'hurt', 'dead'].includes(this.state);
  }

  requestAction(action, heavy = false) {
    if (this.state === 'dead') return false;
    if (action === 'dodge') {
      if (this.canDodge() && this.stamina > 5) {
        this.buffer = null;
        this.startDodge();
        return true;
      }
      this.buffer = { action, heavy, ttl: 0.42 };
      return false;
    }
    if (this.canAct()) {
      if (this.stamina <= 0 && action !== 'parry') {
        return false;
      }
      if (action === 'light' || action === 'heavy') {
        if (this.stamina < (action === 'heavy' ? 8 : 4)) return false;
        this.startAttack(action === 'heavy');
        return true;
      }
      if (action === 'parry') { this.startParry(); return true; }
      if (action === 'heal') { this.startHeal(); return true; }
      if (action === 'spell') { this.startSpell(); return true; }
    }
    this.buffer = { action, heavy, ttl: 0.42 };
    return false;
  }

  clearBuffer() { this.buffer = null; }

  startAttack(heavy) {
    const chain = !heavy && (this.comboGrace > 0 || this.state === 'attack') ? (this.comboIndex % 3) + 1 : 1;
    this.comboIndex = heavy ? 0 : chain;
    const key = heavy ? 'heavy' : `light${chain}`;
    this.attackData = ATTACKS[key];
    this.attackType = key;
    this.state = heavy ? 'heavy' : 'attack';
    this.stateTime = 0;
    this.stateDuration = this.attackData.duration;
    this.hitDone = false;
    this.swingFxDone = false;
    const targetDist = Number.isFinite(this.attackTargetDist) ? this.attackTargetDist : 99;
    this.lungeLeft = Math.min(this.attackData.lunge, Math.max(0, targetDist - 2.35));
    this.lungeDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.comboGrace = 1.0;
    this.stamina = Math.max(0, this.stamina - this.attackData.stamina);
    this.staminaDelay = 0.65;
    if (this.stamina <= 0) this.exhausted = true;
    this.playAction('attack', 0.06, true, this.attackData.timeScale);
    this.ghostTimer = 0;
  }

  startDodge() {
    const dir = this._dodgeDir || new THREE.Vector3();
    this._dodgeDir = dir;
    this.state = 'dodge';
    this.stateTime = 0;
    this.stateDuration = 0.56;
    this.dodgeDir = this.dodgeDir || new THREE.Vector3();
    // direction is assigned by the game just before this call if available
    if (this.pendingDodgeDir && this.pendingDodgeDir.lengthSq() > 0.01) this.dodgeDir.copy(this.pendingDodgeDir).setY(0).normalize();
    else this.dodgeDir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.pendingDodgeDir = null;
    this.stamina = Math.max(0, this.stamina - 22);
    this.staminaDelay = 0.7;
    this.invuln = Math.max(this.invuln, 0.4);
    this.playAction('roll', 0.05, true, 2.45);
    this.ghostTimer = 0;
  }

  startParry() {
    this.state = 'parry';
    this.stateTime = 0;
    this.stateDuration = 0.68;
    this.parryWindow = 0.26;
    this.stamina = Math.max(0, this.stamina - 14);
    this.staminaDelay = 0.8;
    this.holdPose('attack', 0.12, 0.07);
  }

  startHeal() {
    if (this.flasks <= 0) return false;
    this.state = 'heal';
    this.stateTime = 0;
    this.stateDuration = 1.02;
    this.healApplied = false;
    this.flasks--;
    this.playAction('spell', 0.12, true, 1.65);
    return true;
  }

  startSpell() {
    if (this.spellCd > 0) return false;
    this.state = 'spell';
    this.stateTime = 0;
    this.stateDuration = 0.82;
    this.spellCast = false;
    this.spellCd = this.spellMaxCd;
    this.stamina = Math.max(0, this.stamina - 16);
    this.staminaDelay = 0.8;
    this.playAction('spell', 0.1, true, 1.2);
    return true;
  }

  onParrySuccess() {
    this.parrySuccess = 0.35;
    this.stamina = Math.min(this.maxStamina, this.stamina + 18);
    this.invuln = Math.max(this.invuln, 0.28);
    this.state = 'idle';
    this.stateTime = 0;
    this.playAction('idle', 0.05, true);
  }

  takeDamage(amount, fromPos, game) {
    if (this.state === 'dead') return 'dead';
    if (game?.god) {
      this.flash = 0.08;
      return 'dodged';
    }
    if (this.invuln > 0) return 'dodged';
    if (this.state === 'parry' && this.stateTime <= this.parryWindow) {
      const toAttacker = new THREE.Vector3().subVectors(fromPos, this.root.position).setY(0).normalize();
      const facing = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      if (toAttacker.dot(facing) > -0.2) {
        this.onParrySuccess();
        return 'parried';
      }
    }
    const wasHealing = this.state === 'heal';
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = 0.82;
    this.hurtInvuln = 0.6;
    this.flash = 0.13;
    this.state = 'hurt';
    this.stateTime = 0;
    this.stateDuration = 0.5;
    this.buffer = null;
    this.playAction('idle', 0.04, true);
    const knock = new THREE.Vector3().subVectors(this.root.position, fromPos).setY(0);
    if (knock.lengthSq() < 0.001) knock.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(-1);
    knock.normalize();
    this.knockDir = knock;
    this.knockTime = 0.18;
    game?.onPlayerHurt?.(amount, wasHealing);
    if (this.hp <= 0) {
      this.state = 'dead';
      this.stateTime = 0;
      this.deadTimer = 0;
      this.buffer = null;
      game?.onPlayerDeath?.();
    }
    return this.hp <= 0 ? 'dead' : 'hit';
  }

  update(dt, input, game) {
    // real-time timers
    this.flash = Math.max(0, this.flash - dt);
    this.parrySuccess = Math.max(0, this.parrySuccess - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtInvuln = Math.max(0, this.hurtInvuln - dt);
    this.spellCd = Math.max(0, this.spellCd - dt);
    this.comboGrace = Math.max(0, this.comboGrace - dt);
    this.staminaDelay = Math.max(0, this.staminaDelay - dt);
    this.stateTime += dt;
    if (this.flash > 0 || this._wasFlash) this.applyFlash();
    if (this.buffer) {
      this.buffer.ttl -= dt;
      if (this.buffer.ttl <= 0) this.buffer = null;
    }
    if (this.state === 'dead') {
      this.deadTimer += dt;
      this.tilt.rotation.x = damp(this.tilt.rotation.x, -1.35, 4, dt);
      this.tilt.position.y = Math.max(-0.55, -this.deadTimer * 0.18);
      this.mixer.update(dt * 0.3);
      this.root.updateMatrixWorld(true);
      return;
    }

    if (this.state === 'hurt') {
      if (this.knockTime > 0) {
        this.knockTime -= dt;
        this.root.position.addScaledVector(this.knockDir, dt * 5.5);
      }
      this.tilt.rotation.z = Math.sin(this.stateTime * 35) * 0.08 * Math.max(0, 1 - this.stateTime / 0.4);
      if (this.stateTime >= this.stateDuration) {
        this.state = 'idle'; this.stateTime = 0; this.stateDuration = 0;
        this.tilt.rotation.z = 0;
        this.playAction('idle', 0.14);
      }
      this.mixer.update(dt);
      this.root.updateMatrixWorld(true);
      this.updateStaffTrail(false, dt, game);
      return;
    }

    if (this.state === 'dodge') {
      const t = clamp(this.stateTime / this.stateDuration, 0, 1);
      const speed = 10.5 * (1 - Math.pow(t, 1.8)) + 2.0;
      this.root.position.addScaledVector(this.dodgeDir, speed * dt);
      this.yaw = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
      this.root.rotation.y = this.yaw;
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this.ghostTimer = 0.055;
        game?.onPlayerDodgeGhost?.(this.root.position, this.yaw, t);
      }
      if (this.stateTime >= this.stateDuration - 0.14 && this.buffer?.action === 'light') {
        // buffer will fire on exit
      }
      if (this.stateTime >= this.stateDuration) {
        this.state = 'idle'; this.stateTime = 0;
        this.playAction('idle', 0.13);
      }
      this.mixer.update(dt);
      this.root.updateMatrixWorld(true);
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * 8);
      this.clampToArena(game);
      this.updateStaffTrail(false, dt, game);
      this.tryBuffered(game);
      return;
    }

    if (this.state === 'attack' || this.state === 'heavy') {
      const t = this.stateTime;
      // lunge toward target, ending just inside staff range
      if (this.lungeLeft > 0 && t < this.attackData.active[1] + 0.06) {
        const step = Math.min(this.lungeLeft, dt * 6.6);
        this.root.position.addScaledVector(this.lungeDir, step);
        this.lungeLeft -= step;
      }
      this.yaw = dampAngle(this.yaw, this.desiredYaw ?? this.yaw, 18, dt);
      this.root.rotation.y = this.yaw;
      if (!this.hitDone && t >= this.attackData.active[0] && t <= this.attackData.active[1]) {
        this.hitDone = true;
        game?.resolvePlayerAttack?.(this, this.attackData, this.attackType);
      }
      if (!this.swingFxDone && t >= this.attackData.active[0] - 0.025) {
        this.swingFxDone = true;
        game?.onPlayerSwing?.(this, this.attackType);
      }
      const trailActive = t > this.attackData.active[0] - 0.04 && t < this.attackData.active[1] + 0.10;
      if (this.stateTime >= this.stateDuration) {
        this.state = 'idle'; this.stateTime = 0; this.stateDuration = 0;
        this.playAction('idle', 0.12);
        if (!this.buffer) this.comboIndex = 0;
      }
      this.mixer.update(dt);
      this.clampToArena(game);
      this.root.updateMatrixWorld(true);
      this.updateStaffTrail(trailActive, dt, game);
      this.tryBuffered(game);
      return;
    }

    if (this.state === 'parry') {
      if (this.stateTime >= this.stateDuration) {
        this.state = 'idle'; this.stateTime = 0;
        this.playAction('idle', 0.12);
      }
      this.mixer.update(dt * 0.35);
      this.root.updateMatrixWorld(true);
      this.updateStaffTrail(false, dt, game);
      this.tryBuffered(game);
      return;
    }

    if (this.state === 'heal') {
      if (!this.healApplied && this.stateTime >= 0.46) {
        this.healApplied = true;
        this.hp = Math.min(this.maxHp, this.hp + 46);
        game?.onPlayerHeal?.(this);
      }
      if (this.stateTime >= this.stateDuration) {
        this.state = 'idle'; this.stateTime = 0;
        this.playAction('idle', 0.1);
      }
      this.mixer.update(dt);
      this.root.updateMatrixWorld(true);
      this.updateStaffTrail(false, dt, game);
      return;
    }

    if (this.state === 'spell') {
      if (!this.spellCast && this.stateTime >= 0.34) {
        this.spellCast = true;
        game?.onPlayerSpell?.(this);
      }
      if (this.stateTime >= this.stateDuration) {
        this.state = 'idle'; this.stateTime = 0;
        this.playAction('idle', 0.1);
      }
      this.mixer.update(dt);
      this.root.updateMatrixWorld(true);
      this.updateStaffTrail(false, dt, game);
      return;
    }

    // locomotion
    const move = input.move;
    const moving = move.lengthSq() > 0.001;
    const wantSprint = input.sprint && moving && this.stamina > 0 && !this.exhausted && this.state !== 'heal';
    if (this.state === 'sprint' && (!wantSprint || this.stamina <= 0)) this.state = 'idle';
    if ((this.state === 'idle' || this.state === 'move') && wantSprint) this.state = 'sprint';
    if (this.state === 'sprint' && !wantSprint) this.state = 'idle';

    const sprinting = this.state === 'sprint';
    const speed = sprinting ? 6.4 : 3.65;
    if (moving) {
      const dir = move.clone().normalize();
      this.root.position.addScaledVector(dir, speed * dt);
      if (!input.locked) {
        this.yaw = dampAngle(this.yaw, Math.atan2(dir.x, dir.z), 12, dt);
        this.root.rotation.y = this.yaw;
      } else {
        const bossPos = game?.boss?.root?.position;
        if (bossPos) this.yaw = dampAngle(this.yaw, Math.atan2(bossPos.x - this.root.position.x, bossPos.z - this.root.position.z), 10, dt);
        this.root.rotation.y = this.yaw;
      }
      this.footDist += speed * dt;
      const stepEvery = sprinting ? 1.75 : 2.2;
      if (this.footDist >= stepEvery) {
        this.footDist = 0;
        this.stepSide = 1 - this.stepSide;
        game?.onPlayerFootstep?.(this, sprinting);
      }
      if (this.state === 'idle') this.state = 'move';
    } else {
      this.state = 'idle';
      this.footDist = 0;
    }
    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - dt * 16);
      this.staminaDelay = 0.6;
      if (this.stamina <= 0) { this.exhausted = true; this.state = 'idle'; }
    }
    if (this.exhausted && this.stamina > 24) this.exhausted = false;
    if (this.staminaDelay <= 0 && this.state !== 'sprint') this.stamina = Math.min(this.maxStamina, this.stamina + dt * 21);

    this.playAction(sprinting ? 'run' : moving ? 'run' : 'idle', 0.13, false, sprinting ? 1.22 : 0.95);
    this.mixer.update(dt);
    this.clampToArena(game);
    this.root.updateMatrixWorld(true);
    this.updateStaffTrail(false, dt, game);
    this.tryBuffered(game);
  }

  tryBuffered(game) {
    if (!this.buffer) return;
    const b = this.buffer;
    if (this.canAct()) {
      this.buffer = null;
      if (b.action === 'light') this.requestAction('light');
      else if (b.action === 'heavy') this.requestAction('heavy');
      else if (b.action === 'parry') this.requestAction('parry');
      else if (b.action === 'heal') this.requestAction('heal');
      else if (b.action === 'spell') this.requestAction('spell');
      else if (b.action === 'dodge') this.requestAction('dodge');
    }
  }

  updateStaffTrail(active, dt, game) {
    this._base.set(0, -0.50, 0);
    this._tip.set(0, 1.50, 0);
    this.staff.localToWorld(this._base);
    this.staff.localToWorld(this._tip);
    this.trailBase.copy(this._base);
    this.trailTip.copy(this._tip);
    this.weaponActive = active;
    game?.vfx?.updateBladeTrail(active, this._base, this._tip, dt, this.attackType === 'heavy' ? 0xffbd72 : 0xffe3a6);
  }

  applyFlash() {
    const f = clamp(this.flash / 0.13, 0, 1);
    this._wasFlash = f > 0;
    this.materials.forEach((m, i) => {
      if (!m.emissive) return;
      const base = this.baseEmissive[i];
      if (!base || !base.color) return;
      if (f > 0) {
        m.emissive.setRGB(base.color.r + f * 0.10, base.color.g + f * 0.10, base.color.b + f * 0.10);
        m.emissiveIntensity = base.intensity + f * 0.07;
      } else {
        m.emissive.copy(base.color);
        m.emissiveIntensity = base.intensity;
      }
    });
  }

  clampToArena(game) {
    if (!game?.clampToArena) return;
    game.clampToArena(this.root.position, 11.2);
  }

  getBladeWorld(outBase, outTip) {
    outBase.copy(this.trailBase);
    outTip.copy(this.trailTip);
  }
}
