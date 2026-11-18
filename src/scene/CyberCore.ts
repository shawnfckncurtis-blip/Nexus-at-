import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import * as xb from 'xrblocks';

import type {CyberAudio} from '../audio/CyberAudio.ts';
import {
  createHoloCoreMaterial,
  createShockwaveMaterial,
} from '../shaders/cyberShaders.ts';
import type {CyberFxStore} from '../state/CyberFxStore.ts';

const FIN_COUNT = 8;
const _dummy = new THREE.Object3D();
const _worldPos = new THREE.Vector3();

/**
 * Interactive multi-part procedural cybernetic reactor core.
 * Supports full XR manipulation (grab, move, scale) and emits energy
 * shockwaves when pinched, touched, or clicked.
 */
export class CyberCore extends xb.Script {
  private readonly store: CyberFxStore;
  private readonly audio: CyberAudio;

  private readonly homePosition = new THREE.Vector3(0, 1.38, -1.16);

  private coreMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private coreMaterial!: THREE.ShaderMaterial;
  private cageMesh!: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshBasicMaterial
  >;
  private cageMaterial!: THREE.MeshBasicMaterial;

  private armorRingMesh!: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >;
  private armorMaterial!: THREE.MeshStandardMaterial;

  private trimRingMesh!: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >;
  private trimMaterial!: THREE.MeshStandardMaterial;

  private innerGyro!: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >;
  private innerGyroMaterial!: THREE.MeshStandardMaterial;

  private outerGyro!: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >;
  private outerGyroMaterial!: THREE.MeshStandardMaterial;

  private emitterFins!: THREE.InstancedMesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >;
  private finMaterial!: THREE.MeshStandardMaterial;

  private shockwaveMesh!: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.ShaderMaterial
  >;
  private shockwaveMaterial!: THREE.ShaderMaterial;

  private coreLight!: THREE.PointLight;
  private pmremEnvTexture: THREE.Texture | null = null;

  private simTime = 0;
  private shockwaveProgress = 1;
  private unsubscribeReset: (() => void) | null = null;
  private unsubscribeSurge: (() => void) | null = null;

  constructor(store: CyberFxStore, audio: CyberAudio) {
    super();
    this.store = store;
    this.audio = audio;
    this.name = 'Cybernetic Core';
    this.position.copy(this.homePosition);
    this.xb = {
      manipulation: {
        actions: {
          translate: {faceCamera: false},
          rotate: {axis: 'y', space: 'world'},
          scale: {minScale: 0.45, maxScale: 2.2},
        },
      },
    };
    this.buildCompositeArtifact();
  }

