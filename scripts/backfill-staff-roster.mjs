#!/usr/bin/env node
/**
 * scripts/backfill-staff-roster.mjs
 *
 * Run once, right after supabase/migrations/0018_staff_rbac.sql is
 * pushed. That migration re-scopes staff-only RLS policies from
 * "authenticated" to "is_staff()", which reads a new staff_users table —
 * but it starts empty, so the existing staff Supabase Auth account would
 * otherwise be locked out of everything it could do a moment before.
 * This lists every confirmed Supabase Auth user via the admin API and
 * adds each one to staff_users, since (per TODOS.md) the only accounts
 * that exist in this project today are staff accounts — there is no
 * separate customer-auth flow yet for this to conflict with.
 *
 * Usage: node scripts/backfill-staff-roster.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
 * .env.local (or the environment already).
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  } catch {
    // .env.local not present — fall back to whatever's already in the environment.
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Failed to list Supabase Auth users:", error.message);
    process.exit(1);
  }

  const users = data?.users ?? [];
  if (users.length === 0) {
    console.log("No Supabase Auth users found — nothing to backfill.");
    return;
  }

  console.log(`Found ${users.length} confirmed Supabase Auth user(s):`);
  for (const user of users) {
    console.log(`  - ${user.email ?? user.id}`);
  }

  const rows = users.map((user) => ({ user_id: user.id }));
  const { error: upsertError } = await supabase
    .from("staff_users")
    .upsert(rows, { onConflict: "user_id", ignoreDuplicates: true });

  if (upsertError) {
    console.error("Failed to write staff_users:", upsertError.message);
    process.exit(1);
  }

  console.log(`✓ staff_users now includes all ${users.length} account(s) above.`);
}

main();
