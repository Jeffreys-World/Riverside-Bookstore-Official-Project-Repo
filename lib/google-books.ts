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
