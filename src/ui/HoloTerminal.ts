import * as THREE from 'three';
import * as xb from 'xrblocks';

import type {CyberAudio} from '../audio/CyberAudio.ts';
import {CYBER_PRESETS} from '../constants.ts';
import {
  createHoloBackplaneMaterial,
  createHoloBeamMaterial,
} from '../shaders/cyberShaders.ts';
import type {CyberFxStore} from '../state/CyberFxStore.ts';
import type {CyberFxSettings} from '../types.ts';
import {HoloFloatController} from './HoloFloatController.ts';
import {HoloTelemetryCanvas} from './HoloTelemetryCanvas.ts';

const _coreWorldPos = new THREE.Vector3();
const _calloutOffset = new THREE.Vector3();

interface HoloNodeDef {
  readonly id: string;
  readonly title: string;
  readonly sector: string;
  readonly metric: string;
}

const HOLO_NODES: readonly HoloNodeDef[] = [
  {
    id: 'NEXUS_CORE_01',
    title: 'Reactor Core Matrix',
    sector: 'SEC-01 // CENTRAL',
    metric: '99.4% SYNC',
  },
  {
    id: 'SYNTH_GRID_V4',
    title: 'Horizon Grid Array',
    sector: 'SEC-02 // FLOOR',
    metric: '60.0 Hz LOCK',
  },
  {
    id: 'OPTIC_GLITCH_BUS',
    title: 'Chromatic Glitch Bus',
    sector: 'SEC-03 // SHADER',
    metric: 'RGB SPLIT',
  },
  {
    id: 'NEURAL_RAIN_ARRAY',
    title: 'Data Rain Emitters',
    sector: 'SEC-04 // PARTICLES',
    metric: '650 STREAMS',
  },
  {
    id: 'QUANTUM_CIPHER_09',
    title: 'Encrypted Uplink',
    sector: 'SEC-05 // TELEMETRY',
    metric: 'AES-512 XR',
  },
  {
    id: 'AURA_SHIELD_RX',
    title: 'Plasma Containment',
    sector: 'SEC-06 // GYRO',
    metric: '8 FINS ACTIVE',
  },
];

type SectionKey = 'all' | 'radar' | 'nodes' | 'logs';

/**
 * Interactive, translucent, glowing holographic terminal interface with
 * custom GLSL scanline backplane, volumetric projector beam, live animated
 * oscilloscope & radar displays, and touch-scrollable UIScrollView stream.
 */
export class HoloTerminal extends xb.Script {
  private readonly store: CyberFxStore;
  private readonly audio: CyberAudio;
  private readonly coreTarget: THREE.Object3D;

  private readonly homePosition = new THREE.Vector3(0.76, 1.38, -1.04);
  private readonly homeRotation = new THREE.Euler(0, -0.28, 0);

  private card!: xb.UICard;
  private scrollView!: xb.UIScrollView;
  private telemetryCanvas = new HoloTelemetryCanvas();

  private statusBadge!: xb.UIText;
  private activeNodeText!: xb.UIText;
  private glitchReadout!: xb.UIText;
  private glowReadout!: xb.UIText;
  private peakReadout!: xb.UIText;
  private scrollProgressText!: xb.UIText;
  private logBodyText!: xb.UIText;

  private tabButtons = new Map<SectionKey, xb.UIButton>();
  private nodeButtons = new Map<string, xb.UIButton>();
  private activeTab: SectionKey = 'all';

  private radarSectionPanel!: xb.UIPanel;
  private nodesSectionPanel!: xb.UIPanel;
  private logsSectionPanel!: xb.UIPanel;

  private holoRig!: THREE.Group;
  private backplaneMesh!: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.ShaderMaterial
  >;
  private backplaneMaterial!: THREE.ShaderMaterial;
  private frameLines!: THREE.LineSegments<
    THREE.EdgesGeometry,
    THREE.LineBasicMaterial
  >;
  private emitterBar!: THREE.Mesh<
    THREE.BoxGeometry,
    THREE.MeshStandardMaterial
  >;
  private emitterStrip!: THREE.Mesh<
    THREE.BoxGeometry,
    THREE.MeshBasicMaterial
  >;
  private beamMesh!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private beamMaterial!: THREE.ShaderMaterial;

