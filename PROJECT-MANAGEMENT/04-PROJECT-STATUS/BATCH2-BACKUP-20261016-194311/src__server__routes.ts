import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from './db';
import { PlanType, PlatformType } from './types';
import { tradingEngine } from '../services/tradingEngine';
import { decidePublicLicenseRequest } from './publicLicenseRequest';

export const apiRouter = Router();

// In-memory sessions stores
interface AdminSession {
  token: string;
  adminId: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}
const adminSessions = new Map<string, AdminSession>();

interface MemberSession {
  token: string;
  memberId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}
const memberSessions = new Map<string, MemberSession>();

// In-memory rate limiting map: ip -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimiter(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= limit) {
      db.logAudit({
        action: 'RATE_LIMITED',
        actor: ip,
        details: `Exceeded request limit of ${limit} in ${windowMs / 1000}s on ${req.originalUrl}`,
        ip,
      });
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfterMs: entry.resetAt - now,
      });
    }

    entry.count += 1;
    next();
  };
}

// Authentication middlewares
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  const session = adminSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    if (session) adminSessions.delete(token);
    return res.status(401).json({ error: 'Admin session expired or invalid. Please log in again.' });
  }

  (req as any).admin = session;
  next();
}

function requireMember(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please log in to your member account' });
  }

  const token = authHeader.split(' ')[1];
  const session = memberSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    if (session) memberSessions.delete(token);
    return res.status(401).json({ error: 'Member session expired. Please log in again.' });
  }

  (req as any).member = session;
  next();
}

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string) ||
    req.ip ||
    req.socket.remoteAddress ||
    '127.0.0.1'
  );
}

function resolveCaller(req: Request): {
  ownerId: string;
  memberId?: string;
  licenseId?: string;
  actor: string;
  isAuthenticated: boolean;
} {
  // 1. Check member session header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const session = memberSessions.get(token);
    if (session && Date.now() <= session.expiresAt) {
      const member = db.getMemberById(session.memberId);
      if (member) {
        return {
          ownerId: member.id,
          memberId: member.id,
          licenseId: member.licenseId || undefined,
          actor: member.email,
          isAuthenticated: true,
        };
      }
    }
  }

  // 2. Check device license headers
  const licenseToken =
    (req.headers['x-license-token'] as string) || (req.query.licenseToken as string);
  const deviceId =
    (req.headers['x-device-id'] as string) || (req.query.deviceId as string);
  if (licenseToken && deviceId) {
    const status = db.verifyDeviceStatus(licenseToken, deviceId, getClientIp(req));
    if (status.valid && status.license) {
      return {
        ownerId: deviceId,
        licenseId: status.license.id,
        actor: deviceId,
        isAuthenticated: true,
      };
    }
  }

  // 3. Fallback deviceId for unauthenticated or preview mode
  if (deviceId) {
    return {
      ownerId: deviceId,
      actor: deviceId,
      isAuthenticated: false,
    };
  }

  return {
    ownerId: 'anonymous',
    actor: 'anonymous',
    isAuthenticated: false,
  };
}

// Read-only public Solana balance lookup. No wallet secrets, signing, or trading.
// Browser clients call this same-origin endpoint instead of a public RPC directly.
apiRouter.get('/wallet/sol-balance', rateLimiter(30, 60_000), async (req: Request, res: Response) => {
  const address = req.query.address;
  // Base58 alphabet and normal Solana public-key string length; RPC validates the key itself.
  if (typeof address !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid Solana public wallet address' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetch(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
      signal: controller.signal,
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: `Solana RPC HTTP ${upstream.status}` });
    }
    const payload: any = await upstream.json();
    const lamports = payload?.result?.value;
    if (payload?.error || !Number.isSafeInteger(lamports) || lamports < 0) {
      return res.status(502).json({ error: payload?.error?.message || 'Invalid Solana RPC balance response' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ address, lamports, sol: lamports / 1_000_000_000, network: 'mainnet-beta' });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Solana RPC request timed out'
      : 'Solana RPC balance lookup unavailable';
    return res.status(502).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
});

// ==========================================
// 1. PUBLIC PRICING & ORACLE EXCHANGE RATE
// ==========================================

