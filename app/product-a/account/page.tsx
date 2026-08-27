import { getServerClient } from "@/lib/supabase-server";
import { AccountView } from "./account-view";

// Reads the session cookie, so it can't be statically prerendered — and
// we want the first paint to already know whether the visitor is signed
// in, so a logged-in customer doesn't see a flash of the signed-out
// "Sign in / Create account" screen before the client fetch resolves.
export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { welcome?: string };
}) {
  const supabase = getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">My Account</h1>
      <p className="mt-2 text-ink/70">Your loyalty points and past orders.</p>
      <AccountView
        initialSignedIn={Boolean(user)}
        welcomeClaimed={searchParams.welcome === "claimed"}
      />
    </main>
  );
}
