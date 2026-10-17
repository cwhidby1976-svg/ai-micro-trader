import React, { useState } from 'react';
import {
  Wallet,
  X,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Zap,
  ArrowRightLeft,
  Coins
} from 'lucide-react';

export interface MockWalletOption {
  id: string;
  name: string;
  iconBg: string;
  badgeColor: string;
  address: string;
  description: string;
  initialSol: number;
}

export const MOCK_WALLETS: MockWalletOption[] = [
  {
    id: 'phantom',
    name: 'Phantom',
    iconBg: 'from-purple-600 to-indigo-700',
    badgeColor: 'text-purple-400 border-purple-500/40 bg-purple-950/40',
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    description: 'Most popular Solana wallet & browser extension',
    initialSol: 64.72,
  },
  {
    id: 'solflare',
    name: 'Solflare',
    iconBg: 'from-amber-500 to-orange-600',
    badgeColor: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    description: 'Non-custodial Solana web & mobile wallet',
    initialSol: 42.15,
  },
  {
    id: 'safepal',
    name: 'SafePal',
    iconBg: 'from-blue-600 to-indigo-900',
    badgeColor: 'text-blue-400 border-blue-500/40 bg-blue-950/40',
    address: 'SFPaL8kQ92rV3Tq8Yw1NmE5P4jKhB6tZaCs9uG2o9xY',
    description: 'SafePal Hardware & Mobile Non-Custodial Multi-Chain Wallet',
    initialSol: 38.45,
  },
  {
    id: 'backpack',
    name: 'Backpack',
    iconBg: 'from-rose-600 to-red-700',
    badgeColor: 'text-rose-400 border-rose-500/40 bg-rose-950/40',
    address: '4Nd1mBQtrMJWY86Kjk5r24xScUeX72DsvWp9qP8h5XG2',
    description: 'xNFT & Solana next-gen ecosystem wallet',
    initialSol: 28.5,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    iconBg: 'from-blue-600 to-cyan-700',
    badgeColor: 'text-blue-400 border-blue-500/40 bg-blue-950/40',
    address: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    description: 'Coinbase non-custodial multi-chain wallet',
    initialSol: 15.8,
  },
  {
    id: 'embedded-keypair',
    name: 'Dedicated Bot Keypair',
    iconBg: 'from-emerald-600 to-teal-700',
    badgeColor: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40',
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    description: 'High-speed local bot keypair for automated micro-trades',
    initialSol: 50.0,
  },
];

interface MockWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedWallet: string | null;
  walletName: string;
  solBalance: number;
  solPriceUsd: number;
  onConnect: (address: string, walletName: string, balance?: number) => void;
  onDisconnect: () => void;
  onAirdropSol?: (amount: number) => void;
}

