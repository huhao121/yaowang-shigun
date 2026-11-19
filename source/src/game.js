import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { World } from './world.js';
import { VFX } from './vfx.js';
import { Post } from './post.js';
import { Player } from './player.js';
import { Boss } from './boss.js';
import { AudioEngine } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const dampAngle = (a, b, lambda, dt) => a + angleDelta(a, b) * (1 - Math.exp(-lambda * dt));
const pseudoNoise = (t, seed) => {
  const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

function normalizeKey(key) {
  const k = String(key || '').toLowerCase();
  if (k === ' ' || k === 'spacebar' || k === 'space') return 'space';
  if (k === 'shiftleft' || k === 'shiftright') return 'shift';
  if (k === 'left' || k === 'a') return 'a';
  if (k === 'right' || k === 'd') return 'd';
  if (k === 'up' || k === 'w') return 'w';
  if (k === 'down' || k === 's') return 's';
  if (k === 'tab') return 'tab';
  if (k === 'escape') return 'escape';
  return k;
}

export class Game {
  constructor() {
    this.params = new URLSearchParams(window.location.search);
    this.autoMode = this.params.get('auto') === '1';
    this.demoCombat = this.params.get('demo') === 'combat';
    this.god = this.params.get('god') === '1';
    this.ready = false;
    this.mode = 'loading';
    this.time = 0;
    this.elapsed = 0;
    this.loadProgress = 0;
    this.keys = new Set();
    this.locked = false;
    this.lockOrbit = 0;
    this.manualTimer = 0;
    this.camPitch = 0.16;
    this.camYaw = Math.PI;
    this.camFocus = new THREE.Vector3(0, 1.4, 4);
    this.cameraBase = new THREE.Vector3(10.5, 4.6, 14.5);
    this.camKick = 0;
    this.fovAdd = 0;
    this.trauma = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.slowmoScale = 0.35;
    this.combo = 0;
    this.comboTimer = 0;
    this.messageTimer = 0;
    this.hits = 0;
    this.parries = 0;
    this.pendingResult = null;
    this.resultDelay = 0;
    this.pausedByDebug = false;
    this.debugPauseAt = 0;
    this.debugPauseOnHit = false;
    this.resultShown = false;
    this.resultWin = null;
    this.autoIndex = 0;
    this.autoTimer = 0.8;
    this.autoDodgeTimer = 2.7;
    this.autoJitter = 0.0;
    this.lastPerfectDodge = -10;
    this.playerHurtCooldown = 0;
    this.worldTime = 0;
    this.titleTime = 0;
    this.phase2 = false;
    this.flaskStart = 3;
    this.uiHp = 120;
    this.uiHpLag = 120;
    this.uiBoss = 480;
    this.uiBossLag = 480;
    this.uiPoise = 100;
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();

    this.initRenderer();
    this.initScene();
    this.initUI();
    this.bindEvents();
    this.setupDebug();

    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    this.loadAssets();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label', '妖王重制版 · 山门试炼');
    $('scene').appendChild(this.renderer.domElement);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(51, window.innerWidth / window.innerHeight, 0.08, 360);
    this.camera.position.set(10.5, 4.6, 14.5);
    this.camera.lookAt(-2.0, 2.8, -6.0);
    this.world = new World(this.scene, this.renderer);
    this.vfx = new VFX(this.scene, this.renderer);
    this.post = new Post(this.renderer, this.scene, this.camera);
    this.post.setSize(window.innerWidth, window.innerHeight);
    this.audio = new AudioEngine();
    this.loader = new GLTFLoader();
  }

  initUI() {
    this.el = {
      title: $('title'),
      hud: $('hud'),
      startBtn: $('startBtn'),
      startLabel: document.querySelector('#startBtn .btn-label'),
      loadBar: $('loadBar'),
      loadText: $('loadText'),
      result: $('result'),
      resultGlyph: $('resultGlyph'),
      resultTitle: $('resultTitle'),
      resultDesc: $('resultDesc'),
      retryBtn: $('retryBtn'),
      hpFill: $('hpFill'),
      hpLag: $('hpLag'),
      hpText: $('hpText'),
      stFill: $('stFill'),
      bossFill: $('bossFill'),
      bossLag: $('bossLag'),
      bossPhase: $('bossPhase'),
      bossSub: $('bossSub'),
      bossHpText: $('bossHpText'),
      poiseFill: $('poiseFill'),
      flasks: $('flasks'),
      spellChip: $('spellChip'),
      spellCd: $('spellCd'),
      targetChip: $('targetChip'),
      targetDist: $('targetDist'),
      lockMarker: $('lockMarker'),
      lockDist: $('lockDist'),
      combo: $('combo'),
      comboNum: $('comboNum'),
      message: $('message'),
      damageLayer: $('damageLayer'),
      hurtVignette: $('hurtVignette'),
      whiteFlash: $('whiteFlash'),
      hudHint: document.querySelector('.hud-hint'),
      statTime: $('statTime'),
      statHits: $('statHits'),
      statParries: $('statParries'),
      statFlasks: $('statFlasks'),
    };
    this.el.startBtn.disabled = true;
    this.el.retryBtn.addEventListener('click', () => this.beginGame(true));
    this.el.startBtn.addEventListener('click', () => this.beginGame(true));
  }

  bindEvents() {
    const canvas = this.renderer.domElement;
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => {
      const k = normalizeKey(e.key);
      this.keys.delete(k);
    });
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'playing') return;
      if (e.button === 0) this.requestAction('light');
      if (e.button === 2) { this.lookDragging = true; canvas.setPointerCapture?.(e.pointerId); }
      this.audio.init();
    });
    canvas.addEventListener('pointerup', () => { this.lookDragging = false; });
    canvas.addEventListener('pointerleave', () => { this.lookDragging = false; });
    canvas.addEventListener('pointermove', (e) => {
      if (this.mode !== 'playing') return;
      const locked = document.pointerLockElement === canvas;
      if (!locked && !this.lookDragging) return;
      this.camPitch = clamp(this.camPitch + e.movementY * 0.0016, 0.02, 0.52);
      this.camYaw -= e.movementX * 0.0022;
      if (this.locked) this.lockOrbit = clamp(this.lockOrbit - e.movementX * 0.0014, -0.55, 0.55);
      this.manualTimer = 1.1;
    });
    document.addEventListener('pointerlockchange', () => {
      // The HUD hint is toggled from the lock state, not from pointer lock.
    });
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
    this.vfx.resize();
  }

  onKeyDown(e) {
    const k = normalizeKey(e.key);
    if (k === 'tab' || k === 'space') e.preventDefault();
    if (k === 'escape') return;
    if (e.repeat) return;
    this.keys.add(k);
    this.handleKeyAction(k);
  }

  press(key) {
    const k = normalizeKey(key);
    this.keys.add(k);
    this.handleKeyAction(k);
  }

  release(key) {
    this.keys.delete(normalizeKey(key));
  }

  handleKeyAction(k) {
    if (k === 'enter') {
      if (this.mode === 'title' && this.ready) this.beginGame(true);
      else if (this.mode === 'result') this.beginGame(true);
      return;
    }
    if (this.mode !== 'playing') return;
    if (k === 'j') this.requestAction('light');
    else if (k === 'k') this.requestAction('heavy');
    else if (k === 'l') this.requestAction('parry');
    else if (k === 'space') this.requestAction('dodge');
    else if (k === 'q') this.requestAction('spell');
    else if (k === 'r') this.requestAction('heal');
    else if (k === 'tab') this.toggleLock();
  }

  toggleLock() {
    if (!this.boss || this.boss.state === 'dead' || this.mode !== 'playing') return;
    this.locked = !this.locked;
    this.lockOrbit = 0;
    this.manualTimer = 0;
    if (this.locked) {
      const yaw = Math.atan2(this.boss.root.position.x - this.player.root.position.x, this.boss.root.position.z - this.player.root.position.z);
      this.camYaw = yaw;
      this.audio.ui();
    } else {
      this.showMessage('解除锁定', 0.7, 'small');
    }
  }

  requestAction(action, heavy = false) {
    if (this.mode !== 'playing' || !this.player) return false;
    const p = this.player;
    if (action === 'heal' && p.flasks <= 0) {
      this.showMessage('酒已尽', 0.9, 'small');
      return false;
    }
    if (action === 'spell' && p.spellCd > 0) {
      this.showMessage(`定身 · ${Math.ceil(p.spellCd)} 秒`, 0.8, 'small');
      return false;
    }
    if (action === 'dodge') {
      const move = this.getMoveVector();
      p.pendingDodgeDir = move.lengthSq() > 0.02 ? move.clone() : null;
      return p.requestAction('dodge');
    }
    if ((action === 'light' || action === 'heavy') && p.canAct()) {
      const b = this.boss;
      p.attackTargetDist = null;
      if (b && b.state !== 'dead' && b.state !== 'phase') {
        const dx = b.root.position.x - p.root.position.x;
        const dz = b.root.position.z - p.root.position.z;
        const dist = Math.hypot(dx, dz);
        const fwdX = Math.sin(p.yaw), fwdZ = Math.cos(p.yaw);
        const dot = dist > 0.01 ? (dx * fwdX + dz * fwdZ) / dist : 1;
        p.attackTargetDist = dist;
        if (dist < 8.5 && (this.locked || dot > 0.05)) {
          p.yaw = Math.atan2(dx, dz);
          p.root.rotation.y = p.yaw;
          p.desiredYaw = p.yaw;
        }
      }
    }
    return p.requestAction(action, heavy);
  }

  setGod(v = true) {
    this.god = !!v;
    if (this.player) this.player.god = this.god;
  }

  loadAssets() {
    const base = import.meta.env.BASE_URL || '/';
    let heroDone = 0, bossDone = 0;
    const updateLoad = () => {
      const pct = this.ready ? 100 : Math.round(heroDone * 0.64 + bossDone * 0.36);
      this.loadProgress = pct;
      this.el.loadBar.style.width = `${pct}%`;
      this.el.loadText.textContent = pct >= 100 ? '山门已开 · 点击入内' : `载入妖王残卷 · ${pct}%`;
    };
    const load = (url, weight, set) => new Promise((resolve, reject) => {
      this.loader.load(url, (gltf) => {
        set(1);
        updateLoad();
        resolve(gltf);
      }, (ev) => {
        if (ev.total > 0) {
          set(clamp(ev.loaded / ev.total, 0, 0.999));
          updateLoad();
        }
      }, (err) => reject(err));
    });

    Promise.all([
      load(`${base}assets/yaowang/animated.glb`, 0.64, (v) => { heroDone = v; }),
      load(`${base}assets/yaowang/model.glb`, 0.36, (v) => { bossDone = v; }),
    ]).then(([heroGltf, bossGltf]) => {
      this.player = new Player(this.scene, heroGltf);
      this.boss = new Boss(this.scene, bossGltf);
      this.player.god = this.god;
      this.uiHp = this.player.hp;
      this.uiHpLag = this.player.hp;
      this.uiBoss = this.boss.hp;
      this.uiBossLag = this.boss.hp;
      this.ready = true;
      this.mode = 'title';
      updateLoad();
      // A title-only composition: keep the boss and hero to the right of the copy.
      this.boss.root.position.set(3.1, 0, -4.6);
      this.player.root.position.set(4.75, 0, 2.75);
      this.boss.yaw = Math.atan2(this.player.root.position.x - this.boss.root.position.x, this.player.root.position.z - this.boss.root.position.z);
      this.boss.root.rotation.y = this.boss.yaw;
      this.player.yaw = Math.atan2(this.boss.root.position.x - this.player.root.position.x, this.boss.root.position.z - this.player.root.position.z);
      this.player.root.rotation.y = this.player.yaw;
      this.el.startBtn.disabled = false;
      this.el.startLabel.textContent = '入 山 迎 战';
      this.el.startBtn.style.opacity = '1';
      this.camera.position.copy(this.cameraBase);
      this.camera.lookAt(-2.0, 2.8, -6.0);
      if (this.autoMode || this.demoCombat) {
        setTimeout(() => {
          if (this.mode === 'title') this.beginGame(false);
        }, 120);
      }
    }).catch((err) => {
      console.error('[yaowang] asset load failed', err);
      this.el.loadText.textContent = '载入失败 · 请检查本地 GLB 资产';
      this.el.loadBar.style.width = '100%';
    });
  }

  beginGame(gesture = false) {
    if (!this.ready || !this.player || !this.boss) return;
    if (this.mode === 'playing') return;
    this.audio.init();
    if (gesture && !this.autoMode) {
      try { this.renderer.domElement.requestPointerLock?.(); } catch (_) { /* ignore */ }
    }
    this.el.title.classList.add('hidden');
    this.el.result.classList.add('hidden');
    this.el.result.classList.remove('loss', 'win');
    this.el.hud.classList.add('visible');
    this.mode = 'playing';
    this.resultShown = false;
    this.resultWin = null;
    this.pendingResult = null;
    this.elapsed = 0;
    this.time = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.messageTimer = 0;
    this.hits = 0;
    this.parries = 0;
    this.flaskStart = 3;
    this.trauma = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.camKick = 0;
    this.fovAdd = 0;
    this.phase2 = false;
    this.lastPerfectDodge = -10;
    this.autoIndex = 0;
    this.autoTimer = 0.8;
    this.autoDodgeTimer = 4.2;
    this.playerHurtCooldown = 0;
    this.uiHp = this.player.maxHp;
    this.uiHpLag = this.player.maxHp;
    this.uiBoss = this.boss.maxHp;
    this.uiBossLag = this.boss.maxHp;
    this.uiPoise = this.boss.maxPoise;
    this.player.reset();
    this.player.god = this.god;
    this.boss.reset();
    this.vfx.clear();
    this.el.bossPhase.textContent = '一 式';
    this.el.bossPhase.classList.remove('phase2');
    this.el.bossSub.textContent = '妖气未散';
    this.el.combo.classList.remove('on');
    this.el.lockMarker.classList.remove('on');
    this.el.targetChip.classList.remove('on');
    this.el.hurtVignette.style.opacity = '0';

    if (this.demoCombat) {
      this.boss.root.position.set(0, 0, -2.3);
      this.boss.idleTimer = 0.35;
      this.boss.cooldown = 0.25;
    }
    this.locked = true;
    this.camYaw = Math.atan2(this.boss.root.position.x - this.player.root.position.x, this.boss.root.position.z - this.player.root.position.z);
    this.camPitch = 0.16;
    this.lockOrbit = 0;
    this.cameraBase.copy(this.camera.position);
    this.camFocus.set(this.player.root.position.x, 1.35, this.player.root.position.z);
    const toBoss = new THREE.Vector3().subVectors(this.boss.root.position, this.player.root.position).setY(0);
    this.camFocus.addScaledVector(toBoss.normalize(), 0.7);
    this.showMessage('入 山', 1.15, 'small');
    setTimeout(() => { if (this.mode === 'playing') this.audio.roar(false); }, 480);
  }

  getMoveVector() {
    const x = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
    const z = (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0);
    const fwd = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const move = new THREE.Vector3();
    move.addScaledVector(fwd, z);
    move.addScaledVector(right, x);
    if (move.lengthSq() > 0.001) move.normalize();
    return move;
  }

  getInput() {
    if (this.mode !== 'playing') return { move: new THREE.Vector3(), sprint: false, locked: this.locked };
    let move;
    let sprint = false;
    if (this.autoMode) {
      const b = this.boss;
      move = new THREE.Vector3();
      if (b && b.state !== 'dead') {
        const toBoss = new THREE.Vector3().subVectors(b.root.position, this.player.root.position).setY(0);
        const dist = toBoss.length();
        if (dist > 3.15) move.copy(toBoss.normalize());
        sprint = dist > 5.2;
      }
    } else {
      move = this.getMoveVector();
      sprint = this.keys.has('shift');
    }
    return { move, sprint, locked: this.locked };
  }

  handleAuto(dt) {
    if (!this.autoMode || this.mode !== 'playing' || !this.player || !this.boss) return;
    const p = this.player, b = this.boss;
    if (b.state === 'dead' || p.state === 'dead') return;
    this.autoTimer -= dt;
    this.autoDodgeTimer -= dt;
    const dist = p.root.position.distanceTo(b.root.position);
    if (this.autoTimer <= 0) {
      this.autoTimer = 0.78 + (this.autoIndex % 3) * 0.07;
      this.autoIndex++;
      if (dist < 4.9) {
        if (this.autoIndex % 4 === 0) this.requestAction('heavy');
        else this.requestAction('light');
      }
    }
    if (this.autoDodgeTimer <= 0) {
      this.autoDodgeTimer = 3.3;
      if ((b.state === 'telegraph' || b.state === 'attack') && dist < 6.2) {
        const side = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw)).multiplyScalar(this.autoIndex % 2 ? 1 : -1);
        p.pendingDodgeDir = side;
        p.requestAction('dodge');
      }
    }
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.update(dt);
    this.post.update(dt);
  }

  update(dt) {
    if (this.pausedByDebug) return;
    this.time += dt;
    if (this.mode === 'loading' || this.mode === 'title') {
      this.titleTime += dt;
      this.world.update(dt, this.time, this.camera);
      if (this.player) this.player.mixer.update(dt);
      if (this.boss) { this.boss.visual.position.y = Math.sin(this.time * 1.1) * 0.022; this.boss.updateEyes(this); }
      this.updateTitleCamera(dt);
      return;
    }

    if (this.mode === 'result') {
      this.world.update(dt, this.time, this.camera);
      this.vfx.update(dt, this.time);
      this.updateResultCamera(dt);
      return;
    }

    const playing = this.mode === 'playing';
    if (playing) {
      this.elapsed += dt;
      this.handleAuto(dt);
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer <= 0) { this.combo = 0; this.el.combo.classList.remove('on'); }
      this.messageTimer = Math.max(0, this.messageTimer - dt);
      if (this.messageTimer <= 0) this.el.message.classList.remove('on');
      this.playerHurtCooldown = Math.max(0, this.playerHurtCooldown - dt);
    }

    if (this.pendingResult) {
      this.resultDelay -= dt;
      if (this.resultDelay <= 0) {
        const win = this.pendingResult === 'win';
        this.pendingResult = null;
        this.showResult(win);
        return;
      }
    }

    if (this.slowmo > 0) this.slowmo -= dt;
    let scale = 1;
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      scale = 0.06;
    } else if (this.slowmo > 0) {
      scale = this.slowmoScale;
    }
    const gdt = dt * scale;

    if (this.player && this.boss) {
      const input = playing ? this.getInput() : { move: new THREE.Vector3(), sprint: false, locked: false };
      this.player.update(gdt, input, this);
      this.boss.update(gdt, this);
      this.resolveBodies();
    }

    this.vfx.update(dt, this.time);
    this.world.update(dt, this.time, this.camera);
    this.updateCamera(dt);
    this.updateHUD(dt);
    this.audio.ambientTick(dt);
    if (this.debugPauseAt && this.time >= this.debugPauseAt) {
      this.debugPauseAt = 0;
      this.pausedByDebug = true;
    }
  }

  resolveBodies() {
    if (!this.player || !this.boss || this.boss.state === 'dead') return;
    const p = this.player.root.position;
    const b = this.boss.root.position;
    let dx = p.x - b.x, dz = p.z - b.z;
    let d = Math.hypot(dx, dz);
    const min = 1.55;
    if (d < min) {
      if (d < 0.001) { dx = 0; dz = 1; d = 1; }
      p.x = b.x + dx / d * min;
      p.z = b.z + dz / d * min;
      this.clampToArena(p, 11.2);
    }
  }

  clampToArena(v, radius = 11.2) {
    const r = Math.hypot(v.x, v.z);
    if (r > radius) {
      v.x *= radius / r;
      v.z *= radius / r;
    }
  }

  updateTitleCamera(dt) {
    const t = this.titleTime;
    const target = this.tmp.set(10.2 + Math.sin(t * 0.035) * 0.55, 4.45 + Math.sin(t * 0.06) * 0.1, 14.8 + Math.cos(t * 0.028) * 0.35);
    this.cameraBase.lerp(target, 1 - Math.exp(-1.6 * dt));
    this.camera.position.copy(this.cameraBase);
    this.camera.fov = damp(this.camera.fov, 49, 2, dt);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(-2.1, 2.85, -6.2);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }

  updateResultCamera(dt) {
    this.cameraBase.lerp(new THREE.Vector3(8.6, 4.0, 12.2), 1 - Math.exp(-0.8 * dt));
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(-1.2, 2.2, -4.4);
    this.camera.fov = damp(this.camera.fov, 46, 1.5, dt);
    this.camera.updateProjectionMatrix();
  }

  updateCamera(dt) {
    const p = this.player;
    const b = this.boss;
    if (!p) return;
    this.trauma = Math.max(0, this.trauma - dt * 1.55);
    this.manualTimer = Math.max(0, this.manualTimer - dt);
    this.camKick = damp(this.camKick, 0, 8, dt);
    this.fovAdd = damp(this.fovAdd, 0, 6, dt);
    if (this.locked && b && b.state !== 'dead') {
      this.lockOrbit = damp(this.lockOrbit, 0, 1.4, dt);
    }

    const pPos = p.root.position;
    const bPos = b?.root.position;
    const toBoss = new THREE.Vector3();
    if (bPos && b.state !== 'dead') toBoss.subVectors(bPos, pPos).setY(0);
    const dist = toBoss.length();

    let desiredYaw = this.camYaw;
    if (this.locked && bPos && b.state !== 'dead') {
      desiredYaw = Math.atan2(bPos.x - pPos.x, bPos.z - pPos.z) + this.lockOrbit;
    } else if (this.manualTimer <= 0 && (p.state === 'move' || p.state === 'sprint')) {
      desiredYaw = p.yaw;
    }
    this.camYaw = dampAngle(this.camYaw, desiredYaw, this.locked ? 4.2 : 2.2, dt);

    const focusGoal = new THREE.Vector3(pPos.x, 1.38, pPos.z);
    if (this.locked && bPos && b.state !== 'dead') {
      const bias = Math.min(1.9, dist * 0.12);
      focusGoal.addScaledVector(toBoss.clone().normalize(), bias);
      focusGoal.y = 1.55;
    }
    if (p.state === 'dead') focusGoal.y = 0.8;
    this.camFocus.lerp(focusGoal, 1 - Math.exp(-6.5 * dt));

    const fwd = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    const distance = this.locked ? 6.15 : 6.65;
    const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const target = new THREE.Vector3().copy(this.camFocus).addScaledVector(fwd, -distance).addScaledVector(right, 0.82);
    target.y = this.camFocus.y + 1.45 + this.camPitch * 3.5 + (p.state === 'dead' ? -0.4 : 0);
    target.y = Math.max(0.85, target.y);
    const intro = this.mode === 'playing' && this.elapsed < 1.0 ? 4.0 : 7.5;
    this.cameraBase.lerp(target, 1 - Math.exp(-intro * dt));

    // shake is applied after the follow rig writes its base transform
    const shake = this.trauma * this.trauma;
    const shTime = this.time * 36;
    const shakeX = pseudoNoise(shTime, 1) * shake * 0.35;
    const shakeY = pseudoNoise(shTime, 2) * shake * 0.24;
    const shakeZ = pseudoNoise(shTime, 3) * shake * 0.12;
    this.camera.position.copy(this.cameraBase);
    this.camera.position.x += shakeX;
    this.camera.position.y += shakeY;
    this.camera.position.z += shakeZ;

    const lookTarget = this.tmp2.copy(this.camFocus).addScaledVector(fwd, 0.9);
    lookTarget.y += 0.3 + this.camKick;
    this.camera.lookAt(lookTarget);
    this.camera.rotateZ(pseudoNoise(shTime, 4) * shake * 0.06);

    const sprintFov = (p.state === 'sprint' ? 3.6 : 0) + (this.locked ? -0.6 : 0);
    const targetFov = 51 + sprintFov + this.fovAdd;
    this.camera.fov = damp(this.camera.fov, targetFov, 5.5, dt);
    this.camera.updateProjectionMatrix();
  }

  addTrauma(v) { this.trauma = clamp(this.trauma + v, 0, 1); }
  cameraKick(v) { this.camKick += v; }
  shakeFov(v) { this.fovAdd += v; }
  hitStop(v) { this.hitstop = Math.max(this.hitstop, v); }

  resolvePlayerAttack(player, data, attackType) {
    const boss = this.boss;
    if (!boss || boss.state === 'dead') return;
    const px = player.root.position.x, pz = player.root.position.z;
    const bx = boss.root.position.x, bz = boss.root.position.z;
    const dx = bx - px, dz = bz - pz;
    const dist = Math.hypot(dx, dz);
    const fwdX = Math.sin(player.yaw), fwdZ = Math.cos(player.yaw);
    const dot = dist > 0.01 ? (dx * fwdX + dz * fwdZ) / dist : 1;
    const range = attackType === 'heavy' ? 3.35 : attackType === 'light3' ? 3.15 : 2.95;
    if (dist > range || dot < 0.1) {
      this.vfx.dust(new THREE.Vector3(px + fwdX * 1.4, 0.06, pz + fwdZ * 1.4), 2, [0.3, 0.31, 0.29], 0.5, 0.35, 0.3);
      return;
    }
    const contact = new THREE.Vector3().lerpVectors(player.root.position, boss.root.position, 0.62);
    contact.y = attackType === 'heavy' ? 2.7 : 2.1 + Math.random() * 0.5;
    contact.x += (Math.random() - 0.5) * 0.5;
    contact.z += (Math.random() - 0.5) * 0.5;
    const res = boss.takePlayerHit(data.damage, data.poise, attackType, contact, this);
    if (res.damage > 0) {
      this.hits++;
      this.combo++;
      this.comboTimer = 2.5;
      this.el.comboNum.textContent = String(this.combo);
      this.el.combo.classList.add('on');
      const head = new THREE.Vector3(boss.root.position.x, 2.95, boss.root.position.z);
      this.spawnDamage(head, `${res.damage}`, res.crit ? 'crit' : '', res.crit ? '破韧' : '');
      this.hitStop(attackType === 'heavy' ? 0.082 : res.crit ? 0.088 : 0.070);
      this.addTrauma(attackType === 'heavy' ? 0.42 : 0.26);
      this.cameraKick(-0.045);
      this.shakeFov(attackType === 'heavy' ? 2.8 : 1.45);
      this.post.punch(attackType === 'heavy' ? 0.5 : 0.24);
      if (res.crit) {
        this.slowmo = Math.max(this.slowmo, 0.18);
        this.slowmoScale = 0.42;
      }
      if (this.debugPauseOnHit) {
        this.debugPauseOnHit = false;
        this.debugPauseAt = this.time + 0.13;
      }
    }
  }

  onPlayerSwing(player, attackType) {
    const heavy = attackType === 'heavy';
    const radius = heavy ? 1.24 : player.comboIndex === 3 ? 1.12 : 0.98;
    const height = heavy ? 1.34 : 1.28 + (player.comboIndex === 2 ? 0.06 : 0);
    this.vfx.slashArc(player.root.position, player.yaw, {
      radius,
      height,
      color: heavy ? 0xffc57a : 0xffe6b2,
      heavy,
      flip: player.comboIndex % 2 === 0,
      duration: heavy ? 0.32 : 0.24,
      camera: this.camera,
    });
    this.audio.swing(heavy);
    if (heavy) {
      this.addTrauma(0.13);
      this.shakeFov(1.1);
    }
  }

  onPlayerHurt(amount, wasHealing) {
    this.combo = 0;
    this.comboTimer = 0;
    this.el.combo.classList.remove('on');
    this.addTrauma(0.62);
    this.cameraKick(0.14);
    this.shakeFov(4.2);
    this.post.punch(0.55);
    this.audio.playerHurt();
    this.el.hurtVignette.style.opacity = '1';
    clearTimeout(this._hurtTimer);
    this._hurtTimer = setTimeout(() => { this.el.hurtVignette.style.opacity = '0'; }, 150);
    this.el.whiteFlash.style.opacity = '0.15';
    clearTimeout(this._whiteTimer);
    this._whiteTimer = setTimeout(() => { this.el.whiteFlash.style.opacity = '0'; }, 80);
    const p = this.player;
    this.spawnDamage(new THREE.Vector3(p.root.position.x, 1.75, p.root.position.z), `-${Math.round(amount)}`, 'player');
    if (wasHealing) this.showMessage('饮酒被打断', 0.8, 'small');
  }

  onPlayerDeath() {
    if (this.mode !== 'playing') return;
    this.mode = 'ending';
    this.pendingResult = 'lose';
    this.resultDelay = 2.0;
    this.slowmo = 0.8;
    this.slowmoScale = 0.35;
    this.boss.cooldown = 999;
    this.boss.clearWarning();
    this.boss.state = 'idle';
    this.boss.stateTime = 0;
    this.locked = false;
    this.el.lockMarker.classList.remove('on');
    this.el.targetChip.classList.remove('on');
    this.el.hud.classList.remove('visible');
    this.audio.defeat();
    this.addTrauma(0.55);
    this.showMessage('倒 下', 1.4, 'big red');
  }

  onBossDeath() {
    if (this.mode !== 'playing') return;
    this.mode = 'ending';
    this.pendingResult = 'win';
    this.resultDelay = 2.9;
    this.slowmo = 1.45;
    this.slowmoScale = 0.3;
    this.locked = false;
    this.el.lockMarker.classList.remove('on');
    this.el.targetChip.classList.remove('on');
    this.el.hud.classList.remove('visible');
    this.audio.victory();
    this.addTrauma(0.5);
  }

  onBossParried() {
    this.parries++;
    this.hitStop(0.16);
    this.slowmo = Math.max(this.slowmo, 0.5);
    this.slowmoScale = 0.36;
    this.addTrauma(0.66);
    this.cameraKick(0.16);
    this.shakeFov(6.5);
    this.post.punch(1.05);
    this.audio.parry();
    const bp = this.boss.root.position;
    const contact = new THREE.Vector3(bp.x, 2.6, bp.z);
    this.vfx.sparks(contact, new THREE.Vector3(0, 1, 0), 40, [1.0, 0.83, 0.35], 1.5);
    this.vfx.hitFlash(contact, 0xffe4a6, 1.25, 0.08);
    this.vfx.ring(new THREE.Vector3(this.player.root.position.x, 0.06, this.player.root.position.z), 0xffd08a, 3.1, 0.5, 0.3);
    this.el.whiteFlash.style.opacity = '0.26';
    clearTimeout(this._whiteTimer);
    this._whiteTimer = setTimeout(() => { this.el.whiteFlash.style.opacity = '0'; }, 120);
    this.showMessage('弹 反', 1.0, 'big');
  }

  onBossStagger() {
    this.hitStop(0.13);
    this.addTrauma(0.42);
    this.shakeFov(3.2);
    this.post.punch(0.55);
    this.audio.hit(true, true);
    this.showMessage('破 韧', 0.9, 'big');
  }

  onBossPhase2() {
    this.phase2 = true;
    this.el.bossPhase.textContent = '二 式';
    this.el.bossPhase.classList.add('phase2');
    this.el.bossSub.textContent = '妖 气 暴 走';
    this.showMessage('妖 王 · 二 式', 1.4);
    this.addTrauma(0.8);
    this.cameraKick(-0.12);
    this.shakeFov(6.0);
    this.post.punch(0.9);
    this.audio.roar(true);
  }

  onBossPhaseShockwave() {
    this.addTrauma(0.9);
    this.shakeFov(5.0);
    this.cameraKick(-0.15);
  }

  onBossMiss(boss, type) {
    const p = this.player;
    if (p.state !== 'dodge') return;
    if (this.elapsed - this.lastPerfectDodge < 0.8) return;
    this.lastPerfectDodge = this.elapsed;
    this.slowmo = Math.max(this.slowmo, 0.28);
    this.slowmoScale = 0.52;
    p.stamina = Math.min(p.maxStamina, p.stamina + 9);
    this.addTrauma(0.12);
    this.showMessage('闪', 0.55, 'big');
    this.vfx.ring(new THREE.Vector3(p.root.position.x, 0.05, p.root.position.z), 0x9fc9c1, 2.2, 0.38, 0.16);
  }

  onPlayerFootstep(player, sprint) {
    this.audio.step(sprint);
    if (Math.random() < 0.55) {
      this.vfx.dust(new THREE.Vector3(player.root.position.x, 0.03, player.root.position.z), 1, [0.28, 0.30, 0.27], 0.35, 0.38, 0.3);
    }
  }

  onPlayerDodgeGhost(pos, yaw, t) {
    if (Math.random() < 0.7) {
      this.vfx.dust(new THREE.Vector3(pos.x, 0.04, pos.z), 1, [0.38, 0.40, 0.36], 0.5, 0.5, 0.4);
    }
  }

  onBossFootstep(boss) {
    this.audio.bossStep();
    this.vfx.dust(new THREE.Vector3(boss.root.position.x, 0.04, boss.root.position.z), 2, [0.30, 0.32, 0.29], 0.9, 0.65, 0.5);
    this.addTrauma(0.045);
  }

  onPlayerHeal(player) {
    this.audio.heal();
    this.vfx.ring(new THREE.Vector3(player.root.position.x, 0.05, player.root.position.z), 0xdfc083, 2.2, 0.55, 0.12);
    this.spawnDamage(new THREE.Vector3(player.root.position.x, 1.8, player.root.position.z), '+46', 'heal');
  }

  onPlayerSpell(player) {
    const boss = this.boss;
    if (!boss || boss.state === 'dead') return;
    if (boss.state === 'telegraph' || boss.state === 'attack') {
      boss.state = 'idle';
      boss.stateTime = 0;
      boss.cooldown = Math.max(boss.cooldown, 1.0);
      boss.clearWarning();
    }
    boss.frozen = 2.4;
    this.audio.spell();
    this.vfx.spell(new THREE.Vector3(boss.root.position.x, 0, boss.root.position.z), 2.4);
    this.showMessage('定', 1.0, 'big');
    this.addTrauma(0.2);
    this.post.punch(0.25);
  }

  spawnDamage(worldPos, text, cls = '', suffix = '') {
    if (!this.camera || !this.el.damageLayer) return;
    const v = worldPos.clone().project(this.camera);
    if (v.z < -1 || v.z > 1) return;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 28;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight + (Math.random() - 0.5) * 14;
    const el = document.createElement('div');
    el.className = `damage-number ${cls}`;
    el.innerHTML = `${text}${suffix ? `<span class="sub">${suffix}</span>` : ''}`;
    if (cls === 'heal') el.style.color = '#a9d8ad';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.el.damageLayer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  showMessage(text, duration = 1.1, cls = '') {
    const el = this.el.message;
    el.textContent = text;
    el.className = `message on ${cls}`.trim();
    this.messageTimer = duration;
  }

  showResult(win) {
    if (this.resultShown) return;
    this.resultShown = true;
    this.mode = 'result';
    this.resultWin = win;
    this.el.hud.classList.remove('visible');
    this.el.lockMarker.classList.remove('on');
    this.el.targetChip.classList.remove('on');
    this.el.damageLayer.innerHTML = '';
    this.el.result.classList.remove('hidden');
    this.el.result.classList.toggle('loss', !win);
    this.el.result.classList.toggle('win', win);
    this.el.resultGlyph.textContent = win ? '胜' : '败';
    this.el.resultTitle.textContent = win ? '妖王伏诛' : '山门未开';
    this.el.resultDesc.textContent = win ? '山门已开。你听见风从很远的地方吹来。' : '石甲没有移动。再看一次它的抬手，再来。';
    const mm = Math.floor(this.elapsed / 60).toString().padStart(2, '0');
    const ss = Math.floor(this.elapsed % 60).toString().padStart(2, '0');
    this.el.statTime.textContent = `${mm}:${ss}`;
    this.el.statHits.textContent = String(this.hits);
    this.el.statParries.textContent = String(this.parries);
    this.el.statFlasks.textContent = String(this.player?.flasks ?? 0);
    try { document.exitPointerLock?.(); } catch (_) { /* ignore */ }
  }

  forceResult(win = true) {
    if (!this.ready) return;
    if (win && this.boss) {
      this.boss.hp = 0;
      this.boss.state = 'dead';
      this.boss.deadTimer = 1.1;
      this.boss.clearWarning();
    }
    if (!win && this.player) {
      this.player.hp = 0;
      this.player.state = 'dead';
      this.player.deadTimer = 0.4;
    }
    this.el.result.classList.add('hidden');
    this.resultShown = false;
    this.showResult(win);
  }

  updateHUD(dt) {
    const p = this.player, b = this.boss;
    if (!p || !b) return;
    this.uiHp = damp(this.uiHp, p.hp, 20, dt);
    this.uiHpLag = damp(this.uiHpLag, p.hp, 3.3, dt);
    this.uiBoss = damp(this.uiBoss, b.hp, 22, dt);
    this.uiBossLag = damp(this.uiBossLag, b.hp, 3.0, dt);
    this.uiPoise = damp(this.uiPoise, b.poise, 18, dt);

    this.el.hpFill.style.transform = `scaleX(${clamp(this.uiHp / p.maxHp, 0, 1)})`;
    this.el.hpLag.style.transform = `scaleX(${clamp(this.uiHpLag / p.maxHp, 0, 1)})`;
    this.el.hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    this.el.stFill.style.transform = `scaleX(${clamp(p.stamina / p.maxStamina, 0, 1)})`;
    this.el.bossFill.style.transform = `scaleX(${clamp(this.uiBoss / b.maxHp, 0, 1)})`;
    this.el.bossLag.style.transform = `scaleX(${clamp(this.uiBossLag / b.maxHp, 0, 1)})`;
    this.el.poiseFill.style.transform = `scaleX(${clamp(this.uiPoise / b.maxPoise, 0, 1)})`;
    this.el.bossHpText.textContent = String(Math.ceil(b.hp));
    this.el.bossPhase.textContent = b.phase === 2 ? '二 式' : '一 式';
    this.el.bossPhase.classList.toggle('phase2', b.phase === 2);
    if (b.state === 'stagger') this.el.bossSub.textContent = '破 韧';
    else if (b.frozen > 0) this.el.bossSub.textContent = '定 身';
    else if (b.state === 'dead') this.el.bossSub.textContent = '已 伏';
    else if (b.phase === 2) this.el.bossSub.textContent = '妖 气 暴 走';
    else this.el.bossSub.textContent = '妖 气 未 散';

    const pips = this.el.flasks.querySelectorAll('i');
    pips.forEach((pip, i) => pip.classList.toggle('used', i >= p.flasks));
    const onCd = p.spellCd > 0;
    this.el.spellChip.classList.toggle('on-cooldown', onCd);
    this.el.spellCd.textContent = onCd ? `${Math.ceil(p.spellCd)}s` : '就绪';

    if (this.combo > 0 && this.comboTimer > 0) {
      this.el.combo.classList.add('on');
      this.el.comboNum.textContent = String(this.combo);
    } else {
      this.el.combo.classList.remove('on');
    }

    const alive = b.state !== 'dead' && this.mode !== 'result';
    this.el.hudHint?.classList.toggle('hidden-by-target', this.locked && alive);
    if (this.locked && alive) {
      this.el.targetChip.classList.add('on');
      this.el.hudHint?.classList.remove('hidden-by-target');
      const dist = p.root.position.distanceTo(b.root.position);
      this.el.targetDist.textContent = `${dist.toFixed(1)} m`;
      const head = this.tmp.set(b.root.position.x, 3.55, b.root.position.z);
      head.project(this.camera);
      const behind = head.z > 1;
      const sx = (head.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-head.y * 0.5 + 0.5) * window.innerHeight;
      if (!behind && sx > -40 && sx < window.innerWidth + 40 && sy > -40 && sy < window.innerHeight + 40) {
        this.el.lockMarker.style.left = `${sx}px`;
        this.el.lockMarker.style.top = `${sy}px`;
        this.el.lockDist.textContent = `${dist.toFixed(1)}m`;
        this.el.lockMarker.classList.add('on');
      } else {
        this.el.lockMarker.classList.remove('on');
      }
    } else {
      this.el.lockMarker.classList.remove('on');
      this.el.targetChip.classList.remove('on');
    }
  }

  updateTitle(dt) {
    this.titleTime += dt;
  }

  debugStep(n = 1, dt = 1 / 60) {
    const steps = clamp(Math.floor(n), 1, 600);
    for (let i = 0; i < steps; i++) this.update(dt);
    this.post.update(dt);
  }

  setupDebug() {
    const game = this;
    window.G = {
      get ready() { return game.ready; },
      get state() { return game.state(); },
      start: () => game.beginGame(false),
      press: (key) => game.press(key),
      release: (key) => game.release(key),
      step: (n = 1, dt = 1 / 60) => game.debugStep(n, dt),
      state: () => game.state(),
      setGod: (v = true) => game.setGod(v),
      forceResult: (win = true) => game.forceResult(win),
      pause: (v = true) => { game.pausedByDebug = !!v; },
      resume: () => { game.pausedByDebug = false; },
      pauseOnNextHit: (v = true) => { game.debugPauseOnHit = !!v; },
      setBossHp: (v) => { if (game.boss) game.boss.hp = clamp(Number(v) || 0, 0, game.boss.maxHp); },
      setPlayerHp: (v) => { if (game.player) game.player.hp = clamp(Number(v) || 0, 0, game.player.maxHp); },
      phase2: () => {
        if (game.boss) {
          game.boss.hp = Math.min(game.boss.hp, game.boss.maxHp * 0.5);
          game.boss.startPhase2(game);
        }
      },
      game,
    };
  }

  state() {
    const p = this.player, b = this.boss;
    return {
      ready: this.ready,
      mode: this.mode,
      paused: this.pausedByDebug,
      hitstop: Number(this.hitstop.toFixed(3)),
      trauma: Number(this.trauma.toFixed(3)),
      fov: Number(this.camera.fov.toFixed(1)),
      auto: this.autoMode,
      demoCombat: this.demoCombat,
      god: this.god,
      time: Number(this.elapsed.toFixed(2)),
      hp: p?.hp ?? null,
      maxHp: p?.maxHp ?? null,
      stamina: p ? Number(p.stamina.toFixed(1)) : null,
      flasks: p?.flasks ?? null,
      spellCd: p ? Number(p.spellCd.toFixed(1)) : null,
      playerState: p?.state ?? null,
      attacking: p ? p.state === 'attack' || p.state === 'heavy' : false,
      trail: p?.weaponActive ?? false,
      bossHp: b?.hp ?? null,
      bossState: b?.state ?? null,
      phase: b?.phase ?? null,
      poise: b ? Number(b.poise.toFixed(1)) : null,
      frozen: b?.frozen ?? null,
      bossAttack: b?.attackType ?? null,
      locked: this.locked,
      combo: this.combo,
      hits: this.hits,
      parries: this.parries,
      result: this.resultWin,
      playerPos: p ? p.root.position.toArray().map((v) => Number(v.toFixed(2))) : null,
      bossPos: b ? b.root.position.toArray().map((v) => Number(v.toFixed(2))) : null,
    };
  }
}
