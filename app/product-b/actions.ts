"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { fetchBookMetadata, searchBookCandidates, type BookSearchCandidate } from "@/lib/google-books";
import { addBookRequestSchema, addMerchandiseRequestSchema } from "@/types/schema";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/product-b/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  // Valid Supabase Auth credentials aren't the same as staff — 0018's
  // staff_users/is_staff() is the actual authorization check. A
  // customer account (once real customer auth exists) could otherwise
  // sign in here and land on the staff dashboard's UI, even though every
  // staff-only mutation/read would then fail at the RLS layer.
  const { data: isStaff, error: staffCheckError } = await supabase.rpc("is_staff");
  if (staffCheckError || !isStaff) {
    await supabase.auth.signOut();
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
    redirect(`/product-b?addBookError=${encodeURIComponent(error.message)}`);
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
    redirect(`/product-b?addMerchError=${encodeURIComponent(error.message)}`);
  }

  redirect(`/product-b?merchAdded=${encodeURIComponent(item_name)}`);
}

export type SearchBooksResult =
  | { ok: true; results: BookSearchCandidate[] }
  | { ok: false; message: string };

/**
 * Backs the "search instead of typing an exact ISBN" add-book flow
 * (dashboard.tsx). Not DB-touching — no RLS to fall back on the way
 * addBookAction's insert is protected — so this checks the session
 * itself instead of only relying on the page-level redirect, same
 * least-privilege reasoning as every other staff-only action here.
 */
export async function searchBooksAction(query: string): Promise<SearchBooksResult> {
  const supabase = getServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, message: "Your session expired — sign in again." };
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
