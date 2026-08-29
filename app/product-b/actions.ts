"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { fetchBookMetadata, searchBookCandidates, type BookSearchCandidate } from "@/lib/google-books";
import {
  addBookRequestSchema,
  addMerchandiseRequestSchema,
  editListingSchema,
} from "@/types/schema";
import { friendlyDbError, isMappedDbError } from "@/lib/db-errors";
import { assertStaff } from "@/lib/staff-auth";

const BOOK_INSERT_ERRORS = {
  "23505": "A book with that ISBN is already listed.",
  "22003": "That price is too large — check the amount.",
};
const MERCH_INSERT_ERRORS = {
  "23505": "An item with that name is already listed.",
  "22003": "That price is too large — check the amount.",
};

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/product-b/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  // Valid Supabase Auth credentials aren't the same as staff — 0018's
  // staff_users/is_staff() is the actual authorization check. A customer
  // account (real customer auth landed in 0034) can sign in here with
  // valid credentials; every staff-only mutation/read still fails at the
  // RLS layer, and the dashboard page re-checks is_staff() on load, so
  // there's no need to also destroy the session — that would log a
  // customer out of Product A (one shared auth cookie).
  const { data: isStaff, error: staffCheckError } = await supabase.rpc("is_staff");
  if (staffCheckError) {
    console.error(`is_staff() check failed during sign-in: ${staffCheckError.message}`);
    redirect(
      `/product-b/sign-in?error=${encodeURIComponent(
        "We couldn't verify your staff access just now — please try again."
      )}`
    );
  }
  if (!isStaff) {
    redirect(`/product-b/sign-in?error=${encodeURIComponent("This account isn't a staff account.")}`);
  }

  redirect("/product-b");
}

export async function signOutAction() {
  const supabase = getServerClient();
  await supabase.auth.signOut();
  redirect("/product-b/sign-in");
}

export async function addBookAction(formData: FormData) {
  const rawStock = String(formData.get("stock_quantity") ?? "").trim();
  const rawPrice = String(formData.get("price") ?? "").trim();
  const rawDescription = String(formData.get("description") ?? "").trim();
  const rawCoverUrl = String(formData.get("cover_url") ?? "").trim();
  const rawAuthorBio = String(formData.get("author_bio") ?? "").trim();
  const parsed = addBookRequestSchema.safeParse({
    isbn: String(formData.get("isbn") ?? "").trim(),
    book_title: String(formData.get("book_title") ?? ""),
    author_name: String(formData.get("author_name") ?? ""),
    description: rawDescription === "" ? null : rawDescription,
    cover_url: rawCoverUrl === "" ? null : rawCoverUrl,
    author_bio: rawAuthorBio === "" ? null : rawAuthorBio,
    stock_quantity: rawStock === "" ? null : Number(rawStock),
    price: Number(rawPrice),
  });

  if (!parsed.success) {
    redirect(
      `/product-b?addBookError=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid book details")}`
    );
  }

  const { isbn, book_title, author_name, description, cover_url, author_bio, stock_quantity, price } =
    parsed.data;
  const supabase = getServerClient();
  const { error } = await supabase
    .from("books")
    .insert({ isbn, book_title, author_name, description, cover_url, author_bio, stock_quantity, price });

  if (error) {
    if (!isMappedDbError(error, BOOK_INSERT_ERRORS)) {
      console.error(`addBookAction insert failed [${error.code ?? "?"}]: ${error.message}`);
    }
    redirect(
      `/product-b?addBookError=${encodeURIComponent(friendlyDbError(error, BOOK_INSERT_ERRORS))}`
    );
  }

  // Only auto-fetch from Google Books if staff didn't provide either
  // field manually — a manual description/cover is an explicit override
  // (e.g. the ISBN doesn't resolve on Google Books, or resolves to the
  // wrong title — see TODOS.md's 2026-08-26 asset-fix entry for exactly
  // that happening to 3 of the original 6 seed books), so auto-lookup
  // must not silently clobber it. Best-effort either way: a failure here
  // must not undo the insert above — null cover/description is already a
  // valid, already-rendered state (see 0005_add_book_metadata.sql).
  if (description === null && cover_url === null) {
    try {
      const metadata = await fetchBookMetadata(isbn);
      if (metadata) {
        await supabase
          .from("books")
          .update({ cover_url: metadata.coverUrl, description: metadata.description })
          .eq("isbn", isbn);
      }
    } catch {
      // Swallow — the book is already added; metadata can be backfilled
      // later via scripts/backfill-book-covers.mjs.
    }
  }

  redirect(`/product-b?bookAdded=${encodeURIComponent(book_title)}`);
}

