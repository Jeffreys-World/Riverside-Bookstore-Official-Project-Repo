/**
 * Placeholder landing page. Replace each link target's content in
 * app/product-{a,b,c,d}/page.tsx as you build it — this root page itself
 * is shared and should stay a simple index, not grow product-specific
 * logic. Status is a manual flag for your own tracking as you build
 * through the four products sequentially — update it as you go.
 */
export default function Home() {
  const products = [
    { href: "/product-a", label: "Customer Ordering & Loyalty App", status: "not started" },
    { href: "/product-b", label: "Staff Inventory & Ops Dashboard", status: "not started" },
    { href: "/product-c", label: "Customer Support Chatbot", status: "not started" },
    { href: "/product-d", label: "Marketing Content Generator", status: "not started" },
  ];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Riverside Books</h1>
      <ul className="mt-8 space-y-4">
        {products.map((p) => (
          <li key={p.href} className="rounded-lg border border-neutral-200 p-4">
            <a href={p.href} className="font-medium underline">
              {p.label}
            </a>
            <p className="text-sm text-neutral-500">Status: {p.status}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
