/**
 * Yeni mesaj sesi — WebAudio ile üretilen kısa iki tonlu "bip". Ses dosyası
 * yoktur: paket tek JS'tir, ek istek yapmaz.
 *
 * Tarayıcılar kullanıcı etkileşimi olmadan sesi engeller; `AudioContext`
 * ilk etkileşimde açılır, o zamana kadar sessizce başarısız olur.
 */
let ctx: AudioContext | null = null;

export function beep(): void {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx ||= new AC();
    if (ctx!.state === 'suspended') void ctx!.resume();

    const now = ctx!.currentTime;
    const gain = ctx!.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    gain.connect(ctx!.destination);

    const osc = ctx!.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1175, now + 0.12);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.36);
  } catch {
    /* ses widget'ı düşürmez */
  }
}
