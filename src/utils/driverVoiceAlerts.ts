// Driver Voice & Audio Alerts System for PapoRide
// Supports Web Audio synthesized loud piercing sirens + natural Kiswahili speech synthesis

export interface DriverAudioSettings {
  soundEnabled: boolean;
  voiceEnabled: boolean;
  volume: number; // 0.0 to 1.0
  announceDestination: boolean;
  announceFare: boolean;
}

const STORAGE_KEY = 'paporide_driver_audio_settings';

export const getDefaultAudioSettings = (): DriverAudioSettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Failed to read driver audio settings from storage:", e);
  }
  return {
    soundEnabled: true,
    voiceEnabled: true,
    volume: 0.9,
    announceDestination: true,
    announceFare: true,
  };
};

export const saveAudioSettings = (settings: DriverAudioSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save driver audio settings:", e);
  }
};

// Web Audio synthesizer for loud, multi-frequency dispatch sirens (audible through street traffic and helmets)
export const playDispatchAlarm = (customVolume?: number) => {
  const settings = getDefaultAudioSettings();
  if (!settings.soundEnabled && customVolume === undefined) return;
  const vol = customVolume ?? settings.volume;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Dual-tone urgent alert pattern: 880Hz (A5) -> 1320Hz (E6) repeating 3 times
    const playPulse = (start: number, f1: number, f2: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(f1, start);
      osc.frequency.exponentialRampToValueAtTime(f2, start + 0.12);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.28 * vol, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.start(start);
      osc.stop(start + 0.23);
    };

    // 3 rapid double pulses
    for (let i = 0; i < 3; i++) {
      playPulse(now + i * 0.28, 750, 1200);
      playPulse(now + i * 0.28 + 0.12, 1000, 1500);
    }
  } catch (e) {
    console.warn("Dispatch alarm audio error:", e);
  }
};

// Arrival chime (3 uplifting rising notes)
export const playArrivalChime = () => {
  const settings = getDefaultAudioSettings();
  if (!settings.soundEnabled) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.001, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.25 * settings.volume, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.36);
    });
  } catch (e) {
    console.warn("Arrival chime failed:", e);
  }
};

// Cash & Completion celebration fanfare
export const playTripCompleteSound = () => {
  const settings = getDefaultAudioSettings();
  if (!settings.soundEnabled) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 -> E5 -> G5 -> C6

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.001, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.3 * settings.volume, now + idx * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.42);
    });
  } catch (e) {
    console.warn("Complete trip audio failed:", e);
  }
};

// Cancellation warning sound
export const playCancellationAlert = () => {
  const settings = getDefaultAudioSettings();
  if (!settings.soundEnabled) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playLowTone = (start: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, start);
      osc.frequency.exponentialRampToValueAtTime(180, start + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.25 * settings.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      osc.start(start);
      osc.stop(start + 0.26);
    };

    playLowTone(now);
    playLowTone(now + 0.18);
  } catch (e) {
    console.warn("Cancellation sound failed:", e);
  }
};

// Bonus reward victory sound
export const playBonusClaimSound = () => {
  const settings = getDefaultAudioSettings();
  if (!settings.soundEnabled) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const fanfare = [440, 554.37, 659.25, 880, 1108.73];

    fanfare.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.3 * settings.volume, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.47);
    });
  } catch (e) {
    console.warn("Bonus claim audio failed:", e);
  }
};

// Swahili Natural Speech Synthesis Engine
export const formatDistanceSwahili = (meters: number): string => {
  if (meters >= 1000) {
    const km = meters / 1000;
    if (km >= 10) {
      return `kilometa ${Math.round(km)}`;
    }
    const rounded = Math.round(km * 10) / 10;
    if (Number.isInteger(rounded)) {
      return `kilometa ${rounded}`;
    }
    const parts = rounded.toString().split('.');
    return `kilometa ${parts[0]} nukta ${parts[1]}`;
  }
  if (meters >= 100) {
    const roundedMeters = Math.round(meters / 50) * 50;
    return `mita ${roundedMeters}`;
  }
  return `mita ${Math.max(10, Math.round(meters / 10) * 10)}`;
};

export const speakSwahili = (text: string, force: boolean = false) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const settings = getDefaultAudioSettings();
  if (!settings.voiceEnabled && !force) return;

  try {
    // Cancel previous ongoing utterances to speak urgent navigation prompts immediately
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'sw-TZ';
    utterance.rate = 0.96;
    utterance.pitch = 1.05;
    utterance.volume = force ? 1.0 : settings.volume;

    // Search for Swahili voice or fallback to default
    const voices = window.speechSynthesis.getVoices();
    const swVoice = voices.find(v => v.lang.startsWith('sw') || v.name.toLowerCase().includes('swahili') || v.name.toLowerCase().includes('tanzania') || v.name.toLowerCase().includes('kenya'));
    if (swVoice) {
      utterance.voice = swVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Swahili TTS speech error:", err);
  }
};

