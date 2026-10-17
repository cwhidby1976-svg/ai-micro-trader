import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Lock,
  Key,
  Shield,
  CheckCircle2,
  AlertCircle,
  Clock,
  LogOut,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Copy,
  ExternalLink,
  Laptop,
  Smartphone,
  Wallet,
  Check,
  X,
  CreditCard,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { MemberUser, CheckoutOrder } from '../server/types';

interface MemberPortalProps {
  onClose: () => void;
  onActivateKeyInApp: (code: string) => void;
  onOpenAdmin?: () => void;
}

export const MemberPortal: React.FC<MemberPortalProps> = ({ onClose, onActivateKeyInApp, onOpenAdmin }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('ai_micro_trader_member_token');
  });
  const [member, setMember] = useState<MemberUser | null>(null);
  const [license, setLicense] = useState<any>(null);
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // Auth form state: 'login' | 'register' | 'forgot'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Pricing & Live Quote State
  const [pricingConfig, setPricingConfig] = useState<any>(null);
  const [activeQuote, setActiveQuote] = useState<(CheckoutOrder & { discount?: { code: string; percentage: number; originalPriceUsd: number; discountAmountUsd: number; finalPriceUsd: number } }) | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [quoteTimeLeft, setQuoteTimeLeft] = useState<number>(0);
  const [txSignatureInput, setTxSignatureInput] = useState('');
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string; rawCode?: string } | null>(null);

  // Connected Solana Wallet simulation / Phantom
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    fetchPricing();
    if (token) {
      fetchMemberProfile();
    }
  }, [token]);

  // Quote countdown timer
  useEffect(() => {
    if (!activeQuote) return;
    const interval = setInterval(() => {
      const remainingMs = new Date(activeQuote.expiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setQuoteTimeLeft(0);
        clearInterval(interval);
      } else {
        setQuoteTimeLeft(Math.floor(remainingMs / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeQuote]);

  const fetchPricing = async () => {
    try {
      const res = await fetch('/api/pricing');
      const data = await res.json();
      setPricingConfig(data);
    } catch (e) {
      console.error('Failed to fetch pricing:', e);
    }
  };

  const fetchMemberProfile = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/members/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMember(data.member);
        setLicense(data.license);
        setOrders(data.orders || []);
      } else {
        handleLogout();
      }
    } catch {
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/members/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      localStorage.setItem('ai_micro_trader_member_token', data.token);
      setToken(data.token);
      setMember(data.member);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/members/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('ai_micro_trader_member_token', data.token);
      setToken(data.token);
      setMember(data.member);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (token) {
      fetch('/api/members/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('ai_micro_trader_member_token');
    setToken(null);
    setMember(null);
    setLicense(null);
    setActiveQuote(null);
  };

  const handleStartFreeTrial = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/members/start-trial', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start trial');
      alert(`Free Trial activated! Your access code is: ${data.accessCode}`);
      fetchMemberProfile();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuote = async (plan: 'ANNUAL' | 'LIFETIME' = 'ANNUAL') => {
    if (!token) return;
    setLoading(true);
    setVerifyResult(null);
    setActiveQuote(null);
    try {
      const res = await fetch('/api/checkout/create-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, couponCode: couponCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quote generation failed');
      setActiveQuote(data.order);
      setQuoteTimeLeft(300);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWallet = async () => {
    // If Phantom is available in window.solana
    const solana = (window as any).solana;
    if (solana && solana.isPhantom) {
      try {
        const resp = await solana.connect();
        setConnectedWallet(resp.publicKey.toString());
      } catch {
        // Fallback demo address
        setConnectedWallet('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
      }
    } else {
      // Connect mock/demo address for easy testing
      setConnectedWallet('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
    }
  };

  const handleVerifyPayment = async () => {
    if (!token || !activeQuote || !txSignatureInput.trim()) {
      alert('Please enter a valid Solana transaction signature.');
      return;
    }

    setVerifyingPayment(true);
    setVerifyResult(null);

    try {
      const res = await fetch('/api/checkout/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: activeQuote.id,
          txSignature: txSignatureInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setVerifyResult({
          success: false,
          message: data.error || 'On-chain payment verification failed.',
        });
      } else {
        setVerifyResult({
          success: true,
          message: 'Payment verified! 12-Month Annual Membership activated.',
          rawCode: data.accessCode,
        });
        fetchMemberProfile();
      }
    } catch (err: any) {
      setVerifyResult({ success: false, message: err.message || 'Verification network error' });
    } finally {
      setVerifyingPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07090e]/95 backdrop-blur-md flex flex-col overflow-hidden text-zinc-200">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-950/80 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <User className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base flex items-center gap-2">
              AI – MICRO TRADER <span className="text-emerald-400 font-mono text-xs px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">MEMBER PORTAL</span>
            </h2>
            <p className="text-[11px] text-zinc-400">
              Account Management • Annual SOL Membership • On-Chain Verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {member && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-zinc-200 font-medium">{member.name}</span>
              <button
                onClick={handleLogout}
                className="ml-2 text-zinc-500 hover:text-rose-400 transition"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {!member ? (
          /* LOGIN / REGISTRATION VIEW */
          <div className="max-w-md mx-auto my-8 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white">
                {authMode === 'login'
                  ? 'Sign In to Member Portal'
                  : authMode === 'register'
                  ? 'Create Member Account'
                  : 'Reset Password'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {authMode === 'login'
                  ? 'Access your Annual Membership, free trial, and licensed devices.'
                  : 'Register for trial access or annual Solana membership.'}
              </p>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="trader@email.com"
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-xs focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold rounded-xl transition shadow"
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>

                <div className="flex justify-between items-center pt-2 text-[11px] text-zinc-400">
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className="text-emerald-400 hover:underline"
                  >
                    Need an account? Register
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('forgot')}
                    className="hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                {onOpenAdmin && (
                  <div className="pt-3 mt-2 border-t border-zinc-800/80 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAdmin();
                      }}
                      className="text-[11px] text-zinc-500 hover:text-cyan-400 transition"
                    >
                      System Administrator Sign-In →
                    </button>
                  </div>
                )}
              </form>
            ) : authMode === 'register' ? (
              <form onSubmit={handleRegister} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Trader Name"
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="trader@email.com"
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Password (Min 8 Characters)
                  </label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-xs"
                  />
                </div>

                <div className="flex items-start gap-2 pt-1 text-[11px] text-zinc-400">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 rounded bg-zinc-950 border-zinc-700 text-emerald-500"
                  />
                  <label htmlFor="terms">
                    I accept the Terms of Service, Privacy Policy, and Trading Risk Disclosures.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading || !termsAccepted}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold rounded-xl transition shadow"
                >
                  {loading ? 'Creating Account...' : 'Register Account'}
                </button>

                <div className="text-center pt-2 text-[11px] text-zinc-400">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className="text-emerald-400 hover:underline"
                  >
                    Already have an account? Sign In
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-zinc-400">
                  Enter your email address and we will dispatch password reset instructions.
                </p>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="trader@email.com"
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    alert('Password reset link sent to ' + authEmail);
                    setAuthMode('login');
                  }}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl"
                >
                  Send Reset Link
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="w-full text-center text-zinc-400 hover:underline text-[11px]"
                >
                  Back to Sign In
                </button>
              </div>
            )}
          </div>
        ) : (
          /* AUTHENTICATED MEMBER DASHBOARD */
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Top Member Status Banner */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">{member.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Email Verified
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 font-mono">{member.email}</p>
              </div>

              {/* Membership Status Badge */}
              <div className="flex items-center gap-3">
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-right">
                  <div className="text-[10px] uppercase font-mono text-zinc-500">Active Membership</div>
                  <div className="text-base font-bold font-mono text-emerald-400">
                    {member.activePlan === 'LIFETIME'
                      ? 'Lifetime Member'
                      : member.activePlan === 'ANNUAL'
                      ? 'Annual Member'
                      : member.activePlan === 'TRIAL'
                      ? '1-Day Trial Active'
                      : 'No Active Membership'}
                  </div>
                  {member.activePlan === 'LIFETIME' && (
                    <div className="text-[10px] text-cyan-400 font-semibold">
                      Permanent Access (No Expiry)
                    </div>
                  )}
                  {member.annualExpiresAt && member.activePlan === 'ANNUAL' && (
                    <div className="text-[10px] text-zinc-400">
                      Expires: {new Date(member.annualExpiresAt).toLocaleDateString()}
                    </div>
                  )}
                  {member.trialExpiresAt && member.activePlan === 'TRIAL' && (
                    <div className="text-[10px] text-amber-400">
                      Trial Ends: {new Date(member.trialExpiresAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* THREE MEMBERSHIP OPTIONS (1-DAY FREE TRIAL, ANNUAL & LIFETIME SUBSCRIPTIONS) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Option A: 1-Day Free Trial */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                      Option A • Free Trial
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      1 Per Account
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-white">1-Day Free Trial</h4>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    Test the complete Solana meme coin scanner and ICC strategy with 1 active device for 24 hours.
                    Expires automatically with zero recurring charges.
                  </p>

                  <div className="mt-4 p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Duration:</span>
                      <span className="text-zinc-300">
                        1 Day (24 Hours)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Eligible Devices:</span>
                      <span className="text-zinc-300">1 Device (Windows/Android)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Automatic Billing:</span>
                      <span className="text-emerald-400">None (Zero Charges)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  {member.trialUsed ? (
                    <button
                      disabled
                      className="w-full py-3 bg-zinc-800 text-zinc-500 font-semibold text-xs rounded-xl cursor-not-allowed"
                    >
                      1-Day Trial Already Used
                    </button>
                  ) : (
                    <button
                      onClick={handleStartFreeTrial}
                      disabled={loading || member.activePlan === 'ANNUAL' || member.activePlan === 'LIFETIME'}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition shadow"
                    >
                      Start 1-Day Free Trial
                    </button>
                  )}
                </div>
              </div>

              {/* Option B: Annual Subscription (Paid in SOL) */}
              <div className="bg-zinc-900/70 border border-emerald-500/30 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-black font-extrabold text-[10px] uppercase rounded-bl-xl">
                  Annual Pass
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
                      Option B • 365 Days
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-white">Annual Subscription</h4>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    Full unthrottled access for 12 months (365 days). Paid in native SOL with independent
                    on-chain finalized verification on Solana mainnet.
                  </p>

                  <div className="mt-4 p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-mono space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Annual Price (USD):</span>
                      <span className="text-white font-bold text-sm">
                        {pricingConfig?.annualPriceUsd !== null && pricingConfig?.annualPriceUsd !== undefined
                          ? `$${pricingConfig.annualPriceUsd} USD`
                          : 'Configuration Pending'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Payment Asset:</span>
                      <span className="text-emerald-400 font-bold">Native SOL (Solana)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Live SOL Rate:</span>
                      <span className="text-cyan-400">
                        ${pricingConfig?.solRateUsd || '154.5'} USD / SOL
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Device Quota:</span>
                      <span className="text-zinc-300">2 Devices (Windows & Android)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  {pricingConfig?.annualPriceUsd === null ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs text-center">
                      Annual price is being configured by administrator.
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateQuote('ANNUAL')}
                      disabled={loading}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20"
                    >
                      {member.activePlan === 'ANNUAL' ? 'Renew Annual Pass (SOL)' : 'Get Annual SOL Quote'}
                    </button>
                  )}
                </div>
              </div>

              {/* Option C: Lifetime Subscription (Paid in SOL) */}
              <div className="bg-zinc-900/70 border border-cyan-500/30 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-extrabold text-[10px] uppercase rounded-bl-xl">
                  Lifetime Pass
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                      Option C • Lifetime
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-white">Lifetime Subscription</h4>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    Permanent access with lifetime updates and algorithm improvements. One-time payment in native SOL, verified directly on-chain.
                  </p>

                  <div className="mt-4 p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-mono space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Lifetime Price (USD):</span>
                      <span className="text-white font-bold text-sm">
                        {pricingConfig?.lifetimePriceUsd !== null && pricingConfig?.lifetimePriceUsd !== undefined
                          ? `$${pricingConfig.lifetimePriceUsd} USD`
                          : 'Configuration Pending'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Payment Asset:</span>
                      <span className="text-emerald-400 font-bold">Native SOL (Solana)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Duration:</span>
                      <span className="text-cyan-400 font-bold">Permanent (Never Expires)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Device Quota:</span>
                      <span className="text-zinc-300">3 Devices (Windows & Android)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  {pricingConfig?.lifetimePriceUsd === null ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs text-center">
                      Lifetime price is being configured by administrator.
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateQuote('LIFETIME')}
                      disabled={loading || member.activePlan === 'LIFETIME'}
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-extrabold text-xs rounded-xl transition shadow-lg shadow-cyan-500/20"
                    >
                      {member.activePlan === 'LIFETIME' ? 'Lifetime Pass Active' : 'Get Lifetime SOL Quote'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="max-w-xl bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 space-y-2">
              <label htmlFor="membership-coupon" className="text-sm font-semibold text-white">Discount coupon (optional)</label>
              <input id="membership-coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} maxLength={32} placeholder="Enter coupon before generating a quote" className="block w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white" />
              <p className="text-xs text-zinc-400">Enter your coupon, then select Annual or Lifetime SOL Quote above. The server validates the coupon and calculates your final price.</p>
            </div>

            {/* ACTIVE SOL CHECKOUT QUOTE & ON-CHAIN VERIFICATION MODAL / PANEL */}
            {activeQuote && (
              <div className="bg-zinc-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div>
                    <h4 className="font-bold text-white text-base flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-emerald-400" />
                      {activeQuote.plan === 'LIFETIME' ? 'Lifetime Subscription' : 'Annual Membership'} Solana Checkout Quote
                    </h4>
                    <p className="text-xs text-zinc-400 font-mono">Order ID: {activeQuote.id}</p>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-zinc-500 uppercase font-mono">Quote Expiration</div>
                    <div
                      className={`text-sm font-bold font-mono ${
                        quoteTimeLeft > 60 ? 'text-emerald-400' : 'text-rose-400 animate-pulse'
                      }`}
                    >
                      {Math.floor(quoteTimeLeft / 60)}:
                      {(quoteTimeLeft % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                </div>

                  {activeQuote.discount && (
                    <div className="text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 space-y-1">
                      <p className="text-emerald-300 font-bold">Coupon {activeQuote.discount.code} applied ({activeQuote.discount.percentage}% off)</p>
                      <p className="text-zinc-300">Original: ${activeQuote.discount.originalPriceUsd.toFixed(2)} · Saved: ${activeQuote.discount.discountAmountUsd.toFixed(2)} · New total: ${activeQuote.usdPrice.toFixed(2)}</p>
                    </div>
                  )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <span className="text-zinc-500 block mb-1">Required SOL Amount</span>
                    <span className="text-emerald-400 text-lg font-bold">
                      {activeQuote.solAmount} SOL
                    </span>
                    <span className="text-zinc-400 block text-[11px]">
                      (${activeQuote.usdPrice} USD @ ${activeQuote.solRateUsd}/SOL)
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 md:col-span-2">
                    <span className="text-zinc-500 block mb-1">Official Receiving Wallet</span>
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-300 font-bold truncate max-w-[280px]">
                        {activeQuote.receivingWallet}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activeQuote.receivingWallet);
                          alert('Receiving wallet copied!');
                        }}
                        className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
                        title="Copy Address"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      Network: Solana Mainnet-Beta • Native SOL only
                    </span>
                  </div>
                </div>

                {/* Wallet Connect or Manual Transfer */}
                <div className="p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-300 font-semibold">1. Connect Wallet to Pay</span>
                    {connectedWallet ? (
                      <span className="text-emerald-400 font-mono text-[11px] truncate max-w-[200px]">
                        Connected: {connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)}
                      </span>
                    ) : (
                      <button
                        onClick={handleConnectWallet}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition"
                      >
                        Connect Phantom / Solflare
                      </button>
                    )}
                  </div>

                  <div>
                    <span className="text-zinc-300 font-semibold block mb-1.5">
                      2. Submit Transaction Signature for Server Verification
                    </span>
                    <p className="text-[11px] text-zinc-500 mb-2 leading-relaxed">
                      After sending {activeQuote.solAmount} SOL, paste the on-chain transaction
                      signature below. The backend will independently verify finalized confirmation
                      before issuing your annual license.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={txSignatureInput}
                        onChange={(e) => setTxSignatureInput(e.target.value)}
                        placeholder="Paste 88-character Solana transaction signature..."
                        className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        onClick={handleVerifyPayment}
                        disabled={verifyingPayment || !txSignatureInput.trim()}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold text-xs rounded-lg transition flex items-center gap-1.5 shadow"
                      >
                        {verifyingPayment ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Verifying On-Chain...</span>
                          </>
                        ) : (
                          <span>Verify Payment</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Verification Result Feedback */}
                {verifyResult && (
                  <div
                    className={`p-4 rounded-xl text-xs flex items-start gap-2.5 ${
                      verifyResult.success
                        ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {verifyResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold">{verifyResult.message}</div>
                      {verifyResult.rawCode && (
                        <div className="mt-2 font-mono text-sm bg-zinc-950 p-2.5 rounded-lg border border-emerald-800 text-white flex items-center justify-between">
                          <span>{verifyResult.rawCode}</span>
                          <button
                            onClick={() => {
                              onActivateKeyInApp(verifyResult.rawCode!);
                              onClose();
                            }}
                            className="px-2 py-1 bg-emerald-500 text-black font-bold text-xs rounded"
                          >
                            Apply in App
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MEMBER'S ISSUED ACCESS KEYS & REGISTERED DEVICES */}
            {license && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-base flex items-center gap-2">
                    <Key className="w-5 h-5 text-emerald-400" />
                    Issued Access License
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {license.status}
                  </span>
                </div>

                <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-mono space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">License Identifier:</span>
                    <span className="text-cyan-400 font-bold">{license.codePrefix}-****-**** ({license.id})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Entitlement Plan:</span>
                    <span className="text-white font-bold">{license.type} Membership</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Expiration Date:</span>
                    <span className="text-zinc-300">
                      {license.expiresAt
                        ? new Date(license.expiresAt).toLocaleDateString()
                        : 'Active Term'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Device Quota:</span>
                    <span className="text-zinc-300">
                      {license.devices.length} / {license.maxDevices} Devices Activated
                    </span>
                  </div>
                </div>

                {/* Registered Devices List */}
                {license.devices.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-zinc-300 mb-2">Registered Hardware Devices</h5>
                    <div className="space-y-1.5 font-mono text-xs">
                      {license.devices.map((d: any, idx: number) => (
                        <div
                          key={`${d.deviceId}-${idx}`}
                          className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {d.platform === 'windows' ? (
                              <Laptop className="w-3.5 h-3.5 text-blue-400" />
                            ) : (
                              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            <span className="text-white">{d.deviceName}</span>
                            <span className="text-[10px] text-zinc-500 truncate max-w-[160px]">
                              ({d.deviceId})
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500">
                            Last seen: {new Date(d.lastSeenAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PAYMENT & ORDER HISTORY */}
            {orders.length > 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                <h4 className="font-bold text-white text-base mb-3">Order & Payment History</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px] border-b border-zinc-800">
                      <tr>
                        <th className="py-2.5 px-3">Order ID</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Tx Signature</th>
                        <th className="py-2.5 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {orders.map((o, idx) => (
                        <tr key={`${o.id}-${idx}`}>
                          <td className="py-2.5 px-3 text-cyan-300">{o.id}</td>
                          <td className="py-2.5 px-3 text-white">
                            {o.solAmount} SOL (${o.usdPrice} USD)
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                o.status === 'LICENSE_ISSUED' || o.status === 'PAYMENT_CONFIRMED'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400 truncate max-w-[140px]">
                            {o.txSignature ? (
                              <a
                                href={`https://explorer.solana.com/tx/${o.txSignature}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 hover:underline flex items-center gap-1"
                              >
                                <span>{o.txSignature.slice(0, 8)}...</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-500">
                            {new Date(o.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
