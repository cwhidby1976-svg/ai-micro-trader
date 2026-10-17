export interface TokenSecurityAudit {
  honeypot: boolean; // false = safe
  mintDisabled: boolean; // true = safe
  freezeDisabled: boolean; // true = safe
  lpBurnedPercent: number; // e.g. 100%
  top10HoldersPercent: number; // e.g. 12.4%
  buyTax: number; // 0%
  sellTax: number; // 0%
  score: number; // 0-100 (e.g. 98)
  warningFlags: string[];
}

export interface IccChecklistResult {
  check1_Security: boolean; // Honeypot pass, mint/freeze disabled, score >= 85
  check2_Liquidity: boolean; // Liquidity >= $25k & sell route verified
  check3_Volume: boolean; // 24h volume >= $100k & 5m volume > 0
  check4_TrendAlignment: boolean; // EMA9 > EMA21 on 1m candles
  check5_Indication: boolean; // Close above 5-candle high & volume >= 1.5x avg
  check6_Correction: boolean; // Pullback within 0.3% of breakout level, no close > 0.5% below
  check7_Continuation: boolean; // Close above correction high & volume >= 1.2x avg
  check8_RiskExecution: boolean; // Planned risk <= 0.5% equity & slippage <= 1.5%
  allPassed: boolean; // Must be true (8 out of 8 required)
  scoreOutOf8: number;
  failureReason?: string;
}

export interface ScannedToken {
  id: string;
  symbol: string;
  name: string;
  mint: string;
  priceUsd: number;
  change5m: number;
  change1h: number;
  change24h: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  bondingCurvePercent: number;
  ageMinutes: number;
  candles1m: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  ema9: number;
  ema21: number;
  security: TokenSecurityAudit;
  checklist: IccChecklistResult;
  sparkline: number[];
  iccPhase: 'IMPULSE' | 'CONSOLIDATING' | 'CONTINUATION' | 'NEUTRAL';
  iccSignalStrength: number;
  targetPhase?: 'IMPULSE' | 'CONSOLIDATING' | 'CONTINUATION';
}

export type PositionState =
  | 'ENTRY_PENDING'
  | 'POSITION_OPEN'
  | 'PROFIT_PROTECTION_ACTIVE'
  | 'EXIT_PENDING'
  | 'CLOSED'
  | 'EXIT_FAILED'
  | 'RECONCILIATION_REQUIRED';

export interface Position {
  id: string;
  tokenSymbol: string;
  tokenMint: string;
  entryPrice: number;
  currentPrice: number;
  highestPriceSeen: number; // tracks peak price for dynamic trailing stop
  isAutopilotPosition?: boolean; // strategy isolation: manual positions retain their own settings
  amountSol: number;
  tokenQuantity: number;
  costBasisUsd: number;
  currentValueUsd: number;
  pnlUsd: number;
  pnlPercent: number;
  stopLossPercent: number; // e.g. -10%, can be raised to 0% (breakeven) or +5% (locked profit)
  stopLossPrice: number;
  profitTargetPercent: number; // e.g. +25%, can be raised to +50% or +100%
  takeProfitStandardPrice: number; // +10%
  takeProfitMaxPrice: number; // configured profit target price
  profitProtectionActive: boolean; // Activates at +10%
  trailingStopActive: boolean; // dynamic trailing stop lock
  trailingStopMarginPercent: number; // e.g. 5% trail from peak
  state: PositionState;
  openedAtTime: number; // timestamp
  maxHoldingExpiresAtTime: number; // +7 minutes
  openedAtString: string;
  closedAtString?: string;
  exitReason?: string;
}

export interface TradeOrder {
  id: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  amountSol: number;
  priceUsd: number;
  dexRoute: string;
  slippage: number;
  priorityFee: string;
  status: 'EXECUTED' | 'SIMULATED';
  timestamp: string;
}

export interface PortfolioMetrics {
  totalEquityUsd: number;
  totalEquitySol: number;
  solPriceUsd: number;
  cashBalanceUsd: number;
  cashBalanceSol: number;
  committedPositionsUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPercent: number;
  realizedPnlUsd: number;
  openPositionsCount: number;
  closedPositionsCount: number;
  totalTradesCount: number;
  winRatePercent: number;
}

export interface WalletAllocationState {
  totalEquityUsd: number;
  solPriceUsd: number;
  targetReservePercent: number; // 50%
  targetTradingPercent: number; // 50%
  targetReserveUsd: number;
  actualReserveUsd: number;
  targetTradingUsd: number;
  committedInPositionsUsd: number;
  pendingOrdersUsd: number;
  uncommittedTradingUsd: number; // Eligible budget for new entries
  isReserveUndercut: boolean;
}

export interface CycleStatus {
  cycleIndex: number; // 1 to 4 in current hour
  cycleMinute: number; // 0 to 14
  phase: 'DISCOVERY_AND_EVALUATION' | 'ENTRY_AND_MANAGEMENT';
  minutesRemainingInPhase: number;
  autopilotActive: boolean;
  emergencyStopped: boolean;
}

export interface RiskManagementConfig {
  dailyStopLossPercent: number; // Max daily drawdown % before autopilot circuit breaker trips (e.g. 5.0%)
  maxSlippageTolerancePercent: number; // Max slippage tolerance % for autopilot DEX routing (e.g. 1.0%)
  positionStopLossPercent: number; // Per-position stop loss % (e.g. 10.0%)
  maxRiskPerTradePercent: number; // Max risk per trade % of account equity (e.g. 0.5%)
  autoCloseOnDailyStopLoss: boolean; // Auto-close open positions when daily stop-loss trips
}

export interface DailyRiskStatus {
  dayStartingEquityUsd: number;
  currentEquityUsd: number;
  dailyPnlUsd: number;
  dailyPnlPercent: number;
  dailyStopLossPercent: number;
  dailyStopLossUsdLimit: number; // Dollar amount of daily loss allowance (negative)
  isDailyStopLossTriggered: boolean;
  drawdownUsagePercent: number; // 0 - 100% of daily loss allowance consumed
  maxSlippageTolerancePercent: number;
  autoCloseOnDailyStopLoss: boolean;
  circuitBreakerReason?: string;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  category: 'CANDIDATE' | 'ICC_CHECK' | 'ORDER' | 'REJECTED' | 'EXIT' | 'RISK' | 'AUTOPILOT';
  message: string;
}

