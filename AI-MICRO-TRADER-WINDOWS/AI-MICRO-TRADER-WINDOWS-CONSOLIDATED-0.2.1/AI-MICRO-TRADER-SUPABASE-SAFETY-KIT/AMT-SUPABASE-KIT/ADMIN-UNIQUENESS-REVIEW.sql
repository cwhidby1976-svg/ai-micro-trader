-- PROPOSED CONSTRAINT FOR REVIEW, NOT AN AUTHENTICATION MIGRATION.
-- Allows at most ONE row in amt_admin_users.
-- Before running, confirm this is the intended business rule and inspect current rows.
SELECT COUNT(*) AS existing_admins FROM public.amt_admin_users;
-- Run the following separately ONLY if existing_admins <= 1 and only one admin is intended:
-- CREATE UNIQUE INDEX IF NOT EXISTS amt_only_one_admin_idx ON public.amt_admin_users ((1));
-- This protects against two concurrent initial-admin inserts but does not by itself
-- implement a complete secure provisioning workflow or session management.
