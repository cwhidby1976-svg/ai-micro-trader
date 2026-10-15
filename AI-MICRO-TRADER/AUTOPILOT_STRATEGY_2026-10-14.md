# Updated Autopilot-only strategy

- Initial stop-loss trigger: **-3.5%** from entry.
- Profit-lock activation: **+2.5%** peak unrealized return from entry.
- Once activated, protective stop = highest observed return **minus 2 percentage points**; at +2.5% peak, protective stop = **+0.5%** from entry. Stop never decreases.
- At +10% peak, protective stop = +8%.
- Maximum profit target: **+25%**, full position exit trigger.
- Existing 15-minute Autopilot cycle and 7-minute holding cap are unchanged.
- Manual-mode position rules are unchanged.
- This code path is currently a simulated/paper engine, **not verified live-wallet execution**.
- Stop triggers are not guaranteed fill prices; fees, slippage and transaction delays affect actual returns.
- Verify automated tests and end-to-end paper behavior before any production use.
