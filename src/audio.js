// Tiny procedural chiptune engine. No audio files — just oscillators.
const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

export class Chiptune {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    this.musicTimer = null;
    this.step = 0;
    this.nextStepTime = 0;
    this.muted = localStorage.getItem("isle-muted") === "1";
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.55;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.master);

    // 1 second of white noise for footsteps
    const length = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem("isle-muted", muted ? "1" : "0");
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.5, now + 0.08);
    }
  }

  toggle() {
    this.ensure();
    this.setMuted(!this.muted);
    return this.muted;
  }

  note(midi, time, duration, { type = "triangle", volume = 0.06, attack = 0.01, destination } = {}) {
    if (!this.ctx) return;
    const dest = destination || this.sfxGain;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(midiToFreq(midi), time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(volume, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(duration, attack + 0.02));
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + duration + 0.08);
  }

  noise(time, duration, volume, cutoff = 900) {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(time);
    src.stop(time + duration + 0.02);
  }

  sfx(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.001;
    switch (name) {
      case "open":
        this.note(72, t, 0.07, { type: "square", volume: 0.05 });
        this.note(79, t + 0.06, 0.1, { type: "square", volume: 0.05 });
        break;
      case "close":
        this.note(76, t, 0.06, { type: "square", volume: 0.04 });
        this.note(67, t + 0.05, 0.09, { type: "square", volume: 0.04 });
        break;
      case "move":
        this.note(88, t, 0.04, { type: "square", volume: 0.025 });
        break;
      case "select":
        this.note(84, t, 0.05, { type: "square", volume: 0.04 });
        this.note(91, t + 0.04, 0.07, { type: "square", volume: 0.035 });
        break;
      case "footstep":
        this.noise(t, 0.045, 0.05, 480 + Math.random() * 260);
        break;
      case "error":
        this.note(45, t, 0.09, { type: "sawtooth", volume: 0.035 });
        this.note(42, t + 0.08, 0.12, { type: "sawtooth", volume: 0.03 });
        break;
      case "fanfare":
        [72, 76, 79, 84, 88].forEach((n, i) => {
          this.note(n, t + i * 0.09, 0.2, { type: "square", volume: 0.045 });
          this.note(n - 12, t + i * 0.09, 0.2, { type: "triangle", volume: 0.03 });
        });
        break;
      case "secret":
        [79, 84, 88, 91, 96].forEach((n, i) => {
          this.note(n, t + i * 0.055, 0.3, { type: "triangle", volume: 0.05 });
        });
        this.note(60, t, 0.5, { type: "sine", volume: 0.05 });
        break;
      case "start":
        [65, 72, 77, 84].forEach((n, i) => {
          this.note(n, t + i * 0.1, 0.4, { type: "triangle", volume: 0.055 });
        });
        break;
      case "toggle":
        this.note(84, t, 0.05, { type: "square", volume: 0.04 });
        this.note(88, t + 0.05, 0.08, { type: "square", volume: 0.04 });
        break;
      default:
        break;
    }
  }

  startMusic() {
    this.ensure();
    if (!this.ctx || this.musicTimer) return;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.15;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 100);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  scheduleMusic() {
    if (!this.ctx) return;
    const stepDuration = 60 / 82 / 2; // 82 bpm, eighth notes
    const horizon = this.ctx.currentTime + 0.45;
    while (this.nextStepTime < horizon) {
      this.playStep(this.step, this.nextStepTime);
      this.nextStepTime += stepDuration;
      this.step = (this.step + 1) % 32;
    }
  }

  playStep(step, time) {
    // Fmaj7 · Dm7 · Bbmaj7 · C7 — cosy and a little wistful
    const chords = [
      [53, 57, 60, 64],
      [50, 53, 57, 60],
      [46, 50, 53, 57],
      [48, 52, 55, 58],
    ];
    const bar = Math.floor(step / 8);
    const chord = chords[bar];
    const pattern = [0, 1, 2, 3, 2, 1, 3, 2];
    const note = chord[pattern[step % 8]] + 12;

    this.note(note, time, 0.24, {
      type: "triangle",
      volume: 0.028,
      attack: 0.005,
      destination: this.musicGain,
    });

    if (step % 8 === 0) {
      this.note(chord[0] - 12, time, 1.5, {
        type: "sine",
        volume: 0.06,
        attack: 0.02,
        destination: this.musicGain,
      });
      this.note(chord[1], time, 1.6, {
        type: "sine",
        volume: 0.018,
        attack: 0.25,
        destination: this.musicGain,
      });
      this.note(chord[2], time, 1.7, {
        type: "sine",
        volume: 0.014,
        attack: 0.3,
        destination: this.musicGain,
      });
    }

    if (step % 16 === 14) {
      this.note(chord[3] + 24, time, 0.5, {
        type: "triangle",
        volume: 0.012,
        attack: 0.05,
        destination: this.musicGain,
      });
    }
  }
}
