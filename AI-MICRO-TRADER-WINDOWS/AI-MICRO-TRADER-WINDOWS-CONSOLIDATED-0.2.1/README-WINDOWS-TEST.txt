AI MICRO TRADER WINDOWS TEST v0.2.0

WHAT CHANGED:
- Uses the latest uploaded AI-MICRO-TRADER source, NOT the old hosted webpage shell.
- Vite base is relative (./) so packaged Electron file:// pages can find JS/CSS.
- Corrected Electron loadFile path to desktop/dist/index.html.
- Uses the prior Windows application icon.
- VITE_APP_DISTRIBUTION=desktop selects the live-only license activation flow.
- Live transactions remain blocked by source; this is a test build, not a trading release.

BUILD ON WINDOWS:
1. Extract ZIP.
2. Open PowerShell inside this folder.
3. Run: powershell -ExecutionPolicy Bypass -File .\BUILD-WINDOWS-TEST.ps1
4. Open WINDOWS-TEST-OUTPUT\AI-Micro-Trader-TEST-Setup-0.2.0.exe

IMPORTANT:
- Do not publish installer to Cloudflare R2 yet.
- Do not use real funds, seed phrases, or private keys.
- Wallet connection, automatic transaction authorization, backend licensing and live execution require further verification.
- Installer is not code-signed with a verified publisher certificate.
- Run npm audit in root and desktop, review findings before distributing.
- .env and local databases intentionally excluded.
- The website/Firebase hosting configuration is not deployed or modified by this build.
