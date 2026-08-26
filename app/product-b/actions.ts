"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { fetchBookMetadata } from "@/lib/google-books";
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
  const parsed = addBookRequestSchema.safeParse({
    isbn: String(formData.get("isbn") ?? "").trim(),
    book_title: String(formData.get("book_title") ?? ""),
    author_name: String(formData.get("author_name") ?? ""),
    stock_quantity: rawStock === "" ? null : Number(rawStock),
  });

  if (!parsed.success) {
    redirect(
      `/product-b?addBookError=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid book details")}`
    );
  }

  const { isbn, book_title, author_name, stock_quantity } = parsed.data;
  const supabase = getServerClient();
  const { error } = await supabase
    .from("books")
    .insert({ isbn, book_title, author_name, stock_quantity });

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

  redirect("/product-b");
}
