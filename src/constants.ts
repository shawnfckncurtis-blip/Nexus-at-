import type {CyberFxSettings, CyberPreset, CyberPresetId} from './types.ts';

export const CYBER_PRESETS: Record<CyberPresetId, CyberPreset> = {
  nightCity: {
    id: 'nightCity',
    name: 'NIGHT CITY',
    shortLabel: 'NIGHT',
    subtitle: 'Cyan // Magenta Synth',
    primaryHex: '#00f0ff',
    secondaryHex: '#ff007f',
    accentHex: '#ffe600',
    vrBgHex: 0x05020e,
    fogHex: 0x070316,
  },
  netrunner: {
    id: 'netrunner',
    name: 'NETRUNNER',
    shortLabel: 'MATRIX',
    subtitle: 'Acid Green // Ice Teal',
    primaryHex: '#00ff88',
    secondaryHex: '#00c8ff',
    accentHex: '#b8ff00',
    vrBgHex: 0x010b08,
    fogHex: 0x02120c,
  },
  solarFlare: {
    id: 'solarFlare',
    name: 'SOLAR FLARE',
    shortLabel: 'SOLAR',
    subtitle: 'Amber // Crimson Overdrive',
    primaryHex: '#ff9d00',
    secondaryHex: '#ff1e56',
    accentHex: '#fff066',
    vrBgHex: 0x100308,
    fogHex: 0x16050b,
  },
  ultraviolet: {
    id: 'ultraviolet',
    name: 'ULTRAVIOLET',
    shortLabel: 'ULTRA',
    subtitle: 'Violet // Hyper Blue',
    primaryHex: '#c04dff',
    secondaryHex: '#2dd4ff',
    accentHex: '#ff66cc',
    vrBgHex: 0x080314,
    fogHex: 0x0b051c,
  },
};

export const CYBER_PRESET_ORDER: readonly CyberPresetId[] = [
  'nightCity',
  'netrunner',
  'solarFlare',
  'ultraviolet',
];

export const DEFAULT_FX_SETTINGS: CyberFxSettings = {
  presetId: 'nightCity',
  glitchIntensity: 0.35,
  glowIntensity: 0.85,
  pulseSpeed: 1.0,
  particleDensity: 0.75,
  gridScale: 1.0,
  wireframeMode: false,
  xrMode: 'VR',
  audioEnabled: true,
};
