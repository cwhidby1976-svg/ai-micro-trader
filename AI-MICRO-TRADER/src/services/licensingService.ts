import { LicenseStatus, PlanType, PlatformType } from '../server/types';

export interface ClientLicenseState {
  status: LicenseStatus;
  token: string | null;
  licenseId: string | null;
  licenseType: PlanType | null;
  expiresAt: string | null;
  graceUntil: string | null;
  maxDevices: number;
  activeDevices: number;
  lastVerifiedAt: string | null;
  deviceId: string;
  platform: PlatformType;
  deviceName: string;
  errorMessage: string | null;
  isOfflineGrace: boolean;
}

const STORAGE_KEY = 'ai_micro_trader_license';
const DEVICE_KEY = 'ai_micro_trader_device';
const PLATFORM_OVERRIDE_KEY = 'ai_micro_trader_platform_override';

export class LicensingService {
  private state: ClientLicenseState;
  private listeners: Array<(state: ClientLicenseState) => void> = [];
  private verifyTimer: any = null;

  constructor() {
    const { deviceId, platform, deviceName } = this.initDeviceInfo();
    const stored = this.loadStoredLicense();

    this.state = {
      status: stored?.status || 'NOT_ACTIVATED',
      token: stored?.token || null,
      licenseId: stored?.licenseId || null,
      licenseType: stored?.licenseType || null,
      expiresAt: stored?.expiresAt || null,
      graceUntil: stored?.graceUntil || null,
      maxDevices: stored?.maxDevices || 1,
      activeDevices: stored?.activeDevices || 0,
      lastVerifiedAt: stored?.lastVerifiedAt || null,
      deviceId,
      platform,
      deviceName,
      errorMessage: null,
      isOfflineGrace: false,
    };

    // If we have a stored token, verify on startup
    if (this.state.token) {
      this.verifyOnlineStatus();
    }

    // Periodic verify every 3 minutes
    this.verifyTimer = setInterval(() => {
      if (this.state.token) {
        this.verifyOnlineStatus();
      }
    }, 180000);
  }

