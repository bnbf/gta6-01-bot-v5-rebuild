// audio.js: fully synthesized WebAudio SFX + 4 procedural radio stations. No audio files.
import { STATIONS } from './config.js';

let ctx = null, master = null, radioTimer = null, radioStep = 0, radioStation = -1;
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur, type, vol, slideTo) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(c.currentTime + dur);
}
export function sfxShoot(w) { tone(w.name === 'Shotgun' ? 160 : 700, 0.12, 'square', 0.25, 90); }
export function sfxPickup() { tone(660, 0.1, 'sine', 0.25, 990); }
export function sfxCrash() { tone(120, 0.25, 'sawtooth', 0.3, 40); }
export function sfxSiren() { tone(700, 0.4, 'sine', 0.12, 950); }
export function sfxMission() { tone(523, 0.12, 'sine', 0.3); setTimeout(() => tone(784, 0.18, 'sine', 0.3), 120); }
export function sfxBusted() { tone(300, 0.5, 'sawtooth', 0.3, 80); }

const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };
export function setRadio(idx) {
  radioStation = idx;
  if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
  if (idx < 0) return;
  const st = STATIONS[idx];
  const scale = st.minor ? SCALES.minor : SCALES.major;
  const beatMs = 60000 / st.bpm / 2;
  radioStep = 0;
  radioTimer = setInterval(() => {
    const c = ac(); if (!c) return;
    const step = radioStep++;
    const deg = scale[step % scale.length] + 12 * Math.floor((step / scale.length) % 2);
    const freq = st.root * Math.pow(2, deg / 12);
    if (step % 4 === 0) tone(st.root / 2, 0.5, 'sine', 0.4); // bass pulse
    if (step % 2 === 0) tone(freq, 0.22, st.wave, 0.12);
    if (step % 8 === 6) tone(freq * 1.5, 0.3, 'sine', 0.08);
  }, beatMs);
}
export function radioName(idx) { return idx >= 0 ? STATIONS[idx].name : 'off'; }
export function initAudio() { ac(); }
