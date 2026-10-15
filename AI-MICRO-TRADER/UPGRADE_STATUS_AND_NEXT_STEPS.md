# AI Micro Trader — Source Upgrade Status (2026-10-14)

This is a **source-code working copy** from the uploaded project. No original user files were modified. No real-money trading has been enabled.

## Changes actually applied to this copy

- `src/services/tradingEngine.ts`: mark newly created simulated positions as Autopilot or Manual. **Autopilot positions only** use an initial -3.5% stop, activate profit protection after a +2.5% observed peak, and ratchet the stop to peak entry-relative return minus **2 percentage points** (at +2.5%, stop +0.5%). The existing +25% full exit remains. Manual position trailing rules are preserved. The pre-existing 7-minute maximum holding exit is unchanged.
- The existing full-width homepage banner is preserved as a fixed public asset. It already had `draggable={false}` and pointer interaction disabled; no replacement control was found in that component.
- Excluded uploaded `.env`, local account database backups, and other sensitive/test data from this ZIP.

## Existing behavior that is NOT complete

- **Demo vs production**: both currently render the same Dashboard; production is not yet a separately wired live execution backend. The simulation trading engine intentionally rejects live execution. Do not interpret this ZIP as a live-ready Windows/Android product.
- Phantom/SafePal: a read-only wallet preview exists; secure signing, Android deep links, and actual transaction execution are not complete.
- Supabase: nine-table scaffolding and modules exist, but Batches 4E–4I are not fully integrated into all routes. The backend still uses local JSON for key operations.
- Windows/Android: installers and end-to-end device validation are not certified.
- Trading strategy: current 7-minute maximum holding rule can close a position before it reaches +25%; review this separately before changing the agreed 15-minute cycle design.

## Validation

- Static source checks performed on the modified trading engine and banner. Dependency installation timed out in this environment, so `npm run lint`, `npm test`, and `npm run build` are **NOT verified** for this working copy.
- On your machine, extract into a **NEW** folder (do not overwrite the original), run `npm ci`, `npm run lint`, `npm test`, and `npm run build`.
- Do not deploy or enable live funds based solely on this package.

## Next engineering stages

1. Separate the website-only demo environment from the licensed production application using explicit, server-enforced mode controls while reusing one visual dashboard component.
2. Implement real Phantom/SafePal wallet connection, signing and confirmation flows separately for Windows and Android; preserve fail-closed behavior.
3. Complete Supabase migrations 4E–4I with durable transactions and authentication, then integrate Firebase hosting and deployment.
4. Add strategy tests for +2.5% trigger, +0.5% initial locked floor, +10% peak -> +8% stop, -3.5% loss, +25% exit, restart persistence, and manual-mode isolation.
