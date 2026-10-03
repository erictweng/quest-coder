import type { Metadata } from "next";
import { Pixelify_Sans } from "next/font/google";
import { MEDIEVAL } from "../components/medieval/tokens";
import "./globals.css";

// One pixel font for all UI text (OFL). next/font self-hosts it, so browsers never call Google Fonts.
// Code keeps the system monospace font (see globals.css).
const pixelify = Pixelify_Sans({ subsets: ["latin"], display: "swap", variable: "--mq-font" });

// Palette variables (--mq-stone, --mq-gold, ...) come from the single token source.
const paletteVars = Object.fromEntries(Object.entries(MEDIEVAL).map(([name, value]) => [`--mq-${name}`, value])) as React.CSSProperties;

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
      <body className={pixelify.variable} style={paletteVars}>{children}</body>
    </html>
  );
}
