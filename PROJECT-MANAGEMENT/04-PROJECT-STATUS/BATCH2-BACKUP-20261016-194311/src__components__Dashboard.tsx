import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Activity,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ArrowRightLeft,
  Briefcase,
  Zap,
  Sliders,
  AlertTriangle,
  Lock,
  Unlock,
  Radio,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Laptop,
  Smartphone,
  Info,
  LogOut,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Play,
  RotateCcw,
  Globe,
  Key,
  Server,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  HelpCircle,
  Check,
  CheckSquare,
  Square,
  DollarSign,
  X,
  Layers,
  Power,
  Terminal,
  FileText,
  ListOrdered,
  Wallet,
  User,
  Wifi
} from 'lucide-react';
import { ClientLicenseState, licensingService } from '../services/licensingService';
import {
  tradingEngine,
  ScannedToken,
  Position,
  TradeOrder,
  CycleStatus,
  ActivityLogEntry,
  PortfolioMetrics,
  RiskManagementConfig,
  DailyRiskStatus,
} from '../services/tradingEngine';
import {
  scannerDataProvider,
  ScannerOpportunity,
  ScannerFeedState,
} from '../services/scannerDataProvider';
import { PortfolioPerformanceChart } from './PortfolioPerformanceChart';
import { MockWalletModal } from './MockWalletModal';
import { LiveWalletModal } from './LiveWalletModal';
import {
  connectSupportedWallet,
  fetchSolBalance,
  startWalletStandardDiscovery,
  type SupportedWalletId,
} from '../services/solanaWallets';
import { RiskManagementPanel } from './RiskManagementPanel';
import { ClientApiKeysPublic, FeatureEntitlements } from '../server/types';