apiRouter.get('/pricing', async (req: Request, res: Response) => {
  try {
    const config = db.getConfig();
    const { rate, source, timestamp } = await db.getLiveSolPriceUsd();

    res.json({
      annualPriceUsd: config.annualPriceUsd,
      lifetimePriceUsd: config.lifetimePriceUsd,
      isConfigured: config.annualPriceUsd !== null,
      isLifetimeConfigured: config.lifetimePriceUsd !== null,
      trialDurationDays: config.trialDurationDays || 1,
      trialDeviceLimit: config.trialDeviceLimit,
      annualDeviceLimit: config.annualDeviceLimit,
      lifetimeDeviceLimit: config.lifetimeDeviceLimit || 3,
      solReceivingAddress: config.solReceivingAddress,
      solRateUsd: rate,
      solRateAvailable: rate > 0 && source !== 'UNAVAILABLE',
      rateSource: source,
      rateTimestamp: timestamp,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch pricing' });
  }
});

// ==========================================
// 2. MEMBER PORTAL AUTHENTICATION
// ==========================================

apiRouter.post('/members/register', rateLimiter(8, 60000), (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const ip = getClientIp(req);

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const member = db.registerMember({ name, email, password, ip });

    // Create session
    const token = crypto.randomBytes(32).toString('hex');
    memberSessions.set(token, {
      token,
      memberId: member.id,
      email: member.email,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      token,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        activePlan: member.activePlan,
        planStatus: member.planStatus,
        trialUsed: member.trialUsed,
        licensePrefix: member.licensePrefix,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

apiRouter.post('/members/login', rateLimiter(15, 60000), (req: Request, res: Response) => {
  const { email, password } = req.body;
  const ip = getClientIp(req);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const member = db.verifyMemberPassword(email, password);
  if (!member) {
    db.logAudit({
      action: 'AUTH_FAILED',
      actor: email,
      details: 'Member login failed: invalid credentials',
      ip,
    });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  memberSessions.set(token, {
    token,
    memberId: member.id,
    email: member.email,
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  db.logAudit({
    action: 'MEMBER_LOGIN',
    actor: member.email,
    details: 'Member logged into member portal',
    ip,
  });

  res.json({
    success: true,
    token,
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      activePlan: member.activePlan,
      planStatus: member.planStatus,
      trialExpiresAt: member.trialExpiresAt,
      annualExpiresAt: member.annualExpiresAt,
      trialUsed: member.trialUsed,
      licenseId: member.licenseId,
      licensePrefix: member.licensePrefix,
    },
  });
});

apiRouter.get('/members/me', requireMember, (req: Request, res: Response) => {
  const session = (req as any).member as MemberSession;
  const member = db.getMemberById(session.memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  // Get associated license if any
  let license = null;
  if (member.licenseId) {
    license = db.getLicenseById(member.licenseId);
  }

  // Get orders
  const orders = db.getAllOrders().filter((o) => o.memberId === member.id);

  res.json({
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      isEmailVerified: member.isEmailVerified,
      activePlan: member.activePlan,
      planStatus: member.planStatus,
      trialExpiresAt: member.trialExpiresAt,
      annualExpiresAt: member.annualExpiresAt,
      trialUsed: member.trialUsed,
      licenseId: member.licenseId,
      licensePrefix: member.licensePrefix,
      createdAt: member.createdAt,
    },
    license: license
      ? {
          id: license.id,
          codePrefix: license.codePrefix,
          type: license.type,
          status: license.status,
          expiresAt: license.expiresAt,
          maxDevices: license.maxDevices,
          devices: license.devices,
        }
      : null,
    orders,
  });
});

apiRouter.post('/members/logout', requireMember, (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    memberSessions.delete(token);
  }
  res.json({ success: true });
});

apiRouter.post('/members/start-trial', requireMember, (req: Request, res: Response) => {
  try {
    const session = (req as any).member as MemberSession;
    const ip = getClientIp(req);
    const result = db.startFreeTrial(session.memberId, ip);

    res.json({
      success: true,
      message: 'Limited Free Trial started successfully!',
      member: result.member,
      accessCode: result.rawCode,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Trial activation failed' });
  }
});

apiRouter.post('/members/reset-password', rateLimiter(5, 60000), (req: Request, res: Response) => {
  const { email } = req.body;
  // Always return success to prevent email enumeration
  res.json({
    success: true,
    message: 'If an account exists with this email, password reset instructions have been dispatched.',
  });
});

// ==========================================
// 3. SOL CHECKOUT & ON-CHAIN VERIFICATION
// ==========================================

apiRouter.post('/checkout/create-quote', requireMember, async (req: Request, res: Response) => {
  try {
    const session = (req as any).member as MemberSession;
    const ip = getClientIp(req);
    const { plan, couponCode } = req.body || {};
    const selectedPlan: 'ANNUAL' | 'LIFETIME' = plan === 'LIFETIME' ? 'LIFETIME' : 'ANNUAL';
    const order = await db.createCheckoutQuote(session.memberId, ip, selectedPlan, couponCode);

    res.json({
      success: true,
      order,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Quote creation failed' });
  }
});

apiRouter.post('/checkout/verify-payment', requireMember, async (req: Request, res: Response) => {
  try {
    const { orderId, txSignature } = req.body || {};
    const session = (req as any).member as MemberSession;
    const ip = getClientIp(req);

    if (!orderId || !txSignature) {
      return res.status(400).json({ error: 'Order ID and transaction signature are required' });
    }

    const result = await db.verifyAndCreditPayment({ orderId, txSignature, ip, memberId: session.memberId });
    if (!result.success) {
      return res.status(400).json({ error: result.error, order: result.order });
    }

    res.json({
      success: true,
      message: `On-chain payment verified! ${result.order.plan === 'LIFETIME' ? 'Lifetime Subscription' : '12-Month Annual Membership'} license issued.`,
      order: result.order,
      accessCode: result.rawCode,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

apiRouter.get('/checkout/orders/:orderId', requireMember, (req: Request, res: Response) => {
  const { orderId } = req.params;
  const order = db.getOrderById(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const session = (req as any).member as MemberSession;
  if (order.memberId !== session.memberId) return res.status(403).json({ error: 'Forbidden' });
  res.json({ order });
});

// ==========================================
// 4. ADMIN PRICING & ORDER MANAGEMENT
// ==========================================

apiRouter.post('/admin/pricing', requireAdmin, (req: Request, res: Response) => {
  try {
    const session = (req as any).admin as AdminSession;
    const { priceUsd, lifetimePriceUsd, reason } = req.body;

    let annualHistory = null;
    let lifetimeHistory = null;

    if (priceUsd !== undefined && priceUsd !== null && priceUsd !== '') {
      annualHistory = db.setAnnualPrice(Number(priceUsd), session.username, reason);
    }

    if (lifetimePriceUsd !== undefined && lifetimePriceUsd !== null && lifetimePriceUsd !== '') {
      lifetimeHistory = db.setLifetimePrice(Number(lifetimePriceUsd), session.username, reason);
    }

    const config = db.getConfig();
    res.json({
      success: true,
      annualPriceUsd: config.annualPriceUsd,
      lifetimePriceUsd: config.lifetimePriceUsd,
      annualHistory,
      lifetimeHistory,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update pricing' });
  }
});

apiRouter.get('/admin/pricing-history', requireAdmin, (req: Request, res: Response) => {
  const config = db.getConfig();
  res.json({
    annualPriceUsd: config.annualPriceUsd,
    priceHistory: config.priceHistory,
  });
});

apiRouter.post('/admin/settings', requireAdmin, (req: Request, res: Response) => {
  try {
    const session = (req as any).admin as AdminSession;
    const updates = req.body;
    const updated = db.updateSystemConfig(updates, session.username);
    res.json({ success: true, config: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update settings' });
  }
});

// --- ADMIN DISCOUNT CODE ROUTES ---

apiRouter.get('/admin/discount-codes', requireAdmin, (_req: Request, res: Response) => {
  res.json({ discountCodes: db.getAllDiscountCodes(), redemptions: db.getDiscountRedemptions() });
});

apiRouter.post('/admin/discount-codes', requireAdmin, (req: Request, res: Response) => {
  try {
    const session = (req as any).admin as AdminSession;
    const { code, percentage, maxUses } = req.body || {};

    const discount = db.createDiscountCode(
      code,
      percentage,
      maxUses,
      session.username
    );

    res.status(201).json({ success: true, discount });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

apiRouter.patch('/admin/discount-codes/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const { active } = req.body || {};

    if (typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Active must be true or false',
      });
    }

    const discount = db.setDiscountCodeActive(
      String(req.params.id),
      active
    );

    res.json({ success: true, discount });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
apiRouter.get('/admin/members', requireAdmin, (req: Request, res: Response) => {
  const members = db.getAllMembers().map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    activePlan: m.activePlan,
    planStatus: m.planStatus,
    trialExpiresAt: m.trialExpiresAt,
    annualExpiresAt: m.annualExpiresAt,
    trialUsed: m.trialUsed,
    licenseId: m.licenseId,
    licensePrefix: m.licensePrefix,
    createdAt: m.createdAt,
    lastLoginAt: m.lastLoginAt,
  }));
  res.json({ members });
});

apiRouter.get('/admin/orders', requireAdmin, (req: Request, res: Response) => {
  const orders = db.getAllOrders();
  res.json({ orders });
});

// ==========================================
// 5. ADMIN AUTH & GENERAL ADMIN ROUTES
// ==========================================

apiRouter.get('/admin/setup-status', (req: Request, res: Response) => {
  res.json({
    needsSetup: !db.hasAdminUser(),
  });
});

apiRouter.post('/admin/setup', rateLimiter(5, 60000), (req: Request, res: Response) => {
  try {
    const expectedSetupKey = process.env.ADMIN_SETUP_KEY;
    const suppliedSetupKey = req.get('x-admin-setup-key');

    if (!expectedSetupKey || !suppliedSetupKey) {
      return res.status(403).json({ error: 'Administrator setup is locked' });
    }

    const expectedBytes = Buffer.from(expectedSetupKey);
    const suppliedBytes = Buffer.from(suppliedSetupKey);

    if (
      expectedBytes.length !== suppliedBytes.length ||
      !crypto.timingSafeEqual(expectedBytes, suppliedBytes)
    ) {
      return res.status(403).json({ error: 'Administrator setup is locked' });
    }
    const { username, password } = req.body;
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const admin = db.createFirstAdmin(username, password);

    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(token, {
      token,
      adminId: admin.id,
      username: admin.username,
      createdAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Setup failed' });
  }
});

apiRouter.post('/admin/login', rateLimiter(10, 60000), (req: Request, res: Response) => {
  const { username, password } = req.body;
  const ip = getClientIp(req);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const admin = db.getAdminByUsername(username);
  if (!admin) {
    db.logAudit({
      action: 'AUTH_FAILED',
      actor: username,
      details: 'Failed login attempt: admin user not found',
      ip,
    });
    return res.status(401).json({ error: 'Invalid username or credentials' });
  }

  const valid = db.verifyPassword(password, admin.passwordHash, admin.salt);
  db.recordAdminLogin(admin.id, valid);

  if (!valid) {
    db.logAudit({
      action: 'AUTH_FAILED',
      actor: username,
      details: 'Failed admin login attempt: incorrect password',
      ip,
    });
    return res.status(401).json({ error: 'Invalid username or credentials' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, {
    token,
    adminId: admin.id,
    username: admin.username,
    createdAt: Date.now(),
    expiresAt: Date.now() + 12 * 60 * 60 * 1000,
  });

  db.logAudit({
    action: 'ADMIN_LOGIN',
    actor: admin.username,
    details: 'Administrator authenticated successfully',
    ip,
  });

  res.json({
    success: true,
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      lastLoginAt: admin.lastLoginAt,
    },
  });
});

apiRouter.post('/admin/logout', requireAdmin, (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    adminSessions.delete(token);
  }
  res.json({ success: true });
});

apiRouter.get('/admin/me', requireAdmin, (req: Request, res: Response) => {
  const session = (req as any).admin as AdminSession;
  const admin = db.getAdminById(session.adminId);
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  res.json({
    id: admin.id,
    username: admin.username,
    role: admin.role,
    lastLoginAt: admin.lastLoginAt,
  });
});

// Admin Code Generator (Supported access: 1-Day Trial, Annual, and Lifetime Subscriptions)
apiRouter.post('/admin/licenses/generate', requireAdmin, (req: Request, res: Response) => {
  const session = (req as any).admin as AdminSession;
  const ip = getClientIp(req);
  const { type, durationDays, maxDevices, note } = req.body;

  const validTypes: PlanType[] = ['Trial', 'Annual', 'Lifetime'];
  const planType: PlanType = validTypes.includes(type) ? type : 'Annual';

  const defaultDevices = planType === 'Trial' ? 1 : planType === 'Lifetime' ? 3 : 2;
  const parsedDevices = Math.max(1, Math.min(10, Number(maxDevices) || defaultDevices));
  const parsedDuration =
    planType === 'Trial'
      ? Number(durationDays) || 1
      : planType === 'Lifetime'
      ? Number(durationDays) || 36500
      : Number(durationDays) || 365;

  const { record, rawCode } = db.createLicense({
    type: planType,
    durationDays: parsedDuration,
    maxDevices: parsedDevices,
    note: typeof note === 'string' ? note.slice(0, 150) : '',
    gracePeriodHours: 72,
    actor: session.username,
    ip,
  });

  res.json({
    success: true,
    license: record,
    accessCode: rawCode,
    warning: 'Save this code securely now. Only its cryptographic hash is stored on the server.',
  });
});

apiRouter.get('/admin/licenses', requireAdmin, (req: Request, res: Response) => {
  const licenses = db.getAllLicenses();
  res.json({ licenses });
});

apiRouter.post('/admin/licenses/:id/revoke', requireAdmin, (req: Request, res: Response) => {
  const session = (req as any).admin as AdminSession;
  const ip = getClientIp(req);
  const { id } = req.params;
  const { reason } = req.body;

  const success = db.revokeLicense(id, reason || 'Administrative action', session.username, ip);
  if (!success) return res.status(404).json({ error: 'License not found' });
  res.json({ success: true, message: `License ${id} revoked.` });
});

apiRouter.post('/admin/licenses/:id/renew', requireAdmin, (req: Request, res: Response) => {
  const session = (req as any).admin as AdminSession;
  const ip = getClientIp(req);
  const { id } = req.params;
  const { additionalDays } = req.body;

  const days = Math.max(1, Number(additionalDays) || 365);
  const result = db.renewLicense(id, days, session.username, ip);

  if (!result.success) return res.status(404).json({ error: 'License not found' });
  res.json({ success: true, newExpiry: result.newExpiry });
});

apiRouter.post('/admin/licenses/:id/reset-devices', requireAdmin, (req: Request, res: Response) => {
  const session = (req as any).admin as AdminSession;
  const ip = getClientIp(req);
  const { id } = req.params;

  const success = db.resetAllDevices(id, session.username, ip);
  if (!success) return res.status(404).json({ error: 'License not found' });
  res.json({ success: true, message: 'Device activations reset.' });
});

apiRouter.delete('/admin/licenses/:id/devices/:deviceId', requireAdmin, (req: Request, res: Response) => {
  const session = (req as any).admin as AdminSession;
  const ip = getClientIp(req);
  const { id, deviceId } = req.params;

  const license = db.getLicenseById(id);
  if (!license) return res.status(404).json({ error: 'License not found' });

  const initialCount = license.devices.length;
  license.devices = license.devices.filter((d) => d.deviceId !== deviceId);

  if (license.devices.length !== initialCount) {
    db.logAudit({
      action: 'DEVICE_DEACTIVATED',
      actor: session.username,
      details: `Deactivated device ${deviceId} on license ${id}`,
      ip,
    });
    res.json({ success: true, message: `Device ${deviceId} disconnected.` });
  } else {
    res.status(404).json({ error: 'Device not found on license' });
  }
});

apiRouter.get('/admin/audit-logs', requireAdmin, (req: Request, res: Response) => {
  const limit = Math.min(1000, Math.max(10, Number(req.query.limit) || 200));
  const actionFilter = typeof req.query.action === 'string' ? req.query.action : undefined;
  let logs = db.getAuditLogs(limit);

  if (actionFilter && actionFilter !== 'ALL') {
    logs = logs.filter((l) => l.action === actionFilter);
  }

  res.json({
    logs,
    total: logs.length,
    fetchedAt: new Date().toISOString(),
  });
});

apiRouter.get('/admin/stats', requireAdmin, (req: Request, res: Response) => {
  const stats = db.getStats();
  res.json({ stats });
});

// ==========================================
// 6. PUBLIC DEVICE LICENSE ACTIVATION & KEY REQUEST API
// ==========================================

apiRouter.post('/license/request-key', rateLimiter(10, 60000), (req: Request, res: Response) => {
  const { name, email, plan } = req.body;
  const ip = getClientIp(req);

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const decision = decidePublicLicenseRequest(plan);
  if (!decision.allowed) {
    db.logAudit({
      action: 'AUTH_FAILED',
      actor: email,
      details: `Rejected unpaid ${String(plan)} public key request`,
      ip,
    });
    return res.status(decision.status).json({
      success: false,
      error: decision.error,
    });
  }

  const primaryKeyResult = db.createLicense({
    type: 'Trial',
    maxDevices: 1,
    durationDays: 1,
    note: `1-Day Trial (24h Manual Only) - ${name || 'User'} (${email})`,
    actor: email,
    ip,
  });

  res.json({
    success: true,
    plan: 'Trial',
    primaryKey: primaryKeyResult.rawCode,
    secondaryKey: null,
    durationDays: primaryKeyResult.record.durationDays,
    maxDevices: primaryKeyResult.record.maxDevices,
    autopilotUnlocked: false,
    instructions: [
      'Copy your 16-character cryptographic license key.',
      'Open the AI Micro Trader Web Terminal, Windows (.exe), or Android (.apk) app.',
      'Paste your key into the activation prompt to bind to your hardware.',
      '1-Day Free Trial (24h): Autopilot mode is locked. You can trade manually with full scanner access.',
      'Annual and Lifetime keys are issued only after verified SOL payment in User Login, or by an administrator.',
    ],
  });
});

apiRouter.post('/license/activate', rateLimiter(8, 60000), (req: Request, res: Response) => {
  const { code, deviceId, platform, deviceName } = req.body;
  const ip = getClientIp(req);

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, state: 'NOT_ACTIVATED', error: 'Access code is required' });
  }

  if (!deviceId || typeof deviceId !== 'string') {
    return res.status(400).json({ success: false, state: 'NOT_ACTIVATED', error: 'Device identifier is required' });
  }

  const validPlatforms: PlatformType[] = ['windows', 'android', 'web'];
  const plat = validPlatforms.includes(platform) ? platform : 'windows';

  const result = db.activateLicense({
    rawCode: code,
    deviceId: deviceId.trim(),
    platform: plat,
    deviceName: typeof deviceName === 'string' ? deviceName.slice(0, 50) : `${plat} Client`,
    ip,
  });

  if (!result.success) {
    return res.status(403).json({
      success: false,
      state: result.state,
      error: result.error,
    });
  }

  res.json({
    success: true,
    state: result.state,
    token: result.token,
    license: {
      id: result.license?.id,
      type: result.license?.type,
      expiresAt: result.license?.expiresAt,
      maxDevices: result.license?.maxDevices,
      activeDevices: result.license?.devices.length,
      gracePeriodHours: result.license?.gracePeriodHours,
    },
  });
});

apiRouter.post('/license/verify', rateLimiter(30, 60000), (req: Request, res: Response) => {
  const { token, deviceId } = req.body;
  const ip = getClientIp(req);

  if (!token || !deviceId) {
    return res.status(400).json({
      valid: false,
      state: 'VALIDATION_REQUIRED',
      error: 'License token and device ID are required',
    });
  }

  const result = db.verifyDeviceStatus(token, deviceId, ip);

  if (!result.valid) {
    return res.status(403).json({
      valid: false,
      state: result.state,
      error: result.error,
    });
  }

  res.json({
    valid: true,
    state: result.state,
    newToken: result.newToken,
    license: {
      id: result.license?.id,
      type: result.license?.type,
      expiresAt: result.license?.expiresAt,
      maxDevices: result.license?.maxDevices,
      activeDevices: result.license?.devices.length,
      gracePeriodHours: result.license?.gracePeriodHours,
    },
  });
});

// ==========================================
// 7. USER API CREDENTIALS MANAGEMENT (PHASE 14 & 15)
// ==========================================

apiRouter.get('/user/api-keys', (req: Request, res: Response) => {
  const caller = resolveCaller(req);
  if (!caller.isAuthenticated && caller.ownerId === 'anonymous') {
    return res.status(401).json({ error: 'Please log in or activate your software device to configure API keys.' });
  }
  const keys = db.getPublicUserApiKeys(caller.ownerId);
  res.json({ keys });
});

apiRouter.post('/user/api-keys', rateLimiter(15, 60000), async (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    if (!caller.isAuthenticated && caller.ownerId === 'anonymous') {
      return res.status(401).json({ error: 'Please log in or activate your software device to configure API keys.' });
    }
    const { jupiterApiKey, goPlusApiKey, goPlusAppKey, goPlusAppSecret } = req.body || {};
    const updated = await db.saveUserApiKeys(
      caller.ownerId,
      { jupiterApiKey, goPlusApiKey, goPlusAppKey, goPlusAppSecret },
      caller.actor
    );
    res.json({ success: true, keys: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to save API credentials' });
  }
});

apiRouter.delete('/user/api-keys/:provider', (req: Request, res: Response) => {
  const caller = resolveCaller(req);
  if (!caller.isAuthenticated && caller.ownerId === 'anonymous') {
    return res.status(401).json({ error: 'Please log in or activate your software device to configure API keys.' });
  }
  const provider = req.params.provider as 'jupiter' | 'goPlus';
  if (provider !== 'jupiter' && provider !== 'goPlus') {
    return res.status(400).json({ error: 'Invalid provider. Must be "jupiter" or "goPlus"' });
  }
  const updated = db.removeUserApiKey(caller.ownerId, provider, caller.actor);
  res.json({ success: true, keys: updated });
});

apiRouter.post('/user/api-keys/:provider/test', async (req: Request, res: Response) => {
  const caller = resolveCaller(req);
  if (!caller.isAuthenticated && caller.ownerId === 'anonymous') {
    return res.status(401).json({ error: 'Please log in or activate your software device to configure API keys.' });
  }
  const provider = req.params.provider as 'jupiter' | 'goPlus';
  if (provider !== 'jupiter' && provider !== 'goPlus') {
    return res.status(400).json({ error: 'Invalid provider. Must be "jupiter" or "goPlus"' });
  }
  const result = await db.testUserApiKey(caller.ownerId, provider);
  res.json(result);
});

// ==========================================
// 8. FEATURE ENTITLEMENTS & AUTOPILOT RESTRICTIONS
// ==========================================

apiRouter.get('/user/entitlements', (req: Request, res: Response) => {
  const caller = resolveCaller(req);
  const entitlements = db.checkEntitlements({
    memberId: caller.memberId,
    licenseId: caller.licenseId,
    deviceId: caller.ownerId,
  });
  res.json({ entitlements });
});

apiRouter.post('/trading/autopilot/enable', (req: Request, res: Response) => {
  const caller = resolveCaller(req);
  const entitlements = db.checkEntitlements({
    memberId: caller.memberId,
    licenseId: caller.licenseId,
    deviceId: caller.ownerId,
  });

  // NON-NEGOTIABLE PHASE 14 RULE:
  // Free-trial users must never be able to use Autopilot.
  // Enforced by backend regardless of repeated calls or modified client code.
  if (!entitlements.autopilotAllowed) {
    return res.status(403).json({
      success: false,
      error:
        'Autopilot is strictly restricted to active Paid Annual and Lifetime memberships. Free trial accounts are limited to Manual Trading.',
      entitlements,
    });
  }

  tradingEngine.setAutopilot(true);
  res.json({
    success: true,
    message: 'Autopilot enabled. 15-minute cycle scheduler active.',
    status: tradingEngine.getCycleStatus(),
  });
});

apiRouter.post('/trading/autopilot/disable', (req: Request, res: Response) => {
  tradingEngine.setAutopilot(false);
  res.json({
    success: true,
    message: 'Autopilot turned OFF. Open positions remain continuously monitored and protected.',
    status: tradingEngine.getCycleStatus(),
  });
});

apiRouter.post('/trading/scheduler/start', (req: Request, res: Response) => {
  const caller = resolveCaller(req);
  const entitlements = db.checkEntitlements({
    memberId: caller.memberId,
    licenseId: caller.licenseId,
    deviceId: caller.ownerId,
  });

  // NON-NEGOTIABLE RULE: Free-trial accounts cannot start the 15-minute cycle scheduler
  if (!entitlements.cycles15MinAllowed) {
    return res.status(403).json({
      success: false,
      error:
        'Automatic 15-minute trading cycle scheduler is strictly restricted to active Paid Annual and Lifetime memberships.',
      entitlements,
    });
  }

  tradingEngine.startEngineLoop();
  res.json({
    success: true,
    message: 'Authoritative 15-minute cycle scheduler running.',
    status: tradingEngine.getCycleStatus(),
  });
});

// ==========================================
// 9. MANUAL TRADING WITH EXPLICIT CONFIRMATION
// ==========================================

apiRouter.post('/trading/manual/confirm-order', rateLimiter(40, 60000), (req: Request, res: Response) => {
  const caller = resolveCaller(req);
  const entitlements = db.checkEntitlements({
    memberId: caller.memberId,
    licenseId: caller.licenseId,
    deviceId: caller.ownerId,
  });

  const isPaperExecution = req.body.isPaperMode !== false || tradingEngine.isPaperMode();

  if (!isPaperExecution && !entitlements.manualTrading) {
    return res.status(403).json({
      success: false,
      error: entitlements.reason || 'Manual live trading is not permitted under current account status.',
    });
  }

  const {
    symbol,
    mint,
    amountSol,
    slippage,
    priorityFeeTier,
    confirmedByUser,
    idempotencyKey,
    stopLossPercent,
    profitTargetPercent,
    trailingStopActive,
    trailingStopMarginPercent,
  } = req.body;

  // NON-NEGOTIABLE: Manual mode must never place an entry trade without the user's explicit confirmation!
  if (confirmedByUser !== true) {
    return res.status(400).json({
      success: false,
      error: 'Explicit manual confirmation is strictly required before submitting trade order.',
    });
  }

  const solAmount = parseFloat(amountSol);
  if (isNaN(solAmount) || solAmount <= 0) {
    return res.status(400).json({ success: false, error: 'Valid SOL amount is required.' });
  }

  const result = tradingEngine.executeBuyOrder({
    symbol: symbol || 'UNKNOWN',
    mint: mint || '',
    amountSol: solAmount,
    slippage: Number(slippage) || 1.0,
    priorityFeeTier: priorityFeeTier || 'Turbo',
    isAuto: false,
    idempotencyKey,
    stopLossPercent: stopLossPercent !== undefined ? Number(stopLossPercent) : undefined,
    profitTargetPercent: profitTargetPercent !== undefined ? Number(profitTargetPercent) : undefined,
    trailingStopActive: Boolean(trailingStopActive),
    trailingStopMarginPercent: trailingStopMarginPercent !== undefined ? Number(trailingStopMarginPercent) : undefined,
  });

  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  res.json({
    success: true,
    order: result.order,
    message: `Manual trade confirmed and executed for ${symbol} (${solAmount} SOL)`,
  });
});

apiRouter.post('/trading/positions/:id/adjust-margins', (req: Request, res: Response) => {
  const { id } = req.params;
  const { stopLossPercent, profitTargetPercent, trailingStopActive, trailingStopMarginPercent } = req.body;

  const result = tradingEngine.updatePositionExitRules(id, {
    stopLossPercent: stopLossPercent !== undefined ? Number(stopLossPercent) : undefined,
    profitTargetPercent: profitTargetPercent !== undefined ? Number(profitTargetPercent) : undefined,
    trailingStopActive: trailingStopActive !== undefined ? Boolean(trailingStopActive) : undefined,
    trailingStopMarginPercent: trailingStopMarginPercent !== undefined ? Number(trailingStopMarginPercent) : undefined,
  });

  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  res.json({ success: true, position: result.position });
});

apiRouter.get('/trading/activity-logs', (req: Request, res: Response) => {
  res.json({ logs: tradingEngine.getActivityLogs() });
});

// Risk Management Engine Endpoints
apiRouter.get('/trading/risk/config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    config: tradingEngine.getRiskConfig(),
    status: tradingEngine.getDailyRiskStatus(),
  });
});

apiRouter.post('/trading/risk/config', (req: Request, res: Response) => {
  const updated = tradingEngine.updateRiskConfig(req.body);
  res.json({
    success: true,
    message: 'Risk management configuration updated successfully.',
    config: updated,
    status: tradingEngine.getDailyRiskStatus(),
  });
});

apiRouter.post('/trading/risk/reset-circuit-breaker', (_req: Request, res: Response) => {
  tradingEngine.resetDailyStopLossTrigger();
  res.json({
    success: true,
    message: 'Daily stop-loss circuit breaker reset successfully.',
    status: tradingEngine.getDailyRiskStatus(),
  });
});

apiRouter.post('/trading/risk/test-circuit-breaker', (_req: Request, res: Response) => {
  tradingEngine.testTriggerDailyStopLoss();
  res.json({
    success: true,
    message: 'Daily stop-loss circuit breaker test triggered.',
    status: tradingEngine.getDailyRiskStatus(),
  });
});