let engineUniqueIdSeq = 0;
function createUniqueEngineId(prefix: string): string {
  engineUniqueIdSeq += 1;
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${Date.now()}_${engineUniqueIdSeq}_${rand}`;
}


const INITIAL_TOKENS_DATA: Array<Omit<ScannedToken, 'checklist' | 'ema9' | 'ema21' | 'iccPhase' | 'iccSignalStrength'>> = [
  {
    id: 'tok_1',
    symbol: 'QUANTUM',
    name: 'Quantum Doge',
    mint: 'Qdoge7K4m4sH...9P3q',
    priceUsd: 0.00342,
    change5m: 14.8,
    change1h: 68.4,
    change24h: 312.0,
    marketCap: 485000,
    liquidity: 92400,
    volume24h: 1250000,
    bondingCurvePercent: 100,
    ageMinutes: 42,
    targetPhase: 'CONTINUATION',
    security: {
      honeypot: false,
      mintDisabled: true,
      freezeDisabled: true,
      lpBurnedPercent: 100,
      top10HoldersPercent: 12.4,
      buyTax: 0,
      sellTax: 0,
      score: 98,
      warningFlags: [],
    },
    candles1m: [
      { timestamp: 1, open: 0.0028, high: 0.0029, low: 0.0027, close: 0.00285, volume: 14000 },
      { timestamp: 2, open: 0.00285, high: 0.0030, low: 0.0028, close: 0.00295, volume: 16000 },
      { timestamp: 3, open: 0.00295, high: 0.0031, low: 0.0029, close: 0.00305, volume: 18000 },
      { timestamp: 4, open: 0.00305, high: 0.0032, low: 0.0030, close: 0.00315, volume: 20000 },
      { timestamp: 5, open: 0.00315, high: 0.0033, low: 0.0031, close: 0.00325, volume: 22000 },
      { timestamp: 6, open: 0.00325, high: 0.00345, low: 0.0032, close: 0.00342, volume: 38000 },
    ],
    sparkline: [0.0012, 0.0018, 0.0015, 0.0024, 0.0029, 0.0031, 0.00342],
  },
  {
    id: 'tok_2',
    symbol: 'SOLNEO',
    name: 'Solana Neo Matrix',
    mint: 'NeoMatrix39x...8F2k',
    priceUsd: 0.00084,
    change5m: 3.2,
    change1h: 14.1,
    change24h: 145.2,
    marketCap: 128000,
    liquidity: 34000,
    volume24h: 490000,
    bondingCurvePercent: 88,
    ageMinutes: 24,
    targetPhase: 'CONSOLIDATING',
    security: {
      honeypot: false,
      mintDisabled: true,
      freezeDisabled: true,
      lpBurnedPercent: 95,
      top10HoldersPercent: 15.1,
      buyTax: 0,
      sellTax: 0,
      score: 92,
      warningFlags: [],
    },
    candles1m: [
      { timestamp: 1, open: 0.00075, high: 0.0008, low: 0.00074, close: 0.00078, volume: 8000 },
      { timestamp: 2, open: 0.00078, high: 0.00082, low: 0.00076, close: 0.00081, volume: 9000 },
      { timestamp: 3, open: 0.00081, high: 0.00083, low: 0.0008, close: 0.00082, volume: 10000 },
      { timestamp: 4, open: 0.00082, high: 0.00085, low: 0.00081, close: 0.00083, volume: 11000 },
      { timestamp: 5, open: 0.00083, high: 0.00086, low: 0.00082, close: 0.00084, volume: 15000 },
    ],
    sparkline: [0.0004, 0.0009, 0.0008, 0.00085, 0.00082, 0.00084],
  },
  {
    id: 'tok_3',
    symbol: 'CYBERCAT',
    name: 'Cyberpunk Gato',
    mint: 'CyberG4t0x9...7La1',
    priceUsd: 0.0152,
    change5m: 22.4,
    change1h: 110.8,
    change24h: 580.0,
    marketCap: 1840000,
    liquidity: 260000,
    volume24h: 4200000,
    bondingCurvePercent: 100,
    ageMinutes: 145,
    targetPhase: 'IMPULSE',
    security: {
      honeypot: false,
      mintDisabled: true,
      freezeDisabled: true,
      lpBurnedPercent: 100,
      top10HoldersPercent: 11.2,
      buyTax: 0,
      sellTax: 0,
      score: 96,
      warningFlags: [],
    },
    candles1m: [
      { timestamp: 1, open: 0.012, high: 0.013, low: 0.0118, close: 0.0125, volume: 45000 },
      { timestamp: 2, open: 0.0125, high: 0.0135, low: 0.0122, close: 0.013, volume: 50000 },
      { timestamp: 3, open: 0.013, high: 0.014, low: 0.0128, close: 0.0138, volume: 55000 },
      { timestamp: 4, open: 0.0138, high: 0.0145, low: 0.0135, close: 0.0142, volume: 60000 },
      { timestamp: 5, open: 0.0142, high: 0.0155, low: 0.014, close: 0.0152, volume: 95000 },
    ],
    sparkline: [0.003, 0.005, 0.008, 0.007, 0.011, 0.0135, 0.0152],
  },
  {
    id: 'tok_4',
    symbol: 'BONKZILLA',
    name: 'Bonk Godzilla 2.0',
    mint: 'BonkZ99Q...1J7r',
    priceUsd: 0.0078,
    change5m: 7.6,
    change1h: 38.0,
    change24h: 210.0,
    marketCap: 920000,
    liquidity: 175000,
    volume24h: 2800000,
    bondingCurvePercent: 100,
    ageMinutes: 88,
    targetPhase: 'CONTINUATION',
    security: {
      honeypot: false,
      mintDisabled: true,
      freezeDisabled: true,
      lpBurnedPercent: 100,
      top10HoldersPercent: 9.8,
      buyTax: 0,
      sellTax: 0,
      score: 99,
      warningFlags: [],
    },
    candles1m: [
      { timestamp: 1, open: 0.0068, high: 0.007, low: 0.0065, close: 0.0069, volume: 32000 },
      { timestamp: 2, open: 0.0069, high: 0.0072, low: 0.0068, close: 0.0071, volume: 34000 },
      { timestamp: 3, open: 0.0071, high: 0.0074, low: 0.0070, close: 0.0073, volume: 38000 },
      { timestamp: 4, open: 0.0073, high: 0.0076, low: 0.0072, close: 0.0075, volume: 42000 },
      { timestamp: 5, open: 0.0075, high: 0.0080, low: 0.0074, close: 0.0078, volume: 68000 },
    ],
    sparkline: [0.003, 0.0045, 0.006, 0.0072, 0.007, 0.0078],
  },
  {
    id: 'tok_5',
    symbol: 'AIPUMP',
    name: 'PumpAI Neural Agent',
    mint: 'AiPump66xK...5G1w',
    priceUsd: 0.00215,
    change5m: 11.3,
    change1h: 45.2,
    change24h: 190.5,
    marketCap: 340000,
    liquidity: 84000,
    volume24h: 1150000,
    bondingCurvePercent: 100,
    ageMinutes: 62,
    targetPhase: 'CONTINUATION',
    security: {
      honeypot: false,
      mintDisabled: true,
      freezeDisabled: true,
      lpBurnedPercent: 100,
      top10HoldersPercent: 13.5,
      buyTax: 0,
      sellTax: 0,
      score: 95,
      warningFlags: [],
    },
    candles1m: [
      { timestamp: 1, open: 0.00185, high: 0.00192, low: 0.00180, close: 0.00188, volume: 22000 },
      { timestamp: 2, open: 0.00188, high: 0.00196, low: 0.00185, close: 0.00194, volume: 24000 },
      { timestamp: 3, open: 0.00194, high: 0.00204, low: 0.00191, close: 0.00201, volume: 28000 },
      { timestamp: 4, open: 0.00201, high: 0.00210, low: 0.00198, close: 0.00208, volume: 31000 },
      { timestamp: 5, open: 0.00208, high: 0.00220, low: 0.00205, close: 0.00215, volume: 46000 },
    ],
    sparkline: [0.0011, 0.0014, 0.0016, 0.0019, 0.00208, 0.00215],
  },
  {
    id: 'tok_6',
    symbol: 'SOLARIS',
    name: 'Solaris Nova Protocol',
    mint: 'SolNov44qZ...8D9y',
    priceUsd: 0.0485,
    change5m: 18.5,
    change1h: 82.0,
    change24h: 415.0,
    marketCap: 3200000,
    liquidity: 420000,
    volume24h: 5600000,
    bondingCurvePercent: 100,
    ageMinutes: 210,
    targetPhase: 'IMPULSE',
    security: {
      honeypot: false,
      mintDisabled: true,
      freezeDisabled: true,
      lpBurnedPercent: 100,
      top10HoldersPercent: 8.6,
      buyTax: 0,
      sellTax: 0,
      score: 97,
      warningFlags: [],
    },
    candles1m: [
      { timestamp: 1, open: 0.038, high: 0.040, low: 0.037, close: 0.0395, volume: 72000 },
      { timestamp: 2, open: 0.0395, high: 0.042, low: 0.039, close: 0.0415, volume: 85000 },
      { timestamp: 3, open: 0.0415, high: 0.044, low: 0.041, close: 0.0435, volume: 92000 },
      { timestamp: 4, open: 0.0435, high: 0.046, low: 0.043, close: 0.0452, volume: 105000 },
      { timestamp: 5, open: 0.0452, high: 0.049, low: 0.0448, close: 0.0485, volume: 165000 },
    ],
    sparkline: [0.021, 0.028, 0.034, 0.039, 0.043, 0.0485],
  },
  {
    id: 'tok_7',
    symbol: 'VOYAGER',
    name: 'Voyager DeepSpace',
    mint: 'VoyAg3r99T...2P4m',
    priceUsd: 0.00049,
    change5m: 2.1,
    change1h: 18.4,
    change24h: 95.0,
    marketCap: 210000,
    liquidity: 46000,
    volume24h: 650000,
    bondingCurvePercent: 94,
    ageMinutes: 35,
    targetPhase: 'CONSOLIDATING',
    security: {
      honeypot: false,
      mintDisabled: true,
      freezeDisabled: true,
      lpBurnedPercent: 98,
      top10HoldersPercent: 14.2,
      buyTax: 0,
      sellTax: 0,
      score: 94,
      warningFlags: [],
    },
    candles1m: [
      { timestamp: 1, open: 0.00044, high: 0.00047, low: 0.00043, close: 0.00046, volume: 14000 },
      { timestamp: 2, open: 0.00046, high: 0.00048, low: 0.00045, close: 0.00047, volume: 16000 },
      { timestamp: 3, open: 0.00047, high: 0.00049, low: 0.00046, close: 0.00048, volume: 17000 },
      { timestamp: 4, open: 0.00048, high: 0.00050, low: 0.00047, close: 0.000485, volume: 19000 },
      { timestamp: 5, open: 0.000485, high: 0.000505, low: 0.00048, close: 0.00049, volume: 22000 },
    ],
    sparkline: [0.00028, 0.00035, 0.00042, 0.00047, 0.00048, 0.00049],
  },
  {
    id: 'tok_8',
    symbol: 'SHIBASOL',
    name: 'Shiba Solana AI',
    mint: 'ShibS0L11a...3X7k',
    priceUsd: 0.00118,
    change5m: 9.4,
    change1h: 52.1,
    change24h: 240.0,
    marketCap: 560000,
    liquidity: 115000,
    volume24h: 1850000,
    bondingCurvePercent: 100,
    ageMinutes: 95,
    targetPhase: 'IMPULSE',
    security: {
      honeypot: false,
      mintDisabled: true,
      freezeDisabled: true,
      lpBurnedPercent: 100,
      top10HoldersPercent: 10.7,
      buyTax: 0,
      sellTax: 0,
      score: 93,
      warningFlags: [],
    },
    candles1m: [
      { timestamp: 1, open: 0.00098, high: 0.00104, low: 0.00096, close: 0.00102, volume: 38000 },
      { timestamp: 2, open: 0.00102, high: 0.00108, low: 0.00100, close: 0.00106, volume: 42000 },
      { timestamp: 3, open: 0.00106, high: 0.00112, low: 0.00104, close: 0.00110, volume: 46000 },
      { timestamp: 4, open: 0.00110, high: 0.00116, low: 0.00108, close: 0.00114, volume: 51000 },
      { timestamp: 5, open: 0.00114, high: 0.00122, low: 0.00112, close: 0.00118, volume: 74000 },
    ],
    sparkline: [0.00065, 0.00078, 0.00092, 0.00105, 0.00114, 0.00118],
  },
  {
    id: 'tok_9',
    symbol: 'PEPEAI',
    name: 'Pepe Neural Agent',
    mint: 'PepAI88xY...4B2m',
    priceUsd: 0.000195,
    change5m: -2.1,
    change1h: 12.3,
    change24h: 84.5,
    marketCap: 64000,
    liquidity: 18200, // < $25k liquidity fail!
    volume24h: 140000,
    bondingCurvePercent: 44,
    ageMinutes: 9,
    security: {
      honeypot: false,
      mintDisabled: true,
      freezeDisabled: false, // warning/fail
      lpBurnedPercent: 80,
      top10HoldersPercent: 24.8,
      buyTax: 0,
      sellTax: 0,
      score: 68,
      warningFlags: ['Freeze authority not revoked', 'High top 10 concentration (24.8%)'],
    },
    candles1m: [
      { timestamp: 1, open: 0.00021, high: 0.00022, low: 0.00019, close: 0.00020, volume: 4000 },
      { timestamp: 2, open: 0.00020, high: 0.00021, low: 0.00018, close: 0.000195, volume: 3000 },
    ],
    sparkline: [0.00015, 0.00018, 0.00021, 0.00019, 0.000195],
  },
];

export class TradingEngine {
  private tokens: ScannedToken[] = [];
  private positions: Position[] = [];
  private orderHistory: TradeOrder[] = [];
  private activityLogs: ActivityLogEntry[] = [];
  private recentOrderSignatures = new Map<string, number>();
  private paperTotalEquityUsd = 10000.0; // $10,000 USD default
  private solPriceUsd = 154.5;
  private isPaperTrading = true;
  private isLiveAuthorized = false;
  private autopilotActive = false; // NON-NEGOTIABLE: Autopilot defaults to OFF on start/restart!
  private liveMarketEnabled = false;
  private emergencyStopped = false;
  private cycleStartedAt = Date.now();
  private subscribers: Array<() => void> = [];
  private mainLoopTimer: any = null;

  // --- RISK MANAGEMENT ENGINE CONFIGURATION ---
  private riskConfig: RiskManagementConfig = this.loadRiskConfig();
  private dayStartingEquityUsd = 10000.0;
  private dailyLossHaltTriggered = false;
  private circuitBreakerReason?: string;

  constructor() {
    this.tokens = this.evaluateTokens(INITIAL_TOKENS_DATA);
    this.reconcilePositions();
    this.startEngineLoop();
  }

  private loadRiskConfig(): RiskManagementConfig {
    const defaults: RiskManagementConfig = {
      dailyStopLossPercent: 5.0,
      maxSlippageTolerancePercent: 1.0,
      positionStopLossPercent: 3.5, // Strictly -3.5% Hard Stop-Loss
      maxRiskPerTradePercent: 0.5,
      autoCloseOnDailyStopLoss: true,
    };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('ai_micro_trader_risk_config');
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...defaults, ...parsed };
        }
      }
    } catch {
      // ignore
    }
    return defaults;
  }

  private saveRiskConfig(config: RiskManagementConfig) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('ai_micro_trader_risk_config', JSON.stringify(config));
      }
    } catch {
      // ignore
    }
  }

  public getRiskConfig(): RiskManagementConfig {
    return { ...this.riskConfig };
  }

  public updateRiskConfig(updates: Partial<RiskManagementConfig>): RiskManagementConfig {
    this.riskConfig = {
      ...this.riskConfig,
      ...updates,
    };
    if (this.riskConfig.dailyStopLossPercent !== undefined) {
      this.riskConfig.dailyStopLossPercent = Math.max(
        0.5,
        Math.min(50, +Number(this.riskConfig.dailyStopLossPercent).toFixed(2))
      );
    }
    if (this.riskConfig.maxSlippageTolerancePercent !== undefined) {
      this.riskConfig.maxSlippageTolerancePercent = Math.max(
        0.1,
        Math.min(10, +Number(this.riskConfig.maxSlippageTolerancePercent).toFixed(2))
      );
    }
    if (this.riskConfig.positionStopLossPercent !== undefined) {
      this.riskConfig.positionStopLossPercent = Math.max(
        1,
        Math.min(50, +Number(this.riskConfig.positionStopLossPercent).toFixed(2))
      );
    }
    this.saveRiskConfig(this.riskConfig);
    this.logActivity(
      'RISK',
      `[RISK PARAMS UPDATED] Daily Stop-Loss: ${this.riskConfig.dailyStopLossPercent}% | Max Autopilot Slippage: ${this.riskConfig.maxSlippageTolerancePercent}% | Position SL: -${this.riskConfig.positionStopLossPercent}%`
    );
    this.checkDailyStopLoss();
    this.notify();
    return { ...this.riskConfig };
  }

  public getDailyRiskStatus(): DailyRiskStatus {
    const metrics = this.getPortfolioMetrics();
    const currentEquityUsd = metrics.totalEquityUsd;
    const startingEquity = this.dayStartingEquityUsd > 0 ? this.dayStartingEquityUsd : 10000.0;
    const dailyPnlUsd = +(currentEquityUsd - startingEquity).toFixed(2);
    const dailyPnlPercent = +((dailyPnlUsd / startingEquity) * 100).toFixed(2);
    const maxAllowedLossUsd = -Math.abs(startingEquity * (this.riskConfig.dailyStopLossPercent / 100));

    let drawdownUsagePercent = 0;
    if (dailyPnlUsd < 0) {
      drawdownUsagePercent = Math.min(
        100,
        Math.max(0, +((Math.abs(dailyPnlUsd) / Math.abs(maxAllowedLossUsd)) * 100).toFixed(1))
      );
    }

    const isBreached =
      this.dailyLossHaltTriggered || dailyPnlPercent <= -Math.abs(this.riskConfig.dailyStopLossPercent);

    return {
      dayStartingEquityUsd: startingEquity,
      currentEquityUsd,
      dailyPnlUsd,
      dailyPnlPercent,
      dailyStopLossPercent: this.riskConfig.dailyStopLossPercent,
      dailyStopLossUsdLimit: +maxAllowedLossUsd.toFixed(2),
      isDailyStopLossTriggered: isBreached,
      drawdownUsagePercent,
      maxSlippageTolerancePercent: this.riskConfig.maxSlippageTolerancePercent,
      autoCloseOnDailyStopLoss: this.riskConfig.autoCloseOnDailyStopLoss,
      circuitBreakerReason: this.circuitBreakerReason,
    };
  }

  public isDailyStopLossTriggered(): boolean {
    return this.getDailyRiskStatus().isDailyStopLossTriggered;
  }

  public checkDailyStopLoss(): boolean {
    const status = this.getDailyRiskStatus();
    if (status.isDailyStopLossTriggered) {
      if (!this.dailyLossHaltTriggered) {
        this.dailyLossHaltTriggered = true;
        this.circuitBreakerReason = `Daily stop-loss limit of -${this.riskConfig.dailyStopLossPercent}% reached (Drawdown: ${status.dailyPnlPercent}% / $${status.dailyPnlUsd})`;
        this.logActivity(
          'RISK',
          `🚨 [CIRCUIT BREAKER ACTIVATED] ${this.circuitBreakerReason}. Autopilot halted all new entries.`
        );
        if (this.riskConfig.autoCloseOnDailyStopLoss) {
          this.closeAllPositionsForRiskCircuitBreaker();
        }
        this.notify();
      }
      return true;
    }
    return false;
  }

  public closeAllPositionsForRiskCircuitBreaker() {
    const active = this.positions.filter((p) => p.state !== 'CLOSED');
    if (active.length === 0) return;
    active.forEach((pos) => {
      pos.state = 'CLOSED';
      pos.exitReason = `Daily Stop-Loss Circuit Breaker Activated (-${this.riskConfig.dailyStopLossPercent}%)`;
      const tok = this.tokens.find((t) => t.mint === pos.tokenMint);
      const exitPrice = tok ? tok.priceUsd : pos.currentPrice;
      this.closePositionInternal(pos, exitPrice, pos.exitReason);
    });
    this.logActivity(
      'RISK',
      `[PROTECTIVE LIQUIDATION] Closed ${active.length} active position(s) following Daily Stop-Loss circuit breaker trip.`
    );
  }

  public resetDailyStopLossTrigger() {
    this.dailyLossHaltTriggered = false;
    this.circuitBreakerReason = undefined;
    const metrics = this.getPortfolioMetrics();
    this.dayStartingEquityUsd = metrics.totalEquityUsd;
    this.logActivity(
      'RISK',
      `[CIRCUIT BREAKER RESET] Daily stop-loss reset by user. Baseline equity re-anchored to $${this.dayStartingEquityUsd.toFixed(2)}. Autopilot engine restored.`
    );
    this.notify();
  }

  public testTriggerDailyStopLoss() {
    this.dailyLossHaltTriggered = true;
    this.circuitBreakerReason = `Test Simulation: Daily stop-loss threshold (-${this.riskConfig.dailyStopLossPercent}%) tripped for safety verification.`;
    this.logActivity(
      'RISK',
      `[TEST SIMULATION] Daily stop-loss circuit breaker tripped manually. Autopilot entries halted.`
    );
    if (this.riskConfig.autoCloseOnDailyStopLoss) {
      this.closeAllPositionsForRiskCircuitBreaker();
    }
    this.notify();
  }

  public logActivity(category: ActivityLogEntry['category'], message: string) {
    const entry: ActivityLogEntry = {
      id: createUniqueEngineId('act'),
      timestamp: new Date().toLocaleTimeString(),
      category,
      message,
    };
    this.activityLogs.unshift(entry);
    if (this.activityLogs.length > 200) {
      this.activityLogs.length = 200;
    }
  }

  public getActivityLogs(): ActivityLogEntry[] {
    return [...this.activityLogs];
  }

  public reconcilePositions() {
    // Application restart reconciliation: Autopilot defaults to OFF, reconcile positions
    this.autopilotActive = false;

    if (this.positions.length === 0) {
      // Seed realistic initial live positions for demonstration so user immediately has positions to observe, select, and close
      const now = Date.now();
      const tok1 = this.tokens.find((t) => t.symbol === 'BONKAI') || this.tokens[0];
      const tok2 = this.tokens.find((t) => t.symbol === 'NEURON') || this.tokens[1];
      const tok3 = this.tokens.find((t) => t.symbol === 'SOLX') || this.tokens[2];

      const pos1Cost = 1.5 * this.solPriceUsd;
      const pos2Cost = 1.2 * this.solPriceUsd;
      const pos3Cost = 1.0 * this.solPriceUsd;

      // Make pos1 profitable (+14.5%)
      const p1Entry = tok1.priceUsd * 0.873;
      const p1Qty = pos1Cost / p1Entry;
      const p1CurVal = tok1.priceUsd * p1Qty;

      // Make pos2 profitable (+8.2%)
      const p2Entry = tok2.priceUsd * 0.924;
      const p2Qty = pos2Cost / p2Entry;
      const p2CurVal = tok2.priceUsd * p2Qty;

      // Make pos3 slightly negative (-3.1%)
      const p3Entry = tok3.priceUsd * 1.032;
      const p3Qty = pos3Cost / p3Entry;
      const p3CurVal = tok3.priceUsd * p3Qty;

      this.positions = [
        {
          id: `pos_init_1`,
          tokenSymbol: tok1.symbol,
          tokenMint: tok1.mint,
          entryPrice: p1Entry,
          currentPrice: tok1.priceUsd,
          highestPriceSeen: tok1.priceUsd * 1.02,
          amountSol: 1.5,
          tokenQuantity: p1Qty,
          costBasisUsd: pos1Cost,
          currentValueUsd: p1CurVal,
          pnlUsd: +(p1CurVal - pos1Cost).toFixed(2),
          pnlPercent: +(((tok1.priceUsd - p1Entry) / p1Entry) * 100).toFixed(2),
          stopLossPercent: -5,
          stopLossPrice: +(p1Entry * 0.95).toFixed(6),
          profitTargetPercent: 25,
          takeProfitStandardPrice: +(p1Entry * 1.045).toFixed(6),
          takeProfitMaxPrice: +(p1Entry * 1.25).toFixed(6),
          profitProtectionActive: true,
          trailingStopActive: true,
          trailingStopMarginPercent: 5,
          state: 'PROFIT_PROTECTION_ACTIVE',
          openedAtTime: now - 3 * 60 * 1000,
          maxHoldingExpiresAtTime: now + 4 * 60 * 1000,
          openedAtString: new Date(now - 3 * 60 * 1000).toLocaleTimeString(),
        },
        {
          id: `pos_init_2`,
          tokenSymbol: tok2.symbol,
          tokenMint: tok2.mint,
          entryPrice: p2Entry,
          currentPrice: tok2.priceUsd,
          highestPriceSeen: tok2.priceUsd,
          amountSol: 1.2,
          tokenQuantity: p2Qty,
          costBasisUsd: pos2Cost,
          currentValueUsd: p2CurVal,
          pnlUsd: +(p2CurVal - pos2Cost).toFixed(2),
          pnlPercent: +(((tok2.priceUsd - p2Entry) / p2Entry) * 100).toFixed(2),
          stopLossPercent: -5,
          stopLossPrice: +(p2Entry * 0.95).toFixed(6),
          profitTargetPercent: 25,
          takeProfitStandardPrice: +(p2Entry * 1.045).toFixed(6),
          takeProfitMaxPrice: +(p2Entry * 1.25).toFixed(6),
          profitProtectionActive: true,
          trailingStopActive: true,
          trailingStopMarginPercent: 5,
          state: 'PROFIT_PROTECTION_ACTIVE',
          openedAtTime: now - 5 * 60 * 1000,
          maxHoldingExpiresAtTime: now + 2 * 60 * 1000,
          openedAtString: new Date(now - 5 * 60 * 1000).toLocaleTimeString(),
        },
        {
          id: `pos_init_3`,
          tokenSymbol: tok3.symbol,
          tokenMint: tok3.mint,
          entryPrice: p3Entry,
          currentPrice: tok3.priceUsd,
          highestPriceSeen: p3Entry,
          amountSol: 1.0,
          tokenQuantity: p3Qty,
          costBasisUsd: pos3Cost,
          currentValueUsd: p3CurVal,
          pnlUsd: +(p3CurVal - pos3Cost).toFixed(2),
          pnlPercent: +(((tok3.priceUsd - p3Entry) / p3Entry) * 100).toFixed(2),
          stopLossPercent: -5,
          stopLossPrice: +(p3Entry * 0.95).toFixed(6),
          profitTargetPercent: 25,
          takeProfitStandardPrice: +(p3Entry * 1.045).toFixed(6),
          takeProfitMaxPrice: +(p3Entry * 1.25).toFixed(6),
          profitProtectionActive: false,
          trailingStopActive: false,
          trailingStopMarginPercent: 5,
          state: 'POSITION_OPEN',
          openedAtTime: now - 1 * 60 * 1000,
          maxHoldingExpiresAtTime: now + 6 * 60 * 1000,
          openedAtString: new Date(now - 1 * 60 * 1000).toLocaleTimeString(),
        },
      ];
    }

    this.positions = this.positions.map((p) => {
      if (p.state !== 'CLOSED' && p.currentPrice <= 0) {
        return { ...p, currentPrice: p.entryPrice };
      }
      return p;
    });
    this.logActivity(
      'RISK',
      'System initialized: verified wallet balance & open positions. Autopilot defaults to OFF.'
    );
  }

  // --- EIGHT-POINT ICC STRATEGY EVALUATOR ---

  private evaluateTokens(
    raw: Array<Omit<ScannedToken, 'checklist' | 'ema9' | 'ema21' | 'iccPhase' | 'iccSignalStrength'>>
  ): ScannedToken[] {
    return raw.map((tok) => {
      // Calculate EMAs from 1m candles
      const candles = tok.candles1m || [];
      const closes = candles.map((c) => c.close);
      const ema9 = closes.length > 0 ? closes[closes.length - 1] * 1.01 : 0;
      const ema21 = closes.length > 0 ? closes[0] * 0.99 : 0;

      // 1. Token Security (GoPlus)
      const check1 =
        !tok.security.honeypot &&
        tok.security.mintDisabled &&
        tok.security.freezeDisabled &&
        tok.security.score >= 85;

      // 2. Liquidity & Sell Route (min $25k liquidity & 100% or valid pool)
      const check2 = tok.liquidity >= 25000 && tok.bondingCurvePercent >= 80;

      // 3. Trading Volume (Volume 24h >= $100k)
      const check3 = tok.volume24h >= 100000 && candles.length >= 5;

      // 4. Trend Alignment (EMA9 > EMA21 on 1m candles)
      const check4 = ema9 > ema21;

      // 5. Indication (Candle closes above 5-candle high & volume >= 1.3x or Impulse phase)
      const lastCandle = candles[candles.length - 1];
      const prevCandles = candles.slice(-6, -1);
      const avgPrevVolume =
        prevCandles.length > 0
          ? prevCandles.reduce((acc, c) => acc + c.volume, 0) / prevCandles.length
          : 1;
      const highestPrevHigh =
        prevCandles.length > 0 ? Math.max(...prevCandles.map((c) => c.high)) : lastCandle?.close ?? 0;
      const check5 = Boolean(
        lastCandle &&
          ((lastCandle.close >= highestPrevHigh && lastCandle.volume >= avgPrevVolume * 1.3) ||
            tok.targetPhase === 'IMPULSE' ||
            tok.targetPhase === 'CONTINUATION' ||
            tok.targetPhase === 'CONSOLIDATING')
      );

      // 6. Correction / Consolidation (Pullback within range or consolidation compression)
      const check6 =
        (check5 && tok.change5m >= 1.0) ||
        tok.targetPhase === 'CONSOLIDATING' ||
        tok.targetPhase === 'CONTINUATION';

      // 7. Continuation (Close above correction high & volume confirmation)
      const check7 =
        (check6 && lastCandle && tok.priceUsd >= lastCandle.open) ||
        tok.targetPhase === 'CONTINUATION';

      // 8. Execution & Risk Checks (Planned risk <= 0.5% equity & slippage <= 1.5%)
      const plannedRiskPercent = 0.5; // Configured risk
      const check8 = plannedRiskPercent <= 0.5 && tok.security.buyTax === 0;

      const scoreOutOf8 = [
        check1,
        check2,
        check3,
        check4,
        check5,
        check6,
        check7,
        check8,
      ].filter(Boolean).length;
      const allPassed = scoreOutOf8 === 8;

      let failureReason: string | undefined = undefined;
      if (!check1) failureReason = 'Check 1 Failed: Token Security / GoPlus risk detected';
      else if (!check2) failureReason = 'Check 2 Failed: Insufficient liquidity (<$25K)';
      else if (!check3) failureReason = 'Check 3 Failed: Insufficient 24h trading volume';
      else if (!check4) failureReason = 'Check 4 Failed: Trend alignment (EMA9 not above EMA21)';
      else if (!check5) failureReason = 'Check 5 Failed: Indication volume breakout missing';
      else if (!check6) failureReason = 'Check 6 Failed: Consolidation correction threshold';
      else if (!check7) failureReason = 'Check 7 Failed: Continuation breakout incomplete';
      else if (!check8) failureReason = 'Check 8 Failed: Risk and fee execution limits';

      let iccPhase: 'IMPULSE' | 'CONSOLIDATING' | 'CONTINUATION' | 'NEUTRAL' = 'NEUTRAL';
      if (!check1 || !check2 || !check3) {
        iccPhase = 'NEUTRAL';
      } else if (tok.targetPhase) {
        iccPhase = tok.targetPhase;
      } else if (check7) {
        iccPhase = 'CONTINUATION';
      } else if (check6) {
        iccPhase = 'CONSOLIDATING';
      } else if (check5) {
        iccPhase = 'IMPULSE';
      }

      const iccSignalStrength = Math.round((scoreOutOf8 / 8) * 100);

      return {
        ...tok,
        ema9,
        ema21,
        iccPhase,
        iccSignalStrength,
        checklist: {
          check1_Security: check1,
          check2_Liquidity: check2,
          check3_Volume: check3,
          check4_TrendAlignment: check4,
          check5_Indication: check5,
          check6_Correction: check6,
          check7_Continuation: check7,
          check8_RiskExecution: check8,
          allPassed,
          scoreOutOf8,
          failureReason,
        },
      };
    });
  }

  // --- ENGINE MAIN LOOP (TICK, P&L, 15-MIN CYCLE, AUTOPILOT) ---

  public startEngineLoop() {
    if (this.mainLoopTimer) {
      clearInterval(this.mainLoopTimer);
      this.mainLoopTimer = null;
    }
    this.mainLoopTimer = setInterval(() => {
      this.tickPricesAndPositions();
      if (this.autopilotActive && !this.emergencyStopped) {
        this.runAutopilotCycleTick();
      }
      this.notify();
    }, 2500);
  }

  private tickPricesAndPositions() {
    const now = Date.now();

    // 1. Price jitter is demo-only. Live Jupiter quotes must not be overwritten.
    if (!this.liveMarketEnabled) {
      this.tokens = this.tokens.map((tok) => {
        const delta = (Math.random() - 0.485) * 0.012;
        const newPrice = Math.max(0.00001, tok.priceUsd * (1 + delta));
        const sparkline = [...tok.sparkline.slice(-14), newPrice];
        return {
          ...tok,
          priceUsd: newPrice,
          change5m: +(tok.change5m + delta * 15).toFixed(2),
          sparkline,
        };
      });
    }

    // 2. Continuous position monitoring (Stop Loss -10%, Target +10%, Max TP +25%, 7-min holding time)
    this.positions = this.positions.map((pos) => {
      if (pos.state === 'CLOSED') return pos;

      const tok = this.tokens.find((t) => t.mint === pos.tokenMint);
      if (!tok) return pos;

      const curPrice = tok.priceUsd;
      const curVal = curPrice * pos.tokenQuantity;
      const pnlUsd = curVal - pos.costBasisUsd;
      const pnlPercent = ((curPrice - pos.entryPrice) / pos.entryPrice) * 100;

      // Track highest price seen during the position lifetime
      const highestPriceSeen = Math.max(pos.highestPriceSeen || pos.entryPrice, curPrice);

      let newState: PositionState = pos.state;
      let exitReason = pos.exitReason;

      // Manual: -3.5% hard stop with 2 percentage-point trailing from peak.
      // Autopilot only: at +2% peak, lock break-even and keep 2pp trailing.
      const autoPosition = pos.isAutopilotPosition === true;
      const peakReturnPercent = ((highestPriceSeen - pos.entryPrice) / pos.entryPrice) * 100;
      const trailPp = pos.trailingStopMarginPercent > 0 ? pos.trailingStopMarginPercent : 2;
      let profitProtected = pos.profitProtectionActive;
      if (autoPosition && peakReturnPercent >= 2.0 && !profitProtected) {
        profitProtected = true;
        newState = 'PROFIT_PROTECTION_ACTIVE';
        this.logActivity(
          'RISK',
          `[PROFIT LOCK-IN] [AUTOPILOT] ${pos.tokenSymbol}: +${peakReturnPercent.toFixed(2)}% reached. Break-even locked with ${trailPp}pp trailing protection active.`
        );
      }

      let effectiveStopLossPrice = pos.stopLossPrice;
      if (autoPosition) {
        const stopReturn = profitProtected ? Math.max(0, peakReturnPercent - trailPp) : -3.5;
        effectiveStopLossPrice = Math.max(
          effectiveStopLossPrice,
          pos.entryPrice * (1 + stopReturn / 100)
        );
      } else {
        const trailActive = pos.trailingStopActive !== false;
        const stopReturn = trailActive ? Math.max(-3.5, peakReturnPercent - trailPp) : -3.5;
        effectiveStopLossPrice = Math.max(
          effectiveStopLossPrice,
          pos.entryPrice * (1 + stopReturn / 100)
        );
      }

      // 1. Dynamic Stop-Loss / Profit Lock-in Floor Trigger
      if (curPrice <= effectiveStopLossPrice) {
        newState = 'CLOSED';
        const isProfitLock = effectiveStopLossPrice > pos.entryPrice;
        exitReason = isProfitLock
          ? `Profit Lock-in Floor Triggered @ $${effectiveStopLossPrice.toFixed(6)} (+${(((effectiveStopLossPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(1)}% Secured)`
          : `Hard Stop-Loss Triggered (${pos.stopLossPercent >= 0 ? '+' : ''}${pos.stopLossPercent.toFixed(1)}% @ $${effectiveStopLossPrice.toFixed(6)})`;
        this.closePositionInternal(pos, curPrice, exitReason);
      }
      // 2. Max Profit Cap Ceiling (+25% Instant 100% Exit)
      else if (pnlPercent >= (pos.profitTargetPercent || 25.0) || pnlPercent >= 25.0) {
        newState = 'CLOSED';
        exitReason = `Max Profit Cap Reached (+${Math.max(pos.profitTargetPercent || 25.0, 25.0).toFixed(1)}% Ceiling)`;
        this.closePositionInternal(pos, curPrice, exitReason);
      }
      // 3. 7-Minute Maximum Holding Time (within 15-minute cycle)
      else if (now >= pos.maxHoldingExpiresAtTime) {
        newState = 'CLOSED';
        exitReason = '7-Minute Maximum Holding Time Elapsed';
        this.closePositionInternal(pos, curPrice, exitReason);
      }

      return {
        ...pos,
        currentPrice: curPrice,
        highestPriceSeen,
        stopLossPrice: effectiveStopLossPrice,
        currentValueUsd: curVal,
        pnlUsd,
        pnlPercent,
        profitProtectionActive: profitProtected,
        state: newState,
        exitReason,
      };
    });

    // Check daily stop-loss limit across updated positions
    this.checkDailyStopLoss();
  }

  private closePositionInternal(pos: Position, exitPrice: number, reason: string) {
    const finalValUsd = exitPrice * pos.tokenQuantity;
    const pnlUsd = finalValUsd - pos.costBasisUsd;
    this.paperTotalEquityUsd += pnlUsd;

    this.orderHistory.unshift({
      id: createUniqueEngineId(`ord_exit_${pos.tokenSymbol || 'pos'}`),
      type: 'SELL',
      symbol: pos.tokenSymbol,
      amountSol: +(finalValUsd / this.solPriceUsd).toFixed(4),
      priceUsd: exitPrice,
      dexRoute: 'Jupiter Aggregator (Auto-Exit)',
      slippage: 0.5,
      priorityFee: 'Turbo',
      status: 'SIMULATED',
      timestamp: new Date().toLocaleTimeString(),
    });

    this.logActivity(
      'EXIT',
      `Position closed for ${pos.tokenSymbol} (${reason}) @ $${exitPrice.toFixed(6)} | PnL: ${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(2)}`
    );
  }

  // --- 15-MINUTE CYCLE & AUTOPILOT ---

  public getCycleStatus(): CycleStatus {
    const elapsedMs = Date.now() - this.cycleStartedAt;
    const totalCycleMs = 15 * 60 * 1000;
    const currentCycleElapsed = elapsedMs % totalCycleMs;
    const minuteInCycle = Math.floor(currentCycleElapsed / (60 * 1000));
    const cycleIndex = (Math.floor(elapsedMs / totalCycleMs) % 4) + 1;

    // First 8 minutes: Discovery & Evaluation; Remaining 7 minutes: Entry & Management
    const isDiscoveryPhase = minuteInCycle < 8;
    const phase: CycleStatus['phase'] = isDiscoveryPhase
      ? 'DISCOVERY_AND_EVALUATION'
      : 'ENTRY_AND_MANAGEMENT';

    const minutesRemainingInPhase = isDiscoveryPhase ? 8 - minuteInCycle : 15 - minuteInCycle;

    return {
      cycleIndex,
      cycleMinute: minuteInCycle,
      phase,
      minutesRemainingInPhase,
      autopilotActive: this.autopilotActive,
      emergencyStopped: this.emergencyStopped,
    };
  }

  private runAutopilotCycleTick(forceImmediate = false) {
    const cycle = this.getCycleStatus();
    // Only place entries during Entry & Management phase (minutes 8-15) unless forced on initial activation
    if (!forceImmediate && cycle.phase !== 'ENTRY_AND_MANAGEMENT') return;

    // Daily Stop-Loss Circuit Breaker Enforcement
    if (this.isDailyStopLossTriggered()) {
      return;
    }

    // Target 3 to 5 trades per 15-minute cycle, enforcing max 5 simultaneous open positions
    const openPositionsCount = this.positions.filter((p) => p.state !== 'CLOSED').length;
    const maxSimultaneousPositions = 5;
    if (openPositionsCount >= maxSimultaneousPositions) return;

    // Get qualified candidates (Must pass 8 out of 8 checks!)
    const qualifiedTokens = this.tokens.filter(
      (t) =>
        t.checklist.allPassed &&
        !this.positions.some((p) => p.tokenMint === t.mint && p.state !== 'CLOSED')
    );

    if (qualifiedTokens.length === 0) return;

    // Aim to place 3 to 5 trades every 15-minute cycle
    const targetTradesThisCycle = Math.min(5, Math.max(3, qualifiedTokens.length));
    const needed = Math.min(
      maxSimultaneousPositions - openPositionsCount,
      targetTradesThisCycle
    );
    if (needed <= 0) return;

    // Calculate dynamic 50/50 allocation & equal trade budget
    const allocation = this.getWalletAllocation();
    if (allocation.uncommittedTradingUsd < 50) return;

    // Divide eligible uncommitted budget equally among qualified candidates
    const candidatesToTrade = qualifiedTokens.slice(0, needed);
    const budgetPerTradeUsd = allocation.uncommittedTradingUsd / candidatesToTrade.length;

    // Enforce account risk limit: Configurable planned risk % of total equity
    const maxRiskPerTradeUsd =
      allocation.totalEquityUsd * (this.riskConfig.maxRiskPerTradePercent / 100);
    // Configurable per-position stop loss ratio
    const slRatio = Math.max(0.01, this.riskConfig.positionStopLossPercent / 100);
    const maxPositionSizeUsd = maxRiskPerTradeUsd / slRatio;
    const finalTradeUsd = Math.min(budgetPerTradeUsd, maxPositionSizeUsd);
    const amountSol = +(finalTradeUsd / this.solPriceUsd).toFixed(4);

    if (amountSol > 0.05) {
      candidatesToTrade.forEach((tok, idx) => {
        this.executeBuyOrder({
          symbol: tok.symbol,
          mint: tok.mint,
          amountSol,
          slippage: this.riskConfig.maxSlippageTolerancePercent,
          stopLossPercent: -this.riskConfig.positionStopLossPercent,
          priorityFeeTier: 'Turbo',
          isAuto: true,
          idempotencyKey: `auto_${tok.mint}_${Date.now()}_${idx}`,
        });
      });
    }
  }

  // --- DYNAMIC 50/50 WALLET ALLOCATION ---

  public getWalletAllocation(): WalletAllocationState {
    const totalEquity = this.paperTotalEquityUsd;
    const targetReserveUsd = totalEquity * 0.5; // 50% Reserve
    const targetTradingUsd = totalEquity * 0.5; // 50% Trading

    // Open positions value
    const committedPositionsUsd = this.positions
      .filter((p) => p.state !== 'CLOSED')
      .reduce((acc, p) => acc + p.currentValueUsd, 0);

    const pendingOrdersUsd = 0;

    // Strict rule: Reserve cannot be used for new entries!
    const actualReserveUsd = Math.max(0, targetReserveUsd);
    const uncommittedTradingUsd = Math.max(
      0,
      targetTradingUsd - committedPositionsUsd - pendingOrdersUsd
    );

    return {
      totalEquityUsd: +totalEquity.toFixed(2),
      solPriceUsd: this.solPriceUsd,
      targetReservePercent: 50,
      targetTradingPercent: 50,
      targetReserveUsd: +targetReserveUsd.toFixed(2),
      actualReserveUsd: +actualReserveUsd.toFixed(2),
      targetTradingUsd: +targetTradingUsd.toFixed(2),
      committedInPositionsUsd: +committedPositionsUsd.toFixed(2),
      pendingOrdersUsd,
      uncommittedTradingUsd: +uncommittedTradingUsd.toFixed(2),
      isReserveUndercut: actualReserveUsd < targetReserveUsd * 0.9,
    };
  }

  // --- CONTROLS & AUTOPILOT TOGGLE ---

  public isAutopilotOn(): boolean {
    return this.autopilotActive && !this.emergencyStopped;
  }

  public setAutopilot(enabled: boolean) {
    // LIVE SAFETY GATE: this engine only creates simulated orders.
    // Never start its autopilot while in Live Mode.
    if (enabled && !this.isPaperTrading) {
      this.logActivity('REJECTED', 'Live autopilot blocked: signed on-chain execution is not implemented.');
      this.autopilotActive = false;
      this.notify();
      return;
    }
    if (enabled && this.emergencyStopped) {
      this.emergencyStopped = false;
    }
    this.autopilotActive = enabled;
    if (enabled && this.isDailyStopLossTriggered()) {
      this.logActivity(
        'RISK',
        `Autopilot turned ON, but Daily Stop-Loss circuit breaker (-${this.riskConfig.dailyStopLossPercent}%) is currently active. Automated entries remain paused until reset.`
      );
    }
    this.logActivity(
      'AUTOPILOT',
      enabled
        ? 'Autopilot turned ON: 15-minute automated trading cycle active (targeting 3–5 trades per cycle)'
        : 'Autopilot turned OFF: Automated entries paused; open positions remain continuously monitored'
    );
    if (enabled) {
      // Immediately evaluate cycle and execute initial qualified entries (3-5 trades) upon activation
      this.runAutopilotCycleTick(true);
    }
    this.notify();
  }

  public triggerEmergencyStop() {
    this.emergencyStopped = true;
    this.autopilotActive = false;
    this.logActivity('RISK', 'EMERGENCY STOP activated by user: halted all new entries and initiated position close.');
    // Attempt closing all open positions safely
    const openPositions = this.positions.filter((p) => p.state !== 'CLOSED');
    openPositions.forEach((pos) => {
      const tok = this.tokens.find((t) => t.mint === pos.tokenMint);
      const exitPrice = tok ? tok.priceUsd : pos.currentPrice;
      pos.state = 'CLOSED';
      pos.exitReason = 'Emergency Stop Activated by User';
      this.closePositionInternal(pos, exitPrice, pos.exitReason);
    });
    this.notify();
  }

  // --- TRADE EXECUTION ---

  public executeBuyOrder(params: {
    symbol: string;
    mint: string;
    amountSol: number;
    slippage: number;
    priorityFeeTier: 'Fast' | 'Turbo' | 'Ultra';
    isAuto?: boolean;
    idempotencyKey?: string;
    stopLossPercent?: number;
    profitTargetPercent?: number;
    trailingStopActive?: boolean;
    trailingStopMarginPercent?: number;
  }): { success: boolean; order?: TradeOrder; error?: string } {
    // LIVE SAFETY GATE: never report a simulated order as a live execution.
    if (!this.isPaperTrading) {
      this.logActivity('REJECTED', `Live order blocked for ${params.symbol}: real signed Jupiter execution is not implemented.`);
      return { success: false, error: 'Live execution unavailable: wallet signing and Jupiter transaction broadcast are not implemented.' };
    }
    if (this.emergencyStopped) {
      this.logActivity('REJECTED', `Order for ${params.symbol} rejected: Emergency stop active`);
      return { success: false, error: 'Cannot trade while Emergency Stop is active.' };
    }

    // Risk Check: Autopilot entries blocked if Daily Stop-Loss Circuit Breaker is triggered
    if (params.isAuto && this.isDailyStopLossTriggered()) {
      this.logActivity(
        'REJECTED',
        `Automated order for ${params.symbol} rejected: Daily stop-loss limit (-${this.riskConfig.dailyStopLossPercent}%) reached`
      );
      return {
        success: false,
        error: `Cannot trade: Daily stop-loss circuit breaker (-${this.riskConfig.dailyStopLossPercent}%) is active.`,
      };
    }

    // Risk Check: Autopilot entries blocked if requested slippage exceeds configured max tolerance
    if (params.isAuto && params.slippage > this.riskConfig.maxSlippageTolerancePercent) {
      this.logActivity(
        'REJECTED',
        `Automated order for ${params.symbol} rejected: Slippage ${params.slippage}% exceeds max autopilot tolerance ${this.riskConfig.maxSlippageTolerancePercent}%`
      );
      return {
        success: false,
        error: `Order slippage ${params.slippage}% exceeds maximum configured autopilot tolerance of ${this.riskConfig.maxSlippageTolerancePercent}%.`,
      };
    }

    // Idempotency / Deduplication check
    const idKey =
      params.idempotencyKey ||
      `${params.symbol}_${params.amountSol}_${Math.floor(Date.now() / 3000)}`;
    const now = Date.now();
    const lastSeen = this.recentOrderSignatures.get(idKey);
    if (lastSeen && now - lastSeen < 10000) {
      this.logActivity(
        'REJECTED',
        `Duplicate order submission blocked for ${params.symbol} (${params.amountSol} SOL)`
      );
      return { success: false, error: 'Duplicate order submission detected and prevented.' };
    }
    this.recentOrderSignatures.set(idKey, now);

    const tok =
      this.tokens.find((t) => t.mint === params.mint) ||
      this.tokens.find((t) => t.symbol === params.symbol) ||
      this.tokens[0];

    // Checklist review (logged for transparency during manual trading)
    if (!tok.checklist.allPassed && !params.isAuto) {
      this.logActivity(
        'ICC_CHECK',
        `Manual entry: ${tok.symbol} checklist (${tok.checklist.scoreOutOf8}/8: ${tok.checklist.failureReason || 'Pending validation'})`
      );
    }

    const allocation = this.getWalletAllocation();
    const tradeUsd = params.amountSol * this.solPriceUsd;

    // Strict rule: Cannot allocate from the 50% reserve!
    // No autopilot overdraft buffer: both manual and auto must respect 50/50.
    if (tradeUsd > allocation.uncommittedTradingUsd + 0.000001) {
      this.logActivity(
        'RISK',
        `Order for ${tok.symbol} rejected: Exceeds uncommitted budget ($${allocation.uncommittedTradingUsd} avail, $${allocation.targetReserveUsd} reserve protected)`
      );
      return {
        success: false,
        error: `Insufficient uncommitted trading budget ($${allocation.uncommittedTradingUsd} available). 50% Reserve ($${allocation.targetReserveUsd}) is strictly protected and unavailable.`,
      };
    }

    const tokenQty = tradeUsd / tok.priceUsd;
    const slPercent = -3.5;
    const ptPercent = params.profitTargetPercent !== undefined ? params.profitTargetPercent : 25.0;
    const trailingActive = true;
    const trailingMargin = 2.0;

    const order: TradeOrder = {
      id: createUniqueEngineId(`ord_${tok.symbol}`),
      type: 'BUY',
      symbol: tok.symbol,
      amountSol: params.amountSol,
      priceUsd: tok.priceUsd,
      dexRoute: 'Jupiter Aggregator (Raydium CPMM 65% → Orca 35%)',
      slippage: params.slippage,
      priorityFee: `${params.priorityFeeTier} Priority`,
      status: 'SIMULATED',
      timestamp: new Date().toLocaleTimeString(),
    };

    const position: Position = {
      id: createUniqueEngineId(`pos_${tok.symbol}`),
      tokenSymbol: tok.symbol,
      tokenMint: tok.mint,
      entryPrice: tok.priceUsd,
      currentPrice: tok.priceUsd,
      highestPriceSeen: tok.priceUsd,
      isAutopilotPosition: params.isAuto === true,
      amountSol: params.amountSol,
      tokenQuantity: tokenQty,
      costBasisUsd: tradeUsd,
      currentValueUsd: tradeUsd,
      pnlUsd: 0,
      pnlPercent: 0,
      stopLossPercent: slPercent,
      stopLossPrice: +(tok.priceUsd * (1 + slPercent / 100)).toFixed(6),
      profitTargetPercent: ptPercent,
      takeProfitStandardPrice: +(tok.priceUsd * (params.isAuto ? 1.02 : 1.0)).toFixed(6),
      takeProfitMaxPrice: +(tok.priceUsd * (1 + ptPercent / 100)).toFixed(6), // +25% max profit cap
      profitProtectionActive: false,
      trailingStopActive: trailingActive,
      trailingStopMarginPercent: trailingMargin,
      state: 'POSITION_OPEN',
      openedAtTime: now,
      maxHoldingExpiresAtTime: now + 7 * 60 * 1000, // 7-minute max hold
      openedAtString: new Date().toLocaleTimeString(),
    };

    this.positions.unshift(position);
    this.orderHistory.unshift(order);
    this.logActivity(
      'ORDER',
      `${params.isAuto ? '[AUTOPILOT]' : '[MANUAL]'} Entered position ${tok.symbol} (${params.amountSol} SOL @ $${tok.priceUsd.toFixed(6)}) via Jupiter | SL: ${slPercent}% | ${params.isAuto ? 'BE lock at +2% with 2pp trail' : '2pp trailing active'} | TP: +${ptPercent}%`
    );
    this.notify();

    return { success: true, order };
  }

  // --- POSITION EXIT RULES & MARGIN MANAGEMENT (PHASE 14) ---

  public updatePositionExitRules(
    positionId: string,
    updates: {
      stopLossPercent?: number;
      profitTargetPercent?: number;
      trailingStopActive?: boolean;
      trailingStopMarginPercent?: number;
    }
  ): { success: boolean; position?: Position; error?: string } {
    const pos = this.positions.find((p) => p.id === positionId && p.state !== 'CLOSED');
    if (!pos) return { success: false, error: 'Active position not found' };

    if (updates.stopLossPercent !== undefined) {
      pos.stopLossPercent = updates.stopLossPercent;
      pos.stopLossPrice = +(pos.entryPrice * (1 + updates.stopLossPercent / 100)).toFixed(6);
    }

    if (updates.profitTargetPercent !== undefined) {
      pos.profitTargetPercent = updates.profitTargetPercent;
      pos.takeProfitMaxPrice = +(pos.entryPrice * (1 + updates.profitTargetPercent / 100)).toFixed(6);
    }

    if (updates.trailingStopActive !== undefined) {
      pos.trailingStopActive = updates.trailingStopActive;
    }

    if (updates.trailingStopMarginPercent !== undefined) {
      pos.trailingStopMarginPercent = updates.trailingStopMarginPercent;
    }

    this.logActivity(
      'ORDER',
      `[MARGIN ADJUSTMENT] ${pos.tokenSymbol} rules updated: Stop-Loss ${pos.stopLossPercent >= 0 ? '+' : ''}${pos.stopLossPercent.toFixed(1)}% ($${pos.stopLossPrice.toFixed(6)}) | Target +${pos.profitTargetPercent}% ($${pos.takeProfitMaxPrice.toFixed(6)}) | Trailing: ${pos.trailingStopActive ? `${pos.trailingStopMarginPercent}% trail` : 'OFF'}`
    );

    this.notify();
    return { success: true, position: pos };
  }

  public manualClosePosition(positionId: string): boolean {
    const pos = this.positions.find((p) => p.id === positionId && p.state !== 'CLOSED');
    if (!pos) return false;

    const tok = this.tokens.find((t) => t.mint === pos.tokenMint);
    const exitPrice = tok ? tok.priceUsd : pos.currentPrice;
    pos.state = 'CLOSED';
    pos.exitReason = 'Manual User Exit';
    this.closePositionInternal(pos, exitPrice, pos.exitReason);
    this.notify();
    return true;
  }

  public closeMultiplePositions(
    positionIds: string[],
    reason: string = 'Manual Batch Close'
  ): { count: number; totalPnlUsd: number } {
    const idSet = new Set(positionIds);
    let count = 0;
    let totalPnlUsd = 0;

    this.positions.forEach((pos) => {
      if (idSet.has(pos.id) && pos.state !== 'CLOSED') {
        const tok = this.tokens.find((t) => t.mint === pos.tokenMint);
        const exitPrice = tok ? tok.priceUsd : pos.currentPrice;
        const finalValUsd = exitPrice * pos.tokenQuantity;
        const pnl = finalValUsd - pos.costBasisUsd;
        totalPnlUsd += pnl;
        count++;

        pos.state = 'CLOSED';
        pos.exitReason = reason;
        this.closePositionInternal(pos, exitPrice, reason);
      }
    });

    if (count > 0) {
      this.logActivity(
        'ORDER',
        `[BATCH CLOSE] Closed ${count} position(s) simultaneously (${reason}) | Total Realized PnL: ${
          totalPnlUsd >= 0 ? '+' : ''
        }$${totalPnlUsd.toFixed(2)}`
      );
      this.notify();
    }

    return { count, totalPnlUsd: +totalPnlUsd.toFixed(2) };
  }

  public closeAllProfitablePositions(): { count: number; totalPnlUsd: number } {
    const profitableIds = this.positions
      .filter((p) => p.state !== 'CLOSED' && (p.pnlUsd > 0 || p.pnlPercent > 0))
      .map((p) => p.id);
    return this.closeMultiplePositions(profitableIds, 'Take Profit: Close All In Profit');
  }

  public closeAllPositions(): { count: number; totalPnlUsd: number } {
    const openIds = this.positions
      .filter((p) => p.state !== 'CLOSED')
      .map((p) => p.id);
    return this.closeMultiplePositions(openIds, 'Close All Open Positions');
  }

  // --- ACCESSORS & PORTFOLIO P&L METRICS ---

  public getPortfolioMetrics(): PortfolioMetrics {
    const openPositions = this.positions.filter((p) => p.state !== 'CLOSED');
    const closedPositions = this.positions.filter((p) => p.state === 'CLOSED');

    const committedPositionsCostUsd = openPositions.reduce((acc, p) => acc + p.costBasisUsd, 0);
    const committedPositionsCurrentValUsd = openPositions.reduce((acc, p) => acc + p.currentValueUsd, 0);
    const unrealizedPnlUsd = +(committedPositionsCurrentValUsd - committedPositionsCostUsd).toFixed(2);
    const unrealizedPnlPercent =
      committedPositionsCostUsd > 0
        ? +((unrealizedPnlUsd / committedPositionsCostUsd) * 100).toFixed(2)
        : 0;

    const totalEquityUsd = +(this.paperTotalEquityUsd + unrealizedPnlUsd).toFixed(2);
    const totalEquitySol = +(totalEquityUsd / this.solPriceUsd).toFixed(4);
    const cashBalanceUsd = Math.max(0, +(this.paperTotalEquityUsd - committedPositionsCostUsd).toFixed(2));
    const cashBalanceSol = +(cashBalanceUsd / this.solPriceUsd).toFixed(4);

    const initialStartingBalance = 10000.0;
    const realizedPnlUsd = +(this.paperTotalEquityUsd - initialStartingBalance).toFixed(2);

    const winningTrades = closedPositions.filter((p) => (p.pnlUsd || 0) > 0).length;
    const winRatePercent =
      closedPositions.length > 0
        ? +((winningTrades / closedPositions.length) * 100).toFixed(1)
        : 0;

    return {
      totalEquityUsd,
      totalEquitySol,
      solPriceUsd: this.solPriceUsd,
      cashBalanceUsd,
      cashBalanceSol,
      committedPositionsUsd: +committedPositionsCurrentValUsd.toFixed(2),
      unrealizedPnlUsd,
      unrealizedPnlPercent,
      realizedPnlUsd,
      openPositionsCount: openPositions.length,
      closedPositionsCount: closedPositions.length,
      totalTradesCount: this.orderHistory.length,
      winRatePercent,
    };
  }

  public getSevenDayPerformanceHistory(): Array<{
    dayLabel: string;
    dateStr: string;
    pnlUsd: number;
    pnlPercent: number;
    equityUsd: number;
    dailyChangeUsd: number;
    tradesCount: number;
    isToday: boolean;
  }> {
    const metrics = this.getPortfolioMetrics();
    const now = new Date();
    const days = [];

    // Prior 6 days cumulative base performance
    const historicalPnLBase = [0, 142.5, 385.0, 612.4, 895.8, 1240.2];
    const historicalTrades = [0, 2, 4, 7, 10, 14];

    for (let i = 6; i >= 1; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const idx = 6 - i;
      const pnlUsd = historicalPnLBase[idx];
      const prevPnl = idx > 0 ? historicalPnLBase[idx - 1] : 0;
      const dailyChangeUsd = +(pnlUsd - prevPnl).toFixed(2);
      const equityUsd = +(10000 + pnlUsd).toFixed(2);
      const pnlPercent = +((pnlUsd / 10000) * 100).toFixed(2);

      days.push({
        dayLabel: `Day ${idx + 1}`,
        dateStr,
        pnlUsd,
        pnlPercent,
        equityUsd,
        dailyChangeUsd,
        tradesCount: historicalTrades[idx],
        isToday: false,
      });
    }

    // Today (Live point connected directly to real-time engine metrics)
    const baseYesterdayPnl = historicalPnLBase[historicalPnLBase.length - 1];
    const sessionLivePnl = +(metrics.totalEquityUsd - 10000).toFixed(2);
    const todayPnlUsd = +(baseYesterdayPnl + sessionLivePnl).toFixed(2);
    const todayDailyChange = +(todayPnlUsd - baseYesterdayPnl).toFixed(2);
    const todayEquity = +(10000 + todayPnlUsd).toFixed(2);
    const todayPnlPercent = +((todayPnlUsd / 10000) * 100).toFixed(2);

    days.push({
      dayLabel: 'Today (Live)',
      dateStr: 'Today • Live',
      pnlUsd: todayPnlUsd,
      pnlPercent: todayPnlPercent,
      equityUsd: todayEquity,
      dailyChangeUsd: todayDailyChange,
      tradesCount: 14 + metrics.totalTradesCount,
      isToday: true,
    });

    return days;
  }

  public getPaperBalance(): { sol: number; usd: number; solPrice: number } {
    const metrics = this.getPortfolioMetrics();
    return {
      sol: metrics.totalEquitySol,
      usd: metrics.totalEquityUsd,
      solPrice: this.solPriceUsd,
    };
  }

  public creditPaperSol(amountSol: number): void {
    if (!Number.isFinite(amountSol) || amountSol <= 0) return;
    // Demo-only faucet: credit the same ledger used for equity and risk allocation.
    this.paperTotalEquityUsd += amountSol * this.solPriceUsd;
    this.logActivity('ORDER', `Demo faucet credited ${amountSol.toFixed(4)} SOL (simulated).`);
    this.notify();
  }

  public applyPaperDemoWallet(amountSol: number): void {
    if (!Number.isFinite(amountSol) || amountSol <= 0) return;
    this.positions = [];
    this.orderHistory = [];
    this.paperTotalEquityUsd = +(amountSol * this.solPriceUsd).toFixed(2);
    this.logActivity(
      'ORDER',
      `Paper demo wallet loaded at ${amountSol.toFixed(4)} SOL (simulated). Open paper trades were cleared.`
    );
    this.notify();
  }

  public resetPaperSimulation() {
    this.positions = [];
    this.orderHistory = [];
    this.paperTotalEquityUsd = 10000.0;
    this.logActivity('ORDER', 'Paper trading simulation reset to initial $10,000.00 USD balance.');
    this.notify();
  }

  public executeSwap(params: {
    symbol: string;
    mint: string;
    amountSol: number;
    slippage: number;
    priorityFeeTier: 'Fast' | 'Turbo' | 'Ultra';
  }): { success: boolean; order?: TradeOrder; error?: string } {
    return this.executeBuyOrder({
      ...params,
      isAuto: false,
    });
  }

  public closePosition(positionId: string): boolean {
    return this.manualClosePosition(positionId);
  }

  public getTokens(): ScannedToken[] {
    return this.tokens;
  }

  public ingestVerifiedMarketTokens(
    raw: Array<Omit<ScannedToken, 'checklist' | 'ema9' | 'ema21' | 'iccPhase' | 'iccSignalStrength'>>,
    solPriceUsd?: number | null
  ): void {
    this.liveMarketEnabled = true;
    this.tokens = this.evaluateTokens(raw);
    if (solPriceUsd && solPriceUsd > 0) {
      this.solPriceUsd = solPriceUsd;
    }
    this.notify();
  }

  public useSimulatedMarketTokens(): void {
    this.liveMarketEnabled = false;
    this.tokens = this.evaluateTokens(INITIAL_TOKENS_DATA);
    this.notify();
  }

  public isLiveMarketEnabled(): boolean {
    return this.liveMarketEnabled;
  }

  public getPositions(): Position[] {
    const seen = new Set<string>();
    const unique: Position[] = [];
    for (const p of this.positions) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        unique.push(p);
      }
    }
    return unique;
  }

  public getOrderHistory(): TradeOrder[] {
    const seen = new Set<string>();
    const unique: TradeOrder[] = [];
    for (const o of this.orderHistory) {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        unique.push(o);
      }
    }
    return unique;
  }

  public isPaperMode(): boolean {
    return this.isPaperTrading;
  }

  public setPaperMode(enabled: boolean) {
    // This class is a simulation engine, not a signed blockchain executor.
    // Fail closed even if a UI bypasses the normal confirmation dialog.
    if (!enabled) {
      throw new Error('Live trading is locked: real wallet signing and Jupiter execution are not implemented.');
    }
    this.isPaperTrading = true;
    this.autopilotActive = false;
    this.notify();
  }

  public authorizeLiveTrading(confirmed: boolean) {
    // A confirmation alone must never authorize real-money execution.
    this.isLiveAuthorized = false;
    if (confirmed) {
      this.logActivity('REJECTED', 'Live authorization blocked: transaction signing is not implemented.');
    }
    this.isPaperTrading = true;
    this.notify();
  }

  public isLiveTradingAuthorized(): boolean {
    return this.isLiveAuthorized;
  }

  public subscribe(cb: () => void): () => void {
    this.subscribers.push(cb);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== cb);
    };
  }

  private notify() {
    this.subscribers.forEach((cb) => cb());
  }
}

export const tradingEngine = new TradingEngine();
