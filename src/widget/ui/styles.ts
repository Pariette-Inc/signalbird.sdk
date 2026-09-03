/**
 * Widget CSS'i — Shadow DOM içinde yaşar, sayfa CSS'inden izole.
 *
 * ══ TASARIM DİLİ: "AURORA" (2 Eyl 2026) ══════════════════════════════════
 *
 * Ahmet: "her şey. çok kötü. modern ve kimsenin görmediği bilmediği kadar
 * harika bişey istiyorum."
 *
 * Arayüz katmanı sıfırdan yazıldı. Çekirdek (api/store/poller/chat) aynen
 * duruyor; değişen yalnız ziyaretçinin gördüğü yüzey. Kurallar:
 *
 * 1. TEK RENKTEN BÜTÜN BİR PALET. Müşteri panelden tek bir marka rengi
 *    veriyor (`--sb-c`). Buradaki her vurgu ondan TÜRETİLİR (`color-mix`):
 *    eğim (`--sb-grad`), halka (`--sb-ring`), yumuşak zemin (`--sb-tint`).
 *    Böylece lacivert de turuncu da veren müşteride widget aynı kalitede
 *    duruyor — ikinci bir renk sormuyoruz, çünkü sorulan her ayar
 *    doldurulmayan bir ayardır.
 *
 * 2. YÜZEYLER KATMANLI. Tek düz beyaz kutu yerine üç derinlik var: zemin
 *    (`--sb-bg`), yükselti (`--sb-el` — başlık, kompozitör, kartlar) ve
 *    girinti (`--sb-s` — baloncuk, alan). Gölge tek parça değil üç katman:
 *    temas (1px), yayılma ve derinlik. Ekranda "duruyor" değil "yüzüyor".
 *
 * 3. HAREKET YAYLI, SÜSLÜ DEĞİL. Tek bir eğri (`--sb-spring`) her yerde.
 *    Panel balondan doğar (transform-origin balonun köşesi), balon panele
 *    dönüşür. `prefers-reduced-motion` her animasyonu kapatır — ve kapatınca
 *    arayüz eksik kalmaz, yalnız sakinleşir.
 *
 * 4. MOBİL BİRİNCİ SINIF. Panel tam ekran, `100dvh`, çentik/ev çubuğu
 *    boşlukları (`env(safe-area-inset-*)`), klavye açılınca kompozitör
 *    klavyenin üstünde kalır (`--sb-kb`, visualViewport'tan gelir), tepede
 *    tutamak ve aşağı sürükleyerek kapatma. Dokunma hedefleri 44px.
 *
 * 5. KENDİNİ FARK ETTİRİR AMA RAHATSIZ ETMEZ. Üç ayrı sinyal var ve üçü de
 *    ayrı işe bakar: `.teaser` (karşılama kartı — ziyaretçi henüz hiç
 *    konuşmadıysa bir kez), `.toast` (panel kapalıyken gelen yanıtın
 *    önizlemesi), `.ln-pulse` (okunmamış varken balonun sessiz nabzı).
 *    Hepsi kapatılabilir ve kapatma kararı tarayıcıda saklanır.
 *
 * 6. YAZI TİPİ DIŞARIDAN YÜKLENMEZ. Müşterinin CSP'sine takılmayalım ve
 *    sayfaya bizim gecikmemiz eklenmesin diye işletim sisteminin kendi
 *    arayüz yüzü kullanılır. Kazanç: 0 bayt, 0 istek, 0 FOUT.
 */
