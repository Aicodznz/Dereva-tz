import { useState, useCallback, useRef, useEffect } from 'react';
import { speakSwahili, unlockAudioContext } from '../utils/driverVoiceAlerts';

export const useVoiceNavigation = () => {
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const unlock = useCallback(() => {
    try {
      unlockAudioContext();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.resume();
        const silent = new SpeechSynthesisUtterance(' ');
        silent.volume = 0.01;
        window.speechSynthesis.speak(silent);
      }
      setIsUnlocked(true);
      setIsMuted(false);
    } catch (e) {
      console.warn("Audio unlock error:", e);
    }
  }, []);

  useEffect(() => {
    const handleGlobalInteraction = () => {
      unlock();
    };

    window.addEventListener('click', handleGlobalInteraction, { once: true });
    window.addEventListener('touchstart', handleGlobalInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleGlobalInteraction);
      window.removeEventListener('touchstart', handleGlobalInteraction);
    };
  }, [unlock]);

  const speak = useCallback((text: string, force: boolean = false) => {
    if (isMuted && !force) return;
    speakSwahili(text, force);
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (!next) {
        unlock();
        speakSwahili("Sauti ya maelekezo imewashwa.", true);
      } else {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      }
      return next;
    });
  }, [unlock]);

  return { isUnlocked, isMuted, speak, toggleMute, unlock };
};

