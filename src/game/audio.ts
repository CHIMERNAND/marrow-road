export type GameAudio = {
  unlock: () => void;
  resume: () => void;
  mute: (on: boolean) => void;
  shot: (kind: "flame" | "bolt" | "shell" | "bell") => void;
  hit: () => void;
  kill: () => void;
  place: () => void;
  upgrade: () => void;
  leak: () => void;
  wave: () => void;
  victory: () => void;
  defeat: () => void;
};

export function createAudio(): GameAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let music: GainNode | null = null;
  let sfx: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let started = false;
  let muted = false;
  let voices = 0;

  function ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC({ latencyHint: "interactive" });
      master = ctx.createGain();
      music = ctx.createGain();
      sfx = ctx.createGain();
      master.gain.value = 1;
      music.gain.value = 0.9;
      sfx.gain.value = 0.85;
      music.connect(master);
      sfx.connect(master);
      master.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noise.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        brown = brown * 0.98 + white * 0.02;
        data[i] = brown * 3.2;
      }
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slide = 0,
  ) {
    const ac = ctx;
    if (!ac || !sfx || muted || voices > 24) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide !== 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(sfx);
    voices += 1;
    osc.onended = () => {
      voices = Math.max(0, voices - 1);
      osc.disconnect();
      g.disconnect();
    };
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function burst(freq: number, dur: number, gain: number) {
    const ac = ctx;
    if (!ac || !sfx || !noise || muted || voices > 24) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = 0.7;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(sfx);
    voices += 1;
    src.onended = () => {
      voices = Math.max(0, voices - 1);
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function bed() {
    const ac = ctx;
    if (!ac || !music || !noise || started) return;
    started = true;
    const o1 = ac.createOscillator();
    const o2 = ac.createOscillator();
    o1.type = "sine";
    o2.type = "triangle";
    o1.frequency.value = 55;
    o2.frequency.value = 82;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.setTargetAtTime(0.05, ac.currentTime, 0.6);
    o1.connect(g);
    o2.connect(g);
    g.connect(music);
    o1.start();
    o2.start();

    const src = ac.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 220;
    const ng = ac.createGain();
    ng.gain.value = 0.04;
    src.connect(filter);
    filter.connect(ng);
    ng.connect(music);
    src.start();
  }

  return {
    unlock() {
      ensure();
      bed();
    },
    resume() {
      if (ctx && ctx.state === "suspended") void ctx.resume();
    },
    mute(on: boolean) {
      muted = on;
      if (!master || !ctx) return;
      master.gain.setTargetAtTime(on ? 0.0001 : 1, ctx.currentTime, 0.03);
    },
    shot(kind) {
      ensure();
      if (kind === "flame") {
        tone(520 + Math.random() * 40, 0.09, "sine", 0.05, -180);
        burst(1400, 0.06, 0.04);
      } else if (kind === "bolt") {
        tone(210, 0.07, "square", 0.035, -80);
        burst(900, 0.05, 0.05);
      } else if (kind === "shell") {
        tone(140, 0.22, "sine", 0.07, -70);
        burst(240, 0.18, 0.06);
      } else {
        tone(246, 0.28, "triangle", 0.06, -30);
        tone(370, 0.22, "sine", 0.03);
      }
    },
    hit() {
      burst(1800, 0.04, 0.03);
    },
    kill() {
      tone(660, 0.08, "sine", 0.04);
      tone(880, 0.1, "sine", 0.03);
    },
    place() {
      tone(196, 0.1, "triangle", 0.05);
      tone(294, 0.12, "sine", 0.03);
    },
    upgrade() {
      tone(523, 0.08, "sine", 0.04);
      tone(659, 0.12, "sine", 0.035);
    },
    leak() {
      tone(90, 0.28, "sawtooth", 0.05, -40);
      burst(180, 0.2, 0.06);
    },
    wave() {
      tone(146, 0.18, "triangle", 0.05);
      tone(220, 0.24, "triangle", 0.04);
    },
    victory() {
      [392, 494, 587, 784].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.2, "sine", 0.05), i * 110);
      });
    },
    defeat() {
      tone(196, 0.4, "sine", 0.05, -80);
      tone(146, 0.5, "triangle", 0.04, -40);
    },
  };
}
