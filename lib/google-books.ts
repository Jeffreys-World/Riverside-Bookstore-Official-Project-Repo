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
 * Looks up a single ISBN. Returns null (not a thrown error) when Google
 * Books has no match or the request fails — callers treat "no metadata
 * found" as a normal, expected outcome, not an exception.
 */
export async function fetchBookMetadata(isbn: string): Promise<BookMetadata | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({ q: `isbn:${isbn}` });
  if (apiKey) params.set("key", apiKey);

  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
  if (!res.ok) return null;

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
