/**
 * Medieval pixel MMO palette. Dark stone and oak frame the UI; parchment is for reading.
 * Each text colour is only used on the backgrounds listed in MEDIEVAL_TEXT_PAIRS, which a unit
 * test checks against WCAG AA.
 */
export const MEDIEVAL = {
  stone: "#24222B",
  stone2: "#33303C",
  stoneEdge: "#0F0E13",
  stoneLight: "#5A5666",
  oak: "#5A3A22",
  oakLight: "#8A5E37",
  oakEdge: "#2A1A0E",
  parchment: "#F1E2BF",
  parchment2: "#E4CD9C",
  parchmentEdge: "#A8865A",
  text: "#F7EFDD",
  textMuted: "#CFC4AC",
  gold: "#F2C14E",
  goldDark: "#9A6B12",
  emerald: "#5FD383",
  ruby: "#FF7A7F",
  sapphire: "#7FB2F0",
  amethyst: "#C29BF0",
  ember: "#F5A05A",
  ink: "#22180F",
  inkMuted: "#5B4632",
  inkRuby: "#9E1F2A",
  inkEmerald: "#1A5C32",
  inkSapphire: "#1F4F99"
} as const;

export type MedievalToken = keyof typeof MEDIEVAL;

const AA = 4.5;
const pair = (fg: MedievalToken, bg: MedievalToken, min = AA) => ({ label: `${fg} on ${bg}`, fg: MEDIEVAL[fg], bg: MEDIEVAL[bg], min });

export const MEDIEVAL_TEXT_PAIRS = [
  ...(["text", "textMuted", "gold", "emerald", "ruby", "sapphire", "amethyst", "ember"] as const).flatMap((fg) => [pair(fg, "stone"), pair(fg, "stone2")]),
  ...(["text", "textMuted", "gold", "emerald"] as const).map((fg) => pair(fg, "oak")),
  ...(["ink", "inkMuted", "inkRuby", "inkEmerald", "inkSapphire"] as const).flatMap((fg) => [pair(fg, "parchment"), pair(fg, "parchment2")]),
  pair("stone", "gold") // primary button label
];

/** Swatches shown on the style tile, with the background each one is checked against. */
export const SWATCHES: { token: MedievalToken; role: string; on: MedievalToken }[] = [
  { token: "stone", role: "Panels", on: "text" },
  { token: "stone2", role: "Raised panels", on: "text" },
  { token: "oak", role: "Wood frames", on: "text" },
  { token: "parchment", role: "Reading", on: "ink" },
  { token: "parchment2", role: "Notices", on: "ink" },
  { token: "gold", role: "XP, focus, primary", on: "stone" },
  { token: "emerald", role: "Passed, uncommon", on: "stone" },
  { token: "sapphire", role: "Links, rare", on: "stone" },
  { token: "amethyst", role: "Epic", on: "stone" },
  { token: "ruby", role: "Failed, boss", on: "stone" },
  { token: "ember", role: "Warnings", on: "stone" }
];
