/**
 * audioLocker.ts
 * Tricks Android/iOS into keeping the Media Volume slider active and 
 * preventing the hardware volume buttons from defaulting back to Ringtone.
 */

// A tiny 1-byte silent WAV file encoded in base64.
const SILENT_WAV_B64 = "data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA";
let silentAudioEl: HTMLAudioElement | null = null;
let isLocked = false;

export function lockVolumeStream() {
  if (isLocked) return;
  
  if (!silentAudioEl) {
    silentAudioEl = new Audio(SILENT_WAV_B64);
    silentAudioEl.loop = true;
    // Do not set volume to 0, otherwise some OS levels ignore the playback. 
    // The WAV itself is mathematically silent.
  }
  
  silentAudioEl.play().then(() => {
    isLocked = true;
  }).catch(e => {
    console.warn("Could not lock audio stream. Needs user gesture?:", e);
  });
}

export function unlockVolumeStream() {
  if (silentAudioEl && isLocked) {
    silentAudioEl.pause();
    silentAudioEl.currentTime = 0;
  }
  isLocked = false;
}
