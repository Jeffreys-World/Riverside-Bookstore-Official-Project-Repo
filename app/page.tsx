import { redirect } from "next/navigation";

/**
 * The real landing page is /product-a (the catalog, with the site-wide
 * logo header) — this was a dev-status scaffold listing all four
 * products' build status, never meant as the actual customer entry
 * point. Redirecting here also retires its stale "needs GOOGLE_API_KEY"
 * copy (both keys have been configured and verified live since).
 */
export default function Home() {
  redirect("/product-a");
}
