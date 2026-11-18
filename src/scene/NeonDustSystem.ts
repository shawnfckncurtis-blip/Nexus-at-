import * as THREE from 'three';
import * as xb from 'xrblocks';

import {createNeonDustMaterial} from '../shaders/cyberShaders.ts';
import type {CyberFxStore} from '../state/CyberFxStore.ts';

const DUST_COUNT = 850;
const VOLUME_HALF_XZ = 3.8;
const VOLUME_SPAN_XZ = VOLUME_HALF_XZ * 2;
const MIN_Y = 0.08;
const MAX_Y = 3.25;
const MAX_EFFECTORS = 6;

interface MovementEffector {
  active: boolean;
  initialized: boolean;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  radius: number;
  strength: number;
}

const _headPos = new THREE.Vector3();
const _tempPos = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();

/**
 * Background ambient particle system that continuously spawns slow-moving,
 * glowing neon dust motes around the user and reacts fluidly to head,
 * hand, controller, and desktop pointer movement in XR space.
 */
export class NeonDustSystem extends xb.Script {
  private readonly store: CyberFxStore;

  private dustPoints!: THREE.Points<
    THREE.BufferGeometry,
    THREE.ShaderMaterial
  >;
  private dustMaterial!: THREE.ShaderMaterial;

  private positions!: Float32Array;
  private velocities!: Float32Array;
  private phases!: Float32Array;
  private seeds!: Float32Array;
  private sizes!: Float32Array;
  private energies!: Float32Array;
  private lives!: Float32Array;
  private lifeRates!: Float32Array;

  private positionAttr!: THREE.BufferAttribute;
  private energyAttr!: THREE.BufferAttribute;
  private lifeAttr!: THREE.BufferAttribute;

  private effectors: MovementEffector[] = [];
  private pointerActiveUntil = 0;
  private simTime = 0;
  private lastSurgeHandled = 0;

  private readonly onWindowPointerMove = (event: PointerEvent): void => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    _pointerNdc.set((event.clientX / w) * 2 - 1, -(event.clientY / h) * 2 + 1);
    _raycaster.setFromCamera(_pointerNdc, xb.core.camera);
    _tempPos
      .copy(_raycaster.ray.origin)
      .addScaledVector(_raycaster.ray.direction, 1.35);

