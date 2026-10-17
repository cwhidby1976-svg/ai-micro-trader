import { ScannedToken, tradingEngine } from './tradingEngine';

export interface ScannerOpportunity {
  id: string;
  rank: number;
  token: ScannedToken;
  opportunityScore: number; // 0 - 100 composite opportunity rating
  signalBadge: string; // e.g. 'BREAKOUT EXPANSION', 'IMPULSE SURGE', 'CONSOLIDATION COIL'
  momentum: 'STRONG_BULLISH' | 'ACCELERATING' | 'CONSOLIDATING';
  volumeSurge5m: number; // e.g. 340%
  liquidityTier: 'HIGH_CAP' | 'MID_CAP' | 'MICRO_CAP';
  targetTakeProfit: number;
  stopLossPrice: number;
  checklistPassedCount: number;
  status: 'ACTIVE_ENTRY' | 'BREAKOUT_PENDING' | 'ACCELERATING';
  tickDeltaPercent: number; // micro change on last refresh (+/- 0.2%)
}

export interface ScannerFeedState {
  opportunities: ScannerOpportunity[];
  lastRefreshedAt: number;
  nextRefreshInSeconds: number;
  refreshIntervalMs: number;
  totalOpportunitiesCount: number;
  isPaused: boolean;
}

export class ScannerDataProvider {
  private opportunities: ScannerOpportunity[] = [];
  private lastRefreshedAt: number = Date.now();
  private nextRefreshInSeconds: number = 10;
  private readonly REFRESH_INTERVAL_SECONDS: number = 10;
  private refreshTimer: any = null;
  private countdownTimer: any = null;
  private subscribers: Array<(state: ScannerFeedState) => void> = [];
  private isPaused: boolean = false;
  private liveQuotes = false;

  constructor() {
    this.refreshOpportunities();
    this.startTimers();
  }

  private startTimers() {
    this.clearTimers();

    // 1-second interval to decrement the countdown timer
    this.countdownTimer = setInterval(() => {
      if (this.isPaused) return;

      this.nextRefreshInSeconds -= 1;
      if (this.nextRefreshInSeconds <= 0) {
        this.refreshOpportunities();
        this.nextRefreshInSeconds = this.REFRESH_INTERVAL_SECONDS;
      }
      this.notifySubscribers();
    }, 1000);
  }

  private clearTimers() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Live DEX mode lists the top 25 Solana meme coins by 24h volume.
   * Simulated mode keeps the original 6 paper opportunities for tests.
   */
  public refreshOpportunities(): ScannerOpportunity[] {
    const allTokens = tradingEngine.getTokens();
    const limit = this.liveQuotes ? 25 : 6;

    const qualifiedTokens = allTokens.filter(
      (t) => t.security.score >= 85 && t.iccPhase !== 'NEUTRAL'
    );

    const candidates = this.liveQuotes
      ? [...allTokens].sort((a, b) => b.volume24h - a.volume24h || b.liquidity - a.liquidity)
      : qualifiedTokens.length >= 6
        ? qualifiedTokens
        : allTokens;

    const scoredList: ScannerOpportunity[] = candidates.map((token, index) => {
      const randomJitter = this.liveQuotes ? 0 : (Math.random() - 0.48) * 0.8;
      const volumeSurge = this.liveQuotes
        ? Math.round(Math.max(0, token.change5m) * 12)
        : Math.round(150 + (token.change5m > 0 ? token.change5m * 12 : 50) + (Math.random() * 60));

      let baseScore = Math.round(
        token.security.score * 0.45 +
        token.iccSignalStrength * 0.4 +
        Math.min(15, Math.max(0, token.change5m)) +
        randomJitter * 2
      );
      if (!this.liveQuotes) {
        baseScore = Math.max(82, Math.min(99, baseScore));
      } else {
        baseScore = Math.max(0, Math.min(100, baseScore));
      }

      let signalBadge = this.liveQuotes ? 'JUPITER QUOTE' : 'CONTINUATION BREAKOUT';
      let momentum: ScannerOpportunity['momentum'] = 'STRONG_BULLISH';
      let status: ScannerOpportunity['status'] = 'ACTIVE_ENTRY';

      if (token.iccPhase === 'IMPULSE') {
        signalBadge = 'HIGH-VOLUME IMPULSE';
        momentum = 'ACCELERATING';
        status = 'ACCELERATING';
      } else if (token.iccPhase === 'CONSOLIDATING') {
        signalBadge = 'PULLBACK CONSOLIDATION';
        momentum = 'CONSOLIDATING';
        status = 'BREAKOUT_PENDING';
      }

      let liquidityTier: ScannerOpportunity['liquidityTier'] = 'MID_CAP';
      if (token.liquidity >= 200000) liquidityTier = 'HIGH_CAP';
      else if (token.liquidity < 50000) liquidityTier = 'MICRO_CAP';

      const targetTakeProfit = +(token.priceUsd * (1 + (token.iccPhase === 'CONTINUATION' ? 0.5 : 0.75))).toFixed(6);
      const stopLossPrice = +(token.priceUsd * 0.95).toFixed(6); // -5% strictly hard stop
      const checklistPassedCount = token.checklist.scoreOutOf8;

      return {
        id: `opp_${token.id}_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
        rank: index + 1,
        token,
        opportunityScore: baseScore,
        signalBadge,
        momentum,
        volumeSurge5m: volumeSurge,
        liquidityTier,
        targetTakeProfit,
        stopLossPrice,
        checklistPassedCount,
        status,
        tickDeltaPercent: +randomJitter.toFixed(2),
      };
    });

    if (this.liveQuotes) {
      scoredList.sort((a, b) => b.token.volume24h - a.token.volume24h || b.opportunityScore - a.opportunityScore);
    } else {
      scoredList.sort((a, b) => b.opportunityScore - a.opportunityScore);
    }

    this.opportunities = scoredList.slice(0, limit).map((opp, idx) => ({
      ...opp,
      rank: idx + 1,
    }));

    this.lastRefreshedAt = Date.now();
    this.nextRefreshInSeconds = this.REFRESH_INTERVAL_SECONDS;
    this.notifySubscribers();

    return this.opportunities;
  }

  public getActiveOpportunities(): ScannerOpportunity[] {
    if (this.opportunities.length === 0) {
      this.refreshOpportunities();
    }
    return [...this.opportunities];
  }

  public getFeedState(): ScannerFeedState {
    return {
      opportunities: this.getActiveOpportunities(),
      lastRefreshedAt: this.lastRefreshedAt,
      nextRefreshInSeconds: this.nextRefreshInSeconds,
      refreshIntervalMs: this.REFRESH_INTERVAL_SECONDS * 1000,
      totalOpportunitiesCount: this.opportunities.length,
      isPaused: this.isPaused,
    };
  }

  public setLiveQuotes(enabled: boolean) {
    this.liveQuotes = enabled;
    this.refreshOpportunities();
  }

  public manualRefresh() {
    this.refreshOpportunities();
  }

  public togglePause(): boolean {
    this.isPaused = !this.isPaused;
    this.notifySubscribers();
    return this.isPaused;
  }

  public subscribe(cb: (state: ScannerFeedState) => void): () => void {
    this.subscribers.push(cb);
    // Initial emit
    cb(this.getFeedState());

    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== cb);
    };
  }

  private notifySubscribers() {
    const state = this.getFeedState();
    this.subscribers.forEach((cb) => cb(state));
  }

  public destroy() {
    this.clearTimers();
    this.subscribers = [];
  }
}

export const scannerDataProvider = new ScannerDataProvider();
