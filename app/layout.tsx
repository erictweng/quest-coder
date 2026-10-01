import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quest Coder",
  description: "RPG quest packs for learning algorithms through replayable code execution.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://quest-coder.local"),
  robots: { index: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true", follow: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true" },
  openGraph: {
    title: "Quest Coder",
    description: "Practice algorithms through quest packs, boss fights, and replayable code execution.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
