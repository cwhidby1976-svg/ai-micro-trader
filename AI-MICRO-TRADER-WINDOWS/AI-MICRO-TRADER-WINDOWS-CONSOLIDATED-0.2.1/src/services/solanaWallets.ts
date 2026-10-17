export type SupportedWalletId = 'phantom' | 'safepal';

type StandardConnectFeature = {
  connect: (options?: { silent?: boolean }) => Promise<{ accounts?: Array<{ address: string }> } | void>;
};

type StandardDisconnectFeature = {
  disconnect?: () => Promise<void>;
};

type StandardWallet = {
  name: string;
  accounts?: Array<{ address: string }>;
  features?: Record<string, StandardConnectFeature | StandardDisconnectFeature | unknown>;
};

type InjectedSolanaProvider = {
  isPhantom?: boolean;
  isSafePal?: boolean;
  publicKey?: { toString(): string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: { toString(): string } }>;
  disconnect?: () => Promise<void>;
};

declare global {
  interface Window {
    phantom?: { solana?: InjectedSolanaProvider };
    safepal?: { solana?: InjectedSolanaProvider } & InjectedSolanaProvider;
    safepalProvider?: InjectedSolanaProvider;
    solana?: InjectedSolanaProvider;
  }
}

const standardWallets = new Map<string, StandardWallet>();
let standardStarted = false;

function walletNameMatches(name: string, id: SupportedWalletId): boolean {
  const n = name.toLowerCase();
  if (id === 'phantom') return n.includes('phantom');
  return n.includes('safepal') || n.includes('safe pal');
}

function registerStandardWallet(wallet: StandardWallet): void {
  if (!wallet?.name) return;
  standardWallets.set(wallet.name, wallet);
}

export function detectWalletHost(): 'electron' | 'android' | 'browser' {
  if (typeof navigator === 'undefined') return 'browser';
  const ua = navigator.userAgent;
  if (import.meta.env.VITE_APP_DISTRIBUTION === 'desktop' || /Electron/i.test(ua)) return 'electron';
  if (import.meta.env.VITE_APP_DISTRIBUTION === 'android' || /Android/i.test(ua)) return 'android';
  return 'browser';
}

export function startWalletStandardDiscovery(): void {
  if (typeof window === 'undefined' || standardStarted) return;
  standardStarted = true;

  const onRegister = (wallet: StandardWallet) => registerStandardWallet(wallet);

  window.addEventListener('wallet-standard:register-wallet', ((event: Event) => {
    const detail = (event as CustomEvent).detail as { register?: (cb: (wallet: StandardWallet) => void) => void };
    try {
      detail?.register?.(onRegister);
    } catch {
      /* ignore wallets that fail to register */
    }
  }) as EventListener);

  try {
    window.dispatchEvent(new Event('wallet-standard:app-ready'));
  } catch {
    /* ignore */
  }

  const nav = navigator as Navigator & { wallets?: Array<{ register?: (cb: (wallet: StandardWallet) => void) => void }> };
  if (Array.isArray(nav.wallets)) {
    for (const api of nav.wallets) {
      try {
        api.register?.(onRegister);
      } catch {
        /* ignore */
      }
    }
  }
}

function findStandardWallet(id: SupportedWalletId): StandardWallet | null {
  for (const wallet of standardWallets.values()) {
    if (walletNameMatches(wallet.name, id)) return wallet;
  }
  return null;
}

function findInjectedProvider(id: SupportedWalletId): InjectedSolanaProvider | null {
  if (typeof window === 'undefined') return null;
  if (id === 'phantom') {
    const p = window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : undefined);
    return p?.isPhantom ? p : null;
  }
  const candidates = [window.safepal?.solana, window.safepal, window.safepalProvider, window.solana];
  for (const p of candidates) {
    if (p && typeof (p as InjectedSolanaProvider).connect === 'function' && (p as InjectedSolanaProvider).isSafePal) {
      return p as InjectedSolanaProvider;
    }
  }
  return null;
}

function hostLimitation(id: SupportedWalletId): string | null {
  const host = detectWalletHost();
  const label = id === 'phantom' ? 'Phantom' : 'SafePal';
  if (host === 'electron') {
    return `${label} cannot inject into this Windows desktop window. Open AI Micro Trader in Chrome or Edge with the ${label} extension, or use ${label}'s in-app browser.`;
  }
  if (host === 'android') {
    return `${label} mobile deep-link pairing is not implemented in this build. Open this site inside the ${label} in-app browser to connect.`;
  }
  return null;
}

async function connectStandard(wallet: StandardWallet, silent: boolean): Promise<string | null> {
  const feature = wallet.features?.['standard:connect'] as StandardConnectFeature | undefined;
  if (!feature?.connect) return null;
  const result = await feature.connect({ silent });
  const address =
    result && 'accounts' in (result as object)
      ? (result as { accounts?: Array<{ address: string }> }).accounts?.[0]?.address
      : wallet.accounts?.[0]?.address;
  return address && address.length >= 32 ? address : wallet.accounts?.[0]?.address ?? null;
}

export async function connectSupportedWallet(
  id: SupportedWalletId,
  options?: { silent?: boolean }
): Promise<{ address: string; name: 'Phantom' | 'SafePal'; method: 'wallet-standard' | 'injected' }> {
  startWalletStandardDiscovery();
  const name = id === 'phantom' ? 'Phantom' : 'SafePal';
  const limitation = hostLimitation(id);
  const standard = findStandardWallet(id);
  const injected = findInjectedProvider(id);

  if (!standard && !injected) {
    throw new Error(
      limitation ||
        `${name} was not detected. Install the ${name} browser extension or open this site in the ${name} in-app browser. No simulated wallet will be connected.`
    );
  }

  if (standard) {
    try {
      const address = await connectStandard(standard, Boolean(options?.silent));
      if (address && address.length >= 32) {
        return { address, name, method: 'wallet-standard' };
      }
      if (!options?.silent) {
        throw new Error(`${name} did not return a valid public address.`);
      }
    } catch (error) {
      if (!options?.silent) throw error;
    }
  }

  if (injected) {
    try {
      const result = await injected.connect(options?.silent ? { onlyIfTrusted: true } : undefined);
      const address = result?.publicKey?.toString() ?? injected.publicKey?.toString();
      if (address && address.length >= 32) {
        return { address, name, method: 'injected' };
      }
      if (!options?.silent) {
        throw new Error(`${name} did not return a valid public address.`);
      }
    } catch (error) {
      if (!options?.silent) throw error;
    }
  }

  if (options?.silent) {
    throw new Error('silent-reconnect-failed');
  }
  throw new Error(`${name} connection failed.`);
}

export async function disconnectSupportedWallet(id: SupportedWalletId): Promise<void> {
  const standard = findStandardWallet(id);
  const disconnectFeature = standard?.features?.['standard:disconnect'] as StandardDisconnectFeature | undefined;
  try {
    await disconnectFeature?.disconnect?.();
  } catch {
    /* still clear local session */
  }
  const injected = findInjectedProvider(id);
  try {
    await injected?.disconnect?.();
  } catch {
    /* still clear local session */
  }
}

export async function fetchSolBalance(address: string): Promise<{ sol: number; lamports: number }> {
  const res = await fetch(`/api/wallet/sol-balance?address=${encodeURIComponent(address)}`, {
    headers: { Accept: 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Balance lookup failed (HTTP ${res.status})`);
  }
  if (typeof data.sol !== 'number' || !Number.isFinite(data.sol)) {
    throw new Error('Balance lookup returned an invalid response');
  }
  return { sol: data.sol, lamports: data.lamports };
}
