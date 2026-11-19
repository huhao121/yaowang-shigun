import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.0 },
    uVignette: { value: 0.9 },
    uGrain: { value: 0.022 },
    uDesat: { value: 0.04 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uDesat;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      float ab = uAberration * (0.0007 + r2 * 0.0022);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * ab).b;

      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, 1.07 - uDesat);
      // restrained cold shadow / warm highlight split tone
      col += vec3(0.004, 0.010, 0.015) * (1.0 - smoothstep(0.0, 0.42, luma));
      col = mix(col, col * vec3(0.94, 1.015, 1.035), 0.8);
      col = mix(col, col * vec3(1.045, 1.005, 0.965), smoothstep(0.55, 1.0, luma) * 0.5);

      float vig = smoothstep(0.38, 0.9, length(d) * 1.14);
      col *= 1.0 - vig * uVignette;
      float n = hash(uv * vec2(1919.7, 1080.3) + fract(uTime) * 97.0) - 0.5;
      col += n * uGrain;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType,
      samples: 0,
    });
    this.composer = new EffectComposer(renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.46, 0.5, 0.86);
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    this.grade = new ShaderPass(GradeShader);
    this.grade.renderToScreen = true;
    this.composer.addPass(this.grade);
    this.aberration = 0;
    this.time = 0;
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  update(dt) {
    this.time += dt;
    this.grade.uniforms.uTime.value = this.time;
    this.aberration *= Math.pow(0.001, dt);
    this.grade.uniforms.uAberration.value = this.aberration;
    this.composer.render(dt);
  }

  punch(amount = 0.6) {
    this.aberration = Math.min(1.2, this.aberration + amount);
  }
}
