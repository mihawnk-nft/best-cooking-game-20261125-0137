// Tiny synthesised sound effects: no audio files, everything is built with
// the Web Audio API the first time the player interacts, so the game loads
// nothing over the network.
export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (AudioContextClass === undefined) return null;
      context = new AudioContextClass();
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  }

  function tone(freq, seconds, type, gainValue, when) {
    if (muted) return;
    const audio = ensure();
    if (audio === null) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    const start = audio.currentTime + (when ?? 0);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  function noise(seconds, gainValue, filterFreq) {
    if (muted) return;
    const audio = ensure();
    if (audio === null) return;
    const length = Math.floor(audio.sampleRate * seconds);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = audio.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    source.start();
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    click() {
      tone(660, 0.07, 'triangle', 0.12);
    },
    chop() {
      noise(0.08, 0.25, 900);
      tone(180, 0.08, 'square', 0.1);
    },
    place() {
      tone(330, 0.06, 'triangle', 0.12);
      tone(495, 0.06, 'triangle', 0.1, 0.05);
    },
    pickup() {
      tone(440, 0.06, 'triangle', 0.12);
    },
    sizzle() {
      noise(0.5, 0.08, 2400);
    },
    served() {
      tone(523, 0.12, 'triangle', 0.16);
      tone(659, 0.12, 'triangle', 0.16, 0.09);
      tone(784, 0.2, 'triangle', 0.18, 0.18);
    },
    mistake() {
      tone(220, 0.18, 'sawtooth', 0.1);
      tone(165, 0.25, 'sawtooth', 0.1, 0.12);
    },
    expired() {
      tone(311, 0.15, 'sine', 0.14);
      tone(233, 0.3, 'sine', 0.14, 0.14);
    },
    over() {
      tone(392, 0.2, 'triangle', 0.16);
      tone(523, 0.2, 'triangle', 0.16, 0.18);
      tone(659, 0.35, 'triangle', 0.18, 0.36);
    },
  };
}