  // Floating Holo-Callout tracking the CyberCore
  private coreCallout!: xb.UICard;
  private coreCalloutTitle!: xb.UIText;
  private coreCalloutSub!: xb.UIText;

  private simTime = 0;
  private targetScrollOffset: number | null = null;
  private logLines: string[] = [
    '> [00:01] NEXUS HOLO-BUS INITIALIZED',
    '> [00:02] TOUCH-SCROLL STREAM READY',
    '> [00:03] TAP NODES OR DRAG TO INSPECT',
  ];
  private logCounter = 4;

  private unsubscribeStore: (() => void) | null = null;
  private unsubscribeReset: (() => void) | null = null;
  private unsubscribeActivity: (() => void) | null = null;

  private readonly terminalFloat = new HoloFloatController({
    phaseOffset: 2.1,
    ampX: 0.015,
    ampY: 0.022,
    ampZ: 0.008,
    baseFreq: 1.55,
    tiltPitch: 0.016,
    tiltRoll: 0.014,
  });

  private readonly calloutFloat = new HoloFloatController({
    phaseOffset: 4.2,
    ampX: 0.014,
    ampY: 0.018,
    ampZ: 0.008,
    baseFreq: 1.55,
  });

  constructor(
    store: CyberFxStore,
    audio: CyberAudio,
    coreTarget: THREE.Object3D
  ) {
    super();
    this.store = store;
    this.audio = audio;
    this.coreTarget = coreTarget;
    this.name = 'Holographic Terminal';
    this.buildTerminalCard();
    this.buildHoloProjectorLayers();
    this.buildCoreCallout();
  }

