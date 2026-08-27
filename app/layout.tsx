import type { Metadata } from "next";
import { Inter, Fraunces, IBM_Plex_Mono } from "next/font/google";
import { SiteNav } from "./site-nav";
import { CartProvider } from "@/components/cart-provider";
import { CartDrawer } from "@/components/cart-drawer";
import { ProductDrawerProvider } from "@/components/product-drawer-provider";
import { ProductDrawer } from "@/components/product-drawer";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  axes: ["opsz", "SOFT"],
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Riverside Books",
  description: "Riverside Bookstore product suite",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets the `dark` class before first paint so there's no flash of
            the wrong theme — this can't wait for React to hydrate, hence
            a plain inline script rather than a useEffect in ThemeToggle. */}
        <script
          dangerouslySetInnerHTML={{
            // The matchMedia fallback is in its own try so a context where
            // merely touching localStorage throws (sandboxed iframe,
            // "block all cookies") still honours the OS dark preference
            // instead of silently falling through to light.
            __html: `(function(){var d=false;try{var t=localStorage.getItem("riverside-theme");if(t){d=t==="dark";}else{d=window.matchMedia("(prefers-color-scheme: dark)").matches;}}catch(e){try{d=window.matchMedia("(prefers-color-scheme: dark)").matches;}catch(_){}}try{document.documentElement.classList.toggle("dark",d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-paper font-sans text-ink">
        <CartProvider>
          <ProductDrawerProvider>
            <SiteNav />
            {children}
            <CartDrawer />
            <ProductDrawer />
          </ProductDrawerProvider>
        </CartProvider>
      </body>
    </html>
  );
}
