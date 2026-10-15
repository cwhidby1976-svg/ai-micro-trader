# Website Demo: header and wallet consistency update

- Retains visible Paper/Live trigger indicator on website demo. Paper is active; Live is visually locked and cannot execute real trades.
- Removes one-day trial language from the demo header (shows WEBSITE DEMO · SIMULATED).
- Removes Test Live Wallet button from website demo. Production wallet flow remains separate.
- Website demo Autopilot is unlocked in the prior license/demo implementation.
- Top demo wallet SOL and demo wallet equity now read the same `tradingEngine.getPaperBalance()` ledger; old localStorage mock SOL overrides are ignored.
- Mock wallet faucet credits the trading engine paper ledger, so the wallet and equity remain in sync.
- Demo allocation displays 50% trading budget, 50% reserve, and remaining uncommitted budget in USD.
- Eliminates prior $2 overdraft allowance on Autopilot orders; manual and Autopilot trades both check the uncommitted 50% allocation.
- The reserve is an allocation constraint, not a guarantee against market losses. Open positions affect equity and available funds.

## Important limitations

- No real trading enabled; live wallet signing remains unimplemented.
- Full TypeScript/build validation unavailable in this environment because dependencies are absent (`vite/client` missing).
- This is a source checkpoint; run `npm ci`, `npm run lint`, `npm test`, and `npm run build` before release.
