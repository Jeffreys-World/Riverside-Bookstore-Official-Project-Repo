"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";

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
