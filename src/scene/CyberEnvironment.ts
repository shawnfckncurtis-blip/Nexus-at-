import * as THREE from 'three';
import * as xb from 'xrblocks';

import {
  createCyberGridMaterial,
  createDataRainMaterial,
  createSkylineMaterial,
} from '../shaders/cyberShaders.ts';
import type {CyberFxStore} from '../state/CyberFxStore.ts';
import type {CyberXRMode} from '../types.ts';

const TOWER_COUNT = 56;
const PARTICLE_COUNT = 650;
const _dummy = new THREE.Object3D();
const _targetFogColor = new THREE.Color();

/**
 * Manages the cyberpunk spatial stage:
 * - Anti-aliased synthwave cyber-grid floor with radial surge waves
 * - Procedural distant VR skyline monoliths (InstancedMesh)
 * - GPU-animated digital data rain particles
 * - Smooth AR Passthrough <-> VR Cyberspace transitions
 */
export class CyberEnvironment extends xb.Script {
  private readonly store: CyberFxStore;

  private gridMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private gridMaterial!: THREE.ShaderMaterial;

  private skylineMesh!: THREE.InstancedMesh<
    THREE.BufferGeometry,
    THREE.ShaderMaterial
  >;
  private skylineMaterial!: THREE.ShaderMaterial;

  private dataRainPoints!: THREE.Points<
    THREE.BufferGeometry,
    THREE.ShaderMaterial
  >;
  private dataRainMaterial!: THREE.ShaderMaterial;

  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.PointLight;

  private vrFog: THREE.FogExp2 | null = null;
  private activeXRMode: CyberXRMode | null = null;
  private activePresetId: string | null = null;
  private skylineOpacity = 0;
  private simTime = 0;
  private sessionActive = false;

  constructor(store: CyberFxStore) {
    super();
    this.store = store;
    this.name = 'Cyber Environment';
    this.buildLights();
    this.buildFloorGrid();
    this.buildSkyline();
    this.buildDataRain();
  }

  private buildLights(): void {
    this.hemiLight = new THREE.HemisphereLight(0x90d5ff, 0x1a0933, 1.8);
    this.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.keyLight.position.set(2.5, 4.5, 2.0);
    this.add(this.keyLight);

    this.rimLight = new THREE.PointLight(
      this.store.secondaryColor.getHex(),
      2.0,
      10
    );
    this.rimLight.position.set(-1.6, 2.2, -1.8);
    this.add(this.rimLight);
  }

  private buildFloorGrid(): void {
    const gridGeo = new THREE.CircleGeometry(26, 64);
    gridGeo.rotateX(-Math.PI / 2);
    this.gridMaterial = createCyberGridMaterial(
      this.store.primaryColor,
      this.store.secondaryColor,
      this.store.accentColor
    );
    this.gridMesh = new THREE.Mesh(gridGeo, this.gridMaterial);
    this.gridMesh.position.y = 0.002;
    this.gridMesh.name = 'Cyber Grid Floor';
    this.gridMesh.xb = {pointerEvents: 'none'};
    this.add(this.gridMesh);
  }

