// 音效：全部用浏览器的 Web Audio 当场合成，不带任何音频文件。第一次点击后才会发声（浏览器要求）。
type Ctx = AudioContext;

export function createSound(isMuted: () => boolean) {
  let ctx: Ctx | null = null;
  const get = (): Ctx | null => {
    if (isMuted()) return null;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx ??= new AC();
      if (ctx.state === 'suspended') void ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  };
  const tone = (c: Ctx, freq: number, at: number, dur: number, type: OscillatorType, vol: number, to?: number) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime + at);
    if (to) o.frequency.exponentialRampToValueAtTime(to, c.currentTime + at + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime + at);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + at);
    o.stop(c.currentTime + at + dur + 0.05);
  };
  const seq = (notes: [number, number, number][], type: OscillatorType, vol: number) => {
    const c = get();
    if (c) notes.forEach(([f, at, d]) => tone(c, f, at, d, type, vol));
  };
  return {
    tap: () => seq([[660, 0, 0.06]], 'sine', 0.12),
    correct: () => seq([[523, 0, 0.14], [659, 0.1, 0.14], [784, 0.2, 0.28]], 'triangle', 0.2),
    wrong: () => {
      const c = get();
      if (c) tone(c, 220, 0, 0.32, 'sawtooth', 0.1, 110);
    },
    upgrade: () => seq([[523, 0, 0.1], [659, 0.08, 0.1], [784, 0.16, 0.1], [1047, 0.24, 0.1], [1319, 0.34, 0.3]], 'square', 0.08),
    /** good 为真时放一段上扬的小号角，否则放两个轻柔的音 */
    finish: (good: boolean) =>
      good
        ? seq([[523, 0, 0.16], [659, 0.16, 0.16], [784, 0.32, 0.16], [1047, 0.48, 0.5], [784, 0.48, 0.5]], 'triangle', 0.2)
        : seq([[392, 0, 0.25], [330, 0.25, 0.45]], 'sine', 0.18),
  };
}

export type Sound = ReturnType<typeof createSound>;
