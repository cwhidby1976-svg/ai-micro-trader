# AI – Micro Trader & Cryptographic Licensing System

Enterprise-grade micro-cap Solana meme coin scanner and ICC strategy engine protected by a device-bound, cryptographically hashed access-code licensing backend.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │        Licensing Server (API)        │
                      │  • Salted PBKDF2 Master Auth         │
                      │  • Zero-Plaintext Code Hashing       │
                      │  • HMAC-SHA256 Token Signing         │
                      │  • Device Fingerprint Registry       │
                      └───────┬──────────────────────┬───────┘
                              │                      │
                  HTTPS POST  │                      │ HTTPS POST
             /api/license/verify                     │ /api/license/activate
                              │                      │
                              ▼                      ▼
               ┌──────────────────────┐      ┌──────────────────────┐
               │    Windows Client    │      │    Android Client    │
               │  • WIN-HWID binding  │      │  • AND-AID binding   │
               │  • Offline Grace     │      │  • Offline Grace     │
               └──────────┬───────────┘      └──────────┬───────────┘
                          │                             │
                          └──────────────┬──────────────┘
                                         ▼
                     ┌──────────────────────────────────────┐
                     │   Trading Engine (ISOLATED DOMAIN)   │
                     │  • Paper Trading by default          │
                     │  • Solana Meme Coin Scanner          │
                     │  • GoPlus Security Audits (0-100)    │
                     │  • ICC Triple-Phase Strategy         │
                     │  • Jupiter Multi-DEX Aggregator      │
                     │  * ZERO keys/seeds stored in DB!     │
                     └──────────────────────────────────────┘
```

---

## 1. Installation & Quickstart

### Prerequisites
- Node.js >= 18.x
- npm or pnpm

### Setup
```bash
# Clone the repository and install dependencies
npm install

# Start full-stack development server (Express backend + Vite client on port 3000)
npm run dev

# Run comprehensive licensing & cryptography test suite
npm test

# Build production assets
npm run build

# Start production server
npm start
```

---

## 2. Backend Configuration & Environment

The application backend uses Express with atomic JSON persistence and Node.js native `crypto` primitives.

Configurable in `.env`:
```env
PORT=3000
NODE_ENV=production
# Optional secret override (auto-generated if not provided)
SERVER_SECRET=your_high_entropy_32_byte_hex_secret
```

### Database Storage
All licensing records, admin credentials, device registrations, and audit logs are safely stored in:
`./data/licensing_db.json`

Database write operations are **atomic** (writes to `.tmp` file and replaces via atomic file rename) to prevent database corruption during concurrent operations or power events.

---

## 3. Administrator Setup & Security

### Administrator Credentials
The initial root administrator account is provisioned with:
- **Username:** `admin`
- **Password:** `MicroTrader2026!Admin`

You can log in directly by clicking **Admin Portal** in the upper-right corner or navigating to `/?admin=true`.

### First-Time Administrator Provisioning
1. Access the web interface at `http://localhost:3000`.
2. Click **Admin Portal** or navigate with query parameter `?admin=true`.
3. If provisioning additional or replacement admins, the system stores passwords using **PBKDF2 with SHA-512**, 100,000 iterations, and a unique 16-byte cryptographic salt.
4. A 12-hour session Bearer token is issued upon authentication.

### Security Guarantees
- **Zero Plaintext Storage**: Access codes are stored only as their SHA-256 hash. Plaintext codes are displayed to the admin once upon creation and cannot be retrieved later.
- **Brute-Force Guard**: Public activation endpoints are rate-limited to prevent automated guessing.
- **Audit Trails**: Every administrative action (license creation, revocation, renewal, device reset) is logged with sanitized details.

---

## 4. Access-Code Generation & Management

### License Types
- **Trial**: Default 7 days (customizable).
- **Monthly**: Default 30 days.
- **Annual**: Default 365 days.
- **Lifetime**: Permanent activation without expiration; can still be administratively revoked.

