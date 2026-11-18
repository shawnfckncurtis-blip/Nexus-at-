export type CyberPresetId =
  | 'nightCity'
  | 'netrunner'
  | 'solarFlare'
  | 'ultraviolet';

export type CyberXRMode = 'AR' | 'VR';

export interface CyberPreset {
  readonly id: CyberPresetId;
  readonly name: string;
  readonly shortLabel: string;
  readonly subtitle: string;
  readonly primaryHex: string;
  readonly secondaryHex: string;
  readonly accentHex: string;
  readonly vrBgHex: number;
  readonly fogHex: number;
}

export interface CyberFxSettings {
  presetId: CyberPresetId;
  glitchIntensity: number;
  glowIntensity: number;
  pulseSpeed: number;
  particleDensity: number;
  gridScale: number;
  wireframeMode: boolean;
  xrMode: CyberXRMode;
  audioEnabled: boolean;
}

export type CyberFxListener = (settings: Readonly<CyberFxSettings>) => void;
