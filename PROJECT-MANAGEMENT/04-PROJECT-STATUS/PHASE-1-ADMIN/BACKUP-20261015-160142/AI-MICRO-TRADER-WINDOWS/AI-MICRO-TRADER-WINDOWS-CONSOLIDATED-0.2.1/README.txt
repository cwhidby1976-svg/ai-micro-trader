AI MICRO TRADER — ATOMIC ADMIN PROVISIONING (INCREMENTAL MODULE)

This is NOT the completed Supabase integration for Batches 4E–4I.
It is a verified, narrowly scoped code contribution toward that integration.

Contents:
- src/server/supabaseAdminProvisioning.ts — server-only atomic first-admin RPC client.
- sql/001_atomic_admin_setup.sql — creates database-side concurrency guard and RPC.
- INSTALL.ps1 — adds one new TypeScript file with rollback if lint fails.

To install: extract ZIP to a separate folder. Open PowerShell at the project root.
Run: powershell -NoProfile -ExecutionPolicy Bypass -File "<extracted folder>\INSTALL.ps1"
Run SQL manually in the Supabase SQL Editor after review. Do not put Supabase secrets in chat.

Do not wire this into /admin/setup yet: the current application still uses the local
JSON database for other operations and will need a coordinated route and persistence
migration. Do not deploy as a completed system. Existing trading code is untouched.

Remaining: member/admin session and route conversion, durable licenses, payment and
coupon transaction logic, audits, stable server secret, tests, live API deployment.
