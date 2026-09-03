import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockBuddy POS",
  description: "Cloud-based POS and inventory management for F&B businesses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
