import { signInAction } from "../actions";

/**
 * Seeded-staff-user phase (see TODOS.md — real staff role/claim system is
 * deferred). Create the one staff account this expects via the Supabase
 * dashboard: Authentication -> Users -> Add user. There's no self-serve
 * signup here on purpose — this is a staff-only tool.
 */
export default function SignInPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-serif text-2xl text-ink">Staff sign-in</h1>
      <p className="mt-2 text-sm text-ink/70">
        Riverside Books staff only. Ask the store owner for your login if you don&apos;t have
        one yet.
      </p>

      <form action={signInAction} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="mt-1 block min-h-[44px] w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-ink"
          />
        </div>
        <button
          type="submit"
          className="min-h-[44px] rounded-md bg-accent px-6 py-2 font-medium text-white"
        >
          Sign in
        </button>

        {searchParams.error && (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          >
            {searchParams.error}
          </p>
        )}
      </form>
    </main>
  );
}