// Swahili Navigation Voice Assistant Tracker for Driver Live Navigation
class SwahiliNavigationTracker {
  private spokenMilestones: Set<string> = new Set();
  private lastSpokenTime: number = 0;
  private currentTripId: string = '';

  public reset(tripId: string = '') {
    this.spokenMilestones.clear();
    this.lastSpokenTime = 0;
    this.currentTripId = tripId;
  }

  // Generate natural Swahili maneuver text
  public generateManeuverPrompt(
    distanceMeters: number, 
    maneuverType: 'left' | 'right' | 'straight' | 'u_turn' | 'arrive' | 'roundabout', 
    roadName?: string
  ): string {
    const distText = formatDistanceSwahili(distanceMeters);
    const cleanRoad = roadName && roadName.trim() && !roadName.toLowerCase().includes('unnamed') ? ` kuelekea ${roadName.trim()}` : '';

    if (maneuverType === 'arrive' || distanceMeters <= 50) {
      if (maneuverType === 'arrive') {
        return `Umewasili eneo la mwisho wa safari.${cleanRoad ? ` ${roadName}.` : ''} Mshushe abiria salama.`;
      }
      if (maneuverType === 'left') return `Sasa ingia kushoto${cleanRoad}.`;
      if (maneuverType === 'right') return `Sasa kata kulia${cleanRoad}.`;
      if (maneuverType === 'u_turn') return `Geuza chombo (U-turn) sasa.`;
      return `Endelea moja kwa moja.`;
    }

    if (distanceMeters >= 1000) {
      // e.g. "Baada ya kilometa 2 kata kulia kuelekea Sam Nujoma Road"
      if (maneuverType === 'right') return `Baada ya ${distText}, kata kulia${cleanRoad}.`;
      if (maneuverType === 'left') return `Baada ya ${distText}, ingia kushoto${cleanRoad}.`;
      if (maneuverType === 'roundabout') return `Baada ya ${distText}, utaingia kwenye mzunguko wa barabara${cleanRoad}.`;
      return `Baada ya ${distText}, endelea moja kwa moja${cleanRoad}.`;
    }

    // Between 100m and 999m (e.g. "Mbele mita 500 ingia kushoto")
    if (distanceMeters >= 200) {
      if (maneuverType === 'right') return `Mbele ${distText}, kata kulia${cleanRoad}.`;
      if (maneuverType === 'left') return `Mbele ${distText}, ingia kushoto${cleanRoad}.`;
      if (maneuverType === 'roundabout') return `Mbele ${distText}, ingia kwenye mzunguko${cleanRoad}.`;
      return `Mbele ${distText}, endelea moja kwa moja${cleanRoad}.`;
    }

    // 50m to 199m
    if (maneuverType === 'right') return `Mbele ${distText}, jitayarishe kukata kulia${cleanRoad}.`;
    if (maneuverType === 'left') return `Mbele ${distText}, jitayarishe kuingia kushoto${cleanRoad}.`;
    return `Mbele ${distText}, endelea na njia hii.`;
  }

  // Check and trigger voice prompts intelligently
  public checkAndAnnounce(params: {
    tripId?: string;
    totalRemainingMeters: number;
    nextStepMeters?: number;
    maneuverType?: 'left' | 'right' | 'straight' | 'u_turn' | 'arrive' | 'roundabout';
    roadName?: string;
    destinationName?: string;
    isPapoShare?: boolean;
    nextStopName?: string;
    force?: boolean;
  }) {
    const { 
      tripId = '', 
      totalRemainingMeters, 
      nextStepMeters, 
      maneuverType = 'straight', 
      roadName, 
      destinationName,
      isPapoShare,
      nextStopName,
      force = false 
    } = params;

    if (tripId && tripId !== this.currentTripId) {
      this.reset(tripId);
    }

    const now = Date.now();
    // Minimum 4 seconds between regular voice navigation prompts unless forced
    if (!force && now - this.lastSpokenTime < 4500) {
      return;
    }

    // 1. Check Remaining Trip Milestones (e.g., 3000m, 1000m, 500m, Arrival)
    const tripMilestoneGates = [
      { key: 'trip_5km', threshold: 5000, max: 5300, text: 'Imebaki kilometa 5 kufika mwisho wa safari.' },
      { key: 'trip_3km', threshold: 3000, max: 3250, text: 'Imebaki kilometa 3 kufika mwisho wa safari.' },
      { key: 'trip_2km', threshold: 2000, max: 2200, text: 'Imebaki kilometa 2 kufika mwisho wa safari.' },
      { key: 'trip_1km', threshold: 1000, max: 1150, text: 'Imebaki kilometa 1 kufika mwisho wa safari.' },
      { key: 'trip_500m', threshold: 500, max: 600, text: 'Imebaki mita 500 kufika eneo la kushusha abiria.' },
      { key: 'trip_arrived', threshold: 0, max: 60, text: isPapoShare && nextStopName 
          ? `Umewasili kituo cha kushusha ${nextStopName}.` 
          : `Umewasili eneo la mwisho wa safari ${destinationName ? `la ${destinationName}` : ''}. Mshushe abiria salama.` 
      }
    ];

    for (const gate of tripMilestoneGates) {
      if (totalRemainingMeters <= gate.max && totalRemainingMeters >= gate.threshold) {
        if (!this.spokenMilestones.has(gate.key)) {
          this.spokenMilestones.add(gate.key);
          this.lastSpokenTime = now;
          speakSwahili(gate.text, force);
          return;
        }
      }
    }

    // 2. Check Next Turn Maneuver Milestones
    if (nextStepMeters !== undefined && maneuverType && maneuverType !== 'straight') {
      const stepMilestoneGates = [
        { key: `step_3km_${maneuverType}`, min: 2800, max: 3100, dist: 3000 },
        { key: `step_2km_${maneuverType}`, min: 1900, max: 2150, dist: 2000 },
        { key: `step_1km_${maneuverType}`, min: 950, max: 1100, dist: 1000 },
        { key: `step_500m_${maneuverType}`, min: 450, max: 550, dist: 500 },
        { key: `step_200m_${maneuverType}`, min: 170, max: 230, dist: 200 },
        { key: `step_50m_${maneuverType}`, min: 20, max: 60, dist: 50 }
      ];

      for (const stepGate of stepMilestoneGates) {
        if (nextStepMeters <= stepGate.max && nextStepMeters >= stepGate.min) {
          if (!this.spokenMilestones.has(stepGate.key)) {
            this.spokenMilestones.add(stepGate.key);
            this.lastSpokenTime = now;
            const prompt = this.generateManeuverPrompt(nextStepMeters, maneuverType, roadName);
            speakSwahili(prompt, force);
            return;
          }
        }
      }
    }
  }
}

