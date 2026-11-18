import * as THREE from 'three';

export interface HoloFloatConfig {
  readonly phaseOffset?: number;
  readonly ampX?: number;
  readonly ampY?: number;
  readonly ampZ?: number;
  readonly baseFreq?: number;
  readonly tiltPitch?: number;
  readonly tiltRoll?: number;
}

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _invQuat = new THREE.Quaternion();
const _nextQuat = new THREE.Quaternion();
const _nextOffset = new THREE.Vector3();

/**
 * Reusable continuous sine-wave levitation helper producing a pronounced
 * Lissajous figure-eight drift with gentle pitch/roll sway.
 * Uses delta-offset composition so manipulable XR cards float continuously
 * around any user-dragged pose without snapping back.
 */
export class HoloFloatController {
  private readonly phaseOffset: number;
  private readonly ampX: number;
  private readonly ampY: number;
  private readonly ampZ: number;
  private readonly baseFreq: number;
  private readonly tiltPitch: number;
  private readonly tiltRoll: number;

  private elapsed = 0;
  private readonly prevOffset = new THREE.Vector3();
  private readonly prevTilt = new THREE.Quaternion();

  constructor(config: HoloFloatConfig = {}) {
    this.phaseOffset = config.phaseOffset ?? 0;
    this.ampX = config.ampX ?? 0.015;
    this.ampY = config.ampY ?? 0.022;
    this.ampZ = config.ampZ ?? 0.008;
    this.baseFreq = config.baseFreq ?? 1.55;
    this.tiltPitch = config.tiltPitch ?? 0.016;
    this.tiltRoll = config.tiltRoll ?? 0.014;
  }

  /**
   * Advances internal harmonic time and outputs the current figure-eight
   * XYZ offset vector without modifying an object directly.
   */
  computeOffset(
    out: THREE.Vector3,
    dt: number,
    speedMultiplier = 1,
    surge = 0
  ): THREE.Vector3 {
    const safeDt = Math.min(Math.max(dt, 0), 0.1);
    const rate = this.baseFreq * (speedMultiplier + surge * 0.45);
    this.elapsed += safeDt * rate;

    const theta = this.elapsed + this.phaseOffset;
    const surgeAmp = 1 + surge * 0.25;

    out.set(
      Math.sin(theta * 0.5) * this.ampX * surgeAmp,
      Math.sin(theta) * this.ampY * surgeAmp,
      Math.cos(theta * 0.5) * this.ampZ * surgeAmp
    );
    return out;
  }

  /**
   * Applies continuous figure-eight position and micro-tilt deltas to an Object3D.
   */
  applyTo(
    target: THREE.Object3D,
    dt: number,
    speedMultiplier = 1,
    surge = 0
  ): void {
    this.computeOffset(_nextOffset, dt, speedMultiplier, surge);

    const theta = this.elapsed + this.phaseOffset;
    const surgeAmp = 1 + surge * 0.2;
    const pitch = Math.sin(theta + 0.7) * this.tiltPitch * surgeAmp;
    const roll = Math.cos(theta * 0.5) * this.tiltRoll * surgeAmp;
    _euler.set(pitch, 0, roll, 'YXZ');
    _nextQuat.setFromEuler(_euler);

    // Subtract previous float delta and apply current delta
    target.position.sub(this.prevOffset).add(_nextOffset);
    this.prevOffset.copy(_nextOffset);

    _invQuat.copy(this.prevTilt).invert();
    target.quaternion.multiply(_invQuat).multiply(_nextQuat);
    this.prevTilt.copy(_nextQuat);
  }

  /**
   * Clears accumulated delta offsets when the target's base pose is reset.
   */
  reset(): void {
    this.prevOffset.set(0, 0, 0);
    this.prevTilt.identity();
  }
}