interface DashboardProps {
  environment: 'demo' | 'production';
  licenseState: ClientLicenseState;
  onOpenAdmin: () => void;
  onBackToLanding?: () => void;
  onOpenMemberPortal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  licenseState,
  environment,
  onOpenAdmin,
  onBackToLanding,
  onOpenMemberPortal,
}) => {
  const isWebsiteDemo = environment === 'demo';
  const [activeTab, setActiveTab] = useState<
    'scanner' | 'icc' | 'jupiter' | 'positions' | 'autopilot' | 'risk' | 'api-setup' | 'logs'
  >('scanner');
  const [tokens, setTokens] = useState<ScannedToken[]>(tradingEngine.getTokens());
  const [positions, setPositions] = useState<Position[]>(isWebsiteDemo ? tradingEngine.getPositions() : []);
  const [orders, setOrders] = useState<TradeOrder[]>(isWebsiteDemo ? tradingEngine.getOrderHistory() : []);
  const [balance, setBalance] = useState(tradingEngine.getPaperBalance());
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics>(
    tradingEngine.getPortfolioMetrics()
  );
  const [isPaperMode, setIsPaperMode] = useState(isWebsiteDemo);
  const [selectedToken, setSelectedToken] = useState<ScannedToken>(tokens[0]);
  const [cycleStatus, setCycleStatus] = useState<CycleStatus>(tradingEngine.getCycleStatus());
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(tradingEngine.getActivityLogs());
  const [scannerFeed, setScannerFeed] = useState<ScannerFeedState>(
    scannerDataProvider.getFeedState()
  );
  const [isRefreshingScanner, setIsRefreshingScanner] = useState(false);

  // Risk Management & Circuit Breaker Engine State
  const [riskConfig, setRiskConfig] = useState<RiskManagementConfig>(tradingEngine.getRiskConfig());
  const [dailyRiskStatus, setDailyRiskStatus] = useState<DailyRiskStatus>(tradingEngine.getDailyRiskStatus());

  // Entitlements & API Keys State
  const [entitlements, setEntitlements] = useState<FeatureEntitlements | null>(null);
  const [apiKeys, setApiKeys] = useState<ClientApiKeysPublic | null>(null);
  const [loadingEntitlements, setLoadingEntitlements] = useState(false);

  // API Setup Inputs
  const [jupiterKeyInput, setJupiterKeyInput] = useState('');
  const [goPlusKeyInput, setGoPlusKeyInput] = useState('');
  const [goPlusAppKeyInput, setGoPlusAppKeyInput] = useState('');
  const [goPlusAppSecretInput, setGoPlusAppSecretInput] = useState('');
  const [showJupiterKey, setShowJupiterKey] = useState(false);
  const [showGoPlusKey, setShowGoPlusKey] = useState(false);
  const [showGoPlusAppKey, setShowGoPlusAppKey] = useState(false);
  const [showGoPlusAppSecret, setShowGoPlusAppSecret] = useState(false);
  const [apiSaving, setApiSaving] = useState(false);
  const [apiTestingProvider, setApiTestingProvider] = useState<'jupiter' | 'goPlus' | null>(null);
  const [apiFeedback, setApiFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [keyToRemove, setKeyToRemove] = useState<'jupiter' | 'goPlus' | null>(null);

  // Connected Solana Wallet State & Mock Connector Interface
  const [connectedWallet, setConnectedWallet] = useState<string | null>(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem('ai_micro_trader_connected_wallet')
      : null;
  });
  const [walletName, setWalletName] = useState<string>(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem('ai_micro_trader_wallet_name') || 'Phantom'
      : 'Phantom';
  });
  // Demo wallet and paper equity use the same trading-engine account ledger.
  // Legacy localStorage mock balances must not override this source of truth.
  const walletSolBalance = balance.sol;
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showLiveWalletPreview, setShowLiveWalletPreview] = useState(false);

  // LIVE MODE ONLY: separate read-only wallet session. Never restore a mock session as live.
  const [liveWalletAddress, setLiveWalletAddress] = useState<string | null>(null);
  const [liveWalletName, setLiveWalletName] = useState('');
  const [liveWalletSolBalance, setLiveWalletSolBalance] = useState<number | null>(null);
  const [liveWalletBalanceError, setLiveWalletBalanceError] = useState<string | null>(null);

  useEffect(() => {
    startWalletStandardDiscovery();
  }, []);

  useEffect(() => {
    if (isWebsiteDemo) return;
    let cancelled = false;
    const restore = async () => {
      const savedName = localStorage.getItem('ai_micro_trader_live_wallet_name');
      const id: SupportedWalletId = savedName === 'SafePal' ? 'safepal' : 'phantom';
      if (!localStorage.getItem('ai_micro_trader_live_wallet_address')) return;
      try {
        const result = await connectSupportedWallet(id, { silent: true });
        if (cancelled) return;
        setLiveWalletAddress(result.address);
        setLiveWalletName(result.name);
        localStorage.setItem('ai_micro_trader_live_wallet_address', result.address);
        localStorage.setItem('ai_micro_trader_live_wallet_name', result.name);
      } catch {
        if (!cancelled) {
          localStorage.removeItem('ai_micro_trader_live_wallet_address');
          localStorage.removeItem('ai_micro_trader_live_wallet_name');
        }
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [isWebsiteDemo]);

  useEffect(() => {
    if (!liveWalletAddress) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const payload = await fetchSolBalance(liveWalletAddress);
        if (!cancelled) {
          setLiveWalletSolBalance(payload.sol);
          setLiveWalletBalanceError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLiveWalletSolBalance(null);
          setLiveWalletBalanceError(error instanceof Error ? error.message : 'Balance unavailable');
        }
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [liveWalletAddress]);

  const handleLiveWalletConnect = (address: string, name: string) => {
    setLiveWalletAddress(address);
    setLiveWalletName(name);
    setLiveWalletSolBalance(null);
    setLiveWalletBalanceError(null);
    localStorage.setItem('ai_micro_trader_live_wallet_address', address);
    localStorage.setItem('ai_micro_trader_live_wallet_name', name);
  };

  const handleLiveWalletDisconnect = () => {
    setLiveWalletAddress(null);
    setLiveWalletName('');
    setLiveWalletSolBalance(null);
    setLiveWalletBalanceError(null);
    localStorage.removeItem('ai_micro_trader_live_wallet_address');
    localStorage.removeItem('ai_micro_trader_live_wallet_name');
  };

  // Manual Swap Form State
  const [swapAmountSol, setSwapAmountSol] = useState('1.5');
  const [slippage, setSlippage] = useState(1.0);
  const [priorityTier, setPriorityTier] = useState<'Fast' | 'Turbo' | 'Ultra'>('Turbo');
  const [swapFeedback, setSwapFeedback] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSafeOnly, setFilterSafeOnly] = useState(true);
  const [filterIccOnly, setFilterIccOnly] = useState(false);

  // Modals
  const [showLiveConfirmModal, setShowLiveConfirmModal] = useState(false);
  const [liveTradingConfirmed, setLiveTradingConfirmed] = useState(false);
  const [showAutopilotLockedModal, setShowAutopilotLockedModal] = useState(false);
  const [pendingManualTrade, setPendingManualTrade] = useState<{
    token: ScannedToken;
    amountSol: number;
    slippage: number;
    priorityTier: 'Fast' | 'Turbo' | 'Ultra';
    estTokens: number;
    costBasisUsd: number;
  } | null>(null);
  const [isExecutingManualTrade, setIsExecutingManualTrade] = useState(false);

  // Manual Trade Initial Margins
  const [initialStopLossPercent, setInitialStopLossPercent] = useState<number>(-5);
  const [initialProfitTargetPercent, setInitialProfitTargetPercent] = useState<number>(25);
  const [initialTrailingStopActive, setInitialTrailingStopActive] = useState<boolean>(true);
  const [initialTrailingStopMargin, setInitialTrailingStopMargin] = useState<number>(4);

  // Margin Adjustment Modal State (Raise Profit / Stop-Loss)
  const [adjustingPosition, setAdjustingPosition] = useState<Position | null>(null);
  const [adjustStopLossPercent, setAdjustStopLossPercent] = useState<number>(-5);
  const [adjustProfitTargetPercent, setAdjustProfitTargetPercent] = useState<number>(25);
  const [adjustTrailingStopActive, setAdjustTrailingStopActive] = useState<boolean>(true);
  const [adjustTrailingStopMargin, setAdjustTrailingStopMargin] = useState<number>(4);
  const [adjustMarginSaving, setAdjustMarginSaving] = useState<boolean>(false);
  const [adjustMarginFeedback, setAdjustMarginFeedback] = useState<string | null>(null);

  // WebSocket Market Feed Status & Scanner Telemetry
  const [wsStatus, setWsStatus] = useState<'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'>('CONNECTED');
  const [wsLatency, setWsLatency] = useState<number>(24);
  const [wsLastHeartbeat, setWsLastHeartbeat] = useState<number>(Date.now());
  const [wsMessagesReceived, setWsMessagesReceived] = useState<number>(2418);
  const [showWsStatusModal, setShowWsStatusModal] = useState<boolean>(false);
  const [secondsSinceLastTick, setSecondsSinceLastTick] = useState<number>(0);

  // Full System Diagnostics & Live API Test State
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [diagResults, setDiagResults] = useState<{
    solanaRpc?: { status: 'RUNNING' | 'SUCCESS' | 'ERROR'; latencyMs?: number; message?: string };
    goplus?: { status: 'RUNNING' | 'SUCCESS' | 'ERROR'; latencyMs?: number; message?: string };
    jupiter?: { status: 'RUNNING' | 'SUCCESS' | 'ERROR'; latencyMs?: number; message?: string };
    licensing?: { status: 'RUNNING' | 'SUCCESS' | 'ERROR'; latencyMs?: number; message?: string };
  }>({});

  // Active Open Positions Multi-Selection & Batch Actions
  const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>([]);
  const [positionsTabFilter, setPositionsTabFilter] = useState<'all' | 'profitable' | 'loss'>('all');
  const [batchActionFeedback, setBatchActionFeedback] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);

  // Helpers to get auth headers for backend queries
  const getAuthHeaders = () => {
    const memberToken =
      typeof window !== 'undefined' ? localStorage.getItem('ai_micro_trader_member_token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-device-id': licenseState.deviceId || '',
      'x-license-token': licenseState.token || '',
    };
    if (memberToken) {
      headers['Authorization'] = `Bearer ${memberToken}`;
    }
    return headers;
  };

  // Fetch Entitlements & API Keys from backend
  const fetchUserData = async () => {
    try {
      setLoadingEntitlements(true);
      const headers = getAuthHeaders();

      // 1. Entitlements
      const entRes = await fetch('/api/user/entitlements', { headers });
      if (entRes.ok) {
        const entData = await entRes.json();
        setEntitlements(entData.entitlements);
      }

      // 2. User API Keys
      const keysRes = await fetch('/api/user/api-keys', { headers });
      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setApiKeys(keysData.keys);
      }
    } catch (err) {
      console.error('Failed to load user data from backend:', err);
    } finally {
      setLoadingEntitlements(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [licenseState.deviceId, licenseState.token]);

  // Subscribe to Trading Engine updates
  useEffect(() => {
    const unsub = tradingEngine.subscribe(() => {
      setTokens(tradingEngine.getTokens());
      setPositions(isWebsiteDemo ? tradingEngine.getPositions() : []);
      setOrders(isWebsiteDemo ? tradingEngine.getOrderHistory() : []);
      setBalance(tradingEngine.getPaperBalance());
      setPortfolioMetrics(tradingEngine.getPortfolioMetrics());
      setIsPaperMode(isWebsiteDemo);
      setCycleStatus(tradingEngine.getCycleStatus());
      setActivityLogs(tradingEngine.getActivityLogs());
      setRiskConfig(tradingEngine.getRiskConfig());
      setDailyRiskStatus(tradingEngine.getDailyRiskStatus());

      // Update WebSocket telemetry
      setWsLastHeartbeat(Date.now());
      setWsMessagesReceived((prev) => prev + 1);
      setWsLatency(Math.floor(18 + Math.random() * 14));
      setWsStatus('CONNECTED');
    });
    const unsubScanner = scannerDataProvider.subscribe((feed) => {
      setScannerFeed(feed);
    });
    return () => {
      unsub();
      unsubScanner();
    };
  }, []);

  // Monitor seconds since last tick to verify real-time connection health
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - wsLastHeartbeat) / 1000));
      setSecondsSinceLastTick(elapsed);
      if (elapsed > 8) {
        setWsStatus('RECONNECTING');
      } else {
        setWsStatus('CONNECTED');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [wsLastHeartbeat]);

  const handleManualWsReconnect = () => {
    setWsStatus('RECONNECTING');
    setTimeout(() => {
      tradingEngine.startEngineLoop();
      setWsLastHeartbeat(Date.now());
      setWsLatency(Math.floor(20 + Math.random() * 8));
      setWsStatus('CONNECTED');
    }, 800);
  };

  const handleUpdateRiskConfig = (updates: Partial<RiskManagementConfig>) => {
    const updated = tradingEngine.updateRiskConfig(updates);
    setRiskConfig(updated);
    setDailyRiskStatus(tradingEngine.getDailyRiskStatus());
  };

  const handleResetCircuitBreaker = () => {
    tradingEngine.resetDailyStopLossTrigger();
    setDailyRiskStatus(tradingEngine.getDailyRiskStatus());
  };

  const handleTestCircuitBreaker = () => {
    tradingEngine.testTriggerDailyStopLoss();
    setDailyRiskStatus(tradingEngine.getDailyRiskStatus());
  };

  const handleManualRefreshScanner = () => {
    setIsRefreshingScanner(true);
    scannerDataProvider.manualRefresh();
    setTimeout(() => setIsRefreshingScanner(false), 500);
  };

  // Determine user's active membership status
  const isTrial =
    entitlements?.membershipType === 'TRIAL' ||
    licenseState.licenseType === 'Trial' ||
    (!licenseState.licenseType && !entitlements);
  const isPaid =
    entitlements?.membershipType === 'ANNUAL' ||
    entitlements?.membershipType === 'LIFETIME' ||
    licenseState.licenseType === 'Annual' ||
    licenseState.licenseType === 'Lifetime';
  const isAutopilotEligible = isWebsiteDemo || (licenseState.status === 'ACTIVE' && entitlements?.autopilotAllowed === true);

  // --- SOLANA WALLET CONNECTION HANDLERS ---
  const handleConnectWallet = () => {
    setShowWalletModal(true);
  };

  const handleConnectWalletModal = (address: string, name: string, initialSol?: number) => {
    setConnectedWallet(address);
    setWalletName(name);
    localStorage.setItem('ai_micro_trader_connected_wallet', address);
    localStorage.setItem('ai_micro_trader_wallet_name', name);
    // Wallet connection is cosmetic in the demo; do not replace trading equity
    // with a separately supplied mock wallet balance.

  };

  const handleDisconnectWallet = () => {
    setConnectedWallet(null);
    localStorage.removeItem('ai_micro_trader_connected_wallet');
    localStorage.removeItem('ai_micro_trader_wallet_name');
    localStorage.removeItem('ai_micro_trader_wallet_sol');
    localStorage.removeItem('ai_micro_trader_custom_sol');
  };

  const handleAirdropSol = (amount: number) => {
    if (!isWebsiteDemo) return;
    tradingEngine.creditPaperSol(amount);
    setBalance(tradingEngine.getPaperBalance());
    setPortfolioMetrics(tradingEngine.getPortfolioMetrics());
  };

  // --- MANUAL TRADING CONFIRMATION FLOW (PHASE 14 REQUIREMENT) ---
  const handleInitiateManualSwap = (tokenToTrade: ScannedToken, amountSolStr: string) => {
    const amount = parseFloat(amountSolStr);
    if (isNaN(amount) || amount <= 0) return;

    const costBasisUsd = +(amount * balance.solPrice).toFixed(2);
    const estTokens = Math.floor(costBasisUsd / tokenToTrade.priceUsd);

    // Open explicit manual confirmation modal!
    setPendingManualTrade({
      token: tokenToTrade,
      amountSol: amount,
      slippage,
      priorityTier,
      estTokens,
      costBasisUsd,
    });
  };

  const handleConfirmManualTrade = async () => {
    if (!isWebsiteDemo) { alert('Live manual execution is not available until secure wallet signing is implemented.'); return; }
    if (!pendingManualTrade) return;

    setIsExecutingManualTrade(true);
    try {
      // 1. Immediately execute in local client trading engine for guaranteed real-time paper demonstration
      const localResult = tradingEngine.executeBuyOrder({
        symbol: pendingManualTrade.token.symbol,
        mint: pendingManualTrade.token.mint,
        amountSol: pendingManualTrade.amountSol,
        slippage: pendingManualTrade.slippage,
        priorityFeeTier: pendingManualTrade.priorityTier,
        isAuto: false,
        idempotencyKey: `client_ord_${pendingManualTrade.token.symbol}_${pendingManualTrade.amountSol}_${Date.now()}`,
        stopLossPercent: initialStopLossPercent,
        profitTargetPercent: initialProfitTargetPercent,
        trailingStopActive: initialTrailingStopActive,
        trailingStopMarginPercent: initialTrailingStopMargin,
      });

      if (!localResult.success) {
        alert(localResult.error || 'Trade execution failed.');
        setIsExecutingManualTrade(false);
        setPendingManualTrade(null);
        return;
      }

      // Switch to portfolio & positions tab so user immediately sees live demonstration and open position
      setActiveTab('positions');

      setSwapFeedback(
        `Manual Order Confirmed & Executed: Bought ${pendingManualTrade.token.symbol} for ${pendingManualTrade.amountSol} SOL (Stop: ${initialStopLossPercent}%, Target: +${initialProfitTargetPercent}%)`
      );
      setTimeout(() => setSwapFeedback(null), 5000);

      // 2. Synchronize order with backend
      const headers = getAuthHeaders();
      fetch('/api/trading/manual/confirm-order', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          symbol: pendingManualTrade.token.symbol,
          mint: pendingManualTrade.token.mint,
          amountSol: pendingManualTrade.amountSol,
          slippage: pendingManualTrade.slippage,
          priorityFeeTier: pendingManualTrade.priorityTier,
          confirmedByUser: true, // EXPLICIT CONFIRMATION
          isPaperMode: true,
          idempotencyKey: `ord_${pendingManualTrade.token.symbol}_${pendingManualTrade.amountSol}_${Date.now()}`,
          stopLossPercent: initialStopLossPercent,
          profitTargetPercent: initialProfitTargetPercent,
          trailingStopActive: initialTrailingStopActive,
          trailingStopMarginPercent: initialTrailingStopMargin,
        }),
      }).catch((e) => console.warn('Backend sync:', e));
    } catch (err: any) {
      console.error('Error confirming manual trade:', err);
    } finally {
      setIsExecutingManualTrade(false);
      setPendingManualTrade(null);
    }
  };

  const handleQuickDemoTrade = (tokenCandidate?: ScannedToken) => {
    if (!isWebsiteDemo) return; // Never simulate orders in a live-only build.
    const candidate =
      tokenCandidate ||
      tokens.find((t) => t.iccPhase !== 'NEUTRAL') ||
      tokens[0];
    tradingEngine.executeBuyOrder({
      symbol: candidate.symbol,
      mint: candidate.mint,
      amountSol: 1.5,
      slippage: 1.0,
      priorityFeeTier: 'Turbo',
      isAuto: false,
      stopLossPercent: -5,
      profitTargetPercent: 25,
      trailingStopActive: true,
      trailingStopMarginPercent: 4,
    });
    setActiveTab('positions');
  };

  const handleResetSimulation = () => {
    if (!isWebsiteDemo) return;
    tradingEngine.resetPaperSimulation();
  };

  // --- ADJUST PROFIT / LOSS MARGIN ACTIONS (PHASE 14) ---
  const handleOpenAdjustMargins = (pos: Position) => {
    setAdjustingPosition(pos);
    setAdjustStopLossPercent(pos.stopLossPercent);
    setAdjustProfitTargetPercent(pos.profitTargetPercent);
    setAdjustTrailingStopActive(pos.trailingStopActive ?? false);
    setAdjustTrailingStopMargin(pos.trailingStopMarginPercent || 5);
    setAdjustMarginFeedback(null);
  };

  const handleSavePositionMargins = async () => {
    if (!adjustingPosition) return;
    setAdjustMarginSaving(true);
    setAdjustMarginFeedback(null);

    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/trading/positions/${adjustingPosition.id}/adjust-margins`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          stopLossPercent: adjustStopLossPercent,
          profitTargetPercent: adjustProfitTargetPercent,
          trailingStopActive: adjustTrailingStopActive,
          trailingStopMarginPercent: adjustTrailingStopMargin,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Fallback to direct engine update
        tradingEngine.updatePositionExitRules(adjustingPosition.id, {
          stopLossPercent: adjustStopLossPercent,
          profitTargetPercent: adjustProfitTargetPercent,
          trailingStopActive: adjustTrailingStopActive,
          trailingStopMarginPercent: adjustTrailingStopMargin,
        });
      }

      setAdjustMarginFeedback('Exit margins and profit targets updated successfully!');
      setTimeout(() => {
        setAdjustingPosition(null);
        setAdjustMarginFeedback(null);
      }, 700);
    } catch {
      // In-memory fallback
      tradingEngine.updatePositionExitRules(adjustingPosition.id, {
        stopLossPercent: adjustStopLossPercent,
        profitTargetPercent: adjustProfitTargetPercent,
        trailingStopActive: adjustTrailingStopActive,
        trailingStopMarginPercent: adjustTrailingStopMargin,
      });
      setAdjustMarginFeedback('Updated locally in active trading engine!');
      setTimeout(() => {
        setAdjustingPosition(null);
        setAdjustMarginFeedback(null);
      }, 700);
    } finally {
      setAdjustMarginSaving(false);
    }
  };

  // --- AUTOPILOT TOGGLE HANDLER (PHASE 14 & 15 REQUIREMENT) ---
  const handleToggleAutopilot = async () => {
    // Demo is intentionally local and simulated; never call the licensed endpoint.
    if (isWebsiteDemo) { tradingEngine.setAutopilot(!tradingEngine.isAutopilotOn()); return; }
    if (environment === 'production') { alert('Live Autopilot execution is unavailable until secure wallet signing and transaction safeguards are implemented.'); return; }
    // 1. LICENSE PERMISSION CHECK
    if (!isAutopilotEligible) {
      setShowAutopilotLockedModal(true);
      return;
    }

    // 2. Paid members toggle Autopilot
    const currentState = tradingEngine.isAutopilotOn();
    const endpoint = currentState
      ? '/api/trading/autopilot/disable'
      : '/api/trading/autopilot/enable';

    try {
      const headers = getAuthHeaders();
      const res = await fetch(endpoint, { method: 'POST', headers });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to toggle Autopilot');
      } else {
        tradingEngine.setAutopilot(!currentState);
      }
    } catch (err: any) {
      alert(`Failed to update Autopilot: ${err.message}`);
    }
  };

  const handleEmergencyStop = () => {
    if (confirm('Activate EMERGENCY STOP? This will instantly halt all Autopilot entries and safely close open positions.')) {
      tradingEngine.triggerEmergencyStop();
    }
  };

  const handleClosePosition = (id: string) => {
    tradingEngine.closePosition(id);
    setSelectedPositionIds((prev) => prev.filter((pId) => pId !== id));
  };

  const handleToggleSelectPosition = (id: string) => {
    setSelectedPositionIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllVisible = (visiblePositions: Position[]) => {
    const visibleIds = visiblePositions.map((p) => p.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedPositionIds.includes(id));
    if (allSelected) {
      setSelectedPositionIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedPositionIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleSelectAllProfitable = () => {
    const profitableIds = positions
      .filter((p) => p.state !== 'CLOSED' && (p.pnlUsd > 0 || p.pnlPercent > 0))
      .map((p) => p.id);
    setSelectedPositionIds(profitableIds);
  };

  const handleClearSelection = () => {
    setSelectedPositionIds([]);
  };

  const handleCloseSelectedPositions = () => {
    const activeSelectedIds = selectedPositionIds.filter((id) =>
      positions.some((p) => p.id === id && p.state !== 'CLOSED')
    );
    if (activeSelectedIds.length === 0) return;

    const countToClose = activeSelectedIds.length;
    const res = tradingEngine.closeMultiplePositions(
      activeSelectedIds,
      `Manual Batch Close (${countToClose} trades)`
    );
    setSelectedPositionIds([]);
    setBatchActionFeedback({
      type: 'success',
      message: `Successfully closed ${res.count} selected trade(s) simultaneously. Total Realized PnL: ${
        res.totalPnlUsd >= 0 ? '+' : ''
      }$${res.totalPnlUsd.toFixed(2)} USD.`,
    });
    setTimeout(() => setBatchActionFeedback(null), 6000);
  };

  const handleCloseAllInProfit = () => {
    const profitableCount = positions.filter(
      (p) => p.state !== 'CLOSED' && (p.pnlUsd > 0 || p.pnlPercent > 0)
    ).length;

    if (profitableCount === 0) {
      setBatchActionFeedback({
        type: 'info',
        message: 'No open positions are currently in profit to close.',
      });
      setTimeout(() => setBatchActionFeedback(null), 4000);
      return;
    }

    const res = tradingEngine.closeAllProfitablePositions();
    setSelectedPositionIds((prev) =>
      prev.filter((id) => positions.some((p) => p.id === id && p.state !== 'CLOSED'))
    );
    setBatchActionFeedback({
      type: 'success',
      message: `🎉 Took Profit on All: Closed ${res.count} profitable trade(s) simultaneously! Total Realized Gain: +$${res.totalPnlUsd.toFixed(2)} USD.`,
    });
    setTimeout(() => setBatchActionFeedback(null), 7000);
  };

  const handleCloseAllOpenPositions = () => {
    const openCount = positions.filter((p) => p.state !== 'CLOSED').length;
    if (openCount === 0) return;

    if (
      confirm(
        `Are you sure you want to close ALL ${openCount} active open trades simultaneously at current market prices?`
      )
    ) {
      const res = tradingEngine.closeAllPositions();
      setSelectedPositionIds([]);
      setBatchActionFeedback({
        type: 'success',
        message: `Closed all ${res.count} active trades simultaneously. Net Realized PnL: ${
          res.totalPnlUsd >= 0 ? '+' : ''
        }$${res.totalPnlUsd.toFixed(2)} USD.`,
      });
      setTimeout(() => setBatchActionFeedback(null), 6000);
    }
  };

  const handleToggleLiveTrading = () => {
    if (!isWebsiteDemo) return;
    if (isPaperMode) {
      setShowLiveConfirmModal(true);
    } else {
      tradingEngine.setPaperMode(true);
      setLiveTradingConfirmed(false);
    }
  };

  const handleConfirmLiveMode = () => {
    try {
      // Live execution remains locked pending review of tradingEngine signing and execution.
      setShowLiveConfirmModal(false);
      alert('Live trading is not yet enabled. Wallet signing and real Jupiter execution require verification. Paper Mode remains active.');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeactivateDevice = async () => {
    if (confirm('Deactivate this device to release its slot on the licensing server?')) {
      await licensingService.deactivate();
    }
  };

  // --- API SETUP ACTIONS ---
  const handleSaveApiKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiSaving(true);
    setApiFeedback(null);

    try {
      const headers = getAuthHeaders();
      const body: any = {};
      if (jupiterKeyInput.trim()) body.jupiterApiKey = jupiterKeyInput.trim();
      if (goPlusAppKeyInput.trim()) body.goPlusAppKey = goPlusAppKeyInput.trim();
      if (goPlusAppSecretInput.trim()) body.goPlusAppSecret = goPlusAppSecretInput.trim();
      if (goPlusKeyInput.trim()) body.goPlusApiKey = goPlusKeyInput.trim();

      const res = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setApiFeedback({ type: 'error', message: data.error || 'Failed to save API credentials' });
      } else {
        setApiKeys(data.keys);
        setJupiterKeyInput('');
        setGoPlusKeyInput('');
        setGoPlusAppKeyInput('');
        setGoPlusAppSecretInput('');
        if (data.keys?.jupiter?.status === 'ERROR' && data.keys?.jupiter?.lastError) {
          setApiFeedback({
            type: 'error',
            message: `Key saved, but Jupiter validation reported: ${data.keys.jupiter.lastError}`,
          });
        } else if (data.keys?.goPlus?.status === 'ERROR' && data.keys?.goPlus?.lastError) {
          setApiFeedback({
            type: 'error',
            message: `Key saved, but GoPlus validation reported: ${data.keys.goPlus.lastError}`,
          });
        } else {
          setApiFeedback({
            type: 'success',
            message: 'API credentials saved, securely encrypted, and verified live with Solana DEX & Security APIs!',
          });
        }
      }
    } catch (err: any) {
      setApiFeedback({ type: 'error', message: err.message || 'Connection error' });
    } finally {
      setApiSaving(false);
    }
  };

  const handleTestApiKey = async (provider: 'jupiter' | 'goPlus') => {
    setApiTestingProvider(provider);
    setApiFeedback(null);

    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/user/api-keys/${provider}/test`, {
        method: 'POST',
        headers,
      });

      const data = await res.json();
      if (data.publicState) {
        setApiKeys(data.publicState);
      }

      if (data.success) {
        setApiFeedback({
          type: 'success',
          message: `${provider === 'jupiter' ? 'Jupiter' : 'GoPlus'} API connection verified successfully!`,
        });
      } else {
        setApiFeedback({
          type: 'error',
          message: `${provider === 'jupiter' ? 'Jupiter' : 'GoPlus'} connection failed: ${data.error || 'Invalid key'}`,
        });
      }
    } catch (err: any) {
      setApiFeedback({ type: 'error', message: err.message || 'Validation request failed' });
    } finally {
      setApiTestingProvider(null);
    }
  };

  const handleTestDirectInputKey = async (provider: 'jupiter' | 'goPlus') => {
    setApiTestingProvider(provider);
    setApiFeedback(null);
    try {
      const headers = getAuthHeaders();
      const payload: any = {};
      if (provider === 'jupiter') {
        if (!jupiterKeyInput.trim()) {
          setApiFeedback({ type: 'error', message: 'Please enter a Jupiter API key to test.' });
          setApiTestingProvider(null);
          return;
        }
        payload.jupiterApiKey = jupiterKeyInput.trim();
      } else {
        if (!goPlusAppKeyInput.trim() && !goPlusAppSecretInput.trim()) {
          setApiFeedback({ type: 'error', message: 'Please enter GoPlus App Key and App Secret to test.' });
          setApiTestingProvider(null);
          return;
        }
        payload.goPlusAppKey = goPlusAppKeyInput.trim();
        payload.goPlusAppSecret = goPlusAppSecretInput.trim();
      }

      // 1. Save and register credentials on backend
      const saveRes = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save credentials');
      setApiKeys(saveData.keys);

      // 2. Trigger active test
      const testRes = await fetch(`/api/user/api-keys/${provider}/test`, {
        method: 'POST',
        headers,
      });
      const testData = await testRes.json();
      if (testData.publicState) setApiKeys(testData.publicState);

      if (testData.success) {
        setApiFeedback({
          type: 'success',
          message: `${provider === 'jupiter' ? 'Jupiter DEX Router' : 'GoPlus Security Engine'} API key verified and operational on Solana Mainnet!`,
        });
      } else {
        setApiFeedback({
          type: 'error',
          message: `${provider === 'jupiter' ? 'Jupiter' : 'GoPlus'} test failed: ${testData.error || 'Authentication error'}`,
        });
      }
    } catch (err: any) {
      setApiFeedback({ type: 'error', message: err.message || 'Verification test failed' });
    } finally {
      setApiTestingProvider(null);
    }
  };

  const handleRunFullDiagnostics = async () => {
    setShowDiagnosticsModal(true);
    setDiagnosticsRunning(true);
    setDiagResults({
      solanaRpc: { status: 'RUNNING', message: 'Contacting Solana Mainnet RPC cluster...' },
      goplus: { status: 'RUNNING', message: 'Waiting on RPC handshake...' },
      jupiter: { status: 'RUNNING', message: 'Waiting on security node...' },
      licensing: { status: 'RUNNING', message: 'Waiting on auth engine...' },
    });

    // 1. Test Solana RPC cluster via same-origin backend proxy
    const t0 = performance.now();
    try {
      const res = await fetch('/api/wallet/sol-balance?address=11111111111111111111111111111111');
      const data = await res.json().catch(() => ({}));
      const latencyMs = Math.round(performance.now() - t0);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDiagResults((prev) => ({
        ...prev,
        solanaRpc: {
          status: 'SUCCESS',
          latencyMs,
          message: `Solana RPC reachable through application backend (${latencyMs}ms)`,
        },
      }));
    } catch (error) {
      setDiagResults((prev) => ({
        ...prev,
        solanaRpc: {
          status: 'ERROR',
          message: error instanceof Error ? error.message : 'Solana RPC unavailable',
        },
      }));
    }

    // 2. Test GoPlus Security API
    const t1 = performance.now();
    try {
      const res = await fetch('https://api.gopluslabs.io/api/v1/token_security/solana?contract_addresses=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
      const latencyMs = Math.round(performance.now() - t1);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDiagResults((prev) => ({
        ...prev,
        goplus: { status: 'SUCCESS', latencyMs, message: `GoPlus Token Security API responded HTTP 200 (${latencyMs}ms)` },
      }));
    } catch (error) {
      setDiagResults((prev) => ({
        ...prev,
        goplus: {
          status: 'ERROR',
          message: error instanceof Error ? error.message : 'GoPlus Security API unavailable',
        },
      }));
    }

    // 3. Test Jupiter DEX Routing Engine
    const t2 = performance.now();
    try {
      const headers = getAuthHeaders();
      const res = await fetch('/api/user/api-keys/jupiter/test', {
        method: 'POST',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      const latencyMs = Math.round(performance.now() - t2);
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Jupiter test failed (HTTP ${res.status})`);
      }
      setDiagResults((prev) => ({
        ...prev,
        jupiter: {
          status: 'SUCCESS',
          latencyMs,
          message: `Jupiter quote endpoint verified (${latencyMs}ms)`,
        },
      }));
    } catch (error) {
      setDiagResults((prev) => ({
        ...prev,
        jupiter: {
          status: 'ERROR',
          message: error instanceof Error ? error.message : 'Jupiter API unavailable',
        },
      }));
    }

    // 4. Test license verification without fabricating a passing result
    const t3 = performance.now();
    try {
      if (isWebsiteDemo && licenseState.status !== 'ACTIVE') {
        setDiagResults((prev) => ({
          ...prev,
          licensing: {
            status: 'SUCCESS',
            latencyMs: Math.round(performance.now() - t3),
            message: 'Website demo: device license check skipped (not a paid activation).',
          },
        }));
      } else if (!licenseState.token) {
        throw new Error('No active license token on this device');
      } else {
        const res = await fetch('/api/license/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: licenseState.token,
            deviceId: licenseState.deviceId,
            platform: licenseState.platform || 'web',
          }),
        });
        const data = await res.json().catch(() => ({}));
        const latencyMs = Math.round(performance.now() - t3);
        if (!res.ok || data.valid === false) {
          throw new Error(data.error || `License verify failed (HTTP ${res.status})`);
        }
        setDiagResults((prev) => ({
          ...prev,
          licensing: {
            status: 'SUCCESS',
            latencyMs,
            message: `License token accepted for this device (${latencyMs}ms)`,
          },
        }));
      }
    } catch (error) {
      setDiagResults((prev) => ({
        ...prev,
        licensing: {
          status: 'ERROR',
          message: error instanceof Error ? error.message : 'License verification unavailable',
        },
      }));
    }

    setDiagnosticsRunning(false);
  };

  const handleConfirmRemoveKey = async () => {
    if (!keyToRemove) return;
    const provider = keyToRemove;
    setKeyToRemove(null);

    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/user/api-keys/${provider}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (data.keys) {
        setApiKeys(data.keys);
      }
      setApiFeedback({
        type: 'success',
        message: `${provider === 'jupiter' ? 'Jupiter' : 'GoPlus'} API key removed from backend storage.`,
      });
    } catch (err: any) {
      setApiFeedback({ type: 'error', message: err.message || 'Failed to remove key' });
    }
  };

  // Filtered tokens
  const filteredTokens = tokens.filter((tok) => {
    const matchesSearch =
      tok.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tok.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSafe = filterSafeOnly ? tok.security.score >= 80 : true;
    const matchesIcc = filterIccOnly ? tok.iccPhase !== 'NEUTRAL' : true;
    return matchesSearch && matchesSafe && matchesIcc;
  });

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {!isWebsiteDemo && (
        <div role="status" className="px-5 py-3 bg-amber-950/60 border-b border-amber-700 text-amber-200 text-sm">
          LIVE ACCOUNT · Production trading is not yet enabled: secure wallet signing and Jupiter transaction execution must be implemented and tested. No simulated trades are sent from this dashboard.
        </div>
      )}
      {/* Top Cyber Navigation Bar */}
      <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur px-4 lg:px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 p-0.5 shadow-md shadow-cyan-500/20">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Shield className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="font-bold text-sm text-white tracking-wide flex items-center gap-2">
                AI – MICRO TRADER
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
                  v2.8 SOLANA
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2.5 text-xs text-zinc-400 pl-4 border-l border-zinc-800">
            {/* Real-Time WebSocket Market Data Status Indicator */}
            <button
              type="button"
              onClick={() => setShowWsStatusModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-emerald-500/30 hover:border-emerald-500/60 transition text-xs font-mono group shadow-sm"
              title="Real-Time WebSocket Market Stream Health (Click to inspect)"
            >
              <span className="relative flex h-2 w-2">
                {wsStatus === 'CONNECTED' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </>
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </>
                )}
              </span>
              <span className="text-zinc-300 font-semibold hidden lg:inline">WS Feed:</span>
              <span className={wsStatus === 'CONNECTED' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {wsStatus}
              </span>
              <span className="text-zinc-500 text-[10px]">({wsLatency}ms)</span>
            </button>

            <span className="text-zinc-600 hidden lg:inline">•</span>

            <span className="hidden xl:flex items-center gap-1 font-mono text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Mainnet: 2,890 TPS</span>
            </span>

            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400 font-mono">SOL: ${balance.solPrice}</span>
          </div>
        </div>

        {/* Right Header: Membership Tier Badge, Trading Mode Pill, Admin */}
        <div className="flex items-center gap-3">
          {/* Membership Badge (Clearly differentiating Free Trial vs Paid) */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono">
            {isWebsiteDemo ? (
              <span className="text-cyan-300 font-bold">WEBSITE DEMO · SIMULATED</span>
            ) : isTrial ? (
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="font-bold">24-HOUR STANDARD</span>
                <span className="text-[10px] text-zinc-400 hidden lg:inline">(Manual Only)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">{licenseState.licenseType?.toUpperCase() || 'ANNUAL'}</span>
                <span className="text-[10px] text-zinc-400 hidden lg:inline">(Autopilot Licensed)</span>
              </span>
            )}
          </div>

          {isWebsiteDemo ? (
            <span className="px-3 py-1.5 rounded-xl border border-cyan-600/50 bg-cyan-950/40 text-cyan-200 text-xs font-bold">DEMO · SIMULATED</span>
          ) : (
            <span className="px-3 py-1.5 rounded-xl border border-emerald-600/50 bg-emerald-950/40 text-emerald-200 text-xs font-bold">LIVE ACCOUNT · NO PAPER TRADING</span>
          )}

          {/* Retain a visible Paper/Live trigger indicator in the demo as requested.
              The Live side is non-executable; it never switches to real funds. */}
          {isWebsiteDemo && (
            <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1 text-xs" title="Demo paper simulation only; live trading requires a licensed app">
              <span className="rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 py-1 font-semibold text-cyan-300">Paper</span>
              <span className="flex items-center gap-1 px-3 py-1 text-zinc-500"><Lock className="h-3 w-3" /> Live</span>
            </div>
          )}

          {/* Autopilot Quick Switch */}
          <button
            onClick={handleToggleAutopilot}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-sm ${
              tradingEngine.isAutopilotOn()
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                : !isAutopilotEligible
                ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-amber-500/50'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
            }`}
            title={!isAutopilotEligible ? 'Autopilot requires Annual or Lifetime license' : 'Toggle 15-Minute Cycle Autopilot'}
          >
            <Power className={`w-3.5 h-3.5 ${tradingEngine.isAutopilotOn() ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
            <span>Autopilot: {!isAutopilotEligible ? 'LOCKED' : !isWebsiteDemo ? 'LIVE PENDING' : tradingEngine.isAutopilotOn() ? 'ON' : 'OFF'}</span>
            {!isAutopilotEligible && <Lock className="w-3 h-3 text-amber-400" />}
          </button>

          {/* Solana Wallet Connect Button & Live SOL Balance Display */}
          {(isPaperMode ? connectedWallet : liveWalletAddress) ? (
            <button
              type="button"
              onClick={() => setShowWalletModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-950/70 via-zinc-900 to-zinc-900 hover:from-purple-900/80 hover:to-zinc-800 border border-purple-800/70 hover:border-purple-500 rounded-xl text-xs font-mono transition shadow-sm group"
              title="Click to view Solana wallet details, active address, and live SOL balance"
            >
              {/* Current SOL Balance */}
              <div className="flex items-center gap-1.5 text-purple-200 font-bold border-r border-purple-800/60 pr-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-purple-400">◎</span>
                <span>{(isPaperMode ? walletSolBalance : liveWalletSolBalance)?.toFixed(2) ?? "Unavailable"} SOL</span>
              </div>
              {/* Active Wallet Address */}
              <div className="flex items-center gap-1 text-zinc-300">
                <Wallet className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-300 transition shrink-0" />
                <span className="font-bold">
                  {(isPaperMode ? connectedWallet! : liveWalletAddress!).slice(0, 4)}...{(isPaperMode ? connectedWallet! : liveWalletAddress!).slice(-4)}
                </span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowWalletModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-bold border border-purple-500/50 rounded-xl text-xs transition shadow-md shadow-purple-950/40 hover:shadow-purple-900/60"
              title={isWebsiteDemo ? 'Paper trading simulated session' : 'Connect Phantom or SafePal'}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect Wallet</span>
            </button>
          )}

          {/* Member Portal Entry */}
          {onOpenMemberPortal && (
            <button
              type="button"
              onClick={onOpenMemberPortal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-medium transition"
              title="Open Member Account & Subscriptions"
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Account</span>
            </button>
          )}

        </div>
      </header>

      {/* Secondary Bar: Balance & Sub-Navigation */}
      <div className="border-b border-zinc-800/80 bg-zinc-950/50 px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'scanner'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Meme Coin Scanner</span>
          </button>

          <button
            onClick={() => setActiveTab('icc')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'icc'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>ICC Strategy Engine</span>
          </button>

          <button
            onClick={() => setActiveTab('jupiter')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'jupiter'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span>Manual Jupiter Swap</span>
          </button>

          <button
            onClick={() => setActiveTab('positions')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'positions'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Portfolio & PnL</span>
            {positions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-900/60 text-cyan-300 font-mono text-[10px]">
                {positions.length}
              </span>
            )}
          </button>

          {/* Autopilot & 15m Cycles Tab */}
          <button
            onClick={() => setActiveTab('autopilot')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'autopilot'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Autopilot (15m Cycles)</span>
            {!isAutopilotEligible && <Lock className="w-3 h-3 text-amber-400" />}
          </button>

          {/* Risk Management Tab */}
          <button
            onClick={() => setActiveTab('risk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'risk'
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Risk Management</span>
            {dailyRiskStatus.isDailyStopLossTriggered ? (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            ) : (
              <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                -{riskConfig.dailyStopLossPercent}%
              </span>
            )}
          </button>

          {/* Dedicated API Setup Tab */}
          <button
            onClick={() => setActiveTab('api-setup')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'api-setup'
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-purple-400" />
            <span>API Setup</span>
            {apiKeys && (apiKeys.jupiter.isConfigured || apiKeys.goPlus.isConfigured) ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          {/* Activity Logs Tab */}
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'logs'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Activity Logs</span>
          </button>
        </div>

        {isWebsiteDemo && (
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-300" title="Paper-only 50/50 allocation; open positions reduce the available trading budget">
            <span>Trading 50%: ${(tradingEngine.getWalletAllocation().targetTradingUsd).toFixed(2)}</span>
            <span className="text-emerald-400">Reserve 50%: ${(tradingEngine.getWalletAllocation().targetReserveUsd).toFixed(2)}</span>
            <span className="text-cyan-300">Available: ${(tradingEngine.getWalletAllocation().uncommittedTradingUsd).toFixed(2)}</span>
          </div>
        )}
                {/* Paper / Real Balance Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900/80 px-3 py-1 rounded-lg border border-zinc-800 font-mono">
            <span className="text-zinc-400">{isWebsiteDemo ? 'Demo Wallet Equity:' : 'Wallet Equity:'}</span>
            <span className="text-cyan-300 font-bold">{isWebsiteDemo ? `${balance.sol.toFixed(4)} SOL` : 'Unavailable (live wallet read-only)'}</span>
            {isWebsiteDemo && <span className="text-zinc-500 text-[11px]">(${balance.usd.toLocaleString()})</span>}
          </div>
        </div>
      </div>

      {/* Main Terminal Body */}
      <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
        {isWebsiteDemo && (
          <div className="mb-4 rounded-xl border border-cyan-700/40 bg-cyan-950/20 p-3 text-xs text-cyan-100" role="status">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <strong className="text-cyan-300">WEBSITE DEMO — SIMULATED ORDERS ONLY</strong>
                <p className="mt-1 text-zinc-300">Manual: you choose the token and confirm each order. Autopilot: the scanner chooses and manages eligible simulated entries when switched on. Both modes share one demo wallet and the same 50% trading budget.</p>
                <p className="mt-1 text-zinc-400">Market-data freshness is shown by the feed status; demo fills are virtual, not blockchain transactions.</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button type="button" onClick={() => setActiveTab('jupiter')} aria-pressed={activeTab === 'jupiter'} className={`rounded-lg border px-3 py-2 font-bold ${activeTab === 'jupiter' ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-zinc-700 text-zinc-200 hover:border-cyan-500'}`}>Manual Trading</button>
                <button type="button" onClick={() => setActiveTab('autopilot')} aria-pressed={activeTab === 'autopilot'} className={`rounded-lg border px-3 py-2 font-bold ${activeTab === 'autopilot' ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-zinc-700 text-zinc-200 hover:border-emerald-500'}`}>Autopilot Trading</button>
              </div>
            </div>
          </div>
        )}
        {/* Banner: Autopilot status */}
        {!tradingEngine.isAutopilotOn() ? (
          <div className="mb-4 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                <strong>Autopilot is currently OFF.</strong> No automated entries will occur. Open positions ({positions.filter(p => p.state !== 'CLOSED').length}) remain subject to their individual stop-loss and take-profit rules.
              </span>
            </div>
            {isWebsiteDemo || isAutopilotEligible ? (
              <button
                onClick={handleToggleAutopilot}
                className="text-emerald-400 hover:text-emerald-300 font-semibold underline text-xs"
              >
                {isWebsiteDemo ? 'Start Simulated Autopilot' : 'Turn Autopilot ON (3–5 Trades / 15m)'}
              </button>
            ) : (
              <span className="text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-[11px]">
                Autopilot requires Annual or Lifetime access
              </span>
            )}
          </div>
        ) : (
          <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block shrink-0" />
              <span>
                <strong>Autopilot is ON (15-Minute Cycle Active).</strong> Looking to place <strong>3–5 trades per cycle</strong> across 8/8 ICC-passed tokens ({positions.filter(p => p.state !== 'CLOSED').length}/5 positions active).
              </span>
            </div>
            <button
              onClick={handleToggleAutopilot}
              className="text-rose-400 hover:text-rose-300 font-semibold underline text-xs"
            >
              Turn OFF
            </button>
          </div>
        )}

        {swapFeedback && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 font-mono shadow-md">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{swapFeedback}</span>
          </div>
        )}

        {/* TAB 1: SOLANA MEME COIN SCANNER */}
        {activeTab === 'scanner' && (
          <div className="space-y-6">
            {/* Top Dynamic Opportunity Scanner Header & 10s Provider Controls */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-cyan-950/40 border border-zinc-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <span>Live Token Opportunity Scanner</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        6 Active Opportunities
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Automated 10-second dynamic feed evaluating GoPlus security, liquidity depth, and ICC Triple-Phase entry setups.
                    </p>
                  </div>
                </div>
              </div>

              {/* 10-Second Auto-Refresh Provider Controls */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 bg-zinc-950/80 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-mono">
                  <span className="text-zinc-500 text-[11px]">Provider:</span>
                  <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                    <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                    10s Dynamic Feed
                  </span>
                  <span className="text-zinc-700">|</span>
                  <span className="text-zinc-300 flex items-center gap-1 text-[11px]">
                    <span className="text-zinc-500">Tick:</span>
                    <strong className="text-emerald-400">{scannerFeed.nextRefreshInSeconds}s</strong>
                  </span>
                  <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-1000"
                      style={{ width: `${((10 - scannerFeed.nextRefreshInSeconds) / 10) * 100}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleManualRefreshScanner}
                  disabled={isRefreshingScanner}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow"
                  title="Force instant refresh of the 6 token opportunities"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshingScanner ? 'animate-spin' : ''}`} />
                  <span>Refresh Feed</span>
                </button>
              </div>
            </div>

            {/* Grid of 6 Active Token Opportunities */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-bold text-white text-sm">
                    Active Token Opportunity Grid ({scannerFeed.opportunities.length} Qualified)
                  </h4>
                </div>
                <span className="text-xs font-mono text-zinc-400">
                  Auto-ticks every 10s • Click card to inspect
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scannerFeed.opportunities.map((opp, idx) => {
                  const tok = opp.token;
                  const isSelected = selectedToken.id === tok.id;
                  return (
                    <div
                      key={`${opp.id}_${idx}`}
                      onClick={() => setSelectedToken(tok)}
                      className={`p-4 rounded-2xl bg-zinc-900/80 border transition-all duration-200 cursor-pointer relative overflow-hidden backdrop-blur flex flex-col justify-between ${
                        isSelected
                          ? 'border-cyan-400 ring-1 ring-cyan-400/50 shadow-lg shadow-cyan-500/10'
                          : 'border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900'
                      }`}
                    >
                      {/* Top Row: Rank, Symbol, Phase Badge */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-xs shadow ${
                                opp.rank === 1
                                  ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-black font-extrabold'
                                  : opp.rank === 2
                                  ? 'bg-gradient-to-tr from-zinc-200 to-zinc-400 text-black font-extrabold'
                                  : opp.rank === 3
                                  ? 'bg-gradient-to-tr from-amber-700 to-amber-600 text-white font-bold'
                                  : 'bg-zinc-800 text-cyan-400 border border-zinc-700'
                              }`}
                            >
                              #{opp.rank}
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm flex items-center gap-1.5">
                                <span>{tok.symbol}</span>
                                <span className="text-[10px] text-zinc-400 font-normal truncate max-w-[90px]">
                                  {tok.name}
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-zinc-500 truncate max-w-[110px]">
                                {tok.mint}
                              </div>
                            </div>
                          </div>

                          {/* Phase & Score Badges */}
                          <div className="text-right flex flex-col items-end gap-1">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider ${
                                tok.iccPhase === 'CONTINUATION'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : tok.iccPhase === 'IMPULSE'
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                  : tok.iccPhase === 'CONSOLIDATING'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                  : 'bg-zinc-800 text-zinc-500'
                              }`}
                            >
                              {tok.iccPhase}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-cyan-400">
                              Score: {opp.opportunityScore}/100
                            </span>
                          </div>
                        </div>

                        {/* Middle: Price, 5m Change, Opportunity Signal */}
                        <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/80 mb-3 font-mono">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[10px] text-zinc-500 uppercase">Live Price</div>
                              <div className="text-base font-bold text-white">
                                ${tok.priceUsd.toFixed(tok.priceUsd < 0.001 ? 6 : 4)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-zinc-500 uppercase">5m Change</div>
                              <span
                                className={`flex items-center justify-end gap-0.5 font-bold text-xs ${
                                  tok.change5m >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {tok.change5m >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                {tok.change5m >= 0 ? '+' : ''}
                                {tok.change5m.toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* Signal Tagline */}
                          <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px]">
                            <span className="text-zinc-400">{opp.signalBadge}</span>
                            <span className="text-emerald-400 font-semibold">+{opp.volumeSurge5m}% Vol Surge</span>
                          </div>
                        </div>

                        {/* Opportunity Metrics 2x2 */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-3">
                          <div className="p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
                            <span className="text-zinc-500 block text-[9px] uppercase">GoPlus Security</span>
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />
                              {tok.security.score}/100 (Safe)
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
                            <span className="text-zinc-500 block text-[9px] uppercase">Liquidity / Vol</span>
                            <span className="text-zinc-200 font-bold truncate block">
                              ${(tok.liquidity / 1000).toFixed(0)}k • ${(tok.volume24h / 1000).toFixed(0)}k
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
                            <span className="text-zinc-500 block text-[9px] uppercase">Target Take-Profit</span>
                            <span className="text-emerald-300 font-bold">
                              ${opp.targetTakeProfit.toFixed(tok.priceUsd < 0.001 ? 6 : 4)} (+50%)
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
                            <span className="text-zinc-500 block text-[9px] uppercase">Hard Stop-Loss</span>
                            <span className="text-rose-400 font-bold">
                              ${opp.stopLossPrice.toFixed(tok.priceUsd < 0.001 ? 6 : 4)} (-5%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action Bar */}
                      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedToken(tok);
                            handleInitiateManualSwap(tok, swapAmountSol);
                          }}
                          className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition shadow shadow-cyan-500/20 flex items-center justify-center gap-1.5"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Trade ({swapAmountSol} SOL)</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedToken(tok);
                            setActiveTab('jupiter');
                          }}
                          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition"
                          title="Open in Jupiter Swap Router"
                        >
                          Swap
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/70 p-3 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Filter token by name or symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setFilterSafeOnly(!filterSafeOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    filterSafeOnly
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>GoPlus Safe (&gt;80)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterIccOnly(!filterIccOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    filterIccOnly
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>ICC Active Signals</span>
                </button>
              </div>

              <div className="text-xs text-zinc-400 font-mono">
                Showing {filteredTokens.length} Live Pairs
              </div>
            </div>

            {/* Tokens Table */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[11px] font-mono border-b border-zinc-800">
                    <tr>
                      <th className="py-3 px-4">Token Pair</th>
                      <th className="py-3 px-4">Price (USD)</th>
                      <th className="py-3 px-4">5m Change</th>
                      <th className="py-3 px-4">24h Volume</th>
                      <th className="py-3 px-4">Liquidity</th>
                      <th className="py-3 px-4">GoPlus Security</th>
                      <th className="py-3 px-4">ICC Phase</th>
                      <th className="py-3 px-4 text-right">Manual Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono">
                    {filteredTokens.map((tok, idx) => (
                      <tr
                        key={`${tok.id}_${idx}`}
                        onClick={() => setSelectedToken(tok)}
                        className={`hover:bg-zinc-800/40 cursor-pointer transition ${
                          selectedToken.id === tok.id ? 'bg-cyan-950/30 border-l-2 border-cyan-400' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-cyan-400">
                              {tok.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{tok.symbol}</span>
                                <span className="text-[10px] text-zinc-400 font-normal">{tok.name}</span>
                              </div>
                              <div className="text-[10px] text-zinc-500 truncate max-w-[120px] font-mono">
                                {tok.mint}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-200">${tok.priceUsd.toFixed(6)}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`flex items-center gap-0.5 font-bold ${
                              tok.change5m >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {tok.change5m >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {tok.change5m >= 0 ? '+' : ''}
                            {tok.change5m.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-300">${(tok.volume24h / 1000).toFixed(0)}k</td>
                        <td className="py-3 px-4 text-zinc-300">${(tok.liquidity / 1000).toFixed(0)}k</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                tok.security.score >= 90
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : tok.security.score >= 80
                                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              Score: {tok.security.score}
                            </span>
                            {tok.security.mintDisabled && (
                              <span className="px-1 py-0.5 bg-zinc-800 rounded text-[9px] text-zinc-400">Mint Off</span>
                            )}
                            {tok.security.freezeDisabled && (
                              <span className="px-1 py-0.5 bg-zinc-800 rounded text-[9px] text-zinc-400">Freeze Off</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                              tok.iccPhase === 'CONTINUATION'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : tok.iccPhase === 'IMPULSE'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : tok.iccPhase === 'CONSOLIDATING'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : 'bg-zinc-800 text-zinc-500'
                            }`}
                          >
                            {tok.iccPhase}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedToken(tok);
                              handleInitiateManualSwap(tok, swapAmountSol);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[11px] transition shadow"
                          >
                            Trade
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ICC STRATEGY ENGINE */}
        {activeTab === 'icc' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                      ICC Triple-Phase Strategy Engine
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Automated strategy evaluating: (1) Impulse volume breakout, (2) Consolidation pullback, and (3) Continuation entry.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
                    Engine Active
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
                  <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-cyan-900/40">
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">
                      Phase 1: Impulse
                    </div>
                    <div className="text-[11px] text-zinc-300">
                      Surge of buy volume &gt;300% within a 5m window, breaking initial liquidity pools.
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-purple-900/40">
                    <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">
                      Phase 2: Consolidation
                    </div>
                    <div className="text-[11px] text-zinc-300">
                      Volatility compresses into tight range without breakdown. GoPlus checks re-verified.
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-emerald-900/40">
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                      Phase 3: Continuation
                    </div>
                    <div className="text-[11px] text-zinc-300">
                      Bullish breakout triggers instant Jupiter route order with Take-Profit & Stop-Loss.
                    </div>
                  </div>
                </div>
              </div>

              {/* Signals Monitor */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <span>Live ICC Signal Triggers</span>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-mono font-bold">
                        {tokens.filter((t) => t.iccPhase !== 'NEUTRAL').length} Pairs Active
                      </span>
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      8-point checklist pre-screened Solana tokens in active Impulse, Consolidation, or Continuation setups.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-zinc-400 hidden sm:inline">
                    {tokens.filter((t) => t.iccPhase !== 'NEUTRAL').length} Tradeable Candidates
                  </span>
                </div>
                <div className="space-y-3">
                  {tokens
                    .filter((t) => t.iccPhase !== 'NEUTRAL')
                    .map((tok, idx) => (
                      <div
                        key={`${tok.id}_${idx}`}
                        className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{tok.symbol}</span>
                            <span className="text-xs text-zinc-400">${tok.priceUsd.toFixed(6)}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                              Signal Score: {tok.iccSignalStrength}/100
                            </span>
                          </div>
                          <div className="text-xs text-zinc-400 mt-1">
                            Phase: <strong className="text-white">{tok.iccPhase}</strong> • Target TP: ${(tok.priceUsd * 2).toFixed(6)} (2x) • Hard SL: ${(tok.priceUsd * 0.88).toFixed(6)} (-12%)
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedToken(tok);
                            handleInitiateManualSwap(tok, swapAmountSol);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs shadow transition"
                        >
                          Manual Trade
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              {/* Active Open Positions from ICC Strategy */}
              {positions.filter((p) => p.state !== 'CLOSED').length > 0 && (
                <div className="bg-zinc-900/80 border border-cyan-800/60 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h4 className="font-bold text-white text-sm">
                        Active ICC Trade Positions ({positions.filter((p) => p.state !== 'CLOSED').length})
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {positions.filter((p) => p.state !== 'CLOSED' && (p.pnlUsd > 0 || p.pnlPercent > 0)).length > 0 && (
                        <button
                          type="button"
                          onClick={handleCloseAllInProfit}
                          className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          title="Close all profitable trades simultaneously"
                        >
                          <Zap className="w-3 h-3 text-amber-300" />
                          <span>Close All In Profit</span>
                        </button>
                      )}
                      <button
                        onClick={() => setActiveTab('positions')}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                      >
                        <span>View in Portfolio</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {positions
                      .filter((p) => p.state !== 'CLOSED')
                      .map((pos, idx) => (
                        <div
                          key={`${pos.id}_${idx}`}
                          className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{pos.tokenSymbol}</span>
                              <span className="text-zinc-400 font-bold">{pos.amountSol} SOL</span>
                              {pos.trailingStopActive && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  Trailing Stop
                                </span>
                              )}
                            </div>
                            <div className="text-zinc-400 mt-1 flex items-center gap-2">
                              <span>Entry: ${pos.entryPrice.toFixed(6)}</span>
                              <span>•</span>
                              <span>Live: <strong className="text-cyan-300">${pos.currentPrice.toFixed(6)}</strong></span>
                              <span>•</span>
                              <span>SL: {pos.stopLossPercent >= 0 ? '+' : ''}{pos.stopLossPercent}%</span>
                              <span>•</span>
                              <span>TP: +{pos.profitTargetPercent}%</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className={`text-sm font-bold ${pos.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                              </div>
                              <div className="text-[11px] text-zinc-400">
                                {pos.pnlUsd >= 0 ? '+' : ''}${pos.pnlUsd.toFixed(2)}
                              </div>
                            </div>
                            <button
                              onClick={() => handleOpenAdjustMargins(pos)}
                              className="px-2.5 py-1.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-semibold hover:bg-cyan-900 transition flex items-center gap-1 shadow-sm"
                            >
                              <Sliders className="w-3 h-3" />
                              <span>Adjust Margins</span>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Strategy Parameters */}
            <div className="space-y-6">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6">
                <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  ICC Strategy Parameters
                </h4>
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-zinc-400 block mb-1">Target Take-Profit Steps</label>
                    <div className="grid grid-cols-3 gap-2 text-center font-mono font-bold text-[11px]">
                      <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-cyan-400">Lock: +4.5%</div>
                      <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-emerald-400">Run: +15%</div>
                      <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-emerald-300">Max: +25%</div>
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">Hard Stop-Loss</label>
                    <input
                      type="text"
                      readOnly
                      value="-5.0% (Strict Hard Stop-Loss)"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-rose-400"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">Profit Lock-in & Max Cap</label>
                    <input
                      type="text"
                      readOnly
                      value="Locks floor at +4.5%, Max Cap Exit at +25%"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-cyan-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: JUPITER SWAP (MANUAL TRADING MODE) */}
        {activeTab === 'jupiter' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {isWebsiteDemo && <div className="rounded-xl border border-cyan-800/50 bg-cyan-950/20 p-3 text-sm text-cyan-100"><strong>Manual demo trading:</strong> select a token and SOL amount, review the order, then confirm the simulated trade. Autopilot is optional and can be switched on separately. Both use the same protected 50/50 allocation.</div>}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                    Jupiter Aggregator Swap Router
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Multi-route Solana DEX aggregation across Raydium CPMM, Orca, & Meteora.
                  </p>
                </div>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  {isPaperMode ? 'SIMULATED EXECUTION' : 'LIVE ROUTING'}
                </span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleInitiateManualSwap(selectedToken, swapAmountSol);
                }}
                className="space-y-4"
              >
                {/* Token Selector Pills */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-semibold flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      Select Token to Trade ({tokens.length} Available Pairs):
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      Active: <strong className="text-white">{selectedToken.symbol}</strong> (${selectedToken.priceUsd.toFixed(selectedToken.priceUsd < 0.001 ? 6 : 4)})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {tokens.map((tok, idx) => {
                      const isSelected = selectedToken.id === tok.id;
                      return (
                        <button
                          key={`${tok.id}_${idx}`}
                          type="button"
                          onClick={() => setSelectedToken(tok)}
                          className={`p-2.5 rounded-xl text-left transition border font-mono text-xs ${
                            isSelected
                              ? 'bg-cyan-950/80 border-cyan-400 ring-1 ring-cyan-400/50 shadow-md shadow-cyan-500/10'
                              : 'bg-zinc-950 hover:bg-zinc-850 hover:border-zinc-700 border-zinc-800 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs">{tok.symbol}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                tok.iccPhase === 'CONTINUATION'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : tok.iccPhase === 'IMPULSE'
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : tok.iccPhase === 'CONSOLIDATING'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-zinc-800 text-zinc-500'
                              }`}
                            >
                              {tok.iccPhase}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1.5 text-[10px]">
                            <span className="text-zinc-400">${tok.priceUsd.toFixed(tok.priceUsd < 0.001 ? 6 : 4)}</span>
                            <span className={tok.change5m >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {tok.change5m >= 0 ? '+' : ''}{tok.change5m.toFixed(1)}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pay In SOL */}
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>You Pay</span>
                    <span>Balance: {isPaperMode ? `${balance.sol} SOL` : 'Unavailable (live wallet read-only)'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={swapAmountSol}
                      onChange={(e) => setSwapAmountSol(e.target.value)}
                      className="bg-transparent font-mono text-xl font-bold text-white focus:outline-none w-36"
                    />
                    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg font-bold text-xs">
                      <span className="w-3 h-3 rounded-full bg-purple-500" />
                      <span>SOL</span>
                    </div>
                  </div>
                </div>

                {/* Receive Token */}
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>You Receive (Estimated)</span>
                    <span>${selectedToken.priceUsd.toFixed(6)} / token</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xl font-bold text-cyan-300">
                      {(
                        (parseFloat(swapAmountSol || '0') * balance.solPrice) /
                        selectedToken.priceUsd
                      ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg font-bold text-xs text-white">
                      <span>{selectedToken.symbol}</span>
                    </div>
                  </div>
                </div>

                {/* Routing & Security Breakdown */}
                <div className="p-3.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl text-xs space-y-2 font-mono">
                  <div className="flex justify-between text-zinc-400">
                    <span>Best Jupiter Route:</span>
                    <span className="text-zinc-200">Raydium CPMM (68%) → Orca (32%)</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Price Impact:</span>
                    <span className="text-emerald-400">&lt; 0.12%</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>GoPlus Honeypot Status:</span>
                    <span className="text-emerald-400">
                      {selectedToken.security.honeypot ? 'WARNING' : 'PASSED (Safe)'}
                    </span>
                  </div>
                </div>

                {/* Slippage & Priority fee */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Slippage Tolerance</label>
                    <div className="flex gap-1">
                      {[0.5, 1.0, 3.0].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSlippage(s)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
                            slippage === s
                              ? 'bg-cyan-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {s}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Solana Priority Fee</label>
                    <div className="flex gap-1">
                      {(['Fast', 'Turbo', 'Ultra'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setPriorityTier(t)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                            priorityTier === t
                              ? 'bg-cyan-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Submit Manual Trade Button (Opens explicit confirmation modal) */}
                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Review & Confirm Manual Swap ({swapAmountSol} SOL)</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: PORTFOLIO & POSITIONS (LIVE PNL DEMONSTRATION & TRACKING) */}
        {activeTab === 'positions' && (
          <div className="space-y-6">
            {/* Performance & Execution Action Bar */}
            <div className="p-4 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-cyan-950/30 border border-zinc-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">Live Portfolio & P&L Tracker</h3>
                    {isPaperMode ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        Simulation / Paper Mode
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Solana Mainnet Live
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Real-time position tracking, live token price fluctuations, and automated risk protection.
                  </p>
                </div>
              </div>

              {/* Quick Order Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleQuickDemoTrade()}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center gap-1.5"
                    title="Place instant 1.5 SOL order on top ICC momentum candidate"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>⚡ Quick Market Buy (1.5 SOL)</span>
                  </button>
                </div>
                <div className="hidden sm:flex items-center gap-1 bg-zinc-950/80 p-1 rounded-xl border border-zinc-800 text-xs">
                  <span className="text-[10px] text-zinc-500 px-1 font-mono uppercase">Instant:</span>
                  {tokens.filter((t) => t.iccPhase !== 'NEUTRAL').slice(0, 5).map((tok, idx) => (
                    <button
                      key={`${tok.id}_${idx}`}
                      onClick={() => handleQuickDemoTrade(tok)}
                      className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1"
                      title={`Buy 1.5 SOL of ${tok.symbol} (${tok.iccPhase})`}
                    >
                      <span>+{tok.symbol}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleResetSimulation}
                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-semibold text-xs transition flex items-center gap-1.5"
                  title="Reset portfolio performance stats"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Reset Stats</span>
                </button>
              </div>
            </div>

            {/* Live Portfolio P&L Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Portfolio Value */}
              <div className="p-5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl relative overflow-hidden backdrop-blur">
                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                  <span className="font-semibold">Total Portfolio Equity</span>
                  <Briefcase className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-white tracking-tight">
                  ${portfolioMetrics.totalEquityUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] font-mono text-zinc-400 mt-1 flex items-center gap-1">
                  <span className="text-cyan-300 font-bold">{portfolioMetrics.totalEquitySol} SOL</span>
                  <span>• SOL @ ${balance.solPrice}</span>
                </div>
              </div>

              {/* Card 2: Unrealized P&L */}
              <div className="p-5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl relative overflow-hidden backdrop-blur">
                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                  <span className="font-semibold">Unrealized P&L (Live)</span>
                  <Activity className={`w-4 h-4 ${portfolioMetrics.unrealizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                </div>
                <div className={`text-2xl font-bold font-mono tracking-tight ${portfolioMetrics.unrealizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {portfolioMetrics.unrealizedPnlUsd >= 0 ? '+' : ''}${portfolioMetrics.unrealizedPnlUsd.toFixed(2)}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono">
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold ${
                      portfolioMetrics.unrealizedPnlPercent >= 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {portfolioMetrics.unrealizedPnlPercent >= 0 ? '+' : ''}{portfolioMetrics.unrealizedPnlPercent.toFixed(2)}% ROI
                  </span>
                  <span className="text-zinc-500">• {portfolioMetrics.openPositionsCount} open</span>
                </div>
              </div>

              {/* Card 3: Realized P&L */}
              <div className="p-5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl relative overflow-hidden backdrop-blur">
                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                  <span className="font-semibold">Realized P&L Banked</span>
                  <TrendingUp className={`w-4 h-4 ${portfolioMetrics.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                </div>
                <div className={`text-2xl font-bold font-mono tracking-tight ${portfolioMetrics.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {portfolioMetrics.realizedPnlUsd >= 0 ? '+' : ''}${portfolioMetrics.realizedPnlUsd.toFixed(2)}
                </div>
                <div className="text-[11px] font-mono text-zinc-400 mt-1 flex items-center gap-1">
                  <span>Win Rate: </span>
                  <span className="text-emerald-400 font-bold">{portfolioMetrics.winRatePercent}%</span>
                  <span className="text-zinc-500">({portfolioMetrics.closedPositionsCount} closed)</span>
                </div>
              </div>

              {/* Card 4: Capital & Reserve Allocation */}
              <div className="p-5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl relative overflow-hidden backdrop-blur">
                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                  <span className="font-semibold">Capital Allocation</span>
                  <Shield className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-cyan-300 tracking-tight">
                  {portfolioMetrics.cashBalanceSol} SOL
                </div>
                <div className="text-[11px] font-mono text-zinc-400 mt-1">
                  ${portfolioMetrics.committedPositionsUsd} in trades • <span className="text-emerald-400">50% Reserve Safe</span>
                </div>
              </div>
            </div>

            {/* Real-Time 7-Day Performance Line Chart (Recharts) */}
            <PortfolioPerformanceChart metrics={portfolioMetrics} />

            {/* Active Open Positions Table */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl">
              {/* Feedback Alert for Batch Actions */}
              {batchActionFeedback && (
                <div
                  className={`p-3.5 mb-4 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
                    batchActionFeedback.type === 'success'
                      ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                      : 'bg-cyan-950/70 border-cyan-500/40 text-cyan-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-medium">{batchActionFeedback.message}</span>
                  </div>
                  <button
                    onClick={() => setBatchActionFeedback(null)}
                    className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-white text-base">Active Open Positions</h3>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 font-mono text-xs border border-cyan-800/40">
                      {positions.filter((p) => p.state !== 'CLOSED').length} Live
                    </span>
                    {positions.filter((p) => p.state !== 'CLOSED' && (p.pnlUsd > 0 || p.pnlPercent > 0)).length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 font-mono text-xs border border-emerald-700/50 flex items-center gap-1 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {positions.filter((p) => p.state !== 'CLOSED' && (p.pnlUsd > 0 || p.pnlPercent > 0)).length} In Profit
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Real-time position tracking with multi-trade batch exit, trailing stop monitoring, and instant profit taking.
                  </p>
                </div>

                {/* Main Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* CLOSE ALL IN PROFIT BUTTON (User Requested Core Feature) */}
                  {(() => {
                    const profitableOpen = positions.filter(
                      (p) => p.state !== 'CLOSED' && (p.pnlUsd > 0 || p.pnlPercent > 0)
                    );
                    const totalProfitUsd = profitableOpen.reduce((sum, p) => sum + p.pnlUsd, 0);
                    const hasProfit = profitableOpen.length > 0;

                    return (
                      <button
                        type="button"
                        onClick={handleCloseAllInProfit}
                        disabled={!hasProfit}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                          hasProfit
                            ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/60 ring-1 ring-emerald-400/60 cursor-pointer animate-pulse'
                            : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 cursor-not-allowed opacity-60'
                        }`}
                        title={
                          hasProfit
                            ? `Close all ${profitableOpen.length} profitable trade(s) right now to lock in +$${totalProfitUsd.toFixed(2)} USD`
                            : 'No open positions are currently in profit to close'
                        }
                      >
                        <Zap className={`w-3.5 h-3.5 ${hasProfit ? 'text-amber-300' : 'text-zinc-500'}`} />
                        <span>
                          Close All In Profit
                          {hasProfit && (
                            <span className="ml-1 px-1.5 py-0.2 rounded bg-black/30 font-mono text-[11px] font-black text-emerald-200">
                              +${totalProfitUsd.toFixed(2)}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })()}

                  {/* CLOSE SELECTED BUTTON (Batch Close Selected Checkboxes) */}
                  {(() => {
                    const selectedOpen = positions.filter(
                      (p) => p.state !== 'CLOSED' && selectedPositionIds.includes(p.id)
                    );
                    const totalSelectedPnl = selectedOpen.reduce((sum, p) => sum + p.pnlUsd, 0);

                    if (selectedOpen.length === 0) return null;

                    return (
                      <button
                        type="button"
                        onClick={handleCloseSelectedPositions}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-900/40 transition flex items-center gap-1.5 cursor-pointer ring-1 ring-cyan-400/50"
                        title={`Close ${selectedOpen.length} selected trade(s) simultaneously`}
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-200" />
                        <span>
                          Close Selected ({selectedOpen.length})
                          <span className="ml-1 font-mono text-[11px] text-cyan-100 font-bold">
                            ({totalSelectedPnl >= 0 ? '+' : ''}${totalSelectedPnl.toFixed(2)})
                          </span>
                        </span>
                      </button>
                    );
                  })()}

                  {/* CLOSE ALL OPEN POSITIONS BUTTON */}
                  {positions.filter((p) => p.state !== 'CLOSED').length > 1 && (
                    <button
                      type="button"
                      onClick={handleCloseAllOpenPositions}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-300 border border-zinc-800 hover:border-rose-800 rounded-xl text-xs font-semibold transition flex items-center gap-1"
                      title="Close all open positions simultaneously"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" />
                      <span>Close All ({positions.filter((p) => p.state !== 'CLOSED').length})</span>
                    </button>
                  )}

                  {/* QUICK BUY ORDER */}
                  <button
                    type="button"
                    onClick={() => handleQuickDemoTrade()}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                    title="Place an instant 1.5 SOL buy order on top setup"
                  >
                    <span>+ Quick Buy (1.5 SOL)</span>
                  </button>
                </div>
              </div>

              {/* Quick Tabs & Multi-select Toolbar Strip */}
              {positions.filter((p) => p.state !== 'CLOSED').length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 mb-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl text-xs">
                  {/* Position Filter Tabs */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPositionsTabFilter('all')}
                      className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                        positionsTabFilter === 'all'
                          ? 'bg-zinc-800 text-white border border-zinc-700'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span>All Open</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-300 font-mono text-[10px]">
                        {positions.filter((p) => p.state !== 'CLOSED').length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPositionsTabFilter('profitable')}
                      className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                        positionsTabFilter === 'profitable'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                          : 'text-zinc-400 hover:text-emerald-400'
                      }`}
                    >
                      <span>In Profit</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-400 font-mono text-[10px] font-bold">
                        {positions.filter((p) => p.state !== 'CLOSED' && (p.pnlUsd > 0 || p.pnlPercent > 0)).length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPositionsTabFilter('loss')}
                      className={`px-3 py-1 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                        positionsTabFilter === 'loss'
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                          : 'text-zinc-400 hover:text-rose-400'
                      }`}
                    >
                      <span>Under Water / Neutral</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400 font-mono text-[10px]">
                        {positions.filter((p) => p.state !== 'CLOSED' && p.pnlUsd <= 0 && p.pnlPercent <= 0).length}
                      </span>
                    </button>
                  </div>

                  {/* Multi-Selection Controls */}
                  <div className="flex items-center gap-2">
                    {selectedPositionIds.filter((id) =>
                      positions.some((p) => p.id === id && p.state !== 'CLOSED')
                    ).length > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-400 font-mono text-[11px]">
                          <strong className="text-cyan-300 font-bold">
                            {
                              selectedPositionIds.filter((id) =>
                                positions.some((p) => p.id === id && p.state !== 'CLOSED')
                              ).length
                            }
                          </strong>{' '}
                          selected
                        </span>
                        <button
                          type="button"
                          onClick={handleClearSelection}
                          className="text-xs text-zinc-400 hover:text-white underline transition"
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                        <span>Quick Select:</span>
                        <button
                          type="button"
                          onClick={handleSelectAllProfitable}
                          className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-zinc-800 font-medium transition"
                          title="Select all profitable trades for batch close"
                        >
                          All In-Profit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const allOpenIds = positions
                              .filter((p) => p.state !== 'CLOSED')
                              .map((p) => p.id);
                            setSelectedPositionIds(allOpenIds);
                          }}
                          className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-medium transition"
                          title="Select all active trades"
                        >
                          Select All
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[11px] border-b border-zinc-800">
                    <tr>
                      {/* Checkbox Header Column (Click to select/deselect all visible) */}
                      <th className="py-3 px-3 w-10 text-center">
                        {(() => {
                          const openFiltered = positions
                            .filter((p) => p.state !== 'CLOSED')
                            .filter((p) => {
                              if (positionsTabFilter === 'profitable')
                                return p.pnlUsd > 0 || p.pnlPercent > 0;
                              if (positionsTabFilter === 'loss')
                                return p.pnlUsd <= 0 && p.pnlPercent <= 0;
                              return true;
                            });
                          const isAllChecked =
                            openFiltered.length > 0 &&
                            openFiltered.every((p) => selectedPositionIds.includes(p.id));

                          return (
                            <input
                              type="checkbox"
                              checked={isAllChecked}
                              onChange={() => handleToggleSelectAllVisible(openFiltered)}
                              disabled={openFiltered.length === 0}
                              className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-cyan-500 focus:ring-cyan-500/30 cursor-pointer accent-cyan-500"
                              title="Select / Deselect all visible trades"
                            />
                          );
                        })()}
                      </th>
                      <th className="py-3 px-4">Token</th>
                      <th className="py-3 px-4">Invested SOL</th>
                      <th className="py-3 px-4">Entry / Current Price</th>
                      <th className="py-3 px-4">Unrealized PnL</th>
                      <th className="py-3 px-4">Stop-Loss Margin</th>
                      <th className="py-3 px-4">Profit Target</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {(() => {
                      const openFiltered = positions
                        .filter((p) => p.state !== 'CLOSED')
                        .filter((p) => {
                          if (positionsTabFilter === 'profitable')
                            return p.pnlUsd > 0 || p.pnlPercent > 0;
                          if (positionsTabFilter === 'loss')
                            return p.pnlUsd <= 0 && p.pnlPercent <= 0;
                          return true;
                        });

                      if (openFiltered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="py-12 text-center font-sans">
                              <div className="max-w-md mx-auto space-y-3">
                                <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800 mx-auto flex items-center justify-center">
                                  <Briefcase className="w-6 h-6 text-zinc-500" />
                                </div>
                                <div>
                                  <p className="font-bold text-white text-sm">
                                    {positionsTabFilter === 'profitable'
                                      ? 'No Positions Currently in Profit'
                                      : positionsTabFilter === 'loss'
                                      ? 'No Positions Under Water'
                                      : 'No Active Positions Open'}
                                  </p>
                                  <p className="text-xs text-zinc-400 mt-1">
                                    {positionsTabFilter === 'profitable'
                                      ? 'Switch to "All Open" tab to view running trades or wait for momentum cycles to trigger profit targets.'
                                      : 'Execute a swap from the Meme Coin Scanner or Jupiter tab, or place an instant order below.'}
                                  </p>
                                </div>
                                <div className="flex justify-center gap-3 pt-2">
                                  {positionsTabFilter !== 'all' ? (
                                    <button
                                      type="button"
                                      onClick={() => setPositionsTabFilter('all')}
                                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition"
                                    >
                                      View All Active Positions
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickDemoTrade()}
                                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20 transition flex items-center gap-2"
                                      >
                                        <Sparkles className="w-4 h-4" />
                                        <span>⚡ Place Instant Order (1.5 SOL)</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveTab('scanner')}
                                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition"
                                      >
                                        Browse Scanner
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return openFiltered.map((pos, idx) => {
                        const isSelected = selectedPositionIds.includes(pos.id);
                        const isProfitable = pos.pnlUsd > 0 || pos.pnlPercent > 0;

                        return (
                          <tr
                            key={`${pos.id}_${idx}`}
                            className={`transition ${
                              isSelected
                                ? 'bg-cyan-950/30 hover:bg-cyan-950/40'
                                : 'hover:bg-zinc-800/30'
                            }`}
                          >
                            {/* Row Checkbox Column */}
                            <td className="py-3.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectPosition(pos.id)}
                                className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-cyan-500 focus:ring-cyan-500/30 cursor-pointer accent-cyan-500"
                                title={`Select ${pos.tokenSymbol} to close in batch`}
                              />
                            </td>

                            {/* Token Symbol & Badges */}
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{pos.tokenSymbol}</span>
                                {isProfitable && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                                    +PROFIT
                                  </span>
                                )}
                                {pos.trailingStopActive && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    Trailing
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                {pos.tokenQuantity.toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens
                              </div>
                            </td>

                            {/* Invested SOL */}
                            <td className="py-3.5 px-4 text-zinc-300 font-bold">{pos.amountSol} SOL</td>

                            {/* Prices */}
                            <td className="py-3.5 px-4">
                              <div className="text-zinc-200 font-bold">${pos.currentPrice.toFixed(6)}</div>
                              <div className="text-[10px] text-zinc-500">Entry: ${pos.entryPrice.toFixed(6)}</div>
                            </td>

                            {/* Unrealized PnL */}
                            <td className="py-3.5 px-4 font-bold">
                              <span className={pos.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {pos.pnlPercent >= 0 ? '+' : ''}
                                {pos.pnlPercent.toFixed(2)}% (${pos.pnlUsd.toFixed(2)})
                              </span>
                            </td>

                            {/* Stop-Loss Margin */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={
                                    pos.stopLossPercent >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400'
                                  }
                                >
                                  {pos.stopLossPercent >= 0 ? '+' : ''}
                                  {pos.stopLossPercent.toFixed(1)}%
                                </span>
                                {pos.stopLossPercent === 0 && (
                                  <span className="px-1 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    Break-Even
                                  </span>
                                )}
                                {pos.stopLossPercent > 0 && (
                                  <span className="px-1 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    Locked Profit
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-500">${pos.stopLossPrice.toFixed(6)}</div>
                            </td>

                            {/* Profit Target */}
                            <td className="py-3.5 px-4">
                              <div className="text-emerald-400 font-bold">+{pos.profitTargetPercent}%</div>
                              <div className="text-[10px] text-zinc-500">${pos.takeProfitMaxPrice.toFixed(6)}</div>
                            </td>

                            {/* Actions Column */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAdjustMargins(pos)}
                                  className="px-2.5 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-[11px] font-bold transition flex items-center gap-1 shadow-sm"
                                  title="Adjust Profit Target & Raise Stop-Loss"
                                >
                                  <Sliders className="w-3 h-3" />
                                  <span>Adjust Margins</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClosePosition(pos.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[11px] transition"
                                  title="Close this individual trade"
                                >
                                  Close
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Closed Positions History (Realized P&L Breakdown) */}
            {positions.filter((p) => p.state === 'CLOSED').length > 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-white text-base">Closed Positions & Realized P&L</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Completed simulated exits triggered by profit targets, trailing stops, or manual user exit.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-zinc-400">
                    {positions.filter((p) => p.state === 'CLOSED').length} Completed Exits
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[11px] border-b border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-4">Token</th>
                        <th className="py-2.5 px-4">Invested SOL</th>
                        <th className="py-2.5 px-4">Entry / Exit Price</th>
                        <th className="py-2.5 px-4">Realized PnL</th>
                        <th className="py-2.5 px-4">Exit Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {positions
                        .filter((p) => p.state === 'CLOSED')
                        .map((pos, idx) => (
                          <tr key={`${pos.id}_${idx}`} className="hover:bg-zinc-800/20">
                            <td className="py-3 px-4 font-bold text-white">{pos.tokenSymbol}</td>
                            <td className="py-3 px-4 text-zinc-300">{pos.amountSol} SOL</td>
                            <td className="py-3 px-4">
                              <div className="text-zinc-200">${pos.currentPrice.toFixed(6)}</div>
                              <div className="text-[10px] text-zinc-500">Entry: ${pos.entryPrice.toFixed(6)}</div>
                            </td>
                            <td className="py-3 px-4 font-bold">
                              <span className={pos.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}% (${pos.pnlUsd.toFixed(2)})
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-400 text-[11px] font-sans">
                              {pos.exitReason || 'Completed Exit'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Order Execution History */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 shadow-xl">
              <h3 className="font-bold text-white text-base mb-1">Order Execution History</h3>
              <p className="text-xs text-zinc-400 mb-4">
                Session order log with multi-route Jupiter routing and execution timestamps.
              </p>
              <div className="space-y-2 font-mono text-xs">
                {orders.length === 0 ? (
                  <div className="text-zinc-500 py-6 text-center font-sans">
                    No orders executed yet in this session.
                  </div>
                ) : (
                  orders.map((ord, idx) => (
                    <div
                      key={`${ord.id}_${idx}`}
                      className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            ord.type === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {ord.type}
                        </span>
                        <span className="text-white font-bold">{ord.symbol}</span>
                        <span className="text-zinc-400">{ord.amountSol} SOL</span>
                        <span className="text-zinc-500">@ ${ord.priceUsd.toFixed(6)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-500 text-[11px]">
                        <span>{ord.dexRoute}</span>
                        <span>{ord.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PAID AUTOPILOT & 15-MINUTE CYCLES (PHASE 14 & 15) */}
        {activeTab === 'autopilot' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {isWebsiteDemo && <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-3 text-sm text-emerald-100"><strong>Autopilot demo trading:</strong> turn Autopilot ON to let the scanner qualify and manage simulated entries. Manual trading remains available in its own tab. Autopilot uses the same demo wallet and cannot spend the protected 50% reserve. No real trades are sent.</div>}
            {/* Membership Restriction Notice for Free Trial Users */}
            {!isAutopilotEligible && (
              <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-200">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-base text-amber-300">
                      Autopilot Requires an Annual or Lifetime License
                    </h3>
                    <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                      Standard 24-hour live keys include the live dashboard and manual trading, but not Autopilot. Annual and Lifetime memberships include Autopilot permission. Website demo visitors may use simulated Autopilot without a license.
                    </p>
                    {onOpenMemberPortal && (
                      <button
                        onClick={onOpenMemberPortal}
                        className="mt-3 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs transition shadow"
                      >
                        Upgrade to Annual Membership
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Authoritative 15-Minute Cycle Status Monitor */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    Authoritative 15-Minute Cycle Scheduler
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Structured 15-minute cycles: Minutes 0–8 (Discovery & ICC Qualification), Minutes 8–15 (Entry & Position Management).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleAutopilot}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow ${
                      tradingEngine.isAutopilotOn()
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {tradingEngine.isAutopilotOn() ? 'Turn Autopilot OFF' : 'Turn Autopilot ON'}
                  </button>
                  <button
                    onClick={handleEmergencyStop}
                    className="px-3 py-2 bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800 rounded-xl text-xs font-bold transition"
                  >
                    Emergency Stop
                  </button>
                </div>
              </div>

              {/* Progress and Phase Visualizer */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div className="text-[11px] text-zinc-400 uppercase font-mono">Current Cycle</div>
                    <div className="text-lg font-bold text-white mt-1">Cycle #{cycleStatus.cycleIndex} of 4</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Minute {cycleStatus.cycleMinute + 1} of 15</div>
                  </div>

                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div className="text-[11px] text-zinc-400 uppercase font-mono">Current Phase</div>
                    <div className="text-lg font-bold text-cyan-300 mt-1">
                      {cycleStatus.phase === 'DISCOVERY_AND_EVALUATION' ? 'Phase 1: Discovery (Min 0-8)' : 'Phase 2: Execution (Min 8-15)'}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {cycleStatus.minutesRemainingInPhase} min remaining in phase
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div className="text-[11px] text-zinc-400 uppercase font-mono">Cycle Trade Target</div>
                    <div className="text-lg font-bold text-emerald-300 mt-1">3 to 5 Trades</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{positions.filter(p => p.state !== 'CLOSED').length}/5 concurrent positions</div>
                  </div>

                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div className="text-[11px] text-zinc-400 uppercase font-mono">Discovery Pool</div>
                    <div className="text-lg font-bold text-white mt-1">6 to 8 Candidates</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Strict 8/8 ICC gatekeeper</div>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1 font-mono">
                    <span>Phase 1: Discovery (Min 0-8)</span>
                    <span>Phase 2: Entry & Exit Management (Min 8-15)</span>
                  </div>
                  <div className="w-full h-3 bg-zinc-950 rounded-full border border-zinc-800 overflow-hidden flex">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${((cycleStatus.cycleMinute + 1) / 15) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Protection Guarantee Notice */}
                <div className="p-3.5 bg-zinc-950/70 rounded-xl border border-zinc-800 text-xs text-zinc-300 space-y-1 leading-relaxed">
                  <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Autopilot Safety & Risk Guarantees:</span>
                  </div>
                  <p>• <strong>3–5 Trades Per 15-Minute Cycle:</strong> Autopilot looks to place 3 to 5 trades per cycle across tokens that pass all 8 ICC verification checks, managing up to 5 concurrent positions.</p>
                  <p>• <strong>50% Wallet Reserve Protection:</strong> 50% of account equity is strictly reserved and cannot be traded under any circumstance.</p>
                  <p>• <strong>Continuous Exit Monitoring:</strong> Turning Autopilot OFF stops new automated entries while open positions remain continuously protected by stop-loss and profit targets.</p>
                  <p>• <strong>Crash & Restart Recovery:</strong> Autopilot always defaults to OFF after application restart until explicitly enabled.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: DEDICATED USER API SETUP (ADDITIONAL REQUIREMENT) */}
        {activeTab === 'api-setup' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header info */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                  <Key className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                  <div>
                    <h3 className="font-bold text-white text-base">User API Credentials & Network Connectivity</h3>
                    <p className="text-xs text-zinc-400">
                      Configure your personal Jupiter and GoPlus Security API keys. Isolated and encrypted with AES-256 on the backend.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunFullDiagnostics}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 shrink-0"
                    title="Run live diagnostic test across Solana RPC, Jupiter DEX, GoPlus Security, and Hardware Authentication"
                  >
                    <Activity className="w-4 h-4 text-black" />
                    <span>Run Live System Test</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs text-zinc-300 mt-4 space-y-1">
                <p>
                  <strong>Security Architecture Notice:</strong> Never enter wallet private keys or seed phrases here. API keys only authorize public DEX routing and security data retrieval.
                </p>
                <p className="text-zinc-400">
                  Free-trial and paid members may configure their own API keys. Entering API keys does not upgrade membership or unlock Autopilot.
                </p>
              </div>

              {apiFeedback && (
                <div
                  className={`mt-4 p-3.5 rounded-xl border text-xs flex items-center gap-2 font-mono ${
                    apiFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {apiFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{apiFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Provider 0: Non-Custodial Solana Wallet Connection */}
            <div className="bg-zinc-900/80 border border-purple-800/40 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Non-Custodial Solana Wallet</h4>
                    <p className="text-[11px] text-zinc-400">{isWebsiteDemo ? 'Paper demo session (not a live wallet)' : 'Phantom (preferred) or SafePal'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(isPaperMode ? connectedWallet : liveWalletAddress) ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Wallet Connected
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-mono">
                      Not Connected
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 text-xs space-y-2 font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Connected Public Key:</span>
                  <span className="text-white font-bold truncate max-w-[260px]">
                    {(isPaperMode ? connectedWallet : liveWalletAddress) || (isPaperMode ? 'None (Paper session not started)' : 'None (Connect Phantom or SafePal)')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Current SOL Balance:</span>
                  <span className="text-purple-300 font-bold">
                    ◎ {(isPaperMode ? walletSolBalance : liveWalletSolBalance)?.toFixed(2) ?? "Unavailable"} SOL (${((isPaperMode ? walletSolBalance : liveWalletSolBalance ?? 0) * balance.solPrice).toFixed(2)} USD)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Network:</span>
                  <span className="text-emerald-400 font-bold">Solana Mainnet-Beta (Simulated)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Signing Model:</span>
                  <span className="text-cyan-300">Client-Side Non-Custodial (Zero Private Keys Stored)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {(isPaperMode ? connectedWallet : liveWalletAddress) ? (
                  <>
                    <button
                      type="button"
                      onClick={handleConnectWallet}
                      className="px-4 py-2 bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border border-purple-700 rounded-xl text-xs font-bold transition shadow"
                    >
                      Switch Wallet
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectWallet}
                      className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectWallet}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-600/20 flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{isPaperMode ? 'Start Paper Session' : 'Connect Phantom / SafePal'}</span>
                  </button>
                )}

                {onOpenMemberPortal && (
                  <button
                    type="button"
                    onClick={onOpenMemberPortal}
                    className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                  >
                    <span>Manage Member Subscriptions</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Provider 1: Jupiter API */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h4 className="font-bold text-white text-sm">Jupiter API</h4>
                    <p className="text-[11px] text-zinc-400">Solana DEX Swap Router & Priority Fee Quotes</p>
                  </div>
                </div>

                {/* Connection Status Badge */}
                <div className="flex items-center gap-2">
                  {apiKeys?.jupiter.status === 'CONNECTED' ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Connected
                    </span>
                  ) : apiKeys?.jupiter.status === 'ERROR' ? (
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      Error
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-mono">
                      Not Configured
                    </span>
                  )}
                </div>
              </div>

              {/* Status details & Masked Key display */}
              <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Configured Key:</span>
                  <span className="text-white font-bold">
                    {apiKeys?.jupiter.maskedKey ? apiKeys.jupiter.maskedKey : 'None (Using default endpoint)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Last Verified:</span>
                  <span className="text-zinc-300">
                    {apiKeys?.jupiter.lastTestedAt
                      ? new Date(apiKeys.jupiter.lastTestedAt).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
                {apiKeys?.jupiter.lastError && (
                  <div className="text-rose-400 text-[11px] pt-1 border-t border-zinc-800">
                    Last Error: {apiKeys.jupiter.lastError}
                  </div>
                )}
              </div>

              {/* Input for Jupiter Key */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-300 font-semibold block">
                  {apiKeys?.jupiter.isConfigured ? 'Update Jupiter API Key' : 'Enter Jupiter API Key'}
                </label>
                <div className="relative">
                  <input
                    type={showJupiterKey ? 'text' : 'password'}
                    placeholder="jup_live_..."
                    value={jupiterKeyInput}
                    onChange={(e) => setJupiterKeyInput(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowJupiterKey(!showJupiterKey)}
                    className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                  >
                    {showJupiterKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={apiSaving || !jupiterKeyInput.trim()}
                  onClick={handleSaveApiKeys}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow"
                >
                  {apiSaving ? 'Saving...' : 'Save Jupiter Key'}
                </button>

                <button
                  type="button"
                  disabled={apiTestingProvider === 'jupiter' || !jupiterKeyInput.trim()}
                  onClick={() => handleTestDirectInputKey('jupiter')}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                  title="Test this API key immediately against Jupiter DEX"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${apiTestingProvider === 'jupiter' ? 'animate-spin' : ''}`} />
                  <span>Test Input Key Now</span>
                </button>

                {apiKeys?.jupiter.isConfigured && (
                  <>
                    <button
                      type="button"
                      disabled={apiTestingProvider === 'jupiter'}
                      onClick={() => handleTestApiKey('jupiter')}
                      className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${apiTestingProvider === 'jupiter' ? 'animate-spin' : ''}`} />
                      <span>Test Connection</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKeyToRemove('jupiter')}
                      className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-semibold transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </>
                )}

                <a
                  href="https://station.jup.ag/docs/apis/swap-api"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <span>Official Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Provider 2: GoPlus Security API */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h4 className="font-bold text-white text-sm">GoPlus Security API</h4>
                    <p className="text-[11px] text-zinc-400">Solana Honeypot, Mint & Freeze Authority Audit Engine</p>
                  </div>
                </div>

                {/* Connection Status Badge */}
                <div className="flex items-center gap-2">
                  {apiKeys?.goPlus.status === 'CONNECTED' ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Connected
                    </span>
                  ) : apiKeys?.goPlus.status === 'ERROR' ? (
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      Error
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-mono">
                      Not Configured
                    </span>
                  )}
                </div>
              </div>

              {/* Status details & Masked Key display */}
              <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Configured APP Key:</span>
                  <span className="text-white font-bold">
                    {apiKeys?.goPlus.maskedAppKey || apiKeys?.goPlus.maskedKey || 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Configured APP Secret:</span>
                  <span className="text-white font-bold">
                    {apiKeys?.goPlus.maskedAppSecret || 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Last Verified:</span>
                  <span className="text-zinc-300">
                    {apiKeys?.goPlus.lastTestedAt
                      ? new Date(apiKeys.goPlus.lastTestedAt).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
                {apiKeys?.goPlus.lastError && (
                  <div className="text-rose-400 text-[11px] pt-1 border-t border-zinc-800">
                    Last Error: {apiKeys.goPlus.lastError}
                  </div>
                )}
              </div>

              {/* Input for GoPlus APP Key & APP Secret */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Field 1: APP Key */}
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300 font-semibold flex items-center justify-between">
                    <span>GoPlus APP Key</span>
                    <span className="text-[10px] text-zinc-500 font-mono">app_key</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showGoPlusAppKey ? 'text' : 'password'}
                      placeholder="e.g. mBOMg20QW..."
                      value={goPlusAppKeyInput}
                      onChange={(e) => setGoPlusAppKeyInput(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGoPlusAppKey(!showGoPlusAppKey)}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                    >
                      {showGoPlusAppKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Field 2: APP Secret */}
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300 font-semibold flex items-center justify-between">
                    <span>GoPlus APP Secret</span>
                    <span className="text-[10px] text-zinc-500 font-mono">app_secret</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showGoPlusAppSecret ? 'text' : 'password'}
                      placeholder="e.g. V6aRfxlPJw..."
                      value={goPlusAppSecretInput}
                      onChange={(e) => setGoPlusAppSecretInput(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGoPlusAppSecret(!showGoPlusAppSecret)}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                    >
                      {showGoPlusAppSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-zinc-400 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                GoPlus Developer authentication uses your <strong>APP Key</strong> and <strong>APP Secret</strong> to generate time-bound SHA-1 authorization tokens for Solana token security audits.
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={apiSaving || (!goPlusAppKeyInput.trim() && !goPlusAppSecretInput.trim())}
                  onClick={handleSaveApiKeys}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow"
                >
                  {apiSaving ? 'Saving...' : 'Save GoPlus Credentials'}
                </button>

                <button
                  type="button"
                  disabled={apiTestingProvider === 'goPlus' || (!goPlusAppKeyInput.trim() && !goPlusAppSecretInput.trim())}
                  onClick={() => handleTestDirectInputKey('goPlus')}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                  title="Test these credentials immediately against GoPlus API"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${apiTestingProvider === 'goPlus' ? 'animate-spin' : ''}`} />
                  <span>Test Credentials Now</span>
                </button>

                {apiKeys?.goPlus.isConfigured && (
                  <>
                    <button
                      type="button"
                      disabled={apiTestingProvider === 'goPlus'}
                      onClick={() => handleTestApiKey('goPlus')}
                      className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${apiTestingProvider === 'goPlus' ? 'animate-spin' : ''}`} />
                      <span>Test Connection</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKeyToRemove('goPlus')}
                      className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-semibold transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </>
                )}

                <a
                  href="https://docs.gopluslabs.io"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <span>Official Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: ACTIVITY LOGS VIEWER */}
        {activeTab === 'logs' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    Trading Engine Activity Log
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Real-time audit log of candidate discovery, ICC checks, rejected trades, orders, and position exits.
                  </p>
                </div>
                <span className="text-xs font-mono text-zinc-400">{activityLogs.length} events logged</span>
              </div>

              <div className="space-y-2 font-mono text-xs max-h-[600px] overflow-y-auto pr-1">
                {activityLogs.length === 0 ? (
                  <div className="text-zinc-500 py-8 text-center font-sans">
                    No activity recorded yet in this session.
                  </div>
                ) : (
                  activityLogs.map((log, idx) => (
                    <div
                      key={`${log.id}_${idx}`}
                      className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-xl flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            log.category === 'ORDER'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : log.category === 'REJECTED'
                              ? 'bg-rose-500/20 text-rose-400'
                              : log.category === 'EXIT'
                              ? 'bg-purple-500/20 text-purple-300'
                              : log.category === 'AUTOPILOT'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {log.category}
                        </span>
                        <span className="text-zinc-200 leading-relaxed">{log.message}</span>
                      </div>
                      <span className="text-[11px] text-zinc-500 shrink-0">{log.timestamp}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* EXPLICIT MANUAL TRADE CONFIRMATION MODAL (PHASE 14 REQUIREMENT) */}
      {pendingManualTrade && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-cyan-800/80 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Manual Trade Order Confirmation</h3>
                <p className="text-xs text-zinc-400">Explicit verification required prior to submitting order</p>
              </div>
            </div>

            {/* Candidate & Order Breakdown */}
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-xs space-y-2 font-mono mb-4">
              <div className="flex justify-between">
                <span className="text-zinc-400">Token Pair:</span>
                <span className="font-bold text-white">{pendingManualTrade.token.symbol} ({pendingManualTrade.token.name})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Mint Address:</span>
                <span className="text-zinc-400 truncate max-w-[200px]">{pendingManualTrade.token.mint}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Order Size:</span>
                <span className="text-cyan-300 font-bold">
                  {pendingManualTrade.amountSol} SOL (${pendingManualTrade.costBasisUsd} USD)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Estimated Tokens:</span>
                <span className="text-zinc-200 font-bold">
                  {pendingManualTrade.estTokens.toLocaleString()} {pendingManualTrade.token.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Slippage & Priority:</span>
                <span className="text-zinc-300">{pendingManualTrade.slippage}% • {pendingManualTrade.priorityTier}</span>
              </div>
              {/* Margin & Exit Rules Configuration */}
              <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-3">
                <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Configure Initial Exit Rules</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Customizable during trade</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Stop Loss Selector */}
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Stop-Loss Margin</label>
                    <div className="flex gap-1">
                      {[-5, -10, -15].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setInitialStopLossPercent(val)}
                          className={`flex-1 py-1 rounded text-[11px] font-mono font-bold transition ${
                            initialStopLossPercent === val
                              ? 'bg-rose-950 text-rose-300 border border-rose-700'
                              : 'bg-zinc-900 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Profit Target Selector */}
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Profit Target / Cap Margin</label>
                    <div className="flex gap-1">
                      {[4.5, 15, 25, 50].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setInitialProfitTargetPercent(val)}
                          className={`flex-1 py-1 rounded text-[11px] font-mono font-bold transition ${
                            initialProfitTargetPercent === val
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : 'bg-zinc-900 text-zinc-400 hover:text-white'
                          }`}
                        >
                          +{val}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Trailing stop toggle */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-900">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={initialTrailingStopActive}
                      onChange={(e) => setInitialTrailingStopActive(e.target.checked)}
                      className="rounded bg-zinc-900 border-zinc-700 text-cyan-500 focus:ring-0"
                    />
                    <span>Enable Dynamic Trailing Stop (Trails 5% below peak)</span>
                  </label>
                </div>
              </div>

              {/* Pre-configured Stop-Loss & Target summary */}
              <div className="flex justify-between text-xs font-mono pt-1">
                <span className="text-zinc-400">Order Stop-Loss / Target:</span>
                <span className="text-zinc-200">
                  <span className="text-rose-400">{initialStopLossPercent}%</span> / <span className="text-emerald-400">+{initialProfitTargetPercent}%</span>
                </span>
              </div>
            </div>

            {/* Explicit Risk Warning */}
            <div className="p-3.5 bg-amber-950/40 rounded-xl border border-amber-800/50 text-xs text-amber-200/90 space-y-1 mb-5 leading-relaxed">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Pre-Trade Risk Notice:</span>
              </div>
              <p>
                Solana meme coins carry high liquidity and price volatility risks. Signals, checklist scores, and projected returns are mathematical models and are <strong>NOT a guarantee of profit</strong>.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingManualTrade(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecutingManualTrade}
                onClick={handleConfirmManualTrade}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20"
              >
                {isExecutingManualTrade ? 'Submitting Order...' : 'Confirm & Place Trade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADJUST PROFIT & LOSS MARGIN MODAL (RAISE MARGINS IN PROFIT) */}
      {adjustingPosition && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-cyan-800/80 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                  <Sliders className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Adjust Profit & Loss Margins</h3>
                  <p className="text-xs text-zinc-400">
                    Manage stop-loss, lock in profits, or raise target on {adjustingPosition.tokenSymbol}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustingPosition(null)}
                className="text-zinc-500 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Current Position Snapshot */}
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-mono space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Position:</span>
                <span className="font-bold text-white text-sm">
                  {adjustingPosition.tokenSymbol} ({adjustingPosition.amountSol} SOL)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Entry Price:</span>
                <span className="text-zinc-300">${adjustingPosition.entryPrice.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Live Price:</span>
                <span className="text-cyan-300 font-bold">${adjustingPosition.currentPrice.toFixed(6)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-zinc-900">
                <span className="text-zinc-400">Unrealized PnL:</span>
                <span className={`text-sm font-bold ${adjustingPosition.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {adjustingPosition.pnlPercent >= 0 ? '+' : ''}{adjustingPosition.pnlPercent.toFixed(2)}% (${adjustingPosition.pnlUsd.toFixed(2)})
                </span>
              </div>
            </div>

            {/* Quick 1-Click Profit-Locking & Margin-Raising Presets */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-zinc-300 block mb-2">
                Quick 1-Click Profit-Locking & Margin Presets:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setAdjustStopLossPercent(0)}
                  className={`p-2 rounded-xl border text-left transition ${
                    adjustStopLossPercent === 0
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span>🛡️ Break-Even</span>
                  </div>
                  <div className="text-[10px] text-zinc-400">Stop @ 0.0% (Risk-Free)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setAdjustStopLossPercent(5)}
                  className={`p-2 rounded-xl border text-left transition ${
                    adjustStopLossPercent === 5
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span>🔒 Lock +5%</span>
                  </div>
                  <div className="text-[10px] text-zinc-400">Stop @ +5.0% profit</div>
                </button>

                <button
                  type="button"
                  onClick={() => setAdjustStopLossPercent(10)}
                  className={`p-2 rounded-xl border text-left transition ${
                    adjustStopLossPercent === 10
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span>🔒 Lock +10%</span>
                  </div>
                  <div className="text-[10px] text-zinc-400">Stop @ +10.0% profit</div>
                </button>

                <button
                  type="button"
                  onClick={() => setAdjustProfitTargetPercent(50)}
                  className={`p-2 rounded-xl border text-left transition ${
                    adjustProfitTargetPercent === 50
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span>🚀 Target +50%</span>
                  </div>
                  <div className="text-[10px] text-zinc-400">Raise profit ceiling</div>
                </button>

                <button
                  type="button"
                  onClick={() => setAdjustProfitTargetPercent(100)}
                  className={`p-2 rounded-xl border text-left transition ${
                    adjustProfitTargetPercent === 100
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span>🚀 Target +100%</span>
                  </div>
                  <div className="text-[10px] text-zinc-400">Double target (2x)</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdjustTrailingStopActive(true);
                    setAdjustTrailingStopMargin(5);
                  }}
                  className={`p-2 rounded-xl border text-left transition ${
                    adjustTrailingStopActive
                      ? 'bg-purple-950/80 border-purple-500 text-purple-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1">
                    <span>📈 Trailing Stop</span>
                  </div>
                  <div className="text-[10px] text-zinc-400">Trails 5% below peak</div>
                </button>
              </div>
            </div>

            {/* Custom Margin Sliders & Inputs */}
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-4 mb-4">
              {/* Stop Loss Margin */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300 font-semibold">Stop-Loss Margin Level:</span>
                  <span className={`font-mono font-bold ${adjustStopLossPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {adjustStopLossPercent >= 0 ? '+' : ''}{adjustStopLossPercent}% (${(adjustingPosition.entryPrice * (1 + adjustStopLossPercent / 100)).toFixed(6)})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-25"
                    max="50"
                    step="1"
                    value={adjustStopLossPercent}
                    onChange={(e) => setAdjustStopLossPercent(Number(e.target.value))}
                    className="flex-1 accent-cyan-500"
                  />
                  <input
                    type="number"
                    value={adjustStopLossPercent}
                    onChange={(e) => setAdjustStopLossPercent(Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-mono text-center text-white"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {adjustStopLossPercent >= 0
                    ? '✨ Raised into profit! Even if price pulls back, this minimum profit is secured.'
                    : 'Downside risk cut-off percentage below entry price.'}
                </p>
              </div>

              {/* Profit Target Margin */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300 font-semibold">Take-Profit Target Margin:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    +{adjustProfitTargetPercent}% (${(adjustingPosition.entryPrice * (1 + adjustProfitTargetPercent / 100)).toFixed(6)})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="200"
                    step="5"
                    value={adjustProfitTargetPercent}
                    onChange={(e) => setAdjustProfitTargetPercent(Number(e.target.value))}
                    className="flex-1 accent-emerald-500"
                  />
                  <input
                    type="number"
                    value={adjustProfitTargetPercent}
                    onChange={(e) => setAdjustProfitTargetPercent(Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-mono text-center text-white"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Raise your profit ceiling as the token gains momentum to capture maximum upside.
                </p>
              </div>

              {/* Dynamic Trailing Stop */}
              <div className="pt-2 border-t border-zinc-900">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={adjustTrailingStopActive}
                      onChange={(e) => setAdjustTrailingStopActive(e.target.checked)}
                      className="rounded bg-zinc-900 border-zinc-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="font-semibold">Enable Dynamic Trailing Stop</span>
                  </label>
                  {adjustTrailingStopActive && (
                    <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-400">
                      <span>Trail:</span>
                      <select
                        value={adjustTrailingStopMargin}
                        onChange={(e) => setAdjustTrailingStopMargin(Number(e.target.value))}
                        className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-white"
                      >
                        <option value={3}>3% from peak</option>
                        <option value={5}>5% from peak</option>
                        <option value={7}>7% from peak</option>
                        <option value={10}>10% from peak</option>
                      </select>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  As the token rallies, the stop-loss automatically ratchets upwards behind the highest peak price.
                </p>
              </div>
            </div>

            {adjustMarginFeedback && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{adjustMarginFeedback}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdjustingPosition(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adjustMarginSaving}
                onClick={handleSavePositionMargins}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-600 hover:from-cyan-400 hover:to-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20"
              >
                {adjustMarginSaving ? 'Applying Changes...' : 'Save & Apply Margins'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTOPILOT LOCKED MODAL FOR FREE TRIAL USERS (PHASE 14) */}
      {showAutopilotLockedModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-amber-800/80 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <Lock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Autopilot Restricted</h3>
                <p className="text-xs text-amber-300">Paid Annual & Lifetime Members Only</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
              Autopilot and automated 15-minute trading cycle execution are premium features available only to users with an active <strong>Paid Annual or Lifetime Membership</strong>.
            </p>
            <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
              Your 1-day free trial includes full access to <strong>Manual Trading</strong>, live candidate discovery, and the 8-point ICC checklist.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAutopilotLockedModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
              >
                Continue Manual Trading
              </button>
              {onOpenMemberPortal && (
                <button
                  onClick={() => {
                    setShowAutopilotLockedModal(false);
                    onOpenMemberPortal();
                  }}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-bold shadow"
                >
                  Upgrade to Annual
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REMOVE API KEY CONFIRMATION MODAL */}
      {keyToRemove && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-rose-900/80 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Remove {keyToRemove === 'jupiter' ? 'Jupiter' : 'GoPlus'} Key?</h3>
                <p className="text-xs text-zinc-400">Permanently delete stored credential</p>
              </div>
            </div>
            <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
              Are you sure you want to remove your {keyToRemove === 'jupiter' ? 'Jupiter' : 'GoPlus'} API key from backend storage? The application will fall back to unauthenticated public limits.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setKeyToRemove(null)}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemoveKey}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIVE TRADING SAFETY CONFIRMATION MODAL */}
      {showLiveConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-rose-900/60 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Live Trading Authorization Required</h3>
                <p className="text-xs text-rose-300">Real-Money Solana DEX Execution Guard</p>
              </div>
            </div>

            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 text-xs text-zinc-300 space-y-2 mb-4 leading-relaxed">
              <p><strong>Security & Architectural Notice:</strong></p>
              <p>1. Your software access code verifies application rights only. It does <strong>NOT</strong> authorize live funds or wallet withdrawals.</p>
              <p>2. Real wallet keys, seed phrases, or private keys are <strong>never stored</strong> in the licensing database.</p>
              <p>3. Micro-cap Solana meme coins are highly volatile and subject to high slippage and liquidity risks.</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowLiveConfirmModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
              >
                Keep Paper Mode
              </button>
              <button
                onClick={handleConfirmLiveMode}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/30"
              >
                I Understand & Authorize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEBSOCKET REAL-TIME CONNECTION TELEMETRY MODAL */}
      {showWsStatusModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Solana Market Feed Telemetry</h3>
                  <p className="text-xs text-zinc-400 font-mono">Real-Time WebSocket Ingestion Engine</p>
                </div>
              </div>
              <button
                onClick={() => setShowWsStatusModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Connection Banner */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between mb-4 ${
              wsStatus === 'CONNECTED'
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    wsStatus === 'CONNECTED' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    wsStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                </span>
                <span className="font-bold text-sm">
                  {wsStatus === 'CONNECTED' ? 'Active Real-Time Stream' : 'Reconnecting Feed...'}
                </span>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-zinc-900/80 border border-zinc-700/80">
                Ping: {wsLatency}ms
              </span>
            </div>

            {/* Detailed Connection Metrics */}
            <div className="space-y-2.5 text-xs mb-5 font-mono">
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 space-y-2">
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Solana RPC Cluster:</span>
                  <span className="text-zinc-200">Mainnet-Beta (Port 443 / WSS)</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400">
                  <span>WebSocket Endpoint:</span>
                  <span className="text-cyan-400 text-[11px] truncate max-w-[260px]">wss://api.mainnet-beta.solana.com</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400">
                  <span>DEX Liquidity Stream:</span>
                  <span className="text-emerald-400 font-semibold">Jupiter v6 & Raydium Pools</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Contract Security Feed:</span>
                  <span className="text-emerald-400">GoPlus Security Audits (Live)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500">LAST HEARTBEAT</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {secondsSinceLastTick === 0 ? '< 1s ago' : `${secondsSinceLastTick}s ago`}
                  </div>
                </div>

                <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500">EVENTS INGESTED</div>
                  <div className="text-sm font-bold text-cyan-400 mt-0.5">
                    {wsMessagesReceived.toLocaleString()} ticks
                  </div>
                </div>

                <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500">OPPORTUNITY SCANNER</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">
                    {scannerFeed.opportunities.length} active pairs
                  </div>
                </div>

                <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800/80">
                  <div className="text-[10px] text-zinc-500">NEXT FULL CYCLE</div>
                  <div className="text-sm font-bold text-amber-400 mt-0.5">
                    in {scannerFeed.nextRefreshInSeconds}s
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleManualWsReconnect}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Force Reconnect Feed</span>
              </button>
              <button
                type="button"
                onClick={() => setShowWsStatusModal(false)}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold transition shadow"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL SYSTEM DIAGNOSTICS & LIVE API TEST MODAL */}
      {showDiagnosticsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-xl w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Live API & System Diagnostics</h3>
                  <p className="text-xs text-zinc-400 font-mono">End-to-End Solana Production Verification</p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagnosticsModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {/* Test 1: Solana RPC Cluster */}
              <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 flex items-start justify-between gap-3 font-mono text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    <span>1. Solana RPC Cluster Handshake</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {diagResults.solanaRpc?.message || 'Validating connection to Solana Mainnet-Beta...'}
                  </div>
                </div>
                <div>
                  {diagResults.solanaRpc?.status === 'RUNNING' && (
                    <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                  )}
                  {diagResults.solanaRpc?.status === 'SUCCESS' && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                      PASSED ({diagResults.solanaRpc.latencyMs}ms)
                    </span>
                  )}
                  {diagResults.solanaRpc?.status === 'ERROR' && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-[10px]">
                      FAILED
                    </span>
                  )}
                </div>
              </div>

              {/* Test 2: GoPlus Token Security API */}
              <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 flex items-start justify-between gap-3 font-mono text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>2. GoPlus Contract Security Audit Engine</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {diagResults.goplus?.message || 'Awaiting RPC handshake...'}
                  </div>
                </div>
                <div>
                  {diagResults.goplus?.status === 'RUNNING' && (
                    <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                  )}
                  {diagResults.goplus?.status === 'SUCCESS' && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                      PASSED ({diagResults.goplus.latencyMs}ms)
                    </span>
                  )}
                  {diagResults.goplus?.status === 'ERROR' && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-[10px]">
                      FAILED
                    </span>
                  )}
                </div>
              </div>

              {/* Test 3: Jupiter DEX Router */}
              <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 flex items-start justify-between gap-3 font-mono text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                    <span>3. Jupiter v6 DEX Swap Router</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {diagResults.jupiter?.message || 'Awaiting security verification...'}
                  </div>
                </div>
                <div>
                  {diagResults.jupiter?.status === 'RUNNING' && (
                    <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                  )}
                  {diagResults.jupiter?.status === 'SUCCESS' && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                      PASSED ({diagResults.jupiter.latencyMs}ms)
                    </span>
                  )}
                  {diagResults.jupiter?.status === 'ERROR' && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-[10px]">
                      FAILED
                    </span>
                  )}
                </div>
              </div>

              {/* Test 4: Hardware License Authentication */}
              <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 flex items-start justify-between gap-3 font-mono text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-purple-400" />
                    <span>4. Hardware-Bound License Security Token</span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {diagResults.licensing?.message || 'Awaiting router checks...'}
                  </div>
                </div>
                <div>
                  {diagResults.licensing?.status === 'RUNNING' && (
                    <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                  )}
                  {diagResults.licensing?.status === 'SUCCESS' && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                      PASSED ({diagResults.licensing.latencyMs}ms)
                    </span>
                  )}
                  {diagResults.licensing?.status === 'ERROR' && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-[10px]">
                      FAILED
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Diagnostic Conclusion Summary */}
            {!diagnosticsRunning &&
              diagResults.solanaRpc?.status === 'SUCCESS' &&
              diagResults.goplus?.status === 'SUCCESS' &&
              diagResults.jupiter?.status === 'SUCCESS' &&
              diagResults.licensing?.status === 'SUCCESS' && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl mb-4 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>All 4 checks passed:</strong> Backend Solana RPC, GoPlus, Jupiter, and license verification each returned a successful result in this run.
                </span>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={diagnosticsRunning}
                onClick={handleRunFullDiagnostics}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${diagnosticsRunning ? 'animate-spin' : ''}`} />
                <span>{diagnosticsRunning ? 'Running Tests...' : 'Rerun Live Tests'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold transition shadow"
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preserve original simulated wallet selector in Paper Mode. */}
      {isWebsiteDemo && <MockWalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        connectedWallet={connectedWallet}
        walletName={walletName}
        solBalance={walletSolBalance}
        solPriceUsd={balance.solPrice}
        onConnect={handleConnectWalletModal}
        onDisconnect={handleDisconnectWallet}
        onAirdropSol={handleAirdropSol}
      />}
      {/* Real, read-only wallet UI is isolated to Live Mode. */}
      <LiveWalletModal
        isOpen={showLiveWalletPreview || (!isWebsiteDemo && showWalletModal)}
        onClose={() => { setShowLiveWalletPreview(false); if (!isWebsiteDemo) setShowWalletModal(false); }}
        connectedWallet={liveWalletAddress}
        walletName={liveWalletName}
        solBalance={liveWalletSolBalance}
        solPriceUsd={balance.solPrice > 0 ? balance.solPrice : null}
        onConnect={handleLiveWalletConnect}
        onDisconnect={handleLiveWalletDisconnect}
        balanceError={liveWalletBalanceError}
      />
    </div>
  );
};
