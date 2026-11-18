/**
 * 《奶娃之旅》8-Bit 像素芯片音效与背景音乐引擎 (Web Audio API)
 * 无需外部音频文件，纯前端合成 NES 风格方波/三角波/噪声通道。
 */
(function () {
  const NOTE_FREQ = {
    R: 0,
    C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
    C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, Fs3: 185.00, G3: 196.00, Ab3: 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
    C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
    C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, Ab5: 830.61, A5: 880.00, Bb5: 932.33, B5: 987.77,
    C6: 1046.50, D6: 1174.66, E6: 1318.51, G6: 1567.98
  };

  // 16分音符步进的欢快地上主旋律 (8小节 = 64步, 每步16分音符，实际取8分音符序列更紧凑)
  // 格式: [主音, 低音, 鼓点('K'=底鼓, 'S'=军鼓, 'H'=踩镲, null)]
  const OVERWORLD_SEQ = [
    // Bar 1 (C)
    ["E5","C3","K"], ["E5","C3",null], ["R","G3","H"], ["E5","C3","S"],
    ["R","G3",null], ["C5","C3","K"], ["E5","G3",null], ["R","C3","H"],
    ["G5","G2","K"], ["R","G3",null], ["R","G2","H"], ["R","G3","S"],
    ["G4","G2","K"], ["R","G3",null], ["R","G2","H"], ["R","G3",null],
    // Bar 2 (C -> Am -> F -> G)
    ["C5","C3","K"], ["R","G3",null], ["R","C3","H"], ["G4","G2","S"],
    ["R","E3",null], ["R","C3","K"], ["E4","A2",null], ["R","E3","H"],
    ["R","A2","K"], ["A4","E3",null], ["B4","A2","H"], ["R","E3","S"],
    ["Bb4","G2","K"], ["A4","G3",null], ["R","G2","H"], ["R","G3",null],
    // Bar 3 (C - F - G - C)
    ["G4","C3","K"], ["E5","G3",null], ["G5","C3","H"], ["A5","F3","S"],
    ["F5","C3",null], ["G5","F3","K"], ["R","C3",null], ["E5","E3","H"],
    ["C5","A2","K"], ["D5","E3",null], ["B4","G2","H"], ["R","D3","S"],
    ["R","G2","K"], ["G4","D3",null], ["A4","G2","H"], ["B4","D3",null],
    // Bar 4 (Turnaround)
    ["C5","C3","K"], ["R","G3",null], ["G5","C3","H"], ["Fs5","B2","S"],
    ["F5","Bb2",null], ["Eb5","A2","K"], ["E5","Ab2",null], ["R","G2","H"],
    ["G4","C3","K"], ["A4","D3",null], ["C5","E3","H"], ["R","G3","S"],
    ["A4","F3","K"], ["C5","G3",null], ["D5","G2","H"], ["R","G3",null],
    // Bar 5 (B Section bright)
    ["C5","C3","K"], ["E5","G3",null], ["G5","C3","H"], ["E5","G3","S"],
    ["F5","F3",null], ["A5","C3","K"], ["G5","F3",null], ["R","C3","H"],
    ["E5","C3","K"], ["D5","G3",null], ["C5","C3","H"], ["D5","G2","S"],
    ["E5","C3","K"], ["R","G3",null], ["R","C3","H"], ["R","G3",null],
    // Bar 6 (Playful climb)
    ["F5","F3","K"], ["G5","C3",null], ["A5","F3","H"], ["F5","C3","S"],
    ["G5","E3",null], ["E5","B2","K"], ["C5","A2",null], ["D5","E3","H"],
    ["E5","C3","K"], ["D5","G2",null], ["C5","C3","H"], ["B4","G2","S"],
    ["C5","C3","K"], ["R","G3",null], ["G4","G2","H"], ["R","G3",null]
  ];

  const UNDERGROUND_SEQ = [
    ["C4","C2","K"], ["C5","C3",null], ["A3","A2","H"], ["A4","A2","S"],
    ["Bb3","Bb2","K"], ["Bb4","Bb2",null], ["R","R","H"], ["R","R",null],
    ["C4","C2","K"], ["C5","C3",null], ["A3","A2","H"], ["A4","A2","S"],
    ["Bb3","Bb2","K"], ["Bb4","Bb2",null], ["R","R","H"], ["R","R",null],
    ["F3","F2","K"], ["F4","F2",null], ["D3","D2","H"], ["D4","D2","S"],
    ["Eb3","Eb2","K"], ["Eb4","Eb2",null], ["R","R","H"], ["R","R",null],
    ["F3","F2","K"], ["F4","F2",null], ["D3","D2","H"], ["D4","D2","S"],
    ["Eb3","Eb2","K"], ["Eb4","Eb2",null], ["G3","G2","H"], ["Ab3","G2","S"]
  ];

  const STAR_SEQ = [
    ["C5","C3","K"], ["E5","G3","H"], ["G5","C3","S"], ["C6","G3","H"],
    ["G5","C3","K"], ["E5","G3","H"], ["C5","C3","S"], ["G4","G3","H"],
    ["D5","D3","K"], ["F5","A3","H"], ["A5","D3","S"], ["D6","A3","H"],
    ["A5","D3","K"], ["F5","A3","H"], ["D5","G3","S"], ["G5","G2","H"]
  ];

  class RetroAudioEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.bgmGain = null;
      this.sfxGain = null;
      this.noiseBuffer = null;

      this.muted = false;
      this.bgmEnabled = true;
      this.sfxEnabled = true;

      this.currentTrack = null; // 'overworld' | 'underground' | 'star' | null
      this.stepIndex = 0;
      this.hurry = false;
      this.timerId = null;
      this.nextNoteTime = 0;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;
        this.ctx = new AudioCtx();

        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        comp.connect(this.ctx.destination);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.45;
        this.masterGain.connect(comp);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = this.bgmEnabled ? 0.36 : 0;
        this.bgmGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.sfxEnabled ? 0.65 : 0;
        this.sfxGain.connect(this.masterGain);

        // Pre-build 0.5s white noise buffer for retro percussion & explosions
        const sampleRate = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, sampleRate * 0.5, sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return true;
    }

    setMuted(mute) {
      this.muted = mute;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.45, this.ctx.currentTime, 0.02);
      }
    }

    setBgmEnabled(enabled) {
      this.bgmEnabled = enabled;
      if (this.bgmGain && this.ctx) {
        this.bgmGain.gain.setTargetAtTime(enabled ? 0.36 : 0, this.ctx.currentTime, 0.02);
      }
    }

    setSfxEnabled(enabled) {
      this.sfxEnabled = enabled;
      if (this.sfxGain && this.ctx) {
        this.sfxGain.gain.setTargetAtTime(enabled ? 0.65 : 0, this.ctx.currentTime, 0.02);
      }
    }

    startBgm(track = "overworld") {
      if (!this.init()) return;
      if (this.currentTrack === track && this.timerId !== null) return;
      this.currentTrack = track;
      this.stepIndex = 0;
      this.nextNoteTime = this.ctx.currentTime + 0.05;
      if (this.timerId === null) {
        this.timerId = setInterval(() => this._scheduler(), 25);
      }
    }

    stopBgm() {
      this.currentTrack = null;
      if (this.timerId !== null) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }

    setHurry(isHurry) {
      this.hurry = isHurry;
    }

    _getSeq() {
      if (this.currentTrack === "underground") return UNDERGROUND_SEQ;
      if (this.currentTrack === "star") return STAR_SEQ;
      return OVERWORLD_SEQ;
    }

    _getStepDuration() {
      if (this.currentTrack === "star") return 0.11;
      if (this.currentTrack === "underground") return 0.145;
      return this.hurry ? 0.105 : 0.14;
    }

    _scheduler() {
      if (!this.ctx || !this.currentTrack || this.ctx.state !== "running") return;
      const lookAhead = 0.12;
      while (this.nextNoteTime < this.ctx.currentTime + lookAhead) {
        this._playStep(this.nextNoteTime);
        this.nextNoteTime += this._getStepDuration();
      }
    }

    _playStep(time) {
      const seq = this._getSeq();
      const [leadNote, bassNote, drum] = seq[this.stepIndex % seq.length];
      const stepDur = this._getStepDuration();
      this.stepIndex++;

      if (!this.bgmEnabled || this.muted) return;

      const leadFreq = NOTE_FREQ[leadNote] || 0;
      if (leadFreq > 0) {
        this._tone(leadFreq, time, stepDur * 0.85, "square", 0.22, this.bgmGain);
      }

      const bassFreq = NOTE_FREQ[bassNote] || 0;
      if (bassFreq > 0) {
        this._tone(bassFreq, time, stepDur * 0.9, "triangle", 0.34, this.bgmGain);
      }

      if (drum === "K") {
        this._kick(time, this.bgmGain, 0.24);
      } else if (drum === "S") {
        this._noiseBurst(time, 0.06, 1600, 0.12, this.bgmGain);
      } else if (drum === "H") {
        this._noiseBurst(time, 0.025, 5000, 0.07, this.bgmGain);
      }
    }

    _tone(freq, startTime, duration, type, volume, dest) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);
    }

    _sweep(freqStart, freqEnd, startTime, duration, type, volume, dest) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, startTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startTime + duration);

      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);
    }

    _kick(time, dest, volume = 0.35) {
      this._sweep(150, 42, time, 0.09, "triangle", volume, dest);
    }

    _noiseBurst(time, duration, cutoffHz, volume, dest) {
      if (!this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = cutoffHz;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      src.start(time);
      src.stop(time + duration + 0.01);
    }

    // ============ 8-Bit SFX ============

    sfxJump(isBig = false) {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      this._sweep(isBig ? 220 : 280, isBig ? 620 : 760, t, 0.14, "square", 0.25, this.sfxGain);
    }

    sfxCoin() {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      this._tone(NOTE_FREQ.B5, t, 0.07, "square", 0.28, this.sfxGain);
      this._tone(NOTE_FREQ.E6, t + 0.065, 0.24, "square", 0.28, this.sfxGain);
    }

    sfxBump() {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      this._sweep(140, 68, t, 0.09, "square", 0.28, this.sfxGain);
    }

    sfxBrickBreak() {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      this._noiseBurst(t, 0.15, 600, 0.4, this.sfxGain);
      this._sweep(220, 75, t, 0.12, "square", 0.25, this.sfxGain);
    }

    sfxPowerupAppear() {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      const notes = [261, 329, 392, 523, 659];
      notes.forEach((f, i) => this._tone(f, t + i * 0.045, 0.08, "square", 0.22, this.sfxGain));
    }

    sfxPowerup() {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      const notes = [392, 523, 659, 784, 659, 1046];
      notes.forEach((f, i) => this._tone(f, t + i * 0.055, 0.11, "square", 0.26, this.sfxGain));
    }

    sfxOneUp() {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      const notes = [NOTE_FREQ.E5, NOTE_FREQ.G5, NOTE_FREQ.E6, NOTE_FREQ.C6, NOTE_FREQ.D6, NOTE_FREQ.G6];
      notes.forEach((f, i) => this._tone(f, t + i * 0.06, 0.09, "square", 0.24, this.sfxGain));
    }

    sfxStomp() {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      this._sweep(380, 110, t, 0.1, "square", 0.3, this.sfxGain);
    }

    sfxKick() {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      this._sweep(460, 180, t, 0.09, "sawtooth", 0.25, this.sfxGain);
    }

    sfxShrink() {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      const notes = [520, 440, 360, 290, 220];
      notes.forEach((f, i) => this._tone(f, t + i * 0.05, 0.07, "sawtooth", 0.22, this.sfxGain));
    }

    sfxPipe() {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        this._sweep(380, 150, t + i * 0.11, 0.1, "square", 0.22, this.sfxGain);
      }
    }

    sfxDie() {
      if (!this.init()) return;
      this.stopBgm();
      if (!this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      const notes = [
        [NOTE_FREQ.B4, 0.00, 0.10],
        [NOTE_FREQ.F5, 0.11, 0.10],
        [NOTE_FREQ.F5, 0.24, 0.10],
        [NOTE_FREQ.E5, 0.35, 0.10],
        [NOTE_FREQ.D5, 0.46, 0.10],
        [NOTE_FREQ.C5, 0.58, 0.28]
      ];
      notes.forEach(([f, off, dur]) => this._tone(f, t + off, dur, "square", 0.28, this.sfxGain));
    }

    sfxFlagpole() {
      if (!this.init()) return;
      this.stopBgm();
      if (!this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      this._sweep(880, 220, t, 0.55, "square", 0.24, this.sfxGain);
    }

    sfxStageClear() {
      if (!this.init()) return;
      this.stopBgm();
      if (!this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      const fanfare = [
        [NOTE_FREQ.G4, 0.00, 0.10],
        [NOTE_FREQ.C5, 0.10, 0.10],
        [NOTE_FREQ.E5, 0.20, 0.10],
        [NOTE_FREQ.G5, 0.30, 0.10],
        [NOTE_FREQ.C6, 0.40, 0.14],
        [NOTE_FREQ.E6, 0.55, 0.22],
        [NOTE_FREQ.C6, 0.80, 0.12],
        [NOTE_FREQ.G5, 0.94, 0.12],
        [NOTE_FREQ.A5, 1.08, 0.12],
        [NOTE_FREQ.B5, 1.22, 0.12],
        [NOTE_FREQ.C6, 1.38, 0.48]
      ];
      fanfare.forEach(([f, off, dur]) => {
        this._tone(f, t + off, dur, "square", 0.25, this.sfxGain);
        this._tone(f * 0.5, t + off, dur, "triangle", 0.25, this.sfxGain);
      });
    }

    sfxFirework() {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      this._noiseBurst(t, 0.18, 900, 0.28, this.sfxGain);
      this._sweep(650, 140, t, 0.16, "square", 0.15, this.sfxGain);
    }

    sfxClick() {
      if (!this.init() || !this.sfxEnabled || this.muted) return;
      const t = this.ctx.currentTime;
      this._tone(780, t, 0.04, "square", 0.16, this.sfxGain);
    }
  }

  window.RetroAudio = new RetroAudioEngine();
})();
