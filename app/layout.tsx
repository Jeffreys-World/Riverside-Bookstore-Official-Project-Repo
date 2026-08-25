import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
