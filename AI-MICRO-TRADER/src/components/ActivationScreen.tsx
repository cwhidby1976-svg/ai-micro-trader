import React, { useState } from 'react';
import {
  Shield,
  Key,
  Laptop,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Clock,
  Radio,
  Server,
  Sliders,
  Copy,
  Info
} from 'lucide-react';
import { ClientLicenseState, licensingService } from '../services/licensingService';
import { PlatformType } from '../server/types';
import { navigatePublicPath } from './RiskDisclaimer';

interface ActivationScreenProps {
  licenseState: ClientLicenseState;
  onOpenAdmin: () => void;
  onBackToLanding?: () => void;
  onOpenMemberPortal?: () => void;
  onEnterDemoMode?: () => void;
}

export const ActivationScreen: React.FC<ActivationScreenProps> = ({
  licenseState,
  onOpenAdmin,
  onBackToLanding,
  onOpenMemberPortal,
  onEnterDemoMode,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);

  const handleFormatCode = (val: string) => {
    // Auto format: MTR-XXXX-XXXX-XXXX
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
    setInputCode(formatted.slice(0, 19));
    setLocalError(null);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      setLocalError('Please enter an access activation code');
      return;
    }

    setLoading(true);
    setLocalError(null);
    setSuccessMsg(null);

    const res = await licensingService.activate(inputCode);
    setLoading(false);

    if (res.success) {
      setSuccessMsg('License activated successfully! Unlocking trading terminal...');
    } else {
      setLocalError(res.error || 'Activation failed');
    }
  };

  const handleSwitchPlatform = (plat: PlatformType) => {
    licensingService.setPlatformOverride(plat);
  };

  const getStatusBadge = () => {
    switch (licenseState.status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> ACTIVE
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" /> EXPIRED
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-3.5 h-3.5" /> REVOKED
          </span>
        );
      case 'DEVICE_LIMIT_REACHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
            <AlertCircle className="w-3.5 h-3.5" /> DEVICE LIMIT REACHED
          </span>
        );
      case 'VALIDATION_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <RefreshCw className="w-3.5 h-3.5" /> VALIDATION REQUIRED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
            <Lock className="w-3.5 h-3.5" /> NOT ACTIVATED
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Background Cyber Grid / Ambient Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))]" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar with simulated OS toggle & Admin Access */}
      <div className="w-full max-w-xl flex items-center justify-between mb-4 z-10 text-xs text-zinc-400">
        <div className="flex items-center gap-2 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-800 backdrop-blur">
          <span className="text-zinc-500 font-mono">Platform target:</span>
          <button
            type="button"
            onClick={() => handleSwitchPlatform('windows')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
              licenseState.platform === 'windows'
                ? 'bg-cyan-500/20 text-cyan-400 font-medium border border-cyan-500/40'
                : 'hover:text-zinc-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" /> Windows
          </button>
          <span className="text-zinc-700">|</span>
          <button
            type="button"
            onClick={() => handleSwitchPlatform('android')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
              licenseState.platform === 'android'
                ? 'bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/40'
                : 'hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Android
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition hover:border-zinc-700 text-xs font-semibold"
            >
              <span>Back to Home</span>
            </button>
          )}
          <a
            href="/disclaimer"
            onClick={(e) => {
              e.preventDefault();
              navigatePublicPath('/disclaimer');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-cyan-300 border border-cyan-500/40 transition hover:border-cyan-400 text-xs font-semibold"
          >
            Risk Disclaimer
          </a>

          {onOpenMemberPortal && (
            <button
              onClick={onOpenMemberPortal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-cyan-300 border border-cyan-500/40 transition hover:border-cyan-400 text-xs font-semibold"
            >
              <span>User Login</span>
            </button>
          )}

          {onEnterDemoMode && (
            <button
              onClick={onEnterDemoMode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition text-xs font-semibold"
              title="Test drive the terminal in paper trading mode"
            >
              <span>Demo Paper Mode</span>
            </button>
          )}

          <button
            onClick={onOpenAdmin}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition"
            title="Staff Admin Portal (?admin=true)"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Activation Card */}
      <div className="w-full max-w-xl bg-zinc-900/90 border border-zinc-800/80 rounded-2xl shadow-2xl backdrop-blur-xl p-6 sm:p-8 z-10">
        {/* Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-purple-600 p-0.5 mb-4 shadow-lg shadow-cyan-500/10">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Shield className="w-7 h-7 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            AI – MICRO TRADER
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Solana Meme Coin Scanner • ICC Strategy Engine • Jupiter DEX
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            {getStatusBadge()}
            {licenseState.isOfflineGrace && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <Radio className="w-3 h-3 animate-pulse" /> Offline Grace Mode
              </span>
            )}
          </div>
        </div>

        {/* State Banner & Explanation */}
        {licenseState.status === 'REVOKED' && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200">
              <div className="font-semibold text-rose-300">Access Code Revoked</div>
              <div className="mt-1">
                {licenseState.errorMessage ||
                  'This license has been permanently revoked by the administrator. Contact customer support to request a reinstatement or purchase a new key.'}
              </div>
            </div>
          </div>
        )}

        {licenseState.status === 'EXPIRED' && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200">
              <div className="font-semibold text-amber-300">Subscription Expired</div>
              <div className="mt-1">
                Your license expired on{' '}
                {licenseState.expiresAt
                  ? new Date(licenseState.expiresAt).toLocaleDateString()
                  : 'the end of term'}
                . Please renew your subscription code to restore access.
              </div>
            </div>
          </div>
        )}

        {licenseState.status === 'DEVICE_LIMIT_REACHED' && (
          <div className="mb-6 p-4 rounded-xl bg-orange-950/40 border border-orange-800/50 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="text-xs text-orange-200">
              <div className="font-semibold text-orange-300">Device Limit Exceeded</div>
              <div className="mt-1">
                {licenseState.errorMessage ||
                  'Maximum device activations have been reached for this license. Deactivate an existing device or request an administrator reset.'}
              </div>
            </div>
          </div>
        )}

        {licenseState.status === 'VALIDATION_REQUIRED' && (
          <div className="mb-6 p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/50 flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5 animate-spin" />
            <div className="text-xs text-indigo-200">
              <div className="font-semibold text-indigo-300">Online Validation Required</div>
              <div className="mt-1">
                The offline grace period has elapsed. Please reconnect to the internet and revalidate your activation code with the licensing server.
              </div>
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              License Access Code
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Key className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => handleFormatCode(e.target.value)}
                placeholder="MTR-XXXX-XXXX-XXXX"
                disabled={loading}
                className="w-full pl-10 pr-24 py-3 bg-zinc-950/80 border border-zinc-700/80 rounded-xl font-mono text-sm tracking-wider text-cyan-300 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition uppercase"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    handleFormatCode(text);
                  } catch {}
                }}
                className="absolute inset-y-1.5 right-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Paste
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Enter the 16-character cryptographic key provided by your administrator.
            </p>
          </div>

          {/* Feedback Messages */}
          {localError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{localError}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !inputCode.trim()}
            className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Authenticating with Secure Server...</span>
              </>
            ) : (
              <>
                <span>Activate Application</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Device Registration & Offline Grace Details */}
        <div className="mt-6 pt-5 border-t border-zinc-800 text-xs text-zinc-400">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowDeviceInfo(!showDeviceInfo)}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Hardware & Activation Diagnostics</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSupportModal(true)}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Contact Support</span>
            </button>
          </div>

          {showDeviceInfo && (
            <div className="mt-3 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 font-mono text-[11px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Hardware Fingerprint:</span>
                <span className="text-zinc-300 truncate max-w-[240px]">{licenseState.deviceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Operating System:</span>
                <span className="text-cyan-400 uppercase font-semibold">{licenseState.platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Device Client Tag:</span>
                <span className="text-zinc-300">{licenseState.deviceName}</span>
              </div>
              {licenseState.expiresAt && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Valid Until:</span>
                  <span className="text-zinc-300">
                    {new Date(licenseState.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {licenseState.graceUntil && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Offline Grace Deadline:</span>
                  <span className="text-amber-400">
                    {new Date(licenseState.graceUntil).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-zinc-800">
                <span className="text-zinc-500">Licensing Security:</span>
                <span className="text-emerald-400">HMAC-SHA256 • Zero-Plaintext Hash</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-cyan-400" />
                License Assistance & Support
              </h3>
              <button
                onClick={() => setShowSupportModal(false)}
                className="text-zinc-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed mb-4">
              If you lost your access code, reached your device limit, or need to extend your subscription, please reach out with your Device Fingerprint below:
            </p>
            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-400 mb-4 break-all">
              ID: {licenseState.deviceId}
            </div>
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-zinc-800/50 rounded-lg flex justify-between items-center">
                <span className="text-zinc-400">Enterprise Desk:</span>
                <span className="text-cyan-400 font-mono">support@aimicrotrader.io</span>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded-lg flex justify-between items-center">
                <span className="text-zinc-400">Telegram Verification:</span>
                <span className="text-cyan-400 font-mono">@AIMicroTraderAuth</span>
              </div>
            </div>
            <button
              onClick={() => setShowSupportModal(false)}
              className="mt-5 w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
