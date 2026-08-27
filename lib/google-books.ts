/**
 * lib/google-books.ts
 *
 * Thin client for the Google Books Volumes API, used to backfill
 * cover_url / description on the books table (see
 * scripts/backfill-book-covers.mjs). Not called on any request path —
 * Product A reads cover_url/description straight from books, it never
 * calls Google Books live. Keeps page loads fast and doesn't add an
 * external-API failure mode to checkout.
 */

export interface BookMetadata {
  coverUrl: string | null;
  description: string | null;
}

/**
 * Google Books' `imageLinks.thumbnail` is a fixed ~128px-wide image
 * (`&zoom=1`), which looks soft on the catalog cards. The same
 * `books.google.com/books/content` endpoint honours an undocumented-but-
 * long-stable `&w=` param: `&w=800` yields up to ~800px for editions with
 * a full preview and ~300px for catalog-only editions (never the "no
 * preview" placeholder, which only `&zoom>=2` triggers). `&edge=curl` (a
 * decorative page-curl) is dropped at the same time. Non-Google URLs
 * (Open Library) pass through untouched. Also upgrades http -> https so
 * the link isn't blocked as mixed content.
 */
export function upgradeCoverUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const url = raw.replace(/^http:/, "https:");
  if (!url.includes("books.google.com/books/content")) return url;
  if (/[?&]w=\d/.test(url)) return url; // already sized
  const withoutCurl = url.replace(/&edge=curl/g, "");
  const withZoom1 = /[?&]zoom=\d+/.test(withoutCurl)
    ? withoutCurl.replace(/([?&]zoom=)\d+/, (_m, p) => `${p}1`)
    : `${withoutCurl}&zoom=1`;
  return withZoom1.replace("zoom=1", "zoom=1&w=800");
}

const MAX_ATTEMPTS = 3;

const OPEN_LIBRARY_COVER_ATTEMPTS = 2;

/**
 * Open Library's covers CDN serves a generic "no cover available" image
 * instead of a 404 unless ?default=false is passed — that's what lets this
 * tell "has a cover for this ISBN" apart from "doesn't."
 */
async function fetchOpenLibraryCover(isbn: string): Promise<string | null> {
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

/**
 * Looks up a single ISBN. Returns null when neither source has anything for
 * it — callers treat that as a normal, expected outcome, not an exception.
 * A transient Google Books server error (429/5xx) is retried with backoff
 * rather than treated as "no match": Google Books' backend returns
 * occasional 503s even on valid keys/quota, and conflating that with "this
 * book doesn't exist" silently drops data.
 *
 * Falls back to Open Library for the cover when Google Books has none —
 * Google Books' coverage skews toward newer/bestselling editions, so
 * smaller or older titles often have no thumbnail there even when Open
 * Library has one, and Open Library needs no API key.
 */
export async function fetchBookMetadata(isbn: string): Promise<BookMetadata | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({ q: `isbn:${isbn}` });
  if (apiKey) params.set("key", apiKey);

  let coverUrl: string | null = null;
  let description: string | null = null;
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
    if (res.ok) {
      const data = await res.json();
      const volumeInfo = data?.items?.[0]?.volumeInfo;
      if (volumeInfo) {
        const rawThumbnail: string | undefined =
          volumeInfo.imageLinks?.thumbnail ?? volumeInfo.imageLinks?.smallThumbnail;
        // http -> https + request a larger render than the 128px default.
        coverUrl = upgradeCoverUrl(rawThumbnail);
        description = volumeInfo.description ?? null;
      }
      lastStatus = null;
      break;
    }

    lastStatus = res.status;
    // 404 means "no such volume" — not transient, don't retry.
    if (res.status === 404) break;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  const googleBooksFailed = lastStatus !== null && lastStatus !== 404;

  if (!coverUrl) {
    coverUrl = await fetchOpenLibraryCover(isbn);
  }

  // A persistent Google Books failure (not a clean 404) only becomes fatal
  // if Open Library couldn't cover for it either — otherwise this is
  // silent partial progress: the caller gets what Open Library found, and
  // description stays null so a later run still picks this ISBN back up.
  if (googleBooksFailed && !coverUrl) {
    throw new Error(`Google Books request failed after ${MAX_ATTEMPTS} attempts (last status ${lastStatus})`);
  }

  return coverUrl || description ? { coverUrl, description } : null;
}

export interface BookSearchCandidate {
  isbn: string;
  title: string;
  author: string;
  coverUrl: string | null;
  description: string | null;
}

/**
 * Free-text search (title/author), for Product B's "search instead of
 * typing an exact ISBN" add-book flow. Unlike fetchBookMetadata this
 * returns several candidates, not a single match — the caller lets staff
 * pick the right edition. Results with no ISBN-13 are dropped: our schema
 * requires one (types/schema.ts's ISBN13_REGEX / addBookRequestSchema),
 * so a result staff couldn't actually add would just be a dead end.
 *
 * Retried the same as fetchBookMetadata: live testing against the real
 * API hit transient 503s on 2 of 3 back-to-back calls, so "just click
 * Search again" would be a bad first impression of this feature, not a
 * rare edge case.
 */
export async function searchBookCandidates(query: string): Promise<BookSearchCandidate[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({ q: query, maxResults: "10" });
  if (apiKey) params.set("key", apiKey);

  let res: Response | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
    if (res.ok) break;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  if (!res || !res.ok) {
    throw new Error(`Google Books search failed after ${MAX_ATTEMPTS} attempts (last status ${res?.status})`);
  }

  const data = await res.json();
  const items: unknown[] = data?.items ?? [];

  const candidates: BookSearchCandidate[] = [];
  for (const item of items) {
    const volumeInfo = (item as { volumeInfo?: Record<string, unknown> }).volumeInfo;
    if (!volumeInfo) continue;

    const identifiers =
      (volumeInfo.industryIdentifiers as Array<{ type: string; identifier: string }> | undefined) ?? [];
    const isbn13 = identifiers.find((id) => id.type === "ISBN_13")?.identifier;
    if (!isbn13) continue; // no ISBN-13 — can't be added under this schema

    const imageLinks = volumeInfo.imageLinks as
      | { thumbnail?: string; smallThumbnail?: string }
      | undefined;
    const rawThumbnail = imageLinks?.thumbnail ?? imageLinks?.smallThumbnail;

    candidates.push({
      isbn: isbn13,
      title: (volumeInfo.title as string) ?? "Untitled",
      author: ((volumeInfo.authors as string[] | undefined) ?? []).join(", ") || "Unknown author",
      coverUrl: upgradeCoverUrl(rawThumbnail),
      description: (volumeInfo.description as string) ?? null,
    });
  }

  // De-dupe by ISBN — the same edition can appear more than once across
  // Google Books' regional/format variants.
  const seen = new Set<string>();
  return candidates.filter((c) => (seen.has(c.isbn) ? false : (seen.add(c.isbn), true)));
}
