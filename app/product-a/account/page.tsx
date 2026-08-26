import { AccountView } from "./account-view";

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">My Account</h1>
      <p className="mt-2 text-ink/70">Your loyalty points and past orders.</p>
      <AccountView />
    </main>
  );
}
