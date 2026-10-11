/**
 * NFC Tap to Pay Utilities for Papo Hapo Rides
 * Supports Web NFC (Chrome Android) + Fallback Contactless Simulation for Drivers and Passengers
 */

export interface NfcPaymentPayload {
  rideId: string;
  amount: number;
  currency: string;
  passengerName?: string;
  driverName?: string;
  timestamp: number;
}

// Check if device hardware / browser supports Web NFC (NDEFReader)
export function checkNfcSupport(): boolean {
  if (typeof window === 'undefined') return false;
  return 'NDEFReader' in window;
}

// Play pleasant payment confirmation chime using Web Audio API
export function playPaymentChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Note 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.2);

    // Note 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.35);

    // Note 3: 1174.66 Hz (D6)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.16);
    gain3.gain.setValueAtTime(0.25, ctx.currentTime + 0.16);
    gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(ctx.currentTime + 0.16);
    osc3.stop(ctx.currentTime + 0.55);
  } catch (e) {
    // Audio context may be restricted by autoplay policy
  }
}

// Vibrate device with double haptic pulse
export function triggerHapticTap() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([60, 40, 90]);
    } catch {}
  }
}

// Scan NFC tag / peer device using Web NFC API
export async function startNfcReader(
  onReading: (serialNumber: string, message: string) => void,
  onError?: (err: Error) => void
): Promise<() => void> {
  if (!checkNfcSupport()) {
    throw new Error('Web NFC haipatikani kwenye kivinjari hiki au kifaa hakina chip ya NFC.');
  }

  const NDEFReaderClass = (window as any).NDEFReader;
  const reader = new NDEFReaderClass();
  const abortController = new AbortController();

  try {
    await reader.scan({ signal: abortController.signal });

    reader.onreading = (event: any) => {
      let messageText = '';
      if (event.message && event.message.records) {
        for (const record of event.message.records) {
          if (record.recordType === 'text') {
            const textDecoder = new TextDecoder(record.encoding || 'utf-8');
            messageText += textDecoder.decode(record.data);
          }
        }
      }
      onReading(event.serialNumber || 'NFC_DEVICE', messageText);
    };

    reader.onreadingerror = (err: any) => {
      onError?.(new Error('Hitilafu wakati wa kusoma NFC: ' + (err.message || 'Jaribu tena')));
    };

    return () => {
      abortController.abort();
    };
  } catch (err: any) {
    onError?.(err);
    throw err;
  }
}

// Write/Broadcast payment intent to NFC receiver (e.g. driver's device)
export async function writeNfcPaymentRecord(payload: NfcPaymentPayload): Promise<void> {
  if (!checkNfcSupport()) {
    throw new Error('Web NFC haipatikani kwenye kivinjari hiki.');
  }

  const NDEFReaderClass = (window as any).NDEFReader;
  const reader = new NDEFReaderClass();

  const textRecord = {
    recordType: 'text',
    data: JSON.stringify(payload)
  };

  await reader.write({
    records: [textRecord]
  });
}
