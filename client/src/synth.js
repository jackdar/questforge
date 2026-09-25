export function createDecayEnvelope(context, time, seconds, volume) {
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(volume, time);
  envelope.gain.linearRampToValueAtTime(0, time + seconds);
  return envelope;
}

export function createNoiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
  return buffer;
}

// A reverb makes a sound ring on as if in a room. The echo of the room is noise that fades out over the given
// time, with a separate noise for each ear so that the echo sounds wide. The returned input takes the sound to
// echo, and the mix sets how loud the echo is next to the sound itself.
export function createReverb(context, destination, { seconds, decay, mix }) {
  const length = Math.floor(context.sampleRate * seconds);
  const echo = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const samples = echo.getChannelData(channel);
    for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }

  const convolver = context.createConvolver();
  convolver.buffer = echo;
  const input = context.createGain();
  input.gain.value = mix;
  input.connect(convolver).connect(destination);
  return input;
}
