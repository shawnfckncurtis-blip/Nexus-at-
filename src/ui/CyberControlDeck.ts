import * as THREE from 'three';
import * as xb from 'xrblocks';

import type {CyberAudio} from '../audio/CyberAudio.ts';
import {CYBER_PRESETS, CYBER_PRESET_ORDER} from '../constants.ts';
import type {CyberFxStore} from '../state/CyberFxStore.ts';
import type {CyberFxSettings, CyberPresetId} from '../types.ts';
import {HoloFloatController} from './HoloFloatController.ts';

interface SliderRow {
  slider: xb.UISlider;
  valueText: xb.UIText;
  format: (value: number) => string;
}

/**
 * World-space spatial FX control deck (xb.UICard) and view-space exit HUD (xb.UIOverlay)
 * for customizing cyberpunk visual effects, palettes, and XR modes in real time.
 */
export class CyberControlDeck extends xb.Script {
  private readonly store: CyberFxStore;
  private readonly audio: CyberAudio;

  private readonly deckHomePosition = new THREE.Vector3(-0.76, 1.38, -1.04);
  private readonly deckHomeRotation = new THREE.Euler(0, 0.28, 0);

  private card!: xb.UICard;
  private overlay!: xb.UIOverlay;
  private subtitleText!: xb.UIText;

  private presetButtons = new Map<CyberPresetId, xb.UIButton>();
  private glitchRow!: SliderRow;
  private glowRow!: SliderRow;
  private speedRow!: SliderRow;
  private rainRow!: SliderRow;
  private gridRow!: SliderRow;

  private modeButton!: xb.UIButton;
  private wireButton!: xb.UIButton;
  private surgeButton!: xb.UIButton;
  private audioButton!: xb.UIButton;
  private resetButton!: xb.UIButton;

  private lastThemePreset: CyberPresetId | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private unsubscribeReset: (() => void) | null = null;
  private hasValidatedUi = false;
  private frameCounter = 0;
  private readonly floatController = new HoloFloatController({
    phaseOffset: 0,
    ampX: 0.015,
    ampY: 0.022,
    ampZ: 0.008,
    baseFreq: 1.55,
    tiltPitch: 0.016,
    tiltRoll: 0.014,
  });

  constructor(store: CyberFxStore, audio: CyberAudio) {
    super();
    this.store = store;
    this.audio = audio;
    this.name = 'Cyber Control Deck';
    this.buildSpatialDeck();
    this.buildBottomOverlay();
  }

