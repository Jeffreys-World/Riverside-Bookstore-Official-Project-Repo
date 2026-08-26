import Link from "next/link";
import { STORE_CONTACT, STORE_HOURS } from "@/lib/store-info";
import { PICKUP_LOCATION } from "@/types/schema";

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">Contact Us</h1>
      <p className="mt-2 text-ink/70">
        Reach a real person for anything the{" "}
        <Link href="/product-c" className="text-accent underline-offset-2 hover:underline">
          Frequently Asked Questions
        </Link>{" "}
        page can&apos;t answer.
      </p>

      <section className="mt-8 rounded-lg border border-ink/10 bg-surface p-5">
        <h2 className="font-serif text-lg text-ink">Email</h2>
        <a
          href={`mailto:${STORE_CONTACT.email}`}
          className="mt-1 block font-mono text-ink underline-offset-2 hover:underline"
        >
          {STORE_CONTACT.email}
        </a>
      </section>

      <section className="mt-4 rounded-lg border border-ink/10 bg-surface p-5">
        <h2 className="font-serif text-lg text-ink">Phone</h2>
        <a
          href={`tel:${STORE_CONTACT.phone.replace(/[^\d+]/g, "")}`}
          className="mt-1 block font-mono text-ink underline-offset-2 hover:underline"
        >
          {STORE_CONTACT.phone}
        </a>
        <p className="mt-1 text-sm text-ink/60">During store hours — see below.</p>
      </section>

      <section className="mt-4 rounded-lg border border-ink/10 bg-surface p-5">
        <h2 className="font-serif text-lg text-ink">Visit</h2>
        <p className="mt-1 text-ink">{PICKUP_LOCATION.name}</p>
        <p className="text-ink/70">{PICKUP_LOCATION.addressLine1}</p>
        <p className="text-ink/70">{PICKUP_LOCATION.addressLine2}</p>
        <p className="mt-2 whitespace-pre-line text-sm text-ink/70">{STORE_HOURS}</p>
      </section>
    </main>
  );
}
