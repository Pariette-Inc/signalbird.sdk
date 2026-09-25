/**
 * Widget kimlik sıfırlama regresyonu (CONTRACT §15.3, 25 Eyl 2026).
 *
 *   node tests/widget/identity-reset.test.mjs      (önce `npm run build`)
 *
 * DOM kütüphanesi gerektirmez: dist/signalbird.js en küçük tarayıcı
 * taklidiyle yüklenir, ağ çağrıları hiç dönmez (yalnız yerel karar ölçülür).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const code = readFileSync(join(root, 'dist', 'signalbird.js'), 'utf8');

function load() {
  const store = new Map();
  const noop = () => {};
  const element = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop, attachShadow: () => element(), querySelector: () => null, classList: { add: noop, remove: noop } });
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const document = {
    currentScript: null,
    body: element(),
    head: element(),
    createElement: element,
    querySelector: () => null,
    addEventListener: noop,
    removeEventListener: noop,
    visibilityState: 'visible',
    title: '',
  };
  const window = { localStorage, document, addEventListener: noop, removeEventListener: noop, location: { href: 'https://ornek.com/' } };
  const sandbox = {
    window, document, localStorage, console: { warn: noop, debug: noop, log: noop, error: noop },
    location: window.location, navigator: { language: 'tr-TR', userAgent: 'test' },
    fetch: () => new Promise(noop), setTimeout, clearTimeout, setInterval, clearInterval,
    AbortController, URL, Promise, JSON, Math, Date,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return { Signalbird: sandbox.Signalbird, store };
}

const visitor = (identifiedAs) => JSON.stringify({ id: 'v_1', secret: 's3cret', publicKey: 'pk', identified_as: identifiedAs });

// 1) İmzalı kimlikle açılmış ziyaretçi + kimliksiz init (çıkış yapılmış): sır kullanılmaz.
{
  const { Signalbird, store } = load();
  store.set('sb_visitor', visitor('u-42'));
  Signalbird.init({ publicKey: 'pk', chatKey: 'destek' });
  assert.equal(store.get('sb_visitor'), undefined, 'kimliksiz init önceki kullanıcının ziyaretçisini devralmamalı');
}

// 2) Başka kullanıcıyla init: sır kullanılmaz.
{
  const { Signalbird, store } = load();
  store.set('sb_visitor', visitor('u-42'));
  Signalbird.init({ publicKey: 'pk', chatKey: 'destek', user: { external_id: 'u-7' }, identityHash: 'a'.repeat(64) });
  assert.equal(store.get('sb_visitor'), undefined, 'başka kullanıcı önceki ziyaretçiyi devralmamalı');
}

// 3) Aynı kullanıcı: sır korunur (sohbet sürekliliği).
{
  const { Signalbird, store } = load();
  store.set('sb_visitor', visitor('u-42'));
  Signalbird.init({ publicKey: 'pk', chatKey: 'destek', user: { external_id: 'u-42' }, identityHash: 'a'.repeat(64) });
  assert.ok(store.get('sb_visitor'), 'aynı kullanıcıda ziyaretçi korunmalı');
}

// 4) Anonim ziyaretçi anonim init'te korunur.
{
  const { Signalbird, store } = load();
  store.set('sb_visitor', visitor(null));
  Signalbird.init({ publicKey: 'pk', chatKey: 'destek' });
  assert.ok(store.get('sb_visitor'), 'anonim ziyaretçi korunmalı');
}

// 5) reset(): sır silinir, widget anonim yeniden kurulur, fırlatmaz.
{
  const { Signalbird, store } = load();
  store.set('sb_visitor', visitor('u-42'));
  Signalbird.init({ publicKey: 'pk', chatKey: 'destek', user: { external_id: 'u-42' }, identityHash: 'a'.repeat(64) });
  assert.ok(store.get('sb_visitor'));
  Signalbird.reset();
  assert.equal(store.get('sb_visitor'), undefined, 'reset sırrı silmeli');
  assert.equal(typeof Signalbird.reset, 'function');
}

// 6) init öncesi reset fırlatmaz.
{
  const { Signalbird, store } = load();
  store.set('sb_visitor', visitor(null));
  Signalbird.reset();
  assert.equal(store.get('sb_visitor'), undefined);
}

console.log('✓ widget kimlik sıfırlama: 6 senaryo');
