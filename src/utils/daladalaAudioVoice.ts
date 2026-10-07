// Daladala Voice Station Announcements & Speed Safety Audio System
// Provides high-clarity transit chime (ding-dong) and natural Kiswahili speech announcements

let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
};

/**
 * Play authentic two-tone transit ding-dong chime before stop announcements
 */
export const playTransitChime = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // High bell tone 1 (587.33 Hz - D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Warm bell tone 2 (440.00 Hz - A4)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440.0, now + 0.22);
    gain2.gain.setValueAtTime(0, now + 0.22);
    gain2.gain.linearRampToValueAtTime(0.32, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.22);
    osc2.stop(now + 0.75);
  } catch (e) {
    console.warn('Transit chime failed:', e);
  }
};

/**
 * Play warning siren for speed limit violations
 */
export const playSpeedWarningSiren = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.linearRampToValueAtTime(1100, now + 0.15);
    osc.frequency.linearRampToValueAtTime(800, now + 0.3);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  } catch (e) {
    console.warn('Speed warning siren failed:', e);
  }
};

/**
 * Play emergency alert tone
 */
export const playEmergencyTone = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [0, 0.2, 0.4].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(950, now + delay);
      gain.gain.setValueAtTime(0.4, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.18);
    });
  } catch (e) {
    console.warn('Emergency alert tone failed:', e);
  }
};

/**
 * Natural speech synthesis in Kiswahili
 */
export const speakKiswahili = (text: string, playChime: boolean = true) => {
  if (typeof window === 'undefined') return;

  if (playChime) {
    playTransitChime();
  }

  if (!('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const swVoice = voices.find(
      (v) =>
        v.lang.startsWith('sw') ||
        v.name.toLowerCase().includes('swahili') ||
        v.name.toLowerCase().includes('tanzania') ||
        v.name.toLowerCase().includes('kenya')
    );

    if (swVoice) {
      utterance.voice = swVoice;
      utterance.lang = swVoice.lang;
    } else {
      utterance.lang = 'sw-TZ';
      const defaultVoice = voices.find((v) => v.default) || voices[0];
      if (defaultVoice) {
        utterance.voice = defaultVoice;
      }
    }

    setTimeout(() => {
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('SpeechSynthesis error:', err);
      }
    }, playChime ? 350 : 50);
  } catch (e) {
    console.warn('speakKiswahili failed:', e);
  }
};

/**
 * Announce upcoming station
 */
export const announceNextStation = (stationName: string, alightCount?: number) => {
  let message = `Kituo kinachofuata ni ${stationName}.`;
  if (alightCount && alightCount > 0) {
    message += ` Kuna abiria ${alightCount} wanaoshuka hapa. Abiria wa ${stationName} jiandaeni kushuka.`;
  } else {
    message += ` Abiria wa ${stationName} jiandaeni kushuka.`;
  }
  speakKiswahili(message, true);
};

/**
 * Announce arrival at station
 */
export const announceArrivalAtStation = (stationName: string) => {
  const message = `Tunawasili kituo cha ${stationName}. Tafadhali angalia mizigo yako na shuka kwa usalama upande wa kushoto.`;
  speakKiswahili(message, true);
};

/**
 * Announce LATRA speed violation
 */
export const announceSpeedLimitExceeded = (currentSpeed: number, limit: number = 50) => {
  playSpeedWarningSiren();
  const message = `Tahadhari kwa dereva! Spidi yako ni kilometa ${currentSpeed} kwa saa, umezidisha kikomo cha LATRA cha kilometa ${limit}. Punguza mwendo mara moja!`;
  setTimeout(() => {
    speakKiswahili(message, false);
  }, 250);
};

/**
 * Announce emergency report dispatched
 */
export const announceEmergencyReport = (reason: string) => {
  playEmergencyTone();
  const message = `Taarifa ya dharura: ${reason}. Ujumbe umetumwa kwa mmiliki na kituo kikuu cha stendi.`;
  setTimeout(() => {
    speakKiswahili(message, false);
  }, 350);
};