  private buildTerminalCard(): void {
    this.statusBadge = new xb.UIText({
      text: 'HOLO-LINK // ONLINE',
      style: {fontSize: 13, fontWeight: 'bold', color: '#00f0ff'},
    });

    const header = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      },
      children: [
        new xb.UIIcon({
          icon: 'hub',
          style: {width: 30, height: 30, color: '#00f0ff'},
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
              text: 'NEXUS // HOLO-STREAM',
              style: {fontSize: 20, fontWeight: 'bold'},
            }),
            this.statusBadge,
          ],
        }),
      ],
    });

    const tabs: Array<{key: SectionKey; label: string}> = [
      {key: 'all', label: 'TOP'},
      {key: 'radar', label: 'RADAR'},
      {key: 'nodes', label: 'NODES'},
      {key: 'logs', label: 'LOGS'},
    ];

    const tabRow = new xb.UIPanel({
      style: {width: '100%', flexDirection: 'row', gap: 6},
      children: tabs.map(({key, label}) => {
        const btn = new xb.UIButton({
          label,
          ariaLabel: `Jump to ${label} section`,
          style: {
            flexGrow: 1,
            height: 34,
            fontSize: 13,
            fontWeight: 'bold',
            borderRadius: 8,
          },
          onClick: () => {
            this.activeTab = key;
            this.audio.playBlip(760);
            this.jumpToSection(key);
            this.refreshButtonStyles(this.store.getSettings());
          },
        });
        this.tabButtons.set(key, btn);
        return btn;
      }),
    });

    // --- Scrollable Holographic Content Sections ---
    this.peakReadout = new xb.UIText({
      text: 'PEAK: 94.2 dB',
      style: {fontSize: 13, fontWeight: 'bold', color: '#00f0ff'},
    });

    const waveformPanel = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'column',
        gap: 6,
        padding: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(6, 22, 44, 0.45)',
        borderWidth: 1,
        borderColor: 'rgba(0, 240, 255, 0.3)',
      },
      children: [
        new xb.UIPanel({
          style: {
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          children: [
            new xb.UIText({
              text: 'NEURAL OSCILLOSCOPE',
              style: {fontSize: 14, fontWeight: 'bold'},
            }),
            this.peakReadout,
          ],
        }),
        new xb.UIImage({
          src: this.telemetryCanvas.waveformTexture,
          ariaLabel: 'Live neural waveform oscilloscope',
          pointerEvents: 'none',
          style: {
            width: '100%',
            height: 110,
            borderRadius: 8,
            objectFit: 'cover',
          },
        }),
      ],
    });

    this.activeNodeText = new xb.UIText({
      text: 'NODE: NEXUS_CORE_01',
      style: {fontSize: 14, fontWeight: 'bold'},
    });
    this.glitchReadout = new xb.UIText({
      text: 'GLITCH: 35%',
      style: {fontSize: 13, opacity: 0.85},
    });
    this.glowReadout = new xb.UIText({
      text: 'FLUX: 85%',
      style: {fontSize: 13, opacity: 0.85},
    });

    this.radarSectionPanel = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(6, 22, 44, 0.45)',
        borderWidth: 1,
        borderColor: 'rgba(0, 240, 255, 0.3)',
      },
      children: [
        new xb.UIImage({
          src: this.telemetryCanvas.radarTexture,
          ariaLabel: 'Spatial sector radar display',
          pointerEvents: 'none',
          style: {
            width: 104,
            height: 104,
            borderRadius: 10,
            objectFit: 'cover',
          },
        }),
        new xb.UIPanel({
          style: {
            flexGrow: 1,
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 5,
          },
          children: [
            new xb.UIText({
              text: 'SECTOR SCANNER',
              style: {fontSize: 14, fontWeight: 'bold'},
            }),
            this.activeNodeText,
            this.glitchReadout,
            this.glowReadout,
          ],
        }),
      ],
    });

    const nodeCards = HOLO_NODES.map((node) => {
      const btn = new xb.UIButton({
        ariaLabel: `Inspect ${node.id} ${node.title}`,
        style: {
          width: '100%',
          height: 52,
          paddingLeft: 12,
          paddingRight: 12,
          borderRadius: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(10, 28, 56, 0.5)',
          borderWidth: 1,
          borderColor: 'rgba(0, 240, 255, 0.25)',
        },
        onClick: () => {
          this.store.selectNode(node.id, node.title);
          this.store.triggerSurge();
          this.audio.playBlip(880);
        },
        children: [
          new xb.UIPanel({
            pointerEvents: 'none',
            style: {
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 2,
            },
            children: [
              new xb.UIText({
                text: node.id,
                pointerEvents: 'none',
                style: {fontSize: 14, fontWeight: 'bold'},
              }),
              new xb.UIText({
                text: `${node.title} • ${node.sector}`,
                pointerEvents: 'none',
                style: {fontSize: 12, opacity: 0.72},
              }),
            ],
          }),
          new xb.UIText({
            text: node.metric,
            pointerEvents: 'none',
            style: {fontSize: 12, fontWeight: 'bold'},
          }),
        ],
      });
      this.nodeButtons.set(node.id, btn);
      return btn;
    });

    this.nodesSectionPanel = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'column',
        gap: 6,
      },
      children: [
        new xb.UIText({
          text: 'SUBSYSTEM NODES (TOUCH TO SYNC)',
          style: {fontSize: 13, fontWeight: 'bold', opacity: 0.85},
        }),
        ...nodeCards,
      ],
    });

    this.logBodyText = new xb.UIText({
      text: this.logLines.join('\n'),
      style: {
        width: '100%',
        fontSize: 13,
        lineHeight: 1.4,
        whiteSpace: 'pre-line',
        opacity: 0.9,
      },
    });

    this.logsSectionPanel = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'column',
        gap: 6,
        padding: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(4, 14, 30, 0.55)',
        borderWidth: 1,
        borderColor: 'rgba(255, 0, 127, 0.35)',
      },
      children: [
        new xb.UIText({
          text: 'ENCRYPTED TELEMETRY LOG',
          style: {fontSize: 13, fontWeight: 'bold'},
        }),
        this.logBodyText,
      ],
    });

    this.scrollView = new xb.UIScrollView({
      ariaLabel: 'Touch-scrollable holographic data stream',
      style: {
        flexGrow: 1,
        flexBasis: 0,
        minHeight: 220,
        gap: 10,
        padding: 10,
        borderRadius: 14,
        backgroundColor: 'rgba(3, 12, 28, 0.34)',
        borderWidth: 1,
        borderColor: 'rgba(0, 240, 255, 0.3)',
      },
      onScroll: (offset) => {
        this.updateScrollMeter(offset);
      },
      children: [
        waveformPanel,
        this.radarSectionPanel,
        this.nodesSectionPanel,
        this.logsSectionPanel,
      ],
    });

    this.scrollProgressText = new xb.UIText({
      text: 'SCROLL 0% • DRAG STREAM',
      style: {fontSize: 12, opacity: 0.8},
    });

    const footer = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      },
      children: [
        this.scrollProgressText,
        new xb.UIPanel({
          style: {flexDirection: 'row', gap: 6},
          children: [
            new xb.UIButton({
              label: 'TOP',
              icon: 'vertical_align_top',
              ariaLabel: 'Scroll holographic feed to top',
              style: {height: 34, fontSize: 12, borderRadius: 8},
              onClick: () => {
                this.targetScrollOffset = 0;
                this.audio.playBlip(680);
              },
            }),
            new xb.UIButton({
              label: 'SCAN',
              icon: 'radar',
              ariaLabel: 'Run holographic diagnostic scan',
              style: {height: 34, fontSize: 12, borderRadius: 8},
              onClick: () => {
                this.appendLog('DIAG // FULL HOLO SPECTRUM VERIFIED');
                this.store.triggerSurge();
                this.audio.playSurge();
              },
            }),
          ],
        }),
      ],
    });

    this.card = new xb.UICard({
      size: {width: 0.66, height: 0.72},
      manipulation: true,
      edge: true,
      style: {
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        borderRadius: 18,
        backgroundColor: 'rgba(4, 14, 32, 0.38)',
        borderWidth: 1.5,
        borderColor: 'rgba(0, 240, 255, 0.55)',
      },
      children: [header, tabRow, this.scrollView, footer],
    });
    this.card.name = 'Nexus Holo Terminal Card';
    this.card.position.copy(this.homePosition);
    this.card.rotation.copy(this.homeRotation);
    this.add(this.card);
  }

  private buildHoloProjectorLayers(): void {
    this.holoRig = new THREE.Group();
    this.holoRig.name = 'Holo Projector Rig';
    this.holoRig.xb = {pointerEvents: 'none'};
    this.holoRig.position.copy(this.card.position);
    this.holoRig.quaternion.copy(this.card.quaternion);
    this.holoRig.scale.copy(this.card.scale);
    this.add(this.holoRig);

    // 1. Animated Holographic Scanline & Sweep Backplane behind the translucent card
    this.backplaneMaterial = createHoloBackplaneMaterial(
      this.store.primaryColor,
      this.store.secondaryColor,
      this.store.accentColor
    );
    this.backplaneMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.76),
      this.backplaneMaterial
    );
    this.backplaneMesh.position.set(0, 0, -0.008);
    this.backplaneMesh.xb = {pointerEvents: 'none'};
    this.holoRig.add(this.backplaneMesh);

    // 2. Crisp Glowing Wire Perimeter Frame
    const frameBoxGeo = new THREE.BoxGeometry(0.685, 0.745, 0.014);
    const frameGeo = new THREE.EdgesGeometry(frameBoxGeo);
    frameBoxGeo.dispose();
    this.frameLines = new THREE.LineSegments(
      frameGeo,
      new THREE.LineBasicMaterial({
        color: this.store.primaryColor,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      })
    );
    this.frameLines.xb = {pointerEvents: 'none'};
    this.holoRig.add(this.frameLines);

    // 3. Holographic Emitter Projector Bar + Upward Volumetric Beam
    this.emitterBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.024, 0.038),
      new THREE.MeshStandardMaterial({
        color: 0x101728,
        metalness: 0.9,
        roughness: 0.25,
      })
    );
    this.emitterBar.position.set(0, -0.405, 0);
    this.emitterBar.xb = {pointerEvents: 'none'};
    this.holoRig.add(this.emitterBar);

    this.emitterStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.006, 0.042),
      new THREE.MeshBasicMaterial({
        color: this.store.primaryColor,
        transparent: true,
        opacity: 0.95,
      })
    );
    this.emitterStrip.position.set(0, -0.394, 0);
    this.emitterStrip.xb = {pointerEvents: 'none'};
    this.holoRig.add(this.emitterStrip);

    this.beamMaterial = createHoloBeamMaterial(
      this.store.primaryColor,
      this.store.secondaryColor
    );
    this.beamMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.66, 0.26),
      this.beamMaterial
    );
    this.beamMesh.position.set(0, -0.265, -0.014);
    this.beamMesh.xb = {pointerEvents: 'none'};
    this.holoRig.add(this.beamMesh);
  }

  private buildCoreCallout(): void {
    this.coreCalloutTitle = new xb.UIText({
      text: 'NEXUS_CORE_01',
      pointerEvents: 'none',
      style: {fontSize: 16, fontWeight: 'bold', textAlign: 'center'},
    });
    this.coreCalloutSub = new xb.UIText({
      text: 'STATUS // ONLINE',
      pointerEvents: 'none',
      style: {fontSize: 12, textAlign: 'center', opacity: 0.85},
    });

    this.coreCallout = new xb.UICard({
      size: {width: 0.34, height: 0.095},
      pointerEvents: 'none',
      style: {
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        padding: 8,
        borderRadius: 14,
        backgroundColor: 'rgba(5, 16, 36, 0.42)',
        borderWidth: 1.5,
        borderColor: 'rgba(0, 240, 255, 0.65)',
      },
      children: [this.coreCalloutTitle, this.coreCalloutSub],
    });
    this.coreCallout.name = 'Core Holo Callout';
    this.coreCallout.add(
      new xb.FaceCamera({mode: 'spherical', smoothing: 0.14})
    );
    this.coreCallout.position.set(0, 1.8, -1.16);
    this.add(this.coreCallout);
  }

  init(): void {
    this.unsubscribeStore = this.store.subscribe((settings) => {
      this.refreshButtonStyles(settings);
    });

    this.unsubscribeReset = this.store.onReset(() => {
      this.terminalFloat.reset();
      this.card.position.copy(this.homePosition);
      this.card.rotation.copy(this.homeRotation);
      this.card.scale.setScalar(1);
      this.targetScrollOffset = 0;
    });

    this.unsubscribeActivity = this.store.onActivity((entry) => {
      this.appendLog(entry);
    });
  }

  private appendLog(message: string): void {
    const idx = String(this.logCounter++).padStart(2, '0');
    this.logLines.push(`> [00:${idx}] ${message}`);
    if (this.logLines.length > 10) {
      this.logLines.shift();
    }
    this.logBodyText.text = this.logLines.join('\n');
  }

  private jumpToSection(section: SectionKey): void {
    if (!this.scrollView.ready) return;
    const max = this.scrollView.maxScrollTop;
    if (section === 'all') this.targetScrollOffset = 0;
    else if (section === 'radar') this.targetScrollOffset = Math.min(max, 115);
    else if (section === 'nodes') this.targetScrollOffset = Math.min(max, 250);
    else if (section === 'logs') this.targetScrollOffset = max;
  }

  private updateScrollMeter(offset: number): void {
    const max = this.scrollView.maxScrollTop;
    const pct = max > 0 ? Math.round((offset / max) * 100) : 0;
    this.scrollProgressText.text = `SCROLL ${pct}% • DRAG STREAM`;
  }

  private refreshButtonStyles(settings: Readonly<CyberFxSettings>): void {
    const preset = CYBER_PRESETS[settings.presetId];
    this.card.style.borderColor = preset.primaryHex;
    this.coreCallout.style.borderColor = preset.primaryHex;
    this.statusBadge.style.color = preset.primaryHex;
    this.peakReadout.style.color = preset.primaryHex;

    this.activeNodeText.text = `NODE: ${this.store.selectedNodeId}`;
    this.glitchReadout.text = `GLITCH: ${Math.round(settings.glitchIntensity * 100)}%`;
    this.glowReadout.text = `FLUX: ${Math.round(settings.glowIntensity * 100)}%`;

    this.tabButtons.forEach((btn, key) => {
      const isSelected = key === this.activeTab;
      btn.style.backgroundColor = isSelected
        ? preset.primaryHex
        : 'rgba(255, 255, 255, 0.08)';
      btn.style.color = isSelected ? '#060916' : '#f0f6ff';
    });

    this.nodeButtons.forEach((btn, nodeId) => {
      const isSelected = nodeId === this.store.selectedNodeId;
      btn.style.borderColor = isSelected
        ? preset.accentHex
        : 'rgba(0, 240, 255, 0.25)';
      btn.style.backgroundColor = isSelected
        ? 'rgba(0, 240, 255, 0.16)'
        : 'rgba(10, 28, 56, 0.48)';
    });
  }

  update(): void {
    const dt = Math.min(xb.getDeltaTime(), 0.1);
    const settings = this.store.getSettings();
    const preset = CYBER_PRESETS[settings.presetId];
    const surge = this.store.surgeIntensity;
    this.simTime += dt * (0.6 + settings.pulseSpeed * 0.9);

    // Smooth programmatic scroll animation when tab / TOP is tapped
    if (this.targetScrollOffset !== null && this.scrollView.ready) {
      const current = this.scrollView.scrollTop;
      const next = THREE.MathUtils.damp(
        current,
        this.targetScrollOffset,
        10,
        dt
      );
      this.scrollView.scrollTo(next);
      this.updateScrollMeter(this.scrollView.scrollTop);
      if (Math.abs(this.targetScrollOffset - next) < 0.75) {
        this.scrollView.scrollTo(this.targetScrollOffset);
        this.targetScrollOffset = null;
      }
    }

    const floatRate = 0.7 + settings.pulseSpeed * 0.35;
    this.terminalFloat.applyTo(this.card, dt, floatRate, surge);

    // Keep holographic projector rig locked to the levitating & manipulable UICard pose
    this.holoRig.position.copy(this.card.position);
    this.holoRig.quaternion.copy(this.card.quaternion);
    this.holoRig.scale.copy(this.card.scale);

    // Update animated holographic GLSL backplane & projector beam
    this.backplaneMaterial.uniforms.uTime.value = this.simTime;
    (this.backplaneMaterial.uniforms.uPrimary.value as THREE.Color).copy(
      this.store.primaryColor
    );
    (this.backplaneMaterial.uniforms.uSecondary.value as THREE.Color).copy(
      this.store.secondaryColor
    );
    (this.backplaneMaterial.uniforms.uAccent.value as THREE.Color).copy(
      this.store.accentColor
    );
    this.backplaneMaterial.uniforms.uGlitch.value = settings.glitchIntensity;
    this.backplaneMaterial.uniforms.uGlow.value = settings.glowIntensity;
    this.backplaneMaterial.uniforms.uSurge.value = surge;

    this.beamMaterial.uniforms.uTime.value = this.simTime;
    (this.beamMaterial.uniforms.uPrimary.value as THREE.Color).copy(
      this.store.primaryColor
    );
    (this.beamMaterial.uniforms.uSecondary.value as THREE.Color).copy(
      this.store.secondaryColor
    );
    this.beamMaterial.uniforms.uGlow.value = settings.glowIntensity;
    this.beamMaterial.uniforms.uSurge.value = surge;

    this.frameLines.material.color.copy(this.store.primaryColor);
    this.frameLines.material.opacity =
      0.45 + settings.glowIntensity * 0.45 + surge * 0.3;
    this.emitterStrip.material.color.copy(this.store.primaryColor);

    // Update live holographic oscilloscope & radar textures
    this.telemetryCanvas.update(
      this.simTime,
      preset.primaryHex,
      preset.secondaryHex,
      preset.accentHex,
      settings.glitchIntensity,
      settings.glowIntensity,
      settings.pulseSpeed,
      surge
    );

    const db = (82 + Math.sin(this.simTime * 3.1) * 6 + surge * 18).toFixed(1);
    this.peakReadout.text = `PEAK: ${db} dB`;

    // Update floating Core Holo Callout (tracks CyberCore + continuous figure-eight levitation)
    this.coreTarget.getWorldPosition(_coreWorldPos);
    this.worldToLocal(_coreWorldPos);
    this.calloutFloat.computeOffset(_calloutOffset, dt, floatRate, surge);
    this.coreCallout.position.set(
      _coreWorldPos.x + _calloutOffset.x,
      _coreWorldPos.y + 0.42 + _calloutOffset.y,
      _coreWorldPos.z + _calloutOffset.z
    );

    this.coreCalloutTitle.text = this.store.selectedNodeId;
    this.coreCalloutSub.text =
      surge > 0.15
        ? 'SURGE // DISCHARGING'
        : `${preset.name} // ${settings.xrMode}`;
  }

  dispose(): void {
    this.unsubscribeStore?.();
    this.unsubscribeReset?.();
    this.unsubscribeActivity?.();
    this.telemetryCanvas.dispose();
    this.backplaneMesh.geometry.dispose();
    this.backplaneMaterial.dispose();
    this.frameLines.geometry.dispose();
    this.frameLines.material.dispose();
    this.emitterBar.geometry.dispose();
    this.emitterBar.material.dispose();
    this.emitterStrip.geometry.dispose();
    this.emitterStrip.material.dispose();
    this.beamMesh.geometry.dispose();
    this.beamMaterial.dispose();
  }
}
