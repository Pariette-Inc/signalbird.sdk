/**
 * Widget CSS'i — Shadow DOM içinde yaşar, sayfa CSS'inden izole.
 * Tema rengi `--sb-c` ile gelir (uygulama ayarı `chat.color`).
 */
export const CSS = `
:host{all:initial}
*,*::before,*::after{box-sizing:border-box}
.sb{--sb-c:#111827;--sb-fg:#fff;--sb-bg:#fff;--sb-t:#111827;--sb-m:#6b7280;--sb-b:#e5e7eb;--sb-s:#f3f4f6;--sb-r:14px;
position:fixed;bottom:20px;z-index:2147483000;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--sb-t);
-webkit-font-smoothing:antialiased;direction:ltr;text-align:left}
.sb.right{right:20px}.sb.left{left:20px}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
button:disabled{cursor:default;opacity:.5}
input,textarea{font:inherit;color:inherit}
svg{display:block}
a{color:inherit}

/* Balon */
.ln{position:relative;display:flex;align-items:center;gap:8px;height:56px;min-width:56px;padding:0 18px 0 16px;border-radius:28px;background:var(--sb-c);color:var(--sb-fg);
box-shadow:0 6px 24px rgba(0,0,0,.18);transition:transform .15s,box-shadow .15s}
.ln:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(0,0,0,.22)}
.ln.icon-only{padding:0;justify-content:center;width:56px}
.ln .lt{font-weight:600;white-space:nowrap}
.badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;
display:flex;align-items:center;justify-content:center;border:2px solid #fff}
.sb.open .ln{display:none}

/* Panel */
.pn{position:absolute;bottom:0;width:380px;max-width:calc(100vw - 40px);height:min(640px,calc(100vh - 40px));background:var(--sb-bg);border-radius:var(--sb-r);
box-shadow:0 12px 48px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden;
transform-origin:bottom right;animation:sbIn .18s ease-out}
.sb.left .pn{transform-origin:bottom left;left:0}.sb.right .pn{right:0}
.sb.open .pn{display:flex}
@keyframes sbIn{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
@media (max-width:640px){.sb.open{inset:0!important;bottom:0}.pn{position:fixed;inset:0;width:100%;max-width:none;height:100%;border-radius:0}}

/* Başlık */
.hd{display:flex;align-items:center;gap:12px;padding:14px 12px 14px 16px;background:var(--sb-c);color:var(--sb-fg);flex:none}
.hd .av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-weight:700;overflow:hidden;flex:none}
.hd .av img{width:100%;height:100%;object-fit:cover}
.hd .hi{flex:1;min-width:0}
.hd .hn{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hd .hs{font-size:12px;opacity:.85;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dot{width:8px;height:8px;border-radius:50%;background:#9ca3af;flex:none}.dot.on{background:#22c55e}
.hb{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:.9}
.hb:hover{background:rgba(255,255,255,.15);opacity:1}

/* Bant */
.bn{padding:8px 16px;font-size:12px;background:#fef3c7;color:#92400e;flex:none}
.bn.err{background:#fee2e2;color:#991b1b}

/* Gövde */
.bd{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.ml{flex:1;overflow-y:auto;padding:16px 16px 8px;display:flex;flex-direction:column;gap:2px;overscroll-behavior:contain}
.ml::-webkit-scrollbar{width:6px}.ml::-webkit-scrollbar-thumb{background:var(--sb-b);border-radius:3px}
.day{align-self:center;font-size:11px;color:var(--sb-m);background:var(--sb-s);padding:3px 10px;border-radius:10px;margin:10px 0 8px}
.gr{align-self:flex-start;background:var(--sb-s);padding:10px 14px;border-radius:var(--sb-r);border-bottom-left-radius:4px;max-width:85%;color:var(--sb-t)}

/* Mesaj satırı */
.row{display:flex;flex-direction:column;max-width:82%;position:relative;margin-top:2px}
.row.v{align-self:flex-end;align-items:flex-end}
.row.a{align-self:flex-start;align-items:flex-start}
.row.s{align-self:center;max-width:90%}
.row.s .bb{background:none;color:var(--sb-m);font-size:12px;text-align:center;padding:4px 8px}
.row.gap{margin-top:10px}
.bb{position:relative;padding:8px 12px;border-radius:var(--sb-r);word-wrap:break-word;overflow-wrap:anywhere;white-space:pre-wrap;line-height:1.4}
.row.a .bb{background:var(--sb-s);border-bottom-left-radius:4px}
.row.v .bb{background:var(--sb-c);color:var(--sb-fg);border-bottom-right-radius:4px}
.row.pend .bb{opacity:.65}
.row.fail .bb{background:#fee2e2;color:#991b1b;cursor:pointer}
.bb.del{font-style:italic;opacity:.7}
.q{display:block;border-left:3px solid currentColor;opacity:.75;padding:2px 8px;margin:0 0 6px;font-size:12px;border-radius:3px;background:rgba(0,0,0,.06);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}
.row.v .q{background:rgba(255,255,255,.18)}
.mt{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--sb-m);margin-top:3px;padding:0 4px}
.mt .tk{display:inline-flex}.mt .tk.rd{color:#3b82f6}
.mt .ed{font-style:italic}
.imgs{display:flex;flex-wrap:wrap;gap:4px;margin:2px 0}
.imgs img{max-width:220px;max-height:200px;border-radius:10px;display:block;cursor:pointer;object-fit:cover;background:var(--sb-s)}
.fr{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.06);margin:2px 0;text-decoration:none;font-size:13px;max-width:260px}
.row.v .fr{background:rgba(255,255,255,.16)}
.fr .fn{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1}.fr .fs{opacity:.7;font-size:11px;white-space:nowrap}
.rx{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.rx button{font-size:12px;padding:1px 7px;border-radius:10px;background:var(--sb-s);border:1px solid var(--sb-b);line-height:1.5}
.rx button.me{border-color:var(--sb-c);background:#fff}
.row.v .rx{justify-content:flex-end}

/* Mesaj eylem çubuğu */
.ac{position:absolute;top:-30px;display:none;align-items:center;gap:2px;background:#fff;border:1px solid var(--sb-b);border-radius:20px;padding:2px 4px;box-shadow:0 4px 12px rgba(0,0,0,.12);z-index:2}
.row.a .ac{left:0}.row.v .ac{right:0}
.row:hover .ac,.row.acts .ac{display:flex}
.ac button{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--sb-t)}
.ac button:hover{background:var(--sb-s)}
.menu{position:absolute;top:0;display:none;flex-direction:column;background:#fff;border:1px solid var(--sb-b);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);z-index:3;min-width:120px;overflow:hidden}
.row.a .menu{left:0}.row.v .menu{right:0}
.menu.show{display:flex}
.menu button{padding:8px 12px;text-align:left;font-size:13px}.menu button:hover{background:var(--sb-s)}
.menu button.dg{color:#dc2626}

/* Yazıyor */
.tp{display:none;align-items:center;gap:4px;padding:6px 16px 4px;color:var(--sb-m);font-size:12px}
.tp.on{display:flex}
.tp i{width:6px;height:6px;border-radius:50%;background:var(--sb-m);animation:sbDot 1.2s infinite ease-in-out}
.tp i:nth-child(2){animation-delay:.2s}.tp i:nth-child(3){animation-delay:.4s}
@keyframes sbDot{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}

/* Kompozitör */
.cp{border-top:1px solid var(--sb-b);padding:8px 10px 6px;flex:none;background:var(--sb-bg)}
.rq{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--sb-m);padding:4px 8px 6px;border-left:3px solid var(--sb-c);margin:0 0 6px}
.rq .rt{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.rq button{opacity:.7}
.chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 0 6px}
.chip{display:flex;align-items:center;gap:6px;font-size:12px;background:var(--sb-s);border-radius:8px;padding:4px 8px;max-width:100%}
.chip img{width:28px;height:28px;object-fit:cover;border-radius:4px}
.chip span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:160px}
.chip button{opacity:.6;line-height:1}
.cr{display:flex;align-items:flex-end;gap:6px}
.cr textarea{flex:1;resize:none;border:1px solid var(--sb-b);border-radius:12px;padding:9px 12px;max-height:120px;min-height:38px;outline:none;background:var(--sb-bg);line-height:1.35}
.cr textarea:focus{border-color:var(--sb-c)}
.cb{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--sb-m);flex:none}
.cb:hover{background:var(--sb-s);color:var(--sb-t)}
.cb.sd{background:var(--sb-c);color:var(--sb-fg)}
.cb.sd:hover{filter:brightness(1.1)}
.pw{text-align:center;font-size:10px;color:var(--sb-m);padding:4px 0 2px}
.pw a{text-decoration:none;opacity:.8}
.drop{position:absolute;inset:0;background:rgba(255,255,255,.92);display:none;align-items:center;justify-content:center;font-weight:600;color:var(--sb-c);border:2px dashed var(--sb-c);border-radius:8px;margin:8px;z-index:5;pointer-events:none}
.bd.dragging .drop{display:flex}

/* Ön-form ve puanlama */
.fm{flex:1;overflow-y:auto;padding:24px 20px;display:flex;flex-direction:column;gap:12px}
.fm h3{margin:0;font-size:17px}
.fm p{margin:0 0 6px;color:var(--sb-m);font-size:13px}
.fm input,.fm textarea,.fm select{width:100%;border:1px solid var(--sb-b);border-radius:10px;padding:10px 12px;outline:none;background:var(--sb-bg);color:inherit;font:inherit}
.fm input:focus,.fm textarea:focus,.fm select:focus{border-color:var(--sb-c)}
.fm textarea{resize:vertical;min-height:70px}
.btn{background:var(--sb-c);color:var(--sb-fg);border-radius:10px;padding:11px 16px;font-weight:600;text-align:center}
.btn.gh{background:none;color:var(--sb-m);font-weight:500}
.stars{display:flex;justify-content:center;gap:6px;margin:8px 0}
.stars button{color:#d1d5db;padding:4px}
.stars button.on{color:#f59e0b}
.stars button.on svg{fill:currentColor}
.ok{text-align:center;padding:30px 20px;color:var(--sb-t)}
.notice{margin:8px 16px;padding:8px 12px;font-size:12px;color:var(--sb-m);background:var(--sb-s);border-radius:10px;text-align:center}
.notice button{color:var(--sb-c);font-weight:600;margin-left:6px}
`;
