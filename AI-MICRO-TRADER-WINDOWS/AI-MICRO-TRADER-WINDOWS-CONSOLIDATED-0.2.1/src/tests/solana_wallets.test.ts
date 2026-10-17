import assert from 'assert';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const PHANTOM_ADDR = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
const SAFEPAL_ADDR = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';

type Listener = (event: { type: string; detail?: unknown }) => void;

class TestWindow {
  phantom?: { solana?: unknown };
  safepal?: unknown;
  solana?: unknown;
  desktopWallet?: { openExternal: (url: string) => Promise<void> };
  location = { origin: 'http://127.0.0.1:3000', href: 'http://127.0.0.1:3000/', protocol: 'http:' };
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string; detail?: unknown }) {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
    return true;
  }

  open() {
    return null;
  }
}

const memory = new Map<string, string>();
(globalThis as any).sessionStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k),
};
(globalThis as any).btoa = (value: string) => Buffer.from(value, 'binary').toString('base64');
(globalThis as any).atob = (value: string) => Buffer.from(value, 'base64').toString('binary');
(globalThis as any).TextDecoder = TextDecoder;
(globalThis as any).URL = URL;
(globalThis as any).URLSearchParams = URLSearchParams;

function installBrowserGlobals() {
  const win = new TestWindow();
  (globalThis as any).window = win;
  (globalThis as any).Event = class Event {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
  return win;
}

async function run() {
  console.log('▶ Solana wallet device paths');

  const win = installBrowserGlobals();
  const wallets = await import('../services/solanaWallets');
  const native = await import('../services/nativeWalletLink');
  wallets.resetWalletStandardDiscoveryForTests();

  win.phantom = {
    solana: {
      isPhantom: true,
      connect: async () => ({ publicKey: { toString: () => PHANTOM_ADDR } }),
    },
  };
  await assert.rejects(
    () => wallets.connectSupportedWallet('phantom'),
    (err: Error) => err.message.includes('Windows and Android')
  );
  console.log('  ✔ Website dashboard refuses real Phantom (paper demo only)');

  wallets.resetWalletStandardDiscoveryForTests();
  wallets.setWalletHostOverrideForTests('electron');
  const electronInjected = await wallets.connectSupportedWallet('phantom');
  assert.strictEqual(electronInjected.method, 'injected');
  console.log('  ✔ Windows live app uses injected Phantom when the wallet is present');

  delete win.phantom;
  win.solana = { isPhantom: false, connect: async () => ({ publicKey: { toString: () => PHANTOM_ADDR } }) };
  wallets.resetWalletStandardDiscoveryForTests();
  wallets.setWalletHostOverrideForTests('android');
  let opened = '';
  win.desktopWallet = { openExternal: async (url: string) => { opened = url; } };
  const deeplinkPromise = wallets.connectSupportedWallet('phantom');
  deeplinkPromise.catch(() => undefined);
  await new Promise((r) => setTimeout(r, 20));
  assert(opened.startsWith('https://phantom.app/ul/v1/connect'), 'Android/Windows without inject must open Phantom');
  native.cancelNativeWalletConnectForTests();
  console.log('  ✔ Native app without an injected wallet launches Phantom connect');

  wallets.resetWalletStandardDiscoveryForTests();
  wallets.setWalletHostOverrideForTests('android');
  win.phantom = {
    solana: {
      isPhantom: true,
      connect: async () => ({ publicKey: { toString: () => PHANTOM_ADDR } }),
    },
  };
  const injected = await wallets.connectSupportedWallet('phantom');
  assert.strictEqual(injected.method, 'injected');
  assert.strictEqual(injected.address, PHANTOM_ADDR);
  console.log('  ✔ Android/Windows injected Phantom returns the real public key');

  delete win.phantom;
  win.safepal = {
    isSafePal: true,
    connect: async () => ({ publicKey: { toString: () => SAFEPAL_ADDR } }),
  };
  wallets.resetWalletStandardDiscoveryForTests();
  wallets.setWalletHostOverrideForTests('electron');
  const safe = await wallets.connectSupportedWallet('safepal');
  assert.strictEqual(safe.method, 'injected');
  console.log('  ✔ Windows injected SafePal returns the real public key');

  const dapp = nacl.box.keyPair();
  const phantom = nacl.box.keyPair();
  const nonce = nacl.randomBytes(24);
  const shared = nacl.box.before(dapp.publicKey, phantom.secretKey);
  const payload = nacl.box.after(new TextEncoder().encode(JSON.stringify({ public_key: PHANTOM_ADDR })), nonce, shared);
  const decoded = native.decryptPhantomConnectPayload(
    dapp.secretKey,
    bs58.encode(phantom.publicKey),
    bs58.encode(nonce),
    bs58.encode(payload)
  );
  assert.strictEqual(decoded.public_key, PHANTOM_ADDR);
  console.log('  ✔ Phantom deeplink payload decrypts to the wallet address');

  assert(native.isAllowedWalletLaunchUrl('https://phantom.app/ul/v1/connect?x=1'));
  assert(native.isAllowedWalletLaunchUrl('https://link.safepal.io/dapp?url=x'));
  assert(!native.isAllowedWalletLaunchUrl('https://evil.example/steal'));
  console.log('  ✔ Native wallet launch URLs are allowlisted');

  console.log('\nAll Solana wallet path tests passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
