import * as THREE from 'three';

/**
 * Procedural real-time 2D CanvasTexture renderer for animated holographic
 * waveform oscilloscopes and rotating cyber-radar node scanners.
 */
export class HoloTelemetryCanvas {
  public readonly waveformTexture: THREE.CanvasTexture;
  public readonly radarTexture: THREE.CanvasTexture;

  private readonly waveCanvas: HTMLCanvasElement;
  private readonly waveCtx: CanvasRenderingContext2D;
  private readonly radarCanvas: HTMLCanvasElement;
  private readonly radarCtx: CanvasRenderingContext2D;

  private lastDrawTime = 0;

  constructor() {
    this.waveCanvas = document.createElement('canvas');
    this.waveCanvas.width = 512;
    this.waveCanvas.height = 170;
    const wCtx = this.waveCanvas.getContext('2d');
    if (!wCtx) throw new Error('Could not create 2D context for holo waveform');
    this.waveCtx = wCtx;
    this.waveformTexture = new THREE.CanvasTexture(this.waveCanvas);
    this.waveformTexture.colorSpace = THREE.SRGBColorSpace;
    this.waveformTexture.minFilter = THREE.LinearFilter;
    this.waveformTexture.magFilter = THREE.LinearFilter;

    this.radarCanvas = document.createElement('canvas');
    this.radarCanvas.width = 256;
    this.radarCanvas.height = 256;
    const rCtx = this.radarCanvas.getContext('2d');
    if (!rCtx) throw new Error('Could not create 2D context for holo radar');
    this.radarCtx = rCtx;
    this.radarTexture = new THREE.CanvasTexture(this.radarCanvas);
    this.radarTexture.colorSpace = THREE.SRGBColorSpace;
    this.radarTexture.minFilter = THREE.LinearFilter;
    this.radarTexture.magFilter = THREE.LinearFilter;
  }

  update(
    time: number,
    primaryHex: string,
    secondaryHex: string,
    accentHex: string,
    glitch: number,
    glow: number,
    speed: number,
    surge: number
  ): void {
    // Throttle canvas redraws to ~30fps for crisp smoothness with low overhead
    if (time - this.lastDrawTime < 0.032) return;
    this.lastDrawTime = time;

    this.drawWaveform(
      time,
      primaryHex,
      secondaryHex,
      accentHex,
      glitch,
      glow,
      speed,
      surge
    );
    this.drawRadar(time, primaryHex, secondaryHex, accentHex, speed, surge);
  }

  private drawWaveform(
    time: number,
    primaryHex: string,
    secondaryHex: string,
    accentHex: string,
    glitch: number,
    glow: number,
    speed: number,
    surge: number
  ): void {
    const ctx = this.waveCtx;
    const w = this.waveCanvas.width;
    const h = this.waveCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Translucent dark cyber backdrop
    ctx.fillStyle = 'rgba(5, 14, 30, 0.72)';
    ctx.fillRect(0, 0, w, h);

    // Subtle telemetry grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Frequency spectrum bars along bottom
    const barCount = 32;
    const barW = w / barCount;
    for (let i = 0; i < barCount; i++) {
      const freq =
        0.35 +
        0.35 * Math.sin(i * 0.45 + time * (2.5 + speed * 2.0)) +
        0.3 * Math.cos(i * 0.9 - time * 3.1);
      const barH = Math.max(6, freq * (36 + surge * 34));
      ctx.fillStyle = i % 3 === 0 ? secondaryHex : primaryHex;
      ctx.globalAlpha = 0.28 + glow * 0.25;
      ctx.fillRect(i * barW + 2, h - barH, barW - 4, barH);
    }
    ctx.globalAlpha = 1;

    // Dual neural carrier waveforms
    const drawWave = (
      color: string,
      amp: number,
      freq: number,
      phase: number,
      lineW: number
    ) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 + glow * 10;

      for (let x = 0; x <= w; x += 6) {
        const nx = x / w;
        const env = Math.sin(nx * Math.PI);
        const glitchSpike =
          Math.sin(x * 0.35 + time * 24) * glitch * 14 * (surge + 0.4);
        const y =
          h * 0.46 +
          Math.sin(nx * freq + time * (2.0 + speed * 2.5) + phase) *
            amp *
            env +
          Math.cos(nx * freq * 2.3 - time * 3.4) * (amp * 0.35) +
          glitchSpike;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    drawWave(secondaryHex, 24 + surge * 18, 12, 1.3, 2);
    drawWave(primaryHex, 30 + surge * 22, 9, 0, 2.8);

    // Moving vertical cursor bar
    const scanX = ((time * 0.28) % 1) * w;
    ctx.strokeStyle = accentHex;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scanX, 0);
    ctx.lineTo(scanX, h);
    ctx.stroke();
    ctx.globalAlpha = 1;

    this.waveformTexture.needsUpdate = true;
  }

  private drawRadar(
    time: number,
    primaryHex: string,
    secondaryHex: string,
    accentHex: string,
    speed: number,
    surge: number
  ): void {
    const ctx = this.radarCtx;
    const size = this.radarCanvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.43;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(5, 14, 30, 0.72)';
    ctx.fillRect(0, 0, size, size);

    // Concentric rings
    ctx.strokeStyle = primaryHex;
    ctx.lineWidth = 1.25;
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.25 + i * 0.12;
      ctx.beginPath();
      ctx.arc(cx, cy, (r * i) / 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshairs
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();

    // Sweeping radar wedge
    const sweepAngle = time * (1.2 + speed * 1.4);
    ctx.globalAlpha = 0.38 + surge * 0.3;
    ctx.fillStyle = primaryHex;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, sweepAngle - 0.55, sweepAngle);
    ctx.closePath();
    ctx.fill();

    // Orbiting target blips
    ctx.globalAlpha = 0.95;
    for (let i = 0; i < 5; i++) {
      const a = i * 1.25 + time * (0.35 + i * 0.08);
      const dist = r * (0.3 + ((i * 0.19) % 0.6));
      const bx = cx + Math.cos(a) * dist;
      const by = cy + Math.sin(a) * dist;
      ctx.fillStyle = i % 2 === 0 ? accentHex : secondaryHex;
      ctx.beginPath();
      ctx.arc(bx, by, 4 + surge * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    this.radarTexture.needsUpdate = true;
  }

  dispose(): void {
    this.waveformTexture.dispose();
    this.radarTexture.dispose();
  }
}
