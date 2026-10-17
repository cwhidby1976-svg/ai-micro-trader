import React, { useState } from 'react';
import { Wallet, X, Copy, ExternalLink, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';

type SolanaProvider = {
  isPhantom?: boolean;
  isSafePal?: boolean;
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect?(): Promise<void>;
};

declare global {
  interface Window {
    phantom?: { solana?: SolanaProvider };
    safepal?: { solana?: SolanaProvider };
    solana?: SolanaProvider;
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  connectedWallet: string | null;
  walletName: string;
  solBalance: number | null;
  solPriceUsd: number;
  onConnect: (address: string, name: string) => void;
  onDisconnect: () => void;
  balanceError?: string | null;
}

const findProvider = (id: 'phantom' | 'safepal'): SolanaProvider | null => {
  if (typeof window === 'undefined') return null;
  if (id === 'phantom') {
    const p = window.phantom?.solana ?? window.solana;
    return p?.isPhantom ? p : null;
  }
  const p = window.safepal?.solana ?? window.solana;
  return p?.isSafePal ? p : null;
};

export const LiveWalletModal: React.FC<Props> = ({
  isOpen, onClose, connectedWallet, walletName, solBalance, solPriceUsd,
  onConnect, onDisconnect, balanceError,
}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!isOpen) return null;

  const connect = async (id: 'phantom' | 'safepal') => {
    setError(null);
    const provider = findProvider(id);
    if (!provider) {
      setError(`${id === 'phantom' ? 'Phantom' : 'SafePal'} Solana provider not detected. Install/enable its extension or open this site inside its supported wallet browser. No simulated connection will be made.`);
      return;
    }
    setBusy(id);
    try {
      const result = await provider.connect();
      const address = result?.publicKey?.toString();
      if (!address || address.length < 32) throw new Error('Wallet did not return a valid public address.');
      onConnect(address, id === 'phantom' ? 'Phantom' : 'SafePal');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection cancelled or failed.');
    } finally { setBusy(null); }
  };

  const disconnect = async () => {
    const provider = findProvider(walletName === 'SafePal' ? 'safepal' : 'phantom');
    try { await provider?.disconnect?.(); } catch { /* local session still cleared */ }
    onDisconnect();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-white shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Wallet className="h-5 w-5 text-purple-400" /> Solana Wallet</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {connectedWallet ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-400">Connected through {walletName} (read-only)</p>
            <div className="break-all rounded-lg bg-zinc-950 p-3 font-mono text-xs">{connectedWallet}</div>
            <div className="flex items-center justify-between text-sm">
              <span>SOL balance (mainnet)</span>
              <span>{solBalance === null ? 'Unavailable' : `${solBalance.toFixed(4)} SOL`}</span>
            </div>
            {solBalance !== null && <p className="text-right text-xs text-zinc-400">≈ ${(solBalance * solPriceUsd).toFixed(2)} USD (estimated)</p>}
            {balanceError && <p className="text-xs text-amber-400">Balance lookup failed: {balanceError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => void navigator.clipboard?.writeText(connectedWallet)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm"><Copy className="mr-1 inline h-4 w-4" />Copy</button>
              <a href={`https://solscan.io/account/${connectedWallet}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-zinc-800 px-3 py-2 text-sm"><ExternalLink className="mr-1 inline h-4 w-4" />Explorer</a>
              <button type="button" onClick={() => void disconnect()} className="rounded-lg bg-rose-900/60 px-3 py-2 text-sm"><LogOut className="mr-1 inline h-4 w-4" />Disconnect</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {(['phantom', 'safepal'] as const).map(id => (
              <button key={id} type="button" disabled={busy !== null} onClick={() => void connect(id)} className="flex w-full items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-left hover:border-purple-500 disabled:opacity-60">
                <span className="font-semibold">{id === 'phantom' ? 'Phantom' : 'SafePal'}</span>
                {busy === id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <span className="text-xs text-purple-300">Connect</span>}
              </button>
            ))}
            {error && <p role="alert" className="rounded-lg border border-rose-700 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
            <p className="flex gap-2 text-xs text-zinc-400"><ShieldCheck className="h-4 w-4 shrink-0" />No private keys or seed phrases requested. Wallet approval is required. This connection does not authorize trading.</p>
            <p className="text-xs text-zinc-500">Mobile QR pairing is not yet implemented. Use a compatible wallet browser or extension.</p>
          </div>
        )}
      </div>
    </div>
  );
};
