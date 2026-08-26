"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { fetchBookMetadata, searchBookCandidates, type BookSearchCandidate } from "@/lib/google-books";
import { addBookRequestSchema } from "@/types/schema";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/product-b/sign-in?error=${encodeURIComponent(error.message)}`);
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
  const parsed = addBookRequestSchema.safeParse({
    isbn: String(formData.get("isbn") ?? "").trim(),
    book_title: String(formData.get("book_title") ?? ""),
    author_name: String(formData.get("author_name") ?? ""),
    stock_quantity: rawStock === "" ? null : Number(rawStock),
    price: Number(rawPrice),
  });

  if (!parsed.success) {
    redirect(
      `/product-b?addBookError=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid book details")}`
    );
  }

  const { isbn, book_title, author_name, stock_quantity, price } = parsed.data;
  const supabase = getServerClient();
  const { error } = await supabase
    .from("books")
    .insert({ isbn, book_title, author_name, stock_quantity, price });

  if (error) {
    redirect(`/product-b?addBookError=${encodeURIComponent(error.message)}`);
  }

  // Best-effort: populate cover_url/description from Google Books. A
  // failure here must not undo the insert above — null cover/description
  // is already a valid, already-rendered state (see
  // 0005_add_book_metadata.sql), same as a book that's never been
  // backfilled.
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

  redirect(`/product-b?bookAdded=${encodeURIComponent(book_title)}`);
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