  private buildCompositeArtifact(): void {
    // 1. Inner Holographic Shader Core
    const coreGeo = new THREE.IcosahedronGeometry(0.125, 3);
    this.coreMaterial = createHoloCoreMaterial(
      this.store.primaryColor,
      this.store.secondaryColor,
      this.store.accentColor
    );
    this.coreMesh = new THREE.Mesh(coreGeo, this.coreMaterial);
    this.coreMesh.name = 'Holo Core';
    this.add(this.coreMesh);

    // 2. Wireframe Telemetry Cage
    const cageGeo = new THREE.IcosahedronGeometry(0.158, 1);
    this.cageMaterial = new THREE.MeshBasicMaterial({
      color: this.store.primaryColor,
      wireframe: true,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.cageMesh = new THREE.Mesh(cageGeo, this.cageMaterial);
    this.cageMesh.name = 'Telemetry Cage';
    this.add(this.cageMesh);

    // 3. Beveled Octagonal Dark-Titanium Containment Frame (ExtrudeGeometry)
    const outerRadius = 0.235;
    const innerRadius = 0.195;
    const frameShape = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * outerRadius;
      const y = Math.sin(a) * outerRadius;
      if (i === 0) frameShape.moveTo(x, y);
      else frameShape.lineTo(x, y);
    }
    frameShape.closePath();

    const holePath = new THREE.Path();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * innerRadius;
      const y = Math.sin(a) * innerRadius;
      if (i === 0) holePath.moveTo(x, y);
      else holePath.lineTo(x, y);
    }
    holePath.closePath();
    frameShape.holes.push(holePath);

    const armorGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.005,
      bevelSegments: 2,
    });
    armorGeo.center();

    this.armorMaterial = new THREE.MeshStandardMaterial({
      color: 0x121826,
      metalness: 0.92,
      roughness: 0.22,
    });
    this.armorRingMesh = new THREE.Mesh(armorGeo, this.armorMaterial);
    this.armorRingMesh.name = 'Containment Frame';
    this.add(this.armorRingMesh);

    // 4. Inner Neon Trim Ring
    const trimGeo = new THREE.TorusGeometry(0.194, 0.005, 10, 48);
    this.trimMaterial = new THREE.MeshStandardMaterial({
      color: this.store.primaryColor,
      emissive: this.store.primaryColor,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.4,
    });
    this.trimRingMesh = new THREE.Mesh(trimGeo, this.trimMaterial);
    this.trimRingMesh.name = 'Neon Trim';
    this.add(this.trimRingMesh);

    // 5. Dual Counter-Rotating Gyroscopic Rings
    this.innerGyroMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b2438,
      emissive: this.store.secondaryColor,
      emissiveIntensity: 1.2,
      metalness: 0.85,
      roughness: 0.25,
    });
    this.innerGyro = new THREE.Mesh(
      new THREE.TorusGeometry(0.255, 0.007, 12, 64),
      this.innerGyroMaterial
    );
    this.innerGyro.rotation.x = Math.PI * 0.35;
    this.innerGyro.name = 'Inner Gyro Ring';
    this.add(this.innerGyro);

    this.outerGyroMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b2438,
      emissive: this.store.primaryColor,
      emissiveIntensity: 1.1,
      metalness: 0.88,
      roughness: 0.2,
    });
    this.outerGyro = new THREE.Mesh(
      new THREE.TorusGeometry(0.295, 0.006, 10, 64),
      this.outerGyroMaterial
    );
    this.outerGyro.rotation.y = Math.PI * 0.25;
    this.outerGyro.name = 'Outer Gyro Ring';
    this.add(this.outerGyro);

    // 6. 8 Instanced Orbital Emitter Fins
    const finShape = new THREE.Shape();
    finShape.moveTo(-0.012, -0.025);
    finShape.lineTo(0.014, -0.015);
    finShape.lineTo(0.008, 0.028);
    finShape.lineTo(-0.012, 0.02);
    finShape.closePath();

    const finGeo = new THREE.ExtrudeGeometry(finShape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 1,
    });
    finGeo.center();

    this.finMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b2235,
      emissive: this.store.secondaryColor,
      emissiveIntensity: 0.75,
      metalness: 0.9,
      roughness: 0.26,
    });

    this.emitterFins = new THREE.InstancedMesh(
      finGeo,
      this.finMaterial,
      FIN_COUNT
    );
    this.emitterFins.name = 'Orbital Emitter Fins';
    this.emitterFins.frustumCulled = false;
    this.updateEmitterFinMatrices(0, 0);
    this.emitterFins.computeBoundingSphere();
    this.add(this.emitterFins);

    // 7. Expanding Shockwave Ring
    const shockGeo = new THREE.RingGeometry(0.18, 0.24, 48, 1);
    this.shockwaveMaterial = createShockwaveMaterial(this.store.accentColor);
    this.shockwaveMesh = new THREE.Mesh(shockGeo, this.shockwaveMaterial);
    this.shockwaveMesh.rotation.x = -Math.PI / 2;
    this.shockwaveMesh.visible = false;
    this.shockwaveMesh.xb = {pointerEvents: 'none'};
    this.add(this.shockwaveMesh);

    // Local Core Glow Light
    this.coreLight = new THREE.PointLight(
      this.store.primaryColor.getHex(),
      2.2,
      3.5
    );
    this.add(this.coreLight);
  }

  init(): void {
    // Generate procedural studio reflections so metallic bevels gleam cleanly
    if (
      xb.core.renderer &&
      xb.core.renderer instanceof THREE.WebGLRenderer &&
      !xb.core.scene.environment
    ) {
      const pmrem = new THREE.PMREMGenerator(xb.core.renderer);
      this.pmremEnvTexture = pmrem.fromScene(
        new RoomEnvironment(),
        0.04
      ).texture;
      xb.core.scene.environment = this.pmremEnvTexture;
      pmrem.dispose();
    }

    this.unsubscribeReset = this.store.onReset(() => {
      this.position.copy(this.homePosition);
      this.rotation.set(0, 0, 0);
      this.scale.setScalar(1);
    });

    this.unsubscribeSurge = this.store.onSurge(() => {
      this.shockwaveProgress = 0;
      this.shockwaveMesh.visible = true;
    });
  }

  onObjectSelectStart(event: xb.SelectEvent): void {
    this.triggerCorePulse();
    event.stopPropagation();
  }

  onObjectTouchStart(event: xb.SelectEvent): void {
    this.triggerCorePulse();
    event.stopPropagation();
  }

  private triggerCorePulse(): void {
    this.getWorldPosition(_worldPos);
    this.store.triggerSurge(_worldPos);
    this.audio.playSurge();
  }

  update(): void {
    const dt = Math.min(xb.getDeltaTime(), 0.1);
    const settings = this.store.getSettings();
    const speed = settings.pulseSpeed;
    const surge = this.store.surgeIntensity;
    this.simTime += dt * (0.65 + speed * 1.15);

    // Update holographic core uniforms
    this.coreMaterial.uniforms.uTime.value = this.simTime;
    (this.coreMaterial.uniforms.uPrimary.value as THREE.Color).copy(
      this.store.primaryColor
    );
    (this.coreMaterial.uniforms.uSecondary.value as THREE.Color).copy(
      this.store.secondaryColor
    );
    (this.coreMaterial.uniforms.uAccent.value as THREE.Color).copy(
      this.store.accentColor
    );
    this.coreMaterial.uniforms.uGlitch.value = settings.glitchIntensity;
    this.coreMaterial.uniforms.uGlow.value = settings.glowIntensity;
    this.coreMaterial.uniforms.uSurge.value = surge;

    // Gentle hover float when not actively manipulated
    const hoverOffset = Math.sin(this.simTime * 1.4) * 0.008;
    this.coreMesh.position.y = hoverOffset;
    this.cageMesh.position.y = hoverOffset;

    // Rotate inner core and telemetry cage
    const spinRate = dt * (0.45 + speed * 0.9 + surge * 2.5);
    this.coreMesh.rotation.y += spinRate * 0.65;
    this.coreMesh.rotation.x += spinRate * 0.25;
    this.cageMesh.rotation.y -= spinRate * 0.85;
    this.cageMesh.rotation.z += spinRate * 0.35;

    // Rotate containment frame & gyroscopes
    this.armorRingMesh.rotation.z += dt * (0.18 + speed * 0.25);
    this.trimRingMesh.rotation.z = this.armorRingMesh.rotation.z;
    this.innerGyro.rotation.x += dt * (0.7 + speed * 1.1);
    this.innerGyro.rotation.y += dt * (0.4 + speed * 0.6);
    this.outerGyro.rotation.y -= dt * (0.55 + speed * 0.85);
    this.outerGyro.rotation.z += dt * (0.35 + speed * 0.5);

    // Update orbital emitter fins
    this.updateEmitterFinMatrices(this.simTime, surge);

    // Update PBR material colors, wireframe mode, and emissive glow
    const glowFactor = 0.35 + settings.glowIntensity * 1.85 + surge * 2.0;
    this.cageMaterial.color.copy(this.store.primaryColor);
    this.cageMaterial.opacity = 0.25 + settings.glowIntensity * 0.45;

    this.armorMaterial.wireframe = settings.wireframeMode;
    this.innerGyroMaterial.wireframe = settings.wireframeMode;
    this.outerGyroMaterial.wireframe = settings.wireframeMode;
    this.finMaterial.wireframe = settings.wireframeMode;

    this.trimMaterial.color.copy(this.store.primaryColor);
    this.trimMaterial.emissive.copy(this.store.primaryColor);
    this.trimMaterial.emissiveIntensity = glowFactor;

    this.innerGyroMaterial.emissive.copy(this.store.secondaryColor);
    this.innerGyroMaterial.emissiveIntensity = glowFactor * 0.85;

    this.outerGyroMaterial.emissive.copy(this.store.primaryColor);
    this.outerGyroMaterial.emissiveIntensity = glowFactor * 0.8;

    this.finMaterial.emissive.copy(this.store.secondaryColor);
    this.finMaterial.emissiveIntensity = glowFactor * 0.65;

    this.coreLight.color.copy(this.store.primaryColor);
    this.coreLight.intensity = 1.0 + settings.glowIntensity * 2.0 + surge * 3.5;

    // Advance expanding shockwave ring
    if (this.shockwaveProgress < 1) {
      this.shockwaveProgress = Math.min(1, this.shockwaveProgress + dt * 1.65);
      const waveScale = 1 + this.shockwaveProgress * 5.2;
      this.shockwaveMesh.scale.setScalar(waveScale);
      (this.shockwaveMaterial.uniforms.uColor.value as THREE.Color).copy(
        this.store.accentColor
      );
      this.shockwaveMaterial.uniforms.uProgress.value = this.shockwaveProgress;
      this.shockwaveMaterial.uniforms.uGlow.value = settings.glowIntensity;
      if (this.shockwaveProgress >= 1) {
        this.shockwaveMesh.visible = false;
      }
    }
  }

  private updateEmitterFinMatrices(time: number, surge: number): void {
    const orbitRadius = 0.325 + surge * 0.055;
    for (let i = 0; i < FIN_COUNT; i++) {
      const angle = (i / FIN_COUNT) * Math.PI * 2 + time * 0.45;
      const bob = Math.sin(time * 2.2 + i * 0.9) * 0.025;
      _dummy.position.set(
        Math.cos(angle) * orbitRadius,
        bob,
        Math.sin(angle) * orbitRadius
      );
      _dummy.rotation.set(
        Math.sin(time + i) * 0.22,
        -angle + Math.PI / 2,
        0.35 + surge * 0.4
      );
      _dummy.scale.setScalar(1 + surge * 0.25);
      _dummy.updateMatrix();
      this.emitterFins.setMatrixAt(i, _dummy.matrix);
    }
    this.emitterFins.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.unsubscribeReset?.();
    this.unsubscribeSurge?.();
    this.coreMesh.geometry.dispose();
    this.coreMaterial.dispose();
    this.cageMesh.geometry.dispose();
    this.cageMaterial.dispose();
    this.armorRingMesh.geometry.dispose();
    this.armorMaterial.dispose();
    this.trimRingMesh.geometry.dispose();
    this.trimMaterial.dispose();
    this.innerGyro.geometry.dispose();
    this.innerGyroMaterial.dispose();
    this.outerGyro.geometry.dispose();
    this.outerGyroMaterial.dispose();
    this.emitterFins.geometry.dispose();
    this.finMaterial.dispose();
    this.shockwaveMesh.geometry.dispose();
    this.shockwaveMaterial.dispose();
    if (this.pmremEnvTexture) {
      if (xb.core.scene.environment === this.pmremEnvTexture) {
        xb.core.scene.environment = null;
      }
      this.pmremEnvTexture.dispose();
      this.pmremEnvTexture = null;
    }
  }
}
