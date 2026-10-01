import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quest Coder",
  description: "RPG quest packs for learning algorithms through replayable code execution."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