    const pointerEffector = this.effectors[5];
    if (pointerEffector) {
      pointerEffector.pos.copy(_tempPos);
      pointerEffector.active = true;
      this.pointerActiveUntil = performance.now() + 350;
    }
  };

  constructor(store: CyberFxStore) {
    super();
    this.store = store;
    this.name = 'Neon Dust System';

    for (let i = 0; i < MAX_EFFECTORS; i++) {
      this.effectors.push({
        active: false,
        initialized: false,
        pos: new THREE.Vector3(),
        prevPos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        radius: i === 0 ? 1.1 : 0.65,
        strength: i === 0 ? 1.05 : 1.65,
      });
    }

    this.buildParticles();
  }

  private buildParticles(): void {
    this.positions = new Float32Array(DUST_COUNT * 3);
    this.velocities = new Float32Array(DUST_COUNT * 3);
    this.phases = new Float32Array(DUST_COUNT);
    this.seeds = new Float32Array(DUST_COUNT);
    this.sizes = new Float32Array(DUST_COUNT);
    this.energies = new Float32Array(DUST_COUNT);
    this.lives = new Float32Array(DUST_COUNT);
    this.lifeRates = new Float32Array(DUST_COUNT);

    for (let i = 0; i < DUST_COUNT; i++) {
      this.spawnParticle(i, 0, 0, true);
      this.phases[i] = Math.random();
      this.seeds[i] = Math.random();
      this.sizes[i] = 0.55 + Math.random() * 0.95;
      this.energies[i] = 0;
      this.lives[i] = Math.random();
      this.lifeRates[i] = 1 / (9 + Math.random() * 10);
    }

    const geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(this.positions, 3);
    this.positionAttr.setUsage(THREE.DynamicDrawUsage);
    this.energyAttr = new THREE.BufferAttribute(this.energies, 1);
    this.energyAttr.setUsage(THREE.DynamicDrawUsage);
    this.lifeAttr = new THREE.BufferAttribute(this.lives, 1);
    this.lifeAttr.setUsage(THREE.DynamicDrawUsage);

    geometry.setAttribute('position', this.positionAttr);
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(this.phases, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(this.seeds, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('aEnergy', this.energyAttr);
    geometry.setAttribute('aLife', this.lifeAttr);

    this.dustMaterial = createNeonDustMaterial(
      this.store.primaryColor,
      this.store.secondaryColor,
      this.store.accentColor
    );

    this.dustPoints = new THREE.Points(geometry, this.dustMaterial);
    this.dustPoints.name = 'Neon Dust Motes';
    this.dustPoints.frustumCulled = false;
    this.dustPoints.xb = {pointerEvents: 'none'};
    this.add(this.dustPoints);
  }

  private spawnParticle(
    index: number,
    centerX: number,
    centerZ: number,
    initial: boolean
  ): void {
    const i3 = index * 3;
    this.positions[i3] = centerX + (Math.random() * 2 - 1) * VOLUME_HALF_XZ;
    this.positions[i3 + 1] = MIN_Y + Math.random() * (MAX_Y - MIN_Y);
    this.positions[i3 + 2] =
      centerZ + (Math.random() * 2 - 1) * VOLUME_HALF_XZ;

    // Slow tranquil ambient velocity
    this.velocities[i3] = (Math.random() - 0.5) * 0.035;
    this.velocities[i3 + 1] = 0.008 + Math.random() * 0.024;
    this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.035;

    this.energies[index] = initial ? 0 : 0.35;
    this.lives[index] = initial ? Math.random() : 0;
  }

  init(): void {
    window.addEventListener('pointermove', this.onWindowPointerMove, {
      passive: true,
    });
  }

  private updateEffectors(dt: number): void {
    const safeDt = Math.max(dt, 0.001);

    // 0: Head / Camera position
    xb.core.camera.getWorldPosition(_headPos);
    const headEff = this.effectors[0];
    headEff.pos.copy(_headPos);
    headEff.active = true;

    // 1 & 2: Tracked Hand Index Tips
    const hands = xb.core.user.hands;
    const leftTip = hands?.getIndexTip(xb.Handedness.LEFT);
    const rightTip = hands?.getIndexTip(xb.Handedness.RIGHT);

    if (leftTip && leftTip.visible) {
      leftTip.getWorldPosition(this.effectors[1].pos);
      this.effectors[1].active = true;
    } else {
      this.effectors[1].active = false;
      this.effectors[1].initialized = false;
    }

    if (rightTip && rightTip.visible) {
      rightTip.getWorldPosition(this.effectors[2].pos);
      this.effectors[2].active = true;
    } else {
      this.effectors[2].active = false;
      this.effectors[2].initialized = false;
    }

    // 3 & 4: XR Controllers
    const controllers = xb.core.input.controllers;
    for (let c = 0; c < 2; c++) {
      const eff = this.effectors[3 + c];
      const ctrl = controllers[c];
      if (ctrl && ctrl.visible) {
        ctrl.getWorldPosition(eff.pos);
        eff.active = true;
      } else {
        eff.active = false;
        eff.initialized = false;
      }
    }

    // 5: Desktop Pointer Wake timeout
    if (performance.now() > this.pointerActiveUntil) {
      this.effectors[5].active = false;
      this.effectors[5].initialized = false;
    }

    // Compute clamped instantaneous velocities
    for (let i = 0; i < MAX_EFFECTORS; i++) {
      const eff = this.effectors[i];
      if (!eff.active) {
        eff.vel.set(0, 0, 0);
        continue;
      }
      if (!eff.initialized) {
        eff.prevPos.copy(eff.pos);
        eff.vel.set(0, 0, 0);
        eff.initialized = true;
      } else {
        eff.vel.subVectors(eff.pos, eff.prevPos).divideScalar(safeDt);
        const speed = eff.vel.length();
        if (speed > 4.5) {
          eff.vel.multiplyScalar(4.5 / speed);
        }
        eff.prevPos.copy(eff.pos);
      }
    }
  }

  update(): void {
    const dt = Math.min(xb.getDeltaTime(), 0.05);
    if (dt <= 0) return;

    const settings = this.store.getSettings();
    const surge = this.store.surgeIntensity;
    this.simTime += dt * (0.6 + settings.pulseSpeed * 0.5);

    this.updateEffectors(dt);

    // Trigger outward burst impulse once per plasma surge
    const surgeTriggered = surge > 0.85 && this.lastSurgeHandled <= 0.85;
    this.lastSurgeHandled = surge;

    const drag = Math.exp(-2.1 * dt);
    const energyDecay = Math.exp(-1.8 * dt);
    const driftScale = 0.65 + settings.pulseSpeed * 0.45;
    const surgeOrigin = this.store.surgeOrigin;

    for (let i = 0; i < DUST_COUNT; i++) {
      // 1. Lifecycle progression & background spawning
      this.lives[i] += this.lifeRates[i] * dt;
      if (this.lives[i] >= 1) {
        this.spawnParticle(i, _headPos.x, _headPos.z, false);
      }

      const i3 = i * 3;
      let px = this.positions[i3];
      let py = this.positions[i3 + 1];
      let pz = this.positions[i3 + 2];

      let vx = this.velocities[i3];
      let vy = this.velocities[i3 + 1];
      let vz = this.velocities[i3 + 2];

      // 2. Slow organic harmonic drift
      const p = this.phases[i] * 6.28318;
      vx += Math.sin(this.simTime * 0.55 + p + py * 1.2) * 0.028 * driftScale * dt;
      vy += (0.014 + Math.cos(this.simTime * 0.4 + p) * 0.012) * driftScale * dt;
      vz += Math.cos(this.simTime * 0.5 + p + px * 1.1) * 0.028 * driftScale * dt;

      // 3. React to user movement effectors (head, hands, controllers, pointer)
      let energy = this.energies[i] * energyDecay;

      for (let e = 0; e < MAX_EFFECTORS; e++) {
        const eff = this.effectors[e];
        if (!eff.active) continue;

        const dx = px - eff.pos.x;
        const dy = py - eff.pos.y;
        const dz = pz - eff.pos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const r = eff.radius;

        if (distSq < r * r && distSq > 1e-5) {
          const dist = Math.sqrt(distSq);
          const falloff = 1 - dist / r;
          const weight = falloff * falloff;

          // Keep a soft personal comfort bubble near the headset camera
          if (e === 0 && dist < 0.42) {
            const push = (0.42 - dist) * 2.4 * dt;
            vx += (dx / dist) * push;
            vy += (dy / dist) * push;
            vz += (dz / dist) * push;
          }

          const effSpeed = eff.vel.length();
          if (effSpeed > 0.04) {
            const pushScale = eff.strength * weight * dt;
            // Wake drags motes along movement + swirls radially outward
            vx += eff.vel.x * pushScale * 0.85 + (dx / dist) * effSpeed * pushScale * 0.45;
            vy += eff.vel.y * pushScale * 0.85 + (dy / dist) * effSpeed * pushScale * 0.35;
            vz += eff.vel.z * pushScale * 0.85 + (dz / dist) * effSpeed * pushScale * 0.45;
            energy = Math.min(1, energy + effSpeed * weight * 0.55);
          }
        }
      }

      // 4. React to Core plasma surge shockwave
      if (surgeTriggered) {
        const sdx = px - surgeOrigin.x;
        const sdy = py - surgeOrigin.y;
        const sdz = pz - surgeOrigin.z;
        const sDist = Math.sqrt(sdx * sdx + sdy * sdy + sdz * sdz);
        if (sDist < 2.6 && sDist > 0.02) {
          const sForce = (1 - sDist / 2.6) * 0.9;
          vx += (sdx / sDist) * sForce;
          vy += (sdy / sDist) * sForce * 0.6;
          vz += (sdz / sDist) * sForce;
          energy = Math.min(1, energy + 0.75);
        }
      }

      // 5. Viscous air damping & position integration
      vx *= drag;
      vy *= drag;
      vz *= drag;

      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;

      // Wrap smoothly inside user-centered XR volume
      const relX = px - _headPos.x;
      if (relX > VOLUME_HALF_XZ) px -= VOLUME_SPAN_XZ;
      else if (relX < -VOLUME_HALF_XZ) px += VOLUME_SPAN_XZ;

      const relZ = pz - _headPos.z;
      if (relZ > VOLUME_HALF_XZ) pz -= VOLUME_SPAN_XZ;
      else if (relZ < -VOLUME_HALF_XZ) pz += VOLUME_SPAN_XZ;

      if (py > MAX_Y) py = MIN_Y + 0.05;
      else if (py < MIN_Y) py = MAX_Y - 0.05;

      this.positions[i3] = px;
      this.positions[i3 + 1] = py;
      this.positions[i3 + 2] = pz;

      this.velocities[i3] = vx;
      this.velocities[i3 + 1] = vy;
      this.velocities[i3 + 2] = vz;

      this.energies[i] = energy;
    }

    this.positionAttr.needsUpdate = true;
    this.energyAttr.needsUpdate = true;
    this.lifeAttr.needsUpdate = true;

    // Update shader uniforms
    this.dustMaterial.uniforms.uTime.value = this.simTime;
    (this.dustMaterial.uniforms.uPrimary.value as THREE.Color).copy(
      this.store.primaryColor
    );
    (this.dustMaterial.uniforms.uSecondary.value as THREE.Color).copy(
      this.store.secondaryColor
    );
    (this.dustMaterial.uniforms.uAccent.value as THREE.Color).copy(
      this.store.accentColor
    );
    this.dustMaterial.uniforms.uDensity.value =
      0.25 + settings.particleDensity * 0.75;
    this.dustMaterial.uniforms.uGlow.value = settings.glowIntensity;
    this.dustMaterial.uniforms.uSurge.value = surge;
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onWindowPointerMove);
    this.dustPoints.geometry.dispose();
    this.dustMaterial.dispose();
  }
}
