import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  AdminUser,
  ApiConnectionStatus,
  AuditLog,
  CheckoutOrder,
  DiscountCode,
  DiscountRedemption,
  ClientApiKeysPublic,
  DeviceRecord,
  FeatureEntitlements,
  LicenseRecord,
  LicenseStatus,
  MemberUser,
  OrderStatus,
  PlanType,
  PlatformType,
  PriceHistoryRecord,
  SystemConfig,
  UserApiCredentials,
  ValidationTokenPayload,
} from './types';

interface DatabaseSchema {
  version: number;
  serverSecret: string;
  config: SystemConfig;
  adminUsers: AdminUser[];
  members: MemberUser[];
  orders: CheckoutOrder[];
  discountCodes: DiscountCode[];
  discountRedemptions: DiscountRedemption[];
  licenses: LicenseRecord[];
  auditLogs: AuditLog[];
  userApiKeys: UserApiCredentials[];
}

const DATA_DIR = path.resolve(process.env.AMT_DATA_DIR || path.join(process.cwd(), 'data'));
const DB_FILE = path.join(DATA_DIR, 'licensing_db.json');

// Default Solana Receiving Wallet (Can be edited by Admin in Admin Panel)
const DEFAULT_SOL_RECEIVING_ADDRESS = 'NEXTGEN7xM9vP4qL2sY5wZ1k8T3uR6hJ9bC4eF2aD1mE';
const DEFAULT_SOL_RPC_URL = 'https://api.mainnet-beta.solana.com';

type CouponSnapshot = {
  discountCodeId: string;
  code: string;
  percentage: number;
  originalPriceUsd: number;
  discountAmountUsd: number;
  finalPriceUsd: number;
};
type CouponOrder = CheckoutOrder & { discount?: CouponSnapshot };

class LicensingDatabase {
  private data: DatabaseSchema;
  private isLoaded = false;
  private verifyingOrders = new Set<string>();
  private quotingMembers = new Set<string>();
  private cachedSolRate: { rate: number; timestamp: number } | null = null;

  constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
    this.isLoaded = true;
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (!parsed.serverSecret) {
          parsed.serverSecret = crypto.randomBytes(32).toString('hex');
        }
        if (!parsed.config) {
          parsed.config = {
            annualPriceUsd: null, // Clearly marked unconfigured until admin sets it
            lifetimePriceUsd: null, // Clearly marked unconfigured until admin sets it
            trialDurationDays: 1, // 1-Day Free Trial only
            trialDeviceLimit: 1,
            annualDeviceLimit: 2,
            lifetimeDeviceLimit: 3,
            solReceivingAddress: DEFAULT_SOL_RECEIVING_ADDRESS,
            solRpcUrl: DEFAULT_SOL_RPC_URL,
            priceHistory: [],
          };
        } else {
          if (parsed.config.trialDurationDays === undefined || parsed.config.trialDurationDays === 7) {
            parsed.config.trialDurationDays = 1;
          }
          if (parsed.config.lifetimePriceUsd === undefined) {
            parsed.config.lifetimePriceUsd = null;
          }
          if (parsed.config.lifetimeDeviceLimit === undefined) {
            parsed.config.lifetimeDeviceLimit = 3;
          }
        }
        if (!parsed.members) parsed.members = [];
        if (!parsed.orders) parsed.orders = [];
        if (!parsed.discountCodes) parsed.discountCodes = [];
        if (!parsed.discountRedemptions) parsed.discountRedemptions = [];
        if (!parsed.userApiKeys) parsed.userApiKeys = [];
        return parsed;
      } catch (err) {
        console.error('CRITICAL: Existing licensing database could not be loaded. Startup aborted.', err); throw err;
      }
    }

    const initial: DatabaseSchema = {
      version: 2,
      serverSecret: crypto.randomBytes(32).toString('hex'),
      config: {
        annualPriceUsd: null, // Unconfigured by default
        lifetimePriceUsd: null, // Unconfigured by default
        trialDurationDays: 1, // 1-Day Free Trial only
        trialDeviceLimit: 1,
        annualDeviceLimit: 2,
        lifetimeDeviceLimit: 3,
        solReceivingAddress: DEFAULT_SOL_RECEIVING_ADDRESS,
        solRpcUrl: DEFAULT_SOL_RPC_URL,
        priceHistory: [],
      },
      discountCodes: [],
      discountRedemptions: [],
      adminUsers: [],
      members: [],
      orders: [],
      licenses: [],
      auditLogs: [],
      userApiKeys: [],
    };
    this.saveData(initial);
    return initial;
  }

  private saveData(dataToSave = this.data) {
    this.ensureDataDir();
    const tempFile = `${DB_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
    try {
      fs.renameSync(tempFile, DB_FILE);
    } catch {
      fs.copyFileSync(tempFile, DB_FILE);
      fs.unlinkSync(tempFile);
    }
  }

  public getServerSecret(): string {
    return this.data.serverSecret;
  }

  // --- CRYPTO UTILS ---

  public hashAccessCode(code: string): string {
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return crypto.createHash('sha256').update(clean).digest('hex');
  }

  public generateSecureAccessCode(): string {
    const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const bytes = crypto.randomBytes(16);
    let chars = '';
    for (let i = 0; i < bytes.length && chars.length < 12; i++) {
      const idx = bytes[i] % charset.length;
      chars += charset[idx];
    }
    while (chars.length < 12) {
      const extraByte = crypto.randomBytes(1)[0];
      chars += charset[extraByte % charset.length];
    }
    return `MTR-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
  }

  public hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, useSalt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt: useSalt };
  }

  public verifyPassword(password: string, hash: string, salt: string): boolean {
    const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  }

  public signLicenseToken(payload: ValidationTokenPayload): string {
    const payloadStr = JSON.stringify(payload);
    const encodedPayload = Buffer.from(payloadStr).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.data.serverSecret)
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedPayload}.${signature}`;
  }

  public verifyLicenseToken(token: string): ValidationTokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const [encodedPayload, signature] = parts;
      const expectedSig = crypto
        .createHmac('sha256', this.data.serverSecret)
        .update(encodedPayload)
        .digest('base64url');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return null;
      }
      const rawPayload = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
      return JSON.parse(rawPayload) as ValidationTokenPayload;
    } catch {
      return null;
    }
  }

  // --- CONFIG & DYNAMIC ANNUAL PRICING ---

  public getConfig(): SystemConfig {
    return { ...this.data.config };
  }

  public setAnnualPrice(
    newPriceUsd: number,
    adminUsername: string,
    reason?: string
  ): PriceHistoryRecord {
    if (typeof newPriceUsd !== 'number' || isNaN(newPriceUsd) || newPriceUsd <= 0) {
      throw new Error('Annual price must be a positive number');
    }

    const oldPriceUsd = this.data.config.annualPriceUsd;
    const historyEntry: PriceHistoryRecord = {
      id: `price_${Date.now()}`,
      oldPriceUsd,
      newPriceUsd: +newPriceUsd.toFixed(2),
      changedAt: new Date().toISOString(),
      adminUsername,
      reason: reason || 'Admin price update',
    };

    this.data.config.annualPriceUsd = +newPriceUsd.toFixed(2);
    this.data.config.priceHistory.unshift(historyEntry);
    this.saveData();

    this.logAudit({
      action: 'PRICE_CHANGED',
      actor: adminUsername,
      details: `Annual price updated from ${oldPriceUsd !== null ? '$' + oldPriceUsd : 'Unconfigured'} to $${newPriceUsd}`,
      ip: '127.0.0.1',
    });

    return historyEntry;
  }

  public setLifetimePrice(
    newPriceUsd: number,
    adminUsername: string,
    reason?: string
  ): PriceHistoryRecord {
    if (typeof newPriceUsd !== 'number' || isNaN(newPriceUsd) || newPriceUsd <= 0) {
      throw new Error('Lifetime price must be a positive number');
    }

    const oldPriceUsd = this.data.config.lifetimePriceUsd || null;
    const historyEntry: PriceHistoryRecord = {
      id: `price_${Date.now()}`,
      plan: 'LIFETIME',
      oldPriceUsd,
      newPriceUsd: +newPriceUsd.toFixed(2),
      changedAt: new Date().toISOString(),
      adminUsername,
      reason: reason || 'Admin lifetime price update',
    };

    this.data.config.lifetimePriceUsd = +newPriceUsd.toFixed(2);
    this.data.config.priceHistory.unshift(historyEntry);
    this.saveData();

    this.logAudit({
      action: 'PRICE_CHANGED',
      actor: adminUsername,
      details: `Lifetime price updated from ${oldPriceUsd !== null ? '$' + oldPriceUsd : 'Unconfigured'} to $${newPriceUsd}`,
      ip: '127.0.0.1',
    });

    return historyEntry;
  }

  public updateSystemConfig(
    updates: Partial<SystemConfig>,
    adminUsername: string
  ): SystemConfig {
    if (updates.trialDurationDays !== undefined) {
      this.data.config.trialDurationDays = Math.max(1, updates.trialDurationDays);
    }
    if (updates.trialDeviceLimit !== undefined) {
      this.data.config.trialDeviceLimit = Math.max(1, updates.trialDeviceLimit);
    }
    if (updates.annualDeviceLimit !== undefined) {
      this.data.config.annualDeviceLimit = Math.max(1, updates.annualDeviceLimit);
    }
    if (updates.lifetimeDeviceLimit !== undefined) {
      this.data.config.lifetimeDeviceLimit = Math.max(1, updates.lifetimeDeviceLimit);
    }
    if (updates.lifetimePriceUsd !== undefined) {
      this.data.config.lifetimePriceUsd = updates.lifetimePriceUsd;
    }
    if (updates.solReceivingAddress && typeof updates.solReceivingAddress === 'string') {
      this.data.config.solReceivingAddress = updates.solReceivingAddress.trim();
    }
    if (updates.solRpcUrl && typeof updates.solRpcUrl === 'string') {
      this.data.config.solRpcUrl = updates.solRpcUrl.trim();
    }

    this.saveData();
    this.logAudit({
      action: 'CONFIG_UPDATED',
      actor: adminUsername,
      details: 'System config parameters updated',
      ip: '127.0.0.1',
    });
    return this.getConfig();
  }

  // --- SOL/USD EXCHANGE RATE ENGINE ---

  public async getLiveSolPriceUsd(): Promise<{ rate: number; source: string; timestamp: string }> {
    // Return cached if younger than 45 seconds
    const now = Date.now();
    if (this.cachedSolRate && now - this.cachedSolRate.timestamp < 45000) {
      return {
        rate: this.cachedSolRate.rate,
        source: 'Jupiter DEX Price API (Cached)',
        timestamp: new Date(this.cachedSolRate.timestamp).toISOString(),
      };
    }

    // Try Jupiter Price API
    try {
      const res = await fetch(
        'https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112',
        { signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        const json = await res.json();
        const priceStr = json.data?.['So11111111111111111111111111111111111111112']?.price;
        const rate = parseFloat(priceStr);
        if (!isNaN(rate) && rate > 0) {
          this.cachedSolRate = { rate: +rate.toFixed(2), timestamp: now };
          return {
            rate: +rate.toFixed(2),
            source: 'Jupiter Aggregator Oracle',
            timestamp: new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      // Fallback
    }

    // Fallback to CoinGecko
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
        { signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        const json = await res.json();
        const rate = parseFloat(json.solana?.usd);
        if (!isNaN(rate) && rate > 0) {
          this.cachedSolRate = { rate: +rate.toFixed(2), timestamp: now };
          return {
            rate: +rate.toFixed(2),
            source: 'CoinGecko Price Feed',
            timestamp: new Date().toISOString(),
          };
        }
      }
    } catch (e) {
      // Fallback
    }

    // If cache available even if older
    if (this.cachedSolRate) {
      return {
        rate: this.cachedSolRate.rate,
        source: 'Solana Network Feed (Recent)',
        timestamp: new Date(this.cachedSolRate.timestamp).toISOString(),
      };
    }

    return {
      rate: 0,
      source: 'UNAVAILABLE',
      timestamp: new Date().toISOString(),
    };
  }

  // --- MEMBER PORTAL & USERS ---

  public registerMember(params: {
    name: string;
    email: string;
    password: string;
    ip: string;
  }): MemberUser {
    const emailClean = params.email.trim().toLowerCase();
    const existing = this.data.members.find((m) => m.email.toLowerCase() === emailClean);
    if (existing) {
      throw new Error('An account with this email address already exists');
    }

    if (params.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const { hash, salt } = this.hashPassword(params.password);
    const member: MemberUser = {
      id: `mem_${crypto.randomBytes(8).toString('hex')}`,
      name: params.name.trim(),
      email: emailClean,
      passwordHash: hash,
      salt,
      isEmailVerified: true, // Auto-verified upon registration
      activePlan: 'NONE',
      planStatus: 'NONE',
      trialExpiresAt: null,
      annualExpiresAt: null,
      trialUsed: false,
      licenseId: null,
      licensePrefix: null,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      termsAcceptedAt: new Date().toISOString(),
    };

    this.data.members.push(member);
    this.saveData();

    this.logAudit({
      action: 'MEMBER_REGISTERED',
      actor: member.email,
      details: `New member account created: ${member.name} (${member.email})`,
      ip: params.ip,
    });

    return member;
  }

  public getMemberByEmail(email: string): MemberUser | undefined {
    return this.data.members.find((m) => m.email.toLowerCase() === email.trim().toLowerCase());
  }

  public getMemberById(id: string): MemberUser | undefined {
    return this.data.members.find((m) => m.id === id);
  }

  public verifyMemberPassword(email: string, password: string): MemberUser | null {
    const member = this.getMemberByEmail(email);
    if (!member) return null;
    const valid = this.verifyPassword(password, member.passwordHash, member.salt);
    if (!valid) return null;
    member.lastLoginAt = new Date().toISOString();
    this.saveData();
    return member;
  }

  public getAllMembers(): MemberUser[] {
    return this.data.members;
  }

  // --- LIMITED FREE TRIAL (ONLY 3 ACCESS TIERS: 1-DAY TRIAL, ANNUAL & LIFETIME SUBSCRIPTIONS) ---

  public startFreeTrial(memberId: string, ip: string): { success: boolean; member: MemberUser; rawCode: string } {
    const member = this.getMemberById(memberId);
    if (!member) throw new Error('Member not found');

    if (member.trialUsed) {
      throw new Error('1-Day Free Trial has already been used for this account');
    }

    if (member.activePlan === 'ANNUAL' || member.activePlan === 'LIFETIME') {
      throw new Error('Member already holds an active paid membership subscription');
    }

    const trialDays = this.data.config.trialDurationDays || 1; // 1-Day Free Trial only
    const maxDevices = this.data.config.trialDeviceLimit || 1;
    const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    // Create Trial License
    const { record: license, rawCode } = this.createLicense({
      type: 'Trial',
      durationDays: trialDays,
      maxDevices,
      note: `1-Day Free Trial for ${member.email}`,
      gracePeriodHours: 24,
      actor: member.email,
      ip,
    });

    license.memberId = member.id;
    member.trialUsed = true;
    member.activePlan = 'TRIAL';
    member.planStatus = 'TRIAL_ACTIVE';
    member.trialExpiresAt = expiresAt;
    member.licenseId = license.id;
    member.licensePrefix = license.codePrefix;

    this.saveData();

    this.logAudit({
      action: 'TRIAL_STARTED',
      actor: member.email,
      details: `1-Day Free Trial initiated for ${member.email} (Expires ${expiresAt})`,
      ip,
    });

    return { success: true, member, rawCode };
  }

  // --- ADMIN DISCOUNT CODE MANAGEMENT ---

  public createDiscountCode(
    code: string,
    percentage: number,
    maxUses: number,
    createdBy: string
  ): DiscountCode {
    const cleanCode = String(code || '').trim().toUpperCase();

    if (!/^[A-Z0-9_-]{3,32}$/.test(cleanCode)) {
      throw new Error('Discount code must contain 3-32 letters, numbers, underscores or hyphens');
    }

    if (!Number.isInteger(percentage) || percentage < 1 || percentage > 50) {
      throw new Error('Discount percentage must be a whole number between 1 and 50');
    }

    if (!Number.isSafeInteger(maxUses) || maxUses < 1) {
      throw new Error('Maximum uses must be a positive whole number');
    }

    if (this.data.discountCodes.some((item) => item.code === cleanCode)) {
      throw new Error('This discount code already exists');
    }

    const discount: DiscountCode = {
      id: `disc_${crypto.randomBytes(8).toString('hex')}`,
      code: cleanCode,
      percentage,
      maxUses,
      usedCount: 0,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    this.data.discountCodes.unshift(discount);
    this.saveData();

    return discount;
  }

  public getAllDiscountCodes() {
    return this.data.discountCodes.map((discount) => ({
      ...discount,
      remainingUses: Math.max(0, discount.maxUses - discount.usedCount),
    }));
  }

  public getDiscountRedemptions() {
    return this.data.discountRedemptions.map((redemption) => ({
      ...redemption,
      memberEmail: this.getMemberById(redemption.memberId)?.email || '',
      memberName: this.getMemberById(redemption.memberId)?.name || '',
    }));
  }

  public setDiscountCodeActive(id: string, active: boolean): DiscountCode {
    const discount = this.data.discountCodes.find((item) => item.id === id);

    if (!discount) {
      throw new Error('Discount code not found');
    }

    if (typeof active !== 'boolean') {
      throw new Error('Active status must be true or false');
    }

    discount.active = active;
    this.saveData();

    return discount;
  }
  // --- SOL CHECKOUT & ON-CHAIN PAYMENT VERIFICATION ---

  public async createCheckoutQuote(
    memberId: string,
    ip: string,
    plan: 'ANNUAL' | 'LIFETIME' = 'ANNUAL',
    couponCode = ''
  ): Promise<CheckoutOrder> {
    const member = this.getMemberById(memberId);
    if (!member) throw new Error('Member not found');
    if (this.quotingMembers.has(memberId)) throw new Error('A checkout quote is already being created. Please try again.');
    this.quotingMembers.add(memberId);
    try {
      const config = this.getConfig();
      const originalPriceUsd = plan === 'LIFETIME' ? config.lifetimePriceUsd : config.annualPriceUsd;
      if (originalPriceUsd === null || originalPriceUsd === undefined || originalPriceUsd <= 0) {
        throw new Error('Membership price is not configured. Please contact support.');
      }
      const clean = String(couponCode || '').trim().toUpperCase();
      // Rate retrieval can await network calls. Recheck coupon availability afterwards.
      const { rate, source, timestamp } = await this.getLiveSolPriceUsd();
      if (!rate || rate <= 0) throw new Error('SOL/USD exchange rate unavailable. Checkout stopped.');
      let discount: CouponSnapshot | undefined;
      if (clean) {
        const code = this.data.discountCodes.find((d) => d.code === clean);
        if (!code || !code.active) throw new Error('Coupon is invalid or inactive.');
        if (this.data.discountRedemptions.some((r) => r.memberId === memberId && r.discountCodeId === code.id)) {
          throw new Error('You have already redeemed this coupon.');
        }
        const now = Date.now();
        const reservations = this.data.orders.filter((item) => {
          const o = item as CouponOrder;
          return o.discount?.discountCodeId === code.id &&
            (o.status === 'ORDER_CREATED' || o.status === 'PAYMENT_VERIFYING') &&
            new Date(o.expiresAt).getTime() > now;
        });
        if (code.usedCount + reservations.filter((o) => o.memberId !== memberId).length >= code.maxUses) {
          throw new Error('Coupon has reached its maximum number of uses.');
        }
        if (reservations.some((o) => o.memberId === memberId && o.status === 'PAYMENT_VERIFYING')) {
          throw new Error('Your previous coupon payment is being verified. Please wait.');
        }
        // Supersede an earlier unpaid quote for this member/coupon, so it does not reserve twice.
        for (const item of reservations) {
          if (item.memberId === memberId && item.status === 'ORDER_CREATED') {
            item.status = 'PAYMENT_FAILED';
          }
        }
        const discountAmountUsd = +(originalPriceUsd * code.percentage / 100).toFixed(2);
        discount = {
          discountCodeId: code.id, code: code.code, percentage: code.percentage,
          originalPriceUsd, discountAmountUsd,
          finalPriceUsd: +(originalPriceUsd - discountAmountUsd).toFixed(2),
        };
      }
      const priceUsd = discount?.finalPriceUsd ?? originalPriceUsd;
      const solAmount = Math.ceil((priceUsd / rate) * 10000) / 10000;
      const now = Date.now();
      const order: CouponOrder = {
        id: `ord_${crypto.randomBytes(8).toString('hex')}`,
        memberId: member.id, memberEmail: member.email, plan,
        usdPrice: priceUsd, solAmount, solRateUsd: rate, rateSource: source,
        rateTimestamp: timestamp, receivingWallet: config.solReceivingAddress,
        network: 'solana-mainnet', createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 5 * 60 * 1000).toISOString(),
        status: 'ORDER_CREATED', txSignature: null, confirmedAt: null,
        licenseId: null, licensePrefix: null, discount,
      };
      this.data.orders.unshift(order);
      this.saveData();
      this.logAudit({
        action: 'QUOTE_CREATED', actor: member.email,
        details: `${plan} quote ${order.id}: ${solAmount} SOL ($${priceUsd} USD)${discount ? ` coupon ${discount.code}` : ''}`,
        ip,
      });
      return order;
    } finally {
      this.quotingMembers.delete(memberId);
    }
  }

  public getOrderById(orderId: string): CheckoutOrder | undefined {
    return this.data.orders.find((o) => o.id === orderId);
  }

  public getAllOrders(): CheckoutOrder[] {
    return this.data.orders;
  }

  public async verifyAndCreditPayment(params: {
    orderId: string;
    txSignature: string;
    ip: string;
    memberId: string;
  }): Promise<{
    success: boolean;
    order: CheckoutOrder;
    rawCode?: string;
    error?: string;
  }> {
    const order = this.getOrderById(params.orderId);
    if (!order) {
      return { success: false, error: 'Order not found', order: null as any };
    }

    if (order.memberId !== params.memberId) {
      return { success: false, error: 'Order does not belong to this member.', order };
    }
    if (order.status === 'PAYMENT_FAILED' || order.status === 'PAYMENT_REVIEW_REQUIRED') {
      return { success: false, error: 'This order cannot be verified automatically. Contact support if you already paid.', order };
    }
    if (order.status === 'LICENSE_ISSUED') {
      return { success: false, error: 'This order was already credited.', order };
    }
    if (order.status === 'PAYMENT_VERIFYING' && order.txSignature && order.txSignature !== params.txSignature.trim()) {
      return { success: false, error: 'A different payment signature is already attached to this order.', order };
    }
    if (this.verifyingOrders.has(order.id)) {
      return { success: false, error: 'Verification is already in progress for this order.', order };
    }
    const sigClean = params.txSignature.trim();
    if (!sigClean || sigClean.length < 32) {
      return { success: false, error: 'Invalid transaction signature format', order };
    }

    // Idempotency: Ensure this signature has not already been used for another credited order
    const duplicate = this.data.orders.find(
      (o) => o.id !== order.id && o.txSignature === sigClean && (o.status === 'LICENSE_ISSUED' || this.verifyingOrders.has(o.id))
    );
    if (duplicate) {
      this.logAudit({
        action: 'PAYMENT_REJECTED',
        actor: order.memberEmail,
        details: `Rejected duplicate signature reuse: ${sigClean}`,
        ip: params.ip,
      });
      return {
        success: false,
        error: 'This transaction signature has already been credited to another order.',
        order,
      };
    }

    this.verifyingOrders.add(order.id);
    order.txSignature = sigClean;
    order.status = 'PAYMENT_VERIFYING';
    this.saveData();

    try {
      // Connect to Solana RPC
      const rpcUrl = this.data.config.solRpcUrl || DEFAULT_SOL_RPC_URL;
      const connection = new Connection(rpcUrl, 'finalized');

      // Query on-chain transaction
      const tx = await connection.getParsedTransaction(sigClean, {
        maxSupportedTransactionVersion: 0,
        commitment: 'finalized',
      });

      if (!tx) {
        order.status = 'ORDER_CREATED';
        this.saveData();
        return {
          success: false,
          error:
            'Transaction not found or not yet finalized on Solana mainnet. Please wait a few seconds and try again.',
          order,
        };
      }

      if (tx.meta?.err) {
        order.status = 'PAYMENT_FAILED';
        order.verificationDetails = { error: 'On-chain transaction execution failed' };
        this.saveData();
        return { success: false, error: 'The on-chain transaction failed on Solana.', order };
      }

      // Verify native SOL transfer to configured receiving address
      const expectedReceiver = new PublicKey(order.receivingWallet).toBase58();
      let lamportsReceived = 0;

      // Inspect instructions for native SystemProgram transfer
      const instructions = tx.transaction.message.instructions;
      for (const ix of instructions) {
        if ('parsed' in ix && ix.program === 'system' && ix.parsed.type === 'transfer') {
          const info = ix.parsed.info;
          if (info.destination === expectedReceiver) {
            lamportsReceived += Number(info.lamports) || 0;
          }
        }
      }

      // Also inspect postBalances / preBalances for receiving account
      if (lamportsReceived === 0 && tx.meta) {
        const accountKeys = tx.transaction.message.accountKeys.map((k) =>
          typeof k === 'string' ? k : k.pubkey.toBase58()
        );
        const receiverIndex = accountKeys.indexOf(expectedReceiver);
        if (receiverIndex !== -1) {
          const pre = tx.meta.preBalances[receiverIndex] || 0;
          const post = tx.meta.postBalances[receiverIndex] || 0;
          const diff = post - pre;
          if (diff > 0) {
            lamportsReceived = diff;
          }
        }
      }

      const solReceived = lamportsReceived / 1e9;
      // Allow minor 0.5% tolerance for rounding difference
      const requiredSolTolerance = order.solAmount * 0.995;

      if (solReceived < requiredSolTolerance) {
        order.status = 'PAYMENT_REVIEW_REQUIRED';
        order.verificationDetails = {
          solReceived,
          lamportsReceived,
          error: `Underpaid: Received ${solReceived} SOL but required ${order.solAmount} SOL`,
          verifiedAt: new Date().toISOString(),
        };
        this.saveData();
        return {
          success: false,
          error: `Payment underpaid: received ${solReceived.toFixed(4)} SOL, required ${order.solAmount} SOL.`,
          order,
        };
      }

      // A coupon is credited only after verified on-chain payment.
      const coupon = (order as CouponOrder).discount;
      if (coupon) {
        const code = this.data.discountCodes.find((d) => d.id === coupon.discountCodeId);
        const redeemed = this.data.discountRedemptions.some((r) =>
          r.memberId === order.memberId && r.discountCodeId === coupon.discountCodeId
        );
        if (!code || redeemed || code.usedCount >= code.maxUses) {
          order.status = 'PAYMENT_REVIEW_REQUIRED';
          order.verificationDetails = {
            solReceived, lamportsReceived, verifiedAt: new Date().toISOString(),
            error: 'Coupon allocation requires manual review; payment received. Do not repay.',
          };
          this.saveData();
          return { success: false, error: 'Payment received but coupon allocation needs support review. Do not pay again.', order };
        }
      }

      // Payment verified! Issue Annual or Lifetime Membership License based on order.plan
      const confirmedAt = new Date().toISOString();
      const isLifetime = order.plan === 'LIFETIME';
      const durationDays = isLifetime ? 36500 : 365;
      const expiresAt = isLifetime ? null : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      const maxDevices = isLifetime
        ? (this.data.config.lifetimeDeviceLimit || 3)
        : (this.data.config.annualDeviceLimit || 2);

      const { record: license, rawCode } = this.createLicense({
        type: isLifetime ? 'Lifetime' : 'Annual',
        durationDays,
        maxDevices,
        note: `${isLifetime ? 'Lifetime' : 'Annual'} Member ${order.memberEmail} (Order ${order.id})`,
        gracePeriodHours: 72,
        actor: order.memberEmail,
        ip: params.ip,
      });

      license.memberId = order.memberId;
      license.orderId = order.id;

      // Update Order
      order.status = 'LICENSE_ISSUED';
      order.confirmedAt = confirmedAt;
      order.licenseId = license.id;
      order.licensePrefix = license.codePrefix;
      order.verificationDetails = {
        blockTime: tx.blockTime || 0,
        slot: tx.slot,
        lamportsReceived,
        solReceived,
        verifiedAt: confirmedAt,
      };

      // Update Member
      const member = this.getMemberById(order.memberId);
      if (member) {
        member.activePlan = isLifetime ? 'LIFETIME' : 'ANNUAL';
        member.planStatus = 'ACTIVE';
        if (isLifetime) {
          member.lifetimeExpiresAt = null;
        } else {
          member.annualExpiresAt = expiresAt;
        }
        member.licenseId = license.id;
        member.licensePrefix = license.codePrefix;
      }

      if (coupon) {
        const code = this.data.discountCodes.find((d) => d.id === coupon.discountCodeId)!;
        code.usedCount += 1;
        const redemption: DiscountRedemption = {
          id: `redeem_${crypto.randomBytes(8).toString('hex')}`,
          discountCodeId: coupon.discountCodeId, code: coupon.code,
          memberId: order.memberId, orderId: order.id, percentage: coupon.percentage,
          originalPriceUsd: coupon.originalPriceUsd,
          discountAmountUsd: coupon.discountAmountUsd,
          finalPriceUsd: coupon.finalPriceUsd, redeemedAt: confirmedAt,
        };
        this.data.discountRedemptions.unshift(redemption);
      }
      this.saveData();

      this.logAudit({
        action: 'PAYMENT_VERIFIED',
        actor: order.memberEmail,
        details: `Verified ${solReceived.toFixed(4)} SOL payment. Issued ${isLifetime ? 'Lifetime' : 'Annual'} License ${license.id}`,
        ip: params.ip,
      });

      return { success: true, order, rawCode };
    } catch (err: any) {
      console.error('Solana on-chain payment verification error:', err);
      return {
        success: false,
        error: `Solana verification failed: ${err.message || 'RPC communication error'}. Try verifying again.`,
        order,
      };
    } finally {
      this.verifyingOrders.delete(order.id);
    }
  }

  // --- ADMIN USERS ---

  public hasAdminUser(): boolean {
    return this.data.adminUsers.length > 0;
  }

  public getAdminByUsername(username: string): AdminUser | undefined {
    return this.data.adminUsers.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );
  }

  public getAdminById(id: string): AdminUser | undefined {
    return this.data.adminUsers.find((u) => u.id === id);
  }

  public createFirstAdmin(username: string, password: string): AdminUser {
    if (this.data.adminUsers.length > 0) {
      throw new Error('Initial administrator is already provisioned');
    }
    const { hash, salt } = this.hashPassword(password);
    const newAdmin: AdminUser = {
      id: `admin_${crypto.randomBytes(8).toString('hex')}`,
      username: username.trim(),
      passwordHash: hash,
      salt,
      role: 'superadmin',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };
    this.data.adminUsers.push(newAdmin);
    this.saveData();
    this.logAudit({
      action: 'ADMIN_CREATED',
      actor: newAdmin.username,
      details: 'Primary administrator provisioned successfully',
      ip: '127.0.0.1',
    });
    return newAdmin;
  }

  public createOrUpdateAdmin(
    username: string,
    password: string,
    role: 'superadmin' | 'admin' = 'superadmin'
  ): AdminUser {
    const existing = this.getAdminByUsername(username);
    const { hash, salt } = this.hashPassword(password);
    if (existing) {
      existing.passwordHash = hash;
      existing.salt = salt;
      existing.failedLoginAttempts = 0;
      existing.lockedUntil = null;
      this.saveData();
      return existing;
    }

    const newAdmin: AdminUser = {
      id: `admin_${crypto.randomBytes(8).toString('hex')}`,
      username: username.trim(),
      passwordHash: hash,
      salt,
      role,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };
    this.data.adminUsers.push(newAdmin);
    this.saveData();
    return newAdmin;
  }

  public recordAdminLogin(id: string, success: boolean): void {
    const admin = this.getAdminById(id);
    if (!admin) return;
    if (success) {
      admin.lastLoginAt = new Date().toISOString();
      admin.failedLoginAttempts = 0;
      admin.lockedUntil = null;
    } else {
      admin.failedLoginAttempts += 1;
      if (admin.failedLoginAttempts >= 5) {
        admin.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
    }
    this.saveData();
  }

  // --- LICENSES ---

  public createLicense(params: {
    type: PlanType;
    durationDays?: number;
    maxDevices?: number;
    note?: string;
    gracePeriodHours?: number;
    actor: string;
    ip: string;
  }): { record: LicenseRecord; rawCode: string } {
    let rawCode = '';
    let codeHash = '';

    for (let attempts = 0; attempts < 10; attempts++) {
      rawCode = this.generateSecureAccessCode();
      codeHash = this.hashAccessCode(rawCode);
      const existing = this.data.licenses.find((l) => l.codeHash === codeHash);
      if (!existing) break;
    }

    const durationDays =
      params.type === 'Trial'
        ? params.durationDays || 1 // 1-Day Free Trial only
        : params.type === 'Lifetime'
        ? params.durationDays || 36500 // Lifetime Access
        : params.durationDays || 365; // Annual Subscription

    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const record: LicenseRecord = {
      id: `lic_${crypto.randomBytes(8).toString('hex')}`,
      codeHash,
      codePrefix: rawCode.slice(0, 8),
      type: params.type,
      status: 'NOT_ACTIVATED',
      createdAt: new Date().toISOString(),
      expiresAt,
      durationDays,
      maxDevices: params.maxDevices || 1,
      note: params.note || '',
      gracePeriodHours: params.gracePeriodHours || 72,
      devices: [],
      history: [
        {
          timestamp: new Date().toISOString(),
          action: 'CREATED',
          details: `Generated ${params.type} license for max ${params.maxDevices || 1} devices`,
        },
      ],
    };

    this.data.licenses.push(record);
    this.saveData();

    this.logAudit({
      action: 'LICENSE_CREATED',
      actor: params.actor,
      details: `Created ${record.type} license ${record.id} (${record.codePrefix}...)`,
      ip: params.ip,
    });

    return { record, rawCode };
  }

  public findLicenseByCode(rawCode: string): LicenseRecord | undefined {
    const hash = this.hashAccessCode(rawCode);
    return this.data.licenses.find((l) => l.codeHash === hash);
  }

  public getLicenseById(id: string): LicenseRecord | undefined {
    return this.data.licenses.find((l) => l.id === id);
  }

  public getAllLicenses(): LicenseRecord[] {
    this.refreshAllLicenseStatuses();
    return this.data.licenses;
  }

  public refreshLicenseStatus(license: LicenseRecord): LicenseStatus {
    if (license.status === 'REVOKED') {
      return 'REVOKED';
    }

    if (license.expiresAt) {
      const now = new Date();
      const expiry = new Date(license.expiresAt);
      if (now > expiry) {
        license.status = 'EXPIRED';
        return 'EXPIRED';
      }
    }

    if (license.devices.length >= license.maxDevices) {
      license.status = 'DEVICE_LIMIT_REACHED';
      return 'DEVICE_LIMIT_REACHED';
    }

    if (license.devices.length > 0) {
      license.status = 'ACTIVE';
      return 'ACTIVE';
    }

    license.status = 'NOT_ACTIVATED';
    return 'NOT_ACTIVATED';
  }

  private refreshAllLicenseStatuses(): void {
    let changed = false;
    for (const lic of this.data.licenses) {
      const oldStatus = lic.status;
      const newStatus = this.refreshLicenseStatus(lic);
      if (oldStatus !== newStatus) {
        changed = true;
      }
    }
    if (changed) {
      this.saveData();
    }
  }

  public activateLicense(params: {
    rawCode: string;
    deviceId: string;
    platform: PlatformType;
    deviceName: string;
    ip: string;
  }): {
    success: boolean;
    state: LicenseStatus;
    token?: string;
    license?: LicenseRecord;
    error?: string;
  } {
    const license = this.findLicenseByCode(params.rawCode);
    if (!license) {
      this.logAudit({
        action: 'AUTH_FAILED',
        actor: params.deviceId,
        details: 'Attempted activation with invalid access code',
        ip: params.ip,
      });
      return { success: false, state: 'NOT_ACTIVATED', error: 'Invalid access code' };
    }

    if (license.status === 'REVOKED') {
      return {
        success: false,
        state: 'REVOKED',
        error: `This license has been revoked. Reason: ${license.revocationReason || 'Administrative revocation'}`,
      };
    }

    if (license.expiresAt && new Date() > new Date(license.expiresAt)) {
      license.status = 'EXPIRED';
      this.saveData();
      return {
        success: false,
        state: 'EXPIRED',
        error: 'This license has expired. Please renew your Annual Membership.',
      };
    }

    // Check existing device
    const existingDevice = license.devices.find((d) => d.deviceId === params.deviceId);
    if (existingDevice) {
      existingDevice.lastSeenAt = new Date().toISOString();
      existingDevice.ipAddress = params.ip;
      license.status = 'ACTIVE';
      this.saveData();

      const graceUntil = new Date(
        Date.now() + (license.gracePeriodHours || 72) * 60 * 60 * 1000
      ).toISOString();

      const token = this.signLicenseToken({
        licId: license.id,
        type: license.type,
        deviceId: params.deviceId,
        platform: params.platform,
        validUntil: license.expiresAt,
        graceUntil,
        issuedAt: new Date().toISOString(),
      });

      return { success: true, state: 'ACTIVE', token, license };
    }

    // New device: check device limit
    if (license.devices.length >= license.maxDevices) {
      license.status = 'DEVICE_LIMIT_REACHED';
      this.saveData();
      return {
        success: false,
        state: 'DEVICE_LIMIT_REACHED',
        error: `Device limit reached (${license.devices.length}/${license.maxDevices} active devices).`,
      };
    }

    const newDevice: DeviceRecord = {
      deviceId: params.deviceId,
      platform: params.platform,
      deviceName: params.deviceName || `${params.platform} Client`,
      activatedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      ipAddress: params.ip,
    };

    license.devices.push(newDevice);
    license.status = 'ACTIVE';
    license.history.push({
      timestamp: new Date().toISOString(),
      action: 'DEVICE_ACTIVATED',
      details: `Device ${params.deviceId} (${params.platform}) activated`,
    });

    this.saveData();

    this.logAudit({
      action: 'LICENSE_ACTIVATED',
      actor: params.deviceId,
      details: `License ${license.id} activated on ${params.platform}`,
      ip: params.ip,
    });

    const graceUntil = new Date(
      Date.now() + (license.gracePeriodHours || 72) * 60 * 60 * 1000
    ).toISOString();

    const token = this.signLicenseToken({
      licId: license.id,
      type: license.type,
      deviceId: params.deviceId,
      platform: params.platform,
      validUntil: license.expiresAt,
      graceUntil,
      issuedAt: new Date().toISOString(),
    });

    return { success: true, state: 'ACTIVE', token, license };
  }

  public verifyDeviceStatus(
    tokenStr: string,
    deviceId: string,
    ip: string
  ): {
    valid: boolean;
    state: LicenseStatus;
    license?: LicenseRecord;
    newToken?: string;
    error?: string;
  } {
    const payload = this.verifyLicenseToken(tokenStr);
    if (!payload) {
      return { valid: false, state: 'VALIDATION_REQUIRED', error: 'Invalid or forged license token' };
    }

    if (payload.deviceId !== deviceId) {
      return { valid: false, state: 'VALIDATION_REQUIRED', error: 'Device fingerprint mismatch' };
    }

    const license = this.getLicenseById(payload.licId);
    if (!license) {
      return { valid: false, state: 'NOT_ACTIVATED', error: 'License record not found on server' };
    }

    if (license.status === 'REVOKED') {
      return {
        valid: false,
        state: 'REVOKED',
        error: `License has been revoked: ${license.revocationReason || 'Administrative revocation'}`,
      };
    }

    if (license.expiresAt && new Date() > new Date(license.expiresAt)) {
      license.status = 'EXPIRED';
      this.saveData();
      return { valid: false, state: 'EXPIRED', error: 'License has expired' };
    }

    const device = license.devices.find((d) => d.deviceId === deviceId);
    if (!device) {
      return {
        valid: false,
        state: 'NOT_ACTIVATED',
        error: 'This device is no longer registered for this license',
      };
    }

    device.lastSeenAt = new Date().toISOString();
    device.ipAddress = ip;
    license.status = 'ACTIVE';
    this.saveData();

    const graceUntil = new Date(
      Date.now() + (license.gracePeriodHours || 72) * 60 * 60 * 1000
    ).toISOString();

    const newToken = this.signLicenseToken({
      licId: license.id,
      type: license.type,
      deviceId,
      platform: device.platform,
      validUntil: license.expiresAt,
      graceUntil,
      issuedAt: new Date().toISOString(),
    });

    return { valid: true, state: 'ACTIVE', license, newToken };
  }

  public resetAllDevices(licenseId: string, actor: string, ip: string): boolean {
    const license = this.getLicenseById(licenseId);
    if (!license) return false;

    const count = license.devices.length;
    license.devices = [];
    license.history.push({
      timestamp: new Date().toISOString(),
      action: 'DEVICES_RESET',
      details: `Reset all ${count} device activations by ${actor}`,
    });
    this.refreshLicenseStatus(license);
    this.saveData();

    this.logAudit({
      action: 'DEVICE_RESET',
      actor,
      details: `Reset all ${count} device activations for license ${licenseId}`,
      ip,
    });
    return true;
  }

  public revokeLicense(licenseId: string, reason: string, actor: string, ip: string): boolean {
    const license = this.getLicenseById(licenseId);
    if (!license) return false;

    license.status = 'REVOKED';
    license.revokedAt = new Date().toISOString();
    license.revocationReason = reason;
    license.history.push({
      timestamp: new Date().toISOString(),
      action: 'REVOKED',
      details: `Revoked by ${actor}. Reason: ${reason}`,
    });
    this.saveData();

    this.logAudit({
      action: 'LICENSE_REVOKED',
      actor,
      details: `Revoked license ${licenseId}. Reason: ${reason}`,
      ip,
    });
    return true;
  }

  public renewLicense(
    licenseId: string,
    additionalDays: number,
    actor: string,
    ip: string
  ): { success: boolean; newExpiry?: string | null } {
    const license = this.getLicenseById(licenseId);
    if (!license) return { success: false };

    const currentExpiry = license.expiresAt ? new Date(license.expiresAt) : new Date();
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(baseDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);

    license.expiresAt = newExpiry.toISOString();
    license.durationDays += additionalDays;
    license.renewedAt = new Date().toISOString();
    if (license.status === 'REVOKED' || license.status === 'EXPIRED') {
      license.status = license.devices.length > 0 ? 'ACTIVE' : 'NOT_ACTIVATED';
      license.revokedAt = null;
      license.revocationReason = null;
    }

    this.saveData();
    this.logAudit({
      action: 'LICENSE_RENEWED',
      actor,
      details: `Renewed license ${licenseId} (+${additionalDays} days, expires ${license.expiresAt})`,
      ip,
    });

    return { success: true, newExpiry: license.expiresAt };
  }

  // --- AUDIT LOGS ---

  public logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const log: AuditLog = {
      id: `audit_${crypto.randomBytes(6).toString('hex')}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs.length = 1000;
    }
    this.saveData();
  }

  public getAuditLogs(limit = 200): AuditLog[] {
    return this.data.auditLogs.slice(0, limit);
  }

  public getStats() {
    const all = this.getAllLicenses();
    const total = all.length;
    const active = all.filter((l) => l.status === 'ACTIVE').length;
    const expired = all.filter((l) => l.status === 'EXPIRED').length;
    const revoked = all.filter((l) => l.status === 'REVOKED').length;
    const notActivated = all.filter((l) => l.status === 'NOT_ACTIVATED').length;
    const totalActivatedDevices = all.reduce((acc, l) => acc + l.devices.length, 0);

    return {
      total,
      active,
      expired,
      revoked,
      notActivated,
      totalActivatedDevices,
      totalMembers: this.data.members.length,
      totalOrders: this.data.orders.length,
      annualPriceUsd: this.data.config.annualPriceUsd,
    };
  }

  // --- USER API CREDENTIALS SECURITY & VALIDATION (PHASE 14/15) ---

  private encryptString(plainText: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(this.data.serverSecret).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decryptString(cipherText: string): string {
    try {
      const parts = cipherText.split(':');
      if (parts.length !== 2) return '';
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const key = crypto.createHash('sha256').update(this.data.serverSecret).digest();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return '';
    }
  }

  public maskApiKey(key: string): string {
    if (!key) return '';
    const trimmed = key.trim();
    if (trimmed.length <= 8) return '****' + trimmed.slice(-2);
    return `${trimmed.slice(0, 4)}...****${trimmed.slice(-4)}`;
  }

  public getUserApiCredentials(ownerId: string): UserApiCredentials | null {
    if (!ownerId) return null;
    return this.data.userApiKeys.find((k) => k.ownerId === ownerId) || null;
  }

  /** Server-only. Never send these values to the browser. */
  public getUserProviderSecrets(ownerId: string): {
    jupiterApiKey: string | null;
    goPlusAppKey: string | null;
    goPlusAppSecret: string | null;
  } {
    const creds = this.getUserApiCredentials(ownerId);
    return {
      jupiterApiKey: creds?.jupiterApiKeyEncrypted ? this.decryptString(creds.jupiterApiKeyEncrypted) || null : null,
      goPlusAppKey: creds?.goPlusAppKeyEncrypted || creds?.goPlusApiKeyEncrypted
        ? this.decryptString(creds.goPlusAppKeyEncrypted || creds.goPlusApiKeyEncrypted || '') || null
        : null,
      goPlusAppSecret: creds?.goPlusAppSecretEncrypted
        ? this.decryptString(creds.goPlusAppSecretEncrypted) || null
        : null,
    };
  }

  public getPublicUserApiKeys(ownerId: string): ClientApiKeysPublic {
    const creds = this.getUserApiCredentials(ownerId);
    const appKeyMasked = creds?.goPlusAppKeyMasked || creds?.goPlusMasked || null;
    const appSecretMasked = creds?.goPlusAppSecretMasked || null;
    const isGoPlusConfigured = !!(creds?.goPlusAppKeyEncrypted || creds?.goPlusApiKeyEncrypted);

    return {
      jupiter: {
        isConfigured: !!creds?.jupiterApiKeyEncrypted,
        maskedKey: creds?.jupiterMasked || null,
        status: creds?.jupiterStatus || 'NOT_CONFIGURED',
        lastTestedAt: creds?.jupiterLastTestedAt || null,
        lastError: creds?.jupiterLastError || null,
      },
      goPlus: {
        isConfigured: isGoPlusConfigured,
        maskedAppKey: appKeyMasked,
        maskedAppSecret: appSecretMasked,
        maskedKey: appKeyMasked,
        status: creds?.goPlusStatus || 'NOT_CONFIGURED',
        lastTestedAt: creds?.goPlusLastTestedAt || null,
        lastError: creds?.goPlusLastError || null,
      },
    };
  }

  public async saveUserApiKeys(
    ownerId: string,
    params: {
      jupiterApiKey?: string;
      goPlusApiKey?: string;
      goPlusAppKey?: string;
      goPlusAppSecret?: string;
    },
    actor: string
  ): Promise<ClientApiKeysPublic> {
    if (!ownerId) throw new Error('Owner ID is required');

    let record = this.data.userApiKeys.find((k) => k.ownerId === ownerId);
    if (!record) {
      record = {
        ownerId,
        jupiterStatus: 'NOT_CONFIGURED',
        goPlusStatus: 'NOT_CONFIGURED',
        updatedAt: new Date().toISOString(),
      };
      this.data.userApiKeys.push(record);
    }

    if (params.jupiterApiKey !== undefined) {
      const trimmed = params.jupiterApiKey.trim();
      if (trimmed.length > 0) {
        record.jupiterApiKeyEncrypted = this.encryptString(trimmed);
        record.jupiterMasked = this.maskApiKey(trimmed);
        record.jupiterStatus = 'TESTING';
        record.jupiterLastError = null;

        // Perform real validation test
        const testRes = await this.testJupiterApi(trimmed);
        if (testRes.success) {
          record.jupiterStatus = 'CONNECTED';
          record.jupiterLastTestedAt = new Date().toISOString();
          record.jupiterLastError = null;
        } else {
          record.jupiterStatus = 'ERROR';
          record.jupiterLastError = testRes.error || 'Validation failed';
        }
      }
    }

    const rawGoPlusAppKey = (params.goPlusAppKey !== undefined ? params.goPlusAppKey : params.goPlusApiKey)?.trim();
    const rawGoPlusAppSecret = params.goPlusAppSecret?.trim();

    let shouldTestGoPlus = false;

    if (rawGoPlusAppKey !== undefined && rawGoPlusAppKey.length > 0) {
      record.goPlusAppKeyEncrypted = this.encryptString(rawGoPlusAppKey);
      record.goPlusAppKeyMasked = this.maskApiKey(rawGoPlusAppKey);
      record.goPlusApiKeyEncrypted = record.goPlusAppKeyEncrypted;
      record.goPlusMasked = record.goPlusAppKeyMasked;
      shouldTestGoPlus = true;
    }

    if (rawGoPlusAppSecret !== undefined && rawGoPlusAppSecret.length > 0) {
      record.goPlusAppSecretEncrypted = this.encryptString(rawGoPlusAppSecret);
      record.goPlusAppSecretMasked = this.maskApiKey(rawGoPlusAppSecret);
      shouldTestGoPlus = true;
    }

    if (shouldTestGoPlus && (record.goPlusAppKeyEncrypted || record.goPlusApiKeyEncrypted)) {
      record.goPlusStatus = 'TESTING';
      record.goPlusLastError = null;

      const appKeyToTest = this.decryptString(record.goPlusAppKeyEncrypted || record.goPlusApiKeyEncrypted || '');
      const appSecretToTest = record.goPlusAppSecretEncrypted ? this.decryptString(record.goPlusAppSecretEncrypted) : '';

      const testRes = await this.testGoPlusApi(appKeyToTest, appSecretToTest);
      if (testRes.success) {
        record.goPlusStatus = 'CONNECTED';
        record.goPlusLastTestedAt = new Date().toISOString();
        record.goPlusLastError = null;
      } else {
        record.goPlusStatus = 'ERROR';
        record.goPlusLastError = testRes.error || 'Validation failed';
      }
    }

    record.updatedAt = new Date().toISOString();
    this.saveData();

    this.logAudit({
      action: 'CONFIG_UPDATED',
      actor,
      details: `User API credentials updated for owner ${ownerId}`,
      ip: '127.0.0.1',
    });

    return this.getPublicUserApiKeys(ownerId);
  }

  public removeUserApiKey(
    ownerId: string,
    provider: 'jupiter' | 'goPlus',
    actor: string
  ): ClientApiKeysPublic {
    const record = this.data.userApiKeys.find((k) => k.ownerId === ownerId);
    if (!record) return this.getPublicUserApiKeys(ownerId);

    if (provider === 'jupiter') {
      delete record.jupiterApiKeyEncrypted;
      delete record.jupiterMasked;
      record.jupiterStatus = 'NOT_CONFIGURED';
      record.jupiterLastTestedAt = null;
      record.jupiterLastError = null;
    } else if (provider === 'goPlus') {
      delete record.goPlusAppKeyEncrypted;
      delete record.goPlusAppKeyMasked;
      delete record.goPlusAppSecretEncrypted;
      delete record.goPlusAppSecretMasked;
      delete record.goPlusApiKeyEncrypted;
      delete record.goPlusMasked;
      record.goPlusStatus = 'NOT_CONFIGURED';
      record.goPlusLastTestedAt = null;
      record.goPlusLastError = null;
    }

    record.updatedAt = new Date().toISOString();
    this.saveData();

    this.logAudit({
      action: 'CONFIG_UPDATED',
      actor,
      details: `User removed ${provider} API key for owner ${ownerId}`,
      ip: '127.0.0.1',
    });

    return this.getPublicUserApiKeys(ownerId);
  }

  public async testUserApiKey(
    ownerId: string,
    provider: 'jupiter' | 'goPlus'
  ): Promise<{ success: boolean; error?: string; publicState: ClientApiKeysPublic }> {
    const record = this.data.userApiKeys.find((k) => k.ownerId === ownerId);
    if (!record) {
      return {
        success: false,
        error: `${provider} key not configured`,
        publicState: this.getPublicUserApiKeys(ownerId),
      };
    }

    if (provider === 'jupiter') {
      if (!record.jupiterApiKeyEncrypted) {
        return {
          success: false,
          error: 'Jupiter API key is not configured',
          publicState: this.getPublicUserApiKeys(ownerId),
        };
      }
      const rawKey = this.decryptString(record.jupiterApiKeyEncrypted);
      const testRes = await this.testJupiterApi(rawKey);
      if (testRes.success) {
        record.jupiterStatus = 'CONNECTED';
        record.jupiterLastTestedAt = new Date().toISOString();
        record.jupiterLastError = null;
      } else {
        record.jupiterStatus = 'ERROR';
        record.jupiterLastError = testRes.error || 'Connection test failed';
      }
      this.saveData();
      return {
        success: testRes.success,
        error: testRes.error,
        publicState: this.getPublicUserApiKeys(ownerId),
      };
    } else {
      if (!record.goPlusAppKeyEncrypted && !record.goPlusApiKeyEncrypted) {
        return {
          success: false,
          error: 'GoPlus App Key is not configured',
          publicState: this.getPublicUserApiKeys(ownerId),
        };
      }
      const rawAppKey = this.decryptString(record.goPlusAppKeyEncrypted || record.goPlusApiKeyEncrypted || '');
      const rawAppSecret = record.goPlusAppSecretEncrypted ? this.decryptString(record.goPlusAppSecretEncrypted) : '';
      const testRes = await this.testGoPlusApi(rawAppKey, rawAppSecret);
      if (testRes.success) {
        record.goPlusStatus = 'CONNECTED';
        record.goPlusLastTestedAt = new Date().toISOString();
        record.goPlusLastError = null;
      } else {
        record.goPlusStatus = 'ERROR';
        record.goPlusLastError = testRes.error || 'Connection test failed';
      }
      this.saveData();
      return {
        success: testRes.success,
        error: testRes.error,
        publicState: this.getPublicUserApiKeys(ownerId),
      };
    }
  }

  public async testJupiterApi(key?: string): Promise<{ success: boolean; error?: string }> {
    const cleanKey = (key || '').trim();

    // Support simulated / demo / sandbox keys for offline or risk-free testing
    if (cleanKey.length > 0 && /^(DEMO|TEST|SANDBOX|DEV|SIM|MOCK)/i.test(cleanKey)) {
      return { success: true };
    }

    const testUrls = [
      'https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000',
      'https://lite-api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000',
    ];

    for (let i = 0; i < testUrls.length; i++) {
      const url = testUrls[i];
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);

        const headers: Record<string, string> = {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-Micro-Trader/1.0',
        };
        if (cleanKey.length > 0) {
          headers['x-api-key'] = cleanKey;
        }

        const res = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.status === 401 || res.status === 403) {
          return {
            success: false,
            error: `Authentication failed (HTTP ${res.status}): Invalid Jupiter API key. Check key on station.jup.ag`,
          };
        }
        if (res.status === 429) {
          return {
            success: false,
            error: 'Jupiter API rate limit reached (HTTP 429). Please wait a few seconds and try again.',
          };
        }
        if (res.ok) {
          return { success: true };
        }

        // If not OK on primary and there is a fallback, try fallback URL
        if (i < testUrls.length - 1) {
          continue;
        }

        const errText = await res.text().catch(() => '');
        return {
          success: false,
          error: `Jupiter API returned HTTP ${res.status}: ${errText.slice(0, 100) || 'Service response failed'}`,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          if (i < testUrls.length - 1) continue;
          return { success: false, error: 'Connection timed out while contacting Jupiter API (7s limit)' };
        }
        if (i < testUrls.length - 1) continue;
        return { success: false, error: `Network error reaching Jupiter API: ${err.message || 'Host unreachable'}` };
      }
    }

    return { success: false, error: 'Failed to reach Jupiter API endpoints' };
  }

  public async testGoPlusApi(appKey: string, appSecret?: string): Promise<{ success: boolean; error?: string }> {
    if (!appKey || typeof appKey !== 'string' || appKey.trim().length === 0) {
      return { success: false, error: 'GoPlus App Key is required' };
    }
    const cleanAppKey = appKey.trim();
    const cleanAppSecret = appSecret ? appSecret.trim() : '';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      // Official GoPlus Developer auth flow: App Key + Time + App Secret -> SHA1 signature -> /api/v1/token
      if (cleanAppSecret.length > 0) {
        const time = Math.floor(Date.now() / 1000);
        const sign = crypto.createHash('sha1').update(`${cleanAppKey}${time}${cleanAppSecret}`).digest('hex');
        const tokenRes = await fetch('https://api.gopluslabs.io/api/v1/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            app_key: cleanAppKey,
            time,
            sign,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (tokenRes.status === 401 || tokenRes.status === 403) {
          return { success: false, error: `Authentication failed (HTTP ${tokenRes.status}): Invalid GoPlus App Key or App Secret` };
        }

        const data = await tokenRes.json().catch(() => null);
        if (data && data.code === 1 && data.result?.access_token) {
          return { success: true };
        }
        if (data && data.code && data.code !== 1) {
          return { success: false, error: data.message || `GoPlus auth error code ${data.code}` };
        }
        if (tokenRes.ok) {
          return { success: true };
        }
        return {
          success: false,
          error: `GoPlus Token endpoint returned HTTP ${tokenRes.status}`,
        };
      }

      // If only App Key is supplied (open query or API key header test)
      const url =
        'https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=So11111111111111111111111111111111111111112';
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: cleanAppKey,
          'X-API-KEY': cleanAppKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 401 || res.status === 403) {
        return { success: false, error: `Authentication failed (HTTP ${res.status}): Invalid GoPlus App Key. Note: Developer access requires both App Key & App Secret.` };
      }
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && (data.code === 1 || data.result)) {
          return { success: true };
        }
        if (data && data.code && data.code !== 1) {
          return { success: false, error: data.message || `GoPlus error code ${data.code}` };
        }
        return { success: true };
      }
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        error: `GoPlus API returned HTTP ${res.status}: ${errText.slice(0, 100) || 'Service response failed'}`,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Connection timed out while contacting GoPlus Security API (6s limit)' };
      }
      return { success: false, error: `Network error reaching GoPlus Security API: ${err.message || 'Host unreachable'}` };
    }
  }

  // --- MEMBERSHIP FEATURE ENTITLEMENTS (PHASE 14 & 15) ---

  public checkEntitlements(identifier: {
    memberId?: string;
    licenseId?: string;
    deviceId?: string;
  }): FeatureEntitlements {
    // 1. Check by memberId if available
    if (identifier.memberId) {
      const member = this.getMemberById(identifier.memberId);
      if (member) {
        if (member.activePlan === 'TRIAL') {
          const isExpired =
            member.planStatus === 'EXPIRED' ||
            member.planStatus === 'TRIAL_EXPIRED' ||
            (member.trialExpiresAt ? new Date(member.trialExpiresAt) <= new Date() : false);

          if (!isExpired && (member.planStatus === 'ACTIVE' || member.planStatus === 'TRIAL_ACTIVE')) {
            return {
              membershipType: 'TRIAL',
              membershipStatus: 'TRIAL_ACTIVE',
              dashboardAccess: true,
              manualTrading: true,
              candidateReview: true,
              userApiSetup: true,
              autopilotAllowed: false, // NON-NEGOTIABLE: Free trial CANNOT use Autopilot
              cycles15MinAllowed: false, // NON-NEGOTIABLE: Free trial CANNOT use 15-minute cycles
              manualExitControls: true,
              tradeHistory: true,
              reason: 'Free Trial includes Manual Trading. Autopilot is exclusive to Paid Annual & Lifetime Members.',
            };
          } else {
            return {
              membershipType: 'TRIAL',
              membershipStatus: 'TRIAL_EXPIRED',
              dashboardAccess: true,
              manualTrading: false, // Block new trades when trial expires
              candidateReview: true,
              userApiSetup: true,
              autopilotAllowed: false,
              cycles15MinAllowed: false,
              manualExitControls: true, // Keep exit controls to allow safe manual exits
              tradeHistory: true,
              reason: 'Your 1-day free trial has expired. Upgrade to an Annual or Lifetime membership to trade.',
            };
          }
        } else if (member.activePlan === 'ANNUAL' || member.activePlan === 'LIFETIME') {
          const isExpired =
            member.planStatus === 'EXPIRED' ||
            (member.activePlan === 'ANNUAL' && member.annualExpiresAt
              ? new Date(member.annualExpiresAt) <= new Date()
              : false);

          if (!isExpired && member.planStatus === 'ACTIVE') {
            return {
              membershipType: member.activePlan,
              membershipStatus: 'ACTIVE',
              dashboardAccess: true,
              manualTrading: true,
              candidateReview: true,
              userApiSetup: true,
              autopilotAllowed: true, // Paid Annual & Lifetime allowed Autopilot
              cycles15MinAllowed: true, // Paid Annual & Lifetime allowed 15-minute cycles
              manualExitControls: true,
              tradeHistory: true,
            };
          } else {
            return {
              membershipType: member.activePlan,
              membershipStatus: 'EXPIRED',
              dashboardAccess: true,
              manualTrading: false,
              candidateReview: true,
              userApiSetup: true,
              autopilotAllowed: false, // Expired paid cannot start new Autopilot
              cycles15MinAllowed: false,
              manualExitControls: true,
              tradeHistory: true,
              reason: 'Your membership has expired. Renew your plan to resume Autopilot and trading.',
            };
          }
        }
      }
    }

    // 2. Check by licenseId if available
    if (identifier.licenseId) {
      const license = this.getLicenseById(identifier.licenseId);
      if (license) {
        const isExpired =
          license.status === 'EXPIRED' ||
          license.status === 'REVOKED' ||
          (license.expiresAt ? new Date(license.expiresAt) <= new Date() : false);

        if (license.type === 'Trial') {
          if (!isExpired && license.status === 'ACTIVE') {
            return {
              membershipType: 'TRIAL',
              membershipStatus: 'ACTIVE',
              dashboardAccess: true,
              manualTrading: true,
              candidateReview: true,
              userApiSetup: true,
              autopilotAllowed: false,
              cycles15MinAllowed: false,
              manualExitControls: true,
              tradeHistory: true,
              reason: 'Free Trial includes Manual Trading. Autopilot is exclusive to Paid Annual & Lifetime Members.',
            };
          } else {
            return {
              membershipType: 'TRIAL',
              membershipStatus: isExpired || license.status === 'EXPIRED' ? 'TRIAL_EXPIRED' : license.status === 'REVOKED' ? 'LICENSE_REVOKED' : 'EXPIRED',
              dashboardAccess: true,
              manualTrading: false,
              candidateReview: true,
              userApiSetup: true,
              autopilotAllowed: false,
              cycles15MinAllowed: false,
              manualExitControls: true,
              tradeHistory: true,
              reason: 'Trial license has expired. Upgrade to continue trading.',
            };
          }
        } else if (license.type === 'Annual' || license.type === 'Lifetime') {
          // Annual or Lifetime
          const plan: 'ANNUAL' | 'LIFETIME' = license.type === 'Lifetime' ? 'LIFETIME' : 'ANNUAL';
          if (!isExpired && license.status === 'ACTIVE') {
            return {
              membershipType: plan,
              membershipStatus: 'ACTIVE',
              dashboardAccess: true,
              manualTrading: true,
              candidateReview: true,
              userApiSetup: true,
              autopilotAllowed: true,
              cycles15MinAllowed: true,
              manualExitControls: true,
              tradeHistory: true,
            };
          } else {
            return {
              membershipType: plan,
              membershipStatus: isExpired || license.status === 'EXPIRED' ? 'ANNUAL_EXPIRED' : license.status === 'REVOKED' ? 'LICENSE_REVOKED' : 'EXPIRED',
              dashboardAccess: true,
              manualTrading: false,
              candidateReview: true,
              userApiSetup: true,
              autopilotAllowed: false,
              cycles15MinAllowed: false,
              manualExitControls: true,
              tradeHistory: true,
              reason: 'Software license has expired or is revoked.',
            };
          }
        }
      }
    }

    // 3. Fallback: No recognized valid membership
    return {
      membershipType: 'NONE',
      membershipStatus: 'EXPIRED',
      dashboardAccess: false,
      manualTrading: false,
      candidateReview: false,
      userApiSetup: false,
      autopilotAllowed: false,
      cycles15MinAllowed: false,
      manualExitControls: false,
      tradeHistory: false,
      reason: 'No active member session or license found.',
    };
  }
}

export const db = new LicensingDatabase();
