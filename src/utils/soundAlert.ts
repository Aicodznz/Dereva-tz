export function playSyntheticNormal() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.1); // C6

    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.warn("Synth normal alert failed:", e);
  }
}

export function playSyntheticImportant() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioCtx.currentTime;

    const playTone = (freq: number, start: number, duration: number, volume: number) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gainNode.gain.setValueAtTime(volume, start);
      gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.start(start);
      osc.stop(start + duration);
    };

    // Standard beautiful chime: E5 (659Hz) then B5 (988Hz)
    playTone(659.25, now, 0.4, 0.12);
    playTone(987.77, now + 0.08, 0.6, 0.1);
  } catch (e) {
    console.warn("Synth important alert failed:", e);
  }
}

export function playSyntheticCritical() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioCtx.currentTime;
    const duration = 2.0;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = 'triangle';

    osc.frequency.setValueAtTime(440, now);
    for (let i = 0; i < duration * 2; i++) {
      const t = now + (i * 0.5);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.25);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.5);
    }

    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.setValueAtTime(0.2, now + duration - 0.2);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {
    console.warn("Synth critical alert failed:", e);
  }
}

export function playAlertSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    console.warn("Audio Context failed:", e);
  }
}

