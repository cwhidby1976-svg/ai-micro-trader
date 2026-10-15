# Website demo manual + Autopilot trading update

- Added prominent demo-only Manual Trading and Autopilot Trading navigation controls; both lead to the existing fully functional trading tabs.
- Manual mode still requires explicit trade confirmation; its simulated engine enforces the shared 50% wallet allocation.
- Autopilot can be turned on in the website demo even without a paid license; its simulated engine shares the same budget and strategy safeguards.
- Removed erroneous Free Trial / Manual Only message from the website demo Autopilot-off banner.
- Corrected blanket -5% stop-loss claim (actual exit rules vary by position).
- Demo remains paper execution only. Live market-feed authenticity/freshness and end-to-end browser tests have not been verified.
- Windows/Android live execution remains blocked until secure signing is implemented; no new live trading capability is claimed.
