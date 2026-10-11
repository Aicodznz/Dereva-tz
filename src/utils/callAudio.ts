// Web Audio API Ringtone & Call Sound Generator
// Emulates realistic telecom tones and modern VoIP ringtones reliably in any browser

class CallAudioManager {
  private audioCtx: AudioContext | null = null;
  private ringtoneInterval: any = null;
  private dialtoneInterval: any = null;

  private getContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // Play standard incoming ringtone (melodic modern chime pulse)
  public startIncomingRingtone() {
    this.stopAll();
    try {
      const ctx = this.getContext();
      const playChimePattern = () => {
        if (!this.audioCtx || this.audioCtx.state === 'closed') return;
        const now = ctx.currentTime;
        
        // Notes: E5 (659.25Hz), G#5 (830.61Hz), B5 (987.77Hz), E6 (1318.5Hz)
        const notes = [
          { freq: 659.25, time: 0.0, dur: 0.18 },
          { freq: 830.61, time: 0.18, dur: 0.18 },
          { freq: 987.77, time: 0.36, dur: 0.22 },
          { freq: 1318.5, time: 0.58, dur: 0.35 },
          { freq: 987.77, time: 1.0, dur: 0.18 },
          { freq: 1318.5, time: 1.2, dur: 0.4 },
        ];

        notes.forEach(({ freq, time, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + time);

          gain.gain.setValueAtTime(0, now + time);
          gain.gain.linearRampToValueAtTime(0.25, now + time + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + time);
          osc.stop(now + time + dur + 0.05);
        });
      };

      playChimePattern();
      this.ringtoneInterval = setInterval(playChimePattern, 2800);
    } catch (e) {
      console.warn('[CallAudio] Unable to start ringtone:', e);
    }
  }

  // Play outgoing phone dial/ringback tone (standard 440Hz + 480Hz dual tone)
  public startOutgoingRinging() {
    this.stopAll();
    try {
      const ctx = this.getContext();
      const playRingback = () => {
        if (!this.audioCtx || this.audioCtx.state === 'closed') return;
        const now = ctx.currentTime;
        const freqs = [440, 480];

        freqs.forEach((f) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
          gain.gain.setValueAtTime(0.12, now + 1.6);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 1.85);
        });
      };

      playRingback();
      this.dialtoneInterval = setInterval(playRingback, 4000);
    } catch (e) {
      console.warn('[CallAudio] Unable to start dialtone:', e);
    }
  }

  // Play connected success chime
  public playConnectedChime() {
    this.stopAll();
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.3);
      });
    } catch {}
  }

  // Play call ended beep
  public playEndTone() {
    this.stopAll();
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      [425, 425, 425].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.2);

        gain.gain.setValueAtTime(0, now + idx * 0.2);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.2 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.2 + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.2);
        osc.stop(now + idx * 0.2 + 0.15);
      });
    } catch {}
  }

  // Stop all tones
  public stopAll() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    if (this.dialtoneInterval) {
      clearInterval(this.dialtoneInterval);
      this.dialtoneInterval = null;
    }
  }
}

export const callAudio = new CallAudioManager();