  private initDeviceInfo(): { deviceId: string; platform: PlatformType; deviceName: string } {
    let savedDevice = null;
    try {
      const raw = localStorage.getItem(DEVICE_KEY);
      if (raw) savedDevice = JSON.parse(raw);
    } catch {}

    const platformOverride = localStorage.getItem(PLATFORM_OVERRIDE_KEY) as PlatformType | null;

    let platform: PlatformType = 'windows';
    if (platformOverride) {
      platform = platformOverride;
    } else if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('android')) {
        platform = 'android';
      } else if (ua.includes('win')) {
        platform = 'windows';
      }
    }

    let deviceId = savedDevice?.deviceId;
    if (!deviceId) {
      const prefix = platform === 'windows' ? 'WIN-HWID' : platform === 'android' ? 'AND-AID' : 'WEB-ID';
      const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
      const time = Date.now().toString(36).toUpperCase();
      deviceId = `${prefix}-${time}-${rand}`;
    }

    const deviceName =
      savedDevice?.deviceName ||
      (platform === 'windows' ? 'Windows Trading Terminal' : platform === 'android' ? 'Android Mobile App' : 'Web Terminal');

    const info = { deviceId, platform, deviceName };
    try {
      localStorage.setItem(DEVICE_KEY, JSON.stringify(info));
    } catch {}

    return info;
  }

  public setPlatformOverride(platform: PlatformType): void {
    try {
      localStorage.setItem(PLATFORM_OVERRIDE_KEY, platform);
      const prefix = platform === 'windows' ? 'WIN-HWID' : platform === 'android' ? 'AND-AID' : 'WEB-ID';
      const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
      const newDeviceId = `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
      const newDeviceName =
        platform === 'windows' ? 'Windows Trading Terminal' : platform === 'android' ? 'Android Mobile App' : 'Web Terminal';

      localStorage.setItem(
        DEVICE_KEY,
        JSON.stringify({ deviceId: newDeviceId, platform, deviceName: newDeviceName })
      );

      this.state.platform = platform;
      this.state.deviceId = newDeviceId;
      this.state.deviceName = newDeviceName;

      // Re-verify if token exists
      if (this.state.token) {
        this.verifyOnlineStatus();
      } else {
        this.notify();
      }
    } catch (e) {
      console.error(e);
    }
  }

  private loadStoredLicense(): any {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private saveStoredLicense(): void {
    try {
      const toSave = {
        status: this.state.status,
        token: this.state.token,
        licenseId: this.state.licenseId,
        licenseType: this.state.licenseType,
        expiresAt: this.state.expiresAt,
        graceUntil: this.state.graceUntil,
        maxDevices: this.state.maxDevices,
        activeDevices: this.state.activeDevices,
        lastVerifiedAt: this.state.lastVerifiedAt,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {}
  }

  public getState(): ClientLicenseState {
    return { ...this.state };
  }

  public subscribe(listener: (state: ClientLicenseState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const current = this.getState();
    this.listeners.forEach((l) => l(current));
  }

  public async activate(code: string): Promise<{ success: boolean; error?: string }> {
    this.state.errorMessage = null;

    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          deviceId: this.state.deviceId,
          platform: this.state.platform,
          deviceName: this.state.deviceName,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        this.state.status = data.state || 'NOT_ACTIVATED';
        this.state.errorMessage = data.error || 'Activation failed';
        this.saveStoredLicense();
        this.notify();
        return { success: false, error: this.state.errorMessage || 'Activation failed' };
      }

      this.state.status = 'ACTIVE';
      this.state.token = data.token;
      this.state.licenseId = data.license.id;
      this.state.licenseType = data.license.type;
      this.state.expiresAt = data.license.expiresAt;
      this.state.maxDevices = data.license.maxDevices;
      this.state.activeDevices = data.license.activeDevices;
      this.state.lastVerifiedAt = new Date().toISOString();
      this.state.isOfflineGrace = false;
      this.state.errorMessage = null;

      // Extract grace period from token
      try {
        const payload = JSON.parse(atob(data.token.split('.')[0]));
        this.state.graceUntil = payload.graceUntil;
      } catch {}

      this.saveStoredLicense();
      this.notify();
      return { success: true };
    } catch (err: any) {
      this.state.errorMessage = 'Network error: could not connect to licensing server';
      this.notify();
      return { success: false, error: this.state.errorMessage };
    }
  }

  public async verifyOnlineStatus(): Promise<void> {
    if (!this.state.token) return;

    try {
      const res = await fetch('/api/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.state.token,
          deviceId: this.state.deviceId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        // Server rejected
        this.state.status = data.state || 'REVOKED';
        this.state.errorMessage = data.error || 'License verification failed';
        this.state.isOfflineGrace = false;
        if (data.state === 'REVOKED' || data.state === 'EXPIRED') {
          // Token is no longer good
          this.state.token = null;
        }
        this.saveStoredLicense();
        this.notify();
        return;
      }

      // Verification passed
      this.state.status = 'ACTIVE';
      if (data.newToken) {
        this.state.token = data.newToken;
      }
      this.state.licenseId = data.license.id;
      this.state.licenseType = data.license.type;
      this.state.expiresAt = data.license.expiresAt;
      this.state.maxDevices = data.license.maxDevices;
      this.state.activeDevices = data.license.activeDevices;
      this.state.lastVerifiedAt = new Date().toISOString();
      this.state.isOfflineGrace = false;
      this.state.errorMessage = null;

      try {
        const payload = JSON.parse(atob((data.newToken || this.state.token).split('.')[0]));
        this.state.graceUntil = payload.graceUntil;
      } catch {}

      this.saveStoredLicense();
      this.notify();
    } catch (err) {
      // Offline fallback: check offline grace period
      this.handleOfflineFallback();
    }
  }

  private handleOfflineFallback(): void {
    if (!this.state.token || !this.state.graceUntil) {
      this.state.status = 'VALIDATION_REQUIRED';
      this.state.isOfflineGrace = false;
      this.state.errorMessage = 'License server offline. Online activation required.';
      this.notify();
      return;
    }

    const graceExpiry = new Date(this.state.graceUntil).getTime();
    const now = Date.now();

    if (now > graceExpiry) {
      // Grace period expired! Block until reconnected
      this.state.status = 'VALIDATION_REQUIRED';
      this.state.isOfflineGrace = false;
      this.state.errorMessage = 'Offline grace period has expired. Please connect to the internet to validate your license.';
      this.notify();
    } else {
      // Within offline grace period
      this.state.status = 'ACTIVE';
      this.state.isOfflineGrace = true;
      this.state.errorMessage = null;
      this.notify();
    }
  }

  public async deactivate(): Promise<boolean> {
    if (!this.state.token) return false;

    try {
      await fetch('/api/license/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.state.token,
          deviceId: this.state.deviceId,
        }),
      });
    } catch {}

    this.state.status = 'NOT_ACTIVATED';
    this.state.token = null;
    this.state.licenseId = null;
    this.state.errorMessage = null;
    this.state.isOfflineGrace = false;
    this.saveStoredLicense();
    this.notify();
    return true;
  }
}

export const licensingService = new LicensingService();