  private buildSpatialDeck(): void {
    this.subtitleText = new xb.UIText({
      text: CYBER_PRESETS.nightCity.subtitle,
      style: {fontSize: 15, opacity: 0.78},
    });

    const header = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      },
      children: [
        new xb.UIIcon({
          icon: 'tune',
          style: {width: 34, height: 34, color: '#00f0ff'},
        }),
        new xb.UIPanel({
          style: {
            flexGrow: 1,
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
          },
          children: [
            new xb.UIText({
              text: 'CYBERDECK // VISUAL FX',
              style: {fontSize: 22, fontWeight: 'bold'},
            }),
            this.subtitleText,
          ],
        }),
      ],
    });

    const presetRow = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        gap: 8,
      },
      children: CYBER_PRESET_ORDER.map((presetId) => {
        const preset = CYBER_PRESETS[presetId];
        const btn = new xb.UIButton({
          label: preset.shortLabel,
          ariaLabel: `Select ${preset.name} palette`,
          style: {
            flexGrow: 1,
            height: 40,
            fontSize: 14,
            fontWeight: 'bold',
            borderRadius: 10,
          },
          onClick: () => {
            this.store.setPreset(presetId);
            this.audio.playPresetShift();
          },
        });
        this.presetButtons.set(presetId, btn);
        return btn;
      }),
    });

    const settings = this.store.getSettings();

    const glitch = this.createSliderControl(
      'Glitch & Chromatic',
      0,
      1,
      0.05,
      settings.glitchIntensity,
      (v) => `${Math.round(v * 100)}%`,
      (v) => this.store.update({glitchIntensity: v})
    );
    this.glitchRow = glitch.row;

    const glow = this.createSliderControl(
      'Neon Glow',
      0,
      1,
      0.05,
      settings.glowIntensity,
      (v) => `${Math.round(v * 100)}%`,
      (v) => this.store.update({glowIntensity: v})
    );
    this.glowRow = glow.row;

    const speed = this.createSliderControl(
      'Pulse Speed',
      0.2,
      2.0,
      0.1,
      settings.pulseSpeed,
      (v) => `${v.toFixed(1)}x`,
      (v) => this.store.update({pulseSpeed: v})
    );
    this.speedRow = speed.row;

    const rain = this.createSliderControl(
      'Data Rain',
      0,
      1,
      0.05,
      settings.particleDensity,
      (v) => `${Math.round(v * 100)}%`,
      (v) => this.store.update({particleDensity: v})
    );
    this.rainRow = rain.row;

    const grid = this.createSliderControl(
      'Grid Scale',
      0.5,
      2.0,
      0.1,
      settings.gridScale,
      (v) => `${v.toFixed(1)}x`,
      (v) => this.store.update({gridScale: v})
    );
    this.gridRow = grid.row;

    this.modeButton = new xb.UIButton({
      label: 'Mode: VR',
      icon: 'public',
      ariaLabel: 'Toggle between VR Cyberspace and AR Passthrough',
      style: {flexGrow: 1, height: 42, fontSize: 14, borderRadius: 10},
      onClick: () => {
        const nextMode =
          this.store.getSettings().xrMode === 'VR' ? 'AR' : 'VR';
        this.store.update({xrMode: nextMode});
        this.audio.playBlip(nextMode === 'VR' ? 620 : 840);
      },
    });

    this.wireButton = new xb.UIButton({
      label: 'Holo Wire',
      icon: 'grid_on',
      ariaLabel: 'Toggle wireframe geometry mode',
      style: {flexGrow: 1, height: 42, fontSize: 14, borderRadius: 10},
      onClick: () => {
        const nextWire = !this.store.getSettings().wireframeMode;
        this.store.update({wireframeMode: nextWire});
        this.audio.playBlip(nextWire ? 900 : 580);
      },
    });

    this.surgeButton = new xb.UIButton({
      label: 'Surge',
      icon: 'bolt',
      ariaLabel: 'Trigger energy shockwave pulse',
      style: {flexGrow: 1, height: 42, fontSize: 14, borderRadius: 10},
      onClick: () => {
        this.store.triggerSurge();
        this.audio.playSurge();
      },
    });

    const actionRow = new xb.UIPanel({
      style: {width: '100%', flexDirection: 'row', gap: 8},
      children: [this.modeButton, this.wireButton, this.surgeButton],
    });

    this.audioButton = new xb.UIButton({
      label: 'Audio: On',
      icon: 'volume_up',
      ariaLabel: 'Toggle procedural synth audio',
      style: {flexGrow: 1, height: 38, fontSize: 14, borderRadius: 10},
      onClick: () => {
        const nextAudio = !this.store.getSettings().audioEnabled;
        this.audio.setEnabled(nextAudio);
        this.store.update({audioEnabled: nextAudio});
        if (nextAudio) this.audio.playBlip(760);
      },
    });

    this.resetButton = new xb.UIButton({
      label: 'Reset FX',
      icon: 'restart_alt',
      ariaLabel: 'Reset all visual effects and positions',
      style: {flexGrow: 1, height: 38, fontSize: 14, borderRadius: 10},
      onClick: () => {
        this.store.resetAll();
        this.audio.playBlip(520);
      },
    });

    const utilityRow = new xb.UIPanel({
      style: {width: '100%', flexDirection: 'row', gap: 8},
      children: [this.audioButton, this.resetButton],
    });

    this.card = new xb.UICard({
      size: {width: 0.68, height: 'auto'},
      manipulation: true,
      edge: true,
      style: {
        flexDirection: 'column',
        gap: 11,
        padding: 18,
        borderRadius: 20,
      },
      children: [
        header,
        presetRow,
        glitch.panel,
        glow.panel,
        speed.panel,
        rain.panel,
        grid.panel,
        actionRow,
        utilityRow,
      ],
    });
    this.card.name = 'Cyberdeck FX Card';
    this.card.position.copy(this.deckHomePosition);
    this.card.rotation.copy(this.deckHomeRotation);
    this.add(this.card);
  }

  private createSliderControl(
    label: string,
    min: number,
    max: number,
    step: number,
    initialValue: number,
    format: (v: number) => string,
    onInput: (v: number) => void
  ): {panel: xb.UIPanel; row: SliderRow} {
    const valueText = new xb.UIText({
      text: format(initialValue),
      style: {fontSize: 15, fontWeight: 'bold', textAlign: 'right'},
    });

    const labelRow = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      children: [
        new xb.UIText({
          text: label,
          style: {fontSize: 15},
        }),
        valueText,
      ],
    });

    const slider = new xb.UISlider({
      ariaLabel: label,
      min,
      max,
      step,
      value: initialValue,
      style: {width: '100%', height: 32},
      onInput: (val) => {
        valueText.text = format(val);
        onInput(val);
      },
    });

    const panel = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'column',
        gap: 4,
      },
      children: [labelRow, slider],
    });

    return {panel, row: {slider, valueText, format}};
  }

  private buildBottomOverlay(): void {
    this.overlay = new xb.UIOverlay({
      style: {
        width: 680,
        position: 'absolute',
        left: '50%',
        bottom: 20,
        transform: {translateX: '-50%'},
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 18,
      },
      children: [
        new xb.UIExitButton(),
        new xb.UIText({
          text: 'Touch-Scroll Holo Terminal • Drag Card Edges or Core • Pinch/Click Core to Surge',
          pointerEvents: 'none',
          style: {
            flexGrow: 1,
            fontSize: 15,
            textAlign: 'center',
            opacity: 0.88,
          },
        }),
      ],
    });
    this.overlay.name = 'Cyberdeck Bottom HUD';
    this.add(this.overlay);
  }

  init(): void {
    this.unsubscribeStore = this.store.subscribe((settings) => {
      this.syncFromSettings(settings);
    });

    this.unsubscribeReset = this.store.onReset(() => {
      this.floatController.reset();
      this.card.position.copy(this.deckHomePosition);
      this.card.rotation.copy(this.deckHomeRotation);
      this.card.scale.setScalar(1);
    });
  }

  private syncFromSettings(settings: Readonly<CyberFxSettings>): void {
    const preset = CYBER_PRESETS[settings.presetId];
    this.subtitleText.text = `${preset.name} — ${preset.subtitle}`;

    if (this.lastThemePreset !== settings.presetId) {
      this.lastThemePreset = settings.presetId;
      xb.ui.setTheme({
        borderRadius: 16,
        colors: {
          surface: 'rgba(10, 12, 28, 0.86)',
          raisedSurface: 'rgba(20, 26, 54, 0.92)',
          primary: preset.primaryHex,
          primaryText: '#060916',
          text: '#f0f6ff',
          secondaryText: 'rgba(206, 224, 255, 0.78)',
          outline: preset.primaryHex,
          sliderTrack: 'rgba(255, 255, 255, 0.16)',
        },
      });
    }

    // Highlight active preset button
    this.presetButtons.forEach((button, id) => {
      const isActive = id === settings.presetId;
      button.style.backgroundColor = isActive
        ? preset.primaryHex
        : 'rgba(255, 255, 255, 0.08)';
      button.style.color = isActive ? '#060916' : '#f0f6ff';
    });

    // Sync sliders
    this.syncSlider(this.glitchRow, settings.glitchIntensity);
    this.syncSlider(this.glowRow, settings.glowIntensity);
    this.syncSlider(this.speedRow, settings.pulseSpeed);
    this.syncSlider(this.rainRow, settings.particleDensity);
    this.syncSlider(this.gridRow, settings.gridScale);

    // Sync action buttons
    this.modeButton.label = settings.xrMode === 'VR' ? 'Mode: VR' : 'Mode: AR';
    this.modeButton.icon =
      settings.xrMode === 'VR' ? 'public' : 'view_in_ar';

    this.wireButton.label = settings.wireframeMode ? 'Wire: On' : 'Wire: Off';
    this.wireButton.style.backgroundColor = settings.wireframeMode
      ? preset.secondaryHex
      : 'rgba(255, 255, 255, 0.08)';
    this.wireButton.style.color = settings.wireframeMode
      ? '#060916'
      : '#f0f6ff';

    this.audioButton.label = settings.audioEnabled ? 'Audio: On' : 'Audio: Off';
    this.audioButton.icon = settings.audioEnabled
      ? 'volume_up'
      : 'volume_off';
  }

  private syncSlider(row: SliderRow, value: number): void {
    if (Math.abs(row.slider.value - value) > 0.001) {
      row.slider.value = value;
    }
    row.valueText.text = row.format(value);
  }

  update(): void {
    const dt = Math.min(xb.getDeltaTime(), 0.1);
    const settings = this.store.getSettings();
    this.floatController.applyTo(
      this.card,
      dt,
      0.7 + settings.pulseSpeed * 0.35,
      this.store.surgeIntensity
    );

    if (!this.hasValidatedUi) {
      this.frameCounter++;
      if (this.frameCounter > 10) {
        const report = xb.ui.validate();
        if (report.ready) {
          this.hasValidatedUi = true;
          if (!report.ok) {
            console.warn('Spatial UI validation issues:', report.issues);
          }
        }
      }
    }
  }

  dispose(): void {
    this.unsubscribeStore?.();
    this.unsubscribeReset?.();
  }
}
