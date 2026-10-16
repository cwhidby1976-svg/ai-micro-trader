AI MICRO TRADER — SUPABASE INTEGRATION SAFETY KIT

STATUS: PREFLIGHT / PLANNING ONLY. THIS IS NOT THE FINISHED 4E–4I MIGRATION.

Why this is not an install-and-go migration:
- src/server/db.ts has synchronous persistence calls and reads local data/licensing_db.json at construction.
- Routes and trading-related API credential flows call that synchronous database.
- Supabase client operations are asynchronous and cannot be substituted without coordinated route/service changes.
- A naive asynchronous mirror could acknowledge a payment or license issuance before persistence succeeds.
- Existing serverSecret is used for HMAC tokens and encryption and must remain stable.
- The first-admin provisioner needs an atomic database constraint/RPC, not a count-then-insert.
- Payment verification and discount redemption need idempotent transactional database operations.
- In-memory sessions will be lost on server restart and are not shared across instances.
- The configured Solana payment receiving address is a placeholder; real payment acceptance must remain disabled.

This kit contains a READ-ONLY project audit script and a SQL example to review in Supabase SQL editor.
Neither component deploys the backend or migrates data.

Use:
1. Unzip this kit in your project root.
2. Run: powershell -NoProfile -ExecutionPolicy Bypass -File .\AMT-SUPABASE-KIT\CHECK-READINESS.ps1
3. Do not run the SQL blindly. It is a proposed uniqueness constraint requiring review against current schema.

DO NOT upload .env, SUPABASE_SECRET_KEY, database files, or passwords.
