export type PlanType = 'Trial' | 'Annual' | 'Monthly' | 'Lifetime';

export type MembershipStatus =
  | 'NONE'
  | 'TRIAL_ACTIVE'
  | 'PAYMENT_PENDING'
  | 'ACTIVE'
  | 'ANNUAL_EXPIRED'
  | 'TRIAL_EXPIRED'
  | 'EXPIRED'
  | 'PAYMENT_FAILED'
  | 'LICENSE_REVOKED'
  | 'DEVICE_LIMIT_REACHED';

export type LicenseStatus =
  | 'NOT_ACTIVATED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'REVOKED'
  | 'DEVICE_LIMIT_REACHED'
  | 'VALIDATION_REQUIRED';

export type PlatformType = 'windows' | 'android' | 'web';

export interface DeviceRecord {
  deviceId: string;
  platform: PlatformType;
  deviceName: string;
  activatedAt: string;
  lastSeenAt: string;
  ipAddress: string;
}

export interface LicenseRecord {
  id: string;
  memberId?: string;
  orderId?: string;
  codeHash: string; // SHA-256 of normalized code. NEVER plaintext!
  codePrefix: string; // e.g. "MTR-XXXX"
  type: PlanType;
  status: LicenseStatus;
  createdAt: string;
  expiresAt: string | null;
  durationDays: number;
  maxDevices: number;
  note: string;
  gracePeriodHours: number;
  devices: DeviceRecord[];
  revokedAt?: string | null;
  revocationReason?: string | null;
  renewedAt?: string | null;
  history: Array<{
    timestamp: string;
    action: string;
    details: string;
  }>;
}

export interface MemberUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  isEmailVerified: boolean;
  activePlan: 'NONE' | 'TRIAL' | 'ANNUAL' | 'LIFETIME';
  planStatus: MembershipStatus;
  trialExpiresAt: string | null;
  annualExpiresAt: string | null;
  lifetimeExpiresAt?: string | null;
  trialUsed: boolean;
  licenseId: string | null;
  licensePrefix: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  passwordResetToken?: string | null;
  passwordResetExpires?: string | null;
  termsAcceptedAt: string;
}

export interface PriceHistoryRecord {
  id: string;
  plan?: 'ANNUAL' | 'LIFETIME';
  oldPriceUsd: number | null;
  newPriceUsd: number;
  changedAt: string;
  adminUsername: string;
  reason?: string;
}

export interface SystemConfig {
  annualPriceUsd: number | null; // null = unconfigured until set by admin
  lifetimePriceUsd: number | null; // null = unconfigured until set by admin
  trialDurationDays: number; // default 1 (1-Day Free Trial only)
  trialDeviceLimit: number; // default 1
  annualDeviceLimit: number; // default 2
  lifetimeDeviceLimit: number; // default 3
  solReceivingAddress: string;
  solRpcUrl: string;
  priceHistory: PriceHistoryRecord[];
}

export type OrderStatus =
  | 'ORDER_CREATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_VERIFYING'
  | 'PAYMENT_CONFIRMED'
  | 'LICENSE_ISSUED'
  | 'PAYMENT_EXPIRED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REVIEW_REQUIRED';

export interface DiscountCode {
  id: string;
  code: string;
  percentage: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  createdAt: string;
  createdBy: string;
}

export interface DiscountRedemption {
  id: string;
  discountCodeId: string;
  code: string;
  memberId: string;
  orderId: string;
  percentage: number;
  originalPriceUsd: number;
  discountAmountUsd: number;
  finalPriceUsd: number;
  redeemedAt: string;
}
export interface CheckoutOrder {
  id: string;
  memberId: string;
  memberEmail: string;
  plan: 'ANNUAL' | 'LIFETIME';
  usdPrice: number;
  solAmount: number;
  solRateUsd: number;
  rateSource: string;
  rateTimestamp: string;
  receivingWallet: string;
  network: 'solana-mainnet';
  createdAt: string;
  expiresAt: string;
  status: OrderStatus;
  txSignature: string | null;
  confirmedAt: string | null;
  licenseId: string | null;
  licensePrefix: string | null;
  verificationDetails?: {
    blockTime?: number;
    slot?: number;
    lamportsReceived?: number;
    solReceived?: number;
    sender?: string;
    verifiedAt?: string;
    error?: string;
  };
}

export interface AdminUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  role: 'superadmin' | 'admin';
  createdAt: string;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action:
    | 'ADMIN_LOGIN'
    | 'ADMIN_LOGOUT'
    | 'ADMIN_CREATED'
    | 'PRICE_CHANGED'
    | 'CONFIG_UPDATED'
    | 'MEMBER_REGISTERED'
    | 'MEMBER_LOGIN'
    | 'TRIAL_STARTED'
    | 'QUOTE_CREATED'
    | 'PAYMENT_SUBMITTED'
    | 'PAYMENT_VERIFIED'
    | 'PAYMENT_REJECTED'
    | 'LICENSE_ISSUED'
    | 'LICENSE_CREATED'
    | 'LICENSE_BATCH_CREATED'
    | 'LICENSE_ACTIVATED'
    | 'LICENSE_VALIDATED'
    | 'LICENSE_REVOKED'
    | 'LICENSE_RENEWED'
    | 'DEVICE_RESET'
    | 'DEVICE_DEACTIVATED'
    | 'AUTH_FAILED'
    | 'RATE_LIMITED';
  actor: string;
  details: string;
  ip: string;
}

export interface ValidationTokenPayload {
  licId: string;
  type: PlanType;
  deviceId: string;
  platform: PlatformType;
  validUntil: string | null;
  graceUntil: string;
  issuedAt: string;
}

// User-Configured API Credentials
export type ApiConnectionStatus = 'NOT_CONFIGURED' | 'TESTING' | 'CONNECTED' | 'ERROR';

export interface UserApiCredentials {
  ownerId: string; // memberId or deviceId
  jupiterApiKeyEncrypted?: string;
  jupiterMasked?: string;
  jupiterStatus: ApiConnectionStatus;
  jupiterLastTestedAt?: string | null;
  jupiterLastError?: string | null;

  // GoPlus App Key & App Secret (Official GoPlus Developer credentials)
  goPlusAppKeyEncrypted?: string;
  goPlusAppKeyMasked?: string;
  goPlusAppSecretEncrypted?: string;
  goPlusAppSecretMasked?: string;

  // Backward-compatibility aliases
  goPlusApiKeyEncrypted?: string;
  goPlusMasked?: string;

  goPlusStatus: ApiConnectionStatus;
  goPlusLastTestedAt?: string | null;
  goPlusLastError?: string | null;

  updatedAt: string;
}

export interface ClientApiKeysPublic {
  jupiter: {
    isConfigured: boolean;
    maskedKey: string | null;
    status: ApiConnectionStatus;
    lastTestedAt: string | null;
    lastError: string | null;
  };
  goPlus: {
    isConfigured: boolean;
    maskedAppKey: string | null;
    maskedAppSecret: string | null;
    maskedKey: string | null;
    status: ApiConnectionStatus;
    lastTestedAt: string | null;
    lastError: string | null;
  };
}

export interface FeatureEntitlements {
  membershipType: 'NONE' | 'TRIAL' | 'ANNUAL' | 'LIFETIME';
  membershipStatus: MembershipStatus;
  dashboardAccess: boolean;
  manualTrading: boolean;
  candidateReview: boolean;
  userApiSetup: boolean;
  autopilotAllowed: boolean;
  cycles15MinAllowed: boolean;
  manualExitControls: boolean;
  tradeHistory: boolean;
  reason?: string;
}