### Generation Modes
- **Single Access Code**: Generates one formatted code (`MTR-XXXX-XXXX-XXXX`) with a configurable device limit (1–10 devices).
- **Batch Generation**: Generates up to 50 unique codes simultaneously with custom notes and durations.

### Administrative Actions
- **Revocation**: Immediately invalidates the license with a stated audit reason. The device locks upon the next verification request.
- **Renewal**: Extends duration by N days and reactivates expired or revoked keys.
- **Device Reset**: Clears all bound devices, allowing the user to switch hardware without exceeding their license quota.
- **Safe CSV Export**: Generates a masked CSV (`ai_micro_trader_licenses.csv`) omitting raw codes for secure compliance audits.

---

## 5. Application Access Control & License States

The client application enforces six distinct states:

| License State | Meaning | Application Behavior |
|---|---|---|
| `NOT_ACTIVATED` | No code has been entered | Shows activation terminal; trading features locked |
| `ACTIVE` | Valid code and valid device registration | Full trading engine unlocked |
| `EXPIRED` | Term duration has ended | Blocks trading; displays renewal instructions |
| `REVOKED` | Administratively cancelled (e.g. chargeback) | Permanently blocks features; displays revocation reason |
| `DEVICE_LIMIT_REACHED` | Active devices equal `maxDevices` | Blocks new device; prompts deactivation or admin reset |
| `VALIDATION_REQUIRED` | Offline grace period has elapsed | Temporarily blocks features until internet connection restored |

---

## 6. Windows & Android Device Activation & Packaging

### Hardware Binding
- **Windows**: Identifies the device using a hardware-bound fingerprint (`WIN-HWID-...`).
- **Android**: Identifies the device using an application instance identifier (`AND-AID-...`).

### Offline Grace Period
- When activated, the server issues an **HMAC-SHA256 signed validation token** with an offline grace period (default 72 hours).
- If the device goes offline or the server is momentarily unreachable, the application continues to run in **Offline Grace Mode**.
- Once the grace period expires without server verification, the state transitions to `VALIDATION_REQUIRED`.

### Packaging for Windows
1. **Using Electron**:
   ```bash
   npm install --save-dev electron electron-builder
   # Configure package.json with "main": "dist/electron.js"
   npx electron-builder --win --x64
   ```
2. **Using Tauri (Lightweight Rust-based build)**:
   ```bash
   npm install --save-dev @tauri-apps/cli
   npx tauri build --target x86_64-pc-windows-msvc
   ```

### Packaging for Android
1. **Using Capacitor**:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "AI Micro Trader" "io.aimicrotrader.app"
   npm run build
   npx cap add android
   npx cap copy android
   npx cap open android # Builds release APK via Android Studio
   ```
2. **Progressive Web App (PWA)**:
   - Run in mobile Chrome/Brave/Edge and choose "Install App" to launch in fullscreen Android standalone mode.

---

## 7. Separation of Licensing from Trading Engine

The software licensing engine is strictly isolated from the trading execution engine:
1. **No Wallet Secrets Stored**: Customer private keys, mnemonic seed phrases, and Jupiter/GoPlus API credentials are **NEVER** stored in the licensing database.
2. **Paper Trading by Default**: The terminal initializes with virtual simulation funds ($10,000 / 65 SOL).
3. **Explicit Live Trading Guard**: Enabling live trading requires explicit user consent acknowledging the risk and separate client-side wallet connection.

---

## 8. Automated Test Suite

Run the full end-to-end integration and unit tests:
```bash
npm test
```

Tested scenarios:
1. Admin user provisioning & PBKDF2 password hashing
2. Cryptographic access-code generation & SHA-256 hash storage
3. Duplicate code prevention across 20 high-entropy keys
4. Windows and Android activation flows
5. Device limit enforcement on multi-device licenses
6. Invalid and tampered code rejection
7. Offline grace-period HMAC verification and tamper detection
8. Instant administrative license revocation
9. License renewal & reactivation
10. Authorized device activation reset
11. Expired license state transition
12. Audit trail verification (zero secret leakage)
