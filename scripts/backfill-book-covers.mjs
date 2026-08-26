#!/usr/bin/env node
/**
 * scripts/backfill-book-covers.mjs
 *
 * One-time/on-demand admin script: fills in cover_url/description for any
 * row in `books` where they're still null, via Google Books
 * (lib/google-books.ts's fetch logic, inlined here since this runs outside
 * Next's module graph). Uses the service-role key to bypass RLS — run
 * manually from a trusted machine, never from app code.
 *
 * Usage: node scripts/backfill-book-covers.mjs
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

const MAX_ATTEMPTS = 3;

// Retries transient errors (429/5xx — Google Books' backend returns
// occasional 503s even on a valid key) instead of treating them as "no
// match," which would silently drop data. 404 means "no such volume" and
// is not retried.
async function fetchBookMetadata(isbn, apiKey) {
  const params = new URLSearchParams({ q: `isbn:${isbn}` });
  if (apiKey) params.set("key", apiKey);

  let lastStatus = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
    if (res.ok) {
      const data = await res.json();
      const volumeInfo = data?.items?.[0]?.volumeInfo;
      if (!volumeInfo) return null;

      const rawThumbnail = volumeInfo.imageLinks?.thumbnail ?? volumeInfo.imageLinks?.smallThumbnail;
      return {
        coverUrl: rawThumbnail ? rawThumbnail.replace(/^http:/, "https:") : null,
        description: volumeInfo.description ?? null,
      };
    }

    lastStatus = res.status;
    if (res.status === 404) return null;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw new Error(`Google Books request failed after ${MAX_ATTEMPTS} attempts (last status ${lastStatus})`);
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const googleApiKey = process.env.GOOGLE_BOOKS_API_KEY;

  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: books, error } = await supabase
    .from("books")
    .select("isbn, book_title, cover_url, description")
    .or("cover_url.is.null,description.is.null");

  if (error) {
    console.error("Failed to load books:", error.message);
    process.exit(1);
  }

  if (!books?.length) {
    console.log("Nothing to backfill — every book already has cover_url + description.");
    return;
  }

  for (const book of books) {
    let metadata;
    try {
      metadata = await fetchBookMetadata(book.isbn, googleApiKey);
    } catch (err) {
      console.warn(`  ✗ ${book.book_title} (${book.isbn}): ${err.message}`);
      continue;
    }
    if (!metadata) {
      console.warn(`  ✗ ${book.book_title} (${book.isbn}): no Google Books match`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("books")
      .update({ cover_url: metadata.coverUrl, description: metadata.description })
      .eq("isbn", book.isbn);

    if (updateError) {
      console.warn(`  ✗ ${book.book_title} (${book.isbn}): ${updateError.message}`);
    } else {
      console.log(`  ✓ ${book.book_title} (${book.isbn})`);
    }

    // Google Books' keyless quota is tight — space requests out.
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

main();
