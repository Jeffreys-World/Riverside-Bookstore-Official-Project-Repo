#!/usr/bin/env node
/**
 * scripts/backfill-book-covers.mjs
 *
 * One-time/on-demand admin script: fills in cover_url/description for any
 * row in `books` where they're still null, via Google Books with an Open
 * Library cover fallback (lib/google-books.ts's fetch logic, inlined here
 * since this runs outside Next's module graph). Uses the service-role key
 * to bypass RLS — run manually from a trusted machine, never from app code.
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
const OPEN_LIBRARY_COVER_ATTEMPTS = 2;

// Mirrors lib/google-books.ts upgradeCoverUrl: http->https, and swap
// Google Books' 128px &zoom=1 thumbnail for a &w=800 render of the same
// cover. Non-Google URLs pass through.
function upgradeCoverUrl(raw) {
  if (!raw) return null;
  const url = raw.replace(/^http:/, "https:");
  if (!url.includes("books.google.com/books/content")) return url;
  if (/[?&]w=\d/.test(url)) return url;
  const withoutCurl = url.replace(/&edge=curl/g, "");
  const withZoom1 = /[?&]zoom=\d+/.test(withoutCurl)
    ? withoutCurl.replace(/([?&]zoom=)\d+/, (_m, p) => `${p}1`)
    : `${withoutCurl}&zoom=1`;
  return withZoom1.replace("zoom=1", "zoom=1&w=800");
}

// Open Library's covers CDN serves a generic "no cover" image instead of a
// 404 unless ?default=false is passed.
async function fetchOpenLibraryCover(isbn) {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  for (let attempt = 1; attempt <= OPEN_LIBRARY_COVER_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return url;
      if (res.status === 404) return null;
    } catch {
      // Network error — fall through to retry/give up below.
    }
    if (attempt < OPEN_LIBRARY_COVER_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return null;
}

// Retries transient errors (429/5xx — Google Books' backend returns
// occasional 503s even on a valid key) instead of treating them as "no
// match," which would silently drop data. 404 means "no such volume" and
// is not retried. Falls back to Open Library for the cover when Google
// Books has none — its coverage skews toward newer/bestselling editions.
async function fetchBookMetadata(isbn, apiKey) {
  const params = new URLSearchParams({ q: `isbn:${isbn}` });
  if (apiKey) params.set("key", apiKey);

  let coverUrl = null;
  let description = null;
  let lastStatus = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
    if (res.ok) {
      const data = await res.json();
      const volumeInfo = data?.items?.[0]?.volumeInfo;
      if (volumeInfo) {
        const rawThumbnail = volumeInfo.imageLinks?.thumbnail ?? volumeInfo.imageLinks?.smallThumbnail;
        coverUrl = upgradeCoverUrl(rawThumbnail);
        description = volumeInfo.description ?? null;
      }
      lastStatus = null;
      break;
    }

    lastStatus = res.status;
    if (res.status === 404) break;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  const googleBooksFailed = lastStatus !== null && lastStatus !== 404;

  if (!coverUrl) {
    coverUrl = await fetchOpenLibraryCover(isbn);
  }

  if (googleBooksFailed && !coverUrl) {
    throw new Error(`Google Books request failed after ${MAX_ATTEMPTS} attempts (last status ${lastStatus})`);
  }

  return coverUrl || description ? { coverUrl, description } : null;
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
      console.warn(`  ✗ ${book.book_title} (${book.isbn}): no match on Google Books or Open Library`);
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
