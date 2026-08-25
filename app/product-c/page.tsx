import { ChatWidget } from "./chat-widget";

export default function ProductCPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-3xl text-ink">Customer Support</h1>
      <p className="mt-2 text-ink/70">
        Ask about stock, an order, upcoming events, hours, or policies.
      </p>
      <ChatWidget />
    </main>
  );
}
