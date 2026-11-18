import * as xb from 'xrblocks';

import {CyberAudio} from './audio/CyberAudio.ts';
import {CyberCore} from './scene/CyberCore.ts';
import {CyberEnvironment} from './scene/CyberEnvironment.ts';
import {NeonDustSystem} from './scene/NeonDustSystem.ts';
import {CyberFxStore} from './state/CyberFxStore.ts';
import {CyberControlDeck} from './ui/CyberControlDeck.ts';
import {HoloTerminal} from './ui/HoloTerminal.ts';

function start(): void {
  const store = new CyberFxStore();
  const audio = new CyberAudio();

  const options = new xb.Options();
  options.enableReticles();
  options.enableHands();
  options.enableXRTransitions();
  options.setAppTitle('Neon Nexus XR');
  options.setAppDescription(
    'Interactive cyberpunk WebXR environment with customizable shader effects, holographic terminals, and spatial FX controls.'
  );

  const cyberCore = new CyberCore(store, audio);

  xb.add(new CyberEnvironment(store));
  xb.add(new NeonDustSystem(store));
  xb.add(cyberCore);
  xb.add(new CyberControlDeck(store, audio));
  xb.add(new HoloTerminal(store, audio, cyberCore));
  void xb.init(options);
}

document.addEventListener('DOMContentLoaded', start);
