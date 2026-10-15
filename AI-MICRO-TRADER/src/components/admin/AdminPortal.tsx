import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Users,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Trash2,
  Copy,
  Clock,
  Laptop,
  Smartphone,
  Plus,
  Layers,
  FileSpreadsheet,
  LogOut,
  X,
  Search,
  Filter,
  Check,
  ChevronDown,
  Info,
  Calendar,
  Lock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  ListFilter,
  ArrowUpDown,
  FileText,
  Terminal,
  ExternalLink,
  DollarSign,
  Wallet,
  Settings,
  CreditCard
} from 'lucide-react';
import {
  LicenseRecord,
  PlanType,
  AuditLog,
  PriceHistoryRecord,
  MemberUser,
  CheckoutOrder,
  DiscountCode,
  SystemConfig,
} from '../../server/types';

interface AdminPortalProps {
  onClose: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onClose }) => {
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('ai_micro_trader_admin_token');
  });
  const [adminUser, setAdminUser] = useState<any>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  // Setup / Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Admin Dashboard Tabs: 'pricing' | 'orders' | 'members' | 'licenses' | 'generator' | 'devices' | 'audit' | 'discounts'
  const [currentTab, setCurrentTab] = useState<
    'pricing' | 'orders' | 'members' | 'licenses' | 'generator' | 'devices' | 'audit' | 'discounts'
  >('pricing');

  // Licenses list & stats
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [members, setMembers] = useState<MemberUser[]>([]);
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);

  // Admin discount management
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(10);
  const [discountMaxUses, setDiscountMaxUses] = useState(6);
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountMessage, setDiscountMessage] = useState<string | null>(null);
  const [discountRedemptions, setDiscountRedemptions] = useState<Array<{
    id: string; code: string; memberId: string; memberEmail: string; memberName: string;
    percentage: number; originalPriceUsd: number; discountAmountUsd: number;
    finalPriceUsd: number; redeemedAt: string; orderId: string;
  }>>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Dynamic Annual & Lifetime Pricing form
  const [annualPriceInput, setAnnualPriceInput] = useState<string>('');
  const [lifetimePriceInput, setLifetimePriceInput] = useState<string>('');
  const [priceChangeReason, setPriceChangeReason] = useState<string>('');
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingSuccess, setPricingSuccess] = useState<string | null>(null);

  // System Settings form
  const [solReceivingInput, setSolReceivingInput] = useState('');
  const [solRpcInput, setSolRpcInput] = useState('');
  const [trialDaysInput, setTrialDaysInput] = useState(1);
  const [trialDeviceInput, setTrialDeviceInput] = useState(1);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Generator form (Strictly Trial or Annual)
  const [genMode, setGenMode] = useState<'single' | 'batch'>('single');
  const [genPlan, setGenPlan] = useState<PlanType>('Annual');
  const [genDurationDays, setGenDurationDays] = useState(365);
  const [genMaxDevices, setGenMaxDevices] = useState(2);
  const [genNote, setGenNote] = useState('');
  const [genBatchCount, setGenBatchCount] = useState(5);
  const [genLoading, setGenLoading] = useState(false);

  // Audit Logs State
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');
  const [auditSortOrder, setAuditSortOrder] = useState<'desc' | 'asc'>('desc');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditLimit, setAuditLimit] = useState<number>(200);
  const [auditLastSynced, setAuditLastSynced] = useState<string | null>(null);
  const [selectedAuditEntry, setSelectedAuditEntry] = useState<AuditLog | null>(null);

  // Newly generated reveal modal
  const [revealCodes, setRevealCodes] = useState<Array<{ code: string; type: string; id: string }>>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Revoke / Renew / Reset dialogs
  const [actionTarget, setActionTarget] = useState<LicenseRecord | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [renewDays, setRenewDays] = useState(365);
  const [actionModal, setActionModal] = useState<'revoke' | 'renew' | 'reset' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Initial check setup status & token validity
  useEffect(() => {
    checkSetupStatus();
  }, []);

  useEffect(() => {
    if (authToken) {
      fetchAdminMe();
      fetchDashboardData();
    }
  }, [authToken]);

  const checkSetupStatus = async () => {
    try {
      const res = await fetch('/api/admin/setup-status');
      const data = await res.json();
      setNeedsSetup(data.needsSetup);
    } catch {
      setNeedsSetup(false);
    }
  };

  const fetchAdminMe = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/admin/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        handleLogout();
        return;
      }
      const data = await res.json();
      setAdminUser(data);
    } catch {
      handleLogout();
    }
  };

  const fetchDashboardData = async () => {
    if (!authToken) return;
    setLoadingData(true);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const [licRes, statsRes, auditRes, membersRes, ordersRes, pricingRes, discountsRes] = await Promise.all([
        fetch('/api/admin/licenses', { headers }),
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/audit-logs', { headers }),
        fetch('/api/admin/members', { headers }),
        fetch('/api/admin/orders', { headers }),
        fetch('/api/pricing'),
        fetch('/api/admin/discount-codes', { headers }),
      ]);

      if (licRes.ok) {
        const data = await licRes.json();
        setLicenses(data.licenses || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats || null);
      }
      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditLogs(data.logs || []);
      }
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members || []);
      }
      if (discountsRes.ok) {
        const data = await discountsRes.json();
        setDiscountCodes(data.discountCodes || []);
        setDiscountRedemptions(data.redemptions || []);
      }
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders || []);
      }
      if (pricingRes.ok) {
        const data = await pricingRes.json();
        setSystemConfig({
          annualPriceUsd: data.annualPriceUsd,
          trialDurationDays: data.trialDurationDays || 1,
          trialDeviceLimit: data.trialDeviceLimit,
          annualDeviceLimit: data.annualDeviceLimit,
          lifetimePriceUsd: data.lifetimePriceUsd,
          lifetimeDeviceLimit: data.lifetimeDeviceLimit || 3,
          solReceivingAddress: data.solReceivingAddress,
          solRpcUrl: 'https://api.mainnet-beta.solana.com',
          priceHistory: [],
        });
        setAnnualPriceInput(data.annualPriceUsd !== null ? String(data.annualPriceUsd) : '');
        setLifetimePriceInput(data.lifetimePriceUsd !== null && data.lifetimePriceUsd !== undefined ? String(data.lifetimePriceUsd) : '');
        setSolReceivingInput(data.solReceivingAddress || '');
        setTrialDaysInput(data.trialDurationDays || 1);
        setTrialDeviceInput(data.trialDeviceLimit || 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchAuditLogs = async (limit = auditLimit) => {
    if (!authToken) return;
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/admin/audit-logs?limit=${limit}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        setAuditLastSynced(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (authToken && currentTab === 'audit') {
      fetchAuditLogs();
    }
  }, [currentTab, authToken]);

  const handleAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Setup failed');

      localStorage.setItem('ai_micro_trader_admin_token', data.token);
      setAuthToken(data.token);
      setAdminUser(data.admin);
      setNeedsSetup(false);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid credentials');

      localStorage.setItem('ai_micro_trader_admin_token', data.token);
      setAuthToken(data.token);
      setAdminUser(data.admin);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    if (authToken) {
      fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem('ai_micro_trader_admin_token');
    setAuthToken(null);
    setAdminUser(null);
  };

  // Phase 4: Dynamic Annual & Lifetime Price Management
  const handleSaveAnnualPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAnnual = annualPriceInput ? parseFloat(annualPriceInput) : null;
    const parsedLifetime = lifetimePriceInput ? parseFloat(lifetimePriceInput) : null;

    if (!parsedAnnual && !parsedLifetime) {
      alert('Please enter at least one valid price (Annual or Lifetime).');
      return;
    }

    setPricingSaving(true);
    setPricingSuccess(null);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          priceUsd: parsedAnnual,
          lifetimePriceUsd: parsedLifetime,
          reason: priceChangeReason || 'Administrative pricing configuration',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update price');

      setPricingSuccess(`Pricing updated successfully! Annual: $${data.annualPriceUsd || 'Unset'}, Lifetime: $${data.lifetimePriceUsd || 'Unset'}. Applied to future quotes.`);
      setPriceChangeReason('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPricingSaving(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || discountSaving) return;
    setDiscountSaving(true);
    setDiscountMessage(null);
    try {
      const response = await fetch('/api/admin/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ code: discountCodeInput.trim().toUpperCase(), percentage: discountPercentage, maxUses: discountMaxUses }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create coupon');
      setDiscountCodeInput('');
      setDiscountMessage('Coupon created successfully.');
      await fetchDashboardData();
    } catch (error: any) {
      setDiscountMessage(error.message || 'Unable to create coupon');
    } finally {
      setDiscountSaving(false);
    }
  };

  const handleToggleCoupon = async (id: string, active: boolean) => {
    if (!authToken) return;
    setDiscountMessage(null);
    try {
      const response = await fetch(`/api/admin/discount-codes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ active }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update coupon');
      await fetchDashboardData();
    } catch (error: any) {
      setDiscountMessage(error.message || 'Unable to update coupon');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          solReceivingAddress: solReceivingInput,
          solRpcUrl: solRpcInput,
          trialDurationDays: trialDaysInput,
          trialDeviceLimit: trialDeviceInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Settings update failed');
      alert('System settings updated successfully.');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenLoading(true);
    try {
      const duration = genPlan === 'Trial' ? 1 : genPlan === 'Lifetime' ? 36500 : 365;
      const res = await fetch('/api/admin/licenses/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: genPlan,
          durationDays: duration,
          maxDevices: genMaxDevices,
          note: genNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      setRevealCodes([{ code: data.accessCode, type: data.license.type, id: data.license.id }]);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGenLoading(false);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/licenses/${actionTarget.id}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ reason: revokeReason || 'Administrative revocation' }),
      });
      if (!res.ok) throw new Error('Revocation failed');
      setActionModal(null);
      setActionTarget(null);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenewConfirm = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/licenses/${actionTarget.id}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ additionalDays: renewDays }),
      });
      if (!res.ok) throw new Error('Renewal failed');
      setActionModal(null);
      setActionTarget(null);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetDevicesConfirm = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/licenses/${actionTarget.id}/reset-devices`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Device reset failed');
      setActionModal(null);
      setActionTarget(null);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateSingleDevice = async (licenseId: string, deviceId: string) => {
    if (!confirm(`Are you sure you want to disconnect device ${deviceId}?`)) return;
    try {
      const res = await fetch(`/api/admin/licenses/${licenseId}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error('Failed to disconnect device');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportCSV = () => {
    window.open(`/api/admin/licenses/export-csv`, '_blank');
  };

  const filteredLicenses = licenses.filter((l) => {
    const matchesSearch =
      l.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      l.codePrefix.toLowerCase().includes(searchFilter.toLowerCase()) ||
      l.note.toLowerCase().includes(searchFilter.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#07090e]/95 backdrop-blur-md flex flex-col overflow-hidden text-zinc-200">
      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-950/80 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
            <Lock className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base flex items-center gap-2">
              AI – MICRO TRADER{' '}
              <span className="text-cyan-400 font-mono text-xs px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
                ADMIN CONSOLE
              </span>
            </h2>
            <p className="text-[11px] text-zinc-400">
              Pricing Control • SOL On-Chain Payments • Member Accounts • Licensing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {adminUser && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-zinc-300 font-medium">{adminUser.username}</span>
              <span className="text-[10px] text-zinc-500 uppercase">({adminUser.role})</span>
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

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {!authToken ? (
          /* AUTH SCREEN */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-8 shadow-2xl backdrop-blur">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-white">
                  {needsSetup ? 'First-Administrator Setup' : 'Administrator Authentication'}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Access restricted to authorized server operators and software licensing managers.
                </p>
              </div>

              {authError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Administrator Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                >
                  {authLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Authenticate & Unlock'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED DASHBOARD */
          <>
            {/* Sidebar Navigation */}
            <aside className="w-64 border-r border-zinc-800 bg-zinc-950/50 p-4 flex flex-col justify-between shrink-0">
              <nav className="space-y-1">
                {/* 1. Dynamic Pricing Tab (Phase 4) */}
                <button
                  onClick={() => setCurrentTab('pricing')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    currentTab === 'pricing'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Annual Pricing & Settings</span>
                </button>

                {/* 2. SOL Orders Tab (Phase 5 & 6) */}
                <button
                  onClick={() => setCurrentTab('orders')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    currentTab === 'orders'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  <span>SOL Orders & Verification</span>
                  <span className="ml-auto text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                    {orders.length}
                  </span>
                </button>

                {/* 3. Members Tab (Phase 2) */}
                <button
                  onClick={() => setCurrentTab('members')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    currentTab === 'members'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Registered Members</span>
                  <span className="ml-auto text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                    {members.length}
                  </span>
                </button>

                {/* 4. Licenses & Codes */}
                <button
                  onClick={() => setCurrentTab('licenses')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    currentTab === 'licenses'
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Key className="w-4 h-4" />
                  <span>Issued Licenses</span>
                  <span className="ml-auto text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                    {licenses.length}
                  </span>
                </button>

                {/* 5. Generator */}
                <button
                  onClick={() => setCurrentTab('generator')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    currentTab === 'generator'
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Generate Key (Trial / Annual)</span>
                </button>

                {/* 6. Hardware Activations */}
                <button
                  onClick={() => setCurrentTab('devices')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    currentTab === 'devices'
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Laptop className="w-4 h-4" />
                  <span>Hardware Activations</span>
                  <span className="ml-auto text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">
                    {stats?.totalActivatedDevices || 0}
                  </span>
                </button>

                {/* 7. Audit Stream */}
                <button
                  onClick={() => setCurrentTab('audit')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                    currentTab === 'audit'
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Audit Logs</span>
                </button>
              </nav>

              <div className="pt-4 border-t border-zinc-800 space-y-2">
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export Safe CSV</span>
                </button>
              </div>
            </aside>

            {/* Main Tab Panel */}
            <main className="flex-1 overflow-y-auto p-6 bg-[#0a0d14]">
              {/* TAB 1: DYNAMIC ANNUAL PRICING (PHASE 4) */}
              {currentTab === 'pricing' && (
                <div className="max-w-4xl space-y-6">
                  {/* Active Price Overview Card */}
                  <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
                      <div>
                        <h3 className="font-bold text-white text-lg flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-emerald-400" />
                          Annual & Lifetime Subscription Price Management
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1">
                          Authoritative backend pricing control for Annual & Lifetime plans. Applied dynamically to future Solana checkout orders without redeploying code.
                        </p>
                      </div>
                      <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                        Server Authoritative
                      </span>
                    </div>

                    {/* Active Price Status Box */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 font-mono">
                      <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                        <span className="text-xs text-zinc-500 block mb-1">Active Annual Price</span>
                        <span className="text-2xl font-bold text-emerald-400">
                          {systemConfig?.annualPriceUsd !== null && systemConfig?.annualPriceUsd !== undefined
                            ? `$${systemConfig?.annualPriceUsd} USD`
                            : 'Unconfigured'}
                        </span>
                        <span className="text-[10px] text-zinc-500 block mt-1">
                          {systemConfig?.annualPriceUsd !== null ? 'Live for annual quotes' : 'Needs Admin Setup'}
                        </span>
                      </div>

                      <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                        <span className="text-xs text-zinc-500 block mb-1">Active Lifetime Price</span>
                        <span className="text-2xl font-bold text-cyan-400">
                          {systemConfig?.lifetimePriceUsd !== null && systemConfig?.lifetimePriceUsd !== undefined
                            ? `$${systemConfig?.lifetimePriceUsd} USD`
                            : 'Unconfigured'}
                        </span>
                        <span className="text-[10px] text-zinc-500 block mt-1">
                          {systemConfig?.lifetimePriceUsd !== null ? 'Live for lifetime quotes' : 'Needs Admin Setup'}
                        </span>
                      </div>

                      <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                        <span className="text-xs text-zinc-500 block mb-1">Access Policy</span>
                        <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                          Supported access: <strong>1-Day Free Trial</strong> (24h), <strong>Annual Subscription</strong> (365d), and <strong>Lifetime Subscription</strong>.
                        </p>
                      </div>
                    </div>

                    {pricingSuccess && (
                      <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>{pricingSuccess}</span>
                      </div>
                    )}

                    {/* Price Edit Form */}
                    <form onSubmit={handleSaveAnnualPrice} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-zinc-200 mb-1">
                            Annual Price (USD)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-2.5 text-zinc-500 font-mono text-sm">
                              $
                            </span>
                            <input
                              type="number"
                              step="1"
                              min="1"
                              max="100000"
                              value={annualPriceInput}
                              onChange={(e) => setAnnualPriceInput(e.target.value)}
                              placeholder="e.g. 299"
                              className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-sm font-mono text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-zinc-200 mb-1">
                            Lifetime Price (USD)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-2.5 text-zinc-500 font-mono text-sm">
                              $
                            </span>
                            <input
                              type="number"
                              step="1"
                              min="1"
                              max="100000"
                              value={lifetimePriceInput}
                              onChange={(e) => setLifetimePriceInput(e.target.value)}
                              placeholder="e.g. 799"
                              className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-sm font-mono text-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-300 mb-1">
                            Audit Reason for Change
                          </label>
                          <input
                            type="text"
                            value={priceChangeReason}
                            onChange={(e) => setPriceChangeReason(e.target.value)}
                            placeholder="e.g. 2026 Tier Update"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-200 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="submit"
                          disabled={pricingSaving || (!annualPriceInput && !lifetimePriceInput)}
                          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold text-xs rounded-xl transition shadow flex items-center gap-1.5"
                        >
                          {pricingSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon />}
                          <span>Save Pricing</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAnnualPriceInput(
                              systemConfig?.annualPriceUsd !== null && systemConfig?.annualPriceUsd !== undefined ? String(systemConfig?.annualPriceUsd) : ''
                            );
                            setLifetimePriceInput(
                              systemConfig?.lifetimePriceUsd !== null && systemConfig?.lifetimePriceUsd !== undefined ? String(systemConfig?.lifetimePriceUsd) : ''
                            );
                            setPriceChangeReason('');
                          }}
                          className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition"
                        >
                          Cancel Unsaved Changes
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* System Settings (Receiving Wallet & RPC) */}
                  <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6">
                    <h4 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-cyan-400" />
                      Solana On-Chain Infrastructure & Free Trial Settings
                    </h4>
                    <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-mono">
                      <div>
                        <label className="block text-zinc-400 mb-1">
                          Official Solana Receiving Address (Mainnet)
                        </label>
                        <input
                          type="text"
                          required
                          value={solReceivingInput}
                          onChange={(e) => setSolReceivingInput(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-cyan-300"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-zinc-400 mb-1">Free Trial Duration (Days)</label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={trialDaysInput}
                            onChange={(e) => setTrialDaysInput(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-zinc-400 mb-1">Trial Device Limit</label>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={trialDeviceInput}
                            onChange={(e) => setTrialDeviceInput(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-white"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={settingsSaving}
                        className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition"
                      >
                        {settingsSaving ? 'Saving...' : 'Update System Parameters'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Coupons stay inside the existing Pricing tab. */}
              {currentTab === 'pricing' && (
                <section className="max-w-4xl mt-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-white font-bold text-lg">Membership Discount Coupons</h3>
                  <p className="text-xs text-zinc-400">Create a coupon for annual or lifetime membership checkout. Usage counts increase only after verified SOL payment.</p>
                  <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <label className="text-xs text-zinc-300">Coupon code
                      <input required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]{3,32}" value={discountCodeInput} onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())} placeholder="SAVE50" className="block mt-1 w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white" />
                    </label>
                    <label className="text-xs text-zinc-300">Discount (%)
                      <input required type="number" min={1} max={50} step={1} value={discountPercentage} onChange={(e) => setDiscountPercentage(Number(e.target.value))} className="block mt-1 w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white" />
                    </label>
                    <label className="text-xs text-zinc-300">Maximum redemptions
                      <input required type="number" min={1} step={1} value={discountMaxUses} onChange={(e) => setDiscountMaxUses(Number(e.target.value))} className="block mt-1 w-full p-2 rounded bg-zinc-950 border border-zinc-700 text-white" />
                    </label>
                    <button type="submit" disabled={discountSaving} className="rounded bg-emerald-600 text-white font-semibold p-2 disabled:opacity-50">{discountSaving ? 'Saving...' : 'Create Coupon'}</button>
                  </form>
                  {discountMessage && <p role="status" className="text-sm text-amber-300">{discountMessage}</p>}
                  <div className="overflow-x-auto"><table className="w-full text-left text-xs">
                    <thead><tr className="text-zinc-400 border-b border-zinc-700"><th className="py-2">Code</th><th>Discount</th><th>Redeemed / Limit</th><th>Remaining</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>{discountCodes.map((d) => (
                      <tr key={d.id} className="border-b border-zinc-800 text-zinc-200"><td className="py-2 font-mono">{d.code}</td><td>{d.percentage}%</td><td>{d.usedCount} / {d.maxUses}</td><td>{Math.max(0, d.maxUses - d.usedCount)}</td><td>{d.active ? 'Active' : 'Inactive'}</td><td><button type="button" className="text-cyan-400 underline" onClick={() => handleToggleCoupon(d.id, !d.active)}>{d.active ? 'Disable' : 'Enable'}</button></td></tr>
                    ))}</tbody>
                  </table></div>
                  <h4 className="text-white font-semibold text-sm pt-2">Verified coupon redemptions</h4>
                  {discountRedemptions.length === 0 ? <p className="text-xs text-zinc-500">No verified redemptions yet.</p> : (
                    <div className="overflow-x-auto"><table className="w-full text-left text-xs">
                      <thead><tr className="text-zinc-400 border-b border-zinc-700"><th className="py-2">Member</th><th>Coupon</th><th>Original</th><th>Saved</th><th>Paid (USD equivalent)</th><th>Verified at (UTC)</th></tr></thead>
                      <tbody>{discountRedemptions.map((r) => <tr key={r.id} className="border-b border-zinc-800 text-zinc-200"><td className="py-2">{r.memberName || r.memberEmail || r.memberId}</td><td>{r.code}</td><td>${r.originalPriceUsd.toFixed(2)}</td><td>${r.discountAmountUsd.toFixed(2)}</td><td>${r.finalPriceUsd.toFixed(2)}</td><td>{r.redeemedAt}</td></tr>)}</tbody>
                    </table></div>
                  )}
                </section>
              )}

              {/* TAB 2: SOL ORDERS & ON-CHAIN VERIFICATION (PHASE 5 & 6) */}
              {currentTab === 'orders' && (
                <div className="space-y-6">
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-white text-base">
                          Solana Payment Orders & Verification Records
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Mandatory rule: Licenses are only issued after independent finalized on-chain verification.
                        </p>
                      </div>
                      <span className="text-xs font-mono text-zinc-400 bg-zinc-950 px-3 py-1 rounded-lg border border-zinc-800">
                        Total Orders: {orders.length}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-zinc-950 text-zinc-400 uppercase text-[11px] border-b border-zinc-800">
                          <tr>
                            <th className="py-3 px-4">Order ID</th>
                            <th className="py-3 px-4">Member Email</th>
                            <th className="py-3 px-4">Required SOL</th>
                            <th className="py-3 px-4">USD Quoted</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Tx Signature</th>
                            <th className="py-3 px-4">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {orders.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-zinc-500 font-sans">
                                No checkout orders recorded yet.
                              </td>
                            </tr>
                          ) : (
                            orders.map((o, idx) => (
                              <tr key={`${o.id}-${idx}`} className="hover:bg-zinc-800/30">
                                <td className="py-3 px-4 font-bold text-cyan-300">{o.id}</td>
                                <td className="py-3 px-4 text-zinc-300 font-sans">{o.memberEmail}</td>
                                <td className="py-3 px-4 text-emerald-400 font-bold">{o.solAmount} SOL</td>
                                <td className="py-3 px-4 text-zinc-200">${o.usdPrice}</td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      o.status === 'LICENSE_ISSUED'
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                        : o.status === 'PAYMENT_VERIFYING'
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'bg-zinc-800 text-zinc-400'
                                    }`}
                                  >
                                    {o.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-zinc-400 truncate max-w-[140px]">
                                  {o.txSignature ? (
                                    <a
                                      href={`https://explorer.solana.com/tx/${o.txSignature}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-cyan-400 hover:underline flex items-center gap-1"
                                    >
                                      <span>{o.txSignature.slice(0, 8)}...</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ) : (
                                    'Pending'
                                  )}
                                </td>
                                <td className="py-3 px-4 text-zinc-500">
                                  {new Date(o.createdAt).toLocaleTimeString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: REGISTERED MEMBERS (PHASE 2) */}
              {currentTab === 'members' && (
                <div className="space-y-6">
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
                    <h3 className="font-bold text-white text-base mb-1">Member Accounts Directory</h3>
                    <p className="text-xs text-zinc-400 mb-4">
                      Registered customer accounts, membership status, and email verification records.
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-950 text-zinc-400 uppercase font-mono text-[11px] border-b border-zinc-800">
                          <tr>
                            <th className="py-3 px-4">Member Name</th>
                            <th className="py-3 px-4">Email</th>
                            <th className="py-3 px-4">Active Plan</th>
                            <th className="py-3 px-4">Trial Status</th>
                            <th className="py-3 px-4">Annual Expiry</th>
                            <th className="py-3 px-4">License Ref</th>
                            <th className="py-3 px-4">Registered At</th>
                            <th className="py-3 px-4">Coupon / Redeemed At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {members.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-zinc-500">
                                No registered members yet.
                              </td>
                            </tr>
                          ) : (
                            members.map((m, mIdx) => (
                              <tr key={`${m.id}-${mIdx}`} className="hover:bg-zinc-800/30">
                                <td className="py-3 px-4 font-bold text-white">{m.name}</td>
                                <td className="py-3 px-4 font-mono text-zinc-300">{m.email}</td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      m.activePlan === 'ANNUAL'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : m.activePlan === 'TRIAL'
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'bg-zinc-800 text-zinc-400'
                                    }`}
                                  >
                                    {m.activePlan}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-zinc-400">
                                  {m.trialUsed ? 'Used' : 'Eligible'}
                                </td>
                                <td className="py-3 px-4 font-mono text-zinc-300">
                                  {m.annualExpiresAt
                                    ? new Date(m.annualExpiresAt).toLocaleDateString()
                                    : '—'}
                                </td>
                                <td className="py-3 px-4 font-mono text-cyan-400">
                                  {m.licensePrefix ? `${m.licensePrefix}-****` : '—'}
                                </td>
                                <td className="py-3 px-4 text-zinc-500">
                                  {new Date(m.createdAt).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 text-zinc-300">
                                  {discountRedemptions.filter((r) => r.memberId === m.id).map((r) => (
                                    <div key={r.id}>{r.code} ({r.percentage}%) — {r.redeemedAt}</div>
                                  ))}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: LICENSES LIST */}
              {currentTab === 'licenses' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search prefix, ID, note..."
                          value={searchFilter}
                          onChange={(e) => setSearchFilter(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="NOT_ACTIVATED">NOT_ACTIVATED</option>
                        <option value="EXPIRED">EXPIRED</option>
                        <option value="REVOKED">REVOKED</option>
                        <option value="DEVICE_LIMIT_REACHED">DEVICE_LIMIT_REACHED</option>
                      </select>
                    </div>

                    <button
                      onClick={() => setCurrentTab('generator')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Generate Key
                    </button>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-950/80 text-zinc-400 uppercase font-mono text-[11px] border-b border-zinc-800">
                          <tr>
                            <th className="py-3 px-4">License Prefix</th>
                            <th className="py-3 px-4">Plan</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Devices</th>
                            <th className="py-3 px-4">Expiration</th>
                            <th className="py-3 px-4">Note / Customer</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                          {filteredLicenses.map((lic, lIdx) => (
                            <tr key={`${lic.id}-${lIdx}`} className="hover:bg-zinc-800/30 transition">
                              <td className="py-3 px-4 font-mono font-medium text-cyan-300">
                                {lic.codePrefix}-****-****
                                <div className="text-[10px] text-zinc-500">{lic.id}</div>
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-white">
                                {lic.type}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    lic.status === 'ACTIVE'
                                      ? 'bg-emerald-500/15 text-emerald-400'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {lic.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono">
                                {lic.devices.length} / {lic.maxDevices}
                              </td>
                              <td className="py-3 px-4 text-zinc-300">
                                {lic.expiresAt
                                  ? new Date(lic.expiresAt).toLocaleDateString()
                                  : 'Term'}
                              </td>
                              <td className="py-3 px-4 text-zinc-400">{lic.note || '—'}</td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {lic.status !== 'REVOKED' && (
                                    <button
                                      onClick={() => {
                                        setActionTarget(lic);
                                        setActionModal('revoke');
                                      }}
                                      className="px-2 py-1 rounded bg-rose-950/50 hover:bg-rose-900 text-rose-400 text-xs"
                                    >
                                      Revoke
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setActionTarget(lic);
                                      setActionModal('renew');
                                    }}
                                    className="px-2 py-1 rounded bg-cyan-950/50 hover:bg-cyan-900 text-cyan-400 text-xs"
                                  >
                                    Renew
                                  </button>
                                  {lic.devices.length > 0 && (
                                    <button
                                      onClick={() => {
                                        setActionTarget(lic);
                                        setActionModal('reset');
                                      }}
                                      className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-xs"
                                    >
                                      Reset Devices
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: KEY GENERATOR (TRIAL, ANNUAL, LIFETIME) */}
              {currentTab === 'generator' && (
                <div className="max-w-xl mx-auto space-y-6">
                  <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                    <h3 className="font-bold text-white text-base mb-1 flex items-center gap-2">
                      <Key className="w-5 h-5 text-cyan-400" />
                      Cryptographic Access Key Generator
                    </h3>
                    <p className="text-xs text-zinc-400 mb-6">
                      Supported tiers: 1-Day Free Trial (24h), Annual Subscription (365d), and Lifetime Subscription.
                    </p>

                    <form onSubmit={handleGenerateCodes} className="space-y-4 text-xs">
                      <div>
                        <label className="block text-zinc-300 font-medium mb-1">Membership Plan</label>
                        <select
                          value={genPlan}
                          onChange={(e) => {
                            const p = e.target.value as PlanType;
                            setGenPlan(p);
                            if (p === 'Trial') {
                              setGenDurationDays(1);
                              setGenMaxDevices(1);
                            } else if (p === 'Lifetime') {
                              setGenDurationDays(36500);
                              setGenMaxDevices(3);
                            } else {
                              setGenDurationDays(365);
                              setGenMaxDevices(2);
                            }
                          }}
                          className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-xs"
                        >
                          <option value="Trial">1-Day Free Trial (24 Hours)</option>
                          <option value="Annual">Annual Subscription (365 Days)</option>
                          <option value="Lifetime">Lifetime Subscription (Permanent Access)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-zinc-300 font-medium mb-1">Max Device Limit</label>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={genMaxDevices}
                          onChange={(e) => setGenMaxDevices(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-300 font-medium mb-1">Reference Note</label>
                        <input
                          type="text"
                          value={genNote}
                          onChange={(e) => setGenNote(e.target.value)}
                          placeholder="e.g. VIP Founder Pass"
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-white"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={genLoading}
                        className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl transition"
                      >
                        {genLoading ? 'Generating Key...' : 'Generate Secure Access Key'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 6: DEVICES */}
              {currentTab === 'devices' && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5">
                  <h3 className="font-bold text-white text-base mb-1">Active Hardware Bindings</h3>
                  <p className="text-xs text-zinc-400 mb-4">
                    Windows (`WIN-HWID`) and Android (`AND-AID`) hardware instances bound to active licenses.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-zinc-950 text-zinc-400 uppercase text-[11px] border-b border-zinc-800">
                        <tr>
                          <th className="py-3 px-4">Platform</th>
                          <th className="py-3 px-4">Device Fingerprint</th>
                          <th className="py-3 px-4">Client Name</th>
                          <th className="py-3 px-4">Associated Key</th>
                          <th className="py-3 px-4">Last Seen</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {licenses.flatMap((l) =>
                          l.devices.map((d) => ({ ...d, licId: l.id, licPrefix: l.codePrefix }))
                        ).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-zinc-500">
                              No active device registrations.
                            </td>
                          </tr>
                        ) : (
                          licenses.flatMap((l) =>
                            l.devices.map((d, dIdx) => (
                              <tr key={`${l.id}-${d.deviceId}-${dIdx}`}>
                                <td className="py-3 px-4 uppercase text-cyan-400 font-bold">{d.platform}</td>
                                <td className="py-3 px-4 text-white">{d.deviceId}</td>
                                <td className="py-3 px-4 text-zinc-300">{d.deviceName}</td>
                                <td className="py-3 px-4 text-emerald-400">{l.codePrefix}-****</td>
                                <td className="py-3 px-4 text-zinc-500">
                                  {new Date(d.lastSeenAt).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => handleDeactivateSingleDevice(l.id, d.deviceId)}
                                    className="px-2 py-1 rounded bg-rose-950/60 text-rose-300 hover:bg-rose-900"
                                  >
                                    Disconnect
                                  </button>
                                </td>
                              </tr>
                            ))
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 7: AUDIT LOGS */}
              {currentTab === 'audit' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2">
                    <h3 className="font-bold text-white text-base">Cryptographic Audit Stream</h3>
                    <button
                      onClick={() => fetchAuditLogs()}
                      className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg"
                    >
                      Refresh Logs
                    </button>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-zinc-950 text-zinc-400 uppercase text-[11px] border-b border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-4">Timestamp</th>
                          <th className="py-2.5 px-4">Action</th>
                          <th className="py-2.5 px-4">Actor</th>
                          <th className="py-2.5 px-4">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 text-[11px]">
                        {auditLogs.slice(0, 50).map((log, lIdx) => (
                          <tr key={`${log.id}-${lIdx}`} className="hover:bg-zinc-800/30">
                            <td className="py-2 px-4 text-zinc-500">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="py-2 px-4 text-cyan-400 font-bold">{log.action}</td>
                            <td className="py-2 px-4 text-zinc-300">{log.actor}</td>
                            <td className="py-2 px-4 text-zinc-400 truncate max-w-md">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </main>
          </>
        )}
      </div>

      {/* REVEAL CODE MODAL */}
      {revealCodes.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-bold text-white text-base mb-2">New Access Key Generated</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Save this key now. Plaintext access keys are never stored on the server.
            </p>
            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between font-mono text-cyan-300 font-bold text-sm">
              <span>{revealCodes[0].code}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(revealCodes[0].code);
                  alert('Copied to clipboard');
                }}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setRevealCodes([])}
              className="mt-5 w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl"
            >
              Done / I Have Saved It
            </button>
          </div>
        </div>
      )}

      {/* REVOKE MODAL */}
      {actionModal === 'revoke' && actionTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-rose-900/60 rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-bold text-white text-base mb-2">Revoke License ({actionTarget.codePrefix}-****)</h3>
            <input
              type="text"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Reason for revocation..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setActionModal(null)}
                className="flex-1 py-2 bg-zinc-800 text-zinc-300 text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeConfirm}
                className="flex-1 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl"
              >
                Confirm Revoke
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENEW MODAL */}
      {actionModal === 'renew' && actionTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-cyan-900/60 rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-bold text-white text-base mb-2">Renew License ({actionTarget.codePrefix}-****)</h3>
            <input
              type="number"
              value={renewDays}
              onChange={(e) => setRenewDays(Number(e.target.value))}
              placeholder="Days (e.g. 365)"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white mb-4 font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setActionModal(null)}
                className="flex-1 py-2 bg-zinc-800 text-zinc-300 text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRenewConfirm}
                className="flex-1 py-2 bg-cyan-600 text-white font-bold text-xs rounded-xl"
              >
                Confirm Renewal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET DEVICES MODAL */}
      {actionModal === 'reset' && actionTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-amber-900/60 rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-bold text-white text-base mb-2">Reset Device Activations</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Clear all {actionTarget.devices.length} bound devices from {actionTarget.codePrefix}-****?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setActionModal(null)}
                className="flex-1 py-2 bg-zinc-800 text-zinc-300 text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDevicesConfirm}
                className="flex-1 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function SaveIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
