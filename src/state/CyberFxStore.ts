import * as THREE from 'three';

import {CYBER_PRESETS, DEFAULT_FX_SETTINGS} from '../constants.ts';
import type {
  CyberFxListener,
  CyberFxSettings,
  CyberPreset,
  CyberPresetId,
} from '../types.ts';

export type ActivityListener = (entry: string) => void;

/**
 * Central reactive store for cyberpunk visual effects, color palettes,
 * selected holo-nodes, activity logs, and energy surge pulses across all XR scene scripts.
 */
export class CyberFxStore {
  private settings: CyberFxSettings = {...DEFAULT_FX_SETTINGS};
  private listeners = new Set<CyberFxListener>();
  private resetHandlers = new Set<() => void>();
  private surgeListeners = new Set<(origin: THREE.Vector3) => void>();
  private activityListeners = new Set<ActivityListener>();

  public readonly primaryColor = new THREE.Color(
    CYBER_PRESETS[DEFAULT_FX_SETTINGS.presetId].primaryHex
  );
  public readonly secondaryColor = new THREE.Color(
    CYBER_PRESETS[DEFAULT_FX_SETTINGS.presetId].secondaryHex
  );
  public readonly accentColor = new THREE.Color(
    CYBER_PRESETS[DEFAULT_FX_SETTINGS.presetId].accentHex
  );

  private targetPrimary = new THREE.Color(
    CYBER_PRESETS[DEFAULT_FX_SETTINGS.presetId].primaryHex
  );
  private targetSecondary = new THREE.Color(
    CYBER_PRESETS[DEFAULT_FX_SETTINGS.presetId].secondaryHex
  );
  private targetAccent = new THREE.Color(
    CYBER_PRESETS[DEFAULT_FX_SETTINGS.presetId].accentHex
  );

  public surgeIntensity = 0;
  public surgeWaveRadius = 0;
  public readonly surgeOrigin = new THREE.Vector3(0, 1.38, -1.16);
  public selectedNodeId = 'NEXUS_CORE_01';

  getSettings(): Readonly<CyberFxSettings> {
    return this.settings;
  }

  getPreset(): CyberPreset {
    return CYBER_PRESETS[this.settings.presetId];
  }

  subscribe(listener: CyberFxListener): () => void {
    this.listeners.add(listener);
    listener(this.settings);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onReset(handler: () => void): () => void {
    this.resetHandlers.add(handler);
    return () => {
      this.resetHandlers.delete(handler);
    };
  }

  onSurge(handler: (origin: THREE.Vector3) => void): () => void {
    this.surgeListeners.add(handler);
    return () => {
      this.surgeListeners.delete(handler);
    };
  }

  onActivity(listener: ActivityListener): () => void {
    this.activityListeners.add(listener);
    return () => {
      this.activityListeners.delete(listener);
    };
  }

  emitActivity(entry: string): void {
    for (const listener of this.activityListeners) {
      listener(entry);
    }
  }

  selectNode(nodeId: string, label: string): void {
    this.selectedNodeId = nodeId;
    this.emitActivity(`NODE LINK // ${nodeId} (${label}) INSPECTED`);
    this.notify();
  }

  update(partial: Partial<CyberFxSettings>): void {
    let changed = false;
    (Object.keys(partial) as Array<keyof CyberFxSettings>).forEach((key) => {
      const value = partial[key];
      if (value !== undefined && this.settings[key] !== value) {
        (this.settings as unknown as Record<string, unknown>)[key] = value;
        changed = true;
      }
    });

    if (partial.presetId) {
      const preset = CYBER_PRESETS[partial.presetId];
      this.targetPrimary.set(preset.primaryHex);
      this.targetSecondary.set(preset.secondaryHex);
      this.targetAccent.set(preset.accentHex);
      this.emitActivity(`PALETTE // ${preset.name} LOADED`);
    }

    if (partial.xrMode) {
      this.emitActivity(`ENV // SWITCHED TO ${partial.xrMode} MODE`);
    }

    if (partial.wireframeMode !== undefined && changed) {
      this.emitActivity(
        `MESH // HOLO WIREFRAME ${partial.wireframeMode ? 'ON' : 'OFF'}`
      );
    }

    if (changed) {
      this.notify();
    }
  }

  setPreset(presetId: CyberPresetId): void {
    this.update({presetId});
  }

  triggerSurge(origin?: THREE.Vector3): void {
    if (origin) {
      this.surgeOrigin.copy(origin);
    }
    this.surgeIntensity = 1.0;
    this.surgeWaveRadius = 0.12;
    this.emitActivity('PULSE // PLASMA SHOCKWAVE DISCHARGED');
    for (const listener of this.surgeListeners) {
      listener(this.surgeOrigin);
    }
  }

  resetAll(): void {
    this.settings = {...DEFAULT_FX_SETTINGS};
    this.selectedNodeId = 'NEXUS_CORE_01';
    const preset = CYBER_PRESETS[this.settings.presetId];
    this.targetPrimary.set(preset.primaryHex);
    this.targetSecondary.set(preset.secondaryHex);
    this.targetAccent.set(preset.accentHex);
    this.triggerSurge();
    this.emitActivity('SYS // ALL FX & TRANSFORMS RESET');
    this.notify();
    for (const handler of this.resetHandlers) {
      handler();
    }
  }

  /**
   * Advances smooth color interpolation and surge decay each frame.
   */
  step(deltaTime: number): void {
    const dt = Math.min(Math.max(deltaTime, 0), 0.1);
    const colorLerp = 1 - Math.exp(-8 * dt);
    this.primaryColor.lerp(this.targetPrimary, colorLerp);
    this.secondaryColor.lerp(this.targetSecondary, colorLerp);
    this.accentColor.lerp(this.targetAccent, colorLerp);

    if (this.surgeIntensity > 0.001) {
      this.surgeIntensity = Math.max(0, this.surgeIntensity - dt * 1.15);
      this.surgeWaveRadius += dt * 9.5;
    } else {
      this.surgeIntensity = 0;
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.settings);
    }
  }
}