export const swahiliNavTracker = new SwahiliNavigationTracker();

// High-level Helper Action Triggers for Driver Flow
export const DriverVoice = {
  // When a new ride request arrives
  incomingRide: (pickupName: string, destName: string, fare: number) => {
    playDispatchAlarm();
    const settings = getDefaultAudioSettings();
    if (!settings.voiceEnabled) return;

    setTimeout(() => {
      const formattedFare = fare ? `Shilingi ${fare.toLocaleString()}` : '';
      const destPart = settings.announceDestination && destName ? `kuelekea ${destName}` : '';
      const farePart = settings.announceFare && formattedFare ? `Nauli ni ${formattedFare}` : '';
      const message = `Oda mpya ya safari! Kutoka ${pickupName || 'eneo la karibu'} ${destPart}. ${farePart}. Kubali sasa.`;
      speakSwahili(message);
    }, 400);
  },

  // When a new parcel delivery request arrives
  incomingParcel: (pickupName: string, fare: number) => {
    playDispatchAlarm();
    setTimeout(() => {
      const farePart = fare ? `Nauli Shilingi ${fare.toLocaleString()}` : '';
      speakSwahili(`Oda mpya ya kifurushi cha mzigo! ${farePart}.`);
    }, 400);
  },

  // When driver arrives at passenger pickup location
  arrivedAtPickup: () => {
    playArrivalChime();
    setTimeout(() => {
      speakSwahili("Umewasili eneo la mteja. Mteja amearifiwa kuwa umefika.");
    }, 300);
  },

  // When passenger gets in and trip starts
  tripStarted: (destinationName?: string) => {
    playArrivalChime();
    setTimeout(() => {
      if (destinationName) {
        speakSwahili(`Safari imeanza. Endesha kwa usalama kuelekea ${destinationName}.`);
      } else {
        speakSwahili("Safari imeanza. Endesha kwa usalama.");
      }
    }, 300);
  },

  // When trip completes
  tripCompleted: (fare: number) => {
    playTripCompleteSound();
    setTimeout(() => {
      const fareText = fare ? `Kusanya nauli ya Shilingi ${fare.toLocaleString()} kutoka kwa mteja.` : '';
      speakSwahili(`Hongera! Safari imekamilika. ${fareText}`);
    }, 450);
  },

  // When customer cancels the trip
  tripCancelled: () => {
    playCancellationAlert();
    setTimeout(() => {
      speakSwahili("Mteja ameghairi safari hii.");
    }, 300);
  },

  // Low balance warning
  lowBalance: (currentBalance: number) => {
    playCancellationAlert();
    setTimeout(() => {
      speakSwahili(`Tahadhari. Salio lako la mkoba ni Shilingi ${currentBalance.toLocaleString()}. Tafadhali ongeza salio ili uendelee kupokea wateja.`);
    }, 300);
  },

  // When quest bonus is claimed
  bonusClaimed: (rewardText: string) => {
    playBonusClaimSound();
    setTimeout(() => {
      speakSwahili(`Hongera sana! Umepokea bonasi ya ${rewardText} kwenye mkoba wako wa Papo.`);
    }, 350);
  },

  // Test sound function
  testVoice: () => {
    playDispatchAlarm();
    setTimeout(() => {
      speakSwahili("Sauti ya PapoRide iko tayari. Utasikia milio na mwongozo wa sauti ya Kiswahili wakati wote wa safari.");
    }, 400);
  }
};
