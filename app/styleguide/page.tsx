import type { Metadata } from "next";
import { Pixelify_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { styleguideEnabled } from "../../lib/styleguide";
import { MEDIEVAL } from "../../components/medieval/tokens";
import { StyleTile } from "./style-tile";
import "./medieval.css";

// One pixel font for all UI text (Eric's choice). OFL-licensed; next/font self-hosts it, so the
// browser never calls Google Fonts. Code keeps the system monospace font.
const pixelify = Pixelify_Sans({ subsets: ["latin"], display: "swap", variable: "--mq-font" });

export const metadata: Metadata = { title: "Style tile · Quest Coder", robots: { index: false, follow: false } };

export default function StyleguidePage() {
  if (!styleguideEnabled()) notFound();
  const vars = Object.fromEntries(Object.entries(MEDIEVAL).map(([name, value]) => [`--mq-${name}`, value]));
  return (
    <div className={`mq ${pixelify.variable}`} style={vars as React.CSSProperties}>
      <StyleTile />
    </div>
  );
}