export const CSS = `
:host{all:initial}
*,*::before,*::after{box-sizing:border-box}

.sb{
  /* ── Marka: tek değişken gelir, palet buradan türer ── */
  --sb-c:#4f46e5;--sb-fg:#fff;
  --sb-grad:linear-gradient(145deg,color-mix(in srgb,var(--sb-c) 82%,#fff) 0%,var(--sb-c) 48%,color-mix(in srgb,var(--sb-c) 86%,#000) 100%);
  --sb-ring:color-mix(in srgb,var(--sb-c) 28%,transparent);
  --sb-tint:color-mix(in srgb,var(--sb-c) 8%,transparent);
  --sb-edge:color-mix(in srgb,var(--sb-c) 55%,var(--sb-b));

  /* ── Nötrler: soğuk eğimli. Saf gri ekranda ölüdür. ── */
  --sb-bg:#fbfbfd;--sb-el:#fff;--sb-t:#12151d;--sb-m:#6b7385;--sb-b:#e4e7ee;
  --sb-s:#f1f3f7;--sb-s2:#e8ebf1;

  /* ── Gölge: temas + yayılma + derinlik ── */
  --sb-sh:0 1px 1px rgba(16,20,30,.04),0 8px 24px -6px rgba(16,20,30,.14),0 32px 64px -24px rgba(16,20,30,.26);
  --sb-sh-s:0 1px 2px rgba(16,20,30,.06),0 6px 18px -6px rgba(16,20,30,.16);

  --sb-r:22px;--sb-rb:18px;
  --sb-spring:cubic-bezier(.22,1.12,.36,1);
  --sb-kb:0px;              /* mobil klavye yüksekliği — visualViewport verir */
  --sb-dx:0px;--sb-dy:0px;  /* ziyaretçinin taşıdığı miktar */

  position:fixed;bottom:max(20px,env(safe-area-inset-bottom));z-index:2147483000;
  font:400 14px/1.5 ui-sans-serif,system-ui,-apple-system,"SF Pro Text","Segoe UI Variable Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  font-feature-settings:"cv11","ss01";font-variant-ligatures:common-ligatures;
  color:var(--sb-t);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  direction:ltr;text-align:left;
}
.sb.right{right:max(20px,env(safe-area-inset-right))}
.sb.left{left:max(20px,env(safe-area-inset-left))}

.sb.dark{
  --sb-bg:#101319;--sb-el:#171b23;--sb-t:#e9ecf3;--sb-m:#98a0b2;--sb-b:#272c37;
  --sb-s:#1c212a;--sb-s2:#242a35;
  --sb-tint:color-mix(in srgb,var(--sb-c) 16%,transparent);
  --sb-sh:0 1px 1px rgba(0,0,0,.5),0 12px 32px -8px rgba(0,0,0,.6),0 40px 80px -28px rgba(0,0,0,.7);
  --sb-sh-s:0 2px 8px rgba(0,0,0,.4),0 10px 24px -8px rgba(0,0,0,.5);
}

button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
button:disabled{cursor:default}
input,textarea,select{font:inherit;color:inherit}
svg{display:block;flex:none}
a{color:inherit}
:focus-visible{outline:2px solid var(--sb-c);outline-offset:2px;border-radius:6px}

/* ══ BALON ═══════════════════════════════════════════════════════════════ */
.ln{position:relative;display:flex;align-items:center;gap:10px;height:60px;min-width:60px;padding:0 22px 0 18px;
border-radius:30px;background:var(--sb-grad);color:var(--sb-fg);
box-shadow:0 2px 6px rgba(16,20,30,.16),0 12px 28px -8px var(--sb-ring),0 24px 48px -20px rgba(16,20,30,.32);
transition:transform .3s var(--sb-spring),box-shadow .3s ease,opacity .2s ease}
.ln::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 55%)}
.ln:hover{transform:translateY(-3px) scale(1.03)}
.ln:active{transform:translateY(-1px) scale(.99)}
.ln.icon-only{padding:0;justify-content:center;width:60px}
.ln .lt{position:relative;font-weight:600;font-size:15px;letter-spacing:-.012em;white-space:nowrap}
.ln .lg{width:32px;height:32px;border-radius:50%;object-fit:cover}
.ln .lm{position:relative;transition:transform .35s var(--sb-spring)}
.ln:hover .lm{transform:rotate(-8deg) scale(1.06)}

/* Ajanın çevrimiçi olduğunu balonda söylüyoruz: sohbete girmeden önce
   "şu an biri var mı" sorusunun cevabı görünsün. */
.ln-on{position:absolute;right:-1px;bottom:-1px;width:15px;height:15px;border-radius:50%;background:#22c55e;
border:3px solid var(--sb-bg);display:none}
.sb.agent-on .ln.icon-only .ln-on{display:block}

.badge{position:absolute;top:-2px;right:-2px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;
background:#f43f5e;color:#fff;font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums;
display:none;align-items:center;justify-content:center;border:2.5px solid var(--sb-bg);
box-shadow:0 2px 8px rgba(244,63,94,.45);animation:sbPop .4s var(--sb-spring)}
.badge.on{display:flex}
@keyframes sbPop{from{transform:scale(0)}to{transform:scale(1)}}

/* Okunmamış varken sessiz nabız — hareket, sessiz sekmede görülen tek sinyal.
   Rozet küçüktür, ses ise tarayıcı etkileşim beklediği için çoğu kez hiç
   çalmaz (bkz. sound.ts). */
.ln-pulse{position:absolute;inset:0;border-radius:inherit;pointer-events:none;display:none}
.sb.pulse .ln-pulse{display:block}
.ln-pulse::after{content:'';position:absolute;inset:0;border-radius:inherit;
box-shadow:0 0 0 0 var(--sb-ring);animation:sbRing 2.4s ease-out infinite}
@keyframes sbRing{0%{box-shadow:0 0 0 0 var(--sb-ring)}70%,100%{box-shadow:0 0 0 20px transparent}}

/* Yeni mesaj geldiğinde tek seferlik yaylanma. */
@keyframes sbAttn{0%,100%{transform:none}18%{transform:scale(1.14) rotate(-3deg)}36%{transform:scale(.97) rotate(2deg)}
56%{transform:scale(1.07)}78%{transform:scale(.99)}}
.ln.attn{animation:sbAttn 1.1s var(--sb-spring) 2}

.sb.open .ln,.sb.hidden .ln,.sb.no-ln .ln{opacity:0;pointer-events:none;transform:scale(.7);position:absolute;bottom:0}
.sb.right.open .ln,.sb.right.hidden .ln,.sb.right.no-ln .ln{right:0}
.sb.left.open .ln,.sb.left.hidden .ln,.sb.left.no-ln .ln{left:0}

/* Balonu tamamen kapatma. Ayrı düğmedir, balonun İÇİNDE değil: iç içe düğme
   HTML'de geçersiz ve dokunmatikte "kapatayım derken açtım" hatasını doğurur. */
.dm{position:absolute;top:-8px;width:24px;height:24px;border-radius:12px;background:var(--sb-el);color:var(--sb-m);
box-shadow:var(--sb-sh-s);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;
transition:opacity .18s,transform .18s var(--sb-spring);transform:scale(.8);z-index:2}
.sb.right .dm{right:-8px}.sb.left .dm{left:-8px}
.sb:hover .dm{opacity:1;pointer-events:auto;transform:scale(1)}
.dm:hover{color:var(--sb-t);background:var(--sb-s)}
.sb.open .dm,.sb.hidden .dm,.sb.no-ln .dm{display:none}
@media (hover:none){.dm{opacity:1;pointer-events:auto;transform:scale(1)}}

/* ══ KARŞILAMA KARTI (teaser) ════════════════════════════════════════════
   Ziyaretçi henüz hiç konuşmadıysa, sayfada bir süre kaldıktan sonra bir
   KEZ açılır. Kapatılırsa bir daha çıkmaz (karar tarayıcıda saklanır).
   Sohbeti başlatan şey balonun kendisi değil, bu cümledir. */
.teaser{position:absolute;bottom:74px;width:296px;max-width:calc(100vw - 40px);display:none;
background:var(--sb-el);border:1px solid var(--sb-b);border-radius:20px;box-shadow:var(--sb-sh);
padding:14px 15px;gap:11px;align-items:flex-start;cursor:pointer;text-align:left;
animation:sbTeaser .5s var(--sb-spring) both}
.sb.right .teaser{right:0;transform-origin:bottom right}
.sb.left .teaser{left:0;transform-origin:bottom left}
.sb.tz .teaser{display:flex}
.sb.open .teaser,.sb.hidden .teaser{display:none}
.teaser:hover{border-color:var(--sb-edge)}
@keyframes sbTeaser{from{opacity:0;transform:translateY(14px) scale(.92)}to{opacity:1;transform:none}}
.teaser .tv{width:40px;height:40px;border-radius:50%;overflow:hidden;flex:none;background:var(--sb-s2);
display:flex;align-items:center;justify-content:center;font-weight:650;font-size:14px;color:var(--sb-t)}
.teaser .tv img{width:100%;height:100%;object-fit:cover}
.teaser .tc{flex:1;min-width:0}
.teaser .tn{font-size:12px;font-weight:650;color:var(--sb-m);letter-spacing:.01em;margin-bottom:2px}
.teaser .tb{font-size:13.5px;line-height:1.45;color:var(--sb-t);
display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.teaser .tx{width:22px;height:22px;border-radius:11px;color:var(--sb-m);display:flex;align-items:center;justify-content:center;
flex:none;margin:-4px -4px 0 0}
.teaser .tx:hover{background:var(--sb-s);color:var(--sb-t)}

/* ══ MESAJ ÖNİZLEMESİ (toast) ════════════════════════════════════════════
   Panel kapalıyken ajan yazdığında balonun üstünde belirir. Rozet "bir şey
   var" der; bu kart NE olduğunu söyler — açılma oranını belirleyen fark. */
.toast{position:absolute;bottom:74px;width:296px;max-width:calc(100vw - 40px);display:none;gap:11px;
background:var(--sb-el);border:1px solid var(--sb-b);border-radius:20px;box-shadow:var(--sb-sh);
padding:13px 14px;align-items:flex-start;cursor:pointer;text-align:left;
animation:sbTeaser .45s var(--sb-spring) both}
.sb.right .toast{right:0;transform-origin:bottom right}
.sb.left .toast{left:0;transform-origin:bottom left}
.sb.tst .toast{display:flex}
.sb.tst .teaser{display:none}
.sb.open .toast{display:none}
.toast .tv{width:36px;height:36px;border-radius:50%;overflow:hidden;flex:none;background:var(--sb-s2);
display:flex;align-items:center;justify-content:center;font-weight:650;font-size:13px}
.toast .tv img{width:100%;height:100%;object-fit:cover}
.toast .tn{font-size:12px;font-weight:650;margin-bottom:2px}
.toast .tb{font-size:13px;line-height:1.45;color:var(--sb-m);
display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* ══ PANEL ═══════════════════════════════════════════════════════════════ */
.pn{position:absolute;bottom:0;width:404px;max-width:calc(100vw - 40px);
height:min(688px,calc(100vh - 40px));background:var(--sb-bg);border-radius:var(--sb-r);
box-shadow:var(--sb-sh);display:none;flex-direction:column;overflow:hidden;
border:1px solid color-mix(in srgb,var(--sb-b) 70%,transparent)}
.sb.right .pn{right:0;transform-origin:bottom right}
.sb.left .pn{left:0;transform-origin:bottom left}
.sb.open .pn{display:flex;animation:sbIn .42s var(--sb-spring)}
.sb.right .pn{translate:calc(-1 * var(--sb-dx)) calc(-1 * var(--sb-dy))}
.sb.left .pn{translate:var(--sb-dx) calc(-1 * var(--sb-dy))}
.sb.moving .pn,.sb.sizing .pn{animation:none!important;transition:none;user-select:none}
@keyframes sbIn{from{opacity:0;transform:translateY(24px) scale(.9)}to{opacity:1;transform:none}}

/* Marka ışığı: rengin panele değdiği yer. Blok bir başlık şeridi değil —
   tepeden aşağı sönen bir aydınlanma. Renk AZ yerde, HER ZAMAN aynı anlamda. */
.glow{position:absolute;top:0;left:0;right:0;height:190px;pointer-events:none;z-index:0;
background:radial-gradient(120% 100% at 50% 0%,var(--sb-tint) 0%,transparent 72%)}

/* ── Çekmece (layout:'sidebar') ── */
.sb.sidebar{top:0;bottom:0;height:100vh;height:100dvh;display:flex;align-items:flex-end;padding-bottom:20px}
.sb.sidebar .pn{position:fixed;top:0;bottom:0;height:100vh;height:100dvh;width:432px;max-width:100vw;
border-radius:0;border:0;translate:none!important}
.sb.sidebar.right .pn{right:0;left:auto}
.sb.sidebar.left .pn{left:0;right:auto}
.sb.sidebar.open .pn{animation:sbSlide .4s var(--sb-spring)}
.sb.sidebar.left.open .pn{animation-name:sbSlideL}
@keyframes sbSlide{from{opacity:.5;transform:translateX(40px)}to{opacity:1;transform:none}}
@keyframes sbSlideL{from{opacity:.5;transform:translateX(-40px)}to{opacity:1;transform:none}}
.sb.sidebar .gp,.sb.sidebar .drag{display:none}

@media (prefers-reduced-motion:reduce){
  .sb *,.sb *::before,.sb *::after{animation:none!important;transition:none!important}
}

/* ══ MOBİL ═══════════════════════════════════════════════════════════════
   Panel tam ekran. Klavye açılınca gövde kısalır (--sb-kb) — kompozitör
   klavyenin altında kalıp erişilemez olmuyor. Tepedeki tutamak aşağı
   sürüklenerek kapatılır; mobilde "kapat" düğmesini aramak yerine alışılmış
   jest çalışır. */
@media (max-width:640px){
  .sb.open{inset:0!important;padding:0}
  .sb.open .pn{position:fixed;inset:0;width:100%!important;max-width:none;
    height:calc(100dvh - var(--sb-kb))!important;border-radius:0;border:0;translate:none!important;
    animation:sbUp .34s var(--sb-spring)}
  @keyframes sbUp{from{opacity:.6;transform:translateY(28px)}to{opacity:1;transform:none}}
  .gp{display:none!important}
  /* Taban kural (.drag{display:none}) bu bloktan SONRA geliyor; eşit
     özgüllükte sonraki kazanırdı. Seçici bilerek daha özgül. */
  .sb.open .drag{display:flex}
  .hd{padding-top:calc(6px + env(safe-area-inset-top))}
  .cp{padding-bottom:calc(10px + env(safe-area-inset-bottom))}
  .sb.open.kb .cp{padding-bottom:10px}
  .teaser,.toast{width:calc(100vw - 40px)}
  .cr textarea{font-size:16px}  /* iOS 16px altında sayfayı yakınlaştırır */
  .row{max-width:88%}
}

/* Aşağı sürükleyerek kapatma tutamağı (yalnız mobil). */
.drag{display:none;justify-content:center;padding:10px 0 4px;flex:none;position:relative;z-index:2;
touch-action:none;cursor:grab}
.drag i{width:42px;height:5px;border-radius:3px;background:var(--sb-m);opacity:.35}
.drag:active i{opacity:.6}
.sb.dragging .pn{transition:none}

/* Boyutlandırma tutamağı — panelin DIŞ köşesinde (sağdaysa sol üst); iç köşe
   tam da kaydırma çubuğuna denk gelirdi. */
.gp{position:absolute;width:20px;height:20px;z-index:6;opacity:0;transition:opacity .15s}
.sb.right .gp{top:0;left:0;cursor:nwse-resize}
.sb.left .gp{top:0;right:0;cursor:nesw-resize}
.sb.open .pn:hover .gp{opacity:.45}
.gp:hover{opacity:1!important}
.gp::after{content:"";position:absolute;top:7px;width:9px;height:9px;border-color:var(--sb-m);border-style:solid}
.sb.right .gp::after{left:7px;border-width:1.5px 0 0 1.5px;border-radius:4px 0 0 0}
.sb.left .gp::after{right:7px;border-width:1.5px 1.5px 0 0;border-radius:0 4px 0 0}

/* ══ BAŞLIK ══════════════════════════════════════════════════════════════ */
.hd{position:relative;z-index:1;display:flex;align-items:center;gap:12px;padding:14px 12px 14px 16px;flex:none;
cursor:grab;touch-action:none}
.sb.moving .hd{cursor:grabbing}
.hd .av{position:relative;width:42px;height:42px;border-radius:50%;flex:none;overflow:visible}
.hd .av .ph{width:100%;height:100%;border-radius:50%;overflow:hidden;background:var(--sb-s2);color:var(--sb-t);
display:flex;align-items:center;justify-content:center;font-weight:650;font-size:15px;letter-spacing:-.02em;
box-shadow:0 0 0 2px var(--sb-bg),0 0 0 3.5px var(--sb-ring)}
.hd .av img{width:100%;height:100%;object-fit:cover}
.hd .dot{position:absolute;right:-1px;bottom:-1px;width:13px;height:13px;border-radius:50%;background:#9ca3af;
border:2.5px solid var(--sb-bg);transition:background .2s}
.hd .dot.on{background:#22c55e}
.hd .dot.on::after{content:'';position:absolute;inset:-2px;border-radius:50%;
box-shadow:0 0 0 0 rgba(34,197,94,.5);animation:sbLive 2.6s ease-out infinite}
@keyframes sbLive{0%{box-shadow:0 0 0 0 rgba(34,197,94,.45)}70%,100%{box-shadow:0 0 0 9px transparent}}
.hd .hi{flex:1;min-width:0}
.hd .hn{font-weight:650;font-size:15.5px;letter-spacing:-.018em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hd .hs{font-size:12.5px;color:var(--sb-m);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.hd .ha{display:flex;align-items:center;gap:2px;flex:none}
.hb{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--sb-m);flex:none;
transition:background .15s,color .15s}
.hb:hover{background:var(--sb-s);color:var(--sb-t)}
.hb.hide{display:none}

/* ══ BANT ════════════════════════════════════════════════════════════════ */
.bn{position:relative;z-index:1;display:none;align-items:center;gap:8px;margin:0 12px 8px;padding:10px 13px;
font-size:12.5px;line-height:1.45;border-radius:14px;background:#fff7e6;color:#8a5a06;border:1px solid #f5e2bb}
.bn.on{display:flex}
.bn.err{background:#fdecec;color:#9b2c2c;border-color:#f3cdcd}
.sb.dark .bn{background:#2a2313;color:#e9c47f;border-color:#3b3117}
.sb.dark .bn.err{background:#2c1919;color:#f0a8a8;border-color:#432020}

/* ══ GÖVDE ═══════════════════════════════════════════════════════════════ */
.bd{position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column}
.ml{flex:1;overflow-y:auto;padding:10px 16px 12px;display:flex;flex-direction:column;
overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--sb-b) transparent}
/* Mesajlar alta yaslanır. justify-content:flex-end taşma olunca listenin
   ÜSTÜNÜ kırpıyor; sözde öğeye verilen margin-top:auto ise hem az mesajda
   alta yaslar hem çok mesajda normal kaydırmayı bozmaz. */
.ml::before{content:'';margin-top:auto}
.ml::-webkit-scrollbar{width:10px}
.ml::-webkit-scrollbar-thumb{background:var(--sb-b);border-radius:5px;border:3px solid transparent;background-clip:content-box}
.ml::-webkit-scrollbar-thumb:hover{background:var(--sb-m);background-clip:content-box}

/* ── Boş ekran: form duvarı değil, davet ──────────────────────────────────
   Ziyaretçi paneli açtığında ilk gördüğü şey ya bir form ya boş bir kutuydu.
   Şimdi: karşılama cümlesi, yanıt süresi ve tek dokunuşla başlatan konu
   çipleri. "Ne yazacağımı bilmiyorum" en sık terk sebebidir. */
.hero{margin-top:auto;padding:26px 6px 14px;display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.hero .hv{display:flex;margin-bottom:12px}
.hero .hv span{width:44px;height:44px;border-radius:50%;overflow:hidden;background:var(--sb-s2);
display:flex;align-items:center;justify-content:center;font-weight:650;font-size:15px;color:var(--sb-t);
box-shadow:0 0 0 3px var(--sb-bg);margin-left:-12px}
.hero .hv span:first-child{margin-left:0}
.hero .hv img{width:100%;height:100%;object-fit:cover}
.hero h4{margin:0;font-size:22px;font-weight:680;letter-spacing:-.028em;line-height:1.25;text-wrap:balance;
background:var(--sb-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{margin:2px 0 0;color:var(--sb-m);font-size:13.5px;line-height:1.5}
.qk{display:flex;flex-wrap:wrap;gap:7px;margin-top:16px}
.qk button{font-size:13px;font-weight:550;padding:9px 14px;border-radius:14px;background:var(--sb-el);
border:1px solid var(--sb-b);color:var(--sb-t);box-shadow:var(--sb-sh-s);
transition:transform .2s var(--sb-spring),border-color .15s,background .15s}
.qk button:hover{transform:translateY(-2px);border-color:var(--sb-edge);background:var(--sb-tint)}

/* Kanal ajanının seçenekleri — baloncuğun altında dikey liste */
.opts{display:flex;flex-direction:column;gap:6px;margin-top:6px;max-width:100%}
.opts a,.opts button{display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;
font-size:13px;font-weight:550;padding:9px 12px;border-radius:12px;background:var(--sb-el);
border:1px solid var(--sb-b);color:var(--sb-t);box-shadow:var(--sb-sh-s);text-decoration:none;cursor:pointer;
transition:transform .2s var(--sb-spring),border-color .15s,background .15s}
.opts a:hover,.opts button:hover:not([disabled]){transform:translateY(-1px);border-color:var(--sb-edge);background:var(--sb-tint)}
.opts button[disabled]{opacity:.55;cursor:default}
.opts.past a{opacity:.8}

.day{align-self:center;font-size:11px;font-weight:650;letter-spacing:.02em;color:var(--sb-m);
background:var(--sb-s);padding:5px 12px;border-radius:12px;margin:14px 0 10px}

/* ══ MESAJ SATIRI ════════════════════════════════════════════════════════
   Aynı kişinin arka arkaya mesajları GRUPLANIR: avatar bir kez, saat bir kez,
   aradaki boşluk 2px. Her mesaja avatar basmak sohbeti liste gibi gösteriyor;
   gruplanınca konuşma gibi görünüyor. */
.row{display:flex;gap:8px;max-width:84%;position:relative;margin-top:2px}
.row.gap{margin-top:12px}
.row.v{align-self:flex-end;flex-direction:row-reverse}
.row.a{align-self:flex-start}
.row.s{align-self:center;max-width:92%;margin:8px 0}
.row .av{width:28px;height:28px;border-radius:50%;overflow:hidden;flex:none;align-self:flex-end;background:var(--sb-s2);
display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:650;color:var(--sb-m)}
.row .av img{width:100%;height:100%;object-fit:cover}
.row .av.gh{visibility:hidden}
/* Öbeğin son satırında baloncuğun ALTINDA saat satırı var; avatar onunla değil
   baloncukla hizalanmalı — yoksa yüz, mesajın bir satır aşağısına kayıyor. */
.row.a:not(.mid) .av{margin-bottom:19px}
.row .cl{display:flex;flex-direction:column;min-width:0}
.row.v .cl{align-items:flex-end}

.bb{position:relative;padding:10px 14px;border-radius:var(--sb-rb);word-wrap:break-word;overflow-wrap:anywhere;
white-space:pre-wrap;line-height:1.5;font-size:14px;max-width:100%}
.row.a .bb{background:var(--sb-el);border:1px solid var(--sb-b);border-bottom-left-radius:6px;box-shadow:var(--sb-sh-s)}
.row.v .bb{background:var(--sb-grad);color:var(--sb-fg);border-bottom-right-radius:6px;
box-shadow:0 2px 8px -2px var(--sb-ring),0 8px 20px -10px var(--sb-ring)}
.row.a.mid .bb{border-bottom-left-radius:var(--sb-rb)}
.row.v.mid .bb{border-bottom-right-radius:var(--sb-rb)}
.row.pend .bb{opacity:.65}
.row.fail .bb{background:#fdecec;color:#9b2c2c;border:1px solid #f3cdcd;cursor:pointer;box-shadow:none}
.bb.del{font-style:italic;opacity:.65}
.row.s .bb{background:none;border:0;box-shadow:none;color:var(--sb-m);font-size:12px;text-align:center;padding:4px 10px}
.bb a{text-decoration:underline;text-underline-offset:2px}

/* Yeni gelen mesaj yerine oturur — liste zıplamaz, mesaj belirir. */
@keyframes sbMsg{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
.row.new .bb{animation:sbMsg .34s var(--sb-spring)}

.q{display:block;border-left:2.5px solid currentColor;opacity:.75;padding:4px 10px;margin:0 0 8px;font-size:12px;
border-radius:5px;background:rgba(120,130,150,.12);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:250px}
.row.v .q{background:rgba(255,255,255,.18)}
.mt{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--sb-m);margin-top:4px;padding:0 4px;
font-variant-numeric:tabular-nums}
.mt .tk{display:inline-flex}.mt .tk.rd{color:#3b82f6}
.mt .ed{font-style:italic}
.imgs{display:flex;flex-wrap:wrap;gap:4px;margin:2px 0}
.imgs img{max-width:216px;max-height:200px;border-radius:13px;display:block;cursor:zoom-in;object-fit:cover;background:var(--sb-s2)}
.fr{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:13px;background:rgba(120,130,150,.13);
margin:2px 0;text-decoration:none;font-size:13px;max-width:260px}
.row.v .fr{background:rgba(255,255,255,.16)}
.fr .fn{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1}
.fr .fs{opacity:.7;font-size:11px;white-space:nowrap;font-variant-numeric:tabular-nums}
.rx{display:flex;flex-wrap:wrap;gap:4px;margin-top:-6px;padding:0 4px;z-index:1}
.rx button{font-size:12px;padding:3px 9px;border-radius:12px;background:var(--sb-el);border:1px solid var(--sb-b);
line-height:1.5;box-shadow:var(--sb-sh-s)}
.rx button.me{border-color:var(--sb-c);background:var(--sb-tint)}
.row.v .rx{justify-content:flex-end}

/* Mesaj eylem çubuğu — masaüstünde hover, dokunmatikte uzun basış. */
.ac{position:absolute;top:-34px;display:flex;align-items:center;gap:2px;background:var(--sb-el);
border:1px solid var(--sb-b);border-radius:20px;padding:3px 5px;box-shadow:var(--sb-sh-s);z-index:3;
opacity:0;pointer-events:none;transform:translateY(4px) scale(.94);transition:opacity .15s,transform .18s var(--sb-spring)}
.row.a .ac{left:36px}.row.v .ac{right:36px}
.row:hover .ac,.row.acts .ac{opacity:1;pointer-events:auto;transform:none}
.ac button{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;
font-size:15px;color:var(--sb-t);transition:background .12s,transform .18s var(--sb-spring)}
.ac button:hover{background:var(--sb-s);transform:scale(1.18)}
.menu{position:absolute;top:0;display:none;flex-direction:column;background:var(--sb-el);border:1px solid var(--sb-b);
border-radius:14px;box-shadow:var(--sb-sh);z-index:4;min-width:140px;overflow:hidden;padding:5px}
.row.a .menu{left:36px}.row.v .menu{right:36px}
.menu.show{display:flex;animation:sbTeaser .2s var(--sb-spring)}
.menu button{padding:9px 12px;text-align:left;font-size:13px;border-radius:9px}
.menu button:hover{background:var(--sb-s)}
.menu button.dg{color:#e11d48}

/* Yazıyor — üç nokta, ajanın baloncuğunun yerinde. */
.tp{display:none;align-items:center;gap:8px;padding:6px 16px 10px}
.tp.on{display:flex;animation:sbMsg .3s var(--sb-spring)}
.tp .av{width:28px;height:28px;border-radius:50%;overflow:hidden;background:var(--sb-s2);flex:none;
display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:650;color:var(--sb-m)}
.tp .av img{width:100%;height:100%;object-fit:cover}
.tp .dots{display:flex;align-items:center;gap:4px;background:var(--sb-el);border:1px solid var(--sb-b);
border-radius:var(--sb-rb);border-bottom-left-radius:6px;padding:12px 14px;box-shadow:var(--sb-sh-s)}
.tp i{width:6px;height:6px;border-radius:50%;background:var(--sb-m);animation:sbDot 1.3s infinite ease-in-out}
.tp i:nth-child(2){animation-delay:.18s}.tp i:nth-child(3){animation-delay:.36s}
@keyframes sbDot{0%,75%,100%{transform:translateY(0);opacity:.35}35%{transform:translateY(-4px);opacity:1}}

/* Aşağı in düğmesi — uzun geçmişte "yeni mesaj aşağıda" kaybolmasın. */
.jump{position:absolute;left:50%;bottom:8px;transform:translateX(-50%) translateY(8px);opacity:0;pointer-events:none;
display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:16px;background:var(--sb-el);
border:1px solid var(--sb-b);box-shadow:var(--sb-sh-s);font-size:12.5px;font-weight:600;color:var(--sb-t);
transition:opacity .2s,transform .25s var(--sb-spring);z-index:3}
.jump.on{opacity:1;pointer-events:auto;transform:translateX(-50%)}

/* ══ KOMPOZİTÖR ══════════════════════════════════════════════════════════ */
.cp{position:relative;z-index:1;padding:10px 12px 8px;flex:none;background:var(--sb-bg);
border-top:1px solid color-mix(in srgb,var(--sb-b) 60%,transparent)}
.rq{display:none;align-items:center;gap:8px;font-size:12px;color:var(--sb-m);padding:7px 10px;
border-left:2.5px solid var(--sb-c);background:var(--sb-s);border-radius:0 10px 10px 0;margin:0 0 8px}
.rq.on{display:flex;animation:sbMsg .25s var(--sb-spring)}
.rq .rt{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.rq button{opacity:.7;display:flex}
.chips{display:none;flex-wrap:wrap;gap:6px;padding:0 0 8px}
.chips.on{display:flex}
.chip{position:relative;display:flex;align-items:center;gap:8px;font-size:12px;background:var(--sb-el);
border:1px solid var(--sb-b);border-radius:12px;padding:5px 9px;max-width:100%;box-shadow:var(--sb-sh-s)}
.chip img{width:30px;height:30px;object-fit:cover;border-radius:8px}
.chip span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:150px}
.chip button{opacity:.6;line-height:1;display:flex}
.chip button:hover{opacity:1}

/* Kalan karakter — sınıra yaklaşınca belirir, sıfırda uyarır. Sürekli duran
   bir sayaç kısa yazmayı kural gibi gösterip sohbetin tonunu bozardı. */
.cnt{display:none;justify-content:flex-end;padding:0 6px 4px;font-size:11px;font-weight:600;
color:var(--sb-m);font-variant-numeric:tabular-nums}
.cnt.on{display:flex}
.cnt.full{color:#e11d48}

.cr{display:flex;align-items:flex-end;gap:6px;background:var(--sb-el);border:1.5px solid var(--sb-b);
border-radius:20px;padding:4px 5px 4px 6px;transition:border-color .18s,box-shadow .18s}
.cr:focus-within{border-color:var(--sb-edge);box-shadow:0 0 0 4px var(--sb-tint)}
.cr textarea{flex:1;resize:none;border:0;background:none;padding:10px 4px;max-height:132px;min-height:40px;
outline:none;line-height:1.45}
.cr textarea::placeholder{color:var(--sb-m)}
.cb{width:40px;height:40px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:var(--sb-m);
flex:none;transition:background .15s,color .15s,transform .2s var(--sb-spring)}
.cb:hover{background:var(--sb-s);color:var(--sb-t)}
.cb:active{transform:scale(.92)}
.cb.sd{background:var(--sb-grad);color:var(--sb-fg);border-radius:50%;box-shadow:0 2px 10px -2px var(--sb-ring)}
.cb.sd:disabled{background:var(--sb-s2);color:var(--sb-m);box-shadow:none;transform:scale(.9);opacity:1}
.cb.sd:not(:disabled):hover{filter:brightness(1.1);transform:scale(1.06)}

/* Emoji seçici — 24 yüz yeter; tam bir emoji klavyesi widget'a 40 KB ekler. */
.emj{position:absolute;bottom:100%;left:12px;right:12px;margin-bottom:8px;display:none;flex-wrap:wrap;gap:2px;
background:var(--sb-el);border:1px solid var(--sb-b);border-radius:16px;padding:8px;box-shadow:var(--sb-sh);z-index:5}
.emj.on{display:flex;animation:sbTeaser .22s var(--sb-spring)}
.emj button{width:34px;height:34px;border-radius:9px;font-size:19px;line-height:1;display:flex;align-items:center;justify-content:center}
.emj button:hover{background:var(--sb-s);transform:scale(1.15)}

/* İmza — cümle kurmaz, isim söyler. Müşterinin markasıyla yarışmaz. */
.pw{display:flex;align-items:center;justify-content:center;padding:8px 0 2px}
.pw a{display:inline-flex;align-items:center;gap:5px;text-decoration:none;color:var(--sb-m);opacity:.65;
font-size:11px;padding:3px 9px;border-radius:9px;transition:opacity .15s,background .15s}
.pw a:hover{opacity:1;background:var(--sb-s)}
.pw .pn2{font-weight:650;letter-spacing:-.008em;color:var(--sb-t);opacity:.8}

.drop{position:absolute;inset:8px;background:color-mix(in srgb,var(--sb-bg) 88%,transparent);display:none;
align-items:center;justify-content:center;flex-direction:column;gap:8px;font-weight:600;color:var(--sb-c);
border:2px dashed var(--sb-edge);border-radius:16px;z-index:6;pointer-events:none;backdrop-filter:blur(2px)}
.bd.dragover .drop{display:flex}

/* ══ FORMLAR (ön-form, puanlama) ═════════════════════════════════════════ */
.fm{flex:1;overflow-y:auto;padding:24px 22px 22px;display:flex;flex-direction:column;gap:14px}
.fm h3{margin:0;font-size:21px;font-weight:680;letter-spacing:-.028em;text-wrap:balance;line-height:1.25}
.fm p{margin:-6px 0 4px;color:var(--sb-m);font-size:13.5px;line-height:1.55}
.fld{position:relative}
.fld input,.fld select,.fm textarea{width:100%;border:1.5px solid var(--sb-b);border-radius:14px;
padding:20px 14px 8px;outline:none;background:var(--sb-el);color:inherit;font:inherit;
transition:border-color .18s,box-shadow .18s}
.fm textarea{padding:14px;resize:vertical;min-height:86px}
.fld input:focus,.fld select:focus,.fm textarea:focus{border-color:var(--sb-edge);box-shadow:0 0 0 4px var(--sb-tint)}
/* Yüzen etiket: yer tutucu metin, kullanıcı yazmaya başlayınca kaybolan tek
   ipucudur. Etiket kalır — alanın ne olduğu her zaman görünür. */
.fld label{position:absolute;left:15px;top:14px;font-size:14px;color:var(--sb-m);pointer-events:none;
transition:transform .18s var(--sb-spring),font-size .18s,color .18s;transform-origin:left top}
.fld input:focus+label,.fld input.has+label,.fld select+label{transform:translateY(-8px) scale(.78);color:var(--sb-m)}
.fld input:focus+label{color:var(--sb-c)}
.fld select{appearance:none;padding-top:20px}
.fld .cv{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--sb-m);pointer-events:none}
.fld.bad input{border-color:#e11d48}

.btn{background:var(--sb-grad);color:var(--sb-fg);border-radius:15px;padding:14px 18px;font-weight:620;
text-align:center;letter-spacing:-.012em;box-shadow:0 2px 10px -2px var(--sb-ring);
transition:filter .15s,transform .18s var(--sb-spring)}
.btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
.btn:active{transform:translateY(1px)}
.btn.gh{background:none;color:var(--sb-m);font-weight:520;box-shadow:none}
.btn.gh:hover{background:var(--sb-s);filter:none;transform:none}

.stars{display:flex;justify-content:center;gap:8px;margin:14px 0 6px}
.stars button{color:var(--sb-b);padding:4px;transition:transform .22s var(--sb-spring),color .18s}
.stars button:hover{transform:scale(1.2) rotate(-6deg)}
.stars button.on{color:#f5a524}
.stars button.on svg{fill:currentColor}
.rl{text-align:center;font-size:13px;color:var(--sb-m);min-height:20px}

.ok{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
padding:30px 24px;gap:8px}
.ok .ic{width:64px;height:64px;border-radius:50%;background:var(--sb-tint);color:var(--sb-c);
display:flex;align-items:center;justify-content:center;margin-bottom:8px;animation:sbPop .5s var(--sb-spring)}
.ok h3{margin:0;font-size:19px;font-weight:660;letter-spacing:-.02em}
.ok p{margin:0;color:var(--sb-m);font-size:13.5px;line-height:1.55}
.ok .btn{margin-top:14px;text-decoration:none;display:inline-flex;justify-content:center}

.notice{margin:0 16px 10px;padding:11px 14px;font-size:12.5px;color:var(--sb-m);background:var(--sb-el);
border:1px solid var(--sb-b);border-radius:14px;text-align:center;display:none}
.notice.on{display:block}
.notice button{color:var(--sb-c);font-weight:650;margin-left:6px}
`;
