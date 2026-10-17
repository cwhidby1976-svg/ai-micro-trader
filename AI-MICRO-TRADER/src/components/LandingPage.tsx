import React, { useState } from 'react';
import {
  Laptop,
  Smartphone,
  Key,
  Shield,
  Zap,
  Activity,
  Cpu,
  Wallet,
  Download,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronRight,
  ExternalLink,
  Lock,
  Sparkles,
  HelpCircle,
  QrCode,
  ArrowRight,
  X,
  Layers,
  TrendingUp,
  Check,
  User,
  Star,
  Clock,
  KeyRound
} from 'lucide-react';
import { ClientLicenseState, licensingService } from '../services/licensingService';
import { navigatePublicPath } from './RiskDisclaimer';

interface LandingPageProps {
  licenseState: ClientLicenseState;
  onOpenAdmin: () => void;
  onEnterDashboard?: () => void;
  onOpenMemberPortal?: () => void;
  onEnterDemoMode?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  licenseState,
  onOpenAdmin,
  onEnterDashboard,
  onOpenMemberPortal,
  onEnterDemoMode,
}) => {
  // Navigation active tab
  const [activeNav, setActiveNav] = useState<'home' | 'features' | 'pricing' | 'how-it-works'>('home');

  // Download Modals
  const [downloadModal, setDownloadModal] = useState<'windows' | 'android' | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(() => new URLSearchParams(window.location.search).get("desktop") === "1");

  // Activation Input
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [activateLoading, setActivateLoading] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activateSuccess, setActivateSuccess] = useState<string | null>(null);

  // Request Access Form
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqHandle, setReqHandle] = useState('');
  const [reqPlan, setReqPlan] = useState<'Trial' | 'Annual' | 'Lifetime'>('Trial');
  const [reqSuccess, setReqSuccess] = useState(false);
  const [reqGeneratedKey, setReqGeneratedKey] = useState<string | null>(null);
  const [reqSecondaryKey, setReqSecondaryKey] = useState<string | null>(null);

  const handleFormatCode = (val: string) => {
    const raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let formatted = raw;
    if (raw.length > 3) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    }
    if (raw.length > 7) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
    }
    if (raw.length > 11) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}-${raw.slice(11, 15)}`;
    }
    setAccessCodeInput(formatted.slice(0, 19));
    setActivateError(null);
  };

  const handleActivate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!accessCodeInput.trim()) {
      setActivateError('Please enter an access code.');
      return;
    }

    setActivateLoading(true);
    setActivateError(null);
    setActivateSuccess(null);

    const res = await licensingService.activate(accessCodeInput);
    setActivateLoading(false);

    if (res.success) {
      setActivateSuccess('Access code verified! Launching trading terminal...');
      if (onEnterDashboard) {
        setTimeout(onEnterDashboard, 800);
      }
    } else {
      setActivateError(res.error || 'Activation failed');
    }
  };

  const handleDownloadFile = (platform: 'windows' | 'android') => {
    if (platform === 'windows') {
      window.location.assign('/downloads/AI-Micro-Trader-LICENSING-TEST-Setup-0.2.1.exe');
      return;
    }
    window.alert('Android installer is not available yet. Please check back for the official release.');
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reqPlan === 'Annual' || reqPlan === 'Lifetime') {
      setShowRequestModal(false);
      onOpenMemberPortal?.();
      window.alert('Annual and Lifetime keys are issued only after verified SOL payment in User Login, or by an administrator. Opening the member portal.');
      return;
    }
    try {
      const res = await fetch('/api/license/request-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reqName,
          email: reqEmail,
          plan: 'Trial',
          solanaWallet: reqHandle,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReqGeneratedKey(data.primaryKey);
        setReqSecondaryKey(null);
        setReqSuccess(true);
        return;
      }
      window.alert(data.error || 'Unable to issue a trial access key.');
    } catch (err) {
      console.error('License request failed:', err);
      window.alert('Unable to issue an access key. Please try again later or contact support.');
    }
    setReqSuccess(false);
    setReqGeneratedKey(null);
    setReqSecondaryKey(null);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* 1. TOP HEADER NAVIGATION BAR (MATCHES USER PHOTO) */}
      <header className="sticky top-0 z-40 bg-[#080b11]/95 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo & NextGen Traders Hub Badge */}
          <div className="flex items-center gap-3">
            <img
              src="/ai-micro-trader-icon-1024.png"
              alt="NextGen Traders Hub Logo"
              className="w-10 h-10 rounded-full border border-emerald-500/40 shadow-lg shadow-emerald-500/20 object-cover"
              onError={(e) => {
                // fallback to svg if jpg not yet loaded
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <div className="font-extrabold text-base tracking-wider text-white flex items-center gap-2">
                AI MICRO TRADER
              </div>
              <div className="text-[11px] font-medium text-emerald-400 tracking-wide">
                Powered by NextGen Traders Hub
              </div>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold">
            <button
              onClick={() => {
                setActiveNav('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`transition ${
                activeNav === 'home'
                  ? 'text-white border-b-2 border-emerald-400 pb-1'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => {
                setActiveNav('features');
                document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`transition ${
                activeNav === 'features'
                  ? 'text-white border-b-2 border-emerald-400 pb-1'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Features
            </button>
            <button
              onClick={() => {
                setActiveNav('pricing');
                document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`transition ${
                activeNav === 'pricing'
                  ? 'text-white border-b-2 border-emerald-400 pb-1'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Plans & Keys
            </button>
            <button
              onClick={() => {
                setActiveNav('how-it-works');
                document
                  .getElementById('how-it-works-section')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`transition ${
                activeNav === 'how-it-works'
                  ? 'text-white border-b-2 border-emerald-400 pb-1'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              How It Works
            </button>
            <a
              href="/disclaimer"
              onClick={(e) => {
                e.preventDefault();
                navigatePublicPath('/disclaimer');
              }}
              className="hidden xl:inline text-zinc-400 hover:text-white transition"
            >
              Risk Disclaimer
            </a>
          </nav>

          {/* Right Action Buttons (Windows, Android, Request Access, Launch Terminal, User Login) */}
          <div className="flex items-center gap-2">
            {/* Windows Download Button */}
            <button
              onClick={() => setDownloadModal('windows')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078D7] hover:bg-[#006cc2] text-white font-semibold text-xs transition shadow-md shadow-blue-500/20"
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Windows</span>
            </button>

            {/* Android Download Button */}
            <button
              onClick={() => setDownloadModal('android')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E7D32] hover:bg-[#256629] text-white font-semibold text-xs transition shadow-md shadow-emerald-500/20"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android</span>
            </button>

            {/* Launch Web Terminal Button (Demo Mode & Live Trading) */}
            <button
              onClick={() => { onEnterDemoMode?.(); }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold text-xs transition shadow-md shadow-emerald-500/30"
              title="Launch Trading Terminal (Demo Paper Mode & Live Trading)"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Launch Terminal</span>
            </button>

            {/* User Login / Member Portal Tab */}
            <button
              onClick={onOpenMemberPortal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-cyan-300 hover:text-white border border-cyan-500/40 rounded-lg text-xs font-bold transition shadow-sm"
              title="User Login / Member Account Portal"
            >
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>Member Account</span>
            </button>
          </div>
        </div>
      </header>

      {/* LIVE NETWORK & PROTOCOL STATUS TICKER */}
      <div className="bg-[#05070b] border-b border-zinc-800/80 px-4 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-evenly gap-3 text-[13px] text-zinc-300 whitespace-nowrap overflow-hidden">
          <div className="flex items-center justify-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold">Solana Mainnet:</span>
          </div>
          <span className="h-4 w-px bg-zinc-700 shrink-0" />
          <div className="flex items-center justify-center gap-2 shrink-0">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">Jupiter v6 Aggregator:</span>
          </div>
          <span className="h-4 w-px bg-zinc-700 shrink-0" />
          <div className="flex items-center justify-center gap-2 shrink-0">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">GoPlus Contract Auditing:</span>
          </div>
          <span className="h-4 w-px bg-zinc-700 shrink-0" />
          <span className="shrink-0 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-[12px]">
            Production Release v2.6 Stable
          </span>
        </div>
      </div>

      {/* 2. HERO SECTION */}
      <section className="relative px-4 lg:px-8 pt-8 pb-16 overflow-hidden">
        {/* Cyber Neon Glow in background */}
        <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-rose-500/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          {/* Full-width graphic banner and feature highlights */}
          <div className="w-full flex flex-col items-center">
            {/* Fixed, full-width brand banner */}
            <div className="relative w-full rounded-2xl overflow-hidden border-2 border-zinc-800/90 bg-zinc-950 shadow-2xl shadow-emerald-950/30">
              <img
                src="/ai-micro-trader-banner.png"
                alt="NextGen Traders Hub AI Micro Trader Graphic"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="w-full h-auto object-contain rounded-xl select-none pointer-events-none"
              />

            </div>

            {/* 4 Feature Pills Beneath the Graphic */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mt-4">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-white tracking-wider">
                    AI Powered
                  </div>
                  <div className="text-[10px] text-zinc-400">Scanning</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-white tracking-wider">
                    Real-Time
                  </div>
                  <div className="text-[10px] text-zinc-400">Signals</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur">
                <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-white tracking-wider">
                    Automated
                  </div>
                  <div className="text-[10px] text-zinc-400">Strategies</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-white tracking-wider">
                    Your Wallet
                  </div>
                  <div className="text-[10px] text-zinc-400">Your Control</div>
                </div>
              </div>
            </div>
          </div>

          {/* Information, actions and license verification below banner */}
          <div className="w-full max-w-4xl mx-auto flex flex-col items-center text-center space-y-6">
            <div>
              <div className="inline-block text-xs font-mono font-bold tracking-widest uppercase text-cyan-400 mb-2">
                AI-POWERED SOLANA TRADING
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.12]">
                The Market Never Sleeps.{' '}
                <span className="text-[#00E676] drop-shadow-[0_0_25px_rgba(0,230,118,0.35)]">
                  Stay Ready.
                </span>
              </h1>
              <p className="text-sm sm:text-base font-bold text-zinc-200 mt-2">
                Discover opportunities. Analyze with intelligence. Trade with a strategy.
              </p>
            </div>

            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-normal">
              AI Micro Trader brings Solana market monitoring, eight-point ICC analysis, and automated trading technology together in one powerful platform—designed to help you evaluate opportunities and manage trades around the clock.
            </p>

            <div className="text-xs sm:text-sm font-semibold text-emerald-400 tracking-wide font-mono flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Your Strategy. Your Control. Your Next Move.</span>
            </div>

            {/* Direct Execution & Download CTAs */}
            <div className="space-y-2.5 pt-2 w-full max-w-2xl">
              <button
                onClick={() => { onEnterDemoMode?.(); }}
                className="w-full py-3.5 px-5 rounded-xl font-extrabold text-sm bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 group"
              >
                <Zap className="w-4 h-4 text-black group-hover:scale-110 transition" />
                <span>LAUNCH TRADING TERMINAL</span>
                <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition" />
              </button>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setDownloadModal('windows')}
                  className="flex-1 py-3 px-3 rounded-xl font-bold text-xs bg-[#0078D7] hover:bg-[#006cc2] text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 group"
                >
                  <Laptop className="w-3.5 h-3.5 group-hover:scale-110 transition" />
                  <span>WINDOWS (.EXE)</span>
                </button>

                <button
                  onClick={() => setDownloadModal('android')}
                  className="flex-1 py-3 px-3 rounded-xl font-bold text-xs bg-[#2E7D32] hover:bg-[#256629] text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 group"
                >
                  <Smartphone className="w-3.5 h-3.5 group-hover:scale-110 transition" />
                  <span>ANDROID (.APK)</span>
                </button>
              </div>
            </div>

            {/* License Key Verification Box */}
            <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3 w-full max-w-2xl text-left">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                    Hardware-Bound License Verification:
                  </span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Paste your 16-character license key to bind and unlock this device.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(true)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold hover:underline flex items-center gap-1 shrink-0 ml-2"
                >
                  <span>Request Key</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={accessCodeInput}
                  onChange={(e) => handleFormatCode(e.target.value)}
                  placeholder="MTR-XXXX-XXXX-XXXX"
                  className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg font-mono text-xs text-cyan-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
                />
                <button
                  onClick={() => handleActivate()}
                  disabled={activateLoading || !accessCodeInput.trim()}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold text-xs rounded-lg transition"
                >
                  {activateLoading ? 'Checking...' : 'Unlock App'}
                </button>
              </div>

              {activateError && (
                <div className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{activateError}</span>
                </div>
              )}
              {activateSuccess && (
                <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{activateSuccess}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. HARDWARE PACKAGING & DOWNLOAD SECTION (WINDOWS & ANDROID TABS) */}
      <section className="px-4 lg:px-8 py-12 bg-zinc-950/60 border-t border-zinc-800/80">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Official Client Applications
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2">
              Hardware-bound execution terminals engineered specifically for Windows desktop trading
              rigs and Android mobile execution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Windows Card */}
            <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-blue-500/50 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                    <Laptop className="w-6 h-6 text-[#0078D7]" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    v2.6 Stable • 64-bit
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">Windows Terminal Edition</h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  Full multi-monitor workstation suite with hardware-accelerated charting, low-latency
                  Solana RPC nodes, and local cryptographic token validation.
                </p>
                <div className="mt-4 space-y-1.5 text-xs font-mono text-zinc-400">
                  <div className="flex justify-between">
                    <span>OS Support:</span>
                    <span className="text-zinc-200">Windows 10 / 11 (x64)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>License:</span>
                    <span className="text-cyan-400">Verification Pending</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Release Status:</span>
                    <span className="text-zinc-200">Pending Verification</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setDownloadModal('windows')}
                  className="flex-1 py-3 bg-[#0078D7] hover:bg-[#006cc2] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Windows TEST (.exe)</span>
                </button>
                <button
                  onClick={() => setDownloadModal('windows')}
                  className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
                  title="Windows Release Information"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Android Card */}
            <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-emerald-500/50 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-[#2E7D32]" />
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    v2.6 Android APK
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">Android Mobile Terminal</h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  Real-time push alerts for high-conviction Solana meme breakouts, touch-optimized
                  Jupiter swaps, and background position monitoring.
                </p>
                <div className="mt-4 space-y-1.5 text-xs font-mono text-zinc-400">
                  <div className="flex justify-between">
                    <span>OS Support:</span>
                    <span className="text-zinc-200">Android 9.0+ (ARM64)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>License:</span>
                    <span className="text-emerald-400">Verification Pending</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Release Status:</span>
                    <span className="text-zinc-200">Pending Verification</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setDownloadModal('android')}
                  className="flex-1 py-3 bg-[#2E7D32] hover:bg-[#256629] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow"
                >
                  <Download className="w-4 h-4" />
                  <span>Android - Release Pending</span>
                </button>
                <button
                  onClick={() => setDownloadModal('android')}
                  className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
                  title="Android Release Information"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FEATURES SECTION */}
      <section id="features-section" className="px-4 lg:px-8 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono font-bold uppercase text-emerald-400 tracking-wider">
              Core Capabilities
            </span>
            <h2 className="text-3xl font-extrabold text-white mt-1">
              Built for High-Frequency Solana Markets
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2">
              Engineered by NextGen Traders Hub to identify explosive micro-caps before they migrate
              to primary DEX liquidity pools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4">
                <Activity className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-base font-bold text-white">Solana Meme Coin Scanner</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Live stream of newly initialized pairs, bonding curve progression (0-100%), 5m volume
                velocity, and liquidity depth filtering.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white">GoPlus Automated Audits</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Instant honeypot verification, mint authority status, freeze authority revocation,
                liquidity lock verification, and top 10 holders risk scoring.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-base font-bold text-white">ICC Triple-Phase Strategy</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Automated trade signals filtering for Initial Impulse breakouts, Healthy
                Consolidation ranges, and High-Volume Continuation setups.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. MEMBERSHIP TIERS & KEY ALLOCATIONS (1-DAY TRIAL, ANNUAL 1 KEY, LIFETIME 2 KEYS) */}
      <section id="pricing-section" className="px-4 lg:px-8 py-16 bg-[#06080d] border-t border-zinc-800/80">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono font-bold uppercase text-cyan-400 tracking-wider">
              Membership Plans & Key Allocations
            </span>
            <h2 className="text-3xl font-extrabold text-white mt-1">
              Select Your Access Tier
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2">
              Cryptographically signed hardware-bound licenses. Compare Autopilot permissions and key limits below.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
            {/* Card 1: 1-Day Free Trial */}
            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-amber-500/50 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                    1-Day Free Trial (24h)
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">1 Device Key</span>
                </div>

                <div className="mb-4">
                  <div className="text-3xl font-black text-white">$0 <span className="text-xs font-normal text-zinc-400">/ 24 Hours</span></div>
                  <p className="text-xs text-zinc-400 mt-1">Full evaluation pass for new Solana traders.</p>
                </div>

                {/* Key lock notice */}
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 mb-5 text-xs text-amber-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Autopilot Mode: LOCKED</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-normal">
                    Users must trade <strong>manually only</strong>. Automated 15-minute engine cycles require an active Paid Subscription.
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs text-zinc-300 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>1 Machine License Key (Single Device)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Real-Time Solana Meme Coin Scanner</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>GoPlus Automated Token Audits</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Jupiter DEX Manual Swap Terminal</span>
                  </li>
                  <li className="flex items-center gap-2 text-zinc-500">
                    <X className="w-4 h-4 text-zinc-600 shrink-0" />
                    <span className="line-through">15-Minute Impulse Cycle Autopilot</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => {
                  setReqPlan('Trial');
                  setShowRequestModal(true);
                }}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <span>Request 1-Day Trial (1 Key)</span>
              </button>
            </div>

            {/* Card 2: Annual Subscription */}
            <div className="p-6 rounded-2xl bg-zinc-900/80 border border-cyan-500/40 hover:border-cyan-400 transition flex flex-col justify-between shadow-xl shadow-cyan-950/20">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-bold">
                    Annual Pro (365d)
                  </span>
                  <span className="text-[11px] font-mono text-cyan-400 font-semibold">Offers 1 Key Only</span>
                </div>

                <div className="mb-4">
                  <div className="text-3xl font-black text-white">Annual <span className="text-xs font-normal text-zinc-400">/ 365 Days Access</span></div>
                  <p className="text-xs text-zinc-400 mt-1">Single-seat dedicated professional workstation rig.</p>
                </div>

                {/* Key unlock notice */}
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 mb-5 text-xs text-cyan-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Autopilot Mode: FULLY UNLOCKED</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-normal">
                    Automated 15-minute impulse cycles execute 3–5 high-conviction trades every cycle with trailing stop-loss.
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs text-zinc-300 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-semibold text-white">Offers 1 Access Key Only (1 Machine)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Full 15-Minute Autopilot Cycle Execution</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Triple-Phase ICC Momentum Breakouts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Automated Trailing Stop & Profit Margin Lock</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Standard Solana RPC Node Speed</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => {
                  onOpenMemberPortal?.();
                }}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-1.5"
              >
                <span>Get Annual Access (1 Key)</span>
              </button>
            </div>

            {/* Card 3: Lifetime Subscription */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-emerald-500/60 hover:border-emerald-400 transition flex flex-col justify-between shadow-2xl shadow-emerald-950/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-500 to-teal-500 text-black text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                Founder VIP • 2 Keys
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold flex items-center gap-1">
                    <Star className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                    Lifetime Access
                  </span>
                  <span className="text-[11px] font-mono text-emerald-300 font-bold">Gets 2 Keys Included</span>
                </div>

                <div className="mb-4">
                  <div className="text-3xl font-black text-white">Lifetime <span className="text-xs font-normal text-zinc-400">/ Permanent VIP</span></div>
                  <p className="text-xs text-zinc-400 mt-1">Multi-machine trading rig & mobile simultaneous access.</p>
                </div>

                {/* Key unlock notice */}
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 mb-5 text-xs text-emerald-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>2 Keys Included • Full Autopilot Unlocked</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-normal">
                    Run the bot concurrently on <strong>2 separate machines</strong> (e.g. desktop workstation + laptop or phone) with full autopilot.
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs text-zinc-300 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold text-white">Gets 2 License Keys Included (2 Machines)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Full Autopilot Mode Unlocked Forever</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Concurrent Desktop & Mobile Terminal Execution</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Turbo Priority Solana RPC & Zero Slippage Guards</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Lifetime Future Version Upgrades Included</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => {
                  onOpenMemberPortal?.();
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-xs rounded-xl transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Get Lifetime Access (2 Keys)</span>
              </button>
            </div>
          </div>

          {/* HOW USERS GET THEIR KEYS WALKTHROUGH */}
          <div className="mt-12 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 max-w-4xl mx-auto">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              <span>How Do Users Get Their License Key?</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-6">
              Trial keys can be requested here. Paid Annual and Lifetime keys are issued only after verified SOL payment or by an administrator.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-[11px]">1</div>
                <div className="font-semibold text-white">Select Plan & Info</div>
                <div className="text-zinc-400 text-[11px]">Request a 1-day trial, or register in User Login for paid checkout.</div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[11px]">2</div>
                <div className="font-semibold text-white">Key Delivery</div>
                <div className="text-zinc-400 text-[11px]">Trial codes appear on-screen. Paid keys appear only after verified payment or admin issuance.</div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[11px]">3</div>
                <div className="font-semibold text-white">Bind to Hardware</div>
                <div className="text-zinc-400 text-[11px]">Paste your key into the Windows app, Android APK, or Web Terminal to activate.</div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-[11px]">4</div>
                <div className="font-semibold text-white">User Login Portal</div>
                <div className="text-zinc-400 text-[11px]">Sign in to the User Login tab anytime to retrieve your keys, check expiry, and manage devices.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. HOW IT WORKS SECTION */}
      <section
        id="how-it-works-section"
        className="px-4 lg:px-8 py-16 bg-zinc-950/70 border-t border-zinc-800/80"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono font-bold uppercase text-amber-400 tracking-wider">
              Activation Workflow
            </span>
            <h2 className="text-3xl font-extrabold text-white mt-1">
              From Download to Execution in 3 Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 font-extrabold text-base flex items-center justify-center mb-4">
                1
              </div>
              <h4 className="font-bold text-white text-base">Download the App</h4>
              <p className="text-xs text-zinc-400 mt-2">
                The installer runs the trading engine on this device at a local address (127.0.0.1 and your LAN IP). Keys and licenses stay in your device data folder.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-extrabold text-base flex items-center justify-center mb-4">
                2
              </div>
              <h4 className="font-bold text-white text-base">Enter Access Code</h4>
              <p className="text-xs text-zinc-400 mt-2">
                Input your 16-character cryptographic key. The terminal binds to your hardware and
                unlocks all protected trading feeds.
              </p>
            </div>

            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800">
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-extrabold text-base flex items-center justify-center mb-4">
                3
              </div>
              <h4 className="font-bold text-white text-base">Add your own API keys</h4>
              <p className="text-xs text-zinc-400 mt-2">
                Open dashboard API Setup and enter your Jupiter and GoPlus keys. The app does not ship a shared master key. Quotes and scans use the keys stored on this device.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800/80 bg-[#06080d] px-4 lg:px-8 py-8 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-300">AI MICRO TRADER</span>
            <span>• Powered by NextGen Traders Hub</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/disclaimer"
              onClick={(e) => {
                e.preventDefault();
                navigatePublicPath('/disclaimer');
              }}
              className="text-cyan-400 hover:text-cyan-300 font-semibold transition"
            >
              Risk Disclaimer
            </a>
            <span className="text-zinc-700">|</span>
            {onOpenMemberPortal && (
              <button
                onClick={onOpenMemberPortal}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>Member Account</span>
              </button>
            )}
            <span className="text-zinc-700">|</span>
            <span>support@aimicrotrader.io</span>
            <span className="text-zinc-800">|</span>
            <button
              onClick={onOpenAdmin}
              className="text-zinc-700 hover:text-zinc-500 text-[11px] transition flex items-center gap-1"
              title="Staff Portal (?admin=true)"
            >
              <Lock className="w-2.5 h-2.5" />
              <span>Staff Portal</span>
            </button>
          </div>
        </div>
      </footer>

      {/* WINDOWS DOWNLOAD MODAL */}
      {downloadModal === 'windows' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base">Windows Application</h3>
              <button onClick={() => setDownloadModal(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-cyan-400 font-semibold mb-3">Windows TEST installer v0.2.1</p>
            <p className="text-zinc-300 text-sm leading-relaxed mb-4">
              This is a licensing TEST build for your PC. Live Jupiter trading stays disabled. Windows SmartScreen may warn because the file is unsigned. The official production installer is still pending.
            </p>
            <button
              onClick={() => {
                handleDownloadFile('windows');
                setDownloadModal(null);
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition mb-2"
            >
              Download TEST Setup (.exe)
            </button>
            <button onClick={() => setDownloadModal(null)} className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-xl transition">Close</button>
          </div>
        </div>
      )}

      {/* ANDROID DOWNLOAD MODAL */}
      {downloadModal === 'android' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base">Android Application</h3>
              <button onClick={() => setDownloadModal(null)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-amber-400 font-semibold mb-3">Official Release Pending</p>
            <p className="text-zinc-300 text-sm leading-relaxed mb-5">The official Android installer is not available for download yet. We are verifying the installation package before release. Please check back for availability.</p>
            <button onClick={() => setDownloadModal(null)} className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition">Close</button>
          </div>
        </div>
      )}

      {/* REQUEST ACCESS MODAL */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Request Access Code
              </h3>
              <button
                onClick={() => {
                  setShowRequestModal(false);
                  setReqSuccess(false);
                }}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!reqSuccess ? (
              <form onSubmit={handleRequestSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Full Name</label>
                  <input
                    type="text"
                    required
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    placeholder="Trader Name"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Email Address</label>
                  <input
                    type="email"
                    required
                    value={reqEmail}
                    onChange={(e) => setReqEmail(e.target.value)}
                    placeholder="trader@email.com"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">
                    Telegram or Discord Handle
                  </label>
                  <input
                    type="text"
                    value={reqHandle}
                    onChange={(e) => setReqHandle(e.target.value)}
                    placeholder="@YourHandle"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-medium">Desired Access Plan</label>
                  <select
                    value={reqPlan}
                    onChange={(e) => setReqPlan(e.target.value as 'Trial' | 'Annual' | 'Lifetime')}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-medium"
                  >
              <option value="Trial">1-Day Free Trial (24h) — Manual Trading Only (Autopilot Locked) • 1 Key</option>
              <option value="Annual">Annual Subscription (365d) — Full Autopilot • 1 Key Only</option>
              <option value="Lifetime">Lifetime Subscription (Permanent) — Full Autopilot • 2 Keys Included</option>
                  </select>
                </div>

                {/* Plan Specific Permissions & Key Allocation Notice */}
                {reqPlan === 'Trial' && (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-300 text-xs">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Autopilot Mode: LOCKED (Manual Only)</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-normal">
                      1-Day Trial offers <strong>1 device key for 24 hours</strong>. Autopilot is locked; you can scan tokens and execute manual swaps via Jupiter DEX.
                    </p>
                  </div>
                )}

                {reqPlan === 'Annual' && (
                  <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-cyan-300 text-xs">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Offers 1 Key Only • Full Autopilot Unlocked</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-normal">
                      Annual pass offers <strong>1 dedicated license key</strong> for your primary trading PC. Unlocks automated 15-minute ICC momentum cycles.
                    </p>
                  </div>
                )}

                {reqPlan === 'Lifetime' && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-300 text-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Gets 2 Keys Included • Full Autopilot Unlocked</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-normal">
                      Lifetime VIP tier includes <strong>2 separate license keys</strong> to run on 2 machines concurrently (e.g. desktop workstation + laptop or phone).
                    </p>
                  </div>
                )}

                {/* How user gets their key */}
                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                  <div className="font-semibold text-zinc-300 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                    <span>How Do You Receive Your Key?</span>
                  </div>
                  <p className="leading-relaxed">
                    A 1-day trial key is issued on-screen. Annual and Lifetime keys require verified SOL checkout in User Login or an administrator-issued code.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 bg-[#F59E0B] hover:bg-[#D97706] text-black font-extrabold text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5"
                >
                  <span>{reqPlan === 'Trial' ? 'Submit & Generate Trial Key' : 'Continue to Paid Checkout'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="space-y-4 text-xs text-center py-2">
                <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">License Key Assigned!</h4>
                  <p className="text-zinc-400 text-xs mt-1">
                    {reqPlan === 'Lifetime'
                      ? 'Lifetime VIP: 2 License Keys issued for 2 machines with Full Autopilot.'
                      : reqPlan === 'Annual'
                      ? 'Annual Pro: 1 License Key issued with Full Autopilot.'
                      : '1-Day Trial: 1 License Key issued (24h Manual Trading Only).'}
                  </p>
                </div>

                {/* Primary Key */}
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1.5 text-left">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="font-mono text-zinc-300 font-semibold">
                      {reqPlan === 'Lifetime' ? 'Primary License Key (Machine 1):' : 'Your License Key:'}
                    </span>
                    <span className="text-emerald-400 font-bold">Hardware-Bound</span>
                  </div>
                  <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-cyan-300 text-sm font-bold flex items-center justify-between">
                    <span className="tracking-wider">{reqGeneratedKey}</span>
                    <button
                      onClick={() => {
                        if (reqGeneratedKey) {
                          navigator.clipboard.writeText(reqGeneratedKey);
                          alert('Key 1 copied to clipboard!');
                        }
                      }}
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition"
                      title="Copy Key"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Secondary Key for Lifetime */}
                {reqPlan === 'Lifetime' && reqSecondaryKey && (
                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1.5 text-left">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="font-mono text-zinc-300 font-semibold">
                        Secondary License Key (Machine 2 / Laptop):
                      </span>
                      <span className="text-purple-400 font-bold">2nd Device Seat</span>
                    </div>
                    <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg font-mono text-purple-300 text-sm font-bold flex items-center justify-between">
                      <span className="tracking-wider">{reqSecondaryKey}</span>
                      <button
                        onClick={() => {
                          if (reqSecondaryKey) {
                            navigator.clipboard.writeText(reqSecondaryKey);
                            alert('Key 2 copied to clipboard!');
                          }
                        }}
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition"
                        title="Copy Key 2"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Clear What Next Guide */}
                <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 text-left space-y-1.5 text-[11px] text-zinc-300">
                  <div className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>What Next? Simple 3 Steps to Trade:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-[11px]">
                    <li><strong className="text-zinc-200">Copy your key:</strong> Click the copy button above.</li>
                    <li><strong className="text-zinc-200">Activate:</strong> Click "Apply Key & Unlock Terminal" below or paste it into the Windows (.exe) / Android (.apk) app.</li>
                    <li><strong className="text-zinc-200">Manage anytime:</strong> Use the <strong>User Login</strong> tab with your email to view keys and manage bound machines.</li>
                  </ol>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => {
                      if (reqGeneratedKey) handleFormatCode(reqGeneratedKey);
                      setShowRequestModal(false);
                      setShowUnlockModal(true);
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold rounded-xl transition shadow flex items-center justify-center gap-1.5"
                  >
                    <Key className="w-4 h-4" />
                    <span>Apply Key & Unlock Terminal</span>
                  </button>

                  {onOpenMemberPortal && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowRequestModal(false);
                        onOpenMemberPortal();
                      }}
                      className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Open User Login / Member Portal</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UNLOCK ACCESS CODE MODAL */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                Unlock AI Micro Trader Terminal
              </h3>
              <button
                onClick={() => setShowUnlockModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. TEST-DRIVE DEMO MODE OPTION */}
            <div className="mb-4 p-3.5 bg-gradient-to-r from-amber-500/10 via-zinc-900 to-cyan-500/10 rounded-xl border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Want to test out the system?
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Paper Demo Mode
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Launch the terminal in <strong>Paper Demo Mode</strong>. The scanner streams live Solana meme-coin prices, volume, and liquidity from DexScreener. Trades stay simulated with paper SOL — no Jupiter API key required to watch the market.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowUnlockModal(false);
                  if (onEnterDemoMode) {
                    onEnterDemoMode();
                  } else if (onEnterDashboard) {
                    onEnterDashboard();
                  }
                }}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs rounded-lg transition shadow flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Launch Test-Drive in Demo Mode (Free)</span>
              </button>
            </div>

            <div className="relative flex py-1 items-center mb-4">
              <div className="flex-grow border-t border-zinc-800" />
              <span className="flex-shrink mx-3 text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                Or Unlock Live Terminal With License
              </span>
              <div className="flex-grow border-t border-zinc-800" />
            </div>

            <form onSubmit={handleActivate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  16-Character Access Key
                </label>
                <input
                  type="text"
                  value={accessCodeInput}
                  onChange={(e) => handleFormatCode(e.target.value)}
                  placeholder="MTR-XXXX-XXXX-XXXX"
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl font-mono text-sm tracking-wider text-cyan-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
                />
              </div>

              <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Need a software access key?</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockModal(false);
                    setShowRequestModal(true);
                  }}
                  className="text-cyan-400 hover:underline font-bold flex items-center gap-1"
                >
                  <span>Request Access Pass</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {activateError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{activateError}</span>
                </div>
              )}

              {activateSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{activateSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={activateLoading || !accessCodeInput.trim()}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-black font-extrabold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20"
              >
                {activateLoading ? 'Validating Key...' : 'Activate & Enter Dashboard'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
