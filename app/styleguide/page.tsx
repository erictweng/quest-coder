import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { styleguideEnabled } from "../../lib/styleguide";
import { StyleTile } from "./style-tile";

export const metadata: Metadata = { title: "Style tile · Quest Coder", robots: { index: false, follow: false } };

// Font and palette variables come from the root layout; .mq adds the style tile's wall and type scale.
export default function StyleguidePage() {
  if (!styleguideEnabled()) notFound();
  return (
    <div className="mq">
      <StyleTile />
    </div>
  );
}
