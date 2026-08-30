/**
 * Widget CSS'i — Shadow DOM içinde yaşar, sayfa CSS'inden izole.
 *
 * ── TASARIM KARARLARI (29 Ağu 2026) ──────────────────────────────────────
 *
 * Ahmet: "çok basit gözüküyor… font ve tasarım beğenmedim ama gerçekten,
 * lütfen güzel bişey yap."
 *
 * 1. BAŞLIK ARTIK RENK BLOĞU DEĞİL. Eski hâlde marka rengi tepeye dolu bir
 *    şerit olarak basılıyordu — 2015'in canlı destek görüntüsü. Şimdi başlık
 *    panelin yüzeyiyle aynı; marka rengi üstteki 3 piksellik hat, avatar
 *    halkası, gönder düğmesi ve ziyaretçi balonunda görünür. Renk AZ yerde
 *    ama HER ZAMAN aynı anlamda: "bu senin markan".
 *
 * 2. NÖTRLER SOĞUK EĞİMLİ. Saf gri (#808080 ailesi) ekranda ölüdür; buradaki
 *    griler maviye çalar (#697084, #e6e8ec) ve marka rengi ne olursa olsun
 *    yanında oturur.
 *
 * 3. YAZI TİPİ DIŞARIDAN YÜKLENMEZ. Widget müşterinin sayfasında çalışır;
 *    Google Fonts çağırmak hem onun CSP'sine takılır hem de sayfaya bizim
 *    gecikmemizi ekler. Bunun yerine işletim sistemlerinin KENDİ arayüz
 *    yazı tipleri (SF, Segoe UI Variable, Roboto) sırayla denenir — hepsi
 *    zaten ekran için çizilmiş yüzlerdir. Kazanç: 0 bayt, 0 istek, 0 FOUT.
 *
 * 4. İKİ TEMA. `theme: dark` gövdeye `.dark` sınıfı koyar, `auto` sayfanın
 *    tercihini okur. Renkler yalnız token seviyesinde değişir; hiçbir bileşen
 *    kendi içinde koyu/açık bilmez.
 *
 * 5. ZİYARETÇİ PANELİ TAŞIYIP BOYUTLANDIRABİLİR (`.pn` üzerindeki inline
 *    genişlik/yükseklik ve `--sb-dx/--sb-dy`). Sohbet bazen okunacak bir
 *    belgedir; 380 pikselin içine sıkıştırmak bizim tercihimizdi, onun değil.
 */