  private buildSkyline(): void {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.skylineMaterial = createSkylineMaterial(
      this.store.primaryColor,
      this.store.secondaryColor
    );
    this.skylineMesh = new THREE.InstancedMesh(
      boxGeo,
      this.skylineMaterial,
      TOWER_COUNT
    );
    this.skylineMesh.name = 'Cyber Skyline';
    this.skylineMesh.xb = {pointerEvents: 'none'};
    this.skylineMesh.frustumCulled = false;

    for (let i = 0; i < TOWER_COUNT; i++) {
      const ring = i < 28 ? 0 : 1;
      const angle =
        ((i % 28) / 28) * Math.PI * 2 + (ring === 1 ? 0.11 : 0) + (i % 3) * 0.04;
      const radius = ring === 0 ? 12.5 + (i % 5) * 1.4 : 18.5 + (i % 4) * 1.8;
      const width = 1.1 + ((i * 7) % 5) * 0.38;
      const depth = 1.1 + ((i * 11) % 5) * 0.35;
      const height =
        ring === 0 ? 4.5 + ((i * 13) % 7) * 1.3 : 8.0 + ((i * 17) % 8) * 1.6;

      _dummy.position.set(
        Math.cos(angle) * radius,
        height * 0.5,
        Math.sin(angle) * radius
      );
      _dummy.rotation.set(0, -angle, 0);
      _dummy.scale.set(width, height, depth);
      _dummy.updateMatrix();
      this.skylineMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.skylineMesh.instanceMatrix.needsUpdate = true;
    this.skylineMesh.computeBoundingSphere();
    this.add(this.skylineMesh);
  }

  private buildDataRain(): void {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const speeds = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);
    const seeds = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.4 + Math.random() * 8.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 5.4;
      positions[i * 3 + 2] = Math.sin(angle) * radius - 0.6;

      speeds[i] = 0.35 + Math.random() * 0.95;
      phases[i] = Math.random();
      seeds[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.dataRainMaterial = createDataRainMaterial(
      this.store.primaryColor,
      this.store.secondaryColor
    );
    this.dataRainPoints = new THREE.Points(geometry, this.dataRainMaterial);
    this.dataRainPoints.name = 'Cyber Data Rain';
    this.dataRainPoints.frustumCulled = false;
    this.dataRainPoints.xb = {pointerEvents: 'none'};
    this.add(this.dataRainPoints);
  }

  init(): void {
    this.applyXRMode(true);
  }

  onXRSessionStarted(): void {
    this.sessionActive = true;
    this.applyXRMode(true);
  }

  onSimulatorStarted(): void {
    this.sessionActive = true;
    this.applyXRMode(true);
  }

  onXRSessionEnded(): void {
    this.sessionActive = false;
  }

  private applyXRMode(force = false): void {
    const settings = this.store.getSettings();
    const preset = this.store.getPreset();
    if (
      !force &&
      this.activeXRMode === settings.xrMode &&
      this.activePresetId === preset.id
    ) {
      return;
    }
    this.activeXRMode = settings.xrMode;
    this.activePresetId = preset.id;

    if (settings.xrMode === 'VR') {
      if (!this.vrFog) {
        this.vrFog = new THREE.FogExp2(preset.fogHex, 0.032);
      } else {
        this.vrFog.color.setHex(preset.fogHex);
      }
      xb.core.scene.fog = this.vrFog;
      if (this.sessionActive) {
        xb.core.transition?.toVR({color: preset.vrBgHex});
      }
    } else {
      xb.core.scene.fog = null;
      if (this.sessionActive) {
        xb.core.transition?.toAR();
      }
    }
  }

  update(): void {
    const dt = Math.min(xb.getDeltaTime(), 0.1);
    this.store.step(dt);

    const settings = this.store.getSettings();
    const preset = this.store.getPreset();
    this.simTime += dt * (0.4 + settings.pulseSpeed * 0.85);

    this.applyXRMode(false);

    // Smoothly fade skyline towers between VR (1.0) and AR (0.0)
    const targetSkylineOpacity = settings.xrMode === 'VR' ? 0.96 : 0.0;
    this.skylineOpacity = THREE.MathUtils.damp(
      this.skylineOpacity,
      targetSkylineOpacity,
      6.5,
      dt
    );
    this.skylineMesh.visible = this.skylineOpacity > 0.02;

    if (this.vrFog && settings.xrMode === 'VR') {
      _targetFogColor.setHex(preset.fogHex);
      this.vrFog.color.lerp(_targetFogColor, 1 - Math.exp(-6 * dt));
    }

    // Update Cyber-Grid Floor uniforms
    this.gridMaterial.uniforms.uTime.value = this.simTime;
    (this.gridMaterial.uniforms.uPrimary.value as THREE.Color).copy(
      this.store.primaryColor
    );
    (this.gridMaterial.uniforms.uSecondary.value as THREE.Color).copy(
      this.store.secondaryColor
    );
    (this.gridMaterial.uniforms.uAccent.value as THREE.Color).copy(
      this.store.accentColor
    );
    this.gridMaterial.uniforms.uGridScale.value = settings.gridScale;
    this.gridMaterial.uniforms.uGlow.value = settings.glowIntensity;
    this.gridMaterial.uniforms.uGlitch.value = settings.glitchIntensity;
    this.gridMaterial.uniforms.uSurgeRadius.value = this.store.surgeWaveRadius;
    this.gridMaterial.uniforms.uSurgeIntensity.value =
      this.store.surgeIntensity;
    (this.gridMaterial.uniforms.uSurgeOrigin.value as THREE.Vector3).copy(
      this.store.surgeOrigin
    );
    this.gridMaterial.uniforms.uOpacityScale.value =
      settings.xrMode === 'VR' ? 1.0 : 0.72;

    // Update Skyline uniforms
    this.skylineMaterial.uniforms.uTime.value = this.simTime;
    (this.skylineMaterial.uniforms.uPrimary.value as THREE.Color).copy(
      this.store.primaryColor
    );
    (this.skylineMaterial.uniforms.uSecondary.value as THREE.Color).copy(
      this.store.secondaryColor
    );
    this.skylineMaterial.uniforms.uGlow.value = settings.glowIntensity;
    this.skylineMaterial.uniforms.uOpacity.value = this.skylineOpacity;
    this.skylineMaterial.wireframe = settings.wireframeMode;

    // Update Data Rain uniforms
    this.dataRainMaterial.uniforms.uTime.value = this.simTime;
    (this.dataRainMaterial.uniforms.uPrimary.value as THREE.Color).copy(
      this.store.primaryColor
    );
    (this.dataRainMaterial.uniforms.uSecondary.value as THREE.Color).copy(
      this.store.secondaryColor
    );
    this.dataRainMaterial.uniforms.uDensity.value = settings.particleDensity;
    this.dataRainMaterial.uniforms.uGlow.value = settings.glowIntensity;
    this.dataRainMaterial.uniforms.uGlitch.value = settings.glitchIntensity;
    this.dataRainPoints.visible = settings.particleDensity > 0.02;

    // Update Rim Light
    this.rimLight.color.copy(this.store.secondaryColor);
    this.rimLight.intensity =
      1.2 + settings.glowIntensity * 1.8 + this.store.surgeIntensity * 2.5;
  }

  dispose(): void {
    xb.core.scene.fog = null;
    this.gridMesh.geometry.dispose();
    this.gridMaterial.dispose();
    this.skylineMesh.geometry.dispose();
    this.skylineMaterial.dispose();
    this.dataRainPoints.geometry.dispose();
    this.dataRainMaterial.dispose();
  }
}