export async function addMerchandiseAction(formData: FormData) {
  const rawStock = String(formData.get("stock_quantity") ?? "").trim();
  const rawPrice = String(formData.get("price") ?? "").trim();
  const rawImageUrl = String(formData.get("image_url") ?? "").trim();
  const parsed = addMerchandiseRequestSchema.safeParse({
    item_name: String(formData.get("item_name") ?? ""),
    category: String(formData.get("category") ?? ""),
    stock_quantity: rawStock === "" ? null : Number(rawStock),
    price: Number(rawPrice),
    image_url: rawImageUrl === "" ? null : rawImageUrl,
  });

  if (!parsed.success) {
    redirect(
      `/product-b?addMerchError=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid item details")}`
    );
  }

  const { item_name, category, stock_quantity, price, image_url } = parsed.data;
  const supabase = getServerClient();
  const { error } = await supabase
    .from("merchandise")
    .insert({ item_name, category, stock_quantity, price, image_url });

  if (error) {
    // item_name is the table's unique key (0009_merchandise.sql) — a
    // duplicate name is the one realistic failure here, same shape as a
    // duplicate ISBN failing addBookAction's insert.
    if (!isMappedDbError(error, MERCH_INSERT_ERRORS)) {
      console.error(`addMerchandiseAction insert failed [${error.code ?? "?"}]: ${error.message}`);
    }
    redirect(
      `/product-b?addMerchError=${encodeURIComponent(friendlyDbError(error, MERCH_INSERT_ERRORS))}`
    );
  }

  redirect(`/product-b?merchAdded=${encodeURIComponent(item_name)}`);
}

export type RemoveStockResult =
  | { ok: true; stockQuantity: number }
  | { ok: false; message: string };

/**
 * Manual correction for a stock_quantity typo'd too high — not the
 * pre-order path, so no `stock_quantity > 0` guard here by design, just
 * the atomic clamp-at-0 inside remove_book_stock() itself (0032).
 */
export async function removeBookStockAction(isbn: string, amount: number): Promise<RemoveStockResult> {
  if (!(await assertStaff())) {
    return { ok: false, message: "Staff access required." };
  }
  if (!Number.isInteger(amount) || amount < 1) {
    return { ok: false, message: "Enter a whole number of 1 or more." };
  }

  const supabase = getServerClient();
  const { data, error } = await supabase.rpc("remove_book_stock", { p_isbn: isbn, p_amount: amount });
  if (error) {
    console.error(`removeBookStockAction failed [${error.code ?? "?"}]: ${error.message}`);
    return { ok: false, message: friendlyDbError(error) };
  }
  if (data === null) {
    return {
      ok: false,
      message: "Couldn't adjust that title — it may not be inventoried yet.",
    };
  }
  return { ok: true, stockQuantity: data as number };
}

export async function removeMerchandiseStockAction(id: string, amount: number): Promise<RemoveStockResult> {
  if (!(await assertStaff())) {
    return { ok: false, message: "Staff access required." };
  }
  if (!Number.isInteger(amount) || amount < 1) {
    return { ok: false, message: "Enter a whole number of 1 or more." };
  }

  const supabase = getServerClient();
  const { data, error } = await supabase.rpc("remove_merchandise_stock", { p_id: id, p_amount: amount });
  if (error) {
    console.error(`removeMerchandiseStockAction failed [${error.code ?? "?"}]: ${error.message}`);
    return { ok: false, message: friendlyDbError(error) };
  }
  if (data === null) {
    return {
      ok: false,
      message: "Couldn't adjust that item — it may not be inventoried yet.",
    };
  }
  return { ok: true, stockQuantity: data as number };
}

export type UpdateListingResult =
  | { ok: true; stockQuantity: number | null; price: number }
  | { ok: false; message: string };

const LISTING_UPDATE_ERRORS = {
  "22003": "That price is too large — check the amount.",
};

/**
 * The other half of the stock-correction story: removeBookStockAction
 * only ever decrements, so a count typed too LOW (or a genuine restock,
 * or a wrong price) had no in-app fix at all for any title with order
 * history — deleteBookAction fails on the orders.isbn FK. This SETS both
 * columns instead, under 0032's staff UPDATE policy (no RPC, no new
 * migration — the policy already permits exactly this write).
 *
 * Last-write-wins on purpose: a manual count is staff saying "this is
 * what's on the shelf right now", which should overwrite, unlike a
 * pre-order's decrement that must compose atomically with concurrent
 * ones (create_preorder, 0011).
 */
