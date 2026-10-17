import nacl from 'tweetnacl';
import bs58 from 'bs58';
import type { SupportedWalletId } from './solanaWallets';

export const NATIVE_WALLET_SCHEME = 'aimicrotrader';
const REDIRECT_PATH = 'wallet-connect';
const SESSION_KEY = 'amt_wallet_dapp_secret';

declare global {
  interface Window {
    desktopWallet?: {
      openExternal: (url: string) => Promise<void>;
      onDeeplink?: (callback: (url: string) => void) => () => void;
    };
    AndroidWallet?: {
      openUrl: (url: string) => void;
    };
  }
}

type PendingConnect = {
  id: SupportedWalletId;
  secretKey: Uint8Array;
  publicKey: Uint8Array;
  resolve: (address: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let pending: PendingConnect | null = null;
let deeplinkListenerStarted = false;

function appUrl(): string {
  if (typeof window === 'undefined') return 'https://aimicrotrader.nextgentradershub.com';
  return window.location.origin;
}

function redirectLink(): string {
  return `${NATIVE_WALLET_SCHEME}://${REDIRECT_PATH}`;
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function storeSecret(secretKey: Uint8Array): void {
  sessionStorage.setItem(SESSION_KEY, bytesToB64(secretKey));
}

function loadSecret(): Uint8Array | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  return b64ToBytes(raw);
}

export function isAllowedWalletLaunchUrl(url: string): boolean {
  return (
    url.startsWith('https://phantom.app/ul/') ||
    url.startsWith('phantom://') ||
    url.startsWith('https://link.safepal.io/') ||
    url.startsWith('safepalwallet://') ||
    url.startsWith('safepal://')
  );
}

export function buildPhantomConnectUrl(dappPublicKey: Uint8Array): string {
  const params = new URLSearchParams({
    app_url: appUrl(),
    dapp_encryption_public_key: bs58.encode(dappPublicKey),
    redirect_link: redirectLink(),
    cluster: 'mainnet-beta',
  });
  return `https://phantom.app/ul/v1/connect?${params.toString()}`;
}

export function buildSafePalConnectUrl(): string {
  const dapp = encodeURIComponent(appUrl());
  return `https://link.safepal.io/dapp?url=${dapp}`;
}

async function launchWalletUrl(url: string): Promise<void> {
  if (!isAllowedWalletLaunchUrl(url)) throw new Error('Refused to open an unapproved wallet URL');
  if (window.desktopWallet?.openExternal) {
    await window.desktopWallet.openExternal(url);
    return;
  }
  if (window.AndroidWallet?.openUrl) {
    window.AndroidWallet.openUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function decryptPhantomConnectPayload(
  secretKey: Uint8Array,
  phantomEncryptionPublicKey: string,
  nonce: string,
  data: string
): { public_key: string } {
  const shared = nacl.box.before(bs58.decode(phantomEncryptionPublicKey), secretKey);
  const opened = nacl.box.open.after(bs58.decode(data), bs58.decode(nonce), shared);
  if (!opened) throw new Error('Phantom returned a payload that could not be decrypted.');
  const parsed = JSON.parse(new TextDecoder().decode(opened)) as { public_key?: string };
  if (!parsed.public_key || parsed.public_key.length < 32) {
    throw new Error('Phantom did not return a valid public address.');
  }
  return { public_key: parsed.public_key };
}

export function handleNativeWalletRedirect(url: string): boolean {
  if (!url.startsWith(`${NATIVE_WALLET_SCHEME}://`)) return false;
  const parsed = new URL(url.replace(`${NATIVE_WALLET_SCHEME}://`, 'https://wallet.local/'));
  if (parsed.searchParams.get('errorCode') || parsed.searchParams.get('errorMessage')) {
    pending?.reject(new Error(parsed.searchParams.get('errorMessage') || 'Wallet connection was cancelled.'));
    clearPending();
    return true;
  }

  if (pending?.id === 'phantom' || loadSecret()) {
    const phantomKey = parsed.searchParams.get('phantom_encryption_public_key');
    const nonce = parsed.searchParams.get('nonce');
    const data = parsed.searchParams.get('data');
    const secret = pending?.secretKey || loadSecret();
    if (phantomKey && nonce && data && secret) {
      try {
        const result = decryptPhantomConnectPayload(secret, phantomKey, nonce, data);
        pending?.resolve(result.public_key);
        clearPending();
        return true;
      } catch (error) {
        pending?.reject(error instanceof Error ? error : new Error('Phantom connect failed.'));
        clearPending();
        return true;
      }
    }
  }
  return false;
}

function clearPending(): void {
  if (pending?.timer) clearTimeout(pending.timer);
  pending = null;
  sessionStorage.removeItem(SESSION_KEY);
}

export function cancelNativeWalletConnectForTests(): void {
  pending?.reject(new Error('cancelled'));
  clearPending();
}

export function listenForNativeWalletRedirects(): void {
  if (typeof window === 'undefined' || deeplinkListenerStarted) return;
  deeplinkListenerStarted = true;
  (window as Window & { __amtHandleWalletLink?: (url: string) => boolean }).__amtHandleWalletLink =
    handleNativeWalletRedirect;
  window.desktopWallet?.onDeeplink?.((url) => {
    handleNativeWalletRedirect(url);
  });
  if (window.location.protocol === `${NATIVE_WALLET_SCHEME}:` || window.location.href.startsWith(`${NATIVE_WALLET_SCHEME}://`)) {
    handleNativeWalletRedirect(window.location.href);
  }
}

export async function connectNativeWallet(id: SupportedWalletId): Promise<string> {
  listenForNativeWalletRedirects();
  if (pending) {
    pending.reject(new Error('Another wallet connection is already waiting for approval.'));
    clearPending();
  }

  return new Promise((resolve, reject) => {
    const keyPair = nacl.box.keyPair();
    storeSecret(keyPair.secretKey);
    pending = {
      id,
      secretKey: keyPair.secretKey,
      publicKey: keyPair.publicKey,
      resolve,
      reject,
      timer: setTimeout(() => {
        pending?.reject(new Error('Wallet approval timed out. Open Phantom or SafePal on this device and try again.'));
        clearPending();
      }, 120000),
    };

    const url = id === 'phantom' ? buildPhantomConnectUrl(keyPair.publicKey) : buildSafePalConnectUrl();
    void launchWalletUrl(url).catch((error) => {
      pending?.reject(error instanceof Error ? error : new Error('Could not open the wallet app.'));
      clearPending();
    });
  });
}
