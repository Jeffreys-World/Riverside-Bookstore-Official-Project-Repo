import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { SiteNav } from "./site-nav";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

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
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="bg-paper font-sans text-ink">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
