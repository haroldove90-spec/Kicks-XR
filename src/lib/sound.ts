// Lightweight offline-safe Web Audio notification chime for both Admin & Client roles

type AlertTone = 'success' | 'info' | 'warning' | 'error';

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as {webkitAudioContext?: typeof AudioContext})
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  return audioCtx;
}

export function unlockNotificationAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

export function isNotificationSoundEnabled(): boolean {
  return soundEnabled;
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

export function playNotificationSound(tone: AlertTone = 'info'): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    const notes: Array<{freq: number; start: number; duration: number; gain: number}> =
      tone === 'success'
        ? [
            {freq: 659.25, start: 0, duration: 0.14, gain: 0.14}, // E5
            {freq: 880.0, start: 0.11, duration: 0.18, gain: 0.16}, // A5
            {freq: 1046.5, start: 0.22, duration: 0.24, gain: 0.15}, // C6
          ]
        : tone === 'warning' || tone === 'error'
          ? [
              {freq: 523.25, start: 0, duration: 0.14, gain: 0.16}, // C5
              {freq: 440.0, start: 0.16, duration: 0.22, gain: 0.15}, // A4
            ]
          : [
              {freq: 783.99, start: 0, duration: 0.14, gain: 0.14}, // G5
              {freq: 1046.5, start: 0.12, duration: 0.22, gain: 0.14}, // C6
            ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = tone === 'warning' || tone === 'error' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(note.gain, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + note.start + note.duration,
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
    }
  } catch {
    // Ignore autoplay restriction errors silently before first user gesture
  }
}