export const MockWalletModal: React.FC<MockWalletModalProps> = ({
  isOpen,
  onClose,
  connectedWallet,
  walletName,
  solBalance,
  solPriceUsd,
  onConnect,
  onDisconnect,
  onAirdropSol,
}) => {
  const [copied, setCopied] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectWallet = async (wallet: MockWalletOption) => {
    setConnectingId(wallet.id);

    // If Phantom and real extension exists in browser
    if (wallet.id === 'phantom') {
      const solana = typeof window !== 'undefined' ? (window as any).solana : null;
      if (solana && solana.isPhantom) {
        try {
          const resp = await solana.connect();
          const realAddr = resp.publicKey.toString();
          setConnectingId(null);
          setIsSwitching(false);
          onConnect(realAddr, 'Phantom', wallet.initialSol);
          onClose();
          return;
        } catch {
          // If rejected or cancelled, fall back to simulated Phantom wallet
        }
      }
    }

    // Brief realistic mock connection animation
    setTimeout(() => {
      setConnectingId(null);
      setIsSwitching(false);
      onConnect(wallet.address, wallet.name, wallet.initialSol);
      onClose();
    }, 450);
  };

  const activeWalletInfo =
    MOCK_WALLETS.find((w) => w.name.toLowerCase() === walletName.toLowerCase()) ||
    MOCK_WALLETS.find((w) => w.address === connectedWallet) ||
    MOCK_WALLETS[0];

  const totalUsdValue = +(solBalance * solPriceUsd).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">
                {connectedWallet && !isSwitching ? 'Solana Wallet Connected' : 'Connect Solana Wallet'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {connectedWallet && !isSwitching
                  ? 'Active non-custodial session & live SOL balance'
                  : 'Select your preferred Solana wallet connector'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {connectedWallet && !isSwitching ? (
            /* ================= CONNECTED VIEW ================= */
            <div className="space-y-4">
              {/* Provider Badge & Network */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-lg border font-semibold ${activeWalletInfo.badgeColor}`}>
                    {walletName || activeWalletInfo.name}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Solana Mainnet (Simulated)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSwitching(true)}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 transition"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  <span>Switch</span>
                </button>
              </div>

              {/* Current SOL Balance Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-950/30 via-zinc-950 to-zinc-950 border border-purple-800/40 relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <Coins className="w-3 h-3 text-purple-400" />
                      <span>Current SOL Balance</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-black text-white font-mono tracking-tight">
                        ◎ {solBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} SOL
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 font-mono mt-0.5">
                      ≈ ${totalUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      <span className="text-zinc-500 text-[10px] ml-1.5">(@ ${solPriceUsd}/SOL)</span>
                    </div>
                  </div>

                  {onAirdropSol && (
                    <button
                      type="button"
                      onClick={() => onAirdropSol(5.0)}
                      className="px-2.5 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                      title="Top up +5.0 SOL balance"
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>+5 SOL</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Active Wallet Address Bar */}
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-zinc-500">Active Public Key Address</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-purple-300 font-medium truncate select-all">
                    {connectedWallet}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(connectedWallet)}
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition text-xs flex items-center gap-1"
                      title="Copy Public Key"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <a
                      href={`https://solscan.io/account/${connectedWallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition text-xs"
                      title="View on Solscan (External)"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Security & Non-Custodial Assurance */}
              <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl flex items-start gap-2.5 text-xs text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  <strong className="text-zinc-300">Non-Custodial Architecture:</strong> Client signs swaps locally via DEX routing. Private keys never touch any server or cloud environment.
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onDisconnect();
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-3 bg-zinc-800 hover:bg-rose-950/60 text-zinc-300 hover:text-rose-300 hover:border-rose-800 border border-zinc-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-purple-600/20"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* ================= SELECT WALLET VIEW ================= */
            <div className="space-y-3">
              {isSwitching && (
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
                  <span className="text-zinc-400">Select a new wallet connector:</span>
                  <button
                    type="button"
                    onClick={() => setIsSwitching(false)}
                    className="text-purple-400 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {MOCK_WALLETS.map((wallet, idx) => {
                  const isConnecting = connectingId === wallet.id;
                  const isCurrentlyActive = connectedWallet === wallet.address;

                  return (
                    <button
                      key={`${wallet.id}-${idx}`}
                      type="button"
                      disabled={isConnecting}
                      onClick={() => handleSelectWallet(wallet)}
                      className={`w-full p-3.5 rounded-xl border text-left transition flex items-center justify-between group ${
                        isCurrentlyActive
                          ? 'bg-purple-950/30 border-purple-600/60 ring-1 ring-purple-500/30'
                          : 'bg-zinc-950 hover:bg-zinc-800/80 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${wallet.iconBg} flex items-center justify-center text-white shadow font-bold text-xs`}
                        >
                          {wallet.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs group-hover:text-purple-300 transition">
                              {wallet.name}
                            </span>
                            {isCurrentlyActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {wallet.description}
                          </p>
                        </div>
                      </div>

                      <div className="text-right pl-2">
                        {isConnecting ? (
                          <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-mono font-bold text-purple-300">
                              ◎ {wallet.initialSol} SOL
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {wallet.address.slice(0, 4)}...{wallet.address.slice(-4)}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Informational Footer */}
              <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
                <span className="text-zinc-300 font-semibold">Simulated Solana Wallet:</span> Connects with zero setup. You can test manual trades, monitor live SOL balance changes, and experience the 15-minute ICC cycles safely.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
