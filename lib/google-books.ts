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

const MAX_ATTEMPTS = 3;

/**
 * Looks up a single ISBN. Returns null when Google Books has no match for
 * the ISBN (a real "not found") — callers treat that as a normal,
 * expected outcome, not an exception. A transient server error (429/5xx)
 * is retried with backoff rather than treated as "no match": Google
 * Books' backend returns occasional 503s even on valid keys/quota, and
 * conflating that with "this book doesn't exist" silently drops data.
 */
export async function fetchBookMetadata(isbn: string): Promise<BookMetadata | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({ q: `isbn:${isbn}` });
  if (apiKey) params.set("key", apiKey);

  let lastStatus: number | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
    if (res.ok) {
      const data = await res.json();
      const volumeInfo = data?.items?.[0]?.volumeInfo;
      if (!volumeInfo) return null;

      const rawThumbnail: string | undefined =
        volumeInfo.imageLinks?.thumbnail ?? volumeInfo.imageLinks?.smallThumbnail;

      return {
        // Google Books serves http:// links; upgrade to https so they don't
        // get blocked as mixed content on an https-served app.
        coverUrl: rawThumbnail ? rawThumbnail.replace(/^http:/, "https:") : null,
        description: volumeInfo.description ?? null,
      };
    }

    lastStatus = res.status;
    // 404 means "no such volume" — not transient, don't retry.
    if (res.status === 404) return null;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  throw new Error(`Google Books request failed after ${MAX_ATTEMPTS} attempts (last status ${lastStatus})`);
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
      coverUrl: rawThumbnail ? rawThumbnail.replace(/^http:/, "https:") : null,
      description: (volumeInfo.description as string) ?? null,
    });
  }

  // De-dupe by ISBN — the same edition can appear more than once across
  // Google Books' regional/format variants.
  const seen = new Set<string>();
  return candidates.filter((c) => (seen.has(c.isbn) ? false : (seen.add(c.isbn), true)));
}