export async function updateBookListingAction(
  isbn: string,
  input: unknown
): Promise<UpdateListingResult> {
  if (!(await assertStaff())) {
    return { ok: false, message: "Staff access required." };
  }
  const parsed = editListingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the values and try again." };
  }

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("books")
    .update({ stock_quantity: parsed.data.stock_quantity, price: parsed.data.price })
    .eq("isbn", isbn)
    .select("stock_quantity, price")
    .maybeSingle();

  if (error) {
    if (!isMappedDbError(error, LISTING_UPDATE_ERRORS)) {
      console.error(`updateBookListingAction failed [${error.code ?? "?"}]: ${error.message}`);
    }
    return { ok: false, message: friendlyDbError(error, LISTING_UPDATE_ERRORS) };
  }
  if (!data) {
    return { ok: false, message: "That title is no longer listed — refresh the dashboard." };
  }
  return { ok: true, stockQuantity: data.stock_quantity, price: data.price };
}

/** Merchandise twin of updateBookListingAction — same policy, same rules. */
export async function updateMerchandiseListingAction(
  id: string,
  input: unknown
): Promise<UpdateListingResult> {
  if (!(await assertStaff())) {
    return { ok: false, message: "Staff access required." };
  }
  const parsed = editListingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the values and try again." };
  }

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("merchandise")
    .update({ stock_quantity: parsed.data.stock_quantity, price: parsed.data.price })
    .eq("id", id)
    .select("stock_quantity, price")
    .maybeSingle();

  if (error) {
    if (!isMappedDbError(error, LISTING_UPDATE_ERRORS)) {
      console.error(`updateMerchandiseListingAction failed [${error.code ?? "?"}]: ${error.message}`);
    }
    return { ok: false, message: friendlyDbError(error, LISTING_UPDATE_ERRORS) };
  }
  if (!data) {
    return { ok: false, message: "That item is no longer listed — refresh the dashboard." };
  }
  return { ok: true, stockQuantity: data.stock_quantity, price: data.price };
}

export type DeleteListingResult = { ok: true } | { ok: false; message: string };

/**
 * Removes a listing entirely — for a genuinely bad entry (duplicate,
 * wrong price), not a stock_quantity correction (see removeBookStockAction
 * above, which only zeroes the count and leaves the listing visible).
 * Fails cleanly if the title has real order history, since orders.isbn has
 * no ON DELETE clause (0001's initial schema) — that foreign-key violation
 * is surfaced as a plain message instead of leaking the raw Postgres error.
 */
export async function deleteBookAction(isbn: string): Promise<DeleteListingResult> {
  if (!(await assertStaff())) {
    return { ok: false, message: "Staff access required." };
  }
  const supabase = getServerClient();
  const { error } = await supabase.from("books").delete().eq("isbn", isbn);
  if (error) {
    const message = friendlyDbError(error, {
      "23503": "Can't remove — this title has order history. Use Remove stock instead.",
    });
    if (error.code !== "23503") {
      console.error(`deleteBookAction failed [${error.code ?? "?"}]: ${error.message}`);
    }
    return { ok: false, message };
  }
  return { ok: true };
}

export async function deleteMerchandiseAction(id: string): Promise<DeleteListingResult> {
  if (!(await assertStaff())) {
    return { ok: false, message: "Staff access required." };
  }
  const supabase = getServerClient();
  const { error } = await supabase.from("merchandise").delete().eq("id", id);
  if (error) {
    const message = friendlyDbError(error, {
      "23503": "Can't remove — this item has order history.",
    });
    if (error.code !== "23503") {
      console.error(`deleteMerchandiseAction failed [${error.code ?? "?"}]: ${error.message}`);
    }
    return { ok: false, message };
  }
  return { ok: true };
}

export type SearchBooksResult =
  | { ok: true; results: BookSearchCandidate[] }
  | { ok: false; message: string };

/**
 * Backs the "search instead of typing an exact ISBN" add-book flow
 * (dashboard.tsx). Not DB-touching — no RLS to fall back on the way
 * addBookAction's insert is protected — so this runs the full is_staff()
 * check itself, matching every mutation here rather than only checking
 * that *a* session exists (a signed-in Product A customer holds one too).
 */
export async function searchBooksAction(query: string): Promise<SearchBooksResult> {
  if (!(await assertStaff())) {
    return { ok: false, message: "Staff access required." };
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { ok: false, message: "Enter at least 2 characters to search." };
  }

  try {
    const results = await searchBookCandidates(trimmed);
    return { ok: true, results };
  } catch {
    return { ok: false, message: "Google Books search failed. Please try again." };
  }
}
