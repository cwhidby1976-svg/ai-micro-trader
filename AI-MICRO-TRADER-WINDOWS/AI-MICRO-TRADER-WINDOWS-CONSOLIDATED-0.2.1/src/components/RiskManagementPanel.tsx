import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  Percent,
  Activity,
  RotateCcw,
  Info,
  Check,
  Zap,
  Lock,
  Power,
  Flame,
  ArrowRight,
  TrendingDown,
  Layers,
} from 'lucide-react';
import {
  RiskManagementConfig,
  DailyRiskStatus,
} from '../services/tradingEngine';

interface RiskManagementPanelProps {
  riskConfig: RiskManagementConfig;
  dailyRiskStatus: DailyRiskStatus;
  onUpdateConfig: (updates: Partial<RiskManagementConfig>) => void;
  onResetCircuitBreaker: () => void;
  onTestCircuitBreaker?: () => void;
  autopilotActive: boolean;
  onToggleAutopilot?: () => void;
  isTrial?: boolean;
  onOpenMemberPortal?: () => void;
}

export const RiskManagementPanel: React.FC<RiskManagementPanelProps> = ({
  riskConfig,
  dailyRiskStatus,
  onUpdateConfig,
  onResetCircuitBreaker,
  onTestCircuitBreaker,
  autopilotActive,
  onToggleAutopilot,
  isTrial = false,
  onOpenMemberPortal,
}) => {
  const [dailyStopLoss, setDailyStopLoss] = useState<number>(riskConfig.dailyStopLossPercent);
  const [maxSlippage, setMaxSlippage] = useState<number>(riskConfig.maxSlippageTolerancePercent);
  const [positionStopLoss, setPositionStopLoss] = useState<number>(riskConfig.positionStopLossPercent);
  const [maxRiskPerTrade, setMaxRiskPerTrade] = useState<number>(riskConfig.maxRiskPerTradePercent);
  const [autoCloseOnBreaker, setAutoCloseOnBreaker] = useState<boolean>(riskConfig.autoCloseOnDailyStopLoss);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Sync state if external config updates
  useEffect(() => {
    setDailyStopLoss(riskConfig.dailyStopLossPercent);
    setMaxSlippage(riskConfig.maxSlippageTolerancePercent);
    setPositionStopLoss(riskConfig.positionStopLossPercent);
    setMaxRiskPerTrade(riskConfig.maxRiskPerTradePercent);
    setAutoCloseOnBreaker(riskConfig.autoCloseOnDailyStopLoss);
  }, [riskConfig]);

  const handleSave = () => {
    onUpdateConfig({
      dailyStopLossPercent: dailyStopLoss,
      maxSlippageTolerancePercent: maxSlippage,
      positionStopLossPercent: positionStopLoss,
      maxRiskPerTradePercent: maxRiskPerTrade,
      autoCloseOnDailyStopLoss: autoCloseOnBreaker,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleResetDefaults = () => {
    setDailyStopLoss(5.0);
    setMaxSlippage(1.0);
    setPositionStopLoss(5.0);
    setMaxRiskPerTrade(0.5);
    setAutoCloseOnBreaker(true);
    onUpdateConfig({
      dailyStopLossPercent: 5.0,
      maxSlippageTolerancePercent: 1.0,
      positionStopLossPercent: 5.0,
      maxRiskPerTradePercent: 0.5,
      autoCloseOnDailyStopLoss: true,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Preset options for quick clicks
  const stopLossPresets = [2.0, 3.0, 5.0, 7.5, 10.0];
  const slippagePresets = [0.5, 1.0, 1.5, 2.0, 3.0];
  const positionSlPresets = [3.0, 5.0, 7.5, 10.0];

  // Calculate live dollar limit based on starting equity
  const startingEquity = dailyRiskStatus.dayStartingEquityUsd || 10000;
  const calculatedMaxLossUsd = (startingEquity * (dailyStopLoss / 100)).toFixed(2);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner & Status Header */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl border ${
              dailyRiskStatus.isDailyStopLossTriggered
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
            }`}>
              {dailyRiskStatus.isDailyStopLossTriggered ? (
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Risk Management & Circuit Breaker Engine
                </h2>
                {dailyRiskStatus.isDailyStopLossTriggered ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950/80 text-rose-400 border border-rose-800 animate-pulse font-mono">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    CIRCUIT BREAKER TRIPPED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    ARMED & OPERATIONAL
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Configure account-level daily drawdown circuit breakers and Jupiter DEX slippage tolerance ceilings for the 15-minute autopilot engine.
              </p>
            </div>
          </div>

          {/* Quick Autopilot Switch & Breaker Reset */}
          <div className="flex items-center gap-2.5 shrink-0">
            {dailyRiskStatus.isDailyStopLossTriggered && (
              <button
                type="button"
                onClick={onResetCircuitBreaker}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition shadow flex items-center gap-1.5"
                title="Reset tripped daily stop loss and restore autopilot operations"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Circuit Breaker</span>
              </button>
            )}

            {onToggleAutopilot && (
              <button
                type="button"
                onClick={onToggleAutopilot}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
                  autopilotActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                    : isTrial
                    ? 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                }`}
              >
                <Power className={`w-3.5 h-3.5 ${autopilotActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span>Autopilot: {autopilotActive ? 'ON' : 'OFF'}</span>
                {isTrial && <Lock className="w-3 h-3 text-amber-400 ml-1" />}
              </button>
            )}
          </div>
        </div>

        {/* Live Daily Drawdown & Circuit Breaker Gauge */}
        <div className="mt-6 pt-1 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-zinc-950/80 rounded-xl border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 uppercase font-mono tracking-wider">Day Baseline Equity</span>
            <div className="text-lg font-bold text-white font-mono mt-1">
              ${startingEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-zinc-500">Starting benchmark</span>
          </div>

          <div className="p-4 bg-zinc-950/80 rounded-xl border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 uppercase font-mono tracking-wider">Current Portfolio Equity</span>
            <div className="text-lg font-bold text-cyan-300 font-mono mt-1">
              ${(dailyRiskStatus.currentEquityUsd || startingEquity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-zinc-500">Live mark-to-market</span>
          </div>

          <div className="p-4 bg-zinc-950/80 rounded-xl border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 uppercase font-mono tracking-wider">Today&apos;s Net P&amp;L</span>
            <div className={`text-lg font-bold font-mono mt-1 ${
              (dailyRiskStatus.dailyPnlUsd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {(dailyRiskStatus.dailyPnlUsd || 0) >= 0 ? '+' : ''}
              ${(dailyRiskStatus.dailyPnlUsd || 0).toFixed(2)}{' '}
              <span className="text-xs font-normal">
                ({(dailyRiskStatus.dailyPnlPercent || 0) >= 0 ? '+' : ''}{(dailyRiskStatus.dailyPnlPercent || 0).toFixed(2)}%)
              </span>
            </div>
            <span className="text-[11px] text-zinc-500">Realized + Unrealized</span>
          </div>

          <div className="p-4 bg-zinc-950/80 rounded-xl border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 uppercase font-mono tracking-wider">Breaker Threshold</span>
            <div className="text-lg font-bold text-amber-400 font-mono mt-1">
              -{dailyStopLoss.toFixed(1)}% (${calculatedMaxLossUsd})
            </div>
            <span className="text-[11px] text-zinc-500">Max loss before lockout</span>
          </div>
        </div>

        {/* Visual Drawdown Gauge Bar */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Daily Drawdown Budget Usage
            </span>
            <span className={`font-bold ${
              dailyRiskStatus.isDailyStopLossTriggered
                ? 'text-rose-400'
                : (dailyRiskStatus.drawdownUsagePercent || 0) > 75
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}>
              {(dailyRiskStatus.drawdownUsagePercent || 0).toFixed(1)}% of allowance consumed
            </span>
          </div>
          <div className="w-full h-3 bg-zinc-950 rounded-full border border-zinc-800 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-500 ${
                dailyRiskStatus.isDailyStopLossTriggered
                  ? 'bg-rose-500'
                  : (dailyRiskStatus.drawdownUsagePercent || 0) > 75
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.max(2, Math.min(100, dailyRiskStatus.drawdownUsagePercent || 0))}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
            <span>$0.00 Drawdown</span>
            <span>50% Budget (-{(dailyStopLoss / 2).toFixed(1)}%)</span>
            <span className="text-rose-400 font-bold">Circuit Breaker (-{dailyStopLoss.toFixed(1)}% / -${calculatedMaxLossUsd})</span>
          </div>
        </div>

        {/* Alert box if Breaker is Tripped */}
        {dailyRiskStatus.isDailyStopLossTriggered && (
          <div className="mt-4 p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-sm text-rose-300">
                Daily Stop-Loss Circuit Breaker is Active
              </div>
              <p className="text-rose-200/90 leading-relaxed">
                {dailyRiskStatus.circuitBreakerReason ||
                  `The portfolio has exceeded the configured -${dailyStopLoss}% daily drawdown threshold. All automated Autopilot entries have been halted to protect remaining capital.`}
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onResetCircuitBreaker}
                  className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-lg text-xs transition"
                >
                  Reset Circuit Breaker &amp; Re-anchor Baseline
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Parameters Configuration Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PARAMETER 1: DAILY STOP-LOSS PERCENTAGE */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Daily Stop-Loss Percentage</h3>
                <p className="text-xs text-zinc-400">Maximum account loss allowed in a 24h trading day</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 font-mono font-bold text-sm">
              -{dailyStopLoss.toFixed(1)}%
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Conservative (1%)</span>
              <span>Standard (5%)</span>
              <span>Aggressive (20%)</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="20.0"
              step="0.5"
              value={dailyStopLoss}
              onChange={(e) => setDailyStopLoss(parseFloat(e.target.value))}
              className="w-full accent-rose-500 h-2 bg-zinc-950 rounded-lg cursor-pointer"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase text-zinc-400">Quick Presets:</span>
            <div className="flex flex-wrap gap-2">
              {stopLossPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDailyStopLoss(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition border ${
                    dailyStopLoss === preset
                      ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  {preset.toFixed(1)}% {preset === 5.0 && '(Default)'}
                </button>
              ))}
            </div>
          </div>

          {/* Direct Input Field & Live Dollar Impact */}
          <div className="p-4 bg-zinc-950/70 rounded-xl border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Custom Value:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0.5"
                  max="50.0"
                  step="0.5"
                  value={dailyStopLoss}
                  onChange={(e) => setDailyStopLoss(Math.max(0.5, Math.min(50, parseFloat(e.target.value) || 0.5)))}
                  className="w-20 px-2.5 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-right font-mono text-xs font-bold text-white focus:outline-none focus:border-rose-500"
                />
                <span className="font-mono text-zinc-400 font-bold">%</span>
              </div>
            </div>
            <div className="text-[11px] text-zinc-400 leading-relaxed pt-1 border-t border-zinc-800/60">
              💡 <strong>Impact:</strong> On your current benchmark equity of{' '}
              <strong className="text-white">${startingEquity.toFixed(2)}</strong>, the autopilot engine will trip if daily losses reach{' '}
              <strong className="text-rose-400">-${calculatedMaxLossUsd} USD</strong>.
            </div>
          </div>
        </div>

        {/* PARAMETER 2: MAXIMUM SLIPPAGE TOLERANCE FOR AUTOPILOT */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Maximum Slippage Tolerance</h3>
                <p className="text-xs text-zinc-400">Execution tolerance for automated Jupiter DEX routing</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-cyan-950/40 border border-cyan-800/60 rounded-xl text-cyan-300 font-mono font-bold text-sm">
              {maxSlippage.toFixed(1)}%
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Strict (0.1%)</span>
              <span>Recommended (1.0%)</span>
              <span>Volatile (5.0%)</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.1"
              value={maxSlippage}
              onChange={(e) => setMaxSlippage(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 h-2 bg-zinc-950 rounded-lg cursor-pointer"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase text-zinc-400">Quick Presets:</span>
            <div className="flex flex-wrap gap-2">
              {slippagePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMaxSlippage(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition border ${
                    maxSlippage === preset
                      ? 'bg-cyan-600 text-white border-cyan-500 shadow-md'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  {preset.toFixed(1)}% {preset === 1.0 && '(Recommended)'}
                </button>
              ))}
            </div>
          </div>

          {/* Direct Input Field & Technical Clarification */}
          <div className="p-4 bg-zinc-950/70 rounded-xl border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Custom Value:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0.1"
                  max="10.0"
                  step="0.1"
                  value={maxSlippage}
                  onChange={(e) => setMaxSlippage(Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 0.1)))}
                  className="w-20 px-2.5 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-right font-mono text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                />
                <span className="font-mono text-zinc-400 font-bold">%</span>
              </div>
            </div>
            <div className="text-[11px] text-zinc-400 leading-relaxed pt-1 border-t border-zinc-800/60">
              🛡️ <strong>MEV &amp; Liquidity Guard:</strong> Autopilot enforces a maximum{' '}
              <strong className="text-cyan-400">{maxSlippage.toFixed(1)}%</strong> slippage on Jupiter swap routes. Any automated trade exceeding this ceiling is automatically rejected to avoid sandwich attacks.
            </div>
          </div>
        </div>

        {/* PARAMETER 3: PER-POSITION STOP-LOSS & RISK SIZING */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Default Per-Trade Stop-Loss</h3>
                <p className="text-xs text-zinc-400">Stop-loss level initialized on every new autopilot entry</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-purple-950/40 border border-purple-800/60 rounded-xl text-purple-300 font-mono font-bold text-sm">
              -{positionStopLoss.toFixed(1)}%
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Tight (3%)</span>
              <span>Standard (10%)</span>
              <span>Wide (25%)</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="25.0"
              step="1.0"
              value={positionStopLoss}
              onChange={(e) => setPositionStopLoss(parseFloat(e.target.value))}
              className="w-full accent-purple-500 h-2 bg-zinc-950 rounded-lg cursor-pointer"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {positionSlPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPositionStopLoss(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition border ${
                  positionStopLoss === preset
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                    : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white'
                }`}
              >
                -{preset.toFixed(1)}% {preset === 5.0 && '(Strict Default)'}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-zinc-400 bg-zinc-950/70 p-3.5 rounded-xl border border-zinc-800/80 leading-relaxed">
            Position entries calculate automatic order size based on this ratio so individual trade risk is strictly capped at{' '}
            <strong className="text-white">{(maxRiskPerTrade * 100).toFixed(1)} bps (0.5% equity)</strong>.
          </div>
        </div>

        {/* PARAMETER 4: AUTO-CLOSE ON BREAKER & ACTIONS */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Circuit Breaker Actions</h3>
                <p className="text-xs text-zinc-400">Execution rules when daily stop loss threshold is breached</p>
              </div>
            </div>

            <label className="flex items-start gap-3 p-4 bg-zinc-950/70 rounded-xl border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition">
              <input
                type="checkbox"
                checked={autoCloseOnBreaker}
                onChange={(e) => setAutoCloseOnBreaker(e.target.checked)}
                className="mt-0.5 accent-cyan-500 rounded w-4 h-4"
              />
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-white block">
                  Auto-close open positions when daily stop-loss is reached
                </span>
                <span className="text-zinc-400 block leading-relaxed">
                  When enabled, tripping the circuit breaker immediately liquidates all remaining active positions to lock in capital and prevent overnight gap risk.
                </span>
              </div>
            </label>
          </div>

          {/* Test Circuit Breaker Simulation Button */}
          {onTestCircuitBreaker && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onTestCircuitBreaker}
                className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-amber-300 border border-zinc-800 rounded-xl text-xs font-mono transition flex items-center justify-center gap-1.5"
                title="Test and verify the circuit breaker safeguard mechanism in simulated mode"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Simulate Circuit Breaker Halt</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer: Save & Apply Button */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            Changes are saved locally and immediately enforced on all 15-minute autopilot cycle ticks.
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-extrabold rounded-xl text-xs transition shadow-lg shadow-cyan-950/50 flex items-center gap-1.5"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-black" />
                <span>Parameters Applied!</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-black" />
                <span>Save &amp; Apply to Autopilot Engine</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
