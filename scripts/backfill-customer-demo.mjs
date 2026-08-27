#!/usr/bin/env node
/**
 * scripts/backfill-customer-demo.mjs
 *
 * Run once, after supabase/migrations/0034_customer_auth.sql is pushed.
 * The seeded demo customer cust_demo01 (with the order history used in
 * screenshots / demos) has no auth.users row, so it can't be used in the
 * logged-in flows. This creates a confirmed Supabase Auth user and links
 * it to cust_demo01 via the new customers.auth_user_id column, so
 * "sign in as the demo customer" works.
 *
 * Usage: node scripts/backfill-customer-demo.mjs [email] [password]
 *   defaults: demo.customer@riverside.test / riverside-demo-01
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
 * .env.local (or the environment already).
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DEMO_CUSTOMER_ID = "cust_demo01";
const DEFAULT_EMAIL = "demo.customer@riverside.test";
const DEFAULT_PASSWORD = "riverside-demo-01";

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
    // .env.local not present — fall back to the environment.
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

  const email = process.argv[2] || DEFAULT_EMAIL;
  const password = process.argv[3] || DEFAULT_PASSWORD;
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: existing } = await supabase
    .from("customers")
    .select("customer_id, auth_user_id")
    .eq("customer_id", DEMO_CUSTOMER_ID)
    .maybeSingle();

  if (!existing) {
    console.error(`${DEMO_CUSTOMER_ID} not found — is the seed data applied?`);
    process.exit(1);
  }
  if (existing.auth_user_id) {
    console.log(`${DEMO_CUSTOMER_ID} is already linked to an auth user. Nothing to do.`);
    return;
  }

  // Reuse an existing auth user with this email if there is one, else create.
  const { data: list } = await supabase.auth.admin.listUsers();
  let user = (list?.users ?? []).find((u) => u.email === email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      console.error("Failed to create the demo auth user:", error.message);
      process.exit(1);
    }
    user = data.user;
    console.log(`Created auth user ${email}`);
  } else {
    console.log(`Reusing existing auth user ${email}`);
  }

  const { error: linkError } = await supabase
    .from("customers")
    .update({ auth_user_id: user.id, email })
    .eq("customer_id", DEMO_CUSTOMER_ID)
    .is("auth_user_id", null);

  if (linkError) {
    console.error("Failed to link the auth user to cust_demo01:", linkError.message);
    process.exit(1);
  }

  console.log(`✓ ${DEMO_CUSTOMER_ID} is now signable-in as ${email} / ${password}`);
}

main();
