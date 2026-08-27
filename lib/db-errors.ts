/**
 * Maps raw Postgres/PostgREST error codes to copy a non-technical staff
 * member can act on. Several Product B actions were redirecting with
 * `error.message` verbatim, so the common "re-added an ISBN that's
 * already listed" mistake rendered as
 * `duplicate key value violates unique constraint "books_pkey"`.
 *
 * Pass `overrides` to give a code a context-specific message
 * (e.g. 23505 -> "A book with that ISBN is already listed.").
 */

interface CodedError {
  code?: string | null;
  message?: string | null;
}

const DEFAULT_BY_CODE: Record<string, string> = {
  "23505": "That entry already exists.",
  "23503": "This can't be changed because other records depend on it.",
  "22003": "That number is outside the allowed range.",
  "23514": "One of those values isn't allowed.",
  "23502": "A required field is missing.",
};

const GENERIC = "Something went wrong saving that. Please try again.";

export function friendlyDbError(
  error: CodedError,
  overrides?: Record<string, string>
): string {
  const code = error.code ?? "";
  return overrides?.[code] ?? DEFAULT_BY_CODE[code] ?? GENERIC;
}

/** True when the code has a specific mapping — i.e. it's an expected,
 *  user-actionable failure rather than something worth logging. */
export function isMappedDbError(error: CodedError, overrides?: Record<string, string>): boolean {
  const code = error.code ?? "";
  return Boolean(overrides?.[code] ?? DEFAULT_BY_CODE[code]);
}
