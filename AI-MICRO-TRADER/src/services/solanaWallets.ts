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
let registerWalletListener: EventListener | null = null;
let hostOverride: 'electron' | 'android' | 'browser' | null = null;

class AppReadyEvent extends Event {
  readonly #detail: { register: (wallet: StandardWallet) => void };

  constructor(api: { register: (wallet: StandardWallet) => void }) {
    super('wallet-standard:app-ready', { bubbles: false, cancelable: false, composed: false });
    this.#detail = api;
  }

  get detail() {
    return this.#detail;
  }
}

function walletNameMatches(name: string, id: SupportedWalletId): boolean {
  const n = name.toLowerCase();
  if (id === 'phantom') return n.includes('phantom');
  return n.includes('safepal') || n.includes('safe pal');
}

function registerStandardWallet(wallet: StandardWallet): void {
  if (!wallet?.name) return;
  standardWallets.set(wallet.name, wallet);
}

export function setWalletHostOverrideForTests(host: 'electron' | 'android' | 'browser' | null): void {
  hostOverride = host;
}

export function detectWalletHost(): 'electron' | 'android' | 'browser' {
  if (hostOverride) return hostOverride;
  if (typeof navigator === 'undefined') return 'browser';
  const ua = navigator.userAgent;
  const distribution = import.meta.env?.VITE_APP_DISTRIBUTION;
  if (distribution === 'desktop' || /Electron/i.test(ua)) return 'electron';
  if (distribution === 'android' || /Android/i.test(ua)) return 'android';
  return 'browser';
}

export function isLiveNativeApp(): boolean {
  const host = detectWalletHost();
  return host === 'electron' || host === 'android';
}

export function resetWalletStandardDiscoveryForTests(): void {
  standardWallets.clear();
  standardStarted = false;
  hostOverride = null;
  if (typeof window !== 'undefined' && registerWalletListener) {
    window.removeEventListener('wallet-standard:register-wallet', registerWalletListener);
  }
  registerWalletListener = null;
}

export function startWalletStandardDiscovery(): void {
  if (typeof window === 'undefined' || standardStarted) return;
  standardStarted = true;

  const api = { register: registerStandardWallet };
  registerWalletListener = ((event: Event) => {
    const detail = (event as CustomEvent).detail as
      | ((payload: { register: (wallet: StandardWallet) => void }) => void)
      | undefined;
    try {
      if (typeof detail === 'function') detail(api);
    } catch {
      /* ignore wallets that fail to register */
    }
  }) as EventListener;

  window.addEventListener('wallet-standard:register-wallet', registerWalletListener);

  try {
    window.dispatchEvent(new AppReadyEvent(api));
  } catch {
    /* ignore wallets that throw on a well-formed app-ready event */
  }

  const nav = navigator as Navigator & { wallets?: Array<{ register?: (cb: (wallet: StandardWallet) => void) => void }> };
  if (Array.isArray(nav.wallets)) {
    for (const navApi of nav.wallets) {
      try {
        navApi.register?.(registerStandardWallet);
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
  if (host === 'browser') {
    return `${label} live connect is available only in the Windows and Android apps. This website dashboard is paper demo only.`;
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
): Promise<{ address: string; name: 'Phantom' | 'SafePal'; method: 'wallet-standard' | 'injected' | 'deeplink' }> {
  startWalletStandardDiscovery();
  const name = id === 'phantom' ? 'Phantom' : 'SafePal';
  if (!isLiveNativeApp()) {
    throw new Error(
      hostLimitation(id) ||
        `${name} live connect is available only in the Windows and Android apps. This website dashboard is paper demo only.`
    );
  }

  const standard = findStandardWallet(id);
  const injected = findInjectedProvider(id);

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

  const { connectNativeWallet } = await import('./nativeWalletLink');
  const address = await connectNativeWallet(id);
  if (address && address.length >= 32) {
    return { address, name, method: 'deeplink' };
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