export const CSS = `
:host{all:initial}
*,*::before,*::after{box-sizing:border-box}

.sb{
  /* Marka — tek değişken, dışarıdan gelir */
  --sb-c:#111827;--sb-fg:#fff;

  /* Nötrler: soğuk eğimli, saf gri değil */
  --sb-bg:#fff;--sb-t:#14171f;--sb-m:#697084;--sb-b:#e6e8ec;--sb-s:#f5f6f8;--sb-s2:#eef0f4;
  --sb-sh:0 1px 2px rgba(16,20,30,.06),0 12px 32px -8px rgba(16,20,30,.18),0 32px 64px -24px rgba(16,20,30,.22);
  --sb-r:16px;--sb-rb:14px;

  /* Ziyaretçinin taşıdığı miktar; sürüklenmediyse 0 */
  --sb-dx:0px;--sb-dy:0px;

  position:fixed;bottom:20px;z-index:2147483000;
  font:400 14px/1.5 ui-sans-serif,system-ui,-apple-system,"SF Pro Text","Segoe UI Variable Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  font-feature-settings:"cv11","ss01";
  color:var(--sb-t);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  direction:ltr;text-align:left;
}
.sb.right{right:20px}.sb.left{left:20px}

.sb.dark{
  --sb-bg:#15171d;--sb-t:#eceef3;--sb-m:#9aa1b2;--sb-b:#2b2f3a;--sb-s:#1f222b;--sb-s2:#262a35;
  --sb-sh:0 1px 2px rgba(0,0,0,.4),0 16px 40px -8px rgba(0,0,0,.55),0 40px 72px -28px rgba(0,0,0,.6);
}

button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
button:disabled{cursor:default;opacity:.45}
input,textarea{font:inherit;color:inherit}
svg{display:block}
a{color:inherit}
:focus-visible{outline:2px solid var(--sb-c);outline-offset:2px}

/* ── Balon ───────────────────────────────────────────────────────────── */
.ln{position:relative;display:flex;align-items:center;gap:9px;height:56px;min-width:56px;padding:0 20px 0 17px;border-radius:28px;
background:var(--sb-c);color:var(--sb-fg);
box-shadow:0 2px 6px rgba(16,20,30,.14),0 10px 28px -6px rgba(16,20,30,.32);
transition:transform .18s cubic-bezier(.2,.7,.3,1),box-shadow .18s}
.ln:hover{transform:translateY(-2px);box-shadow:0 4px 10px rgba(16,20,30,.16),0 16px 36px -8px rgba(16,20,30,.38)}
.ln:active{transform:translateY(0)}
.ln.icon-only{padding:0;justify-content:center;width:56px}
.ln .lt{font-weight:600;font-size:14.5px;letter-spacing:-.01em;white-space:nowrap}
.ln .lg{width:30px;height:30px;border-radius:50%;object-fit:cover;display:block}
.badge{position:absolute;top:-3px;right:-3px;min-width:21px;height:21px;padding:0 6px;border-radius:11px;background:#ef4444;color:#fff;
font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;display:flex;align-items:center;justify-content:center;
border:2px solid var(--sb-bg);box-shadow:0 2px 6px rgba(239,68,68,.4)}
.sb.open .ln{display:none}

/* Balonu kapatma — balonun dışında, üst köşede. Masaüstünde yalnız hover'da:
   sürekli duran bir çarpı, sohbete davetten çok "beni kapat" davetidir. */
.dm{position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:11px;background:var(--sb-bg);color:var(--sb-m);
box-shadow:0 2px 8px rgba(16,20,30,.24);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;pointer-events:none}
.sb:hover .dm{opacity:1;pointer-events:auto}
.dm:hover{color:var(--sb-t)}
.sb.open .dm,.sb.hidden .dm{display:none}
@media (hover:none){.dm{opacity:1;pointer-events:auto}}

/* Ziyaretçi balonu kapattı: widget tümden gizlenir. Kaldırılmaz —
   sayfadaki "destek" düğmesi Signalbird.chat.open() ile onu geri getirir. */
.sb.hidden .ln{display:none}

/* launcher_mode:'manual' — balon hiç çizilmez, sohbeti sitenin kendi düğmesi
   açar. Ziyaretçinin kapatma tercihinden AYRI bir sınıf: biri site sahibinin
   ayarı, diğeri ziyaretçinin kararı. */
.sb.no-ln .ln,.sb.no-ln .dm{display:none}

/* ── Panel ───────────────────────────────────────────────────────────── */
.pn{position:absolute;bottom:0;width:400px;max-width:calc(100vw - 40px);height:min(660px,calc(100vh - 40px));
background:var(--sb-bg);border-radius:var(--sb-r);box-shadow:var(--sb-sh);
display:none;flex-direction:column;overflow:hidden;
transform-origin:bottom right;animation:sbIn .22s cubic-bezier(.2,.8,.25,1)}
.sb.dark .pn{border:1px solid var(--sb-b)}
.sb.left .pn{transform-origin:bottom left;left:0}.sb.right .pn{right:0}
.sb.open .pn{display:flex}
/* Ziyaretçinin taşıdığı konum. Sürükleme yoksa ikisi de 0. */
.sb.right .pn{translate:calc(-1 * var(--sb-dx)) calc(-1 * var(--sb-dy))}
.sb.left .pn{translate:var(--sb-dx) calc(-1 * var(--sb-dy))}
.sb.moving .pn,.sb.sizing .pn{animation:none;transition:none;user-select:none}
@keyframes sbIn{from{opacity:0;transform:translateY(14px) scale(.975)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pn{animation:none}.ln{transition:none}}
/* ── Çekmece (layout:'sidebar') ───────────────────────────────────────────
   Ekran boyu, kenara yaslı panel. Köşe penceresinin aksine taşınmaz ve
   boyutlandırılmaz; genişlik sabittir, yükseklik ekranın kendisidir. Mobilde
   zaten tam ekran açılıyordu, orada iki biçim aynı yere varır. */
.sb.sidebar{top:0;bottom:0;height:100vh;height:100dvh;display:flex;align-items:flex-end;padding-bottom:20px}
.sb.sidebar.right{right:20px}.sb.sidebar.left{left:20px}
.sb.sidebar .pn{position:fixed;top:0;bottom:0;height:100vh;height:100dvh;width:420px;max-width:100vw;
border-radius:0;translate:none!important;animation:sbSlideR .24s cubic-bezier(.2,.8,.25,1)}
.sb.sidebar.right .pn{right:0;left:auto}
.sb.sidebar.left .pn{left:0;right:auto;animation-name:sbSlideL}
.sb.sidebar .gp{display:none}
@keyframes sbSlideR{from{opacity:.4;transform:translateX(24px)}to{opacity:1;transform:none}}
@keyframes sbSlideL{from{opacity:.4;transform:translateX(-24px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.sb.sidebar .pn{animation:none}}

@media (max-width:640px){
  .sb.open{inset:0!important;bottom:0}
  .sb.sidebar{padding-bottom:0}
  .pn{position:fixed;inset:0;width:100%!important;max-width:none;height:100%!important;border-radius:0;translate:none!important}
  .gp{display:none!important}
}

/* Marka hattı — rengin panelde tuttuğu ilk yer */
.br{height:3px;flex:none;background:var(--sb-c)}

/* Boyutlandırma tutamağı — panelin dış köşesinde (sağdaysa sol üst) */
.gp{position:absolute;width:18px;height:18px;z-index:6;opacity:0;transition:opacity .15s}
.sb.right .gp{top:0;left:0;cursor:nwse-resize}
.sb.left .gp{top:0;right:0;cursor:nesw-resize}
.sb.open:hover .gp{opacity:.5}
.gp:hover{opacity:1!important}
.gp::after{content:"";position:absolute;top:6px;width:9px;height:9px;border-color:var(--sb-m);border-style:solid}
.sb.right .gp::after{left:6px;border-width:1.5px 0 0 1.5px;border-radius:3px 0 0 0}
.sb.left .gp::after{right:6px;border-width:1.5px 1.5px 0 0;border-radius:0 3px 0 0}

/* ── Başlık ──────────────────────────────────────────────────────────── */
.hd{display:flex;align-items:center;gap:11px;padding:13px 10px 13px 15px;flex:none;
background:var(--sb-bg);border-bottom:1px solid var(--sb-b);cursor:grab;touch-action:none}
.sb.moving .hd{cursor:grabbing}
.hd .av{position:relative;width:38px;height:38px;border-radius:50%;background:var(--sb-s2);color:var(--sb-t);
display:flex;align-items:center;justify-content:center;font-weight:650;font-size:14px;letter-spacing:-.02em;
overflow:hidden;flex:none;box-shadow:0 0 0 2px var(--sb-bg),0 0 0 3.5px color-mix(in srgb,var(--sb-c) 55%,transparent)}
.hd .av img{width:100%;height:100%;object-fit:cover}
.hd .hi{flex:1;min-width:0}
.hd .hn{font-weight:650;font-size:15px;letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hd .hs{font-size:12.5px;color:var(--sb-m);display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.dot{width:7px;height:7px;border-radius:50%;background:#9ca3af;flex:none}
.dot.on{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.18)}
.hb{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--sb-m);flex:none}
.hb:hover{background:var(--sb-s);color:var(--sb-t)}

/* ── Bant ────────────────────────────────────────────────────────────── */
.bn{padding:9px 16px;font-size:12.5px;background:#fef6e0;color:#8a5a06;flex:none;border-bottom:1px solid var(--sb-b)}
.bn.err{background:#fdeaea;color:#992b2b}
.sb.dark .bn{background:#2c2413;color:#e8c37a}
.sb.dark .bn.err{background:#2e1a1a;color:#f0a6a6}

/* ── Gövde ───────────────────────────────────────────────────────────── */
.bd{flex:1;min-height:0;display:flex;flex-direction:column;position:relative;background:var(--sb-bg)}
.ml{flex:1;overflow-y:auto;padding:18px 16px 10px;display:flex;flex-direction:column;gap:2px;overscroll-behavior:contain;scrollbar-width:thin}
.ml::-webkit-scrollbar{width:8px}
.ml::-webkit-scrollbar-thumb{background:var(--sb-b);border-radius:4px;border:2px solid var(--sb-bg)}
.ml::-webkit-scrollbar-thumb:hover{background:var(--sb-m)}
.day{align-self:center;font-size:11px;font-weight:600;letter-spacing:.02em;color:var(--sb-m);background:var(--sb-s);
padding:4px 11px;border-radius:11px;margin:12px 0 10px}
.gr{align-self:flex-start;background:var(--sb-s);padding:11px 14px;border-radius:var(--sb-rb);border-bottom-left-radius:5px;max-width:85%;color:var(--sb-t)}

/* ── Mesaj satırı ────────────────────────────────────────────────────── */
.row{display:flex;flex-direction:column;max-width:82%;position:relative;margin-top:2px}
.row.v{align-self:flex-end;align-items:flex-end}
.row.a{align-self:flex-start;align-items:flex-start}
.row.s{align-self:center;max-width:90%}
.row.s .bb{background:none;color:var(--sb-m);font-size:12px;text-align:center;padding:5px 8px;box-shadow:none}
.row.gap{margin-top:12px}
.bb{position:relative;padding:9px 13px;border-radius:var(--sb-rb);word-wrap:break-word;overflow-wrap:anywhere;white-space:pre-wrap;line-height:1.48}
.row.a .bb{background:var(--sb-s);border-bottom-left-radius:5px}
.row.v .bb{background:var(--sb-c);color:var(--sb-fg);border-bottom-right-radius:5px}
.row.pend .bb{opacity:.6}
.row.fail .bb{background:#fdeaea;color:#992b2b;cursor:pointer}
.bb.del{font-style:italic;opacity:.7}
.q{display:block;border-left:2.5px solid currentColor;opacity:.72;padding:3px 9px;margin:0 0 7px;font-size:12px;border-radius:4px;
background:rgba(120,130,150,.12);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:250px}
.row.v .q{background:rgba(255,255,255,.16)}
.mt{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--sb-m);margin-top:4px;padding:0 3px;font-variant-numeric:tabular-nums}
.mt .tk{display:inline-flex}.mt .tk.rd{color:#3b82f6}
.mt .ed{font-style:italic}
.imgs{display:flex;flex-wrap:wrap;gap:4px;margin:2px 0}
.imgs img{max-width:220px;max-height:200px;border-radius:11px;display:block;cursor:zoom-in;object-fit:cover;background:var(--sb-s2)}
.fr{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:11px;background:rgba(120,130,150,.12);margin:2px 0;
text-decoration:none;font-size:13px;max-width:260px}
.row.v .fr{background:rgba(255,255,255,.15)}
.fr .fn{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1}
.fr .fs{opacity:.7;font-size:11px;white-space:nowrap;font-variant-numeric:tabular-nums}
.rx{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.rx button{font-size:12px;padding:2px 8px;border-radius:11px;background:var(--sb-s);border:1px solid var(--sb-b);line-height:1.5}
.rx button.me{border-color:var(--sb-c);background:var(--sb-bg)}
.row.v .rx{justify-content:flex-end}

/* Mesaj eylem çubuğu */
.ac{position:absolute;top:-32px;display:none;align-items:center;gap:2px;background:var(--sb-bg);border:1px solid var(--sb-b);
border-radius:20px;padding:3px 5px;box-shadow:0 4px 14px rgba(16,20,30,.14);z-index:2}
.row.a .ac{left:0}.row.v .ac{right:0}
.row:hover .ac,.row.acts .ac{display:flex}
.ac button{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--sb-t)}
.ac button:hover{background:var(--sb-s)}
.menu{position:absolute;top:0;display:none;flex-direction:column;background:var(--sb-bg);border:1px solid var(--sb-b);border-radius:12px;
box-shadow:0 10px 28px rgba(16,20,30,.16);z-index:3;min-width:126px;overflow:hidden;padding:4px}
.row.a .menu{left:0}.row.v .menu{right:0}
.menu.show{display:flex}
.menu button{padding:8px 11px;text-align:left;font-size:13px;border-radius:8px}
.menu button:hover{background:var(--sb-s)}
.menu button.dg{color:#dc2626}

/* Yazıyor */
.tp{display:none;align-items:center;gap:4px;padding:6px 18px 4px;color:var(--sb-m);font-size:12px}
.tp.on{display:flex}
.tp i{width:6px;height:6px;border-radius:50%;background:var(--sb-m);animation:sbDot 1.2s infinite ease-in-out}
.tp i:nth-child(2){animation-delay:.2s}.tp i:nth-child(3){animation-delay:.4s}
@keyframes sbDot{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}

/* ── Kompozitör ──────────────────────────────────────────────────────── */
.cp{border-top:1px solid var(--sb-b);padding:10px 12px 8px;flex:none;background:var(--sb-bg)}
.rq{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--sb-m);padding:5px 9px 6px;border-left:2.5px solid var(--sb-c);
background:var(--sb-s);border-radius:0 8px 8px 0;margin:0 0 8px}
.rq .rt{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.rq button{opacity:.7}
.chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 0 8px}
.chip{display:flex;align-items:center;gap:7px;font-size:12px;background:var(--sb-s);border:1px solid var(--sb-b);border-radius:10px;padding:5px 9px;max-width:100%}
.chip img{width:28px;height:28px;object-fit:cover;border-radius:6px}
.chip span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:160px}
.chip button{opacity:.6;line-height:1}
.cr{display:flex;align-items:flex-end;gap:7px;background:var(--sb-s);border:1px solid var(--sb-b);border-radius:14px;padding:3px 4px 3px 6px;
transition:border-color .15s,box-shadow .15s}
.cr:focus-within{border-color:color-mix(in srgb,var(--sb-c) 55%,var(--sb-b));box-shadow:0 0 0 3px color-mix(in srgb,var(--sb-c) 14%,transparent)}
.cr textarea{flex:1;resize:none;border:0;background:none;padding:9px 4px;max-height:140px;min-height:38px;outline:none;line-height:1.45}
.cr textarea::placeholder{color:var(--sb-m)}
.cb{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;color:var(--sb-m);flex:none}
.cb:hover{background:var(--sb-s2);color:var(--sb-t)}
.cb.sd{background:var(--sb-c);color:var(--sb-fg);border-radius:50%;width:36px;height:36px}
.cb.sd:hover{background:var(--sb-c);filter:brightness(1.12)}

/* İmza — "Signalbird ile" yerine gerçek bir marka satırı.
   Kuş işareti + kelime işareti, tek sıra, düşük kontrast: müşterinin
   markasıyla yarışmaz ama okunur ve tıklanır. */
.pw{display:flex;align-items:center;justify-content:center;padding:7px 0 3px}
.pw a{display:inline-flex;align-items:center;gap:5px;text-decoration:none;color:var(--sb-m);opacity:.72;
font-size:11px;letter-spacing:.01em;padding:3px 8px;border-radius:8px;transition:opacity .15s,background .15s}
.pw a:hover{opacity:1;background:var(--sb-s)}
.pw .pk{opacity:.85;flex:none}
.pw .pn2{font-weight:600;letter-spacing:-.005em;color:var(--sb-t);opacity:.75}

.drop{position:absolute;inset:8px;background:color-mix(in srgb,var(--sb-bg) 92%,transparent);display:none;align-items:center;justify-content:center;
font-weight:600;color:var(--sb-c);border:2px dashed var(--sb-c);border-radius:12px;z-index:5;pointer-events:none}
.bd.dragging .drop{display:flex}

/* ── Ön-form ve puanlama ─────────────────────────────────────────────── */
.fm{flex:1;overflow-y:auto;padding:26px 22px;display:flex;flex-direction:column;gap:13px}
.fm h3{margin:0;font-size:19px;font-weight:650;letter-spacing:-.02em;text-wrap:balance}
.fm p{margin:0 0 4px;color:var(--sb-m);font-size:13.5px;line-height:1.55}
.fm input,.fm textarea,.fm select{width:100%;border:1px solid var(--sb-b);border-radius:11px;padding:11px 13px;outline:none;
background:var(--sb-s);color:inherit;font:inherit;transition:border-color .15s,box-shadow .15s}
.fm input:focus,.fm textarea:focus,.fm select:focus{border-color:color-mix(in srgb,var(--sb-c) 55%,var(--sb-b));
box-shadow:0 0 0 3px color-mix(in srgb,var(--sb-c) 14%,transparent);background:var(--sb-bg)}
.fm textarea{resize:vertical;min-height:74px}
.btn{background:var(--sb-c);color:var(--sb-fg);border-radius:11px;padding:12px 16px;font-weight:600;text-align:center;letter-spacing:-.01em;
transition:filter .15s,transform .1s}
.btn:hover{filter:brightness(1.08)}
.btn:active{transform:translateY(1px)}
.btn.gh{background:none;color:var(--sb-m);font-weight:500}
.btn.gh:hover{background:var(--sb-s);filter:none}
.stars{display:flex;justify-content:center;gap:7px;margin:10px 0}
.stars button{color:var(--sb-b);padding:4px;transition:transform .12s,color .12s}
.stars button:hover{transform:scale(1.14)}
.stars button.on{color:#f5a524}
.stars button.on svg{fill:currentColor}
.ok{text-align:center;padding:34px 22px;color:var(--sb-t)}
.ok .rv{margin-top:20px;color:var(--sb-m)}
.notice{margin:10px 16px;padding:10px 13px;font-size:12.5px;color:var(--sb-m);background:var(--sb-s);border:1px solid var(--sb-b);
border-radius:11px;text-align:center}
.notice button{color:var(--sb-c);font-weight:600;margin-left:6px}
`;
