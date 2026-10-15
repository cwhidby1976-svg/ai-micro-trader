# Access-level implementation checkpoint — 2026-10-14

## Applied in this source package
- Explicit `demo` vs `production` Dashboard environment.
- Website demo opens with simulated trading and locally enabled simulated Autopilot without a paid key.
- Live-only builds can be selected using `VITE_APP_DISTRIBUTION=desktop` or `VITE_APP_DISTRIBUTION=android` **at build time**; those builds bypass the landing page and route through license activation. `?view=dashboard` cannot bypass activation on those builds.
- On successful live-only license activation, the dashboard is opened in production mode.
- Removed paper/live mode switch from the dashboard; a fixed demo/live label is shown instead.
- Standard 24-hour key is Autopilot-locked. Annual and Lifetime licenses already receive server-side Autopilot entitlements through `db.checkEntitlements`, and frontend eligibility now defaults to false if permission is absent.
- Website demo Autopilot starts locally without calling the licensed backend route.
- Demo quick-trade and simulated manual execution handlers reject calls from production mode; production positions/order history are not populated from the paper engine.
- Production live execution remains blocked until secure transaction signing/execution exists. This is deliberate and must not be represented as working live trading.
- Autopilot strategy values from the immediately preceding updated ZIP are retained.

## Important unfinished work before live deployment
- Full Supabase-backed licensing/auth/admin integration (existing backend still uses JSON-based db in routes); server-side access enforcement must be tested against the deployed backend.
- Wallet connect flow and real balance reconciliation; secure signing/approval and Jupiter execution, retries, slippage, RPC, safe stop/exit management, circuit breakers.
- Replace all remaining simulated market and account telemetry in production views with verified real data or an unavailable status.
- Audit all trading and position handlers to ensure none uses the paper engine in a live-only build. Do not deploy the live build until completed.
- Native Windows/Android packaging and distinct build configuration have not been produced here.
- Automated tests, TypeScript check and Vite build could not run: dependencies are not installed in the working container (`vite/client` missing).

## Build selection (once dependencies and packaging are configured)
- Website: `npm run build` (defaults to website)
- Windows live-only frontend: set `VITE_APP_DISTRIBUTION=desktop` in the Windows build environment, then `npm run build`
- Android live-only frontend: set `VITE_APP_DISTRIBUTION=android` in the Android build environment, then `npm run build`

Do not place private API keys, signing secrets, local licensing database exports, or customer information in the frontend ZIP or frontend build environment.
