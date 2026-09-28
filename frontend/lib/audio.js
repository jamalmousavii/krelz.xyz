// Voice notes for chat: browser audio → 16 kHz mono 16-bit WAV → base64.
//
// Ollama accepts audio in the same `images` slot as pictures, but ONLY as a
// WAV (RIFF) container at 16 kHz mono — anything else is treated as an image
// and produces garbage. So we decode whatever MediaRecorder produced
// (webm/opus, usually 48 kHz), mix down to mono, resample to 16 kHz and wrap
// it in a PCM WAV here on the client (no server-side audio dependency).

const TARGET_RATE = 16000;
const MAX_SECONDS = 60;
const MIN_SECONDS = 0.3;

// Pure helpers (exported for tests).
export function resampleLinear(input, fromRate, toRate) {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, input.length - 1);
    const frac = pos - left;
    out[i] = input[left] * (1 - frac) + input[right] * frac;
  }
  return out;
}

export function encodeWavPcm16(samples, sampleRate) {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // fmt chunk size
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true);              // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function mixToMono(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < numChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i];
  }
  if (numChannels > 1) {
    for (let i = 0; i < length; i++) mono[i] /= numChannels;
  }
  return mono;
}

/**
 * Convert a recorded audio Blob into a 16 kHz mono WAV ready for base64.
 * @returns {Promise<{ base64: string, duration: number }>}
 * @throws Error('audio-too-long' | 'audio-too-short' | 'audio-decode-failed')
 */
export async function audioBlobToWav16k(blob) {
  const arrayBuf = await blob.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(arrayBuf);
  } catch (e) {
    throw new Error('audio-decode-failed');
  } finally {
    if (ctx.close) ctx.close();
  }

  const duration = decoded.duration;
  if (duration > MAX_SECONDS) throw new Error('audio-too-long');
  if (duration < MIN_SECONDS) throw new Error('audio-too-short');

  const mono = mixToMono(decoded);
  const resampled = resampleLinear(mono, decoded.sampleRate, TARGET_RATE);
  const wav = encodeWavPcm16(resampled, TARGET_RATE);
  return {
    base64: arrayBufferToBase64(wav),
    duration,
  };
}
