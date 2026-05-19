import { useState, useCallback, useRef } from 'react';

export const useVoiceNavigation = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // default to muted/unlocked state or as required
  const synthRef = useRef(window.speechSynthesis);

  const unlock = useCallback(() => {
    // MUST be called from a user gesture (button tap)
    const silent = new SpeechSynthesisUtterance(' ');
    silent.volume = 0;
    synthRef.current.speak(silent);
    setIsUnlocked(true);
    setIsMuted(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!isUnlocked || isMuted) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'sw-TZ';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    synthRef.current.speak(utterance);
  }, [isUnlocked, isMuted]);

  const toggleMute = useCallback(() => {
    if (!isUnlocked) {
      unlock();
    } else {
      setIsMuted(prev => !prev);
      synthRef.current.cancel();
    }
  }, [isUnlocked, unlock]);

  return { isUnlocked, isMuted, speak, toggleMute };
};
